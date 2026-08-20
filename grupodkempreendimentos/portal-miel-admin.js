/**
 * Sistema MIEL — Etapa 02/84: aba Administrativo (planilha miel-sistema.xlsm).
 * Dados isolados: dk_miel_* (sem interferência no portal Locadora).
 */
(function portalMielAdmin() {
  const PANEL_ID = "mielPanelAdministrativo";
  const STORAGE_KEY = "dk_miel_admin_busca";

  /** Linhas extraídas da aba Administrativo (colunas D | AZ | T). */
  const ADMIN_ROWS = [
    { d: "99HSHF175TS001379", az: "Maio/2021", t: "Município/UF" },
    { d: "Volante", az: "Rodas", t: "IPVA (Parc. 08)" },
    { d: "WY164FML17605304", az: "", t: "ADMINISTRATIVO", banner: true },
    { d: "Locada para", az: "DKMT - 032", t: "RUA FRANCISCO TEIXEIRA, 31 - VILA LIONS" },
    { d: "JABOATÃO DOS GUARARAPES/PE", az: "DKMT - 034", t: "Veículos" },
    { d: "074.409.644-89", az: "", t: "Triâng/Macaco/Ch. Rodas", search: true },
    { d: "9C2KC2500TR145254", az: "CONTRATO DE LOCAÇÃO DE VEÍCULO", t: "" },
    { d: "KC25E0T145158", az: "Outubro/2025", t: "" },
    { d: "108.311.074-80", az: "Km Próx. Manutenção", t: "" },
    { d: "Fe,2025", az: "XNKAJ8462899", t: "" },
    { d: "Relação de Veículos", az: "053.196.314-48", t: "" },
    { d: "99HSHF175TS007486", az: "", t: "" },
  ];

  /** Botões laterais (rótulos # da planilha — módulo administrativo). */
  const ADMIN_SIDE_BUTTONS = [
    "Cadastro de Clientes",
    "Cadastro de Veículos",
    "Consulta de Clientes",
    "Consulta de Veículos",
    "Relação de Clientes Cadastrados no Sistema",
    "Relação de Veículos Cadastrados no Sistema",
    "Relação de Status de Veículos",
    "Emissão de Protocolos",
    "Relação de Protocolos Emitidos",
    "Relatório de Pendências no Cadastro dos Clientes",
    "Relatório de Clientes por EAR",
    "Formulário de Prestação de Contas (Fundo Fixo)",
    "Recibo e Lista de Valores PASSIVOS para Cobrança Ostensiva",
    "Panfleto Padrão",
    "Relação de Motos Vendidas",
    "Tabela Oficial",
  ];

  function esc(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function renderPanel(container) {
    const rowsHtml = ADMIN_ROWS.map((row) => {
      if (row.banner) {
        return `<tr class="miel-admin-table__banner"><td colspan="3">ADMINISTRATIVO</td></tr>`;
      }
      if (row.search) {
        return `<tr class="miel-admin-table__search">
          <td>${esc(row.d)}</td>
          <td colspan="2">
            <input type="search" class="miel-admin-search" id="mielAdminBuscaCliente"
              placeholder="Digite o nome para Pesquisar o Cliente..." autocomplete="off"
              aria-label="Pesquisar cliente pelo nome">
          </td>
        </tr>`;
      }
      return `<tr>
        <td class="miel-admin-table__d">${esc(row.d)}</td>
        <td class="miel-admin-table__az">${esc(row.az)}</td>
        <td class="miel-admin-table__t">${esc(row.t)}</td>
      </tr>`;
    }).join("");

    const sideHtml = ADMIN_SIDE_BUTTONS.map(
      (label) =>
        `<button type="button" class="miel-admin-side-btn" data-miel-admin-action="${esc(label)}" disabled title="Próximas etapas">${esc(label)}</button>`
    ).join("");

    container.innerHTML = `<div class="miel-admin__layout">
      <div class="miel-admin__form-area">
        <table class="miel-admin-table" aria-label="Consulta administrativa">
          <tbody>${rowsHtml}</tbody>
        </table>
      </div>
      <aside class="miel-admin__side-btns" aria-label="Ações administrativas">
        ${sideHtml}
      </aside>
    </div>
    <p class="miel-admin__hint" id="mielAdminFeedback" role="status"></p>`;
  }

  function bindPanel(container) {
    const input = container.querySelector("#mielAdminBuscaCliente");
    const feedback = container.querySelector("#mielAdminFeedback");
    if (!input) return;

    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) input.value = saved;
    } catch {
      /* ignore */
    }

    input.addEventListener("input", () => {
      try {
        localStorage.setItem(STORAGE_KEY, input.value);
      } catch {
        /* ignore */
      }
      if (feedback) {
        feedback.textContent = input.value.trim()
          ? `Pesquisa registrada (etapa 02): «${input.value.trim()}» — lógica completa nas próximas peças.`
          : "";
      }
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
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
