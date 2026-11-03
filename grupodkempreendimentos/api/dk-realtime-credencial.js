/**
 * Credencial Realtime privada (ES256) — feature gate DESLIGADO por defeito.
 *
 * Sem DK_REALTIME_SINAL=1 + DK_REALTIME_ES256_TRUSTED=1 + JWK/KID → REALTIME_AUTH_BLOCKED.
 * Não usa SUPABASE_JWT_SECRET legado, não usa service_role, não usa HMAC do portal.
 */
const {
  applyApiCors,
  requireLiveSession,
  assertEquipaClientProtocol,
  enforceRateLimit,
  onlyDigits,
  loadOfficialSnapshotPayload,
  findFuncionario,
} = require("../lib/dk-portal-auth.cjs");
const { emitirCredencialRealtime, emissorPronto } = require("../lib/dk-realtime-jwt-es256.cjs");

function noStore(res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
  res.setHeader("Pragma", "no-cache");
}

function bloqueado(extra) {
  return {
    ok: false,
    reason: "REALTIME_AUTH_BLOCKED",
    realtime: false,
    canal: "dk:events",
    private: true,
    alg: "ES256",
    catch_up: "/api/dk-sync",
    polling_temporario: true,
    ...extra,
  };
}

module.exports = async function handler(req, res) {
  applyApiCors(res);
  noStore(res);
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
  if (await enforceRateLimit(req, res, "realtime-cred", 30, { identity: onlyDigits(gate.cpf).slice(0, 11) || gate.sid })) {
    return;
  }

  let empresa = "locadora";
  let filial = "default";
  try {
    if (String(gate.role || "").trim() !== "owner") {
      const payload = await loadOfficialSnapshotPayload();
      const f = findFuncionario(payload, onlyDigits(gate.cpf).slice(0, 11));
      if (!f || f.blocked) {
        return res.status(403).json(bloqueado({ hint: "funcionario_bloqueado_ou_ausente" }));
      }
      empresa = String(f.empresa || "locadora").trim() || "locadora";
      filial = String(f.filial || f.unidade || "default").trim() || "default";
    } else {
      empresa = String(gate.empresa || "locadora").trim() || "locadora";
      filial = String(gate.filial || "default").trim() || "default";
    }
  } catch {
    /* owner sem snapshot ainda pode seguir; demais já falharam acima */
    if (String(gate.role || "").trim() !== "owner") {
      return res.status(503).json(bloqueado({ hint: "snapshot_unavailable" }));
    }
  }

  const pronto = emissorPronto();
  if (!pronto.ok) {
    return res.status(503).json(
      bloqueado({
        requisito_ausente: pronto.falta.join(","),
        falta: pronto.falta,
        detalhe:
          "Emissor ES256 está no código. Falta chave confiável no Supabase (import + rotação Current), " +
          "JWK privado no servidor e feature gates. Standby sozinho não autentica.",
      })
    );
  }

  const out = emitirCredencialRealtime({
    gate: { ...gate, ok: true },
    empresa,
    filial,
  });
  if (!out.ok) {
    return res.status(out.status || 503).json(out.body || bloqueado({ hint: "emissao" }));
  }

  /* Não registar token em logs. */
  return res.status(200).json(out.body);
};
