/**
 * Presença de área de trabalho (aviso). Não grava cadastro.
 * Redis partilhado entre PCs — o mesmo mapa alimenta «OCUPADO POR…» e Usuários ativos.
 * Não bloqueia outros usuários: dois operadores podem usar a mesma área.
 * Concorrência de escrita fica no registro (version/409), não na tela.
 */
const { isRedisKvConfigured, createRedisClient } = require("../lib/dk-redis-env.cjs");
const {
  applyApiCors,
  enforceRateLimit,
  requireLiveSession,
  onlyDigits,
} = require("../lib/dk-portal-auth.cjs");
const { ordenarSessoes } = require("../lib/dk-log-apresentacao.cjs");
const { tocarPresencaLive } = require("../lib/dk-live-presenca.cjs");
const { lerSinalSync } = require("../lib/dk-sync-sinal-redis.cjs");

const TTL_SEC = 90;
const AREAS = new Set([
  "operacao",
  "manutencao",
  "estoque",
  "localizacao",
  "documentos",
  "financeiro",
  "financeiro-ceo",
  "log",
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

const AREA_TELA = {
  manutencao: "Manutenção",
  estoque: "Estoque",
  localizacao: "Localização de clientes",
  documentos: "Documentos",
  financeiro: "Financeiro",
  "financeiro-ceo": "Financeiro CEO",
  log: "Log DK",
  "operacao-cadastro-cliente": "Cadastro de cliente",
  "operacao-cadastro-veiculo": "Cadastro de veículo",
  "operacao-cadastro-locacao": "Cadastro de locação",
  "operacao-relatorio-rotatividade": "Relatório de rotatividade",
  "operacao-relatorio-inatividade": "Relatório de inatividade",
  "operacao-lancamento-aluguel": "Lançamento de aluguel",
  "operacao-lancamento-multas": "Lançamento de multas",
  "operacao-cadastro-colaborador": "Cadastro de colaborador",
  "operacao-cadastro-administrador": "Cadastro de administrador",
};

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
    entrada: Number(data.entrada) || Number(data.at) || 0,
    role: String(data.role || "").trim().slice(0, 40),
    maquina: String(data.maquina || "").trim().slice(0, 40),
    tela: String(data.tela || "").trim().slice(0, 60),
  };
}

function nomeExibicao(body) {
  return String(body.nome || "")
    .replace(/[\r\n\t]/g, " ")
    .trim()
    .slice(0, 80);
}

function textoCurto(valor, max) {
  return String(valor || "")
    .replace(/[\r\n\t]/g, " ")
    .trim()
    .slice(0, max);
}

function telaDaArea(area, body) {
  const doCliente = textoCurto(body && body.tela, 60);
  if (doCliente) return doCliente;
  return AREA_TELA[area] || area || "DK Locadora";
}

function pacotePresenca(gate, body, area, marca, entradaAnterior) {
  const at = Number(marca) || Date.now();
  return {
    cpf: onlyDigits(gate.cpf).slice(0, 11),
    nome: nomeExibicao(body) || textoCurto(gate.nome, 80),
    at,
    entrada: Number(entradaAnterior) || at,
    role: textoCurto(body.perfil || gate.role, 40),
    maquina: textoCurto(body.maquina, 40),
    tela: telaDaArea(area, body),
  };
}

function sessoesDoMapa(areasRaw) {
  const rows = [];
  for (const [area, dono] of Object.entries(areasRaw || {})) {
    if (!dono || !dono.cpf) continue;
    const atMs = Number(dono.at) || Date.now();
    const entradaMs = Number(dono.entrada) || atMs;
    rows.push({
      session_id: "area:" + dono.cpf,
      user_id: dono.cpf,
      user_name: dono.nome || "",
      role: dono.role || "",
      device_label: dono.maquina || "",
      session_started_at: new Date(entradaMs).toISOString(),
      last_activity_at: new Date(atMs).toISOString(),
      current_screen: dono.tela || AREA_TELA[area] || area,
      status: "ONLINE",
    });
  }
  return ordenarSessoes(rows, new Date());
}

async function soltarOutras(redis, cpf, areaAtual) {
  for (const area of AREAS) {
    if (area === areaAtual) continue;
    const key = chave(area);
    const dono = lerDono(await redis.get(key));
    if (dono && dono.cpf === cpf) await redis.del(key);
  }
}

async function espelharLive(gate, body, area, vivo) {
  try {
    await tocarPresencaLive({
      sid: gate && gate.sid,
      cpf: gate && gate.cpf,
      nome: (body && body.nome) || (gate && gate.nome),
      role: gate && gate.role,
      perfil: body && body.perfil,
      maquina: body && body.maquina,
      tela: vivo === false ? undefined : telaDaArea(area, body),
      status: vivo === false ? "OFFLINE" : "ONLINE",
      navegador: body && body.navegador,
      sistema: body && body.sistema,
    });
  } catch (err) {
    console.error("[DK area] live sessions", err && err.message ? err.message : err);
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
      const areasRaw = {};
      for (const id of AREAS) {
        if (id === "operacao") continue;
        const dono = lerDono(await redisLista.get(chave(id)));
        if (dono && dono.nome) {
          areas[id] = dono.nome;
          areasRaw[id] = dono;
        }
      }
      const sinal = await lerSinalSync();
      return res.status(200).json({
        ok: true,
        areas,
        sessoes: sessoesDoMapa(areasRaw),
        server_event_seq: sinal.seq || 0,
        sinal_at: sinal.at || 0,
        transport: "redis",
      });
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
    if (acao === "renovar") {
      const donoRenova = lerDono(await redis.get(key));
      if (!donoRenova || donoRenova.cpf !== cpf) {
        return res.status(200).json({ ok: true, livre: false, expirada: true });
      }
      const pacote = pacotePresenca(gate, body, area, donoRenova.at || marca, donoRenova.entrada);
      await redis.set(key, JSON.stringify(pacote), { ex: TTL_SEC });
      void espelharLive(gate, body, area, true);
      return res.status(200).json({ ok: true, livre: true, marca: donoRenova.at || marca });
    }
    if (acao === "entrar") {
      const pacote = pacotePresenca(gate, body, area, marca, marca);
      const reservou = await redis.set(key, JSON.stringify(pacote), { nx: true, ex: TTL_SEC });
      if (reservou) {
        await soltarOutras(redis, cpf, area);
        void espelharLive(gate, body, area, true);
        return res.status(200).json({ ok: true, livre: true, marca });
      }
    }

    const dono = lerDono(await redis.get(key));
    if (!dono || dono.cpf === cpf) {
      const pacote = pacotePresenca(gate, body, area, marca, dono && dono.cpf === cpf ? dono.entrada : marca);
      await redis.set(key, JSON.stringify(pacote), { ex: TTL_SEC });
      if (acao === "entrar") await soltarOutras(redis, cpf, area);
      void espelharLive(gate, body, area, true);
      return res.status(200).json({ ok: true, livre: true, marca });
    }

    /* Compartilha a área: presença informativa, sem bloquear a UI. */
    return res.status(200).json({
      ok: true,
      livre: true,
      compartilhada: true,
      aviso: true,
      ocupada: false,
      area,
      nome: dono.nome || "outra pessoa",
      marca,
    });
  } catch (e) {
    const reason = e && e.reason === "cloud_budget" ? "cloud_budget" : "area_indisponivel";
    return res.status(503).json({ ok: false, reason });
  } finally {
    void redis;
  }
};
