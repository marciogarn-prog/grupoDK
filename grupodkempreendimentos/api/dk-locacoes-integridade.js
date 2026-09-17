/**
 * Auditoria da fonte canônica de locações.
 * Compara Redis (fonte oficial) com Supabase (espelho) e detecta placa em mais
 * de um protocolo ativo. Somente cron ou Administrador CEO.
 */
const { requireLiveSession } = require("../lib/dk-portal-auth.cjs");
const { runLocacoesIntegrityAudit } = require("../lib/dk-locacoes-integrity-audit.cjs");

function cronAuthorized(req) {
  const secret = String(process.env.CRON_SECRET || "").trim();
  return Boolean(secret && String(req.headers.authorization || "") === `Bearer ${secret}`);
}

module.exports = async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ ok: false, reason: "method" });
  }

  if (!cronAuthorized(req)) {
    const gate = await requireLiveSession(req, { allowCliente: false, allowEquipa: true });
    if (!gate.ok) return res.status(gate.status).json({ ok: false, reason: gate.reason });
    if (String(gate.role || "").trim() !== "owner") {
      return res.status(403).json({ ok: false, reason: "owner_required" });
    }
  }

  try {
    const audit = await runLocacoesIntegrityAudit();
    return res.status(200).json(audit);
  } catch (error) {
    return res.status(500).json({
      ok: false,
      reason: "audit_failed",
      error: String(error?.message || error),
    });
  }
};
