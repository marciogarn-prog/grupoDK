/**
 * Sistema MIEL — Cadastro de Clientes (aba Cad_Clientes).
 * Célula-a-célula + comandos/links da planilha (hyperlinks e imagens).
 */
(function portalMielCadClientes() {
  const PANEL_ID = "mielPanelCadClientes";
  const LAYOUT_KEY = "__DK_MIEL_LAYOUT_CAD_CLIENTES_LAYOUT";

  const FIELD_BY_COL = {
    B: "cod",
    C: "analise",
    D: "statusProtocolo",
    E: "dataCadastro",
    F: "cnpjCpf",
    G: "cliente",
    H: "celular",
    I: "recados01",
    J: "recados02",
    K: "cnh",
    L: "categoria",
    M: "vencimento",
    N: "validacao",
    O: "ear",
    P: "cep",
    Q: "municipioUf",
    R: "endereco",
  };

  let rows = [];

  function layout() {
    return window[LAYOUT_KEY] || null;
  }

  function engine() {
    return window.__DK_mielSheetEngine || null;
  }

  function planilhaClientes() {
    return (window.__DK_MIEL_CADASTROS && window.__DK_MIEL_CADASTROS.clientes) || [];
  }

  function fmtDate(iso) {
    if (!iso) return "";
    const p = String(iso).slice(0, 10).split("-");
    if (p.length !== 3) return iso;
    const d = new Date(+p[0], +p[1] - 1, +p[2]);
    const dias = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];
    return `${dias[d.getDay()]}, ${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
  }

  function loadRows() {
    rows = planilhaClientes().map((r) => ({ ...r }));
  }

  function stats() {
    const total = rows.length;
    const byCity = { petrolina: 0, juazeiro: 0, outras: 0, indef: 0 };
    let ativosCompra = 0;
    let ativosMt = 0;
    let ativosCr = 0;
    let cnhAlerta = 0;
    let inativos = 0;
    rows.forEach((r) => {
      const m = (r.municipioUf || "").toUpperCase();
      if (m.includes("PETROLINA")) byCity.petrolina++;
      else if (m.includes("JUAZEIRO")) byCity.juazeiro++;
      else if (m) byCity.outras++;
      else byCity.indef++;
      const st = (r.statusProtocolo || "").toUpperCase();
      if (st.includes("COMPRA")) ativosCompra++;
      if (st.includes("LOCAÇÃO - MT") || st.includes("LOCACAO - MT")) ativosMt++;
      if (st.includes("LOCAÇÃO - CR") || st.includes("LOCACAO - CR")) ativosCr++;
      if (r.alert || (r.validacao || "").toUpperCase().includes("ALERTA")) cnhAlerta++;
      if (st.includes("INATIVO")) inativos++;
    });
    return { total, byCity, ativosCompra, ativosMt, ativosCr, cnhAlerta, inativos };
  }

  function patchHeaderCell(cell) {
    const st = stats();
    const ref = cell.ref || "";
    const patches = {
      O4: { text: String(st.total) },
      K5: { text: String(st.byCity.petrolina) },
      K6: { text: String(st.byCity.juazeiro) },
      K7: { text: String(st.byCity.outras) },
      K8: { text: String(st.byCity.indef) },
      O5: { text: String(st.ativosCompra) },
      O6: { text: String(st.ativosMt) },
      O7: { text: String(st.ativosCr) },
      O8: { text: String(st.cnhAlerta) },
      O9: { text: String(st.inativos) },
    };
    return patches[ref] || null;
  }

  function rowToCells(record) {
    const out = { A: "" };
    Object.entries(FIELD_BY_COL).forEach(([col, key]) => {
      let val = record[key] ?? "";
      if (key === "dataCadastro" || key === "vencimento") val = fmtDate(val) || val;
      if (key === "cod") val = record.cod || "";
      out[col] = val;
    });
    return out;
  }

  function renderPanel(container) {
    const lay = layout();
    const eng = engine();
    if (!lay || !eng) {
      container.innerHTML = `<p class="miel-cc__err">Layout Cad_Clientes não carregou. Recarregue a página (Ctrl+F5).</p>`;
      return;
    }

    const sheetHtml = eng.renderSheet(lay, {
      patchHeaderCell(cell) {
        return patchHeaderCell(cell) || undefined;
      },
      dataRows() {
        return rows.map((r) => rowToCells(r));
      },
      cellStyleFn(col, val) {
        if (col === "O") {
          const u = String(val).toUpperCase();
          if (u === "NÃO" || u === "NAO") return { color: "#C00000" };
          if (u === "SIM") return { color: "#0070C0" };
        }
        return null;
      },
    });

    container.innerHTML = `<div class="miel-cc__layout miel-cc__layout--sheet">
      <div class="miel-cc__main">${sheetHtml}</div>
    </div>`;
  }

  function bindPanel(container) {
    container.querySelectorAll("[data-miel-xl-link]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const loc = btn.getAttribute("data-miel-xl-link") || "";
        if (typeof window.__DK_mielOpenExcelLocation === "function") {
          window.__DK_mielOpenExcelLocation(loc);
        }
      });
    });
  }

  function init() {
    const container = document.getElementById(PANEL_ID);
    if (!container) return;
    loadRows();
    renderPanel(container);
    bindPanel(container);
    container.dataset.mielCadClientesReady = "1";
  }

  window.__DK_mielInitCadClientes = init;
  window.__DK_mielCadClientesHeaders = [
    "Cód.",
    "Análise",
    "Status do Protocolo",
    "Data do Cadastro",
    "CNPJ/CPF",
    "Cliente",
    "Nº do Celular",
    "Recados 01",
    "Recados 02",
    "Nº da CNH-e",
    "Categoria",
    "Vencimento",
    "Validação",
    "EAR",
    "Cep",
    "Município/UF",
    "Endereço",
  ];
})();
