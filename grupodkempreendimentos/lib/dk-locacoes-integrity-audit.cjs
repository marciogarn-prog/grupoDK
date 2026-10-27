"use strict";

const { obterFonteLocacoes, FONTE_LOCACAO } = require("./dk-locacao-pg.cjs");
const { isRedisKvConfigured, createRedisClient } = require("./dk-redis-env.cjs");
const {
  isSupabaseDoormanConfigured,
  fetchSnapshotByLabel,
  upsertSnapshotByLabel,
  withDoormanTimeout,
} = require("./dk-supabase-doorman.cjs");
const {
  CANONICAL_SNAPSHOT_KEY,
  LOCACOES_INTEGRITY_KEY,
  acquireLocacoesWriteLock,
  releaseLocacoesWriteLock,
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

function freshnessOfLocacao(loc) {
  let best = 0;
  const stamp = Number(loc?.updatedAt);
  if (Number.isFinite(stamp) && stamp > 0) best = stamp;
  const parsed = Date.parse(String(loc?.updatedAt || loc?.updated_at || ""));
  if (Number.isFinite(parsed) && parsed > best) best = parsed;
  const lists = [loc?.portalLancamentosAluguel, loc?.portalLancamentosAluguelRemovidos];
  for (const list of lists) {
    if (!Array.isArray(list)) continue;
    for (const row of list) {
      const created = Number(row?.createdAt || 0);
      const removed = Number(row?.removedAt || 0);
      if (created > best) best = created;
      if (removed > best) best = removed;
    }
  }
  return best;
}

/**
 * Mesmo protocolo nos dois lados: fica o registo mais recente.
 * Empate fica com o Redis (fonte oficial).
 */
function mergeLocacoesPorAtualidade(redisList, mirrorList) {
  const map = new Map();
  const put = (loc, replaceOnTie) => {
    if (!loc || typeof loc !== "object") return;
    const nc = normalizeProtocolKey(loc.numeroContrato || loc.protocolo);
    if (!nc) return;
    const prev = map.get(nc);
    if (!prev) {
      map.set(nc, loc);
      return;
    }
    const nextFresh = freshnessOfLocacao(loc);
    const prevFresh = freshnessOfLocacao(prev);
    if (nextFresh > prevFresh || (nextFresh === prevFresh && replaceOnTie)) map.set(nc, loc);
  };
  for (const loc of Array.isArray(mirrorList) ? mirrorList : []) put(loc, false);
  for (const loc of Array.isArray(redisList) ? redisList : []) put(loc, true);
  return [...map.values()];
}

async function gravarLocacoesAlinhadas(redis, row, canonicalPayload, mirrorPayload, list) {
  const storedAt = new Date().toISOString();
  const mirrorNext = { ...(mirrorPayload || {}), dk_locacoes_cadastro: list };
  const saved = await withDoormanTimeout(
    upsertSnapshotByLabel("default", mirrorNext, storedAt),
    20000,
    "supabase_timeout"
  );
  if (!saved || saved.ok !== true) {
    return { ok: false, reason: String(saved?.reason || "supabase_falhou") };
  }
  const canonicalNext = { ...(canonicalPayload || {}), dk_locacoes_cadastro: list };
  const envelope = {
    ...(row && typeof row === "object" ? row : {}),
    label: "default",
    payload: canonicalNext,
    updated_at: storedAt,
  };
  await redis.set(CANONICAL_SNAPSHOT_KEY, JSON.stringify(envelope));
  await redis.set(`${CANONICAL_SNAPSHOT_KEY}:rev`, storedAt);
  return { ok: true, storedAt };
}

async function runLocacoesIntegrityAudit(opts) {
  const checkedAt = new Date().toISOString();
  const fonte = await obterFonteLocacoes(opts);
  if (fonte === FONTE_LOCACAO) {
    return {
      ok: true,
      checkedAt,
      skipped: true,
      reason: "skipped_pg_active",
      fonte,
      message: "Locações não são auditadas no snapshot. A fonte oficial é o PostgreSQL.",
    };
  }
  if (!(opts && opts.redis) && !isRedisKvConfigured()) {
    return { ok: false, checkedAt, reason: "redis_not_configured" };
  }
  const redis = (opts && opts.redis) || createRedisClient();
  const row = parseStoredRow(await redis.get(CANONICAL_SNAPSHOT_KEY));
  const canonicalPayload = row?.payload && typeof row.payload === "object" ? row.payload : null;
  const canonicalLocacoes = Array.isArray(canonicalPayload?.dk_locacoes_cadastro)
    ? canonicalPayload.dk_locacoes_cadastro
    : [];
  const conflicts = findActivePlateConflicts(canonicalLocacoes);
  const canonicalHash = canonicalLocacoesDigest(canonicalLocacoes);

  let mirror = { ok: false, reason: "supabase_not_configured", payload: null };
  if (opts && Object.prototype.hasOwnProperty.call(opts, "espelho")) {
    mirror = opts.espelho;
  } else if (isSupabaseDoormanConfigured()) {
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
  let locacoesFinais = canonicalLocacoes;
  let hashFinal = canonicalHash;
  let mirrorHashFinal = mirrorHash;
  let channelsEqualFinal = channelsEqual;
  let aligned = false;
  let alignReason = "";
  if (canonicalPayload && mirrorAvailable && conflicts.length === 0 && !channelsEqual) {
    let list = mergeLocacoesPorAtualidade(canonicalLocacoes, mirrorLocacoes);
    if (findActivePlateConflicts(list).length) list = canonicalLocacoes;
    const hash = canonicalLocacoesDigest(list);
    if (!findActivePlateConflicts(list).length && hash) {
      const token = await acquireLocacoesWriteLock(redis, { attempts: 8, waitMs: 40, ttlSec: 20 });
      if (!token) {
        alignReason = "locacoes_write_busy";
      } else {
        try {
          const gravar = (opts && opts.gravar) || gravarLocacoesAlinhadas;
          const gravou = await gravar(redis, row, canonicalPayload, mirror.payload, list);
          if (gravou.ok) {
            locacoesFinais = list;
            hashFinal = hash;
            mirrorHashFinal = hash;
            channelsEqualFinal = true;
            aligned = true;
          } else {
            alignReason = gravou.reason || "align_failed";
          }
        } catch (error) {
          alignReason = String(error?.message || error);
        } finally {
          await releaseLocacoesWriteLock(redis, token);
        }
      }
    }
  }
  const conflictsFinais = findActivePlateConflicts(locacoesFinais);
  const ok = Boolean(canonicalPayload) && conflictsFinais.length === 0 && channelsEqualFinal;
  let reason = "";
  if (!canonicalPayload) reason = "canonical_missing";
  else if (conflictsFinais.length) reason = "active_plate_conflict";
  else if (!mirrorAvailable) reason = "mirror_unavailable";
  else if (!channelsEqualFinal) reason = alignReason || "channels_diverged";
  const result = {
    ok,
    checkedAt,
    aligned,
    canonical: {
      source: "redis:dk-cloud-snapshot/default",
      count: locacoesFinais.length,
      hash: hashFinal,
    },
    mirror: {
      source: "supabase:default",
      available: mirrorAvailable,
      count: channelsEqualFinal ? locacoesFinais.length : mirrorLocacoes.length,
      hash: mirrorHashFinal,
      reason: mirrorAvailable ? "" : String(mirror?.reason || "mirror_unavailable"),
    },
    channelsEqual: channelsEqualFinal,
    activePlateConflicts: conflictsFinais,
    protocolDiff: channelsEqualFinal
      ? { onlyRedis: [], onlySupabase: [], onlyRedisCount: 0, onlySupabaseCount: 0, sampleLimit: 40 }
      : protocolDiff,
    reason,
  };
  await redis.set(LOCACOES_INTEGRITY_KEY, JSON.stringify(result), { ex: 7 * 24 * 60 * 60 });
  return result;
}

module.exports = {
  runLocacoesIntegrityAudit,
  mergeLocacoesPorAtualidade,
  freshnessOfLocacao,
};
