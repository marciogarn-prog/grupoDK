/**
 * Termo de Vistoria: campo MODELO CONTRATADO com foto de catálogo na cor do veículo.
 * SHI 175, Honda Bros, Yamaha YBR Factor (Normal/DX) e Honda Start.
 * node grupodkempreendimentos/scripts/test-termo-vistoria-modelo.mjs
 */
import fs from "fs";
import net from "net";
import path from "path";
import { spawn } from "child_process";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ART = "/opt/cursor/artifacts";
const results = [];

const CORES_SHI = [
  { cor: "PRETA", file: "shi-175-preto.png", rotulo: "preto" },
  { cor: "VERMELHA", file: "shi-175-vermelho.png", rotulo: "vermelho" },
  { cor: "AZUL", file: "shi-175-azul.png", rotulo: "azul" },
  { cor: "CINZA", file: "shi-175-cinza.png", rotulo: "cinza" },
];

const CORES_BROS = [
  { cor: "PRETA", file: "bros-160-preto.png", rotulo: "preto" },
  { cor: "VERMELHA", file: "bros-160-vermelho.png", rotulo: "vermelho" },
  { cor: "BRANCA", file: "bros-160-branco.png", rotulo: "branco" },
  { cor: "CINZA", file: "bros-160-cinza.png", rotulo: "cinza" },
];

const CORES_YBR = [
  { cor: "BRANCA", file: "ybr-150-branco.png", rotulo: "branco" },
  { cor: "VERMELHA", file: "ybr-150-vermelho.png", rotulo: "vermelho" },
  { cor: "PRETA", file: "ybr-150-preto.png", rotulo: "preto" },
];

const CORES_YBR_DX = [
  { cor: "AZUL METÁLICO", file: "ybr-150-dx-azul.png", rotulo: "azul" },
  { cor: "PRETO FOSCO", file: "ybr-150-dx-preto-fosco.png", rotulo: "fosco" },
  { cor: "PRETO METÁLICO", file: "ybr-150-dx-preto-metalico.png", rotulo: "metalico" },
];

const CORES_START = [
  { cor: "PRATA", file: "start-160-prata.png", rotulo: "prata" },
  { cor: "VERMELHA", file: "start-160-vermelho.png", rotulo: "vermelho" },
  { cor: "PRETA", file: "start-160-preto.png", rotulo: "preto" },
  { cor: "AZUL", file: "start-160-azul.png", rotulo: "azul" },
];

const CORES_KWID = [
  { cor: "BRANCA", file: "kwid-branco.png", rotulo: "branco" },
  { cor: "VERMELHA", file: "kwid-vermelho.png", rotulo: "vermelho" },
  { cor: "PRETA", file: "kwid-preto.png", rotulo: "preto" },
  { cor: "BEGE", file: "kwid-bege.png", rotulo: "bege" },
  { cor: "LARANJA", file: "kwid-laranja.png", rotulo: "laranja" },
];

const CORES_ETIOS = [{ cor: "BRANCA", file: "etios-branco.png", rotulo: "branco" }];

const CORES_GOL = [
  { cor: "CINZA", file: "gol-cinza.png", rotulo: "cinza" },
  { cor: "PRATA", file: "gol-cinza.png", rotulo: "prata" },
];

const VEICULO_SHI = { marca: "SHINERAY", modelo: "SHI 175 S EFI", marcaModelo: "SHI 175 S EFI" };
const VEICULO_BROS = { marca: "HONDA", modelo: "NXR 160 BROS ESDD", marcaModelo: "NXR 160 BROS ESDD" };
const VEICULO_YBR = { marca: "YAMAHA", modelo: "YBR 150 FACTOR", marcaModelo: "YBR 150 FACTOR" };
const VEICULO_YBR_DX = { marca: "YAMAHA", modelo: "YBR 150 FACTOR DX FLEX", marcaModelo: "YBR 150 FACTOR DX FLEX" };
const VEICULO_START = { marca: "HONDA", modelo: "CG 160 START", marcaModelo: "CG 160 START" };
const VEICULO_KWID = { marca: "RENAULT", modelo: "KWID ZEN 1.0 FLEX 12V 5P MEC", marcaModelo: "KWID ZEN 1.0" };
const VEICULO_ETIOS = { marca: "TOYOTA", modelo: "ETIOS XS 1.5 FLEX 16V 5P MEC", marcaModelo: "ETIOS XS" };
const VEICULO_GOL = { marca: "VOLKSWAGEN", modelo: "GOL 1.0", marcaModelo: "VOLKSWAGEN GOL" };

const TODAS_CORES = [...CORES_SHI, ...CORES_BROS, ...CORES_YBR, ...CORES_YBR_DX, ...CORES_START, ...CORES_KWID, ...CORES_ETIOS, ...CORES_GOL];

function record(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} | ${name}${detail ? ` | ${detail}` : ""}`);
}

function readLocal(rel) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

function findFreePort(preferred) {
  return new Promise((resolve, reject) => {
    const tryListen = (port) => {
      const srv = net.createServer();
      srv.unref();
      srv.on("error", () => {
        if (port === preferred) {
          tryListen(0);
          return;
        }
        reject(new Error("Não foi possível obter porta livre"));
      });
      srv.listen(port, "127.0.0.1", () => {
        const p = srv.address().port;
        srv.close(() => resolve(p));
      });
    };
    tryListen(preferred);
  });
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
  const port = await findFreePort(3056);
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
  const debugPort = await findFreePort(9239);
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

function seedExpr(cor, opts = {}) {
  const marca = opts.marca || "SHINERAY";
  const modelo = opts.modelo || "SHI 175 S EFI";
  const marcaModelo = opts.marcaModelo || modelo;
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
      marcaModelo: ${JSON.stringify(marcaModelo)},
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
      modelo: ${JSON.stringify(modelo)},
      marca: ${JSON.stringify(marca)},
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
    return { ok: true, cor: veiculo.cor, marca: veiculo.marca, modelo: veiculo.modelo };
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
  const vis = document.querySelector(".pagina-vistoria[data-vistoria='entrega']") || document.querySelector(".pagina-vistoria");
  const visDev = document.querySelector(".pagina-vistoria[data-vistoria='devolucao']");
  const txt = vis ? vis.innerText : "";
  const txtDev = visDev ? visDev.innerText : "";
  const img = vis?.querySelector(".vistoria-modelo__foto img");
  const imgDev = visDev?.querySelector(".vistoria-modelo__foto img");
  const opcaoImg = document.querySelector(".pagina-opcao .opcao-foto img");
  const cor = JSON.parse(localStorage.getItem("dk_veiculos_cadastro") || "[]")[0]?.cor || "";
  const kmEnt = vis?.querySelector(".vistoria-odo__val")?.innerText || "";
  const kmDev = visDev?.querySelector(".vistoria-odo__val")?.innerText || "";
  return {
    nContrato: document.querySelectorAll(".pagina.pagina-contrato").length,
    nOpcao: document.querySelectorAll(".pagina.pagina-opcao").length,
    nVistoria: document.querySelectorAll(".pagina.pagina-vistoria").length,
    temTitulo: /termo de vistoria/i.test(txt),
    temCampo: /modelo contratado/i.test(txt),
    temEntrega: String(vis?.querySelector(".vistoria-fase")?.textContent || "").includes("ENTREGA"),
    temDevolucao: String(visDev?.querySelector(".vistoria-fase")?.textContent || "").includes("DEVOLUÇÃO"),
    temPag1: (vis?.querySelector(".pe-vistoria")?.innerText || "").includes("Pág.: 1 / 2"),
    temPag2: (visDev?.querySelector(".pe-vistoria")?.innerText || "").includes("Pág.: 2 / 2"),
    temItens: txt.includes("Visor do Painel") && txt.includes("Banco"),
    temPlano: txt.includes("DK MINHA MOTO"),
    temProto: txt.includes("2026083102"),
    temCor: txt.includes(cor),
    kmEnt,
    kmDev,
    imgSrc: img?.getAttribute("src") || "",
    imgDevSrc: imgDev?.getAttribute("src") || "",
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

async function assertCores(session, base, label, cores, veiculo, shotPrefix) {
  for (const c of cores) {
    await cdpGoto(session, base);
    const seeded = await cdpEval(session, seedExpr(c.cor, veiculo));
    record(`seed ${label} ${c.rotulo}`, Boolean(seeded?.ok), seeded?.cor);
    const built = await cdpEval(session, BUILD);
    record(
      `termo ${label} ${c.rotulo} tem título e MODELO CONTRATADO`,
      Boolean(built?.temTitulo && built?.temCampo && built?.nVistoria === 2),
      JSON.stringify({ nVistoria: built?.nVistoria, temTitulo: built?.temTitulo, temCampo: built?.temCampo })
    );
    record(
      `termo ${label} ${c.rotulo} tem ENTREGA e DEVOLUÇÃO`,
      Boolean(built?.temEntrega && built?.temDevolucao && built?.temPag1 && built?.temPag2 && built?.temItens),
      JSON.stringify({
        entrega: built?.temEntrega,
        devolucao: built?.temDevolucao,
        pag1: built?.temPag1,
        pag2: built?.temPag2,
        itens: built?.temItens,
      })
    );
    record(
      `termo ${label} ${c.rotulo} odômetro só na ENTREGA`,
      /\d/.test(String(built?.kmEnt || "")) && !/\d{3,}/.test(String(built?.kmDev || "")),
      JSON.stringify({ kmEnt: built?.kmEnt, kmDev: built?.kmDev })
    );
    record(
      `termo ${label} ${c.rotulo} usa ${c.file}`,
      String(built?.imgSrc || "").includes(c.file),
      built?.imgSrc || ""
    );
    record(
      `opção ${label} ${c.rotulo} usa a mesma foto`,
      String(built?.opcaoImgSrc || "").includes(c.file),
      built?.opcaoImgSrc || ""
    );
    record(
      `devolução ${label} ${c.rotulo} usa a mesma foto`,
      String(built?.imgDevSrc || "").includes(c.file),
      built?.imgDevSrc || ""
    );
    let imgs = { ok: false };
    for (let i = 0; i < 20; i += 1) {
      imgs = await cdpEval(session, IMGS_READY);
      if (imgs?.ok) break;
      await new Promise((r) => setTimeout(r, 150));
    }
    record(`foto ${label} ${c.rotulo} carregou`, Boolean(imgs?.ok), JSON.stringify(imgs));
    const shot = await saveClip(session, ".pagina-vistoria[data-vistoria='entrega']", `${shotPrefix}_${c.rotulo}.png`);
    record(
      `captura termo ${label} ${c.rotulo}`,
      Boolean(shot) && fs.statSync(shot).size > 20000,
      shot ? `${shot} ${fs.statSync(shot).size}b` : ""
    );
  }
}

async function main() {
  const textos = readLocal("data/dk-contrato-pacote-textos.js");
  const pacote = readLocal("portal-contrato-pacote.js");
  const contrato = readLocal("portal-contrato-locacao.js");
  const modelos = readLocal("data/dk-modelos-veiculo.js");
  const indexHtml = readLocal("index.html");

  record("HTML do Termo de Vistoria", textos.includes("Termo de Vistoria") && textos.includes("Modelo Contratado") && textos.includes("ENTREGA") && textos.includes("DEVOLUÇÃO"));
  record("Builder do termo exportado", pacote.includes("__DK_contratoPacoteBuildVistoriaPagina"));
  record("Gerar contrato inclui o termo", contrato.includes("__DK_contratoPacoteBuildVistoriaPagina") && contrato.includes("Termo de vistoria"));
  record("Resolver das 4 cores SHI 175", ["shi-175-preto.png", "shi-175-vermelho.png", "shi-175-azul.png", "shi-175-cinza.png"].every((f) => modelos.includes(f)));
  record("Resolver das 4 cores Honda Bros", ["bros-160-preto.png", "bros-160-vermelho.png", "bros-160-branco.png", "bros-160-cinza.png"].every((f) => modelos.includes(f)));
  record("Resolver YBR Factor Normal e DX", ["ybr-150-branco.png", "ybr-150-vermelho.png", "ybr-150-preto.png", "ybr-150-dx-azul.png", "ybr-150-dx-preto-fosco.png", "ybr-150-dx-preto-metalico.png"].every((f) => modelos.includes(f)));
  record("Resolver Honda Start", ["start-160-prata.png", "start-160-vermelho.png", "start-160-preto.png", "start-160-azul.png"].every((f) => modelos.includes(f)));
  record("Resolver Renault Kwid", ["kwid-branco.png", "kwid-vermelho.png", "kwid-preto.png", "kwid-bege.png", "kwid-laranja.png"].every((f) => modelos.includes(f)));
  record("Resolver Toyota Etios", modelos.includes("etios-branco.png"));
  record("Resolver Volkswagen Gol", modelos.includes("gol-cinza.png"));
  record("Script do catálogo no index", indexHtml.includes("data/dk-modelos-veiculo.js"));

  for (const c of TODAS_CORES) {
    const p = path.join(ROOT, "images/modelos", c.file);
    record(`arquivo ${c.file}`, fs.existsSync(p) && fs.statSync(p).size > 40000, p);
  }

  await withLocalServer(async (base) => {
    for (const c of TODAS_CORES) {
      const res = await fetch(`${base}images/modelos/${c.file}`);
      const buf = Buffer.from(await res.arrayBuffer());
      record(`HTTP ${c.file}`, res.ok && buf.length > 40000, `${res.status} ${buf.length}b`);
    }

    await withChromePage(async (session) => {
      await session.send("Emulation.setDeviceMetricsOverride", {
        width: 900,
        height: 1400,
        deviceScaleFactor: 1,
        mobile: false,
      });

      await assertCores(session, base, "SHI 175", CORES_SHI, VEICULO_SHI, "termo_vistoria_shi175");
      await assertCores(session, base, "Bros", CORES_BROS, VEICULO_BROS, "termo_vistoria_bros");
      await assertCores(session, base, "YBR", CORES_YBR, VEICULO_YBR, "termo_vistoria_ybr");
      await assertCores(session, base, "YBR DX", CORES_YBR_DX, VEICULO_YBR_DX, "termo_vistoria_ybr_dx");
      await assertCores(session, base, "Start", CORES_START, VEICULO_START, "termo_vistoria_start");
      await assertCores(session, base, "Kwid", CORES_KWID, VEICULO_KWID, "termo_vistoria_kwid");
      await assertCores(session, base, "Etios", CORES_ETIOS, VEICULO_ETIOS, "termo_vistoria_etios");
      await assertCores(session, base, "Gol", CORES_GOL, VEICULO_GOL, "termo_vistoria_gol");

      await cdpGoto(session, base);
      const seededWalk = await cdpEval(session, seedExpr("AZUL", VEICULO_SHI));
      record("seed walkthrough SHI 175 azul", Boolean(seededWalk?.ok));
      const builtWalk = await cdpEval(session, BUILD);
      record(
        "walkthrough 2 páginas ENTREGA e DEVOLUÇÃO",
        Boolean(builtWalk?.nVistoria === 2 && builtWalk?.temEntrega && builtWalk?.temDevolucao),
        JSON.stringify({ n: builtWalk?.nVistoria, e: builtWalk?.temEntrega, d: builtWalk?.temDevolucao })
      );
      const shotEnt = await saveClip(session, ".pagina-vistoria[data-vistoria='entrega']", "termo_vistoria_entrega.png");
      const shotDev = await saveClip(session, ".pagina-vistoria[data-vistoria='devolucao']", "termo_vistoria_devolucao.png");
      record(
        "captura termo ENTREGA",
        Boolean(shotEnt) && fs.statSync(shotEnt).size > 20000,
        shotEnt ? `${shotEnt} ${fs.statSync(shotEnt).size}b` : ""
      );
      record(
        "captura termo DEVOLUÇÃO",
        Boolean(shotDev) && fs.statSync(shotDev).size > 20000,
        shotDev ? `${shotDev} ${fs.statSync(shotDev).size}b` : ""
      );

      await cdpGoto(session, base);
      const seededBranca = await cdpEval(session, seedExpr("BRANCA", VEICULO_SHI));
      record("seed SHI 175 branca", Boolean(seededBranca?.ok));
      const builtBranca = await cdpEval(session, BUILD);
      record(
        "SHI 175 branca não usa foto de outra cor",
        !/shi-175-(preto|vermelho|azul|cinza)\.png/.test(String(builtBranca?.imgSrc || "")),
        builtBranca?.imgSrc || "(vazio)"
      );
      record(
        "SHI 175 branca não usa foto da Bros",
        !/bros-160-/.test(String(builtBranca?.imgSrc || "")),
        builtBranca?.imgSrc || "(vazio)"
      );

      await cdpGoto(session, base);
      const seededAzul = await cdpEval(session, seedExpr("AZUL", VEICULO_BROS));
      record("seed Bros azul", Boolean(seededAzul?.ok));
      const builtAzul = await cdpEval(session, BUILD);
      record(
        "Bros AZUL não usa foto de outra cor",
        !/bros-160-(preto|vermelho|branco|cinza)\.png/.test(String(builtAzul?.imgSrc || "")),
        builtAzul?.imgSrc || "(vazio)"
      );

      await cdpGoto(session, base);
      const seededDxPrata = await cdpEval(session, seedExpr("PRATA", VEICULO_YBR_DX));
      record("seed YBR DX prata", Boolean(seededDxPrata?.ok));
      const builtDxPrata = await cdpEval(session, BUILD);
      record(
        "YBR DX PRATA não usa foto de outra cor",
        !/ybr-150-/.test(String(builtDxPrata?.imgSrc || "")),
        builtDxPrata?.imgSrc || "(vazio)"
      );

      await cdpGoto(session, base);
      const seededFan = await cdpEval(session, seedExpr("VERMELHA", { marca: "HONDA", modelo: "CG 160 FAN", marcaModelo: "CG 160 FAN" }));
      record("seed CG Fan vermelha", Boolean(seededFan?.ok));
      const builtFan = await cdpEval(session, BUILD);
      record(
        "CG Fan não usa foto da Start",
        !/start-160-/.test(String(builtFan?.imgSrc || "")),
        builtFan?.imgSrc || "(vazio)"
      );

      await cdpGoto(session, base);
      const seededKwidAzul = await cdpEval(session, seedExpr("AZUL", VEICULO_KWID));
      record("seed Kwid azul", Boolean(seededKwidAzul?.ok));
      const builtKwidAzul = await cdpEval(session, BUILD);
      record(
        "Kwid AZUL não usa foto de outra cor",
        !/kwid-/.test(String(builtKwidAzul?.imgSrc || "")),
        builtKwidAzul?.imgSrc || "(vazio)"
      );

      await cdpGoto(session, base);
      const seededEtiosVerm = await cdpEval(session, seedExpr("VERMELHA", VEICULO_ETIOS));
      record("seed Etios vermelha", Boolean(seededEtiosVerm?.ok));
      const builtEtiosVerm = await cdpEval(session, BUILD);
      record(
        "Etios VERMELHA não usa foto de outra cor",
        !/etios-/.test(String(builtEtiosVerm?.imgSrc || "")),
        builtEtiosVerm?.imgSrc || "(vazio)"
      );

      await cdpGoto(session, base);
      const seededGolVerm = await cdpEval(session, seedExpr("VERMELHA", VEICULO_GOL));
      record("seed Gol vermelha", Boolean(seededGolVerm?.ok));
      const builtGolVerm = await cdpEval(session, BUILD);
      record(
        "Gol VERMELHA não usa foto de outra cor",
        !/gol-/.test(String(builtGolVerm?.imgSrc || "")),
        builtGolVerm?.imgSrc || "(vazio)"
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
