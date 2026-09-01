/**
 * Janela Pagamento de caução no Cadastro de locação.
 * node grupodkempreendimentos/scripts/test-janela-caucao.mjs
 */
import fs from "fs";
import path from "path";
import { createRequire } from "module";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const results = [];

function record(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} | ${name}${detail ? ` | ${detail}` : ""}`);
}

function readLocal(rel) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

const html = readLocal("index.html");
const ui = readLocal("portal-locadora-ui.js");
const css = readLocal("styles.css");
const mergeSrc = readLocal("lib/dk-append-only-merge.cjs");
const protoSrc = readLocal("dk-lancamento-protocolo.js");

record("botao cadastro", html.includes('id="operacaoLocacaoCaucaoBtn"') && html.includes("Pagamento de caução"));
record("modal html", html.includes('id="portalCaucaoModal"') && html.includes("portalCaucaoConfirmarBtn"));
record("campos data valor", html.includes('id="portalCaucaoData"') && html.includes('id="portalCaucaoValor"'));
record("lista historico", html.includes('id="portalCaucaoLista"'));
record("css janela", css.includes("portal-modal__card--caucao") && css.includes("portal-caucao-lista"));
record("abrir/persistir", ui.includes("function abrirPortalCaucaoModal") && ui.includes("function persistPortalLancamentoCaucao"));
record("grava portalLancamentosCaucao", ui.includes("loc.portalLancamentosCaucao") && ui.includes('tipoMovimento: "CAUCAO"'));
record("preserva no save", ui.includes("portalLancamentosCaucao: prev.portalLancamentosCaucao"));
record("merge nuvem cjs", mergeSrc.includes("portalLancamentosCaucao"));
record("merge protocolo js", protoSrc.includes("portalLancamentosCaucao"));
record("cache pwa", html.includes("20260901janela-caucao"));
record("mascara valor", ui.includes('"portalCaucaoValor"'));

const merge = require(path.join(ROOT, "lib/dk-append-only-merge.cjs"));
const a = [{ numeroContrato: "2026070801", placa: "UHY7B16", cpf: "35287865821", nome: "A", inicio: "08/07/2026" }];
const b = [
  {
    numeroContrato: "2026070801",
    placa: "UHY7B16",
    cpf: "35287865821",
    nome: "A",
    inicio: "08/07/2026",
    updatedAt: Date.now(),
    portalLancamentosCaucao: [{ data: "01/09/2026", valor: 500, createdAt: 1, protocoloLancamento: "c1", tipoMovimento: "CAUCAO" }],
  },
];
const out = merge.mergeLocacoesCadastro(a, b);
const hit = out.find((l) => String(l.numeroContrato) === "2026070801");
record(
  "merge nao perde caução",
  Array.isArray(hit?.portalLancamentosCaucao) && hit.portalLancamentosCaucao.some((x) => Number(x.valor) === 500),
  `n=${hit?.portalLancamentosCaucao?.length || 0}`
);
const alug = Array.isArray(hit?.portalLancamentosAluguel) ? hit.portalLancamentosAluguel : [];
record(
  "caucao fora do aluguel",
  !alug.some((x) => String(x?.tipoMovimento || "").toUpperCase() === "CAUCAO"),
  `aluguel=${alug.length}`
);

const failed = results.filter((r) => !r.ok);
if (failed.length) {
  console.error(`\n${failed.length} falha(s)`);
  process.exit(1);
}
console.log(`\n${results.length} checks OK`);
