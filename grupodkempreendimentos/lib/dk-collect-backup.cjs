/**
 * Coleta snapshot DK para backup (Supabase + Redis Upstash).
 */
const CLOUD_SNAPSHOT_REDIS_KEYS = {
  default: "dk:portal:cloud_snapshot:v1",
};

const SNAPSHOT_STORAGE_KEYS = [
  "dk_clientes_cadastro",
  "dk_clientes_validacao_pendente",
  "dk_veiculos_cadastro",
  "dk_locacoes_cadastro",
  "dk_locacoes_quadro_geral",
  "dk_manutencoes_cadastro",
  "dk_manutencoes_rapidas_v1",
  "dk_lancamentos_aluguel",
  "dk_quadro_receita_overrides",
  "dk_comprovantes_banco",
  "dk_audit_log",
  "dk_funcionarios_access",
  "dk_comunicacao_operacao_v1",
];

function normalizeChannel() {
  return "default";
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
  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!key) {
    return { ok: false, reason: "doorman_key_missing", payload: null, updatedAt: null };
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

const PG_OFICIAL_TABELAS = [
  { key: "dk_clientes", path: "dk_clientes", select: "id", countExact: true },
  { key: "dk_veiculos", path: "dk_veiculos", select: "id", countExact: true },
  { key: "dk_locacao", path: "dk_locacao", select: "id", countExact: true },
  { key: "dk_pagamento_locacao", path: "dk_pagamento_locacao", select: "id,removed_at", countExact: true },
  { key: "dk_manutencao", path: "dk_manutencao", select: "id", countExact: true },
  { key: "dk_events", path: "dk_events", select: "seq,audit_no", countExact: true },
  { key: "dk_audit_state", path: "dk_audit_state", select: "*", countExact: false },
  { key: "dk_mutation_receipt", path: "dk_mutation_receipt", select: "operation_id", countExact: true },
];

async function fetchPgTableMeta(base, key, table) {
  const url = `${base.replace(/\/$/, "")}/rest/v1/${table.path}?select=${encodeURIComponent(table.select)}&limit=0`;
  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    Accept: "application/json",
    Prefer: table.countExact ? "count=exact" : "count=estimated",
  };
  const res = await fetch(url, { headers });
  const range = String(res.headers.get("content-range") || "");
  const m = /\/(\d+)\s*$/.exec(range);
  const count = m ? Number(m[1]) : null;
  let sample = null;
  if (table.path === "dk_audit_state" && res.ok) {
    const full = await fetch(`${base.replace(/\/$/, "")}/rest/v1/dk_audit_state?select=*&limit=5`, { headers });
    sample = full.ok ? await full.json().catch(() => null) : null;
  }
  return {
    ok: res.ok,
    status: res.status,
    count: Number.isFinite(count) ? count : null,
    sample,
  };
}

/**
 * Captura metadados/contagens das tabelas oficiais PostgreSQL.
 * Não é snapshot transacional único — cada tabela é pedida em separado.
 */
async function fetchPgOficialColeta() {
  const base =
    process.env.SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    "https://ppxtwqvzgujllfzarpuz.supabase.co";
  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!key) {
    return { ok: false, reason: "doorman_key_missing", tables: {}, consistency: "unavailable" };
  }
  const tables = {};
  let okAll = true;
  for (const table of PG_OFICIAL_TABELAS) {
    try {
      const meta = await fetchPgTableMeta(base, key, table);
      tables[table.key] = meta;
      if (!meta.ok) okAll = false;
    } catch (err) {
      okAll = false;
      tables[table.key] = { ok: false, reason: String(err && err.message ? err.message : err) };
    }
  }
  return {
    ok: okAll,
    reason: okAll ? "ok" : "partial",
    tables,
    consistency: "non_transactional_independent_requests",
    note: "Contagens oficiais incluídas; dump físico WALG permanece a proteção completa.",
  };
}

/**
 * Monta payload no formato do backup operacional do app.
 * Snapshot legado fica em `data`; estado relacional em `oficial_pg` (separado).
 * @param {{ channel?: 'default'|'demo' }} opts
 */
async function collectDkBackupPayload(opts = {}) {
  const channel = normalizeChannel(opts.channel);
  const [supabase, redis, oficialPg] = await Promise.all([
    fetchSupabaseSnapshot(channel),
    fetchRedisCloudSnapshot(channel),
    fetchPgOficialColeta(),
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

  const oficialContagensOk = Boolean(oficialPg && oficialPg.ok);
  const legadoOk = Boolean(supabase.ok || redis.ok);
  /** Contagens oficiais ≠ dump relacional completo. Não usar como prova de restauração total. */
  const classificacao = {
    snapshot_legado: legadoOk,
    contagens_oficiais_pg: oficialContagensOk,
    backup_relacional_completo: false,
    restauracao_comprovada: false,
    nota:
      "Inclui snapshot legado (quando disponível) e contagens/metadados PostgreSQL. " +
      "Não contém dump completo das linhas oficiais. A proteção física WALG/PITR do Supabase permanece a referência de recuperação.",
  };

  return {
    version: 3,
    source: "dk-vercel-cron",
    channel,
    exportedAtIso: now.toISOString(),
    exportedAtBr,
    timezone: "America/Sao_Paulo",
    data,
    oficial_pg: oficialPg,
    redis: null,
    sources: {
      supabase: {
        ok: supabase.ok,
        reason: supabase.reason,
        updatedAt: supabase.updatedAt,
        detail: supabase.detail || null,
        role: "snapshot_legado_historico",
      },
      redis: {
        ok: redis.ok,
        reason: redis.reason,
        updatedAt: redis.updatedAt,
        role: "snapshot_legado_cache",
      },
      oficial_pg: {
        ok: oficialContagensOk,
        reason: oficialPg.reason,
        consistency: oficialPg.consistency,
        role: "contagens_relacionais_oficiais_nao_dump",
      },
    },
    classificacao,
    /** Compatibilidade: complete=false evita induzir restauração total. */
    complete: false,
    completeReason: "contagens_oficiais_sem_dump_relacional_completo",
    counts: countRecords(data),
    oficialCounts: Object.fromEntries(
      Object.entries((oficialPg && oficialPg.tables) || {}).map(([k, v]) => [k, v && v.count != null ? v.count : null])
    ),
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
  PG_OFICIAL_TABELAS,
  collectDkBackupPayload,
  fetchPgOficialColeta,
  buildBrowserBackupPayload,
  backupFileBaseName,
  countRecords,
  normalizeChannel,
};
