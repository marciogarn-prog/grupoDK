/**
 * Contrato gerado replica a formatação do modelo SISLOC (10 páginas).
 * node grupodkempreendimentos/scripts/test-contrato-modelo-formatacao.mjs
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
  const port = 3053;
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
  const debugPort = 9236;
  const userDir = fs.mkdtempSync("/tmp/dk-chrome-modelo-contrato-");
  const child = spawn(
    chromeBin,
    [
      "--headless=new",
      "--disable-gpu",
      "--no-sandbox",
      "--disable-dev-shm-usage",
      `--window-size=900,1280`,
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

async function saveClip(session, selector, destName) {
  const box = await cdpEval(
    session,
    `(() => {
      const el = document.querySelector(${JSON.stringify(selector)});
      if (!el) return null;
      el.scrollIntoView({ block: "start" });
      const r = el.getBoundingClientRect();
      return {
        x: r.x + window.scrollX,
        y: r.y + window.scrollY,
        width: r.width,
        height: r.height,
      };
    })()`
  );
  if (!box || box.width < 10 || box.height < 10) return null;
  const shot = await session.send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: true,
    clip: {
      x: Math.max(0, box.x),
      y: Math.max(0, box.y),
      width: box.width,
      height: box.height,
      scale: 1,
    },
  });
  fs.mkdirSync(ART, { recursive: true });
  const dest = path.join(ART, destName);
  fs.writeFileSync(dest, Buffer.from(shot.data, "base64"));
  return dest;
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
    origemPortal: true,
    createdAt: Date.now(),
    kmInicial: "18452",
    kmFinal: "19000",
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
  if (typeof invalidateCadastroParseCache === "function") invalidateCadastroParseCache();
  return { ok: true };
})()`;

const BUILD = `(() => {
  const loc = (typeof loadCadastro === "function"
    ? loadCadastro("dk_locacoes_cadastro")
    : JSON.parse(localStorage.getItem("dk_locacoes_cadastro") || "[]"))[0];
  const dados = window.__DK_contratoLocacaoResolverFromLoc(loc);
  const html = window.__DK_contratoLocacaoBuildHtml(dados);
  document.open();
  document.write(html);
  document.close();
  return {
    protocolo: dados?.protocolo,
    proprietario: dados?.proprietario,
    proprietarioCpfCnpj: dados?.proprietarioCpfCnpj,
    odometroInicio: dados?.odometroInicio,
    odometroFim: dados?.odometroFim,
    nPaginas: document.querySelectorAll(".pagina.pagina-contrato").length,
    nMarcador: document.querySelectorAll(".marcador-azul").length,
    nCabecalho: document.querySelectorAll(".cabecalho").length,
    nSidebar: document.querySelectorAll(".sidebar").length,
    nRodape: [...document.querySelectorAll(".pe-pagina")].filter((el) =>
      el.textContent.includes("DK - SISLOC")
    ).length,
    temTitulo: Boolean(document.querySelector("h1")?.textContent.includes("CONTRATO DE LOCAÇÃO DE VEÍCULO")),
    temProto: (document.querySelector(".proto")?.textContent || "").includes("2026083102"),
    temSig: Boolean(document.querySelector(".sig-area")),
    temSigData: Boolean(document.querySelector(".sig-data")),
    temImprimir: Boolean(document.getElementById("btnImprimir")),
    temProprietario: (document.body.innerText || "").includes("GRUPO DK"),
    temOdometro: (document.body.innerText || "").includes("18.452 km"),
    sidebar: String(document.querySelector(".sidebar")?.textContent || "").slice(0, 180),
  };
})()`;

async function main() {
  const contrato = readLocal("portal-contrato-locacao.js");
  const texto = readLocal("data/dk-contrato-locacao-texto.js");

  record("10 corpos no modelo", (texto.match(/Cláusula 1ª - Objeto do Contrato/) || []).length >= 1 && texto.includes("13.20."));
  record("Pág. 10 tem data e assinaturas", texto.includes("sig-data") && texto.includes("sig-area"));
  record("CSS do modelo tem quadrado azul", contrato.includes("marcador-azul") && contrato.includes("background: #2b6cb0"));
  record("CSS do modelo tem faixa vertical", contrato.includes("writing-mode: vertical-rl"));
  record("Uma única regra .sig-area", (contrato.match(/\.sig-area \{/g) || []).length === 1);

  await withLocalServer(async (base) => {
    await withChromePage(async (session) => {
      await session.send("Emulation.setDeviceMetricsOverride", {
        width: 900,
        height: 1280,
        deviceScaleFactor: 1,
        mobile: false,
      });
      await cdpGoto(session, base);
      const seeded = await cdpEval(session, SEED);
      record("seed locação + veículo", Boolean(seeded?.ok));
      const built = await cdpEval(session, BUILD);
      record("HTML tem 10 páginas A4", built?.nPaginas === 10, JSON.stringify({ n: built?.nPaginas }));
      record("10 quadrados azuis", built?.nMarcador === 10, JSON.stringify({ n: built?.nMarcador }));
      record("cabeçalho só na capa", built?.nCabecalho === 1 && built?.temTitulo && built?.temProto, JSON.stringify(built));
      record("10 faixas laterais + 10 rodapés SISLOC", built?.nSidebar === 10 && built?.nRodape === 10);
      record("pág. 10 tem data e duas assinaturas", Boolean(built?.temSig && built?.temSigData));
      record("botão Imprimir visível", Boolean(built?.temImprimir));
      record(
        "proprietário, CPF/CNPJ e odômetros no contrato",
        built?.proprietario === "GRUPO DK" &&
          String(built?.proprietarioCpfCnpj || "").includes("59.665.734") &&
          built?.odometroInicio === "18.452 km" &&
          built?.odometroFim === "19.000 km" &&
          built?.temProprietario &&
          built?.temOdometro,
        JSON.stringify({
          proprietario: built?.proprietario,
          cpfCnpj: built?.proprietarioCpfCnpj,
          odIni: built?.odometroInicio,
          odFim: built?.odometroFim,
        })
      );
      record(
        "faixa vertical no padrão Prot. Nº",
        String(built?.sidebar || "").startsWith("Prot. Nº: 2026083102"),
        JSON.stringify({ sidebar: built?.sidebar })
      );

      const p1 = await saveClip(session, '.pagina[data-pagina="1"]', "contrato_sisloc_capa.png");
      const p2 = await saveClip(session, '.pagina[data-pagina="2"]', "contrato_sisloc_pagina2.png");
      const p10 = await saveClip(session, '.pagina[data-pagina="10"]', "contrato_sisloc_pagina10.png");
      const sig = await saveClip(session, ".sig-area", "contrato_sisloc_assinaturas.png");
      record("captura pág. 1", Boolean(p1), p1 || "");
      record("captura pág. 2 (sem capa)", Boolean(p2), p2 || "");
      record("captura pág. 10", Boolean(p10) && fs.statSync(p10).size > 20000, p10 ? `${p10} ${fs.statSync(p10).size}b` : "");
      record("captura assinaturas", Boolean(sig) && fs.statSync(sig).size > 1000, sig || "");
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
