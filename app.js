// ═══════════════════════════════════════════════════════════
//  MI REFUGIO — app.js
// ═══════════════════════════════════════════════════════════

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

const DIARIO_TAGS = ['Trabajo','Familia','Salud','Relaciones','Personal','Gratitud','Reflexión','Sueños'];

const COMIDAS = [
  { id: 'desayuno', label: 'Desayuno', icon: '☀️' },
  { id: 'comida',   label: 'Comida',   icon: '🌤️' },
  { id: 'cena',     label: 'Cena',     icon: '🌙' },
  { id: 'snack',    label: 'Snack',    icon: '🍎' },
];

const RATINGS = [
  { id: 'muybien', emoji: '🥗', label: 'Muy bien' },
  { id: 'bien',    emoji: '🙂', label: 'Bien' },
  { id: 'normal',  emoji: '😐', label: 'Normal' },
  { id: 'regular', emoji: '🍕', label: 'Regular' },
  { id: 'mal',     emoji: '🍔', label: 'Mal' },
];

const IMPULSO_DONDE = ['Casa','Cama','Trabajo','Coche','Otro'];
const IMPULSO_QUE   = ['Mirando el móvil','Trabajando','Viendo una serie','Comiendo','Estudiando','Conduciendo'];
const IMPULSO_COMO  = ['Ansiosa','Aburrida','Estresada','Cansada','Normal'];

// ─── Logros ─────────────────────────────────────────────────
const LOGROS_DEF = [
  { id: 'primer_habito',   icon: '🌱', titulo: 'Primer hábito',       desc: 'Creaste tu primer hábito',               check: (s) => s.habits.length >= 1 },
  { id: 'primera_semana',  icon: '🌸', titulo: 'Primera semana',       desc: '7 días usando Mi Refugio',               check: (s) => calcStreak(s) >= 7 },
  { id: 'racha_3',         icon: '🔥', titulo: '3 días seguidos',      desc: '3 días completando hábitos',             check: (s) => calcStreak(s) >= 3 },
  { id: 'racha_14',        icon: '💪', titulo: 'Dos semanas',          desc: '14 días seguidos con hábitos',           check: (s) => calcStreak(s) >= 14 },
  { id: 'racha_30',        icon: '🏆', titulo: 'Un mes',               desc: '30 días seguidos con hábitos',           check: (s) => calcStreak(s) >= 30 },
  { id: 'impulso_evitado', icon: '🧘', titulo: 'Primer impulso evitado', desc: 'Evitaste un impulso por primera vez',  check: (s) => getTotalEvitados(s) >= 1 },
  { id: 'impulsos_10',     icon: '💚', titulo: '10 impulsos evitados', desc: 'Evitaste 10 impulsos en total',          check: (s) => getTotalEvitados(s) >= 10 },
  { id: 'impulsos_50',     icon: '🌟', titulo: '50 impulsos evitados', desc: 'Evitaste 50 impulsos en total',          check: (s) => getTotalEvitados(s) >= 50 },
  { id: 'diario_1',        icon: '📖', titulo: 'Primera entrada',      desc: 'Escribiste en el diario por primera vez', check: (s) => Object.keys(diarioEntradas).length >= 1 },
  { id: 'diario_7',        icon: '✍️', titulo: 'Una semana de diario', desc: '7 entradas en el diario',                check: (s) => Object.keys(diarioEntradas).length >= 7 },
  { id: 'estado_animo',    icon: '🎭', titulo: 'Autoconciencia',       desc: 'Registraste tu estado 7 días',           check: (s) => countMoodDays(s) >= 7 },
];

// ─── State ──────────────────────────────────────────────────
let state = {
  currentTab:    'inicio',
  todayMood:     null,
  habits:        [],
  todayProgress: {},
  calendarData:  {},
  weekProgress:  {},
  monthProgress: {},
  darkMode:      localStorage.getItem('darkMode') === 'true',
  breathTimer:   null,
  fabListenerAdded: false,
};

let diarioEntradas = {};
let diarioMoodSeleccionado = null;
let diarioTagsSeleccionados = [];
let selectedComidaRating = null;
let impulsoData = { donde: null, que: null, como: null };
let logrosDesbloqueados = {};

// ═══════════════════════════════════════════════════════════
//  UTILIDADES DE FECHA
// ═══════════════════════════════════════════════════════════
function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

// Lunes de la semana actual
function weekStart() {
  const d = new Date();
  const day = d.getDay(); // 0=dom
  const diff = (day === 0 ? -6 : 1 - day);
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

// Primer día del mes
function monthStart() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`;
}

// Rango de fechas de la semana actual (lun-dom)
function weekKeys() {
  const start = new Date(weekStart());
  return Array.from({length: 7}, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d.toISOString().slice(0, 10);
  });
}

// Rango de fechas del mes actual
function monthKeys() {
  const now = new Date();
  const days = new Date(now.getFullYear(), now.getMonth()+1, 0).getDate();
  const prefix = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  return Array.from({length: days}, (_, i) => `${prefix}-${String(i+1).padStart(2,'0')}`);
}

// Progreso de un hábito según su frecuencia
function getHabitProgress(h) {
  if (h.frecuencia === 'semanal') {
    const keys = weekKeys();
    let count = 0;
    keys.forEach(k => {
      const prog = state.calendarData[k]?.habitos?.[h.id];
      if (!prog) return;
      if (h.type === 'boolean' && prog.done) count++;
      if (h.type === 'counter' && (prog.current || 0) >= h.goal) count++;
    });
    return count;
  }
  if (h.frecuencia === 'mensual') {
    const keys = monthKeys();
    let count = 0;
    keys.forEach(k => {
      const prog = state.calendarData[k]?.habitos?.[h.id];
      if (!prog) return;
      if (h.type === 'boolean' && prog.done) count++;
      if (h.type === 'counter' && (prog.current || 0) >= h.goal) count++;
    });
    return count;
  }
  // Diario
  const prog = state.todayProgress?.habitos?.[h.id] || {};
  if (h.type === 'boolean') return prog.done ? 1 : 0;
  if (h.type === 'counter') return prog.current || 0;
  return 0;
}

// Impulsos no evitados según frecuencia del hábito especial
function getImpulsosNoEvitados(h) {
  if (h.frecuencia === 'semanal') {
    return weekKeys().reduce((acc, k) => {
      const imp = state.calendarData[k]?.impulsos || {};
      return acc + Object.values(imp).filter(i => i.mordio).length;
    }, 0);
  }
  if (h.frecuencia === 'mensual') {
    return monthKeys().reduce((acc, k) => {
      const imp = state.calendarData[k]?.impulsos || {};
      return acc + Object.values(imp).filter(i => i.mordio).length;
    }, 0);
  }
  // Diario
  const imp = state.todayProgress?.impulsos || {};
  return Object.values(imp).filter(i => i.mordio).length;
}

function getTotalImpulsosHoy() {
  return Object.values(state.todayProgress?.impulsos || {}).length;
}

function getTotalEvitados(s) {
  return Object.values(s.calendarData).reduce((acc, d) => {
    return acc + Object.values(d.impulsos || {}).filter(i => !i.mordio).length;
  }, 0);
}

function countMoodDays(s) {
  return Object.values(s.calendarData).filter(d => d.mood).length;
}

// ═══════════════════════════════════════════════════════════
//  INIT
// ═══════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  if (state.darkMode) document.body.classList.add('dark');
  setupNav();
  setupSOS();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
  initFirebaseListeners();
  renderStaticHome();
  renderSettings();
});

// ═══════════════════════════════════════════════════════════
//  FIREBASE LISTENERS
// ═══════════════════════════════════════════════════════════
function initFirebaseListeners() {
  const today = todayKey();

  DB.listen('refugio/habitos', data => {
    state.habits = data ? Object.values(data) : [];
    renderTodayHabits();
    renderHabitos();
    renderSummary();
    checkLogros();
  });

  DB.listen(`refugio/registros/${today}`, data => {
    state.todayProgress = data || {};
    state.todayMood = data?.mood || null;
    renderTodayHabits();
    renderMoodPicker();
    renderSummary();
    renderComidas();
  });

  DB.listen('refugio/registros', data => {
    state.calendarData = data || {};
    renderCalendar();
    renderConocete();
    checkLogros();
  });

  DB.listen('refugio/diario', data => {
    diarioEntradas = data || {};
    renderDiario();
    checkLogros();
  });

  DB.listen('refugio/logros', data => {
    logrosDesbloqueados = data || {};
  });
}

// ═══════════════════════════════════════════════════════════
//  NAVIGATION
// ═══════════════════════════════════════════════════════════
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
  if (fab) fab.style.display = tab === 'habitos' ? 'flex' : 'none';
}

// ═══════════════════════════════════════════════════════════
//  INICIO
// ═══════════════════════════════════════════════════════════
function renderStaticHome() {
  const hour = new Date().getHours();
  const greet = hour < 13 ? 'Buenos días' : hour < 20 ? 'Buenas tardes' : 'Buenas noches';
  document.getElementById('greeting-text').innerHTML = `${greet}, <em>Eider</em>.`;
  document.getElementById('date-text').textContent =
    new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
  document.getElementById('daily-message').textContent =
    DAILY_MESSAGES[dayOfYear % DAILY_MESSAGES.length];
  renderMoodPicker();
  renderSummary();
}

// ─── Mood ────────────────────────────────────────────────────
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
  renderMoodPicker();
  renderSummary();
  DB.update(`refugio/registros/${todayKey()}`, { mood: id });
}

// ─── Hábitos de hoy ─────────────────────────────────────────
function esHabitoEspecial(h) {
  return h.especial === true ||
    h.name.toLowerCase().includes('morder') ||
    h.name.toLowerCase().includes('mejilla');
}

function getPeriodoLabel(h) {
  if (h.frecuencia === 'semanal') return 'esta semana';
  if (h.frecuencia === 'mensual') return 'este mes';
  return 'hoy';
}

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
    const especial = esHabitoEspecial(h);
    const periodo = getPeriodoLabel(h);

    if (especial) {
      const noEvitados = getImpulsosNoEvitados(h);
      const totalImp = getTotalImpulsosHoy();
      const evitadosHoy = Object.values(state.todayProgress?.impulsos || {}).filter(i => !i.mordio).length;
      const max = h.goal || 5;
      const pct = Math.min(100, Math.round((noEvitados / max) * 100));
      const color = noEvitados >= max ? '#E07070' : noEvitados >= max * 0.6 ? '#E0A870' : 'var(--c-sage)';

      return `
        <div class="habit-item" id="habit-item-${h.id}">
          <div class="habit-icon" style="background:${h.color}20;">${h.icon}</div>
          <div class="habit-info">
            <div class="habit-name">${h.name}</div>
            <div class="habit-progress-text">
              ${totalImp} impulsos · ${evitadosHoy} evitados · ${noEvitados}/${max} no evitados ${periodo}
            </div>
            <div class="habit-bar-wrap">
              <div class="habit-bar" style="width:${pct}%;background:${color}"></div>
            </div>
          </div>
          <button onclick="abrirImpulso()"
            style="padding:7px 12px;border-radius:99px;border:1.5px solid #F0D0D0;
                   background:none;color:#C07070;font-size:12px;font-weight:500;
                   cursor:pointer;white-space:nowrap;flex-shrink:0;-webkit-tap-highlight-color:transparent;">
            He tenido ganas
          </button>
        </div>`;
    }

    // Hábito normal
    const progress = getHabitProgress(h);
    const goal = h.frecuenciaVeces || h.goal || 1;
    let done = false;
    let pct = 0;
    let progressText = '';

    if (h.frecuencia === 'semanal' || h.frecuencia === 'mensual') {
      done = progress >= goal;
      pct = Math.min(100, Math.round((progress / goal) * 100));
      progressText = `${progress}/${goal} veces ${periodo}`;
    } else {
      // Diario
      if (h.type === 'boolean') {
        done = progress === 1;
        pct = done ? 100 : 0;
        progressText = done ? '¡Completado! ✓' : 'Pendiente';
      } else {
        done = progress >= (h.goal || 1);
        pct = Math.min(100, Math.round((progress / (h.goal || 1)) * 100));
        progressText = `${progress} / ${h.goal} ${h.unit || ''}`;
      }
    }

    return `
      <div class="habit-item ${done ? 'completed' : ''}" id="habit-item-${h.id}">
        <div class="habit-icon" style="background:${h.color}20;">${h.icon}</div>
        <div class="habit-info">
          <div class="habit-name">${h.name}</div>
          <div class="habit-progress-text">${progressText}</div>
          ${(h.frecuencia === 'semanal' || h.frecuencia === 'mensual' || h.type === 'counter') ? `
            <div class="habit-bar-wrap">
              <div class="habit-bar" style="width:${pct}%;background:${h.color}"></div>
            </div>
          ` : ''}
        </div>
        ${h.frecuencia === 'semanal' || h.frecuencia === 'mensual' ? `
          <button class="check-btn ${done ? 'done' : ''}" id="check-${h.id}"
                  onclick="toggleHabit('${h.id}', ${done})">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M2 7L5.5 10.5L12 4" stroke="white" stroke-width="2"
                    stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
        ` : h.type === 'boolean' ? `
          <button class="check-btn ${done ? 'done' : ''}" id="check-${h.id}"
                  onclick="toggleHabit('${h.id}', ${done})">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M2 7L5.5 10.5L12 4" stroke="white" stroke-width="2"
                    stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
        ` : `
          <div style="display:flex;gap:6px;align-items:center;">
            <button onclick="changeCounter('${h.id}', -1)"
              style="width:28px;height:28px;border-radius:50%;border:1.5px solid var(--c-border);background:none;font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;color:var(--c-text);">−</button>
            <button onclick="changeCounter('${h.id}', 1)"
              style="width:28px;height:28px;border-radius:50%;border:none;background:var(--c-sage);color:white;font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;">+</button>
          </div>
        `}
      </div>`;
  }).join('');
}

function toggleHabit(id, currentDone) {
  const newDone = !currentDone;
  const btn = document.getElementById('check-' + id);
  if (btn) {
    btn.classList.toggle('done', newDone);
    btn.classList.add('bloom');
    setTimeout(() => btn.classList.remove('bloom'), 500);
  }
  DB.update(`refugio/registros/${todayKey()}/habitos/${id}`, { done: newDone })
    .then(() => saveDaySummary());
}

function changeCounter(id, delta) {
  const habit = state.habits.find(h => h.id === id);
  if (!habit) return;
  const current = state.todayProgress?.habitos?.[id]?.current ?? 0;
  const newVal = Math.max(0, Math.min(habit.goal, current + delta));
  DB.update(`refugio/registros/${todayKey()}/habitos/${id}`, { current: newVal })
    .then(() => saveDaySummary());
}

function saveDaySummary() {
  const today = todayKey();
  const prog = state.todayProgress?.habitos || {};
  const dailyHabits = state.habits.filter(h => !h.frecuencia || h.frecuencia === 'diario');
  const total = dailyHabits.length;
  if (!total) return;
  const completed = dailyHabits.filter(h => {
    const p = prog[h.id] || {};
    if (h.type === 'boolean') return !!p.done;
    if (h.type === 'counter') return (p.current ?? 0) >= h.goal;
    return false;
  }).length;
  const pct = Math.round((completed / total) * 100);
  let color = 'no-data';
  if (pct >= 90) color = 'excellent';
  else if (pct >= 60) color = 'good';
  else if (pct >= 30) color = 'normal';
  else if (pct > 0) color = 'difficult';
  else color = 'bad';
  DB.update(`refugio/registros/${today}`, { pct, color, completed, total });
}

function renderSummary() {
  const prog = state.todayProgress?.habitos || {};
  const dailyHabits = state.habits.filter(h => !h.frecuencia || h.frecuencia === 'diario');
  const completed = dailyHabits.filter(h => {
    const p = prog[h.id] || {};
    if (h.type === 'boolean') return !!p.done;
    if (h.type === 'counter') return (p.current ?? 0) >= h.goal;
    return false;
  }).length;

  const elH = document.getElementById('summary-habitos');
  const elM = document.getElementById('summary-mood');
  const elC = document.getElementById('summary-comidas');
  const elI = document.getElementById('summary-evitados');
  if (elH) elH.textContent = dailyHabits.length ? `${completed}/${dailyHabits.length}` : '—';
  if (elM) elM.textContent = state.todayMood ? MOODS.find(m => m.id === state.todayMood)?.emoji || '—' : '—';
  if (elC) elC.textContent = Object.keys(state.todayProgress?.comidas || {}).length || '—';
  if (elI) {
    const evitados = Object.values(state.todayProgress?.impulsos || {}).filter(i => !i.mordio).length;
    elI.textContent = evitados || '—';
  }
}

// ═══════════════════════════════════════════════════════════
//  SOS
// ═══════════════════════════════════════════════════════════
function setupSOS() {
  document.getElementById('sos-btn')?.addEventListener('click', openSOS);
  document.getElementById('sos-back')?.addEventListener('click', closeSOS);
  document.getElementById('sos-start-breath')?.addEventListener('click', startBreathing);
  document.getElementById('sos-done-yes')?.addEventListener('click', () => logSOSResult(true));
  document.getElementById('sos-done-no')?.addEventListener('click', () => logSOSResult(false));
}

function openSOS() {
  document.getElementById('sos-screen').classList.add('open');
  showSOSStep('breath');
  document.getElementById('sos-start-breath').style.display = '';
  document.getElementById('breath-circle').className = 'breath-circle';
  document.getElementById('breath-label').textContent = 'Pulsa para empezar';
}

function closeSOS() {
  stopBreathing();
  document.getElementById('sos-screen').classList.remove('open');
}

function showSOSStep(step) {
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
  document.getElementById('sos-start-breath').style.display = 'none';
  const phases = [
    { name: 'Inhala...', cls: 'inhale', dur: 4000 },
    { name: 'Aguanta.',  cls: '',       dur: 2000 },
    { name: 'Exhala...', cls: 'exhale', dur: 4000 },
  ];
  let phase = 0, cycles = 0;
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
  runPhase();
}

function stopBreathing() {
  if (state.breathTimer) { clearTimeout(state.breathTimer); state.breathTimer = null; }
}

function logSOSResult(passed) {
  DB.push('refugio/sos', { timestamp: Date.now(), passed });
  closeSOS();
}

// ═══════════════════════════════════════════════════════════
//  HÁBITOS SCREEN
// ═══════════════════════════════════════════════════════════
function renderHabitos() {
  const list = document.getElementById('habitos-list');
  if (!list) return;
  if (!state.fabListenerAdded) {
    document.getElementById('fab')?.addEventListener('click', () => openHabitSheet(null));
    state.fabListenerAdded = true;
  }
  if (!state.habits.length) {
    list.innerHTML = `<div class="empty-state">
      <div class="empty-icon">🌱</div>
      <p>Aún no tienes hábitos.<br>Pulsa el + para crear el primero.</p>
    </div>`;
    return;
  }
  const types = { boolean: 'Sí / No', counter: 'Contador', timer: 'Temporizador', value: 'Valor' };
  const freqs = { diario: 'Diario', semanal: 'Semanal', mensual: 'Mensual' };
  list.innerHTML = state.habits.map(h => `
    <div class="habit-card" onclick="openHabitSheet(${JSON.stringify(h).replace(/"/g, '&quot;')})">
      <div class="habit-card-icon" style="background:${h.color}30;">${h.icon}</div>
      <div class="habit-card-info">
        <div class="habit-card-name">${h.name}</div>
        <div class="habit-card-meta">
          ${types[h.type] || ''}
          ${h.frecuenciaVeces ? ` · ${h.frecuenciaVeces} veces` : ''}
          ${h.frecuencia ? ` · ${freqs[h.frecuencia] || ''}` : ''}
          ${h.goal && !h.frecuenciaVeces ? ` · Obj: ${h.goal} ${h.unit||''}` : ''}
        </div>
      </div>
      <span style="color:var(--c-text-muted);font-size:18px;">›</span>
    </div>
  `).join('');
}

function openHabitSheet(habit) {
  const isNew = !habit;
  document.getElementById('habit-form-id').value          = habit?.id    || '';
  document.getElementById('habit-form-name').value        = habit?.name  || '';
  document.getElementById('habit-form-icon').value        = habit?.icon  || '✨';
  document.getElementById('habit-form-color').value       = habit?.color || '#8FAF8A';
  document.getElementById('habit-form-type').value        = habit?.type  || 'boolean';
  document.getElementById('habit-form-goal').value        = habit?.goal  || '';
  document.getElementById('habit-form-unit').value        = habit?.unit  || '';
  document.getElementById('habit-form-frecuencia').value  = habit?.frecuencia || 'diario';
  document.getElementById('habit-form-veces').value       = habit?.frecuenciaVeces || '';
  document.getElementById('habit-sheet-title').textContent = isNew ? 'Nuevo hábito' : 'Editar hábito';
  document.getElementById('delete-habit-btn').style.display = isNew ? 'none' : 'block';
  toggleGoalFields();
  document.getElementById('habit-sheet').classList.add('open');
}

function closeHabitSheet() {
  document.getElementById('habit-sheet').classList.remove('open');
}

function toggleGoalFields() {
  const type = document.getElementById('habit-form-type')?.value;
  const freq = document.getElementById('habit-form-frecuencia')?.value;
  const goalRow = document.getElementById('goal-row');
  // Mostrar objetivo si es contador/valor O si es semanal/mensual (para las veces)
  if (goalRow) goalRow.style.display =
    (type === 'counter' || type === 'value' || freq === 'semanal' || freq === 'mensual') ? 'block' : 'none';
}

function saveHabitForm() {
  const id   = document.getElementById('habit-form-id').value || Date.now().toString();
  const name = document.getElementById('habit-form-name').value.trim();
  if (!name) { showToast('Ponle un nombre al hábito 🌸'); return; }
  const frecuencia = document.getElementById('habit-form-frecuencia').value;
  const habit = {
    id, name,
    icon:  document.getElementById('habit-form-icon').value.trim() || '✨',
    color: document.getElementById('habit-form-color').value,
    type:  document.getElementById('habit-form-type').value,
    goal:  parseInt(document.getElementById('habit-form-goal').value) || null,
    unit:  document.getElementById('habit-form-unit').value.trim(),
    frecuencia,
    createdAt: Date.now()
  };
  DB.set(`refugio/habitos/${id}`, habit).then(() => {
    closeHabitSheet();
    showToast('Hábito guardado 🌱');
  });
}

function deleteHabit() {
  const id = document.getElementById('habit-form-id').value;
  if (!id) return;
  if (!confirm('¿Eliminar este hábito?')) return;
  DB.remove(`refugio/habitos/${id}`).then(() => {
    closeHabitSheet();
    showToast('Hábito eliminado');
  });
}

// ═══════════════════════════════════════════════════════════
//  HOY COMO
// ═══════════════════════════════════════════════════════════
function renderComidas() {
  const list = document.getElementById('comidas-list');
  if (!list) return;
  const comidas = state.todayProgress?.comidas || {};
  list.innerHTML = COMIDAS.map(c => {
    const reg = comidas[c.id];
    const rating = reg ? RATINGS.find(r => r.id === reg.rating) : null;
    return `
      <div class="card" style="margin-bottom:12px;cursor:pointer;" onclick="openComidaSheet('${c.id}')">
        <div style="display:flex;align-items:center;gap:14px;">
          <div style="font-size:28px;width:44px;text-align:center;">${c.icon}</div>
          <div style="flex:1;">
            <div style="font-size:15px;font-weight:500;color:var(--c-text);">${c.label}</div>
            ${reg ? `
              <div style="display:flex;align-items:center;gap:6px;margin-top:4px;">
                <span style="font-size:16px;">${rating?.emoji || ''}</span>
                <span style="font-size:13px;color:var(--c-text-soft);">${rating?.label || ''}</span>
                ${reg.notas ? `<span style="font-size:12px;color:var(--c-text-muted);">· ${reg.notas.slice(0,30)}${reg.notas.length>30?'...':''}</span>` : ''}
              </div>
            ` : `<div style="font-size:13px;color:var(--c-text-muted);margin-top:3px;">Sin registrar · toca para añadir</div>`}
          </div>
          ${reg ? `<div style="width:8px;height:8px;border-radius:50%;background:var(--c-sage);flex-shrink:0;"></div>` : `<div style="color:var(--c-text-muted);font-size:18px;">+</div>`}
        </div>
      </div>`;
  }).join('');
}

function openComidaSheet(tipo) {
  const comida = COMIDAS.find(c => c.id === tipo);
  if (!comida) return;
  document.getElementById('comida-form-tipo').value = tipo;
  document.getElementById('comida-sheet-title').textContent = `${comida.icon} ${comida.label}`;
  const existing = state.todayProgress?.comidas?.[tipo];
  selectedComidaRating = existing?.rating || null;
  document.getElementById('comida-form-notas').value = existing?.notas || '';
  renderRatingGrid();
  document.getElementById('comida-sheet').classList.add('open');
}

function closeComidaSheet() {
  document.getElementById('comida-sheet').classList.remove('open');
  selectedComidaRating = null;
}

function renderRatingGrid() {
  const grid = document.getElementById('comida-rating-grid');
  if (!grid) return;
  grid.innerHTML = RATINGS.map(r => `
    <button onclick="selectRating('${r.id}')"
      style="display:flex;flex-direction:column;align-items:center;gap:4px;padding:10px 4px;
             border-radius:12px;border:2px solid ${selectedComidaRating === r.id ? 'var(--c-sage)' : 'var(--c-border)'};
             background:${selectedComidaRating === r.id ? 'var(--c-sage-dim)' : 'var(--c-bg)'};cursor:pointer;">
      <span style="font-size:22px;">${r.emoji}</span>
      <span style="font-size:10px;font-weight:500;color:${selectedComidaRating === r.id ? 'var(--c-sage)' : 'var(--c-text-muted)'};">${r.label}</span>
    </button>
  `).join('');
}

function selectRating(id) {
  selectedComidaRating = id;
  renderRatingGrid();
}

function saveComida() {
  if (!selectedComidaRating) { showToast('Elige cómo ha ido la comida 🥗'); return; }
  const tipo  = document.getElementById('comida-form-tipo').value;
  const notas = document.getElementById('comida-form-notas').value.trim();
  DB.update(`refugio/registros/${todayKey()}/comidas/${tipo}`, {
    rating: selectedComidaRating, notas, timestamp: Date.now()
  }).then(() => { closeComidaSheet(); showToast('Comida registrada 🥗'); renderSummary(); });
}

// ═══════════════════════════════════════════════════════════
//  IMPULSO ESPECIAL
// ═══════════════════════════════════════════════════════════
function abrirImpulso() {
  impulsoData = { donde: null, que: null, como: null };
  renderImpulsoStep('donde');
  document.getElementById('impulso-screen').classList.add('open');
}

function closeImpulso() {
  document.getElementById('impulso-screen').classList.remove('open');
}

function renderImpulsoStep(step) {
  ['donde','que','como','resultado'].forEach(s => {
    const el = document.getElementById('impulso-step-' + s);
    if (el) el.style.display = 'none';
  });
  const active = document.getElementById('impulso-step-' + step);
  if (active) active.style.display = 'flex';
  if (step === 'donde') renderOpts('impulso-donde-opts', IMPULSO_DONDE, v => { impulsoData.donde = v; renderImpulsoStep('que'); });
  if (step === 'que')   renderOpts('impulso-que-opts',   IMPULSO_QUE,   v => { impulsoData.que   = v; renderImpulsoStep('como'); });
  if (step === 'como')  renderOpts('impulso-como-opts',  IMPULSO_COMO,  v => { impulsoData.como  = v; renderImpulsoStep('resultado'); });
}

function renderOpts(containerId, options, onSelect) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = options.map(opt => `
    <button onclick="(${onSelect.toString()})('${opt}')"
      style="width:100%;padding:14px 18px;border-radius:14px;border:1.5px solid var(--c-border);
             background:var(--c-surface);font-family:'Inter',sans-serif;font-size:15px;
             color:var(--c-text);cursor:pointer;text-align:left;transition:all 0.15s;
             -webkit-tap-highlight-color:transparent;">
      ${opt}
    </button>
  `).join('');
}

function guardarImpulso(seMordio) {
  const registro = { ...impulsoData, mordio: seMordio, timestamp: Date.now(), fecha: todayKey() };
  DB.push(`refugio/registros/${todayKey()}/impulsos`, registro);
  DB.push('refugio/impulsos', registro);
  closeImpulso();
  if (seMordio) {
    showToast('Registrado. La próxima vez puedes intentar el SOS 🌿', 3000);
  } else {
    showToast('¡Lo evitaste! Eso cuenta mucho 💚', 3000);
    setTimeout(() => openSOS(), 600);
  }
  renderTodayHabits();
  renderSummary();
  checkLogros();
}

// ═══════════════════════════════════════════════════════════
//  DIARIO
// ═══════════════════════════════════════════════════════════
function renderDiario() {
  const list = document.getElementById('diario-list');
  if (!list) return;
  const entradas = Object.entries(diarioEntradas).sort((a, b) => b[1].timestamp - a[1].timestamp);
  if (!entradas.length) {
    list.innerHTML = `<div class="empty-state">
      <div class="empty-icon">📖</div>
      <p>Tu diario está vacío.<br>Pulsa "+ Escribir" para tu primera entrada.</p>
    </div>`;
    return;
  }
  list.innerHTML = entradas.map(([id, e]) => {
    const fecha = new Date(e.timestamp).toLocaleDateString('es-ES', { weekday:'long', day:'numeric', month:'long' });
    const mood = e.mood ? MOODS.find(m => m.id === e.mood) : null;
    const preview = e.texto ? e.texto.slice(0, 120) + (e.texto.length > 120 ? '...' : '') : '';
    return `
      <div class="card" style="margin-bottom:12px;cursor:pointer;" onclick="abrirEntrada('${id}')">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
          <div style="font-size:12px;color:var(--c-text-muted);text-transform:capitalize;">${fecha}</div>
          ${mood ? `<span style="font-size:18px;">${mood.emoji}</span>` : ''}
        </div>
        ${preview ? `<div style="font-size:14px;color:var(--c-text-soft);line-height:1.55;">${preview}</div>` : ''}
        ${e.tags?.length ? `
          <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:10px;">
            ${e.tags.map(t => `<span style="font-size:11px;background:var(--c-sage-dim);color:var(--c-sage);padding:3px 10px;border-radius:99px;font-weight:500;">${t}</span>`).join('')}
          </div>` : ''}
      </div>`;
  }).join('');
}

function filtrarEntradas(query) {
  const list = document.getElementById('diario-list');
  if (!list) return;
  if (!query.trim()) { renderDiario(); return; }
  const q = query.toLowerCase();
  const filtradas = Object.entries(diarioEntradas)
    .filter(([, e]) => e.texto?.toLowerCase().includes(q) || e.tags?.some(t => t.toLowerCase().includes(q)))
    .sort((a, b) => b[1].timestamp - a[1].timestamp);
  if (!filtradas.length) {
    list.innerHTML = `<div class="empty-state"><div class="empty-icon">🔍</div><p>No hay entradas que coincidan.</p></div>`;
    return;
  }
  list.innerHTML = filtradas.map(([id, e]) => {
    const fecha = new Date(e.timestamp).toLocaleDateString('es-ES', { weekday:'long', day:'numeric', month:'long' });
    const mood = e.mood ? MOODS.find(m => m.id === e.mood) : null;
    const preview = e.texto ? e.texto.slice(0, 120) + (e.texto.length > 120 ? '...' : '') : '';
    return `
      <div class="card" style="margin-bottom:12px;cursor:pointer;" onclick="abrirEntrada('${id}')">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
          <div style="font-size:12px;color:var(--c-text-muted);text-transform:capitalize;">${fecha}</div>
          ${mood ? `<span style="font-size:18px;">${mood.emoji}</span>` : ''}
        </div>
        ${preview ? `<div style="font-size:14px;color:var(--c-text-soft);line-height:1.55;">${preview}</div>` : ''}
      </div>`;
  }).join('');
}

function abrirNuevaEntrada() {
  diarioMoodSeleccionado = null;
  diarioTagsSeleccionados = [];
  document.getElementById('diario-form-id').value = '';
  document.getElementById('diario-form-texto').value = '';
  document.getElementById('diario-sheet-title').textContent = 'Nueva entrada';
  document.getElementById('diario-delete-btn').style.display = 'none';
  renderDiarioMoodGrid();
  renderDiarioTagsGrid();
  document.getElementById('diario-sheet').classList.add('open');
}

function abrirEntrada(id) {
  const e = diarioEntradas[id];
  if (!e) return;
  diarioMoodSeleccionado = e.mood || null;
  diarioTagsSeleccionados = e.tags || [];
  document.getElementById('diario-form-id').value = id;
  document.getElementById('diario-form-texto').value = e.texto || '';
  document.getElementById('diario-sheet-title').textContent = 'Editar entrada';
  document.getElementById('diario-delete-btn').style.display = 'block';
  renderDiarioMoodGrid();
  renderDiarioTagsGrid();
  document.getElementById('diario-sheet').classList.add('open');
}

function closeDiarioSheet() {
  document.getElementById('diario-sheet').classList.remove('open');
}

function renderDiarioMoodGrid() {
  const grid = document.getElementById('diario-mood-grid');
  if (!grid) return;
  grid.innerHTML = MOODS.map(m => `
    <button onclick="seleccionarDiarioMood('${m.id}')"
      style="display:flex;flex-direction:column;align-items:center;gap:3px;padding:8px 6px;
             border-radius:12px;border:2px solid ${diarioMoodSeleccionado === m.id ? 'var(--c-sage)' : 'var(--c-border)'};
             background:${diarioMoodSeleccionado === m.id ? 'var(--c-sage-dim)' : 'var(--c-bg)'};
             cursor:pointer;min-width:48px;">
      <span style="font-size:20px;">${m.emoji}</span>
      <span style="font-size:9px;font-weight:500;color:${diarioMoodSeleccionado === m.id ? 'var(--c-sage)' : 'var(--c-text-muted)'};">${m.label}</span>
    </button>
  `).join('');
}

function seleccionarDiarioMood(id) {
  diarioMoodSeleccionado = diarioMoodSeleccionado === id ? null : id;
  renderDiarioMoodGrid();
}

function renderDiarioTagsGrid() {
  const grid = document.getElementById('diario-tags-grid');
  if (!grid) return;
  grid.innerHTML = DIARIO_TAGS.map(t => {
    const sel = diarioTagsSeleccionados.includes(t);
    return `<button onclick="toggleDiarioTag('${t}')"
      style="padding:6px 14px;border-radius:99px;font-size:12px;font-weight:500;cursor:pointer;
             border:1.5px solid ${sel ? 'var(--c-sage)' : 'var(--c-border)'};
             background:${sel ? 'var(--c-sage-dim)' : 'var(--c-bg)'};
             color:${sel ? 'var(--c-sage)' : 'var(--c-text-muted)'};">${t}</button>`;
  }).join('');
}

function toggleDiarioTag(tag) {
  diarioTagsSeleccionados = diarioTagsSeleccionados.includes(tag)
    ? diarioTagsSeleccionados.filter(t => t !== tag)
    : [...diarioTagsSeleccionados, tag];
  renderDiarioTagsGrid();
}

function guardarEntradaDiario() {
  const texto = document.getElementById('diario-form-texto').value.trim();
  if (!texto) { showToast('Escribe algo antes de guardar 📖'); return; }
  const id = document.getElementById('diario-form-id').value || Date.now().toString();
  DB.set(`refugio/diario/${id}`, {
    texto, mood: diarioMoodSeleccionado, tags: diarioTagsSeleccionados,
    timestamp: diarioEntradas[id]?.timestamp || Date.now(),
    updatedAt: Date.now(), fecha: todayKey()
  }).then(() => { closeDiarioSheet(); showToast('Entrada guardada 📖'); checkLogros(); });
}

function eliminarEntradaDiario() {
  const id = document.getElementById('diario-form-id').value;
  if (!id || !confirm('¿Eliminar esta entrada del diario?')) return;
  DB.remove(`refugio/diario/${id}`).then(() => { closeDiarioSheet(); showToast('Entrada eliminada'); });
}

// ═══════════════════════════════════════════════════════════
//  CALENDARIO
// ═══════════════════════════════════════════════════════════
function renderCalendar() {
  const now = new Date();
  const year = now.getFullYear(), month = now.getMonth(), today = now.getDate();
  const monthName = now.toLocaleDateString('es-ES', { month:'long', year:'numeric' });
  const el = document.getElementById('cal-month-name');
  if (el) el.textContent = monthName.charAt(0).toUpperCase() + monthName.slice(1);
  const offset = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month+1, 0).getDate();
  const grid = document.getElementById('cal-grid');
  if (!grid) return;
  let html = ['L','M','X','J','V','S','D'].map(d => `<div class="cal-day-label">${d}</div>`).join('');
  for (let i = 0; i < offset; i++) html += `<div class="cal-day empty"></div>`;
  for (let d = 1; d <= daysInMonth; d++) {
    const dateKey = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const isToday = d === today;
    const isFuture = d > today;
    const dayData = state.calendarData[dateKey];
    const cls = !isFuture && dayData?.color ? dayData.color : 'no-data';
    html += `<div class="cal-day ${cls} ${isToday?'today':''}" onclick="openDay('${dateKey}')">${d}</div>`;
  }
  grid.innerHTML = html;
}

function openDay(dateKey) {
  const data = state.calendarData[dateKey];
  if (!data) return;
  const mood = data.mood ? MOODS.find(m => m.id === data.mood) : null;
  const lines = [
    `📅 ${dateKey}`,
    data.completed !== undefined ? `✅ Hábitos: ${data.completed}/${data.total}` : '',
    mood ? `${mood.emoji} Estado: ${mood.label}` : '',
  ].filter(Boolean).join('\n');
  showToast(lines, 3000);
}

// ═══════════════════════════════════════════════════════════
//  CONÓCETE
// ═══════════════════════════════════════════════════════════
function calcStreak(s) {
  const today = new Date();
  let streak = 0;
  for (let i = 0; i < 60; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const reg = s.calendarData[key];
    if (reg && reg.completed > 0) streak++;
    else break;
  }
  return streak;
}

function renderConocete() {
  const list = document.getElementById('insights-list');
  if (!list) return;
  const dias = Object.entries(state.calendarData);
  if (dias.length < 1) {
    list.innerHTML = `<div class="empty-state">
      <div class="empty-icon">📊</div>
      <p>Usa la app unos días y aquí irán apareciendo tus patrones. 🌱</p>
    </div>`;
    return;
  }
  const insights = [];
  const streak = calcStreak(state);
  if (streak > 1) insights.push({ icon:'🔥', text:`Llevas <strong>${streak} días seguidos</strong> completando al menos un hábito.` });
  const byWD = Array(7).fill(null).map(() => ({sum:0,count:0}));
  dias.forEach(([k,d]) => { if (d.pct !== undefined) { const wd=new Date(k).getDay(); byWD[wd].sum+=d.pct; byWD[wd].count++; }});
  const bestDay = byWD.map((x,i)=>({day:i,avg:x.count?x.sum/x.count:-1})).filter(x=>x.avg>=0).sort((a,b)=>b.avg-a.avg)[0];
  const dayNames=['domingos','lunes','martes','miércoles','jueves','viernes','sábados'];
  if (bestDay?.avg>0) insights.push({icon:'⭐',text:`Los <strong>${dayNames[bestDay.day]}</strong> sueles completar más hábitos (${Math.round(bestDay.avg)}% de media).`});
  const moodCount={};
  dias.forEach(([,d])=>{ if(d.mood) moodCount[d.mood]=(moodCount[d.mood]||0)+1; });
  const topMood=Object.entries(moodCount).sort((a,b)=>b[1]-a[1])[0];
  if (topMood) { const m=MOODS.find(x=>x.id===topMood[0]); if(m) insights.push({icon:m.emoji,text:`Tu estado más frecuente ha sido <strong>${m.label}</strong> (${topMood[1]} ${topMood[1]===1?'día':'días'}).`}); }
  const totalEvitados = getTotalEvitados(state);
  if (totalEvitados > 0) insights.push({icon:'💚',text:`Has evitado <strong>${totalEvitados} impulsos</strong> en total. Cada uno cuenta.`});
  const daysWithData = dias.filter(([,d])=>d.completed!==undefined).length;
  insights.push({icon:'📅',text:`Llevas <strong>${daysWithData} ${daysWithData===1?'día':'días'}</strong> usando Mi Refugio.`});
  const best=dias.filter(([,d])=>d.pct!==undefined).sort((a,b)=>b[1].pct-a[1].pct)[0];
  if (best) { const bd=new Date(best[0]).toLocaleDateString('es-ES',{weekday:'long',day:'numeric',month:'long'}); insights.push({icon:'🌟',text:`Tu mejor día fue el <strong>${bd}</strong> con un ${best[1].pct}% de hábitos completados.`}); }
  list.innerHTML = insights.map(i=>`
    <div class="insight-card">
      <div class="insight-icon">${i.icon}</div>
      <div class="insight-text">${i.text}</div>
    </div>`).join('');
}

// ═══════════════════════════════════════════════════════════
//  LOGROS
// ═══════════════════════════════════════════════════════════
function checkLogros() {
  LOGROS_DEF.forEach(logro => {
    if (logrosDesbloqueados[logro.id]) return; // ya desbloqueado
    if (logro.check(state)) {
      logrosDesbloqueados[logro.id] = { unlockedAt: Date.now() };
      DB.set(`refugio/logros/${logro.id}`, { unlockedAt: Date.now() });
      mostrarLogroDesbloqueado(logro);
    }
  });
}

function mostrarLogroDesbloqueado(logro) {
  const el = document.createElement('div');
  el.style.cssText = `
    position:fixed;top:60px;left:50%;transform:translateX(-50%) translateY(-20px);
    background:var(--c-surface);border:1.5px solid var(--c-gold);
    border-radius:16px;padding:16px 20px;z-index:999;
    box-shadow:0 8px 32px rgba(200,168,90,0.25);
    display:flex;align-items:center;gap:12px;
    max-width:300px;width:90%;
    opacity:0;transition:all 0.4s;
  `;
  el.innerHTML = `
    <div style="font-size:32px;">${logro.icon}</div>
    <div>
      <div style="font-size:10px;font-weight:500;color:var(--c-gold);letter-spacing:0.08em;text-transform:uppercase;">¡Logro desbloqueado!</div>
      <div style="font-size:15px;font-weight:500;color:var(--c-text);margin-top:2px;">${logro.titulo}</div>
      <div style="font-size:12px;color:var(--c-text-muted);margin-top:2px;">${logro.desc}</div>
    </div>
  `;
  document.body.appendChild(el);
  requestAnimationFrame(() => {
    el.style.opacity = '1';
    el.style.transform = 'translateX(-50%) translateY(0)';
  });
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transform = 'translateX(-50%) translateY(-20px)';
    setTimeout(() => el.remove(), 400);
  }, 4000);
}

// ═══════════════════════════════════════════════════════════
//  AJUSTES
// ═══════════════════════════════════════════════════════════
function renderSettings() {
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

function exportData() {
  const data = { habits: state.habits, registros: state.calendarData, exportedAt: new Date().toISOString() };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `refugio-backup-${todayKey()}.json`;
  a.click();
}

// ═══════════════════════════════════════════════════════════
//  TOAST
// ═══════════════════════════════════════════════════════════
function showToast(msg, duration = 2000) {
  let toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    toast.style.cssText = `
      position:fixed;bottom:calc(var(--tab-h) + 20px);left:50%;
      transform:translateX(-50%) translateY(20px);
      background:var(--c-text);color:var(--c-bg);padding:12px 20px;
      border-radius:99px;font-size:13px;font-weight:500;z-index:998;
      opacity:0;transition:all 0.3s;white-space:pre-line;text-align:center;
      max-width:280px;line-height:1.4;
    `;
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  requestAnimationFrame(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateX(-50%) translateY(0)';
  });
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(-50%) translateY(20px)';
  }, duration);
}

// ═══════════════════════════════════════════════════════════
//  LOGROS — pantalla
// ═══════════════════════════════════════════════════════════
function abrirLogros() {
  renderLogrosPanel();
  document.getElementById('logros-overlay').classList.add('open');
}

function cerrarLogros() {
  document.getElementById('logros-overlay').classList.remove('open');
}

function renderLogrosPanel() {
  const list = document.getElementById('logros-list');
  if (!list) return;

  list.innerHTML = LOGROS_DEF.map(logro => {
    const desbloqueado = !!logrosDesbloqueados[logro.id];
    const fecha = desbloqueado
      ? new Date(logrosDesbloqueados[logro.id].unlockedAt).toLocaleDateString('es-ES', { day:'numeric', month:'long' })
      : null;

    return `
      <div style="display:flex;align-items:center;gap:14px;padding:14px 0;
                  border-bottom:1px solid var(--c-border);opacity:${desbloqueado ? '1' : '0.4'};">
        <div style="font-size:32px;width:44px;text-align:center;
                    filter:${desbloqueado ? 'none' : 'grayscale(1)'};">
          ${logro.icon}
        </div>
        <div style="flex:1;">
          <div style="font-size:14px;font-weight:500;color:var(--c-text);">${logro.titulo}</div>
          <div style="font-size:12px;color:var(--c-text-muted);margin-top:2px;">${logro.desc}</div>
          ${fecha ? `<div style="font-size:11px;color:var(--c-gold);margin-top:3px;font-weight:500;">Desbloqueado el ${fecha}</div>` : ''}
        </div>
        ${desbloqueado ? `<span style="font-size:18px;">✓</span>` : `<span style="font-size:14px;color:var(--c-text-muted);">🔒</span>`}
      </div>`;
  }).join('');

  const total = LOGROS_DEF.length;
  const conseguidos = Object.keys(logrosDesbloqueados).length;
  list.insertAdjacentHTML('afterbegin', `
    <div style="text-align:center;padding:8px 0 20px;">
      <div style="font-family:'Playfair Display',serif;font-size:32px;color:var(--c-gold);">
        ${conseguidos}<span style="font-size:18px;color:var(--c-text-muted);">/${total}</span>
      </div>
      <div style="font-size:12px;color:var(--c-text-muted);margin-top:4px;">logros conseguidos</div>
    </div>
  `);
}

// ═══════════════════════════════════════════════════════════
//  REFLEXIÓN DIARIA
// ═══════════════════════════════════════════════════════════
function guardarHoraReflexion(hora) {
  localStorage.setItem('reflexionHora', hora);
  checkReflexionBanner();
  showToast(`Reflexión configurada a las ${hora} 🌙`);
}

function checkReflexionBanner() {
  const hora = localStorage.getItem('reflexionHora');
  const banner = document.getElementById('reflexion-banner');
  if (!banner) return;

  if (!hora) { banner.style.display = 'none'; return; }

  const now = new Date();
  const [hh, mm] = hora.split(':').map(Number);
  const horaConfig = new Date();
  horaConfig.setHours(hh, mm, 0, 0);

  // Mostrar si es después de la hora configurada
  const mostrar = now >= horaConfig;

  // Y si aún no ha hecho la reflexión de hoy
  const yaHecha = localStorage.getItem('reflexion_' + todayKey());
  banner.style.display = (mostrar && !yaHecha) ? 'block' : 'none';
}

function abrirReflexion() {
  const today = todayKey();
  document.getElementById('reflexion-fecha').value = today;

  // Cargar si ya existe
  DB.get(`refugio/reflexiones/${today}`).then(data => {
    document.getElementById('ref-mejor').value    = data?.mejor    || '';
    document.getElementById('ref-dificil').value  = data?.dificil  || '';
    document.getElementById('ref-orgullosa').value = data?.orgullosa || '';
    document.getElementById('ref-manana').value   = data?.manana   || '';
  }).catch(() => {});

  document.getElementById('reflexion-overlay').classList.add('open');
}

function cerrarReflexion() {
  document.getElementById('reflexion-overlay').classList.remove('open');
}

function guardarReflexion() {
  const fecha = document.getElementById('reflexion-fecha').value || todayKey();
  const data = {
    mejor:     document.getElementById('ref-mejor').value.trim(),
    dificil:   document.getElementById('ref-dificil').value.trim(),
    orgullosa: document.getElementById('ref-orgullosa').value.trim(),
    manana:    document.getElementById('ref-manana').value.trim(),
    timestamp: Date.now()
  };

  if (!data.mejor && !data.dificil && !data.orgullosa && !data.manana) {
    showToast('Escribe algo antes de guardar 🌙');
    return;
  }

  DB.set(`refugio/reflexiones/${fecha}`, data).then(() => {
    localStorage.setItem('reflexion_' + fecha, '1');
    cerrarReflexion();
    checkReflexionBanner();
    showToast('Reflexión guardada 🌙');
  });
}

// Arrancar el check del banner al cargar
document.addEventListener('DOMContentLoaded', () => {
  // Restaurar hora guardada en el input
  const horaGuardada = localStorage.getItem('reflexionHora');
  const horaInput = document.getElementById('reflexion-hora');
  if (horaGuardada && horaInput) horaInput.value = horaGuardada;

  checkReflexionBanner();
  // Revisar cada minuto
  setInterval(checkReflexionBanner, 60000);
});
