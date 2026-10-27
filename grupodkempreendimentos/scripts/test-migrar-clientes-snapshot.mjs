import { createRequire } from "module";
import assert from "assert";
import path from "path";
import { fileURLToPath } from "url";

const require = createRequire(import.meta.url);
const copiar = require(path.join(path.dirname(fileURLToPath(import.meta.url)), "../lib/dk-clientes-copiar.cjs"));

const origem = [
  { id: "1793095213727", nome: "CURSOR1", cpf: "90000000175", recado2: "[E2E:E2E_DK_REAL_20261027_065940_A7F3:ITER4:1793100259479]", extra: { a: 1, b: 2 } },
  { id: "2", nome: "OUTRO", cpf: "900.000.001-86", recado2: "fica" },
];
const espelho = JSON.parse(JSON.stringify(origem));
const memoria = new Map();
let posts = 0;
let sql = 0;

function rest(caminho, opts) {
  const metodo = (opts && opts.method) || "GET";
  if (String(caminho).startsWith("dk_clientes?select=id,cpf,payload,created_at")) {
    return Promise.resolve({ ok: true, status: 200, data: memoria.size ? [{ id: "1" }] : [] });
  }
  if (String(caminho).startsWith("dk_clientes?select=id,cpf,payload,deleted_at")) {
    return Promise.resolve({ ok: true, status: 200, data: [...memoria.values()] });
  }
  if (metodo === "GET" && String(caminho).includes("deleted_at=is.null")) {
    return Promise.resolve({
      ok: true,
      status: 200,
      data: [...memoria.values()].map((row) => ({ ...row, payload: row.payload })),
    });
  }
  if (metodo === "POST" && String(caminho).includes("on_conflict=id")) {
    posts += 1;
    const lista = Array.isArray(opts.body) ? opts.body : [opts.body];
    for (const linha of lista) memoria.set(linha.id, { ...linha, deleted_at: null });
    return Promise.resolve({ ok: true, status: 201, data: null });
  }
  return Promise.resolve({ ok: false, status: 500, data: { reason: "inesperado" } });
}

function base(extra) {
  return {
    rest,
    sql: async () => {
      sql += 1;
      return {
        ok: true,
        status: 200,
        data: [{ rls: true, anon_insert: false, anon_update: false, auth_insert: false }],
      };
    },
    lerRevisao: extra.lerRevisao,
    lerColecao: async () => ({
      ok: true,
      updated_at: "2026-10-27T14:05:28.832+00:00",
      origem,
      espelho: extra.espelho || espelho,
    }),
    migrationId: "MIG_CLIENTES_20261027_ITER10_TESTE",
  };
}

const hashA = copiar.hashInventario(origem);
const hashB = copiar.hashInventario([{ recado2: origem[0].recado2, cpf: origem[0].cpf, nome: origem[0].nome, id: origem[0].id, extra: origem[0].extra }, origem[1]]);
assert.strictEqual(hashA, hashB);

memoria.clear();
const ok = await copiar.executarCopia(
  base({
    lerRevisao: async () => ({ ok: true, updated_at: "2026-10-27T14:05:28.832+00:00" }),
  })
);
assert.strictEqual(ok.aprovada, true, JSON.stringify(ok));
assert.strictEqual(ok.fonteLigada, false);
assert.strictEqual(ok.r0, ok.r1);
assert.strictEqual(ok.destino.hash, ok.fonte.hash);
assert.strictEqual(ok.cursor1.encontrado, true);
assert.strictEqual(posts > 0, true);
assert.strictEqual(memoria.get("2").payload.cpf, "900.000.001-86");

posts = 0;
const diferente = await copiar.executarCopia(
  base({
    lerRevisao: async () => ({ ok: true, updated_at: "2026-10-27T14:05:28.832+00:00" }),
    espelho: [{ id: "9", cpf: "11111111111", nome: "X" }],
  })
);
assert.strictEqual(diferente.aprovada, false);
assert.strictEqual(diferente.motivo, "espelho_diferente");

let leituras = 0;
memoria.clear();
const mudou = await copiar.executarCopia({
  ...base({}),
  lerRevisao: async () => {
    leituras += 1;
    return { ok: true, updated_at: leituras === 1 ? "2026-10-27T14:05:28.832+00:00" : "2026-10-27T15:00:00.000Z" };
  },
});
assert.strictEqual(mudou.aprovada, false);
assert.strictEqual(mudou.motivo, "r0_diferente_de_r1");
assert.strictEqual(mudou.copiaAindaNaoAprovada, true);
assert.strictEqual(memoria.size, 2);

memoria.clear();
memoria.set("99", { id: "99", cpf: "12345678901", payload: { id: "99" }, deleted_at: null });
const estranho = await copiar.executarCopia(
  base({
    lerRevisao: async () => ({ ok: true, updated_at: "2026-10-27T14:05:28.832+00:00" }),
  })
);
assert.strictEqual(estranho.motivo, "linhas_inesperadas");
assert.strictEqual(estranho.aprovada, false);

const fonte = require("fs").readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "../lib/dk-clientes-copiar.cjs"), "utf8");
assert.ok(!fonte.includes("FLAG_REDIS"));
assert.ok(!fonte.includes("upsertSnapshotByLabel"));
assert.ok(!fonte.includes("redis.set"));
assert.strictEqual(sql > 0, true);
console.log("OK migrar clientes");
