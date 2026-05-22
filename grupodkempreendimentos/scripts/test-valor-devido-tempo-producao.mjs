/**
 * Valor devido × tempo de locação — portal e app cliente alinhados.
 * node grupodkempreendimentos/scripts/test-valor-devido-tempo-producao.mjs
 */
import { chromium } from "playwright";

const BASE = (process.env.DK_TEST_BASE || "https://grupodkempreendimentos.com.br/").replace(
  /\/?$/,
  "/"
);
const OWNER_CPF = "03037897430";
const OWNER_SENHA = process.env.DK_OWNER_SENHA || "110499@Gb";
const JOSE_CPF = "19174403400";
const PROTO_JOSE = "2026010101";
const CLIENTE_SENHA = "123456";

const results = [];
function record(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} | ${name}${detail ? ` | ${detail}` : ""}`);
}

function parseBrl(s) {
  const cleaned = String(s ?? "")
    .replace(/[R$\s]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function parseBrDate(s) {
  const raw = String(s || "").trim();
  if (!raw.includes("/")) return null;
  const [d, m, y] = raw.split("/").map(Number);
  if (!d || !m || !y) return null;
  return new Date(y, m - 1, d);
}

function computeTempoDiasRef(loc) {
  const inicio = parseBrDate(loc.inicio);
  if (!inicio) return 0;
  const fim = parseBrDate(loc.fim);
  if (fim) {
    const t0 = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate()).getTime();
    const t1 = new Date(fim.getFullYear(), fim.getMonth(), fim.getDate()).getTime();
    return Math.max(1, Math.round((t1 - t0) / 86400000));
  }
  const start = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate());
  const today = new Date();
  const tToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.max(0, Math.round((tToday.getTime() - start.getTime()) / 86400000));
}

function expectedDevidoAluguel(loc) {
  const valLoc = parseBrl(loc.valorLocacao) || Number(loc.valorLocacao) || 0;
  const tempo = computeTempoDiasRef(loc);
  return { tempo, devido: tempo * (valLoc / 7), valLoc };
}

async function loginOwner(page) {
  await page.goto(`${BASE}#locadora/empresa/administrador`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1000);
  await page.locator("#login-cpf").fill(OWNER_CPF);
  await page.locator("#login-senha").fill(OWNER_SENHA);
  await page.locator("#form-login button[type=submit]").click();
  await page.waitForSelector("#panel-logado:not(.hidden)", { timeout: 20000 });
}

async function pullCloud(page) {
  await page.evaluate(async () => {
    if (typeof window.__DK_pullCloudSnapshotSilentMerge === "function") {
      await window.__DK_pullCloudSnapshotSilentMerge();
    }
  });
  await page.waitForTimeout(4000);
}

async function main() {
  const snap = await fetch(`${BASE}api/dk-cloud-snapshot`).then((r) => r.json());
  const locs = snap?.payload?.dk_locacoes_cadastro || [];
  const jose = locs.find(
    (l) =>
      String(l.cpf).replace(/\D/g, "") === JOSE_CPF &&
      String(l.numeroContrato || "").replace(/\W/g, "") === PROTO_JOSE
  );

  const synth = {
    inicio: "01/01/2026",
    fim: "",
    valorLocacao: "140",
    valorInvestimento: "0",
    numeroContrato: "TESTE_DEVIDO",
    cpf: JOSE_CPF,
  };
  const exp = expectedDevidoAluguel(synth);
  record(
    "fórmula Node: tempo×(valorLoc/7)",
    exp.tempo >= 140 && Math.abs(exp.devido - exp.tempo * 20) < 0.02,
    `tempo=${exp.tempo} devido=${exp.devido.toFixed(2)}`
  );

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await loginOwner(page);
    await pullCloud(page);

    await page.waitForFunction(
      () => typeof window.__DK_computePortalProtocoloResumoFromLoc === "function",
      { timeout: 60000 }
    );

    const portalCmp = await page.evaluate(({ synth }) => {
      const fn = window.__DK_computePortalProtocoloResumoFromLoc;
      const p = fn(synth);
      const parseB = (s) => {
        const n = Number(
          String(s ?? "")
            .replace(/[R$\s]/g, "")
            .replace(/\./g, "")
            .replace(",", ".")
        );
        return Number.isFinite(n) ? n : 0;
      };
      return { devAlug: parseB(p.valorDevidoAluguel) };
    }, { synth });

    record(
      "portal API: devido aluguel sintético",
      portalCmp.devAlug > 0 && Math.abs(portalCmp.devAlug - exp.devido) < 0.05,
      `api=${portalCmp.devAlug.toFixed(2)} esp=${exp.devido.toFixed(2)}`
    );

    if (jose) {
      const jRef = expectedDevidoAluguel({
        inicio: jose.inicio,
        fim: jose.fim,
        valorLocacao: jose.valorLocacao || "0",
      });
      record(
        "José nuvem: tempo ≥140 dias",
        jRef.tempo >= 140,
        `${jRef.tempo} dias`
      );
      const jPortal = await page.evaluate(
        ({ inicio, fim, valorLocacao, nc, cpf }) => {
          const loc = { inicio, fim, valorLocacao, numeroContrato: nc, cpf };
          const p = window.__DK_computePortalProtocoloResumoFromLoc(loc);
          const n = Number(
            String(p.valorDevidoAluguel || "")
              .replace(/[R$\s]/g, "")
              .replace(/\./g, "")
              .replace(",", ".")
          );
          return Number.isFinite(n) ? n : 0;
        },
        {
          inicio: jose.inicio,
          fim: jose.fim,
          valorLocacao: jose.valorLocacao || "0",
          nc: jose.numeroContrato,
          cpf: jose.cpf,
        }
      );
      if (!parseBrl(jose.valorLocacao)) {
        record(
          "José: valor locação vazio (devido aluguel R$0 até cadastrar)",
          jPortal === 0,
          "preencha Valor locação no portal"
        );
      } else {
        record(
          "José: devido aluguel portal coerente",
          Math.abs(jPortal - jRef.devido) < 0.05,
          `api=${jPortal} esp=${jRef.devido.toFixed(2)}`
        );
      }
    }

    const ctx = await browser.newContext();
    const appPage = await ctx.newPage();
    await appPage.goto(`${BASE}cliente?instalar=1&cpf=${JOSE_CPF}&proto=${PROTO_JOSE}`, {
      waitUntil: "domcontentloaded",
      timeout: 90000,
    });
    await appPage.waitForTimeout(2000);
    await pullCloud(appPage);
    await appPage.waitForFunction(
      () => typeof window.__DK_clienteComputeResumoContrato === "function",
      { timeout: 60000 }
    );

    const clienteSyn = await appPage.evaluate(({ synth }) => {
      const c = window.__DK_clienteComputeResumoContrato(synth);
      const parseB = (s) => {
        const n = Number(
          String(s ?? "")
            .replace(/[R$\s]/g, "")
            .replace(/\./g, "")
            .replace(",", ".")
        );
        return Number.isFinite(n) ? n : 0;
      };
      return {
        devAlug: parseB(c.valorDevidoAluguel),
        tempo: c.tempoLocacaoTexto,
      };
    }, { synth });

    record(
      "cliente API: devido aluguel = portal (sintético)",
      Math.abs(clienteSyn.devAlug - portalCmp.devAlug) < 0.05,
      `cliente=${clienteSyn.devAlug.toFixed(2)} portal=${portalCmp.devAlug.toFixed(2)}`
    );
    record(
      "cliente API: tempo sintético ~20 semanas",
      /20\s+semana/i.test(clienteSyn.tempo),
      clienteSyn.tempo
    );

    await appPage.locator("#login-cpf").fill(JOSE_CPF);
    await appPage.locator("#login-senha").fill(CLIENTE_SENHA);
    await appPage.locator("#form-login button[type=submit]").click();
    await appPage.waitForTimeout(8000);

    const appResumo = await appPage.evaluate(({ jose, proto }) => {
      const dig = (s) => String(s ?? "").replace(/\D/g, "").slice(0, 11);
      const norm = (s) => String(s ?? "").replace(/\W/g, "").toUpperCase();
      let locs = [];
      try {
        locs = JSON.parse(localStorage.getItem("dk_locacoes_cadastro") || "[]");
      } catch {
        /* ignore */
      }
      const loc = locs.find((l) => dig(l.cpf) === jose && norm(l.numeroContrato) === proto);
      if (!loc || typeof window.__DK_clienteComputeResumoContrato !== "function") {
        return { err: "loc ou API" };
      }
      const r = window.__DK_clienteComputeResumoContrato(loc);
      const appHidden = document.getElementById("view-app")?.classList.contains("hidden");
      const html = document.getElementById("view-app")?.innerHTML || "";
      const inner = document.getElementById("view-app")?.innerText || "";
      return {
        appHidden,
        tempo: r.tempoLocacaoTexto,
        devido: r.valorDevidoTexto,
        devidoNoPainel: /Valor devido\s*\(estimado\)/i.test(inner) && /R\$\s*[\d.,]+/i.test(inner),
      };
    }, { jose: JOSE_CPF, proto: PROTO_JOSE });

    record("app José: entrou na view-app", !appResumo.appHidden);
    record(
      "app José: tempo locação (API)",
      /semana|dia/i.test(appResumo.tempo || ""),
      appResumo.tempo
    );
    record(
      "app José: tempo ~20 semanas e 1 dia",
      /20\s+semana.*1\s+dia/i.test(appResumo.tempo || ""),
      appResumo.tempo
    );
    record(
      "app José: valor devido estimado no painel",
      appResumo.devidoNoPainel,
      appResumo.devido
    );
    await ctx.close();

    await page.locator("text=Operação").first().click();
    await page.waitForTimeout(500);
    await page.locator("text=Cadastro de locação").first().click();
    await page.waitForTimeout(800);

    const cpfIn = page.locator("#operacaoLocacaoCpf");
    await cpfIn.fill(JOSE_CPF);
    await cpfIn.dispatchEvent("input", { bubbles: true });
    await page.waitForTimeout(1500);

    const sel = page.locator("#operacaoLocacaoProtocoloSelect");
    const optCount = await sel.locator(`option[value="${PROTO_JOSE}"]`).count();
    if (optCount) {
      await sel.selectOption(PROTO_JOSE);
      await page.waitForTimeout(2000);
      const form = await page.evaluate(() => ({
        tempo: document.getElementById("operacaoLocacaoTempoDias")?.value || "",
        devAlug: document.getElementById("operacaoLocacaoValorDevidoAluguel")?.value || "",
        valLoc: document.getElementById("operacaoLocacaoValorAluguel")?.value || "",
      }));
      const tempoNum = Number.parseInt(form.tempo, 10) || 0;
      record("portal form: tempo dias", tempoNum >= 140, form.tempo);
      const locNum = parseBrl(form.valLoc);
      if (locNum > 0) {
        const devNum = parseBrl(form.devAlug);
        const esperado = tempoNum * (locNum / 7);
        record(
          "portal form: devido = tempo×(loc/7)",
          Math.abs(devNum - esperado) < 0.05,
          `${form.devAlug} esp=${esperado.toFixed(2)}`
        );
      } else {
        record("portal form: valor locação vazio", true, form.valLoc || "(vazio)");
      }
    } else {
      const opts = await sel.evaluate((el) =>
        [...el.options].map((o) => o.value).filter(Boolean).slice(0, 8)
      );
      record("portal form: protocolo José no select", false, opts.join(", "));
    }
  } catch (e) {
    record("E2E exceção", false, e.message || String(e));
  } finally {
    await browser.close();
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n--- ${results.length - failed.length}/${results.length} (${BASE}) ---`);
  if (failed.length) {
    console.log("Falhas:", failed.map((f) => f.name).join(", "));
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
