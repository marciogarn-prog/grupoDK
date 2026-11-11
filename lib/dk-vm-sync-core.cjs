/**
 * Núcleo puro do sincronismo VM (sem Redis / sem rede).
 *
 * Contrato:
 * 1) VM ↔ VM: todas as VMs do cluster ficam com o MESMO estado = união append-only.
 * 2) PC ↔ VM: no login/salvar o PC contribui; depois recebe a união (espelho).
 * 3) Um PC incompleto NUNCA reduz o cluster (união irreversível em manutenção).
 */
const { neverLoseCadastroPayload, mergeManutencoesCadastro } = require("./dk-append-only-merge.cjs");

/** Chaves espelhadas entre VMs (sem locações/pagamentos — Postgres + limite Redis). */
const CLONE_KEYS = Object.freeze([
  "dk_clientes_cadastro",
  "dk_portal_clientes_cadastro",
  "dk_clientes_validacao_pendente",
  "dk_veiculos_cadastro",
  "dk_portal_veiculos_cadastro",
  "dk_veiculos_frota_planilha",
  "dk_funcionarios_access",
  "dk_manutencoes_cadastro",
  "dk_manutencoes_rapidas_v1",
  "dk_portal_setor_movimentacoes_v1",
  "dk_portal_checklist_movimentacoes_v1",
  "dk_portal_checklist_historico_v1",
  "dk_financeiro_extratos_v1",
  "dk_financeiro_despesas_v1",
  "dk_financeiro_ceo_despesas_v1",
]);

const CLONE_KEYS_EXCLUIDAS = Object.freeze(
  new Set([
    "dk_locacoes_cadastro",
    "dk_locacoes_quadro_geral",
    "dk_lancamentos_aluguel",
    "dk_comprovantes_banco",
    "dk_comprovantes_cliente_pendentes",
    "dk_audit_log",
    "dk_pagamentos_auditoria_v1",
  ])
);

const KEYS_UNIAO_PC = Object.freeze(
  new Set([
    "dk_manutencoes_cadastro",
    "dk_manutencoes_rapidas_v1",
    "dk_portal_checklist_movimentacoes_v1",
    "dk_portal_checklist_historico_v1",
    "dk_portal_setor_movimentacoes_v1",
  ])
);

function slimEstado(estado) {
  const out = {};
  const src = estado && typeof estado === "object" ? estado : {};
  for (const k of CLONE_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(src, k)) continue;
    if (CLONE_KEYS_EXCLUIDAS.has(k)) continue;
    out[k] = src[k];
  }
  return out;
}

function unirDoisEstados(a, b) {
  const base = slimEstado(a);
  const parte = slimEstado(b);
  try {
    return neverLoseCadastroPayload(base, parte, { pularLocacao: false }) || { ...base, ...parte };
  } catch {
    const out = { ...base };
    for (const k of CLONE_KEYS) {
      if (!Object.prototype.hasOwnProperty.call(parte, k)) continue;
      if (k === "dk_manutencoes_cadastro") {
        out[k] = mergeManutencoesCadastro(base[k], parte[k]);
      } else if (Array.isArray(base[k]) && Array.isArray(parte[k])) {
        out[k] = parte[k].length >= base[k].length ? parte[k] : base[k];
      } else {
        out[k] = parte[k];
      }
    }
    return out;
  }
}

/** Une N estados (hub + VMs + PC). Ordem irrelevante para o resultado final em manutenção. */
function unirCluster(estados) {
  let fundido = {};
  for (const e of Array.isArray(estados) ? estados : []) {
    fundido = unirDoisEstados(fundido, e);
  }
  return fundido;
}

function placasOficinaAtivas(estado) {
  const list = Array.isArray(estado && estado.dk_manutencoes_cadastro) ? estado.dk_manutencoes_cadastro : [];
  return list
    .filter((m) => !String(m?.dataRealSaida || "").trim())
    .filter((m) => /oficina.?propria/i.test(String(m?.categoriaManutencao || m?.categoria || "")))
    .map((m) =>
      String(m?.placa || "")
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "")
    )
    .filter(Boolean)
    .sort();
}

function assinaturaManutencoesAtivas(estado) {
  const list = Array.isArray(estado && estado.dk_manutencoes_cadastro) ? estado.dk_manutencoes_cadastro : [];
  return list
    .filter((m) => !String(m?.dataRealSaida || "").trim())
    .map((m) => {
      const pl = String(m?.placa || "")
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "");
      const cat = String(m?.categoriaManutencao || m?.categoria || "triagem")
        .trim()
        .toLowerCase();
      return pl ? `${pl}:${cat || "triagem"}` : "";
    })
    .filter(Boolean)
    .sort()
    .join("|");
}

function resumirEstado(estado) {
  const e = estado && typeof estado === "object" ? estado : {};
  const manutList = Array.isArray(e.dk_manutencoes_cadastro) ? e.dk_manutencoes_cadastro : [];
  const assinatura = assinaturaManutencoesAtivas(e);
  return {
    clientes: Array.isArray(e.dk_clientes_cadastro) ? e.dk_clientes_cadastro.length : 0,
    veiculos: Array.isArray(e.dk_veiculos_cadastro) ? e.dk_veiculos_cadastro.length : 0,
    protocolos: 0,
    protocolosAtivos: 0,
    protocolosFinalizados: 0,
    pagamentos: 0,
    manutencoes: manutList.length,
    manutencoesRapidas: Array.isArray(e.dk_manutencoes_rapidas_v1) ? e.dk_manutencoes_rapidas_v1.length : 0,
    manutencoesAtivas: assinatura ? assinatura.split("|").filter(Boolean).length : 0,
    manutencoesAtivasAssinatura: assinatura,
    checklistMovimentacoes: Array.isArray(e.dk_portal_checklist_movimentacoes_v1)
      ? e.dk_portal_checklist_movimentacoes_v1.length
      : 0,
    setorMovimentacoes: Array.isArray(e.dk_portal_setor_movimentacoes_v1)
      ? e.dk_portal_setor_movimentacoes_v1.length
      : 0,
    oficinaPropriaAtivas: placasOficinaAtivas(e).length,
  };
}

function fingerprintResumo(resumo) {
  try {
    return JSON.stringify(resumo || {});
  } catch {
    return "";
  }
}

function resumosIguais(a, b) {
  return fingerprintResumo(a) === fingerprintResumo(b);
}

/**
 * Aplica estado da VM no PC: chaves de manutenção = união; restantes = VM manda
 * (sem apagar o que a VM não traz — locações ficam no PC/Postgres).
 */
function aplicarEstadoVmNoPc(estadoPc, estadoVm) {
  const local = estadoPc && typeof estadoPc === "object" ? estadoPc : {};
  const remoto = slimEstado(estadoVm);
  const out = { ...local };
  for (const k of CLONE_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(remoto, k)) continue;
    const cloudArr = Array.isArray(remoto[k]) ? remoto[k] : [];
    const localArr = Array.isArray(local[k]) ? local[k] : [];
    if (KEYS_UNIAO_PC.has(k)) {
      if (k === "dk_manutencoes_cadastro") {
        out[k] = mergeManutencoesCadastro(localArr, cloudArr);
      } else {
        out[k] = unirDoisEstados({ [k]: localArr }, { [k]: cloudArr })[k] || cloudArr;
      }
    } else {
      out[k] = cloudArr;
    }
  }
  return out;
}

/**
 * Simula o ciclo completo do servidor sem Redis:
 * - cada VM tem um estado
 * - PC contribui na sua VM
 * - cluster = união de todas
 * - todas as VMs recebem o cluster
 * - PC recebe o cluster (espelho)
 */
function cicloSyncPcComCluster(vmsByCpf, cpf, estadoPc) {
  const mapa = { ...(vmsByCpf || {}) };
  const dig = String(cpf || "").replace(/\D/g, "");
  const atual = mapa[dig] || {};
  mapa[dig] = unirDoisEstados(atual, estadoPc);
  const cluster = unirCluster(Object.values(mapa));
  const next = {};
  for (const k of Object.keys(mapa)) next[k] = cluster;
  if (!next[dig]) next[dig] = cluster;
  const pcEspelhado = aplicarEstadoVmNoPc(estadoPc, cluster);
  return {
    cluster,
    vms: next,
    pc: pcEspelhado,
    resumo: resumirEstado(cluster),
  };
}

module.exports = {
  CLONE_KEYS,
  CLONE_KEYS_EXCLUIDAS,
  KEYS_UNIAO_PC,
  slimEstado,
  unirDoisEstados,
  unirCluster,
  resumirEstado,
  fingerprintResumo,
  resumosIguais,
  placasOficinaAtivas,
  assinaturaManutencoesAtivas,
  aplicarEstadoVmNoPc,
  cicloSyncPcComCluster,
};
