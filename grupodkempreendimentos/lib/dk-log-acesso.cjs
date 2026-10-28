/**
 * Acesso ao Log DK. Não lê cadastros e não grava eventos.
 * Administrador é o perfil owner já usado pelo portal.
 */
const COLUNAS = ["seq", "dataHora", "usuario", "sessao", "modulo", "tipo", "entidade", "acao"];

function decidirAcessoLog(gate) {
  if (!gate || gate.ok === false) {
    return { ok: false, status: gate && gate.status ? gate.status : 401, reason: (gate && gate.reason) || "unauthorized" };
  }
  if (gate.service || String(gate.typ || "") !== "equipa" || String(gate.role || "").trim() !== "owner") {
    return { ok: false, status: 403, reason: "log_somente_administrador" };
  }
  return { ok: true };
}

function estadoLog() {
  return {
    ok: true,
    titulo: "Log DK",
    estado: "Infraestrutura de eventos em preparação",
    fonte: "dk_events",
    eventos: [],
    colunas: COLUNAS.slice(),
    fallback: false,
  };
}

module.exports = { COLUNAS, decidirAcessoLog, estadoLog };
