// ═══════════════════════════════════════
//  MI REFUGIO v2 — app.js
// ═══════════════════════════════════════

const COLORS = [
  { id: 'lav',    hex: '#EDE9F8' },
  { id: 'yellow', hex: '#FEF9C3' },
  { id: 'green',  hex: '#DCFCE7' },
  { id: 'pink',   hex: '#FCE7F3' },
  { id: 'blue',   hex: '#DBEAFE' },
  { id: 'peach',  hex: '#FFEDD5' },
  { id: 'gray',   hex: '#F3F4F6' },
];

const COLOR_DOTS = ['#9B8EC4','#CA8A04','#16A34A','#DB2777','#2563EB','#EA580C','#6B7280'];

let state = {
  checklists: {},
  progress:   {},
  notes:      {},
  darkMode:   localStorage.getItem('darkMode') === 'true',
  currentTab: 'inicio',
};

let selectedColor = COLORS[0].id;
let selectedNoteColor = COLORS[1].id;
let editingItems = [];

// ── Init ──
document.addEventListener('DOMContentLoaded', () => {
  if (state.darkMode) document.body.classList.add('dark');
  setupNav();
  renderGreeting();
  renderSettings();
  initListeners();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
  // Si ya tiene permiso, arrancar el check
  if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
    startNotifCheck();
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      renderGreeting();
      checkAndSendNotif();
    }
  });
});

// ── Firebase ──
function progressKey(cl) {
  if (cl.frecuencia === 'weekly') return `week_${weekKey()}`;
  return todayKey();
}

function initListeners() {
  DB.listen('refugio2/checklists', data => {
    state.checklists = data || {};
    renderChecklistsHome();
    renderChecklistsList();
  });
  DB.listen(`refugio2/progress/${todayKey()}`, data => {
    state.progress = data || {};
    renderChecklistsHome();
  });
  DB.listen(`refugio2/progress/week_${weekKey()}`, data => {
    state.weekProgress = data || {};
    renderChecklistsHome();
  });
  DB.listen('refugio2/notes', data => {
    state.notes = data || {};
    renderNotes();
  });
}

// ── Nav ──
function setupNav() {
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => navigateTo(btn.dataset.tab));
  });
}

function navigateTo(tab) {
  state.currentTab = tab;
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('screen-' + tab)?.classList.add('active');
  document.querySelector(`.nav-btn[data-tab="${tab}"]`)?.classList.add('active');
  const fab = document.getElementById('fab');
  if (fab) fab.style.display = (tab === 'listas' || tab === 'notas') ? 'flex' : 'none';
  if (!fab._listener) {
    fab.addEventListener('click', () => {
      if (state.currentTab === 'listas') openChecklistSheet(null);
      if (state.currentTab === 'notas') openNoteSheet(null);
    });
    fab._listener = true;
  }
}

// ── Greeting ──
function renderGreeting() {
  const hour = new Date().getHours();
  const greet = hour < 13 ? 'Buenos días' : hour < 20 ? 'Buenas tardes' : 'Buenas noches';
  const el = document.getElementById('greeting');
  if (el) el.textContent = greet;
  const dl = document.getElementById('date-label');
  if (dl) dl.textContent = new Date().toLocaleDateString('es-ES', { weekday:'long', day:'numeric', month:'long' });
}

// ── Checklist frequency ──
function shouldShowToday(cl) {
  const freq = cl.frecuencia || 'daily';
  if (freq === 'daily') return true;
  if (freq === 'weekly') return true; // aparece todos los días, se reinicia el lunes
  const days = parseInt(freq);
  if (!isNaN(days)) {
    const created = new Date(cl.createdAt || Date.now());
    const diff = Math.floor((Date.now() - created.getTime()) / 86400000);
    return diff % days === 0;
  }
  return true;
}

function weekKey() {
  // Clave de la semana actual (lunes)
  const d = new Date();
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1 - day);
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

function freqLabel(freq) {
  if (freq === 'daily') return 'Diaria';
  if (freq === 'weekly') return 'Semanal';
  return `Cada ${freq} días`;
}

// ── Progress ring SVG ──
function progressRing(done, total, color) {
  const pct = total ? done / total : 0;
  const r = 12;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - pct);
  const stroke = pct === 1 ? '#9B8EC4' : '#9B8EC4';
  return `<svg class="progress-ring" viewBox="0 0 32 32">
    <circle class="ring-bg" cx="16" cy="16" r="${r}"/>
    <circle class="ring-fill" cx="16" cy="16" r="${r}"
      stroke="${stroke}" stroke-dasharray="${circ}" stroke-dashoffset="${offset}"
      transform="rotate(-90 16 16)"/>
    <text x="16" y="20" text-anchor="middle" font-size="9" font-weight="600"
      fill="var(--text-soft)" font-family="Plus Jakarta Sans,sans-serif">
      ${done}/${total}
    </text>
  </svg>`;
}

// ── Render home ──
function renderChecklistsHome() {
  const container = document.getElementById('checklists-home');
  if (!container) return;

  const all = Object.values(state.checklists);
  const today = all.filter(cl => shouldShowToday(cl));

  if (!today.length) {
    container.innerHTML = `<div class="empty-state">
      <div class="empty-icon">✅</div>
      <p>No tienes listas para hoy.<br>Ve a <strong>Listas</strong> para crear una.</p>
    </div>`;
    return;
  }

  container.innerHTML = today.map(cl => {
    const items = cl.items ? Object.values(cl.items) : [];
    const isWeekly = cl.frecuencia === 'weekly';
    const prog = isWeekly
      ? (state.weekProgress?.[cl.id] || {})
      : (state.progress?.[cl.id] || {});
    const done = items.filter(it => prog[it.id]).length;
    const dotColor = COLOR_DOTS[COLORS.findIndex(c => c.id === cl.color)] || '#9B8EC4';
    const freqTag = isWeekly
      ? `<span style="font-size:10px;background:var(--lav-light);color:var(--lavender);padding:2px 7px;border-radius:99px;font-weight:600;margin-left:6px;">Semanal</span>`
      : '';

    return `
      <div class="checklist-card" id="clcard-${cl.id}">
        <div class="checklist-header" onclick="toggleChecklist('${cl.id}')">
          <div class="checklist-color" style="background:${dotColor};"></div>
          <div class="checklist-info">
            <div class="checklist-name">${cl.name}${freqTag}</div>
            <div class="checklist-meta">${done}/${items.length} completados</div>
          </div>
          <div class="checklist-progress">${progressRing(done, items.length, dotColor)}</div>
        </div>
        <div class="checklist-items" id="items-${cl.id}">
          ${items.map(it => {
            const checked = !!prog[it.id];
            return `<div class="check-item" onclick="toggleItem('${cl.id}','${it.id}','${cl.frecuencia}')">
              <div class="check-box ${checked ? 'checked' : ''}">
                <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                  <path d="M1.5 5.5L4 8L9.5 2.5" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </div>
              <span class="check-label ${checked ? 'done' : ''}">${it.text}</span>
            </div>`;
          }).join('')}
        </div>
      </div>`;
  }).join('');
}

function toggleChecklist(id) {
  const items = document.getElementById('items-' + id);
  if (items) items.classList.toggle('open');
}

function toggleItem(clId, itemId, frecuencia) {
  const isWeekly = frecuencia === 'weekly';
  const key = isWeekly ? `week_${weekKey()}` : todayKey();
  const prog = isWeekly
    ? (state.weekProgress?.[clId] || {})
    : (state.progress?.[clId] || {});
  const current = !!prog[itemId];
  DB.update(`refugio2/progress/${key}/${clId}`, { [itemId]: !current });
}

// ── Render listas ──
function renderChecklistsList() {
  const container = document.getElementById('checklists-list');
  if (!container) return;

  const all = Object.values(state.checklists);
  if (!all.length) {
    container.innerHTML = `<div class="empty-state">
      <div class="empty-icon">📋</div>
      <p>Aún no tienes listas.<br>Pulsa + para crear la primera.</p>
    </div>`;
    return;
  }

  container.innerHTML = all.map(cl => {
    const items = cl.items ? Object.values(cl.items) : [];
    const dotColor = COLOR_DOTS[COLORS.findIndex(c => c.id === cl.color)] || '#9B8EC4';
    return `
      <div class="card" onclick="openChecklistSheet(${JSON.stringify(cl).replace(/"/g,'&quot;')})"
        style="padding:14px 16px;display:flex;align-items:center;gap:12px;cursor:pointer;">
        <div style="width:10px;height:10px;border-radius:50%;background:${dotColor};flex-shrink:0;"></div>
        <div style="flex:1;">
          <div style="font-size:15px;font-weight:600;">${cl.name}</div>
          <div style="font-size:12px;color:var(--text-muted);margin-top:2px;">${freqLabel(cl.frecuencia)} · ${items.length} items</div>
        </div>
        <span style="color:var(--text-muted);font-size:16px;">›</span>
      </div>`;
  }).join('');
}

// ── Checklist sheet ──
function openChecklistSheet(cl) {
  const isNew = !cl;
  document.getElementById('form-id').value   = cl?.id || '';
  document.getElementById('form-name').value = cl?.name || '';
  document.getElementById('form-freq').value = cl?.frecuencia || 'daily';
  document.getElementById('sheet-title').textContent = isNew ? 'Nueva lista' : 'Editar lista';
  document.getElementById('delete-btn').style.display = isNew ? 'none' : 'block';

  selectedColor = cl?.color || COLORS[0].id;
  renderColorPicker('color-picker', selectedColor, c => { selectedColor = c; });

  editingItems = cl?.items ? Object.values(cl.items).map(i => ({ ...i })) : [];
  renderItemRows();

  document.getElementById('checklist-sheet').classList.add('open');
}

function closeChecklistSheet() {
  document.getElementById('checklist-sheet').classList.remove('open');
}

function renderColorPicker(containerId, selected, onSelect) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = COLORS.map((c, i) => `
    <div class="color-dot ${c.id === selected ? 'selected' : ''}"
      style="background:${COLOR_DOTS[i]};"
      onclick="selectColorIn('${containerId}', '${c.id}')"></div>
  `).join('');
}

function selectColorIn(containerId, colorId) {
  if (containerId === 'color-picker') selectedColor = colorId;
  if (containerId === 'note-color-picker') selectedNoteColor = colorId;
  renderColorPicker(containerId, colorId, () => {});
}

function renderItemRows() {
  const container = document.getElementById('items-container');
  if (!container) return;
  container.innerHTML = editingItems.map((item, i) => `
    <div class="item-row">
      <input class="input-field" value="${item.text || ''}" placeholder="Nombre del item"
        oninput="editingItems[${i}].text = this.value">
      <button class="remove-btn" onclick="removeItem(${i})">×</button>
    </div>
  `).join('');
}

function addItemRow() {
  editingItems.push({ id: Date.now().toString(), text: '' });
  renderItemRows();
  const inputs = document.querySelectorAll('#items-container .input-field');
  inputs[inputs.length - 1]?.focus();
}

function removeItem(i) {
  editingItems.splice(i, 1);
  renderItemRows();
}

function saveChecklist() {
  const name = document.getElementById('form-name').value.trim();
  if (!name) { showToast('Ponle un nombre a la lista'); return; }

  const items = editingItems.filter(i => i.text.trim());
  if (!items.length) { showToast('Añade al menos un item'); return; }

  const id = document.getElementById('form-id').value || Date.now().toString();
  const cl = {
    id, name,
    color: selectedColor,
    frecuencia: document.getElementById('form-freq').value,
    createdAt: Date.now(),
    items: Object.fromEntries(items.map(i => [i.id, { id: i.id, text: i.text.trim() }]))
  };

  DB.set(`refugio2/checklists/${id}`, cl).then(() => {
    closeChecklistSheet();
    showToast('Lista guardada ✓');
  });
}

function deleteChecklist() {
  const id = document.getElementById('form-id').value;
  if (!id || !confirm('¿Eliminar esta lista?')) return;
  DB.remove(`refugio2/checklists/${id}`).then(() => {
    closeChecklistSheet();
    showToast('Lista eliminada');
  });
}

// ── Notes ──
function renderNotes() {
  const grid = document.getElementById('notes-grid');
  if (!grid) return;

  const notes = Object.values(state.notes).sort((a,b) => b.createdAt - a.createdAt);
  if (!notes.length) {
    grid.outerHTML; // keep grid
    grid.innerHTML = '';
    const parent = grid.parentElement;
    parent.innerHTML = `<div class="empty-state">
      <div class="empty-icon">📝</div>
      <p>Sin notas todavía.<br>Pulsa + para añadir una.</p>
    </div>`;
    return;
  }

  // Restore grid if needed
  if (!document.getElementById('notes-grid')) {
    const parent = document.querySelector('#screen-notas .scroll-area');
    parent.innerHTML = '<div class="notes-grid" id="notes-grid"></div>';
  }

  document.getElementById('notes-grid').innerHTML = notes.map(n => {
    const bg = COLORS.find(c => c.id === n.color)?.hex || COLORS[1].hex;
    const date = new Date(n.createdAt).toLocaleDateString('es-ES', { day:'numeric', month:'short' });
    const preview = n.text.length > 100 ? n.text.slice(0, 100) + '...' : n.text;
    return `
      <div class="postit" style="background:${bg};" onclick="openNoteSheet(${JSON.stringify(n).replace(/"/g,'&quot;')})">
        <div class="postit-text">${preview}</div>
        <div class="postit-date">${date}</div>
      </div>`;
  }).join('');
}

function openNoteSheet(note) {
  const isNew = !note;
  document.getElementById('note-form-id').value = note?.id || '';
  document.getElementById('note-text').value    = note?.text || '';
  document.getElementById('note-sheet-title').textContent = isNew ? 'Nueva nota' : 'Editar nota';
  document.getElementById('note-delete-btn').style.display = isNew ? 'none' : 'block';

  selectedNoteColor = note?.color || COLORS[1].id;
  renderColorPicker('note-color-picker', selectedNoteColor, c => { selectedNoteColor = c; });

  document.getElementById('note-sheet').classList.add('open');
}

function closeNoteSheet() {
  document.getElementById('note-sheet').classList.remove('open');
}

function saveNote() {
  const text = document.getElementById('note-text').value.trim();
  if (!text) { showToast('Escribe algo en la nota'); return; }

  const id = document.getElementById('note-form-id').value || Date.now().toString();
  const note = { id, text, color: selectedNoteColor, createdAt: state.notes[id]?.createdAt || Date.now() };

  DB.set(`refugio2/notes/${id}`, note).then(() => {
    closeNoteSheet();
    showToast('Nota guardada ✓');
  });
}

function deleteNote() {
  const id = document.getElementById('note-form-id').value;
  if (!id || !confirm('¿Eliminar esta nota?')) return;
  DB.remove(`refugio2/notes/${id}`).then(() => {
    closeNoteSheet();
    showToast('Nota eliminada');
  });
}

// ── Settings ──
function renderSettings() {
  const toggle = document.getElementById('dark-toggle');
  if (!toggle) return;
  toggle.classList.toggle('on', state.darkMode);
  toggle.addEventListener('click', () => {
    state.darkMode = !state.darkMode;
    localStorage.setItem('darkMode', state.darkMode);
    document.body.classList.toggle('dark', state.darkMode);
    toggle.classList.toggle('on', state.darkMode);
  });
}

// ── Toast ──
function showToast(msg, duration = 2000) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.style.opacity = '1';
  toast.style.transform = 'translateX(-50%) translateY(0)';
  clearTimeout(toast._t);
  toast._t = setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(-50%) translateY(20px)';
  }, duration);
}

// ── Notificaciones ──
const NOTIF_TIMES = [
  { hour: 9,  min: 0, key: 'morning', msg: '¡Buenos días! Revisa tus listas de hoy 🌿' },
  { hour: 21, min: 0, key: 'evening', msg: '¿Has revisado tus listas de hoy? 🌙' },
];

async function requestNotifPermission() {
  if (!('Notification' in window)) {
    showToast('Tu navegador no soporta notificaciones');
    return false;
  }
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') {
    showToast('Las notificaciones están bloqueadas en ajustes del móvil');
    return false;
  }
  const result = await Notification.requestPermission();
  if (result === 'granted') {
    showToast('Notificaciones activadas ✓');
    startNotifCheck();
  } else {
    showToast('Permiso denegado');
  }
  return result === 'granted';
}

function checkAndSendNotif() {
  if (Notification.permission !== 'granted') return;
  const now = new Date();
  const h = now.getHours();
  const m = now.getMinutes();

  NOTIF_TIMES.forEach(({ hour, min, key, msg }) => {
    if (h === hour && m === min) {
      const lastKey = `notif_sent_${key}_${now.toISOString().slice(0,10)}`;
      if (!localStorage.getItem(lastKey)) {
        localStorage.setItem(lastKey, '1');
        new Notification('Mi Refugio', {
          body: msg,
          icon: '/mi-refugio/icon-192.png',
          badge: '/mi-refugio/icon-192.png',
        });
      }
    }
  });
}

function startNotifCheck() {
  setInterval(checkAndSendNotif, 60000);
}

async function initNotifications() {
  await requestNotifPermission();
}
