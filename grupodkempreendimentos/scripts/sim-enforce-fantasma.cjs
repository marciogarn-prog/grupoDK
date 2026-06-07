/** Simula enforce: fantasma 2026082801 + oficial 2026011601 (mesmo vínculo). */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const importPath = path.join(__dirname, "..", "locacoes-receita-2026-import.js");
const bundle = vm.runInNewContext(`${fs.readFileSync(importPath, "utf8")}\nLOCACOES_RECEITA_2026_IMPORT;`, {});

const existing = [
  ...bundle,
  {
    id: 999001,
    cpf: "00175015554",
    placa: "SOU5C59",
    inicio: "16/01/2026",
    fim: "27/03/2026",
    numeroContrato: "2026082801",
    portalLancamentosAluguel: [{ valor: "100", data: "01/02/2026" }],
  },
];

const ncNorm = (v) => String(v || "").replace(/\D/g, "");
const nk = (l) => `${l.cpf}|${l.placa}|${l.inicio}`;

const official = bundle.filter((r) => r.cpf === "00175015554");
const resultByNc = new Map();
const officialNaturalToNc = new Map();
official.forEach((o) => {
  const nc = ncNorm(o.numeroContrato);
  resultByNc.set(nc, { ...o });
  officialNaturalToNc.set(nk(o), nc);
});

existing.forEach((loc) => {
  const nc = ncNorm(loc.numeroContrato);
  const key = nk(loc);
  if (nc && resultByNc.has(nc)) return;
  if (key && officialNaturalToNc.has(key)) {
    const offNc = officialNaturalToNc.get(key);
    const t = resultByNc.get(offNc);
    if (t) resultByNc.set(offNc, { ...t, merged: true });
    return;
  }
  if (nc) resultByNc.set(nc, loc);
});

const aloisio = [...resultByNc.values()].filter((r) => String(r.cpf).includes("175015554"));
console.log(
  aloisio.map((r) => r.numeroContrato),
  "fantasma?",
  aloisio.some((r) => r.numeroContrato === "2026082801")
);
