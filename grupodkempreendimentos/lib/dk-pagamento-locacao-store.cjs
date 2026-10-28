/**
 * Leitura fracionada dos pagamentos de um contrato.
 * Só consulta public.dk_pagamento_locacao. Não há fallback.
 */
const { isSupabaseDoormanConfigured } = require("./dk-supabase-doorman.cjs");

const FONTE = "dk_pagamento_locacao";
const LEITURA_MS = 15000;
const DEFAULT_URL = "https://ppxtwqvzgujllfzarpuz.supabase.co";

function supabaseUrl() {
  return String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || DEFAULT_URL)
    .trim()
    .replace(/\/$/, "");
}

function serviceRoleKey() {
  return String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
}

function contratoValido(numero) {
  return /^[0-9A-Za-z][0-9A-Za-z-]{0,40}$/.test(String(numero || "").trim());
}

async function rest(path, opts = {}) {
  if (!isSupabaseDoormanConfigured() && !opts.fetch) {
    return { ok: false, status: 503, data: { reason: "doorman_key_missing" } };
  }
  const headers = {
    apikey: serviceRoleKey(),
    Authorization: `Bearer ${serviceRoleKey()}`,
    Accept: "application/json",
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
    if (ctrl.signal.aborted || (err && err.name === "AbortError")) {
      return { ok: false, status: 504, data: { reason: "supabase_timeout" } };
    }
    return { ok: false, status: 503, data: { reason: "supabase_indisponivel" } };
  } finally {
    clearTimeout(timer);
  }
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  return { ok: res.ok, status: res.status, data };
}

function caminho(numeroContrato, removido) {
  const nc = encodeURIComponent(String(numeroContrato).trim());
  return `dk_pagamento_locacao?numero_contrato=eq.${nc}&removido=eq.${removido ? "true" : "false"}&select=payload,source_position&order=source_position.asc`;
}

async function ler(numeroContrato, removido, opts) {
  const nc = String(numeroContrato || "").trim();
  if (!contratoValido(nc)) {
    return { ok: false, status: 400, reason: "contrato_obrigatorio", source: FONTE, fallback: false };
  }
  const res = await rest(caminho(nc, removido), opts);
  if (!res.ok) {
    return {
      ok: false,
      status: res.status || 503,
      reason: (res.data && res.data.reason) || "postgres_indisponivel",
      source: FONTE,
      fallback: false,
      numeroContrato: nc,
    };
  }
  const rows = Array.isArray(res.data) ? res.data : [];
  const pagamentos = rows.map((row) => (row && row.payload && typeof row.payload === "object" ? row.payload : null)).filter(Boolean);
  return {
    ok: true,
    status: 200,
    source: FONTE,
    numeroContrato: nc,
    removido: Boolean(removido),
    pagamentos,
    quantidade: pagamentos.length,
    fallback: false,
  };
}

function listarPorContrato(numeroContrato, opts) {
  return ler(numeroContrato, false, opts);
}

function listarRemovidosPorContrato(numeroContrato, opts) {
  return ler(numeroContrato, true, opts);
}

module.exports = {
  FONTE,
  LEITURA_MS,
  contratoValido,
  caminho,
  listarPorContrato,
  listarRemovidosPorContrato,
};
