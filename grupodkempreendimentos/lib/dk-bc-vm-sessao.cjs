/**
 * Resolução servidor: sessão autenticada → VM lógica A–J.
 * Nunca confia no prefixo enviado pelo browser.
 */
const { restRpc } = require("./dk-bc-registro.cjs");

function cpfDoGate(gate) {
  const cpf = String(
    (gate && gate.claims && gate.claims.cpf) ||
      (gate && gate.user && gate.user.cpf) ||
      (gate && gate.cpf) ||
      ""
  )
    .replace(/\D/g, "")
    .trim();
  return cpf || "";
}

function unwrapRpc(res) {
  if (!res) return { ok: false, rows: [], status: 503 };
  if (res.ok === false && res.data && res.data.reason) {
    return { ok: false, rows: [], status: res.status || 503, reason: res.data.reason };
  }
  const data = res.data;
  const rows = Array.isArray(data) ? data : data != null ? [data] : [];
  return { ok: res.ok !== false, rows, status: res.status || 200 };
}

/**
 * @param {object} gate — resultado de requireLiveSession
 * @param {object} [io] — { rpc } opcional para testes
 */
async function resolverVmDaSessao(gate, io) {
  const cpf = cpfDoGate(gate);
  if (!cpf) {
    return {
      ok: false,
      status: 401,
      reason: "identidade_ausente",
      acesso: "negado",
      prefixo: null,
    };
  }

  const forged = String((io && io.clientPrefix) || "").trim().toUpperCase();

  let rpcRes;
  try {
    if (io && typeof io.rpc === "function") {
      rpcRes = { ok: true, status: 200, data: await io.rpc("dk_bc_vm_resolver_colaborador", { p_colaborador_ref: cpf }) };
    } else {
      rpcRes = await restRpc("dk_bc_vm_resolver_colaborador", { p_colaborador_ref: cpf }, io);
    }
  } catch (e) {
    return {
      ok: false,
      status: 503,
      reason: "vm_resolver_indisponivel",
      acesso: "pendente",
      prefixo: null,
      detalhe: String(e.message || e).slice(0, 160),
    };
  }

  const { ok: rpcOk, rows, status, reason: rpcReason } = unwrapRpc(rpcRes);
  if (!rpcOk) {
    return {
      ok: false,
      status: status || 503,
      reason: rpcReason || "vm_resolver_indisponivel",
      acesso: "pendente",
      prefixo: null,
    };
  }

  const row = rows[0];
  if (!row || row.ok !== true) {
    const reason = (row && row.reason) || "vm_sem_vinculo";
    return {
      ok: false,
      status: 403,
      reason,
      acesso: reason === "vm_sem_vinculo" ? "pendente" : "negado",
      prefixo: null,
      colaborador_ref_mascara: cpf.slice(0, 3) + "***",
      forged_ignored: forged || null,
    };
  }

  const prefixo = String(row.prefixo || "").toUpperCase();
  const autorizada = row.autorizada === true;
  return {
    ok: true,
    status: 200,
    reason: row.reason || null,
    acesso: autorizada ? "autorizado" : "pendente",
    prefixo,
    vm_id: row.vm_id || null,
    vm_status: row.status || null,
    tem_escopo: row.tem_escopo === true,
    autorizada,
    colaborador_ref_mascara: cpf.slice(0, 3) + "***",
    forged_ignored: forged || null,
  };
}

async function listarProjecao(prefixo, afterBcNo, limite, io) {
  const p = String(prefixo || "").toUpperCase();
  if (!/^[A-J]$/.test(p)) {
    return { ok: false, status: 400, reason: "prefixo_invalido", items: [] };
  }
  try {
    let rpcRes;
    const args = {
      p_prefixo: p,
      p_after_bc_no: Number(afterBcNo) || 0,
      p_limite: Number(limite) || 200,
    };
    if (io && typeof io.rpc === "function") {
      rpcRes = { ok: true, status: 200, data: await io.rpc("dk_bc_vm_projecao_listar", args) };
    } else {
      rpcRes = await restRpc("dk_bc_vm_projecao_listar", args, io);
    }
    const { ok, rows, status, reason } = unwrapRpc(rpcRes);
    if (!ok) return { ok: false, status: status || 503, reason: reason || "projecao_indisponivel", items: [] };
    return { ok: true, status: 200, items: rows };
  } catch (e) {
    return {
      ok: false,
      status: 503,
      reason: "projecao_indisponivel",
      items: [],
      detalhe: String(e.message || e).slice(0, 160),
    };
  }
}

async function lerSinalVm(prefixo, io) {
  const p = String(prefixo || "").toUpperCase();
  if (!/^[A-J]$/.test(p)) return { ok: false, reason: "prefixo_invalido" };
  try {
    let rpcRes;
    if (io && typeof io.rpc === "function") {
      rpcRes = { ok: true, status: 200, data: await io.rpc("dk_bc_vm_sinal_ler", { p_prefixo: p }) };
    } else {
      rpcRes = await restRpc("dk_bc_vm_sinal_ler", { p_prefixo: p }, io);
    }
    const { ok, rows } = unwrapRpc(rpcRes);
    const row = rows[0];
    return {
      ok: !!ok,
      prefixo: p,
      last_bc_no: row ? Number(row.last_bc_no) || 0 : 0,
      updated_at: row ? row.updated_at : null,
    };
  } catch (e) {
    return { ok: false, reason: "sinal_indisponivel", detalhe: String(e.message || e).slice(0, 120) };
  }
}

module.exports = {
  cpfDoGate,
  resolverVmDaSessao,
  listarProjecao,
  lerSinalVm,
};
