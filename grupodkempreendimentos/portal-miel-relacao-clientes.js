/**
 * Sistema MIEL — Etapa 05: Relação de Clientes (aba Relação_Clientes).
 */
(function portalMielRelacaoClientes() {
  const PANEL_ID = "mielPanelRelacaoClientes";
  const TABLE_COLS = [
    { key: "cod", label: "Cód. do Cliente", cls: "miel-cc__cell--cod" },
    { key: "statusProtocolo", label: "Status" },
    { key: "cliente", label: "Cliente", cls: "miel-cc__cell--nome" },
    { key: "cnpjCpf", label: "CNPJ/CPF" },
    { key: "celular", label: "Nº do Celular" },
    { key: "recados01", label: "Nº para Recados" },
    { key: "cep", label: "Cep" },
    { key: "endereco", label: "Endereço", cls: "miel-cc__cell--end" },
    { key: "primeiroContrato", label: "Primeiro Contrato" },
    { key: "valorCaucao", label: "Valor do Caução" },
    { key: "valorPago", label: "Valor Pago" },
  ];

  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function cadastros() {
    return window.__DK_MIEL_CADASTROS || { clientes: [], locacoes: [] };
  }

  function rows() {
    const locs = cadastros().locacoes || [];
    const byCliente = new Map();
    locs.forEach((l) => {
      if (!l.clienteId) return;
      const cur = byCliente.get(l.clienteId) || [];
      cur.push(l);
      byCliente.set(l.clienteId, cur);
    });
    return (cadastros().clientes || []).map((c) => {
      const hist = (byCliente.get(c.id) || []).slice().sort((a, b) => String(a.dataInicio).localeCompare(String(b.dataInicio)));
      const first = hist[0];
      return {
        ...c,
        primeiroContrato: first ? `${first.protocolo} · ${first.placa || ""}`.trim() : "",
        valorCaucao: "",
        valorPago: "",
      };
    });
  }

  function renderPanel(container) {
    const data = rows();
    const head = TABLE_COLS.map((c) => `<th scope="col">${esc(c.label)}</th>`).join("");
    const body = data
      .map((r, idx) => {
        const alt = idx % 2 === 1 ? " miel-cc__row--alt" : "";
        const alert = String(r.statusProtocolo || "").toUpperCase().includes("INATIVO") ? " miel-cc__row--alert" : "";
        const cells = TABLE_COLS.map((col) => {
          const extra = col.cls ? ` ${col.cls}` : "";
          return `<td class="miel-cc__cell${extra}">${esc(r[col.key] ?? "")}</td>`;
        }).join("");
        return `<tr class="miel-cc__row${alt}${alert}">${cells}</tr>`;
      })
      .join("");
    container.innerHTML = `<div class="miel-cc__layout">
      <div class="miel-cc__main">
        <h2 class="miel-cc__title" id="mielRelacaoClientesTitle"># Relação de Clientes Cadastrados no Sistema</h2>
        <div class="miel-cc__table-wrap">
          <table class="miel-cc__table" aria-label="Relação de clientes">
            <thead><tr class="miel-cc__head">${head}</tr></thead>
            <tbody>${body}</tbody>
          </table>
        </div>
      </div>
      <aside class="miel-cc__side">
        <button type="button" class="miel-nav-btn miel-stub-back" data-miel-rel-cli-back="administrativo">← Voltar ao Administrativo</button>
        <button type="button" class="miel-admin-side-btn" data-miel-rel-cli-side="cad-clientes" data-miel-rel-cli-side-label="Cadastro de Clientes" data-miel-rel-cli-side-piece="12"># Cadastro de Clientes</button>
        <button type="button" class="miel-admin-side-btn" data-miel-rel-cli-side="consulta-clientes" data-miel-rel-cli-side-label="Consulta de Clientes" data-miel-rel-cli-side-piece="11"># Consulta de Clientes</button>
      </aside>
    </div>`;
    container.querySelector("[data-miel-rel-cli-back]")?.addEventListener("click", () => {
      if (typeof window.__DK_mielShowSheet === "function") window.__DK_mielShowSheet("administrativo");
    });
    container.querySelectorAll("[data-miel-rel-cli-side]").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (typeof window.__DK_mielOpenDestino === "function") {
          window.__DK_mielOpenDestino(
            btn.getAttribute("data-miel-rel-cli-side") || "",
            btn.getAttribute("data-miel-rel-cli-side-label") || "",
            btn.getAttribute("data-miel-rel-cli-side-piece") || "?"
          );
        }
      });
    });
  }

  function init() {
    const container = document.getElementById(PANEL_ID);
    if (!container) return;
    renderPanel(container);
    container.dataset.mielRelClientesReady = "1";
  }

  window.__DK_mielInitRelacaoClientes = init;
  window.__DK_mielRelacaoClientesHeaders = TABLE_COLS.map((c) => c.label);
})();
