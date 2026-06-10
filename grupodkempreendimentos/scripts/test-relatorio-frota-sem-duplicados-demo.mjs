/**
 * E2E demo: Relatório da frota — cada placa aparece UMA só vez
 * (ou em «inativos» ou em «locados»). Caso reportado: UHO2D60 (locação ativa 2026011201).
 * node grupodkempreendimentos/scripts/test-relatorio-frota-sem-duplicados-demo.mjs
 */
import { chromium } from "playwright";

const BASE = "https://demo.grupodkempreendimentos.com.br/";

const results = [];
function record(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} | ${name}${detail ? ` | ${detail}` : ""}`);
}

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  await page.goto(BASE, { waitUntil: "networkidle", timeout: 90000 });
  await page.evaluate(() => {
    sessionStorage.removeItem("dk_portal_area_ativa");
    localStorage.setItem(
      "dk_sessao_cliente",
      JSON.stringify({ tipo: "admin", role: "owner", cpf: "03037897430", nome: "Administrador E2E" })
    );
    localStorage.setItem("dk_portal_sessao_build", "20260521admin-nav");
    sessionStorage.setItem("dk_portal_sessao_viva_v1", "1");
    localStorage.removeItem("dk_instalacao_limpa_v1");
  });
  await page.goto(`${BASE}#locadora/empresa`, { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForFunction(() => {
    const p = document.getElementById("panel-logado");
    return p && !p.classList.contains("hidden");
  }, { timeout: 45000 });
  record("login admin portal demo", true);
  await page.waitForTimeout(3000);

  const res = await page.evaluate(() => {
    if (typeof window.__DK_portalRelatorioVeiculosSections !== "function" &&
        typeof buildPortalRelatorioVeiculoFrotaSections !== "function") {
      return { ok: false, reason: "fn_indisponivel" };
    }
    const sections = typeof buildPortalRelatorioVeiculoFrotaSections === "function"
      ? buildPortalRelatorioVeiculoFrotaSections()
      : window.__DK_portalRelatorioVeiculosSections();
    const norm = (p) => String(p || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    const coletar = (bloco) => {
      const out = [];
      ["portal", "frota"].forEach((origem) => {
        const g = bloco[origem] || {};
        ["carros", "motos", "outros"].forEach((k) => (g[k] || []).forEach((v) => out.push(norm(v.placa))));
      });
      return out.filter(Boolean);
    };
    const inativos = coletar(sections.inativos);
    const ativos = coletar(sections.ativos);
    const setIn = new Set(inativos);
    const setAt = new Set(ativos);
    const emAmbos = [...setAt].filter((p) => setIn.has(p));
    const dupDentro = (arr) => {
      const seen = new Set();
      const dup = new Set();
      arr.forEach((p) => (seen.has(p) ? dup.add(p) : seen.add(p)));
      return [...dup];
    };
    return {
      ok: true,
      nInativos: inativos.length,
      nAtivos: ativos.length,
      emAmbos,
      dupInativos: dupDentro(inativos),
      dupAtivos: dupDentro(ativos),
      uho2d60: { inativo: setIn.has("UHO2D60"), ativo: setAt.has("UHO2D60") },
    };
  });

  record("relatório gerado", res.ok === true, res.ok ? `inativos=${res.nInativos} locados=${res.nAtivos}` : res.reason);
  record("nenhuma placa nos dois blocos", res.ok && res.emAmbos.length === 0, res.emAmbos?.slice(0, 8).join(",") || "0 repetidas");
  record(
    "sem placas duplicadas dentro de cada bloco",
    res.ok && !res.dupInativos.length && !res.dupAtivos.length,
    `dupIn=${res.dupInativos?.length || 0} dupAt=${res.dupAtivos?.length || 0}`
  );
  record(
    "UHO2D60 só em «locados» (locação ativa 2026011201)",
    res.ok && res.uho2d60?.ativo === true && res.uho2d60?.inativo === false,
    JSON.stringify(res.uho2d60)
  );
} catch (e) {
  record("erro inesperado", false, String(e?.message || e).slice(0, 200));
} finally {
  await browser.close();
}

const ok = results.filter((r) => r.ok).length;
console.log(`\n--- ${ok}/${results.length} ---`);
process.exit(ok === results.length ? 0 : 1);
