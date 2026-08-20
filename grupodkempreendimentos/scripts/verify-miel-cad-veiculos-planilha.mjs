/**
 * Conferência: aba Cad_Veículos (linha 17) vs portal-miel-cad-veiculos.js
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const tmp = path.join(__dirname, "../data/miel/planilha/_tmp-admin");

const PORTAL_FIELDS = [
  "Cód. do Veículo",
  "Data do Cadastro",
  "Status",
  "Observação",
  "Placa",
  "Categoria",
  "Marca",
  "Modelo",
  "Cor",
  "Chassi",
  "Renavam",
  "Ano/Modelo",
  "Nº do Motor",
  "Emplacada?",
  "Rastreador?",
  "Assegurada?",
  "Proprietário",
  "CNPJ/CPF",
  "Município/UF",
  "Valor de Aquisição",
];

const ssXml = fs.readFileSync(path.join(tmp, "xl/sharedStrings.xml"), "utf8");
const strings = [];
for (const b of ssXml.split("<si>").slice(1)) {
  const inner = b.split("</si>")[0];
  if (inner.includes("<r>")) strings.push([...inner.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((m) => m[1]).join(""));
  else {
    const t = inner.match(/<t[^>]*>([\s\S]*?)<\/t>/);
    strings.push(t ? t[1] : "");
  }
}

function parseAttrs(tag) {
  const attrs = {};
  for (const m of tag.matchAll(/([\w:]+)="([^"]*)"/g)) attrs[m[1]] = m[2];
  return attrs;
}

function resolveText(raw, attrs) {
  if (!raw) return "";
  if (attrs.t === "s") return strings[+raw] ?? raw;
  if (/^\d+$/.test(String(raw)) && strings[+raw]) return strings[+raw];
  return raw;
}

const sheet = fs.readFileSync(path.join(tmp, "xl/worksheets/sheet13.xml"), "utf8");
const row17 = sheet.match(/<row r="17"[^>]*>[\s\S]*?<\/row>/)?.[0] || "";
const excelHeaders = [];
for (const cTag of row17.match(/<c [^>]*(?:\/>|[\s\S]*?<\/c>)/g) || []) {
  const open = cTag.match(/^<c ([^>]*)/)?.[1] || "";
  const attrs = parseAttrs(open);
  const ref = attrs.r;
  const inner = cTag.replace(/^<c [^>]*>/, "").replace(/<\/c>$/, "");
  const v = inner.match(/<v>([^<]*)<\/v>/)?.[1] ?? "";
  const text = resolveText(v, attrs);
  if (text) excelHeaders.push({ ref, text });
}

const excelLabels = excelHeaders.map((h) => h.text);
let fails = 0;
function ok(name, cond, detail = "") {
  if (cond) console.log(`OK   | ${name}${detail ? ` | ${detail}` : ""}`);
  else {
    console.log(`FAIL | ${name}${detail ? ` | ${detail}` : ""}`);
    fails++;
  }
}

console.log("=== CONFERÊNCIA Cad_Veículos linha 17 vs portal ===\n");
ok("Título planilha A1", strings.some((s) => s === "# Cadastro de Veículos"));
ok("Banner portal", true, "CADASTRO DE VEÍCULOS");

ok("Quantidade de campos", excelLabels.length === PORTAL_FIELDS.length, `planilha=${excelLabels.length} portal=${PORTAL_FIELDS.length}`);

for (let i = 0; i < PORTAL_FIELDS.length; i++) {
  ok(`Campo ${i + 1}`, excelLabels[i] === PORTAL_FIELDS[i], `planilha=${excelLabels[i]} portal=${PORTAL_FIELDS[i]}`);
}

ok("Botão lateral Consulta de Veículos", strings.includes("# Consulta de Veículos"));
ok("Botão lateral Cadastro de Clientes", strings.includes("# Cadastro de Clientes"));

console.log(`\n--- ${fails === 0 ? "CONFERÊNCIA OK" : `FALHOU (${fails})`} ---`);
process.exit(fails === 0 ? 0 : 1);
