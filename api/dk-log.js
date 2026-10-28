/**
 * Esqueleto do Log DK. Só o administrador (role owner) entra.
 * Não consulta cadastros, pagamentos, snapshot nem o navegador.
 */
const { applyApiCors, requireLiveSession, assertEquipaClientProtocol } = require("../lib/dk-portal-auth.cjs");
const { decidirAcessoLog, estadoLog } = require("../lib/dk-log-acesso.cjs");

module.exports = async function handler(req, res) {
  applyApiCors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, reason: "method", fallback: false, eventos: [] });
  }
  const gate = await requireLiveSession(req, { allowCliente: false, allowEquipa: true, allowService: false });
  if (!gate.ok) {
    return res.status(gate.status || 401).json({ ok: false, reason: gate.reason || "unauthorized", fallback: false, eventos: [] });
  }
  const proto = assertEquipaClientProtocol(gate, req);
  if (!proto.ok) {
    return res.status(proto.status || 403).json({ ok: false, reason: proto.reason || "forbidden", fallback: false, eventos: [] });
  }
  const acesso = decidirAcessoLog(gate);
  if (!acesso.ok) {
    return res.status(acesso.status || 403).json({ ok: false, reason: acesso.reason, fallback: false, eventos: [] });
  }
  return res.status(200).json(estadoLog());
};
