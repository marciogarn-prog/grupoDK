/**
 * Compara placas da frota (veiculos-dk-financeiro-2026.js) com patrimônio na nuvem.
 * Uso: node grupodkempreendimentos/scripts/audit-patrimonio-placas.mjs [arquivo-placas.txt]
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, "..", "..");
const SNAPSHOT_URL = "https://grupodkempreendimentos.com.br/api/dk-cloud-snapshot";

function normPlaca(s) {
  return String(s || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function placasFromVeiculosJs() {
  const p = path.join(REPO, "grupodkempreendimentos", "veiculos-dk-financeiro-2026.js");
  const t = fs.readFileSync(p, "utf8");
  const set = new Set();
  for (const m of t.matchAll(/"placa"\s*:\s*"([^"]+)"/gi)) {
    const pl = normPlaca(m[1]);
    if (pl.length >= 7) set.add(pl);
  }
  return [...set].sort();
}

function placasFromTextFile(filePath) {
  const t = fs.readFileSync(filePath, "utf8");
  const set = new Set();
  for (const m of t.matchAll(/[A-Z]{3}[0-9][A-Z0-9]{3}|[A-Z]{3}[0-9]{4}/gi)) {
    const pl = normPlaca(m[0]);
    if (pl.length >= 7) set.add(pl);
  }
  return [...set].sort();
}

async function placasPatrimonioNuvem() {
  const res = await fetch(SNAPSHOT_URL);
  const data = await res.json();
  const docs = data?.payload?.dk_patrimonio_crlv_v1?.documentos || [];
  const set = new Set();
  for (const d of docs) {
    const pl = normPlaca(d.placaNorm || d.placa);
    if (pl) set.add(pl);
  }
  return { placas: [...set].sort(), total: docs.length };
}

const argFile = process.argv[2];
const frota = argFile ? placasFromTextFile(argFile) : placasFromVeiculosJs();
const { placas: cadastradas, total: docsNuvem } = await placasPatrimonioNuvem();

const frotaSet = new Set(frota);
const cadSet = new Set(cadastradas);
const faltam = frota.filter((p) => !cadSet.has(p));
const extras = cadastradas.filter((p) => !frotaSet.has(p));

console.log("=== Auditoria patrimônio × frota ===");
console.log(`Frota (referência): ${frota.length} placas`);
console.log(`Patrimônio nuvem: ${cadastradas.length} placas (${docsNuvem} documentos)`);
console.log(`Faltam no patrimônio: ${faltam.length}`);
if (faltam.length) {
  console.log("\n--- PLACAS SEM CRLV NO PATRIMÔNIO ---");
  faltam.forEach((p) => console.log(p));
}
if (extras.length) {
  console.log(`\nNo patrimônio mas fora da lista frota: ${extras.length}`);
  extras.forEach((p) => console.log(p));
}

const fin = placasFromVeiculosJs();
const finSet = new Set(fin);
const emComumFin = frota.filter((p) => finSet.has(p));
if (argFile && fin.length) {
  console.log(`\n--- Cruzamento com veiculos-dk-financeiro (${fin.length}) ---`);
  console.log(`Em comum com financeiro: ${emComumFin.length}`);
  console.log(`Só na lista de ${frota.length}: ${frota.filter((p) => !finSet.has(p)).length}`);
  console.log(`Só no financeiro: ${fin.filter((p) => !frotaSet.has(p)).length}`);
}
