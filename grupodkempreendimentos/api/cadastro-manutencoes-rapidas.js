/**
 * OS da manutenção rápida — canal próprio (não depende do snapshot gordo).
 * GET une Redis dedicado + array do snapshot. POST faz união append-only.
 */
const { isRedisKvConfigured, createRedisClient } = require("../lib/dk-redis-env.cjs");
const { mergeManutencoesRapidas } = require("../lib/dk-append-only-merge.cjs");
const { applyApiCors, enforceRateLimit, requireLiveSession, requireModuleAccess } = require("../lib/dk-portal-auth.cjs");
const { executarGravacaoCentral, ioSnapshotOficial } = require("../lib/dk-persistencia-central.cjs");
const { manutencaoRelacionalAtiva, atenderManutencaoRelacional } = require("../lib/dk-manutencao-rapida-pg.cjs");
const { diskIoSafeModeAtivo, devePularGravacaoManutencaoAutomatica } = require("../lib/dk-disk-io-safe-mode.cjs");

const STORAGE_KEY = "dk:portal:manutencoes_rapidas:v1";
const REDIS_SNAPSHOT_KEY = "dk:portal:cloud_snapshot:v1";

function parseRedisArray(raw) {
  if (raw == null) return [];
  if (typeof raw === "string") {
    try {
      const p = JSON.parse(raw);
      return Array.isArray(p) ? p : [];
    } catch {
      return [];
    }
  }
  return Array.isArray(raw) ? raw : [];
}

function parseSnapshotManutencoes(raw) {
  if (raw == null) return [];
  let row = raw;
  if (typeof raw === "string") {
    try {
      row = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  const payload = row?.payload && typeof row.payload === "object" ? row.payload : row;
  return Array.isArray(payload?.dk_manutencoes_rapidas_v1) ? payload.dk_manutencoes_rapidas_v1 : [];
}

function corpoGetManutencaoRelacional(data, revision) {
  const rev = revision || null;
  return {
    ok: true,
    success: true,
    data: Array.isArray(data) ? data : [],
    source: "supabase",
    revision: rev,
    updated_at: rev,
  };
}

function corpoPostManutencaoRelacional(data, revision, redisOk, redisErr) {
  const lista = Array.isArray(data) ? data : [];
  const rev = revision || null;
  return {
    ok: true,
    success: true,
    revision: rev,
    updated_at: rev,
    persistencia: redisOk ? "supabase+redis" : "supabase",
    source: "supabase",
    supabase: { ok: true },
    redis: { ok: Boolean(redisOk), reason: redisErr || "" },
    count: lista.length,
    data: lista,
  };
}

async function loadUniao(redis) {
  const [rawSnap, rawDed] = await Promise.all([redis.get(REDIS_SNAPSHOT_KEY), redis.get(STORAGE_KEY)]);
  return mergeManutencoesRapidas(parseSnapshotManutencoes(rawSnap), parseRedisArray(rawDed));
}

module.exports = async function handler(req, res) {
  applyApiCors(res);

  if (req.method === "OPTIONS") return res.status(204).end();
  if (await enforceRateLimit(req, res, "cadastro-manutencoes-rapidas", 40)) return;

  const gate = await requireLiveSession(req, { allowCliente: false, allowEquipa: true });
  if (!gate.ok) {
    return res.status(gate.status).json({ ok: false, reason: gate.reason });
  }

  if (!isRedisKvConfigured()) {
    return res.status(503).json({ ok: false, reason: "kv_not_configured" });
  }

  const redis = createRedisClient();

  try {
    if (req.method === "GET") {
      if (manutencaoRelacionalAtiva()) {
        const rel = await atenderManutencaoRelacional(
          { method: "GET" },
          {
            lerOrigem: () => ioSnapshotOficial("default").ler(),
            lerRedis: async () => parseRedisArray(await redis.get(STORAGE_KEY)),
          }
        );
        if (!rel.fallback) {
          if (rel.status !== 200) return res.status(rel.status).json(rel.body);
          return res.status(200).json(corpoGetManutencaoRelacional(rel.data, rel.revision));
        }
      }
      const central = await ioSnapshotOficial("default").ler();
      if (central.indisponivel) {
        return res.status(503).json({ ok: false, success: false, reason: central.reason || "supabase_indisponivel" });
      }
      const daNuvem = Array.isArray(central.payload?.dk_manutencoes_rapidas_v1)
        ? central.payload.dk_manutencoes_rapidas_v1
        : [];
      let dedicada = [];
      try {
        dedicada = parseRedisArray(await redis.get(STORAGE_KEY));
      } catch {
        dedicada = [];
      }
      const data = mergeManutencoesRapidas(daNuvem, dedicada);
      return res.status(200).json({
        ok: true,
        success: true,
        data,
        source: "supabase",
        revision: central.updatedAt || null,
        updated_at: central.updatedAt || null,
      });
    }

    if (req.method === "POST") {
      let writeGate = await requireModuleAccess(req, "manutencao");
      if (!writeGate.ok) writeGate = await requireModuleAccess(req, "lancamentoManutencao");
      if (!writeGate.ok) {
        return res.status(writeGate.status).json({ ok: false, reason: writeGate.reason, modulo: writeGate.modulo });
      }
      let body = req.body;
      if (typeof body === "string") {
        try {
          body = JSON.parse(body);
        } catch {
          body = {};
        }
      }
      const incoming = Array.isArray(body?.data) ? body.data : [];
      const automatico = body?.automatico === true;
      if (diskIoSafeModeAtivo() && automatico) {
        try {
          const leitura = await ioSnapshotOficial("default").ler();
          if (leitura && !leitura.indisponivel) {
            const base = Array.isArray(leitura.payload?.dk_manutencoes_rapidas_v1)
              ? leitura.payload.dk_manutencoes_rapidas_v1
              : [];
            if (
              devePularGravacaoManutencaoAutomatica({
                safeMode: true,
                automatico: true,
                base,
                incoming,
                merge: mergeManutencoesRapidas,
              })
            ) {
              const rev = leitura.updatedAt || null;
              return res.status(200).json({
                ok: true,
                success: true,
                revision: rev,
                updated_at: rev,
                persistencia: "supabase",
                source: "supabase",
                supabase: { ok: true },
                redis: { ok: true, reason: "" },
                count: base.length,
                data: base,
                inalterado: true,
              });
            }
          }
        } catch (err) {
          console.error("[DK manutencao] comparacao do modo seguro", err && err.message ? err.message : err);
        }
      }
      if (manutencaoRelacionalAtiva()) {
        const rel = await atenderManutencaoRelacional(
          { method: "POST", incoming },
          {
            lerOrigem: () => ioSnapshotOficial("default").ler(),
            lerRedis: async () => parseRedisArray(await redis.get(STORAGE_KEY)),
          }
        );
        if (!rel.fallback) {
          if (rel.status !== 200) return res.status(rel.status).json(rel.body);
          let redisOk = true;
          let redisErr = "";
          if (rel.gravou) {
            try {
              await redis.set(STORAGE_KEY, JSON.stringify(rel.data));
            } catch (err) {
              redisOk = false;
              redisErr = String(err && err.message ? err.message : err);
            }
          }
          return res.status(200).json(corpoPostManutencaoRelacional(rel.data, rel.revision, redisOk, redisErr));
        }
      }
      let merged = incoming;
      const central = await executarGravacaoCentral({
        ...ioSnapshotOficial("default"),
        baseRevision: body.base_revision || body.revision || "",
        mutar(payload) {
          const base = Array.isArray(payload.dk_manutencoes_rapidas_v1) ? payload.dk_manutencoes_rapidas_v1 : [];
          merged = mergeManutencoesRapidas(base, incoming);
          payload.dk_manutencoes_rapidas_v1 = merged;
        },
        cache: async () => {
          await redis.set(STORAGE_KEY, JSON.stringify(merged));
        },
      });
      if (central.status !== 200) return res.status(central.status).json(central.body);
      return res.status(200).json({ ...central.body, count: merged.length, data: merged });
    }
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e && e.message ? e.message : e) });
  }

  return res.status(405).json({ ok: false, reason: "method" });
};

module.exports.corpoGetManutencaoRelacional = corpoGetManutencaoRelacional;
module.exports.corpoPostManutencaoRelacional = corpoPostManutencaoRelacional;
