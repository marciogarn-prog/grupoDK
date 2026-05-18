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

function parseBrDate(s) {
  const m = String(s || "")
    .trim()
    .match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  return Number.isNaN(d.getTime()) ? null : d;
}

function protocoloPrefixFromInicio(inicio) {
  const d = parseBrDate(inicio);
  if (!d) return "";
  return (
    d.getFullYear() +
    String(d.getMonth() + 1).padStart(2, "0") +
    String(d.getDate()).padStart(2, "0")
  );
}

function isProtocoloAligned(nc, loc) {
  const exp = protocoloPrefixFromInicio(loc.inicio);
  if (!exp) return true;
  const clean = ncNorm(nc);
  const m = clean.match(/^(\d{8})(\d+)$/);
  if (!m) return false;
  return m[1] === exp;
}

function locacaoNaturalKey(l) {
  const cpf = onlyDigits(l.cpf);
  const pl = normalizePlate(l.placa);
  const inicio = String(l.inicio || "").trim();
  if (cpf.length !== 11 || !pl || !inicio) return "";
  return `${cpf}|${pl}|${inicio}`;
}

function scoreLocacao(l) {
  const nc = ncNorm(l.numeroContrato);
  let s = Number(l.updatedAt || l.createdAt || l.id || 0);
  if (isProtocoloAligned(nc, l)) s += 1e15;
  if (Array.isArray(l.portalLancamentosAluguel)) s += l.portalLancamentosAluguel.length * 1e9;
  return s;
}

function dedupeLocacoesList(locs) {
  const list = Array.isArray(locs) ? locs.map((l) => ({ ...l })) : [];
  const drop = new Set();

  const byNatural = new Map();
  list.forEach((loc) => {
    const nk = locacaoNaturalKey(loc);
    if (!nk) return;
    if (!byNatural.has(nk)) byNatural.set(nk, []);
    byNatural.get(nk).push(loc);
  });
  byNatural.forEach((group) => {
    if (group.length <= 1) return;
    group.sort((a, b) => scoreLocacao(b) - scoreLocacao(a));
    for (let i = 1; i < group.length; i++) drop.add(Number(group[i].id));
  });

  return list.filter((l) => !drop.has(Number(l.id)));
}

function mergeLocacoesCadastro(previousList, incomingList) {
  const prev = Array.isArray(previousList) ? previousList : [];
  const incoming = Array.isArray(incomingList) ? incomingList : [];
  const dig = (cpf) => onlyDigits(cpf);
  const keyOf = (l) => {
    const cpf = dig(l.cpf);
    const pl = normalizePlate(l.placa);
    const nc = ncNorm(l.numeroContrato);
    if (cpf.length === 11 && pl && nc) return `${cpf}|${pl}|${nc}`;
    const idn = Number(l.id || l.createdAt || 0);
    return `${cpf}|${pl}|id:${idn}`;
  };
  const byK = new Map();
  const score = (l) => Number(l.updatedAt || l.createdAt || l.id || 0);
  const add = (l) => {
    const k = keyOf(l);
    const ex = byK.get(k);
    const merged = ex ? { ...ex, ...l } : { ...l };
    if (!ex) {
      byK.set(k, merged);
      return;
    }
    if (score(l) > score(ex)) {
      byK.set(k, merged);
      return;
    }
    if (score(l) === score(ex) && JSON.stringify(l).length >= JSON.stringify(ex).length) {
      byK.set(k, merged);
    }
  };
  prev.forEach(add);
  incoming.forEach(add);
  return dedupeLocacoesList(Array.from(byK.values()));
}

module.exports = {
  mergeClientesCadastro,
  mergeVeiculosCadastro,
  mergeLocacoesCadastro,
};
