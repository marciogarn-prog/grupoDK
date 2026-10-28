/**
 * Adaptador de leitura: array histórico, lote, sem fallback e sem metadados.
 */
import { createRequire } from "module";
import assert from "assert";

const require = createRequire(import.meta.url);
const adapter = require("../lib/dk-pagamento-locacao-adapter.cjs");

function headersDe(range) {
  return { get: (name) => (String(name).toLowerCase() === "content-range" ? range : null) };
}

function fetchJson(body, status = 200, range = "") {
  return async (url) => ({
    ok: status >= 200 && status < 300,
    status,
    headers: headersDe(range),
    text: async () => JSON.stringify(body),
    url,
  });
}

function captura() {
  const urls = [];
  return {
    urls,
    fetch(body, range) {
      return async (url) => {
        urls.push(url);
        const rows = typeof body === "function" ? body(urls.length, url) : body;
        const total = range || `0-${Math.max(0, rows.length - 1)}/${rows.length}`;
        return {
          ok: true,
          status: 200,
          headers: headersDe(total),
          text: async () => JSON.stringify(rows),
        };
      };
    },
  };
}

async function main() {
  const vazio = await adapter.obterPagamentosAtivosPorContratos([]);
  assert.deepStrictEqual(vazio, {});
  const statsVazio = { queries: 0 };
  await adapter.obterPagamentosRemovidosPorContratos(null, { stats: statsVazio, fetch: async () => { throw new Error("nao deveria consultar"); } });
  assert.strictEqual(statsVazio.queries, 0);

  await assert.rejects(() => adapter.obterPagamentosAtivos(""), (err) => err.reason === "contrato_obrigatorio" && err.fallback === false);
  await assert.rejects(() => adapter.obterPagamentosAtivosPorContratos(["*"]), (err) => err.status === 400 && err.fallback === false);

  const original = { data: "16/04/2025", valor: 10, protocoloLancamento: "", tipoMovimento: "PAGAMENTO" };
  const ativos = await adapter.obterPagamentosAtivos("2025041602", {
    fetch: fetchJson([{ numero_contrato: "2025041602", source_position: 1, payload: original }], 200, "0-0/1"),
  });
  assert.strictEqual(ativos.length, 1);
  assert.strictEqual(ativos[0].protocoloLancamento, "");
  assert.strictEqual(ativos[0].tipoMovimento, "PAGAMENTO");
  assert.ok(!Object.prototype.hasOwnProperty.call(ativos[0], "id"));
  assert.ok(!Object.prototype.hasOwnProperty.call(ativos[0], "migration_key"));
  assert.ok(!Object.prototype.hasOwnProperty.call(ativos[0], "source_position"));
  assert.deepStrictEqual(ativos[0], original);

  const tombstone = { data: "27/10/2026", valor: 1.02, protocoloLancamento: "20261028020219-030", tipoMovimento: "PAGAMENTO", createdAt: "1793163739095" };
  const removidos = await adapter.obterPagamentosRemovidos("2026102701", {
    fetch: fetchJson([
      { numero_contrato: "2026102701", source_position: 1, deleted_at: "2026-10-28T05:39:17.298+00:00", payload: tombstone },
    ], 200, "0-0/1"),
  });
  assert.strictEqual(removidos.length, 1);
  assert.strictEqual(removidos[0].removedAt, String(Date.parse("2026-10-28T05:39:17.298+00:00")));
  assert.ok(!Object.prototype.hasOwnProperty.call(tombstone, "removedAt"));
  const cru = Object.freeze({ valor: 1.02, protocoloLancamento: "20261028020219-030" });
  const projetado = adapter.projetarPayload({ payload: cru, deleted_at: "2026-10-28T05:39:17.298+00:00" }, true);
  assert.strictEqual(projetado.removedAt, String(Date.parse("2026-10-28T05:39:17.298+00:00")));
  assert.ok(!Object.prototype.hasOwnProperty.call(cru, "removedAt"));
  assert.strictEqual(removidos[0].valor, 1.02);
  assert.ok(!Object.prototype.hasOwnProperty.call(removidos[0], "version"));
  assert.ok(!Object.prototype.hasOwnProperty.call(removidos[0], "deleted_at"));

  const historico = { protocoloLancamento: "20260922171044-057", removedAt: "1790117195419", valor: 350 };
  const preservado = await adapter.obterPagamentosRemovidos("2026092201", {
    fetch: fetchJson([
      { numero_contrato: "2026092201", source_position: 1, deleted_at: "2026-01-01T00:00:00.000Z", payload: historico },
      { numero_contrato: "2026092201", source_position: 2, deleted_at: "2026-01-02T00:00:00.000Z", payload: { ...historico, data: "02/01/2026" } },
    ], 200, "0-1/2"),
  });
  assert.strictEqual(preservado.length, 2);
  assert.strictEqual(preservado[0].removedAt, "1790117195419");
  assert.deepStrictEqual(preservado[0], historico);

  const tipos = [
    { tipoMovimento: "DEVOLUCAO_INVESTIMENTO", valor: -30, data: "01/01/2026" },
    { tipoMovimento: "CAUCAO", valor: 500, data: "02/01/2026" },
    { tipoMovimento: "CREDITO_MANUTENCAO", valor: 40, data: "03/01/2026" },
    { valor: -15, data: "04/01/2026" },
    { valor: 350, data: "05/01/2026" },
  ];
  const lidosTipos = await adapter.obterPagamentosAtivos("2026060301", {
    fetch: fetchJson(tipos.map((payload, i) => ({ numero_contrato: "2026060301", source_position: i + 1, payload })), 200, "0-4/5"),
  });
  assert.deepStrictEqual(lidosTipos, tipos);

  const cap = captura();
  const paginas = await adapter.obterPagamentosAtivos("2025111403", {
    fetch: async (url) => {
      cap.urls.push(url);
      const primeira = cap.urls.length === 1;
      const rows = primeira
        ? Array.from({ length: adapter.PAGE_SIZE }, (_, i) => ({
            numero_contrato: "2025111403",
            source_position: i + 1,
            payload: { data: "01/01/2026", valor: 1, protocoloLancamento: String(i) },
          }))
        : [{ numero_contrato: "2025111403", source_position: adapter.PAGE_SIZE + 1, payload: { data: "02/01/2026", valor: 2, protocoloLancamento: "fim" } }];
      const range = primeira ? `0-${adapter.PAGE_SIZE - 1}/${adapter.PAGE_SIZE + 1}` : `${adapter.PAGE_SIZE}-${adapter.PAGE_SIZE}/${adapter.PAGE_SIZE + 1}`;
      return { ok: true, status: 200, headers: headersDe(range), text: async () => JSON.stringify(rows) };
    },
  });
  assert.strictEqual(paginas.length, adapter.PAGE_SIZE + 1);
  assert.strictEqual(cap.urls.length, 2);
  assert.ok(cap.urls.every((url) => url.includes("/rest/v1/dk_pagamento_locacao?")));
  assert.ok(cap.urls.every((url) => !/snapshot|redis|portalLancamentos|localStorage|quarentena|label/i.test(url)));

  const lote = captura();
  const stats = { queries: 0 };
  const mapa = await adapter.obterPagamentosAtivosPorContratos(["2025041602", "2025111403", "2026060301", "2026092201"], {
    stats,
    fetch: lote.fetch(() => [
      { numero_contrato: "2025111403", source_position: 1, payload: { valor: 350, data: "01/03/2026" } },
      { numero_contrato: "2025041602", source_position: 1, payload: { valor: 10, data: "16/04/2025", protocoloLancamento: "" } },
      { numero_contrato: "2026060301", source_position: 1, payload: { valor: 1, tipoMovimento: "CAUCAO" } },
    ]),
  });
  assert.strictEqual(stats.queries, 1);
  assert.strictEqual(lote.urls.length, 1);
  assert.ok(lote.urls[0].includes("numero_contrato=in.("));
  assert.ok(lote.urls[0].includes("removido=eq.false"));
  assert.strictEqual(mapa["2025041602"][0].protocoloLancamento, "");
  assert.strictEqual(mapa["2025111403"].length, 1);
  assert.strictEqual(mapa["2026060301"][0].tipoMovimento, "CAUCAO");
  assert.deepStrictEqual(mapa["2026092201"], []);

  const muitos = Array.from({ length: adapter.CHUNK_CONTRATOS + 1 }, (_, i) => `202600${String(i).padStart(4, "0")}`);
  const statsChunk = { queries: 0 };
  await adapter.obterPagamentosRemovidosPorContratos(muitos, {
    stats: statsChunk,
    fetch: fetchJson([], 200, "0--1/0"),
  });
  assert.strictEqual(statsChunk.queries, 2);

  await assert.rejects(
    () => adapter.obterPagamentosAtivos("2025111403", {
      fetch: async () => {
        const err = new Error("abort");
        err.name = "AbortError";
        throw err;
      },
    }),
    (err) => err.reason === "supabase_timeout" && err.fallback === false && !err.pagamentos
  );

  await assert.rejects(
    () => adapter.obterPagamentosAtivosPorContratos(["2025111403"], {
      fetch: async () => ({ ok: false, status: 500, headers: headersDe(""), text: async () => "{\"message\":\"fail\"}" }),
    }),
    (err) => err.reason === "postgres_indisponivel" && err.fallback === false
  );

  const caminho = adapter.caminho(["2025111403"], false, 0);
  assert.ok(caminho.path.startsWith("dk_pagamento_locacao?"));
  assert.ok(!caminho.path.includes("portalLancamentosAluguel"));
  assert.strictEqual(caminho.headers.Range, "0-999");

  console.log("adapter leitura ok");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
