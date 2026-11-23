// Embr service worker: lets the app open from the home screen and load fast.
// Pages and code: network first, cached copy if offline. Never caches data,
// sign-in or payments.
const CACHE = 'embr-v2';
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['/', '/manifest.webmanifest', '/icons/icon-192.png']))); self.skipWaiting(); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))); self.clients.claim(); });
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  if (/^\/(rest|auth|functions|storage)\//.test(u.pathname)) return;
  if (u.pathname.startsWith('/assets/')) {
    // hashed build files never change: cache first
    e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request).then((r) => { const c = r.clone(); caches.open(CACHE).then((x) => x.put(e.request, c)); return r; })));
    return;
  }
  if (u.pathname === '/admin' || u.pathname.startsWith('/admin/') || u.pathname === '/admin.html') return; // staff website: always live
  const isPage = e.request.mode === 'navigate';
  e.respondWith(fetch(e.request).then((r) => {
    if (r.ok && (isPage || u.pathname.startsWith('/icons/'))) { const c = r.clone(); caches.open(CACHE).then((x) => x.put(isPage ? '/' : e.request, c)); }
    return r;
  }).catch(() => caches.match(isPage ? '/' : e.request)));
});
