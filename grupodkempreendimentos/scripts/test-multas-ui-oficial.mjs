/**
 * E2E oficial: ecrã Lançamento de multas com pesquisa no depósito (igual CRLV).
 * Apenas UI — não cria cadastros (oficial fica zerado).
 * node grupodkempreendimentos/scripts/test-multas-ui-oficial.mjs
 */
import { chromium } from "playwright";

const BASE = "https://grupodkempreendimentos.com.br/";

const results = [];
const pageErrors = [];
function record(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} | ${name}${detail ? ` | ${detail}` : ""}`);
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.on("pageerror", (e) => pageErrors.push(String(e?.message || e).slice(0, 160)));

try {
  /* HTML servido tem a nova UI de multas */
  const html = await (await fetch(`${BASE}?nocache=${Date.now()}`)).text();
  record("HTML oficial: painel multas com pesquisa", html.includes("operacaoLancMultasDocBusca") && html.includes("Importar multa"));
  record(
    "HTML oficial: versões novas dos scripts",
    html.includes("portal-locacao-documentos.js?v=20260610multas-busca") &&
      html.includes("portal-lancamentos-extras.js?v=20260610multa-vinculo") &&
      html.includes("app.js?v=20260610multa-vinculo"),
    "cache-bust ok"
  );
  const js = await (await fetch(`${BASE}portal-lancamentos-extras.js?nocache=${Date.now()}`)).text();
  record("JS oficial: vínculo do PDF preservado", js.includes("locacaoDocumentoId = String(x.locacaoDocumentoId)"));
  const jsDocs = await (await fetch(`${BASE}portal-locacao-documentos.js?nocache=${Date.now()}`)).text();
  record(
    "JS oficial: pesquisa de multas no depósito",
    jsDocs.includes("operacaoLancMultasDocBusca") && jsDocs.includes("Importar multa")
  );

  /* Ecrã abre como admin, sem erros */
  await page.goto(BASE, { waitUntil: "networkidle", timeout: 90000 });
  await page.evaluate(() => {
    sessionStorage.removeItem("dk_portal_area_ativa");
    localStorage.setItem(
      "dk_sessao_cliente",
      JSON.stringify({ tipo: "admin", role: "owner", cpf: "03037897430", nome: "Administrador E2E" })
    );
    localStorage.setItem("dk_portal_sessao_build", "20260521admin-nav");
  });
  await page.goto(`${BASE}#locadora/empresa`, { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForFunction(() => {
    const p = document.getElementById("panel-logado");
    const b = document.getElementById("btn-locadora-operacao");
    return p && !p.classList.contains("hidden") && b && !b.classList.contains("hidden");
  }, { timeout: 45000 });
  record("login admin portal oficial", true);

  await page.click("#btn-locadora-operacao");
  await page.waitForTimeout(1200);
  await page.click("#btn-operacao-lancamento-multas");
  await page.waitForTimeout(1000);

  const ui = await page.evaluate(() => {
    const vis = (id) => {
      const el = document.getElementById(id);
      return Boolean(el && el.offsetParent !== null);
    };
    return {
      formVisivel: vis("operacaoLancMultasCpf") && vis("operacaoLancMultasConfirmarPesquisaBtn"),
      buscaNoDom: Boolean(document.getElementById("operacaoLancMultasDocBusca")),
      btnNoDom: Boolean(document.getElementById("operacaoLancMultasDocImportBtn")),
      sugestoesNoDom: Boolean(document.getElementById("operacaoLancMultasDocSugestoes")),
      btnLabel: document.getElementById("operacaoLancMultasDocImportBtn")?.textContent?.trim() || "",
      secOculta: document.getElementById("operacaoLancMultasDocumentosDeposito")?.classList.contains("hidden") ?? null,
    };
  });
  record("ecrã multas abre com pesquisa de contrato", ui.formVisivel === true);
  record(
    "painel multas (busca + Importar multa + sugestões) no DOM",
    ui.buscaNoDom && ui.btnNoDom && ui.sugestoesNoDom && ui.btnLabel === "Importar multa",
    `btn=«${ui.btnLabel}»`
  );
  record("painel oculto até confirmar pesquisa (oficial zerado)", ui.secOculta === true);
  record("sem erros de página (oficial)", pageErrors.length === 0, pageErrors.join(" · ").slice(0, 160) || "0 erros");

  /* Garantir que nada foi cadastrado */
  const zerado = await page.evaluate(() => {
    const len = (k) => {
      try {
        const v = JSON.parse(localStorage.getItem(k) || "[]");
        return Array.isArray(v) ? v.length : 0;
      } catch {
        return 0;
      }
    };
    return { c: len("dk_clientes_cadastro"), v: len("dk_veiculos_cadastro"), l: len("dk_locacoes_cadastro") };
  });
  record("oficial continua zerado (sem poluição)", zerado.c === 0 && zerado.v === 0 && zerado.l === 0, JSON.stringify(zerado));
} catch (e) {
  record("erro inesperado", false, String(e?.message || e).slice(0, 200));
} finally {
  await browser.close();
}

const ok = results.filter((r) => r.ok).length;
console.log(`\n--- ${ok}/${results.length} ---`);
process.exit(ok === results.length ? 0 : 1);
