/**
 * Sistema MIEL — UI isolada (réplica planilha Excel).
 * Etapa 01: Página_Inicial
 * Etapa 02: Administrativo
 * Etapa 03: Cadastro de Clientes
 * Etapa 04: Cadastro de Veículos
 */
(function portalMielUi() {
  const root = document.getElementById("view-miel");
  if (!root) return;

  const MIEL_SHEETS = [
    { id: "pagina-inicial", label: "Página Inicial", piece: 1 },
    { id: "administrativo", label: "Administrativo", piece: 2 },
    { id: "dashboard", label: "Dashboard", piece: 3 },
    { id: "financeiro", label: "Financeiro", piece: 4 },
    { id: "depto-pessoal", label: "Depto Pessoal", piece: 5 },
    { id: "locacao-veiculos", label: "Ctrl de Locação de Veículos", piece: 6 },
    { id: "ctrl-manutencao", label: "Ctrl de Manutenção", piece: 7 },
    { id: "graficos", label: "Gráficos", piece: 8 },
    { id: "planejamento", label: "Planejamento", piece: 9 },
    { id: "procedimentos", label: "Procedimentos", piece: 10 },
  ];

  const NAV_TO_SHEET = {
    "pagina-inicial": "pagina-inicial",
    dashboard: "dashboard",
    administrativo: "administrativo",
    financeiro: "financeiro",
    "depto-pessoal": "depto-pessoal",
    "locacao-veiculos": "locacao-veiculos",
    "ctrl-manutencao": "ctrl-manutencao",
    graficos: "graficos",
    planejamento: "planejamento",
    procedimentos: "procedimentos",
  };

  const STATIC_IDS = (window.__DK_MIEL_STATIC_REGISTRY || []).map((s) => s.id);
  const STATIC_HOOKS = window.__DK_MIEL_STATIC_INIT_HOOKS || {};

  const IMPLEMENTED = new Set([
    "pagina-inicial",
    "administrativo",
    "cad-clientes",
    "cad-veiculos",
    "relacao-clientes",
    "relacao-veiculos",
    "status-veiculos",
    ...STATIC_IDS,
  ]);

  const INIT_HOOKS = {
    administrativo: "__DK_mielInitAdministrativo",
    "cad-clientes": "__DK_mielInitCadClientes",
    "cad-veiculos": "__DK_mielInitCadVeiculos",
    "relacao-clientes": "__DK_mielInitRelacaoClientes",
    "relacao-veiculos": "__DK_mielInitRelacaoVeiculos",
    "status-veiculos": "__DK_mielInitStatusVeiculos",
    ...STATIC_HOOKS,
  };

  const dateEl = document.getElementById("mielAppDataLocal");
  const titleEl = document.getElementById("mielMainTitle");
  const contentEl = document.getElementById("mielMainContent");
  const navButtons = root.querySelectorAll("[data-miel-nav]");
  const panels = () => root.querySelectorAll("[data-miel-panel]");

  function formatMielDate(d) {
    const dias = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];
    const meses = [
      "janeiro",
      "fevereiro",
      "março",
      "abril",
      "maio",
      "junho",
      "julho",
      "agosto",
      "setembro",
      "outubro",
      "novembro",
      "dezembro",
    ];
    return `Petrolina-PE, ${dias[d.getDay()]}, ${d.getDate()} de ${meses[d.getMonth()]} de ${d.getFullYear()}`;
  }

  const dynamicMeta = new Map();

  function sheetMeta(id) {
    if (dynamicMeta.has(id)) return dynamicMeta.get(id);
    return MIEL_SHEETS.find((s) => s.id === id) || { id, label: id, piece: "?" };
  }

  function ensurePanel(sheetId) {
    if (IMPLEMENTED.has(sheetId)) return root.querySelector(`[data-miel-panel="${sheetId}"]`);
    let panel = root.querySelector(`[data-miel-panel="${CSS.escape(sheetId)}"]`);
    if (!panel && contentEl) {
      panel = document.createElement("div");
      panel.className = "miel-panel miel-panel--stub hidden";
      panel.setAttribute("data-miel-panel", sheetId);
      contentEl.appendChild(panel);
    }
    return panel;
  }

  function fillStub(sheetId, meta) {
    const placeholder = ensurePanel(sheetId);
    if (!placeholder) return;
    placeholder.classList.add("miel-panel--stub");
    placeholder.dataset.mielFilled = "1";
    const backBtn = meta.fromAdmin
      ? `<button type="button" class="miel-nav-btn miel-stub-back" data-miel-stub-back="administrativo">← Voltar ao Administrativo</button>`
      : "";
    placeholder.innerHTML = `<div class="miel-panel-placeholder"><h2>${meta.label}</h2><p>Peça <strong>${meta.piece}/84</strong> — em construção.</p>${backBtn}</div>`;
    placeholder.querySelector("[data-miel-stub-back]")?.addEventListener("click", () => showSheet("administrativo"));
  }

  function showSheet(sheetId) {
    const meta = sheetMeta(sheetId);
    if (titleEl) titleEl.textContent = meta.label;

    navButtons.forEach((btn) => {
      const nav = btn.getAttribute("data-miel-nav") || "";
      const target = NAV_TO_SHEET[nav] || nav;
      btn.classList.toggle("miel-nav-btn--active", !meta.fromAdmin && target === sheetId);
    });

    const PRESERVE_HTML = new Set(["pagina-inicial"]);
    if (INIT_HOOKS[sheetId] && typeof window[INIT_HOOKS[sheetId]] === "function") {
      window[INIT_HOOKS[sheetId]]();
    } else if (!PRESERVE_HTML.has(sheetId) && typeof window.__DK_mielInitGenericSheet === "function") {
      window.__DK_mielInitGenericSheet(sheetId, meta.label);
    } else if (sheetId === "pagina-inicial") {
      const panel = root.querySelector('[data-miel-panel="pagina-inicial"]');
      if (panel && !panel.querySelector(".miel-pagina-inicial__hero")) {
        panel.innerHTML =
          '<img class="miel-pagina-inicial__hero" src="/images/dk-locadora-logo.png" alt="DK Locadora" decoding="async">';
      }
    }

    ensurePanel(sheetId);
    panels().forEach((panel) => {
      const pid = panel.getAttribute("data-miel-panel") || "";
      panel.classList.toggle("hidden", pid !== sheetId);
    });
  }

  function openDestino(id, label, piece) {
    dynamicMeta.set(id, { id, label, piece, fromAdmin: true });
    showSheet(id);
  }

  function openExcelLocation(location) {
    const toId =
      typeof window.__DK_mielExcelLocationToId === "function"
        ? window.__DK_mielExcelLocationToId(location)
        : String(location || "");
    const sheet = typeof window.__DK_mielParseExcelSheetName === "function"
      ? window.__DK_mielParseExcelSheetName(location)
      : String(location || "");
    const label = sheet.replace(/_/g, " ");
    openDestino(toId, label, "?");
  }

  function refreshDate() {
    if (dateEl) dateEl.textContent = formatMielDate(new Date());
  }

  navButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const nav = btn.getAttribute("data-miel-nav") || "";
      const sheetId = NAV_TO_SHEET[nav] || nav;
      showSheet(sheetId);
    });
  });

  refreshDate();
  showSheet("pagina-inicial");

  window.__DK_mielOnShow = function mielOnShow() {
    refreshDate();
    showSheet("pagina-inicial");
  };
  window.__DK_mielPieceCount = 84;
  window.__DK_mielEtapasImplementadas = 7;
  window.__DK_mielSheets = MIEL_SHEETS;
  window.__DK_mielShowSheet = showSheet;
  window.__DK_mielOpenDestino = openDestino;
  window.__DK_mielOpenExcelLocation = openExcelLocation;

  contentEl?.addEventListener("click", (ev) => {
    const btn = ev.target.closest("[data-miel-xl-link]");
    if (!btn || !contentEl.contains(btn)) return;
    const loc = btn.getAttribute("data-miel-xl-link") || "";
    if (loc) openExcelLocation(loc);
  });
})();
