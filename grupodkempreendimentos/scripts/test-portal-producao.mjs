/**
 * Smoke test em produção (headless) — DK Locadora portal cadastro.
 * node scripts/test-portal-producao.mjs
 */
import { chromium } from "playwright";

const BASE_URL = "https://grupodkempreendimentos.com.br/";
const results = [];

function record(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} | ${name}${detail ? ` | ${detail}` : ""}`);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.goto(BASE_URL, { waitUntil: "networkidle", timeout: 60000 });

    const html = await page.content();
    record("HTML com cache banco-unificado", html.includes("banco-unificado"), "scripts");
    const cacheOk =
      html.includes("locadora-hub") ||
      html.includes("data-auto") ||
      html.includes("mascaras") ||
      html.includes("20260520") ||
      html.includes("20260530");
    record("HTML com cache app/portal atualizado", cacheOk, "app.js + portal-locadora-ui.js");
    record(
      "views hub locadora no HTML",
      html.includes("view-locadora-hub") && html.includes("view-locadora-cliente")
    );
    record(
      "secção comprovantes app cliente no portal",
      html.includes("portalComprovanteClienteLista") &&
        (html.includes("App cliente") || html.includes("portal-lanc-cliente-comprovacao"))
    );
    record(
      "lançamento com comprovante operador (extrair + confirmar)",
      html.includes("portalOperadorComprovantePasteZone") &&
        html.includes("portalOperadorComprovanteExtrairIaBtn") &&
        html.includes("portalOperadorComprovanteConfirmarBtn") &&
        html.includes("portalOperadorComprovanteResumo")
    );
    record(
      "submenu lançamento aluguel (4 painéis)",
      html.includes("btn-lanc-aluguel-avulso") &&
        html.includes("operacaoLancAluguelPaneValidacao") &&
        html.includes("operacaoLancAluguelPaneRelatorios")
    );
    record(
      "PDF partilhar e-mail WhatsApp",
      html.includes("portalPdfPartilharBtn") &&
        html.includes("portalPdfPartilharEmailBtn") &&
        html.includes("portalPdfPartilharWhatsAppBtn")
    );
    record(
      "botão Baixar APP na home",
      html.includes('home-baixar-app-btn') && html.includes("app.html") && html.includes("Baixar APP") &&
        html.includes("dk-pwa-update.js")
    );
    record(
      "cadastro patrimônio CRLV (admin)",
      html.includes("btn-locadora-patrimonio") &&
        html.includes("panel-patrimonio-locadora") &&
        html.includes("patrimonioBtnNovoDoc") &&
        html.includes("patrimonioVerRelatorioBtn") &&
        html.includes("patrimonioRelatorioContador") &&
        html.includes("patrimonioRelatorioConteudo") &&
        html.includes("patrimonioRelatorioModal") &&
        html.includes("patrimonioCameraCapturarBtn") &&
        html.includes("patrimonioCameraFlashBtn") &&
        html.includes("patrimonioCameraNativaBtn") &&
        html.includes("patrimonio-shutter") &&
        html.includes("patrimonioPreviewSimBtn") &&
        html.includes("patrimonioPreviewRetratBtn") &&
        html.includes("patrimonioFotosLista") &&
        html.includes("patrimonioFotoCapturaViewer") &&
        html.includes("patrimonioFotoCapturaRevisarBtn") &&
        html.includes("portal-patrimonio-scan.js") &&
        html.includes("portal-patrimonio.js")
    );
    const indexFresh = await fetch(BASE_URL, { cache: "no-store" }).then((r) =>
      r.ok ? r.text() : ""
    );
    record(
      "cadastro veículo resumo frota no HTML",
      indexFresh.includes("operacaoVeiculoResumoGrid") &&
        indexFresh.includes("operacao-veiculo-resumo-frota")
    );
    const portalUiJs = await page.evaluate(async () => {
      const r = await fetch("portal-locadora-ui.js?v=20260531veic-ordem", { cache: "no-store" });
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
    const scanJs = await page.evaluate(async () => {
      const r = await fetch("portal-patrimonio-scan.js?v=20260531scan-v5", { cache: "no-store" });
      return r.ok ? await r.text() : "";
    });
    record(
      "recorte CRLV exclui fundo colorido",
      scanJs.includes("isTecidoOuRosa") &&
        scanJs.includes("encontrarLimitesDocumentoCrlv") &&
        scanJs.includes("retocarImagemArmazenada") &&
        scanJs.includes("SCAN_VERSION = 4")
    );
    const patJs = await page.evaluate(async () => {
      const r = await fetch("portal-patrimonio.js?v=20260601fotos-todas", { cache: "no-store" });
      return r.ok ? await r.text() : "";
    });
    record(
      "câmera patrimônio sem zoom (preview + sensor)",
      patJs.includes("normalizarCameraSemZoom") &&
        patJs.includes('resizeMode: "none"') &&
        !patJs.includes("height: { ideal: 2560 }")
    );
    record(
      "câmera patrimônio lanterna/flash (torch)",
      patJs.includes("patrimonioDetectarCameraTraseiraComLanterna") &&
        patJs.includes("lerCrlvComRetry") &&
        patJs.includes("renavamValido") &&
        patJs.includes("aplicarFlashCameraComReforco")
    );
    record(
      "patrimônio fotos capturadas (histórico + revisar IA)",
      patJs.includes("registrarFotoCaptura") &&
        patJs.includes("confirmarFotoPatrimonio") &&
        patJs.includes("enfileirarIaPatrimonio") &&
        patJs.includes("formatTagPatrimonioFoto") &&
        patJs.includes("repararFotosCapturasPendentes") &&
        patJs.includes("patrimonio-foto-excluir")
    );
    const cssStyles = await fetch(`${BASE_URL}styles.css?v=20260601fotos-todas`, {
      cache: "no-store",
    }).then((r) => (r.ok ? r.text() : ""));
    record(
      "CSS câmera patrimônio object-fit contain",
      /\.patrimonio-overlay--camera\s+\.patrimonio-camera-video[\s\S]*?object-fit:\s*contain/.test(
        cssStyles
      )
    );
    record(
      "CSS cartões frota legíveis (texto claro no botão)",
      cssStyles.includes(".operacao-veiculo-resumo-card") &&
        cssStyles.includes("color: var(--text") &&
        cssStyles.includes("appearance: none")
    );
    record(
      "patrimônio uma placa substitui foto antiga",
      patJs.includes("deduplicarDocumentos") &&
        patJs.includes("imagemAtualizadaEm") &&
        patJs.includes("comprimirImagemLimite") &&
        patJs.includes("PLACA_MERCOSUL_RE") &&
        patJs.includes("resolverPlacaMercosul") &&
        patJs.includes("sanitizarDocumentoPatrimonio") &&
        patJs.includes("chavesIdentidadePatrimonio") &&
        patJs.includes("docMesmaIdentidade") &&
        patJs.includes("migrarImagensPatrimonioScan")
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
    }));
    record(
      "placa Mercosul LLLNLNN único padrão",
      placaMercosulOk.fn && placaMercosulOk.ok && placaMercosulOk.ocr,
      placaMercosulOk.ocr ? "SOXA284→SOX2A84" : "validação"
    );
    record(
      "portal conferência operador (texto)",
      html.includes("funcionário cadastrado") || html.includes("funcionario cadastrado") || html.includes("Conferir comprovante")
    );

    const hasPortalFns = await page.evaluate(() => ({
      unify: typeof window.__DK_unifyCadastroSingleDatabaseOnce === "function",
      banco: Boolean(window.DK_BANCO_CADASTRO?.veiculos?.length),
      upsert: typeof window.__DK_upsertPortalClienteByCpf === "function",
      dateMask: typeof window.formatDateMask === "function",
      isDkDate: typeof window.isDkDateFieldInput === "function",
      autoDate: typeof window.bindDateMasksInContainer === "function",
      observer: Boolean(window.__dkDateMaskObserver),
      currencyMask: typeof window.formatCurrencyMask === "function",
    }));
    record("app.js banco unificado", hasPortalFns.unify && hasPortalFns.upsert && hasPortalFns.banco);
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

    await page.click("text=DK Locadora", { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(800);

    const hubCliente = page.locator("text=Área do Cliente").first();
    const hubEmpresa = page.locator("text=Área da Empresa").first();
    record(
      "hub DK Locadora (cliente + empresa)",
      (await hubCliente.isVisible().catch(() => false)) && (await hubEmpresa.isVisible().catch(() => false))
    );

    if (await hubEmpresa.isVisible().catch(() => false)) {
      await hubEmpresa.click();
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

    const storage = await page.evaluate(() => {
      const rawC = localStorage.getItem("dk_clientes_cadastro");
      const rawV = localStorage.getItem("dk_veiculos_cadastro");
      const dig = (s) => String(s ?? "").replace(/\D/g, "");
      const norm = (p) => String(p || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
      let clientes = [];
      let veiculos = [];
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
      const c1 = clientes.find((c) => dig(c.cpf) === "00000000001");
      const ferrari = veiculos.find((v) => norm(v.placa) === "AAA0A00");
      const frota = veiculos.filter((v) => !v.origemPortal);
      const portal = veiculos.filter((v) => v.origemPortal);
      return {
        clientes: clientes.length,
        veiculos: veiculos.length,
        frota: frota.length,
        portal: portal.length,
        teste001: c1?.nome || "",
        ferrari: ferrari ? `${ferrari.modelo} ${ferrari.tag}` : "",
        flag: localStorage.getItem("dk_banco_cadastro_unificado_v2"),
      };
    });

    record("unificação v2 executada", storage.flag === "1", `flag=${storage.flag}`);
    record("banco clientes ≥ 4", storage.clientes >= 4, `count=${storage.clientes}`);
    record("banco veículos ≥ 165", storage.veiculos >= 165, `count=${storage.veiculos}`);
    record("TESTE-001 no localStorage", /teste-001/i.test(storage.teste001), storage.teste001);
    record("Ferrari no banco único", /ferrari/i.test(storage.ferrari) && /DKCR013/.test(storage.ferrari), storage.ferrari);
    record("frota+portal no mesmo arquivo", storage.frota >= 100 && storage.portal >= 3, `frota=${storage.frota} portal=${storage.portal}`);

    const appsHtml = await page.evaluate(() => fetch("./apps.html").then((r) => r.text()));
    record("pagina apps.html disponivel", appsHtml.includes("App Cliente") && appsHtml.includes("App Grupo DK"));

    await page.goto(new URL("cliente.html", BASE_URL).href, { waitUntil: "networkidle", timeout: 60000 });
    const clienteGateRedirect =
      page.url().includes("locadora/cliente") ||
      (await page.content()).includes("Baixar / instalar app");
    record(
      "cliente.html exige gate (redireciona para área cliente)",
      clienteGateRedirect,
      page.url()
    );

    const clienteHtmlUrl = new URL("cliente.html", BASE_URL).href;
    const clienteHtml = await fetch(clienteHtmlUrl).then((r) => r.text());
    record(
      "app cliente auto-sync e notificações",
      clienteHtml.includes("atualizarProgramaEDados") === false &&
        clienteHtml.includes("cliente-notificacoes.js") &&
        clienteHtml.includes("cliente-contrato-resumo.js") &&
        clienteHtml.includes("cliente-notificacoes-wrap"),
      "scripts v20260520cliente-v2"
    );
    record(
      "app cliente resumo contrato no HTML",
      clienteHtml.includes("Meus contratos") && clienteHtml.includes("cliente-contrato-resumo.js")
    );

    const clienteBtn = page.locator("text=Cadastro de cliente").first();
    if (await clienteBtn.isVisible().catch(() => false)) {
      await clienteBtn.click();
      await page.waitForTimeout(800);
      const cpfField = page.locator("#operacaoClienteCpf");
      if (await cpfField.isVisible().catch(() => false)) {
        await cpfField.fill("000.000.000-01");
        await cpfField.dispatchEvent("input");
        await page.waitForTimeout(600);
        const nomeVal = await page.locator("#operacaoClienteNome").inputValue().catch(() => "");
        record("form cliente preenche nome ao digitar CPF", /teste-001/i.test(nomeVal), nomeVal || "(vazio)");
      }
    }

    const locacaoBtn = page.locator("text=Cadastro de locação").first();
    if (await locacaoBtn.isVisible().catch(() => false)) {
      await locacaoBtn.click();
      await page.waitForTimeout(800);
      const dataInicio = page.locator("#operacaoLocacaoDataInicio");
      if (await dataInicio.isVisible().catch(() => false)) {
        await dataInicio.fill("");
        await dataInicio.type("19052026", { delay: 30 });
        await page.waitForTimeout(300);
        const dataVal = await dataInicio.inputValue();
        record("mascara data DD/MM/AAAA", dataVal === "19/05/2026", dataVal);
      }
      const valAluguel = page.locator("#operacaoLocacaoValorAluguel");
      if (await valAluguel.isVisible().catch(() => false)) {
        await valAluguel.fill("");
        await valAluguel.type("12345", { delay: 30 });
        await page.waitForTimeout(300);
        const valRaw = await valAluguel.inputValue();
        const okVal = /R\$\s*123,45/.test(valRaw);
        record("mascara valor R$ xxx,xx", okVal, valRaw);
      }
    }

    const veiculoBtn = page.locator("text=Cadastro de veículo").first();
    if (await veiculoBtn.isVisible().catch(() => false)) {
      await veiculoBtn.click();
      await page.waitForTimeout(800);
      const placaField = page.locator("#operacaoVeiculoPlaca");
      if (await placaField.isVisible().catch(() => false)) {
        await placaField.fill("AAA0A00");
        await placaField.dispatchEvent("input");
        await page.waitForTimeout(600);
        const modelo = await page.locator("#operacaoVeiculoModelo").inputValue().catch(() => "");
        const tag = await page.locator("#operacaoVeiculoTag").inputValue().catch(() => "");
        record(
          "form veículo reconhece AAA0A00",
          /ferrari/i.test(modelo) || tag === "DKCR013",
          `modelo=${modelo} tag=${tag}`
        );
      }
    }
  } catch (e) {
    record("execução sem erro fatal", false, String(e.message || e));
  } finally {
    await browser.close();
  }

  const passed = results.filter((r) => r.ok).length;
  console.log(`\n--- ${passed}/${results.length} testes passaram ---`);
  process.exit(passed === results.length ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
