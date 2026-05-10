/**
 * Sincronização do cadastro de locações do portal (incl. lançamentos embutidos no registro).
 * API no root do projeto para Vercel.
 * Variáveis obrigatórias: UPSTASH_REDIS_REST_URL e UPSTASH_REDIS_REST_TOKEN
 */
const { Redis } = require("@upstash/redis");

const STORAGE_KEY = "dk:portal:locacoes_cadastro:v1";

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
      let data = [];
      if (raw == null) data = [];
      else if (typeof raw === "string") {
        try {
          const p = JSON.parse(raw);
          data = Array.isArray(p) ? p : [];
        } catch {
          data = [];
        }
      } else if (Array.isArray(raw)) {
        data = raw;
      }
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
      const data = Array.isArray(body?.data) ? body.data : [];
      await redis.set(STORAGE_KEY, JSON.stringify(data));
      return res.status(200).json({ ok: true, count: data.length });
    }
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e && e.message ? e.message : e) });
  }

  return res.status(405).json({ ok: false, reason: "method" });
};
