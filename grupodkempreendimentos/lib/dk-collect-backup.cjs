/**
 * Coleta snapshot DK para backup (Supabase + Redis Upstash).
 */
const CLOUD_SNAPSHOT_REDIS_KEYS = {
  default: "dk:portal:cloud_snapshot:v1",
  demo: "dk:portal:cloud_snapshot:demo:v1",
};

const SNAPSHOT_STORAGE_KEYS = [
  "dk_clientes_cadastro",
  "dk_clientes_validacao_pendente",
  "dk_veiculos_cadastro",
  "dk_locacoes_cadastro",
  "dk_locacoes_quadro_geral",
  "dk_manutencoes_cadastro",
  "dk_lancamentos_aluguel",
  "dk_quadro_receita_overrides",
  "dk_comprovantes_banco",
  "dk_audit_log",
  "dk_funcionarios_access",
  "dk_comunicacao_operacao_v1",
];

function normalizeChannel(channel) {
  return channel === "demo" ? "demo" : "default";
}

function countRecords(data) {
  const counts = {};
  if (!data || typeof data !== "object") return counts;
  for (const [k, v] of Object.entries(data)) {
    if (Array.isArray(v)) counts[k] = v.length;
    else if (v && typeof v === "object") counts[k] = Object.keys(v).length;
    else if (v != null) counts[k] = 1;
    else counts[k] = 0;
  }
  return counts;
}

function mergeSnapshotPayloads(primary, secondary) {
  const data = {};
  const sources = [primary, secondary].filter((p) => p && typeof p === "object");
  for (const src of sources) {
    for (const k of SNAPSHOT_STORAGE_KEYS) {
      if (Object.prototype.hasOwnProperty.call(src, k) && !Object.prototype.hasOwnProperty.call(data, k)) {
        data[k] = src[k];
      }
    }
    for (const [k, v] of Object.entries(src)) {
      if (!Object.prototype.hasOwnProperty.call(data, k)) data[k] = v;
    }
  }
  return data;
}

async function fetchSupabaseSnapshot(channel = "default") {
  const label = normalizeChannel(channel) === "demo" ? "demo" : "default";
  const base =
    process.env.SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    "https://ppxtwqvzgujllfzarpuz.supabase.co";
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    "";
  if (!key) {
    return { ok: false, reason: "supabase_key_missing", payload: null, updatedAt: null };
  }

  const url = `${base.replace(/\/$/, "")}/rest/v1/dk_cloud_snapshots?label=eq.${label}&select=payload,updated_at`;
  const res = await fetch(url, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Accept: "application/json",
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return {
      ok: false,
      reason: `supabase_http_${res.status}`,
      detail: text.slice(0, 200),
      payload: null,
      updatedAt: null,
    };
  }
  const rows = await res.json();
  const row = Array.isArray(rows) && rows.length ? rows[0] : null;
  const payload = row?.payload && typeof row.payload === "object" ? row.payload : null;
  return {
    ok: Boolean(payload),
    reason: payload ? "ok" : "supabase_empty",
    payload,
    updatedAt: row?.updated_at || null,
  };
}

async function fetchRedisCloudSnapshot(channel = "default") {
  const { isRedisKvConfigured, createRedisClient } = require("./dk-redis-env.cjs");
  if (!isRedisKvConfigured()) {
    return { ok: false, reason: "redis_not_configured", payload: null, updatedAt: null };
  }
  const ch = normalizeChannel(channel);
  const redisKey = ch === "demo" ? CLOUD_SNAPSHOT_REDIS_KEYS.demo : CLOUD_SNAPSHOT_REDIS_KEYS.default;
  const redis = createRedisClient();
  const raw = await redis.get(redisKey);
  if (raw == null) {
    return { ok: false, reason: "redis_empty", payload: null, updatedAt: null };
  }
  let row = raw;
  if (typeof raw === "string") {
    try {
      row = JSON.parse(raw);
    } catch {
      return { ok: false, reason: "redis_parse", payload: null, updatedAt: null };
    }
  }
  const payload = row?.payload && typeof row.payload === "object" ? row.payload : null;
  return {
    ok: Boolean(payload),
    reason: payload ? "ok" : "redis_empty",
    payload,
    updatedAt: row?.updated_at || null,
  };
}

/**
 * Monta payload no formato do backup operacional do app.
 * @param {{ channel?: 'default'|'demo' }} opts
 */
async function collectDkBackupPayload(opts = {}) {
  const channel = normalizeChannel(opts.channel);
  const [supabase, redis] = await Promise.all([
    fetchSupabaseSnapshot(channel),
    fetchRedisCloudSnapshot(channel),
  ]);

  const data = mergeSnapshotPayloads(supabase.payload, redis.payload);

  const now = new Date();
  const brParts = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const pick = (t) => brParts.find((p) => p.type === t)?.value || "";
  const exportedAtBr = `${pick("year")}-${pick("month")}-${pick("day")}T${pick("hour")}:${pick("minute")}:${pick("second")}-03:00`;

  return {
    version: 2,
    source: "dk-vercel-cron",
    channel,
    exportedAtIso: now.toISOString(),
    exportedAtBr,
    timezone: "America/Sao_Paulo",
    data,
    redis: null,
    sources: {
      supabase: {
        ok: supabase.ok,
        reason: supabase.reason,
        updatedAt: supabase.updatedAt,
        detail: supabase.detail || null,
      },
      redis: {
        ok: redis.ok,
        reason: redis.reason,
        updatedAt: redis.updatedAt,
      },
    },
    counts: countRecords(data),
    redisCounts: null,
  };
}

function backupFileBaseName(payload, suffix) {
  const d = payload?.exportedAtBr?.slice(0, 10) || new Date().toISOString().slice(0, 10);
  const channelSuffix =
    suffix ||
    (payload?.channel === "demo" ? "demo" : payload?.channel === "default" ? null : null);
  const base = `dk-backup-${d}`;
  return channelSuffix ? `${base}-${channelSuffix}` : base;
}

function brExportedAtParts(now = new Date()) {
  const brParts = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const pick = (t) => brParts.find((p) => p.type === t)?.value || "";
  const exportedAtBr = `${pick("year")}-${pick("month")}-${pick("day")}T${pick("hour")}:${pick("minute")}:${pick("second")}-03:00`;
  return { exportedAtBr, exportedAtIso: now.toISOString() };
}

/** Snapshot enviado pelo navegador (botão «Gerar backup» no portal). */
function buildBrowserBackupPayload(browserData, channel = "default") {
  const data = browserData && typeof browserData === "object" ? browserData : {};
  const ch = normalizeChannel(channel);
  const { exportedAtBr, exportedAtIso } = brExportedAtParts();
  return {
    version: 2,
    source: "dk-portal-browser",
    channel: ch,
    exportedAtIso,
    exportedAtBr,
    timezone: "America/Sao_Paulo",
    data,
    redis: null,
    sources: {
      supabase: { ok: false, reason: "browser_export" },
      redis: { ok: false, reason: "browser_export" },
    },
    counts: countRecords(data),
    redisCounts: null,
  };
}

module.exports = {
  SNAPSHOT_STORAGE_KEYS,
  collectDkBackupPayload,
  buildBrowserBackupPayload,
  backupFileBaseName,
  countRecords,
  normalizeChannel,
};
