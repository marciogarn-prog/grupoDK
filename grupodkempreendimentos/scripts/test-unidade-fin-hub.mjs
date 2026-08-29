/**
 * Hub financeiro Centro Automotivo / Construtora: 3 botões e balanço.
 * node grupodkempreendimentos/scripts/test-unidade-fin-hub.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const locadoraUi = fs.readFileSync(path.join(root, "portal-locadora-ui.js"), "utf8");
const finJs = fs.readFileSync(path.join(root, "portal-unidade-financeiro.js"), "utf8");

const results = [];
function record(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} | ${name}${detail ? ` | ${detail}` : ""}`);
}

record("Hub unidade no HTML", html.includes('id="view-unidade-hub"'));
record("Tela financeira no HTML", html.includes('id="view-unidade-fin"'));
record("Botão RECEITA", /data-unidade-fin="receita"[\s\S]*?>[\s\S]*RECEITA/.test(html));
record("Botão DESPESA", /data-unidade-fin="despesa"[\s\S]*?>[\s\S]*DESPESA/.test(html));
record("Botão BALANÇO", /data-unidade-fin="balanco"[\s\S]*?>[\s\S]*BALANÇO/.test(html));
record("Script unidade financeiro", html.includes("portal-unidade-financeiro.js"));
record("openUnidadeHub no portal", locadoraUi.includes("function openUnidadeHub"));
record("Centro abre hub", locadoraUi.includes('if (go === "centro" || go === "construtora")'));

const store = new Map();
const sandbox = {
  window: {},
  document: {
    getElementById: () => null,
  },
  localStorage: {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
  },
};
sandbox.window = sandbox;
vm.runInNewContext(finJs, sandbox);

const merge = sandbox.window.__DK_mergeUnidadeFinanceiro;
const totals = sandbox.window.__DK_unidadeFinanceiroTotals;
record("Export merge", typeof merge === "function");
record("Export totals", typeof totals === "function");

if (typeof merge === "function" && typeof totals === "function") {
  const merged = merge(
    [{ id: "a", unit: "centro", tipo: "receita", valor: 100, descricao: "os", data: "01/01/2026", updatedAt: 1 }],
    [{ id: "a", unit: "centro", tipo: "receita", valor: 250, descricao: "nuvem", data: "01/01/2026", updatedAt: 2 }]
  );
  record("Merge guarda o mais recente", merged[0]?.valor === 250 && merged[0]?.descricao === "nuvem");

  const totCentro = totals("centro", [
    { unit: "centro", tipo: "receita", valor: 1000 },
    { unit: "centro", tipo: "despesa", valor: 400 },
    { unit: "construtora", tipo: "receita", valor: 999 },
  ]);
  record("Balanço Centro = receita − despesa", totCentro.saldo === 600 && totCentro.receita === 1000);
  const totCons = totals("construtora", [
    { unit: "centro", tipo: "receita", valor: 1000 },
    { unit: "construtora", tipo: "despesa", valor: 80 },
  ]);
  record("Unidades isoladas no balanço", totCons.saldo === -80 && totCons.receita === 0);
}

const pass = results.filter((r) => r.ok).length;
console.log(`\n--- ${pass}/${results.length} testes hub unidade ---`);
process.exit(pass === results.length ? 0 : 1);
