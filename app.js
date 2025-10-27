'use strict';
console.log('Weepl App V1 loaded ✅');

/* ========= helpers ========= */
function $(s,root){return (root||document).querySelector(s);}
function $$(s,root){return Array.from((root||document).querySelectorAll(s));}
function uid(){return Math.random().toString(36).slice(2,9);}
function todayKey(){const d=new Date();return d.toISOString().slice(0,10);}
function dtKey(d){return d.toISOString().slice(0,10);}
function parseKey(k){let p=k.split('-');return new Date(p[0],p[1]-1,p[2]);}
function monthTitle(d){return d.toLocaleString('ru-RU',{month:'long'})+' '+d.getFullYear();}
function humanDate(iso){
  if(!iso) return 'Без даты';
  let d=parseKey(iso), now=todayKey(), tomorrow=dtKey(new Date(Date.now()+86400000));
  let key=dtKey(d);
  if(key===now) return 'Сегодня';
  if(key===tomorrow) return 'Завтра';
  return d.toLocaleDateString('ru-RU',{day:'2-digit',month:'long',year:'numeric'});
}
function prioColor(p){return p==='high'?'#ff4fa3':p==='critical'?'#8a2be2':p==='low'?'var(--border)':'var(--accent)';}

/* ========= store ========= */
const STORE_KEY='weepl.v1';
function loadStore(){
  try{return JSON.parse(localStorage.getItem(STORE_KEY))||{settings:{theme:'light',accent:'blue',weekStart:1},tasks:[]};}
  catch(e){return {settings:{theme:'light',accent:'blue',weekStart:1},tasks:[]};}
}
function saveStore(d){localStorage.setItem(STORE_KEY,JSON.stringify(d));}
let store=loadStore();

/* ========= theme ========= */
function applyTheme(){document.documentElement.dataset.theme=store.settings.theme;document.documentElement.dataset.accent=store.settings.accent;}
applyTheme();

/* ========= router ========= */
const routes={'#/':renderHome,'#/calendar':renderCalendar,'#/settings':renderSettings};
function router(){
  let hash=location.hash||'#/'; if(!routes[hash]) hash='#/';
  const view=$('#view'); view.innerHTML='';
  routes[hash](view);
  $$('.tab').forEach(t=>t.classList.toggle('active',t.dataset.route===hash));
}
window.addEventListener('hashchange',router);

/* ========= state ========= */
let state={selectedDate:todayKey(),month:new Date()};

/* ========= boot ========= */
document.addEventListener('DOMContentLoaded',()=>{
  const app=$('#app'); app.appendChild($('#layout').content.cloneNode(true));
  $('#fabAdd').onclick=()=>openTaskModal({});
  router();
});

/* ========= render: home ========= */
function renderHome(root){
  root.appendChild($('#home-view').content.cloneNode(true));
  $('#homeMonth').textContent=monthTitle(state.month);
  $('[data-home-month="prev"]').onclick=()=>{state.month=new Date(state.month.getFullYear(),state.month.getMonth()-1,1);$('#homeMonth').textContent=monthTitle(state.month);renderDates();};
  $('[data-home-month="next"]').onclick=()=>{state.month=new Date(state.month.getFullYear(),state.month.getMonth()+1,1);$('#homeMonth').textContent=monthTitle(state.month);renderDates();};
  renderDates();
  renderTaskList();
}

function renderDates(){
  const strip=$('#dateStrip'); strip.innerHTML='';
  const base=parseKey(state.selectedDate);
  const start=new Date(base.getFullYear(),base.getMonth(),base.getDate()-6);
  for(let i=0;i<14;i++){
    const d=new Date(start.getFullYear(),start.getMonth(),start.getDate()+i);
    const key=dtKey(d);
    const btn=document.createElement('button');
    btn.className='date-pill'+(key===state.selectedDate?' active':'');
    btn.innerHTML='<div>'+d.getDate()+'</div>';
    btn.onclick=()=>{state.selectedDate=key;$$('.date-pill').forEach(b=>b.classList.remove('active'));btn.classList.add('active');$('#todayTitle').textContent=humanDate(key);renderTaskList();};
    strip.appendChild(btn);
  }
  $('#todayTitle').textContent=humanDate(state.selectedDate);
}

/* ========= render: tasks ========= */
function renderTaskList(){
  const list=$('#taskList'); list.innerHTML='';
  const tasks=store.tasks.filter(t=>t.date===state.selectedDate).sort((a,b)=>(a.time||'23:59').localeCompare(b.time||'23:59'));
  if(!tasks.length){list.innerHTML='<p class="muted">Нет задач на эту дату.</p>';return;}
  tasks.forEach(t=>{
    const card=document.createElement('div');
    card.className='task'+(t.done?' is-done':'');
    card.draggable=true;
    card.dataset.id=t.id;
    card.innerHTML=`
      <div>
        <div class="title">${t.title}</div>
        ${t.time?`<div class="time">${t.time}</div>`:''}
      </div>
      <div style="display:flex;gap:8px;">
        <button class="icon-btn" data-toggle>✔</button>
        <button class="icon-btn" data-edit>✎</button>
        <button class="icon-btn" data-del>🗑</button>
      </div>`;
    card.querySelector('[data-toggle]').onclick=()=>toggleDone(t.id);
    card.querySelector('[data-edit]').onclick=()=>openTaskModal(t);
    card.querySelector('[data-del]').onclick=()=>{store.tasks=store.tasks.filter(x=>x.id!==t.id);saveStore(store);renderTaskList();};
    bindSwipe(card);
    list.appendChild(card);
  });
}

/* ========= swipe ========= */
function bindSwipe(el){
  let x0=0,dx=0,active=false;
  el.addEventListener('touchstart',e=>{x0=e.touches[0].clientX;active=true;dx=0;},{passive:true});
  el.addEventListener('touchmove',e=>{
    if(!active)return;dx=e.touches[0].clientX-x0;
    el.style.transform=`translateX(${dx}px)`;},{passive:true});
  el.addEventListener('touchend',()=>{
    if(!active)return;active=false;
    if(dx>80) toggleDone(el.dataset.id);
    else if(dx<-80){let t=store.tasks.find(x=>x.id===el.dataset.id);if(t){t.date=dtKey(new Date(parseKey(t.date).getTime()+86400000));saveStore(store);renderTaskList();}}
    el.style.transform='';
  });
}

/* ========= toggle ========= */
function toggleDone(id){let t=store.tasks.find(x=>x.id===id);if(!t)return;t.done=!t.done;saveStore(store);renderTaskList();}

/* ========= render: calendar ========= */
function renderCalendar(root){
  root.appendChild($('#calendar-view').content.cloneNode(true));
  const now=state.month;
  $('#calTitle').textContent=monthTitle(now);
  $('[data-cal="prev"]').onclick=()=>{state.month=new Date(now.getFullYear(),now.getMonth()-1,1);renderCalendar($('#view'));};
  $('[data-cal="next"]').onclick=()=>{state.month=new Date(now.getFullYear(),now.getMonth()+1,1);renderCalendar($('#view'));};

  const grid=$('#calendarGrid'); grid.innerHTML='';
  const first=new Date(now.getFullYear(),now.getMonth(),1);
  const startIdx=(first.getDay()+6)%7;
  const daysInMonth=new Date(now.getFullYear(),now.getMonth()+1,0).getDate();
  const names=['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];
  names.forEach(n=>grid.insertAdjacentHTML('beforeend',`<div class="cell head">${n}</div>`));
  for(let i=0;i<startIdx;i++)grid.insertAdjacentHTML('beforeend','<div class="cell"></div>');
  for(let d=1;d<=daysInMonth;d++){
    const dateKey=dtKey(new Date(now.getFullYear(),now.getMonth(),d));
    const dayTasks=store.tasks.filter(t=>t.date===dateKey);
    let dots='';dayTasks.forEach(t=>dots+=`<span class="dot" style="background:${prioColor(t.priority)}"></span>`);
    grid.insertAdjacentHTML('beforeend',`<div class="cell daycell" data-date="${dateKey}"><div class="dhead">${d}</div><div class="dots">${dots}</div></div>`);
  }
  $$('.daycell').forEach(c=>{
    c.addEventListener('click',()=>{
      state.selectedDate=c.dataset.date;
      renderCalendarTasks($('#calendarTasks'),state.selectedDate);
    });
    c.addEventListener('dragover',ev=>ev.preventDefault());
    c.addEventListener('drop',ev=>{
      ev.preventDefault();
      const id=ev.dataTransfer.getData('text/id');let t=store.tasks.find(x=>x.id===id);if(!t)return;
      t.date=c.dataset.date;saveStore(store);renderCalendarTasks($('#calendarTasks'),c.dataset.date);
    });
  });
  renderCalendarTasks($('#calendarTasks'),state.selectedDate);
}

function renderCalendarTasks(container,iso){
  const items=store.tasks.filter(t=>t.date===iso).sort((a,b)=>(a.time||'').localeCompare(b.time||''));
  container.innerHTML=`<div class="h-impact" style="font-size:20px;margin-bottom:6px">${humanDate(iso)}</div>`+(items.length?items.map(taskRow).join(''):'<p class="muted">Нет задач на этот день.</p>');
  $$('.task',container).forEach(card=>{
    card.querySelector('[data-toggle]').onclick=()=>toggleDone(card.dataset.id);
    card.querySelector('[data-edit]').onclick=()=>openTaskModal(store.tasks.find(x=>x.id===card.dataset.id));
    card.querySelector('[data-del]').onclick=()=>{store.tasks=store.tasks.filter(x=>x.id!==card.dataset.id);saveStore(store);renderCalendarTasks(container,iso);};
  });
}

function taskRow(t){
  return `<article class="task${t.done?' is-done':''}" data-id="${t.id}" draggable="true">
    <div class="title">${t.title}</div>
    <div style="display:flex;gap:6px;">
      <button class="icon-btn" data-toggle>✔</button>
      <button class="icon-btn" data-edit>✎</button>
      <button class="icon-btn" data-del>🗑</button>
    </div>
  </article>`;
}

/* ========= render: settings ========= */
function renderSettings(root){
  root.appendChild($('#settings-view').content.cloneNode(true));
  $('#setTheme').value=store.settings.theme;
  $('#setAccent').value=store.settings.accent;
  $('#setTheme').onchange=e=>{store.settings.theme=e.target.value;applyTheme();saveStore(store);};
  $('#setAccent').onchange=e=>{store.settings.accent=e.target.value;applyTheme();saveStore(store);};
  $('#btnExport').onclick=exportJSON;
  $('#fileImport').onchange=importJSON;
}

/* ========= modal ========= */
function openTaskModal(prefill){
  const modal=$('#taskModal');
  const form=$('#taskForm');
  $('#modalTitle').textContent=prefill&&prefill.id?'Редактировать':'Новая задача';
  $('#fTitle').value=prefill.title||'';
  $('#fDate').value=prefill.date||state.selectedDate;
  $('#fTime').value=prefill.time||'';
  $('#fPriority').value=prefill.priority||'medium';
  $('#fSmart').value=prefill.smart||'T';
  $('#fNote').value=prefill.note||'';
  modal.showModal();
  form.onsubmit=e=>{
    e.preventDefault();
    const data=new FormData(form);
    let t={id:prefill.id||uid(),title:data.get('title'),date:data.get('date'),time:data.get('time'),priority:data.get('priority'),smart:data.get('smart'),note:data.get('note'),done:false};
    const i=store.tasks.findIndex(x=>x.id===t.id);
    if(i>-1)store.tasks[i]=t;else store.tasks.push(t);
    saveStore(store);
    modal.close();renderTaskList();
  };
  $$('[data-close]').forEach(b=>b.onclick=()=>modal.close());
}

/* ========= export / import ========= */
function exportJSON(){
  const blob=new Blob([JSON.stringify(store,null,2)],{type:'application/json'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download='weepl-export-'+todayKey()+'.json';
  a.click();
  URL.revokeObjectURL(a.href);
}
function importJSON(e){
  const f=e.target.files[0];if(!f)return;
  const r=new FileReader();
  r.onload=()=>{try{const d=JSON.parse(r.result);if(!d.tasks)throw 0;store=d;saveStore(store);applyTheme();alert('Импортировано');router();}catch{alert('Ошибка импорта');}};
  r.readAsText(f);
}

/* ========= drag helper ========= */
document.addEventListener('dragstart',e=>{
  const art=e.target.closest('.task');if(!art)return;
  e.dataTransfer.setData('text/id',art.dataset.id);
  e.dataTransfer.effectAllowed='move';
});
