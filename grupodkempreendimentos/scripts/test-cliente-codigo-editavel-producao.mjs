/**
 * Admin titular (CPF 03037897430) — login real + campo Cód. editável.
 * node grupodkempreendimentos/scripts/test-cliente-codigo-editavel-producao.mjs
 */
import { chromium } from "playwright";

const BASE = process.env.DK_TEST_BASE || "https://grupodkempreendimentos.com.br/";
const OWNER_CPF = "03037897430";
const OWNER_SENHA = "110499@Gb";
const CODIGO_TESTE = "CLIENTE 9999";

const results = [];
function record(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} | ${name}${detail ? ` | ${detail}` : ""}`);
}

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  page.on("dialog", (d) => d.accept().catch(() => {}));

  await page.goto(BASE, { waitUntil: "networkidle", timeout: 90000 });
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  await page.goto(`${BASE}#locadora`, { waitUntil: "networkidle", timeout: 90000 });
  await page.locator('[data-locadora-go="empresa"]').click({ timeout: 15000 });
  await page.waitForTimeout(600);
  await page.locator('[data-role="administrador"]').click();
  await page.locator("#login-cpf").fill(OWNER_CPF);
  await page.locator("#login-senha").fill(OWNER_SENHA);
  await page.locator("#form-login button[type=submit]").click();
  await page.waitForTimeout(2500);

  const scriptSrc = await page.evaluate(() => {
    const admin = Array.from(document.querySelectorAll("script[src]")).find((el) =>
      String(el.getAttribute("src") || "").includes("portal-cliente-codigo-admin.js")
    );
    const ui = Array.from(document.querySelectorAll("script[src]")).find((el) =>
      String(el.getAttribute("src") || "").includes("portal-locadora-ui.js")
    );
    return { admin: admin?.getAttribute("src") || "", ui: ui?.getAttribute("src") || "" };
  });
  record("HTML carrega portal-cliente-codigo-admin.js", /codigo-admin/.test(scriptSrc.admin), scriptSrc.admin);
  record("HTML carrega portal-locadora-ui recente", /codigo-editavel/.test(scriptSrc.ui), scriptSrc.ui);

  await page.locator("#btn-locadora-operacao").click({ timeout: 15000 });
  await page.waitForTimeout(500);
  await page.locator("#btn-operacao-cadastro-cliente").click({ timeout: 15000 });
  await page.waitForTimeout(1000);

  const estado = await page.evaluate(() => {
    const el = document.getElementById("operacaoClienteCodigo");
    const fn = window.__DK_portalAdminPodeEditarCodigoCliente;
    const unlock = window.__DK_unlockClienteCodigoAdmin;
    return {
      exists: Boolean(el),
      readOnly: el?.readOnly,
      hasReadonlyAttr: el?.hasAttribute("readonly"),
      placeholder: el?.placeholder || "",
      podeEditarFn: typeof fn === "function" ? fn() : null,
      unlockFn: typeof unlock === "function",
      session: localStorage.getItem("dk_sessao_cliente"),
    };
  });

  record("campo Cód. existe", estado.exists);
  record("unlock helper carregado", estado.unlockFn === true);
  record("portalAdminPodeEditarCodigoCliente() true", estado.podeEditarFn === true, String(estado.podeEditarFn));
  record("campo não readonly (prop)", estado.readOnly === false, `readOnly=${estado.readOnly}`);
  record("campo sem attr readonly", estado.hasReadonlyAttr === false, `attr=${estado.hasReadonlyAttr}`);
  record("placeholder editável", estado.placeholder.includes("CLIENTE"), estado.placeholder);

  await page.locator("#operacaoClienteCodigo").fill(CODIGO_TESTE);
  const valor = await page.inputValue("#operacaoClienteCodigo");
  record("consegue digitar no campo Cód.", valor === CODIGO_TESTE, `valor=${valor}`);

  const fails = results.filter((r) => !r.ok);
  console.log(`\n--- ${results.length - fails.length}/${results.length} testes passaram ---`);
  if (fails.length) process.exit(1);
} finally {
  await browser.close();
}
