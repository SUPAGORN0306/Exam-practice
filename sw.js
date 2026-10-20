/* Service worker — cache versioned, only on http(s) */
var CACHE_VERSION = 'sp-cache-v3';
var PRECACHE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/style.css',
  './data/subjects.js',
  './data/sample-questions.js',
  './js/storage.js',
  './js/validate.js',
  './js/scheduler.js',
  './js/stats.js',
  './js/theme.js',
  './js/askai.js',
  './js/app.js',
  './js/views/home.js',
  './js/views/session.js',
  './js/views/summary.js',
  './js/views/statsView.js',
  './js/views/manage.js',
  './js/views/settings.js',
  './icons/icon-192.svg',
  './icons/icon-512.svg',
  './icons/apple-touch-icon.svg'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_VERSION).then(function (cache) {
      return cache.addAll(PRECACHE).catch(function () { /* ignore missing */ });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.map(function (key) {
          if (key !== CACHE_VERSION && key.indexOf('sp-cache-') === 0) {
            return caches.delete(key);
          }
          return null;
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(req).then(function (cached) {
      if (cached) {
        // Refresh in background
        fetch(req).then(function (res) {
          if (res && res.status === 200) {
            caches.open(CACHE_VERSION).then(function (cache) { cache.put(req, res.clone()); });
          }
        }).catch(function () {});
        return cached;
      }
      return fetch(req).then(function (res) {
        if (res && res.status === 200 && res.type === 'basic') {
          var resClone = res.clone();
          caches.open(CACHE_VERSION).then(function (cache) { cache.put(req, resClone); });
        }
        return res;
      }).catch(function () {
        // Fallback to index.html for navigation
        if (req.mode === 'navigate') return caches.match('./index.html');
        return new Response('', { status: 504 });
      });
    })
  );
});