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
