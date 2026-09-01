/**
 * TIPO DE PLANO: azul DK MINHA MOTO · verde DK MEU TRANSPORTE moto · marrom carro.
 * node grupodkempreendimentos/scripts/test-tipo-plano-cores.mjs
 */
import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ART = "/opt/cursor/artifacts";
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
  const port = 3061;
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
  const debugPort = 9244;
  const userDir = fs.mkdtempSync("/tmp/dk-chrome-tipo-plano-cores-");
  const child = spawn(
    chromeBin,
    [
      "--headless=new",
      "--disable-gpu",
      "--no-sandbox",
      "--disable-dev-shm-usage",
      `--window-size=1400,900`,
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
      `document.readyState === "complete" && !!document.getElementById("operacaoLocacaoTipoPlano")`
    );
    if (ready) return;
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error("Cadastro de locação não carregou");
}

async function saveClip(session, selector, destName) {
  const box = await cdpEval(
    session,
    `(() => {
      const el = document.querySelector(${JSON.stringify(selector)});
      if (!el) return null;
      el.scrollIntoView({ block: "center" });
      const r = el.getBoundingClientRect();
      return {
        x: r.x + window.scrollX,
        y: r.y + window.scrollY,
        width: r.width,
        height: r.height,
      };
    })()`
  );
  if (!box || box.width < 10 || box.height < 8) return null;
  const shot = await session.send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: true,
    clip: {
      x: Math.max(0, box.x),
      y: Math.max(0, box.y),
      width: box.width,
      height: box.height,
      scale: 2,
    },
  });
  fs.mkdirSync(ART, { recursive: true });
  const dest = path.join(ART, destName);
  fs.writeFileSync(dest, Buffer.from(shot.data, "base64"));
  return dest;
}

function rgbClose(css, r, g, b, tol = 20) {
  const m = String(css || "").match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (!m) return false;
  return Math.abs(+m[1] - r) <= tol && Math.abs(+m[2] - g) <= tol && Math.abs(+m[3] - b) <= tol;
}

const SHOW = `(() => {
  document.getElementById("view-home")?.classList.remove("view--active");
  const unit = document.getElementById("view-unit");
  if (!unit) return { ok: false, reason: "view-unit" };
  unit.classList.add("view--active");
  unit.setAttribute("aria-hidden", "false");
  document.body.classList.add("portal-body--equipa-sessao", "portal-body--admin-logado");
  for (const id of ["panel-operacao-locadora", "operacaoInlineLocacao"]) {
    const el = document.getElementById(id);
    if (!el) return { ok: false, reason: id };
    el.classList.remove("hidden");
    el.removeAttribute("hidden");
    el.hidden = false;
  }
  document.querySelectorAll(".operacao-inline-form").forEach((el) => {
    if (el.id !== "operacaoInlineLocacao") el.classList.add("hidden");
  });
  return { ok: true };
})()`;

const PAINT = (plano, modalidade) => `(() => {
  const set = (id, v) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.value = v;
    el.dispatchEvent(new Event("input", { bubbles: true }));
  };
  set("operacaoLocacaoTipoPlano", ${JSON.stringify(plano)});
  set("operacaoLocacaoValorInvestimento", ${plano.includes("MINHA") ? JSON.stringify("20,00") : JSON.stringify("0,00")});
  set("operacaoLocacaoValorAluguel", "310,00");
  const wrap = document.getElementById("operacaoLocacaoModalidadeWrap");
  const carro = document.getElementById("operacaoLocacaoModalidadeCarro");
  const moto = document.getElementById("operacaoLocacaoModalidadeMoto");
  const isTransporte = ${JSON.stringify(plano)}.includes("TRANSPORTE");
  if (wrap) {
    wrap.classList.toggle("hidden", !isTransporte);
    wrap.hidden = !isTransporte;
  }
  if (carro && moto) {
    if (${JSON.stringify(modalidade)} === "CARRO") {
      carro.checked = true;
      moto.checked = false;
    } else if (${JSON.stringify(modalidade)} === "MOTO") {
      moto.checked = true;
      carro.checked = false;
    } else {
      carro.checked = false;
      moto.checked = false;
    }
  }
  if (typeof window.__DK_paintOperacaoLocacaoTipoPlanoFonte === "function") {
    window.__DK_paintOperacaoLocacaoTipoPlanoFonte();
  }
  const inp = document.getElementById("operacaoLocacaoTipoPlano");
  const cs = inp ? getComputedStyle(inp) : null;
  return {
    value: String(inp?.value || ""),
    cls: String(inp?.className || ""),
    color: cs?.color || "",
    fill: cs?.webkitTextFillColor || "",
    helper: typeof window.__DK_portalTipoPlanoFonteClasse === "function"
      ? window.__DK_portalTipoPlanoFonteClasse(${JSON.stringify(plano)}, ${JSON.stringify(modalidade)})
      : "",
  };
})()`;

async function main() {
  const ui = readLocal("portal-locadora-ui.js");
  const css = readLocal("styles.css");

  record("pinta TIPO DE PLANO no cadastro", ui.includes("paintOperacaoLocacaoTipoPlanoFonte"));
  record(
    "CSS azul / verde / marrom no TIPO DE PLANO",
    css.includes("#operacaoLocacaoTipoPlano.portal-tipo-plano--minha-moto") &&
      css.includes("color: #5eb8ff !important") &&
      css.includes("#operacaoLocacaoTipoPlano.portal-tipo-plano--meu-transporte") &&
      css.includes("color: #6ee7a0 !important") &&
      css.includes("#operacaoLocacaoTipoPlano.portal-tipo-plano--carro") &&
      css.includes("color: #c4a484 !important")
  );

  await withLocalServer(async (base) => {
    await withChromePage(async (session) => {
      await session.send("Emulation.setDeviceMetricsOverride", {
        width: 1400,
        height: 900,
        deviceScaleFactor: 1,
        mobile: false,
      });
      await cdpGoto(session, base);
      const shown = await cdpEval(session, SHOW);
      record("abre cadastro de locação", Boolean(shown?.ok), JSON.stringify(shown));

      const minha = await cdpEval(session, PAINT("DK MINHA MOTO", ""));
      record(
        "DK MINHA MOTO: classe azul",
        Boolean(minha?.cls?.includes("portal-tipo-plano--minha-moto")) &&
          rgbClose(minha?.color, 94, 184, 255),
        JSON.stringify(minha)
      );
      const shotAzul = await saveClip(session, ".portal-field--tipo-plano-modalidade", "tipo_plano_minha_moto_azul.png");
      record("captura Minha Moto azul", Boolean(shotAzul) && fs.statSync(shotAzul).size > 400, shotAzul || "");

      const verde = await cdpEval(session, PAINT("DK MEU TRANSPORTE", "MOTO"));
      record(
        "DK MEU TRANSPORTE moto: classe verde",
        Boolean(verde?.cls?.includes("portal-tipo-plano--meu-transporte")) &&
          rgbClose(verde?.color, 110, 231, 160),
        JSON.stringify(verde)
      );
      const shotVerde = await saveClip(session, ".portal-field--tipo-plano-modalidade", "tipo_plano_transporte_moto_verde.png");
      record("captura Transporte moto verde", Boolean(shotVerde) && fs.statSync(shotVerde).size > 400, shotVerde || "");

      const marrom = await cdpEval(session, PAINT("DK MEU TRANSPORTE", "CARRO"));
      record(
        "DK MEU TRANSPORTE carro: classe marrom",
        Boolean(marrom?.cls?.includes("portal-tipo-plano--carro")) &&
          rgbClose(marrom?.color, 196, 164, 132),
        JSON.stringify(marrom)
      );
      const shotMarrom = await saveClip(session, ".portal-field--tipo-plano-modalidade", "tipo_plano_transporte_carro_marrom.png");
      record("captura Transporte carro marrom", Boolean(shotMarrom) && fs.statSync(shotMarrom).size > 400, shotMarrom || "");
    });
  });

  const failed = results.filter((r) => !r.ok);
  if (failed.length) {
    console.error(`FALHOU ${failed.length}/${results.length}`);
    process.exit(1);
  }
  console.log(`OK ${results.length}/${results.length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
