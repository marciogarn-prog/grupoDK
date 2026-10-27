import { createRequire } from "module";
import fs from "fs";
import path from "path";
import assert from "assert";
import { fileURLToPath } from "url";

const require = createRequire(import.meta.url);
const dir = path.dirname(fileURLToPath(import.meta.url));
const pg = require(path.join(dir, "../lib/dk-locacao-pg.cjs"));
const copia = require(path.join(dir, "../lib/dk-locacoes-copiar.cjs"));

assert.strictEqual(pg.moduloPedido(""), false);
assert.strictEqual(pg.moduloPedido("snapshot"), false);
assert.strictEqual(pg.moduloPedido("dk_locacao"), true);
assert.strictEqual(pg.FLAG_LOCACAO, "dk:portal:locacoes_fonte:v1");

global.fetch = () => {
  throw new Error("nao deveria falar com a rede");
};
const inativa = await pg.listar("", { flag: "" });
assert.strictEqual(inativa.migracao, "inativo");
assert.strictEqual(inativa.ativado, false);
assert.deepStrictEqual(inativa.locacoes, []);
const redisCaiu = await pg.listar("", {
  redis: {
    get() {
      throw new Error("redis fora");
    },
  },
});
assert.strictEqual(redisCaiu.migracao, "inativo");
const gravar = await pg.gravarUma({ flag: "", numero: "1000000001", locacao: { numeroContrato: "1000000001" } });
assert.strictEqual(gravar.reason, "modulo_inativo");
assert.strictEqual(gravar.status, 409);
const excluir = await pg.excluirUma({ flag: "", numero: "1000000001", version: 1 });
assert.strictEqual(excluir.reason, "modulo_inativo");
const relogio = await pg.relogio({ flag: "" });
assert.strictEqual(relogio.selo, "inativo");

const tela = fs.readFileSync(path.join(dir, "../portal-locacao-pg.js"), "utf8");
assert.ok(tela.includes("data.ativado === true"));
const api = fs.readFileSync(path.join(dir, "../lib/dk-locacao-pg.cjs"), "utf8");
const inicio = api.indexOf("async function listar");
const migrar = api.indexOf("migrarSnapshotOficial", inicio);
const gate = api.indexOf("moduloPedido", inicio);
assert.ok(gate > inicio && gate < migrar);

const fonteCopia = fs.readFileSync(path.join(dir, "../lib/dk-locacoes-copiar.cjs"), "utf8");
assert.ok(!fonteCopia.includes("redis.set"));
assert.ok(!fonteCopia.includes("upsertSnapshot"));
assert.ok(!fonteCopia.includes("dk-locacoes-integrity"));
assert.ok(!fonteCopia.includes(pg.FLAG_LOCACAO));
const lista = '{"payload":{"dk_locacoes_cadastro":[{"id":"1","numeroContrato":"10"},{"id":"1","numeroContrato":"11"}]}}';
const bruto = copia.extrairArray(lista, "dk_locacoes_cadastro");
assert.deepStrictEqual(copia.objetosDoArray(bruto).length, 2);
assert.strictEqual(copia.hashFinal(["b", "a"]), copia.hashFinal(["a", "b"]));

const sql = fs.readFileSync(
  path.join(dir, "../../supabase/migrations/20261027193109_create_dk_locacao.sql"),
  "utf8"
);
assert.ok(sql.includes("numero_contrato text not null unique"));
assert.ok(sql.includes("id_legado text"));
assert.ok(!sql.includes("id_legado text unique"));
assert.ok(!sql.includes("unique (id_legado)"));
assert.ok(sql.includes("enable row level security"));
assert.ok(sql.includes("grant select, insert, update on table public.dk_locacao to service_role"));
assert.ok(!/grant\s+delete/i.test(sql));
assert.ok(!sql.includes("references public.dk_clientes"));
assert.ok(!sql.includes("references public.dk_veiculos"));
assert.ok(!sql.includes("create table if not exists public.dk_locacao_movimento"));
assert.ok(!sql.includes("dk_locacao_modulo"));
assert.ok(sql.includes("portalLancamentosAluguel"));

console.log("OK copia locacoes");
