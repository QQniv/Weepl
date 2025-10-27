// ===== WEEPL APP v2.5.1 (fix) =====

// global state
let state = {
  view: 'home',
  tasks: JSON.parse(localStorage.getItem('tasks') || '[]'),
  settings: JSON.parse(localStorage.getItem('settings') || '{}'),
  currentDate: new Date(),
};

// DOM helpers
const qs  = (s, p=document) => p.querySelector(s);
const qsa = (s, p=document) => [...p.querySelectorAll(s)];

// boot
window.addEventListener('DOMContentLoaded', () => {
  initLayout();          // ⬅️ больше НЕ перезаписываем body
  applySettings();
  navigate(location.hash || '#/');
  window.addEventListener('hashchange', () => navigate(location.hash));
});

function initLayout(){
  // оставляем все <template> в документе и только монтируем layout
  const host = qs('#app');
  const layoutTpl = qs('#layout');
  host.innerHTML = ''; // на случай повторной инициализации
  host.appendChild(layoutTpl.content.cloneNode(true));

  qs('#fabAdd').addEventListener('click', openModal);
}

/* ================= NAVIGATION ================= */
function navigate(hash){
  const view = hash.replace('#/','') || 'home';
  state.view = view;

  // активность иконок
  qsa('.navbtn').forEach(a => a.classList.toggle('active', a.getAttribute('href') === hash));

  const main = qs('#view');
  main.innerHTML = '';

  switch(view){
    case 'calendar': main.appendChild(loadTemplate('calendar-view')); initCalendar(); break;
    case 'settings': main.appendChild(loadTemplate('settings-view')); initSettings(); break;
    case 'stats':    main.appendChild(loadTemplate('stats-view'));    initStats();    break;
    default:         main.appendChild(loadTemplate('home-view'));     initHome();
  }
}

function loadTemplate(id){
  const t = qs(`#${id}`);
  // защита: если по какой-то причине шаблон не найден — показываем stub
  if(!t){ 
    const div = document.createElement('div');
    div.textContent = 'Шаблон не найден: ' + id;
    return div;
  }
  return document.importNode(t.content, true);
}

/* ================= HOME ================= */
function initHome(){
  renderMonthBar();
  renderDateStrip();
  renderTasksForDate(state.currentDate);
}
function renderMonthBar(){
  const h2 = qs('#homeMonth');
  h2.textContent = state.currentDate.toLocaleString('ru-RU',{month:'long',year:'numeric'});
  qs('[data-home-month="prev"]').onclick = ()=> changeMonth(-1);
  qs('[data-home-month="next"]').onclick = ()=> changeMonth(1);
}
function changeMonth(delta){
  const d = new Date(state.currentDate);
  d.setMonth(d.getMonth()+delta);
  state.currentDate = d;
  initHome();
}
function renderDateStrip(){
  const strip = qs('#dateStrip'); strip.innerHTML='';
  const y = state.currentDate.getFullYear(), m = state.currentDate.getMonth();
  const days = new Date(y, m+1, 0).getDate();
  for(let i=1;i<=days;i++){
    const d = new Date(y,m,i);
    const pill = document.createElement('div');
    pill.className = 'date-pill' + (sameDay(d,state.currentDate)?' active':'');
    pill.innerHTML = `
      <div class="wk">${d.toLocaleDateString('ru-RU',{weekday:'short'})}</div>
      <div class="daynum">${i}</div>
      <div class="mon">${d.toLocaleDateString('ru-RU',{month:'short'})}</div>`;
    pill.onclick = ()=>{ state.currentDate=d; renderDateStrip(); renderTasksForDate(d); };
    strip.appendChild(pill);
  }
}
function renderTasksForDate(d){
  const list = qs('#taskList');
  qs('#todayTitle').textContent = d.toLocaleDateString('ru-RU',{ day:'numeric', month:'long', year:'numeric' });
  const dateStr = toISODate(d);
  const tasks = state.tasks.filter(t=>t.date===dateStr);
  list.innerHTML = tasks.length ? tasks.map(renderTask).join('') : '<div class="muted">Нет задач на эту дату.</div>';
  qsa('.btn-done', list).forEach(btn => btn.onclick = e => toggleDone(e.target.dataset.id));
  qsa('.btn-del',  list).forEach(btn => btn.onclick = e => deleteTask(e.target.dataset.id));
}
function renderTask(t){
  const done = t.done ? 'is-done' : '';
  const pri = {low:'Низкий',medium:'Средний',high:'Высокий',critical:'Критический'}[t.priority];
  return `<div class="task ${done}">
    <div>
      <div class="title"><strong>${escapeHtml(t.title)}</strong></div>
      <div class="muted">${t.time||''} • приоритет: ${pri||'—'}</div>
    </div>
    <div class="ctl">
      <button class="icon-btn btn-done" data-id="${t.id}">✔</button>
      <button class="icon-btn btn-del"  data-id="${t.id}">🗑</button>
    </div>
  </div>`;
}

/* ================= CALENDAR ================= */
function initCalendar(){ renderCalendar(); }
function renderCalendar(){
  const cont = qs('#calendarGrid');
  const d = state.currentDate;
  const y = d.getFullYear(), m = d.getMonth();
  qs('#calTitle').textContent = d.toLocaleString('ru-RU',{month:'long',year:'numeric'});
  qs('[data-cal="prev"]').onclick = ()=>{ state.currentDate.setMonth(m-1); renderCalendar(); };
  qs('[data-cal="next"]').onclick = ()=>{ state.currentDate.setMonth(m+1); renderCalendar(); };

  cont.innerHTML='';
  const names = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];
  names.forEach(n=>{ const c=document.createElement('div'); c.className='cell head'; c.textContent=n; cont.appendChild(c); });

  const first = new Date(y,m,1);
  const offset = (first.getDay()+6)%7;
  for(let i=0;i<offset;i++) cont.appendChild(blankCell());

  const days = new Date(y,m+1,0).getDate();
  for(let i=1;i<=days;i++){
    const date = new Date(y,m,i);
    const iso = toISODate(date);
    const tasks = state.tasks.filter(t=>t.date===iso);
    const cell = document.createElement('div');
    cell.className = 'cell daycell';
    cell.innerHTML = `<div class="dhead">${i}</div><div class="dots">${tasks.map(t=>`<span class="dot" style="background:${priColor(t.priority)}"></span>`).join('')}</div>`;
    if(sameDay(date,new Date())) cell.classList.add('today');
    cell.onclick = ()=>{ state.currentDate=date; location.hash='#/'; };
    cont.appendChild(cell);
  }
}
function blankCell(){ const d=document.createElement('div'); d.className='cell empty'; return d; }
function priColor(p){ return ({low:'#bfbfbf',medium:'var(--accent)',high:'#ff4fa3',critical:'#8a2be2'})[p]||'var(--accent)'; }

/* ================= STATS ================= */
function initStats(){ updateStats(); }
function updateStats(){
  const tasks = state.tasks;
  const now = new Date();
  const weekAgo = addDays(now,-7);
  const monthAgo = addMonths(now,-1);

  const weekTasks  = tasks.filter(t=>new Date(t.date)>=weekAgo);
  const weekDone   = weekTasks.filter(t=>t.done);
  const monthTasks = tasks.filter(t=>new Date(t.date)>=monthAgo);
  const monthDone  = monthTasks.filter(t=>t.done);

  const pct = weekTasks.length ? Math.round(weekDone.length/weekTasks.length*100) : 0;
  qs('#statDonePct').textContent = pct;
  const len = 326;
  qs('#ringFg').style.strokeDashoffset = (len - len*pct/100);

  qs('#statWeekDone').textContent  = weekDone.length;
  qs('#statWeekTotal').textContent = weekTasks.length;
  qs('#statMonthDone').textContent = monthDone.length;
  qs('#statMonthTotal').textContent= monthTasks.length;
  qs('#statStreak').textContent    = calcStreak(tasks);

  const bars = qs('#bars'), labels = qs('#barLabels');
  bars.innerHTML = labels.innerHTML = '';
  for(let i=6;i>=0;i--){
    const d = addDays(now,-i);
    const iso = toISODate(d);
    const total = tasks.filter(t=>t.date===iso).length;
    const done  = tasks.filter(t=>t.date===iso && t.done).length;
    const h = total ? Math.round(done/total*100) : 0;
    const b=document.createElement('div'); b.className='bar'; b.style.height=`${h}px`; bars.appendChild(b);
    const l=document.createElement('div'); l.textContent=d.toLocaleDateString('ru-RU',{weekday:'short'}); labels.appendChild(l);
  }
}
function calcStreak(tasks){
  const set = [...new Set(tasks.filter(t=>t.done).map(t=>t.date))].sort();
  let max=0,cur=0,last=null;
  for(const iso of set){
    const d = new Date(iso);
    if(last && (d-last)/86400000===1) cur++; else cur=1;
    if(cur>max) max=cur; last=d;
  }
  return max;
}

/* ================= SETTINGS ================= */
function initSettings(){
  const s = state.settings;
  qs('#setTheme').value      = s.theme || 'light';
  qs('#setAccent').value     = s.accent || 'violet';
  qs('#setWeekStart').value  = s.weekStart || '1';
  qs('#setShowToday').checked= s.showToday ?? true;
  qs('#setShowDots').checked = s.showDots  ?? true;

  qsa('#settings-view select, #settings-view input').forEach(el=> el.onchange = saveSettings);
  qs('#btnExport').onclick = exportData;
  qs('#fileImport').onchange = importData;
}
function saveSettings(){
  state.settings = {
    theme: qs('#setTheme').value,
    accent: qs('#setAccent').value,
    weekStart: qs('#setWeekStart').value,
    showToday: qs('#setShowToday').checked,
    showDots: qs('#setShowDots').checked
  };
  localStorage.setItem('settings', JSON.stringify(state.settings));
  applySettings();
}
function applySettings(){
  const s = state.settings;
  document.documentElement.dataset.theme  = s.theme  || 'light';
  document.documentElement.dataset.accent = s.accent || 'violet';
}

/* ================= MODAL / TASKS ================= */
function openModal(){
  const dlg = qs('#taskModal'); dlg.showModal();
  const form = qs('#taskForm');
  form.reset();
  form.onsubmit = e=>{
    e.preventDefault();
    const f = Object.fromEntries(new FormData(form).entries());
    const t = {
      id: Date.now().toString(36),
      title: (f.title||'').trim(),
      date: f.date || toISODate(new Date()),
      time: f.time || '',
      priority: f.priority || 'medium',
      smart: f.smart || '',
      note: f.note || '',
      done: false
    };
    state.tasks.push(t); saveTasks(); dlg.close(); navigate('#/');
  };
  qsa('[data-close]', dlg).forEach(b=> b.onclick = ()=> dlg.close());
}
function saveTasks(){ localStorage.setItem('tasks', JSON.stringify(state.tasks)); }
function toggleDone(id){ const t=state.tasks.find(x=>x.id===id); if(t){t.done=!t.done; saveTasks(); navigate('#/');} }
function deleteTask(id){ state.tasks = state.tasks.filter(t=>t.id!==id); saveTasks(); navigate('#/'); }

/* ================= EXPORT / IMPORT ================= */
function exportData(){
  const blob = new Blob([JSON.stringify({tasks:state.tasks,settings:state.settings},null,2)],{type:'application/json'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='weepl-data.json'; a.click();
}
function importData(e){
  const file=e.target.files[0]; if(!file) return;
  const r=new FileReader();
  r.onload=()=>{ try{
      const data=JSON.parse(r.result);
      if(data.tasks) state.tasks=data.tasks;
      if(data.settings) state.settings=data.settings;
      saveTasks(); localStorage.setItem('settings', JSON.stringify(state.settings));
      location.reload();
    }catch{ alert('Ошибка импорта'); } };
  r.readAsText(file);
}

/* ================= HELPERS ================= */
function sameDay(a,b){ return a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate(); }
function toISODate(d){ return new Date(d.getFullYear(),d.getMonth(),d.getDate()).toISOString().slice(0,10); }
function escapeHtml(s){ return String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
function addDays(d,n){ const x=new Date(d); x.setDate(x.getDate()+n); return x; }
function addMonths(d,n){ const x=new Date(d); x.setMonth(x.getMonth()+n); return x; }
