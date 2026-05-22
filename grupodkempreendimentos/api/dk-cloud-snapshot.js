/**
 * Snapshot completo DK (localStorage) — cópia redundante em Upstash Redis.
 * Quando Supabase falhar, o portal usa GET/POST nesta API.
 *
 * Variáveis Vercel: UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN
 *
 * GET  /api/dk-cloud-snapshot → { ok, payload, updated_at, source: "redis" }
 * POST /api/dk-cloud-snapshot → body { payload, updated_at? }
 */
const { isRedisKvConfigured, createRedisClient } = require("../lib/dk-redis-env.cjs");

const REDIS_KEY = "dk:portal:cloud_snapshot:v1";
const LABEL = "default";

function applyCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
}

function parseBody(req) {
  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      body = {};
    }
  }
  return body && typeof body === "object" ? body : {};
}

function isObject(v) {
  return v && typeof v === "object" && !Array.isArray(v);
}

/** Merge mínimo de comprovantes (mesma ideia do portal). */
function mergeComprovantesClientePendentes(localArr, cloudArr) {
  const rank = { confirmado: 4, ia_validado: 3, pendente: 2, rejeitado: 1 };
  const byId = new Map();
  const push = (r) => {
    if (!r || typeof r !== "object" || !r.id) return;
    const prev = byId.get(r.id);
    if (!prev) {
      byId.set(r.id, r);
      return;
    }
    const rp = rank[r.status] || 0;
    const pp = rank[prev.status] || 0;
    if (rp > pp) byId.set(r.id, r);
    else if (rp === pp) {
      const te = Date.parse(r.enviadoEm || 0) || 0;
      const tp = Date.parse(prev.enviadoEm || 0) || 0;
      if (te >= tp) byId.set(r.id, r);
    }
  };
  (Array.isArray(localArr) ? localArr : []).forEach(push);
  (Array.isArray(cloudArr) ? cloudArr : []).forEach(push);
  return Array.from(byId.values()).sort(
    (a, b) => (Date.parse(b.enviadoEm || 0) || 0) - (Date.parse(a.enviadoEm || 0) || 0)
  );
}

function mergePayloads(existing, incoming) {
  if (!isObject(existing)) return incoming;
  if (!isObject(incoming)) return existing;
  const out = { ...existing, ...incoming };
  if (
    Object.prototype.hasOwnProperty.call(incoming, "dk_comprovantes_cliente_pendentes") ||
    Object.prototype.hasOwnProperty.call(existing, "dk_comprovantes_cliente_pendentes")
  ) {
    out.dk_comprovantes_cliente_pendentes = mergeComprovantesClientePendentes(
      existing.dk_comprovantes_cliente_pendentes,
      incoming.dk_comprovantes_cliente_pendentes
    );
  }
  return out;
}

module.exports = async function handler(req, res) {
  applyCors(res);
  res.setHeader("Content-Type", "application/json");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (!isRedisKvConfigured()) {
    return res.status(503).json({ ok: false, reason: "kv_not_configured" });
  }

  const redis = createRedisClient();

  try {
    if (req.method === "GET") {
      const raw = await redis.get(REDIS_KEY);
      if (!raw) {
        return res.status(200).json({
          ok: true,
          label: LABEL,
          payload: null,
          updated_at: null,
          source: "redis",
        });
      }
      let row = raw;
      if (typeof raw === "string") {
        try {
          row = JSON.parse(raw);
        } catch {
          return res.status(500).json({ ok: false, reason: "invalid_stored_json" });
        }
      }
      const payload = row?.payload && typeof row.payload === "object" ? row.payload : null;
      return res.status(200).json({
        ok: true,
        label: LABEL,
        payload,
        updated_at: row?.updated_at || null,
        source: "redis",
      });
    }

    if (req.method === "POST") {
      const body = parseBody(req);
      const incoming = body.payload;
      if (!isObject(incoming)) {
        return res.status(400).json({ ok: false, reason: "payload_required" });
      }
      const updatedAt = String(body.updated_at || new Date().toISOString());
      const existingRaw = await redis.get(REDIS_KEY);
      let existingPayload = null;
      if (existingRaw) {
        let row = existingRaw;
        if (typeof existingRaw === "string") {
          try {
            row = JSON.parse(existingRaw);
          } catch {
            row = null;
          }
        }
        if (row?.payload && typeof row.payload === "object") existingPayload = row.payload;
      }
      const replace = body.replace === true || body.mode === "replace";
      const payload = replace ? incoming : mergePayloads(existingPayload, incoming);
      const stored = { label: LABEL, payload, updated_at: updatedAt };
      await redis.set(REDIS_KEY, JSON.stringify(stored));
      return res.status(200).json({
        ok: true,
        label: LABEL,
        updated_at: updatedAt,
        source: "redis",
        replace,
        keys: Object.keys(payload).length,
      });
    }
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: String(e && e.message ? e.message : e),
    });
  }

  return res.status(405).json({ ok: false, reason: "method" });
};
