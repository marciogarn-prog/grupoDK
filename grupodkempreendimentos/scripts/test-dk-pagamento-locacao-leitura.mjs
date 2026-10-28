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

  const payloads = [{ data: "01/01/2026", valor: 10, protocoloLancamento: "20260101010101-001" }];
  const envelope = JSON.stringify({ ok: true, pagamentos: payloads, quantidade: 1 });
  assert.notStrictEqual(store.hashPagamentosPayload(payloads), require("crypto").createHash("sha256").update(envelope).digest("hex"));
  assert.strictEqual(store.hashPagamentosPayload(payloads), store.hashPagamentosPayload(payloads));

  const novo = {
    data: "28/10/2026",
    valor: 10,
    protocoloLancamento: "20261028010101-001",
    tipoMovimento: "PAGAMENTO",
  };
  const invalido = store.validarPagamento({ ...novo, protocoloLancamento: "" }, "2026102701");
  assert.strictEqual(invalido.reason, "protocolo_invalido");
  const linha = store.construirLinhaPagamento(novo, "2026102701", {
    id: "11111111-1111-4111-8111-111111111111",
    sourcePosition: 1,
    createdAt: "2026-10-28T04:00:00.000Z",
  });
  assert.strictEqual(linha.ok, true);
  assert.strictEqual(linha.linha.version, 1);
  assert.strictEqual(linha.linha.removido, false);
  assert.strictEqual(linha.linha.deleted_at, null);
  assert.strictEqual(linha.linha.migration_key, "online:11111111-1111-4111-8111-111111111111");
  assert.strictEqual(linha.linha.protocolo_lancamento, "20261028010101-001");
  assert.strictEqual(linha.linha.data_pagamento, "2026-10-28");
  assert.strictEqual(linha.linha.source_state, "online");
  assert.strictEqual(store.gravarUma().reason, "write_not_active");

  const duplicado = store.encontrarDuplicidade(novo, [novo]);
  assert.strictEqual(duplicado.status, 409);
  const caução = store.encontrarDuplicidade(
    { ...novo, tipoMovimento: "CAUCAO" },
    [{ ...novo, tipoMovimento: "CAUCAO" }]
  );
  assert.strictEqual(caução.ok, true);
  const versao = store.decidirVersao(2, 1);
  assert.strictEqual(versao.status, 409);
  assert.strictEqual(store.decidirVersao(2, 2).version, 3);

  const chamadas = [];
  const probe = await store.probeEscrita({
    fetch: async (url, init) => {
      chamadas.push({ url, method: init.method, body: init.body || "" });
      if (init.method === "GET") {
        return {
          ok: true,
          status: 200,
          text: async () =>
            JSON.stringify([
              {
                id: "22222222-2222-4222-8222-222222222222",
                migration_key: "historica",
                protocolo_lancamento: "20251114010101-057",
                numero_contrato: "2025111403",
                tipo: null,
                data_pagamento: "2026-03-31",
                valor: 350,
                payload: { protocoloLancamento: "20251114010101-057", data: "31/03/2026", valor: 350 },
                version: 1,
                removido: false,
                deleted_at: null,
                created_at: "2026-03-31T12:00:00.000Z",
                updated_at: null,
                source_state: "ativo",
                source_position: 1,
                source_payload_hash: "abc",
              },
            ]),
        };
      }
      return { ok: true, status: 201, text: async () => "[]" };
    },
  });
  assert.strictEqual(probe.ok, true);
  assert.strictEqual(probe.probe, true);
  assert.strictEqual(probe.mutated, false);
  assert.strictEqual(probe.inserted, 0);
  assert.strictEqual(probe.updated, 0);
  assert.ok(!chamadas.some((c) => c.url.includes("quarentena")));
  assert.ok(chamadas[1].url.includes("on_conflict=id"));
  assert.ok(chamadas[1].body.includes("22222222-2222-4222-8222-222222222222"));

  const falhaProbe = await store.probeEscrita({
    fetch: async () => {
      const err = new Error("abort");
      err.name = "AbortError";
      throw err;
    },
  });
  assert.strictEqual(falhaProbe.ok, false);
  assert.strictEqual(falhaProbe.fallback, false);
  assert.strictEqual(falhaProbe.mutated, false);
  assert.ok(!falhaProbe.pagamentos);

  let patch = false;
  const conflito = await store.removerE2eReal(2, {
    fetch: async (url, init) => {
      if (init && init.method === "PATCH") patch = true;
      return {
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify([
            {
              id: "e14c3cc2-ed23-409c-8e60-2cdfb65c6de9",
              numero_contrato: "2026102701",
              protocolo_lancamento: "20261028020219-030",
              migration_key: "online:e14c3cc2-ed23-409c-8e60-2cdfb65c6de9",
              valor: 1.02,
              version: 3,
              removido: true,
              deleted_at: "2026-10-28T05:40:00.000Z",
              source_position: 1,
            },
          ]),
      };
    },
  });
  assert.strictEqual(conflito.status, 409);
  assert.strictEqual(conflito.reason, "version_conflict");
  assert.strictEqual(patch, false);

  console.log("leitura fracionada local ok");
}

main().catch((err) => {
  console.error(err && err.message ? err.message : err);
  process.exit(1);
});
