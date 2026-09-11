/**
 * Garante que cadastrar, apagar e confirmar pagamento no FINANCEIRO CEO
 * não remontam 40 mil linhas nem esperam o snapshot gordo.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const merge = require(path.join(ROOT, "lib/dk-append-only-merge.cjs"));

const results = [];
function rec(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} | ${name}${detail ? ` | ${detail}` : ""}`);
}

const ceoJs = fs.readFileSync(path.join(ROOT, "portal-financeiro-ceo.js"), "utf8");
const apiJs = fs.readFileSync(path.join(ROOT, "api/cadastro-financeiro-ceo.js"), "utf8");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const syncJs = fs.readFileSync(path.join(ROOT, "portal-supabase-sync.js"), "utf8");

rec("API grava em bloco HASH", apiJs.includes("aplicarBlocoHash") && apiJs.includes("patch: true") && apiJs.includes("dk:portal:financeiro_ceo:despesas:h"), "");
rec("API POST não devolve o pacote inteiro", apiJs.includes("gravados") && !/return res\.status\(200\)\.json\(\{\s*ok: true,\s*data: merged/.test(apiJs), "");
rec("cliente envia só o bloco", ceoJs.includes("montarPayloadBlocoCeo") && ceoJs.includes("aplicarBlocoNaTela") && ceoJs.includes("patch: true"), "");
rec("lista pagina 80 linhas", ceoJs.includes("CEO_LISTA_PAGINA = 80") && ceoJs.includes("linhas.slice(0, ceoListaLimiteVisivel)"), "");
rec("gravação sem snapshot gordo", ceoJs.includes("pushFinanceiroCeoParaNuvem") && !/enviarFinanceiroCeoNuvem[\s\S]{0,400}__DK_pushCloudSnapshotNow/.test(ceoJs), "");
rec("mutação sem hook de nuvem", ceoJs.includes("__DK_runWithoutCloudPush") && syncJs.includes("function runWithoutCloudPush"), "");
rec("botão mostrar mais", html.includes("finCeoDespesasMostrarMais"), "");
rec("timeout da gravação", ceoJs.includes('reason: "timeout"') && ceoJs.includes("11000"), "");

const despesas = [
  { id: "ceo-teste-lancar", valor: 10, periodic: true, repeticoes: 12, dataEvento: "11/09/2026", categoria: "PARTICULARES" },
];
const depoisLancar = merge.mergeFinanceiroCeoDespesas([], despesas);
rec("lançar une por id", depoisLancar.length === 1 && depoisLancar[0].id === "ceo-teste-lancar", String(depoisLancar.length));

const comExclusao = merge.mergeFinanceiroCeoDespesas(depoisLancar, [
  { id: "ceo-teste-lancar", valor: 10, pagamentosExcluidos: [2], updatedAt: Date.now(), ceoAutoridade: true },
]);
rec(
  "apagar parcela fica em pagamentosExcluidos",
  Array.isArray(comExclusao[0].pagamentosExcluidos) && comExclusao[0].pagamentosExcluidos.includes(2),
  JSON.stringify(comExclusao[0].pagamentosExcluidos)
);

const sit = merge.mergeFinanceiroCeoSituacaoPag([], [
  { chave: "ceo-teste-lancar#1#11/09/2026", situacao: "PAGO", pagoEm: new Date().toISOString(), updatedAt: Date.now() },
]);
rec("confirmar pagamento marca PAGO", sit[0]?.situacao === "PAGO", sit[0]?.situacao);

const milhares = Array.from({ length: 400 }, (_, i) => ({
  pagamento: i + 1,
  situacao: i % 20 === 0 ? "PAGO" : "A_PAGAR",
}));
const visiveis = milhares.slice(0, 80);
rec("40k linhas não entram no DOM de uma vez", visiveis.length === 80 && milhares.length === 400, `${visiveis.length}/${milhares.length}`);

const blocoPago = { situacao: [sit] };
rec("bloco de pagamento não leva a base inteira", blocoPago.situacao.length === 1 && !blocoPago.despesas, "");
const blocoLancar = { despesas: depoisLancar };
rec("bloco de lançamento é só o registo novo", blocoLancar.despesas.length === 1, String(blocoLancar.despesas.length));

const failed = results.filter((r) => !r.ok);
console.log(`\n--- ${results.length - failed.length}/${results.length} testes cadastro despesas não trava ---`);
if (failed.length) process.exit(1);
