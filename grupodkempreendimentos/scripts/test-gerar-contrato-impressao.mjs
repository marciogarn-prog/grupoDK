/**
 * Gerar contrato abre o contrato de 10 páginas formatado para impressão.
 * node grupodkempreendimentos/scripts/test-gerar-contrato-impressao.mjs
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
  const port = 3052;
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
  const debugPort = 9235;
  const userDir = fs.mkdtempSync("/tmp/dk-chrome-gerar-contrato-");
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
      `document.readyState === "complete" && typeof window.__DK_contratoLocacaoBuildHtml === "function"`
    );
    if (ready) return;
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error("Portal não carregou contrato locação");
}

const SEED = `(() => {
  const cliente = {
    id: 9392,
    createdAt: Date.now(),
    cpf: "37528402850",
    nome: "JOSIVAN DA CONCEICAO SANTOS",
    codigo: "0392",
    origemPortal: true,
    endereco: "RUA TESTE, 100",
    municipioUf: "PETROLINA/PE",
  };
  const loc = {
    id: 2026083102,
    numeroContrato: "2026083102",
    cpf: "37528402850",
    nome: "JOSIVAN DA CONCEICAO SANTOS",
    clienteCodigo: "0392",
    placa: "UHJ1D50",
    marcaModelo: "SHI 175 S EFI",
    inicio: "31/08/2026",
    fim: "",
    statusLocacao: "ATIVO",
    plano: "DK MINHA MOTO",
    valorLocacao: "R$ 310,00",
    valorInvestimento: "R$ 20,00",
    origemPortal: true,
    createdAt: Date.now(),
    kmInicial: "18452",
    kmFinal: "",
  };
  const veiculo = {
    id: 8801,
    placa: "UHJ1D50",
    tipo: "MOTO",
    modelo: "SHI 175 S EFI",
    marca: "HAOJUE",
    proprietario: "GRUPO DK",
    proprietarioCpfCnpj: "59665734000132",
    origemPortal: true,
  };
  localStorage.setItem("dk_clientes_cadastro", JSON.stringify([cliente]));
  localStorage.setItem("dk_locacoes_cadastro", JSON.stringify([loc]));
  localStorage.setItem("dk_veiculos_cadastro", JSON.stringify([veiculo]));
  localStorage.setItem(
    "dk_sessao_cliente",
    JSON.stringify({ tipo: "admin", role: "owner", cpf: "03037897430", nome: "Marcio Santos" })
  );
  if (typeof invalidateCadastroParseCache === "function") invalidateCadastroParseCache();
  return { ok: true };
})()`;

const SHOW_LOCACAO = `(() => {
  document.getElementById("view-home")?.classList.remove("view--active");
  const unit = document.getElementById("view-unit");
  if (!unit) return { ok: false, reason: "view-unit" };
  unit.classList.add("view--active");
  unit.setAttribute("aria-hidden", "false");
  document.body.classList.add("portal-body--equipa-sessao", "portal-body--admin-logado");
  document.querySelectorAll(".operacao-inline-form").forEach((el) => {
    if (el.id !== "operacaoInlineLocacao") el.classList.add("hidden");
  });
  const pane = document.getElementById("operacaoInlineLocacao");
  const panel = document.getElementById("panel-operacao-locadora");
  if (!pane || !panel) return { ok: false, reason: "pane" };
  panel.classList.remove("hidden");
  pane.classList.remove("hidden");
  pane.removeAttribute("hidden");
  document.getElementById("btn-operacao-cadastro-locacao")?.click();
  pane.classList.remove("hidden");
  return { ok: true };
})()`;

const LOAD_AND_CLICK = `(() => {
  window.__DK_testPopups = [];
  window.open = function () {
    const fake = {
      document: {
        html: "",
        write(h) { this.html += String(h || ""); },
        close() {},
      },
      focus() {},
      closed: false,
      opener: window,
      location: { href: "", replace() {} },
    };
    window.__DK_testPopups.push(fake);
    return fake;
  };
  const busca = document.getElementById("operacaoLocacaoProtocoloAdminBusca");
  if (busca) busca.value = "2026083102";
  document.getElementById("operacaoLocacaoProtocoloAdminCarregarBtn")?.click();
  const btn = document.getElementById("operacaoLocacaoVisualizarContratoBtn");
  if (btn) btn.disabled = false;
  btn?.click();
  const html = String(window.__DK_testPopups[0]?.document?.html || "");
  return {
    sel: String(document.getElementById("operacaoLocacaoProtocoloSelect")?.value || ""),
    hid: String(document.getElementById("operacaoLocacaoProtocolo")?.value || ""),
    btnDisabled: Boolean(btn?.disabled),
    btnText: String(btn?.textContent || "").trim(),
    nPopups: window.__DK_testPopups.length,
    htmlLen: html.length,
    temImprimir: html.includes("id=\\"btnImprimir\\">Imprimir") || html.includes("id='btnImprimir'>Imprimir"),
    tem10paginas: (html.match(/class="pagina/g) || []).length >= 10 || (html.match(/class='pagina/g) || []).length >= 10,
    temProtocolo: html.includes("2026083102"),
    temFormatado: html.includes("formatado para impressão"),
    nMarcador: (html.match(/marcador-azul/g) || []).length,
    temSidebar: html.includes("Prot. Nº:"),
    temSisloc: html.includes("# DK - SISLOC - Sistema de Controle de Locações"),
    temTitulo: html.includes("CONTRATO DE LOCAÇÃO DE VEÍCULO"),
    temSig: html.includes("sig-area") && html.includes("DK LOCADORA LTDA"),
    temProprietario: html.includes("GRUPO DK") && html.includes("CPF/CNPJ do proprietário"),
    temOdometro: html.includes("Odômetro início") && html.includes("18.452 km"),
    msg: String(document.getElementById("operacaoLocacaoInlineMsg")?.textContent || ""),
    docsMsg: String(document.getElementById("operacaoLocacaoDocumentosMsg")?.textContent || ""),
  };
})()`;

async function main() {
  const html = readLocal("index.html");
  const contrato = readLocal("portal-contrato-locacao.js");
  const ui = readLocal("portal-locadora-ui.js");

  record("HTML tem Gerar contrato", html.includes("operacaoLocacaoVisualizarContratoBtn") && html.includes("Gerar contrato"));
  record("JS escreve o HTML do contrato na janela", contrato.includes("popup.document.write(html)"));
  record(
    "JS não desvia Gerar contrato para o pacote",
    !contrato.includes("__DK_contratoPacoteAbrir === \"function\"") &&
      contrato.includes("modelo 10 páginas formatado para impressão")
  );
  record("Preview tem botão Imprimir visível", contrato.includes('id="btnImprimir">Imprimir'));
  record("Modelo SISLOC tem quadrado azul", contrato.includes("marcador-azul"));
  record("Modelo SISLOC tem faixa Prot. Nº", contrato.includes("Prot. Nº:"));
  record("Modelo SISLOC tem rodapé SISLOC", contrato.includes("# DK - SISLOC - Sistema de Controle de Locações"));
  record("CSS assinatura sem chave duplicada", !/\.sig-area \{\s*\.sig-area \{/.test(contrato));
  record("Protocolo carregado fica seleccionado", ui.includes("pinOperacaoLocacaoProtocoloCarregado"));
  record("CPF/CNPJ do proprietário no cadastro", html.includes("operacaoVeiculoProprietarioCpfCnpj"));
  record("Odômetro início/fim na locação", html.includes("operacaoLocacaoOdometroInicio") && html.includes("ODOMETRO FIM"));

  await withLocalServer(async (base) => {
    await withChromePage(async (session) => {
      await cdpGoto(session, base);
      const seeded = await cdpEval(session, SEED);
      record("seed protocolo 2026083102", Boolean(seeded?.ok), JSON.stringify(seeded));
      const shown = await cdpEval(session, SHOW_LOCACAO);
      record("cadastro de locação visível", Boolean(shown?.ok), JSON.stringify(shown));
      const clicked = await cdpEval(session, LOAD_AND_CLICK);
      record(
        "carregar protocolo deixa hid/sel em 2026083102",
        clicked?.hid === "2026083102" && clicked?.sel === "2026083102",
        JSON.stringify({ sel: clicked?.sel, hid: clicked?.hid, docs: clicked?.docsMsg })
      );
      record("botão Gerar contrato clicável", clicked?.btnText === "Gerar contrato", JSON.stringify({ text: clicked?.btnText, disabled: clicked?.btnDisabled }));
      record("clique abre uma janela", clicked?.nPopups === 1, JSON.stringify({ n: clicked?.nPopups, msg: clicked?.msg }));
      record("janela tem contrato formatado 10 páginas", Boolean(clicked?.tem10paginas && clicked?.temProtocolo), JSON.stringify({
        tem10paginas: clicked?.tem10paginas,
        temProtocolo: clicked?.temProtocolo,
        htmlLen: clicked?.htmlLen,
      }));
      record("janela tem botão Imprimir", Boolean(clicked?.temImprimir), JSON.stringify({ temImprimir: clicked?.temImprimir, temFormatado: clicked?.temFormatado }));
      record(
        "janela replica o modelo SISLOC (azul, faixa, rodapé, 10 págs)",
        clicked?.nMarcador >= 10 && clicked?.temSidebar && clicked?.temSisloc && clicked?.temTitulo && clicked?.temSig,
        JSON.stringify({
          nMarcador: clicked?.nMarcador,
          temSidebar: clicked?.temSidebar,
          temSisloc: clicked?.temSisloc,
          temTitulo: clicked?.temTitulo,
          temSig: clicked?.temSig,
        })
      );
      record(
        "janela traz proprietário, CPF/CNPJ e odômetro",
        Boolean(clicked?.temProprietario && clicked?.temOdometro),
        JSON.stringify({ temProprietario: clicked?.temProprietario, temOdometro: clicked?.temOdometro })
      );
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
