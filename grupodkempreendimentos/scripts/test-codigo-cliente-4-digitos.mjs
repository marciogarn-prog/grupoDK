/**
 * Cód. do cliente no padrão de 4 dígitos: CLIENTE 386 → 0386; novos cadastros seguem 0387…
 * node grupodkempreendimentos/scripts/test-codigo-cliente-4-digitos.mjs
 */
import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import { fileURLToPath } from "url";
import vm from "vm";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const results = [];

function record(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} | ${name}${detail ? ` | ${detail}` : ""}`);
}

function readLocal(rel) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

function loadFormatter() {
  const src = readLocal("app.js");
  const m = src.match(/function formatClienteCodigoPadrao\(raw\) \{[\s\S]*?\n\}/);
  if (!m) throw new Error("formatClienteCodigoPadrao não encontrado em app.js");
  const sandbox = {
    onlyDigits: (v) => String(v ?? "").replace(/\D/g, ""),
  };
  vm.createContext(sandbox);
  vm.runInContext(`${m[0]}; this.fn = formatClienteCodigoPadrao;`, sandbox);
  return sandbox.fn;
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
  const port = 3048;
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
  const debugPort = 9231;
  const userDir = fs.mkdtempSync("/tmp/dk-chrome-cod-4dig-");
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
      `document.readyState === "complete" && typeof formatClienteCodigoPadrao === "function"`
    );
    if (ready) return;
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error("app.js não carregou formatClienteCodigoPadrao");
}

const SEED = `(() => {
  const paulo = {
    id: 9386,
    cpf: "26133458407",
    nome: "PAULO CESAR CHAGAS",
    codigo: "CLIENTE 386",
    dataCadastro: "26/08/2026",
    origemPortal: true,
    createdAt: Date.now(),
  };
  const planilha = {
    id: 9373,
    cpf: "07246732454",
    nome: "FRANCISCO MARCIO SILVA DE JESUS",
    codigo: "0373",
    dataCadastro: "25/08/2026",
    origemPortal: true,
    createdAt: Date.now() - 1000,
  };
  let cur = [];
  try {
    cur = JSON.parse(localStorage.getItem("dk_clientes_cadastro") || "[]");
  } catch {
    cur = [];
  }
  if (!Array.isArray(cur)) cur = [];
  [paulo, planilha].forEach((r) => {
    const cpf = String(r.cpf || "").replace(/\\D/g, "");
    const idx = cur.findIndex((x) => String(x.cpf || "").replace(/\\D/g, "") === cpf);
    if (idx >= 0) cur[idx] = { ...cur[idx], ...r };
    else cur.push(r);
  });
  localStorage.setItem("dk_clientes_cadastro", JSON.stringify(cur));
  if (typeof invalidateCadastroParseCache === "function") invalidateCadastroParseCache();
  localStorage.setItem(
    "dk_sessao_cliente",
    JSON.stringify({ tipo: "admin", cpf: "03037897430", nome: "Marcio Santos" })
  );
  return { ok: true, n: cur.length };
})()`;

const SHOW_CLIENTE = `(() => {
  document.getElementById("view-home")?.classList.remove("view--active");
  const unit = document.getElementById("view-unit");
  if (!unit) return { ok: false };
  unit.classList.add("view--active");
  document.body.classList.add("portal-body--equipa-sessao", "portal-body--admin-logado");
  for (const id of ["panel-operacao-locadora", "operacaoInlineCliente"]) {
    const el = document.getElementById(id);
    if (!el) return { ok: false, reason: id };
    el.classList.remove("hidden");
    el.removeAttribute("hidden");
    el.hidden = false;
  }
  document.querySelectorAll(".operacao-inline-form").forEach((el) => {
    if (el.id !== "operacaoInlineCliente") el.classList.add("hidden");
  });
  return { ok: true };
})()`;

async function main() {
  const appSrc = readLocal("app.js");
  const uiSrc = readLocal("portal-locadora-ui.js");
  record(
    "app.js gera o próximo código em 4 dígitos",
    appSrc.includes("return formatClienteCodigoPadrao(next);") &&
      !appSrc.includes("return `CLIENTE ${next}`")
  );
  record(
    "normalizeClienteCodigos grava 4 dígitos (não CLIENTE N)",
    appSrc.includes("result[idx].codigo = formatClienteCodigoPadrao(seq);") &&
      !appSrc.includes("result[idx].codigo = `CLIENTE ${seq}`")
  );
  record("portal formata CLIENTE 386 no relatório", uiSrc.includes("formatPortalClienteCodigoPadrao"));

  const fmt = loadFormatter();
  record("CLIENTE 386 → 0386", fmt("CLIENTE 386") === "0386", String(fmt("CLIENTE 386")));
  record("0373 permanece 0373", fmt("0373") === "0373", String(fmt("0373")));
  record("386 → 0386", fmt("386") === "0386", String(fmt("386")));
  record("392 → 0392", fmt("CLIENTE 392") === "0392", String(fmt("CLIENTE 392")));
  record("10000 não corta", fmt("10000") === "10000", String(fmt("10000")));
  record("vazio continua vazio", fmt("") === "" && fmt("CLIENTE") === "");

  await withLocalServer(async (base) => {
    await withChromePage(async (session) => {
      await cdpGoto(session, base);
      const seeded = await cdpEval(session, SEED);
      record("seed CLIENTE 386 + 0373", Boolean(seeded?.ok), JSON.stringify(seeded));

      const live = await cdpEval(
        session,
        `(() => {
          const fmt = typeof formatClienteCodigoPadrao === "function" ? formatClienteCodigoPadrao : null;
          const next = typeof nextClienteCodigo === "function" ? nextClienteCodigo() : "";
          let loaded = [];
          if (typeof loadCadastro === "function") {
            loaded = loadCadastro("dk_clientes_cadastro");
          }
          const paulo = loaded.find((c) => /PAULO CESAR CHAGAS/i.test(String(c.nome || "")));
          const fran = loaded.find((c) => /FRANCISCO MARCIO/i.test(String(c.nome || "")));
          const ctx =
            typeof window.__DK_getPortalRelatorioClienteContext === "function"
              ? window.__DK_getPortalRelatorioClienteContext()
              : null;
          const codes = Array.isArray(ctx?.rows) ? ctx.rows.map((r) => String(r[0] || "")) : [];
          return {
            fmt386: fmt ? fmt("CLIENTE 386") : null,
            fmt373: fmt ? fmt("0373") : null,
            next,
            nextTemCliente: /CLIENTE/i.test(String(next)),
            next4dig: /^\\d{4,}$/.test(String(next)),
            pauloCodigo: String(paulo?.codigo || ""),
            franCodigo: String(fran?.codigo || ""),
            reportTem0386: codes.includes("0386"),
            reportTem0373: codes.includes("0373"),
            reportTemCliente386: codes.some((c) => /CLIENTE\\s*386/i.test(c)),
            nRows: codes.length,
          };
        })()`
      );
      record("função no browser: CLIENTE 386 → 0386", live?.fmt386 === "0386", JSON.stringify(live));
      record("função no browser: 0373 permanece", live?.fmt373 === "0373");
      record(
        "próximo código é só dígitos (não CLIENTE N)",
        Boolean(live?.next4dig) && live?.nextTemCliente === false,
        `next=${live?.next}`
      );
      record("loadCadastro troca CLIENTE 386 por 0386", live?.pauloCodigo === "0386", `paulo=${live?.pauloCodigo}`);
      record("código da planilha 0373 mantém-se", live?.franCodigo === "0373", `fran=${live?.franCodigo}`);
      record("relatório lista 0386 e não CLIENTE 386", live?.reportTem0386 === true && live?.reportTemCliente386 === false, JSON.stringify({
        nRows: live?.nRows,
        reportTem0386: live?.reportTem0386,
        reportTemCliente386: live?.reportTemCliente386,
        reportTem0373: live?.reportTem0373,
      }));

      const shown = await cdpEval(session, SHOW_CLIENTE);
      record("ecrã Cadastro de cliente visível", Boolean(shown?.ok), JSON.stringify(shown));
      const clicked = await cdpEval(
        session,
        `(() => {
          document.getElementById("operacaoClienteGerarRelatorioBtn")?.click();
          const preview = String(document.getElementById("portalRelatorioPreview")?.innerText || "");
          const modal = document.getElementById("portalRelatorioModal");
          const aberta = Boolean(modal && !modal.classList.contains("hidden"));
          return {
            aberta,
            tem0386: /\\b0386\\b/.test(preview),
            temCliente386: /CLIENTE\\s*386/i.test(preview),
            temPaulo: /PAULO CESAR CHAGAS/i.test(preview),
            previewHead: preview.slice(0, 240),
          };
        })()`
      );
      record(
        "pré-visualização do relatório mostra 0386 (não CLIENTE 386)",
        Boolean(clicked?.aberta) && clicked?.tem0386 === true && clicked?.temCliente386 === false && clicked?.temPaulo === true,
        JSON.stringify(clicked)
      );
    });
  });

  const fails = results.filter((r) => !r.ok);
  console.log(`\n--- ${results.length - fails.length}/${results.length} testes código 4 dígitos ---`);
  if (fails.length) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
