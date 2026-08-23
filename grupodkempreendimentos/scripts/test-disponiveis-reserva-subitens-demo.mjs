/**
 * Disponíveis → Veículo reserva 2.1 / 2.2 — demo.
 * Valida submenu, grelha e mover placa entre categorias.
 * node grupodkempreendimentos/scripts/test-disponiveis-reserva-subitens-demo.mjs
 */
import { chromium } from "playwright";

const BASE = (process.env.DK_TEST_BASE_URL || "https://demo.grupodkempreendimentos.com.br/").replace(/\/?$/, "/");

const results = [];
function record(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} | ${name}${detail ? ` | ${detail}` : ""}`);
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1600 } });
  const page = await context.newPage();
  page.on("dialog", (d) => d.accept().catch(() => null));

  try {
    await page.goto(BASE, { waitUntil: "networkidle", timeout: 90000 });
    await page.evaluate(() => {
      sessionStorage.removeItem("dk_portal_area_ativa");
      localStorage.setItem(
        "dk_sessao_cliente",
        JSON.stringify({ tipo: "admin", role: "owner", cpf: "03037897430", nome: "Admin Reserva" })
      );
      localStorage.setItem("dk_portal_sessao_build", "20260521admin-nav");
      sessionStorage.setItem("dk_portal_sessao_viva_v1", "1");
    });
    await page.goto(`${BASE}#locadora/empresa`, { waitUntil: "networkidle", timeout: 90000 });
    await page.waitForTimeout(2000);

    const cacheBust = await page.evaluate(() => {
      const s = [...document.scripts].find((x) => (x.src || "").includes("portal-locadora-ui.js"));
      return s?.src || "";
    });
    record("cache-bust reserva-subitens", /reserva-subitens|reserva-audit/.test(cacheBust), cacheBust.split("?")[1] || cacheBust);

    await page.locator("#btn-locadora-manutencao").click({ timeout: 15000 });
    await page.waitForTimeout(500);
    await page.locator("#btn-manutencao-disponiveis").click({ timeout: 15000 });
    await page.waitForTimeout(400);

    const menu1 = await page.evaluate(() => {
      const prontos = document.getElementById("btn-disp-sub-prontos");
      const reserva = document.getElementById("btn-disp-sub-reserva");
      const nest = document.getElementById("manutencaoDisponiveisReservaSubnav");
      const op = document.getElementById("btn-disp-sub-reserva-operacao");
      const patio = document.getElementById("btn-disp-sub-reserva-patio");
      return {
        prontos: Boolean(prontos),
        reserva: Boolean(reserva),
        nestHidden: nest?.classList.contains("hidden") ?? true,
        op: Boolean(op),
        patio: Boolean(patio),
        opTitle: op?.querySelector(".btn-operacao-cmd__title")?.textContent?.trim() || "",
        patioTitle: patio?.querySelector(".btn-operacao-cmd__title")?.textContent?.trim() || "",
      };
    });
    record("submenu Disponíveis 1 e 2 existem", menu1.prontos && menu1.reserva);
    record("2.1/2.2 existem no HTML", menu1.op && menu1.patio, `${menu1.opTitle} | ${menu1.patioTitle}`);
    record("2.1/2.2 ocultos até clicar 2", menu1.nestHidden === true);

    await page.locator("#btn-disp-sub-reserva").click({ timeout: 15000 });
    await page.waitForTimeout(350);
    const nestOpen = await page.evaluate(() => {
      const nest = document.getElementById("manutencaoDisponiveisReservaSubnav");
      return {
        visible: nest && !nest.classList.contains("hidden") && !nest.hasAttribute("hidden"),
        aria: document.getElementById("btn-disp-sub-reserva")?.getAttribute("aria-expanded"),
      };
    });
    record("clicar 2 abre 2.1 e 2.2", nestOpen.visible === true, `aria=${nestOpen.aria}`);

    await page.locator("#btn-disp-sub-reserva-operacao").click({ timeout: 15000 });
    await page.waitForTimeout(600);
    const painelOp = await page.evaluate(() => {
      const panel = document.getElementById("manutencaoInlineDisponiveis");
      const title = document.getElementById("manutencao-title-disponiveis")?.textContent || "";
      const grid = document.getElementById("portalDisponiveisPlacasGrid");
      return {
        panelVisible: panel && !panel.classList.contains("hidden"),
        title,
        hasEmptyOrCards: Boolean(grid?.querySelector(".portal-reserva-placa-item, .portal-manutencao-empty")),
      };
    });
    record(
      "2.1 abre painel Reserva em operação",
      painelOp.panelVisible && /2\.1|operação/i.test(painelOp.title),
      painelOp.title
    );

    await page.locator("#btn-disp-sub-reserva-patio").click({ timeout: 15000 });
    await page.waitForTimeout(500);
    const painelPatio = await page.evaluate(() => {
      const title = document.getElementById("manutencao-title-disponiveis")?.textContent || "";
      return { title };
    });
    record("2.2 abre painel Reserva no pátio", /2\.2|pátio|patio/i.test(painelPatio.title), painelPatio.title);

    await page.locator("#btn-disp-sub-prontos").click({ timeout: 15000 });
    await page.waitForTimeout(700);

    const moveResult = await page.evaluate(() => {
      const grid = document.getElementById("portalDisponiveisPlacasGrid");
      const firstMove = grid?.querySelector("[data-disp-move='reserva-patio']");
      if (!firstMove) {
        return { ok: false, reason: "sem botão MOVER PARA RESERVA NO PÁTIO em prontos" };
      }
      const placa = firstMove.getAttribute("data-placa") || "";
      firstMove.click();
      return { ok: true, placa, clicked: "reserva-patio" };
    });
    record("prontos tem botão mover para pátio", moveResult.ok, moveResult.reason || moveResult.placa);
    await page.waitForTimeout(900);

    if (moveResult.ok && moveResult.placa) {
      const afterMove = await page.evaluate((placa) => {
        const title = document.getElementById("manutencao-title-disponiveis")?.textContent || "";
        const msg = document.getElementById("portalDisponiveisPlacasMsg")?.textContent || "";
        const items = [...document.querySelectorAll("#portalDisponiveisPlacasGrid [data-placa]")].map((b) =>
          b.getAttribute("data-placa")
        );
        const inGrid = items.includes(placa);
        return { title, msg, inGrid, itemsCount: items.length };
      }, moveResult.placa);
      record(
        "após mover, abre lista destino com a placa",
        /pátio|patio|2\.2/i.test(afterMove.title) && afterMove.inGrid,
        `${afterMove.title} | ${afterMove.msg} | inGrid=${afterMove.inGrid}`
      );

      const moveBack = await page.evaluate((placa) => {
        const btn = [...document.querySelectorAll("#portalDisponiveisPlacasGrid [data-disp-move='prontos']")].find(
          (b) => b.getAttribute("data-placa") === placa
        );
        if (!btn) return { ok: false, reason: "sem botão voltar para prontos" };
        btn.click();
        return { ok: true };
      }, moveResult.placa);
      record("pátio tem botão voltar para prontos", moveBack.ok, moveBack.reason || "");
      await page.waitForTimeout(900);

      if (moveBack.ok) {
        const back = await page.evaluate((placa) => {
          const title = document.getElementById("manutencao-title-disponiveis")?.textContent || "";
          const items = [...document.querySelectorAll("#portalDisponiveisPlacasGrid [data-placa]")].map((b) =>
            b.getAttribute("data-placa")
          );
          return { title, inGrid: items.includes(placa) };
        }, moveResult.placa);
        record(
          "placa volta para prontos",
          /prontos/i.test(back.title) && back.inGrid,
          `${back.title} | inGrid=${back.inGrid}`
        );
      }

      const cross = await page.evaluate((placa) => {
        const toOp = [...document.querySelectorAll("#portalDisponiveisPlacasGrid [data-disp-move='reserva-operacao']")].find(
          (b) => b.getAttribute("data-placa") === placa
        );
        if (!toOp) return { ok: false, reason: "sem botão para operação" };
        toOp.click();
        return { ok: true };
      }, moveResult.placa);
      await page.waitForTimeout(800);
      if (cross.ok) {
        const opState = await page.evaluate((placa) => {
          const title = document.getElementById("manutencao-title-disponiveis")?.textContent || "";
          const items = [...document.querySelectorAll("#portalDisponiveisPlacasGrid [data-placa]")].map((b) =>
            b.getAttribute("data-placa")
          );
          return { title, inGrid: items.includes(placa) };
        }, moveResult.placa);
        record(
          "mover prontos → 2.1 operação",
          /2\.1|operação/i.test(opState.title) && opState.inGrid,
          opState.title
        );

        await page.evaluate((placa) => {
          const toPatio = [
            ...document.querySelectorAll("#portalDisponiveisPlacasGrid [data-disp-move='reserva-patio']"),
          ].find((b) => b.getAttribute("data-placa") === placa);
          toPatio?.click();
        }, moveResult.placa);
        await page.waitForTimeout(800);
        const patioState = await page.evaluate((placa) => {
          const title = document.getElementById("manutencao-title-disponiveis")?.textContent || "";
          const items = [...document.querySelectorAll("#portalDisponiveisPlacasGrid [data-placa]")].map((b) =>
            b.getAttribute("data-placa")
          );
          return { title, inGrid: items.includes(placa) };
        }, moveResult.placa);
        record(
          "mover 2.1 → 2.2 pátio",
          /2\.2|pátio|patio/i.test(patioState.title) && patioState.inGrid,
          patioState.title
        );

        await page.evaluate((placa) => {
          const toProntos = [
            ...document.querySelectorAll("#portalDisponiveisPlacasGrid [data-disp-move='prontos']"),
          ].find((b) => b.getAttribute("data-placa") === placa);
          toProntos?.click();
        }, moveResult.placa);
        await page.waitForTimeout(600);
      } else {
        record("mover prontos → 2.1 operação", false, cross.reason);
      }
    }

    const lookup = await page.evaluate(() => {
      const html = document.documentElement.innerHTML;
      return {
        hasReservaOperacaoMeta: html.includes("reserva-operacao") || html.includes("Reserva em operação"),
        hasReservaPatioMeta: html.includes("reserva-patio") || html.includes("Reserva no pátio"),
      };
    });
    record("textos 2.1/2.2 no portal", lookup.hasReservaOperacaoMeta && lookup.hasReservaPatioMeta);
  } catch (err) {
    record("execução sem exceção", false, String(err?.message || err));
  } finally {
    await browser.close();
  }

  const failed = results.filter((r) => !r.ok).length;
  const passed = results.filter((r) => r.ok).length;
  console.log(`\n--- ${passed}/${results.length} testes passaram ---`);
  process.exit(failed ? 1 : 0);
}

run();
