"use strict";

const crypto = require("node:crypto");

const CANONICAL_SNAPSHOT_KEY = "dk:portal:cloud_snapshot:v1";
const LOCACOES_INTEGRITY_KEY = "dk:portal:locacoes_integridade:v1";
const LOCACOES_WRITE_LOCK_KEY = "dk:portal:locacoes_write_lock:v1";

function normalizePlate(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function normalizeProtocol(value) {
  return String(value || "").replace(/\D/g, "");
}

function locacaoHasEnd(locacao) {
  const raw = locacao?.fim ?? locacao?.dataFim ?? locacao?.dataFinalizacao ?? locacao?.dtFim ?? "";
  const value = String(raw || "").trim();
  if (!value || value === "—" || value === "-" || value === "...") return false;
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(value) || /^\d{4}-\d{2}-\d{2}/.test(value)) return true;
  const excel = Number(value.replace(",", "."));
  return Number.isFinite(excel) && excel > 20000 && excel < 80000;
}

function isActiveLocacao(locacao) {
  if (!locacao || typeof locacao !== "object" || locacao.contratoCancelado === true) return false;
  const status = String(locacao.statusLocacao || locacao.status || "")
    .trim()
    .toUpperCase();
  if (status.includes("CANCEL") || status.includes("FINALIZ") || status.includes("INATIV")) return false;
  return !locacaoHasEnd(locacao);
}

function findActivePlateConflicts(locacoes) {
  const byPlate = new Map();
  for (const locacao of Array.isArray(locacoes) ? locacoes : []) {
    if (!isActiveLocacao(locacao)) continue;
    const placa = normalizePlate(locacao.placa);
    const protocolo = normalizeProtocol(locacao.numeroContrato || locacao.protocolo);
    if (!placa || !protocolo) continue;
    if (!byPlate.has(placa)) byPlate.set(placa, new Map());
    byPlate.get(placa).set(protocolo, {
      protocolo,
      cliente: String(locacao.nome || locacao.cliente || "").trim() || "—",
      cpf: String(locacao.cpf || "").replace(/\D/g, "").slice(0, 11),
      inicio: String(locacao.inicio || locacao.dataInicio || "").trim(),
    });
  }
  return Array.from(byPlate.entries())
    .filter(([, protocolos]) => protocolos.size > 1)
    .map(([placa, protocolos]) => ({
      placa,
      contratos: Array.from(protocolos.values()).sort((a, b) =>
        a.protocolo.localeCompare(b.protocolo, "pt-BR")
      ),
    }))
    .sort((a, b) => a.placa.localeCompare(b.placa, "pt-BR"));
}

function activePlateConflictMessage(conflict) {
  const protocolos = (conflict?.contratos || []).map((x) => x.protocolo).filter(Boolean).join(" E ");
  return (
    `ESTE VEÍCULO JÁ ESTÁ LOCADO COM PROTOCOLO ${protocolos || "NÃO INFORMADO"}. ` +
    "É NECESSÁRIO FINALIZAR O PROTOCOLO PARA UTILIZAÇÃO DESTE VEÍCULO."
  );
}

function normalizePaymentDate(value) {
  const s = String(value || "").trim();
  const br = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (br) return `${String(Number(br[1])).padStart(2, "0")}/${String(Number(br[2])).padStart(2, "0")}/${br[3]}`;
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
  return s;
}

function paymentIdentity(payment) {
  const protocolo = String(payment?.protocoloLancamento || payment?.protocolo || "").trim();
  if (protocolo) return `p:${protocolo}`;
  return [
    "l",
    Number(payment?.createdAt || payment?.id || 0),
    String(payment?.registradoPorCpf || "").replace(/\D/g, "").slice(0, 11),
  ].join(":");
}

function findDuplicatePaymentsByProtocol(locacoes) {
  const duplicates = [];
  for (const locacao of Array.isArray(locacoes) ? locacoes : []) {
    const protocoloContrato = normalizeProtocol(locacao?.numeroContrato || locacao?.protocolo);
    if (!protocoloContrato) continue;
    const groups = new Map();
    for (const payment of Array.isArray(locacao?.portalLancamentosAluguel)
      ? locacao.portalLancamentosAluguel
      : []) {
      const tipo = String(payment?.tipoMovimento || "").trim().toUpperCase();
      const valor = Number(payment?.valor);
      if (!Number.isFinite(valor) || valor <= 0) continue;
      /* Só aluguel: caução/crédito/devolução podem coincidir no valor no mesmo dia. */
      if (
        tipo === "DEVOLUCAO_INVESTIMENTO" ||
        tipo === "CREDITO_MANUTENCAO" ||
        tipo === "CREDITO_DE_MANUTENCAO" ||
        tipo === "CAUCAO" ||
        tipo === "CAUÇÃO" ||
        tipo === "CAUÇAO"
      ) {
        continue;
      }
      const data = normalizePaymentDate(payment?.data || payment?.dataPagamento);
      if (!data) continue;
      const key = `${protocoloContrato}|${data}|${Math.round(valor * 100)}`;
      if (!groups.has(key)) groups.set(key, { protocoloContrato, data, valor, pagamentos: [] });
      groups.get(key).pagamentos.push(paymentIdentity(payment));
    }
    for (const group of groups.values()) {
      const ids = Array.from(new Set(group.pagamentos)).sort();
      if (ids.length > 1) duplicates.push({ ...group, pagamentos: ids });
    }
  }
  return duplicates.sort((a, b) =>
    `${a.protocoloContrato}|${a.data}|${a.valor}`.localeCompare(
      `${b.protocoloContrato}|${b.data}|${b.valor}`,
      "pt-BR"
    )
  );
}

function duplicatePaymentFingerprint(group) {
  return [
    group?.protocoloContrato,
    group?.data,
    Math.round(Number(group?.valor) * 100),
    ...(Array.isArray(group?.pagamentos) ? group.pagamentos : []),
  ].join("|");
}

function findNewDuplicatePayments(existingLocacoes, resultingLocacoes) {
  const previous = new Set(
    findDuplicatePaymentsByProtocol(existingLocacoes).map(duplicatePaymentFingerprint)
  );
  return findDuplicatePaymentsByProtocol(resultingLocacoes).filter(
    (group) => !previous.has(duplicatePaymentFingerprint(group))
  );
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, stableValue(value[key])])
  );
}

function canonicalLocacoesDigest(locacoes) {
  const rows = (Array.isArray(locacoes) ? locacoes : [])
    .map((locacao) => stableValue(locacao))
    .sort((a, b) => {
      const nc = normalizeProtocol(a?.numeroContrato).localeCompare(normalizeProtocol(b?.numeroContrato));
      if (nc) return nc;
      return JSON.stringify(a).localeCompare(JSON.stringify(b));
    });
  return crypto.createHash("sha256").update(JSON.stringify(rows)).digest("hex");
}

async function acquireLocacoesWriteLock(redis, opts = {}) {
  const attempts = Math.max(1, Number(opts.attempts) || 30);
  const waitMs = Math.max(10, Number(opts.waitMs) || 75);
  const ttlSec = Math.max(5, Number(opts.ttlSec) || 15);
  const token = crypto.randomUUID();
  for (let i = 0; i < attempts; i += 1) {
    const acquired = await redis.set(LOCACOES_WRITE_LOCK_KEY, token, { nx: true, ex: ttlSec });
    if (acquired) return token;
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }
  return "";
}

async function releaseLocacoesWriteLock(redis, token) {
  if (!token) return;
  try {
    const current = await redis.get(LOCACOES_WRITE_LOCK_KEY);
    if (String(current || "") === String(token)) await redis.del(LOCACOES_WRITE_LOCK_KEY);
  } catch {
    /* O TTL libera o lock mesmo se a limpeza falhar. */
  }
}

module.exports = {
  CANONICAL_SNAPSHOT_KEY,
  LOCACOES_INTEGRITY_KEY,
  LOCACOES_WRITE_LOCK_KEY,
  normalizePlate,
  normalizeProtocol,
  locacaoHasEnd,
  isActiveLocacao,
  findActivePlateConflicts,
  activePlateConflictMessage,
  normalizePaymentDate,
  findDuplicatePaymentsByProtocol,
  findNewDuplicatePayments,
  canonicalLocacoesDigest,
  acquireLocacoesWriteLock,
  releaseLocacoesWriteLock,
};
