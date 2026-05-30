const CACHE_NAME = "dk-corporativo-v2";
const ASSETS = [
  "./",
  "./index.html",
  "./app.html",
  "./home-install-pwa.js",
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
  "./icons/icon-cliente-192.png",
  "./icons/icon-cliente-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((c) => c.addAll(ASSETS).catch(() => {})));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CACHE_NAME && !String(k).startsWith("dk-cliente"))
          .map((k) => caches.delete(k))
      )
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
    const navPath = url.pathname.replace(/\/$/, "") || "/";
    const isClienteAppNav =
      navPath === "/cliente" ||
      navPath === "/instalar" ||
      navPath.startsWith("/cliente/") ||
      navPath.startsWith("/instalar/");
    event.respondWith(
      fetch(event.request)
        .then((r) => {
          const clone = r.clone();
          caches.open(CACHE_NAME).then((c) => c.put(event.request, clone));
          return r;
        })
        .catch(async () => {
          const cached = await caches.match(event.request);
          if (cached) return cached;
          if (isClienteAppNav) {
            return (
              (await caches.match("/cliente")) ||
              (await caches.match("./cliente.html")) ||
              (await caches.match("/instalar")) ||
              (await caches.match("./instalar.html")) ||
              fetch(event.request)
            );
          }
          return (
            (await caches.match("./app.html")) ||
            (await caches.match("./index.html"))
          );
        })
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
