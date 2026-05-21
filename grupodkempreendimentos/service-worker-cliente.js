const CACHE_NAME = "dk-cliente-v20260524install";
const SHARE_CACHE = "dk-cliente-share-v1";
const ASSETS = [
  "/cliente",
  "./cliente.html",
  "./cliente-app.js",
  "./cliente-app.css",
  "./cliente-notificacoes.js",
  "./cliente-contrato-resumo.js",
  "./cliente-relatorio-pagamentos.js",
  "/cliente-relatorio-pagamentos.js",
  "./portal-comprovantes-cliente.js",
  "./portal-supabase-sync.js",
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
    path === "/cliente" || path.endsWith("/cliente") || path.endsWith("/cliente.html");

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

  const isAppAsset =
    url.pathname.endsWith(".js") ||
    url.pathname.endsWith(".css") ||
    url.pathname.endsWith(".html");
  if (isAppAsset) {
    event.respondWith(
      fetch(event.request)
        .then((r) => {
          const clone = r.clone();
          caches.open(CACHE_NAME).then((c) => c.put(event.request, clone));
          return r;
        })
        .catch(() =>
          caches.match(event.request).then((c) => c || caches.match("/cliente") || caches.match("./cliente.html"))
        )
    );
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
        .catch(() =>
          caches.match(event.request).then((c) => c || caches.match("/cliente") || caches.match("./cliente.html"))
        )
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
