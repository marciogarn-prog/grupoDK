/**
 * Cadastro de veículos.
 * Com a flag dk:portal:veiculos_fonte:v1 = dk_veiculos, a lista vive em public.dk_veiculos.
 * Sem essa flag, o comportamento anterior (snapshot + Redis) permanece.
 */
const { isRedisKvConfigured, createRedisClient } = require("../lib/dk-redis-env.cjs");
const { mergeVeiculosCadastro } = require("../lib/dk-append-only-merge.cjs");
const { applyApiCors, enforceRateLimit, requireLiveSession, requireModuleAccess } = require("../lib/dk-portal-auth.cjs");
const { executarGravacaoCentral, ioSnapshotOficial } = require("../lib/dk-persistencia-central.cjs");
const veiculosPg = require("../lib/dk-veiculos-pg.cjs");

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
  if (await enforceRateLimit(req, res, "cadastro-veiculos", 30)) return;
  const gate = await requireLiveSession(req, { allowCliente: false, allowEquipa: true });
  if (!gate.ok) return res.status(gate.status).json({ ok: false, reason: gate.reason });
  if (!isRedisKvConfigured()) return res.status(503).json({ ok: false, reason: "kv_not_configured" });

  const redis = createRedisClient();

  try {
    const modo = await veiculosPg.modoOperacional(redis);
    if (modo.modo === "erro") {
      return res.status(503).json({ ok: false, reason: modo.reason || "leitura", source: veiculosPg.FONTE });
    }

    if (req.method === "GET") {
      if (modo.modo === "pg") {
        const t0 = Date.now();
        const lido = await veiculosPg.listar();
        if (!lido.ok) return res.status(502).json({ ok: false, reason: "leitura", source: veiculosPg.FONTE });
        return res.status(200).json({
          ok: true,
          data: lido.veiculos,
          source: veiculosPg.FONTE,
          duracao_ms: Date.now() - t0,
        });
      }
      const raw = await redis.get(STORAGE_KEY);
      const data = parseRedisArray(raw);
      return res.status(200).json({ ok: true, data });
    }

    if (req.method === "POST") {
      const writeGate = await requireModuleAccess(req, "veiculo");
      if (!writeGate.ok) {
        return res.status(writeGate.status).json({ ok: false, reason: writeGate.reason, modulo: writeGate.modulo });
      }
      const body = lerBody(req);
      if (modo.modo === "pg") {
        const veiculo = veiculosPg.pedidoUm(body);
        if (!veiculo) return res.status(400).json({ ok: false, success: false, reason: "um_veiculo", source: veiculosPg.FONTE });
        const um = await veiculosPg.upsertUm(veiculo, body.base_revision || body.revision || "");
        return res.status(um.status).json(um.body);
      }
      const incoming = Array.isArray(body?.data) ? body.data : [];
      let merged = incoming;
      const central = await executarGravacaoCentral({
        ...ioSnapshotOficial("default"),
        baseRevision: body.base_revision || body.revision || "",
        mutar(payload) {
          const base = Array.isArray(payload.dk_veiculos_cadastro) ? payload.dk_veiculos_cadastro : [];
          merged = mergeVeiculosCadastro(base, incoming);
          payload.dk_veiculos_cadastro = merged;
          payload.dk_portal_veiculos_cadastro = merged;
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
