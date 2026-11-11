/**
 * União de manutenções para VMs irmãs gémeas — não pode perder placas activas.
 * Simula o pingue-pongue 1↔23: fundir clone incompleto nunca apaga o completo.
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

/* Pingue-pongue: PC com 1 placa sobe depois do clone com 23 — união tem de ficar 23. */
const vinteTres = Array.from({ length: 23 }, (_, i) => ({
  id: `m${i + 1}`,
  placa: `PLT${String(i + 1).padStart(4, "0")}`,
  categoriaManutencao: "oficina-propria",
  updatedAt: 1000 + i,
}));
const soUma = [vinteTres[15]]; /* UHJ equivalente: uma placa do conjunto */
const clusterAposPcIncompleto = neverLoseCadastroPayload(
  { dk_manutencoes_cadastro: vinteTres },
  { dk_manutencoes_cadastro: soUma }
);
assert(
  clusterAposPcIncompleto.dk_manutencoes_cadastro.length === 23,
  `PC incompleto não pode reduzir o cluster: veio ${clusterAposPcIncompleto.dk_manutencoes_cadastro.length}`
);

const clusterAposPcRico = neverLoseCadastroPayload(
  { dk_manutencoes_cadastro: soUma },
  { dk_manutencoes_cadastro: vinteTres }
);
assert(
  clusterAposPcRico.dk_manutencoes_cadastro.length === 23,
  `PC rico tem de elevar o cluster de 1 para 23: veio ${clusterAposPcRico.dk_manutencoes_cadastro.length}`
);

/* Alinhar como o servidor: hub + clone1 + clone2 */
let fundidoCluster = {};
fundidoCluster = neverLoseCadastroPayload(fundidoCluster, { dk_manutencoes_cadastro: soUma });
fundidoCluster = neverLoseCadastroPayload(fundidoCluster, { dk_manutencoes_cadastro: vinteTres });
assert(
  fundidoCluster.dk_manutencoes_cadastro.length === 23,
  `alinearCluster (união) deve ter 23, veio ${fundidoCluster.dk_manutencoes_cadastro.length}`
);

console.log("--- 6/6 testes merge manutenções VM gémeas ---");
