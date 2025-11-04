/* =========================================================
   WEEPL v3 — app.js (click-to-edit)
   - Параллакс фона + pointer tilt
   - Пружинка карточек
   - Быстрый аддер задач (localStorage)
   - Клик по карточке = просмотр/редактирование/удаление
   - Автосидинг: демо-карточки из HTML попадают в storage
   ========================================================= */

(() => {
  const $ = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));

  const grid = $('.grid-inner');
  const bg = $('.bg');
  const veil = $('.bg-veil');

  const STORAGE_KEY = 'weepl-tasks';

  /* -------------------------
     UTILS
  ------------------------- */
  function loadTasks(){
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
    catch { return []; }
  }
  function saveTasks(arr){ localStorage.setItem(STORAGE_KEY, JSON.stringify(arr)); }
  function escapeHTML(s){
    return String(s ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  }
  function byId(id){ return loadTasks().find(t => t.id === id); }
  function upsert(task){
    const all = loadTasks();
    const i = all.findIndex(t => t.id === task.id);
    if (i === -1) all.push(task); else all[i] = task;
    saveTasks(all);
  }
  function removeById(id){
    saveTasks(loadTasks().filter(t => t.id !== id));
  }

  /* -------------------------
     1) PARALLAX BACKDROP
  ------------------------- */
  let sy = window.scrollY, vx = 0, vy = 0, rafId=null;
  function onScroll(){ sy = window.scrollY || window.pageYOffset; req(); }
  function onPointerMove(e){
    const w = innerWidth, h = innerHeight;
    vx = (e.clientX / w) - .5; vy = (e.clientY / h) - .5; req();
  }
  function req(){ if (!rafId) rafId = requestAnimationFrame(tick); }
  function tick(){ rafId=null;
    const py = -(sy * 0.03), px = vx * 10;
    if (bg)   bg.style.transform   = `translate3d(${px}px, ${py}px, 0)`;
    if (veil) veil.style.transform = `translate3d(${px*.6}px, ${py*.5}px, 0)`;
  }
  addEventListener('scroll', onScroll, {passive:true});
  addEventListener('pointermove', onPointerMove, {passive:true});
  req();

  /* -------------------------
     2) CARDS SPRING
  ------------------------- */
  let cards = $$('.card');
  const state = new Map();
  cards.forEach(el => el.style.cursor='pointer');

  const io = new IntersectionObserver(ents=>{
    ents.forEach(ent => { if (ent.isIntersecting) ent.target.classList.add('inview'); });
  }, {threshold:.08});
  cards.forEach(c=> io.observe(c));

  function springStep(){
    const vh = innerHeight;
    for (const el of cards){
      const r = el.getBoundingClientRect();
      const norm = (r.top + r.height*0.5 - vh*0.5) / vh;
      const target = norm * 10;
      const s = state.get(el) || { y:0, vy:0 };
      const k = 0.12, d = 0.85;
      s.vy += (target - s.y) * k;
      s.vy *= d;
      s.y += s.vy;
      state.set(el, s);
      el.style.transform = `translateY(${s.y.toFixed(2)}px)`;
    }
    requestAnimationFrame(springStep);
  }
  springStep();

  /* -------------------------
     3) QUICK ADD UI + EDIT MODAL
  ------------------------- */
  function ensureModals(){
    if ($('#quickAddBtn')) return;

    // floating add
    const btn = document.createElement('button');
    btn.id = 'quickAddBtn';
    btn.setAttribute('aria-label','Добавить задачу');
    btn.innerHTML = '+';
    Object.assign(btn.style, {
      position:'fixed', right:'calc(16px + env(safe-area-inset-right))',
      bottom:'calc(80px + env(safe-area-inset-bottom))',
      width:'56px', height:'56px',
      borderRadius:'16px', border:'none', cursor:'pointer',
      fontSize:'28px', fontWeight:'700', lineHeight:'0',
      color:'#0f1115', background:'rgba(255,255,255,.85)',
      boxShadow:'0 12px 30px rgba(0,0,0,.18)',
      backdropFilter:'blur(10px)', WebkitBackdropFilter:'blur(10px)',
      zIndex:'30'
    });
    btn.addEventListener('click', ()=>openEditor());
    document.body.appendChild(btn);

    // shared overlay + modal (add/edit)
    const overlay = document.createElement('div');
    overlay.id = 'taskOverlay';
    Object.assign(overlay.style, {
      position:'fixed', inset:'0', display:'none',
      alignItems:'center', justifyContent:'center',
      background:'rgba(0,0,0,.25)', zIndex:'40'
    });
    overlay.addEventListener('click', e => { if (e.target===overlay) closeEditor(); });

    const modal = document.createElement('div');
    modal.id = 'taskModal';
    Object.assign(modal.style, {
      width:'min(560px, 92vw)',
      background:'var(--panel)', color:'var(--ink)',
      borderRadius:'22px',
      boxShadow:'0 18px 60px rgba(0,0,0,.25)',
      backdropFilter:'blur(18px)', WebkitBackdropFilter:'blur(18px)',
      padding:'18px'
    });
    modal.innerHTML = `
      <h3 id="tmTitle" style="margin:0 0 10px; font:600 18px/1.2 Sora, Inter, sans-serif">Новая задача</h3>
      <form id="tmForm" style="display:grid; gap:10px">
        <input required id="tmInputTitle" placeholder="Заголовок" style="padding:12px 14px;border-radius:14px;border:1px solid color-mix(in oklab, var(--ink) 10%, transparent);background:rgba(255,255,255,.6)"/>
        <input id="tmInputNote" placeholder="Описание (необязательно)" style="padding:12px 14px;border-radius:14px;border:1px solid color-mix(in oklab, var(--ink) 10%, transparent);background:rgba(255,255,255,.6)"/>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px">
          <input id="tmInputTag"  placeholder="Тег (например, Фокус)" style="padding:12px 14px;border-radius:14px;border:1px solid color-mix(in oklab, var(--ink) 10%, transparent);background:rgba(255,255,255,.6)"/>
          <input id="tmInputTime" placeholder="Время (напр. 14:30)" style="padding:12px 14px;border-radius:14px;border:1px solid color-mix(in oklab, var(--ink) 10%, transparent);background:rgba(255,255,255,.6)"/>
        </div>
        <div style="display:flex; gap:10px; justify-content:space-between; margin-top:8px">
          <button type="button" id="tmDelete" style="padding:10px 14px;border-radius:12px;border:none;background:rgba(255,82,82,.12);color:#b21;cursor:pointer;display:none">Удалить</button>
          <div style="display:flex; gap:10px">
            <button type="button" id="tmCancel" style="padding:10px 14px;border-radius:12px;border:none;background:rgba(255,255,255,.6);cursor:pointer">Отмена</button>
            <button type="submit" id="tmSave" style="padding:10px 14px;border-radius:12px;border:none;background:linear-gradient(135deg, rgba(200,182,255,.98), rgba(184,224,255,.98));font-weight:700;cursor:pointer">Сохранить</button>
          </div>
        </div>
      </form>
    `;
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    $('#tmCancel').addEventListener('click', closeEditor);
    $('#tmDelete').addEventListener('click', onDelete);
    $('#tmForm').addEventListener('submit', onSave);
    addEventListener('keydown', e=>{
      if (e.key==='Escape') closeEditor();
      if ((e.key==='n'||e.key==='N'||e.key==='+') && overlay.style.display!=='flex') openEditor();
    });
  }

  let CURRENT_ID = null; // null -> add mode

  function openEditor(task){
    const overlay = $('#taskOverlay');
    const title = $('#tmTitle');
    const delBtn = $('#tmDelete');

    CURRENT_ID = task?.id ?? null;
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
    const overlay = $('#taskOverlay');
    overlay.style.opacity='0';
    setTimeout(()=> overlay.style.display='none', 120);
    $('#tmForm').reset();
    CURRENT_ID = null;
  }
  function onSave(e){
    e.preventDefault();
    const title = $('#tmInputTitle').value.trim();
    if (!title) return;

    const base = CURRENT_ID ? (byId(CURRENT_ID) || {}) : {};
    const task = {
      id: CURRENT_ID || ('t' + Date.now()),
      title,
      note: $('#tmInputNote').value.trim(),
      tag : $('#tmInputTag').value.trim() || 'Задача',
      time: $('#tmInputTime').value.trim() || '',
      shape: base.shape || pickNextShape()
    };
    upsert(task);
    renderOrUpdate(task);
    closeEditor();
  }
  function onDelete(){
    if (!CURRENT_ID) return closeEditor();
    removeById(CURRENT_ID);
    // удалить из DOM
    const el = grid.querySelector(`.card[data-id="${CURRENT_ID}"]`);
    if (el) el.remove();
    closeEditor();
  }

  /* -------------------------
     4) RENDER
  ------------------------- */
  function taskFromCardEl(el){
    return {
      id: 't' + Date.now() + Math.random().toString(36).slice(2,6),
      title: el.querySelector('h3')?.textContent.trim() || 'Без названия',
      note : el.querySelector('p')?.textContent.trim()  || '',
      tag  : el.querySelector('.meta span:nth-child(1)')?.textContent.trim() || 'Задача',
      time : el.querySelector('.meta span:nth-child(2)')?.textContent.trim() || '',
      shape: el.classList.contains('tall') ? 'tall' :
             el.classList.contains('wide') ? 'wide' : 'square'
    };
  }

  function renderTask(task){
    const art = document.createElement('article');
    art.className = `card ${task.shape}`;
    art.tabIndex = 0;
    art.dataset.id = task.id;
    art.style.cursor = 'pointer';
    art.innerHTML = `
      <div>
        <h3>${escapeHTML(task.title)}</h3>
        <p>${escapeHTML(task.note)}</p>
      </div>
      <div class="meta"><span>${escapeHTML(task.tag)}</span><span>${escapeHTML(task.time)}</span></div>
    `;
    grid.appendChild(art);
    cards.push(art);
    io.observe(art);
    // клик для редактирования
    art.addEventListener('click', ()=>{
      openEditor(task);
    });
  }

  function renderOrUpdate(task){
    let el = grid.querySelector(`.card[data-id="${task.id}"]`);
    if (!el){ renderTask(task); return; }
    el.querySelector('h3').textContent = task.title;
    el.querySelector('p').textContent  = task.note;
    const spans = el.querySelectorAll('.meta span');
    if (spans[0]) spans[0].textContent = task.tag;
    if (spans[1]) spans[1].textContent = task.time;
  }

  // Делегирование кликов для карточек без id (сидим демо)
  grid.addEventListener('click', (e)=>{
    const card = e.target.closest('.card');
    if (!card) return;
    const id = card.dataset.id;
    if (id){
      const t = byId(id);
      openEditor(t);
    } else {
      // впервые кликнули по демо — создаём запись в storage
      const t = taskFromCardEl(card);
      upsert(t);
      card.dataset.id = t.id;
      openEditor(t);
    }
  });

  /* -------------------------
     5) ADD BUTTON + BOOT
  ------------------------- */
  function ensureQuickAdd(){
    ensureModals();
  }

  // форма-цикл для новых карточек
  let shapeIdx = 0;
  function pickNextShape(){ return ['square','tall','wide'][ (shapeIdx++) % 3 ]; }

  function boot(){
    ensureQuickAdd();
    // если в storage есть задачи — дорисуем их (после демо)
    const stored = loadTasks();
    if (stored.length){
      // не дублируем: обновим/проставим id тем, что совпали по тексту
      stored.forEach(t => {
        // если такая уже есть в DOM — проставим id и приведём к текстам из storage
        const maybe = [...$$('.card')].find(el =>
          !el.dataset.id &&
          (el.querySelector('h3')?.textContent.trim() === t.title)
        );
        if (maybe){
          maybe.dataset.id = t.id;
          renderOrUpdate(t);
        } else {
          // это новая задача — добавим в конец сетки
          renderTask(t);
        }
      });
    }
  }

  /* -------------------------
     6) AI TIP (как было)
  ------------------------- */
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
  const aiText = $('#aiText');
  const aiTip = $('#aiTip');
  function seedIndex(){
    const saved = localStorage.getItem('weepl-tip-index');
    if (saved !== null) return parseInt(saved,10);
    const d = new Date();
    const key = d.getFullYear()*10000 + (d.getMonth()+1)*100 + d.getDate();
    return key % tips.length;
  }
  let tipIndex = seedIndex();
  function renderTip(){
    if (aiText) aiText.textContent = 'AI-совет: ' + tips[tipIndex];
    localStorage.setItem('weepl-tip-index', String(tipIndex));
  }
  renderTip();
  aiTip?.addEventListener('click', ()=>{
    tipIndex = (tipIndex + 1) % tips.length;
    aiTip.style.opacity = .85; setTimeout(()=> aiTip.style.opacity=1, 160);
    renderTip();
  });

  // GO
  boot();

})();
