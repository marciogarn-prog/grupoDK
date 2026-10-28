import { createRequire } from "module";
import fs from "fs";
import path from "path";
import assert from "assert";
import vm from "vm";
import { fileURLToPath } from "url";

const require = createRequire(import.meta.url);
const dir = path.dirname(fileURLToPath(import.meta.url));
const pg = require(path.join(dir, "../lib/dk-locacao-pg.cjs"));
const audit = require(path.join(dir, "../lib/dk-locacoes-integrity-audit.cjs"));

const linhas = Array.from({ length: 610 }, (_, i) => ({
  id: "uuid-" + i,
  numero_contrato: String(2026000000 + i),
  version: 1,
  deleted_at: null,
  campos: {
    numeroContrato: String(2026000000 + i),
    cpf: "11111111111",
    nome: "Fixture",
    placa: "ABC1D23",
    inicio: "01/01/2026",
    statusLocacao: "FINALIZADO",
    portalLancamentosAluguel: [],
  },
}));
const redisProibido = {
  async get() { throw new Error("redis"); },
  async set() { throw new Error("redis"); },
  async incr() { throw new Error("redis"); },
  async del() { throw new Error("redis"); },
};
function restLista(caminho) {
  const texto = String(caminho);
  assert.ok(!texto.includes("dk_cloud_snapshot"));
  assert.ok(!texto.includes("dk_locacao_movimento"));
  assert.ok(!texto.includes("rpc/"));
  assert.ok(!texto.includes("count=exact"));
  return { ok: true, data: linhas };
}
const tempos = [];
for (let i = 0; i < 5; i++) {
  const t0 = Date.now();
  const lista = await pg.listar("", { flag: "dk_locacao", redis: redisProibido, rest: restLista });
  const ms = Date.now() - t0;
  tempos.push(ms);
  assert.strictEqual(lista.ok, true);
  assert.strictEqual(lista.ativado, true);
  assert.strictEqual(lista.locacoes.length, 610);
  assert.ok(ms < 15000, "listar " + ms);
}
const falha = await pg.listar("", {
  flag: "dk_locacao",
  redis: redisProibido,
  rest: async () => ({ ok: false, status: 504, data: { reason: "supabase_timeout" } }),
});
assert.strictEqual(falha.ok, false);
assert.strictEqual(falha.reason, "leitura");
assert.deepStrictEqual(falha.locacoes, []);

const chaveAntes = process.env.SUPABASE_SERVICE_ROLE_KEY;
process.env.SUPABASE_SERVICE_ROLE_KEY = chaveAntes || "teste-local-nao-enviar";
const fetchAntes = global.fetch;
global.fetch = (_url, opts = {}) => new Promise((_resolve, reject) => {
  const signal = opts.signal;
  const abortar = () => reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
  if (signal && signal.aborted) abortar();
  else if (signal) signal.addEventListener("abort", abortar, { once: true });
});
const tTimeout = Date.now();
const estourou = await pg.rest("dk_locacao?select=id", { timeoutMs: 80 });
global.fetch = fetchAntes;
if (chaveAntes == null) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
assert.strictEqual(estourou.status, 504);
assert.strictEqual(estourou.data.reason, "supabase_timeout");
assert.ok(Date.now() - tTimeout < 1000);

const criado = await pg.gravarUma({
  flag: "dk_locacao",
  redis: null,
  acesso: { ok: true, role: "owner" },
  criar: true,
  numero: "2026102799",
  locacao: {
    numeroContrato: "2026102799",
    cpf: "90000000175",
    nome: "CURSOR1",
    placa: "AAA1A11",
    inicio: "27/10/2026",
    statusLocacao: "ATIVO",
    portalLancamentosAluguel: [],
  },
  rest: async (caminho, opts = {}) => {
    const texto = String(caminho);
    assert.ok(!texto.includes("dk_cloud_snapshot"));
    if (texto.startsWith("dk_locacao?numero_contrato=eq.")) return { ok: true, data: [] };
    if (texto.startsWith("dk_locacao?deleted_at=is.null&select=numero_contrato,placa")) return { ok: true, data: [] };
    if (texto === "dk_locacao" && opts.method === "POST") {
      return { ok: true, data: [{ id: "uuid-novo", version: 1, numero_contrato: "2026102799", campos: opts.body.campos }] };
    }
    return { ok: false, status: 500, data: { reason: "nao_mockado" } };
  },
});
assert.strictEqual(criado.ok, true);
assert.strictEqual(criado.linhas_afetadas, 1);
assert.strictEqual(criado.locacao.pgId, "uuid-novo");

const tela = fs.readFileSync(path.join(dir, "../portal-locacao-pg.js"), "utf8");
assert.ok(tela.includes("return window.__DK_locacoesPgCache.slice()"));
const posts = [];
const sandbox = {
  console,
  setInterval() { return 0; },
  setTimeout() { return 0; },
  localStorage: { removeItem() {}, setItem() {}, getItem() { return null; } },
  loadCadastro(key) { return key === "dk_locacoes_cadastro" ? [{ numeroContrato: "1926091401", pgId: "antiga", pgVersion: 1 }] : []; },
  saveCadastro() { throw new Error("snapshot"); },
};
sandbox.window = sandbox;
sandbox.fetch = async (url, opts = {}) => {
  if ((opts.method || "GET") !== "POST") {
    return { status: 200, async json() { return { ok: true, ativado: true, migracao: "pronta", locacoes: [{ numeroContrato: "1926091401", pgId: "antiga", pgVersion: 1, cpf: "11111111111", nome: "Fixture", placa: "ABC1D23", inicio: "01/01/2026" }] }; } };
  }
  posts.push(JSON.parse(opts.body));
  const loc = JSON.parse(opts.body).locacao;
  return { status: 200, async json() { return { ok: true, locacao: { ...loc, pgId: "uuid-tela", pgVersion: 1 } }; } };
};
sandbox.window.__DK_portalApiHeaders = () => ({ Authorization: "Bearer teste" });
vm.createContext(sandbox);
vm.runInContext(tela, sandbox);
await sandbox.window.__DK_locacaoPgRecarregar();
const listaTela = sandbox.loadCadastro("dk_locacoes_cadastro");
listaTela.push({ numeroContrato: "2026102799", cpf: "90000000175", nome: "CURSOR1", placa: "AAA1A11", inicio: "27/10/2026", statusLocacao: "ATIVO", portalLancamentosAluguel: [] });
sandbox.saveCadastro("dk_locacoes_cadastro", listaTela);
await new Promise((resolve) => setTimeout(resolve, 30));
assert.strictEqual(posts.length, 1);
assert.strictEqual(posts[0].op, "criar");
assert.strictEqual(posts[0].numero, "2026102799");

const redisSnapshot = {
  chamadas: [],
  async get(chave) {
    this.chamadas.push(chave);
    return JSON.stringify({ label: "default", payload: { dk_locacoes_cadastro: [] }, updated_at: "t" });
  },
  async set(chave) {
    this.chamadas.push("set:" + chave);
    if (String(chave).includes("cloud_snapshot")) throw new Error("regravou");
    return "OK";
  },
};
const auditoriaSnapshot = await audit.runLocacoesIntegrityAudit({
  flag: "snapshot",
  redis: redisSnapshot,
  espelho: { ok: true, payload: { dk_locacoes_cadastro: [] } },
  gravar: async () => { throw new Error("regravou"); },
});
assert.strictEqual(auditoriaSnapshot.ok, true);
assert.notStrictEqual(auditoriaSnapshot.reason, "skipped_pg_active");
const auditoriaPg = await audit.runLocacoesIntegrityAudit({
  flag: "dk_locacao",
  redis: { async get() { throw new Error("redis"); }, async set() { throw new Error("redis"); } },
  espelho: { ok: false, reason: "nao_deve_ler" },
  gravar: async () => { throw new Error("regravou"); },
});
assert.strictEqual(auditoriaPg.skipped, true);
assert.strictEqual(auditoriaPg.reason, "skipped_pg_active");
console.log(JSON.stringify({ tempos, timeoutMs: Date.now() - tTimeout, post: criado.linhas_afetadas }));
console.log("OK lista locacao");
