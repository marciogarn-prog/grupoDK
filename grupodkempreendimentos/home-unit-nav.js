/**
 * Navegação da home (DK Locadora / Centro / Construtora).
 * Ficheiro pequeno e independente: se portal-locadora-ui.js falhar a analisar,
 * os cartões da home continuam a abrir a unidade.
 */
(function homeUnitNav() {
  const HASH = { locadora: "locadora", centro: "centro", construtora: "construtora", miel: "miel" };
  const VIEW = {
    locadora: "view-locadora-hub",
    centro: "view-unidade-hub",
    construtora: "view-unidade-hub",
    miel: "view-miel",
  };
  const TITLE = {
    centro: "DK Centro Automotivo",
    construtora: "DK Construtora",
  };

  function openFromGo(go) {
    if (typeof window.__DK_openUnit === "function") {
      window.__DK_openUnit(go);
      return true;
    }
    const viewId = VIEW[go];
    const target = viewId ? document.getElementById(viewId) : null;
    const home = document.getElementById("view-home");
    if (!target || !home) return false;
    document.querySelectorAll(".view.view--active").forEach((v) => {
      v.classList.remove("view--active");
      v.setAttribute("aria-hidden", "true");
    });
    target.classList.add("view--active");
    target.setAttribute("aria-hidden", "false");
    if (TITLE[go]) {
      const titleEl = document.getElementById("unidade-hub-title");
      if (titleEl) titleEl.textContent = TITLE[go];
    }
    const fragment = HASH[go];
    if (fragment) {
      try {
        history.replaceState(null, "", `${location.pathname}${location.search}#${fragment}`);
      } catch {
        /* ignore */
      }
    }
    return true;
  }

  function mostrarView(id) {
    const target = document.getElementById(id);
    if (!target) return false;
    document.querySelectorAll(".view").forEach((v) => {
      const on = v === target;
      v.classList.toggle("view--active", on);
      v.setAttribute("aria-hidden", on ? "false" : "true");
    });
    try {
      history.replaceState(null, "", `${location.pathname}${location.search}`);
    } catch {
      /* ignore */
    }
    window.scrollTo(0, 0);
    return true;
  }

  document.addEventListener("click", (e) => {
    const siteBtn = e.target && e.target.closest ? e.target.closest("[data-site-go]") : null;
    if (!siteBtn) return;
    const destino = siteBtn.getAttribute("data-site-go") || "";
    if (destino === "sistema") {
      e.preventDefault();
      mostrarView("view-home");
    } else if (destino === "site") {
      e.preventDefault();
      mostrarView("view-site");
    } else if (destino === "cliente") {
      e.preventDefault();
      if (typeof window.__DK_siteAbrirCliente === "function") window.__DK_siteAbrirCliente();
    } else if (destino === "login") {
      e.preventDefault();
      if (typeof window.__DK_siteAbrirLogin === "function") window.__DK_siteAbrirLogin();
    }
  });

  document.addEventListener("click", (e) => {
    const btn = e.target && e.target.closest ? e.target.closest("#view-home [data-go]") : null;
    if (!btn || btn.disabled || btn.hidden || btn.classList.contains("hidden")) return;
    const go = btn.getAttribute("data-go") || "";
    if (!go || !HASH[go]) return;
    e.preventDefault();
    openFromGo(go);
  });

  window.__DK_homeOpenUnit = openFromGo;
})();
