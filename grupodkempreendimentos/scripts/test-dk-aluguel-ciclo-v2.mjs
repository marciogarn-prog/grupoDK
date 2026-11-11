/**
 * Teste unitário do ciclo semanal v2 (início >= 01/10/2026).
 */
import fs from "fs";
import path from "path";
import vm from "vm";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(path.join(__dirname, "..", "dk-aluguel-ciclo-v2.js"), "utf8");

function parseCurrencyBR(v) {
  const cleaned = String(v ?? "")
    .replace(/[R$\s]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}
function parseBrDate(s) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(s || "").trim());
  if (!m) return null;
  return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
}
function currencyBRL(n) {
  return Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const sandbox = {
  window: {},
  parseCurrencyBR,
  parseBrDate,
  currencyBRL,
  console,
};
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(src, sandbox);

const api = sandbox.window.__DK_aluguelCicloV2;
if (!api) throw new Error("API não exposta");

function approx(a, b, tol = 0.02) {
  return Math.abs(Number(a) - Number(b)) <= tol;
}

let passed = 0;
function check(name, cond) {
  if (!cond) throw new Error(`FAIL ${name}`);
  passed += 1;
  console.log(`PASS | ${name}`);
}

const locBase = {
  inicio: "02/11/2026",
  valorLocacao: "360",
  valorInvestimento: "30",
  descontoPrazo: "30",
  portalLancamentosAluguel: [],
};

check("aplica regra v2 em 02/11/2026", api.locAplicaRegraV2(locBase) === true);
check("não aplica antes de 01/10/2026", api.locAplicaRegraV2({ ...locBase, inicio: "30/09/2026" }) === false);

// Semana 1 com desconto: pagou 360 no início
locBase.portalLancamentosAluguel = [{ data: "02/11/2026", valor: 360, tipoMovimento: "PAGAMENTO" }];
sandbox.window.__DK_getPortalLancamentosAluguelContabilizaveisDoContrato = (loc) => loc.portalLancamentosAluguel;
sandbox.window.__DK_sumPortalLancamentosAluguelTotal = (arr) =>
  (arr || []).reduce((s, x) => s + parseCurrencyBR(x.valor), 0);
sandbox.window.__DK_portalValorAluguelNumFromLoc = () => 360;

const r5 = api.devidoAluguelAte(locBase, null, { dias: 5 });
check("5 dias com desconto ≈ 235,71", approx(r5.devidoAluguel, 5 * (330 / 7)));
check("devolver ≈ 124,29", approx(r5.aDevolver, 360 - 5 * (330 / 7)));

const estado = api.buildSemanas(locBase, { refDate: parseBrDate("16/11/2026"), weekCount: 4 });
check("semana 0 com desconto", estado.semanas[0].comDesconto === true);

// Sem pagamento extra até 09/11 → semana 1 sem desconto
check("semana 1 sem desconto", estado.semanas[1].comDesconto === false);
check("cobrança semana 1 = 390", approx(estado.semanas[1].cobrancaSemana, 390));
check("diária sem desconto ≈ 51,43", approx(estado.semanas[1].diariaAluguel, 360 / 7));

// Acumula 360 até 09/11 → semana 1 com desconto
const locOk = {
  ...locBase,
  portalLancamentosAluguel: [
    { data: "02/11/2026", valor: 360, tipoMovimento: "PAGAMENTO" },
    { data: "07/11/2026", valor: 120, tipoMovimento: "PAGAMENTO" },
    { data: "08/11/2026", valor: 120, tipoMovimento: "PAGAMENTO" },
    { data: "09/11/2026", valor: 120, tipoMovimento: "PAGAMENTO" },
  ],
};
const estOk = api.buildSemanas(locOk, { refDate: parseBrDate("16/11/2026"), weekCount: 4 });
check("semana 1 com desconto após 360 acumulados", estOk.semanas[1].comDesconto === true);

// Recuperação: após semana sem desconto, precisa 390+360 até 16/11
const locRec = {
  ...locBase,
  portalLancamentosAluguel: [
    { data: "02/11/2026", valor: 360, tipoMovimento: "PAGAMENTO" },
    // semana 1 sem desconto (nada até 09/11 além do 360 inicial)
    { data: "12/11/2026", valor: 390, tipoMovimento: "PAGAMENTO" },
    { data: "16/11/2026", valor: 360, tipoMovimento: "PAGAMENTO" },
  ],
};
const estRec = api.buildSemanas(locRec, { refDate: parseBrDate("20/11/2026"), weekCount: 5 });
check("semana 1 sem desconto (recuperação)", estRec.semanas[1].comDesconto === false);
check("semana 2 com desconto após 390+360", estRec.semanas[2].comDesconto === true);

const sug = api.sugestaoPagamentoNaData(locBase, "02/11/2026");
check("sugestão no dia do ciclo com desconto", sug && sug.comDesconto === true && approx(sug.valorSugerido, 360));

function toYmd(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Ciclo em qualquer dia da semana (ex.: terça 03/11/2026 → terça 10/11)
const locTerca = {
  inicio: "03/11/2026",
  valorLocacao: "360",
  valorInvestimento: "30",
  descontoPrazo: "30",
  portalLancamentosAluguel: [{ data: "03/11/2026", valor: 360, tipoMovimento: "PAGAMENTO" }],
};
const estTerca = api.buildSemanas(locTerca, { refDate: parseBrDate("17/11/2026"), weekCount: 3 });
check("ciclo terça: semana 0 começa 03/11", toYmd(estTerca.semanas[0].start) === "2026-11-03");
check("ciclo terça: semana 1 começa 10/11", toYmd(estTerca.semanas[1].start) === "2026-11-10");
check("ciclo terça: semana 1 sem desconto sem acumular 360", estTerca.semanas[1].comDesconto === false);

const locTercaOk = {
  ...locTerca,
  portalLancamentosAluguel: [
    { data: "03/11/2026", valor: 360, tipoMovimento: "PAGAMENTO" },
    { data: "10/11/2026", valor: 360, tipoMovimento: "PAGAMENTO" },
  ],
};
const estTercaOk = api.buildSemanas(locTercaOk, { refDate: parseBrDate("17/11/2026"), weekCount: 3 });
check("ciclo terça: semana 1 com desconto ao pagar 360 no dia do ciclo", estTercaOk.semanas[1].comDesconto === true);

const ex = api.explicacaoDesistencia(
  { ...locBase, fim: "07/11/2026" },
  "07/11/2026"
);
check(
  "explicação desistência traz devido/pago/devolver",
  Boolean(ex?.texto && /Devido só de aluguel/.test(ex.texto) && /Total pago/.test(ex.texto) && /A devolver/.test(ex.texto))
);
check("explicação cita ciclo segunda a segunda", /Ciclo segunda a segunda/.test(String(ex?.texto || "")));
check("a devolver = pago − devido", approx(ex.aDevolver, ex.totalPago - ex.devidoAluguel));

console.log(`\n--- ${passed}/${passed} testes dk-aluguel-ciclo-v2 ---`);
