/**
 * Sistema MIEL — Cadastro de Veículos (aba Cad_Veículos). Motor célula-a-célula.
 */
(function portalMielCadVeiculos() {
  const PANEL_ID = "mielPanelCadVeiculos";
  const LAYOUT_KEY = "__DK_MIEL_LAYOUT_CAD_VEICULOS_LAYOUT";

  const FIELD_BY_COL = {
    A: "codigo",
    B: "codigo",
    C: "dataCadastro",
    D: "status",
    E: "observacao",
    F: "observacao",
    G: "placa",
    H: "categoria",
    I: "marca",
    J: "modelo",
    K: "cor",
    L: "chassi",
    M: "renavam",
    N: "anoModelo",
    O: "numMotor",
    P: "emplacada",
    Q: "rastreador",
    R: "assegurada",
    S: "proprietario",
    T: "cnpjCpf",
    U: "municipioUf",
    V: "valorAquisicao",
  };

  const SIDE_TARGETS = {
    "# Consulta de Veículos": { id: "consulta-veiculos", label: "Consulta de Veículos", piece: 11 },
    "# Cadastro de Clientes": { id: "cad-clientes", label: "Cadastro de Clientes", piece: 12 },
  };

  let rows = [];

  function layout() {
    return window[LAYOUT_KEY] || null;
  }
  function engine() {
    return window.__DK_mielSheetEngine || null;
  }
  function planilha() {
    return window.__DK_MIEL_CADASTROS || { veiculos: [], vinculos: [] };
  }

  function fmtDate(iso) {
    if (!iso) return "";
    const p = String(iso).slice(0, 10).split("-");
    if (p.length !== 3 || p[0].length !== 4) return iso;
    const d = new Date(+p[0], +p[1] - 1, +p[2]);
    if (Number.isNaN(d.getTime())) return iso;
    const dias = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];
    return `${dias[d.getDay()]}, ${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
  }

  function fmtMoney(n) {
    const v = Number(n);
    if (!Number.isFinite(v)) return String(n || "");
    return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }

  function loadRows() {
    rows = (planilha().veiculos || []).map((v) => ({ ...v }));
  }

  function countCatStatus(cat, re) {
    return rows.filter((r) => String(r.categoria || "").toUpperCase() === cat && re.test(String(r.status || "").toUpperCase())).length;
  }

  function stats() {
    const motos = rows.filter((r) => String(r.categoria || "").toUpperCase() === "MOTO").length;
    const carros = rows.filter((r) => String(r.categoria || "").toUpperCase() === "CARRO").length;
    const invest = rows.reduce((s, r) => s + (Number(r.valorAquisicao) || 0), 0);
    const investMoto = rows
      .filter((r) => String(r.categoria || "").toUpperCase() === "MOTO")
      .reduce((s, r) => s + (Number(r.valorAquisicao) || 0), 0);
    const investCarro = rows
      .filter((r) => String(r.categoria || "").toUpperCase() === "CARRO")
      .reduce((s, r) => s + (Number(r.valorAquisicao) || 0), 0);
    const marcas = {};
    rows.forEach((r) => {
      const m = String(r.marca || "").trim().toUpperCase() || "—";
      marcas[m] = (marcas[m] || 0) + 1;
    });
    const mk = (re) => ({ m: countCatStatus("MOTO", re), c: countCatStatus("CARRO", re) });
    return {
      motos,
      carros,
      invest,
      investMoto,
      investCarro,
      marcas,
      locados: mk(/LOCADO/),
      disp: mk(/DISPON/),
      manut: mk(/MANUT/),
      vend: mk(/VEND/),
      indis: mk(/INDISP/),
      admin: mk(/ADMIN/),
      reserva: mk(/RESERV/),
      sini: mk(/SINISTR/),
    };
  }

  function pair(label, o) {
    return `${label} >> ${o.m}  MOTO(S)  e  ${o.c}  CARRO(S)`;
  }

  function patchHeaderCell(cell, rowNum) {
    const st = stats();
    const ref = cell.ref || "";
    const patches = {
      B1: { text: "# Cadastro de Veículos" },
      H4: { text: fmtMoney(st.invest) },
      G7: { text: fmtMoney(st.investMoto) },
      K7: { text: fmtMoney(st.investCarro) },
      L4: { text: `Quantitativo Sintético  |  Veículos Cadastrados >> ${st.motos} MOTOS  e  ${st.carros} CARROS` },
      N6: { text: pair("Veículos ADMINISTRATIVOS", st.admin) },
      N7: { text: pair("Veículos RESERVAS", st.reserva) },
      N8: { text: pair("Veículos LOCADOS", st.locados) },
    };
    if (ref === "A1" && cell.text?.includes("Cadastro")) return { text: "" };
    if (patches[ref]) return patches[ref];
    if (ref === "C7" && rowNum === 7) return { text: `${st.marcas.HONDA || 0}   Veículo(s) HONDA` };
    if (ref === "A8") return { text: `${st.marcas.YAMAHA || 0}   Veículo(s) YAMAHA` };
    if (ref === "A9") return { text: `${st.marcas.SHINERAY || 0}   Veículo(s) SHINERAY` };
    return null;
  }

  function rowToCells(record) {
    const out = {};
    Object.entries(FIELD_BY_COL).forEach(([col, key]) => {
      let val = record[key] ?? "";
      if (key === "dataCadastro") val = fmtDate(val) || val;
      if (key === "valorAquisicao") val = fmtMoney(val);
      if (key === "codigo") val = record.codigo || record.cod || val;
      out[col] = val;
    });
    return out;
  }

  function renderPanel(container) {
    const lay = layout();
    const eng = engine();
    if (!lay || !eng) {
      container.innerHTML = `<p class="miel-cc__err">Layout Cad_Veículos não carregou.</p>`;
      return;
    }
    container.innerHTML = `<div class="miel-cc__layout miel-cc__layout--sheet">
      <div class="miel-cc__main">${eng.renderSheet(lay, {
        patchHeaderCell(cell, rowNum) {
          const p = patchHeaderCell(cell, rowNum);
          return p || undefined;
        },
        dataRows() {
          return rows.map((r) => rowToCells(r));
        },
        cellStyleFn(col, val) {
          if (col === "D" && /LOCADO/i.test(String(val))) return { color: "#C00000", bold: true };
          return null;
        },
      })}</div>
    </div>`;
  }

  function bindPanel(container) {
    /* vínculos Excel: clique delegado em portal-miel-ui.js (data-miel-xl-link) */
  }

  function init() {
    const container = document.getElementById(PANEL_ID);
    if (!container) return;
    loadRows();
    renderPanel(container);
    bindPanel(container);
    container.dataset.mielCadVeiculosReady = "1";
  }

  window.__DK_mielInitCadVeiculos = init;
  window.__DK_mielCadVeiculosFields = Object.values(FIELD_BY_COL);
  window.__DK_mielCadVeiculosTitle = "# Cadastro de Veículos";
})();
