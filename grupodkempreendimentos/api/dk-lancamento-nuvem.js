/**
 * Lançamento de aluguel: uma linha pequena em public.dk_cloud_snapshots.
 * Não lê nem regrava o snapshot label=default.
 * O pagamento só existe depois que o Supabase confirma. Redis é cache, depois.
 */
const { isRedisKvConfigured, createRedisClient } = require("../lib/dk-redis-env.cjs");
const { applyApiCors, enforceRateLimit, requireLiveSession } = require("../lib/dk-portal-auth.cjs");

const FILA_KEY = "dk:portal:lancamentos_fila:v1";
const PREFIXO = "entity:lancamento_aluguel:";
const LIMITE_BYTES = 65536;

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

function onlyDigits(v) {
  return String(v ?? "").replace(/\D/g, "");
}

function lerItem(raw) {
  if (!raw) return null;
  if (typeof raw === "object") return raw;
  try {
    const item = JSON.parse(raw);
    return item && typeof item === "object" ? item : null;
  } catch {
    return null;
  }
}

function listaDeMapa(all) {
  const itens = [];
  const mapa = all && typeof all === "object" ? all : {};
  for (const raw of Object.values(mapa)) {
    const item = lerItem(raw);
    if (item && item.pagamento) itens.push(item);
  }
  return itens;
}

function ehAluguel(pagamento) {
  const tipo = String(pagamento?.tipoMovimento || "")
    .trim()
    .toUpperCase();
  if (!tipo || tipo === "PAGAMENTO" || tipo === "ALUGUEL") return true;
  return !(tipo.includes("DEVOL") || tipo.includes("CREDIT") || tipo.includes("CAUC"));
}

function mesmaCobranca(a, b) {
  if (!ehAluguel(a) || !ehAluguel(b)) return false;
  const va = Number(a?.valor);
  const vb = Number(b?.valor);
  if (!Number.isFinite(va) || !Number.isFinite(vb) || va <= 0 || vb <= 0) return false;
  if (Math.round(va * 100) !== Math.round(vb * 100)) return false;
  const da = String(a?.data || a?.dataPagamento || "").trim();
  const db = String(b?.data || b?.dataPagamento || "").trim();
  return Boolean(da) && da === db;
}

function supabaseUrl() {
  return String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "https://ppxtwqvzgujllfzarpuz.supabase.co")
    .trim()
    .replace(/\/$/, "");
}

function serviceRoleKey() {
  return String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
}

function segmento(v, max) {
  return String(v || "")
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(0, max || 80);
}

function labelDoLancamento(nc, protocolo) {
  const contrato = onlyDigits(nc).slice(0, 20);
  const id = segmento(protocolo, 80);
  if (!contrato || !id) {
    const err = new Error("lancamento_incompleto");
    err.reason = "lancamento_incompleto";
    throw err;
  }
  const label = `${PREFIXO}${contrato}:${id}`;
  if (label === "default" || !label.startsWith(PREFIXO)) {
    const err = new Error("label_proibida");
    err.reason = "label_proibida";
    throw err;
  }
  return label;
}

function headersSupabase(extra) {
  const key = serviceRoleKey();
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    Accept: "application/json",
    ...extra,
  };
}

function urlSemDefault(filtro) {
  if (String(filtro).includes("eq.default") || String(filtro).includes("label=default")) {
    throw new Error("filtro_proibido");
  }
  return `${supabaseUrl()}/rest/v1/dk_cloud_snapshots?${filtro}`;
}

async function lerLinha(label) {
  if (!serviceRoleKey()) return { ok: false, reason: "doorman_key_missing", payload: null };
  if (!String(label).startsWith(PREFIXO)) return { ok: false, reason: "label_proibida", payload: null };
  const res = await fetch(urlSemDefault(`label=eq.${encodeURIComponent(label)}&select=label,payload,updated_at`), {
    headers: headersSupabase(),
  });
  if (!res.ok) {
    return { ok: false, reason: `supabase_http_${res.status}`, payload: null };
  }
  const rows = await res.json().catch(() => null);
  const row = Array.isArray(rows) && rows.length ? rows[0] : null;
  const payload = row && row.payload && typeof row.payload === "object" ? row.payload : null;
  return { ok: true, payload };
}

async function gravarLinha(label, payload) {
  if (!serviceRoleKey()) return { ok: false, reason: "doorman_key_missing" };
  if (!String(label).startsWith(PREFIXO) || label === "default") return { ok: false, reason: "label_proibida" };
  const bytes = Buffer.byteLength(JSON.stringify(payload));
  if (bytes > LIMITE_BYTES) return { ok: false, reason: "payload_grande" };
  const res = await fetch(urlSemDefault("on_conflict=label"), {
    method: "POST",
    headers: headersSupabase({
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal",
    }),
    body: JSON.stringify({
      label,
      payload,
      updated_at: String(payload.updated_at || new Date().toISOString()),
    }),
  });
  if (!res.ok) return { ok: false, reason: `supabase_http_${res.status}` };
  return { ok: true };
}

async function listarLinhas(filtroLike, limite) {
  if (!serviceRoleKey()) return { ok: false, reason: "doorman_key_missing", rows: [] };
  const filtro = `label=like.${encodeURIComponent(filtroLike)}&select=label,payload,updated_at&order=updated_at.desc&limit=${Number(limite) || 200}`;
  const res = await fetch(urlSemDefault(filtro), { headers: headersSupabase() });
  if (!res.ok) return { ok: false, reason: `supabase_http_${res.status}`, rows: [] };
  const rows = await res.json().catch(() => []);
  return { ok: true, rows: Array.isArray(rows) ? rows : [] };
}

function itemDePayload(payload) {
  if (!payload || typeof payload !== "object" || !payload.pagamento) return null;
  if (payload.deleted === true) return null;
  return {
    nc: onlyDigits(payload.nc),
    cpf: onlyDigits(payload.cpf).slice(0, 11),
    placa: String(payload.placa || "")
      .trim()
      .toUpperCase(),
    pagamento: payload.pagamento,
    at: payload.at || payload.updated_at || null,
  };
}

async function cacheRedis(item, protocolo) {
  if (!isRedisKvConfigured()) return;
  try {
    const redis = createRedisClient();
    await redis.hset(FILA_KEY, { [protocolo]: JSON.stringify(item) });
  } catch {
    /* Redis é cache. A linha já está no Supabase. */
  }
}

module.exports = async function handler(req, res) {
  applyApiCors(res);
  if (req.method === "OPTIONS") return res.status(204).end();

  if (await enforceRateLimit(req, res, "lancamento-nuvem", 60)) return;
  const gate = await requireLiveSession(req, { allowCliente: false, allowEquipa: true });
  if (!gate.ok) return res.status(gate.status).json({ ok: false, reason: gate.reason });

  try {
    if (req.method === "GET") {
      const lido = await listarLinhas(`${PREFIXO}*`, 300);
      if (!lido.ok) return res.status(503).json({ ok: false, reason: lido.reason || "supabase_indisponivel" });
      const porProto = new Map();
      if (isRedisKvConfigured()) {
        try {
          const redis = createRedisClient();
          for (const item of listaDeMapa(await redis.hgetall(FILA_KEY))) {
            const proto = String(item?.pagamento?.protocoloLancamento || "").trim();
            if (proto) porProto.set(proto, item);
          }
        } catch {
          /* cache ausente não esconde a linha do Supabase */
        }
      }
      for (const row of lido.rows) {
        if (!String(row?.label || "").startsWith(PREFIXO) || row.label === "default") continue;
        const item = itemDePayload(row.payload);
        const proto = String(item?.pagamento?.protocoloLancamento || "").trim();
        if (item && proto) porProto.set(proto, item);
      }
      return res.status(200).json({ ok: true, success: true, fonte: "supabase", itens: Array.from(porProto.values()) });
    }

    if (req.method === "POST") {
      const body = parseBody(req);
      const pagamento = body.pagamento;
      const protocolo = String(pagamento?.protocoloLancamento || "").trim();
      const nc = onlyDigits(body.numeroContrato || body.nc);
      if (!pagamento || typeof pagamento !== "object" || !protocolo || !nc) {
        return res.status(400).json({ ok: false, reason: "lancamento_incompleto" });
      }
      let label = "";
      try {
        label = labelDoLancamento(nc, protocolo);
      } catch (err) {
        return res.status(400).json({ ok: false, reason: (err && err.reason) || "lancamento_incompleto" });
      }
      const ja = await lerLinha(label);
      if (!ja.ok) return res.status(503).json({ ok: false, reason: ja.reason || "supabase_indisponivel" });
      const agora = new Date().toISOString();
      const item = {
        nc,
        cpf: onlyDigits(body.cpf).slice(0, 11),
        placa: String(body.placa || "")
          .trim()
          .toUpperCase(),
        pagamento,
        at: agora,
        id: protocolo,
        revision: 1,
        created_at: agora,
        updated_at: agora,
        deleted: false,
        deleted_at: null,
      };
      if (ja.payload && String(ja.payload.id || ja.payload?.pagamento?.protocoloLancamento || "") === protocolo) {
        await cacheRedis(itemDePayload(ja.payload) || item, protocolo);
        return res.status(200).json({ ok: true, success: true, fonte: "supabase", protocolo, idempotente: true });
      }
      const doContrato = await listarLinhas(`${PREFIXO}${nc}:*`, 400);
      if (!doContrato.ok) return res.status(503).json({ ok: false, reason: doContrato.reason || "supabase_indisponivel" });
      const repetido = doContrato.rows.some((row) => {
        const outro = itemDePayload(row && row.payload);
        if (!outro || String(row?.label || "") === label) return false;
        return onlyDigits(outro.nc) === nc && mesmaCobranca(outro.pagamento, pagamento);
      });
      if (repetido) {
        return res.status(409).json({
          ok: false,
          success: false,
          reason: "duplicate_payment_same_day_value",
          protocolo: nc,
          message: "JÁ EXISTE UM PAGAMENTO IGUAL NESTE PROTOCOLO. O NOVO LANÇAMENTO NÃO FOI GRAVADO NA NUVEM.",
        });
      }
      const gravou = await gravarLinha(label, item);
      if (!gravou.ok) return res.status(503).json({ ok: false, success: false, reason: gravou.reason || "supabase_indisponivel" });
      await cacheRedis(item, protocolo);
      return res.status(200).json({ ok: true, success: true, fonte: "supabase", protocolo });
    }
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e && e.message ? e.message : e) });
  }

  return res.status(405).json({ ok: false, reason: "method" });
};
