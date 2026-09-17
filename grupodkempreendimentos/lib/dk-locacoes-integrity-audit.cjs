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
  const ok = Boolean(canonicalPayload) && conflicts.length === 0 && channelsEqual;
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
    reason: !canonicalPayload
      ? "canonical_missing"
      : conflicts.length
        ? "active_plate_conflict"
        : !channelsEqual
          ? "channels_diverged"
          : "",
  };
  await redis.set(LOCACOES_INTEGRITY_KEY, JSON.stringify(result), { ex: 7 * 24 * 60 * 60 });
  return result;
}

module.exports = {
  runLocacoesIntegrityAudit,
};
