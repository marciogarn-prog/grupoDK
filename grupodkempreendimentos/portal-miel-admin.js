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

  /** Botões laterais → destinos (abas da planilha). */
  const ADMIN_SIDE_TARGETS = {
    "Cadastro de Clientes": { id: "cad-clientes", label: "Cadastro de Clientes", piece: 12 },
    "Cadastro de Veículos": { id: "cad-veiculos", label: "Cadastro de Veículos", piece: 13 },
    "Consulta de Clientes": { id: "consulta-clientes", label: "Consulta de Clientes", piece: 11 },
    "Consulta de Veículos": { id: "consulta-veiculos", label: "Consulta de Veículos", piece: 11 },
    "Relação de Clientes Cadastrados no Sistema": {
      id: "relacao-clientes",
      label: "Relação de Clientes",
      piece: 15,
    },
    "Relação de Veículos Cadastrados no Sistema": {
      id: "relacao-veiculos",
      label: "Relação de Veículos",
      piece: 16,
    },
    "Relação de Status de Veículos": { id: "status-veiculos", label: "Status Veículos", piece: 17 },
    "Emissão de Protocolos": { id: "emissao-protocolos", label: "Emissão de Protocolos", piece: 36 },
    "Relação de Protocolos Emitidos": {
      id: "relacao-protocolos",
      label: "Relação Protocolos Emitidos",
      piece: 46,
    },
    "Relatório de Pendências no Cadastro dos Clientes": {
      id: "pendencias-clientes",
      label: "Pendências Cad. Clientes",
      piece: 60,
    },
    "Relatório de Clientes por EAR": { id: "relatorio-ear", label: "Relatório CNH/EAR", piece: 61 },
    "Formulário de Prestação de Contas (Fundo Fixo)": {
      id: "fundo-fixo",
      label: "Fundo Fixo",
      piece: 20,
    },
    "Recibo e Lista de Valores PASSIVOS para Cobrança Ostensiva": {
      id: "passivo-cobranca",
      label: "Passivo para Cobrança",
      piece: 21,
    },
    "Panfleto Padrão": { id: "panfleto-padrao", label: "Panfleto Padrão", piece: 22 },
    "Relação de Motos Vendidas": { id: "motos-vendidas", label: "Motos Vendidas", piece: 26 },
    "Tabela Oficial": { id: "tabela-dk-locadora", label: "Tabela DK Locadora", piece: 27 },
  };

  const ADMIN_SIDE_BUTTONS = Object.keys(ADMIN_SIDE_TARGETS);

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

    const sideHtml = ADMIN_SIDE_BUTTONS.map((label) => {
      const t = ADMIN_SIDE_TARGETS[label];
      return `<button type="button" class="miel-admin-side-btn" data-miel-admin-action="${esc(label)}" data-miel-admin-target="${esc(t.id)}" title="Ir para ${esc(t.label)}">${esc(label)}</button>`;
    }).join("");

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
          ? `Pesquisa: «${input.value.trim()}»`
          : "";
      }
    });

    container.querySelectorAll("[data-miel-admin-target]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const label = btn.getAttribute("data-miel-admin-action") || "";
        const target = ADMIN_SIDE_TARGETS[label];
        if (!target || typeof window.__DK_mielOpenDestino !== "function") return;
        window.__DK_mielOpenDestino(target.id, target.label, target.piece);
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
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
