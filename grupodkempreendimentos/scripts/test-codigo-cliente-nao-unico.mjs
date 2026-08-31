/**
 * Cód. do cliente é único: locação de outra pessoa não inventa segundo cliente.
 * node grupodkempreendimentos/scripts/test-codigo-cliente-nao-unico.mjs
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
  const port = 3045;
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
  const debugPort = 9228;
  const userDir = fs.mkdtempSync("/tmp/dk-chrome-cod-nao-unico-");
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
  const marcelo = {
    id: 9101,
    cpf: "05319631448",
    nome: "MARCELO SOARES COELHO",
    codigo: "0363",
    origemPortal: true,
  };
  const debora = {
    id: 9102,
    cpf: "03102535518",
    nome: "DEBORA MORENO DOS SANTOS",
    codigo: "0364",
    origemPortal: true,
  };
  const joana = {
    id: 9105,
    cpf: "15488766532",
    nome: "JOANA DARC SOUZA SANTANA",
    codigo: "0370",
    origemPortal: true,
  };
  const helder = {
    id: 9106,
    cpf: "09284384494",
    nome: "HELDER SOUZA CAMPOS",
    codigo: "0371",
    origemPortal: true,
  };
  const locHelder = {
    id: 9107,
    numeroContrato: "2026081702",
    cpf: "09284384494",
    nome: "HELDER SOUZA CAMPOS",
    clienteCodigo: "0370",
    placa: "QYJ3J11",
    inicio: "17/08/2026",
    fim: "",
    origemPortal: true,
    createdAt: Date.now(),
  };
  const locDebora = {
    id: 9103,
    numeroContrato: "2026072001",
    cpf: "03102535518",
    nome: "DEBORA MORENO DOS SANTOS",
    clienteCodigo: "0363",
    placa: "UHQ1C08",
    inicio: "20/07/2026",
    fim: "",
    origemPortal: true,
    createdAt: Date.now(),
  };
  const veiculo = {
    id: 9104,
    placa: "QWE1A23",
    modelo: "CG 160",
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
  mergeBy("dk_clientes_cadastro", [marcelo, debora, joana, helder], (c) => String(c.cpf || "").replace(/\\D/g, ""));
  mergeBy("dk_locacoes_cadastro", [locDebora, locHelder], (l) => String(l.numeroContrato || ""));
  mergeBy("dk_veiculos_cadastro", [veiculo], (v) => String(v.placa || "").toUpperCase().replace(/[^A-Z0-9]/g, ""));
  if (typeof invalidateCadastroParseCache === "function") invalidateCadastroParseCache();
  if (typeof window.__DK_invalidatePesquisaLinhasCache === "function") window.__DK_invalidatePesquisaLinhasCache();
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

const TYPE_CODIGO = `(() => {
  const clearIds = [
    "operacaoLocacaoCpf",
    "operacaoLocacaoCliente",
    "operacaoLocacaoPlaca",
    "operacaoLocacaoProtocoloAdminBusca",
  ];
  clearIds.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
  const inp = document.getElementById("operacaoLocacaoClienteCodigo");
  if (!inp) return { ok: false };
  inp.value = __DK_COD__;
  inp.focus();
  inp.dispatchEvent(new Event("input", { bubbles: true }));
  const panel = document.getElementById("operacaoLocacaoPesquisaLista");
  const text = String(panel?.innerText || "");
  const hidden = !panel || panel.classList.contains("hidden") || panel.hasAttribute("hidden") || !text.trim();
  return {
    ok: true,
    hidden,
    text,
    hasDebora: /DEBORA/i.test(text),
    hasMarcelo: /MARCELO/i.test(text),
    hasJoana: /JOANA/i.test(text),
    hasHelder: /HELDER/i.test(text),
    temLocacaoDebora: /2026072001|UHQ1C08/.test(text),
    temLocacaoHelder: /2026081702|QYJ3J11/.test(text),
    dizDoisClientes: /Há \\d+ clientes com o código/i.test(text),
    dizContrato: /contrato\\(s\\)/i.test(text),
    dizCadastro: /cadastro\\(s\\)/i.test(text),
  };
})()`;

const APPLY_CODIGO = `(() => {
  const inp = document.getElementById("operacaoLocacaoClienteCodigo");
  if (!inp) return { ok: false };
  inp.value = __DK_COD__;
  inp.dispatchEvent(new Event("change", { bubbles: true }));
  inp.dispatchEvent(new Event("blur", { bubbles: true }));
  if (typeof window.__DK_applyOperacaoLocacaoClienteFromCodigo === "function") {
    window.__DK_applyOperacaoLocacaoClienteFromCodigo(__DK_COD__);
  }
  const msg = String(document.getElementById("operacaoLocacaoInlineMsg")?.textContent || "");
  return {
    ok: true,
    nome: String(document.getElementById("operacaoLocacaoCliente")?.value || ""),
    cpf: String(document.getElementById("operacaoLocacaoCpf")?.value || ""),
    placa: String(document.getElementById("operacaoLocacaoPlaca")?.value || ""),
    proto: String(document.getElementById("operacaoLocacaoProtocolo")?.value || ""),
    protoSel: String(document.getElementById("operacaoLocacaoProtocoloSelect")?.value || ""),
    msg,
    dizDoisClientes: /Há \\d+ clientes com o código/i.test(msg),
  };
})()`;

const HITS_CODIGO = `(() => {
  const hits363 = typeof window.__DK_findPortalClientesByCodigoBusca === "function"
    ? window.__DK_findPortalClientesByCodigoBusca("0363")
    : [];
  const hits370 = typeof window.__DK_findPortalClientesByCodigoBusca === "function"
    ? window.__DK_findPortalClientesByCodigoBusca("0370")
    : [];
  const dupe = typeof window.__DK_portalClienteCodigoEmUsoPorOutroCpf === "function"
    ? window.__DK_portalClienteCodigoEmUsoPorOutroCpf("0363", "03102535518")
    : null;
  return {
    n363: Array.isArray(hits363) ? hits363.length : -1,
    nomes363: (hits363 || []).map((c) => String(c.nome || "")),
    n370: Array.isArray(hits370) ? hits370.length : -1,
    nomes370: (hits370 || []).map((c) => String(c.nome || "")),
    dupeNome: String(dupe?.nome || ""),
  };
})()`;

const CLICK_LISTA_NOME = `(() => {
  const re = new RegExp(__DK_NOME_RE__, "i");
  const btns = Array.from(document.querySelectorAll("#operacaoLocacaoPesquisaLista .portal-cliente-prefix-list__btn"));
  const btn = btns.find((b) => re.test(b.textContent || ""));
  if (!btn) return { ok: false, reason: "sem botão", n: btns.length };
  btn.click();
  return {
    ok: true,
    nome: String(document.getElementById("operacaoLocacaoCliente")?.value || ""),
    cpf: String(document.getElementById("operacaoLocacaoCpf")?.value || ""),
    proto: String(document.getElementById("operacaoLocacaoProtocolo")?.value || ""),
    protoSel: String(document.getElementById("operacaoLocacaoProtocoloSelect")?.value || ""),
    placa: String(document.getElementById("operacaoLocacaoPlaca")?.value || ""),
  };
})()`;

const LIMPAR = `(() => {
  const cod = document.getElementById("operacaoLocacaoClienteCodigo");
  if (cod) cod.value = "0363";
  const busca = document.getElementById("operacaoLocacaoProtocoloAdminBusca");
  if (busca) busca.value = "2026082501";
  document.getElementById("operacaoLocacaoLimparBtn")?.click();
  const panel = document.getElementById("operacaoLocacaoPesquisaLista");
  return {
    codigo: String(document.getElementById("operacaoLocacaoClienteCodigo")?.value || ""),
    placeholder: String(document.getElementById("operacaoLocacaoClienteCodigo")?.placeholder || ""),
    adminBusca: String(document.getElementById("operacaoLocacaoProtocoloAdminBusca")?.value || ""),
    listaEscondida:
      !panel ||
      panel.classList.contains("hidden") ||
      panel.hasAttribute("hidden") ||
      !String(panel.innerText || "").trim(),
  };
})()`;

const SELECT_MARCELO = `(() => {
  const cpf = document.getElementById("operacaoLocacaoCpf");
  const nome = document.getElementById("operacaoLocacaoCliente");
  const cod = document.getElementById("operacaoLocacaoClienteCodigo");
  if (!cpf || !nome || !cod) return { ok: false };
  cpf.value = "053.196.314-48";
  nome.value = "MARCELO SOARES COELHO";
  cod.value = "0363";
  cpf.dispatchEvent(new Event("input", { bubbles: true }));
  nome.dispatchEvent(new Event("input", { bubbles: true }));
  cpf.dispatchEvent(new Event("blur", { bubbles: true }));
  nome.dispatchEvent(new Event("blur", { bubbles: true }));
  document.body.click();
  return { ok: true };
})()`;

const MEASURE = `(() => {
  const cod = document.getElementById("operacaoLocacaoClienteCodigo");
  if (cod) {
    cod.focus();
    cod.dispatchEvent(new Event("input", { bubbles: true }));
  }
  const panel = document.getElementById("operacaoLocacaoPesquisaLista");
  const text = String(panel?.innerText || "");
  const hidden = !panel || panel.classList.contains("hidden") || panel.hasAttribute("hidden") || !text.trim();
  const linhas = typeof window.__DK_filterPortalSugestoesLinhas === "function" &&
    typeof window.__DK_collectOperacaoLocacaoSugestoesLinhas === "function"
    ? window.__DK_filterPortalSugestoesLinhas(window.__DK_collectOperacaoLocacaoSugestoesLinhas(), {
        nomeRaw: "MARCELO SOARES COELHO",
        cpfRaw: "053.196.314-48",
        codigoRaw: "0363",
        ignorarCodigoSeCpfCompleto: true,
      })
    : [];
  return {
    hidden,
    text,
    hasDebora: /DEBORA/i.test(text),
    hasMarcelo: /MARCELO/i.test(text),
    filtroSoMarcelo: linhas.every((r) => String(r.cpf || "") === "05319631448"),
    filtroTemDebora: linhas.some((r) => /DEBORA/i.test(String(r.nome || ""))),
    filtroN: linhas.length,
    protoOpts: String(document.getElementById("operacaoLocacaoProtocoloSelect")?.innerText || ""),
    hasDeboraProto: /2026072001/.test(String(document.getElementById("operacaoLocacaoProtocoloSelect")?.innerHTML || "")),
  };
})()`;

const SAVE = `(() => {
  const set = (id, v) => {
    const el = document.getElementById(id);
    if (!el) return false;
    el.value = v;
    return true;
  };
  set("operacaoLocacaoCpf", "053.196.314-48");
  set("operacaoLocacaoCliente", "MARCELO SOARES COELHO");
  set("operacaoLocacaoClienteCodigo", "0363");
  set("operacaoLocacaoDataInicio", "26/08/2026");
  set("operacaoLocacaoValorAluguel", "420,00");
  set("operacaoLocacaoValorInvestimento", "0,00");
  set("operacaoLocacaoTipoPlano", "DK MEU TRANSPORTE");
  set("operacaoLocacaoModelo", "CG 160");
  const placaLivre = (() => {
    const livres = typeof getVeiculosSemProtocoloAtivo === "function" ? getVeiculosSemProtocoloAtivo() : [];
    const nrm = typeof normalizePlate === "function" ? normalizePlate : (p) => String(p || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    const qwe = livres.find((v) => nrm(v.placa) === "QWE1A23");
    const pick = qwe || livres[0];
    return { placa: pick ? nrm(pick.placa) : "QWE1A23", nLivres: livres.length };
  })();
  const placaOk = set("operacaoLocacaoPlaca", placaLivre.placa);
  const moto = document.getElementById("operacaoLocacaoModalidadeMoto");
  const carro = document.getElementById("operacaoLocacaoModalidadeCarro");
  const wrap = document.getElementById("operacaoLocacaoModalidadeWrap");
  if (wrap) {
    wrap.classList.remove("hidden");
    wrap.hidden = false;
    wrap.setAttribute("aria-hidden", "false");
  }
  if (carro) carro.checked = false;
  if (moto) moto.checked = true;
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
  const placaAntes = String(document.getElementById("operacaoLocacaoPlaca")?.value || "");
  const wrap2 = document.getElementById("operacaoLocacaoModalidadeWrap");
  if (wrap2) {
    wrap2.classList.remove("hidden");
    wrap2.hidden = false;
  }
  const moto2 = document.getElementById("operacaoLocacaoModalidadeMoto");
  if (moto2) moto2.checked = true;
  const form = document.getElementById("formOperacaoLocacaoInline");
  form?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  const modal = document.getElementById("portalLocacaoConfirmModal");
  const resumo = String(document.getElementById("portalLocacaoConfirmResumo")?.innerText || "");
  const modalAberta = Boolean(modal && !modal.classList.contains("hidden") && modal.getAttribute("aria-hidden") !== "true");
  document.getElementById("portalLocacaoConfirmSimBtn")?.click();
  const msg = String(document.getElementById("operacaoLocacaoInlineMsg")?.textContent || "");
  let locs = [];
  try {
    locs = JSON.parse(localStorage.getItem("dk_locacoes_cadastro") || "[]");
  } catch {
    locs = [];
  }
  const onlyDig = (s) => String(s || "").replace(/\\D/g, "");
  const marceloLocs = locs.filter((l) => onlyDig(l.cpf) === "05319631448");
  const misturouDebora = marceloLocs.some(
    (l) => /DEBORA/i.test(String(l.nome || "")) || String(l.numeroContrato || "") === "2026072001"
  );
  const deboraAindaLa = locs.some((l) => onlyDig(l.cpf) === "03102535518" && String(l.numeroContrato || "") === "2026072001");
  return {
    msg,
    placaLivre: placaLivre.placa,
    nLivres: placaLivre.nLivres,
    placaOk,
    placaAntes,
    placaDepois: String(document.getElementById("operacaoLocacaoPlaca")?.value || ""),
    protoSel: String(document.getElementById("operacaoLocacaoProtocoloSelect")?.value || ""),
    modalidade: String(
      document.querySelector('#operacaoLocacaoModalidadeWrap input[name="operacaoLocacaoModalidade"]:checked')?.value || ""
    ),
    sessaoTipo: (() => {
      try {
        return String(JSON.parse(localStorage.getItem("dk_sessao_cliente") || "{}").tipo || "");
      } catch {
        return "";
      }
    })(),
    nLocs: locs.length,
    nMarcelo: marceloLocs.length,
    marceloNome: String(marceloLocs[marceloLocs.length - 1]?.nome || ""),
    marceloCpf: String(marceloLocs[marceloLocs.length - 1]?.cpf || ""),
    marceloProto: String(marceloLocs[marceloLocs.length - 1]?.numeroContrato || ""),
    misturouDebora,
    deboraAindaLa,
    modalAberta,
    resumo,
    resumoTemMarcelo: /MARCELO/i.test(resumo),
    resumoTemDebora: /DEBORA/i.test(resumo),
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
    "JS trata o Cód. do cliente como único",
    js.includes("Cód. do cliente é único") &&
      js.includes("portalClienteCodigoEmUsoPorOutroCpf") &&
      js.includes("O código do cliente não se repete") &&
      js.includes("findPortalClientesByCodigoBusca") &&
      js.includes("collectOperacaoLocacaoSugestoesClientesPorCodigo")
  );
  record(
    "JS não mostra a mensagem de 2 clientes com o mesmo código",
    !js.includes("Há ${hits.length} clientes com o código") &&
      !js.includes("Clique na lista para confirmar o certo")
  );
  record("JS trava o contrato pelo CPF do cliente", js.includes("ignorarCodigoSeCpfCompleto") && js.includes("contrato de outro CPF nunca entra"));

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
        record("Browser: dados Marcelo/Débora (Cód. únicos; locação dela ainda copia 0363)", Boolean((await cdpEval(session, SEED))?.ok));
        record("Browser: cadastro de locação visível", Boolean((await cdpEval(session, SHOW))?.ok));

        const hits = await cdpEval(session, HITS_CODIGO);
        record(
          "Browser: busca pelo Cód. 0363/0370 devolve 1 cliente cada",
          Boolean(
            hits &&
              hits.n363 === 1 &&
              hits.n370 === 1 &&
              /MARCELO/i.test(String(hits.nomes363 || "")) &&
              !/DEBORA/i.test(String(hits.nomes363 || "")) &&
              /JOANA/i.test(String(hits.nomes370 || "")) &&
              !/HELDER/i.test(String(hits.nomes370 || "")) &&
              /MARCELO/i.test(String(hits.dupeNome || ""))
          ),
          JSON.stringify(hits)
        );

        const typed0363 = await cdpEval(session, TYPE_CODIGO.replace("__DK_COD__", JSON.stringify("0363")));
        record(
          "Browser: digitar Cód. 0363 lista só o Marcelo, sem a Débora nem o contrato dela",
          Boolean(
            typed0363 &&
              !typed0363.hidden &&
              typed0363.hasMarcelo &&
              !typed0363.hasDebora &&
              !typed0363.temLocacaoDebora &&
              !typed0363.dizDoisClientes
          ),
          JSON.stringify(typed0363)
        );
        await capture(session, "locacao_cod_0363_unico.png");

        const applied0363 = await cdpEval(session, APPLY_CODIGO.replace(/__DK_COD__/g, JSON.stringify("0363")));
        record(
          "Browser: confirmar o Cód. 0363 carrega o Marcelo e não diz que há 2 clientes",
          Boolean(
            applied0363 &&
              applied0363.ok &&
              /MARCELO/i.test(applied0363.nome || "") &&
              String(applied0363.cpf || "").includes("053") &&
              !applied0363.dizDoisClientes &&
              !/Há 2 clientes/i.test(applied0363.msg || "") &&
              String(applied0363.protoSel || "") !== "2026072001" &&
              !/UHQ1C08/i.test(applied0363.placa || "")
          ),
          JSON.stringify(applied0363)
        );

        await cdpEval(session, SHOW);
        const typed0370 = await cdpEval(session, TYPE_CODIGO.replace("__DK_COD__", JSON.stringify("0370")));
        record(
          "Browser: digitar Cód. 0370 lista só a Joana, sem o Helder nem o contrato dele",
          Boolean(
            typed0370 &&
              !typed0370.hidden &&
              typed0370.hasJoana &&
              !typed0370.hasHelder &&
              !typed0370.temLocacaoHelder &&
              !typed0370.dizDoisClientes
          ),
          JSON.stringify(typed0370)
        );
        await capture(session, "locacao_cod_0370_unico.png");

        await cdpEval(session, TYPE_CODIGO.replace("__DK_COD__", JSON.stringify("0363")));
        const clicked = await cdpEval(session, CLICK_LISTA_NOME.replace("__DK_NOME_RE__", JSON.stringify("MARCELO")));
        record(
          "Browser: clicar no Marcelo na lista preenche o Marcelo e não carrega a locação da Débora",
          Boolean(
            clicked &&
              clicked.ok &&
              /MARCELO/i.test(clicked.nome || "") &&
              String(clicked.cpf || "").includes("053") &&
              String(clicked.protoSel || "") !== "2026072001" &&
              !/UHQ1C08/i.test(clicked.placa || "")
          ),
          JSON.stringify(clicked)
        );

        await cdpEval(session, SELECT_MARCELO);
        await new Promise((r) => setTimeout(r, 250));
        const after = await cdpEval(session, MEASURE);
        record(
          "Browser: com Marcelo escolhido a lista não mostra a Débora",
          Boolean(after && !after.hasDebora && after.filtroSoMarcelo && !after.filtroTemDebora && !after.hasDeboraProto),
          JSON.stringify(after)
        );
        await capture(session, "locacao_marcelo_sem_debora.png");

        const saved = await cdpEval(session, SAVE);
        record(
          "Browser: guardar locação grava o Marcelo e não troca pela Débora",
          Boolean(
            saved &&
              saved.nMarcelo >= 1 &&
              /MARCELO/i.test(saved.marceloNome || "") &&
              !saved.misturouDebora &&
              saved.deboraAindaLa &&
              saved.resumoTemMarcelo &&
              !saved.resumoTemDebora
          ),
          JSON.stringify(saved)
        );
        await capture(session, "locacao_marcelo_guardada.png");

        const limpo = await cdpEval(session, LIMPAR);
        record(
          "Browser: Limpar esvazia o Cód. do cliente",
          Boolean(limpo && limpo.codigo === "" && limpo.adminBusca === "" && limpo.listaEscondida),
          JSON.stringify(limpo)
        );
        await capture(session, "locacao_limpar_esvazia_cod.png");
        browserOk =
          Boolean(hits && hits.n363 === 1 && hits.n370 === 1) &&
          Boolean(typed0363 && typed0363.hasMarcelo && !typed0363.hasDebora && !typed0363.temLocacaoDebora && !typed0363.dizDoisClientes) &&
          Boolean(applied0363 && /MARCELO/i.test(applied0363.nome || "") && !applied0363.dizDoisClientes) &&
          Boolean(typed0370 && typed0370.hasJoana && !typed0370.hasHelder && !typed0370.temLocacaoHelder) &&
          Boolean(clicked && clicked.ok && /MARCELO/i.test(clicked.nome || "")) &&
          Boolean(limpo && limpo.codigo === "") &&
          Boolean(after && !after.hasDebora && after.filtroSoMarcelo && !after.hasDeboraProto) &&
          Boolean(
            saved &&
              saved.nMarcelo >= 1 &&
              !saved.misturouDebora &&
              saved.deboraAindaLa &&
              saved.resumoTemMarcelo &&
              !saved.resumoTemDebora
          );
      });
    });
  } catch (err) {
    record("Browser Chrome", false, err?.message || String(err));
  }

  const pass = results.filter((r) => r.ok).length;
  console.log(`\n--- ${pass}/${results.length} testes código cliente único ---`);
  process.exit(pass === results.length && browserOk ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
