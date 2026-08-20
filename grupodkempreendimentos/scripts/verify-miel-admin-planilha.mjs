/**
 * Conferência automática: aba Administrativo (planilha) vs portal-miel-admin.js
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
    const col = ref.replace(/\d+$/, "");
    const inner = cTag.replace(/^<c [^>]*>/, "").replace(/<\/c>$/, "");
    const v = inner.match(/<v>([^<]*)<\/v>/)?.[1] ?? "";
    const style = cellStyle(attrs.s ? +attrs.s : 0);
    cells[ref] = { row: rn, col, text: resolveText(v, attrs), ht, ...style };
  }
}

function colVal(row, letter) {
  const c = cells[`${letter}${row}`];
  return c?.text || null;
}

// Planilha: linhas ímpares 11-35, colunas A D T
const EXCEL_ROWS = [];
for (let r = 11; r <= 35; r += 2) {
  EXCEL_ROWS.push({ row: r, a: colVal(r, "A"), d: colVal(r, "D"), t: colVal(r, "T") });
}
// espaçadores Excel (linhas pares vazias entre blocos)
const EXCEL_SPACERS = [10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 34];

const EXCEL_HEADERS = {
  a: colVal(9, "A"),
  d: colVal(9, "D"),
  t: colVal(9, "T"),
};
const EXCEL_BANNER = colVal(7, "A");

// Portal (extraído de portal-miel-admin.js — manter sincronizado)
const PORTAL_HEADERS = ["Página Inicial", "Formulários", "Relatórios"];
const PORTAL_BANNER = "Administrativo"; // A7 na planilha; portal exibe ADMINISTRATIVO no banner
const PORTAL_ROWS = [
  { a: "DASHBOARD", d: "Cadastro de Clientes", t: "Relação de Clientes" },
  { a: "Cadastro de Veículos", d: null, t: "Relação de Veículos" },
  { a: "Módulos", d: "Consulta Integrada (Veículos/Clientes)", t: "Acomp. de Transf. de Propriedade" },
  { a: "Administrativo", d: "Ctrl Integrado de Multas", t: "Status de Veículos" },
  { a: "Financeiro", d: "Formulário de Lista de Espera", t: "Relação de Motos Vendidas" },
  { a: "Depto Pessoal", d: "Etiquetas dos Chaveiros (Motos)", t: null },
  { a: "Ctrl de Locação de Veículos", d: "Etiquetas dos Chaveiros (Carros)", t: null },
  { a: "Ctrl de Manutenção", d: "Relatório de Status da CNH / EAR", t: null },
  { a: "Gráficos", d: "Pendências Administrativas", t: null },
  { a: "Planejamento", d: "Acomp. de CRLVs Anuais dos Veículos", t: null },
  { a: null, d: null, t: null },
  { a: "Documentos Gerais", d: null, t: null },
  { a: "Procedimentos", d: null, t: null },
];

const STYLE_EXPECT = {
  headerD: { color: "#FFFF00", bold: true, size: "15" },
  headerT: { fill: "#D9D9D9", color: "#C00000", bold: true, size: "15" },
  colT: { fill: "#D9D9D9", color: "#C00000", bold: true, size: "15" },
  colA: { bold: true, size: "11" },
  colD: { size: "11" },
};

let fails = 0;
function ok(name, cond, detail = "") {
  if (cond) console.log(`OK   | ${name}${detail ? ` | ${detail}` : ""}`);
  else {
    console.log(`FAIL | ${name}${detail ? ` | ${detail}` : ""}`);
    fails++;
  }
}

console.log("=== CONFERÊNCIA PLANILHA vs PORTAL — Administrativo ===\n");

ok("Banner A7 existe na planilha", EXCEL_BANNER === "Administrativo", EXCEL_BANNER);
ok("Cabeçalho A9", EXCEL_HEADERS.a === PORTAL_HEADERS[0], `${EXCEL_HEADERS.a}`);
ok("Cabeçalho D9", EXCEL_HEADERS.d === PORTAL_HEADERS[1], `${EXCEL_HEADERS.d}`);
ok("Cabeçalho T9", EXCEL_HEADERS.t === PORTAL_HEADERS[2], `${EXCEL_HEADERS.t}`);

ok("Estilo D9 (amarelo 15pt)", cells.D9?.color === STYLE_EXPECT.headerD.color && cells.D9?.size === STYLE_EXPECT.headerD.size);
ok("Estilo T9 (cinza/vermelho)", cells.T9?.fill === STYLE_EXPECT.headerT.fill && cells.T9?.color === STYLE_EXPECT.headerT.color);

for (let i = 0; i < EXCEL_ROWS.length; i++) {
  const ex = EXCEL_ROWS[i];
  const po = PORTAL_ROWS[i];
  if (!po) {
    ok(`Linha Excel R${ex.row} existe no portal`, false, JSON.stringify(ex));
    continue;
  }
  ok(`R${ex.row} col A`, ex.a === po.a, `planilha=${ex.a} portal=${po.a}`);
  ok(`R${ex.row} col D`, ex.d === po.d, `planilha=${ex.d} portal=${po.d}`);
  ok(`R${ex.row} col T`, ex.t === po.t, `planilha=${ex.t} portal=${po.t}`);
}

if (PORTAL_ROWS.length > EXCEL_ROWS.length) {
  ok("Portal não tem linhas a mais", false, `portal=${PORTAL_ROWS.length} excel=${EXCEL_ROWS.length}`);
}

// Estilos coluna T (amostra)
for (const r of [11, 13, 15]) {
  const c = cells[`T${r}`];
  if (c?.text) ok(`Estilo T${r}`, c.fill === STYLE_EXPECT.colT.fill && c.color === STYLE_EXPECT.colT.color && c.bold);
}

// Alturas de linha (Excel: 15pt botões, 5.15pt espaçadores)
ok("Altura R11 (botão)", cells.A11?.ht === "15" || cells.D11?.ht === "15", cells.A11?.ht);
ok("Altura R10 (espaço)", cells.A10?.ht === "5.15" || !cells.A10, cells.A10?.ht || "vazio");

console.log(`\n--- ${fails === 0 ? "CONFERÊNCIA OK" : `CONFERÊNCIA FALHOU (${fails} divergências)`} ---`);
process.exit(fails === 0 ? 0 : 1);
