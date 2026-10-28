import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const raiz = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const ui = fs.readFileSync(path.join(raiz, "portal-locadora-ui.js"), "utf8");
const anterior = execFileSync(
  "git",
  ["show", "HEAD:grupodkempreendimentos/portal-locadora-ui.js"],
  { cwd: path.join(raiz, ".."), encoding: "utf8", maxBuffer: 8 * 1024 * 1024 }
);

function corpo(fonte, nome, ate) {
  const marca = `function ${nome}(`;
  const inicio = fonte.indexOf(marca);
  assert.ok(inicio >= 0, nome);
  if (!ate) {
    let i = fonte.indexOf("{", inicio);
    let nivel = 0;
    for (; i < fonte.length; i += 1) {
      const ch = fonte[i];
      if (ch === "{") nivel += 1;
      else if (ch === "}") {
        nivel -= 1;
        if (nivel === 0) return fonte.slice(inicio, i + 1);
      }
    }
    throw new Error(`fim nao encontrado: ${nome}`);
  }
  const fim = fonte.indexOf(ate, inicio + marca.length);
  assert.ok(fim > inicio, `${nome} ate ${ate}`);
  return fonte.slice(inicio, fim);
}

function exige(nome, trecho) {
  assert.ok(corpo(ui, nome).includes(trecho), `${nome} → ${trecho}`);
}

exige("getPortalLancamentosAluguelDoContrato", "lerAtivosTela");
exige("getPortalLancamentosAluguelRemovidosDoContrato", "lerRemovidosTela");
exige("persistPortalLancamentoAluguelPagamento", "criarTela");
exige("persistPortalLancamentoAluguelDevolucao", "criarTela");
exige("persistPortalLancamentoAluguelCreditoManutencao", "criarTela");
exige("persistPortalLancamentoAluguelCaucao", "criarTela");
exige("atualizarPortalLancamentoAluguelPorIndice", "atualizarTela");
exige("apagarPortalLancamentoAluguelPorIndice", "removerTela");
exige("apagarPortalLancamentoAluguelPorProtocolo", "removerTela");

const semLoop = [
  ["legacyPersistPortalLancamentoAluguelPagamento", "function persistPortalLancamentoAluguelPagamento("],
  ["legacyApagarPortalLancamentoAluguelPorIndice", "function legacyApagarPortalLancamentoAluguelPorProtocolo("],
  ["legacyApagarPortalLancamentoAluguelPorProtocolo", "function legacyAtualizarPortalLancamentoAluguelPorIndice("],
  ["legacyAtualizarPortalLancamentoAluguelPorIndice", "function apagarPortalLancamentoAluguelPorIndice("],
  ["legacyGetPortalLancamentosAluguelDoContrato", "function portalLerPagamentosPeloStore("],
];
for (const [nome, ate] of semLoop) {
  const texto = corpo(ui, nome, ate);
  assert.equal(texto.includes("portalDelegarPagamento"), false, nome);
  assert.equal(texto.includes("criarTela"), false, nome);
  assert.equal(texto.includes("atualizarTela"), false, nome);
  assert.equal(texto.includes("removerTela"), false, nome);
}

function igual(atual, antes, nome) {
  const limpo = (texto) => String(texto).replace(/\r\n/g, "\n");
  const a = crypto.createHash("sha256").update(limpo(atual)).digest("hex");
  const b = crypto.createHash("sha256").update(limpo(antes)).digest("hex");
  assert.equal(a, b, nome);
}

igual(
  corpo(ui, "legacyPersistPortalLancamentoAluguelPagamento", "function persistPortalLancamentoAluguelPagamento(").replace(
    "legacyPersistPortalLancamentoAluguelPagamento",
    "persistPortalLancamentoAluguelPagamento"
  ),
  corpo(anterior, "persistPortalLancamentoAluguelPagamento", "function persistPortalLancamentoAluguelDevolucao("),
  "persist"
);
igual(
  corpo(ui, "legacyGetPortalLancamentosAluguelDoContrato", "function portalLerPagamentosPeloStore(").replace(
    "legacyGetPortalLancamentosAluguelDoContrato",
    "getPortalLancamentosAluguelDoContrato"
  ),
  corpo(anterior, "getPortalLancamentosAluguelDoContrato", "function sumPortalLancamentosAluguelTotal("),
  "leitura"
);
igual(
  corpo(ui, "legacyAtualizarPortalLancamentoAluguelPorIndice", "function apagarPortalLancamentoAluguelPorIndice(").replace(
    "legacyAtualizarPortalLancamentoAluguelPorIndice",
    "atualizarPortalLancamentoAluguelPorIndice"
  ),
  corpo(anterior, "atualizarPortalLancamentoAluguelPorIndice", "function renderOperacaoLancAluguelHistorico("),
  "atualizar"
);
igual(
  corpo(ui, "legacyApagarPortalLancamentoAluguelPorIndice", "function legacyApagarPortalLancamentoAluguelPorProtocolo(").replace(
    "legacyApagarPortalLancamentoAluguelPorIndice",
    "apagarPortalLancamentoAluguelPorIndice"
  ),
  corpo(anterior, "apagarPortalLancamentoAluguelPorIndice", "function apagarPortalLancamentoAluguelPorProtocolo("),
  "remover-indice"
);
igual(
  corpo(ui, "legacyApagarPortalLancamentoAluguelPorProtocolo", "function legacyAtualizarPortalLancamentoAluguelPorIndice(").replace(
    "legacyApagarPortalLancamentoAluguelPorProtocolo",
    "apagarPortalLancamentoAluguelPorProtocolo"
  ),
  corpo(anterior, "apagarPortalLancamentoAluguelPorProtocolo", "function atualizarPortalLancamentoAluguelPorIndice("),
  "remover-protocolo"
);
igual(corpo(ui, "sumPortalLancamentosAluguelTotal"), corpo(anterior, "sumPortalLancamentosAluguelTotal"), "soma");
igual(
  corpo(ui, "portalMontarTextoReciboPagamentoAluguel"),
  corpo(anterior, "portalMontarTextoReciboPagamentoAluguel"),
  "recibo"
);
igual(corpo(ui, "somaPagamentosCalendarioPorIso"), corpo(anterior, "somaPagamentosCalendarioPorIso"), "calendario");
assert.equal(ui.includes('const MODO_PRODUCAO'), false);

console.log("tela store legacy ok");
