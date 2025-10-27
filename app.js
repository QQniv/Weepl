/* Weepl App — readable build v1.6.0 */

(() => {
  // ---------- Helpers ----------
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const fmt2 = (n) => String(n).padStart(2, '0');
  const keyFromDate = (d) => `${d.getFullYear()}-${fmt2(d.getMonth()+1)}-${fmt2(d.getDate())}`;
  const fromKey = (k) => {
    const [Y,M,D] = k.split('-').map(Number);
    return new Date(Y, M-1, D);
  };
  const startDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const addDays = (d,n) => new Date(d.getFullYear(), d.getMonth(), d.getDate()+n);
  const RU_MON = ["янв.","февр.","март","апр.","май","июнь","июль","авг.","сент.","окт.","нояб.","дек."];
  const RU_DOW = ["вс","пн","вт","ср","чт","пт","сб"];

  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const sum = (a, fn=(x)=>x) => a.reduce((x,y)=>x+fn(y), 0);

  // ---------- State ----------
  const state = {
    today: startDay(new Date()),
    selectedDate: startDay(new Date()),
    monthCursor: startDay(new Date()),
    items: [], // {id,type:'task'|'event',title,dateKey,priority,time?:'HH:MM',durationMin?:number,done?:bool}
    settings: {
      accent: getCSS('--accent') || '#5b5bf0',
      neon: parseFloat(getCSS('--neon')) || 0,
      metallic: parseFloat(getCSS('--metallic')) || 0,
      fontScale: parseFloat(getCSS('--fontScale')) || 1
    },
    view: 'today' // 'today'|'calendar'|'stats'|'settings'
  };

  // ---------- Storage ----------
  const LS_KEY = 'weepl_data_v1';
  const LS_CFG = 'weepl_cfg_v1';

  function load() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) state.items = JSON.parse(raw);
    } catch {}
    try {
      const cfg = localStorage.getItem(LS_CFG);
      if (cfg) Object.assign(state.settings, JSON.parse(cfg));
    } catch {}
    applyTheme();
  }

  function persist() {
    localStorage.setItem(LS_KEY, JSON.stringify(state.items));
  }
  function persistCfg() {
    localStorage.setItem(LS_CFG, JSON.stringify(state.settings));
  }

  // ---------- Theme ----------
  function setCSS(name, val) {
    document.documentElement.style.setProperty(name, String(val));
  }
  function getCSS(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }
  function applyTheme() {
    setCSS('--accent', state.settings.accent);
    setCSS('--neon', state.settings.neon);
    setCSS('--metallic', state.settings.metallic);
    setCSS('--fontScale', state.settings.fontScale);
  }

  // ---------- Demo seed (first run) ----------
  function maybeSeed() {
    if (state.items.length) return;
    const k = keyFromDate(state.today);
    state.items.push(
      {id: uid(), type:'task', title:'Сыграть в волейбол', dateKey:k, time:'18:30', priority:'medium', done:false},
      {id: uid(), type:'task', title:'Пукнуть вовремя', dateKey:k, time:'21:00', priority:'medium', done:false},
      {id: uid(), type:'event', title:'Учёба', dateKey:k, time:'10:00', durationMin:90, priority:'low', done:false},
      {id: uid(), type:'event', title:'Тренировка', dateKey:k, time:'19:00', durationMin:60, priority:'high', done:false},
    );
    persist();
  }

  // ---------- IDs ----------
  function uid() {
    return Math.random().toString(36).slice(2,9)+Date.now().toString(36).slice(-4);
  }

  // ---------- Mount ----------
  const root = $('#viewContainer');
  if (!root) return;

  load();
  maybeSeed();
  render();

  // ---------- Render root ----------
  function render() {
    root.innerHTML = `
      <div class="container">
        ${renderTopbar()}
        ${state.view === 'today' ? renderTodayView() : ''}
        ${state.view === 'calendar' ? renderCalendarView() : ''}
        ${state.view === 'stats' ? renderStatsView() : ''}
        ${state.view === 'settings' ? renderSettingsView() : ''}
      </div>
      ${renderTabbar()}
      ${renderFab()}
      ${renderModals()}
      <div id="toast" class="toast"></div>
    `;
    wire();
  }

  // ---------- Topbar ----------
  function titleForMonth(d) {
    const m = RU_MON[d.getMonth()];
    const y = d.getFullYear();
    return `${capFirst(m)} ${y} г.`;
  }
  function capFirst(s){ return s[0].toUpperCase()+s.slice(1); }

  function renderTopbar() {
    let refDate = state.view==='calendar' ? state.monthCursor : state.selectedDate;
    return `
      <div class="topbar">
        <div class="row" style="justify-content:space-between;">
          <div class="row">
            ${state.view!=='today' ? `<button id="navBack" class="icon-btn" aria-label="Назад">←</button>`:''}
            <h1 id="topTitle">${titleForMonth(refDate)}</h1>
          </div>
          <div class="row">
            ${state.view!=='calendar'?``:`<button id="calPrev" class="icon-btn">←</button>`}
            ${state.view!=='calendar'?``:`<button id="calNext" class="icon-btn">→</button>`}
          </div>
        </div>
        ${state.view==='today' ? renderDateScroller() : ''}
      </div>
    `;
  }

  // ---------- Date scroller (Today) ----------
  function renderDateScroller() {
    const d0 = startDay(state.selectedDate);
    const start = addDays(d0, -3);
    const arr = Array.from({length:7},(_,i)=>addDays(start,i));
    return `
      <div id="dateScroller" class="date-scroller" aria-label="Выбор даты">
        ${arr.map(d=>{
          const active = keyFromDate(d)===keyFromDate(state.selectedDate) ? 'is-active':'';
          return `
          <button class="date-pill ${active}" data-key="${keyFromDate(d)}">
            <div class="dow">${RU_DOW[d.getDay()].toUpperCase()}</div>
            <div class="day">${d.getDate()}</div>
            <div class="mon">${capFirst(RU_MON[d.getMonth()])}</div>
          </button>`;
        }).join('')}
      </div>
    `;
  }

  // ---------- Today view ----------
  function renderTodayView() {
    return `
      <section class="view is-active" id="todayView">
        ${renderTimeline()}
        ${renderTasksBlock()}
      </section>
    `;
  }

  function renderTimeline() {
    // grid hours 06..20
    const H0 = 6, H1 = 20;
    const hours = Array.from({length:H1-H0+1}, (_,i)=>H0+i);
    const events = itemsFor(state.selectedDate).filter(x=>x.type==='event' && x.time);
    return `
      <div class="timeline-wrap">
        <div class="timeline" id="timeline">
          ${hours.map(h => `
            <div class="time-row">
              <div class="time-label">${fmt2(h)}:00</div>
            </div>
          `).join('')}
          ${events.map(e=>{
            const [hh,mm] = e.time.split(':').map(Number);
            const topMin = (hh*60+mm) - H0*60;
            const dur = Math.max(15, e.durationMin || 30);
            const hPx = (dur) * (60/60); // 60px per hour (see .time-row height)
            const tPx = (topMin) * (60/60);
            return `
              <div class="event pop" style="top:${tPx}px;height:${hPx}px" data-id="${e.id}">
                <span class="dot"></span>
                <div class="title">${escapeHTML(e.title)}</div>
                <div class="meta">с ${e.time} · ${dur} мин</div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  function renderTasksBlock() {
    const t = itemsFor(state.selectedDate).filter(x=>x.type==='task');
    return `
      <div class="tasklist-wrap">
        <div class="section-head">
          <h2>Задачи</h2>
          <div id="kpiCounter" class="muted">(${t.filter(x=>x.done).length}/${t.length})</div>
        </div>
        <ul class="task-list" id="taskList">
          ${t.map(taskRow).join('')}
        </ul>
      </div>
    `;
  }

  function taskRow(t) {
    const done = t.done ? 'task-done' : '';
    const pr = t.priority ? ` • приоритет: ${capFirst(mapPr(t.priority))}` : '';
    const tm = t.time ? t.time : '';
    return `
      <li class="task-row ${done}" data-id="${t.id}" tabindex="0">
        <div>
          <div class="title">${escapeHTML(t.title)}</div>
          <div class="meta">${tm ? tm+' ' : ''}<span class="muted">${pr}</span></div>
        </div>
        <div class="task-actions">
          <button class="icon-small icon-ok" data-act="done" title="Готово">✓</button>
          <button class="icon-small" data-act="move" title="Перенести">↔</button>
          <button class="icon-small icon-del" data-act="del" title="Удалить">🗑</button>
        </div>
      </li>
      <div class="swipe-bg"><span>Готово</span><span>Удалить</span></div>
    `;
  }

  function mapPr(p){return p==='low'?'низкий':p==='high'?'высокий':'средний'}

  // ---------- Calendar view ----------
  function renderCalendarView() {
    const d = state.monthCursor;
    const first = new Date(d.getFullYear(), d.getMonth(), 1);
    const wd = (first.getDay()+6)%7; // Mon=0
    const start = addDays(first, -wd);
    const cells = Array.from({length:42},(_,i)=>addDays(start,i));
    const selKey = keyFromDate(state.selectedDate);

    const dotsByDay = groupCountsByDate();

    return `
      <section class="view is-active" id="calendarView">
        <div class="cal-head">
          <button id="calPrev" class="icon-btn">←</button>
          <div class="month-title">${titleForMonth(d)}</div>
          <button id="calNext" class="icon-btn">→</button>
        </div>
        <div class="cal-weekdays">${['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].map(x=>`<div class="center muted">${x}</div>`).join('')}</div>
        <div class="calendar-wrap">
          <div class="calendar-grid" id="calendarGrid">
            ${cells.map(cd=>{
              const out = cd.getMonth()!==d.getMonth() ? 'is-out' : '';
              const today = keyFromDate(cd)===keyFromDate(state.today) ? 'is-today':'';
              const sel = keyFromDate(cd)===selKey ? 'is-selected':'';
              const dk = keyFromDate(cd);
              const dots = (dotsByDay.get(dk)||0);
              return `
                <button class="cal-cell ${out} ${today} ${sel}" data-key="${dk}">
                  ${cd.getDate()}
                  <div class="cal-events">
                    ${dots?Array.from({length:Math.min(3,dots)},()=>`<span class="cal-dot"></span>`).join(''):''}
                  </div>
                </button>
              `;
            }).join('')}
          </div>
        </div>
      </section>
    `;
  }

  function groupCountsByDate(){
    const m = new Map();
    state.items.forEach(it=>{
      m.set(it.dateKey, (m.get(it.dateKey)||0) + 1);
    });
    return m;
  }

  // ---------- Stats view ----------
  function renderStatsView() {
    const w = itemsInRange(addDays(state.today, -6), state.today);
    const doneW = w.filter(x=>x.done).length;
    const monthItems = itemsInMonth(state.today);
    const doneM = monthItems.filter(x=>x.done).length;
    const streak = computeStreak();

    const pct = monthItems.length ? Math.round((doneM/monthItems.length)*100) : 0;
    const dashOffset = 400*(1-pct/100);

    const byDow = Array(7).fill(0);
    w.forEach(x=>{
      const d = fromKey(x.dateKey).getDay(); // 0..6
      byDow[d] += x.done?1:0;
    });

    return `
      <section class="view is-active" id="statsView">
        <h2 style="font:800 28px Impact, Inter">Статистика</h2>
        <div class="stats-grid">
          <div class="card center">
            <div class="ring">
              <svg viewBox="0 0 140 140" aria-hidden="true">
                <circle class="ring-bg" cx="70" cy="70" r="58"></circle>
                <circle class="ring-fg" id="ringFg" cx="70" cy="70" r="58" style="stroke-dashoffset:${dashOffset}"></circle>
              </svg>
              <div class="ring-center"><div id="ringPct" class="ring-pct">${pct}%</div></div>
            </div>
            <div class="card-caption">Выполнено за месяц</div>
          </div>
          <div class="card">
            <div style="font:800 24px/1 Inter">${doneW} / ${w.length}</div>
            <div class="muted">За 7 дней</div>
          </div>
          <div class="card">
            <div style="font:800 24px/1 Inter">${doneM} / ${monthItems.length}</div>
            <div class="muted">За месяц</div>
          </div>
          <div class="card">
            <div style="font:800 24px/1 Inter">${streak}</div>
            <div class="muted">Серия выполнения</div>
          </div>
        </div>

        <div class="card" style="margin-top:12px">
          <div class="row" style="justify-content:space-between;margin-bottom:8px">
            <div class="row"><b>Выполнено по дням</b></div>
            <div class="muted">последние 7 дней</div>
          </div>
          <div id="bars" style="display:grid;grid-template-columns:repeat(7,1fr);gap:10px;align-items:end;height:120px">
            ${[1,2,3,4,5,6,0].map(d=>{ // Пн..Вс
              const v = byDow[d]||0;
              const h = clamp(v*28, 0, 110);
              return `<div style="height:${h}px;background:var(--accent);border-radius:10px;filter:var(--accentGlow)"></div>`;
            }).join('')}
          </div>
          <div class="row" style="justify-content:space-between;margin-top:8px;color:var(--muted);font-weight:700">
            ${['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].map(x=>`<span>${x}</span>`).join('')}
          </div>
        </div>
      </section>
    `;
  }

  function computeStreak(){
    // последовательные дни с хотя бы 1 выполненной задачей, назад от сегодня
    let d = state.today, s = 0;
    while(true){
      const items = itemsFor(d);
      if (items.some(x=>x.done)) { s++; d = addDays(d,-1); }
      else break;
    }
    return s;
  }

  // ---------- Settings view ----------
  function renderSettingsView() {
    const s = state.settings;
    return `
      <section class="view is-active" id="settingsView">
        <h2 style="font:800 24px Impact, Inter">Настройки</h2>
        <div class="settings">
          <div class="field">
            <div class="row"><span>Акцентный цвет</span></div>
            <input id="accentPicker" type="color" value="${s.accent}">
          </div>
          <div class="field">
            <div class="row"><span>Неон-эффект</span></div>
            <input id="neonRange" class="range" type="range" min="0" max="1" step="0.05" value="${s.neon}">
          </div>
          <div class="field">
            <div class="row"><span>Металличность</span></div>
            <input id="metalRange" class="range" type="range" min="0" max="1" step="0.05" value="${s.metallic}">
          </div>
          <div class="field">
            <div class="row"><span>Размер текста</span></div>
            <input id="fontRange" class="range" type="range" min="0.85" max="1.25" step="0.05" value="${s.fontScale}">
          </div>
        </div>
      </section>
    `;
  }

  // ---------- Tabbar & FAB ----------
  function renderTabbar() {
    return `
      <nav class="tabbar" id="tabbar" role="tablist" aria-label="Навигация">
        <button class="tab ${state.view==='today'?'is-active':''}" data-view="today" title="Список"><span class="i i-list"></span></button>
        <button class="tab ${state.view==='calendar'?'is-active':''}" data-view="calendar" title="Календарь"><span class="i i-cal"></span></button>
        <div style="width:64px"></div>
        <button class="tab ${state.view==='stats'?'is-active':''}" data-view="stats" title="Статистика"><span class="i i-bars"></span></button>
        <button class="tab ${state.view==='settings'?'is-active':''}" data-view="settings" title="Настройки"><span class="i i-gear"></span></button>
      </nav>
    `;
  }
  function renderFab() {
    return `<button id="fab" class="fab" aria-label="Добавить">+</button>`;
  }

  // ---------- Modals ----------
  function renderModals(){
    return `
      <dialog id="newModal" class="modal">
        <form method="dialog" class="modal-card stack">
          <div class="row" style="justify-content:space-between">
            <b>Новое</b>
            <button value="cancel" class="btn btn-ghost">Отмена</button>
          </div>
          <div class="row" style="gap:8px">
            <label class="btn btn-ghost"><input type="radio" name="kind" value="task" checked style="display:none">Задача</label>
            <label class="btn btn-ghost"><input type="radio" name="kind" value="event" style="display:none">Событие</label>
          </div>
          <input id="nmTitle" placeholder="Название" required class="round" style="padding:10px;border:1px solid var(--ring)">
          <div class="row" style="gap:8px">
            <input id="nmTime" type="time" value="09:00" class="round" style="padding:10px;border:1px solid var(--ring)">
            <input id="nmDuration" type="number" min="15" step="15" value="60" class="round" style="padding:10px;border:1px solid var(--ring)" title="Длительность (мин)">
            <select id="nmPriority" class="round" style="padding:10px;border:1px solid var(--ring)">
              <option value="low">низкий</option>
              <option value="medium" selected>средний</option>
              <option value="high">высокий</option>
            </select>
          </div>
          <div class="row" style="justify-content:flex-end;gap:8px">
            <button value="cancel" class="btn">Отмена</button>
            <button id="nmSave" value="ok" class="btn btn-accent">Добавить</button>
          </div>
        </form>
      </dialog>

      <dialog id="moveModal" class="modal">
        <form method="dialog" class="modal-card stack">
          <div class="row" style="justify-content:space-between">
            <b>Перенести</b>
            <button value="cancel" class="btn btn-ghost">Отмена</button>
          </div>
          <div class="row" style="gap:8px">
            <input id="mvTime" type="time" value="10:00" class="round" style="padding:10px;border:1px solid var(--ring)">
            <input id="mvDate" type="date" class="round" style="padding:10px;border:1px solid var(--ring)">
          </div>
          <div class="row" style="justify-content:flex-end;gap:8px">
            <button value="cancel" class="btn">Отмена</button>
            <button id="mvSave" value="ok" class="btn btn-accent">Сохранить</button>
          </div>
        </form>
      </dialog>
    `;
  }

  // ---------- Items helpers ----------
  function itemsFor(d) {
    const k = keyFromDate(d);
    return state.items.filter(x=>x.dateKey===k);
  }
  function itemsInRange(d1, d2){
    const k1 = +startDay(d1), k2 = +startDay(d2);
    return state.items.filter(x=>{
      const t = +fromKey(x.dateKey);
      return t>=k1 && t<=k2;
    });
  }
  function itemsInMonth(d){
    const a = new Date(d.getFullYear(), d.getMonth(), 1);
    const b = new Date(d.getFullYear(), d.getMonth()+1, 0);
    return itemsInRange(a,b);
  }

  // ---------- Wiring ----------
  function wire() {
    // Topbar
    const navBack = $('#navBack');
    if (navBack) navBack.onclick = () => { state.view='today'; render(); };

    const ds = $('#dateScroller');
    if (ds) $$('.date-pill', ds).forEach(el=>{
      el.onclick = () => { state.selectedDate = fromKey(el.dataset.key); render(); };
    });

    const calPrev = $('#calPrev'), calNext = $('#calNext');
    if (calPrev) calPrev.onclick = () => { state.monthCursor = new Date(state.monthCursor.getFullYear(), state.monthCursor.getMonth()-1, 1); render(); };
    if (calNext) calNext.onclick = () => { state.monthCursor = new Date(state.monthCursor.getFullYear(), state.monthCursor.getMonth()+1, 1); render(); };

    // Calendar cells
    const grid = $('#calendarGrid');
    if (grid) $$('.cal-cell', grid).forEach(c=>{
      c.onclick = () => { state.selectedDate = fromKey(c.dataset.key); state.view='today'; render(); };
    });

    // Task actions + swipe
    const list = $('#taskList');
    if (list) {
      $$('.task-row', list).forEach(bindTaskRow);
    }

    // Tabbar
    $$('.tab', $('#tabbar')).forEach(t=>{
      t.onclick = () => { state.view = t.dataset.view; render(); };
    });

    // FAB
    const fab = $('#fab'); if (fab) fab.onclick = openNewModal;

    // Settings controls
    const ap = $('#accentPicker'); if (ap) ap.oninput = (e)=>{ state.settings.accent=e.target.value; applyTheme(); persistCfg(); };
    const nr = $('#neonRange'); if (nr) nr.oninput = (e)=>{ state.settings.neon=parseFloat(e.target.value); applyTheme(); persistCfg(); };
    const mr = $('#metalRange'); if (mr) mr.oninput = (e)=>{ state.settings.metallic=parseFloat(e.target.value); applyTheme(); persistCfg(); };
    const fr = $('#fontRange'); if (fr) fr.oninput = (e)=>{ state.settings.fontScale=parseFloat(e.target.value); applyTheme(); persistCfg(); };

    // Date scroller: auto-center active
    if (ds) {
      const active = $('.date-pill.is-active', ds);
      if (active) {
        const dx = active.offsetLeft - ds.clientWidth/2 + active.clientWidth/2;
        ds.scrollTo({left:dx, behavior:'smooth'});
      }
    }
  }

  // Bind row interactions with safe cancel
  function bindTaskRow(li) {
    const id = li.dataset.id;
    const row = li;
    const bg = li.nextElementSibling; // swipe-bg
    let sx=0, dx=0, swiping=false;

    const reset = () => {
      row.classList.remove('swiping-left','swiping-right');
      row.style.transform=''; if(bg) bg.style.opacity='0';
    };

    row.addEventListener('pointerdown', (e)=>{
      sx = e.clientX; dx=0; swiping=true; row.setPointerCapture(e.pointerId);
    });
    row.addEventListener('pointermove', (e)=>{
      if(!swiping) return;
      dx = e.clientX - sx;
      if (Math.abs(dx)<6) return;
      if (dx>0) { row.classList.add('swiping-right'); row.classList.remove('swiping-left'); }
      else { row.classList.add('swiping-left'); row.classList.remove('swiping-right'); }
      row.style.transform = `translateX(${clamp(dx,-80,80)}px)`;
      if(bg){ bg.style.opacity='.2'; }
    });
    row.addEventListener('pointerup', ()=>{
      if (!swiping) return;
      swiping=false;
      if (dx>70) { // done
        markDone(id, true);
        toast('Готово');
      } else if (dx<-70) { // move
        openMoveModal(id, () => reset()); // on cancel/reset
      }
      reset();
    });
    row.addEventListener('pointercancel', ()=>{ swiping=false; reset(); });

    // buttons
    $$('.icon-small', row).forEach(b=>{
      const act = b.dataset.act;
      b.onclick = (ev)=>{
        ev.stopPropagation();
        if (act==='done') { markDone(id, !findItem(id).done); }
        if (act==='del') { removeItem(id); }
        if (act==='move') { openMoveModal(id, ()=>{}); }
      };
    });
  }

  // ---------- Item ops ----------
  function findItem(id){ return state.items.find(x=>x.id===id); }
  function markDone(id, v){
    const it = findItem(id); if (!it) return;
    it.done = !!v; persist(); render();
  }
  function removeItem(id){
    state.items = state.items.filter(x=>x.id!==id); persist(); render();
  }
  function createItem(obj){
    state.items.push(obj); persist(); render();
  }
  function moveItem(id, newDateKey, newTime){
    const it = findItem(id); if (!it) return;
    it.dateKey = newDateKey; if (newTime) it.time=newTime;
    persist(); render();
  }

  // ---------- Modals handlers ----------
  function openNewModal(){
    const dlg = $('#newModal'); if (!dlg) return;
    $('#nmDuration').disabled = false; // default for event, will toggle below
    dlg.showModal();

    // toggle fields by kind
    const kindInputs = $$('input[name="kind"]', dlg);
    const dur = $('#nmDuration', dlg);
    kindInputs.forEach(k=>{
      k.onchange = ()=>{
        const isEvent = k.value==='event' && k.checked;
        dur.disabled = !isEvent;
      };
    });

    $('#nmSave', dlg).onclick = (e)=>{
      e.preventDefault();
      const kind = [...kindInputs].find(x=>x.checked).value;
      const title = $('#nmTitle').value.trim();
      const time = $('#nmTime').value || null;
      const duration = parseInt($('#nmDuration').value||'0',10);
      const priority = $('#nmPriority').value;

      if (!title) return;

      const base = {
        id: uid(),
        type: kind,
        title,
        dateKey: keyFromDate(state.selectedDate),
        priority,
        done:false
      };
      if (kind==='task'){
        base.time = time;
      } else {
        base.time = time || '09:00';
        base.durationMin = duration || 60;
      }
      createItem(base);
      dlg.close();
    };
  }

  function openMoveModal(id, onCancel){
    const it = findItem(id); if (!it) return;
    const dlg = $('#moveModal'); if (!dlg) return;

    $('#mvTime').value = it.time || '10:00';
    const d = fromKey(it.dateKey);
    $('#mvDate').value = `${d.getFullYear()}-${fmt2(d.getMonth()+1)}-${fmt2(d.getDate())}`;

    dlg.showModal();

    dlg.addEventListener('close', handleClose, {once:true});
    function handleClose() {
      if (dlg.returnValue==='cancel') { onCancel && onCancel(); return; }
      const t = $('#mvTime').value || it.time;
      const dk = $('#mvDate').value || it.dateKey;
      moveItem(id, dk, t);
    }
  }

  // ---------- Toast ----------
  function toast(msg){
    const t = $('#toast'); if(!t) return;
    t.textContent = msg; t.classList.remove('show');
    // force reflow
    void t.offsetWidth;
    t.classList.add('show');
    setTimeout(()=>t.classList.remove('show'), 2300);
  }

  // ---------- Calendar arrows in topbar (today view uses selected month title) ----------
  // handled in wire()

  // ---------- Escapes ----------
  function escapeHTML(s){
    return s.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  }

})();
