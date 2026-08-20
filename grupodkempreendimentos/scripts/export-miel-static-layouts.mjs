/**
 * Exporta layouts estáticos (visual only) para abas secundárias MIEL.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const exportScript = path.join(__dirname, "export-miel-sheet-layout.mjs");

const STATIC = [
  ["Consulta_Integrada", "sheet11.xml", "consulta-integrada-layout", 1, 20, 25, 21, 20],
  ["Acomp_Transf", "sheet18.xml", "acomp-transf-layout", 1, 20, 25, 21, 20],
  ["Motos_Vendidas", "sheet26.xml", "motos-vendidas-layout", 1, 20, 25, 21, 20],
  ["Form_Lista_Espera", "sheet50.xml", "form-lista-espera-layout", 1, 20, 25, 21, 20],
  ["ID_Chaveiros_Carros", "sheet51.xml", "id-chaveiros-carros-layout", 1, 20, 25, 21, 20],
  ["ID_Chaveiros_Motos", "sheet52.xml", "id-chaveiros-motos-layout", 1, 20, 25, 21, 20],
  ["Ctrl_Multas", "sheet56.xml", "ctrl-multas-layout", 1, 20, 25, 21, 20],
  ["Relatorio_EAR", "sheet61.xml", "relatorio-ear-layout", 1, 20, 25, 21, 20],
];

for (const args of STATIC) {
  const r = spawnSync(process.execPath, [exportScript, ...args.map(String)], { encoding: "utf8" });
  console.log(args[0], r.status === 0 ? "OK" : "FAIL", (r.stdout || r.stderr || "").trim().split("\n").pop());
}
