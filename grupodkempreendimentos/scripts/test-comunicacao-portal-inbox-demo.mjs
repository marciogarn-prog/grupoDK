import { chromium } from "playwright";

const BASE = "https://demo.grupodkempreendimentos.com.br/";
const CPF = "06523244440";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

await page.goto(BASE, { waitUntil: "networkidle", timeout: 90000 });
await page.evaluate(() => {
  sessionStorage.setItem("dk_portal_area_ativa", "empresa");
  localStorage.setItem(
    "dk_sessao_cliente",
    JSON.stringify({ tipo: "admin", role: "owner", cpf: "03037897430", nome: "Admin" })
  );
  sessionStorage.setItem(
    "dk_portal_sessao",
    JSON.stringify({ tipo: "admin", role: "owner", cpf: "03037897430", nome: "Admin" })
  );
  sessionStorage.setItem("dkLocalDataAuthorityUntil", String(Date.now() + 60 * 60 * 1000));
});
await page.goto(`${BASE}#locadora/empresa`, { waitUntil: "networkidle", timeout: 90000 });
await page.waitForTimeout(2000);

const inbox = await page.evaluate(async (cpf) => {
  let pullResult = { skipped: true };
  if (typeof window.__DK_pullComunicacaoOperacaoFromCloudMerge === "function") {
    pullResult = await window.__DK_pullComunicacaoOperacaoFromCloudMerge();
  }
  const p =
    typeof window.__DK_comunicacaoListarPendentes === "function"
      ? window.__DK_comunicacaoListarPendentes("vendas")
      : [];
  const marcus = p.filter((x) => String(x.cpf || "").replace(/\D/g, "") === cpf);
  if (typeof window.__DK_portalComunicacaoRefresh === "function") {
    window.__DK_portalComunicacaoRefresh({ forcePull: true });
  }
  await new Promise((r) => setTimeout(r, 1500));
  const html = document.getElementById("portalComunicacaoVendasLista")?.innerHTML || "";
  return { pullResult, pendentes: p.length, marcus: marcus.length, html: html.slice(0, 300) };
}, CPF);

console.log(JSON.stringify(inbox, null, 2));
await browser.close();
process.exit(inbox.marcus > 0 ? 0 : 1);
