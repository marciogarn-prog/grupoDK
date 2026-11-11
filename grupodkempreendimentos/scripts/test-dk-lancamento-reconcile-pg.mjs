/**
 * Teste unitário do reconcile fila → dk_pagamento_locacao (sem rede).
 */
import assert from "assert";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const api = require("../lib/dk-lancamento-reconcile-pg.cjs");

assert.equal(api.protoDe({ protocoloLancamento: "20261111102102-057" }), "20261111102102-057");
const a = api.operationIdDeProtocolo("20261111102102-057");
const b = api.operationIdDeProtocolo("20261111102102-057");
assert.equal(a, b, "operation_id estável");
assert.match(a, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-a[0-9a-f]{3}-[0-9a-f]{12}$/i);

console.log("--- 3/3 testes dk-lancamento-reconcile-pg ---");
