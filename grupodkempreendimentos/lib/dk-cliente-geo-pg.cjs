/**
 * Última posição GPS do cliente, uma linha por CPF em public.dk_cliente_geo.
 * O navegador não fala com o banco. O snapshot default não entra aqui.
 */
const { isSupabaseDoormanConfigured } = require("./dk-supabase-doorman.cjs");

const DEFAULT_URL = "https://ppxtwqvzgujllfzarpuz.supabase.co";
const TABELA = "dk_cliente_geo";
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_CLIENTES = 800;
const TS_IGUAL_MS = 4 * 60 * 1000;

function supabaseUrl() {
  return String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || DEFAULT_URL)
    .trim()
    .replace(/\/$/, "");
}

function serviceRoleKey() {
  return String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
}

function onlyDigits(s) {
  return String(s ?? "").replace(/\D/g, "");
}

function normPlaca(s) {
  return String(s ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function arredondar(v, casas) {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  const p = 10 ** casas;
  return Math.round(n * p) / p;
}

function texto(v, max) {
  return String(v ?? "").trim().slice(0, max);
}

function normalizarPosicao(entrada, anterior) {
  const prev = anterior && typeof anterior === "object" ? anterior : {};
  const ts = Number(entrada && entrada.ts);
  return {
    cpf: onlyDigits(entrada && entrada.cpf).slice(0, 11),
    nome: texto(entrada && entrada.nome ? entrada.nome : prev.nome, 160),
    placa: normPlaca(entrada && entrada.placa ? entrada.placa : prev.placa).slice(0, 16),
    protocolo: texto(entrada && entrada.protocolo ? entrada.protocolo : prev.protocolo, 40),
    lat: arredondar(entrada && entrada.lat, 6),
    lng: arredondar(entrada && entrada.lng, 6),
    accuracy: arredondar(entrada && entrada.accuracy, 1),
    heading: arredondar(entrada && entrada.heading, 1),
    speed: arredondar(entrada && entrada.speed, 2),
    ts: Number.isFinite(ts) && ts > 0 ? Math.round(ts) : Date.now(),
  };
}

function mesmoNumero(a, b) {
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  return Number(a) === Number(b);
}

function posicaoInalterada(anterior, nova) {
  if (!anterior || !nova) return false;
  const igual =
    mesmoNumero(anterior.lat, nova.lat) &&
    mesmoNumero(anterior.lng, nova.lng) &&
    String(anterior.nome || "") === String(nova.nome || "") &&
    String(anterior.placa || "") === String(nova.placa || "") &&
    String(anterior.protocolo || "") === String(nova.protocolo || "") &&
    mesmoNumero(anterior.accuracy, nova.accuracy) &&
    mesmoNumero(anterior.heading, nova.heading) &&
    mesmoNumero(anterior.speed, nova.speed);
  if (!igual) return false;
  const antes = Number(anterior.ts) || 0;
  const agora = Number(nova.ts) || 0;
  return agora - antes < TS_IGUAL_MS;
}

function linhaParaCliente(row) {
  const ts = Number(row && row.ts) || 0;
  return {
    cpf: String(row.cpf || ""),
    nome: String(row.nome || ""),
    placa: String(row.placa || ""),
    protocolo: String(row.protocolo || ""),
    lat: Number(row.lat),
    lng: Number(row.lng),
    accuracy: row.accuracy == null ? null : Number(row.accuracy),
    heading: row.heading == null ? null : Number(row.heading),
    speed: row.speed == null ? null : Number(row.speed),
    ts,
    updatedAt: ts,
  };
}

function schemaAusente(res) {
  const data = res && res.data;
  const msg = String((data && (data.message || data.raw)) || "");
  return (
    res &&
    (res.status === 404 ||
      (data && data.code === "PGRST205") ||
      /does not exist|schema cache|Could not find the table/i.test(msg))
  );
}

async function rest(path, opts = {}) {
  if (typeof opts.rest === "function") return opts.rest(path, opts);
  if (!isSupabaseDoormanConfigured()) {
    return { ok: false, status: 503, data: { reason: "doorman_key_missing" } };
  }
  const headers = {
    apikey: serviceRoleKey(),
    Authorization: `Bearer ${serviceRoleKey()}`,
    Accept: "application/json",
    "Content-Type": "application/json",
    ...(opts.headers || {}),
  };
  if (opts.prefer) headers.Prefer = opts.prefer;
  const res = await fetch(`${supabaseUrl()}/rest/v1/${path}`, {
    method: opts.method || "GET",
    headers,
    body: opts.body == null ? undefined : JSON.stringify(opts.body),
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  return { ok: res.ok, status: res.status, data };
}

function falha(res) {
  if (schemaAusente(res)) {
    return {
      status: 503,
      body: {
        ok: false,
        success: false,
        reason: "geo_tabela_ausente",
        msg: "A tabela de localização ainda não está no banco.",
      },
    };
  }
  return {
    status: res && res.status === 503 ? 503 : 502,
    body: {
      ok: false,
      success: false,
      reason: (res && res.data && res.data.reason) || "supabase_falhou",
      msg: "Não foi possível guardar a localização.",
    },
  };
}

async function buscarPorCpf(cpf, deps) {
  const res = await rest(`${TABELA}?cpf=eq.${encodeURIComponent(cpf)}&select=cpf,nome,placa,protocolo,lat,lng,accuracy,heading,speed,ts,updated_at`, {
    rest: deps && deps.rest,
  });
  if (!res.ok) return { ok: false, res };
  const row = Array.isArray(res.data) ? res.data[0] : null;
  return { ok: true, row: row || null };
}

async function listarPosicoes(deps) {
  const corte = Date.now() - MAX_AGE_MS;
  const res = await rest(
    `${TABELA}?ts=gte.${corte}&select=cpf,nome,placa,protocolo,lat,lng,accuracy,heading,speed,ts,updated_at&order=ts.desc&limit=${MAX_CLIENTES}`,
    { rest: deps && deps.rest }
  );
  if (!res.ok) return { ok: false, ...falha(res) };
  const linhas = Array.isArray(res.data) ? res.data : [];
  const clientes = linhas.map(linhaParaCliente);
  const updatedAt = linhas.reduce((m, row) => {
    const t = Date.parse(row.updated_at || "") || 0;
    return t > m ? t : m;
  }, 0);
  return {
    ok: true,
    status: 200,
    clientes,
    updatedAt: updatedAt || null,
    revision: updatedAt ? new Date(updatedAt).toISOString() : null,
  };
}

async function gravarPosicao(entrada, deps) {
  const cpf = onlyDigits(entrada && entrada.cpf).slice(0, 11);
  if (cpf.length !== 11) {
    return { status: 400, body: { ok: false, msg: "CPF inválido." } };
  }
  const atual = await buscarPorCpf(cpf, deps);
  if (!atual.ok) return falha(atual.res);
  const nova = normalizarPosicao(entrada, atual.row);
  if (!Number.isFinite(nova.lat) || !Number.isFinite(nova.lng)) {
    return { status: 400, body: { ok: false, msg: "Coordenadas inválidas." } };
  }
  if (posicaoInalterada(atual.row, nova)) {
    return {
      status: 200,
      inalterado: true,
      row: atual.row,
      body: {
        ok: true,
        success: true,
        source: "supabase",
        inalterado: true,
        persistencia: "supabase",
        supabase: { ok: true },
        revision: atual.row.updated_at || null,
        updated_at: atual.row.updated_at || null,
        cpf,
        ts: Number(atual.row.ts) || nova.ts,
      },
    };
  }
  const storedAt = new Date().toISOString();
  const res = await rest(`${TABELA}?on_conflict=cpf`, {
    rest: deps && deps.rest,
    method: "POST",
    prefer: "resolution=merge-duplicates,return=representation",
    body: {
      cpf: nova.cpf,
      nome: nova.nome,
      placa: nova.placa,
      protocolo: nova.protocolo,
      lat: nova.lat,
      lng: nova.lng,
      accuracy: nova.accuracy,
      heading: nova.heading,
      speed: nova.speed,
      ts: nova.ts,
      updated_at: storedAt,
    },
  });
  if (!res.ok) return falha(res);
  const gravada = Array.isArray(res.data) ? res.data[0] : nova;
  return {
    status: 200,
    inalterado: false,
    row: gravada || nova,
    body: {
      ok: true,
      success: true,
      source: "supabase",
      inalterado: false,
      persistencia: "supabase",
      supabase: { ok: true },
      revision: (gravada && gravada.updated_at) || storedAt,
      updated_at: (gravada && gravada.updated_at) || storedAt,
      cpf,
      ts: nova.ts,
    },
  };
}

module.exports = {
  TABELA,
  MAX_AGE_MS,
  MAX_CLIENTES,
  TS_IGUAL_MS,
  normalizarPosicao,
  posicaoInalterada,
  linhaParaCliente,
  listarPosicoes,
  gravarPosicao,
};
