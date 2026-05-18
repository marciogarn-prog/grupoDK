/**
 * Recalcula todos os numeroContrato com base em inicio (DD/MM/AAAA) e regrava o bundle.
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const importPath = path.join(__dirname, "..", "locacoes-receita-2026-import.js");

function parseBrDate(s) {
  const m = String(s || "")
    .trim()
    .match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  return Number.isNaN(d.getTime()) ? null : d;
}

function prefixFromInicio(inicio) {
  const d = parseBrDate(inicio);
  if (!d) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

function parseProtocolo(nc) {
  const clean = String(nc || "").replace(/\s+/g, "");
  const m = clean.match(/^(\d{8})(\d+)$/);
  if (!m) return null;
  return { prefix: m[1], seq: Number(m[2]), full: clean };
}

function padSeq(seq) {
  const width = seq <= 99 ? 2 : String(seq).length;
  return String(seq).padStart(width, "0");
}

function allocNext(prefix, used, maxSeqByPrefix) {
  let seq = Number(maxSeqByPrefix.get(prefix) || 0) + 1;
  let protocolo = `${prefix}${padSeq(seq)}`;
  while (used.has(protocolo)) {
    seq += 1;
    protocolo = `${prefix}${padSeq(seq)}`;
  }
  used.add(protocolo);
  maxSeqByPrefix.set(prefix, seq);
  return protocolo;
}

function escJs(s) {
  return String(s ?? "").replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function serializeRow(item) {
  const fields = [
    ["numeroContrato", item.numeroContrato],
    ["cpf", item.cpf],
    ["placa", item.placa],
    ["inicio", item.inicio],
    ["fim", item.fim],
    ["plano", item.plano],
    ["valorLocacao", item.valorLocacao],
    ["valorInvestimento", item.valorInvestimento],
    ["valorSemanal", item.valorSemanal],
    ["valorParcela", item.valorParcela],
    ["statusLocacao", item.statusLocacao],
    ["diaPagto", item.diaPagto],
    ["periodoLocacao", item.periodoLocacao],
    ["modalidade", item.modalidade],
    ["marcaModelo", item.marcaModelo],
    ["opcaoContrato", item.opcaoContrato],
    ["periodoContrato", item.periodoContrato],
    ["kmInicial", item.kmInicial],
    ["configPrecoKm", item.configPrecoKm],
    ["tabela", item.tabela],
    ["clienteCodigo", item.clienteCodigo],
  ];
  const lines = fields.map(([k, v]) => `      ${k}: "${escJs(v)}",`);
  return `    {\n${lines.join("\n")}\n    }`;
}

const code = fs.readFileSync(importPath, "utf8");
const rows = vm.runInNewContext(`${code}\nLOCACOES_RECEITA_2026_IMPORT;`, {});

const used = new Set();
const maxSeqByPrefix = new Map();
let remapped = 0;

rows.forEach((row) => {
  const oldNc = String(row.numeroContrato || "").replace(/\s+/g, "");
  const exp = prefixFromInicio(row.inicio);
  const parts = parseProtocolo(oldNc);
  if (!exp || !parts) return;
  if (parts.prefix === exp && !used.has(oldNc)) {
    used.add(oldNc);
    maxSeqByPrefix.set(exp, Math.max(Number(maxSeqByPrefix.get(exp) || 0), parts.seq));
    return;
  }
  const newNc = allocNext(exp, used, maxSeqByPrefix);
  if (newNc !== oldNc) remapped += 1;
  row.numeroContrato = newNc;
});

const header =
  "/* Importacao RECEITA 2026, linhas 9-386. Gerado por scripts/gerar-locacoes-receita-2026-import.ps1 */\n";
const body = `const LOCACOES_RECEITA_2026_IMPORT = [\n${rows.map(serializeRow).join(",\n")}\n];\n`;
fs.writeFileSync(importPath, header + body, "utf8");

console.log(`Rows: ${rows.length}, reassigned: ${remapped}`);
const dup = new Map();
rows.forEach((r) => {
  const nc = String(r.numeroContrato || "");
  dup.set(nc, (dup.get(nc) || 0) + 1);
});
const dups = [...dup.entries()].filter(([, n]) => n > 1);
console.log("Duplicate protocolos:", dups.length);
