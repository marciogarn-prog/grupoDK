/**
 * Backup manual por e-mail (botão no portal, ao lado da nuvem).
 *
 * POST /api/dk-backup-email
 * Header: x-dk-backup-secret = DK_BACKUP_SEND_SECRET (injeta no build; pode ser igual ao CRON_SECRET)
 * Body opcional: { "browserData": { "dk_clientes_cadastro": …, … } }
 *   — se omitido, coleta Supabase + Redis no servidor (igual ao cron).
 *
 * Destino: DK_BACKUP_EMAIL_TO (padrão marciogarn@gmail.com)
 * E-mail: RESEND_* ou SMTP_* (ver lib/dk-send-backup-email.cjs)
 */
const {
  collectDkBackupPayload,
  buildBrowserBackupPayload,
  backupFileBaseName,
} = require("../lib/dk-collect-backup.cjs");
const { sendBackupEmail } = require("../lib/dk-send-backup-email.cjs");

function isOriginAllowed(origin) {
  if (!origin) return false;
  const allowed = new Set([
    "https://grupodkempreendimentos.com.br",
    "https://www.grupodkempreendimentos.com.br",
    "http://localhost:5173",
    "http://127.0.0.1:5500",
    "http://localhost:5500",
    "http://127.0.0.1:8080",
    "http://localhost:8080",
  ]);
  if (allowed.has(origin)) return true;
  try {
    const u = new URL(origin);
    return u.hostname.endsWith(".vercel.app");
  } catch {
    return false;
  }
}

function applyCors(res, origin) {
  if (isOriginAllowed(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-dk-backup-secret");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  }
}

function authorizeBackup(req) {
  const expected =
    process.env.DK_BACKUP_SEND_SECRET || process.env.CRON_SECRET || "";
  if (!expected) return { ok: false, reason: "backup_secret_missing" };
  const secret = String(req.headers["x-dk-backup-secret"] || "");
  if (secret === expected) return { ok: true };
  return { ok: false, reason: "unauthorized" };
}

module.exports = async function handler(req, res) {
  const origin = String(req.headers.origin || "");
  applyCors(res, origin);
  res.setHeader("Content-Type", "application/json");
  res.setHeader("X-Content-Type-Options", "nosniff");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, reason: "method" });
  }

  if (!isOriginAllowed(origin)) {
    return res.status(403).json({ ok: false, reason: "origin_not_allowed" });
  }

  const auth = authorizeBackup(req);
  if (!auth.ok) {
    return res.status(401).json({ ok: false, reason: auth.reason });
  }

  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      body = {};
    }
  }

  try {
    const browserData = body?.browserData;
    const fromBrowser =
      browserData && typeof browserData === "object" && Object.keys(browserData).length > 0;
    const payload = fromBrowser
      ? buildBrowserBackupPayload(browserData)
      : await collectDkBackupPayload();
    const baseName = backupFileBaseName(payload, fromBrowser ? "manual-browser" : "manual-server");
    const email = await sendBackupEmail(payload, baseName, {
      subject: `DK Backup manual — ${baseName}`,
    });

    if (!email.ok) {
      return res.status(503).json({
        ok: false,
        reason: email.reason,
        attempts: email.attempts,
        source: payload.source,
        counts: payload.counts,
      });
    }

    return res.status(200).json({
      ok: true,
      provider: email.provider,
      to: email.to,
      source: payload.source,
      exportedAtBr: payload.exportedAtBr,
      counts: payload.counts,
    });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: String(e && e.message ? e.message : e),
    });
  }
};
