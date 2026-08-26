/**
 * União de listas de cadastro DK sem remover registos existentes (regra de histórico).
 * Espelha a lógica de `mergeCadastroHistoricoImutavel` em app.js (chaves naturais).
 */

function onlyDigits(s) {
  return String(s ?? "").replace(/\D/g, "");
}

function normalizePlate(p) {
  return String(p ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

/** Igual a `normalizeNumeroContratoKey` em app.js + remoção de espaços (chave de locação). */
function normalizeNumeroContratoKey(value) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, " ");
}

function ncNorm(v) {
  return String(normalizeNumeroContratoKey(v || ""))
    .trim()
    .replace(/\s+/g, "");
}

/**
 * Locação fantasma (seed LOC0A99 / sem CPF) — nunca entra no merge append-only
 * nem volta à nuvem oficial por push de browser sujo.
 */
function isLocacaoFantasmaCadastro(l) {
  if (!l || typeof l !== "object") return true;
  const placa = normalizePlate(l.placa);
  const cpf = onlyDigits(l.cpf).slice(0, 11);
  if (/^LOC\d/i.test(placa) || /^TST\d/i.test(placa)) return true;
  if (l.__dkSeedTesteReserva === true) return true;
  if (cpf.length !== 11) {
    const nome = String(l.nome || "").trim();
    const inicio = String(l.inicio || l.dataInicio || "").trim();
    if (!nome && !inicio) return true;
  }
  return false;
}

function mergeClientesCadastro(previousList, incomingList) {
  const prev = Array.isArray(previousList) ? previousList : [];
  const incoming = Array.isArray(incomingList) ? incomingList : [];
  const byCpf = new Map();
  const dig = (cpf) => onlyDigits(cpf);
  const score = (c) => Number(c.createdAt || c.id || 0);
  const add = (c) => {
    const cpf = dig(c.cpf);
    if (cpf.length !== 11) return;
    const ex = byCpf.get(cpf);
    const merged = ex ? { ...ex, ...c, cpf } : { ...c, cpf };
    if (!ex) {
      byCpf.set(cpf, merged);
      return;
    }
    if (score(c) > score(ex)) {
      byCpf.set(cpf, merged);
      return;
    }
    if (score(c) === score(ex) && JSON.stringify(c).length >= JSON.stringify(ex).length) {
      byCpf.set(cpf, merged);
    }
  };
  prev.forEach(add);
  incoming.forEach(add);
  return Array.from(byCpf.values());
}

function mergeVeiculosCadastro(previousList, incomingList) {
  const prev = Array.isArray(previousList) ? previousList : [];
  const incoming = Array.isArray(incomingList) ? incomingList : [];
  const keyOf = (v) => {
    const pl = normalizePlate(v.placa);
    if (pl) return pl;
    const idn = Number(v.id || v.createdAt || 0);
    return idn ? `id:${idn}` : "";
  };
  const byK = new Map();
  const score = (v) => Number(v.updatedAt || v.createdAt || v.id || 0);
  const add = (v) => {
    const k = keyOf(v);
    if (!k) return;
    const ex = byK.get(k);
    const merged = ex ? { ...ex, ...v } : { ...v };
    if (!ex) {
      byK.set(k, merged);
      return;
    }
    if (score(v) > score(ex)) {
      byK.set(k, merged);
      return;
    }
    if (score(v) === score(ex) && JSON.stringify(v).length >= JSON.stringify(ex).length) {
      byK.set(k, merged);
    }
  };
  prev.forEach(add);
  incoming.forEach(add);
  return Array.from(byK.values());
}

function mergePortalLancamentosAluguelEmbutidos(arrays) {
  const MEIOS = ["valorEspecie", "valorPix", "valorCartao"];
  const hasMeios = (o) =>
    o && typeof o === "object" && MEIOS.some((k) => Object.prototype.hasOwnProperty.call(o, k));
  const parseVal = (v) => {
    if (typeof v === "number" && Number.isFinite(v)) return v;
    const s = String(v ?? "")
      .replace(/[R$\s]/g, "")
      .replace(/\./g, "")
      .replace(",", ".");
    const n = Number(s);
    return Number.isFinite(n) ? n : 0;
  };
  const byKey = new Map();
  for (const arr of arrays || []) {
    if (!Array.isArray(arr)) continue;
    for (const raw of arr) {
      if (!raw || typeof raw !== "object") continue;
      const data = String(raw.data || raw.dataPagamento || raw.semanaInicio || "").trim();
      if (!data) continue;
      let valor =
        typeof raw.valor === "number" && Number.isFinite(raw.valor) && raw.valor > 0
          ? raw.valor
          : parseVal(raw.valor ?? raw.valorPago);
      if (hasMeios(raw)) {
        const sum = MEIOS.reduce((s, k) => s + parseVal(raw[k]), 0);
        if (sum > 0) valor = sum;
      }
      if (!Number.isFinite(valor) || valor <= 0) continue;
      const ca = Number(raw.createdAt || raw.id || 0);
      const key = `${data}|${valor}|${ca}`;
      if (byKey.has(key)) continue;
      const row = { ...raw, data, valor, createdAt: ca || Date.now() };
      row.registradoPorCpf = onlyDigits(raw.registradoPorCpf).slice(0, 11);
      row.registradoPorNome = String(raw.registradoPorNome || "").trim();
      if (raw.protocoloLancamento || raw.protocolo) {
        row.protocoloLancamento = String(raw.protocoloLancamento || raw.protocolo || "").trim();
      }
      if (hasMeios(raw)) {
        row.valorEspecie = parseVal(raw.valorEspecie);
        row.valorPix = parseVal(raw.valorPix);
        row.valorCartao = parseVal(raw.valorCartao);
      }
      if (raw.origemComprovanteClienteId) {
        row.origemComprovanteClienteId = String(raw.origemComprovanteClienteId).trim();
      }
      if (raw.confirmadoViaAppCliente) row.confirmadoViaAppCliente = true;
      byKey.set(key, row);
    }
  }
  return Array.from(byKey.values()).sort((a, b) => Number(a.createdAt || 0) - Number(b.createdAt || 0));
}

function portalLancamentoRemocaoKeys(x) {
  const keys = [];
  const proto = String(x?.protocoloLancamento || x?.protocolo || "").trim();
  if (/^\d{14}-\d{3}$/.test(proto)) keys.push("p:" + proto);
  const data = String(x?.data || x?.dataPagamento || "").trim();
  const valor = Number(x?.valor);
  const ca = Number(x?.createdAt || x?.id || 0);
  const rp = onlyDigits(x?.registradoPorCpf).slice(0, 11);
  if (data && Number.isFinite(valor) && valor > 0) {
    keys.push("l:" + data + "|" + valor.toFixed(2) + "|" + (Number.isFinite(ca) ? ca : 0) + "|" + rp);
  }
  return keys;
}

function mergePortalLancamentosRemovidos(arrays) {
  const byId = new Map();
  for (const arr of arrays || []) {
    if (!Array.isArray(arr)) continue;
    for (const raw of arr) {
      if (!raw || typeof raw !== "object") continue;
      const keys = portalLancamentoRemocaoKeys(raw);
      if (!keys.length) continue;
      const row = {
        protocoloLancamento: String(raw.protocoloLancamento || raw.protocolo || "").trim(),
        data: String(raw.data || raw.dataPagamento || "").trim(),
        valor: Number(raw.valor),
        createdAt: Number(raw.createdAt || 0),
        registradoPorCpf: onlyDigits(raw.registradoPorCpf).slice(0, 11),
        removedAt: Number(raw.removedAt || 0) || Date.now(),
      };
      const id = keys.join("|");
      if (!byId.has(id)) byId.set(id, row);
    }
  }
  return Array.from(byId.values());
}

function filtrarPortalLancamentosPorRemovidos(payments, removidos) {
  const list = Array.isArray(payments) ? payments : [];
  if (!list.length) return list;
  const rem = Array.isArray(removidos) ? removidos : [];
  if (!rem.length) return list;
  const tomb = new Set();
  for (const t of rem) {
    for (const k of portalLancamentoRemocaoKeys(t)) tomb.add(k);
  }
  return list.filter((row) => !portalLancamentoRemocaoKeys(row).some((k) => tomb.has(k)));
}

function pagamentoAuditoriaId(ev) {
  if (ev?.id) return String(ev.id).trim();
  const at = Number(ev?.at || ev?.createdAt || 0);
  const acao = String(ev?.acao || "").trim().toLowerCase();
  const proto = String(ev?.protocoloLancamento || "").trim();
  const nc = ncNorm(ev?.numeroContrato);
  const cpf = onlyDigits(ev?.operadorCpf).slice(0, 11);
  return [at, acao, proto, nc, cpf].join("|");
}

function mergePagamentosAuditoria(arrays) {
  const byId = new Map();
  for (const arr of arrays || []) {
    if (!Array.isArray(arr)) continue;
    for (const raw of arr) {
      if (!raw || typeof raw !== "object") continue;
      const acao = String(raw.acao || "").trim().toLowerCase();
      if (!acao) continue;
      const id = pagamentoAuditoriaId(raw);
      if (!id) continue;
      if (byId.has(id)) continue;
      byId.set(id, {
        id,
        at: Number(raw.at || raw.createdAt || 0) || Date.now(),
        acao,
        numeroContrato: String(raw.numeroContrato || "").trim(),
        cpfCliente: onlyDigits(raw.cpfCliente).slice(0, 11),
        protocoloLancamento: String(raw.protocoloLancamento || "").trim(),
        dataPagamento: String(raw.dataPagamento || raw.data || "").trim(),
        valor: Number(raw.valor) || 0,
        operadorCpf: onlyDigits(raw.operadorCpf).slice(0, 11),
        operadorNome: String(raw.operadorNome || "").trim(),
        detalhe: String(raw.detalhe || "").trim(),
      });
    }
  }
  return Array.from(byId.values()).sort((a, b) => Number(a.at || 0) - Number(b.at || 0));
}

function anexarLancamentosMergeNaLocacao(target, ex, incoming, mergedPl) {
  if (!target || typeof target !== "object") return target;
  const mergedRem = mergePortalLancamentosRemovidos([
    ex?.portalLancamentosAluguelRemovidos,
    incoming?.portalLancamentosAluguelRemovidos,
  ]);
  target.portalLancamentosAluguel = filtrarPortalLancamentosPorRemovidos(mergedPl, mergedRem);
  if (mergedRem.length) target.portalLancamentosAluguelRemovidos = mergedRem;
  const mergedAud = mergePagamentosAuditoria([
    ex?.portalPagamentosAuditoria,
    incoming?.portalPagamentosAuditoria,
  ]);
  if (mergedAud.length) target.portalPagamentosAuditoria = mergedAud;
  syncResumoPagamentosNaLocacao(target);
  return target;
}

function syncResumoPagamentosNaLocacao(loc) {
  if (!loc || typeof loc !== "object") return loc;
  const arr = Array.isArray(loc.portalLancamentosAluguel) ? loc.portalLancamentosAluguel : [];
  const sum = arr.reduce((s, x) => s + Number(x.valor || 0), 0);
  loc.totalPagoAno2025 = sum.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const maxCa = arr.reduce((m, x) => Math.max(m, Number(x.createdAt || 0)), 0);
  const cur = Number(loc.updatedAt || loc.createdAt || 0);
  if (Number.isFinite(maxCa) && maxCa > cur) loc.updatedAt = maxCa;
  if (!arr.length) {
    loc.ultimoLancamentoAluguelData = "";
    loc.ultimoLancamentoAluguelValor = "";
    return loc;
  }
  const last = arr.reduce(
    (a, b) => (Number(b.createdAt || 0) >= Number(a.createdAt || 0) ? b : a),
    arr[0]
  );
  loc.ultimoLancamentoAluguelData = String(last.data || "").trim();
  loc.ultimoLancamentoAluguelValor =
    "R$\u00a0" +
    Number(last.valor || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return loc;
}

function mergeLocacaoCadastroPar(ex, incoming) {
  const mergedPl = mergePortalLancamentosAluguelEmbutidos([
    ex?.portalLancamentosAluguel,
    incoming?.portalLancamentosAluguel,
  ]);
  const score = (l) => Number(l?.updatedAt || l?.createdAt || l?.id || 0);
  const keepIncoming = score(incoming) >= score(ex);
  const merged = keepIncoming
    ? { ...ex, ...incoming, numeroContrato: ex?.numeroContrato || incoming?.numeroContrato }
    : { ...incoming, ...ex, numeroContrato: ex?.numeroContrato || incoming?.numeroContrato };
  anexarLancamentosMergeNaLocacao(merged, ex, incoming, mergedPl);
  return merged;
}

function mergeLocacoesCadastro(previousList, incomingList) {
  const prev = (Array.isArray(previousList) ? previousList : []).filter((l) => !isLocacaoFantasmaCadastro(l));
  const incoming = (Array.isArray(incomingList) ? incomingList : []).filter((l) => !isLocacaoFantasmaCadastro(l));
  const byNc = new Map();
  const noNc = [];
  const add = (l) => {
    if (isLocacaoFantasmaCadastro(l)) return;
    const nc = ncNorm(l.numeroContrato);
    if (!nc) {
      noNc.push({ ...l });
      return;
    }
    const ex = byNc.get(nc);
    if (!ex) {
      byNc.set(nc, { ...l, numeroContrato: l.numeroContrato || nc });
      return;
    }
    byNc.set(nc, mergeLocacaoCadastroPar(ex, l));
  };
  prev.forEach(add);
  incoming.forEach(add);
  return [...byNc.values(), ...noNc];
}

/**
 * União de colaboradores por CPF (11 dígitos). Nunca remove um CPF que já
 * existia: uma máquina com a semente de 3 pessoas não apaga Jesimiel/Wylkaline.
 */
function mergeFuncionariosAccess(previousList, incomingList) {
  const byCpf = new Map();
  const put = (f) => {
    if (!f || typeof f !== "object") return;
    const cpf = onlyDigits(f.cpf).slice(0, 11);
    if (cpf.length !== 11) return;
    const prev = byCpf.get(cpf);
    if (!prev) {
      byCpf.set(cpf, { ...f, cpf });
      return;
    }
    const senha = String(f.senha || "").trim() || String(prev.senha || "").trim();
    const nome = String(f.nome || "").trim() || String(prev.nome || "").trim();
    const funcao = String(f.funcao || "").trim() || String(prev.funcao || "").trim();
    const dataIngresso = String(f.dataIngresso || "").trim() || String(prev.dataIngresso || "").trim();
    const acessos =
      f.acessos && typeof f.acessos === "object"
        ? { ...(prev.acessos && typeof prev.acessos === "object" ? prev.acessos : {}), ...f.acessos }
        : prev.acessos;
    const rolePrev = String(prev.role || "").trim() === "owner" ? "owner" : "operacao";
    const roleInc = String(f.role || "").trim() === "owner" ? "owner" : "operacao";
    const role = rolePrev === "owner" || roleInc === "owner" ? "owner" : "operacao";
    const blocked = Object.prototype.hasOwnProperty.call(f, "blocked")
      ? Boolean(f.blocked)
      : Boolean(prev.blocked);
    const mustChangePassword = Object.prototype.hasOwnProperty.call(f, "mustChangePassword")
      ? Boolean(f.mustChangePassword)
      : Boolean(prev.mustChangePassword);
    byCpf.set(cpf, {
      ...prev,
      ...f,
      cpf,
      senha,
      nome,
      funcao,
      dataIngresso,
      acessos,
      role,
      blocked,
      mustChangePassword,
    });
  };
  (Array.isArray(previousList) ? previousList : []).forEach(put);
  (Array.isArray(incomingList) ? incomingList : []).forEach(put);
  return Array.from(byCpf.values());
}

/**
 * União irreversível dos cadastros operacionais: CPF, placa, protocolo,
 * colaboradores e lançamentos/auditoria nunca saem porque o snapshot incoming veio menor.
 */
function neverLoseCadastroPayload(existing, incoming) {
  if (!existing || typeof existing !== "object") {
    return incoming && typeof incoming === "object" ? incoming : existing;
  }
  if (!incoming || typeof incoming !== "object") return existing;
  const out = { ...incoming };
  const pairs = [
    ["dk_clientes_cadastro", mergeClientesCadastro],
    ["dk_portal_clientes_cadastro", mergeClientesCadastro],
    ["dk_veiculos_cadastro", mergeVeiculosCadastro],
    ["dk_portal_veiculos_cadastro", mergeVeiculosCadastro],
    ["dk_veiculos_frota_planilha", mergeVeiculosCadastro],
    ["dk_locacoes_cadastro", mergeLocacoesCadastro],
    ["dk_funcionarios_access", mergeFuncionariosAccess],
  ];
  for (const [k, fn] of pairs) {
    const hasEx = Array.isArray(existing[k]);
    const hasIn = Array.isArray(incoming[k]);
    if (!hasEx && !hasIn) continue;
    out[k] = fn(hasEx ? existing[k] : [], hasIn ? incoming[k] : []);
  }
  if (Array.isArray(existing.dk_pagamentos_auditoria_v1) || Array.isArray(incoming.dk_pagamentos_auditoria_v1)) {
    out.dk_pagamentos_auditoria_v1 = mergePagamentosAuditoria([
      existing.dk_pagamentos_auditoria_v1,
      incoming.dk_pagamentos_auditoria_v1,
    ]);
  }
  out.dk_dados_seguros_v1 = true;
  return out;
}

module.exports = {
  mergeClientesCadastro,
  mergeVeiculosCadastro,
  mergeLocacoesCadastro,
  mergeFuncionariosAccess,
  mergePortalLancamentosAluguelEmbutidos,
  mergePortalLancamentosRemovidos,
  filtrarPortalLancamentosPorRemovidos,
  mergePagamentosAuditoria,
  neverLoseCadastroPayload,
  isLocacaoFantasmaCadastro,
};
