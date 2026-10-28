/**
 * Lista leve de locações para pesquisa. Não substitui o GET atual.
 * Não devolve pagamentos nem o jsonb completo.
 */
const {
  applyApiCors,
  enforceRateLimit,
  requirePortalAuth,
  assertEquipaClientProtocol,
  onlyDigits,
} = require("../lib/dk-portal-auth.cjs");
const pg = require("../lib/dk-locacao-pg.cjs");

function autor(gate) {
  const cpf = onlyDigits(gate && gate.cpf).slice(0, 11);
  return cpf || String((gate && gate.role) || "equipa");
}

module.exports = async function handler(req, res) {
  applyApiCors(res);
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, reason: "method", fallback: false });
  }
  const gate = requirePortalAuth(req, { allowCliente: true, allowEquipa: true });
  if (!gate.ok) return res.status(gate.status || 401).json({ ok: false, reason: gate.reason || "unauthorized", fallback: false });
  const protoGate = assertEquipaClientProtocol(gate, req);
  if (!protoGate.ok) return res.status(protoGate.status || 403).json({ ok: false, reason: protoGate.reason || "forbidden", fallback: false });
  if (await enforceRateLimit(req, res, "locacao-lista-leve", 120, { identity: autor(gate) })) return;

  const cpfCliente = gate.typ === "cliente" ? onlyDigits(gate.cpf).slice(0, 11) : "";
  try {
    const lista = await pg.listarResumo(cpfCliente);
    if (lista.schema === false) return res.status(200).json({ ok: false, schema: false, reason: "schema_ausente", fallback: false });
    return res.status(lista.ok ? 200 : 502).json(lista);
  } catch (err) {
    console.error("[dk-locacao-lista-leve]", err && err.message ? err.message : "erro");
    return res.status(500).json({ ok: false, reason: "erro_interno", fallback: false });
  }
};
