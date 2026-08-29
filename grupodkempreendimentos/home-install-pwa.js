/** Instalar os 4 apps (Grupo DK, Locadora, Centro, Construtora). */
(function homeInstallPwa() {
  const panel = document.getElementById("dkAppInstallPanel");
  const btn = document.getElementById("dkAppInstallBtn");
  const status = document.getElementById("dkAppInstallStatus");
  const title = document.getElementById("dkAppInstallTitle");
  const manual = document.getElementById("dkAppInstallManual");

  const standalone =
    window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;

  let deferred = null;
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e;
    if (/[?&]instalar=1/.test(location.search) && panel) panel.classList.remove("hidden");
  });

  window.addEventListener("appinstalled", () => {
    deferred = null;
    if (status) status.textContent = "App instalado. Use o ícone no ambiente de trabalho ou no ecrã inicial.";
    panel?.classList.add("hidden");
  });

  async function ensureLatest() {
    if (typeof window.__DK_ensureLatestPwa === "function") {
      await window.__DK_ensureLatestPwa({ force: true }).catch(() => {});
    }
  }

  function scopeTitle() {
    const scope = typeof window.__DK_appScope === "function" ? window.__DK_appScope() : "grupodk";
    const titles = window.__DK_appScopeTitle || {};
    return titles[scope] || "Grupo DK";
  }

  if (panel && /[?&]instalar=1/.test(location.search) && !standalone) {
    panel.classList.remove("hidden");
    if (title) title.textContent = `Instalar ${scopeTitle()}`;
  }

  btn?.addEventListener("click", async () => {
    await ensureLatest();
    if (deferred) {
      deferred.prompt();
      const choice = await deferred.userChoice.catch(() => ({ outcome: "dismissed" }));
      deferred = null;
      if (choice.outcome === "accepted") return;
    }
    if (manual) manual.open = true;
    if (status) {
      status.textContent =
        "Se o botão automático não aparecer, use a instalação manual (Windows: ícone ⊕ na barra de endereço).";
    }
  });

  document.querySelectorAll("[data-app-install]").forEach((a) => {
    a.addEventListener("click", () => {
      void ensureLatest();
    });
  });
})();
