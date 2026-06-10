import { chromium } from "playwright";

const BASE = "https://demo.grupodkempreendimentos.com.br/";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.goto(BASE, { waitUntil: "networkidle", timeout: 90000 });

const info = await page.evaluate(async () => {
  const hasFn = typeof window.__DK_pullComunicacaoOperacaoFromCloudMerge === "function";
  const fetchFn = typeof window.__DK_fetchCloudSnapshotPayload === "function";
  let cloud = null;
  if (fetchFn) cloud = await window.__DK_fetchCloudSnapshotPayload();
  const com = cloud?.payload?.dk_comunicacao_operacao_v1;
  let pull = null;
  if (hasFn) pull = await window.__DK_pullComunicacaoOperacaoFromCloudMerge();
  const local = JSON.parse(localStorage.getItem("dk_comunicacao_operacao_v1") || "[]");
  const pend =
    typeof window.__DK_comunicacaoListarPendentes === "function"
      ? window.__DK_comunicacaoListarPendentes("vendas")
      : [];
  return {
    hasFn,
    cloudComLen: Array.isArray(com) ? com.length : -1,
    pull,
    localLen: local.length,
    pend: pend.length,
  };
});
console.log(JSON.stringify(info, null, 2));
await browser.close();
