/**
 * Sistema MIEL — Etapa 03: Cadastro de Clientes (aba Cad_Clientes).
 * Dados isolados: dk_miel_clientes_v1
 */
(function portalMielCadClientes() {
  const PANEL_ID = "mielPanelCadClientes";
  const STORAGE_KEY = "dk_miel_clientes_v1";

  const SIDE_TARGETS = {
    "# Consulta de Clientes": { id: "consulta-clientes", label: "Consulta de Clientes", piece: 11 },
    "# Cadastro de Veículos": { id: "cad-veiculos", label: "Cadastro de Veículos", piece: 13 },
  };

  const FIELDS = [
    { id: "codigo", label: "Cód. do Cliente", row: "codigo", col: "full" },
    { id: "nome", label: "Nome do Cliente", row: "nome", col: "full" },
    { id: "cpfCnpj", label: "CPF/CNPJ", row: "doc" },
    { id: "dataCadastro", label: "Data do Cadastro", row: "doc", type: "date" },
    { id: "clienteDesde", label: "Cliente desde...", row: "doc", type: "date" },
    { id: "cnhCategoria", label: "Nº da CNH / Categoria", row: "cnh" },
    { id: "ear", label: "EAR?", row: "cnh", type: "select", options: ["", "Sim", "Não"] },
    { id: "contato", label: "Nº de Contato", row: "tel" },
    { id: "recados01", label: "Recados 01", row: "tel" },
    { id: "recados02", label: "Recados 02", row: "tel" },
    { id: "recado1", label: "Nº para Recados (1)", row: "rec" },
    { id: "recado2", label: "Nº para Recados (2)", row: "rec" },
    { id: "logradouro", label: "Logradouro", row: "end", col: "full" },
    { id: "bairro", label: "Bairro", row: "end2" },
    { id: "cidade", label: "Cidade", row: "end2" },
    { id: "uf", label: "UF", row: "end2", max: 2 },
    { id: "cep", label: "CEP", row: "end2" },
    { id: "dataInicio", label: "Data Início", row: "ini", type: "date" },
    { id: "observacoes", label: "Observações", row: "obs", col: "full", type: "textarea" },
  ];

  let clientes = [];
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
      clientes = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(clientes)) clientes = [];
    } catch {
      clientes = [];
    }
  }

  function saveStore() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(clientes));
    } catch {
      /* ignore */
    }
  }

  function todayIso() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  function uid() {
    return `mc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
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
              f.type === "textarea"
                ? `<textarea class="miel-cad-input miel-cad-input--area" id="mielCadCliente_${f.id}" rows="2"></textarea>`
                : f.type === "select"
                  ? `<select class="miel-cad-input" id="mielCadCliente_${f.id}">${f.options.map((o) => `<option value="${esc(o)}">${esc(o || "—")}</option>`).join("")}</select>`
                  : `<input class="miel-cad-input" type="${f.type || "text"}" id="mielCadCliente_${f.id}"${f.max ? ` maxlength="${f.max}"` : ""}>`;
            return `<div class="miel-cad-field${full ? " miel-cad-field--full" : ""}"><label for="mielCadCliente_${f.id}">${esc(f.label)}</label>${input}</div>`;
          })
          .join("");
        return `<div class="miel-cad-row">${cells}</div>`;
      })
      .join("");

    const sideHtml = Object.entries(SIDE_TARGETS)
      .map(
        ([label, t]) =>
          `<button type="button" class="miel-admin-side-btn" data-miel-cad-side="${esc(t.id)}" data-miel-cad-side-label="${esc(t.label)}" data-miel-cad-side-piece="${t.piece}">${esc(label)}</button>`
      )
      .join("");

    container.innerHTML = `<div class="miel-cad__layout">
      <div class="miel-cad__main">
        <div class="miel-cad__banner">CADASTRO DE CLIENTES</div>
        <div class="miel-cad__search-row">
          <label for="mielCadClienteBusca">Digite ou Selecione o Nome do Cliente</label>
          <input type="search" class="miel-admin-search" id="mielCadClienteBusca" list="mielCadClienteLista" placeholder="Pesquisar pelo nome..." autocomplete="off">
          <datalist id="mielCadClienteLista"></datalist>
        </div>
        <form class="miel-cad-form" id="mielCadClienteForm" autocomplete="off">${formRows}</form>
        <div class="miel-cad__actions">
          <button type="button" class="miel-cad-action-btn" data-miel-cad-action="novo">Novo Cliente</button>
          <button type="button" class="miel-cad-action-btn miel-cad-action-btn--primary" data-miel-cad-action="guardar">Guardar Cliente</button>
          <button type="button" class="miel-cad-action-btn" data-miel-cad-action="limpar">Limpar Formulário</button>
        </div>
        <p class="miel-admin__hint" id="mielCadClienteFeedback" role="status"></p>
      </div>
      <aside class="miel-cad__side" aria-label="Atalhos cadastro cliente">
        <button type="button" class="miel-nav-btn miel-stub-back" data-miel-cad-back="administrativo">← Voltar ao Administrativo</button>
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
      out[f.id] = container.querySelector(`#mielCadCliente_${f.id}`);
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
    const dc = fields.dataCadastro;
    if (dc && !dc.value) dc.value = todayIso();
    if (feedback) feedback.textContent = "";
    const busca = $("mielCadClienteBusca");
    if (busca) busca.value = "";
  }

  function refreshDatalist(listEl) {
    if (!listEl) return;
    listEl.innerHTML = clientes
      .map((c) => `<option value="${esc(c.nome)}">${esc(c.codigo || c.cpfCnpj || "")}</option>`)
      .join("");
  }

  function findBySearch(term) {
    const t = term.trim().toLowerCase();
    if (!t) return null;
    return (
      clientes.find((c) => (c.nome || "").toLowerCase() === t) ||
      clientes.find((c) => (c.nome || "").toLowerCase().includes(t)) ||
      clientes.find((c) => (c.codigo || "").toLowerCase() === t) ||
      clientes.find((c) => (c.cpfCnpj || "").replace(/\D/g, "") === t.replace(/\D/g, ""))
    );
  }

  function bindPanel(container) {
    const fields = fieldEls(container);
    const feedback = $("mielCadClienteFeedback");
    const busca = $("mielCadClienteBusca");
    const listEl = $("mielCadClienteLista");

    refreshDatalist(listEl);
    if (fields.dataCadastro && !fields.dataCadastro.value) fields.dataCadastro.value = todayIso();

    busca?.addEventListener("change", () => {
      const hit = findBySearch(busca.value);
      if (hit) {
        editId = hit.id;
        writeForm(fields, hit);
        if (feedback) feedback.textContent = `Cliente carregado: ${hit.nome}`;
      }
    });

    busca?.addEventListener("input", () => {
      if (!busca.value.trim() && feedback) feedback.textContent = "";
    });

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

    container.querySelectorAll("[data-miel-cad-action]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const action = btn.getAttribute("data-miel-cad-action") || "";
        if (action === "novo" || action === "limpar") {
          clearForm(fields, feedback);
          if (action === "novo" && feedback) feedback.textContent = "Novo cadastro — preencha os campos.";
          return;
        }
        if (action === "guardar") {
          const data = readForm(fields);
          if (!data.nome) {
            if (feedback) feedback.textContent = "Informe o Nome do Cliente.";
            fields.nome?.focus();
            return;
          }
          const idx = clientes.findIndex((c) => c.id === data.id);
          if (idx >= 0) clientes[idx] = data;
          else clientes.push(data);
          editId = data.id;
          saveStore();
          refreshDatalist(listEl);
          if (feedback) feedback.textContent = `Cliente guardado: ${data.nome}${data.codigo ? ` (${data.codigo})` : ""}`;
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
      refreshDatalist($("mielCadClienteLista"));
    }
  }

  window.__DK_mielInitCadClientes = init;
})();
