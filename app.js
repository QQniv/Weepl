/* =========================================================
   WEEPL v3 — app.js (editor++ + priority colors)
   - Модалка больше, шрифты ≥16px (нет зума на iOS)
   - Сегменты важности A / B / C
   - Цвет карточки по важности (аккуратный пастельный тинт)
   - Параллакс, пружинки, быстрый аддер, редактирование/удаление
   ========================================================= */

(() => {
  const $ = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
  const grid = $('.grid-inner');
  const bg = $('.bg');
  const veil = $('.bg-veil');

  const STORAGE_KEY = 'weepl-tasks';

  /* ------------------------- UTILS ------------------------- */
  function loadTasks(){ try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; } }
  function saveTasks(arr){ localStorage.setItem(STORAGE_KEY, JSON.stringify(arr)); }
  function escapeHTML(s){ return String(s ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
  function byId(id){ return loadTasks().find(t => t.id === id); }
  function upsert(task){ const all = loadTasks(); const i = all.findIndex(t => t.id === task.id); if (i === -1) all.push(task); else all[i] = task; saveTasks(all); }
  function removeById(id){ saveTasks(loadTasks().filter(t => t.id !== id)); }

  /* --------------------- PARALLAX BACKDROP --------------------- */
  let sy = window.scrollY, vx = 0, rafId=null;
  function onScroll(){ sy = window.scrollY || window.pageYOffset; req(); }
  function onPointerMove(e){ const w = innerWidth, h = innerHeight; vx = (e.clientX / w) - .5; req(); }
  function req(){ if (!rafId) rafId = requestAnimationFrame(tick); }
  function tick(){ rafId=null; const py = -(sy * 0.03), px = vx * 10; if (bg) bg.style.transform=`translate3d(${px}px,${py}px,0)`; if (veil) veil.style.transform=`translate3d(${px*.6}px,${py*.5}px,0)`; }
  addEventListener('scroll', onScroll, {passive:true});
  addEventListener('pointermove', onPointerMove, {passive:true});
  req();

  /* --------------------- SPRING ON CARDS --------------------- */
  let cards = $$('.card'); const state = new Map(); cards.forEach(el => el.style.cursor='pointer');
  const io = new IntersectionObserver(ents=>ents.forEach(ent=>{ if(ent.isIntersecting) ent.target.classList.add('inview'); }),{threshold:.08});
  cards.forEach(c=> io.observe(c));

  function springStep(){
    const vh = innerHeight;
    for (const el of cards){
      const r = el.getBoundingClientRect();
      const norm = (r.top + r.height*0.5 - vh*0.5) / vh;
      const target = norm * 10;
      const s = state.get(el) || { y:0, vy:0 };
      const k = 0.12, d = 0.85;
      s.vy += (target - s.y) * k; s.vy *= d; s.y += s.vy;
      state.set(el, s);
      el.style.transform = `translateY(${s.y.toFixed(2)}px)`;
    }
    requestAnimationFrame(springStep);
  }
  springStep();

  /* --------------------- PRIORITY COLORS --------------------- */
  // мягкий тинт поверх панели (разный для тем)
  const LIGHT_TINT = { A:'rgba(255, 93, 93, .18)', B:'rgba(255, 195, 80, .16)', C:'rgba(120, 205, 255, .16)' };
  const DARK_TINT  = { A:'rgba(255, 93, 93, .20)', B:'rgba(255, 195, 80, .18)', C:'rgba(120, 205, 255, .20)' };

  function applyPriorityStyle(el, prio='B'){
    const theme = document.body.dataset.theme === 'dark' ? 'dark' : 'light';
    const tint = (theme === 'dark' ? DARK_TINT : LIGHT_TINT)[prio] || LIGHT_TINT.B;
    // слой-тинт + базовая панель
    el.style.background = `linear-gradient(${tint}, ${tint}), var(--panel)`;
    el.dataset.prio = prio;
    // бейдж в meta
    const badgeSel = '.meta span[data-role="prio"]';
    let badge = el.querySelector(badgeSel);
    if (!badge){
      const left = el.querySelector('.meta span:first-child');
      if (left){
        left.insertAdjacentHTML('afterbegin', `<span data-role="prio" style="display:inline-flex;align-items:center;gap:6px;margin-right:10px;font-weight:700">
          <span style="width:10px;height:10px;border-radius:50%;background:${tint.replace('.18','.9').replace('.20','.9')}"></span>${prio}
        </span>`);
      }
    } else {
      badge.lastChild.nodeValue = prio; // текст буквы
      const dot = badge.querySelector('span');
      if (dot) dot.style.background = tint.replace('.18','.9').replace('.20','.9');
    }
  }

  /* --------------------- QUICK ADD / EDITOR --------------------- */
  function ensureEditorUI(){
    if ($('#taskOverlay')) return;

    // floating + button
    const btn = document.createElement('button');
    btn.id = 'quickAddBtn';
    btn.setAttribute('aria-label','Добавить задачу');
    btn.innerHTML = '+';
    Object.assign(btn.style, {
      position:'fixed', right:'calc(16px + env(safe-area-inset-right))',
      bottom:'calc(80px + env(safe-area-inset-bottom))',
      width:'60px', height:'60px',
      borderRadius:'18px', border:'none', cursor:'pointer',
      fontSize:'30px', fontWeight:'700', lineHeight:'0',
      color:'#0f1115', background:'rgba(255,255,255,.88)',
      boxShadow:'0 12px 30px rgba(0,0,0,.18)',
      backdropFilter:'blur(10px)', WebkitBackdropFilter:'blur(10px)',
      zIndex:'30'
    });
    btn.addEventListener('click', ()=>openEditor());
    document.body.appendChild(btn);

    // overlay
    const overlay = document.createElement('div');
    overlay.id = 'taskOverlay';
    Object.assign(overlay.style, {
      position:'fixed', inset:'0', display:'none',
      alignItems:'center', justifyContent:'center',
      background:'rgba(0,0,0,.25)', zIndex:'40'
    });
    overlay.addEventListener('click', e=>{ if (e.target===overlay) closeEditor(); });

    // modal
    const modal = document.createElement('div');
    modal.id = 'taskModal';
    Object.assign(modal.style, {
      width:'min(680px, 94vw)',
      background:'var(--panel)', color:'var(--ink)',
      borderRadius:'24px',
      boxShadow:'0 18px 60px rgba(0,0,0,.25)',
      backdropFilter:'blur(20px)', WebkitBackdropFilter:'blur(20px)',
      padding:'22px'
    });
    modal.innerHTML = `
      <h3 id="tmTitle" style="margin:0 0 14px; font:600 20px/1.25 Sora, Inter, sans-serif">Новая задача</h3>
      <form id="tmForm" style="display:grid; gap:12px; font-size:16px">
        <input required id="tmInputTitle" placeholder="Заголовок"
          style="font-size:16px;padding:14px 16px;border-radius:14px;border:1px solid color-mix(in oklab, var(--ink) 10%, transparent);background:rgba(255,255,255,.68)"/>
        <input id="tmInputNote" placeholder="Описание (необязательно)"
          style="font-size:16px;padding:14px 16px;border-radius:14px;border:1px solid color-mix(in oklab, var(--ink) 10%, transparent);background:rgba(255,255,255,.68)"/>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px">
          <input id="tmInputTag"  placeholder="Тег (например, Фокус)"
            style="font-size:16px;padding:14px 16px;border-radius:14px;border:1px solid color-mix(in oklab, var(--ink) 10%, transparent);background:rgba(255,255,255,.68)"/>
          <input id="tmInputTime" placeholder="Время (напр. 14:30)"
            style="font-size:16px;padding:14px 16px;border-radius:14px;border:1px solid color-mix(in oklab, var(--ink) 10%, transparent);background:rgba(255,255,255,.68)"/>
        </div>

        <!-- PRIORITY -->
        <div>
          <div style="margin:6px 0 8px; font:600 14px/1 Inter, system-ui">Важность</div>
          <div id="tmPriority" role="tablist" aria-label="Важность" style="display:flex; gap:8px">
            ${['A','B','C'].map(letter => `
              <button type="button" data-val="${letter}" role="tab"
                style="flex:1;padding:12px 0;border:none;border-radius:12px;cursor:pointer;font:700 16px Inter,system-ui;
                       background:${letter==='A'?'rgba(255,93,93,.18)':letter==='B'?'rgba(255,195,80,.16)':'rgba(120,205,255,.16)'};">
                ${letter}
              </button>`).join('')}
          </div>
        </div>

        <div style="display:flex; gap:12px; justify-content:space-between; margin-top:10px">
          <button type="button" id="tmDelete"
            style="padding:12px 16px;border-radius:12px;border:none;background:rgba(255,82,82,.12);color:#b21;cursor:pointer;display:none">Удалить</button>
          <div style="display:flex; gap:10px">
            <button type="button" id="tmCancel"
              style="padding:12px 16px;border-radius:12px;border:none;background:rgba(255,255,255,.6);cursor:pointer">Отмена</button>
            <button type="submit" id="tmSave"
              style="padding:12px 16px;border-radius:12px;border:none;background:linear-gradient(135deg, rgba(200,182,255,.98), rgba(184,224,255,.98));font-weight:800;cursor:pointer">Сохранить</button>
          </div>
        </div>
      </form>
    `;
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // events
    $('#tmCancel').addEventListener('click', closeEditor);
    $('#tmDelete').addEventListener('click', onDelete);
    $('#tmForm').addEventListener('submit', onSave);
    // priority switch
    $('#tmPriority').addEventListener('click', e=>{
      const btn = e.target.closest('button[data-val]');
      if (!btn) return;
      setPriority(btn.dataset.val);
    });

    // hotkeys
    addEventListener('keydown', e=>{
      const overlayOpen = overlay.style.display === 'flex';
      if (e.key==='Escape' && overlayOpen) return closeEditor();
      if ((e.key==='n'||e.key==='N'||e.key==='+') && !overlayOpen) openEditor();
    });

    // default selected
    setPriority('B');
  }

  let CURRENT_ID = null;
  let CURRENT_PRIORITY = 'B';

  function setPriority(val){
    CURRENT_PRIORITY = val;
    // визуальное выделение
    $$('#tmPriority button').forEach(b=>{
      const on = b.dataset.val === val;
      b.style.outline = on ? '2px solid var(--accent)' : 'none';
      b.style.background = on
        ? (val==='A'? LIGHT_TINT.A : val==='B'? LIGHT_TINT.B : LIGHT_TINT.C)
        : (b.dataset.val==='A'? LIGHT_TINT.A : b.dataset.val==='B'? LIGHT_TINT.B : LIGHT_TINT.C);
    });
  }

  function openEditor(task){
    const overlay = $('#taskOverlay'); const title = $('#tmTitle'); const delBtn = $('#tmDelete');
    CURRENT_ID = task?.id ?? null;
    setPriority(task?.priority || 'B');

    title.textContent = CURRENT_ID ? 'Редактирование задачи' : 'Новая задача';
    delBtn.style.display = CURRENT_ID ? 'inline-block' : 'none';

    $('#tmInputTitle').value = task?.title ?? '';
    $('#tmInputNote').value  = task?.note ?? '';
    $('#tmInputTag').value   = task?.tag ?? '';
    $('#tmInputTime').value  = task?.time ?? '';

    overlay.style.display = 'flex';
    setTimeout(()=> overlay.style.opacity='1',0);
    $('#tmInputTitle').focus();
  }
  function closeEditor(){
    const overlay = $('#taskOverlay'); overlay.style.opacity='0';
    setTimeout(()=> overlay.style.display='none', 120);
    $('#tmForm').reset(); setPriority('B'); CURRENT_ID = null;
  }
  function onSave(e){
    e.preventDefault();
    const title = $('#tmInputTitle').value.trim(); if (!title) return;

    const base = CURRENT_ID ? (byId(CURRENT_ID) || {}) : {};
    const task = {
      id: CURRENT_ID || ('t' + Date.now()),
      title,
      note: $('#tmInputNote').value.trim(),
      tag : $('#tmInputTag').value.trim() || 'Задача',
      time: $('#tmInputTime').value.trim() || '',
      priority: CURRENT_PRIORITY,
      shape: base.shape || pickNextShape()
    };
    upsert(task);
    renderOrUpdate(task);
    closeEditor();
  }
  function onDelete(){
    if (!CURRENT_ID) return closeEditor();
    removeById(CURRENT_ID);
    const el = grid.querySelector(`.card[data-id="${CURRENT_ID}"]`);
    if (el) el.remove();
    closeEditor();
  }

  /* --------------------- RENDER --------------------- */
  function taskFromCardEl(el){
    return {
      id: 't' + Date.now() + Math.random().toString(36).slice(2,6),
      title: el.querySelector('h3')?.textContent.trim() || 'Без названия',
      note : el.querySelector('p')?.textContent.trim()  || '',
      tag  : el.querySelector('.meta span:nth-child(1)')?.textContent.trim() || 'Задача',
      time : el.querySelector('.meta span:nth-child(2)')?.textContent.trim() || '',
      priority: 'B',
      shape: el.classList.contains('tall') ? 'tall' :
             el.classList.contains('wide') ? 'wide' : 'square'
    };
  }

  function renderTask(task){
    const art = document.createElement('article');
    art.className = `card ${task.shape}`;
    art.tabIndex = 0; art.dataset.id = task.id; art.style.cursor='pointer';
    art.innerHTML = `
      <div>
        <h3>${escapeHTML(task.title)}</h3>
        <p>${escapeHTML(task.note)}</p>
      </div>
      <div class="meta"><span>${escapeHTML(task.tag)}</span><span>${escapeHTML(task.time)}</span></div>
    `;
    grid.appendChild(art); cards.push(art); io.observe(art);
    applyPriorityStyle(art, task.priority || 'B');
    art.addEventListener('click', ()=> openEditor(task));
  }

  function renderOrUpdate(task){
    let el = grid.querySelector(`.card[data-id="${task.id}"]`);
    if (!el){ renderTask(task); return; }
    el.querySelector('h3').textContent = task.title;
    el.querySelector('p').textContent  = task.note;
    const spans = el.querySelectorAll('.meta span');
    if (spans[0]) spans[0].textContent = task.tag;
    if (spans[1]) spans[1].textContent = task.time;
    applyPriorityStyle(el, task.priority || 'B');
  }

  // делегирование кликов: демо-карточки → в storage
  grid.addEventListener('click', (e)=>{
    const card = e.target.closest('.card'); if (!card) return;
    const id = card.dataset.id;
    if (id){ openEditor(byId(id)); }
    else {
      const t = taskFromCardEl(card); upsert(t); card.dataset.id = t.id;
      applyPriorityStyle(card, t.priority); openEditor(t);
    }
  });

  /* --------------------- BOOT --------------------- */
  function ensureUI(){ ensureEditorUI(); }
  let shapeIdx = 0; function pickNextShape(){ return ['square','tall','wide'][ (shapeIdx++) % 3 ]; }

  function boot(){
    ensureUI();
    const stored = loadTasks();
    if (stored.length){
      stored.forEach(t=>{
        const maybe = [...$$('.card')].find(el => !el.dataset.id && (el.querySelector('h3')?.textContent.trim() === t.title));
        if (maybe){ maybe.dataset.id = t.id; renderOrUpdate(t); }
        else { renderTask(t); }
      });
    } else {
      // проставим базовый приоритет демо-карточкам
      $$('.card').forEach(el=> applyPriorityStyle(el, 'B'));
    }
  }

  /* --------------------- AI TIP (как было) --------------------- */
  const tips = [
    'Заверши энергозатратные задачи до обеда — окно фокуса выше на 18–25%.',
    'Планируй «глубокую работу» блоками по 50–90 минут, между ними — 10–15 минут разгрузки.',
    'Спроси себя «что сдвинет проект сильнее всего?» и сделай это первым.',
    'Отключи уведомления на 45 минут — вероятность прерываний падает вдвое.',
    'Запиши 3 задачи дня. Остальное — в бэклог. Чёткие границы уменьшают прокрастинацию.',
    'Сложное разбей на микрошаги по 5–10 минут — стартовать всегда легче.',
    'Подготовь завтра сегодня: 5 минут вечером экономят 20 утром.',
    'Планируй созвоны во второй половине дня — у утреннего мозга выше креативность.',
    'Оцени «стоимость контекста»: сгруппируй похожие задачи в один слот.',
    'Выбери «анти-задачу»: что НЕ делать сегодня, чтобы сохранить фокус.'
  ];
  const aiText = $('#aiText'), aiTip = $('#aiTip');
  function seedIndex(){ const saved = localStorage.getItem('weepl-tip-index'); if (saved !== null) return parseInt(saved,10);
    const d=new Date(); const key=d.getFullYear()*10000+(d.getMonth()+1)*100+d.getDate(); return key % tips.length; }
  let tipIndex = seedIndex();
  function renderTip(){ if (aiText) aiText.textContent = 'AI-совет: ' + tips[tipIndex]; localStorage.setItem('weepl-tip-index', String(tipIndex)); }
  renderTip();
  aiTip?.addEventListener('click', ()=>{ tipIndex = (tipIndex+1)%tips.length; aiTip.style.opacity=.85; setTimeout(()=> aiTip.style.opacity=1,160); renderTip(); });

  // init
  boot();

})();
