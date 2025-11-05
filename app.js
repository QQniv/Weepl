/* =========================================================
   WEEPL — app.js (v5.1)
   + Свайп вниз для закрытия модалки
   + Тап по pill -> Done/Undo (Firestore)
   - Firebase: anonymous auth + Firestore CRUD
   - Главная: дата/приветствие, счетчики, превью задач
   - Модалка: задача/событие (дедлайн/интервал), Эйзенхауэр, помодоро
   - Диаграмма активности (canvas, 7 дней)
   - Базовый AI-совет
   ========================================================= */

/* ---------- DOM ---------- */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const fullDateEl     = $("#fullDate");
const userFirstName  = $("#userFirstName");
const todayCountEl   = $("#todayCount");
const progressPctEl  = $("#progressPct");
const todoCountEl    = $("#todoCount");
const doneCountEl    = $("#doneCount");
const tasksPreviewEl = $("#tasksPreview");
const doneTotalEl    = $("#doneTotal");
const aiAdviceEl     = $("#aiAdvice .ai-text");

const addTaskBtn = $("#addTaskBtn");
const dockAddBtn = $("#dockAdd");

const modal         = $("#taskModal");
const modalSheet    = $(".modal-sheet");
const modalBackdrop = $(".modal-backdrop");
const typeToggle    = $(".type-toggle");
const typeBtns      = $$(".type-btn");
const scopeTask     = $('[data-scope="task"]');
const scopeEvent    = $('[data-scope="event"]');

const taskForm      = $("#taskForm");
const titleInput    = $("#titleInput");
const dateInput     = $("#dateInput");
const timeInput     = $("#timeInput");
const startInput    = $("#startInput");
const endInput      = $("#endInput");
const categoryInput = $("#categoryInput");
const pomodoroInput = $("#pomodoroInput");
const repeatInput   = $("#repeatInput");
const noteInput     = $("#noteInput");

/* ---------- Utils ---------- */
const fmtFullDate = (d = new Date()) =>
  new Intl.DateTimeFormat("ru-RU", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  }).format(d);

const pad2 = (n) => String(n).padStart(2, "0");
const dayKeyOf = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const todayKey = dayKeyOf(new Date());

/* ---------- Initial UI ---------- */
fullDateEl.textContent = fmtFullDate();
userFirstName.textContent = "Денис"; // заменим из профиля позже

/* ---------- Firebase (из окна) ---------- */
const { app, auth, db } = window.__WEEPL__;

/* ---------- Firebase Auth: anonymous ---------- */
import("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js").then(
  async ({ signInAnonymously, onAuthStateChanged, updateProfile }) => {
    onAuthStateChanged(auth, async (user) => {
      if (!user) { await signInAnonymously(auth); return; }
      try { if (!user.displayName) await updateProfile(user, { displayName: "Денис" }); } catch {}
      userFirstName.textContent = user.displayName || "Гость";
      attachTodayListener(user.uid);
      calcDoneTotal(user.uid);
      renderChartLast7(user.uid);
    });
  }
);

/* ---------- Firestore helpers ---------- */
let fs;
async function ensureFS() {
  if (fs) return fs;
  fs = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
  return fs;
}

/* ---------- Modal open/close (без автофокуса) ---------- */
function openModal() {
  document.body.classList.add("modal-open");
  modal.setAttribute("aria-hidden", "false");
  scopeTask.hidden = false; scopeEvent.hidden = true;
  typeBtns.forEach((b) => b.classList.toggle("active", b.dataset.type === "task"));
  // сброс смещения шторки на случай прошлых жестов
  modalSheet.style.transform = "";
  modalSheet.style.transition = "";
}
function closeModal() {
  document.body.classList.remove("modal-open");
  modal.setAttribute("aria-hidden", "true");
  taskForm.reset();
  scopeTask.hidden = false; scopeEvent.hidden = true;
  typeBtns.forEach((b) => b.classList.toggle("active", b.dataset.type === "task"));
}
addTaskBtn.addEventListener("click", openModal);
dockAddBtn.addEventListener("click", openModal);
modalBackdrop.addEventListener("click", closeModal);
$$('[data-close]').forEach((b)=>b.addEventListener("click", closeModal));

/* ---------- Swipe-to-close для шторки ---------- */
(() => {
  let startY = 0, currentY = 0, dragging = false;

  const onStart = (e) => {
    dragging = true;
    modalSheet.style.transition = "none";
    startY = (e.touches ? e.touches[0].clientY : e.clientY);
  };
  const onMove = (e) => {
    if (!dragging) return;
    currentY = (e.touches ? e.touches[0].clientY : e.clientY);
    const dy = Math.max(0, currentY - startY);
    // тянем только вниз, небольшая упругость
    modalSheet.style.transform = `translateY(${dy}px)`;
  };
  const onEnd = () => {
    if (!dragging) return;
    dragging = false;
    const dy = Math.max(0, currentY - startY);
    modalSheet.style.transition = "transform .22s ease";
    if (dy > 120) { // порог закрытия
      modalSheet.style.transform = `translateY(100%)`;
      setTimeout(closeModal, 180);
    } else {
      modalSheet.style.transform = "";
    }
  };

  // Жесты только когда модалка открыта
  modalSheet.addEventListener("touchstart", onStart, { passive: true });
  modalSheet.addEventListener("touchmove",  onMove,  { passive: true });
  modalSheet.addEventListener("touchend",   onEnd);
  modalSheet.addEventListener("mousedown",  onStart);
  window.addEventListener("mousemove", onMove);
  window.addEventListener("mouseup",   onEnd);
})();

/* ---------- Тип записи: задача/событие ---------- */
typeToggle.addEventListener("click", (e) => {
  const btn = e.target.closest(".type-btn");
  if (!btn) return;
  typeBtns.forEach((b) => b.classList.toggle("active", b === btn));
  const isTask = btn.dataset.type === "task";
  scopeTask.hidden  = !isTask;
  scopeEvent.hidden =  isTask;
});
document.addEventListener("DOMContentLoaded", () => {
  scopeTask.hidden = false; scopeEvent.hidden = true;
});

/* ---------- Submit form ---------- */
taskForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const user = auth.currentUser;
  if (!user) return;

  await ensureFS();
  const { addDoc, collection, serverTimestamp } = fs;

  const isTask = typeBtns.find((b) => b.classList.contains("active")).dataset.type === "task";
  const title = titleInput.value.trim();
  if (!title) return;

  let payload = {
    title,
    category: categoryInput.value,
    prio: document.querySelector('input[name="prio"]:checked')?.value || "B",
    pomodoro: pomodoroInput.value,
    repeat: repeatInput.value,
    note: noteInput.value.trim(),
    type: isTask ? "task" : "event",
    status: "todo",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  if (isTask) {
    const dateVal = dateInput.value ? new Date(`${dateInput.value}T00:00:00`) : new Date();
    payload.dayKey = dayKeyOf(dateVal);
    payload.dueTime = timeInput.value || null;
  } else {
    const start = startInput.value ? new Date(startInput.value) : new Date();
    let end = endInput.value ? new Date(endInput.value) : new Date(start.getTime() + 60*60*1000);
    if (end < start) end = new Date(start.getTime() + 30*60*1000);
    payload.start = start.toISOString();
    payload.end   = end.toISOString();
    payload.dayKey = dayKeyOf(start);
  }

  try {
    await addDoc(collection(db, `users/${user.uid}/tasks`), payload);
    closeModal();
  } catch (err) {
    console.error("add task error", err);
    alert("Не удалось сохранить. Проверь правила Firestore и интернет.");
  }
});

/* ---------- Today listener ---------- */
let unsubToday = null;
async function attachTodayListener(uid) {
  await ensureFS();
  const { collection, query, where, orderBy, onSnapshot } = fs;

  if (unsubToday) unsubToday();

  const q = query(
    collection(db, `users/${uid}/tasks`),
    where("dayKey", "==", todayKey),
    orderBy("createdAt", "asc")
  );

  unsubToday = onSnapshot(q, (snap) => {
    const tasks = [];
    snap.forEach((d) => tasks.push({ id: d.id, ...d.data() }));
    renderToday(tasks);
  });
}

/* ---------- Render: today + pills с data-id ---------- */
function renderToday(tasks) {
  const todo = tasks.filter(t => t.status !== "done");
  const done = tasks.filter(t => t.status === "done");

  todayCountEl.textContent = tasks.length;
  todoCountEl.textContent  = todo.length;
  doneCountEl.textContent  = done.length;

  const pct = tasks.length ? Math.round((done.length / tasks.length) * 100) : 0;
  progressPctEl.textContent = `${pct}%`;

  tasksPreviewEl.innerHTML = "";
  for (const t of tasks.slice(0, 20)) {
    const pill = document.createElement("button");
    pill.type = "button";
    const prio = (t.prio || "B").toUpperCase();
    const isDone = t.status === "done";
    pill.className = `task-pill prio-${prio}${isDone ? " is-done" : ""}`;
    pill.dataset.id = t.id;
    pill.dataset.status = t.status;

    let timeText = "";
    if (t.type === "task" && t.dueTime) timeText = ` — ${t.dueTime}`;
    if (t.type === "event" && t.start) {
      const st = new Date(t.start);
      timeText = ` — ${pad2(st.getHours())}:${pad2(st.getMinutes())}`;
    }
    pill.textContent = `${t.title}${timeText}`;
    tasksPreviewEl.appendChild(pill);
  }

  aiAdviceEl.textContent = generateAdvice({todo: todo.length, done: done.length, pct});
}

/* ---------- Tap on pill -> toggle done/undo ---------- */
tasksPreviewEl.addEventListener("click", async (e) => {
  const pill = e.target.closest(".task-pill");
  if (!pill) return;
  const id = pill.dataset.id;
  if (!id) return;

  const user = auth.currentUser;
  if (!user) return;

  await ensureFS();
  const { doc, updateDoc, serverTimestamp } = fs;

  // оптимистичное обновление UI
  const willBeDone = pill.dataset.status !== "done";
  pill.dataset.status = willBeDone ? "done" : "todo";
  pill.classList.toggle("is-done", willBeDone);

  try {
    await updateDoc(doc(db, `users/${user.uid}/tasks/${id}`), {
      status: willBeDone ? "done" : "todo",
      updatedAt: serverTimestamp(),
    });
    // слушатель onSnapshot сам перерисует счетчики/прогресс
  } catch (err) {
    // откат UI при ошибке
    pill.dataset.status = willBeDone ? "todo" : "done";
    pill.classList.toggle("is-done", !willBeDone);
    console.error("toggle done error", err);
    alert("Не удалось изменить статус. Проверь соединение и правила Firestore.");
  }
});

/* ---------- Simple AI advice ---------- */
function generateAdvice({todo, done, pct}) {
  if (todo === 0 && done === 0) return "Начни с одной мини-задачи класса A на 15 минут, чтобы запустить инерцию.";
  if (pct < 40 && todo >= 3)   return "Сделай «разогрев» из 2 быстрых задач (≤5 мин), затем 25-мин фокус на самой важной A-задаче.";
  if (pct >= 80 && todo <= 2)  return "Отличный темп! Подведи итоги дня и запланируй 1 B-задачу на завтра.";
  if (done >= 5)               return "Хороший прогресс. Возьми 10-мин перерыв и проверь задачи C/D на делегирование.";
  return "Выбери одну A-задачу, включи таймер 25 минут и отключи уведомления на час.";
}

/* ---------- Done total (all time) ---------- */
async function calcDoneTotal(uid) {
  await ensureFS();
  const { collection, query, where, getDocs } = fs;
  try {
    const q = query(collection(db, `users/${uid}/tasks`), where("status","==","done"));
    const snap = await getDocs(q);
    doneTotalEl.textContent = String(snap.size);
  } catch { doneTotalEl.textContent = "0"; }
}

/* ---------- Minimal chart (last 7 days) ---------- */
async function renderChartLast7(uid) {
  await ensureFS();
  const { collection, query, where, getDocs, Timestamp } = fs;

  const days = [];
  const counts = [];
  const now = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    days.push(dayKeyOf(d).slice(5));
    counts.push(0);
  }

  try {
    const from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
    const q = query(
      collection(db, `users/${uid}/tasks`),
      where("createdAt", ">", Timestamp.fromDate(from))
    );
    const snap = await getDocs(q);
    const byKey = {};
    snap.forEach(docSnap => {
      const t = docSnap.data();
      if (t.status === "done" && t.dayKey) {
        byKey[t.dayKey] = (byKey[t.dayKey] || 0) + 1;
      }
    });
    for (let i = 0; i < days.length; i++) {
      const fullKey = `${now.getFullYear()}-${days[i]}`;
      counts[i] = byKey[fullKey] || 0;
    }
  } catch {}

  drawBars($("#activityChart"), days, counts);
}

/* ---------- Canvas bars ---------- */
function drawBars(canvas, labels, values) {
  const ctx = canvas.getContext("2d");
  const W = canvas.width = canvas.offsetWidth * devicePixelRatio;
  const H = canvas.height = 140 * devicePixelRatio;
  ctx.scale(devicePixelRatio, devicePixelRatio);

  ctx.clearRect(0,0,W,H);

  const pad = 12;
  const chartW = canvas.offsetWidth - pad*2;
  const chartH = 110;

  const maxVal = Math.max(4, ...values);
  const barW = chartW / values.length * 0.7;
  const gap  = (chartW / values.length) - barW;

  ctx.strokeStyle = getComputedStyle(document.body).getPropertyValue('--stroke').trim();
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(pad, chartH + pad);
  ctx.lineTo(pad + chartW, chartH + pad);
  ctx.stroke();

  const accent = getComputedStyle(document.body).getPropertyValue('--accent').trim() || '#6ea8ff';
  for (let i = 0; i < values.length; i++) {
    const x = pad + i*(barW+gap) + gap/2;
    const h = Math.round((values[i]/maxVal) * (chartH - 8));
    const y = pad + chartH - h;
    const radius = 8;

    ctx.fillStyle = accent;
    roundRect(ctx, x, y, barW, h, radius);
    ctx.fill();

    ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--text-dim').trim();
    ctx.font = "10px Inter, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(labels[i], x + barW/2, chartH + pad + 12);
  }
}
function roundRect(ctx, x, y, w, h, r) {
  if (h < r*2) r = h/2;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y,     x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x,     y + h, r);
  ctx.arcTo(x,     y + h, x,     y,     r);
  ctx.arcTo(x,     y,     x + w, y,     r);
  ctx.closePath();
}

/* ---------- Segmented tabs (визуально) ---------- */
$(".segmented").addEventListener("click", (e) => {
  const btn = e.target.closest(".seg");
  if (!btn) return;
  $$(".seg").forEach(b => b.classList.toggle("active", b === btn));
});

/* ---------- Icons reinit ---------- */
const reinitIcons = () => { if (window.lucide) window.lucide.createIcons(); };
document.addEventListener("DOMContentLoaded", reinitIcons);
