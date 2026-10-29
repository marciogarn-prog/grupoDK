/**
 * Catch-up do Log. Só leitura, ordem crescente de seq.
 * Evento com visibility admin vira marcador para quem não é administrador.
 */
const { isSupabaseDoormanConfigured } = require("./dk-supabase-doorman.cjs");
const { projetarEvento } = require("./dk-log-leitura.cjs");

const DEFAULT_URL = "https://ppxtwqvzgujllfzarpuz.supabase.co";
const LIMITE_PADRAO = 100;
const LIMITE_MAXIMO = 500;
const CAMPOS = [
  "seq",
  "event_type",
  "entity_type",
  "entity_id",
  "action",
  "record_version",
  "module",
  "actor_user_id",
  "actor_session_id",
  "payload",
  "visibility",
  "created_at",
  "audit_no",
].join(",");

function supabaseUrl() {
  return String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || DEFAULT_URL)
    .trim()
    .replace(/\/$/, "");
}

function serviceRoleKey() {
  return String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
}

function ehAdministradorSync(gate) {
  return Boolean(
    gate &&
      gate.ok !== false &&
      !gate.service &&
      String(gate.typ || "") === "equipa" &&
      String(gate.role || "").trim() === "owner"
  );
}

function interpretarAfter(valor) {
  if (valor == null || String(valor).trim() === "") return { ok: true, after: 0 };
  const texto = String(valor).trim();
  if (!/^\d+$/.test(texto)) return { ok: false, status: 400, reason: "after_invalido" };
  return { ok: true, after: Number(texto) };
}

function interpretarLimit(valor) {
  if (valor == null || String(valor).trim() === "") return { ok: true, limit: LIMITE_PADRAO };
  const texto = String(valor).trim();
  if (!/^[1-9]\d*$/.test(texto)) return { ok: false, status: 400, reason: "limit_invalido" };
  const limit = Number(texto);
  if (limit > LIMITE_MAXIMO) return { ok: false, status: 400, reason: "limit_maximo" };
  return { ok: true, limit };
}

function marcadorRestrito(seq) {
  return { seq: Number(seq), restricted: true };
}

function projetarParaPapel(row, admin) {
  const vis = String(row && row.visibility != null ? row.visibility : "").trim().toLowerCase();
  if (vis === "admin" && !admin) return marcadorRestrito(row.seq);
  return projetarEvento(row);
}

function montarCatchUp({ linhas, after, limit, serverSeq, admin }) {
  const lista = Array.isArray(linhas) ? linhas : [];
  const hasMore = lista.length > limit;
  const pagina = lista.slice(0, limit).map((row) => projetarParaPapel(row, admin));
  const ultimo = pagina.length ? Number(pagina[pagina.length - 1].seq) : after;
  return {
    ok: true,
    server_event_seq: Number.isFinite(Number(serverSeq)) ? Number(serverSeq) : 0,
    events: pagina,
    has_more: hasMore,
    next_after: ultimo,
    fallback: false,
  };
}

async function restSelect(path) {
  const headers = {
    apikey: serviceRoleKey(),
    Authorization: "Bearer " + serviceRoleKey(),
    Accept: "application/json",
  };
  const res = await fetch(supabaseUrl() + "/rest/v1/" + path, { method: "GET", headers });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text.slice(0, 180) };
  }
  return { ok: res.ok, status: res.status, data };
}

async function lerCatchUp({ after, limit, admin }, io) {
  const pedido = io || restSelect;
  if (!io && !isSupabaseDoormanConfigured()) {
    return { ok: false, status: 503, reason: "doorman_key_missing", fallback: false, events: [] };
  }
  const pagina = await pedido(
    "dk_events?select=" + CAMPOS + "&seq=gt." + after + "&order=seq.asc&limit=" + (limit + 1)
  );
  if (!pagina.ok || !Array.isArray(pagina.data)) {
    return { ok: false, status: pagina.status || 503, reason: "sync_leitura", fallback: false, events: [] };
  }
  const topo = await pedido("dk_events?select=seq&order=seq.desc&limit=1");
  if (!topo.ok || !Array.isArray(topo.data)) {
    return { ok: false, status: topo.status || 503, reason: "sync_leitura", fallback: false, events: [] };
  }
  const serverSeq = topo.data.length ? Number(topo.data[0].seq) : 0;
  return montarCatchUp({ linhas: pagina.data, after, limit, serverSeq, admin });
}

module.exports = {
  LIMITE_PADRAO,
  LIMITE_MAXIMO,
  ehAdministradorSync,
  interpretarAfter,
  interpretarLimit,
  marcadorRestrito,
  projetarParaPapel,
  montarCatchUp,
  lerCatchUp,
};
