/**
 * Presença ao vivo (Usuários ativos no Log DK).
 * Atualiza public.dk_live_sessions via dk_presenca_tocar.
 */
const { isSupabaseDoormanConfigured } = require("./dk-supabase-doorman.cjs");
const { perfilHumano, rotuloMaquina } = require("./dk-log-apresentacao.cjs");

function textoCurto(valor, max) {
  return String(valor || "")
    .replace(/[\r\n\t]/g, " ")
    .trim()
    .slice(0, max);
}

function chaveServico() {
  return String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
}

function urlSupabase() {
  return String(process.env.SUPABASE_URL || "https://ppxtwqvzgujllfzarpuz.supabase.co")
    .trim()
    .replace(/\/$/, "");
}

function headersServico() {
  const key = chaveServico();
  return {
    apikey: key,
    Authorization: "Bearer " + key,
    Accept: "application/json",
    "Content-Type": "application/json",
  };
}

/**
 * @param {{
 *   sid: string,
 *   cpf?: string,
 *   nome?: string,
 *   role?: string,
 *   perfil?: string,
 *   maquina?: string,
 *   tela?: string,
 *   status?: string,
 *   navegador?: string,
 *   sistema?: string,
 * }} entrada
 */
async function tocarPresencaLive(entrada) {
  if (!isSupabaseDoormanConfigured()) return false;
  const sid = textoCurto(entrada && entrada.sid, 80);
  if (!sid) return false;
  const perfilCliente = textoCurto(entrada && entrada.perfil, 40);
  const roleGate = String((entrada && entrada.role) || "");
  const perfil =
    roleGate === "operacao" && perfilCliente && !/\d{8,}/.test(perfilCliente)
      ? perfilCliente
      : perfilHumano(roleGate, entrada && entrada.cpf);
  const statusBruto = textoCurto(entrada && entrada.status, 20);
  const status = ["ONLINE", "INATIVO", "RECONECTANDO", "EXPIRADO", "OFFLINE"].includes(statusBruto)
    ? statusBruto
    : "ONLINE";
  try {
    await fetch(urlSupabase() + "/rest/v1/rpc/dk_presenca_tocar", {
      method: "POST",
      headers: headersServico(),
      body: JSON.stringify({
        p_session_id: sid,
        p_user_id: textoCurto(entrada && entrada.cpf, 20),
        p_user_name: textoCurto(entrada && entrada.nome, 80),
        p_role: perfil,
        p_device_label: rotuloMaquina(entrada && entrada.maquina) || textoCurto(entrada && entrada.maquina, 40),
        p_screen: textoCurto(entrada && entrada.tela, 60) || "DK Locadora",
        p_status: status,
        p_browser: textoCurto(entrada && entrada.navegador, 40),
        p_os: textoCurto(entrada && entrada.sistema, 40),
      }),
    });
    return true;
  } catch {
    return false;
  }
}

async function listarSessoesLive() {
  if (!isSupabaseDoormanConfigured()) return [];
  try {
    const lista = await fetch(
      urlSupabase() +
        "/rest/v1/dk_live_sessions?select=session_id,user_id,user_name,role,device_label,session_started_at,last_activity_at,current_screen,status&order=session_started_at.asc",
      { headers: headersServico() }
    );
    const rows = await lista.json().catch(() => []);
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

module.exports = {
  tocarPresencaLive,
  listarSessoesLive,
  textoCurto,
};
