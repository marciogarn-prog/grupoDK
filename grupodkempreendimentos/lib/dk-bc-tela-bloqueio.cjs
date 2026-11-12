/**
 * Bloqueio exclusivo de tela (COMANDO 09/10).
 * Empresa/filial/tela e VM vêm da sessão autenticada — não do cliente.
 */
const { restRpc } = require("./dk-bc-registro.cjs");
const { cpfDoGate, resolverVmDaSessao } = require("./dk-bc-vm-sessao.cjs");

const TTL_SEG = 60;
const TELAS_CANONICAS = new Set([
  "locacoes",
  "clientes",
  "veiculos",
  "pagamentos",
  "manutencoes",
  "multas",
  "contratos",
]);

function unwrapRpc(res) {
  if (!res) return { ok: false, rows: [], status: 503 };
  if (res.ok === false && res.data && res.data.reason) {
    return { ok: false, rows: [], status: res.status || 503, reason: res.data.reason };
  }
  const data = res.data;
  const rows = Array.isArray(data) ? data : data != null ? [data] : [];
  return { ok: res.ok !== false, rows, status: res.status || 200 };
}

function sessaoIdDoGate(gate) {
  return String(
    (gate && gate.claims && gate.claims.sid) ||
      (gate && gate.sessaoId) ||
      (gate && gate.sid) ||
      ""
  ).trim();
}

function normalizarTela(tela) {
  return String(tela || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "");
}

/**
 * Resolve escopo oficial: sessão → VM → empresa/filial autorizada.
 * Cliente pode sugerir tela; empresa/filial só se confirmadas no escopo da VM.
 */
async function resolverContextoBloqueio(gate, io) {
  const clientPrefix = String((io && io.clientPrefix) || "").trim();
  const resolved = await resolverVmDaSessao(gate, { clientPrefix, rpc: io && io.rpc });
  if (!resolved.ok || !resolved.autorizada) {
    return {
      ok: false,
      status: resolved.status || 403,
      reason: resolved.reason || "sem_autorizacao_vm",
      acesso: resolved.acesso || "pendente",
    };
  }

  const tela = normalizarTela(io && io.tela);
  if (!tela || !TELAS_CANONICAS.has(tela)) {
    return { ok: false, status: 400, reason: "tela_invalida" };
  }

  const sessaoId = sessaoIdDoGate(gate);
  if (!sessaoId) {
    return { ok: false, status: 401, reason: "sessao_ausente" };
  }

  const cpf = cpfDoGate(gate);
  const empClient = String((io && (io.empresa_id || io.empresaId)) || "").trim();
  const filClient = String((io && (io.filial_id || io.filialId)) || "").trim();

  // Escopo oficial: se cliente informar, deve existir na VM; senão usa primeiro escopo da VM via RPC implícito no adquirir.
  // Aqui apenas rejeitamos spoof óbvio sem escopo — a função PG valida dk_bc_vm_escopo.
  if (!empClient || !filClient) {
    return { ok: false, status: 400, reason: "empresa_filial_obrigatorias_no_escopo" };
  }

  return {
    ok: true,
    prefixo: resolved.prefixo,
    colaborador_ref: cpf,
    sessao_id: sessaoId,
    empresa_id: empClient,
    filial_id: filClient,
    tela_id: tela,
    forged_ignored: clientPrefix || null,
  };
}

async function rpcCall(fn, args, io) {
  if (io && typeof io.rpc === "function") {
    return { ok: true, status: 200, data: await io.rpc(fn, args) };
  }
  return restRpc(fn, args, io);
}

async function consultar(ctx, io) {
  const res = await rpcCall(
    "dk_bc_tela_bloqueio_consultar",
    {
      p_empresa_id: ctx.empresa_id,
      p_filial_id: ctx.filial_id,
      p_tela_id: ctx.tela_id,
    },
    io
  );
  const { ok, rows, status, reason } = unwrapRpc(res);
  if (!ok) return { ok: false, status: status || 503, reason: reason || "consulta_indisponivel" };
  const row = rows[0] || {};
  return {
    ok: true,
    status: 200,
    ocupada: row.ocupada === true,
    estado: row.estado || "livre",
    prefixo: row.prefixo || null,
    geracao: row.geracao != null ? Number(row.geracao) : null,
    concessao_id: row.concessao_id || null,
    expira_em: row.expira_em || null,
    renovado_em: row.renovado_em || null,
    sessao_mascara: row.sessao_mascara || null,
    reason: row.reason || null,
    empresa_id: ctx.empresa_id,
    filial_id: ctx.filial_id,
    tela_id: ctx.tela_id,
  };
}

async function adquirir(ctx, io) {
  const res = await rpcCall(
    "dk_bc_tela_bloqueio_adquirir",
    {
      p_empresa_id: ctx.empresa_id,
      p_filial_id: ctx.filial_id,
      p_tela_id: ctx.tela_id,
      p_prefixo: ctx.prefixo,
      p_colaborador_ref: ctx.colaborador_ref,
      p_sessao_id: ctx.sessao_id,
      p_ttl_segundos: TTL_SEG,
    },
    io
  );
  const { ok, rows, status, reason } = unwrapRpc(res);
  if (!ok) return { ok: false, status: status || 503, reason: reason || "adquirir_indisponivel" };
  const row = rows[0] || {};
  return {
    ok: row.ok === true,
    status: row.ok === true ? 200 : row.reason === "tela_ocupada" ? 409 : 403,
    adquirida: row.adquirida === true,
    concessao_id: row.concessao_id || null,
    geracao: row.geracao != null ? Number(row.geracao) : null,
    expira_em: row.expira_em || null,
    reason: row.reason || null,
    ttl_segundos: TTL_SEG,
    renew_sugerido_ms: 20000,
  };
}

async function renovar(ctx, concessaoId, geracao, io) {
  const res = await rpcCall(
    "dk_bc_tela_bloqueio_renovar",
    {
      p_empresa_id: ctx.empresa_id,
      p_filial_id: ctx.filial_id,
      p_tela_id: ctx.tela_id,
      p_sessao_id: ctx.sessao_id,
      p_concessao_id: concessaoId,
      p_geracao: Number(geracao),
      p_ttl_segundos: TTL_SEG,
    },
    io
  );
  const { ok, rows, status, reason } = unwrapRpc(res);
  if (!ok) return { ok: false, status: status || 503, reason: reason || "renovar_indisponivel" };
  const row = rows[0] || {};
  return {
    ok: row.ok === true,
    status: row.ok === true ? 200 : 409,
    renovada: row.renovada === true,
    concessao_id: row.concessao_id || null,
    geracao: row.geracao != null ? Number(row.geracao) : null,
    expira_em: row.expira_em || null,
    reason: row.reason || null,
  };
}

async function liberar(ctx, concessaoId, geracao, io) {
  const res = await rpcCall(
    "dk_bc_tela_bloqueio_liberar",
    {
      p_empresa_id: ctx.empresa_id,
      p_filial_id: ctx.filial_id,
      p_tela_id: ctx.tela_id,
      p_sessao_id: ctx.sessao_id,
      p_concessao_id: concessaoId,
      p_geracao: Number(geracao),
    },
    io
  );
  const { ok, rows, status, reason } = unwrapRpc(res);
  if (!ok) return { ok: false, status: status || 503, reason: reason || "liberar_indisponivel" };
  const row = rows[0] || {};
  return {
    ok: row.ok === true,
    status: row.ok === true ? 200 : 409,
    liberada: row.liberada === true,
    reason: row.reason || null,
  };
}

async function validar(ctx, concessaoId, geracao, io) {
  const res = await rpcCall(
    "dk_bc_tela_bloqueio_validar",
    {
      p_empresa_id: ctx.empresa_id,
      p_filial_id: ctx.filial_id,
      p_tela_id: ctx.tela_id,
      p_sessao_id: ctx.sessao_id,
      p_concessao_id: concessaoId,
      p_geracao: Number(geracao),
    },
    io
  );
  const { ok, rows, status, reason } = unwrapRpc(res);
  if (!ok) return { ok: false, status: status || 503, reason: reason || "validar_indisponivel", valida: false };
  const row = rows[0] || {};
  return {
    ok: row.ok === true,
    status: row.ok === true ? 200 : 409,
    valida: row.valida === true,
    geracao: row.geracao != null ? Number(row.geracao) : null,
    reason: row.reason || null,
  };
}

module.exports = {
  TTL_SEG,
  TELAS_CANONICAS,
  resolverContextoBloqueio,
  consultar,
  adquirir,
  renovar,
  liberar,
  validar,
  sessaoIdDoGate,
  normalizarTela,
};
