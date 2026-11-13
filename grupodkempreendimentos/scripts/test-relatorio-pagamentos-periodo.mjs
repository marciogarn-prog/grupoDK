/**
 * Testes unitários do período de pagamentos (sem rede).
 */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const store = require(path.join(root, "lib", "dk-pagamento-locacao-store.cjs"));

assert.equal(store.brParaYmd("14/10/2026"), "2026-10-14");
assert.equal(store.ymdParaBr("2026-10-14"), "14/10/2026");
assert.equal(store.normalizarYmdPeriodo("14/10/2026"), "2026-10-14");
assert.equal(store.normalizarYmdPeriodo("2026-10-14"), "2026-10-14");

const ui = await import("node:fs").then((fs) =>
  fs.promises.readFile(path.join(root, "portal-locadora-ui.js"), "utf8")
);
assert.match(ui, /portalFetchPagamentosPeriodoOficial/);
assert.match(ui, /portalRelPagAggLocsHidratadas/);
assert.match(ui, /\/api\/dk-pagamento-locacao\?inicio=/);

const api = await import("node:fs").then((fs) =>
  fs.promises.readFile(path.join(root, "api", "dk-pagamento-locacao.js"), "utf8")
);
assert.match(api, /listarPorPeriodoCompleto/);

console.log("PASS | relatório pagamentos período (helpers + wiring)");
