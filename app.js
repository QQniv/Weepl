/* =========================================================
   WEEPL — app.js
   Полный рабочий движок приложения
   ========================================================= */

/* --------- ELEMENTS --------- */
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

/* --------- INITIAL SETUP --------- */
applyTheme(settings.theme);
applyAccent(settings.accent);
app.dataset.view = settings.view;

/* --------- RENDER CALENDAR --------- */
function renderCalendar(date){
  dateStrip.innerHTML="";
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth()+1, 0);
  monthLabel.textContent = start.toLocaleString("ru-RU",{month:"long"}).replace(/^./,c=>c.toUpperCase());
  yearLabel.textContent = start.getFullYear();

  for(let d=1; d<=end.getDate(); d++){
    const cur = new Date(date.getFullYear(), date.getMonth(), d);
    const el = document.createElement("button");
    el.className="date";
    if(isSameDate(cur,new Date())) el.classList.add("is-today");
    if(isSameDate(cur,selectedDate)) el.classList.add("is-selected");
    el.innerHTML=`<div class="dow">${cur.toLocaleDateString("ru-RU",{weekday:"short"})}</div>
                  <div class="day">${d}</div>
                  <div class="mon">${cur.toLocaleDateString("ru-RU",{month:"short"})}</div>`;
    el.onclick=()=>{selectedDate=cur; renderCalendar(cur); renderTasks();};
    dateStrip.appendChild(el);
  }
}

/* --------- RENDER TASKS --------- */
function renderTasks(){
  const dateKey = fmtDate(selectedDate);
  const daily = tasks.filter(t=>t.date===dateKey);
  todayTitle.textContent = isSameDate(selectedDate,new Date()) ? "Сегодня" :
    selectedDate.toLocaleDateString("ru-RU",{day:"numeric",month:"long"});
  timelineView.innerHTML="";
  cardsView.innerHTML="";

  if(daily.length===0){
    timelineView.innerHTML = `<div class="empty">Нет событий или задач</div>`;
    cardsView.innerHTML = `<div class="empty">Нет событий или задач</div>`;
    return;
  }

  // разделение
  const events = daily.filter(t=>t.type==="event").sort((a,b)=>a.start.localeCompare(b.start));
  const plain = daily.filter(t=>t.type==="task");

  // Timeline
  if(settings.view==="timeline"){
    for(const ev of events){
      const el=document.createElement("div");
      el.className="event"+(ev.done?" is-done":"");
      el.innerHTML=`
        <div class="pin">${ev.icon||"•"}</div>
        <div class="card">
          <div class="title">${ev.title}</div>
          <div class="meta">${ev.start}–${ev.end} • ${ev.desc||""}</div>
        </div>
      `;
      addSwipe(el, ev.id);
      el.onclick=()=>openEdit(ev.id);
      timelineView.appendChild(el);
    }

    if(plain.length){
      const block=document.createElement("div");
      block.innerHTML=`<h4 class="section-title">Задачи</h4>`;
      timelineView.appendChild(block);
      for(const t of plain){
        const task=document.createElement("div");
        task.className="task"+(t.done?" is-done":"");
        task.innerHTML=`
          <div class="check">${t.done?"✓":""}</div>
          <div class="info">
            <div class="name">${t.icon||"•"} ${t.title}</div>
            <div class="priority">Приоритет ${t.priority}</div>
          </div>
        `;
        addSwipe(task,t.id);
        task.onclick=()=>openEdit(t.id);
        timelineView.appendChild(task);
      }
    }
  }

  // Cards
  if(settings.view==="cards"){
    for(const t of daily){
      const card=document.createElement("div");
      card.className=(t.type==="event"?"event":"task")+(t.done?" is-done":"");
      card.innerHTML=`
        <div class="pin">${t.icon||"•"}</div>
        <div class="card">
          <div class="title">${t.title}</div>
          <div class="meta">${t.type==="event"?`${t.start}–${t.end}`:"Приоритет "+t.priority}</div>
        </div>
      `;
      addSwipe(card,t.id);
      card.onclick=()=>openEdit(t.id);
      cardsView.appendChild(card);
    }
  }

  timelineView.hidden=settings.view!=="timeline";
  cardsView.hidden=settings.view!=="cards";
}

/* --------- ADD TASK --------- */
taskForm.addEventListener("submit",(e)=>{
  e.preventDefault();
  const data={
    type:document.getElementById("taskType").value,
    title:document.getElementById("taskTitle").value.trim(),
    desc:document.getElementById("taskDesc").value.trim(),
    start:document.getElementById("taskStart").value,
    end:document.getElementById("taskEnd").value,
    priority:document.getElementById("taskPriority").value,
    icon:document.getElementById("taskIcon").value,
    date:fmtDate(selectedDate),
    done:false
  };
  if(!data.title) return;
  if(editingId){
    const idx=tasks.findIndex(t=>t.id===editingId);
    if(idx>-1) tasks[idx]={...tasks[idx],...data};
  } else {
    data.id=uid();
    tasks.push(data);
  }
  saveTasks();
  taskModal.close();
  taskForm.reset();
  renderTasks();
  editingId=null;
});

/* --------- OPEN/EDIT --------- */
function openEdit(id){
  const t=tasks.find(x=>x.id===id);
  if(!t) return;
  editingId=id;
  taskFormTitle.textContent="Редактировать";
  document.getElementById("taskType").value=t.type;
  document.getElementById("taskTitle").value=t.title;
  document.getElementById("taskDesc").value=t.desc;
  document.getElementById("taskStart").value=t.start;
  document.getElementById("taskEnd").value=t.end;
  document.getElementById("taskPriority").value=t.priority;
  document.getElementById("taskIcon").value=t.icon;
  taskModal.showModal();
}

/* --------- SWIPE HANDLERS --------- */
function addSwipe(el,id){
  let startX=0;
  el.addEventListener("touchstart",(e)=>{startX=e.touches[0].clientX;});
  el.addEventListener("touchend",(e)=>{
    const dx=e.changedTouches[0].clientX-startX;
    if(Math.abs(dx)>50){
      if(dx>0) markDone(id);
      else postpone(id);
    }
  });
}

function markDone(id){
  const t=tasks.find(x=>x.id===id);
  if(t){t.done=!t.done; saveTasks(); renderTasks();}
}
function postpone(id){
  const t=tasks.find(x=>x.id===id && x.type==="event");
  if(t){
    const end=parseMin(t.end)+15;
    t.end=minToTime(end);
    saveTasks();
    renderTasks();
  }
}

/* --------- SETTINGS --------- */
saveSettings.addEventListener("click",(e)=>{
  e.preventDefault();
  const theme=document.querySelector('input[name="theme"]:checked').value;
  const view=document.querySelector('input[name="view"]:checked').value;
  settings.theme=theme; settings.view=view;
  const color=customColor.value || settings.accent;
  settings.accent=color;
  localStorage.setItem("weepl_settings",JSON.stringify(settings));
  applyTheme(theme);
  applyAccent(color);
  app.dataset.view=view;
  settingsModal.close();
  renderTasks();
});
colorSwatches.forEach(b=>{
  b.addEventListener("click",()=>{
    const c=b.dataset.color;
    applyAccent(c);
    customColor.value=c;
  });
});

/* --------- THEME & COLOR --------- */
function applyTheme(theme){
  app.dataset.theme=theme;
  localStorage.setItem("weepl_theme",theme);
}
function applyAccent(color){
  document.documentElement.style.setProperty("--accent",color);
  localStorage.setItem("weepl_accent",color);
}

/* --------- STORAGE --------- */
function saveTasks(){
  localStorage.setItem("weepl_tasks",JSON.stringify(tasks));
}

/* --------- NAVIGATION --------- */
btnPrev.onclick=()=>{currentDate.setMonth(currentDate.getMonth()-1); renderCalendar(currentDate);};
btnNext.onclick=()=>{currentDate.setMonth(currentDate.getMonth()+1); renderCalendar(currentDate);};
addBtn.onclick=()=>{editingId=null; taskForm.reset(); taskFormTitle.textContent="Новая запись"; taskModal.showModal();};

/* --------- INIT --------- */
renderCalendar(currentDate);
renderTasks();
