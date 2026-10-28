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

function estadoLog(lido) {
  const events = lido && Array.isArray(lido.events) ? lido.events : [];
  return {
    ok: true,
    titulo: "Log DK",
    estado: "Infraestrutura de eventos em preparação",
    fonte: "dk_events",
    events,
    eventos: events,
    quantidade: lido && Number.isFinite(lido.quantidade) ? lido.quantidade : events.length,
    server_event_seq: lido && Number.isFinite(lido.server_event_seq) ? lido.server_event_seq : 0,
    colunas: COLUNAS.slice(),
    fallback: false,
  };
}

module.exports = { COLUNAS, decidirAcessoLog, estadoLog };
