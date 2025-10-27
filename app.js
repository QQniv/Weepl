/* Weepl App — stable build v1.6.2 */

(() => {
  // ---------- tiny utils ----------
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const z2 = n => String(n).padStart(2,'0');
  const keyOf = d => `${d.getFullYear()}-${z2(d.getMonth()+1)}-${z2(d.getDate())}`;
  const fromKey = k => { const [Y,M,D]=k.split('-').map(Number); return new Date(Y,M-1,D); };
  const startDay = d => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const addDays = (d,n) => new Date(d.getFullYear(), d.getMonth(), d.getDate()+n);
  const clamp = (n,a,b) => Math.max(a, Math.min(b,n));
  const RU_MON = ["янв.","февр.","март","апр.","май","июнь","июль","авг.","сент.","окт.","нояб.","дек."];
  const RU_DOW = ["вс","пн","вт","ср","чт","пт","сб"];
  const cap = s => s[0].toUpperCase()+s.slice(1);
  const esc = s => s.replace(/[&<>"']/g, m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m]));

  // ---------- state ----------
  const state = {
    today: startDay(new Date()),
    selectedDate: startDay(new Date()),
    monthCursor: startDay(new Date()),
    items: [],
    settings: {
      accent: readVar('--accent') || '#5b5bf0',
      neon: parseFloat(readVar('--neon')) || 0,
      metallic: parseFloat(readVar('--metallic')) || 0,
      fontScale: parseFloat(readVar('--fontScale')) || 1
    },
    view: 'today'
  };

  // ---------- storage ----------
  const STORE = 'weepl_store_v1';
  const CFG = 'weepl_cfg_v1';

  try {
    const raw = localStorage.getItem(STORE);
    if (raw) {
      const data = JSON.parse(raw);
      if (data.selectedDate) state.selectedDate = fromKey(data.selectedDate);
      if (data.monthCursor) state.monthCursor = fromKey(data.monthCursor);
      if (Array.isArray(data.items)) state.items = data.items;
    }
    const cfg = localStorage.getItem(CFG);
    if (cfg) Object.assign(state.settings, JSON.parse(cfg));
  } catch(e){ console.warn('load fail', e); }

  applyTheme();

  if (!state.items.length) {
    const k = keyOf(state.today);
    state.items.push(
      {id:uid(), type:'task', title:'Сыграть в волейбол', dateKey:k, time:'18:30', priority:'medium', done:false},
      {id:uid(), type:'task', title:'Пукнуть вовремя',    dateKey:k, time:'21:00', priority:'medium', done:false},
      {id:uid(), type:'event',title:'Учёба',             dateKey:k, time:'10:00', durationMin:90, priority:'low', done:false},
      {id:uid(), type:'event',title:'Тренировка',        dateKey:k, time:'19:00', durationMin:60, priority:'high',done:false},
    );
    persist();
  }

  const root = $('#viewContainer');
  if (!root) { console.error('no #viewContainer'); return; }

  render();

  // ---------- render ----------
  function render(){
    root.innerHTML = `
      <div class="container">
        ${renderTopbar()}
        ${state.view==='today' ? renderToday() : ''}
        ${state.view==='calendar' ? renderCalendar() : ''}
        ${state.view==='stats' ? renderStats() : ''}
        ${state.view==='settings' ? renderSettings() : ''}
      </div>
      ${renderTabbar()}
      <button id="fab" class="fab" aria-label="Добавить">+</button>
      ${renderModals()}
      <div id="toast" class="toast"></div>
    `;
    bind();
  }

  function titleMonth(d){
    return `${cap(RU_MON[d.getMonth()])} ${d.getFullYear()} г.`;
  }

  function renderTopbar(){
    const ref = state.view==='calendar' ? state.monthCursor : state.selectedDate;
    return `
      <div class="topbar">
        <div class="row" style="justify-content:space-between;">
          <div class="row">
            ${state.view!=='today' ? `<button id="navBack" class="icon-btn" aria-label="Назад">←</button>` : ''}
            <h1 id="topTitle">${titleMonth(ref)}</h1>
          </div>
          ${state.view==='calendar' ? `
            <div class="row">
              <button id="calPrev" class="icon-btn">←</button>
              <button id="calNext" class="icon-btn">→</button>
            </div>` : `<span></span>`
          }
        </div>
        ${state.view==='today' ? renderScroller() : ''}
      </div>
    `;
  }

  function renderScroller(){
    const around = Array.from({length:7},(_,i)=>addDays(state.selectedDate,-3+i));
    return `
      <div id="dateScroller" class="date-scroller" aria-label="Выбор даты">
        ${around.map(d=>{
          const a = keyOf(d)===keyOf(state.selectedDate) ? 'is-active':'';
          return `
            <button class="date-pill ${a}" data-key="${keyOf(d)}">
              <div class="dow">${RU_DOW[d.getDay()].toUpperCase()}</div>
              <div class="day">${d.getDate()}</div>
              <div class="mon">${cap(RU_MON[d.getMonth()])}</div>
            </button>
          `;
        }).join('')}
      </div>
    `;
  }

  function renderToday(){
    return `
      <section class="view is-active" id="todayView">
        ${renderTimeline()}
        ${renderTaskList()}
      </section>
    `;
  }

  function renderTimeline(){
    const H0=6, H1=20;
    const hours = Array.from({length:H1-H0+1},(_,i)=>H0+i);
    const evs = itemsFor(state.selectedDate).filter(x=>x.type==='event' && x.time);
    return `
      <div class="timeline-wrap">
        <div class="timeline" id="timeline">
          ${hours.map(h=>`
            <div class="time-row"><div class="time-label">${z2(h)}:00</div></div>
          `).join('')}
          ${evs.map(e=>{
            const [hh,mm] = e.time.split(':').map(Number);
            const topMin = (hh*60+mm) - H0*60;
            const dur = Math.max(15, e.durationMin||30);
            const h = dur; // 1px = 1 мин (см. CSS: .time-row {height:60px} => 60мин=60px)
            const t = topMin;
            return `
              <div class="event pop" style="top:${t}px;height:${h}px" data-id="${e.id}">
                <span class="dot"></span>
                <div class="title">${esc(e.title)}</div>
                <div class="meta">с ${e.time} · ${dur} мин</div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  function renderTaskList(){
    const list = itemsFor(state.selectedDate).filter(x=>x.type==='task');
    return `
      <div class="tasklist-wrap">
        <div class="section-head">
          <h2>Задачи</h2>
          <div id="kpiCounter" class="muted">(${list.filter(x=>x.done).length}/${list.length})</div>
        </div>
        <ul class="task-list" id="taskList">
          ${list.map(taskRow).join('')}
        </ul>
      </div>
    `;
  }

  function taskRow(t){
    const done = t.done ? 'task-done':'';
    const prText = t.priority ? ` • приоритет: ${mapPr(t.priority)}`:'';
    const tm = t.time ? t.time+' ' : '';
    return `
      <li class="task-row ${done}" data-id="${t.id}" tabindex="0">
        <div>
          <div class="title">${esc(t.title)}</div>
          <div class="meta">${tm}<span class="muted">${prText}</span></div>
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

  function renderCalendar(){
    const d = state.monthCursor;
    const first = new Date(d.getFullYear(), d.getMonth(), 1);
    const wd = (first.getDay()+6)%7; // Mon=0
    const start = addDays(first, -wd);
    const cells = Array.from({length:42},(_,i)=>addDays(start,i));
    const sel = keyOf(state.selectedDate);
    const byCount = countsByDate();

    return `
      <section class="view is-active" id="calendarView">
        <div class="cal-head">
          <button id="calPrev" class="icon-btn">←</button>
          <div class="month-title">${titleMonth(d)}</div>
          <button id="calNext" class="icon-btn">→</button>
        </div>
        <div class="cal-weekdays">${['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].map(w=>`<div class="center muted">${w}</div>`).join('')}</div>
        <div class="calendar-wrap">
          <div class="calendar-grid" id="calendarGrid">
            ${cells.map(cd=>{
              const out = cd.getMonth()!==d.getMonth() ? 'is-out':'';
              const today = keyOf(cd)===keyOf(state.today) ? 'is-today':'';
              const active = keyOf(cd)===sel ? 'is-selected':'';
              const k = keyOf(cd);
              const dots = byCount.get(k)||0;
              return `
                <button class="cal-cell ${out} ${today} ${active}" data-key="${k}">
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

  function countsByDate(){
    const m = new Map();
    state.items.forEach(it=> m.set(it.dateKey,(m.get(it.dateKey)||0)+1) );
    return m;
  }

  function renderStats(){
    const last7 = inRange(addDays(state.today,-6), state.today);
    const done7 = last7.filter(x=>x.done).length;
    const month = inMonth(state.today);
    const doneM = month.filter(x=>x.done).length;
    const pct = month.length ? Math.round(doneM/month.length*100) : 0;
    const dash = 400*(1-pct/100);
    const streak = calcStreak();

    const byDow = Array(7).fill(0);
    last7.forEach(x => { byDow[fromKey(x.dateKey).getDay()] += x.done?1:0; });

    return `
      <section class="view is-active" id="statsView">
        <h2 style="font:800 28px Impact, Inter">Статистика</h2>
        <div class="stats-grid">
          <div class="card center">
            <div class="ring">
              <svg viewBox="0 0 140 140" aria-hidden="true">
                <circle class="ring-bg" cx="70" cy="70" r="58"></circle>
                <circle class="ring-fg" id="ringFg" cx="70" cy="70" r="58" style="stroke-dashoffset:${dash}"></circle>
              </svg>
              <div class="ring-center"><div id="ringPct" class="ring-pct">${pct}%</div></div>
            </div>
            <div class="card-caption">Выполнено за месяц</div>
          </div>
          <div class="card"><div style="font:800 24px/1 Inter">${done7} / ${last7.length}</div><div class="muted">За 7 дней</div></div>
          <div class="card"><div style="font:800 24px/1 Inter">${doneM} / ${month.length}</div><div class="muted">За месяц</div></div>
          <div class="card"><div style="font:800 24px/1 Inter">${streak}</div><div class="muted">Серия выполнения</div></div>
        </div>

        <div class="card" style="margin-top:12px">
          <div class="row" style="justify-content:space-between;margin-bottom:8px">
            <b>Выполнено по дням</b><span class="muted">последние 7 дней</span>
          </div>
          <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:10px;align-items:end;height:120px">
            ${[1,2,3,4,5,6,0].map(d=>{ const v=byDow[d]||0; const h=clamp(v*28,0,110); return `<div style="height:${h}px;background:var(--accent);border-radius:10px;filter:var(--accentGlow)"></div>`; }).join('')}
          </div>
          <div class="row" style="justify-content:space-between;margin-top:8px;color:var(--muted);font-weight:700">
            ${['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].map(x=>`<span>${x}</span>`).join('')}
          </div>
        </div>
      </section>
    `;
  }

  function calcStreak(){
    let d = state.today, s=0;
    while (true){
      const arr = itemsFor(d);
      if (arr.some(x=>x.done)) { s++; d=addDays(d,-1); } else break;
    }
    return s;
  }

  function renderSettings(){
    const s = state.settings;
    return `
      <section class="view is-active" id="settingsView">
        <h2 style="font:800 24px Impact, Inter">Настройки</h2>
        <div class="settings">
          <div class="field"><span>Акцентный цвет</span><input id="accentPicker" type="color" value="${s.accent}"></div>
          <div class="field"><span>Неон-эффект</span><input id="neonRange" class="range" type="range" min="0" max="1" step="0.05" value="${s.neon}"></div>
          <div class="field"><span>Металличность</span><input id="metalRange" class="range" type="range" min="0" max="1" step="0.05" value="${s.metallic}"></div>
          <div class="field"><span>Размер текста</span><input id="fontRange" class="range" type="range" min="0.85" max="1.25" step="0.05" value="${s.fontScale}"></div>
        </div>
      </section>
    `;
  }

  function renderTabbar(){
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

  function renderModals(){
    return `
      <dialog id="newModal" class="modal">
        <form method="dialog" class="modal-card stack">
          <div class="row" style="justify-content:space-between"><b>Новое</b><button value="cancel" class="btn btn-ghost">Отмена</button></div>
          <div class="row" style="gap:8px">
            <label class="btn btn-ghost"><input type="radio" name="kind" value="task" checked style="display:none">Задача</label>
            <label class="btn btn-ghost"><input type="radio" name="kind" value="event" style="display:none">Событие</label>
          </div>
          <input id="nmTitle" placeholder="Название" required class="round" style="padding:10px;border:1px solid var(--ring)">
          <div class="row" style="gap:8px">
            <input id="nmTime" type="time" value="09:00" class="round" style="padding:10px;border:1px solid var(--ring)">
            <input id="nmDuration" type="number" min="15" step="15" value="60" class="round" style="padding:10px;border:1px solid var(--ring)" title="Длительность (мин)">
            <select id="nmPriority" class="round" style="padding:10px;border:1px solid var(--ring)">
              <option value="low">низкий</option><option value="medium" selected>средний</option><option value="high">высокий</option>
            </select>
          </div>
          <div class="row" style="justify-content:flex-end;gap:8px"><button value="cancel" class="btn">Отмена</button><button id="nmSave" value="ok" class="btn btn-accent">Добавить</button></div>
        </form>
      </dialog>

      <dialog id="moveModal" class="modal">
        <form method="dialog" class="modal-card stack">
          <div class="row" style="justify-content:space-between"><b>Перенести</b><button value="cancel" class="btn btn-ghost">Отмена</button></div>
          <div class="row" style="gap:8px">
            <input id="mvTime" type="time" value="10:00" class="round" style="padding:10px;border:1px solid var(--ring)">
            <input id="mvDate" type="date" class="round" style="padding:10px;border:1px solid var(--ring)">
          </div>
          <div class="row" style="justify-content:flex-end;gap:8px"><button value="cancel" class="btn">Отмена</button><button id="mvSave" value="ok" class="btn btn-accent">Сохранить</button></div>
        </form>
      </dialog>
    `;
  }

  // ---------- bind ----------
  function bind(){
    // back
    const back = $('#navBack'); if (back) back.onclick = ()=>{ state.view='today'; render(); };

    // scroller
    const sc = $('#dateScroller');
    if (sc) {
      $$('.date-pill', sc).forEach(b=> b.onclick = ()=>{ state.selectedDate = fromKey(b.dataset.key); render(); });
      const act = $('.date-pill.is-active', sc);
      if (act) sc.scrollTo({ left: act.offsetLeft - sc.clientWidth/2 + act.clientWidth/2, behavior:'smooth' });
    }

    // calendar
    const cp = $('#calPrev'), cn = $('#calNext');
    if (cp) cp.onclick = ()=>{ state.monthCursor = new Date(state.monthCursor.getFullYear(), state.monthCursor.getMonth()-1, 1); render(); };
    if (cn) cn.onclick = ()=>{ state.monthCursor = new Date(state.monthCursor.getFullYear(), state.monthCursor.getMonth()+1, 1); render(); };
    const grid = $('#calendarGrid');
    if (grid) $$('.cal-cell', grid).forEach(c => c.onclick = ()=>{ state.selectedDate = fromKey(c.dataset.key); state.view='today'; render(); });

    // tasks swipe + buttons
    const list = $('#taskList');
    if (list) $$('.task-row', list).forEach(rowBind);

    // tabbar
    $$('.tab', $('#tabbar')).forEach(t => t.onclick = ()=>{ state.view=t.dataset.view; render(); });

    // fab
    const fab = $('#fab'); if (fab) fab.onclick = openNew;

    // settings
    const ap = $('#accentPicker'); if (ap) ap.oninput = e=>{ state.settings.accent=e.target.value; applyTheme(); saveCfg(); };
    const nr = $('#neonRange');    if (nr) nr.oninput = e=>{ state.settings.neon=parseFloat(e.target.value); applyTheme(); saveCfg(); };
    const mr = $('#metalRange');   if (mr) mr.oninput = e=>{ state.settings.metallic=parseFloat(e.target.value); applyTheme(); saveCfg(); };
    const fr = $('#fontRange');    if (fr) fr.oninput = e=>{ state.settings.fontScale=parseFloat(e.target.value); applyTheme(); saveCfg(); };
  }

  function rowBind(li){
    const id = li.dataset.id;
    const bg = li.nextElementSibling;
    let sx=0, dx=0, sw=false;

    const reset = ()=>{ li.classList.remove('swiping-left','swiping-right'); li.style.transform=''; if(bg) bg.style.opacity='0'; };

    li.addEventListener('pointerdown', e=>{ sx=e.clientX; dx=0; sw=true; li.setPointerCapture(e.pointerId); });
    li.addEventListener('pointermove', e=>{
      if(!sw) return;
      dx = e.clientX - sx;
      if (Math.abs(dx)<6) return;
      if (dx>0){ li.classList.add('swiping-right'); li.classList.remove('swiping-left'); }
      else     { li.classList.add('swiping-left');  li.classList.remove('swiping-right'); }
      li.style.transform = `translateX(${clamp(dx,-80,80)}px)`; if(bg) bg.style.opacity='.2';
    });
    li.addEventListener('pointerup', ()=>{
      if(!sw) return; sw=false;
      if (dx>70){ toggleDone(id,true); toast('Готово'); reset(); }
      else if (dx<-70){ openMove(id, reset); }
      else reset();
    });
    li.addEventListener('pointercancel', ()=>{ sw=false; reset(); });

    $$('.icon-small', li).forEach(b=>{
      const act=b.dataset.act;
      b.onclick = (ev)=>{ ev.stopPropagation();
        if (act==='done') toggleDone(id, !find(id).done);
        if (act==='del')  del(id);
        if (act==='move') openMove(id, ()=>{});
      };
    });
  }

  // ---------- items ----------
  function itemsFor(d){ return state.items.filter(x=>x.dateKey===keyOf(d)); }
  function inRange(a,b){ const t1=+startDay(a), t2=+startDay(b); return state.items.filter(x=>{ const t=+fromKey(x.dateKey); return t>=t1 && t<=t2; }); }
  function inMonth(d){ return inRange(new Date(d.getFullYear(),d.getMonth(),1), new Date(d.getFullYear(),d.getMonth()+1,0)); }
  function find(id){ return state.items.find(x=>x.id===id); }
  function toggleDone(id,v){ const it=find(id); if(!it) return; it.done=!!v; persist(); render(); }
  function del(id){ state.items = state.items.filter(x=>x.id!==id); persist(); render(); }
  function add(obj){ state.items.push(obj); persist(); render(); }
  function move(id, dk, t){ const it=find(id); if(!it) return; it.dateKey=dk; if(t) it.time=t; persist(); render(); }

  // ---------- modals ----------
  function openNew(){
    const d = $('#newModal'); d.showModal();
    const kind = $$('input[name="kind"]', d);
    const dur = $('#nmDuration', d);
    kind.forEach(k=>k.onchange = ()=>{ dur.disabled = !(k.checked && k.value==='event'); });
    $('#nmSave', d).onclick = (e)=>{
      e.preventDefault();
      const k = [...kind].find(x=>x.checked).value;
      const title = $('#nmTitle').value.trim();
      const time = $('#nmTime').value || null;
      const duration = parseInt($('#nmDuration').value||'0',10);
      const pr = $('#nmPriority').value;
      if(!title) return;
      const base = { id:uid(), type:k, title, dateKey:keyOf(state.selectedDate), priority:pr, done:false };
      if (k==='task'){ base.time = time; }
      else { base.time = time||'09:00'; base.durationMin = duration||60; }
      add(base);
      d.close();
    };
  }

  function openMove(id, onCancel){
    const it = find(id); if(!it) return;
    const d = $('#moveModal');
    $('#mvTime').value = it.time || '10:00';
    const dt = fromKey(it.dateKey);
    $('#mvDate').value = `${dt.getFullYear()}-${z2(dt.getMonth()+1)}-${z2(dt.getDate())}`;
    d.showModal();
    d.addEventListener('close', handler, {once:true});
    function handler(){
      if (d.returnValue==='cancel'){ onCancel&&onCancel(); return; } // фикс: не удаляем, просто откатываем свайп
      move(id, $('#mvDate').value || it.dateKey, $('#mvTime').value || it.time);
    }
  }

  // ---------- theme ----------
  function readVar(name){ return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }
  function setVar(name,val){ document.documentElement.style.setProperty(name,String(val)); }
  function applyTheme(){ setVar('--accent',state.settings.accent); setVar('--neon',state.settings.neon); setVar('--metallic',state.settings.metallic); setVar('--fontScale',state.settings.fontScale); }
  function saveCfg(){ localStorage.setItem(CFG, JSON.stringify(state.settings)); }

  // ---------- persist ----------
  function persist(){
    localStorage.setItem(STORE, JSON.stringify({
      selectedDate: keyOf(state.selectedDate),
      monthCursor: keyOf(state.monthCursor),
      items: state.items,
      settings: state.settings
    }));
  }

  // ---------- ids ----------
  function uid(){ return (Math.random().toString(36).slice(2,9)+Date.now().toString(36)).slice(-12); }

})();
