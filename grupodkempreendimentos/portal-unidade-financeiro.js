/**
 * Receita / Despesa / Balanço das unidades DK Centro Automotivo e DK Construtora.
 */
(function portalUnidadeFinanceiro() {
  const STORAGE_KEY = "dk_unidade_financeiro_v1";
  const UNIT_LABEL = {
    centro: "DK Centro Automotivo",
    construtora: "DK Construtora",
  };
  const PANE_LABEL = {
    receita: "RECEITA",
    despesa: "DESPESA",
    balanco: "BALANÇO",
  };

  let currentUnit = "centro";
  let currentPane = "receita";
  let bound = false;

  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function brl(n) {
    const v = Number(n) || 0;
    if (typeof window.currencyBRL === "function") return window.currencyBRL(v);
    return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }

  function parseValor(raw) {
    if (typeof raw === "number" && Number.isFinite(raw)) return raw;
    if (typeof window.parseCurrencyBR === "function") {
      const n = Number(window.parseCurrencyBR(raw));
      return Number.isFinite(n) ? n : 0;
    }
    const s = String(raw || "").replace(/[R$\s]/g, "");
    if (!s) return 0;
    const n = Number(s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s);
    return Number.isFinite(n) ? n : 0;
  }

  function todayBr() {
    const d = new Date();
    return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
  }

  function parseBrDate(raw) {
    const s = String(raw || "").trim();
    const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?$/);
    if (!m) return null;
    const day = Number(m[1]);
    const mo = Number(m[2]) - 1;
    let y = m[3] ? Number(m[3]) : new Date().getFullYear();
    if (y < 100) y += 2000;
    const dt = new Date(y, mo, day);
    if (Number.isNaN(dt.getTime()) || dt.getDate() !== day || dt.getMonth() !== mo) return null;
    return dt;
  }

  function fmtBrDate(d) {
    if (!(d instanceof Date) || Number.isNaN(d.getTime())) return "";
    return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
  }

  function sortKey(row) {
    const dt = parseBrDate(row?.data);
    const t = dt ? dt.getTime() : 0;
    return t * 1000 + (Number(row?.updatedAt) || 0);
  }

  function newId() {
    return `uf-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function loadAll() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  }

  function saveAll(list) {
    const payload = Array.isArray(list) ? list : [];
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      /* ignore */
    }
    if (typeof window.saveCadastro === "function") {
      try {
        window.saveCadastro(STORAGE_KEY, payload, { bypassImmutabilidadeCadastro: true });
      } catch {
        /* ignore */
      }
    }
    if (typeof window.__DK_pushCloudSnapshotNow === "function") {
      window.__DK_pushCloudSnapshotNow({ force: true }).catch(() => {});
    }
  }

  function normalizeRow(raw) {
    const unit = raw?.unit === "construtora" ? "construtora" : "centro";
    const tipo = raw?.tipo === "despesa" ? "despesa" : "receita";
    const valor = Math.abs(parseValor(raw?.valor));
    const descricao = String(raw?.descricao || "").trim();
    const dt = parseBrDate(raw?.data);
    return {
      id: String(raw?.id || newId()),
      unit,
      tipo,
      valor,
      descricao,
      data: dt ? fmtBrDate(dt) : String(raw?.data || "").trim(),
      updatedAt: Number(raw?.updatedAt) || Date.now(),
    };
  }

  function mergeUnidadeFinanceiro(localArr, cloudArr) {
    const byId = new Map();
    for (const arr of [localArr, cloudArr]) {
      if (!Array.isArray(arr)) continue;
      for (const row of arr) {
        if (!row || typeof row !== "object") continue;
        const n = normalizeRow(row);
        if (!n.id) continue;
        const prev = byId.get(n.id);
        if (!prev || (n.updatedAt || 0) >= (prev.updatedAt || 0)) byId.set(n.id, n);
      }
    }
    return Array.from(byId.values());
  }

  function totalsFor(unit, rows) {
    const list = (rows || []).filter((r) => r.unit === unit);
    let receita = 0;
    let despesa = 0;
    for (const r of list) {
      if (r.tipo === "despesa") despesa += Number(r.valor) || 0;
      else receita += Number(r.valor) || 0;
    }
    return { receita, despesa, saldo: receita - despesa, list };
  }

  function rowsForPane(unit, pane, rows) {
    const list = (rows || []).filter((r) => r.unit === unit);
    if (pane === "receita") return list.filter((r) => r.tipo === "receita");
    if (pane === "despesa") return list.filter((r) => r.tipo === "despesa");
    return list;
  }

  window.__DK_mergeUnidadeFinanceiro = mergeUnidadeFinanceiro;
  window.__DK_unidadeFinanceiroTotals = totalsFor;
  window.__DK_unidadeFinanceiroKey = STORAGE_KEY;

  function $(id) {
    return document.getElementById(id);
  }

  function setFeedback(msg, isError) {
    const el = $("unidade-fin-feedback");
    if (!el) return;
    el.textContent = msg || "";
    el.classList.toggle("portal-feedback--error", Boolean(isError && msg));
  }

  function resetForm() {
    const valor = $("unidade-fin-valor");
    const desc = $("unidade-fin-desc");
    const data = $("unidade-fin-data");
    if (valor) valor.value = "";
    if (desc) desc.value = "";
    if (data) data.value = todayBr();
  }

  function render() {
    const title = $("unidade-fin-title");
    const lead = $("unidade-fin-lead");
    const form = $("unidade-fin-form");
    const kpiReceita = $("unidade-fin-kpi-receita");
    const kpiDespesa = $("unidade-fin-kpi-despesa");
    const kpiSaldo = $("unidade-fin-kpi-saldo");
    const body = $("unidade-fin-body");
    const vazia = $("unidade-fin-vazia");
    const listaTitulo = $("unidade-fin-lista-titulo");
    const unitName = UNIT_LABEL[currentUnit] || UNIT_LABEL.centro;
    const paneName = PANE_LABEL[currentPane] || PANE_LABEL.receita;

    if (title) title.textContent = `${paneName} — ${unitName}`;
    if (lead) {
      if (currentPane === "receita") lead.textContent = `Registe as entradas de ${unitName}.`;
      else if (currentPane === "despesa") lead.textContent = `Registe as saídas de ${unitName}.`;
      else lead.textContent = `Receita menos despesa de ${unitName}.`;
    }
    if (form) form.classList.toggle("hidden", currentPane === "balanco");

    const all = loadAll().map(normalizeRow);
    const tot = totalsFor(currentUnit, all);
    if (kpiReceita) kpiReceita.textContent = brl(tot.receita);
    if (kpiDespesa) kpiDespesa.textContent = brl(tot.despesa);
    if (kpiSaldo) {
      kpiSaldo.textContent = brl(tot.saldo);
      kpiSaldo.classList.toggle("fin-rel-val--neg", tot.saldo < 0);
    }

    const visible = rowsForPane(currentUnit, currentPane, all).sort((a, b) => sortKey(b) - sortKey(a));
    if (listaTitulo) {
      listaTitulo.textContent =
        currentPane === "balanco" ? "Movimentos" : currentPane === "despesa" ? "Despesas" : "Receitas";
    }
    if (vazia) {
      vazia.classList.toggle("hidden", visible.length > 0);
      vazia.textContent =
        currentPane === "balanco"
          ? "Nenhum lançamento nesta unidade."
          : currentPane === "despesa"
            ? "Nenhuma despesa nesta unidade."
            : "Nenhuma receita nesta unidade.";
    }
    if (!body) return;
    body.innerHTML = visible
      .map((r) => {
        const tipoLab = r.tipo === "despesa" ? "Despesa" : "Receita";
        const canDel = currentPane !== "balanco" || true;
        return `<tr data-uf-id="${esc(r.id)}">
          <td>${esc(r.data || "—")}</td>
          <td>${esc(tipoLab)}</td>
          <td>${esc(r.descricao || "—")}</td>
          <td>${esc(brl(r.valor))}</td>
          <td>${canDel ? `<button type="button" class="btn-primary btn-secondary-outline unidade-fin-del">Apagar</button>` : ""}</td>
        </tr>`;
      })
      .join("");
  }

  function onSubmit(e) {
    e.preventDefault();
    if (currentPane === "balanco") return;
    const valor = parseValor($("unidade-fin-valor")?.value);
    const descricao = String($("unidade-fin-desc")?.value || "").trim();
    const dataRaw = String($("unidade-fin-data")?.value || "").trim();
    const dt = parseBrDate(dataRaw);
    if (!(valor > 0)) {
      setFeedback("Informe um valor maior que zero.", true);
      return;
    }
    if (!dt) {
      setFeedback("Informe a data no formato DD/MM/AAAA.", true);
      return;
    }
    if (!descricao) {
      setFeedback("Informe a descrição.", true);
      return;
    }
    const row = normalizeRow({
      id: newId(),
      unit: currentUnit,
      tipo: currentPane === "despesa" ? "despesa" : "receita",
      valor,
      descricao,
      data: fmtBrDate(dt),
      updatedAt: Date.now(),
    });
    const next = loadAll().map(normalizeRow);
    next.push(row);
    saveAll(next);
    resetForm();
    setFeedback(
      currentPane === "despesa" ? "Despesa guardada." : "Receita guardada.",
      false
    );
    render();
  }

  function onDelete(id) {
    const next = loadAll()
      .map(normalizeRow)
      .filter((r) => r.id !== id);
    saveAll(next);
    setFeedback("Lançamento apagado.", false);
    render();
  }

  function bind() {
    if (bound) return;
    bound = true;
    $("unidade-fin-form")?.addEventListener("submit", onSubmit);
    $("unidade-fin-limpar")?.addEventListener("click", () => {
      resetForm();
      setFeedback("");
    });
    $("unidade-fin-body")?.addEventListener("click", (e) => {
      const btn = e.target instanceof Element ? e.target.closest(".unidade-fin-del") : null;
      if (!btn) return;
      const tr = btn.closest("tr[data-uf-id]");
      const id = tr?.getAttribute("data-uf-id") || "";
      if (!id) return;
      if (!window.confirm("Apagar este lançamento?")) return;
      onDelete(id);
    });
  }

  window.__DK_unidadeFinOnShow = function unidadeFinOnShow(unit, pane) {
    currentUnit = unit === "construtora" ? "construtora" : "centro";
    currentPane = pane === "despesa" || pane === "balanco" ? pane : "receita";
    bind();
    resetForm();
    setFeedback("");
    render();
  };
})();
