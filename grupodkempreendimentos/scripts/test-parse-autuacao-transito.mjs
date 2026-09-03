/**
 * node grupodkempreendimentos/scripts/test-parse-autuacao-transito.mjs
 */
import path from "path";
import { createRequire } from "module";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const { parseAutuacaoTransito } = require(path.join(ROOT, "dk-parse-autuacao-transito.js"));

const SAMPLE = `
PARAR SOBRE FAIXA DE PEDESTRES NA MUDANÇA DE SINAL LUMINOSO (FISC ELETRÔNICA)
Placa à época da infração
SPA3F38
Órgão Autuador
225210 - PREF. DE PE PETROLINA
Órgão Competente/Responsável
225210 - PREF. DE PE PETROLINA
Local da Infração
AV. GUARARAPES X AV. SOUZA FILHO - PETROLINA
Data/Hora do Cometimento da Infração
17/08/2026 11:08
Número do Auto de Infração
MB00180959
Código da Infração
5673 - 2
Número RENAINF
11666113239
Valor Original
R$ 130,16
Data da Notificação de Autuação
29/08/2026
`;

const hit = parseAutuacaoTransito(SAMPLE);
const checks = [
  ["placa SPA3F38", hit.placa === "SPA3F38"],
  ["data 17/08/2026", hit.data === "17/08/2026"],
  ["hora 11:08", hit.hora === "11:08"],
  ["codigo 5673-2", hit.codigo === "5673-2"],
  ["valor 130.16", Math.abs(Number(hit.valor) - 130.16) < 0.001],
  ["auto MB00180959", hit.auto === "MB00180959"],
  ["renainf", hit.renainf === "11666113239"],
  ["descricao faixa", /FAIXA DE PEDESTRES/i.test(hit.descricao)],
];

let fail = 0;
for (const [name, ok] of checks) {
  console.log(`${ok ? "PASS" : "FAIL"} | ${name}${ok ? "" : ` | ${JSON.stringify(hit)}`}`);
  if (!ok) fail += 1;
}
if (fail) {
  console.error(`\n${fail} falha(s)`);
  process.exit(1);
}
console.log(`\n${checks.length} checks OK`);
