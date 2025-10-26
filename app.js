'use strict';
document.title = 'Weepl • JS загружен';
console.log('App started ✅');

function $(sel){return document.querySelector(sel);}
function $$(sel){return document.querySelectorAll(sel);}
function dtKey(d){return d.toISOString().slice(0,10);}
function addDays(d,n){const r=new Date(d);r.setDate(r.getDate()+n);return r;}
function monthTitle(d){return d.toLocaleString('ru-RU',{month:'long'})+' '+d.getFullYear();}

let tasks=[];
let selectedDate = dtKey(new Date());
let currentMonth = new Date();

function init(){
  const app = $('#app');
  const tpl = $('#layout');
  app.appendChild(tpl.content.cloneNode(true));
  router();
  window.addEventListener('hashchange',router);
  $('#fabAdd').onclick = addTask;
}

function router(){
  const hash = location.hash || '#/';
  const view = $('#view');
  view.innerHTML = '';
  if(hash==='#/calendar') view.appendChild($('#calendar-view').content.cloneNode(true));
  else if(hash==='#/settings') view.appendChild($('#settings-view').content.cloneNode(true));
  else renderHome(view);
  $$('.tab').forEach(t=>t.classList.toggle('active',t.dataset.route===hash));
}

function renderHome(view){
  view.appendChild($('#home-view').content.cloneNode(true));
  $('#homeMonth').textContent = monthTitle(currentMonth);
  $('#prevMonth').onclick = ()=>{currentMonth.setMonth(currentMonth.getMonth()-1);$('#homeMonth').textContent=monthTitle(currentMonth);renderDates();};
  $('#nextMonth').onclick = ()=>{currentMonth.setMonth(currentMonth.getMonth()+1);$('#homeMonth').textContent=monthTitle(currentMonth);renderDates();};
  renderDates();
  renderTasks();
}

function renderDates(){
  const strip = $('#dateStrip');
  strip.innerHTML='';
  const base = new Date();
  for(let i=-6;i<7;i++){
    const d=addDays(base,i);
    const key=dtKey(d);
    const btn=document.createElement('button');
    btn.className='date-pill'+(key===selectedDate?' active':'');
    btn.textContent=d.getDate();
    btn.onclick=()=>{
      selectedDate=key;
      $$('.date-pill').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      $('#todayTitle').textContent = d.toLocaleDateString('ru-RU',{day:'2-digit',month:'long'});
      renderTasks();
    };
    strip.appendChild(btn);
  }
}

function renderTasks(){
  const list = $('#taskList');
  list.innerHTML='';
  const filtered = tasks.filter(t=>t.date===selectedDate);
  if(filtered.length===0){
    const p=document.createElement('p');
    p.textContent='Нет задач на эту дату.';
    list.appendChild(p);
  } else {
    filtered.forEach(t=>{
      const el=document.createElement('div');
      el.className='task'+(t.done?' done':'');
      el.innerHTML=`<span>${t.title}</span><button>✔</button>`;
      el.querySelector('button').onclick=()=>{t.done=!t.done;renderTasks();};
      list.appendChild(el);
    });
  }
}

function addTask(){
  const title=prompt('Новая задача:');
  if(!title)return;
  tasks.push({title,date:selectedDate,done:false});
  renderTasks();
}

document.addEventListener('DOMContentLoaded',init);
