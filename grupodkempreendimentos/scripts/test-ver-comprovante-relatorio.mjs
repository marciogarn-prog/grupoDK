/**
 * Testa que o Relatório 2 não usa href data: em «Ver comprovante» (evita about:blank).
 */
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const ui = readFileSync(path.join(root, "portal-locadora-ui.js"), "utf8");
const cc = readFileSync(path.join(root, "portal-comprovantes-cliente.js"), "utf8");
const cr = readFileSync(path.join(root, "cliente-relatorio-pagamentos.js"), "utf8");

let ok = 0;
let fail = 0;

function assert(name, cond) {
  if (cond) {
    ok++;
    console.log(`OK ${name}`);
  } else {
    fail++;
    console.error(`FAIL ${name}`);
  }
}

assert("portal usa data-dk-comprovante-id", ui.includes("data-dk-comprovante-id"));
assert("portal não liga data: no href do relatório", !ui.includes('href="${href}" target="_blank" rel="noopener noreferrer" class="lnk-comprovante"'));
assert("script postMessage/clique no PDF", ui.includes("__DK_openComprovanteClienteViewerById"));
assert("export viewer by id", cc.includes("window.__DK_openComprovanteClienteViewerById"));
assert("cliente relatorio usa id", cr.includes("data-dk-comprovante-id"));

console.log(`\n${ok} ok, ${fail} fail`);
process.exit(fail ? 1 : 0);
