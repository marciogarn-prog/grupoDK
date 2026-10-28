/**
 * Leitura fracionada: um contrato, sem fallback e sem listagem global.
 */
import { createRequire } from "module";
import assert from "assert";

const require = createRequire(import.meta.url);
const store = require("../lib/dk-pagamento-locacao-store.cjs");
const { decidirAcessoLocacao } = require("../lib/dk-locacao-pg.cjs");

function fetchJson(body, status = 200) {
  return async () => ({
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
  });
}

async function main() {
  assert.strictEqual(store.contratoValido(""), false);
  assert.strictEqual(store.contratoValido("*"), false);
  assert.strictEqual(store.contratoValido("2025111403"), true);
  assert.ok(store.caminho("2025111403", false).includes("numero_contrato=eq.2025111403"));
  assert.ok(store.caminho("2025111403", false).includes("removido=eq.false"));
  assert.ok(!store.caminho("2025111403", false).includes("quarentena"));

  const semContrato = await store.listarPorContrato("");
  assert.strictEqual(semContrato.status, 400);
  assert.strictEqual(semContrato.fallback, false);

  const original = { data: "31/03/2026", valor: 350, protocoloLancamento: "" };
  const lido = await store.listarPorContrato("2025041602", {
    fetch: fetchJson([{ source_position: 1, payload: original }]),
  });
  assert.strictEqual(lido.ok, true);
  assert.strictEqual(lido.source, "dk_pagamento_locacao");
  assert.strictEqual(lido.quantidade, 1);
  assert.deepStrictEqual(lido.pagamentos[0], original);
  assert.strictEqual(lido.fallback, false);

  const vazio = await store.listarPorContrato("2026102701", { fetch: fetchJson([]) });
  assert.strictEqual(vazio.ok, true);
  assert.strictEqual(vazio.quantidade, 0);

  const removidos = await store.listarRemovidosPorContrato("2026092201", {
    fetch: fetchJson([
      { source_position: 8, payload: { protocoloLancamento: "20260922171044-057", removedAt: "1790117195419" } },
    ]),
  });
  assert.strictEqual(removidos.removido, true);
  assert.strictEqual(removidos.pagamentos[0].removedAt, "1790117195419");

  const falha = await store.listarPorContrato("2025111403", {
    fetch: async () => {
      const err = new Error("abort");
      err.name = "AbortError";
      throw err;
    },
  });
  assert.strictEqual(falha.ok, false);
  assert.strictEqual(falha.fallback, false);
  assert.notStrictEqual(falha.reason, "locacao");
  assert.ok(!falha.pagamentos);

  const negado = decidirAcessoLocacao({
    ok: true,
    typ: "equipa",
    role: "operacao",
    cpf: "00000000000",
    acessos: { locacao: false },
  });
  assert.strictEqual(negado.ok, false);
  assert.strictEqual(negado.status, 403);

  console.log("leitura fracionada local ok");
}

main().catch((err) => {
  console.error(err && err.message ? err.message : err);
  process.exit(1);
});
