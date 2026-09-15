/**
 * Painel executivo CEO: resumo de planos semanais ativos no espaço ao lado da Construtora.
 * node grupodkempreendimentos/scripts/test-fin-ceo-planos-ativos.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import vm from "vm";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const results = [];
function record(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} | ${name}${detail ? ` | ${detail}` : ""}`);
}

const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const ceoJs = fs.readFileSync(path.join(ROOT, "portal-financeiro-ceo.js"), "utf8");
const css = fs.readFileSync(path.join(ROOT, "styles.css"), "utf8");

record(
  "caixa no Painel executivo ao lado da Construtora",
  html.includes("finCeoKpiBoxPlanosAtivos") &&
    html.includes("Planos semanais ativos") &&
    html.includes("DK Meu Transporte moto") &&
    html.includes("DK Meu Transporte carro") &&
    html.includes("DK Minha Moto") &&
    html.includes("finCeoKpiPlanosLocacao") &&
    html.includes("finCeoKpiPlanosInvestimento"),
  ""
);
record(
  "JS classifica e soma contratos ativos",
  ceoJs.includes("function resumoPlanosAtivosCeo") &&
    ceoJs.includes("classificarPlanoAtivoCeo") &&
    ceoJs.includes("valoresContratoSplitCeo") &&
    ceoJs.includes('setTxt("finCeoKpiPlanosMtMoto"'),
  ""
);
record("CSS da caixa de planos", css.includes("fin-kpi--planos-ativos") && css.includes("fin-kpi-planos__lista"), "");
record(
  "cache-bust CEO planos",
  html.includes("portal-financeiro-ceo.js?v=20260915planos") && html.includes("styles.css?v=20260915planos"),
  ""
);

const sandbox = {
  window: { parseCurrencyBR: null, getVehicleMapByPlate: null, portalInferTipoVeiculoLocacao: null },
  document: { readyState: "complete", getElementById: () => null, querySelector: () => null, addEventListener() {} },
  localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
  console,
};
sandbox.window.window = sandbox.window;
sandbox.window.document = sandbox.document;
sandbox.window.localStorage = sandbox.localStorage;
const start = ceoJs.indexOf("function valoresContratoSplitCeo");
const end = ceoJs.indexOf("const LOCACOES_CEO_KEY");
record("recorte das funções de resumo", start >= 0 && end > start, "");
if (start >= 0 && end > start) {
  const snippet = `
    function parseValor(raw) {
      if (typeof raw === "number" && Number.isFinite(raw)) return raw;
      const s = String(raw || "").replace(/[R$\\s]/g, "");
      if (!s) return 0;
      const n = Number(s.includes(",") ? s.replace(/\\./g, "").replace(",", ".") : s);
      return Number.isFinite(n) ? n : 0;
    }
    ${ceoJs.slice(start, end)}
    this.valoresContratoSplitCeo = valoresContratoSplitCeo;
    this.classificarPlanoAtivoCeo = classificarPlanoAtivoCeo;
    this.locacaoEstaAtiva = function () { return true; };
    this.locacaoExcluidaReceitaCeo = function (loc) { return !loc || loc.fantasma; };
    this.resumoPlanosAtivosCeo = resumoPlanosAtivosCeo;
  `;
  try {
    vm.createContext(sandbox);
    vm.runInContext(snippet, sandbox);
    const split = sandbox.valoresContratoSplitCeo({
      valorLocacao: "R$ 330,00",
      valorInvestimento: "R$ 20,00",
    });
    record(
      "separa locação e investimento",
      Math.abs(split.locacao - 330) < 0.01 && Math.abs(split.investimento - 20) < 0.01 && Math.abs(split.total - 350) < 0.01,
      JSON.stringify(split)
    );
    record(
      "carro é DK Meu Transporte carro",
      sandbox.classificarPlanoAtivoCeo({ modalidade: "CARRO", valorInvestimento: 50, plano: "DK MEU TRANSPORTE" }) ===
        "DK MEU TRANSPORTE-CARRO",
      ""
    );
    record(
      "moto com investimento é DK Minha Moto",
      sandbox.classificarPlanoAtivoCeo({ modalidade: "MOTO", valorInvestimento: 50, plano: "DK MINHA MOTO" }) ===
        "DK MINHA MOTO",
      ""
    );
    record(
      "moto sem investimento é DK Meu Transporte moto",
      sandbox.classificarPlanoAtivoCeo({ modalidade: "MOTO", valorInvestimento: 0, plano: "DK MEU TRANSPORTE" }) ===
        "DK MEU TRANSPORTE-MOTO",
      ""
    );
    const resumo = sandbox.resumoPlanosAtivosCeo([
      { modalidade: "MOTO", valorLocacao: 330, valorInvestimento: 0, plano: "DK MEU TRANSPORTE" },
      { modalidade: "MOTO", valorLocacao: 330, valorInvestimento: 20, plano: "DK MINHA MOTO" },
      { modalidade: "CARRO", valorLocacao: 700, valorInvestimento: 0, plano: "DK MEU TRANSPORTE" },
      { fantasma: true, modalidade: "MOTO", valorLocacao: 999, valorInvestimento: 0 },
    ]);
    record(
      "soma 3 ativos e ignora fantasma",
      resumo.qtd === 3 &&
        Math.abs(resumo.locacao - 1360) < 0.01 &&
        Math.abs(resumo.investimento - 20) < 0.01 &&
        resumo["DK MEU TRANSPORTE-MOTO"].qtd === 1 &&
        resumo["DK MEU TRANSPORTE-CARRO"].qtd === 1 &&
        resumo["DK MINHA MOTO"].qtd === 1 &&
        Math.abs(resumo["DK MINHA MOTO"].semanal - 350) < 0.01,
      JSON.stringify(resumo)
    );
  } catch (err) {
    record("executa recorte das funções", false, String(err?.message || err));
  }
}

const failed = results.filter((r) => !r.ok);
if (failed.length) {
  console.error(`FAIL ${failed.length}/${results.length}`);
  process.exit(1);
}
console.log(`OK ${results.length}/${results.length}`);
