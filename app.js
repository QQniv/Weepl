/* =========================================================
   WEEPL v3 — app.js (robust init: overlay first; plus fixed)
   ========================================================= */
(() => {
  const $  = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
  const grid = $('.grid-inner');
  const bg = $('.bg'), veil = $('.bg-veil');
  const STORAGE_KEY = 'weepl-tasks';

  /* utils */
  const load = () => { try { return JSON.parse(localStorage.getItem(STORAGE_KEY)||'[]'); } catch { return []; } };
  const save = arr => localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
  const escapeHTML = s => String(s ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const byId = id => load().find(t=>t.id===id);
  const upsert = t => { const a=load(); const i=a.findIndex(x=>x.id===t.id); if(i<0)a.push(t); else a[i]=t; save(a); };
  const removeById = id => save(load().filter(t=>t.id!==id));

  /* backdrop parallax */
  let sy = scrollY, vx=0, raf=null;
  addEventListener('scroll', ()=>{ sy=scrollY||pageYOffset; req(); }, {passive:true});
  addEventListener('pointermove', e=>{ vx=(e.clientX/innerWidth)-.5; req(); }, {passive:true});
  const req=()=> raf || (raf=requestAnimationFrame(tick));
  const tick=()=>{ raf=null; const py=-(sy*0.03), px=vx*10; if(bg)bg.style.transform=`translate3d(${px}px,${py}px,0)`; if(veil)veil.style.transform=`translate3d(${px*.6}px,${py*.5}px,0)`; };
  req();

  /* spring on cards */
  let cards=$$('.card'); const st=new Map();
  const io=new IntersectionObserver(es=>es.forEach(e=>{ if(e.isIntersecting)e.target.classList.add('inview'); }),{threshold:.08});
  cards.forEach(c=>{ io.observe(c); c.style.cursor='pointer'; });
  (function anim(){ const vh=innerHeight; for(const el of cards){ const r=el.getBoundingClientRect(); const n=(r.top+r.height*.5 - vh*.5)/vh; const target=n*10; const s=st.get(el)||{y:0,vy:0}; s.vy+=(target-s.y)*.12; s.vy*=.85; s.y+=s.vy; st.set(el,s); el.style.transform=`translateY(${s.y.toFixed(2)}px)`; } requestAnimationFrame(anim); })();

  /* priorities */
  const PR_LONG = { A:'Сделать сейчас', B:'Запланировать', C:'Делегировать', D:'Убрать/Отменить' };
  const PR_SHORT= { A:'Сейчас',          B:'План',          C:'Делег.',       D:'Убрать' };
  const LT = { A:'rgba(255, 93, 93, .18)', B:'rgba(255,195, 80,.16)', C:'rgba(120,205,255,.16)', D:'rgba(150,160,180,.14)' };
  const DT = { A:'rgba(255, 93, 93, .22)', B:'rgba(255,195, 80,.20)', C:'rgba(120,205,255,.20)', D:'rgba(140,150,170,.18)' };

  function applyPriorityStyle(el, pr='B'){
    const tint = (document.body.dataset.theme==='dark'?DT:LT)[pr] || LT.B;
    el.style.background = `linear-gradient(${tint}, ${tint}), var(--panel)`;
    el.dataset.prio = pr;
    const dotColor = tint.replace(/\.1[46]/,'.9').replace(/\.2[02]/,'.9');
    let badge = el.querySelector('.meta [data-role="prio"]');
    if(!badge){
      const left = el.querySelector('.meta span:first-child');
      if(left){
        left.innerHTML = `<span data-role="prio" style="display:inline-flex;align-items:center;gap:6px;margin-right:10px;font-weight:800">
          <span style="width:10px;height:10px;border-radius:50%;background:${dotColor}"></span>${pr}</span>` + left.innerHTML;
      }
    } else {
      badge.lastChild.nodeValue = pr;
      const dot = badge.querySelector('span'); if (dot) dot.style.background = dotColor;
    }
    el.style.opacity = pr==='D' ? .95 : 1;
  }

  /* editor (build FIRST, so + always works) */
  let CURRENT_ID=null, CURRENT_PRIORITY='B';

  function ensureEditor(){
    if($('#taskOverlay')) return;

    const fab = document.createElement('button');
    fab.id='quickAddBtn'; fab.innerHTML='+';
    Object.assign(fab.style,{
      position:'fixed', right:'calc(16px + env(safe-area-inset-right))',
      bottom:'calc(100px + env(safe-area-inset-bottom))', /* выше дока */
      width:'60px', height:'60px', borderRadius:'18px', border:'none', cursor:'pointer',
      fontSize:'30px', fontWeight:'700', lineHeight:'0', color:'#0f1115',
      background:'rgba(255,255,255,.9)', boxShadow:'0 16px 38px rgba(0,0,0,.22)',
      backdropFilter:'blur(10px)', WebkitBackdropFilter:'blur(10px)', zIndex:'60'
    });
    fab.addEventListener('click', ()=>openEditor());
    document.body.appendChild(fab);

    const overlay = document.createElement('div'); overlay.id='taskOverlay';
    Object.assign(overlay.style,{
      position:'fixed', inset:'0', display:'none', alignItems:'center', justifyContent:'center',
      background:'rgba(0,0,0,.25)', zIndex:'80',
      padding:'calc(10px + env(safe-area-inset-top)) calc(10px + env(safe-area-inset-right)) calc(10px + env(safe-area-inset-bottom)) calc(10px + env(safe-area-inset-left))'
    });
    overlay.addEventListener('click', e=>{ if(e.target===overlay) closeEditor(); });

    const modal = document.createElement('div'); modal.id='taskModal';
    Object.assign(modal.style,{
      width:'min(700px,94vw)', maxHeight:'min(80vh, 720px)', display:'flex', flexDirection:'column',
      overflow:'hidden', background:'var(--panel)', color:'var(--ink)', borderRadius:'24px',
      boxShadow:'0 18px 60px rgba(0,0,0,.25)', backdropFilter:'blur(20px)', WebkitBackdropFilter:'blur(20px)', padding:'0'
    });

    const header = document.createElement('div'); header.id='tmTitle';
    Object.assign(header.style,{ padding:'18px 22px 8px', borderTopLeftRadius:'24px', borderTopRightRadius:'24px', font:'600 20px/1.25 var(--heading-font, Sora), Inter, system-ui' });
    header.textContent='Новая задача';

    const scroller = document.createElement('div');
    Object.assign(scroller.style,{ overflow:'auto', padding:'0 22px 18px' });

    const form = document.createElement('form'); form.id='tmForm';
    Object.assign(form.style,{ display:'grid', gap:'12px', fontSize:'16px' });

    const inputCSS = 'font-size:16px;padding:14px 16px;border-radius:14px;border:1px solid color-mix(in oklab, var(--ink) 10%, transparent);background:rgba(255,255,255,.68)';
    form.innerHTML = `
      <input required id="tmInputTitle" placeholder="Заголовок" style="${inputCSS}"/>
      <input id="tmInputNote" placeholder="Описание (необязательно)" style="${inputCSS}"/>
      <div id="tmRow" style="display:grid; gap:12px">
        <input id="tmInputTag"  placeholder="Тег (например, Фокус)" style="${inputCSS}"/>
        <input id="tmInputTime" placeholder="Время (напр. 14:30)" style="${inputCSS}"/>
      </div>

      <div>
        <div style="margin:6px 0 8px; font:600 14px/1 Inter, system-ui">Важность (матрица Эйзенхауэра)</div>
        <div id="tmPriority" role="tablist" aria-label="Важность" style="display:grid; gap:8px"></div>
      </div>

      <div style="display:flex; gap:12px; justify-content:space-between; margin-top:10px">
        <button type="button" id="tmDelete" style="padding:12px 16px;border-radius:12px;border:none;background:rgba(255,82,82,.12);color:#b21;cursor:pointer;display:none">Удалить</button>
        <div style="display:flex; gap:10px">
          <button type="button" id="tmCancel" style="padding:12px 16px;border-radius:12px;border:none;background:rgba(255,255,255,.6);cursor:pointer">Отмена</button>
          <button type="submit" id="tmSave" style="padding:12px 16px;border-radius:12px;border:none;background:linear-gradient(135deg, rgba(200,182,255,.98), rgba(184,224,255,.98));font-weight:800;cursor:pointer">Сохранить</button>
        </div>
      </div>
    `;

    const prWrap = form.querySelector('#tmPriority');

    /* priority buttons + autofit */
    const PR_LONG = { A:'Сделать сейчас', B:'Запланировать', C:'Делегировать', D:'Убрать/Отменить' };
    const PR_SHORT= { A:'Сейчас', B:'План', C:'Делег.', D:'Убрать' };
    const LT_MAP = {A:LT.A,B:LT.B,C:LT.C,D:LT.D};

    const isCompact = () => innerWidth < 390;
    const labelFor = l => isCompact()? PR_SHORT[l] : PR_LONG[l];

    function buildPriorityButtons(){
      prWrap.innerHTML = '';
      const minWidth = isCompact()? 84 : 104;
      Object.assign(prWrap.style, { gridTemplateColumns:`repeat(auto-fit, minmax(${minWidth}px, 1fr))` });

      ['A','B','C','D'].forEach(letter=>{
        const btn = document.createElement('button');
        btn.type='button'; btn.dataset.val=letter; btn.role='tab';
        btn.style.cssText = `
          display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;
          padding:12px 10px;min-height:68px;border:none;border-radius:12px;cursor:pointer;
          background:${LT_MAP[letter]}; text-align:center; white-space:normal; word-break:break-word;
        `;
        btn.innerHTML = `
          <div class="pr-cap" style="font:800 16px/1 Inter,system-ui">${letter}</div>
          <div class="pr-sub" style="font:600 12px/1.15 Inter,system-ui;opacity:.85">${labelFor(letter)}</div>
        `;
        prWrap.appendChild(btn);
      });

      highlightPriority(); autoFitPriorityLabels();
    }
    function highlightPriority(){ $$('#tmPriority button').forEach(b=>{ b.style.outline = (b.dataset.val === CURRENT_PRIORITY) ? '2px solid var(--accent)' : 'none'; }); }
    function autoFit(el, minPx=10, maxPx=12){
      let size = maxPx; el.style.fontSize = size+'px';
      el.style.maxHeight = (parseFloat(getComputedStyle(el).lineHeight) * 2) + 'px';
      while (el.scrollHeight > el.clientHeight && size > minPx){ size -= 0.5; el.style.fontSize = size+'px'; }
    }
    function autoFitPriorityLabels(){
      const subs = $$('.pr-sub', prWrap);
      subs.forEach(el => autoFit(el, 10, isCompact()?11.5:12));
      const ro = new ResizeObserver(()=> subs.forEach(el => autoFit(el, 10, isCompact()?11.5:12)));
      subs.forEach(el => ro.observe(el));
      addEventListener('resize', ()=> subs.forEach(el => autoFit(el, 10, isCompact()?11.5:12)));
      addEventListener('orientationchange', ()=> setTimeout(()=>subs.forEach(el => autoFit(el, 10, isCompact()?11.5:12)), 250));
    }
    buildPriorityButtons();

    function layoutRow(){
      const row = $('#tmRow');
      row.style.gridTemplateColumns = (innerWidth < 560) ? '1fr' : '1fr 1fr';
      modal.style.maxHeight = 'min(80vh, 720px)';
    }
    layoutRow();
    addEventListener('resize', ()=>{ layoutRow(); buildPriorityButtons(); });
    addEventListener('orientationchange', ()=> setTimeout(()=>{ layoutRow(); buildPriorityButtons(); }, 250));

    prWrap.addEventListener('click', e=>{
      const btn = e.target.closest('button[data-val]'); if (!btn) return;
      setPriority(btn.dataset.val); highlightPriority();
    });

    const footerPad = document.createElement('div'); footerPad.style.height='6px';
    scroller.appendChild(form); scroller.appendChild(footerPad);
    modal.appendChild(header); modal.appendChild(scroller);
    overlay.appendChild(modal); document.body.appendChild(overlay);

    $('#tmCancel').addEventListener('click', closeEditor);
    $('#tmDelete').addEventListener('click', onDelete);
    form.addEventListener('submit', onSave);

    addEventListener('keydown', e=>{
      const open = overlay.style.display==='flex';
      if(e.key==='Escape' && open) return closeEditor();
      if((e.key==='n'||e.key==='N'||e.key==='+') && !open) openEditor();
    });

    setPriority('B');
  }

  function setPriority(v){ CURRENT_PRIORITY=v; }

  function openEditor(task){
    ensureEditor(); // на всякий
    const overlay=$('#taskOverlay'), title=$('#tmTitle'), del=$('#tmDelete');
    CURRENT_ID = task?.id ?? null;
    setPriority(task?.priority || 'B');

    title.textContent = CURRENT_ID ? 'Редактирование задачи' : 'Новая задача';
    del.style.display  = CURRENT_ID ? 'inline-block' : 'none';

    $('#tmInputTitle').value = task?.title ?? '';
    $('#tmInputNote').value  = task?.note  ?? '';
    $('#tmInputTag').value   = task?.tag   ?? '';
    $('#tmInputTime').value  = task?.time  ?? '';

    document.documentElement.classList.add('modal-open');
    document.body.classList.add('modal-open');
    overlay.style.display='flex';
    setTimeout(()=> overlay.style.opacity='1',0);
    $('#tmInputTitle').focus();

    $$('#tmPriority button').forEach(b=>{
      b.style.outline = (b.dataset.val===CURRENT_PRIORITY)?'2px solid var(--accent)':'none';
    });
  }

  function closeEditor(){
    const o=$('#taskOverlay'); o.style.opacity='0';
    setTimeout(()=> o.style.display='none', 120);
    document.documentElement.classList.remove('modal-open');
    document.body.classList.remove('modal-open');
    $('#tmForm').reset(); setPriority('B');
  }

  function onSave(e){
    e.preventDefault();
    const title=$('#tmInputTitle').value.trim(); if(!title) return;
    const base = CURRENT_ID ? (byId(CURRENT_ID) || {}) : {};
    const t = {
      id: CURRENT_ID || ('t'+Date.now()),
      title,
      note: $('#tmInputNote').value.trim(),
      tag : $('#tmInputTag').value.trim() || 'Задача',
      time: $('#tmInputTime').value.trim() || '',
      priority: CURRENT_PRIORITY,
      shape: base.shape || pickNextShape()
    };
    upsert(t); renderOrUpdate(t); closeEditor();
  }

  function onDelete(){
    if(!CURRENT_ID) return closeEditor();
    removeById(CURRENT_ID);
    grid.querySelector(`.card[data-id="${CURRENT_ID}"]`)?.remove();
    closeEditor();
  }

  /* render */
  function taskFromCardEl(el){
    // берём текущий приоритет карточки (если уже был тинт)
    const pr = el.dataset.prio || 'B';
    return {
      id:'t'+Date.now()+Math.random().toString(36).slice(2,6),
      title: el.querySelector('h3')?.textContent.trim() || 'Без названия',
      note : el.querySelector('p')?.textContent.trim()  || '',
      tag  : el.querySelector('.meta span:nth-child(1)')?.textContent.trim() || 'Задача',
      time : el.querySelector('.meta span:nth-child(2)')?.textContent.trim() || '',
      priority: pr,
      shape: el.classList.contains('tall') ? 'tall' : el.classList.contains('wide') ? 'wide' : 'square'
    };
  }

  function renderTask(t){
    const el=document.createElement('article');
    el.className=`card ${t.shape}`; el.tabIndex=0; el.dataset.id=t.id; el.style.cursor='pointer';
    el.innerHTML = `<div><h3>${escapeHTML(t.title)}</h3><p>${escapeHTML(t.note)}</p></div>
                    <div class="meta"><span>${escapeHTML(t.tag)}</span><span>${escapeHTML(t.time)}</span></div>`;
    grid.appendChild(el); cards.push(el); io.observe(el);
    applyPriorityStyle(el, t.priority||'B');
    el.addEventListener('click', ()=>openEditor(t));
  }

  function renderOrUpdate(t){
    let el=grid.querySelector(`.card[data-id="${t.id}"]`);
    if(!el){ renderTask(t); return; }
    el.querySelector('h3').textContent=t.title;
    el.querySelector('p').textContent=t.note;
    const s=el.querySelectorAll('.meta span'); if(s[0]) s[0].textContent=t.tag; if(s[1]) s[1].textContent=t.time;
    applyPriorityStyle(el, t.priority||'B');
  }

  // делегирование кликов: только по .card, баннер игнорируем
  grid.addEventListener('click', (e)=>{
    const card=e.target.closest('.card'); if(!card) return;
    const id=card.dataset.id;

    // гарантируем наличие overlay перед открытием
    ensureEditor();

    if(id){
      openEditor(byId(id));
    } else {
      const t=taskFromCardEl(card);
      upsert(t);
      card.dataset.id=t.id;
      applyPriorityStyle(card,t.priority); // визуально остаётся как есть
      openEditor(t);
    }
  });

  /* boot: строим редактор СНАЧАЛА, чтобы + всегда работал */
  function ensureUI(){ ensureEditor(); }
  let shapeIdx=0; const pickNextShape=()=> (['square','tall','wide'][shapeIdx++%3]);

  function boot(){
    ensureUI();
    const stored=load();
    if(stored.length){
      stored.forEach(t=>{
        const maybe=[...$$('.card')].find(el=>!el.dataset.id && (el.querySelector('h3')?.textContent.trim()===t.title));
        if(maybe){ maybe.dataset.id=t.id; renderOrUpdate(t); }
        else { renderTask(t); }
      });
    } else {
      $$('.card').forEach(el=>applyPriorityStyle(el,'B'));
    }
  }
  boot();
})();
