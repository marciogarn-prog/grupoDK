/**
 * Alteração de protocolo: o número antigo do mesmo contrato some;
 * outro contrato pode reutilizar o número libertado.
 * node grupodkempreendimentos/scripts/test-protocolo-remap-merge.mjs
 */
import path from "path";
import { createRequire } from "module";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const merge = require(path.join(ROOT, "lib/dk-append-only-merge.cjs"));

const antigo = {
  numeroContrato: "2026090204",
  placa: "UHJ7F78",
  cpf: "12345678901",
  nome: "ILMARIO SOUZA ALVES",
  inicio: "02/09/2026",
  valorSemanal: 350,
  updatedAt: 100,
  createdAt: 100,
};
const novo = {
  ...antigo,
  numeroContrato: "2026090205",
  protocoloAnterior: "2026090204",
  updatedAt: 200,
};

const out = merge.mergeLocacoesCadastro([antigo], [novo]);
const ncs = out.map((l) => String(l.numeroContrato));
if (ncs.includes("2026090204")) {
  console.error("FALHOU: protocolo antigo 2026090204 ainda existe após merge", ncs);
  process.exit(1);
}
if (!ncs.includes("2026090205")) {
  console.error("FALHOU: protocolo novo 2026090205 ausente", ncs);
  process.exit(1);
}
if (out.length !== 1) {
  console.error("FALHOU: esperado 1 locação, obtido", out.length, ncs);
  process.exit(1);
}

const dropped = merge.dropLocacoesProtocoloSubstituido([antigo, novo]);
if (dropped.length !== 1 || String(dropped[0].numeroContrato) !== "2026090205") {
  console.error("FALHOU: dropLocacoesProtocoloSubstituido", dropped);
  process.exit(1);
}

const outro03 = {
  numeroContrato: "2026090203",
  placa: "ABC1D23",
  cpf: "22222222222",
  nome: "OUTRO CLIENTE",
  inicio: "02/09/2026",
  updatedAt: 150,
  createdAt: 150,
};
const outro04 = {
  ...outro03,
  numeroContrato: "2026090204",
  protocoloAnterior: "2026090203",
  updatedAt: 300,
};

const reuse = merge.dropLocacoesProtocoloSubstituido([novo, outro04, antigo]);
const reuseNcs = reuse.map((l) => String(l.numeroContrato)).sort();
if (!reuseNcs.includes("2026090204") || !reuseNcs.includes("2026090205")) {
  console.error("FALHOU: reuso do número 04 por outro contrato foi apagado", reuseNcs);
  process.exit(1);
}
if (reuseNcs.includes("2026090204") && reuse.filter((l) => String(l.numeroContrato) === "2026090204").length !== 1) {
  console.error("FALHOU: fantasma 04 do ILMARIO não foi limpo no reuso", reuse);
  process.exit(1);
}
const kept04 = reuse.find((l) => String(l.numeroContrato) === "2026090204");
if (String(kept04?.cpf) !== "22222222222") {
  console.error("FALHOU: manteve o fantasma em vez do contrato reutilizado", kept04);
  process.exit(1);
}

const mergeReuse = merge.mergeLocacoesCadastro([novo, outro03, antigo], [novo, outro04]);
const mr = mergeReuse.map((l) => String(l.numeroContrato)).sort();
if (!mr.includes("2026090204") || !mr.includes("2026090205") || mr.includes("2026090203")) {
  console.error("FALHOU: merge com reuso", mr);
  process.exit(1);
}

console.log("OK protocolo remap merge — antigo do mesmo contrato removido; reuso de número OK");
