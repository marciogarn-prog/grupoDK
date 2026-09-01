/**
 * Reativar locação: o recorde mais novo sem data fim não herda FINALIZADO.
 * node grupodkempreendimentos/scripts/test-reativar-locacao-merge.mjs
 */
import path from "path";
import { createRequire } from "module";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const merge = require(path.join(ROOT, "lib/dk-append-only-merge.cjs"));

const oldFin = {
  numeroContrato: "2026070303",
  placa: "UHY1F16",
  cpf: "09278910422",
  nome: "JOSÉ JAMESON SOARES DA SILVA",
  inicio: "03/07/2026",
  fim: "14/08/2026",
  statusLocacao: "FINALIZADO",
  portalLocacaoFinalizadoEmMs: 1788123607188,
  portalLocacaoFinalizadoPorNome: "Márcio Santos",
  updatedAt: 100,
  portalLancamentosAluguel: [{ data: "14/08/2026", valor: 1920, createdAt: 1, protocoloLancamento: "p1" }],
};
const reativado = {
  ...oldFin,
  fim: "",
  statusLocacao: "ATIVO",
  portalLocacaoFinalizadoEmMs: 0,
  portalLocacaoFinalizadoPorCpf: "",
  portalLocacaoFinalizadoPorNome: "",
  updatedAt: 200,
};

const out = merge.mergeLocacoesCadastro([oldFin], [reativado]);
const hit = out.find((l) => String(l.numeroContrato) === "2026070303");
const lancOk = Array.isArray(hit?.portalLancamentosAluguel) && hit.portalLancamentosAluguel.some((x) => Number(x.valor) === 1920);
const okAtivo = String(hit?.statusLocacao) === "ATIVO" && !String(hit?.fim || "").trim();
const okStamp = !Number(hit?.portalLocacaoFinalizadoEmMs || 0);

const stillFin = merge.mergeLocacoesCadastro([reativado], [{ ...oldFin, updatedAt: 50 }]);
const still = stillFin.find((l) => String(l.numeroContrato) === "2026070303");
const newerWins = String(still?.statusLocacao) === "ATIVO" && !String(still?.fim || "").trim();

const newerFin = merge.mergeLocacoesCadastro(
  [reativado],
  [{ ...oldFin, fim: "01/09/2026", updatedAt: 300, statusLocacao: "FINALIZADO" }]
);
const nf = newerFin.find((l) => String(l.numeroContrato) === "2026070303");
const newerFinWins = String(nf?.fim || "") === "01/09/2026" && String(nf?.statusLocacao) === "FINALIZADO";

const checks = [
  ["reativa e some data fim", okAtivo],
  ["limpa stamp de finalização", okStamp],
  ["mantém lançamento de 14/08", lancOk],
  ["FINALIZADO mais velho não volta", newerWins],
  ["FINALIZADO mais novo continua a valer", newerFinWins],
];
let fail = 0;
for (const [name, ok] of checks) {
  console.log(`${ok ? "PASS" : "FAIL"} | ${name}`);
  if (!ok) fail += 1;
}
if (fail) {
  console.error(`\n${fail} falha(s)`);
  process.exit(1);
}
console.log(`\n${checks.length} checks OK`);
