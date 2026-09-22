/**
 * Caução no lançamento avulso (entra na receita; fora do aluguel do cliente).
 * node grupodkempreendimentos/scripts/test-janela-caucao.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
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
const protoSrc = readLocal("dk-lancamento-protocolo.js");

record("caixa caução no avulso", html.includes("Registrar pagamento de caução") && html.includes("operacaoLancAluguelConfirmarCaucaoBtn"));
record("saldos caução + total pago", html.includes("operacaoLancAluguelCaucaoPago") && html.includes("operacaoLancAluguelTotalPagoGeral") && html.includes("valor pago de aluguel"));
record("tipo CAUCAO no UI", ui.includes("PORTAL_LANC_TIPO_CAUCAO") && ui.includes("persistPortalLancamentoAluguelCaucao") && ui.includes("sumPortalLancamentosCaucaoTotal"));
record("caução fora do aluguel", ui.includes("if (portalLancamentoEhCaucao(x)) return a"));
record("histórico Caução", protoSrc.includes("portal-lanc-hist__tipo--caucao") && protoSrc.includes("Caução"));
record("css caução", css.includes("portal-lanc-dual-col--caucao") && css.includes("portal-lanc-aluguel-pagamento-saldo__foot--caucao"));

const failed = results.filter((r) => !r.ok);
if (failed.length) {
  console.error(`\n${failed.length} falha(s)`);
  process.exit(1);
}
console.log(`\n${results.length} checks OK`);
