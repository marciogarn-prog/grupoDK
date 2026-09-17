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
  canonicalLocacoesDigest,
  acquireLocacoesWriteLock,
  releaseLocacoesWriteLock,
};
