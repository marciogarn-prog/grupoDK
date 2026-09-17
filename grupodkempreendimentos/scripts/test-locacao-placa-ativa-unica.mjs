import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const js = fs.readFileSync(path.join(root, "portal-locadora-ui.js"), "utf8");

const chamadasBloqueio = js.match(/portalBloquearPlacaComOutroProtocoloAtivo\(/g) || [];
const checks = [
  [
    "procura outra locação ativa da mesma placa",
    js.includes("function portalLocacaoAtivaConflitantePorPlaca") &&
      js.includes("!isPortalLocacaoAtiva(loc)") &&
      js.includes("protocolo === ignorar") &&
      js.includes("placaLoc === placa")
  ],
  [
    "bloqueia antes da confirmação e novamente ao gravar",
    chamadasBloqueio.length >= 3 &&
      js.includes('statusLocacao === "ATIVO"') &&
      js.includes("loadCadastro(CAD_LOCACOES_KEY)")
  ],
  [
    "janela informa o protocolo conflitante",
    js.includes("ESTE VEÍCULO JÁ ESTÁ LOCADO COM PROTOCOLO ${protocoloConflito}") &&
      js.includes("É NECESSÁRIO FINALIZAR O PROTOCOLO PARA UTILIZAÇÃO DESTE VEÍCULO.") &&
      js.includes("window.alert(texto)")
  ],
  [
    "conflito impede a gravação",
    /portalBloquearPlacaComOutroProtocoloAtivo\([\s\S]{0,180}\)\s*\{\s*return;\s*\}/.test(js)
  ],
  [
    "cache atualizado",
    /app\.js\?v=[^"'<>]+/.test(html) &&
      /portal-locadora-ui\.js\?v=[^"'<>]+/.test(html)
  ],
];

for (const [label, ok] of checks) console.log(`${ok ? "OK" : "FALHOU"} — ${label}`);
if (checks.some(([, ok]) => !ok)) process.exitCode = 1;
else console.log(`Placa com protocolo ativo único: ${checks.length}/${checks.length}`);
