/**
 * Locação e movimento financeiro. Uma operação por vez.
 * PostgreSQL confirma quando responde. Se der 522/504, o Redis assume leitura e gravação
 * para o pareamento cliente↔servidor não falhar.
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
const {
  pgComunicacaoFalhou,
  listarDoRedis,
  gravarNoRedis,
} = require("../lib/dk-locacao-redis-fallback.cjs");

async function listarLocacoesComFallbackRedis(cpfCliente) {
  const lista = await pg.listar(cpfCliente);
  if (lista && lista.ok) return lista;
  if (lista && lista.schema === false) return lista;
  if (!pgComunicacaoFalhou(lista && lista.status, lista && lista.reason)) return lista;
  return listarDoRedis(cpfCliente);
}

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
        if (rel.ok) return res.status(200).json(rel);
        /* Relógio PG fora — Redis confirma presença da nuvem. */
        return res.status(200).json({
          ok: true,
          schema: true,
          selo: "redis",
          source: "redis",
          supabasePendente: true,
        });
      }
      const lista = await listarLocacoesComFallbackRedis(cpfCliente);
      if (lista.schema === false) return res.status(200).json({ ok: false, schema: false, reason: "schema_ausente" });
      return res.status(lista.ok ? 200 : 502).json(lista);
    }

    const fonte = await pg.obterFonteLocacoes();
    if (cpfCliente && fonte !== pg.FONTE_LOCACAO) {
      return res.status(403).json({ ok: false, reason: "somente_leitura" });
    }
    if (
      fonte === pg.FONTE_LOCACAO &&
      !(gate.service || String(gate.role || "").trim() === "owner" || cpfCliente)
    ) {
      /* Garante snapshot Redis aquecido para o fallback de gravação. */
      await loadOfficialSnapshotPayload();
    }
    const body = parseBody(req);
    const acao = String(body.op || op || "").trim();
    if (acao === "excluir") {
      const opIdExcluir = body.operation_id || body.operationId;
      if (!opIdExcluir) {
        return res.status(400).json({
          ok: false,
          reason: "operation_id_obrigatorio",
          hint: "exclusão exige operation_id; caminho legado sem Log foi desativado",
        });
      }
      return res.status(501).json({
        ok: false,
        reason: "exclusao_atomica_pendente",
        operation_id: opIdExcluir,
        hint: "use finalizar/cancelar via atualizar/finalizar com Log; DELETE físico sem evento não é aceite",
      });
    }
    if (acao === "gravar" || acao === "criar" || acao === "atualizar" || acao === "finalize" || acao === "finalizar") {
      const locacao = body.locacao && typeof body.locacao === "object" ? body.locacao : null;
      if (!locacao) return res.status(400).json({ ok: false, reason: "locacao_obrigatoria" });
      const opId = body.operation_id || body.operationId;
      if (!opId) {
        return res.status(400).json({
          ok: false,
          reason: "operation_id_obrigatorio",
          hint: "cutover: use /api/dk-locacao com operation_id; caminho legado sem Log foi desativado",
        });
      }
      const atomicLpm = require("../lib/dk-atomic-write-lpm.cjs");
      const action =
        acao === "criar" || (!locacao.pgId && acao === "gravar")
          ? "create"
          : acao === "finalize" || acao === "finalizar"
            ? "finalize"
            : "update";
      const atom = await atomicLpm.mutarLocacaoAtomico({
        action,
        locacao,
        numeroContrato: body.numero || locacao.numeroContrato,
        expectedVersion: body.version != null ? body.version : locacao.pgVersion,
        operationId: opId,
        actorUserId: autor(gate),
        actorSessionId: gate.sid || null,
        route: "/api/dk-locacao",
        method: "POST",
      });
      if (atom && atom.ok) {
        return res.status(atom.status || 200).json(atom.body || atom);
      }
      const reason = (atom && atom.body && atom.body.reason) || (atom && atom.reason) || "gravacao";
      const status = (atom && atom.status) || 502;
      if (pgComunicacaoFalhou(status, reason)) {
        const fb = await gravarNoRedis(locacao, {
          operationId: opId,
          numero: body.numero || locacao.numeroContrato,
          action,
        });
        if (fb && fb.ok) {
          return res.status(200).json({
            ok: true,
            success: true,
            confirmed: true,
            source: "redis",
            supabasePendente: true,
            persistencia: "redis",
            locacao: fb.locacao,
            version: fb.version,
            record_version: fb.record_version,
            operation_id: opId,
            reason: reason,
            message: "Gravação confirmada no Redis (nuvem principal). Cópia Supabase pendente.",
          });
        }
      }
      return res.status(status || 400).json((atom && atom.body) || atom || { ok: false, reason: "gravacao" });
    }
    return res.status(400).json({ ok: false, reason: "operacao_desconhecida" });
  } catch (err) {
    console.error("[dk-locacao]", err);
    return res.status(500).json({ ok: false, reason: "erro_interno" });
  }
};

module.exports.listarLocacoesComFallbackRedis = listarLocacoesComFallbackRedis;
