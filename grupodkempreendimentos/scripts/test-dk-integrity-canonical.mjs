import assert from "node:assert/strict";
import fs from "node:fs";
import {
  canonicalize,
  diffTrees,
  dinheiroExato,
  entityRef,
  hashValue,
  inventoryKeys,
  perdaDeChave,
  reconstruirLocacao,
  stableStringify,
  classificarBlocoDocumento,
  sourcePositionConfere,
} from "../lib/dk-integrity-canonical.mjs";

const ordenado = canonicalize({ z: 1, a: { b: 2, a: 3 }, m: [1, { z: 1, a: 2 }] });
assert.deepEqual(Object.keys(ordenado), ["a", "m", "z"]);
assert.deepEqual(Object.keys(ordenado.a), ["a", "b"]);
assert.deepEqual(Object.keys(ordenado.m[1]), ["a", "z"]);
assert.equal(ordenado.m[0], 1);

assert.notEqual(hashValue(["a", "b"]), hashValue(["b", "a"]));
assert.equal(hashValue({ b: 1, a: 2 }), hashValue({ a: 2, b: 1 }));
assert.notEqual(hashValue("250,00"), hashValue(250));
assert.notEqual(hashValue("250,00"), hashValue("250.00"));
assert.notEqual(stableStringify(null), stableStringify(undefined));
assert.notEqual(hashValue({ a: null }), hashValue({}));
assert.notEqual(hashValue({ a: "" }), hashValue({ a: null }));
assert.equal(hashValue(true), hashValue(true));
assert.notEqual(hashValue(true), hashValue("true"));

const stats = inventoryKeys([{ cpf: "x", extra: null, vazio: "", lista: ["a"] }, { cpf: "y" }]);
const cpf = stats.find((row) => row.path === "cpf");
const extra = stats.find((row) => row.path === "extra");
const vazio = stats.find((row) => row.path === "vazio");
assert.equal(cpf.present, 2);
assert.equal(cpf.filled, 2);
assert.equal(extra.nulls, 1);
assert.equal(extra.filled, 0);
assert.equal(vazio.empty, 1);
assert.equal(vazio.nulls, 0);
assert.equal(stats.some((row) => row.path === "ausente"), false);
const arrStats = inventoryKeys([{ lista: [{ z: 1 }, { z: 2 }] }]);
assert.equal(arrStats.find((row) => row.path === "lista[].z").present, 2);
assert.equal(arrStats.some((row) => row.path.includes("[0]")), false);

const backup = {
  numeroContrato: "2025092903",
  valorLocacao: "250,00",
  portalLancamentosAluguel: [{ protocoloLancamento: "p1", valor: 350 }],
  observacaoLivre: "mantida",
};
const persistido = {
  numeroContrato: "2025092903",
  valorLocacao: "250,00",
  observacaoLivre: "mantida",
};
const reconstruido = reconstruirLocacao(persistido, backup.portalLancamentosAluguel, []);
assert.deepEqual(perdaDeChave(backup, reconstruido), []);
assert.equal(reconstruido.portalLancamentosAluguel[0].protocoloLancamento, "p1");
assert.equal(reconstruido.valorLocacao, "250,00");

const semDestino = reconstruirLocacao({ numeroContrato: "1" }, [], []);
assert.deepEqual(perdaDeChave({ numeroContrato: "1", foto: "data:image/png;base64,YQ==" }, semDestino), ["foto"]);

const divergente = diffTrees({ itens: ["a", "b"] }, { itens: ["b", "a"] });
assert.ok(divergente.mismatches.length > 0);

assert.equal(dinheiroExato("250,00"), 25000);
assert.equal(dinheiroExato("R$ 1.250,00"), 125000);
assert.equal(dinheiroExato(250), 25000);
assert.equal(dinheiroExato("250"), null);

const adaptador = fs.readFileSync(new URL("../lib/dk-locacao-pg.cjs", import.meta.url), "utf8");
assert.match(adaptador, /portalLancamentosAluguel/);
assert.match(adaptador, /function locacaoParaTerminal/);
assert.match(adaptador, /CHAVES_FORA_DO_REGISTRO/);
assert.equal(entityRef("cliente", "0108"), "cliente:0108");
assert.equal(entityRef("cliente", "12345678901").startsWith("cliente:h:"), true);
assert.equal(entityRef("cliente", "12345678901").includes("12345678901"), false);
assert.equal(classificarBlocoDocumento({ data: "29/09/2025", valor: 350 }), null);
assert.equal(classificarBlocoDocumento({ mime: "image/jpeg", nome: "cnh.jpg", data: null }).status, "absent_in_source");
assert.equal(classificarBlocoDocumento({ data: "data:image/png;base64,YQ==" }).status, "verified");
assert.equal(classificarBlocoDocumento({ imagemRecortada: "", imagemIndisponivel: true }).status, "absent_in_source");
assert.equal(sourcePositionConfere(1, 0), true);
assert.equal(sourcePositionConfere(0, 0), false);
assert.equal(sourcePositionConfere(52, 51), true);

console.log("ok dk-integrity-canonical");
