/**
 * Opção Contratada no modelo SISLOC, impressa junto com o contrato.
 * node grupodkempreendimentos/scripts/test-opcao-contratada.mjs
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
  const port = 3054;
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
  const debugPort = 9237;
  const userDir = fs.mkdtempSync("/tmp/dk-chrome-opcao-contratada-");
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
      `document.readyState === "complete" && typeof window.__DK_contratoLocacaoBuildHtml === "function" && typeof window.__DK_contratoPacoteBuildOpcaoPagina === "function"`
    );
    if (ready) return;
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error("Portal não carregou contrato/opção");
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
    celular: "87991839851",
    recado1: "87981103670",
    recado2: "87981353824",
    cnh: "4988259603",
    categoria: "AB",
    vencimento: "19/02/2036",
    ear: "NAO",
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
    diaPagto: "segunda-feira",
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
    tag: "DKMT - 168",
    chassi: "9C2KD0810RR105086",
    renavam: "1392546254",
    cor: "BRANCA",
    anoModelo: "2024/2024",
    proprietario: "GRUPO DK",
    proprietarioCpfCnpj: "59665734000132",
    local: "JUAZEIRO/BA",
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
  const opcao = document.querySelector(".pagina-opcao");
  const txt = opcao ? opcao.innerText : "";
  return {
    nContrato: document.querySelectorAll(".pagina.pagina-contrato").length,
    nOpcao: document.querySelectorAll(".pagina.pagina-opcao").length,
    temTitulo: txt.includes("OPÇÃO CONTRATADA"),
    temPlano: txt.includes("Plano: DK MINHA MOTO"),
    temProto: txt.includes("Protocolo Nº: 2026083102"),
    temNome: txt.includes("JOSIVAN DA CONCEICAO SANTOS"),
    temTermo: txt.includes("Termo de Compromisso"),
    temValor: txt.includes("R$ 310,00") && txt.includes("R$ 20,00") && txt.includes("R$ 330,00"),
    temPlaca: txt.includes("UHJ1D50"),
    temProp: txt.includes("GRUPO DK"),
    temOdometro: txt.includes("018452 Km(s)") || txt.includes("18452"),
    temRodape: (opcao?.querySelector(".pe-pagina")?.textContent || "").includes("Pág.: 1 / 1"),
    temImprimir: Boolean(document.getElementById("btnImprimir")),
  };
})()`;

async function main() {
  const pacote = readLocal("portal-contrato-pacote.js");
  const textos = readLocal("data/dk-contrato-pacote-textos.js");
  const contrato = readLocal("portal-contrato-locacao.js");

  record("HTML da opção no modelo SISLOC", textos.includes("OPÇÃO CONTRATADA") && textos.includes("Termo de Compromisso"));
  record("Builder da opção exportado", pacote.includes("__DK_contratoPacoteBuildOpcaoPagina"));
  record("Gerar contrato inclui a opção", contrato.includes("__DK_contratoPacoteBuildOpcaoPagina") && contrato.includes("Opção contratada"));
  record("CSS da faixa verde do plano", pacote.includes("opcao-plano"));

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
      record("seed locação + veículo + cliente", Boolean(seeded?.ok));
      const built = await cdpEval(session, BUILD);
      record("10 páginas de contrato + 1 opção", built?.nContrato === 10 && built?.nOpcao === 1, JSON.stringify(built));
      record("título, plano e protocolo", Boolean(built?.temTitulo && built?.temPlano && built?.temProto));
      record("locatário, veículo e proprietário", Boolean(built?.temNome && built?.temPlaca && built?.temProp));
      record("valores semanais e termo", Boolean(built?.temValor && built?.temTermo));
      record("rodapé Pág.: 1 / 1 e Imprimir", Boolean(built?.temRodape && built?.temImprimir));
      const shot = await saveClip(session, ".pagina-opcao", "opcao_contratada_sisloc.png");
      record("captura da Opção Contratada", Boolean(shot) && fs.statSync(shot).size > 20000, shot ? `${shot} ${fs.statSync(shot).size}b` : "");
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
