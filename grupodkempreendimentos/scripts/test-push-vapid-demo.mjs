/**
 * Teste push VAPID + notify DK (demo).
 * Uso: node grupodkempreendimentos/scripts/test-push-vapid-demo.mjs
 */
import { chromium } from "playwright";

const DEMO = "https://demo.grupodkempreendimentos.com.br";
const MARCUS_CPF = "06523244440";
const results = [];

function record(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} | ${name}${detail ? ` | ${detail}` : ""}`);
}

async function fetchJson(url, opts) {
  const res = await fetch(url, opts);
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

const vapid = await fetchJson(`${DEMO}/api/dk-cliente-geo?push=1&action=vapid&channel=demo`);
record(
  "VAPID demo configurado",
  vapid.status === 200 && vapid.data?.configured === true && Boolean(vapid.data?.publicKey),
  vapid.data?.configured ? "configured=true" : JSON.stringify(vapid.data)
);

const notify = await fetchJson(`${DEMO}/api/dk-cliente-geo?push=1`, {
  method: "POST",
  headers: { "Content-Type": "application/json", "X-DK-Deploy-Channel": "demo" },
  body: JSON.stringify({
    action: "notify",
    cpf: MARCUS_CPF,
    setor: "vendas",
    channel: "demo",
    body: "Você tem uma nova mensagem da DK",
  }),
});
record(
  "API notify responde",
  notify.status === 200 && typeof notify.data?.sent === "number",
  `sent=${notify.data?.sent} reason=${notify.data?.reason || "—"}`
);

const pushJs = await fetch(`${DEMO}/cliente-push-notificacoes.js?v=20260608push-notify`, {
  cache: "no-store",
}).then((r) => r.text());
record(
  "cliente-push-notificacoes.js no ar",
  pushJs.includes("__DK_clienteEnsurePushSubscription"),
  `${pushJs.length} bytes`
);

const comJs = await fetch(`${DEMO}/portal-comunicacao-operacao.js?v=20260608push-notify`, {
  cache: "no-store",
}).then((r) => r.text());
record(
  "portal dispara notify ao enviar mensagem DK",
  comJs.includes("notifyClientePushMensagem") && comJs.includes("dk-cliente-geo?push=1"),
  "notifyClientePushMensagem"
);

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.goto(`${DEMO}/#locadora/empresa`, { waitUntil: "networkidle", timeout: 90000 });
await page.waitForTimeout(3000);

const portalCheck = await page.evaluate(async (cpf) => {
  const headers = { "Content-Type": "application/json", "X-DK-Deploy-Channel": "demo" };
  const r = await fetch("/api/dk-cliente-geo?push=1", {
    method: "POST",
    headers,
    body: JSON.stringify({
      action: "notify",
      cpf,
      setor: "vendas",
      channel: "demo",
    }),
  });
  const data = await r.json().catch(() => ({}));
  return {
    hasNotifyFn: typeof window.__DK_comunicacaoOperacaoResponder === "function",
    notify: data,
  };
}, MARCUS_CPF);

record(
  "portal browser chama notify",
  portalCheck.notify && typeof portalCheck.notify.sent === "number",
  `sent=${portalCheck.notify?.sent}`
);

await browser.close();

const failed = results.filter((r) => !r.ok);
console.log(`\n--- ${results.length - failed.length}/${results.length} testes push ---`);
process.exit(failed.length ? 1 : 0);
