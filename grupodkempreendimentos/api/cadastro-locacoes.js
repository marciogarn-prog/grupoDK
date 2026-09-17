/**
 * Compatibilidade de leitura do cadastro de locações.
 * Fonte canônica única: payload.dk_locacoes_cadastro em dk-cloud-snapshot/default.
 * Escritas nesta rota são recusadas: toda gravação passa por dk-cloud-snapshot,
 * onde há lock e validação de uma placa por protocolo ativo.
 */
const { isRedisKvConfigured, createRedisClient } = require("../lib/dk-redis-env.cjs");
const { dropLocacoesCpfExcluidos } = require("../lib/dk-deploy-channel-api.cjs");
const { applyApiCors, enforceRateLimit, requireLiveSession, requireModuleAccess } = require("../lib/dk-portal-auth.cjs");
const { CANONICAL_SNAPSHOT_KEY } = require("../lib/dk-locacoes-integrity.cjs");

function parseCanonicalRow(raw) {
  if (!raw) return null;
  if (typeof raw === "object") return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

module.exports = async function handler(req, res) {
  applyApiCors(res);

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (await enforceRateLimit(req, res, "cadastro-locacoes", 30)) return;
  const gate = await requireLiveSession(req, { allowCliente: false, allowEquipa: true });
  if (!gate.ok) {
    return res.status(gate.status).json({ ok: false, reason: gate.reason });
  }

  if (!isRedisKvConfigured()) {
    return res.status(503).json({ ok: false, reason: "kv_not_configured" });
  }

  const redis = createRedisClient();

  try {
    if (req.method === "GET") {
      const row = parseCanonicalRow(await redis.get(CANONICAL_SNAPSHOT_KEY));
      const data = dropLocacoesCpfExcluidos(
        Array.isArray(row?.payload?.dk_locacoes_cadastro)
          ? row.payload.dk_locacoes_cadastro
          : []
      );
      return res.status(200).json({
        ok: true,
        data,
        canonical: "dk-cloud-snapshot/default",
        updated_at: row?.updated_at || null,
      });
    }

    if (req.method === "POST") {
      const writeGate = await requireModuleAccess(req, "locacao");
      if (!writeGate.ok) {
        return res.status(writeGate.status).json({ ok: false, reason: writeGate.reason, modulo: writeGate.modulo });
      }
      return res.status(409).json({
        ok: false,
        reason: "canonical_snapshot_only",
        message: "Cadastro de locações possui uma única fonte oficial. Atualize o portal e envie pelo snapshot oficial.",
      });
    }
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e && e.message ? e.message : e) });
  }

  return res.status(405).json({ ok: false, reason: "method" });
};
