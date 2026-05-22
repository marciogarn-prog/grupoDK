/**
 * E2E — avisos marcados como lidos não voltam após sync.
 * node grupodkempreendimentos/scripts/test-cliente-notificacoes-producao.mjs
 */
import { chromium } from "playwright";

const BASE = (process.env.DK_TEST_BASE || "https://grupodkempreendimentos.com.br/").replace(
  /\/?$/,
  "/"
);
const EXPECT_BUNDLE = process.env.DK_EXPECT_BUNDLE || "20260522jose-040-fix";

const JOSE_CPF = "19174403400";
const PROTO = "2026010101";
const TEST_ID = "cn_e2e_notif_lidas_fix";

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
    record(`bundle ${EXPECT_BUNDLE}`, html.includes(EXPECT_BUNDLE));

    await page.evaluate(async () => {
      if (typeof window.__DK_pullCloudSnapshotSilentMerge === "function") {
        await window.__DK_pullCloudSnapshotSilentMerge();
      }
    });
    await page.waitForTimeout(3000);

    await page.locator("#login-cpf").fill(JOSE_CPF);
    await page.locator("#login-senha").fill("123456");
    await page.locator("#form-login button[type=submit]").click();
    await page.waitForSelector("#view-app:not(.hidden)", { timeout: 25000 }).catch(() => {});
    await page.waitForTimeout(3000);

    const prep = await page.evaluate(({ testId, cpf, proto }) => {
      let all = [];
      try {
        all = JSON.parse(localStorage.getItem("dk_cliente_notificacoes") || "[]");
      } catch {
        all = [];
      }
      if (!Array.isArray(all)) all = [];
      all = all.filter((n) => n.id !== testId);
      all.unshift({
        id: testId,
        tipo: "pagamento_confirmado",
        cpf,
        protocolo: proto,
        valor: 50,
        dataPagamento: "01/01/2026",
        mensagem: "Aviso E2E — pagamento teste notificações.",
        criadoEm: new Date().toISOString(),
        lido: false,
      });
      localStorage.setItem("dk_cliente_notificacoes", JSON.stringify(all.slice(0, 300)));
      if (typeof window.__DK_markLocalDataAuthority === "function") {
        window.__DK_markLocalDataAuthority(10 * 60 * 1000);
      }
      return { unread: all.filter((n) => n.id === testId && !n.lido).length };
    }, { testId: TEST_ID, cpf: JOSE_CPF, proto: PROTO });

    record("fixture aviso não lido", prep.unread === 1);

    await page.evaluate(async () => {
      if (typeof window.__DK_clienteAppRecarregar === "function") {
        await window.__DK_clienteAppRecarregar();
      }
    });
    await page.waitForTimeout(2000);

    const wrapVisibleBefore = await page.evaluate(() => {
      return !document.getElementById("cliente-notificacoes-wrap")?.classList.contains("hidden");
    });
    record("painel avisos visível antes", wrapVisibleBefore);

    await page.locator("#btn-notif-lidas").click();
    await page.waitForTimeout(1500);

    const afterMark = await page.evaluate((testId) => {
      const wrapHidden = document
        .getElementById("cliente-notificacoes-wrap")
        ?.classList.contains("hidden");
      let rec = null;
      try {
        const all = JSON.parse(localStorage.getItem("dk_cliente_notificacoes") || "[]");
        rec = all.find((n) => n.id === testId) || null;
      } catch {
        /* ignore */
      }
      const unread = (() => {
        if (typeof window.__DK_clienteNotificacoesList !== "function") return -1;
        return window.__DK_clienteNotificacoesList(
          JSON.parse(localStorage.getItem("dk_sessao_cliente_app") || "{}").cpf || "19174403400"
        ).length;
      })();
      return { wrapHidden, lido: Boolean(rec?.lido), lidaEm: rec?.lidaEm || "", unread };
    }, TEST_ID);

    record("painel oculto após marcar lidos", afterMark.wrapHidden);
    record("lido=true no LS", afterMark.lido, afterMark.lidaEm);
    record("lista unread vazia", afterMark.unread === 0, `unread=${afterMark.unread}`);

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

    const afterSync = await page.evaluate((testId) => {
      const wrapHidden = document
        .getElementById("cliente-notificacoes-wrap")
        ?.classList.contains("hidden");
      let rec = null;
      try {
        const all = JSON.parse(localStorage.getItem("dk_cliente_notificacoes") || "[]");
        rec = all.find((n) => n.id === testId) || null;
      } catch {
        /* ignore */
      }
      const textoVisivel = document.getElementById("cliente-notificacoes")?.innerText || "";
      return {
        wrapHidden,
        lido: Boolean(rec?.lido),
        textoTemE2E: /Aviso E2E/i.test(textoVisivel),
      };
    }, TEST_ID);

    record("após sync: painel continua oculto", afterSync.wrapHidden);
    record("após sync: lido mantido", afterSync.lido);
    record("após sync: texto E2E não na UI", !afterSync.textoTemE2E, `e2e=${afterSync.textoTemE2E}`);
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
