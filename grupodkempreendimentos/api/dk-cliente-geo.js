/**
 * Posições GPS dos clientes (app DK Cliente).
 * POST /api/dk-cliente-geo — body { cpf, lat, lng, ... }
 * GET  /api/dk-cliente-geo — lista últimas posições (admin mapa)
 *
 * A fonte oficial é public.dk_cliente_geo. Redis só guarda a lista já lida.
 * Web Push (mensagens DK): GET/POST /api/dk-cliente-geo?push=1
 */
const { isRedisKvConfigured, createRedisClient } = require("../lib/dk-redis-env.cjs");
const { handleClientePush } = require("../lib/dk-cliente-push-handler.cjs");
const { applyApiCors, enforceRateLimit, requireLiveSession } = require("../lib/dk-portal-auth.cjs");
const { listarPosicoes, gravarPosicao, linhaParaCliente } = require("../lib/dk-cliente-geo-pg.cjs");

const REDIS_KEY = "dk:portal:cliente_geo_v1";

function onlyDigits(s) {
  return String(s ?? "").replace(/\D/g, "");
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

function applyCors(res) {
  applyApiCors(res);
}

function storeDeClientes(clientes) {
  const byCpf = {};
  for (const row of clientes || []) {
    if (!row || !row.cpf) continue;
    byCpf[row.cpf] = row;
  }
  return { byCpf, updatedAt: Date.now() };
}

async function cacheGeoRedis(clientes) {
  if (!isRedisKvConfigured()) return { ok: false, reason: "redis_indisponivel" };
  const redis = createRedisClient();
  await redis.set(REDIS_KEY, JSON.stringify(storeDeClientes(clientes)));
  return { ok: true };
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
  if (!data || typeof data !== "object" || !data.byCpf || typeof data.byCpf !== "object") return { byCpf: {} };
  return data;
}

let semeaduraTentada = false;

async function semearDoCacheSeVazio(lista) {
  if (lista.clientes.length || semeaduraTentada || !isRedisKvConfigured()) return lista;
  semeaduraTentada = true;
  let raw = null;
  try {
    raw = await createRedisClient().get(REDIS_KEY);
  } catch (err) {
    console.error("[DK geo] cache redis na semeadura", err && err.message ? err.message : err);
    return lista;
  }
  const entradas = Object.values(parseStore(raw).byCpf || {});
  if (!entradas.length) return lista;
  for (const entrada of entradas) {
    const gravou = await gravarPosicao(entrada);
    if (gravou.status !== 200) return lista;
  }
  return listarPosicoes();
}

function respostaLista(lista, redis) {
  return {
    ok: true,
    success: true,
    source: "supabase",
    revision: lista.revision,
    updated_at: lista.revision,
    updatedAt: lista.updatedAt || Date.now(),
    total: lista.clientes.length,
    clientes: lista.clientes,
    persistencia: redis && redis.ok ? "supabase+redis" : "supabase",
    redis: redis && redis.ok ? { ok: true } : { ok: false, reason: (redis && redis.reason) || "redis_indisponivel" },
  };
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
    if (req.method === "GET") {
      let lista = await listarPosicoes();
      if (!lista.ok) return res.status(lista.status).json(lista.body);
      lista = await semearDoCacheSeVazio(lista);
      if (!lista.ok) return res.status(lista.status).json(lista.body);
      let redis = { ok: false, reason: "redis_indisponivel" };
      try {
        redis = await cacheGeoRedis(lista.clientes);
      } catch (err) {
        console.error("[DK geo] cache redis apos leitura", err && err.message ? err.message : err);
        redis = { ok: false, reason: "redis_indisponivel" };
      }
      return res.status(200).json(respostaLista(lista, redis));
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

    const central = await gravarPosicao({
      cpf,
      nome: body.nome,
      placa: body.placa,
      protocolo: body.protocolo,
      lat,
      lng,
      accuracy: body.accuracy,
      heading: body.heading,
      speed: body.speed,
      ts: Number(body.ts) || Date.now(),
    });
    if (central.status !== 200) return res.status(central.status).json(central.body);
    let redis = { ok: true, skipped: true };
    if (!central.inalterado) {
      try {
        const lista = await listarPosicoes();
        if (lista.ok) redis = await cacheGeoRedis(lista.clientes);
        else redis = { ok: false, reason: "lista_indisponivel" };
      } catch (err) {
        console.error("[DK geo] cache redis apos gravacao", err && err.message ? err.message : err);
        redis = { ok: false, reason: "redis_indisponivel" };
      }
    }
    return res.status(200).json({
      ...central.body,
      persistencia: redis.ok && !redis.skipped ? "supabase+redis" : "supabase",
      redis,
    });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      success: false,
      msg: "Erro ao processar localização.",
      error: String(e && e.message ? e.message : e),
    });
  }
};

module.exports.linhaParaCliente = linhaParaCliente;
