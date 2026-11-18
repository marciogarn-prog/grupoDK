#!/usr/bin/env node
/** Local de assinatura dos contratos = PETROLINA/PE (sede), não a cidade do cliente. */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const locacao = readFileSync(join(root, "portal-contrato-locacao.js"), "utf8");
const pacote = readFileSync(join(root, "portal-contrato-pacote.js"), "utf8");

let fails = 0;
function ok(cond, msg) {
  if (cond) console.log("PASS |", msg);
  else {
    console.error("FAIL |", msg);
    fails += 1;
  }
}

ok(/LOCAL_ASSINATURA_CONTRATO\s*=\s*"PETROLINA\/PE"/.test(locacao), "constante LOCAL_ASSINATURA_CONTRATO = PETROLINA/PE");
ok(
  /municipioDataLong\(inicioDt,\s*LOCAL_ASSINATURA_CONTRATO\)/.test(locacao),
  "montarDadosContrato usa LOCAL_ASSINATURA_CONTRATO na data de assinatura"
);
ok(
  /__DK_CONTRATO_LOCAL_ASSINATURA\s*=\s*LOCAL_ASSINATURA_CONTRATO/.test(locacao),
  "expõe __DK_CONTRATO_LOCAL_ASSINATURA"
);
ok(
  /_municipioUfIgnorado/.test(locacao) || /municipioUfIgnorado/.test(locacao),
  "municipioDataLong ignora município do cliente"
);
ok(/PETROLINA\/PE/.test(pacote) && /localAssinatura|__DK_CONTRATO_LOCAL_ASSINATURA/.test(pacote), "pacote/vistoria força Petrolina na dataLinha");
ok(!/municipioDataLong\(inicioDt,\s*p\.municipioUf\)/.test(locacao), "não usa mais p.municipioUf na assinatura");

if (fails) {
  console.error(`\n${fails} falha(s)`);
  process.exit(1);
}
console.log("\nOK contrato local assinatura = PETROLINA/PE");
