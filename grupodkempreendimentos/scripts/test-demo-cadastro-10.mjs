/**
 * Verifica demo na nuvem: exactamente 10 clientes, 10 veículos, 10 locações activas.
 * node grupodkempreendimentos/scripts/test-demo-cadastro-10.mjs
 */
import { chromium } from "playwright";

const BASE = "https://demo.grupodkempreendimentos.com.br/";
const REDIS_DEMO_URL = "https://grupodkempreendimentos.com.br/api/dk-cloud-snapshot?channel=demo";

const PROTOCOLOS = [
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

const results = [];
function record(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} | ${name}${detail ? ` | ${detail}` : ""}`);
}

const nc = (v) => String(v || "").replace(/\D/g, "");
const nk = (v) =>
  String(v || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");

async function verifyCloud() {
  const res = await fetch(REDIS_DEMO_URL);
  const data = await res.json();
  const p = data.payload || {};
  const clientes = p.dk_clientes_cadastro || [];
  const veiculos = p.dk_veiculos_cadastro || [];
  const locs = p.dk_locacoes_cadastro || [];
  const ativas = locs.filter((l) => {
    const fim = String(l.fim || l.dataFim || "").trim();
    return !fim || fim === "...";
  });

  record("nuvem: 10 clientes", clientes.length === 10, `count=${clientes.length}`);
  record("nuvem: 10 veículos", veiculos.length === 10, `count=${veiculos.length}`);
  record("nuvem: 10 locações", locs.length === 10, `count=${locs.length}`);
  record("nuvem: 10 locações activas", ativas.length === 10, `ativas=${ativas.length}`);

  const prs = new Set(locs.map((l) => nc(l.numeroContrato)));
  const allPrs = PROTOCOLOS.every((pr) => prs.has(pr));
  record("nuvem: 10 protocolos da imagem", allPrs, PROTOCOLOS.filter((pr) => !prs.has(pr)).join(",") || "ok");

  const todosAtivos = locs.every((l) => {
    const fim = String(l.fim || l.dataFim || "").trim();
    const st = String(l.statusLocacao || "").toUpperCase();
    return (!fim || fim === "...") && st !== "FINALIZADO";
  });
  record("nuvem: todos protocolos ATIVO", todosAtivos);
}

async function verifyBrowser() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.on("dialog", (d) => d.accept().catch(() => null));

  try {
    await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 120000 });
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
      localStorage.setItem(
        "dk_sessao_cliente",
        JSON.stringify({ tipo: "admin", role: "owner", cpf: "03037897430", nome: "Admin Teste 10" })
      );
      sessionStorage.setItem("dk_portal_sessao_viva_v1", "1");
    });
    await page.goto(`${BASE}#locadora/empresa`, { waitUntil: "domcontentloaded", timeout: 120000 });
    await page.waitForTimeout(8000);

    const pulled = await page.evaluate(() => {
      const c = loadCadastro(CAD_CLIENTES_KEY).length;
      const v = loadCadastro(CAD_VEICULOS_KEY).length;
      const l = loadCadastro(CAD_LOCACOES_KEY).length;
      const active = loadCadastro(CAD_LOCACOES_KEY).filter((x) => {
        const fim = String(x.fim || x.dataFim || "").trim();
        return !fim || fim === "...";
      }).length;
      return { c, v, l, active };
    });
    record("browser pós-sync: 10 clientes", pulled.c === 10, `count=${pulled.c}`);
    record("browser pós-sync: 10 veículos", pulled.v === 10, `count=${pulled.v}`);
    record("browser pós-sync: 10 locações", pulled.l === 10, `count=${pulled.l}`);
    record("browser pós-sync: 10 activas", pulled.active === 10, `ativas=${pulled.active}`);
  } finally {
    await browser.close();
  }
}

await verifyCloud();
await verifyBrowser();

const failed = results.filter((r) => !r.ok).length;
const passed = results.filter((r) => r.ok).length;
console.log(`\n--- ${passed}/${results.length} testes passaram ---`);
process.exit(failed ? 1 : 0);
