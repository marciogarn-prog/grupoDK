import { createRequire } from "module";
import fs from "fs";
import path from "path";
import assert from "assert";
import { fileURLToPath } from "url";

const require = createRequire(import.meta.url);
const dir = path.dirname(fileURLToPath(import.meta.url));
const fonte = require(path.join(dir, "../lib/dk-clientes-fonte.cjs"));
const pg = require(path.join(dir, "../lib/dk-clientes-pg.cjs"));

assert.strictEqual(fonte.normalizarPedido("pg"), "dk_clientes");
assert.strictEqual(fonte.normalizarPedido("dk_clientes"), "dk_clientes");
assert.strictEqual(fonte.normalizarPedido("snapshot"), "snapshot");
assert.strictEqual(fonte.normalizarPedido("outra"), "");
assert.strictEqual(fonte.modoDe(""), "snapshot");
assert.strictEqual(fonte.modoDe("dk_clientes"), "pg");

const memoria = new Map();
function redisFalso() {
  return {
    get(chave) {
      assert.strictEqual(chave, "dk:portal:clientes_fonte:v1");
      return Promise.resolve(memoria.has(chave) ? memoria.get(chave) : null);
    },
    set(chave, valor) {
      memoria.set(chave, valor);
      return Promise.resolve("OK");
    },
  };
}

const redis = redisFalso();
const antes = await fonte.lerFonte(redis);
assert.strictEqual(antes.modo, "snapshot");
const ligado = await fonte.aplicarFonte(redis, "pg");
assert.strictEqual(ligado.status, 200);
assert.strictEqual(ligado.body.valorDepois, "dk_clientes");
assert.strictEqual(ligado.body.snapshotAlterado, false);
const voltou = await fonte.aplicarFonte(redis, "snapshot");
assert.strictEqual(voltou.body.valorAntes, "dk_clientes");
assert.strictEqual(voltou.body.valorDepois, "snapshot");
assert.strictEqual(voltou.body.modoDepois, "snapshot");
const invalido = await fonte.aplicarFonte(redis, "redis");
assert.strictEqual(invalido.status, 400);

const linhas = new Map();
let posts = 0;
function rest(caminho, opts) {
  const metodo = (opts && opts.method) || "GET";
  if (String(caminho).includes("dk_cloud_snapshots") || String(caminho).includes("/pg/query")) {
    throw new Error("snapshot_ou_sql");
  }
  if (metodo === "GET" && String(caminho).includes("cpf=eq.")) {
    const cpf = decodeURIComponent(String(caminho).split("cpf=eq.")[1].split("&")[0]);
    return Promise.resolve({
      ok: true,
      status: 200,
      data: [...linhas.values()].filter((row) => row.cpf === cpf),
    });
  }
  if (metodo === "GET" && String(caminho).includes("deleted_at=is.null")) {
    return Promise.resolve({ ok: true, status: 200, data: [...linhas.values()] });
  }
  if (metodo === "POST") {
    posts += 1;
    const lista = Array.isArray(opts.body) ? opts.body : [opts.body];
    for (const linha of lista) linhas.set(linha.id, linha);
    return Promise.resolve({ ok: true, status: 201, data: lista });
  }
  return Promise.resolve({ ok: false, status: 500, data: { reason: "inesperado" } });
}

linhas.set("2", {
  id: "2",
  cpf: "90000000186",
  payload: { id: "2", cpf: "90000000186", nome: "OUTRO", recado2: "fica" },
  updated_at: "2026-10-27T15:00:00.000Z",
});
linhas.set("1793095213727", {
  id: "1793095213727",
  cpf: "90000000175",
  payload: { id: "1793095213727", cpf: "90000000175", nome: "CURSOR1", recado2: "antes" },
  updated_at: "2026-10-27T15:00:00.000Z",
});
const salvo = await pg.upsertUm(
  { id: "novo", cpf: "90000000175", nome: "CURSOR1", recado2: "ITER13" },
  "2026-10-27T15:00:00.000Z",
  rest
);
assert.strictEqual(salvo.ok, true);
assert.strictEqual(salvo.body.snapshot_gravacoes, 0);
assert.strictEqual(String(salvo.body.cliente.id), "1793095213727");
assert.strictEqual(linhas.get("1793095213727").payload.recado2, "ITER13");
assert.strictEqual(linhas.get("2").payload.recado2, "fica");
assert.strictEqual(posts, 1);

const falha = await pg.listarClientes(async () => ({ ok: false, status: 503, data: { reason: "supabase_timeout" } }));
assert.strictEqual(falha.ok, false);
assert.strictEqual(falha.status, 503);

const api = fs.readFileSync(path.join(dir, "../api/cadastro-clientes.js"), "utf8");
const inicioGet = api.indexOf("const t0 = Date.now();");
const ramoGet = api.slice(inicioGet, api.indexOf("const { clientes } = await fetchPortalCadastrosFromRedis"));
assert.ok(ramoGet.includes("listarClientes"));
assert.ok(ramoGet.includes('reason: "leitura"'));
assert.ok(!ramoGet.includes("fetchPortalCadastrosFromRedis"));
assert.ok(!ramoGet.includes("dk_cloud_snapshots"));
const ramoPost = api.slice(api.lastIndexOf("if (await clientesFontePronta(redis))"), api.indexOf("const incoming"));
assert.ok(ramoPost.includes("upsertUm"));
assert.ok(ramoPost.includes("snapshot_gravacoes: 0"));
assert.ok(!ramoPost.includes("executarGravacaoCentral"));
assert.ok(!ramoPost.includes("upsertSnapshotByLabel"));
assert.ok(api.includes("fetchPortalCadastrosFromRedis"));
assert.ok(api.includes("executarGravacaoCentral"));

const rota = fs.readFileSync(path.join(dir, "../api/dk-clientes-fonte.js"), "utf8");
assert.ok(!rota.includes("dk_cloud_snapshots"));
assert.ok(!rota.includes("upsertSnapshotByLabel"));
assert.ok(!rota.includes("copiarLista"));
assert.ok(!rota.includes("garantirTabela"));
assert.ok(rota.includes("somente_titular"));
const lib = fs.readFileSync(path.join(dir, "../lib/dk-clientes-fonte.cjs"), "utf8");
assert.ok(!lib.includes("dk_cloud_snapshots"));
assert.ok(!lib.includes("copiarLista"));

console.log("OK fonte clientes");
