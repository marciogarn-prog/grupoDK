/**
 * Cód. «proximo cliente N» alinhado ao total da nuvem (não fica em 1 com 448 CPF).
 * node grupodkempreendimentos/scripts/test-cliente-proximo-codigo-sync.mjs
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const appSrc = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");
const uiSrc = fs.readFileSync(path.join(ROOT, "portal-locadora-ui.js"), "utf8");

assert.match(appSrc, /Se a nuvem trouxe CPF sem `codigo`/);
assert.match(appSrc, /if \(cpfs\.size > max\) max = cpfs\.size/);
assert.match(appSrc, /PORTAL_CLIENTES_KEY/);
assert.match(uiSrc, /Math\.max\(fromNext, total \+ 1\)/);
assert.match(uiSrc, /proximo\\s\*cliente\\b/);
assert.match(uiSrc, /proximo cliente/);

const m = appSrc.match(/function nextClienteCodigo\(\) \{[\s\S]*?\n\}/);
assert.ok(m, "nextClienteCodigo no app.js");

const store = new Map();
const sandbox = {
  onlyDigits: (v) => String(v ?? "").replace(/\D/g, ""),
  formatClienteCodigoPadrao: (raw) => {
    const d = String(raw ?? "").replace(/\D/g, "");
    if (!d) return "";
    const n = Number(d);
    if (!Number.isFinite(n) || n <= 0) return "";
    return String(Math.trunc(n)).padStart(4, "0");
  },
  getMaxClienteCodigoFromBundledSnapshots: () => 0,
  clientesSeedData: [],
  CLIENTES_DK_FINANCEIRO_2026: [],
  CLIENTES_EXTRA_SYNC_DATA: [],
  CAD_CLIENTES_KEY: "dk_clientes_cadastro",
  PORTAL_CLIENTES_KEY: "dk_portal_clientes_cadastro",
  loadCadastro: (key) => store.get(key) || [],
  window: {},
};
vm.createContext(sandbox);
vm.runInContext(`${m[0]}; this.nextClienteCodigo = nextClienteCodigo;`, sandbox);

/* 448 CPF sem codigo → próximo ≥ 0449 */
const lista = Array.from({ length: 448 }, (_, i) => ({
  cpf: String(10000000000 + i).slice(0, 11),
  nome: "C" + i,
  codigo: "",
}));
store.set("dk_clientes_cadastro", lista);
assert.equal(sandbox.nextClienteCodigo(), "0449");

/* Com código máximo 0500, próximo 0501 */
lista[0].codigo = "0500";
assert.equal(sandbox.nextClienteCodigo(), "0501");

console.log("test-cliente-proximo-codigo-sync ok");
