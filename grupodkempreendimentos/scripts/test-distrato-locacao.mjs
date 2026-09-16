import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const root = path.resolve(import.meta.dirname, "..");
const js = fs.readFileSync(path.join(root, "portal-distrato-locacao.js"), "utf8");
const ui = fs.readFileSync(path.join(root, "portal-locadora-ui.js"), "utf8");
const htmlPortal = fs.readFileSync(path.join(root, "index.html"), "utf8");
const styles = fs.readFileSync(path.join(root, "styles.css"), "utf8");

const context = {
  window: { location: { href: "http://127.0.0.1:4173/index.html" } },
  URL,
  Date,
  console,
};
vm.createContext(context);
vm.runInContext(js, context);

const html = context.window.__DK_distratoLocacaoBuildHtml({
  protocolo: "2026072801",
  cpfDigits: "34004548420",
  cpfFmt: "340.045.484-20",
  nome: "CARLOS ALBERTO ALVES DE SOUZA",
  endereco: "RUA GARIBALDI, 116 - PEDRA LINDA - PETROLINA/PE",
  modalidade: "DK MINHA MOTO",
  placa: "SOQ3B79",
  marcaModelo: "YAMAHA / YBR 150 FACTOR DX",
  chassi: "9C6RG9920S0008215",
  renavam: "1432532780",
  cor: "PRATA",
  anoModelo: "2025/2025",
  proprietario: "SAULO CANDIDO FEITOSA",
  proprietarioCpfCnpj: "11263509401",
  codigoCliente: "0317",
  inicio: "28/07/2026",
  fim: "16/09/2026",
  horaFim: "16:35",
  odometroInicio: "029842 Km(s)",
  odometroFim: "037689 Km(s)",
  iniciativa: "Cliente",
  motivoDistrato: "Cliente desistiu do Processo.",
});

const checks = [
  ["documento tem uma página A4", (html.match(/class="distrato-pagina"/g) || []).length === 1],
  ["protocolo e plano preenchidos", html.includes("2026072801") && html.includes("DK MINHA MOTO")],
  ["cliente e CPF preenchidos", html.includes("CARLOS ALBERTO ALVES DE SOUZA") && html.includes("340.045.484-20")],
  ["veículo e proprietário preenchidos", html.includes("SOQ3B79") && html.includes("SAULO CANDIDO FEITOSA")],
  ["duração = data fim − data início (50 dias)", html.includes("28/07/2026") && html.includes("16/09/2026 - 16:35") && html.includes("50 dia(s)")],
  ["odômetros calculam 7.847 km rodados", html.includes("029842 Km(s)") && html.includes("037689 Km(s)") && html.includes("007847 Km(s)")],
  ["motivo aparece no documento", html.includes("Cliente desistiu do Processo.")],
  ["preview tem PDF, impressão e confirmação", js.includes("btnDistratoPdf") && js.includes("btnDistratoImprimir") && js.includes("btnDistratoConfirmar")],
  ["finalização só ocorre pela confirmação do preview", ui.includes("__DK_distratoLocacaoAbrir(dadosDistrato, pendente.onConfirm)") && ui.includes("const finalizarLocacao = (dadosDistrato = {})")],
  ["modal de dados presente", htmlPortal.includes("portalDistratoDadosModal") && htmlPortal.includes("portalDistratoMotivo")],
  ["CSS e cache-bust presentes", styles.includes("portal-distrato-dados-card") && htmlPortal.includes("portal-distrato-locacao.js?v=20260916distratodias")],
];

for (const [label, ok] of checks) console.log(`${ok ? "OK" : "FALHOU"} — ${label}`);
if (checks.some(([, ok]) => !ok)) process.exitCode = 1;
else console.log(`Distrato de locação: ${checks.length}/${checks.length}`);
