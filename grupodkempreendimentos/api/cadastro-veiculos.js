/**
 * Sincronização do cadastro de veículos do portal (API no root do projeto para Vercel).
 * Variáveis obrigatórias: UPSTASH_REDIS_REST_URL e UPSTASH_REDIS_REST_TOKEN
 */
const { isRedisKvConfigured, createRedisClient } = require("../lib/dk-redis-env.cjs");
const { mergeVeiculosCadastro } = require("../lib/dk-append-only-merge.cjs");
const { applyApiCors, enforceRateLimit, requirePortalAuth } = require("../lib/dk-portal-auth.cjs");

const STORAGE_KEY = "dk:portal:veiculos_cadastro:v1";

function parseRedisArray(raw) {
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

module.exports = async function handler(req, res) {
  applyApiCors(res);

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (await enforceRateLimit(req, res, "cadastro-veiculos", 30)) return;
  const gate = requirePortalAuth(req, { allowCliente: false, allowEquipa: true });
  if (!gate.ok) {
    return res.status(gate.status).json({ ok: false, reason: gate.reason });
  }

  if (!isRedisKvConfigured()) {
    return res.status(503).json({ ok: false, reason: "kv_not_configured" });
  }

  const redis = createRedisClient();

  try {
    if (req.method === "GET") {
      const raw = await redis.get(STORAGE_KEY);
      const data = parseRedisArray(raw);
      return res.status(200).json({ ok: true, data });
    }

    if (req.method === "POST") {
      let body = req.body;
      if (typeof body === "string") {
        try {
          body = JSON.parse(body);
        } catch {
          body = {};
        }
      }
      const incoming = Array.isArray(body?.data) ? body.data : [];
      const existingRaw = await redis.get(STORAGE_KEY);
      const existing = parseRedisArray(existingRaw);
      const merged = mergeVeiculosCadastro(existing, incoming);
      await redis.set(STORAGE_KEY, JSON.stringify(merged));
      return res.status(200).json({ ok: true, count: merged.length });
    }
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e && e.message ? e.message : e) });
  }

  return res.status(405).json({ ok: false, reason: "method" });
};
