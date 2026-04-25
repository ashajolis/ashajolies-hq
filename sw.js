const CACHE = 'ajhq-v2';

self.addEventListener('install', e => e.waitUntil(self.skipWaiting()));

self.addEventListener('activate', e => e.waitUntil(
  caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim())
));

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request).then(res => {
      const r = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, r));
      return res;
    }).catch(() => caches.match(e.request))
  );
});
