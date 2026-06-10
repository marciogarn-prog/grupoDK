import { chromium } from "playwright";

const BASE = "https://demo.grupodkempreendimentos.com.br/";
const CPF = "06523244440";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.evaluate(({ cpf }) => {
  localStorage.setItem(
    "dk_sessao_cliente_app",
    JSON.stringify({ cpf, nome: "Marcus Test", loginEm: new Date().toISOString() })
  );
}, { cpf: CPF });

const t0 = Date.now();
await page.goto(`${BASE}cliente`, { waitUntil: "domcontentloaded", timeout: 60000 });

let msToApp = -1;
for (let i = 0; i < 40; i++) {
  const visible = await page.evaluate(() => {
    const app = document.getElementById("view-app");
    return app && !app.classList.contains("hidden");
  });
  if (visible) {
    msToApp = Date.now() - t0;
    break;
  }
  await page.waitForTimeout(250);
}

console.log(`ms até view-app visível: ${msToApp >= 0 ? msToApp : "timeout"}`);
await browser.close();
process.exit(msToApp >= 0 && msToApp < 8000 ? 0 : 1);
