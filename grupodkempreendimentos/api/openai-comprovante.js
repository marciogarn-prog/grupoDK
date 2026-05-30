/**
 * Proxy OpenAI para conferência de comprovantes (chave só no servidor Vercel).
 * Variáveis: OPENAI_API_KEY ou DK_OPENAI_API_KEY
 */
module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, reason: "method" });
  }

  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      body = {};
    }
  }

  if (body && body.ping) {
    const key = String(process.env.OPENAI_API_KEY || process.env.DK_OPENAI_API_KEY || "").trim();
    return res.status(200).json({
      ok: true,
      mode: key ? "server" : "not_configured",
    });
  }

  const origin = String(req.headers.origin || "");
  const referer = String(req.headers.referer || "");
  const hostOk =
    /grupodkempreendimentos\.com\.br/i.test(origin) ||
    /grupodkempreendimentos\.com\.br/i.test(referer) ||
    /localhost/i.test(origin) ||
    /localhost/i.test(referer) ||
    /127\.0\.0\.1/i.test(origin);
  if (!hostOk) {
    return res.status(403).json({ ok: false, reason: "forbidden_origin" });
  }

  const apiKey = String(process.env.OPENAI_API_KEY || process.env.DK_OPENAI_API_KEY || "").trim();
  if (!apiKey) {
    return res.status(503).json({ ok: false, reason: "openai_not_configured" });
  }

  const content = body?.content;
  if (!Array.isArray(content) || !content.length) {
    return res.status(400).json({ ok: false, reason: "invalid_content" });
  }

  const tipo = String(body?.tipo || "").toLowerCase();
  const modo = String(body?.modo || "").toLowerCase();
  const pedido = Number(body?.max_tokens);
  const revisao = modo === "revisao" || tipo === "extrato_revisao";
  const maxTokens =
    tipo === "extrato" || tipo === "extrato_revisao"
      ? Math.min(8192, Number.isFinite(pedido) && pedido > 0 ? pedido : revisao ? 8192 : 4096)
      : Math.min(4096, Number.isFinite(pedido) && pedido > 0 ? pedido : 900);
  const model = revisao ? "gpt-4o" : "gpt-4o-mini";

  try {
    const oai = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content }],
        response_format: { type: "json_object" },
        max_tokens: maxTokens,
      }),
    });

    if (!oai.ok) {
      const t = await oai.text();
      return res.status(oai.status).json({
        ok: false,
        reason: "openai_error",
        error: t.slice(0, 300),
      });
    }

    const data = await oai.json();
    let raw = String(data.choices?.[0]?.message?.content || "").trim();
    const fence = raw.match(/^```(?:json)?\s*([\s\S]*?)```$/im);
    if (fence) raw = fence[1].trim();
    const parsed = JSON.parse(raw);
    return res.status(200).json({ ok: true, parsed });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      reason: "server_error",
      error: String(e?.message || e),
    });
  }
};
