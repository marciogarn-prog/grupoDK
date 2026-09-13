/**
 * Contenção de emergência — só Administrador CEO (role owner no token).
 * POST incrementa a geração de sessão no Redis. GET devolve o estado.
 * Não apaga snapshot, Supabase, cadastros nem rate limit.
 */
const {
  applyApiCors,
  enforceRateLimit,
  requireCeoEmergencyLock,
  readSessionEpoch,
  bumpSessionEpoch,
  countRecentSnapshotOrigins,
  mintTokenWithSession,
} = require("../lib/dk-portal-auth.cjs");

function publicStatus(epoch, origins, extra) {
  return {
    ok: true,
    generation: epoch.n,
    blockedAt: epoch.at,
    recentOrigins: origins,
    ...extra,
  };
}

module.exports = async function handler(req, res) {
  applyApiCors(res);
  res.setHeader("Content-Type", "application/json");

  if (req.method === "OPTIONS") return res.status(204).end();

  if (await enforceRateLimit(req, res, "session-kill", 10)) return;

  const gate = await requireCeoEmergencyLock(req);
  if (!gate.ok) {
    return res.status(gate.status).json({ ok: false, reason: gate.reason });
  }

  if (req.method === "GET") {
    const epoch = await readSessionEpoch();
    const origins = await countRecentSnapshotOrigins();
    return res.status(200).json(publicStatus(epoch, origins));
  }

  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, reason: "method" });
  }

  const bumped = await bumpSessionEpoch();
  if (!bumped.ok) {
    return res.status(bumped.status || 503).json({ ok: false, reason: bumped.reason });
  }

  const token = await mintTokenWithSession({
    typ: "equipa",
    cpf: gate.cpf,
    role: gate.role,
    nome: gate.nome,
  });
  const origins = await countRecentSnapshotOrigins();
  return res.status(200).json(
    publicStatus(
      { n: bumped.n, at: bumped.at },
      origins,
      {
        blocked: true,
        token,
        message: "OUTRAS SESSÕES BLOQUEADAS COM SUCESSO",
      }
    )
  );
};
