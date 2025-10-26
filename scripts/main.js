/* scripts/main.js
   Логика экрана Today: дни, таймлайн, FAB + шторка добавления,
   локальное хранилище, уведомления, онбординг, фокус-таймер и конфетти. */

/* ========= helpers / state ========= */
const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));

const state = {
  selectedDate: new Date(),
  tasks: JSON.parse(localStorage.getItem("tasks_v4") || "[]"),
  haptics: localStorage.getItem("haptics_v1") || "on",
  sounds: localStorage.getItem("sounds_v1") || "on",
};

const RU_M = [
  "января","февраля","марта","апреля","мая","июня",
  "июля","августа","сентября","октября","ноября","декабря"
];
const RU_DOW = ["Вс","Пн","Вт","Ср","Чт","Пт","Сб"];

const startOfDay = (d) => { const x = new Date(d); x.setHours(0,0,0,0); return x; };
const sameDay = (a,b) => startOfDay(a).getTime() === startOfDay(b).getTime();
const addDays = (d,n)=>{ const x=new Date(d); x.setDate(x.getDate()+n); return x; };
const fmtTime = (ts)=> new Date(ts).toTimeString().slice(0,5);
const save = ()=> localStorage.setItem("tasks_v4", JSON.stringify(state.tasks));

/* ========= top bar ========= */
$("#btnBell")?.addEventListener("click", askPerm);
$$(".tab").forEach(btn=>{
  btn.addEventListener("click",()=>{
    const scr = btn.dataset.screen;
    if(scr==="settings"){ location.href="settings.html"; return; }
    if(scr!=="today"){ toast("Раздел появится в следующей версии ✨"); }
  });
});

/* ========= month / days strip ========= */
$("#prev").addEventListener("click",()=>{ state.selectedDate = addDays(state.selectedDate, -1); renderStrip(); renderTasks(); });
$("#next").addEventListener("click",()=>{ state.selectedDate = addDays(state.selectedDate, +1); renderStrip(); renderTasks(); });

function renderStrip(anchor = state.selectedDate){
  const cont = $("#dayStrip"); cont.innerHTML = "";
  const today = new Date();
  $("#monthLabel").textContent = RU_M[anchor.getMonth()].replace(/^./, c => c.toUpperCase());
  const days = [-1,0,1,2,3,4,5].map(n => addDays(anchor, n-1));
  days.forEach(d=>{
    const el = document.createElement("button");
    el.type = "button";
    el.className = "day" + (sameDay(d,today)?" today":"") + (sameDay(d,state.selectedDate)?" selected":"");
    el.innerHTML = `
      <div class="dow">${RU_DOW[d.getDay()]}</div>
      <div class="date">${String(d.getDate()).padStart(2,"0")}</div>
      <div class="mon">${RU_M[d.getMonth()]}</div>
    `;
    el.addEventListener("click",()=>{ state.selectedDate=d; renderStrip(d); renderTasks(); });
    cont.appendChild(el);
  });
}

/* ========= timeline ========= */
function humanLeft(ts){
  const diff = ts - Date.now();
  if(diff<=0) return "Уже пора";
  const m = Math.floor(diff/60000), h=Math.floor(m/60), d=Math.floor(h/24);
  if(d>0) return `Через ${d} дн ${h%24} ч`;
  if(h>0) return `Через ${h} ч ${m%60} мин`;
  return `Через ${m} мин`;
}
function catBadgeEl(c){
  const map={A:"A/важно",B:"B/важно",C:"C/срочно",D:"D/отложить"};
  const s=document.createElement("span");
  s.className="badge" + (c==="B"?" ok":"");
  s.textContent=map[c]||"Кат.";
  return s;
}
function renderTasks(){
  const list = $("#taskList"); list.innerHTML="";
  const ds = startOfDay(state.selectedDate).getTime(), de = ds + 86400000;

  const todays = state.tasks.filter(t=>{
    if(t.isSlot) return (t.start && t.start<de) && (t.end && t.end>=ds);
    return t.due && t.due>=ds && t.due<de;
  });
  const inbox = state.tasks.filter(t=>!t.due && !t.isSlot);

  const rows = [...todays, ...inbox];
  if(rows.length===0){
    const empty = document.createElement("div");
    empty.style.cssText="color:var(--muted);padding:12px 0 24px";
    empty.textContent="Пока пусто. Добавь задачу через «＋».";
    list.appendChild(empty); return;
  }

  rows.forEach((t,i)=>{
    const row = document.createElement("div");
    row.className = "item " + (i===0?"big ":"") + (t.done?"done":"");
    row.style.position="relative";
    row.innerHTML = `
      <div class="time">${t.isSlot ? `${fmtTime(t.start)}<br>— ${fmtTime(t.end)}` : (t.due?fmtTime(t.due):"Inbox")}</div>
      <div>
        <div class="titleRow">
          <div class="title">${escapeHtml(t.title)}</div>
        </div>
        <div class="meta">${t.isSlot?"Событие":"Задача"} · ${t.due||t.start?humanLeft(t.due||t.start):"без даты"} ${t.notify?"· 🔔":""}</div>
      </div>
      <div class="actions">
        <button class="icon-btn" title="Готово">✓</button>
        <button class="icon-btn" title="Редактировать">✎</button>
        ${t.isSlot?'<button class="icon-btn" title="Фокус-таймер">⏱</button>':""}
      </div>
    `;
    row.querySelector(".titleRow").appendChild(catBadgeEl(t.cat));
    const dot = document.createElement("div"); dot.className="dot"; row.appendChild(dot);

    const [doneBtn, editBtn, focusBtn] = row.querySelectorAll(".icon-btn");
    doneBtn?.addEventListener("click", ()=>{
      t.done = !t.done; save(); renderTasks(); haptic(20); confettiFor(row); playDing();
    });
    editBtn?.addEventListener("click", ()=> openSheet(t));
    focusBtn?.addEventListener("click", ()=>{
      const ms = Math.max(5*60*1000, (t.end||0) - (t.start||0));
      startFocusTimer(ms);
    });

    list.appendChild(row);
  });
}
function escapeHtml(s){ return (s||"").replace(/[&<>"']/g, (m)=>({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[m])); }

/* ========= FAB + sheet ========= */
const sheet = $("#sheet");
const bd    = $("#bd");
const fab   = $("#fab");

fab.addEventListener("click",()=>{
  fab.classList.add("bounce"); setTimeout(()=>fab.classList.remove("bounce"),220);
  openSheet();
});

$("#btnCancel").addEventListener("click", closeSheet);
bd.addEventListener("click", closeSheet);

function openSheet(existing){
  sheet.classList.add("open"); bd.classList.add("open");
  $("#f_title").value = existing?.title || "";
  setCat(existing?.cat || "A");
  setType(existing?.isSlot ? "slot":"task");

  setWhen(existing?.due ? "pick" : (existing ? (existing.inbox?"inbox":"today") : "today"));
  const baseD = existing?.due ? new Date(existing.due) : new Date();
  $("#f_date").value = toDateInput(baseD);
  $("#f_time").value = toTimeInput(baseD);

  const sD = existing?.start ? new Date(existing.start) : new Date();
  $("#f_start_date").value = toDateInput(sD);
  $("#f_start_time").value = toTimeInput(sD);
  const eD = existing?.end ? new Date(existing.end) : new Date(Date.now()+60*60*1000);
  $("#f_end_date").value = toDateInput(eD);
  $("#f_end_time").value = toTimeInput(eD);

  $("#f_notify").value = existing?.notify || "none";
  $("#f_quick").value = "";
  sheet.dataset.id = existing?.id || "";
}
function closeSheet(){ sheet.classList.remove("open"); bd.classList.remove("open"); sheet.dataset.id=""; }

function toDateInput(d){ return new Date(d).toISOString().slice(0,10); }
function toTimeInput(d){ return new Date(d).toTimeString().slice(0,5); }

/* приоритет */
$("#f_eisen").addEventListener("click",(e)=>{
  if(e.target.classList.contains("chip")) setCat(e.target.dataset.cat);
});
function setCat(cat){
  $$("#f_eisen .chip").forEach(b=>b.setAttribute("aria-pressed", b.dataset.cat===cat?"true":"false"));
  sheet.dataset.cat = cat;
}

/* тип: задача/событие */
$("#f_type").addEventListener("click",(e)=>{
  if(e.target.tagName==="BUTTON") setType(e.target.dataset.type);
});
function setType(tp){
  $$("#f_type button").forEach(b=>b.setAttribute("aria-pressed", b.dataset.type===tp?"true":"false"));
  sheet.dataset.type = tp;
  $("#taskTimeBlock").hidden = !(tp==="task");
  $("#slotTimeBlock").hidden = !(tp==="slot");
}

/* когда (для задач) */
$("#f_when").addEventListener("click",(e)=>{
  if(e.target.tagName==="BUTTON") setWhen(e.target.dataset.mode);
});
function setWhen(mode){
  $$("#f_when button").forEach(b=>b.setAttribute("aria-pressed", b.dataset.mode===mode?"true":"false"));
  sheet.dataset.when = mode;
  $("#f_date").closest(".field").style.display = (mode==="pick") ? "block" : "none";
  $("#f_time").closest(".field").style.display = (mode!=="inbox") ? "block" : "none";
}

/* авто-установка «за 15 мин», если введено время */
$("#f_time").addEventListener("change", ()=>{ if($("#f_notify").value==="none"){ $("#f_notify").value="15"; } });

/* быстрый парсер даты */
function parseQuick(s){
  if(!s) return {};
  s=s.trim().toLowerCase();
  const out={};
  if(/послезавтра/.test(s)) out.date=addDays(new Date(),2);
  else if(/завтра/.test(s)) out.date=addDays(new Date(),1);
  else if(/сегодня/.test(s)) out.date=new Date();
  const m=s.match(/(\d{1,2})[:.](\d{2})/);
  if(m){ const d=out.date||new Date(); d.setHours(+m[1],+m[2],0,0); out.date=d; }
  out.title = s.replace(/(сегодня|завтра|послезавтра|\d{1,2}[:.]\d{2})/g,'').trim();
  return out;
}

/* создание / обновление */
$("#btnCreate").addEventListener("click",()=>{
  const quick = parseQuick($("#f_quick").value);
  const title = (quick.title || $("#f_title").value).trim();
  if(!title){ alert("Введите название"); return; }

  const cat = sheet.dataset.cat || "A";
  const tp  = sheet.dataset.type || "task";

  let due=null, inbox=false, isSlot=false, start=null, end=null;

  if(tp==="slot"){
    isSlot=true;
    const sd = $("#f_start_date").value ? new Date($("#f_start_date").value) : new Date();
    const st = $("#f_start_time").value || "13:00"; const [sh,sm] = st.split(":"); sd.setHours(+sh||13, +sm||0, 0, 0); start = sd.getTime();
    const ed = $("#f_end_date").value ? new Date($("#f_end_date").value) : new Date(sd);
    const et = $("#f_end_time").value || "14:00"; const [eh,em] = et.split(":"); ed.setHours(+eh||14, +em||0, 0, 0); end = ed.getTime();
    if(end<=start) end = start + 60*60*1000;
  } else {
    const mode = sheet.dataset.when || "today";
    if(mode==="inbox"){ inbox=true; }
    else{
      const base = quick.date || new Date();
      if(mode==="pick"){
        const d = $("#f_date").value ? new Date($("#f_date").value) : base;
        const tm = $("#f_time").value || "18:00"; const [hh,mm]=tm.split(":"); d.setHours(+hh||18, +mm||0, 0, 0); due = d.getTime();
      } else {
        const d = startOfDay(new Date());
        const tm = $("#f_time").value || "18:00"; const [hh,mm]=tm.split(":"); d.setHours(+hh||18, +mm||0, 0, 0); due = d.getTime();
      }
    }
  }

  const notifySel = $("#f_notify").value; const notify = notifySel==="none" ? null : notifySel;
  const id = sheet.dataset.id || ("t_" + Math.random().toString(36).slice(2,9));
  const payload = { id, title, cat, due, inbox, notify, done:false, isSlot, start, end };

  const ex = state.tasks.find(x=>x.id===id);
  if(ex) Object.assign(ex, payload); else state.tasks.unshift(payload);
  save(); renderTasks(); scheduleNotification(payload); closeSheet(); haptic(10); playTick();
});

/* ========= Notifications ========= */
async function askPerm(){
  try{
    if("Notification" in window && Notification.permission==="default"){
      await Notification.requestPermission();
    }
  }catch(_){}
}
function scheduleNotification(task){
  if(!("Notification" in window)) return;
  if(Notification.permission!=="granted") return;
  let baseTs = task.isSlot ? task.start : task.due;
  if(!baseTs || !task.notify) return;
  const delta = task.notify==="at" ? 0 : (+task.notify * 60000);
  const fireAt = baseTs - delta;
  const delay = fireAt - Date.now();
  setTimeout(()=>{
    try{ new Notification("Напоминание", { body: task.title }); }catch(_){}
  }, Math.max(0, Math.min(delay, 2147000000)));
}

/* ========= Haptics + sounds ========= */
function haptic(ms){ if(state.haptics==="on" && "vibrate" in navigator){ try{ navigator.vibrate(ms); }catch(_){}} }
const AudioMod = {
  ctx:null,
  ensure(){ if(!this.ctx){ const AC=window.AudioContext||window.webkitAudioContext; if(AC) this.ctx=new AC(); } },
  beep(f=660,d=.06){ if(state.sounds!=="on")return; this.ensure(); if(!this.ctx)return;
    const t=this.ctx.currentTime, o=this.ctx.createOscillator(), g=this.ctx.createGain();
    o.type="sine"; o.frequency.setValueAtTime(f,t); o.connect(g); g.connect(this.ctx.destination);
    g.gain.setValueAtTime(.16,t); g.gain.exponentialRampToValueAtTime(.0001,t+d);
    o.start(t); o.stop(t+d);
  }
};
function playTick(){ AudioMod.beep(700,.05); }
function playDing(){ AudioMod.beep(523,.06); setTimeout(()=>AudioMod.beep(784,.06), 90); }

/* ========= Confetti ========= */
const confettiCanvas = $("#confettiCanvas");
const cctx = confettiCanvas.getContext("2d");
function resizeC(){ confettiCanvas.width = innerWidth; confettiCanvas.height = innerHeight; }
addEventListener("resize", resizeC); resizeC();
function confettiFor(el){
  const r = el.getBoundingClientRect();
  fireConfetti(r.left + r.width - 20, r.top + r.height/2 + scrollY);
}
function fireConfetti(x,y){
  const parts=[]; const colors=["#fff", getAccent(), "#FFD84D", "#8B5CF6", "#22D3EE"];
  for(let i=0;i<36;i++){
    parts.push({x,y,vx:(Math.random()*2-1)*4,vy:(Math.random()*-3-1),life:60,color:colors[i%colors.length],s:Math.random()*3+2});
  }
  let f=0; (function tick(){
    cctx.clearRect(0,0,confettiCanvas.width,confettiCanvas.height);
    parts.forEach(p=>{p.x+=p.vx; p.y+=p.vy; p.vy+=.12; p.life--; cctx.fillStyle=p.color; cctx.fillRect(p.x,p.y,p.s,p.s*1.4);});
    if(f++<90) requestAnimationFrame(tick); else cctx.clearRect(0,0,confettiCanvas.width,confettiCanvas.height);
  })();
}
function getAccent(){ return getComputedStyle(document.documentElement).getPropertyValue("--accent").trim(); }

/* ========= Onboarding ========= */
(function(){
  const slides = [
    {h:"Добро пожаловать", p:["Свайпай дни сверху.","Добавляй через «＋»."]},
    {h:"Приоритет A/B/C/D", p:["A — срочно и важно.","B — важно (план).","C — срочно, не важно.","D — позже."]},
    {h:"SMART", p:["Заполни хотя бы 2 пункта при создании — мозгу легче."]},
  ];
  const wrap=$("#obWrap"), stepEl=$("#obStep"), dots=$("#obDots"), next=$("#obNext"), skip=$("#obSkip");
  if(!localStorage.getItem("onboard_done")){
    let i=0;
    function render(){
      stepEl.innerHTML = `<div class="ob-h">${slides[i].h}</div>` + slides[i].p.map(t=>`<div class="ob-p">• ${t}</div>`).join("");
      dots.innerHTML = slides.map((_,k)=>`<div class="ob-dot ${k===i?"active":""}"></div>`).join("");
      next.textContent = i===slides.length-1 ? "Поехали" : "Дальше";
    }
    function close(){ wrap.hidden=true; localStorage.setItem("onboard_done","1"); }
    next.addEventListener("click",()=>{ if(i<slides.length-1){ i++; render(); } else close(); });
    skip.addEventListener("click", close);
    wrap.hidden=false; render();
  }
})();

/* ========= Focus timer (лабиринт-линия) ========= */
(function(){
  const wrap = $("#ftWrap");
  const cvs  = $("#ftCanvas");
  const ctx  = cvs.getContext("2d");
  const timeEl = $("#ftTime");
  const pauseBtn = $("#ftPause");
  const stopBtn  = $("#ftStop");

  let path=[], startTs=0, endTs=0, paused=false, pauseFrom=0, pausedMs=0, raf=null;

  function makePath(n=9){
    const m=[];
    for(let y=0;y<n;y++){
      const row=[];
      for(let x=0;x<n;x++){
        row.push([ x*(cvs.width/(n-1)), y*(cvs.height/(n-1)) ]);
      }
      if(y%2===1) row.reverse();
      m.push(...row);
    }
    return m;
  }
  function fmt(ms){ const s=Math.max(0,Math.floor(ms/1000)); const mm=String(Math.floor(s/60)).padStart(2,"0"); const ss=String(s%60).padStart(2,"0"); return `${mm}:${ss}`; }
  function draw(progress){
    ctx.clearRect(0,0,cvs.width,cvs.height);
    ctx.globalAlpha=0.12; ctx.strokeStyle=getComputedStyle(document.documentElement).getPropertyValue('--line');
    for(let i=0;i<=10;i++){ const st=i*(cvs.width/10); ctx.beginPath(); ctx.moveTo(st,0); ctx.lineTo(st,cvs.height); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0,st); ctx.lineTo(cvs.width,st); ctx.stroke(); }
    ctx.globalAlpha=1;

    const total=path.length-1, idx=Math.floor(progress*total), t=(progress*total)-idx;
    ctx.lineWidth=6; ctx.lineCap="round"; ctx.strokeStyle=getAccent();
    ctx.beginPath(); ctx.moveTo(path[0][0],path[0][1]); for(let i=1;i<=idx;i++) ctx.lineTo(path[i][0],path[i][1]);
    if(idx+1<path.length){ const [x1,y1]=path[idx],[x2,y2]=path[idx+1]; ctx.lineTo(x1+(x2-x1)*t, y1+(y2-y1)*t); } ctx.stroke();

    const [bx,by]=(idx+1<path.length)?[ path[idx][0]+(path[idx+1][0]-path[idx][0])*t, path[idx][1]+(path[idx+1][1]-path[idx][1])*t ] : path[path.length-1];
    ctx.fillStyle="#111"; ctx.beginPath(); ctx.arc(bx,by,8,0,Math.PI*2); ctx.fill();
  }
  function tick(){
    const now=Date.now(); const total=endTs-startTs; const elapsed=Math.min(total, now-startTs-pausedMs);
    const pr=Math.max(0,Math.min(1,elapsed/total)); timeEl.textContent=fmt(total-elapsed); draw(pr);
    if(pr>=1){ close(); try{ new Notification("Фокус завершён",{body:"Круг выполнен!"}); }catch(_){}
      return;
    }
    raf=requestAnimationFrame(tick);
  }
  function open(durationMs){ path=makePath(9); startTs=Date.now(); endTs=startTs+durationMs; paused=false; pausedMs=0; wrap.hidden=false; tick(); }
  function close(){ cancelAnimationFrame(raf); wrap.hidden=true; }
  pauseBtn.addEventListener("click",()=>{
    if(!paused){ paused=true; pauseFrom=Date.now(); pauseBtn.textContent="Продолжить"; cancelAnimationFrame(raf); }
    else{ paused=false; pausedMs += (Date.now()-pauseFrom); pauseBtn.textContent="Пауза"; tick(); }
  });
  stopBtn.addEventListener("click", close);

  window.startFocusTimer = (ms)=> open(ms);
})();

/* ========= init ========= */
(async function init(){
  await askPerm();
  renderStrip(); renderTasks();

  // демо-данные при первом запуске
  if(!localStorage.getItem("seed_v1")){
    const today = startOfDay(new Date());
    const mk = (h,m)=>{ const d=new Date(today); d.setHours(h,m,0,0); return d.getTime(); };
    state.tasks = [
      {id:"t1",title:"Встреча с клиентом",cat:"B",isSlot:true,start:mk(9,0),end:mk(10,0),notify:"15"},
      {id:"t2",title:"Купить продукты",cat:"C",due:mk(18,0),notify:"30"},
      {id:"t3",title:"Подготовить отчёт",cat:"A",due:mk(21,0),notify:"60"},
    ];
    save(); localStorage.setItem("seed_v1","1");
    renderTasks();
  }

  // автоперерисовка тайм-плашек
  setInterval(()=>renderTasks(), 60*1000);
})();

/* ========= tiny toast ========= */
let toastTimer = 0;
function toast(text){
  clearTimeout(toastTimer);
  let t = $("#__toast");
  if(!t){
    t=document.createElement("div");
    t.id="__toast";
    t.style.cssText="position:fixed;left:50%;bottom:96px;transform:translateX(-50%);background:var(--surface);color:var(--text);border:1px solid var(--line);padding:10px 14px;border-radius:12px;box-shadow:var(--shadow-strong);z-index:99";
    document.body.appendChild(t);
  }
  t.textContent=text; t.style.opacity="1";
  toastTimer=setTimeout(()=>{ t.style.opacity="0"; }, 1500);
}
