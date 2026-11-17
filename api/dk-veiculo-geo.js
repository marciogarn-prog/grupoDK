/**
 * Posições + comandos EC33.
 * GET  /api/dk-veiculo-geo — lista posições
 * GET  /api/dk-veiculo-geo?comandos=1&imei=… — pendentes (agente USB)
 * POST — posição (source=ec33_gt06) | vincular | comando | cerca | comando_resultado
 */
const { isRedisKvConfigured, createRedisClient } = require("../lib/dk-redis-env.cjs");
const { applyApiCors, enforceRateLimit, requireLiveSession } = require("../lib/dk-portal-auth.cjs");
const {
  listarPosicoes,
  gravarPosicao,
  vincularVeiculo,
  linhaParaVeiculo,
  normImei,
} = require("../lib/dk-veiculo-geo-pg.cjs");
const {
  enfileirarComando,
  listarPendentes,
  marcarResultado,
  lerCercas,
  gravarCerca,
} = require("../lib/dk-veiculo-comando-fila.cjs");
const { normPlaca } = require("../lib/dk-ec33-comandos.cjs");

const REDIS_KEY = "dk:portal:veiculo_geo_v1";

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

function storeDeVeiculos(veiculos) {
  const byImei = {};
  for (const row of veiculos || []) {
    if (!row || !row.imei) continue;
    byImei[row.imei] = row;
  }
  return { byImei, updatedAt: Date.now() };
}

async function cacheGeoRedis(veiculos) {
  if (!isRedisKvConfigured()) return { ok: false, reason: "redis_indisponivel" };
  const redis = createRedisClient();
  await redis.set(REDIS_KEY, JSON.stringify(storeDeVeiculos(veiculos)));
  return { ok: true };
}

function parseStore(raw) {
  if (raw == null) return { byImei: {} };
  let data = raw;
  if (typeof raw === "string") {
    try {
      data = JSON.parse(raw);
    } catch {
      return { byImei: {} };
    }
  }
  if (!data || typeof data !== "object" || !data.byImei || typeof data.byImei !== "object") {
    return { byImei: {} };
  }
  return data;
}

let semeaduraTentada = false;

async function semearDoCacheSeVazio(lista) {
  if (lista.veiculos.length || semeaduraTentada || !isRedisKvConfigured()) return lista;
  semeaduraTentada = true;
  let raw = null;
  try {
    raw = await createRedisClient().get(REDIS_KEY);
  } catch (err) {
    console.error("[DK veiculo-geo] cache redis na semeadura", err && err.message ? err.message : err);
    return lista;
  }
  const entradas = Object.values(parseStore(raw).byImei || []);
  if (!entradas.length) return lista;
  for (const entrada of entradas) {
    const gravou = await gravarPosicao(entrada);
    if (gravou.status !== 200) return lista;
  }
  return listarPosicoes();
}

function respostaLista(lista, redis, cercas) {
  return {
    ok: true,
    success: true,
    source: "supabase",
    revision: lista.revision,
    updated_at: lista.revision,
    updatedAt: lista.updatedAt || Date.now(),
    total: lista.veiculos.length,
    veiculos: lista.veiculos,
    cercas: cercas || {},
    persistencia: redis && redis.ok ? "supabase+redis" : "supabase",
    redis: redis && redis.ok ? { ok: true } : { ok: false, reason: (redis && redis.reason) || "redis_indisponivel" },
  };
}

module.exports = async function handler(req, res) {
  applyApiCors(res);

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (await enforceRateLimit(req, res, "veiculo-geo", req.method === "GET" ? 30 : 80)) return;

  const gate = await requireLiveSession(req, { allowCliente: false, allowEquipa: true, allowService: true });
  if (!gate.ok) {
    return res.status(gate.status).json({ ok: false, reason: gate.reason });
  }

  try {
    if (req.method === "GET") {
      if (String(req.query?.comandos || "") === "1") {
        const pendentes = await listarPendentes(req.query?.imei);
        return res.status(200).json({ ok: true, comandos: pendentes });
      }
      let lista = await listarPosicoes();
      if (!lista.ok) {
        // Sem tabela ainda: devolve vínculo estático para o mapa não ficar vazio.
        const seed = [
          {
            imei: "869137082186396",
            placa: "SOX2B04",
            nome: "SHINERAY XY 150-8 JEF S EFI",
            modelo: "EC33",
            lat: 0,
            lng: 0,
            speed: 0,
            heading: null,
            ts: Date.now(),
            acc: null,
          },
        ];
        const cercas = await lerCercas();
        return res.status(200).json({
          ok: true,
          success: true,
          source: "seed",
          total: seed.length,
          veiculos: seed,
          cercas,
          msg: lista.body?.msg || "Tabela geo ainda não criada — a mostrar vínculo local.",
        });
      }
      lista = await semearDoCacheSeVazio(lista);
      if (!lista.ok) return res.status(lista.status).json(lista.body);
      let redis = { ok: false, reason: "redis_indisponivel" };
      try {
        redis = await cacheGeoRedis(lista.veiculos);
      } catch (err) {
        redis = { ok: false, reason: "redis_indisponivel" };
      }
      const cercas = await lerCercas();
      return res.status(200).json(respostaLista(lista, redis, cercas));
    }

    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, msg: "Método não permitido." });
    }

    const body = parseBody(req);
    const acao = String(body.acao || "").trim().toLowerCase();

    if (acao === "vincular") {
      const out = await vincularVeiculo({
        imei: body.imei,
        placa: body.placa,
        nome: body.nome,
        protocolo: body.protocolo,
        modelo: body.modelo || "EC33",
        lat: body.lat,
        lng: body.lng,
      });
      // Se a tabela ainda não existe, confirma vínculo lógico.
      if (out.status === 503) {
        return res.status(200).json({
          ok: true,
          success: true,
          source: "seed",
          imei: normImei(body.imei),
          placa: normPlaca(body.placa),
          nome: body.nome || "",
          msg: "Vínculo registado localmente; publique a tabela dk_veiculo_geo para persistir na nuvem.",
        });
      }
      return res.status(out.status).json(out.body);
    }

    if (acao === "comando") {
      const out = await enfileirarComando({
        imei: body.imei,
        placa: body.placa,
        tipo: body.tipo,
        params: body.params || {},
        origem: gate.service ? "service" : "portal",
      });
      return res.status(out.status).json(out.body);
    }

    if (acao === "comando_resultado") {
      const out = await marcarResultado({
        id: body.id,
        ok: body.ok !== false,
        resposta: body.resposta,
        via: body.via || "usb",
      });
      return res.status(out.status).json(out.body);
    }

    if (acao === "cerca") {
      const imei = normImei(body.imei);
      const ativa = body.ativa !== false && String(body.tipo || "").toLowerCase() !== "cerca_off";
      if (!ativa) {
        await gravarCerca(imei, { ativa: false });
        const cmd = await enfileirarComando({
          imei,
          placa: body.placa,
          tipo: "cerca_off",
          params: {},
          origem: "portal",
        });
        return res.status(200).json({ ok: true, cerca: null, comando: cmd.body?.comando || null });
      }
      const lat = Number(body.lat);
      const lng = Number(body.lng);
      const raioM = Number(body.raioM) || 500;
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return res.status(400).json({ ok: false, msg: "Informe lat/lng do centro da cerca (ou use a posição atual no mapa)." });
      }
      const cerca = await gravarCerca(imei, {
        ativa: true,
        placa: body.placa,
        lat,
        lng,
        raioM,
      });
      const cmd = await enfileirarComando({
        imei,
        placa: body.placa,
        tipo: "cerca_on",
        params: { metros: raioM },
        origem: "portal",
      });
      return res.status(200).json({ ok: true, cerca: cerca.cerca, comando: cmd.body?.comando || null });
    }

    const source = String(body.source || "").trim();
    if (source !== "ec33_gt06" && source !== "manual_teste" && source !== "usb_agent") {
      return res.status(403).json({
        ok: false,
        msg: "Posição de veículo só pode ser enviada pelo bridge/agente EC33.",
      });
    }

    const imei = normImei(body.imei);
    const lat = Number(body.lat);
    const lng = Number(body.lng);
    if (imei.length < 14) {
      return res.status(400).json({ ok: false, msg: "IMEI inválido." });
    }
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.status(400).json({ ok: false, msg: "Coordenadas inválidas." });
    }

    const central = await gravarPosicao({
      imei,
      placa: body.placa,
      nome: body.nome,
      protocolo: body.protocolo,
      modelo: body.modelo || "EC33",
      lat,
      lng,
      accuracy: body.accuracy,
      heading: body.heading,
      speed: body.speed,
      acc: body.acc,
      ignicao: body.ignicao,
      gsm: body.gsm,
      bateria: body.bateria,
      ts: Number(body.ts) || Date.now(),
    });
    if (central.status !== 200) return res.status(central.status).json(central.body);
    let redis = { ok: true, skipped: true };
    if (!central.inalterado) {
      try {
        const lista = await listarPosicoes();
        if (lista.ok) redis = await cacheGeoRedis(lista.veiculos);
      } catch {
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
      msg: "Erro ao processar localização/comando de veículo.",
      error: String(e && e.message ? e.message : e),
    });
  }
};

module.exports.linhaParaVeiculo = linhaParaVeiculo;
