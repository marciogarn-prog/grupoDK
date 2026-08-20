/**
 * Sistema MIEL — Etapa 04: Cadastro de Veículos (aba Cad_Veículos).
 * Campos conforme cabeçalhos linha 17 da planilha. Dados: dk_miel_veiculos_v1
 */
(function portalMielCadVeiculos() {
  const PANEL_ID = "mielPanelCadVeiculos";
  const STORAGE_KEY = "dk_miel_veiculos_v1";

  const SIDE_TARGETS = {
    "# Consulta de Veículos": { id: "consulta-veiculos", label: "Consulta de Veículos", piece: 11 },
    "# Cadastro de Clientes": { id: "cad-clientes", label: "Cadastro de Clientes", piece: 12 },
  };

  /** Cabeçalhos linha 17 — Cad_Veículos (colunas A..V). */
  const FIELDS = [
    { id: "codigo", label: "Cód. do Veículo", row: "id", col: "full" },
    { id: "dataCadastro", label: "Data do Cadastro", row: "id", type: "date" },
    { id: "status", label: "Status", row: "id", type: "select", options: ["", "LOCADO", "DISPONÍVEL", "INDISPONÍVEL", "VENDIDO", "EM MANUTENÇÃO"] },
    { id: "observacao", label: "Observação", row: "id", col: "full" },
    { id: "placa", label: "Placa", row: "placa" },
    { id: "categoria", label: "Categoria", row: "placa", type: "select", options: ["", "MOTO", "CARRO"] },
    { id: "marca", label: "Marca", row: "marca" },
    { id: "modelo", label: "Modelo", row: "marca", col: "full" },
    { id: "cor", label: "Cor", row: "det" },
    { id: "chassi", label: "Chassi", row: "det", col: "full" },
    { id: "renavam", label: "Renavam", row: "det" },
    { id: "anoModelo", label: "Ano/Modelo", row: "det" },
    { id: "numMotor", label: "Nº do Motor", row: "mot" },
    { id: "emplacada", label: "Emplacada?", row: "mot", type: "select", options: ["", "SIM", "NÃO"] },
    { id: "rastreador", label: "Rastreador?", row: "mot", type: "select", options: ["", "SIM", "NÃO", "IBS"] },
    { id: "assegurada", label: "Assegurada?", row: "mot", type: "select", options: ["", "SIM", "NÃO"] },
    { id: "proprietario", label: "Proprietário", row: "prop", col: "full" },
    { id: "cnpjCpf", label: "CNPJ/CPF", row: "prop" },
    { id: "municipioUf", label: "Município/UF", row: "prop" },
    { id: "valorAquisicao", label: "Valor de Aquisição", row: "prop", type: "number", step: "0.01" },
  ];

  let veiculos = [];
  let editId = null;

  function esc(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function loadStore() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      veiculos = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(veiculos)) veiculos = [];
    } catch {
      veiculos = [];
    }
  }

  function saveStore() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(veiculos));
    } catch {
      /* ignore */
    }
  }

  function todayIso() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  function uid() {
    return `mv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  function renderPanel(container) {
    const rows = new Map();
    FIELDS.forEach((f) => {
      if (!rows.has(f.row)) rows.set(f.row, []);
      rows.get(f.row).push(f);
    });

    const formRows = [...rows.entries()]
      .map(([, fields]) => {
        const cells = fields
          .map((f) => {
            const full = f.col === "full";
            const input =
              f.type === "select"
                ? `<select class="miel-cad-input" id="mielCadVeiculo_${f.id}">${f.options.map((o) => `<option value="${esc(o)}">${esc(o || "—")}</option>`).join("")}</select>`
                : `<input class="miel-cad-input" type="${f.type || "text"}" id="mielCadVeiculo_${f.id}"${f.step ? ` step="${f.step}"` : ""}>`;
            return `<div class="miel-cad-field${full ? " miel-cad-field--full" : ""}"><label for="mielCadVeiculo_${f.id}">${esc(f.label)}</label>${input}</div>`;
          })
          .join("");
        return `<div class="miel-cad-row">${cells}</div>`;
      })
      .join("");

    const sideHtml = Object.entries(SIDE_TARGETS)
      .map(
        ([label, t]) =>
          `<button type="button" class="miel-admin-side-btn" data-miel-cad-veic-side="${esc(t.id)}" data-miel-cad-veic-side-label="${esc(t.label)}" data-miel-cad-veic-side-piece="${t.piece}">${esc(label)}</button>`
      )
      .join("");

    container.innerHTML = `<div class="miel-cad__layout">
      <div class="miel-cad__main">
        <div class="miel-cad__banner">CADASTRO DE VEÍCULOS</div>
        <div class="miel-cad__search-row">
          <label for="mielCadVeiculoBusca">Digite ou Selecione a Placa ou Cód. do Veículo</label>
          <input type="search" class="miel-admin-search" id="mielCadVeiculoBusca" list="mielCadVeiculoLista" placeholder="Pesquisar por placa ou código..." autocomplete="off">
          <datalist id="mielCadVeiculoLista"></datalist>
        </div>
        <form class="miel-cad-form" id="mielCadVeiculoForm" autocomplete="off">${formRows}</form>
        <div class="miel-cad__actions">
          <button type="button" class="miel-cad-action-btn" data-miel-cad-veic-action="novo">Novo Veículo</button>
          <button type="button" class="miel-cad-action-btn miel-cad-action-btn--primary" data-miel-cad-veic-action="guardar">Guardar Veículo</button>
          <button type="button" class="miel-cad-action-btn" data-miel-cad-veic-action="limpar">Limpar Formulário</button>
        </div>
        <p class="miel-admin__hint" id="mielCadVeiculoFeedback" role="status"></p>
      </div>
      <aside class="miel-cad__side" aria-label="Atalhos cadastro veículo">
        <button type="button" class="miel-nav-btn miel-stub-back" data-miel-cad-veic-back="administrativo">← Voltar ao Administrativo</button>
        ${sideHtml}
      </aside>
    </div>`;
  }

  function $(id) {
    return document.getElementById(id);
  }

  function fieldEls(container) {
    const out = {};
    FIELDS.forEach((f) => {
      out[f.id] = container.querySelector(`#mielCadVeiculo_${f.id}`);
    });
    return out;
  }

  function readForm(fields) {
    const data = { id: editId || uid() };
    FIELDS.forEach((f) => {
      data[f.id] = (fields[f.id]?.value || "").trim();
    });
    return data;
  }

  function writeForm(fields, data) {
    FIELDS.forEach((f) => {
      if (fields[f.id]) fields[f.id].value = data?.[f.id] ?? "";
    });
  }

  function clearForm(fields, feedback) {
    editId = null;
    writeForm(fields, {});
    if (fields.dataCadastro && !fields.dataCadastro.value) fields.dataCadastro.value = todayIso();
    if (feedback) feedback.textContent = "";
    const busca = $("mielCadVeiculoBusca");
    if (busca) busca.value = "";
  }

  function refreshDatalist(listEl) {
    if (!listEl) return;
    listEl.innerHTML = veiculos
      .map((v) => {
        const label = v.placa || v.codigo || "";
        return `<option value="${esc(label)}">${esc(v.codigo || "")}</option>`;
      })
      .join("");
  }

  function normPlaca(s) {
    return String(s || "")
      .replace(/[^a-zA-Z0-9]/g, "")
      .toUpperCase();
  }

  function findBySearch(term) {
    const t = term.trim().toLowerCase();
    const p = normPlaca(term);
    if (!t) return null;
    return (
      veiculos.find((v) => normPlaca(v.placa) === p) ||
      veiculos.find((v) => (v.codigo || "").toLowerCase() === t) ||
      veiculos.find((v) => (v.placa || "").toLowerCase().includes(t)) ||
      veiculos.find((v) => (v.codigo || "").toLowerCase().includes(t)) ||
      veiculos.find((v) => normPlaca(v.chassi).includes(p))
    );
  }

  function bindPanel(container) {
    const fields = fieldEls(container);
    const feedback = $("mielCadVeiculoFeedback");
    const busca = $("mielCadVeiculoBusca");
    const listEl = $("mielCadVeiculoLista");

    refreshDatalist(listEl);
    if (fields.dataCadastro && !fields.dataCadastro.value) fields.dataCadastro.value = todayIso();

    busca?.addEventListener("change", () => {
      const hit = findBySearch(busca.value);
      if (hit) {
        editId = hit.id;
        writeForm(fields, hit);
        if (feedback) feedback.textContent = `Veículo carregado: ${hit.placa || hit.codigo}`;
      }
    });

    busca?.addEventListener("input", () => {
      if (!busca.value.trim() && feedback) feedback.textContent = "";
    });

    container.querySelector('[data-miel-cad-veic-back="administrativo"]')?.addEventListener("click", () => {
      if (typeof window.__DK_mielShowSheet === "function") window.__DK_mielShowSheet("administrativo");
    });

    container.querySelectorAll("[data-miel-cad-veic-side]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-miel-cad-veic-side") || "";
        const label = btn.getAttribute("data-miel-cad-veic-side-label") || id;
        const piece = btn.getAttribute("data-miel-cad-veic-side-piece") || "?";
        if (typeof window.__DK_mielOpenDestino === "function") {
          window.__DK_mielOpenDestino(id, label, piece);
        }
      });
    });

    container.querySelectorAll("[data-miel-cad-veic-action]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const action = btn.getAttribute("data-miel-cad-veic-action") || "";
        if (action === "novo" || action === "limpar") {
          clearForm(fields, feedback);
          if (action === "novo" && feedback) feedback.textContent = "Novo cadastro — preencha os campos.";
          return;
        }
        if (action === "guardar") {
          const data = readForm(fields);
          if (!data.placa && !data.codigo) {
            if (feedback) feedback.textContent = "Informe a Placa ou o Cód. do Veículo.";
            (fields.placa || fields.codigo)?.focus();
            return;
          }
          const idx = veiculos.findIndex((v) => v.id === data.id);
          if (idx >= 0) veiculos[idx] = data;
          else veiculos.push(data);
          editId = data.id;
          saveStore();
          refreshDatalist(listEl);
          if (feedback) {
            feedback.textContent = `Veículo guardado: ${data.placa || data.codigo}${data.codigo ? ` (${data.codigo})` : ""}`;
          }
        }
      });
    });
  }

  function init() {
    const container = document.getElementById(PANEL_ID);
    if (!container) return;
    loadStore();
    if (container.dataset.mielCadVeiculosReady !== "1") {
      renderPanel(container);
      bindPanel(container);
      container.dataset.mielCadVeiculosReady = "1";
    } else {
      refreshDatalist($("mielCadVeiculoLista"));
    }
  }

  window.__DK_mielInitCadVeiculos = init;
  window.__DK_mielCadVeiculosFields = FIELDS.map((f) => f.label);
})();
