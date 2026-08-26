/**
 * Smoke test em produção (headless) — DK Locadora portal cadastro.
 * node scripts/test-portal-producao.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { chromium } from "playwright";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const BASE_URL = (process.env.DK_TEST_BASE_URL || "https://grupodkempreendimentos.com.br/").replace(
  /\/?$/,
  "/"
);
const IS_DEMO_TEST = /demo\.grupodkempreendimentos|git-demo-/i.test(BASE_URL);
const results = [];

function record(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} | ${name}${detail ? ` | ${detail}` : ""}`);
}

async function runSuite() {
  if (IS_DEMO_TEST) {
    const cloudDemoPre = await fetch("https://grupodkempreendimentos.com.br/api/dk-cloud-snapshot?channel=demo", {
      cache: "no-store",
    }).then((r) => (r.ok ? r.json() : {}));
    const pPre = cloudDemoPre.payload || {};
    record(
      "demo: nuvem com exactamente 10 clientes, veículos e protocolos activos",
      (pPre.dk_clientes_cadastro || []).length === 10 &&
        (pPre.dk_veiculos_cadastro || []).length === 10 &&
        (pPre.dk_locacoes_cadastro || []).length === 10,
      `c=${(pPre.dk_clientes_cadastro || []).length} v=${(pPre.dk_veiculos_cadastro || []).length} l=${(pPre.dk_locacoes_cadastro || []).length}`
    );
  }

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.setDefaultNavigationTimeout(180000);
  page.setDefaultTimeout(45000);

  try {
    await page.goto(BASE_URL, { waitUntil: "networkidle", timeout: 60000 });

    const storageInicial = await page.evaluate(() => {
      const rawC = localStorage.getItem("dk_clientes_cadastro");
      const rawV = localStorage.getItem("dk_veiculos_cadastro");
      const rawL = localStorage.getItem("dk_locacoes_cadastro");
      let clientes = [];
      let veiculos = [];
      let locacoes = [];
      try {
        clientes = rawC ? JSON.parse(rawC) : [];
      } catch {
        /* */
      }
      try {
        veiculos = rawV ? JSON.parse(rawV) : [];
      } catch {
        /* */
      }
      try {
        locacoes = rawL ? JSON.parse(rawL) : [];
      } catch {
        /* */
      }
      return {
        clientes: clientes.length,
        veiculos: veiculos.length,
        locacoes: locacoes.length,
        manual: localStorage.getItem("dk_cadastro_manual_portal_v1"),
        instalacaoLimpa: localStorage.getItem("dk_instalacao_limpa_v1"),
      };
    });
    record("modo cadastro manual ativo", storageInicial.manual === "1", `manual=${storageInicial.manual}`);
    record(
      IS_DEMO_TEST ? "demo: instalação limpa não aplicada" : "instalação limpa aplicada no browser",
      IS_DEMO_TEST
        ? storageInicial.instalacaoLimpa !== "done"
        : storageInicial.instalacaoLimpa === "done",
      `flag=${storageInicial.instalacaoLimpa}`
    );
    record(
      IS_DEMO_TEST ? "demo: cadastros carregados no browser" : "oficial: cadastro local 385 clientes, 194 veículos, 541 protocolos",
      IS_DEMO_TEST
        ? storageInicial.clientes === 10 && storageInicial.veiculos === 10 && storageInicial.locacoes === 10
        : storageInicial.clientes === 385 &&
          storageInicial.veiculos === 194 &&
          storageInicial.locacoes === 541,
      `c=${storageInicial.clientes} v=${storageInicial.veiculos} l=${storageInicial.locacoes}`
    );

    const html = await page.content();
    const portalUiVer = html.match(/portal-locadora-ui\.js\?v=([^"]+)/)?.[1] || "";
    const appJsVer = html.match(/app\.js\?v=([^"]+)/)?.[1] || "";
    const documentosJsVer = html.match(/portal-documentos\.js\?v=([^"]+)/)?.[1] || "";
    record(
      IS_DEMO_TEST ? "HTML demo com banco planilha completo" : "HTML com instalação limpa (sem Excel)",
      IS_DEMO_TEST
        ? html.includes("dk-banco-cadastro.js") && html.includes("demo-cadastros")
        : html.includes("dk-banco-cadastro-vazio") && html.includes("instalacao-limpa"),
      "scripts"
    );
    const cacheOk =
      html.includes("virgem") ||
      html.includes("instalacao-limpa") ||
      html.includes("locadora-hub") ||
      html.includes("data-auto") ||
      html.includes("mascaras");
    record("HTML com cache app/portal atualizado", cacheOk, "app.js + portal-locadora-ui.js");
    const tagSeq = await page.evaluate(() => {
      if (typeof nextTagByTipo !== "function") return { ok: false, got: "sem nextTagByTipo" };
      const fromFmt = nextTagByTipo("CARRO", [
        { tipo: "CARRO", tag: "DKCR - 015" },
        { tipo: "CARRO", codigo: "DKCR-014" },
        { tipo: "MOTO", tag: "DKMT - 171" },
      ]);
      const fromCount = nextTagByTipo(
        "CARRO",
        Array.from({ length: 15 }, (_, i) => ({ tipo: "CARRO", placa: `AAA0A${String(i).padStart(2, "0")}` }))
      );
      const moto = nextTagByTipo("MOTO", [{ tipo: "MOTO", tag: "DKMT001" }]);
      return { ok: fromFmt === "DKCR - 016" && fromCount === "DKCR - 016" && moto === "DKMT - 002", fromFmt, fromCount, moto };
    });
    record(
      "tag veículo DK+XX - YYY (CR carro / MT moto, próximo número)",
      tagSeq.ok === true,
      `fmt=${tagSeq.fromFmt} count=${tagSeq.fromCount} moto=${tagSeq.moto}`
    );
    record(
      "views hub locadora no HTML",
      html.includes("view-locadora-hub") && html.includes("view-locadora-cliente")
    );
    record(
      "Sistema MIEL peça 1 no HTML",
      html.includes("view-miel") &&
        html.includes("portal-miel-ui.js") &&
        html.includes("miel-pagina-inicial") &&
        html.includes("miel-app__diretoria"),
      IS_DEMO_TEST ? "demo" : "html"
    );
    record(
      "Sistema MIEL etapa 2 Administrativo no HTML",
      html.includes("portal-miel-admin.js") &&
        html.includes("mielPanelAdministrativo") &&
        html.includes('data-miel-panel="administrativo"'),
      IS_DEMO_TEST ? "demo" : "html"
    );
    record(
      "Sistema MIEL etapa 3 Cadastro Clientes no HTML",
      html.includes("portal-miel-cad-clientes.js") &&
        html.includes("mielPanelCadClientes") &&
        html.includes('data-miel-panel="cad-clientes"'),
      IS_DEMO_TEST ? "demo" : "html"
    );
    record(
      "Sistema MIEL etapa 4 Cadastro Veículos no HTML",
      html.includes("portal-miel-cad-veiculos.js") &&
        html.includes("mielPanelCadVeiculos") &&
        html.includes('data-miel-panel="cad-veiculos"'),
      IS_DEMO_TEST ? "demo" : "html"
    );
    record(
      "Sistema MIEL etapa 5 Relação Clientes no HTML",
      html.includes("portal-miel-relacao-clientes.js") &&
        html.includes("mielPanelRelacaoClientes") &&
        html.includes('data-miel-panel="relacao-clientes"'),
      IS_DEMO_TEST ? "demo" : "html"
    );
    record(
      "Sistema MIEL permissão colaborador no HTML",
      html.includes("portalColabAceSistemaMiel") && html.includes("Acesso ao sistema MIEL"),
      IS_DEMO_TEST ? "demo" : "html"
    );
    record(
      "secção comprovantes app cliente no portal",
      html.includes("portalComprovanteClienteLista") &&
        (html.includes("App cliente") || html.includes("portal-lanc-cliente-comprovacao"))
    );

    if (IS_DEMO_TEST) {
      await page.evaluate(() => {
        localStorage.setItem(
          "dk_sessao_cliente",
          JSON.stringify({ tipo: "admin", role: "owner", cpf: "03037897430", nome: "Admin E2E" })
        );
        localStorage.setItem("dk_portal_sessao_build", "20260521admin-nav");
        if (typeof window.__DK_portalRefreshMielAcesso === "function") window.__DK_portalRefreshMielAcesso();
      });
      await page.waitForTimeout(200);
      const mielBtn = page.locator('#view-home [data-go="miel"]').first();
      if (await mielBtn.isVisible().catch(() => false)) await mielBtn.click();
      await page.waitForTimeout(700);
      const mielState = await page.evaluate(() => ({
        active: document.getElementById("view-miel")?.classList.contains("view--active"),
        title: document.getElementById("mielMainTitle")?.textContent?.trim() || "",
        hero: Boolean(document.querySelector(".miel-pagina-inicial__hero")),
        nav: document.querySelectorAll("[data-miel-nav]").length,
        diretoria: document.querySelectorAll(".miel-app__diretoria tbody tr").length,
        dateOk: (document.getElementById("mielAppDataLocal")?.textContent || "").includes("Petrolina-PE"),
      }));
      record(
        "demo: MIEL peça 1 Página Inicial aberta",
        mielState.active &&
          mielState.title === "Página Inicial" &&
          mielState.hero &&
          mielState.nav >= 10 &&
          mielState.dateOk,
        `nav=${mielState.nav}`
      );
      record(
        "demo: MIEL diretoria (3 cargos)",
        mielState.diretoria === 3,
        `linhas=${mielState.diretoria}`
      );

      const admBtn = page.locator('[data-miel-nav="administrativo"]').first();
      if (await admBtn.isVisible().catch(() => false)) await admBtn.click();
      await page.waitForTimeout(600);
      const admState = await page.evaluate(() => ({
        title: document.getElementById("mielMainTitle")?.textContent?.trim() || "",
        banner: (document.querySelector(".miel-admin-grid__banner td")?.textContent || "").trim(),
        headers: [...document.querySelectorAll(".miel-admin-grid__headers td")].map((el) => el.textContent?.trim()),
        gridCols: document.querySelector(".miel-admin-grid")?.classList.contains("miel-admin-grid--2col") ? 2 : 0,
        gridBtns: document.querySelectorAll(".miel-admin-grid__hit").length,
        panelVisible: !document.getElementById("mielPanelAdministrativo")?.classList.contains("hidden"),
      }));
      record(
        "demo: MIEL etapa 2 Administrativo",
        admState.title === "Administrativo" &&
          admState.banner === "Administrativo" &&
          admState.headers.length === 2 &&
          admState.gridCols === 2 &&
          admState.gridBtns >= 14 &&
          admState.panelVisible,
        `btns=${admState.gridBtns}`
      );

      await page.locator('[data-miel-admin-action="Cadastro de Clientes"]').first().click().catch(() => null);
      await page.waitForTimeout(500);
      const cadState = await page.evaluate(() => {
        const panel = document.getElementById("mielPanelCadClientes");
        const visible = Boolean(panel && !panel.classList.contains("hidden"));
        const grid = visible ? panel.querySelector(".miel-sheet__grid") : null;
        return {
          title: document.getElementById("mielMainTitle")?.textContent?.trim() || "",
          table: Boolean(grid),
          rows: visible ? panel.querySelectorAll(".miel-sheet__row--data").length : 0,
          shapes: visible ? panel.querySelectorAll(".miel-sheet__shape").length : 0,
          panelVisible: visible,
        };
      });
      record(
        "demo: MIEL etapa 3 Cadastro Clientes",
        cadState.title === "Cadastro de Clientes" &&
          cadState.table &&
          cadState.rows >= 9 &&
          cadState.rows <= 11 &&
          cadState.shapes >= 4 &&
          cadState.panelVisible,
        cadState.title
      );

      await page.locator('[data-miel-nav="administrativo"]').first().click().catch(() => null);
      await page.waitForTimeout(300);
      await page.locator('[data-miel-admin-action="Cadastro de Veículos"]').first().click().catch(() => null);
      await page.waitForTimeout(500);
      const veicState = await page.evaluate(() => {
        const panel = document.getElementById("mielPanelCadVeiculos");
        const visible = Boolean(panel && !panel.classList.contains("hidden"));
        const grid = visible ? panel?.querySelector(".miel-sheet__grid") : null;
        return {
          title: document.getElementById("mielMainTitle")?.textContent?.trim() || "",
          table: Boolean(grid),
          rows: visible ? panel.querySelectorAll(".miel-sheet__row--data").length : 0,
          panelVisible: visible,
          veicCount: (window.__DK_MIEL_CADASTROS?.veiculos || []).length,
        };
      });
      record(
        "demo: MIEL etapa 4 Cadastro Veículos",
        veicState.title === "Cadastro de Veículos" &&
          veicState.table &&
          veicState.rows >= 9 &&
          veicState.rows <= 11 &&
          veicState.veicCount >= 9 &&
          veicState.veicCount <= 11 &&
          veicState.panelVisible,
        veicState.title
      );

      await page.locator('[data-miel-nav="administrativo"]').first().click().catch(() => null);
      await page.waitForTimeout(300);
      await page.locator('[data-miel-admin-action="Relação de Clientes"]').first().click().catch(() => null);
      await page.waitForTimeout(500);
      const relState = await page.evaluate(() => {
        const panel = document.getElementById("mielPanelRelacaoClientes");
        const visible = Boolean(panel && !panel.classList.contains("hidden"));
        const grid = visible ? panel?.querySelector(".miel-sheet__grid") : null;
        return {
          title: document.getElementById("mielMainTitle")?.textContent?.trim() || "",
          sheetTitle: grid?.textContent?.includes("# Relação de Clientes Cadastrados no Sistema")
            ? "# Relação de Clientes Cadastrados no Sistema"
            : "",
          rows: visible ? panel.querySelectorAll(".miel-sheet__row--data").length : 0,
          panelVisible: visible,
        };
      });
      record(
        "demo: MIEL etapa 5 Relação Clientes",
        relState.title === "Relação de Clientes" &&
          relState.sheetTitle === "# Relação de Clientes Cadastrados no Sistema" &&
          relState.rows >= 9 &&
          relState.rows <= 11 &&
          relState.panelVisible,
        relState.title
      );

      await page.locator("#view-miel [data-inicio]").first().click().catch(() => null);
      await page.waitForTimeout(500);
    }

    record(
      "lançamento com comprovante operador (extrair + confirmar)",
      html.includes("portalOperadorComprovantePasteZone") &&
        html.includes("portalOperadorComprovanteExtrairIaBtn") &&
        html.includes("portalOperadorComprovanteConfirmarBtn") &&
        html.includes("portalOperadorComprovanteResumo")
    );
    const htmlLancAluguel = await fetch(BASE_URL, { cache: "no-store" }).then((r) => r.text());
    record(
      "submenu lançamento aluguel (só avulso ativo)",
      htmlLancAluguel.includes("btn-lanc-aluguel-avulso") &&
        htmlLancAluguel.includes('id="btn-lanc-aluguel-comprovante"') &&
        /btn-lanc-aluguel-comprovante[^>]*hidden/.test(htmlLancAluguel) &&
        /btn-lanc-aluguel-validacao[^>]*hidden/.test(htmlLancAluguel) &&
        /btn-lanc-aluguel-relatorios[^>]*hidden/.test(htmlLancAluguel) &&
        !/btn-lanc-aluguel-avulso[^>]*hidden/.test(htmlLancAluguel)
    );
    const portalUiVerLanc = html.match(/portal-locadora-ui\.js\?v=([^"]+)/)?.[1] || "";
    const portalUiLancJs = await fetch(`${BASE_URL}portal-locadora-ui.js?v=${portalUiVerLanc || "latest"}`, {
      cache: "no-store",
    }).then((r) => (r.ok ? r.text() : ""));
    record(
      "lançamento aluguel calendário anual (bloco + modal)",
      htmlLancAluguel.includes("operacaoLancAluguelValorSimples") &&
        htmlLancAluguel.includes("operacaoLancAluguelLancBlocoBtn") &&
        htmlLancAluguel.includes("portalLancAluguelCalModal") &&
        htmlLancAluguel.includes("portal-lanc-aluguel-calendario.js")
    );
    record(
      "lançamento aluguel só avulso (flag JS)",
      portalUiLancJs.includes("OPERACAO_LANC_ALUGUEL_SUB_ATIVOS") &&
        portalUiLancJs.includes('new Set(["avulso"])') &&
        portalUiLancJs.includes("__DK_persistPortalLancAluguelCalendarioAno") &&
        portalUiLancJs.includes("portalLancAluguelDiaPagamentoColIdx")
    );
    record(
      "sugestão de pagamento = valor do plano",
      portalUiLancJs.includes("portalValorPlanoPagamentoSugeridoFmt") &&
        portalUiLancJs.includes("valSimples.value = valPlano") &&
        portalUiLancJs.includes("resumo?.valorPlano"),
      "VALOR (R$) no lançamento avulso usa aluguel + investimento"
    );
    const calJsVer = html.match(/portal-lanc-aluguel-calendario\.js\?v=([^"]+)/)?.[1] || "";
    const calJs = await fetch(`${BASE_URL}portal-lanc-aluguel-calendario.js?v=${calJsVer || "latest"}`, {
      cache: "no-store",
    }).then((r) => (r.ok ? r.text() : ""));
    record(
      "calendário aluguel dia pagamento por cliente",
      calJs.includes("portal-lanc-cal-val--dia-pagamento") &&
        calJs.includes("diaPagamentoCol") &&
        calJs.includes("portal-lanc-cal-dow--pagamento") &&
        calJs.includes("askConfirmAlteracoesCalendario") &&
        htmlLancAluguel.includes("portalLancAluguelCalConfirm")
    );
    record(
      "PDF partilhar e-mail WhatsApp",
      html.includes("portalPdfPartilharBtn") &&
        html.includes("portalPdfPartilharEmailBtn") &&
        html.includes("portalPdfPartilharWhatsAppBtn")
    );
    record(
      "botões baixar app cliente e operação na home",
      html.includes("home-app-btn--cliente") &&
        html.includes("home-app-btn--operacao") &&
        html.includes('id="homeBaixarAppCliente"') &&
        html.includes('id="homeBaixarAppOperacao"') &&
        html.includes("/instalar") &&
        html.includes("Baixar app cliente") &&
        html.includes("Baixar app operação") &&
        html.includes("dk-pwa-update.js")
    );
    {
      const pwaVer = (html.match(/dk-pwa-update\.js\?v=([^"'&]+)/) || [])[1] || "latest";
      const pwaJs = await fetch(`${BASE_URL}dk-pwa-update.js?v=${pwaVer}`, { cache: "no-store" }).then((r) =>
        r.ok ? r.text() : ""
      );
      record(
        "PWA atualiza sem deslogar a equipa",
        pwaJs.includes("scheduleSessionSafeReload") &&
          pwaJs.includes("NÃO apagar dk_sessao_cliente") &&
          !/controllerchange[\s\S]{0,400}removeItem\(["']dk_sessao_cliente["']\)/.test(pwaJs),
        "reload adiado; sessão preservada"
      );
    }
    {
      const portalUiVerInstall = (html.match(/portal-locadora-ui\.js\?v=([^"'&]+)/) || [])[1] || "latest";
      const clienteAppVerInstall =
        (await fetch(new URL("cliente.html", BASE_URL).href, { cache: "no-store" })
          .then((r) => (r.ok ? r.text() : ""))
          .then((t) => (t.match(/cliente-app\.js\?v=([^"'&]+)/) || [])[1])) || "latest";
      const portalUiInstallJs = await fetch(`${BASE_URL}portal-locadora-ui.js?v=${portalUiVerInstall}`, {
        cache: "no-store",
      }).then((r) => (r.ok ? r.text() : ""));
      const clienteAppInstallJs = await fetch(`${BASE_URL}cliente-app.js?v=${clienteAppVerInstall}`, {
        cache: "no-store",
      }).then((r) => (r.ok ? r.text() : ""));
      const instalarJs = await fetch(`${BASE_URL}instalar-cliente.js?v=20260821install-no-creds`, {
        cache: "no-store",
      }).then((r) => (r.ok ? r.text() : ""));
      record(
        "install app sem CPF/senha na URL nem localStorage",
        portalUiInstallJs.includes('return "/instalar"') &&
          portalUiInstallJs.includes("dk_cliente_install_auth") &&
          portalUiInstallJs.includes('localStorage.removeItem("dk_cliente_gate_persist")') &&
          !portalUiInstallJs.includes('instalar: "1", cpf') &&
          clienteAppInstallJs.includes("stripSensitiveQueryFromUrl") &&
          clienteAppInstallJs.includes("INSTALL_AUTH_KEY") &&
          clienteAppInstallJs.includes("sanitizeGatePayload") &&
          instalarJs.includes("stripSensitiveQueryFromUrl") &&
          instalarJs.includes("clearCredentialCaches"),
        "URL /instalar · gate só session · sem senha"
      );
    }
    record(
      "depósito documentos CRLV contratos multas (sem IA)",
      html.includes("btn-locadora-documentos") &&
        html.includes("panel-documentos-locadora") &&
        html.includes("documentosBuscaTitulo") &&
        html.includes('name="documentosBuscaTipo"') &&
        html.includes("documentosInputCrlv") &&
        html.includes("documentosInputContrato") &&
        html.includes("documentosInputMulta") &&
        html.includes("documentosDropCrlv") &&
        html.includes("documentosDropContrato") &&
        html.includes("documentosDropMulta") &&
        html.includes("documentosRelatorioCrlv") &&
        html.includes("documentosRelatorioContratoAtivo") &&
        html.includes("documentosRelatorioContratoInativo") &&
        html.includes("documentosSyncStatus") &&
        html.includes("documentosMaquinaRotulo") &&
        html.includes("portal-documentos.js") &&
        !html.includes("portal-patrimonio.js") &&
        !html.includes("patrimonioIaBgBadge") &&
        !html.includes("patrimonioRelatorioModal")
    );
    record(
      "botão FINANCEIRO entre Documentos e Área do cliente",
      html.includes("btn-locadora-financeiro") &&
        html.includes(">FINANCEIRO</button>") &&
        html.includes('id="view-financeiro"') &&
        html.includes("panel-financeiro-locadora") &&
        html.includes("btn-fin-mod-quantitativo") &&
        html.includes("btn-fin-mod-relacao-pagamento") &&
        html.includes("financeiroPaneRelacaoPagamento") &&
        html.includes("fin-relacao-sticky-head") &&
        html.includes("Relação de pagamento por cliente") &&
        html.includes("finRelStatusAtivo") &&
        html.includes("finRelSaldoNegativo") &&
        html.includes("finRelPlanoMinhaMoto") &&
        html.includes("btn-fin-mod-receita-plano") &&
        html.includes("btn-fin-mod-receita-modelo") &&
        html.includes("btn-fin-mod-localizacao") &&
        html.includes("btn-fin-mod-dia-semana") &&
        html.includes("btn-fin-mod-intervalo") &&
        html.includes("btn-fin-mod-despesas") &&
        html.includes("financeiroPaneDespesas") &&
        html.includes("05 Placa") &&
        html.includes("finDespesaPlacasList") &&
        html.includes("08-MANUTENÇÃO") &&
        html.includes("btn-fin-mod-despesas-graf") &&
        html.includes("financeiroPaneDespesasGraf") &&
        html.includes("finDespOleoChart") &&
        html.includes("dk-despesas-historico.js") &&
        html.includes("btn-fin-mod-analise") &&
        html.includes("financeiroPaneAnalise") &&
        html.includes("01/09/2026") &&
        html.includes("btn-fin-mod-previsao") &&
        html.includes("financeiroPanePrevisao") &&
        html.includes("btn-financeiro-santander") &&
        html.includes("btn-financeiro-sicredi") &&
        html.includes("portal-financeiro.js") &&
        html.includes("portal-financeiro-modulos.js") &&
        html.includes("Teclas") &&
        html.includes("relação por cliente") &&
        html.indexOf("btn-locadora-documentos") < html.indexOf("btn-locadora-financeiro") &&
        html.indexOf("btn-locadora-financeiro") < html.indexOf("btn-locadora-preview-cliente")
    );
    const portalFinModVer = html.match(/portal-financeiro-modulos\.js\?v=([^"]+)/)?.[1] || "";
    const portalFinModJs = await fetch(`${BASE_URL}portal-financeiro-modulos.js?v=${portalFinModVer || "latest"}`, {
      cache: "no-store",
    }).then((r) => (r.ok ? r.text() : ""));
    record(
      "financeiro atalhos teclado 1–0 nos módulos numerados",
      portalFinModJs.includes("FIN_MOD_ATALLHO") &&
        portalFinModJs.includes("bindAtalhosTecladoModulos") &&
        portalFinModJs.includes('"0": "relacao-pagamento"') &&
        portalFinModJs.includes('"1": "quantitativo"') &&
        portalFinModJs.includes("renderRelacaoPagamento") &&
        portalFinModJs.includes("filtrarRelacaoPagamento") &&
        portalFinModJs.includes("rateioPagoAluguelInvestimento") &&
        portalFinModJs.includes("fin-rel-nome--atraso") &&
        portalFinModJs.includes("valorDevidoAteHojeNum") &&
        portalFinModJs.includes("abrirExcelFiltroPopup") &&
        portalFinModJs.includes("aplicarExcelFiltroSort") &&
        portalFinModJs.includes("fin-excel-filter-btn") &&
        portalFinModJs.includes("financeiroModulosVisivel"),
      "0 = relação; filtros Excel no cabeçalho; situação/plano/saldo; atraso e rateio"
    );
    const indexFresh = await fetch(BASE_URL, { cache: "no-store" }).then((r) =>
      r.ok ? r.text() : ""
    );
    record(
      "cadastro veículo resumo frota no HTML",
      indexFresh.includes("operacaoVeiculoResumoGrid") &&
        indexFresh.includes("operacao-veiculo-resumo-frota")
    );
    const portalUiCliTotVer =
      (indexFresh.match(/portal-locadora-ui\.js\?v=([^"'&]+)/) || [])[1] || "latest";
    const portalUiCliTotJs = await fetch(`${BASE_URL}portal-locadora-ui.js?v=${portalUiCliTotVer}`, {
      cache: "no-store",
    }).then((r) => (r.ok ? r.text() : ""));
    record(
      "cadastro cliente total e próximo código no formulário",
      indexFresh.includes("operacaoClienteTotalCadastrados") &&
        indexFresh.includes("operacao-cliente-total") &&
        portalUiCliTotJs.includes("getOperacaoProximoClientePlaceholder") &&
        portalUiCliTotJs.includes("proximo cliente") &&
        portalUiCliTotJs.includes("refreshOperacaoClienteTotalCadastrados"),
      "total ao lado do título; placeholder Cód. = total+1"
    );
    record(
      "cadastro veículo total motos e carros no formulário",
      indexFresh.includes("operacaoVeiculoTotalCadastrados") &&
        portalUiCliTotJs.includes("refreshOperacaoVeiculoTotalCadastrados") &&
        portalUiCliTotJs.includes("countOperacaoVeiculosMotosCarros"),
      "totais ao lado de Dados do veículo"
    );
    record(
      "cadastro sem opção real/teste (demo é o ambiente de testes)",
      !indexFresh.includes("operacaoClienteAmbienteWrap") &&
        !indexFresh.includes('name="operacaoClienteAmbiente"') &&
        !indexFresh.includes("operacaoVeiculoAmbienteWrap") &&
        !indexFresh.includes('name="operacaoLocacaoAmbiente"') &&
        !indexFresh.includes("operacaoLocacaoAmbientePersist") &&
        !indexFresh.includes("portal-ambiente-admin") &&
        indexFresh.includes("operacaoClienteSenhaWrap")
    );
    record(
      "API dk-cliente-geo responde JSON",
      (await fetch(`${BASE_URL}api/dk-cliente-geo`, { cache: "no-store" }).then(async (r) => {
        const t = await r.text();
        try {
          const j = JSON.parse(t);
          return r.status === 200 && j.ok === true && Array.isArray(j.clientes);
        } catch {
          return false;
        }
      }))
    );
    const temaHtmlOk = IS_DEMO_TEST
      ? html.includes("demo-cadastros") || html.includes("__DK_IS_DEMO_DEPLOY__")
      : html.includes("demo-cadastros") ||
        html.includes("20260607virgem") ||
        html.includes("instalacao-limpa");
    const temaImgOk = IS_DEMO_TEST
      ? true
      : await fetch(`${BASE_URL}images/dk-locadora-showroom-bg.png`, { cache: "no-store" }).then((r) => r.ok);
    const temaColorMeta = await page.evaluate(() => {
      const m = document.querySelector('meta[name="theme-color"]');
      return m ? String(m.getAttribute("content") || "").toLowerCase() : "";
    });
    const temaColorOk = IS_DEMO_TEST
      ? temaColorMeta === "#f97316" || temaColorMeta === "#050505"
      : temaColorMeta === "#050505";
    record(
      "tema vermelho preto + fundo showroom",
      temaHtmlOk && temaColorOk && temaImgOk,
      IS_DEMO_TEST ? `theme-color=${temaColorMeta}` : ""
    );
    record(
      "logo DK Locadora no site e botao app",
      html.includes("dk-locadora-logo.png") &&
        html.includes("home-app-downloads") &&
        (await fetch(`${BASE_URL}images/dk-locadora-logo.png`, { cache: "no-store" }).then((r) => r.ok))
    );
    record(
      "icone PWA DK Locadora (substitui laranja)",
      (await fetch(`${BASE_URL}icons/icon-cliente-192.png`, { cache: "no-store" }).then(async (r) => {
        if (!r.ok) return false;
        const buf = await r.arrayBuffer();
        return buf.byteLength > 20000;
      }))
    );
    record(
      "login empresa painel compacto",
      html.includes("portal-panel--auth") && html.includes('id="panel-login"')
    );
    const appLoginJs = await fetch(`${BASE_URL}app.js?v=20260609login-manut`, { cache: "no-store" }).then((r) =>
      r.ok ? r.text() : ""
    );
    const portalLoginUiJs = await fetch(`${BASE_URL}portal-locadora-ui.js?v=20260609login-manut`, {
      cache: "no-store",
    }).then((r) => (r.ok ? r.text() : ""));
    record(
      "login empresa: demo sem bloqueio manutenção + aviso no portal",
      appLoginJs.includes("__DK_IS_DEMO_DEPLOY__") &&
        appLoginJs.includes("getMaintenanceNotice") &&
        portalLoginUiJs.includes("getMaintenanceNotice") &&
        portalLoginUiJs.includes("login-feedback"),
      "demo 24h; oficial 02h–03h com mensagem visível"
    );
    const deployChannelJs = await fetch(`${BASE_URL}dk-deploy-channel.js?v=20260521demo-icon`, {
      cache: "no-store",
    }).then((r) => (r.ok ? r.text() : ""));
    const oficialGuardJs = await fetch(`${BASE_URL}dk-oficial-cadastro-guard.js?v=20260607oficial-guard`, {
      cache: "no-store",
    }).then((r) => (r.ok ? r.text() : ""));
    record(
      "ambiente demo/oficial (dk-deploy-channel + faixa)",
      html.includes("dk-deploy-channel.js") &&
        html.includes("dk-demo-env-banner") &&
        deployChannelJs.includes("__DK_IS_DEMO_DEPLOY__") &&
        deployChannelJs.includes("demo.grupodkempreendimentos.com.br")
    );
    record(
      "icone PWA demo com contorno laranja",
      deployChannelJs.includes("applyDemoPwaBranding") &&
        deployChannelJs.includes("icon-cliente-demo-192.png") &&
        deployChannelJs.includes("manifest-cliente-demo.webmanifest") &&
        (IS_DEMO_TEST
          ? await fetch(`${BASE_URL}icons/icon-cliente-demo-192.png`, { cache: "no-store" }).then(
              async (r) => r.ok && (await r.arrayBuffer()).byteLength > 15000
            )
          : await fetch(`${BASE_URL}icons/icon-cliente-demo-192.png`, { cache: "no-store" }).then(
              (r) => r.ok
            ))
    );
    if (!IS_DEMO_TEST) {
      const guardUi = await page.evaluate(() => ({
        guardLoaded: typeof window.__DK_sanitizeOficialCloudPayload === "function",
        guardActive: window.__DK_isOficialCadastroGuardActive?.() === true,
        blockedOld: (() => {
          const p = window.__DK_sanitizeOficialCloudPayload({
            dk_clientes_cadastro: [{ cpf: "12345678901", nome: "Antigo", dataCadastro: "01/01/2020" }],
            dk_locacoes_cadastro: [{ cpf: "12345678901", inicio: "01/01/2020", numeroContrato: "2020010101" }],
          });
          return (
            (p.dk_clientes_cadastro || []).length === 0 && (p.dk_locacoes_cadastro || []).length === 0
          );
        })(),
        retroOk: (() => {
          const p = window.__DK_sanitizeOficialCloudPayload({
            dk_clientes_cadastro: [
              {
                cpf: "06242649551",
                nome: "RETRO",
                dataCadastro: "sex 21/03/2025",
                cadastroRetroativo: true,
                codigo: "0001",
              },
            ],
            dk_locacoes_cadastro: [
              {
                cpf: "06242649551",
                numeroContrato: "2025032101",
                placa: "ABC1D23",
                inicio: "21/03/2025",
                cadastroRetroativo: true,
                origemPortal: true,
              },
            ],
          });
          return (p.dk_clientes_cadastro || []).length === 1 && (p.dk_locacoes_cadastro || []).length === 1;
        })(),
      }));
      record(
        "oficial: bloqueio cadastros anteriores a hoje",
        oficialGuardJs.includes("__DK_sanitizeOficialCloudPayload") &&
          guardUi.guardLoaded &&
          guardUi.guardActive &&
          guardUi.blockedOld &&
          guardUi.retroOk,
        `active=${guardUi.guardActive}`
      );
      const cloudOficial = await fetch(`${BASE_URL}api/dk-cloud-snapshot`, { cache: "no-store" }).then((r) =>
        r.ok ? r.json() : {}
      );
      const pOf = cloudOficial.payload || {};
      const clientesOf = pOf.dk_clientes_cadastro || [];
      const retroOf = clientesOf.filter((c) => c?.cadastroRetroativo === true);
      record(
        "oficial: nuvem 385 clientes, 194 veículos, 541 protocolos",
        clientesOf.length === 385 &&
          retroOf.length >= 20 &&
          (pOf.dk_veiculos_cadastro || []).length === 194 &&
          (pOf.dk_locacoes_cadastro || []).length === 541,
        `c=${clientesOf.length} retro=${retroOf.length} v=${(pOf.dk_veiculos_cadastro || []).length} l=${(pOf.dk_locacoes_cadastro || []).length}`
      );
    }
    if (IS_DEMO_TEST) {
      const demoUi = await page.evaluate(() => ({
        channel: window.__DK_DEPLOY_CHANNEL__,
        isDemo: window.__DK_IS_DEMO_DEPLOY__,
        snapshotLabel:
          typeof window.__DK_deploySnapshotLabel === "function"
            ? window.__DK_deploySnapshotLabel()
            : "",
        bannerVisible: !document.getElementById("dk-demo-env-banner")?.classList.contains("hidden"),
      }));
      record(
        "demo: canal e faixa amarela activos",
        demoUi.channel === "demo" && demoUi.isDemo === true && demoUi.bannerVisible,
        `channel=${demoUi.channel}`
      );
      record(
        "demo: nuvem separada do oficial (snapshot demo)",
        demoUi.snapshotLabel === "demo",
        `label=${demoUi.snapshotLabel}`
      );
    }
    record(
      "admin logado banner e preview cliente",
      html.includes("portal-admin-banner") &&
        html.includes("portal-admin-cliente-cpf") &&
        html.includes("LOGADO COMO ADMINISTRADOR") &&
        (await fetch(`${BASE_URL}portal-locadora-ui.js?v=${portalUiVer || "latest"}`, { cache: "no-store" }).then((r) =>
          r.ok ? r.text() : ""
        )).includes("isPortalAdministradorLogado")
    );
    record(
      "pesquisa contrato preenche placa automaticamente",
      (await fetch(`${BASE_URL}portal-locadora-ui.js?v=${portalUiVer || "latest"}`, { cache: "no-store" }).then((r) =>
        r.ok ? r.text() : ""
      )).includes("protoNormAtual") && html.includes("operacaoLancAluguelPlacaBusca")
    );
    const appJsProto = await fetch(`${BASE_URL}app.js?v=${appJsVer || "latest"}`, { cache: "no-store" }).then((r) =>
      r.ok ? r.text() : ""
    );
    const portalUiProto = await fetch(`${BASE_URL}portal-locadora-ui.js?v=${portalUiVer || "latest"}`, {
      cache: "no-store",
    }).then((r) => (r.ok ? r.text() : ""));
    record(
      "protocolo imutavel (merge por numero + admin edita)",
      appJsProto.includes("byNc.set(nc") &&
        appJsProto.includes("isCadastroManualPortalMode") &&
        portalUiProto.includes("findPortalLocacaoByProtocolo") &&
        portalUiProto.includes("operacaoLocacaoProtocoloAdminBusca") &&
        portalUiProto.includes("getOperacaoProtocoloMaisRecente") &&
        portalUiProto.includes("refreshOperacaoLocacaoProtocoloAdminPlaceholder") &&
        html.includes("operacaoLocacaoProtocoloAdminBusca"),
      "nuvem/local + busca admin"
    );
    record(
      "cadastro locação busca cliente por código",
      html.includes("operacaoLocacaoClienteCodigo") &&
        portalUiProto.includes("applyOperacaoLocacaoClienteFromCodigo") &&
        portalUiProto.includes("findPortalClienteByCodigoBusca") &&
        portalUiProto.includes("refreshOperacaoLocacaoCodigoPlaceholder") &&
        portalUiProto.includes("Último cliente cadastrado"),
      "campo CÓD. + placeholder do último cliente"
    );
    record(
      "cadastro locação confirmação com resumo",
      html.includes("portalLocacaoConfirmModal") &&
        html.includes("portalLocacaoConfirmResumo") &&
        portalUiProto.includes("openPortalLocacaoConfirmModal") &&
        portalUiProto.includes("Confirmar cadastro de locação") &&
        portalUiProto.includes("Confirmar finalização da locação"),
      "modal com protocolo, cliente, placa, plano e valor"
    );
    record(
      "protocolo = data inicio AAAAMMDDXX (nunca data de hoje)",
      portalUiProto.includes("portalIsProtocoloAlignedWithInicio") &&
        portalUiProto.includes("portalProtocoloPrefixFromInicioBr") &&
        portalUiProto.includes("Sem data de início não há protocolo") &&
        appJsProto.includes("Protocolo inválido. O número deve ser AAAAMMDDXX") &&
        !/proximoProtocoloPortalAaaammddXX\(date = new Date\(\)\)/.test(portalUiProto),
      "bloqueia prefixo desalinhado no cadastro"
    );
    const cloudSyncJs = await fetch(`${BASE_URL}portal-supabase-sync.js`, { cache: "no-store" }).then((r) =>
      r.ok ? r.text() : ""
    );
    record(
      "trocar tela: pull só após upload confirmado neste PC",
      cloudSyncJs.includes("awaitAutoCloudPushConfirmed") &&
        cloudSyncJs.includes("runTrackedCloudPush") &&
        cloudSyncJs.includes("await_push_failed") &&
        cloudSyncJs.includes("bypassLocalAuthority") &&
        portalUiProto.includes("portalOperacaoOnScreenChange") &&
        portalUiProto.includes("__DK_pullFromCloudOnScreenChange"),
      "salvar=upload; trocar tela espera push OK antes do download"
    );
    const stylesFitCss = await fetch(`${BASE_URL}styles.css`, { cache: "no-store" }).then((r) =>
      r.ok ? r.text() : ""
    );
    record(
      "operação cabe na viewport sem scroll da página",
      stylesFitCss.includes("#panel-operacao-locadora:not(.hidden)") &&
        stylesFitCss.includes("sem «rodar a bolinha»") &&
        stylesFitCss.includes("operacao-veiculo-split") &&
        stylesFitCss.includes("max-width: none") &&
        stylesFitCss.includes("portal-body--equipa-sessao #view-unit") &&
        html.includes("operacaoVeiculoFrotaFiltro") &&
        portalUiProto.includes("portalVeiculoMatchesFrotaFiltro") &&
        html.includes("styles.css?v="),
      "largura total do monitor + frota ao lado com filtro"
    );
    const guardVer = html.match(/dk-oficial-cadastro-guard\.js\?v=([^"]+)/)?.[1] || "latest";
    const guardJs = await fetch(`${BASE_URL}dk-oficial-cadastro-guard.js?v=${guardVer}`, {
      cache: "no-store",
    }).then((r) => (r.ok ? r.text() : ""));
    record(
      "cadastros operacionais nunca somem (origemPortal + merge)",
      appJsProto.includes("isProtectedCadastroKey") &&
        appJsProto.includes("allowShrink === true") &&
        (guardJs.includes("origemPortal === true) return true") ||
          /origemPortal === true\) return true/.test(guardJs)) &&
        cloudSyncJs.includes("demoTenReplace") &&
        cloudSyncJs.includes("DK_IMMUTABLE_CADASTRO_KEYS.has(k) && !demoTenReplace"),
      "saveCadastro une historico; guarda mantem portal; pull nao substitui"
    );
    record(
      "colaboradores nunca somem (merge CPF + pull Redis sem Supabase)",
      appJsProto.includes("mergeFuncionariosAccessByCpf") &&
        appJsProto.includes("dkManterSessaoEquipa") &&
        appJsProto.includes("persistFuncionariosAccessLocalOnly") &&
        cloudSyncJs.includes('k === "dk_funcionarios_access"') &&
        cloudSyncJs.includes("__DK_portalRenderColaboradoresLista") &&
        cloudSyncJs.includes("runAutoPullFromCloudOnce") &&
        portalUiProto.includes("__DK_portalRenderColaboradoresLista") &&
        portalUiProto.includes("loginAt: Date.now()"),
      "uniao por CPF; novo separador nao desloga"
    );
    record(
      "picker protocolo locacao apos CPF e nuvem",
      portalUiProto.includes("portalLocacaoCpfDigitsMatch") &&
        portalUiProto.includes("refreshOperacaoLocacaoProtocoloPicker({ force: true })") &&
        portalUiProto.includes("portal-locacao-proto-opt--ativo") &&
        portalUiProto.includes("portal-locacao-proto-opt--carro") &&
        cloudSyncJs.includes("__DK_portalRefreshOperacaoDeferred"),
      "CPF + sync nuvem atualiza select"
    );
    const cssProto = await fetch(`${BASE_URL}styles.css`, { cache: "no-store" }).then((r) =>
      r.ok ? r.text() : ""
    );
    record(
      "picker protocolo carro marrom (nao verde generico)",
      portalUiProto.includes("portal-locacao-proto-select--carro") &&
        portalUiProto.includes("portalTextoSugereVeiculoCarro") &&
        cssProto.includes("portal-locacao-proto-select--carro") &&
        cssProto.includes("#c4a484") &&
        !cssProto.includes("portal-locacao-proto-select--ativo"),
      "modalidade carro = marrom"
    );
    record(
      "DK MEU TRANSPORTE: bolinhas CARRO (marrom) e MOTO (verde)",
      html.includes("operacaoLocacaoModalidadeWrap") &&
        html.includes("operacaoLocacaoModalidadeCarro") &&
        html.includes("operacaoLocacaoModalidadeMoto") &&
        portalUiProto.includes("syncOperacaoLocacaoModalidadeBolas") &&
        cssProto.includes("portal-locacao-modalidade-bola--carro") &&
        cssProto.includes("portal-locacao-modalidade-bola--moto"),
      "marcar modalidade no cadastro de locação"
    );
    record(
      "locacao CPF preenche nome (cadastro + planilha)",
      portalUiProto.includes("resolveOperacaoLancAluguelNomePorCpf(digits)") &&
        portalUiProto.includes("bindOperacaoLocacaoAutofill"),
      "autofill usa resolucao completa"
    );
    record(
      "valor do aluguel = coluna Locação da planilha",
      portalUiProto.includes("portalValorAluguelNumFromLoc") &&
        portalUiProto.includes("fmtValor(portalValorAluguelNumFromLoc(loc))"),
      "cadastro de locação lê valorLocacao (Locação)"
    );
    const gateApiSrc = fs.readFileSync(
      path.join(REPO_ROOT, "grupodkempreendimentos/api/cadastro-clientes.js"),
      "utf8"
    );
    record(
      "app cliente gate canal demo",
      portalUiProto.includes("dkPortalSnapshotLabel") &&
        portalUiProto.includes("X-DK-Deploy-Channel") &&
        gateApiSrc.includes("fetchPortalCadastrosFromRedis") &&
        gateApiSrc.includes("resolveDeployChannel"),
      "API snapshot demo"
    );
    record(
      "senha inicial cliente portal 123456",
      appJsProto.includes("SENHA_INICIAL_OPERACAO") &&
        appJsProto.includes('base.senha = SENHA_INICIAL_OPERACAO'),
      "novo cliente recebe senha app"
    );
    record(
      "cadastro cliente senha visível só administrador",
      html.includes("operacaoClienteSenhaLabel") &&
        html.includes('senha=123456') &&
        portalUiProto.includes("portalRefreshOperacaoClienteSenhaField") &&
        portalUiProto.includes("operacaoClienteSenhaWrap"),
      "senha=123456 só no layout administrador"
    );
    record(
      "admin resetar senha app cliente no cadastro",
      html.includes("operacaoClienteSenhaResetBtn") &&
        portalUiProto.includes("portalResetClienteSenhaApp") &&
        portalUiProto.includes('senha: ini'),
      "reset volta a 123456 e app pede troca no login"
    );
    record(
      "modo instalacao limpa (sem Excel embutido)",
      appJsProto.includes("applyInstalacaoLimpaOnce") &&
        appJsProto.includes("return true") &&
        !html.includes("locacoes-receita-2026-import.js") &&
        html.includes("dk-banco-cadastro-vazio.js"),
      "cadastro manual permanente"
    );
    record(
      "mapa localização clientes (admin)",
      html.includes("btn-locadora-localizacao") &&
        html.includes("panel-localizacao-locadora") &&
        html.includes("dkGeoMapRefresh") &&
        html.includes("dk-geo-mapa-refresh-overlay") &&
        html.includes("portal-cliente-geo-mapa.js")
    );
    record(
      "app cliente geolocalização obrigatória",
      (await fetch(`${BASE_URL}cliente.html`, { cache: "no-store" }).then((r) => r.text())).includes(
        "view-geolocalizacao"
      ) &&
        (await fetch(`${BASE_URL}portal-cliente-geolocalizacao.js?v=20260521geo-v1`, { cache: "no-store" }).then(
          (r) => r.text()
        )).includes("__DK_clienteGeoEnsurePermission")
    );
    const portalUiJs = await page.evaluate(async () => {
      const r = await fetch("portal-locadora-ui.js?v=20260521geo-v1", { cache: "no-store" });
      return r.ok ? await r.text() : "";
    });
    record(
      "cadastro veículo resumo frota (código, placa, km, cliente)",
      portalUiJs.includes("renderOperacaoVeiculoResumoFrota") &&
        portalUiJs.includes("getPortalUltimoKmPorPlaca") &&
        portalUiJs.includes("getPortalResumoVeiculoCardData") &&
        portalUiJs.includes("portalCompareVeiculoResumoFrota") &&
        portalUiJs.includes("portalCompareVeiculoPorCodigo")
    );
    record(
      "portal localização clientes (código mapa)",
      portalUiJs.includes("panelLocalizacao") &&
        portalUiJs.includes("btnLocalizacao") &&
        portalUiJs.includes("__DK_clienteGeoMapaOnShow")
    );
    const docsJs = await fetch(`${BASE_URL}portal-documentos.js?v=${documentosJsVer || "latest"}`, {
      cache: "no-store",
    }).then((r) => (r.ok ? r.text() : ""));
    record(
      "documentos depósito CRLV contratos multas (JS)",
      docsJs.includes("dk_documentos_deposito_v1") &&
        docsJs.includes("__DK_documentosListarPorChave") &&
        docsJs.includes("__DK_documentosObterBlobDoc") &&
        docsJs.includes("chaveFromFilename") &&
        docsJs.includes("adicionarFicheiros") &&
        docsJs.includes("__DK_documentosDepositarBlob") &&
        docsJs.includes("__DK_documentosObterContratoPorProtocolo") &&
        docsJs.includes("__DK_documentosMoverContratoPorProtocolo") &&
        docsJs.includes("__DK_documentosGarantirBlobNaNuvem") &&
        docsJs.includes("__DK_documentosAbrirRelatorio") &&
        docsJs.includes("__DK_documentosAbrirDocPdfViewer") &&
        docsJs.includes("marcarContratosSubstituirPorProtocolo") &&
        docsJs.includes("protocoloContratoEntrada") &&
        docsJs.includes("__DK_documentosNomeArquivoContrato") &&
        docsJs.includes("inseridoPor") &&
        docsJs.includes("__DK_documentosFmtRastreabilidade") &&
        docsJs.includes("__DK_documentosSyncDaNuvem") &&
        docsJs.includes("__DK_documentosSyncBidireccional") &&
        docsJs.includes("sincronizarDepositoDaNuvem") &&
        docsJs.includes("documentosSyncStatus") &&
        docsJs.includes("documentosMaquinaRotulo") &&
        docsJs.includes("listarPorChave") &&
        docsJs.includes("excluirDoc") &&
        docsJs.includes("purgeLegacyPatrimonioLocal") &&
        !docsJs.includes("patrimonioReservarLeituraIa")
    );
    record(
      "cadastro locação visualizar contrato (modelo + depósito ATIVOS)",
      html.includes("operacaoLocacaoVisualizarContratoBtn") &&
        html.includes("portal-contrato-locacao.js") &&
        html.includes("dk-contrato-locacao-texto.js")
    );
    const contratoJs = await fetch(`${BASE_URL}portal-contrato-locacao.js?v=20260612contrato-endereco-cadastro`, {
      cache: "no-store",
    }).then((r) => (r.ok ? r.text() : ""));
    const uiContratoJs = await fetch(`${BASE_URL}portal-locadora-ui.js?v=20260612contrato-endereco-cadastro`, {
      cache: "no-store",
    }).then((r) => (r.ok ? r.text() : ""));
    const vendorJspdf = await fetch(`${BASE_URL}vendor/jspdf.umd.min.js`, { cache: "no-store" }).then((r) => r.ok);
    const vendorHtml2canvas = await fetch(`${BASE_URL}vendor/html2canvas.min.js`, { cache: "no-store" }).then(
      (r) => r.ok
    );
    record(
      "contrato locação gera PDF e deposita por protocolo",
      contratoJs.includes("__DK_contratoLocacaoSalvarPdfBlob") &&
        contratoJs.includes("__DK_contratoLocacaoRefreshBotao") &&
        contratoJs.includes("__DK_contratoLocacaoExisteParaProtocolo") &&
        contratoJs.includes("__DK_contratoLocacaoVerificarExistente") &&
        contratoJs.includes("__DK_contratoLocacaoAbrirComparacao") &&
        contratoJs.includes("ESTE ARQUIVO JÁ EXISTE NA PASTA DOCUMENTOS") &&
        contratoJs.includes("contratoDados") &&
        contratoJs.includes("btnContratoComparar") &&
        contratoJs.includes("substituirConfirmado") &&
        contratoJs.includes("vendor/jspdf.umd.min.js") &&
        contratoJs.includes("vendor/html2canvas.min.js") &&
        contratoJs.includes("nomeArquivoContrato") &&
        contratoJs.includes("b64: b64") &&
        contratoJs.includes("tentativasPdf") &&
        contratoJs.includes("__DK_getClienteByCpfAny") &&
        contratoJs.includes("__DK_resolverEnderecoClienteContrato") &&
        contratoJs.includes("coletarFontesEnderecoCliente") &&
        contratoJs.includes("montarEnderecoContratoDeFontes") &&
        contratoJs.includes("garantirDadosContratoComEndereco") &&
        contratoJs.includes("pagina-contrato") &&
        contratoJs.includes("__DK_contratoLocacaoCssPagina") &&
        contratoJs.includes("writing-mode: vertical-rl") &&
        contratoJs.includes("clienteEmbutidoPorCpf") &&
        uiContratoJs.includes("window.__DK_getClienteByCpfAny = getClienteByCpfAny") &&
        uiContratoJs.includes("portalEnderecoContratoValido") &&
        uiContratoJs.includes("portalMergeClienteCadastroWithBundled") &&
        !contratoJs.includes("(Endereço do Cliente)") &&
        contratoJs.includes("substituido") &&
        contratoJs.includes("PDF anterior removido") &&
        contratoJs.includes("__DK_contratoLocacaoPdfMaxBytes") &&
        vendorJspdf &&
        vendorHtml2canvas &&
        contratoJs.includes("__DK_contratoLocacaoSincronizarPasta") &&
        contratoJs.includes("__DK_documentosObterContratoPorProtocolo")
    );
    const pacoteJs = await fetch(`${BASE_URL}portal-contrato-pacote.js?v=20260824layout-sisloc`, {
      cache: "no-store",
    }).then((r) => (r.ok ? r.text() : ""));
    record(
      "impressao do pacote usa layout A4 do modelo SISLOC",
      pacoteJs.includes("__DK_contratoLocacaoCssPagina") &&
        pacoteJs.includes("cssContratoPag") &&
        contratoJs.includes("pagina pagina-contrato") &&
        contratoJs.includes("Arial, Helvetica"),
      "logo esquerda, titulo direita, faixa vertical"
    );
    const syncJs = await page.evaluate(async () => {
      const r = await fetch("portal-supabase-sync.js?v=20260609docs-auto", { cache: "no-store" });
      return r.ok ? await r.text() : "";
    });
    record("documentos sync nuvem (dk_documentos_deposito_v1)", syncJs.includes("dk_documentos_deposito_v1"));
    record(
      "documentos depósito push guard + sync após pull",
      syncJs.includes("applyDepositPushGuard") &&
        syncJs.includes("omitEmptyDepositForPush") &&
        syncJs.includes("scheduleDepositoSyncAfterCloudPull")
    );
    record(
      "documentos locação merge nuvem (dk_locacao_documentos_v1)",
      syncJs.includes("dk_locacao_documentos_v1") && syncJs.includes("__DK_docsLocacaoMerge")
    );
    const cssStyles = await fetch(`${BASE_URL}styles.css`, {
      cache: "no-store",
    }).then((r) => (r.ok ? r.text() : ""));
    record(
      "CSS documentos depósito e busca",
      cssStyles.includes(".documentos-dropzone") &&
        cssStyles.includes(".documentos-busca") &&
        cssStyles.includes(".documentos-relatorios") &&
        cssStyles.includes(".documentos-resultado") &&
        cssStyles.includes(".portal-lanc-multas-docs")
    );
    record(
      "CSS cartões frota legíveis (texto claro no botão)",
      cssStyles.includes(".operacao-veiculo-resumo-card") &&
        cssStyles.includes("color: var(--text") &&
        cssStyles.includes("appearance: none")
    );
    const placaMercosulOk = await page.evaluate(() => ({
      fn: typeof window.isPlacaMercosul === "function",
      ok: typeof window.isPlacaMercosul === "function" &&
        window.isPlacaMercosul("SOX2A84") &&
        window.isPlacaMercosul("ABC1D23") &&
        !window.isPlacaMercosul("ABC1234") &&
        !window.isPlacaMercosul("JRB5376") &&
        !window.isPlacaMercosul("SOXA284"),
      ocr:
        typeof window.corrigirPlacaMercosul === "function" &&
        window.corrigirPlacaMercosul("SOXA284") === "SOX2A84",
      antiga:
        typeof window.convertPlacaAntigaParaMercosul === "function" &&
        window.convertPlacaAntigaParaMercosul("JRB5376") === "JRB5D76",
      abcDirect:
        typeof window.isPlacaMercosul === "function" && window.isPlacaMercosul("ABC1D23"),
    }));
    record(
      "placa Mercosul LLLNLNN único padrão",
      placaMercosulOk.fn &&
        placaMercosulOk.ok &&
        placaMercosulOk.ocr &&
        placaMercosulOk.antiga &&
        placaMercosulOk.abcDirect,
      placaMercosulOk.abcDirect
        ? "ABC1D23 OK · JRB5376→JRB5D76"
        : placaMercosulOk.ocr
          ? "SOXA284→SOX2A84"
          : "validação"
    );
    record(
      "portal conferência operador (texto)",
      html.includes("funcionário cadastrado") || html.includes("funcionario cadastrado") || html.includes("Conferir comprovante")
    );

    const hasPortalFns = await page.evaluate(() => ({
      unify: typeof window.__DK_unifyCadastroSingleDatabaseOnce === "function",
      bancoVazio: Array.isArray(window.DK_BANCO_CADASTRO?.veiculos) && window.DK_BANCO_CADASTRO.veiculos.length === 0,
      bancoClientes: (window.DK_BANCO_CADASTRO?.clientes || []).length,
      manual: typeof window.__DK_isCadastroManualPortalMode === "function" && window.__DK_isCadastroManualPortalMode(),
      upsert: typeof window.__DK_upsertPortalClienteByCpf === "function",
      dateMask: typeof window.formatDateMask === "function",
      isDkDate: typeof window.isDkDateFieldInput === "function",
      autoDate: typeof window.bindDateMasksInContainer === "function",
      observer: Boolean(window.__dkDateMaskObserver),
      currencyMask: typeof window.formatCurrencyMask === "function",
    }));
    record(
      IS_DEMO_TEST ? "demo: banco planilha + manual" : "app.js instalacao limpa (banco vazio + manual)",
      IS_DEMO_TEST
        ? hasPortalFns.unify &&
          hasPortalFns.upsert &&
          hasPortalFns.manual &&
          hasPortalFns.bancoClientes >= 300
        : hasPortalFns.unify && hasPortalFns.upsert && hasPortalFns.bancoVazio && hasPortalFns.manual,
      IS_DEMO_TEST ? `clientes=${hasPortalFns.bancoClientes}` : ""
    );
    record(
      "mascaras globais carregadas",
      hasPortalFns.dateMask &&
        hasPortalFns.isDkDate &&
        hasPortalFns.autoDate &&
        hasPortalFns.observer &&
        hasPortalFns.currencyMask
    );

    const autoDateDetect = await page.evaluate(() => {
      const el = document.createElement("input");
      el.type = "text";
      el.id = "testeAutoDataCampoNovo";
      document.body.appendChild(el);
      const detected = typeof window.isDkDateFieldInput === "function" && window.isDkDateFieldInput(el);
      if (typeof window.bindDateMaskInput === "function") window.bindDateMaskInput(el);
      el.value = "";
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.value = "01012030";
      el.dispatchEvent(new Event("input", { bubbles: true }));
      const masked = el.value;
      el.remove();
      return { detected, masked };
    });
    record("auto-detect id com Data", autoDateDetect.detected, "testeAutoDataCampoNovo");
    record("auto-mascara campo novo", autoDateDetect.masked === "01/01/2030", autoDateDetect.masked);

    async function readLocadoraHubState() {
      return page.evaluate(() => {
        const hub = document.getElementById("view-locadora-hub");
        const cliente = hub?.querySelector("[data-locadora-go='cliente']");
        const empresa = hub?.querySelector("[data-locadora-go='empresa']");
        return {
          hubActive: Boolean(hub?.classList.contains("view--active")),
          hasCliente: Boolean(cliente),
          hasEmpresa: Boolean(empresa),
        };
      });
    }

    async function ensureLocadoraHubVisible() {
      await page.goto(`${BASE_URL}#locadora`, { waitUntil: "networkidle", timeout: 90000 });
      for (let attempt = 0; attempt < 3; attempt++) {
        let state = await readLocadoraHubState();
        if (state.hubActive && state.hasCliente && state.hasEmpresa) return true;
        await page
          .evaluate(() => {
            location.hash = "locadora";
            window.dispatchEvent(new HashChangeEvent("hashchange"));
          })
          .catch(() => null);
        await page
          .waitForFunction(
            () => {
              const hub = document.getElementById("view-locadora-hub");
              return Boolean(
                hub?.classList.contains("view--active") &&
                  hub.querySelector("[data-locadora-go='cliente']") &&
                  hub.querySelector("[data-locadora-go='empresa']")
              );
            },
            { timeout: 15000 }
          )
          .catch(() => null);
        await page.waitForTimeout(500);
        state = await readLocadoraHubState();
        if (state.hubActive && state.hasCliente && state.hasEmpresa) return true;
        const homeBtn = page.locator('#view-home [data-go="locadora"]').first();
        if (await homeBtn.isVisible().catch(() => false)) {
          await homeBtn.click().catch(() => null);
    await page.waitForTimeout(800);
        }
      }
      const finalState = await readLocadoraHubState();
      return finalState.hubActive && finalState.hasCliente && finalState.hasEmpresa;
    }
    await ensureLocadoraHubVisible();
    await page.waitForTimeout(300);

    const hubState = await readLocadoraHubState();
    record(
      "hub DK Locadora (cliente + empresa)",
      hubState.hubActive && hubState.hasCliente && hubState.hasEmpresa,
      `hubActive=${hubState.hubActive}`
    );

    const hubEmpresa = page.locator("#view-locadora-hub [data-locadora-go='empresa']").first();
    if (hubState.hasEmpresa) {
      await hubEmpresa.click().catch(() => null);
      await page.waitForTimeout(500);
    }

    const colab = page.locator(".role-picker__btn:has-text('Colaborador'), text=Colaborador").first();
    if (await colab.isVisible().catch(() => false)) await colab.click();
    await page.waitForTimeout(400);

    const cpfLogin = page.locator("#login-cpf");
    if (await cpfLogin.isVisible().catch(() => false)) {
      await cpfLogin.fill("00000000000");
      await page.locator("#login-senha, input[type=password]").first().fill("123456");
      await page.locator("button:has-text('Entrar'), #btn-login").first().click().catch(() => {});
      await page.waitForTimeout(2000);
    }

    const operacao = page.locator("text=Operação").first();
    if (await operacao.isVisible().catch(() => false)) {
      await operacao.click();
      await page.waitForTimeout(1500);
    }

    const cloudBtn = page.locator("#btn-dk-cloud-pull, text=Carregar da nuvem").first();
    if (await cloudBtn.isVisible().catch(() => false)) {
      page.once("dialog", (d) => d.accept());
      await cloudBtn.click();
      await page.waitForTimeout(5000);
    }

    const appsHtml = await page.evaluate(() => fetch("./apps.html").then((r) => r.text()));
    record("pagina apps.html disponivel", appsHtml.includes("App Cliente") && appsHtml.includes("App Grupo DK"));

    await page.goto(new URL("cliente.html", BASE_URL).href, { waitUntil: "networkidle", timeout: 60000 });
    const clienteLoginVisivel =
      !(page.url().includes("locadora/cliente")) &&
      (await page.locator("#form-login, #login-cpf").first().isVisible().catch(() => false));
    record(
      "cliente.html mostra login sem redirecionar ao portal de instalação",
      clienteLoginVisivel,
      page.url()
    );

    const clienteHtmlUrl = new URL("cliente.html", BASE_URL).href;
    const clienteHtml = await fetch(clienteHtmlUrl).then((r) => r.text());
    record(
      "app cliente auto-sync e notificações",
      clienteHtml.includes("atualizarProgramaEDados") === false &&
        clienteHtml.includes("cliente-notificacoes.js") &&
        clienteHtml.includes("cliente-contrato-resumo.js") &&
        clienteHtml.includes("cliente-notificacoes-wrap") &&
        clienteHtml.includes("btn-notif-ver-lidas") &&
        !clienteHtml.includes("Falar com a DK"),
      "avisos DK unidirecionais"
    );
    record(
      "app cliente resumo contrato no HTML",
      clienteHtml.includes("Meus contratos") && clienteHtml.includes("cliente-contrato-resumo.js")
    );
    record(
      "app cliente login CPF e protocolo",
      clienteHtml.includes('id="login-protocolo"') &&
        clienteHtml.includes("login-trocar-cliente-hint"),
      "Sair e entrar com outro CPF/protocolo"
    );
    const clienteAppJs = await fetch(`${BASE_URL}cliente-app.js?v=20260521demo-oficial-igual`, {
      cache: "no-store",
    }).then((r) => r.text());
    const clienteResumoJs = await fetch(`${BASE_URL}cliente-contrato-resumo.js?v=20260608cal-no-trava`, {
      cache: "no-store",
    }).then((r) => r.text());
    const clienteCss = await fetch(`${BASE_URL}cliente-app.css?v=20260521contrato-simples`, { cache: "no-store" }).then(
      (r) => r.text()
    );
    record(
      "app cliente envio comprovante inativado",
      clienteHtml.includes('id="cliente-sec-comprovante"') &&
        clienteHtml.includes("hidden") &&
        clienteAppJs.includes("CLIENTE_ENVIO_COMPROVANTE_ATIVO = false"),
      "secção oculta + flag false"
    );
    record(
      "app cliente badge contrato por tipo/plano",
      clienteAppJs.includes("renderContratoBadge") &&
        clienteResumoJs.includes("computeBadgeContrato") &&
        clienteCss.includes("cliente-badge-contrato--minha-moto") &&
        clienteCss.includes("cliente-badge-contrato--carro"),
      "azul/verde/marrom/vermelho"
    );
    record(
      "app cliente vista provisória contrato simplificada",
      clienteAppJs.includes("Valor do contrato semanal") &&
        clienteAppJs.includes("Data do último pagamento") &&
        clienteResumoJs.includes("investimentoAcumulado") &&
        clienteResumoJs.includes("pickUltimoPagamento"),
      "placa, semanal, pago, investimento, último pagamento"
    );
    record(
      "app cliente PARABÉNS só no plano DK Minha Moto",
      clienteAppJs.includes("locEhPlanoDkMinhaMoto") &&
        clienteAppJs.includes("DK_MINHA_MOTO_SEMANAS_PLANO = 150") &&
        clienteAppJs.includes("cliente-premio") &&
        clienteAppJs.includes("pctProgressoMinhaMoto") &&
        clienteAppJs.includes("renderPremioMinhaMotoConviteHtml") &&
        clienteAppJs.includes("VENHA REALIZAR SEU SONHO NO PLANO DK MINHA MOTO") &&
        clienteAppJs.includes('resumo.plano === "MINHA_MOTO"') &&
        clienteAppJs.includes("badge?.variant === \"carro\""),
      "gráfico 150 semanas; outros planos veem o convite em 0%"
    );
    record(
      "app cliente sincroniza valor semanal e pagamentos da nuvem",
      clienteResumoJs.includes("resolveValoresContrato") &&
        clienteResumoJs.includes("valorSemanal ?? loc?.valorParcela") &&
        cloudSyncJs.includes('localStorage.setItem("dk_locacoes_cadastro"'),
      "semanal da locação + pull substitui contratos do CPF"
    );
    record(
      "app cliente sem detalhamento pagamentos",
      !clienteHtml.includes("cliente-pagamentos-calendario.js") &&
        !clienteHtml.includes("clienteCalPagamentosModal") &&
        !clienteAppJs.includes("Detalhamento dos pagamentos") &&
        !clienteAppJs.includes("data-cliente-cal-proto"),
      "calendário de pagamentos removido (performance)"
    );
    record(
      "cadastro locação documentos por protocolo",
        indexFresh.includes("Importar contrato") &&
        indexFresh.includes("Importar CRLV") &&
        indexFresh.includes("operacaoLocacaoDocVagaContrato") &&
        indexFresh.includes("operacaoLocacaoDocVagaCrlv") &&
        indexFresh.includes("vaga única") &&
        !indexFresh.includes("operacaoLocacaoDocumentosListaMulta") &&
        !indexFresh.includes("operacaoLocacaoDocContratoBtn") &&
        !indexFresh.includes("operacaoLocacaoDocumentosInput") &&
        indexFresh.includes("Confirmar") &&
        indexFresh.includes("Enviar para o cliente") &&
        indexFresh.includes("portal-locacao-documentos.js"),
      "Contrato + CRLV: trazer do depósito; Visualizar + Confirmar + Enviar + Excluir"
    );
    record(
      "lançamento multas importa depósito Documentos",
      indexFresh.includes("operacaoLancMultasDocumentosDeposito") &&
        indexFresh.includes("operacaoLancMultasDocImportBtn") &&
        !indexFresh.includes("operacaoLancMultasBuscarDepositoBtn") &&
        indexFresh.includes("Confirmar") &&
        indexFresh.includes("Enviar para o cliente"),
      "Multa PLACA-CPF; Abrir + Confirmar + Enviar → Ver multas"
    );
    const locDocsJs = await fetch(`${BASE_URL}portal-locacao-documentos.js?v=20260612loc-docs-import-sem-blob3`, {
      cache: "no-store",
    }).then((r) => r.text());
    record(
      "documentos locação sync nuvem",
      locDocsJs.includes("dk_locacao_documentos_v1") &&
        locDocsJs.includes("enviarDocumentoParaCliente") &&
        locDocsJs.includes("prepararDocumentoParaEnvio") &&
        locDocsJs.includes("documentoCorrespondeNaNuvem") &&
        locDocsJs.includes("verificarDocumentoEnviadoNaNuvem") &&
        locDocsJs.includes("reconciliarDocumentosEnvioProtocolo") &&
        locDocsJs.includes("__DK_pushLocacaoDocumentoNuvem") &&
        locDocsJs.includes("__DK_fetchCloudSnapshotPayload") &&
        locDocsJs.includes("confirmado na nuvem") &&
        locDocsJs.includes("enviadoCliente") &&
        locDocsJs.includes("visualizarDocumento") &&
        locDocsJs.includes("__DK_documentosAbrirViewerBlob") &&
        locDocsJs.includes("data-loc-doc-visualizar") &&
        locDocsJs.includes("data-loc-doc-excluir") &&
        locDocsJs.includes("excluirDocumentoOperador") &&
        locDocsJs.includes("__DK_refreshLancMultasDocumentosDeposito") &&
        locDocsJs.includes("confirmarDocumentoOperador") &&
        locDocsJs.includes("conferidoOperador") &&
        locDocsJs.includes("DOC_DESTINO_APP") &&
        locDocsJs.includes("__DK_garantirDocMultaParaCadastro") &&
        locDocsJs.includes("docCanonicoPorTipo") &&
        locDocsJs.includes("limparDuplicadosNaoEnviados") &&
        locDocsJs.includes("repararMetadadosDocumentosLocacao") &&
        locDocsJs.includes("garantirBlobDepositoParaImport") &&
        locDocsJs.includes("bindListaDocumentosLocacao") &&
        !locDocsJs.includes("adicionarDocumentos"),
      "contrato/crlv: push nuvem + confirmação ao operador; só enviados vão à nuvem"
    );
    const syncDocEnviarJs = await fetch(`${BASE_URL}portal-supabase-sync.js?v=20260521envio-geral`, {
      cache: "no-store",
    }).then((r) => r.text());
    record(
      "app cliente pull documentos locação (dk_locacao_documentos_v1)",
      syncDocEnviarJs.includes('"dk_locacao_documentos_v1"') &&
        syncDocEnviarJs.includes("CLIENTE_CLOUD_PULL_KEYS") &&
        syncDocEnviarJs.includes("filterCloudPayloadForClienteApp") &&
        syncDocEnviarJs.includes("enviadoCliente === true") &&
        syncDocEnviarJs.includes("mergeLocacaoDocumentosV1") &&
        syncDocEnviarJs.includes("compactLocacaoDocumentosClienteStore") &&
        syncDocEnviarJs.includes("__DK_fetchRedundantSnapshotPayload") &&
        syncDocEnviarJs.includes("skipShrink"),
      "cliente recebe CRLV/contrato enviados via sync da nuvem"
    );
    record(
      "app cliente login valida senha na nuvem",
      clienteAppJs.includes("__DK_upsertClienteCadastroFromCloud") &&
        syncDocEnviarJs.includes("upsertClienteCadastroFromCloud") &&
        syncDocEnviarJs.includes('"dk_clientes_cadastro"'),
      "cadastro/senha do app vêm da nuvem no Entrar"
    );
    record(
      "cliente.html sync documentos locação",
      clienteHtml.includes("portal-supabase-sync.js?v="),
      "app cliente carrega sync com pull de dk_locacao_documentos_v1"
    );
    const lancExtrasJs = await fetch(`${BASE_URL}portal-lancamentos-extras.js?v=20260609multa-deposito`, {
      cache: "no-store",
    }).then((r) => r.text());
    record(
      "cadastrar multa exige documento do depósito",
      lancExtrasJs.includes("__DK_garantirDocMultaParaCadastro") &&
        lancExtrasJs.includes("locacaoDocumentoId"),
      "bloqueia cadastro sem PDF importado de Documentos"
    );
    const clienteDocsJs = await fetch(`${BASE_URL}cliente-documentos-locacao.js?v=20260521crlv-unico`, {
      cache: "no-store",
    }).then((r) => r.text());
    record(
      "app cliente documentação contrato com zoom",
      clienteAppJs.includes("Ver contrato") &&
        clienteAppJs.includes("Ver CRLV") &&
        clienteAppJs.includes("Ver multas") &&
        clienteAppJs.includes('data-cliente-docs-tipo="contrato"') &&
        clienteAppJs.includes('data-cliente-docs-tipo="crlv"') &&
        clienteAppJs.includes('data-cliente-docs-tipo="multa"') &&
        clienteDocsJs.includes("isDocEnviadoCliente") &&
        clienteDocsJs.includes("canonizarParaCliente") &&
        clienteDocsJs.includes("enviadoCliente === true") &&
        clienteDocsJs.includes("cliente-doc-zoom-viewport") &&
        clienteHtml.includes("cliente-documentos-locacao.js"),
      "cada botão filtra tipo; só docs enviados pelo operador"
    );
    record(
      "protocolo lançamento + sincronismo (dk-lancamento-protocolo)",
      html.includes("dk-lancamento-protocolo.js") &&
        html.includes("operacaoLocacaoLancamentosHistorico") &&
        html.includes("lanc-proto"),
      "AAAAMMDDHHMMSS-NNN"
    );
    const lancProtoJs = await fetch(`${BASE_URL}dk-lancamento-protocolo.js?v=20260608oficial-lanc-strict`, {
      cache: "no-store",
    }).then((r) => r.text());
    record(
      "oficial: lançamentos modo estrito (sem legado global)",
      !IS_DEMO_TEST
        ? lancProtoJs.includes("__DK_isOficialLancamentosStrict") &&
            lancProtoJs.includes("__DK_isLancamentoOficialAceite") &&
            lancProtoJs.includes("purgeGlobalLancamentoKeysOficial")
        : lancProtoJs.includes("__DK_getLancamentosAluguelCanonico"),
      IS_DEMO_TEST ? "demo: consolidação completa" : "oficial: só portalLancamentosAluguel auditável"
    );
    record(
      "app cliente lancamentos alinhados ao portal",
      clienteResumoJs.includes("__DK_clienteGetLancamentosAluguelContrato") &&
        clienteResumoJs.includes("mergeLancamentosEmbutidos") &&
        clienteResumoJs.includes("__DK_mergeLocacoesCadastroCliente") &&
        clienteResumoJs.includes("valorEspecie"),
      "portalLancamentosAluguel + nuvem no app cliente"
    );
    const portalSyncLancJs = await fetch(`${BASE_URL}portal-supabase-sync.js?v=20260608pagamentos-nuvem`, {
      cache: "no-store",
    }).then((r) => r.text());
    const calPortalJs = await fetch(`${BASE_URL}portal-lanc-aluguel-calendario.js?v=20260610avisos-check`, {
      cache: "no-store",
    }).then((r) => r.text());
    const portalUiLancPersistJs = await fetch(`${BASE_URL}portal-locadora-ui.js?v=20260608pagamentos-nuvem`, {
      cache: "no-store",
    }).then((r) => r.text());
    record(
      "push nuvem preserva portalLancamentosAluguel",
      portalSyncLancJs.includes("mergeLocacaoCadastroParSync") &&
        portalSyncLancJs.includes("mergeLancamentosAluguelLocacaoPar") &&
        portalSyncLancJs.includes("hydrateLocacoesCadastroPagamentosParaNuvem"),
      "merge + hidratação de pagamentos no push"
    );
    record(
      "persist pagamento atualiza loc.updatedAt",
      portalUiLancPersistJs.includes("loc.updatedAt = Date.now()"),
      "locação ganha timestamp ao gravar pagamentos"
    );
    record(
      "histórico aluguel: Apagar/Editar pelo protocolo gerado",
      portalUiLancPersistJs.includes("portalProtocoloLancamentoKey") &&
        portalUiLancPersistJs.includes("onOperacaoLancAluguelHistoricoClick") &&
        portalUiLancPersistJs.includes("stampPortalLancamentoRemovido") &&
        portalUiLancPersistJs.includes("operacaoLancAluguelHistorico") &&
        lancProtoJs.includes("filtrarPortalLancamentosPorRemovidos") &&
        html.includes("operacaoLancAluguelHistorico"),
      "titular apaga o pagamento visível na tabela"
    );
    record(
      "calendário portal envia nuvem após salvar",
      calPortalJs.includes("await fn(") &&
        calPortalJs.includes("res.notify") &&
        calPortalJs.includes("askConfirmAlteracoesCalendario"),
      "salvar calendário pede confirmação e envia aviso ao cliente"
    );
    record(
      "app cliente sync mostra contagem pagamentos",
      clienteAppJs.includes("countPagamentosCliente") && clienteAppJs.includes("finally"),
      "mensagem pós-sync com total de pagamentos"
    );
    const portalSyncPullJs = await fetch(`${BASE_URL}portal-supabase-sync.js?v=20260521pag-sync`, {
      cache: "no-store",
    }).then((r) => r.text());
    record(
      "app cliente pull pagamentos ignora local_authority",
      portalSyncPullJs.includes("isClienteAppPage") &&
        portalSyncPullJs.includes("locacoesCloudMergeWouldChangeLocal") &&
        portalSyncPullJs.includes("!clientePage"),
      "pull no app cliente não bloqueia por autoridade local"
    );
    record(
      "app cliente sync força merge locações",
      clienteAppJs.includes('__DK_pullCloudSnapshotSilentMerge({ force: true })'),
      "Atualizar da nuvem re-funde pagamentos"
    );
    const swClienteJs = await fetch(`${BASE_URL}service-worker-cliente.js?v=20260824premio-convite`, {
      cache: "no-store",
    }).then((r) => r.text());
    record(
      "app cliente mostra pagamentos Redis (sem filtro estrito)",
      lancProtoJs.includes("isClienteAppContext") &&
        clienteResumoJs.includes("protocoloLancamento") &&
        clienteResumoJs.includes("registradoPorCpf") &&
        portalSyncLancJs.includes("fetchCloudSnapshotPayloadClienteApp") &&
        portalSyncLancJs.includes("mergeRemoteSnapshotsForClienteApp") &&
        clienteAppJs.includes("45000") &&
        !clienteAppJs.includes("consolidarLancamentosClienteLogado(sessao.cpf)") &&
        swClienteJs.includes("dk-cliente-v20260824premio-convite"),
      "Supabase sem lançamentos não apaga pagamentos do Redis no app"
    );
    record(
      "app cliente recebe contrato sem corte oficial",
      portalSyncLancJs.includes("__DK_sanitizeOficialCloudPayload === \"function\" && !isClienteAppPage()") &&
        portalSyncLancJs.includes("isClienteAppPage() && !arr.length") &&
        portalSyncLancJs.includes("filterCloudLocacoesForCliente") &&
        clienteAppJs.includes("upsertClienteCadastroFromCloud(cpf, proto)"),
      "CPF+protocolo no telemovel nao perdem a locacao"
    );
    record(
      "merge nuvem recalcula valor pago (não usa último lançamento apagado)",
      lancProtoJs.includes("syncResumoPagamentosNaLocacao") &&
        lancProtoJs.includes("__DK_syncResumoPagamentosNaLocacao") &&
        clienteResumoJs.includes("keepIncoming") &&
        portalSyncLancJs.includes("keepIncoming") &&
        portalUiLancPersistJs.includes("portalAnoResumoLancamentoAluguel") &&
        html.includes("operacaoLancAluguelSitTotalPagoAnoLabel"),
      "portal e app cliente somam o mesmo array de pagamentos"
    );
    record(
      "lançamento aluguel mostra devido e pago até hoje",
      html.includes("operacaoLancAluguelTotalDevidoHoje") &&
        html.includes("operacaoLancAluguelTotalPagoHoje") &&
        html.includes("TOTAL DEVIDO ATÉ HOJE") &&
        html.includes("TOTAL PAGO ATÉ HOJE") &&
        portalUiLancPersistJs.includes("refreshOperacaoLancAluguelSaldosHoje") &&
        portalUiLancPersistJs.includes("computePortalDiasAteHoje") &&
        portalUiLancPersistJs.includes("valorDevidoAteHoje"),
      "caixas ao lado da data/valor no registrar pagamento"
    );
    record(
      "lançamento aluguel avisa pagamento duplicado na mesma data",
      portalUiLancJs.includes("textoAvisoLancamentoDuplicadoMesmaData") &&
        portalUiLancJs.includes("findPortalLancamentosMesmaData") &&
        portalUiLancJs.includes("na data de hoje realizou um lançamento de") &&
        portalUiLancJs.includes("Você confirma o lançamento atual?"),
      "mesmo protocolo + mesma data pede confirmação extra"
    );
    const portalLocadoraJs = await fetch(`${BASE_URL}portal-locadora-ui.js?v=20260610avisos-check`, {
      cache: "no-store",
    }).then((r) => r.text());
    const clienteNotifJs = await fetch(`${BASE_URL}cliente-notificacoes.js?v=20260610avisos-check`, {
      cache: "no-store",
    }).then((r) => r.text());
    record(
      "comunicação portal removida (sem inbox/chat)",
      !html.includes("portal-comunicacao-inbox-wrap") &&
        !html.includes("portalComunicacaoVendasLista") &&
        !html.includes("portal-comunicacao-operacao-ui.js") &&
        !html.includes("portal-comunicacao-operacao.js") &&
        !html.includes("operacaoClienteMsgClienteBtn") &&
        portalLocadoraJs.includes("__DK_clienteNotificacaoPagamentoLancado") &&
        portalLocadoraJs.includes("portalNotificarClientePagamentosLancados") &&
        portalLocadoraJs.includes("Lançamento de aluguel realizado com sucesso") &&
        !portalLocadoraJs.includes("portalComunicacaoAcessosEfetivos"),
      "avisos automáticos mantidos; chat/inbox removidos"
    );
    record(
      "lançamento aluguel confirma aviso ao cliente na nuvem",
      clienteNotifJs.includes("__DK_clienteNotificacaoPagamentoLancadoComNuvem") &&
        clienteNotifJs.includes("__DK_verificarNotificacaoClienteNaNuvem") &&
        clienteNotifJs.includes("confirmarNotificacaoClienteNaNuvem") &&
        portalLocadoraJs.includes("__DK_clienteNotificacaoPagamentoLancadoComNuvem"),
      "operador só vê sucesso se aviso chegar à nuvem"
    );
    record(
      "app cliente boas-vindas na instalação",
      clienteNotifJs.includes("__DK_clienteNotificacaoBoasVindas") &&
        clienteNotifJs.includes("mensagemBoasVindas") &&
        clienteNotifJs.includes("boas_vindas") &&
        clienteAppJs.includes("maybeRegistrarBoasVindasCliente") &&
        clienteHtml.includes("cliente-notificacoes.js?v=20260610avisos-check"),
      "primeiro acesso: aviso personalizado com protocolo"
    );
    record(
      "app cliente avisos DK (sem chat)",
      clienteHtml.includes("Avisos DK") &&
        clienteHtml.includes("btn-notif-ver-lidas") &&
        !clienteHtml.includes("clienteComunicacaoVendasBtn") &&
        !clienteHtml.includes("cliente-comunicacao-operacao-ui.js") &&
        clienteNotifJs.includes("__DK_clienteNotificacaoMultaLancada") &&
        clienteNotifJs.includes("dispararPushAvisoCliente") &&
        clienteNotifJs.includes("dk-cliente-geo?push=1") &&
        clienteNotifJs.includes("apenasLidas"),
      "avisos pagamento/multa/manutenção + push + histórico lidos"
    );
    const pushNotifyJs = await fetch(`${BASE_URL}cliente-push-notificacoes.js?v=20260609avisos-dk`, {
      cache: "no-store",
    }).then((r) => r.text());
    const pushApi = await fetch(`${BASE_URL}api/dk-cliente-geo?push=1&action=vapid`, { cache: "no-store" })
      .then((r) => r.json())
      .catch(() => ({}));
    record(
      "web push avisos DK para app cliente",
      clienteHtml.includes("cliente-push-notificacoes.js") &&
        pushNotifyJs.includes("ensureClientePushSubscription") &&
        pushNotifyJs.includes("__DK_clienteScrollToAvisos") &&
        pushApi?.configured === true &&
        Boolean(pushApi?.publicKey),
      "VAPID activo + push abre avisos"
    );
    record(
      "app cliente troca senha inicial 123456",
      clienteAppJs.includes("SENHA_INICIAL_CLIENTE") &&
        clienteAppJs.includes("view-trocar-senha") &&
        clienteAppJs.includes("form-trocar-senha") &&
        clienteAppJs.includes("limparCacheClienteAoSair") &&
        !clienteAppJs.includes("pularTrocaSenhaDemo") &&
        clienteHtml.includes("view-trocar-senha"),
      "primeiro login pede nova senha 6 dígitos"
    );
    record(
      "app cliente geo só instalação e bypass admin",
      clienteAppJs.includes("maybeRunInstallGeoGate") &&
        clienteAppJs.includes("isGeoGateBypassed") &&
        clienteAppJs.includes("markAdminPreviewActive"),
      "adminPreview + instalar=1"
    );
    const geoJs = await fetch(`${BASE_URL}portal-cliente-geolocalizacao.js?v=20260521geo-v3`, {
      cache: "no-store",
    }).then((r) => r.text());
    record(
      "app cliente GPS bloqueado em admin preview",
      geoJs.includes("isClienteGeoPushAllowed") && geoJs.includes('source: "cliente_app"'),
      "push só cliente real"
    );

    const clienteBtn = page.locator("text=Cadastro de cliente").first();
    if (await clienteBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await clienteBtn.click();
      await page.waitForTimeout(800);
      const cpfField = page.locator("#operacaoClienteCpf");
      if (await cpfField.isVisible({ timeout: 3000 }).catch(() => false)) {
        await cpfField.fill("000.000.000-01");
        await cpfField.dispatchEvent("input");
        await page.waitForTimeout(600);
        const nomeVal = await page.locator("#operacaoClienteNome").inputValue().catch(() => "");
        record("form cliente preenche nome ao digitar CPF", /teste-001/i.test(nomeVal), nomeVal || "(vazio)");
      }
    }

    const locacaoBtn = page.locator("text=Cadastro de locação").first();
    if (await locacaoBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await locacaoBtn.click();
      await page.waitForTimeout(800);
      const dataInicio = page.locator("#operacaoLocacaoDataInicio");
      if (await dataInicio.isVisible({ timeout: 3000 }).catch(() => false)) {
        await dataInicio.fill("");
        await dataInicio.type("19052026", { delay: 30 });
        await page.waitForTimeout(300);
        const dataVal = await dataInicio.inputValue();
        record("mascara data DD/MM/AAAA", dataVal === "19/05/2026", dataVal);
      }
      const valAluguel = page.locator("#operacaoLocacaoValorAluguel");
      if (await valAluguel.isVisible({ timeout: 3000 }).catch(() => false)) {
        await valAluguel.fill("");
        await valAluguel.type("12345", { delay: 30 });
        await page.waitForTimeout(300);
        const valRaw = await valAluguel.inputValue();
        const okVal = /R\$\s*123,45/.test(valRaw);
        record("mascara valor R$ xxx,xx", okVal, valRaw);
      }
    }

    const pageE2e = await browser.newPage();
    pageE2e.setDefaultNavigationTimeout(120000);
    pageE2e.setDefaultTimeout(30000);
    try {
      await pageE2e.goto(BASE_URL, { waitUntil: "domcontentloaded", timeout: 120000 });
      await pageE2e.evaluate(() => {
        localStorage.clear();
        sessionStorage.clear();
        localStorage.setItem(
          "dk_sessao_cliente",
          JSON.stringify({ tipo: "admin", role: "owner", cpf: "03037897430", nome: "Admin E2E" })
        );
        localStorage.setItem("dk_portal_sessao_build", "20260521admin-nav");
        sessionStorage.setItem("dk_portal_sessao_viva_v1", "1");
      });
      await pageE2e.goto(`${BASE_URL}#locadora/empresa`, { waitUntil: "domcontentloaded", timeout: 120000 });
      await pageE2e.waitForTimeout(14000);
      await pageE2e
        .waitForFunction(
          () => {
            const btn = document.getElementById("btn-locadora-documentos");
            const panel = document.getElementById("panel-logado");
            return btn && panel && !btn.classList.contains("hidden") && !panel.classList.contains("hidden");
          },
          { timeout: 20000 }
        )
        .catch(() => null);

      if (!IS_DEMO_TEST) {
        const cloudColab = await fetch(
          new URL(`api/dk-cloud-snapshot?nocache=${Date.now()}`, BASE_URL).href,
          { cache: "no-store" }
        ).then((r) => (r.ok ? r.json() : {}));
        const list = Array.isArray(cloudColab?.payload?.dk_funcionarios_access)
          ? cloudColab.payload.dk_funcionarios_access
          : [];
        const names = list.map((f) => String(f?.nome || "").toUpperCase());
        record(
          "oficial: Jesimiel e Wylkaline na nuvem",
          names.some((n) => n.includes("JESIMIEL")) && names.some((n) => n.includes("WYLKALINE")),
          `n=${list.length}`
        );
      }

      const diag = await pageE2e.evaluate(() => {
        const btn = document.getElementById("btn-locadora-documentos");
        const panel = document.getElementById("panel-logado");
        return {
          hash: String(location.hash || ""),
          btnHidden: !btn || btn.classList.contains("hidden"),
          panelHidden: !panel || panel.classList.contains("hidden"),
          adminBanner: Boolean(document.getElementById("portal-admin-banner") && !document.getElementById("portal-admin-banner")?.classList.contains("hidden")),
        };
      });
      const docBtn = pageE2e.locator("#btn-locadora-documentos");
      if (await docBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
        await docBtn.click();
        await pageE2e.waitForSelector("#panel-documentos-locadora:not(.hidden)", { timeout: 10000 }).catch(() => null);
        const ok = await pageE2e.evaluate(() => {
          const el = document.getElementById("panel-documentos-locadora");
          return Boolean(el && !el.classList.contains("hidden") && document.getElementById("documentosBuscaBtn"));
        });
        record("documentos E2E: painel abre com busca", ok);
      } else {
        record(
          "documentos E2E: painel abre com busca",
          false,
          `botão Documentos oculto hash=${diag.hash} btnHidden=${diag.btnHidden} panelHidden=${diag.panelHidden} banner=${diag.adminBanner}`
        );
      }

      const docVoltar = pageE2e.locator("#btn-voltar-documentos-locadora");
      if (await docVoltar.isVisible({ timeout: 3000 }).catch(() => false)) {
        await docVoltar.click();
        await pageE2e.waitForSelector("#panel-logado:not(.hidden)", { timeout: 8000 }).catch(() => null);
      }
      const finBtn = pageE2e.locator("#btn-locadora-financeiro");
      if (await finBtn.isVisible({ timeout: 8000 }).catch(() => false)) {
        await finBtn.click();
        await pageE2e.waitForSelector("#view-financeiro.view--active", { timeout: 10000 }).catch(() => null);
        const finOk = await pageE2e.evaluate(() => {
          const view = document.getElementById("view-financeiro");
          const unit = document.getElementById("view-unit");
          const el = document.getElementById("panel-financeiro-locadora");
          const santander = document.getElementById("btn-financeiro-santander");
          const sicredi = document.getElementById("btn-financeiro-sicredi");
          const titulo = document.getElementById("financeiro-page-title");
          return Boolean(
            view?.classList.contains("view--active") &&
              unit &&
              !unit.classList.contains("view--active") &&
              el &&
              !el.classList.contains("hidden") &&
              santander &&
              sicredi &&
              String(titulo?.textContent || "").includes("FINANCEIRO") &&
              String(location.hash || "").toLowerCase().includes("locadora/financeiro")
          );
        });
          record("financeiro E2E: abre tela nova com Santander e Sicredi", finOk);
        if (finOk) {
          await pageE2e.keyboard.press("0").catch(() => null);
          await pageE2e.waitForSelector("#financeiroPaneRelacaoPagamento:not(.hidden)", { timeout: 8000 }).catch(() => null);
          const relOk = await pageE2e.evaluate(() => {
            const pane = document.getElementById("financeiroPaneRelacaoPagamento");
            const tab = document.getElementById("finRelacaoPagamentoTabela");
            const filtros = document.getElementById("finFiltrosRelacaoPagamento");
            const txt = String(tab?.textContent || "");
            return Boolean(
              pane &&
                !pane.classList.contains("hidden") &&
                filtros &&
                document.getElementById("finRelStatusAtivo") &&
                document.getElementById("finRelSaldoNegativo") &&
                tab &&
                (/Nome do cliente/i.test(txt) || /Nenhum contrato/i.test(txt)) &&
                (/Valor em atraso/i.test(txt) || /Nenhum contrato/i.test(txt)) &&
                (/Total de investimento/i.test(txt) || /Nenhum contrato/i.test(txt))
            );
          });
          record("financeiro E2E: módulo Relação de pagamento por cliente abre", relOk);
          await pageE2e.keyboard.press("1").catch(() => null);
          await pageE2e.waitForSelector("#financeiroPaneQuantitativo:not(.hidden)", { timeout: 8000 }).catch(() => null);
          const qOk = await pageE2e.evaluate(() => {
            const pane = document.getElementById("financeiroPaneQuantitativo");
            const titulo = document.getElementById("finQuantitativoTitulo");
            return Boolean(pane && !pane.classList.contains("hidden") && String(titulo?.textContent || "").includes("quantitativo"));
          });
          record("financeiro E2E: módulo Resumo de quantitativo abre", qOk);
          await pageE2e.locator("#btn-fin-mod-previsao").click().catch(() => null);
          await pageE2e.waitForSelector("#financeiroPanePrevisao:not(.hidden)", { timeout: 8000 }).catch(() => null);
          const pOk = await pageE2e.evaluate(() => {
            const pane = document.getElementById("financeiroPanePrevisao");
            const gran = document.querySelector('input[name="finPrevGran"]');
            const modelo = document.getElementById("finPrevModeloSelect");
            return Boolean(
              pane &&
                !pane.classList.contains("hidden") &&
                gran &&
                modelo &&
                document.getElementById("finPrevPlanoMinhaMoto")
            );
          });
          record("financeiro E2E: módulo Previsão de receita abre", pOk);
          await pageE2e.locator("#btn-fin-mod-despesas").click().catch(() => null);
          await pageE2e.waitForSelector("#financeiroPaneDespesas:not(.hidden)", { timeout: 8000 }).catch(() => null);
          const dOk = await pageE2e.evaluate(() => {
            const pane = document.getElementById("financeiroPaneDespesas");
            const sel = pane?.querySelector(".fin-despesa-cat");
            const hasManut = Boolean(sel && Array.from(sel.options).some((o) => o.value === "MANUTENCAO"));
            const hasAluguel = Boolean(sel && Array.from(sel.options).some((o) => o.value === "ALUGUEL"));
            const hasOleo = Boolean(
              sel &&
                Array.from(sel.options).some((o) => o.value === "COMPRA_OLEO") &&
                Array.from(sel.options).some((o) => o.value === "TROCA_OLEO")
            );
            return Boolean(pane && !pane.classList.contains("hidden") && document.getElementById("finDespesaPlacasList") && hasManut && hasAluguel && hasOleo);
          });
          record("financeiro E2E: despesa manutenção pede placa", dOk);
          const histOk = await pageE2e.evaluate(() => {
            const seed = window.__DK_DESPESAS_HISTORICO;
            const info = String(document.getElementById("finDespesaListaInfo")?.textContent || "");
            const nInfo = Number((info.match(/de\s+(\d+)/i) || info.match(/(\d+)\s+lançamento/i) || [])[1] || 0);
            const resumo = String(document.getElementById("finDespesasResumo")?.textContent || "");
            const frota = new Set(window.__DK_FROTA_PLACAS || []);
            const withPlacaSeed = Array.isArray(seed)
              ? seed.filter((d) => String(d.placa || "").length >= 7).length
              : 0;
            const placasOk = Array.isArray(seed)
              ? seed.every((d) => !String(d.placa || "").trim() || frota.has(String(d.placa).toUpperCase()))
              : false;
            return Boolean(
              Array.isArray(seed) &&
                seed.length >= 1980 &&
                window.__DK_DESPESAS_HISTORICO_GERACAO &&
                frota.size > 50 &&
                withPlacaSeed > 500 &&
                placasOk &&
                nInfo >= 1980 &&
                resumo.includes("08-MANUTENÇÃO") &&
                resumo.includes("11-TROCA DE ÓLEO") &&
                resumo.includes("(sem placa)")
            );
          });
          record("financeiro E2E: histórico da planilha alimenta despesas", histOk);
          if (dOk) {
            await pageE2e.locator("#finDespesaAddBtn").click().catch(() => null);
            await pageE2e.locator("#financeiroPaneDespesas .fin-despesa-cat").first().selectOption("MANUTENCAO").catch(() => null);
            const placaPede = await pageE2e.evaluate(() => {
              const tr = document.querySelector("#finDespesasBody tr");
              const inp = tr?.querySelector(".fin-despesa-placa");
              return Boolean(tr?.classList.contains("fin-despesa-row--manut") && inp && !inp.disabled);
            });
            record("financeiro E2E: categoria manutenção mostra campo placa", placaPede);
            await pageE2e.locator("#finDespesasBody tr:first-child .fin-despesa-del").click().catch(() => null);
          } else {
            record("financeiro E2E: categoria manutenção mostra campo placa", false, "módulo despesas não abriu");
          }
          await pageE2e.locator("#btn-fin-mod-despesas-graf").click().catch(() => null);
          await pageE2e.waitForSelector("#financeiroPaneDespesasGraf:not(.hidden)", { timeout: 8000 }).catch(() => null);
          await pageE2e.waitForSelector("#finDespGrafChart svg, #finDespOleoChart svg", { timeout: 8000 }).catch(() => null);
          const gOk = await pageE2e.evaluate(() => {
            const pane = document.getElementById("financeiroPaneDespesasGraf");
            const chart = document.getElementById("finDespGrafChart");
            const oleo = document.getElementById("finDespOleoChart");
            const cats = document.querySelectorAll("#finDespGrafCats input[type=checkbox]");
            const gran = document.querySelector('input[name="finDespGrafGran"]');
            return Boolean(
              pane &&
                !pane.classList.contains("hidden") &&
                chart?.querySelector("svg") &&
                oleo?.querySelector("svg") &&
                cats.length >= 11 &&
                gran
            );
          });
          record("financeiro E2E: gráficos de despesas com filtros", gOk);
          if (gOk) {
            await pageE2e.evaluate(() => {
              document.querySelectorAll("#finDespGrafCats input[type=checkbox]").forEach((el) => {
                el.checked = el.value === "TROCA_OLEO";
              });
            });
            await pageE2e.locator("#finDespGrafAplicar").click().catch(() => null);
            await pageE2e.waitForTimeout(400);
            const oleoPivot = await pageE2e.evaluate(() => {
              const seed = Array.isArray(window.__DK_DESPESAS_HISTORICO) ? window.__DK_DESPESAS_HISTORICO : [];
              const troca = seed.filter((d) => d.categoria === "TROCA_OLEO");
              const expectedN = troca.length;
              const expectedSum = troca.reduce((a, d) => a + (Number(d.valor) || 0), 0);
              const expectedPer = new Set(
                troca.map((d) => {
                  const p = String(d.data || "").split("/");
                  return p.length === 3 ? `${p[1]}/${p[2]}` : String(d.data || "").slice(3);
                })
              ).size;
              const kpis = Array.from(document.querySelectorAll("#finDespGrafKpis .fin-kpi")).map((el) => ({
                lab: String(el.querySelector(".fin-kpi__lab")?.textContent || ""),
                val: String(el.querySelector("strong")?.textContent || ""),
              }));
              const lanc = kpis.find((k) => /lançamento/i.test(k.lab))?.val || "";
              const tot = kpis.find((k) => /total/i.test(k.lab))?.val || "";
              const per = kpis.find((k) => /per[ií]odo/i.test(k.lab))?.val || "";
              const totNum = Number(String(tot).replace(/[R$\s]/g, "").replace(/\./g, "").replace(",", "."));
              const svg = document.querySelector("#finDespGrafChart svg");
              const rects = svg?.querySelectorAll("rect").length || 0;
              return {
                lanc,
                tot,
                per,
                expectedN,
                expectedSum,
                expectedPer,
                rects,
                ok:
                  Number(lanc) === expectedN &&
                  expectedN >= 700 &&
                  Math.abs(totNum - expectedSum) < 0.05 &&
                  Number(per) === expectedPer &&
                  expectedPer >= 4 &&
                  rects >= expectedPer,
              };
            });
            record(
              "financeiro E2E: troca de óleo bate com o histórico da planilha",
              Boolean(oleoPivot.ok),
              JSON.stringify(oleoPivot)
            );
          } else {
            record("financeiro E2E: troca de óleo bate com o histórico da planilha", false, "gráficos não abriram");
          }
          await pageE2e.locator("#btn-fin-mod-analise").click().catch(() => null);
          await pageE2e.waitForSelector("#financeiroPaneAnalise:not(.hidden)", { timeout: 8000 }).catch(() => null);
          await pageE2e.waitForSelector("#finAnaliseChart svg", { timeout: 8000 }).catch(() => null);
          const aOk = await pageE2e.evaluate(() => {
            const pane = document.getElementById("financeiroPaneAnalise");
            const kpis = document.getElementById("finAnaliseKpis");
            const alertas = document.getElementById("finAnaliseAlertas");
            const chart = document.getElementById("finAnaliseChart");
            return Boolean(
              pane &&
                !pane.classList.contains("hidden") &&
                chart?.querySelector("svg") &&
                String(kpis?.textContent || "").includes("Viabilidade") &&
                alertas &&
                String(alertas.textContent || "").length > 10
            );
          });
          record("financeiro E2E: análise inteligente com projeção e alertas", aOk);
        } else {
          record("financeiro E2E: módulo Relação de pagamento por cliente abre", false, "tela financeiro não abriu");
          record("financeiro E2E: módulo Resumo de quantitativo abre", false, "tela financeiro não abriu");
          record("financeiro E2E: módulo Previsão de receita abre", false, "tela financeiro não abriu");
          record("financeiro E2E: despesa manutenção pede placa", false, "tela financeiro não abriu");
          record("financeiro E2E: histórico da planilha alimenta despesas", false, "tela financeiro não abriu");
          record("financeiro E2E: categoria manutenção mostra campo placa", false, "tela financeiro não abriu");
          record("financeiro E2E: gráficos de despesas com filtros", false, "tela financeiro não abriu");
          record("financeiro E2E: troca de óleo bate com o histórico da planilha", false, "tela financeiro não abriu");
          record("financeiro E2E: análise inteligente com projeção e alertas", false, "tela financeiro não abriu");
        }
        await pageE2e.locator("#btn-voltar-financeiro-locadora").click().catch(() => null);
        await pageE2e.waitForTimeout(400);
      } else {
        record("financeiro E2E: abre tela nova com Santander e Sicredi", false, "botão FINANCEIRO oculto");
        record("financeiro E2E: módulo Relação de pagamento por cliente abre", false, "botão FINANCEIRO oculto");
        record("financeiro E2E: módulo Resumo de quantitativo abre", false, "botão FINANCEIRO oculto");
        record("financeiro E2E: módulo Previsão de receita abre", false, "botão FINANCEIRO oculto");
        record("financeiro E2E: despesa manutenção pede placa", false, "botão FINANCEIRO oculto");
        record("financeiro E2E: histórico da planilha alimenta despesas", false, "botão FINANCEIRO oculto");
        record("financeiro E2E: categoria manutenção mostra campo placa", false, "botão FINANCEIRO oculto");
        record("financeiro E2E: gráficos de despesas com filtros", false, "botão FINANCEIRO oculto");
        record("financeiro E2E: troca de óleo bate com o histórico da planilha", false, "botão FINANCEIRO oculto");
        record("financeiro E2E: análise inteligente com projeção e alertas", false, "botão FINANCEIRO oculto");
      }

      const veiculoBtn = pageE2e.locator("text=Cadastro de veículo").first();
      if (await veiculoBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
        await veiculoBtn.click();
        await pageE2e.waitForTimeout(800);
        const placaField = pageE2e.locator("#operacaoVeiculoPlaca");
        if (await placaField.isVisible({ timeout: 5000 }).catch(() => false)) {
          await placaField.fill("AAA0A00");
          await placaField.dispatchEvent("input");
          await pageE2e.waitForTimeout(600);
          const modelo = await pageE2e.locator("#operacaoVeiculoModelo").inputValue().catch(() => "");
          const tag = await pageE2e.locator("#operacaoVeiculoTag").inputValue().catch(() => "");
          record(
            "form veículo reconhece AAA0A00",
            /ferrari/i.test(modelo) || tag === "DKCR013" || tag === "DKCR - 013",
            `modelo=${modelo} tag=${tag}`
          );
          await pageE2e.selectOption("#operacaoVeiculoTipo", "CARRO").catch(() => {});
          await placaField.fill("ABC1D23");
          await placaField.dispatchEvent("input");
          await pageE2e.locator("#operacaoVeiculoModelo").fill("VEICULO TESTE MERCOSUL");
          await pageE2e.locator("#formOperacaoVeiculoInline button[type=submit]").click();
          await pageE2e.waitForTimeout(700);
          const veiculoMsg = await pageE2e.locator("#operacaoVeiculoInlineMsg").textContent().catch(() => "");
          record(
            "cadastro veículo aceita Mercosul ABC1D23",
            !/placa inválida/i.test(String(veiculoMsg || "")),
            String(veiculoMsg || "").slice(0, 90)
          );
        }
      }
    } catch (e) {
      record("documentos E2E: painel abre com busca", false, String(e?.message || e).slice(0, 120));
    } finally {
      await pageE2e.close().catch(() => null);
    }
  } catch (e) {
    record("execução sem erro fatal", false, String(e.message || e));
  } finally {
    await browser.close();
  }
}

const MAX_TEST_ATTEMPTS = 3;

async function main() {
  for (let attempt = 1; attempt <= MAX_TEST_ATTEMPTS; attempt++) {
    if (attempt > 1) {
      results.length = 0;
      console.log(`\n>>> Repetindo testes (${attempt}/${MAX_TEST_ATTEMPTS}) após falha parcial...\n`);
      await new Promise((r) => setTimeout(r, 5000));
    }
    await runSuite();
  const passed = results.filter((r) => r.ok).length;
    const total = results.length;
    if (passed === total) {
      console.log(`\n--- ${passed}/${total} testes passaram${attempt > 1 ? ` (tentativa ${attempt})` : ""} ---`);
      process.exit(0);
    }
    if (attempt < MAX_TEST_ATTEMPTS) {
      console.log(`\n--- ${passed}/${total} testes passaram — nova tentativa ---`);
    } else {
      console.log(`\n--- ${passed}/${total} testes passaram (após ${MAX_TEST_ATTEMPTS} tentativas) ---`);
      process.exit(1);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
