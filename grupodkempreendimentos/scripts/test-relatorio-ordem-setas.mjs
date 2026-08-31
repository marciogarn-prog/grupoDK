/**
 * Setas ↓/↑ na pré-visualização do relatório: primeiro→último e último→primeiro.
 * node grupodkempreendimentos/scripts/test-relatorio-ordem-setas.mjs
 */
import fs from "fs";
import path from "path";
import { spawn } from "child_process";
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
  const port = 3049;
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
  const debugPort = 9232;
  const userDir = fs.mkdtempSync("/tmp/dk-chrome-rel-ordem-");
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
      `document.readyState === "complete" && typeof window.__DK_emitPortalRelatorioPdf === "function"`
    );
    if (ready) return;
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error("Portal não carregou emitPortalRelatorioPdf");
}

const SEED = `(() => {
  const mk = (proto, nome, cpf, placa) => ({
    id: Number(proto),
    numeroContrato: proto,
    cpf,
    nome,
    clienteCodigo: "0386",
    placa,
    marcaModelo: "SHI 175 S EFI",
    inicio: "21/08/2026",
    fim: proto === "2026082101" ? "22/08/2026" : "",
    statusLocacao: proto === "2026082101" ? "FINALIZADO" : "ATIVO",
    plano: "DK MINHA MOTO",
    origemPortal: true,
    createdAt: Number(proto),
    cadastradoPorCpf: "03037897430",
    cadastradoPorNome: "Marcio Santos",
  });
  const locs = [
    mk("2026082103", "JOSE UEBERT SANTOS DE SOUZA", "07211122233", "SPA3D90"),
    mk("2026082101", "PAULO CESAR CHAGAS", "07211122211", "SPA3D88"),
    mk("2026082102", "JEFFERSON DE SA NUNES", "07211122222", "SPA3D89"),
  ];
  localStorage.setItem("dk_locacoes_cadastro", JSON.stringify(locs));
  if (typeof invalidateCadastroParseCache === "function") invalidateCadastroParseCache();
  localStorage.setItem(
    "dk_sessao_cliente",
    JSON.stringify({ tipo: "admin", cpf: "03037897430", nome: "Marcio Santos" })
  );
  return { ok: true, n: locs.length };
})()`;

const IFRAME_PROTOS = `(() => {
  const iframe = document.getElementById("portalPdfIframe");
  const viewer = document.getElementById("portalRelatorioPdfViewer");
  const visivel = Boolean(viewer && !viewer.classList.contains("hidden"));
  let first = "";
  let last = "";
  let n = 0;
  try {
    const cells = iframe?.contentDocument?.querySelectorAll("tbody tr td:first-child");
    n = cells ? cells.length : 0;
    if (cells && cells.length) {
      first = String(cells[0].textContent || "").trim();
      last = String(cells[cells.length - 1].textContent || "").trim();
    }
  } catch (e) {
    return { visivel, err: String(e.message || e) };
  }
  const down = document.getElementById("portalPdfOrdemPrimeiroBtn");
  const up = document.getElementById("portalPdfOrdemUltimoBtn");
  return {
    visivel,
    first,
    last,
    n,
    temSetaDown: Boolean(down) && String(down.textContent || "").includes("↓"),
    temSetaUp: Boolean(up) && String(up.textContent || "").includes("↑"),
    downPressed: down?.getAttribute("aria-pressed") === "true",
    upPressed: up?.getAttribute("aria-pressed") === "true",
  };
})()`;

async function waitProtos(session) {
  for (let i = 0; i < 40; i += 1) {
    const r = await cdpEval(session, IFRAME_PROTOS);
    if (r?.first) return r;
    await new Promise((x) => setTimeout(x, 80));
  }
  return cdpEval(session, IFRAME_PROTOS);
}

async function waitFirst(session, expected) {
  let last = null;
  for (let i = 0; i < 50; i += 1) {
    last = await cdpEval(session, IFRAME_PROTOS);
    if (last?.first === expected) return last;
    await new Promise((x) => setTimeout(x, 80));
  }
  return last;
}

async function main() {
  const html = readLocal("index.html");
  const ui = readLocal("portal-locadora-ui.js");
  const css = readLocal("styles.css");
  record("HTML tem botão seta para baixo (primeiro → último)", html.includes("portalPdfOrdemPrimeiroBtn"));
  record("HTML tem botão seta para cima (último → primeiro)", html.includes("portalPdfOrdemUltimoBtn"));
  record("JS ordena cadastros do relatório", ui.includes("sortPortalRelatorioRowsCadastro"));
  record("JS aplica ordem ao clicar nas setas", ui.includes("applyPortalRelatorioOrdemCadastro"));
  record("CSS das setas na barra do relatório", css.includes("portal-pdf-viewer__sort-btn"));

  await withLocalServer(async (base) => {
    await withChromePage(async (session) => {
      await cdpGoto(session, base);
      const seeded = await cdpEval(session, SEED);
      record("seed 3 protocolos fora de ordem", Boolean(seeded?.ok), JSON.stringify(seeded));

      const opened = await cdpEval(
        session,
        `(() => {
          const ctx = window.__DK_getPortalRelatorioLocacaoContext?.();
          if (!ctx) return { ok: false, reason: "sem context" };
          window.__DK_applyPortalRelatorioOrdemCadastro("asc");
          window.__DK_emitPortalRelatorioPdf(ctx);
          return { ok: true, n: (ctx.rows || []).length, firstCtx: ctx.rows?.[0]?.[0] };
        })()`
      );
      record("abriu relatório de locações", Boolean(opened?.ok), JSON.stringify(opened));

      const asc = await waitProtos(session);
      record(
        "setas ↓ e ↑ visíveis na barra",
        Boolean(asc?.temSetaDown && asc?.temSetaUp),
        JSON.stringify({ down: asc?.temSetaDown, up: asc?.temSetaUp })
      );
      record(
        "↓ primeiro → último (2026082101 no topo)",
        asc?.first === "2026082101" && asc?.last === "2026082103",
        JSON.stringify(asc)
      );

      const sortedDesc = await cdpEval(
        session,
        `(() => {
          const fn = window.__DK_sortPortalRelatorioRowsCadastro;
          if (typeof fn !== "function") return { ok: false };
          const rows = [["2026082101"], ["2026082102"], ["2026082103"]];
          const desc = fn(rows, ["Protocolo"], "desc").map((r) => r[0]);
          const ascv = fn(rows, ["Protocolo"], "asc").map((r) => r[0]);
          return { ok: true, desc, ascv };
        })()`
      );
      record(
        "função de ordenação inverte 2101/2103",
        sortedDesc?.desc?.[0] === "2026082103" && sortedDesc?.ascv?.[0] === "2026082101",
        JSON.stringify(sortedDesc)
      );

      await cdpEval(session, `document.getElementById("portalPdfOrdemUltimoBtn")?.click()`);
      const desc = await waitFirst(session, "2026082103");
      record(
        "↑ último → primeiro (2026082103 no topo)",
        desc?.first === "2026082103" && desc?.last === "2026082101",
        JSON.stringify(desc)
      );

      await cdpEval(session, `document.getElementById("portalPdfOrdemPrimeiroBtn")?.click()`);
      const back = await waitFirst(session, "2026082101");
      record(
        "↓ devolve o primeiro cadastro ao topo",
        back?.first === "2026082101" && back?.last === "2026082103",
        JSON.stringify(back)
      );
    });
  });

  const fails = results.filter((r) => !r.ok);
  console.log(`\n--- ${results.length - fails.length}/${results.length} testes ordem setas relatório ---`);
  if (fails.length) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
