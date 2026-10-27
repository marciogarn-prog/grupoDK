/**
 * Ativa ou reverte a fonte oficial dos veículos.
 * Só o titular CEO. Não copia e não mexe no snapshot.
 */
const { applyApiCors, requireLiveSession, TITULAR_CEO_CPF } = require("../lib/dk-portal-auth.cjs");
const { onlyDigits } = require("../lib/dk-deploy-channel-api.cjs");
const { isRedisKvConfigured, createRedisClient } = require("../lib/dk-redis-env.cjs");
const { lerFonte, aplicarFonte, FLAG_REDIS } = require("../lib/dk-veiculos-fonte.cjs");

function lerBody(req) {
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
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET" && req.method !== "POST") return res.status(405).json({ ok: false, reason: "method" });
  const gate = await requireLiveSession(req, { allowCliente: false, allowEquipa: true, allowService: false });
  if (!gate.ok) return res.status(gate.status).json({ ok: false, reason: gate.reason });
  if (onlyDigits(gate.cpf).slice(0, 11) !== TITULAR_CEO_CPF) {
    return res.status(403).json({ ok: false, reason: "somente_titular" });
  }
  if (!isRedisKvConfigured()) return res.status(503).json({ ok: false, reason: "kv_not_configured" });
  const redis = createRedisClient();
  if (req.method === "GET") {
    const atual = await lerFonte(redis);
    return res.status(200).json({ ok: true, chave: FLAG_REDIS, ...atual });
  }
  const body = lerBody(req);
  const resultado = await aplicarFonte(redis, body.fonte);
  return res.status(resultado.status).json(resultado.body);
};
