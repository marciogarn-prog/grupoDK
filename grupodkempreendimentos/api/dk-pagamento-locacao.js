/**
 * Canário de leitura. Um contrato por vez. Não grava e não liga na tela.
 */
const {
  applyApiCors,
  enforceRateLimit,
  requirePortalAuth,
  assertEquipaClientProtocol,
  onlyDigits,
  loadOfficialSnapshotPayload,
} = require("../lib/dk-portal-auth.cjs");
const { decidirAcessoLocacao } = require("../lib/dk-locacao-pg.cjs");
const store = require("../lib/dk-pagamento-locacao-store.cjs");

function corpoJson(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string" && req.body.trim()) {
    try {
      const parsed = JSON.parse(req.body);
      if (parsed && typeof parsed === "object") return parsed;
    } catch {
      return {};
    }
  }
  return {};
}

module.exports = async function handler(req, res) {
  applyApiCors(res);
  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ ok: false, reason: "method", fallback: false });
  }
  const gate = requirePortalAuth(req, { allowCliente: false, allowEquipa: true });
  if (!gate.ok) return res.status(gate.status || 401).json({ ok: false, reason: gate.reason || "unauthorized", fallback: false });
  const protoGate = assertEquipaClientProtocol(gate, req);
  if (!protoGate.ok) return res.status(protoGate.status || 403).json({ ok: false, reason: protoGate.reason || "forbidden", fallback: false });
  const ident = onlyDigits(gate.cpf).slice(0, 11) || String(gate.role || "equipa");
  if (await enforceRateLimit(req, res, "pagamento-locacao-leitura", 60, { identity: ident })) return;

  let funcionarios = null;
  if (!(gate.service || String(gate.role || "").trim() === "owner")) {
    try {
      const payload = await loadOfficialSnapshotPayload();
      funcionarios = payload && Array.isArray(payload.dk_funcionarios_access) ? payload.dk_funcionarios_access : [];
    } catch {
      return res.status(503).json({ ok: false, reason: "acesso_indisponivel", fallback: false });
    }
  }
  const acesso = decidirAcessoLocacao(gate, funcionarios);
  if (!acesso.ok) {
    return res.status(acesso.status || 403).json({ ok: false, reason: acesso.reason || "forbidden", fallback: false });
  }

  const q = req.query || {};
  try {
    if (req.method === "POST") {
      const body = corpoJson(req);
      if (body.mode !== "write_probe") {
        return res.status(405).json({ ok: false, reason: "write_not_active", fallback: false, mutated: false });
      }
      const chaves = Object.keys(body);
      if (chaves.length !== 1) {
        return res.status(400).json({
          ok: false,
          reason: "payload_rejeitado",
          probe: true,
          mutated: false,
          inserted: 0,
          updated: 0,
          fallback: false,
        });
      }
      const out = await store.probeEscrita();
      return res.status(out.status || (out.ok ? 200 : 503)).json(out);
    }
    const numero = String(q.numeroContrato || q.numero || "").trim();
    const removidos = String(q.scope || "").trim() === "removidos";
    const out = removidos
      ? await store.listarRemovidosPorContrato(numero)
      : await store.listarPorContrato(numero);
    return res.status(out.ok ? 200 : out.status || 503).json(out);
  } catch (err) {
    console.error("[dk-pagamento-locacao]", err && err.message ? err.message : "erro");
    return res.status(500).json({ ok: false, reason: "erro_interno", source: store.FONTE, fallback: false });
  }
};
