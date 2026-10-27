import { createRequire } from "module";
import assert from "assert";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const require = createRequire(import.meta.url);
const dir = path.dirname(fileURLToPath(import.meta.url));
const copiar = require(path.join(dir, "../lib/dk-veiculos-copiar.cjs"));

const origem = [
  {
    id: "1787510118980",
    placa: "RZS4G95",
    proprietario: "MARCIO JOSÉ SIQUEIRA DOS SANTOS",
    proprietarioCpfCnpj: "",
    updatedAt: 1792602801134,
    extra: { a: 1, b: 2 },
  },
  { id: "2", placa: "ABC1D23", proprietario: "OUTRO", proprietarioCpfCnpj: "123.456.789-09", updatedAt: 10 },
];
const espelho = [{ id: "1787510118980", placa: "RZS4G95", proprietario: "OUTRO NOME", updatedAt: 1 }];
const memoria = new Map();
let posts = 0;
let clientesConsultados = 0;

function rest(caminho, opts) {
  const metodo = (opts && opts.method) || "GET";
  const texto = String(caminho);
  if (texto.startsWith("dk_veiculos?select=id&limit=1")) {
    return Promise.resolve({ ok: true, status: 200, data: memoria.size ? [{ id: "1" }] : [] });
  }
  if (texto.startsWith("dk_veiculos?select=id,placa,deleted_at")) {
    return Promise.resolve({
      ok: true,
      status: 200,
      data: [...memoria.values()].map((row) => ({ id: row.id, placa: row.placa, deleted_at: row.deleted_at || null })),
    });
  }
  if (metodo === "GET" && texto.includes("deleted_at=is.null") && texto.startsWith("dk_veiculos")) {
    return Promise.resolve({
      ok: true,
      status: 200,
      data: [...memoria.values()].map((row) => ({ id: row.id, placa: row.placa, payload: row.payload })),
    });
  }
  if (metodo === "POST" && texto.includes("on_conflict=id")) {
    posts += 1;
    const lista = Array.isArray(opts.body) ? opts.body : [opts.body];
    for (const linha of lista) memoria.set(linha.id, { ...linha, deleted_at: null });
    return Promise.resolve({ ok: true, status: 201, data: null });
  }
  if (texto.startsWith("dk_clientes?")) {
    clientesConsultados += 1;
    return Promise.resolve({ ok: true, status: 200, data: [{ cpf: "12345678909" }] });
  }
  return Promise.resolve({ ok: false, status: 500, data: { reason: "inesperado", caminho: texto } });
}

function base(extra) {
  let leituras = 0;
  return {
    rest,
    migrationId: "MIG_VEICULOS_TESTE",
    lerFonte: async () => {
      leituras += 1;
      const mudou = extra && extra.mudarNaSegunda && leituras > 1;
      const revisao = extra && extra.revisoes ? extra.revisoes[Math.min(leituras - 1, extra.revisoes.length - 1)] : "2026-10-27T16:08:32.074+00:00";
      return {
        ok: true,
        updated_at: revisao,
        origem: mudou ? origem.map((item) => ({ ...item, cor: "nova" })) : origem,
        espelho,
      };
    },
  };
}

const hashA = copiar.hashInventario(origem);
const hashB = copiar.hashInventario([
  { extra: origem[0].extra, updatedAt: origem[0].updatedAt, proprietarioCpfCnpj: "", placa: "RZS4G95", proprietario: origem[0].proprietario, id: origem[0].id },
  origem[1],
]);
assert.strictEqual(hashA, hashB);

memoria.clear();
posts = 0;
const ok = await copiar.executarCopia(base({ revisoes: ["2026-10-27T16:08:32.074+00:00", "2026-10-27T16:20:00.000+00:00"] }));
assert.strictEqual(ok.aprovada, true, JSON.stringify(ok));
assert.strictEqual(ok.r0 === ok.r1, false);
assert.strictEqual(ok.veiculosMudaram, false);
assert.strictEqual(ok.fonteLigada, false);
assert.strictEqual(ok.cutover, false);
assert.strictEqual(ok.redisAlteradoPelaMigracao, false);
assert.strictEqual(ok.snapshotAlteradoPelaMigracao, false);
assert.strictEqual(ok.espelhoAlterado, false);
assert.strictEqual(ok.espelho.usadoComoFonte, false);
assert.strictEqual(ok.destino.hash, ok.fonteDepois.hash);
assert.strictEqual(ok.veiculo.identico, true);
assert.strictEqual(ok.veiculo.proprietarioDestino, "MARCIO JOSÉ SIQUEIRA DOS SANTOS");
assert.strictEqual(ok.veiculo.proprietarioCpfCnpjDestino, "");
assert.strictEqual(ok.veiculo.updatedAtDestino, 1792602801134);
assert.strictEqual(memoria.get("1787510118980").payload.proprietario, "MARCIO JOSÉ SIQUEIRA DOS SANTOS");
assert.strictEqual(memoria.get("2").placa, "ABC1D23");
assert.strictEqual(Object.prototype.hasOwnProperty.call(memoria.get("2"), "created_at"), false);
assert.strictEqual(ok.relacaoClientes.cpfs, 1);
assert.strictEqual(ok.relacaoClientes.cnpjs, 0);
assert.strictEqual(ok.relacaoClientes.cpfsEncontrados, 1);
assert.strictEqual(ok.relacaoClientes.cpfsNaoEncontrados, 0);
assert.strictEqual(posts > 0, true);
assert.strictEqual(clientesConsultados, 1);

memoria.clear();
const mudou = await copiar.executarCopia(base({ mudarNaSegunda: true, revisoes: ["2026-10-27T16:08:32.074+00:00", "2026-10-27T16:08:32.074+00:00"] }));
assert.strictEqual(mudou.aprovada, false);
assert.strictEqual(mudou.motivo, "fonte_mudou");
assert.strictEqual(mudou.copiaAindaNaoAprovada, true);

memoria.clear();
memoria.set("99", { id: "99", placa: "ZZZ9Z99", payload: { id: "99", placa: "ZZZ9Z99" }, deleted_at: null });
const estranho = await copiar.executarCopia(base({}));
assert.strictEqual(estranho.motivo, "destino_extra");
assert.strictEqual(estranho.aprovada, false);
assert.strictEqual(estranho.destinoExtra, 1);

let postsAusente = 0;
const ausente = await copiar.executarCopia({
  ...base({}),
  rest: async () => {
    postsAusente += 1;
    return { ok: false, status: 404, data: { code: "PGRST205", message: "Could not find the table" } };
  },
});
assert.strictEqual(ausente.motivo, "tabela_ausente");
assert.strictEqual(ausente.tabela.criada, false);
assert.strictEqual(postsAusente, 1);

const fonte = fs.readFileSync(path.join(dir, "../lib/dk-veiculos-copiar.cjs"), "utf8");
const rota = fs.readFileSync(path.join(dir, "../api/dk-veiculos-copiar.js"), "utf8");
const migration = fs.readFileSync(path.join(dir, "../../supabase/migrations/20261027165619_create_dk_veiculos.sql"), "utf8");
assert.ok(!fonte.includes("redis.set"));
assert.ok(!fonte.includes("veiculos_cadastro:v1"));
assert.ok(!fonte.includes("/pg/query"));
assert.ok(!fonte.includes("/pg-meta/"));
assert.ok(!fonte.includes("garantirTabela"));
assert.ok(!fonte.includes("upsertSnapshotByLabel"));
assert.ok(!fonte.includes(ESPELHO_ASSIGN()));
assert.ok(rota.includes("somente_titular"));
assert.ok(rota.includes('req.method !== "POST"'));
assert.ok(!rota.includes("cadastro-veiculos.js"));
assert.ok(!rota.includes("STORAGE_KEY"));
assert.ok(migration.includes("enable row level security"));
assert.ok(migration.includes("dk_veiculos_placa_ativa_idx"));
assert.ok(migration.includes("grant select, insert, update on table public.dk_veiculos to service_role"));
assert.ok(migration.includes("revoke all on table public.dk_veiculos from service_role"));
assert.ok(!/create policy/i.test(migration));
assert.ok(!/references\s+public\.dk_clientes/i.test(migration));
assert.ok(!migration.includes("dk_clientes"));

function ESPELHO_ASSIGN() {
  return "payload.dk_portal_veiculos_cadastro =";
}

console.log("OK copiar veiculos");
