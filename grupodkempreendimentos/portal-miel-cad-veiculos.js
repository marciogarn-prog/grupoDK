/**
 * Sistema MIEL — Cadastro de Veículos (aba Cad_Veículos). Motor célula-a-célula.
 */
(function portalMielCadVeiculos() {
  const PANEL_ID = "mielPanelCadVeiculos";
  const LAYOUT_KEY = "__DK_MIEL_LAYOUT_CAD_VEICULOS_LAYOUT";

  const FIELD_BY_COL = {
    B: "codigo",
    C: "dataCadastro",
    D: "status",
    E: "statusObs",
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

  function countMarcaDisp(marca) {
    return rows.filter(
      (r) =>
        String(r.marca || "").toUpperCase() === marca &&
        /DISPON/i.test(String(r.status || ""))
    ).length;
  }

  function sumMarcaCat(marca, cat) {
    return rows
      .filter(
        (r) =>
          String(r.marca || "").toUpperCase() === marca &&
          String(r.categoria || "").toUpperCase() === cat
      )
      .reduce((s, r) => s + (Number(r.valorAquisicao) || 0), 0);
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
    const mk = (re) => ({ m: countCatStatus("MOTO", re), c: countCatStatus("CARRO", re) });
    return {
      motos,
      carros,
      invest,
      investMoto,
      investCarro,
      locados: mk(/LOCADO/),
      disp: mk(/DISPON/),
      manut: mk(/MANUT/),
      vend: mk(/VEND/),
      indis: mk(/INDISP/),
      admin: mk(/ADMIN/),
      reserva: mk(/RESERV/),
      sini: mk(/SINISTR(?!.*PT)/),
      siniPt: mk(/SINISTR.*PT|PT\)/),
      roub: mk(/ROUB/),
    };
  }

  function pair(o) {
    return `${o.m}  MOTO(S)  e  ${o.c}  CARRO(S)`;
  }

  function patchHeaderCell(cell) {
    const st = stats();
    const ref = cell.ref || "";
    const patches = {
      B1: { text: "# Cadastro de Veículos" },
      I4: { text: fmtMoney(st.invest) },
      H4: { text: fmtMoney(st.invest) },
      G7: { text: fmtMoney(st.investMoto) },
      K7: { text: fmtMoney(st.investCarro) },
      L4: {
        text: `Quantitativo Sintético  |  Veículos Cadastrados >> ${st.motos} MOTOS  e  ${st.carros} CARROS`,
      },
      N6: { text: pair(st.admin) },
      N7: { text: pair(st.reserva) },
      N8: { text: pair(st.locados) },
      N9: { text: pair(st.disp) },
      N10: { text: pair(st.manut) },
      N11: { text: pair(st.sini) },
      N12: { text: pair(st.siniPt) },
      N13: { text: pair(st.vend) },
      N14: { text: pair(st.indis) },
      N15: { text: pair(st.roub) },
      A7: { text: `${countMarcaDisp("HONDA")}   Veículo(s) HONDA` },
      C7: { text: `${countMarcaDisp("HONDA")}   Veículo(s) HONDA` },
      A8: { text: `${countMarcaDisp("YAMAHA")}   Veículo(s) YAMAHA` },
      A9: { text: `${countMarcaDisp("SHINERAY")}   Veículo(s) SHINERAY` },
      A10: { text: `${countMarcaDisp("FORD")}   Veículo(s) FORD` },
      A11: { text: `${countMarcaDisp("CHEVROLET")}   Veículo(s) CHEVROLET` },
      A12: { text: `${countMarcaDisp("RENAULT")}   Veículo(s) RENAULT` },
      A13: { text: `${countMarcaDisp("TOYOTA")}   Veículo(s) TOYOTA` },
      A14: { text: `${countMarcaDisp("VOLKSWAGEN")}   Veículo(s) VOLKSWAGEM` },
      G9: { text: fmtMoney(sumMarcaCat("HONDA", "MOTO")) },
      G10: { text: fmtMoney(sumMarcaCat("YAMAHA", "MOTO")) },
      G11: { text: fmtMoney(sumMarcaCat("SHINERAY", "MOTO")) },
      K9: { text: fmtMoney(sumMarcaCat("FORD", "CARRO")) },
      K10: { text: fmtMoney(sumMarcaCat("CHEVROLET", "CARRO") + sumMarcaCat("GM", "CARRO")) },
      K11: { text: fmtMoney(sumMarcaCat("RENAULT", "CARRO")) },
      K12: { text: fmtMoney(sumMarcaCat("TOYOTA", "CARRO")) },
      K13: { text: fmtMoney(sumMarcaCat("VOLKSWAGEN", "CARRO") + sumMarcaCat("VOLKSWAGEM", "CARRO")) },
    };
    if (ref === "A1") return { text: "" };
    return patches[ref] || null;
  }

  function rowToCells(record) {
    const out = { A: "" };
    Object.entries(FIELD_BY_COL).forEach(([col, key]) => {
      let val = record[key] ?? "";
      if (key === "dataCadastro") val = fmtDate(val) || val;
      if (key === "valorAquisicao") val = fmtMoney(val);
      if (key === "codigo") val = record.codigo || record.cod || val;
      out[col] = val;
    });
    return out;
  }

  function statusStyle(val) {
    const u = String(val || "").toUpperCase();
    if (/LOCADO/.test(u)) return { color: "#0070C0", bold: true, fill: "#DDEBF7" };
    if (/DISPON/.test(u)) return { color: "#595959", bold: false, fill: "#F2F2F2" };
    if (/INDISP|SINISTR|ROUB|VEND/.test(u)) return { color: "#C00000", bold: true, fill: "#FCE4D6" };
    if (/ADMIN|RESERV|MANUT/.test(u)) return { color: "#C00000", bold: true };
    return null;
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
          if (col === "B" || col === "H") return { fill: "#FFFF00", color: "#C00000", bold: true };
          if (col === "D") return statusStyle(val);
          if (col === "G" || col === "I" || col === "K" || col === "L") {
            return { color: "#C00000", bold: true };
          }
          return null;
        },
      })}</div>
    </div>`;
  }

  function bindPanel() {
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
