/**
 * Página dedicada só à instalação PWA (sem CPF/senha na URL nem no localStorage).
 */
(function () {
  const INSTALL_AUTH_KEY = "dk_cliente_install_auth";

  function stripSensitiveQueryFromUrl() {
    try {
      const u = new URL(location.href);
      let dirty = false;
      ["cpf", "proto", "protocolo", "senha", "password", "pass"].forEach((k) => {
        if (u.searchParams.has(k)) {
          u.searchParams.delete(k);
          dirty = true;
        }
      });
      if (dirty) {
        history.replaceState(null, "", u.pathname + (u.search || "") + u.hash);
      }
    } catch {
      /* ignore */
    }
  }

  /** Aceita autorização da sessão; nunca grava CPF/senha no localStorage. */
  function consumeInstallAuthFromSession() {
    try {
      const raw = sessionStorage.getItem(INSTALL_AUTH_KEY);
      if (!raw) return;
      const g = JSON.parse(raw);
      if (!g?.ok) return;
      /* Mantém só o flag de instalação autorizada (sem identidade). */
      sessionStorage.setItem(INSTALL_AUTH_KEY, JSON.stringify({ ok: 1, at: Date.now() }));
    } catch {
      /* ignore */
    }
  }

  function clearCredentialCaches() {
    try {
      localStorage.removeItem("dk_cliente_gate_persist");
      sessionStorage.removeItem("dk_cliente_app_gate");
      sessionStorage.removeItem("dk_cliente_app_gate_v1");
    } catch {
      /* ignore */
    }
  }

  function isStandalone() {
    try {
      return (
        window.matchMedia("(display-mode: standalone)").matches ||
        window.matchMedia("(display-mode: fullscreen)").matches ||
        window.navigator.standalone === true
      );
    } catch {
      return false;
    }
  }

  function setStatus(msg) {
    const el = document.getElementById("install-status");
    if (el) el.textContent = msg;
  }

  let deferredPrompt = null;
  const btn = document.getElementById("btn-install-cliente");
  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent || "");

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    setStatus("Pronto! Toque em «Instalar app DK Cliente» abaixo.");
  });

  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    setStatus("App instalado! A abrir… Entre com CPF e senha.");
    clearCredentialCaches();
    try {
      localStorage.setItem("dk_cliente_pwa_installed", "1");
      sessionStorage.removeItem(INSTALL_AUTH_KEY);
    } catch {
      /* ignore */
    }
    setTimeout(() => {
      window.location.replace("/cliente");
    }, 1200);
  });

  btn?.addEventListener("click", async () => {
    if (deferredPrompt) {
      try {
        deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        deferredPrompt = null;
        if (choice?.outcome === "accepted") {
          setStatus("Instalação em curso…");
          return;
        }
        setStatus("Cancelado. Use as instruções manuais abaixo.");
      } catch {
        setStatus("Use o menu do browser: Instalar app / Adicionar ao ecrã inicial.");
      }
      document.getElementById("install-manual")?.setAttribute("open", "open");
      return;
    }
    document.getElementById("install-manual")?.setAttribute("open", "open");
    setStatus(
      isIos
        ? "iPhone: no Safari, toque em partilhar (↑) → «Adicionar à Tela de Início»."
        : "Android: no Chrome, menu (⋮) → «Instalar app» ou «Adicionar ao ecrã inicial»."
    );
  });

  stripSensitiveQueryFromUrl();
  consumeInstallAuthFromSession();
  /* Nunca gravar CPF/senha vindos de URL antiga no localStorage do PWA. */
  clearCredentialCaches();

  if (isStandalone()) {
    window.location.replace("/cliente");
  } else if (isIos) {
    setStatus("iPhone: use Safari e «Adicionar à Tela de Início» (instruções abaixo).");
  } else {
    setStatus("Android: aguarde e toque em «Instalar app DK Cliente». Se não aparecer, use o menu ⋮ do Chrome.");
  }
})();
