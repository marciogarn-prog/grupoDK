/**
 * E2E produção — CPF 065 no portal e login app José 19174403400.
 * node grupodkempreendimentos/scripts/test-clientes-cpf-app-producao.mjs
 */
import { chromium } from "playwright";

const BASE = (process.env.DK_TEST_BASE || "https://grupodkempreendimentos.com.br/").replace(
  /\/?$/,
  "/"
);
const OWNER_CPF = "03037897430";
const OWNER_SENHA = process.env.DK_OWNER_SENHA || "110499@Gb";

const JOSE_CPF = "19174403400";
const MARCUS_CPF = "06523244440";
const PROTO_JOSE = "2026010101";
const CLIENTE_SENHA = "123456";

const results = [];
function record(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} | ${name}${detail ? ` | ${detail}` : ""}`);
}

async function testCloud() {
  const res = await fetch(`${BASE}api/dk-cloud-snapshot`);
  const data = await res.json().catch(() => ({}));
  record("nuvem API ok", res.ok);
  const dig = (s) => String(s ?? "").replace(/\D/g, "").slice(0, 11);
  const norm = (s) => String(s ?? "").replace(/\W/g, "").toUpperCase();
  const locs = data?.payload?.dk_locacoes_cadastro || [];
  const clientes = data?.payload?.dk_clientes_cadastro || [];

  const l102 = locs.filter((l) => norm(l.numeroContrato) === "2026010102");
  const l101 = locs.filter((l) => norm(l.numeroContrato) === "2026010101");
  record("nuvem: 2026010102 → Marcus", l102[0] && dig(l102[0].cpf) === MARCUS_CPF, l102[0]?.cpf);
  record("nuvem: 2026010101 → José", l101[0] && dig(l101[0].cpf) === JOSE_CPF, l101[0]?.cpf);
  record(
    "nuvem: cadastro Marcus",
    clientes.some((c) => dig(c.cpf) === MARCUS_CPF),
    clientes.find((c) => dig(c.cpf) === MARCUS_CPF)?.nome
  );
  record(
    "nuvem: cadastro José",
    clientes.some((c) => dig(c.cpf) === JOSE_CPF),
    clientes.find((c) => dig(c.cpf) === JOSE_CPF)?.nome
  );
}

async function loginOwner(page) {
  await page.goto(`${BASE}#locadora/empresa/administrador`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1000);
  await page.locator("#login-cpf").fill(OWNER_CPF);
  await page.locator("#login-senha").fill(OWNER_SENHA);
  await page.locator("#form-login button[type=submit]").click();
  await page.waitForSelector("#panel-logado:not(.hidden)", { timeout: 20000 });
}

async function testPortalMarcus(page) {
  await page.evaluate(async () => {
    if (typeof window.__DK_pullCloudSnapshotSilentMerge === "function") {
      await window.__DK_pullCloudSnapshotSilentMerge();
    }
  });
  await page.waitForTimeout(4000);

  await page.locator("text=Operação").first().click();
  await page.waitForTimeout(500);
  await page.locator("text=Cadastro de cliente").first().click();
  await page.waitForTimeout(800);

  const cpfIn = page.locator("#operacaoClienteCpf");
  await cpfIn.fill("065");
  await cpfIn.dispatchEvent("input", { bubbles: true });
  await page.waitForTimeout(1200);

  const panelText = await page.locator("#operacaoClienteNomeListaPrefixo").innerText();
  record(
    "portal: lista CPF 065 não vazia",
    !panelText.includes("Nenhum cliente com CPF começando por"),
    panelText.slice(0, 120)
  );
  record(
    "portal: lista menciona Marcus ou 065.232",
    /marcus|065\.?232/i.test(panelText),
    panelText.slice(0, 120)
  );

  await cpfIn.fill(MARCUS_CPF);
  await cpfIn.dispatchEvent("input", { bubbles: true });
  await page.waitForTimeout(800);
  const known = await page.evaluate(() => {
    const msg = document.getElementById("operacaoClienteCadastroDetectMsg")?.textContent || "";
    const nome = document.getElementById("operacaoClienteNome")?.value || "";
    return { msg, nome };
  });
  record("portal: CPF Marcus completo reconhecido", /cadastrado|Marcus/i.test(known.msg + known.nome), known.msg);
}

async function testClienteAppJose(browser) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  await page.goto(
    `${BASE}cliente?instalar=1&cpf=${JOSE_CPF}&proto=${PROTO_JOSE}`,
    { waitUntil: "domcontentloaded", timeout: 90000 }
  );
  await page.waitForTimeout(2000);

  await page.evaluate(async () => {
    if (typeof window.__DK_pullCloudSnapshotSilentMerge === "function") {
      await window.__DK_pullCloudSnapshotSilentMerge();
    }
  });
  await page.waitForTimeout(5000);

  const preLogin = await page.evaluate(({ jose, proto }) => {
    const dig = (s) => String(s ?? "").replace(/\D/g, "").slice(0, 11);
    const norm = (s) => String(s ?? "").replace(/\W/g, "").toUpperCase();
    let clientes = [];
    let locs = [];
    try {
      clientes = JSON.parse(localStorage.getItem("dk_clientes_cadastro") || "[]");
    } catch {
      /* ignore */
    }
    try {
      locs = JSON.parse(localStorage.getItem("dk_locacoes_cadastro") || "[]");
    } catch {
      /* ignore */
    }
    return {
      hasCliente: clientes.some((c) => dig(c.cpf) === jose),
      hasLoc: locs.some((l) => dig(l.cpf) === jose && norm(l.numeroContrato) === proto),
      locCount: locs.filter((l) => dig(l.cpf) === jose).length,
    };
  }, { jose: JOSE_CPF, proto: PROTO_JOSE });

  record("app: LS cliente José após sync", preLogin.hasCliente, `locs=${preLogin.locCount}`);
  record("app: LS locação 2026010101", preLogin.hasLoc);

  await page.locator("#login-cpf").fill(JOSE_CPF);
  await page.locator("#login-senha").fill(CLIENTE_SENHA);
  await page.locator("#form-login button[type=submit]").click();
  await page.waitForTimeout(8000);

  const after = await page.evaluate(() => {
    const loginFb = document.getElementById("login-feedback")?.textContent || "";
    const loginHidden = document.getElementById("view-login")?.classList.contains("hidden");
    const appHidden = document.getElementById("view-app")?.classList.contains("hidden");
    const propHidden = document.getElementById("view-propaganda")?.classList.contains("hidden");
    const appNome = document.getElementById("cliente-nome")?.textContent || "";
    return { loginFb, loginHidden, appHidden, propHidden, appNome };
  });

  const locDebug = await page.evaluate(({ jose, proto }) => {
    const dig = (s) => String(s ?? "").replace(/\D/g, "").slice(0, 11);
    const norm = (s) => String(s ?? "").replace(/\W/g, "").toUpperCase();
    let locs = [];
    try {
      locs = JSON.parse(localStorage.getItem("dk_locacoes_cadastro") || "[]");
    } catch {
      /* ignore */
    }
    const mine = locs.filter((l) => dig(l.cpf) === jose);
    const gate = localStorage.getItem("dk_cliente_gate_persist") || "";
    return {
      mine: mine.map((l) => ({
        nc: l.numeroContrato,
        fim: l.fim,
        status: l.statusLocacao,
        gateMatch: norm(l.numeroContrato) === proto,
      })),
      gate: gate.slice(0, 80),
    };
  }, { jose: JOSE_CPF, proto: PROTO_JOSE });

  record("app José: login sem erro CPF/senha", !/inválid/i.test(after.loginFb), after.loginFb);
  record(
    "app José: entrou na app (não propaganda)",
    after.loginHidden && !after.appHidden && after.propHidden,
    `app=${after.appNome.slice(0, 40)}` +
      (locDebug.mine.length ? ` | locs=${JSON.stringify(locDebug.mine)}` : "")
  );
  await ctx.close();
}

async function main() {
  await testCloud();

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await loginOwner(page);
    await testPortalMarcus(page);
    await testClienteAppJose(browser);
  } catch (e) {
    record("E2E exceção", false, e.message || String(e));
  } finally {
    await browser.close();
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n--- ${results.length - failed.length}/${results.length} (${BASE}) ---`);
  if (failed.length) {
    console.log("Falhas:", failed.map((f) => f.name).join(", "));
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
