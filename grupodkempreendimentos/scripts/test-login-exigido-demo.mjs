/**
 * E2E demo: SEGURANÇA — sessão da equipa não sobrevive a navegador fechado/reaberto.
 * 1. Sessão admin antiga em localStorage SEM marcador de janela → site exige login.
 * 2. Sessão com marcador (login real nesta janela) → área da equipa restaurada.
 * 3. Sair limpa sessão e marcador.
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
  /* 1. sessão antiga sem marcador (browser "reaberto") → login exigido */
  const ctx1 = await browser.newContext();
  const p1 = await ctx1.newPage();
  await p1.goto(BASE, { waitUntil: "networkidle", timeout: 90000 });
  await p1.evaluate(() => {
    localStorage.setItem(
      "dk_sessao_cliente",
      JSON.stringify({ tipo: "admin", role: "owner", cpf: "03037897430", nome: "Sessao Antiga" })
    );
    localStorage.setItem("dk_portal_sessao_build", "20260521admin-nav");
    sessionStorage.clear();
  });
  /* novo separador no mesmo contexto = sessionStorage vazio (igual a browser reaberto) */
  const p1b = await ctx1.newPage();
  await p1b.goto(`${BASE}#locadora/empresa`, { waitUntil: "networkidle", timeout: 90000 });
  await p1b.waitForTimeout(3500);
  const estado1 = await p1b.evaluate(() => ({
    sessao: localStorage.getItem("dk_sessao_cliente"),
    logadoVisivel: !document.getElementById("panel-logado")?.classList.contains("hidden"),
    bannerVisivel: !document.getElementById("portal-admin-banner")?.classList.contains("hidden"),
  }));
  record(
    "sessão antiga descartada — login exigido",
    estado1.sessao === null && !estado1.logadoVisivel && !estado1.bannerVisivel,
    JSON.stringify(estado1).slice(0, 160)
  );
  await ctx1.close();

  /* 2. sessão com marcador de janela (login real) → área restaurada */
  const ctx2 = await browser.newContext();
  const p2 = await ctx2.newPage();
  await p2.goto(BASE, { waitUntil: "networkidle", timeout: 90000 });
  await p2.evaluate(() => {
    localStorage.setItem(
      "dk_sessao_cliente",
      JSON.stringify({ tipo: "admin", role: "owner", cpf: "03037897430", nome: "Administrador E2E" })
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

  /* 3. reload na mesma janela continua logado (marcador persiste) */
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
