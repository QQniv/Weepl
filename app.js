/* Planner • Future Flow — app.js (V1)
   - Hash-роутинг: #/, #/calendar, #/settings
   - localStorage store
   - Темы: light/dark, 10 акцентов
   - Задачи: title, date, time, priority, smart, note, tags (из модалки)
   - Свайп: вправо — done; влево — сдвиг дедлайна +1 день (меню позже)
   - Drag&Drop: перенос задачи на другой день из календаря
*/
'use strict';

/* ============ Store ============ */
const STORE_KEY = 'planner.futureflow.v1';
const DEFAULTS = {
  settings: { theme: 'light', accent: 'blue', weekStart: 1 },
  tasks: [] // {id,title,date,time,priority,smart,note,tags:[],done,createdAt}
};

const Store = {
  _data: null,
  load() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY)) || structuredClone(DEFAULTS); }
    catch { return structuredClone(DEFAULTS); }
  },
  save(d){ localStorage.setItem(STORE_KEY, JSON.stringify(d)); },
  get(){ return this._data || (this._data = this.load()); },
  set(next){ this._data = next; this.save(next); document.dispatchEvent(new CustomEvent('store:change')); }
};

/* ============ Utils ============ */
const $ = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));
const uid = () => Math.random().toString(36).slice(2,9);
const dtKey = d => new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString().slice(0,10);
const addDays = (iso, n) => {
  if(!iso) return '';
  const d = new Date(iso+'T00:00:00'); d.setDate(d.getDate()+n);
  return dtKey(d);
};
const escapeHTML = s => String(s).replace(/[&<>"']/g, m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m]));

/* ============ Theme/Accent ============ */
function applyTheme(theme){ document.documentElement.dataset.theme = theme; }
function applyAccent(name){ document.documentElement.dataset.accent = name; }

/* ============ Router ============ */
const routes = {
  '#/': renderHome,
  '#/calendar': renderCalendar,
  '#/settings': renderSettings,
};
function setActiveTab(){
  const h = location.hash || '#/';
  $$('.tab').forEach(a => a.classList.toggle('active', a.getAttribute('data-route')===h));
}
function router(){
  const h = location.hash || '#/';
  const view = $('#view'); view.innerHTML = '';
  (routes[h] || renderHome)(view);
  setActiveTab();
  view.focus({preventScroll:true});
}

/* ============ Boot ============ */
(function init(){
  // mount layout
  const app = $('#app');
  const layout = document.importNode($('#layout').content, true);
  app.append(layout);

  // defaults
  const st = Store.get().settings;
  applyTheme(st.theme || 'light');
  applyAccent(st.accent || 'blue');

  // FAB + modal
  const modal = $('#taskModal');
  const form  = $('#taskForm');
  $('#fabAdd').addEventListener('click', ()=> openTaskModal());
  $$('[data-close]').forEach(b => b.addEventListener('click', ()=> modal.close()));
  modal.addEventListener('cancel', e => { e.preventDefault(); modal.close(); });
  form.addEventListener('submit', onSubmitTask);

  // keyboard
  document.addEventListener('keydown', e=>{
    if(e.key.toLowerCase()==='n' && !modal.open) openTaskModal();
    if(e.key==='Escape' && modal.open) modal.close();
  });

  // react to store changes (на главном экране)
  document.addEventListener('store:change', ()=>{
    if ((location.hash||'#/') === '#/') renderHome($('#view'));
    if ((location.hash||'#/') === '#/calendar') renderCalendar($('#view'));
  });

  // route
  addEventListener('hashchange', router);
  if(!location.hash) location.hash = '#/';
  router();
})();

/* ============ Views ============ */
function renderHome(root){
  const t = document.importNode($('#home-view').content, true);
  root.replaceChildren(t);
  const list = $('#taskList');
  const {tasks} = Store.get();
  if(!tasks.length){
    list.innerHTML = `<p class="muted">Пусто. Жми <kbd>N</kbd> или плюс, чтобы добавить первую задачу.</p>`;
    return;
  }
  // group by date (сортировка по дате/времени)
  const groups = tasks.slice().sort(sortByWhen).reduce((acc,x)=>{
    const key = x.date || 'Без даты'; (acc[key] ||= []).push(x); return acc;
  },{});
  list.innerHTML = Object.entries(groups).map(([key,items])=>{
    const header = key==='Без даты' ? 'Без даты' : humanDate(key);
    const rows = items.map(taskRow).join('');
    return `<div class="day"><div class="day-head h-impact" style="font-size:20px;margin-bottom:6px">${header}</div>${rows}</div>`;
  }).join('');

  // bind actions + swipe
  $$('.task').forEach(card=>{
    card.querySelector('[data-toggle]').addEventListener('click', ()=> toggleDone(card.dataset.id));
    card.querySelector('[data-edit]').addEventListener('click', ()=> startEdit(card.dataset.id));
    card.querySelector('[data-del]').addEventListener('click', ()=> delTask(card.dataset.id));
    bindSwipe(card);
  });
}

function renderCalendar(root){
  const t = document.importNode($('#calendar-view').content, true);
  root.replaceChildren(t);
  Calendar.paint(Calendar.state.current || new Date());
  $('[data-cal="prev"]').onclick = ()=> Calendar.move(-1);
  $('[data-cal="next"]').onclick = ()=> Calendar.move(1);
}

function renderSettings(root){
  const t = document.importNode($('#settings-view').content, true);
  root.replaceChildren(t);
  const s = Store.get().settings;
  $('#setTheme').value = s.theme;
  $('#setAccent').value = s.accent;

  $('#setTheme').onchange = e => { s.theme = e.target.value; applyTheme(s.theme); Store.set(Store.get()); };
  $('#setAccent').onchange = e => { s.accent = e.target.value; applyAccent(s.accent); Store.set(Store.get()); };

  $('#btnExport').onclick = exportJSON;
  $('#fileImport').onchange = importJSON;
}

/* ============ Tasks CRUD ============ */
function onSubmitTask(e){
  e.preventDefault();
  const data = new FormData(e.target);
  const id = $('#fId')?.value || '';
  const task = {
    id: id || uid(),
    title: String(data.get('title')||'').trim(),
    date: data.get('date') || '',
    time: data.get('time') || '',
    priority: data.get('priority') || 'medium',
    smart: data.get('smart') || 'T',
    note: String(data.get('note')||'').trim(),
    tags: [], // зарезервировано (чипы добавим во v1.1)
    done: false,
    createdAt: Date.now()
  };
  if(!task.title){ return; }

  const s = Store.get();
  const idx = s.tasks.findIndex(t=>t.id===task.id);
  if(idx>-1) s.tasks[idx] = {...s.tasks[idx], ...task};
  else s.tasks.push(task);
  Store.set(s);

  $('#taskModal').close();
  e.target.reset();
}
function toggleDone(id){
  const s = Store.get(); const t = s.tasks.find(x=>x.id===id); if(!t) return;
  t.done = !t.done; Store.set(s);
}
function delTask(id){
  const s = Store.get(); s.tasks = s.tasks.filter(x=>x.id!==id); Store.set(s);
}
function startEdit(id){
  const t = Store.get().tasks.find(x=>x.id===id); if(!t) return;
  openTaskModal(t);
}
function taskRow(t){
  const time = t.time ? `<span class="time">${t.time}</span>` : `<span class="time muted">—</span>`;
  const prClass = ({low:'prio-low',medium:'prio-medium',high:'prio-high',critical:'prio-critical'})[t.priority||'medium'];
  return `<article class="task ${t.done?'is-done':''} ${prClass}" data-id="${t.id}" draggable="true">
    <button class="chk" data-toggle aria-label="Готово"></button>
    <div class="task-main">
      <div class="row-1">
        <h3 class="title">${escapeHTML(t.title)}</h3>
        ${time}
      </div>
      ${t.note ? `<div class="muted" style="font-size:13px;margin-top:4px">${escapeHTML(t.note)}</div>`:''}
    </div>
    <div class="task-ctl">
      <button class="icon-btn" data-edit title="Редактировать">✎</button>
      <button class="icon-btn" data-del title="Удалить">🗑</button>
    </div>
  </article>`;
}
function sortByWhen(a,b){
  const ka = (a.date||'9999-12-31') + ' ' + (a.time||'23:59');
  const kb = (b.date||'9999-12-31') + ' ' + (b.time||'23:59');
  return ka.localeCompare(kb);
}
function openTaskModal(prefill){
  $('#modalTitle').textContent = prefill? 'Редактировать' : 'Новая задача';
  // ensure hidden id field exists
  if(!$('#fId')){ const hid = document.createElement('input'); hid.type='hidden'; hid.id='fId'; hid.name='id'; $('#taskForm').append(hid); }
  $('#fId').value      = prefill?.id || '';
  $('#fTitle').value   = prefill?.title || '';
  $('#fDate').value    = prefill?.date || '';
  $('#fTime').value    = prefill?.time || '';
  $('#fPriority').value= prefill?.priority || 'medium';
  $('#fSmart').value   = prefill?.smart || 'T';
  $('#fNote').value    = prefill?.note || '';
  $('#taskModal').showModal();
  $('#fTitle').focus();
}

/* ============ Swipe (touch) ============ */
function bindSwipe(card){
  let x0=0, y0=0, dx=0, active=false;
  card.addEventListener('touchstart', e=>{
    const t = e.touches[0]; x0=t.clientX; y0=t.clientY; active=true; dx=0;
  }, {passive:true});
  card.addEventListener('touchmove', e=>{
    if(!active) return;
    const t = e.touches[0];
    dx = t.clientX - x0;
    if(Math.abs(dx) > 6 && Math.abs(t.clientY - y0) < 30){
      card.style.transform = `translateX(${dx}px)`;
      card.dataset.swipe = dx>0 ? 'right' : 'left';
    }
  }, {passive:true});
  card.addEventListener('touchend', ()=>{
    if(!active) return;
    active=false;
    const id = card.dataset.id;
    if(dx > 80){ toggleDone(id); }
    else if(dx < -80){
      // перенос на +1 день
      const s = Store.get(); const t = s.tasks.find(x=>x.id===id);
      if(t && t.date) { t.date = addDays(t.date, 1); Store.set(s); }
    }
    card.style.transform = ''; delete card.dataset.swipe;
  });
}

/* ============ Calendar ============ */
const Calendar = {
  state: { current: new Date(), selected: dtKey(new Date()) },
  move(step){
    const d = this.state.current;
    this.state.current = new Date(d.getFullYear(), d.getMonth()+step, 1);
    this.paint(this.state.current);
  },
  paint(now){
    const grid = $('#calendarGrid');
    const title = $('#calTitle');
    const list = $('#calendarTasks');
    const weekStart = Number(Store.get().settings.weekStart||1); // 1=Mon
    const first = new Date(now.getFullYear(), now.getMonth(), 1);
    const startIdx = (first.getDay() - weekStart + 7) % 7;
    const daysInMonth = new Date(now.getFullYear(), now.getMonth()+1, 0).getDate();

    title.textContent = `${now.toLocaleString('ru-RU',{month:'long'})} ${now.getFullYear()}`;
    grid.innerHTML = '';

    // headers
    const names = weekStart ? ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'] : ['Вс','Пн','Вт','Ср','Чт','Пт','Сб'];
    names.forEach(n => grid.insertAdjacentHTML('beforeend', `<div class="cell head">${n}</div>`));

    // blanks
    for(let i=0;i<startIdx;i++) grid.insertAdjacentHTML('beforeend', `<div class="cell"></div>`);

    const tasks = Store.get().tasks;
    for(let d=1; d<=daysInMonth; d++){
      const date = new Date(now.getFullYear(), now.getMonth(), d);
      const key = dtKey(date);
      const dayTasks = tasks.filter(t=>t.date===key);
      const dots = dayTasks.slice(0, 8).map(t=>{
        const color = prioColor(t.priority);
        return `<span class="dot" style="background:${color}; box-shadow:0 0 10px ${color}33"></span>`;
      }).join('');
      grid.insertAdjacentHTML('beforeend', `
        <div class="cell daycell" data-date="${key}">
          <div class="dhead">${d}</div>
          <div class="dots">${dots}</div>
        </div>
      `);
    }

    // click select + open add
    $$('.daycell').forEach(c=>{
      c.addEventListener('click', (e)=>{
        // если держим Alt — сразу модалка добавления с датой
        if(e.altKey){ openTaskModal({date: c.dataset.date}); return; }
        Calendar.state.selected = c.dataset.date;
        renderCalendarTasks(list, c.dataset.date);
      });
      // drop target for drag&drop
      c.addEventListener('dragover', ev=> ev.preventDefault());
      c.addEventListener('drop', ev=>{
        ev.preventDefault();
        const id = ev.dataTransfer.getData('text/id');
        if(!id) return;
        const s = Store.get(); const t = s.tasks.find(x=>x.id===id);
        if(!t) return;
        t.date = c.dataset.date;
        Store.set(s);
        renderCalendarTasks(list, c.dataset.date);
      });
    });

    // initial selection
    renderCalendarTasks(list, Calendar.state.selected || dtKey(new Date()));

    // make tasks draggable
    list.addEventListener('dragstart', ev=>{
      const art = ev.target.closest('.task');
      if(!art) return;
      ev.dataTransfer.setData('text/id', art.dataset.id);
      ev.dataTransfer.effectAllowed = 'move';
    });
  }
};

function prioColor(p){
  switch(p){
    case 'low': return 'var(--border)';
    case 'high': return '#FF4FA3';
    case 'critical': return '#8A2BE2';
    default: return 'var(--accent)';
  }
}

function renderCalendarTasks(container, iso){
  const items = Store.get().tasks.filter(t=>t.date===iso).sort(sortByWhen);
  container.innerHTML = `<div class="h-impact" style="font-size:20px;margin-bottom:6px">${humanDate(iso)}</div>` +
    (items.length ? items.map(taskRow).join('') : `<p class="muted">Нет задач на этот день.</p>`);
  // bind actions + swipe
  $$('.task', container).forEach(card=>{
    card.querySelector('[data-toggle]').addEventListener('click', ()=> toggleDone(card.dataset.id));
    card.querySelector('[data-edit]').addEventListener('click', ()=> startEdit(card.dataset.id));
    card.querySelector('[data-del]').addEventListener('click', ()=> delTask(card.dataset.id));
    bindSwipe(card);
  });
}

/* ============ Export / Import ============ */
function exportJSON(){
  const blob = new Blob([JSON.stringify(Store.get(), null, 2)], {type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `planner-export-${new Date().toISOString().slice(0,10)}.json`;
  a.click(); URL.revokeObjectURL(a.href);
}
async function importJSON(e){
  const file = e.target.files?.[0]; if(!file) return;
  try{
    const text = await file.text();
    const data = JSON.parse(text);
    // простая валидация
    if(!data || typeof data!=='object') throw 0;
    if(!data.settings || !data.tasks) throw 0;
    Store.set(data); alert('Импортировано.');
  }catch{ alert('Файл не распознан.'); }
}

/* ============ Helpers ============ */
function humanDate(iso){
  if(!iso) return 'Без даты';
  const d = new Date(iso+'T00:00:00');
  const today = dtKey(new Date());
  const tomorrow = dtKey(new Date(Date.now()+86400000));
  const key = dtKey(d);
  if(key===today) return 'Сегодня';
  if(key===tomorrow) return 'Завтра';
  return d.toLocaleDateString('ru-RU', {day:'2-digit', month:'long', year:'numeric'});
}

/* draggable attribute for task rows */
document.addEventListener('dragstart', e=>{
  const art = e.target.closest?.('.task'); if(!art) return;
  e.dataTransfer.setData('text/id', art.dataset.id);
  e.dataTransfer.effectAllowed = 'move';
});
