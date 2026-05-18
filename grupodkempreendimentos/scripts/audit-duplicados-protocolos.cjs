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

const importPath = path.join(__dirname, "..", "locacoes-receita-2026-import.js");
const rows = vm.runInNewContext(`${fs.readFileSync(importPath, "utf8")}\nLOCACOES_RECEITA_2026_IMPORT;`, {});

const byNc = new Map();
const byCpfPlacaInicio = new Map();

rows.forEach((r, i) => {
  const nc = String(r.numeroContrato || "").replace(/\s+/g, "");
  const cpf = String(r.cpf || "").replace(/\D/g, "");
  const placa = String(r.placa || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  const ini = String(r.inicio || "").trim();
  const key = `${cpf}|${placa}|${ini}`;
  if (!byNc.has(nc)) byNc.set(nc, []);
  byNc.get(nc).push(i);
  if (!byCpfPlacaInicio.has(key)) byCpfPlacaInicio.set(key, []);
  byCpfPlacaInicio.get(key).push({ i, nc, ini, fim: r.fim });
});

console.log("Duplicate numeroContrato:");
[...byNc.entries()].filter(([, arr]) => arr.length > 1).forEach(([nc, arr]) => console.log(nc, arr));

console.log("\nDuplicate cpf+placa+inicio:");
[...byCpfPlacaInicio.entries()]
  .filter(([, arr]) => arr.length > 1)
  .forEach(([k, arr]) => console.log(k, arr));

console.log("\nMisaligned prefix:");
rows.forEach((r, i) => {
  const nc = String(r.numeroContrato || "").replace(/\s+/g, "");
  const exp = prefixFromInicio(r.inicio);
  if (exp && !nc.startsWith(exp)) console.log(i, nc, r.inicio, "expected", exp);
});

const aloisio = rows.filter((r) => String(r.cpf).includes("00175015554"));
console.log("\nAloisio locacoes:", aloisio.length);
aloisio.forEach((r) =>
  console.log(r.numeroContrato, r.placa, r.inicio, r.fim)
);
