/**
 * Persistência central do portal.
 * Supabase confirma a gravação. Redis, se existir, só corre depois e não decide o sucesso.
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
  if (!supabaseOk) {
    return { success: false, ok: false, persistencia: "nenhuma", http: 502, redisFalhou: false };
  }
  return {
    success: true,
    ok: true,
    persistencia: redisOk ? "supabase+redis" : "supabase",
    http: 200,
    redisFalhou: !redisOk,
  };
}

function fonteDeAbertura(leituraCentralOk) {
  return leituraCentralOk ? "supabase" : null;
}

function gravacaoSemCentralNaoConta(supabaseOk) {
  return supabaseOk !== true;
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
  let supabase;
  try {
    supabase = await gravar(payload, updatedAt);
  } catch (err) {
    supabase = { ok: false, reason: String(err && err.message ? err.message : err) };
  }
  if (!supabase || supabase.ok !== true) {
    return {
      status: 502,
      body: {
        ok: false,
        success: false,
        reason: (supabase && supabase.reason) || "supabase_falhou",
        supabase: { ok: false, reason: (supabase && supabase.reason) || "supabase_falhou" },
      },
    };
  }
  let redisOk = true;
  let redisErr = "";
  if (typeof cache === "function") {
    try {
      await cache(payload, updatedAt);
    } catch (err) {
      redisOk = false;
      redisErr = String(err && err.message ? err.message : err);
    }
  }
  const decidido = resultadoGravacao({ supabaseOk: true, redisOk });
  return {
    status: decidido.http,
    payload,
    body: {
      ok: true,
      success: true,
      revision: updatedAt,
      updated_at: updatedAt,
      persistencia: decidido.persistencia,
      source: "supabase",
      supabase: { ok: true },
      redis: { ok: redisOk, reason: redisErr },
    },
  };
}

function ioSnapshotOficial(label) {
  const { fetchSnapshotByLabel, upsertSnapshotByLabel, withDoormanTimeout } = require("./dk-supabase-doorman.cjs");
  const nome = label || "default";
  return {
    ler: async () => {
      const row = await withDoormanTimeout(fetchSnapshotByLabel(nome), 20000, "supabase_timeout");
      const reason = row && row.reason ? String(row.reason) : "";
      if (
        !row ||
        reason === "supabase_timeout" ||
        reason === "doorman_key_missing" ||
        reason === "cloud_budget" ||
        reason.startsWith("supabase_http")
      ) {
        return { indisponivel: true, reason: reason || "supabase_indisponivel" };
      }
      return { payload: row.payload, updatedAt: row.updatedAt || null };
    },
    gravar: (payload, updatedAt) =>
      withDoormanTimeout(upsertSnapshotByLabel(nome, payload, updatedAt), 20000, "supabase_timeout"),
  };
}

module.exports = {
  instante,
  revisaoConflita,
  resultadoGravacao,
  fonteDeAbertura,
  gravacaoSemCentralNaoConta,
  executarGravacaoCentral,
  ioSnapshotOficial,
};
