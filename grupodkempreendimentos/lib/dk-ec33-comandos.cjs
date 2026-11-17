/**
 * Comandos SMS/USB do rastreador EC33 (protocolo GT06, terminados em #).
 */
function onlyDigits(s) {
  return String(s ?? "").replace(/\D/g, "");
}

function normImei(s) {
  return onlyDigits(s).slice(0, 15);
}

function normPlaca(s) {
  return String(s ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

/**
 * @param {string} tipo
 * @param {Record<string, unknown>} [params]
 */
function montarComandoEc33(tipo, params = {}) {
  const t = String(tipo || "")
    .trim()
    .toLowerCase();
  const p = params && typeof params === "object" ? params : {};
  switch (t) {
    case "status":
      return "STATUS#";
    case "where":
      return "WHERE#";
    case "param":
      return "PARAM#";
    case "server":
      return "SERVER#";
    case "timer_consulta":
      return "TIMER#";
    case "timer": {
      const t1 = Math.max(5, Math.min(60, Number(p.t1) || 30));
      const t2 = Math.max(5, Math.min(1800, Number(p.t2) || 1800));
      return `TIMER,${t1},${t2}#`;
    }
    case "relay_on":
    case "bloqueio_on":
      return "RELAY,1#";
    case "relay_off":
    case "bloqueio_off":
      return "RELAY,0#";
    case "moving_on":
    case "cerca_on": {
      const metros = Math.max(50, Math.min(50000, Number(p.metros) || Number(p.raio) || 500));
      return `MOVING,ON,${metros},0#`;
    }
    case "moving_off":
    case "cerca_off":
      return "MOVING,OFF#";
    case "reset":
      return "RESET#";
    case "raw": {
      let cmd = String(p.cmd || p.comando || "").trim();
      if (!cmd) return "";
      if (!cmd.endsWith("#")) cmd += "#";
      return cmd;
    }
    default:
      return "";
  }
}

function rotuloComando(tipo) {
  const map = {
    status: "Consultar STATUS",
    where: "Consultar WHERE (posição)",
    param: "Consultar PARAM",
    timer: "Aplicar TIMER (periodicidade)",
    timer_consulta: "Consultar TIMER",
    relay_on: "Ativar bloqueio (RELAY,1)",
    relay_off: "Desativar bloqueio (RELAY,0)",
    cerca_on: "Ativar cerca / MOVING",
    cerca_off: "Desativar cerca / MOVING",
    reset: "Reiniciar rastreador",
    raw: "Comando livre",
  };
  return map[String(tipo || "").toLowerCase()] || String(tipo || "comando");
}

module.exports = {
  onlyDigits,
  normImei,
  normPlaca,
  montarComandoEc33,
  rotuloComando,
};
