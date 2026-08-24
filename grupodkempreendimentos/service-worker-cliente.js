const CACHE_NAME = "dk-cliente-v20260824parabens-mm";
const SHARE_CACHE = "dk-cliente-share-v1";
const ASSETS = [
  "/cliente",
  "./cliente.html",
  "/instalar",
  "./instalar.html",
  "./instalar-cliente.js",
  "./cliente-app.css",
  "./cliente-app.js",
  "./cliente-notificacoes.js",
  "./cliente-push-notificacoes.js",
  "./cliente-contrato-resumo.js",
  "./dk-lancamento-protocolo.js",
  "./cliente-documentos-locacao.js",
  "./portal-supabase-sync.js",
  "./styles.css",
  "./dk-deploy-channel.js",
  "./manifest-cliente.webmanifest",
  "./manifest-cliente-demo.webmanifest",
  "./icons/icon-cliente-192.png",
  "./icons/icon-cliente-512.png",
  "./icons/icon-cliente-demo-192.png",
  "./icons/icon-cliente-demo-512.png",
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

function parsePushPayload(event) {
  try {
    return event.data ? event.data.json() : {};
  } catch {
    return {};
  }
}

self.addEventListener("push", (event) => {
  const data = parsePushPayload(event);
  const title = String(data.title || "DK Locadora");
  const body = String(data.body || "Você tem uma nova mensagem da DK");
  const setor = data.setor === "manutencao" ? "manutencao" : "vendas";
  const url = String(data.url || `/cliente?dkChat=${setor}`);
  const options = {
    body,
    icon: "/icons/icon-cliente-192.png",
    badge: "/icons/icon-cliente-192.png",
    tag: String(data.tag || `dk-msg-${setor}`),
    renotify: true,
    data: { url, setor },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = String(event.notification?.data?.url || "/cliente");
  const setor = event.notification?.data?.setor || "vendas";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url && client.url.includes("/cliente")) {
          client.postMessage({ type: "dk-open-chat", setor });
          if ("focus" in client) return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
      return undefined;
    })
  );
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

  if (event.request.method !== "GET") {
    if (url.pathname.includes("/api/dk-cloud-snapshot")) {
      event.respondWith(fetch(event.request));
    }
    return;
  }

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
