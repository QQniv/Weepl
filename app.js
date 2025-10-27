/* ===================== WEEPL v3.0 =====================
 - Главная:
    • Пояс дат, сегодня по центру
    • Секции: События (таймлайн 06–20, шаг 15 м) + Задачи (скролл)
    • Свайпы задач: вправо — done, влево — перенос (FIX: отмена не скрывает)
 - Добавление:
    • Быстрый диалог: Задача / Событие
 - Календарь, Статистика:
    • Кольцо с процентом по центру
 - Навигация нижней панелью
 - Настройки: тема/акцент/стиль/масштаб (persist)
======================================================= */

const qs  = (s,p=document)=>p.querySelector(s);
const qsa = (s,p=document)=>[...p.querySelectorAll(s)];
const esc = s => String(s??'').replace(/[&<>"']/g,m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m]));
const sameDay=(a,b)=>a.getFullYear()===b.getFullYear()&&a.getMonth()===b.getMonth()&&a.getDate()===b.getDate();
const toISO = d=>new Date(d.getFullYear(),d.getMonth(),d.getDate()).toISOString().slice(0,10);
const addDays=(d,n)=>{const x=new Date(d);x.setDate(x.getDate()+n);return x;};
const addMonths=(d,n)=>{const x=new Date(d);x.setMonth(x.getMonth()+n);return x;};
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
const timeToMin = t => { if(!t) return null; const m=/^(\d{1,2}):(\d{2})$/.exec(t.trim()); return m?+m[1]*60+ +m[2]:null; };

const H_START = 6, H_END = 20, HOUR_PX = 48, SLOT_MIN = 15;

let state = {
  view: 'home',
  currentDate: new Date(),
  tasks: JSON.parse(localStorage.getItem('tasks')||'[]'),
  events: JSON.parse(localStorage.getItem('events')||'[]'),
  settings: JSON.parse(localStorage.getItem('settings')||'{}')
};

function saveTasks(){ localStorage.setItem('tasks', JSON.stringify(state.tasks)); }
function saveEvents(){ localStorage.setItem('events', JSON.stringify(state.events)); }
function saveSettings(){ localStorage.setItem('settings', JSON.stringify(state.settings)); }

window.addEventListener('DOMContentLoaded', () => {
  wireStaticUI();
  applySettingsUI();
  initNav();
  initAddDialogs();
  initRescheduleDialog();
  renderAll();              // первый рендер
  centerTodayInStrip();     // центрируем текущую дату
  startNowTicker();         // позиция «сейчас» в событиях
});

/* ============== NAVIGATION (bottom bar & views) ============== */
function setView(view){
  state.view=view;
  // таббар
  qsa('.bottombar .navbtn').forEach(a=>a.classList.toggle('active', a.dataset.view===view));
  // секции
  const show = id => qs(id).style.display='block';
  const hide = id => qs(id).style.display='none';
  // главная — это всё, что внутри #app (блоки по умолчанию)
  // у нас отдельные контейнеры для Calendar/Stats/Settings
  if(view==='home'){
    qsa('#app > .section').forEach(s=>s.style.display='block');
    hide('#viewCalendar'); hide('#viewStats'); hide('#viewSettings');
  }else{
    qsa('#app > .section').forEach(s=>s.style.display='none');
    if(view==='calendar') { show('#viewCalendar'); renderCalendar(); }
    if(view==='stats')    { show('#viewStats');    renderStats(); }
    if(view==='settings') { show('#viewSettings'); bindSettingsControls(); }
  }
}
function initNav(){
  // нижняя панель
  qs('#tabHome').onclick     =()=> setView('home');
  qs('#tabCalendar').onclick =()=> setView('calendar');
  qs('#tabStats').onclick    =()=> setView('stats');
  qs('#tabSettings').onclick =()=> setView('settings');
  // FAB
  qs('#fab').onclick = ()=> openAddDialog();
  // заголовок месяца (на главной)
  qs('#btnPrevMonth')?.addEventListener('click',()=>{ state.currentDate=addMonths(state.currentDate,-1); renderAll(); });
  qs('#btnNextMonth')?.addEventListener('click',()=>{ state.currentDate=addMonths(state.currentDate, 1); renderAll(); });
}

/* =================== HOME RENDER =================== */
function renderAll(){
  renderMonthHeader();
  renderDateStrip();
  renderDayGrid();     // события
  renderTasksList();   // задачи
  renderCalendar();    // календарь может быть скрыт, но подготовим
  renderStats();       // обновим проценты
}

function renderMonthHeader(){
  const t = state.currentDate.toLocaleString('ru-RU',{month:'long', year:'numeric'});
  const el = qs('#monthTitle'); if(el) el.textContent = t.charAt(0).toUpperCase()+t.slice(1);
}

function renderDateStrip(){
  const strip = qs('#dateStrip'); if(!strip) return;
  strip.innerHTML='';
  const y=state.currentDate.getFullYear(), m=state.currentDate.getMonth();
  const days = new Date(y,m+1,0).getDate();
  const today = new Date();

  for(let i=1;i<=days;i++){
    const d=new Date(y,m,i);
    const pill=document.createElement('div');
    pill.className='date-pill'+(sameDay(d,state.currentDate)?' active':'');
    pill.innerHTML = `
      <div class="wk">${d.toLocaleDateString('ru-RU',{weekday:'short'})}</div>
      <div class="daynum">${i}</div>
      <div class="mon">${d.toLocaleDateString('ru-RU',{month:'short'})}</div>`;
    pill.onclick=()=>{ state.currentDate=d; renderAll(); centerActiveInStrip(); };
    strip.appendChild(pill);
  }
}
function centerTodayInStrip(){ centerActiveInStrip(true); }
function centerActiveInStrip(initialize=false){
  const strip=qs('#dateStrip'); if(!strip) return;
  const active=qs('.date-pill.active',strip);
  if(active){
    const offset = active.offsetLeft - (strip.clientWidth/2 - active.clientWidth/2);
    strip.scrollTo({left: Math.max(offset,0), behavior: initialize?'auto':'smooth'});
  }
}

/* =================== EVENTS TIMELINE (06–20) =================== */
function renderDayGrid(){
  // время-тики
  const ticks=qs('#timeTicks'); const col=qs('#eventsCol'); if(!ticks||!col) return;
  ticks.innerHTML='';
  for(let h=H_START; h<=H_END; h++){
    const tick=document.createElement('div');
    tick.className='tick';
    tick.textContent = `${String(h).padStart(2,'0')}:00`;
    ticks.appendChild(tick);
  }

  // «сейчас» линия
  const nowLine = qs('#nowLine');
  const now = new Date();
  if(sameDay(now, state.currentDate) && now.getHours()>=H_START && now.getHours()<=H_END){
    const mins = (now.getHours()-H_START)*60 + now.getMinutes();
    nowLine.style.display='block';
    nowLine.style.top = `${mins/60*HOUR_PX}px`;
  }else{
    nowLine.style.display='none';
  }

  // события этого дня
  col.innerHTML = nowLine.outerHTML; // вставим линию обратно первым ребёнком
  const iso = toISO(state.currentDate);
  const dayEvents = state.events
    .filter(e=>e.date===iso)
    .map(e=>({ ...e, s: timeToMin(e.start), eMin: timeToMin(e.end) }))
    .filter(e=> e.s!=null && e.eMin!=null && e.eMin>e.s)
    .sort((a,b)=> a.s-b.s);

  // позиционирование
  dayEvents.forEach(ev=>{
    const topPx = ((ev.s - H_START*60)/60)*HOUR_PX;
    const heightPx = Math.max((ev.eMin - ev.s)/60*HOUR_PX, HOUR_PX*(SLOT_MIN/60));
    const div=document.createElement('div');
    div.className='event';
    div.style.setProperty('--top', `${topPx}px`);
    div.style.setProperty('--h', `${heightPx}px`);
    div.innerHTML = `<div class="title">${esc(ev.title)}</div>
                     <div class="time">${ev.start} – ${ev.end}</div>`;
    // клик — перенести (пока без свайпа для событий)
    div.onclick=()=> openReschedule(ev.id, 'event');
    col.appendChild(div);
  });
}

/* =================== TASKS LIST (свайпы) =================== */
function renderTasksList(){
  const list = qs('#taskList'); if(!list) return;
  const iso = toISO(state.currentDate);
  const arr = state.tasks.filter(t=>t.date===iso).sort((a,b)=>{
    const am = timeToMin(a.time)??1441, bm = timeToMin(b.time)??1441;
    return am-bm;
  });

  qs('#todayCounter').textContent = `Задач: ${arr.length}`;

  if(arr.length===0){ list.innerHTML=''; return; }

  list.innerHTML = arr.map(t=>{
    const meta = [t.time||'—', `приоритет: ${t.priority||'средний'}`].join(' • ');
    return `<div class="t-item${t.done?' done':''}" data-id="${t.id}" style="touch-action: pan-y;">
      <div class="row1">
        <div class="t-title">${esc(t.title)}</div>
        <div class="task-ctl">
          <button class="icon-btn" data-act="done" data-id="${t.id}" title="Готово">✔</button>
          <button class="icon-btn" data-act="move" data-id="${t.id}" title="Перенести">↔</button>
          <button class="icon-btn" data-act="del"  data-id="${t.id}" title="Удалить">🗑</button>
        </div>
      </div>
      <div class="t-meta">${meta}</div>
    </div>`;
  }).join('');

  // кнопки
  qsa('.task-ctl .icon-btn', list).forEach(b=>{
    const id=b.dataset.id, act=b.dataset.act;
    if(act==='done') b.onclick=()=> toggleDoneTask(id);
    if(act==='del')  b.onclick=()=> deleteTask(id);
    if(act==='move') b.onclick=()=> openReschedule(id,'task');
  });

  // свайпы
  qsa('.t-item', list).forEach(attachSwipe);
}

function toggleDoneTask(id){
  const t=state.tasks.find(x=>x.id===id); if(!t) return;
  t.done=!t.done; saveTasks(); renderTasksList(); renderStats();
}
function deleteTask(id){
  state.tasks=state.tasks.filter(t=>t.id!==id); saveTasks(); renderTasksList(); renderStats();
}

/* ============== SWIPE (tasks) ============== */
function attachSwipe(el){
  let startX=0, curX=0, dragging=false, id=el.dataset.id;
  const THRESH=64;

  const onStart=x=>{ dragging=true; startX=x; el.style.transition='none'; };
  const onMove =x=>{
    if(!dragging) return;
    curX=x-startX;
    const dx=clamp(curX,-120,120);
    el.style.transform=`translateX(${dx}px)`; el.style.opacity=String(1-Math.min(Math.abs(dx)/220,.4));
  };
  const onEnd =()=>{
    if(!dragging) return;
    el.style.transition='transform .18s, opacity .18s';
    if(curX>THRESH){ el.style.transform='translateX(100%)'; el.style.opacity='0'; setTimeout(()=>toggleDoneTask(id),140); }
    else if(curX<-THRESH){ openReschedule(id,'task', /*fromSwipe*/true); }  // FIX: не скрываем
    else resetSwipeVisual(id);
    dragging=false; startX=curX=0;
  };

  el.addEventListener('mousedown',e=>onStart(e.clientX));
  window.addEventListener('mousemove',e=>onMove(e.clientX));
  window.addEventListener('mouseup', onEnd);
  el.addEventListener('touchstart',e=>onStart(e.touches[0].clientX),{passive:true});
  el.addEventListener('touchmove', e=>onMove(e.touches[0].clientX),{passive:true});
  el.addEventListener('touchend', onEnd);
}

function resetSwipeVisual(id){
  const el=document.querySelector(`.t-item[data-id="${CSS.escape(id)}"]`);
  if(el){ el.style.transition='transform .18s, opacity .18s'; el.style.transform='translateX(0)'; el.style.opacity='1'; }
}

/* =================== ADD DIALOGS =================== */
function wireStaticUI(){
  // топ-кнопки на карточке «Сегодня»
  qs('#btnAddTaskTop')?.addEventListener('click',()=> openAddDialog('task'));
  qs('#btnAddEventTop')?.addEventListener('click',()=> openAddDialog('event'));
}
function openAddDialog(tab='choice'){
  const dlg=qs('#dlgAdd'); if(!dlg) return;
  dlg.showModal();
  showAddTab(tab);
}
function showAddTab(tab){
  const fTask=qs('#formTask'), fEvent=qs('#formEvent');
  if(tab==='task'){ fTask.style.display='block'; fEvent.style.display='none'; }
  else if(tab==='event'){ fTask.style.display='none'; fEvent.style.display='block'; }
  else{ fTask.style.display='block'; fEvent.style.display='none'; }
}
function initAddDialogs(){
  const dlg=qs('#dlgAdd'); if(!dlg) return;
  // переключатели
  qs('#dlgAddClose').onclick = ()=> dlg.close();
  qs('#openAddTask').onclick = ()=> showAddTab('task');
  qs('#openAddEvent').onclick= ()=> showAddTab('event');
  qs('#cancelTask').onclick  = ()=> dlg.close();
  qs('#cancelEvent').onclick = ()=> dlg.close();
  // заполнение дат по умолчанию
  const todayISO = toISO(state.currentDate);
  qs('#taskDate').value = todayISO;
  qs('#eventDate').value = todayISO;

  // submit: task
  qs('#formTask').onsubmit = e=>{
    e.preventDefault();
    const title = qs('#taskTitle').value.trim();
    if(!title) return;
    const t = {
      id: cryptoRandom(),
      title,
      date: qs('#taskDate').value || todayISO,
      time: qs('#taskTime').value || '',
      priority: mapPriority(qs('#taskPriority').value),
      note: qs('#taskNote').value || '',
      done:false
    };
    state.tasks.push(t); saveTasks(); dlg.close(); renderTasksList(); renderStats();
  };
  // submit: event
  qs('#formEvent').onsubmit = e=>{
    e.preventDefault();
    const title = qs('#eventTitle').value.trim();
    if(!title) return;
    const start = qs('#eventStart').value;
    const end   = qs('#eventEnd').value;
    if(!start || !end) { alert('Укажи время начала и конца'); return; }
    if(timeToMin(end) <= timeToMin(start)){ alert('Время конца должно быть позже начала'); return; }
    const ev = {
      id: cryptoRandom(),
      title,
      date: qs('#eventDate').value || todayISO,
      start, end,
      priority: mapPriority(qs('#eventPriority').value),
      location: qs('#eventLocation').value || '',
      note: qs('#eventNote').value || ''
    };
    state.events.push(ev); saveEvents(); dlg.close(); renderDayGrid();
  };
}
function mapPriority(txt){
  const t=txt.toLowerCase();
  if(t.startsWith('низ')) return 'low';
  if(t.startsWith('выс')) return 'high';
  if(t.startsWith('крит')) return 'critical';
  return 'medium';
}
function cryptoRandom(){
  if(window.crypto?.getRandomValues){
    const arr=new Uint32Array(2); crypto.getRandomValues(arr);
    return (Date.now().toString(36)+arr[0].toString(36)+arr[1].toString(36)).slice(0,16);
  }
  return Date.now().toString(36)+Math.random().toString(36).slice(2,6);
}

/* =================== RESCHEDULE (task & event) =================== */
let resTarget = { id:null, kind:null }; // kind: 'task'|'event'
function initRescheduleDialog(){
  const dlg=qs('#dlgReschedule'); if(!dlg) return;
  qs('#dlgRescheduleClose').onclick = ()=> closeReschedule();
  qs('#moveCancel').onclick         = ()=> closeReschedule();
  qs('#moveApply').onclick          = applyReschedule;
}
function openReschedule(id, kind, fromSwipe=false){
  resTarget={id,kind};
  const dlg=qs('#dlgReschedule'); if(!dlg) return;
  // заполним текущие
  if(kind==='task'){
    const t=state.tasks.find(x=>x.id===id); if(!t) return;
    qs('#moveDate').value = t.date || toISO(state.currentDate);
    qs('#moveTime').value = t.time || '';
    if(fromSwipe) resetSwipeVisual(id);
  }else{
    const e=state.events.find(x=>x.id===id); if(!e) return;
    qs('#moveDate').value = e.date || toISO(state.currentDate);
    qs('#moveTime').value = e.start || '';
  }
  dlg.showModal();
}
function closeReschedule(){
  const dlg=qs('#dlgReschedule'); dlg?.close();
  // визуально обязательно вернуть карточку задачи на место (фикс бага)
  if(resTarget.kind==='task') resetSwipeVisual(resTarget.id);
  resTarget={id:null,kind:null};
}
function applyReschedule(){
  const date=qs('#moveDate').value, time=qs('#moveTime').value;
  if(resTarget.kind==='task'){
    const t=state.tasks.find(x=>x.id===resTarget.id); if(!t) return;
    if(date) t.date=date;
    if(time) t.time=time;
    saveTasks(); renderTasksList();
  }else if(resTarget.kind==='event'){
    const e=state.events.find(x=>x.id===resTarget.id); if(!e) return;
    if(date) e.date=date;
    if(time){ // сдвигаем интервал, сохраняя длительность
      const dur = timeToMin(e.end) - timeToMin(e.start);
      e.start=time;
      const endMin = timeToMin(time)+dur;
      const hh=String(Math.floor(endMin/60)).padStart(2,'0');
      const mm=String(endMin%60).padStart(2,'0');
      e.end = `${hh}:${mm}`;
    }
    saveEvents(); renderDayGrid();
  }
  closeReschedule();
}

/* =================== CALENDAR =================== */
function renderCalendar(){
  const grid=qs('#calendarGrid'); const title=qs('#calTitle'); if(!grid||!title) return;
  grid.innerHTML='';
  const d=state.currentDate, y=d.getFullYear(), m=d.getMonth();
  title.textContent = d.toLocaleString('ru-RU',{month:'long',year:'numeric'});

  // заголовок дней недели уже в разметке
  const first=new Date(y,m,1);
  const offset=(first.getDay()+6)%7; // Пн=0
  for(let i=0;i<offset;i++){ const e=document.createElement('div'); e.className='cell'; grid.appendChild(e); }

  const days=new Date(y,m+1,0).getDate();
  for(let i=1;i<=days;i++){
    const date=new Date(y,m,i), iso=toISO(date);
    const dayTasks=state.tasks.filter(t=>t.date===iso);
    const c=document.createElement('div'); c.className='cell';
    c.innerHTML=`<div class="dhead">${i}</div>
                 <div class="dots">${dayTasks.map(t=>`<span class="dot" style="background:${priorityDot(t.priority)}"></span>`).join('')}</div>`;
    if(sameDay(date,new Date())) c.classList.add('today');
    c.onclick=()=>{ state.currentDate=date; setView('home'); renderAll(); centerActiveInStrip(); };
    grid.appendChild(c);
  }

  // навигация календаря
  qs('#calPrev')?.addEventListener('click',()=>{ state.currentDate=addMonths(state.currentDate,-1); renderCalendar(); });
  qs('#calNext')?.addEventListener('click',()=>{ state.currentDate=addMonths(state.currentDate, 1); renderCalendar(); });
}
function priorityDot(p){
  if(p==='low') return '#bfbfbf';
  if(p==='high') return '#ff4fa3';
  if(p==='critical') return '#8a2be2';
  return 'var(--accent)';
}

/* =================== STATS =================== */
function renderStats(){
  // неделя: все задачи последней недели
  const now=new Date(), weekAgo=addDays(now,-7), monthAgo=addMonths(now,-1);
  const week = state.tasks.filter(t=> new Date(t.date) >= new Date(weekAgo.toDateString()));
  const weekDone= week.filter(t=>t.done);
  const pct = week.length ? Math.round(weekDone.length/week.length*100) : 0;

  const ring = qs('#ringFg'); const val=qs('#ringVal');
  if(ring){ ring.style.strokeDashoffset = (326 - 326*pct/100); }
  if(val){ animateNumber(val, pct, v=> val.textContent = `${v}%`); }

  const weekAll=week.length, monAll=state.tasks.filter(t=> new Date(t.date)>=monthAgo).length;
  const weekDoneN=weekDone.length, monDoneN=state.tasks.filter(t=> new Date(t.date)>=monthAgo && t.done).length;
  const streak = calcStreak();

  if(qs('#kpi7'))   qs('#kpi7').textContent   = `${weekDoneN}/${weekAll}`;
  if(qs('#kpiMon')) qs('#kpiMon').textContent = `${monDoneN}/${monAll}`;
  if(qs('#streak')) qs('#streak').textContent = String(streak);
}
function calcStreak(){
  const days=[...new Set(state.tasks.filter(t=>t.done).map(t=>t.date))].sort();
  let max=0,cur=0,last=null;
  for(const iso of days){
    const d=new Date(iso);
    if(last && (d-last)/86400000===1) cur++; else cur=1;
    if(cur>max) max=cur; last=d;
  }
  return max;
}
function animateNumber(el, target, draw){
  const start = Number((el.textContent||'0').replace('%',''))||0;
  const t0=performance.now(), dur=500;
  function step(t){
    const k=clamp((t-t0)/dur,0,1);
    const v=Math.round(start + (target-start)*k);
    draw(v);
    if(k<1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

/* =================== SETTINGS (theme/accent) =================== */
function applySettingsUI(){
  const s=state.settings||{};
  document.documentElement.dataset.theme  = s.theme || 'light';
  document.documentElement.dataset.accent = (s.accent==='custom'?'custom':(s.accent||'violet'));
  document.documentElement.dataset.accentstyle = s.accentStyle || 'solid';
  document.documentElement.style.setProperty('--scale', String(s.scale||1));
  if(s.accent==='custom' && s.accentCustom){
    document.documentElement.style.setProperty('--accent', s.accentCustom);
  }
  // заполнить контролы (если уже отрисованы)
  const dark = qs('#toggleDark'); if(dark) dark.checked = (s.theme==='dark');
  const ap = qs('#accentPreset'); if(ap) ap.value = s.accent || 'violet';
  const ac = qs('#accentCustom'); if(ac) ac.value = s.accentCustom || '#7b61ff';
  const as = qs('#accentStyle');  if(as) as.value = s.accentStyle || 'solid';
  const fs = qs('#fontScale');    if(fs) fs.value = s.fontScale || '1';
}
function bindSettingsControls(){
  // вешаем только один раз (идемпотентно)
  const dark = qs('#toggleDark'); if(dark && !dark._bound){
    dark._bound=true;
    dark.onchange = ()=>{ state.settings.theme= dark.checked?'dark':'light'; applySettingsUI(); saveSettings(); };
  }
  const ap = qs('#accentPreset'); if(ap && !ap._bound){
    ap._bound=true;
    ap.onchange = ()=>{
      state.settings.accent = ap.value;
      if(ap.value!=='custom') delete state.settings.accentCustom;
      applySettingsUI(); saveSettings();
    };
  }
  const ac = qs('#accentCustom'); if(ac && !ac._bound){
    ac._bound=true;
    ac.oninput = ()=>{
      state.settings.accent='custom';
      state.settings.accentCustom = ac.value;
      applySettingsUI(); saveSettings();
    };
  }
  const as = qs('#accentStyle'); if(as && !as._bound){
    as._bound=true;
    as.onchange = ()=>{ state.settings.accentStyle=as.value; applySettingsUI(); saveSettings(); };
  }
  const fs = qs('#fontScale'); if(fs && !fs._bound){
    fs._bound=true;
    fs.onchange = ()=>{
      const v=fs.value; // '1'|'2'|'3'
      state.settings.fontScale=v;
      state.settings.scale = (v==='1'?1 : v==='2'?1.10 : 1.20);
      applySettingsUI(); saveSettings();
    };
  }
}

/* =================== HELPERS =================== */
function startNowTicker(){
  // Каждую минуту обновляем позицию «сейчас»
  setInterval(()=>{ if(state.view==='home') renderDayGrid(); }, 60*1000);
}
