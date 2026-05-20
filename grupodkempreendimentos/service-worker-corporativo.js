const CACHE_NAME = "dk-corporativo-v1";
const ASSETS = [
  "./",
  "./index.html",
  "./apps.html",
  "./styles.css",
  "./app.js",
  "./portal-locadora-ui.js",
  "./portal-lancamentos-extras.js",
  "./portal-multas-relatorio.js",
  "./portal-supabase-sync.js",
  "./supabase-init.js",
  "./data/dk-banco-cadastro.js",
  "./clientes-extra-sync.js",
  "./locacoes-receita-2026-import.js",
  "./manifest-corporativo.webmanifest",
  "./icons/icon-192.svg",
  "./icons/icon-512.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((c) => c.addAll(ASSETS).catch(() => {})));
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
        .catch(() => caches.match(event.request).then((c) => c || caches.match("./index.html")))
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
