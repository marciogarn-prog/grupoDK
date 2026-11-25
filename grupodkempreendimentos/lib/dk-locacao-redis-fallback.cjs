/**
 * Quando o Postgres/Supabase não confirma (522/504/timeout), o Redis assume
 * leitura e gravação de locação para o portal continuar a trabalhar.
 */
const { isRedisKvConfigured, createRedisClient } = require("./dk-redis-env.cjs");
const { mergeLocacoesCadastro, mergePortalLancamentosAluguelEmbutidos } = require("./dk-append-only-merge.cjs");
const { acquireLocacoesWriteLock, releaseLocacoesWriteLock } = require("./dk-locacoes-integrity.cjs");

const REDIS_KEY = "dk:portal:cloud_snapshot:v1";

function digitos(v) {
  return String(v || "").replace(/\D/g, "");
}

function pgComunicacaoFalhou(status, reason) {
  const st = Number(status || 0);
  const r = String(reason || "");
  return (
    st === 504 ||
    st === 522 ||
    st === 524 ||
    st === 503 ||
    st === 502 ||
    r === "leitura" ||
    r === "gravacao" ||
    r === "supabase_timeout" ||
    r === "supabase_indisponivel" ||
    r === "rpc_ausente" ||
    /^supabase_http_5\d\d$/.test(r)
  );
}

function lerEnvelope(raw) {
  if (!raw) return null;
  let row = raw;
  if (typeof raw === "string") {
    try {
      row = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!row || typeof row !== "object" || !row.payload || typeof row.payload !== "object") return null;
  return { payload: row.payload, updated_at: row.updated_at || null, label: row.label || "default" };
}

async function lerPayloadRedis() {
  if (!isRedisKvConfigured()) return null;
  try {
    const redis = createRedisClient();
    return lerEnvelope(await redis.get(REDIS_KEY));
  } catch {
    return null;
  }
}

function locacoesDoPayload(payload) {
  return Array.isArray(payload?.dk_locacoes_cadastro) ? payload.dk_locacoes_cadastro : [];
}

function filtrarCpf(lista, cpfCliente) {
  const cpf = digitos(cpfCliente).slice(0, 11);
  if (cpf.length !== 11) return Array.isArray(lista) ? lista : [];
  return (Array.isArray(lista) ? lista : []).filter((l) => digitos(l && l.cpf).slice(0, 11) === cpf);
}

async function listarDoRedis(cpfCliente) {
  const env = await lerPayloadRedis();
  if (!env) {
    return { ok: false, schema: true, ativado: true, reason: "redis_indisponivel", locacoes: [], fallback: false };
  }
  const locs = filtrarCpf(locacoesDoPayload(env.payload), cpfCliente);
  return {
    ok: true,
    schema: true,
    ativado: true,
    source: "redis",
    fallback: true,
    supabasePendente: true,
    quantidade: locs.length,
    locacoes: locs,
  };
}

async function hidratarPagamentosDaFilaRedis(locacao, nc) {
  if (!locacao || typeof locacao !== "object" || !isRedisKvConfigured()) return locacao;
  try {
    const redis = createRedisClient();
    const all = await redis.hgetall("dk:portal:lancamentos_fila:v1");
    const mapa = all && typeof all === "object" ? all : {};
    const porProto = new Map();
    const atuais = Array.isArray(locacao.portalLancamentosAluguel) ? locacao.portalLancamentosAluguel : [];
    for (const p of atuais) {
      const id = String(p?.protocoloLancamento || p?.protocolo || "").trim();
      if (id) porProto.set(id, p);
      else porProto.set(`anon:${atuais.indexOf(p)}`, p);
    }
    for (const raw of Object.values(mapa)) {
      let item = raw;
      if (typeof raw === "string") {
        try {
          item = JSON.parse(raw);
        } catch {
          continue;
        }
      }
      if (!item || !item.pagamento) continue;
      if (digitos(item.nc) !== digitos(nc)) continue;
      const id = String(item.pagamento.protocoloLancamento || item.pagamento.protocolo || "").trim();
      if (!id) continue;
      const prev = porProto.get(id);
      porProto.set(id, prev ? { ...prev, ...item.pagamento } : { ...item.pagamento });
    }
    const merged = Array.from(porProto.values());
    return { ...locacao, portalLancamentosAluguel: merged };
  } catch {
    return locacao;
  }
}

async function detalheDoRedis(numero, cpfCliente) {
  const nc = digitos(numero);
  if (!nc) return { ok: false, status: 400, reason: "contrato_obrigatorio", ativado: true, fallback: false };
  const env = await lerPayloadRedis();
  if (!env) {
    return { ok: false, status: 503, reason: "redis_indisponivel", ativado: true, fallback: false };
  }
  let locs = locacoesDoPayload(env.payload);
  const cpf = digitos(cpfCliente).slice(0, 11);
  if (cpf.length === 11) locs = filtrarCpf(locs, cpf);
  let locacao = locs.find((l) => digitos(l && (l.numeroContrato || l.protocolo)) === nc) || null;
  if (!locacao) {
    return { ok: false, status: 404, reason: "nao_encontrada", ativado: true, fallback: false };
  }
  locacao = await hidratarPagamentosDaFilaRedis(locacao, nc);
  return {
    ok: true,
    schema: true,
    ativado: true,
    source: "redis",
    fallback: true,
    supabasePendente: true,
    quantidade: 1,
    locacao,
  };
}

async function gravarNoRedis(locacao, opts) {
  if (!isRedisKvConfigured()) {
    return { ok: false, status: 503, reason: "kv_not_configured" };
  }
  const nc = digitos(locacao && (locacao.numeroContrato || locacao.protocolo || (opts && opts.numero)));
  if (!nc) return { ok: false, status: 400, reason: "protocolo_obrigatorio" };
  const redis = createRedisClient();
  let lock = "";
  try {
    lock = await acquireLocacoesWriteLock(redis, { attempts: 40, waitMs: 50, ttlSec: 20 });
  } catch {
    lock = "sem-redis";
  }
  if (!lock) {
    return { ok: false, status: 409, reason: "locacoes_write_busy" };
  }
  try {
    const env = lerEnvelope(await redis.get(REDIS_KEY)) || {
      payload: {},
      updated_at: null,
      label: "default",
    };
    const payload = env.payload && typeof env.payload === "object" ? { ...env.payload } : {};
    const base = locacoesDoPayload(payload);
    const prev = base.find((l) => digitos(l && (l.numeroContrato || l.protocolo)) === nc) || null;
    const prevVer = Number(prev && prev.pgVersion) || 0;
    const incomingVer = Number(locacao && locacao.pgVersion) || 0;
    const nextVer = Math.max(prevVer, incomingVer) + 1;
    const pagamentosUnidos = mergePortalLancamentosAluguelEmbutidos([
      prev && prev.portalLancamentosAluguel,
      locacao && locacao.portalLancamentosAluguel,
    ]);
    const saved = {
      ...(prev || {}),
      ...(locacao && typeof locacao === "object" ? locacao : {}),
      numeroContrato: nc,
      protocolo: nc,
      pgId: (locacao && locacao.pgId) || (prev && prev.pgId) || `redis-${nc}`,
      pgVersion: nextVer,
      updatedAt: Date.now(),
      portalLancamentosAluguel: pagamentosUnidos,
      _dkRedisPendente: true,
      _dkOperationId: (opts && opts.operationId) || null,
    };
    /* Nunca gravar locação Redis com menos pagamentos do que já existia. */
    const nPrev = Array.isArray(prev?.portalLancamentosAluguel) ? prev.portalLancamentosAluguel.length : 0;
    if (pagamentosUnidos.length < nPrev) {
      saved.portalLancamentosAluguel = Array.isArray(prev.portalLancamentosAluguel)
        ? prev.portalLancamentosAluguel.slice()
        : pagamentosUnidos;
    }
    payload.dk_locacoes_cadastro = mergeLocacoesCadastro(base, [saved]);
    payload.dk_dados_seguros_v1 = true;
    const storedAt = new Date().toISOString();
    await redis.set(REDIS_KEY, JSON.stringify({ label: env.label || "default", payload, updated_at: storedAt }));
    await redis.set(`${REDIS_KEY}:rev`, storedAt);
    return {
      ok: true,
      status: 200,
      locacao: saved,
      version: nextVer,
      record_version: nextVer,
      operation_id: (opts && opts.operationId) || null,
      source: "redis",
      supabasePendente: true,
      confirmed: true,
      revision: storedAt,
      updated_at: storedAt,
    };
  } catch (err) {
    return {
      ok: false,
      status: 503,
      reason: "kv_write_failed",
      message: String(err && err.message ? err.message : err),
    };
  } finally {
    await releaseLocacoesWriteLock(redis, lock);
  }
}

module.exports = {
  REDIS_KEY,
  pgComunicacaoFalhou,
  listarDoRedis,
  detalheDoRedis,
  gravarNoRedis,
};
