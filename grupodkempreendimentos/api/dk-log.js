/**
 * Esqueleto do Log DK. Só o administrador (role owner) entra.
 * Lê só public.dk_events. Não consulta cadastros, pagamentos, snapshot nem o navegador.
 */
const { applyApiCors, requireLiveSession, assertEquipaClientProtocol } = require("../lib/dk-portal-auth.cjs");
const { decidirAcessoLog, estadoLog } = require("../lib/dk-log-acesso.cjs");
const { lerEventosLog } = require("../lib/dk-log-leitura.cjs");
const { ordenarSessoes } = require("../lib/dk-log-apresentacao.cjs");
const { tocarPresencaLive, listarSessoesLive } = require("../lib/dk-live-presenca.cjs");

module.exports = async function handler(req, res) {
  applyApiCors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, reason: "method", fallback: false, events: [], eventos: [] });
  }
  const gate = await requireLiveSession(req, { allowCliente: false, allowEquipa: true, allowService: false });
  if (!gate.ok) {
    return res.status(gate.status || 401).json({ ok: false, reason: gate.reason || "unauthorized", fallback: false, events: [], eventos: [] });
  }
  const proto = assertEquipaClientProtocol(gate, req);
  if (!proto.ok) {
    return res.status(proto.status || 403).json({ ok: false, reason: proto.reason || "forbidden", fallback: false, events: [], eventos: [] });
  }
  const acesso = decidirAcessoLog(gate);
  if (!acesso.ok) {
    return res.status(acesso.status || 403).json({ ok: false, reason: acesso.reason, fallback: false, events: [], eventos: [] });
  }
  const q = req.query || {};
  const lido = await lerEventosLog(undefined, { before: q.before, limit: q.limit });
  if (!lido.ok) {
    return res.status(lido.status || 503).json({
      ok: false,
      reason: lido.reason || "log_leitura",
      fallback: false,
      events: [],
      eventos: [],
      quantidade: 0,
      server_event_seq: 0,
    });
  }
  const sessoes = await presencaDaLeitura(gate, q).catch(() => []);
  return res.status(200).json(estadoLog(lido, sessoes));
};

async function presencaDaLeitura(gate, q) {
  await tocarPresencaLive({
    sid: gate && gate.sid,
    cpf: gate && gate.cpf,
    nome: gate && gate.nome,
    role: gate && gate.role,
    perfil: q && q.perfil,
    maquina: q && q.maquina,
    tela: (q && q.tela) || "Log DK",
    status: "ONLINE",
    navegador: q && q.navegador,
    sistema: q && q.sistema,
  }).catch(() => false);
  const rows = await listarSessoesLive().catch(() => []);
  return ordenarSessoes(rows, new Date());
}
