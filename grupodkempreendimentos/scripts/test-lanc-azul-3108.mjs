/**
 * Lançamento único 31/08/2026 (fonte azul, Márcio Santos) nos protocolos finalizados.
 * node grupodkempreendimentos/scripts/test-lanc-azul-3108.mjs
 */
import fs from "fs";
import path from "path";
import { createRequire } from "module";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const results = [];

function record(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} | ${name}${detail ? ` | ${detail}` : ""}`);
}

function readLocal(rel) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

const html = readLocal("index.html");
const ui = readLocal("portal-locadora-ui.js");
const css = readLocal("styles.css");
const protoSrc = readLocal("dk-lancamento-protocolo.js");
const appSrc = readLocal("app.js");
const mergeSrc = readLocal("lib/dk-append-only-merge.cjs");
const histSrc = protoSrc;
const clienteJs = readLocal("cliente-app.js");
const clienteCss = readLocal("cliente-app.css");

record("cache pwa", html.includes("20260901lanc-azul-3108") && readLocal("dk-pwa-update.js").includes("20260901lanc-azul-3108"));
record("css fonte azul", css.includes("portal-lanc-fonte-azul") && css.includes("#1565c0"));
record("historico classe azul", histSrc.includes("portal-lanc-fonte-azul") && histSrc.includes("__DK_lancamentoFonteAzul"));
record("normalize protocolo", protoSrc.includes("row.fonteAzul = true"));
record("normalize ui", ui.includes("out.fonteAzul = true") && ui.includes("function portalLancamentoFonteAzul"));
record("relatorio 1 e 2", ui.includes("fonteAzul: portalLancamentoFonteAzul(lan)") && ui.includes("portalLancamentoTrAttr(lan)"));
record("merge app.js", appSrc.includes("row.fonteAzul = true"));
record("merge cjs", mergeSrc.includes("row.fonteAzul = true"));
record("cliente fonte azul", clienteJs.includes("cliente-pagamento-row--fonte-azul") && clienteCss.includes("cliente-pagamento-row--fonte-azul"));

const merge = require(path.join(ROOT, "lib/dk-append-only-merge.cjs"));
const {
  ROWS,
  CPF_MARCIO,
  applyLancamentosUnicos3108,
  somaValoresPlanilha,
  verifyLocacoes,
} = require(path.join(ROOT, "scripts/lanc-unico-3108-finalizados.cjs"));

record("planilha 89 linhas", ROWS.length === 89, `n=${ROWS.length}`);
record(
  "total pago planilha",
  Math.abs(somaValoresPlanilha() - 310826.12) < 0.01,
  `soma=${somaValoresPlanilha().toFixed(2)}`
);

const locA = {
  numeroContrato: "2025042201",
  placa: "SOQ3B79",
  cpf: "70393366421",
  nome: "ERICLES",
  statusLocacao: "FINALIZADO",
  fim: "18/06/2025",
  portalLancamentosAluguel: [
    { data: "22/04/2025", valor: 250, createdAt: 1, registradoPorCpf: "" },
    { data: "25/05/2025", valor: 250, createdAt: 2, registradoPorCpf: "" },
  ],
};
const locB = {
  numeroContrato: "2025050901",
  placa: "RDO7E19",
  cpf: "93630590578",
  nome: "ADRIANO",
  statusLocacao: "FINALIZADO",
  fim: "25/08/2025",
  portalLancamentosAluguel: [],
};
const applied = applyLancamentosUnicos3108([locA, locB], 1788195600000);
const a = applied.locacoes.find((l) => l.numeroContrato === "2025042201");
const b = applied.locacoes.find((l) => l.numeroContrato === "2025050901");
record("ericles unico 1289", a?.portalLancamentosAluguel?.length === 1 && Number(a.portalLancamentosAluguel[0].valor) === 1289);
record("ericles fonte azul", a?.portalLancamentosAluguel?.[0]?.fonteAzul === true);
record("ericles marcio", a?.portalLancamentosAluguel?.[0]?.registradoPorCpf === CPF_MARCIO);
record("ericles data 31/08", a?.portalLancamentosAluguel?.[0]?.data === "31/08/2026");
record("ericles tombstone 2", (a?.portalLancamentosAluguelRemovidos || []).length >= 2, `n=${(a?.portalLancamentosAluguelRemovidos || []).length}`);
record("adriano unico 3750", b?.portalLancamentosAluguel?.length === 1 && Number(b.portalLancamentosAluguel[0].valor) === 3750);

const merged = merge.mergeLocacoesCadastro(
  [locA, locB],
  applied.outgoing
);
const ma = merged.find((l) => String(l.numeroContrato) === "2025042201");
const vis = merge.filtrarPortalLancamentosPorRemovidos(ma.portalLancamentosAluguel, ma.portalLancamentosAluguelRemovidos);
record(
  "merge nao duplica e esconde antigos",
  vis.length === 1 && vis[0].fonteAzul === true && Number(vis[0].valor) === 1289,
  `vis=${vis.length} val=${vis[0]?.valor}`
);
record("merge preserva fonteAzul", vis[0]?.fonteAzul === true);

const again = applyLancamentosUnicos3108(applied.locacoes, 1788195600001);
const a2 = again.locacoes.find((l) => l.numeroContrato === "2025042201");
record(
  "reaplicar nao duplica",
  a2?.portalLancamentosAluguel?.length === 1 && again.report.find((r) => r.protocolo === "2025042201")?.action === "kept"
);

const cloudLike = [
  ...ROWS.map((r) => ({
    numeroContrato: r.protocolo,
    placa: r.placa,
    cpf: r.cpf,
    nome: r.nome,
    fim: r.fim,
    statusLocacao: "FINALIZADO",
    portalLancamentosAluguel: r.protocolo === "2025042201" ? locA.portalLancamentosAluguel : [],
  })),
];
const all = applyLancamentosUnicos3108(cloudLike);
const ver = verifyLocacoes(all.locacoes);
record("89 protocolos ok", ver.every((x) => x.ok) && ver.length === 89, JSON.stringify(ver.filter((x) => !x.ok)));

const failed = results.filter((r) => !r.ok);
if (failed.length) {
  console.error(`\n${failed.length} falha(s)`);
  process.exit(1);
}
console.log(`\n${results.length} checks OK`);
