/**
 * Copia as locações do snapshot para public.dk_locacao.
 * Não liga o módulo e não abre a auditoria de integridade.
 */
const { applyApiCors, requireLiveSession, TITULAR_CEO_CPF } = require("../lib/dk-portal-auth.cjs");
const { onlyDigits } = require("../lib/dk-deploy-channel-api.cjs");
const { executarCopia } = require("../lib/dk-locacoes-copiar.cjs");

function lerBody(req) {
  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      body = {};
    }
  }
  return body && typeof body === "object" ? body : {};
}

module.exports = async function handler(req, res) {
  applyApiCors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ ok: false, reason: "method" });
  const gate = await requireLiveSession(req, { allowCliente: false, allowEquipa: true, allowService: false });
  if (!gate.ok) return res.status(gate.status).json({ ok: false, reason: gate.reason });
  if (onlyDigits(gate.cpf).slice(0, 11) !== TITULAR_CEO_CPF) {
    return res.status(403).json({ ok: false, reason: "somente_titular" });
  }
  const op = String(lerBody(req).op || "").trim();
  if (op !== "conferir" && op !== "copiar") return res.status(400).json({ ok: false, reason: "operacao" });
  const relatorio = await executarCopia(op);
  const status = relatorio.aprovada ? 200 : 409;
  return res.status(status).json(relatorio);
};
