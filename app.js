'use strict';
console.log('Weepl App V2.2 calendar ✅');

/* ===== helpers ===== */
const $  = (s,r)=> (r||document).querySelector(s);
const $$ = (s,r)=> Array.from((r||document).querySelectorAll(s));
const uid = ()=> Math.random().toString(36).slice(2,9);
const todayKey = ()=> new Date().toISOString().slice(0,10);
const dtKey = d => new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString().slice(0,10);
const parseKey = k => { const p=k.split('-'); return new Date(+p[0], +p[1]-1, +p[2]); };
const monthTitle = d => d.toLocaleString('ru-RU',{month:'long'})+' '+d.getFullYear();
const prioColor = p => p==='high'?'#ff4fa3':p==='critical'?'#8a2be2':p==='low'?'var(--border)':'var(--accent)';
const escapeHtml = s => String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const mapPrio = p => p==='high'?'высокий':p==='critical'?'критический':p==='low'?'низкий':'средний';
function humanDate(iso){
  if(!iso) return 'Без даты';
  const d=parseKey(iso), t=todayKey(), tm=dtKey(new Date(Date.now()+86400000));
  const k=dtKey(d); if(k===t) return 'Сегодня'; if(k===tm) return 'Завтра';
  return d.toLocaleDateString('ru-RU',{day:'2-digit',month:'long',year:'numeric'});
}

/* ===== store ===== */
const STORE_KEY='weepl.v1';
function loadStore(){
  try{ return JSON.parse(localStorage.getItem(STORE_KEY)) || {settings:{theme:'light',accent:'violet',weekStart:1},tasks:[]}; }
  catch{ return {settings:{theme:'light',accent:'violet',weekStart:1},tasks:[]}; }
}
function saveStore(d){ localStorage.setItem(STORE_KEY, JSON.stringify(d)); }
let store = loadStore();

/* ===== theme ===== */
function applyTheme(){
  document.documentElement.dataset.theme = store.settings.theme || 'light';
  document.documentElement.dataset.accent = store.settings.accent || 'violet';
}
applyTheme();

/* ===== router ===== */
const routes = {'#/': renderHome, '#/calendar': renderCalendar, '#/settings': renderSettings};
function router(){
  let hash = location.hash || '#/';
  if(!routes[hash]) hash = '#/';
  const view = $('#view'); view.innerHTML = '';
  routes[hash](view);
  $$('.tab').forEach(t=> t.classList.toggle('active', t.dataset.route===hash));
}
window.addEventListener('hashchange', router);

/* ===== state ===== */
let state = { selectedDate: todayKey(), month: new Date() };

/* ===== boot ===== */
document.addEventListener('DOMContentLoaded', ()=>{
  $('#app').appendChild($('#layout').content.cloneNode(true));
  $('#fabAdd').onclick = ()=> openTaskModal({});
  router();
});

/* ===== HOME ===== */
function renderHome(root){
  root.appendChild($('#home-view').content.cloneNode(true));
  $('#homeMonth').textContent = monthTitle(state.month);
  $('[data-home-month="prev"]').onclick = ()=>{ state.month = new Date(state.month.getFullYear(), state.month.getMonth()-1, 1); $('#homeMonth').textContent = monthTitle(state.month); renderDates(); };
  $('[data-home-month="next"]').onclick = ()=>{ state.month = new Date(state.month.getFullYear(), state.month.getMonth()+1, 1); $('#homeMonth').textContent = monthTitle(state.month); renderDates(); };
  renderDates();
  renderTaskList();
}

/* vertical date cards: wk / daynum / mon */
function renderDates(){
  const strip = $('#dateStrip'); strip.innerHTML = '';
  const base = parseKey(state.selectedDate);
  const start = new Date(base.getFullYear(), base.getMonth(), base.getDate()-6);
  for(let i=0;i<14;i++){
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate()+i);
    const key = dtKey(d);
    const btn = document.createElement('button');
    btn.className = 'date-pill'+(key===state.selectedDate?' active':'');
    btn.setAttribute('data-key', key);
    const wk = d.toLocaleString('ru-RU',{weekday:'short'}).toUpperCase();
    const mon = d.toLocaleString('ru-RU',{month:'long'});
    btn.innerHTML = `
      <div class="wk">${wk}</div>
      <div class="daynum">${String(d.getDate()).padStart(2,'0')}</div>
      <div class="mon">${mon}</div>
    `;
    btn.onclick = ()=>{
      state.selectedDate = key;
      $$('.date-pill', strip).forEach(b=>b.classList.toggle('active', b===btn));
      $('#todayTitle').textContent = humanDate(state.selectedDate);
      renderTaskList();
      btn.scrollIntoView({inline:'center', block:'nearest', behavior:'smooth'});
    };
    strip.appendChild(btn);
  }
  $('#todayTitle').textContent = humanDate(state.selectedDate);
  const active = $('.date-pill.active', strip);
  if(active) active.scrollIntoView({inline:'center', block:'nearest'});
}

/* ===== Tasks list (reference style) ===== */
function renderTaskList(){
  const list = $('#taskList'); list.innerHTML='';
  const tasks = store.tasks
    .filter(t=>t.date===state.selectedDate)
    .sort((a,b)=> (a.time||'23:59').localeCompare(b.time||'23:59'));

  if(!tasks.length){
    list.innerHTML = '<p class="muted">Нет задач на эту дату.</p>';
    return;
  }

  tasks.forEach(t=>{
    const card = document.createElement('article');
    card.className = 'task'+(t.done?' is-done':'');
    card.draggable = true;
    card.dataset.id = t.id;

    card.innerHTML = `
      <div></div>
      <div>
        <div class="title">${escapeHtml(t.title)}</div>
        <div class="meta">
          ${t.time?`<span class="time">⏰ ${t.time}</span>`:''}
          ${t.priority?` • приоритет: ${mapPrio(t.priority)}`:''}
        </div>
      </div>
      <div class="ctl">
        <button class="icon-btn" data-toggle title="Готово">✔</button>
        <button class="icon-btn" data-edit title="Редактировать">✎</button>
        <button class="icon-btn" data-del title="Удалить">🗑</button>
      </div>
    `;

    card.querySelector('[data-toggle]').onclick = ()=> toggleDone(t.id);
    card.querySelector('[data-edit]').onclick   = ()=> openTaskModal(t);
    card.querySelector('[data-del]').onclick    = ()=> { store.tasks = store.tasks.filter(x=>x.id!==t.id); saveStore(store); renderTaskList(); };

    bindSwipe(card);
    list.appendChild(card);
  });
}

/* swipe: → done, ← перенос +1 день */
function bindSwipe(el){
  let x0=0,dx=0,active=false;
  el.addEventListener('touchstart',e=>{x0=e.touches[0].clientX;active=true;dx=0;},{passive:true});
  el.addEventListener('touchmove',e=>{
    if(!active) return;
    dx = e.touches[0].clientX - x0;
    el.style.transform = `translateX(${dx}px)`;
  },{passive:true});
  el.addEventListener('touchend',()=>{
    if(!active) return; active=false;
    if(dx>80){ toggleDone(el.dataset.id); }
    else if(dx<-80){
      const t = store.tasks.find(x=>x.id===el.dataset.id);
      if(t){ const d=parseKey(t.date); d.setDate(d.getDate()+1); t.date = dtKey(d); saveStore(store); }
    }
    el.style.transform='';
    renderTaskList();
  });
}

function toggleDone(id){ const t=store.tasks.find(x=>x.id===id); if(!t) return; t.done=!t.done; saveStore(store); renderTaskList(); }

/* ===== Calendar (redesigned) ===== */
function renderCalendar(root){
  root.appendChild($('#calendar-view').content.cloneNode(true));

  const now = state.month;
  $('#calTitle').textContent = monthTitle(now);
  $('[data-cal="prev"]').onclick = ()=>{ state.month=new Date(now.getFullYear(), now.getMonth()-1, 1); renderCalendar($('#view')); };
  $('[data-cal="next"]').onclick = ()=>{ state.month=new Date(now.getFullYear(), now.getMonth()+1, 1); renderCalendar($('#view')); };

  const grid = $('#calendarGrid'); grid.innerHTML='';
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  const startIdx = (first.getDay()+6)%7;
  const days = new Date(now.getFullYear(), now.getMonth()+1, 0).getDate();
  const names = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];

  // заголовки
  names.forEach(n=> grid.insertAdjacentHTML('beforeend', `<div class="cell head">${n}</div>`));
  // пустые ячейки до начала месяца
  for(let i=0;i<startIdx;i++) grid.insertAdjacentHTML('beforeend','<div class="cell"></div>');
  // дни
  for(let d=1; d<=days; d++){
    const key = dtKey(new Date(now.getFullYear(), now.getMonth(), d));
    const dayTasks = store.tasks.filter(t=>t.date===key);
    const dots = dayTasks.map(t=>`<span class="dot" style="background:${prioColor(t.priority)}"></span>`).join('');
    grid.insertAdjacentHTML('beforeend', `
      <div class="cell daycell ${key===state.selectedDate?'selected':''}" data-date="${key}">
        <div class="dhead">${d}</div>
        <div class="dots">${dots}</div>
      </div>
    `);
  }

  // интерактив
  $$('.daycell', grid).forEach(c=>{
    c.addEventListener('click', ()=>{
      state.selectedDate = c.dataset.date;
      $$('.daycell', grid).forEach(x=>x.classList.toggle('selected', x===c));
      renderCalendarTasks($('#calendarTasks'), state.selectedDate);
    });
    c.addEventListener('dragover', ev=>ev.preventDefault());
    c.addEventListener('drop', ev=>{
      ev.preventDefault();
      const id = ev.dataTransfer.getData('text/id');
      const t = store.tasks.find(x=>x.id===id);
      if(!t) return;
      t.date=c.dataset.date; saveStore(store);
      state.selectedDate = c.dataset.date;
      renderCalendar($('#view')); // перерисуем сетку и список
    });
  });

  renderCalendarTasks($('#calendarTasks'), state.selectedDate);
}

/* список событий под календарём — «плашки» */
function renderCalendarTasks(container, iso){
  const items = store.tasks
    .filter(t=>t.date===iso)
    .sort((a,b)=> (a.time||'').localeCompare(b.time||''));
  container.innerHTML = `
    <div class="h-impact" style="font-size:20px;margin-bottom:6px">${humanDate(iso)}</div>
    ${items.length ? items.map(eventRow).join('') : '<p class="muted">Нет задач на этот день.</p>'}
  `;

  $$('.event', container).forEach(row=>{
    row.querySelector('[data-toggle]').onclick=()=>toggleDone(row.dataset.id);
    row.querySelector('[data-edit]').onclick = ()=> openTaskModal(store.tasks.find(x=>x.id===row.dataset.id));
    row.querySelector('[data-del]').onclick  = ()=>{ store.tasks=store.tasks.filter(x=>x.id!==row.dataset.id); saveStore(store); renderCalendarTasks(container, iso); };
  });
}

function eventRow(t){
  return `<article class="event${t.done?' is-done':''}" data-id="${t.id}" data-prio="${t.priority||'medium'}" draggable="true" style="position:relative">
    <div></div>
    <div>
      <div class="title">${escapeHtml(t.title)}</div>
      <div class="meta">${t.time?`⏰ ${t.time}`:''}${t.priority?` • ${mapPrio(t.priority)}`:''}</div>
    </div>
    <div class="ctl">
      <button class="icon-btn" data-toggle>✔</button>
      <button class="icon-btn" data-edit>✎</button>
      <button class="icon-btn" data-del>🗑</button>
    </div>
  </article>`;
}

/* ===== Settings ===== */
function renderSettings(root){
  root.appendChild($('#settings-view').content.cloneNode(true));
  $('#setTheme').value = store.settings.theme || 'light';
  $('#setAccent').value = store.settings.accent || 'violet';
  $('#setTheme').onchange = e=>{ store.settings.theme=e.target.value; applyTheme(); saveStore(store); };
  $('#setAccent').onchange = e=>{ store.settings.accent=e.target.value; applyTheme(); saveStore(store); };
  $('#btnExport').onclick = exportJSON;
  $('#fileImport').onchange = importJSON;
}

/* ===== Modal ===== */
function openTaskModal(prefill){
  const modal = $('#taskModal'), form = $('#taskForm');
  $('#modalTitle').textContent = prefill && prefill.id ? 'Редактировать' : 'Новая задача';
  $('#fTitle').value = prefill.title || '';
  $('#fDate').value  = prefill.date  || state.selectedDate;
  $('#fTime').value  = prefill.time  || '';
  $('#fPriority').value = prefill.priority || 'medium';
  $('#fSmart').value = prefill.smart || '';
  $('#fNote').value  = prefill.note  || '';
  modal.showModal();

  form.onsubmit = e=>{
    e.preventDefault();
    const fd = new FormData(form);
    const t = {
      id: prefill.id || uid(),
      title: fd.get('title'),
      date: fd.get('date') || state.selectedDate,
      time: fd.get('time') || '',
      priority: fd.get('priority') || 'medium',
      smart: fd.get('smart') || '',
      note: fd.get('note') || '',
      done: prefill.done || false
    };
    const i = store.tasks.findIndex(x=>x.id===t.id);
    if(i>-1) store.tasks[i]=t; else store.tasks.push(t);
    saveStore(store);
    modal.close();
    // обновим оба экрана в зависимости от текущего маршрута
    if((location.hash||'#/')==='#/calendar') renderCalendar($('#view'));
    else renderTaskList();
  };
  $$('[data-close]').forEach(b=> b.onclick=()=> modal.close());
}

/* ===== export/import ===== */
function exportJSON(){
  const blob = new Blob([JSON.stringify(store,null,2)], {type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'weepl-export-'+todayKey()+'.json';
  a.click(); URL.revokeObjectURL(a.href);
}
function importJSON(e){
  const f=e.target.files[0]; if(!f) return;
  const r=new FileReader();
  r.onload=()=>{ try{ const d=JSON.parse(r.result); if(!d.tasks) throw 0; store=d; saveStore(store); applyTheme(); alert('Импортировано'); router(); } catch{ alert('Ошибка импорта'); } };
  r.readAsText(f);
}

/* ===== drag helper (cards are draggable) ===== */
document.addEventListener('dragstart', e=>{
  const art=e.target.closest('.task, .event'); if(!art) return;
  e.dataTransfer.setData('text/id', art.dataset.id);
  e.dataTransfer.effectAllowed='move';
});
