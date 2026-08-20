/**
 * Conferência visual: aba Cad_Veículos vs portal (tabela + painel, não formulário).
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const tmp = path.join(__dirname, "../data/miel/planilha/_tmp-admin");
const dataJs = path.join(__dirname, "../data/miel/miel-cadastros.js");

const PORTAL_TITLE = "# Cadastro de Veículos";
const PORTAL_HEADERS = [
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
  if (!raw && raw !== 0) return "";
  if (attrs.t === "s") return strings[+raw] ?? raw;
  if (!attrs.t && /^\d+$/.test(String(raw)) && strings[+raw] && /[A-Za-zÀ-ú]/.test(strings[+raw])) return strings[+raw];
  return raw;
}

const sheet = fs.readFileSync(path.join(tmp, "xl/worksheets/sheet13.xml"), "utf8");
const row17 = sheet.match(/<row r="17"[^>]*>[\s\S]*?<\/row>/)?.[0] || "";
const excelHeaders = [];
for (const cTag of row17.match(/<c [^>]*(?:\/>|[\s\S]*?<\/c>)/g) || []) {
  const open = cTag.match(/^<c ([^>]*)/)?.[1] || "";
  const attrs = parseAttrs(open);
  const inner = cTag.replace(/^<c [^>]*>/, "").replace(/<\/c>$/, "");
  const v = inner.match(/<v>([^<]*)<\/v>/)?.[1] ?? "";
  const text = resolveText(v, attrs);
  if (text) excelHeaders.push(text);
}

const cadJs = fs.readFileSync(path.join(__dirname, "../portal-miel-cad-veiculos.js"), "utf8");
const dataSrc = fs.readFileSync(dataJs, "utf8");
const veiculosCount = (dataSrc.match(/"codigo":/g) || []).length;
const clientesCount = (dataSrc.match(/"cliente":/g) || []).length;
const locacoesCount = (dataSrc.match(/"protocolo":/g) || []).length;

let fails = 0;
function ok(name, cond, detail = "") {
  if (cond) console.log(`OK   | ${name}${detail ? ` | ${detail}` : ""}`);
  else {
    console.log(`FAIL | ${name}${detail ? ` | ${detail}` : ""}`);
    fails++;
  }
}

console.log("=== CONFERÊNCIA VISUAL — Cad_Veículos (planilha vs portal) ===\n");
ok("Título A1", strings.includes(PORTAL_TITLE));
ok("Portal usa título planilha", cadJs.includes(PORTAL_TITLE));
ok("Portal é tabela (não formulário Guardar)", cadJs.includes("mielCadVeiculosBody") && !cadJs.includes("Guardar Veículo"));
ok("Quantidade colunas linha 17", excelHeaders.length === PORTAL_HEADERS.length, `${excelHeaders.length}`);
for (let i = 0; i < PORTAL_HEADERS.length; i++) {
  ok(`Coluna ${i + 1}`, excelHeaders[i] === PORTAL_HEADERS[i], `${excelHeaders[i]}`);
}
ok("Painel Total Investido na planilha", strings.some((s) => s.includes("Total Investido")));
ok(
  "Painel Quantitativo / Veículos Cadastrados",
  strings.some((s) => /Quantitativo/i.test(s)) && strings.some((s) => s.includes("Veículos Cadastrados"))
);
ok("Dados veículos importados", veiculosCount >= 180, `n=${veiculosCount}`);
ok("Dados clientes importados", clientesCount >= 350, `n=${clientesCount}`);
ok("Locações importadas", (dataSrc.match(/"protocolo":"20/g) || []).length >= 400, `n=${(dataSrc.match(/"protocolo":"20/g) || []).length}`);
ok("Botão Consulta de Veículos", strings.includes("# Consulta de Veículos"));
ok("Botão Cadastro de Clientes", strings.includes("# Cadastro de Clientes"));

console.log(`\n--- ${fails === 0 ? "CONFERÊNCIA OK — layout e dados da planilha" : `FALHOU (${fails})`} ---`);
process.exit(fails === 0 ? 0 : 1);
