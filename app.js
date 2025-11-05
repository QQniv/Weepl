/* =========================================================
   WEEPL v5 — app.js (multi-user, users/{uid}/tasks)
   - Per-user data isolation (subcollection)
   - Anonymous auth + optional Google Sign-In
   - Firestore offline cache (multi-tab)
   - Timeline, calendar, masonry, modal, AI placeholder
   ========================================================= */

const $  = (s, r=document)=>r.querySelector(s);
const $$ = (s, r=document)=>Array.from(r.querySelectorAll(s));

/* -------- STATE -------- */
const state = {
  user: null,
  tasks: [],
  habits: [
    { id:"sleep",    name:"Сон",       value:70 },
    { id:"workout",  name:"Тренировки",value:40 },
    { id:"focus",    name:"Фокус",     value:85 },
    { id:"cn",       name:"Китайский", value:55 },
  ],
  today: new Date()
};

/* -------- DOM -------- */
const htmlEl         = document.documentElement;
const todayTitle     = $("#todayTitle");
const todayFullDate  = $("#todayFullDate");
const streakBadge    = $("#streakBadge");

const themeToggle    = $("#themeToggle");
const userMenuBtn    = $("#userMenu");

const fab            = $("#addBtn");
const addModal       = $("#addModal");
const closeModalBtn  = $("#closeModal");
const tabs           = $$(".tab", addModal);
const form           = $("#createForm");

const titleInput     = $("#titleInput");
const dateInput      = $("#dateInput");
const timeDeadline   = $("#timeDeadline");
const timeStart      = $("#timeStart");
const timeEnd        = $("#timeEnd");
const priorityInput  = $("#priorityInput");
const categoryInput  = $("#categoryInput");
const descInput      = $("#descInput");

const taskMasonry    = $("#taskMasonry");
const statDone       = $("#statDone");
const statOverdue    = $("#statOverdue");
const statFocus      = $("#statFocus");

const aiAdviceEl     = $("#aiAdvice");
const aiLastUpdated  = $("#aiLastUpdated");
const aiRefreshBtn   = $("#aiRefresh");
const aiPulse        = $("#aiPulse");

const miniCalendar   = $("#miniCalendar");
const prevMonthBtn   = $("#prevMonth");
const nextMonthBtn   = $("#nextMonth");

const matrixGrid     = $("#matrixGrid");
const toastHost      = $("#toastHost");

const quickFilters   = $$(".quick-filters .chip");
const sortByTimeBtn  = $("#sortByTime");
const sortByPriorityBtn = $("#sortByPriority");

const habitsRings    = $$(".habit-ring");

/* -------- UTIL -------- */
const fmtDate = d => d.toISOString().slice(0,10);
const toLocalDate = s => new Date(`${s}T00:00:00`);
const clamp = (v,min=0,max=100)=>Math.max(min,Math.min(max,v));
const rand  = (a,b)=>Math.floor(Math.random()*(b-a+1))+a;

function toast(msg){
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = msg;
  toastHost.appendChild(el);
  setTimeout(()=>el.remove(), 3000);
}

function rippleAt(btn, x, y){
  const r = document.createElement("span");
  r.className = "ripple";
  const rect = btn.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height);
  r.style.width = r.style.height = `${size}px`;
  r.style.left = `${x - rect.left - size/2}px`;
  r.style.top  = `${y - rect.top  - size/2}px`;
  btn.appendChild(r);
  setTimeout(()=>r.remove(), 600);
}

/* -------- THEME -------- */
function initTheme(){
  const saved = localStorage.getItem("theme");
  if (saved) htmlEl.setAttribute("data-theme", saved);
  themeToggle?.addEventListener("click", (e)=>{
    const cur = htmlEl.getAttribute("data-theme") || "light";
    const next = cur === "light" ? "dark" : "light";
    htmlEl.setAttribute("data-theme", next);
    localStorage.setItem("theme", next);
    rippleAt(themeToggle, e.clientX, e.clientY);
  });
}

/* -------- HEADER DATE -------- */
function renderHeaderDate(){
  const d = state.today;
  const opts = { weekday:"long", day:"numeric", month:"long", year:"numeric" };
  const ru = d.toLocaleDateString("ru-RU", opts);
  todayTitle.textContent = "Сегодня";
  todayFullDate.textContent = ru.charAt(0).toUpperCase() + ru.slice(1);
}

/* -------- MODAL -------- */
function openModal(){
  addModal.hidden = false;
  dateInput.value = fmtDate(state.today);
  tabsSwitch("task");
  titleInput.focus();
}
function closeModal(){ addModal.hidden = true; }

function tabsSwitch(kind){
  tabs.forEach(t=>{
    const active = t.dataset.tab === kind;
    t.classList.toggle("active", active);
  });
  const onlyTask  = $$(".only-task", addModal);
  const onlyEvent = $$(".only-event", addModal);
  const isTask    = kind === "task";
  onlyTask.forEach(el=> el.hidden = !isTask);
  onlyEvent.forEach(el=> el.hidden = isTask);
  form.dataset.kind = kind;
}

/* -------- SCROLL REVEAL -------- */
function initReveal(){
  const io = new IntersectionObserver((entries)=>{
    for(const e of entries){
      if (e.isIntersecting){
        e.target.classList.add("revealed");
        io.unobserve(e.target);
      }
    }
  },{ threshold:.12 });
  $$(".card, .m-item").forEach(el=>{
    el.classList.add("reveal");
    io.observe(el);
  });
}

/* -------- MASONRY RENDER -------- */
function renderTasksMasonry(list = state.tasks){
  taskMasonry.innerHTML = "";
  list.forEach(task=>{
    const item = document.createElement("div");
    item.className = `m-item priority-${task.priority}${task.shape || ""}`;
    if (task.completed) item.classList.add("completed");

    const h = document.createElement("h4");
    h.textContent = task.title;

    const meta = document.createElement("div");
    meta.className = "meta";
    const timeStr = task.type === "event"
      ? `${task.timeStart || "--:--"}–${task.timeEnd || "--:--"}`
      : (task.timeDeadline ? `до ${task.timeDeadline}` : "без времени");
    meta.innerHTML = `<span>${timeStr}</span> · <span>${task.type==="event"?"событие":"задача"}</span>`;

    const actions = document.createElement("div");
    actions.style.marginTop = "8px";
    const btnDone = document.createElement("button");
    btnDone.className = "ghostbtn";
    btnDone.textContent = task.completed ? "Снять выполнено" : "Выполнено";
    btnDone.addEventListener("click", ()=>toggleComplete(task));

    const btnDel = document.createElement("button");
    btnDel.className = "ghostbtn";
    btnDel.style.marginLeft = "8px";
    btnDel.textContent = "Удалить";
    btnDel.addEventListener("click", ()=>removeTask(task));

    actions.append(btnDone, btnDel);
    item.append(h, meta, actions);
    taskMasonry.appendChild(item);
  });
  initReveal();
}

/* -------- HABITS -------- */
function renderHabits(){
  habitsRings.forEach((ring, idx)=>{
    const v = clamp(state.habits[idx]?.value ?? 0);
    ring.style.setProperty("--val", v);
    const span = $("span", ring);
    if (span) span.textContent = `${v}%`;
  });
}

/* -------- CALENDAR -------- */
let calYear  = state.today.getFullYear();
let calMonth = state.today.getMonth();

function gatherCountsByDate(list){
  const map = new Map();
  list.forEach(t=>{
    const k = t.date;
    const v = map.get(k) || { tasks:0, events:0 };
    if (t.type==="event") v.events++; else v.tasks++;
    map.set(k, v);
  });
  return map;
}

function renderMiniCalendar(){
  miniCalendar.innerHTML = "";
  const y = calYear, m = calMonth;
  const first = new Date(y, m, 1);
  const startDay = (first.getDay()+6)%7; // Пн=0
  const daysInMonth = new Date(y, m+1, 0).getDate();
  const counts = gatherCountsByDate(state.tasks);

  const title = document.createElement("div");
  title.style.gridColumn = "1 / -1";
  title.style.display = "flex";
  title.style.justifyContent = "center";
  title.style.gap = "8px";
  title.style.marginBottom = "6px";
  title.innerHTML = `<strong>${first.toLocaleString("ru-RU",{month:"long"})}</strong> ${y}`;
  miniCalendar.appendChild(title);

  ["Пн","Вт","Ср","Чт","Пт","Сб","Вс"].forEach(w=>{
    const d = document.createElement("div");
    d.textContent = w; d.style.opacity=".6"; d.style.fontSize=".85rem";
    miniCalendar.appendChild(d);
  });

  for(let i=0;i<startDay;i++){ const e=document.createElement("div"); e.innerHTML="&nbsp;"; e.style.opacity="0"; miniCalendar.appendChild(e); }

  for(let day=1; day<=daysInMonth; day++){
    const cell = document.createElement("div");
    const dateStr = fmtDate(new Date(y,m,day));
    cell.textContent = day;
    if (dateStr === fmtDate(state.today)) cell.classList.add("is-today");
    const cnt = counts.get(dateStr);
    if (cnt && (cnt.tasks>0 || cnt.events>0)) cell.classList.add("has-items");
    cell.addEventListener("click", ()=>filterByDate(dateStr));
    miniCalendar.appendChild(cell);
  }
}

function filterByDate(dateStr){
  const filtered = state.tasks.filter(t=>t.date===dateStr);
  renderTasksMasonry(filtered);
  toast(`Показаны записи за ${dateStr}`);
}

/* -------- SORT / FILTER -------- */
sortByTimeBtn?.addEventListener("click", ()=>{
  const list = [...state.tasks].sort((a,b)=>{
    const at = a.type==="event" ? (a.timeStart||"24:00") : (a.timeDeadline||"24:00");
    const bt = b.type==="event" ? (b.timeStart||"24:00") : (b.timeDeadline||"24:00");
    return at.localeCompare(bt);
  });
  renderTasksMasonry(list);
});

sortByPriorityBtn?.addEventListener("click", ()=>{
  const list = [...state.tasks].sort((a,b)=> (b.priority||1)-(a.priority||1));
  renderTasksMasonry(list);
});

$$(".quick-filters .chip").forEach(btn=>{
  btn.addEventListener("click", ()=>{
    const r = btn.dataset.range;
    if (r==="today") filterByDate(fmtDate(state.today));
    else if (r==="week"){
      const d0 = new Date(state.today); d0.setDate(d0.getDate()-d0.getDay()+1);
      const d7 = new Date(d0); d7.setDate(d0.getDate()+6);
      const list = state.tasks.filter(t=>{
        const d = toLocalDate(t.date);
        return d>=d0 && d<=d7;
      });
      renderTasksMasonry(list);
    } else {
      const y = state.today.getFullYear();
      const m = state.today.getMonth();
      const list = state.tasks.filter(t=>{
        const d = toLocalDate(t.date);
        return d.getFullYear()===y && d.getMonth()===m;
      });
      renderTasksMasonry(list);
    }
  });
});

prevMonthBtn?.addEventListener("click", ()=>{ calMonth--; if (calMonth<0){calMonth=11; calYear--;} renderMiniCalendar(); });
nextMonthBtn?.addEventListener("click", ()=>{ calMonth++; if (calMonth>11){calMonth=0; calYear++;} renderMiniCalendar(); });

/* -------- PLACEHOLDER AI -------- */
function computeTodayStats(){
  const todayStr = fmtDate(state.today);
  const todayTasks = state.tasks.filter(t=>t.date===todayStr);
  const done = todayTasks.filter(t=>t.completed).length;
  const overdue = todayTasks.filter(t=>{
    if (t.completed) return false;
    const now = new Date();
    if (t.type==="event"){
      if (!t.timeEnd) return false;
      return new Date(`${t.date}T${t.timeEnd}:00`) < now;
    } else {
      if (!t.timeDeadline) return false;
      return new Date(`${t.date}T${t.timeDeadline}:00`) < now;
    }
  }).length;
  const total = todayTasks.length || 1;
  const focus = Math.round((done/total)*100);
  return { done, overdue, focus, total };
}
function generateAdvice(s){
  const bank = [
    ({overdue})=> overdue>0
      ? `Есть просрочки (${overdue}). Закрой одну тяжёлую за 25 минут — разгрузи голову.`
      : `Просрочек нет — идеальный момент закрыть 1 важную цель без отвлечений.`,
    ({focus}) => focus<60
      ? `Фокус ${focus}%. Спринты 20–25 минут, уведомления — в авиарежим.`
      : `Фокус ${focus}%. Держим ритм, закладываем 30 минут на буфер.`,
    ({done,total})=> done/total<0.5
      ? `Выбери «одну важную + одну быструю», добей — обнови список.`
      : `Темп отличный. Дополни день 1 «лягушкой», чтобы усилить эффект.`,
    ()=> `Правило 2 минут: если можно сделать «сейчас» — сделай.`,
    ()=> `Не забивай слоты. 60% времени — дела, 40% — зазоры.`,
  ];
  return bank[rand(0,bank.length-1)](s);
}
function refreshAI(){
  const s = computeTodayStats();
  statDone.textContent    = String(s.done);
  statOverdue.textContent = String(s.overdue);
  statFocus.textContent   = `${s.focus}%`;
  aiAdviceEl.textContent  = generateAdvice(s);
  aiLastUpdated.textContent = `обновлено: ${new Date().toLocaleTimeString("ru-RU",{hour:"2-digit",minute:"2-digit"})}`;

  aiPulse?.classList.remove("pulse"); void aiPulse?.offsetWidth; aiPulse?.classList.add("pulse");
}
aiRefreshBtn?.addEventListener("click", refreshAI);

/* -------- FIREBASE -------- */
let FB = window.FB || null;
let db, auth;
let unsubTasks = null;

async function initFirebase(){
  if (!FB) return;

  db   = FB.db;
  auth = FB.auth;

  // Offline cache + multi-tab
  try{
    const { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } =
      await import("https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js");
    initializeFirestore(FB.app, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
    });
  }catch(e){ console.warn("Firestore persistence not enabled:", e); }

  // Auth: anonymous by default; Google optional via menu
  try{
    const { onAuthStateChanged, signInAnonymously } =
      await import("https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js");

    onAuthStateChanged(auth, async (user)=>{
      if (user){
        state.user = user;
        await ensureUserProfile();         // создать/обновить doc users/{uid}
        subscribeTasks();                  // live-подписка на users/{uid}/tasks
        updateUserChip();
      } else {
        await signInAnonymously(auth).catch(console.error);
      }
    });
  }catch(e){ console.error("Auth error:", e); }
}

async function ensureUserProfile(){
  if (!FB || !state.user) return;
  const { doc, getDoc, setDoc, serverTimestamp } =
    await import("https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js");
  const ref = doc(db, "users", state.user.uid);
  const snap = await getDoc(ref);
  if (!snap.exists()){
    await setDoc(ref, {
      uid: state.user.uid,
      createdAt: serverTimestamp(),
      provider: state.user.providerData?.[0]?.providerId || (state.user.isAnonymous ? "anonymous" : "unknown"),
      displayName: state.user.displayName || null,
      photoURL: state.user.photoURL || null,
      email: state.user.email || null
    }, { merge: true });
  }
}

/* -------- AUTH UI (Google / Sign out) -------- */
userMenuBtn?.addEventListener("click", async ()=>{
  const choice = await promptSheet([
    { id:"google", label:"Войти через Google" },
    { id:"guest",  label:"Продолжить как гость" },
    { id:"logout", label:"Выйти" }
  ]);
  if (!choice) return;

  const { GoogleAuthProvider, signInWithPopup, signOut } =
    await import("https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js");

  if (choice==="google"){
    try{
      await signInWithPopup(auth, new GoogleAuthProvider());
      toast("Вход через Google выполнен");
    }catch(e){ console.error(e); toast("Не удалось войти через Google"); }
  } else if (choice==="logout"){
    try{
      await signOut(auth);
      toast("Вы вышли из аккаунта");
    }catch(e){ console.error(e); }
  } else {
    toast("Режим гостя активен");
  }
});

function updateUserChip(){
  if (!state.user) return;
  const isAnon = state.user.isAnonymous;
  const name = state.user.displayName || (state.user.email || (isAnon ? "Гость" : "Пользователь"));
  userMenuBtn.textContent = (name || "User").slice(0,2).toUpperCase();
}

/* Простая "псевдо-шторка" вместо полноценного меню (без доп. верстки) */
function promptSheet(options){
  return new Promise(resolve=>{
    const overlay = document.createElement("div");
    overlay.style.position="fixed";
    overlay.style.inset="0";
    overlay.style.background="rgba(0,0,0,0.25)";
    overlay.style.zIndex="1000";
    overlay.addEventListener("click", ()=>{ document.body.removeChild(overlay); resolve(null); });

    const sheet = document.createElement("div");
    sheet.style.position="fixed";
    sheet.style.left="50%";
    sheet.style.bottom="10%";
    sheet.style.transform="translateX(-50%)";
    sheet.style.background="var(--card-bg)";
    sheet.style.border="1px solid var(--card-border)";
    sheet.style.borderRadius="16px";
    sheet.style.padding="12px";
    sheet.style.backdropFilter="blur(12px)";

    options.forEach(opt=>{
      const b = document.createElement("button");
      b.className = "ghostbtn";
      b.style.display="block";
      b.style.margin="6px";
      b.textContent = opt.label;
      b.addEventListener("click", (e)=>{
        e.stopPropagation();
        document.body.removeChild(overlay);
        resolve(opt.id);
      });
      sheet.appendChild(b);
    });

    overlay.appendChild(sheet);
    document.body.appendChild(overlay);
  });
}

/* -------- TASKS (users/{uid}/tasks) -------- */
function tasksColRef(){
  return import("https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js").then(({collection})=>{
    return collection(db, "users", state.user.uid, "tasks");
  });
}

async function subscribeTasks(){
  if (!FB || !state.user) return;
  if (unsubTasks) unsubTasks();

  const { query, orderBy, onSnapshot } =
    await import("https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js");
  const col = await tasksColRef();
  const q = query(col, orderBy("date","asc"), orderBy("priority","desc"));

  unsubTasks = onSnapshot(q, (snap)=>{
    state.tasks = snap.docs.map(d=>({ id:d.id, ...d.data() }));
    renderTasksMasonry();
    renderMiniCalendar();
    refreshAI();
  }, (err)=>console.error("onSnapshot tasks:", err));
}

async function addTask(task){
  if (!FB || !state.user){
    // локальная заглушка
    task.id = String(Date.now());
    state.tasks.push(task);
    renderTasksMasonry(); renderMiniCalendar(); refreshAI();
    return;
  }
  const { addDoc, serverTimestamp } =
    await import("https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js");
  const col = await tasksColRef();
  const docRef = await addDoc(col, {
    ...task,
    createdAt: serverTimestamp()
  });
  return docRef.id;
}

async function toggleComplete(task){
  if (!FB || !state.user){
    task.completed = !task.completed;
    renderTasksMasonry(); refreshAI();
    return;
  }
  const { doc, updateDoc } =
    await import("https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js");
  const ref = doc(db, "users", state.user.uid, "tasks", task.id);
  await updateDoc(ref, { completed: !task.completed });
}

async function removeTask(task){
  if (!FB || !state.user){
    state.tasks = state.tasks.filter(t=>t!==task);
    renderTasksMasonry(); renderMiniCalendar(); refreshAI();
    return;
  }
  const { doc, deleteDoc } =
    await import("https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js");
  const ref = doc(db, "users", state.user.uid, "tasks", task.id);
  await deleteDoc(ref);
}

/* -------- FORM -------- */
form?.addEventListener("submit", async (e)=>{
  e.preventDefault();
  const type = form.dataset.kind || "task";
  const title = titleInput.value.trim();
  const date  = dateInput.value;
  const priority = Number(priorityInput.value || 2);
  const category = categoryInput.value.trim();
  const description = descInput.value.trim();

  let payload = {
    type, title, date, priority, category, description,
    completed:false,
    shape: Math.random()>.66 ? " wide" : (Math.random()>.5 ? " tall": "")
  };

  if (type==="event"){
    payload.timeStart = timeStart.value || null;
    payload.timeEnd   = timeEnd.value   || null;
  } else {
    payload.timeDeadline = timeDeadline.value || null;
  }

  await addTask(payload);
  closeModal();
  toast("Добавлено");
  form.reset();
  tabsSwitch("task");
});

/* -------- TABS -------- */
tabs.forEach(tab=>{
  tab.addEventListener("click", ()=>tabsSwitch(tab.dataset.tab));
});

/* -------- FAB / MODAL -------- */
fab?.addEventListener("click", (e)=>{
  openModal();
  rippleAt(fab, e.clientX, e.clientY);
});
closeModalBtn?.addEventListener("click", closeModal);
addModal?.addEventListener("click", (e)=>{
  if (e.target === addModal) closeModal();
});

/* -------- SMART FILL -------- */
$("#smartFill")?.addEventListener("click", ()=>{
  if (!titleInput.value) titleInput.value = "Быстрая задача";
  if (!dateInput.value)  dateInput.value  = fmtDate(state.today);
  if (!priorityInput.value) priorityInput.value = "2";
  toast("Заполнил разумные значения");
});

/* -------- MATRIX DnD (задел) -------- */
function initMatrixDnD(){
  const pills = $$(".pill", matrixGrid);
  pills.forEach(p=>{
    p.draggable = true;
    p.addEventListener("dragstart", e=> e.dataTransfer.setData("text/plain", p.textContent));
  });
  const quads = $$(".quadrant", matrixGrid);
  quads.forEach(q=>{
    q.addEventListener("dragover", e=>{ e.preventDefault(); q.classList.add("drag-over"); });
    q.addEventListener("dragleave", ()=> q.classList.remove("drag-over"));
    q.addEventListener("drop", (e)=>{
      e.preventDefault(); q.classList.remove("drag-over");
      const text = e.dataTransfer.getData("text/plain");
      const li = document.createElement("li");
      li.className = "pill"; li.textContent = text;
      $(".pill-list", q).appendChild(li);
    });
  });
}

/* -------- INIT -------- */
function initTodayDefaults(){
  streakBadge.textContent = "streak: 3";
  renderHeaderDate();
  renderHabits();
  renderMiniCalendar();
  renderTasksMasonry();
  refreshAI();
  initReveal();
  initMatrixDnD();
}

$("#jumpNow")?.addEventListener("click", ()=>{
  document.documentElement.scrollTo({ top:0, behavior:"smooth" });
});

$$(".bottomnav .navbtn").forEach(btn=>{
  btn.addEventListener("click", ()=>{
    $$(".bottomnav .navbtn").forEach(b=>b.classList.remove("active"));
    btn.classList.add("active");
    toast(`Раздел: ${btn.dataset.view}`);
  });
});

/* -------- STARTUP -------- */
initTheme();
initTodayDefaults();
initFirebase();

/* -------- SHORTCUTS -------- */
document.addEventListener("keydown", (e)=>{
  if (e.key==="n" && (e.ctrlKey||e.metaKey)) { e.preventDefault(); openModal(); }
  if (e.key==="Escape" && !addModal.hidden) closeModal();
});

/* =========================================================
   Firestore Rules (в консоли Firebase):
   service cloud.firestore {
     match /databases/{database}/documents {
       match /users/{uid} {
         allow read: if request.auth != null && request.auth.uid == uid;
         allow write: if request.auth != null && request.auth.uid == uid;

         match /tasks/{taskId} {
           allow read, write: if request.auth != null && request.auth.uid == uid;
         }
       }
       match /{document=**} { allow read, write: if false; }
     }
   }
   ========================================================= */
