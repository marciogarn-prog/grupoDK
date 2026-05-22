/**
 * Sincronização do cadastro de clientes (API no root do projeto para Vercel).
 * Variáveis obrigatórias: UPSTASH_REDIS_REST_URL e UPSTASH_REDIS_REST_TOKEN
 */
const { isRedisKvConfigured, createRedisClient } = require("../lib/dk-redis-env.cjs");
const { mergeClientesCadastro } = require("./dk-append-only-merge");

const STORAGE_KEY = "dk:portal:clientes_cadastro:v1";
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

  if (!isRedisKvConfigured()) {
    return res.status(503).json({ ok: false, reason: "kv_not_configured" });
  }

  const redis = createRedisClient();

  try {
    if (req.method === "GET") {
      const gate = req.query?.gate === "1" || req.query?.gate === "true";
      if (gate) {
        const cpf = onlyDigits(req.query?.cpf || "").slice(0, 11);
        const protoIn = normProto(req.query?.protocolo || req.query?.proto || "");
        if (cpf.length !== 11) {
          return res.status(400).json({ ok: false, msg: "Informe um CPF válido (11 dígitos)." });
        }
        if (!protoIn) {
          return res.status(400).json({ ok: false, msg: "Informe o protocolo da locação." });
        }
        const [rawClientes, rawLocs] = await Promise.all([
          redis.get(STORAGE_KEY),
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
      }

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
      const merged = mergeClientesCadastro(existing, incoming);
      await redis.set(STORAGE_KEY, JSON.stringify(merged));
      return res.status(200).json({ ok: true, count: merged.length });
    }
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e && e.message ? e.message : e) });
  }

  return res.status(405).json({ ok: false, reason: "method" });
};
