/**
 * Backup diário por e-mail (cron Vercel — 02:00 America/Sao_Paulo).
 * Envia backup do canal oficial (default) e do demo.
 */
const { collectDkBackupPayload, backupFileBaseName } = require("../lib/dk-collect-backup.cjs");
const { sendBackupEmail } = require("../lib/dk-send-backup-email.cjs");
const { storeLastBackup } = require("../lib/dk-store-last-backup.cjs");

const BACKUP_CHANNELS = ["default", "demo"];

function authorizeCron(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return { ok: false, reason: "cron_secret_missing" };
  const auth = String(req.headers.authorization || "");
  if (auth === `Bearer ${secret}`) return { ok: true };
  return { ok: false, reason: "unauthorized" };
}

function channelLabel(channel) {
  return channel === "demo" ? "DEMO" : "oficial";
}

async function runChannelBackup(channel) {
  const payload = await collectDkBackupPayload({ channel });
  const suffix = channel === "demo" ? "demo" : undefined;
  const baseName = backupFileBaseName(payload, suffix);
  const label = channelLabel(channel);
  const email = await sendBackupEmail(payload, baseName, {
    subject: `DK Backup diário ${label} — ${baseName}`,
    footerNote: `Gerado por cron Vercel (02:00 Brasília) — ambiente ${label}.`,
  });

  if (!email.ok) {
    return {
      ok: false,
      channel,
      reason: email.reason,
      attempts: email.attempts,
      backup: {
        exportedAtBr: payload.exportedAtBr,
        counts: payload.counts,
        sources: payload.sources,
      },
    };
  }

  const stored = await storeLastBackup(channel, payload, {
    emailTo: email.to,
    filename: `${baseName}.json`,
  });

  return {
    ok: true,
    channel,
    provider: email.provider,
    to: email.to,
    exportedAtBr: payload.exportedAtBr,
    counts: payload.counts,
    sources: payload.sources,
    stored: stored.ok,
    storedReason: stored.ok ? null : stored.reason,
  };
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
    const results = [];
    for (const channel of BACKUP_CHANNELS) {
      results.push(await runChannelBackup(channel));
    }

    const allOk = results.every((r) => r.ok);
    const status = allOk ? 200 : results.some((r) => r.ok) ? 207 : 503;

    return res.status(status).json({
      ok: allOk,
      results,
    });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: String(e && e.message ? e.message : e),
    });
  }
};
