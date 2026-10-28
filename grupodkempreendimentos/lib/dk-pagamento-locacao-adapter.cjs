/**
 * Adaptador de leitura dos pagamentos de locação.
 * Fonte única: public.dk_pagamento_locacao.
 * Devolve o array histórico (payload). Não grava, não lê locação, snapshot, Redis, label nem localStorage.
 */
const { isSupabaseDoormanConfigured } = require("./dk-supabase-doorman.cjs");

const FONTE = "dk_pagamento_locacao";
const LEITURA_MS = 15000;
const CHUNK_CONTRATOS = 200;
const PAGE_SIZE = 1000;
const DEFAULT_URL = "https://ppxtwqvzgujllfzarpuz.supabase.co";
const CONTRATO_RE = /^[0-9A-Za-z][0-9A-Za-z-]{0,40}$/;

function supabaseUrl() {
  return String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || DEFAULT_URL)
    .trim()
    .replace(/\/$/, "");
}

function serviceRoleKey() {
  return String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
}

function contratoValido(numero) {
  return CONTRATO_RE.test(String(numero || "").trim());
}

function falha(status, reason) {
  const err = new Error(reason);
  err.ok = false;
  err.status = status;
  err.reason = reason;
  err.fallback = false;
  err.source = FONTE;
  return err;
}

async function rest(path, opts = {}) {
  if (!isSupabaseDoormanConfigured() && !opts.fetch) throw falha(503, "doorman_key_missing");
  const headers = {
    apikey: serviceRoleKey(),
    Authorization: `Bearer ${serviceRoleKey()}`,
    Accept: "application/json",
    Prefer: "count=exact",
    ...(opts.headers || {}),
  };
  const prazo = Number.isFinite(Number(opts.timeoutMs)) ? Number(opts.timeoutMs) : LEITURA_MS;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), prazo);
  const fetchImpl = opts.fetch || fetch;
  let res;
  try {
    res = await fetchImpl(`${supabaseUrl()}/rest/v1/${path}`, {
      method: "GET",
      headers,
      signal: ctrl.signal,
    });
  } catch (err) {
    if (ctrl.signal.aborted || (err && err.name === "AbortError")) throw falha(504, "supabase_timeout");
    throw falha(503, "supabase_indisponivel");
  } finally {
    clearTimeout(timer);
  }
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (!res.ok) throw falha(res.status || 503, "postgres_indisponivel");
  if (!Array.isArray(data)) throw falha(503, "postgres_indisponivel");
  const range = res.headers && typeof res.headers.get === "function" ? res.headers.get("content-range") : "";
  return { rows: data, contentRange: String(range || "") };
}

function marcarConsulta(opts) {
  if (opts && opts.stats && typeof opts.stats === "object") {
    opts.stats.queries = Number(opts.stats.queries || 0) + 1;
  }
}

function projetarPayload(row, removido) {
  const payload = row && row.payload;
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  if (!removido) return payload;
  const temRemovedAt = Object.prototype.hasOwnProperty.call(payload, "removedAt") && payload.removedAt != null && payload.removedAt !== "";
  if (temRemovedAt || !row.deleted_at) return payload;
  const ms = Date.parse(row.deleted_at);
  if (!Number.isFinite(ms)) return payload;
  return { ...payload, removedAt: String(ms) };
}

function projetarLinhas(rows, removido) {
  return (Array.isArray(rows) ? rows : [])
    .map((row) => projetarPayload(row, removido))
    .filter(Boolean);
}

function filtroContratos(lista) {
  return `numero_contrato=in.(${lista.map((n) => encodeURIComponent(n)).join(",")})`;
}

function caminho(lista, removido, offset) {
  const colunas = removido ? "payload,numero_contrato,source_position,deleted_at" : "payload,numero_contrato,source_position";
  const fim = offset + PAGE_SIZE - 1;
  return {
    path:
      `dk_pagamento_locacao?${filtroContratos(lista)}` +
      `&removido=eq.${removido ? "true" : "false"}` +
      `&select=${colunas}` +
      `&order=numero_contrato.asc,source_position.asc`,
    headers: { Range: `${offset}-${fim}` },
  };
}

function totalDoRange(contentRange, recebidas, offset) {
  const m = String(contentRange || "").match(/\/(\d+|\*)\s*$/);
  if (m && m[1] !== "*") return Number(m[1]);
  if (recebidas < PAGE_SIZE) return offset + recebidas;
  return null;
}

async function lerPaginas(lista, removido, opts) {
  const rows = [];
  let offset = 0;
  for (;;) {
    const req = caminho(lista, removido, offset);
    marcarConsulta(opts);
    const page = await rest(req.path, { ...opts, headers: req.headers });
    rows.push(...page.rows);
    const total = totalDoRange(page.contentRange, page.rows.length, offset);
    offset += page.rows.length;
    if (page.rows.length === 0 || (total != null && offset >= total)) break;
    if (page.rows.length < PAGE_SIZE && total == null) break;
  }
  return rows;
}

function normalizarLista(lista) {
  if (!Array.isArray(lista) || lista.length === 0) return [];
  const vistos = [];
  for (const item of lista) {
    const nc = String(item || "").trim();
    if (!contratoValido(nc)) throw falha(400, "contrato_obrigatorio");
    if (!vistos.includes(nc)) vistos.push(nc);
  }
  return vistos;
}

function agrupar(rows, contratos, removido) {
  const out = {};
  for (const nc of contratos) out[nc] = [];
  for (const row of rows) {
    const nc = String(row && row.numero_contrato ? row.numero_contrato : "").trim();
    if (!Object.prototype.hasOwnProperty.call(out, nc)) continue;
    const payload = projetarPayload(row, removido);
    if (payload) out[nc].push(payload);
  }
  return out;
}

async function obterPagamentosAtivos(numeroContrato, opts = {}) {
  const nc = String(numeroContrato || "").trim();
  if (!contratoValido(nc)) throw falha(400, "contrato_obrigatorio");
  const rows = await lerPaginas([nc], false, opts);
  return projetarLinhas(rows, false);
}

async function obterPagamentosRemovidos(numeroContrato, opts = {}) {
  const nc = String(numeroContrato || "").trim();
  if (!contratoValido(nc)) throw falha(400, "contrato_obrigatorio");
  const rows = await lerPaginas([nc], true, opts);
  return projetarLinhas(rows, true);
}

async function obterPorContratos(lista, removido, opts) {
  const contratos = normalizarLista(lista);
  if (!contratos.length) return {};
  const rows = [];
  for (let i = 0; i < contratos.length; i += CHUNK_CONTRATOS) {
    const fatia = contratos.slice(i, i + CHUNK_CONTRATOS);
    rows.push(...(await lerPaginas(fatia, removido, opts)));
  }
  return agrupar(rows, contratos, removido);
}

function obterPagamentosAtivosPorContratos(lista, opts) {
  return obterPorContratos(lista, false, opts);
}

function obterPagamentosRemovidosPorContratos(lista, opts) {
  return obterPorContratos(lista, true, opts);
}

module.exports = {
  FONTE,
  LEITURA_MS,
  CHUNK_CONTRATOS,
  PAGE_SIZE,
  projetarPayload,
  projetarLinhas,
  caminho,
  obterPagamentosAtivos,
  obterPagamentosRemovidos,
  obterPagamentosAtivosPorContratos,
  obterPagamentosRemovidosPorContratos,
};
