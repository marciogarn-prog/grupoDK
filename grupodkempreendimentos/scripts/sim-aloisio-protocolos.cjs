/** Simula base com fantasma + reconcile + sanitize (lógica espelhada). */
const vm = require("vm");
const fs = require("fs");
const path = require("path");

const appPath = path.join(__dirname, "..", "app.js");
let appCode = fs.readFileSync(appPath, "utf8");
appCode = appCode.replace(/ensureNumeroContratoForLocacoes\(\);[\s\S]*?fixKnownRentalValueOverrides\(\);/, "");
const importCode = fs.readFileSync(
  path.join(__dirname, "..", "locacoes-receita-2026-import.js"),
  "utf8"
);

const sandbox = { localStorage: new Map(), console };
sandbox.localStorage.getItem = (k) => sandbox.localStorage.get(k) ?? null;
sandbox.localStorage.setItem = (k, v) => sandbox.localStorage.set(k, v);
sandbox.localStorage.removeItem = (k) => sandbox.localStorage.delete(k);
sandbox.window = sandbox;

vm.runInThisContext(`${importCode}\n${appCode}`, { filename: "bundle.js" });

const CPF = "00175015554";
const dig = (s) => String(s).replace(/\D/g, "");

function listAloisio() {
  return loadCadastro(CAD_LOCACOES_KEY)
    .filter((l) => dig(l.cpf) === CPF)
    .map((l) => ({
      nc: String(l.numeroContrato || "").replace(/\s+/g, ""),
      placa: l.placa,
      inicio: l.inicio,
      fim: l.fim,
    }))
    .sort((a, b) => a.inicio.localeCompare(b.inicio));
}

// Só 2 contratos + fantasma (como na nuvem corrompida)
saveCadastro(
  CAD_LOCACOES_KEY,
  [
    {
      id: 1,
      numeroContrato: "2025041601",
      cpf: CPF,
      placa: "SOQ2D39",
      inicio: "16/04/2025",
      fim: "28/07/2025",
    },
    {
      id: 2,
      numeroContrato: "2025082801",
      cpf: CPF,
      placa: "SOU5C59",
      inicio: "28/08/2025",
      fim: "16/01/2026",
    },
    {
      id: 3,
      numeroContrato: "2026082801",
      cpf: CPF,
      placa: "SOU5C59",
      inicio: "16/01/2026",
      fim: "27/03/2026",
    },
  ],
  { bypassImmutabilidadeCadastro: true }
);

console.log("ANTES:", listAloisio());
repairProtocolosLocacaoPorDataInicioOnce();
console.log("DEPOIS:", listAloisio());
