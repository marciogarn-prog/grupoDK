/**
 * O botão mostra OCUPADO POR NOME em todos os computadores,
 * atualiza sozinho quando outra pessoa entra, e o clique não abre a tela.
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
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url || "/", "http://127.0.0.1");
  let rel = decodeURIComponent(url.pathname);
  if (rel === "/") rel = "/index.html";
  const file = path.join(portalDir, rel);
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
const fails = [];

function rec(name, ok, detail) {
  console.log(`${ok ? "PASS" : "FAIL"} | ${name}${detail ? " | " + detail : ""}`);
  if (!ok) fails.push(name);
}

const areasOcupadas = { "operacao-cadastro-cliente": "Lucelina" };
let dialogs = 0;
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ serviceWorkers: "block" });
page.setDefaultTimeout(20000);
await page.route("**/api/**", async (route) => {
  const req = route.request();
  if (req.url().includes("/api/dk-area-trabalho")) {
    const body = JSON.parse(req.postData() || "{}");
    if (body.acao === "entrar") {
      await route.fulfill({
        status: 409,
        contentType: "application/json",
        body: JSON.stringify({ ok: false, ocupada: true, nome: "Lucelina" }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, areas: { ...areasOcupadas } }),
    });
    return;
  }
  await route.fulfill({ status: 401, contentType: "application/json", body: '{"ok":false}' });
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
  sessionStorage.setItem("dk_portal_sessao_viva_v1", "1");
  sessionStorage.setItem("dk_portal_area_ativa", "operacao");
});
page.on("dialog", (d) => {
  dialogs += 1;
  d.accept();
});

await page.goto(base + "#locadora/empresa", { waitUntil: "domcontentloaded", timeout: 60000 });
const btn = page.locator("#btn-operacao-cadastro-cliente");
await btn.waitFor({ state: "attached", timeout: 30000 });
await page.waitForFunction(() => {
  const el = document.querySelector("#btn-operacao-cadastro-cliente .btn-operacao-cmd__ocupado");
  return el && !el.hidden && el.textContent.includes("OCUPADO POR LUCELINA");
}, { timeout: 20000 });
const texto = await btn.locator(".btn-operacao-cmd__ocupado").innerText();
const bloqueado = await btn.evaluate((el) => el.classList.contains("is-ocupado"));
rec("rótulo abaixo do nome", texto === "OCUPADO POR LUCELINA", texto);
rec("botão marcado como ocupado", bloqueado === true);
const sessaoAntes = await page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem("dk_sessao_cliente") || "null");
  return s && { tipo: s.tipo, cpf: s.cpf, nome: s.nome, role: s.role };
});
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForFunction(() => {
  const el = document.querySelector("#btn-operacao-cadastro-cliente .btn-operacao-cmd__ocupado");
  return el && !el.hidden && el.textContent.includes("OCUPADO POR LUCELINA");
}, { timeout: 20000 });
areasOcupadas["operacao-cadastro-veiculo"] = "Jesimiel de Lima Matias";
await page.waitForFunction(() => {
  const el = document.querySelector("#btn-operacao-cadastro-veiculo .btn-operacao-cmd__ocupado");
  return el && !el.hidden && el.textContent === "OCUPADO POR JESIMIEL";
}, { timeout: 12000 });
const veiculo = await page.locator("#btn-operacao-cadastro-veiculo .btn-operacao-cmd__ocupado").innerText();
rec("outro computador vê ocupado por jesimiel", veiculo === "OCUPADO POR JESIMIEL", veiculo);
const depois = await page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem("dk_sessao_cliente") || "null");
  const login = document.getElementById("panel-login");
  return {
    sessao: s && { tipo: s.tipo, cpf: s.cpf, nome: s.nome, role: s.role },
    loginVisivel: Boolean(login && !login.classList.contains("hidden")),
  };
});
rec(
  "atualizar não pede login",
  Boolean(sessaoAntes) &&
    JSON.stringify(sessaoAntes) === JSON.stringify(depois.sessao) &&
    depois.loginVisivel === false,
  depois.loginVisivel ? "tela de login aberta" : ""
);
const dialogsAntes = dialogs;
await btn.click();
await page.waitForTimeout(400);
const formAberto = await page.locator("#operacaoInlineCliente").evaluate((el) => !el.classList.contains("hidden"));
rec("clique não abre a tela ocupada", formAberto === false);
rec("clique não abre alerta", dialogs === dialogsAntes);

await browser.close();
server.close();
if (fails.length) {
  console.error(`FAIL ${fails.length}`);
  process.exit(1);
}
console.log("OK area ocupada no botao");
