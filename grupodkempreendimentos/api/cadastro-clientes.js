/**
 * Sincronização do cadastro de clientes (API no root do projeto para Vercel).
 * Variáveis obrigatórias: UPSTASH_REDIS_REST_URL e UPSTASH_REDIS_REST_TOKEN
 */
const { isRedisKvConfigured, createRedisClient } = require("../lib/dk-redis-env.cjs");
const { mergeClientesCadastro } = require("../lib/dk-append-only-merge.cjs");
const {
  onlyDigits,
  resolveDeployChannel,
  fetchPortalCadastrosFromRedis,
  matchClienteProtocoloGate,
  dropClientesCpfExcluidos,
} = require("../lib/dk-deploy-channel-api.cjs");
const { applyApiCors, enforceRateLimit, requireLiveSession, requireModuleAccess } = require("../lib/dk-portal-auth.cjs");
const { executarGravacaoCentral, ioSnapshotOficial } = require("../lib/dk-persistencia-central.cjs");

const STORAGE_KEY = "dk:portal:clientes_cadastro:v1";

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

  if (await enforceRateLimit(req, res, "cadastro-clientes", 30)) return;
  const gate = await requireLiveSession(req, { allowCliente: false, allowEquipa: true });
  if (!gate.ok) {
    return res.status(gate.status).json({ ok: false, reason: gate.reason });
  }

  if (!isRedisKvConfigured()) {
    return res.status(503).json({ ok: false, reason: "kv_not_configured" });
  }

  const redis = createRedisClient();
  const channel = resolveDeployChannel(req);

  try {
    if (req.method === "GET") {
      const gate = req.query?.gate === "1" || req.query?.gate === "true";
      if (gate) {
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
      }

      const { clientes } = await fetchPortalCadastrosFromRedis(redis, channel);
      if (clientes.length) {
        return res.status(200).json({ ok: true, data: clientes, channel });
      }
      const raw = await redis.get(STORAGE_KEY);
      const data = parseRedisArray(raw);
      return res.status(200).json({ ok: true, data, channel });
    }

    if (req.method === "POST") {
      const writeGate = await requireModuleAccess(req, "cliente");
      if (!writeGate.ok) {
        return res.status(writeGate.status).json({ ok: false, reason: writeGate.reason, modulo: writeGate.modulo });
      }
      let body = req.body;
      if (typeof body === "string") {
        try {
          body = JSON.parse(body);
        } catch {
          body = {};
        }
      }
      const incoming = Array.isArray(body?.data) ? body.data : [];
      let merged = incoming;
      const central = await executarGravacaoCentral({
        ...ioSnapshotOficial(channel === "demo" ? "demo" : "default"),
        baseRevision: body.base_revision || body.revision || "",
        mutar(payload) {
          const base = Array.isArray(payload.dk_clientes_cadastro) ? payload.dk_clientes_cadastro : [];
          merged = dropClientesCpfExcluidos(mergeClientesCadastro(base, incoming));
          payload.dk_clientes_cadastro = merged;
          payload.dk_portal_clientes_cadastro = merged;
        },
        cache: async () => {
          await redis.set(STORAGE_KEY, JSON.stringify(merged));
        },
      });
      if (central.status !== 200) return res.status(central.status).json(central.body);
      return res.status(200).json({ ...central.body, count: merged.length });
    }
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e && e.message ? e.message : e) });
  }

  return res.status(405).json({ ok: false, reason: "method" });
};
