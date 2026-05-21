/**
 * Valida CPF + protocolo para instalar o app cliente (dados em Redis, mesma fonte do portal).
 * GET /api/cliente-app-gate?cpf=00000000000&protocolo=ABC123
 */
const { Redis } = require("@upstash/redis");

const CLIENTES_KEY = "dk:portal:clientes_cadastro:v1";
const LOCACOES_KEY = "dk:portal:locacoes_cadastro:v1";

function onlyDigits(s) {
  return String(s ?? "").replace(/\D/g, "");
}

function normProto(value) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

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
  return Array.isArray(raw) ? raw : [];
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, msg: "Método não permitido." });
  }

  const cpf = onlyDigits(req.query?.cpf || "").slice(0, 11);
  const protoIn = normProto(req.query?.protocolo || req.query?.proto || "");

  if (cpf.length !== 11) {
    return res.status(400).json({ ok: false, msg: "Informe um CPF válido (11 dígitos)." });
  }
  if (!protoIn) {
    return res.status(400).json({ ok: false, msg: "Informe o protocolo da locação." });
  }

  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return res.status(503).json({
      ok: false,
      msg: "Validação temporariamente indisponível. Tente novamente em alguns minutos.",
      reason: "kv_not_configured",
    });
  }

  try {
    const redis = Redis.fromEnv();
    const [rawClientes, rawLocs] = await Promise.all([
      redis.get(CLIENTES_KEY),
      redis.get(LOCACOES_KEY),
    ]);
    const clientes = parseRedisArray(rawClientes);
    const locs = parseRedisArray(rawLocs);

    const cliente = clientes.find((c) => onlyDigits(c.cpf) === cpf) || null;
    if (!cliente) {
      return res.status(404).json({
        ok: false,
        msg: "Cliente não cadastrado. Contacte a DK Locadora.",
      });
    }

    const hit = locs.find(
      (l) => onlyDigits(l.cpf) === cpf && normProto(l.numeroContrato) === protoIn
    );
    if (!hit) {
      return res.status(404).json({
        ok: false,
        msg: "Protocolo não encontrado para este CPF. Verifique os dados ou contacte a locadora.",
      });
    }

    return res.status(200).json({
      ok: true,
      cpf,
      proto: protoIn,
      nome: String(cliente.nome || "").trim(),
    });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      msg: "Erro ao validar. Tente novamente.",
      error: String(e && e.message ? e.message : e),
    });
  }
};
