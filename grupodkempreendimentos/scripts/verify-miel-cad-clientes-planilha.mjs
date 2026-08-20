/**
 * Conferência Cad_Clientes: XML da planilha vs layout exportado vs código do portal.
 * Não usa índice de sharedStrings em células numéricas (isso gerava falso “idêntico”).
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const layout = JSON.parse(fs.readFileSync(path.join(__dirname, "../data/miel/cad-clientes-layout.json"), "utf8"));
const portal = fs.readFileSync(path.join(__dirname, "../portal-miel-cad-clientes.js"), "utf8");
const cad = JSON.parse(fs.readFileSync(path.join(__dirname, "../data/miel/miel-cadastros.json"), "utf8"));

let fails = 0;
function ok(name, cond, detail = "") {
  if (cond) console.log(`OK   | ${name}${detail ? ` | ${detail}` : ""}`);
  else {
    console.log(`FAIL | ${name}${detail ? ` | ${detail}` : ""}`);
    fails++;
  }
}

console.log("=== CONFERÊNCIA Cad_Clientes (planilha XML/layout vs portal) ===\n");

ok("aba exportada é Cad_Clientes", layout.sheetName === "Cad_Clientes", layout.sheetName);
ok("4 comandos (imagens) da planilha", (layout.drawings || []).length === 4, `n=${(layout.drawings || []).length}`);
ok(
  "comando Página Inicial",
  layout.drawings.some((d) => /Página_Inicial/i.test(d.href || ""))
);
ok(
  "comando Consulta_Veíc_ou_Cliente",
  layout.drawings.some((d) => /Consulta_Veíc/i.test(d.href || ""))
);
ok("3 hiperligações de células", (layout.hyperlinks || []).length === 3);
ok(
  "link Emissão_de_Protocolos",
  layout.hyperlinks.some((h) => /Emissão_de_Protocolos/i.test(h.location || ""))
);
ok(
  "link Termo_de_Subst._Provisória",
  layout.hyperlinks.some((h) => /Termo_de_Subst/i.test(h.location || ""))
);
ok("colunas C, D e N ocultas como no Excel", layout.colHidden?.[2] && layout.colHidden?.[3] && layout.colHidden?.[13]);
ok("portal não inventa atalho lateral HTML", !portal.includes("data-miel-cad-side") && !portal.includes("SIDE_TARGETS"));
ok("portal liga cliques data-miel-xl-link", portal.includes("data-miel-xl-link") && portal.includes("__DK_mielOpenExcelLocation"));

const c11 = layout.headerCells.find((h) => h.ref === "C11");
const g11 = layout.headerCells.find((h) => h.ref === "G11");
const r11 = layout.headerCells.find((h) => h.ref === "R11");
ok("C11 Análise", c11?.text === "Análise", c11?.text);
ok("G11 Cliente", g11?.text === "Cliente", g11?.text);
ok("R11 Endereço", r11?.text === "Endereço", r11?.text);

const first = cad.clientes?.[0];
ok("1.º cliente da planilha", first?.cliente === "FELIPE YAGO GOMES RIBEIRO", first?.cliente);
ok("coluna A = código numérico 1", String(first?.cod) === "1", String(first?.cod));
ok("366 clientes importados", cad.clientes.length === 366, String(cad.clientes.length));

console.log(`\n--- ${fails === 0 ? "CONFERÊNCIA OK" : `FALHOU (${fails})`} ---`);
process.exit(fails === 0 ? 0 : 1);
