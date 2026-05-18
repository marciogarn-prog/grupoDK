const fs = require("fs");
const path = require("path");
const vm = require("vm");
const XLSX = require("xlsx");

const root = path.join(__dirname, "..", "..");
const xlsxPath = path.join(root, "DK-FINANCEIRO 2026 - Copia.xlsx");
const importPath = path.join(__dirname, "..", "locacoes-receita-2026-import.js");

function normProto(p) {
  return String(p ?? "")
    .trim()
    .replace(/\s+/g, "")
    .replace(/[^\d]/g, "");
}

const bundle = vm.runInNewContext(`${fs.readFileSync(importPath, "utf8")}\nLOCACOES_RECEITA_2026_IMPORT;`, {});
const byNc = new Map(bundle.map((r) => [normProto(r.numeroContrato), r]));

const wb = XLSX.readFile(xlsxPath, { cellDates: true });
const ws = wb.Sheets["RECEITA 2026"];
let missing = 0;
let mismatch = 0;
const excelProtos = [];

for (let r = 9; r <= 386; r++) {
  const proto = normProto(ws[`E${r}`]?.v ?? ws[`E${r}`]?.w);
  const cpf = String(ws[`F${r}`]?.v ?? "").replace(/\D/g, "");
  const placa = String(ws[`I${r}`]?.v ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  if (!proto || cpf.length !== 11 || !placa) continue;
  excelProtos.push(proto);
  const b = byNc.get(proto);
  if (!b) {
    missing++;
    continue;
  }
  const inicioExcel = ws[`L${r}`]?.w || String(ws[`L${r}`]?.v ?? "");
  if (String(b.inicio) !== String(inicioExcel).trim() && String(b.inicio) !== excelCellToBr(ws[`L${r}`]?.v)) {
    mismatch++;
  }
}

function excelCellToBr(v) {
  if (v instanceof Date) {
    const d = v;
    return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
  }
  return String(v ?? "").trim();
}

const extra = bundle.filter((r) => !excelProtos.includes(normProto(r.numeroContrato)));

const aloisio = bundle.filter((r) => String(r.cpf).includes("00175015554"));

console.log(
  JSON.stringify(
    {
      excelRows: excelProtos.length,
      bundleRows: bundle.length,
      missingInBundle: missing,
      extraInBundle: extra.length,
      aloisio: aloisio.map((r) => ({
        proto: r.numeroContrato,
        placa: r.placa,
        inicio: r.inicio,
        fim: r.fim,
      })),
    },
    null,
    2
  )
);
