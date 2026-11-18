/**
 * Envio de comando EC33 por SMS (chip do rastreador).
 * Se TWILIO_* estiver na Vercel, envia de verdade.
 * Senão devolve smsUri para o telemóvel/PC abrir o SMS nativo.
 */
function onlyDigits(s) {
  return String(s ?? "").replace(/\D/g, "");
}

function normMsisdnBr(s) {
  let d = onlyDigits(s);
  if (d.startsWith("00")) d = d.slice(2);
  if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
  if (d.length === 10 || d.length === 11) d = `55${d}`;
  if (d.length === 12 && d.startsWith("55")) {
    /* 55 + 10 dígitos (fix) */
  }
  if (d.length < 12 || d.length > 13) return "";
  return d;
}

function smsDeepLink(msisdn, body) {
  const to = normMsisdnBr(msisdn);
  const text = encodeURIComponent(String(body || "").trim());
  // Android / Phone Link: sms:+55...?body=
  return {
    to,
    smsUri: `sms:+${to}?body=${text}`,
    smsUriAlt: `sms:${to}?body=${text}`,
  };
}

async function enviarSmsTwilio(msisdn, body) {
  const sid = String(process.env.TWILIO_ACCOUNT_SID || "").trim();
  const token = String(process.env.TWILIO_AUTH_TOKEN || "").trim();
  const from = String(process.env.TWILIO_FROM_NUMBER || "").trim();
  if (!sid || !token || !from) {
    return { ok: false, reason: "twilio_nao_configurado" };
  }
  const to = normMsisdnBr(msisdn);
  if (!to) return { ok: false, reason: "msisdn_invalido" };
  const auth = Buffer.from(`${sid}:${token}`).toString("base64");
  const params = new URLSearchParams({
    To: `+${to}`,
    From: from.startsWith("+") ? from : `+${onlyDigits(from)}`,
    Body: String(body || "").trim(),
  });
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });
  const raw = await res.text();
  let data = null;
  try {
    data = JSON.parse(raw);
  } catch {
    data = { raw };
  }
  if (!res.ok) {
    return {
      ok: false,
      reason: "twilio_falhou",
      status: res.status,
      detail: data?.message || data?.raw || raw.slice(0, 300),
    };
  }
  return { ok: true, via: "twilio", sid: data?.sid || null };
}

/**
 * @param {{ msisdn: string, cmd: string }} opts
 */
async function enviarComandoSms(opts) {
  const cmd = String(opts.cmd || "").trim();
  const msisdn = normMsisdnBr(opts.msisdn);
  if (!cmd) return { ok: false, status: 400, body: { ok: false, msg: "Comando vazio." } };
  if (!msisdn) return { ok: false, status: 400, body: { ok: false, msg: "Número do chip inválido." } };

  const link = smsDeepLink(msisdn, cmd);
  const tw = await enviarSmsTwilio(msisdn, cmd);
  if (tw.ok) {
    return {
      ok: true,
      status: 200,
      body: {
        ok: true,
        success: true,
        via: "twilio",
        msisdn: `+${msisdn}`,
        cmd,
        sid: tw.sid,
        ...link,
      },
    };
  }

  return {
    ok: true,
    status: 200,
    body: {
      ok: true,
      success: true,
      via: "sms_uri",
      msisdn: `+${msisdn}`,
      cmd,
      msg: "Abra o SMS no telemóvel (ou Phone Link) e toque em enviar. Sem Twilio na Vercel o DK abre o SMS nativo.",
      twilio: tw.reason || "twilio_nao_configurado",
      ...link,
    },
  };
}

module.exports = {
  onlyDigits,
  normMsisdnBr,
  smsDeepLink,
  enviarSmsTwilio,
  enviarComandoSms,
};
