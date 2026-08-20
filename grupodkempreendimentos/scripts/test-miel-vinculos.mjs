/**
 * Confere vínculos Excel no portal (Cad_Clientes → destinos da planilha).
 * node scripts/test-miel-vinculos.mjs
 */
import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE_URL = (process.env.DK_TEST_BASE_URL || "https://demo.grupodkempreendimentos.com.br/").replace(/\/?$/, "/");
const layouts = fs.readdirSync(path.join(__dirname, "../data/miel/layouts")).filter((f) => f.endsWith("-layout.js"));
const map = JSON.parse(fs.readFileSync(path.join(__dirname, "../data/miel/miel-workbook-map.json"), "utf8"));

const results = [];
function rec(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} | ${name}${detail ? " | " + detail : ""}`);
}

async function main() {
  rec("84 layouts exportados", layouts.length === 84, String(layouts.length));
  rec("inventário 84 abas", map.sheetCount === 84, String(map.sheetCount));
  rec("grafo de vínculos", map.linkGraph.length >= 200, String(map.linkGraph.length));

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(BASE_URL, { waitUntil: "networkidle", timeout: 60000 });
  await page.evaluate(() => {
    localStorage.setItem(
      "dk_sessao_cliente",
      JSON.stringify({ tipo: "admin", role: "owner", cpf: "03037897430", nome: "Admin Vínculos" })
    );
    localStorage.setItem("dk_portal_sessao_build", "20260521admin-nav");
    if (typeof window.__DK_portalRefreshMielAcesso === "function") window.__DK_portalRefreshMielAcesso();
  });
  await page.locator('#view-home [data-go="miel"]').first().click({ timeout: 15000 });
  await page.waitForFunction(() => document.getElementById("view-miel")?.classList.contains("view--active"));
  await page.locator('[data-miel-nav="administrativo"]').first().click();
  await page.waitForTimeout(400);
  await page.locator('[data-miel-admin-action="Cadastro de Clientes"]').first().click();
  await page.waitForTimeout(800);

  const hasLinks = await page.evaluate(() => document.querySelectorAll("#mielPanelCadClientes [data-miel-xl-link]").length);
  rec("Cad_Clientes tem vínculos clicáveis", hasLinks >= 6, String(hasLinks));

  await page.locator('#mielPanelCadClientes [data-miel-xl-link*="Emissão_de_Protocolos"]').first().click({ timeout: 8000 });
  await page.waitForTimeout(1200);
  const proto = await page.evaluate(() => ({
    title: document.getElementById("mielMainTitle")?.textContent || "",
    panel: document.querySelector('[data-miel-panel="emissao-de-protocolos"]:not(.hidden) .miel-sheet__grid') ? 1 : 0,
  }));
  rec("link Protocolos abre Emissão_de_Protocolos", proto.panel === 1, proto.title);

  await page.locator('[data-miel-nav="administrativo"]').first().click();
  await page.waitForTimeout(300);
  await page.locator('[data-miel-admin-action="Cadastro de Clientes"]').first().click();
  await page.waitForTimeout(600);
  await page.locator('#mielPanelCadClientes [data-miel-xl-link*="Página_Inicial"]').first().click();
  await page.waitForTimeout(800);
  const home = await page.evaluate(() => document.getElementById("mielMainTitle")?.textContent || "");
  rec("imagem Página Inicial abre Página_Inicial", /Página Inicial/i.test(home), home);

  await page.evaluate(async () => {
    if (typeof window.__DK_mielInitGenericSheet === "function") {
      await window.__DK_mielInitGenericSheet("financeiro", "Financeiro");
    }
    if (typeof window.__DK_mielShowSheet === "function") window.__DK_mielShowSheet("financeiro");
  });
  await page.waitForTimeout(1500);
  const fin = await page.evaluate(() => ({
    title: document.getElementById("mielMainTitle")?.textContent || "",
    grid: Boolean(document.querySelector('[data-miel-panel="financeiro"]:not(.hidden) .miel-sheet__grid')),
    links: document.querySelectorAll('[data-miel-panel="financeiro"] [data-miel-xl-link]').length,
  }));
  rec("aba Financeiro (hub) renderiza com vínculos", fin.grid && fin.links >= 5, JSON.stringify(fin));

  await browser.close();
  const fail = results.filter((r) => !r.ok).length;
  console.log(`\n--- vínculos ${results.length - fail}/${results.length} ---`);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
