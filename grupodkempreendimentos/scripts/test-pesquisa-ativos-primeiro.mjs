/**
 * Lista de pesquisa: protocolos ativos em cima.
 * node grupodkempreendimentos/scripts/test-pesquisa-ativos-primeiro.mjs
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

const ui = fs.readFileSync(path.join(ROOT, "portal-locadora-ui.js"), "utf8");
record("função de ordem existe", ui.includes("function sortPortalPesquisaLinhasAtivoPrimeiro"));
record("lista do aluguel usa a ordem", ui.includes("sortPortalPesquisaLinhasAtivoPrimeiro(linhas)"));
record("inativo continua com data fim", ui.includes("portal-lanc-pesquisa-linha__fim"));

const sandbox = {
  window: {},
  document: { getElementById: () => null },
  console,
};
sandbox.window.window = sandbox.window;
const start = ui.indexOf("function sortPortalPesquisaLinhasAtivoPrimeiro");
const end = ui.indexOf("\n  function renderOperacaoLancAluguelPesquisaLista");
record("bloco da função extraído", start >= 0 && end > start);
if (start >= 0 && end > start) {
  vm.createContext(sandbox);
  vm.runInContext(`${ui.slice(start, end)}\nthis.sort = sortPortalPesquisaLinhasAtivoPrimeiro;`, sandbox);
  const out = sandbox.sort([
    { proto: "2025080102", ativo: false },
    { proto: "2026030201", ativo: true },
    { proto: "2025082204", ativo: false },
    { proto: "2026090101", ativo: true },
  ]);
  record(
    "ativos no topo",
    out[0].ativo && out[1].ativo && !out[2].ativo && !out[3].ativo
  );
  record("ativo mais recente primeiro", out[0].proto === "2026090101" && out[1].proto === "2026030201");
  record("inativo mais recente depois dos ativos", out[2].proto === "2025082204" && out[3].proto === "2025080102");
}

const pass = results.filter((r) => r.ok).length;
console.log(`\n--- ${pass}/${results.length} pesquisa ativos primeiro ---`);
process.exit(pass === results.length ? 0 : 1);
