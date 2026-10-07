/**
 * Lançamento de aluguel: uma linha pequena em public.dk_cloud_snapshots.
 * Não lê nem regrava o snapshot label=default.
 * Com o Supabase a responder, o pagamento fica na linha pequena e o Redis só faz cache.
 * Se o Supabase estourar o tempo ou devolver erro 5xx, o pagamento entra no snapshot
 * oficial do Redis e na fila, para o operador não perder o clique.
 */
const { isRedisKvConfigured, createRedisClient } = require("../lib/dk-redis-env.cjs");
const { CANONICAL_SNAPSHOT_KEY } = require("../lib/dk-locacoes-integrity.cjs");
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

function supabaseIndisponivel(reason) {
  const s = String(reason || "");
  return s === "supabase_timeout" || s.startsWith("supabase_http_5");
}

async function fetchSupabase(url, opts) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    return await fetch(url, { ...(opts || {}), signal: ctrl.signal });
  } catch (error) {
    const abortou = error && (error.name === "AbortError" || /abort/i.test(String(error.message || error)));
    const falha = new Error(abortou ? "supabase_timeout" : String(error && error.message ? error.message : error));
    falha.reason = abortou ? "supabase_timeout" : "supabase_timeout";
    throw falha;
  } finally {
    clearTimeout(timer);
  }
}

async function lerLinha(label) {
  if (!serviceRoleKey()) return { ok: false, reason: "doorman_key_missing", payload: null };
  if (!String(label).startsWith(PREFIXO)) return { ok: false, reason: "label_proibida", payload: null };
  let res;
  try {
    res = await fetchSupabase(urlSemDefault(`label=eq.${encodeURIComponent(label)}&select=label,payload,updated_at`), {
      headers: headersSupabase(),
    });
  } catch (error) {
    return { ok: false, reason: error.reason || "supabase_timeout", payload: null };
  }
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
  let res;
  try {
    res = await fetchSupabase(urlSemDefault("on_conflict=label"), {
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
  } catch (error) {
    return { ok: false, reason: error.reason || "supabase_timeout" };
  }
  if (!res.ok) return { ok: false, reason: `supabase_http_${res.status}` };
  return { ok: true };
}

async function listarLinhas(filtroLike, limite) {
  if (!serviceRoleKey()) return { ok: false, reason: "doorman_key_missing", rows: [] };
  const filtro = `label=like.${encodeURIComponent(filtroLike)}&select=label,payload,updated_at&order=updated_at.desc&limit=${Number(limite) || 200}`;
  let res;
  try {
    res = await fetchSupabase(urlSemDefault(filtro), { headers: headersSupabase() });
  } catch (error) {
    return { ok: false, reason: error.reason || "supabase_timeout", rows: [] };
  }
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

function lerSnapshot(raw) {
  if (!raw) return null;
  if (typeof raw === "object") return raw;
  try {
    const row = JSON.parse(raw);
    return row && typeof row === "object" ? row : null;
  } catch {
    return null;
  }
}

async function lerFilaRedis() {
  if (!isRedisKvConfigured()) return [];
  try {
    const redis = createRedisClient();
    return listaDeMapa(await redis.hgetall(FILA_KEY));
  } catch {
    return [];
  }
}

async function gravarPagamentoNoRedisOficial(item, protocolo) {
  if (!isRedisKvConfigured()) return { ok: false, reason: "kv_not_configured" };
  const redis = createRedisClient();
  const fila = await lerFilaRedis();
  const repetidoFila = fila.some((outro) => {
    if (!outro || String(outro?.pagamento?.protocoloLancamento || "") === protocolo) return false;
    return onlyDigits(outro.nc) === onlyDigits(item.nc) && mesmaCobranca(outro.pagamento, item.pagamento);
  });
  if (repetidoFila) return { ok: false, duplicado: true };
  const row = lerSnapshot(await redis.get(CANONICAL_SNAPSHOT_KEY));
  const payload = row && row.payload && typeof row.payload === "object" ? row.payload : null;
  const locs = Array.isArray(payload?.dk_locacoes_cadastro) ? payload.dk_locacoes_cadastro : null;
  if (locs) {
    const idx = locs.findIndex((loc) => onlyDigits(loc?.numeroContrato || loc?.protocolo) === onlyDigits(item.nc));
    if (idx >= 0) {
      const loc = locs[idx];
      const atuais = Array.isArray(loc.portalLancamentosAluguel) ? loc.portalLancamentosAluguel : [];
      const repetido = atuais.some((pag) => mesmaCobranca(pag, item.pagamento));
      if (repetido) return { ok: false, duplicado: true };
      locs[idx] = {
        ...loc,
        portalLancamentosAluguel: atuais.concat([item.pagamento]),
        updatedAt: Date.now(),
      };
      payload.dk_locacoes_cadastro = locs;
      await redis.set(
        CANONICAL_SNAPSHOT_KEY,
        JSON.stringify({ ...row, payload, updated_at: new Date().toISOString() })
      );
    }
  }
  await redis.hset(FILA_KEY, {
    [protocolo]: JSON.stringify({ ...item, supabasePendente: true }),
  });
  return { ok: true };
}

module.exports = async function handler(req, res) {
  if (!req.__dkCustoMedido) {
    req.__dkCustoMedido = true;
    const { comMedicaoCusto } = require("../lib/dk-custos-sistema.cjs");
    return comMedicaoCusto(req, res, () => handler(req, res));
  }
  applyApiCors(res);
  if (req.method === "OPTIONS") return res.status(204).end();

  if (await enforceRateLimit(req, res, "lancamento-nuvem", 60)) return;
  const gate = await requireLiveSession(req, { allowCliente: false, allowEquipa: true });
  if (!gate.ok) return res.status(gate.status).json({ ok: false, reason: gate.reason });

  try {
    if (req.method === "GET") {
      const porProto = new Map();
      for (const item of await lerFilaRedis()) {
        const proto = String(item?.pagamento?.protocoloLancamento || "").trim();
        if (proto) porProto.set(proto, item);
      }
      const lido = await listarLinhas(`${PREFIXO}*`, 300);
      if (!lido.ok) {
        if (!supabaseIndisponivel(lido.reason) || !porProto.size) {
          return res.status(503).json({ ok: false, reason: lido.reason || "supabase_indisponivel" });
        }
        return res.status(200).json({
          ok: true,
          success: true,
          fonte: "redis",
          supabasePendente: true,
          itens: Array.from(porProto.values()),
        });
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
      const responderRedis = async () => {
        const guardou = await gravarPagamentoNoRedisOficial(item, protocolo);
        if (guardou.duplicado) {
          return res.status(409).json({
            ok: false,
            success: false,
            reason: "duplicate_payment_same_day_value",
            protocolo: nc,
            message: "JÁ EXISTE UM PAGAMENTO IGUAL NESTE PROTOCOLO. O NOVO LANÇAMENTO NÃO FOI GRAVADO NA NUVEM.",
          });
        }
        if (!guardou.ok) {
          return res.status(503).json({ ok: false, success: false, reason: guardou.reason || "supabase_indisponivel" });
        }
        return res.status(200).json({
          ok: true,
          success: true,
          fonte: "redis",
          supabasePendente: true,
          protocolo,
          message: "Pagamento registrado no Redis oficial. O Supabase não respondeu a tempo.",
        });
      };
      const ja = await lerLinha(label);
      if (!ja.ok) {
        if (supabaseIndisponivel(ja.reason)) return responderRedis();
        return res.status(503).json({ ok: false, reason: ja.reason || "supabase_indisponivel" });
      }
      if (ja.payload && String(ja.payload.id || ja.payload?.pagamento?.protocoloLancamento || "") === protocolo) {
        await cacheRedis(itemDePayload(ja.payload) || item, protocolo);
        return res.status(200).json({ ok: true, success: true, fonte: "supabase", protocolo, idempotente: true });
      }
      const doContrato = await listarLinhas(`${PREFIXO}${nc}:*`, 400);
      if (!doContrato.ok) {
        if (supabaseIndisponivel(doContrato.reason)) return responderRedis();
        return res.status(503).json({ ok: false, reason: doContrato.reason || "supabase_indisponivel" });
      }
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
      if (!gravou.ok) {
        if (supabaseIndisponivel(gravou.reason)) return responderRedis();
        return res.status(503).json({ ok: false, success: false, reason: gravou.reason || "supabase_indisponivel" });
      }
      await cacheRedis(item, protocolo);
      return res.status(200).json({ ok: true, success: true, fonte: "supabase", protocolo });
    }
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e && e.message ? e.message : e) });
  }

  return res.status(405).json({ ok: false, reason: "method" });
};
