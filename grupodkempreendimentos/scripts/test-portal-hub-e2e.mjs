/**
 * E2E hub Locadora + área cliente/empresa em produção.
 * node scripts/test-portal-hub-e2e.mjs
 */
import { chromium } from "playwright";

const BASE_URL = process.env.BASE_URL || "https://grupodkempreendimentos.com.br/";
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
    await page.click("text=DK Locadora", { timeout: 15000 });
    await page.waitForTimeout(600);
    record("Hub após DK Locadora", await page.locator("text=Área do Cliente").first().isVisible());
    record("Hub área empresa", await page.locator("text=Área da Empresa").first().isVisible());

    await page.click("text=Área do Cliente");
    await page.waitForTimeout(400);
    record("Área cliente — formulário app", await page.locator("#form-locadora-app-download").isVisible());
    record("Área cliente — propaganda", await page.locator(".locadora-propaganda-placeholder").isVisible());

    await page.click('[data-locadora-back="hub"]');
    await page.waitForTimeout(400);
    await page.click("text=Área da Empresa");
    await page.waitForTimeout(500);

    const clienteTab = page.locator('.role-picker__btn[data-role="cliente"]');
    record("Empresa — aba Cliente oculta", !(await clienteTab.isVisible().catch(() => false)));
    record("Empresa — Colaborador visível", await page.locator('.role-picker__btn[data-role="colaborador"]').isVisible());
    record(
      "Empresa — Administrador visível",
      await page.locator('.role-picker__btn[data-role="administrador"]').isVisible()
    );

    const html = await page.content();
    record("Modal confirmação alteração admin", html.includes("portalAdminAlteracaoConfirmModal"));
    record(
      "Cache portal atualizado",
      html.includes("comprovante-cliente") || html.includes("admin-edicao") || html.includes("locadora-hub")
    );

    await page.goto(new URL("#locadora/cliente", BASE_URL).href, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(800);
    record("Hash #locadora/cliente", await page.locator("#locadora-cliente-title").isVisible());
  } catch (err) {
    record("execução E2E", false, err?.message || String(err));
  } finally {
    await browser.close();
  }

  const pass = results.filter((r) => r.ok).length;
  console.log(`\n--- ${pass}/${results.length} testes E2E hub ---`);
  process.exit(pass === results.length ? 0 : 1);
}

main();
