/**
 * Gate de escrita fracionada. Desligado por omissão.
 * Não consulta banco, não grava e não aceita ordem do cliente para ligar.
 */
const store = require("./dk-pagamento-locacao-store.cjs");

const FLAG = "DK_PAGAMENTO_FRACTIONATED_WRITE_CANARY";
const CONTRATO_CANARIO = "2026102701";
const OPERACOES = new Set(["create", "update", "remove"]);

function flagLigada(env) {
  const fonte = env && typeof env === "object" ? env : {};
  return String(fonte[FLAG] == null ? "" : fonte[FLAG]).trim() === "1";
}

function negar(status, reason) {
  return {
    ok: false,
    passar: false,
    status,
    reason,
    mutated: false,
    fallback: false,
    inserted: 0,
    updated: 0,
    deleted: 0,
    legado: false,
  };
}

function avaliarEscritaCanario(pedido, env) {
  const body = pedido && typeof pedido === "object" ? pedido : {};
  if (body.autenticado !== true) return negar(401, "unauthorized");
  if (!flagLigada(env)) return negar(405, "write_canary_disabled");
  const numero = String(body.numeroContrato || "").trim();
  if (numero !== CONTRATO_CANARIO) return negar(403, "write_canary_contract_not_allowed");
  const op = String(body.operacao || "").trim();
  if (!OPERACOES.has(op)) return negar(400, "acao_invalida");
  if (op === "update" || op === "remove") {
    const versao = Number(body.version);
    if (!Number.isInteger(versao) || versao < 1) return negar(400, "version_required");
    if (body.versionAtual != null && body.versionAtual !== "") {
      const conflito = store.decidirVersao(body.versionAtual, versao);
      if (!conflito.ok) return negar(409, "version_conflict");
    }
  }
  if (op === "create" || op === "update") {
    const check = store.validarPagamento(body.pagamento, numero);
    if (!check.ok) return negar(check.status || 400, check.reason || "pagamento_invalido");
  }
  if (op === "remove") {
    const id = String(body.id || "").trim();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      return negar(400, "id_obrigatorio");
    }
  }
  if (op === "create" && Array.isArray(body.existentes)) {
    const dup = store.encontrarDuplicidade(body.pagamento, body.existentes);
    if (!dup.ok) return negar(409, dup.reason || "duplicate_payment_same_day_value");
  }
  return {
    ok: true,
    passar: true,
    status: 200,
    reason: "gate_ok",
    contrato: CONTRATO_CANARIO,
    operacao: op,
    mutated: false,
    fallback: false,
    legado: false,
  };
}

function respostaHttp(decisao) {
  const base = {
    ok: false,
    fallback: false,
    mutated: false,
    inserted: 0,
    updated: 0,
    deleted: 0,
  };
  if (!decisao || decisao.passar !== true) {
    if (!decisao || decisao.reason === "write_canary_disabled" || decisao.reason === "write_not_active") {
      return { status: 405, body: { ...base, reason: "write_not_active", gate: "write_canary_disabled" } };
    }
    return { status: decisao.status || 403, body: { ...base, reason: decisao.reason } };
  }
  return { status: 405, body: { ...base, reason: "write_not_active", gate: "engine_ausente" } };
}

async function aplicarEscritaCanario(pedido, deps) {
  const env = deps && deps.env ? deps.env : {};
  const decisao = avaliarEscritaCanario(pedido, env);
  if (!decisao.passar) return decisao;
  if (!deps || typeof deps.engine !== "function") return respostaHttp(decisao).body;
  if (typeof deps.fetch === "function") {
    throw new Error("escrita_canario_sem_rede");
  }
  const out = await deps.engine({
    numeroContrato: CONTRATO_CANARIO,
    operacao: decisao.operacao,
    pagamento: pedido.pagamento || null,
    version: pedido.version == null ? null : Number(pedido.version),
    id: pedido.id || null,
  });
  return {
    ok: Boolean(out && out.ok),
    status: out && out.status ? out.status : 200,
    reason: "gate_ok",
    passouGate: true,
    mutated: false,
    fallback: false,
    inserted: 0,
    updated: 0,
    deleted: 0,
    legado: false,
    engine: true,
  };
}

module.exports = {
  FLAG,
  CONTRATO_CANARIO,
  flagLigada,
  avaliarEscritaCanario,
  respostaHttp,
  aplicarEscritaCanario,
};
