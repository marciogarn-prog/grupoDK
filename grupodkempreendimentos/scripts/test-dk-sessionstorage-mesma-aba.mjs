/**
 * Prova, com dados fictícios e um perfil de navegador vazio,
 * que o sessionStorage sobrevive à navegação na mesma aba e na mesma origem.
 * Não abre o portal, não usa o perfil do Sistema DK e não chama rede externa.
 */
import http from "http";
import fs from "fs";
import os from "os";
import path from "path";
import { spawn } from "child_process";

const PENDING = "FILA-FICTICIA-OFFLINE";
const MODE = "modo-ficticio-offline";
const SESSAO = "SESSAO-FICTICIA-VISIVEL";
const TOKEN = "TOKEN-SESSAO-FICTICIO-SO-NESTE-TESTE";

const portal = `<!doctype html><meta charset="utf-8"><title>teste-portal</title>
<p id="estado">portal ficticio</p>
<script>
sessionStorage.setItem("dk_operacao_offline_pending", ${JSON.stringify(PENDING)});
sessionStorage.setItem("dk_operacao_offline_mode", ${JSON.stringify(MODE)});
sessionStorage.setItem("teste_sessao_dk", ${JSON.stringify(SESSAO)});
sessionStorage.setItem("teste_access_token", ${JSON.stringify(TOKEN)});
document.getElementById("estado").textContent = "gravado";
setTimeout(function () { location.assign("/teste-auditor"); }, 30);
</script>`;

const auditor = `<!doctype html><meta charset="utf-8"><title>teste-auditor</title>
<pre id="out"></pre>
<script>
var nomes = ["dk_operacao_offline_pending","dk_operacao_offline_mode","teste_sessao_dk","teste_access_token"];
var chaves = {};
for (var i = 0; i < sessionStorage.length; i++) {
  var nome = sessionStorage.key(i);
  if (nomes.indexOf(nome) >= 0) chaves[nome] = sessionStorage.getItem(nome);
}
document.getElementById("out").textContent = JSON.stringify({
  href: location.pathname,
  quantidade: sessionStorage.length,
  chaves: chaves
});
</script>`;

function navegador() {
  var candidatos = [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"
  ];
  for (var i = 0; i < candidatos.length; i++) {
    if (fs.existsSync(candidatos[i])) return candidatos[i];
  }
  return "";
}

const server = http.createServer(function (req, res) {
  const url = String(req.url || "/").split("?")[0];
  if (url === "/teste-portal") {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(portal);
    return;
  }
  if (url === "/teste-auditor") {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(auditor);
    return;
  }
  res.writeHead(404);
  res.end("ausente");
});

await new Promise(function (resolve) { server.listen(0, "127.0.0.1", resolve); });
const porta = server.address().port;
const origem = "http://127.0.0.1:" + porta;
const exe = navegador();
if (!exe) {
  server.close();
  console.error("FALHOU: nenhum Chrome ou Edge local para o teste de navegação");
  process.exit(1);
}

const perfil = fs.mkdtempSync(path.join(os.tmpdir(), "dk-sessao-ficticia-"));
const saida = await new Promise(function (resolve, reject) {
  const filho = spawn(exe, [
    "--headless=new",
    "--disable-gpu",
    "--no-first-run",
    "--no-default-browser-check",
    "--user-data-dir=" + perfil,
    "--virtual-time-budget=4000",
    "--timeout=8000",
    "--dump-dom",
    origem + "/teste-portal"
  ], { windowsHide: true });
  let html = "";
  let erro = "";
  filho.stdout.on("data", function (b) { html += b.toString("utf8"); });
  filho.stderr.on("data", function (b) { erro += b.toString("utf8"); });
  filho.on("error", reject);
  filho.on("close", function () { resolve({ html: html, erro: erro }); });
});

server.close();
fs.rmSync(perfil, { recursive: true, force: true });

const texto = saida.html;
const marcado = texto.match(/<pre id="out">([\s\S]*?)<\/pre>/);
let dado = null;
if (marcado) {
  try { dado = JSON.parse(marcado[1]); } catch (e) { dado = null; }
}

if (!dado || dado.href !== "/teste-auditor") {
  console.error("FALHOU: a navegação na mesma aba não chegou em /teste-auditor");
  console.error(texto.slice(0, 500));
  process.exit(1);
}
const ok = dado.chaves["dk_operacao_offline_pending"] === PENDING
  && dado.chaves["dk_operacao_offline_mode"] === MODE
  && dado.chaves["teste_sessao_dk"] === SESSAO
  && dado.chaves["teste_access_token"] === TOKEN
  && dado.quantidade === 4;
if (!ok) {
  console.error("FALHOU: sessionStorage não persistiu na mesma aba");
  console.error(JSON.stringify(dado));
  process.exit(1);
}
console.log("persistencia mesma aba ok");
console.log("origem " + origem);
console.log("chaves " + dado.quantidade);
console.log("href " + dado.href);
