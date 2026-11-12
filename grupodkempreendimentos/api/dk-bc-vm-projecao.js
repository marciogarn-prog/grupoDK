/**
 * GET /api/dk-bc-vm-projecao — projeção oficial da VM da sessão.
 * Prefixo do cliente é ignorado; usa apenas resolução servidor.
 */
const { applyApiCors, requireLiveSession, assertEquipaClientProtocol } = require("../lib/dk-portal-auth.cjs");
const { resolverVmDaSessao, listarProjecao, lerSinalVm } = require("../lib/dk-bc-vm-sessao.cjs");

module.exports = async function handler(req, res) {
  applyApiCors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, reason: "method", items: [] });
  }

  const gate = await requireLiveSession(req, { allowCliente: false, allowEquipa: true, allowService: false });
  if (!gate.ok) {
    return res.status(gate.status || 401).json({ ok: false, reason: gate.reason || "unauthorized", items: [] });
  }
  const proto = assertEquipaClientProtocol(gate, req);
  if (!proto.ok) {
    return res.status(proto.status || 403).json({ ok: false, reason: proto.reason || "forbidden", items: [] });
  }

  const q = req.query || {};
  const clientPrefix = String(q.prefixo || q.vm || "").trim();
  const resolved = await resolverVmDaSessao(gate, { clientPrefix });
  if (!resolved.ok || !resolved.autorizada) {
    return res.status(403).json({
      ok: false,
      reason: resolved.reason || "sem_autorizacao_vm",
      acesso: resolved.acesso || "pendente",
      items: [],
      forged_ignored: clientPrefix || null,
    });
  }

  const after = Number(q.after_bc_no || q.after || 0) || 0;
  const limit = Math.min(Math.max(Number(q.limit) || 200, 1), 1000);
  const listed = await listarProjecao(resolved.prefixo, after, limit);
  if (!listed.ok) {
    return res.status(listed.status || 503).json({ ok: false, reason: listed.reason, items: [] });
  }

  const sinal = await lerSinalVm(resolved.prefixo);
  const maxNo = listed.items.reduce((m, it) => Math.max(m, Number(it.bc_no) || 0), after);

  return res.status(200).json({
    ok: true,
    prefixo: resolved.prefixo,
    acesso: "autorizado",
    items: listed.items,
    next_after_bc_no: maxNo,
    sinal: sinal && sinal.ok ? { last_bc_no: sinal.last_bc_no, updated_at: sinal.updated_at } : null,
    fonte: "dk_bc_vm_projecao",
    persistencia_local_oficial: false,
  });
};
