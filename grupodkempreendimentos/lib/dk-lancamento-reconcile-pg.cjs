/**
 * Leva lançamentos da fila/entity (dk-lancamento-nuvem) para dk_pagamento_locacao.
 * Idempotente por protocoloLancamento (operation_id estável).
 */
const crypto = require("crypto");
const store = require("./dk-pagamento-locacao-store.cjs");
const { mutarPagamentoAtomico } = require("./dk-atomic-write-lpm.cjs");

function onlyDigits(v) {
  return String(v ?? "").replace(/\D/g, "");
}

function protoDe(pag) {
  return String(pag?.protocoloLancamento || pag?.protocolo || "").trim();
}

/** UUID determinístico a partir do protocolo de lançamento (idempotência entre retries). */
function operationIdDeProtocolo(protocolo) {
  const h = crypto.createHash("sha256").update(`dk-pag-reconcile:${protocolo}`).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

async function protocolosJaNoPg(numeroContrato) {
  const out = await store.listarPorContrato(numeroContrato);
  const set = new Set();
  if (!out || !out.ok) return { ok: false, reason: out?.reason || "leitura_pg", set };
  for (const p of out.pagamentos || []) {
    const id = protoDe(p);
    if (id) set.add(id);
  }
  return { ok: true, set, pagamentos: out.pagamentos || [] };
}

async function gravarPagamentoNoPg(item, opts) {
  const nc = onlyDigits(item?.nc || item?.numeroContrato).slice(0, 20);
  const pagamento = item?.pagamento && typeof item.pagamento === "object" ? { ...item.pagamento } : null;
  if (!nc || !pagamento) return { ok: false, reason: "lancamento_incompleto" };
  const protocolo = protoDe(pagamento);
  if (!protocolo) return { ok: false, reason: "sem_protocolo_lancamento" };
  if (!pagamento.createdAt) pagamento.createdAt = Date.now();
  if (item.cpf && !pagamento.registradoPorCpf) {
    /* mantém o que veio no pagamento */
  }
  const atom = await mutarPagamentoAtomico({
    operacao: "create",
    pagamento,
    numeroContrato: nc,
    operationId: operationIdDeProtocolo(protocolo),
    actorUserId: onlyDigits(opts?.actorUserId || pagamento.registradoPorCpf).slice(0, 11) || null,
    actorSessionId: opts?.actorSessionId || null,
    route: opts?.route || "/api/dk-lancamento-nuvem",
    method: "POST",
  });
  if (!atom.ok) {
    return {
      ok: false,
      status: atom.status,
      reason: (atom.body && atom.body.reason) || "pg_write_fail",
      body: atom.body,
    };
  }
  return {
    ok: true,
    idempotent: Boolean(atom.body && atom.body.idempotent),
    entity_id: atom.body && atom.body.entity_id,
    protocolo,
    nc,
  };
}

/**
 * @param {Array<{nc,cpf,placa,pagamento}>} itens
 * @returns {{ok, gravados, jaExistiam, falhas, total}}
 */
async function reconciliarItensParaPg(itens, opts) {
  const lista = Array.isArray(itens) ? itens : [];
  const porNc = new Map();
  for (const it of lista) {
    const nc = onlyDigits(it?.nc || it?.numeroContrato).slice(0, 20);
    if (!nc || !it?.pagamento) continue;
    if (!porNc.has(nc)) porNc.set(nc, []);
    porNc.get(nc).push(it);
  }
  let gravados = 0;
  let jaExistiam = 0;
  const falhas = [];
  for (const [nc, grupo] of porNc.entries()) {
    const atuais = await protocolosJaNoPg(nc);
    if (!atuais.ok) {
      falhas.push({ nc, reason: atuais.reason });
      continue;
    }
    for (const it of grupo) {
      const protocolo = protoDe(it.pagamento);
      if (!protocolo) {
        falhas.push({ nc, reason: "sem_protocolo" });
        continue;
      }
      if (atuais.set.has(protocolo)) {
        jaExistiam += 1;
        continue;
      }
      const r = await gravarPagamentoNoPg(it, opts);
      if (r.ok) {
        gravados += 1;
        atuais.set.add(protocolo);
      } else {
        falhas.push({ nc, protocolo, reason: r.reason, status: r.status });
      }
    }
  }
  return {
    ok: falhas.length === 0,
    gravados,
    jaExistiam,
    falhas,
    total: lista.length,
  };
}

async function hidratarPagamentosNoLoc(loc) {
  if (!loc || typeof loc !== "object") return loc;
  const nc = onlyDigits(loc.numeroContrato || loc.protocolo).slice(0, 20);
  if (!nc) return loc;
  const out = await store.listarPorContrato(nc);
  if (!out || !out.ok) return loc;
  const existentes = Array.isArray(loc.portalLancamentosAluguel) ? loc.portalLancamentosAluguel : [];
  const porProto = new Map();
  for (const p of existentes) {
    const id = protoDe(p);
    if (id) porProto.set(id, p);
  }
  for (const p of out.pagamentos || []) {
    const id = protoDe(p);
    if (id) porProto.set(id, { ...p });
  }
  const merged = Array.from(porProto.values()).sort((a, b) => {
    const ta = Number(a.createdAt || 0);
    const tb = Number(b.createdAt || 0);
    if (ta !== tb) return ta - tb;
    return String(a.data || "").localeCompare(String(b.data || ""), "pt-BR");
  });
  return { ...loc, portalLancamentosAluguel: merged };
}

module.exports = {
  operationIdDeProtocolo,
  protocolosJaNoPg,
  gravarPagamentoNoPg,
  reconciliarItensParaPg,
  hidratarPagamentosNoLoc,
  protoDe,
};
