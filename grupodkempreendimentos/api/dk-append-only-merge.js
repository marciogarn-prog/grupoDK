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

const PLACA_MERCOSUL_RE = /^[A-Z]{3}[0-9][A-Z][0-9]{2}$/;
const PLACA_ANTIGA_RE = /^[A-Z]{3}[0-9]{4}$/;
const PLACA_ANTIGA_PARA_MERCOSUL = "ABCDEFGHIJ";

function normalizePlacaParaCadastro(value) {
  const raw = normalizePlate(value);
  if (!raw) return "";
  if (PLACA_MERCOSUL_RE.test(raw)) return raw;
  if (PLACA_ANTIGA_RE.test(raw)) {
    const letter = PLACA_ANTIGA_PARA_MERCOSUL[parseInt(raw[4], 10)];
    if (letter) {
      const conv = raw.slice(0, 4) + letter + raw.slice(5);
      if (PLACA_MERCOSUL_RE.test(conv)) return conv;
    }
  }
  return raw;
}

function isVeiculoFantasmaCadastro(v) {
  if (!v || typeof v !== "object") return true;
  const pl = normalizePlacaParaCadastro(v.placa);
  const tip = String(v.codigo || v.tipoPlanilha || "").trim().toUpperCase();
  const modelo = String(v.modelo || "").trim().toUpperCase();
  const opCpf = String(v.cadastradoPorCpf || v.registradoPorCpf || "").replace(/\D/g, "");
  const opNome = String(v.cadastradoPorNome || v.registradoPorNome || "").trim();
  const opLabel = String(v.cadastradoPorLabel || v.registradoPorLabel || "").trim();
  if (!opCpf && !opNome && !opLabel) return true;
  if (/^(AAA|BBB|CCC)0/i.test(pl)) return true;
  if (tip === "Z1" || tip === "HR70") return true;
  if (/FERRARI|BUGATTI|PORSCHE|FUSCA/.test(modelo)) return true;
  return false;
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
  const prev = (Array.isArray(previousList) ? previousList : []).filter((v) => !isVeiculoFantasmaCadastro(v));
  const incoming = (Array.isArray(incomingList) ? incomingList : []).filter((v) => !isVeiculoFantasmaCadastro(v));
  const keyOf = (v) => {
    const pl = normalizePlacaParaCadastro(v.placa);
    if (pl) return pl;
    const idn = Number(v.id || v.createdAt || 0);
    return idn ? `id:${idn}` : "";
  };
  const byK = new Map();
  const score = (v) => Number(v.updatedAt || v.createdAt || v.id || 0);
  const add = (v) => {
    if (isVeiculoFantasmaCadastro(v)) return;
    const k = keyOf(v);
    if (!k) return;
    const ex = byK.get(k);
    const merged = ex ? { ...ex, ...v } : { ...v };
    const canon = normalizePlacaParaCadastro(merged.placa);
    if (canon) merged.placa = canon;
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

function mergeLocacoesCadastro(previousList, incomingList) {
  const prev = (Array.isArray(previousList) ? previousList : []).filter((l) => !isLocacaoFantasmaCadastro(l));
  const incoming = (Array.isArray(incomingList) ? incomingList : []).filter((l) => !isLocacaoFantasmaCadastro(l));
  const byNc = new Map();
  const noNc = [];
  const score = (l) => Number(l.updatedAt || l.createdAt || l.id || 0);
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
    const merged = { ...ex, ...l, numeroContrato: ex.numeroContrato || l.numeroContrato || nc };
    if (score(l) > score(ex)) {
      byNc.set(nc, merged);
      return;
    }
    if (score(l) === score(ex) && JSON.stringify(l).length >= JSON.stringify(ex).length) {
      byNc.set(nc, merged);
      return;
    }
    byNc.set(nc, { ...merged, ...ex, numeroContrato: ex.numeroContrato || nc });
  };
  prev.forEach(add);
  incoming.forEach(add);
  const list = [...byNc.values(), ...noNc];
  const killers = [];
  for (const l of list) {
    const ant = ncNorm(l?.protocoloAnterior);
    const nc = ncNorm(l?.numeroContrato);
    if (ant && nc && ant !== nc) killers.push({ ant, survivor: l });
  }
  if (!killers.length) return list;
  const same = (a, b) => {
    const idA = Number(a?.id || 0);
    const idB = Number(b?.id || 0);
    if (idA && idB && idA === idB) return true;
    const cA = Number(a?.createdAt || 0);
    const cB = Number(b?.createdAt || 0);
    if (cA && cB && cA === cB) return true;
    const cpfA = onlyDigits(a?.cpf).slice(0, 11);
    const cpfB = onlyDigits(b?.cpf).slice(0, 11);
    const plA = normalizePlate(a?.placa);
    const plB = normalizePlate(b?.placa);
    return Boolean(cpfA && cpfB && plA && plB && cpfA === cpfB && plA === plB);
  };
  return list.filter((l) => {
    const nc = ncNorm(l?.numeroContrato);
    if (!nc) return true;
    for (const k of killers) {
      if (nc !== k.ant) continue;
      if (l === k.survivor) continue;
      if (same(l, k.survivor)) return false;
    }
    return true;
  });
}

module.exports = {
  mergeClientesCadastro,
  mergeVeiculosCadastro,
  mergeLocacoesCadastro,
  isLocacaoFantasmaCadastro,
};
