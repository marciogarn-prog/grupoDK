/**
 * Demo: só os 10 clientes, 10 veículos e 10 protocolos da imagem Locados.
 * Percorre nuvem, cadastros locais e cada tela operacional + MIEL.
 * node grupodkempreendimentos/scripts/test-demo-cadastro-10.mjs
 */
import { chromium } from "playwright";

const BASE = "https://demo.grupodkempreendimentos.com.br/";
const REDIS_DEMO_URL = "https://grupodkempreendimentos.com.br/api/dk-cloud-snapshot?channel=demo";

const ALLOWED_PRS = new Set([
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
]);
const ALLOWED_PLATES = new Set([
  "UHQ1B38",
  "UHQ1B08",
  "SOR1I03",
  "SOU2I56",
  "UHQ1C68",
  "UHR0G21",
  "UHQ8D58",
  "UHQ1E58",
  "UHR0E91",
  "UHQ8G38",
]);
const ALLOWED_CPFS = new Set([
  "06843309461",
  "09505434464",
  "11512850489",
  "07534147409",
  "05705186444",
  "03793589307",
  "07795468497",
  "07771412564",
  "08350435410",
  "70274179440",
]);
const STAFF_CPFS = new Set(["03037897430"]);

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
const dig = (v) => String(v || "").replace(/\D/g, "").slice(0, 11);

function extrasFromList(list, pick, allowed, kind) {
  const found = new Set();
  (list || []).forEach((row) => {
    const v = pick(row);
    if (v && !allowed.has(v)) found.add(v);
  });
  return { ok: found.size === 0, detail: found.size ? [...found].slice(0, 12).join(",") : `ok (${kind})` };
}

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
  record("nuvem: flag demo-10", Boolean(p.dk_demo_cadastro_10_v1), String(p.dk_demo_cadastro_10_v1 || ""));
  record("nuvem: lock activo", Date.parse(p.dk_cadastro_lock_v1 || "") > Date.now(), String(p.dk_cadastro_lock_v1 || ""));

  const prs = new Set(locs.map((l) => nc(l.numeroContrato)));
  record(
    "nuvem: protocolos da imagem",
    [...ALLOWED_PRS].every((pr) => prs.has(pr)) && prs.size === 10,
    [...prs].join(",")
  );

  const extraC = extrasFromList(clientes, (c) => dig(c.cpf), ALLOWED_CPFS, "cpf");
  record("nuvem: sem cliente extra", extraC.ok, extraC.detail);
  const extraV = extrasFromList(veiculos, (v) => nk(v.placa), ALLOWED_PLATES, "placa");
  record("nuvem: sem veículo extra", extraV.ok, extraV.detail);
  const extraL = extrasFromList(locs, (l) => nc(l.numeroContrato), ALLOWED_PRS, "protocolo");
  record("nuvem: sem protocolo extra", extraL.ok, extraL.detail);

  const extraManut = extrasFromList(p.dk_manutencoes_cadastro, (m) => nk(m.placa), ALLOWED_PLATES, "manut");
  record("nuvem: manutenções sem placa extra", extraManut.ok && (p.dk_manutencoes_cadastro || []).length === 0, `n=${(p.dk_manutencoes_cadastro || []).length}`);
  record("nuvem: comunicação vazia", (p.dk_comunicacao_operacao_v1 || []).length === 0, `n=${(p.dk_comunicacao_operacao_v1 || []).length}`);
}

async function loginEmpresa(page) {
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
}

async function scrapeVisibleTokens(page) {
  return page.evaluate(() => {
    const text = document.body?.innerText || "";
    const placas = [...text.matchAll(/\b([A-Z]{3}\d[A-Z0-9]\d{2})\b/gi)].map((m) =>
      String(m[1]).toUpperCase().replace(/[^A-Z0-9]/g, "")
    );
    const cpfs = [...text.matchAll(/\b(\d{3}\.?\d{3}\.?\d{3}-?\d{2})\b/g)].map((m) =>
      String(m[1]).replace(/\D/g, "").slice(0, 11)
    );
    const prs = [...text.matchAll(/\b(20\d{8})\b/g)].map((m) => m[1]);
    const dataPlacas = [...document.querySelectorAll("[data-placa]")].map((el) =>
      String(el.getAttribute("data-placa") || "")
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "")
    );
    return { placas: [...new Set([...placas, ...dataPlacas])], cpfs: [...new Set(cpfs)], prs: [...new Set(prs)] };
  });
}

function assertTokens(label, tokens) {
  const extraPlates = (tokens.placas || []).filter((p) => p.length === 7 && !ALLOWED_PLATES.has(p));
  const extraCpfs = (tokens.cpfs || []).filter((c) => c.length === 11 && !ALLOWED_CPFS.has(c) && !STAFF_CPFS.has(c));
  const extraPrs = (tokens.prs || []).filter((p) => p.length === 10 && !ALLOWED_PRS.has(p));
  record(`${label}: sem placa extra`, extraPlates.length === 0, extraPlates.slice(0, 8).join(",") || "ok");
  record(`${label}: sem CPF extra`, extraCpfs.length === 0, extraCpfs.slice(0, 8).join(",") || "ok");
  record(`${label}: sem protocolo extra`, extraPrs.length === 0, extraPrs.slice(0, 8).join(",") || "ok");
}

async function clickIfVisible(page, selector) {
  const loc = page.locator(selector).first();
  if ((await loc.count()) === 0) return false;
  await loc.click({ timeout: 8000 }).catch(() => null);
  await page.waitForTimeout(500);
  return true;
}

async function verifyBrowserScreens(page) {
  const pulled = await page.evaluate(() => {
    const nk = (p) =>
      String(p || "")
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "");
    const dig = (v) => String(v || "").replace(/\D/g, "").slice(0, 11);
    const nc = (v) => String(v || "").replace(/\D/g, "");
    const c = loadCadastro(CAD_CLIENTES_KEY);
    const v = loadCadastro(CAD_VEICULOS_KEY);
    const l = loadCadastro(CAD_LOCACOES_KEY);
    const m = typeof CAD_MANUTENCOES_KEY !== "undefined" ? loadCadastro(CAD_MANUTENCOES_KEY) : [];
    const active = l.filter((x) => {
      const fim = String(x.fim || x.dataFim || "").trim();
      return !fim || fim === "...";
    });
    return {
      c: c.length,
      v: v.length,
      l: l.length,
      active: active.length,
      m: m.length,
      cpfs: c.map((x) => dig(x.cpf)),
      placas: v.map((x) => nk(x.placa)),
      prs: l.map((x) => nc(x.numeroContrato)),
      extraKeys: (() => {
        const extras = [];
        const keys = [
          "dk_portal_clientes_cadastro",
          "dk_portal_veiculos_cadastro",
          "dk_comunicacao_operacao_v1",
          "dk_comprovantes_cliente_pendentes",
          "dk_locacao_documentos_v1",
        ];
        keys.forEach((k) => {
          try {
            const raw = localStorage.getItem(k);
            const arr = raw ? JSON.parse(raw) : [];
            if (Array.isArray(arr) && arr.length) extras.push(`${k}=${arr.length}`);
          } catch {
            /* ignore */
          }
        });
        return extras;
      })(),
    };
  });

  record("browser: 10 clientes", pulled.c === 10, `count=${pulled.c}`);
  record("browser: 10 veículos", pulled.v === 10, `count=${pulled.v}`);
  record("browser: 10 locações", pulled.l === 10, `count=${pulled.l}`);
  record("browser: 10 activas", pulled.active === 10, `ativas=${pulled.active}`);
  record(
    "browser: CPFs só os 10",
    pulled.cpfs.every((c) => ALLOWED_CPFS.has(c)) && pulled.cpfs.length === 10,
    pulled.cpfs.filter((c) => !ALLOWED_CPFS.has(c)).join(",")
  );
  record(
    "browser: placas só as 10",
    pulled.placas.every((p) => ALLOWED_PLATES.has(p)) && pulled.placas.length === 10,
    pulled.placas.filter((p) => !ALLOWED_PLATES.has(p)).join(",")
  );
  record(
    "browser: protocolos só os 10",
    pulled.prs.every((p) => ALLOWED_PRS.has(p)) && pulled.prs.length === 10,
    pulled.prs.filter((p) => !ALLOWED_PRS.has(p)).join(",")
  );
  record("browser: chaves laterais vazias", pulled.extraKeys.length === 0, pulled.extraKeys.join("; "));

  await clickIfVisible(page, "#btn-locadora-manutencao");
  const locadoSubs = ["#btn-locado-sub-minha-moto", "#btn-locado-sub-meu-transporte", "#btn-locado-sub-carros"];
  await clickIfVisible(page, "#btn-manutencao-locados");
  for (const sel of locadoSubs) {
    await clickIfVisible(page, sel);
    assertTokens(`tela Locados ${sel.replace("#btn-locado-sub-", "")}`, await scrapeVisibleTokens(page));
  }

  const dispSubs = [
    "#btn-disp-sub-prontos",
    "#btn-disp-sub-reserva-operacao",
    "#btn-disp-sub-reserva-patio",
  ];
  await clickIfVisible(page, "#btn-manutencao-disponiveis");
  for (const sel of dispSubs) {
    if (sel.includes("reserva")) await clickIfVisible(page, "#btn-disp-sub-reserva");
    await clickIfVisible(page, sel);
    assertTokens(`tela Disponíveis ${sel.replace("#btn-disp-sub-", "")}`, await scrapeVisibleTokens(page));
  }

  const manutSubs = [
    "#btn-manut-sub-triagem",
    "#btn-manut-sub-oficina-propria",
    "#btn-manut-sub-oficina-terceiros",
    "#btn-manut-sub-enviado-seguro",
    "#btn-manut-sub-sinistrado-roubo",
  ];
  await clickIfVisible(page, "#btn-manutencao-em-manutencao");
  for (const sel of manutSubs) {
    await clickIfVisible(page, sel);
    assertTokens(`tela Manutenção ${sel.replace("#btn-manut-sub-", "")}`, await scrapeVisibleTokens(page));
  }

  await clickIfVisible(page, "#btn-voltar-manutencao-locadora");
  await clickIfVisible(page, "#btn-locadora-operacao");
  for (const sel of [
    "#btn-operacao-cadastro-cliente",
    "#btn-operacao-cadastro-veiculo",
    "#btn-operacao-cadastro-locacao",
    "#btn-operacao-lancamento-aluguel",
    "#btn-operacao-falar-cliente",
  ]) {
    await clickIfVisible(page, sel);
    assertTokens(`tela Operação ${sel.replace("#btn-operacao-", "")}`, await scrapeVisibleTokens(page));
  }

  await clickIfVisible(page, "#btn-voltar-operacao-locadora");
  await clickIfVisible(page, "#btn-locadora-localizacao");
  assertTokens("tela Localização", await scrapeVisibleTokens(page));
  await clickIfVisible(page, "#btn-voltar-localizacao-locadora");
  await clickIfVisible(page, "#btn-locadora-documentos");
  assertTokens("tela Documentos", await scrapeVisibleTokens(page));
  await clickIfVisible(page, "#btn-voltar-documentos-locadora");

  await clickIfVisible(page, "#btn-locadora-preview-cliente");
  await clickIfVisible(page, "#portal-admin-cliente-cpf");
  await page.waitForTimeout(400);
  assertTokens("tela Pré-visualizar CPF", await scrapeVisibleTokens(page));
}

async function verifyMiel(page) {
  await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.evaluate(() => {
    localStorage.setItem(
      "dk_sessao_cliente",
      JSON.stringify({ tipo: "admin", role: "owner", cpf: "03037897430", nome: "Admin Teste 10" })
    );
    sessionStorage.setItem("dk_portal_sessao_viva_v1", "1");
  });
  await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForTimeout(1500);
  const mielBtn = page.locator('#view-home [data-go="miel"]').first();
  await mielBtn.click({ timeout: 15000 });
  await page.waitForTimeout(800);

  const mielData = await page.evaluate(() => {
    const d = window.__DK_MIEL_CADASTROS || {};
    const nk = (p) =>
      String(p || "")
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "");
    const dig = (v) => String(v || "").replace(/\D/g, "").slice(0, 11);
    const nc = (v) => String(v || "").replace(/\D/g, "");
    return {
      c: (d.clientes || []).length,
      v: (d.veiculos || []).length,
      l: (d.locacoes || []).length,
      plates: (d.veiculos || []).map((x) => nk(x.placa)),
      cpfs: (d.clientes || []).map((x) => dig(x.cnpjCpf || x.cpf)),
      prs: (d.locacoes || []).map((x) => nc(x.protocolo)),
    };
  });
  record("MIEL dados: ≤10 clientes", mielData.c <= 10, `count=${mielData.c}`);
  record("MIEL dados: ≤10 veículos", mielData.v <= 10, `count=${mielData.v}`);
  record(
    "MIEL dados: placas só as 10",
    mielData.plates.every((p) => !p || ALLOWED_PLATES.has(p)),
    mielData.plates.filter((p) => p && !ALLOWED_PLATES.has(p)).join(",")
  );
  record(
    "MIEL dados: CPFs só os 10",
    mielData.cpfs.every((c) => !c || ALLOWED_CPFS.has(c)),
    mielData.cpfs.filter((c) => c && !ALLOWED_CPFS.has(c)).join(",")
  );
  record(
    "MIEL dados: protocolos só os 10",
    mielData.prs.every((p) => !p || ALLOWED_PRS.has(p)),
    mielData.prs.filter((p) => p && !ALLOWED_PRS.has(p)).join(",")
  );

  await clickIfVisible(page, '[data-miel-nav="administrativo"]');
  await page.waitForTimeout(400);
  for (const label of ["Cadastro de Clientes", "Cadastro de Veículos", "Relação de Clientes", "Relação de Veículos"]) {
    const btn = page.locator(`#view-miel button:has-text("${label}")`).first();
    if ((await btn.count()) > 0) {
      await btn.click({ timeout: 8000 }).catch(() => null);
      await page.waitForTimeout(700);
      assertTokens(`MIEL ${label}`, await scrapeVisibleTokens(page));
      await clickIfVisible(page, '[data-miel-nav="administrativo"]');
      await page.waitForTimeout(300);
    }
  }
}

await verifyCloud();

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.on("dialog", (d) => d.accept().catch(() => null));
try {
  await loginEmpresa(page);
  await verifyBrowserScreens(page);
  await verifyMiel(page);
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r.ok).length;
const passed = results.filter((r) => r.ok).length;
console.log(`\n--- ${passed}/${results.length} testes passaram ---`);
process.exit(failed ? 1 : 0);
