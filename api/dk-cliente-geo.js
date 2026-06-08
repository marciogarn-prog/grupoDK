/**
 * Posições GPS dos clientes (app DK Cliente).
 * POST /api/dk-cliente-geo — body { cpf, lat, lng, ... }
 * GET  /api/dk-cliente-geo — lista últimas posições (admin mapa)
 *
 * Web Push (mensagens DK): GET/POST /api/dk-cliente-geo?push=1
 */
const { isRedisKvConfigured, createRedisClient } = require("../lib/dk-redis-env.cjs");
const { handleClientePush } = require("../lib/dk-cliente-push-handler.cjs");

const REDIS_KEY = "dk:portal:cliente_geo_v1";
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_CLIENTES = 800;

function onlyDigits(s) {
  return String(s ?? "").replace(/\D/g, "");
}

function normPlaca(s) {
  return String(s ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
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
  const kept = entries.filter(([, v]) => {
    const ts = Number(v?.ts || v?.updatedAt || 0);
    return ts > now - MAX_AGE_MS;
  });
  kept.sort((a, b) => Number(b[1]?.ts || 0) - Number(a[1]?.ts || 0));
  const byCpf = {};
  kept.slice(0, MAX_CLIENTES).forEach(([k, v]) => {
    byCpf[k] = v;
  });
  return { byCpf, updatedAt: now };
}

function applyCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-DK-Deploy-Channel");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
}

module.exports = async function handler(req, res) {
  if (String(req.query?.push || "") === "1") {
    return handleClientePush(req, res);
  }

  applyCors(res);

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (!isRedisKvConfigured()) {
    return res.status(503).json({
      ok: false,
      msg: "Serviço de localização temporariamente indisponível.",
      reason: "kv_not_configured",
    });
  }

  try {
    const redis = createRedisClient();

    if (req.method === "GET") {
      const raw = await redis.get(REDIS_KEY);
      const store = pruneStore(parseStore(raw));
      const clientes = Object.values(store.byCpf || {}).sort(
        (a, b) => Number(b.ts || 0) - Number(a.ts || 0)
      );
      return res.status(200).json({
        ok: true,
        updatedAt: store.updatedAt || Date.now(),
        total: clientes.length,
        clientes,
      });
    }

    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, msg: "Método não permitido." });
    }

    const body = parseBody(req);
    if (body.adminPreview === true || String(body.source || "").trim() !== "cliente_app") {
      return res.status(403).json({
        ok: false,
        msg: "Localização só pode ser enviada pelo app do cliente (acesso real, não pré-visualização admin).",
      });
    }
    const cpf = onlyDigits(body.cpf).slice(0, 11);
    const lat = Number(body.lat);
    const lng = Number(body.lng);
    if (cpf.length !== 11) {
      return res.status(400).json({ ok: false, msg: "CPF inválido." });
    }
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.status(400).json({ ok: false, msg: "Coordenadas inválidas." });
    }
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return res.status(400).json({ ok: false, msg: "Coordenadas fora do intervalo." });
    }

    const ts = Number(body.ts) || Date.now();
    const raw = await redis.get(REDIS_KEY);
    const store = parseStore(raw);
    store.byCpf[cpf] = {
      cpf,
      nome: String(body.nome || store.byCpf[cpf]?.nome || "").trim(),
      placa: normPlaca(body.placa || store.byCpf[cpf]?.placa || ""),
      protocolo: String(body.protocolo || store.byCpf[cpf]?.protocolo || "").trim(),
      lat,
      lng,
      accuracy: Number.isFinite(Number(body.accuracy)) ? Number(body.accuracy) : null,
      heading: Number.isFinite(Number(body.heading)) ? Number(body.heading) : null,
      speed: Number.isFinite(Number(body.speed)) ? Number(body.speed) : null,
      ts,
      updatedAt: ts,
    };
    const pruned = pruneStore(store);
    await redis.set(REDIS_KEY, JSON.stringify(pruned));

    return res.status(200).json({ ok: true, cpf, ts });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      msg: "Erro ao processar localização.",
      error: String(e && e.message ? e.message : e),
    });
  }
};
