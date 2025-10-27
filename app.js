// ===== WEEPL APP v2.5.0 =====

// global state
let state = {
  view: 'home',
  tasks: JSON.parse(localStorage.getItem('tasks') || '[]'),
  settings: JSON.parse(localStorage.getItem('settings') || '{}'),
  currentDate: new Date(),
};

// DOM helpers
const qs = (s, p = document) => p.querySelector(s);
const qsa = (s, p = document) => [...p.querySelectorAll(s)];

// init
window.addEventListener('DOMContentLoaded', () => {
  initLayout();
  applySettings();
  navigate(location.hash || '#/');
  window.addEventListener('hashchange', () => navigate(location.hash));
});

function initLayout() {
  document.body.innerHTML = qs('#layout').innerHTML;
  qs('#fabAdd').addEventListener('click', openModal);
}

// ===== NAVIGATION =====
function navigate(hash) {
  const view = hash.replace('#/', '') || 'home';
  state.view = view;
  qsa('.navbtn').forEach(a => a.classList.toggle('active', a.dataset.route === hash));
  const main = qs('#view');
  main.innerHTML = '';
  switch (view) {
    case 'calendar': main.appendChild(loadTemplate('calendar-view')); initCalendar(); break;
    case 'settings': main.appendChild(loadTemplate('settings-view')); initSettings(); break;
    case 'stats': main.appendChild(loadTemplate('stats-view')); initStats(); break;
    default: main.appendChild(loadTemplate('home-view')); initHome();
  }
}

function loadTemplate(id) {
  return document.importNode(qs(`#${id}`).content, true);
}

// ====== HOME ======
function initHome() {
  renderMonthBar();
  renderDateStrip();
  renderTasksForDate(state.currentDate);
}

function renderMonthBar() {
  const h2 = qs('#homeMonth');
  const monthName = state.currentDate.toLocaleString('ru-RU', { month: 'long', year: 'numeric' });
  h2.textContent = monthName;
  qs('[data-home-month="prev"]').onclick = () => changeMonth(-1);
  qs('[data-home-month="next"]').onclick = () => changeMonth(1);
}

function changeMonth(delta) {
  const d = new Date(state.currentDate);
  d.setMonth(d.getMonth() + delta);
  state.currentDate = d;
  initHome();
}

function renderDateStrip() {
  const strip = qs('#dateStrip');
  strip.innerHTML = '';
  const base = new Date(state.currentDate.getFullYear(), state.currentDate.getMonth(), 1);
  const daysInMonth = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();
  const today = new Date();
  for (let i = 1; i <= daysInMonth; i++) {
    const d = new Date(base.getFullYear(), base.getMonth(), i);
    const div = document.createElement('div');
    div.className = 'date-pill' + (sameDay(d, state.currentDate) ? ' active' : '');
    div.innerHTML = `<div class="wk">${d.toLocaleDateString('ru-RU',{weekday:'short'})}</div>
                     <div class="daynum">${i}</div>
                     <div class="mon">${d.toLocaleDateString('ru-RU',{month:'short'})}</div>`;
    div.onclick = () => { state.currentDate = d; renderDateStrip(); renderTasksForDate(d); };
    strip.appendChild(div);
  }
}

function renderTasksForDate(d) {
  const list = qs('#taskList');
  const dateStr = d.toISOString().split('T')[0];
  const tasks = state.tasks.filter(t => t.date === dateStr);
  qs('#todayTitle').textContent = d.toLocaleDateString('ru-RU',{ day:'numeric', month:'long', year:'numeric'});
  list.innerHTML = tasks.length
    ? tasks.map(renderTask).join('')
    : '<div class="muted">Нет задач на эту дату.</div>';
  qsa('.btn-done', list).forEach(btn => btn.onclick = e => toggleDone(e.target.dataset.id));
  qsa('.btn-del', list).forEach(btn => btn.onclick = e => deleteTask(e.target.dataset.id));
}

function renderTask(t) {
  const done = t.done ? 'is-done' : '';
  const pri = { low:'Низкий', medium:'Средний', high:'Высокий', critical:'Критический' }[t.priority];
  return `<div class="task ${done}">
    <div>
      <div><strong>${t.title}</strong></div>
      <div class="muted">${t.time || ''} • приоритет: ${pri}</div>
    </div>
    <div class="ctl">
      <button class="icon-btn btn-done" data-id="${t.id}">✔</button>
      <button class="icon-btn btn-del" data-id="${t.id}">🗑</button>
    </div>
  </div>`;
}

// ===== CALENDAR =====
function initCalendar() {
  renderCalendar();
}

function renderCalendar() {
  const cont = qs('#calendarGrid');
  const d = state.currentDate;
  const y = d.getFullYear(), m = d.getMonth();
  qs('#calTitle').textContent = d.toLocaleString('ru-RU', { month:'long', year:'numeric' });
  qs('[data-cal="prev"]').onclick = () => { state.currentDate.setMonth(m-1); renderCalendar(); };
  qs('[data-cal="next"]').onclick = () => { state.currentDate.setMonth(m+1); renderCalendar(); };

  const firstDay = new Date(y, m, 1);
  const daysInMonth = new Date(y, m+1, 0).getDate();
  cont.innerHTML = '';
  const weekDays = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];
  weekDays.forEach(dn => {
    const div = document.createElement('div');
    div.textContent = dn;
    div.className = 'cell head';
    cont.appendChild(div);
  });

  const offset = (firstDay.getDay()+6)%7;
  for (let i=0;i<offset;i++) cont.appendChild(blankCell());

  for (let i=1;i<=daysInMonth;i++) {
    const date = new Date(y,m,i);
    const dateStr = date.toISOString().split('T')[0];
    const tasks = state.tasks.filter(t=>t.date===dateStr);
    const cell = document.createElement('div');
    cell.className = 'cell daycell';
    cell.innerHTML = `<div class="dhead">${i}</div><div class="dots">${tasks.map(t=>`<span class="dot" style="background:${priColor(t.priority)}"></span>`).join('')}</div>`;
    if (sameDay(date,new Date())) cell.classList.add('today');
    cell.onclick=()=>{state.currentDate=date;location.hash='#/';};
    cont.appendChild(cell);
  }
}
function blankCell(){const d=document.createElement('div');d.className='cell empty';return d;}
function priColor(p){return({low:'#bfbfbf',medium:'var(--accent)',high:'#ff4fa3',critical:'#8a2be2'})[p];}

// ===== STATS =====
function initStats() {
  updateStats();
}

function updateStats() {
  const tasks = state.tasks;
  const done = tasks.filter(t=>t.done);
  const now = new Date();
  const weekAgo = new Date(now); weekAgo.setDate(now.getDate()-7);
  const monthAgo = new Date(now); monthAgo.setMonth(now.getMonth()-1);

  const weekTasks = tasks.filter(t=>new Date(t.date)>=weekAgo);
  const monthTasks = tasks.filter(t=>new Date(t.date)>=monthAgo);
  const weekDone = weekTasks.filter(t=>t.done);
  const monthDone = monthTasks.filter(t=>t.done);

  const pct = weekTasks.length?Math.round(weekDone.length/weekTasks.length*100):0;
  qs('#statDonePct').textContent = pct;
  const circle = qs('#ringFg');
  const len = 326; circle.style.strokeDashoffset = len - len*pct/100;

  qs('#statWeekDone').textContent = weekDone.length;
  qs('#statWeekTotal').textContent = weekTasks.length;
  qs('#statMonthDone').textContent = monthDone.length;
  qs('#statMonthTotal').textContent = monthTasks.length;
  qs('#statStreak').textContent = calcStreak(tasks);

  // bar chart
  const bars = qs('#bars'), labels = qs('#barLabels');
  bars.innerHTML = labels.innerHTML = '';
  for (let i=6;i>=0;i--) {
    const d = new Date(now); d.setDate(now.getDate()-i);
    const dayStr = d.toISOString().split('T')[0];
    const total = tasks.filter(t=>t.date===dayStr).length;
    const doneC = tasks.filter(t=>t.date===dayStr && t.done).length;
    const h = total ? Math.round(doneC/total*100) : 0;
    const b = document.createElement('div');
    b.className='bar'; b.style.height=`${h}px`;
    bars.appendChild(b);
    const lab = document.createElement('div');
    lab.textContent = d.toLocaleDateString('ru-RU',{weekday:'short'});
    labels.appendChild(lab);
  }
}

function calcStreak(tasks){
  const dates = [...new Set(tasks.filter(t=>t.done).map(t=>t.date))].sort();
  let max=0,curr=0,last=null;
  for(let d of dates){
    const dt=new Date(d);
    if(last && (dt-last)/86400000===1) curr++; else curr=1;
    if(curr>max)max=curr;
    last=dt;
  }
  return max;
}

// ===== SETTINGS =====
function initSettings(){
  const s = state.settings;
  qs('#setTheme').value = s.theme || 'light';
  qs('#setAccent').value = s.accent || 'violet';
  qs('#setWeekStart').value = s.weekStart || '1';
  qs('#setShowToday').checked = s.showToday ?? true;
  qs('#setShowDots').checked = s.showDots ?? true;

  qsa('#settings-view select, #settings-view input').forEach(el=>el.onchange=saveSettings);
  qs('#btnExport').onclick=exportData;
  qs('#fileImport').onchange=importData;
}

function saveSettings(){
  const s = state.settings = {
    theme: qs('#setTheme').value,
    accent: qs('#setAccent').value,
    weekStart: qs('#setWeekStart').value,
    showToday: qs('#setShowToday').checked,
    showDots: qs('#setShowDots').checked
  };
  localStorage.setItem('settings', JSON.stringify(s));
  applySettings();
}

function applySettings(){
  const s = state.settings;
  document.documentElement.dataset.theme = s.theme || 'light';
  document.documentElement.dataset.accent = s.accent || 'violet';
}

// ===== TASK MODAL =====
function openModal(){
  const dlg = qs('#taskModal');
  dlg.showModal();
  const form = qs('#taskForm');
  form.onsubmit = e => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(form).entries());
    const t = {
      id:Date.now().toString(36),
      title:f.title.trim(),
      date:f.date || new Date().toISOString().split('T')[0],
      time:f.time||'',
      priority:f.priority||'medium',
      smart:f.smart||'',
      note:f.note||'',
      done:false
    };
    state.tasks.push(t);
    saveTasks();
    dlg.close();
    navigate('#/');
  };
  qsa('[data-close]',dlg).forEach(b=>b.onclick=()=>dlg.close());
}

// ===== STORAGE =====
function saveTasks(){
  localStorage.setItem('tasks', JSON.stringify(state.tasks));
}
function toggleDone(id){
  const t=state.tasks.find(x=>x.id===id); if(t){t.done=!t.done; saveTasks(); navigate('#/');}
}
function deleteTask(id){
  state.tasks = state.tasks.filter(t=>t.id!==id);
  saveTasks();
  navigate('#/');
}

// ===== EXPORT / IMPORT =====
function exportData(){
  const blob=new Blob([JSON.stringify({tasks:state.tasks,settings:state.settings},null,2)],{type:'application/json'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download='weepl-data.json';
  a.click();
}
function importData(e){
  const file=e.target.files[0];
  if(!file)return;
  const r=new FileReader();
  r.onload=()=>{
    try{
      const data=JSON.parse(r.result);
      if(data.tasks)state.tasks=data.tasks;
      if(data.settings)state.settings=data.settings;
      saveTasks();
      localStorage.setItem('settings',JSON.stringify(state.settings));
      location.reload();
    }catch(err){alert('Ошибка импорта');}
  };
  r.readAsText(file);
}

// ===== HELPERS =====
function sameDay(a,b){return a.getFullYear()===b.getFullYear()&&a.getMonth()===b.getMonth()&&a.getDate()===b.getDate();}
