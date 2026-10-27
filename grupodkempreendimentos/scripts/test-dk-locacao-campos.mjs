import { createRequire } from "module";
import fs from "fs";
import path from "path";
import assert from "assert";
import { fileURLToPath } from "url";

const require = createRequire(import.meta.url);
const dir = path.dirname(fileURLToPath(import.meta.url));
const pg = require(path.join(dir, "../lib/dk-locacao-pg.cjs"));

const pagamento = { protocoloLancamento: "p1", valor: 100, data: "01/10/2026" };
const locA = {
  id: "1789421864502",
  numeroContrato: "1926091401",
  cpf: "11111111111",
  nome: "Fixture",
  inicio: "01/09/2026",
  placa: "ABC1D23",
  statusLocacao: "ATIVO",
  portalLancamentosAluguel: [pagamento],
};
const locB = {
  ...locA,
  numeroContrato: "2026091402",
  placa: "DEF2E34",
  portalLancamentosAluguel: [pagamento, { protocoloLancamento: "p2", valor: 50 }],
};
const semRedis = null;

function banco() {
  const linhas = new Map();
  const chamadas = [];
  async function rest(caminho, opts = {}) {
    chamadas.push({ caminho: String(caminho), method: opts.method || "GET", body: opts.body || null });
    if (String(caminho).includes("dk_locacao_movimento") || String(caminho).includes("dk_cloud_snapshot") || String(caminho).includes("rpc/")) {
      throw new Error("caminho proibido " + caminho);
    }
    if (String(caminho).startsWith("dk_locacao?deleted_at=is.null&select=id,numero_contrato")) {
      return { ok: true, data: [...linhas.values()].filter((r) => !r.deleted_at) };
    }
    if (String(caminho).startsWith("dk_locacao?deleted_at=is.null&select=numero_contrato,placa")) {
      return { ok: true, data: [...linhas.values()].filter((r) => !r.deleted_at) };
    }
    if (String(caminho).startsWith("dk_locacao?numero_contrato=eq.")) {
      const nc = decodeURIComponent(String(caminho).split("numero_contrato=eq.")[1].split("&")[0]);
      const row = linhas.get(nc) || null;
      return { ok: true, data: row ? [row] : [] };
    }
    if (String(caminho) === "dk_locacao" && opts.method === "POST") {
      const corpo = opts.body;
      if (linhas.has(corpo.numero_contrato)) return { ok: false, status: 409, data: { code: "23505", message: "duplicate key" } };
      const row = { id: "uuid-" + corpo.numero_contrato, version: 1, deleted_at: null, ...corpo };
      linhas.set(corpo.numero_contrato, row);
      return { ok: true, data: [row] };
    }
    if (String(caminho).startsWith("dk_locacao?id=eq.") && opts.method === "PATCH") {
      const id = decodeURIComponent(String(caminho).split("id=eq.")[1].split("&")[0]);
      const version = Number(String(caminho).split("version=eq.")[1].split("&")[0]);
      const row = [...linhas.values()].find((item) => item.id === id && Number(item.version) === version && !item.deleted_at);
      if (!row) return { ok: true, data: [] };
      const next = { ...row, ...opts.body, id: row.id };
      linhas.set(row.numero_contrato, next);
      return { ok: true, data: [next] };
    }
    if (String(caminho).includes("select=updated_at")) {
      const abertas = [...linhas.values()].filter((r) => !r.deleted_at);
      return { ok: true, data: abertas.length ? [{ updated_at: "2026-10-27T00:00:00.000Z" }] : [] };
    }
    if (String(caminho).includes("select=id&limit=1")) {
      return { ok: true, data: [], contentRange: "0-0/" + [...linhas.values()].filter((r) => !r.deleted_at).length };
    }
    if (opts.falha) return { ok: false, status: 500, data: { reason: "pg" } };
    return { ok: false, status: 500, data: { reason: "nao_mockado" } };
  }
  return { rest, linhas, chamadas };
}

const memoria = banco();
const lida = await pg.listar("", { flag: "dk_locacao", rest: memoria.rest });
assert.strictEqual(lida.ativado, true);
assert.strictEqual(lida.migracao, "pronta");
assert.deepStrictEqual(lida.locacoes, []);
assert.ok(memoria.chamadas.every((c) => !c.caminho.includes("movimento")));

const criada = await pg.gravarUma({ flag: "dk_locacao", rest: memoria.rest, redis: semRedis, numero: locA.numeroContrato, locacao: locA, by: "teste" });
assert.strictEqual(criada.ok, true);
assert.strictEqual(criada.linhas_afetadas, 1);
assert.strictEqual(criada.version, 1);
assert.strictEqual(criada.id, "uuid-1926091401");
assert.strictEqual(criada.locacao.portalLancamentosAluguel.length, 1);
assert.ok(!memoria.chamadas.some((c) => c.method === "POST" && c.body && Object.prototype.hasOwnProperty.call(c.body, "id")));

const outra = await pg.gravarUma({ flag: "dk_locacao", rest: memoria.rest, redis: semRedis, numero: locB.numeroContrato, locacao: locB, by: "teste" });
assert.strictEqual(outra.ok, true);
assert.strictEqual(memoria.linhas.size, 2);
assert.strictEqual(memoria.linhas.get(locA.numeroContrato).id_legado, "1789421864502");
assert.strictEqual(memoria.linhas.get(locB.numeroContrato).id_legado, "1789421864502");
assert.notStrictEqual(memoria.linhas.get(locA.numeroContrato).id, memoria.linhas.get(locB.numeroContrato).id);

const lista = await pg.listar("", { flag: "dk_locacao", rest: memoria.rest });
assert.strictEqual(lista.locacoes.length, 2);
assert.strictEqual(lista.locacoes.find((l) => l.numeroContrato === "1926091401").portalLancamentosAluguel[0].valor, 100);
assert.strictEqual(lista.locacoes.find((l) => l.numeroContrato === "2026091402").portalLancamentosAluguel.length, 2);

const velha = await pg.gravarUma({ flag: "dk_locacao", rest: memoria.rest, redis: semRedis, numero: locA.numeroContrato, version: 0, locacao: locA });
assert.strictEqual(velha.status, 409);
assert.strictEqual(velha.reason, "version");
assert.strictEqual(memoria.linhas.get(locA.numeroContrato).version, 1);

const editada = { ...locA, placa: "ABC1D23", portalLancamentosAluguel: [pagamento, { protocoloLancamento: "p3", valor: 10 }] };
const atualizada = await pg.gravarUma({
  flag: "dk_locacao",
  rest: memoria.rest,
  redis: semRedis,
  numero: locA.numeroContrato,
  version: 1,
  locacao: editada,
});
assert.strictEqual(atualizada.ok, true);
assert.strictEqual(atualizada.linhas_afetadas, 1);
assert.strictEqual(atualizada.id, "uuid-1926091401");
assert.strictEqual(atualizada.version, 2);
assert.strictEqual(atualizada.locacao.portalLancamentosAluguel.length, 2);
assert.strictEqual(memoria.linhas.size, 2);

const apagada = await pg.excluirUma({ flag: "dk_locacao", rest: memoria.rest, redis: semRedis, numero: locB.numeroContrato, version: 1, by: "teste" });
assert.strictEqual(apagada.ok, true);
assert.ok(apagada.deleted_at);
assert.ok(memoria.chamadas.every((c) => c.method !== "DELETE"));
assert.strictEqual(memoria.linhas.get(locB.numeroContrato).deleted_at != null, true);
const depois = await pg.listar("", { flag: "dk_locacao", rest: memoria.rest });
assert.strictEqual(depois.locacoes.length, 1);

const rede = banco();
rede.rest = async () => ({ ok: false, status: 503, data: { reason: "pg" } });
const falha = await pg.listar("", { flag: "dk_locacao", rest: rede.rest });
assert.strictEqual(falha.ok, false);
assert.strictEqual(falha.reason, "leitura");
assert.deepStrictEqual(falha.locacoes, []);
const falhaGravar = await pg.gravarUma({ flag: "dk_locacao", rest: rede.rest, redis: semRedis, numero: "100", locacao: { numeroContrato: "100" } });
assert.strictEqual(falhaGravar.ok, false);
assert.notStrictEqual(falhaGravar.reason, "snapshot");

const relogio = await pg.relogio({ flag: "dk_locacao", rest: memoria.rest });
assert.strictEqual(relogio.ativado, true);
assert.ok(String(relogio.selo).includes("|"));
assert.ok(memoria.chamadas.every((c) => !c.caminho.includes("movimento")));

const fonte = fs.readFileSync(path.join(dir, "../lib/dk-locacao-pg.cjs"), "utf8");
const trecho = fonte.slice(fonte.indexOf("async function listar"), fonte.indexOf("async function relogio"));
assert.ok(!trecho.includes("dk_locacao_movimento"));
assert.ok(!trecho.includes("migrarSnapshotOficial"));
assert.ok(!trecho.includes("upsertSnapshotByLabel"));
assert.ok(!fonte.includes("upsertSnapshotByLabel"));
assert.ok(!fonte.includes("redis.set"));
const tela = fs.readFileSync(path.join(dir, "../portal-locacao-pg.js"), "utf8");
assert.ok(tela.includes("data.ativado === true"));

function trava() {
  let token = "";
  return {
    async set(_key, value, opts) {
      if (opts && opts.nx) {
        if (token) return null;
        token = value;
        return "OK";
      }
      return "OK";
    },
    async get() {
      return token;
    },
    async del() {
      token = "";
    },
  };
}

const placa = banco();
const ativa = {
  numeroContrato: "2099010101",
  cpf: "11111111111",
  nome: "Fixture",
  inicio: "01/09/2026",
  placa: "TST9Z99",
  statusLocacao: "ATIVO",
  portalLancamentosAluguel: [pagamento],
};
const irma = { ...ativa, numeroContrato: "2099010102" };
const primeira = await pg.gravarUma({ flag: "dk_locacao", rest: placa.rest, redis: semRedis, numero: ativa.numeroContrato, locacao: ativa });
assert.strictEqual(primeira.ok, true);
const ocupada = await pg.gravarUma({ flag: "dk_locacao", rest: placa.rest, redis: semRedis, numero: irma.numeroContrato, locacao: irma });
assert.strictEqual(ocupada.status, 409);
assert.strictEqual(ocupada.reason, "active_plate_conflict");
assert.strictEqual(placa.linhas.size, 1);
const propria = await pg.gravarUma({
  flag: "dk_locacao",
  rest: placa.rest,
  redis: semRedis,
  numero: ativa.numeroContrato,
  version: 1,
  locacao: { ...ativa, nome: "Fixture atualizada" },
});
assert.strictEqual(propria.ok, true);
assert.strictEqual(propria.version, 2);
const finalizada = await pg.gravarUma({
  flag: "dk_locacao",
  rest: placa.rest,
  redis: semRedis,
  numero: ativa.numeroContrato,
  version: 2,
  locacao: { ...ativa, statusLocacao: "FINALIZADO", fim: "02/09/2026" },
});
assert.strictEqual(finalizada.ok, true);
const liberada = await pg.gravarUma({ flag: "dk_locacao", rest: placa.rest, redis: semRedis, numero: irma.numeroContrato, locacao: irma });
assert.strictEqual(liberada.ok, true);
assert.strictEqual(liberada.locacao.portalLancamentosAluguel.length, 1);

const semData = { ...ativa, numeroContrato: "2099010103", placa: "TST9Z98", inicio: "" };
const negada = await pg.gravarUma({ flag: "dk_locacao", rest: placa.rest, redis: semRedis, numero: semData.numeroContrato, locacao: semData });
assert.strictEqual(negada.status, 409);
assert.strictEqual(negada.reason, "locacao_nao_confirmada");
const confirmada = await pg.gravarUma({
  flag: "dk_locacao",
  rest: placa.rest,
  redis: semRedis,
  numero: semData.numeroContrato,
  locacao: { ...semData, inicio: "03/09/2026" },
});
assert.strictEqual(confirmada.ok, true);
const versaoVelha = await pg.gravarUma({
  flag: "dk_locacao",
  rest: placa.rest,
  redis: semRedis,
  numero: semData.numeroContrato,
  version: 0,
  locacao: { ...semData, inicio: "03/09/2026", nome: "Ainda valida" },
});
assert.strictEqual(versaoVelha.status, 409);
assert.strictEqual(versaoVelha.reason, "version");
const versaoCerta = await pg.gravarUma({
  flag: "dk_locacao",
  rest: placa.rest,
  redis: semRedis,
  numero: semData.numeroContrato,
  version: 1,
  locacao: { ...semData, inicio: "03/09/2026", nome: "Ainda valida" },
});
assert.strictEqual(versaoCerta.ok, true);
assert.strictEqual(versaoCerta.version, 2);

const lento = banco();
let segurar;
const espera = new Promise((resolver) => {
  segurar = resolver;
});
let entrou = 0;
const restOriginal = lento.rest;
lento.rest = async (caminho, opts) => {
  if (String(caminho).startsWith("dk_locacao?numero_contrato=eq.")) {
    entrou += 1;
    if (entrou === 1) await espera;
  }
  return restOriginal(caminho, opts);
};
const cadeado = trava();
const corridaA = pg.gravarUma({
  flag: "dk_locacao",
  rest: lento.rest,
  redis: cadeado,
  numero: "2099010104",
  locacao: { ...ativa, numeroContrato: "2099010104", placa: "TST9Z97" },
});
while (entrou < 1) await new Promise((resolver) => setTimeout(resolver, 10));
const corridaB = await pg.gravarUma({
  flag: "dk_locacao",
  rest: lento.rest,
  redis: cadeado,
  numero: "2099010105",
  locacao: { ...ativa, numeroContrato: "2099010105", placa: "TST9Z96" },
});
assert.strictEqual(corridaB.status, 409);
assert.strictEqual(corridaB.reason, "locacoes_write_busy");
segurar();
const corridaOk = await corridaA;
assert.strictEqual(corridaOk.ok, true);
assert.strictEqual(lento.linhas.size, 1);

const audit = require(path.join(dir, "../lib/dk-locacoes-integrity-audit.cjs"));
const locAudit = {
  numeroContrato: "2099010199",
  placa: "TST9Z90",
  nome: "Fixture",
  cpf: "11111111111",
  inicio: "01/09/2026",
  fim: "02/09/2026",
  statusLocacao: "FINALIZADO",
};
function redisAuditoria(payload) {
  const caixa = new Map();
  return {
    chamadas: [],
    async get(chave) {
      this.chamadas.push("get");
      if (chave === "dk:portal:cloud_snapshot:v1") return JSON.stringify({ label: "default", payload, updated_at: "t" });
      return caixa.get(chave) || null;
    },
    async set(chave, valor, opts) {
      this.chamadas.push("set");
      if (opts && opts.nx && caixa.has(chave)) return null;
      caixa.set(chave, valor);
      return "OK";
    },
    async del(chave) {
      caixa.delete(chave);
    },
  };
}
let gravouSnapshot = 0;
const igual = redisAuditoria({ dk_locacoes_cadastro: [locAudit] });
const auditoriaIgual = await audit.runLocacoesIntegrityAudit({
  flag: "",
  redis: igual,
  espelho: { ok: true, payload: { dk_locacoes_cadastro: [locAudit] } },
  gravar: async () => {
    gravouSnapshot += 1;
    return { ok: true };
  },
});
assert.strictEqual(auditoriaIgual.ok, true);
assert.strictEqual(auditoriaIgual.skipped, undefined);
assert.strictEqual(gravouSnapshot, 0);
const divergente = redisAuditoria({ dk_locacoes_cadastro: [locAudit] });
const auditoriaDivergente = await audit.runLocacoesIntegrityAudit({
  flag: "",
  redis: divergente,
  espelho: { ok: true, payload: { dk_locacoes_cadastro: [{ ...locAudit, numeroContrato: "2099010198" }] } },
  gravar: async () => {
    gravouSnapshot += 1;
    return { ok: true };
  },
});
assert.strictEqual(auditoriaDivergente.aligned, true);
assert.strictEqual(gravouSnapshot, 1);
const redisPg = {
  async get() {
    throw new Error("redis");
  },
  async set() {
    throw new Error("redis");
  },
};
const auditoriaPg = await audit.runLocacoesIntegrityAudit({
  flag: "dk_locacao",
  redis: redisPg,
  gravar: async () => {
    throw new Error("snapshot");
  },
});
assert.strictEqual(auditoriaPg.skipped, true);
assert.strictEqual(auditoriaPg.reason, "skipped_pg_active");
assert.strictEqual(await pg.obterFonteLocacoes({ flag: "" }), "snapshot");
assert.strictEqual(await pg.obterFonteLocacoes({ flag: "dk_locacao" }), "dk_locacao");
const fonteAudit = fs.readFileSync(path.join(dir, "../lib/dk-locacoes-integrity-audit.cjs"), "utf8");
assert.ok(!fonteAudit.includes("moduloAtivo"));

console.log("OK caminho locacao");
