/**
 * União de manutenções para VMs irmãs gémeas — não pode perder placas activas.
 */
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { mergeManutencoesCadastro, neverLoseCadastroPayload } = require("../lib/dk-append-only-merge.cjs");

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const a = [
  { id: "1", placa: "UHJ1D40", categoriaManutencao: "oficina-propria", updatedAt: 100 },
  { id: "2", placa: "SPA3E38", categoriaManutencao: "oficina-propria", updatedAt: 100 },
];
const b = [{ id: "1", placa: "UHJ1D40", categoriaManutencao: "oficina-propria", updatedAt: 200 }];

const uniao = mergeManutencoesCadastro(a, b);
assert(uniao.length === 2, `esperava 2 activos, veio ${uniao.length}`);
assert(
  uniao.some((x) => String(x.placa).toUpperCase() === "SPA3E38"),
  "SPA3E38 não pode desaparecer na fusão"
);

const cloneA = { dk_manutencoes_cadastro: a, dk_clientes_cadastro: [] };
const cloneB = { dk_manutencoes_cadastro: b, dk_clientes_cadastro: [] };
const fundido = neverLoseCadastroPayload(cloneA, cloneB);
assert(
  Array.isArray(fundido.dk_manutencoes_cadastro) && fundido.dk_manutencoes_cadastro.length === 2,
  "neverLoseCadastroPayload deve unir dk_manutencoes_cadastro"
);

console.log("--- 3/3 testes merge manutenções VM gémeas ---");
