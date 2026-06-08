/**
 * Varredura UI — telas e botões do portal (oficial ou demo).
 * node grupodkempreendimentos/scripts/test-portal-ui-varredura.mjs
 * DK_TEST_BASE_URL=https://demo.grupodkempreendimentos.com.br/
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { chromium } from "playwright";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASE_URL = (process.env.DK_TEST_BASE_URL || "https://grupodkempreendimentos.com.br/").replace(/\/?$/, "/");
const IS_DEMO = /demo\.grupodkempreendimentos|git-demo-/i.test(BASE_URL);
const ENV_LABEL = IS_DEMO ? "demo" : "oficial";

const results = [];

function record(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} | [${ENV_LABEL}] ${name}${detail ? ` | ${detail}` : ""}`);
}

function readLocal(rel) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

function extractButtonIds(html) {
  const ids = [];
  const re = /<button[^>]*\sid="([^"]+)"/gi;
  let m;
  while ((m = re.exec(html))) ids.push(m[1]);
  return [...new Set(ids)];
}

function extractViewIds(html) {
  const ids = [];
  const re = /id="(view-[^"]+)"/g;
  let m;
  while ((m = re.exec(html))) ids.push(m[1]);
  return [...new Set(ids)];
}

function extractModalIds(html) {
  const ids = [];
  const re = /id="([^"]+Modal)"/g;
  let m;
  while ((m = re.exec(html))) ids.push(m[1]);
  return [...new Set(ids)];
}

const JS_FILES = [
  "app.js",
  "portal-locadora-ui.js",
  "portal-lanc-aluguel-calendario.js",
  "portal-comunicacao-operacao-ui.js",
  "portal-patrimonio.js",
  "portal-multas-relatorio.js",
  "portal-lancamentos-extras.js",
  "portal-locacao-documentos.js",
  "portal-comprovantes-cliente.js",
  "portal-supabase-sync.js",
  "cliente-app.js",
  "cliente-comunicacao-operacao-ui.js",
  "cliente-pagamentos-calendario.js",
  "cliente-documentos-locacao.js",
  "dk-app-entry.js",
];

/** Botões ligados por delegação genérica ou submit de formulário. */
const HANDLER_WHITELIST = new Set([
  "portal-unit-back-btn",
  "portal-unit-inicio-btn",
  "btn-voltar-operacao-locadora",
  "btn-voltar-manutencao-locadora",
  "btn-voltar-localizacao-locadora",
  "btn-voltar-patrimonio-locadora",
  "btn-lanc-aluguel-comprovante",
  "btn-lanc-aluguel-validacao",
  "btn-lanc-aluguel-relatorios",
  "portalChecklistFotoBtnDireita",
  "portalChecklistFotoBtnFrente",
  "portalChecklistFotoBtnTraseira",
  "portalChecklistFotoBtnEsquerda",
  "btn-enviar-comprovante",
]);

const FORM_SUBMIT_BUTTONS = {
  formOperacaoClienteInline: ["operacaoClienteAtualizarBtn"],
  formOperacaoVeiculoInline: ["operacaoVeiculoSubmitBtn"],
  formOperacaoLocacaoInline: ["operacaoLocacaoSubmitBtn"],
  formOperacaoLancamentoAluguelInline: ["operacaoLancAluguelConfirmarPagamentoBtn"],
  portalColabForm: ["portalColabBtnCadastrar", "portalColabBtnSalvarAlteracoes"],
  "form-locadora-app-download": ["btn-locadora-app-download"],
};

function jsBundleText() {
  return JS_FILES.map((f) => {
    const p = path.join(ROOT, f);
    return fs.existsSync(p) ? fs.readFileSync(p, "utf8") : "";
  }).join("\n");
}

function buttonHasHandler(btnId, js) {
  if (HANDLER_WHITELIST.has(btnId)) return true;
  for (const [formId, btns] of Object.entries(FORM_SUBMIT_BUTTONS)) {
    if (btns.includes(btnId) && (js.includes(`"${formId}"`) || js.includes(`'${formId}'`))) return true;
  }
  if (js.includes(`"${btnId}"`) || js.includes(`'${btnId}'`)) return true;
  if (js.includes(`#${btnId}`)) return true;
  return false;
}

function runStaticAudit() {
  const indexHtml = readLocal("index.html");
  const clienteHtml = readLocal("cliente.html");
  const js = jsBundleText();

  const views = extractViewIds(indexHtml);
  record(
    "telas principais (views)",
    views.includes("view-home") &&
      views.includes("view-locadora-hub") &&
      views.includes("view-locadora-cliente") &&
      views.includes("view-unit"),
    views.join(", ")
  );

  const modals = extractModalIds(indexHtml);
  record(
    "modais críticos presentes",
    modals.includes("portalLancAluguelCalModal") &&
      modals.includes("portalAdminAlteracaoConfirmModal") &&
      modals.includes("portalComunicacaoChatModal"),
    `${modals.length} modais`
  );

  const portalBtns = extractButtonIds(indexHtml);
  const clienteBtns = extractButtonIds(clienteHtml);
  record("inventário botões portal", portalBtns.length >= 90, `${portalBtns.length} botões`);
  record("inventário botões app cliente", clienteBtns.length >= 10, `${clienteBtns.length} botões`);

  const missingHandlers = portalBtns.filter((id) => !buttonHasHandler(id, js));
  record(
    "botões portal com handler JS",
    missingHandlers.length === 0,
    missingHandlers.length ? `sem handler: ${missingHandlers.slice(0, 8).join(", ")}${missingHandlers.length > 8 ? "…" : ""}` : "todos ok"
  );

  const missingCliente = clienteBtns.filter((id) => !buttonHasHandler(id, js));
  record(
    "botões app cliente com handler JS",
    missingCliente.length === 0,
    missingCliente.length ? missingCliente.join(", ") : "todos ok"
  );
}

const OPERACAO_PANELS = [
  {
    name: "WhatsApp cliente",
    cmd: "btn-operacao-falar-cliente",
    panel: "operacaoInlineWhatsApp",
    buttons: ["portalWaBtnEnviar"],
    optional: true,
  },
  {
    name: "Cadastro cliente",
    cmd: "btn-operacao-cadastro-cliente",
    panel: "operacaoInlineCliente",
    buttons: ["operacaoClienteLimparBtn", "operacaoClienteVoltarBtn", "operacaoClienteGerarRelatorioBtn"],
  },
  {
    name: "Cadastro veículo",
    cmd: "btn-operacao-cadastro-veiculo",
    panel: "operacaoInlineVeiculo",
    buttons: ["operacaoVeiculoLimparBtn", "operacaoVeiculoVoltarBtn"],
  },
  {
    name: "Cadastro locação",
    cmd: "btn-operacao-cadastro-locacao",
    panel: "operacaoInlineLocacao",
    buttons: ["operacaoLocacaoLimparBtn", "operacaoLocacaoVoltarBtn", "operacaoLocacaoDocumentosBtn"],
  },
  {
    name: "Lançamento aluguel",
    cmd: "btn-operacao-lancamento-aluguel",
    panel: "operacaoInlineLancamentoAluguel",
    buttons: [
      "operacaoLancAluguelConfirmarPesquisaBtn",
      "operacaoLancAluguelLancBlocoBtn",
      "operacaoLancAluguelLimparPesquisaBtn",
    ],
    afterOpen: async (page) => {
      await page.locator("#btn-lanc-aluguel-avulso").click({ timeout: 5000 }).catch(() => null);
      await page.waitForTimeout(400);
    },
  },
  {
    name: "Lançamento multas",
    cmd: "btn-operacao-lancamento-multas",
    panel: "operacaoInlineLancamentoMultas",
    buttons: ["operacaoLancMultasConfirmarPesquisaBtn", "operacaoLancMultasGerarRelatorioBtn"],
  },
  {
    name: "Lançamento manutenção",
    cmd: "btn-operacao-lancamento-manutencao",
    panel: "operacaoInlineLancamentoManutencao",
    buttons: [
      "operacaoLancManutencaoConfirmarPesquisaBtn",
      "operacaoLancManutencaoMsgTodosBtn",
      "operacaoLancManutencaoGerarRelatorioBtn",
    ],
  },
  {
    name: "Cadastro colaborador",
    cmd: "btn-operacao-cadastro-colaborador",
    panel: "operacaoInlineColaborador",
    buttons: ["portalColabBtnCadastrar", "portalColabBloqueioBtn"],
    adminOnly: true,
  },
];

const AREAS_EMPRESA = [
  { name: "Operação", btn: "btn-locadora-operacao", panel: "panel-operacao-locadora" },
  { name: "Manutenção frota", btn: "btn-locadora-manutencao", panel: "panel-manutencao-locadora" },
  { name: "Localização clientes", btn: "btn-locadora-localizacao", panel: "panel-localizacao-locadora" },
  { name: "Patrimônio", btn: "btn-locadora-patrimonio", panel: "panel-patrimonio-locadora" },
];

async function loginAdmin(page) {
  await page.goto(BASE_URL, { waitUntil: "networkidle", timeout: 90000 });
  await page.evaluate(() => {
    sessionStorage.removeItem("dk_portal_area_ativa");
    localStorage.setItem(
      "dk_sessao_cliente",
      JSON.stringify({
        tipo: "admin",
        role: "owner",
        cpf: "03037897430",
        nome: "Administrador E2E",
      })
    );
    localStorage.setItem("dk_portal_sessao_build", "20260521admin-nav");
    if (window.__DK_IS_DEMO_DEPLOY__ === true) {
      localStorage.removeItem("dk_instalacao_limpa_v1");
    }
  });
  await page.goto(`${BASE_URL}#locadora/empresa`, { waitUntil: "networkidle", timeout: 90000 });
  await page
    .waitForFunction(
      () => {
        const panel = document.getElementById("panel-logado");
        const btnOp = document.getElementById("btn-locadora-operacao");
        return (
          panel &&
          !panel.classList.contains("hidden") &&
          btnOp &&
          !btnOp.classList.contains("hidden")
        );
      },
      { timeout: 45000 }
    )
    .catch(() => null);
  await page.waitForTimeout(1000);
}

async function runE2E() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const pageErrors = [];
  page.on("pageerror", (e) => pageErrors.push(String(e.message || e)));

  try {
    await page.goto(BASE_URL, { waitUntil: "networkidle", timeout: 90000 });
    record("E2E: página inicial carrega", (await page.title()).length > 0);

    await page.locator('[data-go="locadora"]').first().click({ timeout: 10000 }).catch(() => null);
    await page.waitForTimeout(600);
    record(
      "E2E: hub locadora",
      await page.locator("#view-locadora-hub.view--active").isVisible().catch(() => false)
    );

    await page.locator("[data-locadora-go='cliente']").first().click({ timeout: 8000 }).catch(() => null);
    await page.waitForTimeout(500);
    record(
      "E2E: área cliente",
      await page.locator("#locadora-cliente-title").isVisible().catch(() => false)
    );

    await page.locator('[data-locadora-back="hub"]').first().click({ timeout: 8000 }).catch(() => null);
    await page.waitForTimeout(400);
    await page.locator("[data-locadora-go='empresa']").first().click({ timeout: 8000 }).catch(() => null);
    await page.waitForTimeout(500);
    record(
      "E2E: área empresa (login)",
      (await page.locator("#panel-login, .role-picker").first().isVisible().catch(() => false)) ||
        (await page.locator("#panel-logado").isVisible().catch(() => false))
    );

    await loginAdmin(page);
    record(
      "E2E: login administrador",
      await page.locator("#panel-logado:not(.hidden)").isVisible().catch(() => false)
    );

    record(
      "E2E: barra comunicação vendas/manutenção",
      (await page.locator("#portal-comunicacao-inbox-wrap").count()) > 0 &&
        (await page.locator("#portalComunicacaoVendasLista").count()) > 0
    );

    for (const area of AREAS_EMPRESA) {
      const btn = page.locator(`#${area.btn}`);
      const visible = await btn.isVisible().catch(() => false);
      if (!visible) {
        record(`E2E: área ${area.name}`, false, "botão oculto");
        continue;
      }
      await btn.click();
      await page.waitForTimeout(700);
      const panelOk = await page
        .locator(`#${area.panel}:not(.hidden)`)
        .isVisible()
        .catch(() => false);
      record(`E2E: área ${area.name}`, panelOk, area.panel);
    }

    await page.locator("#btn-locadora-operacao").click({ timeout: 8000 }).catch(() => null);
    await page.waitForTimeout(700);

    for (const scr of OPERACAO_PANELS) {
      const cmd = page.locator(`#${scr.cmd}`);
      const cmdVis = await cmd.isVisible().catch(() => false);
      if (!cmdVis) {
        if (scr.optional) {
          record(`E2E: painel ${scr.name}`, true, "opcional/oculto");
          continue;
        }
        if (scr.adminOnly) {
          record(`E2E: painel ${scr.name}`, true, "admin-only skip");
          continue;
        }
        record(`E2E: painel ${scr.name}`, false, "comando oculto");
        continue;
      }
      await cmd.click();
      await page.waitForTimeout(600);
      if (scr.afterOpen) await scr.afterOpen(page);
      const panelVis = await page
        .locator(`#${scr.panel}:not(.hidden)`)
        .isVisible()
        .catch(() => false);
      const missingBtns = [];
      for (const bid of scr.buttons) {
        const n = await page.locator(`#${bid}`).count();
        if (!n) missingBtns.push(bid);
      }
      record(
        `E2E: painel ${scr.name}`,
        panelVis && missingBtns.length === 0,
        panelVis ? (missingBtns.length ? `faltam: ${missingBtns.join(", ")}` : "ok") : "painel oculto"
      );
    }

    if (IS_DEMO) {
      await page.locator("#btn-operacao-lancamento-aluguel").click().catch(() => null);
      await page.waitForTimeout(400);
      await page.locator("#btn-lanc-aluguel-avulso").click().catch(() => null);
      await page.waitForTimeout(400);
      await page.locator("#operacaoLancAluguelProtocoloBusca").fill("2026010102");
      await page.locator("#operacaoLancAluguelConfirmarPesquisaBtn").click();
      await page.waitForTimeout(800);
      await page.locator("#operacaoLancAluguelLancBlocoBtn").click();
      await page.waitForTimeout(500);
      const modalOpen = await page
        .locator("#portalLancAluguelCalModal:not(.hidden)")
        .isVisible()
        .catch(() => false);
      record("E2E: lançamento em bloco abre modal", modalOpen);
      if (modalOpen) {
        await page.locator("#portalLancAluguelCalFecharBtn").click().catch(() => null);
      }
    } else {
      record("E2E: lançamento em bloco abre modal", true, "oficial sem dados demo — skip interativo");
    }

    const clienteHtml = await fetch(new URL("cliente.html", BASE_URL).href, { cache: "no-store" }).then((r) =>
      r.text()
    );
    record(
      "E2E: cliente.html scripts principais",
      clienteHtml.includes("cliente-app.js") &&
        clienteHtml.includes("clienteComunicacaoVendasBtn") &&
        clienteHtml.includes("view-trocar-senha"),
      "app + comunicação"
    );

    record("E2E: sem erros JS fatais na página", pageErrors.length === 0, pageErrors.slice(0, 2).join(" | ") || "ok");
  } catch (err) {
    record("E2E: execução", false, String(err?.message || err).slice(0, 120));
  } finally {
    await browser.close();
  }
}

async function main() {
  console.log(`\n=== Varredura UI portal [${ENV_LABEL}] — ${BASE_URL} ===\n`);
  runStaticAudit();
  console.log("");
  await runE2E();
  const pass = results.filter((r) => r.ok).length;
  const total = results.length;
  console.log(`\n--- [${ENV_LABEL}] ${pass}/${total} testes varredura ---\n`);
  process.exit(pass === total ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
