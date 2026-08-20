/**
 * Sistema MIEL — Etapa 02/84: aba Administrativo (planilha miel-sistema.xlsm).
 * Área principal = 2 colunas (Formulários | Relatórios). Coluna A = menu lateral (index.html).
 */
(function portalMielAdmin() {
  const PANEL_ID = "mielPanelAdministrativo";

  /** Cabeçalhos D9 e T9 — coluna A9 é menu lateral, não entra no grid principal. */
  const COL_HEADERS = ["Formulários", "Relatórios"];

  /**
   * Itens visíveis na planilha (conferência verify-miel-admin-planilha.mjs).
   * Formulários: D11, A13, D15, D17, D19
   * Relatórios: T11–T19 + D21–D29
   */
  const FORM_ITEMS = [
    "Cadastro de Clientes",
    "Cadastro de Veículos",
    "Consulta Integrada (Veículos/Clientes)",
    "Ctrl Integrado de Multas",
    "Formulário de Lista de Espera",
  ];

  const REL_ITEMS = [
    "Relação de Clientes",
    "Relação de Veículos",
    "Acomp. de Transf. de Propriedade",
    "Status de Veículos",
    "Relação de Motos Vendidas",
    "Etiquetas dos Chaveiros (Motos)",
    "Etiquetas dos Chaveiros (Carros)",
    "Relatório de Status da CNH / EAR",
    "Pendências Administrativas",
    "Acomp. de CRLVs Anuais dos Veículos",
  ];

  /** Último botão desativado na planilha (texto acinzentado). */
  const DISABLED_LABELS = new Set(["Acomp. de CRLVs Anuais dos Veículos"]);

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
    if (!label) {
      return `<td class="miel-admin-grid__gap miel-admin-grid__gap--${col}" aria-hidden="true"></td>`;
    }
    const target = TARGETS[label];
    const disabled = DISABLED_LABELS.has(label);
    const cls =
      col === "form"
        ? "miel-admin-grid__btn miel-admin-grid__btn--form"
        : "miel-admin-grid__btn miel-admin-grid__btn--rel";
    if (!target || disabled) {
      return `<td class="${cls} miel-admin-grid__btn--static${disabled ? " miel-admin-grid__btn--disabled" : ""}">
        <span${disabled ? ' aria-disabled="true"' : ""}>${esc(label)}</span>
      </td>`;
    }
    return `<td class="${cls}">
      <button type="button" class="miel-admin-grid__hit"
        data-miel-admin-action="${esc(label)}"
        data-miel-admin-target="${esc(target.id)}"
        data-miel-admin-row="${rowIdx}">${esc(label)}</button>
    </td>`;
  }

  function renderPanel(container) {
    const rowCount = Math.max(FORM_ITEMS.length, REL_ITEMS.length);
    const headerCells = COL_HEADERS.map((h, i) => {
      const extra = i === 0 ? " miel-admin-grid__head--form" : " miel-admin-grid__head--rel";
      return `<td class="miel-admin-grid__head${extra}">${esc(h)}</td>`;
    }).join("");

    const bodyParts = [];
    for (let i = 0; i < rowCount; i++) {
      if (i > 0) bodyParts.push('<tr class="miel-admin-grid__spacer" aria-hidden="true"><td colspan="2"></td></tr>');
      bodyParts.push(`<tr class="miel-admin-grid__row">
        ${cellBtn(FORM_ITEMS[i] || null, "form", i)}
        ${cellBtn(REL_ITEMS[i] || null, "rel", i)}
      </tr>`);
    }

    container.innerHTML = `<div class="miel-admin">
      <table class="miel-admin-grid miel-admin-grid--2col" aria-label="Administrativo — Formulários e Relatórios">
        <tbody>
          <tr class="miel-admin-grid__banner"><td colspan="2">Administrativo</td></tr>
          <tr class="miel-admin-grid__spacer" aria-hidden="true"><td colspan="2"></td></tr>
          <tr class="miel-admin-grid__headers">${headerCells}</tr>
          ${bodyParts.join("")}
        </tbody>
      </table>
    </div>`;
  }

  function openTarget(label) {
    const target = TARGETS[label];
    if (!target || DISABLED_LABELS.has(label)) return;
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
        openTarget(btn.getAttribute("data-miel-admin-action") || "");
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
  window.__DK_mielAdminFormItems = FORM_ITEMS.slice();
  window.__DK_mielAdminRelItems = REL_ITEMS.slice();
  window.__DK_mielAdminTargets = TARGETS;
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
