import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.goto("https://demo.grupodkempreendimentos.com.br/portal-supabase-sync.js?v=20260608comunicacao-sync", {
  waitUntil: "networkidle",
});
const text = await page.content();
console.log("has pull fn in file:", text.includes("pullComunicacaoOperacaoFromCloudMerge"));
await browser.close();
