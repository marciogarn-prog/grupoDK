/**
 * Sistema MIEL — Consulta Integrada (aba Consulta_Veíc_ou_Cliente).
 * Formulário interativo igual à planilha (veículo à esquerda, cliente à direita).
 */
(function portalMielConsultaIntegrada() {
  const PANEL_SEL = '[data-miel-panel="consulta-integrada"]';
  const NA = "NÃO SE APLICA";

  const DIAS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

  function planilha() {
    return window.__DK_MIEL_CADASTROS || { veiculos: [], clientes: [], locacoes: [] };
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
    if (p.length !== 3 || p[0].length !== 4) return String(iso);
    const d = new Date(+p[0], +p[1] - 1, +p[2]);
    if (Number.isNaN(d.getTime())) return String(iso);
    return `${DIAS[d.getDay()]} ${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
  }

  function fmtPhone(raw) {
    const d = String(raw || "").replace(/\D/g, "");
    if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
    if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
    return String(raw || "");
  }

  function normPlaca(s) {
    return String(s || "")
      .replace(/[^a-zA-Z0-9]/g, "")
      .toUpperCase();
  }

  function normCod(s) {
    return String(s || "")
      .replace(/\s+/g, " ")
      .trim()
      .toUpperCase();
  }

  function marcaModelo(v) {
    const m = String(v.marca || "").trim();
    const mod = String(v.modelo || "").trim();
    if (m && mod) return `${m} / ${mod}`;
    return m || mod || "";
  }

  function findVeiculo({ placa, codigo }) {
    const vs = planilha().veiculos || [];
    const p = normPlaca(placa);
    const c = normCod(codigo);
    if (p) {
      const byP = vs.find((v) => normPlaca(v.placa) === p);
      if (byP) return byP;
    }
    if (c) {
      const byC = vs.find((v) => normCod(v.codigo) === c || normCod(v.codigo).replace(/\s/g, "") === c.replace(/\s/g, ""));
      if (byC) return byC;
    }
    return null;
  }

  function findCliente(nomeOrId) {
    const cs = planilha().clientes || [];
    const q = String(nomeOrId || "").trim().toUpperCase();
    if (!q) return null;
    return (
      cs.find((c) => String(c.cliente || "").toUpperCase() === q) ||
      cs.find((c) => String(c.cod) === q) ||
      cs.find((c) => String(c.cliente || "").toUpperCase().includes(q)) ||
      null
    );
  }

  function locacaoAtivaVeiculo(v) {
    if (!v) return null;
    const locs = planilha().locacoes || [];
    const p = normPlaca(v.placa);
    const ativos = locs.filter((l) => normPlaca(l.placa) === p && !/FINALIZ/i.test(String(l.status || "")));
    return ativos[0] || locs.filter((l) => normPlaca(l.placa) === p).slice(-1)[0] || null;
  }

  function locacaoAtivaCliente(cl) {
    if (!cl) return null;
    const locs = planilha().locacoes || [];
    const nome = String(cl.cliente || "").toUpperCase();
    const id = cl.id;
    const match = locs.filter(
      (l) => l.clienteId === id || String(l.clienteNome || "").toUpperCase() === nome
    );
    const ativos = match.filter((l) => !/FINALIZ/i.test(String(l.status || "")));
    return ativos[0] || match.slice(-1)[0] || null;
  }

  function statusClass(st) {
    const u = String(st || "").toUpperCase();
    if (/INDISP|SINISTR|ROUB|VEND|ALERTA/.test(u)) return "miel-ci__val--danger";
    if (/LOCADO|ATIVO/.test(u)) return "miel-ci__val--warn";
    if (/DISPON/.test(u)) return "miel-ci__val--ok";
    return "";
  }

  function field(label, value, cls) {
    return `<div class="miel-ci__field">
      <span class="miel-ci__lbl">${esc(label)}</span>
      <span class="miel-ci__val ${cls || ""}">${esc(value || "—")}</span>
    </div>`;
  }

  function renderVeiculo(v) {
    if (!v) {
      return `<div class="miel-ci__empty">Digite a placa ou o código e pressione Buscar.</div>`;
    }
    const loc = locacaoAtivaVeiculo(v);
    const clienteLoc = loc
      ? findCliente(loc.clienteNome) || { cliente: loc.clienteNome, cnpjCpf: "", celular: "", municipioUf: "" }
      : null;
    const locado = Boolean(loc && !/FINALIZ/i.test(String(loc.status || "")));

    return `
      <section class="miel-ci__block">
        <h3 class="miel-ci__block-title">Dados do Veículo Selecionado</h3>
        <div class="miel-ci__row miel-ci__row--3">
          ${field("Cód. do Veículo", v.codigo, "miel-ci__val--blue")}
          ${field("Status", v.status, statusClass(v.status))}
          ${field("Aquisição", fmtDate(v.dataCadastro))}
        </div>
        <div class="miel-ci__row miel-ci__row--4">
          ${field("Placa", v.placa, "miel-ci__val--blue")}
          ${field("Modalidade", v.categoria, "miel-ci__val--yellow")}
          ${field("Cor", v.cor)}
          ${field("Ano/Modelo", v.anoModelo)}
        </div>
        <div class="miel-ci__row">
          ${field("Marca/Modelo", marcaModelo(v))}
        </div>
        <div class="miel-ci__row miel-ci__row--3">
          ${field("Chassi", v.chassi)}
          ${field("Renavam", v.renavam)}
          ${field("Nº do Motor", v.numMotor)}
        </div>
        <div class="miel-ci__row miel-ci__row--4">
          ${field("Observação", v.observacao || v.statusObs, "miel-ci__val--yellow")}
          ${field("Emplacada?", v.emplacada)}
          ${field("Rastreador?", v.rastreador)}
          ${field("Assegurada?", v.assegurada)}
        </div>
        <div class="miel-ci__row miel-ci__row--3">
          ${field("Proprietário do Veículo", v.proprietario)}
          ${field("CNPJ/CPF", v.cnpjCpf)}
          ${field("Município/UF", v.municipioUf)}
        </div>
      </section>
      <section class="miel-ci__block">
        <h3 class="miel-ci__block-title">Status da Locação</h3>
        <div class="miel-ci__row miel-ci__row--2">
          ${field("Cliente", locado ? clienteLoc?.cliente || loc.clienteNome : "VEÍCULO NÃO ESTÁ LOCADO", locado ? "" : "miel-ci__val--yellow")}
          ${field("Plano Contratado", loc?.marcaModelo || loc?.opcaoContrato || (v.categoria === "CARRO" ? "DK MEU TRANSPORTE (CARRO)" : "—"), "miel-ci__val--yellow")}
        </div>
        <div class="miel-ci__row miel-ci__row--3">
          ${field("CPF/CNPJ", locado ? clienteLoc?.cnpjCpf || "—" : NA)}
          ${field("Nº do Celular", locado ? fmtPhone(clienteLoc?.celular) || "—" : NA)}
          ${field("Município/UF", locado ? clienteLoc?.municipioUf || "—" : NA)}
        </div>
      </section>`;
  }

  function renderCliente(cl) {
    if (!cl) {
      return `<div class="miel-ci__empty">Digite ou selecione o nome do cliente.</div>`;
    }
    const loc = locacaoAtivaCliente(cl);
    const veic = loc ? findVeiculo({ placa: loc.placa }) : null;
    const modalidade = veic?.categoria || (/CR|MT|COMPRA/i.test(cl.statusProtocolo || "") ? "CARRO" : "—");
    const vencCnh = (() => {
      const iso = cl.vencimento;
      if (!iso) return "";
      const p = String(iso).slice(0, 10).split("-");
      if (p.length === 3 && p[0].length === 4) return `${p[2]}/${p[1]}/${p[0]}`;
      return String(iso);
    })();

    return `
      <section class="miel-ci__block">
        <h3 class="miel-ci__block-title">Dados do Cliente Selecionado</h3>
        <div class="miel-ci__row miel-ci__row--3">
          ${field("Status", cl.statusProtocolo, statusClass(cl.statusProtocolo) || "miel-ci__val--yellow")}
          ${field("Modalidade", modalidade, "miel-ci__val--yellow")}
          ${field("Cliente desde...", fmtDate(cl.dataCadastro))}
        </div>
        <div class="miel-ci__row">
          ${field("Cód. e Nome do Cliente", `Cód.: ${cl.cod} — ${cl.cliente}`)}
        </div>
        <div class="miel-ci__row miel-ci__row--4">
          ${field("CPF/CNPJ", cl.cnpjCpf)}
          ${field("Nº do Celular", fmtPhone(cl.celular))}
          ${field("Nº para Recados (1)", fmtPhone(cl.recados01))}
          ${field("Nº para Recados (2)", fmtPhone(cl.recados02))}
        </div>
        <div class="miel-ci__row miel-ci__row--4">
          ${field("Nº da CNH e Cat.", `${cl.cnh || "—"} — Cat.: ${cl.categoria || "—"}`)}
          ${field("E.A.R.?", cl.ear, /NÃO|NAO/i.test(cl.ear || "") ? "miel-ci__val--danger" : "miel-ci__val--blue")}
          ${field("Venc. da CNH", vencCnh)}
          ${field("Status da CNH", cl.validacao)}
        </div>
        <div class="miel-ci__row">
          ${field("Endereço", `${cl.endereco || ""} ${cl.municipioUf || ""}${cl.cep ? ` — CEP: ${cl.cep}` : ""}`.trim())}
        </div>
      </section>
      <section class="miel-ci__block">
        <h3 class="miel-ci__block-title">Status da Locação</h3>
        <div class="miel-ci__row miel-ci__row--4">
          ${field("Protocolo", loc?.protocolo || "—")}
          ${field("Data Início", fmtDate(loc?.dataInicio) || "—")}
          ${field("Período", loc?.periodo || loc?.periodoContrato || "—")}
          ${field("Data Fim", fmtDate(loc?.dataFim) || "...")}
        </div>
        <div class="miel-ci__row miel-ci__row--3">
          ${field("Placa", loc?.placa || veic?.placa || "—", "miel-ci__val--blue")}
          ${field("Marca / Modelo", veic ? marcaModelo(veic) : loc?.marcaModelo || "—")}
          ${field("Contrato", loc?.opcaoContrato || (modalidade === "CARRO" ? "DK MEU TRANSPORTE (CARRO)" : "—"), "miel-ci__val--yellow")}
        </div>
      </section>`;
  }

  function toolbarHtml() {
    return `<div class="miel-ci__toolbar">
      <button type="button" class="miel-ci__icon" data-miel-xl-link="Página_Inicial!A1" title="Página Inicial">
        <img src="data/miel/media/image45.png" alt="Página Inicial" />
      </button>
      <button type="button" class="miel-ci__icon" data-miel-xl-link="'Cad_Clientes_(Loc.)'!A1" title="Cadastro de Clientes">
        <img src="data/miel/media/image46.png" alt="Cadastro de Clientes" />
      </button>
      <button type="button" class="miel-ci__icon" data-miel-xl-link="'Cad_Veículos_(Loc.)'!A1" title="Cadastro de Veículos">
        <img src="data/miel/media/image48.png" alt="Cadastro de Veículos" />
      </button>
    </div>`;
  }

  function shellHtml(clientesOpts) {
    return `${toolbarHtml()}
    <div class="miel-ci">
      <div class="miel-ci__col miel-ci__col--veic">
        <header class="miel-ci__head"># Consulta de Veículos</header>
        <div class="miel-ci__search">
          <p class="miel-ci__hint">Marque o "Flag" correspondente e digite a informação desejada...</p>
          <label class="miel-ci__search-row">
            <span>Placa &gt;&gt;</span>
            <input type="text" id="mielCiPlaca" class="miel-ci__input miel-ci__input--blue" placeholder="Ex.: RZJ5C24" autocomplete="off" />
          </label>
          <label class="miel-ci__search-row">
            <span>Cód. da Placa &gt;&gt;</span>
            <input type="text" id="mielCiCod" class="miel-ci__input miel-ci__input--blue" placeholder="Ex.: DKCR - 003" autocomplete="off" />
          </label>
          <button type="button" class="miel-ci__btn" id="mielCiBuscarVeic">Buscar veículo</button>
        </div>
        <div id="mielCiVeicResult" class="miel-ci__result"></div>
      </div>
      <div class="miel-ci__col miel-ci__col--cli">
        <header class="miel-ci__head"># Consulta de Clientes</header>
        <div class="miel-ci__search">
          <label class="miel-ci__search-row miel-ci__search-row--stack">
            <span>Digite ou Selecione o Nome do Cliente</span>
            <input type="text" id="mielCiCliente" class="miel-ci__input" list="mielCiClienteList" placeholder="Nome do cliente" autocomplete="off" />
            <datalist id="mielCiClienteList">${clientesOpts}</datalist>
          </label>
          <button type="button" class="miel-ci__btn" id="mielCiBuscarCli">Buscar cliente</button>
        </div>
        <div id="mielCiCliResult" class="miel-ci__result"></div>
      </div>
    </div>`;
  }

  function ensurePanel() {
    let panel = document.querySelector(PANEL_SEL);
    const content = document.getElementById("mielMainContent");
    if (!panel && content) {
      panel = document.createElement("div");
      panel.className = "miel-panel miel-consulta-integrada hidden";
      panel.setAttribute("data-miel-panel", "consulta-integrada");
      panel.id = "mielPanelConsultaIntegrada";
      content.appendChild(panel);
    }
    return panel;
  }

  function bind(panel) {
    const placaEl = panel.querySelector("#mielCiPlaca");
    const codEl = panel.querySelector("#mielCiCod");
    const cliEl = panel.querySelector("#mielCiCliente");
    const veicOut = panel.querySelector("#mielCiVeicResult");
    const cliOut = panel.querySelector("#mielCiCliResult");

    function runVeic() {
      const v = findVeiculo({ placa: placaEl.value, codigo: codEl.value });
      if (v) {
        placaEl.value = v.placa || "";
        codEl.value = v.codigo || "";
      }
      veicOut.innerHTML = renderVeiculo(v);
    }

    function runCli() {
      const cl = findCliente(cliEl.value);
      if (cl) cliEl.value = cl.cliente || "";
      cliOut.innerHTML = renderCliente(cl);
    }

    panel.querySelector("#mielCiBuscarVeic")?.addEventListener("click", runVeic);
    panel.querySelector("#mielCiBuscarCli")?.addEventListener("click", runCli);
    placaEl?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") runVeic();
    });
    codEl?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") runVeic();
    });
    cliEl?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") runCli();
    });
    cliEl?.addEventListener("change", runCli);

    const demoV = findVeiculo({ placa: "RZJ5C24", codigo: "DKCR - 003" }) || (planilha().veiculos || [])[0];
    if (demoV) {
      placaEl.value = demoV.placa || "";
      codEl.value = demoV.codigo || "";
      veicOut.innerHTML = renderVeiculo(demoV);
    } else {
      veicOut.innerHTML = renderVeiculo(null);
    }

    const demoC =
      findCliente("WEMESON DIONÍSIO COELHO") ||
      findCliente("WEMESON") ||
      (planilha().clientes || []).find((c) => /ATIVO/i.test(c.statusProtocolo || "")) ||
      (planilha().clientes || [])[0];
    if (demoC) {
      cliEl.value = demoC.cliente || "";
      cliOut.innerHTML = renderCliente(demoC);
    } else {
      cliOut.innerHTML = renderCliente(null);
    }
  }

  function init() {
    const panel = ensurePanel();
    if (!panel) return;
    const opts = (planilha().clientes || [])
      .slice()
      .sort((a, b) => String(a.cliente).localeCompare(String(b.cliente), "pt-BR"))
      .map((c) => `<option value="${esc(c.cliente)}"></option>`)
      .join("");
    panel.innerHTML = shellHtml(opts);
    bind(panel);
    panel.dataset.mielConsultaReady = "1";
  }

  window.__DK_mielInitConsultaIntegrada = init;
})();
