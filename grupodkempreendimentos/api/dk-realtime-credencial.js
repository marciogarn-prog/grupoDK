/**
 * Gate de credencial Realtime privada.
 * Enquanto não houver assinatura JWT reconhecida pelo Supabase vinculada
 * à sessão do portal, responde REALTIME_AUTH_BLOCKED e não emite token.
 *
 * Não usa service_role no browser. Não assina com DK_PORTAL_API_SECRET
 * (HMAC do portal ≠ JWT do projeto Supabase).
 */
const {
  applyApiCors,
  requireLiveSession,
  assertEquipaClientProtocol,
} = require("../lib/dk-portal-auth.cjs");

function bloqueado(extra) {
  return {
    ok: false,
    reason: "REALTIME_AUTH_BLOCKED",
    realtime: false,
    canal: "dk:events",
    private: true,
    ...extra,
  };
}

module.exports = async function handler(req, res) {
  applyApiCors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json(bloqueado({ hint: "method" }));
  }

  const gate = await requireLiveSession(req, {
    allowCliente: false,
    allowEquipa: true,
    allowService: false,
  });
  if (!gate.ok) {
    return res.status(gate.status || 401).json(bloqueado({ hint: gate.reason || "unauthorized" }));
  }
  const proto = assertEquipaClientProtocol(gate, req);
  if (!proto.ok) {
    return res.status(proto.status || 403).json(bloqueado({ hint: proto.reason || "forbidden" }));
  }

  const jwtSecret = String(process.env.SUPABASE_JWT_SECRET || process.env.JWT_SECRET || "").trim();
  const flag = String(process.env.DK_REALTIME_SINAL || "0").trim();
  if (flag !== "1" || !jwtSecret) {
    return res.status(503).json(
      bloqueado({
        requisito_ausente: jwtSecret
          ? "DK_REALTIME_SINAL"
          : "SUPABASE_JWT_SECRET",
        detalhe:
          "Portal usa token HMAC próprio; Realtime exige JWT assinado com a chave do projeto Supabase. " +
          "Sem essa chave no servidor e feature gate, a credencial não é emitida.",
        catch_up: "/api/dk-sync",
        polling_temporario: true,
      })
    );
  }

  /* Feature gate futuro: só após JWT secret + política RLS por claims DK. */
  return res.status(503).json(
    bloqueado({
      requisito_ausente: "politica_rls_claims_dk",
      detalhe:
        "A emissão de JWT Realtime ainda não está ligada: falta política RLS com claims de sessão/empresa e prova de broadcast.",
      catch_up: "/api/dk-sync",
    })
  );
};
