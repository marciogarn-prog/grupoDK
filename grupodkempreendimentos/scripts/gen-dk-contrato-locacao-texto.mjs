import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const pdfPath = path.join(root, "DK - Modelo de Contrato.pdf");
const outPath = path.join(root, "data", "dk-contrato-locacao-texto.js");

async function extractPages(filePath) {
  const data = new Uint8Array(fs.readFileSync(filePath));
  const doc = await getDocument({ data, useSystemFonts: true }).promise;
  const pages = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    const items = content.items.map((it) => ({
      str: it.str,
      x: it.transform[4],
      y: it.transform[5],
    }));
    items.sort((a, b) => b.y - a.y || a.x - b.x);
    const lines = [];
    let curY = null;
    let cur = [];
    for (const it of items) {
      if (curY === null || Math.abs(it.y - curY) < 4) {
        cur.push(it);
        curY = curY ?? it.y;
      } else {
        cur.sort((a, b) => a.x - b.x);
        lines.push(cur.map((i) => i.str).join(" ").replace(/\s+/g, " ").trim());
        cur = [it];
        curY = it.y;
      }
    }
    if (cur.length) {
      cur.sort((a, b) => a.x - b.x);
      lines.push(cur.map((i) => i.str).join(" ").replace(/\s+/g, " ").trim());
    }
    pages.push(
      lines
        .map((l) => l.replace(/\s*Prot\. Nº:.*$/i, "").trim())
        .filter((l) => l && !l.startsWith("Prot. N") && !l.includes("Pág.:"))
    );
  }
  return pages;
}

function esc(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function classify(line) {
  if (/^Cláusula\s+\d/.test(line)) return "t";
  if (/^(\d+\.)+\d*\.?\s/.test(line)) return "n";
  if (/^(I{1,3}|IV|V|VI{0,3}|IX|X{1,3})(\.\s|\s)/.test(line)) return "n";
  return "p";
}

function lineToHtml(line) {
  const text = line.replace(/\[MODALIDADE DO CONTRATO\]/g, "{{MODALIDADE}}");
  const kind = classify(text);
  const cls = kind === "t" ? "cl-t" : kind === "n" ? "cl-n" : "cl";
  return `<p class="${cls}">${esc(text)}</p>`;
}

function pageToHtml(lines, pageNum) {
  let start = 0;
  if (pageNum === 1) {
    const idx = lines.findIndex((l) => l.startsWith("Cláusula 1"));
    start = idx >= 0 ? idx : 0;
  }
  const body = lines.slice(start);
  if (pageNum === 10) {
    const html = [];
    for (const line of body) {
      if (line.startsWith("[Município/UF]")) {
        html.push('<p class="cl">{{MUNICIPIO_DATA}}</p>');
        continue;
      }
      if (line.includes("__________________________________________")) {
        html.push(
          '<p class="cl sig-line">__________________________________________ __________________________________________</p>'
        );
        continue;
      }
      if (line.includes("[LOCATÁRIO]") && line.includes("DK LOCADORA")) {
        html.push(
          '<p class="cl sig-block"><span>DK LOCADORA LTDA</span> <span>{{LOCATARIO}}</span></p>'
        );
        continue;
      }
      if (line.includes("[CPF do LOCATÁRIO]")) {
        html.push(
          '<p class="cl sig-block"><span>CNPJ: 59.665.734/0001-32</span> <span>{{CPF_LOCATARIO}}</span></p>'
        );
        continue;
      }
      html.push(lineToHtml(line));
    }
    return html.join("\n");
  }
  return body.map(lineToHtml).join("\n");
}

const pages = await extractPages(pdfPath);
const corpos = pages.map((lines, i) => pageToHtml(lines, i + 1));
const body = corpos
  .map((c, i) => "    `" + c + "`" + (i < corpos.length - 1 ? "," : ""))
  .join("\n");

const out = `(function () {
  "use strict";
  /** Corpo HTML de cada página (sem cabeçalho/rodapé — só cláusulas). Placeholders: {{MODALIDADE}} */
  window.__DK_CONTRATO_LOCACAO_CORPOS = [
${body}
  ];
})();
`;

fs.writeFileSync(outPath, out, "utf8");
console.log("Written:", outPath);
console.log("Lines:", out.split("\n").length);
console.log("Pages:", corpos.length);
