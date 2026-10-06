/**
 * Despesas e pagamentos do FINANCEIRO CEO — canal próprio em blocos.
 * POST com patch=true grava só os registos enviados (HASH). Não relê nem regrava a base inteira.
 */
const { isRedisKvConfigured, createRedisClient } = require("../lib/dk-redis-env.cjs");
const {
  mergeFinanceiroCeoDespesas,
  mergeFinanceiroCeoSituacaoPag,
  mergeFinanceiroById,
  mergeFinanceiroDespesas,
} = require("../lib/dk-append-only-merge.cjs");
const { applyApiCors, enforceRateLimit, requireLiveSession, requireModuleAccess } = require("../lib/dk-portal-auth.cjs");
const { isCloudBudgetTripped, budgetReject, isQuotaError, tripCloudBudget, allowRedisAttempt } = require("../lib/dk-cloud-budget.cjs");
const { executarGravacaoCentral, ioSnapshotOficial } = require("../lib/dk-persistencia-central.cjs");

const STORAGE_KEY = "dk:portal:financeiro_ceo:v1";
const HASH_DESP = "dk:portal:financeiro_ceo:despesas:h";
const HASH_SIT = "dk:portal:financeiro_ceo:situacao:h";
const HASH_FONT = "dk:portal:financeiro_ceo:fontes:h";
const HASH_CART = "dk:portal:financeiro_ceo:cartoes:h";
const HASH_DESP_UNI = "dk:portal:financeiro_despesas:h";
const OP_KEY_PREFIX = "dk:portal:fin_ceo_op:";

function operationRedisKey(id) {
  const s = String(id || "")
    .replace(/[^a-zA-Z0-9:_-]/g, "")
    .slice(0, 180);
  return s ? OP_KEY_PREFIX + s : "";
}

const BUNDLE_KEYS = [
  "dk_financeiro_ceo_despesas_v1",
  "dk_financeiro_ceo_situacao_pag_v1",
  "dk_financeiro_ceo_fontes_v1",
  "dk_financeiro_ceo_cartoes_v1",
  "dk_financeiro_despesas_v1",
];

const HASH_BY_KEY = {
  dk_financeiro_ceo_despesas_v1: { hash: HASH_DESP, id: (r) => String(r?.id || "").trim() },
  dk_financeiro_ceo_situacao_pag_v1: { hash: HASH_SIT, id: (r) => String(r?.chave || "").trim() },
  dk_financeiro_ceo_fontes_v1: { hash: HASH_FONT, id: (r) => String(r?.id || "").trim() },
  dk_financeiro_ceo_cartoes_v1: { hash: HASH_CART, id: (r) => String(r?.id || "").trim() },
  dk_financeiro_despesas_v1: { hash: HASH_DESP_UNI, id: (r) => String(r?.id || "").trim() },
};

function emptyBundle() {
  const out = {};
  for (const k of BUNDLE_KEYS) out[k] = [];
  return out;
}

function asArray(v) {
  return Array.isArray(v) ? v : [];
}

function pickBundle(obj) {
  const src = obj && typeof obj === "object" ? obj : {};
  const out = emptyBundle();
  for (const k of BUNDLE_KEYS) out[k] = asArray(src[k]);
  return out;
}

function parseJson(raw) {
  if (raw == null) return null;
  if (typeof raw === "object") return raw;
  if (typeof raw !== "string") return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function parseDedicated(raw) {
  return pickBundle(parseJson(raw));
}

function mergeBundles(a, b) {
  return {
    dk_financeiro_ceo_despesas_v1: mergeFinanceiroCeoDespesas(asArray(a.dk_financeiro_ceo_despesas_v1), asArray(b.dk_financeiro_ceo_despesas_v1)),
    dk_financeiro_ceo_situacao_pag_v1: mergeFinanceiroCeoSituacaoPag(
      asArray(a.dk_financeiro_ceo_situacao_pag_v1),
      asArray(b.dk_financeiro_ceo_situacao_pag_v1)
    ),
    dk_financeiro_ceo_fontes_v1: mergeFinanceiroById(asArray(a.dk_financeiro_ceo_fontes_v1), asArray(b.dk_financeiro_ceo_fontes_v1)),
    dk_financeiro_ceo_cartoes_v1: mergeFinanceiroById(asArray(a.dk_financeiro_ceo_cartoes_v1), asArray(b.dk_financeiro_ceo_cartoes_v1)),
    dk_financeiro_despesas_v1: mergeFinanceiroDespesas(asArray(a.dk_financeiro_despesas_v1), asArray(b.dk_financeiro_despesas_v1)),
  };
}

function bundleTemDados(bundle) {
  return BUNDLE_KEYS.some((k) => asArray(bundle && bundle[k]).length > 0);
}

function rowsFromHash(map) {
  if (!map || typeof map !== "object") return [];
  const out = [];
  for (const v of Object.values(map)) {
    const row = typeof v === "string" ? parseJson(v) : v;
    if (row && typeof row === "object") out.push(row);
  }
  return out;
}

async function hashesTemDados(redis) {
  const n = await redis.hlen(HASH_DESP);
  return Number(n) > 0;
}

async function gravarHashBloco(redis, key, rows) {
  const meta = HASH_BY_KEY[key];
  if (!meta) return 0;
  const fields = {};
  for (const row of asArray(rows)) {
    const id = meta.id(row);
    if (!id) continue;
    fields[id] = JSON.stringify(row);
  }
  const n = Object.keys(fields).length;
  if (!n) return 0;
  await redis.hset(meta.hash, fields);
  return n;
}

async function aplicarBlocoHash(redis, incoming) {
  let gravados = 0;
  for (const k of BUNDLE_KEYS) {
    gravados += await gravarHashBloco(redis, k, incoming[k]);
  }
  return gravados;
}

async function loadFromHashes(redis) {
  const [desp, sit, font, cart, uni] = await Promise.all([
    redis.hgetall(HASH_DESP),
    redis.hgetall(HASH_SIT),
    redis.hgetall(HASH_FONT),
    redis.hgetall(HASH_CART),
    redis.hgetall(HASH_DESP_UNI),
  ]);
  return {
    dk_financeiro_ceo_despesas_v1: rowsFromHash(desp),
    dk_financeiro_ceo_situacao_pag_v1: rowsFromHash(sit),
    dk_financeiro_ceo_fontes_v1: rowsFromHash(font),
    dk_financeiro_ceo_cartoes_v1: rowsFromHash(cart),
    dk_financeiro_despesas_v1: rowsFromHash(uni),
  };
}

async function seedHashesIfEmpty(redis) {
  if (await hashesTemDados(redis)) return loadFromHashes(redis);
  const bundle = parseDedicated(await redis.get(STORAGE_KEY));
  if (bundleTemDados(bundle)) await aplicarBlocoHash(redis, bundle);
  return bundleTemDados(bundle) ? bundle : emptyBundle();
}

module.exports = async function handler(req, res) {
  applyApiCors(res);

  if (req.method === "OPTIONS") return res.status(204).end();
  allowRedisAttempt();
  if (isCloudBudgetTripped()) return budgetReject(res);
  if (await enforceRateLimit(req, res, "cadastro-financeiro-ceo", 40)) return;

  const gate = await requireLiveSession(req, { allowCliente: false, allowEquipa: true });
  if (!gate.ok) {
    return res.status(gate.status).json({ ok: false, reason: gate.reason });
  }

  if (!isRedisKvConfigured()) {
    return res.status(503).json({ ok: false, reason: "kv_not_configured" });
  }

  const redis = createRedisClient();

  try {
    if (req.method === "GET") {
      const central = await ioSnapshotOficial("default").ler();
      if (central.indisponivel) {
        return res.status(503).json({ ok: false, success: false, reason: central.reason || "supabase_indisponivel" });
      }
      const daNuvem = pickBundle(central.payload || {});
      let doCache = emptyBundle();
      try {
        doCache = await seedHashesIfEmpty(redis);
      } catch {
        doCache = emptyBundle();
      }
      const data = mergeBundles(daNuvem, doCache);
      return res.status(200).json({
        ok: true,
        success: true,
        data,
        vazio: !bundleTemDados(data),
        source: "supabase",
        revision: central.updatedAt || null,
        updated_at: central.updatedAt || null,
      });
    }

    if (req.method === "POST") {
      const writeGate = await requireModuleAccess(req, "lancamentoDespesa");
      if (!writeGate.ok) {
        return res.status(writeGate.status).json({ ok: false, reason: writeGate.reason, modulo: writeGate.modulo });
      }
      let body = req.body;
      if (typeof body === "string") {
        try {
          body = JSON.parse(body);
        } catch {
          body = {};
        }
      }
      const incoming = pickBundle(body?.data && typeof body.data === "object" ? body.data : body);
      const isPatch = body?.patch === true || body?.bloco === true;
      const opKey = operationRedisKey(body?.operationId);
      if (opKey) {
        const seen = await redis.get(opKey);
        if (seen) {
          /* A repetição também precisa estar no Supabase. Segue para a gravação central. */
        }
      }
      const central = await executarGravacaoCentral({
        ...ioSnapshotOficial("default"),
        baseRevision: body.base_revision || body.revision || "",
        mutar(payload) {
          const merged = mergeBundles(pickBundle(payload), incoming);
          for (const k of BUNDLE_KEYS) payload[k] = merged[k];
        },
        cache: async () => {
          await aplicarBlocoHash(redis, incoming);
          if (opKey) await redis.set(opKey, "1", { ex: 86400 });
        },
      });
      if (central.status !== 200) return res.status(central.status).json(central.body);
      return res.status(200).json(isPatch ? { ...central.body, patch: true } : { ...central.body, patch: false });
    }
  } catch (e) {
    if (isQuotaError(e) || (e && e.reason === "cloud_budget")) {
      tripCloudBudget();
      return budgetReject(res);
    }
    return res.status(500).json({ ok: false, error: String(e && e.message ? e.message : e) });
  }

  return res.status(405).json({ ok: false, reason: "method" });
};
