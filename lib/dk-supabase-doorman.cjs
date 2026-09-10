/**
 * Porteiro Supabase — só o servidor fala com public.dk_cloud_snapshots.
 * Chave: SUPABASE_SERVICE_ROLE_KEY (nunca no browser, nunca chave anon).
 */
const DEFAULT_URL = "https://ppxtwqvzgujllfzarpuz.supabase.co";

function supabaseUrl() {
  return String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || DEFAULT_URL)
    .trim()
    .replace(/\/$/, "");
}

function serviceRoleKey() {
  return String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
}

function isSupabaseDoormanConfigured() {
  return Boolean(serviceRoleKey());
}

function normalizeLabel(label) {
  const raw = String(label || "default").trim();
  if (raw === "demo") return "demo";
  if (/^docblob:/i.test(raw)) return raw.slice(0, 180);
  return "default";
}

function doormanHeaders() {
  const key = serviceRoleKey();
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    Accept: "application/json",
  };
}

async function fetchSnapshotByLabel(label) {
  if (!isSupabaseDoormanConfigured()) {
    return { ok: false, reason: "doorman_key_missing", payload: null, updatedAt: null };
  }
  const safe = normalizeLabel(label);
  const url = `${supabaseUrl()}/rest/v1/dk_cloud_snapshots?label=eq.${encodeURIComponent(safe)}&select=payload,updated_at`;
  const res = await fetch(url, { headers: doormanHeaders() });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return {
      ok: false,
      reason: `supabase_http_${res.status}`,
      detail: String(text || "").slice(0, 180),
      payload: null,
      updatedAt: null,
    };
  }
  const rows = await res.json().catch(() => null);
  const row = Array.isArray(rows) && rows.length ? rows[0] : null;
  const payload = row?.payload && typeof row.payload === "object" ? row.payload : null;
  return {
    ok: Boolean(payload),
    reason: payload ? "ok" : "supabase_empty",
    payload,
    updatedAt: row?.updated_at || null,
  };
}

async function upsertSnapshotByLabel(label, payload, updatedAt) {
  if (!isSupabaseDoormanConfigured()) {
    return { ok: false, reason: "doorman_key_missing" };
  }
  if (!payload || typeof payload !== "object") {
    return { ok: false, reason: "payload_required" };
  }
  const safe = normalizeLabel(label);
  const url = `${supabaseUrl()}/rest/v1/dk_cloud_snapshots?on_conflict=label`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      ...doormanHeaders(),
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify({
      label: safe,
      payload,
      updated_at: String(updatedAt || new Date().toISOString()),
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return {
      ok: false,
      reason: `supabase_http_${res.status}`,
      detail: String(text || "").slice(0, 180),
    };
  }
  return { ok: true, reason: "ok" };
}

function withDoormanTimeout(promise, ms, reason) {
  const n = Number(ms) > 0 ? Number(ms) : 8000;
  return Promise.race([
    promise,
    new Promise((resolve) => {
      setTimeout(() => resolve({ ok: false, reason }), n);
    }),
  ]);
}

module.exports = {
  isSupabaseDoormanConfigured,
  fetchSnapshotByLabel,
  upsertSnapshotByLabel,
  withDoormanTimeout,
  normalizeLabel,
};
