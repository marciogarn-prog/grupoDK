/**
 * E2E oficial: simula navegador poluído (clientes de planilha no localStorage),
 * carrega o site e verifica que a purga com data de corte limpa tudo:
 * - clientes antigos removidos (Cód. volta a CLIENTE 1)
 * - dropdown de CPF no cadastro de locação sem clientes antigos
 * - nuvem oficial sem cadastros
 * node grupodkempreendimentos/scripts/test-oficial-corte-limpo.mjs
 */
import { chromium } from "playwright";

const BASE_URL = "https://grupodkempreendimentos.com.br/";

const results = [];
function record(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} | ${name}${detail ? ` | ${detail}` : ""}`);
}

const POLUICAO_CLIENTES = Array.from({ length: 22 }, (_, i) => ({
  id: 1765000000 + i,
  cpf: String(10000000000 + i * 7),
  nome: `CLIENTE PLANILHA ${i + 1}`,
  codigo: `CLIENTE ${i + 1}`,
  status: "ATIVO",
  updatedAt: Date.now(),
  dataCadastro: "sex 09/01/2026",
  origemPlanilha: true,
}));

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

try {
  // nuvem oficial limpa?
  const cloud = await fetch(`${BASE_URL}api/dk-cloud-snapshot`).then((r) => r.json());
  const cp = cloud?.payload || {};
  /* funcionários (logins) e audit log (registo operacional) não são poluição de cadastro */
  const IGNORAR = new Set(["dk_funcionarios_access", "dk_audit_log"]);
  const sujos = Object.keys(cp).filter(
    (k) => Array.isArray(cp[k]) && cp[k].length && !IGNORAR.has(k)
  );
  record("nuvem oficial sem cadastros", sujos.length === 0, sujos.join(",") || "limpa");

  // 1ª visita: injetar poluição ANTES dos scripts (sessão admin + clientes planilha)
  await page.goto(BASE_URL, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.evaluate((clientes) => {
    localStorage.setItem("dk_clientes_cadastro", JSON.stringify(clientes));
    localStorage.setItem(
      "dk_sessao_cliente",
      JSON.stringify({ tipo: "admin", role: "owner", cpf: "03037897430", nome: "Administrador E2E" })
    );
    localStorage.setItem("dk_portal_sessao_build", "20260521admin-nav");
    sessionStorage.setItem("dk_portal_sessao_viva_v1", "1");
  }, POLUICAO_CLIENTES);

  // 2ª visita: reload completo — a purga corre no arranque do app.js
  await page.goto(`${BASE_URL}#locadora/empresa`, { waitUntil: "networkidle", timeout: 90000 });
  await page.reload({ waitUntil: "networkidle", timeout: 90000 });
  await page
    .waitForFunction(
      () => {
        try {
          return JSON.parse(localStorage.getItem("dk_clientes_cadastro") || "[]").length === 0;
        } catch {
          return false;
        }
      },
      { timeout: 20000 }
    )
    .catch(() => null);

  const aposPurga = await page.evaluate(() => {
    let clientes = [];
    try {
      clientes = JSON.parse(localStorage.getItem("dk_clientes_cadastro") || "[]");
    } catch {
      clientes = [];
    }
    return {
      clientes: clientes.length,
      cutoff: window.__DK_OFICIAL_CUTOFF_YMD || null,
      guardAtivo:
        typeof window.__DK_isOficialCadastroGuardActive === "function"
          ? window.__DK_isOficialCadastroGuardActive()
          : null,
    };
  });
  record(
    "purga remove clientes de planilha no arranque",
    aposPurga.clientes === 0,
    `restaram=${aposPurga.clientes} cutoff=${aposPurga.cutoff} guard=${aposPurga.guardAtivo}`
  );

  // painel logado + cadastro de cliente: código deve ser CLIENTE 1
  await page.waitForFunction(
    () => {
      const panel = document.getElementById("panel-logado");
      const btnOp = document.getElementById("btn-locadora-operacao");
      return panel && !panel.classList.contains("hidden") && btnOp && !btnOp.classList.contains("hidden");
    },
    { timeout: 45000 }
  ).catch(() => null);
  await page.click("#btn-locadora-operacao").catch(() => {});
  await page.waitForTimeout(1200);

  const btnCliente = page.locator("#btn-operacao-cadastro-cliente, .btn-operacao-cmd", { hasText: "Cadastro de cliente" }).first();
  if (await btnCliente.isVisible().catch(() => false)) {
    await btnCliente.click();
    await page.waitForTimeout(1000);
  }
  const cpfNovo = page.locator("#operacaoClienteCpf");
  if (await cpfNovo.isVisible().catch(() => false)) {
    await cpfNovo.fill("111.444.777-35");
    await cpfNovo.dispatchEvent("input");
    await page.waitForTimeout(1500);
  }
  const codigoCliente = await page.evaluate(() => {
    const el = document.getElementById("operacaoClienteCodigo");
    return el ? el.value : null;
  });
  record(
    "novo cadastro começa em CLIENTE 1",
    codigoCliente === "CLIENTE 1",
    `codigo=${codigoCliente}`
  );

  // cadastro de locação: dropdown de CPF sem clientes antigos
  const btnLocacao = page.locator("#btn-operacao-cadastro-locacao");
  if (await btnLocacao.isVisible().catch(() => false)) {
    await btnLocacao.click();
    await page.waitForTimeout(1000);
  }
  const sugestoes = await page.evaluate(() => {
    const dl = document.getElementById("operacaoLocacaoCpfSugestoes");
    return dl ? dl.querySelectorAll("option").length : 0;
  });
  record("dropdown CPF de locação vazio", sugestoes === 0, `sugestoes=${sugestoes}`);

  // inverso: cadastro de hoje (>= corte) tem de SOBREVIVER ao filtro
  const sobrevive = await page.evaluate(() => {
    if (typeof window.__DK_filterOficialCadastroArray !== "function") return null;
    const hojeBr = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo" }).format(new Date());
    const novo = [
      { id: 1, cpf: "11144477735", nome: "CLIENTE NOVO", codigo: "CLIENTE 1", dataCadastro: `ter ${hojeBr}` },
      { id: 2, cpf: "22255588846", nome: "SEM DATA BR", createdAt: Date.now() },
    ];
    const antigos = [
      { id: 3, cpf: "33366699957", nome: "ANTIGO", dataCadastro: "sex 09/01/2026", updatedAt: Date.now() },
      { id: 4, cpf: "44477700068", nome: "PLANILHA", dataCadastro: `ter ${hojeBr}`, origemPlanilha: true },
    ];
    const out = window.__DK_filterOficialCadastroArray("dk_clientes_cadastro", [...novo, ...antigos]);
    return { mantidos: out.map((r) => r.id), total: out.length };
  });
  record(
    "cadastro de hoje sobrevive ao corte (e antigos/planilha caem)",
    Boolean(sobrevive) && sobrevive.total === 2 && sobrevive.mantidos.includes(1) && sobrevive.mantidos.includes(2),
    JSON.stringify(sobrevive)
  );
} catch (e) {
  record("erro inesperado", false, String(e?.message || e).slice(0, 200));
} finally {
  await browser.close();
}

const ok = results.filter((r) => r.ok).length;
console.log(`\n--- ${ok}/${results.length} ---`);
process.exit(ok === results.length ? 0 : 1);
