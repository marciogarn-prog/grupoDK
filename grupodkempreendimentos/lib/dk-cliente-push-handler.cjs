/**
 * Handler partilhado — Web Push mensagens DK (subscribe + notify).
 */
const {
  isVapidConfigured,
  getVapidPublicKey,
  isRedisKvConfigured,
  upsertSubscription,
  removeSubscription,
  sendPushToCpf,
  resolveChannel,
} = require("./dk-web-push.cjs");
const { applyApiCors, enforceRateLimit, requirePortalAuth, onlyDigits } = require("./dk-portal-auth.cjs");

function applyCors(res) {
  applyApiCors(res);
}

function parseBody(req) {
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

function resolveChannelFromReq(req, body) {
  const hdr = String(req.headers["x-dk-deploy-channel"] || "").trim();
  const q = req.query?.channel;
  const fromBody = body?.channel;
  return resolveChannel(hdr || q || fromBody || "default");
}

async function handleClientePush(req, res) {
  applyCors(res);
  res.setHeader("Content-Type", "application/json");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (await enforceRateLimit(req, res, "cliente-push", 40)) return;

  if (req.method === "GET") {
    const action = String(req.query?.action || "vapid").trim();
    if (action !== "vapid") {
      return res.status(400).json({ ok: false, msg: "Ação GET inválida." });
    }
    const publicKey = getVapidPublicKey();
    return res.status(200).json({
      ok: Boolean(publicKey),
      publicKey,
      configured: isVapidConfigured(),
      redis: isRedisKvConfigured(),
    });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, msg: "Método não permitido." });
  }

  if (!isRedisKvConfigured()) {
    return res.status(503).json({ ok: false, msg: "Redis indisponível." });
  }

  const body = parseBody(req);
  const action = String(body.action || "").trim();
  const channel = resolveChannelFromReq(req, body);

  if (action === "notify") {
    const gate = requirePortalAuth(req, { allowCliente: false, allowEquipa: true });
    if (!gate.ok) {
      return res.status(gate.status).json({ ok: false, reason: gate.reason });
    }
    if (!isVapidConfigured()) {
      return res.status(200).json({ ok: false, reason: "vapid_not_configured", sent: 0 });
    }
    const r = await sendPushToCpf(channel, body.cpf, {
      title: String(body.title || "DK Locadora").trim(),
      body: String(body.body || "Você tem uma nova mensagem da DK").trim(),
      setor: body.setor,
    });
    return res.status(200).json(r);
  }

  if (action === "subscribe" || action === "unsubscribe") {
    const gate = requirePortalAuth(req, { allowCliente: true, allowEquipa: true });
    if (!gate.ok) {
      return res.status(gate.status).json({ ok: false, reason: gate.reason });
    }
    const bodyCpf = onlyDigits(body.cpf).slice(0, 11);
    if (gate.typ === "cliente" && gate.cpf !== bodyCpf) {
      return res.status(403).json({ ok: false, reason: "cpf_mismatch" });
    }
    if (action === "subscribe") {
      const r = await upsertSubscription(channel, body.cpf, body.subscription);
      return res.status(r.ok ? 200 : 400).json(r);
    }
    const r = await removeSubscription(channel, body.cpf, body.subscription?.endpoint || body.endpoint);
    return res.status(r.ok ? 200 : 400).json(r);
  }

  return res.status(400).json({ ok: false, msg: "Ação POST inválida." });
}

module.exports = { handleClientePush };
