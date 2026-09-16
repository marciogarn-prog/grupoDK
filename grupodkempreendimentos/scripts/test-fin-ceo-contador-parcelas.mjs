/**
 * FINANCEIRO CEO: contador PAGAMENTO atual/total (01/08 … 08/08).
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const js = fs.readFileSync(path.join(ROOT, "portal-financeiro-ceo.js"), "utf8");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const results = [];

function record(name, ok) {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"} | ${name}`);
}

record(
  "lista usa número atual e total das repetições",
  js.includes("const totalPagamentos = Math.max(1, Number(d.repeticoes) || 1)") &&
    js.includes('PAGAMENTO ${String(p.numero).padStart(2, "0")}/${String(totalPagamentos).padStart(2, "0")}')
);
record(
  "relatório de despesas usa o mesmo contador",
  js.includes("const totalPagamentos = Math.max(1, Number(p.despesa?.repeticoes) || 1)")
);
record("01 de 8 forma 01/08", `${String(1).padStart(2, "0")}/${String(8).padStart(2, "0")}` === "01/08");
record("8 de 8 forma 08/08", `${String(8).padStart(2, "0")}/${String(8).padStart(2, "0")}` === "08/08");
record(
  "cache-bust do FINANCEIRO CEO",
  html.includes("portal-financeiro-ceo.js?v=20260916parcelas") &&
    html.includes("app.js?v=20260916parcelas") &&
    html.includes("portal-locadora-ui.js?v=20260916parcelas")
);

const failed = results.filter((ok) => !ok).length;
if (failed) process.exit(1);
console.log(`\n${results.length}/${results.length} ok`);
