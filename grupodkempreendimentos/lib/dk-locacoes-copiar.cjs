/**
 * Copia dk_locacoes_cadastro para public.dk_locacao.
 * Não grava snapshot, não escreve no Redis e não liga o módulo.
 */
const crypto = require("crypto");
const { isRedisKvConfigured } = require("./dk-redis-env.cjs");

const CHAVE_REDIS = "dk:portal:cloud_snapshot:v1";
const URL_PADRAO = "https://ppxtwqvzgujllfzarpuz.supabase.co";

function urlBase() {
  return String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || URL_PADRAO)
    .trim()
    .replace(/\/$/, "");
}

function chaveServico() {
  return String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
}

function extrairArray(texto, chave) {
  const marker = `"${chave}"`;
  const i = String(texto || "").indexOf(marker);
  if (i < 0) return null;
  const j = texto.indexOf("[", i + marker.length);
  if (j < 0) return null;
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let p = j; p < texto.length; p++) {
    const c = texto[p];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === "[") depth += 1;
    else if (c === "]") {
      depth -= 1;
      if (depth === 0) return texto.slice(j, p + 1);
    }
  }
  return null;
}

function objetosDoArray(texto) {
  const out = [];
  let i = String(texto || "").indexOf("[");
  if (i < 0) return out;
  i += 1;
  while (i < texto.length) {
    while (i < texto.length && /[\s,]/.test(texto[i])) i += 1;
    if (texto[i] === "]") break;
    if (texto[i] !== "{") break;
    const start = i;
    let depth = 0;
    let inStr = false;
    let esc = false;
    for (; i < texto.length; i += 1) {
      const c = texto[i];
      if (inStr) {
        if (esc) esc = false;
        else if (c === "\\") esc = true;
        else if (c === '"') inStr = false;
        continue;
      }
      if (c === '"') inStr = true;
      else if (c === "{" || c === "[") depth += 1;
      else if (c === "}" || c === "]") {
        depth -= 1;
        if (depth === 0) {
          out.push(texto.slice(start, i + 1));
          i += 1;
          break;
        }
      }
    }
  }
  return out;
}

function hashFinal(hashes) {
  const ord = (Array.isArray(hashes) ? hashes : []).slice().sort();
  return crypto.createHash("sha256").update(ord.join("\n"), "utf8").digest("hex");
}

async function rest(caminho, opts = {}) {
  const key = chaveServico();
  if (!key) return { ok: false, status: 503, data: { reason: "doorman_key_missing" } };
  let res;
  try {
    res = await fetch(urlBase() + "/rest/v1/" + caminho, {
      method: opts.method || "GET",
      headers: {
        apikey: key,
        Authorization: "Bearer " + key,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: opts.body == null ? undefined : JSON.stringify(opts.body),
      signal: AbortSignal.timeout(opts.ms || 30000),
    });
  } catch {
    return { ok: false, status: 522, data: { reason: "leitura_lenta" } };
  }
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text.slice(0, 300) };
  }
  return { ok: res.ok, status: res.status, data };
}

async function lerListaRedis() {
  if (!isRedisKvConfigured()) return { ok: false, reason: "kv_not_configured" };
  const { Redis } = require("@upstash/redis");
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  const redis = new Redis({ url, token, automaticDeserialization: false });
  const raw = await redis.get(CHAVE_REDIS);
  if (typeof raw !== "string") return { ok: false, reason: "redis_nao_texto" };
  const lista = extrairArray(raw, "dk_locacoes_cadastro");
  if (!lista) return { ok: false, reason: "sem_lista" };
  return { ok: true, lista };
}

async function hashTexto(lista) {
  const objs = objetosDoArray(lista);
  const hashes = [];
  const lote = 40;
  for (let i = 0; i < objs.length; i += lote) {
    const pedaco = "[" + objs.slice(i, i + lote).join(",") + "]";
    const res = await rest("rpc/dk_locacao_hashes_texto", {
      method: "POST",
      body: { p_texto: pedaco },
      ms: 30000,
    });
    if (!res.ok || !Array.isArray(res.data)) {
      return { ok: false, reason: "hash_redis", status: res.status };
    }
    hashes.push(...res.data);
  }
  return { ok: true, n: objs.length, hash: hashFinal(hashes) };
}

async function hashSnapshot() {
  const res = await rest("rpc/dk_locacao_hash_snapshot", { method: "POST", body: {}, ms: 30000 });
  if (!res.ok || typeof res.data !== "string") return { ok: false, reason: "hash_snapshot", status: res.status };
  return { ok: true, hash: res.data };
}

async function updatedAt() {
  const res = await rest("dk_cloud_snapshots?label=eq.default&select=updated_at", { ms: 20000 });
  const row = Array.isArray(res.data) ? res.data[0] : null;
  return row && row.updated_at ? row.updated_at : null;
}

async function conferir() {
  const redis = await lerListaRedis();
  if (!redis.ok) return { ok: false, aprovada: false, motivo: redis.reason };
  const redisHash = await hashTexto(redis.lista);
  if (!redisHash.ok) return { ok: false, aprovada: false, motivo: redisHash.reason };
  const fonte = await hashSnapshot();
  if (!fonte.ok) return { ok: false, aprovada: false, motivo: fonte.reason };
  const iguais = redisHash.hash === fonte.hash && redisHash.n > 0;
  return {
    ok: true,
    aprovada: iguais,
    motivo: iguais ? "igual" : "redis_divergente",
    redis: { quantidade: redisHash.n, hash: redisHash.hash },
    snapshot: { hash: fonte.hash, updated_at: await updatedAt() },
    iguais,
  };
}

async function executarCopia(op) {
  const antes = await conferir();
  if (!antes.ok || !antes.iguais) return { ...antes, copiou: false };
  if (op !== "copiar") return { ...antes, copiou: false };
  const gravou = await rest("rpc/dk_locacao_copiar_do_snapshot", {
    method: "POST",
    body: { p_redis_hash: antes.snapshot.hash },
    ms: 60000,
  });
  if (!gravou.ok || !gravou.data || gravou.data.ok !== true) {
    return {
      ok: false,
      aprovada: false,
      copiou: false,
      motivo: (gravou.data && gravou.data.reason) || "copia",
      antes,
    };
  }
  const resumo = await rest("rpc/dk_locacao_resumo", { method: "POST", body: {}, ms: 30000 });
  const depois = await conferir();
  return {
    ok: true,
    aprovada: Boolean(depois.iguais && resumo.ok && resumo.data && resumo.data.destino_hash === resumo.data.fonte_hash),
    copiou: true,
    motivo: "copiado",
    copia: gravou.data,
    resumo: resumo.data,
    redisDepois: depois.redis,
    snapshotDepois: depois.snapshot,
  };
}

module.exports = {
  extrairArray,
  objetosDoArray,
  hashFinal,
  conferir,
  executarCopia,
};
