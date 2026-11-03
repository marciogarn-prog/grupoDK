/**
 * Escopo de canal Realtime e identificadores opacos de cursor.
 * Isolamento empresa/filial só é seguro quando eventos trazem empresa_id
 * e o Broadcast publica no tópico correspondente.
 */
const crypto = require("crypto");

const EMPRESAS = new Set(["locadora", "centro", "construtora"]);

function normalizarEmpresa(v) {
  const e = String(v || "").trim().toLowerCase();
  return EMPRESAS.has(e) ? e : "";
}

function normalizarFilial(v) {
  const f = String(v || "").trim().toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 40);
  return f || "default";
}

/** Tópico privado por empresa. Sem empresa → null (não abrir canal partilhado). */
function topicoRealtime(empresa) {
  const e = normalizarEmpresa(empresa);
  if (!e) return null;
  return "dk:events:" + e;
}

function escopoOpaco(sid, empresa, filial) {
  const base = String(sid || "") + "|" + normalizarEmpresa(empresa) + "|" + normalizarFilial(filial);
  return crypto.createHash("sha256").update(base, "utf8").digest("hex").slice(0, 32);
}

/**
 * Estado atual: mutações atómicas passam null,null a dk_append_event.
 * Sem empresa_id nos eventos, Broadcast por empresa não é confiável.
 */
function isolamentoPronto(env) {
  const e = env || process.env;
  const flag = String(e.DK_REALTIME_SCOPE_ISOLATION || "0").trim() === "1";
  return {
    ok: flag,
    motivo: flag
      ? "flag_ligada_requer_prova_eventos_com_empresa"
      : "SCOPE_ISOLATION_BLOCKED",
    detalhe:
      "As RPCs atuais chamam dk_append_event com p_empresa_id/p_filial_id null. " +
      "O trigger publica só em dk:events. Até eventos e Broadcast serem por empresa comprovados, " +
      "o canal permanece bloqueado mesmo com JWT ES256.",
    topico_exemplo: "dk:events:locadora",
  };
}

module.exports = {
  EMPRESAS,
  normalizarEmpresa,
  normalizarFilial,
  topicoRealtime,
  escopoOpaco,
  isolamentoPronto,
};
