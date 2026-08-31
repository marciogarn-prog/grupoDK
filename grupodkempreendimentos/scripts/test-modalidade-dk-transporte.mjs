/**
 * DK MEU TRANSPORTE: marcar CARRO tem de cadastrar a locação.
 * node grupodkempreendimentos/scripts/test-modalidade-dk-transporte.mjs
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
  const port = 3046;
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
  const debugPort = 9230;
  const userDir = fs.mkdtempSync("/tmp/dk-chrome-mod-carro-");
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

const SEED = `(() => {
  const cliente = {
    id: 9201,
    cpf: "06814612410",
    nome: "PAULO CESAR CHAGAS",
    codigo: "0386",
    origemPortal: true,
  };
  const veiculo = {
    id: 9202,
    placa: "QYR9B66",
    modelo: "GOL 1.0 L MC4",
    tipo: "CARRO",
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

const LIMPAR_E_RADIOS = `(() => {
  document.getElementById("operacaoLocacaoLimparBtn")?.click();
  const carro = document.getElementById("operacaoLocacaoModalidadeCarro");
  const moto = document.getElementById("operacaoLocacaoModalidadeMoto");
  return {
    carroValue: String(carro?.value || ""),
    motoValue: String(moto?.value || ""),
    carroChecked: Boolean(carro?.checked),
    motoChecked: Boolean(moto?.checked),
  };
})()`;

const VALUE_VAZIO_CLICA_CARRO = `(() => {
  const carro = document.getElementById("operacaoLocacaoModalidadeCarro");
  const moto = document.getElementById("operacaoLocacaoModalidadeMoto");
  if (!carro || !moto) return { ok: false };
  carro.value = "";
  moto.value = "";
  carro.checked = true;
  moto.checked = false;
  const marcada =
    typeof window.__DK_getOperacaoLocacaoModalidadeMarcada === "function"
      ? window.__DK_getOperacaoLocacaoModalidadeMarcada()
      : "";
  return {
    ok: true,
    marcada,
    carroValue: String(carro.value || ""),
    motoValue: String(moto.value || ""),
    carroChecked: Boolean(carro.checked),
  };
})()`;

const PREENCHE_E_CADASTRA = `(() => {
  const set = (id, v) => {
    const el = document.getElementById(id);
    if (!el) return false;
    el.value = v;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    return true;
  };
  set("operacaoLocacaoCpf", "068.146.124-10");
  set("operacaoLocacaoCliente", "PAULO CESAR CHAGAS");
  set("operacaoLocacaoClienteCodigo", "0386");
  set("operacaoLocacaoDataInicio", "26/08/2026");
  set("operacaoLocacaoValorAluguel", "600,00");
  set("operacaoLocacaoValorInvestimento", "0,00");
  set("operacaoLocacaoTipoPlano", "DK MEU TRANSPORTE");
  set("operacaoLocacaoModelo", "GOL 1.0 L MC4");
  set("operacaoLocacaoPlaca", "QYR9B66");
  document.getElementById("operacaoLocacaoCpf")?.dispatchEvent(new Event("blur", { bubbles: true }));
  const wrap = document.getElementById("operacaoLocacaoModalidadeWrap");
  if (wrap) {
    wrap.classList.remove("hidden");
    wrap.hidden = false;
    wrap.setAttribute("aria-hidden", "false");
  }
  const carro = document.getElementById("operacaoLocacaoModalidadeCarro");
  const moto = document.getElementById("operacaoLocacaoModalidadeMoto");
  if (moto) moto.checked = false;
  if (carro) {
    carro.value = "CARRO";
    carro.checked = true;
    carro.dispatchEvent(new Event("change", { bubbles: true }));
  }
  if (typeof window.refreshOperacaoLocacaoProtocoloPicker === "function") {
    window.refreshOperacaoLocacaoProtocoloPicker({ force: true });
  }
  const sel = document.getElementById("operacaoLocacaoProtocoloSelect");
  if (sel) {
    const novo = Array.from(sel.options).find((o) => o.value === "__PORTAL_PROTO_NOVO__");
    if (novo) sel.value = novo.value;
    else {
      const opt = document.createElement("option");
      opt.value = "__PORTAL_PROTO_NOVO__";
      opt.textContent = "NOVO";
      sel.appendChild(opt);
      sel.value = "__PORTAL_PROTO_NOVO__";
    }
    const hid = document.getElementById("operacaoLocacaoProtocolo");
    if (hid) hid.value = "";
  }
  const marcada =
    typeof window.__DK_getOperacaoLocacaoModalidadeMarcada === "function"
      ? window.__DK_getOperacaoLocacaoModalidadeMarcada()
      : "";
  const form = document.getElementById("formOperacaoLocacaoInline");
  form?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  const msg = String(document.getElementById("operacaoLocacaoInlineMsg")?.textContent || "");
  const modal = document.getElementById("portalLocacaoConfirmModal");
  const modalAberta = Boolean(modal && !modal.classList.contains("hidden") && modal.getAttribute("aria-hidden") !== "true");
  document.getElementById("portalLocacaoConfirmSimBtn")?.click();
  const msgDepois = String(document.getElementById("operacaoLocacaoInlineMsg")?.textContent || "");
  let locs = [];
  try {
    locs = JSON.parse(localStorage.getItem("dk_locacoes_cadastro") || "[]");
  } catch {
    locs = [];
  }
  const onlyDig = (s) => String(s || "").replace(/\\D/g, "");
  const paulo = locs.filter((l) => onlyDig(l.cpf) === "06814612410");
  const last = paulo[paulo.length - 1] || null;
  return {
    marcada,
    msg,
    msgDepois,
    modalAberta,
    dizEscolha: /marque CARRO ou MOTO/i.test(msg) || /marque CARRO ou MOTO/i.test(msgDepois),
    nPaulo: paulo.length,
    modalidade: String(last?.modalidade || ""),
    placa: String(last?.placa || ""),
    nome: String(last?.nome || ""),
  };
})()`;

async function capture(session, filename) {
  const clip = await cdpEval(
    session,
    `(() => {
      const el = document.getElementById("operacaoInlineLocacao") || document.body;
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
  const js = readLocal("portal-locadora-ui.js");
  record(
    "JS não esvazia o value dos rádios CARRO/MOTO ao Limpar",
    js.includes("portalEsvaziarCamposTextoDoFormulario") && js.includes('t === "radio"')
  );
  record(
    "JS lê CARRO/MOTO pelo rádio marcado, não só pelo value",
    js.includes("if (carro?.checked) return \"CARRO\"") && js.includes("if (moto?.checked) return \"MOTO\"")
  );

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
        record("Browser: dados Paulo/Gol", Boolean((await cdpEval(session, SEED))?.ok));
        record("Browser: cadastro de locação visível", Boolean((await cdpEval(session, SHOW))?.ok));

        const limpo = await cdpEval(session, LIMPAR_E_RADIOS);
        record(
          "Browser: Limpar mantém value CARRO/MOTO nos rádios",
          Boolean(limpo && limpo.carroValue === "CARRO" && limpo.motoValue === "MOTO"),
          JSON.stringify(limpo)
        );

        const vazio = await cdpEval(session, VALUE_VAZIO_CLICA_CARRO);
        record(
          "Browser: rádio CARRO marcado com value vazio ainda conta como CARRO",
          Boolean(vazio && vazio.ok && vazio.marcada === "CARRO" && vazio.carroValue === "CARRO"),
          JSON.stringify(vazio)
        );

        const saved = await cdpEval(session, PREENCHE_E_CADASTRA);
        record(
          "Browser: Cadastrar locação com CARRO não pede para escolher carro ou moto",
          Boolean(saved && !saved.dizEscolha && saved.modalAberta && saved.marcada === "CARRO"),
          JSON.stringify(saved)
        );
        record(
          "Browser: locação do Paulo gravada como CARRO",
          Boolean(saved && saved.nPaulo >= 1 && saved.modalidade === "CARRO" && /PAULO/i.test(saved.nome || "")),
          JSON.stringify(saved)
        );
        await capture(session, "locacao_dk_transporte_carro.png");
        browserOk =
          Boolean(limpo && limpo.carroValue === "CARRO" && limpo.motoValue === "MOTO") &&
          Boolean(vazio && vazio.marcada === "CARRO") &&
          Boolean(saved && !saved.dizEscolha && saved.nPaulo >= 1 && saved.modalidade === "CARRO");
      });
    });
  } catch (err) {
    record("Browser Chrome", false, err?.message || String(err));
  }

  const pass = results.filter((r) => r.ok).length;
  console.log(`\n--- ${pass}/${results.length} testes modalidade DK MEU TRANSPORTE ---`);
  process.exit(pass === results.length && browserOk ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
