ф/* =========================================================
   PlanFlow — app.js (full)
   ========================================================= */

const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));

/* ---------- DOM refs ---------- */
const app           = $('#app');
const dateStrip     = $('#dateStrip');
const monthLabel    = $('#monthLabel');
const yearLabel     = $('#yearLabel');
const todayTitle    = $('#todayTitle');

const timelineView  = $('#timelineView');
const cardsView     = $('#cardsView');

const btnPrev       = $('#btnPrev');
const btnNext       = $('#btnNext');
const addBtn        = $('#addBtn');

const settingsModal = $('#settingsModal');
const openSettings  = $('#openSettings');
const saveSettings  = $('#saveSettings');

const taskModal     = $('#taskModal');
const taskForm      = $('#taskForm');
const taskFormTitle = $('#taskFormTitle');

const inputTitle = $('#taskTitle');
const inputDesc  = $('#taskDesc');
const inputStart = $('#taskStart');
const inputEnd   = $('#taskEnd');
const inputTag   = $('#taskTag');

/* ---------- State ---------- */
let currentDate  = new Date();           // месяц, в котором смотрим ленту
let selectedDate = new Date(currentDate);
let editingId    = null;                  // если редактируем задачу

const LS_TASKS    = 'pf_tasks_v1';
const LS_SETTINGS = 'pf_settings_v1';

let tasks    = readLS(LS_TASKS, []);
let settings = readLS(LS_SETTINGS, { layout: 'timeline' });

/* ---------- Utils ---------- */
function readLS(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch { return fallback; }
}
function writeLS(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}
function isSameDate(a, b) {
  return a.getFullYear() === b.getFullYear()
      && a.getMonth() === b.getMonth()
      && a.getDate() === b.getDate();
}
function fmtDateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function parseTimeToMin(t) { const [h,m] = t.split(':').map(Number); return h*60+m; }
function minToTime(min) {
  const h = Math.floor(min/60), m = min%60;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
}
function clamp(v, a, b){ return Math.max(a, Math.min(b, v)); }

/* ---------- Demo seed on first run ---------- */
if (!tasks || tasks.length === 0) {
  const dk = fmtDateKey(selectedDate);
  tasks = [
    { id: uid(), date: dk, title:'Утренняя тренировка', desc:'легкий бег + растяжка', start:'07:45', end:'08:15', tag:'Здоровье', done:false },
    { id: uid(), date: dk, title:'Душ',                 desc:'быстро и бодро',         start:'08:15', end:'08:30', tag:'Дом',      done:false },
    { id: uid(), date: dk, title:'Завтрак',             desc:'овсянка + кофе',         start:'08:30', end:'09:00', tag:'Дом',      done:false },
    { id: uid(), date: dk, title:'Почта',               desc:'разбор входящих',        start:'09:00', end:'09:15', tag:'Работа',   done:false },
  ];
  writeLS(LS_TASKS, tasks);
}
function uid(){ return Date.now().toString(36)+Math.random().toString(36).slice(2,8); }

/* =========================================================
   Calendar strip
   ========================================================= */
function renderCalendar(focusDate) {
  dateStrip.innerHTML = '';

  const monthStart = new Date(focusDate.getFullYear(), focusDate.getMonth(), 1);
  const monthEnd   = new Date(focusDate.getFullYear(), focusDate.getMonth()+1, 0);

  monthLabel.textContent = monthStart.toLocaleString('ru-RU', { month: 'long' }).replace(/^./, c => c.toUpperCase());
  yearLabel.textContent  = monthStart.getFullYear();

  for (let d = 1; d <= monthEnd.getDate(); d++){
    const cur = new Date(focusDate.getFullYear(), focusDate.getMonth(), d);
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'date';
    if (isSameDate(cur, new Date()))     el.classList.add('is-today');
    if (isSameDate(cur, selectedDate))   el.classList.add('is-selected');

    el.innerHTML = `
      <div class="dow">${cur.toLocaleDateString('ru-RU', { weekday:'short' })}</div>
      <div class="day">${d}</div>
      <div class="mon">${cur.toLocaleDateString('ru-RU', { month:'short' })}</div>
    `;
    el.addEventListener('click', () => {
      selectedDate = cur;
      // мягкое выравнивание прокрутки к выбранной
      el.scrollIntoView({ inline:'center', behavior:'smooth', block:'nearest' });
      renderCalendar(cur);
      renderAll();
    });
    dateStrip.appendChild(el);
  }
}

/* =========================================================
   Tasks renderers
   ========================================================= */
function renderAll(){
  renderHeaderTitle();
  renderTimeline();
  renderCards();
  applyLayout();
}
function renderHeaderTitle(){
  todayTitle.textContent = isSameDate(selectedDate, new Date())
    ? 'Сегодня'
    : selectedDate.toLocaleDateString('ru-RU', { day:'numeric', month:'long' });
}

function tasksOfSelected(){
  const key = fmtDateKey(selectedDate);
  return tasks.filter(t => t.date === key).sort((a,b)=> a.start.localeCompare(b.start));
}

/* ---------- Timeline with hour axis & now-line ---------- */
function renderTimeline(){
  const items = tasksOfSelected();
  timelineView.innerHTML = '';

  // Build hour axis from 05:00..24:00 (adaptive if tasks outside)
  const minStart = Math.min(5*60, ...items.map(t=>parseTimeToMin(t.start)));
  const maxEnd   = Math.max(22*60, ...items.map(t=>parseTimeToMin(t.end)));
  const startMin = Math.floor(minStart/60)*60;
  const endMin   = Math.ceil(maxEnd/60)*60;

  // Hour labels
  for (let m = startMin; m <= endMin; m += 60){
    const lbl = document.createElement('div');
    lbl.className = 'time-label';
    lbl.style.marginTop = m === startMin ? '0' : '38px';
    lbl.textContent = String(Math.floor(m/60)).padStart(2,'0');
    timelineView.appendChild(lbl);
  }

  // Now-line (only if selected = today)
  if (isSameDate(selectedDate, new Date())){
    const now = new Date();
    const nowMin = now.getHours()*60 + now.getMinutes();
    const pos = ((clamp(nowMin, startMin, endMin) - startMin) / (endMin - startMin)) * 100;

    const nowLine = document.createElement('div');
    nowLine.className = 'now-line';
    nowLine.style.marginTop = `${((endMin-startMin)*pos/100)/60*38}px`; // 38px ≈ 1 час шаг
    nowLine.innerHTML = `<span class="dot"></span><div class="rule"></div>`;
    timelineView.appendChild(nowLine);

    // Auto-scroll near now
    setTimeout(()=> {
      nowLine.scrollIntoView({ block:'center', behavior:'smooth' });
    }, 10);
  }

  // Events
  for (const t of items){
    const ev = document.createElement('div');
    ev.className = 'event' + (t.done ? ' is-done' : '');
    ev.innerHTML = `
      <div class="pin" title="${t.tag||''}"></div>
      <div class="card" role="button">
        <div class="title">${escapeHTML(t.title)}</div>
        <div class="meta">${t.start}–${t.end} (${durationMin(t.start,t.end)} мин)</div>
      </div>
      <button class="check" aria-label="Готово">${t.done?'✓':''}</button>
    `;
    ev.querySelector('.check').addEventListener('click', () => toggleDone(t.id));
    ev.querySelector('.card').addEventListener('click', () => openEdit(t.id));
    ev.addEventListener('contextmenu', (e)=>{ e.preventDefault(); confirmDelete(t.id); });
    timelineView.appendChild(ev);
  }

  if (items.length === 0){
    timelineView.innerHTML = `<div class="empty">Нет задач на эту дату.</div>`;
  }
}

/* ---------- Cards list ---------- */
function renderCards(){
  const items = tasksOfSelected();
  cardsView.innerHTML = '';

  for (const t of items){
    const card = document.createElement('div');
    card.className = 'task';
    card.innerHTML = `
      <div class="bullet" title="${t.tag||''}"></div>
      <div class="info">
        <div class="name">${escapeHTML(t.title)}</div>
        <div class="sub">${t.start}–${t.end}${t.desc?` • ${escapeHTML(t.desc)}`:''}</div>
      </div>
      <button class="check">${t.done?'✓':''}</button>
    `;
    card.querySelector('.check').addEventListener('click', () => toggleDone(t.id));
    card.addEventListener('click', () => openEdit(t.id));
    card.addEventListener('contextmenu', (e)=>{ e.preventDefault(); confirmDelete(t.id); });
    cardsView.appendChild(card);
  }
  if (items.length === 0){
    cardsView.innerHTML = `<div class="empty">Нет задач на эту дату.</div>`;
  }
}

/* ---------- Layout apply ---------- */
function applyLayout(){
  timelineView.hidden = settings.layout !== 'timeline';
  cardsView.hidden    = settings.layout !== 'cards';

  // визуальное состояние кнопок нижнего бара
  $$('.bottombar .nav-btn').forEach(b=>b.classList.remove('is-active'));
  $(`.bottombar .nav-btn[data-route="today"]`).classList.add('is-active');
}

/* =========================================================
   CRUD
   ========================================================= */
function addTask(data){
  const item = {
    id: uid(),
    date: fmtDateKey(selectedDate),
    title: data.title.trim(),
    desc: data.desc.trim(),
    start: data.start,
    end: data.end,
    tag: data.tag.trim(),
    done: false
  };
  tasks.push(item);
  writeLS(LS_TASKS, tasks);
  renderAll();
}
function updateTask(id, data){
  const t = tasks.find(x=>x.id===id);
  if (!t) return;
  t.title = data.title.trim();
  t.desc  = data.desc.trim();
  t.start = data.start;
  t.end   = data.end;
  t.tag   = data.tag.trim();
  writeLS(LS_TASKS, tasks);
  renderAll();
}
function toggleDone(id){
  const t = tasks.find(x=>x.id===id);
  if (!t) return;
  t.done = !t.done;
  writeLS(LS_TASKS, tasks);
  renderAll();
}
function confirmDelete(id){
  if (confirm('Удалить задачу?')){
    tasks = tasks.filter(x=>x.id!==id);
    writeLS(LS_TASKS, tasks);
    renderAll();
  }
}

/* =========================================================
   Modals
   ========================================================= */
function openCreate(){
  editingId = null;
  taskForm.reset();
  taskFormTitle.textContent = 'Новая задача';
  // авто-заполнение ближайшего окна
  const now = new Date();
  const base = isSameDate(selectedDate, new Date()) ? now : new Date(selectedDate);
  const s = `${String(base.getHours()).padStart(2,'0')}:${String(base.getMinutes()).padStart(2,'0')}`;
  const eMin = clamp(parseTimeToMin(s)+30, 0, 24*60);
  inputStart.value = s;
  inputEnd.value   = minToTime(eMin);
  taskModal.showModal();
}
function openEdit(id){
  const t = tasks.find(x=>x.id===id);
  if (!t) return;
  editingId = id;
  taskFormTitle.textContent = 'Редактировать задачу';
  inputTitle.value = t.title;
  inputDesc.value  = t.desc;
  inputStart.value = t.start;
  inputEnd.value   = t.end;
  inputTag.value   = t.tag;
  taskModal.showModal();
}

/* Close on ESC for both dialogs (native dialog handles it, but keep focus mgmt) */
document.addEventListener('keydown', e=>{
  if (e.key === 'Escape'){
    if (taskModal.open) taskModal.close();
    if (settingsModal.open) settingsModal.close();
  }
});

/* =========================================================
   Events & router
   ========================================================= */
btnPrev.addEventListener('click', ()=>{
  currentDate.setMonth(currentDate.getMonth()-1);
  // удерживаем выбранное число в пределах месяца
  selectedDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), clamp(selectedDate.getDate(),1,28));
  renderCalendar(currentDate);
  renderAll();
});
btnNext.addEventListener('click', ()=>{
  currentDate.setMonth(currentDate.getMonth()+1);
  selectedDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), clamp(selectedDate.getDate(),1,28));
  renderCalendar(currentDate);
  renderAll();
});

addBtn.addEventListener('click', openCreate);

openSettings.addEventListener('click', ()=> settingsModal.showModal());
saveSettings.addEventListener('click', e=>{
  e.preventDefault();
  const layout = settingsModal.querySelector('input[name="layout"]:checked')?.value || 'timeline';
  settings.layout = layout;
  writeLS(LS_SETTINGS, settings);
  settingsModal.close();
  applyLayout();
});

/* Form submit */
taskForm.addEventListener('submit', e=>{
  e.preventDefault();
  const payload = {
    title: inputTitle.value,
    desc:  inputDesc.value,
    start: inputStart.value,
    end:   inputEnd.value,
    tag:   inputTag.value
  };
  if (!payload.title || !payload.start || !payload.end) return;
  if (parseTimeToMin(payload.end) <= parseTimeToMin(payload.start)){
    alert('Время окончания должно быть позже начала.');
    return;
  }
  if (editingId) updateTask(editingId, payload);
  else addTask(payload);
  taskModal.close();
});

/* Bottom bar routing (простые заглушки) */
$$('.bottombar .nav-btn').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    const route = btn.getAttribute('data-route');
    $$('.bottombar .nav-btn').forEach(b=>b.classList.remove('is-active'));
    btn.classList.add('is-active');

    if (route === 'today'){
      applyLayout();
    } else if (route === 'projects'){
      infoToast('Раздел «Проекты» на подходе. Сейчас фокус на дне.');
    } else if (route === 'stats'){
      const done = tasks.filter(t=>t.done).length;
      infoToast(`Выполнено: ${done} / ${tasks.length}`);
    } else if (route === 'settings'){
      settingsModal.showModal();
    }
  });
});

/* =========================================================
   Helpers (UI)
   ========================================================= */
function infoToast(text){
  let el = document.getElementById('pf_toast');
  if (!el){
    el = document.createElement('div');
    el.id = 'pf_toast';
    Object.assign(el.style, {
      position:'fixed', left:'50%', transform:'translateX(-50%)',
      bottom:'calc(100px + env(safe-area-inset-bottom, 0px))',
      background:'#111', color:'#fff', padding:'10px 14px', borderRadius:'12px',
      fontSize:'13px', boxShadow:'0 8px 24px rgba(0,0,0,.25)', zIndex:'1000',
      opacity:'0', transition:'opacity .2s ease'
    });
    document.body.appendChild(el);
  }
  el.textContent = text;
  el.style.opacity = '1';
  setTimeout(()=> el.style.opacity = '0', 1400);
}

function escapeHTML(s){
  return s.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}
function durationMin(a,b){ return parseTimeToMin(b) - parseTimeToMin(a); }

/* =========================================================
   Boot
   ========================================================= */
renderCalendar(currentDate);
renderAll();
