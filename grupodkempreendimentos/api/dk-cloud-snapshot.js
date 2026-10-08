/**
 * Snapshot DK. Supabase é a fonte que confirma a gravação.
 * Redis só recebe a cópia depois dessa confirmação e não decide o sucesso.
 *
 * GET  /api/dk-cloud-snapshot → { success, payload, revision, updated_at, source: "supabase" }
 * POST /api/dk-cloud-snapshot → body { payload, updated_at?, base_revision? }
 */
const { isRedisKvConfigured, createRedisClient } = require("../lib/dk-redis-env.cjs");
const {
  assertHourlyBudget,
  isQuotaError,
  tripCloudBudget,
  budgetReject,
  isCloudBudgetTripped,
  rejectIfRedisBurst,
  allowRedisAttempt,
} = require("../lib/dk-cloud-budget.cjs");
const {
  isSupabaseDoormanConfigured,
  fetchSnapshotRevisionByLabel,
  fetchSnapshotByLabel,
  upsertSnapshotByLabel,
  withDoormanTimeout,
} = require("../lib/dk-supabase-doorman.cjs");
const { revisaoConflita } = require("../lib/dk-persistencia-central.cjs");
const {
  applyApiCors,
  enforceRateLimit,
  requirePortalAuth,
  attachLiveSession,
  assertEquipaClientProtocol,
  findFuncionario,
  onlyDigits,
  clientIp,
} = require("../lib/dk-portal-auth.cjs");
const {
  filterIncomingByModules,
  restoreCredentialFields,
  stripSecretsFromPayload,
  normalizeOperacaoAccess,
  ownerWriteAccess,
} = require("../lib/dk-portal-module-access.cjs");
const {
  mergeClientesCadastro,
  mergeVeiculosCadastro,
  mergeLocacoesCadastro,
  mergeFuncionariosAccess,
  neverLoseCadastroPayload,
  isLocacaoFantasmaCadastro,
} = require("../lib/dk-append-only-merge.cjs");
const pacotes = require("../portal-pacotes.js");
const {
  findActivePlateConflicts,
  activePlateConflictMessage,
  findNewDuplicatePayments,
  acquireLocacoesWriteLock,
  releaseLocacoesWriteLock,
} = require("../lib/dk-locacoes-integrity.cjs");

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
  "dk_manutencoes_rapidas_v1",
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
  const fields = k.includes("notificac")
    ? ["criadoEm", "createdAt", "dataPagamento"]
    : k.includes("locacoes")
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

function probePlaca(v) {
  return String(v || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

/** O payload desta resposta já foi o que o Supabase gravou. Evita outro download do snapshot. */
function probeCadastroConfirmado(payload, query) {
  const kind = String(query?.probe || "").trim().toLowerCase();
  if (!kind) return null;
  if (!payload || typeof payload !== "object") return false;
  if (kind === "locacao") {
    const want = String(query.nc || query.value || "").replace(/\D/g, "");
    const arr = payload.dk_locacoes_cadastro;
    if (!want || !Array.isArray(arr)) return false;
    return arr.some((l) => {
      const nc = String(l?.numeroContrato || "").replace(/\D/g, "");
      if (nc !== want) return false;
      const inicio = String(l?.inicio || l?.dataInicio || "").trim();
      const cpf = String(l?.cpf || "").replace(/\D/g, "");
      const nome = String(l?.nome || l?.cliente || "").trim();
      const placa = probePlaca(l?.placa);
      return Boolean(inicio && cpf.length === 11 && nome && placa.length >= 7);
    });
  }
  if (kind === "cliente") {
    const want = String(query.cpf || query.value || "").replace(/\D/g, "").slice(0, 11);
    if (want.length !== 11) return false;
    const arr = [].concat(payload.dk_clientes_cadastro || [], payload.dk_portal_clientes_cadastro || []);
    return arr.some((c) => String(c?.cpf || "").replace(/\D/g, "").slice(0, 11) === want);
  }
  if (kind === "veiculo") {
    const want = probePlaca(query.placa || query.value);
    if (!want) return false;
    const arr = [].concat(
      payload.dk_veiculos_cadastro || [],
      payload.dk_portal_veiculos_cadastro || [],
      payload.dk_veiculos_frota_planilha || []
    );
    return arr.some((v) => probePlaca(v?.placa) === want);
  }
  return null;
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

const OFICIAL_CLIENTES_CPF_EXCLUIDOS = new Set([
  "00000000001",
  "00000000003",
  "00000000004",
  "06523244440",
  "04292253420",
  "07534147409",
  "00445040556",
  "01303628514",
  "01503628514",
  /* 0412 — cadastro errado da operadora. O cliente real é 11369128436 / 0413. */
  "11369128423",
]);
/** CPF real com código errado (7410) — no oficial o Cód. é sempre o canónico. */
const OFICIAL_CLIENTES_CODIGO_CANON = Object.freeze({
  "01503608514": "0315",
  /* RAYNERES: o 0413 ocupa o 0412 que ficou vazio. O próximo cadastro é 0413. */
  "11369128436": "0412",
});
/** Protocolos inválidos (prefixo ≠ data início / duplicata). */
const OFICIAL_LOCACOES_NC_EXCLUIDOS = new Set([
  "2026122501",
  "2026082801",
  /* Seeds da demo (caderno teste / AAA·BBB·CCC) — nunca no oficial. */
  "2025010101",
  "2025010102",
  "2025010103",
  "2026010101",
  "2026010102",
  "2026010103",
  "2026010104",
]);
const OFICIAL_LOCACOES_NC_SEEDS = new Set([
  "2025010101",
  "2025010102",
  "2025010103",
  "2026010101",
  "2026010102",
  "2026010103",
  "2026010104",
]);
/** Placas de veículo de teste da demo (FERRARI/BUGATTI/PORSCHE/FUSCA). */
const OFICIAL_VEICULOS_PLACA_EXCLUIDOS = new Set([
  "AAA0A00",
  "AAA0A01",
  "AAA0A02",
  "BBB0B00",
  "CCC0C00",
  "DDD0D000",
  /* Moto de teste do agente (DKMT - 173). Não existe na frota. */
  "QWE9Z99",
]);

function isLocacaoNcOficialmenteBloqueado(r) {
  const nc = String(r?.numeroContrato || r?.protocolo || "").replace(/\D/g, "");
  if (!nc || !OFICIAL_LOCACOES_NC_EXCLUIDOS.has(nc)) return false;
  if (OFICIAL_LOCACOES_NC_SEEDS.has(nc)) return true;
  const protoYmd = locacaoProtocolYmd(r);
  const inicioYmd = oficialParseYmd(r?.inicio || r?.dataInicio);
  if (protoYmd && inicioYmd && protoYmd === inicioYmd) return false;
  return true;
}

function isLocacaoSeedDemoOficialProibida(r) {
  if (!r || typeof r !== "object") return false;
  const nc = String(r?.numeroContrato || r?.protocolo || "").replace(/\D/g, "");
  if (nc && OFICIAL_LOCACOES_NC_SEEDS.has(nc)) return true;
  const placa = placaNormKey(r);
  if (placa && OFICIAL_VEICULOS_PLACA_EXCLUIDOS.has(placa)) return true;
  if (/^(AAA|BBB|CCC)0[A-C]\d{2}$/i.test(placa)) return true;
  const cpf = cpfDigitsKey(r);
  if (OFICIAL_CLIENTES_CPF_EXCLUIDOS.has(cpf)) return true;
  if (/^TESTE[- ]?\d/i.test(String(r.nome || "").trim())) return true;
  return false;
}

function cpfDigitsKey(record) {
  return String(record?.cpf || "").replace(/\D/g, "");
}

function placaNormKey(record) {
  return String(record?.placa || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function canonClienteCodigoOficial(list) {
  const seen = new Set();
  const out = [];
  for (const r of Array.isArray(list) ? list : []) {
    const d = cpfDigitsKey(r);
    const canon = OFICIAL_CLIENTES_CODIGO_CANON[d];
    const rec = canon ? { ...r, codigo: canon } : r;
    if (canon) {
      if (seen.has(d)) continue;
      seen.add(d);
    }
    out.push(rec);
  }
  return out;
}

function canonLocacaoClienteCodigoOficial(list) {
  return (Array.isArray(list) ? list : []).map((r) => {
    const canon = OFICIAL_CLIENTES_CODIGO_CANON[cpfDigitsKey(r)];
    if (!canon) return r;
    return { ...r, clienteCodigo: canon };
  });
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

/** União das chaves já na nuvem com as que este PC está a enviar — não apaga cliente extra. */
function mergeCadastroKeepSets(a, b) {
  const A = normalizeKeepSets(a);
  const B = normalizeKeepSets(b);
  return {
    nc: new Set([...A.nc, ...B.nc]),
    cpf: new Set([...A.cpf, ...B.cpf]),
    placa: new Set([...A.placa, ...B.placa]),
  };
}

function sanitizePayloadForOficial(payload, cutoffYmd = oficialTodayYmd(), keepLocacaoNc) {
  if (!payload || typeof payload !== "object") return payload;
  const { nc: keepNc, cpf: keepCpf, placa: keepPlaca } = normalizeKeepSets(keepLocacaoNc);
  const out = { ...payload };
  for (const k of OFICIAL_GUARD_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(out, k) || !Array.isArray(out[k])) continue;
    const keyCutoff = oficialCutoffForKey(k);
    const isNotif = String(k).includes("notificac");
    const isLoc = String(k).includes("locac");
    const isCli = String(k).includes("cliente") && !isNotif;
    const isVei = String(k).includes("veiculo") || String(k).includes("frota");
    out[k] = out[k].filter((r) => {
      const cpfEarly = cpfDigitsKey(r);
      if (cpfEarly.length === 11 && OFICIAL_CLIENTES_CPF_EXCLUIDOS.has(cpfEarly) && !isVei) return false;
      if (isNotif) {
        if (OFICIAL_CLIENTES_CPF_EXCLUIDOS.has(cpfEarly)) return false;
        if (!String(r?.mensagem || "").trim()) return false;
        const ymdN = oficialRecordYmd(r, k);
        if (!ymdN) return true;
        return ymdN >= keyCutoff;
      }
      if (isCli && OFICIAL_CLIENTES_CPF_EXCLUIDOS.has(cpfEarly)) return false;
      if (isLoc && isLocacaoNcOficialmenteBloqueado(r)) return false;
      /* Fantasmas (placa LOC/TST ou sem CPF) nunca passam — mesmo com origemPortal ou keepNc. */
      if (isLoc && isLocacaoFantasmaCadastro(r)) return false;
      /* Seeds da demo (AAA/BBB/CCC, TESTE-*, protocolos 20250101xx / 202601010x). */
      if (isLoc && isLocacaoSeedDemoOficialProibida(r)) return false;
      if (isVei && OFICIAL_VEICULOS_PLACA_EXCLUIDOS.has(placaNormKey(r))) return false;
      if (r && typeof r === "object" && r.cadastroRetroativo === true) return true;
      if (r && typeof r === "object" && r.origemPortal === true) return true;
      if (
        (k === "dk_manutencoes_cadastro" || k === "dk_manutencoes_rapidas_v1") &&
        r &&
        typeof r === "object"
      ) {
        const placaManut = placaNormKey(r);
        const ativaManut = !String(r.dataRealSaida || "").trim();
        if (
          placaManut &&
          !OFICIAL_VEICULOS_PLACA_EXCLUIDOS.has(placaManut) &&
          (ativaManut || r.origemPortalChecklist === true)
        ) {
          return true;
        }
      }
      if (r && typeof r === "object" && r.origemPlanilha === true) return false;
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
    if (isCli) out[k] = canonClienteCodigoOficial(out[k]);
    if (isLoc) out[k] = canonLocacaoClienteCodigoOficial(out[k]);
  }
  out.dk_oficial_cadastro_guard_v1 = cutoffYmd;
  return out;
}

const REDIS_KEYS = {
  default: "dk:portal:cloud_snapshot:v1",
  demo: "dk:portal:cloud_snapshot:demo:v1",
};

function resolveDeployChannel() {
  return "default";
}

function redisKeyForChannel() {
  return REDIS_KEYS.default;
}

function lerLinhaSnapshotRedis(raw) {
  if (!raw) return null;
  let row = raw;
  if (typeof raw === "string") {
    try {
      row = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!row || typeof row !== "object" || !row.payload || typeof row.payload !== "object") return null;
  return { payload: row.payload, updated_at: row.updated_at || null };
}

async function lerSnapshotRedisOficial(redis, key) {
  if (!redis) return null;
  try {
    return lerLinhaSnapshotRedis(await redis.get(key));
  } catch (err) {
    console.error("[dk-snapshot] leitura redis", err && err.message ? err.message : err);
    return null;
  }
}

function labelForChannel() {
  return "default";
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
  applyApiCors(res);
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
    if (k === "dk_clientes_cadastro" || k === "dk_portal_clientes_cadastro") {
      out[k] = mergeClientesCadastro(ex, inc);
      continue;
    }
    if (
      k === "dk_veiculos_cadastro" ||
      k === "dk_portal_veiculos_cadastro" ||
      k === "dk_veiculos_frota_planilha"
    ) {
      out[k] = mergeVeiculosCadastro(ex, inc);
      continue;
    }
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
      if (r && typeof r === "object" && r.cadastroRetroativo === true) return true;
      if (r && typeof r === "object" && r.origemPortal === true) return true;
      if (r && typeof r === "object" && r.origemPlanilha === true) return false;
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

function mergeManutencoesCadastro(existingList, incomingList) {
  const plateKey = (p) => String(p || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  const normCat = (x) =>
    String(x?.categoriaManutencao || x?.categoria || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-");
  const concreta = (c) =>
    c === "oficina-propria" ||
    c === "oficina-terceiros" ||
    c === "enviado-seguro" ||
    c === "sinistrado-roubo";
  const score = (x) => Number(x?.updatedAt || 0) || Number(x?.id || 0) || 0;
  const ativa = (x) => !String(x?.dataRealSaida || "").trim();
  const byPlaca = new Map();
  const byId = new Map();
  const closed = [];
  const add = (r) => {
    if (!r || typeof r !== "object") return;
    const pl = plateKey(r.placa);
    if (ativa(r) && pl) {
      const ex = byPlaca.get(pl);
      if (!ex) {
        byPlaca.set(pl, { ...r });
        return;
      }
      const catR = normCat(r);
      const catEx = normCat(ex);
      const newer =
        concreta(catR) && (catEx === "triagem" || !catEx)
          ? { ...ex, ...r }
          : concreta(catEx) && (catR === "triagem" || !catR)
            ? { ...r, ...ex }
            : score(r) >= score(ex)
              ? { ...ex, ...r }
              : { ...r, ...ex };
      byPlaca.set(pl, newer);
      return;
    }
    const id = String(r.id || "").trim();
    if (id) {
      const ex = byId.get(id);
      if (!ex || score(r) >= score(ex)) byId.set(id, { ...(ex || {}), ...r });
      return;
    }
    closed.push({ ...r });
  };
  (Array.isArray(existingList) ? existingList : []).forEach(add);
  (Array.isArray(incomingList) ? incomingList : []).forEach(add);
  return [...byPlaca.values(), ...byId.values(), ...closed];
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
    Object.prototype.hasOwnProperty.call(incoming, "dk_manutencoes_cadastro") ||
    Object.prototype.hasOwnProperty.call(existing, "dk_manutencoes_cadastro")
  ) {
    out.dk_manutencoes_cadastro = mergeManutencoesCadastro(
      existing.dk_manutencoes_cadastro,
      incoming.dk_manutencoes_cadastro
    );
  }
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
  const remapEx = existing.dk_protocolo_nc_remap_v1;
  const remapIn = incoming.dk_protocolo_nc_remap_v1;
  if (
    (remapEx && typeof remapEx === "object" && !Array.isArray(remapEx)) ||
    (remapIn && typeof remapIn === "object" && !Array.isArray(remapIn))
  ) {
    out.dk_protocolo_nc_remap_v1 = {
      ...(remapEx && typeof remapEx === "object" && !Array.isArray(remapEx) ? remapEx : {}),
      ...(remapIn && typeof remapIn === "object" && !Array.isArray(remapIn) ? remapIn : {}),
    };
  }
  return stripInternalPayloadKeys(neverLoseCadastroPayload(existing, out));
}

/** Uma locação só: o browser não reenvia o snapshot inteiro. */
function montarPayloadComLocacaoUnica(existingPayload, locacao) {
  const existing = existingPayload && typeof existingPayload === "object" ? existingPayload : {};
  const prev = Array.isArray(existing.dk_locacoes_cadastro) ? existing.dk_locacoes_cadastro : [];
  const loc = { ...locacao };
  delete loc.arquivoBase64;
  delete loc.imagem;
  delete loc.imagemRecortada;
  const mergedLocs = mergeLocacoesCadastro(prev, [loc]);
  let payload = { ...existing, dk_locacoes_cadastro: mergedLocs };
  payload = sanitizePayloadForOficial(
    payload,
    oficialTodayYmd(),
    mergeCadastroKeepSets(cadastroKeepSetsFromPayload(existing), cadastroKeepSetsFromPayload(payload))
  );
  if (existingPayload && typeof existingPayload === "object") {
    payload = neverLoseCadastroPayload(existing, payload);
  }
  payload.dk_dados_seguros_v1 = true;
  return payload;
}

const DK_SNAPSHOT_WARN_BYTES = 524288;
const DK_SNAPSHOT_CRITICAL_BYTES = 2097152;
const supabaseBreaker = { fails: 0, openUntil: 0 };

function supabaseBreakerAberto() {
  return Date.now() < supabaseBreaker.openUntil;
}

function falhaSupabaseComunicacao(result) {
  const reason = String((result && result.reason) || "");
  if (reason === "supabase_timeout") return true;
  return /^supabase_http_5\d\d$/.test(reason);
}

function notarSupabase(result) {
  if (!result || result.reason === "supabase_circuit_open") return;
  if (result.ok) {
    supabaseBreaker.fails = 0;
    supabaseBreaker.openUntil = 0;
    return;
  }
  if (!falhaSupabaseComunicacao(result)) return;
  supabaseBreaker.fails += 1;
  if (supabaseBreaker.fails >= 3) {
    supabaseBreaker.openUntil = Date.now() + 60000;
    supabaseBreaker.fails = 0;
  }
}

async function consultarSupabase(fn) {
  if (supabaseBreakerAberto()) {
    return { ok: false, reason: "supabase_circuit_open", payload: null, updatedAt: null };
  }
  const result = await withDoormanTimeout(fn(), 8000, "supabase_timeout");
  notarSupabase(result);
  return result;
}

function corpoDaConsulta(req, safePayload) {
  const limpo = stripSecretsFromPayload(safePayload);
  const pacote = String((req.query && req.query.pacote) || "");
  const dia = String((req.query && req.query.dia) || "");
  if (pacote === "dia" && /^\d{4}-\d{2}-\d{2}$/.test(dia)) {
    const extraido = pacotes.extrairPacoteDia(limpo, dia);
    return { pacote: "dia", dia, payload: extraido.payload };
  }
  if (pacote === "ficheiro") {
    const chave = String((req.query && req.query.chave) || "");
    const id = String((req.query && req.query.id) || "");
    return {
      pacote: "ficheiro",
      chave,
      id,
      payload: { registro: pacotes.lerFicheiro(limpo, chave, id) },
    };
  }
  return { payload: limpo };
}

function etagDeRevisao(rev) {
  const raw = String(rev || "").trim();
  if (!raw) return "";
  return `"${raw.replace(/"/g, "")}"`;
}

function etagNormalizado(valor) {
  return String(valor || "").trim();
}

function contarRegistrosPayload(payload) {
  if (!payload || typeof payload !== "object") return 0;
  let n = 0;
  for (const value of Object.values(payload)) {
    if (Array.isArray(value)) n += value.length;
  }
  return n;
}

function instalarTelemetriaSnapshot(res) {
  if (res.__dkSnapTel) return;
  res.__dkSnapTel = true;
  res.__dkSnapT0 = Date.now();
  res.json = (body) => {
    let json = "{}";
    try {
      json = JSON.stringify(body);
    } catch {
      json = "{}";
    }
    const bytes = Buffer.byteLength(json);
    const status = res.statusCode || 200;
    const rev = body && (body.revision || body.updated_at);
    const etag = etagDeRevisao(rev);
    if (etag) res.setHeader("ETag", etag);
    res.setHeader("Cache-Control", "private, no-store");
    const ms = Date.now() - res.__dkSnapT0;
    if (bytes >= DK_SNAPSHOT_WARN_BYTES) {
      console.warn(
        JSON.stringify({
          route: "/api/dk-cloud-snapshot",
          aviso: bytes >= DK_SNAPSHOT_CRITICAL_BYTES ? "resposta_critica" : "resposta_grande",
          bytes,
          ms,
        })
      );
    }
    console.log(
      JSON.stringify({
        route: "/api/dk-cloud-snapshot",
        ms,
        status,
        bytes,
        modo: body && body.meta ? "meta" : "completo",
        registros: contarRegistrosPayload(body && body.payload),
      })
    );
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.status(status).send(json);
  };
}

function responderSnapshot304(res, etag) {
  res.setHeader("ETag", etag);
  res.setHeader("Cache-Control", "private, no-store");
  console.log(
    JSON.stringify({
      route: "/api/dk-cloud-snapshot",
      ms: Date.now() - (res.__dkSnapT0 || Date.now()),
      status: 304,
      bytes: 0,
      modo: "304",
      registros: 0,
    })
  );
  return res.status(304).end();
}

async function handler(req, res) {
  applyCors(res);
  res.setHeader("Content-Type", "application/json");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  instalarTelemetriaSnapshot(res);

  allowRedisAttempt();
  if (isCloudBudgetTripped()) return budgetReject(res);

  const gate = requirePortalAuth(req, { allowCliente: true, allowEquipa: true });
  if (!gate.ok) {
    if (await enforceRateLimit(req, res, "cloud-snapshot-anon", 20)) return;
    return res.status(gate.status).json({ ok: false, reason: gate.reason });
  }

  const protoGate = assertEquipaClientProtocol(gate, req);
  if (!protoGate.ok) {
    return res.status(protoGate.status || 403).json({ ok: false, reason: protoGate.reason || "client_stale" });
  }
  const live = await attachLiveSession(gate, req);
  const ident = gate.service
    ? "svc"
    : onlyDigits(gate.cpf).slice(0, 11) || `ip:${clientIp(req)}`;
  const isPost = req.method === "POST";
  if (
    await enforceRateLimit(req, res, isPost ? "cloud-snapshot-post" : "cloud-snapshot-get", isPost ? 24 : 40, {
      identity: ident,
    })
  ) {
    return;
  }
  if (!live.ok) {
    return res.status(live.status || 401).json({
      ok: false,
      reason: live.reason || "session_revoked",
    });
  }

  if (!isRedisKvConfigured()) {
    return res.status(503).json({ ok: false, reason: "kv_not_configured" });
  }

  try {
    await assertHourlyBudget(isPost ? "post" : "get");
  } catch (e) {
    if (isQuotaError(e) || (e && e.reason === "cloud_budget")) return budgetReject(res);
    return res.status(503).json({ ok: false, reason: "cloud_budget" });
  }

  let redis = null;
  try {
    redis = createRedisClient();
    if (await rejectIfRedisBurst(redis)) return budgetReject(res);
  } catch (e) {
    if (isQuotaError(e) || (e && e.reason === "cloud_budget") || isCloudBudgetTripped()) {
      return budgetReject(res);
    }
    console.error("[dk-snapshot] redis indisponivel, segue no supabase");
    redis = null;
  }
  const channel = resolveDeployChannel(req);
  const REDIS_KEY = redisKeyForChannel(channel);
  const LABEL = labelForChannel(channel);

  try {
    if (req.method === "GET") {
      const metaOnly = req.query?.meta === "1" || req.query?.meta === "true";
      const etagPedido = etagNormalizado(req.headers["if-none-match"]);
      let oficial = null;
      if ((metaOnly || etagPedido) && isSupabaseDoormanConfigured()) {
        const leve = await consultarSupabase(() => fetchSnapshotRevisionByLabel(LABEL));
        if (leve && leve.ok) {
          const etag = etagDeRevisao(leve.updatedAt);
          if (etag && etagPedido && etagPedido === etag) return responderSnapshot304(res, etag);
          if (metaOnly) {
            return res.status(200).json({
              ok: true,
              success: true,
              meta: true,
              label: LABEL,
              revision: leve.updatedAt || null,
              updated_at: leve.updatedAt || null,
              source: "supabase",
            });
          }
          oficial = await consultarSupabase(() => fetchSnapshotByLabel(LABEL));
        } else {
          oficial = leve || { ok: false, reason: "supabase_timeout", payload: null, updatedAt: null };
        }
      } else {
        oficial = isSupabaseDoormanConfigured()
          ? await consultarSupabase(() => fetchSnapshotByLabel(LABEL))
          : { ok: false, reason: "doorman_key_missing", payload: null, updatedAt: null };
      }
      if (!oficial || oficial.reason === "supabase_timeout" || oficial.reason === "supabase_circuit_open" || (oficial.reason && String(oficial.reason).startsWith("supabase_http")) || oficial.reason === "doorman_key_missing" || oficial.reason === "cloud_budget") {
        console.error("[dk-snapshot] leitura supabase", oficial && oficial.reason);
        const cached = await lerSnapshotRedisOficial(redis, REDIS_KEY);
        if (cached && cached.payload) {
          const revisaoRedis = cached.updated_at || null;
          const etagRedis = etagDeRevisao(revisaoRedis);
          if (etagRedis && etagPedido && etagPedido === etagRedis) return responderSnapshot304(res, etagRedis);
          if (metaOnly) {
            return res.status(200).json({
              ok: true,
              success: true,
              meta: true,
              label: LABEL,
              revision: revisaoRedis,
              updated_at: revisaoRedis,
              source: "redis",
              supabasePendente: true,
            });
          }
          const safeRedis =
            channel === "default"
              ? sanitizePayloadForOficial(
                  cached.payload,
                  oficialTodayYmd(),
                  cadastroKeepSetsFromPayload(cached.payload)
                )
              : cached.payload;
          return res.status(200).json({
            ok: true,
            success: true,
            label: LABEL,
            ...corpoDaConsulta(req, safeRedis),
            revision: revisaoRedis,
            updated_at: revisaoRedis,
            source: "redis",
            supabasePendente: true,
          });
        }
        return res.status(503).json({
          ok: false,
          success: false,
          reason: (oficial && oficial.reason) || "supabase_indisponivel",
          source: "supabase",
        });
      }
      const revisao = oficial.updatedAt || null;
      if (metaOnly) {
        return res.status(200).json({
          ok: true,
          success: true,
          meta: true,
          label: LABEL,
          revision: revisao,
          updated_at: revisao,
          source: "supabase",
        });
      }
      if (!oficial.payload || typeof oficial.payload !== "object") {
        return res.status(200).json({
          ok: true,
          success: true,
          label: LABEL,
          payload: null,
          revision: revisao,
          updated_at: revisao,
          source: "supabase",
        });
      }
      const safePayload =
        channel === "default"
          ? sanitizePayloadForOficial(
              oficial.payload,
              oficialTodayYmd(),
              cadastroKeepSetsFromPayload(oficial.payload)
            )
          : oficial.payload;
      return res.status(200).json({
        ok: true,
        success: true,
        label: LABEL,
        ...corpoDaConsulta(req, safePayload),
        revision: revisao,
        updated_at: revisao,
        source: "supabase",
      });
    }

    if (req.method === "POST") {
      const body = parseBody(req);
      const operador = body.operador === true;
      let locacoesLockToken = "";
      if (!redis) {
        locacoesLockToken = "sem-redis";
      } else {
        try {
          locacoesLockToken = await acquireLocacoesWriteLock(redis, {
            attempts: operador ? 250 : 5,
            waitMs: 100,
            ttlSec: 30,
          });
        } catch (err) {
          console.error("[dk-snapshot] lock redis", err && err.message ? err.message : err);
          locacoesLockToken = "sem-redis";
        }
      }
      if (!locacoesLockToken) {
        return res.status(409).json({
          ok: false,
          reason: "locacoes_write_busy",
          message: "Outra gravação de locação está em andamento. Aguarde e tente novamente.",
        });
      }
      try {
      if (body.locacao && typeof body.locacao === "object" && !Array.isArray(body.locacao) && !isObject(body.payload)) {
        if (gate.typ === "cliente") {
          return res.status(403).json({ ok: false, reason: "module_forbidden", modulo: "locacao" });
        }
        const locacao = body.locacao;
        const nc = String(locacao.numeroContrato || locacao.protocolo || "").replace(/\D/g, "");
        if (!nc) {
          return res.status(400).json({ ok: false, reason: "protocolo_obrigatorio", message: "Informe o protocolo da locação." });
        }
        const oficialAtualLoc = isSupabaseDoormanConfigured()
          ? await consultarSupabase(() => fetchSnapshotByLabel(LABEL))
          : { ok: false, reason: "doorman_key_missing", payload: null, updatedAt: null };
        if (
          !oficialAtualLoc ||
          oficialAtualLoc.reason === "supabase_timeout" ||
          oficialAtualLoc.reason === "doorman_key_missing" ||
          oficialAtualLoc.reason === "cloud_budget" ||
          (oficialAtualLoc.reason && String(oficialAtualLoc.reason).startsWith("supabase_http"))
        ) {
          return res.status(503).json({
            ok: false,
            success: false,
            reason: (oficialAtualLoc && oficialAtualLoc.reason) || "supabase_indisponivel",
            message: "A nuvem não respondeu. Tente cadastrar de novo.",
          });
        }
        const existingLocPayload =
          oficialAtualLoc.payload && typeof oficialAtualLoc.payload === "object" ? oficialAtualLoc.payload : null;
        if (!gate.service && String(gate.role || "").trim() !== "owner") {
          const f = findFuncionario(existingLocPayload, onlyDigits(gate.cpf).slice(0, 11));
          const role = String((f && f.role) || gate.role || "operacao").trim();
          const acessos = role === "owner" ? ownerWriteAccess() : normalizeOperacaoAccess(f && f.acessos, role);
          if (!acessos.locacao) {
            return res.status(403).json({ ok: false, reason: "module_forbidden", modulo: "locacao" });
          }
        }
        const payloadLoc = montarPayloadComLocacaoUnica(existingLocPayload, { ...locacao, numeroContrato: nc });
        const activePlateConflictsLoc = findActivePlateConflicts(payloadLoc.dk_locacoes_cadastro);
        if (activePlateConflictsLoc.length) {
          const conflict = activePlateConflictsLoc[0];
          return res.status(409).json({
            ok: false,
            success: false,
            reason: "active_plate_conflict",
            placa: conflict.placa,
            protocolos: conflict.contratos.map((item) => item.protocolo),
            message: activePlateConflictMessage(conflict),
          });
        }
        const storedAtLoc = new Date().toISOString();
        let supabaseLoc;
        try {
          supabaseLoc = await withDoormanTimeout(
            upsertSnapshotByLabel(LABEL, payloadLoc, storedAtLoc),
            8000,
            "supabase_timeout"
          );
        } catch (err) {
          supabaseLoc = { ok: false, reason: String(err && err.message ? err.message : err) };
        }
        if (!supabaseLoc || supabaseLoc.ok !== true) {
          return res.status(502).json({
            ok: false,
            success: false,
            reason: (supabaseLoc && supabaseLoc.reason) || "supabase_falhou",
            message: "A nuvem não confirmou a locação. Tente de novo.",
          });
        }
        const confirmedLoc = probeCadastroConfirmado(payloadLoc, { probe: "locacao", nc, value: nc });
        if (confirmedLoc !== true) {
          return res.status(409).json({
            ok: false,
            success: false,
            reason: "locacao_nao_confirmada",
            message: "A nuvem não guardou data, cliente e placa deste protocolo. Confira o cadastro e tente de novo.",
          });
        }
        return res.status(200).json({
          ok: true,
          success: true,
          label: LABEL,
          revision: storedAtLoc,
          updated_at: storedAtLoc,
          source: "supabase",
          persistencia: "supabase",
          supabase: { ok: true },
          redis: { ok: false, reason: "cache_adiado" },
          confirmed: confirmedLoc === true,
          locacao: nc,
        });
      }
      let incoming = body.payload;
      if (body.pacote === "ficheiro") incoming = incoming && typeof incoming === "object" ? incoming : {};
      if (!isObject(incoming)) {
        return res.status(400).json({ ok: false, reason: "payload_required" });
      }
      const updatedAt = String(body.updated_at || new Date().toISOString());
      const baseRevision = String(body.base_revision || body.revision || "");
      const oficialAtual = isSupabaseDoormanConfigured()
        ? await consultarSupabase(() => fetchSnapshotByLabel(LABEL))
        : { ok: false, reason: "doorman_key_missing", payload: null, updatedAt: null };
      let existingPayload = oficialAtual.payload && typeof oficialAtual.payload === "object" ? oficialAtual.payload : null;
      let existingUpdatedAt = oficialAtual.updatedAt ? String(oficialAtual.updatedAt) : null;
      let gravarSoRedis = false;
      if (
        !oficialAtual ||
        oficialAtual.reason === "supabase_timeout" ||
        oficialAtual.reason === "supabase_circuit_open" ||
        oficialAtual.reason === "doorman_key_missing" ||
        oficialAtual.reason === "cloud_budget" ||
        (oficialAtual.reason && String(oficialAtual.reason).startsWith("supabase_http"))
      ) {
        const cached = await lerSnapshotRedisOficial(redis, REDIS_KEY);
        if (!cached || !cached.payload) {
          return res.status(503).json({
            ok: false,
            success: false,
            reason: (oficialAtual && oficialAtual.reason) || "supabase_indisponivel",
          });
        }
        existingPayload = cached.payload;
        existingUpdatedAt = cached.updated_at ? String(cached.updated_at) : null;
        gravarSoRedis = true;
      }
      if (revisaoConflita(baseRevision, existingUpdatedAt)) {
        return res.status(409).json({
          ok: false,
          success: false,
          reason: "revisao_conflito",
          revision: existingUpdatedAt,
          updated_at: existingUpdatedAt,
          message: "A nuvem tem uma versão mais nova. Recarregue antes de gravar.",
        });
      }
      if (body.pacote === "dia" && /^\d{4}-\d{2}-\d{2}$/.test(String(body.dia || ""))) {
        incoming = pacotes.fundirPacoteDia(existingPayload || {}, body.dia, incoming);
      } else if (body.pacote === "ficheiro" && body.registro && typeof body.registro === "object") {
        incoming = pacotes.fundirFicheiro(existingPayload || {}, String(body.chave || ""), body.registro);
      }
      if (channel === "default") {
        incoming = sanitizePayloadForOficial(
          incoming,
          oficialTodayYmd(),
          mergeCadastroKeepSets(
            cadastroKeepSetsFromPayload(existingPayload),
            cadastroKeepSetsFromPayload(incoming)
          )
        );
      }
      const replace = body.replace === true || body.mode === "replace";
      const wipeKeys = Array.isArray(body.wipe_keys)
        ? body.wipe_keys.filter((k) => typeof k === "string")
        : [];
      const isOwner = gate.service || String(gate.role || "").trim() === "owner";
      if ((replace || wipeKeys.length) && !isOwner) {
        return res.status(403).json({ ok: false, reason: "module_forbidden", modulo: "snapshot_replace" });
      }
      let acessos = ownerWriteAccess();
      if (!isOwner && gate.typ === "equipa") {
        const f = findFuncionario(existingPayload, onlyDigits(gate.cpf).slice(0, 11));
        acessos = f && String(f.role || "").trim() === "owner"
          ? ownerWriteAccess()
          : normalizeOperacaoAccess(f?.acessos, f?.role || "operacao");
        acessos = { ...acessos, manutencao: true, lancamentoManutencao: true };
      }
      incoming = restoreCredentialFields(existingPayload, incoming);
      incoming = filterIncomingByModules(existingPayload, incoming, acessos, {
        isOwner: isOwner || (gate.typ === "equipa" && String(gate.role || "") === "owner"),
        isService: Boolean(gate.service),
        isCliente: gate.typ === "cliente",
      });
      let payload;
      if (wipeKeys.length) {
        payload = existingPayload ? { ...existingPayload, ...incoming } : { ...incoming };
        for (const k of wipeKeys) {
          payload[k] = Object.prototype.hasOwnProperty.call(incoming, k) ? incoming[k] : [];
        }
        payload.dk_cadastro_manual_portal_v1 = true;
        payload.dk_oficial_sem_protocolos_v1 = incoming.dk_oficial_sem_protocolos_v1 !== false;
        payload.dk_cadastro_lock_v1 = incoming.dk_cadastro_lock_v1
          ? String(incoming.dk_cadastro_lock_v1)
          : new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();
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
        if (existingPayload) {
          payload = applyOficialClientesVeiculosNoShrink(existingPayload, payload);
          payload = capOficialVirginProtocolos(existingPayload, payload);
          payload = neverLoseCadastroPayload(existingPayload, payload);
        }
      }
      payload = sanitizePayloadForOficial(
        payload,
        oficialTodayYmd(),
        mergeCadastroKeepSets(
          cadastroKeepSetsFromPayload(existingPayload || payload),
          cadastroKeepSetsFromPayload(incoming)
        )
      );
      if (existingPayload && !wipeKeys.length) {
        payload = neverLoseCadastroPayload(existingPayload, payload);
      }
      const activePlateConflicts = findActivePlateConflicts(payload.dk_locacoes_cadastro);
      if (activePlateConflicts.length) {
        const conflict = activePlateConflicts[0];
        return res.status(409).json({
          ok: false,
          reason: "active_plate_conflict",
          placa: conflict.placa,
          protocolos: conflict.contratos.map((item) => item.protocolo),
          conflicts: activePlateConflicts,
          message: activePlateConflictMessage(conflict),
        });
      }
      const duplicatePayments = findNewDuplicatePayments(
        existingPayload?.dk_locacoes_cadastro,
        payload.dk_locacoes_cadastro
      );
      if (duplicatePayments.length) {
        const duplicate = duplicatePayments[0];
        return res.status(409).json({
          ok: false,
          reason: "duplicate_payment_same_day_value",
          protocolo: duplicate.protocoloContrato,
          data: duplicate.data,
          valor: duplicate.valor,
          duplicates: duplicatePayments,
          message:
            `JÁ EXISTE UM PAGAMENTO DE R$ ${Number(duplicate.valor).toFixed(2).replace(".", ",")} ` +
            `EM ${duplicate.data} PARA O PROTOCOLO ${duplicate.protocoloContrato}.`,
        });
      }
      payload.dk_dados_seguros_v1 = true;
      const storedAt = new Date().toISOString();
      if (gravarSoRedis) {
        try {
          await redis.set(REDIS_KEY, JSON.stringify({ label: LABEL, payload, updated_at: storedAt }));
          await redis.set(`${REDIS_KEY}:rev`, storedAt);
        } catch (err) {
          return res.status(503).json({
            ok: false,
            success: false,
            reason: "kv_write_failed",
            message: "Não foi possível guardar no Redis oficial. Tente de novo.",
          });
        }
        return res.status(200).json({
          ok: true,
          success: true,
          label: LABEL,
          revision: storedAt,
          updated_at: storedAt,
          source: "redis",
          supabasePendente: true,
          persistencia: "redis",
          supabase: { ok: false, reason: (oficialAtual && oficialAtual.reason) || "supabase_indisponivel" },
          redis: { ok: true },
          replace,
          keys: Object.keys(payload).length,
        });
      }
      let supabase;
      try {
        supabase = await consultarSupabase(() => upsertSnapshotByLabel(LABEL, payload, storedAt));
      } catch (err) {
        supabase = { ok: false, reason: String(err && err.message ? err.message : err) };
      }
      if (!supabase || supabase.ok !== true) {
        try {
          await redis.set(REDIS_KEY, JSON.stringify({ label: LABEL, payload, updated_at: storedAt }));
          await redis.set(`${REDIS_KEY}:rev`, storedAt);
        } catch (err) {
          return res.status(502).json({
            ok: false,
            success: false,
            reason: (supabase && supabase.reason) || "supabase_falhou",
            message: "O Supabase não confirmou e o Redis também não guardou. Tente de novo.",
            supabase: { ok: false, reason: (supabase && supabase.reason) || "supabase_falhou" },
          });
        }
        return res.status(200).json({
          ok: true,
          success: true,
          label: LABEL,
          revision: storedAt,
          updated_at: storedAt,
          source: "redis",
          supabasePendente: true,
          persistencia: "redis",
          supabase: { ok: false, reason: (supabase && supabase.reason) || "supabase_falhou" },
          redis: { ok: true },
          replace,
          keys: Object.keys(payload).length,
        });
      }
      let confirmed;
      if (body.confirm && typeof body.confirm === "object") {
        const kind = String(body.confirm.kind || "");
        const value = body.confirm.value;
        confirmed = probeCadastroConfirmado(payload, {
          probe: kind,
          nc: value,
          cpf: value,
          placa: value,
          value,
        });
      }
      let redisOk = true;
      let redisErr = "";
      try {
        await redis.set(REDIS_KEY, JSON.stringify({ label: LABEL, payload, updated_at: storedAt }));
        await redis.set(`${REDIS_KEY}:rev`, storedAt);
      } catch (err) {
        redisOk = false;
        redisErr = String(err && err.message ? err.message : err);
        console.error("[DK cloud] cache redis apos supabase", redisErr);
      }
      return res.status(200).json({
        ok: true,
        success: true,
        label: LABEL,
        revision: storedAt,
        updated_at: storedAt,
        source: "supabase",
        persistencia: redisOk ? "supabase+redis" : "supabase",
        supabase: { ok: true },
        redis: { ok: redisOk, reason: redisErr },
        replace,
        keys: Object.keys(payload).length,
        ...(typeof confirmed === "boolean" ? { confirmed } : {}),
      });
      } finally {
        await releaseLocacoesWriteLock(redis, locacoesLockToken);
      }
    }
  } catch (e) {
    if (isQuotaError(e) || (e && e.reason === "cloud_budget")) {
      tripCloudBudget();
      return budgetReject(res);
    }
    return res.status(500).json({
      ok: false,
      error: String(e && e.message ? e.message : e),
    });
  }

  return res.status(405).json({ ok: false, reason: "method" });
}

const { comMedicaoCusto } = require("../lib/dk-custos-sistema.cjs");
function handlerMedido(req, res) {
  return comMedicaoCusto(req, res, () => handler(req, res));
}

module.exports = handlerMedido;
module.exports.sanitizePayloadForOficial = sanitizePayloadForOficial;
module.exports.cadastroKeepSetsFromPayload = cadastroKeepSetsFromPayload;
module.exports.capOficialVirginProtocolos = capOficialVirginProtocolos;
module.exports.neverLoseCadastroPayload = neverLoseCadastroPayload;
module.exports.applyCadastroLock = applyCadastroLock;
module.exports.probeCadastroConfirmado = probeCadastroConfirmado;
module.exports.montarPayloadComLocacaoUnica = montarPayloadComLocacaoUnica;
