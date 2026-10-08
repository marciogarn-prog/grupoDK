/**
 * O botão mostra ( OCUPADO POR NOME) depois da atualização,
 * a sessão da equipa continua, e o clique não abre a tela ocupada.
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
      body: JSON.stringify({ ok: true, areas: { "operacao-cadastro-cliente": "Lucelina" } }),
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
page.on("dialog", (d) => d.accept());

await page.goto(base + "#locadora/empresa", { waitUntil: "domcontentloaded", timeout: 60000 });
const btn = page.locator("#btn-operacao-cadastro-cliente");
await btn.waitFor({ state: "attached", timeout: 30000 });
await page.waitForFunction(() => {
  const el = document.querySelector("#btn-operacao-cadastro-cliente .btn-operacao-cmd__ocupado");
  return el && !el.hidden && el.textContent.includes("OCUPADO POR LUCELINA");
}, { timeout: 20000 });
const texto = await btn.locator(".btn-operacao-cmd__ocupado").innerText();
rec("rótulo abaixo do nome", texto === "( OCUPADO POR LUCELINA)", texto);
const sessaoAntes = await page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem("dk_sessao_cliente") || "null");
  return s && { tipo: s.tipo, cpf: s.cpf, nome: s.nome, role: s.role };
});
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForFunction(() => {
  const el = document.querySelector("#btn-operacao-cadastro-cliente .btn-operacao-cmd__ocupado");
  return el && !el.hidden && el.textContent.includes("OCUPADO POR LUCELINA");
}, { timeout: 20000 });
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
await btn.click();
await page.waitForTimeout(400);
const formAberto = await page.locator("#operacaoInlineCliente").evaluate((el) => !el.classList.contains("hidden"));
rec("clique não abre a tela ocupada", formAberto === false);

await browser.close();
server.close();
if (fails.length) {
  console.error(`FAIL ${fails.length}`);
  process.exit(1);
}
console.log("OK area ocupada no botao");
