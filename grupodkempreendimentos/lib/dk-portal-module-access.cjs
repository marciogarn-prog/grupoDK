/**
 * Fonte única de permissões (Fase 1B).
 * Não altera merge. Não altera acessos gravados no cadastro.
 * Derivado de portal-locadora-ui.js + app.js + chaves de portal-supabase-sync.js.
 */

const MODULE_KEYS = {
  cliente: [
    "dk_clientes_cadastro",
    "dk_portal_clientes_cadastro",
    "dk_clientes_validacao_pendente",
    "dk_cliente_docs_v1",
    "dk_cliente_notificacoes",
  ],
  veiculo: [
    "dk_veiculos_cadastro",
    "dk_portal_veiculos_cadastro",
    "dk_veiculos_frota_planilha",
    "dk_patrimonio_crlv_v1",
    "dk_patrimonio_fotos_excluidas_v1",
  ],
  locacao: [
    "dk_locacoes_cadastro",
    "dk_locacoes_quadro_geral",
    "dk_locacao_documentos_v1",
    "dk_pagamentos_auditoria_v1",
    "dk_documentos_deposito_v1",
    "dk_protocolo_nc_remap_v1",
  ],
  manutencao: ["dk_manutencoes_cadastro", "dk_manutencoes_rapidas_v1"],
  lancamentoAluguel: [
    "dk_lancamentos_aluguel",
    "dk_lancamentos_aluguel_cadastro",
    "dk_quadro_receita_overrides",
    "dk_comprovantes_banco",
    "dk_comprovantes_cliente_pendentes",
  ],
  lancamentoMultas: ["dk_lancamentos_multas", "dk_multas_cadastro"],
  lancamentoManutencao: [
    "dk_portal_checklist_historico_v1",
    "dk_portal_checklist_movimentacoes_v1",
    "dk_portal_setor_movimentacoes_v1",
    "dk_manutencoes_rapidas_v1",
  ],
  comunicacaoVendas: ["dk_comunicacao_operacao_v1"],
  comunicacaoManutencao: ["dk_comunicacao_operacao_v1"],
  lancamentoDespesa: [
    "dk_financeiro_despesas_v1",
    "dk_financeiro_extratos_v1",
    "dk_financeiro_ceo_despesas_v1",
    "dk_financeiro_ceo_fontes_v1",
    "dk_financeiro_ceo_cartoes_v1",
    "dk_financeiro_ceo_situacao_pag_v1",
    "dk_unidade_financeiro_v1",
  ],
  funcionario: ["dk_funcionarios_access"],
  estoque: ["dk_estoque_v1", "dk_portal_estoque_v1"],
  sistemaMiel: ["dk_miel_layout_v1"],
};

const API_MODULE = {
  "cadastro-clientes": "cliente",
  "cadastro-veiculos": "veiculo",
  "cadastro-locacoes": "locacao",
  "cadastro-manutencoes-rapidas": "manutencao",
  "cadastro-financeiro-ceo": "lancamentoDespesa",
};

const METADATA_KEYS = new Set([
  "dk_dados_seguros_v1",
  "dk_cadastro_manual_portal_v1",
  "dk_oficial_sem_protocolos_v1",
  "dk_cadastro_lock_v1",
  "dk_demo_cadastro_10_v1",
  "_dkFullReplaceKeys",
]);

const CLIENT_WRITE_KEYS = new Set([
  "dk_cliente_notificacoes",
  "dk_comprovantes_cliente_pendentes",
  "dk_cliente_docs_v1",
]);

const SERVICE_SCOPES = Object.freeze([
  "snapshot",
  "backup",
  "cadastro",
  "whatsapp",
  "cron",
  "geo",
]);

function buildFullOperacaoAccess() {
  return {
    cliente: true,
    veiculo: true,
    locacao: false,
    manutencao: false,
    lancamentoAluguel: false,
    lancamentoMultas: false,
    lancamentoManutencao: false,
    comunicacaoVendas: false,
    comunicacaoManutencao: false,
    lancamentoDespesa: false,
    funcionario: false,
    sistemaMiel: false,
    estoque: false,
  };
}

function normalizeOperacaoAccess(acessos, role) {
  if (role === "owner") return buildFullOperacaoAccess();
  const fallback = buildFullOperacaoAccess();
  return {
    cliente: acessos?.cliente ?? fallback.cliente,
    veiculo: acessos?.veiculo ?? fallback.veiculo,
    locacao: acessos?.locacao ?? fallback.locacao,
    manutencao: acessos?.manutencao ?? fallback.manutencao,
    lancamentoAluguel: acessos?.lancamentoAluguel ?? fallback.lancamentoAluguel,
    lancamentoMultas: acessos?.lancamentoMultas ?? fallback.lancamentoMultas,
    lancamentoManutencao: acessos?.lancamentoManutencao ?? fallback.lancamentoManutencao,
    comunicacaoVendas: acessos?.comunicacaoVendas ?? fallback.comunicacaoVendas,
    comunicacaoManutencao: acessos?.comunicacaoManutencao ?? fallback.comunicacaoManutencao,
    lancamentoDespesa: acessos?.lancamentoDespesa ?? fallback.lancamentoDespesa,
    funcionario: false,
    sistemaMiel: Boolean(acessos?.sistemaMiel),
    estoque: Boolean(acessos?.estoque),
  };
}

function ownerWriteAccess() {
  const all = buildFullOperacaoAccess();
  Object.keys(all).forEach((k) => {
    all[k] = true;
  });
  return all;
}

function allowedKeysForAcessos(acessos) {
  const keys = new Set();
  if (!acessos || typeof acessos !== "object") return keys;
  for (const [mod, list] of Object.entries(MODULE_KEYS)) {
    if (!acessos[mod]) continue;
    for (const k of list) keys.add(k);
  }
  return keys;
}

function keyToModules(key) {
  const mods = [];
  for (const [mod, list] of Object.entries(MODULE_KEYS)) {
    if (list.includes(key)) mods.push(mod);
  }
  return mods;
}

/**
 * Decisão documentada (snapshot POST):
 * Os PCs enviam o JSON inteiro. Recusar 403 quando vier chave alheia
 * quebraria o sync. Por isso FILTRAMOS: chaves de módulo não autorizado
 * voltam a ser as oficiais. APIs cadastro-* essas sim devolvem 403.
 */
function filterIncomingByModules(existing, incoming, acessos, opts = {}) {
  if (!incoming || typeof incoming !== "object") return incoming;
  if (opts.isOwner || opts.isService) return incoming;
  if (opts.isCliente) {
    const out = {};
    for (const k of Object.keys(incoming)) {
      if (CLIENT_WRITE_KEYS.has(k) || METADATA_KEYS.has(k)) out[k] = incoming[k];
      else if (existing && Object.prototype.hasOwnProperty.call(existing, k)) out[k] = existing[k];
    }
    if (existing && typeof existing === "object") {
      for (const k of Object.keys(existing)) {
        if (!Object.prototype.hasOwnProperty.call(out, k)) out[k] = existing[k];
      }
    }
    return out;
  }
  const allowed = allowedKeysForAcessos(acessos);
  const out = { ...incoming };
  const allKnown = new Set();
  for (const list of Object.values(MODULE_KEYS)) {
    for (const k of list) allKnown.add(k);
  }
  const sourceKeys = new Set([
    ...Object.keys(incoming),
    ...(existing && typeof existing === "object" ? Object.keys(existing) : []),
  ]);
  for (const k of sourceKeys) {
    if (METADATA_KEYS.has(k)) continue;
    if (!allKnown.has(k)) {
      if (existing && Object.prototype.hasOwnProperty.call(existing, k)) out[k] = existing[k];
      else delete out[k];
      continue;
    }
    if (allowed.has(k)) continue;
    if (existing && Object.prototype.hasOwnProperty.call(existing, k)) out[k] = existing[k];
    else delete out[k];
  }
  return out;
}

function restoreCredentialFields(existing, incoming) {
  if (!incoming || typeof incoming !== "object") return incoming;
  const out = { ...incoming };
  const restoreArr = (key) => {
    const ex = Array.isArray(existing?.[key]) ? existing[key] : [];
    const inc = Array.isArray(out[key]) ? out[key] : null;
    if (!inc) return;
    const byCpf = new Map();
    for (const row of ex) {
      const cpf = String(row?.cpf || "").replace(/\D/g, "").slice(0, 11);
      if (cpf.length === 11) byCpf.set(cpf, row);
    }
    out[key] = inc.map((row) => {
      if (!row || typeof row !== "object") return row;
      const cpf = String(row.cpf || "").replace(/\D/g, "").slice(0, 11);
      const prev = byCpf.get(cpf);
      if (!prev) return row;
      const next = { ...row };
      if (!String(next.senha || "").trim() && String(prev.senha || "").trim()) next.senha = prev.senha;
      if (!String(next.senhaHash || "").trim() && String(prev.senhaHash || "").trim()) {
        next.senhaHash = prev.senhaHash;
      }
      return next;
    });
  };
  restoreArr("dk_funcionarios_access");
  restoreArr("dk_clientes_cadastro");
  restoreArr("dk_portal_clientes_cadastro");
  return out;
}

function stripSecretsFromPayload(payload) {
  if (!payload || typeof payload !== "object") return payload;
  const out = { ...payload };
  const wipe = (arr) =>
    Array.isArray(arr)
      ? arr.map((row) => {
          if (!row || typeof row !== "object") return row;
          const copy = { ...row, senha: "" };
          delete copy.senhaHash;
          return copy;
        })
      : arr;
  if (Array.isArray(out.dk_funcionarios_access)) out.dk_funcionarios_access = wipe(out.dk_funcionarios_access);
  if (Array.isArray(out.dk_clientes_cadastro)) out.dk_clientes_cadastro = wipe(out.dk_clientes_cadastro);
  if (Array.isArray(out.dk_portal_clientes_cadastro)) {
    out.dk_portal_clientes_cadastro = wipe(out.dk_portal_clientes_cadastro);
  }
  return out;
}

function jsonStable(v) {
  try {
    return JSON.stringify(v);
  } catch {
    return "";
  }
}

function changedProtectedModules(existing, incoming, acessos) {
  const denied = [];
  if (!incoming || typeof incoming !== "object") return denied;
  const allowed = allowedKeysForAcessos(acessos);
  for (const [mod, keys] of Object.entries(MODULE_KEYS)) {
    if (acessos && acessos[mod]) continue;
    for (const k of keys) {
      if (!Object.prototype.hasOwnProperty.call(incoming, k)) continue;
      if (allowed.has(k)) continue;
      if (jsonStable(incoming[k]) !== jsonStable(existing?.[k])) {
        if (!denied.includes(mod)) denied.push(mod);
      }
    }
  }
  return denied;
}

module.exports = {
  MODULE_KEYS,
  API_MODULE,
  METADATA_KEYS,
  CLIENT_WRITE_KEYS,
  SERVICE_SCOPES,
  buildFullOperacaoAccess,
  normalizeOperacaoAccess,
  ownerWriteAccess,
  allowedKeysForAcessos,
  keyToModules,
  filterIncomingByModules,
  restoreCredentialFields,
  stripSecretsFromPayload,
  changedProtectedModules,
};
