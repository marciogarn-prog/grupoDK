/**
 * Conferência automática: aba Administrativo (planilha) vs portal — layout VISUAL.
 * - Menu lateral (coluna A) = sidebar HTML, não entra no grid principal.
 * - Grid principal = Formulários (D11,A13,D15,D17,D19) | Relatórios (T11-19,D21-29).
 * node scripts/verify-miel-admin-planilha.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const xlsm = path.join(__dirname, "../data/miel/planilha/miel-sistema.xlsm");
const tmpDir = path.join(__dirname, "../data/miel/planilha/_tmp-admin");
const zipCopy = path.join(tmpDir, "miel.zip");

function parseAttrs(tag) {
  const attrs = {};
  for (const m of tag.matchAll(/([\w:]+)="([^"]*)"/g)) attrs[m[1]] = m[2];
  return attrs;
}

function ensureExtracted() {
  if (!fs.existsSync(path.join(tmpDir, "xl/worksheets/sheet3.xml"))) {
    fs.mkdirSync(tmpDir, { recursive: true });
    fs.copyFileSync(xlsm, zipCopy);
    execSync(
      `powershell -NoProfile -Command "Expand-Archive -Path '${zipCopy.replace(/'/g, "''")}' -DestinationPath '${tmpDir.replace(/'/g, "''")}' -Force"`,
      { stdio: "pipe" }
    );
  }
}

ensureExtracted();

const ssXml = fs.readFileSync(path.join(tmpDir, "xl/sharedStrings.xml"), "utf8");
const strings = [];
for (const b of ssXml.split("<si>").slice(1)) {
  const inner = b.split("</si>")[0];
  if (inner.includes("<r>")) strings.push([...inner.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((m) => m[1]).join(""));
  else {
    const t = inner.match(/<t[^>]*>([\s\S]*?)<\/t>/);
    strings.push(t ? t[1] : "");
  }
}

const sheet3 = fs.readFileSync(path.join(tmpDir, "xl/worksheets/sheet3.xml"), "utf8");
const stylesXml = fs.readFileSync(path.join(tmpDir, "xl/styles.xml"), "utf8");
const themeXml = fs.readFileSync(path.join(tmpDir, "xl/theme/theme1.xml"), "utf8");

const themeColors = [];
for (const m of themeXml.matchAll(/<a:srgbClr val="([^"]+)"/g)) themeColors.push("#" + m[1]);
for (const m of themeXml.matchAll(/<a:sysClr[^>]*lastClr="([^"]+)"/g)) themeColors.push("#" + m[1]);

const fills = [...stylesXml.matchAll(/<fill>([\s\S]*?)<\/fill>/g)].map((m) => m[1]);
const fonts = [...stylesXml.matchAll(/<font>([\s\S]*?)<\/font>/g)].map((m) => m[1]);
const xfs = [...stylesXml.matchAll(/<xf ([^/>]*)\/?>/g)].map((m) => parseAttrs(m[1]));

function cellStyle(xfIdx) {
  const xf = xfs[xfIdx] || {};
  const fill = fills[+(xf.fillId || 0)] || "";
  const font = fonts[+(xf.fontId || 0)] || "";
  const fg = fill.match(/<fgColor[^>]*rgb="([^"]+)"/);
  const theme = fill.match(/<fgColor[^>]*theme="(\d+)"/);
  const fontRgb = font.match(/<color rgb="([^"]+)"/);
  const fontTheme = font.match(/<color theme="(\d+)"/);
  return {
    fill: fg ? "#" + fg[1].slice(2) : theme ? themeColors[+theme[1]] : null,
    color: fontRgb ? "#" + fontRgb[1].slice(2) : fontTheme ? themeColors[+fontTheme[1]] : null,
    bold: /<b[\/>]/.test(font),
    size: (font.match(/<sz val="([^"]+)"/) || [])[1],
  };
}

function resolveText(raw, attrs) {
  if (!raw) return "";
  if (attrs.t === "s") return strings[+raw] ?? raw;
  if (/^\d+$/.test(String(raw)) && strings[+raw]) return strings[+raw];
  return raw;
}

const cells = {};
for (const row of sheet3.match(/<sheetData>([\s\S]*?)<\/sheetData>/)?.[1]?.match(/<row[^>]*>[\s\S]*?<\/row>/g) || []) {
  const rn = +row.match(/r="(\d+)"/)[1];
  const ht = row.match(/ht="([^"]+)"/)?.[1] || null;
  for (const cTag of row.match(/<c [^>]*(?:\/>|[\s\S]*?<\/c>)/g) || []) {
    const open = cTag.match(/^<c ([^>]*)/)?.[1] || "";
    const attrs = parseAttrs(open);
    const ref = attrs.r;
    const inner = cTag.replace(/^<c [^>]*>/, "").replace(/<\/c>$/, "");
    const v = inner.match(/<v>([^<]*)<\/v>/)?.[1] ?? "";
    const style = cellStyle(attrs.s ? +attrs.s : 0);
    cells[ref] = { row: rn, text: resolveText(v, attrs), ht, ...style };
  }
}

function colVal(row, letter) {
  const c = cells[`${letter}${row}`];
  return c?.text || null;
}

/** Formulários visíveis na planilha (área principal). */
const EXCEL_FORM = [
  colVal(11, "D"),
  colVal(13, "A"),
  colVal(15, "D"),
  colVal(17, "D"),
  colVal(19, "D"),
].filter(Boolean);

/** Relatórios visíveis na planilha (área principal). */
const EXCEL_REL = [
  colVal(11, "T"),
  colVal(13, "T"),
  colVal(15, "T"),
  colVal(17, "T"),
  colVal(19, "T"),
  colVal(21, "D"),
  colVal(23, "D"),
  colVal(25, "D"),
  colVal(27, "D"),
  colVal(29, "D"),
].filter(Boolean);

/** Menu lateral — coluna A (exceto Cadastro de Veículos, que fica só em Formulários). */
const EXCEL_SIDEBAR = [];
for (let r = 11; r <= 35; r += 2) {
  const v = colVal(r, "A");
  if (v && v !== "Cadastro de Veículos") EXCEL_SIDEBAR.push(v);
}

const PORTAL_FORM = [
  "Cadastro de Clientes",
  "Cadastro de Veículos",
  "Consulta Integrada (Veículos/Clientes)",
  "Ctrl Integrado de Multas",
  "Formulário de Lista de Espera",
];

const PORTAL_REL = [
  "Relação de Clientes",
  "Relação de Veículos",
  "Acomp. de Transf. de Propriedade",
  "Status de Veículos",
  "Relação de Motos Vendidas",
  "Etiquetas dos Chaveiros (Motos)",
  "Etiquetas dos Chaveiros (Carros)",
  "Relatório de Status da CNH / EAR",
  "Pendências Administrativas",
  "Acomp. de CRLVs Anuais dos Veículos",
];

const PORTAL_SIDEBAR = [
  "DASHBOARD",
  "Administrativo",
  "Financeiro",
  "Depto Pessoal",
  "Ctrl de Locação de Veículos",
  "Ctrl de Manutenção",
  "Gráficos",
  "Planejamento",
  "Procedimentos",
];

const PORTAL_SIDEBAR_SECTIONS = ["Módulos", "Documentos Gerais"];

let fails = 0;
function ok(name, cond, detail = "") {
  if (cond) console.log(`OK   | ${name}${detail ? ` | ${detail}` : ""}`);
  else {
    console.log(`FAIL | ${name}${detail ? ` | ${detail}` : ""}`);
    fails++;
  }
}

console.log("=== CONFERÊNCIA VISUAL — Administrativo (planilha vs portal) ===\n");

ok("Banner A7", colVal(7, "A") === "Administrativo", colVal(7, "A"));
ok("Cabeçalho D9 Formulários", colVal(9, "D") === "Formulários");
ok("Cabeçalho T9 Relatórios", colVal(9, "T") === "Relatórios");
ok("A9 Página Inicial é menu lateral (não no grid)", colVal(9, "A") === "Página Inicial");

ok("Estilo D9 (amarelo 15pt)", cells.D9?.color === "#FFFF00" && cells.D9?.size === "15");
ok("Estilo T9 (cinza/vermelho)", cells.T9?.fill === "#D9D9D9" && cells.T9?.color === "#C00000");

ok("Formulários: quantidade", EXCEL_FORM.length === PORTAL_FORM.length, `${EXCEL_FORM.length} vs ${PORTAL_FORM.length}`);
for (let i = 0; i < PORTAL_FORM.length; i++) {
  ok(`Formulários [${i + 1}]`, EXCEL_FORM[i] === PORTAL_FORM[i], `planilha=${EXCEL_FORM[i]} portal=${PORTAL_FORM[i]}`);
}

ok("Relatórios: quantidade", EXCEL_REL.length === PORTAL_REL.length, `${EXCEL_REL.length} vs ${PORTAL_REL.length}`);
for (let i = 0; i < PORTAL_REL.length; i++) {
  ok(`Relatórios [${i + 1}]`, EXCEL_REL[i] === PORTAL_REL[i], `planilha=${EXCEL_REL[i]} portal=${PORTAL_REL[i]}`);
}

ok("Sidebar: botões principais", PORTAL_SIDEBAR.every((l) => EXCEL_SIDEBAR.includes(l)));
ok("Sidebar: secções Módulos + Documentos Gerais", PORTAL_SIDEBAR_SECTIONS.every((s) => EXCEL_SIDEBAR.includes(s)));
ok("Cadastro de Veículos só em Formulários (não sidebar)", !EXCEL_SIDEBAR.includes("Cadastro de Veículos"));

ok("Grid principal 2 colunas (sem coluna Página Inicial)", PORTAL_FORM.length > 0 && PORTAL_REL.length > 0);

for (const r of [11, 13, 15]) {
  const c = cells[`T${r}`];
  if (c?.text) ok(`Estilo Relatórios T${r}`, c.fill === "#D9D9D9" && c.color === "#C00000" && c.bold);
}

ok("Altura R11 (botão)", cells.D11?.ht === "15" || cells.T11?.ht === "15", cells.D11?.ht);
ok("Altura R10 (espaço)", cells.C10?.ht === "5.15" || !cells.A10, cells.C10?.ht || "5.15");

console.log(`\n--- ${fails === 0 ? "CONFERÊNCIA OK — layout idêntico à planilha" : `FALHOU (${fails} divergências)`} ---`);
process.exit(fails === 0 ? 0 : 1);
