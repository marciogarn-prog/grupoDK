/**
 * Página dedicada só à instalação PWA (sem redirect para o portal).
 */
(function () {
  const GATE_KEY = "dk_cliente_app_gate";
  const GATE_PERSIST = "dk_cliente_gate_persist";

  function onlyDigits(s) {
    return String(s ?? "").replace(/\D/g, "");
  }

  function normProto(value) {
    return String(value ?? "")
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "");
  }

  function persistGateFromUrl() {
    try {
      const q = new URLSearchParams(location.search);
      const cpf = onlyDigits(q.get("cpf") || "").slice(0, 11);
      const proto = normProto(q.get("proto") || q.get("protocolo") || "");
      if (cpf.length !== 11 || !proto) return;
      const payload = JSON.stringify({ cpf, proto, at: Date.now() });
      sessionStorage.setItem(GATE_KEY, payload);
      localStorage.setItem(GATE_PERSIST, payload);
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
    setStatus("App instalado! A abrir…");
    try {
      localStorage.setItem("dk_cliente_pwa_installed", "1");
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

  persistGateFromUrl();

  if (isStandalone()) {
    window.location.replace("/cliente");
  } else if (isIos) {
    setStatus("iPhone: use Safari e «Adicionar à Tela de Início» (instruções abaixo).");
  } else {
    setStatus("Android: aguarde e toque em «Instalar app DK Cliente». Se não aparecer, use o menu ⋮ do Chrome.");
  }
})();
