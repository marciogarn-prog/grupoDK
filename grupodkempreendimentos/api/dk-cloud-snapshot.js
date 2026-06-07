/**
 * Snapshot completo DK (localStorage) — cópia redundante em Upstash Redis.
 * Quando Supabase falhar, o portal usa GET/POST nesta API.
 *
 * Variáveis Vercel: UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN
 *
 * GET  /api/dk-cloud-snapshot → { ok, payload, updated_at, source: "redis" }
 * POST /api/dk-cloud-snapshot → body { payload, updated_at? }
 */
const { isRedisKvConfigured, createRedisClient } = require("../lib/dk-redis-env.cjs");

const OFICIAL_GUARD_KEYS = [
  "dk_clientes_cadastro",
  "dk_portal_clientes_cadastro",
  "dk_veiculos_cadastro",
  "dk_portal_veiculos_cadastro",
  "dk_veiculos_frota_planilha",
  "dk_locacoes_cadastro",
  "dk_lancamentos_aluguel",
  "dk_lancamentos_aluguel_cadastro",
];

function oficialTodayYmd() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

function oficialParseYmd(value) {
  if (value == null || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) {
      return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(d);
    }
    return null;
  }
  const s = String(value).trim();
  const br = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const ms = Date.parse(s);
  if (Number.isFinite(ms)) {
    return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date(ms));
  }
  return null;
}

function oficialRecordYmd(record, key) {
  if (!record || typeof record !== "object") return null;
  const fields =
    String(key).includes("locacoes")
      ? ["dataCadastro", "createdAt", "updatedAt", "inicio", "dataInicio"]
      : String(key).includes("lancamento")
        ? ["dataCadastro", "data", "dataPagamento", "dataLancamento", "createdAt"]
        : ["dataCadastro", "createdAt", "updatedAt"];
  for (const f of fields) {
    const ymd = oficialParseYmd(record[f]);
    if (ymd) return ymd;
  }
  return null;
}

function sanitizePayloadForOficial(payload, cutoffYmd = oficialTodayYmd()) {
  if (!payload || typeof payload !== "object") return payload;
  const out = { ...payload };
  for (const k of OFICIAL_GUARD_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(out, k) || !Array.isArray(out[k])) continue;
    out[k] = out[k].filter((r) => {
      const ymd = oficialRecordYmd(r, k);
      return ymd && ymd >= cutoffYmd;
    });
  }
  out.dk_oficial_cadastro_guard_v1 = cutoffYmd;
  return out;
}

const REDIS_KEYS = {
  default: "dk:portal:cloud_snapshot:v1",
  demo: "dk:portal:cloud_snapshot:demo:v1",
};

function resolveDeployChannel(req) {
  const q = String(req.query?.channel || "").trim().toLowerCase();
  if (q === "demo") return "demo";
  const hdr = String(req.headers["x-dk-deploy-channel"] || "").trim().toLowerCase();
  if (hdr === "demo") return "demo";
  const origin = String(req.headers.origin || req.headers.referer || "");
  if (/demo\.grupodkempreendimentos\.com\.br/i.test(origin)) return "demo";
  if (/^https?:\/\/demo\./i.test(origin)) return "demo";
  const env = String(process.env.DK_DEPLOY_CHANNEL || "").trim().toLowerCase();
  if (env === "demo") return "demo";
  return "default";
}

function redisKeyForChannel(channel) {
  return channel === "demo" ? REDIS_KEYS.demo : REDIS_KEYS.default;
}

function labelForChannel(channel) {
  return channel === "demo" ? "demo" : "default";
}
const CADASTRO_KEYS = [
  "dk_clientes_cadastro",
  "dk_portal_clientes_cadastro",
  "dk_veiculos_cadastro",
  "dk_portal_veiculos_cadastro",
  "dk_veiculos_frota_planilha",
  "dk_locacoes_cadastro",
  "dk_lancamentos_aluguel",
  "dk_lancamentos_aluguel_cadastro",
];

function applyCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
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

function isObject(v) {
  return v && typeof v === "object" && !Array.isArray(v);
}

/** Pontuação de merge: invalidado pelo admin e recusas manuais vencem «confirmado» antigo na nuvem. */
function comprovanteClienteMergeScore(r) {
  if (!r || typeof r !== "object") return 0;
  if (r.pagamentoInvalidado) {
    return 1e20 + (Date.parse(r.pagamentoInvalidadoEm || r.rejeitadoEm || 0) || 0);
  }
  const st = String(r.status || "").trim();
  if (st === "rejeitado" && r.rejeitadoAutomatico === false) {
    return 5e16 + (Date.parse(r.rejeitadoEm || 0) || 0);
  }
  const rank = { confirmado: 4, ia_validado: 3, pendente: 2, rejeitado: 1 };
  const base = rank[st] || 0;
  return base * 1e15 + (Date.parse(r.enviadoEm || 0) || 0);
}

/** Merge mínimo de comprovantes (mesma ideia do portal). */
function mergeComprovantesClientePendentes(localArr, cloudArr) {
  const byId = new Map();
  const push = (r) => {
    if (!r || typeof r !== "object" || !r.id) return;
    const prev = byId.get(r.id);
    if (!prev) {
      byId.set(r.id, r);
      return;
    }
    const rp = comprovanteClienteMergeScore(r);
    const pp = comprovanteClienteMergeScore(prev);
    if (rp > pp) byId.set(r.id, r);
    else if (rp === pp) {
      const te = Date.parse(r.enviadoEm || 0) || 0;
      const tp = Date.parse(prev.enviadoEm || 0) || 0;
      if (te >= tp) byId.set(r.id, r);
    }
  };
  (Array.isArray(localArr) ? localArr : []).forEach(push);
  (Array.isArray(cloudArr) ? cloudArr : []).forEach(push);
  return Array.from(byId.values()).sort(
    (a, b) => (Date.parse(b.enviadoEm || 0) || 0) - (Date.parse(a.enviadoEm || 0) || 0)
  );
}

function mergeFotosCapturasExcluidas(...listas) {
  const map = new Map();
  for (const lista of listas) {
    for (const item of lista || []) {
      const id = String(item?.id || item || "").trim();
      if (!id) continue;
      const excluidoEm = String(item?.excluidoEm || new Date().toISOString());
      const tag = String(item?.tag || "").trim() || undefined;
      const prev = map.get(id);
      if (!prev || Date.parse(excluidoEm) >= Date.parse(prev.excluidoEm || 0)) {
        map.set(id, { id, tag, excluidoEm });
      }
    }
  }
  return [...map.values()].slice(-600);
}

function aplicarExclusoesFotosCapturas(fotos, exclusoes) {
  const ids = new Set();
  const tags = new Set();
  for (const e of exclusoes || []) {
    const id = String(e?.id || "").trim();
    if (id) ids.add(id);
    const tag = String(e?.tag || "").trim();
    if (tag) tags.add(tag);
  }
  return (Array.isArray(fotos) ? fotos : []).filter((f) => {
    if (!f?.id) return false;
    if (ids.has(f.id)) return false;
    const tag = String(f.tag || "").trim();
    if (tag && tags.has(tag)) return false;
    return true;
  });
}

function parsePatrimonioStore(raw) {
  if (!raw) return { documentos: [], fotosCapturas: [], fotosCapturasExcluidas: [] };
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw);
    } catch {
      return { documentos: [], fotosCapturas: [], fotosCapturasExcluidas: [] };
    }
  }
  if (Array.isArray(raw?.documentos)) {
    return {
      documentos: raw.documentos,
      fotosCapturas: raw.fotosCapturas || [],
      fotosCapturasExcluidas: raw.fotosCapturasExcluidas || [],
    };
  }
  if (Array.isArray(raw)) return { documentos: raw, fotosCapturas: [], fotosCapturasExcluidas: [] };
  return { documentos: [], fotosCapturas: [], fotosCapturasExcluidas: [] };
}

function mergePatrimonioCrlvRedis(existing, incoming, exStandalone) {
  const e = parsePatrimonioStore(existing);
  const i = parsePatrimonioStore(incoming);
  const exclusoes = mergeFotosCapturasExcluidas(
    e.fotosCapturasExcluidas,
    i.fotosCapturasExcluidas,
    Array.isArray(exStandalone) ? exStandalone : []
  );
  const byId = new Map();
  for (const f of [...(e.fotosCapturas || []), ...(i.fotosCapturas || [])]) {
    if (!f || typeof f !== "object") continue;
    const id = String(f.id || "").trim();
    if (!id) continue;
    byId.set(id, f);
  }
  let fotosCapturas = aplicarExclusoesFotosCapturas([...byId.values()], exclusoes);
  fotosCapturas.sort(
    (a, b) =>
      (Date.parse(b.registradoEm || b.atualizadoEm || "") || 0) -
      (Date.parse(a.registradoEm || a.atualizadoEm || "") || 0)
  );
  return {
    documentos: i.documentos?.length ? i.documentos : e.documentos,
    fotosCapturas,
    fotosCapturasExcluidas: exclusoes,
  };
}

function stripInternalPayloadKeys(payload) {
  if (!isObject(payload)) return payload;
  const out = { ...payload };
  delete out._dkFullReplaceKeys;
  return out;
}

/** União por número de protocolo — evita apagar contratos do portal (ex. 2026010104) em push parcial. */
function applyCadastroLock(existing, incoming) {
  if (!isObject(existing) || !isObject(incoming)) return incoming;
  const lockUntil = Date.parse(String(existing.dk_cadastro_lock_v1 || "")) || 0;
  if (!lockUntil || Date.now() >= lockUntil) return incoming;
  const out = { ...incoming };
  for (const k of CADASTRO_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(incoming, k)) continue;
    const inc = incoming[k];
    const ex = existing[k];
    if (!Array.isArray(inc) || !Array.isArray(ex)) continue;
    if (inc.length > ex.length) out[k] = ex;
  }
  return out;
}

function mergeLocacoesCadastroArrays(existingArr, incomingArr) {
  const byNc = new Map();
  const normNc = (v) =>
    String(v ?? "")
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "");
  const add = (loc) => {
    if (!loc || typeof loc !== "object") return;
    const nc = normNc(loc.numeroContrato);
    if (!nc) return;
    const prev = byNc.get(nc);
    if (!prev) {
      byNc.set(nc, { ...loc });
      return;
    }
    byNc.set(nc, {
      ...prev,
      ...loc,
      numeroContrato: prev.numeroContrato || loc.numeroContrato,
    });
  };
  (Array.isArray(existingArr) ? existingArr : []).forEach(add);
  (Array.isArray(incomingArr) ? incomingArr : []).forEach(add);
  return Array.from(byNc.values());
}

function mergePayloads(existing, incoming) {
  if (!isObject(existing)) return stripInternalPayloadKeys(incoming);
  if (!isObject(incoming)) return existing;
  const fullReplaceKeys = Array.isArray(incoming._dkFullReplaceKeys)
    ? incoming._dkFullReplaceKeys.filter((k) => typeof k === "string")
    : [];
  const out = { ...existing, ...incoming };
  if (
    Object.prototype.hasOwnProperty.call(incoming, "dk_locacoes_cadastro") ||
    Object.prototype.hasOwnProperty.call(existing, "dk_locacoes_cadastro")
  ) {
    out.dk_locacoes_cadastro = mergeLocacoesCadastroArrays(
      existing.dk_locacoes_cadastro,
      incoming.dk_locacoes_cadastro
    );
  }
  for (const k of fullReplaceKeys) {
    if (!Object.prototype.hasOwnProperty.call(incoming, k)) continue;
    if (k === "dk_locacoes_cadastro") continue;
    out[k] = incoming[k];
  }
  if (
    !fullReplaceKeys.includes("dk_comprovantes_cliente_pendentes") &&
    (Object.prototype.hasOwnProperty.call(incoming, "dk_comprovantes_cliente_pendentes") ||
      Object.prototype.hasOwnProperty.call(existing, "dk_comprovantes_cliente_pendentes"))
  ) {
    out.dk_comprovantes_cliente_pendentes = mergeComprovantesClientePendentes(
      existing.dk_comprovantes_cliente_pendentes,
      incoming.dk_comprovantes_cliente_pendentes
    );
  }
  if (
    Object.prototype.hasOwnProperty.call(incoming, "dk_patrimonio_crlv_v1") ||
    Object.prototype.hasOwnProperty.call(existing, "dk_patrimonio_crlv_v1")
  ) {
    out.dk_patrimonio_crlv_v1 = mergePatrimonioCrlvRedis(
      existing.dk_patrimonio_crlv_v1,
      incoming.dk_patrimonio_crlv_v1,
      incoming.dk_patrimonio_fotos_excluidas_v1 || existing.dk_patrimonio_fotos_excluidas_v1
    );
    out.dk_patrimonio_fotos_excluidas_v1 = out.dk_patrimonio_crlv_v1.fotosCapturasExcluidas || [];
  } else if (
    Object.prototype.hasOwnProperty.call(incoming, "dk_patrimonio_fotos_excluidas_v1") ||
    Object.prototype.hasOwnProperty.call(existing, "dk_patrimonio_fotos_excluidas_v1")
  ) {
    out.dk_patrimonio_fotos_excluidas_v1 = mergeFotosCapturasExcluidas(
      existing.dk_patrimonio_fotos_excluidas_v1,
      incoming.dk_patrimonio_fotos_excluidas_v1
    );
  }
  return stripInternalPayloadKeys(out);
}

module.exports = async function handler(req, res) {
  applyCors(res);
  res.setHeader("Content-Type", "application/json");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (!isRedisKvConfigured()) {
    return res.status(503).json({ ok: false, reason: "kv_not_configured" });
  }

  const redis = createRedisClient();
  const channel = resolveDeployChannel(req);
  const REDIS_KEY = redisKeyForChannel(channel);
  const LABEL = labelForChannel(channel);

  try {
    if (req.method === "GET") {
      const raw = await redis.get(REDIS_KEY);
      if (!raw) {
        return res.status(200).json({
          ok: true,
          label: LABEL,
          payload: null,
          updated_at: null,
          source: "redis",
        });
      }
      let row = raw;
      if (typeof raw === "string") {
        try {
          row = JSON.parse(raw);
        } catch {
          return res.status(500).json({ ok: false, reason: "invalid_stored_json" });
        }
      }
      const payload = row?.payload && typeof row.payload === "object" ? row.payload : null;
      const safePayload =
        channel === "default" && payload ? sanitizePayloadForOficial(payload) : payload;
      return res.status(200).json({
        ok: true,
        label: LABEL,
        payload: safePayload,
        updated_at: row?.updated_at || null,
        source: "redis",
      });
    }

    if (req.method === "POST") {
      const body = parseBody(req);
      let incoming = body.payload;
      if (!isObject(incoming)) {
        return res.status(400).json({ ok: false, reason: "payload_required" });
      }
      if (channel === "default") {
        incoming = sanitizePayloadForOficial(incoming);
      }
      const updatedAt = String(body.updated_at || new Date().toISOString());
      const existingRaw = await redis.get(REDIS_KEY);
      let existingPayload = null;
      if (existingRaw) {
        let row = existingRaw;
        if (typeof existingRaw === "string") {
          try {
            row = JSON.parse(existingRaw);
          } catch {
            row = null;
          }
        }
        if (row?.payload && typeof row.payload === "object") existingPayload = row.payload;
      }
      const replace = body.replace === true || body.mode === "replace";
      const wipeKeys = Array.isArray(body.wipe_keys)
        ? body.wipe_keys.filter((k) => typeof k === "string")
        : [];
      let payload;
      if (wipeKeys.length) {
        payload = existingPayload ? { ...existingPayload, ...incoming } : { ...incoming };
        for (const k of wipeKeys) {
          payload[k] = Object.prototype.hasOwnProperty.call(incoming, k) ? incoming[k] : [];
        }
        if (channel === "default") {
          payload.dk_cadastro_manual_portal_v1 = true;
          payload.dk_cadastro_lock_v1 = new Date(Date.now() + 20 * 60 * 1000).toISOString();
        } else {
          delete payload.dk_cadastro_manual_portal_v1;
          delete payload.dk_cadastro_lock_v1;
        }
        payload = stripInternalPayloadKeys(payload);
      } else {
        const lockedIncoming = existingPayload
          ? applyCadastroLock(existingPayload, incoming)
          : incoming;
        payload = existingPayload
          ? mergePayloads(existingPayload, lockedIncoming)
          : stripInternalPayloadKeys(lockedIncoming);
      }
      if (channel === "default") {
        payload = sanitizePayloadForOficial(payload);
      }
      const stored = { label: LABEL, payload, updated_at: updatedAt };
      await redis.set(REDIS_KEY, JSON.stringify(stored));
      return res.status(200).json({
        ok: true,
        label: LABEL,
        updated_at: updatedAt,
        source: "redis",
        replace,
        keys: Object.keys(payload).length,
      });
    }
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: String(e && e.message ? e.message : e),
    });
  }

  return res.status(405).json({ ok: false, reason: "method" });
};
