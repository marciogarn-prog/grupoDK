/**
 * Relatório de locações cadastradas: 6 agrupamentos + resumo CEO no cabeçalho.
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

const blocosIdx = [
  ui.indexOf('label: "1 — DK MEU TRANSPORTE (CARRO)"'),
  ui.indexOf('label: "2 — DK MEU TRANSPORTE (MOTO)"'),
  ui.indexOf('label: "3 — DK MINHA MOTO"'),
  ui.indexOf('label: "4 — DK MEU TRANSPORTE (CARRO)"'),
  ui.indexOf('label: "5 — DK MEU TRANSPORTE (MOTO)"'),
  ui.indexOf('label: "6 — DK MINHA MOTO"'),
];
record(
  "seis agrupamentos na ordem ATIVOS carro/moto/minha moto e FINALIZADOS iguais",
  ui.includes("PORTAL_REL_LOCACAO_BLOCOS") &&
    blocosIdx.every((i) => i >= 0) &&
    blocosIdx.every((i, n) => n === 0 || i > blocosIdx[n - 1]),
  blocosIdx.join(",")
);
record(
  "valor semanal em cada linha e no totalizador do bloco",
  ui.includes('"Valor semanal"') &&
    ui.includes("portalRelatorioLocacaoValorSemanalNum") &&
    ui.includes("Quantidade:") &&
    ui.includes("Valor semanal:"),
  ""
);
record(
  "bloco ordena por data de início (mais recentes no topo)",
  ui.includes("sortPortalLocacoesPorInicioContrato") &&
    ui.includes("preserveRowOrder: true") &&
    ui.includes("applyPortalRelatorioOrdemCadastro"),
  ""
);
record(
  "cabeçalho com o mesmo resumo PLANOS SEMANAIS ATIVOS do FINANCEIRO CEO",
  ui.includes("PLANOS SEMANAIS ATIVOS") &&
    ui.includes("portalRelatorioPlanosCeoAsideHtml") &&
    ui.includes("resumoPlanosAtivosCeo") &&
    ui.includes("headerAsideHtml"),
  ""
);
record(
  "KM inicial e KM fim continuam no relatório",
  ui.includes("KM inicial") && ui.includes("KM fim") && ui.includes("portalRelatorioLocacaoDataComKm"),
  ""
);
record(
  "setas de ordem continuam no JS",
  ui.includes("sortPortalRelatorioRowsCadastro") && ui.includes("applyPortalRelatorioOrdemCadastro"),
  ""
);
record("cache-bust", html.includes("portal-locadora-ui.js?v=20260916parcelas"), "");

const failed = results.filter((r) => !r.ok);
if (failed.length) {
  console.error(`\n${failed.length} falha(s)`);
  process.exit(1);
}
console.log(`\n${results.length}/${results.length} ok`);
