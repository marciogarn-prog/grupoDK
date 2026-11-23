/**
 * Entrada de área exclusiva: API 409 + cliente não abre tela ocupada.
 * node grupodkempreendimentos/scripts/test-area-entrada-exclusiva.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const api = fs.readFileSync(path.join(root, "api", "dk-area-trabalho.js"), "utf8");
const ui = fs.readFileSync(path.join(root, "portal-locadora-ui.js"), "utf8");
const fails = [];

function ok(name, cond, detail = "") {
  console.log(`${cond ? "PASS" : "FAIL"} | ${name}${detail ? " | " + detail : ""}`);
  if (!cond) fails.push(name);
}

ok("API não compartilha área ocupada", !/Compartilha a área: presença informativa/.test(api));
ok("API responde 409 quando ocupada", /status\(409\)/.test(api) && /ocupada:\s*true/.test(api));
ok("API marca livre false", /livre:\s*false/.test(api));
ok("UI bloqueia em 409", /res\.status === 409 \|\| data\?\.ocupada/.test(ui));
ok("UI devolve false ao ocupar", /portalEntrarAreaExclusiva[\s\S]*?return false/.test(ui));
ok("UI mantém aviso de área ocupada", /portalAvisarAreaOcupada/.test(ui));
ok(
  "UI não diz que presença é só aviso",
  !/Presença Redis é só aviso \(OCUPADO POR…\)\. Nunca bloqueia a abertura da aba\./.test(ui)
);

if (fails.length) {
  console.error(`FAIL ${fails.length}`);
  process.exit(1);
}
console.log("OK area entrada exclusiva");
