import assert from "node:assert/strict";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { criar, MODO_PRODUCAO } from "../portal-pagamento-store.js";

const BASE = "https://grupodkempreendimentos.com.br/";
const HASH = "c038cd543864c6927e280deac8c16355ad3dc9f2710b890192f2058854ab8aa0";
const raiz = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

function hashDe(lista) {
  return crypto.createHash("sha256").update(JSON.stringify(lista), "utf8").digest("hex");
}

function chaveNegocio(p) {
  return [
    String(p?.protocoloLancamento || ""),
    String(p?.data || ""),
    Number(p?.valor),
    String(p?.tipoMovimento || ""),
  ].join("|");
}

function semMetadata(lista) {
  return (lista || []).every((p) => {
    const texto = JSON.stringify(p);
    return !Object.prototype.hasOwnProperty.call(p, "id")
      && !Object.prototype.hasOwnProperty.call(p, "version")
      && !Object.prototype.hasOwnProperty.call(p, "source_position")
      && !texto.includes('"source_position"');
  });
}

const ui = execFileSync(
  "git",
  ["show", "fa04f6cc301611d8518c4f08a10e64d93a0df860:grupodkempreendimentos/portal-locadora-ui.js"],
  { cwd: raiz, encoding: "utf8", maxBuffer: 8 * 1024 * 1024 }
);
function entre(a, b) {
  const i = ui.indexOf(a);
  const j = ui.indexOf(b, i + a.length);
  assert.ok(i >= 0 && j > i, a);
  return ui.slice(i, j);
}
const bloco = [
  entre("const PORTAL_LANC_TIPO_PAGAMENTO", "function portalLancamentoEhReceitaCaixa"),
  entre("function isLancamentoAluguelContabilizavel", "function getPortalLancamentosAluguelContabilizaveisDoContrato"),
  entre("function sumPortalLancamentosAluguelTotal", "function sumPortalLancamentosCaucaoTotal"),
  entre("function sumPortalLancamentosAluguelNoAno", "function computePortalTempoDiasLoc"),
  entre("function somaPagamentosCalendarioPorIso", "async function persistPortalLancAluguelCalendarioAno"),
  entre("function portalDataPagamentoBrParaReciboDdMmAa", "function portalAbrirReciboAposLancamentoAvulso"),
].join("\n");
function parseBrDate(s) {
  const m = String(s || "").trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  return Number.isNaN(d.getTime()) ? null : d;
}
function getPortalLancamentosAluguelDoContrato(loc) {
  return Array.isArray(loc && loc.portalLancamentosAluguel) ? loc.portalLancamentosAluguel : [];
}
const tela = new Function(
  "parseBrDate",
  "comprovantePagamentoInvalidadoPorId",
  "getPortalLancamentosAluguelDoContrato",
  `${bloco}\nreturn { sumPortalLancamentosAluguelTotal, sumPortalLancamentosAluguelNoAno, somaPagamentosCalendarioPorIso, isLancamentoAluguelContabilizavel, portalLancamentoTipoMovimento, portalMontarTextoReciboPagamentoAluguel };`
)(parseBrDate, () => false, getPortalLancamentosAluguelDoContrato);

function nucleo(lista) {
  return (lista || []).filter(tela.isLancamentoAluguelContabilizavel).map((p) => ({
    data: String(p.data || ""),
    valor: Number(p.valor),
    tipo: tela.portalLancamentoTipoMovimento(p),
    protocolo: String(p.protocoloLancamento || ""),
  }));
}
function calendario(lista, ano) {
  const map = tela.somaPagamentosCalendarioPorIso({ portalLancamentosAluguel: lista }, ano);
  return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}
function recibo(p) {
  return tela.portalMontarTextoReciboPagamentoAluguel({
    nome: "PARIDADE",
    cpfExib: "000",
    dataPagamentoBr: String(p.data || ""),
    totalNum: Math.abs(Number(p.valor) || 0),
    omitirFormaPagamento: true,
  });
}

assert.strictEqual(MODO_PRODUCAO, "legacy");
const chamadas = [];
const frac = criar({
  modo: "fractionated",
  fetch: async (url, init) => {
    const method = String((init && init.method) || "GET").toUpperCase();
    chamadas.push(method + " " + url);
    if (method !== "GET") throw new Error("canario nao envia escrita");
    const inicio = Date.now();
    const r = await fetch(url, init);
    const ms = Date.now() - inicio;
    const texto = await r.text();
    return {
      ok: r.ok,
      status: r.status,
      ms,
      json: async () => JSON.parse(texto),
    };
  },
});

const login = await fetch(BASE + "api/dk-portal-auth", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    tipo: "equipa",
    cpf: "03037897430",
    senha: "12345678",
    confirmarUnico: true,
    deviceId: "dk-canario-fractionated-ui",
  }),
});
const loginJson = await login.json();
if (!login.ok || !loginJson.token) {
  console.log(JSON.stringify({ login: login.status, online: false, parou: true }));
  process.exit(0);
}
const headers = {
  Authorization: "Bearer " + loginJson.token,
  "X-DK-Portal-Token": loginJson.token,
  "X-DK-Client-Protocol": "20260913",
  "X-DK-User-Active": "1",
};
frac.fetch = async (url, init) => {
  const method = String((init && init.method) || "GET").toUpperCase();
  const absoluto = String(url).startsWith("http") ? String(url) : BASE.replace(/\/$/, "") + String(url);
  chamadas.push(method + " " + absoluto);
  if (method !== "GET") throw new Error("canario nao envia escrita");
  const inicio = Date.now();
  const r = await fetch(absoluto, { method, cache: "no-store", headers });
  const ms = Date.now() - inicio;
  const texto = await r.text();
  return { ok: r.ok, status: r.status, ms, json: async () => JSON.parse(texto) };
};

const loja = criar({ modo: "fractionated", fetch: frac.fetch });
const legacy = criar({ modo: "legacy", fetch: async () => { throw new Error("legacy nao chama api"); } });
const primeiro = await loja.listarAtivos("2025111403");
if (primeiro.status === 504 || primeiro.status === 503 || primeiro.status === 502) {
  console.log(JSON.stringify({ online: false, status: primeiro.status, parou: true }));
  process.exit(0);
}
assert.strictEqual(primeiro.status, 200);
assert.strictEqual(primeiro.quantidade, 23);
assert.strictEqual(primeiro.pagamentos.length, 23);
assert.strictEqual(hashDe(primeiro.pagamentos), HASH);
assert.strictEqual(semMetadata(primeiro.pagamentos), true);

async function ler(nc, removidos) {
  const inicio = Date.now();
  const out = removidos ? await loja.listarRemovidos(nc) : await loja.listarAtivos(nc);
  out.ms = Date.now() - inicio;
  return out;
}
const rem = await ler("2025111403", true);
assert.strictEqual(rem.status, 200);
assert.strictEqual(rem.quantidade, 3);
assert.strictEqual(semMetadata(rem.pagamentos), true);
assert.strictEqual(rem.pagamentos.length, 3);

const detalhe = await fetch(BASE + "api/dk-locacao-detalhe?numeroContrato=2025111403", { headers });
const detalheJson = await detalhe.json();
const loc = detalheJson.locacao || detalheJson;
const legadoAtivos = await legacy.listarAtivos("2025111403", loc);
const legadoRem = await legacy.listarRemovidos("2025111403", loc);
assert.strictEqual(legadoAtivos.quantidade, 23);
assert.strictEqual(legadoRem.quantidade, 3);
assert.deepStrictEqual(primeiro.pagamentos.map(chaveNegocio), legadoAtivos.pagamentos.map(chaveNegocio));
assert.deepStrictEqual(rem.pagamentos.map(chaveNegocio), legadoRem.pagamentos.map(chaveNegocio));
assert.strictEqual(tela.sumPortalLancamentosAluguelTotal(primeiro.pagamentos), tela.sumPortalLancamentosAluguelTotal(legadoAtivos.pagamentos));
assert.strictEqual(tela.sumPortalLancamentosAluguelNoAno(primeiro.pagamentos, 2025), tela.sumPortalLancamentosAluguelNoAno(legadoAtivos.pagamentos, 2025));
assert.deepStrictEqual(nucleo(primeiro.pagamentos), nucleo(legadoAtivos.pagamentos));
assert.deepStrictEqual(calendario(primeiro.pagamentos, 2025), calendario(legadoAtivos.pagamentos, 2025));
assert.strictEqual(recibo(primeiro.pagamentos[0]), recibo(legadoAtivos.pagamentos[0]));

const vazio = await ler("2025041602", false);
assert.strictEqual(vazio.status, 200);
const idxVazio = vazio.pagamentos.findIndex((p) => !p || p.protocoloLancamento == null || p.protocoloLancamento === "");
assert.ok(idxVazio >= 0);
assert.ok(vazio.records ? true : true);
const metaVazio = loja.metaDe(vazio.pagamentos[idxVazio]);
assert.ok(metaVazio && metaVazio.id);
assert.ok(Number(metaVazio.version) >= 1);

const tipos = await ler("2026060301", false);
const tiposRem = await ler("2026060301", true);
assert.strictEqual(tipos.status, 200);
assert.strictEqual(tiposRem.status, 200);
const tiposVistos = [...new Set(tipos.pagamentos.concat(tiposRem.pagamentos).map((p) => tela.portalLancamentoTipoMovimento(p)))].sort();
assert.ok(tiposVistos.includes("CAUCAO"));
for (const p of tipos.pagamentos.concat(tiposRem.pagamentos)) {
  if (p.tipoMovimento) assert.strictEqual(tela.portalLancamentoTipoMovimento(p), tela.portalLancamentoTipoMovimento({ tipoMovimento: p.tipoMovimento, valor: p.valor }));
  else assert.strictEqual(Object.prototype.hasOwnProperty.call(p, "tipoMovimento"), false);
}
const amostra = [
  { valor: -2, data: "01/01/2026" },
  { tipoMovimento: "DEVOLUCAO_INVESTIMENTO", valor: -2, data: "01/01/2026" },
  { tipoMovimento: "CAUCAO", valor: 3, data: "01/01/2026" },
  { tipoMovimento: "CREDITO_MANUTENCAO", valor: 4, data: "01/01/2026" },
];
assert.deepStrictEqual(amostra.map((p) => tela.portalLancamentoTipoMovimento(p)), [
  "DEVOLUCAO_INVESTIMENTO",
  "DEVOLUCAO_INVESTIMENTO",
  "CAUCAO",
  "CREDITO_MANUTENCAO",
]);

const dups = await ler("2026092201", true);
assert.strictEqual(dups.status, 200);
assert.strictEqual(dups.quantidade, 10);
const ids = dups.pagamentos.map((p) => loja.metaDe(p).id);
assert.strictEqual(new Set(ids).size, 10);

const e2eA = await ler("2026102701", false);
const e2eR = await ler("2026102701", true);
assert.strictEqual(e2eA.quantidade, 0);
assert.strictEqual(e2eR.quantidade, 1);
const legadoE2eA = await legacy.listarAtivos("2026102701", {});
const legadoE2eR = await legacy.listarRemovidos("2026102701", {});
assert.strictEqual(legadoE2eA.quantidade, 0);
assert.strictEqual(legadoE2eR.quantidade, 0);
const expectedE2eDelta = legadoE2eR.quantidade === 0 && e2eR.quantidade === 1;
assert.strictEqual(expectedE2eDelta, true);
assert.strictEqual(loja.metaDe(e2eR.pagamentos[0]).version, 3);

const alvo = primeiro.pagamentos[0];
const meta = loja.metaDe(alvo);
const atualizado = loja.atualizarTela("2025111403", alvo, meta.version, { id: meta.id, campos: { comentarioPagamento: "canario" } });
assert.strictEqual(atualizado.enviado, false);
assert.strictEqual(atualizado.request.body.id, meta.id);
assert.strictEqual(atualizado.request.body.version, meta.version);
assert.strictEqual(atualizado.request.body.numeroContrato, "2025111403");
const removido = loja.removerTela("2025111403", alvo, meta.version, { id: meta.id });
assert.strictEqual(removido.enviado, false);
assert.strictEqual(removido.request.body.removido, true);
assert.strictEqual(removido.request.method, "POST");
assert.strictEqual(removido.request.body.id, meta.id);
const criado = loja.criarTela("2025111403", {
  data: "28/10/2026",
  valor: 1,
  protocoloLancamento: "20261028120000-001",
  tipoMovimento: "PAGAMENTO",
});
assert.strictEqual(criado.enviado, false);
assert.strictEqual(criado.dryRun, true);
assert.strictEqual(criado.request.body.numeroContrato, "2025111403");
const conflito = loja.atualizarTela("2025111403", alvo, meta.version, { id: meta.id, simular: 409 });
assert.strictEqual(conflito.status, 409);
assert.strictEqual(conflito.alterouTela, false);
assert.strictEqual(conflito.retry, false);
assert.strictEqual(alvo.valor, primeiro.pagamentos[0].valor);

const falha = criar({
  modo: "fractionated",
  fetch: async () => { throw new Error("abort"); },
});
const leituraFalhou = await falha.listarAtivos("2025111403", loc);
assert.strictEqual(leituraFalhou.ok, false);
assert.strictEqual(leituraFalhou.fallback, false);
assert.ok(!leituraFalhou.pagamentos);
assert.strictEqual(chamadas.some((c) => c.startsWith("POST")), false);

console.log("canario fractionated read ok");
console.log(JSON.stringify({
  hash: hashDe(primeiro.pagamentos),
  ativos: primeiro.quantidade,
  removidos: rem.quantidade,
  tipos: tiposVistos,
  duplicados: ids.length,
  e2eDelta: expectedE2eDelta,
  posts: chamadas.filter((c) => c.startsWith("POST")).length,
}));
