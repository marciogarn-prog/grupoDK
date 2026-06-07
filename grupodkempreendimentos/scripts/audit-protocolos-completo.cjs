/**
 * Auditoria completa: locacoes-receita-2026-import.js
 * Regra: protocolo = AAAAMMDD + sequência, AAAAMMDD = data de início (DD/MM/AAAA).
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

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
  return (
    d.getFullYear() +
    String(d.getMonth() + 1).padStart(2, "0") +
    String(d.getDate()).padStart(2, "0")
  );
}

function parseProtocolo(nc) {
  const clean = String(nc || "").replace(/\s+/g, "");
  const m = clean.match(/^(\d{8})(\d+)$/);
  if (!m) return null;
  return { prefix: m[1], seq: Number(m[2]), full: clean };
}

const importPath = path.join(__dirname, "..", "locacoes-receita-2026-import.js");
const rows = vm.runInNewContext(`${fs.readFileSync(importPath, "utf8")}\nLOCACOES_RECEITA_2026_IMPORT;`, {});

const misaligned = [];
const badFormat = [];
const badInicio = [];
const dupNc = new Map();
const dupNatural = new Map();

rows.forEach((row, i) => {
  const nc = String(row.numeroContrato || "").replace(/\s+/g, "");
  const cpf = String(row.cpf || "").replace(/\D/g, "");
  const placa = String(row.placa || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  const inicio = String(row.inicio || "").trim();

  if (!parseBrDate(inicio)) badInicio.push({ i, nc, inicio });
  if (!parseProtocolo(nc)) badFormat.push({ i, nc, inicio });

  const exp = prefixFromInicio(inicio);
  const parts = parseProtocolo(nc);
  if (exp && parts && parts.prefix !== exp) {
    misaligned.push({
      nc,
      inicio,
      expectedPrefix: exp,
      gotPrefix: parts.prefix,
      cpf,
      placa,
    });
  }

  if (nc) {
    if (!dupNc.has(nc)) dupNc.set(nc, []);
    dupNc.get(nc).push(i);
  }
  const nk = cpf.length === 11 && placa && inicio ? `${cpf}|${placa}|${inicio}` : "";
  if (nk) {
    if (!dupNatural.has(nk)) dupNatural.set(nk, []);
    dupNatural.get(nk).push({ i, nc });
  }
});

const dupNcList = [...dupNc.entries()].filter(([, arr]) => arr.length > 1);
const dupNatList = [...dupNatural.entries()].filter(([, arr]) => arr.length > 1);

const report = {
  total: rows.length,
  misalignedCount: misaligned.length,
  badFormatCount: badFormat.length,
  badInicioCount: badInicio.length,
  duplicateProtocolCount: dupNcList.length,
  duplicateNaturalKeyCount: dupNatList.length,
  misaligned,
  badFormat,
  badInicio,
  duplicateProtocol: dupNcList.map(([nc, idxs]) => ({ nc, count: idxs.length })),
  duplicateNatural: dupNatList.map(([k, items]) => ({ key: k, items })),
};

const outPath = path.join(__dirname, "..", "scripts", "audit-protocolos-report.json");
fs.writeFileSync(outPath, JSON.stringify(report, null, 2), "utf8");

console.log(JSON.stringify({
  total: report.total,
  misalignedCount: report.misalignedCount,
  badFormatCount: report.badFormatCount,
  badInicioCount: report.badInicioCount,
  duplicateProtocolCount: report.duplicateProtocolCount,
  duplicateNaturalKeyCount: report.duplicateNaturalKeyCount,
  reportFile: outPath,
}, null, 2));

if (misaligned.length) {
  console.log("\n--- Divergências protocolo × início (primeiras 30) ---");
  misaligned.slice(0, 30).forEach((x) => console.log(x));
}
