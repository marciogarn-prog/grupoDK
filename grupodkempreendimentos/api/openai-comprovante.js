/**
 * Proxy OpenAI para conferência de comprovantes (chave só no servidor Vercel).
 * Variáveis: OPENAI_API_KEY ou DK_OPENAI_API_KEY
 * Património CRLV: ia_content_hash + ia_job_id evitam leitura duplicada (ledger Redis).
 */
const { isRedisKvConfigured, createRedisClient } = require("../lib/dk-redis-env.cjs");

const PATRIMONIO_IA_LEDGER_PREFIX = "dk_patrimonio_ia_hash:";
const PATRIMONIO_IA_DAILY_PREFIX = "dk_patrimonio_ia_daily:";
const PATRIMONIO_IA_DAILY_CAP = Math.min(
  5000,
  Math.max(1, Number(process.env.DK_PATRIMONIO_IA_DAILY_CAP || 500) || 500)
);

function patrimonioIaDayKey() {
  return PATRIMONIO_IA_DAILY_PREFIX + new Date().toISOString().slice(0, 10);
}

async function patrimonioIaReservarLeitura(hash, jobId) {
  const h = String(hash || "").trim().toLowerCase();
  if (!h || !isRedisKvConfigured()) return { ok: true };
  const redis = createRedisClient();
  const ledgerKey = PATRIMONIO_IA_LEDGER_PREFIX + h;
  const dayKey = patrimonioIaDayKey();
  const daily = Number(await redis.get(dayKey)) || 0;
  if (daily >= PATRIMONIO_IA_DAILY_CAP) {
    return { ok: false, reason: "ia_daily_cap" };
  }
  const reserved = await redis.set(
    ledgerKey,
    JSON.stringify({
      leiturasIa: 1,
      jobId: String(jobId || ""),
      em: new Date().toISOString(),
    }),
    { nx: true }
  );
  if (!reserved) {
    return { ok: false, reason: "ia_already_processed" };
  }
  await redis.incr(dayKey);
  await redis.expire(dayKey, 172800);
  return { ok: true, redis, ledgerKey };
}

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
  const isCrlv = tipo === "crlv" || tipo === "patrimonio" || tipo === "crlv_proprietario";
  const isExtrato = tipo === "extrato" || tipo === "extrato_revisao";
  const maxTokens = isCrlv
    ? Math.min(4096, Number.isFinite(pedido) && pedido > 0 ? pedido : 4096)
    : isExtrato
      ? Math.min(8192, Number.isFinite(pedido) && pedido > 0 ? pedido : 8192)
      : Math.min(4096, Number.isFinite(pedido) && pedido > 0 ? pedido : 900);
  const model = isCrlv || isExtrato ? "gpt-4o" : "gpt-4o-mini";

  const iaHash = String(body?.ia_content_hash || body?.iaContentHash || "").trim().toLowerCase();
  const iaJobId = String(body?.ia_job_id || body?.iaJobId || "").trim();

  if (isCrlv && iaHash) {
    const gate = await patrimonioIaReservarLeitura(iaHash, iaJobId);
    if (!gate.ok) {
      const status = gate.reason === "ia_daily_cap" ? 429 : 409;
      return res.status(status).json({ ok: false, reason: gate.reason });
    }
  }

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
    const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fence) raw = fence[1].trim();
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      const start = raw.indexOf("{");
      const end = raw.lastIndexOf("}");
      if (start >= 0 && end > start) {
        parsed = JSON.parse(raw.slice(start, end + 1));
      } else {
        return res.status(500).json({
          ok: false,
          reason: "json_parse_error",
          error: raw.slice(0, 200),
        });
      }
    }
    return res.status(200).json({ ok: true, parsed });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      reason: "server_error",
      error: String(e?.message || e),
    });
  }
};
