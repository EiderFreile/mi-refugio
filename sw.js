const CACHE_NAME = 'refugio-v2';
const ASSETS = ['/', '/index.html', '/style.css', '/app.js', '/firebase.js', '/manifest.json'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});
self.addEventListener('fetch', e => {
  e.respondWith(caches.match(e.request).then(cached => cached || fetch(e.request)));
});

// Notificaciones locales programadas
self.addEventListener('message', e => {
  if (e.data?.type === 'SCHEDULE_NOTIF') {
    const { title, body, delay } = e.data;
    setTimeout(() => {
      self.registration.showNotification(title, {
        body,
        icon: '/mi-refugio/icon-192.png',
        badge: '/mi-refugio/icon-192.png',
        vibrate: [200, 100, 200],
        tag: 'refugio-reminder',
        renotify: true,
      });
    }, delay);
  }
});
