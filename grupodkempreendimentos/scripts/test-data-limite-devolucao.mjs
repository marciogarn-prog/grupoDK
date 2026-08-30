/**
 * Data limite da devolução de investimento: 40 dias corridos após o fim do contrato.
 * node grupodkempreendimentos/scripts/test-data-limite-devolucao.mjs
 * Opcional: DK_TEST_BASE_URL=http://127.0.0.1:3000/
 */
import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ARTIFACTS = "/opt/cursor/artifacts";
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

async function waitHttpOk(url, tries = 40) {
  for (let i = 0; i < tries; i += 1) {
    try {
      const res = await fetch(url, { redirect: "manual" });
      if (res.status) return;
    } catch {
      /* ainda a subir */
    }
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error(`Servidor não respondeu em ${url}`);
}

async function withLocalServer(fn) {
  const requested = String(process.env.DK_TEST_BASE_URL || "").trim();
  if (requested) {
    const base = requested.replace(/\/?$/, "/");
    await waitHttpOk(base);
    await fn(base);
    return;
  }
  const port = 3040;
  const child = spawn(process.execPath, ["server.cjs"], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(port) },
    stdio: ["ignore", "pipe", "pipe"],
  });
  try {
    await waitHttpOk(`http://127.0.0.1:${port}/`);
    await fn(`http://127.0.0.1:${port}/`);
  } finally {
    child.kill("SIGTERM");
  }
}

function cdpSession(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let nextId = 0;
  const pending = new Map();
  const ready = new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve);
    ws.addEventListener("error", () => reject(new Error("Falha ao ligar ao Chrome (CDP)")));
  });
  ws.addEventListener("message", (ev) => {
    const msg = JSON.parse(String(ev.data));
    if (msg.id == null || !pending.has(msg.id)) return;
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    if (msg.error) reject(new Error(msg.error.message || JSON.stringify(msg.error)));
    else resolve(msg.result);
  });
  async function send(method, params = {}) {
    await ready;
    const id = ++nextId;
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  }
  return { ws, send, close: () => ws.close() };
}

async function withChromePage(fn) {
  const chromeBin = ["/usr/bin/google-chrome-stable", "/usr/bin/google-chrome", "/usr/local/bin/google-chrome"].find(
    (p) => fs.existsSync(p)
  );
  if (!chromeBin) throw new Error("Chrome não encontrado");
  const debugPort = 9223;
  const userDir = fs.mkdtempSync("/tmp/dk-chrome-limite-");
  const child = spawn(
    chromeBin,
    [
      "--headless=new",
      "--disable-gpu",
      "--no-sandbox",
      "--disable-dev-shm-usage",
      `--window-size=1280,900`,
      `--remote-debugging-port=${debugPort}`,
      `--user-data-dir=${userDir}`,
      "about:blank",
    ],
    { stdio: ["ignore", "pipe", "pipe"] }
  );
  try {
    await waitHttpOk(`http://127.0.0.1:${debugPort}/json/version`);
    const pages = await fetch(`http://127.0.0.1:${debugPort}/json/list`).then((r) => r.json());
    const page = (pages || []).find((p) => p.type === "page") || pages[0];
    if (!page?.webSocketDebuggerUrl) throw new Error("Chrome sem página CDP");
    const session = cdpSession(page.webSocketDebuggerUrl);
    await fn(session);
    session.close();
  } finally {
    child.kill("SIGTERM");
  }
}

async function cdpEval(session, expression) {
  const res = await session.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (res.exceptionDetails) {
    const desc = res.exceptionDetails.exception?.description || res.exceptionDetails.text;
    throw new Error(desc || "Runtime.evaluate falhou");
  }
  return res.result?.value;
}

async function cdpGoto(session, url) {
  await session.send("Page.enable");
  await session.send("Runtime.enable");
  await session.send("Page.navigate", { url });
  for (let i = 0; i < 80; i += 1) {
    const ready = await cdpEval(
      session,
      `typeof window.__DK_formatPortalDataLimiteDevolucao40d === "function" && typeof window.__DK_refreshOperacaoLancAluguelDataLimiteDevolucao === "function"`
    );
    if (ready) return;
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error("Helpers da data limite não carregaram");
}

const PREPARE_AND_READ_UI = `(() => {
  const box = document.getElementById("operacaoLancAluguelDevolucaoLimiteBox");
  const inp = document.getElementById("operacaoLancAluguelValorDevolucao");
  if (!box || !inp) return { ok: false, reason: "elementos em falta" };
  const col = document.querySelector(".portal-lanc-dual-col--devolucao");
  if (col && col.parentElement !== document.body) {
    col.style.width = "640px";
    col.style.maxWidth = "92vw";
    col.style.margin = "24px";
    document.body.innerHTML = "";
    document.body.style.background = "#111";
    document.body.appendChild(col);
  }
  inp.classList.remove("portal-lanc-devolucao-valor--negativo");
  inp.value = "";
  window.__DK_refreshOperacaoLancAluguelDataLimiteDevolucao({ fim: "19/08/2026" });
  const semTxt = box.textContent.replace(/\\s+/g, " ").trim();
  inp.value = "R$ 1.862,86";
  window.__DK_refreshOperacaoLancAluguelDataLimiteDevolucao({ fim: "19/08/2026" });
  const comTxt = box.textContent.replace(/\\s+/g, " ").trim();
  const titulo = box.querySelector(".portal-lanc-devolucao-limite-titulo")?.textContent || "";
  const data = box.querySelector(".portal-lanc-devolucao-limite-data")?.textContent || "";
  inp.value = "R$ 0,00";
  window.__DK_refreshOperacaoLancAluguelDataLimiteDevolucao({ fim: "19/08/2026" });
  const zeroTxt = box.textContent.replace(/\\s+/g, " ").trim();
  return { ok: true, semTxt, comTxt, titulo, data, zeroTxt };
})()`;

async function captureState(session, filename, expression) {
  await cdpEval(session, expression);
  const shot = await session.send("Page.captureScreenshot", { format: "png" });
  if (!shot?.data) return;
  fs.mkdirSync(ARTIFACTS, { recursive: true });
  fs.writeFileSync(path.join(ARTIFACTS, filename), Buffer.from(shot.data, "base64"));
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

  let browserOk = false;
  try {
    await withLocalServer(async (base) => {
      await withChromePage(async (session) => {
        await cdpGoto(session, base);
        const limite = await cdpEval(
          session,
          `window.__DK_formatPortalDataLimiteDevolucao40d({ fim: "19/08/2026" })`
        );
        record("Browser: 19/08/2026 + 40 = 28/09/2026", limite === "28/09/2026", String(limite));

        const fimFmt = await cdpEval(
          session,
          `({
            br: window.__DK_portalFormatDataFinalizacaoLocacao({ fim: "19/08/2026" }),
            iso: window.__DK_portalFormatDataFinalizacaoLocacao({ fim: "2026-08-19" }),
            abr: window.__DK_portalFormatDataFinalizacaoLocacao({ fim: "22/jan", numeroContrato: "2025122902" }),
            label: window.__DK_portalFormatDataFinalizacaoLocacao({ fim: "22/jan", numeroContrato: "2025122902", statusLocacao: "FINALIZADO" }),
          })`
        );
        record("Browser: data fim 19/08/2026", fimFmt?.br === "19/08/2026", String(fimFmt?.br));
        record("Browser: data fim ISO → 19/08/2026", fimFmt?.iso === "19/08/2026", String(fimFmt?.iso));
        record("Browser: data fim 22/jan → 22/01/2026", fimFmt?.abr === "22/01/2026", String(fimFmt?.abr));

        const ui = await cdpEval(session, PREPARE_AND_READ_UI);
        record("Browser: caixa existe", Boolean(ui?.ok), ui?.reason || "");
        record("Browser: sem valor mostra NÃO EXISTE DEVOLUÇÃO", ui?.semTxt === "NÃO EXISTE DEVOLUÇÃO", ui?.semTxt);
        record("Browser: com saldo mostra DATA LIMITE", ui?.titulo === "DATA LIMITE", ui?.comTxt);
        record("Browser: data limite 28/09/2026", ui?.data === "28/09/2026", ui?.data);
        record("Browser: R$ 0,00 volta a NÃO EXISTE DEVOLUÇÃO", ui?.zeroTxt === "NÃO EXISTE DEVOLUÇÃO", ui?.zeroTxt);

        const aposEdicao = await cdpEval(
          session,
          `(() => {
            const box = document.getElementById("operacaoLancAluguelDevolucaoLimiteBox");
            const inp = document.getElementById("operacaoLancAluguelValorDevolucao");
            inp.value = "R$ 1.862,86";
            inp.dispatchEvent(new Event("input", { bubbles: true }));
            const data = box.querySelector(".portal-lanc-devolucao-limite-data")?.textContent || "";
            const titulo = box.querySelector(".portal-lanc-devolucao-limite-titulo")?.textContent || "";
            return { titulo, data, txt: box.textContent.replace(/\\s+/g, " ").trim() };
          })()`
        );
        record(
          "Browser: editar o valor sem relocar o contrato mantém 28/09/2026",
          aposEdicao?.data === "28/09/2026" && aposEdicao?.titulo === "DATA LIMITE",
          aposEdicao?.txt
        );

        await captureState(
          session,
          "devolucao_sem_valor.png",
          `document.getElementById("operacaoLancAluguelValorDevolucao").value = "R$ 0,00";
           window.__DK_refreshOperacaoLancAluguelDataLimiteDevolucao({ fim: "19/08/2026" });
           true;`
        );
        await captureState(
          session,
          "devolucao_data_limite_40_dias.png",
          `document.getElementById("operacaoLancAluguelValorDevolucao").value = "R$ 1.862,86";
           window.__DK_refreshOperacaoLancAluguelDataLimiteDevolucao({ fim: "19/08/2026" });
           true;`
        );
        browserOk = Boolean(ui?.ok && ui?.data === "28/09/2026");
      });
    });
  } catch (err) {
    record("Browser Chrome", false, err?.message || String(err));
  }

  const pass = results.filter((r) => r.ok).length;
  console.log(`\n--- ${pass}/${results.length} testes data limite devolução ---`);
  if (!browserOk) {
    console.log("(Se o Chrome falhou, os testes de fonte e da regra de 40 dias já correram.)");
  }
  process.exit(pass === results.length ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
