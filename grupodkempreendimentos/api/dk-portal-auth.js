/**
 * Emite token de sessão para PCs da equipa e app do cliente.
 * POST { tipo: "equipa", cpf, senha, role? } ou { tipo: "cliente", cpf, senha, protocolo? }
 */
const {
  applyApiCors,
  enforceRateLimit,
  mintTokenWithSession,
  touchSessaoAtiva,
  readSessaoAtiva,
  sessaoEstaOcupada,
  mensagemDesconectarSessao,
  publicClientIp,
  newSessaoSid,
  loadOfficialSnapshotPayload,
  podeLoginCeoEmergencia,
  TITULAR_CEO_CPF,
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
  rejectIfLoginPasswordLocked,
  registerLoginPasswordFailure,
  clearLoginPasswordFailures,
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

async function emitirSessaoEquipa(req, res, cpf, role, pub, extra) {
  const body = parseBody(req);
  const deviceId = String(body.deviceId || "").trim().slice(0, 80);
  const confirmarUnico =
    body.confirmarUnico === true || body.confirmarUnico === 1 || String(body.confirmarUnico || "") === "true";
  const existing = await readSessaoAtiva(cpf);
  const isCeoTitular = cpf === TITULAR_CEO_CPF;
  if (!isCeoTitular && sessaoEstaOcupada(existing, deviceId) && !confirmarUnico) {
    const ip = existing.ip || "desconhecido";
    return res.status(409).json({
      ok: false,
      reason: "session_em_uso",
      cpf,
      ip,
      message: mensagemDesconectarSessao(cpf, ip),
    });
  }
  const sid = newSessaoSid();
  const token = await mintTokenWithSession({
    typ: "equipa",
    cpf,
    role,
    nome: pub.nome,
    sid,
  });
  await touchSessaoAtiva(cpf, { sid, ip: publicClientIp(req), deviceId, replace: true });
  return res.status(200).json({ ok: true, token, funcionario: pub, ...(extra || {}) });
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
  } catch {
    payload = null;
  }
  if (!payload) {
    if (tipo === "equipa" && podeLoginCeoEmergencia(cpf, senha)) {
      const pub = { cpf: TITULAR_CEO_CPF, nome: "Administrador CEO", role: "owner" };
      return emitirSessaoEquipa(req, res, TITULAR_CEO_CPF, "owner", pub, { emergencia: true });
    }
    return res.status(503).json({ ok: false, reason: "snapshot_unavailable" });
  }

  if (tipo === "equipa") {
    if (await rejectIfLoginPasswordLocked(res, cpf)) return;
    const roleWanted = String(body.role || "").trim();
    const f = findFuncionario(payload, cpf);
    if (!f || !verifySecretAgainstRecord(senha, f)) {
      const fail = await registerLoginPasswordFailure(cpf);
      return res.status(401).json({
        ok: false,
        reason: fail.locked ? "password_locked" : "invalid_credentials",
        message: fail.message,
        attemptsLeft: fail.attemptsLeft,
        lockedUntil: fail.lockedUntil || undefined,
      });
    }
    await clearLoginPasswordFailures(cpf);
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
    return emitirSessaoEquipa(req, res, cpf, role, pub);
  }

  if (tipo === "cliente") {
    if (await rejectIfLoginPasswordLocked(res, cpf)) return;
    const proto = normalizeProto(body.protocolo);
    if (!proto) return res.status(400).json({ ok: false, reason: "protocolo" });
    const c = findCliente(payload, cpf);
    const rec = clienteAuthRecord(c);
    if (!c || !verifySecretAgainstRecord(senha, rec)) {
      const fail = await registerLoginPasswordFailure(cpf);
      return res.status(401).json({
        ok: false,
        reason: fail.locked ? "password_locked" : "invalid_credentials",
        message: fail.message,
        attemptsLeft: fail.attemptsLeft,
        lockedUntil: fail.lockedUntil || undefined,
      });
    }
    await clearLoginPasswordFailures(cpf);
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
    const token = await mintTokenWithSession({
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
