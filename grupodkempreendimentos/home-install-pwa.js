/** Instalar os 4 apps (Grupo DK, Locadora, Centro, Construtora) com escopos separados. */
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

  const pathNow = (location.pathname.replace(/\/$/, "") || "/").toLowerCase();
  if (!standalone && /[?&]instalar=1/.test(location.search) && (pathNow === "/" || pathNow === "/index.html")) {
    location.replace("/grupodk?instalar=1");
    return;
  }

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
        "O Windows vai criar o atalho deste aplicativo na área de trabalho ou no menu Iniciar. Os quatro apps podem ficar instalados ao mesmo tempo.";
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

  function waitForDeferred(ms) {
    if (deferred) return Promise.resolve(true);
    return new Promise((resolve) => {
      const start = Date.now();
      const id = window.setInterval(() => {
        if (deferred) {
          window.clearInterval(id);
          resolve(true);
        } else if (Date.now() - start >= ms) {
          window.clearInterval(id);
          resolve(false);
        }
      }, 120);
    });
  }

  function openInstallInBrowser(href) {
    try {
      const url = new URL(href, location.origin);
      url.searchParams.set("instalar", "1");
      window.open(url.toString(), "_blank", "noopener");
      return true;
    } catch {
      return false;
    }
  }

  function showBlockedByOldApp() {
    panel?.classList.remove("hidden");
    if (title) title.textContent = `Instalar ${scopeTitle()}`;
    if (manual) manual.open = true;
    if (status) {
      status.textContent =
        "O Chrome ainda vê um app antigo que cobre o site inteiro (por isso aparece «Abrir no app» e não deixa instalar Locadora, Centro ou Construtora). Nesta máquina de testes: Configurações do Windows → Aplicativos → desinstale Grupo DK / DK Locadora / qualquer app deste site. Feche o Chrome. Depois instale de novo um a um, cada um no seu endereço. Os dados continuam a sincronizar entre os quatro.";
    }
  }

  async function runBrowserInstall() {
    await ensureLatest();
    await waitForDeferred(5000);
    if (deferred) {
      try {
        deferred.prompt();
        const choice = await deferred.userChoice.catch(() => ({ outcome: "dismissed" }));
        deferred = null;
        if (choice.outcome === "accepted") {
          if (status) {
            status.textContent =
              "App instalado. Se o ícone não estiver na área de trabalho, abra o Menu Iniciar, pesquise o nome do app e arraste para a área de trabalho. No Chrome, marque «criar atalho na área de trabalho» na próxima instalação.";
          }
          panel?.classList.add("hidden");
          return true;
        }
        if (status) {
          status.textContent = "Instalação cancelada. Clique em Instalar neste computador para tentar de novo.";
        }
        panel?.classList.remove("hidden");
        return false;
      } catch {
        deferred = null;
      }
    }
    showBlockedByOldApp();
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
        status.textContent = "A abrir o instalador do Windows/Chrome para criar o ícone…";
      }
      void runBrowserInstall();
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
      e.preventDefault();
      pendingHref = a.getAttribute("href") || "";
      const key = a.getAttribute("data-app-install") || "";
      if (standalone) {
        if (status) {
          panel?.classList.remove("hidden");
          status.textContent =
            "A instalação dos outros apps precisa ser feita no Chrome (não de dentro deste app). Abri a página no navegador.";
        }
        openInstallInBrowser(pendingHref);
        return;
      }
      showAuthModal(appNameFromKey(key));
      void ensureLatest();
    });
  });
})();
