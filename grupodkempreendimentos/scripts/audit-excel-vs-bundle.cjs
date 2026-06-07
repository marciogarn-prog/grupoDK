/**
 * Compara planilha RECEITA 2026 (DK-FINANCEIRO 2026) com locacoes-receita-2026-import.js
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const XLSX = require("xlsx");

const root = path.join(__dirname, "..", "..");
const xlsxPath = path.join(root, "DK-FINANCEIRO 2026 - Copia.xlsx");
const importPath = path.join(__dirname, "..", "locacoes-receita-2026-import.js");

function parseBrDate(s) {
  const t = String(s || "").trim();
  let m = t.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) {
    const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  m = t.match(/^(\d{1,2})\/(\w{3})$/i);
  if (m) {
    const months = {
      jan: 0, fev: 1, mar: 2, abr: 3, mai: 4, jun: 5,
      jul: 6, ago: 7, set: 8, out: 9, nov: 10, dez: 11,
    };
    const mm = months[m[2].toLowerCase().slice(0, 3)];
    if (mm === undefined) return null;
    const y = new Date().getFullYear();
    return new Date(y, mm, Number(m[1]));
  }
  return null;
}

function excelCellToBr(v) {
  if (v == null || v === "") return "";
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    const dd = String(v.getDate()).padStart(2, "0");
    const mm = String(v.getMonth() + 1).padStart(2, "0");
    return `${dd}/${mm}/${v.getFullYear()}`;
  }
  if (typeof v === "number" && v > 20000 && v < 60000) {
    const d = XLSX.SSF.parse_date_code(v);
    if (d) return `${String(d.d).padStart(2, "0")}/${String(d.m).padStart(2, "0")}/${d.y}`;
  }
  return String(v).trim();
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

function normProto(p) {
  return String(p ?? "")
    .trim()
    .replace(/\s+/g, "")
    .replace(/[^\d]/g, "");
}

const bundle = vm.runInNewContext(`${fs.readFileSync(importPath, "utf8")}\nLOCACOES_RECEITA_2026_IMPORT;`, {});
const byNcBundle = new Map(bundle.map((r) => [normProto(r.numeroContrato), r]));

if (!fs.existsSync(xlsxPath)) {
  console.log(JSON.stringify({ error: "xlsx not found", xlsxPath }, null, 2));
  process.exit(1);
}

const wb = XLSX.readFile(xlsxPath, { cellDates: true });
const sheetName =
  wb.SheetNames.find((n) => /receita\s*2026/i.test(n)) ||
  wb.SheetNames[13] ||
  wb.SheetNames[wb.SheetNames.length - 1];
const ws = wb.Sheets[sheetName];

const excelRows = [];
for (let r = 9; r <= 386; r++) {
  const proto = normProto(ws[`E${r}`]?.v ?? ws[`E${r}`]?.w);
  const cpf = String(ws[`F${r}`]?.v ?? "").replace(/\D/g, "");
  const placa = String(ws[`I${r}`]?.v ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  if (!proto || cpf.length !== 11 || !placa) continue;
  const inicio = excelCellToBr(ws[`L${r}`]?.v ?? ws[`L${r}`]?.w);
  excelRows.push({ row: r, proto, cpf, placa, inicio });
}

const missingInBundle = [];
const misalignedInExcel = [];
const misalignedInBundle = [];
const extraInBundle = new Set(byNcBundle.keys());

excelRows.forEach((ex) => {
  extraInBundle.delete(ex.proto);
  const exp = prefixFromInicio(ex.inicio);
  const m = ex.proto.match(/^(\d{8})(\d+)$/);
  if (exp && m && m[1] !== exp) {
    misalignedInExcel.push({ ...ex, expectedPrefix: exp, gotPrefix: m[1] });
  }
  const b = byNcBundle.get(ex.proto);
  if (!b) {
    missingInBundle.push(ex);
    return;
  }
  const bExp = prefixFromInicio(b.inicio);
  const bNc = normProto(b.numeroContrato);
  const bm = bNc.match(/^(\d{8})(\d+)$/);
  if (bExp && bm && bm[1] !== bExp) {
    misalignedInBundle.push({
      proto: bNc,
      bundleInicio: b.inicio,
      excelInicio: ex.inicio,
      expectedPrefix: bExp,
    });
  }
});

const extra = [...extraInBundle].slice(0, 20);

console.log(
  JSON.stringify(
    {
      sheet: sheetName,
      excelRows: excelRows.length,
      bundleRows: bundle.length,
      missingInBundle: missingInBundle.length,
      misalignedInExcel: misalignedInExcel.length,
      misalignedInBundle: misalignedInBundle.length,
      extraInBundleNotInExcel: extraInBundle.size,
      samples: {
        missingInBundle: missingInBundle.slice(0, 15),
        misalignedInExcel: misalignedInExcel.slice(0, 15),
        misalignedInBundle: misalignedInBundle.slice(0, 15),
        extraInBundle: extra,
      },
    },
    null,
    2
  )
);
