/**
 * Sistema MIEL — Relação de Clientes (aba Relação_Clientes). Motor célula-a-célula.
 */
(function portalMielRelacaoClientes() {
  const PANEL_ID = "mielPanelRelacaoClientes";
  const LAYOUT_KEY = "__DK_MIEL_LAYOUT_RELACAO_CLIENTES_LAYOUT";

  const FIELD_BY_COL = {
    A: "cod",
    B: "cod",
    C: "statusProtocolo",
    D: "cliente",
    E: "cnpjCpf",
    F: "celular",
    G: "recados01",
    H: "cep",
    I: "endereco",
    J: "primeiroContrato",
    K: "valorCaucao",
    L: "valorPago",
  };

  function layout() {
    return window[LAYOUT_KEY] || null;
  }
  function engine() {
    return window.__DK_mielSheetEngine || null;
  }
  function cadastros() {
    return window.__DK_MIEL_CADASTROS || { clientes: [], locacoes: [] };
  }

  function buildRows() {
    const locs = cadastros().locacoes || [];
    const byCliente = new Map();
    locs.forEach((l) => {
      if (!l.clienteId) return;
      const cur = byCliente.get(l.clienteId) || [];
      cur.push(l);
      byCliente.set(l.clienteId, cur);
    });
    return (cadastros().clientes || []).map((c) => {
      const hist = (byCliente.get(c.id) || []).slice().sort((a, b) => String(a.dataInicio || "").localeCompare(String(b.dataInicio || "")));
      const first = hist[0];
      return {
        ...c,
        cod: c.cod || c.codigo || "",
        primeiroContrato: first ? `${first.protocolo || ""} · ${first.placa || ""}`.trim() : "",
        valorCaucao: c.valorCaucao || "",
        valorPago: c.valorPago || "",
      };
    });
  }

  function rowToCells(record) {
    const out = {};
    Object.entries(FIELD_BY_COL).forEach(([col, key]) => {
      out[col] = record[key] ?? "";
    });
    return out;
  }

  function renderPanel(container) {
    const lay = layout();
    const eng = engine();
    if (!lay || !eng) {
      container.innerHTML = `<p class="miel-cc__err">Layout Relação_Clientes não carregou.</p>`;
      return;
    }
    const data = buildRows();
    container.innerHTML = `<div class="miel-cc__layout miel-cc__layout--sheet">
      <div class="miel-cc__main">${eng.renderSheet(lay, {
        patchHeaderCell(cell) {
          if (cell.ref === "B1" && !cell.text) return { text: "# Relação de Clientes Cadastrados no Sistema" };
          return null;
        },
        dataRows() {
          return data.map((r) => rowToCells(r));
        },
        cellStyleFn(col, val) {
          if (col === "C" && /INATIVO/i.test(String(val))) return { color: "#C00000" };
          return null;
        },
      })}</div>
    </div>`;
  }

  function bindPanel() {}

  function init() {
    const container = document.getElementById(PANEL_ID);
    if (!container) return;
    renderPanel(container);
    bindPanel(container);
    container.dataset.mielRelClientesReady = "1";
  }

  window.__DK_mielInitRelacaoClientes = init;
  window.__DK_mielRelacaoClientesHeaders = [
    "Cód. do Cliente",
    "Status",
    "Cliente",
    "CNPJ/CPF",
    "Nº do Celular",
    "Nº para Recados",
    "Cep",
    "Endereço",
    "Primeiro Contrato",
    "Valor do Caução",
    "Valor Pago",
  ];
})();
