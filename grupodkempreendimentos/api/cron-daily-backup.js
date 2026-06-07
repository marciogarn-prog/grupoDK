/**
 * Backup diário por e-mail (cron Vercel — 02:00 America/Sao_Paulo).
 *
 * Variáveis na Vercel:
 *   CRON_SECRET — obrigatório (Vercel envia Authorization: Bearer … no cron)
 *   DK_BACKUP_EMAIL_TO — destino (padrão: marciogarn@gmail.com)
 *
 * E-mail (escolha um):
 *   Resend: RESEND_API_KEY, RESEND_FROM (ex.: DK Backup <backup@seudominio.com>)
 *   Gmail SMTP: SMTP_USER, SMTP_PASS (senha de app), opcional SMTP_HOST/SMTP_PORT
 *
 * Dados:
 *   SUPABASE_URL, SUPABASE_ANON_KEY (ou SERVICE_ROLE)
 *   UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN
 */
const { collectDkBackupPayload, backupFileBaseName } = require("../lib/dk-collect-backup.cjs");
const { sendBackupEmail } = require("../lib/dk-send-backup-email.cjs");

function authorizeCron(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return { ok: false, reason: "cron_secret_missing" };
  const auth = String(req.headers.authorization || "");
  if (auth === `Bearer ${secret}`) return { ok: true };
  return { ok: false, reason: "unauthorized" };
}

module.exports = async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("X-Content-Type-Options", "nosniff");

  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ ok: false, reason: "method" });
  }

  const auth = authorizeCron(req);
  if (!auth.ok) {
    return res.status(401).json({ ok: false, reason: auth.reason });
  }

  try {
    const payload = await collectDkBackupPayload();
    const baseName = backupFileBaseName(payload);
    const email = await sendBackupEmail(payload, baseName);

    if (!email.ok) {
      return res.status(503).json({
        ok: false,
        reason: email.reason,
        attempts: email.attempts,
        backup: {
          exportedAtBr: payload.exportedAtBr,
          counts: payload.counts,
          sources: payload.sources,
        },
      });
    }

    return res.status(200).json({
      ok: true,
      provider: email.provider,
      to: email.to,
      exportedAtBr: payload.exportedAtBr,
      counts: payload.counts,
      sources: payload.sources,
    });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: String(e && e.message ? e.message : e),
    });
  }
};
