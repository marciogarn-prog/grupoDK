/**
 * Leitura fracionada dos pagamentos de um contrato.
 * Só consulta public.dk_pagamento_locacao. Não há fallback.
 */
const crypto = require("crypto");
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
      method: opts.method || "GET",
      headers,
      body: opts.body,
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

const PROTOCOLO_RE = /^\d{14}-\d{3}$/;
const DATA_RE = /^\d{2}\/\d{2}\/\d{4}$/;
const CONTRATO_PROBE = "2025111403";
const CAMPOS_LINHA = [
  "id",
  "migration_key",
  "protocolo_lancamento",
  "numero_contrato",
  "tipo",
  "data_pagamento",
  "valor",
  "payload",
  "version",
  "removido",
  "deleted_at",
  "created_at",
  "updated_at",
  "source_state",
  "source_position",
  "source_payload_hash",
];

function hashPagamentosPayload(pagamentos) {
  const lista = Array.isArray(pagamentos) ? pagamentos : [];
  return crypto.createHash("sha256").update(JSON.stringify(lista), "utf8").digest("hex");
}

function ehAluguel(pagamento) {
  const tipo = String(pagamento?.tipoMovimento || pagamento?.tipo || "")
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

function validarPagamento(pagamento, numeroContrato) {
  const nc = String(numeroContrato || "").trim();
  if (!contratoValido(nc)) return { ok: false, status: 400, reason: "contrato_obrigatorio" };
  if (!pagamento || typeof pagamento !== "object" || Array.isArray(pagamento)) {
    return { ok: false, status: 400, reason: "pagamento_invalido" };
  }
  const protocolo = String(pagamento.protocoloLancamento || "").trim();
  if (!PROTOCOLO_RE.test(protocolo)) return { ok: false, status: 400, reason: "protocolo_invalido" };
  const data = String(pagamento.data || "").trim();
  if (!DATA_RE.test(data)) return { ok: false, status: 400, reason: "data_invalida" };
  const valor = Number(pagamento.valor);
  if (!Number.isFinite(valor)) return { ok: false, status: 400, reason: "valor_invalido" };
  return { ok: true, status: 200 };
}

function encontrarDuplicidade(pagamento, existentes) {
  const lista = Array.isArray(existentes) ? existentes : [];
  const achou = lista.some((item) => mesmaCobranca(pagamento, item));
  return achou
    ? { ok: false, status: 409, reason: "duplicate_payment_same_day_value" }
    : { ok: true, status: 200 };
}

function decidirVersao(atual, esperada) {
  const a = Number(atual);
  const e = Number(esperada);
  if (!Number.isInteger(a) || a < 1 || a !== e) {
    return { ok: false, status: 409, reason: "version", version: Number.isInteger(a) ? a : null };
  }
  return { ok: true, status: 200, version: a + 1 };
}

function construirLinhaPagamento(pagamento, numeroContrato, extras) {
  const check = validarPagamento(pagamento, numeroContrato);
  if (!check.ok) return check;
  const extra = extras && typeof extras === "object" ? extras : {};
  const id = String(extra.id || crypto.randomUUID());
  const payload = { ...pagamento };
  const tipo = String(pagamento.tipoMovimento || "").trim();
  const [dia, mes, ano] = String(pagamento.data).split("/");
  return {
    ok: true,
    status: 200,
    linha: {
      id,
      migration_key: `online:${id}`,
      protocolo_lancamento: String(pagamento.protocoloLancamento).trim(),
      numero_contrato: String(numeroContrato).trim(),
      tipo: tipo || null,
      data_pagamento: `${ano}-${mes}-${dia}`,
      valor: Number(pagamento.valor),
      payload,
      version: 1,
      removido: false,
      deleted_at: null,
      created_at: extra.createdAt || new Date().toISOString(),
      updated_at: null,
      source_state: "online",
      source_position: Number(extra.sourcePosition) || 0,
      source_payload_hash: crypto.createHash("sha256").update(JSON.stringify(payload), "utf8").digest("hex"),
    },
  };
}

function gravarUma() {
  return { ok: false, status: 405, reason: "write_not_active", mutated: false, inserted: 0, updated: 0, fallback: false };
}

const E2E_PAGAMENTO_ID = "e14c3cc2-ed23-409c-8e60-2cdfb65c6de9";
const E2E_CONTRATO_UPDATE = "2026102701";
const E2E_PROTOCOLO_UPDATE = "20261028020219-030";
const E2E_CHAVE_UPDATE = "online:e14c3cc2-ed23-409c-8e60-2cdfb65c6de9";

function centavos(valor) {
  const n = Number(valor);
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}

async function atualizarE2eReal(expectedVersion, opts) {
  const esperada = Number(expectedVersion);
  if (!Number.isInteger(esperada)) {
    return { ok: false, status: 400, reason: "version_obrigatoria", mutated: false, updated: 0, fallback: false };
  }
  const lido = await rest(
    "dk_pagamento_locacao?select=id,numero_contrato,protocolo_lancamento,migration_key,valor,version,removido,source_position,payload,created_at,updated_at&id=eq." +
      E2E_PAGAMENTO_ID +
      "&limit=1",
    opts
  );
  if (!lido.ok) {
    return { ok: false, status: lido.status || 503, reason: (lido.data && lido.data.reason) || "postgres_indisponivel", mutated: false, updated: 0, fallback: false };
  }
  const row = Array.isArray(lido.data) ? lido.data[0] : null;
  if (
    !row ||
    row.numero_contrato !== E2E_CONTRATO_UPDATE ||
    row.protocolo_lancamento !== E2E_PROTOCOLO_UPDATE ||
    row.migration_key !== E2E_CHAVE_UPDATE ||
    row.removido !== false ||
    Number(row.source_position) !== 1
  ) {
    return { ok: false, status: 409, reason: "pagamento_divergente", mutated: false, updated: 0, fallback: false };
  }
  if (Number(row.version) !== esperada) {
    return {
      ok: false,
      status: 409,
      reason: "version_conflict",
      mutated: false,
      updated: 0,
      fallback: false,
      version: Number(row.version),
      valor: Number(row.valor),
    };
  }
  if (esperada !== 1 || centavos(row.valor) !== 101) {
    return { ok: false, status: 409, reason: "version_conflict", mutated: false, updated: 0, fallback: false, version: Number(row.version) };
  }
  const payload = { ...(row.payload || {}), valor: 1.02 };
  const source_payload_hash = crypto.createHash("sha256").update(JSON.stringify(payload), "utf8").digest("hex");
  const gravado = await rest(
    "dk_pagamento_locacao?id=eq." +
      E2E_PAGAMENTO_ID +
      "&version=eq.1&numero_contrato=eq." +
      E2E_CONTRATO_UPDATE +
      "&protocolo_lancamento=eq." +
      E2E_PROTOCOLO_UPDATE,
    {
      ...opts,
      method: "PATCH",
      headers: { "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify({
        valor: 1.02,
        payload,
        source_payload_hash,
        version: 2,
        updated_at: new Date().toISOString(),
      }),
    }
  );
  const linha = gravado.ok && Array.isArray(gravado.data) ? gravado.data[0] : null;
  if (!linha) {
    return {
      ok: false,
      status: gravado.ok ? 409 : gravado.status || 503,
      reason: gravado.ok ? "version_conflict" : (gravado.data && gravado.data.reason) || "postgres_indisponivel",
      mutated: false,
      updated: 0,
      fallback: false,
    };
  }
  return {
    ok: true,
    status: 200,
    mutated: true,
    updated: 1,
    inserted: 0,
    fallback: false,
    source: FONTE,
    id: linha.id,
    protocolo: linha.protocolo_lancamento,
    numeroContrato: linha.numero_contrato,
    valor: Number(linha.valor),
    version: linha.version,
    sourcePosition: linha.source_position,
    migrationKey: linha.migration_key,
    createdAt: linha.created_at,
    updatedAt: linha.updated_at,
  };
}

function caminhoProbe() {
  const select = CAMPOS_LINHA.join(",");
  return (
    "dk_pagamento_locacao?select=" +
    select +
    "&numero_contrato=eq." +
    CONTRATO_PROBE +
    "&removido=eq.false&protocolo_lancamento=not.is.null&order=source_position.asc&limit=1"
  );
}

function resultadoProbe(parcial) {
  return {
    ok: true,
    status: 200,
    probe: true,
    mutated: false,
    inserted: 0,
    updated: 0,
    deleted: 0,
    source: FONTE,
    numeroContrato: CONTRATO_PROBE,
    fallback: false,
    ...parcial,
  };
}

async function probeEscrita(opts) {
  const lido = await rest(caminhoProbe(), opts);
  if (!lido.ok) {
    return {
      ok: false,
      status: lido.status || 503,
      reason: (lido.data && lido.data.reason) || "postgres_indisponivel",
      probe: true,
      mutated: false,
      inserted: 0,
      updated: 0,
      source: FONTE,
      fallback: false,
    };
  }
  const linha = Array.isArray(lido.data) ? lido.data[0] : null;
  const protocolo = String(linha && linha.protocolo_lancamento ? linha.protocolo_lancamento : "").trim();
  if (!linha || linha.removido === true || !PROTOCOLO_RE.test(protocolo) || linha.numero_contrato !== CONTRATO_PROBE) {
    return { ok: false, status: 409, reason: "probe_sem_linha", probe: true, mutated: false, inserted: 0, updated: 0, fallback: false };
  }
  const corpo = {};
  for (const campo of CAMPOS_LINHA) corpo[campo] = linha[campo];
  const gravado = await rest("dk_pagamento_locacao?on_conflict=id&columns=" + CAMPOS_LINHA.join(","), {
    ...opts,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Prefer: "resolution=ignore-duplicates,return=representation",
    },
    body: JSON.stringify(corpo),
  });
  if (gravado.status === 409 || (gravado.ok && Array.isArray(gravado.data) && gravado.data.length === 0)) {
    return resultadoProbe();
  }
  if (!gravado.ok) {
    return {
      ok: false,
      status: gravado.status || 503,
      reason: (gravado.data && gravado.data.reason) || "postgres_indisponivel",
      probe: true,
      mutated: false,
      inserted: 0,
      updated: 0,
      source: FONTE,
      fallback: false,
    };
  }
  const n = Array.isArray(gravado.data) ? gravado.data.length : 0;
  return {
    ok: false,
    status: 500,
    reason: "probe_mutou",
    probe: true,
    mutated: n > 0,
    inserted: n,
    updated: 0,
    source: FONTE,
    fallback: false,
  };
}

module.exports = {
  FONTE,
  LEITURA_MS,
  CONTRATO_PROBE,
  contratoValido,
  caminho,
  caminhoProbe,
  hashPagamentosPayload,
  validarPagamento,
  encontrarDuplicidade,
  decidirVersao,
  construirLinhaPagamento,
  gravarUma,
  atualizarE2eReal,
  listarPorContrato,
  listarRemovidosPorContrato,
  probeEscrita,
};
