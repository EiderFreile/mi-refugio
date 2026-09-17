// MI REFUGIO v4

const COLORS=[{id:'lav',hex:'#EDE9F8',dot:'#9B8EC4'},{id:'yellow',hex:'#FEF9C3',dot:'#CA8A04'},{id:'green',hex:'#DCFCE7',dot:'#16A34A'},{id:'pink',hex:'#FCE7F3',dot:'#DB2777'},{id:'blue',hex:'#DBEAFE',dot:'#2563EB'},{id:'peach',hex:'#FFEDD5',dot:'#EA580C'},{id:'gray',hex:'#F3F4F6',dot:'#6B7280'}];
const TIPO_ICONS={reunion:'👥',llamada:'📞',entrega:'⏰',recordatorio:'📌',otro:'🏢'};
const DAY_TABS=[{id:'casa',ico:'🏡',lbl:'Casa',col:'green'},{id:'otras',ico:'🎈',lbl:'Planes',col:'pink'},{id:'dump',ico:'🧠',lbl:'Brain dump',col:'teal'}];
const WORK_TABS=[{id:'mensual',ico:'🗓️',lbl:'Mensual',col:'lav'},{id:'semanal',ico:'📆',lbl:'Semanal',col:'pink'},{id:'diario',ico:'🕐',lbl:'Diario',col:'teal'},{id:'wetlease',ico:'✈️',lbl:'Wet Lease',col:'blue'},{id:'formaciones',ico:'🎓',lbl:'MSM',col:'peach'}];

let state={
  mode:localStorage.getItem('mode')||'day', tab:'inicio',
  darkMode:localStorage.getItem('darkMode')==='true',
  checklists:{}, progress:{}, weekProgress:{}, noneProgress:{},
  notes:{}, gastos:{}, gastosWeek:{}, categorias:{},
  budget:parseFloat(localStorage.getItem('budget')||'0'),
  tareas:{}, eventos:{}, tareaCats:{}, porhacer:{}, wlIn:{}, wlOut:{}, wlInTemplate:{departamentos:{}, docs:{}}, formaciones:{}, mensualTareas:{}, semanaNotas:{},
  casaTareas:{}, casaHecho:{},
  otrasTareas:{}, otrasAnimo:{},
  brainDump:{},
};

let clColor=COLORS[0].id, noteColor=COLORS[1].id, clItems=[], editingPasos=[];
let calView='mes', calDate=new Date(), calSelected=todayKey();
let tareaFilter='todas';
let wlTab='in';
let editingWLDeps=[], editingWLDocs=[];
let mensualMonthsCount=1, mensualBaseDate=new Date();
let semanalMonthsCount=1, semanalBaseDate=new Date();
let diaVistaSelected=todayKey(), diarioCalMonth=new Date();
let editingSubtareas=[];
let casaBaseDate=new Date();
let editingSemanasActivas={1:true,2:true,3:true,4:true,5:true};
let otrasCalMonth=new Date(), otrasDiaSel=todayKey();
const MOOD_OPTIONS=[
  {emoji:'😊',label:'Feliz',color:'var(--green)'},
  {emoji:'😌',label:'Tranquila',color:'var(--teal)'},
  {emoji:'😐',label:'Normal',color:'var(--gray)'},
  {emoji:'😣',label:'Agobiada',color:'var(--peach)'},
  {emoji:'😔',label:'Triste',color:'var(--blue)'},
  {emoji:'😡',label:'Enfadada',color:'var(--red)'},
  {emoji:'🥳',label:'Ilusionada',color:'var(--pink)'},
];

// ── Init ──
document.addEventListener('DOMContentLoaded',()=>{
  // Nav positioned via CSS

  if(state.darkMode) document.body.classList.add('dark');
  document.getElementById('pill-day').addEventListener('click',()=>setMode('day'));
  document.getElementById('pill-work').addEventListener('click',()=>setMode('work'));
  initListeners();
  renderSettings();
  if('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(()=>{});
  if(typeof Notification!=='undefined'&&Notification.permission==='granted') startNotifCheck();
  document.addEventListener('visibilitychange',()=>{ if(document.visibilityState==='visible')checkAndSendNotif();});
  if(state.mode==='work'){
    document.getElementById('pill-day').classList.remove('active');
    document.getElementById('pill-work').classList.add('active');
    state.tab='diario'; renderNav(); navigateTo('diario');
  } else { renderNav(); navigateTo('casa'); }
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

// Devuelve un valor de `order` que coloca un elemento nuevo ARRIBA del todo de su columna
function minOrderInStatus(estado){
  const items = getSortedTareas(getTareaColItems(estado));
  if(!items.length) return 0;
  const primero = items[0];
  const primerOrder = primero.order!==undefined ? primero.order : (primero.createdAt||0);
  return primerOrder - 10;
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
  DB.listen('refugio2/progress/none',d=>{state.noneProgress=d||{};renderChecklistsHome();});
  DB.listen('refugio2/notes',d=>{state.notes=d||{};renderNotes();renderNotesHome();});
  DB.listen('refugio2/categorias',d=>{state.categorias=d||{};});
  DB.listen(`refugio2/gastos/${t}`,d=>{state.gastos=d||{};renderGastos();renderGastosHome();});
  DB.listen('refugio2/gastos',d=>{state.gastosWeek=d||{};renderGastos();});
  DB.listen('refugio2/tareas',d=>{state.tareas=d||{};renderTareas();renderHoy();limpiarTareasTerminadasViejas();});
  DB.listen('refugio2/porhacer',d=>{state.porhacer=d||{};renderPorHacer();renderPorHacerHome();});
  DB.listen('refugio2/tareaCats',d=>{state.tareaCats=d||{};renderTareaCatList();populateTareaCatSelect();});
  DB.listen('refugio2/eventos',d=>{state.eventos=d||{};renderCalendar();renderHoy();renderMiniCal();});
  DB.listen('refugio2/wlIn',d=>{state.wlIn=d||{};if(state.tab==='wetlease')renderWL();});
  DB.listen('refugio2/wlOut',d=>{state.wlOut=d||{};if(state.tab==='wetlease')renderWL();});
  DB.listen('refugio2/wlInTemplate',d=>{state.wlInTemplate=d||{departamentos:{}, docs:{}};});
  DB.listen('refugio2/formaciones',d=>{state.formaciones=d||{};renderFormaciones();renderMiniCal();});
  DB.listen('refugio2/mensualTareas',d=>{state.mensualTareas=d||{};if(state.tab==='mensual')renderMensual();if(state.tab==='semanal')renderSemanal();if(state.tab==='diario')renderDiario();});
  DB.listen('refugio2/semanaNotas',d=>{state.semanaNotas=d||{};if(state.tab==='semanal')renderSemanal();});
  DB.listen('refugio2/casaTareas',d=>{state.casaTareas=d||{};if(state.tab==='casa')renderCasa();});
  DB.listen('refugio2/casaHecho',d=>{state.casaHecho=d||{};if(state.tab==='casa')renderCasa();});
  DB.listen('refugio2/otrasTareas',d=>{state.otrasTareas=d||{};if(state.tab==='otras')renderOtras();});
  DB.listen('refugio2/otrasAnimo',d=>{state.otrasAnimo=d||{};if(state.tab==='otras')renderOtras();});
  DB.listen('refugio2/brainDump',d=>{state.brainDump=d||{};if(state.tab==='dump')renderDump();});
}

// ── Mode ──
function setMode(mode){
  state.mode=mode;
  localStorage.setItem('mode',mode);
  document.getElementById('pill-day').classList.toggle('active',mode==='day');
  document.getElementById('pill-work').classList.toggle('active',mode==='work');
  const first=mode==='day'?'casa':'diario';
  state.tab=first; renderNav(); navigateTo(first);
}

// ── Nav ──
function renderNav(){
  const tabs=state.mode==='day'?DAY_TABS:WORK_TABS;
  document.getElementById('bottom-nav').innerHTML=tabs.map(t=>{
    const isActive=state.tab===t.id;
    const c=t.col||'lav';
    return `
    <button class="nav-btn ${isActive?'active':''}" style="${isActive?`background:var(--${c}-light)!important;`:''}" onclick="navigateTo('${t.id}')">
      <div class="nav-icon" style="${isActive?`background:var(--${c}-light)!important;color:var(--${c})!important;`:''}">${t.ico}</div>
      <div class="nav-label" style="${isActive?`color:var(--${c})!important;`:''}">${t.lbl}</div>
    </button>`;
  }).join('');
}

function navigateTo(tab){
  state.tab=tab;
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  document.getElementById('screen-'+tab)?.classList.add('active');
  renderNav();
  if(tab==='wetlease') renderWL();
  if(tab==='formaciones') renderFormaciones();
  if(tab==='mensual') renderMensual();
  if(tab==='semanal') renderSemanal();
  if(tab==='diario') renderDiario();
  if(tab==='casa') renderCasa();
  if(tab==='otras') renderOtras();
  if(tab==='dump') renderDump();
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
  if(f==='daily'||f==='weekly'||f==='none') return true;
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
    const isNone=cl.frecuencia==='none';
    const prog=isNone?(state.noneProgress?.[cl.id]||{}):isW?(state.weekProgress?.[cl.id]||{}):(state.progress?.[cl.id]||{});
    const done=items.filter(it=>prog[it.id]).length;
    const dot=COLORS.find(c=>c.id===cl.color)?.dot||'#9B8EC4';
    const tag=isW?`<span style="font-size:10px;background:var(--lav-light);color:var(--lav);padding:2px 7px;border-radius:99px;font-weight:700;margin-left:6px;">Semanal</span>`:isNone?`<span style="font-size:10px;background:var(--border);color:var(--text-muted);padding:2px 7px;border-radius:99px;font-weight:700;margin-left:6px;">Sin recurrencia</span>`:'';
    return `<div class="checklist-card"><div class="cl-header" onclick="toggleCL('${cl.id}')"><div class="cl-dot" style="background:${dot};"></div><div class="cl-info"><div class="cl-name">${cl.name}${tag}</div><div class="cl-meta">${done}/${items.length} completados</div></div><div>${ring(done,items.length)}</div></div><div class="cl-items ${openIds.has(cl.id)?'open':''}" id="cli-${cl.id}">${items.map(it=>{const checked=!!prog[it.id];return`<div class="check-item" onclick="event.stopPropagation();toggleItem('${cl.id}','${it.id}','${cl.frecuencia}')"><div class="check-box ${checked?'checked':''}"><svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M1.5 5.5L4 8L9.5 2.5" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></div><span class="check-label ${checked?'done':''}">${it.text}</span></div>`;}).join('')}</div></div>`;
  }).join('');
}

function toggleCL(id){document.getElementById('cli-'+id)?.classList.toggle('open');}
function toggleItem(clId,itemId,frecuencia){
  const isW=frecuencia==='weekly';
  const isNone=frecuencia==='none';
  const key=isNone?'none':isW?`week_${weekKey()}`:todayKey();
  const prog=isNone?(state.noneProgress?.[clId]||{}):isW?(state.weekProgress?.[clId]||{}):(state.progress?.[clId]||{});
  DB.update(`refugio2/progress/${key}/${clId}`,{[itemId]:!prog[itemId]});
}

function renderChecklistsList(){
  const container=document.getElementById('checklists-list'); if(!container) return;
  const all=Object.values(state.checklists);
  if(!all.length){container.innerHTML=`<div class="empty-state"><div class="empty-icon">📋</div><p>Sin listas.<br>Pulsa + para crear una.</p></div>`;return;}
  const fl=f=>f==='daily'?'Diaria':f==='weekly'?'Semanal':f==='none'?'Sin recurrencia':`Cada ${f} días`;
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
  const formacionesProximas = getFormacionesProximas();

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
      ${formacionesProximas.length?`<div style="margin-top:12px;border-top:1px solid var(--border);padding-top:10px;">
        <div style="font-size:11px;font-weight:700;color:var(--text-muted);margin-bottom:8px;">🎓 MSM CADUCA PRONTO</div>
        ${formacionesProximas.map(p=>`
          <div style="display:flex;gap:8px;align-items:flex-start;margin-bottom:8px;cursor:pointer;" onclick="openFormacionSheet('${p.id}')">
            <span style="font-size:12px;flex-shrink:0;">🎓</span>
            <span style="font-size:12px;font-weight:500;color:var(--text);line-height:1.4;">${p.name} <span style="color:var(--text-muted);">— ${p.caducidad}</span></span>
          </div>`).join('')}
      </div>`:''}
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
            <span style="flex:1;min-width:0;font-size:14px;font-weight:600;cursor:pointer;" onclick="openTareaSheet(state.tareas['${t.id}'])">${priIcon[t.priority]||''} ${t.name}</span>
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
          <span style="flex:1;font-size:14px;font-weight:500;">${priIcon[t.priority]||''} ${t.name}</span>
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
    ${t.status==='terminada' ? `<button class="order-circle-btn" title="Eliminar" style="color:var(--red);border-color:var(--red);" onclick="event.stopPropagation();deleteTareaDirect('${t.id}')">🗑</button>` : ''}
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
    order: state.tareas[id]?.order !== undefined ? state.tareas[id].order : minOrderInStatus(statusVal)
  }).then(()=>{closeTareaSheet();showToast('Tarea guardada ✓');});
}
function deleteTarea(){const id=document.getElementById('tarea-id').value;if(!id||!confirm('¿Eliminar?'))return;DB.remove(`refugio2/tareas/${id}`).then(()=>{closeTareaSheet();showToast('Eliminada');});}

// Borra automáticamente las tareas terminadas hace más de 7 días
function limpiarTareasTerminadasViejas(){
  const limite = new Date();
  limite.setDate(limite.getDate()-7);
  const limiteKey = limite.toISOString().slice(0,10);
  Object.values(state.tareas).forEach(t=>{
    if(t.status==='terminada' && t.completedAt && t.completedAt < limiteKey){
      DB.remove(`refugio2/tareas/${t.id}`).catch(e=>console.error('limpieza automática de tareas', e));
    }
  });
}

// Borrado directo desde la tarjeta (botón 🗑 en tareas terminadas), sin pasar por la ficha
function deleteTareaDirect(id){
  const t = state.tareas[id]; if(!t) return;
  if(!confirm(`¿Eliminar "${t.name}"?`)) return;
  delete state.tareas[id];
  renderTareas(); renderHoy();
  DB.remove(`refugio2/tareas/${id}`).then(()=>showToast('Eliminada')).catch(e=>{showToast('No se pudo eliminar'); console.error(e);});
}

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

// Formatea una fecha en clave YYYY-MM-DD usando el día LOCAL (evita el desfase de toISOString, que usa UTC)
function localKey(d){
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
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
  const tareasByDate=getTareasByDate();
  const priIcon={alta:'🔴',media:'🟡',baja:'🟢'};
  area.innerHTML=`<div class="week-row">${days.map((d,i)=>{
    const key=localKey(d);
    const evs=eventosDelDia(key);
    const tareasDia=tareasByDate[key]||[];
    const isToday=key===today;
    return`<div class="week-day-col">
      <div class="week-day-header ${isToday?'today':''}">${dayLabels[i]}<br><span style="font-size:13px;font-weight:700;">${d.getDate()}</span></div>
      ${evs.map(e=>`<div class="week-event" onclick="openEventoSheet(${JSON.stringify(e).replace(/"/g,'&quot;')})">
        <div class="week-event-time">${e.time||'·'}</div>
        <div class="week-event-name">${e.name}</div>
      </div>`).join('')}
      ${tareasDia.map(t=>`<div class="week-event" onclick="openTareaSheet(state.tareas['${t.id}'])">
        <div class="week-event-time">${priIcon[t.priority]||'🔔'}</div>
        <div class="week-event-name">${t.name}</div>
      </div>`).join('')}
    </div>`;
  }).join('')}</div>`;
}

function renderCalDia(title,area){
  const key=localKey(calDate);
  const fecha=calDate.toLocaleDateString('es-ES',{weekday:'long',day:'numeric',month:'long'});
  if(title) title.textContent=fecha.replace(/^\w/,c=>c.toUpperCase());
  const evs=eventosDelDia(key);
  const tareasDia=getTareasByDate()[key]||[];
  const priIcon={alta:'🔴',media:'🟡',baja:'🟢'};
  const addBar=`<div style="display:flex;justify-content:center;margin-top:12px;">
    <button onclick="openTareaSheet(null,'${key}')" style="font-size:12px;color:var(--lav);background:var(--lav-light);border:none;padding:6px 14px;border-radius:99px;cursor:pointer;font-weight:700;">+ Tarea</button>
  </div>`;
  const evsHtml=evs.map(e=>`<div class="cal-event-row" onclick="openEventoSheet(${JSON.stringify(e).replace(/"/g,'&quot;')})"><div class="cal-event-time">${e.time||'·'}</div><div class="cal-event-info"><div class="cal-event-name">${TIPO_ICONS[e.tipo]||'📅'} ${e.name}</div>${e.notes?`<div class="cal-event-type">${e.notes}</div>`:''}</div></div>`).join('');
  const tareasHtml=tareasDia.map(t=>`<div class="cal-event-row" onclick="openTareaSheet(state.tareas['${t.id}'])"><div class="cal-event-time">${priIcon[t.priority]||'🔔'}</div><div class="cal-event-info"><div class="cal-event-name">${t.name}</div><div class="cal-event-type">${t.type==='paso'?'Paso de tarea':'Tarea'}</div></div></div>`).join('');
  area.innerHTML=((evs.length||tareasDia.length)
    ?`<div class="cal-selected-events">${evsHtml}${tareasHtml}</div>`
    :`<div class="empty-state"><div class="empty-icon">📅</div><p>Sin eventos ni tareas este día.</p></div>`)+addBar;
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

// ── WET LEASE IN / OUT ──
// Ordena por el campo `order` (lo que tú decides con las flechas) — igual que en Tareas, nunca por la fecha de caducidad
function getWLSortedOps(){
  return Object.values(state.wlIn).sort((a,b)=>{
    const ao = a.order!==undefined ? a.order : (a.createdAt||0);
    const bo = b.order!==undefined ? b.order : (b.createdAt||0);
    return ao-bo;
  });
}

// Devuelve un valor de `order` que coloca un operador nuevo ARRIBA del todo de la lista
function minOrderWL(){
  const ops = getWLSortedOps();
  if(!ops.length) return 0;
  const primero = ops[0];
  const primerOrder = primero.order!==undefined ? primero.order : (primero.createdAt||0);
  return primerOrder - 10;
}

function moveWLOperador(id, dir){
  const list = getWLSortedOps();
  // Normaliza SIEMPRE a valores únicos y crecientes, igual que en Tareas
  list.forEach((item,i)=>{
    const clean=i*10;
    if(item.order!==clean){
      item.order=clean;
      DB.update(`refugio2/wlIn/${item.id}`, {order:clean}).catch(e=>console.error('normalizando orden wl', e));
    }
  });
  const idx=list.findIndex(x=>x.id===id);
  if(idx===-1) return;
  const swapIdx = dir==='up' ? idx-1 : idx+1;
  if(swapIdx<0||swapIdx>=list.length) return;
  const other=list[swapIdx];
  const aOrder=list[idx].order, bOrder=other.order;
  list[idx].order=bOrder; other.order=aOrder;
  renderWL();
  DB.update(`refugio2/wlIn/${id}`, {order:bOrder}).catch(e=>{showToast('No se pudo guardar el orden'); console.error(e);});
  DB.update(`refugio2/wlIn/${other.id}`, {order:aOrder}).catch(e=>{showToast('No se pudo guardar el orden'); console.error(e);});
}

function toggleWLDepAprobado(opId, depId, checked){
  const op = state.wlIn[opId]; if(!op || !op.departamentos || !op.departamentos[depId]) return;
  op.departamentos[depId].aprobado = checked;
  renderWL();
  DB.update(`refugio2/wlIn/${opId}/departamentos/${depId}`, {aprobado: checked}).catch(e=>{showToast('No se pudo guardar'); console.error(e);});
}
function toggleWLDocTenida(opId, docId, checked){
  const op = state.wlIn[opId]; if(!op || !op.docs || !op.docs[docId]) return;
  op.docs[docId].tenida = checked;
  renderWL();
  DB.update(`refugio2/wlIn/${opId}/docs/${docId}`, {tenida: checked}).catch(e=>{showToast('No se pudo guardar'); console.error(e);});
}

function toggleWLFechaVisible(){
  const inicial = document.getElementById('wl-in-inicial').checked;
  document.getElementById('wl-in-fecha-group').style.display = inicial ? 'none' : 'block';
  if(inicial) document.getElementById('wl-in-fecha').value = '';
}

function onWLAprobadoToggle(){
  const chk = document.getElementById('wl-in-aprobado');
  if(!chk.checked){
    // Vuelve a "en proceso": empieza un ciclo nuevo, reinicia los checks de departamentos y documentos
    const hayAlgoMarcado = editingWLDeps.some(d=>d.aprobado) || editingWLDocs.some(d=>d.tenida);
    if(hayAlgoMarcado && !confirm('¿Reiniciar las casillas de departamentos y documentos para el nuevo ciclo?')){
      return;
    }
    editingWLDeps.forEach(d=>d.aprobado=false);
    editingWLDocs.forEach(d=>d.tenida=false);
    renderWLDeps('in');
    renderWLDocs('in');
  }
}

function setWLTab(tab){
  wlTab=tab;
  document.getElementById('wl-tab-in').classList.toggle('active',tab==='in');
  document.getElementById('wl-tab-out').classList.toggle('active',tab==='out');
  const tplBtn=document.getElementById('wl-template-btn'); if(tplBtn) tplBtn.style.display = tab==='in' ? 'block' : 'none';
  renderWL();
}

// Calcula el color de la tarjeta de un operador Wet Lease In según su fecha de caducidad
function wlEstadoColor(fechaCaducidad){
  if(!fechaCaducidad) return {color:'var(--text-muted)', bg:'var(--surface)', border:'var(--border)', label:''};
  const hoy=new Date(todayKey());
  const cad=new Date(fechaCaducidad);
  const diasRestantes=Math.round((cad-hoy)/86400000);
  if(diasRestantes<=30) return {color:'var(--red)', bg:'#FFF5F5', border:'var(--red)', label: diasRestantes<0?'Caducado':`${diasRestantes}d`};
  if(diasRestantes<=90) return {color:'#B8860B', bg:'#FFFBEB', border:'var(--yellow)', label:`${diasRestantes}d`};
  return {color:'var(--green)', bg:'var(--green-light)', border:'var(--green)', label:`${diasRestantes}d`};
}

function renderWL(){
  const area=document.getElementById('wl-area'); if(!area) return;
  const tplBtn=document.getElementById('wl-template-btn'); if(tplBtn) tplBtn.style.display = wlTab==='in' ? 'block' : 'none';
  if(wlTab==='in'){
    const ops=getWLSortedOps();
    if(!ops.length){area.innerHTML=`<div class="empty-state"><div class="empty-icon">✈️</div><p>Sin operadores todavía.<br>Pulsa "+ Operador" para añadir el primero.</p></div>`;return;}
    area.innerHTML=ops.map((op,i,arr)=>{
      const est=op.aprobacionInicial ? {color:'var(--lav-dark)', bg:'var(--lav-light)', border:'var(--lav)', label:'🆕 Inicial'} : wlEstadoColor(op.fechaCaducidad);
      const deps=Object.values(op.departamentos||{});
      const depsOk=deps.filter(d=>d.aprobado).length;
      const docs=Object.values(op.docs||{});
      const docsOk=docs.filter(d=>d.tenida).length;
      const chip=(checked)=>`display:flex;align-items:center;gap:5px;font-size:12px;background:${checked?'var(--green-light)':'var(--surface)'};border:1px solid ${checked?'var(--green)':'var(--border)'};padding:3px 9px;border-radius:99px;cursor:pointer;-webkit-tap-highlight-color:transparent;`;
      const ordBtns = `<div onclick="event.stopPropagation()" style="display:flex;gap:6px;flex-shrink:0;padding-left:8px;margin-left:auto;border-left:1px solid ${est.border};">
        <button class="order-circle-btn" onclick="event.stopPropagation();moveWLOperador('${op.id}','up')" ${i>0?'':'disabled'}>▲</button>
        <button class="order-circle-btn" onclick="event.stopPropagation();moveWLOperador('${op.id}','down')" ${i<arr.length-1?'':'disabled'}>▼</button>
      </div>`;
      return `<div onclick="openWLSheet('${op.id}','in')" style="background:${est.bg};border:1.5px solid ${est.border};border-radius:var(--radius);padding:14px 16px;margin-bottom:10px;cursor:pointer;">
        <div style="display:flex;align-items:center;gap:10px;">
          <span style="flex:1;min-width:0;font-size:15px;font-weight:700;">${op.name}</span>
          <span style="font-size:12px;font-weight:700;color:${est.color};white-space:nowrap;">${est.label}</span>
          ${ordBtns}
        </div>
        <div style="font-size:12px;color:var(--text-muted);margin-top:4px;">${op.aprobacionInicial?'Aún sin fecha de caducidad':'Caduca: '+(op.fechaCaducidad||'sin fecha')}${op.aprobado?' · ✅ Aprobado':''}</div>
        ${op.aprobado ? '' : (deps.length||docs.length?`<div onclick="event.stopPropagation()" style="margin-top:10px;">
          ${deps.length?`<div style="font-size:10px;font-weight:800;color:var(--text-muted);letter-spacing:0.03em;margin-bottom:5px;">DEPARTAMENTOS (${depsOk}/${deps.length})</div>
          <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:${docs.length?'10px':'0'};">
            ${deps.map(d=>`<label style="${chip(d.aprobado)}"><input type="checkbox" ${d.aprobado?'checked':''} onchange="toggleWLDepAprobado('${op.id}','${d.id}',this.checked)" style="margin:0;">${d.nombre}</label>`).join('')}
          </div>`:''}
          ${docs.length?`<div style="font-size:10px;font-weight:800;color:var(--text-muted);letter-spacing:0.03em;margin-bottom:5px;">DOCUMENTACIÓN AESA (${docsOk}/${docs.length})</div>
          <div style="display:flex;flex-wrap:wrap;gap:6px;">
            ${docs.map(d=>`<label style="${chip(d.tenida)}"><input type="checkbox" ${d.tenida?'checked':''} onchange="toggleWLDocTenida('${op.id}','${d.id}',this.checked)" style="margin:0;">${d.texto}</label>`).join('')}
          </div>`:''}
        </div>`:'')}
      </div>`;
    }).join('');
  } else {
    const ops=Object.values(state.wlOut).sort((a,b)=>(a.name||'').localeCompare(b.name||''));
    if(!ops.length){area.innerHTML=`<div class="empty-state"><div class="empty-icon">✈️</div><p>Sin operadores todavía.<br>Pulsa "+ Operador" para añadir el primero.</p></div>`;return;}
    area.innerHTML=ops.map(op=>{
      const deps=Object.values(op.departamentos||{});
      const depsOk=deps.filter(d=>d.contestado).length;
      const docs=Object.values(op.docs||{});
      const docsOk=docs.filter(d=>d.tenida).length;
      return `<div onclick="openWLSheet('${op.id}','out')" style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:14px 16px;margin-bottom:10px;cursor:pointer;">
        <div style="font-size:15px;font-weight:700;">${op.name}</div>
        <div style="font-size:12px;color:var(--text-muted);margin-top:4px;">Departamentos: ${depsOk}/${deps.length} contestados · Documentos: ${docsOk}/${docs.length}</div>
      </div>`;
    }).join('');
  }
}

function openWLSheet(id, tipoArg){
  const tipo = tipoArg || wlTab;
  const store = tipo==='in' ? state.wlIn : state.wlOut;
  const op = id ? store[id] : null;
  const isNew = !op;
  document.getElementById(`wl-${tipo}-id`).value = op?.id || '';
  document.getElementById(`wl-${tipo}-name`).value = op?.name || '';
  if(tipo==='in') document.getElementById('wl-in-fecha').value = op?.fechaCaducidad || '';
  if(tipo==='in'){
    document.getElementById('wl-in-inicial').checked = !!op?.aprobacionInicial;
    document.getElementById('wl-in-aprobado').checked = !!op?.aprobado;
    toggleWLFechaVisible();
  }
  editingWLDeps = op?.departamentos ? Object.values(op.departamentos).map(d=>({...d}))
    : (isNew && tipo==='in') ? Object.values(state.wlInTemplate.departamentos||{}).map((d,i)=>({id:'d'+Date.now()+'_'+i+Math.random().toString(36).slice(2,6), nombre:d.nombre, aprobado:false, nota:''}))
    : [];
  editingWLDocs = op?.docs ? Object.values(op.docs).map(d=>({...d}))
    : (isNew && tipo==='in') ? Object.values(state.wlInTemplate.docs||{}).map((d,i)=>({id:'doc'+Date.now()+'_'+i+Math.random().toString(36).slice(2,6), texto:d.texto, tenida:false}))
    : [];
  renderWLDeps(tipo);
  renderWLDocs(tipo);
  document.getElementById(`wl-${tipo}-sheet-title`).textContent = isNew ? `Nuevo operador (Wet Lease ${tipo==='in'?'In':'Out'})` : `Editar operador`;
  document.getElementById(`wl-${tipo}-delete-btn`).style.display = isNew ? 'none' : 'block';
  document.getElementById(`wl-${tipo}-sheet`).classList.add('open');
}
function closeWLSheet(){
  document.getElementById('wl-in-sheet').classList.remove('open');
  document.getElementById('wl-out-sheet').classList.remove('open');
}

function renderWLDeps(tipo){
  const c=document.getElementById(`wl-${tipo}-deps-list`); if(!c) return;
  if(tipo==='in'){
    c.innerHTML=editingWLDeps.map((d,i)=>`
      <div style="border:1px solid var(--border);border-radius:10px;padding:10px;margin-bottom:8px;">
        <div style="display:flex;align-items:center;gap:8px;">
          <input class="input-field" value="${d.nombre||''}" placeholder="Departamento" oninput="editingWLDeps[${i}].nombre=this.value" style="flex:1;">
          <label style="display:flex;align-items:center;gap:4px;font-size:12px;white-space:nowrap;cursor:pointer;">
            <input type="checkbox" ${d.aprobado?'checked':''} onchange="editingWLDeps[${i}].aprobado=this.checked">Aprobado
          </label>
          <button class="remove-btn" onclick="editingWLDeps.splice(${i},1);renderWLDeps('in')">×</button>
        </div>
        <input class="input-field" value="${d.nota||''}" placeholder="Nota — qué falta por su parte..." oninput="editingWLDeps[${i}].nota=this.value" style="margin-top:6px;font-size:12px;">
      </div>`).join('');
  } else {
    c.innerHTML=editingWLDeps.map((d,i)=>`
      <div style="border:1px solid var(--border);border-radius:10px;padding:10px;margin-bottom:8px;">
        <div style="display:flex;align-items:center;gap:8px;">
          <input class="input-field" value="${d.nombre||''}" placeholder="Departamento" oninput="editingWLDeps[${i}].nombre=this.value" style="flex:1;">
          <label style="display:flex;align-items:center;gap:4px;font-size:12px;white-space:nowrap;cursor:pointer;">
            <input type="checkbox" ${d.contestado?'checked':''} onchange="editingWLDeps[${i}].contestado=this.checked">Contestado
          </label>
          <button class="remove-btn" onclick="editingWLDeps.splice(${i},1);renderWLDeps('out')">×</button>
        </div>
        <input class="input-field" value="${d.quePide||''}" placeholder="Qué parte del cuestionario pide..." oninput="editingWLDeps[${i}].quePide=this.value" style="margin-top:6px;font-size:12px;">
        <input class="input-field" value="${d.nota||''}" placeholder="Nota — qué falta por su parte..." oninput="editingWLDeps[${i}].nota=this.value" style="margin-top:6px;font-size:12px;">
      </div>`).join('');
  }
}
function addWLDep(tipo){
  editingWLDeps.push(tipo==='in'
    ? {id:'d'+Date.now()+Math.random().toString(36).slice(2,6), nombre:'', aprobado:false, nota:''}
    : {id:'d'+Date.now()+Math.random().toString(36).slice(2,6), nombre:'', quePide:'', contestado:false, nota:''});
  renderWLDeps(tipo);
}

function renderWLDocs(tipo){
  const c=document.getElementById(`wl-${tipo}-docs-list`); if(!c) return;
  c.innerHTML=editingWLDocs.map((d,i)=>`
    <div class="item-row">
      <label style="display:flex;align-items:center;gap:8px;flex:1;cursor:pointer;">
        <input type="checkbox" ${d.tenida?'checked':''} onchange="editingWLDocs[${i}].tenida=this.checked">
        <input class="input-field" value="${d.texto||''}" placeholder="Documento..." oninput="editingWLDocs[${i}].texto=this.value" style="flex:1;">
      </label>
      <button class="remove-btn" onclick="editingWLDocs.splice(${i},1);renderWLDocs('${tipo}')">×</button>
    </div>`).join('');
}
function addWLDoc(tipo){
  editingWLDocs.push({id:'doc'+Date.now()+Math.random().toString(36).slice(2,6), texto:'', tenida:false});
  renderWLDocs(tipo);
}

function saveWLOperador(tipo){
  const name=document.getElementById(`wl-${tipo}-name`).value.trim();
  if(!name){showToast('Ponle un nombre al operador');return;}
  const existing = tipo==='in' ? state.wlIn : state.wlOut;
  const id=document.getElementById(`wl-${tipo}-id`).value || ('op'+Date.now());
  const createdAt = existing[id]?.createdAt !== undefined ? existing[id].createdAt : Date.now();
  const order = existing[id]?.order !== undefined ? existing[id].order : (tipo==='in' ? minOrderWL() : Date.now());
  const departamentos={}; editingWLDeps.filter(d=>d.nombre.trim()).forEach(d=>departamentos[d.id]=d);
  const docs={}; editingWLDocs.filter(d=>d.texto.trim()).forEach(d=>docs[d.id]=d);
  const data = tipo==='in'
    ? {id, name, createdAt, order, fechaCaducidad:document.getElementById('wl-in-fecha').value||'', departamentos, docs,
       aprobacionInicial: document.getElementById('wl-in-inicial').checked,
       aprobado: document.getElementById('wl-in-aprobado').checked}
    : {id, name, createdAt, order, departamentos, docs};
  DB.set(`refugio2/wl${tipo==='in'?'In':'Out'}/${id}`, data).then(()=>{closeWLSheet();showToast('Guardado ✓');});
}

function deleteWLOperador(tipo){
  const id=document.getElementById(`wl-${tipo}-id`).value;
  if(!id||!confirm('¿Eliminar este operador?'))return;
  DB.remove(`refugio2/wl${tipo==='in'?'In':'Out'}/${id}`).then(()=>{closeWLSheet();showToast('Eliminado');});
}

// ── PLANTILLA WET LEASE IN (departamentos y documentos por defecto) ──
let editingWLTemplateDeps=[], editingWLTemplateDocs=[];

function openWLTemplateSheet(){
  editingWLTemplateDeps = Object.values(state.wlInTemplate.departamentos||{}).map(d=>({...d}));
  editingWLTemplateDocs = Object.values(state.wlInTemplate.docs||{}).map(d=>({...d}));
  renderWLTemplateDeps();
  renderWLTemplateDocs();
  document.getElementById('wl-template-sheet').classList.add('open');
}
function closeWLTemplateSheet(){
  document.getElementById('wl-template-sheet').classList.remove('open');
}

function renderWLTemplateDeps(){
  const c=document.getElementById('wl-template-deps-list'); if(!c) return;
  c.innerHTML=editingWLTemplateDeps.map((d,i)=>`
    <div class="item-row">
      <input class="input-field" value="${d.nombre||''}" placeholder="Nombre del departamento" oninput="editingWLTemplateDeps[${i}].nombre=this.value">
      <button class="remove-btn" onclick="editingWLTemplateDeps.splice(${i},1);renderWLTemplateDeps()">×</button>
    </div>`).join('');
}
function addWLTemplateDep(){
  editingWLTemplateDeps.push({id:'d'+Date.now()+Math.random().toString(36).slice(2,6), nombre:''});
  renderWLTemplateDeps();
}

function renderWLTemplateDocs(){
  const c=document.getElementById('wl-template-docs-list'); if(!c) return;
  c.innerHTML=editingWLTemplateDocs.map((d,i)=>`
    <div class="item-row">
      <input class="input-field" value="${d.texto||''}" placeholder="Nombre del documento" oninput="editingWLTemplateDocs[${i}].texto=this.value">
      <button class="remove-btn" onclick="editingWLTemplateDocs.splice(${i},1);renderWLTemplateDocs()">×</button>
    </div>`).join('');
}
function addWLTemplateDoc(){
  editingWLTemplateDocs.push({id:'doc'+Date.now()+Math.random().toString(36).slice(2,6), texto:''});
  renderWLTemplateDocs();
}

function saveWLTemplate(){
  const departamentos={}; editingWLTemplateDeps.filter(d=>d.nombre.trim()).forEach(d=>departamentos[d.id]={id:d.id,nombre:d.nombre.trim()});
  const docs={}; editingWLTemplateDocs.filter(d=>d.texto.trim()).forEach(d=>docs[d.id]={id:d.id,texto:d.texto.trim()});
  DB.set('refugio2/wlInTemplate', {departamentos, docs}).then(()=>{closeWLTemplateSheet();showToast('Plantilla guardada ✓');});
}

// ── TRABAJO · MENSUAL / SEMANAL (comparten la misma colección de tareas) ──
function monthKey(d){ return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; }
function monthLabel(key){
  const [y,m]=key.split('-');
  const d=new Date(parseInt(y), parseInt(m)-1, 1);
  const s=d.toLocaleDateString('es-ES',{month:'long',year:'numeric'});
  return s.charAt(0).toUpperCase()+s.slice(1);
}
function mondayOf(d){ const nd=new Date(d); const wd=(nd.getDay()+6)%7; nd.setDate(nd.getDate()-wd); return nd; }
function weekLabel(mondayKey){
  const [y,m,d]=mondayKey.split('-').map(Number);
  const mon=new Date(y,m-1,d);
  const sun=new Date(mon); sun.setDate(mon.getDate()+6);
  return `${mon.toLocaleDateString('es-ES',{day:'numeric',month:'short'})} – ${sun.toLocaleDateString('es-ES',{day:'numeric',month:'short'})}`;
}
function isDiaEnSemana(diaKey, mondayKey){
  if(!diaKey||!mondayKey) return false;
  const [y,m,d]=mondayKey.split('-').map(Number);
  const mon=new Date(y,m-1,d); const sun=new Date(mon); sun.setDate(mon.getDate()+6);
  return diaKey>=localKey(mon) && diaKey<=localKey(sun);
}
function diaLabelCorta(iso){
  if(!iso) return '';
  const [y,m,d]=iso.split('-').map(Number);
  const dt=new Date(y,m-1,d);
  const s=dt.toLocaleDateString('es-ES',{weekday:'short'}).replace('.','');
  return s.charAt(0).toUpperCase()+s.slice(1);
}

// Paleta de colores para dar variedad a las columnas (Mensual, Semanal...)
const PALETTE=[
  {c:'var(--lav)',bg:'var(--lav-light)'},
  {c:'var(--pink)',bg:'var(--pink-light)'},
  {c:'var(--blue)',bg:'var(--blue-light)'},
  {c:'var(--peach)',bg:'var(--peach-light)'},
  {c:'var(--teal)',bg:'var(--teal-light)'},
  {c:'var(--yellow)',bg:'var(--yellow-light)'},
  {c:'var(--green)',bg:'var(--green-light)'},
];
function paletteAt(i){ return PALETTE[i%PALETTE.length]; }

function setMensualCount(n){ mensualMonthsCount=n; renderMensual(); }
function mensualNav(dir){
  mensualBaseDate.setMonth(mensualBaseDate.getMonth()+dir);
  mensualBaseDate=new Date(mensualBaseDate);
  renderMensual();
}

function renderMensualTareaRow(t, pal){
  const checkSvg=`<svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M1.5 5.5L4 8L9.5 2.5" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  const boxStyle = (t.done && pal) ? `style="background:${pal.c};border-color:${pal.c};"` : '';
  return `<div class="check-item" onclick="openMensualTareaSheet('${t.id}')">
    <div class="check-box ${t.done?'checked':''}" ${boxStyle} onclick="event.stopPropagation();toggleMensualTarea('${t.id}')">${checkSvg}</div>
    <span class="check-label ${t.done?'done':''}" style="flex:1;">${t.name}</span>
  </div>`;
}

function renderMensual(){
  const area=document.getElementById('mensual-area'); if(!area) return;
  const meses=Array.from({length:mensualMonthsCount},(_,i)=>{
    const d=new Date(mensualBaseDate.getFullYear(), mensualBaseDate.getMonth()+i, 1);
    return monthKey(d);
  });
  const allTareas=Object.values(state.mensualTareas||{});
  const sinMes=allTareas.filter(t=>!t.mes).sort((a,b)=>(a.createdAt||0)-(b.createdAt||0));
  const rangeLabel = meses.length>1 ? `${monthLabel(meses[0])} – ${monthLabel(meses[meses.length-1])}` : monthLabel(meses[0]);

  let html=`<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
    <button class="cal-nav-btn" onclick="mensualNav(-1)">‹</button>
    <div class="cal-nav-title">${rangeLabel}</div>
    <button class="cal-nav-btn" onclick="mensualNav(1)">›</button>
  </div>
  <div class="cal-view-toggle">
    ${[1,2,3].map(n=>`<button class="cal-view-btn ${mensualMonthsCount===n?'active':''}" onclick="setMensualCount(${n})">${n} mes${n>1?'es':''}</button>`).join('')}
  </div>
  <div class="multi-col-board" style="--cols:${mensualMonthsCount};">
    ${meses.map((mk,i)=>{
      const pal=paletteAt(i);
      const tareasMes=allTareas.filter(t=>t.mes===mk).sort((a,b)=>(a.createdAt||0)-(b.createdAt||0));
      return `<div class="kanban-col" style="background:${pal.bg};">
        <div class="kanban-col-title" style="border-bottom-color:${pal.c};"><span>${monthLabel(mk)}</span><span class="kanban-col-count" style="color:${pal.c};">${tareasMes.length}</span></div>
        ${tareasMes.length?tareasMes.map(t=>renderMensualTareaRow(t,pal)).join(''):'<div style="font-size:13px;color:var(--text-muted);text-align:center;padding:20px 0;">Sin tareas</div>'}
      </div>`;
    }).join('')}
  </div>
  <div class="section-label" style="margin-top:24px;">📥 Pendientes de asignar</div>
  ${sinMes.length ? `<div class="card">${sinMes.map(t=>renderMensualTareaRow(t)).join('')}</div>`
    : `<div class="empty-state" style="padding:20px;"><p>Nada pendiente de asignar.</p></div>`}`;

  area.innerHTML=html;
}

function toggleMensualTarea(id){
  const t=state.mensualTareas[id]; if(!t) return;
  DB.update(`refugio2/mensualTareas/${id}`,{done:!t.done});
}
function toggleTareaPrioridad(id){
  const t=state.mensualTareas[id]; if(!t) return;
  DB.update(`refugio2/mensualTareas/${id}`,{prioridad:!t.prioridad});
}

function populateMensualMesSelect(){
  const sel=document.getElementById('mensual-tarea-mes'); if(!sel) return;
  const opts=[`<option value="">Sin mes (pendiente)</option>`];
  const base=new Date();
  for(let i=-1;i<12;i++){
    const d=new Date(base.getFullYear(), base.getMonth()+i, 1);
    const k=monthKey(d);
    opts.push(`<option value="${k}">${monthLabel(k)}</option>`);
  }
  sel.innerHTML=opts.join('');
}
function populateMensualSemanaSelect(){
  const sel=document.getElementById('mensual-tarea-semana'); if(!sel) return;
  const opts=[`<option value="">Sin semana</option>`];
  const base=mondayOf(new Date());
  for(let i=-1;i<12;i++){
    const d=new Date(base); d.setDate(d.getDate()+i*7);
    const k=localKey(d);
    opts.push(`<option value="${k}">${weekLabel(k)}</option>`);
  }
  sel.innerHTML=opts.join('');
}
function populateMensualDiaSelect(){
  const semSel=document.getElementById('mensual-tarea-semana');
  const diaSel=document.getElementById('mensual-tarea-dia');
  if(!semSel||!diaSel) return;
  const wk=semSel.value;
  if(!wk){ diaSel.innerHTML=`<option value="">Elige antes una semana</option>`; diaSel.disabled=true; return; }
  diaSel.disabled=false;
  const [y,m,d]=wk.split('-').map(Number);
  const mon=new Date(y,m-1,d);
  const dias=['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];
  let opts=[`<option value="">Sin día concreto</option>`];
  for(let i=0;i<7;i++){
    const dd=new Date(mon); dd.setDate(dd.getDate()+i);
    opts.push(`<option value="${localKey(dd)}">${dias[i]} ${dd.getDate()}</option>`);
  }
  diaSel.innerHTML=opts.join('');
}

function toggleMensualSubtareas(){
  const tamano=document.getElementById('mensual-tarea-tamano').value;
  const subCont=document.getElementById('mensual-tarea-subtareas-container');
  const horaGroup=document.getElementById('mensual-tarea-hora-group');
  if(subCont) subCont.style.display = tamano==='grande' ? 'block' : 'none';
  if(horaGroup) horaGroup.style.display = tamano==='grande' ? 'none' : 'flex';
}
function renderMensualSubtareasList(){
  const c=document.getElementById('mensual-subtareas-list'); if(!c) return;
  c.innerHTML=editingSubtareas.map((s,i)=>`
    <div style="border:1px solid var(--border);border-radius:10px;padding:10px;margin-bottom:8px;">
      <div style="display:flex;gap:8px;align-items:center;">
        <input class="input-field" value="${s.text||''}" placeholder="Subtarea..." oninput="editingSubtareas[${i}].text=this.value" style="flex:1;">
        <button class="remove-btn" onclick="editingSubtareas.splice(${i},1);renderMensualSubtareasList()">×</button>
      </div>
      <div style="display:flex;gap:6px;margin-top:6px;">
        <input class="input-field" type="date" value="${s.dia||''}" oninput="editingSubtareas[${i}].dia=this.value" style="flex:1;font-size:12px;">
        <input class="input-field" type="time" value="${s.horaInicio||''}" oninput="editingSubtareas[${i}].horaInicio=this.value" style="flex:1;font-size:12px;">
        <input class="input-field" type="time" value="${s.horaFin||''}" oninput="editingSubtareas[${i}].horaFin=this.value" style="flex:1;font-size:12px;">
      </div>
    </div>`).join('');
}
function addMensualSubtarea(){
  editingSubtareas.push({id:'sub'+Date.now()+Math.random().toString(36).slice(2,6), text:'', dia:'', horaInicio:'', horaFin:'', done:false});
  renderMensualSubtareasList();
}

function openMensualTareaSheet(id, presetSemana, presetDia){
  const t=id?state.mensualTareas[id]:null;
  const isNew=!t;
  document.getElementById('mensual-tarea-id').value=t?.id||'';
  document.getElementById('mensual-tarea-name').value=t?.name||'';
  populateMensualMesSelect();
  document.getElementById('mensual-tarea-mes').value=t?.mes||'';
  populateMensualSemanaSelect();
  document.getElementById('mensual-tarea-semana').value = t?.semana || (isNew && presetSemana ? presetSemana : '');
  populateMensualDiaSelect();
  document.getElementById('mensual-tarea-dia').value = t?.dia || (isNew && presetDia ? presetDia : '');
  document.getElementById('mensual-tarea-prioridad').checked=!!t?.prioridad;
  document.getElementById('mensual-tarea-tamano').value=t?.tamano||'pequena';
  document.getElementById('mensual-tarea-hora-inicio').value=t?.horaInicio||'';
  document.getElementById('mensual-tarea-hora-fin').value=t?.horaFin||'';
  editingSubtareas = t?.subtareas ? Object.values(t.subtareas).map(s=>({...s})) : [];
  renderMensualSubtareasList();
  toggleMensualSubtareas();
  document.getElementById('mensual-tarea-sheet-title').textContent=isNew?'Nueva tarea':'Editar tarea';
  document.getElementById('mensual-tarea-delete-btn').style.display=isNew?'none':'block';
  document.getElementById('mensual-tarea-sheet').classList.add('open');
}
function closeMensualTareaSheet(){document.getElementById('mensual-tarea-sheet').classList.remove('open');}

function saveMensualTarea(){
  const name=document.getElementById('mensual-tarea-name').value.trim();
  if(!name){showToast('Escribe el nombre');return;}
  const id=document.getElementById('mensual-tarea-id').value||Date.now().toString();
  let mes=document.getElementById('mensual-tarea-mes').value||'';
  const semana=document.getElementById('mensual-tarea-semana').value||'';
  const dia=document.getElementById('mensual-tarea-dia').value||'';
  if(!mes && semana){
    const [y,m,d]=semana.split('-').map(Number);
    mes=monthKey(new Date(y,m-1,d));
  }
  const tamano=document.getElementById('mensual-tarea-tamano').value||'pequena';
  const subtareasArr=editingSubtareas.filter(s=>s.text.trim());
  const subtareas = (tamano==='grande' && subtareasArr.length)
    ? Object.fromEntries(subtareasArr.map(s=>[s.id,{
        id:s.id, text:s.text.trim(), dia:s.dia||'', horaInicio:s.horaInicio||'', horaFin:s.horaFin||'',
        done:state.mensualTareas[id]?.subtareas?.[s.id]?.done||false
      }]))
    : null;
  const data={
    id, name, mes, semana, dia,
    prioridad:document.getElementById('mensual-tarea-prioridad').checked,
    tamano,
    horaInicio: tamano==='grande' ? '' : (document.getElementById('mensual-tarea-hora-inicio').value||''),
    horaFin: tamano==='grande' ? '' : (document.getElementById('mensual-tarea-hora-fin').value||''),
    subtareas,
    done:state.mensualTareas[id]?.done||false,
    createdAt:state.mensualTareas[id]?.createdAt||Date.now()
  };
  DB.set(`refugio2/mensualTareas/${id}`,data).then(()=>{closeMensualTareaSheet();showToast('Guardado ✓');});
}
function deleteMensualTarea(){
  const id=document.getElementById('mensual-tarea-id').value;
  if(!id||!confirm('¿Eliminar?'))return;
  DB.remove(`refugio2/mensualTareas/${id}`).then(()=>{closeMensualTareaSheet();showToast('Eliminada');});
}

// ── TRABAJO · SEMANAL (agrupada por mes) ──
// Devuelve las claves (lunes) de todas las semanas que tocan el mes mk ('YYYY-MM')
function weeksOfMonth(mk){
  const [y,m]=mk.split('-').map(Number);
  const first=new Date(y,m-1,1);
  const last=new Date(y,m,0);
  const startMonday=mondayOf(first);
  const weeks=[]; const cursor=new Date(startMonday);
  while(cursor<=last){ weeks.push(localKey(cursor)); cursor.setDate(cursor.getDate()+7); }
  return weeks;
}

function setSemanalCount(n){ semanalMonthsCount=n; renderSemanal(); }
function semanalNav(dir){
  semanalBaseDate.setMonth(semanalBaseDate.getMonth()+dir);
  semanalBaseDate=new Date(semanalBaseDate);
  renderSemanal();
}

function renderSemanalTareaRow(t, pal, viaSub){
  const checkSvg=`<svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M1.5 5.5L4 8L9.5 2.5" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  const boxStyle = (t.done && pal) ? `style="background:${pal.c};border-color:${pal.c};"` : '';
  const dotColor = pal ? pal.c : 'var(--lav)';
  return `<div class="check-item" onclick="openMensualTareaSheet('${t.id}')">
    <div class="check-box ${t.done?'checked':''}" ${boxStyle} onclick="event.stopPropagation();toggleMensualTarea('${t.id}')">${checkSvg}</div>
    <span class="check-label ${t.done?'done':''}" style="flex:1;">${t.name}${viaSub?` <span style="color:${dotColor};font-size:10px;font-weight:700;">· subtarea esta semana</span>`:''}</span>
    <span onclick="event.stopPropagation();toggleTareaPrioridad('${t.id}')" style="font-size:14px;cursor:pointer;flex-shrink:0;" title="Prioridad de la semana">${t.prioridad?'⭐':'☆'}</span>
    ${t.dia?`<span style="font-size:10px;font-weight:700;color:${dotColor};flex-shrink:0;margin-left:6px;white-space:nowrap;">${diaLabelCorta(t.dia)}</span>`:''}
  </div>`;
}

function renderSemanal(){
  const area=document.getElementById('semanal-area'); if(!area) return;
  const meses=Array.from({length:semanalMonthsCount},(_,i)=>{
    const d=new Date(semanalBaseDate.getFullYear(), semanalBaseDate.getMonth()+i, 1);
    return monthKey(d);
  });
  const allTareas=Object.values(state.mensualTareas||{});
  const rangeLabel = meses.length>1 ? `${monthLabel(meses[0])} – ${monthLabel(meses[meses.length-1])}` : monthLabel(meses[0]);

  let html=`<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
    <button class="cal-nav-btn" onclick="semanalNav(-1)">‹</button>
    <div class="cal-nav-title">${rangeLabel}</div>
    <button class="cal-nav-btn" onclick="semanalNav(1)">›</button>
  </div>
  <div class="cal-view-toggle">
    ${[1,2,3].map(n=>`<button class="cal-view-btn ${semanalMonthsCount===n?'active':''}" onclick="setSemanalCount(${n})">${n} mes${n>1?'es':''}</button>`).join('')}
  </div>`;

  let colorIdx=0;
  meses.forEach(mk=>{
    const weeks=weeksOfMonth(mk);
    html+=`<div class="section-label" style="margin-top:20px;">${monthLabel(mk)}</div>
    <div class="multi-col-board" style="--cols:${weeks.length};">
      ${weeks.map(wk=>{
        const pal=paletteAt(colorIdx++);
        // Tareas que tocan esta semana: bien porque su propia "semana" coincide, bien porque tienen alguna subtarea con "día" dentro de esta semana (para que la tarea madre se vea aunque ella no tenga semana propia)
        const tareasSemana=allTareas.filter(t=>{
          if(t.semana===wk) return true;
          if(t.subtareas) return Object.values(t.subtareas).some(s=>isDiaEnSemana(s.dia, wk));
          return false;
        }).map(t=>({...t, __viaSub: t.semana!==wk})).sort((a,b)=>{
          if(!!a.prioridad!==!!b.prioridad) return a.prioridad?-1:1;
          if((a.dia||'')!==(b.dia||'')) return (a.dia||'zzzz').localeCompare(b.dia||'zzzz');
          return (a.createdAt||0)-(b.createdAt||0);
        });
        return `<div class="kanban-col" style="background:${pal.bg};">
          <div class="kanban-col-title" style="border-bottom-color:${pal.c};"><span>${weekLabel(wk)}</span><span class="kanban-col-count" style="color:${pal.c};">${tareasSemana.length}</span></div>
          ${tareasSemana.length?tareasSemana.map(t=>renderSemanalTareaRow(t,pal,t.__viaSub)).join(''):'<div style="font-size:13px;color:var(--text-muted);text-align:center;padding:20px 0;">Sin tareas</div>'}
          <textarea class="input-field" placeholder="Notas de la semana..." style="margin-top:10px;font-size:12px;min-height:60px;" onblur="saveSemanaNota('${wk}',this.value)">${state.semanaNotas?.[wk]?.texto||''}</textarea>
        </div>`;
      }).join('')}
    </div>`;

    const sinSemanaMes=allTareas.filter(t=>t.mes===mk && !t.semana).sort((a,b)=>(a.createdAt||0)-(b.createdAt||0));
    html+=`<div class="section-label" style="margin-top:14px;">📥 Sin semana asignada (${monthLabel(mk)})</div>
    ${sinSemanaMes.length?`<div class="card">${sinSemanaMes.map(t=>renderMensualTareaRow(t)).join('')}</div>`
      : `<div class="empty-state" style="padding:20px;"><p>Nada pendiente de asignar a semana.</p></div>`}`;
  });

  area.innerHTML=html;
}

function saveSemanaNota(weekKey, texto){
  DB.set(`refugio2/semanaNotas/${weekKey}`,{texto}).then(()=>showToast('Nota guardada ✓',1200));
}

function openSemanalNuevaTarea(){
  const mk=monthKey(semanalBaseDate);
  const weeks=weeksOfMonth(mk);
  openMensualTareaSheet(null, weeks[0]);
}

// ── TRABAJO · DIARIO ──
function diaNav(dir){
  const d=new Date(diaVistaSelected+'T12:00:00');
  d.setDate(d.getDate()+dir);
  diaVistaSelected=localKey(d);
  diarioCalMonth=new Date(d.getFullYear(), d.getMonth(), 1);
  renderDiario();
}
function selectDiaVista(key){
  diaVistaSelected=key;
  renderDiario();
}
function diarioCalNav(dir){
  diarioCalMonth.setMonth(diarioCalMonth.getMonth()+dir);
  diarioCalMonth=new Date(diarioCalMonth);
  renderDiario();
}

// Todo lo que hay puesto para un día: tareas pequeñas/sin dividir con ese día, y subtareas de tareas grandes con ese día
function getItemsDelDia(key){
  const items=[];
  Object.values(state.mensualTareas||{}).forEach(t=>{
    const tieneSubtareas = t.subtareas && Object.keys(t.subtareas).length>0;
    if(!tieneSubtareas && t.dia===key){
      items.push({tipo:'tarea', id:t.id, subId:null, text:t.name, done:!!t.done, horaInicio:t.horaInicio||'', horaFin:t.horaFin||'', parentName:''});
    }
    if(tieneSubtareas){
      Object.values(t.subtareas).forEach(s=>{
        if(s.dia===key){
          items.push({tipo:'subtarea', id:t.id, subId:s.id, text:s.text, done:!!s.done, horaInicio:s.horaInicio||'', horaFin:s.horaFin||'', parentName:t.name});
        }
      });
    }
  });
  return items;
}

// Para cada día: nombres a mostrar (la tarea madre si el item es una subtarea, la propia tarea si es pequeña/sin dividir)
function getNombresPorDia(){
  const map={};
  const push=(key,name)=>{ if(!key) return; if(!map[key]) map[key]=[]; if(!map[key].includes(name)) map[key].push(name); };
  Object.values(state.mensualTareas||{}).forEach(t=>{
    const tieneSubtareas = t.subtareas && Object.keys(t.subtareas).length>0;
    if(!tieneSubtareas && t.dia) push(t.dia, t.name);
    if(tieneSubtareas) Object.values(t.subtareas).forEach(s=>{ if(s.dia) push(s.dia, t.name); });
  });
  return map;
}

function renderDiarioMiniCalHTML(){
  const y=diarioCalMonth.getFullYear(), m=diarioCalMonth.getMonth();
  const monthName=diarioCalMonth.toLocaleDateString('es-ES',{month:'long',year:'numeric'});
  const firstDay=(new Date(y,m,1).getDay()+6)%7;
  const days=new Date(y,m+1,0).getDate();
  const nombresPorDia=getNombresPorDia();
  const today=todayKey();
  let grid=['L','M','X','J','V','S','D'].map(d=>`<div class="cal-day-label">${d}</div>`).join('');
  for(let i=0;i<firstDay;i++) grid+=`<div class="cal-day empty"></div>`;
  for(let d=1;d<=days;d++){
    const key=`${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const isToday=key===today, isSel=key===diaVistaSelected;
    const nombres=nombresPorDia[key]||[];
    grid+=`<div class="cal-day ${isToday?'today':''} ${isSel&&!isToday?'selected':''}" onclick="selectDiaVista('${key}')">
      <div class="cal-day-num">${d}</div>
      ${nombres.slice(0,2).map(n=>`<div class="cal-day-item ${isToday?'on-color':''}">${n}</div>`).join('')}
      ${nombres.length>2?`<div class="cal-day-more ${isToday?'on-color':''}">+${nombres.length-2} más</div>`:''}
    </div>`;
  }
  return `<div class="card" style="padding:14px 12px;margin-bottom:16px;background:linear-gradient(160deg,var(--lav-light),var(--pink-light) 60%,var(--peach-light));border:none;">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
      <button class="mini-cal-nav" onclick="diarioCalNav(-1)">‹</button>
      <div class="mini-cal-title">${monthName.charAt(0).toUpperCase()+monthName.slice(1)}</div>
      <button class="mini-cal-nav" onclick="diarioCalNav(1)">›</button>
    </div>
    <div class="cal-grid" style="margin-bottom:0;">${grid}</div>
  </div>`;
}

function renderDiarioItemRow(item, showHora){
  const checkSvg=`<svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M1.5 5.5L4 8L9.5 2.5" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  const onToggle = item.tipo==='subtarea' ? `toggleSubtareaDone('${item.id}','${item.subId}')` : `toggleMensualTarea('${item.id}')`;
  const onOpen = `openDiarioItemSheet('${item.id}', ${item.subId?`'${item.subId}'`:'null'})`;
  return `<div class="check-item" onclick="${onOpen}">
    <div class="check-box ${item.done?'checked':''}" onclick="event.stopPropagation();${onToggle}">${checkSvg}</div>
    <span class="check-label ${item.done?'done':''}" style="flex:1;">${item.parentName?`<span style="color:var(--text-muted);">${item.parentName} › </span>`:''}${item.text}</span>
    ${showHora && item.horaInicio ? `<span style="font-size:11px;font-weight:700;color:var(--lav);white-space:nowrap;">${item.horaInicio}${item.horaFin?'–'+item.horaFin:''}</span>`:''}
  </div>`;
}

function renderDiario(){
  const area=document.getElementById('diario-area'); if(!area) return;
  const key=diaVistaSelected;
  const fecha=new Date(key+'T12:00:00').toLocaleDateString('es-ES',{weekday:'long',day:'numeric',month:'long'});
  const items=getItemsDelDia(key);
  const conHora=items.filter(i=>i.horaInicio).sort((a,b)=>a.horaInicio.localeCompare(b.horaInicio));
  const sinHora=items.filter(i=>!i.horaInicio);

  let html=`<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
    <button class="cal-nav-btn" onclick="diaNav(-1)">‹</button>
    <div class="cal-nav-title">${fecha.charAt(0).toUpperCase()+fecha.slice(1)}</div>
    <button class="cal-nav-btn" onclick="diaNav(1)">›</button>
  </div>
  <div id="diario-layout" style="display:flex;gap:24px;align-items:flex-start;">
    <div id="diario-cal-col" style="width:100%;flex-shrink:0;">
      ${renderDiarioMiniCalHTML()}
    </div>
    <div id="diario-list-col" style="flex:1;min-width:0;width:100%;">
      <div class="section-label" style="margin-top:0;">🕐 Horario del día</div>
      ${conHora.length ? `<div class="card">${conHora.map(i=>renderDiarioItemRow(i,true)).join('')}</div>` : `<div style="font-size:13px;color:var(--text-muted);padding:8px 0 16px;">Nada con hora puesta todavía.</div>`}
      <div class="section-label" style="margin-top:20px;">📋 Sin hora asignada</div>
      ${sinHora.length ? `<div class="card">${sinHora.map(i=>renderDiarioItemRow(i,false)).join('')}</div>` : `<div class="empty-state" style="padding:20px;"><p>Nada pendiente de programar este día.</p></div>`}
    </div>
  </div>`;

  area.innerHTML=html;
}

function toggleSubtareaDone(taskId, subId){
  const t=state.mensualTareas[taskId]; if(!t||!t.subtareas||!t.subtareas[subId]) return;
  DB.update(`refugio2/mensualTareas/${taskId}/subtareas/${subId}`,{done:!t.subtareas[subId].done});
}

function openDiarioItemSheet(taskId, subId){
  if(!subId){ openMensualTareaSheet(taskId); return; }
  const t=state.mensualTareas[taskId]; const s=t?.subtareas?.[subId]; if(!s) return;
  document.getElementById('subtarea-task-id').value=taskId;
  document.getElementById('subtarea-id').value=subId;
  document.getElementById('subtarea-text').value=s.text||'';
  document.getElementById('subtarea-dia').value=s.dia||'';
  document.getElementById('subtarea-hora-inicio').value=s.horaInicio||'';
  document.getElementById('subtarea-hora-fin').value=s.horaFin||'';
  document.getElementById('subtarea-sheet').classList.add('open');
}
function closeSubtareaSheet(){document.getElementById('subtarea-sheet').classList.remove('open');}
function saveSubtareaSheet(){
  const taskId=document.getElementById('subtarea-task-id').value;
  const subId=document.getElementById('subtarea-id').value;
  const text=document.getElementById('subtarea-text').value.trim();
  if(!text){showToast('Escribe el texto');return;}
  DB.update(`refugio2/mensualTareas/${taskId}/subtareas/${subId}`,{
    text,
    dia:document.getElementById('subtarea-dia').value||'',
    horaInicio:document.getElementById('subtarea-hora-inicio').value||'',
    horaFin:document.getElementById('subtarea-hora-fin').value||''
  }).then(()=>{closeSubtareaSheet();showToast('Guardado ✓');});
}

function openDiarioNuevaTarea(){
  const monday=localKey(mondayOf(new Date(diaVistaSelected+'T12:00:00')));
  openMensualTareaSheet(null, monday, diaVistaSelected);
}

// ── PERSONAL · CASA (calendario mensual de tareas del hogar, tipo bullet journal) ──
const CASA_FREQ_COLOR={diario:'var(--red)',semanal:'var(--green)',quincenal:'var(--peach)',necesidad:'var(--gray)'};
const CASA_FREQ_COLOR_LIGHT={diario:'var(--red-light)',semanal:'var(--green-light)',quincenal:'var(--peach-light)',necesidad:'var(--gray-light)'};
const CASA_FREQ_LABEL={diario:'Diario',semanal:'Cada semana',quincenal:'Cada 2 semanas',necesidad:'Según necesidad'};

function getCasaTareasOrdenadas(){
  return Object.values(state.casaTareas||{}).sort((a,b)=>(a.createdAt||0)-(b.createdAt||0));
}

// ¿Toca esta tarea la semana en la que cae "dateObj"? No importa el día concreto de la semana,
// solo si esa semana del mes está marcada como activa (o si es diario/según-necesidad).
function casaEsDiaProgramado(t, dateObj){
  if(t.frecuencia==='diario') return true;
  if(t.frecuencia==='necesidad') return false;
  const semanaNum=Math.ceil(dateObj.getDate()/7); // semana 1-5 del mes, aproximada por bloques de 7 días
  return t.semanasActivas ? (t.semanasActivas[semanaNum]!==false) : true;
}

function casaNav(dir){
  casaBaseDate.setMonth(casaBaseDate.getMonth()+dir);
  casaBaseDate=new Date(casaBaseDate);
  renderCasa();
}

// Marcar/desmarcar que una tarea se hizo un día concreto (independiente de si "tocaba" o no ese día)
function toggleCasaDia(choreId, key){
  const hecho=!!(state.casaHecho?.[choreId]?.[key]);
  DB.update(`refugio2/casaHecho/${choreId}`,{[key]:!hecho});
}

function renderCasa(){
  const area=document.getElementById('casa-area'); if(!area) return;
  const y=casaBaseDate.getFullYear(), m=casaBaseDate.getMonth();
  const monthTxt=casaBaseDate.toLocaleDateString('es-ES',{month:'long',year:'numeric'});
  const days=new Date(y,m+1,0).getDate();
  const tareas=getCasaTareasOrdenadas();

  let html=`<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
    <button class="cal-nav-btn" onclick="casaNav(-1)">‹</button>
    <div class="cal-nav-title">${monthTxt.charAt(0).toUpperCase()+monthTxt.slice(1)}</div>
    <button class="cal-nav-btn" onclick="casaNav(1)">›</button>
  </div>
  <div class="casa-legend">
    ${Object.keys(CASA_FREQ_LABEL).map(k=>`<div class="casa-legend-item"><span class="casa-legend-dot" style="background:${CASA_FREQ_COLOR[k]};"></span>${CASA_FREQ_LABEL[k]}</div>`).join('')}
  </div>`;

  if(!tareas.length){
    html+=`<div class="empty-state"><div class="empty-icon">🏡</div><p>Sin tareas de casa todavía.<br>Pulsa "+ Tarea" para añadir la primera.</p></div>`;
    area.innerHTML=html;
    return;
  }

  html+=`<div class="casa-table-wrap"><table class="casa-table"><thead><tr>
    <th class="casa-th-name">Tarea</th>
    ${Array.from({length:days},(_,i)=>`<th>${i+1}</th>`).join('')}
  </tr></thead><tbody>
    ${tareas.map(t=>{
      const color=CASA_FREQ_COLOR[t.frecuencia]||'var(--lav)';
      const colorLight=CASA_FREQ_COLOR_LIGHT[t.frecuencia]||'var(--lav-light)';
      return `<tr>
        <td class="casa-th-name" onclick="openCasaTareaSheet('${t.id}')"><span class="casa-legend-dot" style="background:${color};display:inline-block;margin-right:6px;vertical-align:middle;"></span>${t.nombre}</td>
        ${Array.from({length:days},(_,i)=>{
          const d=i+1;
          const dateObj=new Date(y,m,d);
          const key=localKey(dateObj);
          const programado=casaEsDiaProgramado(t,dateObj);
          const hecho=!!(state.casaHecho?.[t.id]?.[key]);
          return `<td style="${programado?`background:${colorLight};`:''}"><div class="casa-dot ${programado?'scheduled':''} ${hecho?'done':''}" style="--dot-color:${color};" onclick="toggleCasaDia('${t.id}','${key}')"></div></td>`;
        }).join('')}
      </tr>`;
    }).join('')}
  </tbody></table></div>
  <div style="font-size:11px;color:var(--text-muted);margin-top:10px;text-align:center;">La franja de color marca las semanas que te tocan. Toca cualquier círculo para marcar el día (o días) que la haces. Toca el nombre para editarla.</div>`;

  area.innerHTML=html;
}

function renderCasaSemanasChips(){
  const c=document.getElementById('casa-semanas-chips'); if(!c) return;
  const frec=document.getElementById('casa-tarea-frecuencia')?.value;
  const color=CASA_FREQ_COLOR[frec]||'var(--lav)';
  c.innerHTML=[1,2,3,4,5].map(n=>`<button type="button" class="week-toggle-chip ${editingSemanasActivas[n]!==false?'active':''}" style="--dot-color:${color};" onclick="toggleCasaSemanaActiva(${n})">S${n}</button>`).join('');
}
function toggleCasaSemanaActiva(n){
  editingSemanasActivas[n]=editingSemanasActivas[n]===false ? true : false;
  renderCasaSemanasChips();
}
function toggleCasaFrecuenciaCampos(){
  const frec=document.getElementById('casa-tarea-frecuencia').value;
  const necesitaSemanas = frec==='semanal'||frec==='quincenal';
  const semanasGroup=document.getElementById('casa-tarea-semanas-group');
  if(semanasGroup) semanasGroup.style.display = necesitaSemanas?'block':'none';
  renderCasaSemanasChips();
}

function openCasaTareaSheet(id){
  const t=id?state.casaTareas[id]:null;
  const isNew=!t;
  document.getElementById('casa-tarea-id').value=t?.id||'';
  document.getElementById('casa-tarea-nombre').value=t?.nombre||'';
  document.getElementById('casa-tarea-frecuencia').value=t?.frecuencia||'semanal';
  editingSemanasActivas = t?.semanasActivas ? {...t.semanasActivas} : (t?.frecuencia==='quincenal' || (isNew && document.getElementById('casa-tarea-frecuencia').value==='quincenal')
    ? {1:true,2:false,3:true,4:false,5:true} : {1:true,2:true,3:true,4:true,5:true});
  toggleCasaFrecuenciaCampos();
  document.getElementById('casa-tarea-sheet-title').textContent=isNew?'Nueva tarea de casa':'Editar tarea de casa';
  document.getElementById('casa-tarea-delete-btn').style.display=isNew?'none':'block';
  document.getElementById('casa-tarea-sheet').classList.add('open');
}
function closeCasaTareaSheet(){document.getElementById('casa-tarea-sheet').classList.remove('open');}
function saveCasaTarea(){
  const nombre=document.getElementById('casa-tarea-nombre').value.trim();
  if(!nombre){showToast('Escribe el nombre');return;}
  const id=document.getElementById('casa-tarea-id').value||Date.now().toString();
  const data={
    id, nombre,
    frecuencia:document.getElementById('casa-tarea-frecuencia').value,
    semanasActivas:{...editingSemanasActivas},
    createdAt:state.casaTareas[id]?.createdAt||Date.now()
  };
  DB.set(`refugio2/casaTareas/${id}`,data).then(()=>{closeCasaTareaSheet();showToast('Guardado ✓');});
}
function deleteCasaTarea(){
  const id=document.getElementById('casa-tarea-id').value;
  if(!id||!confirm('¿Eliminar esta tarea de casa?'))return;
  DB.remove(`refugio2/casaTareas/${id}`).then(()=>{
    DB.remove(`refugio2/casaHecho/${id}`);
    closeCasaTareaSheet();
    showToast('Eliminada');
  });
}

// ── PERSONAL · OTRAS TAREAS Y PLANES (calendario mensual + ánimo del día) ──
function getOtrasTareasPorDia(key){
  return Object.values(state.otrasTareas||{}).filter(t=>t.fecha===key)
    .sort((a,b)=>(a.hora||'zz').localeCompare(b.hora||'zz') || (a.createdAt||0)-(b.createdAt||0));
}

function otrasCalNav(dir){
  otrasCalMonth.setMonth(otrasCalMonth.getMonth()+dir);
  otrasCalMonth=new Date(otrasCalMonth);
  renderOtras();
}

function renderOtras(){
  const area=document.getElementById('otras-area'); if(!area) return;
  const y=otrasCalMonth.getFullYear(), m=otrasCalMonth.getMonth();
  const monthTxt=otrasCalMonth.toLocaleDateString('es-ES',{month:'long',year:'numeric'});
  const firstDay=(new Date(y,m,1).getDay()+6)%7;
  const days=new Date(y,m+1,0).getDate();
  const today=todayKey();

  let grid=['L','M','X','J','V','S','D'].map(d=>`<div class="cal-day-label">${d}</div>`).join('');
  for(let i=0;i<firstDay;i++) grid+=`<div class="cal-day empty"></div>`;
  for(let d=1;d<=days;d++){
    const key=`${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const isToday=key===today, isSel=key===otrasDiaSel;
    const mood=state.otrasAnimo?.[key];
    const items=getOtrasTareasPorDia(key);
    const maxNombres = mood ? 1 : 2;
    let cellStyle='';
    if(mood) cellStyle+=`background:${mood.color};`;
    if(isSel) cellStyle+=`box-shadow:inset 0 0 0 2.5px ${mood?'white':'var(--pink)'};`;
    else if(isToday) cellStyle+=`box-shadow:inset 0 0 0 2px ${mood?'white':'var(--lav)'};`;
    grid+=`<div class="cal-day" style="${cellStyle}" onclick="selectOtrasDia('${key}')">
      <div class="cal-day-num" style="${mood?'color:white;':''}">${d}</div>
      ${mood?`<div style="font-size:12px;line-height:1;margin-top:1px;">${mood.emoji}</div>`:''}
      ${items.slice(0,maxNombres).map(t=>`<div class="cal-day-item ${mood?'on-color':''}">${t.done?'✓ ':''}${t.nombre}</div>`).join('')}
      ${items.length>maxNombres?`<div class="cal-day-more ${mood?'on-color':''}">+${items.length-maxNombres}</div>`:''}
    </div>`;
  }

  const html=`<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
    <button class="cal-nav-btn" onclick="otrasCalNav(-1)">‹</button>
    <div class="cal-nav-title">${monthTxt.charAt(0).toUpperCase()+monthTxt.slice(1)}</div>
    <button class="cal-nav-btn" onclick="otrasCalNav(1)">›</button>
  </div>
  <div class="cal-grid">${grid}</div>
  <div style="font-size:11px;color:var(--text-muted);margin-top:6px;text-align:center;">Toca un día para apuntar planes o marcar cómo te sientes.</div>`;

  area.innerHTML=html;
  renderOtrasDiaPanel();
}

// Panel del día seleccionado (siempre visible al lado del calendario, sin sheet)
function renderOtrasDiaPanel(){
  const titulo=document.getElementById('otras-dia-titulo'); if(!titulo) return;
  const d=new Date(otrasDiaSel+'T12:00:00');
  const txt=d.toLocaleDateString('es-ES',{weekday:'long',day:'numeric',month:'long'});
  titulo.textContent=txt.charAt(0).toUpperCase()+txt.slice(1);
  renderOtrasMoodChips();
  renderOtrasDiaTareas();
}
function selectOtrasDia(key){
  otrasDiaSel=key;
  const input=document.getElementById('otras-tarea-nueva'); if(input) input.value='';
  const hora=document.getElementById('otras-tarea-hora'); if(hora) hora.value='';
  renderOtras();
}

function renderOtrasMoodChips(){
  const c=document.getElementById('otras-mood-chips'); if(!c) return;
  const actual=state.otrasAnimo?.[otrasDiaSel];
  c.innerHTML=MOOD_OPTIONS.map(mo=>{
    const isActive=actual&&actual.emoji===mo.emoji;
    return `<button type="button" title="${mo.label}" onclick="setOtrasAnimo('${mo.emoji}','${mo.color}')" style="font-size:22px;line-height:1;padding:7px 9px;border-radius:10px;border:2px solid ${isActive?mo.color:'var(--border)'};background:${isActive?mo.color:'var(--surface)'};cursor:pointer;">${mo.emoji}</button>`;
  }).join('');
}
function setOtrasAnimo(emoji,color){
  const actual=state.otrasAnimo?.[otrasDiaSel];
  if(actual && actual.emoji===emoji){
    DB.remove(`refugio2/otrasAnimo/${otrasDiaSel}`).then(renderOtrasMoodChips);
  } else {
    DB.set(`refugio2/otrasAnimo/${otrasDiaSel}`,{emoji,color}).then(renderOtrasMoodChips);
  }
}

function renderOtrasDiaTareas(){
  const c=document.getElementById('otras-dia-tareas-list'); if(!c) return;
  const items=getOtrasTareasPorDia(otrasDiaSel);
  const checkSvg=`<svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M1.5 5.5L4 8L9.5 2.5" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  c.innerHTML = items.length ? items.map(t=>`
    <div class="check-item">
      <div class="check-box ${t.done?'checked':''}" onclick="toggleOtrasTarea('${t.id}')">${checkSvg}</div>
      <span class="check-label ${t.done?'done':''}" style="flex:1;">${t.nombre}${t.hora?` <span style="color:var(--pink);font-weight:700;font-size:11px;">${t.hora}</span>`:''}</span>
      <button class="remove-btn" onclick="deleteOtrasTarea('${t.id}')">×</button>
    </div>`).join('') : `<div style="font-size:13px;color:var(--text-muted);padding:8px 0;">Nada apuntado este día todavía.</div>`;
}
function addOtrasTarea(){
  const input=document.getElementById('otras-tarea-nueva');
  const nombre=input.value.trim();
  if(!nombre){showToast('Escribe algo primero');return;}
  const hora=document.getElementById('otras-tarea-hora').value||'';
  const id='ot'+Date.now()+Math.random().toString(36).slice(2,6);
  DB.set(`refugio2/otrasTareas/${id}`,{id,nombre,hora,fecha:otrasDiaSel,done:false,createdAt:Date.now()}).then(()=>{
    input.value=''; document.getElementById('otras-tarea-hora').value=''; input.focus();
  });
}
function toggleOtrasTarea(id){
  const t=state.otrasTareas[id]; if(!t) return;
  DB.update(`refugio2/otrasTareas/${id}`,{done:!t.done});
}
function deleteOtrasTarea(id){
  DB.remove(`refugio2/otrasTareas/${id}`);
}

// ── PERSONAL · BRAIN DUMP (volcado libre de la cabeza, sin fechas ni estructura) ──
function renderDump(){
  const area=document.getElementById('dump-area'); if(!area) return;
  const items=Object.values(state.brainDump||{}).sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));

  let html=`<div style="display:flex;gap:8px;margin-bottom:16px;">
    <input class="input-field" id="dump-input" placeholder="Suelta lo que tengas en la cabeza, sin filtro..." style="flex:1;" onkeydown="if(event.key==='Enter')addBrainDump()">
    <button class="remove-btn" style="color:var(--teal);border-color:var(--teal);font-size:20px;" onclick="addBrainDump()">+</button>
  </div>`;

  if(!items.length){
    html+=`<div class="empty-state"><div class="empty-icon">🧠</div><p>Nada por aquí todavía.<br>Escribe lo que se te pase por la cabeza, tal cual.</p></div>`;
  } else {
    html+=`<div class="card">${items.map(it=>`
      <div class="check-item" style="cursor:default;">
        <span class="check-label" style="flex:1;">${it.text}</span>
        <button class="remove-btn" onclick="deleteBrainDump('${it.id}')">×</button>
      </div>`).join('')}</div>
      <button class="btn-ghost" style="margin-top:12px;color:var(--red);" onclick="clearBrainDump()">🗑️ Vaciar todo</button>`;
  }

  area.innerHTML=html;
}
function addBrainDump(){
  const input=document.getElementById('dump-input');
  const text=input.value.trim();
  if(!text) return;
  const id='bd'+Date.now()+Math.random().toString(36).slice(2,6);
  DB.set(`refugio2/brainDump/${id}`,{id,text,createdAt:Date.now()}).then(()=>{input.value='';input.focus();});
}
function deleteBrainDump(id){
  DB.remove(`refugio2/brainDump/${id}`);
}
function clearBrainDump(){
  if(!confirm('¿Vaciar todo el brain dump? No se puede deshacer.'))return;
  DB.remove('refugio2/brainDump').then(()=>showToast('Vaciado ✓'));
}

// ── FORMACIONES MSM ──
// Lista siempre ordenada por caducidad: de la más cercana a la más lejana
function getFormacionesSorted(){
  return Object.values(state.formaciones).sort((a,b)=>(a.caducidad||'').localeCompare(b.caducidad||''));
}

function renderFormaciones(){
  const area=document.getElementById('formaciones-area'); if(!area) return;
  const list=getFormacionesSorted();
  if(!list.length){area.innerHTML=`<div class="empty-state"><div class="empty-icon">🎓</div><p>Sin personas todavía.<br>Pulsa "+ Persona" para añadir la primera.</p></div>`;return;}
  area.innerHTML=list.map(p=>{
    const est=wlEstadoColor(p.caducidad);
    return `<div style="background:${est.bg};border:1.5px solid ${est.border};border-radius:var(--radius);padding:14px 16px;margin-bottom:10px;">
      <div style="display:flex;align-items:center;gap:10px;cursor:pointer;" onclick="openFormacionSheet('${p.id}')">
        <span style="flex:1;min-width:0;font-size:15px;font-weight:700;">${p.name}</span>
        <span style="font-size:12px;font-weight:700;color:${est.color};white-space:nowrap;">${est.label}</span>
      </div>
      <div style="font-size:12px;color:var(--text-muted);margin-top:4px;cursor:pointer;" onclick="openFormacionSheet('${p.id}')">${p.departamento?p.departamento+' · ':''}Caduca: ${p.caducidad||'sin fecha'}</div>
      <div style="margin-top:10px;">
        <button class="btn-sm-lav" onclick="event.stopPropagation();openFormacionRealizarSheet('${p.id}')">✅ Marcar como realizado</button>
      </div>
    </div>`;
  }).join('');
}

function openFormacionSheet(id){
  const p=id?state.formaciones[id]:null;
  const isNew=!p;
  document.getElementById('formacion-id').value=p?.id||'';
  document.getElementById('formacion-name').value=p?.name||'';
  document.getElementById('formacion-dept').value=p?.departamento||'';
  document.getElementById('formacion-caducidad').value=p?.caducidad||'';
  document.getElementById('formacion-sheet-title').textContent=isNew?'Nueva persona':'Editar persona';
  document.getElementById('formacion-delete-btn').style.display=isNew?'none':'block';
  document.getElementById('formacion-sheet').classList.add('open');
}
function closeFormacionSheet(){document.getElementById('formacion-sheet').classList.remove('open');}
function saveFormacion(){
  const name=document.getElementById('formacion-name').value.trim();
  if(!name){showToast('Escribe el nombre');return;}
  const id=document.getElementById('formacion-id').value||Date.now().toString();
  const data={
    id, name,
    departamento:document.getElementById('formacion-dept').value.trim(),
    caducidad:document.getElementById('formacion-caducidad').value||'',
    ultimaRealizacion:state.formaciones[id]?.ultimaRealizacion||'',
    createdAt:state.formaciones[id]?.createdAt||Date.now()
  };
  DB.set(`refugio2/formaciones/${id}`,data).then(()=>{closeFormacionSheet();showToast('Guardado ✓');});
}
function deleteFormacion(){
  const id=document.getElementById('formacion-id').value;
  if(!id||!confirm('¿Eliminar a esta persona?'))return;
  DB.remove(`refugio2/formaciones/${id}`).then(()=>{closeFormacionSheet();showToast('Eliminada');});
}

// Marcar curso como realizado → pide la fecha y recalcula la caducidad (+2 años)
function openFormacionRealizarSheet(id){
  document.getElementById('formacion-realizar-id').value=id;
  document.getElementById('formacion-realizar-fecha').value=todayKey();
  document.getElementById('formacion-realizar-sheet').classList.add('open');
}
function closeFormacionRealizarSheet(){document.getElementById('formacion-realizar-sheet').classList.remove('open');}
function confirmFormacionRealizada(){
  const id=document.getElementById('formacion-realizar-id').value;
  const fecha=document.getElementById('formacion-realizar-fecha').value;
  if(!fecha){showToast('Selecciona una fecha');return;}
  const d=new Date(fecha+'T12:00:00'); d.setFullYear(d.getFullYear()+2);
  const nuevaCaducidad=localKey(d);
  DB.update(`refugio2/formaciones/${id}`,{caducidad:nuevaCaducidad, ultimaRealizacion:fecha}).then(()=>{
    closeFormacionRealizarSheet();
    showToast('Curso registrado ✓ Nueva caducidad: '+nuevaCaducidad, 3000);
  });
}

// Personas cuyo MSM caduca este mes o el siguiente (para avisar con tiempo)
function getFormacionesProximas(){
  const now=new Date();
  const y=now.getFullYear(), m=now.getMonth();
  const startKey=`${y}-${String(m+1).padStart(2,'0')}-01`;
  const endDate=new Date(y,m+2,0);
  const endKey=localKey(endDate);
  return Object.values(state.formaciones||{})
    .filter(p=>p.caducidad && p.caducidad>=startKey && p.caducidad<=endKey)
    .sort((a,b)=>(a.caducidad||'').localeCompare(b.caducidad||''));
}

// ── FORMACIONES MSM · MAILS DE AVISO ──
function formatFechaEs(iso){
  if(!iso) return '';
  const [y,m,d]=iso.split('-');
  return `${d}/${m}/${y}`;
}

function esTCPoFlightCrew(dep){
  const d=(dep||'').toLowerCase();
  return d.includes('tcp') || d.includes('flight crew');
}

// Personas con caducidad de este mes, el siguiente, o anteriores (caducadas incluidas, por si hay alguna pendiente de una baja etc.)
function getFormacionesParaAvisar(){
  const now=new Date();
  const endKey=localKey(new Date(now.getFullYear(), now.getMonth()+2, 0));
  return getFormacionesSorted().filter(p=>p.caducidad && p.caducidad<=endKey);
}

function buildFormacionMailHTML(tipo){
  const personas=getFormacionesParaAvisar().filter(p=>esTCPoFlightCrew(p.departamento)===(tipo==='tcpfc'));
  const items = personas.length
    ? personas.map(p=>`<li>${p.name} – ${formatFechaEs(p.caducidad)}</li>`).join('')
    : `<li>(nadie en este grupo este mes)</li>`;
  const extraTCP = tipo==='tcpfc'
    ? ' A petición del Departamento de Crew Training, los tripulantes (FC y CC) llevan a cabo la formación en MSM Training de un modo controlado dentro de las actividades de los Cursos Periódicos y de Conversión.'
    : '';
  return `<p>Buenos días,</p>
<p>Recientemente habréis sido ya informados de modo automático a través de GladToLink (emails con Asunto: Important: Imminent training courses dues) de la fecha debida inminente de realización obligatoria del <b>MSM Training (incluye Test obligatorio a superar)</b>, que se ha de realizar cada 24 meses i.a.w. MSM 6.3.2 en vigor, para el personal detallado a continuación, el cual <u>deberá llevar a cabo a través de Albastar Moodle dicha formación <b>antes de la fecha debida correspondiente a continuación indicada</b></u>.</p>
<ul style="margin:8px 0 8px 20px;padding:0;">${items}</ul>
<p><u>Todos vosotros ya os encontráis matriculados en la plataforma Albastar Moodle hasta el día de vuestra fecha debida inclusive.${extraTCP}</u></p>
<p>NOTA.- Si alguna persona no tuviera acceso a Albastar Mooddle, o a este curso, deberá contactar con IT Support.</p>
<p>Saludos/Best Regards</p>`;
}

function openFormacionMailsSheet(){
  document.getElementById('formacion-mail-normal').innerHTML=buildFormacionMailHTML('normal');
  document.getElementById('formacion-mail-tcpfc').innerHTML=buildFormacionMailHTML('tcpfc');
  document.getElementById('formacion-mails-sheet').classList.add('open');
}
function closeFormacionMailsSheet(){document.getElementById('formacion-mails-sheet').classList.remove('open');}

function copyFormacionMail(tipo){
  const el=document.getElementById(tipo==='normal'?'formacion-mail-normal':'formacion-mail-tcpfc');
  if(!el) return;
  const html=el.innerHTML, text=el.innerText;
  try{
    if(navigator.clipboard && window.ClipboardItem){
      const item=new ClipboardItem({
        'text/html': new Blob([html], {type:'text/html'}),
        'text/plain': new Blob([text], {type:'text/plain'})
      });
      navigator.clipboard.write([item]).then(()=>showToast('Mail copiado ✓ (con formato)')).catch(()=>fallbackCopyFormacionMail(text));
    } else {
      fallbackCopyFormacionMail(text);
    }
  }catch(e){
    fallbackCopyFormacionMail(text);
  }
}
function fallbackCopyFormacionMail(text){
  const ta=document.createElement('textarea');
  ta.value=text; ta.style.position='fixed'; ta.style.opacity='0';
  document.body.appendChild(ta); ta.focus(); ta.select();
  try{ document.execCommand('copy'); showToast('Mail copiado ✓'); }
  catch(e){ showToast('No se pudo copiar, selecciona el texto manualmente'); }
  document.body.removeChild(ta);
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
    if(h===hour&&m===min){const k=`notif_${key}_${now.toISOString().slice(0,10)}`;if(!localStorage.getItem(k)){localStorage.setItem(k,'1');new Notification('Mi organizador',{body:msg,icon:'/mi-refugio/icon-192.png'});}}
  });
}
function startNotifCheck(){setInterval(checkAndSendNotif,60000);}

// ── TOAST ──
function showToast(msg,d=2000){
  const t=document.getElementById('toast'); if(!t) return;
  t.textContent=msg;t.style.opacity='1';t.style.transform='translateX(-50%) translateY(0)';
  clearTimeout(t._t);t._t=setTimeout(()=>{t.style.opacity='0';t.style.transform='translateX(-50%) translateY(20px)';},d);
}
