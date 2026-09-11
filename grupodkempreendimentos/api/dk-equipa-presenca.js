/**
 * Presença da equipa logada (PCs). Não grava cadastro de clientes.
 * POST { vivo: true|false } — pulso ou saída. CPF vem do token.
 * GET — lista CPF com pulso recente.
 */
const { isRedisKvConfigured, createRedisClient } = require("../lib/dk-redis-env.cjs");
const { applyApiCors, enforceRateLimit, requirePortalAuth, onlyDigits } = require("../lib/dk-portal-auth.cjs");

const REDIS_KEY = "dk:portal:equipa_presenca:v1";
const MAX_AGE_MS = 8 * 60 * 1000;
const MAX_OPS = 40;

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
  return { byCpf: data.byCpf };
}

function pruneStore(store) {
  const now = Date.now();
  const byCpf = {};
  for (const [cpf, row] of Object.entries(store.byCpf || {})) {
    const key = onlyDigits(cpf).slice(0, 11);
    const at = Number(row?.at || 0);
    if (key.length !== 11 || at < now - MAX_AGE_MS) continue;
    byCpf[key] = { at, nome: String(row?.nome || "").trim() };
  }
  const ordered = Object.entries(byCpf)
    .sort((a, b) => Number(b[1].at || 0) - Number(a[1].at || 0))
    .slice(0, MAX_OPS);
  const kept = {};
  for (const [cpf, row] of ordered) kept[cpf] = row;
  return { byCpf: kept };
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

function listFromStore(store) {
  const clean = pruneStore(store);
  const operadores = Object.entries(clean.byCpf)
    .map(([cpf, row]) => ({ cpf, at: Number(row?.at || 0), nome: String(row?.nome || "").trim() }))
    .sort((a, b) => a.cpf.localeCompare(b.cpf));
  return { operadores, cpfs: operadores.map((o) => o.cpf) };
}

module.exports = async function handler(req, res) {
  applyApiCors(res);
  res.setHeader("Content-Type", "application/json");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (await enforceRateLimit(req, res, "equipa-presenca", 40)) return;

  const gate = requirePortalAuth(req, { allowCliente: false, allowEquipa: true, allowService: false });
  if (!gate.ok) {
    return res.status(gate.status).json({ ok: false, reason: gate.reason });
  }

  if (!isRedisKvConfigured()) {
    return res.status(503).json({ ok: false, reason: "kv_not_configured" });
  }

  const redis = createRedisClient();

  try {
    if (req.method === "GET") {
      const store = parseStore(await redis.get(REDIS_KEY));
      const list = listFromStore(store);
      return res.status(200).json({ ok: true, ...list });
    }

    if (req.method === "POST") {
      const cpf = onlyDigits(gate.cpf).slice(0, 11);
      if (cpf.length !== 11) {
        return res.status(400).json({ ok: false, reason: "cpf" });
      }
      const body = parseBody(req);
      const vivo = body.vivo !== false && body.vivo !== 0 && String(body.vivo || "true") !== "false";
      const store = pruneStore(parseStore(await redis.get(REDIS_KEY)));
      if (vivo) {
        store.byCpf[cpf] = {
          at: Date.now(),
          nome: String(gate.nome || "").trim(),
        };
      } else {
        delete store.byCpf[cpf];
      }
      await redis.set(REDIS_KEY, JSON.stringify(store));
      const list = listFromStore(store);
      return res.status(200).json({ ok: true, ...list });
    }
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e && e.message ? e.message : e) });
  }

  return res.status(405).json({ ok: false, reason: "method" });
};
