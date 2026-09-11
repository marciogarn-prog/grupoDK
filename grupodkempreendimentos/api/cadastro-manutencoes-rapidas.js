/**
 * OS da manutenção rápida — canal próprio (não depende do snapshot gordo).
 * GET une Redis dedicado + array do snapshot. POST faz união append-only.
 */
const { isRedisKvConfigured, createRedisClient } = require("../lib/dk-redis-env.cjs");
const { mergeManutencoesRapidas } = require("../lib/dk-append-only-merge.cjs");
const { applyApiCors, enforceRateLimit, requirePortalAuth, requireModuleAccess } = require("../lib/dk-portal-auth.cjs");

const STORAGE_KEY = "dk:portal:manutencoes_rapidas:v1";
const REDIS_SNAPSHOT_KEY = "dk:portal:cloud_snapshot:v1";

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

function parseSnapshotManutencoes(raw) {
  if (raw == null) return [];
  let row = raw;
  if (typeof raw === "string") {
    try {
      row = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  const payload = row?.payload && typeof row.payload === "object" ? row.payload : row;
  return Array.isArray(payload?.dk_manutencoes_rapidas_v1) ? payload.dk_manutencoes_rapidas_v1 : [];
}

async function loadUniao(redis) {
  const [rawSnap, rawDed] = await Promise.all([redis.get(REDIS_SNAPSHOT_KEY), redis.get(STORAGE_KEY)]);
  return mergeManutencoesRapidas(parseSnapshotManutencoes(rawSnap), parseRedisArray(rawDed));
}

module.exports = async function handler(req, res) {
  applyApiCors(res);

  if (req.method === "OPTIONS") return res.status(204).end();
  if (await enforceRateLimit(req, res, "cadastro-manutencoes-rapidas", 40)) return;

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
      const data = await loadUniao(redis);
      return res.status(200).json({ ok: true, data });
    }

    if (req.method === "POST") {
      let writeGate = await requireModuleAccess(req, "manutencao");
      if (!writeGate.ok) writeGate = await requireModuleAccess(req, "lancamentoManutencao");
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
      const existing = await loadUniao(redis);
      const merged = mergeManutencoesRapidas(existing, incoming);
      await redis.set(STORAGE_KEY, JSON.stringify(merged));
      return res.status(200).json({ ok: true, count: merged.length, data: merged });
    }
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e && e.message ? e.message : e) });
  }

  return res.status(405).json({ ok: false, reason: "method" });
};
