/**
 * Escopo Realtime DK — estratégia única: canal privado global sanitizado.
 * Sinal: { kind: "dk_changed", seq } sem PII.
 * Autorização de dados: /api/dk-sync (servidor), não o payload do WebSocket.
 */
const crypto = require("crypto");

const EMPRESAS = new Set(["locadora", "centro", "construtora"]);
const TOPICO_GLOBAL = "dk:events";

function normalizarEmpresa(v) {
  const e = String(v || "").trim().toLowerCase();
  return EMPRESAS.has(e) ? e : "";
}

function normalizarFilial(v) {
  const f = String(v || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "")
    .slice(0, 40);
  return f || "default";
}

/**
 * Canal operacional único (global sanitizado).
 * Isolamento por empresa fica reservado a DK_REALTIME_SCOPE_ISOLATION=1
 * somente quando eventos comprovarem empresa_id.
 */
function topicoRealtime(empresa, env) {
  const e = env || process.env;
  if (String(e.DK_REALTIME_SCOPE_ISOLATION || "0").trim() === "1") {
    const emp = normalizarEmpresa(empresa);
    if (!emp) return null;
    return "dk:events:" + emp;
  }
  return TOPICO_GLOBAL;
}

function canalPermitido(nome, env) {
  const n = String(nome || "").trim();
  if (!n) return false;
  if (n === TOPICO_GLOBAL) {
    return String((env || process.env).DK_REALTIME_SCOPE_ISOLATION || "0").trim() !== "1";
  }
  return /^dk:events:(locadora|centro|construtora)$/.test(n);
}

function escopoOpaco(sid, empresa, filial) {
  const base = String(sid || "") + "|" + normalizarEmpresa(empresa) + "|" + normalizarFilial(filial);
  return crypto.createHash("sha256").update(base, "utf8").digest("hex").slice(0, 32);
}

/**
 * Isolamento por empresa NÃO é pré-requisito do canal global sanitizado.
 * SCOPE_ISOLATION só bloqueia se a flag estiver ligada sem empresa comprovada.
 */
function isolamentoPronto(env) {
  const e = env || process.env;
  const scopeOn = String(e.DK_REALTIME_SCOPE_ISOLATION || "0").trim() === "1";
  if (!scopeOn) {
    return {
      ok: true,
      modo: "global_sanitizado",
      topico: TOPICO_GLOBAL,
      detalhe:
        "Canal privado dk:events com sinal kind=dk_changed (sem PII). " +
        "Dados oficiais só via /api/dk-sync autenticado.",
    };
  }
  return {
    ok: false,
    motivo: "SCOPE_ISOLATION_BLOCKED",
    detalhe:
      "DK_REALTIME_SCOPE_ISOLATION=1 exige empresa_id nos eventos e tópico por empresa. " +
      "RPCs atuais ainda passam null. Desligue a flag ou complete o preenchimento de empresa_id.",
    topico_exemplo: "dk:events:locadora",
  };
}

module.exports = {
  EMPRESAS,
  TOPICO_GLOBAL,
  normalizarEmpresa,
  normalizarFilial,
  topicoRealtime,
  canalPermitido,
  escopoOpaco,
  isolamentoPronto,
};
