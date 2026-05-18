const fs = require("fs");
const path = require("path");

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

const importPath = path.join(__dirname, "..", "locacoes-receita-2026-import.js");
const vm = require("vm");
const code = fs.readFileSync(importPath, "utf8");
const rows = vm.runInNewContext(`${code}\nLOCACOES_RECEITA_2026_IMPORT;`, {});

const bad = [];
rows.forEach((row) => {
  const nc = String(row.numeroContrato || "").replace(/\s+/g, "");
  const exp = prefixFromInicio(row.inicio);
  const parts = parseProtocolo(nc);
  if (!exp || !parts) return;
  if (parts.prefix !== exp) {
    bad.push({
      nc,
      inicio: row.inicio,
      expectedPrefix: exp,
      gotPrefix: parts.prefix,
      seq: parts.seq,
    });
  }
});

console.log("Total rows:", rows.length);
console.log("Mismatches:", bad.length);
bad.forEach((x) => console.log(JSON.stringify(x)));
