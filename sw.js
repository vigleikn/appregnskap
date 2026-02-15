const CACHE_NAME = 'budget-pwa-v4';
const urlsToCache = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.json',
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(urlsToCache);
    })
  );
  self.skipWaiting();
});

self.addEventListener('fetch', function (event) {
  if (event.request.url.indexOf(self.location.origin) !== 0) return;
  if (event.request.method !== 'GET') return;

  // Network-first: try fresh content, fall back to cache when offline.
  event.respondWith(
    fetch(event.request)
      .then(function (response) {
        // Got fresh response — update the cache and return it.
        var clone = response.clone();
        caches.open(CACHE_NAME).then(function (cache) {
          cache.put(event.request, clone);
        });
        return response;
      })
      .catch(function () {
        // Offline — serve from cache.
        return caches.match(event.request);
      })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys
          .filter(function (key) { return key !== CACHE_NAME; })
          .map(function (key) { return caches.delete(key); })
      );
    })
  );
  self.clients.claim();
});
