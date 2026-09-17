import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const js = fs.readFileSync(path.join(root, "portal-locadora-ui.js"), "utf8");

const blocoDia = html.slice(
  html.indexOf('id="operacaoLancAluguelPaneRelDia"'),
  html.indexOf('id="operacaoLancAluguelPaneRelPeriodo"')
);
const blocoPeriodo = html.slice(
  html.indexOf('id="operacaoLancAluguelPaneRelPeriodo"'),
  html.indexOf('id="operacaoLancAluguelPaneRelInadimplentes"')
);

const checks = [
  ["relatório 2.1 mostra cabeçalho Placa", blocoDia.includes("<th>Placa</th>")],
  ["relatório 2.2 mostra cabeçalho Placa", blocoPeriodo.includes("<th>Placa</th>")],
  ["linhas agregadas guardam a placa", js.includes("placa,") && js.includes("prev.placa = placa")],
  [
    "impressão/PDF/Excel têm a coluna Placa",
    js.includes('const headers = ["Protocolo", "Nome do cliente", "Placa", colFaixa, "Valor total", "Saldo"]') &&
      js.includes("textColumns: [0, 1, 2]") &&
      js.includes("saldoColumnIndex: 5")
  ],
  [
    "tabela em tela renderiza seis colunas",
    js.includes('const placa = String(row[2] || "")') &&
      js.includes('colspan="6"') &&
      js.includes("portalEscapeHtml(placa)")
  ],
  [
    "cache do relatório atualizado",
    html.includes("portal-locadora-ui.js?v=20260916relplaca") &&
      html.includes("app.js?v=20260916relplaca")
  ],
];

for (const [label, ok] of checks) console.log(`${ok ? "OK" : "FALHOU"} — ${label}`);
if (checks.some(([, ok]) => !ok)) process.exitCode = 1;
else console.log(`Placa nos relatórios 2.1/2.2: ${checks.length}/${checks.length}`);
