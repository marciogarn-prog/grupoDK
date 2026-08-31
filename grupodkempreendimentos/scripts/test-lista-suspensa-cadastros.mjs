/**
 * Lista suspensa ao digitar nome/CPF/placa/protocolo/código nas telas de cadastro.
 * node grupodkempreendimentos/scripts/test-lista-suspensa-cadastros.mjs
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
  const port = 3044;
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
  const debugPort = 9227;
  const userDir = fs.mkdtempSync("/tmp/dk-chrome-lista-suspensa-");
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
      `document.readyState === "complete" && !!document.getElementById("operacaoClienteNome") && !!document.getElementById("operacaoLocacaoCliente")`
    );
    if (ready) return;
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error("Telas de cadastro não carregaram");
}

const SEED = `(() => {
  const cliente = {
    id: 9001,
    createdAt: Date.now(),
    cpf: "10162384440",
    nome: "LUYS FHERNANDO BARROS DE FARIAS",
    codigo: "0368",
    origemPortal: true,
  };
  const loc = {
    id: 9002,
    numeroContrato: "2026081101",
    cpf: "10162384440",
    nome: "LUYS FHERNANDO BARROS DE FARIAS",
    placa: "PET6I93",
    inicio: "11/08/2026",
    fim: "",
  };
  localStorage.setItem("dk_clientes_cadastro", JSON.stringify([cliente]));
  localStorage.setItem("dk_locacoes_cadastro", JSON.stringify([loc]));
  return { ok: true };
})()`;

function showPane(paneId) {
  return `(() => {
    document.getElementById("view-home")?.classList.remove("view--active");
    const unit = document.getElementById("view-unit");
    if (!unit) return { ok: false, reason: "view-unit" };
    unit.classList.add("view--active");
    unit.setAttribute("aria-hidden", "false");
    document.body.classList.add("portal-body--equipa-sessao", "portal-body--admin-logado");
    const ids = ["panel-operacao-locadora", ${JSON.stringify(paneId)}];
    document.querySelectorAll(".operacao-inline-form").forEach((el) => {
      if (el.id !== ${JSON.stringify(paneId)}) el.classList.add("hidden");
    });
    for (const id of ids) {
      const el = document.getElementById(id);
      if (!el) return { ok: false, reason: id };
      el.classList.remove("hidden");
      el.removeAttribute("hidden");
      el.hidden = false;
    }
    return { ok: true };
  })()`;
}

const TYPE_NOME_CLIENTE = `(() => {
  const inp = document.getElementById("operacaoClienteNome");
  if (!inp) return { ok: false };
  inp.value = "luys";
  inp.dispatchEvent(new Event("input", { bubbles: true }));
  const panel = document.getElementById("operacaoClienteNomeListaPrefixo");
  const text = String(panel?.innerText || "");
  const hidden = panel?.classList.contains("hidden") || panel?.hasAttribute("hidden");
  return {
    ok: true,
    hidden,
    text,
    hasLuys: /LUYS/i.test(text),
    hasCpf: /101\\.623\\.844-40|10162384440/.test(text),
  };
})()`;

const CLICK_CLIENTE = `(() => {
  const btn = document.querySelector("#operacaoClienteNomeListaPrefixo .portal-cliente-prefix-list__btn");
  if (!btn) return { ok: false, reason: "sem botão" };
  btn.click();
  return {
    ok: true,
    nome: String(document.getElementById("operacaoClienteNome")?.value || ""),
    cpf: String(document.getElementById("operacaoClienteCpf")?.value || ""),
  };
})()`;

const TYPE_NOME_LOCACAO = `(() => {
  const inp = document.getElementById("operacaoLocacaoCliente");
  if (!inp) return { ok: false };
  inp.value = "luys";
  inp.dispatchEvent(new Event("input", { bubbles: true }));
  const panel = document.getElementById("operacaoLocacaoPesquisaLista");
  const text = String(panel?.innerText || "");
  const hidden = panel?.classList.contains("hidden") || panel?.hasAttribute("hidden");
  return {
    ok: true,
    hidden,
    text,
    hasLuys: /LUYS/i.test(text),
    hasProto: /2026081101/.test(text),
    hasPlaca: /PET6I93/.test(text),
  };
})()`;

const TYPE_PLACA_LOCACAO = `(() => {
  const inp = document.getElementById("operacaoLocacaoPlaca");
  if (!inp) return { ok: false };
  inp.value = "PET";
  inp.dispatchEvent(new Event("input", { bubbles: true }));
  const panel = document.getElementById("operacaoLocacaoPesquisaLista");
  const text = String(panel?.innerText || "");
  return {
    ok: true,
    hidden: panel?.classList.contains("hidden"),
    hasLuys: /LUYS/i.test(text),
    hasPlaca: /PET6I93/.test(text),
  };
})()`;

async function capture(session, selector, filename) {
  const clip = await cdpEval(
    session,
    `(() => {
      const el = document.querySelector(${JSON.stringify(selector)}) || document.body;
      el.scrollIntoView();
      const r = el.getBoundingClientRect();
      return {
        x: Math.max(0, r.x),
        y: Math.max(0, r.y),
        width: Math.max(1, Math.min(r.width, 1400)),
        height: Math.max(1, Math.min(r.height, 900)),
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
  const js = readLocal("portal-locadora-ui.js");

  record("HTML tem lista no cadastro de cliente", html.includes("operacaoClienteNomeListaPrefixo") && html.includes("portal-sugestoes-cadastro"));
  record("HTML tem lista no cadastro de locação", html.includes("operacaoLocacaoPesquisaLista"));
  record("JS filtra nome/CPF/placa/protocolo/código", js.includes("filterPortalSugestoesLinhas") && js.includes("codigoQ"));
  record("CSS marca a lista suspensa de confirmação", css.includes("lista suspensa de confirmação ao digitar cadastro"));

  let browserOk = false;
  try {
    await withLocalServer(async (base) => {
      await withChromePage(async (session) => {
        await cdpGoto(session, base);
        await session.send("Emulation.setDeviceMetricsOverride", {
          width: 1400,
          height: 900,
          deviceScaleFactor: 1,
          mobile: false,
        });
        const seeded = await cdpEval(session, SEED);
        record("Browser: cadastro LUYS gravado no navegador", Boolean(seeded?.ok));

        const shownCli = await cdpEval(session, showPane("operacaoInlineCliente"));
        record("Browser: cadastro de cliente visível", Boolean(shownCli?.ok), shownCli?.reason || "");
        const typedCli = await cdpEval(session, TYPE_NOME_CLIENTE);
        record(
          "Browser: digitar luys no cadastro de cliente abre a lista",
          Boolean(typedCli?.ok && typedCli.hasLuys && !typedCli.hidden),
          JSON.stringify({ hidden: typedCli?.hidden, hasLuys: typedCli?.hasLuys, text: String(typedCli?.text || "").slice(0, 180) })
        );
        await capture(session, "#operacaoInlineCliente", "lista_suspensa_cadastro_cliente.png");
        const clicked = await cdpEval(session, CLICK_CLIENTE);
        record(
          "Browser: clicar na lista preenche CPF e nome do cliente",
          Boolean(clicked?.ok && /LUYS/i.test(clicked?.nome || "") && String(clicked?.cpf || "").includes("101")),
          JSON.stringify(clicked)
        );

        const shownLoc = await cdpEval(session, showPane("operacaoInlineLocacao"));
        record("Browser: cadastro de locação visível", Boolean(shownLoc?.ok), shownLoc?.reason || "");
        const typedLoc = await cdpEval(session, TYPE_NOME_LOCACAO);
        record(
          "Browser: digitar luys no cadastro de locação abre a lista",
          Boolean(typedLoc?.ok && typedLoc.hasLuys && !typedLoc.hidden),
          JSON.stringify({ hidden: typedLoc?.hidden, hasLuys: typedLoc?.hasLuys, hasProto: typedLoc?.hasProto, hasPlaca: typedLoc?.hasPlaca })
        );
        await capture(session, "#operacaoInlineLocacao", "lista_suspensa_cadastro_locacao.png");

        await cdpEval(
          session,
          `(() => {
            const n = document.getElementById("operacaoLocacaoCliente");
            if (n) n.value = "";
            return true;
          })()`
        );
        const typedPlaca = await cdpEval(session, TYPE_PLACA_LOCACAO);
        record(
          "Browser: digitar placa PET no cadastro de locação abre a lista",
          Boolean(typedPlaca?.ok && typedPlaca.hasLuys && typedPlaca.hasPlaca && !typedPlaca.hidden),
          JSON.stringify(typedPlaca)
        );

        browserOk =
          Boolean(typedCli?.hasLuys && !typedCli.hidden) &&
          Boolean(typedLoc?.hasLuys && !typedLoc.hidden) &&
          Boolean(typedPlaca?.hasPlaca && !typedPlaca.hidden);
      });
    });
  } catch (err) {
    record("Browser Chrome", false, err?.message || String(err));
  }

  const pass = results.filter((r) => r.ok).length;
  console.log(`\n--- ${pass}/${results.length} testes lista suspensa cadastros ---`);
  process.exit(pass === results.length && browserOk ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
