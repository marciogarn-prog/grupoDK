/**
 * Emite token de sessão para PCs da equipa e app do cliente.
 * POST { tipo: "equipa", cpf, senha, role? } ou { tipo: "cliente", cpf, senha, protocolo? }
 */
const {
  applyApiCors,
  enforceRateLimit,
  mintToken,
  loadOfficialSnapshotPayload,
  findFuncionario,
  findCliente,
  clienteTemProtocolo,
  publicFuncionario,
  onlyDigits,
  normalizeProto,
  signingSecret,
  verifySecretAgainstRecord,
  needsPasswordUpgrade,
  clienteAuthRecord,
  persistPasswordUpgrade,
} = require("../lib/dk-portal-auth.cjs");

function parseBody(req) {
  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      body = {};
    }
  }
  return body && typeof body === "object" ? body : {};
}

module.exports = async function handler(req, res) {
  applyApiCors(res);
  res.setHeader("Content-Type", "application/json");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ ok: false, reason: "method" });

  if (await enforceRateLimit(req, res, "portal-auth", 10)) return;

  if (!signingSecret()) {
    return res.status(503).json({ ok: false, reason: "auth_not_configured" });
  }

  const body = parseBody(req);
  const tipo = String(body.tipo || "").trim();
  const cpf = onlyDigits(body.cpf).slice(0, 11);
  const senha = String(body.senha || "").trim();
  if (cpf.length !== 11 || !senha) {
    return res.status(400).json({ ok: false, reason: "cpf_senha" });
  }

  let payload;
  try {
    payload = await loadOfficialSnapshotPayload();
  } catch (e) {
    return res.status(503).json({ ok: false, reason: "snapshot_unavailable", error: String(e.message || e) });
  }
  if (!payload) {
    return res.status(503).json({ ok: false, reason: "snapshot_unavailable" });
  }

  if (tipo === "equipa") {
    const roleWanted = String(body.role || "").trim();
    const f = findFuncionario(payload, cpf);
    if (!f || !verifySecretAgainstRecord(senha, f)) {
      return res.status(401).json({ ok: false, reason: "invalid_credentials" });
    }
    if (needsPasswordUpgrade(f)) {
      try {
        await persistPasswordUpgrade("equipa", cpf, senha);
      } catch {
        /* login continua; hash na próxima vez */
      }
    }
    if (f.blocked) return res.status(403).json({ ok: false, reason: "blocked" });
    const role = String(f.role || "").trim();
    if (roleWanted === "administrador" && role !== "owner") {
      return res.status(403).json({ ok: false, reason: "not_admin" });
    }
    if ((roleWanted === "colaborador" || roleWanted === "operacao") && role === "owner") {
      return res.status(403).json({ ok: false, reason: "use_admin" });
    }
    const pub = publicFuncionario(f);
    const token = mintToken({ typ: "equipa", cpf, role, nome: pub.nome });
    return res.status(200).json({ ok: true, token, funcionario: pub });
  }

  if (tipo === "cliente") {
    const proto = normalizeProto(body.protocolo);
    if (!proto) return res.status(400).json({ ok: false, reason: "protocolo" });
    const c = findCliente(payload, cpf);
    const rec = clienteAuthRecord(c);
    if (!c || !verifySecretAgainstRecord(senha, rec)) {
      return res.status(401).json({ ok: false, reason: "invalid_credentials" });
    }
    if (needsPasswordUpgrade(rec)) {
      try {
        await persistPasswordUpgrade("cliente", cpf, senha);
      } catch {
        /* login continua */
      }
    }
    if (!clienteTemProtocolo(payload, cpf, proto)) {
      return res.status(403).json({ ok: false, reason: "protocolo" });
    }
    const token = mintToken({
      typ: "cliente",
      cpf,
      proto,
      nome: String(c.nome || "").trim(),
    });
    return res.status(200).json({
      ok: true,
      token,
      cliente: { cpf, nome: String(c.nome || "").trim(), protocolo: proto },
    });
  }

  return res.status(400).json({ ok: false, reason: "tipo" });
};
