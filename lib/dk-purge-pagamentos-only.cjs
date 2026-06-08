/**
 * Limpeza restrita: comprovantes + histórico de pagamentos.
 * NÃO remove dk_clientes_cadastro, dk_veiculos_cadastro nem linhas de dk_locacoes_cadastro.
 */

const PAYMENT_ARRAY_KEYS_ON_LOC = [
  "portalLancamentosAluguel",
  "lancamentosAluguel",
  "portalManutencoesRegistro",
  "portalMultasTransito",
];

const PROTECTED_SNAPSHOT_KEYS = new Set([
  "dk_clientes_cadastro",
  "dk_veiculos_cadastro",
  "dk_portal_clientes_cadastro",
]);

const COMPROVANTE_BANK_KEYS = [
  "dk_comprovantes_banco_assinaturas",
  "dk_comprovantes_banco",
  "dk_cliente_comprovantes_enviados",
];

function onlyDigits(s) {
  return String(s ?? "").replace(/\D/g, "");
}

function normProto(v) {
  return String(v ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function matchCpf(r, cpfSet, key = "cpf") {
  return cpfSet.has(onlyDigits(r?.[key]).slice(0, 11));
}

function matchProto(r, protoSet, keys = ["protocolo", "numeroContrato"]) {
  if (!protoSet.size) return false;
  for (const k of keys) {
    const p = normProto(r?.[k]);
    if (p && protoSet.has(p)) return true;
  }
  return false;
}

function matchAlvo(r, cpfSet, protoSet, cpfKey = "cpf") {
  if (cpfSet.size && matchCpf(r, cpfSet, cpfKey)) return true;
  return matchProto(r, protoSet);
}

function zerarPagamentosNaLocacao(loc) {
  const next = { ...loc };
  for (const k of PAYMENT_ARRAY_KEYS_ON_LOC) {
    if (Array.isArray(next[k]) && next[k].length) next[k] = [];
  }
  return next;
}

/**
 * @param {object} payload
 * @param {Set<string>} cpfSet — 11 dígitos
 * @param {Set<string>} [protoSet] — protocolos normalizados (ex. 2026010101)
 */
function purgePagamentosComprovantesPayload(payload, cpfSet, protoSet = new Set()) {
  const stats = {
    comprovantesAntes: 0,
    comprovantesDepois: 0,
    notificacoesRemovidas: 0,
    pagamentosZeradosEmLocacoes: 0,
    lancamentosGlobaisRemovidos: 0,
    assinaturasRemovidas: 0,
    validacaoRemovida: 0,
    protocolosAfetados: new Set(),
  };

  if (Array.isArray(payload.dk_comprovantes_cliente_pendentes)) {
    stats.comprovantesAntes = payload.dk_comprovantes_cliente_pendentes.length;
    for (const r of payload.dk_comprovantes_cliente_pendentes) {
      if (matchAlvo(r, cpfSet, protoSet)) stats.protocolosAfetados.add(normProto(r.protocolo));
    }
    payload.dk_comprovantes_cliente_pendentes = payload.dk_comprovantes_cliente_pendentes.filter(
      (r) => !matchAlvo(r, cpfSet, protoSet)
    );
    stats.comprovantesDepois = payload.dk_comprovantes_cliente_pendentes.length;
  }

  if (Array.isArray(payload.dk_cliente_notificacoes)) {
    const antes = payload.dk_cliente_notificacoes.length;
    payload.dk_cliente_notificacoes = payload.dk_cliente_notificacoes.filter(
      (n) => !matchAlvo(n, cpfSet, protoSet)
    );
    stats.notificacoesRemovidas = antes - payload.dk_cliente_notificacoes.length;
  }

  for (const bk of COMPROVANTE_BANK_KEYS) {
    if (!Array.isArray(payload[bk])) continue;
    const antes = payload[bk].length;
    payload[bk] = payload[bk].filter((sig) => {
      const proto = normProto(sig?.protocolo);
      if (proto && stats.protocolosAfetados.has(proto)) return false;
      if (matchAlvo(sig, cpfSet, protoSet)) return false;
      return true;
    });
    stats.assinaturasRemovidas += antes - payload[bk].length;
  }

  if (Array.isArray(payload.dk_locacoes_cadastro)) {
    payload.dk_locacoes_cadastro = payload.dk_locacoes_cadastro.map((loc) => {
      if (!matchAlvo(loc, cpfSet, protoSet)) return loc;
      stats.protocolosAfetados.add(normProto(loc.numeroContrato));
      const hadPay = PAYMENT_ARRAY_KEYS_ON_LOC.some((k) => Array.isArray(loc[k]) && loc[k].length);
      if (hadPay) stats.pagamentosZeradosEmLocacoes += 1;
      return zerarPagamentosNaLocacao(loc);
    });
  }

  const lancKeys = ["dk_lancamentos_aluguel", "dk_lancamentos_aluguel_cadastro"];
  for (const lk of lancKeys) {
    if (!Array.isArray(payload[lk])) continue;
    const antes = payload[lk].length;
    payload[lk] = payload[lk].filter((row) => {
      if (matchAlvo(row, cpfSet, protoSet)) return false;
      const proto = normProto(row?.numeroContrato || row?.protocolo);
      if (proto && stats.protocolosAfetados.has(proto)) return false;
      return true;
    });
    stats.lancamentosGlobaisRemovidos += antes - payload[lk].length;
  }

  if (Array.isArray(payload.dk_clientes_validacao_pendente)) {
    const antes = payload.dk_clientes_validacao_pendente.length;
    payload.dk_clientes_validacao_pendente = payload.dk_clientes_validacao_pendente.filter(
      (r) => !matchAlvo(r, cpfSet, protoSet)
    );
    stats.validacaoRemovida = antes - payload.dk_clientes_validacao_pendente.length;
  }

  return stats;
}

module.exports = {
  onlyDigits,
  normProto,
  PAYMENT_ARRAY_KEYS_ON_LOC,
  PROTECTED_SNAPSHOT_KEYS,
  purgePagamentosComprovantesPayload,
  zerarPagamentosNaLocacao,
};
