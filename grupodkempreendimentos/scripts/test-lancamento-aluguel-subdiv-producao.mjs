/**
 * E2E — subdivisão «Lançamento de aluguel» (4 painéis no lugar certo).
 * node grupodkempreendimentos/scripts/test-lancamento-aluguel-subdiv-producao.mjs
 */
import { chromium } from "playwright";

const BASE = (process.env.DK_TEST_BASE || "https://grupodkempreendimentos.com.br/").replace(
  /\/?$/,
  "/"
);
const EXPECT_BUNDLE = process.env.DK_EXPECT_BUNDLE || "20260522lanc-subdiv";
const OWNER_CPF = "03037897430";
const OWNER_SENHA = process.env.DK_OWNER_SENHA || "110499@Gb";

const results = [];
function record(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} | ${name}${detail ? ` | ${detail}` : ""}`);
}

async function loginOwner(page) {
  await page.goto(`${BASE}#locadora/empresa/administrador`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForTimeout(1200);
  await page.locator("#login-cpf").fill(OWNER_CPF);
  await page.locator("#login-senha, input[type=password]").first().fill(OWNER_SENHA);
  await page.locator("#form-login button[type=submit]").first().click();
  await page.waitForSelector("#panel-logado:not(.hidden)", { timeout: 25000 });
  await page.waitForTimeout(800);
}

async function abrirOperacao(page) {
  await page.locator("text=Operação").first().click();
  await page.waitForTimeout(800);
}

function paneSnapshotScript() {
  return () => {
    const paneVisible = (id) => {
      const el = document.getElementById(id);
      return Boolean(el && !el.classList.contains("hidden"));
    };
    const inPane = (paneId, sel) => {
      const pane = document.getElementById(paneId);
      if (!pane || pane.classList.contains("hidden")) return false;
      return Boolean(pane.querySelector(sel));
    };
    const avulso = paneVisible("operacaoLancAluguelPaneAvulso");
    const comprovante = paneVisible("operacaoLancAluguelPaneComprovante");
    const validacao = paneVisible("operacaoLancAluguelPaneValidacao");
    const relatorios = paneVisible("operacaoLancAluguelPaneRelatorios");
    const visCount = [avulso, comprovante, validacao, relatorios].filter(Boolean).length;
    return {
      avulso,
      comprovante,
      validacao,
      relatorios,
      visCount,
      avulsoPesquisa: inPane("operacaoLancAluguelPaneAvulso", "#operacaoLancAluguelConfirmarPesquisaBtn"),
      avulsoHistorico: Boolean(document.getElementById("operacaoLancAluguelHistorico")),
      avulsoSemIa: !inPane("operacaoLancAluguelPaneAvulso", "#portalComprovanteClienteBtnProcessarIa"),
      comprovanteLista: inPane(
        "operacaoLancAluguelPaneComprovante",
        "#portalComprovanteClienteListaValidados"
      ),
      comprovanteSemPesquisa: !inPane("operacaoLancAluguelPaneComprovante", "#operacaoLancAluguelNomeBusca"),
      comprovanteSemIa: !inPane("operacaoLancAluguelPaneComprovante", "#portalComprovanteClienteBtnProcessarIa"),
      validacaoIa: inPane("operacaoLancAluguelPaneValidacao", "#portalComprovanteClienteBtnProcessarIa"),
      validacaoFila: inPane("operacaoLancAluguelPaneValidacao", "#portalComprovanteClienteLista"),
      validacaoSemPesquisa: !inPane("operacaoLancAluguelPaneValidacao", "#operacaoLancAluguelNomeBusca"),
      validacaoSemRel1: !inPane("operacaoLancAluguelPaneValidacao", "#portalRelPagamentosGerarBtn"),
      rel1: inPane("operacaoLancAluguelPaneRelatorios", "#portalRelPagamentosGerarBtn"),
      rel2: inPane("operacaoLancAluguelPaneRelatorios", "#portalRelClienteGerarBtn"),
      rel3: inPane("operacaoLancAluguelPaneRelatorios", "#portalRelPlacaGerarBtn"),
      relSemPesquisa: !inPane("operacaoLancAluguelPaneRelatorios", "#operacaoLancAluguelNomeBusca"),
      relSemIa: !inPane("operacaoLancAluguelPaneRelatorios", "#portalComprovanteClienteBtnProcessarIa"),
      subAtivo: document.querySelector(".btn-operacao-cmd--sub.is-active")?.id || "",
      lead: document.getElementById("operacao-lanc-aluguel-subtitulo")?.textContent?.slice(0, 60) || "",
    };
  };
}

async function clickSub(page, btnId) {
  await page.locator(`#${btnId}`).click();
  await page.waitForTimeout(600);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await loginOwner(page);
    const html = await page.content();
    record(`bundle ${EXPECT_BUNDLE}`, html.includes(EXPECT_BUNDLE), html.includes(EXPECT_BUNDLE) ? "ok" : "cache antigo");

    await abrirOperacao(page);
    const subBtns = await page.evaluate(() =>
      ["btn-lanc-aluguel-avulso", "btn-lanc-aluguel-comprovante", "btn-lanc-aluguel-validacao", "btn-lanc-aluguel-relatorios"].map(
        (id) => Boolean(document.getElementById(id))
      )
    );
    record("sidebar: 4 atalhos na grelha", subBtns.every(Boolean), subBtns.join(","));

    await page.locator("#btn-operacao-lancamento-aluguel").click();
    await page.waitForTimeout(700);
    let s = await page.evaluate(paneSnapshotScript());

    record("abrir «Lançamento de aluguel»: só painel avulso", s.visCount === 1 && s.avulso, `vis=${s.visCount}`);
    record("avulso: pesquisa contrato", s.avulsoPesquisa);
    record("avulso: sem botão IA", s.avulsoSemIa);
    record("avulso: histórico no DOM", s.avulsoHistorico);

    await clickSub(page, "btn-lanc-aluguel-validacao");
    s = await page.evaluate(paneSnapshotScript());
    record("validação: só painel validação visível", s.visCount === 1 && s.validacao, `vis=${s.visCount}`);
    record("validação: botão Processar IA", s.validacaoIa);
    record("validação: fila comprovantes", s.validacaoFila);
    record("validação: sem pesquisa avulso", s.validacaoSemPesquisa);
    record("validação: sem relatório 1", s.validacaoSemRel1);
    record("validação: sub ativo correto", s.subAtivo === "btn-lanc-aluguel-validacao", s.subAtivo);

    await clickSub(page, "btn-lanc-aluguel-comprovante");
    s = await page.evaluate(paneSnapshotScript());
    record("com comprovante: só painel comprovante", s.visCount === 1 && s.comprovante, `vis=${s.visCount}`);
    record("com comprovante: lista validados", s.comprovanteLista);
    record("com comprovante: sem pesquisa", s.comprovanteSemPesquisa);
    record("com comprovante: sem IA", s.comprovanteSemIa);

    await clickSub(page, "btn-lanc-aluguel-relatorios");
    s = await page.evaluate(paneSnapshotScript());
    record("relatórios: só painel relatórios", s.visCount === 1 && s.relatorios, `vis=${s.visCount}`);
    record("relatórios: relatório 1 período", s.rel1);
    record("relatórios: relatório 2 cliente", s.rel2);
    record("relatórios: relatório 3 placa", s.rel3);
    record("relatórios: sem pesquisa", s.relSemPesquisa);
    record("relatórios: sem IA", s.relSemIa);

    await clickSub(page, "btn-lanc-aluguel-avulso");
    s = await page.evaluate(paneSnapshotScript());
    record("voltar avulso: só painel avulso", s.visCount === 1 && s.avulso, `vis=${s.visCount}`);
    record("voltar avulso: pesquisa visível", s.avulsoPesquisa);

    await page.locator("#btn-operacao-lancamento-multas").click();
    await page.waitForTimeout(500);
    const multasOk = await page.evaluate(() => {
      const aluguel = document.getElementById("operacaoInlineLancamentoAluguel");
      const multas = document.getElementById("operacaoInlineLancamentoMultas");
      return aluguel?.classList.contains("hidden") && !multas?.classList.contains("hidden");
    });
    record("multas: fecha painel aluguel", multasOk);

    await page.locator("#btn-lanc-aluguel-validacao").click();
    await page.waitForTimeout(500);
    const reabre = await page.evaluate(() => {
      const aluguel = document.getElementById("operacaoInlineLancamentoAluguel");
      const val = document.getElementById("operacaoLancAluguelPaneValidacao");
      return !aluguel?.classList.contains("hidden") && val && !val.classList.contains("hidden");
    });
    record("atalho validação: reabre aluguel no painel certo", reabre);
  } catch (e) {
    record("E2E exceção", false, e.message || String(e));
  } finally {
    await browser.close();
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n--- ${results.length - failed.length}/${results.length} (${BASE}) ---`);
  if (failed.length) {
    console.log("Falhas:", failed.map((f) => f.name).join(", "));
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
