/**
 * Envia backup por e-mail (Resend API ou SMTP / Gmail).
 */
const zlib = require("zlib");

const DEFAULT_TO = "marciogarn@gmail.com";

function resolveRecipients() {
  const raw = process.env.DK_BACKUP_EMAIL_TO || DEFAULT_TO;
  return raw
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function buildSummaryHtml(payload, meta) {
  const counts = payload.counts || {};
  const lines = Object.entries(counts)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, n]) => `<li><strong>${k}</strong>: ${n}</li>`)
    .join("");

  const redis = payload.redisCounts
    ? `<p>Redis (cadastros portal): clientes ${payload.redisCounts.clientes}, veículos ${payload.redisCounts.veiculos}, locações ${payload.redisCounts.locacoes}.</p>`
    : "<p>Redis: não configurado ou indisponível.</p>";

  return `
    <p>Backup automático do <strong>Grupo DK Empreendimentos</strong>.</p>
    <p>Data/hora (Brasília): <strong>${payload.exportedAtBr || payload.exportedAtIso}</strong></p>
    <p>Supabase: ${payload.sources?.supabase?.ok ? "OK" : `falha (${payload.sources?.supabase?.reason || "?"})`}</p>
    ${redis}
    <p>Registos no snapshot:</p>
    <ul>${lines || "<li>(vazio)</li>"}</ul>
    <p>Anexo: <strong>${meta.filename}</strong> (${meta.sizeHuman}, ${meta.compressed ? "compactado gzip" : "JSON"}).</p>
    <p style="color:#666;font-size:12px">Gerado por cron Vercel. Guarde o ficheiro em local seguro.</p>
  `;
}

function humanSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function prepareAttachment(jsonString) {
  const raw = Buffer.from(jsonString, "utf8");
  const useGzip = raw.length > 512 * 1024;
  if (!useGzip) {
    return {
      filename: "backup.json",
      content: raw.toString("base64"),
      contentType: "application/json",
      compressed: false,
      sizeHuman: humanSize(raw.length),
    };
  }
  const gz = zlib.gzipSync(raw, { level: 9 });
  return {
    filename: "backup.json.gz",
    content: gz.toString("base64"),
    contentType: "application/gzip",
    compressed: true,
    sizeHuman: humanSize(gz.length),
  };
}

async function sendViaResend({ to, subject, html, attachment }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM || process.env.DK_BACKUP_EMAIL_FROM;
  if (!apiKey || !from) return { ok: false, reason: "resend_not_configured" };

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to,
      subject,
      html,
      attachments: [
        {
          filename: attachment.filename,
          content: attachment.content,
          content_type: attachment.contentType,
        },
      ],
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { ok: false, reason: "resend_error", status: res.status, detail: body };
  }
  return { ok: true, provider: "resend", id: body.id };
}

async function sendViaSmtp({ to, subject, html, attachment }) {
  let nodemailer;
  try {
    nodemailer = require("nodemailer");
  } catch {
    return { ok: false, reason: "nodemailer_missing" };
  }

  const host = process.env.SMTP_HOST || "smtp.gmail.com";
  const port = Number(process.env.SMTP_PORT || 465);
  const user = process.env.SMTP_USER || process.env.DK_BACKUP_SMTP_USER;
  const pass = process.env.SMTP_PASS || process.env.DK_BACKUP_SMTP_PASS;
  const from = process.env.DK_BACKUP_EMAIL_FROM || user;

  if (!user || !pass) return { ok: false, reason: "smtp_not_configured" };

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  const info = await transporter.sendMail({
    from: from || user,
    to: to.join(", "),
    subject,
    html,
    attachments: [
      {
        filename: attachment.filename,
        content: Buffer.from(attachment.content, "base64"),
        contentType: attachment.contentType,
      },
    ],
  });

  return { ok: true, provider: "smtp", messageId: info.messageId };
}

async function sendBackupEmail(payload, baseName) {
  const to = resolveRecipients();
  if (!to.length) return { ok: false, reason: "no_recipients" };

  const jsonString = JSON.stringify(payload, null, 0);
  const attachment = prepareAttachment(jsonString);
  const subject = `DK Backup diário — ${baseName}`;
  const html = buildSummaryHtml(payload, {
    filename: attachment.filename,
    sizeHuman: attachment.sizeHuman,
    compressed: attachment.compressed,
  });

  const resend = await sendViaResend({ to, subject, html, attachment });
  if (resend.ok) return { ...resend, to };

  const smtp = await sendViaSmtp({ to, subject, html, attachment });
  if (smtp.ok) return { ...smtp, to };

  return {
    ok: false,
    reason: "email_not_configured",
    attempts: { resend: resend.reason, smtp: smtp.reason },
  };
}

module.exports = { sendBackupEmail, resolveRecipients, DEFAULT_TO };
