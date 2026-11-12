/**
 * GET /api/dk-bc-vm-sessao — resolve VM da sessão autenticada (servidor).
 * Prefixo A–J no query/body é ignorado (anti-spoof).
 */
const { applyApiCors, requireLiveSession, assertEquipaClientProtocol } = require("../lib/dk-portal-auth.cjs");
const { resolverVmDaSessao, lerSinalVm } = require("../lib/dk-bc-vm-sessao.cjs");

module.exports = async function handler(req, res) {
  applyApiCors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
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

  const clientPrefix = String((req.query && (req.query.prefixo || req.query.vm)) || "").trim();
  const resolved = await resolverVmDaSessao(gate, { clientPrefix });
  if (!resolved.ok) {
    return res.status(resolved.status || 403).json({
      ok: false,
      reason: resolved.reason,
      acesso: resolved.acesso || "pendente",
      prefixo: null,
      forged_ignored: clientPrefix || null,
      mensagem:
        resolved.acesso === "pendente"
          ? "Acesso pendente: sem vínculo oficial colaborador↔VM."
          : "Acesso não autorizado.",
    });
  }

  let sinal = null;
  if (resolved.autorizada && resolved.prefixo) {
    sinal = await lerSinalVm(resolved.prefixo);
  }

  return res.status(200).json({
    ok: true,
    acesso: resolved.acesso,
    autorizada: resolved.autorizada,
    prefixo: resolved.prefixo,
    vm_id: resolved.vm_id,
    vm_status: resolved.vm_status,
    tem_escopo: resolved.tem_escopo,
    reason: resolved.reason,
    colaborador_ref_mascara: resolved.colaborador_ref_mascara,
    forged_ignored: clientPrefix || null,
    sinal: sinal && sinal.ok ? { last_bc_no: sinal.last_bc_no, updated_at: sinal.updated_at } : null,
    persistencia_oficial: "postgresql",
    terminal: true,
  });
};
