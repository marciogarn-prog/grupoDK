/**
 * E2E demo: pull nuvem → localStorage → Ver CRLV
 * node grupodkempreendimentos/scripts/test-crlv-cliente-demo.mjs
 */
import { chromium } from "playwright";

const BASE = "https://demo.grupodkempreendimentos.com.br/";
const CPF = "06523244440";
const PROTO = "2026010102";

const results = [];
function record(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} | ${name}${detail ? ` | ${detail}` : ""}`);
}

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ geolocation: { latitude: -9.39, longitude: -40.5 }, permissions: ["geolocation"] });
const page = await ctx.newPage();

try {
  await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.evaluate(({ cpf, proto }) => {
    localStorage.setItem(
      "dk_sessao_cliente_app",
      JSON.stringify({ cpf, nome: "Marcus Test", loginEm: new Date().toISOString() })
    );
    sessionStorage.setItem(
      "dk_cliente_app_gate",
      JSON.stringify({ cpf, proto, ok: true, ts: Date.now() })
    );
  }, { cpf: CPF, proto: PROTO });

  await page.goto(`${BASE}cliente?adminPreview=1`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForTimeout(3000);
  const view = await page.evaluate(() => ({
    app: !document.getElementById("view-app")?.classList.contains("hidden"),
    login: !document.getElementById("view-login")?.classList.contains("hidden"),
    geo: !document.getElementById("view-geolocalizacao")?.classList.contains("hidden"),
    url: location.href,
  }));
  record("app cliente abriu", view.app || view.login, JSON.stringify(view));
  if (!view.app && view.login) {
    await page.locator("#login-cpf").fill(CPF);
    await page.locator("#login-senha").fill("123456");
    await page.locator("#form-login button[type=submit]").click();
    await page.waitForSelector("#view-app:not(.hidden)", { timeout: 30000 });
  }
  await page.waitForTimeout(1500);

  const pullRes = await page.evaluate(async () => {
    if (typeof window.__DK_pullCloudSnapshotSilentMerge !== "function") {
      return { ok: false, reason: "no_pull_fn" };
    }
    return window.__DK_pullCloudSnapshotSilentMerge({ force: true });
  });
  record("pull nuvem cliente", pullRes?.ok === true, JSON.stringify(pullRes));

  const state = await page.evaluate(
    ({ cpf, proto }) => {
      const onlyDigits = (s) => String(s ?? "").replace(/\D/g, "");
      const normNc = (v) =>
        String(v ?? "")
          .trim()
          .toUpperCase()
          .replace(/[^A-Z0-9]/g, "");
      let docs = [];
      try {
        docs = JSON.parse(localStorage.getItem("dk_locacao_documentos_v1") || "[]");
      } catch {
        docs = [];
      }
      const dig = onlyDigits(cpf).slice(0, 11);
      const nc = normNc(proto);
      const rows = docs.filter(
        (d) =>
          normNc(d.numeroContrato) === nc &&
          onlyDigits(d.cpf).slice(0, 11) === dig &&
          d.enviadoCliente === true
      );
      const crlv = rows.filter((d) => {
        const t = String(d.tipo || d.origemDepositoCategoria || "")
          .trim()
          .toLowerCase();
        return t === "crlv" || /crlv/i.test(String(d.nome || ""));
      });
      return {
        channel: window.__DK_DEPLOY_CHANNEL__,
        hasMerge: typeof window.__DK_docsLocacaoMerge === "function",
        countFn:
          typeof window.__DK_clienteDocsLocacaoCount === "function"
            ? window.__DK_clienteDocsLocacaoCount(proto, cpf, "crlv")
            : -1,
        total: docs.length,
        crlv: crlv.length,
        b64len: crlv[0] ? String(crlv[0].arquivoBase64 || "").length : 0,
      };
    },
    { cpf: CPF, proto: PROTO }
  );

  record("canal demo no app", state.channel === "demo", state.channel);
  record("merge docs no app cliente", state.hasMerge === true);
  record("localStorage CRLV enviado", state.crlv >= 1, `total=${state.total} b64=${state.b64len}`);
  record("__DK_clienteDocsLocacaoCount", state.countFn >= 1, String(state.countFn));

  const painel = await page.evaluate(
    ({ cpf, proto }) => {
      if (typeof window.__DK_clienteToggleDocumentosLocacao === "function") {
        window.__DK_clienteToggleDocumentosLocacao(proto, cpf, "crlv");
      }
      const p = document.querySelector(
        `[data-cliente-docs-panel="${proto}"][data-cliente-docs-tipo="crlv"]`
      );
      const titulo = p?.querySelector("[data-cliente-docs-titulo]")?.textContent || "";
      const lista = p?.querySelector("[data-cliente-docs-lista]")?.textContent || "";
      const iframe = Boolean(p?.querySelector(".cliente-doc-iframe"));
      return { titulo, lista, iframe, aberto: p && !p.classList.contains("hidden") };
    },
    { cpf: CPF, proto: PROTO }
  );

  record("painel Ver CRLV aberto", painel.aberto === true, painel.titulo);
  record("painel Ver CRLV com ficheiros", !painel.titulo.includes("sem ficheiros"), painel.titulo);
  record("viewer CRLV (iframe/pdf)", painel.iframe === true, painel.lista.slice(0, 80));
} finally {
  await browser.close();
}

const ok = results.filter((r) => r.ok).length;
console.log(`\n--- ${ok}/${results.length} ---`);
process.exit(ok === results.length ? 0 : 1);
