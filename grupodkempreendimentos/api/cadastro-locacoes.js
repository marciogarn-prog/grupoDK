/**
 * Rota antiga de locações. Desativada.
 * A operação lê e grava somente /api/dk-locacao (public.dk_locacao).
 * Esta rota não consulta e não grava snapshot nem Redis.
 */
const { applyApiCors, enforceRateLimit, requireLiveSession } = require("../lib/dk-portal-auth.cjs");

module.exports = async function handler(req, res) {
  applyApiCors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (await enforceRateLimit(req, res, "cadastro-locacoes", 30)) return;
  const gate = await requireLiveSession(req, { allowCliente: false, allowEquipa: true });
  if (!gate.ok) return res.status(gate.status).json({ ok: false, reason: gate.reason });
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ ok: false, reason: "method" });
  }
  return res.status(410).json({
    ok: false,
    reason: "legacy_route_disabled",
    message: "A rota antiga de locações está desativada. A fonte oficial é /api/dk-locacao.",
  });
};
