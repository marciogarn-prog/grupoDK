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

const E2E_PROTOCOL_ID = "E2E_DK_REAL_20261027_065940_A7F3";
const E2E_CONTRATO = "2026102701";
const E2E_DATA = "27/10/2026";
const E2E_VALOR = 1.01;

function protocoloNoFuso(cpf, when) {
  const d = when instanceof Date ? when : new Date(when);
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Recife",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d);
  const map = {};
  for (const part of parts) if (part.type !== "literal") map[part.type] = part.value;
  const cpf3 = String(cpf || "").replace(/\D/g, "").slice(0, 3);
  const suffix = cpf3.length >= 3 ? cpf3 : "000";
  return `${map.year}${map.month}${map.day}${map.hour}${map.minute}${map.second}-${suffix}`;
}

async function protocoloLivre(cpf, opts) {
  let t = Date.now();
  for (let i = 0; i < 5; i += 1) {
    const proto = protocoloNoFuso(cpf, t);
    const achou = await rest(
      "dk_pagamento_locacao?select=id&protocolo_lancamento=eq." + encodeURIComponent(proto) + "&limit=1",
      opts
    );
    if (!achou.ok) return { ok: false, status: achou.status || 503, reason: "postgres_indisponivel" };
    if (!Array.isArray(achou.data) || achou.data.length === 0) return { ok: true, protocolo: proto, createdAt: t };
    t += 1000;
  }
  return { ok: false, status: 409, reason: "protocolo_indisponivel" };
}

async function inserirE2eReal(cpf, opts) {
  const loc = await rest("dk_locacao?select=version,campos&numero_contrato=eq." + E2E_CONTRATO + "&deleted_at=is.null&limit=1", opts);
  if (!loc.ok) {
    return { ok: false, status: loc.status || 503, reason: (loc.data && loc.data.reason) || "postgres_indisponivel", mutated: false, inserted: 0, updated: 0, fallback: false };
  }
  const row = Array.isArray(loc.data) ? loc.data[0] : null;
  const campos = row && row.campos && typeof row.campos === "object" ? row.campos : null;
  const embutidos = campos && Array.isArray(campos.portalLancamentosAluguel) ? campos.portalLancamentosAluguel.length : -1;
  const marcado = campos ? JSON.stringify(campos).includes(E2E_PROTOCOL_ID) : false;
  if (!row || Number(row.version) !== 2 || !marcado || embutidos !== 0 || campos.numeroContrato !== E2E_CONTRATO) {
    return { ok: false, status: 409, reason: "contrato_nao_e2e", mutated: false, inserted: 0, updated: 0, fallback: false };
  }
  const atuais = await rest(
    "dk_pagamento_locacao?select=payload&numero_contrato=eq." + E2E_CONTRATO + "&removido=eq.false",
    opts
  );
  if (!atuais.ok) {
    return { ok: false, status: atuais.status || 503, reason: "postgres_indisponivel", mutated: false, inserted: 0, updated: 0, fallback: false };
  }
  const existentes = (Array.isArray(atuais.data) ? atuais.data : []).map((item) => item.payload).filter(Boolean);
  const pagamento = {
    data: E2E_DATA,
    valor: E2E_VALOR,
    tipoMovimento: "PAGAMENTO",
    protocoloLancamento: "20261027000000-000",
  };
  const dup = encontrarDuplicidade(pagamento, existentes);
  if (!dup.ok) {
    return { ok: false, status: 409, reason: dup.reason, mutated: false, inserted: 0, updated: 0, fallback: false, quantidade: existentes.length };
  }
  const livre = await protocoloLivre(cpf, opts);
  if (!livre.ok) return { ...livre, mutated: false, inserted: 0, updated: 0, fallback: false };
  pagamento.protocoloLancamento = livre.protocolo;
  pagamento.createdAt = livre.createdAt;
  const linha = construirLinhaPagamento(pagamento, E2E_CONTRATO, {
    sourcePosition: existentes.length + 1,
    createdAt: new Date(livre.createdAt).toISOString(),
  });
  if (!linha.ok) return { ...linha, mutated: false, inserted: 0, updated: 0, fallback: false };
  const gravado = await rest("dk_pagamento_locacao", {
    ...opts,
    method: "POST",
    headers: { "Content-Type": "application/json", Prefer: "return=representation" },
    body: JSON.stringify(linha.linha),
  });
  const criada = gravado.ok && Array.isArray(gravado.data) ? gravado.data[0] : null;
  if (!criada) {
    return {
      ok: false,
      status: gravado.status || 503,
      reason: (gravado.data && (gravado.data.message || gravado.data.reason)) || "insert_falhou",
      mutated: false,
      inserted: 0,
      updated: 0,
      fallback: false,
    };
  }
  return {
    ok: true,
    status: 201,
    probe: false,
    mutated: true,
    inserted: 1,
    updated: 0,
    fallback: false,
    source: FONTE,
    id: criada.id,
    protocolo: criada.protocolo_lancamento,
    numeroContrato: criada.numero_contrato,
    data: E2E_DATA,
    valor: E2E_VALOR,
    tipo: "PAGAMENTO",
    version: criada.version,
    sourcePosition: criada.source_position,
    migrationKey: criada.migration_key,
    createdAt: criada.created_at,
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
  inserirE2eReal,
  listarPorContrato,
  listarRemovidosPorContrato,
  probeEscrita,
};
