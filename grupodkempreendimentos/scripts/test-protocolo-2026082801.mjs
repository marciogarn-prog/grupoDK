/**
 * Protocolo 2026082801 com início 28/08/2026 tem de gravar.
 * node grupodkempreendimentos/scripts/test-protocolo-2026082801.mjs
 */
import fs from "fs";
import path from "path";
import vm from "vm";
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

function loadGuard() {
  const src = readLocal("dk-oficial-cadastro-guard.js");
  const sandbox = {
    window: { __DK_IS_DEMO_DEPLOY__: false },
    console,
  };
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox);
  return sandbox.window;
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
  const port = 3047;
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
  const userDir = fs.mkdtempSync("/tmp/dk-chrome-proto-2801-");
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
      `document.readyState === "complete" && !!document.getElementById("operacaoLocacaoCliente")`
    );
    if (ready) return;
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error("Cadastro de locação não carregou");
}

const SEED_SAVE = `(() => {
  const cliente = {
    id: 9301,
    cpf: "07246732454",
    nome: "FRANCISCO MARCIO SILVA DE JESUS",
    codigo: "0097",
    origemPortal: true,
  };
  const veiculo = {
    id: 9302,
    placa: "SPA3D88",
    modelo: "SHI 175 S EFI",
    tipo: "MOTO",
    origemPortal: true,
    createdAt: Date.now(),
    cadastradoPorCpf: "03037897430",
    cadastradoPorNome: "Marcio Santos",
  };
  const mergeBy = (key, rows, idFn) => {
    let cur = [];
    try {
      cur = JSON.parse(localStorage.getItem(key) || "[]");
    } catch {
      cur = [];
    }
    if (!Array.isArray(cur)) cur = [];
    rows.forEach((r) => {
      const id = idFn(r);
      const idx = cur.findIndex((x) => idFn(x) === id);
      if (idx >= 0) cur[idx] = { ...cur[idx], ...r };
      else cur.push(r);
    });
    localStorage.setItem(key, JSON.stringify(cur));
  };
  mergeBy("dk_clientes_cadastro", [cliente], (c) => String(c.cpf || "").replace(/\\D/g, ""));
  mergeBy("dk_veiculos_cadastro", [veiculo], (v) => String(v.placa || "").toUpperCase().replace(/[^A-Z0-9]/g, ""));
  if (typeof invalidateCadastroParseCache === "function") invalidateCadastroParseCache();
  localStorage.setItem(
    "dk_sessao_cliente",
    JSON.stringify({ tipo: "admin", cpf: "03037897430", nome: "Marcio Santos" })
  );
  return { ok: true };
})()`;

const SHOW = `(() => {
  document.getElementById("view-home")?.classList.remove("view--active");
  const unit = document.getElementById("view-unit");
  if (!unit) return { ok: false };
  unit.classList.add("view--active");
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

const SAVE_2801 = `(() => {
  const set = (id, v) => {
    const el = document.getElementById(id);
    if (!el) return false;
    el.value = v;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    return true;
  };
  set("operacaoLocacaoCpf", "072.467.324-54");
  set("operacaoLocacaoCliente", "FRANCISCO MARCIO SILVA DE JESUS");
  set("operacaoLocacaoClienteCodigo", "0097");
  set("operacaoLocacaoDataInicio", "28/08/2026");
  set("operacaoLocacaoValorAluguel", "310,00");
  set("operacaoLocacaoValorInvestimento", "20,00");
  set("operacaoLocacaoTipoPlano", "DK MINHA MOTO");
  set("operacaoLocacaoModelo", "SHI 175 S EFI");
  set("operacaoLocacaoPlaca", "SPA3D88");
  document.getElementById("operacaoLocacaoCpf")?.dispatchEvent(new Event("blur", { bubbles: true }));
  if (typeof window.refreshOperacaoLocacaoProtocoloPicker === "function") {
    window.refreshOperacaoLocacaoProtocoloPicker({ force: true });
  }
  const sel = document.getElementById("operacaoLocacaoProtocoloSelect");
  if (sel) {
    let novo = Array.from(sel.options).find((o) => o.value === "__PORTAL_PROTO_NOVO__");
    if (!novo) {
      novo = document.createElement("option");
      novo.value = "__PORTAL_PROTO_NOVO__";
      novo.textContent = "NOVO";
      sel.appendChild(novo);
    }
    sel.value = "__PORTAL_PROTO_NOVO__";
    const hid = document.getElementById("operacaoLocacaoProtocolo");
    if (hid) hid.value = "";
  }
  const form = document.getElementById("formOperacaoLocacaoInline");
  form?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  const msgAntes = String(document.getElementById("operacaoLocacaoInlineMsg")?.textContent || "");
  const modal = document.getElementById("portalLocacaoConfirmModal");
  const resumo = String(document.getElementById("portalLocacaoConfirmResumo")?.innerText || "");
  const modalAberta = Boolean(modal && !modal.classList.contains("hidden") && modal.getAttribute("aria-hidden") !== "true");
  document.getElementById("portalLocacaoConfirmSimBtn")?.click();
  const msgDepois = String(document.getElementById("operacaoLocacaoInlineMsg")?.textContent || "");
  let locs = [];
  try {
    locs = JSON.parse(localStorage.getItem("dk_locacoes_cadastro") || "[]");
  } catch {
    locs = [];
  }
  const hit = locs.find((l) => String(l.numeroContrato || "").replace(/\\D/g, "") === "2026082801");
  const bloqueado =
    typeof window.__DK_isLocacaoNcOficialmenteBloqueado === "function"
      ? window.__DK_isLocacaoNcOficialmenteBloqueado({
          numeroContrato: "2026082801",
          inicio: "28/08/2026",
        })
      : null;
  return {
    msgAntes,
    msgDepois,
    modalAberta,
    resumo,
    resumoTem2801: /2026082801/.test(resumo),
    nLocs: locs.length,
    gravou2801: Boolean(hit),
    gravouNome: String(hit?.nome || ""),
    gravouPlaca: String(hit?.placa || ""),
    bloqueado,
  };
})()`;

async function main() {
  const guardSrc = readLocal("dk-oficial-cadastro-guard.js");
  const apiSrc = readLocal("api/dk-cloud-snapshot.js");
  record(
    "Guard tem a regra 2026082801 válido em 28/08/2026",
    guardSrc.includes("isLocacaoNcOficialmenteBloqueado") &&
      guardSrc.includes("Em 28/08/2026 o primeiro protocolo do dia É 2026082801")
  );
  record(
    "Guard já não remapeia 2026082801 para 2026011601",
    !guardSrc.includes('"2026082801": "2026011601"')
  );
  record("API da nuvem usa o mesmo desbloqueio por data", apiSrc.includes("isLocacaoNcOficialmenteBloqueado"));

  const w = loadGuard();
  const fn = w.__DK_isLocacaoNcOficialmenteBloqueado;
  record("Função de bloqueio exportada", typeof fn === "function");
  record(
    "2026082801 + início 28/08/2026 NÃO é bloqueado",
    typeof fn === "function" &&
      fn({ numeroContrato: "2026082801", inicio: "28/08/2026", cpf: "07246732454", nome: "FRANCISCO", placa: "SPA3D88" }) ===
        false
  );
  record(
    "2026082801 + início 16/01/2026 continua bloqueado (typo antigo)",
    typeof fn === "function" &&
      fn({ numeroContrato: "2026082801", inicio: "16/01/2026", cpf: "07246732454", nome: "X", placa: "SPA3D88" }) === true
  );
  const filtrado = typeof w.__DK_filterOficialCadastroArray === "function"
    ? w.__DK_filterOficialCadastroArray("dk_locacoes_cadastro", [
        {
          numeroContrato: "2026082801",
          inicio: "28/08/2026",
          cpf: "07246732454",
          nome: "FRANCISCO MARCIO SILVA DE JESUS",
          placa: "SPA3D88",
          origemPortal: true,
          createdAt: Date.now(),
        },
      ])
    : [];
  record(
    "Filtro oficial deixa passar a locação 2026082801 de 28/08",
    Array.isArray(filtrado) && filtrado.length === 1,
    JSON.stringify({ n: filtrado.length })
  );

  let browserOk = false;
  try {
    await withLocalServer(async (base) => {
      await withChromePage(async (session) => {
        await cdpGoto(session, base);
        record("Browser: dados Francisco/SPA3D88", Boolean((await cdpEval(session, SEED_SAVE))?.ok));
        record("Browser: cadastro de locação visível", Boolean((await cdpEval(session, SHOW))?.ok));
        const saved = await cdpEval(session, SAVE_2801);
        record(
          "Browser: confirmar cadastro grava o protocolo 2026082801",
          Boolean(
            saved &&
              saved.modalAberta &&
              saved.resumoTem2801 &&
              saved.gravou2801 &&
              /FRANCISCO/i.test(saved.gravouNome || "") &&
              saved.bloqueado === false &&
              !/não ficou gravado/i.test(saved.msgDepois || "")
          ),
          JSON.stringify(saved)
        );
        browserOk = Boolean(saved && saved.gravou2801 && saved.bloqueado === false);
      });
    });
  } catch (err) {
    record("Browser Chrome", false, err?.message || String(err));
  }

  const pass = results.filter((r) => r.ok).length;
  console.log(`\n--- ${pass}/${results.length} testes protocolo 2026082801 ---`);
  process.exit(pass === results.length && browserOk ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
