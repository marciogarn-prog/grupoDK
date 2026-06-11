/**
 * Check-list de manutenção (Lançamento de manutenção) — demo.
 * 1) Após confirmar a pesquisa, o painel do check-list aparece com os campos
 *    troca de óleo / odômetro / próx. troca (+1000) / pagou / mecânico.
 * 2) Itens 1–29 ocultos até clicar «Detalhamento da manutenção».
 * 3) Assinatura desenhada no canvas (S-pen/touch/rato).
 * 4) «Gerar check-list (PDF)» abre janela com o layout do papel preenchido
 *    (cabeçalho do protocolo, 2 páginas, rodapé SISLOC).
 * node grupodkempreendimentos/scripts/test-manutencao-checklist-demo.mjs
 */
import { chromium } from "playwright";

const BASE = (process.env.DK_TEST_BASE_URL || "https://demo.grupodkempreendimentos.com.br/").replace(/\/?$/, "/");
const CPF_TEST = process.env.DK_LANC_SYNC_CPF || "06523244440";

const results = [];
function record(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} | ${name}${detail ? ` | ${detail}` : ""}`);
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1600 } });
  const page = await context.newPage();
  page.on("dialog", (d) => d.accept().catch(() => null));

  try {
    await page.goto(BASE, { waitUntil: "networkidle", timeout: 90000 });
    await page.evaluate(() => {
      sessionStorage.removeItem("dk_portal_area_ativa");
      localStorage.setItem(
        "dk_sessao_cliente",
        JSON.stringify({ tipo: "admin", role: "owner", cpf: "03037897430", nome: "Admin Checklist" })
      );
      localStorage.setItem("dk_portal_sessao_build", "20260521admin-nav");
      sessionStorage.setItem("dk_portal_sessao_viva_v1", "1");
    });
    await page.goto(`${BASE}#locadora/empresa`, { waitUntil: "networkidle", timeout: 90000 });
    await page.waitForTimeout(1500);

    await page.locator("#btn-locadora-manutencao").click({ timeout: 15000 });
    await page.waitForTimeout(400);
    await page.locator("#btn-operacao-lancamento-manutencao").click({ timeout: 15000 });
    await page.waitForTimeout(600);

    // painel oculto antes da pesquisa
    const ocultoAntes = await page.evaluate(() =>
      document.getElementById("operacaoLancManutencaoChecklistPanel")?.classList.contains("hidden")
    );
    record("check-list oculto antes da pesquisa", ocultoAntes === true);

    // pesquisa por CPF e confirma
    await page.locator("#operacaoLancManutencaoCpf").fill(CPF_TEST);
    await page.locator("#operacaoLancManutencaoCpf").dispatchEvent("input");
    await page.waitForTimeout(800);
    await page.locator("#operacaoLancManutencaoConfirmarPesquisaBtn").click({ timeout: 15000, force: true });
    await page.waitForTimeout(2000);

    const estado = await page.evaluate(() => {
      const vis = (id) => {
        const el = document.getElementById(id);
        if (!el) return false;
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      };
      return {
        painel: vis("operacaoLancManutencaoChecklistPanel"),
        odometro: vis("manutChecklistOdometro"),
        proxTroca: Boolean(document.getElementById("manutChecklistProximaTroca")),
        oleo: document.querySelectorAll('input[name="manutChecklistOleo"]').length,
        pagou: document.querySelectorAll('input[name="manutChecklistPagou"]').length,
        mecanico: document.querySelectorAll('input[name="manutChecklistMecanico"]').length,
        detalheBtn: vis("manutChecklistDetalharBtn"),
        detalheOculto: document.getElementById("manutChecklistDetalheWrap")?.classList.contains("hidden"),
        protocolo: document.getElementById("operacaoLancManutencaoProtocoloSelect")?.value || "",
      };
    });
    record(
      "painel do check-list aparece após confirmar pesquisa",
      estado.painel && estado.odometro && estado.proxTroca,
      `protocolo=${estado.protocolo}`
    );
    record(
      "campos: óleo (2), pagou (3), mecânico (3)",
      estado.oleo === 2 && estado.pagou === 3 && estado.mecanico === 3,
      `oleo=${estado.oleo} pagou=${estado.pagou} mec=${estado.mecanico}`
    );
    record("detalhamento oculto por defeito", estado.detalheBtn && estado.detalheOculto === true);

    // odômetro → próx. troca +1000
    await page.locator("#manutChecklistOdometro").fill("26408");
    await page.locator("#manutChecklistOdometro").dispatchEvent("input");
    const prox = await page.evaluate(() => document.getElementById("manutChecklistProximaTroca")?.value);
    record("próx. troca = odômetro + 1000", prox === "27408", `prox=${prox}`);

    // detalhamento abre com 29 itens
    await page.locator("#manutChecklistDetalharBtn").click();
    await page.waitForTimeout(300);
    const detalhe = await page.evaluate(() => {
      const wrap = document.getElementById("manutChecklistDetalheWrap");
      return {
        visivel: wrap && !wrap.classList.contains("hidden"),
        linhas: wrap ? wrap.querySelectorAll("tbody tr").length : 0,
        item1: wrap?.querySelector("tbody tr td:nth-child(2)")?.textContent || "",
        radios: wrap ? wrap.querySelectorAll('input[type="radio"]').length : 0,
      };
    });
    record(
      "detalhamento abre com 29 itens (A/R + obs)",
      detalhe.visivel && detalhe.linhas === 29 && detalhe.radios === 58,
      `linhas=${detalhe.linhas} item1=«${detalhe.item1}»`
    );
    record("item 1 com texto do papel", detalhe.item1 === "Condição do Kit de Transmissão", detalhe.item1);

    // preencher: óleo sim, pagou S, mecânico TALISON, item 1 = A com obs
    await page.locator('input[name="manutChecklistOleo"][value="sim"]').check();
    await page.locator('input[name="manutChecklistPagou"][value="S"]').check();
    await page.locator('input[name="manutChecklistMecanico"][value="TALISON CAMARGO"]').check();
    await page.locator('input[name="manutChecklistItem1"][value="A"]').check();
    await page.locator("#manutChecklistObs1").fill("ok teste e2e");

    // assinatura do cliente (desenho com rato = S-pen/touch no tablet)
    const canvas = page.locator("#manutChecklistAssinaturaCliente");
    await canvas.scrollIntoViewIfNeeded();
    const box = await canvas.boundingBox();
    await page.mouse.move(box.x + 30, box.y + 60);
    await page.mouse.down();
    await page.mouse.move(box.x + 120, box.y + 40, { steps: 8 });
    await page.mouse.move(box.x + 220, box.y + 80, { steps: 8 });
    await page.mouse.up();
    const assinada = await page.evaluate(() => {
      const c = document.getElementById("manutChecklistAssinaturaCliente");
      const ctx = c.getContext("2d");
      const data = ctx.getImageData(0, 0, c.width, c.height).data;
      for (let i = 3; i < data.length; i += 4) if (data[i] > 0) return true;
      return false;
    });
    record("assinatura desenhada no canvas (tablet/S-pen)", assinada === true);

    // gerar PDF (abre popup)
    const [popup] = await Promise.all([
      context.waitForEvent("page", { timeout: 15000 }),
      page.locator("#manutChecklistGerarPdfBtn").click(),
    ]);
    await popup.waitForLoadState("domcontentloaded").catch(() => null);
    await popup.waitForTimeout(1200);

    const pdf = await popup.evaluate(() => {
      const txt = document.body.innerText || "";
      return {
        semNbspLiteral: !txt.includes("&nbsp;"),
        titulo: txt.includes("CHECK-LIST PARA MANUTENÇÃO / REPARAÇÕES"),
        protocolo: txt.includes("Protocolo Nº"),
        plano: txt.includes("Plano:"),
        cliente: txt.includes("Cód.:") && txt.includes("CPF:"),
        celular: txt.includes("Nº do Celular"),
        oleoSim: txt.includes("SIM"),
        odometro: txt.includes("026408 Km(s)"),
        proxTroca: txt.includes("027408 Km(s)"),
        legenda: txt.includes("Aprovado") && txt.includes("Reprovado"),
        falso: txt.includes("FALSO"),
        item29: txt.includes("Condição da Junta do Motor"),
        linha33: txt.includes("33"),
        mecanicos: txt.includes("TALISON CAMARGO") && txt.includes("SAMUEL VICTOR") && txt.includes("Mecânico II"),
        supervisor: txt.includes("IRINALDO TORRES"),
        rodape: txt.includes("# DK - SISLOC - Sistema de Controle de Locações"),
        pag1: txt.includes("Pág.: 1 / 2"),
        pag2: txt.includes("Pág.: 2 / 2"),
        anotacoes: txt.includes("Anotações"),
        assinaturaImg: Boolean(document.querySelector("img.assinatura-img")),
        fotoOuMensagem:
          Boolean(document.querySelector("img.veiculo-img")) ||
          (document.body.innerText || "").includes("AINDA NÃO CADASTRADA"),
        paginas: document.querySelectorAll(".pagina").length,
      };
    });
    record(
      "PDF: cabeçalho (título, plano, protocolo, cliente, celular)",
      pdf.titulo && pdf.protocolo && pdf.plano && pdf.cliente && pdf.celular
    );
    record("PDF: óleo SIM + odômetro 026408 + próx. 027408", pdf.oleoSim && pdf.odometro && pdf.proxTroca);
    record("PDF: legenda A/R + FALSO + itens até 29 + linhas 30–33", pdf.legenda && pdf.falso && pdf.item29 && pdf.linha33);
    record("PDF: mecânicos + supervisor + rodapé SISLOC", pdf.mecanicos && pdf.supervisor && pdf.rodape);
    record("PDF: 2 páginas (1/2 e 2/2 com Anotações)", pdf.paginas === 2 && pdf.pag1 && pdf.pag2 && pdf.anotacoes);
    record("PDF: assinatura do cliente embutida", pdf.assinaturaImg === true);
    record("PDF: foto do veículo ou mensagem «sem imagem»", pdf.fotoOuMensagem === true);
    record("PDF: sem texto literal «&nbsp;»", pdf.semNbspLiteral === true);

    await popup.screenshot({ path: "manutencao-checklist-pdf.png", fullPage: true }).catch(() => null);

    // segundo PDF sem odômetro: células ficam em branco (sem «&nbsp;» literal)
    await popup.close().catch(() => null);
    await page.locator("#manutChecklistOdometro").fill("");
    await page.locator("#manutChecklistOdometro").dispatchEvent("input");
    const [popupVazio] = await Promise.all([
      context.waitForEvent("page", { timeout: 15000 }),
      page.locator("#manutChecklistGerarPdfBtn").click(),
    ]);
    await popupVazio.waitForLoadState("domcontentloaded").catch(() => null);
    await popupVazio.waitForTimeout(800);
    const vazioOk = await popupVazio.evaluate(() => {
      const txt = document.body.innerText || "";
      return !txt.includes("&nbsp;") && !txt.includes("Km(s)");
    });
    record("PDF sem odômetro: células em branco (sem «&nbsp;»)", vazioOk === true);
    await popupVazio.close().catch(() => null);

    // limpar pesquisa esconde o painel
    await page.locator("#operacaoLancManutencaoLimparPesquisaBtn").click({ force: true });
    await page.waitForTimeout(800);
    const ocultoDepois = await page.evaluate(() =>
      document.getElementById("operacaoLancManutencaoChecklistPanel")?.classList.contains("hidden")
    );
    record("check-list esconde ao limpar a pesquisa", ocultoDepois === true);
  } catch (err) {
    record("execução sem erro fatal", false, String(err?.message || err).slice(0, 200));
  } finally {
    await browser.close();
  }

  const okCount = results.filter((r) => r.ok).length;
  console.log(`\n--- ${okCount}/${results.length} testes check-list manutenção ---`);
  if (okCount !== results.length) process.exit(1);
}

run();
