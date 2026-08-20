/**
 * Exporta layout Excel (células, estilos, merges, larguras) para JSON + JS embarcado.
 * Uso: node scripts/export-miel-sheet-layout.mjs Cad_Clientes sheet12.xml cad-clientes-layout 1 11 19
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const tmp = path.join(__dirname, "../data/miel/planilha/_tmp-admin");
const outSub = process.argv[10] || "";
const outDir = path.join(__dirname, "../data/miel", outSub);

const sheetName = process.argv[2] || "Cad_Clientes";
const sheetFile = process.argv[3] || "sheet12.xml";
const outBase = process.argv[4] || "cad-clientes-layout";
const rowStart = +(process.argv[5] || 1);
const rowEnd = +(process.argv[6] || 11);
const maxCol = +(process.argv[7] || 19);
const templateRow = +(process.argv[8] || 12);
const headerRow = +(process.argv[9] || templateRow - 1);

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

const stylesXml = fs.readFileSync(path.join(tmp, "xl/styles.xml"), "utf8");
const themeXml = fs.readFileSync(path.join(tmp, "xl/theme/theme1.xml"), "utf8");
const themeColors = [];
for (const m of themeXml.matchAll(/<a:srgbClr val="([^"]+)"/g)) themeColors.push("#" + m[1]);
for (const m of themeXml.matchAll(/<a:sysClr[^>]*lastClr="([^"]+)"/g)) themeColors.push("#" + m[1]);

const fills = [...stylesXml.matchAll(/<fill>([\s\S]*?)<\/fill>/g)].map((m) => m[1]);
const fonts = [...stylesXml.matchAll(/<font>([\s\S]*?)<\/font>/g)].map((m) => m[1]);
const xfs = [...stylesXml.matchAll(/<xf ([^/>]*)\/?>/g)].map((m) => {
  const attrs = {};
  for (const x of m[1].matchAll(/([\w:]+)="([^"]*)"/g)) attrs[x[1]] = x[2];
  return attrs;
});

function colToNum(col) {
  let n = 0;
  for (const c of col) n = n * 26 + (c.charCodeAt(0) - 64);
  return n;
}
function numToCol(n) {
  let s = "";
  while (n > 0) {
    n--;
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26);
  }
  return s;
}

function cellStyle(xfIdx) {
  const xf = xfs[xfIdx] || {};
  const fill = fills[+(xf.fillId || 0)] || "";
  const font = fonts[+(xf.fontId || 0)] || "";
  const fg = fill.match(/<fgColor[^>]*rgb="([^"]+)"/);
  const theme = fill.match(/<fgColor[^>]*theme="(\d+)"/);
  const fontRgb = font.match(/<color rgb="([^"]+)"/);
  const fontTheme = font.match(/<color theme="(\d+)"/);
  const sz = font.match(/<sz val="([^"]+)"/);
  return {
    fill: fg ? "#" + fg[1].slice(2) : theme ? themeColors[+theme[1]] || null : null,
    color: fontRgb ? "#" + fontRgb[1].slice(2) : fontTheme ? themeColors[+fontTheme[1]] || null : null,
    bold: /<b[\/>]/.test(font),
    sz: sz ? +sz[1] : 11,
  };
}

function parseAttrs(tag) {
  const attrs = {};
  for (const m of tag.matchAll(/([\w:]+)="([^"]*)"/g)) attrs[m[1]] = m[2];
  return attrs;
}

function resolve(v, attrs, inner) {
  if (attrs.t === "inlineStr") {
    const t = inner.match(/<t[^>]*>([\s\S]*?)<\/t>/);
    return t ? t[1] : "";
  }
  if (v === "" || v == null) return "";
  if (attrs.t === "s") return strings[+v] ?? "";
  if (attrs.t === "str") return v;
  if (attrs.t === "b") return v === "1" || v === "true" ? "TRUE" : "FALSE";
  return v;
}

const sheetXml = fs.readFileSync(path.join(tmp, "xl/worksheets", sheetFile), "utf8");
const showGridLines = !/showGridLines="0"/.test(sheetXml);
const zoom = +(sheetXml.match(/zoomScale="(\d+)"/)?.[1] || 100);
const pane = sheetXml.match(/<pane[^>]*xSplit="(\d+)"[^>]*ySplit="(\d+)"/);
const freezeCol = pane ? +pane[1] : 0;
const freezeRow = pane ? +pane[2] : 0;

const colWidths = Array(maxCol).fill(9);
const colHidden = Array(maxCol).fill(false);
for (const col of sheetXml.match(/<col [^>]*\/?>/g) || []) {
  const min = +(col.match(/min="(\d+)"/)?.[1] || 0);
  const max = +(col.match(/max="(\d+)"/)?.[1] || min);
  const width = +(col.match(/width="([^"]+)"/)?.[1] || 9);
  const hidden = /hidden="1"/.test(col);
  for (let i = min; i <= max && i <= maxCol; i++) {
    colWidths[i - 1] = width;
    colHidden[i - 1] = hidden;
  }
}

const hyperlinks = [];
const hBlock = sheetXml.match(/<hyperlinks>([\s\S]*?)<\/hyperlinks>/)?.[1] || "";
for (const m of hBlock.matchAll(/<hyperlink ([^>]*)\/?>/g)) {
  const a = parseAttrs(m[1]);
  hyperlinks.push({
    ref: a.ref || "",
    location: a.location || a.display || "",
    display: a.display || "",
  });
}

const merges = [...(sheetXml.match(/<mergeCells[^>]*>([\s\S]*?)<\/mergeCells>/)?.[1] || "").matchAll(/ref="([^"]+)"/g)].map(
  (m) => m[1]
);

function mergeOrigin(ref) {
  for (const m of merges) {
    const [a, b] = m.split(":");
    if (ref === a) {
      const c1 = colToNum(a.replace(/\d+$/, ""));
      const c2 = colToNum(b.replace(/\d+$/, ""));
      const r1 = +a.replace(/^[A-Z]+/, "");
      const r2 = +b.replace(/^[A-Z]+/, "");
      return { merge: m, colspan: c2 - c1 + 1, rowspan: r2 - r1 + 1 };
    }
    const c = colToNum(ref.replace(/\d+$/, ""));
    const r = +ref.replace(/^[A-Z]+/, "");
    const p1 = a.match(/^([A-Z]+)(\d+)$/);
    const p2 = b.match(/^([A-Z]+)(\d+)$/);
    if (!p1 || !p2) continue;
    const c1 = colToNum(p1[1]);
    const c2 = colToNum(p2[1]);
    const r1 = +p1[2];
    const r2 = +p2[2];
    if (c >= c1 && c <= c2 && r >= r1 && r <= r2) return { skip: true };
  }
  return null;
}

const cells = {};
const rowHeights = {};
const parseThrough = Math.max(rowEnd, templateRow, headerRow);
for (let rn = rowStart; rn <= parseThrough; rn++) {
  const row = sheetXml.match(new RegExp(`<row r="${rn}"[^>]*>[\\s\\S]*?</row>`))?.[0];
  if (!row) continue;
  rowHeights[rn] = row.match(/ht="([^"]+)"/)?.[1] ? +row.match(/ht="([^"]+)"/)[1] : null;
  for (const cTag of row.match(/<c [^>]*(?:\/>|[\s\S]*?<\/c>)/g) || []) {
    const open = cTag.match(/^<c ([^>]*)/)?.[1] || "";
    const attrs = parseAttrs(open);
    const ref = attrs.r;
    const inner = cTag.replace(/^<c [^>]*>/, "").replace(/<\/c>$/, "");
    const v = inner.match(/<v>([^<]*)<\/v>/)?.[1] ?? "";
    cells[ref] = {
      text: resolve(v, attrs, inner),
      style: cellStyle(attrs.s ? +attrs.s : 0),
    };
  }
}

const rows = [];
for (let r = rowStart; r <= rowEnd; r++) {
  const rowCells = [];
  for (let c = 1; c <= maxCol; c++) {
    const col = numToCol(c);
    const ref = `${col}${r}`;
    const m = mergeOrigin(ref);
    if (m?.skip) continue;
    const cell = cells[ref] || { text: "", style: cellStyle(0) };
    const out = {
      ref,
      text: cell.text,
      ...cell.style,
    };
    if (m?.colspan) {
      out.colspan = m.colspan;
      out.rowspan = m.rowspan;
    }
    rowCells.push(out);
  }
  rows.push({ row: r, height: rowHeights[r], cells: rowCells });
}

// Template linha de dados (estilos)
const dataCols = [];
for (let c = 1; c <= maxCol; c++) {
  const col = numToCol(c);
  const ref = `${col}${templateRow}`;
  const cell = cells[ref];
  if (cell) dataCols.push({ col, ref, style: cell.style });
}

const headerCells = [];
for (let c = 1; c <= maxCol; c++) {
  const col = numToCol(c);
  const ref = `${col}${headerRow}`;
  const cell = cells[ref];
  if (cell?.text) headerCells.push({ col, ref, text: cell.text });
}

for (const h of hyperlinks) {
  const origin = (h.ref || "").split(":")[0];
  if (!origin) continue;
  for (const row of rows) {
    const cell = row.cells.find((c) => c.ref === origin);
    if (!cell) continue;
    cell.href = h.location;
    cell.linkDisplay = h.display || "";
    if (!String(cell.text || "").trim() && h.display) cell.text = h.display;
  }
}

function loadDrawings() {
  const relsFile = path.join(tmp, "xl/worksheets/_rels", `${sheetFile}.rels`);
  if (!fs.existsSync(relsFile)) return [];
  const sheetRels = fs.readFileSync(relsFile, "utf8");
  const drawingTarget = [...sheetRels.matchAll(/Target="([^"]+)"/g)].map((m) => m[1]).find((t) => t.includes("drawings/"));
  if (!drawingTarget) return [];
  const drawingPath = path.normalize(path.join(tmp, "xl/worksheets", drawingTarget));
  if (!fs.existsSync(drawingPath)) return [];
  const drawingXml = fs.readFileSync(drawingPath, "utf8");
  const drawingRelsPath = path.join(path.dirname(drawingPath), "_rels", path.basename(drawingPath) + ".rels");
  const relMap = {};
  if (fs.existsSync(drawingRelsPath)) {
    const rxml = fs.readFileSync(drawingRelsPath, "utf8");
    for (const m of rxml.matchAll(/<Relationship ([^>]*)\/>/g)) {
      const a = parseAttrs(m[1]);
      relMap[a.Id] = { type: a.Type || "", target: a.Target || "" };
    }
  }
  const mediaOut = path.join(outDir, "media");
  fs.mkdirSync(mediaOut, { recursive: true });
  const drawings = [];
  for (const m of drawingXml.matchAll(/<xdr:twoCellAnchor[\s\S]*?<\/xdr:twoCellAnchor>/g)) {
    const block = m[0];
    const name = block.match(/name="([^"]+)"/)?.[1] || "";
    const blipId = block.match(/r:embed="(rId\d+)"/)?.[1];
    const hIds = [...block.matchAll(/r:id="(rId\d+)"/g)].map((x) => x[1]);
    const hRel = hIds.map((id) => relMap[id]).find((r) => r && /hyperlink/i.test(r.type));
    const imgRel = blipId ? relMap[blipId] : null;
    let image = "";
    if (imgRel?.target) {
      const src = path.normalize(path.join(path.dirname(drawingPath), imgRel.target));
      if (fs.existsSync(src)) {
        image = path.basename(src);
        fs.copyFileSync(src, path.join(mediaOut, image));
      }
    }
    drawings.push({
      name,
      href: (hRel?.target || "").replace(/^#/, ""),
      image,
      fromCol: +(block.match(/<xdr:from>[\s\S]*?<xdr:col>(\d+)/)?.[1] || 0),
      fromColOff: +(block.match(/<xdr:from>[\s\S]*?<xdr:colOff>(\d+)/)?.[1] || 0),
      fromRow: +(block.match(/<xdr:from>[\s\S]*?<xdr:row>(\d+)/)?.[1] || 0),
      fromRowOff: +(block.match(/<xdr:from>[\s\S]*?<xdr:rowOff>(\d+)/)?.[1] || 0),
      toCol: +(block.match(/<xdr:to>[\s\S]*?<xdr:col>(\d+)/)?.[1] || 0),
      toColOff: +(block.match(/<xdr:to>[\s\S]*?<xdr:colOff>(\d+)/)?.[1] || 0),
      toRow: +(block.match(/<xdr:to>[\s\S]*?<xdr:row>(\d+)/)?.[1] || 0),
      toRowOff: +(block.match(/<xdr:to>[\s\S]*?<xdr:rowOff>(\d+)/)?.[1] || 0),
    });
  }
  return drawings;
}

const drawings = loadDrawings();

const payload = {
  sheetName,
  showGridLines,
  zoom,
  freezeCol,
  freezeRow,
  colWidths,
  colHidden,
  rows,
  dataCols,
  dataColLetters: dataCols.map((d) => d.col),
  headerRow,
  templateRow,
  headerCells,
  hyperlinks,
  drawings,
};

fs.mkdirSync(outDir, { recursive: true });
const jsonPath = path.join(outDir, `${outBase}.json`);
fs.writeFileSync(jsonPath, JSON.stringify(payload));
const jsPath = path.join(outDir, `${outBase}.js`);
fs.writeFileSync(jsPath, `window.__DK_MIEL_LAYOUT_${outBase.replace(/-/g, "_").toUpperCase()} = ${JSON.stringify(payload)};\n`);
console.log(`OK ${jsonPath} (${rows.length} rows, ${dataCols.length} data cols, ${drawings.length} drawings, ${hyperlinks.length} links)`);
