const CACHE_NAME = 'riwayat-static-v4';
const APP_FILES = ['./', './index.html', './styles.css', './app.js',  './manifest.webmanifest', './icon.svg'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('riwayat-static-') && key !== CACHE_NAME).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  event.respondWith((async () => {
    const cached = await caches.match(request);
    if (cached) {
      fetch(request).then(response => { if (response && response.ok) caches.open(CACHE_NAME).then(cache => cache.put(request, response)); }).catch(() => {});
      return cached;
    }
    try {
      const response = await fetch(request);
      if (response && response.ok) (await caches.open(CACHE_NAME)).put(request, response.clone());
      return response;
    } catch (error) {
      if (request.mode === 'navigate') return caches.match('./index.html');
      throw error;
    }
  })());
});
