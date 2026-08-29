/**
 * FINANCEIRO CEO — cadastro de despesas estratégicas, endividamento e projeção (2 anos).
 * Acesso restrito ao CPF titular (03037897430).
 */
(function portalFinanceiroCeo() {
  const DESPESAS_CEO_KEY = "dk_financeiro_ceo_despesas_v1";
  const HORIZONTE_MESES = 24;

  const CATEGORIAS = [
    { id: "FINANCIAMENTO", label: "Financiamento" },
    { id: "CONSORCIO", label: "Consórcio" },
    { id: "PESSOAIS", label: "Pessoais" },
    { id: "DK_CONSTRUTORA", label: "DK Construtora" },
    { id: "DK_OFICINA", label: "DK Oficina" },
    { id: "DK_LOCADORA", label: "DK Locadora" },
  ];

  const panel = document.getElementById("panel-financeiro-ceo-locadora");
  if (!panel) return;

  let bound = false;
  let paneAberto = "";

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

  function parseBrDate(raw) {
    const s = String(raw || "").trim();
    if (!s) return null;
    const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?$/);
    if (m) {
      const d = Number(m[1]);
      const mo = Number(m[2]) - 1;
      let y = m[3] ? Number(m[3]) : new Date().getFullYear();
      if (y < 100) y += 2000;
      const dt = new Date(y, mo, d);
      return Number.isNaN(dt.getTime()) ? null : dt;
    }
    const iso = new Date(s);
    return Number.isNaN(iso.getTime()) ? null : iso;
  }

  function fmtBrDate(d) {
    if (!(d instanceof Date) || Number.isNaN(d.getTime())) return "";
    return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
  }

  function ymd(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  function monthKey(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }

  function startOfDay(d) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  function addMonths(d, n) {
    return new Date(d.getFullYear(), d.getMonth() + n, d.getDate());
  }

  function loadDespesasCeo() {
    try {
      const raw = localStorage.getItem(DESPESAS_CEO_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  }

  function saveDespesasCeo(list) {
    const payload = Array.isArray(list) ? list : [];
    try {
      localStorage.setItem(DESPESAS_CEO_KEY, JSON.stringify(payload));
    } catch {
      /* ignore */
    }
    if (typeof window.saveCadastro === "function") {
      try {
        window.saveCadastro(DESPESAS_CEO_KEY, payload, { bypassImmutabilidadeCadastro: true });
      } catch {
        /* ignore */
      }
    }
    if (typeof window.__DK_pushCloudSnapshotNow === "function") {
      window.__DK_pushCloudSnapshotNow({ force: true }).catch(() => {});
    }
  }

  function normalizeDespesa(raw) {
    const id = String(raw?.id || `ceo-desp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`);
    const categoria = CATEGORIAS.some((c) => c.id === raw?.categoria) ? raw.categoria : CATEGORIAS[0].id;
    const subcategoria = String(raw?.subcategoria || "").trim();
    const periodic = Boolean(raw?.periodic);
    const valor = parseValor(raw?.valor);
    const repeticoes = Math.max(1, Math.min(360, Number(raw?.repeticoes) || 1));
    const dataEvento = parseBrDate(raw?.dataEvento) || new Date();
    const parcelas = Array.isArray(raw?.parcelas)
      ? raw.parcelas
          .map((p) => ({
            valor: parseValor(p?.valor),
            dia: Math.max(1, Math.min(31, Number(p?.dia) || 1)),
            mes: Math.max(1, Math.min(12, Number(p?.mes) || 1)),
          }))
          .filter((p) => p.valor > 0)
      : [];
    return { id, categoria, subcategoria, periodic, valor, repeticoes, dataEvento, parcelas };
  }

  function gerarDebitosDespesa(desp, inicioHorizonte, fimHorizonte) {
    const out = [];
    if (desp.periodic) {
      if (desp.valor <= 0) return out;
      let dt = startOfDay(desp.dataEvento);
      for (let i = 0; i < desp.repeticoes; i += 1) {
        if (dt >= inicioHorizonte && dt <= fimHorizonte) {
          out.push({ data: new Date(dt), valor: desp.valor, categoria: desp.categoria, subcategoria: desp.subcategoria });
        }
        dt = addMonths(dt, 1);
        if (dt > fimHorizonte) break;
      }
    } else {
      (desp.parcelas || []).forEach((p) => {
        if (p.valor <= 0) return;
        for (let y = inicioHorizonte.getFullYear(); y <= fimHorizonte.getFullYear(); y += 1) {
          const dt = new Date(y, p.mes - 1, Math.min(p.dia, 28));
          if (dt >= inicioHorizonte && dt <= fimHorizonte) {
            out.push({ data: dt, valor: p.valor, categoria: desp.categoria, subcategoria: desp.subcategoria });
          }
        }
      });
    }
    return out;
  }

  function gerarTodosDebitos(despesas, inicioHorizonte, fimHorizonte) {
    return despesas.flatMap((d) => gerarDebitosDespesa(d, inicioHorizonte, fimHorizonte));
  }

  function locacaoEstaAtiva(loc) {
    if (typeof window.__DK_isPortalLocacaoAtiva === "function") {
      return Boolean(window.__DK_isPortalLocacaoAtiva(loc));
    }
    return !String(loc?.fim || loc?.dataFim || "").trim();
  }

  function valorSemanalContrato(loc) {
    const locacao = parseValor(loc?.valorLocacao);
    const inv = parseValor(loc?.valorInvestimento);
    const sem = parseValor(loc?.valorSemanal || loc?.valorParcela);
    if (locacao + inv > 0) return locacao + inv;
    return sem > 0 ? sem : locacao;
  }

  function parseLocCampoData(loc, keys) {
    for (const k of keys) {
      const d = parseBrDate(loc?.[k]);
      if (d) return d;
    }
    return null;
  }

  function locInicio(loc) {
    return parseLocCampoData(loc, ["inicio", "dataInicio", "inicioContrato", "data"]);
  }

  function locFim(loc) {
    return parseBrDate(loc?.fim) || parseBrDate(loc?.dataFim) || parseBrDate(loc?.dataTermino) || null;
  }

  function locAtivaNoDia(loc, day) {
    const ini = locInicio(loc);
    const fim = locFim(loc);
    if (ini && day < ini) return false;
    if (fim && day > fim) return false;
    if (!ini && fim && day > fim) return false;
    if (!ini && !fim) return locacaoEstaAtiva(loc);
    return true;
  }

  function carregarLocacoes() {
    if (typeof window.loadCadastro !== "function" || typeof window.CAD_LOCACOES_KEY === "undefined") return [];
    try {
      return window.loadCadastro(window.CAD_LOCACOES_KEY) || [];
    } catch {
      return [];
    }
  }

  function receitaPrevistaMes(ano, mes, locs) {
    const ini = new Date(ano, mes, 1);
    const fim = new Date(ano, mes + 1, 0);
    let total = 0;
    locs.forEach((loc) => {
      const sem = valorSemanalContrato(loc);
      if (sem <= 0) return;
      const diaRate = sem / 7;
      for (let d = new Date(ini); d <= fim; d.setDate(d.getDate() + 1)) {
        const day = startOfDay(d);
        if (locAtivaNoDia(loc, day)) total += diaRate;
      }
    });
    return total;
  }

  function buildProjecao24Meses() {
    const hoje = startOfDay(new Date());
    const inicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    const fim = addMonths(inicio, HORIZONTE_MESES);
    const despesas = loadDespesasCeo().map(normalizeDespesa);
    const debitos = gerarTodosDebitos(despesas, inicio, fim);
    const locs = carregarLocacoes();

    const meses = [];
    for (let i = 0; i < HORIZONTE_MESES; i += 1) {
      const d = addMonths(inicio, i);
      meses.push({ date: d, key: monthKey(d), label: `${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}` });
    }

    const debPorMes = new Map();
    debitos.forEach((db) => {
      const k = monthKey(db.data);
      debPorMes.set(k, (debPorMes.get(k) || 0) + db.valor);
    });

    const recPorMes = new Map();
    meses.forEach((m) => {
      recPorMes.set(m.key, receitaPrevistaMes(m.date.getFullYear(), m.date.getMonth(), locs));
    });

    const saldoMes = meses.map((m) => (recPorMes.get(m.key) || 0) - (debPorMes.get(m.key) || 0));
    let acc = 0;
    const saldoAcc = saldoMes.map((s) => {
      acc += s;
      return acc;
    });

    const endivMesAtual = debPorMes.get(monthKey(hoje)) || debPorMes.get(monthKey(inicio)) || 0;
    const receitaMesAtual = recPorMes.get(monthKey(hoje)) || recPorMes.get(monthKey(inicio)) || 0;

    return { meses, debPorMes, recPorMes, saldoMes, saldoAcc, endivMesAtual, receitaMesAtual, debitos };
  }

  function svgLineChart(labels, series) {
    const w = 1100;
    const h = 380;
    const padL = 58;
    const padR = 12;
    const padT = 16;
    const padB = 40;
    const innerW = w - padL - padR;
    const innerH = h - padT - padB;
    const allVals = series.flatMap((s) => s.values || []);
    const rawMax = Math.max(0, ...allVals);
    const rawMin = Math.min(0, ...allVals);
    const span = Math.max(1, rawMax - rawMin);
    const n = Math.max(1, labels.length - 1);
    const xAt = (i) => padL + (labels.length <= 1 ? innerW / 2 : (i / n) * innerW);
    const yAt = (v) => padT + innerH - ((v - rawMin) / span) * innerH;
    const grid = [0, 0.25, 0.5, 0.75, 1]
      .map((p) => {
        const val = rawMin + span * p;
        const y = yAt(val);
        return `<line x1="${padL}" y1="${y}" x2="${w - padR}" y2="${y}" stroke="rgba(255,255,255,0.12)"/>
          <text x="${padL - 6}" y="${y + 4}" text-anchor="end" fill="#bdbdbd" font-size="10">${esc(brl(val))}</text>`;
      })
      .join("");
    const zero =
      rawMin < 0
        ? `<line x1="${padL}" y1="${yAt(0)}" x2="${w - padR}" y2="${yAt(0)}" stroke="rgba(255,255,255,0.35)" stroke-dasharray="4 4"/>`
        : "";
    const step = labels.length > 14 ? Math.ceil(labels.length / 8) : 1;
    const axis = labels
      .map((lb, i) => {
        if (i % step !== 0 && i !== labels.length - 1) return "";
        return `<text x="${xAt(i)}" y="${h - 12}" text-anchor="middle" fill="#bdbdbd" font-size="10">${esc(lb)}</text>`;
      })
      .join("");
    const lines = series
      .map((s) => {
        if (!s.values.length) return "";
        const pts = s.values.map((v, i) => `${xAt(i)},${yAt(v || 0)}`).join(" ");
        return `<polyline fill="none" stroke="${s.color}" stroke-width="2.2" points="${pts}"/>`;
      })
      .join("");
    return `<svg class="fin-chart-svg fin-ceo-chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="Gráfico">${grid}${zero}${lines}${axis}</svg>`;
  }

  function renderDashboard() {
    const proj = buildProjecao24Meses();
    const labels = proj.meses.map((m) => m.label);

    const kpiEndiv = document.getElementById("finCeoKpiEndividamento");
    const kpiReceita = document.getElementById("finCeoKpiReceita");
    if (kpiEndiv) kpiEndiv.textContent = brl(proj.endivMesAtual);
    if (kpiReceita) kpiReceita.textContent = brl(proj.receitaMesAtual);

    const chartSaldo = document.getElementById("finCeoChartSaldoMes");
    if (chartSaldo) {
      chartSaldo.innerHTML = svgLineChart(labels, [
        { color: "#5eb8ff", values: proj.saldoMes },
        { color: "#6ee7a0", values: proj.meses.map((m) => proj.recPorMes.get(m.key) || 0) },
        { color: "#ff6b6b", values: proj.meses.map((m) => -(proj.debPorMes.get(m.key) || 0)) },
      ]);
    }

    const chartAcc = document.getElementById("finCeoChartSaldoAcc");
    if (chartAcc) {
      chartAcc.innerHTML = svgLineChart(labels, [{ color: "#f5d76e", values: proj.saldoAcc }]);
    }

    const legSaldo = document.getElementById("finCeoLegendaSaldo");
    if (legSaldo) {
      legSaldo.innerHTML = [
        { c: "#5eb8ff", t: "Saldo mensal (receita − despesas)" },
        { c: "#6ee7a0", t: "Receita prevista" },
        { c: "#ff6b6b", t: "Despesas (negativo)" },
      ]
        .map((x) => `<span class="fin-legenda__item"><i style="background:${x.c}"></i>${esc(x.t)}</span>`)
        .join("");
    }

    const legAcc = document.getElementById("finCeoLegendaAcc");
    if (legAcc) {
      legAcc.innerHTML = `<span class="fin-legenda__item"><i style="background:#f5d76e"></i>Saldo acumulado · ${esc(brl(proj.saldoAcc[proj.saldoAcc.length - 1] || 0))} em ${HORIZONTE_MESES} meses</span>`;
    }

    const tab = document.getElementById("finCeoTabelaProjecao");
    if (tab) {
      const head = `<tr><th>Mês</th><th>Despesas</th><th>Receita prevista</th><th>Saldo mês</th><th>Saldo acumulado</th></tr>`;
      const body = proj.meses
        .map(
          (m, i) =>
            `<tr><td>${esc(m.label)}</td><td>${esc(brl(proj.debPorMes.get(m.key) || 0))}</td><td>${esc(brl(proj.recPorMes.get(m.key) || 0))}</td><td>${esc(brl(proj.saldoMes[i] || 0))}</td><td>${esc(brl(proj.saldoAcc[i] || 0))}</td></tr>`
        )
        .join("");
      tab.innerHTML = `<table class="fin-table"><thead>${head}</thead><tbody>${body}</tbody></table>`;
    }
  }

  function subcategoriasExistentes(catId) {
    const set = new Set();
    loadDespesasCeo().forEach((d) => {
      if (d.categoria === catId && d.subcategoria) set.add(String(d.subcategoria).trim());
    });
    return Array.from(set).sort();
  }

  function renderSubcategoriaDatalist() {
    const cat = document.getElementById("finCeoDespCategoria")?.value || CATEGORIAS[0].id;
    const dl = document.getElementById("finCeoSubcategoriaLista");
    if (!dl) return;
    dl.innerHTML = subcategoriasExistentes(cat)
      .map((s) => `<option value="${esc(s)}"></option>`)
      .join("");
  }

  function renderParcelasAvulsas() {
    const wrap = document.getElementById("finCeoParcelasAvulsas");
    if (!wrap) return;
    const rows = wrap.querySelectorAll(".fin-ceo-parcela-row");
    if (!rows.length) {
      wrap.innerHTML = `
        <div class="fin-ceo-parcela-row">
          <label class="portal-field"><span>Valor (R$)</span><input type="text" class="fin-ceo-parc-valor" inputmode="decimal" placeholder="0,00"></label>
          <label class="portal-field"><span>Dia</span><input type="number" class="fin-ceo-parc-dia" min="1" max="31" placeholder="DD"></label>
          <label class="portal-field"><span>Mês</span><input type="number" class="fin-ceo-parc-mes" min="1" max="12" placeholder="MM"></label>
        </div>`;
    }
  }

  function togglePeriodicUi() {
    const periodic = document.getElementById("finCeoDespPeriodico")?.value === "sim";
    document.getElementById("finCeoCamposPeriodico")?.classList.toggle("hidden", !periodic);
    document.getElementById("finCeoCamposAvulso")?.classList.toggle("hidden", periodic);
  }

  function lerParcelasDoForm() {
    const rows = document.querySelectorAll("#finCeoParcelasAvulsas .fin-ceo-parcela-row");
    return Array.from(rows)
      .map((row) => ({
        valor: parseValor(row.querySelector(".fin-ceo-parc-valor")?.value),
        dia: Number(row.querySelector(".fin-ceo-parc-dia")?.value) || 0,
        mes: Number(row.querySelector(".fin-ceo-parc-mes")?.value) || 0,
      }))
      .filter((p) => p.valor > 0 && p.dia >= 1 && p.dia <= 31 && p.mes >= 1 && p.mes <= 12);
  }

  function limparFormDespesa() {
    const cat = document.getElementById("finCeoDespCategoria");
    if (cat) cat.selectedIndex = 0;
    const sub = document.getElementById("finCeoDespSubcategoria");
    if (sub) sub.value = "";
    const val = document.getElementById("finCeoDespValor");
    if (val) val.value = "";
    const rep = document.getElementById("finCeoDespRepeticoes");
    if (rep) rep.value = "12";
    const dt = document.getElementById("finCeoDespDataEvento");
    if (dt) dt.value = fmtBrDate(new Date());
    const per = document.getElementById("finCeoDespPeriodico");
    if (per) per.value = "sim";
    const wrap = document.getElementById("finCeoParcelasAvulsas");
    if (wrap) wrap.innerHTML = "";
    renderParcelasAvulsas();
    togglePeriodicUi();
    renderSubcategoriaDatalist();
    const fb = document.getElementById("finCeoDespFeedback");
    if (fb) fb.textContent = "";
  }

  function renderListaDespesas() {
    const body = document.getElementById("finCeoDespesasBody");
    const vazia = document.getElementById("finCeoDespesasVazia");
    if (!body) return;
    const list = loadDespesasCeo().map(normalizeDespesa);
    if (!list.length) {
      body.innerHTML = "";
      vazia?.classList.remove("hidden");
      return;
    }
    vazia?.classList.add("hidden");
    body.innerHTML = list
      .map((d) => {
        const cat = CATEGORIAS.find((c) => c.id === d.categoria)?.label || d.categoria;
        const det = d.periodic
          ? `${brl(d.valor)} · ${d.repeticoes}× mensal · início ${fmtBrDate(d.dataEvento)}`
          : `${d.parcelas.length} parcela(s) avulsa(s)`;
        return `<tr data-ceo-desp-id="${esc(d.id)}">
          <td>${esc(cat)}</td>
          <td>${esc(d.subcategoria || "—")}</td>
          <td>${d.periodic ? "Sim" : "Não"}</td>
          <td>${esc(det)}</td>
          <td><button type="button" class="btn-primary btn-secondary-outline fin-ceo-desp-excluir" data-id="${esc(d.id)}">Excluir</button></td>
        </tr>`;
      })
      .join("");
  }

  function renderCadastroDespesas() {
    renderSubcategoriaDatalist();
    renderParcelasAvulsas();
    togglePeriodicUi();
    renderListaDespesas();
  }

  function salvarDespesaForm(ev) {
    ev?.preventDefault();
    const fb = document.getElementById("finCeoDespFeedback");
    const categoria = document.getElementById("finCeoDespCategoria")?.value || CATEGORIAS[0].id;
    const subcategoria = String(document.getElementById("finCeoDespSubcategoria")?.value || "").trim();
    const periodic = document.getElementById("finCeoDespPeriodico")?.value === "sim";

    if (!subcategoria) {
      if (fb) fb.textContent = "Informe a subcategoria (descrição).";
      return;
    }

    let entry;
    if (periodic) {
      const valor = parseValor(document.getElementById("finCeoDespValor")?.value);
      const repeticoes = Number(document.getElementById("finCeoDespRepeticoes")?.value) || 0;
      const dataEvento = parseBrDate(document.getElementById("finCeoDespDataEvento")?.value);
      if (valor <= 0) {
        if (fb) fb.textContent = "Informe um valor maior que zero.";
        return;
      }
      if (repeticoes < 1) {
        if (fb) fb.textContent = "Informe o número de repetições.";
        return;
      }
      if (!dataEvento) {
        if (fb) fb.textContent = "Informe a data do evento (DD/MM/AAAA).";
        return;
      }
      entry = normalizeDespesa({ categoria, subcategoria, periodic: true, valor, repeticoes, dataEvento });
    } else {
      const parcelas = lerParcelasDoForm();
      if (!parcelas.length) {
        if (fb) fb.textContent = "Informe ao menos uma parcela com valor, dia e mês.";
        return;
      }
      entry = normalizeDespesa({ categoria, subcategoria, periodic: false, parcelas });
    }

    const list = loadDespesasCeo();
    list.push({
      ...entry,
      dataEvento: entry.dataEvento instanceof Date ? fmtBrDate(entry.dataEvento) : entry.dataEvento,
    });
    saveDespesasCeo(list);
    if (fb) fb.textContent = "Despesa cadastrada.";
    limparFormDespesa();
    renderListaDespesas();
    renderDashboard();
  }

  function excluirDespesa(id) {
    const list = loadDespesasCeo().filter((d) => String(d.id) !== String(id));
    saveDespesasCeo(list);
    renderListaDespesas();
    renderDashboard();
  }

  function abrirPane(id) {
    paneAberto = id || "";
    document.getElementById("finCeoFormPlaceholder")?.classList.toggle("hidden", Boolean(id));
    document.querySelectorAll(".fin-ceo-pane").forEach((p) => {
      p.classList.toggle("hidden", p.getAttribute("data-ceo-pane") !== id);
    });
    document.querySelectorAll("#finCeoModulosNav [data-ceo-mod]").forEach((b) => {
      const on = b.getAttribute("data-ceo-mod") === id;
      b.classList.toggle("is-active", on);
      b.setAttribute("aria-expanded", on ? "true" : "false");
    });
    if (id === "dashboard") renderDashboard();
    if (id === "despesas") renderCadastroDespesas();
  }

  function bindOnce() {
    if (bound) return;
    bound = true;

    document.querySelectorAll("#finCeoModulosNav [data-ceo-mod]").forEach((btn) => {
      btn.addEventListener("click", () => abrirPane(btn.getAttribute("data-ceo-mod") || ""));
    });

    document.getElementById("finCeoDespForm")?.addEventListener("submit", salvarDespesaForm);
    document.getElementById("finCeoDespLimpar")?.addEventListener("click", limparFormDespesa);
    document.getElementById("finCeoDespPeriodico")?.addEventListener("change", togglePeriodicUi);
    document.getElementById("finCeoDespCategoria")?.addEventListener("change", renderSubcategoriaDatalist);
    document.getElementById("finCeoAddParcela")?.addEventListener("click", () => {
      const wrap = document.getElementById("finCeoParcelasAvulsas");
      if (!wrap) return;
      const row = document.createElement("div");
      row.className = "fin-ceo-parcela-row";
      row.innerHTML = `
        <label class="portal-field"><span>Valor (R$)</span><input type="text" class="fin-ceo-parc-valor" inputmode="decimal" placeholder="0,00"></label>
        <label class="portal-field"><span>Dia</span><input type="number" class="fin-ceo-parc-dia" min="1" max="31" placeholder="DD"></label>
        <label class="portal-field"><span>Mês</span><input type="number" class="fin-ceo-parc-mes" min="1" max="12" placeholder="MM"></label>
        <button type="button" class="btn-primary btn-secondary-outline fin-ceo-parc-remover">Remover</button>`;
      wrap.appendChild(row);
      row.querySelector(".fin-ceo-parc-remover")?.addEventListener("click", () => row.remove());
    });

    document.getElementById("finCeoDespesasBody")?.addEventListener("click", (ev) => {
      const btn = ev.target.closest(".fin-ceo-desp-excluir");
      if (!btn) return;
      const id = btn.getAttribute("data-id");
      if (id && window.confirm("Excluir esta despesa?")) excluirDespesa(id);
    });
  }

  window.__DK_financeiroCeoOnShow = function __DK_financeiroCeoOnShow() {
    bindOnce();
    panel.classList.remove("hidden");
    abrirPane("dashboard");
  };

  window.__DK_financeiroCeoReset = function __DK_financeiroCeoReset() {
    paneAberto = "";
    document.getElementById("finCeoFormPlaceholder")?.classList.remove("hidden");
    document.querySelectorAll(".fin-ceo-pane").forEach((p) => p.classList.add("hidden"));
    document.querySelectorAll("#finCeoModulosNav [data-ceo-mod]").forEach((b) => {
      b.classList.remove("is-active");
      b.setAttribute("aria-expanded", "false");
    });
  };

  window.__DK_mergeFinanceiroCeoDespesas = function mergeFinanceiroCeoDespesas(localArr, cloudArr) {
    const map = new Map();
    [...(cloudArr || []), ...(localArr || [])].forEach((raw) => {
      const d = normalizeDespesa(raw);
      map.set(d.id, d);
    });
    return Array.from(map.values());
  };
})();
