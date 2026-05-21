const CACHE_NAME = "dk-cliente-v20260522fluido";
const SHARE_CACHE = "dk-cliente-share-v1";
const ASSETS = [
  "/cliente",
  "./cliente.html",
  "/instalar",
  "./instalar.html",
  "./instalar-cliente.js",
  "./cliente-app.css",
  "./cliente-notificacoes.js",
  "./cliente-contrato-resumo.js",
  "./styles.css",
  "./manifest-cliente.webmanifest",
  "./icons/icon-cliente-192.png",
  "./icons/icon-cliente-512.png",
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
      Promise.all(keys.filter((k) => k !== CACHE_NAME && k !== SHARE_CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

async function storeSharedComprovanteFromPost(request) {
  const form = await request.formData();
  const file =
    form.get("file") ||
    form.get("files") ||
    (() => {
      for (const [, v] of form.entries()) {
        if (v instanceof File && v.size > 0) return v;
      }
      return null;
    })();
  if (!(file instanceof File) || !file.size) return false;
  const buf = await file.arrayBuffer();
  const cache = await caches.open(SHARE_CACHE);
  await cache.put(
    "dk-shared-comprovante",
    new Response(buf, {
      headers: {
        "Content-Type": file.type || "application/octet-stream",
        "X-DK-Filename": encodeURIComponent(file.name || "comprovante"),
      },
    })
  );
  return true;
}

function networkFirst(request) {
  return fetch(request)
    .then((r) => {
      if (r && r.ok) {
        const clone = r.clone();
        caches.open(CACHE_NAME).then((c) => c.put(request, clone));
      }
      return r;
    })
    .catch(() => caches.match(request));
}

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) {
    if (event.request.method === "GET") {
      event.respondWith(fetch(event.request));
    }
    return;
  }

  const path = url.pathname.replace(/\/$/, "") || "/";
  const isClienteShareTarget =
    path === "/cliente" ||
    path.endsWith("/cliente") ||
    path.endsWith("/cliente.html") ||
    path === "/api/cliente-share" ||
    path.endsWith("/api/cliente-share");

  if (event.request.method === "POST" && isClienteShareTarget) {
    event.respondWith(
      (async () => {
        try {
          await storeSharedComprovanteFromPost(event.request);
        } catch {
          /* ignore */
        }
        const dest = new URL("/cliente?dkShare=file", self.location.origin);
        return Response.redirect(dest.toString(), 303);
      })()
    );
    return;
  }

  if (event.request.method !== "GET") return;

  const isScriptOrStyle =
    url.pathname.endsWith(".js") ||
    url.pathname.endsWith(".css") ||
    url.search.includes("v=20");
  if (isScriptOrStyle) {
    event.respondWith(networkFirst(event.request));
    return;
  }

  const isAppAsset =
    url.pathname.endsWith(".html") || url.pathname.endsWith(".webmanifest");
  if (isAppAsset) {
    event.respondWith(networkFirst(event.request));
    return;
  }
  if (event.request.mode === "navigate") {
    event.respondWith(networkFirst(event.request));
    return;
  }
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const net = networkFirst(event.request);
      return cached || net;
    })
  );
});
