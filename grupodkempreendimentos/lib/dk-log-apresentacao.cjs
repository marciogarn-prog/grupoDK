/**
 * Apresentação do Log DK. Não lê cadastro e não grava evento.
 */
const TTL_MS = 30 * 60 * 1000;
const SENSIVEIS = ["cpf", "cnh", "telefone", "endereco", "endereço", "senha", "foto", "pdf", "base64", "latitude", "longitude"];

function mascararTexto(valor) {
  return String(valor == null ? "" : valor).replace(/\d{11}/g, "•••.•••.•••-••");
}

function resumoEvento(evento) {
  const item = evento && typeof evento === "object" ? evento : {};
  const details = item.details && typeof item.details === "object" ? item.details : {};
  if (details.summary) return mascararTexto(details.summary);
  const payload = item.payload && typeof item.payload === "object" ? item.payload : {};
  if (payload.message) return mascararTexto(payload.message);
  if (item.event_type === "system.log_initialized") return "Log inicializado";
  if (item.event_type === "system.realtime_initialized") return "Realtime inicializado";
  return mascararTexto(item.action || item.event_type || "");
}

function objetoLimpo(valor) {
  if (!valor || typeof valor !== "object" || Array.isArray(valor)) return {};
  const saida = {};
  Object.keys(valor).forEach((chave) => {
    const nome = String(chave).toLowerCase();
    if (SENSIVEIS.some((parte) => nome.includes(parte))) return;
    const cru = valor[chave];
    if (cru && typeof cru === "object") return;
    const texto = mascararTexto(cru);
    if (texto.length > 180) return;
    saida[chave] = texto;
  });
  return saida;
}

function sanitizarEvento(row) {
  const item = row && typeof row === "object" ? row : {};
  const nome = item.actor_name_snapshot || (item.actor_user_id ? "" : "Sistema");
  return {
    audit_no: item.audit_no == null ? null : Number(item.audit_no),
    seq: Number(item.seq),
    created_at: item.created_at == null ? null : String(item.created_at),
    actor_name: mascararTexto(nome || item.actor_user_id || "Sistema"),
    actor_role: item.actor_role_snapshot == null ? "" : String(item.actor_role_snapshot),
    device_label: item.device_label == null ? "" : String(item.device_label),
    module: item.module == null ? "" : String(item.module),
    entity_type: item.entity_type == null ? "" : String(item.entity_type),
    entity_id: item.entity_id == null ? "" : mascararTexto(item.entity_id),
    action: item.action == null ? "" : String(item.action),
    event_type: item.event_type == null ? "" : String(item.event_type),
    result: item.result == null ? "success" : String(item.result),
    severity: item.severity == null ? "info" : String(item.severity),
    operation_id: item.operation_id == null ? "" : String(item.operation_id),
    record_version: item.record_version == null ? null : Number(item.record_version),
    summary: resumoEvento(item),
    context: objetoLimpo(item.context),
    details: objetoLimpo(item.details),
  };
}

function doisPrimeirosNomes(nome) {
  const partes = String(nome || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!partes.length) return "Sessão";
  return partes.slice(0, 2).join(" ");
}

function perfilHumano(role, userId) {
  const papel = String(role || "").trim();
  const cpf = String(userId || "").replace(/\D/g, "").slice(0, 11);
  if (papel === "Administrador CEO" || papel === "Administrador" || papel === "Colaborador") return papel;
  if (cpf === "03037897430" && (papel === "owner" || papel === "Administrador")) return "Administrador CEO";
  if (papel === "owner") return "Administrador";
  if (papel === "operacao" || papel === "op") return "Colaborador";
  return papel;
}

function rotuloMaquina(valor) {
  const cru = String(valor || "").trim();
  if (!cru) return "";
  if (/win/i.test(cru)) return "Windows";
  if (/mac/i.test(cru)) return "macOS";
  if (/android/i.test(cru)) return "Android";
  if (/iphone|ipad|ios/i.test(cru)) return "iPhone";
  if (/linux/i.test(cru)) return "Linux";
  return cru;
}

function statusPresenca(row, agora) {
  const item = row && typeof row === "object" ? row : {};
  const gravado = String(item.status || "ONLINE");
  if (gravado === "OFFLINE") return "OFFLINE";
  const visto = new Date(item.last_activity_at || 0).getTime();
  const agoraMs = agora instanceof Date ? agora.getTime() : Number(agora) || Date.now();
  if (!Number.isFinite(visto) || agoraMs - visto >= TTL_MS) return "EXPIRADO";
  if (gravado === "INATIVO" || gravado === "RECONECTANDO" || gravado === "ONLINE") return gravado;
  return "ONLINE";
}

function ordenarSessoes(rows, agora) {
  const lista = (Array.isArray(rows) ? rows : [])
    .map((row) => ({ ...row, status: statusPresenca(row, agora) }))
    .filter((row) => row.status === "ONLINE" || row.status === "INATIVO" || row.status === "RECONECTANDO");
  lista.sort((a, b) => new Date(a.session_started_at).getTime() - new Date(b.session_started_at).getTime());
  return lista.map((row, indice) => ({
    prioridade: indice + 1,
    usuario: doisPrimeirosNomes(row.user_name || "Sessão"),
    perfil: perfilHumano(row.role, row.user_id),
    maquina: rotuloMaquina(row.device_label),
    entrada: row.session_started_at || null,
    ultima: row.last_activity_at || null,
    tela: row.current_screen || "",
    status: row.status,
  }));
}

module.exports = {
  TTL_MS,
  mascararTexto,
  resumoEvento,
  sanitizarEvento,
  statusPresenca,
  ordenarSessoes,
  doisPrimeirosNomes,
  perfilHumano,
  rotuloMaquina,
};
