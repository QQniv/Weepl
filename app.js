
/* ===== Shortcuts ===== */
const $ = s=>document.querySelector(s);
const $$ = s=>Array.from(document.querySelectorAll(s));

/* ===== STATE ===== */
const state = {
  mode: localStorage.getItem('mode_v1') || 'dark',
  accent: localStorage.getItem('accent_v1') || '#B7FF2A',
  haptics: localStorage.getItem('haptics_v1') || 'on',
  sounds: localStorage.getItem('sounds_v1') || 'on',
  selectedDate: new Date(),
  tasks: JSON.parse(localStorage.getItem('tasks_v4') || localStorage.getItem('tasks_v3') || '[]')
};
document.documentElement.setAttribute('data-mode', state.mode);
document.documentElement.style.setProperty('--accent', state.accent);

/* ===== NAV / SCREENS ===== */
function switchScreen(name){
  $('#appTitle').textContent = (name==='settings'?'Настройки':'Сегодня');
  $$('.screen').forEach(s=>s.classList.remove('active'));
  if(name==='settings') $('#screenSettings').classList.add('active');
  else $('#screenToday').classList.add('active');
  $$('.tab').forEach(t=>t.classList.toggle('active', t.dataset.screen===name || (name==='today' && t.dataset.screen==='today')));
}
$$('.tab').forEach(b=>b.onclick=()=>{
  const name = b.dataset.screen;
  if(name==='settings') switchScreen('settings'); else switchScreen('today'); // другие вкладки позже
});

/* ===== CALENDAR STRIP ===== */
const RU_M = ["января","февраля","марта","апреля","мая","июня","июля","августа","сентября","октября","ноября","декабря"];
const RU_DOW = ["Вс","Пн","Вт","Ср","Чт","Пт","Сб"];
const startOfDay = d=>{const x=new Date(d);x.setHours(0,0,0,0);return x;}
const sameDay = (a,b)=>startOfDay(a).getTime()===startOfDay(b).getTime();
const addDays = (d,n)=>{const x=new Date(d);x.setDate(x.getDate()+n);return x;}

function renderStrip(anchor=state.selectedDate){
  const cont = $('#dayStrip'); cont.innerHTML='';
  const today = new Date();
  $('#monthLabel').textContent = RU_M[anchor.getMonth()].replace(/^./,c=>c.toUpperCase());
  const days = [-1,0,1,2,3,4].map(n=>addDays(anchor, n-1));
  days.forEach(d=>{
    const el = document.createElement('div');
    el.className = 'day' + (sameDay(d,today)?' today':'') + (sameDay(d,state.selectedDate)?' selected':'');
    el.innerHTML = `${sameDay(d,today)?'<div class="badge">сегодня</div>':''}
      <div class="dow">${RU_DOW[d.getDay()]}</div>
      <div class="date">${String(d.getDate()).padStart(2,'0')}</div>
      <div class="mon">${RU_M[d.getMonth()]}</div>`;
    el.onclick = ()=>{ state.selectedDate=d; renderStrip(d); renderTasks(); };
    cont.appendChild(el);
  });
}
$('#prev').onclick=()=>{ state.selectedDate=addDays(state.selectedDate,-1); renderStrip(); renderTasks(); };
$('#next').onclick=()=>{ state.selectedDate=addDays(state.selectedDate, 1); renderStrip(); renderTasks(); };

/* ===== TASKS ===== */
function saveTasks(){ localStorage.setItem('tasks_v4', JSON.stringify(state.tasks)); }
function humanLeft(ts){
  if(!ts) return 'Inbox';
  const diff = ts - Date.now();
  if(diff<=0) return 'Уже пора';
  const m=Math.floor(diff/60000), h=Math.floor(m/60), d=Math.floor(h/24);
  if(d>0) return `Через ${d} дн ${h%24} ч`;
  if(h>0) return `Через ${h} ч ${m%60} мин`;
  return `Через ${m} мин`;
}
function smartCount(s){ if(!s) return 0; return ['s','m','a','r','t'].filter(k=>s[k] && s[k].trim().length).length; }
function catColor(c){ return {A:'#FF4D4F',B:getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()||'#B7FF2A',C:'#FFD84D',D:'#9AA4B2'}[c]||'#9AA4B2'; }
function catLabel(c){ return c ? `Кат. ${c}` : 'Кат.'; }
function fmtTime(ts){ const d=new Date(ts); return d.toTimeString().slice(0,5); }
function escapeHtml(s){return (s||'').replace(/[&<>"']/g,m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;' }[m]));}

function renderTasks(){
  const list = $('#taskList'); list.innerHTML='';
  const ds = startOfDay(state.selectedDate).getTime(), de=ds+86400000;
  const todays = state.tasks.filter(t=>{
    if(t.isSlot){
      // show slots that overlap the selected day
      return (t.start && t.start<de) && (t.end && t.end>=ds);
    } else {
      return t.due && t.due>=ds && t.due<de;
    }
  });
  const inbox = state.tasks.filter(t=>!t.due && !t.isSlot);
  const all = [...todays, ...inbox];

  if(all.length===0){
    const empty = document.createElement('div');
    empty.style.cssText='padding:20px 16px;color:var(--muted)';
    empty.textContent='Пока пусто. Нажми «＋», начни с самой лёгкой.';
    list.appendChild(empty); return;
  }

  all.forEach(t=>{
    const row = document.createElement('div');
    row.className = 'item'+(t.done?' done':'');
    const bar = `<div class="bar" style="background:${catColor(t.cat)}"></div>`;
    const chips = `<span class="badge-chip">${catLabel(t.cat)}</span>${smartCount(t.smart)?`<span class="badge-chip">SMART ✓${smartCount(t.smart)}/5</span>`:''}`;
    const titleRow = `<div class="titleRow"><div class="title">${escapeHtml(t.title)}</div>${chips}</div>`;

    let metaRightNow = '';
    if(t.isSlot && t.start && t.end){
      const now=Date.now();
      const within = now>=t.start && now<t.end;
      const before = now < t.start;
      const after  = now >= t.end;
      if(within){
        metaRightNow = ` · <button class="act" data-focus="${t.id}" title="Начать фокус">🎯</button>`;
      } else if(before){
        const mins = Math.max(0, Math.floor((t.start-now)/60000));
        metaRightNow = ` · начнётся через ${mins} мин`;
      } else if(after && !t.done){
        metaRightNow = ` · просрочено`;
      }
    }

    const meta = `<div class="meta">${
        t.isSlot ? (t.start?`${fmtTime(t.start)}–${fmtTime(t.end)}`
                 : 'Слот без времени')
                 : (t.due?humanLeft(t.due):'Inbox')
      }${t.notify && (t.due || t.start)?' · 🔔':''}${metaRightNow}</div>`;

    const content = `<div>${titleRow}${meta}</div>`;
    const actions = `<div class="actions">
      <button class="act" title="Выполнено">✓</button>
      <button class="act" title="Редактировать">✎</button>
      <button class="act" title="${t.isSlot?'+15 мин к концу':'Отложить +1д'}">➡️</button>
    </div>`;
    row.innerHTML = bar + content + actions;

    // action handlers
    const [doneBtn, editBtn, snoozeBtn] = row.querySelectorAll('.act');
    doneBtn.onclick=()=>{
      t.done=!t.done; saveTasks(); renderTasks();
      haptic(20); confettiFor(row); playDing();
    };
    editBtn.onclick=()=>openSheet(t);
    snoozeBtn.onclick=()=>{
      if(t.isSlot && t.end){ t.end += 15*60*1000; }
      else if(t.due){ t.due += 24*60*60*1000; }
      saveTasks(); renderTasks(); haptic(10); playTick();
    };

    // focus button
    const focusBtn = row.querySelector('[data-focus]');
    if(focusBtn){
      focusBtn.onclick=()=>{
        const now=Date.now(); const left = Math.max(0, t.end - now);
        startFocusTimer(Math.min(left, 2*60*60*1000)); // до 2 часов визуала
        playTick();
      };
    }

    list.appendChild(row);
  });
}

/* ===== ADD/EDIT SHEET ===== */
const sheet = $('#sheet'), bd = $('#bd'), fab=$('#fab');
fab.onclick = ()=>{ fab.classList.add('bounce'); setTimeout(()=>fab.classList.remove('bounce'),220); openSheet(); };

function openSheet(existing){
  sheet.classList.add('open'); bd.classList.add('open');

  $('#f_title').value = existing?.title || '';
  setCat(existing?.cat || 'A');

  // Type
  setType(existing?.isSlot ? 'slot' : 'task');

  // Task times
  setWhen(existing?.due ? 'pick' : (existing ? (existing.inbox?'inbox':'today') : 'today'));
  const baseD = existing?.due ? new Date(existing.due) : new Date();
  $('#f_date').value = baseD.toISOString().slice(0,10);
  $('#f_time').value = baseD.toTimeString().slice(0,5);

  // Slot times
  const sD = existing?.start ? new Date(existing.start) : new Date();
  $('#f_start_date').value = sD.toISOString().slice(0,10);
  $('#f_start_time').value = sD.toTimeString().slice(0,5);
  const eD = existing?.end ? new Date(existing.end) : new Date(Date.now()+60*60*1000);
  $('#f_end_date').value = eD.toISOString().slice(0,10);
  $('#f_end_time').value = eD.toTimeString().slice(0,5);

  $('#f_notify').value = existing?.notify || 'none';
  $('#f_quick').value = '';
  sheet.dataset.id = existing?.id || '';

  // SMART
  const sm = existing?.smart || {};
  $('#smartWrap').classList.toggle('open', !!(sm.s||sm.m||sm.a||sm.r||sm.t));
  $('#sm_s').value = sm.s || '';
  $('#sm_m').value = sm.m || '';
  $('#sm_a').value = sm.a || '';
  $('#sm_r').value = sm.r || '';
  $('#sm_t').value = sm.t || '';
  updateTimeBlocks();
  updateDateFields();
}
function closeSheet(){ sheet.classList.remove('open'); bd.classList.remove('open'); sheet.dataset.id=''; }
$('#btnCancel').onclick=closeSheet; bd.onclick=closeSheet;
$('#smartHead').onclick=()=>$('#smartWrap').classList.toggle('open');

// Eisenhower
function setCat(cat){ $$('#f_eisen .chip').forEach(b=>b.setAttribute('aria-pressed', b.dataset.cat===cat?'true':'false')); sheet.dataset.cat=cat; }
$('#f_eisen').addEventListener('click',e=>{ if(e.target.classList.contains('chip')){ setCat(e.target.dataset.cat); e.target.classList.add('pop'); setTimeout(()=>e.target.classList.remove('pop'),220); } });

// Type
function setType(tp){ $$('#f_type button').forEach(b=>b.setAttribute('aria-pressed', b.dataset.type===tp?'true':'false')); sheet.dataset.type=tp; updateTimeBlocks(); }
$('#f_type').addEventListener('click',e=>{ if(e.target.tagName==='BUTTON'){ setType(e.target.dataset.type); } });
function updateTimeBlocks(){
  const tp = sheet.dataset.type || 'task';
  $('#taskTimeBlock').style.display = (tp==='task') ? 'block' : 'none';
  $('#slotTimeBlock').style.display = (tp==='slot') ? 'block' : 'none';
}

// When (for tasks)
function setWhen(mode){ $$('#f_when button').forEach(b=>b.setAttribute('aria-pressed', b.dataset.mode===mode?'true':'false')); sheet.dataset.when=mode; }
$('#f_when').addEventListener('click',e=>{ if(e.target.tagName==='BUTTON'){ setWhen(e.target.dataset.mode); updateDateFields(); } });
function updateDateFields(){
  const mode = sheet.dataset.when || 'today';
  $('#f_date').parentElement.style.display = (mode==='pick') ? 'block' : 'none';
  $('#f_time').parentElement.style.display = (mode!=='inbox') ? 'block' : 'none';
}

// auto-suggest notify when time chosen
$('#f_time').addEventListener('change', ()=>{ if($('#f_notify').value==='none'){ $('#f_notify').value='15'; } });

// Quick parse
function parseQuick(s){
  if(!s) return {};
  s=s.trim().toLowerCase();
  const out={};
  if(/послезавтра/.test(s)) out.date=addDays(new Date(),2);
  else if(/завтра/.test(s)) out.date=addDays(new Date(),1);
  else if(/сегодня/.test(s)) out.date=new Date();
  const m=s.match(/(\d{1,2})[:.](\d{2})/);
  if(m){const d=out.date||new Date(); d.setHours(+m[1],+m[2],0,0); out.date=d;}
  out.title=s.replace(/(сегодня|завтра|послезавтра|\d{1,2}[:.]\d{2})/g,'').trim();
  return out;
}

// Create/Edit
$('#btnCreate').onclick=()=>{
  const quick=parseQuick($('#f_quick').value);
  const title=(quick.title||$('#f_title').value).trim();
  if(!title){ alert('Введите название'); return; }

  const cat = sheet.dataset.cat || 'A';
  const tp = sheet.dataset.type || 'task';

  let due=null, inbox=false, isSlot=false, start=null, end=null;

  if(tp==='slot'){
    isSlot=true;
    const sd = $('#f_start_date').value ? new Date($('#f_start_date').value) : new Date();
    const st = $('#f_start_time').value || '13:00';
    const [sh,sm] = st.split(':'); sd.setHours(+sh||13, +sm||0, 0, 0);
    start = sd.getTime();

    const ed = $('#f_end_date').value ? new Date($('#f_end_date').value) : new Date(sd);
    const et = $('#f_end_time').value || '14:00';
    const [eh,em] = et.split(':'); ed.setHours(+eh||14, +em||0, 0, 0);
    end = ed.getTime();
    if(end<=start){ end = start + 60*60*1000; } // минимум 1 час
  } else {
    const mode=sheet.dataset.when||'today';
    if(mode==='inbox'){ inbox=true; }
    else{
      const base = quick.date || new Date();
      if(mode==='pick'){
        const d = $('#f_date').value ? new Date($('#f_date').value) : base;
        const tm = $('#f_time').value || '18:00'; const [hh,mm]=tm.split(':');
        d.setHours(+hh||18,+mm||0,0,0); due = d.getTime();
      } else {
        const d = startOfDay(new Date());
        const tm = $('#f_time').value || '18:00'; const [hh,mm]=tm.split(':');
        d.setHours(+hh||18,+mm||0,0,0); due = d.getTime();
      }
    }
  }

  const notifySel=$('#f_notify').value; const notify=notifySel==='none'?null:notifySel;

  const smart = { s:$('#sm_s').value.trim(), m:$('#sm_m').value.trim(), a:$('#sm_a').value.trim(), r:$('#sm_r').value.trim(),
                  t: $('#sm_t').value.trim() || (due ? new Date(due).toLocaleString() : (end?new Date(end).toLocaleString():'')) };

  const id = sheet.dataset.id || ('t_'+Math.random().toString(36).slice(2,9));
  const existing = state.tasks.find(x=>x.id===id);
  const payload = { id, title, cat, due, inbox, notify, smart, done:false, isSlot, start, end };

  if(existing) Object.assign(existing, payload); else state.tasks.unshift(payload);
  saveTasks(); renderTasks(); scheduleNotification(payload); closeSheet(); haptic(10); playTick();
};

/* ===== NOTIFICATIONS (tab-lifetime) ===== */
async function askPerm(){ try{ if(Notification && Notification.permission==='default'){ await Notification.requestPermission(); } }catch(e){} }
function scheduleNotification(task){
  if(!('Notification' in window)) return;
  if(Notification.permission!=='granted') return;
  // for slot: notify relative to start
  let baseTs = task.isSlot ? task.start : task.due;
  if(!baseTs || !task.notify) return;
  const delta = task.notify==='at'?0:(+task.notify*60000);
  const fireAt = baseTs - delta; const delay = fireAt - Date.now();
  setTimeout(()=>{ try{ new Notification('Напоминание', { body: task.title }); }catch(e){} }, Math.max(0, Math.min(delay, 2_147_000_000)));
}

/* ===== SETTINGS: theme, accent, haptics, sounds, onboarding ===== */
const accents = ['#B7FF2A','#FFD84D','#FF5CA8','#4BD0FF','#FF8A3D','#FF4D4F','#7BD23C','#2BD2C4'];
function initSettingsUI(){
  // theme seg
  const seg = $('#themeSeg');
  seg.querySelectorAll('button').forEach(b=>{
    b.setAttribute('aria-pressed', b.dataset.mode===state.mode?'true':'false');
    b.onclick=()=>{
      state.mode = b.dataset.mode;
      document.documentElement.setAttribute('data-mode', state.mode);
      localStorage.setItem('mode_v1', state.mode);
      seg.querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed', x===b?'true':'false'));
    };
  });
  // accent swatches
  const grid = $('#accentGrid'); grid.innerHTML='';
  accents.forEach(c=>{
    const el=document.createElement('button');
    el.className='swatch'; el.style.background=c; el.title=c;
    el.onclick=()=>{ state.accent=c; document.documentElement.style.setProperty('--accent', c); localStorage.setItem('accent_v1', c); renderStrip(); renderTasks(); haptic(5); playTick(); };
    grid.appendChild(el);
  });
  // haptics seg
  const hs = $('#hapticsSeg');
  hs.querySelectorAll('button').forEach(b=>{
    b.setAttribute('aria-pressed', (b.dataset.haptics===state.haptics)?'true':'false');
    b.onclick=()=>{
      state.haptics = b.dataset.haptics; localStorage.setItem('haptics_v1', state.haptics);
      hs.querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed', x===b?'true':'false'));
      haptic(8); playTick();
    };
  });
  // sounds seg
  const ss = $('#soundsSeg');
  ss.querySelectorAll('button').forEach(b=>{
    b.setAttribute('aria-pressed', (b.dataset.sounds===state.sounds)?'true':'false');
    b.onclick=()=>{
      state.sounds = b.dataset.sounds;
      localStorage.setItem('sounds_v1', state.sounds);
      ss.querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed', x===b?'true':'false'));
      playTick();
    };
  });
  // onboarding controls
  $('#btnStartTutorial').onclick = ()=> openOnboarding(true);
  $('#btnResetTutorial').onclick = ()=>{ localStorage.removeItem('onboard_done'); alert('Готово. При следующем запуске появится обучение.'); };
}

/* ===== HAPTICS & CONFETTI ===== */
function haptic(ms){ if(state.haptics==='on' && 'vibrate' in navigator){ try{ navigator.vibrate(ms); }catch(e){} } }
const confettiCanvas = $('#confettiCanvas'), cctx = confettiCanvas.getContext('2d');
function resizeCanvas(){ confettiCanvas.width = innerWidth; confettiCanvas.height = innerHeight; }
addEventListener('resize', resizeCanvas); resizeCanvas();
function confettiFor(el){
  const r = el.getBoundingClientRect();
  const x = r.left + r.width - 30, y = r.top + r.height/2 + scrollY;
  fireConfetti(x, y);
}
function fireConfetti(x,y){
  const parts=[]; const colors = ['#fff', state.accent, '#FFD84D', '#FF5CA8', '#4BD0FF'];
  for(let i=0;i<36;i++){
    parts.push({x, y, vx:(Math.random()*2-1)*4, vy:(Math.random()*-3-1), life: Math.random()*40+40, color: colors[i%colors.length], size: Math.random()*3+2});
  }
  let frame=0;
  function tick(){
    cctx.clearRect(0,0,confettiCanvas.width,confettiCanvas.height);
    parts.forEach(p=>{
      p.x += p.vx; p.y += p.vy; p.vy += 0.12; p.life--;
      cctx.fillStyle=p.color; cctx.fillRect(p.x, p.y, p.size, p.size*1.4);
    });
    frame++;
    if(frame<90) requestAnimationFrame(tick);
    else cctx.clearRect(0,0,confettiCanvas.width,confettiCanvas.height);
  }
  tick();
}

/* ===== Tiny WebAudio ===== */
const audio = {
  ctx:null, vol:0.15,
  ensure(){ if(!this.ctx){ const AC = window.AudioContext||window.webkitAudioContext; if(AC) this.ctx=new AC(); } },
  beep(freq=660, dur=0.06){
    if(state.sounds!=='on') return;
    this.ensure(); if(!this.ctx) return;
    const t=this.ctx.currentTime;
    const o=this.ctx.createOscillator();
    const g=this.ctx.createGain();
    o.type='sine'; o.frequency.setValueAtTime(freq,t);
    o.connect(g); g.connect(this.ctx.destination);
    g.gain.setValueAtTime(this.vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t+dur);
    o.start(t); o.stop(t+dur);
  }
};
function playTick(){ audio.beep(700,0.05); }
function playDing(){ audio.beep(523,0.06); setTimeout(()=>audio.beep(784,0.06),80); }

/* ===== ONBOARDING ===== */
(function setupOnboarding(){
  const slides = [
    {h:"Привет!", p:["Планер, который ведёт за руку.","«＋» — быстро добавить.","Тихие часы и темы — в Настройках."]},
    {h:"Экран «Сегодня»", p:["Свайпай дни, отмечай готовое.","Выполненные — полупрозрачные.","Форма добавления — по «＋»."]},
    {h:"Эйзенхауэр: A/B/C/D", p:["A — срочно и важно.","B — важно, планируй.","C — срочно, не важно.","D — позже, без жалости."]},
    {h:"SMART", p:["S — что именно?","M — как измерю?","A — чем обеспечу?","R — зачем?","T — когда?"]},
    {h:"Уведомления", p:["За 5–60 мин или в момент.","«Тихие часы» — не будим.","Дайджест утром/вечером (скоро)."]},
    {h:"Слоты и фокус", p:["События 13:30–14:30.","В начале — таймер-фокус.","Финиш — салют."]},
    {h:"Персонализация", p:["Светлая/тёмная, неон-акцент.","Повторить обучение — в Настройках.","Поехали?"]}
  ];
  const wrap = $('#obWrap'), stepEl = $('#obStep'), dotsEl=$('#obDots'), nextBtn=$('#obNext'), skipBtn=$('#obSkip');
  let i=0;
  function render(){
    stepEl.innerHTML = `<div class="ob-h">${slides[i].h}</div>` + slides[i].p.map(t=>`<div class="ob-p">• ${t}</div>`).join('');
    dotsEl.innerHTML = slides.map((_,k)=>`<div class="ob-dot ${k===i?'active':''}"></div>`).join('');
    nextBtn.textContent = (i===slides.length-1) ? 'Поехали' : 'Дальше';
  }
  function open(force){
    if(!force && localStorage.getItem('onboard_done')) return;
    wrap.style.display='block'; i=0; render();
  }
  function close(){ wrap.style.display='none'; localStorage.setItem('onboard_done','1'); }
  nextBtn.onclick = ()=>{ if(i<slides.length-1){ i++; render(); } else { close(); } };
  skipBtn.onclick = close;
  // expose
  window.openOnboarding = open;
  // auto first run
  open(false);
})();

/* ===== FOCUS TIMER ===== */
(function(){
  const wrap = document.getElementById('ftWrap');
  const cvs = document.getElementById('ftCanvas');
  const ctx = cvs.getContext('2d');
  const timeEl = document.getElementById('ftTime');
  const pauseBtn = document.getElementById('ftPause');
  const stopBtn  = document.getElementById('ftStop');

  let path=[], startTs=0, endTs=0, paused=false, pauseFrom=0, pausedMs=0, raf=null;

  function makePath(n=9){
    const m=[];
    for(let y=0;y<n;y++){
      const row=[];
      for(let x=0;x<n;x++){
        row.push([x*(cvs.width/(n-1)), y*(cvs.height/(n-1))]);
      }
      if(y%2===1) row.reverse(); // змейка
      m.push(...row);
    }
    return m;
  }
  function fmt(ms){
    const s=Math.max(0,Math.floor(ms/1000));
    const mm=String(Math.floor(s/60)).padStart(2,'0');
    const ss=String(s%60).padStart(2,'0');
    return `${mm}:${ss}`;
  }
  function draw(progress){
    ctx.clearRect(0,0,cvs.width,cvs.height);
    // grid background
    ctx.globalAlpha=0.15; ctx.strokeStyle=getComputedStyle(document.documentElement).getPropertyValue('--line'); 
    for(let i=0;i<=10;i++){ const step=i*(cvs.width/10);
      ctx.beginPath(); ctx.moveTo(step,0); ctx.lineTo(step,cvs.height); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0,step); ctx.lineTo(cvs.width,step); ctx.stroke();
    }
    ctx.globalAlpha=1;
    const total = path.length-1;
    const idx = Math.floor(progress*total);
    ctx.lineWidth=6; ctx.lineCap='round';
    ctx.strokeStyle=getComputedStyle(document.documentElement).getPropertyValue('--accent') || '#B7FF2A';
    ctx.beginPath();
    ctx.moveTo(path[0][0], path[0][1]);
    for(let i=1;i<=idx;i++){ ctx.lineTo(path[i][0], path[i][1]); }
    const t = (progress*total) - idx;
    if(idx+1<path.length){
      const [x1,y1]=path[idx], [x2,y2]=path[idx+1];
      ctx.lineTo(x1+(x2-x1)*t, y1+(y2-y1)*t);
    }
    ctx.stroke();
    const [bx,by]= (idx+1<path.length)
      ? [path[idx][0]+(path[idx+1][0]-path[idx][0])*t, path[idx][1]+(path[idx+1][1]-path[idx][1])*t]
      : path[path.length-1];
    ctx.fillStyle='#111'; ctx.beginPath(); ctx.arc(bx,by,8,0,Math.PI*2); ctx.fill();
  }
  function tick(){
    const now=Date.now();
    const total=endTs-startTs;
    const elapsed = Math.min(total, now - startTs - pausedMs);
    const pr = Math.max(0, Math.min(1, elapsed/total));
    timeEl.textContent = fmt(total - elapsed);
    draw(pr);
    if(pr>=1) { close(true); try{ new Notification('Фокус завершён', {body:'Круг выполнен. Отличная работа!'}); }catch(e){} return; }
    raf = requestAnimationFrame(tick);
  }
  function open(durationMs){
    path = makePath(9);
    startTs = Date.now(); endTs = startTs + durationMs; paused=false; pausedMs=0;
    wrap.style.display='block'; tick();
  }
  function close(done=false){
    cancelAnimationFrame(raf);
    wrap.style.display='none';
  }
  pauseBtn.onclick=()=>{
    if(!paused){ paused=true; pauseFrom=Date.now(); pauseBtn.textContent='Продолжить'; cancelAnimationFrame(raf); }
    else{ paused=false; pausedMs += (Date.now()-pauseFrom); pauseBtn.textContent='Пауза'; tick(); }
  };
  stopBtn.onclick=()=> close(false);
  window.startFocusTimer = function(ms){ open(ms); };
})();

/* ===== INIT ===== */
(async function init(){
  await askPerm();
  renderStrip(); renderTasks();
  initSettingsUI();
  setInterval(()=>renderTasks(), 60*1000);
})();
