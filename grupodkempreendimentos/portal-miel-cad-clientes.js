/**
 * Sistema MIEL — Cadastro de Clientes (aba Cad_Clientes).
 * Renderização célula-a-célula via portal-miel-sheet-engine.js + layout exportado da planilha.
 */
(function portalMielCadClientes() {
  const PANEL_ID = "mielPanelCadClientes";
  const LAYOUT_KEY = "__DK_MIEL_LAYOUT_CAD_CLIENTES_LAYOUT";

  const FIELD_BY_COL = {
    A: "cod",
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

  const SIDE_TARGETS = {
    "# Consulta de Clientes": { id: "consulta-clientes", label: "Consulta de Clientes", piece: 11 },
    "# Cadastro de Veículos": { id: "cad-veiculos", label: "Cadastro de Veículos", piece: 13 },
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

  function patchHeaderCell(cell, rowNum) {
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
    if (ref === "B1" && !cell.text) return { text: "# Cadastro de Clientes" };
    if (ref === "A1" && cell.text?.includes("Cadastro")) return { text: "" };
    if (patches[ref]) return patches[ref];
    if (ref === "J4" && !cell.text) return { text: "Quantidade de Clientes Cadastrados  >>" };
    if (ref === "B4" && !cell.text) return { text: "Distribuição de Clientes" };
    return null;
  }

  function rowToCells(record) {
    const out = {};
    Object.entries(FIELD_BY_COL).forEach(([col, key]) => {
      let val = record[key] ?? "";
      if (key === "dataCadastro" || key === "vencimento") val = fmtDate(val) || val;
      if (key === "cod") val = record.cod || record.codigo || val;
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

    const sideHtml = Object.entries(SIDE_TARGETS)
      .map(
        ([label, t]) =>
          `<button type="button" class="miel-admin-side-btn" data-miel-cad-side="${t.id}" data-miel-cad-side-label="${label.replace(/^#\s*/, "")}" data-miel-cad-side-piece="${t.piece}">${label}</button>`
      )
      .join("");

    const sheetHtml = eng.renderSheet(lay, {
      patchHeaderCell(cell, rowNum) {
        const p = patchHeaderCell(cell, rowNum);
        return p || undefined;
      },
      dataRows() {
        return rows.map((r) => rowToCells(r));
      },
    });

    container.innerHTML = `<div class="miel-cc__layout miel-cc__layout--sheet">
      <div class="miel-cc__main">${sheetHtml}</div>
      <aside class="miel-cc__side" aria-label="Atalhos cadastro cliente">
        <button type="button" class="miel-nav-btn miel-stub-back" data-miel-cad-back="administrativo">← Voltar ao Administrativo</button>
        ${sideHtml}
      </aside>
    </div>`;
  }

  function bindPanel(container) {
    container.querySelector('[data-miel-cad-back="administrativo"]')?.addEventListener("click", () => {
      if (typeof window.__DK_mielShowSheet === "function") window.__DK_mielShowSheet("administrativo");
    });
    container.querySelectorAll("[data-miel-cad-side]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-miel-cad-side") || "";
        const label = btn.getAttribute("data-miel-cad-side-label") || id;
        const piece = btn.getAttribute("data-miel-cad-side-piece") || "?";
        if (typeof window.__DK_mielOpenDestino === "function") {
          window.__DK_mielOpenDestino(id, label, piece);
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
