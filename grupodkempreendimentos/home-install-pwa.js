/** Instalar os 4 apps (Grupo DK, Locadora, Centro, Construtora). */
(function homeInstallPwa() {
  const panel = document.getElementById("dkAppInstallPanel");
  const btn = document.getElementById("dkAppInstallBtn");
  const status = document.getElementById("dkAppInstallStatus");
  const title = document.getElementById("dkAppInstallTitle");
  const manual = document.getElementById("dkAppInstallManual");
  const authModal = document.getElementById("dkInstallDesktopModal");
  const authTitle = document.getElementById("dkInstallDesktopTitulo");
  const authText = document.getElementById("dkInstallDesktopTexto");
  const authSub = document.getElementById("dkInstallDesktopSub");
  const authSim = document.getElementById("dkInstallDesktopSim");
  const authNao = document.getElementById("dkInstallDesktopNao");

  const standalone =
    window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;

  const TITLES = window.__DK_appScopeTitle || {
    grupodk: "Grupo DK",
    locadora: "DK Locadora",
    centro: "DK Centro Automotivo",
    construtora: "DK Construtora",
  };

  let deferred = null;
  let pendingHref = "";
  let pendingName = "";
  let skipAuthOnce = false;

  function scopeTitle() {
    const scope = typeof window.__DK_appScope === "function" ? window.__DK_appScope() : "grupodk";
    return TITLES[scope] || pendingName || "Grupo DK";
  }

  function appNameFromKey(key) {
    return TITLES[key] || scopeTitle();
  }

  async function ensureLatest() {
    if (typeof window.__DK_ensureLatestPwa === "function") {
      await window.__DK_ensureLatestPwa({ force: true }).catch(() => {});
    }
  }

  function hideAuthModal() {
    if (!authModal) return;
    authModal.classList.add("hidden");
    authModal.setAttribute("aria-hidden", "true");
  }

  function showAuthModal(name) {
    pendingName = name || scopeTitle();
    if (authTitle) authTitle.textContent = `Instalar ${pendingName}`;
    if (authText) {
      authText.textContent = `AUTORIZA ACRESCENTAR UM ÍCONE DE ACESSO NA ÁREA DE TRABALHO PARA ${String(
        pendingName
      ).toUpperCase()}?`;
    }
    if (authSub) {
      authSub.textContent =
        "O Windows vai criar o atalho deste aplicativo na área de trabalho ou no menu Iniciar.";
    }
    if (!authModal) return;
    authModal.classList.remove("hidden");
    authModal.setAttribute("aria-hidden", "false");
    authSim?.focus();
  }

  function sameInstallPath(href) {
    try {
      const dest = new URL(href, location.origin);
      const a = (dest.pathname.replace(/\/$/, "") || "/").toLowerCase();
      const b = (location.pathname.replace(/\/$/, "") || "/").toLowerCase();
      return a === b;
    } catch {
      return false;
    }
  }

  function showManualFallback() {
    panel?.classList.remove("hidden");
    if (title) title.textContent = `Instalar ${scopeTitle()}`;
    if (manual) manual.open = true;
    if (status) {
      status.textContent =
        "Autorize no Windows o ícone na área de trabalho. Se o pedido automático não aparecer: Chrome ou Edge → ícone Instalar (⊕) na barra de endereço.";
    }
  }

  async function runBrowserInstall() {
    await ensureLatest();
    if (deferred) {
      try {
        deferred.prompt();
        const choice = await deferred.userChoice.catch(() => ({ outcome: "dismissed" }));
        deferred = null;
        if (choice.outcome === "accepted") {
          if (status) {
            status.textContent = "Ícone autorizado. Use o atalho na área de trabalho ou no menu Iniciar.";
          }
          panel?.classList.add("hidden");
          return true;
        }
      } catch {
        deferred = null;
      }
    }
    showManualFallback();
    return false;
  }

  async function onAuthorizeYes() {
    hideAuthModal();
    const href = pendingHref;
    pendingHref = "";
    if (href && !sameInstallPath(href)) {
      try {
        sessionStorage.setItem("dk_desktop_icon_auth", "1");
      } catch {
        /* ignore */
      }
      location.assign(href);
      return;
    }
    await runBrowserInstall();
  }

  function onAuthorizeNo() {
    hideAuthModal();
    pendingHref = "";
    panel?.classList.add("hidden");
    if (/[?&]instalar=1/.test(location.search)) {
      try {
        const u = new URL(location.href);
        u.searchParams.delete("instalar");
        history.replaceState({}, "", u.pathname + u.search + u.hash);
      } catch {
        /* ignore */
      }
    }
  }

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e;
  });

  window.addEventListener("appinstalled", () => {
    deferred = null;
    hideAuthModal();
    if (status) status.textContent = "App instalado. Use o ícone na área de trabalho ou no menu Iniciar.";
    panel?.classList.add("hidden");
  });

  if (panel && /[?&]instalar=1/.test(location.search) && !standalone) {
    let alreadyOk = false;
    try {
      alreadyOk = sessionStorage.getItem("dk_desktop_icon_auth") === "1";
      sessionStorage.removeItem("dk_desktop_icon_auth");
    } catch {
      alreadyOk = false;
    }
    if (title) title.textContent = `Instalar ${scopeTitle()}`;
    if (alreadyOk) {
      skipAuthOnce = true;
      panel.classList.remove("hidden");
      if (status) {
        status.textContent = "Clique abaixo para o Windows criar o ícone na área de trabalho.";
      }
    } else {
      showAuthModal(scopeTitle());
    }
  }

  btn?.addEventListener("click", async () => {
    pendingHref = "";
    if (skipAuthOnce) {
      skipAuthOnce = false;
      await runBrowserInstall();
      return;
    }
    showAuthModal(scopeTitle());
  });

  authSim?.addEventListener("click", () => {
    void onAuthorizeYes();
  });
  authNao?.addEventListener("click", onAuthorizeNo);
  authModal?.querySelector(".portal-modal__backdrop")?.addEventListener("click", onAuthorizeNo);

  document.querySelectorAll("[data-app-install]").forEach((a) => {
    a.addEventListener("click", (e) => {
      if (standalone) return;
      e.preventDefault();
      pendingHref = a.getAttribute("href") || "";
      const key = a.getAttribute("data-app-install") || "";
      showAuthModal(appNameFromKey(key));
      void ensureLatest();
    });
  });
})();
