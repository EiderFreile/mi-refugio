// ═══════════════════════════════════════
//  MI REFUGIO v3 — app.js
// ═══════════════════════════════════════

const COLORS = [
  {id:'lav',    hex:'#EDE9F8', dot:'#9B8EC4'},
  {id:'yellow', hex:'#FEF9C3', dot:'#CA8A04'},
  {id:'green',  hex:'#DCFCE7', dot:'#16A34A'},
  {id:'pink',   hex:'#FCE7F3', dot:'#DB2777'},
  {id:'blue',   hex:'#DBEAFE', dot:'#2563EB'},
  {id:'peach',  hex:'#FFEDD5', dot:'#EA580C'},
  {id:'gray',   hex:'#F3F4F6', dot:'#6B7280'},
];

const DAY_TABS = [
  {id:'inicio',  ico:'🏠', lbl:'Inicio'},
  {id:'listas',  ico:'✅', lbl:'Listas'},
  {id:'notas',   ico:'📝', lbl:'Notas'},
  {id:'gastos',  ico:'💰', lbl:'Gastos'},
];

const WORK_TABS = [
  {id:'hoy',       ico:'☀️',  lbl:'Hoy'},
  {id:'tareas',    ico:'✅',  lbl:'Tareas'},
  {id:'agenda',    ico:'📅',  lbl:'Agenda'},
  {id:'reuniones', ico:'📝',  lbl:'Reuniones'},
  {id:'recordar',  ico:'🧠',  lbl:'Recordar'},
];

let state = {
  mode: localStorage.getItem('mode') || 'day',
  tab: 'inicio',
  darkMode: localStorage.getItem('darkMode') === 'true',
  checklists: {}, progress: {}, weekProgress: {},
  notes: {},
  gastos: {}, gastosWeek: {}, categorias: {}, budget: parseFloat(localStorage.getItem('budget') || '0'),
  tareas: {}, agenda: {}, reuniones: {}, recordar: {},
};

let clColor = COLORS[0].id, noteColor = COLORS[1].id;
let clItems = [], reunionActions = [];

// ── Init ──
document.addEventListener('DOMContentLoaded', () => {
  if (state.darkMode) document.body.classList.add('dark');
  setupModePills();
  initListeners();
  renderNav();
  renderGreeting();
  renderSettings();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(()=>{});
  if (typeof Notification !== 'undefined' && Notification.permission === 'granted') startNotifCheck();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') { renderGreeting(); checkAndSendNotif(); }
  });
  // Restore mode
  if (state.mode === 'work') {
    document.getElementById('pill-day').classList.remove('active');
    document.getElementById('pill-work').classList.add('active');
    state.tab = 'hoy';
    renderNav();
    navigateTo('hoy');
  } else {
    navigateTo('inicio');
  }
});

// ── Firebase ──
function initListeners() {
  const t = todayKey(), w = weekKey();
  DB.listen('refugio2/checklists', d => { state.checklists = d||{}; renderChecklistsHome(); renderChecklistsList(); });
  DB.listen(`refugio2/progress/${t}`, d => { state.progress = d||{}; renderChecklistsHome(); });
  DB.listen(`refugio2/progress/week_${w}`, d => { state.weekProgress = d||{}; renderChecklistsHome(); });
  DB.listen('refugio2/notes', d => { state.notes = d||{}; renderNotes(); renderNotesHome(); });
  DB.listen('refugio2/categorias', d => { state.categorias = d||{}; });
  DB.listen(`refugio2/gastos/${t}`, d => { state.gastos = d||{}; renderGastos(); renderGastosHome(); });
  DB.listen('refugio2/gastos', d => { state.gastosWeek = d||{}; renderGastos(); });
  DB.listen('refugio2/tareas', d => { state.tareas = d||{}; renderTareas(); renderHoy(); });
  DB.listen('refugio2/agenda', d => { state.agenda = d||{}; renderAgenda(); renderHoy(); });
  DB.listen('refugio2/reuniones', d => { state.reuniones = d||{}; renderReuniones(); });
  DB.listen('refugio2/recordar', d => { state.recordar = d||{}; renderRecordar(); });
}

// ── Mode ──
function setupModePills() {
  document.getElementById('pill-day').addEventListener('click', () => setMode('day'));
  document.getElementById('pill-work').addEventListener('click', () => setMode('work'));
}

function setMode(mode) {
  state.mode = mode;
  localStorage.setItem('mode', mode);
  document.getElementById('pill-day').classList.toggle('active', mode === 'day');
  document.getElementById('pill-work').classList.toggle('active', mode === 'work');
  const firstTab = mode === 'day' ? 'inicio' : 'hoy';
  state.tab = firstTab;
  renderNav();
  navigateTo(firstTab);
}

// ── Nav ──
function renderNav() {
  const tabs = state.mode === 'day' ? DAY_TABS : WORK_TABS;
  const nav = document.getElementById('bottom-nav');
  nav.innerHTML = tabs.map(t => `
    <button class="nav-btn ${state.tab === t.id ? 'active' : ''}" onclick="navigateTo('${t.id}')">
      <div class="nav-icon">${t.ico}</div>
      <div class="nav-label">${t.lbl}</div>
    </button>`).join('');
  // Settings button
  nav.innerHTML += `<button class="nav-btn ${state.tab === 'ajustes' ? 'active' : ''}" onclick="navigateTo('ajustes')">
    <div class="nav-icon">⚙️</div>
    <div class="nav-label">Ajustes</div>
  </button>`;
}

function navigateTo(tab) {
  state.tab = tab;
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('screen-' + tab)?.classList.add('active');
  renderNav();
  const fab = document.getElementById('fab');
  const fabTabs = ['listas','notas','gastos','tareas','agenda','reuniones','recordar'];
  fab.style.display = fabTabs.includes(tab) ? 'flex' : 'none';
  if (!fab._set) {
    fab.addEventListener('click', () => {
      const actions = {
        listas: () => openCLSheet(null),
        notas: () => openNoteSheet(null),
        gastos: () => openGastoSheet(null),
        tareas: () => openTareaSheet(null),
        agenda: () => openAgendaSheet(null),
        reuniones: () => openReunionSheet(null),
        recordar: () => openRecordarSheet(null),
      };
      actions[state.tab]?.();
    });
    fab._set = true;
  }
}

// ── Greeting ──
function renderGreeting() {
  const h = new Date().getHours();
  const g = h < 13 ? 'Buenos días' : h < 20 ? 'Buenas tardes' : 'Buenas noches';
  const el = document.getElementById('greeting'); if (el) el.textContent = g;
  const dl = document.getElementById('date-label');
  if (dl) dl.textContent = new Date().toLocaleDateString('es-ES', {weekday:'long',day:'numeric',month:'long'});
}

// ── Color picker ──
function renderColorPicker(id, selected) {
  const el = document.getElementById(id); if (!el) return;
  el.innerHTML = COLORS.map(c => `
    <div class="color-dot ${c.id===selected?'selected':''}" style="background:${c.dot};"
      onclick="selectColor('${id}','${c.id}')"></div>`).join('');
}

function selectColor(pickerId, colorId) {
  if (pickerId === 'cl-color-picker') clColor = colorId;
  if (pickerId === 'note-color-picker') noteColor = colorId;
  renderColorPicker(pickerId, colorId);
}

// ── Progress ring ──
function ring(done, total) {
  const pct = total ? done/total : 0;
  const r = 12, circ = 2*Math.PI*r;
  const offset = circ*(1-pct);
  return `<svg class="progress-ring" viewBox="0 0 32 32">
    <circle class="ring-bg" cx="16" cy="16" r="${r}"/>
    <circle class="ring-fill" cx="16" cy="16" r="${r}" stroke="${pct===1?'#4CAF50':'#9B8EC4'}"
      stroke-dasharray="${circ}" stroke-dashoffset="${offset}" transform="rotate(-90 16 16)"/>
    <text x="16" y="20" text-anchor="middle" font-size="9" font-weight="700"
      fill="var(--text-soft)" font-family="Plus Jakarta Sans,sans-serif">${done}/${total}</text>
  </svg>`;
}

// ── CHECKLISTS ──
function shouldShow(cl) {
  const f = cl.frecuencia||'daily';
  if (f==='daily'||f==='weekly') return true;
  const days = parseInt(f);
  if (!isNaN(days)) {
    const diff = Math.floor((Date.now()-new Date(cl.createdAt||Date.now()).getTime())/86400000);
    return diff%days===0;
  }
  return true;
}

function getOpenIds() {
  const s = new Set();
  document.querySelectorAll('.cl-items.open').forEach(el => s.add(el.id.replace('cli-','')));
  return s;
}

function clItemsHTML(cl) {
  const items = cl.items ? Object.values(cl.items) : [];
  const isW = cl.frecuencia==='weekly';
  const prog = isW ? (state.weekProgress?.[cl.id]||{}) : (state.progress?.[cl.id]||{});
  return items.map(it => {
    const checked = !!prog[it.id];
    return `<div class="check-item" onclick="event.stopPropagation();toggleItem('${cl.id}','${it.id}','${cl.frecuencia}')">
      <div class="check-box ${checked?'checked':''}">
        <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
          <path d="M1.5 5.5L4 8L9.5 2.5" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
      <span class="check-label ${checked?'done':''}">${it.text}</span>
    </div>`;
  }).join('');
}

function renderChecklistsHome() {
  const container = document.getElementById('checklists-home'); if (!container) return;
  const openIds = getOpenIds();
  const today = Object.values(state.checklists).filter(cl => shouldShow(cl));
  if (!today.length) { container.innerHTML = `<div class="empty-state"><div class="empty-icon">✅</div><p>Sin listas para hoy.<br>Ve a <strong>Listas</strong> para crear una.</p></div>`; return; }
  container.innerHTML = today.map(cl => {
    const items = cl.items ? Object.values(cl.items) : [];
    const isW = cl.frecuencia==='weekly';
    const prog = isW?(state.weekProgress?.[cl.id]||{}):(state.progress?.[cl.id]||{});
    const done = items.filter(it=>prog[it.id]).length;
    const dot = COLORS.find(c=>c.id===cl.color)?.dot||'#9B8EC4';
    const tag = isW?`<span style="font-size:10px;background:var(--lav-light);color:var(--lav);padding:2px 7px;border-radius:99px;font-weight:700;margin-left:6px;">Semanal</span>`:'';
    return `<div class="checklist-card">
      <div class="cl-header" onclick="toggleCL('${cl.id}')">
        <div class="cl-dot" style="background:${dot};"></div>
        <div class="cl-info"><div class="cl-name">${cl.name}${tag}</div><div class="cl-meta">${done}/${items.length} completados</div></div>
        <div>${ring(done,items.length)}</div>
      </div>
      <div class="cl-items ${openIds.has(cl.id)?'open':''}" id="cli-${cl.id}">${clItemsHTML(cl)}</div>
    </div>`;
  }).join('');
}

function toggleCL(id) { document.getElementById('cli-'+id)?.classList.toggle('open'); }

function toggleItem(clId, itemId, frecuencia) {
  const isW = frecuencia==='weekly';
  const key = isW?`week_${weekKey()}`:todayKey();
  const prog = isW?(state.weekProgress?.[clId]||{}):(state.progress?.[clId]||{});
  DB.update(`refugio2/progress/${key}/${clId}`, {[itemId]:!prog[itemId]});
}

function renderChecklistsList() {
  const container = document.getElementById('checklists-list'); if (!container) return;
  const all = Object.values(state.checklists);
  if (!all.length) { container.innerHTML = `<div class="empty-state"><div class="empty-icon">📋</div><p>Sin listas todavía.<br>Pulsa + para crear una.</p></div>`; return; }
  const freqLabel = f => f==='daily'?'Diaria':f==='weekly'?'Semanal':`Cada ${f} días`;
  container.innerHTML = all.map(cl => {
    const items = cl.items?Object.values(cl.items):[];
    const dot = COLORS.find(c=>c.id===cl.color)?.dot||'#9B8EC4';
    return `<div class="card" onclick="openCLSheet(${JSON.stringify(cl).replace(/"/g,'&quot;')})" style="padding:14px 16px;display:flex;align-items:center;gap:12px;cursor:pointer;">
      <div class="cl-dot" style="background:${dot};"></div>
      <div style="flex:1;"><div style="font-size:15px;font-weight:600;">${cl.name}</div><div style="font-size:12px;color:var(--text-muted);margin-top:2px;">${freqLabel(cl.frecuencia)} · ${items.length} items</div></div>
      <span style="color:var(--text-muted);font-size:16px;">›</span>
    </div>`;
  }).join('');
}

function openCLSheet(cl) {
  const isNew = !cl;
  document.getElementById('cl-id').value    = cl?.id||'';
  document.getElementById('cl-name').value  = cl?.name||'';
  document.getElementById('cl-freq').value  = cl?.frecuencia||'daily';
  document.getElementById('cl-sheet-title').textContent = isNew?'Nueva lista':'Editar lista';
  document.getElementById('cl-delete-btn').style.display = isNew?'none':'block';
  clColor = cl?.color||COLORS[0].id;
  renderColorPicker('cl-color-picker', clColor);
  clItems = cl?.items ? Object.values(cl.items).map(i=>({...i})) : [];
  renderCLItems();
  document.getElementById('cl-sheet').classList.add('open');
}
function closeCLSheet() { document.getElementById('cl-sheet').classList.remove('open'); }

function renderCLItems() {
  document.getElementById('cl-items-container').innerHTML = clItems.map((item,i) => `
    <div class="item-row">
      <input class="input-field" value="${item.text||''}" placeholder="Nombre del item" oninput="clItems[${i}].text=this.value">
      <button class="remove-btn" onclick="clItems.splice(${i},1);renderCLItems()">×</button>
    </div>`).join('');
}
function addCLItem() { clItems.push({id:Date.now().toString(),text:''}); renderCLItems(); document.querySelectorAll('#cl-items-container .input-field').forEach((el,i,arr)=>{ if(i===arr.length-1) el.focus(); }); }

function saveCL() {
  const name = document.getElementById('cl-name').value.trim();
  if (!name) { showToast('Ponle un nombre a la lista'); return; }
  const items = clItems.filter(i=>i.text.trim());
  if (!items.length) { showToast('Añade al menos un item'); return; }
  const id = document.getElementById('cl-id').value||Date.now().toString();
  DB.set(`refugio2/checklists/${id}`, {id,name,color:clColor,frecuencia:document.getElementById('cl-freq').value,createdAt:Date.now(),items:Object.fromEntries(items.map(i=>[i.id,{id:i.id,text:i.text.trim()}]))}).then(()=>{ closeCLSheet(); showToast('Lista guardada ✓'); });
}
function deleteCL() {
  const id = document.getElementById('cl-id').value;
  if (!id||!confirm('¿Eliminar esta lista?')) return;
  DB.remove(`refugio2/checklists/${id}`).then(()=>{ closeCLSheet(); showToast('Lista eliminada'); });
}

// ── NOTAS ──
function renderNotesHome() {
  const container = document.getElementById('notes-home'); if (!container) return;
  const notes = Object.values(state.notes).sort((a,b)=>b.createdAt-a.createdAt).slice(0,3);
  if (!notes.length) { container.innerHTML=''; return; }
  container.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin:18px 0 8px;">
      <div class="section-label" style="margin:0;">Notas recientes</div>
      <button onclick="navigateTo('notas')" style="font-size:12px;color:var(--lav);background:none;border:none;cursor:pointer;font-weight:700;">Ver todas →</button>
    </div>
    ${notes.map(n=>{ const bg=COLORS.find(c=>c.id===n.color)?.hex||COLORS[1].hex; const p=n.text.length>80?n.text.slice(0,80)+'...':n.text; return `<div onclick="openNoteSheet(${JSON.stringify(n).replace(/"/g,'&quot;')})" style="background:${bg};border-radius:12px;padding:12px 14px;margin-bottom:8px;cursor:pointer;font-size:13px;color:rgba(26,26,26,0.85);line-height:1.5;-webkit-tap-highlight-color:transparent;">${p}</div>`; }).join('')}`;
}

function renderNotes() {
  const area = document.querySelector('#screen-notas .scroll-area'); if (!area) return;
  const notes = Object.values(state.notes).sort((a,b)=>b.createdAt-a.createdAt);
  if (!notes.length) { area.innerHTML=`<div class="empty-state"><div class="empty-icon">📝</div><p>Sin notas todavía.<br>Pulsa + para añadir una.</p></div>`; return; }
  area.innerHTML = `<div class="notes-grid">${notes.map(n=>{ const bg=COLORS.find(c=>c.id===n.color)?.hex||COLORS[1].hex; const date=new Date(n.createdAt).toLocaleDateString('es-ES',{day:'numeric',month:'short'}); const p=n.text.length>100?n.text.slice(0,100)+'...':n.text; return `<div class="postit" style="background:${bg};" onclick="openNoteSheet(${JSON.stringify(n).replace(/"/g,'&quot;')})"><div class="postit-text">${p}</div><div class="postit-date">${date}</div></div>`; }).join('')}</div>`;
}

function openNoteSheet(note) {
  const isNew=!note;
  document.getElementById('note-id').value=note?.id||'';
  document.getElementById('note-text').value=note?.text||'';
  document.getElementById('note-sheet-title').textContent=isNew?'Nueva nota':'Editar nota';
  document.getElementById('note-delete-btn').style.display=isNew?'none':'block';
  noteColor=note?.color||COLORS[1].id;
  renderColorPicker('note-color-picker',noteColor);
  document.getElementById('note-sheet').classList.add('open');
}
function closeNoteSheet() { document.getElementById('note-sheet').classList.remove('open'); }
function saveNote() {
  const text=document.getElementById('note-text').value.trim();
  if (!text){showToast('Escribe algo');return;}
  const id=document.getElementById('note-id').value||Date.now().toString();
  DB.set(`refugio2/notes/${id}`,{id,text,color:noteColor,createdAt:state.notes[id]?.createdAt||Date.now()}).then(()=>{closeNoteSheet();showToast('Nota guardada ✓');});
}
function deleteNote() {
  const id=document.getElementById('note-id').value;
  if(!id||!confirm('¿Eliminar?'))return;
  DB.remove(`refugio2/notes/${id}`).then(()=>{closeNoteSheet();showToast('Nota eliminada');});
}

// ── GASTOS ──
function getCats() { return Object.values(state.categorias).length ? Object.values(state.categorias) : [{id:'otros',emoji:'💰',name:'Otros'}]; }

function renderGastosHome() {
  const container = document.getElementById('gastos-home'); if (!container) return;
  const gastos = Object.values(state.gastos).sort((a,b)=>b.ts-a.ts);
  if (!gastos.length && !state.budget) { container.innerHTML=''; return; }
  const total = gastos.reduce((s,g)=>s+g.amount,0);
  const budget = state.budget;
  const restante = budget ? budget-total : null;
  container.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin:18px 0 8px;">
      <div class="section-label" style="margin:0;">Gastos de hoy</div>
      <button onclick="navigateTo('gastos')" style="font-size:12px;color:var(--lav);background:none;border:none;cursor:pointer;font-weight:700;">Ver todo →</button>
    </div>
    <div class="gastos-stats">
      <div class="gasto-stat"><div class="gasto-num">${total.toFixed(2)}€</div><div class="gasto-label">Gastado</div></div>
      <div class="gasto-stat"><div class="gasto-num" style="color:${restante<0?'#E07070':'#4CAF50'}">${restante!==null?restante.toFixed(2)+'€':'—'}</div><div class="gasto-label">Restante</div></div>
      <div class="gasto-stat"><div class="gasto-num">${budget?Math.round((total/budget)*100)+'%':'—'}</div><div class="gasto-label">Usado</div></div>
    </div>`;
}

function renderGastos() {
  const area = document.querySelector('#screen-gastos .scroll-area'); if (!area) return;
  const gastos = Object.values(state.gastos).sort((a,b)=>b.ts-a.ts);
  const total = gastos.reduce((s,g)=>s+g.amount,0);
  const budget = state.budget;
  const restante = budget?budget-total:null;

  // Week bars
  const days=['L','M','X','J','V','S','D'];
  const today=new Date();
  const wd=(today.getDay()+6)%7;
  const weekTotals=Array(7).fill(0);
  const mondayDate=new Date(today);
  mondayDate.setDate(today.getDate()-wd);
  for(let i=0;i<7;i++){
    const d=new Date(mondayDate); d.setDate(mondayDate.getDate()+i);
    const key=d.toISOString().slice(0,10);
    const dayGastos=state.gastosWeek?.[key]||{};
    weekTotals[i]=Object.values(dayGastos).reduce((s,g)=>s+g.amount,0);
  }
  const maxW=Math.max(...weekTotals,1);

  area.innerHTML = `
    <div class="gastos-stats">
      <div class="gasto-stat"><div class="gasto-num">${total.toFixed(2)}€</div><div class="gasto-label">Hoy</div></div>
      <div class="gasto-stat"><div class="gasto-num" style="color:${restante<0?'#E07070':'#4CAF50'}">${restante!==null?restante.toFixed(2)+'€':'—'}</div><div class="gasto-label">Restante</div></div>
      <div class="gasto-stat" onclick="openBudgetSheet()" style="cursor:pointer;">
        <div class="gasto-num">${budget?budget+'€':'Fijar'}</div><div class="gasto-label">Presupuesto</div>
      </div>
    </div>
    <div class="section-label">Esta semana</div>
    <div class="card" style="padding:14px 16px;">
      <div class="week-bars">
        ${days.map((d,i)=>`<div class="week-bar-wrap">
          <div class="week-amt">${weekTotals[i]>0?weekTotals[i].toFixed(0)+'€':''}</div>
          <div class="week-bar ${i>wd?'future':''}" style="height:${Math.round((weekTotals[i]/maxW)*50)}px;"></div>
          <div class="week-day" style="color:${i===wd?'var(--lav)':'var(--text-muted)'}">${d}</div>
        </div>`).join('')}
      </div>
    </div>
    <div class="section-label">Gastos de hoy</div>
    ${gastos.length ? `<div class="card">${gastos.map(g=>{ const cat=getCats().find(c=>c.id===g.catId)||{emoji:'💰',name:'Otros'}; return `<div class="gasto-row" onclick="openGastoSheet(${JSON.stringify(g).replace(/"/g,'&quot;')})"><div class="gasto-emoji">${cat.emoji}</div><div class="gasto-info"><div class="gasto-cat">${cat.name}</div>${g.desc?`<div class="gasto-desc">${g.desc}</div>`:''}</div><div class="gasto-amount">${g.amount.toFixed(2)}€</div></div>`; }).join('')}</div>` : `<div class="empty-state" style="padding:24px;"><p>Sin gastos hoy. Pulsa + para añadir.</p></div>`}`;
}

function openGastoSheet(gasto) {
  const isNew=!gasto;
  document.getElementById('gasto-id').value=gasto?.id||'';
  document.getElementById('gasto-amount').value=gasto?.amount||'';
  document.getElementById('gasto-desc').value=gasto?.desc||'';
  document.getElementById('gasto-sheet-title').textContent=isNew?'Nuevo gasto':'Editar gasto';
  document.getElementById('gasto-delete-btn').style.display=isNew?'none':'block';
  const cats=getCats();
  document.getElementById('gasto-cat').innerHTML=cats.map(c=>`<option value="${c.id}" ${gasto?.catId===c.id?'selected':''}>${c.emoji} ${c.name}</option>`).join('');
  document.getElementById('gasto-sheet').classList.add('open');
}
function closeGastoSheet(){document.getElementById('gasto-sheet').classList.remove('open');}
function saveGasto(){
  const amount=parseFloat(document.getElementById('gasto-amount').value);
  if(!amount||isNaN(amount)){showToast('Introduce un importe');return;}
  const id=document.getElementById('gasto-id').value||Date.now().toString();
  const data={id,catId:document.getElementById('gasto-cat').value,amount,desc:document.getElementById('gasto-desc').value.trim(),ts:Date.now()};
  DB.set(`refugio2/gastos/${todayKey()}/${id}`,data).then(()=>{closeGastoSheet();showToast('Gasto guardado ✓');});
}
function deleteGasto(){
  const id=document.getElementById('gasto-id').value;
  if(!id||!confirm('¿Eliminar?'))return;
  DB.remove(`refugio2/gastos/${todayKey()}/${id}`).then(()=>{closeGastoSheet();showToast('Gasto eliminado');});
}

function openCatSheet(){
  renderCatList();
  document.getElementById('cat-sheet').classList.add('open');
}
function closeCatSheet(){document.getElementById('cat-sheet').classList.remove('open');}
function renderCatList(){
  const container=document.getElementById('cat-list');
  const cats=getCats();
  container.innerHTML=cats.map(c=>`<div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--border);">
    <span style="font-size:20px;">${c.emoji}</span>
    <span style="flex:1;font-size:14px;font-weight:500;">${c.name}</span>
    ${c.id!=='otros'?`<button onclick="deleteCat('${c.id}')" style="background:none;border:none;color:var(--text-muted);font-size:18px;cursor:pointer;">×</button>`:''}
  </div>`).join('');
}
function addCat(){
  const name=document.getElementById('cat-new-name').value.trim();
  const emoji=document.getElementById('cat-new-emoji').value.trim()||'💰';
  if(!name){showToast('Escribe un nombre');return;}
  const id=Date.now().toString();
  DB.set(`refugio2/categorias/${id}`,{id,name,emoji}).then(()=>{document.getElementById('cat-new-name').value='';document.getElementById('cat-new-emoji').value='';renderCatList();});
}
function deleteCat(id){
  if(!confirm('¿Eliminar esta categoría?'))return;
  DB.remove(`refugio2/categorias/${id}`).then(()=>renderCatList());
}

function openBudgetSheet(){
  document.getElementById('budget-amount').value=state.budget||'';
  document.getElementById('budget-sheet').classList.add('open');
}
function closeBudgetSheet(){document.getElementById('budget-sheet').classList.remove('open');}
function saveBudget(){
  const v=parseFloat(document.getElementById('budget-amount').value);
  if(!v||isNaN(v)){showToast('Introduce un importe');return;}
  state.budget=v;
  localStorage.setItem('budget',v);
  closeBudgetSheet();
  showToast('Presupuesto guardado ✓');
  renderGastos();
  renderGastosHome();
}

// ── TRABAJO: HOY ──
function renderHoy() {
  const area=document.getElementById('hoy-area'); if(!area) return;
  const today=todayKey();
  const todayAgenda=Object.values(state.agenda).filter(e=>e.date===today).sort((a,b)=>a.time?.localeCompare(b.time));
  const todayTareas=Object.values(state.tareas).filter(t=>t.hoy&&t.status!=='terminada').sort((a,b)=>{const p={alta:0,media:1,baja:2};return p[a.priority]-p[b.priority];});

  area.innerHTML=`
    ${todayAgenda.length?`<div class="section-label">Reuniones de hoy</div>${todayAgenda.map(e=>`
      <div class="agenda-item">
        <div class="agenda-time">${e.time||'·'}</div>
        <div class="agenda-card" onclick="openAgendaSheet(${JSON.stringify(e).replace(/"/g,'&quot;')})">
          <div class="agenda-name">${e.name}</div>
          ${e.notes?`<div class="agenda-sub">${e.notes}</div>`:''}
        </div>
      </div>`).join('')}`:''}
    <div class="section-label">Tareas prioritarias</div>
    ${todayTareas.length?`<div class="card">${todayTareas.map(t=>`
      <div class="check-item" onclick="toggleTareaHoy('${t.id}','${t.status}')">
        <div class="check-box"><svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M1.5 5.5L4 8L9.5 2.5" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
        <span class="check-label" style="flex:1;">${t.name}</span>
        <span class="tag tag-${t.priority==='alta'?'red':t.priority==='media'?'lav':'grn'}">${t.priority}</span>
      </div>`).join('')}</div>`:`<div style="padding:16px 0;color:var(--text-muted);font-size:14px;">Sin tareas para hoy. Añade desde Tareas ✅</div>`}`;
}

function toggleTareaHoy(id,status){
  const newStatus=status==='terminada'?'pendiente':'terminada';
  DB.update(`refugio2/tareas/${id}`,{status:newStatus});
}

// ── TRABAJO: TAREAS ──
function renderTareas(){
  const area=document.getElementById('tareas-area'); if(!area) return;
  const all=Object.values(state.tareas);
  if(!all.length){area.innerHTML=`<div class="empty-state"><div class="empty-icon">✅</div><p>Sin tareas todavía.<br>Pulsa + para añadir.</p></div>`;return;}
  const groups=[{key:'pendiente',label:'Pendientes'},{key:'en_curso',label:'En curso'},{key:'en_espera',label:'En espera'},{key:'terminada',label:'Terminadas'}];
  area.innerHTML=groups.map(g=>{
    const items=all.filter(t=>t.status===g.key).sort((a,b)=>{const p={alta:0,media:1,baja:2};return p[a.priority]-p[b.priority];});
    if(!items.length)return'';
    return`<div class="section-label">${g.label}</div>${items.map(t=>`
      <div class="task-card priority-${t.priority}" onclick="openTareaSheet(${JSON.stringify(t).replace(/"/g,'&quot;')})">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;">
          <div class="task-name" style="${t.status==='terminada'?'text-decoration:line-through;color:var(--text-muted)':''}">${t.name}</div>
          <span class="tag tag-${t.priority==='alta'?'red':t.priority==='media'?'lav':'grn'}">${t.priority}</span>
        </div>
        <div class="task-meta">
          ${t.date?`<span>📅 ${t.date}</span>`:''}
          ${t.hoy?`<span class="tag tag-lav">HOY</span>`:''}
        </div>
        ${t.notes?`<div style="font-size:12px;color:var(--text-muted);margin-top:6px;">${t.notes}</div>`:''}
      </div>`).join('')}`;
  }).join('');
}

function openTareaSheet(t){
  const isNew=!t;
  document.getElementById('tarea-id').value=t?.id||'';
  document.getElementById('tarea-name').value=t?.name||'';
  document.getElementById('tarea-priority').value=t?.priority||'media';
  document.getElementById('tarea-status').value=t?.status||'pendiente';
  document.getElementById('tarea-date').value=t?.date||'';
  document.getElementById('tarea-notes').value=t?.notes||'';
  document.getElementById('tarea-hoy').checked=!!t?.hoy;
  document.getElementById('tarea-sheet-title').textContent=isNew?'Nueva tarea':'Editar tarea';
  document.getElementById('tarea-delete-btn').style.display=isNew?'none':'block';
  document.getElementById('tarea-sheet').classList.add('open');
}
function closeTareaSheet(){document.getElementById('tarea-sheet').classList.remove('open');}
function saveTarea(){
  const name=document.getElementById('tarea-name').value.trim();
  if(!name){showToast('Escribe el nombre de la tarea');return;}
  const id=document.getElementById('tarea-id').value||Date.now().toString();
  DB.set(`refugio2/tareas/${id}`,{id,name,priority:document.getElementById('tarea-priority').value,status:document.getElementById('tarea-status').value,date:document.getElementById('tarea-date').value,notes:document.getElementById('tarea-notes').value.trim(),hoy:document.getElementById('tarea-hoy').checked,createdAt:state.tareas[id]?.createdAt||Date.now()}).then(()=>{closeTareaSheet();showToast('Tarea guardada ✓');});
}
function deleteTarea(){
  const id=document.getElementById('tarea-id').value;
  if(!id||!confirm('¿Eliminar esta tarea?'))return;
  DB.remove(`refugio2/tareas/${id}`).then(()=>{closeTareaSheet();showToast('Tarea eliminada');});
}

// ── TRABAJO: AGENDA ──
function renderAgenda(){
  const area=document.getElementById('agenda-area'); if(!area) return;
  const all=Object.values(state.agenda).sort((a,b)=>a.date?.localeCompare(b.date)||(a.time?.localeCompare(b.time)));
  if(!all.length){area.innerHTML=`<div class="empty-state"><div class="empty-icon">📅</div><p>Sin eventos.<br>Pulsa + para añadir.</p></div>`;return;}
  const today=todayKey();
  const todayEvs=all.filter(e=>e.date===today);
  const upcoming=all.filter(e=>e.date>today);
  const past=all.filter(e=>e.date<today);
  const renderEvs=(evs)=>evs.map(e=>`
    <div class="agenda-item">
      <div class="agenda-time">${e.time||'·'}</div>
      <div class="agenda-card" onclick="openAgendaSheet(${JSON.stringify(e).replace(/"/g,'&quot;')})">
        <div class="agenda-name">${e.name}</div>
        ${e.notes?`<div class="agenda-sub">${e.notes}</div>`:''}
        <div class="agenda-sub">${e.date}</div>
      </div>
    </div>`).join('');
  area.innerHTML=`
    ${todayEvs.length?`<div class="section-label">Hoy</div>${renderEvs(todayEvs)}`:''}
    ${upcoming.length?`<div class="section-label">Próximos</div>${renderEvs(upcoming)}`:''}
    ${past.length?`<div class="section-label">Pasados</div>${renderEvs(past)}`:''}`;
}

function openAgendaSheet(e){
  const isNew=!e;
  document.getElementById('agenda-id').value=e?.id||'';
  document.getElementById('agenda-name').value=e?.name||'';
  document.getElementById('agenda-date').value=e?.date||todayKey();
  document.getElementById('agenda-time').value=e?.time||'';
  document.getElementById('agenda-notes').value=e?.notes||'';
  document.getElementById('agenda-sheet-title').textContent=isNew?'Nuevo evento':'Editar evento';
  document.getElementById('agenda-delete-btn').style.display=isNew?'none':'block';
  document.getElementById('agenda-sheet').classList.add('open');
}
function closeAgendaSheet(){document.getElementById('agenda-sheet').classList.remove('open');}
function saveAgenda(){
  const name=document.getElementById('agenda-name').value.trim();
  if(!name){showToast('Escribe el nombre del evento');return;}
  const id=document.getElementById('agenda-id').value||Date.now().toString();
  DB.set(`refugio2/agenda/${id}`,{id,name,date:document.getElementById('agenda-date').value,time:document.getElementById('agenda-time').value,notes:document.getElementById('agenda-notes').value.trim()}).then(()=>{closeAgendaSheet();showToast('Evento guardado ✓');});
}
function deleteAgenda(){
  const id=document.getElementById('agenda-id').value;
  if(!id||!confirm('¿Eliminar?'))return;
  DB.remove(`refugio2/agenda/${id}`).then(()=>{closeAgendaSheet();showToast('Evento eliminado');});
}

// ── TRABAJO: REUNIONES ──
function renderReuniones(){
  const area=document.getElementById('reuniones-area'); if(!area) return;
  const all=Object.values(state.reuniones).sort((a,b)=>b.date?.localeCompare(a.date));
  if(!all.length){area.innerHTML=`<div class="empty-state"><div class="empty-icon">📝</div><p>Sin reuniones.<br>Pulsa + para añadir.</p></div>`;return;}
  area.innerHTML=all.map(r=>`
    <div class="reunion-card" onclick="openReunionSheet(${JSON.stringify(r).replace(/"/g,'&quot;')})">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;">
        <div class="reunion-title">${r.name}</div>
        <div style="font-size:12px;color:var(--text-muted);">${r.date||''}</div>
      </div>
      ${r.asistentes?`<div class="reunion-meta">👥 ${r.asistentes}</div>`:''}
      ${r.actions&&Object.values(r.actions).length?`
        <div class="action-item">📌 ${Object.values(r.actions).length} acción${Object.values(r.actions).length>1?'es':''} pendiente${Object.values(r.actions).length>1?'s':''}</div>
      `:''}
    </div>`).join('');
}

function openReunionSheet(r){
  const isNew=!r;
  document.getElementById('reunion-id').value=r?.id||'';
  document.getElementById('reunion-name').value=r?.name||'';
  document.getElementById('reunion-date').value=r?.date||todayKey();
  document.getElementById('reunion-asistentes').value=r?.asistentes||'';
  document.getElementById('reunion-notas').value=r?.notas||'';
  document.getElementById('reunion-sheet-title').textContent=isNew?'Nueva reunión':'Editar reunión';
  document.getElementById('reunion-delete-btn').style.display=isNew?'none':'block';
  reunionActions=r?.actions?Object.values(r.actions).map(a=>({...a})):[];
  renderReunionActions();
  document.getElementById('reunion-sheet').classList.add('open');
}
function closeReunionSheet(){document.getElementById('reunion-sheet').classList.remove('open');}
function renderReunionActions(){
  document.getElementById('reunion-actions-container').innerHTML=reunionActions.map((a,i)=>`
    <div class="item-row">
      <input class="input-field" value="${a.text||''}" placeholder="Ej: Enviar propuesta antes del viernes" oninput="reunionActions[${i}].text=this.value">
      <button class="remove-btn" onclick="reunionActions.splice(${i},1);renderReunionActions()">×</button>
    </div>`).join('');
}
function addReunionAction(){reunionActions.push({id:Date.now().toString(),text:''});renderReunionActions();}
function saveReunion(){
  const name=document.getElementById('reunion-name').value.trim();
  if(!name){showToast('Escribe el nombre de la reunión');return;}
  const id=document.getElementById('reunion-id').value||Date.now().toString();
  const actions=reunionActions.filter(a=>a.text.trim());
  DB.set(`refugio2/reuniones/${id}`,{id,name,date:document.getElementById('reunion-date').value,asistentes:document.getElementById('reunion-asistentes').value.trim(),notas:document.getElementById('reunion-notas').value.trim(),actions:Object.fromEntries(actions.map(a=>[a.id,{id:a.id,text:a.text.trim()}]))}).then(()=>{closeReunionSheet();showToast('Reunión guardada ✓');});
}
function deleteReunion(){
  const id=document.getElementById('reunion-id').value;
  if(!id||!confirm('¿Eliminar?'))return;
  DB.remove(`refugio2/reuniones/${id}`).then(()=>{closeReunionSheet();showToast('Reunión eliminada');});
}

// ── TRABAJO: RECORDAR ──
function renderRecordar(){
  const area=document.getElementById('recordar-area'); if(!area) return;
  const all=Object.values(state.recordar).sort((a,b)=>b.ts-a.ts);
  if(!all.length){area.innerHTML=`<div class="empty-state"><div class="empty-icon">🧠</div><p>Sin notas todavía.<br>Pulsa + para añadir ideas, enlaces o cosas pendientes.</p></div>`;return;}
  area.innerHTML=all.map(r=>`
    <div class="task-card" onclick="openRecordarSheet(${JSON.stringify(r).replace(/"/g,'&quot;')})">
      <div class="task-name">${r.text}</div>
      ${r.context?`<div class="task-meta">${r.context}</div>`:''}
    </div>`).join('');
}
function openRecordarSheet(r){
  const isNew=!r;
  document.getElementById('recordar-id').value=r?.id||'';
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
  DB.set(`refugio2/recordar/${id}`,{id,text,context:document.getElementById('recordar-context').value.trim(),ts:state.recordar[id]?.ts||Date.now()}).then(()=>{closeRecordarSheet();showToast('Guardado ✓');});
}
function deleteRecordar(){
  const id=document.getElementById('recordar-id').value;
  if(!id||!confirm('¿Eliminar?'))return;
  DB.remove(`refugio2/recordar/${id}`).then(()=>{closeRecordarSheet();showToast('Eliminado');});
}

// ── AJUSTES ──
function renderSettings(){
  const toggle=document.getElementById('dark-toggle'); if(!toggle)return;
  toggle.classList.toggle('on',state.darkMode);
  toggle.addEventListener('click',()=>{
    state.darkMode=!state.darkMode;
    localStorage.setItem('darkMode',state.darkMode);
    document.body.classList.toggle('dark',state.darkMode);
    toggle.classList.toggle('on',state.darkMode);
  });
}

// ── NOTIFICACIONES ──
const NOTIF_TIMES=[
  {hour:9,min:0,key:'morning',msg:'¡Buenos días! Revisa tus listas de hoy 🌿'},
  {hour:21,min:0,key:'evening',msg:'¿Has revisado tus listas de hoy? 🌙'},
];
async function initNotifications(){
  if(!('Notification' in window)){showToast('Tu navegador no soporta notificaciones');return;}
  if(Notification.permission==='denied'){showToast('Notificaciones bloqueadas en ajustes');return;}
  const r=await Notification.requestPermission();
  if(r==='granted'){showToast('Notificaciones activadas ✓');startNotifCheck();}
  else showToast('Permiso denegado');
}
function checkAndSendNotif(){
  if(Notification.permission!=='granted')return;
  const now=new Date(),h=now.getHours(),m=now.getMinutes();
  NOTIF_TIMES.forEach(({hour,min,key,msg})=>{
    if(h===hour&&m===min){
      const k=`notif_sent_${key}_${now.toISOString().slice(0,10)}`;
      if(!localStorage.getItem(k)){localStorage.setItem(k,'1');new Notification('Mi Refugio',{body:msg,icon:'/mi-refugio/icon-192.png'});}
    }
  });
}
function startNotifCheck(){setInterval(checkAndSendNotif,60000);}

// ── TOAST ──
function showToast(msg,duration=2000){
  const t=document.getElementById('toast'); if(!t)return;
  t.textContent=msg;
  t.style.opacity='1';t.style.transform='translateX(-50%) translateY(0)';
  clearTimeout(t._t);
  t._t=setTimeout(()=>{t.style.opacity='0';t.style.transform='translateX(-50%) translateY(20px)';},duration);
}
