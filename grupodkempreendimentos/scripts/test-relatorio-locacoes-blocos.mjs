/**
 * Relatório de locações cadastradas: valor semanal por linha e 3 blocos com totalizador.
 * node grupodkempreendimentos/scripts/test-relatorio-locacoes-blocos.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const results = [];
function record(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} | ${name}${detail ? ` | ${detail}` : ""}`);
}

const ui = fs.readFileSync(path.join(ROOT, "portal-locadora-ui.js"), "utf8");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");

record(
  "três blocos de plano no relatório de locações",
  ui.includes("PORTAL_REL_LOCACAO_BLOCOS") &&
    ui.includes('label: "DK MINHA MOTO"') &&
    ui.includes('label: "DK MEU TRANSPORTE (CARRO)"') &&
    ui.includes('label: "DK MEU TRANSPORTE (MOTO)"'),
  ""
);
record(
  "valor semanal em cada linha e no totalizador",
  ui.includes('"Valor semanal"') &&
    ui.includes("portalRelatorioLocacaoValorSemanalNum") &&
    ui.includes("Quantidade:") &&
    ui.includes("Valor semanal:"),
  ""
);
record(
  "KM inicial e KM fim continuam no relatório",
  ui.includes("KM inicial") && ui.includes("KM fim") && ui.includes("portalRelatorioLocacaoDataComKm"),
  ""
);
record(
  "setas de ordem continuam a ordenar dentro dos blocos",
  ui.includes("sortPortalRelatorioRowsCadastro") &&
    ui.includes("preserveRowOrder: true") &&
    ui.includes("applyPortalRelatorioOrdemCadastro"),
  ""
);
record(
  "cache-bust",
  html.includes("portal-locadora-ui.js?v=20260915relblocos"),
  ""
);

const failed = results.filter((r) => !r.ok);
if (failed.length) {
  console.error(`\n${failed.length} falha(s)`);
  process.exit(1);
}
console.log(`\n${results.length}/${results.length} ok`);
