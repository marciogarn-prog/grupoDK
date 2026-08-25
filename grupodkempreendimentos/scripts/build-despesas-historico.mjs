/**
 * Gera data/dk-despesas-historico.js a partir de data/LANÇAMENTO DE DESPESAS.xlsx.
 *   node grupodkempreendimentos/scripts/build-despesas-historico.mjs
 */
import { createRequire } from "module";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const DATA = path.resolve(__dirname, "../data");
const require = createRequire(path.join(ROOT, "package.json"));
const XLSX = require("xlsx");

const CAT_MAP = {
  SEGURO: "SEGURO",
  ADM: "ADM",
  IMPOSTO: "IMPOSTO",
  DOCUMENTOS: "DOCUMENTOS",
  MULTAS: "MULTAS",
  SALARIOS: "SALARIOS",
  "CONT+ADV+PROP": "CONT_ADV_PROP",
  CONTADVPROP: "CONT_ADV_PROP",
  MANUTENCAO: "MANUTENCAO",
  ALUGUEL: "ALUGUEL",
  COMPRADEOLEO: "COMPRA_OLEO",
  TROCADEOLEO: "TROCA_OLEO",
};

const OLD_LETTER = "ABCDEFGHIJ";
const MERC_RE = /[A-Z]{3}[0-9][A-Z][0-9]{2}/g;
const OLD_RE = /[A-Z]{3}[0-9]{4}/g;

function nk(s) {
  return String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "");
}

function mapCat(raw) {
  const k = nk(raw);
  return CAT_MAP[k] || "ADM";
}

function convertOld(p) {
  if (!/^[A-Z]{3}[0-9]{4}$/.test(p)) return "";
  const letter = OLD_LETTER[Number(p[4])];
  if (!letter) return "";
  return p.slice(0, 4) + letter + p.slice(5);
}

function extractPlaca(desc) {
  const t = String(desc || "").toUpperCase();
  const merc = t.match(MERC_RE) || [];
  if (merc.length) return merc[merc.length - 1];
  const old = t.match(OLD_RE) || [];
  if (old.length) return convertOld(old[old.length - 1]) || old[old.length - 1];
  return "";
}

function pad(n) {
  return String(n).padStart(2, "0");
}

function fmtDate(d) {
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return "";
  let y = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  if (y < 2020) y = 2026;
  if (y > 2035) return "";
  return `${pad(day)}/${pad(m)}/${y}`;
}

function hashId(parts) {
  let h = 2166136261;
  const s = parts.join("|");
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `dsp-xlsx-${(h >>> 0).toString(16)}`;
}

const xlsxPath = path.join(DATA, "LANÇAMENTO DE DESPESAS.xlsx");
const wb = XLSX.readFile(xlsxPath, { cellDates: true, raw: true });
const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: "", raw: true });

const out = [];
const seen = new Set();
let withPlaca = 0;
for (const r of rows) {
  const valor = Number(r.VALOR);
  const desc = String(r.DESCRIÇÃO || r.DESCRICAO || "").trim();
  const cat = mapCat(r.CATEGORIA);
  const data = fmtDate(r.DATA instanceof Date ? r.DATA : null);
  if (!desc && !(valor > 0)) continue;
  const placa = extractPlaca(desc);
  if (placa) withPlaca += 1;
  let id = hashId([data, cat, String(valor), desc]);
  let n = 0;
  while (seen.has(id)) {
    n += 1;
    id = hashId([data, cat, String(valor), desc, String(n)]);
  }
  seen.add(id);
  out.push({
    id,
    valor: Number.isFinite(valor) ? valor : 0,
    descricao: desc.slice(0, 240),
    data,
    categoria: cat,
    placa,
    origem: "planilha",
    updatedAt: 1,
  });
}

const dest = path.join(DATA, "dk-despesas-historico.js");
const body = `window.__DK_DESPESAS_HISTORICO = ${JSON.stringify(out)};\n`;
fs.writeFileSync(dest, body);
console.log(`ok ${out.length} linhas, ${withPlaca} com placa, ${(body.length / 1024).toFixed(0)} KB -> ${path.relative(ROOT, dest)}`);
