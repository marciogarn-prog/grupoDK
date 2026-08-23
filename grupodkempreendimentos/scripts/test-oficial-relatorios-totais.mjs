/**
 * Oficial: relatório de clientes = 369; relatório de veículos = 186; 0 protocolos.
 * node grupodkempreendimentos/scripts/test-oficial-relatorios-totais.mjs
 */
import { chromium } from "playwright";

const OFICIAL = "https://grupodkempreendimentos.com.br/";
const results = [];
function record(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} | ${name}${detail ? ` | ${detail}` : ""}`);
}

const cloud = await fetch(`${OFICIAL}api/dk-cloud-snapshot?n=${Date.now()}`).then((r) => r.json());
const p = cloud.payload || {};
const cCloud = (p.dk_clientes_cadastro || []).length;
const vCloud = (p.dk_veiculos_cadastro || []).length;
const lCloud = (p.dk_locacoes_cadastro || []).length;
record("oficial nuvem: 369 clientes", cCloud === 369, `c=${cCloud}`);
record("oficial nuvem: 186 veículos", vCloud === 186, `v=${vCloud}`);
record("oficial nuvem: 0 protocolos", lCloud === 0, `l=${lCloud}`);

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
try {
  await page.goto(OFICIAL, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem(
      "dk_sessao_cliente",
      JSON.stringify({ tipo: "admin", role: "owner", cpf: "03037897430", nome: "Teste totais" })
    );
    sessionStorage.setItem("dk_portal_sessao_viva_v1", "1");
  });
  await page.goto(`${OFICIAL}#locadora/empresa`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForTimeout(14000);
  const local = await page.evaluate(() => {
    const len = (k) => {
      try {
        const a = JSON.parse(localStorage.getItem(k) || "[]");
        return Array.isArray(a) ? a.length : -1;
      } catch {
        return -1;
      }
    };
    const loadC = typeof loadCadastro === "function" ? loadCadastro("dk_clientes_cadastro").length : -1;
    const loadV = typeof loadCadastro === "function" ? loadCadastro("dk_veiculos_cadastro").length : -1;
    return {
      rawC: len("dk_clientes_cadastro"),
      rawV: len("dk_veiculos_cadastro"),
      rawL: len("dk_locacoes_cadastro"),
      loadC,
      loadV,
    };
  });
  record("browser: 369 clientes", local.loadC === 369 || local.rawC === 369, `load=${local.loadC} raw=${local.rawC}`);
  record("browser: 186 veículos", local.loadV === 186 || local.rawV === 186, `load=${local.loadV} raw=${local.rawV}`);
  record("browser: 0 protocolos", local.rawL === 0, `l=${local.rawL}`);

  const relCli = await page.evaluate(() => {
    document.getElementById("operacaoClienteGerarRelatorioBtn")?.click();
    const titulo = String(document.getElementById("portalRelatorioTitulo")?.textContent || "");
    const resumo = String(document.getElementById("portalRelatorioResumo")?.textContent || "");
    return { titulo, resumo };
  });
  record(
    "relatório clientes: 369 registros",
    /369 registro/i.test(relCli.resumo),
    `${relCli.titulo} | ${relCli.resumo}`
  );

  const relVei = await page.evaluate(() => {
    document.getElementById("operacaoVeiculoGerarRelatorioBtn")?.click();
    const titulo = String(document.getElementById("portalRelatorioTitulo")?.textContent || "");
    const resumo = String(document.getElementById("portalRelatorioResumo")?.textContent || "");
    return { titulo, resumo };
  });
  record(
    "relatório veículos: 186 no cadastro",
    /186 veículo/i.test(relVei.resumo),
    `${relVei.titulo} | ${relVei.resumo}`
  );
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n--- ${results.length - failed.length}/${results.length} ---`);
process.exit(failed.length ? 1 : 0);
