/**
 * Testes cumulativos Sistema MIEL — etapa N valida etapas 1..N.
 * node grupodkempreendimentos/scripts/test-portal-miel-etapas.mjs
 */
import { chromium } from "playwright";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const BASE_URL = (process.env.DK_TEST_BASE_URL || "https://demo.grupodkempreendimentos.com.br/").replace(
  /\/?$/,
  "/"
);
/** Etapas implementadas — incrementar a cada nova peça. */
export const MIEL_ETAPAS_IMPLEMENTADAS = 3;

/** Destinos esperados dos 16 botões laterais do Administrativo. */
const ADMIN_SIDE_EXPECTED = [
  { btn: "Cadastro de Clientes", title: "Cadastro de Clientes", panel: "cad-clientes", implemented: true },
  { btn: "Cadastro de Veículos", title: "Cadastro de Veículos", panel: "cad-veiculos" },
  { btn: "Consulta de Clientes", title: "Consulta de Clientes", panel: "consulta-clientes" },
  { btn: "Consulta de Veículos", title: "Consulta de Veículos", panel: "consulta-veiculos" },
  { btn: "Relação de Clientes Cadastrados no Sistema", title: "Relação de Clientes", panel: "relacao-clientes" },
  { btn: "Relação de Veículos Cadastrados no Sistema", title: "Relação de Veículos", panel: "relacao-veiculos" },
  { btn: "Relação de Status de Veículos", title: "Status Veículos", panel: "status-veiculos" },
  { btn: "Emissão de Protocolos", title: "Emissão de Protocolos", panel: "emissao-protocolos" },
  { btn: "Relação de Protocolos Emitidos", title: "Relação Protocolos Emitidos", panel: "relacao-protocolos" },
  { btn: "Relatório de Pendências no Cadastro dos Clientes", title: "Pendências Cad. Clientes", panel: "pendencias-clientes" },
  { btn: "Relatório de Clientes por EAR", title: "Relatório CNH/EAR", panel: "relatorio-ear" },
  { btn: "Formulário de Prestação de Contas (Fundo Fixo)", title: "Fundo Fixo", panel: "fundo-fixo" },
  { btn: "Recibo e Lista de Valores PASSIVOS para Cobrança Ostensiva", title: "Passivo para Cobrança", panel: "passivo-cobranca" },
  { btn: "Panfleto Padrão", title: "Panfleto Padrão", panel: "panfleto-padrao" },
  { btn: "Relação de Motos Vendidas", title: "Motos Vendidas", panel: "motos-vendidas" },
  { btn: "Tabela Oficial", title: "Tabela DK Locadora", panel: "tabela-dk-locadora" },
];

const results = [];

function record(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} | MIEL ${name}${detail ? ` | ${detail}` : ""}`);
}

async function openMielFromHome(page) {
  await page.goto(BASE_URL, { waitUntil: "networkidle", timeout: 60000 });
  const mielBtn = page.locator('#view-home [data-go="miel"]').first();
  await mielBtn.click({ timeout: 10000 });
  await page.waitForFunction(
    () =>
      document.getElementById("view-miel")?.classList.contains("view--active") &&
      document.getElementById("mielMainTitle"),
    { timeout: 10000 }
  );
}

async function testEtapa1(page) {
  const s = await page.evaluate(() => ({
    title: document.getElementById("mielMainTitle")?.textContent?.trim() || "",
    hero: Boolean(document.querySelector(".miel-pagina-inicial__hero")),
    paginaVisible: !document.querySelector('[data-miel-panel="pagina-inicial"]')?.classList.contains("hidden"),
    navActive: document.querySelector('[data-miel-nav="pagina-inicial"]')?.classList.contains("miel-nav-btn--active"),
    diretoria: document.querySelectorAll(".miel-app__diretoria tbody tr").length,
    dateOk: (document.getElementById("mielAppDataLocal")?.textContent || "").includes("Petrolina-PE"),
    navCount: document.querySelectorAll("[data-miel-nav]").length,
  }));

  record(
    "etapa 1: Página Inicial visível",
    s.title === "Página Inicial" && s.hero && s.paginaVisible && s.navActive,
    `title=${s.title}`
  );
  record("etapa 1: diretoria 3 cargos", s.diretoria === 3);
  record("etapa 1: data Petrolina-PE", s.dateOk);
  record("etapa 1: menu lateral (≥10 botões)", s.navCount >= 10, `nav=${s.navCount}`);

  await page.locator('[data-miel-nav="pagina-inicial"]').first().click();
  await page.waitForTimeout(300);
  const s2 = await page.evaluate(() => ({
    hero: Boolean(document.querySelector(".miel-pagina-inicial__hero")),
    title: document.getElementById("mielMainTitle")?.textContent?.trim() || "",
  }));
  record("etapa 1: botão Página Inicial leva ao logo", s2.hero && s2.title === "Página Inicial");

  const navStubs = [
    { nav: "dashboard", title: "Dashboard", piece: "3/84" },
    { nav: "financeiro", title: "Financeiro", piece: "4/84" },
  ];
  for (const ns of navStubs) {
    await page.locator(`[data-miel-nav="${ns.nav}"]`).first().click();
    await page.waitForTimeout(300);
    const st = await page.evaluate(
      ({ piece, nav }) => ({
        title: document.getElementById("mielMainTitle")?.textContent?.trim() || "",
        hasPiece: (document.querySelector(".miel-panel--stub:not(.hidden) .miel-panel-placeholder")?.textContent || "").includes(piece),
        navActive: document.querySelector(`[data-miel-nav="${nav}"]`)?.classList.contains("miel-nav-btn--active"),
      }),
      { piece: ns.piece, nav: ns.nav }
    );
    record(`etapa 1: menu ${ns.title} abre stub`, st.title === ns.title && st.hasPiece && st.navActive, st.title);
  }
  await page.locator('[data-miel-nav="pagina-inicial"]').first().click();
  await page.waitForTimeout(200);
}

async function testEtapa2(page) {
  await page.locator('[data-miel-nav="administrativo"]').first().click();
  await page.waitForTimeout(400);

  const s = await page.evaluate(() => ({
    title: document.getElementById("mielMainTitle")?.textContent?.trim() || "",
    banner: Boolean(document.querySelector(".miel-admin-table__banner")),
    search: Boolean(document.getElementById("mielAdminBuscaCliente")),
    panelVisible: !document.getElementById("mielPanelAdministrativo")?.classList.contains("hidden"),
    sideBtns: document.querySelectorAll(".miel-admin-side-btn").length,
    navActive: document.querySelector('[data-miel-nav="administrativo"]')?.classList.contains("miel-nav-btn--active"),
  }));

  record(
    "etapa 2: botão Administrativo abre aba correta",
    s.title === "Administrativo" && s.banner && s.search && s.panelVisible && s.navActive,
    `btns=${s.sideBtns}`
  );
  record("etapa 2: 16 botões laterais presentes", s.sideBtns === 16, `count=${s.sideBtns}`);

  for (const exp of ADMIN_SIDE_EXPECTED) {
    await page.locator(`[data-miel-admin-action="${exp.btn}"]`).first().click();
    await page.waitForTimeout(250);
    const sub = await page.evaluate(
      ({ panelId, implemented }) => {
        const panel = document.querySelector(`[data-miel-panel="${panelId}"]`);
        const visible = Boolean(panel && !panel.classList.contains("hidden"));
        const contentOk = implemented
          ? Boolean(panel?.querySelector(".miel-cad__banner"))
          : Boolean(panel?.querySelector(".miel-panel-placeholder"));
        return {
          title: document.getElementById("mielMainTitle")?.textContent?.trim() || "",
          ok: visible && contentOk,
        };
      },
      { panelId: exp.panel, implemented: Boolean(exp.implemented) }
    );
    record(
      `etapa 2: lateral «${exp.btn.slice(0, 28)}…» → destino`,
      sub.title === exp.title && sub.ok,
      `title=${sub.title}`
    );
    const back = page
      .locator(
        '.miel-panel:not(.hidden) [data-miel-stub-back="administrativo"], .miel-panel:not(.hidden) [data-miel-cad-back="administrativo"]'
      )
      .first();
    if (await back.count()) {
      await back.click();
      await page.waitForTimeout(250);
      const admTitle = await page.evaluate(
        () => document.getElementById("mielMainTitle")?.textContent?.trim() || ""
      );
      record(`etapa 2: stub voltar ao Administrativo (${exp.panel})`, admTitle === "Administrativo", admTitle);
    }
    await page.locator('[data-miel-nav="administrativo"]').first().click();
    await page.waitForTimeout(200);
  }

  await page.locator("#mielAdminBuscaCliente").fill("TERIVALDO");
  await page.waitForTimeout(200);
  const searchVal = await page.locator("#mielAdminBuscaCliente").inputValue();
  record("etapa 2: campo pesquisa funcional", searchVal === "TERIVALDO");
}

async function testEtapa3(page) {
  await page.locator('[data-miel-nav="administrativo"]').first().click();
  await page.waitForTimeout(300);
  await page.locator('[data-miel-admin-action="Cadastro de Clientes"]').first().click();
  await page.waitForTimeout(400);

  const s = await page.evaluate(() => ({
    title: document.getElementById("mielMainTitle")?.textContent?.trim() || "",
    banner: Boolean(document.querySelector(".miel-cad__banner")),
    busca: Boolean(document.getElementById("mielCadClienteBusca")),
    nome: Boolean(document.getElementById("mielCadCliente_nome")),
    cpf: Boolean(document.getElementById("mielCadCliente_cpfCnpj")),
    codigo: Boolean(document.getElementById("mielCadCliente_codigo")),
    panelVisible: !document.getElementById("mielPanelCadClientes")?.classList.contains("hidden"),
    actions: document.querySelectorAll("[data-miel-cad-action]").length,
  }));

  record(
    "etapa 3: Cadastro de Clientes abre formulário",
    s.title === "Cadastro de Clientes" && s.banner && s.busca && s.nome && s.cpf && s.panelVisible,
    `actions=${s.actions}`
  );
  record("etapa 3: campos principais presentes", s.codigo && s.actions >= 3);

  await page.locator("#mielCadCliente_codigo").fill("CLIENTE TESTE 01");
  await page.locator("#mielCadCliente_nome").fill("TERIVALDO MIEL TESTE");
  await page.locator("#mielCadCliente_cpfCnpj").fill("123.456.789-00");
  await page.locator('[data-miel-cad-action="guardar"]').first().click();
  await page.waitForTimeout(300);

  const saved = await page.evaluate(() => {
    const fb = document.getElementById("mielCadClienteFeedback")?.textContent || "";
    let count = 0;
    try {
      count = JSON.parse(localStorage.getItem("dk_miel_clientes_v1") || "[]").length;
    } catch {
      /* ignore */
    }
    return { fb, count };
  });
  record("etapa 3: guardar cliente no MIEL", saved.fb.includes("TERIVALDO") && saved.count >= 1, saved.fb);

  await page.locator("#mielCadClienteBusca").fill("TERIVALDO");
  await page.locator("#mielCadClienteBusca").dispatchEvent("change");
  await page.waitForTimeout(250);
  const loaded = await page.locator("#mielCadCliente_nome").inputValue();
  record("etapa 3: pesquisa carrega cliente", loaded === "TERIVALDO MIEL TESTE", loaded);

  await page.locator('[data-miel-cad-back="administrativo"]').first().click();
  await page.waitForTimeout(250);
  const adm = await page.evaluate(() => document.getElementById("mielMainTitle")?.textContent?.trim() || "");
  record("etapa 3: voltar ao Administrativo", adm === "Administrativo", adm);

  await page.locator('[data-miel-nav="pagina-inicial"]').first().click();
  await page.waitForTimeout(200);
  const p1 = await page.evaluate(() => ({
    title: document.getElementById("mielMainTitle")?.textContent?.trim() || "",
    hero: Boolean(document.querySelector(".miel-pagina-inicial__hero")),
  }));
  record("regressão: etapa 1 após etapa 3", p1.title === "Página Inicial" && p1.hero);

  await page.locator('[data-miel-nav="administrativo"]').first().click();
  await page.waitForTimeout(200);
  const p2 = await page.evaluate(() => ({
    title: document.getElementById("mielMainTitle")?.textContent?.trim() || "",
    banner: Boolean(document.querySelector(".miel-admin-table__banner")),
  }));
  record("regressão: etapa 2 após etapa 3", p2.title === "Administrativo" && p2.banner);
}

async function testRegressaoEtapa1Apos2(page) {
  await page.locator('[data-miel-nav="pagina-inicial"]').first().click();
  await page.waitForTimeout(300);
  const s = await page.evaluate(() => ({
    title: document.getElementById("mielMainTitle")?.textContent?.trim() || "",
    hero: Boolean(document.querySelector(".miel-pagina-inicial__hero")),
  }));
  record("regressão: etapa 1 após etapa 2", s.title === "Página Inicial" && s.hero);
}

async function testNavegacaoSaida(page) {
  await page.locator("#view-miel [data-inicio]").first().click();
  await page.waitForTimeout(400);
  const home = await page.evaluate(() => document.getElementById("view-home")?.classList.contains("view--active"));
  record("botão Início Grupo DK volta à home", home === true);
}

export async function runMielEtapasTests(page, maxEtapa = MIEL_ETAPAS_IMPLEMENTADAS) {
  results.length = 0;
  await openMielFromHome(page);
  if (maxEtapa >= 1) await testEtapa1(page);
  if (maxEtapa >= 2) {
    await testEtapa2(page);
    if (maxEtapa < 3) await testRegressaoEtapa1Apos2(page);
  }
  if (maxEtapa >= 3) await testEtapa3(page);
  await testNavegacaoSaida(page);
  const failed = results.filter((r) => !r.ok);
  return { ok: failed.length === 0, total: results.length, failed: failed.length, results };
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    const out = await runMielEtapasTests(page, MIEL_ETAPAS_IMPLEMENTADAS);
    console.log(`--- MIEL etapas 1-${MIEL_ETAPAS_IMPLEMENTADAS}: ${out.total - out.failed}/${out.total} ---`);
    if (!out.ok) process.exit(1);
  } finally {
    await browser.close();
  }
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(__filename);
if (isMain) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
