/**
 * Oficial = 0 protocolos. Demo = exactamente os 10 da imagem Locados.
 * Nuvem (Redis) + browser limpo (localStorage após pull).
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
  };
}

async function browserLocacoes(page, base) {
  await page.goto(base, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem(
      "dk_sessao_cliente",
      JSON.stringify({ tipo: "admin", role: "owner", cpf: "03037897430", nome: "Teste 5x protocolos" })
    );
    sessionStorage.setItem("dk_portal_sessao_viva_v1", "1");
  });
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
    record("oficial nuvem: 0 protocolos", ofCloud.label === "default" && ofCloud.n === 0, `n=${ofCloud.n}`);
    const pageOf = await browser.newPage();
    const ofBr = await browserLocacoes(pageOf, OFICIAL);
    record("oficial browser: não é demo", ofBr.demo === false, `demo=${ofBr.demo}`);
    record("oficial browser: 0 protocolos", ofBr.n === 0, `n=${ofBr.n} ${ofBr.pr.join(",")}`);
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
    const deBr = await browserLocacoes(pageDe, DEMO);
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
