/**
 * Exporta layouts de múltiplas abas MIEL de uma vez.
 * node scripts/export-miel-all-layouts.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const exportScript = path.join(__dirname, "export-miel-sheet-layout.mjs");

/** [nome, sheetXml, outBase, rowStart, rowEnd, maxCol, templateRow, headerRow] */
const SHEETS = [
  ["Cad_Clientes", "sheet12.xml", "cad-clientes-layout", 1, 11, 19, 12, 11],
  ["Cad_Veiculos", "sheet13.xml", "cad-veiculos-layout", 1, 17, 22, 18, 17],
  ["Relacao_Clientes", "sheet15.xml", "relacao-clientes-layout", 1, 4, 12, 5, 4],
  ["Relacao_Veiculos", "sheet16.xml", "relacao-veiculos-layout", 1, 4, 18, 5, 4],
  ["Status_Veiculos", "sheet17.xml", "status-veiculos-layout", 1, 4, 16, 5, 4],
  ["Pagina_Inicial", "sheet2.xml", "pagina-inicial-layout", 1, 20, 30, 21, 20],
  ["Administrativo", "sheet3.xml", "administrativo-layout", 7, 46, 82, 47, 46],
];

const results = [];
for (const args of SHEETS) {
  const r = spawnSync(process.execPath, [exportScript, ...args.map(String)], { encoding: "utf8" });
  const ok = r.status === 0;
  results.push({ sheet: args[0], ok, out: (r.stdout || r.stderr || "").trim().split("\n").pop() });
  if (!ok) console.error("FAIL", args[0], r.stderr);
}
const manifest = {
  exportedAt: new Date().toISOString(),
  results,
};
fs.writeFileSync(path.join(__dirname, "../data/miel/layout-export-manifest.json"), JSON.stringify(manifest, null, 2));
console.log(JSON.stringify(results, null, 2));
