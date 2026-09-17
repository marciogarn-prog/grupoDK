import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const js = fs.readFileSync(path.join(root, "portal-locadora-ui.js"), "utf8");

const checks = [
  ["botão existe", html.includes('id="operacaoLocacaoEnviarNuvemBtn"')],
  [
    "botão tem evento de clique",
    js.includes('document.getElementById("operacaoLocacaoEnviarNuvemBtn")?.addEventListener("click", async')
  ],
  [
    "protocolo precisa estar guardado",
    js.includes("findPortalLocacaoByProtocolo(nc)") &&
      js.includes("ainda não está guardado neste PC")
  ],
  [
    "envio verifica a locação na nuvem",
    js.includes('verifyKind: "locacao"') &&
      js.includes("verifyValue: nc")
  ],
  [
    "operador recebe andamento e confirmação",
    js.includes('btn.textContent = "Enviando…"') &&
      js.includes("confirmado na nuvem") &&
      js.includes('btn.textContent = ok ? "Enviado ✓" : "Enviar para nuvem"')
  ],
  [
    "cache atualizado",
    /app\.js\?v=[^"'<>]+/.test(html) &&
      /portal-locadora-ui\.js\?v=[^"'<>]+/.test(html)
  ],
];

for (const [label, ok] of checks) console.log(`${ok ? "OK" : "FALHOU"} — ${label}`);
if (checks.some(([, ok]) => !ok)) process.exitCode = 1;
else console.log(`Enviar locação para nuvem: ${checks.length}/${checks.length}`);
