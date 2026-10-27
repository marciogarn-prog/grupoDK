import { createRequire } from "module";
import fs from "fs";
import path from "path";
import assert from "assert";
import { fileURLToPath } from "url";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pg = require("../lib/dk-clientes-pg.cjs");

const memoria = new Map();
let sqlChamadas = 0;
let snapshotGravado = 0;

function restFalso(caminho, opts) {
  const metodo = (opts && opts.method) || "GET";
  if (caminho.startsWith("dk_clientes?select=id")) {
    return Promise.resolve({ ok: true, status: 200, data: memoria.size ? [{ id: "1" }] : [] });
  }
  if (metodo === "GET" && caminho.includes("cpf=eq.")) {
    const cpf = decodeURIComponent(caminho.split("cpf=eq.")[1].split("&")[0]);
    const linhas = [...memoria.values()].filter((row) => row.cpf === cpf && !row.deleted_at);
    return Promise.resolve({ ok: true, status: 200, data: linhas });
  }
  if (metodo === "GET" && caminho.includes("deleted_at=is.null")) {
    return Promise.resolve({ ok: true, status: 200, data: [...memoria.values()] });
  }
  if (metodo === "POST") {
    const lista = Array.isArray(opts.body) ? opts.body : [opts.body];
    for (const linha of lista) memoria.set(linha.id, { ...linha, deleted_at: linha.deleted_at || null });
    return Promise.resolve({ ok: true, status: 201, data: lista });
  }
  return Promise.resolve({ ok: false, status: 500, data: { reason: "inesperado" } });
}

function restErro() {
  return Promise.resolve({ ok: false, status: 503, data: { reason: "supabase_timeout" } });
}

(async () => {
  const origem = [
    { id: "1793095213727", cpf: "90000000175", nome: "CURSOR1", recado2: "ITER4", senha: "guarda" },
    { id: "2", cpf: "90000000186", nome: "OUTRO", recado2: "fica" },
  ];
  const tabela = await pg.garantirTabela({ rest: restFalso, sql: async () => { sqlChamadas += 1; return { ok: true, status: 200, data: [] }; } });
  assert.strictEqual(tabela.ok, true);
  const copia = await pg.copiarLista(origem, restFalso);
  assert.strictEqual(copia.ok, true);
  assert.strictEqual(snapshotGravado, 0);
  const lido = await pg.listarClientes(restFalso);
  const cmp = pg.compararListas(origem, lido.clientes);
  assert.strictEqual(cmp.ok, true, JSON.stringify(cmp));
  assert.strictEqual(cmp.idsIguais, 2);
  assert.strictEqual(cmp.cpfsIguais, 2);

  const salvo = await pg.upsertUm(
    { id: "999", cpf: "90000000175", nome: "CURSOR1", recado2: "ITER6" },
    memoria.get("1793095213727").updated_at,
    restFalso
  );
  assert.strictEqual(salvo.ok, true);
  assert.strictEqual(salvo.body.snapshot_gravacoes, 0);
  assert.strictEqual(String(salvo.body.cliente.id), "1793095213727");
  assert.strictEqual(memoria.get("1793095213727").payload.senha, "guarda");
  assert.strictEqual(memoria.get("2").payload.recado2, "fica");
  assert.strictEqual(memoria.size, 2);

  const duplicado = await pg.lerPorCpf("90000000175", async () => ({
    ok: true,
    status: 200,
    data: [{ id: "1", cpf: "90000000175" }, { id: "2", cpf: "90000000175" }],
  }));
  assert.strictEqual(duplicado.duplicado, true);
  const conflito = await pg.upsertUm({ cpf: "90000000175", nome: "CURSOR1" }, "", async () => ({
    ok: true,
    status: 200,
    data: [{ id: "1", cpf: "90000000175", payload: { id: "1", senha: "x" }, updated_at: "2026-10-27T12:00:00.000Z" }, { id: "2", cpf: "90000000175", payload: {}, updated_at: "2026-10-27T12:00:00.000Z" }],
  }));
  assert.strictEqual(conflito.body.reason, "cpf_duplicado");
  assert.notStrictEqual(conflito.body.success, true);

  const falha = await pg.upsertUm({ id: "3", cpf: "90000000197", nome: "NOVO" }, "", async (caminho) => {
    if (String(caminho).includes("cpf=eq.")) return { ok: true, status: 200, data: [] };
    return restErro();
  });
  assert.strictEqual(falha.ok, false);
  assert.strictEqual(falha.body.success, false);
  assert.strictEqual(falha.body.reason, "gravacao");

  const api = fs.readFileSync(path.join(__dirname, "../api/cadastro-clientes.js"), "utf8");
  const lista = api.slice(api.indexOf("data: dropClientesCpfExcluidos(lido.clientes)"), api.indexOf("const { clientes } = await fetchPortalCadastrosFromRedis"));
  assert.ok(!lista.includes("ioSnapshotOficial"));
  assert.ok(!lista.includes("dk_cloud_snapshots"));
  const post = api.slice(api.lastIndexOf("if (await clientesFontePronta(redis))"), api.indexOf("const incoming"));
  assert.ok(post.includes("upsertUm"));
  assert.ok(post.includes("snapshot_gravacoes: 0"));
  assert.ok(!post.includes("executarGravacaoCentral"));
  assert.ok(!post.includes("ioSnapshotOficial"));
  assert.ok(api.includes("fetchPortalCadastrosFromRedis"));
  assert.ok(api.includes("resolveDeployChannel"));
  assert.ok(!api.includes("DK_DISK_IO_SAFE_MODE"));
  const migrar = fs.readFileSync(path.join(__dirname, "../api/dk-clientes-migrar.js"), "utf8");
  assert.ok(!migrar.includes("upsertSnapshotByLabel"));
  assert.ok(!migrar.includes("fetchSnapshotByLabel"));
  assert.ok(migrar.includes("payload->dk_clientes_cadastro"));
  assert.ok(migrar.includes("dk:portal:cloud_snapshot:v1"));
  console.log("OK clientes pg");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
