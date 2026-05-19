/**
 * Coleta snapshot DK para backup (Supabase + Redis Upstash).
 */
const { Redis } = require("@upstash/redis");

const REDIS_KEYS = {
  clientes: "dk:portal:clientes_cadastro:v1",
  veiculos: "dk:portal:veiculos_cadastro:v1",
  locacoes: "dk:portal:locacoes_cadastro:v1",
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
];

function parseJsonArray(raw) {
  if (raw == null) return [];
  if (typeof raw === "string") {
    try {
      const p = JSON.parse(raw);
      return Array.isArray(p) ? p : [];
    } catch {
      return [];
    }
  }
  if (Array.isArray(raw)) return raw;
  return [];
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

async function fetchSupabaseSnapshot() {
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

  const url = `${base.replace(/\/$/, "")}/rest/v1/dk_cloud_snapshots?label=eq.default&select=payload,updated_at`;
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

async function fetchRedisCadastros() {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return { ok: false, reason: "redis_not_configured", data: null };
  }
  const redis = Redis.fromEnv();
  const data = {};
  for (const [name, storageKey] of Object.entries(REDIS_KEYS)) {
    const raw = await redis.get(storageKey);
    data[name] = parseJsonArray(raw);
  }
  return { ok: true, reason: "ok", data };
}

/**
 * Monta payload no formato do backup operacional do app.
 */
async function collectDkBackupPayload() {
  const [supabase, redis] = await Promise.all([fetchSupabaseSnapshot(), fetchRedisCadastros()]);

  const data = {};
  if (supabase.payload) {
    for (const k of SNAPSHOT_STORAGE_KEYS) {
      if (Object.prototype.hasOwnProperty.call(supabase.payload, k)) {
        data[k] = supabase.payload[k];
      }
    }
    for (const [k, v] of Object.entries(supabase.payload)) {
      if (!Object.prototype.hasOwnProperty.call(data, k)) data[k] = v;
    }
  }

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
    exportedAtIso: now.toISOString(),
    exportedAtBr,
    timezone: "America/Sao_Paulo",
    data,
    redis: redis.data || null,
    sources: {
      supabase: {
        ok: supabase.ok,
        reason: supabase.reason,
        updatedAt: supabase.updatedAt,
        detail: supabase.detail || null,
      },
      redis: { ok: redis.ok, reason: redis.reason },
    },
    counts: countRecords(data),
    redisCounts: redis.data
      ? {
          clientes: redis.data.clientes?.length || 0,
          veiculos: redis.data.veiculos?.length || 0,
          locacoes: redis.data.locacoes?.length || 0,
        }
      : null,
  };
}

function backupFileBaseName(payload, suffix) {
  const d = payload?.exportedAtBr?.slice(0, 10) || new Date().toISOString().slice(0, 10);
  const base = `dk-backup-${d}`;
  return suffix ? `${base}-${suffix}` : base;
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
function buildBrowserBackupPayload(browserData) {
  const data = browserData && typeof browserData === "object" ? browserData : {};
  const { exportedAtBr, exportedAtIso } = brExportedAtParts();
  return {
    version: 2,
    source: "dk-portal-browser",
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
};
