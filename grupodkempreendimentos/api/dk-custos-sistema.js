/**
 * Financeiro CEO — custo estimado de Vercel, Supabase, Redis e GitHub.
 * Só o administrador CEO lê e grava o câmbio e os planos.
 */
const { isRedisKvConfigured, createRedisClient } = require("../lib/dk-redis-env.cjs");
const { applyApiCors, requireLiveSession } = require("../lib/dk-portal-auth.cjs");
const { lerCustos, gravarPlanos } = require("../lib/dk-custos-sistema.cjs");

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

module.exports = async function handler(req, res) {
  applyApiCors(res);
  res.setHeader("Content-Type", "application/json");
  if (req.method === "OPTIONS") return res.status(204).end();

  const gate = await requireLiveSession(req, { allowCliente: false, allowEquipa: true, allowService: false });
  if (!gate.ok) return res.status(gate.status || 401).json({ ok: false, reason: gate.reason || "unauthorized" });
  if (String(gate.role || "") !== "owner") {
    return res.status(403).json({ ok: false, reason: "forbidden" });
  }
  if (!isRedisKvConfigured()) return res.status(503).json({ ok: false, reason: "kv_not_configured" });

  let redis;
  try {
    redis = createRedisClient();
  } catch {
    return res.status(503).json({ ok: false, reason: "kv_not_configured" });
  }

  if (req.method === "GET") {
    const painel = await lerCustos(redis);
    return res.status(200).json({ ok: true, ...painel });
  }
  if (req.method === "POST") {
    const painel = await gravarPlanos(redis, parseBody(req));
    return res.status(200).json({ ok: true, ...painel });
  }
  return res.status(405).json({ ok: false, reason: "method" });
};
