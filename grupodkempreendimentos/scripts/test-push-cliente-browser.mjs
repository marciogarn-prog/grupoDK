import { chromium } from "playwright";

const BASE = "https://demo.grupodkempreendimentos.com.br/";
const CPF = "06523244440";

const beforeCloud = await fetch(`${BASE.replace(/\/$/, "")}/api/dk-cloud-snapshot?channel=demo`).then((r) =>
  r.json()
);
const beforeIds = new Set((beforeCloud.payload?.dk_comunicacao_operacao_v1 || []).map((m) => m.id));

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

await page.goto(`${BASE}cliente?instalar=1`, { waitUntil: "networkidle", timeout: 120000 });

const setup = await page.evaluate(({ cpf }) => {
  localStorage.setItem(
    "dk_sessao_cliente_app",
    JSON.stringify({ cpf, nome: "MARCUS VINICIUS SIQUEIRA DOS SANTOS", loginEm: new Date().toISOString() })
  );
  localStorage.setItem(
    "dk_locacoes_cadastro",
    JSON.stringify([
      {
        cpf,
        nome: "MARCUS VINICIUS SIQUEIRA DOS SANTOS",
        numeroContrato: "2026010102",
        placa: "BBB0B00",
        fim: "",
        statusLocacao: "ATIVO",
      },
    ])
  );
  return {
    isDemo: window.__DK_IS_DEMO_DEPLOY__,
    label: window.__DK_deploySnapshotLabel?.(),
    hasPush: typeof window.__DK_pushComunicacaoSnapshotNow === "function",
    hasEnviar: typeof window.__DK_comunicacaoClienteEnviar === "function",
  };
}, { cpf: CPF });

await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(4000);

const send = await page.evaluate(({ cpf }) => {
  const texto = `browser-push-${Date.now()}`;
  const fn = window.__DK_comunicacaoClienteEnviarNuvem || window.__DK_comunicacaoClienteEnviar;
  const r = fn?.({
    cpf,
    nome: "MARCUS VINICIUS SIQUEIRA DOS SANTOS",
    placa: "BBB0B00",
    setor: "vendas",
    texto,
  });
  return Promise.resolve(r).then((out) => ({ out, texto }));
}, { cpf: CPF });

await page.waitForTimeout(500);

const push = send.out?.push || (await page.evaluate(async () => {
  if (typeof window.__DK_pushComunicacaoSnapshotNow !== "function") return { err: "no push fn" };
  return window.__DK_pushComunicacaoSnapshotNow();
}));

const textoEnviado = send.texto;
const recId = send.out?.rec?.id || send.out?.out?.rec?.id;

await page.waitForTimeout(2000);

const afterCloud = await fetch(`${BASE.replace(/\/$/, "")}/api/dk-cloud-snapshot?channel=demo`).then((r) =>
  r.json()
);
const afterArr = afterCloud.payload?.dk_comunicacao_operacao_v1 || [];
const newMsgs = afterArr.filter(
  (m) => (!beforeIds.has(m.id) || m.id === recId) && m.texto === textoEnviado
);

console.log(JSON.stringify({ setup, send: send.out, push, newInCloud: newMsgs.length, texto: textoEnviado }, null, 2));
await browser.close();
process.exit(newMsgs.length > 0 && (push?.ok || send.out?.push?.ok) ? 0 : 1);
