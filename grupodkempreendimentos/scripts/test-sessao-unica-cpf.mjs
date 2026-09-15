/**
 * CPF único: um acesso por vez, com aviso do IP que será desconectado.
 * node grupodkempreendimentos/scripts/test-sessao-unica-cpf.mjs
 */
import fs from "fs";
import path from "path";
import { createRequire } from "module";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const auth = require(path.join(ROOT, "lib/dk-portal-auth.cjs"));

const results = [];
function record(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} | ${name}${detail ? ` | ${detail}` : ""}`);
}

record(
  "formata CPF com máscara",
  auth.formatCpfBr("03037897430") === "030.378.974-30",
  auth.formatCpfBr("03037897430")
);

const rec = auth.parseSessaoAtivaRaw(
  JSON.stringify({ at: 1, sid: "abc", ip: "187.1.2.3", deviceId: "dev-1" })
);
record("lê sessão JSON com IP", rec.ip === "187.1.2.3" && rec.sid === "abc", rec.ip);

record(
  "mesmo aparelho não conta como ocupado",
  auth.sessaoEstaOcupada(rec, "dev-1") === false,
  ""
);
record(
  "outro aparelho conta como ocupado",
  auth.sessaoEstaOcupada(rec, "dev-2") === true,
  ""
);

const msg = auth.mensagemDesconectarSessao("03037897430", "187.1.2.3");
record(
  "mensagem de confirmação com CPF e IP",
  msg === "O usuário CPF 030.378.974-30 será desconectado no IP 187.1.2.3 caso o login seja confirmado.",
  msg
);

const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const apiJs = fs.readFileSync(path.join(ROOT, "dk-portal-api-auth.js"), "utf8");
const ui = fs.readFileSync(path.join(ROOT, "portal-locadora-ui.js"), "utf8");
const sync = fs.readFileSync(path.join(ROOT, "portal-supabase-sync.js"), "utf8");
const loginApi = fs.readFileSync(path.join(ROOT, "api/dk-portal-auth.js"), "utf8");

record("API recusa segundo login sem confirmar", loginApi.includes("session_em_uso") && loginApi.includes("confirmarUnico"), "");
record("login mostra confirmação antes de desconectar", ui.includes("askConfirmLoginUnico") && html.includes("portalLoginUnicoModal"), "");
record("máquina antiga encerra sessão substituída", sync.includes("session_replaced") && sync.includes("Este CPF entrou noutro computador"), "");
record("device id local para o mesmo PC", apiJs.includes("dk_portal_device_id_v1"), "");

const ok = results.filter((r) => r.ok).length;
console.log(`\n--- ${ok}/${results.length} testes sessão única ---\n`);
process.exit(ok === results.length ? 0 : 1);
