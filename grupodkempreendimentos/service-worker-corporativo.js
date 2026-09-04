const CACHE_NAME = "dk-corporativo-v20260904colab-admin";
const ASSETS = [
  "./",
  "./index.html",
  "./app.html",
  "./home-install-pwa.js",
  "./home-unit-nav.js",
  "./dk-pwa-update.js",
  "./dk-deploy-channel.js",
  "./dk-app-entry.js",
  "./apps.html",
  "./styles.css",
  "./app.js",
  "./portal-cliente-codigo-admin.js",
  "./dk-relatorio-inatividade.js",
  "./dk-relatorio-operacao-pdf.js",
  "./portal-colab-horario.js",
  "./portal-locadora-ui.js",
  "./dk-app-scope.js",
  "./portal-unidade-financeiro.js",
  "./portal-lanc-aluguel-calendario.js",
  "./portal-lancamentos-extras.js",
  "./dk-parse-autuacao-transito.js",
  "./portal-multas-ocr.js",
  "./portal-locacao-documentos.js",
  "./portal-documentos.js",
  "./portal-financeiro.js",
  "./portal-financeiro-modulos.js",
  "./data/dk-despesas-historico.js",
  "./portal-multas-relatorio.js",
  "./portal-manutencao-checklist.js",
  "./portal-setor-relatorio.js",
  "./portal-cliente-docs.js",
  "./portal-contrato-locacao.js",
  "./portal-contrato-pacote.js",
  "./data/dk-contrato-locacao-texto.js",
  "./data/dk-contrato-pacote-textos.js",
  "./data/dk-modelos-veiculo.js",
  "./modelos/requerimento-padrao-detran.pdf",
  "./images/documentos/requerimento-padrao-p1.png",
  "./images/documentos/requerimento-padrao-p2.png",
  "./portal-patrimonio.js",
  "./portal-patrimonio-scan.js",
  "./portal-supabase-sync.js",
  "./dk-lancamento-protocolo.js",
  "./supabase-init.js",
  "./data/dk-banco-cadastro-vazio.js",
  "./manifest-corporativo.webmanifest",
  "./manifest-locadora.webmanifest",
  "./manifest-centro.webmanifest",
  "./manifest-construtora.webmanifest",
  "./icons/icon-cliente-192.png",
  "./icons/icon-cliente-512.png",
  "./icons/icon-grupodk-192.png",
  "./icons/icon-grupodk-512.png",
  "./icons/icon-locadora-192.png",
  "./icons/icon-locadora-512.png",
  "./icons/icon-centro-192.png",
  "./icons/icon-centro-512.png",
  "./icons/icon-construtora-192.png",
  "./icons/icon-construtora-512.png",
];

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

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

function isNetworkFirstAsset(url) {
  const p = url.pathname.toLowerCase();
  if (url.searchParams.has("v")) return true;
  return (
    p.endsWith(".js") ||
    p.endsWith(".css") ||
    p.endsWith(".html") ||
    p.endsWith(".webmanifest") ||
    p === "" ||
    p.endsWith("/")
  );
}

function cachePut(request, response) {
  if (!response || !response.ok) return;
  caches.open(CACHE_NAME).then((c) => c.put(request, response));
}

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
          cachePut(event.request, r.clone());
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
          return (await caches.match("./app.html")) || (await caches.match("./index.html"));
        })
    );
    return;
  }

  if (isNetworkFirstAsset(url)) {
    event.respondWith(
      fetch(event.request)
        .then((r) => {
          cachePut(event.request, r.clone());
          return r;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const net = fetch(event.request)
        .then((r) => {
          cachePut(event.request, r.clone());
          return r;
        })
        .catch(() => cached);
      return cached || net;
    })
  );
});
