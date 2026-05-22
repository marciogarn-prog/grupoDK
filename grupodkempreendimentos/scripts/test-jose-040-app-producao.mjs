/**
 * E2E — comprovante real José 0,40 (cc_1779377485655) some do app após sync.
 * node grupodkempreendimentos/scripts/test-jose-040-app-producao.mjs
 */
import { chromium } from "playwright";

const BASE = (process.env.DK_TEST_BASE || "https://grupodkempreendimentos.com.br/").replace(
  /\/?$/,
  "/"
);
const EXPECT_BUNDLE = process.env.DK_EXPECT_BUNDLE || "20260522jose-040-fix";
const JOSE_CPF = "19174403400";
const PROTO = "2026010101";
const TARGET_ID = "cc_1779377485655_uz8i5vx";

const results = [];
function record(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} | ${name}${detail ? ` | ${detail}` : ""}`);
}

async function main() {
  const snap = await fetch(`${BASE}api/dk-cloud-snapshot`).then((r) => r.json());
  const list = snap?.payload?.dk_comprovantes_cliente_pendentes || [];
  const rec = list.find((r) => r.id === TARGET_ID);
  record(
    "nuvem: registo José existe",
    Boolean(rec),
    rec ? `status=${rec.status} valor=${rec.valor} deAcordo=${Boolean(rec.clienteDeAcordoEm)}` : ""
  );
  record(
    "nuvem: rejeitado ou de acordo",
    !rec || rec.status === "rejeitado" || Boolean(rec.clienteDeAcordoEm),
    rec?.status
  );

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  try {
    await page.goto(`${BASE}cliente?instalar=1&cpf=${JOSE_CPF}&proto=${PROTO}`, {
      waitUntil: "domcontentloaded",
      timeout: 90000,
    });
    const html = await page.content();
    record(`bundle ${EXPECT_BUNDLE}`, html.includes(EXPECT_BUNDLE));

    await page.locator("#login-cpf").fill(JOSE_CPF);
    await page.locator("#login-senha").fill("123456");
    await page.locator("#form-login button[type=submit]").click();
    await page.waitForSelector("#view-app:not(.hidden)", { timeout: 25000 }).catch(() => {});
    await page.waitForTimeout(2000);

    await page.evaluate(async () => {
      if (typeof window.__DK_pullCloudSnapshotSilentMerge === "function") {
        await window.__DK_pullCloudSnapshotSilentMerge();
      }
      if (typeof window.__DK_comprovantesClienteRepararHistorico === "function") {
        await window.__DK_comprovantesClienteRepararHistorico({ leve: true });
      }
      if (typeof window.__DK_clienteAppRecarregar === "function") {
        await window.__DK_clienteAppRecarregar();
      }
    });
    await page.waitForTimeout(5000);

    const ui = await page.evaluate(() => {
      const txt = document.getElementById("view-app")?.innerText || "";
      return {
        tem040: /R\$\s*0[,.]40|0[,.]40/.test(txt) && /20\/05\/2026/.test(txt),
        temConferido2005:
          /Conferido — aguarda confirmação final/.test(txt) && /20\/05\/2026/.test(txt),
      };
    });

    const ls = await page.evaluate(
      ({ id, cpf }) => {
        let rec = null;
        try {
          const all = JSON.parse(localStorage.getItem("dk_comprovantes_cliente_pendentes") || "[]");
          rec = all.find((r) => r.id === id) || null;
        } catch {
          /* ignore */
        }
        return {
          status: rec?.status,
          valor: rec?.valor,
          deAcordo: Boolean(rec?.clienteDeAcordoEm),
        };
      },
      { id: TARGET_ID, cpf: JOSE_CPF }
    );

    record("app: sem linha 0,40 em 20/05/2026", !ui.tem040 && !ui.temConferido2005, JSON.stringify(ui));
    record(
      "LS: de acordo ou rejeitado",
      ls.deAcordo || ls.status === "rejeitado",
      JSON.stringify(ls)
    );
  } catch (e) {
    record("E2E exceção", false, e.message || String(e));
  } finally {
    await browser.close();
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n--- ${results.length - failed.length}/${results.length} ---`);
  if (failed.length) {
    console.log("Falhas:", failed.map((f) => f.name).join(", "));
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
