import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const root = path.resolve(import.meta.dirname, "..");
const js = fs.readFileSync(path.join(root, "portal-locadora-ui.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const nome = "computePortalRelClienteSaldoPositivoPlano";
const trecho = js.match(
  /function computePortalRelClienteSaldoPositivoPlano\(pago, devidoPlano\) \{[\s\S]*?\r?\n  \}/
);

if (!trecho) {
  throw new Error(`Função ${nome} não encontrada.`);
}

const fonte = trecho[0];
const contexto = {};
vm.runInNewContext(`${fonte}\nresultado = ${nome}(17850, 17600);`, contexto);

const checks = [
  ["R$ 17.850,00 − R$ 17.600,00 = R$ 250,00", contexto.resultado === 250],
  [
    "Resumo usa o saldo pago menos devido do plano",
    js.includes("saldoSemanas = computePortalRelClienteSaldoPositivoPlano(pagoNum, devidoPlano)")
  ],
  [
    "Saldo aparece na tela, impressão e PDF",
    (js.match(/fmt\(r\.saldoSemanas\)/g) || []).length === 3
  ],
  [
    "Cache do relatório foi atualizado",
    html.includes("portal-locadora-ui.js?v=20260916saldopositivo") &&
      html.includes("app.js?v=20260916saldopositivo")
  ],
];

for (const [label, ok] of checks) {
  console.log(`${ok ? "OK" : "FALHOU"} — ${label}`);
}

if (checks.some(([, ok]) => !ok)) process.exitCode = 1;
else console.log(`Saldo positivo relatório 2.5: ${checks.length}/${checks.length}`);
