/**
 * Trava temporária de área de trabalho. Não grava cadastro.
 * Redis guarda só quem está na área, por poucos segundos, para dois
 * computadores não abrirem a mesma área ao mesmo tempo.
 */
const { isRedisKvConfigured, createRedisClient } = require("../lib/dk-redis-env.cjs");
const {
  applyApiCors,
  enforceRateLimit,
  requireLiveSession,
  onlyDigits,
} = require("../lib/dk-portal-auth.cjs");

const TTL_SEC = 90;
const AREAS = new Set([
  "operacao",
  "manutencao",
  "estoque",
  "localizacao",
  "documentos",
  "financeiro",
  "financeiro-ceo",
  "operacao-cadastro-cliente",
  "operacao-cadastro-veiculo",
  "operacao-cadastro-locacao",
  "operacao-relatorio-rotatividade",
  "operacao-relatorio-inatividade",
  "operacao-lancamento-aluguel",
  "operacao-lancamento-multas",
  "operacao-cadastro-colaborador",
  "operacao-cadastro-administrador",
]);

function chave(area) {
  return `dk:portal:area_trabalho:v1:${area}`;
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

function lerDono(raw) {
  if (!raw) return null;
  let data = raw;
  if (typeof raw === "string") {
    try {
      data = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!data || typeof data !== "object") return null;
  const cpf = onlyDigits(data.cpf).slice(0, 11);
  if (cpf.length !== 11) return null;
  return {
    cpf,
    nome: String(data.nome || "").trim().slice(0, 80),
    at: Number(data.at) || 0,
  };
}

function nomeExibicao(body) {
  return String(body.nome || "")
    .replace(/[\r\n\t]/g, " ")
    .trim()
    .slice(0, 80);
}

async function soltarOutras(redis, cpf, areaAtual) {
  for (const area of AREAS) {
    if (area === areaAtual) continue;
    const key = chave(area);
    const dono = lerDono(await redis.get(key));
    if (dono && dono.cpf === cpf) await redis.del(key);
  }
}

module.exports = async function handler(req, res) {
  applyApiCors(res);
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "private, no-store");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (await enforceRateLimit(req, res, "area-trabalho", 60)) return;

  const gate = await requireLiveSession(req, { allowCliente: false, allowEquipa: true, allowService: false });
  if (!gate.ok) return res.status(gate.status).json({ ok: false, reason: gate.reason });

  const cpf = onlyDigits(gate.cpf).slice(0, 11);
  if (cpf.length !== 11) return res.status(400).json({ ok: false, reason: "cpf" });
  if (!isRedisKvConfigured()) return res.status(503).json({ ok: false, reason: "kv_not_configured" });

  const body = parseBody(req);
  const area = String(body.area || "").trim();
  const acao = String(body.acao || "entrar").trim();
  if (acao === "listar") {
    let redisLista;
    try {
      redisLista = createRedisClient();
      const areas = {};
      for (const id of AREAS) {
        if (id === "operacao") continue;
        const dono = lerDono(await redisLista.get(chave(id)));
        if (dono && dono.nome) areas[id] = dono.nome;
      }
      return res.status(200).json({ ok: true, areas });
    } catch (e) {
      const reason = e && e.reason === "cloud_budget" ? "cloud_budget" : "area_indisponivel";
      return res.status(503).json({ ok: false, reason });
    } finally {
      void redisLista;
    }
  }
  if (!AREAS.has(area)) return res.status(400).json({ ok: false, reason: "area" });

  let redis;
  try {
    redis = createRedisClient();
    const key = chave(area);
    if (acao === "sair") {
      const dono = lerDono(await redis.get(key));
      const marca = Number(body.marca) || 0;
      const mesmaMarca = !marca || !dono?.at || Number(dono.at) === marca;
      if (dono && dono.cpf === cpf && mesmaMarca) await redis.del(key);
      return res.status(200).json({ ok: true, livre: true });
    }

    const marca = Number(body.marca) || Date.now();
    const pacote = JSON.stringify({ cpf, nome: nomeExibicao(body), at: marca });
    if (acao === "entrar") {
      const reservou = await redis.set(key, pacote, { nx: true, ex: TTL_SEC });
      if (reservou) {
        await soltarOutras(redis, cpf, area);
        return res.status(200).json({ ok: true, livre: true, marca });
      }
    }

    const dono = lerDono(await redis.get(key));
    if (!dono || dono.cpf === cpf) {
      await redis.set(key, pacote, { ex: TTL_SEC });
      if (acao === "entrar") await soltarOutras(redis, cpf, area);
      return res.status(200).json({ ok: true, livre: true, marca });
    }

    return res.status(409).json({
      ok: false,
      ocupada: true,
      area,
      nome: dono.nome || "outra pessoa",
    });
  } catch (e) {
    const reason = e && e.reason === "cloud_budget" ? "cloud_budget" : "area_indisponivel";
    return res.status(503).json({ ok: false, reason });
  } finally {
    void redis;
  }
};
