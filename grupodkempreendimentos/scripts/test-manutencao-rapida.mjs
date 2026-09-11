/**
 * Manutenção rápida em Locados: fluxo azul intacto + painel verde + registro do dia.
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);

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
record("Caixa vermelha da OS não é campo editável", locados.includes('id="portalManutOsCaixa"') && locados.includes("OS000001") && !/<input[^>]+portalManutOsCaixa/.test(locados));
record("Relatório por período e por veículo no cabeçalho", locados.includes("portalManutRelPeriodoBtn") && locados.includes("Relatório por período") && locados.includes("portalManutRelVeiculoBtn") && locados.includes("Relatório por veículo") && locados.includes("portalSetorRelatorioBtnLocados"));
record("Tela com dois calendários e consulta da placa", html.includes("portalManutOsCalDeGrid") && html.includes("portalManutOsCalAteGrid") && html.includes("Consulta da placa") && html.includes("portalManutOsTelaPlaca"));
record("JS grava em dk_manutencoes_rapidas_v1", js.includes('STORAGE_KEY = "dk_manutencoes_rapidas_v1"') && js.includes("origemPortal: true"));
record("Contador OSXXXXXX com 6 dígitos", js.includes("function formatOs") && js.includes('padStart(6, "0")') && js.includes("function backfillOs"));

function formatOs(n) {
  const num = Math.max(1, Math.floor(Number(n) || 1));
  return `OS${String(num).padStart(6, "0")}`;
}
function osNumero(os) {
  const m = String(os || "")
    .toUpperCase()
    .trim()
    .match(/^OS(\d{1,8})$/);
  return m ? Number(m[1]) : 0;
}
function backfillOs(list) {
  const rows = (Array.isArray(list) ? list : []).map((r) => (r && typeof r === "object" ? { ...r } : r));
  const missing = rows.filter((r) => r && typeof r === "object" && osNumero(r.os) <= 0);
  missing.sort((a, b) => Date.parse(a.criadoEm || a.createdAt || 0) - Date.parse(b.criadoEm || b.createdAt || 0));
  let n = rows.reduce((max, r) => Math.max(max, osNumero(r && r.os)), 0);
  missing.forEach((r) => {
    n += 1;
    r.os = formatOs(n);
  });
  return rows;
}
const hoje = backfillOs([{ placa: "SOT0198", criadoEm: "2026-09-10T20:20:00.000Z", valorPago: 40 }]);
record("Lançamento de hoje sem OS vira OS000001", hoje[0].os === "OS000001");
record("Próximo lançamento recebe OS000002", formatOs(osNumero(hoje[0].os) + 1) === "OS000002");
record("Caixa vermelha mostra a próxima OS", js.includes("formatOs(proximoOsNumero("));

const { mergeManutencoesRapidas } = require("../lib/dk-append-only-merge.cjs");
const mergedOs = mergeManutencoesRapidas(
  [{ id: "MR-hoje", placa: "SOT0198", criadoEm: "2026-09-10T20:20:00.000Z", os: "OS000001", valorPago: 40 }],
  [{ id: "MR-hoje", placa: "SOT0198", criadoEm: "2026-09-10T20:20:00.000Z", valorPago: 40 }]
);
record("Merge da nuvem não apaga a OS", mergedOs[0] && mergedOs[0].os === "OS000001");
record("Hooks ao abrir Locados", ui.includes("__DK_portalManutRapidaOnLocadosOpen") && ui.includes("__DK_portalListPlacasLocadosAtivas"));
record("CSS split azul/verde e caixa branca", css.includes("portal-manut-locados-split") && css.includes("portal-manut-rapida") && css.includes("portal-manut-dia"));
record("Script da manutenção rápida no index", html.includes("portal-manutencao-rapida.js"));
record("Caixa Sugestão à frente de Troca de óleo", locados.includes("portalManutRapidaSugestaoOleo") && locados.includes("Sugestão") && locados.indexOf("Troca de óleo") < locados.indexOf("portalManutRapidaSugestaoOleo"));
const limparFn = js.slice(js.indexOf("function limparForm"), js.indexOf("function gravar"));
record("Sugestão persistida e copiada para o valor", js.includes("dk_manutencao_rapida_sugestao_oleo_v1") && js.includes("aplicarSugestaoOleoNoValor") && js.includes("hidratarSugestaoOleo"));
record("Limpar o lançamento não apaga a caixa Sugestão", limparFn.includes("portalManutRapidaValor") && !limparFn.includes("SugestaoOleo") && !limparFn.includes("sugestao"));
record("Valor continua editável e gravado em valorPago", locados.includes('id="portalManutRapidaValor"') && js.includes("valorPago: valor"));

const pass = results.filter((r) => r.ok).length;
console.log(`\n--- ${pass}/${results.length} testes manutenção rápida ---`);
process.exit(pass === results.length ? 0 : 1);
