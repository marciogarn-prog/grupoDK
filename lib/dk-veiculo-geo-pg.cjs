/**
 * Última posição GPS do veículo/rastreador EC33 — uma linha por IMEI em public.dk_veiculo_geo.
 */
const { isSupabaseDoormanConfigured } = require("./dk-supabase-doorman.cjs");

const DEFAULT_URL = "https://ppxtwqvzgujllfzarpuz.supabase.co";
const TABELA = "dk_veiculo_geo";
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_VEICULOS = 800;
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

function normImei(s) {
  return onlyDigits(s).slice(0, 15);
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
  const acc =
    entrada && entrada.acc != null
      ? Boolean(entrada.acc)
      : entrada && entrada.ignicao != null
        ? Boolean(entrada.ignicao)
        : prev.acc != null
          ? Boolean(prev.acc)
          : null;
  return {
    imei: normImei(entrada && entrada.imei),
    placa: normPlaca(entrada && entrada.placa != null ? entrada.placa : prev.placa).slice(0, 16),
    nome: texto(entrada && entrada.nome != null ? entrada.nome : prev.nome, 160),
    protocolo: texto(entrada && entrada.protocolo != null ? entrada.protocolo : prev.protocolo, 40),
    modelo: texto(entrada && entrada.modelo != null ? entrada.modelo : prev.modelo || "EC33", 40) || "EC33",
    lat: arredondar(entrada && entrada.lat, 6),
    lng: arredondar(entrada && entrada.lng, 6),
    accuracy: arredondar(entrada && entrada.accuracy, 1),
    heading: arredondar(entrada && entrada.heading, 1),
    speed: arredondar(entrada && entrada.speed, 2),
    acc,
    ignicao: acc,
    gsm: entrada && entrada.gsm != null ? Number(entrada.gsm) : prev.gsm != null ? Number(prev.gsm) : null,
    bateria:
      entrada && entrada.bateria != null
        ? Number(entrada.bateria)
        : prev.bateria != null
          ? Number(prev.bateria)
          : null,
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
    String(anterior.placa || "") === String(nova.placa || "") &&
    String(anterior.nome || "") === String(nova.nome || "") &&
    mesmoNumero(anterior.heading, nova.heading) &&
    mesmoNumero(anterior.speed, nova.speed) &&
    Boolean(anterior.acc) === Boolean(nova.acc);
  if (!igual) return false;
  const antes = Number(anterior.ts) || 0;
  const agora = Number(nova.ts) || 0;
  return agora - antes < TS_IGUAL_MS;
}

function linhaParaVeiculo(row) {
  const ts = Number(row && row.ts) || 0;
  return {
    imei: String(row.imei || ""),
    placa: String(row.placa || ""),
    nome: String(row.nome || ""),
    protocolo: String(row.protocolo || ""),
    modelo: String(row.modelo || "EC33"),
    lat: Number(row.lat),
    lng: Number(row.lng),
    accuracy: row.accuracy == null ? null : Number(row.accuracy),
    heading: row.heading == null ? null : Number(row.heading),
    speed: row.speed == null ? null : Number(row.speed),
    acc: row.acc == null ? null : Boolean(row.acc),
    ignicao: row.ignicao == null ? (row.acc == null ? null : Boolean(row.acc)) : Boolean(row.ignicao),
    gsm: row.gsm == null ? null : Number(row.gsm),
    bateria: row.bateria == null ? null : Number(row.bateria),
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
        reason: "geo_veiculo_tabela_ausente",
        msg: "A tabela de localização de veículos ainda não está no banco. Rode supabase/dk-veiculo-geo.sql.",
      },
    };
  }
  return {
    status: res && res.status === 503 ? 503 : 502,
    body: {
      ok: false,
      success: false,
      reason: (res && res.data && res.data.reason) || "supabase_falhou",
      msg: "Não foi possível guardar a localização do veículo.",
    },
  };
}

async function buscarPorImei(imei, deps) {
  const res = await rest(
    `${TABELA}?imei=eq.${encodeURIComponent(imei)}&select=imei,placa,nome,protocolo,modelo,lat,lng,accuracy,heading,speed,acc,ignicao,gsm,bateria,ts,updated_at`,
    { rest: deps && deps.rest }
  );
  if (!res.ok) return { ok: false, res };
  const row = Array.isArray(res.data) ? res.data[0] : null;
  return { ok: true, row: row || null };
}

async function listarPosicoes(deps) {
  const corte = Date.now() - MAX_AGE_MS;
  const res = await rest(
    `${TABELA}?ts=gte.${corte}&select=imei,placa,nome,protocolo,modelo,lat,lng,accuracy,heading,speed,acc,ignicao,gsm,bateria,ts,updated_at&order=ts.desc&limit=${MAX_VEICULOS}`,
    { rest: deps && deps.rest }
  );
  if (!res.ok) return { ok: false, ...falha(res) };
  const linhas = Array.isArray(res.data) ? res.data : [];
  const veiculos = linhas.map(linhaParaVeiculo);
  const updatedAt = linhas.reduce((m, row) => {
    const t = Date.parse(row.updated_at || "") || 0;
    return t > m ? t : m;
  }, 0);
  return {
    ok: true,
    status: 200,
    veiculos,
    updatedAt: updatedAt || null,
    revision: updatedAt ? new Date(updatedAt).toISOString() : null,
  };
}

async function gravarPosicao(entrada, deps) {
  const imei = normImei(entrada && entrada.imei);
  if (imei.length < 14) {
    return { status: 400, body: { ok: false, msg: "IMEI inválido." } };
  }
  const atual = await buscarPorImei(imei, deps);
  if (!atual.ok) return falha(atual.res);
  const nova = normalizarPosicao({ ...entrada, imei }, atual.row);
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
        imei,
        ts: Number(atual.row.ts) || nova.ts,
      },
    };
  }
  const storedAt = new Date().toISOString();
  const res = await rest(`${TABELA}?on_conflict=imei`, {
    rest: deps && deps.rest,
    method: "POST",
    prefer: "resolution=merge-duplicates,return=representation",
    body: {
      imei: nova.imei,
      placa: nova.placa,
      nome: nova.nome,
      protocolo: nova.protocolo,
      modelo: nova.modelo,
      lat: nova.lat,
      lng: nova.lng,
      accuracy: nova.accuracy,
      heading: nova.heading,
      speed: nova.speed,
      acc: nova.acc,
      ignicao: nova.ignicao,
      gsm: nova.gsm,
      bateria: nova.bateria,
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
      imei,
      ts: nova.ts,
    },
  };
}

async function vincularVeiculo(entrada, deps) {
  const imei = normImei(entrada && entrada.imei);
  if (imei.length < 14) {
    return { status: 400, body: { ok: false, msg: "IMEI inválido." } };
  }
  const atual = await buscarPorImei(imei, deps);
  if (!atual.ok) return falha(atual.res);
  const placa = normPlaca(entrada && entrada.placa).slice(0, 16);
  const nome = texto(entrada && entrada.nome, 160);
  const protocolo = texto(entrada && entrada.protocolo, 40);
  const modelo = texto((entrada && entrada.modelo) || "EC33", 40) || "EC33";
  if (!atual.row) {
    return gravarPosicao(
      {
        imei,
        placa,
        nome,
        protocolo,
        modelo,
        lat: Number(entrada && entrada.lat) || 0,
        lng: Number(entrada && entrada.lng) || 0,
        ts: Date.now(),
      },
      deps
    );
  }
  const storedAt = new Date().toISOString();
  const res = await rest(`${TABELA}?on_conflict=imei`, {
    rest: deps && deps.rest,
    method: "POST",
    prefer: "resolution=merge-duplicates,return=representation",
    body: {
      imei,
      placa,
      nome,
      protocolo,
      modelo,
      lat: Number(atual.row.lat),
      lng: Number(atual.row.lng),
      accuracy: atual.row.accuracy,
      heading: atual.row.heading,
      speed: atual.row.speed,
      acc: atual.row.acc,
      ignicao: atual.row.ignicao,
      gsm: atual.row.gsm,
      bateria: atual.row.bateria,
      ts: Number(atual.row.ts) || Date.now(),
      updated_at: storedAt,
    },
  });
  if (!res.ok) return falha(res);
  return {
    status: 200,
    body: {
      ok: true,
      success: true,
      source: "supabase",
      imei,
      placa,
      nome,
      revision: storedAt,
    },
  };
}

module.exports = {
  TABELA,
  MAX_AGE_MS,
  MAX_VEICULOS,
  TS_IGUAL_MS,
  normImei,
  normalizarPosicao,
  posicaoInalterada,
  linhaParaVeiculo,
  listarPosicoes,
  gravarPosicao,
  vincularVeiculo,
};
