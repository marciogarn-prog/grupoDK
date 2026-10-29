/**
 * Camada de pagamentos: legacy ativo, fractionated só em simulação.
 */
import { createRequire } from "module";
import assert from "assert";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const require = createRequire(import.meta.url);
const { criar, MODO_PRODUCAO } = require("../portal-pagamento-store.js");

function hashDe(lista) {
  return crypto.createHash("sha256").update(JSON.stringify(lista), "utf8").digest("hex");
}

function resposta(body, status = 200) {
  return {
    status,
    json: async () => body,
  };
}

function ativosDe(lista) {
  return resposta({ ok: true, pagamentos: lista, quantidade: lista.length, fallback: false });
}

function removidosDe(lista, registros) {
  return resposta({
    ok: true,
    pagamentos: lista,
    quantidade: lista.length,
    registros,
    removido: true,
    fallback: false,
  });
}

const vinteTres = Array.from({ length: 23 }, (_, i) => ({
  data: "01/03/2026",
  valor: 350 + i,
  protocoloLancamento: `202603010101${String(i).padStart(2, "0")}-057`,
  tipoMovimento: "PAGAMENTO",
}));
const tresRemovidos = [
  { data: "02/03/2026", valor: 100, protocoloLancamento: "20260302010101-001", removedAt: "1" },
  { data: "03/03/2026", valor: 100, protocoloLancamento: "20260303010101-002", removedAt: "2" },
  { data: "04/03/2026", valor: 100, protocoloLancamento: "20260304010101-003", removedAt: "3" },
];
const semProtocolo = { data: "16/04/2025", valor: 10, protocoloLancamento: "" };
const tipos = [
  { tipoMovimento: "DEVOLUCAO_INVESTIMENTO", valor: -30, data: "01/01/2026" },
  { tipoMovimento: "CAUCAO", valor: 500, data: "02/01/2026" },
  { tipoMovimento: "CREDITO_MANUTENCAO", valor: 40, data: "03/01/2026" },
  { valor: -15, data: "04/01/2026" },
  { valor: 350, data: "05/01/2026" },
];
const duplicados = [
  { protocoloLancamento: "20260922171044-057", removedAt: "1790117195419", valor: 350, data: "01/09/2026" },
  { protocoloLancamento: "20260922171044-057", removedAt: "1790117195419", valor: 350, data: "02/09/2026" },
];
const tombstone = {
  data: "27/10/2026",
  valor: 1.02,
  protocoloLancamento: "20261028020219-030",
  tipoMovimento: "PAGAMENTO",
};

function lojaFractionated(rotas) {
  const chamadas = [];
  const loja = criar({
    modo: "fractionated",
    fetch: async (url, init) => {
      chamadas.push({ url: String(url), method: init && init.method });
      const rota = rotas[String(url)] || rotas["*"];
      if (!rota) throw new Error("sem rota");
      if (rota instanceof Error) throw rota;
      return rota;
    },
  });
  return { loja, chamadas };
}

const legacy = criar({ modo: "legacy", fetch: async () => { throw new Error("legacy nao chama api"); } });
assert.strictEqual(MODO_PRODUCAO, "legacy");
assert.strictEqual(legacy.modo, "legacy");
const legadoAtivos = await legacy.listarAtivos("2025111403", { portalLancamentosAluguel: vinteTres });
const legadoRemovidos = await legacy.listarRemovidos("2025111403", { portalLancamentosAluguelRemovidos: tresRemovidos });
assert.strictEqual(legadoAtivos.quantidade, 23);
assert.strictEqual(legadoRemovidos.quantidade, 3);
assert.strictEqual(legadoAtivos.pagamentos[0].protocoloLancamento, vinteTres[0].protocoloLancamento);

const frac = lojaFractionated({
  "/api/dk-pagamento-locacao?numeroContrato=2025111403": ativosDe(vinteTres),
  "/api/dk-pagamento-locacao?numeroContrato=2025111403&scope=removidos": removidosDe(tresRemovidos, []),
});
const frAtivos = await frac.loja.listarAtivos("2025111403", { portalLancamentosAluguel: [{ valor: 999 }] });
const frRemovidos = await frac.loja.listarRemovidos("2025111403", { portalLancamentosAluguelRemovidos: [] });
assert.strictEqual(frAtivos.quantidade, 23);
assert.strictEqual(frRemovidos.quantidade, 3);
assert.strictEqual(hashDe(legadoAtivos.pagamentos), hashDe(frAtivos.pagamentos));
assert.strictEqual(hashDe(legadoRemovidos.pagamentos), hashDe(frRemovidos.pagamentos));
assert.strictEqual(frAtivos.pagamentos[0].valor, 350);
assert.ok(!Object.prototype.hasOwnProperty.call(frAtivos.pagamentos[0], "id"));
assert.ok(!Object.prototype.hasOwnProperty.call(frAtivos.pagamentos[0], "version"));

const records23 = vinteTres.map((_, i) => ({
  id: `11111111-1111-4111-8111-${String(i).padStart(12, "0")}`,
  version: 1 + (i % 3),
  source_position: i + 1,
}));
const comRecords = lojaFractionated({
  "/api/dk-pagamento-locacao?numeroContrato=2025111403": resposta({
    ok: true,
    pagamentos: vinteTres,
    records: records23,
    quantidade: 23,
    fallback: false,
  }),
});
const lidosRecords = await comRecords.loja.listarAtivos("2025111403");
assert.strictEqual(lidosRecords.quantidade, 23);
assert.strictEqual(hashDe(lidosRecords.pagamentos), hashDe(vinteTres));
assert.strictEqual(lidosRecords.pagamentos.filter((_, i) => comRecords.loja.metaDe(lidosRecords.pagamentos[i])).length, 23);
for (let i = 0; i < 23; i++) {
  const meta = comRecords.loja.metaDe(lidosRecords.pagamentos[i]);
  assert.strictEqual(meta.id, records23[i].id);
  assert.strictEqual(meta.version, records23[i].version);
  assert.strictEqual(meta.source_position, records23[i].source_position);
  assert.strictEqual(JSON.stringify(lidosRecords.pagamentos[i]).includes(records23[i].id), false);
}
const dryMeta = await comRecords.loja.atualizar("2025111403", lidosRecords.pagamentos[0], records23[0].version, {
  campos: { valor: 351 },
});
assert.strictEqual(dryMeta.enviado, false);
assert.strictEqual(dryMeta.request.body.id, records23[0].id);
assert.strictEqual(dryMeta.request.body.version, records23[0].version);
const dryRemove = await comRecords.loja.remover("2025111403", lidosRecords.pagamentos[1], records23[1].version);
assert.strictEqual(dryRemove.enviado, false);
assert.strictEqual(dryRemove.request.body.removido, true);
assert.strictEqual(dryRemove.request.body.id, records23[1].id);
assert.ok(!comRecords.chamadas.some((c) => c.method === "POST"));
const soPagamentos = lojaFractionated({
  "/api/dk-pagamento-locacao?numeroContrato=2025111403": ativosDe(vinteTres),
});
const legadoSo = await soPagamentos.loja.listarAtivos("2025111403");
assert.strictEqual(legadoSo.quantidade, 23);
assert.strictEqual(hashDe(legadoSo.pagamentos), hashDe(lidosRecords.pagamentos));

const vazioLegado = await legacy.listarAtivos("2025041602", { portalLancamentosAluguel: [semProtocolo] });
const vazioFrac = lojaFractionated({
  "/api/dk-pagamento-locacao?numeroContrato=2025041602": resposta({
    ok: true,
    pagamentos: [semProtocolo],
    records: [{ id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", version: 1, source_position: 4 }],
    quantidade: 1,
    fallback: false,
  }),
});
const lidoVazio = await vazioFrac.loja.listarAtivos("2025041602");
assert.strictEqual(lidoVazio.pagamentos[0].protocoloLancamento, "");
assert.strictEqual(vazioLegado.pagamentos[0].protocoloLancamento, "");
assert.strictEqual(hashDe(vazioLegado.pagamentos), hashDe(lidoVazio.pagamentos));
assert.strictEqual(vazioFrac.loja.metaDe(lidoVazio.pagamentos[0]).id, "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");
assert.strictEqual(vazioFrac.loja.metaDe(lidoVazio.pagamentos[0]).version, 1);
assert.strictEqual(JSON.stringify(lidoVazio.pagamentos[0]).includes("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"), false);

const tiposLoja = lojaFractionated({
  "/api/dk-pagamento-locacao?numeroContrato=2026060301": ativosDe(tipos),
});
const lidosTipos = await tiposLoja.loja.listarAtivos("2026060301");
assert.deepStrictEqual(lidosTipos.pagamentos, tipos);
assert.strictEqual(lidosTipos.pagamentos[0].tipoMovimento, "DEVOLUCAO_INVESTIMENTO");
assert.strictEqual(lidosTipos.pagamentos[3].valor, -15);
assert.ok(!lidosTipos.pagamentos[3].tipoMovimento);

const dupLoja = lojaFractionated({
  "/api/dk-pagamento-locacao?numeroContrato=2026092201&scope=removidos": removidosDe(duplicados, [
    { id: "a", version: 1, protocolo: duplicados[0].protocoloLancamento },
    { id: "b", version: 1, protocolo: duplicados[1].protocoloLancamento },
  ]),
});
const lidosDup = await dupLoja.loja.listarRemovidos("2026092201");
assert.strictEqual(lidosDup.quantidade, 2);
assert.strictEqual(lidosDup.pagamentos[0].data, "01/09/2026");
assert.strictEqual(lidosDup.pagamentos[1].data, "02/09/2026");
assert.ok(!Object.prototype.hasOwnProperty.call(lidosDup.pagamentos[0], "id"));
assert.strictEqual(dupLoja.loja.metaDe(lidosDup.pagamentos[0]).id, "a");
assert.strictEqual(dupLoja.loja.metaDe(lidosDup.pagamentos[1]).id, "b");

const e2eLegadoAtivos = await legacy.listarAtivos("2026102701", {});
const e2eLegadoRem = await legacy.listarRemovidos("2026102701", {});
const e2e = lojaFractionated({
  "/api/dk-pagamento-locacao?numeroContrato=2026102701": ativosDe([]),
  "/api/dk-pagamento-locacao?numeroContrato=2026102701&scope=removidos": removidosDe([tombstone], [
    { id: "e14c3cc2-ed23-409c-8e60-2cdfb65c6de9", version: 3, protocolo: tombstone.protocoloLancamento },
  ]),
});
const e2eAtivos = await e2e.loja.listarAtivos("2026102701", { portalLancamentosAluguel: [{ valor: 39 }] });
const e2eRem = await e2e.loja.listarRemovidos("2026102701");
assert.strictEqual(e2eLegadoAtivos.quantidade, 0);
assert.strictEqual(e2eLegadoRem.quantidade, 0);
assert.strictEqual(e2eAtivos.quantidade, 0);
assert.strictEqual(e2eRem.quantidade, 1);
assert.notStrictEqual(e2eLegadoRem.quantidade, e2eRem.quantidade);
const expectedE2eDelta = e2eLegadoRem.quantidade === 0 && e2eRem.quantidade === 1;
assert.strictEqual(expectedE2eDelta, true);
assert.strictEqual(e2e.loja.metaDe(e2eRem.pagamentos[0]).id, "e14c3cc2-ed23-409c-8e60-2cdfb65c6de9");
assert.strictEqual(e2e.loja.metaDe(e2eRem.pagamentos[0]).version, 3);
assert.ok(!Object.prototype.hasOwnProperty.call(e2eRem.pagamentos[0], "version"));

const ficticio = {
  data: "28/10/2026",
  valor: 12,
  protocoloLancamento: "20261028090000-001",
  tipoMovimento: "PAGAMENTO",
  createdAt: 1790000000000,
};
const criado = await e2e.loja.criar("2026102701", ficticio);
assert.strictEqual(criado.enviado, false);
assert.strictEqual(criado.dryRun, true);
assert.strictEqual(criado.request.method, "POST");
assert.strictEqual(criado.request.url, "/api/dk-pagamento-locacao");
assert.strictEqual(criado.request.body.numeroContrato, "2026102701");
assert.strictEqual(criado.request.body.protocoloLancamento, ficticio.protocoloLancamento);
assert.strictEqual(criado.request.body.valor, 12);
assert.ok(criado.bytes > 40);
assert.ok(criado.bytes < 800);
assert.ok(!e2e.chamadas.some((c) => c.method === "POST"));

const atualizado = await e2e.loja.atualizar("2026102701", e2eRem.pagamentos[0], 3, {
  campos: { valor: 2 },
});
assert.strictEqual(atualizado.enviado, false);
assert.strictEqual(atualizado.request.body.id, "e14c3cc2-ed23-409c-8e60-2cdfb65c6de9");
assert.strictEqual(atualizado.request.body.version, 3);
assert.strictEqual(atualizado.request.body.campos.valor, 2);
assert.ok(atualizado.bytes > 40);

const removido = await e2e.loja.remover("2026102701", e2eRem.pagamentos[0], 3);
assert.strictEqual(removido.enviado, false);
assert.strictEqual(removido.request.body.removido, true);
assert.strictEqual(removido.request.method, "POST");
assert.ok(!String(removido.request.method).includes("DELETE"));
assert.strictEqual(removido.request.body.id, "e14c3cc2-ed23-409c-8e60-2cdfb65c6de9");

const conflito = await e2e.loja.atualizar("2026102701", e2eRem.pagamentos[0], 2, { simular: 409 });
assert.strictEqual(conflito.status, 409);
assert.strictEqual(conflito.alterouTela, false);
assert.strictEqual(conflito.retry, false);
assert.strictEqual(e2eRem.pagamentos[0].valor, 1.02);

const duplicado = await e2e.loja.criar("2025111403", vinteTres[0], { existentes: vinteTres });
assert.strictEqual(duplicado.status, 409);
assert.strictEqual(duplicado.reason, "duplicate_payment_same_day_value");
assert.strictEqual(duplicado.enviado, false);
assert.strictEqual(vinteTres.length, 23);

const falha = lojaFractionated({ "*": new Error("abort") });
const leituraFalhou = await falha.loja.listarAtivos("2025111403", { portalLancamentosAluguel: vinteTres });
assert.strictEqual(leituraFalhou.ok, false);
assert.strictEqual(leituraFalhou.fallback, false);
assert.ok(!leituraFalhou.pagamentos);
const escritaFalhou = await falha.loja.criar("2025111403", ficticio, { simular: 503 });
assert.strictEqual(escritaFalhou.ok, false);
assert.strictEqual(escritaFalhou.fallback, false);
assert.strictEqual(escritaFalhou.enviado, false);

const soma = (lista) =>
  lista.reduce((total, item) => {
    if (String(item.tipoMovimento || "").toUpperCase().includes("CAUC")) return total;
    return total + Number(item.valor || 0);
  }, 0);
assert.strictEqual(soma(legadoAtivos.pagamentos), soma(frAtivos.pagamentos));
assert.deepStrictEqual(
  legadoAtivos.pagamentos.map((item) => item.protocoloLancamento),
  frAtivos.pagamentos.map((item) => item.protocoloLancamento)
);

const fonte = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "portal-pagamento-store.js"), "utf8");
const html = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "index.html"), "utf8");
assert.strictEqual(fonte.includes("localStorage"), false);
assert.strictEqual(fonte.includes('const MODO_PRODUCAO = "legacy"'), true);
assert.strictEqual(html.includes("portal-pagamento-store.js?v=20261028canario"), true);
assert.strictEqual(html.includes('app.js?v=20261029logdk5'), true);

let legadoExecutou = 0;
const telaLegado = legacy.criarTela("2025111403", null, {
  executar() {
    legadoExecutou += 1;
    return { ok: true, entry: { valor: 7 } };
  },
});
assert.strictEqual(legadoExecutou, 1);
assert.strictEqual(telaLegado.entry.valor, 7);
let fracExecutou = 0;
const telaFrac = e2e.loja.criarTela("2026102701", ficticio, {
  executar() {
    fracExecutou += 1;
    return { ok: true };
  },
});
assert.strictEqual(fracExecutou, 0);
assert.strictEqual(telaFrac.enviado, false);
assert.strictEqual(telaFrac.dryRun, true);
assert.strictEqual(telaFrac.request.method, "POST");
assert.ok(!e2e.chamadas.some((c) => c.method === "POST"));
const lidosTela = legacy.lerAtivosTela({ portalLancamentosAluguel: vinteTres }, (loc) => loc.portalLancamentosAluguel);
assert.strictEqual(lidosTela.length, 23);
assert.strictEqual(e2e.loja.lerAtivosTela({ portalLancamentosAluguel: vinteTres }, () => vinteTres).length, 0);
assert.strictEqual(legacy.lerRemovidosTela({ portalLancamentosAluguelRemovidos: tresRemovidos }, (loc) => loc.portalLancamentosAluguelRemovidos).length, 3);
assert.strictEqual(e2e.loja.lerRemovidosTela({ portalLancamentosAluguelRemovidos: tresRemovidos }, () => tresRemovidos).length, 0);

console.log("pagamento store ok");
console.log(JSON.stringify({
  hash2025111403: hashDe(frAtivos.pagamentos),
  hashRemovidos: hashDe(frRemovidos.pagamentos),
  createBytes: criado.bytes,
  updateBytes: atualizado.bytes,
  removeBytes: removido.bytes,
}));
