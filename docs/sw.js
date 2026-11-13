// Network first, so updates show up as soon as you're online; cached copy is the offline fallback.
const V = 'pt-v3';
const SHELL = ['./', 'index.html', 'style.css', 'manifest.webmanifest', 'js/core.js', 'js/sessions.js', 'js/plan.js', 'js/recover.js', 'js/fuel.js', 'js/more.js', 'js/more2.js', 'js/more3.js', 'js/import.js', 'js/app.js'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(V).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const u = new URL(e.request.url);
  if (u.origin !== location.origin) return;
  e.respondWith(
    fetch(e.request).then(r => {
      const copy = r.clone();
      caches.open(V).then(c => c.put(e.request, copy));
      return r;
    }).catch(() => caches.match(e.request).then(m => m || caches.match('index.html')))
  );
});
