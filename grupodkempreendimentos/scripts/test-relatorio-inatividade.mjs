/**
 * Relatório de inatividade: placas sem protocolo na data.
 * node grupodkempreendimentos/scripts/test-relatorio-inatividade.mjs
 */
import fs from "fs";
import path from "path";
import vm from "vm";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const results = [];

function record(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} | ${name}${detail ? ` | ${detail}` : ""}`);
}

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

const ctx = { window: {}, globalThis: {} };
ctx.globalThis = ctx;
ctx.window = ctx;
vm.runInNewContext(read("dk-relatorio-inatividade.js"), ctx);
const api = ctx.__DK_relatorioInatividade;

record("API do relatório de inatividade carregou", Boolean(api?.locCobreDia && api?.coletarInatividadePeriodo));

const locMarcelo = { numeroContrato: "2026080705", placa: "SPA3F38", inicio: "07/08/2026", fim: "16/08/2026", nome: "MARCELO" };
const locEsteferson = { numeroContrato: "2026082802", placa: "SPA3F38", inicio: "28/08/2026", fim: "", nome: "ESTEFERSON" };

record(
  "17/08/2026 11:08 — SPA3F38 sem protocolo (entre Marcelo e Esteferson)",
  api.locCobreDia(locMarcelo, api.brToMs("17/08/2026"), (l) => l.inicio, (l) => l.fim) === false &&
    api.locCobreDia(locEsteferson, api.brToMs("17/08/2026"), (l) => l.inicio, (l) => l.fim) === false
);
record(
  "10/08/2026 — SPA3F38 coberta pelo protocolo de Marcelo",
  api.locCobreDia(locMarcelo, api.brToMs("10/08/2026"), (l) => l.inicio, (l) => l.fim) === true
);
record(
  "16/08/2026 — último dia do contrato ainda conta como vinculado",
  api.locCobreDia(locMarcelo, api.brToMs("16/08/2026"), (l) => l.inicio, (l) => l.fim) === true
);
record(
  "03/09/2026 — contrato ativo sem data fim cobre o dia",
  api.locCobreDia(locEsteferson, api.brToMs("03/09/2026"), (l) => l.inicio, (l) => l.fim) === true
);

const veiculos = [{ placa: "SPA3F38", tipo: "MOTO", modelo: "SHI 175" }, { placa: "UIA1G56", tipo: "CARRO", modelo: "KWID" }];
const periodo = { startMs: api.brToMs("17/08/2026"), endMs: api.brToMs("17/08/2026") };
const data = api.coletarInatividadePeriodo({
  periodo,
  veiculos,
  locacoes: [locMarcelo, locEsteferson, { numeroContrato: "2026080101", placa: "UIA1G56", inicio: "01/08/2026", fim: "", nome: "EZIQUIEL" }],
  getTipo: (v) => (String(v?.tipo || "").includes("CARRO") ? "CARRO" : "MOTO"),
});
const day = data.days[0];
record("17/08 — SPA3F38 aparece como inativa (moto)", Boolean(day?.motos.some((r) => r.placa === "SPA3F38")));
record("17/08 — UIA1G56 não aparece (carro com protocolo ativo)", Boolean(day && !day.carros.some((r) => r.placa === "UIA1G56")));
record("Último protocolo da placa inativa é o de Marcelo", day?.motos.find((r) => r.placa === "SPA3F38")?.protocolo === "2026080705");

const locManut = api.coletarInatividadePeriodo({
  periodo,
  veiculos: [
    { placa: "SPA3F38", tipo: "MOTO", modelo: "SHI 175" },
    { placa: "XYZ1A11", tipo: "CARRO", modelo: "CLASSIC LIFE/LS 1.0 VHC FLEXPOWER 4P", disponivelCategoria: "reserva-patio" },
  ],
  locacoes: [locMarcelo],
  getTipo: (v) => (String(v?.tipo || "").includes("CARRO") ? "CARRO" : "MOTO"),
  manutencoes: [{ placa: "SPA3F38", categoriaManutencao: "triagem", dataRealSaida: "" }],
});
const locDay = locManut.days[0];
record(
  "Localização TRIAGEM vem da manutenção aberta",
  locDay?.motos.find((r) => r.placa === "SPA3F38")?.localizacao === "TRIAGEM"
);
record(
  "Localização RESERVA PATIO vem da categoria disponível",
  locDay?.carros.find((r) => r.placa === "XYZ1A11")?.localizacao === "RESERVA PATIO"
);
record(
  "API resolve oficina terceiro e reserva operação",
  api.resolverLocalizacaoInatividade("AAA1B11", { disponivelCategoria: "reserva-operacao" }, {}) === "RESERVA OPERACAO" &&
    api.resolverLocalizacaoInatividade(
      "BBB2C22",
      {},
      { manutencoes: [{ placa: "BBB2C22", categoriaManutencao: "oficina-terceiros", dataRealSaida: "" }] }
    ) === "OFICINA TERCEIRO"
);
record(
  "Localização 5.3 e 5.4 no relatório de inatividade",
  api.resolverLocalizacaoInatividade("CCC3D33", { disponivelCategoria: "veiculos-operacionais" }, {}) ===
    "VEICULOS OPERACIONAIS" &&
    api.resolverLocalizacaoInatividade("DDD4E44", { disponivelCategoria: "veiculos-vendidos" }, {}) ===
      "VEICULOS VENDIDOS"
);

const html = read("index.html");
const css = read("styles.css");
const ui = read("portal-locadora-ui.js");
record("Menu tem Relatório de inatividade abaixo da rotatividade", /btn-operacao-relatorio-rotatividade[\s\S]{0,400}btn-operacao-relatorio-inatividade/.test(html));
record("Painel Relatório de inatividade existe", html.includes('id="operacaoInlineRelatorioInatividade"') && html.includes("Relatório de inatividade"));
record("Filtros iguais: início, fim e Atualizar relatório", html.includes("operacaoInatividadeInicio") && html.includes("operacaoInatividadeFim") && html.includes("operacaoInatividadeAtualizarBtn"));
record("Apresentação por dia no mesmo padrão", html.includes("operacaoInatividadeLista") && html.includes("operacaoInatividadeResumo"));
record("JS abre e renderiza o relatório", ui.includes("openOperacaoRelatorioInatividade") && ui.includes("renderOperacaoRelatorioInatividade") && ui.includes("portalColetarInatividadePeriodo"));
record("CSS reutiliza o padrão da rotatividade", css.includes("portal-inatividade") && css.includes("portal-rotatividade-dia__cols"));
record("Resumo e detalhado ficam na mesma folha", html.includes("portal-inatividade-folha") && css.includes("portal-inatividade-folha"));
record(
  "Carros em cima e motos embaixo no detalhado",
  /col--sai[\s\S]{0,400}Carros sem protocolo[\s\S]{0,400}col--ent[\s\S]{0,400}Motos sem protocolo/.test(ui)
);
record("Coluna Localização no detalhado", ui.includes("Localização") && ui.includes("portal-rotatividade-row__loc") && ui.includes("portalLocalizacaoInatividade"));
record("PDF de um dia compacta a folha", read("dk-relatorio-operacao-pdf.js").includes("um-dia") && read("dk-relatorio-operacao-pdf.js").includes("modo: \"inatividade\""));

const pass = results.filter((r) => r.ok).length;
console.log(`\n--- ${pass}/${results.length} testes relatório de inatividade ---`);
process.exit(pass === results.length ? 0 : 1);
