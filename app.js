/* ================= WEEPL v2.7 =================
   - Home: активная дата = сегодня и центрирование в полосе
   - Свайпы задач: вправо — Done, влево — меню переноса
   - Быстрое меню переноса (+1д, +1н, выбрать дату/время)
   - Остальной функционал сохранён
================================================= */

// ---------- STATE ----------
let state = {
  view: 'home',
  tasks: JSON.parse(localStorage.getItem('tasks') || '[]'),
  settings: JSON.parse(localStorage.getItem('settings') || '{}'),
  currentDate: new Date()
};

// ---------- HELPERS ----------
const qs  = (s, p=document) => p.querySelector(s);
const qsa = (s, p=document) => [...p.querySelectorAll(s)];
const esc = s => String(s||'').replace(/[&<>"']/g,m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m]));
const sameDay = (a,b)=>a.getFullYear()===b.getFullYear()&&a.getMonth()===b.getMonth()&&a.getDate()===b.getDate();
const toISO = d => new Date(d.getFullYear(),d.getMonth(),d.getDate()).toISOString().slice(0,10);
const addDays = (d,n)=>{const x=new Date(d);x.setDate(x.getDate()+n);return x;};
const addMonths = (d,n)=>{const x=new Date(d);x.setMonth(x.getMonth()+n);return x;};
const priName = {low:'Низкий',medium:'Средний',high:'Высокий',critical:'Критический'};
const priColor = p => ({low:'#bfbfbf',medium:'var(--accent)',high:'#ff4fa3',critical:'#8a2be2'})[p]||'var(--accent)';
const timeToMin = (t)=>{ if(!t) return 24*60+1; const m=/^(\d{1,2}):(\d{2})$/.exec(t.trim()); return m?(+m[1])*60+(+m[2]):24*60+1; };

// ---------- BOOT ----------
window.addEventListener('DOMContentLoaded', () => {
  state.currentDate = new Date(); // по умолчанию — сегодня
  mountLayout();
  applySettings();
  navigate(location.hash || '#/');
  window.addEventListener('hashchange', ()=> navigate(location.hash || '#/'));
});

// ---------- LAYOUT ----------
function mountLayout(){
  const app = qs('#app');
  app.innerHTML = `
    <main id="view" class="section"></main>

    <button id="fabAdd" class="fab" aria-label="Добавить">+</button>

    <nav class="bottombar" role="navigation" aria-label="Основная навигация">
      <a class="navbtn" href="#/"          title="Задачи">${iconTasks()}</a>
      <a class="navbtn" href="#/calendar"  title="Календарь">${iconCalendar()}</a>
      <a class="navbtn" href="#/stats"     title="Статистика">${iconStats()}</a>
      <a class="navbtn" href="#/settings"  title="Настройки">${iconGear()}</a>
    </nav>

    <!-- Перенос дедлайна -->
    <dialog id="resModal" class="modal">
      <div class="modal-body">
        <div class="modal-head">
          <h3 class="h-impact" style="font-size:22px">Перенести дедлайн</h3>
          <button class="icon-btn" data-close>✖</button>
        </div>
        <div class="grid2">
          <button class="btn" data-res="+1d">+ 1 день</button>
          <button class="btn" data-res="+1w">+ 1 неделя</button>
        </div>
        <div class="grid2" style="margin-top:10px">
          <input type="date" id="resDate">
          <input type="time" id="resTime">
        </div>
        <div class="modal-foot">
          <button class="btn-outline" data-close>Отмена</button>
          <button class="btn" id="resApply">Применить</button>
        </div>
      </div>
    </dialog>

    <!-- Добавление задачи -->
    <dialog id="taskModal" class="modal">
      <form id="taskForm" method="dialog">
        <div class="modal-body">
          <div class="modal-head">
            <h3 class="h-impact" style="font-size:22px">Новая задача</h3>
            <button data-close type="button" class="icon-btn">✖</button>
          </div>

          <div class="field"><label>Название</label><input id="fTitle" name="title" required/></div>
          <div class="grid2">
            <div class="field"><label>Дата</label><input id="fDate" type="date" name="date"/></div>
            <div class="field"><label>Время</label><input id="fTime" type="time" name="time"/></div>
          </div>
          <div class="grid2">
            <div class="field">
              <label>Важность</label>
              <select id="fPriority" name="priority">
                <option value="low">Низкая</option>
                <option value="medium" selected>Средняя</option>
                <option value="high">Высокая</option>
                <option value="critical">Критическая</option>
              </select>
            </div>
            <div class="field"><label>SMART</label><input id="fSmart" name="smart" placeholder="Specific/Measurable/..."></div>
          </div>
          <div class="field"><label>Комментарий</label><textarea id="fNote" name="note" rows="2"></textarea></div>

          <div class="modal-foot">
            <button data-close type="button" class="btn-outline">Отмена</button>
            <button type="submit" class="btn">Сохранить</button>
          </div>
        </div>
      </form>
    </dialog>
  `;
  qs('#fabAdd').onclick = openModal;
}

// ---------- ROUTER ----------
function navigate(hash){
  const view = (hash.replace('#/','') || 'home');
  state.view = view;
  qsa('.navbtn').forEach(a => a.classList.toggle('active', a.getAttribute('href') === hash));
  const root = qs('#view');

  if(view==='calendar'){ mountCalendar(root); return; }
  if(view==='settings'){ mountSettings(root); return; }
  if(view==='stats'){    mountStats(root);    return; }
  mountHome(root);
}

// ---------- HOME ----------
function mountHome(root){
  // если пришли «домой» из другого раздела — подстрахуемся и выставим сегодня по центру
  if(!sameDay(state.currentDate, new Date())) {
    // не ломаем выбор пользователя: центровать будем только при первом заходе
  }

  root.innerHTML = `
    <section class="home fade-in">
      <div class="month-bar">
        <button class="month-btn" id="btnPrev" aria-label="Предыдущий месяц">←</button>
        <h2 id="homeMonth" class="h-impact"></h2>
        <button class="month-btn" id="btnNext" aria-label="Следующий месяц">→</button>
      </div>

      <div id="dateStrip" class="date-strip"></div>

      <div class="tasks-card">
        <div class="tasks-head">
          <div>
            <div class="title h-sub" style="margin:0">Сегодня</div>
            <div class="muted" id="tasksMeta"></div>
          </div>
        </div>
        <div class="tasks-scroll">
          <div id="taskTimeline" class="timeline"></div>
        </div>
      </div>
    </section>
  `;

  qs('#btnPrev').onclick = ()=>{ state.currentDate = addMonths(state.currentDate,-1); mountHome(root); };
  qs('#btnNext').onclick = ()=>{ state.currentDate = addMonths(state.currentDate, 1); mountHome(root); };

  updateHomeHeader();
  renderDateStrip(true);          // true => центрировать активную
  renderTasksTimeline(state.currentDate);
}

function updateHomeHeader(){
  qs('#homeMonth').textContent = state.currentDate.toLocaleString('ru-RU',{month:'long',year:'numeric'});
}

function renderDateStrip(centerActive=false){
  const strip = qs('#dateStrip'); strip.innerHTML='';
  const y=state.currentDate.getFullYear(), m=state.currentDate.getMonth();
  const days = new Date(y,m+1,0).getDate();
  const today = new Date();

  for(let i=1;i<=days;i++){
    const d = new Date(y,m,i);
    const el = document.createElement('div');
    const isActive = sameDay(d,state.currentDate) || (sameDay(d,today) && sameDay(state.currentDate,today));
    el.className = 'date-pill' + (isActive?' active':'');
    el.innerHTML = `
      <div class="wk">${d.toLocaleDateString('ru-RU',{weekday:'short'})}</div>
      <div class="daynum">${i}</div>
      <div class="mon">${d.toLocaleDateString('ru-RU',{month:'short'})}</div>`;
    el.onclick = ()=>{ state.currentDate=d; updateHomeHeader(); renderDateStrip(); renderTasksTimeline(d); };
    strip.appendChild(el);
  }

  if(centerActive){
    // аккуратно центруем активную пилюлю
    const active = qs('.date-pill.active', strip);
    if(active){
      const offset = active.offsetLeft - (strip.clientWidth/2 - active.clientWidth/2);
      strip.scrollTo({left: Math.max(offset,0), behavior:'instant' in strip ? 'instant' : 'auto'});
    }
  }
}

function renderTasksTimeline(d){
  const box = qs('#taskTimeline');
  const iso = toISO(d);
  const tasks = state.tasks
    .filter(t=>t.date===iso)
    .sort((a,b)=> timeToMin(a.time) - timeToMin(b.time));

  qs('#tasksMeta').textContent = tasks.length ? `Задач: ${tasks.length}` : 'Нет задач на эту дату.';

  if(!tasks.length){ box.innerHTML=''; return; }

  box.innerHTML = tasks.map(t=>timelineItem(t)).join('');
  // кнопки
  qsa('.btn-done', box).forEach(b => b.onclick = e => toggleDone(e.target.dataset.id));
  qsa('.btn-del',  box).forEach(b => b.onclick = e => deleteTask(e.target.dataset.id));
  // свайпы
  qsa('.t-item', box).forEach(el => attachSwipe(el));
}

function timelineItem(t){
  const done = t.done ? ' done' : '';
  const meta = [
    t.time || '—',
    `приоритет: ${priName[t.priority]||'—'}`,
    t.smart ? `SMART: ${esc(t.smart)}` : null
  ].filter(Boolean).join(' • ');

  return `<div class="t-item${done}" data-id="${t.id}" style="touch-action: pan-y;">
    <div class="row1">
      <div class="t-title">${esc(t.title)}</div>
      <div class="task-ctl">
        <button class="icon-btn btn-done" data-id="${t.id}" title="Готово">✔</button>
        <button class="icon-btn btn-del"  data-id="${t.id}" title="Удалить">🗑</button>
      </div>
    </div>
    <div class="t-meta">${meta}</div>
  </div>`;
}

// ---------- SWIPE ----------
function attachSwipe(el){
  let startX=0, curX=0, dragging=false, id=el.dataset.id;
  const THRESH = 64; // пикселей до действия

  const onStart = (x)=>{ dragging=true; startX=x; el.style.transition='none'; };
  const onMove  = (x)=>{
    if(!dragging) return;
    curX = x - startX;
    // ограничим визуальный сдвиг
    const dx = Math.max(Math.min(curX, 120), -120);
    el.style.transform = `translateX(${dx}px)`;
    el.style.opacity = `${1 - Math.min(Math.abs(dx)/220, .4)}`;
  };
  const onEnd = ()=>{
    if(!dragging) return;
    el.style.transition='transform .18s, opacity .18s';
    if(curX > THRESH){ // вправо — done
      el.style.transform='translateX(100%)'; el.style.opacity='0';
      setTimeout(()=> toggleDone(id), 140);
    }else if(curX < -THRESH){ // влево — перенос
      el.style.transform='translateX(-100%)'; el.style.opacity='0';
      setTimeout(()=> showReschedule(id), 120);
    }else{
      el.style.transform='translateX(0)'; el.style.opacity='1';
    }
    dragging=false; startX=curX=0;
  };

  // мышь
  el.addEventListener('mousedown',e=>onStart(e.clientX));
  window.addEventListener('mousemove',e=>onMove(e.clientX));
  window.addEventListener('mouseup', onEnd);
  // touch
  el.addEventListener('touchstart',e=>onStart(e.touches[0].clientX),{passive:true});
  el.addEventListener('touchmove', e=>onMove(e.touches[0].clientX),{passive:true});
  el.addEventListener('touchend', onEnd);
}

// ---------- RESCHEDULE ----------
let rescheduleId = null;
function showReschedule(id){
  rescheduleId = id;
  const t = state.tasks.find(x=>x.id===id);
  const dlg = qs('#resModal');
  const dateInput = qs('#resDate'), timeInput = qs('#resTime');
  dateInput.value = t?.date || toISO(state.currentDate);
  timeInput.value = t?.time || '';
  dlg.showModal();

  qsa('[data-close]', dlg).forEach(b=> b.onclick=()=> dlg.close());
  qsa('[data-res]', dlg).forEach(b=> b.onclick = ()=>{
    if(!rescheduleId) return;
    const tx = state.tasks.find(x=>x.id===rescheduleId);
    if(!tx) return;
    const op=b.dataset.res;
    if(op==='+1d') tx.date = toISO(addDays(new Date(tx.date||toISO(new Date())),1));
    if(op==='+1w') tx.date = toISO(addDays(new Date(tx.date||toISO(new Date())),7));
    saveTasks(); dlg.close(); navigate('#/');
  });
  qs('#resApply').onclick = ()=>{
    const tx = state.tasks.find(x=>x.id===rescheduleId);
    if(tx){
      if(dateInput.value) tx.date = dateInput.value;
      tx.time = timeInput.value || '';
      saveTasks();
    }
    dlg.close(); navigate('#/');
  };
}

// ---------- CALENDAR ----------
function mountCalendar(root){
  const d=state.currentDate;
  root.innerHTML = `
    <section class="fade-in">
      <div class="calendar-head">
        <button class="month-btn" id="calPrev">←</button>
        <h2 id="calTitle" class="h-impact"></h2>
        <button class="month-btn" id="calNext">→</button>
      </div>
      <div id="calendarGrid" class="calendar-grid"></div>
      <div class="legend">
        <span><i class="lg lg-low"></i> Низкий</span>
        <span><i class="lg lg-med"></i> Средний</span>
        <span><i class="lg lg-high"></i> Высокий</span>
        <span><i class="lg lg-crit"></i> Критический</span>
      </div>
    </section>
  `;

  qs('#calTitle').textContent = d.toLocaleString('ru-RU',{month:'long',year:'numeric'});
  qs('#calPrev').onclick=()=>{ state.currentDate=addMonths(state.currentDate,-1); mountCalendar(root); };
  qs('#calNext').onclick=()=>{ state.currentDate=addMonths(state.currentDate, 1); mountCalendar(root); };

  const grid=qs('#calendarGrid');
  const names=['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];
  names.forEach(n=>{ const c=document.createElement('div'); c.className='cell head'; c.textContent=n; grid.appendChild(c); });

  const y=d.getFullYear(), m=d.getMonth();
  const first=new Date(y,m,1);
  const offset=(first.getDay()+6)%7;
  for(let i=0;i<offset;i++){ const e=document.createElement('div'); e.className='cell'; grid.appendChild(e); }

  const days=new Date(y,m+1,0).getDate();
  for(let i=1;i<=days;i++){
    const date=new Date(y,m,i);
    const iso=toISO(date);
    const tasks=state.tasks.filter(t=>t.date===iso);
    const c=document.createElement('div'); c.className='cell daycell';
    c.innerHTML=`<div class="dhead">${i}</div><div class="dots">${tasks.map(t=>`<span class="dot" style="background:${priColor(t.priority)}"></span>`).join('')}</div>`;
    if(sameDay(date,new Date())) c.classList.add('today');
    c.onclick=()=>{ state.currentDate=date; location.hash='#/'; };
    grid.appendChild(c);
  }
}

// ---------- STATS ----------
function mountStats(root){
  root.innerHTML = `
    <section class="stats fade-in">
      <h2 class="h-impact" style="margin:6px">Статистика</h2>
      <div class="stats-grid">
        <div class="card center">
          <div class="ring">
            <svg viewBox="0 0 120 120" class="ring-svg">
              <circle cx="60" cy="60" r="52" class="ring-bg"/>
              <circle id="ringFg" cx="60" cy="60" r="52" class="ring-fg"/>
            </svg>
            <div class="ring-val"><span id="statDonePct">0</span>%</div>
          </div>
          <div class="muted">Выполнено за неделю</div>
        </div>
        <div class="card"><div class="kpi"><span id="statWeekDone">0</span><small> / <span id="statWeekTotal">0</span></small></div><div class="muted">За 7 дней</div></div>
        <div class="card"><div class="kpi"><span id="statMonthDone">0</span><small> / <span id="statMonthTotal">0</span></small></div><div class="muted">За месяц</div></div>
        <div class="card"><div class="kpi"><span id="statStreak">0</span><small> дн.</small></div><div class="muted">Серия выполнения</div></div>
      </div>
      <div class="card barcard">
        <div class="bar-head"><div class="h-sub" style="margin:0">Выполнено по дням</div><div class="muted" id="barRange">последние 7 дней</div></div>
        <div class="bars" id="bars"></div>
        <div class="bar-labels" id="barLabels"></div>
      </div>
    </section>
  `;
  updateStats();
}
function updateStats(){
  const tasks=state.tasks, now=new Date();
  const weekAgo=addDays(now,-7), monthAgo=addMonths(now,-1);
  const weekTasks=tasks.filter(t=>new Date(t.date)>=weekAgo);
  const weekDone =weekTasks.filter(t=>t.done);
  const monthTasks=tasks.filter(t=>new Date(t.date)>=monthAgo);
  const monthDone =monthTasks.filter(t=>t.done);
  const pct=weekTasks.length?Math.round(weekDone.length/weekTasks.length*100):0;
  qs('#statDonePct').textContent=pct;
  qs('#ringFg').style.strokeDashoffset = (326 - 326*pct/100);
  qs('#statWeekDone').textContent=weekDone.length; qs('#statWeekTotal').textContent=weekTasks.length;
  qs('#statMonthDone').textContent=monthDone.length; qs('#statMonthTotal').textContent=monthTasks.length;
  qs('#statStreak').textContent = calcStreak(tasks);

  const bars=qs('#bars'), labels=qs('#barLabels'); bars.innerHTML=labels.innerHTML='';
  for(let i=6;i>=0;i--){
    const d=addDays(now,-i), iso=toISO(d);
    const tot=tasks.filter(t=>t.date===iso).length;
    const dn =tasks.filter(t=>t.date===iso && t.done).length;
    const h=tot?Math.round(dn/tot*100):0;
    const b=document.createElement('div'); b.className='bar'; b.style.height=`${h}px`; bars.appendChild(b);
    const l=document.createElement('div'); l.textContent=d.toLocaleDateString('ru-RU',{weekday:'short'}); labels.appendChild(l);
  }
}
function calcStreak(tasks){
  const set=[...new Set(tasks.filter(t=>t.done).map(t=>t.date))].sort();
  let max=0,cur=0,last=null;
  for(const iso of set){const d=new Date(iso); if(last && (d-last)/86400000===1) cur++; else cur=1; if(cur>max)max=cur; last=d;}
  return max;
}

// ---------- SETTINGS ----------
function mountSettings(root){
  root.innerHTML = `
    <section class="fade-in">
      <div class="settings-section">
        <div class="section-title">Внешний вид</div>
        <div class="settings-list">
          <div class="row item">
            <div class="left"><div class="label">Тема</div><div class="sub">Светлая / тёмная</div></div>
            <div class="right"><select id="setTheme"><option value="light">Светлая</option><option value="dark">Тёмная</option></select></div>
          </div>
          <div class="row item">
            <div class="left"><div class="label">Акцентный цвет</div><div class="sub">Современные оттенки</div></div>
            <div class="right">
              <select id="setAccent">
                <option value="violet">Фиолетовый</option><option value="blue">Синий</option><option value="rose">Розовый</option>
                <option value="mint">Мятный</option><option value="lemon">Жёлтый</option><option value="coral">Коралловый</option>
                <option value="azure">Голубой</option><option value="orchid">Орхидея</option><option value="sky">Небесный</option><option value="lime">Лайм</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <div class="settings-section">
        <div class="section-title">Календарь</div>
        <div class="settings-list">
          <div class="row item">
            <div class="left"><div class="label">Неделя начинается с</div><div class="sub">Понедельника или воскресенья</div></div>
            <div class="right"><select id="setWeekStart"><option value="1">Понедельника</option><option value="0">Воскресенья</option></select></div>
          </div>
          <div class="row item">
            <div class="left"><div class="label">Кнопка «Сегодня»</div><div class="sub">Быстрый переход к текущей дате</div></div>
            <div class="right"><label class="switch"><input type="checkbox" id="setShowToday"><span class="slider"></span></label></div>
          </div>
          <div class="row item">
            <div class="left"><div class="label">Точки приоритетов</div><div class="sub">Индикаторы в сетке календаря</div></div>
            <div class="right"><label class="switch"><input type="checkbox" id="setShowDots"><span class="slider"></span></label></div>
          </div>
        </div>
      </div>

      <div class="settings-section">
        <div class="section-title">Данные</div>
        <div class="settings-list">
          <div class="row item">
            <div class="left"><div class="label">Экспорт / импорт</div><div class="sub">JSON с вашими задачами</div></div>
            <div class="right gap">
              <button class="btn" id="btnExport">Экспорт</button>
              <label class="btn-outline">Импорт <input type="file" id="fileImport" hidden></label>
            </div>
          </div>
        </div>
      </div>
    </section>
  `;

  const s = state.settings;
  qs('#setTheme').value      = s.theme || 'light';
  qs('#setAccent').value     = s.accent || 'violet';
  qs('#setWeekStart').value  = s.weekStart || '1';
  qs('#setShowToday').checked= s.showToday ?? true;
  qs('#setShowDots').checked = s.showDots  ?? true;

  qsa('select, input[type="checkbox"]', root).forEach(el => el.onchange = saveSettings);
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
  const s=state.settings;
  document.documentElement.dataset.theme  = s.theme  || 'light';
  document.documentElement.dataset.accent = s.accent || 'violet';
}

// ---------- MODAL / TASKS ----------
function openModal(){
  const dlg=qs('#taskModal'); dlg.showModal();
  const form=qs('#taskForm');
  form.reset();
  qs('#fDate').value = toISO(state.currentDate);

  form.onsubmit = e=>{
    e.preventDefault();
    const f = Object.fromEntries(new FormData(form).entries());
    const t = {
      id: Date.now().toString(36),
      title: (f.title||'').trim(),
      date: f.date || toISO(new Date()),
      time: f.time || '',
      priority: f.priority || 'medium',
      smart: f.smart || '',
      note: f.note || '',
      done: false
    };
    state.tasks.push(t); saveTasks(); dlg.close(); navigate('#/');
  };
  qsa('[data-close]', dlg).forEach(b=> b.onclick=()=> dlg.close());
}
function saveTasks(){ localStorage.setItem('tasks', JSON.stringify(state.tasks)); }
function toggleDone(id){ const t=state.tasks.find(x=>x.id===id); if(t){ t.done=!t.done; saveTasks(); navigate('#/'); } }
function deleteTask(id){ state.tasks=state.tasks.filter(t=>t.id!==id); saveTasks(); navigate('#/'); }

// ---------- IMPORT / EXPORT ----------
function exportData(){
  const blob=new Blob([JSON.stringify({tasks:state.tasks,settings:state.settings},null,2)],{type:'application/json'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='weepl-data.json'; a.click();
}
function importData(e){
  const f=e.target.files[0]; if(!f) return;
  const r=new FileReader();
  r.onload=()=>{ try{
    const data=JSON.parse(r.result);
    if(data.tasks) state.tasks=data.tasks;
    if(data.settings) state.settings=data.settings;
    saveTasks(); localStorage.setItem('settings',JSON.stringify(state.settings)); location.reload();
  }catch{ alert('Ошибка импорта'); } };
  r.readAsText(f);
}

// ---------- ICONS ----------
function iconTasks(){return `<svg viewBox="0 0 24 24" width="24" height="24"><path fill="currentColor" d="M9 3h6a2 2 0 0 1 2 2h1a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h1a2 2 0 0 1 2-2Zm0 2a1 1 0 0 0-1 1H6v12h12V6h-2a1 1 0 0 0-1-1H9Zm1 6h6v2h-6v-2Zm0 4h6v2h-6v-2Zm-2-4H6v2h2v-2Zm0 4H6v2h2v-2Z"/></svg>`;}
function iconCalendar(){return `<svg viewBox="0 0 24 24" width="24" height="24"><path fill="currentColor" d="M7 2h2v2h6V2h2v2h2a2 2 0 0 1 2 2v3H3V6a2 2 0 0 1 2-2h2V2Zm14 7v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9h18Zm-11 3H6v3h4v-3Z"/></svg>`;}
function iconStats(){return `<svg viewBox="0 0 24 24" width="24" height="24"><path fill="currentColor" d="M4 21a1 1 0 0 1-1-1V4h2v15h15v2H4Zm4-4V9h3v8H8Zm5 0V5h3v12h-3Z"/></svg>`;}
function iconGear(){return `<svg viewBox="0 0 24 24" width="24" height="24"><path fill="currentColor" d="M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8Zm8.94 3.34 1.56.9-1 1.73-1.78-.32a7.97 7.97 0 0 1-1.03 1.79l.57 1.71-1.86 1.08-1.25-1.29a7.9 7.9 0 0 1-2.06.6L13.5 20h-3l-.53-1.46a7.9 7.9 0 0 1-2.06-.6L6.16 19.2 4.3 18.12l.57-1.71a8.05 8.05 0 0 1-1.03-1.79l-1.78.32-1-1.73 1.56-.9a8.2 8.2 0 0 1 0-2.68l-1.56-.9 1-1.73 1.78.32c.28-.64.63-1.24 1.03-1.79L4.3 3.88 6.16 2.8l1.25 1.29c.65-.28 1.34-.48 2.06-.6L10.5 2h3l.53 1.46c.72.12 1.41.32 2.06.6L17.34 2.8 19.2 3.88l-.57 1.71c.4.55.75 1.15 1.03 1.79l1.78-.32 1 1.73-1.56.9c.09.44.12.89.12 1.34s-.03.9-.12 1.34Z"/></svg>`;}
