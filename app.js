// ═══════════════════════════════════════════════════════════
//  MI REFUGIO — app.js
// ═══════════════════════════════════════════════════════════

// ─── Daily messages ────────────────────────────────────────
const DAILY_MESSAGES = [
  "Un pequeño paso también cuenta. 🌱",
  "Hoy es una nueva oportunidad.",
  "No necesitas hacerlo perfecto.",
  "Eres suficiente tal como eres.",
  "El progreso, aunque sea pequeño, importa.",
  "Cuídate hoy como cuidarías a alguien que amas.",
  "Está bien no estar bien del todo.",
  "Celebra lo que sí hiciste.",
  "Cada día es un punto de partida.",
  "Respira. Estás aquí.",
  "Lo que sientes es válido.",
  "Hoy también cuenta.",
  "El descanso también es avanzar.",
  "No hay prisa. Hay presencia.",
  "Eres más constante de lo que crees.",
  "Los días difíciles también forman parte del camino.",
  "Pequeños hábitos, grandes cambios.",
  "Hoy empezamos de cero, sin juicios.",
  "Tu esfuerzo de hoy importa.",
  "Confía en el proceso."
];

// ─── Mood options ───────────────────────────────────────────
const MOODS = [
  { id: 'feliz',    emoji: '😊', label: 'Feliz' },
  { id: 'bien',     emoji: '🙂', label: 'Bien' },
  { id: 'normal',   emoji: '😐', label: 'Normal' },
  { id: 'triste',   emoji: '😔', label: 'Triste' },
  { id: 'agobiada', emoji: '😩', label: 'Agobiada' },
  { id: 'cansada',  emoji: '😴', label: 'Cansada' },
  { id: 'ansiosa',  emoji: '😰', label: 'Ansiosa' },
  { id: 'enfadada', emoji: '😡', label: 'Enfadada' }
];

// ─── Sample habits (until Firebase is connected) ────────────
const SAMPLE_HABITS = [
  { id: 'agua',    name: 'Agua',    icon: '💧', color: '#B8D4F0', type: 'counter', goal: 8,  current: 5, unit: 'vasos' },
  { id: 'leer',    name: 'Leer',    icon: '📖', color: '#D4EDD1', type: 'boolean', done: false },
  { id: 'meditar', name: 'Meditar', icon: '🧘', color: '#E8D4F0', type: 'boolean', done: false },
  { id: 'caminar', name: 'Caminar', icon: '🚶', color: '#F0E4C0', type: 'counter', goal: 10, current: 4, unit: 'min' },
];

// ─── State ──────────────────────────────────────────────────
let state = {
  currentTab:    'inicio',
  todayMood:     null,
  habits:        JSON.parse(localStorage.getItem('habits') || 'null') || SAMPLE_HABITS,
  todayProgress: JSON.parse(localStorage.getItem('todayProgress_' + todayKey()) || '{}'),
  darkMode:      localStorage.getItem('darkMode') === 'true',
  breathPhase:   'idle',
  breathTimer:   null,
  sosStep:       'breath', // 'breath' | 'tips' | 'result'
};

// ─── Init ───────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  if (state.darkMode) document.body.classList.add('dark');
  applyTodayMood();
  renderHome();
  renderHabitos();
  renderCalendar();
  renderConocete();
  renderSettings();
  setupNav();
  setupSOS();
  registerSW();
});

// ─── Service Worker ─────────────────────────────────────────
function registerSW() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }
}

// ─── Navigation ─────────────────────────────────────────────
function setupNav() {
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      navigateTo(tab);
    });
  });
}

function navigateTo(tab) {
  state.currentTab = tab;

  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));

  document.getElementById('screen-' + tab)?.classList.add('active');
  document.querySelector(`.nav-btn[data-tab="${tab}"]`)?.classList.add('active');

  // Hide FAB except on hábitos
  const fab = document.getElementById('fab');
  if (fab) fab.style.display = tab === 'habitos' ? 'flex' : 'none';
}

// ─── TODAY KEY ──────────────────────────────────────────────
function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

// ─── Save progress ──────────────────────────────────────────
function saveProgress() {
  localStorage.setItem('todayProgress_' + todayKey(), JSON.stringify(state.todayProgress));
  localStorage.setItem('habits', JSON.stringify(state.habits));
}

// ═══════════════════════════════════════════════════════════
//  INICIO SCREEN
// ═══════════════════════════════════════════════════════════
function renderHome() {
  // Greeting
  const hour = new Date().getHours();
  let greet = hour < 13 ? 'Buenos días' : hour < 20 ? 'Buenas tardes' : 'Buenas noches';
  document.getElementById('greeting-text').innerHTML = `${greet}, <em>Eider</em>.`;

  // Date
  document.getElementById('date-text').textContent =
    new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });

  // Daily message (seeded by day of year)
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
  document.getElementById('daily-message').textContent =
    DAILY_MESSAGES[dayOfYear % DAILY_MESSAGES.length];

  // Mood
  renderMoodPicker();

  // Habits of the day
  renderTodayHabits();

  // Summary
  renderSummary();
}

// ─── Mood Picker ────────────────────────────────────────────
function applyTodayMood() {
  const saved = localStorage.getItem('mood_' + todayKey());
  if (saved) state.todayMood = saved;
}

function renderMoodPicker() {
  const grid = document.getElementById('mood-grid');
  if (!grid) return;
  grid.innerHTML = MOODS.map(m => `
    <button class="mood-btn ${state.todayMood === m.id ? 'selected' : ''}"
            onclick="selectMood('${m.id}')">
      <span class="emoji">${m.emoji}</span>
      <span class="label">${m.label}</span>
    </button>
  `).join('');
}

function selectMood(id) {
  state.todayMood = id;
  localStorage.setItem('mood_' + todayKey(), id);
  renderMoodPicker();
  renderSummary();

  // Try to save to Firebase if available
  try {
    DB.set(`registros/${todayKey()}/mood`, id);
  } catch(e) {}
}

// ─── Today Habits ───────────────────────────────────────────
function renderTodayHabits() {
  const list = document.getElementById('today-habits');
  if (!list) return;

  if (!state.habits.length) {
    list.innerHTML = `<div class="empty-state">
      <div class="empty-icon">🌱</div>
      <p>Aún no tienes hábitos.<br>Ve a la pestaña Hábitos para crear el primero.</p>
    </div>`;
    return;
  }

  list.innerHTML = state.habits.map(h => {
    const prog = state.todayProgress[h.id] || {};
    const done = h.type === 'boolean' ? !!prog.done : false;
    const current = h.type === 'counter' ? (prog.current ?? h.current ?? 0) : 0;
    const pct = h.type === 'counter' ? Math.min(100, Math.round((current / h.goal) * 100)) : (done ? 100 : 0);

    return `
      <div class="habit-item ${done ? 'completed' : ''}" id="habit-item-${h.id}">
        <div class="habit-icon" style="background:${h.color}20; font-size:20px;">${h.icon}</div>
        <div class="habit-info">
          <div class="habit-name">${h.name}</div>
          ${h.type === 'counter' ? `
            <div class="habit-progress-text">${current} / ${h.goal} ${h.unit}</div>
            <div class="habit-bar-wrap"><div class="habit-bar" style="width:${pct}%; background:${h.color}"></div></div>
          ` : `
            <div class="habit-progress-text">${done ? '¡Completado!' : 'Pendiente'}</div>
          `}
        </div>
        ${h.type === 'boolean' ? `
          <button class="check-btn ${done ? 'done' : ''}" id="check-${h.id}"
                  onclick="toggleHabit('${h.id}')">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M2 7L5.5 10.5L12 4" stroke="white" stroke-width="2"
                    stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
        ` : `
          <div style="display:flex;gap:6px;align-items:center;">
            <button onclick="changeCounter('${h.id}', -1)" style="width:28px;height:28px;border-radius:50%;border:1.5px solid var(--c-border);background:none;font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;">−</button>
            <button onclick="changeCounter('${h.id}', 1)" style="width:28px;height:28px;border-radius:50%;border:none;background:var(--c-sage);color:white;font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;">+</button>
          </div>
        `}
      </div>`;
  }).join('');
}

function toggleHabit(id) {
  if (!state.todayProgress[id]) state.todayProgress[id] = {};
  const current = state.todayProgress[id].done;
  state.todayProgress[id].done = !current;

  const btn = document.getElementById('check-' + id);
  if (btn) {
    btn.classList.toggle('done', !current);
    btn.classList.add('bloom');
    setTimeout(() => btn.classList.remove('bloom'), 500);
  }

  saveProgress();
  setTimeout(() => {
    renderTodayHabits();
    renderSummary();
  }, 350);

  // Firebase
  try { DB.set(`registros/${todayKey()}/habitos/${id}/done`, !current); } catch(e) {}
}

function changeCounter(id, delta) {
  const habit = state.habits.find(h => h.id === id);
  if (!habit) return;
  if (!state.todayProgress[id]) state.todayProgress[id] = { current: habit.current || 0 };
  state.todayProgress[id].current = Math.max(0, Math.min(habit.goal, (state.todayProgress[id].current || 0) + delta));
  saveProgress();
  renderTodayHabits();
  renderSummary();
  try { DB.set(`registros/${todayKey()}/habitos/${id}/current`, state.todayProgress[id].current); } catch(e) {}
}

// ─── Summary ────────────────────────────────────────────────
function renderSummary() {
  const completedCount = state.habits.filter(h => {
    const prog = state.todayProgress[h.id] || {};
    if (h.type === 'boolean') return prog.done;
    if (h.type === 'counter') return (prog.current ?? 0) >= h.goal;
    return false;
  }).length;

  const el = id => document.getElementById(id);
  if (el('summary-habitos'))  el('summary-habitos').textContent  = `${completedCount}/${state.habits.length}`;
  if (el('summary-mood'))     el('summary-mood').textContent     = state.todayMood ? MOODS.find(m => m.id === state.todayMood)?.emoji || '—' : '—';
}

// ═══════════════════════════════════════════════════════════
//  SOS SCREEN
// ═══════════════════════════════════════════════════════════
function setupSOS() {
  document.getElementById('sos-btn')?.addEventListener('click', openSOS);
  document.getElementById('sos-back')?.addEventListener('click', closeSOS);
  document.getElementById('sos-start-breath')?.addEventListener('click', startBreathing);
  document.getElementById('sos-done-yes')?.addEventListener('click', () => logSOSResult(true));
  document.getElementById('sos-done-no')?.addEventListener('click', () => logSOSResult(false));
}

function openSOS() {
  const screen = document.getElementById('sos-screen');
  screen.classList.add('open');
  showSOSStep('breath');
}

function closeSOS() {
  stopBreathing();
  document.getElementById('sos-screen').classList.remove('open');
}

function showSOSStep(step) {
  state.sosStep = step;
  ['sos-step-breath','sos-step-tips','sos-step-result'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
  const active = document.getElementById('sos-step-' + step);
  if (active) active.style.display = 'flex';
}

function startBreathing() {
  const circle = document.getElementById('breath-circle');
  const label  = document.getElementById('breath-label');
  if (!circle || !label) return;

  let phase = 0; // 0=inhala 1=aguanta 2=exhala
  const phases = [
    { name: 'Inhala...', cls: 'inhale', dur: 4000 },
    { name: 'Aguanta.', cls: '',        dur: 2000 },
    { name: 'Exhala...', cls: 'exhale', dur: 4000 },
  ];
  let cycles = 0;

  function runPhase() {
    if (cycles >= 3) {
      label.textContent = '¡Muy bien! 🌿';
      circle.className = 'breath-circle';
      setTimeout(() => showSOSStep('tips'), 1200);
      return;
    }
    const p = phases[phase];
    circle.className = 'breath-circle ' + p.cls;
    label.textContent = p.name;

    state.breathTimer = setTimeout(() => {
      phase = (phase + 1) % 3;
      if (phase === 0) cycles++;
      runPhase();
    }, p.dur);
  }

  document.getElementById('sos-start-breath').style.display = 'none';
  runPhase();
}

function stopBreathing() {
  if (state.breathTimer) { clearTimeout(state.breathTimer); state.breathTimer = null; }
}

function logSOSResult(passed) {
  const result = { timestamp: Date.now(), passed };
  try { DB.push('sos_results', result); } catch(e) {}
  closeSOS();
}

// ═══════════════════════════════════════════════════════════
//  HÁBITOS SCREEN
// ═══════════════════════════════════════════════════════════
function renderHabitos() {
  const list = document.getElementById('habitos-list');
  if (!list) return;

  if (!state.habits.length) {
    list.innerHTML = `<div class="empty-state">
      <div class="empty-icon">🌱</div>
      <p>Aún no tienes hábitos.<br>Pulsa el + para crear el primero.</p>
    </div>`;
    return;
  }

  const types = { boolean: 'Sí / No', counter: 'Contador', timer: 'Temporizador', value: 'Valor' };

  list.innerHTML = state.habits.map(h => `
    <div class="habit-card" onclick="editHabit('${h.id}')">
      <div class="habit-card-icon" style="background:${h.color}30;">${h.icon}</div>
      <div class="habit-card-info">
        <div class="habit-card-name">${h.name}</div>
        <div class="habit-card-meta">${types[h.type] || ''} ${h.goal ? `· Objetivo: ${h.goal} ${h.unit||''}` : ''}</div>
      </div>
      <span style="color:var(--c-text-muted);font-size:14px;">›</span>
    </div>
  `).join('');

  // FAB
  document.getElementById('fab')?.addEventListener('click', openNewHabit);
}

function editHabit(id) {
  const h = state.habits.find(x => x.id === id);
  if (h) openHabitSheet(h);
}

function openNewHabit() {
  openHabitSheet(null);
}

function openHabitSheet(habit) {
  const isNew = !habit;
  const sheet = document.getElementById('habit-sheet');
  const title = document.getElementById('habit-sheet-title');

  document.getElementById('habit-form-name').value  = habit?.name  || '';
  document.getElementById('habit-form-icon').value  = habit?.icon  || '✨';
  document.getElementById('habit-form-color').value = habit?.color || '#8FAF8A';
  document.getElementById('habit-form-type').value  = habit?.type  || 'boolean';
  document.getElementById('habit-form-goal').value  = habit?.goal  || '';
  document.getElementById('habit-form-unit').value  = habit?.unit  || '';
  document.getElementById('habit-form-id').value    = habit?.id    || '';

  title.textContent = isNew ? 'Nuevo hábito' : 'Editar hábito';
  toggleGoalFields();
  sheet.classList.add('open');
}

function closeHabitSheet() {
  document.getElementById('habit-sheet').classList.remove('open');
}

function toggleGoalFields() {
  const type = document.getElementById('habit-form-type').value;
  const goalRow = document.getElementById('goal-row');
  if (goalRow) goalRow.style.display = type === 'counter' || type === 'value' ? 'block' : 'none';
}

function saveHabitForm() {
  const id    = document.getElementById('habit-form-id').value   || Date.now().toString();
  const name  = document.getElementById('habit-form-name').value.trim();
  const icon  = document.getElementById('habit-form-icon').value.trim() || '✨';
  const color = document.getElementById('habit-form-color').value;
  const type  = document.getElementById('habit-form-type').value;
  const goal  = parseInt(document.getElementById('habit-form-goal').value) || null;
  const unit  = document.getElementById('habit-form-unit').value.trim();

  if (!name) { alert('Ponle un nombre al hábito 🌸'); return; }

  const habit = { id, name, icon, color, type, goal, unit, current: 0 };
  const idx = state.habits.findIndex(h => h.id === id);
  if (idx >= 0) state.habits[idx] = habit;
  else state.habits.push(habit);

  saveProgress();
  closeHabitSheet();
  renderHabitos();
  renderTodayHabits();

  try { DB.set(`habitos/${id}`, habit); } catch(e) {}
}

function deleteHabit() {
  const id = document.getElementById('habit-form-id').value;
  if (!id) return;
  if (!confirm('¿Eliminar este hábito?')) return;
  state.habits = state.habits.filter(h => h.id !== id);
  saveProgress();
  closeHabitSheet();
  renderHabitos();
  renderTodayHabits();
  try { DB.remove(`habitos/${id}`); } catch(e) {}
}

// ═══════════════════════════════════════════════════════════
//  CALENDARIO
// ═══════════════════════════════════════════════════════════
function renderCalendar() {
  const now = new Date();
  const year  = now.getFullYear();
  const month = now.getMonth();

  const monthName = now.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
  const el = document.getElementById('cal-month-name');
  if (el) el.textContent = monthName.charAt(0).toUpperCase() + monthName.slice(1);

  const firstDay = new Date(year, month, 1).getDay(); // 0=domingo
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const offset = (firstDay + 6) % 7; // lunes primero

  const grid = document.getElementById('cal-grid');
  if (!grid) return;

  const dayLabels = ['L','M','X','J','V','S','D'];
  let html = dayLabels.map(d => `<div class="cal-day-label">${d}</div>`).join('');

  for (let i = 0; i < offset; i++) html += `<div class="cal-day empty"></div>`;

  for (let d = 1; d <= daysInMonth; d++) {
    const dateKey = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const isToday = d === now.getDate();
    // Random demo color — will come from Firebase later
    const colors = ['excellent','good','normal','no-data'];
    const cls = d < now.getDate() ? colors[Math.floor(Math.random() * colors.length)] : (isToday ? 'good' : 'no-data');
    html += `<div class="cal-day ${cls} ${isToday?'today':''}" onclick="openDay('${dateKey}')">${d}</div>`;
  }

  grid.innerHTML = html;
}

function openDay(dateKey) {
  alert(`📅 ${dateKey}\n\nPronto podrás ver el detalle de este día.`);
}

// ═══════════════════════════════════════════════════════════
//  CONÓCETE
// ═══════════════════════════════════════════════════════════
function renderConocete() {
  const list = document.getElementById('insights-list');
  if (!list) return;

  // Placeholder insights — luego vendrán de análisis real de Firebase
  const insights = [
    { icon: '💧', text: '<strong>Llevas 5 días</strong> bebiendo suficiente agua. ¡Sigue así!' },
    { icon: '🌙', text: 'Cuando registras tu estado por la mañana, <strong>completas más hábitos</strong> durante el día.' },
    { icon: '📖', text: 'Tu hábito más constante esta semana ha sido <strong>Leer</strong>.' },
    { icon: '🌱', text: 'Los lunes sueles empezar con más energía. <strong>Aprovecha ese impulso.</strong>' },
    { icon: '💚', text: 'Llevas 3 días sin escribir notas. ¿Cómo lo estás llevando?' },
  ];

  list.innerHTML = insights.map(i => `
    <div class="insight-card">
      <div class="insight-icon">${i.icon}</div>
      <div class="insight-text">${i.text}</div>
    </div>
  `).join('');
}

// ═══════════════════════════════════════════════════════════
//  AJUSTES
// ═══════════════════════════════════════════════════════════
function renderSettings() {
  // Dark mode toggle state
  const toggle = document.getElementById('dark-mode-toggle');
  if (toggle) {
    toggle.classList.toggle('on', state.darkMode);
    toggle.addEventListener('click', () => {
      state.darkMode = !state.darkMode;
      localStorage.setItem('darkMode', state.darkMode);
      document.body.classList.toggle('dark', state.darkMode);
      toggle.classList.toggle('on', state.darkMode);
    });
  }
}

// ─── Export data ────────────────────────────────────────────
function exportData() {
  const data = {
    habits: state.habits,
    progress: state.todayProgress,
    exportedAt: new Date().toISOString()
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `refugio-backup-${todayKey()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
