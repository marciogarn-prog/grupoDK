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
          if (cell.ref === "A1" && cell.text?.includes("Relação")) return { text: "" };
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
      <aside class="miel-cc__side">
        <button type="button" class="miel-nav-btn miel-stub-back" data-miel-rel-back="administrativo">← Voltar ao Administrativo</button>
        <button type="button" class="miel-admin-side-btn" data-miel-rel-side="cad-clientes" data-miel-rel-side-label="Cadastro de Clientes" data-miel-rel-side-piece="12"># Cadastro de Clientes</button>
        <button type="button" class="miel-admin-side-btn" data-miel-rel-side="consulta-clientes" data-miel-rel-side-label="Consulta de Clientes" data-miel-rel-side-piece="11"># Consulta de Clientes</button>
      </aside>
    </div>`;
  }

  function bindPanel(container) {
    container.querySelector("[data-miel-rel-back]")?.addEventListener("click", () => {
      if (typeof window.__DK_mielShowSheet === "function") window.__DK_mielShowSheet("administrativo");
    });
    container.querySelectorAll("[data-miel-rel-side]").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (typeof window.__DK_mielOpenDestino === "function") {
          window.__DK_mielOpenDestino(
            btn.getAttribute("data-miel-rel-side") || "",
            btn.getAttribute("data-miel-rel-side-label") || "",
            btn.getAttribute("data-miel-rel-side-piece") || "?"
          );
        }
      });
    });
  }

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
