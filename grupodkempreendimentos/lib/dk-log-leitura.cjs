/**
 * Leitura administrativa de public.dk_events. Só SELECT, no máximo 100 linhas.
 * O navegador não recebe a chave e não escreve nesta tabela.
 */
const { isSupabaseDoormanConfigured } = require("./dk-supabase-doorman.cjs");
const { sanitizarEvento } = require("./dk-log-apresentacao.cjs");

const DEFAULT_URL = "https://ppxtwqvzgujllfzarpuz.supabase.co";

function supabaseUrl() {
  return String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || DEFAULT_URL)
    .trim()
    .replace(/\/$/, "");
}

function serviceRoleKey() {
  return String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
}

const LIMITE = 50;
const CAMPOS = [
  "seq",
  "audit_no",
  "operation_id",
  "event_type",
  "entity_type",
  "entity_id",
  "action",
  "record_version",
  "module",
  "actor_user_id",
  "actor_session_id",
  "actor_name_snapshot",
  "actor_role_snapshot",
  "device_label",
  "result",
  "severity",
  "context",
  "details",
  "payload",
  "visibility",
  "created_at",
].join(",");

function projetarEvento(row) {
  const item = row && typeof row === "object" ? row : {};
  return {
    seq: Number(item.seq),
    event_type: item.event_type == null ? null : String(item.event_type),
    entity_type: item.entity_type == null ? null : String(item.entity_type),
    entity_id: item.entity_id == null ? null : String(item.entity_id),
    action: item.action == null ? null : String(item.action),
    record_version: item.record_version == null ? null : Number(item.record_version),
    module: item.module == null ? null : String(item.module),
    actor_user_id: item.actor_user_id == null ? null : String(item.actor_user_id),
    actor_session_id: item.actor_session_id == null ? null : String(item.actor_session_id),
    payload: item.payload && typeof item.payload === "object" && !Array.isArray(item.payload) ? item.payload : {},
    visibility: item.visibility == null ? null : String(item.visibility),
    created_at: item.created_at == null ? null : String(item.created_at),
    audit_no: item.audit_no == null ? null : Number(item.audit_no),
    operation_id: item.operation_id == null ? null : String(item.operation_id),
    actor_name_snapshot: item.actor_name_snapshot == null ? null : String(item.actor_name_snapshot),
    actor_role_snapshot: item.actor_role_snapshot == null ? null : String(item.actor_role_snapshot),
    device_label: item.device_label == null ? null : String(item.device_label),
    result: item.result == null ? null : String(item.result),
    severity: item.severity == null ? null : String(item.severity),
    context: item.context && typeof item.context === "object" && !Array.isArray(item.context) ? item.context : {},
    details: item.details && typeof item.details === "object" && !Array.isArray(item.details) ? item.details : {},
  };
}

function quantidadeDoCabecalho(contentRange, fallback) {
  const texto = String(contentRange || "");
  const total = texto.match(/\/(\d+)\s*$/);
  if (total) return Number(total[1]);
  return fallback;
}

async function restSelect(path, prefer) {
  const headers = {
    apikey: serviceRoleKey(),
    Authorization: "Bearer " + serviceRoleKey(),
    Accept: "application/json",
  };
  if (prefer) headers.Prefer = prefer;
  const res = await fetch(supabaseUrl() + "/rest/v1/" + path, { method: "GET", headers });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text.slice(0, 180) };
  }
  return { ok: res.ok, status: res.status, data, contentRange: res.headers.get("content-range") };
}

function limitePedido(valor) {
  const n = Number(valor);
  if (!Number.isInteger(n) || n < 1) return LIMITE;
  return Math.min(n, 100);
}

async function lerEventosLog(io, opts) {
  const pedido = io || restSelect;
  if (!io && !isSupabaseDoormanConfigured()) {
    return { ok: false, status: 503, reason: "doorman_key_missing", events: [] };
  }
  const opcoes = opts && typeof opts === "object" ? opts : {};
  const limite = limitePedido(opcoes.limit);
  let path = "dk_events?select=" + CAMPOS + "&order=audit_no.desc&limit=" + limite;
  const antes = Number(opcoes.before);
  if (Number.isInteger(antes) && antes > 0) path += "&audit_no=lt." + antes;
  const res = await pedido(path, "count=exact");
  if (!res.ok || !Array.isArray(res.data)) {
    return { ok: false, status: res.status || 503, reason: "log_leitura", events: [] };
  }
  const events = res.data.map((row) => sanitizarEvento(projetarEvento(row)));
  const maiorSeq = events.reduce((maior, item) => Math.max(maior, Number(item.seq) || 0), 0);
  return {
    ok: true,
    events,
    quantidade: quantidadeDoCabecalho(res.contentRange, events.length),
    server_event_seq: maiorSeq,
    has_more: events.length > 0 && quantidadeDoCabecalho(res.contentRange, events.length) > events.length,
  };
}

module.exports = { LIMITE, CAMPOS, projetarEvento, quantidadeDoCabecalho, lerEventosLog };
