/**
 * Alteração de protocolo: o número antigo não sobrevive ao merge append-only.
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

console.log("OK protocolo remap merge — antigo removido, novo mantido");
