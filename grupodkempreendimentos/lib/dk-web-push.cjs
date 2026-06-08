/**
 * Web Push (VAPID) — subscrições por CPF no Redis + envio de notificações.
 * Env: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:...)
 */
const { isRedisKvConfigured, createRedisClient } = require("./dk-redis-env.cjs");

const REDIS_KEYS = {
  default: "dk:cliente:push_subs:default:v1",
  demo: "dk:cliente:push_subs:demo:v1",
};

const MAX_SUBS_PER_CPF = 8;
const MAX_CPFS = 1200;

function onlyDigits(s) {
  return String(s ?? "").replace(/\D/g, "");
}

function resolveChannel(raw) {
  const v = String(raw || "")
    .trim()
    .toLowerCase();
  return v === "demo" ? "demo" : "default";
}

function redisKey(channel) {
  return REDIS_KEYS[resolveChannel(channel)] || REDIS_KEYS.default;
}

function parseStore(raw) {
  if (raw == null) return { byCpf: {} };
  let data = raw;
  if (typeof raw === "string") {
    try {
      data = JSON.parse(raw);
    } catch {
      return { byCpf: {} };
    }
  }
  if (!data || typeof data !== "object") return { byCpf: {} };
  if (!data.byCpf || typeof data.byCpf !== "object") return { byCpf: {} };
  return data;
}

function pruneStore(store) {
  const now = Date.now();
  const entries = Object.entries(store.byCpf || {});
  entries.forEach(([, subs]) => {
    if (!Array.isArray(subs)) return;
    subs.sort((a, b) => (Number(b.updatedAt || 0) || 0) - (Number(a.updatedAt || 0) || 0));
  });
  entries.sort((a, b) => {
    const ta = Math.max(...(Array.isArray(a[1]) ? a[1] : []).map((s) => Number(s.updatedAt || 0) || 0), 0);
    const tb = Math.max(...(Array.isArray(b[1]) ? b[1] : []).map((s) => Number(s.updatedAt || 0) || 0), 0);
    return tb - ta;
  });
  const byCpf = {};
  entries.slice(0, MAX_CPFS).forEach(([cpf, subs]) => {
    const list = (Array.isArray(subs) ? subs : [])
      .filter((s) => s && s.endpoint)
      .slice(0, MAX_SUBS_PER_CPF)
      .map((s) => ({
        endpoint: String(s.endpoint),
        keys: s.keys || {},
        updatedAt: Number(s.updatedAt || now) || now,
      }));
    if (list.length) byCpf[cpf] = list;
  });
  return { byCpf, updatedAt: now };
}

function isVapidConfigured() {
  return Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

function getVapidPublicKey() {
  return String(process.env.VAPID_PUBLIC_KEY || "").trim();
}

function getWebPush() {
  if (!isVapidConfigured()) return null;
  const webpush = require("web-push");
  webpush.setVapidDetails(
    String(process.env.VAPID_SUBJECT || "mailto:contato@grupodkempreendimentos.com.br").trim(),
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
  return webpush;
}

async function loadStore(channel) {
  if (!isRedisKvConfigured()) return { byCpf: {} };
  const redis = createRedisClient();
  const raw = await redis.get(redisKey(channel));
  return pruneStore(parseStore(raw));
}

async function saveStore(channel, store) {
  if (!isRedisKvConfigured()) return false;
  const redis = createRedisClient();
  await redis.set(redisKey(channel), JSON.stringify(pruneStore(store)));
  return true;
}

async function upsertSubscription(channel, cpfDigits, subscription) {
  const cpf = onlyDigits(cpfDigits).slice(0, 11);
  if (cpf.length !== 11 || !subscription?.endpoint) {
    return { ok: false, msg: "CPF ou subscrição inválidos." };
  }
  const store = await loadStore(channel);
  const endpoint = String(subscription.endpoint);
  const keys = subscription.keys || {};
  const now = Date.now();
  const list = Array.isArray(store.byCpf[cpf]) ? store.byCpf[cpf] : [];
  const idx = list.findIndex((s) => s.endpoint === endpoint);
  const rec = { endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth }, updatedAt: now };
  if (idx >= 0) list[idx] = rec;
  else list.unshift(rec);
  store.byCpf[cpf] = list.slice(0, MAX_SUBS_PER_CPF);
  await saveStore(channel, store);
  return { ok: true, count: store.byCpf[cpf].length };
}

async function removeSubscription(channel, cpfDigits, endpoint) {
  const cpf = onlyDigits(cpfDigits).slice(0, 11);
  if (cpf.length !== 11 || !endpoint) return { ok: false, msg: "Dados inválidos." };
  const store = await loadStore(channel);
  const list = Array.isArray(store.byCpf[cpf]) ? store.byCpf[cpf] : [];
  store.byCpf[cpf] = list.filter((s) => s.endpoint !== String(endpoint));
  if (!store.byCpf[cpf].length) delete store.byCpf[cpf];
  await saveStore(channel, store);
  return { ok: true };
}

async function sendPushToCpf(channel, cpfDigits, payload) {
  const cpf = onlyDigits(cpfDigits).slice(0, 11);
  if (cpf.length !== 11) return { ok: false, msg: "CPF inválido.", sent: 0 };
  const webpush = getWebPush();
  if (!webpush) return { ok: false, reason: "vapid_not_configured", sent: 0 };
  const store = await loadStore(channel);
  const subs = Array.isArray(store.byCpf[cpf]) ? store.byCpf[cpf] : [];
  if (!subs.length) return { ok: true, sent: 0, reason: "no_subscription" };

  const body = payload?.body || "Você tem uma nova mensagem da DK";
  const title = payload?.title || "DK Locadora";
  const setor = payload?.setor === "manutencao" ? "manutencao" : "vendas";
  const msg = JSON.stringify({
    title,
    body,
    setor,
    url: `/cliente?dkChat=${setor}`,
    tag: `dk-msg-${setor}-${cpf}`,
  });

  let sent = 0;
  const stale = [];
  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: sub.keys },
        msg,
        { TTL: 60 * 60 * 24 }
      );
      sent += 1;
    } catch (e) {
      const code = Number(e?.statusCode || 0);
      if (code === 404 || code === 410) stale.push(sub.endpoint);
    }
  }
  if (stale.length) {
    store.byCpf[cpf] = subs.filter((s) => !stale.includes(s.endpoint));
    if (!store.byCpf[cpf].length) delete store.byCpf[cpf];
    await saveStore(channel, store);
  }
  return { ok: sent > 0, sent, total: subs.length };
}

module.exports = {
  isVapidConfigured,
  getVapidPublicKey,
  isRedisKvConfigured,
  upsertSubscription,
  removeSubscription,
  sendPushToCpf,
  resolveChannel,
};
