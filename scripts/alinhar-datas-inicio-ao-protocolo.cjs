/**
 * Ajusta DATA INÍCIO (coluna L) na aba RECEITA 2026 para coincidir com o prefixo do protocolo (coluna E).
 * Mantém o número de protocolo. Desloca DATA FIM (N) pelo mesmo intervalo, quando existir.
 */
const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");

const root = path.join(__dirname, "..");
const xlsxPath = path.join(root, "DK-FINANCEIRO 2026 - Copia.xlsx");

function parseBrDate(s) {
  const m = String(s ?? "")
    .trim()
    .match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatBrDate(d) {
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

function prefixFromProtocolo(proto) {
  const nc = String(proto ?? "")
    .replace(/\s+/g, "")
    .replace(/[^\d]/g, "");
  const m = nc.match(/^(\d{8})/);
  if (!m) return null;
  const p = m[1];
  const d = new Date(Number(p.slice(0, 4)), Number(p.slice(4, 6)) - 1, Number(p.slice(6, 8)));
  return Number.isNaN(d.getTime()) ? null : { prefix: p, date: d };
}

function excelCellToBr(v) {
  if (v instanceof Date && !Number.isNaN(v.getTime())) return formatBrDate(v);
  const parsed = parseBrDate(v);
  if (parsed) return formatBrDate(parsed);
  if (typeof v === "number" && v > 30000) {
    const epoch = new Date(Date.UTC(1899, 11, 30));
    const d = new Date(epoch.getTime() + v * 86400000);
    return formatBrDate(new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  }
  return String(v ?? "").trim();
}

function brToExcelSerial(br) {
  const d = parseBrDate(br);
  if (!d) return null;
  const epoch = Date.UTC(1899, 11, 30);
  const utc = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  return (utc - epoch) / 86400000;
}

function shiftBrDate(br, deltaMs) {
  const d = parseBrDate(br);
  if (!d) return br;
  return formatBrDate(new Date(d.getTime() + deltaMs));
}

const wb = XLSX.readFile(xlsxPath, { cellDates: true });
const ws = wb.Sheets["RECEITA 2026"];
const changes = [];

for (let r = 9; r <= 386; r++) {
  const protoCell = ws[`E${r}`];
  const inicioCell = ws[`L${r}`];
  const fimCell = ws[`N${r}`];
  const proto = protoCell?.v ?? protoCell?.w ?? "";
  const parsed = prefixFromProtocolo(proto);
  if (!parsed) continue;

  const inicioBr = excelCellToBr(inicioCell?.v ?? inicioCell?.w);
  const inicioDate = parseBrDate(inicioBr);
  if (!inicioDate) continue;

  const expectedBr = formatBrDate(parsed.date);
  if (inicioBr === expectedBr) continue;

  const deltaMs = parsed.date.getTime() - inicioDate.getTime();
  const fimBr = excelCellToBr(fimCell?.v ?? fimCell?.w);
  const newFimBr = fimBr ? shiftBrDate(fimBr, deltaMs) : "";

  ws[`L${r}`] = { t: "n", v: brToExcelSerial(expectedBr), z: "dd/mm/yyyy" };
  if (newFimBr) {
    ws[`N${r}`] = { t: "n", v: brToExcelSerial(newFimBr), z: "dd/mm/yyyy" };
  }

  changes.push({
    row: r,
    protocolo: String(proto).trim(),
    inicioAntes: inicioBr,
    inicioDepois: expectedBr,
    fimAntes: fimBr || "",
    fimDepois: newFimBr || "",
    deltaDias: Math.round(deltaMs / 86400000),
  });
}

XLSX.writeFile(wb, xlsxPath);

const reportPath = path.join(root, "grupodkempreendimentos", "scripts", "alinhar-datas-protocolo-report.json");
fs.writeFileSync(reportPath, JSON.stringify({ changedCount: changes.length, changes }, null, 2));

console.log(JSON.stringify({ changedCount: changes.length, reportPath }, null, 2));
