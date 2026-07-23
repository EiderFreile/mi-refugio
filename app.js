// MI REFUGIO v4

const COLORS=[{id:'lav',hex:'#EDE9F8',dot:'#9B8EC4'},{id:'yellow',hex:'#FEF9C3',dot:'#CA8A04'},{id:'green',hex:'#DCFCE7',dot:'#16A34A'},{id:'pink',hex:'#FCE7F3',dot:'#DB2777'},{id:'blue',hex:'#DBEAFE',dot:'#2563EB'},{id:'peach',hex:'#FFEDD5',dot:'#EA580C'},{id:'gray',hex:'#F3F4F6',dot:'#6B7280'}];
const TIPO_ICONS={reunion:'👥',llamada:'📞',entrega:'⏰',recordatorio:'📌',otro:'🏢'};
const RECORDAR_CATS={idea:{icon:'💡',label:'Ideas'},preguntar:{icon:'❓',label:'Preguntar'},referencia:{icon:'🔖',label:'Referencias'},algun_dia:{icon:'🕐',label:'Algún día'}};
const DAY_TABS=[{id:'inicio',ico:'🏠',lbl:'Inicio'},{id:'listas',ico:'✅',lbl:'Listas'},{id:'notas',ico:'📝',lbl:'Notas'},{id:'gastos',ico:'💰',lbl:'Gastos'}];
const WORK_TABS=[{id:'hoy',ico:'☀️',lbl:'Hoy'},{id:'tareas',ico:'✅',lbl:'Tareas'},{id:'agenda',ico:'📅',lbl:'Agenda'},{id:'recordar',ico:'🧠',lbl:'Recordar'}];

let state={
  mode:localStorage.getItem('mode')||'day', tab:'inicio',
  darkMode:localStorage.getItem('darkMode')==='true',
  checklists:{}, progress:{}, weekProgress:{},
  notes:{}, gastos:{}, gastosWeek:{}, categorias:{},
  budget:parseFloat(localStorage.getItem('budget')||'0'),
  tareas:{}, eventos:{}, recordar:{},
};

let clColor=COLORS[0].id, noteColor=COLORS[1].id, clItems=[];
let calView='mes', calDate=new Date(), calSelected=todayKey();
let tareaFilter='todas', recordarFilter='todas';

// ── Init ──
document.addEventListener('DOMContentLoaded',()=>{
  if(state.darkMode) document.body.classList.add('dark');
  document.getElementById('pill-day').addEventListener('click',()=>setMode('day'));
  document.getElementById('pill-work').addEventListener('click',()=>setMode('work'));
  document.getElementById('fab').addEventListener('click',openQuickAdd);
  initListeners();
  renderGreeting();
  renderSettings();
  if('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(()=>{});
  if(typeof Notification!=='undefined'&&Notification.permission==='granted') startNotifCheck();
  document.addEventListener('visibilitychange',()=>{ if(document.visibilityState==='visible'){renderGreeting();checkAndSendNotif();}});
  if(state.mode==='work'){
    document.getElementById('pill-day').classList.remove('active');
    document.getElementById('pill-work').classList.add('active');
    state.tab='hoy'; renderNav(); navigateTo('hoy');
  } else { renderNav(); navigateTo('inicio'); }
  calDate=new Date(); renderCalendar();
});

// ── Firebase ──
function initListeners(){
  const t=todayKey(),w=weekKey();
  DB.listen('refugio2/checklists',d=>{state.checklists=d||{};renderChecklistsHome();renderChecklistsList();});
  DB.listen(`refugio2/progress/${t}`,d=>{state.progress=d||{};renderChecklistsHome();});
  DB.listen(`refugio2/progress/week_${w}`,d=>{state.weekProgress=d||{};renderChecklistsHome();});
  DB.listen('refugio2/notes',d=>{state.notes=d||{};renderNotes();renderNotesHome();});
  DB.listen('refugio2/categorias',d=>{state.categorias=d||{};});
  DB.listen(`refugio2/gastos/${t}`,d=>{state.gastos=d||{};renderGastos();renderGastosHome();});
  DB.listen('refugio2/gastos',d=>{state.gastosWeek=d||{};renderGastos();});
  DB.listen('refugio2/tareas',d=>{state.tareas=d||{};renderTareas();renderHoy();});
  DB.listen('refugio2/eventos',d=>{state.eventos=d||{};renderCalendar();renderHoy();});
  DB.listen('refugio2/recordar',d=>{state.recordar=d||{};renderRecordar();});
}

// ── Mode ──
function setMode(mode){
  state.mode=mode;
  localStorage.setItem('mode',mode);
  document.getElementById('pill-day').classList.toggle('active',mode==='day');
  document.getElementById('pill-work').classList.toggle('active',mode==='work');
  const first=mode==='day'?'inicio':'hoy';
  state.tab=first; renderNav(); navigateTo(first);
}

// ── Nav ──
function renderNav(){
  const tabs=state.mode==='day'?DAY_TABS:WORK_TABS;
  document.getElementById('bottom-nav').innerHTML=[...tabs,{id:'ajustes',ico:'⚙️',lbl:'Ajustes'}].map(t=>`
    <button class="nav-btn ${state.tab===t.id?'active':''}" onclick="navigateTo('${t.id}')">
      <div class="nav-icon">${t.ico}</div>
      <div class="nav-label">${t.lbl}</div>
    </button>`).join('');
}

function navigateTo(tab){
  state.tab=tab;
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  document.getElementById('screen-'+tab)?.classList.add('active');
  renderNav();
  if(tab==='tareas') renderTareaFilters();
  if(tab==='recordar') renderRecordarFilters();
  if(tab==='agenda') renderCalendar();
}

// ── Greeting ──
function renderGreeting(){
  const h=new Date().getHours();
  const g=h<13?'Buenos días':h<20?'Buenas tardes':'Buenas noches';
  const el=document.getElementById('greeting'); if(el) el.textContent=g;
  const dl=document.getElementById('date-label');
  if(dl) dl.textContent=new Date().toLocaleDateString('es-ES',{weekday:'long',day:'numeric',month:'long'});
  const ht=document.getElementById('hoy-title');
  if(ht) ht.textContent=new Date().toLocaleDateString('es-ES',{weekday:'long',day:'numeric',month:'long'});
}

// ── Quick Add ──
function openQuickAdd(){document.getElementById('quick-add').classList.add('open');}
function closeQuickAdd(){document.getElementById('quick-add').classList.remove('open');}
function quickAddAction(type){
  closeQuickAdd();
  if(type==='tarea'){openTareaSheet(null);}
  else if(type==='evento'){openEventoSheet(null);}
  else if(type==='nota'){openNoteSheet(null);}
  else if(type==='recordar'){openRecordarSheet(null);}
}

// ── Color picker ──
function renderColorPicker(id,selected){
  const el=document.getElementById(id); if(!el) return;
  el.innerHTML=COLORS.map(c=>`<div class="color-dot ${c.id===selected?'selected':''}" style="background:${c.dot};" onclick="selectColor('${id}','${c.id}')"></div>`).join('');
}
function selectColor(pid,cid){
  if(pid==='cl-color-picker') clColor=cid;
  if(pid==='note-color-picker') noteColor=cid;
  renderColorPicker(pid,cid);
}

// ── Progress ring ──
function ring(done,total){
  const pct=total?done/total:0,r=12,circ=2*Math.PI*r,offset=circ*(1-pct);
  return `<svg class="progress-ring" viewBox="0 0 32 32"><circle class="ring-bg" cx="16" cy="16" r="${r}"/><circle class="ring-fill" cx="16" cy="16" r="${r}" stroke="${pct===1?'#16A34A':'#9B8EC4'}" stroke-dasharray="${circ}" stroke-dashoffset="${offset}" transform="rotate(-90 16 16)"/><text x="16" y="20" text-anchor="middle" font-size="9" font-weight="700" fill="var(--text-soft)" font-family="Plus Jakarta Sans,sans-serif">${done}/${total}</text></svg>`;
}

// ── CHECKLISTS ──
function shouldShow(cl){
  const f=cl.frecuencia||'daily';
  if(f==='daily'||f==='weekly') return true;
  const days=parseInt(f);
  if(!isNaN(days)){const diff=Math.floor((Date.now()-new Date(cl.createdAt||Date.now()).getTime())/86400000);return diff%days===0;}
  return true;
}
function getOpenIds(){const s=new Set();document.querySelectorAll('.cl-items.open').forEach(el=>s.add(el.id.replace('cli-','')));return s;}

function renderChecklistsHome(){
  const container=document.getElementById('checklists-home'); if(!container) return;
  const openIds=getOpenIds();
  const today=Object.values(state.checklists).filter(cl=>shouldShow(cl));
  if(!today.length){container.innerHTML=`<div class="empty-state"><div class="empty-icon">✅</div><p>Sin listas para hoy.<br>Ve a <strong>Listas</strong> para crear una.</p></div>`;return;}
  container.innerHTML=today.map(cl=>{
    const items=cl.items?Object.values(cl.items):[];
    const isW=cl.frecuencia==='weekly';
    const prog=isW?(state.weekProgress?.[cl.id]||{}):(state.progress?.[cl.id]||{});
    const done=items.filter(it=>prog[it.id]).length;
    const dot=COLORS.find(c=>c.id===cl.color)?.dot||'#9B8EC4';
    const tag=isW?`<span style="font-size:10px;background:var(--lav-light);color:var(--lav);padding:2px 7px;border-radius:99px;font-weight:700;margin-left:6px;">Semanal</span>`:'';
    return `<div class="checklist-card"><div class="cl-header" onclick="toggleCL('${cl.id}')"><div class="cl-dot" style="background:${dot};"></div><div class="cl-info"><div class="cl-name">${cl.name}${tag}</div><div class="cl-meta">${done}/${items.length} completados</div></div><div>${ring(done,items.length)}</div></div><div class="cl-items ${openIds.has(cl.id)?'open':''}" id="cli-${cl.id}">${items.map(it=>{const checked=!!prog[it.id];return`<div class="check-item" onclick="event.stopPropagation();toggleItem('${cl.id}','${it.id}','${cl.frecuencia}')"><div class="check-box ${checked?'checked':''}"><svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M1.5 5.5L4 8L9.5 2.5" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></div><span class="check-label ${checked?'done':''}">${it.text}</span></div>`;}).join('')}</div></div>`;
  }).join('');
}

function toggleCL(id){document.getElementById('cli-'+id)?.classList.toggle('open');}
function toggleItem(clId,itemId,frecuencia){
  const isW=frecuencia==='weekly';
  const key=isW?`week_${weekKey()}`:todayKey();
  const prog=isW?(state.weekProgress?.[clId]||{}):(state.progress?.[clId]||{});
  DB.update(`refugio2/progress/${key}/${clId}`,{[itemId]:!prog[itemId]});
}

function renderChecklistsList(){
  const container=document.getElementById('checklists-list'); if(!container) return;
  const all=Object.values(state.checklists);
  if(!all.length){container.innerHTML=`<div class="empty-state"><div class="empty-icon">📋</div><p>Sin listas.<br>Pulsa + para crear una.</p></div>`;return;}
  const fl=f=>f==='daily'?'Diaria':f==='weekly'?'Semanal':`Cada ${f} días`;
  container.innerHTML=all.map(cl=>{const items=cl.items?Object.values(cl.items):[];const dot=COLORS.find(c=>c.id===cl.color)?.dot||'#9B8EC4';return`<div class="card" onclick="openCLSheet(${JSON.stringify(cl).replace(/"/g,'&quot;')})" style="padding:14px 16px;display:flex;align-items:center;gap:12px;cursor:pointer;"><div class="cl-dot" style="background:${dot};"></div><div style="flex:1;"><div style="font-size:15px;font-weight:600;">${cl.name}</div><div style="font-size:12px;color:var(--text-muted);margin-top:2px;">${fl(cl.frecuencia)} · ${items.length} items</div></div><span style="color:var(--text-muted);font-size:16px;">›</span></div>`;}).join('');
}

function openCLSheet(cl){
  const isNew=!cl;
  document.getElementById('cl-id').value=cl?.id||'';
  document.getElementById('cl-name').value=cl?.name||'';
  document.getElementById('cl-freq').value=cl?.frecuencia||'daily';
  document.getElementById('cl-sheet-title').textContent=isNew?'Nueva lista':'Editar lista';
  document.getElementById('cl-delete-btn').style.display=isNew?'none':'block';
  clColor=cl?.color||COLORS[0].id;
  renderColorPicker('cl-color-picker',clColor);
  clItems=cl?.items?Object.values(cl.items).map(i=>({...i})):[];
  renderCLItems();
  document.getElementById('cl-sheet').classList.add('open');
}
function closeCLSheet(){document.getElementById('cl-sheet').classList.remove('open');}
function renderCLItems(){document.getElementById('cl-items-container').innerHTML=clItems.map((item,i)=>`<div class="item-row"><input class="input-field" value="${item.text||''}" placeholder="Nombre del item" oninput="clItems[${i}].text=this.value"><button class="remove-btn" onclick="clItems.splice(${i},1);renderCLItems()">×</button></div>`).join('');}
function addCLItem(){clItems.push({id:Date.now().toString(),text:''});renderCLItems();const inputs=document.querySelectorAll('#cl-items-container .input-field');inputs[inputs.length-1]?.focus();}
function saveCL(){
  const name=document.getElementById('cl-name').value.trim();
  if(!name){showToast('Ponle un nombre');return;}
  const items=clItems.filter(i=>i.text.trim());
  if(!items.length){showToast('Añade al menos un item');return;}
  const id=document.getElementById('cl-id').value||Date.now().toString();
  DB.set(`refugio2/checklists/${id}`,{id,name,color:clColor,frecuencia:document.getElementById('cl-freq').value,createdAt:Date.now(),items:Object.fromEntries(items.map(i=>[i.id,{id:i.id,text:i.text.trim()}]))}).then(()=>{closeCLSheet();showToast('Lista guardada ✓');});
}
function deleteCL(){const id=document.getElementById('cl-id').value;if(!id||!confirm('¿Eliminar?'))return;DB.remove(`refugio2/checklists/${id}`).then(()=>{closeCLSheet();showToast('Eliminada');});}

// ── NOTAS ──
function renderNotesHome(){
  const c=document.getElementById('notes-home'); if(!c) return;
  const notes=Object.values(state.notes).sort((a,b)=>b.createdAt-a.createdAt).slice(0,3);
  if(!notes.length){c.innerHTML='';return;}
  c.innerHTML=`<div style="display:flex;align-items:center;justify-content:space-between;margin:18px 0 8px;"><div class="section-label" style="margin:0;">Notas recientes</div><button onclick="navigateTo('notas')" style="font-size:12px;color:var(--lav);background:none;border:none;cursor:pointer;font-weight:700;">Ver todas →</button></div>${notes.map(n=>{const bg=COLORS.find(c=>c.id===n.color)?.hex||COLORS[1].hex;const p=n.text.length>80?n.text.slice(0,80)+'...':n.text;return`<div onclick="openNoteSheet(${JSON.stringify(n).replace(/"/g,'&quot;')})" style="background:${bg};border-radius:12px;padding:12px 14px;margin-bottom:8px;cursor:pointer;font-size:13px;color:rgba(26,26,26,0.85);line-height:1.5;">${p}</div>`;}).join('')}`;
}
function renderNotes(){
  const area=document.querySelector('#screen-notas .scroll-area'); if(!area) return;
  const notes=Object.values(state.notes).sort((a,b)=>b.createdAt-a.createdAt);
  if(!notes.length){area.innerHTML=`<div class="empty-state"><div class="empty-icon">📝</div><p>Sin notas.<br>Pulsa + para añadir.</p></div>`;return;}
  area.innerHTML=`<div class="notes-grid">${notes.map(n=>{const bg=COLORS.find(c=>c.id===n.color)?.hex||COLORS[1].hex;const date=new Date(n.createdAt).toLocaleDateString('es-ES',{day:'numeric',month:'short'});const p=n.text.length>100?n.text.slice(0,100)+'...':n.text;return`<div class="postit" style="background:${bg};" onclick="openNoteSheet(${JSON.stringify(n).replace(/"/g,'&quot;')})"><div class="postit-text">${p}</div><div class="postit-date">${date}</div></div>`;}).join('')}</div>`;
}
function openNoteSheet(note){
  const isNew=!note;
  document.getElementById('note-id').value=note?.id||'';
  document.getElementById('note-text').value=note?.text||'';
  document.getElementById('note-sheet-title').textContent=isNew?'Nueva nota':'Editar nota';
  document.getElementById('note-delete-btn').style.display=isNew?'none':'block';
  noteColor=note?.color||COLORS[1].id;
  renderColorPicker('note-color-picker',noteColor);
  document.getElementById('note-sheet').classList.add('open');
}
function closeNoteSheet(){document.getElementById('note-sheet').classList.remove('open');}
function saveNote(){
  const text=document.getElementById('note-text').value.trim();
  if(!text){showToast('Escribe algo');return;}
  const id=document.getElementById('note-id').value||Date.now().toString();
  DB.set(`refugio2/notes/${id}`,{id,text,color:noteColor,createdAt:state.notes[id]?.createdAt||Date.now()}).then(()=>{closeNoteSheet();showToast('Nota guardada ✓');});
}
function deleteNote(){const id=document.getElementById('note-id').value;if(!id||!confirm('¿Eliminar?'))return;DB.remove(`refugio2/notes/${id}`).then(()=>{closeNoteSheet();showToast('Eliminada');});}

// ── GASTOS ──
function getCats(){return Object.values(state.categorias).length?Object.values(state.categorias):[{id:'otros',emoji:'💰',name:'Otros'}];}
function renderGastosHome(){
  const c=document.getElementById('gastos-home'); if(!c) return;
  const gastos=Object.values(state.gastos);
  if(!gastos.length&&!state.budget){c.innerHTML='';return;}
  const total=gastos.reduce((s,g)=>s+g.amount,0);
  const restante=state.budget?state.budget-total:null;
  c.innerHTML=`<div style="display:flex;align-items:center;justify-content:space-between;margin:18px 0 8px;"><div class="section-label" style="margin:0;">Gastos de hoy</div><button onclick="navigateTo('gastos')" style="font-size:12px;color:var(--lav);background:none;border:none;cursor:pointer;font-weight:700;">Ver todo →</button></div><div class="gastos-stats"><div class="gasto-stat"><div class="gasto-num">${total.toFixed(2)}€</div><div class="gasto-label">Gastado</div></div><div class="gasto-stat"><div class="gasto-num" style="color:${restante<0?'var(--red)':'var(--green)'}">${restante!==null?restante.toFixed(2)+'€':'—'}</div><div class="gasto-label">Restante</div></div><div class="gasto-stat"><div class="gasto-num">${state.budget?Math.round((total/state.budget)*100)+'%':'—'}</div><div class="gasto-label">Usado</div></div></div>`;
}
function renderGastos(){
  const area=document.querySelector('#screen-gastos .scroll-area'); if(!area) return;
  const gastos=Object.values(state.gastos).sort((a,b)=>b.ts-a.ts);
  const total=gastos.reduce((s,g)=>s+g.amount,0);
  const restante=state.budget?state.budget-total:null;
  const today=new Date(),wd=(today.getDay()+6)%7;
  const mon=new Date(today);mon.setDate(today.getDate()-wd);
  const weekTotals=Array(7).fill(0);
  for(let i=0;i<7;i++){const d=new Date(mon);d.setDate(mon.getDate()+i);const k=d.toISOString().slice(0,10);weekTotals[i]=Object.values(state.gastosWeek?.[k]||{}).reduce((s,g)=>s+g.amount,0);}
  const maxW=Math.max(...weekTotals,1);
  const days=['L','M','X','J','V','S','D'];
  area.innerHTML=`<div class="gastos-stats"><div class="gasto-stat"><div class="gasto-num">${total.toFixed(2)}€</div><div class="gasto-label">Hoy</div></div><div class="gasto-stat"><div class="gasto-num" style="color:${restante<0?'var(--red)':'var(--green)'}">${restante!==null?restante.toFixed(2)+'€':'—'}</div><div class="gasto-label">Restante</div></div><div class="gasto-stat" onclick="openBudgetSheet()" style="cursor:pointer;"><div class="gasto-num">${state.budget?state.budget+'€':'Fijar'}</div><div class="gasto-label">Presupuesto</div></div></div><div class="section-label">Esta semana</div><div class="card" style="padding:14px 16px;"><div class="week-bars">${days.map((d,i)=>`<div class="week-bar-wrap"><div class="week-amt-lbl">${weekTotals[i]>0?weekTotals[i].toFixed(0)+'€':''}</div><div class="week-bar ${i>wd?'future':''}" style="height:${Math.round((weekTotals[i]/maxW)*50)}px;"></div><div class="week-day-lbl" style="color:${i===wd?'var(--lav)':'var(--text-muted)'}">${d}</div></div>`).join('')}</div></div><div class="section-label">Gastos de hoy</div>${gastos.length?`<div class="card">${gastos.map(g=>{const cat=getCats().find(c=>c.id===g.catId)||{emoji:'💰',name:'Otros'};return`<div class="gasto-row" onclick="openGastoSheet(${JSON.stringify(g).replace(/"/g,'&quot;')})"><span style="font-size:20px;width:28px;text-align:center;">${cat.emoji}</span><div style="flex:1;"><div style="font-size:14px;font-weight:600;">${cat.name}</div>${g.desc?`<div style="font-size:12px;color:var(--text-muted);">${g.desc}</div>`:''}</div><div style="font-size:15px;font-weight:700;">${g.amount.toFixed(2)}€</div></div>`;}).join('')}</div>`:`<div class="empty-state" style="padding:24px;"><p>Sin gastos hoy.</p></div>`}`;
}
function openGastoSheet(g){
  const isNew=!g;
  document.getElementById('gasto-id').value=g?.id||'';
  document.getElementById('gasto-amount').value=g?.amount||'';
  document.getElementById('gasto-desc').value=g?.desc||'';
  document.getElementById('gasto-sheet-title').textContent=isNew?'Nuevo gasto':'Editar gasto';
  document.getElementById('gasto-delete-btn').style.display=isNew?'none':'block';
  document.getElementById('gasto-cat').innerHTML=getCats().map(c=>`<option value="${c.id}" ${g?.catId===c.id?'selected':''}>${c.emoji} ${c.name}</option>`).join('');
  document.getElementById('gasto-sheet').classList.add('open');
}
function closeGastoSheet(){document.getElementById('gasto-sheet').classList.remove('open');}
function saveGasto(){
  const amount=parseFloat(document.getElementById('gasto-amount').value);
  if(!amount||isNaN(amount)){showToast('Introduce un importe');return;}
  const id=document.getElementById('gasto-id').value||Date.now().toString();
  DB.set(`refugio2/gastos/${todayKey()}/${id}`,{id,catId:document.getElementById('gasto-cat').value,amount,desc:document.getElementById('gasto-desc').value.trim(),ts:Date.now()}).then(()=>{closeGastoSheet();showToast('Gasto guardado ✓');});
}
function deleteGasto(){const id=document.getElementById('gasto-id').value;if(!id||!confirm('¿Eliminar?'))return;DB.remove(`refugio2/gastos/${todayKey()}/${id}`).then(()=>{closeGastoSheet();showToast('Eliminado');});}
function openCatSheet(){renderCatList();document.getElementById('cat-sheet').classList.add('open');}
function closeCatSheet(){document.getElementById('cat-sheet').classList.remove('open');}
function renderCatList(){document.getElementById('cat-list').innerHTML=getCats().map(c=>`<div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--border);"><span style="font-size:20px;">${c.emoji}</span><span style="flex:1;font-size:14px;font-weight:500;">${c.name}</span>${c.id!=='otros'?`<button onclick="deleteCat('${c.id}')" style="background:none;border:none;color:var(--text-muted);font-size:18px;cursor:pointer;">×</button>`:''}</div>`).join('');}
function addCat(){const name=document.getElementById('cat-new-name').value.trim(),emoji=document.getElementById('cat-new-emoji').value.trim()||'💰';if(!name){showToast('Escribe un nombre');return;}const id=Date.now().toString();DB.set(`refugio2/categorias/${id}`,{id,name,emoji}).then(()=>{document.getElementById('cat-new-name').value='';document.getElementById('cat-new-emoji').value='';renderCatList();});}
function deleteCat(id){if(!confirm('¿Eliminar?'))return;DB.remove(`refugio2/categorias/${id}`).then(()=>renderCatList());}
function openBudgetSheet(){document.getElementById('budget-amount').value=state.budget||'';document.getElementById('budget-sheet').classList.add('open');}
function closeBudgetSheet(){document.getElementById('budget-sheet').classList.remove('open');}
function saveBudget(){const v=parseFloat(document.getElementById('budget-amount').value);if(!v||isNaN(v)){showToast('Introduce un importe');return;}state.budget=v;localStorage.setItem('budget',v);closeBudgetSheet();showToast('Presupuesto guardado ✓');renderGastos();renderGastosHome();}

// ── HOY DASHBOARD ──
function renderHoy(){
  const area=document.getElementById('hoy-area'); if(!area) return;
  const today=todayKey();
  const allTareas=Object.values(state.tareas);
  const todayEvents=Object.values(state.eventos).filter(e=>e.date===today).sort((a,b)=>(a.time||'').localeCompare(b.time||''));
  const overdue=allTareas.filter(t=>t.status!=='terminada'&&t.date&&t.date<today);
  const prioridades=allTareas.filter(t=>t.status!=='terminada'&&(t.hoy||(t.date===today)));
  const enEspera=allTareas.filter(t=>t.status==='en_espera');
  const terminadas=allTareas.filter(t=>t.status==='terminada');
  const totalActive=allTareas.filter(t=>t.status!=='terminada').length;
  const pct=allTareas.length?Math.round((terminadas.length/allTareas.length)*100):0;

  const priIcon={alta:'🔴',media:'🟡',baja:'🟢'};
  const checkSvg=`<svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M1.5 5.5L4 8L9.5 2.5" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

  area.innerHTML=`
    ${todayEvents.length?`<div class="hoy-section"><div class="hoy-section-title">📅 Próximo</div>${todayEvents.map(e=>`<div class="hoy-event"><div class="hoy-time">${e.time||'·'}</div><div class="hoy-event-card"><div class="hoy-event-name">${TIPO_ICONS[e.tipo]||'📅'} ${e.name}</div>${e.notes?`<div class="hoy-event-sub">${e.notes}</div>`:''}</div></div>`).join('')}</div>`:''}
    ${prioridades.length?`<div class="hoy-section"><div class="hoy-section-title">⭐ Prioridades de hoy</div>${prioridades.map(t=>`<div class="hoy-task" onclick="openTareaSheet(${JSON.stringify(t).replace(/"/g,'&quot;')})"><div class="check-box" onclick="event.stopPropagation();completarTarea('${t.id}')"><svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M1.5 5.5L4 8L9.5 2.5" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></div><span style="flex:1;font-size:14px;font-weight:500;">${t.name}</span><span>${priIcon[t.priority]||''}</span></div>`).join('')}</div>`:''}
    ${overdue.length?`<div class="hoy-section"><div class="hoy-section-title">⏰ Vence hoy / Vencidas</div>${overdue.map(t=>`<div class="hoy-task overdue" onclick="openTareaSheet(${JSON.stringify(t).replace(/"/g,'&quot;')})"><div class="check-box" onclick="event.stopPropagation();completarTarea('${t.id}')"><svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M1.5 5.5L4 8L9.5 2.5" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></div><span style="flex:1;font-size:14px;font-weight:500;">${t.name}</span><span style="font-size:11px;color:var(--red);">Vencida ${t.date}</span></div>`).join('')}</div>`:''}
    ${enEspera.length?`<div class="hoy-section"><div class="hoy-section-title">⏳ En espera</div>${enEspera.map(t=>`<div class="hoy-task waiting" onclick="openTareaSheet(${JSON.stringify(t).replace(/"/g,'&quot;')})"><span style="font-size:16px;">⏳</span><span style="flex:1;font-size:14px;font-weight:500;">${t.name}</span>${t.notes?`<span style="font-size:11px;color:var(--text-muted);">${t.notes.slice(0,30)}</span>`:''}</div>`).join('')}</div>`:''}
    ${!todayEvents.length&&!prioridades.length&&!overdue.length&&!enEspera.length?`<div class="empty-state"><div class="empty-icon">✨</div><p>Todo al día.<br>Sin tareas urgentes hoy.</p></div>`:''}
    <div class="hoy-section" style="margin-top:16px;"><div class="hoy-progress"><div style="font-size:14px;font-weight:600;">✓ ${terminadas.length} de ${allTareas.length} tareas</div><div class="hoy-prog-bar"><div class="hoy-prog-fill" style="width:${pct}%;"></div></div><div style="font-size:13px;font-weight:700;color:var(--lav);">${pct}%</div></div></div>`;
}

function completarTarea(id){
  DB.update(`refugio2/tareas/${id}`,{status:'terminada'});
  showToast('¡Tarea completada! 🎉');
}

// ── TAREAS ──
function renderTareaFilters(){
  const bar=document.getElementById('tareas-filters'); if(!bar) return;
  const filters=[{id:'todas',label:'Todas'},{id:'hoy',label:'Hoy'},{id:'proximas',label:'Próximas'},{id:'en_espera',label:'En espera'},{id:'terminadas',label:'Terminadas'}];
  bar.innerHTML=filters.map(f=>`<button class="filter-btn ${tareaFilter===f.id?'active':''}" onclick="setTareaFilter('${f.id}')">${f.label}</button>`).join('');
}
function setTareaFilter(f){tareaFilter=f;renderTareaFilters();renderTareas();}

function renderTareas(){
  const area=document.getElementById('tareas-area'); if(!area) return;
  const today=todayKey();
  let all=Object.values(state.tareas);
  if(tareaFilter==='hoy') all=all.filter(t=>t.hoy||t.date===today);
  else if(tareaFilter==='proximas') all=all.filter(t=>t.status!=='terminada'&&t.date>today);
  else if(tareaFilter==='en_espera') all=all.filter(t=>t.status==='en_espera');
  else if(tareaFilter==='terminadas') all=all.filter(t=>t.status==='terminada');
  else all=all.filter(t=>t.status!=='terminada');
  all.sort((a,b)=>{const p={alta:0,media:1,baja:2};return p[a.priority]-p[b.priority];});
  if(!all.length){area.innerHTML=`<div class="empty-state"><div class="empty-icon">✅</div><p>Sin tareas.<br>Pulsa + para añadir.</p></div>`;return;}
  const priColors={alta:'p-alta',media:'p-media',baja:'p-baja'};
  const priIcon={alta:'🔴',media:'🟡',baja:'🟢'};
  area.innerHTML=all.map(t=>{
    const isOverdue=t.date&&t.date<today&&t.status!=='terminada';
    return`<div class="task-card ${isOverdue?'overdue':priColors[t.priority]}" onclick="openTareaSheet(${JSON.stringify(t).replace(/"/g,'&quot;')})">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;">
        <div class="task-name" style="${t.status==='terminada'?'text-decoration:line-through;color:var(--text-muted)':''}">${priIcon[t.priority]||''} ${t.name}</div>
        ${t.status==='terminada'?`<span class="tag tag-green">✓</span>`:t.status==='en_espera'?`<span class="tag tag-yellow">⏳</span>`:''}
      </div>
      <div class="task-meta">
        ${t.date?`<span>${isOverdue?'⚠️':'📅'} ${t.date}</span>`:''}
        ${t.cat?`<span class="tag tag-gray">${t.cat}</span>`:''}
        ${t.hoy?`<span class="tag tag-lav">HOY</span>`:''}
      </div>
      ${t.notes?`<div style="font-size:12px;color:var(--text-muted);margin-top:6px;">${t.notes.slice(0,80)}${t.notes.length>80?'...':''}</div>`:''}
    </div>`;
  }).join('');
}

function openTareaSheet(t){
  const isNew=!t;
  document.getElementById('tarea-id').value=t?.id||'';
  document.getElementById('tarea-name').value=t?.name||'';
  document.getElementById('tarea-priority').value=t?.priority||'media';
  document.getElementById('tarea-status').value=t?.status||'pendiente';
  document.getElementById('tarea-date').value=t?.date||'';
  document.getElementById('tarea-cat').value=t?.cat||'';
  document.getElementById('tarea-notes').value=t?.notes||'';
  document.getElementById('tarea-hoy').checked=!!t?.hoy;
  document.getElementById('tarea-sheet-title').textContent=isNew?'Nueva tarea':'Editar tarea';
  document.getElementById('tarea-delete-btn').style.display=isNew?'none':'block';
  document.getElementById('tarea-sheet').classList.add('open');
}
function closeTareaSheet(){document.getElementById('tarea-sheet').classList.remove('open');}
function saveTarea(){
  const name=document.getElementById('tarea-name').value.trim();
  if(!name){showToast('Escribe el nombre');return;}
  const id=document.getElementById('tarea-id').value||Date.now().toString();
  DB.set(`refugio2/tareas/${id}`,{id,name,priority:document.getElementById('tarea-priority').value,status:document.getElementById('tarea-status').value,date:document.getElementById('tarea-date').value,cat:document.getElementById('tarea-cat').value,notes:document.getElementById('tarea-notes').value.trim(),hoy:document.getElementById('tarea-hoy').checked,createdAt:state.tareas[id]?.createdAt||Date.now()}).then(()=>{closeTareaSheet();showToast('Tarea guardada ✓');});
}
function deleteTarea(){const id=document.getElementById('tarea-id').value;if(!id||!confirm('¿Eliminar?'))return;DB.remove(`refugio2/tareas/${id}`).then(()=>{closeTareaSheet();showToast('Eliminada');});}

// ── AGENDA CALENDARIO ──
function setCalView(v){
  calView=v;
  ['mes','semana','dia'].forEach(x=>document.getElementById('view-'+x)?.classList.toggle('active',x===v));
  renderCalendar();
}

function calNav(dir){
  if(calView==='mes'){calDate.setMonth(calDate.getMonth()+dir);}
  else if(calView==='semana'){calDate.setDate(calDate.getDate()+dir*7);}
  else{calDate.setDate(calDate.getDate()+dir);}
  calDate=new Date(calDate);
  renderCalendar();
}

function renderCalendar(){
  const title=document.getElementById('cal-title');
  const area=document.getElementById('cal-area'); if(!area) return;

  if(calView==='mes') renderCalMes(title,area);
  else if(calView==='semana') renderCalSemana(title,area);
  else renderCalDia(title,area);
}

function eventosDelDia(dateKey){
  return Object.values(state.eventos).filter(e=>e.date===dateKey).sort((a,b)=>(a.time||'').localeCompare(b.time||''));
}

function renderCalMes(title,area){
  const y=calDate.getFullYear(),m=calDate.getMonth();
  if(title) title.textContent=new Date(y,m,1).toLocaleDateString('es-ES',{month:'long',year:'numeric'}).replace(/^\w/,c=>c.toUpperCase());
  const firstDay=(new Date(y,m,1).getDay()+6)%7;
  const days=new Date(y,m+1,0).getDate();
  const today=todayKey();
  let html=`<div class="cal-grid">${['L','M','X','J','V','S','D'].map(d=>`<div class="cal-day-label">${d}</div>`).join('')}`;
  for(let i=0;i<firstDay;i++) html+=`<div class="cal-day empty"></div>`;
  for(let d=1;d<=days;d++){
    const key=`${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const evs=eventosDelDia(key);
    const isToday=key===today,isSel=key===calSelected;
    const dots=evs.slice(0,3).map(e=>`<div class="cal-dot" style="background:${e.tipo==='entrega'?'var(--red)':e.tipo==='llamada'?'var(--green)':'var(--lav)'};"></div>`).join('');
    html+=`<div class="cal-day ${isToday?'today':isSel?'selected':''}" onclick="selectDay('${key}')">
      <div class="cal-day-num">${d}</div>
      ${evs.length?`<div class="cal-dots">${dots}</div>`:''}
    </div>`;
  }
  html+='</div>';
  // Selected day events
  const selEvs=eventosDelDia(calSelected);
  if(selEvs.length){
    html+=`<div class="section-label">${new Date(calSelected+'T12:00:00').toLocaleDateString('es-ES',{weekday:'long',day:'numeric',month:'long'})}</div>
    <div class="cal-selected-events">${selEvs.map(e=>`<div class="cal-event-row" onclick="openEventoSheet(${JSON.stringify(e).replace(/"/g,'&quot;')})">
      <div class="cal-event-time">${e.time||'·'}</div>
      <div class="cal-event-info"><div class="cal-event-name">${TIPO_ICONS[e.tipo]||'📅'} ${e.name}</div>${e.notes?`<div class="cal-event-type">${e.notes}</div>`:''}</div>
    </div>`).join('')}</div>`;
  } else if(calSelected){
    html+=`<div style="text-align:center;padding:20px 0;color:var(--text-muted);font-size:13px;">Sin eventos · <button onclick="openEventoSheet(null)" style="color:var(--lav);background:none;border:none;cursor:pointer;font-weight:600;">+ Añadir</button></div>`;
  }
  area.innerHTML=html;
}

function renderCalSemana(title,area){
  const wd=(calDate.getDay()+6)%7;
  const mon=new Date(calDate); mon.setDate(calDate.getDate()-wd);
  const days=Array.from({length:7},(_,i)=>{const d=new Date(mon);d.setDate(mon.getDate()+i);return d;});
  if(title) title.textContent=`${mon.toLocaleDateString('es-ES',{day:'numeric',month:'short'})} – ${days[6].toLocaleDateString('es-ES',{day:'numeric',month:'short'})}`;
  const today=todayKey();
  const dayLabels=['L','M','X','J','V','S','D'];
  area.innerHTML=`<div class="week-row">${days.map((d,i)=>{
    const key=d.toISOString().slice(0,10);
    const evs=eventosDelDia(key);
    const isToday=key===today;
    return`<div class="week-day-col">
      <div class="week-day-header ${isToday?'today':''}">${dayLabels[i]}<br><span style="font-size:13px;font-weight:700;">${d.getDate()}</span></div>
      ${evs.map(e=>`<div class="week-event" onclick="openEventoSheet(${JSON.stringify(e).replace(/"/g,'&quot;')})">
        <div class="week-event-time">${e.time||'·'}</div>
        <div class="week-event-name">${e.name}</div>
      </div>`).join('')}
    </div>`;
  }).join('')}</div>`;
}

function renderCalDia(title,area){
  const key=calDate.toISOString().slice(0,10);
  const fecha=calDate.toLocaleDateString('es-ES',{weekday:'long',day:'numeric',month:'long'});
  if(title) title.textContent=fecha.replace(/^\w/,c=>c.toUpperCase());
  const evs=eventosDelDia(key);
  area.innerHTML=evs.length
    ?`<div class="cal-selected-events">${evs.map(e=>`<div class="cal-event-row" onclick="openEventoSheet(${JSON.stringify(e).replace(/"/g,'&quot;')})"><div class="cal-event-time">${e.time||'·'}</div><div class="cal-event-info"><div class="cal-event-name">${TIPO_ICONS[e.tipo]||'📅'} ${e.name}</div>${e.notes?`<div class="cal-event-type">${e.notes}</div>`:''}</div></div>`).join('')}</div>`
    :`<div class="empty-state"><div class="empty-icon">📅</div><p>Sin eventos este día.<br><button onclick="openEventoSheet(null)" style="color:var(--lav);background:none;border:none;cursor:pointer;font-weight:600;font-size:14px;">+ Añadir evento</button></p></div>`;
}

function selectDay(key){calSelected=key;renderCalendar();}

function openEventoSheet(e){
  const isNew=!e;
  document.getElementById('evento-id').value=e?.id||'';
  document.getElementById('evento-name').value=e?.name||'';
  document.getElementById('evento-tipo').value=e?.tipo||'reunion';
  document.getElementById('evento-date').value=e?.date||(calSelected||todayKey());
  document.getElementById('evento-time').value=e?.time||'';
  document.getElementById('evento-notes').value=e?.notes||'';
  document.getElementById('evento-sheet-title').textContent=isNew?'Nuevo evento':'Editar evento';
  document.getElementById('evento-delete-btn').style.display=isNew?'none':'block';
  document.getElementById('evento-sheet').classList.add('open');
}
function closeEventoSheet(){document.getElementById('evento-sheet').classList.remove('open');}
function saveEvento(){
  const name=document.getElementById('evento-name').value.trim();
  if(!name){showToast('Escribe el título');return;}
  const id=document.getElementById('evento-id').value||Date.now().toString();
  DB.set(`refugio2/eventos/${id}`,{id,name,tipo:document.getElementById('evento-tipo').value,date:document.getElementById('evento-date').value,time:document.getElementById('evento-time').value,notes:document.getElementById('evento-notes').value.trim()}).then(()=>{closeEventoSheet();showToast('Evento guardado ✓');renderCalendar();});
}
function deleteEvento(){const id=document.getElementById('evento-id').value;if(!id||!confirm('¿Eliminar?'))return;DB.remove(`refugio2/eventos/${id}`).then(()=>{closeEventoSheet();showToast('Eliminado');renderCalendar();});}

// ── RECORDAR ──
function renderRecordarFilters(){
  const bar=document.getElementById('recordar-filters'); if(!bar) return;
  const filters=[{id:'todas',label:'Todas'},...Object.entries(RECORDAR_CATS).map(([k,v])=>({id:k,label:`${v.icon} ${v.label}`}))];
  bar.innerHTML=filters.map(f=>`<button class="filter-btn ${recordarFilter===f.id?'active':''}" onclick="setRecordarFilter('${f.id}')">${f.label}</button>`).join('');
}
function setRecordarFilter(f){recordarFilter=f;renderRecordarFilters();renderRecordar();}

function renderRecordar(){
  const area=document.getElementById('recordar-area'); if(!area) return;
  let all=Object.values(state.recordar).sort((a,b)=>b.ts-a.ts);
  if(recordarFilter!=='todas') all=all.filter(r=>r.cat===recordarFilter);
  if(!all.length){area.innerHTML=`<div class="empty-state"><div class="empty-icon">🧠</div><p>Sin notas.<br>Pulsa + para añadir ideas, preguntas o referencias.</p></div>`;return;}
  const groups=recordarFilter==='todas'?Object.keys(RECORDAR_CATS):[recordarFilter];
  area.innerHTML=groups.map(cat=>{
    const items=all.filter(r=>r.cat===cat);
    if(!items.length) return'';
    const {icon,label}=RECORDAR_CATS[cat];
    return`<div class="section-label">${icon} ${label}</div>${items.map(r=>`<div class="recordar-card" onclick="openRecordarSheet(${JSON.stringify(r).replace(/"/g,'&quot;')})"><div class="recordar-text">${r.text}</div>${r.context?`<div class="recordar-ctx">${r.context}</div>`:''}</div>`).join('')}`;
  }).join('');
}

function openRecordarSheet(r){
  const isNew=!r;
  document.getElementById('recordar-id').value=r?.id||'';
  document.getElementById('recordar-cat').value=r?.cat||'idea';
  document.getElementById('recordar-text').value=r?.text||'';
  document.getElementById('recordar-context').value=r?.context||'';
  document.getElementById('recordar-sheet-title').textContent=isNew?'Nueva nota':'Editar nota';
  document.getElementById('recordar-delete-btn').style.display=isNew?'none':'block';
  document.getElementById('recordar-sheet').classList.add('open');
}
function closeRecordarSheet(){document.getElementById('recordar-sheet').classList.remove('open');}
function saveRecordar(){
  const text=document.getElementById('recordar-text').value.trim();
  if(!text){showToast('Escribe algo');return;}
  const id=document.getElementById('recordar-id').value||Date.now().toString();
  DB.set(`refugio2/recordar/${id}`,{id,cat:document.getElementById('recordar-cat').value,text,context:document.getElementById('recordar-context').value.trim(),ts:state.recordar[id]?.ts||Date.now()}).then(()=>{closeRecordarSheet();showToast('Guardado ✓');});
}
function deleteRecordar(){const id=document.getElementById('recordar-id').value;if(!id||!confirm('¿Eliminar?'))return;DB.remove(`refugio2/recordar/${id}`).then(()=>{closeRecordarSheet();showToast('Eliminado');});}

// ── AJUSTES ──
function renderSettings(){
  const t=document.getElementById('dark-toggle'); if(!t) return;
  t.classList.toggle('on',state.darkMode);
  t.addEventListener('click',()=>{state.darkMode=!state.darkMode;localStorage.setItem('darkMode',state.darkMode);document.body.classList.toggle('dark',state.darkMode);t.classList.toggle('on',state.darkMode);});
}

// ── NOTIFICACIONES ──
const NOTIF_TIMES=[{hour:9,min:0,key:'morning',msg:'¡Buenos días! Revisa tus listas 🌿'},{hour:21,min:0,key:'evening',msg:'¿Has revisado tus tareas de hoy? 🌙'}];
async function initNotifications(){
  if(!('Notification' in window)){showToast('No soportado');return;}
  if(Notification.permission==='denied'){showToast('Bloqueadas en ajustes');return;}
  const r=await Notification.requestPermission();
  if(r==='granted'){showToast('Notificaciones activadas ✓');startNotifCheck();}else showToast('Permiso denegado');
}
function checkAndSendNotif(){
  if(Notification.permission!=='granted') return;
  const now=new Date(),h=now.getHours(),m=now.getMinutes();
  NOTIF_TIMES.forEach(({hour,min,key,msg})=>{
    if(h===hour&&m===min){const k=`notif_${key}_${now.toISOString().slice(0,10)}`;if(!localStorage.getItem(k)){localStorage.setItem(k,'1');new Notification('Mi Refugio',{body:msg,icon:'/mi-refugio/icon-192.png'});}}
  });
}
function startNotifCheck(){setInterval(checkAndSendNotif,60000);}

// ── TOAST ──
function showToast(msg,d=2000){
  const t=document.getElementById('toast'); if(!t) return;
  t.textContent=msg;t.style.opacity='1';t.style.transform='translateX(-50%) translateY(0)';
  clearTimeout(t._t);t._t=setTimeout(()=>{t.style.opacity='0';t.style.transform='translateX(-50%) translateY(20px)';},d);
}
