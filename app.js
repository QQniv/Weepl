/* ==========================================================================
   Weepl v5 — app.js (для последнего index.html)
   - Рендер карточек (wide + 2 колонки)
   - Центрированный FAB -> модалка
   - CRUD в памяти (позже подменим на БД/календарь)
   - Лёгкий AI-совет (рандом)
   ========================================================================== */

// Демо-данные
let tasks = [
  {id:"t1", title:"Разработка интерфейса", desc:"UI прототип Weepl v3 — главная страница и навигация", proj:"Weepl",  time:"09:00", rank:"A"},
  {id:"t2", title:"Кофе и планирование",  desc:"10 минут тишины, ревью задач",                         proj:"Фокус",  time:"11:00", rank:"B"},
  {id:"t3", title:"Митинг с Артёмом",      desc:"Дизайн-сессия: анимации и микроинтеракции",          proj:"Созвон", time:"13:30", rank:"A"},
  {id:"t4", title:"Прогулка",              desc:"15–20 минут",                                       proj:"Здоровье", time:"17:00", rank:"C"},
];

const cards = document.getElementById('cards');
const addBtn = document.getElementById('add');

// ---------- Render ----------
function cardTpl(t, wide=false){
  return `<article class="card ${wide?'wide':''}" data-id="${t.id}">
    <h3>${escapeHtml(t.title)}</h3>
    <div class="sub">${escapeHtml(t.desc||'')}</div>
    <div class="meta"><span class="badge">${escapeHtml(t.proj||'Задачи')}</span><span class="time">${t.time||''}</span></div>
  </article>`;
}
function render(){
  const [first, ...rest] = tasks;
  cards.innerHTML = cardTpl(first, true) + rest.map(x=>cardTpl(x)).join('');
  cards.querySelectorAll('.card').forEach(el=>{
    el.onclick = ()=> openModal(tasks.find(t=>t.id===el.dataset.id));
  });
}
render();

// ---------- AI Tip ----------
const tips=[
  "Запиши 3 задачи дня. Остальное — в бэклог.",
  "Сделай 25-минутную сессию на важную задачу (A).",
  "Держи 10% времени пустым под форс-мажор.",
  "Собери единый входящий — мозгу легче."
];
document.getElementById('tipRefresh')?.addEventListener('click', ()=>{
  const t = tips[Math.floor(Math.random()*tips.length)];
  document.getElementById('tipText').textContent = t;
});

// ---------- Modal (Bottom Sheet) ----------
const modal = document.getElementById('modal');
const fTitle = document.getElementById('fTitle');
const fDesc  = document.getElementById('fDesc');
const fProj  = document.getElementById('fProject');
const fTime  = document.getElementById('fTime');
const chips  = document.getElementById('chips');
const delBtn = document.getElementById('delete');

let current = null;

function openModal(data){
  document.getElementById('modalTitle').textContent = data? "Редактирование задачи" : "Новая задача";
  current = data? {...data} : {id:crypto.randomUUID(), title:"", desc:"", proj:"", time:"", rank:"C"};
  fTitle.value = current.title||"";
  fDesc.value  = current.desc||"";
  fProj.value  = current.proj||"";
  fTime.value  = current.time||"";
  chips.querySelectorAll('.chip').forEach(c=>c.classList.toggle('active', c.dataset.v===current.rank));
  delBtn.style.visibility = data ? 'visible' : 'hidden';
  modal.classList.add('open');
}

addBtn.addEventListener('click', ()=> openModal(null));

chips.addEventListener('click', e=>{
  const c = e.target.closest('.chip'); if(!c) return;
  chips.querySelectorAll('.chip').forEach(x=>x.classList.remove('active'));
  c.classList.add('active');
  current.rank = c.dataset.v;
});

document.getElementById('cancel').addEventListener('click', ()=> modal.classList.remove('open'));
document.getElementById('save').addEventListener('click', ()=>{
  current.title = fTitle.value.trim();
  current.desc  = fDesc.value.trim();
  current.proj  = fProj.value.trim();
  current.time  = fTime.value;
  const i = tasks.findIndex(x=>x.id===current.id);
  if(i>=0) tasks[i]=current;
  else tasks.splice(1,0,current); // новые — после широкой карточки
  modal.classList.remove('open');
  render();
});
delBtn.addEventListener('click', ()=>{
  tasks = tasks.filter(x=>x.id!==current.id);
  modal.classList.remove('open');
  render();
});
modal.addEventListener('click', e=>{ if(e.target===modal) modal.classList.remove('open'); });

// ---------- Helpers ----------
function escapeHtml(s=''){
  return s.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;', "'":'&#39;'}[m]));
}
