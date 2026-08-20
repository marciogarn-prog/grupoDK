/**
 * GET /api/miel-xls-config
 * Devolve o link Excel Online configurado em MIEL_XLS_EDIT_URL (Vercel).
 * Demo e oficial podem ter URLs diferentes (variável por ambiente).
 */
function isOriginAllowed(origin) {
  if (!origin) return false;
  const allowed = new Set([
    "https://grupodkempreendimentos.com.br",
    "https://www.grupodkempreendimentos.com.br",
    "https://demo.grupodkempreendimentos.com.br",
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
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  }
}

module.exports = async function handler(req, res) {
  const origin = req.headers.origin || "";
  applyCors(res, origin);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ ok: false, error: "method_not_allowed" });

  const editUrl = String(process.env.MIEL_XLS_EDIT_URL || "").trim();
  res.setHeader("Cache-Control", "no-store");
  return res.status(200).json({
    ok: true,
    configured: Boolean(editUrl),
    editUrl,
    fileName: "miel-sistema.xlsm",
  });
};
