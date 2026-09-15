/**
 * Apagar um pagamento não pode impedir relançar a mesma data/valor depois.
 * O tombstone g: continua a bloquear gémeos antigos (createdAt <= removedAt).
 * node grupodkempreendimentos/scripts/test-lancamento-readd-apos-apagar.mjs
 */
import fs from "fs";
import path from "path";
import { createRequire } from "module";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const { filtrarPortalLancamentosPorRemovidos } = require("../lib/dk-append-only-merge.cjs");

const results = [];
function record(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} | ${name}${detail ? ` | ${detail}` : ""}`);
}

const protoJs = fs.readFileSync(path.join(ROOT, "dk-lancamento-protocolo.js"), "utf8");
const mergeJs = fs.readFileSync(path.join(ROOT, "lib/dk-append-only-merge.cjs"), "utf8");
const appJs = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");
const uiJs = fs.readFileSync(path.join(ROOT, "portal-locadora-ui.js"), "utf8");
const css = fs.readFileSync(path.join(ROOT, "styles.css"), "utf8");

record(
  "filtro usa createdAt vs removedAt no browser e na nuvem",
  protoJs.includes("ca <= remAt") && mergeJs.includes("ca <= remAt") && protoJs.includes('g:" + data'),
  ""
);
record(
  "campo DATA DO PAGAMENTO deixa digitar DD/MM/AAAA",
  appJs.includes("O ícone nativo (direita) abre o calendário") &&
    !/input\.addEventListener\("mousedown", openCal\)/.test(appJs) &&
    css.includes("width: 2.35rem"),
  ""
);
record(
  "histórico destaca o lançamento recém-gravado",
  uiJs.includes("destacarLancamentoHistorico") &&
    protoJs.includes("data-lanc-data") &&
    css.includes("portal-lanc-hist__row--novo"),
  ""
);

const cpfOp = "03037897430";
const removedAt = Date.parse("2026-09-15T09:00:00-03:00");
const ghost = {
  data: "05/01/2026",
  valor: 350,
  createdAt: Date.parse("2026-01-05T12:00:00-03:00"),
  registradoPorCpf: cpfOp,
  protocoloLancamento: "20260105120000-030",
};
const relancado = {
  data: "05/01/2026",
  valor: 350,
  createdAt: removedAt + 60_000,
  registradoPorCpf: cpfOp,
  protocoloLancamento: "20260915090100-030",
};
const tomb = [
  {
    data: "05/01/2026",
    valor: 350,
    createdAt: ghost.createdAt,
    registradoPorCpf: cpfOp,
    protocoloLancamento: ghost.protocoloLancamento,
    removedAt,
  },
];

const filtrado = filtrarPortalLancamentosPorRemovidos([ghost, relancado], tomb);
record(
  "gémeo antigo com createdAt anterior ao apagar some",
  filtrado.length === 1 && filtrado[0].protocoloLancamento === relancado.protocoloLancamento,
  JSON.stringify(filtrado.map((x) => x.protocoloLancamento))
);
record(
  "relançamento 05/01/2026 depois do apagar fica gravado",
  filtrado.some((x) => x.protocoloLancamento === relancado.protocoloLancamento),
  ""
);

const failed = results.filter((r) => !r.ok);
if (failed.length) {
  console.error(`FAIL ${failed.length}/${results.length}`);
  process.exit(1);
}
console.log(`OK ${results.length}/${results.length}`);
