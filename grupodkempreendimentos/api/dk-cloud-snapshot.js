/**
 * Snapshot completo DK (localStorage) — cópia redundante em Upstash Redis.
 * Quando Supabase falhar, o portal usa GET/POST nesta API.
 *
 * Variáveis Vercel: UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN
 *
 * GET  /api/dk-cloud-snapshot → { ok, payload, updated_at, source: "redis" }
 * POST /api/dk-cloud-snapshot → body { payload, updated_at? }
 */
const { isRedisKvConfigured, createRedisClient } = require("../lib/dk-redis-env.cjs");
const {
  mergeLocacoesCadastro,
  mergeFuncionariosAccess,
  neverLoseCadastroPayload,
} = require("../lib/dk-append-only-merge.cjs");

/** Data de corte FIXA do oficial: só valem registos criados a partir de 10/06/2026. */
const OFICIAL_CUTOFF_YMD = "2026-06-10";
/** Locações/protocolos no oficial: anterior a 23/08/2026 não volta (browser sujo nem push). */
const OFICIAL_LOCACOES_CUTOFF_YMD = "2026-08-23";

const OFICIAL_GUARD_KEYS = [
  "dk_clientes_cadastro",
  "dk_clientes_validacao_pendente",
  "dk_portal_clientes_cadastro",
  "dk_veiculos_cadastro",
  "dk_portal_veiculos_cadastro",
  "dk_veiculos_frota_planilha",
  "dk_locacoes_cadastro",
  "dk_locacoes_quadro_geral",
  "dk_manutencoes_cadastro",
  "dk_portal_checklist_historico_v1",
  "dk_portal_checklist_movimentacoes_v1",
  "dk_lancamentos_aluguel",
  "dk_lancamentos_aluguel_cadastro",
  "dk_comprovantes_banco",
  "dk_comprovantes_cliente_pendentes",
  "dk_documentos_deposito_v1",
  "dk_locacao_documentos_v1",
  "dk_cliente_notificacoes",
  "dk_comunicacao_operacao_v1",
];

function oficialTodayYmd() {
  return OFICIAL_CUTOFF_YMD;
}

function oficialParseYmd(value) {
  if (value == null || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) {
      return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(d);
    }
    return null;
  }
  const s = String(value).trim();
  /* aceita prefixo de dia da semana, ex.: "sex 09/01/2026" */
  const br = s.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const ms = Date.parse(s);
  if (Number.isFinite(ms)) {
    return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date(ms));
  }
  return null;
}

function locacaoProtocolYmd(record) {
  const n = String(record?.numeroContrato || record?.protocolo || "").replace(/\D/g, "");
  if (n.length < 8) return null;
  const ymd = `${n.slice(0, 4)}-${n.slice(4, 6)}-${n.slice(6, 8)}`;
  if (!/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(ymd)) return null;
  return ymd;
}

function oficialCutoffForKey(key) {
  const k = String(key || "");
  if (k.includes("locacoes") || k.includes("locacao")) return OFICIAL_LOCACOES_CUTOFF_YMD;
  return OFICIAL_CUTOFF_YMD;
}

function oficialRecordYmd(record, key) {
  if (!record || typeof record !== "object") return null;
  const protoYmd = locacaoProtocolYmd(record);
  if (protoYmd && String(key || "").includes("locac")) return protoYmd;
  const k = String(key);
  const fields = k.includes("locacoes")
    ? ["dataCadastro", "createdAt", "updatedAt", "inicio", "dataInicio"]
    : k.includes("lancamento") || k.includes("manutencoes")
      ? ["dataCadastro", "data", "dataPagamento", "dataLancamento", "createdAt"]
      : k.includes("comprovante")
        ? ["createdAt", "criadoEm", "enviadoEm", "data", "dataPagamento"]
        : k.includes("documento")
          ? ["createdAt", "criadoEm", "enviadoClienteEm", "updatedAt"]
          : ["dataCadastro", "createdAt", "updatedAt"];
  for (const f of fields) {
    const ymd = oficialParseYmd(record[f]);
    if (ymd) return ymd;
  }
  return null;
}

function locacaoNcKey(record) {
  return String(record?.numeroContrato || record?.protocolo || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
}

function locacaoNcSetFromPayload(payload) {
  const set = new Set();
  const arr = payload && Array.isArray(payload.dk_locacoes_cadastro) ? payload.dk_locacoes_cadastro : [];
  for (const r of arr) {
    const nc = locacaoNcKey(r);
    if (nc) set.add(nc);
  }
  return set;
}

const OFICIAL_CLIENTES_CPF_EXCLUIDOS = new Set(["00000000001", "00000000003"]);

function cpfDigitsKey(record) {
  return String(record?.cpf || "").replace(/\D/g, "");
}

function placaNormKey(record) {
  return String(record?.placa || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function cadastroKeepSetsFromPayload(payload) {
  const cpf = new Set();
  const placa = new Set();
  const nc = locacaoNcSetFromPayload(payload);
  if (!payload || typeof payload !== "object") return { cpf, placa, nc };
  for (const k of ["dk_clientes_cadastro", "dk_portal_clientes_cadastro"]) {
    for (const r of Array.isArray(payload[k]) ? payload[k] : []) {
      const d = cpfDigitsKey(r);
      if (d.length === 11 && !OFICIAL_CLIENTES_CPF_EXCLUIDOS.has(d)) cpf.add(d);
    }
  }
  for (const k of ["dk_veiculos_cadastro", "dk_portal_veiculos_cadastro", "dk_veiculos_frota_planilha"]) {
    for (const r of Array.isArray(payload[k]) ? payload[k] : []) {
      const p = placaNormKey(r);
      if (p) placa.add(p);
    }
  }
  return { cpf, placa, nc };
}

function normalizeKeepSets(keepLocacaoNc) {
  if (keepLocacaoNc instanceof Set) {
    return { nc: keepLocacaoNc, cpf: new Set(), placa: new Set() };
  }
  if (keepLocacaoNc && typeof keepLocacaoNc === "object") {
    return {
      nc: keepLocacaoNc.nc instanceof Set ? keepLocacaoNc.nc : new Set(),
      cpf: keepLocacaoNc.cpf instanceof Set ? keepLocacaoNc.cpf : new Set(),
      placa: keepLocacaoNc.placa instanceof Set ? keepLocacaoNc.placa : new Set(),
    };
  }
  return { nc: new Set(), cpf: new Set(), placa: new Set() };
}

function sanitizePayloadForOficial(payload, cutoffYmd = oficialTodayYmd(), keepLocacaoNc) {
  if (!payload || typeof payload !== "object") return payload;
  const { nc: keepNc, cpf: keepCpf, placa: keepPlaca } = normalizeKeepSets(keepLocacaoNc);
  const out = { ...payload };
  for (const k of OFICIAL_GUARD_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(out, k) || !Array.isArray(out[k])) continue;
    const keyCutoff = oficialCutoffForKey(k);
    const isLoc = String(k).includes("locac");
    const isCli = String(k).includes("cliente");
    const isVei = String(k).includes("veiculo") || String(k).includes("frota");
    out[k] = out[k].filter((r) => {
      const cpfEarly = cpfDigitsKey(r);
      if (isCli && OFICIAL_CLIENTES_CPF_EXCLUIDOS.has(cpfEarly)) return false;
      if (r && typeof r === "object" && r.origemPlanilha === true) return false;
      if (r && typeof r === "object" && r.cadastroRetroativo === true) return true;
      if (r && typeof r === "object" && r.origemPortal === true) return true;
      if (
        isLoc &&
        ((Array.isArray(r?.portalLancamentosAluguel) && r.portalLancamentosAluguel.length) ||
          (Array.isArray(r?.portalPagamentosAuditoria) && r.portalPagamentosAuditoria.length))
      ) {
        return true;
      }
      const protoYmd = locacaoProtocolYmd(r);
      const nc = locacaoNcKey(r);
      const cpf = cpfDigitsKey(r);
      const placa = placaNormKey(r);
      if (isLoc && nc && keepNc.has(nc)) return true;
      if (isCli && cpf.length === 11 && keepCpf.has(cpf)) return true;
      if (isVei && placa && keepPlaca.has(placa)) return true;
      if (isLoc && protoYmd && protoYmd < OFICIAL_LOCACOES_CUTOFF_YMD) return false;
      const ymd = oficialRecordYmd(r, k);
      return ymd && ymd >= keyCutoff;
    });
  }
  out.dk_oficial_cadastro_guard_v1 = cutoffYmd;
  return out;
}

const REDIS_KEYS = {
  default: "dk:portal:cloud_snapshot:v1",
  demo: "dk:portal:cloud_snapshot:demo:v1",
};

function resolveDeployChannel(req) {
  const q = String(req.query?.channel || "").trim().toLowerCase();
  if (q === "demo") return "demo";
  const hdr = String(req.headers["x-dk-deploy-channel"] || "").trim().toLowerCase();
  if (hdr === "demo") return "demo";
  const origin = String(req.headers.origin || req.headers.referer || "");
  if (/demo\.grupodkempreendimentos\.com\.br/i.test(origin)) return "demo";
  if (/^https?:\/\/demo\./i.test(origin)) return "demo";
  const env = String(process.env.DK_DEPLOY_CHANNEL || "").trim().toLowerCase();
  if (env === "demo") return "demo";
  return "default";
}

function redisKeyForChannel(channel) {
  return channel === "demo" ? REDIS_KEYS.demo : REDIS_KEYS.default;
}

function labelForChannel(channel) {
  return channel === "demo" ? "demo" : "default";
}
const CADASTRO_KEYS = [
  "dk_clientes_cadastro",
  "dk_portal_clientes_cadastro",
  "dk_veiculos_cadastro",
  "dk_portal_veiculos_cadastro",
  "dk_veiculos_frota_planilha",
  "dk_locacoes_cadastro",
  "dk_lancamentos_aluguel",
  "dk_lancamentos_aluguel_cadastro",
];

/** Demo reduzido a 10 protocolos: estes arrays não podem voltar a crescer por push do browser. */
const DEMO_TEN_CAP_KEYS = [
  ...CADASTRO_KEYS,
  "dk_clientes_validacao_pendente",
  "dk_locacoes_quadro_geral",
  "dk_manutencoes_cadastro",
  "dk_portal_checklist_historico_v1",
  "dk_portal_checklist_movimentacoes_v1",
  "dk_comprovantes_cliente_pendentes",
  "dk_cliente_notificacoes",
  "dk_comunicacao_operacao_v1",
  "dk_locacao_documentos_v1",
  "dk_audit_log",
  "dk_patrimonio_fotos_excluidas_v1",
];

function applyCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
}

function parseBody(req) {
  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      body = {};
    }
  }
  return body && typeof body === "object" ? body : {};
}

function isObject(v) {
  return v && typeof v === "object" && !Array.isArray(v);
}

/** Pontuação de merge: invalidado pelo admin e recusas manuais vencem «confirmado» antigo na nuvem. */
function comprovanteClienteMergeScore(r) {
  if (!r || typeof r !== "object") return 0;
  if (r.pagamentoInvalidado) {
    return 1e20 + (Date.parse(r.pagamentoInvalidadoEm || r.rejeitadoEm || 0) || 0);
  }
  const st = String(r.status || "").trim();
  if (st === "rejeitado" && r.rejeitadoAutomatico === false) {
    return 5e16 + (Date.parse(r.rejeitadoEm || 0) || 0);
  }
  const rank = { confirmado: 4, ia_validado: 3, pendente: 2, rejeitado: 1 };
  const base = rank[st] || 0;
  return base * 1e15 + (Date.parse(r.enviadoEm || 0) || 0);
}

/** Merge mínimo de comprovantes (mesma ideia do portal). */
function mergeComprovantesClientePendentes(localArr, cloudArr) {
  const byId = new Map();
  const push = (r) => {
    if (!r || typeof r !== "object" || !r.id) return;
    const prev = byId.get(r.id);
    if (!prev) {
      byId.set(r.id, r);
      return;
    }
    const rp = comprovanteClienteMergeScore(r);
    const pp = comprovanteClienteMergeScore(prev);
    if (rp > pp) byId.set(r.id, r);
    else if (rp === pp) {
      const te = Date.parse(r.enviadoEm || 0) || 0;
      const tp = Date.parse(prev.enviadoEm || 0) || 0;
      if (te >= tp) byId.set(r.id, r);
    }
  };
  (Array.isArray(localArr) ? localArr : []).forEach(push);
  (Array.isArray(cloudArr) ? cloudArr : []).forEach(push);
  return Array.from(byId.values()).sort(
    (a, b) => (Date.parse(b.enviadoEm || 0) || 0) - (Date.parse(a.enviadoEm || 0) || 0)
  );
}

function mergeFotosCapturasExcluidas(...listas) {
  const map = new Map();
  for (const lista of listas) {
    for (const item of lista || []) {
      const id = String(item?.id || item || "").trim();
      if (!id) continue;
      const excluidoEm = String(item?.excluidoEm || new Date().toISOString());
      const tag = String(item?.tag || "").trim() || undefined;
      const prev = map.get(id);
      if (!prev || Date.parse(excluidoEm) >= Date.parse(prev.excluidoEm || 0)) {
        map.set(id, { id, tag, excluidoEm });
      }
    }
  }
  return [...map.values()].slice(-600);
}

function aplicarExclusoesFotosCapturas(fotos, exclusoes) {
  const ids = new Set();
  const tags = new Set();
  for (const e of exclusoes || []) {
    const id = String(e?.id || "").trim();
    if (id) ids.add(id);
    const tag = String(e?.tag || "").trim();
    if (tag) tags.add(tag);
  }
  return (Array.isArray(fotos) ? fotos : []).filter((f) => {
    if (!f?.id) return false;
    if (ids.has(f.id)) return false;
    const tag = String(f.tag || "").trim();
    if (tag && tags.has(tag)) return false;
    return true;
  });
}

function parsePatrimonioStore(raw) {
  if (!raw) return { documentos: [], fotosCapturas: [], fotosCapturasExcluidas: [] };
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw);
    } catch {
      return { documentos: [], fotosCapturas: [], fotosCapturasExcluidas: [] };
    }
  }
  if (Array.isArray(raw?.documentos)) {
    return {
      documentos: raw.documentos,
      fotosCapturas: raw.fotosCapturas || [],
      fotosCapturasExcluidas: raw.fotosCapturasExcluidas || [],
    };
  }
  if (Array.isArray(raw)) return { documentos: raw, fotosCapturas: [], fotosCapturasExcluidas: [] };
  return { documentos: [], fotosCapturas: [], fotosCapturasExcluidas: [] };
}

function mergePatrimonioCrlvRedis(existing, incoming, exStandalone) {
  const e = parsePatrimonioStore(existing);
  const i = parsePatrimonioStore(incoming);
  const exclusoes = mergeFotosCapturasExcluidas(
    e.fotosCapturasExcluidas,
    i.fotosCapturasExcluidas,
    Array.isArray(exStandalone) ? exStandalone : []
  );
  const byId = new Map();
  for (const f of [...(e.fotosCapturas || []), ...(i.fotosCapturas || [])]) {
    if (!f || typeof f !== "object") continue;
    const id = String(f.id || "").trim();
    if (!id) continue;
    byId.set(id, f);
  }
  let fotosCapturas = aplicarExclusoesFotosCapturas([...byId.values()], exclusoes);
  fotosCapturas.sort(
    (a, b) =>
      (Date.parse(b.registradoEm || b.atualizadoEm || "") || 0) -
      (Date.parse(a.registradoEm || a.atualizadoEm || "") || 0)
  );
  return {
    documentos: i.documentos?.length ? i.documentos : e.documentos,
    fotosCapturas,
    fotosCapturasExcluidas: exclusoes,
  };
}

function stripInternalPayloadKeys(payload) {
  if (!isObject(payload)) return payload;
  const out = { ...payload };
  delete out._dkFullReplaceKeys;
  return out;
}

/** União por número de protocolo — evita apagar contratos do portal (ex. 2026010104) em push parcial. */
function applyCadastroLock(existing, incoming) {
  if (!isObject(existing) || !isObject(incoming)) return incoming;
  const lockUntil = Date.parse(String(existing.dk_cadastro_lock_v1 || "")) || 0;
  if (!lockUntil || Date.now() >= lockUntil) return incoming;
  const out = { ...incoming };
  const lockKeys = [
    "dk_clientes_cadastro",
    "dk_portal_clientes_cadastro",
    "dk_veiculos_cadastro",
    "dk_portal_veiculos_cadastro",
    "dk_veiculos_frota_planilha",
  ];
  for (const k of lockKeys) {
    if (!Object.prototype.hasOwnProperty.call(incoming, k)) continue;
    const inc = incoming[k];
    const ex = existing[k];
    if (!Array.isArray(inc) || !Array.isArray(ex)) continue;
    if (inc.length > ex.length) out[k] = ex;
  }
  return out;
}

/** Demo: push parcial com local vazio não pode apagar clientes/veículos já na nuvem. */
function applyDemoCadastroNoShrink(existing, merged) {
  if (!isObject(existing) || !isObject(merged)) return merged;
  /* Conjunto de 10 protocolos: o encolhimento é intencional e não pode ser revertido. */
  if (existing.dk_demo_cadastro_10_v1) return merged;
  const out = { ...merged };
  for (const k of CADASTRO_KEYS) {
    const ex = existing[k];
    const inc = out[k];
    if (!Array.isArray(ex) || !Array.isArray(inc)) continue;
    if (ex.length > 0 && inc.length < ex.length) out[k] = ex;
  }
  return out;
}

/** Oficial: union por chave natural — lista menor no browser não apaga a nuvem. */
function applyOficialClientesVeiculosNoShrink(existing, merged) {
  return neverLoseCadastroPayload(existing, merged);
}

/** Oficial virgem: planilha/junk sai; locação do portal, com pagamento ou já na nuvem fica. */
function capOficialVirginProtocolos(existing, merged) {
  if (!isObject(existing) || !existing.dk_oficial_sem_protocolos_v1 || !isObject(merged)) return merged;
  const out = { ...merged };
  const keepNc = locacaoNcSetFromPayload(existing);
  const keys = [
    "dk_locacoes_cadastro",
    "dk_lancamentos_aluguel",
    "dk_lancamentos_aluguel_cadastro",
    "dk_locacoes_quadro_geral",
    "dk_locacao_documentos_v1",
  ];
  for (const k of keys) {
    if (!Array.isArray(out[k])) continue;
    out[k] = out[k].filter((r) => {
      if (r && typeof r === "object" && r.origemPlanilha === true) return false;
      if (r && typeof r === "object" && r.cadastroRetroativo === true) return true;
      if (r && typeof r === "object" && r.origemPortal === true) return true;
      if (
        String(k).includes("locac") &&
        ((Array.isArray(r?.portalLancamentosAluguel) && r.portalLancamentosAluguel.length) ||
          (Array.isArray(r?.portalPagamentosAuditoria) && r.portalPagamentosAuditoria.length))
      ) {
        return true;
      }
      const nc = locacaoNcKey(r);
      if (nc && keepNc.has(nc)) return true;
      const protoYmd = locacaoProtocolYmd(r);
      if (protoYmd) return protoYmd >= OFICIAL_LOCACOES_CUTOFF_YMD;
      return true;
    });
  }
  out.dk_oficial_sem_protocolos_v1 = existing.dk_oficial_sem_protocolos_v1;
  out.dk_cadastro_manual_portal_v1 = true;
  if (existing.dk_cadastro_lock_v1) out.dk_cadastro_lock_v1 = existing.dk_cadastro_lock_v1;
  return out;
}
function capDemoTenPayload(existing, merged) {
  if (!isObject(existing) || !existing.dk_demo_cadastro_10_v1 || !isObject(merged)) return merged;
  const out = { ...merged };
  for (const k of DEMO_TEN_CAP_KEYS) {
    const ex = existing[k];
    const inc = out[k];
    if (Array.isArray(ex) && Array.isArray(inc) && inc.length > ex.length) out[k] = ex;
  }
  out.dk_demo_cadastro_10_v1 = existing.dk_demo_cadastro_10_v1;
  out.dk_cadastro_manual_portal_v1 = true;
  if (existing.dk_cadastro_lock_v1) out.dk_cadastro_lock_v1 = existing.dk_cadastro_lock_v1;
  return out;
}

/** Push parcial: catálogo de documentos nunca encolhe (tombstones preservados). */
function applyDepositNoShrink(existing, merged) {
  if (!isObject(existing) || !isObject(merged)) return merged;
  const out = { ...merged };
  if (
    Object.prototype.hasOwnProperty.call(out, "dk_documentos_deposito_v1") &&
    Object.prototype.hasOwnProperty.call(existing, "dk_documentos_deposito_v1")
  ) {
    out.dk_documentos_deposito_v1 = mergeDocumentosDepositoRedis(
      existing.dk_documentos_deposito_v1,
      out.dk_documentos_deposito_v1
    );
  }
  return out;
}

function mergeLocacoesCadastroArrays(existingArr, incomingArr) {
  return mergeLocacoesCadastro(existingArr, incomingArr);
}

function mergeComunicacaoOperacaoRedisRecord(prev, next) {
  if (!prev) return next;
  if (!next) return prev;
  const maxIso = (a, b) => {
    const ta = Date.parse(a || "") || 0;
    const tb = Date.parse(b || "") || 0;
    if (ta >= tb) return a || b || "";
    return b || a || "";
  };
  return {
    ...prev,
    ...next,
    id: prev.id || next.id,
    lidaClienteEm: maxIso(prev.lidaClienteEm, next.lidaClienteEm),
    lidaOperacaoEm: maxIso(prev.lidaOperacaoEm, next.lidaOperacaoEm),
  };
}

/** Merge documentos CRLV/contrato por id — push parcial não pode apagar outros protocolos. */
function parseDocumentosDeposito(raw) {
  if (!raw) return { crlv: [], contrato: [], multa: [] };
  if (typeof raw === "string") {
    try {
      const p = JSON.parse(raw);
      return p && typeof p === "object" ? p : { crlv: [], contrato: [], multa: [] };
    } catch {
      return { crlv: [], contrato: [], multa: [] };
    }
  }
  return raw && typeof raw === "object" ? raw : { crlv: [], contrato: [], multa: [] };
}

/** Merge CRLV/contrato/multa por id — tombstone e nuvem:true nunca regridem (push parcial). */
function mergeDocumentosDepositoRedis(existing, incoming) {
  const ex = parseDocumentosDeposito(existing);
  const inc = parseDocumentosDeposito(incoming);
  const out = { crlv: [], contrato: [], multa: [] };
  for (const cat of ["crlv", "contrato", "multa"]) {
    const byId = new Map();
    const push = (e) => {
      if (!e?.id) return;
      const prev = byId.get(e.id);
      if (!prev) {
        byId.set(e.id, { ...e });
        return;
      }
      const novo =
        (Date.parse(e.criadoEm || 0) || 0) >= (Date.parse(prev.criadoEm || 0) || 0) ? { ...e } : { ...prev };
      if (prev.nuvem === true || e.nuvem === true) novo.nuvem = true;
      if (!novo.statusContrato && (prev.statusContrato || e.statusContrato)) {
        novo.statusContrato = prev.statusContrato || e.statusContrato;
      }
      if (prev.excluido === true || e.excluido === true) {
        novo.excluido = true;
        novo.excluidoEm = novo.excluidoEm || prev.excluidoEm || e.excluidoEm;
      }
      byId.set(e.id, novo);
    };
    (Array.isArray(ex[cat]) ? ex[cat] : []).forEach(push);
    (Array.isArray(inc[cat]) ? inc[cat] : []).forEach(push);
    out[cat] = Array.from(byId.values()).sort(
      (a, b) => (Date.parse(a.criadoEm || 0) || 0) - (Date.parse(b.criadoEm || 0) || 0)
    );
  }
  return out;
}

function mergeLocacaoDocumentosRedis(existing, incoming) {
  const byId = new Map();
  const pick = (rec) => {
    if (!rec || typeof rec !== "object" || !rec.id) return;
    const prev = byId.get(rec.id);
    if (!prev) {
      byId.set(rec.id, rec);
      return;
    }
    /* tombstone: doc excluído no portal não pode ressuscitar pelo merge */
    if (rec.excluido === true || prev.excluido === true) {
      const tsAct = (x) => Number(x.excluidoEm || x.enviadoClienteEm || x.createdAt) || 0;
      if (tsAct(rec) >= tsAct(prev)) byId.set(rec.id, rec);
      return;
    }
    const prevHas = Boolean(String(prev.arquivoBase64 || "").trim());
    const recHas = Boolean(String(rec.arquivoBase64 || "").trim());
    const prevTs = Number(prev.enviadoClienteEm || prev.createdAt) || 0;
    const recTs = Number(rec.enviadoClienteEm || rec.createdAt) || 0;
    if (recHas && !prevHas) {
      byId.set(rec.id, rec);
      return;
    }
    if (prevHas && !recHas) return;
    if (rec.enviadoCliente === true && prev.enviadoCliente !== true) {
      byId.set(rec.id, rec);
      return;
    }
    if (prev.enviadoCliente === true && rec.enviadoCliente !== true) return;
    if (recTs >= prevTs) byId.set(rec.id, rec);
  };
  (Array.isArray(existing) ? existing : []).forEach(pick);
  (Array.isArray(incoming) ? incoming : []).forEach(pick);
  return Array.from(byId.values());
}

function mergeComunicacaoOperacaoRedis(existing, incoming) {
  const byId = new Map();
  const push = (m) => {
    if (!m || typeof m !== "object" || !m.id) return;
    byId.set(m.id, mergeComunicacaoOperacaoRedisRecord(byId.get(m.id), m));
  };
  (Array.isArray(existing) ? existing : []).forEach(push);
  (Array.isArray(incoming) ? incoming : []).forEach(push);
  return Array.from(byId.values())
    .sort((a, b) => (Date.parse(a.criadoEm || 0) || 0) - (Date.parse(b.criadoEm || 0) || 0))
    .slice(0, 3000);
}

function mergePayloads(existing, incoming) {
  if (!isObject(existing)) return stripInternalPayloadKeys(incoming);
  if (!isObject(incoming)) return existing;
  const fullReplaceKeys = Array.isArray(incoming._dkFullReplaceKeys)
    ? incoming._dkFullReplaceKeys.filter((k) => typeof k === "string")
    : [];
  const neverLoseReplace = new Set([
    "dk_clientes_cadastro",
    "dk_portal_clientes_cadastro",
    "dk_veiculos_cadastro",
    "dk_portal_veiculos_cadastro",
    "dk_veiculos_frota_planilha",
    "dk_locacoes_cadastro",
    "dk_pagamentos_auditoria_v1",
    "dk_funcionarios_access",
  ]);
  const out = { ...existing, ...incoming };
  if (
    Object.prototype.hasOwnProperty.call(incoming, "dk_locacoes_cadastro") ||
    Object.prototype.hasOwnProperty.call(existing, "dk_locacoes_cadastro")
  ) {
    out.dk_locacoes_cadastro = mergeLocacoesCadastroArrays(
      existing.dk_locacoes_cadastro,
      incoming.dk_locacoes_cadastro
    );
  }
  if (
    Object.prototype.hasOwnProperty.call(incoming, "dk_funcionarios_access") ||
    Object.prototype.hasOwnProperty.call(existing, "dk_funcionarios_access")
  ) {
    out.dk_funcionarios_access = mergeFuncionariosAccess(
      existing.dk_funcionarios_access,
      incoming.dk_funcionarios_access
    );
  }
  for (const k of fullReplaceKeys) {
    if (!Object.prototype.hasOwnProperty.call(incoming, k)) continue;
    if (neverLoseReplace.has(k)) continue;
    out[k] = incoming[k];
  }
  if (
    !fullReplaceKeys.includes("dk_comprovantes_cliente_pendentes") &&
    (Object.prototype.hasOwnProperty.call(incoming, "dk_comprovantes_cliente_pendentes") ||
      Object.prototype.hasOwnProperty.call(existing, "dk_comprovantes_cliente_pendentes"))
  ) {
    out.dk_comprovantes_cliente_pendentes = mergeComprovantesClientePendentes(
      existing.dk_comprovantes_cliente_pendentes,
      incoming.dk_comprovantes_cliente_pendentes
    );
  }
  if (
    Object.prototype.hasOwnProperty.call(incoming, "dk_comunicacao_operacao_v1") ||
    Object.prototype.hasOwnProperty.call(existing, "dk_comunicacao_operacao_v1")
  ) {
    out.dk_comunicacao_operacao_v1 = mergeComunicacaoOperacaoRedis(
      existing.dk_comunicacao_operacao_v1,
      incoming.dk_comunicacao_operacao_v1
    );
  }
  if (
    Object.prototype.hasOwnProperty.call(incoming, "dk_locacao_documentos_v1") ||
    Object.prototype.hasOwnProperty.call(existing, "dk_locacao_documentos_v1")
  ) {
    out.dk_locacao_documentos_v1 = mergeLocacaoDocumentosRedis(
      existing.dk_locacao_documentos_v1,
      incoming.dk_locacao_documentos_v1
    );
  }
  if (
    Object.prototype.hasOwnProperty.call(incoming, "dk_documentos_deposito_v1") ||
    Object.prototype.hasOwnProperty.call(existing, "dk_documentos_deposito_v1")
  ) {
    out.dk_documentos_deposito_v1 = mergeDocumentosDepositoRedis(
      existing.dk_documentos_deposito_v1,
      incoming.dk_documentos_deposito_v1
    );
  }
  if (
    Object.prototype.hasOwnProperty.call(incoming, "dk_patrimonio_crlv_v1") ||
    Object.prototype.hasOwnProperty.call(existing, "dk_patrimonio_crlv_v1")
  ) {
    out.dk_patrimonio_crlv_v1 = mergePatrimonioCrlvRedis(
      existing.dk_patrimonio_crlv_v1,
      incoming.dk_patrimonio_crlv_v1,
      incoming.dk_patrimonio_fotos_excluidas_v1 || existing.dk_patrimonio_fotos_excluidas_v1
    );
    out.dk_patrimonio_fotos_excluidas_v1 = out.dk_patrimonio_crlv_v1.fotosCapturasExcluidas || [];
  } else if (
    Object.prototype.hasOwnProperty.call(incoming, "dk_patrimonio_fotos_excluidas_v1") ||
    Object.prototype.hasOwnProperty.call(existing, "dk_patrimonio_fotos_excluidas_v1")
  ) {
    out.dk_patrimonio_fotos_excluidas_v1 = mergeFotosCapturasExcluidas(
      existing.dk_patrimonio_fotos_excluidas_v1,
      incoming.dk_patrimonio_fotos_excluidas_v1
    );
  }
  return stripInternalPayloadKeys(neverLoseCadastroPayload(existing, out));
}

async function handler(req, res) {
  applyCors(res);
  res.setHeader("Content-Type", "application/json");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (!isRedisKvConfigured()) {
    return res.status(503).json({ ok: false, reason: "kv_not_configured" });
  }

  const redis = createRedisClient();
  const channel = resolveDeployChannel(req);
  const REDIS_KEY = redisKeyForChannel(channel);
  const LABEL = labelForChannel(channel);

  try {
    if (req.method === "GET") {
      const raw = await redis.get(REDIS_KEY);
      if (!raw) {
        return res.status(200).json({
          ok: true,
          label: LABEL,
          payload: null,
          updated_at: null,
          source: "redis",
        });
      }
      let row = raw;
      if (typeof raw === "string") {
        try {
          row = JSON.parse(raw);
        } catch {
          return res.status(500).json({ ok: false, reason: "invalid_stored_json" });
        }
      }
      const payload = row?.payload && typeof row.payload === "object" ? row.payload : null;
      const safePayload =
        channel === "default" && payload
          ? sanitizePayloadForOficial(payload, oficialTodayYmd(), cadastroKeepSetsFromPayload(payload))
          : payload;
      return res.status(200).json({
        ok: true,
        label: LABEL,
        payload: safePayload,
        updated_at: row?.updated_at || null,
        source: "redis",
      });
    }

    if (req.method === "POST") {
      const body = parseBody(req);
      let incoming = body.payload;
      if (!isObject(incoming)) {
        return res.status(400).json({ ok: false, reason: "payload_required" });
      }
      const updatedAt = String(body.updated_at || new Date().toISOString());
      const existingRaw = await redis.get(REDIS_KEY);
      let existingPayload = null;
      if (existingRaw) {
        let row = existingRaw;
        if (typeof existingRaw === "string") {
          try {
            row = JSON.parse(existingRaw);
          } catch {
            row = null;
          }
        }
        if (row?.payload && typeof row.payload === "object") existingPayload = row.payload;
      }
      if (channel === "default") {
        incoming = sanitizePayloadForOficial(
          incoming,
          oficialTodayYmd(),
          cadastroKeepSetsFromPayload(existingPayload)
        );
      }
      const replace = body.replace === true || body.mode === "replace";
      const wipeKeys = Array.isArray(body.wipe_keys)
        ? body.wipe_keys.filter((k) => typeof k === "string")
        : [];
      let payload;
      if (wipeKeys.length) {
        payload = existingPayload ? { ...existingPayload, ...incoming } : { ...incoming };
        for (const k of wipeKeys) {
          payload[k] = Object.prototype.hasOwnProperty.call(incoming, k) ? incoming[k] : [];
        }
        if (channel === "default") {
          payload.dk_cadastro_manual_portal_v1 = true;
          payload.dk_oficial_sem_protocolos_v1 = incoming.dk_oficial_sem_protocolos_v1 !== false;
          payload.dk_cadastro_lock_v1 = incoming.dk_cadastro_lock_v1
            ? String(incoming.dk_cadastro_lock_v1)
            : new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();
        } else if (incoming.dk_demo_cadastro_10_v1) {
          payload.dk_cadastro_manual_portal_v1 = true;
          payload.dk_cadastro_lock_v1 = incoming.dk_cadastro_lock_v1
            ? String(incoming.dk_cadastro_lock_v1)
            : new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();
          payload.dk_demo_cadastro_10_v1 = incoming.dk_demo_cadastro_10_v1;
        } else {
          delete payload.dk_cadastro_manual_portal_v1;
          delete payload.dk_cadastro_lock_v1;
        }
        payload = stripInternalPayloadKeys(payload);
      } else {
        const lockedIncoming = existingPayload
          ? applyCadastroLock(existingPayload, incoming)
          : incoming;
        payload = existingPayload
          ? mergePayloads(existingPayload, lockedIncoming)
          : stripInternalPayloadKeys(lockedIncoming);
        if (existingPayload) {
          payload = applyDepositNoShrink(existingPayload, payload);
        }
        if (channel === "demo" && existingPayload) {
          payload = applyDemoCadastroNoShrink(existingPayload, payload);
          payload = capDemoTenPayload(existingPayload, payload);
        }
        if (channel === "default" && existingPayload) {
          payload = applyOficialClientesVeiculosNoShrink(existingPayload, payload);
          payload = capOficialVirginProtocolos(existingPayload, payload);
          payload = neverLoseCadastroPayload(existingPayload, payload);
        }
      }
      if (channel === "default") {
        payload = sanitizePayloadForOficial(
          payload,
          oficialTodayYmd(),
          cadastroKeepSetsFromPayload(existingPayload || payload)
        );
        if (existingPayload && !wipeKeys.length) {
          payload = neverLoseCadastroPayload(existingPayload, payload);
        }
        payload = sanitizePayloadForOficial(
          payload,
          oficialTodayYmd(),
          cadastroKeepSetsFromPayload(payload)
        );
        payload.dk_dados_seguros_v1 = true;
      }
      const stored = { label: LABEL, payload, updated_at: updatedAt };
      await redis.set(REDIS_KEY, JSON.stringify(stored));
      return res.status(200).json({
        ok: true,
        label: LABEL,
        updated_at: updatedAt,
        source: "redis",
        replace,
        keys: Object.keys(payload).length,
      });
    }
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: String(e && e.message ? e.message : e),
    });
  }

  return res.status(405).json({ ok: false, reason: "method" });
}

module.exports = handler;
module.exports.sanitizePayloadForOficial = sanitizePayloadForOficial;
module.exports.cadastroKeepSetsFromPayload = cadastroKeepSetsFromPayload;
module.exports.capOficialVirginProtocolos = capOficialVirginProtocolos;
module.exports.neverLoseCadastroPayload = neverLoseCadastroPayload;
