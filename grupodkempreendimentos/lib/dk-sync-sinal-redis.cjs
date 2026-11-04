/**
 * Sinal de sync do Log via Redis (Upstash já usado na ocupação das abas).
 * Não é autoridade: o cursor e os eventos vêm de public.dk_events (PG).
 * Só guarda o seq máximo conhecido para os PCs saberem quando fazer catch-up.
 */
const { isRedisKvConfigured, createRedisClient } = require("./dk-redis-env.cjs");

const KEY = "dk:portal:sync_sinal:v1";

function seqValido(valor) {
  const n = Number(valor);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

async function lerSinalSync() {
  if (!isRedisKvConfigured()) return { seq: 0, at: 0 };
  try {
    const redis = createRedisClient();
    const raw = await redis.get(KEY);
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
  } catch {
    return { seq: 0, at: 0 };
  }
}

/**
 * Publica seq se for maior que o sinal actual. Fire-and-forget nos writers.
 */
async function publicarSinalSync(seq) {
  const novo = seqValido(seq);
  if (!novo || !isRedisKvConfigured()) return { ok: false, seq: 0 };
  try {
    const redis = createRedisClient();
    const atual = await lerSinalSync();
    if (novo <= atual.seq) return { ok: true, seq: atual.seq, skipped: true };
    const pacote = { seq: novo, at: Date.now() };
    await redis.set(KEY, JSON.stringify(pacote));
    return { ok: true, seq: novo };
  } catch {
    return { ok: false, seq: 0 };
  }
}

function publicarSinalSyncQuiet(seq) {
  void publicarSinalSync(seq).catch(() => {});
}

module.exports = {
  KEY,
  lerSinalSync,
  publicarSinalSync,
  publicarSinalSyncQuiet,
  seqValido,
};
