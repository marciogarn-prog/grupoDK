/**
 * FINANCEIRO CEO → Cadastro de despesas: layout Windows (sem sobreposição) e bola do mouse.
 * node grupodkempreendimentos/scripts/test-fin-ceo-despesas-windows.mjs
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
  const port = 3043;
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
  const debugPort = 9226;
  const userDir = fs.mkdtempSync("/tmp/dk-chrome-fin-ceo-win-");
  const child = spawn(
    chromeBin,
    [
      "--headless=new",
      "--disable-gpu",
      "--no-sandbox",
      "--disable-dev-shm-usage",
      `--window-size=1920,1080`,
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
      `document.readyState === "complete" && !!document.getElementById("finCeoDespForm")`
    );
    if (ready) return;
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error("FINANCEIRO CEO não carregou");
}

const PREPARE = `(() => {
  document.getElementById("view-home")?.classList.remove("view--active");
  const view = document.getElementById("view-financeiro-ceo");
  if (!view) return { ok: false, reason: "view-financeiro-ceo" };
  view.classList.add("view--active");
  view.setAttribute("aria-hidden", "false");
  document.body.classList.add("portal-body--admin-logado");
  const panel = document.getElementById("panel-financeiro-ceo-locadora");
  if (!panel) return { ok: false, reason: "panel" };
  panel.classList.remove("hidden");
  panel.removeAttribute("hidden");
  document.getElementById("finCeoFormPlaceholder")?.classList.add("hidden");
  const pane = document.getElementById("finCeoPaneDespesas");
  if (!pane) return { ok: false, reason: "pane" };
  pane.classList.remove("hidden");
  pane.removeAttribute("hidden");
  pane.hidden = false;
  const tbody = document.getElementById("finCeoDespesasBody");
  if (tbody) {
    tbody.innerHTML = Array.from({ length: 18 }, (_, i) =>
      "<tr><td>Financiamento</td><td>Parcela teste " + (i + 1) + "</td><td>Sim</td><td>R$ 1.200,00 · 12x</td><td></td></tr>"
    ).join("");
  }
  return { ok: true };
})()`;

const MEASURE = `(() => {
  const view = document.getElementById("view-financeiro-ceo");
  const slide = document.getElementById("finCeoPainelDireito");
  const form = document.getElementById("finCeoDespForm");
  const cat = document.getElementById("finCeoDespCategoria");
  const sub = document.getElementById("finCeoDespSubcategoria");
  const per = document.getElementById("finCeoDespPeriodico");
  const catLab = cat?.closest(".portal-field")?.querySelector("span");
  const subLab = sub?.closest(".portal-field")?.querySelector("span");
  const perLab = per?.closest(".portal-field")?.querySelector("span");
  const r = (el) => el?.getBoundingClientRect();
  const overlap = (a, b) => {
    const ra = r(a);
    const rb = r(b);
    if (!ra || !rb || ra.width < 2 || rb.width < 2) return false;
    return !(ra.right <= rb.left + 1 || ra.left >= rb.right - 1 || ra.bottom <= rb.top + 1 || ra.top >= rb.bottom - 1);
  };
  const csSlide = slide ? getComputedStyle(slide) : null;
  const csView = view ? getComputedStyle(view) : null;
  const csForm = form ? getComputedStyle(form) : null;
  return {
    viewW: Math.round(view?.getBoundingClientRect().width || 0),
    viewMaxW: csView?.maxWidth || "",
    slideOverflowY: csSlide?.overflowY || "",
    slideClientH: Math.round(slide?.clientHeight || 0),
    slideScrollH: Math.round(slide?.scrollHeight || 0),
    slideScrollTop: Math.round(slide?.scrollTop || 0),
    canScroll: Boolean(slide && slide.scrollHeight > slide.clientHeight + 8),
    formCols: csForm?.gridTemplateColumns || "",
    formW: Math.round(form?.getBoundingClientRect().width || 0),
    overlapCatSub: overlap(cat, sub) || overlap(catLab, subLab),
    overlapSubPer: overlap(sub, per) || overlap(subLab, perLab),
    overlapCatPer: overlap(cat, per) || overlap(catLab, perLab),
    overlapCatSubField: overlap(cat?.closest(".portal-field"), sub?.closest(".portal-field")),
    overlapSubPerField: overlap(sub?.closest(".portal-field"), per?.closest(".portal-field")),
    catW: Math.round(r(cat)?.width || 0),
    subW: Math.round(r(sub)?.width || 0),
    perW: Math.round(r(per)?.width || 0),
    catH: Math.round(r(cat)?.height || 0),
    subBottom: Math.round(r(sub)?.bottom || 0),
    perTop: Math.round(r(per)?.top || 0),
    catRight: Math.round(r(cat)?.right || 0),
    subLeft: Math.round(r(sub)?.left || 0),
  };
})()`;

async function captureSlide(session, filename) {
  const clip = await cdpEval(
    session,
    `(() => {
      const el = document.getElementById("view-financeiro-ceo") || document.body;
      const r = el.getBoundingClientRect();
      return {
        x: Math.max(0, r.x),
        y: Math.max(0, r.y),
        width: Math.max(1, Math.min(r.width, 1920)),
        height: Math.max(1, Math.min(r.height, 1080)),
        scale: 1,
      };
    })()`
  );
  const shot = await session.send("Page.captureScreenshot", { format: "png", clip });
  if (!shot?.data) return;
  fs.mkdirSync(ARTIFACTS, { recursive: true });
  fs.writeFileSync(path.join(ARTIFACTS, filename), Buffer.from(shot.data, "base64"));
}

async function setViewport(session, width, height) {
  await session.send("Emulation.setDeviceMetricsOverride", {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: false,
  });
}

async function main() {
  const html = readLocal("index.html");
  const css = readLocal("styles.css");

  record(
    "HTML marca o cadastro de despesas para layout Windows e scroll",
    /id="finCeoPaneDespesas"[^>]*operacao-inline-form--rodar-mouse/.test(html) &&
      html.includes("fin-ceo-desp-form--windows")
  );
  record(
    "CSS do slide CEO usa overflow-y auto (bola do mouse)",
    css.includes("#view-financeiro-ceo .fin-pptx__slide") &&
      css.includes("a bola do mouse move o cadastro de despesas")
  );
  record(
    "CSS do form CEO não usa 3 colunas espremidas",
    css.includes("fin-ceo-desp-form--windows") &&
      /#view-financeiro-ceo \.fin-ceo-desp-form--windows[\s\S]{0,280}grid-template-columns:\s*minmax\(0,\s*1fr\)/.test(css)
  );

  let browserOk = false;
  try {
    await withLocalServer(async (base) => {
      await withChromePage(async (session) => {
        await cdpGoto(session, base);

        await setViewport(session, 1920, 1080);
        const shown = await cdpEval(session, PREPARE);
        record("Browser: cadastro de despesas visível", Boolean(shown?.ok), shown?.reason || "");

        const wide = await cdpEval(session, MEASURE);
        record(
          "Browser 1920: ecrã usa a largura do monitor",
          Number(wide?.viewW) >= 1800 && (wide?.viewMaxW === "none" || wide?.viewMaxW === "100%"),
          JSON.stringify({ viewW: wide?.viewW, viewMaxW: wide?.viewMaxW })
        );
        record(
          "Browser 1920: formulário usa a área útil à direita do menu",
          Number(wide?.formW) >= 1200,
          JSON.stringify({ formW: wide?.formW, formCols: wide?.formCols })
        );
        record(
          "Browser 1920: Categoria / Subcategoria / Periódico não se sobrepõem",
          Boolean(
            wide &&
              !wide.overlapCatSub &&
              !wide.overlapSubPer &&
              !wide.overlapCatPer &&
              !wide.overlapCatSubField &&
              !wide.overlapSubPerField
          ),
          JSON.stringify({
            overlapCatSub: wide?.overlapCatSub,
            overlapSubPer: wide?.overlapSubPer,
            overlapCatPer: wide?.overlapCatPer,
            catW: wide?.catW,
            subW: wide?.subW,
            perW: wide?.perW,
            formCols: wide?.formCols,
          })
        );
        record(
          "Browser 1920: painel tem overflow-y auto/scroll",
          wide?.slideOverflowY === "auto" || wide?.slideOverflowY === "scroll",
          String(wide?.slideOverflowY)
        );
        record(
          "Browser 1920: conteúdo é mais alto que a janela (dá para rolar)",
          Boolean(wide?.canScroll),
          JSON.stringify({ clientH: wide?.slideClientH, scrollH: wide?.slideScrollH })
        );
        await captureSlide(session, "fin_ceo_despesas_windows_1920.png");

        await cdpEval(
          session,
          `(() => {
            const slide = document.getElementById("finCeoPainelDireito");
            slide.scrollTop = 0;
            return true;
          })()`
        );
        const box = await cdpEval(
          session,
          `(() => {
            const r = document.getElementById("finCeoPainelDireito").getBoundingClientRect();
            return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + Math.min(r.height, 280) / 2) };
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
          "Browser: bola do mouse move o cadastro de despesas",
          Number(afterWheel?.slideScrollTop) >= 80,
          JSON.stringify({ scrollTop: afterWheel?.slideScrollTop, overflowY: afterWheel?.slideOverflowY })
        );
        await captureSlide(session, "fin_ceo_despesas_depois_scroll.png");

        await setViewport(session, 1280, 720);
        await cdpEval(session, PREPARE);
        const mid = await cdpEval(session, MEASURE);
        record(
          "Browser 1280: campos não se sobrepõem no monitor típico Windows",
          Boolean(
            mid &&
              !mid.overlapCatSub &&
              !mid.overlapSubPer &&
              !mid.overlapCatPer &&
              !mid.overlapCatSubField &&
              !mid.overlapSubPerField
          ),
          JSON.stringify({
            overlapCatSub: mid?.overlapCatSub,
            overlapSubPer: mid?.overlapSubPer,
            viewW: mid?.viewW,
            formCols: mid?.formCols,
            catW: mid?.catW,
            subW: mid?.subW,
          })
        );
        await captureSlide(session, "fin_ceo_despesas_windows_1280.png");

        browserOk =
          Boolean(wide?.canScroll) &&
          Number(afterWheel?.slideScrollTop) >= 80 &&
          Number(wide?.formW) >= 1200 &&
          !wide?.overlapCatSub &&
          !wide?.overlapSubPer &&
          !mid?.overlapCatSub &&
          !mid?.overlapSubPer;
      });
    });
  } catch (err) {
    record("Browser Chrome", false, err?.message || String(err));
  }

  const pass = results.filter((r) => r.ok).length;
  console.log(`\n--- ${pass}/${results.length} testes FINANCEIRO CEO despesas Windows ---`);
  process.exit(pass === results.length && browserOk ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
