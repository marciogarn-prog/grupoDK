/**
 * Data limite da devolução de investimento: 40 dias corridos após o fim do contrato.
 * node grupodkempreendimentos/scripts/test-data-limite-devolucao.mjs
 * Opcional: DK_TEST_BASE_URL=http://127.0.0.1:3000/
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const results = [];

function record(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} | ${name}${detail ? ` | ${detail}` : ""}`);
}

function readLocal(rel) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

function somarDiasCorridos(date, dias) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() + Number(dias));
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
}

function portalPainelLimiteDevolucaoState(valor, dataLimiteBr) {
  if (!(Number(valor) > 0.009)) {
    return { modo: "sem", texto: "NÃO EXISTE DEVOLUÇÃO" };
  }
  return {
    modo: "com",
    titulo: "DATA LIMITE",
    data: String(dataLimiteBr || "").trim() || "—",
  };
}

function assertEq(name, got, expected) {
  const ok = got === expected;
  record(name, ok, ok ? String(got) : `obtido=${JSON.stringify(got)} esperado=${JSON.stringify(expected)}`);
}

async function withLocalServer(fn) {
  const requested = String(process.env.DK_TEST_BASE_URL || "").trim();
  if (requested) {
    await fn(requested.replace(/\/?$/, "/"));
    return;
  }
  const { spawn } = await import("child_process");
  const port = 3040;
  const child = spawn(process.execPath, ["server.cjs"], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(port) },
    stdio: ["ignore", "pipe", "pipe"],
  });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, 700);
    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
  try {
    await fn(`http://127.0.0.1:${port}/`);
  } finally {
    child.kill("SIGTERM");
  }
}

async function main() {
  const html = readLocal("index.html");
  const css = readLocal("styles.css");
  const js = readLocal("portal-locadora-ui.js");

  record(
    "HTML tem o espaço da data limite ao lado do valor",
    html.includes('id="operacaoLancAluguelDevolucaoLimiteBox"') &&
      html.includes("portal-lanc-devolucao-valor-com-limite") &&
      /operacaoLancAluguelValorDevolucao[\s\S]{0,800}operacaoLancAluguelDevolucaoLimiteBox/.test(html)
  );
  record("HTML texto NÃO EXISTE DEVOLUÇÃO", html.includes("NÃO EXISTE DEVOLUÇÃO"));
  record("CSS posiciona o aviso à direita do valor", css.includes(".portal-lanc-devolucao-valor-com-limite"));
  record("JS prazo de 40 dias corridos", js.includes("PORTAL_PRAZO_DEVOLUCAO_DIAS_CORRIDOS = 40"));
  record("JS texto DATA LIMITE", js.includes('titulo: "DATA LIMITE"'));
  record("JS texto NÃO EXISTE DEVOLUÇÃO", js.includes('texto: "NÃO EXISTE DEVOLUÇÃO"'));
  record(
    "Sugestão de devolução atualiza o painel",
    js.includes("refreshOperacaoLancAluguelDataLimiteDevolucao(target)")
  );

  assertEq("19/08/2026 + 40 dias = 28/09/2026", somarDiasCorridos(new Date(2026, 7, 19), 40), "28/09/2026");
  assertEq("31/12/2025 + 40 dias = 09/02/2026", somarDiasCorridos(new Date(2025, 11, 31), 40), "09/02/2026");
  assertEq("01/01/2024 + 40 (bissexto) = 10/02/2024", somarDiasCorridos(new Date(2024, 0, 1), 40), "10/02/2024");

  const sem = portalPainelLimiteDevolucaoState(0, "28/09/2026");
  assertEq("Sem valor → modo sem", sem.modo, "sem");
  assertEq("Sem valor → texto", sem.texto, "NÃO EXISTE DEVOLUÇÃO");
  const neg = portalPainelLimiteDevolucaoState(-10, "28/09/2026");
  assertEq("Valor negativo → modo sem", neg.modo, "sem");
  const com = portalPainelLimiteDevolucaoState(1862.86, "28/09/2026");
  assertEq("Com valor → modo com", com.modo, "com");
  assertEq("Com valor → título", com.titulo, "DATA LIMITE");
  assertEq("Com valor → data", com.data, "28/09/2026");

  let playwrightOk = false;
  try {
    const { chromium } = await import("playwright");
    await withLocalServer(async (base) => {
      const browser = await chromium.launch({ headless: true });
      const page = await browser.newPage();
      try {
        await page.goto(base, { waitUntil: "domcontentloaded", timeout: 30000 });
        await page.waitForFunction(
          () =>
            typeof window.__DK_formatPortalDataLimiteDevolucao40d === "function" &&
            typeof window.__DK_refreshOperacaoLancAluguelDataLimiteDevolucao === "function",
          { timeout: 20000 }
        );
        const limite = await page.evaluate(() =>
          window.__DK_formatPortalDataLimiteDevolucao40d({ fim: "19/08/2026" })
        );
        record("Browser: 19/08/2026 + 40 = 28/09/2026", limite === "28/09/2026", String(limite));

        const ui = await page.evaluate(() => {
          const box = document.getElementById("operacaoLancAluguelDevolucaoLimiteBox");
          const inp = document.getElementById("operacaoLancAluguelValorDevolucao");
          if (!box || !inp) return { ok: false, reason: "elementos em falta" };
          inp.classList.remove("portal-lanc-devolucao-valor--negativo");
          inp.value = "";
          window.__DK_refreshOperacaoLancAluguelDataLimiteDevolucao({ fim: "19/08/2026" });
          const semTxt = box.textContent.replace(/\s+/g, " ").trim();
          inp.value = "R$ 1.862,86";
          window.__DK_refreshOperacaoLancAluguelDataLimiteDevolucao({ fim: "19/08/2026" });
          const comTxt = box.textContent.replace(/\s+/g, " ").trim();
          const titulo = box.querySelector(".portal-lanc-devolucao-limite-titulo")?.textContent || "";
          const data = box.querySelector(".portal-lanc-devolucao-limite-data")?.textContent || "";
          inp.value = "R$ 0,00";
          window.__DK_refreshOperacaoLancAluguelDataLimiteDevolucao({ fim: "19/08/2026" });
          const zeroTxt = box.textContent.replace(/\s+/g, " ").trim();
          return { ok: true, semTxt, comTxt, titulo, data, zeroTxt };
        });
        record("Browser: caixa existe", Boolean(ui.ok), ui.reason || "");
        record("Browser: sem valor mostra NÃO EXISTE DEVOLUÇÃO", ui.semTxt === "NÃO EXISTE DEVOLUÇÃO", ui.semTxt);
        record("Browser: com saldo mostra DATA LIMITE", ui.titulo === "DATA LIMITE", ui.comTxt);
        record("Browser: data limite 28/09/2026", ui.data === "28/09/2026", ui.data);
        record("Browser: R$ 0,00 volta a NÃO EXISTE DEVOLUÇÃO", ui.zeroTxt === "NÃO EXISTE DEVOLUÇÃO", ui.zeroTxt);
        playwrightOk = true;
      } finally {
        await browser.close();
      }
    });
  } catch (err) {
    record("Browser Playwright", false, err?.message || String(err));
  }

  const pass = results.filter((r) => r.ok).length;
  console.log(`\n--- ${pass}/${results.length} testes data limite devolução ---`);
  if (!playwrightOk) {
    console.log("(Playwright indisponível ou falhou; os testes de fonte e da regra de 40 dias já correram.)");
  }
  process.exit(pass === results.length ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
