/**
 * Cadastro de locação: a caixa PROTOCOLO tem sempre a opção NOVO, mesmo sem CPF.
 * node grupodkempreendimentos/scripts/test-locacao-novo-protocolo.mjs
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

const ui = readLocal("portal-locadora-ui.js");
const html = readLocal("index.html");
const css = readLocal("styles.css");

record(
  "HTML tem opção NOVO no select PROTOCOLO",
  html.includes('id="operacaoLocacaoProtocoloSelect"') &&
    html.includes('value="__PORTAL_PROTO_NOVO__"') &&
    html.includes("NOVO — (informe data de início)")
);
record("JS acrescenta sempre a opção NOVO", ui.includes("function appendOperacaoLocacaoOptNovo"));
record(
  "JS já não desliga o select só com «Informe um CPF cadastrado»",
  !/sel\.disabled = true[\s\S]{0,220}Informe um CPF cadastrado/.test(ui)
);
record("CSS marca a opção NOVO", css.includes("portal-locacao-proto-opt--novo"));
record(
  "Picker chama appendOperacaoLocacaoOptNovo",
  ui.includes("const { protoNovo } = appendOperacaoLocacaoOptNovo(sel)")
);

const port = 3059;
const child = spawn(process.execPath, ["server.cjs"], {
  cwd: ROOT,
  env: { ...process.env, PORT: String(port) },
  stdio: ["ignore", "pipe", "pipe"],
});

try {
  await waitHttpOk(`http://127.0.0.1:${port}/`);
  const page = await fetch(`http://127.0.0.1:${port}/`).then((r) => r.text());
  record(
    "Servidor local serve o select com NOVO",
    page.includes('id="operacaoLocacaoProtocoloSelect"') &&
      page.includes('value="__PORTAL_PROTO_NOVO__"') &&
      page.includes("NOVO — (informe data de início)")
  );
  const uiRemote = await fetch(`http://127.0.0.1:${port}/portal-locadora-ui.js?v=20260909novo-proto`).then((r) =>
    r.text()
  );
  record(
    "JS servido inclui appendOperacaoLocacaoOptNovo",
    uiRemote.includes("function appendOperacaoLocacaoOptNovo") &&
      !/sel\.disabled = true[\s\S]{0,220}Informe um CPF cadastrado/.test(uiRemote)
  );
} catch (err) {
  record("Servidor local para conferir NOVO", false, String(err && err.message ? err.message : err));
} finally {
  child.kill("SIGTERM");
}

const failed = results.filter((r) => !r.ok);
console.log(`${results.filter((r) => r.ok).length}/${results.length} ok`);
if (failed.length) process.exit(1);
