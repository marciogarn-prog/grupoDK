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
      const row = {
        data,
        valor,
        createdAt: ca || Date.now(),
        registradoPorCpf: onlyDigits(raw.registradoPorCpf).slice(0, 11),
        registradoPorNome: String(raw.registradoPorNome || "").trim(),
      };
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

function anexarLancamentosMergeNaLocacao(target, ex, incoming, mergedPl) {
  if (!target || typeof target !== "object") return target;
  const mergedRem = mergePortalLancamentosRemovidos([
    ex?.portalLancamentosAluguelRemovidos,
    incoming?.portalLancamentosAluguelRemovidos,
  ]);
  target.portalLancamentosAluguel = filtrarPortalLancamentosPorRemovidos(mergedPl, mergedRem);
  if (mergedRem.length) target.portalLancamentosAluguelRemovidos = mergedRem;
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
  mergePortalLancamentosRemovidos,
  filtrarPortalLancamentosPorRemovidos,
};
