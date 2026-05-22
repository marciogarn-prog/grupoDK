/**
 * E2E — lançamento de aluguel: submenu lateral + 4 fluxos.
 * node grupodkempreendimentos/scripts/test-lancamento-aluguel-subdiv-producao.mjs
 */
import { chromium } from "playwright";

const BASE = (process.env.DK_TEST_BASE || "https://grupodkempreendimentos.com.br/").replace(
  /\/?$/,
  "/"
);
const EXPECT_BUNDLE = process.env.DK_EXPECT_BUNDLE || "20260522lanc-aluguel-menu";
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
    const blocoPesquisaVis = paneVisible("operacaoLancAluguelBlocoPesquisaRef");
    const avulso = paneVisible("operacaoLancAluguelPaneAvulso");
    const comprovante = paneVisible("operacaoLancAluguelPaneComprovante");
    const validacao = paneVisible("operacaoLancAluguelPaneValidacao");
    const relatorios = paneVisible("operacaoLancAluguelPaneRelatorios");
    const visCount = [avulso, comprovante, validacao, relatorios].filter(Boolean).length;
    const subnav = document.getElementById("operacaoLancAluguelSubnav");
    return {
      subnavHidden: subnav?.classList.contains("hidden"),
      subnavVisible: subnav && !subnav.classList.contains("hidden"),
      blocoPesquisaVis,
      avulso,
      comprovante,
      validacao,
      relatorios,
      visCount,
      pesquisaPlaca: Boolean(document.getElementById("operacaoLancAluguelPlacaBusca")),
      avulsoSalvar: inPane("operacaoLancAluguelPaneAvulso", "#operacaoLancAluguelConfirmarPagamentoBtn"),
      avulsoSemIa: !inPane("operacaoLancAluguelPaneAvulso", "#portalComprovanteClienteBtnProcessarIa"),
      comprovantePaste: inPane("operacaoLancAluguelPaneComprovante", "#portalOperadorComprovantePasteZone"),
      comprovanteSemAppFila: !inPane(
        "operacaoLancAluguelPaneComprovante",
        "#portalComprovanteClienteBtnProcessarIa"
      ),
      comprovanteComPesquisaBloco: comprovante && blocoPesquisaVis,
      validacaoIa: inPane("operacaoLancAluguelPaneValidacao", "#portalComprovanteClienteBtnProcessarIa"),
      validacaoFila: inPane("operacaoLancAluguelPaneValidacao", "#portalComprovanteClienteLista"),
      validacaoSemPesquisaBloco: validacao && !blocoPesquisaVis,
      validacaoSemRel1: !inPane("operacaoLancAluguelPaneValidacao", "#portalRelPagamentosGerarBtn"),
      rel1: inPane("operacaoLancAluguelPaneRelatorios", "#portalRelPagamentosGerarBtn"),
      rel2: inPane("operacaoLancAluguelPaneRelatorios", "#portalRelClienteGerarBtn"),
      rel3: inPane("operacaoLancAluguelPaneRelatorios", "#portalRelPlacaGerarBtn"),
      relSemPesquisaBloco: relatorios && !blocoPesquisaVis,
      subAtivo: document.querySelector(".btn-operacao-cmd--sub.is-active")?.id || "",
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
    let s0 = await page.evaluate(paneSnapshotScript());
    record("antes de abrir: submenu oculto", s0.subnavHidden);
    record("sidebar: 4 atalhos submenu", await page.evaluate(() =>
      ["btn-lanc-aluguel-avulso", "btn-lanc-aluguel-comprovante", "btn-lanc-aluguel-validacao", "btn-lanc-aluguel-relatorios"].every(
        (id) => Boolean(document.getElementById(id))
      )
    ));

    await page.locator("#btn-operacao-lancamento-aluguel").click();
    await page.waitForTimeout(700);
    let s = await page.evaluate(paneSnapshotScript());

    record("abrir aluguel: submenu visível", s.subnavVisible);
    record("abrir aluguel: só painel avulso", s.visCount === 1 && s.avulso, `vis=${s.visCount}`);
    record("avulso: bloco pesquisa visível", s.blocoPesquisaVis);
    record("avulso: campo placa", s.pesquisaPlaca);
    record("avulso: botão salvar lançamento", s.avulsoSalvar);
    record("avulso: sem botão IA app", s.avulsoSemIa);

    await clickSub(page, "btn-lanc-aluguel-validacao");
    s = await page.evaluate(paneSnapshotScript());
    record("validação: só painel validação", s.visCount === 1 && s.validacao, `vis=${s.visCount}`);
    record("validação: botão Processar IA", s.validacaoIa);
    record("validação: fila comprovantes app", s.validacaoFila);
    record("validação: sem bloco pesquisa", s.validacaoSemPesquisaBloco);
    record("validação: sub ativo", s.subAtivo === "btn-lanc-aluguel-validacao", s.subAtivo);

    await clickSub(page, "btn-lanc-aluguel-comprovante");
    s = await page.evaluate(paneSnapshotScript());
    record("com comprovante: só painel", s.visCount === 1 && s.comprovante, `vis=${s.visCount}`);
    record("com comprovante: zona colar", s.comprovantePaste);
    record("com comprovante: pesquisa partilhada", s.comprovanteComPesquisaBloco);
    record("com comprovante: sem fila app", s.comprovanteSemAppFila);

    await clickSub(page, "btn-lanc-aluguel-relatorios");
    s = await page.evaluate(paneSnapshotScript());
    record("relatórios: só painel", s.visCount === 1 && s.relatorios, `vis=${s.visCount}`);
    record("relatórios: 1 período", s.rel1);
    record("relatórios: 2 cliente", s.rel2);
    record("relatórios: 3 placa", s.rel3);
    record("relatórios: sem pesquisa", s.relSemPesquisaBloco);

    await page.locator("#btn-operacao-lancamento-multas").click();
    await page.waitForTimeout(500);
    const multasOk = await page.evaluate(() => {
      const aluguel = document.getElementById("operacaoInlineLancamentoAluguel");
      const multas = document.getElementById("operacaoInlineLancamentoMultas");
      const subnav = document.getElementById("operacaoLancAluguelSubnav");
      return aluguel?.classList.contains("hidden") && !multas?.classList.contains("hidden") && subnav?.classList.contains("hidden");
    });
    record("multas: fecha aluguel e oculta submenu", multasOk);

    await page.locator("#btn-operacao-lancamento-aluguel").click();
    await page.waitForTimeout(600);
    await clickSub(page, "btn-lanc-aluguel-validacao");
    await page.waitForTimeout(500);
    const reabre = await page.evaluate(() => {
      const aluguel = document.getElementById("operacaoInlineLancamentoAluguel");
      const val = document.getElementById("operacaoLancAluguelPaneValidacao");
      const subnav = document.getElementById("operacaoLancAluguelSubnav");
      return !aluguel?.classList.contains("hidden") && val && !val.classList.contains("hidden") && subnav && !subnav.classList.contains("hidden");
    });
    record("atalho validação: reabre com submenu", reabre);
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
