/**
 * Testes cumulativos Sistema MIEL — etapa N valida etapas 1..N.
 * Antes dos testes E2E: conferência automática com a planilha (verify-miel-admin-planilha.mjs).
 * node grupodkempreendimentos/scripts/test-portal-miel-etapas.mjs
 */
import { chromium } from "playwright";
import path from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BASE_URL = (process.env.DK_TEST_BASE_URL || "https://demo.grupodkempreendimentos.com.br/").replace(
  /\/?$/,
  "/"
);
/** Etapas implementadas — incrementar a cada nova peça. */
export const MIEL_ETAPAS_IMPLEMENTADAS = 4;

/** Destinos principais do grid Administrativo (coluna Formulários / Relatórios). */
const ADMIN_GRID_EXPECTED = [
  { btn: "Cadastro de Clientes", title: "Cadastro de Clientes", panel: "cad-clientes", implemented: true },
  { btn: "Cadastro de Veículos", title: "Cadastro de Veículos", panel: "cad-veiculos", implemented: true },
  { btn: "Relação de Clientes", title: "Relação de Clientes", panel: "relacao-clientes" },
  { btn: "Relação de Veículos", title: "Relação de Veículos", panel: "relacao-veiculos" },
  { btn: "Status de Veículos", title: "Status Veículos", panel: "status-veiculos" },
  { btn: "Relação de Motos Vendidas", title: "Motos Vendidas", panel: "motos-vendidas" },
  { btn: "Relatório de Status da CNH / EAR", title: "Relatório CNH/EAR", panel: "relatorio-ear" },
];

const results = [];

function record(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} | MIEL ${name}${detail ? ` | ${detail}` : ""}`);
}

async function grantMielOwnerSession(page) {
  await page.evaluate(() => {
    localStorage.setItem(
      "dk_sessao_cliente",
      JSON.stringify({ tipo: "admin", role: "owner", cpf: "03037897430", nome: "Admin E2E" })
    );
    localStorage.setItem("dk_portal_sessao_build", "20260521admin-nav");
    if (typeof window.__DK_portalRefreshMielAcesso === "function") window.__DK_portalRefreshMielAcesso();
  });
}

async function openMielFromHome(page) {
  await page.goto(BASE_URL, { waitUntil: "networkidle", timeout: 60000 });
  page.on("dialog", (d) => d.accept().catch(() => {}));

  const hiddenVisitante = await page.evaluate(() => {
    const btn = document.querySelector('#view-home [data-go="miel"]');
    return !btn || btn.classList.contains("hidden") || btn.getAttribute("aria-hidden") === "true";
  });
  record("acesso: visitante não vê botão MIEL", hiddenVisitante);

  await page.evaluate(() => {
    localStorage.setItem(
      "dk_sessao_cliente",
      JSON.stringify({ tipo: "cliente", cpf: "11144477735", nome: "Cliente Teste", protocolo: "X" })
    );
    if (typeof window.__DK_portalRefreshMielAcesso === "function") window.__DK_portalRefreshMielAcesso();
  });
  await page.waitForTimeout(150);
  const hiddenCliente = await page.evaluate(() => {
    const btn = document.querySelector('#view-home [data-go="miel"]');
    return !btn || btn.classList.contains("hidden");
  });
  record("acesso: cliente não vê botão MIEL", hiddenCliente);

  await page.evaluate(() => {
    window.location.hash = "miel";
    if (typeof window.__DK_portalRefreshMielAcesso === "function") window.__DK_portalRefreshMielAcesso();
  });
  await page.waitForTimeout(200);
  const clienteNaoEntrou = await page.evaluate(
    () => !document.getElementById("view-miel")?.classList.contains("view--active")
  );
  record("acesso: cliente não entra por #miel", clienteNaoEntrou);

  await page.evaluate(() => {
    const cpfSem = "90090090001";
    const cpfCom = "90090090002";
    let list = [];
    try {
      list = JSON.parse(localStorage.getItem("dk_funcionarios_access") || "[]");
      if (!Array.isArray(list)) list = [];
    } catch {
      list = [];
    }
    const upsert = (row) => {
      const i = list.findIndex((x) => String(x.cpf) === row.cpf);
      if (i >= 0) list[i] = { ...list[i], ...row };
      else list.push(row);
    };
    upsert({
      cpf: cpfSem,
      senha: "123456",
      nome: "Colab Sem MIEL",
      role: "operacao",
      blocked: false,
      acessos: { cliente: true, veiculo: true, locacao: true, sistemaMiel: false },
    });
    upsert({
      cpf: cpfCom,
      senha: "123456",
      nome: "Colab Com MIEL",
      role: "operacao",
      blocked: false,
      acessos: { cliente: true, veiculo: true, locacao: true, sistemaMiel: true },
    });
    localStorage.setItem("dk_funcionarios_access", JSON.stringify(list));
    if (typeof window.__DK_hydrateFuncionariosAccess === "function") window.__DK_hydrateFuncionariosAccess();
    localStorage.setItem(
      "dk_sessao_cliente",
      JSON.stringify({ tipo: "admin", role: "operacao", cpf: cpfSem, nome: "Colab Sem MIEL" })
    );
    localStorage.setItem("dk_portal_sessao_build", "20260521admin-nav");
    if (typeof window.__DK_portalRefreshMielAcesso === "function") window.__DK_portalRefreshMielAcesso();
  });
  await page.waitForTimeout(150);
  const hiddenColabSem = await page.evaluate(() => {
    const btn = document.querySelector('#view-home [data-go="miel"]');
    return !btn || btn.classList.contains("hidden");
  });
  record("acesso: colaborador sem permissão não vê MIEL", hiddenColabSem);

  await page.evaluate(() => {
    localStorage.setItem(
      "dk_sessao_cliente",
      JSON.stringify({ tipo: "admin", role: "operacao", cpf: "90090090002", nome: "Colab Com MIEL" })
    );
    if (typeof window.__DK_portalRefreshMielAcesso === "function") window.__DK_portalRefreshMielAcesso();
  });
  await page.waitForTimeout(150);
  const colabComVe = await page.evaluate(() => {
    const btn = document.querySelector('#view-home [data-go="miel"]');
    return Boolean(btn && !btn.classList.contains("hidden"));
  });
  record("acesso: colaborador com permissão vê MIEL", colabComVe);

  await page.evaluate(() => {
    localStorage.setItem(
      "dk_sessao_cliente",
      JSON.stringify({ tipo: "admin", role: "owner", cpf: "06523244440", nome: "Outro Admin" })
    );
    localStorage.setItem("dk_portal_sessao_build", "20260521admin-nav");
    if (typeof window.__DK_portalRefreshMielAcesso === "function") window.__DK_portalRefreshMielAcesso();
  });
  await page.waitForTimeout(150);
  const outroOwnerNaoVe = await page.evaluate(() => {
    const btn = document.querySelector('#view-home [data-go="miel"]');
    return !btn || btn.classList.contains("hidden");
  });
  record("acesso: outro administrador (não 03037897430) não vê MIEL", outroOwnerNaoVe);

  await grantMielOwnerSession(page);
  await page.waitForTimeout(150);
  const ownerVe = await page.evaluate(() => {
    const btn = document.querySelector('#view-home [data-go="miel"]');
    return Boolean(btn && !btn.classList.contains("hidden"));
  });
  record("acesso: administrador CPF 03037897430 vê botão MIEL", ownerVe);

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
    banner: (document.querySelector(".miel-admin-grid__banner td")?.textContent || "").trim(),
    headers: [...document.querySelectorAll(".miel-admin-grid__headers td")].map((el) => el.textContent?.trim()),
    gridBtns: document.querySelectorAll(".miel-admin-grid__hit").length,
    panelVisible: !document.getElementById("mielPanelAdministrativo")?.classList.contains("hidden"),
    navActive: document.querySelector('[data-miel-nav="administrativo"]')?.classList.contains("miel-nav-btn--active"),
    cadClientes: Boolean(document.querySelector('[data-miel-admin-action="Cadastro de Clientes"]')),
    relClientes: Boolean(document.querySelector('[data-miel-admin-action="Relação de Clientes"]')),
  }));

  record(
    "etapa 2: botão Administrativo abre aba correta",
    s.title === "Administrativo" && s.banner === "ADMINISTRATIVO" && s.panelVisible && s.navActive,
    `btns=${s.gridBtns}`
  );
  record(
    "etapa 2: grid 3 colunas (Página Inicial | Formulários | Relatórios)",
    s.headers.length === 3 &&
      s.headers[0] === "Página Inicial" &&
      s.headers[1] === "Formulários" &&
      s.headers[2] === "Relatórios",
    s.headers.join(" | ")
  );
  record("etapa 2: itens principais visíveis no grid", s.cadClientes && s.relClientes && s.gridBtns >= 20, `count=${s.gridBtns}`);

  for (const exp of ADMIN_GRID_EXPECTED) {
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
      `etapa 2: grid «${exp.btn.slice(0, 28)}…» → destino`,
      sub.title === exp.title && sub.ok,
      `title=${sub.title}`
    );
    const back = page
      .locator(
        '.miel-panel:not(.hidden) [data-miel-stub-back="administrativo"], .miel-panel:not(.hidden) [data-miel-cad-back="administrativo"], .miel-panel:not(.hidden) [data-miel-cad-veic-back="administrativo"]'
      )
      .first();
    if (await back.count()) {
      await back.click();
      await page.waitForTimeout(250);
      const admTitle = await page.evaluate(
        () => document.getElementById("mielMainTitle")?.textContent?.trim() || ""
      );
      record(`etapa 2: voltar ao Administrativo (${exp.panel})`, admTitle === "Administrativo", admTitle);
    }
    await page.locator('[data-miel-nav="administrativo"]').first().click();
    await page.waitForTimeout(200);
  }

  await page.locator('[data-miel-admin-action="DASHBOARD"]').first().click();
  await page.waitForTimeout(250);
  const dash = await page.evaluate(
    () => document.getElementById("mielMainTitle")?.textContent?.trim() || ""
  );
  record("etapa 2: coluna A «DASHBOARD» abre Dashboard", dash === "Dashboard", dash);
  await page.locator('[data-miel-nav="administrativo"]').first().click();
  await page.waitForTimeout(200);

  await page.locator('[data-miel-admin-action="Procedimentos"]').first().click();
  await page.waitForTimeout(250);
  const proc = await page.evaluate(
    () => document.getElementById("mielMainTitle")?.textContent?.trim() || ""
  );
  record("etapa 2: coluna A «Procedimentos» abre Procedimentos", proc === "Procedimentos", proc);
  await page.locator('[data-miel-nav="administrativo"]').first().click();
  await page.waitForTimeout(200);
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
    banner: (document.querySelector(".miel-admin-grid__banner td")?.textContent || "").trim() === "ADMINISTRATIVO",
  }));
  record("regressão: etapa 2 após etapa 3", p2.title === "Administrativo" && p2.banner);
}

async function testEtapa4(page) {
  await page.locator('[data-miel-nav="administrativo"]').first().click();
  await page.waitForTimeout(300);
  await page.locator('[data-miel-admin-action="Cadastro de Veículos"]').first().click();
  await page.waitForTimeout(400);

  const s = await page.evaluate(() => ({
    title: document.getElementById("mielMainTitle")?.textContent?.trim() || "",
    bannerText: document.querySelector(".miel-cad__banner")?.textContent?.trim() || "",
    busca: Boolean(document.getElementById("mielCadVeiculoBusca")),
    codigo: Boolean(document.getElementById("mielCadVeiculo_codigo")),
    placa: Boolean(document.getElementById("mielCadVeiculo_placa")),
    marca: Boolean(document.getElementById("mielCadVeiculo_marca")),
    panelVisible: !document.getElementById("mielPanelCadVeiculos")?.classList.contains("hidden"),
    actions: document.querySelectorAll("[data-miel-cad-veic-action]").length,
    sideBtns: document.querySelectorAll("[data-miel-cad-veic-side]").length,
    fieldCount: (window.__DK_mielCadVeiculosFields || []).length,
  }));

  record(
    "etapa 4: Cadastro de Veículos abre formulário",
    s.title === "Cadastro de Veículos" &&
      s.bannerText === "CADASTRO DE VEÍCULOS" &&
      s.busca &&
      s.codigo &&
      s.placa &&
      s.panelVisible,
    `actions=${s.actions}`
  );
  record("etapa 4: 20 campos da planilha (linha 17)", s.fieldCount === 20 && s.actions >= 3);
  record("etapa 4: botões laterais Consulta/Cad. Clientes", s.sideBtns >= 2, `side=${s.sideBtns}`);

  await page.locator("#mielCadVeiculo_codigo").fill("DKMT-TESTE");
  await page.locator("#mielCadVeiculo_placa").fill("ABC1D23");
  await page.locator("#mielCadVeiculo_marca").fill("HONDA");
  await page.locator("#mielCadVeiculo_modelo").fill("CG 160");
  await page.locator('[data-miel-cad-veic-action="guardar"]').first().click();
  await page.waitForTimeout(300);

  const saved = await page.evaluate(() => {
    const fb = document.getElementById("mielCadVeiculoFeedback")?.textContent || "";
    let count = 0;
    try {
      count = JSON.parse(localStorage.getItem("dk_miel_veiculos_v1") || "[]").length;
    } catch {
      /* ignore */
    }
    return { fb, count };
  });
  record("etapa 4: guardar veículo no MIEL", saved.fb.includes("ABC1D23") && saved.count >= 1, saved.fb);

  await page.locator("#mielCadVeiculoBusca").fill("ABC1D23");
  await page.locator("#mielCadVeiculoBusca").dispatchEvent("change");
  await page.waitForTimeout(250);
  const loaded = await page.locator("#mielCadVeiculo_marca").inputValue();
  record("etapa 4: pesquisa carrega veículo", loaded === "HONDA", loaded);

  await page.locator('[data-miel-cad-veic-back="administrativo"]').first().click();
  await page.waitForTimeout(250);
  const adm = await page.evaluate(() => document.getElementById("mielMainTitle")?.textContent?.trim() || "");
  record("etapa 4: voltar ao Administrativo", adm === "Administrativo", adm);

  await page.locator('[data-miel-admin-action="Cadastro de Clientes"]').first().click();
  await page.waitForTimeout(300);
  const cli = await page.evaluate(() => ({
    title: document.getElementById("mielMainTitle")?.textContent?.trim() || "",
    nome: Boolean(document.getElementById("mielCadCliente_nome")),
  }));
  record("regressão: etapa 3 após etapa 4", cli.title === "Cadastro de Clientes" && cli.nome);

  await page.locator('[data-miel-nav="pagina-inicial"]').first().click();
  await page.waitForTimeout(200);
  const p1 = await page.evaluate(() => ({
    title: document.getElementById("mielMainTitle")?.textContent?.trim() || "",
    hero: Boolean(document.querySelector(".miel-pagina-inicial__hero")),
  }));
  record("regressão: etapa 1 após etapa 4", p1.title === "Página Inicial" && p1.hero);

  await page.locator('[data-miel-nav="administrativo"]').first().click();
  await page.waitForTimeout(200);
  const p2 = await page.evaluate(() => ({
    title: document.getElementById("mielMainTitle")?.textContent?.trim() || "",
    banner: (document.querySelector(".miel-admin-grid__banner td")?.textContent || "").trim() === "ADMINISTRATIVO",
  }));
  record("regressão: etapa 2 após etapa 4", p2.title === "Administrativo" && p2.banner);
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
  if (maxEtapa >= 4) await testEtapa4(page);
  await testNavegacaoSaida(page);
  const failed = results.filter((r) => !r.ok);
  return { ok: failed.length === 0, total: results.length, failed: failed.length, results };
}

async function main() {
  try {
    execSync("node scripts/verify-miel-admin-planilha.mjs", { cwd: __dirname + "/..", stdio: "inherit" });
    console.log("PASS | conferência planilha vs portal Administrativo");
  } catch {
    console.error("FAIL | conferência planilha vs portal Administrativo — corrigir antes de publicar");
    process.exit(1);
  }
  try {
    execSync("node scripts/verify-miel-cad-veiculos-planilha.mjs", { cwd: __dirname + "/..", stdio: "inherit" });
    console.log("PASS | conferência planilha vs portal Cadastro de Veículos");
  } catch {
    console.error("FAIL | conferência planilha vs portal Cadastro de Veículos — corrigir antes de publicar");
    process.exit(1);
  }

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
