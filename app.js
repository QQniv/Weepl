/* =========================================================
   WEEPL — app.js (fixes)
   - Центрируем выбранную/сегодняшнюю дату в ленте
   - Ровная сетка событий/задач
   - Нормальное закрытие модалок (крестик/Отмена/ESC)
   - Мелкие UX-улучшения
   ========================================================= */

const app = document.getElementById("app");
const dateStrip = document.getElementById("dateStrip");
const monthLabel = document.getElementById("monthLabel");
const yearLabel = document.getElementById("yearLabel");
const todayTitle = document.getElementById("todayTitle");
const timelineView = document.getElementById("timelineView");
const cardsView = document.getElementById("cardsView");

const btnPrev = document.getElementById("btnPrev");
const btnNext = document.getElementById("btnNext");
const addBtn = document.getElementById("addBtn");

const taskModal = document.getElementById("taskModal");
const taskForm = document.getElementById("taskForm");
const taskFormTitle = document.getElementById("taskFormTitle");

const settingsModal = document.getElementById("settingsModal");
const saveSettings = document.getElementById("saveSettings");

const colorSwatches = document.querySelectorAll(".color-swatch");
const customColor = document.getElementById("customColor");

// поля формы
const $ = (s)=>document.querySelector(s);
const inputType = $("#taskType");
const inputTitle = $("#taskTitle");
const inputDesc  = $("#taskDesc");
const inputStart = $("#taskStart");
const inputEnd   = $("#taskEnd");
const inputPriority = $("#taskPriority");
const inputIcon  = $("#taskIcon");

/* --------- STATE --------- */
let currentDate = new Date();
let selectedDate = new Date();
let tasks = JSON.parse(localStorage.getItem("weepl_tasks") || "[]");
let settings = JSON.parse(localStorage.getItem("weepl_settings") || `{
  "theme":"light",
  "view":"timeline",
  "accent":"#007aff"
}`);
let editingId = null;

/* --------- UTILITIES --------- */
const fmtDate = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
const isSameDate = (a,b) => a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate();
const parseMin = (t) => { if(!t) return 0; const [h,m] = t.split(":").map(Number); return h*60+m; };
const minToTime = (m) => `${String(Math.floor(m/60)).padStart(2,"0")}:${String(m%60).padStart(2,"0")}`;
const uid = () => Date.now().toString(36)+Math.random().toString(36).slice(2,7);

/* --------- INITIAL THEME --------- */
applyTheme(settings.theme);
applyAccent(settings.accent);
app.dataset.view = settings.view;

/* =========================================================
   Calendar strip
   ========================================================= */
function renderCalendar(date, centerSelected = true){
  dateStrip.innerHTML="";
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth()+1, 0);

  monthLabel.textContent = start.toLocaleString("ru-RU",{month:"long"}).replace(/^./,c=>c.toUpperCase());
  yearLabel.textContent = start.getFullYear();

  let selectedEl = null;

  for(let d=1; d<=end.getDate(); d++){
    const cur = new Date(date.getFullYear(), date.getMonth(), d);
    const el = document.createElement("button");
    el.type = "button";
    el.className="date";
    if(isSameDate(cur,new Date())) el.classList.add("is-today");
    if(isSameDate(cur,selectedDate)) { el.classList.add("is-selected"); selectedEl = el; }

    el.innerHTML=`
      <div class="dow">${cur.toLocaleDateString("ru-RU",{weekday:"short"})}</div>
      <div class="day">${d}</div>
      <div class="mon">${cur.toLocaleDateString("ru-RU",{month:"short"})}</div>`;
    el.onclick=()=>{
      selectedDate=cur;
      renderCalendar(cur);
      renderTasks();
    };
    dateStrip.appendChild(el);
  }

  // центрируем выбранную дату (по умолчанию это сегодня)
  if (centerSelected && selectedEl) {
    selectedEl.scrollIntoView({inline:"center", behavior:"smooth", block:"nearest"});
  }
}

/* =========================================================
   Rendering tasks
   ========================================================= */
function renderTasks(){
  const dateKey = fmtDate(selectedDate);
  const daily = tasks.filter(t=>t.date===dateKey);

  todayTitle.textContent = isSameDate(selectedDate,new Date()) ? "Сегодня" :
    selectedDate.toLocaleDateString("ru-RU",{day:"numeric",month:"long"});

  timelineView.innerHTML="";
  cardsView.innerHTML="";

  if(daily.length===0){
    const empty = `<div class="empty">Нет событий или задач</div>`;
    timelineView.innerHTML = empty;
    cardsView.innerHTML = empty;
    toggleViews();
    return;
  }

  const events = daily.filter(t=>t.type==="event").sort((a,b)=>a.start.localeCompare(b.start));
  const plain  = daily.filter(t=>t.type==="task"); // без времени

  if(settings.view==="timeline"){
    // события по сетке
    for(const ev of events){
      const row = document.createElement("div");
      row.className = "row"; // сетка 40px + 1fr
      row.innerHTML = `
        <div class="node">
          <div class="pin">${ev.icon||"•"}</div>
        </div>
        <div class="cell">
          <div class="event ${ev.done?'is-done':''}">
            <div class="card">
              <div class="title">${ev.title}</div>
              <div class="meta">${ev.start}–${ev.end}${ev.desc?` • ${ev.desc}`:''}</div>
            </div>
          </div>
        </div>`;
      attachRowHandlers(row, ev.id);
      timelineView.appendChild(row);
    }

    // блок задач
    if(plain.length){
      const hdr = document.createElement("h4");
      hdr.className = "section-sub";
      hdr.textContent = "Задачи";
      timelineView.appendChild(hdr);

      for(const t of plain){
        const row = document.createElement("div");
        row.className="row";
        row.innerHTML=`
          <div class="node">
            <div class="pin pin-task">${t.icon||"•"}</div>
          </div>
          <div class="cell">
            <div class="task ${t.done?'is-done':''}">
              <button class="check">${t.done?'✓':''}</button>
              <div class="info">
                <div class="name">${t.title}</div>
                <div class="priority">Приоритет ${t.priority}</div>
              </div>
            </div>
          </div>`;
        attachRowHandlers(row, t.id);
        timelineView.appendChild(row);
      }
    }
  }

  if(settings.view==="cards"){
    for(const t of daily){
      const row = document.createElement("div");
      row.className="row";
      row.innerHTML=`
        <div class="node">
          <div class="pin ${t.type==='task'?'pin-task':''}">${t.icon||"•"}</div>
        </div>
        <div class="cell">
          <div class="${t.type==='event'?'event':'task'} ${t.done?'is-done':''}">
            ${t.type==='event'
              ? `<div class="card"><div class="title">${t.title}</div><div class="meta">${t.start}–${t.end}</div></div>`
              : `<button class="check">${t.done?'✓':''}</button><div class="info"><div class="name">${t.title}</div><div class="priority">Приоритет ${t.priority}</div></div>`
            }
          </div>
        </div>`;
      attachRowHandlers(row, t.id);
      cardsView.appendChild(row);
    }
  }

  toggleViews();
}

function toggleViews(){
  timelineView.hidden = settings.view !== "timeline";
  cardsView.hidden    = settings.view !== "cards";
}

function attachRowHandlers(row, id){
  // клики по карточке — редактирование
  row.querySelector(".cell").addEventListener("click", ()=> openEdit(id));
  // свайпы
  addSwipe(row, id);
}

/* =========================================================
   Create / Edit
   ========================================================= */
taskForm.addEventListener("submit",(e)=>{
  e.preventDefault();
  const data={
    type: inputType.value,
    title: inputTitle.value.trim(),
    desc:  inputDesc.value.trim(),
    start: inputStart.value,
    end:   inputEnd.value,
    priority: inputPriority.value,
    icon:  inputIcon.value,
    date:  fmtDate(selectedDate),
    done: false
  };
  if(!data.title) return;

  if (data.type === "event") {
    // валидация времени
    if (!data.start || !data.end || parseMin(data.end) <= parseMin(data.start)) {
      alert("У события укажи корректный период времени.");
      return;
    }
  } else {
    // задачи не должны иметь времени
    data.start = ""; data.end = "";
  }

  if(editingId){
    const i = tasks.findIndex(t=>t.id===editingId);
    if(i>-1) tasks[i] = { ...tasks[i], ...data };
  } else {
    data.id = uid();
    tasks.push(data);
  }

  saveTasks();
  closeDialog(taskModal);
  taskForm.reset();
  renderTasks();
  editingId = null;
});

function openEdit(id){
  const t=tasks.find(x=>x.id===id);
  if(!t) return;
  editingId=id;
  taskFormTitle.textContent="Редактировать";
  inputType.value = t.type;
  inputTitle.value = t.title;
  inputDesc.value  = t.desc || "";
  inputStart.value = t.start || "";
  inputEnd.value   = t.end || "";
  inputPriority.value = t.priority || "B";
  inputIcon.value  = t.icon || "•";
  openDialog(taskModal);
}

/* =========================================================
   Swipe: right=done, left=postpone (events)
   ========================================================= */
function addSwipe(el,id){
  let startX=0, startY=0;
  el.addEventListener("touchstart",(e)=>{startX=e.touches[0].clientX; startY=e.touches[0].clientY;},{passive:true});
  el.addEventListener("touchend",(e)=>{
    const dx=e.changedTouches[0].clientX-startX;
    const dy=e.changedTouches[0].clientY-startY;
    if(Math.abs(dx)>60 && Math.abs(dy)<40){
      if(dx>0) markDone(id);
      else postpone(id);
    }
  });
}
function markDone(id){
  const t=tasks.find(x=>x.id===id);
  if(t){ t.done=!t.done; saveTasks(); renderTasks(); }
}
function postpone(id){
  const t=tasks.find(x=>x.id===id && x.type==="event");
  if(!t) return;
  const end=parseMin(t.end)+15;
  t.end=minToTime(end);
  saveTasks(); renderTasks();
}

/* =========================================================
   Settings & theme
   ========================================================= */
saveSettings.addEventListener("click",(e)=>{
  e.preventDefault();
  const theme=document.querySelector('input[name="theme"]:checked').value;
  const view=document.querySelector('input[name="view"]:checked').value;
  const color=customColor?.value || settings.accent;

  settings.theme=theme; settings.view=view; settings.accent=color;
  localStorage.setItem("weepl_settings", JSON.stringify(settings));

  applyTheme(theme); applyAccent(color);
  app.dataset.view=view;

  closeDialog(settingsModal);
  renderTasks();
});

colorSwatches.forEach(b=>{
  b.addEventListener("click",()=>{
    const c=b.dataset.color;
    applyAccent(c);
    if (customColor) customColor.value=c;
  });
});

function applyTheme(theme){ app.dataset.theme=theme; }
function applyAccent(color){ document.documentElement.style.setProperty("--accent",color); }

/* =========================================================
   Modal open/close (iOS-friendly)
   ========================================================= */
function openDialog(dlg){ if(!dlg.open) dlg.showModal(); }
function closeDialog(dlg){ if(dlg.open) dlg.close(); }

// крестики и кнопки «Отмена»
document.querySelectorAll('dialog .icon-btn[value="close"], dialog .btn[value="cancel"]').forEach(btn=>{
  btn.setAttribute("type","button");
  btn.addEventListener("click", (e)=>{
    const dlg = e.target.closest("dialog");
    closeDialog(dlg);
  });
});

// закрытие по ESC — нативно работает, но на всякий случай
document.addEventListener("keydown", (e)=>{
  if(e.key==="Escape"){
    if(taskModal.open) closeDialog(taskModal);
    if(settingsModal.open) closeDialog(settingsModal);
  }
});

/* =========================================================
   Storage
   ========================================================= */
function saveTasks(){ localStorage.setItem("weepl_tasks", JSON.stringify(tasks)); }

/* =========================================================
   Navigation
   ========================================================= */
btnPrev.onclick=()=>{ currentDate.setMonth(currentDate.getMonth()-1); renderCalendar(currentDate); };
btnNext.onclick=()=>{ currentDate.setMonth(currentDate.getMonth()+1); renderCalendar(currentDate); };
addBtn.onclick=()=>{
  editingId=null;
  taskForm.reset();
  taskFormTitle.textContent="Новая запись";
  // по умолчанию — событие с ближайшим 30-мин интервалом
  const now = new Date();
  const base = isSameDate(selectedDate, new Date()) ? now : new Date(selectedDate);
  const s = `${String(base.getHours()).padStart(2,'0')}:${String(base.getMinutes()).padStart(2,'0')}`;
  inputType.value="event";
  inputStart.value=s;
  inputEnd.value=minToTime(parseMin(s)+30);
  openDialog(taskModal);
};

/* =========================================================
   Init (центрируем сегодня)
   ========================================================= */
renderCalendar(currentDate, true);
renderTasks();
