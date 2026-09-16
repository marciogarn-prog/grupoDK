import fs from "node:fs";
import vm from "node:vm";

const root = new URL("../", import.meta.url);
const html = fs.readFileSync(new URL("index.html", root), "utf8");
const js = fs.readFileSync(new URL("portal-locadora-ui.js", root), "utf8");
const css = fs.readFileSync(new URL("styles.css", root), "utf8");

const checks = [];
const check = (nome, ok) => {
  checks.push(Boolean(ok));
  console.log(`${ok ? "PASS" : "FAIL"} | ${nome}`);
};

check(
  "campos editáveis de hora início e fim",
  html.includes('id="operacaoLocacaoHoraInicio"') &&
    html.includes('id="operacaoLocacaoHoraFim"') &&
    html.includes('type="time"')
);
check(
  "data e hora permanecem lado a lado",
  html.includes("portal-locacao-data-hora") && css.includes("grid-template-columns: minmax(0, 1fr) 5.5rem")
);
check(
  "corte protege contratos anteriores a 17/09/2026",
  js.includes("PORTAL_LOCACAO_REGRA_DIARIA_24H_CORTE_MS") &&
    js.includes("regraDiaria24hAtiva") &&
    js.includes("Sem a marca explícita é cadastro legado e mantém a regra antiga.")
);
check(
  "horas persistem no cadastro e no carregamento",
  js.includes("horaInicio,") &&
    js.includes("horaFim,") &&
    js.includes("loc.horaInicio") &&
    js.includes("loc.horaFim")
);

const inicioTrecho = js.indexOf("function portalHoraMinutos");
const fimTrecho = js.indexOf("function sugerirHorasLocacaoNova");
const context = { Date, Math, Number, String, Object, document: {}, console };
vm.createContext(context);
vm.runInContext(js.slice(inicioTrecho, fimTrecho), context);

const data = (dia, hora, minuto = 0) => new Date(2026, 8, dia, hora, minuto);
const contar = (fimDia, fimHora, fimMinuto = 0) =>
  context.portalLocacaoDiariasPorIntervalo(
    data(17, 10),
    "10:00",
    data(fimDia, fimHora, fimMinuto),
    `${String(fimHora).padStart(2, "0")}:${String(fimMinuto).padStart(2, "0")}`
  );

check("até 24 horas conta uma diária", contar(18, 10) === 1);
check("acima de 24 e até 48 horas conta duas diárias", contar(18, 10, 1) === 2 && contar(19, 10) === 2);
check("cada novo bloco iniciado de 24 horas acrescenta uma diária", contar(19, 10, 1) === 3);

const passou = checks.filter(Boolean).length;
console.log(`\n--- ${passou}/${checks.length} testes horas/diárias passaram ---`);
if (passou !== checks.length) process.exitCode = 1;
