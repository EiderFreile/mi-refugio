const FIREBASE_CONFIG = {
  apiKey: "AIzaSyBxtl_lc9b6zS-6ld-LMGcBAyk6XjQ7vck",
  authDomain: "nail-projects.firebaseapp.com",
  databaseURL: "https://nail-projects-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "nail-projects",
  storageBucket: "nail-projects.firebasestorage.app",
  messagingSenderId: "923664169473",
  appId: "1:923664169473:web:16f3c712ddd4d3400d9e00"
};
firebase.initializeApp(FIREBASE_CONFIG);
const db = firebase.database();
const DB = {
  get:    path => db.ref(path).once('value').then(s => s.val()),
  listen: (path, cb) => { db.ref(path).on('value', s => cb(s.val())); return () => db.ref(path).off(); },
  set:    (path, data) => db.ref(path).set(data),
  update: (path, data) => db.ref(path).update(data),
  push:   (path, data) => db.ref(path).push(data),
  remove: path => db.ref(path).remove()
};
function todayKey() { return new Date().toISOString().slice(0, 10); }
function weekKey() {
  const d = new Date(); const day = d.getDay();
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
  return d.toISOString().slice(0, 10);
}
