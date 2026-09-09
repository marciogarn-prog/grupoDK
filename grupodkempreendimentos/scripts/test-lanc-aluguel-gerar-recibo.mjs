/**
 * Gerar recibo na tabela Lançamentos registados (mesmo modal após Confirmar pagamento).
 * node grupodkempreendimentos/scripts/test-lanc-aluguel-gerar-recibo.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import vm from "vm";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const results = [];

function record(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} | ${name}${detail ? ` | ${detail}` : ""}`);
}

function readLocal(rel) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

const protoJs = readLocal("dk-lancamento-protocolo.js");
const uiJs = readLocal("portal-locadora-ui.js");
const css = readLocal("styles.css");
const html = readLocal("index.html");

record("tabela tem coluna Recibo", protoJs.includes("<th>Recibo</th>"));
record("botão Gerar recibo no pagamento", protoJs.includes('data-lanc-aluguel-recibo="${protoAttr}">Gerar recibo'));
record("devolução não gera recibo", protoJs.includes('portal-lanc-hist__recibo">—'));
record("clique abre o mesmo recibo do confirmar", uiJs.includes("portalAbrirReciboDeLancamentoHistorico"));
record("recibo histórico usa quem registou o pagamento", uiJs.includes("operadorDoLancamento: true"));
record("histórico do aluguel escuta Gerar recibo", uiJs.includes('t.closest("[data-lanc-aluguel-recibo]")'));
record("modal Imprimir", html.includes('id="portalReciboPrintBtn"') && uiJs.includes("portalReciboPrintBtn"));
record("modal WhatsApp", html.includes('id="portalReciboShareBtn"') && uiJs.includes("wa.me/"));
record("CSS do botão Recibo", css.includes(".portal-lanc-hist__recibo-btn"));
record("cache-bust recibo-hist", html.includes("dk-lancamento-protocolo.js?v=20260909hist-data-desc"));

const sandbox = {
  window: { location: { hostname: "localhost" } },
  document: { getElementById: () => null },
  console,
};
sandbox.window.window = sandbox.window;
vm.createContext(sandbox);
vm.runInContext(protoJs, sandbox);
const render = sandbox.window.__DK_renderHistoricoLancamentosHtml;
record("renderer exportado", typeof render === "function");

if (typeof render === "function") {
  const htmlHist = render(
    [
      {
        protocoloLancamento: "20260909091/28-05",
        tipoMovimento: "PAGAMENTO",
        data: "08/09/2026",
        valor: 350,
        registradoPorNome: "TESTE",
        createdAt: 1,
      },
      {
        protocoloLancamento: "20260830123347-030",
        tipoMovimento: "DEVOLUCAO_INVESTIMENTO",
        data: "01/01/2025",
        valor: -1050,
        registradoPorNome: "TESTE",
        createdAt: 2,
      },
    ],
    { adminActions: true }
  );
  record(
    "pagamento renderiza Gerar recibo",
    htmlHist.includes('data-lanc-aluguel-recibo="20260909091/28-05"') && htmlHist.includes("Gerar recibo")
  );
  record(
    "devolução não tem botão de recibo",
    htmlHist.includes("Devolução invest.") &&
      !htmlHist.includes('data-lanc-aluguel-recibo="20260830123347-030"')
  );
  record(
    "Gerar recibo vem antes da coluna Protocolo",
    htmlHist.includes('>Gerar recibo</button></td><td>20260909091/28-05</td>')
  );
  const htmlOrdem = render(
    [
      {
        protocoloLancamento: "P-ANTIGO",
        tipoMovimento: "PAGAMENTO",
        data: "31/08/2026",
        valor: 819,
        registradoPorNome: "TESTE",
        createdAt: 9_999,
      },
      {
        protocoloLancamento: "P-RECENTE",
        tipoMovimento: "PAGAMENTO",
        data: "03/09/2026",
        valor: 385.7,
        registradoPorNome: "TESTE",
        createdAt: 1,
      },
    ],
    { adminActions: false }
  );
  const iRecente = htmlOrdem.indexOf("03/09/2026");
  const iAntigo = htmlOrdem.indexOf("31/08/2026");
  record(
    "data mais recente em cima (03/09 acima de 31/08)",
    iRecente >= 0 && iAntigo >= 0 && iRecente < iAntigo
  );
}

const pass = results.filter((r) => r.ok).length;
console.log(`\n--- ${pass}/${results.length} gerar recibo no histórico ---`);
process.exit(pass === results.length ? 0 : 1);
