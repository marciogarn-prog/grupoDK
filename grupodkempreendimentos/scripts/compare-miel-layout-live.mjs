/**
 * Compara layout exportado da planilha vs células renderizadas no portal (DOM).
 * Falha se textos fixos ou larguras de coluna divergirem — evita falso positivo dos verify-*.mjs.
 *
 * node scripts/compare-miel-layout-live.mjs [sheetId] [layoutBase]
 * Ex.: node scripts/compare-miel-layout-live.mjs cad-clientes cad-clientes-layout
 */
import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sheetId = process.argv[2] || "cad-clientes";
const layoutBase = process.argv[3] || `${sheetId.replace(/-/g, "-")}-layout`;
const layoutFile = path.join(__dirname, `../data/miel/${layoutBase}.json`);
const BASE_URL = (process.env.DK_TEST_BASE_URL || "https://demo.grupodkempreendimentos.com.br/").replace(
  /\/?$/,
  "/"
);

/** Células com valores dinâmicos (stats, fórmulas) — não comparar texto. */
const SKIP_TEXT_REFS = new Set([
  "O4",
  "O5",
  "O6",
  "O7",
  "O8",
  "O9",
  "K5",
  "K6",
  "K7",
  "K8",
  "K9",
]);

const ADMIN_ACTIONS = {
  "cad-clientes": "Cadastro de Clientes",
  "cad-veiculos": "Cadastro de Veículos",
  "relacao-clientes": "Relação de Clientes",
  "relacao-veiculos": "Relação de Veículos",
  "status-veiculos": "Status de Veículos",
};

function excelWidthPx(w) {
  if (!w || w <= 0) return 8;
  return Math.max(8, Math.round(w * 7 + 5));
}

function norm(s) {
  return String(s ?? "")
    .replace(/\s+/g, " ")
    .replace(/&gt;/g, ">")
    .trim();
}

async function openPanel(page) {
  await page.goto(BASE_URL, { waitUntil: "networkidle", timeout: 60000 });
  await page.evaluate(() => {
    localStorage.setItem(
      "dk_sessao_cliente",
      JSON.stringify({ tipo: "admin", role: "owner", cpf: "03037897430", nome: "Admin Compare" })
    );
    localStorage.setItem("dk_portal_sessao_build", "20260521admin-nav");
    if (typeof window.__DK_portalRefreshMielAcesso === "function") window.__DK_portalRefreshMielAcesso();
  });
  await page.locator('#view-home [data-go="miel"]').first().click({ timeout: 15000 });
  await page.waitForFunction(() => document.getElementById("view-miel")?.classList.contains("view--active"), {
    timeout: 15000,
  });
  const action = ADMIN_ACTIONS[sheetId];
  if (action) {
    await page.locator('[data-miel-nav="administrativo"]').first().click();
    await page.waitForTimeout(400);
    await page.locator(`[data-miel-admin-action="${action}"]`).first().click();
  } else {
    await page.locator(`[data-miel-nav="${sheetId}"]`).first().click();
  }
  await page.waitForFunction(
    (sid) => {
      const panel = document.querySelector(`[data-miel-panel="${sid}"]:not(.hidden)`);
      return panel && panel.querySelector(".miel-sheet__grid col");
    },
    sheetId,
    { timeout: 20000 }
  );
}

async function main() {
  if (!fs.existsSync(layoutFile)) {
    console.error("Layout não encontrado:", layoutFile);
    process.exit(1);
  }
  const layout = JSON.parse(fs.readFileSync(layoutFile, "utf8"));

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await openPanel(page);

  const dom = await page.evaluate((sid) => {
    const panel = document.querySelector(`[data-miel-panel="${sid}"]:not(.hidden)`);
    const cells = {};
    panel?.querySelectorAll("[data-ref]").forEach((td) => {
      cells[td.getAttribute("data-ref")] = td.textContent?.trim() || "";
    });
    const colPx = [...(panel?.querySelectorAll("col") || [])].map((c) => parseInt(c.style.width, 10) || 0);
    const grid = panel?.querySelector(".miel-sheet__grid");
    return {
      cells,
      colPx,
      tableWidth: parseInt(grid?.style.width, 10) || 0,
      dataRows: panel?.querySelectorAll(".miel-sheet__row--data").length || 0,
    };
  }, sheetId);

  let fails = 0;
  console.log(`=== COMPARE LIVE — ${layout.sheetName} (${sheetId}) ===\n`);

  for (const row of layout.rows) {
    for (const cell of row.cells) {
      if (!cell.ref || SKIP_TEXT_REFS.has(cell.ref)) continue;
      const expected = norm(cell.text);
      if (!expected || expected.length < 2) continue;
      const actual = norm(dom.cells[cell.ref] ?? "");
      if (actual !== expected && !actual.includes(expected) && !expected.includes(actual)) {
        console.log(`FAIL | ${cell.ref} planilha «${expected.slice(0, 50)}» DOM «${actual.slice(0, 50)}»`);
        fails++;
      }
    }
  }

  const expectedCols = layout.colWidths.map(excelWidthPx);
  const minTableW = expectedCols.reduce((a, b) => a + b, 0);
  if (dom.colPx.length !== expectedCols.length) {
    console.log(`FAIL | colunas DOM=${dom.colPx.length} layout=${expectedCols.length}`);
    fails++;
  } else {
    let colFail = false;
    for (let i = 0; i < expectedCols.length; i++) {
      if (dom.colPx[i] !== expectedCols[i]) {
        console.log(`FAIL | col ${i + 1} px DOM=${dom.colPx[i]} esperado=${expectedCols[i]}`);
        colFail = true;
      }
    }
    if (colFail) fails++;
    else console.log(`OK   | ${expectedCols.length} colunas com larguras idênticas`);
  }

  if (dom.tableWidth < minTableW * 0.85) {
    console.log(`FAIL | largura tabela ${dom.tableWidth}px < mínimo ~${minTableW}px (layout colapsado?)`);
    fails++;
  } else {
    console.log(`OK   | largura tabela ${dom.tableWidth}px (mín ~${minTableW}px)`);
  }

  const title = dom.cells.A1 || dom.cells["A1"];
  if (sheetId === "cad-clientes" && !norm(title).includes("Cadastro de Clientes")) {
    console.log(`FAIL | título A1 ausente ou errado: «${title}»`);
    fails++;
  } else if (sheetId === "cad-clientes") {
    console.log(`OK   | título A1 «${norm(title).slice(0, 40)}»`);
  }

  console.log(`OK   | linhas de dados renderizadas: ${dom.dataRows}`);
  console.log(`\n--- ${fails === 0 ? "LAYOUT LIVE OK" : `FALHOU (${fails} diferenças)`} ---`);
  await browser.close();
  process.exit(fails === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
