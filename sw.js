// Blueprint service worker — the deployed app is one HTML file, so offline support is a
// small cached shell.
//
// CACHE is stamped by tools/build.mjs with the bundle's content hash. Every build ships a
// new cache name, so 'activate' clears the old one and installed phones can't keep serving
// a stale build forever. Never edit the hash by hand — the placeholder below is replaced
// at build time, and the copy in dist/ is the stamped one.
//
// Paths are ROOT-RELATIVE ('./'), never a filename. On GitHub Pages the bundle is served as
// index.html, so an entry like './cfb_mobile.html' would 404 — and because cache.addAll()
// rejects if ANY entry fails, a single bad path silently kills the whole install and you
// get no offline support at all.
const CACHE = 'cfb-dynasty-54cb3d4c7f';
const ASSETS = ['./', './manifest.json', './icon-192.png', './icon-512.png'];

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
    // Network-first: online users always get the latest build; offline users get the
    // cached one. A successful fetch refreshes the cache.
    e.respondWith(
      fetch(e.request).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
        return res;
      }).catch(() => caches.match(e.request).then((hit) => hit || caches.match('./')))
    );
    return;
  }
  e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request)));
});
