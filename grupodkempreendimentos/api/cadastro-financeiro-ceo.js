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
const { applyApiCors, enforceRateLimit, requirePortalAuth, requireModuleAccess } = require("../lib/dk-portal-auth.cjs");

const STORAGE_KEY = "dk:portal:financeiro_ceo:v1";
const REDIS_SNAPSHOT_KEY = "dk:portal:cloud_snapshot:v1";
const HASH_DESP = "dk:portal:financeiro_ceo:despesas:h";
const HASH_SIT = "dk:portal:financeiro_ceo:situacao:h";
const HASH_FONT = "dk:portal:financeiro_ceo:fontes:h";
const HASH_CART = "dk:portal:financeiro_ceo:cartoes:h";
const HASH_DESP_UNI = "dk:portal:financeiro_despesas:h";

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

function parseSnapshotFin(raw) {
  const row = parseJson(raw);
  if (!row) return emptyBundle();
  const payload = row.payload && typeof row.payload === "object" ? row.payload : row;
  return pickBundle(payload);
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
  const rawDed = await redis.get(STORAGE_KEY);
  let bundle = parseDedicated(rawDed);
  if (!bundleTemDados(bundle)) {
    const rawSnap = await redis.get(REDIS_SNAPSHOT_KEY);
    bundle = mergeBundles(parseSnapshotFin(rawSnap), bundle);
  }
  if (bundleTemDados(bundle)) await aplicarBlocoHash(redis, bundle);
  return bundle;
}

module.exports = async function handler(req, res) {
  applyApiCors(res);

  if (req.method === "OPTIONS") return res.status(204).end();
  if (await enforceRateLimit(req, res, "cadastro-financeiro-ceo", 40)) return;

  const gate = requirePortalAuth(req, { allowCliente: false, allowEquipa: true });
  if (!gate.ok) {
    return res.status(gate.status).json({ ok: false, reason: gate.reason });
  }

  if (!isRedisKvConfigured()) {
    return res.status(503).json({ ok: false, reason: "kv_not_configured" });
  }

  const redis = createRedisClient();

  try {
    if (req.method === "GET") {
      const data = await seedHashesIfEmpty(redis);
      return res.status(200).json({ ok: true, data });
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
      if (isPatch) {
        if (!(await hashesTemDados(redis))) await seedHashesIfEmpty(redis);
        const gravados = await aplicarBlocoHash(redis, incoming);
        return res.status(200).json({ ok: true, patch: true, gravados });
      }
      const existing = await seedHashesIfEmpty(redis);
      const merged = mergeBundles(existing, incoming);
      await aplicarBlocoHash(redis, merged);
      return res.status(200).json({
        ok: true,
        count: {
          dk_financeiro_ceo_despesas_v1: merged.dk_financeiro_ceo_despesas_v1.length,
          dk_financeiro_ceo_situacao_pag_v1: merged.dk_financeiro_ceo_situacao_pag_v1.length,
        },
      });
    }
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e && e.message ? e.message : e) });
  }

  return res.status(405).json({ ok: false, reason: "method" });
};
