// ─── Firebase Config ───────────────────────────────────────────────
// Sustituye estos valores por los de tu proyecto Firebase (nail-projects o uno nuevo)
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyBxtl_lc9b6zS-6ld-LMGcBAyk6XjQ7vck",
  authDomain: "nail-projects.firebaseapp.com",
  databaseURL: "https://nail-projects-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "nail-projects",
  storageBucket: "nail-projects.firebasestorage.app",
  messagingSenderId: "923664169473",
  appId: "1:923664169473:web:16f3c712ddd4d3400d9e00"
};

// ─── Init ───────────────────────────────────────────────────────────
firebase.initializeApp(FIREBASE_CONFIG);
const db = firebase.database();

// ─── Helpers ────────────────────────────────────────────────────────
const DB = {
  // Obtener datos una vez
  get(path) {
    return db.ref(path).once('value').then(s => s.val());
  },
  // Escuchar cambios en tiempo real
  listen(path, cb) {
    db.ref(path).on('value', s => cb(s.val()));
    return () => db.ref(path).off();
  },
  // Guardar (merge)
  set(path, data) {
    return db.ref(path).set(data);
  },
  // Actualizar parcialmente
  update(path, data) {
    return db.ref(path).update(data);
  },
  // Añadir con ID automático
  push(path, data) {
    return db.ref(path).push(data);
  },
  // Borrar
  remove(path) {
    return db.ref(path).remove();
  }
};

// ─── Fecha util ─────────────────────────────────────────────────────
function todayKey() {
  return new Date().toISOString().slice(0, 10); // "2025-07-14"
}

function formatDate(date = new Date()) {
  return date.toLocaleDateString('es-ES', {
    weekday: 'long', day: 'numeric', month: 'long'
  });
}
