// MI REFUGIO v4

const COLORS=[{id:'lav',hex:'#EDE9F8',dot:'#9B8EC4'},{id:'yellow',hex:'#FEF9C3',dot:'#CA8A04'},{id:'green',hex:'#DCFCE7',dot:'#16A34A'},{id:'pink',hex:'#FCE7F3',dot:'#DB2777'},{id:'blue',hex:'#DBEAFE',dot:'#2563EB'},{id:'peach',hex:'#FFEDD5',dot:'#EA580C'},{id:'gray',hex:'#F3F4F6',dot:'#6B7280'}];
const TIPO_ICONS={reunion:'👥',llamada:'📞',entrega:'⏰',recordatorio:'📌',otro:'🏢'};
const DAY_TABS=[{id:'inicio',ico:'🏠',lbl:'Inicio'},{id:'listas',ico:'✅',lbl:'Listas'},{id:'porhacer',ico:'✍️',lbl:'Por hacer'},{id:'notas',ico:'📝',lbl:'Notas'}];
const WORK_TABS=[{id:'hoy',ico:'☀️',lbl:'Resumen'},{id:'tareas',ico:'✅',lbl:'Tareas'},{id:'agenda',ico:'📅',lbl:'Agenda'}];

let state={
  mode:localStorage.getItem('mode')||'day', tab:'inicio',
  darkMode:localStorage.getItem('darkMode')==='true',
  checklists:{}, progress:{}, weekProgress:{},
  notes:{}, gastos:{}, gastosWeek:{}, categorias:{},
  budget:parseFloat(localStorage.getItem('budget')||'0'),
  tareas:{}, eventos:{}, tareaCats:{}, porhacer:{},
};

let clColor=COLORS[0].id, noteColor=COLORS[1].id, clItems=[], editingPasos=[];
let calView='mes', calDate=new Date(), calSelected=todayKey();
let tareaFilter='todas';

// ── Init ──
document.addEventListener('DOMContentLoaded',()=>{
  // Nav positioned via CSS

  if(state.darkMode) document.body.classList.add('dark');
  document.getElementById('pill-day').addEventListener('click',()=>setMode('day'));
  document.getElementById('pill-work').addEventListener('click',()=>setMode('work'));
  document.getElementById('fab').addEventListener('click', ()=>{
    if(state.mode === 'day') openQuickAddDay();
    else openQuickAddWork();
  });
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


// ── Calcula el estado efectivo de una tarea basado en sus pasos ──
function getEstadoEfectivo(t) {
  // status es la única fuente de verdad — normalizamos valores antiguos ('pendiente')
  // para que SIEMPRE coincida con el filtro que usa el propio tablero al pintar
  const s = t.status || 'en_espera';
  return s === 'pendiente' ? 'en_espera' : s;
}

// (drag-and-drop de tareas eliminado — el reordenar se hace con los botones ▲▼)

// Devuelve las tareas de una columna del kanban, en el mismo orden en que se pintan
// (filtradas por estado, ordenadas por prioridad primero) — usado tanto al pintar como al mover
function getTareaColItems(estado) {
  if (estado === 'terminada') {
    return Object.values(state.tareas).filter(t=>t.status==='terminada').sort((a,b)=>(b.completedAt||'').localeCompare(a.completedAt||'')).slice(0,20);
  }
  return Object.values(state.tareas)
    .filter(t => estado==='en_espera' ? (t.status==='en_espera'||t.status==='pendiente'||!t.status) : t.status===estado);
}

// Ordena por el campo `order` (lo que tú decides con las flechas).
// Si una tarea aún no tiene order asignado, cae por fecha de creación — nunca por prioridad.
function getSortedTareas(list) {
  return [...list].sort((a,b) => {
    const ao = a.order!==undefined ? a.order : (a.createdAt||0);
    const bo = b.order!==undefined ? b.order : (b.createdAt||0);
    return ao - bo;
  });
}

// Move tarea up or down in its column
function moveTarea(id, dir) {
  const t = state.tareas[id];
  if (!t) return;
  const estado = getEstadoEfectivo(t);
  const col = getSortedTareas(getTareaColItems(estado));
  // Normaliza SIEMPRE a valores únicos y crecientes — cura duplicados heredados (ej. varias tareas a la vez en order:0)
  col.forEach((item,i) => {
    const clean = i*10;
    if (item.order !== clean) {
      item.order = clean;
      DB.update(`refugio2/tareas/${item.id}`, {order: clean}).catch(e=>console.error('normalizando orden', e));
    }
  });
  const idx = col.findIndex(x=>x.id===id);
  if (idx === -1) return;
  const swapIdx = dir==='up' ? idx-1 : idx+1;
  if (swapIdx<0 || swapIdx>=col.length) return;
  const other = col[swapIdx];
  const aOrder = col[idx].order;
  const bOrder = other.order;
  // Optimista: se mueve YA en tu pantalla, sin esperar a Firebase
  col[idx].order = bOrder;
  other.order = aOrder;
  try {
    renderTareas();
    renderHoy();
  } catch(e) {
    showToast('❌ Error al repintar: '+e.message);
    console.error('moveTarea render error', e);
  }
  DB.update(`refugio2/tareas/${id}`, {order: bOrder}).catch(e=>{showToast('No se pudo guardar el orden'); console.error(e);});
  DB.update(`refugio2/tareas/${other.id}`, {order: aOrder}).catch(e=>{showToast('No se pudo guardar el orden'); console.error(e);});
}

// Move paso up or down
// (onDragStart, onDragOver, onDragEnd, onDrop eliminados — reordenar es solo con los botones ▲▼)


// ══════════════════════════════════════════
//  ÚNICA FUENTE DE VERDAD: cambiar estado
// ══════════════════════════════════════════
function setTareaStatus(id, newStatus) {
  const t = state.tareas[id]; if(!t) return;
  const updates = { status: newStatus };
  
  // Derivados del status - solo estos dos campos adicionales
  if(newStatus === 'en_curso') updates.hoy = true;
  if(newStatus === 'en_espera') updates.hoy = false;
  if(newStatus === 'terminada') { updates.hoy = false; updates.completedAt = todayKey(); }
  
  DB.update(`refugio2/tareas/${id}`, updates);
  // Firebase listener se encarga del resto - no hay que llamar a nada más
}



// Checkbox inteligente: completa tarea simple o siguiente paso
function completarTareaOPaso(id) {
  const t = state.tareas[id]; if(!t) return;
  if(!t.pasos || Object.keys(t.pasos).length === 0) {
    // Tarea simple: toggle terminada/en_espera
    setTareaStatus(id, t.status === 'terminada' ? 'en_espera' : 'terminada');
  } else {
    // Tarea con pasos: marcar siguiente paso pendiente
    const pasos = Object.values(t.pasos).sort((a,b)=>(a.order||0)-(b.order||0));
    const nextPaso = pasos.find(p=>!p.done && p.estado!=='terminada');
    if(nextPaso) togglePasoCheck(id, nextPaso.id, false);
    else setTareaStatus(id, 'terminada');
  }
}

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
  DB.listen('refugio2/porhacer',d=>{state.porhacer=d||{};renderPorHacer();renderPorHacerHome();});
  DB.listen('refugio2/tareaCats',d=>{state.tareaCats=d||{};renderTareaCatList();populateTareaCatSelect();});
  DB.listen('refugio2/eventos',d=>{state.eventos=d||{};renderCalendar();renderHoy();renderMiniCal();});
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
  document.getElementById('bottom-nav').innerHTML=tabs.map(t=>`
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
  if(tab==='agenda') renderCalendar();
  if(tab==='tareas') renderTareaCatList();
  const fab=document.getElementById('fab');
  if(fab) fab.style.display = tab==='ajustes' ? 'none' : 'flex';
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
function openQuickAddDay(){
  // Si está en una pestaña específica, abrir directamente
  if(state.tab==='listas'){openCLSheet(null);return;}
  if(state.tab==='porhacer'){openPorHacerSheet();return;}
  if(state.tab==='notas'){openNoteSheet(null);return;}
  // En inicio mostrar opciones de Mi día
  showQuickSheet([
    {ico:'✅',lbl:'Lista',fn:'openCLSheet(null)'},
    {ico:'✍️',lbl:'Por hacer',fn:'openPorHacerSheet()'},
    {ico:'📝',lbl:'Nota',fn:'openNoteSheet(null)'},
  ]);
}

function openQuickAddWork(){
  openTareaSheet(null);
}

function showQuickSheet(options){
  document.getElementById('quick-add').classList.add('open');
  document.getElementById('quick-add-grid').innerHTML = options.map(o=>`
    <div class="quick-add-btn" onclick="closeQuickAdd();${o.fn}">
      <div class="qa-icon">${o.ico}</div>
      <div class="qa-label">${o.lbl}</div>
    </div>`).join('');
}

function closeQuickAdd(){document.getElementById('quick-add').classList.remove('open');}

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
// ── POR HACER ──
function renderPorHacerHome(){
  const c=document.getElementById('porhacer-home'); if(!c) return;
  const items=Object.values(state.porhacer).sort((a,b)=>a.ts-b.ts);
  if(!items.length){c.innerHTML='';return;}
  c.innerHTML=`
    <div style="display:flex;align-items:center;justify-content:space-between;margin:18px 0 8px;">
      <div class="section-label" style="margin:0;">Por hacer</div>
      <button onclick="openPorHacerSheet()" style="font-size:12px;color:var(--lav);background:none;border:none;cursor:pointer;font-weight:700;">+ Añadir</button>
    </div>
    <div class="card">${items.map(item=>`
      <div class="check-item" onclick="completarPorHacerHome('${item.id}')">
        <div class="check-box" id="phbox-${item.id}">
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
            <path d="M1.5 5.5L4 8L9.5 2.5" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <span class="check-label" id="phlabel-${item.id}">${item.text}</span>
      </div>`).join('')}
    </div>`;
}

function completarPorHacerHome(id){
  const box=document.getElementById('phbox-'+id);
  const label=document.getElementById('phlabel-'+id);
  if(box) box.classList.add('checked');
  if(label) label.classList.add('done');
  setTimeout(()=>DB.remove(`refugio2/porhacer/${id}`), 400);
}

function renderPorHacer(){
  const area=document.getElementById('porhacer-area'); if(!area) return;
  const items=Object.values(state.porhacer).sort((a,b)=>a.ts-b.ts);
  if(!items.length){
    area.innerHTML=`<div class="empty-state"><div class="empty-icon">✍️</div><p>Sin pendientes.<br>Pulsa + para añadir.</p></div>`;
    return;
  }
  area.innerHTML=`<div class="card">${items.map(item=>`
    <div class="check-item" onclick="completarPorHacer('${item.id}')">
      <div class="check-box">
        <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
          <path d="M1.5 5.5L4 8L9.5 2.5" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
      <span class="check-label">${item.text}</span>
    </div>`).join('')}</div>`;
}

function completarPorHacer(id){
  const item=document.querySelector(`[onclick="completarPorHacer('${id}')"]`);
  if(item){
    const box=item.querySelector('.check-box');
    const label=item.querySelector('.check-label');
    box.classList.add('checked');
    label.classList.add('done');
    setTimeout(()=>{
      DB.remove(`refugio2/porhacer/${id}`);
    }, 400);
  }
}

function openPorHacerSheet(){
  document.getElementById('porhacer-text').value='';
  document.getElementById('porhacer-sheet').classList.add('open');
  setTimeout(()=>document.getElementById('porhacer-text').focus(), 300);
}
function closePorHacerSheet(){document.getElementById('porhacer-sheet').classList.remove('open');}
function savePorHacer(){
  const text=document.getElementById('porhacer-text').value.trim();
  if(!text){showToast('Escribe algo');return;}
  const id=Date.now().toString();
  DB.set(`refugio2/porhacer/${id}`,{id,text,ts:Date.now()}).then(()=>{
    closePorHacerSheet();
  });
}

function togglePasoCheck(tareaId, pasoId, currentDone){
  const t = state.tareas[tareaId]; if(!t) return;
  const newDone = !currentDone;
  const newEstado = newDone ? 'terminada' : 'en_espera';

  DB.update(`refugio2/tareas/${tareaId}/pasos/${pasoId}`, {done: newDone, estado: newEstado});

  const pasosActuales = t.pasos ? Object.values(t.pasos) : [];
  const pasosActualizados = pasosActuales.map(p =>
    p.id === pasoId ? {...p, done: newDone, estado: newEstado} : p
  );
  const restantes = pasosActualizados.filter(p => !p.done && p.estado !== 'terminada');

  if(restantes.length === 0 && newDone){
    setTareaStatus(tareaId, 'terminada');
    showToast('¡Todos los pasos completados! 🎉', 3000);
  } else {
    const nextPending = restantes[0];
    const nextEstado = nextPending ? (nextPending.estado || 'en_espera') : 'en_espera';
    setTareaStatus(tareaId, nextEstado);
    if(newDone) showToast(`✓ · Siguiente: ${nextPending?.text||''}`);
    else showToast('Paso desmarcado → En espera');
  }
}

// (toggleTareaHoy y openSelectorHoy eliminados — funcionalidad muerta, ningún botón los llamaba)

let miniCalSelected = todayKey();

function renderMiniCal(){
  const container = document.getElementById('hoy-mini-cal'); if(!container) return;
  const now = new Date();
  const y = now.getFullYear(), m = now.getMonth();
  const today = todayKey();
  const monthName = now.toLocaleDateString('es-ES',{month:'long',year:'numeric'});
  const firstDay = (new Date(y,m,1).getDay()+6)%7;
  const days = new Date(y,m+1,0).getDate();
  const tareasByDate = getTareasByDate();

  let grid = ['L','M','X','J','V','S','D'].map(d=>`<div class="mini-cal-day-label">${d}</div>`).join('');
  for(let i=0;i<firstDay;i++) grid+=`<div class="mini-cal-day empty"></div>`;
  for(let d=1;d<=days;d++){
    const key=`${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const isToday=key===today;
    const isSel=key===miniCalSelected;
    const hasTareas=(tareasByDate[key]||[]).length>0;
    grid+=`<div class="mini-cal-day ${isToday?'today':''} ${isSel&&!isToday?'selected':''} ${hasTareas?'has-events':''}"
      onclick="selectMiniCalDay('${key}')">${d}</div>`;
  }

  const selTareas = tareasByDate[miniCalSelected]||[];
  const selDate = new Date(miniCalSelected+'T12:00:00').toLocaleDateString('es-ES',{weekday:'long',day:'numeric',month:'long'});
  const priColor={alta:'var(--red)',media:'var(--lav)',baja:'var(--green)'};

  container.innerHTML=`
    <div class="mini-cal">
      <div class="mini-cal-header">
        <div class="mini-cal-title">${monthName.charAt(0).toUpperCase()+monthName.slice(1)}</div>
      </div>
      <div class="mini-cal-grid">${grid}</div>
      <div style="margin-top:12px;border-top:1px solid var(--border);padding-top:10px;">
        <div style="font-size:11px;font-weight:700;color:var(--text-muted);margin-bottom:8px;">${selDate.toUpperCase()}</div>
        ${selTareas.length ? selTareas.map(t=>`
          <div style="display:flex;gap:8px;align-items:flex-start;margin-bottom:8px;cursor:pointer;" onclick="openTareaSheet(state.tareas['${t.id}'])">
            <span style="font-size:12px;flex-shrink:0;">${t.priority==='alta'?'🔴':t.priority==='media'?'🟡':'🟢'}</span>
            <span style="font-size:12px;font-weight:500;color:var(--text);line-height:1.4;">${t.name}</span>
          </div>`).join('')
        : `<div style="font-size:12px;color:var(--text-muted);">Sin tareas este día</div>`}
      </div>
    </div>`;
}

function selectMiniCalDay(key){
  miniCalSelected = key;
  renderMiniCal();
}

function renderHoy(){
  const area=document.getElementById('hoy-area'); if(!area) return;
  const today=todayKey();
  const allTareas=Object.values(state.tareas);
  const priIcon={alta:'🔴',media:'🟡',baja:'🟢'};
  const checkSvg=`<svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M1.5 5.5L4 8L9.5 2.5" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

  // Tareas HOY — solo las que su estado efectivo es en_curso
  const hoyTareas = allTareas.filter(t => {
    const estado = getEstadoEfectivo(t);
    if(estado === 'terminada') return t.completedAt === today;
    if(estado === 'en_espera') return false;
    return estado === 'en_curso';
  });
  const hoyTerminadas = hoyTareas.filter(t=>getEstadoEfectivo(t)==='terminada');
  const hoyPendientes = getSortedTareas(getTareaColItems('en_curso')); // MISMO orden que el tablero de Tareas
  const pct = hoyTareas.length ? Math.round((hoyTerminadas.length/hoyTareas.length)*100) : 0;

  // Vencidas
  const overdue = allTareas.filter(t=>getEstadoEfectivo(t)!=='terminada'&&t.date&&t.date<today&&getEstadoEfectivo(t)!=='en_espera');

  // En espera: tareas cuyo estado efectivo es en_espera — MISMO orden que el tablero de Tareas (campo order)
  const enEsperaItems = getSortedTareas(getTareaColItems('en_espera')).map(t=>({tipo:'tarea', tarea:t}));

  area.innerHTML=`
    ${hoyPendientes.length?`
    <div class="hoy-section">
      <div class="hoy-section-title">🔄 En curso</div>
      ${hoyPendientes.map((t,i,arr)=>{
        const pasos = t.pasos ? Object.values(t.pasos) : [];
        const nextPaso = pasos.find(p=>!p.done && p.estado!=='terminada');
        const hasPasos = pasos.length > 0;
        const ordBtns = `<div onclick="event.stopPropagation()" style="display:flex;gap:6px;flex-shrink:0;padding-left:8px;margin-left:auto;border-left:1px solid var(--border);">
          <button class="order-circle-btn" onclick="event.stopPropagation();moveTarea('${t.id}','up')" ${i>0?'':'disabled'}>▲</button>
          <button class="order-circle-btn" onclick="event.stopPropagation();moveTarea('${t.id}','down')" ${i<arr.length-1?'':'disabled'}>▼</button>
        </div>`;
        return `<div class="hoy-task" style="flex-direction:column;align-items:stretch;">
          <div style="display:flex;align-items:center;gap:10px;">
            ${!hasPasos?`<div class="check-box" onclick="event.stopPropagation();setTareaStatus('${t.id}','terminada')">${checkSvg}</div>`:'<span style="font-size:16px;flex-shrink:0;">🔄</span>'}
            <span style="flex:1;min-width:0;font-size:14px;font-weight:600;cursor:pointer;" onclick="openTareaSheet(state.tareas['${t.id}'])">${t.name}</span>
            <div style="display:flex;gap:3px;flex-shrink:0;" onclick="event.stopPropagation()">
              <button onclick="setTareaStatus('${t.id}','en_espera')" style="padding:2px 5px;border-radius:5px;border:1px solid var(--border);background:transparent;font-size:11px;cursor:pointer;">⏳</button>
              <button onclick="setTareaStatus('${t.id}','terminada')" style="padding:2px 5px;border-radius:5px;border:1px solid var(--green);background:var(--green-light);font-size:11px;cursor:pointer;">✅</button>
            </div>
            ${ordBtns}
          </div>
          ${hasPasos && nextPaso?`
          <div style="margin-top:8px;padding-left:26px;">
            <div style="font-size:12px;color:var(--lav);font-weight:600;margin-bottom:4px;">🔄 En curso:</div>
            <div style="display:flex;align-items:center;gap:8px;cursor:pointer;padding:4px 0;" onclick="togglePasoCheck('${t.id}','${nextPaso.id}',${!!nextPaso.done})">
              <div class="check-box" style="width:16px;height:16px;border-radius:4px;flex-shrink:0;">${checkSvg}</div>
              <span style="font-size:13px;color:var(--text);">${nextPaso.text}</span>
              ${nextPaso.date?`<span style="font-size:11px;color:var(--text-muted);margin-left:auto;">📅 ${nextPaso.date}</span>`:''}
            </div>
          </div>`:''}
        </div>`;
      }).join('')}
    </div>`:''}

    ${overdue.length?`
    <div class="hoy-section">
      <div class="hoy-section-title">⏰ Vencidas</div>
      ${overdue.map(t=>`
        <div class="hoy-task overdue" onclick="openTareaSheet(state.tareas['${t.id}'])">
          <div class="check-box" onclick="event.stopPropagation();completarTarea('${t.id}')">${checkSvg}</div>
          <span style="flex:1;font-size:14px;font-weight:500;">${t.name}</span>
          <span style="font-size:11px;color:var(--red);">📅 ${t.date}</span>
          <div style="display:flex;gap:3px;flex-shrink:0;" onclick="event.stopPropagation()">
            <button onclick="setTareaStatus('${t.id}','en_espera')" style="padding:2px 5px;border-radius:5px;border:1px solid var(--border);background:transparent;font-size:11px;cursor:pointer;">⏳</button>
            <button onclick="setTareaStatus('${t.id}','en_curso')" style="padding:2px 5px;border-radius:5px;border:1px solid var(--lav);background:var(--lav-light);font-size:11px;cursor:pointer;">🔄</button>
            <button onclick="setTareaStatus('${t.id}','terminada')" style="padding:2px 5px;border-radius:5px;border:1px solid var(--green);background:var(--green-light);font-size:11px;cursor:pointer;">✅</button>
          </div>
        </div>`).join('')}
    </div>`:''}

    ${enEsperaItems.length?`
    <div class="hoy-section">
      <div class="hoy-section-title">⏳ En espera</div>
      ${enEsperaItems.map((item,i)=>renderTareaCard(item.tarea,{idx:i,colLen:enEsperaItems.length,section:'espera'})).join('')}
    </div>`:''}

    ${!hoyPendientes.length&&!overdue.length&&!enEsperaItems.length?`
    <div class="empty-state"><div class="empty-icon">✨</div><p>Todo al día.<br>Sin tareas pendientes.</p></div>`:''}

    <div class="hoy-section" style="margin-top:16px;">
      <div class="hoy-progress">
        <div style="font-size:14px;font-weight:600;">✓ ${hoyTerminadas.length} de ${hoyTareas.length} en curso completadas</div>
        <div class="hoy-prog-bar"><div class="hoy-prog-fill" style="width:${pct}%;"></div></div>
        <div style="font-size:13px;font-weight:700;color:var(--lav);">${pct}%</div>
      </div>
      ${hoyTerminadas.length?`<div style="margin-top:10px;">${hoyTerminadas.map(t=>`
        <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border);opacity:0.6;">
          <div class="check-box checked">${checkSvg}</div>
          <span style="flex:1;font-size:13px;text-decoration:line-through;color:var(--text-muted);">${t.name}</span>
        </div>`).join('')}</div>`:''}
    </div>
  `;

  renderMiniCal();
}

// Función unificada para marcar/desmarcar un paso

function completarTarea(id){
  DB.update(`refugio2/tareas/${id}`,{status:'terminada', completedAt: todayKey()});
  showToast('¡Tarea completada! 🎉');
}

// ── TAREAS ──

// ── Componente compartido: tarjeta de tarea ──────────────
function renderTareaCard(t, opts={}) {
  const today = todayKey();
  const isOverdue = t.date && t.date < today && t.status !== 'terminada';
  let pasos = [];
  try { pasos = t.pasos ? Object.values(t.pasos).sort((a,b)=>(a.order||0)-(b.order||0)) : []; }
  catch(e) { console.error('pasos corruptos en tarea', t.id, e); pasos = []; }
  const pasosDone = pasos.filter(p=>p.done).length;
  const nextPaso = pasos.find(p=>!p.done && p.estado !== 'terminada');
  const priIcon = {alta:'🔴', media:'🟡', baja:'🟢'};
  const checkSvg = `<svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M1.5 5.5L4 8L9.5 2.5" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

  const statusBtns = `<div style="display:flex;gap:3px;flex-shrink:0;" onclick="event.stopPropagation()">
    <button onclick="setTareaStatus('${t.id}','en_espera')" title="En espera"
      style="padding:2px 5px;border-radius:5px;border:1px solid ${t.status==='en_espera'?'var(--lav)':'var(--border)'};background:${t.status==='en_espera'?'var(--lav-light)':'transparent'};font-size:11px;cursor:pointer;">⏳</button>
    <button onclick="setTareaStatus('${t.id}','en_curso')" title="En curso"
      style="padding:2px 5px;border-radius:5px;border:1px solid ${t.status==='en_curso'?'var(--lav)':'var(--border)'};background:${t.status==='en_curso'?'var(--lav-light)':'transparent'};font-size:11px;cursor:pointer;">🔄</button>
    <button onclick="setTareaStatus('${t.id}','terminada')" title="Terminada"
      style="padding:2px 5px;border-radius:5px;border:1px solid ${t.status==='terminada'?'var(--green)':'var(--border)'};background:${t.status==='terminada'?'var(--green-light)':'transparent'};font-size:11px;cursor:pointer;">✅</button>
  </div>`;

  const orderBtns = opts.idx !== undefined ? `<div
    onclick="event.stopPropagation()"
    style="display:flex;gap:6px;flex-shrink:0;padding-left:8px;margin-left:auto;border-left:1px solid var(--border);">
    <button class="order-circle-btn" onclick="event.stopPropagation();moveTarea('${t.id}','up')" ${opts.idx>0?'':'disabled'}>▲</button>
    <button class="order-circle-btn" onclick="event.stopPropagation();moveTarea('${t.id}','down')" ${opts.idx<(opts.colLen||0)-1?'':'disabled'}>▼</button>
  </div>` : '';

  return `<div id="kcard-${t.id}" class="hoy-task${isOverdue?' overdue':''}"
    style="flex-direction:column;align-items:stretch;margin-bottom:8px;${t.status==='terminada'?'opacity:0.6;':''}cursor:pointer;">

    <div style="display:flex;align-items:center;gap:10px;" onclick="openTareaSheet(state.tareas['${t.id}'])">
      <div class="check-box ${t.status==='terminada'?'checked':''}" style="flex-shrink:0;"
        onclick="event.stopPropagation();completarTareaOPaso('${t.id}')">
        ${checkSvg}
      </div>
      <span style="flex:1;min-width:0;font-size:14px;font-weight:600;${t.status==='terminada'?'text-decoration:line-through;color:var(--text-muted)':''}">${priIcon[t.priority]||''} ${t.name}</span>
      ${statusBtns}
      ${orderBtns}
    </div>

    ${(t.date || t.cat) ? `<div style="display:flex;gap:8px;margin-top:4px;padding-left:30px;flex-wrap:wrap;" onclick="openTareaSheet(state.tareas['${t.id}'])">
      ${t.date ? `<span style="font-size:11px;color:${isOverdue?'var(--red)':'var(--text-muted)'};">${isOverdue?'⚠️':'📅'} ${t.date}</span>` : ''}
      ${t.cat && getCatName(t.cat) ? `<span style="font-size:11px;color:var(--text-muted);">${getCatName(t.cat)}</span>` : ''}
      ${pasos.length ? `<span style="font-size:11px;color:var(--text-muted);">📋 ${pasosDone}/${pasos.length}</span>` : ''}
    </div>` : ''}

    ${t.notes && !pasos.length ? `<div style="font-size:12px;color:var(--text-muted);margin-top:4px;padding-left:30px;" onclick="openTareaSheet(state.tareas['${t.id}'])">${t.notes.slice(0,80)}${t.notes.length>80?'...':''}</div>` : ''}

    ${pasos.length ? `<div style="margin-top:8px;padding-left:30px;border-top:1px solid var(--border);padding-top:8px;">
      ${pasos.map(p=>`<div style="display:flex;align-items:center;gap:8px;padding:3px 0;cursor:pointer;"
        onclick="event.stopPropagation();togglePasoCheck('${t.id}','${p.id}',${!!p.done})">
        <div class="check-box ${p.done?'checked':''}" style="width:14px;height:14px;border-radius:3px;flex-shrink:0;">
          <svg width="8" height="8" viewBox="0 0 11 11" fill="none"><path d="M1.5 5.5L4 8L9.5 2.5" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </div>
        <span style="font-size:12px;${p.done?'text-decoration:line-through;color:var(--text-muted)':''};">${p.text}</span>
        ${p.date?`<span style="font-size:10px;color:var(--text-muted);margin-left:auto;">📅 ${p.date}</span>`:''}
      </div>`).join('')}
    </div>` : ''}

    ${nextPaso && t.status==='en_espera' ? `<div style="margin-top:6px;padding-left:30px;">
      <div style="font-size:12px;color:var(--lav);font-weight:600;">→ ${nextPaso.text}</div>
    </div>` : ''}
  </div>`;
}

function renderTareas(){
  const board=document.getElementById('kanban-board'); if(!board) return;

  const cols = [
    { key:'espera', label:'⏳ En espera', items: getTareaColItems('en_espera') },
    { key:'curso', label:'🔄 En curso',  items: getTareaColItems('en_curso') },
    { key:'done', label:'✅ Terminadas', items: getTareaColItems('terminada') },
  ];

  board.innerHTML = `<div class="kanban-board">${cols.map(col=>`
    <div class="kanban-col">
      <div class="kanban-col-title kanban-col-title-${col.key}">
        <span>${col.label}</span>
        <span class="kanban-col-count">${col.items.length}</span>
      </div>
      ${col.items.length
        ? getSortedTareas(col.items).map((t,i,arr)=>{
            try { return renderTareaCard(t,{idx:i,colLen:arr.length}); }
            catch(e) { console.error('Error pintando tarea', t.id, e); return `<div style="font-size:12px;color:var(--red);padding:8px;">⚠️ Error al mostrar "${(t.name||'tarea').slice(0,30)}"</div>`; }
          }).join('')
        : `<div style="font-size:13px;color:var(--text-muted);text-align:center;padding:20px 0;">Sin tareas</div>`}
    </div>`).join('')}
  </div>`;
}

// ── PASOS (editor dentro de la ficha de tarea) ──
function togglePasos(){
  const tipo=document.getElementById('tarea-tipo').value;
  const cont=document.getElementById('pasos-container');
  if(cont) cont.style.display = tipo==='pasos' ? 'block' : 'none';
}

function renderPasosList(){
  const c=document.getElementById('pasos-list'); if(!c) return;
  c.innerHTML=editingPasos.map((p,i)=>`
    <div class="item-row">
      <div style="display:flex;gap:4px;flex-shrink:0;">
        <button type="button" class="order-circle-btn" style="width:22px;height:22px;font-size:9px;" onclick="movePasoEdit(${i},'up')" ${i>0?'':'disabled'}>▲</button>
        <button type="button" class="order-circle-btn" style="width:22px;height:22px;font-size:9px;" onclick="movePasoEdit(${i},'down')" ${i<editingPasos.length-1?'':'disabled'}>▼</button>
      </div>
      <input class="input-field" value="${p.text||''}" placeholder="Ej: Llamar al proveedor" oninput="editingPasos[${i}].text=this.value">
      <input class="input-field" type="date" value="${p.date||''}" style="max-width:130px;flex:none;" oninput="editingPasos[${i}].date=this.value">
      <button class="remove-btn" onclick="editingPasos.splice(${i},1);renderPasosList()">×</button>
    </div>`).join('');
}

function movePasoEdit(idx,dir){
  const swapIdx = dir==='up' ? idx-1 : idx+1;
  if(swapIdx<0||swapIdx>=editingPasos.length) return;
  [editingPasos[idx],editingPasos[swapIdx]] = [editingPasos[swapIdx],editingPasos[idx]];
  renderPasosList();
}

function addPaso(){
  editingPasos.push({id:Date.now().toString()+Math.random().toString(36).slice(2,6),text:'',date:'',estado:'en_espera',done:false});
  renderPasosList();
  const rows=document.querySelectorAll('#pasos-list .item-row');
  rows[rows.length-1]?.querySelector('.input-field')?.focus();
}

function openTareaSheet(t,presetDate){
  const isNew=!t;
  document.getElementById('tarea-id').value=t?.id||'';
  document.getElementById('tarea-name').value=t?.name||'';
  document.getElementById('tarea-priority').value=t?.priority||'media';
  const hasPasosEdit = !!(t?.pasos && Object.keys(t.pasos).length > 0);
  const statusEl = document.getElementById('tarea-status');
  if(statusEl) {
    const estadoEfec = hasPasosEdit ? getEstadoEfectivo(t) : (t?.status||'en_espera');
    statusEl.value = estadoEfec;
    statusEl.disabled = hasPasosEdit;
    statusEl.style.opacity = hasPasosEdit ? '0.6' : '1';
    statusEl.title = hasPasosEdit ? 'Se hereda del paso activo' : '';
  }
  document.getElementById('tarea-date').value=t?.date||(isNew&&presetDate?presetDate:'');
  document.getElementById('tarea-notes').value=t?.notes||'';
  // hoy is auto-managed by status
  document.getElementById('tarea-sheet-title').textContent=isNew?'Nueva tarea':'Editar tarea';
  document.getElementById('tarea-delete-btn').style.display=isNew?'none':'block';
  // Pasos
  const tienePasos = !!(t?.pasos && Object.keys(t.pasos).length);
  document.getElementById('tarea-tipo').value = tienePasos ? 'pasos' : 'simple';
  editingPasos = tienePasos ? Object.values(t.pasos).map(p=>({...p})) : [];
  renderPasosList();
  togglePasos();
  populateTareaCatSelect();
  if(t?.cat) document.getElementById('tarea-cat').value=t.cat;
  document.getElementById('tarea-sheet').classList.add('open');
}
function closeTareaSheet(){document.getElementById('tarea-sheet').classList.remove('open');}
function saveTarea(){
  const name=document.getElementById('tarea-name').value.trim();
  if(!name){showToast('Escribe el nombre');return;}
  const id=document.getElementById('tarea-id').value||Date.now().toString();
  const tipo=document.getElementById('tarea-tipo').value;
  const pasosArr = editingPasos.filter(p=>p.text.trim());
  const hasPasos = tipo==='pasos' && pasosArr.length>0;
  const pasos = hasPasos
    ? Object.fromEntries(pasosArr.map((p,i)=>[p.id,{
        id:p.id, text:p.text.trim(), date:p.date||'',
        done: p.estado==='terminada' || p.done || false,
        estado: p.estado||'en_espera',
        order: i
      }]))
    : null;
  // Para tareas con pasos: estado = estado del primer paso no terminado
  // Status: única fuente de verdad
  let statusVal;
  if(hasPasos){
    const firstPending = pasosArr.find(p=>p.estado!=='terminada'&&!p.done);
    statusVal = firstPending ? (firstPending.estado||'en_espera') : 'terminada';
  } else {
    statusVal = document.getElementById('tarea-status').value || 'en_espera';
  }
  const hoyVal = statusVal === 'en_curso';
  DB.set(`refugio2/tareas/${id}`,{
    id,name,
    priority:document.getElementById('tarea-priority').value,
    status: statusVal,
    date:document.getElementById('tarea-date').value,
    cat:document.getElementById('tarea-cat').value,
    notes:document.getElementById('tarea-notes').value.trim(),
    hoy: hoyVal,
    pasos,
    completedAt:statusVal==='terminada'?(state.tareas[id]?.completedAt||todayKey()):null,
    createdAt:state.tareas[id]?.createdAt||Date.now(),
    order: state.tareas[id]?.order !== undefined ? state.tareas[id].order : Date.now()
  }).then(()=>{closeTareaSheet();showToast('Tarea guardada ✓');});
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

function getTareasByDate(){
  const byDate={};
  Object.values(state.tareas).forEach(t=>{
    if(t.status==='terminada') return;
    if(t.date){
      if(!byDate[t.date]) byDate[t.date]=[];
      byDate[t.date].push({id:t.id,name:t.name,priority:t.priority,type:'tarea'});
    }
    if(t.pasos) Object.values(t.pasos).forEach(p=>{
      if(p.done) return;
      if(p.date){
        if(!byDate[p.date]) byDate[p.date]=[];
        byDate[p.date].push({id:t.id,name:t.name+': '+p.text,priority:t.priority,type:'paso'});
      }
    });
  });
  return byDate;
}

function renderCalMes(title,area){
  const y=calDate.getFullYear(),m=calDate.getMonth();
  if(title) title.textContent=new Date(y,m,1).toLocaleDateString('es-ES',{month:'long',year:'numeric'}).replace(/^\w/,c=>c.toUpperCase());
  const firstDay=(new Date(y,m,1).getDay()+6)%7;
  const days=new Date(y,m+1,0).getDate();
  const today=todayKey();
  const tareasByDate=getTareasByDate();
  const priColor={alta:'var(--red)',media:'var(--lav)',baja:'var(--green)'};

  let html=`<div class="cal-grid">${['L','M','X','J','V','S','D'].map(d=>`<div class="cal-day-label">${d}</div>`).join('')}`;
  for(let i=0;i<firstDay;i++) html+=`<div class="cal-day empty"></div>`;
  for(let d=1;d<=days;d++){
    const key=`${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const isToday=key===today,isSel=key===calSelected;
    const items=tareasByDate[key]||[];
    html+=`<div class="cal-day ${isToday?'today':isSel?'selected':''}" onclick="selectDay('${key}')">
      <div class="cal-day-num">${d}</div>
      ${items.slice(0,2).map(t=>`<div style="font-size:9px;font-weight:600;color:${isToday?'rgba(255,255,255,0.85)':priColor[t.priority]||'var(--lav)'};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%;line-height:1.3;margin-top:1px;">${t.name}</div>`).join('')}
      ${items.length>2?`<div style="font-size:9px;color:${isToday?'rgba(255,255,255,0.6)':'var(--text-muted)'};">+${items.length-2} más</div>`:''}
    </div>`;
  }
  html+='</div>';

  if(calSelected){
    const selItems=tareasByDate[calSelected]||[];
    const selDate=new Date(calSelected+'T12:00:00').toLocaleDateString('es-ES',{weekday:'long',day:'numeric',month:'long'});
    html+=`<div class="section-label" style="display:flex;align-items:center;justify-content:space-between;">
      <span>${selDate.replace(/^\w/,c=>c.toUpperCase())}</span>
      <button onclick="openTareaSheet(null,'${calSelected}')" style="font-size:11px;color:var(--lav);background:var(--lav-light);border:none;padding:4px 10px;border-radius:99px;cursor:pointer;font-weight:700;text-transform:none;letter-spacing:0;">+ Tarea</button>
    </div>`;
    if(selItems.length){
      html+=`<div class="cal-selected-events">${selItems.map(t=>`
        <div class="cal-event-row" onclick="openTareaSheet(state.tareas['${t.id}'])">
          <div class="cal-event-time" style="color:${priColor[t.priority]};">${t.priority==='alta'?'🔴':t.priority==='media'?'🟡':'🟢'}</div>
          <div class="cal-event-info">
            <div class="cal-event-name">${t.name}</div>
            <div class="cal-event-type">${t.type==='paso'?'Paso de tarea':'Tarea'}</div>
          </div>
        </div>`).join('')}</div>`;
    } else {
      html+=`<div style="text-align:center;padding:16px 0;color:var(--text-muted);font-size:13px;">Sin tareas este día</div>`;
    }
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
  const addBar=`<div style="display:flex;justify-content:center;margin-top:12px;">
    <button onclick="openTareaSheet(null,'${key}')" style="font-size:12px;color:var(--lav);background:var(--lav-light);border:none;padding:6px 14px;border-radius:99px;cursor:pointer;font-weight:700;">+ Tarea</button>
  </div>`;
  area.innerHTML=(evs.length
    ?`<div class="cal-selected-events">${evs.map(e=>`<div class="cal-event-row" onclick="openEventoSheet(${JSON.stringify(e).replace(/"/g,'&quot;')})"><div class="cal-event-time">${e.time||'·'}</div><div class="cal-event-info"><div class="cal-event-name">${TIPO_ICONS[e.tipo]||'📅'} ${e.name}</div>${e.notes?`<div class="cal-event-type">${e.notes}</div>`:''}</div></div>`).join('')}</div>`
    :`<div class="empty-state"><div class="empty-icon">📅</div><p>Sin eventos este día.</p></div>`)+addBar;
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

// ── CATEGORÍAS DE TAREAS ──
function getCatName(catId){
  if(!catId) return '';
  const cat = state.tareaCats[catId];
  if(cat) return `${cat.emoji||'📁'} ${cat.name}`;
  // Si no existe en las categorías actuales, no mostrar nada
  return '';
}

function getTareaCats(){
  const custom = Object.values(state.tareaCats);
  return custom.length ? custom : [];
}

function populateTareaCatSelect(){
  const sel = document.getElementById('tarea-cat'); if(!sel) return;
  const current = sel.value;
  sel.innerHTML = `<option value="">Sin categoría</option>` +
    getTareaCats().map(c=>`<option value="${c.id}" ${current===c.id?'selected':''}>${c.emoji||'📁'} ${c.name}</option>`).join('');
}

function renderTareaCatList(){
  const container = document.getElementById('tarea-cat-list'); if(!container) return;
  const cats = getTareaCats();
  if(!cats.length){container.innerHTML=`<div style="font-size:13px;color:var(--text-muted);padding:8px 0;">Sin categorías todavía.</div>`;return;}
  container.innerHTML = cats.map(c=>`
    <div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--border);">
      <span style="font-size:18px;">${c.emoji||'📁'}</span>
      <span style="flex:1;font-size:14px;font-weight:500;">${c.name}</span>
      <button onclick="deleteTareaCat('${c.id}')" style="background:none;border:none;color:var(--text-muted);font-size:18px;cursor:pointer;">×</button>
    </div>`).join('');
}

function toggleCatManager(){
  const el=document.getElementById('cat-manager');
  if(el) el.style.display=el.style.display==='none'?'block':'none';
}

function addTareaCat(){
  const name=document.getElementById('tarea-cat-new').value.trim();
  const emoji=document.getElementById('tarea-cat-emoji').value||'📁';
  if(!name){showToast('Escribe un nombre');return;}
  const id=Date.now().toString();
  DB.set(`refugio2/tareaCats/${id}`,{id,name,emoji}).then(()=>{
    document.getElementById('tarea-cat-new').value='';
    showToast('Categoría añadida ✓');
  });
}

function deleteTareaCat(id){
  if(!confirm('¿Eliminar esta categoría?'))return;
  DB.remove(`refugio2/tareaCats/${id}`);
}

// ── AJUSTES ──
function renderSettings(){ /* ajustes eliminados */ }

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
