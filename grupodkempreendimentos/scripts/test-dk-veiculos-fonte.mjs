import { createRequire } from "module";
import fs from "fs";
import path from "path";
import assert from "assert";
import { fileURLToPath } from "url";

const require = createRequire(import.meta.url);
const dir = path.dirname(fileURLToPath(import.meta.url));
const fonte = require(path.join(dir, "../lib/dk-veiculos-fonte.cjs"));
const pg = require(path.join(dir, "../lib/dk-veiculos-pg.cjs"));

assert.strictEqual(fonte.normalizarPedido("pg"), "dk_veiculos");
assert.strictEqual(fonte.normalizarPedido("dk_veiculos"), "dk_veiculos");
assert.strictEqual(fonte.normalizarPedido("snapshot"), "snapshot");
assert.strictEqual(fonte.normalizarPedido("redis"), "");
assert.strictEqual(fonte.modoDe(""), "snapshot");
assert.strictEqual(fonte.modoDe("dk_veiculos"), "pg");
assert.strictEqual(pg.pedidoUm({ data: [{ id: "1", placa: "AAA1A11" }] }), null);
assert.ok(pg.pedidoUm({ operacao: "upsert", veiculo: { id: "1", placa: "AAA1A11" } }));

const memoria = new Map();
const redis = {
  get(chave) {
    assert.strictEqual(chave, "dk:portal:veiculos_fonte:v1");
    return Promise.resolve(memoria.has(chave) ? memoria.get(chave) : null);
  },
  set(chave, valor) {
    memoria.set(chave, valor);
    return Promise.resolve("OK");
  },
};
assert.strictEqual((await fonte.lerFonte(redis)).modo, "snapshot");
const ligado = await fonte.aplicarFonte(redis, "pg");
assert.strictEqual(ligado.body.valorDepois, "dk_veiculos");
assert.strictEqual(ligado.body.snapshotAlterado, false);
const voltou = await fonte.aplicarFonte(redis, "snapshot");
assert.strictEqual(voltou.body.valorDepois, "snapshot");

const linhas = new Map();
function rest(caminho, opts) {
  const metodo = (opts && opts.method) || "GET";
  const texto = String(caminho);
  if (texto.includes("dk_cloud_snapshots") || texto.includes("/pg/") || texto.includes("veiculos_cadastro")) {
    throw new Error("fonte_errada");
  }
  if (metodo === "GET" && texto.startsWith("dk_veiculos?select=id&limit=1")) {
    return Promise.resolve({ ok: true, status: 200, data: [] });
  }
  if (metodo === "GET" && texto.includes("deleted_at=is.null&select=id,placa,payload")) {
    return Promise.resolve({
      ok: true,
      status: 200,
      data: [...linhas.values()].filter((row) => !row.deleted_at).map((row) => ({ id: row.id, placa: row.placa, payload: row.payload })),
    });
  }
  if (metodo === "GET" && texto.includes("id=eq.")) {
    const id = decodeURIComponent(texto.split("id=eq.")[1].split("&")[0]);
    const row = linhas.get(id);
    return Promise.resolve({ ok: true, status: 200, data: row ? [row] : [] });
  }
  if (metodo === "GET" && texto.includes("placa=eq.")) {
    const placa = decodeURIComponent(texto.split("placa=eq.")[1].split("&")[0]);
    return Promise.resolve({
      ok: true,
      status: 200,
      data: [...linhas.values()].filter((row) => row.placa === placa && !row.deleted_at),
    });
  }
  if (metodo === "POST" && texto.includes("on_conflict=id")) {
    const linha = opts.body;
    linhas.set(linha.id, { ...linha, deleted_at: null });
    return Promise.resolve({ ok: true, status: 201, data: [linhas.get(linha.id)] });
  }
  return Promise.resolve({ ok: false, status: 500, data: { reason: "inesperado" } });
}

const criado = await pg.upsertUm({ id: "1787510118980", placa: "RZS4G95", proprietario: "MARCIO JOSÉ SIQUEIRA DOS SANTOS", proprietarioCpfCnpj: "", updatedAt: 1792602801134 }, "", rest);
assert.strictEqual(criado.ok, true);
assert.strictEqual(criado.body.linhas_afetadas, 1);
assert.strictEqual(criado.body.snapshot_gravacoes, 0);
assert.strictEqual(linhas.get("1787510118980").payload.proprietarioCpfCnpj, "");
assert.strictEqual(linhas.get("1787510118980").payload.updatedAt, 1792602801134);

const novo = await pg.upsertUm({ id: "9001", placa: "AAA1A11", local: "TESTE", modelo: "CURSOR" }, "", rest);
assert.strictEqual(novo.ok, true);
assert.strictEqual(linhas.size, 2);

const placa = await pg.upsertUm({ id: "9002", placa: "AAA1A11", local: "OUTRO" }, "", rest);
assert.strictEqual(placa.status, 409);
assert.strictEqual(placa.body.reason, "placa_duplicada");
assert.strictEqual(linhas.size, 2);

const atualizado = await pg.upsertUm({ id: "9001", placa: "AAA1A11", local: "[E2E]", modelo: "CURSOR" }, linhas.get("9001").updated_at, rest);
assert.strictEqual(atualizado.ok, true);
assert.strictEqual(linhas.get("9001").payload.local, "[E2E]");
assert.strictEqual(linhas.get("9001").placa, "AAA1A11");

const lista = await pg.listar(rest);
assert.strictEqual(lista.veiculos.length, 2);
const modo = await pg.modoOperacional(redis, rest);
assert.strictEqual(modo.modo, "snapshot");
memoria.set("dk:portal:veiculos_fonte:v1", "dk_veiculos");
let sondas = 0;
const restLento = async (caminho) => {
  if (String(caminho).includes("select=id&limit=1")) sondas += 1;
  return { ok: false, status: 522, data: { reason: "leitura_lenta" } };
};
const modoPg = await pg.modoOperacional(redis, restLento);
assert.strictEqual(modoPg.modo, "pg");
assert.strictEqual(sondas, 0);
const listaFalha = await pg.listar(restLento);
assert.strictEqual(listaFalha.ok, false);
assert.strictEqual(listaFalha.status, 503);
assert.strictEqual(listaFalha.reason, "leitura_lenta");
assert.strictEqual(listaFalha.veiculos.length, 0);
assert.strictEqual(sondas, 0);
const listaAusente = await pg.listar(async () => ({ ok: false, status: 404, data: { code: "PGRST205", message: "Could not find the table" } }));
assert.strictEqual(listaAusente.status, 503);
assert.strictEqual(listaAusente.reason, "tabela_ausente");
const postLento = await pg.upsertUm({ id: "9001", placa: "AAA1A11", local: "NAO" }, "", restLento);
assert.strictEqual(postLento.ok, false);
assert.strictEqual(postLento.body.reason, "leitura_lenta");
assert.strictEqual(postLento.body.source, "dk_veiculos");
assert.strictEqual(sondas, 0);
assert.strictEqual(linhas.get("9001").payload.local, "[E2E]");

const api = fs.readFileSync(path.join(dir, "../api/cadastro-veiculos.js"), "utf8");
const pgSrc = fs.readFileSync(path.join(dir, "../lib/dk-veiculos-pg.cjs"), "utf8");
assert.ok(api.includes('reason: "um_veiculo"'));
assert.ok(api.includes("veiculosPg.listar"));
assert.ok(!api.includes("tabelaExiste"));
assert.ok(api.indexOf('modo.modo === "pg"') < api.indexOf("redis.get(STORAGE_KEY)"));
assert.ok(api.includes("source: veiculosPg.FONTE"));
assert.ok(pgSrc.includes("ms: 45000"));
assert.ok(!pgSrc.includes("redis.set"));
assert.ok(!pgSrc.includes("dk_cloud_snapshots"));
assert.ok(!pgSrc.includes("dk_portal_veiculos_cadastro"));
assert.ok(!pgSrc.includes("upsertSnapshotByLabel"));
assert.ok(!pgSrc.includes("/pg/query"));
const ui = fs.readFileSync(path.join(dir, "../portal-locadora-ui.js"), "utf8");
assert.ok(ui.includes("portalEnviarUmVeiculoParaNuvem"));
assert.ok(ui.includes("portalAlinharVeiculosAoEntrarNaTela"));
assert.ok(ui.includes("window.__DK_VEICULO_TELA"));
assert.ok(ui.includes("window.__DK_VEICULOS_PG !== true"));
console.log("OK fonte veiculos");
