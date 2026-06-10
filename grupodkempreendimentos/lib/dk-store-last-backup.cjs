/**
 * Guarda o último backup enviado por e-mail (Redis Upstash) para importação rápida no portal.
 */
const zlib = require("zlib");

const LAST_BACKUP_KEYS = {
  default: "dk:portal:last_backup:default:v1",
  demo: "dk:portal:last_backup:demo:v1",
};

function normalizeChannel(channel) {
  return channel === "demo" ? "demo" : "default";
}

function redisKeyForChannel(channel) {
  return LAST_BACKUP_KEYS[normalizeChannel(channel)];
}

function compressPayload(payload) {
  const json = JSON.stringify(payload);
  const gz = zlib.gzipSync(Buffer.from(json, "utf8"), { level: 9 });
  return { gz: gz.toString("base64"), rawSize: json.length, gzSize: gz.length };
}

function decompressStored(stored) {
  if (!stored || typeof stored !== "object") return null;
  if (stored.gz && typeof stored.gz === "string") {
    const buf = zlib.gunzipSync(Buffer.from(stored.gz, "base64"));
    return JSON.parse(buf.toString("utf8"));
  }
  if (stored.payload && typeof stored.payload === "object") return stored.payload;
  return null;
}

async function storeLastBackup(channel, payload, metaExtra = {}) {
  const { isRedisKvConfigured, createRedisClient } = require("./dk-redis-env.cjs");
  if (!isRedisKvConfigured()) {
    return { ok: false, reason: "redis_not_configured" };
  }
  if (!payload || typeof payload !== "object") {
    return { ok: false, reason: "invalid_payload" };
  }

  const ch = normalizeChannel(channel);
  const { gz, rawSize, gzSize } = compressPayload(payload);
  const now = new Date().toISOString();
  const record = {
    v: 1,
    channel: ch,
    meta: {
      exportedAtBr: payload.exportedAtBr || null,
      exportedAtIso: payload.exportedAtIso || null,
      source: payload.source || null,
      counts: payload.counts || {},
      emailTo: metaExtra.emailTo || null,
      emailSentAt: metaExtra.emailSentAt || now,
      filename: metaExtra.filename || null,
      rawSize,
      gzSize,
    },
    gz,
  };

  const redis = createRedisClient();
  await redis.set(redisKeyForChannel(ch), record);
  return { ok: true, channel: ch, meta: record.meta };
}

async function fetchLastBackupRecord(channel) {
  const { isRedisKvConfigured, createRedisClient } = require("./dk-redis-env.cjs");
  if (!isRedisKvConfigured()) {
    return { ok: false, reason: "redis_not_configured", record: null };
  }
  const redis = createRedisClient();
  const raw = await redis.get(redisKeyForChannel(channel));
  if (!raw) return { ok: false, reason: "not_found", record: null };
  let record = raw;
  if (typeof raw === "string") {
    try {
      record = JSON.parse(raw);
    } catch {
      return { ok: false, reason: "parse_error", record: null };
    }
  }
  if (!record || typeof record !== "object") {
    return { ok: false, reason: "invalid_record", record: null };
  }
  return { ok: true, reason: "ok", record };
}

async function fetchLastBackupMeta(channel) {
  const r = await fetchLastBackupRecord(channel);
  if (!r.ok || !r.record) return { ok: false, reason: r.reason, meta: null };
  return { ok: true, meta: r.record.meta || null, channel: r.record.channel || normalizeChannel(channel) };
}

async function fetchLastBackupPayload(channel) {
  const r = await fetchLastBackupRecord(channel);
  if (!r.ok || !r.record) return { ok: false, reason: r.reason, payload: null };
  try {
    const payload = decompressStored(r.record);
    if (!payload) return { ok: false, reason: "decompress_failed", payload: null };
    return { ok: true, payload, meta: r.record.meta || null };
  } catch (e) {
    return { ok: false, reason: "decompress_error", detail: String(e?.message || e), payload: null };
  }
}

module.exports = {
  LAST_BACKUP_KEYS,
  normalizeChannel,
  storeLastBackup,
  fetchLastBackupMeta,
  fetchLastBackupPayload,
};
