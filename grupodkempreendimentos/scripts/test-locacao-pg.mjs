import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const pg = require("../lib/dk-locacao-pg.cjs");

const loc = {
  numeroContrato: "2026040802",
  cpf: "750.208.404-59",
  placa: "UHN2G97",
  portalLancamentosAluguel: [
    {
      protocoloLancamento: "20260824095751-098",
      data: "24/08/2026",
      valor: 6650,
      createdAt: Date.parse("2026-08-24T12:57:51Z"),
      tipoMovimento: "PAGAMENTO",
    },
  ],
  pgVersion: 4,
  pgId: "abc",
};

const campos = pg.stripCampos(loc);
assert.equal(campos.numeroContrato, "2026040802");
assert.equal(campos.portalLancamentosAluguel, undefined);
assert.equal(campos.pgVersion, undefined);

const novos = pg.movimentosNovos([], loc);
assert.equal(novos.length, 1);
assert.equal(novos[0].idempotency_key, "pag|20260824095751-098");
assert.equal(novos[0].tipo, "pagamento");

const repetido = pg.movimentosNovos(
  [{ idempotency_key: "pag|20260824095751-098", tipo: "pagamento", valor: 6650, protocolo_lancamento: "20260824095751-098", campos: {} }],
  loc
);
assert.equal(repetido.length, 0);

const ajuste = pg.movimentosNovos(
  [{ idempotency_key: "pag|20260824095751-098", tipo: "pagamento", valor: 6650, protocolo_lancamento: "20260824095751-098", campos: { createdAt: 1 }, data_movimento: "24/08/2026" }],
  {
    portalLancamentosAluguel: [{ ...loc.portalLancamentosAluguel[0], valor: 800, updatedAt: 50 }],
  }
);
assert.equal(ajuste.length, 1);
assert.equal(ajuste[0].tipo, "ajuste");
assert.equal(ajuste[0].valor, -5850);

const comEstorno = pg.movimentosNovos(
  [{ idempotency_key: "pag|20260824095751-098", tipo: "pagamento", valor: 6650, protocolo_lancamento: "20260824095751-098", campos: {} }],
  { portalLancamentosAluguel: [], portalLancamentosAluguelRemovidos: [{ protocoloLancamento: "20260824095751-098", valor: 6650, removedAt: 9 }] }
);
assert.equal(comEstorno.length, 1);
assert.equal(comEstorno[0].tipo, "estorno");
assert.equal(comEstorno[0].idempotency_key, "estorno|20260824095751-098");

const deNovo = pg.movimentosNovos(
  [
    { idempotency_key: "pag|20260824095751-098", tipo: "pagamento", valor: 6650, protocolo_lancamento: "20260824095751-098", campos: {}, created_at: "2026-08-24T12:57:51Z" },
    { idempotency_key: "estorno|20260824095751-098", tipo: "estorno", valor: 6650, protocolo_lancamento: "20260824095751-098", campos: { protocoloAlvo: "20260824095751-098" }, created_at: "2026-10-21T12:20:00Z" },
  ],
  loc
);
assert.equal(deNovo.length, 0);

const vista = pg.derivarVisao(
  { numeroContrato: "2026040802", placa: "UHN2G97" },
  [
    { tipo: "pagamento", valor: 6650, data_movimento: "24/08/2026", protocolo_lancamento: "20260824095751-098", campos: { createdAt: 1 }, created_at: "2026-08-24T12:57:51Z" },
    { tipo: "estorno", valor: 6650, protocolo_lancamento: "20260824095751-098", campos: { protocoloAlvo: "20260824095751-098" }, created_at: "2026-10-21T12:20:00Z" },
    { tipo: "pagamento", valor: 320, data_movimento: "21/10/2026", protocolo_lancamento: "20261021101010-001", campos: { createdAt: 2 }, created_at: "2026-10-21T13:10:00Z" },
  ]
);
assert.equal(vista.portalLancamentosAluguel.length, 1);
assert.equal(vista.portalLancamentosAluguel[0].valor, 320);
assert.equal(vista.portalLancamentosAluguelRemovidos.length, 1);

console.log("livro-razão de locação: regras ok");
