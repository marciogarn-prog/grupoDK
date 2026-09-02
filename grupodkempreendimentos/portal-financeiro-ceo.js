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
  let ultimaDespesaSalvaId = "";
  let finCeoDespConfirmPending = null;

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
      sel.innerHTML = `<option value="">— Nenhum cartão disponível —</option>`;
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
    const hint = document.getElementById("finCeoDespDetalheHint");
    if (descLab) descLab.textContent = exigeCartao ? "Descrição" : "Detalhe da despesa";
    if (desc) {
      desc.placeholder = exigeCartao
        ? "Ex.: Supermercado, farmácia…"
        : "Ex.: Parcela moto, conta de luz, complemento…";
      desc.required = exigeCartao || tipo === "OUTROS";
    }
    if (hint) {
      hint.textContent = exigeCartao
        ? "Obrigatório para lançamento no cartão."
        : "Opcional — identifica quem ou o quê da despesa (coluna Detalhe na tabela).";
    }
  }

  function toggleCategoriaDespesaUi() {
    const cat = document.getElementById("finCeoDespCategoria")?.value || CATEGORIAS_CEO[0].id;
    const particulares = isParticulares(cat);
    document.getElementById("finCeoWrapRubrica")?.classList.toggle("hidden", particulares);
    document.getElementById("finCeoWrapTipoParticular")?.classList.toggle("hidden", !particulares);
    document.getElementById("finCeoWrapDescricao")?.classList.remove("hidden");
    const rub = document.getElementById("finCeoDespRubrica");
    const tipo = document.getElementById("finCeoDespTipoParticular");
    const desc = document.getElementById("finCeoDespDescricao");
    const descLab = document.querySelector("#finCeoWrapDescricao span");
    const hint = document.getElementById("finCeoDespDetalheHint");
    if (rub) rub.required = !particulares;
    if (tipo) tipo.required = particulares;
    if (particulares) {
      toggleTipoParticularUi();
    } else {
      document.getElementById("finCeoWrapCartao")?.classList.add("hidden");
      if (descLab) descLab.textContent = "Detalhe da despesa";
      if (desc) {
        desc.placeholder = "Ex.: Nome do funcionário (salários), imóvel ou contrato (aluguel)…";
        desc.required = false;
      }
      if (hint) {
        hint.textContent = "Opcional — ex.: nome do funcionário em salários (coluna Detalhe na tabela).";
      }
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
      desc = d.descricao ? String(d.descricao).trim() : "—";
    }
    const fin = d.periodic
      ? `${brl(d.valor)} · ${d.repeticoes}× · 1ª ${fmtBrDate(d.dataEvento)}`
      : `${d.parcelas?.length || 0} parcela(s) avulsa(s)`;
    return { tipo, desc, fin };
  }

  function loadDespesasCeo() {
    const map = new Map();
    const ingest = (arr) => {
      if (!Array.isArray(arr)) return;
      arr.forEach((raw) => {
        const d = normalizeDespesa(raw);
        map.set(d.id, {
          ...raw,
          id: d.id,
          categoria: d.categoria,
          rubrica: d.rubrica,
          tipoParticular: d.tipoParticular,
          cartaoCredito: d.cartaoCredito,
          descricao: d.descricao,
          periodic: d.periodic,
          valor: d.valor,
          repeticoes: d.repeticoes,
          dataEvento: d.dataEvento instanceof Date ? fmtBrDate(d.dataEvento) : raw?.dataEvento || fmtBrDate(d.dataEvento),
          cadastradoEm: d.cadastradoEm || raw?.cadastradoEm || "",
        });
      });
    };
    if (typeof window.loadCadastro === "function") {
      try {
        ingest(window.loadCadastro(DESPESAS_CEO_KEY));
      } catch {
        /* ignore */
      }
    }
    try {
      const raw = localStorage.getItem(DESPESAS_CEO_KEY);
      ingest(raw ? JSON.parse(raw) : []);
    } catch {
      /* ignore */
    }
    return Array.from(map.values());
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
      : [labelRubrica(rubrica), descricao].filter(Boolean).join(" — ");
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
    return { id, categoria, rubrica, tipoParticular, cartaoCredito, descricao, subcategoria, periodic, valor, repeticoes, dataEvento, parcelas, cadastradoEm: cadastradoEmDespesa(raw, id) };
  }

  function extrairTsDoId(id) {
    const m = String(id).match(/ceo-desp-(\d+)/);
    return m ? Number(m[1]) : 0;
  }

  function cadastradoEmDespesa(raw, id) {
    const explicit = String(raw?.cadastradoEm || "").trim();
    if (explicit) return explicit;
    const ts = extrairTsDoId(id);
    return ts ? new Date(ts).toISOString() : "";
  }

  function ordenarDespesasRecentes(list) {
    return [...list].sort((a, b) => {
      const ta = Date.parse(a.cadastradoEm) || extrairTsDoId(a.id) || 0;
      const tb = Date.parse(b.cadastradoEm) || extrairTsDoId(b.id) || 0;
      return tb - ta;
    });
  }

  function bindCalendariosCeo(root) {
    const el = root || panel;
    if (!el) return;
    if (typeof window.bindDkIntervaloCalendarios === "function") {
      window.bindDkIntervaloCalendarios(el);
    }
    if (typeof window.bindDateMasksInContainer === "function") {
      window.bindDateMasksInContainer(el);
    }
  }

  function bindMascarasCeo(root) {
    const el = root || panel;
    bindCalendariosCeo(el);
    if (!el || typeof window.bindCurrencyMaskInput !== "function") return;
    el.querySelectorAll('[data-dk-mask="currency"]').forEach((inp) => window.bindCurrencyMaskInput(inp));
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

  const LOCACOES_CEO_KEY = "dk_locacoes_cadastro";
  const PROTOCOLO_TESTE_CEO = "2099010199";

  function protocoloLocacaoDigits(loc) {
    return String(loc?.numeroContrato || loc?.protocolo || "").replace(/\D/g, "");
  }

  function locacaoExcluidaReceitaCeo(loc) {
    if (!loc || typeof loc !== "object") return true;
    const isGhost =
      typeof window.__DK_isLocacaoFantasmaCadastro === "function"
        ? window.__DK_isLocacaoFantasmaCadastro
        : () => false;
    if (isGhost(loc)) return true;
    if (protocoloLocacaoDigits(loc) === PROTOCOLO_TESTE_CEO) return true;
    return false;
  }

  function carregarLocacoes() {
    const key =
      typeof window.CAD_LOCACOES_KEY === "string" ? window.CAD_LOCACOES_KEY : LOCACOES_CEO_KEY;
    let arr = [];
    if (typeof window.loadCadastro === "function") {
      try {
        arr = window.loadCadastro(key) || [];
      } catch {
        arr = [];
      }
    } else {
      try {
        const raw = localStorage.getItem(key);
        arr = raw ? JSON.parse(raw) : [];
        if (!Array.isArray(arr)) arr = [];
        if (typeof window.__DK_filterOficialCadastroArray === "function") {
          arr = window.__DK_filterOficialCadastroArray(key, arr);
        }
      } catch {
        arr = [];
      }
    }
    return arr.filter((loc) => !locacaoExcluidaReceitaCeo(loc));
  }

  function diasNoMes(ano, mes) {
    const y = Number.isFinite(ano) ? ano : new Date().getFullYear();
    const m = Number.isFinite(mes) ? mes : new Date().getMonth();
    return new Date(y, m + 1, 0).getDate();
  }

  /** Soma semanal (valorLocacao + valorInvestimento) das locações ativas — mesma regra do portal. */
  function receitaSemanalLocadora(locs) {
    let total = 0;
    (locs || []).forEach((loc) => {
      if (locacaoExcluidaReceitaCeo(loc)) return;
      if (!locacaoEstaAtiva(loc)) return;
      const sem = valorSemanalContrato(loc);
      if (sem > 0) total += sem;
    });
    return total;
  }

  /** Receita mensal da Locadora: total semanal ÷ 7 × dias do mês (30, 31, 28 ou 29). */
  function receitaSemanalParaMensal(semanal, ano, mes) {
    const sem = Number(semanal) || 0;
    if (sem <= 0) return 0;
    return (sem / 7) * diasNoMes(ano, mes);
  }

  function receitaPrevistaLocadora(locs, ano, mes) {
    const y = Number.isFinite(ano) ? ano : new Date().getFullYear();
    const m = Number.isFinite(mes) ? mes : new Date().getMonth();
    return receitaSemanalParaMensal(receitaSemanalLocadora(locs), y, m);
  }

  const UNIDADE_FIN_KEY = "dk_unidade_financeiro_v1";

  function carregarUnidadeFinanceiro() {
    const key =
      typeof window.__DK_unidadeFinanceiroKey === "string" ? window.__DK_unidadeFinanceiroKey : UNIDADE_FIN_KEY;
    let arr = [];
    if (typeof window.loadCadastro === "function") {
      try {
        arr = window.loadCadastro(key) || [];
      } catch {
        arr = [];
      }
    } else {
      try {
        const raw = localStorage.getItem(key);
        arr = raw ? JSON.parse(raw) : [];
        if (!Array.isArray(arr)) arr = [];
      } catch {
        arr = [];
      }
    }
    return arr;
  }

  /** Soma receitas cadastradas no mês (dk_unidade_financeiro_v1) para a unidade. */
  function receitaPrevistaUnidadeMes(unit, ano, mes, rows) {
    let total = 0;
    (rows || []).forEach((r) => {
      if (r?.unit !== unit || r?.tipo !== "receita") return;
      const dt = parseBrDate(r.data);
      if (!dt || dt.getFullYear() !== ano || dt.getMonth() !== mes) return;
      total += Math.abs(parseValor(r.valor));
    });
    return total;
  }

  function receitaPrevistaCentroAutomotivo(ano, mes, uniRows) {
    const y = Number.isFinite(ano) ? ano : new Date().getFullYear();
    const m = Number.isFinite(mes) ? mes : new Date().getMonth();
    return receitaPrevistaUnidadeMes("centro", y, m, uniRows ?? carregarUnidadeFinanceiro());
  }

  function receitaPrevistaConstrutora(ano, mes, uniRows) {
    const y = Number.isFinite(ano) ? ano : new Date().getFullYear();
    const m = Number.isFinite(mes) ? mes : new Date().getMonth();
    return receitaPrevistaUnidadeMes("construtora", y, m, uniRows ?? carregarUnidadeFinanceiro());
  }

  function calcReceitasPorUnidade(locs, ano, mes, uniRows) {
    const y = Number.isFinite(ano) ? ano : new Date().getFullYear();
    const m = Number.isFinite(mes) ? mes : new Date().getMonth();
    const rows = uniRows ?? carregarUnidadeFinanceiro();
    const locadora = receitaPrevistaLocadora(locs, y, m);
    const centro = receitaPrevistaCentroAutomotivo(y, m, rows);
    const construtora = receitaPrevistaConstrutora(y, m, rows);
    return { locadora, centro, construtora, total: locadora + centro + construtora };
  }

  function receitaPrevistaMes(ano, mes, locs, uniRows) {
    return calcReceitasPorUnidade(locs, ano, mes, uniRows).total;
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
    const uniRows = carregarUnidadeFinanceiro();

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
      recPorMes.set(m.key, receitaPrevistaMes(m.date.getFullYear(), m.date.getMonth(), locs, uniRows));
    });

    const saldoMes = meses.map((m) => (recPorMes.get(m.key) || 0) - (debPorMes.get(m.key) || 0));
    let acc = 0;
    const saldoAcc = saldoMes.map((s) => {
      acc += s;
      return acc;
    });

    const endivMesAtual = debPorMes.get(monthKey(hoje)) || debPorMes.get(monthKey(inicio)) || 0;
    const receitasUnidade = calcReceitasPorUnidade(locs, hoje.getFullYear(), hoje.getMonth(), uniRows);
    const receitaMesAtual = receitasUnidade.total;
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
      receitasUnidade,
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

    const kpiRecLoc = document.getElementById("finCeoKpiReceitaLocadora");
    const kpiRecCentro = document.getElementById("finCeoKpiReceitaCentro");
    const kpiRecConstr = document.getElementById("finCeoKpiReceitaConstrutora");
    const recUn = proj.receitasUnidade || { locadora: 0, centro: 0, construtora: 0, total: 0 };

    if (kpiDesp) kpiDesp.textContent = brl(proj.endivMesAtual);
    if (kpiReceita) kpiReceita.textContent = brl(proj.receitaMesAtual);
    if (kpiRecLoc) kpiRecLoc.textContent = brl(recUn.locadora);
    if (kpiRecCentro) kpiRecCentro.textContent = brl(recUn.centro);
    if (kpiRecConstr) kpiRecConstr.textContent = brl(recUn.construtora);
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
    const wrap = document.getElementById("finCeoDespesasTableWrap");
    if (!body) return;
    const list = ordenarDespesasRecentes(loadDespesasCeo().map(normalizeDespesa));
    if (!list.length) {
      body.innerHTML =
        '<tr><td colspan="7" class="fin-ceo-desp-lista__vazia">Nenhuma despesa cadastrada — preencha o formulário acima e clique em <strong>Cadastrar despesa</strong>.</td></tr>';
      wrap?.classList.remove("fin-ceo-desp-lista--com-dados");
      return;
    }
    wrap?.classList.add("fin-ceo-desp-lista--com-dados");
    const rows = [];
    list.forEach((d) => {
      const pagos = expandirPagamentosDespesa(d, d.repeticoes);
      const { tipo, desc } = detalheDespesaLista(d);
      pagos.forEach((p, idx) => {
        rows.push({ d, p, tipo, desc, primeiro: idx === 0 });
      });
    });
    body.innerHTML = rows
      .map(({ d, p, tipo, desc, primeiro }) => {
        const rotulo = `PAGAMENTO ${String(p.numero).padStart(2, "0")}`;
        const excluir = primeiro
          ? `<button type="button" class="btn-primary btn-secondary-outline fin-ceo-desp-excluir" data-id="${esc(d.id)}">Excluir</button>`
          : "";
        return `<tr data-ceo-desp-id="${esc(d.id)}" data-ceo-pag="${p.numero}">
          <td><strong>${esc(rotulo)}</strong></td>
          <td>${esc(fmtBrDate(p.data))}</td>
          <td>${esc(brl(p.valor))}</td>
          <td>${esc(labelCategoria(d.categoria))}</td>
          <td>${esc(tipo)}</td>
          <td>${esc(desc)}</td>
          <td>${excluir}</td>
        </tr>`;
      })
      .join("");
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
    bindMascarasCeo(document.getElementById("finCeoPaneDespesas"));
  }

  function coletarEntryDespesaForm(fb) {
    const categoria = document.getElementById("finCeoDespCategoria")?.value || CATEGORIAS_CEO[0].id;
    const rubrica = document.getElementById("finCeoDespRubrica")?.value || "";
    const tipoParticular = document.getElementById("finCeoDespTipoParticular")?.value || "";
    const cartaoCredito = document.getElementById("finCeoDespCartao")?.value || "";
    const descricao = String(document.getElementById("finCeoDespDescricao")?.value || "").trim();

    if (isParticulares(categoria)) {
      if (!tipoParticularValido(tipoParticular)) {
        if (fb) fb.textContent = "Selecione o tipo de despesa.";
        return null;
      }
      if (tipoParticularExigeCartao(tipoParticular)) {
        if (!cartaoCredito || !cartaoValido(cartaoCredito)) {
          if (fb) fb.textContent = "Selecione um cartão de crédito cadastrado.";
          return null;
        }
        if (!descricao) {
          if (fb) fb.textContent = "Informe a descrição da despesa no cartão.";
          return null;
        }
      } else if (tipoParticular === "OUTROS" && !descricao) {
        if (fb) fb.textContent = "Informe a descrição para o tipo «Outros».";
        return null;
      }
    } else if (!rubricaValida(rubrica)) {
      if (fb) fb.textContent = "Selecione a rubrica da despesa.";
      return null;
    }

    const valor = parseValor(document.getElementById("finCeoDespValor")?.value);
    const repeticoes = Number(document.getElementById("finCeoDespRepeticoes")?.value) || 0;
    const dataEvento = parseBrDate(document.getElementById("finCeoDespDataEvento")?.value);
    if (valor <= 0) {
      if (fb) fb.textContent = "Informe um valor maior que zero.";
      return null;
    }
    if (repeticoes < 1) {
      if (fb) fb.textContent = "Informe o número de repetições.";
      return null;
    }
    if (!dataEvento) {
      if (fb) fb.textContent = "Informe a data da primeira repetição (DD/MM/AAAA).";
      return null;
    }

    return normalizeDespesa({
      categoria,
      rubrica: isParticulares(categoria) ? "" : rubrica,
      tipoParticular: isParticulares(categoria) ? tipoParticular : "",
      cartaoCredito: isParticulares(categoria) && tipoParticularExigeCartao(tipoParticular) ? cartaoCredito : "",
      descricao,
      periodic: true,
      valor,
      repeticoes,
      dataEvento,
      cadastradoEm: new Date().toISOString(),
    });
  }

  function montarHtmlResumoDespesaConfirm(entry) {
    const { tipo, desc } = detalheDespesaLista(entry);
    const pagos = expandirPagamentosDespesa(entry, entry.repeticoes);
    const total = pagos.reduce((s, p) => s + (Number(p.valor) || 0), 0);
    const linhasDetalhe = [
      ["Categoria", labelCategoria(entry.categoria)],
      ["Rubrica / tipo", tipo],
    ];
    if (desc && desc !== "—") {
      linhasDetalhe.push(["Detalhe", desc]);
    }
    linhasDetalhe.push(
      ["Valor por mês", brl(entry.valor)],
      ["Repetições", String(entry.repeticoes)],
      ["1ª data", fmtBrDate(entry.dataEvento)],
      ["Total do compromisso", brl(total)]
    );
    const dl = linhasDetalhe
      .map(
        ([k, v]) =>
          `<div class="fin-ceo-desp-confirm-kv"><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`
      )
      .join("");
    const rows = pagos
      .map(
        (p) =>
          `<tr><td>PAGAMENTO ${String(p.numero).padStart(2, "0")}</td><td>${esc(fmtBrDate(p.data))}</td><td>${esc(brl(p.valor))}</td></tr>`
      )
      .join("");
    return `<dl class="fin-ceo-desp-confirm-dl">${dl}</dl>
      <h4 class="fin-ceo-desp-confirm-subh">Parcelas mensais</h4>
      <div class="fin-table-wrap fin-ceo-desp-confirm-table-wrap">
        <table class="fin-table fin-ceo-desp-confirm-table">
          <thead><tr><th>Pagamento</th><th>Data</th><th>Valor</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }

  function fecharModalConfirmDespesa() {
    finCeoDespConfirmPending = null;
    const modal = document.getElementById("finCeoDespConfirmModal");
    if (modal) {
      modal.classList.add("hidden");
      modal.setAttribute("aria-hidden", "true");
    }
  }

  function abrirModalConfirmDespesa(entry) {
    finCeoDespConfirmPending = entry;
    const resumo = document.getElementById("finCeoDespConfirmResumo");
    if (resumo) resumo.innerHTML = montarHtmlResumoDespesaConfirm(entry);
    const modal = document.getElementById("finCeoDespConfirmModal");
    if (!modal) {
      persistirDespesaEntry(entry);
      return;
    }
    modal.classList.remove("hidden");
    modal.setAttribute("aria-hidden", "false");
    document.getElementById("finCeoDespConfirmSimBtn")?.focus();
  }

  function persistirDespesaEntry(entry) {
    const fb = document.getElementById("finCeoDespFeedback");
    const list = loadDespesasCeo();
    list.push({
      ...entry,
      cadastradoEm: entry.cadastradoEm,
      dataEvento: entry.dataEvento instanceof Date ? fmtBrDate(entry.dataEvento) : entry.dataEvento,
    });
    ultimaDespesaSalvaId = entry.id;
    saveDespesasCeo(list);
    const pagos = expandirPagamentosDespesa(entry, entry.repeticoes);
    if (fb) {
      fb.textContent = `Despesa cadastrada — ${pagos.length} pagamento(s) de ${brl(entry.valor)} (1ª ${fmtBrDate(entry.dataEvento)}). Veja na tabela abaixo.`;
    }
    limparFormDespesa();
    renderListaDespesas();
    renderResumoCadastroDespesas();
    renderDashboard();
    if (paneAberto === "relatorio") aplicarRelatorio();
    document.getElementById("finCeoDespesasTableWrap")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function confirmarDespesaModal() {
    const entry = finCeoDespConfirmPending;
    if (!entry) return;
    fecharModalConfirmDespesa();
    persistirDespesaEntry(entry);
  }

  function salvarDespesaForm(ev) {
    ev?.preventDefault();
    const fb = document.getElementById("finCeoDespFeedback");
    if (fb) fb.textContent = "";
    const entry = coletarEntryDespesaForm(fb);
    if (!entry) return;
    abrirModalConfirmDespesa(entry);
  }

  function filtroValorMonetarioAtivo(str) {
    const s = String(str || "").trim();
    if (!s) return false;
    return parseValor(s) > 0;
  }

  function despesaMatchesTipoFiltro(d, tipoFiltro) {
    if (!tipoFiltro) return true;
    if (tipoFiltro.startsWith("dk:")) {
      const rub = tipoFiltro.slice(3);
      if (isCategoriaDk(d.categoria) && d.rubrica === rub) return true;
      if (rub === "ALUGUEL" && isParticulares(d.categoria) && inferirTipoParticularLegado(d) === "ALUGUEL") return true;
      return false;
    }
    if (tipoFiltro.startsWith("part:")) {
      const tp = tipoFiltro.slice(5);
      if (isParticulares(d.categoria) && inferirTipoParticularLegado(d) === tp) return true;
      if (tp === "ALUGUEL" && isCategoriaDk(d.categoria) && d.rubrica === "ALUGUEL") return true;
      return false;
    }
    return true;
  }

  function expandirPagamentosDespesa(d, limiteRepeticoes) {
    const out = [];
    const max = limiteRepeticoes > 0 ? Math.min(limiteRepeticoes, d.repeticoes) : d.repeticoes;
    if (d.periodic) {
      let dt = startOfDay(d.dataEvento instanceof Date ? d.dataEvento : parseBrDate(d.dataEvento));
      if (!dt) return out;
      for (let i = 0; i < max; i += 1) {
        out.push({ numero: i + 1, data: new Date(dt), valor: d.valor, despesa: d });
        if (i < max - 1) dt = addMonths(dt, 1);
      }
      return out;
    }
    (d.parcelas || []).slice(0, max).forEach((p, i) => {
      const y = new Date().getFullYear();
      const dt = new Date(y, p.mes - 1, Math.min(p.dia, 28));
      out.push({ numero: i + 1, data: dt, valor: p.valor, despesa: d });
    });
    return out;
  }

  function filtrarDespesasRelatorio() {
    const cat = document.getElementById("finCeoRelCat")?.value || "";
    const tipo = document.getElementById("finCeoRelTipo")?.value || "";
    const de = parseBrDate(document.getElementById("finCeoRelDe")?.value);
    const repFiltro = Math.max(0, Number(document.getElementById("finCeoRelRepeticoes")?.value) || 0);
    const vminStr = String(document.getElementById("finCeoRelValorMin")?.value || "").trim();
    const vmaxStr = String(document.getElementById("finCeoRelValorMax")?.value || "").trim();
    const vmin = parseValor(vminStr);
    const vmax = parseValor(vmaxStr);
    const busca = String(document.getElementById("finCeoRelBusca")?.value || "").trim().toLowerCase();

    return ordenarDespesasRecentes(loadDespesasCeo().map(normalizeDespesa)).filter((d) => {
      if (cat && d.categoria !== cat) return false;
      if (!despesaMatchesTipoFiltro(d, tipo)) return false;
      const dt = d.dataEvento instanceof Date ? d.dataEvento : parseBrDate(d.dataEvento);
      if (de) {
        if (!dt || fmtBrDate(dt) !== fmtBrDate(de)) return false;
      }
      if (filtroValorMonetarioAtivo(vminStr) && d.valor < vmin) return false;
      if (filtroValorMonetarioAtivo(vmaxStr) && d.valor > vmax) return false;
      if (busca) {
        const { tipo: t, desc } = detalheDespesaLista(d);
        const blob = [labelCategoria(d.categoria), t, desc, d.descricao, d.subcategoria].join(" ").toLowerCase();
        if (!blob.includes(busca)) return false;
      }
      return true;
    });
  }

  function montarPagamentosRelatorio(despesas) {
    const repFiltro = Math.max(0, Number(document.getElementById("finCeoRelRepeticoes")?.value) || 0);
    const pagamentos = despesas.flatMap((d) => expandirPagamentosDespesa(d, repFiltro || d.repeticoes));
    pagamentos.sort((a, b) => {
      const ta = a.data?.getTime() || 0;
      const tb = b.data?.getTime() || 0;
      if (tb !== ta) return tb - ta;
      return b.numero - a.numero;
    });
    return pagamentos;
  }

  function renderRelatorioTipoSelect() {
    const catSel = document.getElementById("finCeoRelCat");
    const tipoSel = document.getElementById("finCeoRelTipo");
    if (!tipoSel) return;
    const cat = catSel?.value || "";
    const cur = tipoSel.value;
    let opts = '<option value="">Todas</option>';
    const mostrarDk = !cat || isCategoriaDk(cat);
    const mostrarPart = !cat || isParticulares(cat);
    if (mostrarDk) {
      RUBRICAS_DK.forEach((r) => {
        opts += `<option value="dk:${esc(r.id)}">${esc(r.label)}</option>`;
      });
    }
    if (mostrarPart) {
      TIPOS_PARTICULARES.forEach((t) => {
        opts += `<option value="part:${esc(t.id)}">${esc(t.label)}</option>`;
      });
    }
    tipoSel.innerHTML = opts;
    if (cur && [...tipoSel.options].some((o) => o.value === cur)) tipoSel.value = cur;
  }

  function renderRelatorioCategoriaSelect() {
    const sel = document.getElementById("finCeoRelCat");
    if (!sel) return;
    const cur = sel.value;
    sel.innerHTML =
      '<option value="">Todas</option>' +
      CATEGORIAS_CEO.map((c) => `<option value="${esc(c.id)}">${esc(c.label)}</option>`).join("");
    if (cur) sel.value = cur;
    renderRelatorioTipoSelect();
  }

  function aplicarRelatorio(ev) {
    ev?.preventDefault();
    const despesas = filtrarDespesasRelatorio();
    const pagamentos = montarPagamentosRelatorio(despesas);
    const body = document.getElementById("finCeoRelBody");
    const vazia = document.getElementById("finCeoRelVazia");
    const resumo = document.getElementById("finCeoRelResumo");
    if (!body) return;

    const totalPagamentos = pagamentos.reduce((s, p) => s + p.valor, 0);

    if (resumo) {
      resumo.textContent = pagamentos.length
        ? `${pagamentos.length} pagamento(s) · ${despesas.length} lançamento(s) · total: ${brl(totalPagamentos)}`
        : despesas.length
          ? "Nenhum pagamento gerado com os filtros actuais."
          : loadDespesasCeo().length
            ? "Nenhum lançamento corresponde aos filtros — clique em «Ver todos» ou «Limpar filtros»."
            : "Nenhuma despesa cadastrada ainda — use Cadastro de despesas.";
    }

    if (!pagamentos.length) {
      body.innerHTML = "";
      vazia?.classList.remove("hidden");
      return;
    }
    vazia?.classList.add("hidden");
    body.innerHTML = pagamentos
      .map((p) => {
        const { tipo, desc } = detalheDespesaLista(p.despesa);
        const rotulo = `PAGAMENTO ${String(p.numero).padStart(2, "0")}`;
        return `<tr>
          <td><strong>${esc(rotulo)}</strong></td>
          <td>${esc(fmtBrDate(p.data))}</td>
          <td>${esc(brl(p.valor))}</td>
          <td>${esc(labelCategoria(p.despesa.categoria))}</td>
          <td>${esc(tipo)}</td>
          <td>${esc(desc)}</td>
        </tr>`;
      })
      .join("");
  }

  function limparCamposFiltroRelatorio() {
    const cat = document.getElementById("finCeoRelCat");
    if (cat) cat.value = "";
    ["finCeoRelDe", "finCeoRelRepeticoes", "finCeoRelValorMin", "finCeoRelValorMax", "finCeoRelBusca"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.value = "";
    });
    renderRelatorioTipoSelect();
  }

  function preencherRelatorioComDespesa(d) {
    if (!d) return;
    const cat = document.getElementById("finCeoRelCat");
    if (cat) cat.value = d.categoria;
    renderRelatorioTipoSelect();
    const tipoSel = document.getElementById("finCeoRelTipo");
    if (tipoSel) {
      tipoSel.value = isParticulares(d.categoria)
        ? `part:${inferirTipoParticularLegado(d)}`
        : `dk:${d.rubrica}`;
    }
    const de = document.getElementById("finCeoRelDe");
    if (de) de.value = fmtBrDate(d.dataEvento);
    const rep = document.getElementById("finCeoRelRepeticoes");
    if (rep) rep.value = String(d.repeticoes);
    const vmin = document.getElementById("finCeoRelValorMin");
    const vmax = document.getElementById("finCeoRelValorMax");
    if (vmin) vmin.value = "";
    if (vmax) vmax.value = "";
  }

  function abrirRelatorioComDespesa(d) {
    paneAberto = "relatorio";
    document.getElementById("finCeoFormPlaceholder")?.classList.add("hidden");
    document.querySelectorAll(".fin-ceo-pane").forEach((p) => {
      p.classList.toggle("hidden", p.getAttribute("data-ceo-pane") !== "relatorio");
    });
    document.querySelectorAll("#finCeoModulosNav [data-ceo-mod]").forEach((b) => {
      const on = b.getAttribute("data-ceo-mod") === "relatorio";
      b.classList.toggle("is-active", on);
      b.setAttribute("aria-expanded", on ? "true" : "false");
    });
    renderRelatorioCategoriaSelect();
    preencherRelatorioComDespesa(d);
    bindMascarasCeo(document.getElementById("finCeoPaneRelatorio"));
    aplicarRelatorio();
  }

  function abrirRelatorioUltimoCadastro() {
    const list = ordenarDespesasRecentes(loadDespesasCeo().map(normalizeDespesa));
    const alvo =
      list.find((d) => d.id === ultimaDespesaSalvaId) ||
      list[0] ||
      null;
    if (alvo) abrirRelatorioComDespesa(alvo);
    else abrirPane("relatorio");
  }

  function limparFiltrosRelatorio() {
    limparCamposFiltroRelatorio();
    aplicarRelatorio();
  }

  function renderRelatorio(opcoes = {}) {
    const { limparFiltros = true } = opcoes;
    if (limparFiltros) limparCamposFiltroRelatorio();
    renderRelatorioCategoriaSelect();
    bindMascarasCeo(document.getElementById("finCeoPaneRelatorio"));
    aplicarRelatorio();
  }

  function excluirDespesa(id) {
    const list = loadDespesasCeo().filter((d) => String(d.id) !== String(id));
    saveDespesasCeo(list);
    renderListaDespesas();
    renderResumoCadastroDespesas();
    renderDashboard();
    if (paneAberto === "relatorio") aplicarRelatorio();
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
    if (id === "relatorio") renderRelatorio();
  }

  function bindOnce() {
    if (bound) return;
    bound = true;

    document.querySelectorAll("#finCeoModulosNav [data-ceo-mod]").forEach((btn) => {
      btn.addEventListener("click", () => abrirPane(btn.getAttribute("data-ceo-mod") || ""));
    });

    document.getElementById("finCeoDespForm")?.addEventListener("submit", salvarDespesaForm);
    document.getElementById("finCeoDespConfirmSimBtn")?.addEventListener("click", confirmarDespesaModal);
    document.getElementById("finCeoDespConfirmNaoBtn")?.addEventListener("click", fecharModalConfirmDespesa);
    document
      .querySelectorAll("[data-fin-ceo-desp-confirm-cancel]")
      .forEach((el) => el.addEventListener("click", fecharModalConfirmDespesa));
    document.getElementById("finCeoDespConfirmModal")?.addEventListener("keydown", (ev) => {
      if (ev.key === "Escape") fecharModalConfirmDespesa();
    });
    document.getElementById("finCeoDespLimpar")?.addEventListener("click", limparFormDespesa);
    document.getElementById("finCeoDespVerRelatorio")?.addEventListener("click", abrirRelatorioUltimoCadastro);
    document.getElementById("finCeoRelVerTodos")?.addEventListener("click", () => {
      limparFiltrosRelatorio();
    });
    document.getElementById("finCeoRelForm")?.addEventListener("submit", aplicarRelatorio);
    document.getElementById("finCeoRelLimpar")?.addEventListener("click", limparFiltrosRelatorio);
    document.getElementById("finCeoRelCat")?.addEventListener("change", renderRelatorioTipoSelect);
    document.getElementById("finCeoRelBusca")?.addEventListener("input", () => {
      if (paneAberto === "relatorio") aplicarRelatorio();
    });
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

  window.__DK_finCeoReceitaCalc = {
    PROTOCOLO_TESTE_CEO,
    locacaoExcluidaReceitaCeo,
    valorSemanalContrato,
    diasNoMes,
    receitaSemanalLocadora,
    receitaSemanalParaMensal,
    receitaPrevistaLocadora,
    receitaPrevistaCentroAutomotivo,
    receitaPrevistaConstrutora,
    calcReceitasPorUnidade,
  };
})();
