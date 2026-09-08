/**
 * Lê grupodkempreendimentos/data/estoque/*.xlsx e gera data/estoque/dk-estoque-planilha.js
 */
import fs from "fs";
import path from "path";
import { createRequire } from "module";
import { fileURLToPath } from "url";

const require = createRequire(import.meta.url);
const XLSX = require("xlsx");

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dir = path.join(root, "data", "estoque");
const outJs = path.join(dir, "dk-estoque-planilha.js");

function findXlsx() {
  const files = fs.readdirSync(dir).filter((f) => /\.xlsx$/i.test(f) && !f.startsWith("~$"));
  files.sort((a, b) => fs.statSync(path.join(dir, b)).mtimeMs - fs.statSync(path.join(dir, a)).mtimeMs);
  return files[0] ? path.join(dir, files[0]) : "";
}

function cellStr(v) {
  if (v == null) return "";
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    const dd = String(v.getDate()).padStart(2, "0");
    const mm = String(v.getMonth() + 1).padStart(2, "0");
    return `${dd}/${mm}/${v.getFullYear()}`;
  }
  return String(v).trim();
}

function cellNum(v) {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const s = String(v ?? "")
    .replace(/R\$/gi, "")
    .replace(/\s/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  const n = Number(s.replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function formatBarcode(v) {
  const raw = cellStr(v);
  if (/^\d-\d{6}-\d{6}$/.test(raw)) return raw;
  const d = raw.replace(/\D/g, "");
  if (d.length === 13) return `${d.slice(0, 1)}-${d.slice(1, 7)}-${d.slice(7)}`;
  return raw;
}

function rowsOf(wb, name) {
  const ws = wb.Sheets[name];
  if (!ws) return [];
  return XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", raw: true, cellDates: true });
}

function nonempty(r) {
  return (r || []).some((c) => cellStr(c) !== "");
}

const xlsxPath = findXlsx();
if (!xlsxPath) {
  console.error("Nenhuma planilha .xlsx em data/estoque/");
  process.exit(1);
}

const wb = XLSX.readFile(xlsxPath, { cellDates: true, raw: true });
const cadRows = rowsOf(wb, "CADASTRO");
const estRows = rowsOf(wb, "ESTOQUE");
const entRows = rowsOf(wb, "ENTRADAS");
const saiRows = rowsOf(wb, "SAIDAS");

const cadastro = cadRows.slice(1).filter((r) => nonempty(r) && (cellStr(r[0]) || cellStr(r[1]))).map((r) => ({
  codigo: formatBarcode(r[0]),
  descricao: cellStr(r[1]),
  referencia: cellStr(r[2]),
  fabricante: cellStr(r[3]),
  preco: cellStr(r[4]) === "" ? "" : cellNum(r[4]),
  setor: cellStr(r[5]),
}));

const estStart = estRows[0] && String(estRows[0][0] || "").toUpperCase().includes("CÓDIGO") ? 1 : 2;
const estoque = estRows.slice(estStart).filter((r) => nonempty(r) && (cellStr(r[0]) || cellStr(r[1]))).map((r) => ({
  codigo: formatBarcode(r[0]),
  descricao: cellStr(r[1]),
  referencia: cellStr(r[2]),
  fabricante: cellStr(r[3]),
  qt: cellNum(r[4]),
  preco: cellStr(r[5]) === "" ? "" : cellNum(r[5]),
  total: cellNum(r[6]),
  setor: cellStr(r[7]),
  entradas: cellNum(r[8]),
  saidas: cellNum(r[9]),
  saldo: cellNum(r[10]),
}));

const entradas = entRows.slice(1).filter((r) => nonempty(r) && (cellStr(r[0]) || cellStr(r[1]))).map((r) => ({
  codigo: formatBarcode(r[0]),
  descricao: cellStr(r[1]),
  referencia: cellStr(r[2]),
  quantidade: cellNum(r[3]),
  fornecedor: cellStr(r[4]),
  data: cellStr(r[5]),
  notaFiscal: cellStr(r[6]),
  valorNota: cellStr(r[7]) === "" ? "" : cellNum(r[7]),
  formaPagamento: cellStr(r[8]),
}));

const saidas = saiRows.slice(1).filter((r) => nonempty(r) && (cellStr(r[0]) || cellStr(r[1]))).map((r) => ({
  codigo: formatBarcode(r[0]),
  descricao: cellStr(r[1]),
  referencia: cellStr(r[2]),
  quantidade: cellNum(r[3]),
  placa: cellStr(r[4]),
  veiculo: cellStr(r[5]),
  km: cellStr(r[6]),
  data: cellStr(r[7]),
  repeticao: cellStr(r[8]),
}));

const payload = {
  fonte: path.basename(xlsxPath),
  geradoEm: new Date().toISOString(),
  cadastro,
  estoque,
  entradas,
  saidas,
};

const js = `window.__DK_ESTOQUE_PLANILHA = ${JSON.stringify(payload)};\n`;
fs.writeFileSync(outJs, js, "utf8");
console.log(
  `OK ${path.basename(xlsxPath)} → cadastro=${cadastro.length} estoque=${estoque.length} entradas=${entradas.length} saidas=${saidas.length} bytes=${js.length}`
);
