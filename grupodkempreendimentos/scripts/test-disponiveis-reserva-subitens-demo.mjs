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
    record("cache-bust reserva-subitens", /reserva-subitens|reserva-audit|prontos-sem-mover|reserva-caixinhas/.test(cacheBust), cacheBust.split("?")[1] || cacheBust);

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

    const prontosUi = await page.evaluate(() => {
      const grid = document.getElementById("portalDisponiveisPlacasGrid");
      const moves = grid?.querySelectorAll("[data-disp-move]")?.length || 0;
      const cards = grid?.querySelectorAll(".portal-reserva-placa-item")?.length || 0;
      const lead = document.getElementById("portalDisponiveisLead")?.textContent || "";
      return { moves, cards, lead };
    });
    record("prontos sem botões de mover", prontosUi.moves === 0, `moves=${prontosUi.moves} cards=${prontosUi.cards}`);
    record(
      "prontos: texto diz que saem ao locar",
      /locad/i.test(prontosUi.lead),
      prontosUi.lead.slice(0, 80)
    );

    /* Reserva 2.1 ↔ 2.2: define categoria no cadastro e testa o botão de mover. */
    const crossMove = await page.evaluate(() => {
      const grid = document.getElementById("portalDisponiveisPlacasGrid");
      const placa = grid?.querySelector(".portal-reserva-placa-btn")?.getAttribute("data-placa") || "";
      if (!placa) return { ok: false, reason: "sem placa" };
      if (typeof loadCadastro !== "function" || typeof saveCadastro !== "function" || typeof CAD_VEICULOS_KEY === "undefined") {
        return { ok: false, reason: "cadastro API indisponível", placa };
      }
      const list = loadCadastro(CAD_VEICULOS_KEY);
      const nk = (p) =>
        String(p || "")
          .toUpperCase()
          .replace(/[^A-Z0-9]/g, "");
      const idx = list.findIndex((v) => nk(v.placa) === nk(placa));
      if (idx < 0) return { ok: false, reason: "placa não no cadastro", placa };
      list[idx] = { ...list[idx], disponivelCategoria: "reserva-operacao", updatedAt: Date.now() };
      saveCadastro(CAD_VEICULOS_KEY, list, { bypassImmutabilidadeCadastro: true });
      return { ok: true, placa };
    });
    record("seed placa em reserva-operacao", crossMove.ok, crossMove.reason || crossMove.placa);

    if (crossMove.ok) {
      await page.locator("#btn-disp-sub-reserva").click({ timeout: 15000 });
      await page.waitForTimeout(200);
      await page.locator("#btn-disp-sub-reserva-operacao").click({ timeout: 15000 });
      await page.waitForTimeout(700);
      const opMove = await page.evaluate((placa) => {
        const title = document.getElementById("manutencao-title-disponiveis")?.textContent || "";
        const items = [...document.querySelectorAll("#portalDisponiveisPlacasGrid [data-placa]")].map((b) =>
          b.getAttribute("data-placa")
        );
        const patioBtn = [...document.querySelectorAll("#portalDisponiveisPlacasGrid [data-disp-move='reserva-patio']:not([disabled])")].find(
          (b) => b.getAttribute("data-placa") === placa
        );
        const opBtnDisabled = [...document.querySelectorAll("#portalDisponiveisPlacasGrid [data-disp-move='reserva-operacao'][disabled]")].some(
          (b) => b.getAttribute("data-placa") === placa
        );
        const prontosBtns = document.querySelectorAll("#portalDisponiveisPlacasGrid [data-disp-move='prontos']").length;
        return {
          title,
          inGrid: items.includes(placa),
          hasPatioBtn: Boolean(patioBtn),
          opBtnDisabled,
          prontosBtns,
        };
      }, crossMove.placa);
      record(
        "2.1 mostra placa e só botão para pátio",
        /2\.1|operação/i.test(opMove.title) &&
          opMove.inGrid &&
          opMove.hasPatioBtn &&
          opMove.opBtnDisabled &&
          opMove.prontosBtns === 0,
        opMove.title
      );
      await page.evaluate((placa) => {
        const btn = [
          ...document.querySelectorAll("#portalDisponiveisPlacasGrid [data-disp-move='reserva-patio']:not([disabled])"),
        ].find((b) => b.getAttribute("data-placa") === placa);
        btn?.click();
      }, crossMove.placa);
      await page.waitForTimeout(800);
      const patioState = await page.evaluate((placa) => {
        const title = document.getElementById("manutencao-title-disponiveis")?.textContent || "";
        const items = [...document.querySelectorAll("#portalDisponiveisPlacasGrid [data-placa]")].map((b) =>
          b.getAttribute("data-placa")
        );
        return { title, inGrid: items.includes(placa) };
      }, crossMove.placa);
      record(
        "mover 2.1 → 2.2 pátio",
        /2\.2|pátio|patio/i.test(patioState.title) && patioState.inGrid,
        patioState.title
      );
      /* Restaura para prontos (sem botão na UI — via cadastro). */
      await page.evaluate((placa) => {
        if (typeof loadCadastro !== "function" || typeof saveCadastro !== "function" || typeof CAD_VEICULOS_KEY === "undefined") {
          return;
        }
        const list = loadCadastro(CAD_VEICULOS_KEY);
        const nk = (p) =>
          String(p || "")
            .toUpperCase()
            .replace(/[^A-Z0-9]/g, "");
        const idx = list.findIndex((v) => nk(v.placa) === nk(placa));
        if (idx >= 0) {
          list[idx] = { ...list[idx], disponivelCategoria: "prontos", updatedAt: Date.now() };
          saveCadastro(CAD_VEICULOS_KEY, list, { bypassImmutabilidadeCadastro: true });
        }
      }, crossMove.placa);
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
