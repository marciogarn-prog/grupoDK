/**
 * Termo de Vistoria: campo MODELO CONTRATADO com SHI 175 na cor do veículo.
 * node grupodkempreendimentos/scripts/test-termo-vistoria-modelo.mjs
 */
import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ART = "/opt/cursor/artifacts";
const results = [];

const CORES = [
  { cor: "PRETA", file: "shi-175-preto.png", rotulo: "preto" },
  { cor: "VERMELHA", file: "shi-175-vermelho.png", rotulo: "vermelho" },
  { cor: "AZUL", file: "shi-175-azul.png", rotulo: "azul" },
  { cor: "CINZA", file: "shi-175-cinza.png", rotulo: "cinza" },
];

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
  const port = 3056;
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
  const debugPort = 9239;
  const userDir = fs.mkdtempSync("/tmp/dk-chrome-termo-vistoria-");
  const child = spawn(
    chromeBin,
    [
      "--headless=new",
      "--disable-gpu",
      "--no-sandbox",
      "--disable-dev-shm-usage",
      `--window-size=900,1400`,
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
      `document.readyState === "complete" && typeof window.__DK_contratoLocacaoBuildHtml === "function" && typeof window.__DK_contratoPacoteBuildVistoriaPagina === "function" && typeof window.__DK_resolveModeloContratadoFoto === "function"`
    );
    if (ready) return;
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error("Portal não carregou contrato/termo de vistoria");
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

function seedExpr(cor) {
  return `(() => {
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
      marca: "SHINERAY",
      tag: "DKMT - 168",
      chassi: "9C2KD0810RR105086",
      renavam: "1392546254",
      cor: ${JSON.stringify(cor)},
      anoModelo: "2025/2025",
      proprietario: "GRUPO DK",
      proprietarioCpfCnpj: "59665734000132",
      local: "JUAZEIRO/BA",
      origemPortal: true,
    };
    localStorage.setItem("dk_clientes_cadastro", JSON.stringify([cliente]));
    localStorage.setItem("dk_locacoes_cadastro", JSON.stringify([loc]));
    localStorage.setItem("dk_veiculos_cadastro", JSON.stringify([veiculo]));
    if (typeof invalidateCadastroParseCache === "function") invalidateCadastroParseCache();
    return { ok: true, cor: veiculo.cor };
  })()`;
}

const BUILD = `(() => {
  const loc = (typeof loadCadastro === "function"
    ? loadCadastro("dk_locacoes_cadastro")
    : JSON.parse(localStorage.getItem("dk_locacoes_cadastro") || "[]"))[0];
  const dados = window.__DK_contratoLocacaoResolverFromLoc(loc);
  const html = window.__DK_contratoLocacaoBuildHtml(dados);
  document.open();
  document.write(html);
  document.close();
  const vis = document.querySelector(".pagina-vistoria");
  const txt = vis ? vis.innerText : "";
  const img = vis?.querySelector(".vistoria-modelo__foto img");
  const opcaoImg = document.querySelector(".pagina-opcao .opcao-foto img");
  const cor = JSON.parse(localStorage.getItem("dk_veiculos_cadastro") || "[]")[0]?.cor || "";
  return {
    nContrato: document.querySelectorAll(".pagina.pagina-contrato").length,
    nOpcao: document.querySelectorAll(".pagina.pagina-opcao").length,
    nVistoria: document.querySelectorAll(".pagina.pagina-vistoria").length,
    temTitulo: txt.includes("TERMO DE VISTORIA"),
    temCampo: txt.includes("MODELO CONTRATADO"),
    temPlano: txt.includes("DK MINHA MOTO"),
    temProto: txt.includes("2026083102"),
    temCor: txt.includes(cor),
    imgSrc: img?.getAttribute("src") || "",
    opcaoImgSrc: opcaoImg?.getAttribute("src") || "",
  };
})()`;

const IMGS_READY = `(() => {
  const imgs = [...document.querySelectorAll(".pagina-vistoria img, .pagina-opcao .opcao-foto img")];
  return {
    n: imgs.length,
    complete: imgs.every((img) => img.complete),
    ok: imgs.some((img) => img.naturalWidth > 40),
    w: imgs.map((img) => img.naturalWidth),
  };
})()`;

async function main() {
  const textos = readLocal("data/dk-contrato-pacote-textos.js");
  const pacote = readLocal("portal-contrato-pacote.js");
  const contrato = readLocal("portal-contrato-locacao.js");
  const modelos = readLocal("data/dk-modelos-veiculo.js");
  const indexHtml = readLocal("index.html");

  record("HTML do Termo de Vistoria", textos.includes("TERMO DE VISTORIA") && textos.includes("MODELO CONTRATADO"));
  record("Builder do termo exportado", pacote.includes("__DK_contratoPacoteBuildVistoriaPagina"));
  record("Gerar contrato inclui o termo", contrato.includes("__DK_contratoPacoteBuildVistoriaPagina") && contrato.includes("Termo de vistoria"));
  record("Resolver das 4 cores SHI 175", ["shi-175-preto.png", "shi-175-vermelho.png", "shi-175-azul.png", "shi-175-cinza.png"].every((f) => modelos.includes(f)));
  record("Script do catálogo no index", indexHtml.includes("data/dk-modelos-veiculo.js"));

  for (const c of CORES) {
    const p = path.join(ROOT, "images/modelos", c.file);
    record(`arquivo ${c.file}`, fs.existsSync(p) && fs.statSync(p).size > 50000, p);
  }

  await withLocalServer(async (base) => {
    for (const c of CORES) {
      const res = await fetch(`${base}images/modelos/${c.file}`);
      record(`HTTP ${c.file}`, res.ok && Number(res.headers.get("content-length") || 0) > 50000, String(res.status));
    }

    await withChromePage(async (session) => {
      await session.send("Emulation.setDeviceMetricsOverride", {
        width: 900,
        height: 1400,
        deviceScaleFactor: 1,
        mobile: false,
      });

      for (const c of CORES) {
        await cdpGoto(session, base);
        const seeded = await cdpEval(session, seedExpr(c.cor));
        record(`seed SHI 175 ${c.rotulo}`, Boolean(seeded?.ok), seeded?.cor);
        const built = await cdpEval(session, BUILD);
        record(
          `termo ${c.rotulo} tem título e MODELO CONTRATADO`,
          Boolean(built?.temTitulo && built?.temCampo && built?.nVistoria === 1),
          JSON.stringify({ nVistoria: built?.nVistoria, temTitulo: built?.temTitulo, temCampo: built?.temCampo })
        );
        record(
          `termo ${c.rotulo} usa ${c.file}`,
          String(built?.imgSrc || "").includes(c.file),
          built?.imgSrc || ""
        );
        record(
          `opção ${c.rotulo} usa a mesma foto`,
          String(built?.opcaoImgSrc || "").includes(c.file),
          built?.opcaoImgSrc || ""
        );
        let imgs = { ok: false };
        for (let i = 0; i < 20; i += 1) {
          imgs = await cdpEval(session, IMGS_READY);
          if (imgs?.ok) break;
          await new Promise((r) => setTimeout(r, 150));
        }
        record(`foto ${c.rotulo} carregou`, Boolean(imgs?.ok), JSON.stringify(imgs));
        const shot = await saveClip(session, ".pagina-vistoria", `termo_vistoria_shi175_${c.rotulo}.png`);
        record(
          `captura termo ${c.rotulo}`,
          Boolean(shot) && fs.statSync(shot).size > 20000,
          shot ? `${shot} ${fs.statSync(shot).size}b` : ""
        );
      }

      await cdpGoto(session, base);
      const seededBranca = await cdpEval(session, seedExpr("BRANCA"));
      record("seed SHI 175 branca", Boolean(seededBranca?.ok));
      const builtBranca = await cdpEval(session, BUILD);
      record(
        "SHI 175 branca não usa foto de outra cor",
        !/shi-175-(preto|vermelho|azul|cinza)\.png/.test(String(builtBranca?.imgSrc || "")),
        builtBranca?.imgSrc || "(vazio)"
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
