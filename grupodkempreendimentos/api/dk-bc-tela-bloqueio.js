/**
 * POST/GET /api/dk-bc-tela-bloqueio
 * actions: consultar | adquirir | renovar | liberar | validar
 * Empresa/filial/tela validadas no servidor via sessão+escopo VM.
 * Não ativa bloqueio em telas reais nesta etapa (módulo preparado).
 */
const { applyApiCors, requireLiveSession, assertEquipaClientProtocol } = require("../lib/dk-portal-auth.cjs");
const {
  resolverContextoBloqueio,
  consultar,
  adquirir,
  renovar,
  liberar,
  validar,
} = require("../lib/dk-bc-tela-bloqueio.cjs");

function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  return {};
}

module.exports = async function handler(req, res) {
  applyApiCors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ ok: false, reason: "method" });
  }

  const gate = await requireLiveSession(req, { allowCliente: false, allowEquipa: true, allowService: false });
  if (!gate.ok) {
    return res.status(gate.status || 401).json({ ok: false, reason: gate.reason || "unauthorized", acesso: "negado" });
  }
  const proto = assertEquipaClientProtocol(gate, req);
  if (!proto.ok) {
    return res.status(proto.status || 403).json({ ok: false, reason: proto.reason || "forbidden", acesso: "negado" });
  }

  const q = req.query || {};
  const body = readBody(req);
  const action = String(q.action || body.action || (req.method === "GET" ? "consultar" : "")).trim().toLowerCase();
  const io = {
    clientPrefix: String(q.prefixo || body.prefixo || "").trim(),
    empresa_id: String(q.empresa_id || body.empresa_id || "").trim(),
    filial_id: String(q.filial_id || body.filial_id || "").trim(),
    tela: String(q.tela || body.tela || q.tela_id || body.tela_id || "").trim(),
  };

  const ctx = await resolverContextoBloqueio(gate, io);
  if (!ctx.ok) {
    return res.status(ctx.status || 403).json({
      ok: false,
      reason: ctx.reason,
      acesso: ctx.acesso || "pendente",
      forged_ignored: io.clientPrefix || null,
    });
  }

  if (action === "consultar" || action === "status") {
    const r = await consultar(ctx);
    return res.status(r.status || 200).json({ ...r, persistencia_oficial: "postgresql", terminal: true });
  }

  if (action === "adquirir") {
    const r = await adquirir(ctx);
    return res.status(r.status || 200).json({ ...r, empresa_id: ctx.empresa_id, filial_id: ctx.filial_id, tela_id: ctx.tela_id });
  }

  if (action === "renovar") {
    const concessao = body.concessao_id || q.concessao_id;
    const geracao = body.geracao != null ? body.geracao : q.geracao;
    const r = await renovar(ctx, concessao, geracao);
    return res.status(r.status || 200).json(r);
  }

  if (action === "liberar") {
    const concessao = body.concessao_id || q.concessao_id;
    const geracao = body.geracao != null ? body.geracao : q.geracao;
    const r = await liberar(ctx, concessao, geracao);
    return res.status(r.status || 200).json(r);
  }

  if (action === "validar") {
    const concessao = body.concessao_id || q.concessao_id;
    const geracao = body.geracao != null ? body.geracao : q.geracao;
    const r = await validar(ctx, concessao, geracao);
    return res.status(r.status || 200).json(r);
  }

  return res.status(400).json({ ok: false, reason: "action_invalida" });
};
