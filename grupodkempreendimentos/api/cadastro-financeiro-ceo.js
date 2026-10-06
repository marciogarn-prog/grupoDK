/**
 * Despesas do FINANCEIRO CEO.
 * Cada lançamento novo é uma linha pequena no Supabase (entity:financeiro_ceo:despesa:<id>).
 * POST com patch=true não lê nem regrava o snapshot default.
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
const {
  gravarLancamentosFinanceiroCeo,
  lerConfirmacaoDespesaCeo,
  lerLinhasFinanceiroCeo,
  unirHistoricoComLinhas,
  criarIoSupabaseLinhas,
} = require("../lib/dk-financeiro-ceo-linha.cjs");

const STORAGE_KEY = "dk:portal:financeiro_ceo:v1";
const HASH_DESP = "dk:portal:financeiro_ceo:despesas:h";
const HASH_SIT = "dk:portal:financeiro_ceo:situacao:h";
const HASH_FONT = "dk:portal:financeiro_ceo:fontes:h";
const HASH_CART = "dk:portal:financeiro_ceo:cartoes:h";
const HASH_DESP_UNI = "dk:portal:financeiro_despesas:h";
const OP_KEY_PREFIX = "dk:portal:fin_ceo_op:";

function idConsultaCeo(req) {
  const bruto = req && req.query && req.query.id != null ? req.query.id : "";
  let id = Array.isArray(bruto) ? bruto[0] : bruto;
  if (!id && req && req.url) {
    try {
      id = new URL(req.url, "https://grupodkempreendimentos.com.br").searchParams.get("id") || "";
    } catch {
      id = "";
    }
  }
  id = String(id || "").trim();
  if (!id || id.length > 80) return "";
  return id;
}

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
  /* O corte isCloudBudgetTripped / budgetReject do snapshot default não recusa esta linha pequena. */
  if (await enforceRateLimit(req, res, "cadastro-financeiro-ceo", 40)) return;

  const gate = await requireLiveSession(req, { allowCliente: false, allowEquipa: true });
  if (!gate.ok) {
    return res.status(gate.status).json({ ok: false, reason: gate.reason });
  }

  let redis = null;
  if (isRedisKvConfigured()) {
    try {
      redis = createRedisClient();
    } catch {
      redis = null;
    }
  }

  try {
    if (req.method === "GET") {
      const idLeve = idConsultaCeo(req);
      if (idLeve) {
        const confirmacao = await lerConfirmacaoDespesaCeo(criarIoSupabaseLinhas(), idLeve);
        if (!confirmacao.ok) {
          return res.status(confirmacao.status || 503).json({
            ok: false,
            found: false,
            reason: confirmacao.reason || "supabase_indisponivel",
          });
        }
        return res.status(200).json({
          ok: true,
          found: confirmacao.found === true,
          id: confirmacao.id,
          revision: confirmacao.revision,
          updated_at: confirmacao.updated_at,
          operation_id: confirmacao.operation_id || "",
        });
      }
      const io = criarIoSupabaseLinhas();
      const pequenas = await lerLinhasFinanceiroCeo(io);
      if (!pequenas.ok) {
        return res.status(pequenas.status || 503).json({ ok: false, success: false, reason: pequenas.reason || "supabase_indisponivel" });
      }
      let historico = emptyBundle();
      if (redis) {
        try {
          historico = await seedHashesIfEmpty(redis);
        } catch {
          historico = emptyBundle();
        }
      }
      const data = unirHistoricoComLinhas(historico, pequenas.linhas);
      return res.status(200).json({
        ok: true,
        success: true,
        data,
        vazio: !bundleTemDados(data),
        source: "supabase",
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
      const io = criarIoSupabaseLinhas();
      io.cache = async (salvos) => {
        if (!redis) return;
        await aplicarBlocoHash(redis, salvos);
        if (opKey) await redis.set(opKey, "1", { ex: 86400 });
      };
      const gravacao = await gravarLancamentosFinanceiroCeo({
        bundle: incoming,
        io,
        agora: () => new Date().toISOString(),
        operationId: body?.operationId || "",
      });
      if (!gravacao.ok) {
        return res.status(gravacao.status || 503).json({
          ok: false,
          success: false,
          reason: gravacao.reason || "supabase_indisponivel",
          revision: gravacao.revision,
        });
      }
      const corpo = {
        ok: true,
        success: true,
        fonte: "supabase",
        registros: gravacao.registros,
        gravados: gravacao.registros.length,
      };
      return res.status(200).json(isPatch ? { ...corpo, patch: true } : { ...corpo, patch: false });
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
