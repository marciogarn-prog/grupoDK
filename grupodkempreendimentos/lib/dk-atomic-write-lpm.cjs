/**
 * Escrita atômica Locação / Pagamento / Manutenção.
 */
const crypto = require("crypto");
const { restRpc, uuidOk, hashPedido, classificarErroRpc, atomicWriteAtivo } = require("./dk-atomic-write.cjs");
const { normalizarOperacao } = require("./dk-pagamento-operacao.cjs");
const { dkLocacaoAplicarPatch, dkLocacaoParaPersistencia } = require("./dk-locacao-fidelidade.cjs");
const { dkManutencaoAplicarPatch, dkManutencaoParaPersistencia } = require("./dk-manutencao-fidelidade.cjs");

function sha(obj) {
  return crypto.createHash("sha256").update(JSON.stringify(obj), "utf8").digest("hex");
}

async function mutarLocacaoAtomico({
  action,
  locacao,
  numeroContrato,
  expectedVersion,
  operationId,
  actorUserId,
  actorSessionId,
  route,
  method,
  io,
}) {
  if (!atomicWriteAtivo()) return { ok: false, status: 503, body: { ok: false, reason: "atomic_write_desligado" } };
  if (!uuidOk(operationId)) return { ok: false, status: 400, body: { ok: false, reason: "operation_id_obrigatorio" } };
  const act = String(action || "update").toLowerCase();
  const persistido = dkLocacaoParaPersistencia(locacao || {});
  const nc = String(numeroContrato || persistido.numero_contrato || "").replace(/\D/g, "");
  if (!nc) return { ok: false, status: 400, body: { ok: false, reason: "protocolo_obrigatorio" } };
  const campos = persistido.campos || persistido.payload || locacao;
  const requestHash = hashPedido({ domain: "locacao", action: act, nc, campos, expectedVersion });
  const eventPayload = {
    changed_fields: Object.keys(campos || {}).slice(0, 40),
    revision_before: expectedVersion,
    route: route || "",
    method: method || "POST",
    operation_id: operationId,
    summary: "Locação " + act,
  };
  const rpc = await restRpc(
    "dk_locacao_mutate_with_event",
    {
      p_operation_id: operationId,
      p_action: act,
      p_numero_contrato: nc,
      p_campos: campos,
      p_expected_version: act === "create" ? null : expectedVersion == null ? null : Number(expectedVersion),
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
    return { ok: false, status: err.status, body: { ok: false, reason: err.reason, detalhe: rpc.data } };
  }
  const row = Array.isArray(rpc.data) ? rpc.data[0] : rpc.data;
  return {
    ok: true,
    status: 200,
    body: {
      ok: true,
      success: true,
      entity_id: row && row.entity_id,
      version: row && row.record_version,
      record_version: row && row.record_version,
      operation_id: row && row.operation_id,
      audit_no: row && row.audit_no != null ? Number(row.audit_no) : null,
      seq: row && row.seq != null ? Number(row.seq) : null,
      idempotent: Boolean(row && row.idempotent),
      action: row && row.action,
    },
  };
}

async function mutarPagamentoAtomico({
  operacao,
  pagamento,
  id,
  numeroContrato,
  expectedVersion,
  operationId,
  actorUserId,
  actorSessionId,
  route,
  method,
  io,
}) {
  if (!atomicWriteAtivo()) return { ok: false, status: 503, body: { ok: false, reason: "atomic_write_desligado" } };
  if (!uuidOk(operationId)) return { ok: false, status: 400, body: { ok: false, reason: "operation_id_obrigatorio" } };
  const act = normalizarOperacao(operacao) || String(operacao || "").trim();
  if (!act) return { ok: false, status: 400, body: { ok: false, reason: "acao_invalida" } };
  const nc = String(numeroContrato || "").trim();
  if (!nc) return { ok: false, status: 400, body: { ok: false, reason: "contrato_obrigatorio" } };
  const pagId = id || (pagamento && pagamento.id) || null;
  const requestHash = hashPedido({
    domain: "pagamento",
    action: act,
    nc,
    id: pagId,
    pagamento: act === "remove" ? null : pagamento,
    expectedVersion,
  });
  const eventPayload = {
    changed_fields: act === "remove" ? ["removido"] : Object.keys(pagamento || {}).slice(0, 20),
    revision_before: expectedVersion,
    route: route || "",
    method: method || "POST",
    operation_id: operationId,
    summary: "Pagamento " + act,
    numero_contrato: nc,
  };
  const rpc = await restRpc(
    "dk_pagamento_mutate_with_event",
    {
      p_operation_id: operationId,
      p_action: act,
      p_pagamento_id: pagId,
      p_numero_contrato: nc,
      p_payload: act === "remove" ? {} : pagamento,
      p_expected_version: act === "create" ? null : expectedVersion == null ? null : Number(expectedVersion),
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
    return { ok: false, status: err.status, body: { ok: false, reason: err.reason, detalhe: rpc.data, mutated: false } };
  }
  const row = Array.isArray(rpc.data) ? rpc.data[0] : rpc.data;
  return {
    ok: true,
    status: 200,
    body: {
      ok: true,
      success: true,
      mutated: true,
      entity_id: row && row.entity_id,
      version: row && row.record_version,
      record_version: row && row.record_version,
      operation_id: row && row.operation_id,
      audit_no: row && row.audit_no != null ? Number(row.audit_no) : null,
      seq: row && row.seq != null ? Number(row.seq) : null,
      idempotent: Boolean(row && row.idempotent),
      action: row && row.action,
      removido: Boolean(row && row.removido),
      inserted: row && row.inserted ? 1 : 0,
      updated: act === "update" ? 1 : 0,
      deleted: act === "remove" ? 1 : 0,
      fallback: false,
    },
  };
}

async function mutarManutencaoAtomico({
  action,
  id,
  sourceKind,
  manutencao,
  expectedVersion,
  operationId,
  actorUserId,
  actorSessionId,
  route,
  method,
  io,
}) {
  if (!atomicWriteAtivo()) return { ok: false, status: 503, body: { ok: false, reason: "atomic_write_desligado" } };
  if (!uuidOk(operationId)) return { ok: false, status: 400, body: { ok: false, reason: "operation_id_obrigatorio" } };
  const act = String(action || "update").toLowerCase();
  const merged = dkManutencaoAplicarPatch({}, manutencao || {});
  const persistido = dkManutencaoParaPersistencia(merged, sourceKind === "rapida" ? "rapida" : "historico");
  const requestHash = hashPedido({
    domain: "manutencao",
    action: act,
    id,
    payload: persistido.payload,
    expectedVersion,
  });
  const eventPayload = {
    changed_fields: Object.keys(persistido.payload || {}).slice(0, 30),
    revision_before: expectedVersion,
    route: route || "",
    method: method || "POST",
    operation_id: operationId,
    summary: "Manutenção " + act,
  };
  const rpc = await restRpc(
    "dk_manutencao_mutate_with_event",
    {
      p_operation_id: operationId,
      p_action: act,
      p_id: id || persistido.id || null,
      p_source_kind: sourceKind === "rapida" ? "rapida" : "historico",
      p_payload: persistido.payload,
      p_expected_version: act === "create" ? null : expectedVersion == null ? null : Number(expectedVersion),
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
    return { ok: false, status: err.status, body: { ok: false, reason: err.reason, detalhe: rpc.data } };
  }
  const row = Array.isArray(rpc.data) ? rpc.data[0] : rpc.data;
  return {
    ok: true,
    status: 200,
    body: {
      ok: true,
      success: true,
      entity_id: row && row.entity_id,
      record_version: row && row.record_version,
      operation_id: row && row.operation_id,
      audit_no: row && row.audit_no != null ? Number(row.audit_no) : null,
      seq: row && row.seq != null ? Number(row.seq) : null,
      idempotent: Boolean(row && row.idempotent),
      action: row && row.action,
    },
  };
}

module.exports = {
  mutarLocacaoAtomico,
  mutarPagamentoAtomico,
  mutarManutencaoAtomico,
  sha,
};
