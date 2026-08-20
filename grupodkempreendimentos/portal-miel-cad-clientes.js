/**
 * Sistema MIEL — Etapa 03: Cadastro de Clientes (aba Cad_Clientes).
 * Réplica visual da planilha: painel estatístico + tabela de dados (não formulário web).
 */
(function portalMielCadClientes() {
  const PANEL_ID = "mielPanelCadClientes";
  const STORAGE_KEY = "dk_miel_clientes_v1";

  const SIDE_TARGETS = {
    "# Consulta de Clientes": { id: "consulta-clientes", label: "Consulta de Clientes", piece: 11 },
    "# Cadastro de Veículos": { id: "cad-veiculos", label: "Cadastro de Veículos", piece: 13 },
  };

  /** Cabeçalhos linha 11 — aba Cad_Clientes (colunas A..R, sem B). */
  const TABLE_COLS = [
    { key: "cod", label: "Cód.", cls: "miel-cc__cell--cod" },
    { key: "analise", label: "Análise" },
    { key: "statusProtocolo", label: "Status do Protocolo" },
    { key: "dataCadastro", label: "Data do Cadastro" },
    { key: "cnpjCpf", label: "CNPJ/CPF" },
    { key: "cliente", label: "Cliente", cls: "miel-cc__cell--nome" },
    { key: "celular", label: "Nº do Celular" },
    { key: "recados01", label: "Recados 01" },
    { key: "recados02", label: "Recados 02" },
    { key: "cnh", label: "Nº da CNH-e" },
    { key: "categoria", label: "Categoria" },
    { key: "vencimento", label: "Vencimento" },
    { key: "validacao", label: "Validação" },
    { key: "ear", label: "EAR", cls: "miel-cc__cell--ear" },
    { key: "cep", label: "Cep" },
    { key: "municipioUf", label: "Município/UF" },
    { key: "endereco", label: "Endereço", cls: "miel-cc__cell--end" },
  ];

  /** Amostra inicial (linhas 12–14 da planilha) quando store vazio. */
  const SEED_ROWS = [
    {
      id: "mc_seed_1",
      cod: "0191",
      analise: "APROVADO",
      statusProtocolo: "ATIVO (LOCAÇÃO - MT)",
      dataCadastro: "2025-04-15",
      cnpjCpf: "062.426.495-51",
      cliente: "FELIPE YAGO GOMES RIBEIRO",
      celular: "74988071669",
      recados01: "74988114082",
      recados02: "74988540253",
      cnh: "7263609641",
      categoria: "A",
      vencimento: "2024-04-15",
      validacao: "VÁLIDA",
      ear: "NÃO",
      cep: "56.317-386",
      municipioUf: "PETROLINA/PE",
      endereco: "RUA SABIÁ LARANJEIRA, 420 - PEDRA LINDA",
      alert: false,
    },
    {
      id: "mc_seed_2",
      cod: "0192",
      analise: "APROVADO",
      statusProtocolo: "INATIVO",
      dataCadastro: "2025-04-15",
      cnpjCpf: "083.606.204-31",
      cliente: "MAGNO LOPES FERREIRA",
      celular: "87991212060",
      recados01: "87988289740",
      recados02: "87999686462",
      cnh: "4776990950",
      categoria: "AB",
      vencimento: "2023-11-20",
      validacao: "VÁLIDA",
      ear: "NÃO",
      cep: "56.300-000",
      municipioUf: "PETROLINA/PE",
      endereco: "RUA SETE, 191 - ANTÔNIO CASSIMIRO",
      alert: true,
    },
    {
      id: "mc_seed_3",
      cod: "0193",
      analise: "APROVADO",
      statusProtocolo: "INATIVO",
      dataCadastro: "2025-04-23",
      cnpjCpf: "001.750.155-54",
      cliente: "ALOISIO DE SENA SILVA JUNIOR",
      celular: "87991143391",
      recados01: "87991581244",
      recados02: "75983128822",
      cnh: "3711100333",
      categoria: "AB",
      vencimento: "2023-01-10",
      validacao: "VÁLIDA",
      ear: "SIM",
      cep: "56.300-000",
      municipioUf: "PETROLINA/PE",
      endereco: "RUA NOVE, 590 - JARDIM SÃO PAULO",
      alert: true,
    },
  ];

  let rows = [];

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
    if (p.length !== 3) return iso;
    const d = new Date(+p[0], +p[1] - 1, +p[2]);
    const dias = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];
    return `${dias[d.getDay()]}, ${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
  }

  function loadStore() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      rows = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(rows)) rows = [];
      if (!rows.length) {
        rows = SEED_ROWS.map((r) => ({ ...r }));
        saveStore();
      }
    } catch {
      rows = SEED_ROWS.map((r) => ({ ...r }));
    }
  }

  function saveStore() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
    } catch {
      /* ignore */
    }
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

  function renderStats(st) {
    return `<div class="miel-cc__stats" aria-label="Resumo cadastro clientes">
      <div class="miel-cc__stats-left">
        <div class="miel-cc__stats-row"><span class="miel-cc__stats-label">Protocolos Emitidos</span></div>
        <div class="miel-cc__stats-row"><span class="miel-cc__stats-label miel-cc__stats-label--green">Ctrl de Uso Provisório</span></div>
        <div class="miel-cc__stats-block">
          <div class="miel-cc__stats-subtitle">Distribuição de Clientes</div>
          <div class="miel-cc__stats-line">Petrolina/PE</div>
          <div class="miel-cc__stats-line">Juazeiro/BA</div>
          <div class="miel-cc__stats-line">Outras/UF's</div>
          <div class="miel-cc__stats-line">Não Definidas</div>
        </div>
      </div>
      <div class="miel-cc__stats-mid">
        <div class="miel-cc__stats-counts">
          <div></div><div></div><div>${st.byCity.petrolina}</div><div>${st.byCity.juazeiro}</div>
          <div>${st.byCity.outras}</div><div>${st.byCity.indef}</div>
        </div>
      </div>
      <div class="miel-cc__stats-right">
        <div class="miel-cc__stats-kpi">Quantidade de Clientes Cadastrados &gt;&gt; <strong>${st.total}</strong></div>
        <div class="miel-cc__stats-kpi">Clientes Ativos (Compra) &gt;&gt; <strong>${st.ativosCompra}</strong></div>
        <div class="miel-cc__stats-kpi">Clientes Ativos (Locação - MT) &gt;&gt; <strong>${st.ativosMt}</strong></div>
        <div class="miel-cc__stats-kpi">Clientes Ativos (Locação - CR) &gt;&gt; <strong>${st.ativosCr}</strong></div>
        <div class="miel-cc__stats-kpi">Clientes com CNH em "Alerta" &gt;&gt; <strong>${st.cnhAlerta}</strong></div>
        <div class="miel-cc__stats-kpi">Clientes Inativos &gt;&gt; <strong>${st.inativos}</strong></div>
      </div>
    </div>`;
  }

  function renderTableBody() {
    return rows
      .map((r, idx) => {
        const alt = idx % 2 === 1 ? " miel-cc__row--alt" : "";
        const alert = r.alert ? " miel-cc__row--alert" : "";
        const cells = TABLE_COLS.map((col) => {
          let val = r[col.key] ?? "";
          if (col.key === "dataCadastro" || col.key === "vencimento") val = fmtDate(val) || val;
          let extra = col.cls ? ` ${col.cls}` : "";
          if (col.key === "ear") {
            const u = String(val).toUpperCase();
            if (u === "NÃO" || u === "NAO") extra += " miel-cc__cell--ear-nao";
            if (u === "SIM") extra += " miel-cc__cell--ear-sim";
          }
          return `<td class="miel-cc__cell${extra}">${esc(val)}</td>`;
        }).join("");
        return `<tr class="miel-cc__row${alt}${alert}" data-miel-cc-row="${esc(r.id)}">${cells}</tr>`;
      })
      .join("");
  }

  function renderPanel(container) {
    const st = stats();
    const headCells = TABLE_COLS.map((c) => `<th scope="col">${esc(c.label)}</th>`).join("");
    const sideHtml = Object.entries(SIDE_TARGETS)
      .map(
        ([label, t]) =>
          `<button type="button" class="miel-admin-side-btn" data-miel-cad-side="${esc(t.id)}" data-miel-cad-side-label="${esc(t.label)}" data-miel-cad-side-piece="${t.piece}">${esc(label)}</button>`
      )
      .join("");

    container.innerHTML = `<div class="miel-cc__layout">
      <div class="miel-cc__main">
        <h2 class="miel-cc__title"># Cadastro de Clientes</h2>
        ${renderStats(st)}
        <div class="miel-cc__table-wrap">
          <table class="miel-cc__table" aria-label="Tabela cadastro de clientes">
            <thead><tr class="miel-cc__head">${headCells}</tr></thead>
            <tbody id="mielCadClientesBody">${renderTableBody()}</tbody>
          </table>
        </div>
      </div>
      <aside class="miel-cc__side" aria-label="Atalhos cadastro cliente">
        <button type="button" class="miel-nav-btn miel-stub-back" data-miel-cad-back="administrativo">← Voltar ao Administrativo</button>
        ${sideHtml}
      </aside>
    </div>`;
  }

  function refreshTable(container) {
    const statsEl = container.querySelector(".miel-cc__stats");
    const body = container.querySelector("#mielCadClientesBody");
    if (statsEl) statsEl.outerHTML = renderStats(stats());
    if (body) body.innerHTML = renderTableBody();
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
    loadStore();
    if (container.dataset.mielCadClientesReady !== "1") {
      renderPanel(container);
      bindPanel(container);
      container.dataset.mielCadClientesReady = "1";
    } else {
      refreshTable(container);
    }
  }

  window.__DK_mielInitCadClientes = init;
  window.__DK_mielCadClientesHeaders = TABLE_COLS.map((c) => c.label);
  window.__DK_mielCadClientesTitle = "# Cadastro de Clientes";
})();
