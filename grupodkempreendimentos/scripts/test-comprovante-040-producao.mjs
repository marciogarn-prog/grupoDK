/**
 * E2E — comprovante R$ 0,40 (erro centavos) corrige para fila do operador / confirmado.
 * node grupodkempreendimentos/scripts/test-comprovante-040-producao.mjs
 */
import { chromium } from "playwright";

const BASE = (process.env.DK_TEST_BASE || "https://grupodkempreendimentos.com.br/").replace(
  /\/?$/,
  "/"
);
const EXPECT_BUNDLE = process.env.DK_EXPECT_BUNDLE || "20260522valor-040b";

const JOSE_CPF = "19174403400";
const PROTO = "2026010101";
const TEST_ID = "cc_e2e_valor_040_fix";

const results = [];
function record(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} | ${name}${detail ? ` | ${detail}` : ""}`);
}

async function loginOwner(page) {
  await page.goto(`${BASE}#locadora/empresa/administrador`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1000);
  await page.locator("#login-cpf").fill("03037897430");
  await page.locator("#login-senha").fill(process.env.DK_OWNER_SENHA || "110499@Gb");
  await page.locator("#form-login button[type=submit]").click();
  await page.waitForSelector("#panel-logado:not(.hidden)", { timeout: 20000 });
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    const html0 = await (await fetch(`${BASE}cliente.html`)).text();
    record(`bundle cliente ${EXPECT_BUNDLE}`, html0.includes(EXPECT_BUNDLE));

    await loginOwner(page);
    const html = await page.content();
    record(`bundle portal ${EXPECT_BUNDLE}`, html.includes(EXPECT_BUNDLE));

    await page.evaluate(async () => {
      if (typeof window.__DK_pullCloudSnapshotSilentMerge === "function") {
        await window.__DK_pullCloudSnapshotSilentMerge();
      }
    });
    await page.waitForTimeout(3000);

    const prep = await page.evaluate(({ testId, cpf, proto }) => {
      let all = [];
      try {
        all = JSON.parse(localStorage.getItem("dk_comprovantes_cliente_pendentes") || "[]");
      } catch {
        all = [];
      }
      if (!Array.isArray(all)) all = [];
      all = all.filter((r) => r.id !== testId);
      all.unshift({
        id: testId,
        cpf,
        protocolo: proto,
        numeroContrato: proto,
        status: "ia_validado",
        valor: 0.4,
        dataPagamento: "20/05/2026",
        enviadoEm: new Date().toISOString(),
        syncNuvem: "ok",
        iaValidacao: {
          validadoEm: new Date().toISOString(),
          valor: 40,
          valorBruto: 40,
          confereValor: false,
          revisaoValorManual: true,
          observacoes: "Teste E2E centavos",
        },
      });
      localStorage.setItem("dk_comprovantes_cliente_pendentes", JSON.stringify(all.slice(0, 500)));
      if (typeof window.__DK_comprovantesClienteInvalidateCache === "function") {
        window.__DK_comprovantesClienteInvalidateCache();
      }
      return true;
    }, { testId: TEST_ID, cpf: JOSE_CPF, proto: PROTO });

    record("fixture ia_validado 0,40", prep);

    await page.evaluate(async () => {
      if (typeof window.__DK_comprovantesClienteRepararHistorico === "function") {
        await window.__DK_comprovantesClienteRepararHistorico({ leve: false });
      }
    });
    await page.waitForTimeout(2000);

    const posNorm = await page.evaluate((testId) => {
      let rec = null;
      try {
        const all = JSON.parse(localStorage.getItem("dk_comprovantes_cliente_pendentes") || "[]");
        rec = all.find((r) => r.id === testId) || null;
      } catch {
        /* ignore */
      }
      let naFila = 0;
      if (typeof window.__DK_comprovantesClienteListPendentes === "function") {
        naFila = window.__DK_comprovantesClienteListPendentes().filter((r) => r.id === testId).length;
      }
      return {
        valor: rec?.valor,
        status: rec?.status,
        naFila,
        corrigido: Boolean(rec?.valorCorrigidoSistemaEm),
      };
    }, TEST_ID);

    record(
      "normalizar: valor ≥ 1 (não 0,40)",
      Number(posNorm.valor) >= 1,
      `valor=${posNorm.valor} status=${posNorm.status}`
    );
    record(
      "portal: na fila operador ou confirmado",
      posNorm.naFila > 0 || posNorm.status === "confirmado",
      JSON.stringify(posNorm)
    );

    await page.locator("text=Operação").first().click();
    await page.waitForTimeout(500);
    await page.locator("text=Lançamento de aluguel").first().click();
    await page.waitForTimeout(1200);

    const listaHtml = await page.locator("#portalComprovanteClienteLista").innerText();
    record(
      "portal lista menciona teste ou aguarda confirmação",
      /aguardam confirmação|cc_e2e_valor_040|E2E|40,00|R\$\s*40/i.test(listaHtml),
      listaHtml.slice(0, 120)
    );

    const ctx = await browser.newContext();
    const appPage = await ctx.newPage();
    await appPage.goto(`${BASE}cliente?instalar=1&cpf=${JOSE_CPF}&proto=${PROTO}`, {
      waitUntil: "domcontentloaded",
    });
    await appPage.waitForTimeout(2000);
    await appPage.evaluate(async ({ testId, cpf, proto }) => {
      let all = [];
      try {
        all = JSON.parse(localStorage.getItem("dk_comprovantes_cliente_pendentes") || "[]");
      } catch {
        all = [];
      }
      const rec = all.find((r) => r.id === testId);
      if (rec) {
        rec.valor = 0.4;
        rec.status = "ia_validado";
        localStorage.setItem("dk_comprovantes_cliente_pendentes", JSON.stringify(all));
      }
      if (typeof window.__DK_comprovantesClienteInvalidateCache === "function") {
        window.__DK_comprovantesClienteInvalidateCache();
      }
      if (typeof window.__DK_comprovantesClienteRepararHistorico === "function") {
        await window.__DK_comprovantesClienteRepararHistorico({ leve: true });
      }
    }, { testId: TEST_ID, cpf: JOSE_CPF, proto: PROTO });
    await appPage.waitForTimeout(1500);
    const appUi = await appPage.evaluate(() => {
      const txt = document.getElementById("view-app")?.innerText || "";
      return {
        tem040: /R\$\s*0[,.]40/i.test(txt),
        tem40: /R\$\s*40[,.]00/i.test(txt),
        temConferido: /Conferido — aguarda confirmação final/i.test(txt),
      };
    });
    record("app: não mostra R$ 0,40 após normalizar", !appUi.tem040, JSON.stringify(appUi));
    await ctx.close();
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
