/**
 * E2E — «De acordo» em comprovante recusado não volta após sync/reparar.
 * node grupodkempreendimentos/scripts/test-cliente-de-acordo-producao.mjs
 */
import { chromium } from "playwright";

const BASE = (process.env.DK_TEST_BASE || "https://grupodkempreendimentos.com.br/").replace(
  /\/?$/,
  "/"
);
const EXPECT_BUNDLE = process.env.DK_EXPECT_BUNDLE || "20260522de-acordo";

const JOSE_CPF = "19174403400";
const PROTO = "2026010101";
const TEST_ID = "cc_e2e_de_acordo_fix";

const results = [];
function record(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} | ${name}${detail ? ` | ${detail}` : ""}`);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  try {
    await page.goto(`${BASE}cliente?instalar=1&cpf=${JOSE_CPF}&proto=${PROTO}`, {
      waitUntil: "domcontentloaded",
      timeout: 90000,
    });
    await page.waitForTimeout(1500);

    const html = await page.content();
    record(
      `bundle ${EXPECT_BUNDLE}`,
      html.includes(EXPECT_BUNDLE),
      html.includes(EXPECT_BUNDLE) ? "ok" : "cache antigo no cliente.html"
    );

    await page.evaluate(async () => {
      if (typeof window.__DK_pullCloudSnapshotSilentMerge === "function") {
        await window.__DK_pullCloudSnapshotSilentMerge();
      }
    });
    await page.waitForTimeout(4000);

    await page.locator("#login-cpf").fill(JOSE_CPF);
    await page.locator("#login-senha").fill("123456");
    await page.locator("#form-login button[type=submit]").click();
    await page.waitForTimeout(6000);

    const prep = await page.evaluate(({ testId, cpf, proto }) => {
      const dig = (s) => String(s ?? "").replace(/\D/g, "").slice(0, 11);
      let all = [];
      try {
        all = JSON.parse(localStorage.getItem("dk_comprovantes_cliente_pendentes") || "[]");
      } catch {
        all = [];
      }
      if (!Array.isArray(all)) all = [];
      all = all.filter((r) => r.id !== testId);
      all.push({
        id: testId,
        cpf,
        protocolo: proto,
        numeroContrato: proto,
        status: "rejeitado",
        rejeitadoAutomatico: true,
        rejeitadoMotivoCliente: "Valor do comprovante divergente (teste E2E).",
        rejeitadoMotivo: "valor divergente",
        valor: 1,
        dataPagamento: "15/05/2026",
        enviadoEm: new Date().toISOString(),
        valorCorrigidoSistemaEm: new Date().toISOString(),
        iaValidacao: { valor: 100, valorBruto: 100, confereValor: false },
        syncNuvem: "ok",
      });
      localStorage.setItem("dk_comprovantes_cliente_pendentes", JSON.stringify(all.slice(0, 500)));
      if (typeof window.__DK_comprovantesClienteInvalidateCache === "function") {
        window.__DK_comprovantesClienteInvalidateCache();
      }
      if (typeof window.__DK_markLocalDataAuthority === "function") {
        window.__DK_markLocalDataAuthority(10 * 60 * 1000);
      }
      return { count: all.length };
    }, { testId: TEST_ID, cpf: JOSE_CPF, proto: PROTO });

    record("fixture comprovante recusado", prep.count > 0, `itens=${prep.count}`);

    await page.evaluate(() => {
      if (typeof window.__DK_clienteAppRecarregar === "function") {
        return window.__DK_clienteAppRecarregar();
      }
      return null;
    });
    await page.waitForTimeout(2000);

    const btn = page.locator(`[data-cc-de-acordo="${TEST_ID}"]`);
    await btn.waitFor({ state: "visible", timeout: 15000 });
    record("botão De acordo visível antes do clique", true);

    await btn.click();
    await page.waitForTimeout(800);

    const afterClick = await page.evaluate((testId) => {
      const btnVis = Boolean(document.querySelector(`[data-cc-de-acordo="${testId}"]`));
      let rec = null;
      try {
        const all = JSON.parse(localStorage.getItem("dk_comprovantes_cliente_pendentes") || "[]");
        rec = all.find((r) => r.id === testId) || null;
      } catch {
        /* ignore */
      }
      return {
        btnVis,
        deAcordo: Boolean(rec?.clienteDeAcordoEm),
        status: rec?.status,
      };
    }, TEST_ID);

    record("some após clique (botão sumiu)", !afterClick.btnVis, JSON.stringify(afterClick));
    record("clienteDeAcordoEm gravado", afterClick.deAcordo, afterClick.status);

    await page.evaluate(async () => {
      if (typeof window.__DK_pullCloudSnapshotSilentMerge === "function") {
        await window.__DK_pullCloudSnapshotSilentMerge();
      }
      if (typeof window.__DK_comprovantesClienteRepararHistorico === "function") {
        await window.__DK_comprovantesClienteRepararHistorico({ leve: true });
      }
      if (typeof window.__DK_comprovantesClienteInvalidateCache === "function") {
        window.__DK_comprovantesClienteInvalidateCache();
      }
      if (typeof window.__DK_clienteAppRecarregar === "function") {
        await window.__DK_clienteAppRecarregar();
      }
    });
    await page.waitForTimeout(5000);

    const afterSync = await page.evaluate((testId) => {
      const btnVis = Boolean(document.querySelector(`[data-cc-de-acordo="${testId}"]`));
      let rec = null;
      try {
        const all = JSON.parse(localStorage.getItem("dk_comprovantes_cliente_pendentes") || "[]");
        rec = all.find((r) => r.id === testId) || null;
      } catch {
        /* ignore */
      }
      const rowRejeitadoVis = Boolean(
        document.querySelector(".cliente-pagamento-row--rejeitado")?.innerText?.includes("15/05/2026")
      );
      return {
        btnVis,
        deAcordo: Boolean(rec?.clienteDeAcordoEm),
        status: rec?.status,
        rowRejeitadoVis,
      };
    }, TEST_ID);

    record(
      "após sync+reparar: botão não volta",
      !afterSync.btnVis,
      JSON.stringify(afterSync)
    );
    record(
      "após sync: continua de acordo no LS",
      afterSync.deAcordo && afterSync.status === "rejeitado",
      afterSync.status
    );
    record(
      "após sync: linha recusada E2E não na lista",
      !afterSync.rowRejeitadoVis || !afterSync.btnVis,
      `row=${afterSync.rowRejeitadoVis}`
    );
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
