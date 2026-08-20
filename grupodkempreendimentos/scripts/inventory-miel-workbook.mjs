/**
 * Inventário completo: 84 abas, hiperligações, imagens e destinos.
 * node scripts/inventory-miel-workbook.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const tmp = path.join(__dirname, "../data/miel/planilha/_tmp-admin");
const outDir = path.join(__dirname, "../data/miel");

function parseAttrs(tag) {
  const attrs = {};
  for (const m of String(tag).matchAll(/([\w:]+)="([^"]*)"/g)) attrs[m[1]] = m[2];
  return attrs;
}

function slug(name) {
  return String(name || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['’]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

const wb = fs.readFileSync(path.join(tmp, "xl/workbook.xml"), "utf8");
const wbRels = fs.readFileSync(path.join(tmp, "xl/_rels/workbook.xml.rels"), "utf8");
const ridToTarget = {};
for (const m of wbRels.matchAll(/<Relationship ([^>]*)\/>/g)) {
  const a = parseAttrs(m[1]);
  ridToTarget[a.Id] = a.Target;
}

const sheets = [...wb.matchAll(/<sheet ([^>]*)\/>/g)].map((m, i) => {
  const a = parseAttrs(m[1]);
  const target = ridToTarget[a["r:id"]] || "";
  const xml = path.basename(target);
  return {
    index: i + 1,
    name: a.name,
    sheetId: a.sheetId,
    rId: a["r:id"],
    xml,
    id: slug(a.name),
    state: a.state || "visible",
  };
});

function loadRels(xmlName) {
  const p = path.join(tmp, "xl/worksheets/_rels", `${xmlName}.rels`);
  if (!fs.existsSync(p)) return {};
  const xml = fs.readFileSync(p, "utf8");
  const map = {};
  for (const m of xml.matchAll(/<Relationship ([^>]*)\/>/g)) {
    const a = parseAttrs(m[1]);
    map[a.Id] = { type: a.Type || "", target: a.Target || "" };
  }
  return map;
}

function drawingLinks(drawingRelTarget, worksheetDir) {
  if (!drawingRelTarget) return [];
  const drawingPath = path.normalize(path.join(tmp, "xl/worksheets", drawingRelTarget));
  if (!fs.existsSync(drawingPath)) return [];
  const drawingXml = fs.readFileSync(drawingPath, "utf8");
  const relsPath = path.join(path.dirname(drawingPath), "_rels", path.basename(drawingPath) + ".rels");
  const relMap = {};
  if (fs.existsSync(relsPath)) {
    const rxml = fs.readFileSync(relsPath, "utf8");
    for (const m of rxml.matchAll(/<Relationship ([^>]*)\/>/g)) {
      const a = parseAttrs(m[1]);
      relMap[a.Id] = { type: a.Type || "", target: a.Target || "" };
    }
  }
  const out = [];
  const anchors = [...drawingXml.matchAll(/<xdr:twoCellAnchor[\s\S]*?<\/xdr:twoCellAnchor>/g)];
  for (const m of anchors) {
    const block = m[0];
    const name = block.match(/name="([^"]+)"/)?.[1] || "";
    const texts = [...block.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map((x) => x[1]).join(" ").trim();
    const hIds = [...block.matchAll(/r:id="(rId\d+)"/g)].map((x) => x[1]);
    const hRel = hIds.map((id) => relMap[id]).find((r) => r && /hyperlink/i.test(r.type));
    const blipId = block.match(/r:embed="(rId\d+)"/)?.[1];
    const img = blipId ? relMap[blipId]?.target : "";
    out.push({
      name,
      text: texts,
      href: (hRel?.target || "").replace(/^#/, ""),
      image: img ? path.basename(img) : "",
    });
  }
  return out;
}

const definedNames = [...wb.matchAll(/<definedName[^>]*name="([^"]+)"[^>]*>([^<]*)<\/definedName>/g)].map((m) => ({
  name: m[1],
  ref: m[2],
}));

const inventory = [];
const linkGraph = [];

for (const s of sheets) {
  const sheetPath = path.join(tmp, "xl/worksheets", s.xml);
  const exists = fs.existsSync(sheetPath);
  let hyperlinks = [];
  let drawings = [];
  let dimension = "";
  let zoom = 100;
  let hiddenCols = 0;
  if (exists) {
    const xml = fs.readFileSync(sheetPath, "utf8");
    dimension = xml.match(/<dimension ref="([^"]+)"/)?.[1] || "";
    zoom = +(xml.match(/zoomScale="(\d+)"/)?.[1] || 100);
    hiddenCols = (xml.match(/<col [^>]*hidden="1"/g) || []).length;
    const hBlock = xml.match(/<hyperlinks>([\s\S]*?)<\/hyperlinks>/)?.[1] || "";
    for (const m of hBlock.matchAll(/<hyperlink ([^>]*)\/?>/g)) {
      const a = parseAttrs(m[1]);
      hyperlinks.push({ ref: a.ref || "", location: a.location || "", display: a.display || "" });
    }
    const rels = loadRels(s.xml);
    const drawingRel = Object.values(rels).find((r) => /drawing/i.test(r.type));
    drawings = drawingRel ? drawingLinks(drawingRel.target, path.dirname(sheetPath)) : [];
  }

  const dests = new Set();
  for (const h of hyperlinks) {
    const loc = (h.location || "").replace(/^#/, "");
    const sheet = loc.replace(/^'/, "").replace(/'!.*$/, "").replace(/!.*$/, "");
    if (sheet) dests.add(sheet);
    if (sheet) linkGraph.push({ from: s.name, kind: "cell", ref: h.ref, to: sheet, display: h.display, location: h.location });
  }
  for (const d of drawings) {
    const loc = (d.href || "").replace(/^#/, "");
    const sheet = loc.replace(/^'/, "").replace(/'!.*$/, "").replace(/!.*$/, "");
    if (sheet) dests.add(sheet);
    if (sheet) linkGraph.push({ from: s.name, kind: "shape", name: d.name, to: sheet, location: d.href });
  }

  inventory.push({
    ...s,
    exists,
    dimension,
    zoom,
    hiddenCols,
    hyperlinkCount: hyperlinks.length,
    drawingCount: drawings.length,
    drawingLinks: drawings.filter((d) => d.href).length,
    hyperlinks,
    drawings,
    destinations: [...dests],
  });
}

const nameSet = new Set(sheets.map((s) => s.name));
const unknownTargets = [...new Set(linkGraph.map((l) => l.to).filter((t) => t && !nameSet.has(t)))];

const payload = {
  exportedAt: new Date().toISOString(),
  sheetCount: sheets.length,
  visible: sheets.filter((s) => s.state !== "hidden" && s.state !== "veryHidden").length,
  inventory,
  linkGraph,
  unknownTargets,
  definedNames: definedNames.slice(0, 200),
  slugMap: Object.fromEntries(sheets.map((s) => [s.name, s.id])),
};

fs.writeFileSync(path.join(outDir, "miel-workbook-map.json"), JSON.stringify(payload, null, 2));
fs.writeFileSync(
  path.join(outDir, "miel-workbook-map.js"),
  `window.__DK_MIEL_WORKBOOK_MAP = ${JSON.stringify({ slugMap: payload.slugMap, sheets: sheets.map((s) => ({ name: s.name, id: s.id, index: s.index })) })};\n`
);

console.log("sheets", sheets.length);
console.log("links", linkGraph.length);
console.log("unknown targets", unknownTargets);
console.log(
  "top linked",
  Object.entries(
    linkGraph.reduce((acc, l) => {
      acc[l.from] = (acc[l.from] || 0) + 1;
      return acc;
    }, {})
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
);
console.log("OK", path.join(outDir, "miel-workbook-map.json"));
