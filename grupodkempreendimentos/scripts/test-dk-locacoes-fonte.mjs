import { createRequire } from "module";
import assert from "assert";
import path from "path";
import { fileURLToPath } from "url";

const require = createRequire(import.meta.url);
const dir = path.dirname(fileURLToPath(import.meta.url));
const fonte = require(path.join(dir, "../lib/dk-locacoes-fonte.cjs"));

assert.strictEqual(fonte.normalizarPedido("pg"), "dk_locacao");
assert.strictEqual(fonte.normalizarPedido("dk_locacao"), "dk_locacao");
assert.strictEqual(fonte.normalizarPedido("snapshot"), "snapshot");
assert.strictEqual(fonte.normalizarPedido("redis"), "");
assert.strictEqual(fonte.modoDe(""), "snapshot");
assert.strictEqual(fonte.modoDe("dk_locacao"), "pg");

const memoria = new Map();
const redis = {
  get(chave) {
    assert.strictEqual(chave, "dk:portal:locacoes_fonte:v1");
    return Promise.resolve(memoria.has(chave) ? memoria.get(chave) : null);
  },
  set(chave, valor) {
    assert.strictEqual(chave, "dk:portal:locacoes_fonte:v1");
    memoria.set(chave, valor);
    return Promise.resolve("OK");
  },
};
assert.strictEqual((await fonte.lerFonte(redis)).modo, "snapshot");
const ligado = await fonte.aplicarFonte(redis, "pg");
assert.strictEqual(ligado.body.valorDepois, "dk_locacao");
assert.strictEqual(ligado.body.snapshotAlterado, false);
const voltou = await fonte.aplicarFonte(redis, "snapshot");
assert.strictEqual(voltou.body.valorDepois, "snapshot");
assert.strictEqual(memoria.size, 1);
console.log("OK fonte locacao");
