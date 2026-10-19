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

  const PLANOS_DA_MOTO = {
    start: ["minha-start", "transporte-start"],
    fan: ["sob-consulta"],
    titan: ["sob-consulta"],
    bros: ["minha-bros", "transporte-bros"],
    factor: ["minha-factor", "transporte-start"],
    crosser: ["minha-crosser", "transporte-bros"],
    jef: ["super-jef"],
    shi: ["super-shi"],
  };

  function siteFecharJanelasMoto() {
    const box = document.getElementById("siteMotoJanelas");
    const grade = document.getElementById("siteMotoJanelasGrade");
    if (grade) grade.replaceChildren();
    if (box) box.hidden = true;
  }

  function siteAbrirJanelasMoto(btn) {
    const moto = btn.getAttribute("data-moto") || "";
    const nome = btn.getAttribute("data-moto-nome") || "Moto";
    const ids = PLANOS_DA_MOTO[moto] || ["sob-consulta"];
    const box = document.getElementById("siteMotoJanelas");
    const grade = document.getElementById("siteMotoJanelasGrade");
    const titulo = document.getElementById("siteMotoJanelasTitulo");
    if (!box || !grade) return;
    grade.replaceChildren();
    ids.forEach((planoId) => {
      let node = null;
      if (planoId === "sob-consulta") {
        const tpl = document.getElementById("tplPlanoSobConsulta");
        node = tpl && tpl.content.firstElementChild ? tpl.content.firstElementChild.cloneNode(true) : null;
      } else {
        const orig = document.querySelector(`#sitePlanos [data-plano-id="${planoId}"]`);
        node = orig ? orig.cloneNode(true) : null;
      }
      if (node) grade.appendChild(node);
    });
    grade.classList.toggle("site-moto-janelas__grade--duas", ids.length > 1);
    if (titulo) titulo.textContent = nome;
    box.hidden = false;
  }

  function siteMedirTopo() {
    const topo = document.querySelector("#view-site .site-publico__topo");
    const h = topo ? topo.offsetHeight : 0;
    if (h) document.documentElement.style.setProperty("--site-topo", h + "px");
    return h;
  }

  function siteMarcarDetalhe(nome) {
    document.querySelectorAll("[data-site-detalhe]").forEach((btn) => {
      const on = (btn.getAttribute("data-site-detalhe") || "") === nome;
      btn.classList.toggle("site-publico__nav-atual", on);
      if (on) btn.setAttribute("aria-current", "page");
      else btn.removeAttribute("aria-current");
    });
  }

  function siteRolarPara(id, suave) {
    const alvo = document.getElementById(id);
    if (!alvo) return;
    const h = siteMedirTopo();
    let y = 0;
    let el = alvo;
    while (el) {
      y += el.offsetTop;
      el = el.offsetParent;
    }
    window.scrollTo({ top: Math.max(0, y - h), behavior: suave ? "smooth" : "auto" });
  }

  function siteIrPara(nome, suave) {
    const view = document.getElementById("view-site");
    if (view && !view.classList.contains("view--active")) mostrarView("view-site");
    if (nome !== "motos") siteFecharJanelasMoto();
    siteMarcarDetalhe(nome);
    siteRolarPara(nome === "motos" ? "siteMotos" : "sitePlanos", suave);
    try {
      history.replaceState(null, "", `${location.pathname}${location.search}#${nome}`);
    } catch {
      /* ignore */
    }
  }

  function siteVoltarAoTopo() {
    siteFecharJanelasMoto();
    siteMarcarDetalhe(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const SITE_WHATSAPP = "5581989037417";

  function siteAbrirWhatsApp(texto) {
    const url = `https://wa.me/${SITE_WHATSAPP}?text=${encodeURIComponent(texto)}`;
    window.open(url, "_blank", "noopener");
  }

  document.addEventListener("click", (e) => {
    const detalheBtn = e.target && e.target.closest ? e.target.closest("[data-site-detalhe]") : null;
    if (!detalheBtn) return;
    const detalhe = detalheBtn.getAttribute("data-site-detalhe") || "";
    if (detalhe === "alugar") {
      e.preventDefault();
      siteAbrirWhatsApp("Olá! Quero alugar uma moto na DK e falar com um atendente.");
      return;
    }
    if (detalhe !== "planos" && detalhe !== "motos") return;
    e.preventDefault();
    siteIrPara(detalhe, true);
  });

  document.addEventListener("click", (e) => {
    const quero = e.target && e.target.closest ? e.target.closest(".site-plano__quero, [data-site-atendente]") : null;
    if (!quero) return;
    e.preventDefault();
    const card = quero.closest(".site-plano");
    if (quero.hasAttribute("data-site-atendente") || card?.getAttribute("data-plano-id") === "sob-consulta") {
      siteAbrirWhatsApp("OLÁ, QUERO SABER MAIS SOBRE OS OUTROS PLANOS DK");
      return;
    }
    const nome = String(card?.getAttribute("aria-label") || card?.querySelector(".site-plano__nome")?.textContent || "um plano DK").trim();
    siteAbrirWhatsApp(`Olá! Quero o plano ${nome} e falar com um atendente.`);
  });

  document.addEventListener("click", (e) => {
    const motoBtn = e.target && e.target.closest ? e.target.closest("#siteMotos .site-moto") : null;
    if (!motoBtn) return;
    e.preventDefault();
    siteAbrirJanelasMoto(motoBtn);
  });

  document.addEventListener("click", (e) => {
    const box = document.getElementById("siteMotoJanelas");
    if (!box || box.hidden) return;
    if (e.target === box || (e.target.closest && e.target.closest("[data-moto-fechar]"))) {
      e.preventDefault();
      siteFecharJanelasMoto();
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    const box = document.getElementById("siteMotoJanelas");
    if (!box || box.hidden) return;
    siteFecharJanelasMoto();
  });

  document.addEventListener("click", (e) => {
    const siteBtn = e.target && e.target.closest ? e.target.closest("[data-site-go]") : null;
    if (!siteBtn) return;
    const destino = siteBtn.getAttribute("data-site-go") || "";
    if (destino === "sistema") {
      e.preventDefault();
      siteVoltarAoTopo();
      mostrarView("view-home");
    } else if (destino === "site") {
      e.preventDefault();
      mostrarView("view-site");
      siteVoltarAoTopo();
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

  let siteSpy = false;
  window.addEventListener("scroll", () => {
    if (siteSpy) return;
    siteSpy = true;
    requestAnimationFrame(() => {
      siteSpy = false;
      const view = document.getElementById("view-site");
      if (!view || !view.classList.contains("view--active")) return;
      const linha = siteMedirTopo() + 12;
      const motos = document.getElementById("siteMotos");
      const planos = document.getElementById("sitePlanos");
      const passou = (el) => el && el.getBoundingClientRect().top <= linha;
      if (passou(motos)) siteMarcarDetalhe("motos");
      else if (passou(planos)) siteMarcarDetalhe("planos");
      else siteMarcarDetalhe(null);
    });
  }, { passive: true });

  siteMedirTopo();
  const hashSite = (location.hash || "").toLowerCase();
  if (hashSite === "#planos" || hashSite === "#motos") {
    mostrarView("view-site");
    siteIrPara(hashSite.slice(1), false);
  }
})();
