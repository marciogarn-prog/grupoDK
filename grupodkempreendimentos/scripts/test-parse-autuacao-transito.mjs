/**
 * node grupodkempreendimentos/scripts/test-parse-autuacao-transito.mjs
 */
import path from "path";
import { createRequire } from "module";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const { parseAutuacaoTransito, limparSimboloInicioDescricao, escolherMelhorPlaca, ehPlacaMercosulAtual } = require(path.join(ROOT, "dk-parse-autuacao-transito.js"));

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
Data Limite para Interposição de Defesa Prévia
12/10/2026
Data Limite para Identificação do Condutor Infrator
12/10/2026
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
  ["orgao autuador", /PETROLINA/i.test(hit.orgaoAutuador)],
  ["local avenida", /GUARARAPES/i.test(hit.local)],
  ["notificacao 29/08/2026", hit.dataNotificacao === "29/08/2026"],
  ["limite defesa 12/10/2026", hit.dataLimiteDefesa === "12/10/2026"],
  ["limite condutor 12/10/2026", hit.dataLimiteCondutor === "12/10/2026"],
  ["descricao sem letra do ícone", !/^[BDO]\s/i.test(hit.descricao)],
];

const sampleDe = SAMPLE.replace("Código da Infração", "Código de Infração")
  .replace("MB00180959", "M000180669")
  .replace("R$ 130,16", "R$ 130.16");
const hitDe = parseAutuacaoTransito(sampleDe);
checks.push(["codigo de infração 5673-2", hitDe.codigo === "5673-2"]);
checks.push(["auto M000180669", hitDe.auto === "M000180669"]);
checks.push(["valor 130.16 com ponto", Math.abs(Number(hitDe.valor) - 130.16) < 0.001]);

const sampleAlfa = SAMPLE.replace("MB00180959", "M5C0350359");
const hitAlfa = parseAutuacaoTransito(sampleAlfa);
checks.push(["auto M5C0350359", hitAlfa.auto === "M5C0350359"]);

const sampleIcone = SAMPLE.replace(
  "PARAR SOBRE FAIXA DE PEDESTRES NA MUDANÇA DE SINAL LUMINOSO (FISC ELETRÔNICA)",
  "B PARAR SOBRE FAIXA DE PEDESTRES NA MUDANÇA DE SINAL LUMINOSO (FISC ELETRÔNICA)"
);
const hitIcone = parseAutuacaoTransito(sampleIcone);
checks.push(["ícone B no início da infração é descartado", hitIcone.descricao.startsWith("PARAR SOBRE")]);
checks.push(["limpar B solto", limparSimboloInicioDescricao("B PARAR SOBRE FAIXA") === "PARAR SOBRE FAIXA"]);
checks.push(["limpar D solto", limparSimboloInicioDescricao("D PARAR SOBRE FAIXA") === "PARAR SOBRE FAIXA"]);

const sampleCifrao = SAMPLE.replace("R$ 130,16", "$ R$ 130,16");
const hitCifrao = parseAutuacaoTransito(sampleCifrao);
checks.push(["valor ignora símbolo de dinheiro", Math.abs(Number(hitCifrao.valor) - 130.16) < 0.001]);

const sampleIconeValor = `
Valor Original
B
R$ 130,16
`;
const hitIconeValor = parseAutuacaoTransito(sampleIconeValor);
checks.push(["valor com ícone na linha de cima", Math.abs(Number(hitIconeValor.valor) - 130.16) < 0.001]);

const samplePlacaEspaco = SAMPLE.replace("SPA3F38", "SPA 3F38");
const hitPlacaEspaco = parseAutuacaoTransito(samplePlacaEspaco);
checks.push(["placa com espaço SPA 3F38", hitPlacaEspaco.placa === "SPA3F38"]);

const samplePlacaErradaNaFrente = `Consulta placa DKR2252
Placa à época da infração
SPA3F38
Data/Hora do Cometimento da Infração
17/08/2026 11:08
`;
const hitPlacaErrada = parseAutuacaoTransito(samplePlacaErradaNaFrente);
checks.push(["placa da época vence placa antiga DKR2252", hitPlacaErrada.placa === "SPA3F38"]);

const samplePlacaMesmaLinha = "Placa à época da infração: SPA3F38\nValor Original\nR$ 130,16\n";
const hitPlacaLinha = parseAutuacaoTransito(samplePlacaMesmaLinha);
checks.push(["placa na mesma linha do rótulo", hitPlacaLinha.placa === "SPA3F38"]);
checks.push(["Mercosul SPA3F38", ehPlacaMercosulAtual("SPA3F38") === true]);
checks.push(["antiga DKR2252 não é Mercosul atual", ehPlacaMercosulAtual("DKR2252") === false]);
checks.push(["escolhe Mercosul entre DKR2252 e SPA3F38", escolherMelhorPlaca(["DKR2252", "SPA3F38"]) === "SPA3F38"]);

const sampleValorSemCifrao = SAMPLE.replace("R$ 130,16", "130,16");
const hitValorSemCifrao = parseAutuacaoTransito(sampleValorSemCifrao);
checks.push(["valor 130,16 sem R$", Math.abs(Number(hitValorSemCifrao.valor) - 130.16) < 0.001]);

const sampleValorRS = SAMPLE.replace("R$ 130,16", "RS 130,16");
const hitValorRS = parseAutuacaoTransito(sampleValorRS);
checks.push(["valor RS 130,16", Math.abs(Number(hitValorRS.valor) - 130.16) < 0.001]);

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
