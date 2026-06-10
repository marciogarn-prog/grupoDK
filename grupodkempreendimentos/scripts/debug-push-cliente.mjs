import { chromium } from "playwright";

const BASE = "https://demo.grupodkempreendimentos.com.br/";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.goto(`${BASE}cliente?instalar=1`, { waitUntil: "networkidle", timeout: 90000 });

const r = await page.evaluate(async () => {
  localStorage.setItem(
    "dk_comunicacao_operacao_v1",
    JSON.stringify([
      {
        id: "cm_test",
        threadId: "06523244440|vendas",
        setor: "vendas",
        cpf: "06523244440",
        nome: "Test",
        texto: "push test",
        autor: "cliente",
        criadoEm: new Date().toISOString(),
      },
    ])
  );
  const fn = window.__DK_pushCloudSnapshotNow;
  if (typeof fn !== "function") return { err: "no fn" };
  const hasLoadCadastro = typeof loadCadastro === "function";
  const isDemo = window.__DK_IS_DEMO_DEPLOY__;
  const out = await fn({ force: true });
  return { hasLoadCadastro, isDemo, out };
});
console.log(JSON.stringify(r, null, 2));
await browser.close();
