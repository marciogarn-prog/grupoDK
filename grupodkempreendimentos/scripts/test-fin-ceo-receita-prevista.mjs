/**
 * FINANCEIRO CEO → Painel executivo: receita prevista por unidade e soma no KPI total.
 * node grupodkempreendimentos/scripts/test-fin-ceo-receita-prevista.mjs
 */
import fs from "fs";
import path from "path";
import vm from "vm";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const results = [];

function record(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} | ${name}${detail ? ` | ${detail}` : ""}`);
}

function readLocal(rel) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

const html = readLocal("index.html");
record("HTML: KPI receita Locadora", html.includes('id="finCeoKpiReceitaLocadora"'));
record("HTML: KPI receita Centro", html.includes('id="finCeoKpiReceitaCentro"'));
record("HTML: KPI receita Construtora", html.includes('id="finCeoKpiReceitaConstrutora"'));
record("HTML: KPI receita total do mês", html.includes('id="finCeoKpiReceita"'));

const ceoJs = readLocal("portal-financeiro-ceo.js");
record("JS: calcReceitasPorUnidade", ceoJs.includes("function calcReceitasPorUnidade"));
record("JS: receitaSemanalParaMensal", ceoJs.includes("function receitaSemanalParaMensal"));
record("JS: fonte dk_unidade_financeiro_v1", ceoJs.includes("dk_unidade_financeiro_v1"));
record("JS: exclui protocolo teste", ceoJs.includes('PROTOCOLO_TESTE_CEO = "2099010199"'));

const sandbox = {
  document: {
    getElementById: (id) => (id === "panel-financeiro-ceo-locadora" ? {} : null),
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener: () => {},
  },
  window: {},
  localStorage: { getItem: () => null, setItem: () => {} },
  console,
};
sandbox.window = sandbox;
vm.runInNewContext(ceoJs, sandbox);

const calc = sandbox.window.__DK_finCeoReceitaCalc;
record("Export __DK_finCeoReceitaCalc", Boolean(calc));

if (calc) {
  const locs = [
    {
      numeroContrato: "2026010101",
      valorLocacao: "R$ 300,00",
      valorInvestimento: "R$ 20,00",
      fim: "",
    },
    {
      numeroContrato: "2026010102",
      valorLocacao: "R$ 200,00",
      valorInvestimento: "R$ 0,00",
      dataFim: "01/01/2026",
    },
    {
      numeroContrato: "2099010199",
      valorLocacao: "R$ 9.999,00",
      valorInvestimento: "R$ 0,00",
      fim: "",
    },
  ];

  const locSemanal = calc.receitaSemanalLocadora(locs);
  record("Locadora: soma semanal locações ativas", locSemanal === 320, `esperado 320, obtido ${locSemanal}`);

  const locSet = calc.receitaPrevistaLocadora(locs, 2026, 8);
  const esperadoSet = (320 / 7) * 30;
  record(
    "Locadora: mensal set/2026 = semanal ÷ 7 × 30",
    Math.abs(locSet - esperadoSet) < 0.01,
    `esperado ${esperadoSet}, obtido ${locSet}`
  );
  record(
    "Locadora: mensal jan/2026 = semanal ÷ 7 × 31",
    Math.abs(calc.receitaPrevistaLocadora(locs, 2026, 0) - (320 / 7) * 31) < 0.01
  );

  record("Locadora: exclui protocolo 2099010199", !calc.locacaoExcluidaReceitaCeo(locs[0]));
  record("Locadora: exclui teste 2099010199", calc.locacaoExcluidaReceitaCeo(locs[2]));

  const uniRows = [
    { unit: "centro", tipo: "receita", valor: 500, data: "15/09/2026" },
    { unit: "centro", tipo: "receita", valor: 200, data: "01/08/2026" },
    { unit: "construtora", tipo: "receita", valor: 1000, data: "10/09/2026" },
    { unit: "construtora", tipo: "despesa", valor: 50, data: "10/09/2026" },
  ];

  const centroSet = calc.receitaPrevistaCentroAutomotivo(2026, 8, uniRows);
  const constrSet = calc.receitaPrevistaConstrutora(2026, 8, uniRows);
  record("Centro: receitas do mês (set/2026)", centroSet === 500, `esperado 500, obtido ${centroSet}`);
  record("Construtora: receitas do mês (set/2026)", constrSet === 1000, `esperado 1000, obtido ${constrSet}`);
  record("Centro: ignora mês diferente", calc.receitaPrevistaCentroAutomotivo(2026, 7, uniRows) === 200);

  const pack = calc.calcReceitasPorUnidade(locs, 2026, 8, uniRows);
  record(
    "Total = Locadora + Centro + Construtora",
    Math.abs(pack.total - (locSet + centroSet + constrSet)) < 0.01,
    String(pack.total)
  );
  record(
    "calcReceitasPorUnidade devolve as 3 unidades",
    Math.abs(pack.locadora - locSet) < 0.01 && pack.centro === centroSet && pack.construtora === constrSet
  );
}

const pass = results.filter((r) => r.ok).length;
console.log(`\n--- ${pass}/${results.length} testes receita prevista CEO ---`);
process.exit(pass === results.length ? 0 : 1);
