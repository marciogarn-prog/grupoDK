import fs from "node:fs";

const root = new URL("../", import.meta.url);
const html = fs.readFileSync(new URL("index.html", root), "utf8");
const js = fs.readFileSync(new URL("portal-financeiro-ceo.js", root), "utf8");
const css = fs.readFileSync(new URL("styles.css", root), "utf8");

const checks = [];
const check = (nome, ok) => {
  checks.push(Boolean(ok));
  console.log(`${ok ? "PASS" : "FAIL"} | ${nome}`);
};

const posGrafico = html.indexOf('data-ceo-mod="grafico-despesas"');
const posRotatividade = html.indexOf('data-ceo-mod="rotatividade-financeira"');
const posRelatorio = html.indexOf('data-ceo-mod="relatorio"');

check(
  "menu fica abaixo do gráfico de despesas",
  posGrafico >= 0 && posRotatividade > posGrafico && posRelatorio > posRotatividade
);
check(
  "relatório tem filtros mensais e resumo",
  html.includes('id="finCeoRotFinMesInicio"') &&
    html.includes('id="finCeoRotFinMesFim"') &&
    html.includes('id="finCeoRotFinNovos"') &&
    html.includes('id="finCeoRotFinFinalizados"') &&
    html.includes('id="finCeoRotFinSaldo"')
);
check(
  "primeira parcela entra como novo compromisso",
  js.includes("primeiraChave: monthKey(primeiro.data)") &&
    js.includes("c.primeiraChave === chave")
);
check(
  "última parcela sai no mês seguinte",
  js.includes("saidaChave: monthKey(addMonths(ultimo.data, 1))") &&
    js.includes("c.saidaChave === chave")
);
check(
  "saldo mensal é novos menos finalizados",
  js.includes("const saldo = novos - finalizados") &&
    js.includes("const saldoGeral = totalNovos - totalFinalizados")
);
check(
  "duas colunas mostram entradas e saídas",
  html.includes("Novos compromissos") &&
    js.includes("Compromissos finalizados no mês anterior") &&
    css.includes("fin-ceo-rot-fin-mes__cols")
);
check(
  "cache do relatório foi atualizado",
  html.includes("portal-financeiro-ceo.js?v=20260916rotfinanceira") &&
    html.includes("styles.css?v=20260916rotfinanceira")
);

const passou = checks.filter(Boolean).length;
console.log(`\n--- ${passou}/${checks.length} testes rotatividade financeira passaram ---`);
if (passou !== checks.length) process.exitCode = 1;
