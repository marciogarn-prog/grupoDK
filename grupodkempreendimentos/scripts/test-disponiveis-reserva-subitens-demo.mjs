/**
 * Disponíveis → Veículo reserva 5.1 / 5.2 — demo.
 * 5.1 é só informativo (reserva ⇒ locada). 4 Pronto tem ENVIAR PARA 5.2.
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
    record(
      "cache-bust reserva-51-info",
      /reserva-51-info|enviar-52|reserva-subitens|reserva-caixinhas/.test(cacheBust),
      cacheBust.split("?")[1] || cacheBust
    );

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
    record("submenu Disponíveis 4 e 5 existem", menu1.prontos && menu1.reserva);
    record("5.1/5.2 existem no HTML", menu1.op && menu1.patio, `${menu1.opTitle} | ${menu1.patioTitle}`);
    record("5.1/5.2 ocultos até clicar 5", menu1.nestHidden === true);

    await page.locator("#btn-disp-sub-reserva").click({ timeout: 15000 });
    await page.waitForTimeout(350);
    const nestOpen = await page.evaluate(() => {
      const nest = document.getElementById("manutencaoDisponiveisReservaSubnav");
      return {
        visible: nest && !nest.classList.contains("hidden") && !nest.hasAttribute("hidden"),
        aria: document.getElementById("btn-disp-sub-reserva")?.getAttribute("aria-expanded"),
      };
    });
    record("clicar 5 abre 5.1 e 5.2", nestOpen.visible === true, `aria=${nestOpen.aria}`);

    await page.locator("#btn-disp-sub-reserva-operacao").click({ timeout: 15000 });
    await page.waitForTimeout(600);
    const painelOp = await page.evaluate(() => {
      const panel = document.getElementById("manutencaoInlineDisponiveis");
      const title = document.getElementById("manutencao-title-disponiveis")?.textContent || "";
      const grid = document.getElementById("portalDisponiveisPlacasGrid");
      const busca = document.querySelector("#manutencaoInlineDisponiveis .portal-manutencao-busca");
      const moves = grid?.querySelectorAll("[data-disp-move]")?.length || 0;
      return {
        panelVisible: panel && !panel.classList.contains("hidden"),
        title,
        hasEmptyOrCards: Boolean(
          grid?.querySelector(".portal-reserva-operacao-card, .portal-reserva-placa-item, .portal-manutencao-empty")
        ),
        filtroHidden: busca?.classList.contains("hidden") === true,
        moves,
        lead: document.getElementById("portalDisponiveisLead")?.textContent || "",
      };
    });
    record(
      "5.1 abre painel Reserva em operação",
      painelOp.panelVisible && /5\.1|operação/i.test(painelOp.title),
      painelOp.title
    );
    record("5.1 sem filtro por placa", painelOp.filtroHidden, `moves=${painelOp.moves}`);
    record("5.1 sem botões de mover", painelOp.moves === 0, `moves=${painelOp.moves}`);
    record(
      "5.1 lead informativo",
      /informat|laranja|⇒|=>/i.test(painelOp.lead),
      painelOp.lead.slice(0, 90)
    );

    /* Seed cobertura: reserva em 5.1 + manutenção ativa com placaReserva. */
    const seed = await page.evaluate(() => {
      if (typeof loadCadastro !== "function" || typeof saveCadastro !== "function") {
        return { ok: false, reason: "cadastro API indisponível" };
      }
      if (typeof CAD_VEICULOS_KEY === "undefined" || typeof CAD_MANUTENCOES_KEY === "undefined") {
        return { ok: false, reason: "chaves em falta" };
      }
      const nk = (p) =>
        String(p || "")
          .toUpperCase()
          .replace(/[^A-Z0-9]/g, "");
      const veiculos = loadCadastro(CAD_VEICULOS_KEY);
      const livre = veiculos.find((v) => {
        const placa = nk(v.placa);
        return placa && String(v.disponivelCategoria || "").includes("reserva") === false;
      });
      const placaReserva = nk(livre?.placa) || "TST0A01";
      const placaLocada = "LOC0A99";
      const idx = veiculos.findIndex((v) => nk(v.placa) === placaReserva);
      if (idx >= 0) {
        veiculos[idx] = {
          ...veiculos[idx],
          disponivelCategoria: "reserva-operacao",
          categoriaDisponivel: "reserva-operacao",
          updatedAt: Date.now(),
        };
        saveCadastro(CAD_VEICULOS_KEY, veiculos, { bypassImmutabilidadeCadastro: true });
      } else {
        veiculos.push({
          id: Date.now(),
          placa: placaReserva,
          modelo: "RESERVA TESTE",
          disponivelCategoria: "reserva-operacao",
          origemPortal: true,
        });
        saveCadastro(CAD_VEICULOS_KEY, veiculos, { bypassImmutabilidadeCadastro: true });
      }
      const manutencoes = loadCadastro(CAD_MANUTENCOES_KEY);
      manutencoes.push({
        id: Date.now() + 1,
        placa: placaLocada,
        servicos: ["PORTAL_CHECKLIST"],
        servico: "Portal check-list — teste 5.1",
        motivoPrincipal: "teste cobertura 5.1",
        data: "23/08/2026",
        dataPrevistaSaida: "30/08/2026",
        dataRealSaida: "",
        categoriaManutencao: "triagem",
        placaReserva,
        origemPortalChecklist: true,
      });
      saveCadastro(CAD_MANUTENCOES_KEY, manutencoes);
      if (typeof CAD_LOCACOES_KEY !== "undefined") {
        const locs = loadCadastro(CAD_LOCACOES_KEY);
        locs.push({
          id: Date.now() + 2,
          placa: placaLocada,
          plano: "DK Minha Moto",
          tipoPlano: "minha-moto",
          fim: "...",
          placaReserva,
          updatedAt: Date.now(),
        });
        saveCadastro(CAD_LOCACOES_KEY, locs, { bypassImmutabilidadeCadastro: true });
      }
      return { ok: true, placaReserva, placaLocada };
    });
    record("seed cobertura 5.1", seed.ok, seed.reason || `${seed.placaReserva}⇒${seed.placaLocada}`);

    if (seed.ok) {
      await page.locator("#btn-disp-sub-reserva-operacao").click({ timeout: 15000 });
      await page.waitForTimeout(700);
      const card = await page.evaluate((placaReserva) => {
        const el = document.querySelector(
          `#portalDisponiveisPlacasGrid .portal-reserva-operacao-card[data-placa="${placaReserva}"]`
        );
        return {
          found: Boolean(el),
          text: el?.textContent?.replace(/\s+/g, " ").trim() || "",
          hasArrow: Boolean(el?.querySelector(".portal-reserva-operacao-card__arrow")),
          reservaOrange: Boolean(el?.querySelector(".portal-reserva-operacao-card__reserva")),
          locada: el?.querySelector(".portal-reserva-operacao-card__locada")?.textContent?.trim() || "",
        };
      }, seed.placaReserva);
      record(
        "5.1 cartão reserva ⇒ locada",
        card.found && card.hasArrow && card.reservaOrange && card.locada === seed.placaLocada,
        card.text.slice(0, 80)
      );
      /* Limpa seed. */
      await page.evaluate((seedData) => {
        const nk = (p) =>
          String(p || "")
            .toUpperCase()
            .replace(/[^A-Z0-9]/g, "");
        if (typeof CAD_VEICULOS_KEY !== "undefined") {
          const list = loadCadastro(CAD_VEICULOS_KEY).filter((v) => nk(v.placa) !== nk(seedData.placaReserva) || !v.origemPortal);
          const idx = list.findIndex((v) => nk(v.placa) === nk(seedData.placaReserva));
          if (idx >= 0) {
            list[idx] = { ...list[idx], disponivelCategoria: "prontos", updatedAt: Date.now() };
          }
          saveCadastro(CAD_VEICULOS_KEY, list, { bypassImmutabilidadeCadastro: true });
        }
        if (typeof CAD_MANUTENCOES_KEY !== "undefined") {
          const m = loadCadastro(CAD_MANUTENCOES_KEY).filter(
            (x) => !(nk(x.placa) === nk(seedData.placaLocada) && nk(x.placaReserva) === nk(seedData.placaReserva))
          );
          saveCadastro(CAD_MANUTENCOES_KEY, m);
        }
      }, seed);
    }

    await page.locator("#btn-disp-sub-reserva-patio").click({ timeout: 15000 });
    await page.waitForTimeout(500);
    const painelPatio = await page.evaluate(() => {
      const title = document.getElementById("manutencao-title-disponiveis")?.textContent || "";
      const moves = document.querySelectorAll("#portalDisponiveisPlacasGrid [data-disp-move]")?.length || 0;
      return { title, moves };
    });
    record("5.2 abre painel Reserva no pátio", /5\.2|pátio|patio/i.test(painelPatio.title), painelPatio.title);
    const patioMoves = await page.evaluate(() => {
      const grid = document.getElementById("portalDisponiveisPlacasGrid");
      return [...(grid?.querySelectorAll("[data-disp-move]") || [])].map((b) => ({
        dest: b.getAttribute("data-disp-move"),
        label: (b.textContent || "").trim(),
      }));
    });
    record(
      "5.2: botão ENVIAR PARA 5.1",
      patioMoves.length > 0 && patioMoves.every((m) => m.dest === "reserva-operacao"),
      `moves=${patioMoves.length} ${patioMoves.map((m) => m.label).join(", ")}`
    );

    await page.locator("#btn-disp-sub-prontos").click({ timeout: 15000 });
    await page.waitForTimeout(700);
    const prontosUi = await page.evaluate(() => {
      const grid = document.getElementById("portalDisponiveisPlacasGrid");
      const moves = [...(grid?.querySelectorAll("[data-disp-move]") || [])].map((b) => b.getAttribute("data-disp-move"));
      const cards = grid?.querySelectorAll(".portal-reserva-placa-item")?.length || 0;
      const lead = document.getElementById("portalDisponiveisLead")?.textContent || "";
      const filtroHidden = document
        .querySelector("#manutencaoInlineDisponiveis .portal-manutencao-busca")
        ?.classList.contains("hidden");
      return { moves, cards, lead, filtroHidden };
    });
    record(
      "prontos: botão ENVIAR PARA 5.2",
      prontosUi.moves.length > 0 && prontosUi.moves.every((m) => m === "reserva-patio"),
      `moves=${prontosUi.moves.length} cards=${prontosUi.cards}`
    );
    record("prontos: filtro visível", prontosUi.filtroHidden === false);
    record(
      "prontos: texto diz que saem ao locar",
      /locad/i.test(prontosUi.lead),
      prontosUi.lead.slice(0, 80)
    );

    const lookup = await page.evaluate(() => {
      const html = document.documentElement.innerHTML;
      return {
        hasReservaOperacaoMeta: html.includes("reserva-operacao") || html.includes("Reserva em operação"),
        hasReservaPatioMeta: html.includes("reserva-patio") || html.includes("Reserva no pátio"),
      };
    });
    record("textos 5.1/5.2 no portal", lookup.hasReservaOperacaoMeta && lookup.hasReservaPatioMeta);
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
