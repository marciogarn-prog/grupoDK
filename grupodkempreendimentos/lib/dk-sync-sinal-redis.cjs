/**
 * Sinal de sync do Log via Redis (Upstash já usado na ocupação das abas).
 * Não é autoridade: o cursor e os eventos vêm de public.dk_events (PG).
 * Só guarda o seq máximo conhecido para os PCs saberem quando fazer catch-up.
 *
 * Publicação: MAX monotônico atómico via EVAL/Lua (R06) — writers concorrentes
 * nunca fazem o seq Redis regredir. Se Redis falhar, o catch-up continua pelo PG.
 */
const { isRedisKvConfigured, createRedisClient } = require("./dk-redis-env.cjs");

const KEY = "dk:portal:sync_sinal:v1";

/**
 * KEYS[1]=chave  ARGV[1]=seq novo  ARGV[2]=at (ms)
 * Devolve o seq efectivo após MAX (número como string).
 */
const LUA_MAX_SEQ = `
local raw = redis.call('GET', KEYS[1])
local cur = 0
if raw then
  local n = tonumber(raw)
  if n then
    cur = math.floor(n)
  else
    local s = string.match(tostring(raw), '"seq"%s*:%s*(%d+)')
    if s then cur = tonumber(s) or 0 end
  end
end
local novo = tonumber(ARGV[1])
if (not novo) or novo <= 0 then
  return tostring(cur)
end
novo = math.floor(novo)
if novo <= cur then
  return tostring(cur)
end
local at = tonumber(ARGV[2]) or 0
local pacote = '{"seq":' .. novo .. ',"at":' .. at .. '}'
redis.call('SET', KEYS[1], pacote)
return tostring(novo)
`.trim();

function seqValido(valor) {
  const n = Number(valor);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

function parseSinalRaw(raw) {
  if (raw == null) return { seq: 0, at: 0 };
  let data = raw;
  if (typeof raw === "string") {
    try {
      data = JSON.parse(raw);
    } catch {
      const n = seqValido(raw);
      return { seq: n, at: n ? Date.now() : 0 };
    }
  }
  if (typeof data === "number") {
    const n = seqValido(data);
    return { seq: n, at: n ? Date.now() : 0 };
  }
  if (!data || typeof data !== "object") return { seq: 0, at: 0 };
  return {
    seq: seqValido(data.seq),
    at: Number(data.at) || 0,
  };
}

/**
 * Simula o MAX monotónico do Lua (teste unitário / corrida em memória).
 * Não grava nada — só prova a regra de não-regressão.
 */
function maxSeqMonotonico(atualSeq, candidatoSeq) {
  const cur = seqValido(atualSeq);
  const novo = seqValido(candidatoSeq);
  if (!novo) return cur;
  return novo > cur ? novo : cur;
}

async function lerSinalSync() {
  if (!isRedisKvConfigured()) return { seq: 0, at: 0 };
  try {
    const redis = createRedisClient();
    const raw = await redis.get(KEY);
    return parseSinalRaw(raw);
  } catch {
    return { seq: 0, at: 0 };
  }
}

/**
 * Publica seq se for maior que o sinal actual — atómico no Redis (EVAL).
 * Fire-and-forget nos writers via Quiet. Falha Redis ≠ perda de dados (PG manda).
 */
async function publicarSinalSync(seq) {
  const novo = seqValido(seq);
  if (!novo || !isRedisKvConfigured()) return { ok: false, seq: 0, reason: "skip" };
  try {
    const redis = createRedisClient();
    const at = Date.now();
    const out = await redis.eval(LUA_MAX_SEQ, [KEY], [String(novo), String(at)]);
    const efectivo = seqValido(out);
    return {
      ok: true,
      seq: efectivo || novo,
      skipped: efectivo > 0 && efectivo !== novo,
      atomic: true,
    };
  } catch {
    /* Fallback não-autoritativo: tenta GET+SET com revalidação (ainda racy, mas
       nunca grava abaixo do valor lido nesta tentativa). Catch-up oficial = PG. */
    try {
      const redis = createRedisClient();
      const atual = await lerSinalSync();
      if (novo <= atual.seq) return { ok: true, seq: atual.seq, skipped: true, atomic: false };
      const pacote = { seq: novo, at: Date.now() };
      await redis.set(KEY, JSON.stringify(pacote));
      const conf = await lerSinalSync();
      if (conf.seq < novo && conf.seq > 0) {
        /* Outro writer ganhou com seq maior — OK monotónico. */
        return { ok: true, seq: conf.seq, skipped: true, atomic: false };
      }
      return { ok: true, seq: Math.max(novo, conf.seq), atomic: false };
    } catch {
      return { ok: false, seq: 0, reason: "redis", fallback_pg: true };
    }
  }
}

function publicarSinalSyncQuiet(seq) {
  void publicarSinalSync(seq).catch(() => {});
}

module.exports = {
  KEY,
  LUA_MAX_SEQ,
  lerSinalSync,
  publicarSinalSync,
  publicarSinalSyncQuiet,
  seqValido,
  parseSinalRaw,
  maxSeqMonotonico,
};
