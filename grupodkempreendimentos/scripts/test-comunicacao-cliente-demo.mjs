import { chromium } from "playwright";

const BASE = "https://demo.grupodkempreendimentos.com.br/";
const CPF = "06523244440";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

await page.goto(`${BASE}cliente?instalar=1`, { waitUntil: "networkidle", timeout: 90000 });
await page.evaluate(({ cpf }) => {
  localStorage.setItem(
    "dk_sessao_cliente_app",
    JSON.stringify({ cpf, nome: "MARCUS VINICIUS SIQUEIRA DOS SANTOS", loginEm: new Date().toISOString() })
  );
}, { cpf: CPF });
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(3000);

const beforeCloud = await fetch(`${BASE.replace(/\/$/, "")}/api/dk-cloud-snapshot?channel=demo`).then((r) =>
  r.json()
);
const beforeN = (beforeCloud.payload?.dk_comunicacao_operacao_v1 || []).length;

await page.locator("#clienteComunicacaoVendasBtn").click({ timeout: 10000 });
await page.fill("#clienteComunicacaoChatInput", `Teste sync ${Date.now()}`);
await page.click("#clienteComunicacaoChatEnviarBtn");
await page.waitForTimeout(3000);

const pushResult = await page.evaluate(async () => {
  if (typeof window.__DK_pushComunicacaoSnapshotNow !== "function") return { err: "no push fn" };
  return window.__DK_pushComunicacaoSnapshotNow();
});
console.log("push:", pushResult);
await page.waitForTimeout(2000);

const local = await page.evaluate(() => {
  const raw = localStorage.getItem("dk_comunicacao_operacao_v1");
  const arr = raw ? JSON.parse(raw) : [];
  const cliente = arr.filter((m) => m.autor === "cliente");
  return { total: arr.length, cliente: cliente.length, last: cliente[cliente.length - 1]?.texto };
});

const afterCloud = await fetch(`${BASE.replace(/\/$/, "")}/api/dk-cloud-snapshot?channel=demo`).then((r) =>
  r.json()
);
const afterArr = afterCloud.payload?.dk_comunicacao_operacao_v1 || [];
const marcusCliente = afterArr.filter(
  (m) => String(m.cpf || "").replace(/\D/g, "") === CPF && m.autor === "cliente"
);

console.log("local:", local);
console.log("cloud before/after:", beforeN, afterArr.length);
console.log("marcus cliente in cloud:", marcusCliente.length, marcusCliente.slice(-1)[0]?.texto);

await browser.close();
process.exit(marcusCliente.length > 0 ? 0 : 1);
