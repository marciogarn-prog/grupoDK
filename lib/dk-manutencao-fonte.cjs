/**
 * Autoridade operacional de Manutenção: public.dk_manutencao (após cutover).
 * Snapshot permanece físico; não é fallback de write.
 */
const { isRedisKvConfigured, createRedisClient } = require("./dk-redis-env.cjs");
const { isSupabaseDoormanConfigured } = require("./dk-supabase-doorman.cjs");

const FLAG_REDIS = "dk:portal:manutencao_fonte:v1";
const FONTE = "dk_manutencao";
const DEFAULT_URL = "https://ppxtwqvzgujllfzarpuz.supabase.co";

function envCutover() {
  return String(process.env.DK_MANUTENCAO_PG || "").trim() === "1";
}

async function obterFonteManutencao(redisOpt) {
  if (envCutover()) return FONTE;
  if (!isRedisKvConfigured()) return "";
  let redis = redisOpt;
  let fechar = false;
  try {
    if (!redis) {
      redis = createRedisClient();
      fechar = true;
    }
    const v = String((await redis.get(FLAG_REDIS)) || "").trim();
    return v === FONTE ? FONTE : "";
  } catch {
    return "";
  } finally {
    if (fechar && redis && typeof redis.quit === "function") {
      try {
        await redis.quit();
      } catch {
        /* ignore */
      }
    }
  }
}

async function manutencaoUnificadaAtiva(redisOpt) {
  return (await obterFonteManutencao(redisOpt)) === FONTE;
}

async function definirFonteManutencao(valor, redisOpt) {
  if (!isRedisKvConfigured()) return { ok: false, reason: "kv_not_configured" };
  let redis = redisOpt;
  let fechar = false;
  try {
    if (!redis) {
      redis = createRedisClient();
      fechar = true;
    }
    const v = String(valor || "").trim();
    if (v === FONTE) await redis.set(FLAG_REDIS, FONTE);
    else await redis.del(FLAG_REDIS);
    return { ok: true, fonte: v === FONTE ? FONTE : "", flag: FLAG_REDIS };
  } finally {
    if (fechar && redis && typeof redis.quit === "function") {
      try {
        await redis.quit();
      } catch {
        /* ignore */
      }
    }
  }
}

function supabaseUrl() {
  return String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || DEFAULT_URL).trim().replace(/\/$/, "");
}

function serviceRoleKey() {
  return String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
}

async function rest(path, opts = {}) {
  if (!isSupabaseDoormanConfigured()) return { ok: false, status: 503, data: { reason: "doorman_key_missing" } };
  const key = serviceRoleKey();
  const res = await fetch(supabaseUrl() + "/rest/v1/" + path, {
    method: opts.method || "GET",
    headers: {
      apikey: key,
      Authorization: "Bearer " + key,
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(opts.prefer ? { Prefer: opts.prefer } : {}),
    },
    body: opts.body == null ? undefined : JSON.stringify(opts.body),
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text.slice(0, 300) };
  }
  return { ok: res.ok, status: res.status, data };
}

async function listarManutencoes(kind) {
  let path =
    "dk_manutencao?deleted_at=is.null&select=id,source_kind,source_id,placa,payload,record_version,updated_at&order=source_kind.asc,source_id.asc&limit=2000";
  if (kind === "historico" || kind === "rapida") {
    path =
      "dk_manutencao?deleted_at=is.null&source_kind=eq." +
      encodeURIComponent(kind) +
      "&select=id,source_kind,source_id,placa,payload,record_version,updated_at&order=source_id.asc&limit=2000";
  }
  const lido = await rest(path);
  if (!lido.ok) {
    return { ok: false, status: lido.status || 502, reason: "pg_indisponivel", fallback: false, source: FONTE };
  }
  const rows = Array.isArray(lido.data) ? lido.data : [];
  return {
    ok: true,
    status: 200,
    source: FONTE,
    fallback: false,
    data: rows.map((r) => ({
      ...(r.payload && typeof r.payload === "object" ? r.payload : {}),
      id: r.source_id || r.id,
      _pgId: r.id,
      _record_version: r.record_version,
      _kind: r.source_kind,
    })),
  };
}

module.exports = {
  FLAG_REDIS,
  FONTE,
  obterFonteManutencao,
  manutencaoUnificadaAtiva,
  definirFonteManutencao,
  listarManutencoes,
};
