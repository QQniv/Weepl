/* =========================================================
   WEEPL v4 — app.js (Eisenhower Matrix edition)
   - 4 квадранта A/B/C/D
   - Drag&Drop с авто-сменой приоритета
   - Редактор, привычки, AI-совет (архитектура)
   ========================================================= */

(() => {
  const $  = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
  const STORAGE_KEY = 'weepl-tasks-v4';
  const zones = {};   // сектора матрицы A,B,C,D

  /* ---------- Storage ---------- */
  const load  = () => JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  const save  = arr => localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
  const byId  = id => load().find(t => t.id === id);
  const upsert= t => { const a=load(); const i=a.findIndex(x=>x.id===t.id); if(i<0)a.push(t); else a[i]=t; save(a); };
  const removeById=id=>save(load().filter(t=>t.id!==id));

  /* ---------- Priority style ---------- */
  function applyPriorityStyle(el, pr='B'){
    el.dataset.prio=pr;
    const tint=getComputedStyle(document.body).getPropertyValue(`--tint${pr}`);
    el.style.background=`linear-gradient(${tint},${tint}),var(--panel)`;
  }

  /* ---------- Render ---------- */
  function renderTask(t){
    const el=document.createElement('article');
    el.className=`card ${t.shape}`;
    el.tabIndex=0;
    el.dataset.id=t.id;
    el.dataset.prio=t.priority;
    el.innerHTML=`
      <div><h3>${t.title}</h3><p>${t.note||''}</p></div>
      <div class="meta"><span>${t.tag||'Задача'}</span><span>${t.time||''}</span></div>
    `;
    applyPriorityStyle(el,t.priority);
    el.addEventListener('click',()=>openEditor(t));
    makeDraggable(el);
    zones[t.priority||'B']?.appendChild(el);
  }

  function renderOrUpdate(t){
    const el=document.querySelector(`.card[data-id="${t.id}"]`);
    if(!el){renderTask(t);return;}
    el.querySelector('h3').textContent=t.title;
    el.querySelector('p').textContent=t.note;
    const s=el.querySelectorAll('.meta span');
    if(s[0])s[0].textContent=t.tag;
    if(s[1])s[1].textContent=t.time;
    applyPriorityStyle(el,t.priority);
    zones[t.priority]?.appendChild(el);
  }

  /* ---------- Editor ---------- */
  let CURRENT_ID=null, CURRENT_PRIORITY='B';
  function ensureEditor(){
    if($('#taskOverlay'))return;
    const fab=document.createElement('button');
    fab.id='quickAddBtn'; fab.textContent='+';
    document.body.appendChild(fab);
    fab.addEventListener('click',()=>openEditor());

    const overlay=document.createElement('div');
    overlay.id='taskOverlay';
    Object.assign(overlay.style,{position:'fixed',inset:0,display:'none',alignItems:'center',justifyContent:'center',background:'rgba(0,0,0,.25)',zIndex:60});
    document.body.appendChild(overlay);
    overlay.addEventListener('click',e=>{if(e.target===overlay)closeEditor();});

    const modal=document.createElement('div');
    modal.id='taskModal';
    Object.assign(modal.style,{width:'min(680px,94vw)',background:'var(--panel)',color:'var(--ink)',borderRadius:'24px',boxShadow:'0 18px 60px rgba(0,0,0,.25)',padding:'22px'});
    modal.innerHTML=`
      <h3 style="font-family:var(--heading-font);margin-bottom:12px;">Новая задача</h3>
      <form id="tmForm" style="display:grid;gap:10px;font-size:16px">
        <input id="tmInputTitle" placeholder="Заголовок" required style="padding:12px;border-radius:12px;border:1px solid #ccc;">
        <input id="tmInputNote" placeholder="Описание" style="padding:12px;border-radius:12px;border:1px solid #ccc;">
        <div style="display:flex;gap:8px">
          <input id="tmInputTag" placeholder="Тег" style="flex:1;padding:12px;border-radius:12px;border:1px solid #ccc;">
          <input id="tmInputTime" placeholder="Время" style="flex:1;padding:12px;border-radius:12px;border:1px solid #ccc;">
        </div>
        <div id="prioBtns" style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:8px;">
          ${['A','B','C','D'].map(l=>`<button type="button" data-val="${l}" style="padding:10px;border:none;border-radius:12px;background:var(--tint${l});font-weight:700;">${l}</button>`).join('')}
        </div>
        <div style="display:flex;justify-content:space-between;margin-top:10px;">
          <button type="button" id="tmDelete" style="background:#fee;color:#a22;border:none;border-radius:10px;padding:10px 16px;display:none">Удалить</button>
          <div style="display:flex;gap:8px;">
            <button type="button" id="tmCancel" style="padding:10px 16px;border:none;border-radius:10px;background:#eee;">Отмена</button>
            <button type="submit" id="tmSave" style="padding:10px 16px;border:none;border-radius:10px;background:linear-gradient(135deg,#c8b6ff,#b8e0ff);font-weight:700;">Сохранить</button>
          </div>
        </div>
      </form>
    `;
    overlay.appendChild(modal);

    $('#tmCancel').addEventListener('click',closeEditor);
    $('#tmDelete').addEventListener('click',onDelete);
    $('#tmForm').addEventListener('submit',onSave);
    $('#prioBtns').addEventListener('click',e=>{
      const b=e.target.closest('button[data-val]');
      if(!b)return;
      CURRENT_PRIORITY=b.dataset.val;
      $$('#prioBtns button').forEach(x=>x.style.outline=x===b?'2px solid var(--accent)':'none');
    });
  }

  function openEditor(t){
    const o=$('#taskOverlay'); const del=$('#tmDelete');
    CURRENT_ID=t?.id??null; CURRENT_PRIORITY=t?.priority||'B';
    o.style.display='flex';
    $('#tmInputTitle').value=t?.title??'';
    $('#tmInputNote').value=t?.note??'';
    $('#tmInputTag').value=t?.tag??'';
    $('#tmInputTime').value=t?.time??'';
    del.style.display=t?'inline-block':'none';
  }
  function closeEditor(){ $('#taskOverlay').style.display='none'; $('#tmForm').reset(); CURRENT_ID=null; CURRENT_PRIORITY='B'; }
  function onSave(e){
    e.preventDefault();
    const title=$('#tmInputTitle').value.trim(); if(!title)return;
    const base=CURRENT_ID?(byId(CURRENT_ID)||{}):{};
    const t={
      id:CURRENT_ID||('t'+Date.now()),
      title,
      note:$('#tmInputNote').value.trim(),
      tag:$('#tmInputTag').value.trim()||'Задача',
      time:$('#tmInputTime').value.trim()||'',
      priority:CURRENT_PRIORITY,
      shape:base.shape||pickNextShape()
    };
    upsert(t); renderOrUpdate(t); closeEditor();
  }
  function onDelete(){
    if(!CURRENT_ID)return closeEditor();
    removeById(CURRENT_ID);
    document.querySelector(`.card[data-id="${CURRENT_ID}"]`)?.remove();
    closeEditor();
  }

  /* ---------- Drag & Drop ---------- */
  function makeDraggable(el){
    el.draggable=true;
    el.addEventListener('dragstart',e=>{
      e.dataTransfer.setData('id',el.dataset.id);
      e.dataTransfer.effectAllowed='move';
      el.classList.add('dragging');
    });
    el.addEventListener('dragend',()=>el.classList.remove('dragging'));
  }

  function makeDropZone(zone,prio){
    zones[prio]=zone;
    zone.addEventListener('dragover',e=>e.preventDefault());
    zone.addEventListener('drop',e=>{
      e.preventDefault();
      const id=e.dataTransfer.getData('id');
      const card=document.querySelector(`.card[data-id="${id}"]`);
      if(!card)return;
      zone.appendChild(card);
      const t=byId(id);
      if(t){ t.priority=prio; upsert(t); applyPriorityStyle(card,prio); }
    });
  }

  /* ---------- Habits ---------- */
  $$('.habit').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const state=btn.getAttribute('aria-pressed')==='true';
      btn.setAttribute('aria-pressed',String(!state));
      localStorage.setItem('habit-'+btn.dataset.habit,!state);
    });
    const saved=localStorage.getItem('habit-'+btn.dataset.habit);
    if(saved==='true')btn.setAttribute('aria-pressed','true');
  });

  /* ---------- AI Tip (пока локально) ---------- */
  const tips=[
    'Начни день с задачи категории A — создаст чувство импульса.',
    'Перенеси одну D-задачу в архив, чтобы освободить внимание.',
    'Если мозг буксует — 10 минут прогулки восстанавливают фокус.',
    'Запиши коротко цель дня, чтобы сузить фокус до сути.'
  ];
  const aiText=$('#aiText'), aiTip=$('#aiTip');
  let idx=+(localStorage.getItem('ai-tip')||0);
  function renderTip(){ aiText.textContent='AI-совет: '+tips[idx%tips.length]; localStorage.setItem('ai-tip',idx); }
  renderTip();
  aiTip.addEventListener('click',()=>{idx++;renderTip();});
  window.WeeplAI={ updateTip:(text)=>{aiText.textContent='AI-совет: '+text;} };

  /* ---------- Boot ---------- */
  let shapeIdx=0; const pickNextShape=()=>['square','tall','wide'][shapeIdx++%3];
  function boot(){
    ensureEditor();
    // создаём матрицу
    const grid=$('.grid-inner');
    grid.innerHTML='';
    const sectors=[
      {p:'A',t:'Сделать сейчас'}, 
      {p:'B',t:'Запланировать'}, 
      {p:'C',t:'Делегировать'}, 
      {p:'D',t:'Убрать / Отменить'}
    ];
    sectors.forEach(s=>{
      const sec=document.createElement('section');
      sec.className='matrix-zone';
      sec.dataset.prio=s.p;
      sec.innerHTML=`<h3 style="font-family:var(--heading-font);font-size:18px;margin-bottom:6px;">${s.t}</h3>
                     <div class="zone-cards" data-zone="${s.p}"></div>`;
      grid.appendChild(sec);
      makeDropZone(sec.querySelector('.zone-cards'),s.p);
    });

    const stored=load();
    stored.forEach(renderTask);
  }
  boot();
})();
