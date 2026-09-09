/**
 * PAGAMENTOS DO DIA inclui a DATA DO PAGAMENTO entre valor e hora.
 * node grupodkempreendimentos/scripts/test-lanc-pagamentos-do-dia-data.mjs
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

const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const ui = fs.readFileSync(path.join(ROOT, "portal-locadora-ui.js"), "utf8");

const head = html.match(/id="operacaoLancAluguelDiaLogTable"[\s\S]*?<\/thead>/);
const headTxt = head ? head[0] : "";
record("tabela do dia tem DATA DO PAGAMENTO", headTxt.includes("<th>DATA DO PAGAMENTO</th>"));
record(
  "DATA DO PAGAMENTO entre valor e hora",
  /VALOR REGISTRADO<\/th>\s*<th>DATA DO PAGAMENTO<\/th>\s*<th>HORA DO REGISTRO<\/th>/.test(headTxt)
);
record("grava dataPagamento no confirmar", ui.includes("dataPagamento: dataStr"));
record("render mostra dataPagamento", ui.includes("row.dataPagamento"));
record("colspan 6 no vazio", ui.includes('colspan="6"') && html.includes('colspan="6"'));

const pass = results.filter((r) => r.ok).length;
console.log(`\n--- ${pass}/${results.length} pagamentos do dia com data ---`);
process.exit(pass === results.length ? 0 : 1);
