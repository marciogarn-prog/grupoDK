/**
 * Sistema MIEL — Etapa 02/84: aba Administrativo (planilha miel-sistema.xlsm).
 * Réplica do grid Excel: 3 colunas (Página Inicial | Formulários | Relatórios).
 */
(function portalMielAdmin() {
  const PANEL_ID = "mielPanelAdministrativo";

  /** Cabeçalhos linha 9 — colunas A, D, T (sharedStrings). */
  const COL_HEADERS = ["Página Inicial", "Formulários", "Relatórios"];

  /**
   * Linhas ímpares 11–35 — valores extraídos da aba Administrativo (A | D | T).
   * null = célula vazia / linha espaçadora.
   */
  const MENU_ROWS = [
    { a: "DASHBOARD", d: "Cadastro de Clientes", t: "Relação de Clientes" },
    { a: "Cadastro de Veículos", d: null, t: "Relação de Veículos" },
    { a: "Módulos", d: "Consulta Integrada (Veículos/Clientes)", t: "Acomp. de Transf. de Propriedade" },
    { a: "Administrativo", d: "Ctrl Integrado de Multas", t: "Status de Veículos" },
    { a: "Financeiro", d: "Formulário de Lista de Espera", t: "Relação de Motos Vendidas" },
    { a: "Depto Pessoal", d: "Etiquetas dos Chaveiros (Motos)", t: null },
    { a: "Ctrl de Locação de Veículos", d: "Etiquetas dos Chaveiros (Carros)", t: null },
    { a: "Ctrl de Manutenção", d: "Relatório de Status da CNH / EAR", t: null },
    { a: "Gráficos", d: "Pendências Administrativas", t: null },
    { a: "Planejamento", d: "Acomp. de CRLVs Anuais dos Veículos", t: null },
    { a: null, d: null, t: null },
    { a: "Documentos Gerais", d: null, t: null },
    { a: null, d: null, t: null },
    { a: "Procedimentos", d: null, t: null },
  ];

  /** Destinos ao clicar — id, label e peça (stub). */
  const TARGETS = {
    DASHBOARD: { id: "dashboard", label: "Dashboard", piece: 3 },
    "Cadastro de Veículos": { id: "cad-veiculos", label: "Cadastro de Veículos", piece: 13 },
    Módulos: { id: "modulos-hub", label: "Módulos", piece: 2 },
    Administrativo: { id: "administrativo", label: "Administrativo", piece: 2 },
    Financeiro: { id: "financeiro", label: "Financeiro", piece: 4 },
    "Depto Pessoal": { id: "depto-pessoal", label: "Depto Pessoal", piece: 5 },
    "Ctrl de Locação de Veículos": { id: "locacao-veiculos", label: "Ctrl de Locação de Veículos", piece: 6 },
    "Ctrl de Manutenção": { id: "ctrl-manutencao", label: "Ctrl de Manutenção", piece: 7 },
    Gráficos: { id: "graficos", label: "Gráficos", piece: 8 },
    Planejamento: { id: "planejamento", label: "Planejamento", piece: 9 },
    "Documentos Gerais": { id: "documentos-gerais", label: "Documentos Gerais", piece: 2 },
    Procedimentos: { id: "procedimentos", label: "Procedimentos", piece: 10 },
    "Cadastro de Clientes": { id: "cad-clientes", label: "Cadastro de Clientes", piece: 12 },
    "Consulta Integrada (Veículos/Clientes)": {
      id: "consulta-integrada",
      label: "Consulta Integrada (Veículos/Clientes)",
      piece: 11,
    },
    "Ctrl Integrado de Multas": { id: "ctrl-multas", label: "Ctrl Integrado de Multas", piece: 56 },
    "Formulário de Lista de Espera": { id: "form-lista-espera", label: "Formulário de Lista de Espera", piece: 50 },
    "Etiquetas dos Chaveiros (Motos)": { id: "id-chaveiros-motos", label: "ID Chaveiros (Motos)", piece: 52 },
    "Etiquetas dos Chaveiros (Carros)": { id: "id-chaveiros-carros", label: "ID Chaveiros (Carros)", piece: 51 },
    "Relatório de Status da CNH / EAR": { id: "relatorio-ear", label: "Relatório CNH/EAR", piece: 61 },
    "Pendências Administrativas": { id: "pendencias-admin", label: "Pendências Administrativas", piece: 2 },
    "Acomp. de CRLVs Anuais dos Veículos": { id: "acomp-crlvs", label: "Acomp. CRLVs Anuais", piece: 2 },
    "Relação de Clientes": { id: "relacao-clientes", label: "Relação de Clientes", piece: 15 },
    "Relação de Veículos": { id: "relacao-veiculos", label: "Relação de Veículos", piece: 16 },
    "Acomp. de Transf. de Propriedade": { id: "acomp-transf", label: "Acomp. Transf. Propriedade", piece: 18 },
    "Status de Veículos": { id: "status-veiculos", label: "Status Veículos", piece: 17 },
    "Relação de Motos Vendidas": { id: "motos-vendidas", label: "Motos Vendidas", piece: 26 },
  };

  const NAV_SHEET_IDS = new Set([
    "dashboard",
    "financeiro",
    "depto-pessoal",
    "locacao-veiculos",
    "ctrl-manutencao",
    "graficos",
    "planejamento",
    "procedimentos",
    "administrativo",
  ]);

  function esc(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function cellBtn(label, col, rowIdx) {
    if (!label) return `<td class="miel-admin-grid__gap" colspan="1" aria-hidden="true"></td>`;
    const target = TARGETS[label];
    const cls =
      col === "a"
        ? "miel-admin-grid__btn miel-admin-grid__btn--col-a"
        : col === "d"
          ? "miel-admin-grid__btn miel-admin-grid__btn--col-d"
          : "miel-admin-grid__btn miel-admin-grid__btn--col-t";
    if (!target) {
      return `<td class="${cls} miel-admin-grid__btn--static"><span>${esc(label)}</span></td>`;
    }
    return `<td class="${cls}">
      <button type="button" class="miel-admin-grid__hit"
        data-miel-admin-action="${esc(label)}"
        data-miel-admin-target="${esc(target.id)}"
        data-miel-admin-row="${rowIdx}">${esc(label)}</button>
    </td>`;
  }

  function renderPanel(container) {
    const headerCells = COL_HEADERS.map(
      (h, i) => {
        const col = i === 0 ? "a" : i === 1 ? "d" : "t";
        const extra = i === 1 ? " miel-admin-grid__head--form" : i === 2 ? " miel-admin-grid__head--rel" : "";
        return `<td class="miel-admin-grid__head${extra}">${esc(h)}</td>`;
      }
    ).join("");

    const bodyRows = MENU_ROWS.map((row, idx) => {
      if (!row.a && !row.d && !row.t) {
        return `<tr class="miel-admin-grid__spacer" aria-hidden="true"><td colspan="3"></td></tr>`;
      }
      return `<tr class="miel-admin-grid__row">
        ${cellBtn(row.a, "a", idx)}
        ${cellBtn(row.d, "d", idx)}
        ${cellBtn(row.t, "t", idx)}
      </tr>`;
    }).join("");

    container.innerHTML = `<div class="miel-admin">
      <table class="miel-admin-grid" aria-label="Administrativo — menu planilha">
        <tbody>
          <tr class="miel-admin-grid__banner"><td colspan="3">ADMINISTRATIVO</td></tr>
          <tr class="miel-admin-grid__spacer" aria-hidden="true"><td colspan="3"></td></tr>
          <tr class="miel-admin-grid__headers">${headerCells}</tr>
          ${bodyRows}
        </tbody>
      </table>
    </div>`;
  }

  function openTarget(label) {
    const target = TARGETS[label];
    if (!target) return;
    if (NAV_SHEET_IDS.has(target.id) && typeof window.__DK_mielShowSheet === "function") {
      window.__DK_mielShowSheet(target.id);
      return;
    }
    if (typeof window.__DK_mielOpenDestino === "function") {
      window.__DK_mielOpenDestino(target.id, target.label, target.piece);
    }
  }

  function bindPanel(container) {
    container.querySelectorAll("[data-miel-admin-target]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const label = btn.getAttribute("data-miel-admin-action") || "";
        openTarget(label);
      });
    });
  }

  function init() {
    const container = document.getElementById(PANEL_ID);
    if (!container || container.dataset.mielAdminReady === "1") return;
    renderPanel(container);
    bindPanel(container);
    container.dataset.mielAdminReady = "1";
  }

  window.__DK_mielInitAdministrativo = init;
  window.__DK_mielAdminTargets = TARGETS;
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
