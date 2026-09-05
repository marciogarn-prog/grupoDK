/**
 * FINANCEIRO CEO — cadastro de despesas estratégicas, endividamento e projeção (2 anos).
 * Acesso restrito ao CPF titular (03037897430).
 */
(function portalFinanceiroCeo() {
  const DESPESAS_CEO_KEY = "dk_financeiro_ceo_despesas_v1";
  const SITUACAO_PAG_CEO_KEY = "dk_financeiro_ceo_situacao_pag_v1";
  const CARTOES_CEO_KEY = "dk_financeiro_ceo_cartoes_v1";
  const FONTES_CEO_KEY = "dk_financeiro_ceo_fontes_v1";
  const CARTAO_FINAIS_MEM_KEY = "dk_financeiro_ceo_cartao_finais_v1";
  const CARTAO_BANCOS_MEM_KEY = "dk_financeiro_ceo_cartao_bancos_v1";
  const CARTAO_DOCS_MEM_KEY = "dk_financeiro_ceo_cartao_docs_v1";
  const CEO_LISTA_SORT_VENCIMENTO = "__vencimento_ceo";
  const CEO_GRAF_SORT_NATURAL = "__natural_graf";
  const HORIZONTE_MESES = 24;
  const CEO_ANO_FIM_PAINEL = 2030;
  const CEO_ANOS_PAINEL = [2026, 2027, 2028, 2029, 2030];

  const BANCOS_CARTAO_CEO = [
    "BANCO DO BRASIL",
    "SICREDI",
    "SANTANDER",
    "SICOOB",
    "PAN",
    "CAIXA",
    "NU",
    "ITAÚ",
    "MERCADO PAGO",
    "CEA",
    "CARREFOUR",
    "RENNER",
  ];

  const DOCS_CARTAO_CEO_SEED = [
    { label: "DK Locadora — 59.665.734/0001-32", digits: "59665734000132" },
    { label: "DK Construtora", digits: "" },
    { label: "DK Centro Automotivo", digits: "" },
  ];

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
    { id: "EMPRESTIMO", label: "Empréstimo" },
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
  /** @type {{ despesaId: string, pagNum: number, data: Date, row: object } | null} */
  let finCeoDespPagoPending = null;
  /** @type {{ mode: 'single'|'future', despesaId: string, pagamentoNumero: number } | null} */
  let finCeoDespEditState = null;
  let ceoDashProjCache = null;
  const ceoDashAnosAtivos = new Set(CEO_ANOS_PAINEL);

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

  function onlyDigitsCeo(s) {
    return String(s ?? "").replace(/\D/g, "");
  }

  function formatCpfCnpjCeo(digits) {
    const d = onlyDigitsCeo(digits);
    if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
    if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
    return String(digits || "").trim();
  }

  function normalizeBancoCartaoCeo(raw) {
    const t = String(raw || "")
      .trim()
      .toUpperCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ");
    if (!t) return "";
    const alias = {
      SICRED: "SICREDI",
      ITAU: "ITAÚ",
      "ITAU": "ITAÚ",
      NUBANK: "NU",
      CARREFUL: "CARREFOUR",
      CARREFOUR: "CARREFOUR",
      RENER: "RENNER",
      RENNER: "RENNER",
      "BANCO DO BRASIL": "BANCO DO BRASIL",
      BB: "BANCO DO BRASIL",
    };
    if (alias[t]) return alias[t];
    const found = BANCOS_CARTAO_CEO.find((b) => {
      const nb = b
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toUpperCase();
      return nb === t || b.toUpperCase() === String(raw || "").trim().toUpperCase();
    });
    return found || String(raw || "").trim().toUpperCase();
  }

  function montarLabelCartaoCeo(finais, banco, titularDoc, titularLabel) {
    const f = onlyDigitsCeo(finais).slice(0, 4);
    const b = normalizeBancoCartaoCeo(banco);
    const docFmt = formatCpfCnpjCeo(titularDoc);
    const extra = docFmt || String(titularLabel || "").trim();
    if (!f && !b && !extra) return "";
    const parts = [];
    if (f) parts.push(`****${f}`);
    if (b) parts.push(b);
    if (extra) parts.push(extra);
    return parts.join(" · ");
  }

  function normalizeCartao(raw) {
    const finais = onlyDigitsCeo(raw?.finais || "").slice(0, 4);
    const banco = normalizeBancoCartaoCeo(raw?.banco || "");
    const titularDoc = onlyDigitsCeo(raw?.titularDoc || raw?.doc || "").slice(0, 14);
    const titularLabel = String(raw?.titularLabel || "").trim();
    let label = String(raw?.label || "").trim();
    const composed = montarLabelCartaoCeo(finais, banco, titularDoc, titularLabel);
    if (composed) label = composed;
    if (!label && finais) label = `****${finais}`;
    const idBase =
      finais || banco || titularDoc
        ? `CARTAO_${finais || "XXXX"}_${slugId(banco || "BANCO", "B")}_${titularDoc || "DOC"}`
        : slugId(label, "CARTAO");
    const id = String(raw?.id || idBase).trim() || idBase;
    return {
      id,
      label: label || id,
      finais,
      banco,
      titularDoc,
      titularLabel,
    };
  }

  function loadJsonArrayCeo(key) {
    try {
      const raw = localStorage.getItem(key);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  }

  function saveJsonArrayCeo(key, list) {
    const payload = Array.isArray(list) ? list : [];
    try {
      localStorage.setItem(key, JSON.stringify(payload));
    } catch {
      /* ignore */
    }
    if (typeof window.saveCadastro === "function") {
      try {
        window.saveCadastro(key, payload, { bypassImmutabilidadeCadastro: true });
      } catch {
        /* ignore */
      }
    }
  }

  function loadCartoesCeoRaw() {
    return loadJsonArrayCeo(CARTOES_CEO_KEY);
  }

  function saveCartoesCeo(list) {
    const payload = Array.isArray(list) ? list.map(normalizeCartao).filter((c) => c.label) : [];
    saveJsonArrayCeo(CARTOES_CEO_KEY, payload);
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

  function getFinaisMemoria() {
    const fromMem = loadJsonArrayCeo(CARTAO_FINAIS_MEM_KEY)
      .map((x) => onlyDigitsCeo(x).slice(0, 4))
      .filter((d) => d.length === 4);
    const fromCards = getCartoesLista()
      .map((c) => onlyDigitsCeo(c.finais).slice(0, 4))
      .filter((d) => d.length === 4);
    return Array.from(new Set([...fromMem, ...fromCards])).sort();
  }

  function memorizarFinaisCartao(finais) {
    const d = onlyDigitsCeo(finais).slice(0, 4);
    if (d.length !== 4) return false;
    const list = getFinaisMemoria();
    if (list.includes(d)) {
      refreshCartaoDatalists();
      return false;
    }
    saveJsonArrayCeo(CARTAO_FINAIS_MEM_KEY, [...list, d]);
    refreshCartaoDatalists();
    return true;
  }

  function getBancosMemoria() {
    const fromMem = loadJsonArrayCeo(CARTAO_BANCOS_MEM_KEY)
      .map(normalizeBancoCartaoCeo)
      .filter(Boolean);
    const fromCards = getCartoesLista()
      .map((c) => normalizeBancoCartaoCeo(c.banco))
      .filter(Boolean);
    return Array.from(new Set([...BANCOS_CARTAO_CEO, ...fromMem, ...fromCards])).sort((a, b) =>
      a.localeCompare(b, "pt-BR")
    );
  }

  function memorizarBancoCartao(banco) {
    const b = normalizeBancoCartaoCeo(banco);
    if (!b) return false;
    const custom = loadJsonArrayCeo(CARTAO_BANCOS_MEM_KEY).map(normalizeBancoCartaoCeo).filter(Boolean);
    if (BANCOS_CARTAO_CEO.includes(b) || custom.includes(b)) {
      refreshCartaoDatalists();
      return false;
    }
    saveJsonArrayCeo(CARTAO_BANCOS_MEM_KEY, [...custom, b]);
    refreshCartaoDatalists();
    return true;
  }

  function normalizeDocMemoria(raw) {
    if (raw && typeof raw === "object") {
      const digits = onlyDigitsCeo(raw.digits || raw.doc || "").slice(0, 14);
      const label = String(raw.label || "").trim() || formatCpfCnpjCeo(digits);
      return { label, digits };
    }
    const s = String(raw || "").trim();
    const digits = onlyDigitsCeo(s).slice(0, 14);
    if (digits.length === 11 || digits.length === 14) {
      return { label: formatCpfCnpjCeo(digits), digits };
    }
    return { label: s, digits: "" };
  }

  function getDocsMemoria() {
    const map = new Map();
    const put = (raw) => {
      const n = normalizeDocMemoria(raw);
      if (!n.label && !n.digits) return;
      const key = n.digits || n.label.toLowerCase();
      if (!map.has(key)) map.set(key, n);
    };
    DOCS_CARTAO_CEO_SEED.forEach(put);
    loadJsonArrayCeo(CARTAO_DOCS_MEM_KEY).forEach(put);
    getCartoesLista().forEach((c) => {
      if (c.titularDoc || c.titularLabel) {
        put({ digits: c.titularDoc, label: c.titularLabel || formatCpfCnpjCeo(c.titularDoc) });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
  }

  function memorizarDocCartao(raw) {
    const n = normalizeDocMemoria(raw);
    if (!n.label && !n.digits) return false;
    if (!n.digits && DOCS_CARTAO_CEO_SEED.some((s) => s.label === n.label)) {
      refreshCartaoDatalists();
      return false;
    }
    const list = getDocsMemoria();
    const exists = list.some(
      (d) => (n.digits && d.digits === n.digits) || (!n.digits && d.label === n.label)
    );
    if (exists) {
      refreshCartaoDatalists();
      return false;
    }
    const custom = loadJsonArrayCeo(CARTAO_DOCS_MEM_KEY).map(normalizeDocMemoria);
    custom.push(n);
    saveJsonArrayCeo(CARTAO_DOCS_MEM_KEY, custom);
    refreshCartaoDatalists();
    return true;
  }

  function refreshCartaoDatalists() {
    const dlFin = document.getElementById("finCeoDespCartaoFinaisList");
    if (dlFin) {
      dlFin.innerHTML = getFinaisMemoria()
        .map((d) => `<option value="${esc(d)}"></option>`)
        .join("");
    }
    const dlBan = document.getElementById("finCeoDespCartaoBancoList");
    if (dlBan) {
      dlBan.innerHTML = getBancosMemoria()
        .map((b) => `<option value="${esc(b)}"></option>`)
        .join("");
    }
    const dlDoc = document.getElementById("finCeoDespCartaoDocList");
    if (dlDoc) {
      dlDoc.innerHTML = getDocsMemoria()
        .map((d) => {
          const val = d.digits ? formatCpfCnpjCeo(d.digits) : d.label;
          const lab = d.digits && d.label && d.label !== val ? d.label : "";
          return lab
            ? `<option value="${esc(val)}" label="${esc(lab)}"></option>`
            : `<option value="${esc(val)}"></option>`;
        })
        .join("");
    }
  }

  function lerCamposCartaoForm() {
    const finais = onlyDigitsCeo(document.getElementById("finCeoDespCartaoFinais")?.value).slice(0, 4);
    const banco = normalizeBancoCartaoCeo(document.getElementById("finCeoDespCartaoBanco")?.value);
    const docRaw = String(document.getElementById("finCeoDespCartaoDoc")?.value || "").trim();
    const digits = onlyDigitsCeo(docRaw).slice(0, 14);
    let titularDoc = "";
    let titularLabel = "";
    if (digits.length === 11 || digits.length === 14) {
      titularDoc = digits;
      const known = getDocsMemoria().find((d) => d.digits === digits);
      titularLabel = known?.label || formatCpfCnpjCeo(digits);
    } else if (docRaw) {
      const known = getDocsMemoria().find((d) => d.label === docRaw);
      if (known?.digits) {
        titularDoc = known.digits;
        titularLabel = known.label;
      } else {
        titularLabel = docRaw;
      }
    }
    return { finais, banco, titularDoc, titularLabel };
  }

  function preencherCamposCartaoForm(cartaoId) {
    const c = getCartoesLista().find((x) => x.id === cartaoId);
    const fin = document.getElementById("finCeoDespCartaoFinais");
    const ban = document.getElementById("finCeoDespCartaoBanco");
    const doc = document.getElementById("finCeoDespCartaoDoc");
    const hid = document.getElementById("finCeoDespCartao");
    if (!c) {
      if (fin) fin.value = "";
      if (ban) ban.value = "";
      if (doc) doc.value = "";
      if (hid) hid.value = "";
      return;
    }
    if (fin) fin.value = c.finais || "";
    if (ban) ban.value = c.banco || "";
    if (doc) {
      doc.value = c.titularDoc
        ? formatCpfCnpjCeo(c.titularDoc)
        : c.titularLabel || "";
    }
    if (hid) hid.value = c.id;
  }

  function limparCamposCartaoForm() {
    const fin = document.getElementById("finCeoDespCartaoFinais");
    const ban = document.getElementById("finCeoDespCartaoBanco");
    const doc = document.getElementById("finCeoDespCartaoDoc");
    const hid = document.getElementById("finCeoDespCartao");
    if (fin) fin.value = "";
    if (ban) ban.value = "";
    if (doc) doc.value = "";
    if (hid) hid.value = "";
  }

  function cartaoBateFinais(c, finais) {
    const f = onlyDigitsCeo(finais).slice(0, 4);
    if (f.length !== 4 || !c) return false;
    if (onlyDigitsCeo(c.finais).slice(0, 4) === f) return true;
    const m = String(c.label || "").match(/\*{4}(\d{4})/);
    return Boolean(m && m[1] === f);
  }

  /** Último cartão do histórico com os mesmos 4 finais (preferência: uso recente em despesas). */
  function buscarCartaoHistoricoPorFinais(finais) {
    const f = onlyDigitsCeo(finais).slice(0, 4);
    if (f.length !== 4) return null;
    const raw = loadCartoesCeoRaw().map(normalizeCartao);
    const matches = raw.filter((c) => cartaoBateFinais(c, f));
    if (!matches.length) return null;

    const byId = new Map(matches.map((c) => [c.id, c]));
    let best = null;
    let bestTs = -1;
    loadDespesasCeo()
      .map(normalizeDespesa)
      .forEach((d) => {
        const id = String(d.cartaoCredito || "").trim();
        if (!id || !byId.has(id)) return;
        const ts = Date.parse(String(d.cadastradoEm || "")) || 0;
        if (ts >= bestTs) {
          bestTs = ts;
          best = byId.get(id);
        }
      });
    if (best) return best;

    for (let i = raw.length - 1; i >= 0; i -= 1) {
      if (cartaoBateFinais(raw[i], f)) return raw[i];
    }
    return matches[matches.length - 1];
  }

  /** Se os 4 finais já existem, preenche banco e CPF/CNPJ do histórico. */
  function aplicarHistoricoCartaoPorFinais() {
    const fin = document.getElementById("finCeoDespCartaoFinais");
    const ban = document.getElementById("finCeoDespCartaoBanco");
    const doc = document.getElementById("finCeoDespCartaoDoc");
    const hid = document.getElementById("finCeoDespCartao");
    const f = onlyDigitsCeo(fin?.value).slice(0, 4);
    if (f.length !== 4) return null;
    const hist = buscarCartaoHistoricoPorFinais(f);
    if (!hist) {
      if (hid) hid.value = "";
      return null;
    }
    if (ban && hist.banco) ban.value = hist.banco;
    if (doc) {
      if (hist.titularDoc) doc.value = formatCpfCnpjCeo(hist.titularDoc);
      else if (hist.titularLabel) doc.value = hist.titularLabel;
    }
    if (hid) hid.value = hist.id;
    return hist;
  }

  function upsertCartaoFromForm(opts = {}) {
    const { silent = false } = opts;
    const { finais, banco, titularDoc, titularLabel } = lerCamposCartaoForm();
    if (finais.length === 4) memorizarFinaisCartao(finais);
    if (banco) memorizarBancoCartao(banco);
    if (titularDoc || titularLabel) memorizarDocCartao({ digits: titularDoc, label: titularLabel });

    if (finais.length !== 4 || !banco || (!titularDoc && !titularLabel)) {
      if (!silent) return null;
      return null;
    }
    const card = normalizeCartao({
      finais,
      banco,
      titularDoc,
      titularLabel,
      usadoEm: new Date().toISOString(),
    });
    const list = getCartoesLista().filter((c) => c.id !== card.id);
    list.push(card);
    saveCartoesCeo(list);
    const hid = document.getElementById("finCeoDespCartao");
    if (hid) hid.value = card.id;
    refreshCartaoDatalists();
    return card;
  }

  function formatarInputCartaoDocMask() {
    const inp = document.getElementById("finCeoDespCartaoDoc");
    if (!inp) return;
    const d = onlyDigitsCeo(inp.value).slice(0, 14);
    if (d.length <= 11) {
      let out = d;
      if (d.length > 9) out = d.replace(/(\d{3})(\d{3})(\d{3})(\d{0,2})/, "$1.$2.$3-$4");
      else if (d.length > 6) out = d.replace(/(\d{3})(\d{3})(\d{0,3})/, "$1.$2.$3");
      else if (d.length > 3) out = d.replace(/(\d{3})(\d{0,3})/, "$1.$2");
      inp.value = out;
    } else {
      let out = d;
      if (d.length > 12) out = d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{0,2})/, "$1.$2.$3/$4-$5");
      else if (d.length > 8) out = d.replace(/(\d{2})(\d{3})(\d{3})(\d{0,4})/, "$1.$2.$3/$4");
      else if (d.length > 5) out = d.replace(/(\d{2})(\d{3})(\d{0,3})/, "$1.$2.$3");
      else if (d.length > 2) out = d.replace(/(\d{2})(\d{0,3})/, "$1.$2");
      inp.value = out;
    }
  }

  function renderCartaoSelect() {
    refreshCartaoDatalists();
    const hid = document.getElementById("finCeoDespCartao");
    if (hid && hid.value && cartaoValido(hid.value)) {
      preencherCamposCartaoForm(hid.value);
    }
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

  function toggleTipoParticularUi() {
    const tipo = document.getElementById("finCeoDespTipoParticular")?.value || TIPOS_PARTICULARES[0].id;
    const exigeCartao = tipoParticularExigeCartao(tipo);
    document.getElementById("finCeoWrapCartao")?.classList.toggle("hidden", !exigeCartao);
    const cart = document.getElementById("finCeoDespCartao");
    if (cart) cart.required = false;
    const fin = document.getElementById("finCeoDespCartaoFinais");
    const ban = document.getElementById("finCeoDespCartaoBanco");
    const doc = document.getElementById("finCeoDespCartaoDoc");
    if (fin) fin.required = exigeCartao;
    if (ban) ban.required = exigeCartao;
    if (doc) doc.required = exigeCartao;
    if (exigeCartao) refreshCartaoDatalists();
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

  function chaveSituacaoPagamento(despesaId, pagNum, data) {
    const dt = data instanceof Date ? data : parseBrDate(data);
    return `${String(despesaId)}#${Number(pagNum) || 1}#${fmtBrDate(dt)}`;
  }

  function labelSituacaoPagamento(situacao) {
    return situacao === "PAGO" ? "PAGO" : "A PAGAR";
  }

  function loadSituacaoPagamentosMap() {
    const map = new Map();
    const ingest = (arr) => {
      if (!Array.isArray(arr)) return;
      arr.forEach((raw) => {
        const chave = String(raw?.chave || "").trim();
        if (!chave) return;
        map.set(chave, {
          chave,
          situacao: raw?.situacao === "PAGO" ? "PAGO" : "A_PAGAR",
          pagoEm: String(raw?.pagoEm || "").trim(),
        });
      });
    };
    if (typeof window.loadCadastro === "function") {
      try {
        ingest(window.loadCadastro(SITUACAO_PAG_CEO_KEY));
      } catch {
        ingest([]);
      }
    } else {
      try {
        const raw = localStorage.getItem(SITUACAO_PAG_CEO_KEY);
        ingest(raw ? JSON.parse(raw) : []);
      } catch {
        ingest([]);
      }
    }
    return map;
  }

  function saveSituacaoPagamentosMap(map) {
    const payload = Array.from(map.values());
    try {
      localStorage.setItem(SITUACAO_PAG_CEO_KEY, JSON.stringify(payload));
    } catch {
      /* ignore */
    }
    if (typeof window.saveCadastro === "function") {
      try {
        window.saveCadastro(SITUACAO_PAG_CEO_KEY, payload, { bypassImmutabilidadeCadastro: true });
      } catch {
        /* ignore */
      }
    }
    if (typeof window.__DK_pushCloudSnapshotNow === "function") {
      window.__DK_pushCloudSnapshotNow({ force: true }).catch(() => {});
    }
  }

  function getSituacaoPagamentoLinha(despesaId, pagNum, data) {
    const map = loadSituacaoPagamentosMap();
    const item = map.get(chaveSituacaoPagamento(despesaId, pagNum, data));
    return item?.situacao === "PAGO" ? "PAGO" : "A_PAGAR";
  }

  function marcarPagamentoLinhaComoPago(despesaId, pagNum, data) {
    const map = loadSituacaoPagamentosMap();
    const chave = chaveSituacaoPagamento(despesaId, pagNum, data);
    map.set(chave, { chave, situacao: "PAGO", pagoEm: new Date().toISOString() });
    saveSituacaoPagamentosMap(map);
  }

  function abrirModalConfirmPagoDespesa(row) {
    const modal = document.getElementById("finCeoDespPagoModal");
    if (!modal || !row?._d || !row?._p) return;
    finCeoDespPagoPending = {
      despesaId: row._d.id,
      pagNum: row._p.numero,
      data: row._p.data,
      row,
    };
    const resumo = document.getElementById("finCeoDespPagoResumo");
    if (resumo) {
      resumo.innerHTML = `<dl class="fin-ceo-desp-confirm-dl">
        <div><dt>Data</dt><dd>${esc(row.dataLabel)}</dd></div>
        <div><dt>Valor</dt><dd>${esc(row.valorLabel)}</dd></div>
        <div><dt>Categoria</dt><dd>${esc(row.categoria)}</dd></div>
        <div><dt>Rubrica / tipo</dt><dd>${esc(row.rubrica)}</dd></div>
        <div><dt>Detalhe</dt><dd>${esc(row.detalhe)}</dd></div>
      </dl>`;
    }
    modal.classList.remove("hidden");
    modal.setAttribute("aria-hidden", "false");
    document.getElementById("finCeoDespPagoSimBtn")?.focus();
  }

  function fecharModalConfirmPagoDespesa() {
    finCeoDespPagoPending = null;
    const modal = document.getElementById("finCeoDespPagoModal");
    modal?.classList.add("hidden");
    modal?.setAttribute("aria-hidden", "true");
  }

  function confirmarPagoDespesaModal() {
    const pending = finCeoDespPagoPending;
    if (!pending) return;
    marcarPagamentoLinhaComoPago(pending.despesaId, pending.pagNum, pending.data);
    fecharModalConfirmPagoDespesa();
    renderListaDespesas();
    if (paneAberto === "dashboard" || paneAberto === "periodo") renderResumoPeriodoCeo();
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

  function diasInclusiveEntre(d0, d1) {
    const a = startOfDay(d0);
    const b = startOfDay(d1);
    if (!a || !b) return 0;
    return Math.max(0, Math.round((b.getTime() - a.getTime()) / 86400000) + 1);
  }

  function dataNoIntervaloMs(dt, startMs, endMs) {
    if (!(dt instanceof Date) || Number.isNaN(dt.getTime())) return false;
    const ms = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate()).getTime();
    return ms >= startMs && ms <= endMs;
  }

  function receitaUnidadesNoPeriodo(uniRows, startMs, endMs) {
    let total = 0;
    (uniRows || []).forEach((r) => {
      if (r?.tipo !== "receita") return;
      const dt = parseBrDate(r.data);
      if (!dataNoIntervaloMs(dt, startMs, endMs)) return;
      total += Math.abs(parseValor(r.valor));
    });
    return total;
  }

  function lancamentoCeoEhDevolucao(lan) {
    if (!lan || typeof lan !== "object") return true;
    const tipo = String(lan.tipoMovimento || lan.tipo || lan.movimento || "")
      .toUpperCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    if (tipo.includes("DEVOL")) return true;
    const v = Number(lan.valor);
    if (Number.isFinite(v) && v < 0) return true;
    return false;
  }

  function receitaRealLocadoraNoPeriodo(locs, startMs, endMs) {
    let total = 0;
    const getLancs =
      typeof window.__DK_getPortalLancamentosAluguelDoContrato === "function"
        ? window.__DK_getPortalLancamentosAluguelDoContrato
        : (loc) => (Array.isArray(loc?.portalLancamentosAluguel) ? loc.portalLancamentosAluguel : []);
    (locs || []).forEach((loc) => {
      if (locacaoExcluidaReceitaCeo(loc)) return;
      const lancs = getLancs(loc) || [];
      lancs.forEach((lan) => {
        if (lancamentoCeoEhDevolucao(lan)) return;
        const v = parseValor(lan.valor);
        if (v <= 0) return;
        const dt = parseBrDate(lan.data);
        if (!dataNoIntervaloMs(dt, startMs, endMs)) return;
        total += v;
      });
    });
    return total;
  }

  function obterPeriodoCeoDash() {
    const hoje = startOfDay(new Date());
    const inpIni = document.getElementById("finCeoPeriodoInicio");
    const inpFim = document.getElementById("finCeoPeriodoFim");
    let d0 = parseBrDate(inpIni?.value);
    let d1 = parseBrDate(inpFim?.value);
    if (!d0 && !d1) {
      d0 = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
      d1 = hoje;
      if (inpIni && !String(inpIni.value || "").trim()) inpIni.value = fmtBrDate(d0);
      if (inpFim && !String(inpFim.value || "").trim()) inpFim.value = fmtBrDate(d1);
    }
    if (!d0 || !d1 || Number.isNaN(d0.getTime()) || Number.isNaN(d1.getTime())) {
      return { ok: false, d0: null, d1: null, startMs: 0, endMs: 0, dias: 0 };
    }
    d0 = startOfDay(d0);
    d1 = startOfDay(d1);
    if (d0.getTime() > d1.getTime()) {
      const t = d0;
      d0 = d1;
      d1 = t;
    }
    const startMs = d0.getTime();
    const endMs = new Date(d1.getFullYear(), d1.getMonth(), d1.getDate(), 23, 59, 59, 999).getTime();
    return { ok: true, d0, d1, startMs, endMs, dias: diasInclusiveEntre(d0, d1) };
  }

  function calcResumoPeriodoCeo(periodo) {
    const vazio = {
      receitaPrevista: 0,
      receitaReal: 0,
      despesaPrevista: 0,
      despesaPaga: 0,
      saldoPrevisto: 0,
      saldoReal: 0,
      dias: 0,
    };
    if (!periodo?.ok) return vazio;
    const { startMs, endMs, dias, d0, d1 } = periodo;
    const locs = carregarLocacoes();
    const uniRows = carregarUnidadeFinanceiro();
    const despesas = loadDespesasCeo().map(normalizeDespesa);

    const recLocPrev = (receitaSemanalLocadora(locs) / 7) * dias;
    const recUni = receitaUnidadesNoPeriodo(uniRows, startMs, endMs);
    const receitaPrevista = recLocPrev + recUni;
    const receitaReal = receitaRealLocadoraNoPeriodo(locs, startMs, endMs) + recUni;

    let despesaPrevista = 0;
    let despesaPaga = 0;
    despesas.forEach((d) => {
      const pagos = expandirPagamentosDespesa(d, d.repeticoes);
      pagos.forEach((p) => {
        if (!dataNoIntervaloMs(p.data, startMs, endMs)) return;
        const v = Number(p.valor) || 0;
        if (v <= 0) return;
        despesaPrevista += v;
        if (getSituacaoPagamentoLinha(d.id, p.numero, p.data) === "PAGO") despesaPaga += v;
      });
    });

    return {
      receitaPrevista,
      receitaReal,
      despesaPrevista,
      despesaPaga,
      saldoPrevisto: receitaPrevista - despesaPrevista,
      saldoReal: receitaReal - despesaPaga,
      dias,
    };
  }

  function aplicarClasseSaldoPeriodo(el, valor) {
    if (!el) return;
    el.classList.remove("fin-kpi--ok", "fin-kpi--warn", "fin-kpi--crit");
    if (valor > 0) el.classList.add("fin-kpi--ok");
    else if (valor < 0) el.classList.add("fin-kpi--crit");
    else el.classList.add("fin-kpi--warn");
  }

  function chaveDiaCeo(dt) {
    if (!(dt instanceof Date) || Number.isNaN(dt.getTime())) return "";
    return `${dt.getFullYear()}-${dt.getMonth()}-${dt.getDate()}`;
  }

  /** Soma acumulada: dia N = soma dos dias 1…N (receita, despesa e saldo). */
  function acumularSeriesPeriodoCeo(receitaDia, despesaDia) {
    const receita = [];
    const despesaNeg = [];
    const saldo = [];
    let accRec = 0;
    let accDeb = 0;
    for (let i = 0; i < receitaDia.length; i += 1) {
      accRec += Number(receitaDia[i]) || 0;
      accDeb += Number(despesaDia[i]) || 0;
      receita.push(accRec);
      despesaNeg.push(-accDeb);
      saldo.push(accRec - accDeb);
    }
    return { receita, despesaNeg, saldo };
  }

  /** Série do gráfico do período: valores acumulados (receita, despesa e saldo). */
  function buildProjecaoPeriodoCeo(periodo) {
    const vazio = { labels: [], saldo: [], receita: [], despesaNeg: [], modo: "mes", n: 0 };
    if (!periodo?.ok) return vazio;
    const locs = carregarLocacoes();
    const uniRows = carregarUnidadeFinanceiro();
    const despesas = loadDespesasCeo().map(normalizeDespesa);
    const recDiaLoc = receitaSemanalLocadora(locs) / 7;

    const debPorDia = new Map();
    despesas.forEach((d) => {
      expandirPagamentosDespesa(d, d.repeticoes).forEach((p) => {
        if (!dataNoIntervaloMs(p.data, periodo.startMs, periodo.endMs)) return;
        const v = Number(p.valor) || 0;
        if (v <= 0) return;
        const k = chaveDiaCeo(p.data);
        if (!k) return;
        debPorDia.set(k, (debPorDia.get(k) || 0) + v);
      });
    });

    const recUniPorDia = new Map();
    (uniRows || []).forEach((r) => {
      if (r?.tipo !== "receita") return;
      const dt = parseBrDate(r.data);
      if (!dataNoIntervaloMs(dt, periodo.startMs, periodo.endMs)) return;
      const k = chaveDiaCeo(dt);
      if (!k) return;
      recUniPorDia.set(k, (recUniPorDia.get(k) || 0) + Math.abs(parseValor(r.valor)));
    });

    const useDaily = periodo.dias <= 62;
    if (useDaily) {
      const labels = [];
      const receitaDia = [];
      const despesaDia = [];
      for (let t = periodo.d0.getTime(); t <= periodo.d1.getTime(); t += 86400000) {
        const dt = startOfDay(new Date(t));
        const k = chaveDiaCeo(dt);
        labels.push(
          `${String(dt.getDate()).padStart(2, "0")}/${String(dt.getMonth() + 1).padStart(2, "0")}`
        );
        receitaDia.push(recDiaLoc + (recUniPorDia.get(k) || 0));
        despesaDia.push(debPorDia.get(k) || 0);
      }
      const acum = acumularSeriesPeriodoCeo(receitaDia, despesaDia);
      return {
        labels,
        saldo: acum.saldo,
        receita: acum.receita,
        despesaNeg: acum.despesaNeg,
        modo: "dia",
        n: labels.length,
      };
    }

    const labels = [];
    const receitaMes = [];
    const despesaMes = [];
    let cur = new Date(periodo.d0.getFullYear(), periodo.d0.getMonth(), 1);
    const last = new Date(periodo.d1.getFullYear(), periodo.d1.getMonth(), 1);
    while (cur.getTime() <= last.getTime()) {
      const mesIni = new Date(cur.getFullYear(), cur.getMonth(), 1);
      const mesFim = new Date(cur.getFullYear(), cur.getMonth() + 1, 0);
      const slice0 = startOfDay(new Date(Math.max(mesIni.getTime(), periodo.d0.getTime())));
      const slice1 = startOfDay(new Date(Math.min(mesFim.getTime(), periodo.d1.getTime())));
      const dias = diasInclusiveEntre(slice0, slice1);
      const startMs = slice0.getTime();
      const endMs = new Date(slice1.getFullYear(), slice1.getMonth(), slice1.getDate(), 23, 59, 59, 999).getTime();
      let deb = 0;
      for (let t = slice0.getTime(); t <= slice1.getTime(); t += 86400000) {
        deb += debPorDia.get(chaveDiaCeo(startOfDay(new Date(t)))) || 0;
      }
      const rec = recDiaLoc * dias + receitaUnidadesNoPeriodo(uniRows, startMs, endMs);
      labels.push(`${String(cur.getMonth() + 1).padStart(2, "0")}/${cur.getFullYear()}`);
      receitaMes.push(rec);
      despesaMes.push(deb);
      cur = addMonths(cur, 1);
    }
    const acum = acumularSeriesPeriodoCeo(receitaMes, despesaMes);
    return {
      labels,
      saldo: acum.saldo,
      receita: acum.receita,
      despesaNeg: acum.despesaNeg,
      modo: "mes",
      n: labels.length,
    };
  }

  function renderGraficoPeriodoCeo() {
    const chart = document.getElementById("finCeoPeriodoChartSaldo");
    const leg = document.getElementById("finCeoPeriodoLegendaSaldo");
    const tit = document.getElementById("finCeoPeriodoChartTitulo");
    const hint = document.getElementById("finCeoPeriodoChartHint");
    if (!chart) return;
    const periodo = obterPeriodoCeoDash();
    if (!periodo.ok) {
      chart.innerHTML = `<p class="subtext">Informe início e fim do período para ver o gráfico.</p>`;
      if (leg) leg.innerHTML = "";
      if (tit) tit.textContent = "Saldo acumulado no período";
      return;
    }
    const view = buildProjecaoPeriodoCeo(periodo);
    if (tit) {
      tit.textContent =
        view.modo === "dia" ? "Saldo acumulado dia a dia" : "Saldo acumulado mês a mês";
    }
    if (hint) {
      hint.textContent =
        view.modo === "dia"
          ? "Valores acumulados: cada dia soma a receita e a despesa desde o início do período (ex.: dia 1 = 8.000; dia 2 = 16.000 de receita)."
          : "Valores acumulados: cada mês soma receita e despesa desde o início do período seleccionado.";
    }
    if (!view.labels.length) {
      chart.innerHTML = `<p class="subtext">Sem dados no período.</p>`;
      if (leg) leg.innerHTML = "";
      return;
    }
    chart.innerHTML = svgLineChart(view.labels, [
      { color: "#5eb8ff", values: view.saldo },
      { color: "#6ee7a0", values: view.receita },
      { color: "#ff6b6b", values: view.despesaNeg },
    ]);
    if (leg) {
      leg.innerHTML = [
        { c: "#5eb8ff", t: "Saldo acumulado (receita − despesas)" },
        { c: "#6ee7a0", t: "Receita acumulada" },
        { c: "#ff6b6b", t: "Despesas acumuladas (negativo)" },
      ]
        .map((x) => `<span class="fin-legenda__item"><i style="background:${x.c}"></i>${esc(x.t)}</span>`)
        .join("");
      leg.innerHTML += `<span class="fin-legenda__item fin-legenda__item--anos">${esc(fmtBrDate(periodo.d0))} a ${esc(
        fmtBrDate(periodo.d1)
      )} · ${view.n} ${view.modo === "dia" ? "dia(s)" : "mês(es)"}</span>`;
    }
  }

  function renderResumoPeriodoCeo() {
    const hint = document.getElementById("finCeoPeriodoHint");
    const setVal = (id, n) => {
      const el = document.getElementById(id);
      if (el) el.textContent = brl(n);
    };
    const periodo = obterPeriodoCeoDash();
    if (!periodo.ok) {
      ["finCeoPeriodoRecPrevista", "finCeoPeriodoRecReal", "finCeoPeriodoDespPrevista", "finCeoPeriodoDespPaga", "finCeoPeriodoSaldoPrevisto", "finCeoPeriodoSaldoReal"].forEach(
        (id) => {
          const el = document.getElementById(id);
          if (el) el.textContent = "—";
        }
      );
      if (hint) hint.textContent = "Informe data de início e fim válidas (DD/MM/AAAA).";
      renderGraficoPeriodoCeo();
      return;
    }
    const r = calcResumoPeriodoCeo(periodo);
    setVal("finCeoPeriodoRecPrevista", r.receitaPrevista);
    setVal("finCeoPeriodoRecReal", r.receitaReal);
    setVal("finCeoPeriodoDespPrevista", r.despesaPrevista);
    setVal("finCeoPeriodoDespPaga", r.despesaPaga);
    setVal("finCeoPeriodoSaldoPrevisto", r.saldoPrevisto);
    setVal("finCeoPeriodoSaldoReal", r.saldoReal);
    aplicarClasseSaldoPeriodo(document.getElementById("finCeoPeriodoSaldoPrevisto")?.closest(".fin-kpi"), r.saldoPrevisto);
    aplicarClasseSaldoPeriodo(document.getElementById("finCeoPeriodoSaldoReal")?.closest(".fin-kpi"), r.saldoReal);
    if (hint) {
      hint.textContent = `Período ${fmtBrDate(periodo.d0)} a ${fmtBrDate(periodo.d1)} · ${r.dias} dia(s) · saldo previsto ${brl(
        r.saldoPrevisto
      )} · saldo real ${brl(r.saldoReal)}.`;
    }
    renderGraficoPeriodoCeo();
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

  function calcFimProjecaoPainel(inicio) {
    const minFim = addMonths(inicio, HORIZONTE_MESES - 1);
    const fim2030 = new Date(CEO_ANO_FIM_PAINEL, 11, 1);
    return minFim.getTime() > fim2030.getTime() ? minFim : fim2030;
  }

  function buildProjecao24Meses() {
    const hoje = startOfDay(new Date());
    const inicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    const fim = calcFimProjecaoPainel(inicio);
    const despesas = loadDespesasCeo().map(normalizeDespesa);
    const debitos = gerarTodosDebitos(despesas, inicio, addMonths(fim, 1));
    const locs = carregarLocacoes();
    const uniRows = carregarUnidadeFinanceiro();

    const meses = [];
    for (let d = new Date(inicio); d <= fim; d = addMonths(d, 1)) {
      meses.push({
        date: new Date(d),
        key: monthKey(d),
        label: `${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`,
      });
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

  function filtrarProjecaoPorAnos(proj) {
    const indices = [];
    proj.meses.forEach((m, i) => {
      if (ceoDashAnosAtivos.has(m.date.getFullYear())) indices.push(i);
    });
    const meses = indices.map((i) => proj.meses[i]);
    const saldoMes = indices.map((i) => proj.saldoMes[i]);
    let acc = 0;
    const saldoAcc = saldoMes.map((s) => {
      acc += s;
      return acc;
    });
    return {
      meses,
      saldoMes,
      saldoAcc,
      labels: meses.map((m) => m.label),
      debPorMes: proj.debPorMes,
      recPorMes: proj.recPorMes,
    };
  }

  function syncCeoDashAnosBotoes() {
    document.querySelectorAll("#finCeoDashAnosFiltro [data-ceo-ano]").forEach((btn) => {
      const ano = Number(btn.getAttribute("data-ceo-ano"));
      const on = ceoDashAnosAtivos.has(ano);
      btn.classList.toggle("is-active", on);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
    });
  }

  function renderDashboardGraficos(proj) {
    const view = filtrarProjecaoPorAnos(proj);
    const { labels, meses, saldoMes, saldoAcc, debPorMes, recPorMes } = view;

    const chartSaldo = document.getElementById("finCeoChartSaldoMes");
    if (chartSaldo) {
      if (!meses.length) {
        chartSaldo.innerHTML = `<p class="subtext">Selecione pelo menos um ano nos botões acima.</p>`;
      } else {
        chartSaldo.innerHTML = svgLineChart(labels, [
          { color: "#5eb8ff", values: saldoMes },
          { color: "#6ee7a0", values: meses.map((m) => recPorMes.get(m.key) || 0) },
          { color: "#ff6b6b", values: meses.map((m) => -(debPorMes.get(m.key) || 0)) },
        ]);
      }
    }

    const chartAcc = document.getElementById("finCeoChartSaldoAcc");
    if (chartAcc) {
      if (!meses.length) {
        chartAcc.innerHTML = `<p class="subtext">—</p>`;
      } else {
        chartAcc.innerHTML = svgLineChart(labels, [{ color: "#f5d76e", values: saldoAcc }]);
      }
    }

    const anosTxt = CEO_ANOS_PAINEL.filter((y) => ceoDashAnosAtivos.has(y)).join(", ");
    const legSaldo = document.getElementById("finCeoLegendaSaldo");
    if (legSaldo) {
      legSaldo.innerHTML = [
        { c: "#5eb8ff", t: "Saldo mensal (receita − despesas)" },
        { c: "#6ee7a0", t: "Receita prevista" },
        { c: "#ff6b6b", t: "Despesas (negativo)" },
      ]
        .map((x) => `<span class="fin-legenda__item"><i style="background:${x.c}"></i>${esc(x.t)}</span>`)
        .join("");
      if (anosTxt) {
        legSaldo.innerHTML += `<span class="fin-legenda__item fin-legenda__item--anos">Anos: ${esc(anosTxt)} · ${meses.length} mês(es)</span>`;
      }
    }

    const legAcc = document.getElementById("finCeoLegendaAcc");
    if (legAcc) {
      const ult = saldoAcc[saldoAcc.length - 1] || 0;
      legAcc.innerHTML = meses.length
        ? `<span class="fin-legenda__item"><i style="background:#f5d76e"></i>Saldo acumulado no período · ${esc(brl(ult))}${anosTxt ? ` (${esc(anosTxt)})` : ""}</span>`
        : `<span class="fin-legenda__item"><i style="background:#f5d76e"></i>Saldo acumulado — selecione um ano</span>`;
    }

    const tab = document.getElementById("finCeoTabelaProjecao");
    if (tab) {
      const head = `<tr><th>Mês</th><th>Despesas</th><th>Receita prevista</th><th>Taxa endiv.</th><th>Saldo mês</th><th>Saldo acumulado</th></tr>`;
      if (!meses.length) {
        tab.innerHTML = `<p class="subtext">Nenhum mês nos anos seleccionados.</p>`;
      } else {
        const body = meses
          .map((m, i) => {
            const deb = debPorMes.get(m.key) || 0;
            const rec = recPorMes.get(m.key) || 0;
            const taxa = calcTaxaEndividamento(deb, rec);
            const taxaTxt = rec <= 0 && deb > 0 ? "—" : fmtPct(taxa);
            return `<tr><td>${esc(m.label)}</td><td>${esc(brl(deb))}</td><td>${esc(brl(rec))}</td><td>${esc(taxaTxt)}</td><td>${esc(brl(saldoMes[i] || 0))}</td><td>${esc(brl(saldoAcc[i] || 0))}</td></tr>`;
          })
          .join("");
        tab.innerHTML = `<table class="fin-table"><thead>${head}</thead><tbody>${body}</tbody></table>`;
      }
    }
  }

  function toggleCeoDashAno(ano) {
    if (!CEO_ANOS_PAINEL.includes(ano)) return;
    if (ceoDashAnosAtivos.has(ano)) {
      if (ceoDashAnosAtivos.size <= 1) return;
      ceoDashAnosAtivos.delete(ano);
    } else {
      ceoDashAnosAtivos.add(ano);
    }
    syncCeoDashAnosBotoes();
    renderDashboardGraficos(ceoDashProjCache || buildProjecao24Meses());
  }

  function renderDashboard() {
    const proj = buildProjecao24Meses();
    ceoDashProjCache = proj;
    syncCeoDashAnosBotoes();

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

    renderDashboardGraficos(proj);
    renderResumoPeriodoCeo();
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

  function novoIdDespesa() {
    return `ceo-desp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  }

  function serializarDespesa(d) {
    const n = normalizeDespesa(d);
    return {
      id: n.id,
      categoria: n.categoria,
      rubrica: n.rubrica,
      tipoParticular: n.tipoParticular,
      cartaoCredito: n.cartaoCredito,
      descricao: n.descricao,
      periodic: n.periodic,
      valor: n.valor,
      repeticoes: n.repeticoes,
      dataEvento: fmtBrDate(n.dataEvento),
      cadastradoEm: n.cadastradoEm || new Date().toISOString(),
      parcelas: n.parcelas,
    };
  }

  function getPagamentoDespesa(d, numero) {
    const pagos = expandirPagamentosDespesa(normalizeDespesa(d), normalizeDespesa(d).repeticoes);
    return pagos.find((p) => p.numero === numero) || null;
  }

  function updateFormEditUi() {
    const submitBtn = document.querySelector("#finCeoDespForm button[type='submit']");
    const fb = document.getElementById("finCeoDespFeedback");
    if (finCeoDespEditState) {
      const pag = String(finCeoDespEditState.pagamentoNumero).padStart(2, "0");
      if (submitBtn) {
        submitBtn.textContent =
          finCeoDespEditState.mode === "single" ? "Salvar evento editado" : "Salvar série futura";
      }
      if (fb) {
        fb.textContent =
          finCeoDespEditState.mode === "single"
            ? `Editando pagamento ${pag} — altere os campos e confirme.`
            : `Editando pagamentos ${pag} em diante — altere os campos e confirme.`;
      }
    } else {
      if (submitBtn) submitBtn.textContent = "Cadastrar despesa";
    }
  }

  function limparFormDespesa() {
    finCeoDespEditState = null;
    renderCategoriaSelect();
    renderRubricaSelect();
    renderTipoParticularSelect();
    limparCamposCartaoForm();
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
    updateFormEditUi();
  }

  function preencherFormDespesaEdicao(d, pagNum, mode) {
    const desp = normalizeDespesa(d);
    const pag = getPagamentoDespesa(desp, pagNum);
    if (!pag) return;

    finCeoDespEditState = { mode, despesaId: desp.id, pagamentoNumero: pagNum };

    renderCategoriaSelect();
    renderRubricaSelect();
    renderTipoParticularSelect();
    renderCartaoSelect();

    const cat = document.getElementById("finCeoDespCategoria");
    if (cat) cat.value = desp.categoria;
    toggleCategoriaDespesaUi();

    if (isParticulares(desp.categoria)) {
      const tipo = document.getElementById("finCeoDespTipoParticular");
      if (tipo && tipoParticularValido(desp.tipoParticular)) tipo.value = desp.tipoParticular;
      toggleTipoParticularUi();
      if (desp.cartaoCredito) preencherCamposCartaoForm(desp.cartaoCredito);
      else limparCamposCartaoForm();
    } else {
      const rub = document.getElementById("finCeoDespRubrica");
      if (rub && rubricaValida(desp.rubrica)) rub.value = desp.rubrica;
    }

    const desc = document.getElementById("finCeoDespDescricao");
    if (desc) desc.value = desp.descricao || "";
    const val = document.getElementById("finCeoDespValor");
    if (val) val.value = brl(pag.valor);
    const rep = document.getElementById("finCeoDespRepeticoes");
    if (rep) {
      rep.value =
        mode === "single" ? "1" : String(Math.max(1, desp.repeticoes - pagNum + 1));
    }
    const dt = document.getElementById("finCeoDespDataEvento");
    if (dt) dt.value = fmtBrDate(pag.data);

    bindMascarasCeo(document.getElementById("finCeoPaneDespesas"));
    updateFormEditUi();
    document.getElementById("finCeoDespForm")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function iniciarEdicaoDespesa(id, pagNum, mode) {
    const raw = loadDespesasCeo().find((d) => String(d.id) === String(id));
    if (!raw) return;
    preencherFormDespesaEdicao(raw, pagNum, mode);
  }

  function aplicarEditarEvento(list, despesaId, pagNum, newEntry) {
    const idx = list.findIndex((d) => String(d.id) === String(despesaId));
    if (idx < 0) return { list, ok: false };
    const original = normalizeDespesa(list[idx]);
    const R = original.repeticoes;
    const pag = Math.max(1, Math.min(R, Number(pagNum) || 1));
    const edited = normalizeDespesa({ ...newEntry, repeticoes: 1, periodic: true });

    if (R === 1) {
      const next = [...list];
      next[idx] = serializarDespesa({ ...edited, id: original.id, cadastradoEm: original.cadastradoEm });
      return { list: next, ok: true, savedId: original.id };
    }

    const replacement = [];
    let savedId = original.id;
    for (let i = 0; i < list.length; i++) {
      if (i !== idx) {
        replacement.push(list[i]);
        continue;
      }
      if (pag > 1) {
        replacement.push(
          serializarDespesa({
            ...original,
            id: original.id,
            repeticoes: pag - 1,
            cadastradoEm: original.cadastradoEm,
          })
        );
      }
      const editedId = pag === 1 ? original.id : novoIdDespesa();
      savedId = editedId;
      replacement.push(
        serializarDespesa({
          ...edited,
          id: editedId,
          repeticoes: 1,
          cadastradoEm: pag === 1 ? original.cadastradoEm : new Date().toISOString(),
        })
      );
      if (pag < R) {
        const futuro = getPagamentoDespesa(original, pag + 1);
        replacement.push(
          serializarDespesa({
            ...original,
            id: novoIdDespesa(),
            repeticoes: R - pag,
            dataEvento: futuro?.data || original.dataEvento,
            cadastradoEm: new Date().toISOString(),
          })
        );
      }
    }
    return { list: replacement, ok: true, savedId };
  }

  function aplicarEditarFuturo(list, despesaId, pagNum, newEntry) {
    const idx = list.findIndex((d) => String(d.id) === String(despesaId));
    if (idx < 0) return { list, ok: false };
    const original = normalizeDespesa(list[idx]);
    const R = original.repeticoes;
    const pag = Math.max(1, Math.min(R, Number(pagNum) || 1));
    const updated = normalizeDespesa(newEntry);

    if (pag === 1) {
      const next = [...list];
      next[idx] = serializarDespesa({ ...updated, id: original.id, cadastradoEm: original.cadastradoEm });
      return { list: next, ok: true, savedId: original.id };
    }

    const replacement = [];
    let savedId = original.id;
    for (let i = 0; i < list.length; i++) {
      if (i !== idx) {
        replacement.push(list[i]);
        continue;
      }
      replacement.push(
        serializarDespesa({
          ...original,
          id: original.id,
          repeticoes: pag - 1,
          cadastradoEm: original.cadastradoEm,
        })
      );
      savedId = novoIdDespesa();
      replacement.push(
        serializarDespesa({
          ...updated,
          id: savedId,
          cadastradoEm: new Date().toISOString(),
        })
      );
    }
    return { list: replacement, ok: true, savedId };
  }

  function ceoListaLinhaFromPagamento(d, p, tipo, desc, primeiro) {
    const situacao = getSituacaoPagamentoLinha(d.id, p.numero, p.data);
    return {
      pagamento: p.numero,
      pagamentoLabel: `PAGAMENTO ${String(p.numero).padStart(2, "0")}`,
      data: p.data,
      dataLabel: fmtBrDate(p.data),
      valor: p.valor,
      valorLabel: brl(p.valor),
      categoria: labelCategoria(d.categoria),
      rubrica: tipo,
      detalhe: desc,
      situacao,
      situacaoLabel: labelSituacaoPagamento(situacao),
      _d: d,
      _p: p,
      _primeiro: primeiro,
    };
  }

  function coletarLinhasExcelListaDespesas() {
    const list = ordenarDespesasRecentes(loadDespesasCeo().map(normalizeDespesa));
    const rows = [];
    list.forEach((d) => {
      const pagos = expandirPagamentosDespesa(d, d.repeticoes);
      const { tipo, desc } = detalheDespesaLista(d);
      pagos.forEach((p, idx) => {
        rows.push(ceoListaLinhaFromPagamento(d, p, tipo, desc, idx === 0));
      });
    });
    return rows;
  }

  function calcularTotaisEndividamentoLista(linhas) {
    let total = 0;
    let aberto = 0;
    let qtdAberto = 0;
    (linhas || []).forEach((r) => {
      const v = Number(r.valor) || 0;
      total += v;
      if (r.situacao !== "PAGO") {
        aberto += v;
        qtdAberto += 1;
      }
    });
    return { total, aberto, qtd: (linhas || []).length, qtdAberto };
  }

  function listaDespesaTemFiltroColunaAtivo() {
    return CEO_LISTA_COLS.some((c) => ceoListaColFilterActive(c.key));
  }

  function renderTotaisEndividamentoLista(linhas, linhasBase) {
    const totEl = document.getElementById("finCeoDespEndivTotalValor");
    const abertoEl = document.getElementById("finCeoDespEndivAbertoValor");
    const totHint = document.getElementById("finCeoDespEndivTotalHint");
    const abertoHint = document.getElementById("finCeoDespEndivAbertoHint");
    if (!totEl || !abertoEl) return;

    const base = linhasBase || [];
    const filtradas = linhas || [];
    const totais = calcularTotaisEndividamentoLista(filtradas);

    if (!base.length) {
      totEl.textContent = "—";
      abertoEl.textContent = "—";
      if (totHint) totHint.textContent = "Cadastre despesas na tabela abaixo";
      if (abertoHint) abertoHint.textContent = "—";
      return;
    }

    totEl.textContent = brl(totais.total);
    abertoEl.textContent = brl(totais.aberto);

    const filtroCol = listaDespesaTemFiltroColunaAtivo();
    const parcial = filtradas.length !== base.length || filtroCol;
    if (!filtradas.length) {
      if (totHint) {
        totHint.textContent = parcial
          ? "Nenhum lançamento no filtro ▾ — ajuste as colunas"
          : "Nenhum lançamento";
      }
      if (abertoHint) abertoHint.textContent = "0 a pagar";
      return;
    }

    if (totHint) {
      totHint.textContent = parcial
        ? `${filtradas.length} de ${base.length} lançamento(s) na tabela`
        : `${filtradas.length} lançamento(s) na tabela`;
    }
    if (abertoHint) {
      abertoHint.textContent =
        totais.qtdAberto === 1 ? "1 parcela a pagar" : `${totais.qtdAberto} parcelas a pagar`;
    }
  }

  function renderListaDespesaRowHtml(row) {
    const d = row._d;
    const p = row._p;
    const primeiro = row._primeiro;
    const excluir = primeiro
      ? `<button type="button" class="btn-primary btn-secondary-outline fin-ceo-desp-excluir" data-id="${esc(d.id)}">Excluir</button>`
      : "";
    const acoes = `<div class="fin-ceo-desp-row-acoes">
          <button type="button" class="btn-primary btn-secondary-outline fin-ceo-desp-editar-evento" data-id="${esc(d.id)}" data-pag="${p.numero}">EDITAR EVENTO</button>
          <button type="button" class="btn-primary btn-secondary-outline fin-ceo-desp-editar-futuro" data-id="${esc(d.id)}" data-pag="${p.numero}">EDITAR FUTURO</button>
          ${excluir}
        </div>`;
    const situacaoHtml =
      row.situacao === "PAGO"
        ? `<span class="fin-ceo-desp-situacao-btn fin-ceo-desp-situacao-btn--pago" aria-label="Pago">PAGO</span>`
        : `<button type="button" class="fin-ceo-desp-situacao-btn fin-ceo-desp-situacao-btn--aberto" data-ceo-desp-marcar-pago="1" aria-label="Marcar como pago">A PAGAR</button>`;
    return `<tr data-ceo-desp-id="${esc(d.id)}" data-ceo-pag="${p.numero}">
          <td><strong>${esc(row.pagamentoLabel)}</strong></td>
          <td>${esc(row.dataLabel)}</td>
          <td>${esc(row.valorLabel)}</td>
          <td>${esc(row.categoria)}</td>
          <td>${esc(row.rubrica)}</td>
          <td>${esc(row.detalhe)}</td>
          <td class="fin-ceo-desp-lista__cel-situacao">${situacaoHtml}</td>
          <td>${acoes}</td>
        </tr>`;
  }

  function renderListaDespesas() {
    fecharCeoPagExcelFiltroPopup();
    ensureCeoPagExcelBound();
    const body = document.getElementById("finCeoDespesasBody");
    const head = document.getElementById("finCeoDespesasHead");
    const wrap = document.getElementById("finCeoDespesasTableWrap");
    if (!body) return;

    if (head) head.innerHTML = `<tr>${buildCeoListaHeadHtml()}</tr>`;

    const linhasBase = coletarLinhasExcelListaDespesas();
    if (!linhasBase.length) {
      body.innerHTML =
        '<tr><td colspan="8" class="fin-ceo-desp-lista__vazia">Nenhuma despesa cadastrada — preencha o formulário acima e clique em <strong>Cadastrar despesa</strong>.</td></tr>';
      wrap?.classList.remove("fin-ceo-desp-lista--com-dados");
      renderTotaisEndividamentoLista([], []);
      return;
    }
    wrap?.classList.add("fin-ceo-desp-lista--com-dados");
    const linhas = aplicarCeoListaExcelFiltroSort(linhasBase);
    if (!linhas.length) {
      body.innerHTML =
        '<tr><td colspan="8" class="fin-ceo-desp-lista__vazia subtext">Nenhum lançamento corresponde ao filtro das colunas — ajuste os filtros ▾ no cabeçalho.</td></tr>';
      renderTotaisEndividamentoLista([], linhasBase);
      return;
    }
    body.innerHTML = linhas.map(renderListaDespesaRowHtml).join("");
    renderTotaisEndividamentoLista(linhas, linhasBase);
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
    let cartaoCredito = document.getElementById("finCeoDespCartao")?.value || "";
    const descricao = String(document.getElementById("finCeoDespDescricao")?.value || "").trim();

    if (isParticulares(categoria)) {
      if (!tipoParticularValido(tipoParticular)) {
        if (fb) fb.textContent = "Selecione o tipo de despesa.";
        return null;
      }
      if (tipoParticularExigeCartao(tipoParticular)) {
        const card = upsertCartaoFromForm({ silent: true });
        cartaoCredito = card?.id || "";
        if (!card || !cartaoCredito) {
          if (fb) {
            fb.textContent =
              "Informe os 4 números finais, o banco e o CPF/CNPJ do cartão.";
          }
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

  function montarHtmlResumoDespesaConfirm(entry, editMeta) {
    const { tipo, desc } = detalheDespesaLista(entry);
    const pagos = expandirPagamentosDespesa(entry, entry.repeticoes);
    const total = pagos.reduce((s, p) => s + (Number(p.valor) || 0), 0);
    let escopoHtml = "";
    if (editMeta?.mode === "single") {
      escopoHtml = `<p class="fin-ceo-desp-confirm-escopo"><strong>Escopo:</strong> apenas o pagamento ${String(editMeta.pagamentoNumero).padStart(2, "0")} — parcelas anteriores e posteriores permanecem inalteradas.</p>`;
    } else if (editMeta?.mode === "future") {
      escopoHtml = `<p class="fin-ceo-desp-confirm-escopo"><strong>Escopo:</strong> pagamento ${String(editMeta.pagamentoNumero).padStart(2, "0")} e todos os seguintes da mesma série — parcelas anteriores permanecem inalteradas.</p>`;
    }
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
    return `${escopoHtml}<dl class="fin-ceo-desp-confirm-dl">${dl}</dl>
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
    const titulo = document.getElementById("finCeoDespConfirmTitulo");
    const lead = document.querySelector("#finCeoDespConfirmModal .fin-ceo-desp-confirm-lead");
    if (titulo) titulo.textContent = "Confirmar cadastro de despesa";
    if (lead) lead.textContent = "Revise os dados abaixo antes de gravar na nuvem.";
  }

  function abrirModalConfirmDespesa(entry, editMeta = null) {
    finCeoDespConfirmPending = { entry, edit: editMeta };
    const resumo = document.getElementById("finCeoDespConfirmResumo");
    if (resumo) resumo.innerHTML = montarHtmlResumoDespesaConfirm(entry, editMeta);
    const titulo = document.getElementById("finCeoDespConfirmTitulo");
    const lead = document.querySelector("#finCeoDespConfirmModal .fin-ceo-desp-confirm-lead");
    if (editMeta?.mode === "single") {
      if (titulo) {
        titulo.textContent = `Confirmar edição — pagamento ${String(editMeta.pagamentoNumero).padStart(2, "0")}`;
      }
      if (lead) lead.textContent = "Revise os dados abaixo antes de gravar esta parcela alterada.";
    } else if (editMeta?.mode === "future") {
      if (titulo) titulo.textContent = "Confirmar edição — deste pagamento em diante";
      if (lead) lead.textContent = "Revise os dados abaixo antes de gravar a série futura alterada.";
    } else {
      if (titulo) titulo.textContent = "Confirmar cadastro de despesa";
      if (lead) lead.textContent = "Revise os dados abaixo antes de gravar na nuvem.";
    }
    const modal = document.getElementById("finCeoDespConfirmModal");
    if (!modal) {
      if (editMeta) persistirDespesaEdicao(entry, editMeta);
      else persistirDespesaEntry(entry);
      return;
    }
    modal.classList.remove("hidden");
    modal.setAttribute("aria-hidden", "false");
    document.getElementById("finCeoDespConfirmSimBtn")?.focus();
  }

  function persistirDespesaEdicao(entry, editMeta) {
    const fb = document.getElementById("finCeoDespFeedback");
    let list = loadDespesasCeo();
    const result =
      editMeta.mode === "single"
        ? aplicarEditarEvento(list, editMeta.despesaId, editMeta.pagamentoNumero, entry)
        : aplicarEditarFuturo(list, editMeta.despesaId, editMeta.pagamentoNumero, entry);
    if (!result.ok) {
      if (fb) fb.textContent = "Não foi possível aplicar a edição — despesa não encontrada.";
      return;
    }
    ultimaDespesaSalvaId = result.savedId || entry.id;
    saveDespesasCeo(result.list);
    const pagos = expandirPagamentosDespesa(entry, entry.repeticoes);
    const escopo =
      editMeta.mode === "single"
        ? `pagamento ${String(editMeta.pagamentoNumero).padStart(2, "0")} atualizado`
        : `${pagos.length} pagamento(s) futuro(s) atualizado(s)`;
    const msg = `Despesa editada — ${escopo} (1ª ${fmtBrDate(entry.dataEvento)} · ${brl(entry.valor)}). Veja na tabela abaixo.`;
    finCeoDespEditState = null;
    limparFormDespesa();
    if (fb) fb.textContent = msg;
    renderListaDespesas();
    renderResumoCadastroDespesas();
    renderDashboard();
    if (paneAberto === "relatorio") aplicarRelatorio();
    if (paneAberto === "grafico-despesas") renderGraficoDespesas();
    document.getElementById("finCeoDespesasTableWrap")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
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
    if (paneAberto === "grafico-despesas") renderGraficoDespesas();
    document.getElementById("finCeoDespesasTableWrap")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function confirmarDespesaModal() {
    const pending = finCeoDespConfirmPending;
    if (!pending) return;
    const entry = pending.entry || pending;
    const editMeta = pending.edit || null;
    fecharModalConfirmDespesa();
    if (editMeta) persistirDespesaEdicao(entry, editMeta);
    else persistirDespesaEntry(entry);
  }

  function salvarDespesaForm(ev) {
    ev?.preventDefault();
    const fb = document.getElementById("finCeoDespFeedback");
    if (fb && !finCeoDespEditState) fb.textContent = "";
    const entry = coletarEntryDespesaForm(fb);
    if (!entry) return;
    abrirModalConfirmDespesa(entry, finCeoDespEditState ? { ...finCeoDespEditState } : null);
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
    return despesas.flatMap((d) => expandirPagamentosDespesa(d, repFiltro || d.repeticoes));
  }

  function nkRel(s) {
    return String(s ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  }

  const CEO_PAG_COLS = [
    { key: "pagamento", label: "Pagamento", type: "num" },
    { key: "data", label: "Data", type: "date" },
    { key: "valor", label: "Valor", type: "num" },
    { key: "categoria", label: "Categoria", type: "text" },
    { key: "rubrica", label: "Rubrica / Tipo", type: "text" },
    { key: "detalhe", label: "Detalhe", type: "text" },
  ];
  const CEO_REL_COLS = CEO_PAG_COLS;

  const CEO_LISTA_COLS = [
    ...CEO_PAG_COLS,
    { key: "situacao", label: "Situação", type: "text" },
  ];

  let ceoRelExcelState = {
    sortKey: "data",
    sortDir: "desc",
    cols: {},
  };
  let ceoListaExcelState = {
    sortKey: CEO_LISTA_SORT_VENCIMENTO,
    sortDir: "asc",
    cols: {},
  };
  const CEO_GRAF_COLS = [
    { key: "despesa", label: "Despesa", type: "text" },
    { key: "categoria", label: "Categoria", type: "text" },
    { key: "repeticoes", label: "Repetições", type: "num" },
    { key: "inicio", label: "Início", type: "date" },
    { key: "fim", label: "Fim", type: "date" },
    { key: "valorMensal", label: "Valor mensal", type: "num" },
    { key: "totalSerie", label: "Total da série", type: "num" },
  ];
  let ceoGrafExcelState = {
    sortKey: CEO_GRAF_SORT_NATURAL,
    sortDir: "asc",
    cols: {},
  };
  const ceoPagExcelOpen = { rel: "", lista: "", graf: "" };
  let ceoPagExcelBoundDoc = false;

  function resetCeoRelExcelFiltros() {
    ceoRelExcelState.cols = {};
  }

  function ceoRelLinhaFromPagamento(p) {
    const { tipo, desc } = detalheDespesaLista(p.despesa);
    return {
      pagamento: p.numero,
      pagamentoLabel: `PAGAMENTO ${String(p.numero).padStart(2, "0")}`,
      data: p.data,
      dataLabel: fmtBrDate(p.data),
      valor: p.valor,
      valorLabel: brl(p.valor),
      categoria: labelCategoria(p.despesa.categoria),
      rubrica: tipo,
      detalhe: desc,
      _pag: p,
    };
  }

  function ceoRelCellDisplay(row, key, cols = CEO_PAG_COLS) {
    const col = cols.find((c) => c.key === key);
    if (!col) return "";
    if (key === "pagamento") return row.pagamentoLabel;
    if (key === "data") return row.dataLabel;
    if (key === "valor") return row.valorLabel;
    if (key === "situacao") return row.situacaoLabel || labelSituacaoPagamento(row.situacao);
    if (key === "despesa") return String(row.despesa ?? row.label ?? "—");
    if (key === "inicio") return row.inicioLabel || fmtBrDate(row.inicio);
    if (key === "fim") return row.fimLabel || fmtBrDate(row.fim);
    if (key === "valorMensal") return row.valorMensalLabel || brl(row.valorMensal);
    if (key === "totalSerie") return row.totalSerieLabel || brl(row.totalSerie);
    if (key === "repeticoes") return String(row.repeticoes ?? "—");
    return String(row[key] ?? "—");
  }

  function ceoRelCellSortValue(row, key, cols = CEO_PAG_COLS) {
    const col = cols.find((c) => c.key === key);
    if (key === "situacao") return row.situacao === "PAGO" ? 1 : 0;
    if (key === "inicio") return row.inicio?.getTime?.() || 0;
    if (key === "fim") return row.fim?.getTime?.() || 0;
    if (key === "valorMensal") return Number(row.valorMensal) || 0;
    if (key === "totalSerie") return Number(row.totalSerie) || 0;
    if (col?.type === "num") return Number(row[key]) || 0;
    if (col?.type === "date") return row.data?.getTime() || 0;
    return nkRel(String(row[key] ?? ""));
  }

  function ceoPagColFilterActive(state, key) {
    return state.cols[key] instanceof Set;
  }

  function ceoRelColFilterActive(key) {
    return ceoPagColFilterActive(ceoRelExcelState, key);
  }

  function ceoListaColFilterActive(key) {
    return ceoPagColFilterActive(ceoListaExcelState, key);
  }

  function ceoRelSortLabels(col) {
    if (col.type === "num") return { asc: "↑ Do menor para o maior", desc: "↓ Do maior para o menor" };
    if (col.type === "date") return { asc: "↑ Mais antigo primeiro", desc: "↓ Mais recente primeiro" };
    return { asc: "↑ Ordenar A a Z", desc: "↓ Ordenar Z a A" };
  }

  function ordenarLinhasListaPorVencimento(rows) {
    return (rows || []).slice().sort((a, b) => {
      const sa = a.situacao === "PAGO" ? 1 : 0;
      const sb = b.situacao === "PAGO" ? 1 : 0;
      if (sa !== sb) return sa - sb;
      const ta = a.data?.getTime() || 0;
      const tb = b.data?.getTime() || 0;
      if (ta !== tb) return ta - tb;
      return (a.pagamento || 0) - (b.pagamento || 0);
    });
  }

  function aplicarCeoPagExcelFiltroSort(rows, state, cols = CEO_PAG_COLS) {
    let out = (rows || []).slice();
    cols.forEach((col) => {
      const set = state.cols[col.key];
      if (!(set instanceof Set)) return;
      out = out.filter((r) => set.has(ceoRelCellDisplay(r, col.key, cols)));
    });
    const sk = state.sortKey || "data";
    if (sk === CEO_LISTA_SORT_VENCIMENTO) {
      return ordenarLinhasListaPorVencimento(out);
    }
    const dir = state.sortDir === "desc" ? -1 : 1;
    out.sort((a, b) => {
      const va = ceoRelCellSortValue(a, sk, cols);
      const vb = ceoRelCellSortValue(b, sk, cols);
      if (typeof va === "number" && typeof vb === "number") {
        if (va !== vb) return (va - vb) * dir;
      } else {
        const cmp = String(va).localeCompare(String(vb), "pt-BR");
        if (cmp) return cmp * dir;
      }
      const pa = a.pagamento || 0;
      const pb = b.pagamento || 0;
      if (pa !== pb) return (pa - pb) * dir;
      return (a.data?.getTime() || 0) - (b.data?.getTime() || 0);
    });
    return out;
  }

  function aplicarCeoListaExcelFiltroSort(rows) {
    return aplicarCeoPagExcelFiltroSort(rows, ceoListaExcelState, CEO_LISTA_COLS);
  }

  function aplicarCeoRelExcelFiltroSort(rows) {
    return aplicarCeoPagExcelFiltroSort(rows, ceoRelExcelState);
  }

  function ceoGrafLinhaFromRow(r) {
    return {
      despesa: r.label,
      categoria: r.categoriaLabel,
      repeticoes: r.repeticoes,
      inicio: r.inicio,
      inicioLabel: fmtBrDate(r.inicio),
      fim: r.fim,
      fimLabel: fmtBrDate(r.fim),
      valorMensal: r.valor,
      valorMensalLabel: brl(r.valor),
      totalSerie: r.totalSerie,
      totalSerieLabel: brl(r.totalSerie),
      _row: r,
    };
  }

  function aplicarCeoGrafExcelFiltroSort(rows) {
    let out = (rows || []).slice();
    CEO_GRAF_COLS.forEach((col) => {
      const set = ceoGrafExcelState.cols[col.key];
      if (!(set instanceof Set)) return;
      out = out.filter((r) => set.has(ceoRelCellDisplay(r, col.key, CEO_GRAF_COLS)));
    });
    if (ceoGrafExcelState.sortKey === CEO_GRAF_SORT_NATURAL) return out;
    return aplicarCeoPagExcelFiltroSort(out, ceoGrafExcelState, CEO_GRAF_COLS);
  }

  function ceoGrafColFilterActive(key) {
    return ceoPagColFilterActive(ceoGrafExcelState, key);
  }

  function ceoGrafTemFiltroColunaAtivo() {
    return CEO_GRAF_COLS.some((c) => ceoGrafColFilterActive(c.key));
  }

  function somarTotaisMesLinhasGrafico(rows) {
    const totaisPorMes = new Map();
    (rows || []).forEach((r) => {
      (r.pagos || []).forEach((p) => {
        const key = monthKey(p.data);
        totaisPorMes.set(key, (totaisPorMes.get(key) || 0) + (Number(p.valor) || 0));
      });
    });
    return totaisPorMes;
  }

  function ceoPagValoresUnicosColuna(rows, key, cols = CEO_PAG_COLS) {
    const map = new Map();
    (rows || []).forEach((r) => {
      const label = ceoRelCellDisplay(r, key, cols);
      if (!map.has(label)) map.set(label, ceoRelCellSortValue(r, key, cols));
    });
    return Array.from(map.entries())
      .sort((a, b) => {
        const col = cols.find((c) => c.key === key);
        if (col?.type === "num" || col?.type === "date") return (Number(a[1]) || 0) - (Number(b[1]) || 0);
        if (key === "situacao") return (Number(a[1]) || 0) - (Number(b[1]) || 0);
        return String(a[0]).localeCompare(String(b[0]), "pt-BR");
      })
      .map(([label]) => label);
  }

  function ceoRelValoresUnicosColuna(rows, key) {
    return ceoPagValoresUnicosColuna(rows, key);
  }

  function fecharCeoPagExcelFiltroPopup() {
    ceoPagExcelOpen.rel = "";
    ceoPagExcelOpen.lista = "";
    ceoPagExcelOpen.graf = "";
    document.querySelectorAll(".fin-excel-filter-pop").forEach((el) => el.remove());
    document.querySelectorAll(".fin-excel-filter-btn.is-open").forEach((b) => b.classList.remove("is-open"));
  }

  function fecharCeoRelExcelFiltroPopup() {
    fecharCeoPagExcelFiltroPopup();
  }

  function ceoPagLinhasBaseAntesDaColuna(openKey, rows, state, cols = CEO_PAG_COLS) {
    let out = (rows || []).slice();
    cols.forEach((col) => {
      if (col.key === openKey) return;
      const set = state.cols[col.key];
      if (!(set instanceof Set)) return;
      out = out.filter((r) => set.has(ceoRelCellDisplay(r, col.key, cols)));
    });
    return out;
  }

  function ceoRelLinhasBaseAntesDaColuna(openKey, rows) {
    return ceoPagLinhasBaseAntesDaColuna(openKey, rows, ceoRelExcelState, CEO_PAG_COLS);
  }

  function abrirCeoPagExcelFiltroPopup(scope, btn, key, rows, state, onRerender, cols = CEO_PAG_COLS) {
    fecharCeoPagExcelFiltroPopup();
    const col = cols.find((c) => c.key === key);
    if (!col || !btn) return;
    ceoPagExcelOpen[scope] = key;
    btn.classList.add("is-open");
    const baseRows = ceoPagLinhasBaseAntesDaColuna(key, rows, state, cols);
    const uniques = ceoPagValoresUnicosColuna(baseRows, key, cols);
    const selected = state.cols[key];
    const isAll = !(selected instanceof Set);
    const sortLbl = ceoRelSortLabels(col);
    const pop = document.createElement("div");
    pop.className = "fin-excel-filter-pop";
    pop.setAttribute("role", "dialog");
    pop.setAttribute("aria-label", `Filtro ${col.label}`);
    pop.innerHTML = `
      <div class="fin-excel-filter-pop__sort">
        <button type="button" class="fin-excel-filter-pop__sort-btn" data-excel-sort="asc">${esc(sortLbl.asc)}</button>
        <button type="button" class="fin-excel-filter-pop__sort-btn" data-excel-sort="desc">${esc(sortLbl.desc)}</button>
      </div>
      <label class="fin-excel-filter-pop__search">
        <input type="search" placeholder="Pesquisar…" autocomplete="off" aria-label="Pesquisar valores" data-excel-search>
      </label>
      <label class="fin-excel-filter-pop__all"><input type="checkbox" data-excel-all ${isAll ? "checked" : ""}> (Selecionar tudo)</label>
      <div class="fin-excel-filter-pop__list" data-excel-list>
        ${uniques
          .map((v, i) => {
            const checked = isAll || selected.has(v) ? "checked" : "";
            return `<label class="fin-excel-filter-pop__item"><input type="checkbox" data-excel-idx="${i}" ${checked}> <span>${esc(v)}</span></label>`;
          })
          .join("") || `<p class="subtext">Sem valores.</p>`}
      </div>
      <div class="fin-excel-filter-pop__actions">
        <button type="button" class="btn-primary" data-excel-ok>OK</button>
        <button type="button" class="btn-primary btn-secondary-outline" data-excel-cancel>Cancelar</button>
        <button type="button" class="btn-primary btn-secondary-outline" data-excel-clear>Limpar</button>
      </div>`;
    document.body.appendChild(pop);
    const rect = btn.getBoundingClientRect();
    const popW = Math.max(260, Math.min(340, window.innerWidth - 16));
    let left = rect.left;
    if (left + popW > window.innerWidth - 8) left = Math.max(8, window.innerWidth - popW - 8);
    const top = rect.bottom + 4;
    pop.style.width = `${popW}px`;
    pop.style.left = `${left}px`;
    pop.style.top = `${top}px`;
    requestAnimationFrame(() => {
      const h = pop.offsetHeight;
      if (top + h > window.innerHeight - 8) {
        pop.style.top = `${Math.max(8, rect.top - h - 4)}px`;
      }
    });

    const rerender = () => {
      fecharCeoPagExcelFiltroPopup();
      onRerender();
    };

    const search = pop.querySelector("[data-excel-search]");
    const allCb = pop.querySelector("[data-excel-all]");
    const syncAll = () => {
      const boxes = Array.from(pop.querySelectorAll("[data-excel-idx]"));
      const visible = boxes.filter((el) => el.closest(".fin-excel-filter-pop__item")?.style.display !== "none");
      allCb.checked = visible.length > 0 && visible.every((el) => el.checked);
    };
    search?.addEventListener("input", () => {
      const q = nkRel(search.value);
      pop.querySelectorAll(".fin-excel-filter-pop__item").forEach((lab) => {
        const t = nkRel(lab.textContent || "");
        lab.style.display = !q || t.includes(q) ? "" : "none";
      });
      syncAll();
    });
    allCb?.addEventListener("change", () => {
      pop.querySelectorAll(".fin-excel-filter-pop__item").forEach((lab) => {
        if (lab.style.display === "none") return;
        const cb = lab.querySelector("[data-excel-idx]");
        if (cb) cb.checked = allCb.checked;
      });
    });
    pop.querySelector("[data-excel-list]")?.addEventListener("change", syncAll);
    pop.querySelector("[data-excel-sort='asc']")?.addEventListener("click", () => {
      state.sortKey = key;
      state.sortDir = "asc";
      rerender();
    });
    pop.querySelector("[data-excel-sort='desc']")?.addEventListener("click", () => {
      state.sortKey = key;
      state.sortDir = "desc";
      rerender();
    });
    pop.querySelector("[data-excel-ok]")?.addEventListener("click", () => {
      const boxes = Array.from(pop.querySelectorAll("[data-excel-idx]"));
      const visible = boxes.filter((el) => el.closest(".fin-excel-filter-pop__item")?.style.display !== "none");
      const pool = visible.length ? visible : boxes;
      const checked = pool
        .filter((el) => el.checked)
        .map((el) => uniques[Number(el.getAttribute("data-excel-idx"))])
        .filter((v) => v != null);
      if (!checked.length || checked.length === pool.length) {
        delete state.cols[key];
      } else {
        state.cols[key] = new Set(checked);
      }
      rerender();
    });
    pop.querySelector("[data-excel-cancel]")?.addEventListener("click", () => fecharCeoPagExcelFiltroPopup());
    pop.querySelector("[data-excel-clear]")?.addEventListener("click", () => {
      delete state.cols[key];
      if (state.sortKey === key) {
        if (scope === "lista") {
          state.sortKey = CEO_LISTA_SORT_VENCIMENTO;
          state.sortDir = "asc";
        } else if (scope === "graf") {
          state.sortKey = CEO_GRAF_SORT_NATURAL;
          state.sortDir = "asc";
        } else {
          state.sortKey = "data";
          state.sortDir = "desc";
        }
      }
      rerender();
    });
    search?.focus();
  }

  function abrirCeoRelExcelFiltroPopup(btn, key, rows) {
    abrirCeoPagExcelFiltroPopup("rel", btn, key, rows, ceoRelExcelState, aplicarRelatorio);
  }

  function buildCeoPagHeadHtml(state, colAttr, colFilterFn, cols = CEO_PAG_COLS) {
    return cols
      .map((col) => {
        const active = colFilterFn(col.key) || state.sortKey === col.key;
        const situCls = col.key === "situacao" ? " fin-ceo-desp-lista__col-situacao" : "";
        return `<th class="fin-excel-th${situCls}${active ? " fin-excel-th--active" : ""}" scope="col">
        <span class="fin-excel-th__label">${esc(col.label)}</span>
        <button type="button" class="fin-excel-filter-btn${colFilterFn(col.key) ? " is-filtered" : ""}" ${colAttr}="${esc(col.key)}" title="Filtro estilo Excel" aria-label="Filtro de ${esc(col.label)}">▾</button>
      </th>`;
      })
      .join("");
  }

  function buildCeoRelHeadHtml() {
    return buildCeoPagHeadHtml(ceoRelExcelState, "data-ceo-rel-excel-col", ceoRelColFilterActive);
  }

  function buildCeoListaHeadHtml() {
    return (
      buildCeoPagHeadHtml(ceoListaExcelState, "data-ceo-lista-excel-col", ceoListaColFilterActive, CEO_LISTA_COLS) +
      '<th class="fin-ceo-desp-lista__col-acoes" scope="col"><span class="fin-excel-th__label">Ações</span></th>'
    );
  }

  function buildCeoGrafHeadHtml() {
    return buildCeoPagHeadHtml(ceoGrafExcelState, "data-ceo-graf-excel-col", ceoGrafColFilterActive, CEO_GRAF_COLS);
  }

  function bindCeoPagExcelFiltros() {
    const paneRel = document.getElementById("finCeoPaneRelatorio");
    paneRel?.addEventListener("click", (e) => {
      const btn = e.target?.closest?.("[data-ceo-rel-excel-col]");
      if (!btn || !paneRel.contains(btn)) return;
      e.preventDefault();
      e.stopPropagation();
      const key = btn.getAttribute("data-ceo-rel-excel-col") || "";
      if (ceoPagExcelOpen.rel === key) {
        fecharCeoPagExcelFiltroPopup();
        return;
      }
      const despesas = filtrarDespesasRelatorio();
      abrirCeoRelExcelFiltroPopup(
        btn,
        key,
        montarPagamentosRelatorio(despesas).map(ceoRelLinhaFromPagamento)
      );
    });

    const paneLista = document.getElementById("finCeoPaneDespesas");
    paneLista?.addEventListener("click", (e) => {
      const btn = e.target?.closest?.("[data-ceo-lista-excel-col]");
      if (!btn || !paneLista.contains(btn)) return;
      e.preventDefault();
      e.stopPropagation();
      const key = btn.getAttribute("data-ceo-lista-excel-col") || "";
      if (ceoPagExcelOpen.lista === key) {
        fecharCeoPagExcelFiltroPopup();
        return;
      }
      abrirCeoPagExcelFiltroPopup("lista", btn, key, coletarLinhasExcelListaDespesas(), ceoListaExcelState, renderListaDespesas, CEO_LISTA_COLS);
    });

    const paneGraf = document.getElementById("finCeoPaneGraficoDespesas");
    paneGraf?.addEventListener("click", (e) => {
      const btn = e.target?.closest?.("[data-ceo-graf-excel-col]");
      if (!btn || !paneGraf.contains(btn)) return;
      e.preventDefault();
      e.stopPropagation();
      const key = btn.getAttribute("data-ceo-graf-excel-col") || "";
      if (ceoPagExcelOpen.graf === key) {
        fecharCeoPagExcelFiltroPopup();
        return;
      }
      const { rows } = coletarLinhasGraficoDespesas();
      abrirCeoPagExcelFiltroPopup(
        "graf",
        btn,
        key,
        rows.map(ceoGrafLinhaFromRow),
        ceoGrafExcelState,
        renderGraficoDespesas,
        CEO_GRAF_COLS
      );
    });

    if (!ceoPagExcelBoundDoc) {
      ceoPagExcelBoundDoc = true;
      document.addEventListener("mousedown", (e) => {
        if (!ceoPagExcelOpen.rel && !ceoPagExcelOpen.lista && !ceoPagExcelOpen.graf) return;
        const pop = document.querySelector(".fin-excel-filter-pop");
        const t = e.target;
        if (pop?.contains(t)) return;
        if (t?.closest?.("[data-ceo-rel-excel-col]")) return;
        if (t?.closest?.("[data-ceo-lista-excel-col]")) return;
        if (t?.closest?.("[data-ceo-graf-excel-col]")) return;
        fecharCeoPagExcelFiltroPopup();
      });
      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && (ceoPagExcelOpen.rel || ceoPagExcelOpen.lista || ceoPagExcelOpen.graf)) {
          fecharCeoPagExcelFiltroPopup();
        }
      });
    }
  }

  let ceoPagExcelBound = false;
  function ensureCeoPagExcelBound() {
    if (ceoPagExcelBound) return;
    ceoPagExcelBound = true;
    bindCeoPagExcelFiltros();
  }

  let ceoRelExcelPaneBound = false;
  function ensureCeoRelExcelPaneBound() {
    ensureCeoPagExcelBound();
    ceoRelExcelPaneBound = true;
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
    if (ev) resetCeoRelExcelFiltros();
    fecharCeoRelExcelFiltroPopup();
    ensureCeoRelExcelPaneBound();
    const despesas = filtrarDespesasRelatorio();
    const pagamentos = montarPagamentosRelatorio(despesas);
    const linhasBase = pagamentos.map(ceoRelLinhaFromPagamento);
    const linhas = aplicarCeoRelExcelFiltroSort(linhasBase);
    const body = document.getElementById("finCeoRelBody");
    const head = document.getElementById("finCeoRelHead");
    const vazia = document.getElementById("finCeoRelVazia");
    const resumo = document.getElementById("finCeoRelResumo");
    if (!body) return;

    if (head) head.innerHTML = `<tr>${buildCeoRelHeadHtml()}</tr>`;

    const totalPagamentos = linhas.reduce((s, r) => s + r.valor, 0);
    const colFiltroAtivo = CEO_PAG_COLS.some((c) => ceoRelColFilterActive(c.key));
    const resumoFiltroCol = colFiltroAtivo && linhasBase.length !== linhas.length ? ` · ${linhas.length} de ${linhasBase.length} após filtro das colunas` : "";

    if (resumo) {
      resumo.textContent = pagamentos.length
        ? linhas.length
          ? `${linhas.length} pagamento(s) · ${despesas.length} lançamento(s) · total: ${brl(totalPagamentos)}${resumoFiltroCol}`
          : "Nenhum valor corresponde ao filtro das colunas — ajuste os filtros ▾ no cabeçalho."
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
    if (!linhas.length) {
      body.innerHTML = `<tr><td colspan="${CEO_PAG_COLS.length}" class="subtext">Nenhum valor corresponde ao filtro das colunas.</td></tr>`;
      vazia?.classList.add("hidden");
      return;
    }
    vazia?.classList.add("hidden");
    body.innerHTML = linhas
      .map((r) => {
        return `<tr>
          <td><strong>${esc(r.pagamentoLabel)}</strong></td>
          <td>${esc(r.dataLabel)}</td>
          <td>${esc(r.valorLabel)}</td>
          <td>${esc(r.categoria)}</td>
          <td>${esc(r.rubrica)}</td>
          <td>${esc(r.detalhe)}</td>
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
    resetCeoRelExcelFiltros();
    ceoRelExcelState.sortKey = "data";
    ceoRelExcelState.sortDir = "desc";
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
    if (paneAberto === "grafico-despesas") renderGraficoDespesas();
  }

  function mesLabelCurtoCeo(d) {
    if (!(d instanceof Date) || Number.isNaN(d.getTime())) return "—";
    return `${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
  }

  function monthIndexFromBaseCeo(base, d) {
    return (d.getFullYear() - base.getFullYear()) * 12 + (d.getMonth() - base.getMonth());
  }

  function fillClassGraficoDespesa(catId) {
    if (catId === "DK_CONSTRUTORA") return "fin-ceo-desp-graf__fill--construtora";
    if (catId === "DK_CENTRO_AUTOMOTIVO") return "fin-ceo-desp-graf__fill--centro";
    if (catId === "PARTICULARES") return "fin-ceo-desp-graf__fill--part";
    return "fin-ceo-desp-graf__fill--locadora";
  }

  function labelLinhaGraficoDespesa(d) {
    const detalhe = String(d.descricao || "").trim();
    const base = isParticulares(d.categoria)
      ? labelTipoParticular(d.tipoParticular || inferirTipoParticularLegado(d))
      : labelRubrica(d.rubrica);
    const nome = detalhe ? `${base} · ${detalhe}` : base;
    return `${brl(d.valor)} ${nome}`;
  }

  function coletarLinhasGraficoDespesas() {
    const agora = new Date();
    const base = new Date(agora.getFullYear(), agora.getMonth(), 1);
    const list = loadDespesasCeo().map(normalizeDespesa);
    const totaisPorMes = new Map();
    const rows = [];
    let maxIdx = 11;

    list.forEach((d) => {
      const pagos = expandirPagamentosDespesa(d, d.repeticoes);
      if (!pagos.length) return;
      let startIdx = Infinity;
      let endIdx = -Infinity;
      pagos.forEach((p) => {
        const idx = monthIndexFromBaseCeo(base, p.data);
        startIdx = Math.min(startIdx, idx);
        endIdx = Math.max(endIdx, idx);
        const key = monthKey(p.data);
        totaisPorMes.set(key, (totaisPorMes.get(key) || 0) + (Number(p.valor) || 0));
        if (idx > maxIdx) maxIdx = idx;
      });
      if (!Number.isFinite(startIdx)) return;
      rows.push({
        id: d.id,
        label: labelLinhaGraficoDespesa(d),
        categoria: d.categoria,
        categoriaLabel: labelCategoria(d.categoria),
        repeticoes: d.repeticoes,
        valor: d.valor,
        startIdx,
        endIdx,
        inicio: pagos[0].data,
        fim: pagos[pagos.length - 1].data,
        totalSerie: pagos.reduce((s, p) => s + (Number(p.valor) || 0), 0),
        pagos,
      });
    });

    const horizonte = Math.max(12, maxIdx + 1);
    rows.sort((a, b) => {
      const ia = CATEGORIAS_CEO.findIndex((c) => c.id === a.categoria);
      const ib = CATEGORIAS_CEO.findIndex((c) => c.id === b.categoria);
      if (ia !== ib) return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
      if (b.repeticoes !== a.repeticoes) return b.repeticoes - a.repeticoes;
      return a.label.localeCompare(b.label, "pt-BR");
    });
    return { base, horizonte, rows, totaisPorMes };
  }

  /** Totais de 3 em 3 meses: soma só do mês determinado (09/2026, 12/2026, 03/2027), não do trimestre. */
  function renderGraficoDespesas() {
    const chart = document.getElementById("finCeoGraficoDespesasChart");
    const tabela = document.getElementById("finCeoGraficoDespesasTabela");
    if (!chart) return;
    ensureCeoPagExcelBound();
    const { base, horizonte, rows: rowsBase } = coletarLinhasGraficoDespesas();
    if (!rowsBase.length) {
      chart.innerHTML = `<p class="subtext">Nenhuma despesa cadastrada ainda — use Cadastro de despesas.</p>`;
      if (tabela) tabela.innerHTML = "";
      return;
    }

    const excelBase = rowsBase.map(ceoGrafLinhaFromRow);
    const excelFiltradas = aplicarCeoGrafExcelFiltroSort(excelBase);
    const rows = excelFiltradas.map((r) => r._row);
    const totaisPorMes = somarTotaisMesLinhasGrafico(rows);
    const filtroAtivo = ceoGrafTemFiltroColunaAtivo() || rows.length !== rowsBase.length;

    const ticks = [];
    for (let i = 0; i < horizonte; i += 1) {
      if (i % 3 !== 0) continue;
      const mes = new Date(base.getFullYear(), base.getMonth() + i, 1);
      const tot = totaisPorMes.get(monthKey(mes)) || 0;
      const left = ((i + 0.5) / horizonte) * 100;
      const rotuloMes = mesLabelCurtoCeo(mes);
      ticks.push(
        `<span class="fin-ceo-desp-graf__tick" style="left:${left.toFixed(3)}%" title="Soma só do mês ${rotuloMes} (não do trimestre)">
          <span class="fin-ceo-desp-graf__total">${esc(brl(tot))}</span>
          <span class="fin-ceo-desp-graf__mes">${esc(rotuloMes)}</span>
        </span>`
      );
    }

    const blocks = [];
    if (!rows.length) {
      blocks.push(
        `<p class="subtext fin-ceo-desp-graf__filtro-vazio">Nenhuma despesa no filtro ▾ — ajuste as colunas da tabela. O gráfico e os totais do mês usam só o que estiver filtrado.</p>`
      );
    } else {
      let lastCat = "";
      rows.forEach((r) => {
        if (r.categoria !== lastCat) {
          lastCat = r.categoria;
          blocks.push(`<div class="fin-ceo-desp-graf__group">${esc(r.categoriaLabel)}</div>`);
        }
        const clipStart = Math.max(0, r.startIdx);
        const clipEnd = Math.min(horizonte - 1, r.endIdx);
        const span = Math.max(0, clipEnd - clipStart + 1);
        const left = (clipStart / horizonte) * 100;
        const width = span > 0 ? (span / horizonte) * 100 : 0;
        const mesesTxt = r.repeticoes === 1 ? "1 mês" : `${r.repeticoes} meses`;
        blocks.push(`<div class="fin-ceo-desp-graf__row">
        <span class="fin-ceo-desp-graf__lab" title="${esc(r.label)}">${esc(r.label)}</span>
        <span class="fin-ceo-desp-graf__track">
          <span class="fin-ceo-desp-graf__fill ${fillClassGraficoDespesa(r.categoria)}" style="left:${left.toFixed(3)}%;width:${Math.max(width, 1.2).toFixed(3)}%"></span>
        </span>
        <span class="fin-ceo-desp-graf__val">${esc(mesesTxt)}</span>
      </div>`);
      });
    }

    const hintFiltro = filtroAtivo
      ? `<p class="subtext fin-ceo-desp-graf__filtro-hint">Gráfico e totais do mês com o filtro ▾ da tabela: ${rows.length} de ${rowsBase.length} despesa(s).</p>`
      : "";
    const corpoTabela = rows.length
      ? rows
          .map(
            (r) => `<tr>
            <td>${esc(r.label)}</td>
            <td>${esc(r.categoriaLabel)}</td>
            <td>${esc(String(r.repeticoes))}</td>
            <td>${esc(fmtBrDate(r.inicio))}</td>
            <td>${esc(fmtBrDate(r.fim))}</td>
            <td>${esc(brl(r.valor))}</td>
            <td>${esc(brl(r.totalSerie))}</td>
          </tr>`
          )
          .join("")
      : `<tr><td colspan="7" class="subtext">Nenhuma despesa corresponde ao filtro ▾ — ajuste as colunas.</td></tr>`;
    const tableHtml = `<table class="fin-table fin-table--excel-cols fin-ceo-desp-graf__table" id="finCeoGraficoDespesasTable">
        <thead><tr>${buildCeoGrafHeadHtml()}</tr></thead>
        <tbody>${corpoTabela}</tbody>
      </table>`;
    chart.innerHTML = `<div class="fin-ceo-desp-graf">
      <div class="fin-ceo-desp-graf__head">
        <span class="fin-ceo-desp-graf__lab-spacer"></span>
        <div class="fin-ceo-desp-graf__axis">${ticks.join("")}</div>
        <span class="fin-ceo-desp-graf__val-spacer"></span>
      </div>
      <div class="fin-ceo-desp-graf__body" id="finCeoGraficoDespesasBody">${blocks.join("")}${hintFiltro}${tableHtml}</div>
    </div>`;
    if (tabela) tabela.innerHTML = "";
    bindGraficoDespesasScroll();
  }

  function bindGraficoDespesasScroll() {
    const pane = document.getElementById("finCeoPaneGraficoDespesas");
    if (!pane || pane.__dkGrafScrollBound) return;
    pane.__dkGrafScrollBound = true;
    pane.addEventListener(
      "wheel",
      (ev) => {
        const body = document.getElementById("finCeoGraficoDespesasBody");
        if (!body) return;
        ev.preventDefault();
        body.scrollTop += ev.deltaY;
      },
      { passive: false }
    );
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
    if (id === "dashboard") {
      bindMascarasCeo(document.getElementById("finCeoPaneDashboard"));
      renderDashboard();
    }
    if (id === "periodo") {
      bindMascarasCeo(document.getElementById("finCeoPanePeriodo"));
      bindCalendariosCeo(document.getElementById("finCeoPanePeriodo"));
      renderResumoPeriodoCeo();
    }
    if (id === "despesas") renderCadastroDespesas();
    if (id === "grafico-despesas") renderGraficoDespesas();
    if (id === "relatorio") renderRelatorio();
  }

  function bindOnce() {
    if (bound) return;
    bound = true;

    document.querySelectorAll("#finCeoModulosNav [data-ceo-mod]").forEach((btn) => {
      btn.addEventListener("click", () => abrirPane(btn.getAttribute("data-ceo-mod") || ""));
    });

    document.getElementById("finCeoDashAnosFiltro")?.addEventListener("click", (ev) => {
      const btn = ev.target.closest("[data-ceo-ano]");
      if (!btn) return;
      const ano = Number(btn.getAttribute("data-ceo-ano"));
      if (ano) toggleCeoDashAno(ano);
    });

    document.getElementById("finCeoPeriodoAtualizarBtn")?.addEventListener("click", () => {
      renderResumoPeriodoCeo();
    });
    ["finCeoPeriodoInicio", "finCeoPeriodoFim"].forEach((id) => {
      const inp = document.getElementById(id);
      if (!inp) return;
      inp.addEventListener("change", () => renderResumoPeriodoCeo());
      inp.addEventListener("blur", () => renderResumoPeriodoCeo());
    });

    const finaisInp = document.getElementById("finCeoDespCartaoFinais");
    if (finaisInp) {
      finaisInp.addEventListener("input", () => {
        finaisInp.value = onlyDigitsCeo(finaisInp.value).slice(0, 4);
        if (finaisInp.value.length === 4) {
          aplicarHistoricoCartaoPorFinais();
          memorizarFinaisCartao(finaisInp.value);
        }
      });
      finaisInp.addEventListener("blur", () => {
        memorizarFinaisCartao(finaisInp.value);
        aplicarHistoricoCartaoPorFinais();
        upsertCartaoFromForm({ silent: true });
      });
      finaisInp.addEventListener("change", () => {
        memorizarFinaisCartao(finaisInp.value);
        aplicarHistoricoCartaoPorFinais();
        upsertCartaoFromForm({ silent: true });
      });
    }
    const bancoInp = document.getElementById("finCeoDespCartaoBanco");
    if (bancoInp) {
      bancoInp.addEventListener("blur", () => {
        const b = normalizeBancoCartaoCeo(bancoInp.value);
        if (b) bancoInp.value = b;
        memorizarBancoCartao(b);
        upsertCartaoFromForm({ silent: true });
      });
      bancoInp.addEventListener("change", () => {
        const b = normalizeBancoCartaoCeo(bancoInp.value);
        if (b) bancoInp.value = b;
        memorizarBancoCartao(b);
        upsertCartaoFromForm({ silent: true });
      });
    }
    const docInp = document.getElementById("finCeoDespCartaoDoc");
    if (docInp) {
      docInp.addEventListener("input", () => formatarInputCartaoDocMask());
      docInp.addEventListener("blur", () => {
        formatarInputCartaoDocMask();
        const { titularDoc, titularLabel } = lerCamposCartaoForm();
        memorizarDocCartao({ digits: titularDoc, label: titularLabel });
        upsertCartaoFromForm({ silent: true });
      });
      docInp.addEventListener("change", () => {
        formatarInputCartaoDocMask();
        const { titularDoc, titularLabel } = lerCamposCartaoForm();
        memorizarDocCartao({ digits: titularDoc, label: titularLabel });
        upsertCartaoFromForm({ silent: true });
      });
    }

    document.getElementById("finCeoDespForm")?.addEventListener("submit", salvarDespesaForm);
    document.getElementById("finCeoDespConfirmSimBtn")?.addEventListener("click", confirmarDespesaModal);
    document.getElementById("finCeoDespConfirmNaoBtn")?.addEventListener("click", fecharModalConfirmDespesa);
    document.getElementById("finCeoDespPagoSimBtn")?.addEventListener("click", confirmarPagoDespesaModal);
    document.getElementById("finCeoDespPagoNaoBtn")?.addEventListener("click", fecharModalConfirmPagoDespesa);
    document
      .querySelectorAll("[data-fin-ceo-desp-pago-cancel]")
      .forEach((el) => el.addEventListener("click", fecharModalConfirmPagoDespesa));
    document.getElementById("finCeoDespPagoModal")?.addEventListener("keydown", (ev) => {
      if (ev.key === "Escape") fecharModalConfirmPagoDespesa();
    });
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
      if (paneAberto === "relatorio") {
        resetCeoRelExcelFiltros();
        aplicarRelatorio();
      }
    });
    document.getElementById("finCeoDespCategoria")?.addEventListener("change", () => {
      toggleCategoriaDespesaUi();
    });
    document.getElementById("finCeoDespTipoParticular")?.addEventListener("change", () => {
      toggleTipoParticularUi();
    });

    document.getElementById("finCeoDespesasBody")?.addEventListener("click", (ev) => {
      const btnPago = ev.target.closest("[data-ceo-desp-marcar-pago]");
      if (btnPago) {
        const tr = btnPago.closest("tr[data-ceo-desp-id]");
        const id = tr?.getAttribute("data-ceo-desp-id");
        const pag = Number(tr?.getAttribute("data-ceo-pag")) || 1;
        const linhasAll = coletarLinhasExcelListaDespesas();
        const row = linhasAll.find((r) => String(r._d?.id) === String(id) && r._p?.numero === pag);
        if (row && row.situacao !== "PAGO") abrirModalConfirmPagoDespesa(row);
        return;
      }
      const btnExcluir = ev.target.closest(".fin-ceo-desp-excluir");
      if (btnExcluir) {
        const id = btnExcluir.getAttribute("data-id");
        if (id && window.confirm("Excluir esta despesa?")) excluirDespesa(id);
        return;
      }
      const btnEvento = ev.target.closest(".fin-ceo-desp-editar-evento");
      if (btnEvento) {
        const id = btnEvento.getAttribute("data-id");
        const pag = Number(btnEvento.getAttribute("data-pag")) || 1;
        if (id) iniciarEdicaoDespesa(id, pag, "single");
        return;
      }
      const btnFuturo = ev.target.closest(".fin-ceo-desp-editar-futuro");
      if (btnFuturo) {
        const id = btnFuturo.getAttribute("data-id");
        const pag = Number(btnFuturo.getAttribute("data-pag")) || 1;
        if (id) iniciarEdicaoDespesa(id, pag, "future");
      }
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
      if (!c.label && !c.finais) return;
      const prev = map.get(c.id);
      map.set(c.id, prev ? { ...prev, ...c, label: c.label || prev.label } : c);
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

  window.__DK_mergeFinanceiroCeoSituacaoPag = function mergeFinanceiroCeoSituacaoPag(localArr, cloudArr) {
    const map = new Map();
    [...(cloudArr || []), ...(localArr || [])].forEach((raw) => {
      const chave = String(raw?.chave || "").trim();
      if (!chave) return;
      const prev = map.get(chave);
      const pagoEm = String(raw?.pagoEm || "").trim();
      const prevEm = String(prev?.pagoEm || "").trim();
      if (!prev || Date.parse(pagoEm) >= Date.parse(prevEm)) {
        map.set(chave, {
          chave,
          situacao: raw?.situacao === "PAGO" ? "PAGO" : "A_PAGAR",
          pagoEm: pagoEm || prevEm,
        });
      }
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

  /** Recarga F5: portal-locadora-ui pode abrir a view antes deste script — ligar botões e painel. */
  function finCeoReconciliarSeVisivelAposBoot() {
    const view = document.getElementById("view-financeiro-ceo");
    if (!view?.classList.contains("view--active")) return;
    if (panel.classList.contains("hidden")) return;
    window.__DK_financeiroCeoOnShow();
  }
  finCeoReconciliarSeVisivelAposBoot();
})();
