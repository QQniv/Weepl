/* =========================================================
   WEEPL v3 — app.js
   - Parallax фона (scroll + легкий pointer-tilt)
   - Inertia у карточек при скролле (мягкая пружинка)
   - Быстрый аддер задач (локальное хранение + рендер в сетку)
   - База под категории советов (пока не задействуем)
   ========================================================= */

(() => {
  const $ = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));

  const bg = $('.bg');
  const veil = $('.bg-veil');
  const grid = $('.grid-inner');

  /* -------------------------
     1) PARALLAX BACKDROP
  ------------------------- */
  let sy = window.scrollY;
  let vx = 0, vy = 0; // для pointer-tilt
  let rafId = null;

  function onScroll(){
    sy = window.scrollY || window.pageYOffset;
    requestTick();
  }
  function onPointerMove(e){
    const w = window.innerWidth, h = window.innerHeight;
    const x = (e.clientX ?? (w/2)) / w - 0.5;
    const y = (e.clientY ?? (h/2)) / h - 0.5;
    vx = x; vy = y;
    requestTick();
  }
  function requestTick(){
    if (rafId) return;
    rafId = requestAnimationFrame(updateBackdrop);
  }
  function updateBackdrop(){
    rafId = null;
    // лёгкий параллакс по скроллу (медленнее контента)
    const py = -(sy * 0.03);
    const px = vx * 10; // pointer-tilt
    if (bg)   bg.style.transform   = `translate3d(${px}px, ${py}px, 0)`;
    if (veil) veil.style.transform = `translate3d(${px*0.6}px, ${py*0.5}px, 0)`;
  }

  window.addEventListener('scroll', onScroll, {passive:true});
  window.addEventListener('pointermove', onPointerMove, {passive:true});
  // первый тик
  requestTick();

  /* -------------------------
     2) CARD INERTIA (spring)
  ------------------------- */
  const cards = $$('.card');
  const state = new Map(); // per-card {y, vy}

  function springStep(){
    const vh = window.innerHeight;
    for (const el of cards){
      const r = el.getBoundingClientRect();
      // отклонение от центра экрана
      const norm = (r.top + r.height*0.5 - vh*0.5) / vh; // ~[-1..1]
      const target = norm * 10;              // px смещение
      const s = state.get(el) || { y:0, vy:0 };
      // критически демпфированная пружина
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

  // появление по мере входа в вьюпорт (если CSS-анимация выключена)
  const io = new IntersectionObserver(entries=>{
    entries.forEach(ent=>{
      if (ent.isIntersecting) ent.target.classList.add('inview');
    });
  }, { threshold: 0.08 });
  cards.forEach(c=> io.observe(c));

  /* -------------------------
     3) QUICK ADD (localStorage)
  ------------------------- */
  const STORAGE_KEY = 'weepl-tasks';

  function loadTasks(){
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
    catch { return []; }
  }
  function saveTasks(arr){
    localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
  }

  // динамически создаём плавающую кнопку и модалку
  function ensureQuickAddUI(){
    if ($('#quickAddBtn')) return;

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
    btn.addEventListener('click', openModal);
    document.body.appendChild(btn);

    const overlay = document.createElement('div');
    overlay.id = 'quickAddOverlay';
    Object.assign(overlay.style, {
      position:'fixed', inset:'0', display:'none',
      alignItems:'center', justifyContent:'center',
      background:'rgba(0,0,0,.25)', zIndex:'40'
    });
    overlay.addEventListener('click', e=>{
      if (e.target === overlay) closeModal();
    });

    const modal = document.createElement('div');
    modal.id = 'quickAddModal';
    Object.assign(modal.style, {
      width:'min(560px, 92vw)',
      background:'var(--panel)',
      color:'var(--ink)',
      borderRadius:'22px',
      boxShadow:'0 18px 60px rgba(0,0,0,.25)',
      backdropFilter:'blur(18px)',
      WebkitBackdropFilter:'blur(18px)',
      padding:'18px'
    });
    modal.innerHTML = `
      <h3 style="margin:0 0 10px; font:600 18px/1.2 Sora, Inter, sans-serif">Новая задача</h3>
      <form id="qaForm" style="display:grid; gap:10px">
        <input required id="qaTitle" placeholder="Заголовок" style="padding:12px 14px;border-radius:14px;border:1px solid color-mix(in oklab, var(--ink) 10%, transparent);background:rgba(255,255,255,.6)"/>
        <input id="qaNote" placeholder="Описание (необязательно)" style="padding:12px 14px;border-radius:14px;border:1px solid color-mix(in oklab, var(--ink) 10%, transparent);background:rgba(255,255,255,.6)"/>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px">
          <input id="qaTag"  placeholder="Тег (например, Фокус)" style="padding:12px 14px;border-radius:14px;border:1px solid color-mix(in oklab, var(--ink) 10%, transparent);background:rgba(255,255,255,.6)"/>
          <input id="qaTime" placeholder="Время (напр. 14:30)" style="padding:12px 14px;border-radius:14px;border:1px solid color-mix(in oklab, var(--ink) 10%, transparent);background:rgba(255,255,255,.6)"/>
        </div>
        <div style="display:flex; gap:10px; justify-content:flex-end; margin-top:8px">
          <button type="button" id="qaCancel" style="padding:10px 14px;border-radius:12px;border:none;background:rgba(255,255,255,.6);cursor:pointer">Отмена</button>
          <button type="submit" style="padding:10px 14px;border-radius:12px;border:none;background:linear-gradient(135deg, rgba(200,182,255,.98), rgba(184,224,255,.98));font-weight:700;cursor:pointer">Добавить</button>
        </div>
      </form>
    `;
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    $('#qaCancel').addEventListener('click', closeModal);
    $('#qaForm').addEventListener('submit', submitTask);

    // клавиши
    window.addEventListener('keydown', (e)=>{
      if (e.key === 'Escape') closeModal();
      if ((e.key === 'n' || e.key === 'N' || e.key === '+') && !overlayIsOpen()) openModal();
    });

    function overlayIsOpen(){ return overlay.style.display === 'flex'; }
    function openModal(){
      overlay.style.display = 'flex';
      setTimeout(()=> overlay.style.opacity = '1', 0);
      $('#qaTitle').focus();
    }
    function closeModal(){
      overlay.style.opacity = '0';
      setTimeout(()=> overlay.style.display = 'none', 120);
      $('#qaForm').reset();
    }

    function submitTask(e){
      e.preventDefault();
      const title = $('#qaTitle').value.trim();
      const note  = $('#qaNote').value.trim();
      const tag   = $('#qaTag').value.trim() || 'Задача';
      const time  = $('#qaTime').value.trim() || '';
      if (!title) return;

      const tasks = loadTasks();
      tasks.push({
        id: 't' + Date.now(),
        title, note, tag, time,
        // форма карточки — чередуем для мозаики
        shape: pickNextShape()
      });
      saveTasks(tasks);
      renderNew(tasks[tasks.length-1]);
      closeModal();
    }
  }

  // цикл форм: square -> tall -> wide -> square ...
  let shapeIdx = 0;
  function pickNextShape(){
    return ['square','tall','wide'][ (shapeIdx++) % 3 ];
  }

  function renderNew(task){
    if (!grid) return;
    const art = document.createElement('article');
    art.className = `card ${task.shape}`;
    art.tabIndex = 0;
    art.innerHTML = `
      <div>
        <h3>${escapeHTML(task.title)}</h3>
        <p>${escapeHTML(task.note || '')}</p>
      </div>
      <div class="meta"><span>${escapeHTML(task.tag)}</span><span>${escapeHTML(task.time)}</span></div>
    `;
    grid.appendChild(art);
    // подключаем к анимации пружины
    cards.push?.(art); // если массив — расширим
    io.observe(art);
  }

  // при загрузке дорисовываем сохранённые задачи
  function bootTasks(){
    ensureQuickAddUI();
    const tasks = loadTasks();
    tasks.forEach(renderNew);
  }

  function escapeHTML(s){
    return String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  }

  /* -------------------------
     4) FUTURE: совет по категории
     (заглушка на будущее: map task.tag -> набор советов)
  ------------------------- */
  const TIP_BUCKETS = {
    'Фокус': ['Спринт 50–90 мин + 10 мин пауза.','Отключи уведомления на 45 минут.'],
    'Здоровье': ['5–10 минут прогулки → прирост энергии.'],
    'Созвон': ['Проверь повестку: 3 пункта, 30 минут, запись решений.']
  };
  // позже подключим анализ задач и подмену kapsuly

  // init
  bootTasks();

})();
