/**
 * Sistema MIEL — Etapa 04: Cadastro de Veículos (aba Cad_Veículos).
 * Réplica visual: painel estatístico + tabela linha 17 (não formulário web).
 */
(function portalMielCadVeiculos() {
  const PANEL_ID = "mielPanelCadVeiculos";

  const SIDE_TARGETS = {
    "# Consulta de Veículos": { id: "consulta-veiculos", label: "Consulta de Veículos", piece: 11 },
    "# Cadastro de Clientes": { id: "cad-clientes", label: "Cadastro de Clientes", piece: 12 },
  };

  const TABLE_COLS = [
    { key: "codigo", label: "Cód. do Veículo", cls: "miel-cc__cell--cod" },
    { key: "dataCadastro", label: "Data do Cadastro" },
    { key: "status", label: "Status" },
    { key: "observacao", label: "Observação" },
    { key: "placa", label: "Placa" },
    { key: "categoria", label: "Categoria" },
    { key: "marca", label: "Marca" },
    { key: "modelo", label: "Modelo" },
    { key: "cor", label: "Cor" },
    { key: "chassi", label: "Chassi" },
    { key: "renavam", label: "Renavam" },
    { key: "anoModelo", label: "Ano/Modelo" },
    { key: "numMotor", label: "Nº do Motor" },
    { key: "emplacada", label: "Emplacada?" },
    { key: "rastreador", label: "Rastreador?" },
    { key: "assegurada", label: "Assegurada?" },
    { key: "proprietario", label: "Proprietário" },
    { key: "cnpjCpf", label: "CNPJ/CPF" },
    { key: "municipioUf", label: "Município/UF" },
    { key: "valorAquisicao", label: "Valor de Aquisição" },
  ];

  let rows = [];

  function planilha() {
    return window.__DK_MIEL_CADASTROS || { veiculos: [], locacoes: [], vinculos: [] };
  }

  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
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
    const src = planilha().veiculos || [];
    const locByVeic = new Map();
    (planilha().vinculos || []).forEach((l) => {
      if (l.tipo !== "locacao-cliente-veiculo") return;
      const cur = locByVeic.get(l.veiculoId) || [];
      cur.push(l);
      locByVeic.set(l.veiculoId, cur);
    });
    rows = src.map((v) => {
      const links = locByVeic.get(v.id) || [];
      const ativo = links.find((x) => String(x.status || "").toUpperCase().includes("ATIVO"));
      const last = ativo || links[links.length - 1];
      return { ...v, clienteLocatario: last?.clienteNome || "", protocolo: last?.protocolo || "" };
    });
  }

  function countStatus(re) {
    return rows.filter((r) => re.test(String(r.status || "").toUpperCase())).length;
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
    return {
      total: rows.length,
      motos,
      carros,
      invest,
      investMoto,
      investCarro,
      marcas,
      locados: { m: countCatStatus("MOTO", /LOCADO/), c: countCatStatus("CARRO", /LOCADO/) },
      disp: { m: countCatStatus("MOTO", /DISPON/), c: countCatStatus("CARRO", /DISPON/) },
      manut: { m: countCatStatus("MOTO", /MANUT/), c: countCatStatus("CARRO", /MANUT/) },
      vend: { m: countCatStatus("MOTO", /VEND/), c: countCatStatus("CARRO", /VEND/) },
      indis: { m: countCatStatus("MOTO", /INDISP/), c: countCatStatus("CARRO", /INDISP/) },
      admin: { m: countCatStatus("MOTO", /ADMIN/), c: countCatStatus("CARRO", /ADMIN/) },
      reserva: { m: countCatStatus("MOTO", /RESERV/), c: countCatStatus("CARRO", /RESERV/) },
      sini: { m: countCatStatus("MOTO", /SINISTR/), c: countCatStatus("CARRO", /SINISTR/) },
    };
  }

  function pair(label, o) {
    return `${label} &gt;&gt; ${o.m}  MOTO(S)  e  ${o.c}  CARRO(S)`;
  }

  function renderStats(st) {
    const marcaLines = Object.entries(st.marcas)
      .sort((a, b) => b[1] - a[1])
      .map(([m, n]) => `<div>${n}   Veículo(s) ${esc(m)}</div>`)
      .join("");
    return `<div class="miel-cc__stats miel-cv__stats" aria-label="Resumo cadastro veículos">
      <div>
        <div class="miel-cc__stats-label">Protocolos Emitidos</div>
        <div class="miel-cc__stats-label miel-cc__stats-label--green">Ctrl de Uso Provisório</div>
        <div class="miel-cc__stats-subtitle">Veículos Disponíveis</div>
        ${marcaLines}
      </div>
      <div>
        <div class="miel-cc__stats-kpi">Total Investido &gt;&gt; <strong>${fmtMoney(st.invest)}</strong></div>
        <div class="miel-cc__stats-kpi">Total Investido (Motos) &gt;&gt; <strong>${fmtMoney(st.investMoto)}</strong></div>
        <div class="miel-cc__stats-kpi">Total Investido (Carros) &gt;&gt; <strong>${fmtMoney(st.investCarro)}</strong></div>
        <div class="miel-cc__stats-kpi">${pair("Veículos ADMINISTRATIVOS", st.admin)}</div>
        <div class="miel-cc__stats-kpi">${pair("Veículos RESERVAS", st.reserva)}</div>
        <div class="miel-cc__stats-kpi">${pair("Veículos LOCADOS", st.locados)}</div>
      </div>
      <div>
        <div class="miel-cc__stats-kpi">Quantitativo Sintético | Veículos Cadastrados &gt;&gt; <strong>${st.motos} MOTOS</strong> e <strong>${st.carros} CARROS</strong></div>
        <div class="miel-cc__stats-kpi">${pair("Veículos DISPONÍVEIS", st.disp)}</div>
        <div class="miel-cc__stats-kpi">${pair("Veículos EM MANUTENÇÃO", st.manut)}</div>
        <div class="miel-cc__stats-kpi">${pair("Veículos SINISTRADOS", st.sini)}</div>
        <div class="miel-cc__stats-kpi">${pair("Veículos VENDIDOS", st.vend)}</div>
        <div class="miel-cc__stats-kpi">${pair("Veículos INDISPONÍVEIS", st.indis)}</div>
      </div>
    </div>`;
  }

  function renderTableBody() {
    return rows
      .map((r, idx) => {
        const alt = idx % 2 === 1 ? " miel-cc__row--alt" : "";
        const st = String(r.status || "").toUpperCase();
        const alert = st.includes("LOCADO") ? " miel-cc__row--alert" : "";
        const cells = TABLE_COLS.map((col) => {
          let val = r[col.key] ?? "";
          if (col.key === "dataCadastro") val = fmtDate(val) || val;
          if (col.key === "valorAquisicao") val = fmtMoney(val);
          const extra = col.cls ? ` ${col.cls}` : "";
          return `<td class="miel-cc__cell${extra}">${esc(val)}</td>`;
        }).join("");
        return `<tr class="miel-cc__row${alt}${alert}" data-miel-cv-row="${esc(r.id)}" title="${esc(r.clienteLocatario || "")}">${cells}</tr>`;
      })
      .join("");
  }

  function renderPanel(container) {
    const st = stats();
    const headCells = TABLE_COLS.map((c) => `<th scope="col">${esc(c.label)}</th>`).join("");
    const sideHtml = Object.entries(SIDE_TARGETS)
      .map(
        ([label, t]) =>
          `<button type="button" class="miel-admin-side-btn" data-miel-cad-veic-side="${esc(t.id)}" data-miel-cad-veic-side-label="${esc(t.label)}" data-miel-cad-veic-side-piece="${t.piece}">${esc(label)}</button>`
      )
      .join("");

    container.innerHTML = `<div class="miel-cc__layout">
      <div class="miel-cc__main">
        <h2 class="miel-cc__title miel-cv__title"># Cadastro de Veículos</h2>
        ${renderStats(st)}
        <div class="miel-cc__table-wrap">
          <table class="miel-cc__table" aria-label="Tabela cadastro de veículos">
            <thead><tr class="miel-cc__head">${headCells}</tr></thead>
            <tbody id="mielCadVeiculosBody">${renderTableBody()}</tbody>
          </table>
        </div>
      </div>
      <aside class="miel-cc__side" aria-label="Atalhos cadastro veículo">
        <button type="button" class="miel-nav-btn miel-stub-back" data-miel-cad-veic-back="administrativo">← Voltar ao Administrativo</button>
        ${sideHtml}
      </aside>
    </div>`;
  }

  function bindPanel(container) {
    container.querySelector('[data-miel-cad-veic-back="administrativo"]')?.addEventListener("click", () => {
      if (typeof window.__DK_mielShowSheet === "function") window.__DK_mielShowSheet("administrativo");
    });
    container.querySelectorAll("[data-miel-cad-veic-side]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-miel-cad-veic-side") || "";
        const label = btn.getAttribute("data-miel-cad-veic-side-label") || id;
        const piece = btn.getAttribute("data-miel-cad-veic-side-piece") || "?";
        if (typeof window.__DK_mielOpenDestino === "function") window.__DK_mielOpenDestino(id, label, piece);
      });
    });
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
  window.__DK_mielCadVeiculosFields = TABLE_COLS.map((c) => c.label);
  window.__DK_mielCadVeiculosTitle = "# Cadastro de Veículos";
})();
