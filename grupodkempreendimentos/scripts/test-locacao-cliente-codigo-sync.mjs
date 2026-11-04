/**
 * Cadastro de locação alinha clientes da nuvem (ex.: 0432 UILIAN sem contrato).
 * node grupodkempreendimentos/scripts/test-locacao-cliente-codigo-sync.mjs
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const ui = fs.readFileSync(path.join(ROOT, "portal-locadora-ui.js"), "utf8");
const { isCodigoAcimaDoUltimoClienteOficial } = require("../lib/dk-sequencia-cliente-0427.cjs");

assert.match(ui, /portalAlinharClientesAoEntrarNaTela/);
assert.match(ui, /applyOperacaoLocacaoClienteFromCodigoAsync/);
assert.match(
  ui,
  /btn-operacao-cadastro-locacao[\s\S]*portalAlinharClientesAoEntrarNaTela[\s\S]*portalEnsureLocacoesFromCloud/
);

/* 0432 UILIAN (PG): data 21/10/2026 — NÃO é furado acima de 0427. */
assert.equal(
  isCodigoAcimaDoUltimoClienteOficial(
    {
      codigo: "0432",
      dataCadastro: "21/10/2026",
      cpf: "04874486509",
      nome: "UILIAN LEITE DE SOUZA",
      id: "1793039369369",
    },
    "codigo"
  ),
  false
);

console.log("test-locacao-cliente-codigo-sync ok");
