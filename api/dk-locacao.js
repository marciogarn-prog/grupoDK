/**
 * Locação e movimento financeiro. Uma operação por vez.
 * PostgreSQL é o juiz. Redis não é consultado.
 */
const {
  applyApiCors,
  enforceRateLimit,
  requirePortalAuth,
  assertEquipaClientProtocol,
  onlyDigits,
  loadOfficialSnapshotPayload,
} = require("../lib/dk-portal-auth.cjs");
const pg = require("../lib/dk-locacao-pg.cjs");

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

function autor(gate) {
  const cpf = onlyDigits(gate && gate.cpf).slice(0, 11);
  return cpf || String((gate && gate.role) || "equipa");
}

module.exports = async function handler(req, res) {
  applyApiCors(res);
  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ ok: false, reason: "method" });
  }
  const gate = requirePortalAuth(req, { allowCliente: true, allowEquipa: true });
  if (!gate.ok) return res.status(gate.status || 401).json({ ok: false, reason: gate.reason || "unauthorized" });
  const protoGate = assertEquipaClientProtocol(gate, req);
  if (!protoGate.ok) return res.status(protoGate.status || 403).json({ ok: false, reason: protoGate.reason || "forbidden" });
  if (await enforceRateLimit(req, res, "locacao-pg", req.method === "GET" ? 120 : 60, { identity: autor(gate) })) return;

  const cpfCliente = gate.typ === "cliente" ? onlyDigits(gate.cpf).slice(0, 11) : "";
  const q = req.query || {};
  const op = String(q.op || "").trim();

  try {
    if (req.method === "GET") {
      if (op === "relogio") {
        if (cpfCliente) return res.status(200).json({ ok: true, schema: true, selo: "cliente" });
        const rel = await pg.relogio();
        if (rel.schema === false) return res.status(200).json({ ok: false, schema: false, reason: "schema_ausente" });
        return res.status(rel.ok ? 200 : 502).json(rel);
      }
      const lista = await pg.listar(cpfCliente);
      if (lista.schema === false) return res.status(200).json({ ok: false, schema: false, reason: "schema_ausente" });
      return res.status(lista.ok ? 200 : 502).json(lista);
    }

    const fonte = await pg.obterFonteLocacoes();
    if (cpfCliente && fonte !== pg.FONTE_LOCACAO) {
      return res.status(403).json({ ok: false, reason: "somente_leitura" });
    }
    let funcionarios = null;
    if (
      fonte === pg.FONTE_LOCACAO &&
      !(gate.service || String(gate.role || "").trim() === "owner" || cpfCliente)
    ) {
      const payload = await loadOfficialSnapshotPayload();
      funcionarios = payload && Array.isArray(payload.dk_funcionarios_access) ? payload.dk_funcionarios_access : [];
    }
    const acesso = {
      ok: true,
      typ: gate.typ,
      role: gate.role,
      service: Boolean(gate.service),
      cpf: gate.cpf,
    };
    const body = parseBody(req);
    const acao = String(body.op || op || "").trim();
    if (acao === "excluir") {
      const out = await pg.excluirUma({
        numero: body.numero || body.numeroContrato,
        version: body.version,
        by: autor(gate),
        acesso,
        funcionarios,
      });
      if (out.schema === false) return res.status(200).json({ ok: false, schema: false, reason: "schema_ausente" });
      if (out.conflict) return res.status(409).json(out);
      return res.status(out.ok ? 200 : out.status || 400).json(out);
    }
    if (acao === "gravar" || acao === "criar" || acao === "atualizar") {
      const locacao = body.locacao && typeof body.locacao === "object" ? body.locacao : null;
      if (!locacao) return res.status(400).json({ ok: false, reason: "locacao_obrigatoria" });
      const out = await pg.gravarUma({
        numero: body.numero || locacao.numeroContrato,
        version: body.version != null ? body.version : locacao.pgVersion,
        locacao,
        by: autor(gate),
        criar: acao === "criar" || !locacao.pgId,
        acesso,
        funcionarios,
      });
      if (out.schema === false) return res.status(200).json({ ok: false, schema: false, reason: "schema_ausente" });
      if (out.conflict) return res.status(409).json(out);
      return res.status(out.ok ? 200 : out.status || 400).json(out);
    }
    return res.status(400).json({ ok: false, reason: "operacao_desconhecida" });
  } catch (err) {
    console.error("[dk-locacao]", err);
    return res.status(500).json({ ok: false, reason: "erro_interno" });
  }
};
