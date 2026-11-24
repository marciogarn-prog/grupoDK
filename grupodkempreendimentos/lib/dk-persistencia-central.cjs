/**
 * Persistência central do portal.
 * Redis é a nuvem principal (confirma a gravação). Supabase é espelho opcional.
 * Se o Supabase não responder (522, timeout, 5xx), o Redis assume e o pedido continua.
 */

function instante(valor) {
  const t = Date.parse(String(valor || "").trim());
  return Number.isFinite(t) ? t : 0;
}

function revisaoConflita(revisaoCliente, revisaoServidor) {
  const servidor = instante(revisaoServidor);
  if (!servidor) return false;
  const cliente = instante(revisaoCliente);
  if (!cliente) return true;
  return cliente < servidor;
}

function resultadoGravacao({ supabaseOk, redisOk }) {
  if (redisOk) {
    return {
      success: true,
      ok: true,
      persistencia: supabaseOk ? "supabase+redis" : "redis",
      http: 200,
      redisFalhou: false,
      supabasePendente: !supabaseOk,
    };
  }
  if (supabaseOk) {
    return {
      success: true,
      ok: true,
      persistencia: "supabase",
      http: 200,
      redisFalhou: true,
      supabasePendente: false,
    };
  }
  return { success: false, ok: false, persistencia: "nenhuma", http: 502, redisFalhou: true, supabasePendente: true };
}

function fonteDeAbertura(leituraCentralOk) {
  return leituraCentralOk ? "redis" : null;
}

function gravacaoSemCentralNaoConta(ok) {
  return ok !== true;
}

function motivoSupabaseIndisponivel(reason) {
  const r = String(reason || "");
  return (
    r === "supabase_timeout" ||
    r === "supabase_circuit_open" ||
    r === "doorman_key_missing" ||
    r === "cloud_budget" ||
    r === "supabase_indisponivel" ||
    r === "supabase_falhou" ||
    /^supabase_http_5\d\d$/.test(r)
  );
}

async function executarGravacaoCentral({ ler, gravar, cache, baseRevision, mutar, agora }) {
  const atual = await ler();
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
  const revisaoServidor = atual.updatedAt || null;
  if (revisaoConflita(baseRevision, revisaoServidor)) {
    return {
      status: 409,
      body: {
        ok: false,
        success: false,
        reason: "revisao_conflito",
        revision: revisaoServidor,
        updated_at: revisaoServidor,
        message: "A nuvem tem uma versão mais nova. Recarregue antes de gravar.",
      },
    };
  }
  const payload = atual.payload && typeof atual.payload === "object" ? { ...atual.payload } : {};
  if (typeof mutar === "function") mutar(payload);
  const updatedAt = typeof agora === "function" ? agora() : new Date().toISOString();

  let redisOk = true;
  let redisErr = "";
  if (typeof cache === "function") {
    try {
      await cache(payload, updatedAt);
    } catch (err) {
      redisOk = false;
      redisErr = String(err && err.message ? err.message : err);
    }
  } else {
    redisOk = false;
    redisErr = "redis_indisponivel";
  }

  let supabase = { ok: false, reason: "supabase_pendente" };
  try {
    supabase = await gravar(payload, updatedAt);
  } catch (err) {
    supabase = { ok: false, reason: String(err && err.message ? err.message : err) };
  }
  const supabaseOk = Boolean(supabase && supabase.ok === true);
  const decidido = resultadoGravacao({ supabaseOk, redisOk });
  if (!decidido.success) {
    return {
      status: decidido.http,
      body: {
        ok: false,
        success: false,
        reason: (supabase && supabase.reason) || redisErr || "nuvem_falhou",
        supabase: { ok: false, reason: (supabase && supabase.reason) || "supabase_falhou" },
        redis: { ok: false, reason: redisErr || "redis_indisponivel" },
      },
    };
  }
  return {
    status: decidido.http,
    payload,
    body: {
      ok: true,
      success: true,
      revision: updatedAt,
      updated_at: updatedAt,
      persistencia: decidido.persistencia,
      source: redisOk ? (supabaseOk ? "both" : "redis") : "supabase",
      supabase: supabaseOk
        ? { ok: true }
        : { ok: false, reason: (supabase && supabase.reason) || "supabase_pendente" },
      redis: redisOk ? { ok: true } : { ok: false, reason: redisErr },
      supabasePendente: decidido.supabasePendente === true,
      confirmed: redisOk || supabaseOk,
    },
  };
}

function ioSnapshotOficial(label) {
  const {
    fetchSnapshotByLabel,
    upsertSnapshotByLabel,
    withDoormanTimeout,
  } = require("./dk-supabase-doorman.cjs");
  const { isRedisKvConfigured, createRedisClient } = require("./dk-redis-env.cjs");
  const nome = label || "default";
  const redisKey = "dk:portal:cloud_snapshot:v1";

  async function lerDoRedis() {
    if (!isRedisKvConfigured()) return null;
    try {
      const redis = createRedisClient();
      const raw = await redis.get(redisKey);
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
      return { payload: row.payload, updatedAt: row.updated_at || null, via: "redis" };
    } catch {
      return null;
    }
  }

  return {
    ler: async () => {
      const row = await withDoormanTimeout(fetchSnapshotByLabel(nome), 8000, "supabase_timeout");
      const reason = row && row.reason ? String(row.reason) : "";
      if (
        !row ||
        motivoSupabaseIndisponivel(reason) ||
        reason.startsWith("supabase_http")
      ) {
        const cached = await lerDoRedis();
        if (cached) {
          return {
            payload: cached.payload,
            updatedAt: cached.updatedAt,
            supabasePendente: true,
            reason: reason || "supabase_indisponivel",
          };
        }
        return { indisponivel: true, reason: reason || "supabase_indisponivel" };
      }
      return { payload: row.payload, updatedAt: row.updatedAt || null };
    },
    gravar: (payload, updatedAt) =>
      withDoormanTimeout(upsertSnapshotByLabel(nome, payload, updatedAt), 2000, "supabase_timeout"),
  };
}

module.exports = {
  instante,
  revisaoConflita,
  resultadoGravacao,
  fonteDeAbertura,
  gravacaoSemCentralNaoConta,
  motivoSupabaseIndisponivel,
  executarGravacaoCentral,
  ioSnapshotOficial,
};
