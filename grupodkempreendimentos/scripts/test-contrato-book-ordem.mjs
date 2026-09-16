import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const pacote = fs.readFileSync(path.join(root, "portal-contrato-pacote.js"), "utf8");
const contrato = fs.readFileSync(path.join(root, "portal-contrato-locacao.js"), "utf8");
const index = fs.readFileSync(path.join(root, "index.html"), "utf8");

const checks = [];
function check(nome, cond) {
  checks.push({ nome, ok: Boolean(cond) });
}

check(
  "ordem do book: opção, contrato, promessa, requerimento e check list",
  contrato.includes("${antesContrato}<div class=\"kit-secao-titulo-preview\">2. Contrato de locação</div>${paginas.join(\"\")}${depoisContrato}") &&
    /3\. Promessa de compra e venda[\s\S]+4\. Requerimento padrão[\s\S]+5\. Check list \/ Termo de vistoria/.test(contrato)
);
check(
  "Opção Contratada recebe página de verso em branco",
  pacote.includes("pagina-verso-em-branco") &&
    pacote.includes("__DK_contratoPacoteBuildVersoBrancoPagina") &&
    contrato.includes("__DK_contratoPacoteBuildVersoBrancoPagina")
);
check(
  "Promessa é gerada em duas páginas pelo modelo SISLOC",
  pacote.includes("__DK_CONTRATO_PACOTE_PROMESSA || []") &&
    pacote.includes("__DK_contratoPacoteBuildPromessaPagina") &&
    contrato.includes("__DK_contratoPacoteBuildPromessaPagina")
);
check(
  "Promessa é exclusiva de DK MINHA MOTO",
  pacote.includes("somenteMinhaMoto: true") &&
    pacote.includes("function pacoteEhMinhaMoto") &&
    contrato.includes("ehMinhaMoto && typeof window.__DK_contratoPacoteBuildPromessaPagina")
);
check(
  "DK MEU TRANSPORTE fica sem Promessa e com 16 páginas",
  contrato.includes("book de 16 páginas: Opção + verso branco, Contrato, Requerimento e Check list (sem Promessa)")
);
check(
  "DK MINHA MOTO recebe Promessa e totaliza 18 páginas",
  contrato.includes("book de 18 páginas: Opção + verso branco, Contrato, Promessa, Requerimento e Check list")
);
check(
  "scripts do contrato possuem cache-bust atualizado",
  index.includes("portal-contrato-locacao.js?v=20260916bookduplex") &&
    index.includes("portal-contrato-pacote.js?v=20260916bookduplex")
);

for (const item of checks) {
  console.log(`${item.ok ? "OK" : "FALHOU"} — ${item.nome}`);
}

const falhas = checks.filter((item) => !item.ok);
if (falhas.length) {
  process.exitCode = 1;
} else {
  console.log(`Contrato book: ${checks.length}/${checks.length}`);
}
