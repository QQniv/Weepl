/* Planner • Future Flow — app.js (V2 home strip + month) */
'use strict';

/* ================= Store ================= */
var STORE_KEY='planner.futureflow.v1';
var DEFAULTS={ settings:{ theme:'light', accent:'blue', weekStart:1 }, tasks:[] };

var Store={
  _data:null,
  load:function(){ try{ return JSON.parse(localStorage.getItem(STORE_KEY))||JSON.parse(JSON.stringify(DEFAULTS)); }catch(e){ return JSON.parse(JSON.stringify(DEFAULTS)); } },
  save:function(d){ localStorage.setItem(STORE_KEY, JSON.stringify(d)); },
  get:function(){ return this._data || (this._data=this.load()); },
  set:function(next){ this._data=next; this.save(next); document.dispatchEvent(new CustomEvent('store:change')); }
};

/* ================= Utils ================= */
function $(sel,root){ return (root||document).querySelector(sel); }
function $$(sel,root){ return Array.prototype.slice.call((root||document).querySelectorAll(sel)); }
function uid(){ return Math.random().toString(36).slice(2,9); }
function dtKey(d){ return new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString().slice(0,10); }
function fromKey(iso){ var p=iso.split('-'); return new Date(Number(p[0]), Number(p[1])-1, Number(p[2])); }
function addDaysIso(iso,n){ var d=fromKey(iso); d.setDate(d.getDate()+n); return dtKey(d); }
function addMonths(d, m){ return new Date(d.getFullYear(), d.getMonth()+m, 1); }
function escapeHTML(s){ return String(s).replace(/[&<>"']/g,function(m){return({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]);}); }
function monthTitle(d){ return d.toLocaleString('ru-RU',{month:'long'})+' '+d.getFullYear(); }
function humanDate(iso){
  if(!iso) return 'Без даты';
  var d=fromKey(iso), today=dtKey(new Date()), tomorrow=dtKey(new Date(Date.now()+86400000));
  var key=dtKey(d);
  if(key===today) return 'Сегодня';
  if(key===tomorrow) return 'Завтра';
  return d.toLocaleDateString('ru-RU',{day:'2-digit',month:'long',year:'numeric'});
}
function prioColor(p){ if(p==='low')return 'var(--border)'; if(p==='high')return '#FF4FA3'; if(p==='critical')return '#8A2BE2'; return 'var(--accent)'; }

/* ================= Theme ================= */
function applyTheme(t){ document.documentElement.dataset.theme=t; }
function applyAccent(a){ document.documentElement.dataset.accent=a; }

/* ================= Router ================= */
var routes={'#/':renderHome,'#/calendar':renderCalendar,'#/settings':renderSettings};
function setActiveTab(){ var h=location.hash||'#/'; $$('.tab').forEach(function(a){ a.classList.toggle('active', a.getAttribute('data-route')===h); }); }
function router(){ var h=location.hash||'#/'; var view=$('#view'); view.innerHTML=''; (routes[h]||renderHome)(view); setActiveTab(); try{ view.focus({preventScroll:true}); }catch(e){} }

/* ================= App State ================= */
var UI = {
  home: { month: new Date(), selected: dtKey(new Date()) },
  cal:  { current: new Date(), selected: dtKey(new Date()) }
};

/* ================= Boot ================= */
(function(){
  var app=$('#app'), tpl=$('#layout');
  app.appendChild(document.importNode(tpl.content,true));

  var st=Store.get().settings;
  applyTheme(st.theme||'light'); applyAccent(st.accent||'blue');

  var modal=$('#taskModal'); var form=$('#taskForm');
  $('#fabAdd').addEventListener('click', function(){ openTaskModal({date:UI.home.selected}); });
  $$('[data-close]').forEach(function(b){ b.addEventListener('click', function(){ modal.close(); }); });
  modal.addEventListener('cancel', function(e){ e.preventDefault(); modal.close(); });
  form.addEventListener('submit', onSubmitTask);

  document.addEventListener('keydown', function(e){
    if(e.key && e.key.toLowerCase()==='n' && !modal.open) openTaskModal({date:UI.home.selected});
    if(e.key==='Escape' && modal.open) modal.close();
  });

  document.addEventListener('store:change', function(){
    if((location.hash||'#/')==='#/') renderHome($('#view'));
    if((location.hash||'#/')==='#/calendar') renderCalendar($('#view'));
  });

  window.addEventListener('hashchange', router);
  if(!location.hash) location.hash='#/';
  router();
})();

/* ================= Home ================= */
function renderHome(root){
  var t=document.importNode($('#home-view').content,true);
  root.replaceChildren(t);

  // Set month title
  $('#homeMonth').textContent = monthTitle(UI.home.month);

  // Month arrows
  $('[data-home-month="prev"]').onclick = function(){
    UI.home.month = addMonths(UI.home.month, -1);
    $('#homeMonth').textContent = monthTitle(UI.home.month);
    paintDateStrip();
  };
  $('[data-home-month="next"]').onclick = function(){
    UI.home.month = addMonths(UI.home.month, 1);
    $('#homeMonth').textContent = monthTitle(UI.home.month);
    paintDateStrip();
  };

  paintDateStrip();      // pills
  paintTodayList();      // tasks list for selected day
}

/* лента дат: показываем 14 дней вокруг выбранной даты (центрируем активный) */
function paintDateStrip(){
  var strip = $('#dateStrip'); strip.innerHTML='';
  var base = fromKey(UI.home.selected);
  var start = new Date(base.getFullYear(), base.getMonth(), base.getDate()-6);
  for(var i=0;i<14;i++){
    var d=new Date(start.getFullYear(), start.getMonth(), start.getDate()+i);
    var key=dtKey(d);
    var wk=d.toLocaleString('ru-RU',{weekday:'short'}); // пн, вт...
    var active = key===UI.home.selected ? ' active' : '';
    var html = '<button class="date-pill'+active+'" data-key="'+key+'">'+
      '<div class="wk">'+wk.toUpperCase()+'</div>'+
      '<div class="daynum">'+String(d.getDate()).padStart(2,'0')+'</div>'+
    '</button>';
    strip.insertAdjacentHTML('beforeend', html);
  }

  // bind clicks
  $$('.date-pill', strip).forEach(function(btn){
    btn.addEventListener('click', function(){
      UI.home.selected = btn.getAttribute('data-key');
      // highlight active
      $$('.date-pill', strip).forEach(function(b){ b.classList.toggle('active', b===btn); });
      // update "Сегодня"/дата
      $('#todayTitle').textContent = humanDate(UI.home.selected);
      paintTodayList();
    });
  });

  // Scroll active pill into view
  var activeEl = $('.date-pill.active', strip);
  if(activeEl && activeEl.scrollIntoView){ activeEl.scrollIntoView({inline:'center', block:'nearest', behavior:'smooth'}); }

  // Update titles
  $('#todayTitle').textContent = humanDate(UI.home.selected);
}

/* список задач выбранной даты (используем старый #taskList для совместимости) */
function paintTodayList(){
  var listWrap = $('#todayList');
  var list = $('#taskList');
  var tasks = Store.get().tasks.filter(function(t){ return (t.date||'')===UI.home.selected; }).sort(sortByWhen);

  if(!tasks.length){
    list.innerHTML = '<p class="muted">На этот день пока пусто. Нажми <kbd>N</kbd> или «+», чтобы добавить задачу.</p>';
  }else{
    list.innerHTML = tasks.map(taskRow).join('');
  }

  // bind actions + swipe
  $$('.task', listWrap).forEach(function(card){
    card.querySelector('[data-toggle]').addEventListener('click', function(){ toggleDone(card.dataset.id); });
    card.querySelector('[data-edit]').addEventListener('click', function(){ startEdit(card.dataset.id); });
    card.querySelector('[data-del]').addEventListener('click', function(){ delTask(card.dataset.id); });
    bindSwipe(card);
  });
}

/* ================= Calendar ================= */
var Calendar={
  state:{ current:new Date(), selected: dtKey(new Date()) },
  move:function(step){ var d=this.state.current; this.state.current=new Date(d.getFullYear(), d.getMonth()+step, 1); this.paint(this.state.current); },
  paint:function(now){
    var grid=$('#calendarGrid'); var title=$('#calTitle'); var list=$('#calendarTasks');
    var weekStart=Number(Store.get().settings.weekStart||1);
    var first=new Date(now.getFullYear(), now.getMonth(), 1);
    var startIdx=(first.getDay()-weekStart+7)%7;
    var daysInMonth=new Date(now.getFullYear(), now.getMonth()+1, 0).getDate();
    title.textContent= monthTitle(now);
    grid.innerHTML='';
    var names=weekStart?['Пн','Вт','Ср','Чт','Пт','Сб','Вс']:['Вс','Пн','Вт','Ср','Чт','Пт','Сб'];
    names.forEach(function(n){ grid.insertAdjacentHTML('beforeend','<div class="cell head">'+n+'</div>'); });
    for(var i=0;i<startIdx;i++) grid.insertAdjacentHTML('beforeend','<div class="cell"></div>');
    var tasks=Store.get().tasks;
    for(var d=1; d<=daysInMonth; d++){
      var date=new Date(now.getFullYear(), now.getMonth(), d), key=dtKey(date);
      var dayTasks=tasks.filter(function(t){return t.date===key;});
      var dots=''; dayTasks.slice(0,8).forEach(function(t){
        var c=prioColor(t.priority); dots+='<span class="dot" style="background:'+c+';box-shadow:0 0 10px '+c+'33"></span>';
      });
      grid.insertAdjacentHTML('beforeend','<div class="cell daycell" data-date="'+key+'"><div class="dhead">'+d+'</div><div class="dots">'+dots+'</div></div>');
    }
    $$('.daycell').forEach(function(c){
      c.addEventListener('click', function(e){
        var key=c.dataset.date;
        Calendar.state.selected=key;
        renderCalendarTasks(list, key);
        // синхронизируем домашнюю выбранную дату
        UI.home.selected = key; $('#todayTitle') && ($('#todayTitle').textContent = humanDate(key));
        // и подсветим в ленте если мы на домашней
        var active=$('.date-pill.active'); var target=$('.date-pill[data-key="'+key+'"]');
        if(target && active){ active.classList.remove('active'); target.classList.add('active'); }
      });
      // drop target
      c.addEventListener('dragover', function(ev){ ev.preventDefault(); });
      c.addEventListener('drop', function(ev){
        ev.preventDefault();
        var id=ev.dataTransfer.getData('text/id'); if(!id) return;
        var s=Store.get(); var t=s.tasks.find(function(x){return x.id===id;}); if(!t) return;
        t.date=c.dataset.date; Store.set(s); renderCalendarTasks(list, c.dataset.date);
      });
    });
    renderCalendarTasks(list, Calendar.state.selected || dtKey(new Date()));
    list.addEventListener('dragstart', function(ev){
      var art=ev.target.closest && ev.target.closest('.task'); if(!art) return;
      ev.dataTransfer.setData('text/id', art.dataset.id); ev.dataTransfer.effectAllowed='move';
    });
  }
};
function renderCalendarTasks(container, iso){
  var items=Store.get().tasks.filter(function(t){return t.date===iso;}).sort(sortByWhen);
  container.innerHTML = '<div class="h-impact" style="font-size:20px;margin-bottom:6px">'+humanDate(iso)+'</div>' +
    (items.length?items.map(taskRow).join(''):'<p class="muted">Нет задач на этот день.</p>');
  $$('.task', container).forEach(function(card){
    card.querySelector('[data-toggle]').addEventListener('click', function(){ toggleDone(card.dataset.id); });
    card.querySelector('[data-edit]').addEventListener('click', function(){ startEdit(card.dataset.id); });
    card.querySelector('[data-del]').addEventListener('click', function(){ delTask(card.dataset.id); });
    bindSwipe(card);
  });
}

/* ================= Settings ================= */
function renderSettings(root){
  var t=document.importNode($('#settings-view').content,true);
  root.replaceChildren(t);
  var s=Store.get().settings;
  $('#setTheme').value=s.theme; $('#setAccent').value=s.accent;
  $('#setTheme').onchange=function(e){ s.theme=e.target.value; applyTheme(s.theme); Store.set(Store.get()); };
  $('#setAccent').onchange=function(e){ s.accent=e.target.value; applyAccent(s.accent); Store.set(Store.get()); };
  $('#btnExport').onclick=exportJSON;
  var fi=$('#fileImport'); if(fi) fi.onchange=importJSON;
}

/* ================= Tasks ================= */
function onSubmitTask(e){
  e.preventDefault();
  var data=new FormData(e.target);
  var hid=$('#fId'); if(!hid){ hid=document.createElement('input'); hid.type='hidden'; hid.id='fId'; hid.name='id'; $('#taskForm').appendChild(hid); }
  var id=hid.value||'';
  var task={
    id: id||uid(),
    title: String(data.get('title')||'').trim(),
    date: data.get('date')||UI.home.selected||'',
    time: data.get('time')||'',
    priority: data.get('priority')||'medium',
    smart: data.get('smart')||'T',
    note: String(data.get('note')||'').trim(),
    tags: [],
    done:false,
    createdAt: Date.now()
  };
  if(!task.title) return;
  var s=Store.get(); var i=s.tasks.findIndex(function(t){return t.id===task.id;});
  if(i>-1) s.tasks[i]=Object.assign({}, s.tasks[i], task); else s.tasks.push(task);
  Store.set(s);
  $('#taskModal').close(); e.target.reset();
  // обновим домашний список мгновенно
  paintTodayList();
}
function toggleDone(id){ var s=Store.get(); var t=s.tasks.find(function(x){return x.id===id;}); if(!t) return; t.done=!t.done; Store.set(s); }
function delTask(id){ var s=Store.get(); s.tasks=s.tasks.filter(function(x){return x.id!==id;}); Store.set(s); paintTodayList(); }
function startEdit(id){ var t=Store.get().tasks.find(function(x){return x.id===id;}); if(!t) return; openTaskModal(t); }
function taskRow(t){
  var time=t.time?('<span class="time">'+t.time+'</span>'):'<span class="time muted">—</span>';
  var prMap={low:'prio-low',medium:'prio-medium',high:'prio-high',critical:'prio-critical'};
  var prClass=prMap[t.priority||'medium'];
  return '<article class="task '+(t.done?'is-done ':'')+prClass+'" data-id="'+t.id+'" draggable="true">'+
    '<button class="chk" data-toggle aria-label="Готово"></button>'+
    '<div class="task-main">'+
      '<div class="row-1" style="display:grid;grid-template-columns:1fr auto;align-items:center;gap:10px">'+
        '<h3 class="title" style="margin:0;font-weight:700">'+escapeHTML(t.title)+'</h3>'+time+
      '</div>'+
      (t.note?'<div class="muted" style="font-size:13px;margin-top:4px">'+escapeHTML(t.note)+'</div>':'')+
    '</div>'+
    '<div class="task-ctl"><button class="icon-btn" data-edit title="Редактировать">✎</button><button class="icon-btn" data-del title="Удалить">🗑</button></div>'+
  '</article>';
}
function sortByWhen(a,b){ var ka=(a.date||'9999-12-31')+' '+(a.time||'23:59'); var kb=(b.date||'9999-12-31')+' '+(b.time||'23:59'); return ka.localeCompare(kb); }
function openTaskModal(prefill){
  $('#modalTitle').textContent = prefill ? 'Редактировать' : 'Новая задача';
  var hid=$('#fId'); if(!hid){ hid=document.createElement('input'); hid.type='hidden'; hid.id='fId'; hid.name='id'; $('#taskForm').appendChild(hid); }
  $('#fId').value     = prefill && prefill.id ? prefill.id : '';
  $('#fTitle').value  = prefill && prefill.title ? prefill.title : '';
  $('#fDate').value   = prefill && prefill.date ? prefill.date : UI.home.selected || '';
  $('#fTime').value   = prefill && prefill.time ? prefill.time : '';
  $('#fPriority').value = prefill && prefill.priority ? prefill.priority : 'medium';
  $('#fSmart').value  = prefill && prefill.smart ? prefill.smart : 'T';
  $('#fNote').value   = prefill && prefill.note ? prefill.note : '';
  $('#taskModal').showModal(); $('#fTitle').focus();
}

/* ================= Swipe (touch) ================= */
function bindSwipe(card){
  var x0=0,y0=0,dx=0,active=false;
  card.addEventListener('touchstart', function(e){ var t=e.touches[0]; x0=t.clientX; y0=t.clientY; active=true; dx=0; }, {passive:true});
  card.addEventListener('touchmove', function(e){
    if(!active) return; var t=e.touches[0]; dx=t.clientX-x0;
    if(Math.abs(dx)>6 && Math.abs(t.clientY-y0)<30){ card.style.transform='translateX('+dx+'px)'; card.dataset.swipe = dx>0?'right':'left'; }
  }, {passive:true});
  card.addEventListener('touchend', function(){
    if(!active) return; active=false; var id=card.dataset.id;
    if(dx>80){ toggleDone(id); } else if(dx<-80){
      var s=Store.get(); var t=s.tasks.find(function(x){return x.id===id;}); if(t&&t.date){ t.date=addDaysIso(t.date,1); Store.set(s); paintTodayList(); }
    }
    card.style.transform=''; delete card.dataset.swipe;
  });
}

/* ================= Export / Import ================= */
function exportJSON(){
  var blob=new Blob([JSON.stringify(Store.get(),null,2)],{type:'application/json'});
  var a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='planner-export-'+new Date().toISOString().slice(0,10)+'.json'; a.click(); URL.revokeObjectURL(a.href);
}
function importJSON(e){
  var file=(e.target.files && e.target.files[0]) ? e.target.files[0] : null; if(!file) return;
  var fr=new FileReader();
  fr.onload=function(){ try{ var data=JSON.parse(fr.result); if(!data||!data.settings||!data.tasks) throw 0; Store.set(data); alert('Импортировано.'); }catch(err){ alert('Файл не распознан.'); } };
  fr.readAsText(file);
}

/* ================= Drag data ================= */
document.addEventListener('dragstart', function(e){
  var art=e.target.closest && e.target.closest('.task'); if(!art) return;
  e.dataTransfer.setData('text/id', art.dataset.id);
  e.dataTransfer.effectAllowed='move';
});
