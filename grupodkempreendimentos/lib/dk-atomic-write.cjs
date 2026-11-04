/**
 * Camada de escrita atômica Clientes/Veículos.
 * Mutation + dk_event no mesmo RPC PostgreSQL.
 * Sem snapshot/Redis como autoridade de write.
 */
const crypto = require("crypto");
const { isSupabaseDoormanConfigured } = require("./dk-supabase-doorman.cjs");
const {
  dkClienteAplicarPatch,
  dkClienteParaPersistencia,
  dkClienteEhResumo,
  dkClienteSubstituir,
} = require("./dk-cliente-fidelidade.cjs");
const {
  dkVeiculoAplicarPatch,
  dkVeiculoParaPersistencia,
  dkVeiculoEhResumo,
  dkVeiculoSubstituir,
} = require("./dk-veiculo-fidelidade.cjs");

const DEFAULT_URL = "https://ppxtwqvzgujllfzarpuz.supabase.co";
const RPC_CLIENTE = "dk_cliente_mutate_with_event";
const RPC_VEICULO = "dk_veiculo_mutate_with_event";

function supabaseUrl() {
  return String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || DEFAULT_URL)
    .trim()
    .replace(/\/$/, "");
}

function serviceRoleKey() {
  return String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
}

function atomicWriteAtivo() {
  const flag = String(process.env.DK_ATOMIC_WRITE_CV || "1").trim();
  return flag !== "0" && flag.toLowerCase() !== "false";
}

function onlyDigits(v) {
  return String(v ?? "").replace(/\D/g, "");
}

function uuidOk(v) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(v || "").trim());
}

function hashPedido(partes) {
  return crypto.createHash("sha256").update(JSON.stringify(partes), "utf8").digest("hex");
}

function camposAlterados(antes, depois) {
  const a = antes && typeof antes === "object" ? antes : {};
  const b = depois && typeof depois === "object" ? depois : {};
  const chaves = new Set([...Object.keys(a), ...Object.keys(b)]);
  const out = [];
  for (const chave of chaves) {
    const ja = Object.prototype.hasOwnProperty.call(a, chave);
    const jb = Object.prototype.hasOwnProperty.call(b, chave);
    if (!ja || !jb || JSON.stringify(a[chave]) !== JSON.stringify(b[chave])) out.push(chave);
  }
  return out.sort();
}

async function restRpc(nome, args, io) {
  if (io && typeof io.rpc === "function") return io.rpc(nome, args);
  if (!isSupabaseDoormanConfigured()) {
    return { ok: false, status: 503, data: { reason: "doorman_key_missing" } };
  }
  const key = serviceRoleKey();
  const res = await fetch(supabaseUrl() + "/rest/v1/rpc/" + nome, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: "Bearer " + key,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(args),
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: String(text).slice(0, 400) };
  }
  return { ok: res.ok, status: res.status, data };
}

function classificarErroRpc(data, status) {
  const msg = String((data && (data.message || data.details || data.hint || data.raw)) || "");
  if (/IDEMPOTENCY_CONFLICT/i.test(msg)) return { status: 409, reason: "IDEMPOTENCY_CONFLICT" };
  if (/revisao_conflito/i.test(msg)) return { status: 409, reason: "revisao_conflito" };
  if (/cpf_duplicado|placa_duplicada|cliente_ja_existe|veiculo_ja_existe/i.test(msg)) {
    return { status: 409, reason: /placa/i.test(msg) ? "placa_duplicada" : /cpf|cliente/i.test(msg) ? "cpf_duplicado" : "conflito" };
  }
  if (/operation_id_ausente/i.test(msg)) return { status: 400, reason: "operation_id_obrigatorio" };
  if (/cliente_ausente|veiculo_ausente/i.test(msg)) return { status: 404, reason: "ausente" };
  if (status === 404 || /Could not find the function|PGRST202/i.test(msg)) {
    return { status: 503, reason: "rpc_ausente" };
  }
  return { status: status >= 400 ? status : 502, reason: "gravacao" };
}

function exigirOperationId(body) {
  const id = String((body && (body.operation_id || body.operationId)) || "").trim();
  if (!uuidOk(id)) return { ok: false, reason: "operation_id_obrigatorio" };
  return { ok: true, operation_id: id };
}

async function mutarClienteAtomico({
  cliente,
  patch,
  baseRevision,
  operationId,
  actorUserId,
  actorSessionId,
  route,
  method,
  io,
  lerOficial,
}) {
  if (!atomicWriteAtivo()) {
    return { ok: false, status: 503, body: { ok: false, success: false, reason: "atomic_write_desligado" } };
  }
  if (!uuidOk(operationId)) {
    return { ok: false, status: 400, body: { ok: false, success: false, reason: "operation_id_obrigatorio" } };
  }
  const recebido = patch && typeof patch === "object" ? patch : cliente;
  if (dkClienteEhResumo(recebido) && Object.keys(recebido || {}).length <= 6) {
    const check = dkClienteSubstituir({ _full: true, a: 1, b: 2, c: 3, d: 4, e: 5, f: 6, g: 7 }, recebido);
    if (!check.ok) {
      return { ok: false, status: 400, body: { ok: false, success: false, reason: "resumo_nao_substitui_cliente" } };
    }
  }

  let oficial = null;
  if (typeof lerOficial === "function") {
    const lido = await lerOficial();
    if (!lido || lido.ok === false) {
      return {
        ok: false,
        status: (lido && lido.status) || 503,
        body: { ok: false, success: false, reason: (lido && lido.reason) || "leitura" },
      };
    }
    oficial = lido.cliente || null;
    /* baseRevision do browser (snapshot/__DK_CLOUD_REVISION) não entra aqui:
       a concorrência usa só oficial.updated_at lido agora → p_expected_updated_at. */
  }

  const anterior = oficial && typeof oficial === "object" ? oficial : {};
  const existe = Boolean(oficial && (oficial.id != null || oficial.cpf));
  const action = existe ? "update" : "create";
  if (action === "update" && dkClienteEhResumo(recebido)) {
    const sub = dkClienteSubstituir(anterior, recebido);
    if (!sub.ok) {
      return { ok: false, status: 400, body: { ok: false, success: false, reason: "resumo_nao_substitui_cliente" } };
    }
  }
  const merged = dkClienteAplicarPatch(anterior, recebido || {});
  const persistido = dkClienteParaPersistencia(merged);
  if (!persistido.id || onlyDigits(persistido.cpf).length !== 11) {
    return { ok: false, status: 400, body: { ok: false, success: false, reason: "cpf" } };
  }

  /* Sempre a revisão lida agora — nunca a revisão global do snapshot. */
  const expected = action === "update" ? oficial.updated_at || null : null;
  const changed = camposAlterados(anterior, persistido.payload);
  const requestHash = hashPedido({
    domain: "cliente",
    action,
    id: persistido.id,
    cpf: persistido.cpf,
    payload: persistido.payload,
    expected,
  });
  const eventPayload = {
    changed_fields: changed,
    revision_before: expected,
    route: route || "",
    method: method || "POST",
    operation_id: operationId,
    summary: action === "create" ? "Cliente criado" : "Cliente atualizado",
  };

  const rpc = await restRpc(
    RPC_CLIENTE,
    {
      p_operation_id: operationId,
      p_action: action,
      p_id: String(persistido.id),
      p_cpf: persistido.cpf,
      p_payload: persistido.payload,
      p_expected_updated_at: expected,
      p_request_hash: requestHash,
      p_actor_user_id: actorUserId || null,
      p_actor_session_id: uuidOk(actorSessionId) ? actorSessionId : null,
      p_event_payload: eventPayload,
      p_visibility: "team",
    },
    io
  );

  if (!rpc.ok) {
    const err = classificarErroRpc(rpc.data, rpc.status);
    return {
      ok: false,
      status: err.status,
      body: {
        ok: false,
        success: false,
        reason: err.reason,
        detalhe: rpc.data || null,
      },
    };
  }

  const row = Array.isArray(rpc.data) ? rpc.data[0] : rpc.data;
  return {
    ok: true,
    status: 200,
    body: {
      ok: true,
      success: true,
      persistencia: "supabase",
      source: "dk_clientes",
      entity_id: row && row.entity_id,
      record_version: row && row.record_revision,
      revision: row && row.record_revision,
      updated_at: row && row.record_revision,
      operation_id: row && row.operation_id,
      audit_no: row && row.audit_no != null ? Number(row.audit_no) : null,
      seq: row && row.seq != null ? Number(row.seq) : null,
      idempotent: Boolean(row && row.idempotent),
      action: row && row.action,
      snapshot_gravacoes: 0,
    },
  };
}

async function mutarVeiculoAtomico({
  veiculo,
  patch,
  baseRevision,
  operationId,
  actorUserId,
  actorSessionId,
  route,
  method,
  io,
  lerOficial,
}) {
  if (!atomicWriteAtivo()) {
    return { ok: false, status: 503, body: { ok: false, success: false, reason: "atomic_write_desligado" } };
  }
  if (!uuidOk(operationId)) {
    return { ok: false, status: 400, body: { ok: false, success: false, reason: "operation_id_obrigatorio" } };
  }
  const recebido = patch && typeof patch === "object" ? patch : veiculo;
  let oficial = null;
  if (typeof lerOficial === "function") {
    const lido = await lerOficial();
    if (!lido || lido.ok === false) {
      return {
        ok: false,
        status: (lido && lido.status) || 503,
        body: { ok: false, success: false, reason: (lido && lido.reason) || "leitura" },
      };
    }
    oficial = lido.veiculo || null;
    /* baseRevision global do browser não decide conflito; usa-se a linha lida agora. */
  }

  const anterior = oficial && typeof oficial === "object" ? oficial : {};
  const existe = Boolean(oficial && oficial.id != null);
  const action = existe ? "update" : "create";
  if (action === "update" && dkVeiculoEhResumo && dkVeiculoEhResumo(recebido)) {
    const sub = dkVeiculoSubstituir(anterior, recebido);
    if (!sub.ok) {
      return { ok: false, status: 400, body: { ok: false, success: false, reason: "resumo_nao_substitui_veiculo" } };
    }
  }
  const merged = dkVeiculoAplicarPatch(anterior, recebido || {});
  const persistido = dkVeiculoParaPersistencia(merged);
  if (!persistido.id || !String(persistido.placa || "").trim()) {
    return { ok: false, status: 400, body: { ok: false, success: false, reason: "veiculo" } };
  }

  const expected = action === "update" ? oficial.updated_at || null : null;
  const changed = camposAlterados(anterior, persistido.payload);
  const requestHash = hashPedido({
    domain: "veiculo",
    action,
    id: persistido.id,
    placa: persistido.placa,
    payload: persistido.payload,
    expected,
  });
  const eventPayload = {
    changed_fields: changed,
    revision_before: expected,
    route: route || "",
    method: method || "POST",
    operation_id: operationId,
    summary: action === "create" ? "Veículo criado" : "Veículo atualizado",
  };

  const rpc = await restRpc(
    RPC_VEICULO,
    {
      p_operation_id: operationId,
      p_action: action,
      p_id: String(persistido.id),
      p_placa: String(persistido.placa),
      p_payload: persistido.payload,
      p_expected_updated_at: expected,
      p_request_hash: requestHash,
      p_actor_user_id: actorUserId || null,
      p_actor_session_id: uuidOk(actorSessionId) ? actorSessionId : null,
      p_event_payload: eventPayload,
      p_visibility: "team",
    },
    io
  );

  if (!rpc.ok) {
    const err = classificarErroRpc(rpc.data, rpc.status);
    return {
      ok: false,
      status: err.status,
      body: {
        ok: false,
        success: false,
        reason: err.reason,
        detalhe: rpc.data || null,
      },
    };
  }

  const row = Array.isArray(rpc.data) ? rpc.data[0] : rpc.data;
  return {
    ok: true,
    status: 200,
    body: {
      ok: true,
      success: true,
      persistencia: "supabase",
      source: "dk_veiculos",
      entity_id: row && row.entity_id,
      record_version: row && row.record_revision,
      revision: row && row.record_revision,
      updated_at: row && row.record_revision,
      operation_id: row && row.operation_id,
      audit_no: row && row.audit_no != null ? Number(row.audit_no) : null,
      seq: row && row.seq != null ? Number(row.seq) : null,
      idempotent: Boolean(row && row.idempotent),
      action: row && row.action,
      snapshot_gravacoes: 0,
    },
  };
}

/**
 * Harness em memória: prova atomicidade/idempotência/rollback sem PG.
 */
function fixtureAtomicaMemoria({ mutar, evento, falharEvento, falharMutation, ops }) {
  const store = ops && typeof ops === "object" ? ops : { rows: new Map(), events: new Map(), audit: 0 };
  if (falharMutation) return { ok: false, reason: "mutation_falhou", store };
  const mut = typeof mutar === "function" ? mutar() : null;
  if (!mut || !mut.operation_id) return { ok: false, reason: "mutation_invalida", store };
  const prev = store.events.get(mut.operation_id);
  if (prev) {
    if (prev.request_hash !== mut.request_hash) return { ok: false, reason: "IDEMPOTENCY_CONFLICT", store };
    return { ok: true, idempotent: true, result: prev, store };
  }
  if (falharEvento) return { ok: false, reason: "evento_falhou", store, rows: store.rows, events: store.events };
  store.audit += 1;
  const ev = typeof evento === "function" ? evento(mut, store.audit) : null;
  if (!ev) return { ok: false, reason: "evento_falhou", store };
  store.rows.set(mut.entity_id, mut.payload);
  store.events.set(mut.operation_id, {
    ...ev,
    audit_no: store.audit,
    request_hash: mut.request_hash,
    operation_id: mut.operation_id,
  });
  return { ok: true, idempotent: false, result: store.events.get(mut.operation_id), store };
}

module.exports = {
  RPC_CLIENTE,
  RPC_VEICULO,
  atomicWriteAtivo,
  uuidOk,
  exigirOperationId,
  hashPedido,
  camposAlterados,
  mutarClienteAtomico,
  mutarVeiculoAtomico,
  fixtureAtomicaMemoria,
  classificarErroRpc,
  restRpc,
};
