/* Weepl • App.js — v1.5 */

(() => {
  // --------- Helpers ---------
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

  const fmt2 = n => String(n).padStart(2, "0");
  const toKey = d => `${d.getFullYear()}-${fmt2(d.getMonth() + 1)}-${fmt2(d.getDate())}`;
  const fromKey = key => {
    const [Y, M, D] = key.split("-").map(Number);
    return new Date(Y, M - 1, D);
  };
  const startOfDay = d => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

  const RU_MONTHS = ["январь","февраль","март","апрель","май","июнь","июль","август","сентябрь","октябрь","ноябрь","декабрь"];
  const RU_DOW = ["вс","пн","вт","ср","чт","пт","сб"];

  // --------- State ---------
  const storeKey = "weepl_v1";
  const state = {
    selectedDate: startOfDay(new Date()),
    monthCursor: startOfDay(new Date()),
    items: [], // {id, type:'task'|'event', dateKey, title, note, priority, done, start:'HH:MM', durationMin}
    settings: { accent: getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#5b5bf0' }
  };

  // Load
  try {
    const raw = localStorage.getItem(storeKey);
    if (raw) Object.assign(state, JSON.parse(raw), {
      selectedDate: fromKey(JSON.parse(raw).selectedDate || toKey(new Date())),
      monthCursor: fromKey(JSON.parse(raw).monthCursor || toKey(new Date()))
    });
  } catch { /* ignore */ }

  const save = () => {
    localStorage.setItem(storeKey, JSON.stringify({
      ...state,
      selectedDate: toKey(state.selectedDate),
      monthCursor: toKey(state.monthCursor)
    }));
  };

  // --------- Mount static roots (if not present) ---------
  const root = $('#viewContainer') || (() => {
    const c = document.createElement('main');
    c.id = 'viewContainer';
    document.body.appendChild(c);
    return c;
  })();

  // Topbar
  let topbar = $('.topbar');
  if (!topbar) {
    topbar = document.createElement('header');
    topbar.className = 'topbar';
    topbar.innerHTML = `
      <h1 class="month-title" id="topTitle"></h1>
      <div class="month-nav">
        <button class="icon-btn" id="navPrev" aria-label="prev">←</button>
        <button class="icon-btn" id="navNext" aria-label="next">→</button>
      </div>`;
    document.body.prepend(topbar);
  }

  // Views
  const tpl = `
    <section id="todayView" class="view is-active">
      <div class="date-scroller" id="dateScroller"></div>

      <div class="timeline-wrap">
        <div class="timeline" id="timeline"></div>
      </div>

      <div class="tasklist-wrap">
        <div class="section-head">
          <h2>Задачи</h2><div class="kpi" id="kpiCounter"></div>
        </div>
        <ul class="task-list" id="taskList"></ul>
      </div>
    </section>

    <section id="calendarView" class="view">
      <div class="cal-head">
        <button class="icon-btn" id="calPrev">←</button>
        <h2 class="month-title" id="calTitle"></h2>
        <button class="icon-btn" id="calNext">→</button>
      </div>
      <div class="cal-weekdays" id="calWeek">
        ${RU_DOW.map(d=>`<div>${d.toUpperCase()}</div>`).join('')}
      </div>
      <div class="calendar-wrap">
        <div class="calendar-grid" id="calendarGrid"></div>
      </div>
    </section>

    <section id="statsView" class="view">
      <h2 class="screen-title">Статистика</h2>
      <div class="stats-grid">
        <div class="card">
          <div class="ring">
            <svg viewBox="0 0 120 120"><circle class="ring-bg" cx="60" cy="60" r="52"/><circle class="ring-fg" id="ringFg" cx="60" cy="60" r="52"/></svg>
            <div class="ring-center"><div class="ring-pct" id="ringPct">0%</div></div>
          </div>
          <div class="card-caption">Выполнено за неделю</div>
        </div>
        <div class="card"><div class="card-row"><b id="stat7">0 / 0</b><span class="card-caption">За 7 дней</span></div></div>
        <div class="card"><div class="card-row"><b id="stat30">0 / 0</b><span class="card-caption">За месяц</span></div></div>
        <div class="card"><div class="card-row"><b id="streak">0</b><span class="card-caption">Серия выполнения</span></div></div>
        <div class="card card-wide"><div class="card-row"><b>Выполнено по дням</b><span class="card-caption">последние 7 дней</span></div><canvas id="miniBars" height="120"></canvas></div>
      </div>
    </section>

    <section id="settingsView" class="view">
      <h2 class="screen-title">Настройки</h2>
      <div class="card">
        <div class="field"> 
          <label>Акцентный цвет</label>
          <input type="color" id="accentPicker" value="${state.settings.accent}">
        </div>
        <div class="field-row">
          <label class="muted" style="min-width:140px;">Неон-эффект</label>
          <input type="checkbox" id="neonToggle">
        </div>
        <div class="field-row">
          <label class="muted" style="min-width:140px;">Металличность</label>
          <input type="checkbox" id="metalToggle">
        </div>
        <div class="field">
          <label>Масштаб текста</label>
          <input type="range" id="fontScale" min="0.9" max="1.2" step="0.01" value="1">
        </div>
      </div>
    </section>

    <nav class="tabbar" id="tabbar">
      <button class="tab is-active" data-tab="today"><i class="i i-list"></i></button>
      <button class="tab" data-tab="calendar"><i class="i i-cal"></i></button>
      <button class="tab" data-tab="stats"><i class="i i-stats"></i></button>
      <button class="tab" data-tab="settings"><i class="i i-gear"></i></button>
    </nav>

    <button class="fab" id="fab" aria-label="add">＋</button>

    <dialog class="modal" id="addDialog">
      <div class="modal-card">
        <div class="modal-head"><h3>Новое</h3><button class="icon-btn" id="dlgClose">✕</button></div>
        <div class="field-row seg">
          <label><input type="radio" name="kind" value="task" checked><span>Задача</span></label>
          <label><input type="radio" name="kind" value="event"><span>Событие</span></label>
        </div>
        <div class="field"><label>Название</label><input id="fldTitle" placeholder="Название"></div>
        <div class="grid-2">
          <div class="field"><label>Дата</label><input type="date" id="fldDate"></div>
          <div class="field"><label>Приоритет</label>
            <select id="fldPrio">
              <option value="low">Низкий</option>
              <option value="medium" selected>Средний</option>
              <option value="high">Высокий</option>
            </select>
          </div>
        </div>
        <div id="eventRow" class="grid-2">
          <div class="field"><label>Начало</label><input type="time" id="fldStart" value="06:00"></div>
          <div class="field"><label>Длительность (мин)</label><input type="number" id="fldDur" min="15" step="15" value="60"></div>
        </div>
        <div class="field"><label>Заметка</label><textarea id="fldNote" rows="2"></textarea></div>
        <div class="modal-foot">
          <button class="btn ghost" id="dlgCancel">Отмена</button>
          <button class="btn primary" id="dlgSave">Сохранить</button>
        </div>
      </div>
    </dialog>

    <dialog class="modal" id="reschedDialog">
      <div class="modal-card">
        <div class="modal-head"><h3>Перенести</h3><button class="icon-btn" id="rsClose">✕</button></div>
        <div class="grid-2">
          <div class="field"><label>Дата</label><input type="date" id="rsDate"></div>
          <div class="field"><label>Время (для события)</label><input type="time" id="rsTime" value="06:00"></div>
        </div>
        <div class="modal-foot">
          <button class="btn ghost" id="rsCancel">Отмена</button>
          <button class="btn primary" id="rsApply">Перенести</button>
        </div>
      </div>
    </dialog>
  `;
  root.innerHTML = tpl;

  // --------- DOM refs ---------
  const refs = {
    topTitle: $('#topTitle'),
    navPrev: $('#navPrev'),
    navNext: $('#navNext'),

    scroller: $('#dateScroller'),
    timeline: $('#timeline'),
    taskList: $('#taskList'),
    kpi: $('#kpiCounter'),

    calTitle: $('#calTitle'),
    calGrid: $('#calendarGrid'),
    calPrev: $('#calPrev'),
    calNext: $('#calNext'),

    ringFg: $('#ringFg'),
    ringPct: $('#ringPct'),

    tabbar: $('#tabbar'),
    views: {
      today: $('#todayView'),
      calendar: $('#calendarView'),
      stats: $('#statsView'),
      settings: $('#settingsView')
    },

    fab: $('#fab'),

    addDialog: $('#addDialog'),
    dlgClose: $('#dlgClose'),
    dlgCancel: $('#dlgCancel'),
    dlgSave: $('#dlgSave'),
    fldKind: () => $('input[name="kind"]:checked', refs.addDialog),
    fldTitle: $('#fldTitle'),
    fldDate: $('#fldDate'),
    fldPrio: $('#fldPrio'),
    fldStart: $('#fldStart'),
    fldDur: $('#fldDur'),
    fldNote: $('#fldNote'),
    eventRow: $('#eventRow'),

    rsDialog: $('#reschedDialog'),
    rsClose: $('#rsClose'),
    rsCancel: $('#rsCancel'),
    rsApply: $('#rsApply'),
    rsDate: $('#rsDate'),
    rsTime: $('#rsTime'),

    accentPicker: $('#accentPicker'),
    neonToggle: $('#neonToggle'),
    metalToggle: $('#metalToggle'),
    fontScale: $('#fontScale'),
  };

  // --------- Rendering: Titles ---------
  function setTopTitle(d = state.selectedDate) {
    refs.topTitle.textContent = `${capitalizeMonth(d)} ${d.getFullYear()}`;
  }
  function setCalTitle() {
    const d = state.monthCursor;
    refs.calTitle.textContent = `${capitalizeMonth(d)} ${d.getFullYear()}`;
  }
  const capitalizeMonth = d => {
    const m = RU_MONTHS[d.getMonth()];
    return m.charAt(0).toUpperCase() + m.slice(1);
  };

  // --------- Date scroller (Today only) ---------
  function buildScroller() {
    refs.scroller.innerHTML = '';
    const center = state.selectedDate;
    const start = addDays(center, -3);
    for (let i = 0; i < 7; i++) {
      const day = addDays(start, i);
      const pill = document.createElement('button');
      pill.className = 'date-pill' + (toKey(day) === toKey(state.selectedDate) ? ' is-active' : '');
      pill.innerHTML = `
        <div class="dow">${RU_DOW[day.getDay()].toUpperCase()}</div>
        <div class="day">${day.getDate()}</div>
        <div class="mon">${RU_MONTHS[day.getMonth()].slice(0,3)}.</div>`;
      pill.addEventListener('click', () => {
        state.selectedDate = startOfDay(day);
        save();
        refreshToday();
      });
      refs.scroller.appendChild(pill);
    }
  }

  // --------- Timeline (events) ---------
  const dayStart = 6 * 60; // 06:00
  function buildTimeline() {
    const box = refs.timeline;
    box.innerHTML = '';
    box.style.setProperty('--accent', getAccent());

    // Grid hour labels
    for (let h = 6; h <= 22; h++) {
      const y = (h * 60 - dayStart);
      const lbl = document.createElement('div');
      lbl.className = 'time-label';
      lbl.style.top = `${(y/1)}px`;
      lbl.textContent = `${fmt2(h)}:00`;
      box.appendChild(lbl);
    }

    // "Now" line (if today)
    const todayKey = toKey(new Date());
    if (toKey(state.selectedDate) === todayKey) {
      const now = new Date();
      const min = now.getHours()*60 + now.getMinutes();
      if (min >= dayStart && min <= 22*60) {
        const nl = document.createElement('div');
        nl.className = 'now-line';
        nl.style.top = `${min - dayStart}px`;
        box.appendChild(nl);
      }
    }

    // Events
    const items = byDate(state.selectedDate).filter(i => i.type === 'event');
    items.forEach(ev => {
      const [hh, mm] = ev.start.split(':').map(Number);
      const top = (hh*60 + mm) - dayStart;
      const height = Math.max(30, ev.durationMin);
      const el = document.createElement('div');
      el.className = 'event';
      el.style.top = `${top}px`;
      el.style.height = `${height}px`;
      el.innerHTML = `<div class="ttl">${ev.title}</div><div class="meta">${ev.start} • ${ev.durationMin} мин</div>`;
      box.appendChild(el);
    });
  }

  // --------- Tasks list (with swipe) ---------
  function buildTasks() {
    const list = refs.taskList;
    list.innerHTML = '';
    const tasks = byDate(state.selectedDate).filter(i => i.type === 'task');

    refs.kpi.textContent = tasks.length ? `Задач: ${tasks.filter(t=>t.done).length} / ${tasks.length}` : '';

    tasks.forEach(task => {
      const li = document.createElement('li');
      li.className = 'task-row' + (task.done ? ' task-done' : '');
      li.dataset.id = task.id;

      // Swipe bg
      const bg = document.createElement('div');
      bg.className = 'swipe-bg';
      bg.innerHTML = `<div class="bg-left">Готово</div><div class="bg-right">Перенести</div>`;
      li.appendChild(bg);

      // Foreground content
      const title = document.createElement('div');
      title.className = 'title';
      title.textContent = task.title;
      const meta = document.createElement('div');
      meta.className = 'meta';
      meta.textContent = `приоритет: ${rusPrio(task.priority)}`;
      const actions = document.createElement('div');
      actions.className = 'task-actions';
      actions.innerHTML = `
        <button class="icon-small" data-act="done">✓</button>
        <button class="icon-small" data-act="move">↔</button>
        <button class="icon-small" data-act="del">🗑</button>
      `;
      li.append(title, meta, actions);
      list.appendChild(li);

      actions.addEventListener('click', (e) => {
        const btn = e.target.closest('button');
        if (!btn) return;
        const act = btn.dataset.act;
        if (act === 'done') toggleDone(task.id);
        if (act === 'del') delItem(task.id);
        if (act === 'move') openReschedule(task);
      });

      // Swipe gestures
      attachSwipe(li, {
        left: () => openReschedule(task),  // вправо->лево: перенести
        right: () => toggleDone(task.id)   // влево->право: готово
      });
    });
  }

  function rusPrio(p){ return p==='high'?'высокий':p==='low'?'низкий':'средний'; }

  function attachSwipe(el, {left, right}) {
    let x0 = 0, dx = 0, swiping = false, cancelled = false;
    const start = e => {
      x0 = (e.touches ? e.touches[0].clientX : e.clientX);
      dx = 0; swiping = true; cancelled = false;
      el.classList.add('is-swiping');
      el.style.transition = 'none';
    };
    const move = e => {
      if (!swiping) return;
      const x = (e.touches ? e.touches[0].clientX : e.clientX);
      dx = x - x0;
      el.style.transform = `translateX(${dx}px)`;
    };
    const end = () => {
      if (!swiping) return;
      swiping = false;
      el.style.transition = '';
      el.classList.remove('is-swiping');

      if (Math.abs(dx) > 80) {
        // fire action, but DO NOT remove element until action completes
        if (dx > 0) right && right();
        else left && left();
        // reset position (фикс: при отмене переносов элемент остаётся)
        el.style.transform = '';
      } else {
        el.style.transform = '';
      }
    };
    el.addEventListener('touchstart', start, {passive:true});
    el.addEventListener('touchmove', move, {passive:true});
    el.addEventListener('touchend', end);
    el.addEventListener('mousedown', start);
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', end);
  }

  // --------- Calendar ---------
  function buildCalendar() {
    const grid = refs.calGrid;
    grid.innerHTML = '';
    const d = state.monthCursor;
    const first = new Date(d.getFullYear(), d.getMonth(), 1);
    const start = new Date(first);
    start.setDate(1 - ((first.getDay() + 6) % 7)); // Monday-first grid

    for (let i=0;i<42;i++){
      const day = addDays(start, i);
      const cell = document.createElement('button');
      cell.className = 'cal-cell';
      if (day.getMonth() !== d.getMonth()) cell.classList.add('is-out');
      if (toKey(day) === toKey(new Date())) cell.classList.add('is-today');
      if (toKey(day) === toKey(state.selectedDate)) cell.classList.add('is-selected');
      cell.textContent = day.getDate();
      cell.addEventListener('click', () => {
        state.selectedDate = startOfDay(day);
        save();
        switchTab('today');
      });
      grid.appendChild(cell);
    }
  }

  // --------- Stats ---------
  function buildStats() {
    const last7 = [...Array(7)].map((_,i)=>addDays(new Date(), -6+i));
    const done7 = last7.map(d => byDate(d).filter(x=>x.type==='task' && x.done).length);
    const all7 = last7.map(d => byDate(d).filter(x=>x.type==='task').length);
    const s7 = sum(done7), a7 = sum(all7);
    $('#stat7').textContent = `${s7} / ${a7}`;

    // month
    const now = new Date();
    let s30=0,a30=0;
    for(let i=0;i<30;i++){
      const d = addDays(now,-i);
      s30 += byDate(d).filter(x=>x.type==='task' && x.done).length;
      a30 += byDate(d).filter(x=>x.type==='task').length;
    }
    $('#stat30').textContent = `${s30} / ${a30}`;

    // ring
    const pct = a7? Math.round((s7/a7)*100) : 0;
    refs.ringPct.textContent = `${pct}%`;
    const C = 2*Math.PI*52; // dasharray in CSS: 327
    const dash = C - (C*pct/100);
    refs.ringFg.style.strokeDasharray = C;
    refs.ringFg.style.strokeDashoffset = dash;

    // mini bars
    const cv = $('#miniBars');
    if (cv.getContext) {
      const ctx = cv.getContext('2d');
      const w = cv.width = cv.clientWidth || 300;
      const h = cv.height = cv.height;
      ctx.clearRect(0,0,w,h);
      const bw = Math.floor(w/9);
      const max = Math.max(1, ...done7);
      ctx.fillStyle = getAccent();
      done7.forEach((v,i)=>{
        const x = (i+1)*bw;
        const barH = (v/max)*(h-24);
        ctx.fillRect(x, h-8-barH, bw*0.6, barH);
      });
    }
  }
  const sum = arr => arr.reduce((a,b)=>a+b,0);

  // --------- CRUD ---------
  function byDate(d){ return state.items.filter(i => i.dateKey === toKey(d)); }
  function addItem(data){
    const id = crypto.randomUUID ? crypto.randomUUID() : String(Date.now()+Math.random());
    state.items.push({ id, ...data });
    save(); refreshAll();
  }
  function toggleDone(id){
    const it = state.items.find(x=>x.id===id);
    if (!it) return;
    it.done = !it.done;
    save(); refreshToday(); buildStats();
  }
  function delItem(id){
    state.items = state.items.filter(x=>x.id!==id);
    save(); refreshAll();
  }

  // --------- Add dialog ---------
  function openAdd() {
    refs.fldTitle.value = '';
    refs.fldDate.value = toKey(state.selectedDate);
    refs.fldPrio.value = 'medium';
    refs.fldStart.value = '06:00';
    refs.fldDur.value = 60;
    refs.fldNote.value = '';
    $('input[name="kind"][value="task"]', refs.addDialog).checked = true;
    refs.eventRow.style.display = '';
    toggleKind(); // ensure row visibility
    refs.addDialog.showModal();
  }
  function toggleKind(){
    const kind = refs.fldKind().value;
    refs.eventRow.style.display = (kind === 'event') ? '' : 'none';
  }

  // --------- Reschedule dialog (fixed cancel) ---------
  let rescheduleId = null;
  function openReschedule(item){
    rescheduleId = item.id;
    refs.rsDate.value = item.dateKey;
    refs.rsTime.value = item.start || '06:00';
    refs.rsDialog.showModal();
  }
  function applyReschedule(){
    if (!rescheduleId) return closeReschedule(true);
    const it = state.items.find(x=>x.id===rescheduleId);
    if (it){
      it.dateKey = refs.rsDate.value;
      if (it.type === 'event') it.start = refs.rsTime.value;
      save(); refreshAll();
    }
    closeReschedule(true);
  }
  function closeReschedule(clear=false){
    refs.rsDialog.close();
    if (clear) rescheduleId = null;
    // важный фикс: никаких удалений/изменений при отмене
    refreshToday();
  }

  // --------- Navigation ---------
  function switchTab(tab){
    Object.entries(refs.views).forEach(([k,el]) => el.classList.toggle('is-active', k===tab));
    $$('.tab', refs.tabbar).forEach(b => b.classList.toggle('is-active', b.dataset.tab===tab));
    if (tab==='today'){ setTopTitle(); buildScroller(); refreshToday(); }
    if (tab==='calendar'){ setCalTitle(); buildCalendar(); }
    if (tab==='stats'){ buildStats(); }
    save();
  }

  // --------- Refreshers ---------
  function refreshToday(){
    setTopTitle();
    buildScroller();
    buildTimeline();
    buildTasks();
  }
  function refreshAll(){
    const active = $('.view.is-active');
    if (active === refs.views.calendar) { setCalTitle(); buildCalendar(); }
    refreshToday();
    buildStats();
  }

  // --------- Settings (accent / neon / metallic / font scale) ---------
  function setAccent(v){
    document.documentElement.style.setProperty('--accent', v);
    state.settings.accent = v; save(); buildStats(); refreshToday();
  }
  function getAccent(){ return state.settings.accent || '#5b5bf0'; }

  refs.accentPicker.addEventListener('input', e => setAccent(e.target.value));
  refs.neonToggle.addEventListener('change', e => document.body.classList.toggle('neon', e.target.checked));
  refs.metalToggle.addEventListener('change', e => document.body.classList.toggle('metallic', e.target.checked));
  refs.fontScale.addEventListener('input', e => {
    document.body.style.setProperty('--font-scale', e.target.value);
    document.body.style.fontSize = (16 * parseFloat(e.target.value)) + 'px';
  });

  // --------- Events wiring ---------
  refs.navPrev.addEventListener('click', () => {
    state.selectedDate = addDays(state.selectedDate, -1); save(); refreshToday();
  });
  refs.navNext.addEventListener('click', () => {
    state.selectedDate = addDays(state.selectedDate, 1); save(); refreshToday();
  });

  refs.calPrev.addEventListener('click', () => {
    const d = state.monthCursor;
    state.monthCursor = new Date(d.getFullYear(), d.getMonth()-1, 1);
    setCalTitle(); buildCalendar(); save();
  });
  refs.calNext.addEventListener('click', () => {
    const d = state.monthCursor;
    state.monthCursor = new Date(d.getFullYear(), d.getMonth()+1, 1);
    setCalTitle(); buildCalendar(); save();
  });

  refs.tabbar.addEventListener('click', e => {
    const b = e.target.closest('[data-tab]'); if(!b) return;
    switchTab(b.dataset.tab);
  });

  refs.fab.addEventListener('click', openAdd);
  refs.dlgClose.addEventListener('click', ()=>refs.addDialog.close());
  refs.dlgCancel.addEventListener('click', ()=>refs.addDialog.close());
  refs.addDialog.addEventListener('change', e=>{
    if (e.target.name==='kind') toggleKind();
  });
  refs.dlgSave.addEventListener('click', () => {
    const kind = refs.fldKind().value;
    const title = refs.fldTitle.value.trim();
    if (!title) return refs.addDialog.close();
    const data = {
      type: kind,
      dateKey: refs.fldDate.value || toKey(state.selectedDate),
      title,
      note: refs.fldNote.value.trim(),
      priority: refs.fldPrio.value,
      done: false
    };
    if (kind==='event'){
      data.start = refs.fldStart.value || '06:00';
      data.durationMin = clamp(parseInt(refs.fldDur.value||60,10), 15, 24*60);
    }
    addItem(data);
    refs.addDialog.close();
  });

  refs.rsApply.addEventListener('click', applyReschedule);
  refs.rsCancel.addEventListener('click', ()=>closeReschedule(true));
  refs.rsClose.addEventListener('click', ()=>closeReschedule(true));

  // --------- Init demo (if empty) ---------
  if (!state.items.length) {
    const dk = toKey(state.selectedDate);
    state.items.push(
      {id:'t1', type:'task', dateKey:dk, title:'Сыграть в волейбол', priority:'medium', done:false},
      {id:'e1', type:'event', dateKey:dk, title:'Встреча с клиентом', start:'10:00', durationMin:90, priority:'high'},
      {id:'t2', type:'task', dateKey:dk, title:'Сделать бравл старс', priority:'low', done:false},
    );
    save();
  }

  // --------- Start ---------
  setAccent(state.settings.accent);
  setTopTitle(); setCalTitle();
  buildScroller(); refreshToday(); buildStats();

  // default view
  switchTab('today');
})();
