const CACHE_NAME = "dk-cliente-v1";
const ASSETS = [
  "./cliente.html",
  "./cliente-app.js",
  "./cliente-app.css",
  "./styles.css",
  "./manifest-cliente.webmanifest",
  "./icons/icon-cliente-192.svg",
  "./icons/icon-cliente-512.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((c) => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) {
    event.respondWith(fetch(event.request));
    return;
  }
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((r) => {
          const clone = r.clone();
          caches.open(CACHE_NAME).then((c) => c.put(event.request, clone));
          return r;
        })
        .catch(() => caches.match(event.request).then((c) => c || caches.match("./cliente.html")))
    );
    return;
  }
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const net = fetch(event.request)
        .then((r) => {
          const clone = r.clone();
          caches.open(CACHE_NAME).then((c) => c.put(event.request, clone));
          return r;
        })
        .catch(() => cached);
      return cached || net;
    })
  );
});
