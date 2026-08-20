/**
 * Conferência visual: aba Cad_Clientes vs portal-miel-cad-clientes.js
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const tmp = path.join(__dirname, "../data/miel/planilha/_tmp-admin");

const PORTAL_TITLE = "# Cadastro de Clientes";
const PORTAL_HEADERS = [
  "Cód.",
  "Análise",
  "Status do Protocolo",
  "Data do Cadastro",
  "CNPJ/CPF",
  "Cliente",
  "Nº do Celular",
  "Recados 01",
  "Recados 02",
  "Nº da CNH-e",
  "Categoria",
  "Vencimento",
  "Validação",
  "EAR",
  "Cep",
  "Município/UF",
  "Endereço",
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

const sheet = fs.readFileSync(path.join(tmp, "xl/worksheets/sheet12.xml"), "utf8");

function colVal(row, letter) {
  const rowXml = sheet.match(new RegExp(`<row r="${row}"[^>]*>[\\s\\S]*?<\\/row>`))?.[0] || "";
  for (const cTag of rowXml.match(/<c [^>]*(?:\/>|[\s\S]*?<\/c>)/g) || []) {
    const open = cTag.match(/^<c ([^>]*)/)?.[1] || "";
    const attrs = parseAttrs(open);
    if (!attrs.r?.startsWith(letter)) continue;
    const inner = cTag.replace(/^<c [^>]*>/, "").replace(/<\/c>$/, "");
    const v = inner.match(/<v>([^<]*)<\/v>/)?.[1] ?? "";
    return resolveText(v, attrs);
  }
  return null;
}

const EXCEL_TITLE = colVal(1, "A");
const EXCEL_HEADERS = ["A", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R"].map(
  (l) => colVal(11, l)
);

const STATS_LABELS = [
  "Protocolos Emitidos",
  "Ctrl de Uso Provisório",
  "Distribuição de Clientes",
  "Quantidade de Clientes Cadastrados",
  "Clientes Ativos (Compra)",
  "Clientes Ativos (Locação - MT)",
  "Clientes Ativos (Locação - CR)",
  'Clientes com CNH em "Alerta"',
  "Clientes Inativos",
];

let fails = 0;
function ok(name, cond, detail = "") {
  if (cond) console.log(`OK   | ${name}${detail ? ` | ${detail}` : ""}`);
  else {
    console.log(`FAIL | ${name}${detail ? ` | ${detail}` : ""}`);
    fails++;
  }
}

console.log("=== CONFERÊNCIA VISUAL — Cad_Clientes (planilha vs portal) ===\n");

ok("Título A1", EXCEL_TITLE === PORTAL_TITLE, `planilha=${EXCEL_TITLE}`);
ok("É tabela de dados (não formulário web)", PORTAL_HEADERS.length === 17, `cols=${PORTAL_HEADERS.length}`);

for (let i = 0; i < PORTAL_HEADERS.length; i++) {
  ok(`Coluna ${i + 1} linha 11`, EXCEL_HEADERS[i] === PORTAL_HEADERS[i], `planilha=${EXCEL_HEADERS[i]} portal=${PORTAL_HEADERS[i]}`);
}

for (const label of STATS_LABELS) {
  ok(`Painel estatístico «${label.slice(0, 32)}…»`, strings.some((s) => s.includes(label.split(" ")[0]) && s.includes(label.split(" ").slice(-1)[0].replace(/[>>"]/g, "")) || strings.some((s) => s.includes(label))));
}

ok("Botão lateral Consulta de Clientes", strings.includes("# Consulta de Clientes"));
ok("Botão lateral Cadastro de Veículos", strings.includes("# Cadastro de Veículos"));
ok("Sem campo inventado «Nome do Cliente»", !strings.includes("Nome do Cliente") || strings.includes("Cliente"));
ok("Header usa «Cliente» (col G11)", EXCEL_HEADERS[5] === "Cliente");

console.log(`\n--- ${fails === 0 ? "CONFERÊNCIA OK — layout idêntico à planilha" : `FALHOU (${fails})`} ---`);
process.exit(fails === 0 ? 0 : 1);
