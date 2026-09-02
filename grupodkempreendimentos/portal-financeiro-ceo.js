/**
 * FINANCEIRO CEO — cadastro de despesas estratégicas, endividamento e projeção (2 anos).
 * Acesso restrito ao CPF titular (03037897430).
 */
(function portalFinanceiroCeo() {
  const DESPESAS_CEO_KEY = "dk_financeiro_ceo_despesas_v1";
  const CARTOES_CEO_KEY = "dk_financeiro_ceo_cartoes_v1";
  const FONTES_CEO_KEY = "dk_financeiro_ceo_fontes_v1";
  const HORIZONTE_MESES = 24;

  const CATEGORIAS_CEO = [
    { id: "DK_LOCADORA", label: "DK Locadora" },
    { id: "DK_CONSTRUTORA", label: "DK Construtora" },
    { id: "DK_CENTRO_AUTOMOTIVO", label: "DK Centro Automotivo" },
    { id: "PARTICULARES", label: "Particulares" },
  ];

  const RUBRICAS_DK = [
    { id: "ALUGUEL", label: "ALUGUEL" },
    { id: "DESPESAS_MANU", label: "DESPESAS MANU" },
    { id: "CONT_PROP", label: "CONT+PROP" },
    { id: "SEGURO", label: "SEGURO" },
    { id: "ADM", label: "ADM" },
    { id: "IMPOSTO", label: "IMPOSTO" },
    { id: "DOCUMENTOS", label: "DOCUMENTOS" },
    { id: "MULTAS", label: "MULTAS" },
    { id: "SALARIOS", label: "SALARIOS" },
  ];

  const TIPOS_PARTICULARES = [
    { id: "CARTAO_CREDITO", label: "Cartão de crédito", exigeCartao: true },
    { id: "CONTA_ENERGIA", label: "Conta de energia" },
    { id: "CONTA_AGUA", label: "Conta de água" },
    { id: "ALUGUEL", label: "Aluguel" },
    { id: "FINANCIAMENTO_VEICULO", label: "Financiamento de veículo" },
    { id: "FINANCIAMENTO_IMOVEL", label: "Financiamento de imóvel" },
    { id: "CONSORCIO", label: "Consórcio" },
    { id: "EDUCACAO", label: "Educação" },
    { id: "FEIRA", label: "Feira" },
    { id: "PENSAO", label: "Pensão" },
    { id: "SAUDE", label: "Saúde" },
    { id: "INTERNET", label: "Internet" },
    { id: "SEGUROS", label: "Seguros" },
    { id: "OUTROS", label: "Outros" },
  ];

  const LEGADO_CATEGORIA_LABEL = {
    FINANCIAMENTO: "Financiamento",
    CONSORCIO: "Consórcio",
    PESSOAIS: "Pessoais",
    DK_CONSTRUTORA: "DK Construtora",
    DK_OFICINA: "DK Oficina",
    DK_LOCADORA: "DK Locadora",
  };

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

  function slugId(label, prefix) {
    const base = String(label || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 48);
    return base || `${prefix}_${Date.now()}`;
  }

  function isParticulares(catId) {
    return String(catId || "") === "PARTICULARES";
  }

  function isCategoriaDk(catId) {
    return !isParticulares(catId) && CATEGORIAS_CEO.some((c) => c.id === catId && c.id !== "PARTICULARES");
  }

  function labelCategoria(id) {
    return CATEGORIAS_CEO.find((c) => c.id === id)?.label || LEGADO_CATEGORIA_LABEL[id] || String(id || "—");
  }

  function categoriaValida(id) {
    return CATEGORIAS_CEO.some((c) => c.id === id) || Boolean(LEGADO_CATEGORIA_LABEL[id]);
  }

  function labelRubrica(id) {
    return RUBRICAS_DK.find((r) => r.id === id)?.label || String(id || "—");
  }

  function rubricaValida(id) {
    return RUBRICAS_DK.some((r) => r.id === id);
  }

  function labelTipoParticular(id) {
    return TIPOS_PARTICULARES.find((t) => t.id === id)?.label || String(id || "—");
  }

  function tipoParticularValido(id) {
    return TIPOS_PARTICULARES.some((t) => t.id === id);
  }

  function tipoParticularExigeCartao(id) {
    return Boolean(TIPOS_PARTICULARES.find((t) => t.id === id)?.exigeCartao);
  }

  function inferirTipoParticularLegado(d) {
    if (d?.tipoParticular && tipoParticularValido(d.tipoParticular)) return d.tipoParticular;
    if (d?.cartaoCredito) return "CARTAO_CREDITO";
    return TIPOS_PARTICULARES[0].id;
  }

  function normalizeCartao(raw) {
    const label = String(raw?.label || "").trim();
    const id = String(raw?.id || slugId(label, "CARTAO")).trim() || slugId(label, "CARTAO");
    return { id, label: label || id };
  }

  function loadCartoesCeoRaw() {
    try {
      const raw = localStorage.getItem(CARTOES_CEO_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  }

  function saveCartoesCeo(list) {
    const payload = Array.isArray(list) ? list.map(normalizeCartao).filter((c) => c.label) : [];
    try {
      localStorage.setItem(CARTOES_CEO_KEY, JSON.stringify(payload));
    } catch {
      /* ignore */
    }
    if (typeof window.saveCadastro === "function") {
      try {
        window.saveCadastro(CARTOES_CEO_KEY, payload, { bypassImmutabilidadeCadastro: true });
      } catch {
        /* ignore */
      }
    }
    if (typeof window.__DK_pushCloudSnapshotNow === "function") {
      window.__DK_pushCloudSnapshotNow({ force: true }).catch(() => {});
    }
  }

  function migrarFontesLegadoParaCartoes() {
    if (loadCartoesCeoRaw().length) return;
    try {
      const raw = localStorage.getItem(FONTES_CEO_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(arr) || !arr.length) return;
      saveCartoesCeo(arr.map(normalizeCartao));
    } catch {
      /* ignore */
    }
  }

  function getCartoesLista() {
    return loadCartoesCeoRaw()
      .map(normalizeCartao)
      .sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
  }

  function labelCartao(id) {
    return getCartoesLista().find((c) => c.id === id)?.label || String(id || "—");
  }

  function cartaoValido(id) {
    return getCartoesLista().some((c) => c.id === id);
  }

  function contarDespesasPorCartao(cartaoId) {
    return loadDespesasCeo().filter((d) => String(d.cartaoCredito) === String(cartaoId)).length;
  }

  function renderCategoriaSelect() {
    const sel = document.getElementById("finCeoDespCategoria");
    if (!sel) return;
    const atual = sel.value;
    sel.innerHTML = CATEGORIAS_CEO.map((c) => `<option value="${esc(c.id)}">${esc(c.label)}</option>`).join("");
    if (categoriaValida(atual)) sel.value = atual;
    else sel.selectedIndex = 0;
  }

  function renderRubricaSelect() {
    const sel = document.getElementById("finCeoDespRubrica");
    if (!sel) return;
    const atual = sel.value;
    sel.innerHTML = RUBRICAS_DK.map((r) => `<option value="${esc(r.id)}">${esc(r.label)}</option>`).join("");
    if (rubricaValida(atual)) sel.value = atual;
    else sel.selectedIndex = 0;
  }

  function renderTipoParticularSelect() {
    const sel = document.getElementById("finCeoDespTipoParticular");
    if (!sel) return;
    const atual = sel.value;
    sel.innerHTML = TIPOS_PARTICULARES.map((t) => `<option value="${esc(t.id)}">${esc(t.label)}</option>`).join("");
    if (tipoParticularValido(atual)) sel.value = atual;
    else sel.selectedIndex = 0;
  }

  function renderCartaoSelect() {
    const sel = document.getElementById("finCeoDespCartao");
    if (!sel) return;
    const atual = sel.value;
    const cartoes = getCartoesLista();
    if (!cartoes.length) {
      sel.innerHTML = `<option value="">— Cadastre um cartão primeiro —</option>`;
      return;
    }
    sel.innerHTML = cartoes.map((c) => `<option value="${esc(c.id)}">${esc(c.label)}</option>`).join("");
    if (cartaoValido(atual)) sel.value = atual;
    else sel.selectedIndex = 0;
  }

  function toggleTipoParticularUi() {
    const tipo = document.getElementById("finCeoDespTipoParticular")?.value || TIPOS_PARTICULARES[0].id;
    const exigeCartao = tipoParticularExigeCartao(tipo);
    document.getElementById("finCeoWrapCartao")?.classList.toggle("hidden", !exigeCartao);
    const cart = document.getElementById("finCeoDespCartao");
    if (cart) cart.required = exigeCartao;
    const desc = document.getElementById("finCeoDespDescricao");
    const descLab = document.querySelector("#finCeoWrapDescricao span");
    if (descLab) descLab.textContent = exigeCartao ? "Descrição" : "Descrição (opcional)";
    if (desc) desc.placeholder = exigeCartao ? "Ex.: Supermercado, farmácia…" : "Complemento, se necessário…";
  }

  function toggleCategoriaDespesaUi() {
    const cat = document.getElementById("finCeoDespCategoria")?.value || CATEGORIAS_CEO[0].id;
    const particulares = isParticulares(cat);
    document.getElementById("finCeoWrapRubrica")?.classList.toggle("hidden", particulares);
    document.getElementById("finCeoWrapTipoParticular")?.classList.toggle("hidden", !particulares);
    document.getElementById("finCeoWrapDescricao")?.classList.toggle("hidden", !particulares);
    const rub = document.getElementById("finCeoDespRubrica");
    const tipo = document.getElementById("finCeoDespTipoParticular");
    const desc = document.getElementById("finCeoDespDescricao");
    if (rub) rub.required = !particulares;
    if (tipo) tipo.required = particulares;
    if (particulares) {
      toggleTipoParticularUi();
    } else {
      document.getElementById("finCeoWrapCartao")?.classList.add("hidden");
      if (desc) desc.required = false;
    }
  }

  function detalheDespesaLista(d) {
    let tipo;
    let desc;
    if (isParticulares(d.categoria)) {
      const tp = inferirTipoParticularLegado(d);
      tipo = labelTipoParticular(tp);
      const partes = [];
      if (tipoParticularExigeCartao(tp) && d.cartaoCredito) partes.push(labelCartao(d.cartaoCredito));
      if (d.descricao) partes.push(d.descricao);
      desc = partes.length ? partes.join(" · ") : "—";
    } else {
      tipo = labelRubrica(d.rubrica);
      desc = "—";
    }
    const fin = d.periodic
      ? `${brl(d.valor)} · ${d.repeticoes}× · 1ª ${fmtBrDate(d.dataEvento)}`
      : `${d.parcelas?.length || 0} parcela(s) avulsa(s)`;
    return { tipo, desc, fin };
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
    const categoria = categoriaValida(raw?.categoria) ? raw.categoria : CATEGORIAS_CEO[0].id;
    const rubrica = rubricaValida(raw?.rubrica) ? raw.rubrica : rubricaValida(raw?.subcategoria) ? raw.subcategoria : "";
    const tipoParticular = isParticulares(categoria) ? inferirTipoParticularLegado(raw) : "";
    const cartaoCredito =
      isParticulares(categoria) && tipoParticularExigeCartao(tipoParticular) ? String(raw?.cartaoCredito || "").trim() : "";
    const descricao = String(raw?.descricao || raw?.subcategoria || "").trim();
    const subcategoria = isParticulares(categoria)
      ? [labelTipoParticular(tipoParticular), descricao].filter(Boolean).join(" — ")
      : labelRubrica(rubrica);
    const periodic = raw?.periodic !== false;
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
    return { id, categoria, rubrica, tipoParticular, cartaoCredito, descricao, subcategoria, periodic, valor, repeticoes, dataEvento, parcelas };
  }

  function gerarDebitosDespesa(desp, inicioHorizonte, fimHorizonte) {
    const out = [];
    if (desp.periodic) {
      if (desp.valor <= 0) return out;
      // Âncora: data do 1º evento; cada repetição cai no mesmo dia do mês seguinte.
      let dt = startOfDay(desp.dataEvento);
      for (let i = 0; i < desp.repeticoes; i += 1) {
        if (dt >= inicioHorizonte && dt <= fimHorizonte) {
          out.push({ data: new Date(dt), valor: desp.valor, categoria: desp.categoria, subcategoria: desp.subcategoria });
        }
        if (i < desp.repeticoes - 1) dt = addMonths(dt, 1);
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

  function fmtPct(n) {
    if (!Number.isFinite(n)) return "—";
    return `${n.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
  }

  function calcTaxaEndividamento(despesas, receita) {
    const d = Number(despesas) || 0;
    const r = Number(receita) || 0;
    if (r <= 0) return d > 0 ? null : 0;
    return (d / r) * 100;
  }

  function classificarTaxaEndividamento(taxa) {
    if (!Number.isFinite(taxa)) return "crit";
    if (taxa <= 60) return "ok";
    if (taxa <= 85) return "warn";
    return "crit";
  }

  function aplicarClasseKpi(box, nivel) {
    if (!box) return;
    box.classList.remove("fin-kpi--ok", "fin-kpi--warn", "fin-kpi--crit");
    if (nivel) box.classList.add(`fin-kpi--${nivel}`);
  }

  function compromissoMesRef(proj, refDate) {
    const k = monthKey(refDate);
    return proj.debPorMes.get(k) || 0;
  }

  function receitaMesRef(proj, refDate) {
    const k = monthKey(refDate);
    return proj.recPorMes.get(k) || 0;
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
    const taxaMesAtual = calcTaxaEndividamento(endivMesAtual, receitaMesAtual);
    const capacidadeLivre = receitaMesAtual - endivMesAtual;

    return {
      meses,
      debPorMes,
      recPorMes,
      saldoMes,
      saldoAcc,
      endivMesAtual,
      receitaMesAtual,
      taxaMesAtual,
      capacidadeLivre,
      debitos,
      totalDespesasCadastradas: despesas.length,
    };
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

    const kpiDesp = document.getElementById("finCeoKpiDespesas");
    const kpiReceita = document.getElementById("finCeoKpiReceita");
    const kpiEndiv = document.getElementById("finCeoKpiEndividamento");
    const kpiMargem = document.getElementById("finCeoKpiCapacidadeLivre");
    const kpiEndivHint = document.getElementById("finCeoKpiEndividamentoHint");
    const dashAlert = document.getElementById("finCeoDashAlert");

    if (kpiDesp) kpiDesp.textContent = brl(proj.endivMesAtual);
    if (kpiReceita) kpiReceita.textContent = brl(proj.receitaMesAtual);
    if (kpiMargem) kpiMargem.textContent = brl(proj.capacidadeLivre);

    if (kpiEndiv) {
      if (proj.receitaMesAtual <= 0 && proj.endivMesAtual > 0) {
        kpiEndiv.textContent = "—";
        if (kpiEndivHint) kpiEndivHint.textContent = "sem receita prevista no mês";
      } else if (proj.endivMesAtual <= 0 && proj.totalDespesasCadastradas === 0) {
        kpiEndiv.textContent = "0%";
        if (kpiEndivHint) kpiEndivHint.textContent = "cadastre as despesas";
      } else {
        kpiEndiv.textContent = fmtPct(proj.taxaMesAtual);
        if (kpiEndivHint) kpiEndivHint.textContent = "despesas ÷ receita";
      }
    }

    const nivelTaxa = classificarTaxaEndividamento(proj.taxaMesAtual);
    aplicarClasseKpi(document.getElementById("finCeoKpiBoxTaxa"), nivelTaxa);
    aplicarClasseKpi(
      document.getElementById("finCeoKpiBoxMargem"),
      proj.capacidadeLivre < 0 ? "crit" : proj.capacidadeLivre > 0 ? "ok" : "warn"
    );

    if (dashAlert) {
      if (proj.totalDespesasCadastradas === 0) {
        dashAlert.classList.remove("hidden", "fin-ceo-dash-alert--warn", "fin-ceo-dash-alert--ok");
        dashAlert.classList.add("fin-ceo-dash-alert--info");
        dashAlert.textContent =
          "Objetivo 01: cadastre despesas por categoria (DK Locadora, Construtora, Centro Automotivo ou Particulares) para calcular o endividamento face à receita prevista.";
      } else if (proj.taxaMesAtual === null) {
        dashAlert.classList.remove("hidden", "fin-ceo-dash-alert--info", "fin-ceo-dash-alert--ok");
        dashAlert.classList.add("fin-ceo-dash-alert--warn");
        dashAlert.textContent = `Há ${proj.totalDespesasCadastradas} despesa(s) cadastrada(s), mas a receita prevista do mês está zerada — verifique as locações ativas.`;
      } else if (proj.taxaMesAtual > 85) {
        dashAlert.classList.remove("hidden", "fin-ceo-dash-alert--info", "fin-ceo-dash-alert--ok");
        dashAlert.classList.add("fin-ceo-dash-alert--warn");
        dashAlert.textContent = `Endividamento elevado (${fmtPct(proj.taxaMesAtual)}): compromissos consomem quase toda a receita prevista.`;
      } else if (proj.capacidadeLivre < 0) {
        dashAlert.classList.remove("hidden", "fin-ceo-dash-alert--info", "fin-ceo-dash-alert--ok");
        dashAlert.classList.add("fin-ceo-dash-alert--warn");
        dashAlert.textContent = `Déficit de ${brl(Math.abs(proj.capacidadeLivre))} neste mês — despesas superam a receita prevista.`;
      } else {
        dashAlert.classList.remove("hidden", "fin-ceo-dash-alert--warn", "fin-ceo-dash-alert--info");
        dashAlert.classList.add("fin-ceo-dash-alert--ok");
        dashAlert.textContent = `${proj.totalDespesasCadastradas} despesa(s) cadastrada(s) · taxa ${fmtPct(proj.taxaMesAtual)} · capacidade livre ${brl(proj.capacidadeLivre)}.`;
      }
    }

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
      const head = `<tr><th>Mês</th><th>Despesas</th><th>Receita prevista</th><th>Taxa endiv.</th><th>Saldo mês</th><th>Saldo acumulado</th></tr>`;
      const body = proj.meses
        .map((m, i) => {
          const deb = proj.debPorMes.get(m.key) || 0;
          const rec = proj.recPorMes.get(m.key) || 0;
          const taxa = calcTaxaEndividamento(deb, rec);
          const taxaTxt = rec <= 0 && deb > 0 ? "—" : fmtPct(taxa);
          return `<tr><td>${esc(m.label)}</td><td>${esc(brl(deb))}</td><td>${esc(brl(rec))}</td><td>${esc(taxaTxt)}</td><td>${esc(brl(proj.saldoMes[i] || 0))}</td><td>${esc(brl(proj.saldoAcc[i] || 0))}</td></tr>`;
        })
        .join("");
      tab.innerHTML = `<table class="fin-table"><thead>${head}</thead><tbody>${body}</tbody></table>`;
    }
  }

  function renderResumoCadastroDespesas() {
    const el = document.getElementById("finCeoDespResumo");
    if (!el) return;
    const list = loadDespesasCeo();
    if (!list.length) {
      el.textContent = "Nenhuma despesa cadastrada — escolha a categoria e lance os compromissos abaixo.";
      return;
    }
    const proj = buildProjecao24Meses();
    const hoje = startOfDay(new Date());
    const debMes = compromissoMesRef(proj, hoje);
    const recMes = receitaMesRef(proj, hoje);
    const taxa = calcTaxaEndividamento(debMes, recMes);
    const taxaTxt = recMes <= 0 && debMes > 0 ? "sem receita no mês" : `taxa ${fmtPct(taxa)}`;
    el.textContent = `${list.length} despesa(s) cadastrada(s) · compromissos deste mês: ${brl(debMes)} · receita prevista: ${brl(recMes)} · ${taxaTxt}.`;
  }

  function limparFormDespesa() {
    renderCategoriaSelect();
    renderRubricaSelect();
    renderTipoParticularSelect();
    renderCartaoSelect();
    toggleCategoriaDespesaUi();
    const desc = document.getElementById("finCeoDespDescricao");
    if (desc) desc.value = "";
    const val = document.getElementById("finCeoDespValor");
    if (val) val.value = "";
    const rep = document.getElementById("finCeoDespRepeticoes");
    if (rep) rep.value = "12";
    const dt = document.getElementById("finCeoDespDataEvento");
    if (dt) dt.value = fmtBrDate(new Date());
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
        const { tipo, desc, fin } = detalheDespesaLista(d);
        return `<tr data-ceo-desp-id="${esc(d.id)}">
          <td>${esc(labelCategoria(d.categoria))}</td>
          <td>${esc(tipo)}</td>
          <td>${esc(desc)}</td>
          <td>${esc(fin)}</td>
          <td><button type="button" class="btn-primary btn-secondary-outline fin-ceo-desp-excluir" data-id="${esc(d.id)}">Excluir</button></td>
        </tr>`;
      })
      .join("");
  }

  function renderListaCartoes() {
    const body = document.getElementById("finCeoCartoesBody");
    const vazia = document.getElementById("finCeoCartoesVazia");
    if (!body) return;
    const cartoes = getCartoesLista();
    if (!cartoes.length) {
      body.innerHTML = "";
      vazia?.classList.remove("hidden");
      return;
    }
    vazia?.classList.add("hidden");
    body.innerHTML = cartoes
      .map((c) => {
        const n = contarDespesasPorCartao(c.id);
        const uso = n ? `${n} despesa(s)` : "sem despesas";
        return `<tr data-ceo-cartao-id="${esc(c.id)}">
          <td>${esc(c.label)}</td>
          <td><code>${esc(c.id)}</code></td>
          <td>${esc(uso)}</td>
          <td><button type="button" class="btn-primary btn-secondary-outline fin-ceo-cartao-excluir" data-id="${esc(c.id)}" ${n ? "disabled title=\"Remova as despesas deste cartão primeiro\"" : ""}>Excluir</button></td>
        </tr>`;
      })
      .join("");
  }

  function renderCadastroCartoes() {
    renderListaCartoes();
    const fb = document.getElementById("finCeoCartaoFeedback");
    if (fb) fb.textContent = "";
  }

  function salvarCartaoForm(ev) {
    ev?.preventDefault();
    const fb = document.getElementById("finCeoCartaoFeedback");
    const nome = String(document.getElementById("finCeoCartaoNome")?.value || "").trim();
    if (!nome) {
      if (fb) fb.textContent = "Informe o nome do cartão de crédito.";
      return;
    }
    const id = slugId(nome, "CARTAO");
    const list = loadCartoesCeoRaw().map(normalizeCartao);
    if (list.some((c) => c.id === id || c.label.toLowerCase() === nome.toLowerCase())) {
      if (fb) fb.textContent = "Já existe um cartão com este nome.";
      return;
    }
    list.push(normalizeCartao({ id, label: nome }));
    saveCartoesCeo(list);
    const inp = document.getElementById("finCeoCartaoNome");
    if (inp) inp.value = "";
    if (fb) fb.textContent = `Cartão «${nome}» cadastrado.`;
    renderListaCartoes();
    renderCartaoSelect();
  }

  function excluirCartao(id) {
    const n = contarDespesasPorCartao(id);
    if (n > 0) {
      window.alert(`Este cartão tem ${n} despesa(s) vinculada(s). Exclua-as antes de remover o cartão.`);
      return;
    }
    if (!window.confirm("Excluir este cartão de crédito?")) return;
    const list = loadCartoesCeoRaw().filter((c) => String(c.id) !== String(id));
    saveCartoesCeo(list);
    renderListaCartoes();
    renderCartaoSelect();
  }

  function renderCadastroDespesas() {
    renderCategoriaSelect();
    renderRubricaSelect();
    renderTipoParticularSelect();
    renderCartaoSelect();
    toggleCategoriaDespesaUi();
    renderResumoCadastroDespesas();
    renderListaDespesas();
    const dt = document.getElementById("finCeoDespDataEvento");
    if (dt && !String(dt.value || "").trim()) dt.value = fmtBrDate(new Date());
    if (typeof window.bindDateMasksInContainer === "function") {
      window.bindDateMasksInContainer(document.getElementById("finCeoCamposPeriodico") || panel);
    }
  }

  function salvarDespesaForm(ev) {
    ev?.preventDefault();
    const fb = document.getElementById("finCeoDespFeedback");
    const categoria = document.getElementById("finCeoDespCategoria")?.value || CATEGORIAS_CEO[0].id;
    const rubrica = document.getElementById("finCeoDespRubrica")?.value || "";
    const tipoParticular = document.getElementById("finCeoDespTipoParticular")?.value || "";
    const cartaoCredito = document.getElementById("finCeoDespCartao")?.value || "";
    const descricao = String(document.getElementById("finCeoDespDescricao")?.value || "").trim();

    if (isParticulares(categoria)) {
      if (!tipoParticularValido(tipoParticular)) {
        if (fb) fb.textContent = "Selecione o tipo de despesa.";
        return;
      }
      if (tipoParticularExigeCartao(tipoParticular)) {
        if (!cartaoCredito || !cartaoValido(cartaoCredito)) {
          if (fb) fb.textContent = "Cadastre e selecione o cartão de crédito (módulo Cartões de crédito).";
          return;
        }
        if (!descricao) {
          if (fb) fb.textContent = "Informe a descrição da despesa no cartão.";
          return;
        }
      } else if (tipoParticular === "OUTROS" && !descricao) {
        if (fb) fb.textContent = "Informe a descrição para o tipo «Outros».";
        return;
      }
    } else if (!rubricaValida(rubrica)) {
      if (fb) fb.textContent = "Selecione a rubrica da despesa.";
      return;
    }

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
      if (fb) fb.textContent = "Informe a data da primeira repetição (DD/MM/AAAA).";
      return;
    }

    const entry = normalizeDespesa({
      categoria,
      rubrica: isParticulares(categoria) ? "" : rubrica,
      tipoParticular: isParticulares(categoria) ? tipoParticular : "",
      cartaoCredito: isParticulares(categoria) && tipoParticularExigeCartao(tipoParticular) ? cartaoCredito : "",
      descricao: isParticulares(categoria) ? descricao : "",
      periodic: true,
      valor,
      repeticoes,
      dataEvento,
    });

    const list = loadDespesasCeo();
    list.push({
      ...entry,
      dataEvento: entry.dataEvento instanceof Date ? fmtBrDate(entry.dataEvento) : entry.dataEvento,
    });
    saveDespesasCeo(list);
    if (fb) fb.textContent = "Despesa cadastrada.";
    limparFormDespesa();
    renderListaDespesas();
    renderResumoCadastroDespesas();
    renderDashboard();
  }

  function excluirDespesa(id) {
    const list = loadDespesasCeo().filter((d) => String(d.id) !== String(id));
    saveDespesasCeo(list);
    renderListaDespesas();
    renderResumoCadastroDespesas();
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
    if (id === "cartoes") renderCadastroCartoes();
    if (id === "despesas") renderCadastroDespesas();
  }

  function bindOnce() {
    if (bound) return;
    bound = true;

    document.querySelectorAll("#finCeoModulosNav [data-ceo-mod]").forEach((btn) => {
      btn.addEventListener("click", () => abrirPane(btn.getAttribute("data-ceo-mod") || ""));
    });

    document.getElementById("finCeoCartaoForm")?.addEventListener("submit", salvarCartaoForm);
    document.getElementById("finCeoCartoesBody")?.addEventListener("click", (ev) => {
      const btn = ev.target.closest(".fin-ceo-cartao-excluir");
      if (!btn || btn.disabled) return;
      const id = btn.getAttribute("data-id");
      if (id) excluirCartao(id);
    });

    document.getElementById("finCeoDespForm")?.addEventListener("submit", salvarDespesaForm);
    document.getElementById("finCeoDespLimpar")?.addEventListener("click", limparFormDespesa);
    document.getElementById("finCeoDespCategoria")?.addEventListener("change", () => {
      toggleCategoriaDespesaUi();
    });
    document.getElementById("finCeoDespTipoParticular")?.addEventListener("change", () => {
      toggleTipoParticularUi();
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
    migrarFontesLegadoParaCartoes();
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

  window.__DK_mergeFinanceiroCeoCartoes = function mergeFinanceiroCeoCartoes(localArr, cloudArr) {
    const map = new Map();
    [...(cloudArr || []), ...(localArr || [])].forEach((raw) => {
      const c = normalizeCartao(raw);
      if (c.label) map.set(c.id, c);
    });
    return Array.from(map.values());
  };

  window.__DK_mergeFinanceiroCeoFontes = window.__DK_mergeFinanceiroCeoCartoes;

  window.__DK_mergeFinanceiroCeoDespesas = function mergeFinanceiroCeoDespesas(localArr, cloudArr) {
    const map = new Map();
    [...(cloudArr || []), ...(localArr || [])].forEach((raw) => {
      const d = normalizeDespesa(raw);
      map.set(d.id, d);
    });
    return Array.from(map.values());
  };
})();
