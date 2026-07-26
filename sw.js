// Blueprint service worker — the whole game is one HTML file, so offline
// support is a small cached shell. (GitHub Pages build: the game is index.html.)
//
// HTML requests are network-first (fresh when online, cached offline); static
// assets stay cache-first. CACHE is stamped with the bundle's content hash, so
// every build ships a new cache and 'activate' clears the old one.
const CACHE = 'cfb-dynasty-e753fdfe89';
const ASSETS = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) =>
    Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
  ).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const isHTML = e.request.mode === 'navigate'
    || (e.request.headers.get('accept') || '').includes('text/html');
  if (isHTML) {
    // Network-first: online users always get the latest build; offline users
    // get the cached one. The successful fetch refreshes the cache.
    e.respondWith(
      fetch(e.request).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
        return res;
      }).catch(() => caches.match(e.request).then((hit) => hit || caches.match('./index.html')))
    );
    return;
  }
  e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request)));
});
