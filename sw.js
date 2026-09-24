// Keeps the app working with no signal. index.html is fetched from the network first (so new rates arrive),
// falling back to the saved copy when offline or slow; icons and the manifest come from the cache.
const CACHE = 'hvac-estimator-shell-v1';
const SHELL = ['./', './index.html', './manifest.webmanifest', './apple-touch-icon.png', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  const isPage = req.mode === 'navigate' || url.pathname.endsWith('/') || url.pathname.endsWith('/index.html');
  e.respondWith(isPage ? networkFirst(req) : cacheFirst(req));
});
function networkFirst(req) {
  return new Promise(resolve => {
    let settled = false;
    const useCache = () => caches.match('./index.html').then(r => r || caches.match(req)).then(r => resolve(r || fetch(req)));
    const timer = setTimeout(() => { if (!settled) { settled = true; useCache(); } }, 4000);
    fetch(req).then(res => {
      clearTimeout(timer); if (settled) return; settled = true;
      if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put('./index.html', copy)); }
      resolve(res);
    }).catch(() => { clearTimeout(timer); if (settled) return; settled = true; useCache(); });
  });
}
function cacheFirst(req) {
  return caches.match(req).then(hit => hit || fetch(req).then(res => {
    if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
    return res;
  }));
}
