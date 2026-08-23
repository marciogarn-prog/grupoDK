/**
 * Oficial: 526 protocolos da planilha; os 6 protocolos sujos (19–21/08) não voltam.
 * Demo: exactamente os 10 da imagem Locados.
 *
 *   node grupodkempreendimentos/scripts/test-oficial-zero-demo-10-protocolos.mjs
 *   node grupodkempreendimentos/scripts/test-oficial-zero-demo-10-protocolos.mjs --oficial
 *   node grupodkempreendimentos/scripts/test-oficial-zero-demo-10-protocolos.mjs --demo
 */
import { chromium } from "playwright";

const OFICIAL = "https://grupodkempreendimentos.com.br/";
const DEMO = "https://demo.grupodkempreendimentos.com.br/";
const DEMO_10 = [
  "2026031302",
  "2026031303",
  "2026031304",
  "2026031305",
  "2026031601",
  "2026031602",
  "2026031701",
  "2026031702",
  "2026031703",
  "2026031704",
];
const DEMO_10_SET = new Set(DEMO_10);
const FAKES = new Set(["2026081901", "2026082001", "2026082002", "2026082003", "2026082004", "2026082101"]);
const SUJOS = [
  { numeroContrato: "2026081201", cpf: "70506946495", nome: "DIEGO CORREIA DIAS", placa: "UIA1J86", status: "inativo" },
  { numeroContrato: "2026081901", cpf: "04115684500", nome: "UELTON DE ALMEIDA SANTOS", placa: "UHK4C39", status: "ativo" },
  { numeroContrato: "2026082001", cpf: "08360620431", nome: "MAGNO LOPES FERREIRA", placa: "QYI3E13", status: "ativo" },
  { numeroContrato: "2026082002", cpf: "71361906499", nome: "NATANAEL DA SILVA SAMPAIO", placa: "SOY2B04", status: "ativo" },
  { numeroContrato: "2026082003", cpf: "33838390378", nome: "ADRIANO CARDOSO RIBEIRO", placa: "UHQ1A58", status: "ativo" },
  { numeroContrato: "2026082004", cpf: "11111111111", nome: "PROTOCOLO SUJO 6", placa: "AAA0A00", status: "ativo" },
  { numeroContrato: "2026082101", cpf: "22222222222", nome: "PROTOCOLO SUJO 7", placa: "BBB0B00", status: "ativo" },
];

const only = process.argv.includes("--oficial")
  ? "oficial"
  : process.argv.includes("--demo")
    ? "demo"
    : "ambos";

const results = [];
function record(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} | ${name}${detail ? ` | ${detail}` : ""}`);
}

function nc(v) {
  return String(v || "").replace(/\D/g, "");
}

async function cloud(url) {
  const d = await fetch(url).then((r) => r.json());
  const locs = d.payload?.dk_locacoes_cadastro || [];
  return {
    label: d.label,
    n: locs.length,
    pr: locs.map((l) => nc(l.numeroContrato || l.protocolo)).filter(Boolean),
    diego: locs.find((l) => nc(l.numeroContrato || l.protocolo) === "2026081201") || null,
  };
}

function loginAdmin(page) {
  return page.evaluate(() => {
    localStorage.setItem(
      "dk_sessao_cliente",
      JSON.stringify({ tipo: "admin", role: "owner", cpf: "03037897430", nome: "Teste protocolos" })
    );
    sessionStorage.setItem("dk_portal_sessao_viva_v1", "1");
  });
}

async function seedOficialSujo(page) {
  const now = Date.now();
  const locs = SUJOS.map((l, i) => ({
    ...l,
    numeroContrato: l.numeroContrato,
    createdAt: now,
    updatedAt: now,
    dataCadastro: "23/08/2026",
    inicio: "23/08/2026",
    ativo: l.status === "ativo",
    id: now + i,
  }));
  await page.goto(OFICIAL, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.evaluate((payload) => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem("dk_locacoes_cadastro", JSON.stringify(payload.locs));
    localStorage.setItem("dk_clear_locacoes_once_v1", "done");
    localStorage.setItem("dk_reset_locacao_stack_site_v2", "done");
    localStorage.setItem(
      "dk_sessao_cliente",
      JSON.stringify({ tipo: "admin", role: "owner", cpf: "03037897430", nome: "Teste protocolos" })
    );
    sessionStorage.setItem("dk_portal_sessao_viva_v1", "1");
  }, { locs });
  await page.reload({ waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForTimeout(5000);
}

async function browserLocacoesClean(page, base) {
  await page.goto(base, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await loginAdmin(page);
  await page.goto(`${base}#locadora/empresa`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForTimeout(12000);
  return page.evaluate(() => {
    let locs = [];
    try {
      locs = JSON.parse(localStorage.getItem("dk_locacoes_cadastro") || "[]");
    } catch {
      locs = [];
    }
    if (!Array.isArray(locs)) locs = [];
    const nc = (v) => String(v || "").replace(/\D/g, "");
    return {
      n: locs.length,
      pr: locs.map((l) => nc(l.numeroContrato || l.protocolo)).filter(Boolean),
      demo: window.__DK_IS_DEMO_DEPLOY__ === true,
    };
  });
}

const browser = await chromium.launch({ headless: true });
try {
  if (only !== "demo") {
    const ofCloud = await cloud(`${OFICIAL}api/dk-cloud-snapshot?n=${Date.now()}`);
    const uniq = new Set(ofCloud.pr);
    const fakesInCloud = ofCloud.pr.filter((p) => FAKES.has(p));
    const diegoPlaca = String(ofCloud.diego?.placa || "")
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "");
    record(
      "oficial nuvem: 526 protocolos da planilha",
      ofCloud.label === "default" && ofCloud.n === 526 && uniq.size === 526,
      `n=${ofCloud.n} unique=${uniq.size}`
    );
    record(
      "oficial nuvem: sem os 6 protocolos sujos",
      fakesInCloud.length === 0,
      fakesInCloud.join(",")
    );
    record(
      "oficial nuvem: 2026081201 DIEGO / SOZ5C50",
      Boolean(ofCloud.diego) && diegoPlaca === "SOZ5C50",
      `placa=${diegoPlaca || "-"}`
    );

    const pageOf = await browser.newPage();
    await seedOficialSujo(pageOf);
    await pageOf.goto(`${OFICIAL}#locadora/empresa`, { waitUntil: "domcontentloaded", timeout: 120000 });
    await pageOf
      .waitForFunction(() => {
        const panel = document.getElementById("panel-logado");
        return panel && !panel.classList.contains("hidden");
      }, { timeout: 45000 })
      .catch(() => null);
    await pageOf.waitForTimeout(12000);
    const afterSeed = await pageOf.evaluate(() => {
      let raw = [];
      try {
        raw = JSON.parse(localStorage.getItem("dk_locacoes_cadastro") || "[]");
      } catch {
        raw = [];
      }
      const loaded =
        typeof loadCadastro === "function" ? loadCadastro("dk_locacoes_cadastro") : raw;
      const list = Array.isArray(loaded) ? loaded : [];
      const nc = (v) => String(v || "").replace(/\D/g, "");
      const diego = list.find((l) => nc(l.numeroContrato || l.protocolo) === "2026081201");
      return {
        rawN: Array.isArray(raw) ? raw.length : -1,
        loadN: list.length,
        pr: list.map((l) => nc(l.numeroContrato || l.protocolo)),
        diegoPlaca: String(diego?.placa || "")
          .toUpperCase()
          .replace(/[^A-Z0-9]/g, ""),
        guard: window.__DK_OFICIAL_LOCACOES_CUTOFF_YMD || "",
      };
    });
    const fakesLocal = afterSeed.pr.filter((p) => FAKES.has(p));
    record(
      "oficial browser: os 6 sujos não entram",
      fakesLocal.length === 0,
      `fakes=${fakesLocal.join(",")} load=${afterSeed.loadN} corte=${afterSeed.guard}`
    );
    record(
      "oficial browser: 2026081201 da planilha (não UIA1J86)",
      afterSeed.loadN === 0 || afterSeed.diegoPlaca === "" || afterSeed.diegoPlaca === "SOZ5C50",
      `placa=${afterSeed.diegoPlaca || "-"} n=${afterSeed.loadN}`
    );

    const pesquisaFn = await pageOf.evaluate(() => {
      const fn = window.__DK_collectLancPesquisaLinhas;
      const linhas = typeof fn === "function" ? fn() : [];
      const pr = (linhas || []).map((r) => String(r.proto || "").replace(/\D/g, ""));
      return { n: linhas.length, pr };
    });
    record(
      "oficial lançamento: sem os 6 protocolos sujos",
      !pesquisaFn.pr.some((p) => FAKES.has(p)),
      `n=${pesquisaFn.n}`
    );

    const relUi = await pageOf.evaluate(() => {
      document.getElementById("operacaoLocacaoGerarRelatorioBtn")?.click();
      const titulo = String(document.getElementById("portalRelatorioTitulo")?.textContent || "");
      const resumo = String(document.getElementById("portalRelatorioResumo")?.textContent || "");
      return { titulo, resumo };
    });
    record(
      "oficial relatório locações: 526 registos",
      /locações cadastradas/i.test(relUi.titulo) && /526 registro/i.test(relUi.resumo),
      `${relUi.titulo} | ${relUi.resumo}`
    );
    await pageOf.close();
  }

  if (only !== "oficial") {
    const deCloud = await cloud(`${OFICIAL}api/dk-cloud-snapshot?channel=demo&n=${Date.now()}`);
    const demoCloudOk =
      deCloud.label === "demo" &&
      deCloud.n === 10 &&
      deCloud.pr.every((p) => DEMO_10_SET.has(p)) &&
      DEMO_10.every((p) => deCloud.pr.includes(p));
    record("demo nuvem: 10 protocolos da imagem", demoCloudOk, `n=${deCloud.n} ${deCloud.pr.join(",")}`);
    const pageDe = await browser.newPage();
    const deBr = await browserLocacoesClean(pageDe, DEMO);
    record("demo browser: é demo", deBr.demo === true, `demo=${deBr.demo}`);
    const demoBrOk =
      deBr.n === 10 &&
      deBr.pr.every((p) => DEMO_10_SET.has(p)) &&
      DEMO_10.every((p) => deBr.pr.includes(p));
    record("demo browser: 10 protocolos da imagem", demoBrOk, `n=${deBr.n} ${deBr.pr.join(",")}`);
    await pageDe.close();
  }
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n--- ${results.length - failed.length}/${results.length} ---`);
process.exit(failed.length ? 1 : 0);
