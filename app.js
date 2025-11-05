/* =========================================================
   WEEPL v5 — app.js (views, carousel, actions)
   ========================================================= */

const $  = (s, r=document)=>r.querySelector(s);
const $$ = (s, r=document)=>Array.from(r.querySelectorAll(s));

/* -------- STATE -------- */
const state = {
  user: null,
  tasks: [],
  habits: [
    { id:"sleep", name:"Сон", value:70 },
    { id:"workout", name:"Тренировки", value:40 },
    { id:"focus", name:"Фокус", value:85 },
    { id:"cn", name:"Китайский", value:55 }
  ],
  today: new Date(),
  view: "today"
};

/* -------- DOM -------- */
const htmlEl = document.documentElement;
const todayTitle = $("#todayTitle");
const todayFullDate = $("#todayFullDate");
const streakBadge = $("#streakBadge");

const themeToggle = $("#themeToggle");
const userMenuBtn = $("#userMenu");

const views = {
  today: $("#view-today"),
  calendar: $("#view-calendar"),
  habits: $("#view-habits"),
  matrix: $("#view-matrix"),
  settings: $("#view-settings")
};

const navBtns = $$(".bottomnav .navbtn");

const fab = $("#addBtn");
const addModal = $("#addModal");
const closeModalBtn = $("#closeModal");
const tabs = $$(".tab", addModal);
const form = $("#createForm");

const titleInput = $("#titleInput");
const dateInput = $("#dateInput");
const timeDeadline = $("#timeDeadline");
const timeStart = $("#timeStart");
const timeEnd = $("#timeEnd");
const priorityInput = $("#priorityInput");
const categoryInput = $("#categoryInput");
const descInput = $("#descInput");

const taskMasonry = $("#taskMasonry");
const statDone = $("#statDone");
const statOverdue = $("#statOverdue");
const statFocus = $("#statFocus");

const aiAdviceEl = $("#aiAdvice");
const aiLastUpdated = $("#aiLastUpdated");
const aiRefreshBtn = $("#aiRefresh");
const aiCard = $("#aiCard");
const aiPulse = $("#aiPulse");

const miniCalendar = $("#miniCalendar");
const prevMonthBtn = $("#prevMonth");
const nextMonthBtn = $("#nextMonth");

const habitsRail = $("#habitsRail");
const habitsRings = $$(".habit-ring");

const calendarFull = $("#calendarGrid");
const toastHost = $("#toastHost");

const sortByTime = $("#sortByTime");
const sortByPriority = $("#sortByPriority");

/* -------- UTIL -------- */
const fmtDate = d => d.toISOString().slice(0,10);
const toLocalDate = s => new Date(`${s}T00:00:00`);
const clamp = (v,min=0,max=100)=>Math.max(min,Math.min(max,v));
const rand = (a,b)=>Math.floor(Math.random()*(b-a+1))+a;

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
  btn.appendChild(r); setTimeout(()=>r.remove(), 600);
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

/* -------- ROUTER (SPA) -------- */
function showView(name){
  state.view = name;
  Object.entries(views).forEach(([k,el])=>{
    if (!el) return;
    const active = k === name;
    el.hidden = !active;
    el.classList.toggle("active", active);
  });
  navBtns.forEach(b=>{
    b.classList.toggle("active", b.dataset.view===name);
  });
  if (name==="calendar") renderCalendarFull();
  if (name==="habits") renderHabitsEditor();
}

navBtns.forEach(btn=>{
  btn.addEventListener("click", ()=>{
    showView(btn.dataset.view);
  });
});

/* -------- HEADER DATE -------- */
function renderHeaderDate(){
  const d = state.today;
  const opts = { weekday:"long", day:"numeric", month:"long", year:"numeric" };
  const ru = d.toLocaleDateString("ru-RU", opts);
  todayTitle.textContent = state.view==="today" ? "Сегодня" : btnTitle(state.view);
  todayFullDate.textContent = ru.charAt(0).toUpperCase() + ru.slice(1);
}
function btnTitle(view){
  return {calendar:"Календарь", habits:"Привычки", matrix:"Матрица", settings:"Настройки"}[view] || "Сегодня";
}

/* -------- MODAL -------- */
function openModal(){ addModal.hidden=false; dateInput.value=fmtDate(state.today); tabsSwitch("task"); titleInput.focus(); }
function closeModal(){ addModal.hidden=true; }
function tabsSwitch(kind){
  tabs.forEach(t=> t.classList.toggle("active", t.dataset.tab===kind));
  const isTask = kind==="task";
  $$(".only-task", addModal).forEach(el=> el.hidden = !isTask);
  $$(".only-event", addModal).forEach(el=> el.hidden = isTask);
  form.dataset.kind = kind;
}

/* -------- REVEAL -------- */
function initReveal(){
  const io = new IntersectionObserver((entries)=>{
    for(const e of entries){ if (e.isIntersecting){ e.target.classList.add("revealed"); io.unobserve(e.target); } }
  },{ threshold:.12 });
  $$(".card, .m-item").forEach(el=>{ el.classList.add("reveal"); io.observe(el); });
}

/* -------- TASKS RENDER -------- */
function renderTasksMasonry(list=state.tasks){
  taskMasonry.innerHTML = "";
  list.forEach(task=>{
    const item = document.createElement("div");
    item.className = `m-item priority-${task.priority}${task.shape||""}`;
    if (task.completed) item.classList.add("completed");
    item.dataset.id = task.id;

    const h = document.createElement("h4");
    h.textContent = task.title;

    const meta = document.createElement("div");
    meta.className = "meta";
    const timeStr = task.type==="event"
      ? `${task.timeStart||"--:--"}–${task.timeEnd||"--:--"}`
      : (task.timeDeadline?`до ${task.timeDeadline}`:"без времени");
    meta.innerHTML = `<span>${timeStr}</span> · <span>${task.type==="event"?"событие":"задача"}</span>`;

    const actions = document.createElement("div");
    actions.style.marginTop="8px";
    const bDone = document.createElement("button");
    bDone.className="ghostbtn"; bDone.textContent = task.completed?"Снять выполнено":"Выполнено";
    bDone.addEventListener("click", ()=>toggleComplete(task));
    const bEdit = document.createElement("button");
    bEdit.className="ghostbtn"; bEdit.style.marginLeft="8px"; bEdit.textContent="Изменить";
    bEdit.addEventListener("click", ()=>openEdit(task));
    const bDel = document.createElement("button");
    bDel.className="ghostbtn"; bDel.style.marginLeft="8px"; bDel.textContent="Удалить";
    bDel.addEventListener("click", ()=>removeTask(task));
    actions.append(bDone,bEdit,bDel);

    item.append(h, meta, actions);
    taskMasonry.appendChild(item);

    // клик по карточке — быстрый toggle
    item.addEventListener("dblclick", ()=>toggleComplete(task));
  });
  initReveal();
}
function openEdit(task){
  openModal();
  const isEvent = task.type==="event";
  tabsSwitch(isEvent?"event":"task");
  titleInput.value = task.title || "";
  dateInput.value = task.date || fmtDate(state.today);
  priorityInput.value = String(task.priority||2);
  categoryInput.value = task.category || "";
  descInput.value = task.description || "";
  if (isEvent){ timeStart.value = task.timeStart||""; timeEnd.value = task.timeEnd||""; }
  else { timeDeadline.value = task.timeDeadline||""; }
  form.dataset.editing = task.id;
}

/* -------- CALENDAR (mini + full) -------- */
let calYear = state.today.getFullYear();
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
  const startDay = (first.getDay()+6)%7;
  const daysInMonth = new Date(y, m+1, 0).getDate();
  const counts = gatherCountsByDate(state.tasks);

  const title = document.createElement("div");
  title.style.gridColumn="1 / -1"; title.style.display="flex"; title.style.justifyContent="center";
  title.style.gap="8px"; title.style.marginBottom="6px";
  title.innerHTML = `<strong>${first.toLocaleString("ru-RU",{month:"long"})}</strong> ${y}`;
  miniCalendar.appendChild(title);

  ["Пн","Вт","Ср","Чт","Пт","Сб","Вс"].forEach(w=>{
    const d=document.createElement("div"); d.textContent=w; d.style.opacity=".6"; d.style.fontSize=".85rem"; miniCalendar.appendChild(d);
  });

  for(let i=0;i<startDay;i++){ const e=document.createElement("div"); e.innerHTML="&nbsp;"; e.style.opacity="0"; miniCalendar.appendChild(e); }

  for(let day=1; day<=daysInMonth; day++){
    const cell = document.createElement("div");
    const dateStr = fmtDate(new Date(y,m,day));
    cell.textContent = day;
    if (dateStr===fmtDate(state.today)) cell.classList.add("is-today");
    const cnt = counts.get(dateStr);
    if (cnt && (cnt.tasks>0 || cnt.events>0)) cell.classList.add("has-items");
    cell.addEventListener("click", ()=>filterByDate(dateStr));
    miniCalendar.appendChild(cell);
  }
}
function renderCalendarFull(){
  // простая сетка (на месяц) — расширим дальше
  calendarFull.innerHTML = "";
  calendarFull.className = "calendar-full";
  const y = state.today.getFullYear();
  const m = state.today.getMonth();
  const first = new Date(y,m,1);
  const start = (first.getDay()+6)%7;
  const days = new Date(y,m+1,0).getDate();
  const container = document.createElement("div");
  container.className = "calendar-month";
  for(let i=0;i<start;i++){ container.appendChild(document.createElement("div")); }
  for(let d=1; d<=days; d++){
    const cell = document.createElement("div");
    const dateStr = fmtDate(new Date(y,m,d));
    cell.className = "cal-cell";
    cell.innerHTML = `<div class="cal-date">${d}</div><div class="cal-list"></div>`;
    const list = state.tasks.filter(t=>t.date===dateStr).slice(0,3);
    const listEl = $(".cal-list", cell);
    list.forEach(t=>{
      const item = document.createElement("div");
      item.className = "cal-item";
      item.textContent = t.title;
      listEl.appendChild(item);
    });
    cell.addEventListener("click", ()=>{ filterByDate(dateStr); showView("today"); });
    container.appendChild(cell);
  }
  calendarFull.appendChild(container);
}

/* -------- FILTERS / SORT -------- */
function filterByDate(dateStr){
  const filtered = state.tasks.filter(t=>t.date===dateStr);
  renderTasksMasonry(filtered);
  toast(`Показаны записи за ${dateStr}`);
}
sortByTime?.addEventListener("click", ()=>{
  const list = [...state.tasks].sort((a,b)=>{
    const at = a.type==="event" ? (a.timeStart||"24:00") : (a.timeDeadline||"24:00");
    const bt = b.type==="event" ? (b.timeStart||"24:00") : (b.timeDeadline||"24:00");
    return at.localeCompare(bt);
  });
  renderTasksMasonry(list);
});
sortByPriority?.addEventListener("click", ()=>{
  const list = [...state.tasks].sort((a,b)=>(b.priority||1)-(a.priority||1));
  renderTasksMasonry(list);
});
$("#prevMonth")?.addEventListener("click", ()=>{ calMonth--; if (calMonth<0){calMonth=11; calYear--;} renderMiniCalendar(); });
$("#nextMonth")?.addEventListener("click", ()=>{ calMonth++; if (calMonth>11){calMonth=0; calYear++;} renderMiniCalendar(); });

/* -------- HABITS (rings + carousel) -------- */
function renderHabits(){
  habitsRings.forEach((ring, idx)=>{
    const v = clamp(state.habits[idx]?.value ?? 0);
    ring.style.setProperty("--val", v);
    const span = $("span", ring); if (span) span.textContent = `${v}%`;
  });
}
// drag/scroll helpers for rail
function initHabitsRail(){
  let isDown=false, startX=0, scrollL=0;
  habitsRail.addEventListener("pointerdown",(e)=>{ isDown=true; startX=e.clientX; scrollL=habitsRail.scrollLeft; habitsRail.setPointerCapture(e.pointerId); });
  habitsRail.addEventListener("pointermove",(e)=>{ if(!isDown) return; habitsRail.scrollLeft = scrollL - (e.clientX-startX); });
  habitsRail.addEventListener("pointerup",()=>{ isDown=false; });
}

/* -------- AI -------- */
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
    ({overdue})=> overdue>0 ? `Есть просрочки (${overdue}). Закрой одну тяжёлую за 25 мин.` : `Просрочек нет — закрой 1 важную цель без отвлечений.`,
    ({focus})=> focus<60 ? `Фокус ${focus}%. Спринты 20–25 мин, уведомления — в авиарежим.` : `Фокус ${focus}%. Держи ритм, заложи 30 мин буфер.`,
    ({done,total})=> done/total<0.5 ? `Сделай «важную + быструю», добей и обнови список.` : `Темп ок. Добавь одну «лягушку» и закрепи результат.`,
    ()=>`Правило 2 минут: если можно — сделай сейчас.`,
    ()=>`Не забивай календарь: 60% дела, 40% зазоры.`
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
aiCard?.addEventListener("click", (e)=>{
  if ((e.target.closest("button"))) return; // не мешаем кнопке
  refreshAI();
});

/* -------- FIREBASE (users/{uid}/tasks) -------- */
let FB = window.FB || null;
let db, auth, unsubTasks=null;

async function initFirebase(){
  if (!FB) return;
  db = FB.db; auth = FB.auth;

  try{
    const { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } =
      await import("https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js");
    initializeFirestore(FB.app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) });
  }catch(e){ console.warn("Persistence warn:", e); }

  const { onAuthStateChanged, signInAnonymously } =
    await import("https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js");
  onAuthStateChanged(auth, async (user)=>{
    if (user){ state.user=user; await ensureUserProfile(); subscribeTasks(); updateUserChip(); }
    else { await signInAnonymously(auth).catch(console.error); }
  });
}

async function ensureUserProfile(){
  if (!FB || !state.user) return;
  const { doc, getDoc, setDoc, serverTimestamp } =
    await import("https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js");
  const ref = doc(db, "users", state.user.uid);
  const snap = await getDoc(ref);
  if (!snap.exists()){
    await setDoc(ref, { uid:state.user.uid, createdAt: serverTimestamp(), provider: state.user.isAnonymous?"anonymous":"unknown" }, { merge:true });
  }
}
function updateUserChip(){
  const isAnon = state.user?.isAnonymous;
  const name = state.user?.displayName || state.user?.email || (isAnon?"Гость":"Пользователь");
  $("#userMenu").textContent = (name||"U").slice(0,2).toUpperCase();
}

function tasksColRef(){
  return import("https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js")
    .then(({collection})=> collection(db, "users", state.user.uid, "tasks"));
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
  }, console.error);
}
async function addTask(task){
  if (!FB || !state.user){ // локальная заглушка
    task.id=String(Date.now()); state.tasks.push(task); renderTasksMasonry(); renderMiniCalendar(); refreshAI(); return;
  }
  const { addDoc, serverTimestamp } =
    await import("https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js");
  const col = await tasksColRef();
  await addDoc(col, { ...task, createdAt: serverTimestamp() });
}
async function updateTask(taskId, patch){
  if (!FB || !state.user) return;
  const { doc, updateDoc } =
    await import("https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js");
  await updateDoc(doc(db, "users", state.user.uid, "tasks", taskId), patch);
}
async function toggleComplete(task){
  if (!FB || !state.user){
    task.completed=!task.completed; renderTasksMasonry(); refreshAI(); return;
  }
  await updateTask(task.id, { completed: !task.completed });
}
async function removeTask(task){
  if (!FB || !state.user){
    state.tasks = state.tasks.filter(t=>t!==task); renderTasksMasonry(); renderMiniCalendar(); refreshAI(); return;
  }
  const { doc, deleteDoc } =
    await import("https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js");
  await deleteDoc(doc(db, "users", state.user.uid, "tasks", task.id));
}

/* -------- FORM -------- */
form?.addEventListener("submit", async (e)=>{
  e.preventDefault();
  const type = form.dataset.kind || "task";
  const title = titleInput.value.trim();
  const date = dateInput.value;
  const priority = Number(priorityInput.value||2);
  const category = categoryInput.value.trim();
  const description = descInput.value.trim();

  let payload = {
    type, title, date, priority, category, description,
    completed:false,
    shape: Math.random()>.66 ? " wide" : (Math.random()>.5 ? " tall": "")
  };
  if (type==="event"){ payload.timeStart=timeStart.value||null; payload.timeEnd=timeEnd.value||null; }
  else { payload.timeDeadline=timeDeadline.value||null; }

  const editingId = form.dataset.editing;
  if (editingId){ await updateTask(editingId, payload); delete form.dataset.editing; toast("Обновлено"); }
  else { await addTask(payload); toast("Добавлено"); }
  closeModal(); form.reset(); tabsSwitch("task");
});

/* -------- UI BINDINGS -------- */
$("#smartFill")?.addEventListener("click", ()=>{
  if (!titleInput.value) titleInput.value="Быстрая задача";
  if (!dateInput.value)  dateInput.value = fmtDate(state.today);
  if (!priorityInput.value) priorityInput.value="2";
  toast("Заполнил разумные значения");
});

tabs.forEach(tab=> tab.addEventListener("click", ()=>tabsSwitch(tab.dataset.tab)));

fab?.addEventListener("click", (e)=>{ openModal(); rippleAt(fab, e.clientX, e.clientY); });
closeModalBtn?.addEventListener("click", closeModal);
addModal?.addEventListener("click",(e)=>{ if (e.target===addModal) closeModal(); });

$(".timeline-card")?.addEventListener("click", (e)=>{
  if (e.target.closest("button")) return;
  toast("Скоро: быстрые слоты + добавление события по клику");
});
$(".stats-card")?.addEventListener("click", ()=> toast("Скоро: детализация статистики дня"));

$$(".clickable[data-nav]").forEach(el=>{
  el.addEventListener("click", ()=> showView(el.dataset.nav));
});
$("#editHabits")?.addEventListener("click", ()=> showView("habits"));

/* -------- HABITS (full view placeholder) -------- */
function renderHabitsEditor(){
  $("#habitsEditor").textContent = "Редактор привычек (в разработке): добавление, цели, трекинг.";
}

/* -------- INIT -------- */
function init(){
  renderHeaderDate();
  renderHabits();
  renderMiniCalendar();
  renderTasksMasonry();
  refreshAI();
  initReveal();
  initHabitsRail();
}
$("#jumpNow")?.addEventListener("click", ()=> window.scrollTo({top:0, behavior:"smooth"}));
document.addEventListener("keydown",(e)=>{
  if (e.key==="n" && (e.ctrlKey||e.metaKey)) { e.preventDefault(); openModal(); }
  if (e.key==="Escape" && !addModal.hidden) closeModal();
});

/* -------- THEME PRESETS in Settings -------- */
$("#setLight")?.addEventListener("click", ()=>{ htmlEl.setAttribute("data-theme","light"); localStorage.setItem("theme","light"); });
$("#setDark")?.addEventListener("click",  ()=>{ htmlEl.setAttribute("data-theme","dark");  localStorage.setItem("theme","dark");  });

/* -------- AUTH buttons in Settings -------- */
$("#signinGoogle")?.addEventListener("click", async ()=>{
  const { GoogleAuthProvider, signInWithPopup } = await import("https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js");
  try{ await signInWithPopup(FB.auth, new GoogleAuthProvider()); toast("Google вход выполнен"); }catch(e){ toast("Не удалось войти через Google"); }
});
$("#signout")?.addEventListener("click", async ()=>{
  const { signOut } = await import("https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js");
  try{ await signOut(FB.auth); toast("Вы вышли"); }catch(e){ toast("Не удалось выйти"); }
});

/* -------- START -------- */
initTheme();
init();
initFirebase();
