/* Service Worker — cache-first para uso offline */
const CACHE = "saludinfantil-v4";
const ASSETS = [
  "./",
  "./index.html",
  "./app.html",
  "./manifest.json",
  "./css/styles.css",
  "./css/landing.css",
  "./js/app.js",
  "./js/landing.js",
  "./js/storage.js",
  "./js/children.js",
  "./js/vaccines.js",
  "./js/appointments.js",
  "./js/growth.js",
  "./js/charts.js",
  "./js/medications.js",
  "./js/news.js",
  "./js/print.js",
  "./js/notifications.js",
  "./js/theme.js",
  "./data/vaccines.js",
  "./data/oms.js",
  "./icons/icon.svg",
  "./vendor/sql-wasm.js",
  "./vendor/sql-wasm.wasm",
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});

self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  // Solo cachear recursos del mismo origen
  if (url.origin !== location.origin) return;
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(resp => {
        if (resp && resp.status === 200 && resp.type === "basic") {
          const clone = resp.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return resp;
      }).catch(() => caches.match("./index.html"));
    })
  );
});