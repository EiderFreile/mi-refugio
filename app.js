// ═══════════════════════════════════════════════════════════
//  MI REFUGIO — app.js  (Firebase conectado)
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

// ─── State ──────────────────────────────────────────────────
let state = {
  currentTab:    'inicio',
  todayMood:     null,
  habits:        [],          // cargados desde Firebase
  todayProgress: {},          // cargado desde Firebase
  calendarData:  {},          // registros del mes desde Firebase
  darkMode:      localStorage.getItem('darkMode') === 'true',
  breathTimer:   null,
  sosStep:       'breath',
  fabListenerAdded: false,
};

// ─── Utilidades de fecha ────────────────────────────────────
function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

// ─── Init ───────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  if (state.darkMode) document.body.classList.add('dark');
  setupNav();
  setupSOS();
  registerSW();
  initFirebaseListeners();
  renderStaticHome();
  renderSettings();
});

function registerSW() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

// ═══════════════════════════════════════════════════════════
//  FIREBASE LISTENERS — fuente de verdad
// ═══════════════════════════════════════════════════════════
function initFirebaseListeners() {
  const today = todayKey();

  // 1. Hábitos (definición)
  DB.listen('refugio/habitos', data => {
    state.habits = data ? Object.values(data) : [];
    renderTodayHabits();
    renderHabitos();
    renderSummary();
  });

  // 2. Progreso de hoy
  DB.listen(`refugio/registros/${today}`, data => {
    state.todayProgress = data || {};
    state.todayMood = data?.mood || null;
    renderTodayHabits();
    renderMoodPicker();
    renderSummary();
    renderComidas();
  });

  // 3. Datos del mes para el calendario
  const now = new Date();
  const monthPrefix = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  DB.listen('refugio/registros', data => {
    state.calendarData = data || {};
    renderCalendar();
    renderConocete();
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
    const prog = state.todayProgress?.habitos?.[h.id] || {};
    const done = h.type === 'boolean' ? !!prog.done : false;
    const current = h.type === 'counter' ? (prog.current ?? 0) : 0;
    const pct = h.type === 'counter'
      ? Math.min(100, Math.round((current / h.goal) * 100))
      : (done ? 100 : 0);

    return `
      <div class="habit-item ${done ? 'completed' : ''}" id="habit-item-${h.id}">
        <div class="habit-icon" style="background:${h.color}20;">${h.icon}</div>
        <div class="habit-info">
          <div class="habit-name">${h.name}</div>
          ${h.type === 'counter' ? `
            <div class="habit-progress-text">${current} / ${h.goal} ${h.unit || ''}</div>
            <div class="habit-bar-wrap">
              <div class="habit-bar" style="width:${pct}%;background:${h.color}"></div>
            </div>
          ` : `
            <div class="habit-progress-text">${done ? '¡Completado! ✓' : 'Pendiente'}</div>
          `}
        </div>
        ${h.type === 'boolean' ? `
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

// ─── Guardar resumen del día (para el calendario) ───────────
function saveDaySummary() {
  const today = todayKey();
  const prog = state.todayProgress?.habitos || {};
  const total = state.habits.length;
  if (!total) return;

  const completed = state.habits.filter(h => {
    const p = prog[h.id] || {};
    if (h.type === 'boolean') return !!p.done;
    if (h.type === 'counter') return (p.current ?? 0) >= h.goal;
    return false;
  }).length;

  const pct = Math.round((completed / total) * 100);
  let color = 'no-data';
  if (pct >= 90)      color = 'excellent';
  else if (pct >= 60) color = 'good';
  else if (pct >= 30) color = 'normal';
  else if (pct > 0)   color = 'difficult';
  else                color = 'bad';

  DB.update(`refugio/registros/${today}`, { pct, color, completed, total });
}

// ─── Resumen rápido ──────────────────────────────────────────
function renderSummary() {
  const prog = state.todayProgress?.habitos || {};
  const total = state.habits.length;
  const completed = state.habits.filter(h => {
    const p = prog[h.id] || {};
    if (h.type === 'boolean') return !!p.done;
    if (h.type === 'counter') return (p.current ?? 0) >= h.goal;
    return false;
  }).length;

  const elH = document.getElementById('summary-habitos');
  const elM = document.getElementById('summary-mood');
  const elC = document.getElementById('summary-comidas');
  if (elH) elH.textContent = total ? `${completed}/${total}` : '—';
  if (elM) elM.textContent = state.todayMood
    ? MOODS.find(m => m.id === state.todayMood)?.emoji || '—'
    : '—';
  if (elC) {
    const comidasCount = Object.keys(state.todayProgress?.comidas || {}).length;
    elC.textContent = comidasCount || '—';
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
  // reset
  document.getElementById('sos-start-breath').style.display = '';
  document.getElementById('breath-circle').className = 'breath-circle';
  document.getElementById('breath-label').textContent = 'Pulsa para empezar';
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

  // FAB listener (solo una vez)
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
  list.innerHTML = state.habits.map(h => `
    <div class="habit-card" onclick="openHabitSheet(${JSON.stringify(h).replace(/"/g, '&quot;')})">
      <div class="habit-card-icon" style="background:${h.color}30;">${h.icon}</div>
      <div class="habit-card-info">
        <div class="habit-card-name">${h.name}</div>
        <div class="habit-card-meta">${types[h.type] || ''}${h.goal ? ` · ${h.goal} ${h.unit||''}` : ''}</div>
      </div>
      <span style="color:var(--c-text-muted);font-size:18px;">›</span>
    </div>
  `).join('');
}

function openHabitSheet(habit) {
  const isNew = !habit;
  document.getElementById('habit-form-id').value    = habit?.id    || '';
  document.getElementById('habit-form-name').value  = habit?.name  || '';
  document.getElementById('habit-form-icon').value  = habit?.icon  || '✨';
  document.getElementById('habit-form-color').value = habit?.color || '#8FAF8A';
  document.getElementById('habit-form-type').value  = habit?.type  || 'boolean';
  document.getElementById('habit-form-goal').value  = habit?.goal  || '';
  document.getElementById('habit-form-unit').value  = habit?.unit  || '';
  document.getElementById('habit-sheet-title').textContent = isNew ? 'Nuevo hábito' : 'Editar hábito';
  document.getElementById('delete-habit-btn').style.display = isNew ? 'none' : 'block';
  toggleGoalFields();
  document.getElementById('habit-sheet').classList.add('open');
}

function closeHabitSheet() {
  document.getElementById('habit-sheet').classList.remove('open');
}

function toggleGoalFields() {
  const type = document.getElementById('habit-form-type').value;
  const goalRow = document.getElementById('goal-row');
  if (goalRow) goalRow.style.display = (type === 'counter' || type === 'value') ? 'block' : 'none';
}

function saveHabitForm() {
  const id   = document.getElementById('habit-form-id').value || Date.now().toString();
  const name = document.getElementById('habit-form-name').value.trim();
  if (!name) { showToast('Ponle un nombre al hábito 🌸'); return; }

  const habit = {
    id,
    name,
    icon:  document.getElementById('habit-form-icon').value.trim() || '✨',
    color: document.getElementById('habit-form-color').value,
    type:  document.getElementById('habit-form-type').value,
    goal:  parseInt(document.getElementById('habit-form-goal').value) || null,
    unit:  document.getElementById('habit-form-unit').value.trim(),
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
  if (!confirm('¿Eliminar este hábito? Esta acción no se puede deshacer.')) return;
  DB.remove(`refugio/habitos/${id}`).then(() => {
    closeHabitSheet();
    showToast('Hábito eliminado');
  });
}

// ═══════════════════════════════════════════════════════════
//  CALENDARIO
// ═══════════════════════════════════════════════════════════
function renderCalendar() {
  const now = new Date();
  const year  = now.getFullYear();
  const month = now.getMonth();
  const today = now.getDate();

  const monthName = now.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
  const el = document.getElementById('cal-month-name');
  if (el) el.textContent = monthName.charAt(0).toUpperCase() + monthName.slice(1);

  const firstDay    = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const offset      = (firstDay + 6) % 7;

  const grid = document.getElementById('cal-grid');
  if (!grid) return;

  const dayLabels = ['L','M','X','J','V','S','D'];
  let html = dayLabels.map(d => `<div class="cal-day-label">${d}</div>`).join('');
  for (let i = 0; i < offset; i++) html += `<div class="cal-day empty"></div>`;

  for (let d = 1; d <= daysInMonth; d++) {
    const dateKey = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const isToday = d === today;
    const isFuture = d > today;
    const dayData = state.calendarData[dateKey];
    let cls = 'no-data';
    if (!isFuture && dayData?.color) cls = dayData.color;
    html += `<div class="cal-day ${cls} ${isToday ? 'today' : ''}"
                  onclick="openDay('${dateKey}')">${d}</div>`;
  }

  grid.innerHTML = html;
}

function openDay(dateKey) {
  const data = state.calendarData[dateKey];
  if (!data) return; // días sin datos: no hacer nada
  const mood = data.mood ? MOODS.find(m => m.id === data.mood) : null;
  const msg = [
    `📅 ${dateKey}`,
    data.completed !== undefined ? `✅ Hábitos: ${data.completed}/${data.total}` : '',
    mood ? `${mood.emoji} Estado: ${mood.label}` : '',
  ].filter(Boolean).join('\n');
  // Usamos un toast en lugar de alert
  showToast(msg, 3000);
}

// ═══════════════════════════════════════════════════════════
//  CONÓCETE — análisis real
// ═══════════════════════════════════════════════════════════
function renderConocete() {
  const list = document.getElementById('insights-list');
  if (!list) return;

  const registros = state.calendarData;
  const dias = Object.entries(registros);

  if (dias.length < 2) {
    list.innerHTML = `<div class="empty-state">
      <div class="empty-icon">📊</div>
      <p>Aún no hay suficientes datos.<br>Usa la app unos días y aquí irán apareciendo tus patrones. 🌱</p>
    </div>`;
    return;
  }

  const insights = [];

  // Racha actual
  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 60; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const reg = registros[key];
    if (reg && reg.completed > 0) streak++;
    else break;
  }
  if (streak > 1) insights.push({ icon: '🔥', text: `Llevas <strong>${streak} días seguidos</strong> completando al menos un hábito.` });

  // Mejor día de la semana
  const byWeekday = Array(7).fill(null).map(() => ({ sum: 0, count: 0 }));
  dias.forEach(([key, d]) => {
    if (d.pct !== undefined) {
      const wd = new Date(key).getDay();
      byWeekday[wd].sum += d.pct;
      byWeekday[wd].count++;
    }
  });
  const avgs = byWeekday.map((x, i) => ({ day: i, avg: x.count ? x.sum / x.count : -1 }));
  const bestDay = avgs.filter(x => x.avg >= 0).sort((a,b) => b.avg - a.avg)[0];
  const dayNames = ['domingos','lunes','martes','miércoles','jueves','viernes','sábados'];
  if (bestDay && bestDay.avg > 0) {
    insights.push({ icon: '⭐', text: `Los <strong>${dayNames[bestDay.day]}</strong> sueles completar más hábitos (${Math.round(bestDay.avg)}% de media).` });
  }

  // Estado de ánimo más frecuente
  const moodCount = {};
  dias.forEach(([, d]) => { if (d.mood) moodCount[d.mood] = (moodCount[d.mood] || 0) + 1; });
  const topMood = Object.entries(moodCount).sort((a,b) => b[1]-a[1])[0];
  if (topMood) {
    const m = MOODS.find(x => x.id === topMood[0]);
    if (m) insights.push({ icon: m.emoji, text: `Tu estado más frecuente ha sido <strong>${m.label}</strong> (${topMood[1]} ${topMood[1]===1?'día':'días'}).` });
  }

  // Días con datos
  const daysWithData = dias.filter(([, d]) => d.completed !== undefined).length;
  insights.push({ icon: '📅', text: `Llevas <strong>${daysWithData} ${daysWithData === 1 ? 'día' : 'días'}</strong> usando Mi Refugio.` });

  // Día con mejor porcentaje
  const best = dias.filter(([, d]) => d.pct !== undefined).sort((a,b) => b[1].pct - a[1].pct)[0];
  if (best) {
    const bestDate = new Date(best[0]).toLocaleDateString('es-ES', { weekday:'long', day:'numeric', month:'long' });
    insights.push({ icon: '🌟', text: `Tu mejor día fue el <strong>${bestDate}</strong> con un ${best[1].pct}% de hábitos completados.` });
  }

  if (!insights.length) {
    list.innerHTML = `<div class="empty-state">
      <div class="empty-icon">📊</div>
      <p>Sigue usando la app y aquí irán apareciendo tus patrones. 🌱</p>
    </div>`;
    return;
  }

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
  const data = {
    habits: state.habits,
    registros: state.calendarData,
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

// ═══════════════════════════════════════════════════════════
//  TOAST (reemplaza los alert feos)
// ═══════════════════════════════════════════════════════════
function showToast(msg, duration = 2000) {
  let toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    toast.style.cssText = `
      position:fixed;bottom:calc(var(--tab-h) + 20px);left:50%;transform:translateX(-50%) translateY(20px);
      background:var(--c-text);color:var(--c-bg);padding:12px 20px;border-radius:99px;
      font-size:13px;font-weight:500;z-index:999;opacity:0;transition:all 0.3s;
      white-space:pre-line;text-align:center;max-width:280px;line-height:1.4;
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
//  HOY COMO
// ═══════════════════════════════════════════════════════════

const COMIDAS = [
  { id: 'desayuno', label: 'Desayuno',  icon: '☀️' },
  { id: 'comida',   label: 'Comida',    icon: '🌤️' },
  { id: 'cena',     label: 'Cena',      icon: '🌙' },
  { id: 'snack',    label: 'Snack',     icon: '🍎' },
];

const RATINGS = [
  { id: 'muybien',  emoji: '🥗', label: 'Muy bien' },
  { id: 'bien',     emoji: '🙂', label: 'Bien' },
  { id: 'normal',   emoji: '😐', label: 'Normal' },
  { id: 'regular',  emoji: '🍕', label: 'Regular' },
  { id: 'mal',      emoji: '🍔', label: 'Mal' },
];

let selectedComidaRating = null;

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
            ` : `
              <div style="font-size:13px;color:var(--c-text-muted);margin-top:3px;">Sin registrar · toca para añadir</div>
            `}
          </div>
          ${reg ? `
            <div style="width:8px;height:8px;border-radius:50%;background:var(--c-sage);flex-shrink:0;"></div>
          ` : `
            <div style="color:var(--c-text-muted);font-size:18px;">+</div>
          `}
        </div>
      </div>
    `;
  }).join('');
}

function openComidaSheet(tipo) {
  const comida = COMIDAS.find(c => c.id === tipo);
  if (!comida) return;

  document.getElementById('comida-form-tipo').value = tipo;
  document.getElementById('comida-sheet-title').textContent = `${comida.icon} ${comida.label}`;

  // Cargar datos existentes si los hay
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
             background:${selectedComidaRating === r.id ? 'var(--c-sage-dim)' : 'var(--c-bg)'};
             cursor:pointer;transition:all 0.2s;">
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

  const data = { rating: selectedComidaRating, notas, timestamp: Date.now() };
  DB.update(`refugio/registros/${todayKey()}/comidas/${tipo}`, data).then(() => {
    closeComidaSheet();
    showToast('Comida registrada 🥗');
    renderSummary();
  });
}
