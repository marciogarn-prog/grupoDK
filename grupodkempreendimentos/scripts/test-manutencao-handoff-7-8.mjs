/**
 * Fluxo 7↔8/9/10: só voltam para 7; entrada/km/itens R vêm da saída da etapa anterior.
 * node grupodkempreendimentos/scripts/test-manutencao-handoff-7-8.mjs
 */
import { chromium } from "playwright";

const BASE = (process.env.DK_TEST_BASE_URL || "https://demo.grupodkempreendimentos.com.br/").replace(
  /\/?$/,
  "/"
);
const PLACA = "SOR1I03";
const results = [];
function record(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} | ${name}${detail ? ` | ${detail}` : ""}`);
}

function moveAlvos(page) {
  return page.evaluate(() => {
    const wrap = document.getElementById("portalChecklistCategoriaMove");
    const cats = [...(wrap?.querySelectorAll("[data-manut-move-cat]") || [])].map((b) =>
      b.getAttribute("data-manut-move-cat")
    );
    const dests = [...(wrap?.querySelectorAll("[data-manut-move-dest]") || [])].map((b) =>
      b.getAttribute("data-manut-move-dest")
    );
    const vendas = document.getElementById("portalChecklistBtnManutencao");
    const vendasVisivel = Boolean(vendas && !vendas.hidden && !vendas.classList.contains("hidden"));
    return {
      cats,
      dests,
      wrapHidden: Boolean(wrap?.hidden || wrap?.classList.contains("hidden")),
      vendasVisivel,
      label: wrap?.querySelector(".portal-checklist-categoria-move__label")?.textContent || "",
    };
  });
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
try {
  await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.evaluate(() => {
    localStorage.setItem(
      "dk_sessao_cliente",
      JSON.stringify({ tipo: "admin", role: "owner", cpf: "03037897430", nome: "Teste handoff" })
    );
    sessionStorage.setItem("dk_portal_sessao_viva_v1", "1");
  });
  await page.goto(`${BASE}#locadora/empresa`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForTimeout(8000);

  await page.locator("#btn-locadora-manutencao").click({ timeout: 15000 });
  await page.waitForTimeout(400);
  await page.locator("#btn-manutencao-em-manutencao").click({ timeout: 15000 });
  await page.waitForTimeout(400);

  await page.locator("#btn-manut-sub-oficina-terceiros").click({ timeout: 15000 });
  await page.waitForTimeout(600);
  const d8 = await moveAlvos(page);
  record(
    "8 só volta para 7 (sem vendas)",
    d8.cats.length === 1 &&
      d8.cats[0] === "oficina-propria" &&
      d8.dests.length === 0 &&
      d8.vendasVisivel === false &&
      d8.wrapHidden === false,
    JSON.stringify(d8)
  );

  await page.locator("#btn-manut-sub-enviado-seguro").click({ timeout: 15000 });
  await page.waitForTimeout(400);
  const d9 = await moveAlvos(page);
  record(
    "9 só volta para 7 (sem vendas)",
    d9.cats.length === 1 && d9.cats[0] === "oficina-propria" && d9.dests.length === 0 && d9.vendasVisivel === false,
    JSON.stringify(d9)
  );

  await page.locator("#btn-manut-sub-sinistrado-roubo").click({ timeout: 15000 });
  await page.waitForTimeout(400);
  const d10 = await moveAlvos(page);
  record(
    "10 só volta para 7 (sem vendas)",
    d10.cats.length === 1 &&
      d10.cats[0] === "oficina-propria" &&
      d10.dests.length === 0 &&
      d10.vendasVisivel === false,
    JSON.stringify(d10)
  );

  await page.locator("#btn-manut-sub-oficina-propria").click({ timeout: 15000 });
  await page.waitForTimeout(400);
  const d7 = await moveAlvos(page);
  record(
    "7 encaminha para 4/8/9/10",
    d7.dests.includes("prontos") &&
      d7.cats.includes("oficina-terceiros") &&
      d7.cats.includes("enviado-seguro") &&
      d7.cats.includes("sinistrado-roubo"),
    JSON.stringify(d7)
  );

  await page.evaluate((placa) => {
    const itens = Array.from({ length: 29 }, (_, i) => ({
      n: i + 1,
      estado: i === 0 ? "R" : "A",
      obs: i === 0 ? "SUBSTITUIR" : "",
    }));
    const rec = {
      placa,
      categoriaManutencao: "oficina-terceiros",
      encaminhadoDeTriagem: true,
      checklistHandoffSnapshot: {
        from: "oficina-propria",
        to: "oficina-terceiros",
        entradaData: "20/08/2026",
        entradaHora: "14:35",
        saidaData: "20/08/2026",
        saidaHora: "14:35",
        odometro: "12345",
        itens,
      },
    };
    const key = typeof CAD_MANUTENCOES_KEY !== "undefined" ? CAD_MANUTENCOES_KEY : "dk_manutencoes_cadastro";
    const prev = JSON.parse(localStorage.getItem(key) || "[]");
    const next = (Array.isArray(prev) ? prev : []).filter((m) => {
      const p = String(m?.placa || "")
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "");
      return p !== placa;
    });
    next.push(rec);
    localStorage.setItem(key, JSON.stringify(next));
    if (typeof window.__DK_invalidateCadastroParseCache === "function") {
      window.__DK_invalidateCadastroParseCache(key);
    }
  }, PLACA);

  await page.locator("#btn-manut-sub-oficina-terceiros").click({ timeout: 15000 });
  await page.waitForTimeout(800);
  const btnPlaca = page.locator(`[data-manut-placa="${PLACA}"]`);
  const temPlaca = await btnPlaca.count();
  record("placa de teste aparece em 8", temPlaca > 0, `n=${temPlaca}`);
  if (temPlaca) {
    await btnPlaca.first().click();
    await page.waitForTimeout(800);
    const form = await page.evaluate(() => {
      const r1 = document.querySelector('input[name="portalChecklistItem1"][value="R"]');
      return {
        data: document.getElementById("portalChecklistEntradaData")?.value || "",
        hora: document.getElementById("portalChecklistEntradaHora")?.value || "",
        km: document.getElementById("portalChecklistOdometro")?.value || "",
        item1R: Boolean(r1?.checked),
        obs: document.getElementById("portalChecklistObsSelect1")?.value || "",
      };
    });
    record(
      "8 herda data/hora/km e item R da saída de 7",
      form.data === "20/08/2026" && form.hora === "14:35" && form.km.includes("12345") && form.item1R === true,
      JSON.stringify(form)
    );
  } else {
    record("8 herda data/hora/km e item R da saída de 7", false, "placa não entrou na grelha");
  }
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n--- ${results.length - failed.length}/${results.length} ---`);
process.exit(failed.length ? 1 : 0);
