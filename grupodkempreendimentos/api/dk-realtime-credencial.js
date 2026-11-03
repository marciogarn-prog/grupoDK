/**
 * Credencial Realtime privada (ES256) — feature gates DESLIGADOS por defeito.
 * Sem SCOPE_ISOLATION + ES256 trusted + sinal → REALTIME_AUTH_BLOCKED / SCOPE_ISOLATION_BLOCKED.
 */
const {
  applyApiCors,
  requireLiveSession,
  assertEquipaClientProtocol,
  enforceRateLimit,
  onlyDigits,
  loadOfficialSnapshotPayload,
  findFuncionario,
  readSessaoAtiva,
  TITULAR_CEO_CPF,
} = require("../lib/dk-portal-auth.cjs");
const { emitirCredencialRealtime, emissorPronto } = require("../lib/dk-realtime-jwt-es256.cjs");
const { isolamentoPronto, normalizarEmpresa, topicoRealtime } = require("../lib/dk-realtime-scope.cjs");

function noStore(res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
  res.setHeader("Pragma", "no-cache");
}

function bloqueado(extra) {
  return {
    ok: false,
    reason: "REALTIME_AUTH_BLOCKED",
    realtime: false,
    canal: null,
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

  const cpf = onlyDigits(gate.cpf).slice(0, 11);
  const sid = String(gate.sid || "").trim();
  if (!sid) {
    return res.status(401).json(bloqueado({ hint: "sid_obrigatorio" }));
  }
  const isCeo = cpf === TITULAR_CEO_CPF || String(gate.role || "").trim() === "owner";
  if (cpf.length === 11 && !isCeo) {
    const rec = await readSessaoAtiva(cpf);
    if (rec.sid && rec.sid !== sid) {
      return res.status(401).json(bloqueado({ hint: "session_replaced", reason: "REALTIME_AUTH_BLOCKED" }));
    }
    if (!rec.sid && !rec.at) {
      return res.status(401).json(bloqueado({ hint: "session_idle" }));
    }
  }

  let empresa = "locadora";
  let filial = "default";
  try {
    if (String(gate.role || "").trim() !== "owner") {
      const payload = await loadOfficialSnapshotPayload();
      const f = findFuncionario(payload, cpf);
      if (!f || f.blocked) {
        return res.status(403).json(bloqueado({ hint: "funcionario_bloqueado_ou_ausente" }));
      }
      empresa = normalizarEmpresa(f.empresa) || "locadora";
      filial = String(f.filial || f.unidade || "default").trim() || "default";
    } else {
      empresa = normalizarEmpresa(gate.empresa) || "locadora";
      filial = String(gate.filial || "default").trim() || "default";
    }
  } catch {
    if (String(gate.role || "").trim() !== "owner") {
      return res.status(503).json(bloqueado({ hint: "snapshot_unavailable" }));
    }
  }

  const iso = isolamentoPronto();
  if (!iso.ok) {
    return res.status(503).json(
      bloqueado({
        reason: "SCOPE_ISOLATION_BLOCKED",
        requisito_ausente: "DK_REALTIME_SCOPE_ISOLATION",
        detalhe: iso.detalhe,
        topico_planejado: topicoRealtime(empresa),
      })
    );
  }

  const pronto = emissorPronto();
  if (!pronto.ok) {
    return res.status(503).json(
      bloqueado({
        requisito_ausente: pronto.falta.join(","),
        falta: pronto.falta,
        detalhe:
          "Emissor ES256 no código. Falta chave Current no Supabase, JWK no servidor e gates. Standby sozinho não autentica.",
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
  return res.status(200).json(out.body);
};
