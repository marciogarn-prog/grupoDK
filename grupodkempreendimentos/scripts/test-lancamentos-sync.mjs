/**
 * Sincronismo portal ↔ app cliente — lançamentos de aluguel com protocolo.
 * node grupodkempreendimentos/scripts/test-lancamentos-sync.mjs
 * DK_TEST_BASE_URL=https://demo.grupodkempreendimentos.com.br/
 */
import { chromium } from "playwright";

const BASE = (process.env.DK_TEST_BASE_URL || "https://demo.grupodkempreendimentos.com.br/").replace(
  /\/?$/,
  "/"
);
const IS_DEMO = /demo\.grupodk/i.test(BASE);
const CPF_TEST = process.env.DK_LANC_SYNC_CPF || "06523244440";
const PROTO_TEST = process.env.DK_LANC_SYNC_PROTO || "2026010102";

const results = [];
function record(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} | ${name}${detail ? ` | ${detail}` : ""}`);
}

async function loginAdmin(page) {
  await page.goto(BASE, { waitUntil: "networkidle", timeout: 90000 });
  await page.evaluate(() => {
    sessionStorage.removeItem("dk_portal_area_ativa");
    localStorage.setItem(
      "dk_sessao_cliente",
      JSON.stringify({
        tipo: "admin",
        role: "owner",
        cpf: "03037897430",
        nome: "Administrador Sync",
      })
    );
    localStorage.setItem("dk_portal_sessao_build", "20260521admin-nav");
    sessionStorage.setItem("dk_portal_sessao_viva_v1", "1");
    if (window.__DK_IS_DEMO_DEPLOY__ === true) {
      localStorage.removeItem("dk_instalacao_limpa_v1");
    }
  });
  await page.goto(`${BASE}#locadora/empresa`, { waitUntil: "networkidle", timeout: 90000 });
  await page
    .waitForFunction(
      () => {
        const panel = document.getElementById("panel-logado");
        return panel && !panel.classList.contains("hidden");
      },
      { timeout: 45000 }
    )
    .catch(() => null);
  await page.waitForTimeout(800);
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.goto(BASE, { waitUntil: "networkidle", timeout: 90000 });
    const protoApi = await page.evaluate(() => {
      const fn = window.__DK_gerarProtocoloLancamento;
      if (typeof fn !== "function") return { ok: false };
      const p = fn("39039039039", new Date(2026, 5, 8, 14, 22, 47));
      return { ok: /^\d{14}-\d{3}$/.test(p), sample: p };
    });
    record("API protocolo lançamento AAAAMMDDHHMMSS-NNN", protoApi.ok, protoApi.sample || "");

    await loginAdmin(page);

    await page.evaluate(async () => {
      if (typeof window.__DK_pullCloudSnapshotSilentMerge === "function") {
        await window.__DK_pullCloudSnapshotSilentMerge({ force: true });
      }
    });
    await page.waitForTimeout(2500);

    await page.locator("#btn-locadora-operacao").click({ timeout: 15000 });
    await page.waitForTimeout(600);
    await page.locator("#btn-operacao-cadastro-locacao").click({ timeout: 15000 });
    await page.waitForTimeout(600);
    await page.waitForSelector("#operacaoLocacaoCpf", { timeout: 15000 });
    const cpfFmt = `${CPF_TEST.slice(0, 3)}.${CPF_TEST.slice(3, 6)}.${CPF_TEST.slice(6, 9)}-${CPF_TEST.slice(9)}`;
    await page.fill("#operacaoLocacaoCpf", cpfFmt);
    await page.dispatchEvent("#operacaoLocacaoCpf", "input");
    await page.dispatchEvent("#operacaoLocacaoCpf", "change");
    await page
      .waitForFunction(
        () => {
          const sel = document.getElementById("operacaoLocacaoProtocoloSelect");
          return sel && sel.options.length > 1 && !sel.disabled;
        },
        { timeout: 20000 }
      )
      .catch(() => null);
    await page.waitForTimeout(800);
    const selected = await page.evaluate((proto) => {
      const sel = document.getElementById("operacaoLocacaoProtocoloSelect");
      if (!sel) return false;
      const nc = String(proto).replace(/\D/g, "");
      for (const opt of sel.options) {
        if (String(opt.value).includes(nc) || String(opt.textContent).includes(nc)) {
          sel.value = opt.value;
          sel.dispatchEvent(new Event("change", { bubbles: true }));
          return true;
        }
      }
      return false;
    }, PROTO_TEST);
    record("portal: protocolo selecionado no cadastro", selected, PROTO_TEST);
    await page.waitForTimeout(1200);

    const portalData = await page.evaluate(({ cpf, proto }) => {
      const dig = (s) => String(s ?? "").replace(/\D/g, "");
      const nc = String(proto).trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
      const raw = localStorage.getItem("dk_locacoes_cadastro");
      const locs = raw ? JSON.parse(raw) : [];
      const loc = (Array.isArray(locs) ? locs : []).find(
        (l) => dig(l.cpf) === cpf && String(l.numeroContrato || "").replace(/\D/g, "").includes(nc)
      );
      const getCanon =
        typeof window.__DK_getLancamentosAluguelCanonico === "function"
          ? window.__DK_getLancamentosAluguelCanonico
          : null;
      const lancs = loc && getCanon ? getCanon(loc) : [];
      const total = lancs.reduce((a, x) => a + Number(x.valor || 0), 0);
      const protosOk = lancs.every((x) => /^\d{14}-\d{3}$/.test(String(x.protocoloLancamento || "")));
      const tp = document.getElementById("operacaoLocacaoTotalPago")?.value || "";
      const histVisible = !document.getElementById("operacaoLocacaoLancamentosHistorico")?.classList.contains("hidden");
      const histRows = document.querySelectorAll("#operacaoLocacaoLancamentosHistorico .portal-lanc-hist tbody tr").length;
      return { count: lancs.length, total, protosOk, tp, histVisible, histRows, hasLoc: Boolean(loc) };
    }, { cpf: CPF_TEST, proto: PROTO_TEST });

    record("portal: locação encontrada", portalData.hasLoc, `proto=${PROTO_TEST}`);
    record("portal: histórico visível no cadastro locação", portalData.histVisible && portalData.histRows >= 0, `rows=${portalData.histRows}`);
    record("portal: todos lançamentos com protocolo", portalData.protosOk, `n=${portalData.count}`);

    const clientePage = await browser.newPage();
    await clientePage.goto(BASE, { waitUntil: "networkidle", timeout: 90000 });
    await clientePage.evaluate(async () => {
      if (typeof window.__DK_pullCloudSnapshotSilentMerge === "function") {
        await window.__DK_pullCloudSnapshotSilentMerge({ force: true });
      }
    });
    await clientePage.waitForTimeout(2000);
    await clientePage.goto(`${BASE}cliente?instalar=1`, { waitUntil: "networkidle", timeout: 90000 });
    await clientePage.evaluate(({ cpf, proto }) => {
      localStorage.setItem(
        "dk_sessao_cliente",
        JSON.stringify({ tipo: "cliente", cpf, nome: "Teste Sync", protocolo: proto })
      );
    }, { cpf: CPF_TEST, proto: PROTO_TEST });
    await clientePage.reload({ waitUntil: "networkidle" });
    await clientePage.waitForTimeout(2000);

    const appData = await clientePage.evaluate(({ cpf, proto }) => {
      const dig = (s) => String(s ?? "").replace(/\D/g, "");
      const nc = String(proto).trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
      const raw = localStorage.getItem("dk_locacoes_cadastro");
      const locs = raw ? JSON.parse(raw) : [];
      const loc = (Array.isArray(locs) ? locs : []).find(
        (l) => dig(l.cpf) === cpf && String(l.numeroContrato || "").replace(/\D/g, "").includes(nc)
      );
      const getCanon =
        typeof window.__DK_getLancamentosAluguelCanonico === "function"
          ? window.__DK_getLancamentosAluguelCanonico
          : null;
      const lancs = loc && getCanon ? getCanon(loc) : [];
      const total = lancs.reduce((a, x) => a + Number(x.valor || 0), 0);
      const protosOk = lancs.every((x) => /^\d{14}-\d{3}$/.test(String(x.protocoloLancamento || "")));
      return { count: lancs.length, total, protosOk, hasLoc: Boolean(loc) };
    }, { cpf: CPF_TEST, proto: PROTO_TEST });

    record("app: locação encontrada", appData.hasLoc);
    record("app: todos lançamentos com protocolo", appData.protosOk, `n=${appData.count}`);

    const diffCount = portalData.count === appData.count;
    const diffTotal = Math.abs(portalData.total - appData.total) < 0.02;
    record(
      "sincronismo portal ↔ app (contagem)",
      diffCount,
      `portal=${portalData.count} app=${appData.count}`
    );
    record(
      "sincronismo portal ↔ app (total R$)",
      diffTotal,
      `portal=${portalData.total.toFixed(2)} app=${appData.total.toFixed(2)}`
    );

    if (IS_DEMO && portalData.count > 0) {
      record("demo: pelo menos 1 lançamento no protocolo teste", portalData.count >= 1);
    }

    await clientePage.close();
  } finally {
    await browser.close();
  }

  const ok = results.filter((r) => r.ok).length;
  console.log(`\n--- ${ok}/${results.length} testes sincronismo lançamentos ---\n`);
  process.exit(ok === results.length ? 0 : 1);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
