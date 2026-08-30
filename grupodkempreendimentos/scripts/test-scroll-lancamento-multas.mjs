/**
 * Lançamento de multas: a bola do mouse tem de mover o conteúdo.
 * node grupodkempreendimentos/scripts/test-scroll-lancamento-multas.mjs
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
  const port = 3042;
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
  const debugPort = 9225;
  const userDir = fs.mkdtempSync("/tmp/dk-chrome-scroll-multas-");
  const child = spawn(
    chromeBin,
    [
      "--headless=new",
      "--disable-gpu",
      "--no-sandbox",
      "--disable-dev-shm-usage",
      `--window-size=1280,720`,
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
      `document.readyState === "complete" && !!document.getElementById("operacaoInlineLancamentoMultas")`
    );
    if (ready) return;
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error("Lançamento de multas não carregou");
}

const PREPARE = `(() => {
  document.getElementById("view-home")?.classList.remove("view--active");
  const unit = document.getElementById("view-unit");
  if (!unit) return { ok: false, reason: "view-unit" };
  unit.classList.add("view--active");
  unit.setAttribute("aria-hidden", "false");
  document.body.classList.add("portal-body--equipa-sessao", "portal-body--admin-logado");
  const ids = ["panel-operacao-locadora", "operacaoInlineLancamentoMultas"];
  for (const id of ids) {
    const el = document.getElementById(id);
    if (!el) return { ok: false, reason: id };
    el.classList.remove("hidden");
    el.removeAttribute("hidden");
    el.hidden = false;
  }
  for (const id of [
    "operacaoLancMultasReferenciaPanel",
    "operacaoLancMultasDocumentosDeposito",
    "operacaoLancMultasLancamentoPanel",
  ]) {
    const el = document.getElementById(id);
    if (!el) return { ok: false, reason: id };
    el.classList.remove("hidden");
    el.removeAttribute("hidden");
    el.hidden = false;
  }
  const lista = document.getElementById("operacaoLancMultasPesquisaLista");
  if (lista) {
    lista.classList.remove("hidden");
    lista.removeAttribute("hidden");
    lista.hidden = false;
    lista.innerHTML = "<div class='portal-lanc-pesquisa-linha'>HEMERSON ALLAN CAMPINA DA SILVA · <span class='portal-lanc-pesquisa-linha__fim'>inativo · 22/01/2026</span></div>";
  }
  return { ok: true };
})()`;

const MEASURE = `(() => {
  const pane = document.getElementById("operacaoInlineLancamentoMultas");
  const docs = document.getElementById("operacaoLancMultasDocumentosDeposito");
  const cad = document.getElementById("operacaoLancMultasCadastrarBtn");
  const cs = pane ? getComputedStyle(pane) : null;
  const r = (el) => el?.getBoundingClientRect();
  const d = r(docs);
  const b = r(cad);
  const overlap =
    d && b && !(d.right <= b.left + 1 || d.left >= b.right - 1 || d.bottom <= b.top + 1 || d.top >= b.bottom - 1);
  return {
    overflowY: cs?.overflowY || "",
    clientH: Math.round(pane?.clientHeight || 0),
    scrollH: Math.round(pane?.scrollHeight || 0),
    scrollTop: Math.round(pane?.scrollTop || 0),
    canScroll: Boolean(pane && pane.scrollHeight > pane.clientHeight + 8),
    overlap,
    docsBottom: Math.round(d?.bottom || 0),
    cadTop: Math.round(b?.top || 0),
  };
})()`;

async function capturePane(session, filename) {
  const clip = await cdpEval(
    session,
    `(() => {
      const el = document.getElementById("operacaoInlineLancamentoMultas") || document.body;
      el.scrollIntoView();
      const r = el.getBoundingClientRect();
      return {
        x: Math.max(0, r.x),
        y: Math.max(0, r.y),
        width: Math.max(1, Math.min(r.width, 1280)),
        height: Math.max(1, Math.min(r.height, 720)),
        scale: 1,
      };
    })()`
  );
  const shot = await session.send("Page.captureScreenshot", { format: "png", clip });
  if (!shot?.data) return;
  fs.mkdirSync(ARTIFACTS, { recursive: true });
  fs.writeFileSync(path.join(ARTIFACTS, filename), Buffer.from(shot.data, "base64"));
}

async function main() {
  const html = readLocal("index.html");
  const css = readLocal("styles.css");

  record(
    "HTML marca o lançamento de multas para rolar com o mouse",
    /id="operacaoInlineLancamentoMultas"[^>]*operacao-inline-form--rodar-mouse/.test(html)
  );
  record(
    "CSS da classe rodar-mouse usa overflow-y auto",
    css.includes("operacao-inline-form--rodar-mouse") &&
      /operacao-inline-form--rodar-mouse:not\(\.hidden\) \{[\s\S]{0,220}overflow-y:\s*auto/.test(css)
  );
  record("CSS não encolhe o formulário de multas", css.includes(".portal-lanc-aluguel-form"));

  let browserOk = false;
  try {
    await withLocalServer(async (base) => {
      await withChromePage(async (session) => {
        await cdpGoto(session, base);
        await session.send("Emulation.setDeviceMetricsOverride", {
          width: 1280,
          height: 720,
          deviceScaleFactor: 1,
          mobile: false,
        });
        const shown = await cdpEval(session, PREPARE);
        record("Browser: lançamento de multas visível", Boolean(shown?.ok), shown?.reason || "");

        const before = await cdpEval(session, MEASURE);
        record(
          "Browser: painel tem overflow-y auto/scroll",
          before?.overflowY === "auto" || before?.overflowY === "scroll",
          String(before?.overflowY)
        );
        record(
          "Browser: conteúdo é mais alto que a janela (dá para rolar)",
          Boolean(before?.canScroll),
          JSON.stringify({ clientH: before?.clientH, scrollH: before?.scrollH })
        );
        record(
          "Browser: documentos e botão cadastrar não se sobrepõem",
          before && !before.overlap,
          JSON.stringify({ docsBottom: before?.docsBottom, cadTop: before?.cadTop })
        );
        await capturePane(session, "lancamento_multas_topo.png");

        await cdpEval(
          session,
          `(() => {
            const pane = document.getElementById("operacaoInlineLancamentoMultas");
            pane.scrollTop = 0;
            return true;
          })()`
        );
        const box = await cdpEval(
          session,
          `(() => {
            const r = document.getElementById("operacaoInlineLancamentoMultas").getBoundingClientRect();
            return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + Math.min(r.height, 240) / 2) };
          })()`
        );
        await session.send("Input.dispatchMouseEvent", {
          type: "mouseMoved",
          x: box.x,
          y: box.y,
        });
        await session.send("Input.dispatchMouseEvent", {
          type: "mouseWheel",
          x: box.x,
          y: box.y,
          deltaX: 0,
          deltaY: 520,
        });
        await new Promise((r) => setTimeout(r, 200));
        const afterWheel = await cdpEval(session, MEASURE);
        record(
          "Browser: bola do mouse move o lançamento de multas",
          Number(afterWheel?.scrollTop) >= 80,
          JSON.stringify({ scrollTop: afterWheel?.scrollTop, overflowY: afterWheel?.overflowY })
        );

        await cdpEval(
          session,
          `(() => {
            const pane = document.getElementById("operacaoInlineLancamentoMultas");
            pane.scrollTop = pane.scrollHeight;
            return true;
          })()`
        );
        const bottom = await cdpEval(session, MEASURE);
        record(
          "Browser: ao rolar até ao fundo o botão cadastrar continua no fluxo",
          Boolean(bottom && !bottom.overlap && bottom.cadTop > 0),
          JSON.stringify({ overlap: bottom?.overlap, scrollTop: bottom?.scrollTop, cadTop: bottom?.cadTop })
        );
        await capturePane(session, "lancamento_multas_depois_scroll.png");
        browserOk = Number(afterWheel?.scrollTop) >= 80 && Boolean(before?.canScroll);
      });
    });
  } catch (err) {
    record("Browser Chrome", false, err?.message || String(err));
  }

  const pass = results.filter((r) => r.ok).length;
  console.log(`\n--- ${pass}/${results.length} testes scroll lançamento de multas ---`);
  process.exit(pass === results.length && browserOk ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
