/**
 * Cadastro de locação: a bola do mouse tem de mover o conteúdo.
 * node grupodkempreendimentos/scripts/test-scroll-cadastro-locacao.mjs
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
  const port = 3041;
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
  const debugPort = 9224;
  const userDir = fs.mkdtempSync("/tmp/dk-chrome-scroll-loc-");
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
    const ready = await cdpEval(session, `document.readyState === "complete" && !!document.getElementById("operacaoInlineLocacao")`);
    if (ready) return;
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error("Cadastro de locação não carregou");
}

const PREPARE = `(() => {
  document.getElementById("view-home")?.classList.remove("view--active");
  const unit = document.getElementById("view-unit");
  if (!unit) return { ok: false, reason: "view-unit" };
  unit.classList.add("view--active");
  unit.setAttribute("aria-hidden", "false");
  document.body.classList.add("portal-body--equipa-sessao", "portal-body--admin-logado");
  const ids = ["panel-operacao-locadora", "operacaoInlineLocacao"];
  for (const id of ids) {
    const el = document.getElementById(id);
    if (!el) return { ok: false, reason: id };
    el.classList.remove("hidden");
    el.removeAttribute("hidden");
    el.hidden = false;
  }
  const docs = document.getElementById("operacaoLocacaoDocumentosWrap");
  if (docs) {
    docs.classList.remove("hidden");
    docs.hidden = false;
  }
  const hist = document.getElementById("operacaoLocacaoLancamentosHistorico");
  if (hist) {
    hist.classList.remove("hidden");
    hist.removeAttribute("hidden");
    hist.hidden = false;
    hist.innerHTML = "<p><strong>Lançamentos registados (1)</strong></p><table class='portal-lanc-hist'><thead><tr><th>Protocolo</th><th>Tipo</th><th>Data</th><th>Valor</th></tr></thead><tbody><tr><td>2026010101</td><td>Pagamento</td><td>30/08/2026</td><td>R$ 4.200,00</td></tr></tbody></table>";
  }
  const por = document.getElementById("operacaoLocacaoCadastradoPor");
  if (por) {
    por.hidden = false;
    por.textContent = "CADASTRADO POR Márcio Santos-030";
  }
  return { ok: true };
})()`;

const MEASURE = `(() => {
  const loc = document.getElementById("operacaoInlineLocacao");
  const form = document.getElementById("formOperacaoLocacaoInline");
  const actions = document.querySelector("#operacaoInlineLocacao .operacao-inline-form__actions");
  const hist = document.getElementById("operacaoLocacaoLancamentosHistorico");
  const cs = loc ? getComputedStyle(loc) : null;
  const r = (el) => el?.getBoundingClientRect();
  const a = r(actions);
  const h = r(hist);
  const overlap =
    a && h && !(a.right <= h.left + 1 || a.left >= h.right - 1 || a.bottom <= h.top + 1 || a.top >= h.bottom - 1);
  return {
    overflowY: cs?.overflowY || "",
    clientH: Math.round(loc?.clientHeight || 0),
    scrollH: Math.round(loc?.scrollHeight || 0),
    scrollTop: Math.round(loc?.scrollTop || 0),
    canScroll: Boolean(loc && loc.scrollHeight > loc.clientHeight + 8),
    overlap,
    actionsBottom: Math.round(a?.bottom || 0),
    histTop: Math.round(h?.top || 0),
    formH: Math.round(form?.getBoundingClientRect().height || 0),
  };
})()`;

async function captureLoc(session, filename) {
  const clip = await cdpEval(
    session,
    `(() => {
      const el = document.getElementById("operacaoInlineLocacao") || document.body;
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

  record("HTML marca o cadastro de locação para rolar com o mouse", html.includes("operacao-inline-form--rodar-mouse"));
  record(
    "CSS do cadastro de locação usa overflow-y auto",
    css.includes("operacao-inline-form--rodar-mouse") &&
      /operacao-inline-form--rodar-mouse:not\(\.hidden\) \{[\s\S]{0,220}overflow-y:\s*auto/.test(css)
  );
  record("CSS não encolhe o formulário abaixo do conteúdo", css.includes("min-height: min-content"));

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
        record("Browser: cadastro de locação visível", Boolean(shown?.ok), shown?.reason || "");

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
          "Browser: botões e histórico não se sobrepõem no topo",
          before && !before.overlap,
          JSON.stringify({ actionsBottom: before?.actionsBottom, histTop: before?.histTop })
        );
        await captureLoc(session, "cadastro_locacao_topo.png");

        await cdpEval(
          session,
          `(() => {
            const loc = document.getElementById("operacaoInlineLocacao");
            loc.scrollTop = 0;
            return true;
          })()`
        );
        const box = await cdpEval(
          session,
          `(() => {
            const r = document.getElementById("operacaoInlineLocacao").getBoundingClientRect();
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
          "Browser: bola do mouse move o cadastro de locação",
          Number(afterWheel?.scrollTop) >= 80,
          JSON.stringify({ scrollTop: afterWheel?.scrollTop, overflowY: afterWheel?.overflowY })
        );

        await cdpEval(
          session,
          `(() => {
            const loc = document.getElementById("operacaoInlineLocacao");
            loc.scrollTop = loc.scrollHeight;
            return true;
          })()`
        );
        const bottom = await cdpEval(session, MEASURE);
        record(
          "Browser: ao rolar até ao fundo os botões continuam visíveis no fluxo",
          Boolean(bottom && !bottom.overlap && bottom.actionsBottom > 0),
          JSON.stringify({ overlap: bottom?.overlap, scrollTop: bottom?.scrollTop })
        );
        await captureLoc(session, "cadastro_locacao_depois_scroll.png");
        browserOk = Number(afterWheel?.scrollTop) >= 80 && Boolean(before?.canScroll);
      });
    });
  } catch (err) {
    record("Browser Chrome", false, err?.message || String(err));
  }

  const pass = results.filter((r) => r.ok).length;
  console.log(`\n--- ${pass}/${results.length} testes scroll cadastro locação ---`);
  process.exit(pass === results.length && browserOk ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
