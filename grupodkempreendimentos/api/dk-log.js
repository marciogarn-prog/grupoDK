/**
 * Esqueleto do Log DK. Só o administrador (role owner) entra.
 * Lê só public.dk_events. Não consulta cadastros, pagamentos, snapshot nem o navegador.
 */
const { applyApiCors, requireLiveSession, assertEquipaClientProtocol } = require("../lib/dk-portal-auth.cjs");
const { decidirAcessoLog, estadoLog } = require("../lib/dk-log-acesso.cjs");
const { lerEventosLog } = require("../lib/dk-log-leitura.cjs");
const { ordenarSessoes } = require("../lib/dk-log-apresentacao.cjs");
const { isSupabaseDoormanConfigured } = require("../lib/dk-supabase-doorman.cjs");

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

function textoCurto(valor, max) {
  return String(valor || "").replace(/[\r\n\t]/g, " ").trim().slice(0, max);
}

function chaveServico() {
  return String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
}

function urlSupabase() {
  return String(process.env.SUPABASE_URL || "https://ppxtwqvzgujllfzarpuz.supabase.co").trim().replace(/\/$/, "");
}

async function presencaDaLeitura(gate, q) {
  if (!isSupabaseDoormanConfigured()) return [];
  const sid = textoCurto(gate && gate.sid, 80);
  if (!sid) return [];
  const headers = {
    apikey: chaveServico(),
    Authorization: "Bearer " + chaveServico(),
    Accept: "application/json",
    "Content-Type": "application/json",
  };
  await fetch(urlSupabase() + "/rest/v1/rpc/dk_presenca_tocar", {
    method: "POST",
    headers,
    body: JSON.stringify({
      p_session_id: sid,
      p_user_id: textoCurto(gate.cpf, 20),
      p_user_name: textoCurto(gate.nome, 80),
      p_role: textoCurto(gate.role, 40),
      p_device_label: textoCurto(q.maquina, 40),
      p_screen: textoCurto(q.tela, 60) || "Log DK",
      p_status: "ONLINE",
      p_browser: textoCurto(q.navegador, 40),
      p_os: textoCurto(q.sistema, 40),
    }),
  }).catch(() => null);
  const lista = await fetch(
    urlSupabase() + "/rest/v1/dk_live_sessions?select=session_id,user_name,role,device_label,session_started_at,last_activity_at,current_screen,status&order=session_started_at.asc",
    { headers }
  );
  const rows = await lista.json().catch(() => []);
  return ordenarSessoes(Array.isArray(rows) ? rows : [], new Date());
}
