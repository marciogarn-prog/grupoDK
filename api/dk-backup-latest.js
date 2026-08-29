/**
 * Último backup enviado por e-mail (metadados + importação).
 *
 * GET /api/dk-backup-latest?channel=default
 *   — metadados (data, contagens) sem autenticação
 *
 * GET /api/dk-backup-latest?full=1
 *   Header: x-dk-backup-secret — devolve JSON completo para «Importar último»
 */
const { normalizeChannel, fetchLastBackupMeta, fetchLastBackupPayload } = require("../lib/dk-store-last-backup.cjs");

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
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-dk-backup-secret, X-DK-Deploy-Channel");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  }
}

function resolveChannel() {
  return "default";
}

function authorizeFull(req) {
  const expected = process.env.DK_BACKUP_SEND_SECRET || process.env.CRON_SECRET || "";
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

  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, reason: "method" });
  }

  const channel = normalizeChannel(resolveChannel());
  const wantFull =
    String(req.query?.full || "").trim() === "1" ||
    String(req.query?.full || "").trim().toLowerCase() === "true";

  if (wantFull) {
    const auth = authorizeFull(req);
    if (!auth.ok) {
      return res.status(401).json({ ok: false, reason: auth.reason });
    }
    const full = await fetchLastBackupPayload(channel);
    if (!full.ok || !full.payload) {
      return res.status(404).json({ ok: false, reason: full.reason || "not_found", channel });
    }
    return res.status(200).json({
      ok: true,
      channel,
      meta: full.meta,
      payload: full.payload,
    });
  }

  const meta = await fetchLastBackupMeta(channel);
  if (!meta.ok || !meta.meta) {
    return res.status(200).json({
      ok: true,
      channel,
      hasBackup: false,
      meta: null,
      reason: meta.reason || "not_found",
    });
  }

  return res.status(200).json({
    ok: true,
    channel,
    hasBackup: true,
    meta: meta.meta,
  });
};
