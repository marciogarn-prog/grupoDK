/**
 * Sincronização do cadastro de veículos do portal (API no root do projeto para Vercel).
 * Variáveis obrigatórias: UPSTASH_REDIS_REST_URL e UPSTASH_REDIS_REST_TOKEN
 */
const { Redis } = require("@upstash/redis");
const { mergeVeiculosCadastro } = require("./dk-append-only-merge");

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
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return res.status(503).json({ ok: false, reason: "kv_not_configured" });
  }

  const redis = Redis.fromEnv();

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
