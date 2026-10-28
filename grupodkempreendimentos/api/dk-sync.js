/**
 * Catch-up do Log DK. Somente leitura.
 * after ausente vale 0. limit ausente vale 100. Acima de 500 é recusado.
 * Ordem: seq crescente.
 */
const { applyApiCors, requireLiveSession, assertEquipaClientProtocol } = require("../lib/dk-portal-auth.cjs");
const { ehAdministradorSync, interpretarAfter, interpretarLimit, lerCatchUp } = require("../lib/dk-sync-leitura.cjs");

function vazio(reason) {
  return {
    ok: false,
    reason: reason || "unauthorized",
    fallback: false,
    server_event_seq: 0,
    events: [],
    has_more: false,
    next_after: 0,
  };
}

module.exports = async function handler(req, res) {
  applyApiCors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json(vazio("method"));
  }
  const gate = await requireLiveSession(req, { allowCliente: false, allowEquipa: true, allowService: false });
  if (!gate.ok) {
    return res.status(gate.status || 401).json(vazio(gate.reason || "unauthorized"));
  }
  const proto = assertEquipaClientProtocol(gate, req);
  if (!proto.ok) {
    return res.status(proto.status || 403).json(vazio(proto.reason || "forbidden"));
  }
  const q = req.query || {};
  const after = interpretarAfter(q.after);
  if (!after.ok) return res.status(after.status).json(vazio(after.reason));
  const limit = interpretarLimit(q.limit);
  if (!limit.ok) return res.status(limit.status).json(vazio(limit.reason));
  const lido = await lerCatchUp({ after: after.after, limit: limit.limit, admin: ehAdministradorSync(gate) });
  if (!lido.ok) return res.status(lido.status || 503).json(vazio(lido.reason || "sync_leitura"));
  return res.status(200).json(lido);
};
