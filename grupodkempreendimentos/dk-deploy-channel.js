/**
 * Canal de deploy: default (oficial) ou demo.
 * Demo: demo.grupodkempreendimentos.com.br — cadastros na nuvem label "demo".
 * Oficial: grupodkempreendimentos.com.br — cadastros label "default" (zerados para cadastro manual).
 */
(function dkDeployChannel() {
  function readQueryChannel() {
    try {
      const q = String(new URLSearchParams(window.location.search).get("dk_channel") || "")
        .trim()
        .toLowerCase();
      if (q === "demo") return "demo";
      if (q === "default" || q === "production" || q === "oficial") return "default";
    } catch {
      /* ignore */
    }
    return "";
  }

  function readHostnameChannel() {
    const h = String(window.location.hostname || "").toLowerCase();
    if (h === "demo.grupodkempreendimentos.com.br") return "demo";
    if (/^demo\./.test(h)) return "demo";
    if (h.endsWith(".vercel.app") && /(^demo-|-demo-|git-demo-)/.test(h)) return "demo";
    return "default";
  }

  const channel = readQueryChannel() || readHostnameChannel();
  const isDemo = channel === "demo";

  window.__DK_DEPLOY_CHANNEL__ = channel;
  window.__DK_IS_DEMO_DEPLOY__ = isDemo;
  window.__DK_deploySnapshotLabel = function () {
    return isDemo ? "demo" : "default";
  };

  const DEMO_PWA_ICON = "/icons/icon-cliente-demo-192.png";

  function isClientePwaPage() {
    const path = String(location.pathname || "").toLowerCase();
    return (
      path === "/cliente" ||
      path.endsWith("/cliente") ||
      path.endsWith("/cliente.html") ||
      path === "/instalar" ||
      path.endsWith("/instalar") ||
      path.endsWith("/instalar.html")
    );
  }

  function demoManifestHref() {
    return isClientePwaPage()
      ? "/manifest-cliente-demo.webmanifest"
      : "/manifest-corporativo-demo.webmanifest";
  }

  /** Ícone com contorno laranja + manifest demo — distingue PWA instalado do oficial. */
  function applyDemoPwaBranding() {
    if (!isDemo) return;
    try {
      document.querySelectorAll('link[rel="icon"], link[rel="apple-touch-icon"]').forEach((el) => {
        el.setAttribute("href", DEMO_PWA_ICON);
      });
      const manifest = document.querySelector('link[rel="manifest"]');
      if (manifest) manifest.setAttribute("href", demoManifestHref());
      const appleTitle = document.querySelector('meta[name="apple-mobile-web-app-title"]');
      if (appleTitle) appleTitle.setAttribute("content", "DK Demo");
      const theme = document.querySelector('meta[name="theme-color"]');
      if (theme) theme.setAttribute("content", "#f97316");
    } catch {
      /* ignore */
    }
  }

  function syncDemoBannerLayout() {
    const banner = document.getElementById("dk-demo-env-banner");
    const h =
      banner && !banner.classList.contains("hidden") ? `${banner.offsetHeight}px` : "0px";
    try {
      document.documentElement.style.setProperty("--dk-demo-env-banner-h", h);
    } catch {
      /* ignore */
    }
  }

  function applyDemoUi() {
    const banner = document.getElementById("dk-demo-env-banner");
    if (!banner) return;
    if (!isDemo) {
      banner.classList.add("hidden");
      document.body.classList.remove("portal-body--demo-env");
      document.documentElement.style.setProperty("--dk-demo-env-banner-h", "0px");
      return;
    }
    applyDemoPwaBranding();
    banner.classList.remove("hidden");
    document.body.classList.add("portal-body--demo-env");
    const baseTitle = document.title.replace(/^\[DEMO\]\s*/i, "");
    if (!/^\[DEMO\]/i.test(document.title)) {
      document.title = `[DEMO] ${baseTitle}`;
    }
    requestAnimationFrame(syncDemoBannerLayout);
    const lead = document.getElementById("operacaoClienteLead");
    if (lead) {
      lead.textContent =
        "Preencha abaixo. Ambiente demo — 307 clientes e 165 veículos (planilha + nuvem).";
    }
  }

  window.__DK_syncDemoBannerLayout = syncDemoBannerLayout;

  if (isDemo) applyDemoPwaBranding();

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", applyDemoUi);
  } else {
    applyDemoUi();
  }

  if (!window.__dkDemoBannerResizeBound) {
    window.__dkDemoBannerResizeBound = true;
    window.addEventListener("resize", syncDemoBannerLayout);
  }

  try {
    window.dispatchEvent(new CustomEvent("dk-deploy-channel-ready", { detail: { channel, isDemo } }));
  } catch {
    /* ignore */
  }
})();
