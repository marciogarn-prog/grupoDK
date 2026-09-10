/**
 * Manutenção rápida em Locados: fluxo azul intacto + painel verde + registro do dia.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (f) => fs.readFileSync(path.join(root, f), "utf8");
const results = [];
const record = (name, ok) => {
  results.push({ name, ok: Boolean(ok) });
  console.log(`${ok ? "PASS" : "FAIL"} | ${name}`);
};

const html = read("index.html");
const js = read("portal-manutencao-rapida.js");
const ui = read("portal-locadora-ui.js");
const css = read("styles.css");
const locados = html.slice(
  html.indexOf('id="manutencaoInlineEmOperacao"'),
  html.indexOf('id="manutencaoInlineEmManutencao"')
);

record("Locados mantém o fluxo azul ENVIAR PARA MANUTENÇÃO", html.includes("ENVIAR PARA MANUTENÇÃO") && locados.includes("portalChecklistHostOperacao"));
record("Botão RELATÓRIO de setor continua em Locados", locados.includes("portalSetorRelatorioBtnLocados") && locados.includes("RELATÓRIO"));
record("Painel verde Manutenção rápida com placa e KM", locados.includes("portalManutRapidaPanel") && locados.includes("portalManutRapidaPlaca") && locados.includes("portalManutRapidaKm"));
record("Seis serviços rápidos", ["oleo", "kit", "pastilhaDianteira", "pastilhaTraseira", "pneuDianteiro", "pneuTraseiro"].every((id) => locados.includes(`data-manut-rapida-serv="${id}"`)));
record("Valor pago e PIX / espécie / cartão / NÃO SE APLICA", locados.includes("Valor pago pelo cliente") && locados.includes('data-manut-rapida-pag="pix"') && locados.includes('data-manut-rapida-pag="especie"') && locados.includes('data-manut-rapida-pag="cartao"') && locados.includes('data-manut-rapida-pag="naoSeAplica"') && locados.includes("NÃO SE APLICA"));
record("Sem campo de moto reserva no painel rápido", !locados.includes("portalManutRapidaReserva") && js.includes("sem moto reserva"));
record("Registro do dia e relatórios", locados.includes("portalManutDiaRegistro") && locados.includes("portalManutRelatorioGeralBtn") && locados.includes("Relatório por moto"));
record("Modal de relatório por período", html.includes("portalManutLancRelatorioModal") && html.includes("portalManutLancRelDe"));
record("JS grava em dk_manutencoes_rapidas_v1", js.includes('STORAGE_KEY = "dk_manutencoes_rapidas_v1"') && js.includes("origemPortal: true"));
record("Hooks ao abrir Locados", ui.includes("__DK_portalManutRapidaOnLocadosOpen") && ui.includes("__DK_portalListPlacasLocadosAtivas"));
record("CSS split azul/verde e caixa branca", css.includes("portal-manut-locados-split") && css.includes("portal-manut-rapida") && css.includes("portal-manut-dia"));
record("Script da manutenção rápida no index", html.includes("portal-manutencao-rapida.js"));

const pass = results.filter((r) => r.ok).length;
console.log(`\n--- ${pass}/${results.length} testes manutenção rápida ---`);
process.exit(pass === results.length ? 0 : 1);
