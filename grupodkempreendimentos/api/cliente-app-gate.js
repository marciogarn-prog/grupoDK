/**
 * Valida CPF + protocolo para instalar o app cliente (dados em Redis, mesma fonte do portal).
 * GET /api/cliente-app-gate?cpf=00000000000&protocolo=ABC123&channel=demo
 */
const { isRedisKvConfigured, createRedisClient } = require("../lib/dk-redis-env.cjs");
const {
  onlyDigits,
  resolveDeployChannel,
  fetchPortalCadastrosFromRedis,
  matchClienteProtocoloGate,
} = require("../lib/dk-deploy-channel-api.cjs");

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-DK-Deploy-Channel");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, msg: "Método não permitido." });
  }

  const cpf = onlyDigits(req.query?.cpf || "").slice(0, 11);
  const protoIn = String(req.query?.protocolo || req.query?.proto || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");

  if (cpf.length !== 11) {
    return res.status(400).json({ ok: false, msg: "Informe um CPF válido (11 dígitos)." });
  }
  if (!protoIn) {
    return res.status(400).json({ ok: false, msg: "Informe o protocolo da locação." });
  }

  if (!isRedisKvConfigured()) {
    return res.status(503).json({
      ok: false,
      msg: "Validação temporariamente indisponível. Tente novamente em alguns minutos.",
      reason: "kv_not_configured",
    });
  }

  try {
    const redis = createRedisClient();
    const channel = resolveDeployChannel(req);
    const { clientes, locs } = await fetchPortalCadastrosFromRedis(redis, channel);
    const result = matchClienteProtocoloGate(cpf, protoIn, clientes, locs);
    if (!result.ok) {
      return res.status(404).json({ ok: false, msg: result.msg });
    }
    return res.status(200).json({
      ok: true,
      cpf: result.cpf,
      proto: result.proto,
      nome: result.nome,
      channel,
    });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      msg: "Erro ao validar. Tente novamente.",
      error: String(e && e.message ? e.message : e),
    });
  }
};
