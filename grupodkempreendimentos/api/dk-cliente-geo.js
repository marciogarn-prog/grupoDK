/**
 * Posições GPS dos clientes (app DK Cliente).
 * POST /api/dk-cliente-geo — body { cpf, lat, lng, ... }
 * GET  /api/dk-cliente-geo — lista últimas posições (admin mapa)
 *
 * Web Push (mensagens DK): GET/POST /api/dk-cliente-geo?push=1
 */
const { isRedisKvConfigured, createRedisClient } = require("../lib/dk-redis-env.cjs");
const { handleClientePush } = require("../lib/dk-cliente-push-handler.cjs");
const { applyApiCors, enforceRateLimit, requireLiveSession } = require("../lib/dk-portal-auth.cjs");
const { executarGravacaoCentral, ioSnapshotOficial } = require("../lib/dk-persistencia-central.cjs");

const REDIS_KEY = "dk:portal:cliente_geo_v1";
const SNAPSHOT_FIELD = "dk_cliente_geo_v1";
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
  applyApiCors(res);
}

function aplicarClienteGeo(payload, entrada) {
  const store = parseStore(payload[SNAPSHOT_FIELD]);
  const prev = store.byCpf[entrada.cpf] || {};
  store.byCpf[entrada.cpf] = {
    cpf: entrada.cpf,
    nome: String(entrada.nome || prev.nome || "").trim(),
    placa: normPlaca(entrada.placa || prev.placa || ""),
    protocolo: String(entrada.protocolo || prev.protocolo || "").trim(),
    lat: entrada.lat,
    lng: entrada.lng,
    accuracy: Number.isFinite(Number(entrada.accuracy)) ? Number(entrada.accuracy) : null,
    heading: Number.isFinite(Number(entrada.heading)) ? Number(entrada.heading) : null,
    speed: Number.isFinite(Number(entrada.speed)) ? Number(entrada.speed) : null,
    ts: entrada.ts,
    updatedAt: entrada.ts,
  };
  payload[SNAPSHOT_FIELD] = pruneStore(store);
  return payload;
}

function clientesDoStore(store) {
  return Object.values(store.byCpf || {}).sort((a, b) => Number(b.ts || 0) - Number(a.ts || 0));
}

async function lerClienteGeoComIo(io) {
  const atual = await io.ler();
  if (!atual || atual.indisponivel) {
    return {
      status: 503,
      body: {
        ok: false,
        success: false,
        reason: (atual && atual.reason) || "supabase_indisponivel",
      },
    };
  }
  const store = pruneStore(parseStore(atual.payload && atual.payload[SNAPSHOT_FIELD]));
  const clientes = clientesDoStore(store);
  return {
    status: 200,
    store,
    body: {
      ok: true,
      success: true,
      source: "supabase",
      revision: atual.updatedAt || null,
      updated_at: atual.updatedAt || null,
      updatedAt: store.updatedAt || Date.now(),
      total: clientes.length,
      clientes,
    },
  };
}

async function gravarClienteGeoComIo(io, entrada, cache) {
  const atual = await io.ler();
  if (!atual || atual.indisponivel) {
    return {
      status: 503,
      body: {
        ok: false,
        success: false,
        reason: (atual && atual.reason) || "supabase_indisponivel",
      },
    };
  }
  const informado = String(entrada.baseRevision || "");
  return executarGravacaoCentral({
    ler: io.ler,
    gravar: io.gravar,
    cache,
    baseRevision: informado || atual.updatedAt || "",
    mutar(payload) {
      aplicarClienteGeo(payload, entrada);
    },
  });
}

async function cacheGeoRedis(store) {
  if (!isRedisKvConfigured()) throw new Error("redis_indisponivel");
  const redis = createRedisClient();
  await redis.set(REDIS_KEY, JSON.stringify(store));
}

module.exports = async function handler(req, res) {
  if (String(req.query?.push || "") === "1") {
    return handleClientePush(req, res);
  }

  applyCors(res);

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (await enforceRateLimit(req, res, "cliente-geo", req.method === "GET" ? 20 : 40)) return;
  if (req.method === "GET") {
    const gate = await requireLiveSession(req, { allowCliente: false, allowEquipa: true });
    if (!gate.ok) {
      return res.status(gate.status).json({ ok: false, reason: gate.reason });
    }
  } else if (req.method === "POST") {
    const gate = await requireLiveSession(req, { allowCliente: true, allowEquipa: true });
    if (!gate.ok) {
      return res.status(gate.status).json({ ok: false, reason: gate.reason });
    }
    const bodyCpf = onlyDigits(parseBody(req).cpf).slice(0, 11);
    if (gate.typ === "cliente" && gate.cpf !== bodyCpf) {
      return res.status(403).json({ ok: false, reason: "cpf_mismatch" });
    }
  }

  try {
    const io = ioSnapshotOficial("default");

    if (req.method === "GET") {
      const lido = await lerClienteGeoComIo(io);
      if (lido.status === 200) {
        try {
          await cacheGeoRedis(lido.store);
        } catch (err) {
          console.error("[DK geo] cache redis apos leitura", err && err.message ? err.message : err);
        }
      }
      return res.status(lido.status).json(lido.body);
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
    const central = await gravarClienteGeoComIo(
      io,
      {
        cpf,
        nome: body.nome,
        placa: body.placa,
        protocolo: body.protocolo,
        lat,
        lng,
        accuracy: body.accuracy,
        heading: body.heading,
        speed: body.speed,
        ts,
        baseRevision: body.base_revision || body.revision || "",
      },
      async (payload) => {
        await cacheGeoRedis(payload[SNAPSHOT_FIELD]);
      }
    );
    if (central.status !== 200) return res.status(central.status).json(central.body);
    return res.status(200).json({ ...central.body, cpf, ts });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      success: false,
      msg: "Erro ao processar localização.",
      error: String(e && e.message ? e.message : e),
    });
  }
};

module.exports.aplicarClienteGeo = aplicarClienteGeo;
module.exports.lerClienteGeoComIo = lerClienteGeoComIo;
module.exports.gravarClienteGeoComIo = gravarClienteGeoComIo;
