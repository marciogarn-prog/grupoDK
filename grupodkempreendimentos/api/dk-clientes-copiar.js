/**
 * Copia os clientes para public.dk_clientes e valida.
 * Não liga a fonte nova e não altera /api/cadastro-clientes.
 */
const { applyApiCors, requireLiveSession, TITULAR_CEO_CPF } = require("../lib/dk-portal-auth.cjs");
const { onlyDigits } = require("../lib/dk-deploy-channel-api.cjs");
const { executarCopia } = require("../lib/dk-clientes-copiar.cjs");

module.exports = async function handler(req, res) {
  applyApiCors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ ok: false, reason: "method" });
  const gate = await requireLiveSession(req, { allowCliente: false, allowEquipa: true, allowService: false });
  if (!gate.ok) return res.status(gate.status).json({ ok: false, reason: gate.reason });
  if (onlyDigits(gate.cpf).slice(0, 11) !== TITULAR_CEO_CPF) {
    return res.status(403).json({ ok: false, reason: "somente_titular" });
  }
  const relatorio = await executarCopia();
  const status = relatorio.aprovada ? 200 : relatorio.motivo === "r0_diferente_de_r1" || relatorio.copiaAindaNaoAprovada ? 409 : 503;
  return res.status(status).json(relatorio);
};
