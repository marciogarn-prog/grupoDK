/**
 * E2E demo: sessão da equipa permanece neste browser (novo separador / reload)
 * até «Sair» ou 12 h após loginAt.
 * node grupodkempreendimentos/scripts/test-login-exigido-demo.mjs
 */
import { chromium } from "playwright";

const BASE = process.env.DK_TEST_BASE_URL || "https://demo.grupodkempreendimentos.com.br/";

const results = [];
function record(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} | ${name}${detail ? ` | ${detail}` : ""}`);
}

const browser = await chromium.launch({ headless: true });
try {
  /* 1. sessão em localStorage sem marcador de janela (novo separador) → continua logado */
  const ctx1 = await browser.newContext();
  const p1 = await ctx1.newPage();
  await p1.goto(BASE, { waitUntil: "networkidle", timeout: 90000 });
  await p1.evaluate(() => {
    localStorage.setItem(
      "dk_sessao_cliente",
      JSON.stringify({
        tipo: "admin",
        role: "owner",
        cpf: "03037897430",
        nome: "Sessao Outro Separador",
        loginAt: Date.now(),
      })
    );
    localStorage.setItem("dk_portal_sessao_build", "20260521admin-nav");
    sessionStorage.clear();
  });
  const p1b = await ctx1.newPage();
  await p1b.goto(`${BASE}#locadora/empresa`, { waitUntil: "networkidle", timeout: 90000 });
  await p1b.waitForTimeout(3500);
  const estado1 = await p1b.evaluate(() => ({
    sessao: Boolean(localStorage.getItem("dk_sessao_cliente")),
    viva: sessionStorage.getItem("dk_portal_sessao_viva_v1") === "1",
    logadoVisivel: !document.getElementById("panel-logado")?.classList.contains("hidden"),
  }));
  record(
    "novo separador mantém sessão da equipa",
    estado1.sessao && estado1.viva && estado1.logadoVisivel,
    JSON.stringify(estado1)
  );
  await ctx1.close();

  /* 2. sessão com mais de 12 h → login exigido */
  const ctxExp = await browser.newContext();
  const pExp = await ctxExp.newPage();
  await pExp.goto(BASE, { waitUntil: "networkidle", timeout: 90000 });
  await pExp.evaluate(() => {
    localStorage.setItem(
      "dk_sessao_cliente",
      JSON.stringify({
        tipo: "admin",
        role: "owner",
        cpf: "03037897430",
        nome: "Sessao Expirada",
        loginAt: Date.now() - 13 * 60 * 60 * 1000,
      })
    );
    sessionStorage.clear();
  });
  const pExp2 = await ctxExp.newPage();
  await pExp2.goto(`${BASE}#locadora/empresa`, { waitUntil: "networkidle", timeout: 90000 });
  await pExp2.waitForTimeout(2500);
  const estadoExp = await pExp2.evaluate(() => ({
    sessao: localStorage.getItem("dk_sessao_cliente"),
    logadoVisivel: !document.getElementById("panel-logado")?.classList.contains("hidden"),
  }));
  record(
    "sessão com mais de 12 h é descartada",
    estadoExp.sessao === null && !estadoExp.logadoVisivel,
    JSON.stringify(estadoExp).slice(0, 160)
  );
  await ctxExp.close();

  /* 3. sessão com marcador de janela (login real) → área restaurada */
  const ctx2 = await browser.newContext();
  const p2 = await ctx2.newPage();
  await p2.goto(BASE, { waitUntil: "networkidle", timeout: 90000 });
  await p2.evaluate(() => {
    localStorage.setItem(
      "dk_sessao_cliente",
      JSON.stringify({
        tipo: "admin",
        role: "owner",
        cpf: "03037897430",
        nome: "Administrador E2E",
        loginAt: Date.now(),
      })
    );
    localStorage.setItem("dk_portal_sessao_build", "20260521admin-nav");
    sessionStorage.setItem("dk_portal_sessao_viva_v1", "1");
    sessionStorage.removeItem("dk_portal_area_ativa");
  });
  await p2.goto(`${BASE}#locadora/empresa`, { waitUntil: "networkidle", timeout: 90000 });
  await p2.waitForFunction(() => {
    const p = document.getElementById("panel-logado");
    return p && !p.classList.contains("hidden");
  }, { timeout: 45000 });
  record("sessão na mesma janela mantém área da equipa", true);

  /* 4. reload na mesma janela continua logado */
  await p2.reload({ waitUntil: "networkidle", timeout: 90000 });
  await p2.waitForTimeout(3000);
  const estado3 = await p2.evaluate(() => ({
    sessao: Boolean(localStorage.getItem("dk_sessao_cliente")),
    viva: sessionStorage.getItem("dk_portal_sessao_viva_v1") === "1",
  }));
  record("reload na mesma janela não desloga", estado3.sessao && estado3.viva, JSON.stringify(estado3));
  await ctx2.close();
} catch (e) {
  record("erro inesperado", false, String(e?.message || e).slice(0, 200));
} finally {
  await browser.close();
}

const ok = results.filter((r) => r.ok).length;
console.log(`\n--- ${ok}/${results.length} ---`);
process.exit(ok === results.length ? 0 : 1);
