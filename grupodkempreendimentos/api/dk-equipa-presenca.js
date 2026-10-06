/**
 * Presença da equipa logada (PCs). Não grava cadastro de clientes.
 * POST { vivo: true|false } — pulso ou saída. CPF vem do token.
 * GET — lista CPF com pulso recente.
 */
const { isRedisKvConfigured, createRedisClient } = require("../lib/dk-redis-env.cjs");
const { executarGravacaoCentral, ioSnapshotOficial } = require("../lib/dk-persistencia-central.cjs");
const {
  applyApiCors,
  enforceRateLimit,
  requireLiveSession,
  onlyDigits,
  clearSessaoAtivaSeDona,
} = require("../lib/dk-portal-auth.cjs");

const REDIS_KEY = "dk:portal:equipa_presenca:v1";
const SNAPSHOT_FIELD = "dk_equipa_presenca_v1";
const MAX_AGE_MS = 8 * 60 * 1000;
const MAX_OPS = 40;

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
  if (!data || typeof data !== "object") return { byCpf: {} };
  if (!data.byCpf || typeof data.byCpf !== "object") return { byCpf: {} };
  return { byCpf: data.byCpf };
}

function pruneStore(store) {
  const now = Date.now();
  const byCpf = {};
  for (const [cpf, row] of Object.entries(store.byCpf || {})) {
    const key = onlyDigits(cpf).slice(0, 11);
    const at = Number(row?.at || 0);
    if (key.length !== 11 || at < now - MAX_AGE_MS) continue;
    byCpf[key] = { at, nome: String(row?.nome || "").trim() };
  }
  const ordered = Object.entries(byCpf)
    .sort((a, b) => Number(b[1].at || 0) - Number(a[1].at || 0))
    .slice(0, MAX_OPS);
  const kept = {};
  for (const [cpf, row] of ordered) kept[cpf] = row;
  return { byCpf: kept };
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

function aplicarEquipaPresenca(payload, entrada) {
  const store = pruneStore(parseStore(payload[SNAPSHOT_FIELD]));
  if (entrada.vivo) {
    store.byCpf[entrada.cpf] = {
      at: entrada.at,
      nome: String(entrada.nome || "").trim(),
    };
  } else {
    delete store.byCpf[entrada.cpf];
  }
  payload[SNAPSHOT_FIELD] = pruneStore(store);
  return payload;
}

async function lerEquipaPresencaComIo(io) {
  const atual = await io.ler();
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
  const store = pruneStore(parseStore(atual.payload && atual.payload[SNAPSHOT_FIELD]));
  return {
    status: 200,
    store,
    body: {
      ok: true,
      success: true,
      source: "supabase",
      revision: atual.updatedAt || null,
      updated_at: atual.updatedAt || null,
      ...listFromStore(store),
    },
  };
}

async function gravarEquipaPresencaComIo(io, entrada, cache) {
  const atual = await io.ler();
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
  const informado = String(entrada.baseRevision || "");
  return executarGravacaoCentral({
    ler: io.ler,
    gravar: io.gravar,
    cache,
    baseRevision: informado || atual.updatedAt || "",
    mutar(payload) {
      aplicarEquipaPresenca(payload, entrada);
    },
  });
}

async function cachePresencaRedis(store) {
  if (!isRedisKvConfigured()) throw new Error("redis_indisponivel");
  const redis = createRedisClient();
  await redis.set(REDIS_KEY, JSON.stringify(store));
}

function listFromStore(store) {
  const clean = pruneStore(store);
  const operadores = Object.entries(clean.byCpf)
    .map(([cpf, row]) => ({ cpf, at: Number(row?.at || 0), nome: String(row?.nome || "").trim() }))
    .sort((a, b) => a.cpf.localeCompare(b.cpf));
  return { operadores, cpfs: operadores.map((o) => o.cpf) };
}

module.exports = async function handler(req, res) {
  applyApiCors(res);
  res.setHeader("Content-Type", "application/json");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (await enforceRateLimit(req, res, "equipa-presenca", 40)) return;

  const gate = await requireLiveSession(req, { allowCliente: false, allowEquipa: true, allowService: false });
  if (!gate.ok) {
    return res.status(gate.status).json({ ok: false, reason: gate.reason });
  }

  const io = ioSnapshotOficial("default");

  try {
    if (req.method === "GET") {
      const lido = await lerEquipaPresencaComIo(io);
      if (lido.status === 200) {
        try {
          await cachePresencaRedis(lido.store);
        } catch (err) {
          console.error("[DK presenca] cache redis apos leitura", err && err.message ? err.message : err);
        }
      }
      return res.status(lido.status).json(lido.body);
    }

    if (req.method === "POST") {
      const cpf = onlyDigits(gate.cpf).slice(0, 11);
      if (cpf.length !== 11) {
        return res.status(400).json({ ok: false, success: false, reason: "cpf" });
      }
      const body = parseBody(req);
      const vivo = body.vivo !== false && body.vivo !== 0 && String(body.vivo || "true") !== "false";
      const central = await gravarEquipaPresencaComIo(
        io,
        {
          cpf,
          vivo,
          nome: gate.nome,
          at: Date.now(),
          baseRevision: body.base_revision || body.revision || "",
        },
        async (payload) => {
          await cachePresencaRedis(payload[SNAPSHOT_FIELD]);
        }
      );
      if (central.status !== 200) return res.status(central.status).json(central.body);
      if (!vivo) {
        try {
          await clearSessaoAtivaSeDona(cpf, gate.sid);
        } catch (err) {
          console.error("[DK presenca] limpar sessao apos supabase", err && err.message ? err.message : err);
        }
      }
      return res.status(200).json({ ...central.body, ...listFromStore(parseStore(central.payload && central.payload[SNAPSHOT_FIELD])) });
    }
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e && e.message ? e.message : e) });
  }

  return res.status(405).json({ ok: false, reason: "method" });
};

module.exports.aplicarEquipaPresenca = aplicarEquipaPresenca;
module.exports.lerEquipaPresencaComIo = lerEquipaPresencaComIo;
module.exports.gravarEquipaPresencaComIo = gravarEquipaPresencaComIo;
