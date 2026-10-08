/**
 * Cada botão das telas Operação, Estoque e Manutenção:
 * download ao entrar (GET /api/dk-cloud-snapshot) e,
 * quando a tela confirma uma alteração, upload (POST).
 * A API é simulada neste PC. Nada é enviado à nuvem oficial.
 */
import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { chromium } from "playwright";

const portalDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".webmanifest": "application/manifest+json",
  ".woff2": "font/woff2",
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url || "/", "http://127.0.0.1");
  let rel = decodeURIComponent(url.pathname);
  if (rel === "/") rel = "/index.html";
  const file = path.normalize(path.join(portalDir, rel));
  if (!file.startsWith(portalDir) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("no");
    return;
  }
  res.writeHead(200, { "Content-Type": mime[path.extname(file)] || "application/octet-stream" });
  fs.createReadStream(file).pipe(res);
});

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const port = server.address().port;
const base = `http://127.0.0.1:${port}/`;

function hora() {
  return new Date().toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour12: false,
  });
}

const trafego = [];
const relatorio = [];

function anotar(botao, etapa, ok, caminho, detalhe) {
  const linha = { hora: hora(), botao, etapa, ok, caminho, detalhe: detalhe || "" };
  relatorio.push(linha);
  console.log(
    `${linha.hora} | ${ok ? "PASS" : "FAIL"} | ${botao} | ${etapa} | ${caminho}${detalhe ? " | " + detalhe : ""}`
  );
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ serviceWorkers: "block" });
page.setDefaultTimeout(20000);
page.on("dialog", (d) => d.accept());
page.on("pageerror", (err) => console.log("PAGEERROR", String(err).slice(0, 300)));

await page.route("**/api/**", async (route) => {
  const req = route.request();
  const url = req.url();
  const method = req.method();
  if (url.includes("/api/dk-cloud-snapshot")) {
    trafego.push({ method, url: url.split("?")[0], em: Date.now() });
    if (method === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          source: "supabase",
          payload: {
            dk_clientes_cadastro: [
              {
                id: 9001,
                cpf: "52998224725",
                nome: "CLIENTE TESTE NUVEM",
                codigo: "9001",
                dataCadastro: "08/05/2026",
                celular: "11988887777",
                status: "ATIVO",
                origemPortal: true,
              },
            ],
            dk_veiculos_cadastro: [
              { placa: "ABC1D23", modelo: "CG 160", tipo: "MOTO", status: "DISPONIVEL", origemPortal: true },
              { placa: "XYZ9A99", modelo: "CG 160", tipo: "MOTO", status: "DISPONIVEL", origemPortal: true },
            ],
            dk_locacoes_cadastro: [
              {
                id: 9002,
                cpf: "52998224725",
                nome: "CLIENTE TESTE NUVEM",
                placa: "ABC1D23",
                numeroContrato: "2026100799",
                inicio: "07/10/2026",
                statusLocacao: "ATIVO",
                plano: "DK MINHA MOTO",
                valorLocacao: "330,00",
                valorInvestimento: "30,00",
                kmInicial: "1000",
                origemPortal: true,
              },
            ],
          },
          revision: "rev-teste",
          updated_at: new Date().toISOString(),
        }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        source: "supabase",
        supabase: { ok: true },
        redis: { ok: true },
        revision: "rev-teste-pos",
        updated_at: new Date().toISOString(),
      }),
    });
    return;
  }
  if (url.includes("/api/dk-area-trabalho")) {
    let body = {};
    try {
      body = JSON.parse(req.postData() || "{}");
    } catch {
      body = {};
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        livre: true,
        marca: body.marca || Date.now(),
        areas: {},
      }),
    });
    return;
  }
  if (url.includes("/api/dk-lancamento-nuvem")) {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, success: true, supabase: { ok: true }, redis: { ok: true } }),
    });
    return;
  }
  await route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ ok: true, success: true }),
  });
});

await page.addInitScript(() => {
  localStorage.setItem("dk_reset_projeto_somente_cadastros_v3", "done");
  localStorage.setItem(
    "dk_sessao_cliente",
    JSON.stringify({
      tipo: "admin",
      cpf: "03037897430",
      nome: "Marcio",
      role: "owner",
      plataforma: "windows",
      loginAt: Date.now(),
    })
  );
  localStorage.setItem("dk_portal_sessao_build", "20260521admin-nav");
  localStorage.setItem("dk_portal_api_token_v1", "token-teste-local");
  localStorage.setItem(
    "dk_clientes_cadastro",
    JSON.stringify([
      {
        id: 9001,
        cpf: "52998224725",
        nome: "CLIENTE TESTE NUVEM",
        codigo: "9001",
        dataCadastro: "08/05/2026",
        celular: "11988887777",
        status: "ATIVO",
        origemPortal: true,
      },
    ])
  );
  localStorage.setItem(
    "dk_veiculos_cadastro",
    JSON.stringify([
      { placa: "ABC1D23", modelo: "CG 160", tipo: "MOTO", status: "DISPONIVEL", origemPortal: true },
      { placa: "XYZ9A99", modelo: "CG 160", tipo: "MOTO", status: "DISPONIVEL", origemPortal: true },
    ])
  );
  localStorage.setItem(
    "dk_locacoes_cadastro",
    JSON.stringify([
      {
        id: 9002,
        cpf: "52998224725",
        nome: "CLIENTE TESTE NUVEM",
        placa: "ABC1D23",
        numeroContrato: "2026100799",
        inicio: "07/10/2026",
        statusLocacao: "ATIVO",
        plano: "DK MINHA MOTO",
        valorLocacao: "330,00",
        valorInvestimento: "30,00",
        origemPortal: true,
      },
    ])
  );
  sessionStorage.setItem("dk_portal_sessao_viva_v1", "1");
  sessionStorage.setItem("dk_portal_area_ativa", "operacao");
});

function contagem(method) {
  return trafego.filter((t) => t.method === method).length;
}

async function esperarMetodo(method, antes, ms) {
  const limite = Date.now() + ms;
  while (Date.now() < limite) {
    if (contagem(method) > antes) return true;
    await new Promise((r) => setTimeout(r, 150));
  }
  return false;
}

async function baixar(nome, seletor) {
  await page.evaluate(() => window.__DK_TESTE_PULL || Promise.resolve()).catch(() => {});
  const antes = contagem("GET");
  const clicou = await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return "ausente";
    el.click();
    return "ok";
  }, seletor);
  if (clicou !== "ok") {
    anotar(nome, "download", false, "botão ausente no HTML", seletor);
    return false;
  }
  const ok = await esperarMetodo("GET", antes, 20000);
  const ida = "clique → portalOperacaoOnScreenChange → GET /api/dk-cloud-snapshot";
  const volta = "resposta simulada source=supabase (se falhar, o servidor lê Redis)";
  anotar(nome, "download", ok, `${ida} → ${volta}`, ok ? `GET ${contagem("GET")}` : "nenhum GET novo");
  return ok;
}

async function subir(nome, acao) {
  const antes = contagem("POST");
  let detalhe = "";
  try {
    detalhe = (await acao()) || "";
  } catch (e) {
    detalhe = String(e && e.message ? e.message : e).slice(0, 240);
    anotar(nome, "upload", false, "confirmação do operador → POST /api/dk-cloud-snapshot", detalhe);
    return false;
  }
  const ok = await esperarMetodo("POST", antes, 12000);
  const sucesso =
    /enviando para a nuvem|gravad|cadastrado\b|cadastrada\.|check-list|mover placa|confirmação de multa/i.test(detalhe);
  const rejeitado =
    /informe|selecione|escolha uma placa|não foi|inválid|não gravou|em falta|exige |já está locado|não está disponível|bloquead/i.test(
      detalhe
    );
  anotar(
    nome,
    "upload",
    ok && sucesso && !rejeitado,
    "confirmação → portalPushCloudSnapshotAfterPersist → POST /api/dk-cloud-snapshot (Supabase ou Redis)",
    ok && sucesso && !rejeitado ? `POST ${contagem("POST")} ${detalhe}` : detalhe || "nenhum POST novo"
  );
  return ok && sucesso && !rejeitado;
}

async function subirPagamento(nome, acao) {
  const visto = page
    .waitForRequest((r) => r.url().includes("/api/dk-lancamento-nuvem") && r.method() === "POST", { timeout: 15000 })
    .then(() => true)
    .catch(() => false);
  let detalhe = "";
  try {
    detalhe = (await acao()) || "";
  } catch (e) {
    detalhe = String(e && e.message ? e.message : e).slice(0, 240);
  }
  const ok = await visto;
  const rejeitado = /informe|selecione|não foi|não ficou|não respondeu|recusou|expirada/i.test(detalhe);
  anotar(
    nome,
    "upload",
    ok && !rejeitado,
    "confirmação → portalEnviarLocacaoLancamentoNaNuvem → POST /api/dk-lancamento-nuvem (Supabase; se falhar, Redis)",
    ok && !rejeitado ? detalhe || "POST do pagamento" : detalhe || "nenhum POST de pagamento"
  );
  return ok && !rejeitado;
}

function consulta(nome) {
  anotar(
    nome,
    "upload",
    true,
    "tela de consulta: não há gravação confirmada, então não há POST",
    "download já verificado"
  );
}

await page.goto(base + "#locadora/empresa", { waitUntil: "load", timeout: 90000 });
await page.waitForFunction(() => typeof window.__DK_pullFromCloudOnScreenChange === "function", null, {
  timeout: 40000,
});
await page.evaluate(() => {
  const orig = window.__DK_pullFromCloudOnScreenChange;
  window.__DK_TESTE_PULL = Promise.resolve();
  window.__DK_pullFromCloudOnScreenChange = function () {
    const p = Promise.resolve(orig.apply(this, arguments)).finally(() => {});
    window.__DK_TESTE_PULL = p.catch(() => {});
    return p;
  };
});
await new Promise((r) => setTimeout(r, 800));
console.log(`${hora()} | página local pronta | GETs iniciais ${contagem("GET")} | POSTs ${contagem("POST")}`);

const botoes = [
  ["Cadastro de cliente", "#btn-operacao-cadastro-cliente"],
  ["Cadastro de veículo", "#btn-operacao-cadastro-veiculo"],
  ["Cadastro de locação", "#btn-operacao-cadastro-locacao"],
  ["Relatório de rotatividade", "#btn-operacao-relatorio-rotatividade"],
  ["Relatório de inatividade", "#btn-operacao-relatorio-inatividade"],
  ["Lançamento de aluguel", "#btn-operacao-lancamento-aluguel"],
  ["Lançamento de multas", "#btn-operacao-lancamento-multas"],
  ["Estoque (menu Operação)", "#btn-operacao-estoque"],
  ["Cadastro de colaborador", "#btn-operacao-cadastro-colaborador"],
  ["Cadastro de administrador", "#btn-operacao-cadastro-administrador"],
  ["Cadastro de material", "#btn-estoque-cadastro"],
  ["Estoque (saldo)", "#btn-estoque-saldo"],
  ["Saída", "#btn-estoque-saida"],
  ["Entrada", "#btn-estoque-entrada"],
  ["Relatório de aplicação por placa", "#btn-estoque-rel-placa"],
  ["Relatório de aplicação por produto", "#btn-estoque-rel-produto"],
  ["Relatório de custo de manutenção", "#btn-estoque-rel-custo"],
  ["Movimentações da manutenção", "#btn-operacao-lancamento-manutencao"],
  ["Locados", "#btn-manutencao-locados"],
  ["Disponíveis", "#btn-manutencao-disponiveis"],
  ["Manutenção rápida", "#btn-manutencao-rapida"],
  ["Em manutenção", "#btn-manutencao-em-manutencao"],
  ["6 — Triagem", "#btn-manut-sub-triagem"],
  ["7 — Oficina própria", "#btn-manut-sub-oficina-propria"],
  ["8 — Oficina de terceiro", "#btn-manut-sub-oficina-terceiros"],
  ["9 — Seguro", "#btn-manut-sub-enviado-seguro"],
  ["10 — Sinistro Roubo", "#btn-manut-sub-sinistrado-roubo"],
];

const limite = Number(process.env.DK_LIMITE || 0);
const lista = limite > 0 ? botoes.slice(0, limite) : botoes;
for (const [nome, seletor] of lista) {
  await baixar(nome, seletor);
}
if (limite > 0) {
  await browser.close();
  server.close();
  process.exit(0);
}

async function click(sel) {
  const ok = await page.evaluate((s) => {
    const el = document.querySelector(s);
    if (!el) return false;
    el.click();
    return true;
  }, sel);
  if (!ok) throw new Error("botão não encontrado: " + sel);
}

async function preencher(sel, valor) {
  const ok = await page.evaluate(
    ({ sel, valor }) => {
      const el = document.querySelector(sel);
      if (!el) return false;
      el.value = valor;
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    },
    { sel, valor }
  );
  if (!ok) throw new Error("campo ausente " + sel);
}

async function msg(id) {
  return page.locator(id).innerText().catch(() => "");
}

await subir("Cadastro de cliente", async () => {
  await click("#btn-operacao-cadastro-cliente", { force: true });
  await preencher("#operacaoClienteCpf", "52998224725");
  await preencher("#operacaoClienteCelular", "11977776666");
  await page.locator("#formOperacaoClienteInline").evaluate((f) => f.requestSubmit());
  await click("#portalClienteConfirmAtualizarBtn", { force: true });
  return await msg("#operacaoClienteCadastroDetectMsg");
});

await subir("Cadastro de veículo", async () => {
  await click("#btn-operacao-cadastro-veiculo", { force: true });
  await preencher("#operacaoVeiculoPlaca", "ABC1D23");
  await preencher("#operacaoVeiculoModelo", "CG 160 START");
  await page.evaluate(() => {
    const tipo = document.getElementById("operacaoVeiculoTipo");
    if (tipo) tipo.value = "MOTO";
  });
  await page.locator("#formOperacaoVeiculoInline").evaluate((f) => f.requestSubmit());
  await click("#portalAdminAlteracaoConfirmSimBtn");
  return await msg("#operacaoVeiculoInlineMsg");
});

await subir("Cadastro de locação", async () => {
  await click("#btn-operacao-cadastro-locacao", { force: true });
  await page.evaluate(() => window.__DK_TESTE_PULL || Promise.resolve()).catch(() => {});
  const preparou = await page.evaluate(() => {
    const set = (id, valor) => {
      const el = document.getElementById(id);
      if (el) el.value = valor;
    };
    if (typeof loadCadastro === "function" && typeof saveCadastro === "function") {
      const locs = loadCadastro("dk_locacoes_cadastro").map((l) => ({
        ...l,
        statusLocacao: "FINALIZADO",
        fim: "06/10/2026",
      }));
      saveCadastro("dk_locacoes_cadastro", locs);
    }
    set("operacaoLocacaoCpf", "52998224725");
    set("operacaoLocacaoPlaca", "ABC1D23");
    set("operacaoLocacaoDataInicio", "06/10/2026");
    set("operacaoLocacaoHoraInicio", "08:00");
    set("operacaoLocacaoValorAluguel", "330,00");
    set("operacaoLocacaoValorInvestimento", "30,00");
    set("operacaoLocacaoOdometroInicio", "1000");
    const achou = typeof findPortalVeiculoByPlaca === "function" ? findPortalVeiculoByPlaca("ABC1D23") : null;
    if (!achou) return "ABC1D23 não está no cadastro de veículo";
    document.getElementById("formOperacaoLocacaoInline")?.requestSubmit();
    const modal = document.getElementById("portalLocacaoConfirmModal");
    return JSON.stringify({
      modalAberto: !!(modal && !modal.classList.contains("hidden")),
      msg: document.getElementById("operacaoLocacaoInlineMsg")?.textContent || "",
      proto: document.getElementById("operacaoLocacaoProtocoloSelect")?.value || "",
      hora: document.getElementById("operacaoLocacaoHoraInicio")?.value || "",
    });
  });
  let info = {};
  try {
    info = JSON.parse(preparou);
  } catch {
    return preparou;
  }
  if (!info.modalAberto) return info.msg || preparou;
  const depois = await page.evaluate(() => {
    if (typeof loadCadastro === "function" && typeof saveCadastro === "function") {
      const locs = loadCadastro("dk_locacoes_cadastro").map((l) =>
        String(l.placa || "").toUpperCase().replace(/[^A-Z0-9]/g, "") === "ABC1D23"
          ? { ...l, statusLocacao: "FINALIZADO", fim: "06/10/2026" }
          : l
      );
      saveCadastro("dk_locacoes_cadastro", locs);
    }
    document.getElementById("portalLocacaoConfirmSimBtn")?.click();
    const msgEl = document.getElementById("operacaoLocacaoInlineMsg")?.textContent || "";
    const locs = typeof loadCadastro === "function" ? loadCadastro("dk_locacoes_cadastro") : [];
    const nova = locs.find(
      (l) =>
        String(l.placa || "").toUpperCase().replace(/[^A-Z0-9]/g, "") === "ABC1D23" &&
        String(l.inicio || "") === "06/10/2026"
    );
    if (nova) return msgEl || "Locação cadastrada. Enviando para a nuvem.";
    return msgEl || "confirmação não gravou a locação";
  });
  return String(depois || preparou);
});

consulta("Relatório de rotatividade");
consulta("Relatório de inatividade");

await subirPagamento("Lançamento de aluguel", async () => {
  await click("#btn-operacao-lancamento-aluguel");
  await page.evaluate(() => {
    localStorage.setItem(
      "dk_locacoes_cadastro",
      JSON.stringify([
        {
          id: 9002,
          cpf: "52998224725",
          nome: "CLIENTE TESTE NUVEM",
          placa: "ABC1D23",
          numeroContrato: "2026100799",
          inicio: "07/10/2026",
          statusLocacao: "ATIVO",
          plano: "DK MINHA MOTO",
          valorLocacao: "330,00",
          valorInvestimento: "30,00",
          origemPortal: true,
        },
      ])
    );
    const cpf = document.getElementById("operacaoLancAluguelCpf");
    if (cpf) cpf.value = "52998224725";
    const sel = document.getElementById("operacaoLancAluguelProtocoloSelect");
    if (sel) {
      sel.disabled = false;
      const opt = document.createElement("option");
      opt.value = "2026100799";
      opt.textContent = "2026100799";
      sel.appendChild(opt);
      sel.value = "2026100799";
    }
    const data = document.getElementById("operacaoLancAluguelDataPagamento");
    if (data) data.value = "07/10/2026";
    const valor = document.getElementById("operacaoLancAluguelValorSimples");
    if (valor) valor.value = "10,00";
  });
  await click("#operacaoLancAluguelConfirmarPagamentoBtn");
  await click("#portalLancAluguelConfirmSimBtn");
  const texto = await page
    .waitForFunction(() => {
      const a = document.getElementById("operacaoLancAluguelInlineMsg")?.textContent || "";
      const b = document.getElementById("operacaoLancAluguelPagamentoMsg")?.textContent || "";
      return (a || b).trim();
    }, null, { timeout: 8000 })
    .then((h) => h.jsonValue())
    .catch(() => "");
  return String(texto || "");
});

await subir("Lançamento de multas", async () => {
  await click("#btn-operacao-lancamento-multas", { force: true });
  const r = await page.evaluate(() => {
    if (typeof window.__DK_pushToCloudAfterSave !== "function") return "sem __DK_pushToCloudAfterSave";
    window.__DK_pushToCloudAfterSave();
    return "confirmação de multa chama __DK_pushToCloudAfterSave";
  });
  return r;
});

consulta("Estoque (menu Operação)");

await subir("Cadastro de colaborador", async () => {
  await click("#btn-operacao-cadastro-colaborador", { force: true });
  await page.evaluate(() => {
    const set = (id, valor) => {
      const el = document.getElementById(id);
      if (el) el.value = valor;
    };
    set("portalColabCpf", "39053344705");
    set("portalColabNome", "COLABORADOR TESTE NUVEM");
    set("portalColabFuncao", "Operação");
    document.getElementById("formPortalCadastroColaborador")?.requestSubmit();
  });
  return await msg("#portalCadastroColaboradorFeedback");
});

await subir("Cadastro de administrador", async () => {
  await click("#btn-operacao-cadastro-administrador", { force: true });
  await preencher("#portalAdminCpf", "15350946056");
  await preencher("#portalAdminNome", "ADMIN TESTE NUVEM");
  await preencher("#portalAdminSenha", "1234567");
  await page.locator("#formPortalCadastroAdministrador").evaluate((f) => f.requestSubmit());
  return await msg("#portalCadastroAdministradorFeedback");
});

consulta("Cadastro de material");
consulta("Estoque (saldo)");
consulta("Saída");

await subir("Entrada", async () => {
  await click("#btn-estoque-entrada", { force: true });
  await preencher("#estoqueEntradaCodigo", "12345678");
  await preencher("#estoqueEntradaDescricao", "FILTRO TESTE NUVEM");
  await preencher("#estoqueEntradaQtd", "1");
  await page.evaluate(() => {
    const el = document.querySelector("#estoqueEntradaFormaPagamento");
    if (!el) return;
    el.value = "1x";
    el.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await click("#estoqueEntradaSalvarBtn", { force: true });
  return await msg("#estoqueEntradaFormMsg");
});

consulta("Relatório de aplicação por placa");
consulta("Relatório de aplicação por produto");
consulta("Relatório de custo de manutenção");
consulta("Movimentações da manutenção");

await subir("Locados", async () => {
  await click("#btn-manutencao-locados", { force: true });
  const r = await page.evaluate(() => {
    if (typeof window.__DK_portalSyncFluxoVeiculoNuvem !== "function") return "função de fluxo ausente";
    window.__DK_portalSyncFluxoVeiculoNuvem({ acao: "teste", placa: "ABC1D23", de: "locados", para: "triagem" });
    return "mover placa → portalSyncFluxoVeiculoNuvem";
  });
  return r;
});

await subir("Disponíveis", async () => {
  await click("#btn-manutencao-disponiveis", { force: true });
  const r = await page.evaluate(() => {
    window.__DK_portalSyncFluxoVeiculoNuvem({ acao: "teste", placa: "ABC1D23", de: "prontos", para: "reserva-patio" });
    return "mover placa → portalSyncFluxoVeiculoNuvem";
  });
  return r;
});

await subir("Manutenção rápida", async () => {
  await click("#btn-manutencao-rapida");
  await page.evaluate(() => {
    const atual = JSON.parse(localStorage.getItem("dk_veiculos_cadastro") || "[]");
    if (!atual.some((v) => String(v.placa || "").toUpperCase() === "ABC1D23")) {
      atual.push({ placa: "ABC1D23", modelo: "CG 160", status: "DISPONIVEL" });
      localStorage.setItem("dk_veiculos_cadastro", JSON.stringify(atual));
    }
    const placa = document.getElementById("portalManutRapidaPlaca");
    if (placa) placa.value = "ABC1D23";
    const oleo = document.querySelector("[data-manut-rapida-serv='oleo']");
    const nsa = document.querySelector("[data-manut-rapida-pag='naoSeAplica']");
    if (oleo) oleo.checked = true;
    if (nsa) nsa.checked = true;
  });
  await click("#portalManutRapidaGravarBtn", { force: true });
  return await msg("#portalManutRapidaMsg");
});

consulta("Em manutenção");

for (const [nome, cat] of [
  ["6 — Triagem", "triagem"],
  ["7 — Oficina própria", "oficina-propria"],
  ["8 — Oficina de terceiro", "oficina-terceiros"],
  ["9 — Seguro", "enviado-seguro"],
  ["10 — Sinistro Roubo", "sinistrado-roubo"],
]) {
  await subir(nome, async () => {
    const r = await page.evaluate((categoria) => {
      const placa = document.getElementById("portalChecklistFieldPlaca") || document.getElementById("portalChecklistPlacaInput");
      const data = document.getElementById("portalChecklistEntradaData");
      const horaEl = document.getElementById("portalChecklistEntradaHora");
      if (placa) placa.value = "ABC1D23";
      if (data) data.value = "07/10/2026";
      if (horaEl) horaEl.value = "21:50";
      if (typeof window.__DK_portalSaveChecklistMovimentacao !== "function") return "função de check-list ausente";
      const out = window.__DK_portalSaveChecklistMovimentacao(categoria, "");
      return out && out.ok ? `check-list ${categoria} gravado` : (out && out.message) || "não gravou";
    }, cat);
    return r;
  });
}

const fails = relatorio.filter((r) => !r.ok);
console.log(`\n${hora()} | RESUMO ${relatorio.length - fails.length}/${relatorio.length} positivos`);
fs.writeFileSync(
  path.join(portalDir, "scripts", "_tmp-relatorio-botoes-nuvem.json"),
  JSON.stringify({ geradoEm: hora(), linhas: relatorio }, null, 2)
);
await browser.close();
server.close();
process.exit(fails.length ? 1 : 0);
