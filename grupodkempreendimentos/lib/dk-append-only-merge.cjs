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

function mergeLocacaoCadastroPar(ex, incoming) {
  const mergedPl = mergePortalLancamentosAluguelEmbutidos([
    ex?.portalLancamentosAluguel,
    incoming?.portalLancamentosAluguel,
  ]);
  const score = (l) => Number(l?.updatedAt || l?.createdAt || l?.id || 0);
  const merged = {
    ...ex,
    ...incoming,
    numeroContrato: ex?.numeroContrato || incoming?.numeroContrato,
  };
  if (mergedPl.length) merged.portalLancamentosAluguel = mergedPl;
  if (score(incoming) >= score(ex)) return merged;
  const stay = { ...ex, ...merged };
  if (mergedPl.length) stay.portalLancamentosAluguel = mergedPl;
  return stay;
}

function mergeLocacoesCadastro(previousList, incomingList) {
  const prev = Array.isArray(previousList) ? previousList : [];
  const incoming = Array.isArray(incomingList) ? incomingList : [];
  const byNc = new Map();
  const noNc = [];
  const add = (l) => {
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

module.exports = {
  mergeClientesCadastro,
  mergeVeiculosCadastro,
  mergeLocacoesCadastro,
  mergePortalLancamentosAluguelEmbutidos,
};
