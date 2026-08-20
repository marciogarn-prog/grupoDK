/**
 * Conferência: Relação_Clientes (linha 4) vs portal.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const tmp = path.join(__dirname, "../data/miel/planilha/_tmp-admin");
const PORTAL = [
  "Cód. do Cliente",
  "Status",
  "Cliente",
  "CNPJ/CPF",
  "Nº do Celular",
  "Nº para Recados",
  "Cep",
  "Endereço",
  "Primeiro Contrato",
  "Valor do Caução",
  "Valor Pago",
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
function resolve(v, attrs) {
  if (!v) return "";
  if (attrs.t === "s") return strings[+v] ?? v;
  if (!attrs.t && /^\d+$/.test(String(v)) && strings[+v] && /[A-Za-zÀ-ú]/.test(strings[+v])) return strings[+v];
  return v;
}
const sheet = fs.readFileSync(path.join(tmp, "xl/worksheets/sheet15.xml"), "utf8");
const row4 = sheet.match(/<row r="4"[^>]*>[\s\S]*?<\/row>/)?.[0] || "";
const excel = [];
for (const cTag of row4.match(/<c [^>]*(?:\/>|[\s\S]*?<\/c>)/g) || []) {
  const open = cTag.match(/^<c ([^>]*)/)?.[1] || "";
  const attrs = parseAttrs(open);
  const inner = cTag.replace(/^<c [^>]*>/, "").replace(/<\/c>$/, "");
  const v = inner.match(/<v>([^<]*)<\/v>/)?.[1] ?? "";
  const text = resolve(v, attrs);
  if (text) excel.push(text);
}

let fails = 0;
function ok(name, cond, detail = "") {
  if (cond) console.log(`OK   | ${name}${detail ? ` | ${detail}` : ""}`);
  else {
    console.log(`FAIL | ${name}${detail ? ` | ${detail}` : ""}`);
    fails++;
  }
}

console.log("=== CONFERÊNCIA VISUAL — Relação_Clientes ===\n");
ok("Título A1", strings.includes("# Relação de Clientes Cadastrados no Sistema"));
ok("Qtd colunas", excel.length === PORTAL.length, `${excel.length} vs ${PORTAL.length}`);
for (let i = 0; i < PORTAL.length; i++) ok(`Col ${i + 1}`, excel[i] === PORTAL[i], `${excel[i]}`);
const js = fs.readFileSync(path.join(__dirname, "../portal-miel-relacao-clientes.js"), "utf8");
ok("Portal usa título da planilha", js.includes("# Relação de Clientes Cadastrados no Sistema"));
ok("Portal é tabela", js.includes("miel-cc__table") && !js.includes("Guardar"));

console.log(`\n--- ${fails === 0 ? "CONFERÊNCIA OK" : `FALHOU (${fails})`} ---`);
process.exit(fails === 0 ? 0 : 1);
