"use strict";

const { isRedisKvConfigured, createRedisClient } = require("./dk-redis-env.cjs");
const {
  isSupabaseDoormanConfigured,
  fetchSnapshotByLabel,
  withDoormanTimeout,
} = require("./dk-supabase-doorman.cjs");
const {
  CANONICAL_SNAPSHOT_KEY,
  LOCACOES_INTEGRITY_KEY,
  findActivePlateConflicts,
  canonicalLocacoesDigest,
} = require("./dk-locacoes-integrity.cjs");

function parseStoredRow(raw) {
  if (!raw) return null;
  if (typeof raw === "object") return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function normalizeProtocolKey(value) {
  return String(value || "").replace(/\D/g, "");
}

/** Diferença por protocolo entre Redis (oficial) e Supabase (espelho). */
function diffLocacoesByProtocol(canonicalList, mirrorList) {
  const byNc = (list) => {
    const map = new Map();
    for (const loc of Array.isArray(list) ? list : []) {
      const nc = normalizeProtocolKey(loc?.numeroContrato || loc?.protocolo);
      if (!nc) continue;
      map.set(nc, loc);
    }
    return map;
  };
  const redis = byNc(canonicalList);
  const supabase = byNc(mirrorList);
  const onlyRedis = [];
  const onlySupabase = [];
  for (const [nc, loc] of redis) {
    if (supabase.has(nc)) continue;
    onlyRedis.push({
      protocolo: nc,
      nome: String(loc?.nome || loc?.cliente || "").trim() || "—",
      placa: String(loc?.placa || "")
        .trim()
        .toUpperCase(),
      status: String(loc?.statusLocacao || loc?.status || "").trim() || "—",
    });
  }
  for (const [nc, loc] of supabase) {
    if (redis.has(nc)) continue;
    onlySupabase.push({
      protocolo: nc,
      nome: String(loc?.nome || loc?.cliente || "").trim() || "—",
      placa: String(loc?.placa || "")
        .trim()
        .toUpperCase(),
      status: String(loc?.statusLocacao || loc?.status || "").trim() || "—",
    });
  }
  const sampleLimit = 40;
  return {
    onlyRedisCount: onlyRedis.length,
    onlySupabaseCount: onlySupabase.length,
    onlyRedis: onlyRedis.slice(0, sampleLimit),
    onlySupabase: onlySupabase.slice(0, sampleLimit),
    sampleLimit,
  };
}

async function runLocacoesIntegrityAudit() {
  const checkedAt = new Date().toISOString();
  if (!isRedisKvConfigured()) {
    return { ok: false, checkedAt, reason: "redis_not_configured" };
  }
  const redis = createRedisClient();
  const row = parseStoredRow(await redis.get(CANONICAL_SNAPSHOT_KEY));
  const canonicalPayload = row?.payload && typeof row.payload === "object" ? row.payload : null;
  const canonicalLocacoes = Array.isArray(canonicalPayload?.dk_locacoes_cadastro)
    ? canonicalPayload.dk_locacoes_cadastro
    : [];
  const conflicts = findActivePlateConflicts(canonicalLocacoes);
  const canonicalHash = canonicalLocacoesDigest(canonicalLocacoes);

  let mirror = { ok: false, reason: "supabase_not_configured", payload: null };
  if (isSupabaseDoormanConfigured()) {
    try {
      mirror = await withDoormanTimeout(fetchSnapshotByLabel("default"), 12000, "supabase_timeout");
    } catch (error) {
      mirror = { ok: false, reason: String(error?.message || error), payload: null };
    }
  }
  const mirrorLocacoes = Array.isArray(mirror?.payload?.dk_locacoes_cadastro)
    ? mirror.payload.dk_locacoes_cadastro
    : [];
  const mirrorHash = mirrorLocacoes.length || canonicalLocacoes.length === 0
    ? canonicalLocacoesDigest(mirrorLocacoes)
    : "";
  const mirrorAvailable = Boolean(mirror?.payload && typeof mirror.payload === "object");
  const channelsEqual = mirrorAvailable && canonicalHash === mirrorHash;
  const protocolDiff = mirrorAvailable
    ? diffLocacoesByProtocol(canonicalLocacoes, mirrorLocacoes)
    : {
        onlyRedis: [],
        onlySupabase: [],
        onlyRedisCount: canonicalLocacoes.length,
        onlySupabaseCount: 0,
        sampleLimit: 40,
      };
  const ok = Boolean(canonicalPayload) && conflicts.length === 0 && channelsEqual;
  let reason = "";
  if (!canonicalPayload) reason = "canonical_missing";
  else if (conflicts.length) reason = "active_plate_conflict";
  else if (!mirrorAvailable) reason = "mirror_unavailable";
  else if (!channelsEqual) reason = "channels_diverged";
  const result = {
    ok,
    checkedAt,
    canonical: {
      source: "redis:dk-cloud-snapshot/default",
      count: canonicalLocacoes.length,
      hash: canonicalHash,
    },
    mirror: {
      source: "supabase:default",
      available: mirrorAvailable,
      count: mirrorLocacoes.length,
      hash: mirrorHash,
      reason: mirrorAvailable ? "" : String(mirror?.reason || "mirror_unavailable"),
    },
    channelsEqual,
    activePlateConflicts: conflicts,
    protocolDiff,
    reason,
  };
  await redis.set(LOCACOES_INTEGRITY_KEY, JSON.stringify(result), { ex: 7 * 24 * 60 * 60 });
  return result;
}

module.exports = {
  runLocacoesIntegrityAudit,
};
