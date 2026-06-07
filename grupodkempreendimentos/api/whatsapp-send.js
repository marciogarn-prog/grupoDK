/**
 * Envio de texto via WhatsApp Cloud API (linha comercial DK).
 * Variáveis na Vercel:
 *   WHATSAPP_ACCESS_TOKEN — token permanente da app Meta
 *   WHATSAPP_PHONE_NUMBER_ID — ID do número (Meta Business Suite), não o E.164
 *   DK_WHATSAPP_SEND_SECRET — mesmo valor injetado em meta dk-whatsapp-send-secret no build
 * Opcional: WHATSAPP_API_VERSION (ex.: v21.0)
 *
 * Nota: fora da janela de 24h ou sem conversa prévia, a Meta pode exigir modelo aprovado;
 * o portal devolve o erro da API para diagnóstico.
 */
const GRAPH_VERSION = process.env.WHATSAPP_API_VERSION || "v21.0";
const SUFFIX = " NÃO RESPONDER";

function onlyDigits(s) {
  return String(s ?? "").replace(/\D/g, "");
}

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
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-dk-whatsapp-secret");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  }
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

  const secret = String(req.headers["x-dk-whatsapp-secret"] || "");
  if (!process.env.DK_WHATSAPP_SEND_SECRET || secret !== process.env.DK_WHATSAPP_SEND_SECRET) {
    return res.status(401).json({ ok: false, reason: "unauthorized" });
  }

  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneId) {
    return res.status(503).json({ ok: false, reason: "whatsapp_not_configured" });
  }

  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      body = {};
    }
  }

  const to = onlyDigits(body?.to);
  let text = String(body?.text ?? "").trim();
  if (!to || to.length < 10 || to.length > 15) {
    return res.status(400).json({ ok: false, reason: "invalid_to" });
  }
  if (!text) {
    return res.status(400).json({ ok: false, reason: "empty_text" });
  }
  if (!/\bNÃO RESPONDER\s*$/i.test(text)) {
    text += SUFFIX;
  }
  if (text.length > 4096) {
    return res.status(400).json({ ok: false, reason: "text_too_long" });
  }

  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${phoneId}/messages`;

  try {
    const r = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "text",
        text: { preview_url: false, body: text },
      }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      return res.status(502).json({ ok: false, reason: "graph_error", status: r.status, graph: j });
    }
    return res.status(200).json({ ok: true, messages: j.messages });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e && e.message ? e.message : e) });
  }
};
