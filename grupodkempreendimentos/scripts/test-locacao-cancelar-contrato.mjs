import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const js = fs.readFileSync(path.join(root, "portal-locadora-ui.js"), "utf8");

const checks = [
  ["botão e modal existem", html.includes('id="operacaoLocacaoCancelarBtn"') && html.includes('id="portalLocacaoConfirmModal"')],
  [
    "clique usa delegação resistente à recriação da tela",
    js.includes("function onOperacaoLocacaoCancelarClick(e)") &&
      js.includes('e.target.closest("#operacaoLocacaoCancelarBtn")') &&
      js.includes('"click",') &&
      js.includes("true")
  ],
  [
    "retorno aparece antes das validações",
    js.includes('portalLocacaoFeedback("Preparando o cancelamento do contrato…")')
  ],
  [
    "erro inesperado aparece ao operador",
    js.includes("Não foi possível abrir o cancelamento:") &&
      js.includes('console.error("[DK portal] cancelar contrato"')
  ],
  [
    "confirmação identifica o protocolo",
    js.includes("Revise os dados do protocolo ${ncNorm} e confirme o cancelamento") &&
      js.includes('titulo: "Confirmar cancelamento do contrato"')
  ],
  [
    "cache atualizado",
    html.includes("app.js?v=20260917cancelarcontrato") &&
      html.includes("portal-locadora-ui.js?v=20260917cancelarcontrato")
  ],
];

for (const [label, ok] of checks) console.log(`${ok ? "OK" : "FALHOU"} — ${label}`);
if (checks.some(([, ok]) => !ok)) process.exitCode = 1;
else console.log(`Cancelar contrato: ${checks.length}/${checks.length}`);
