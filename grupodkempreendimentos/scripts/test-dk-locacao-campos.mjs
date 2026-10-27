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
  cpf: "111",
  placa: "ABC1D23",
  statusLocacao: "ATIVO",
  portalLancamentosAluguel: [pagamento],
};
const locB = { ...locA, numeroContrato: "2026091402", portalLancamentosAluguel: [pagamento, { protocoloLancamento: "p2", valor: 50 }] };

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

const criada = await pg.gravarUma({ flag: "dk_locacao", rest: memoria.rest, numero: locA.numeroContrato, locacao: locA, by: "teste" });
assert.strictEqual(criada.ok, true);
assert.strictEqual(criada.linhas_afetadas, 1);
assert.strictEqual(criada.version, 1);
assert.strictEqual(criada.id, "uuid-1926091401");
assert.strictEqual(criada.locacao.portalLancamentosAluguel.length, 1);
assert.ok(!memoria.chamadas.some((c) => c.method === "POST" && c.body && Object.prototype.hasOwnProperty.call(c.body, "id")));

const outra = await pg.gravarUma({ flag: "dk_locacao", rest: memoria.rest, numero: locB.numeroContrato, locacao: locB, by: "teste" });
assert.strictEqual(outra.ok, true);
assert.strictEqual(memoria.linhas.size, 2);
assert.strictEqual(memoria.linhas.get(locA.numeroContrato).id_legado, "1789421864502");
assert.strictEqual(memoria.linhas.get(locB.numeroContrato).id_legado, "1789421864502");
assert.notStrictEqual(memoria.linhas.get(locA.numeroContrato).id, memoria.linhas.get(locB.numeroContrato).id);

const lista = await pg.listar("", { flag: "dk_locacao", rest: memoria.rest });
assert.strictEqual(lista.locacoes.length, 2);
assert.strictEqual(lista.locacoes.find((l) => l.numeroContrato === "1926091401").portalLancamentosAluguel[0].valor, 100);
assert.strictEqual(lista.locacoes.find((l) => l.numeroContrato === "2026091402").portalLancamentosAluguel.length, 2);

const velha = await pg.gravarUma({ flag: "dk_locacao", rest: memoria.rest, numero: locA.numeroContrato, version: 0, locacao: locA });
assert.strictEqual(velha.status, 409);
assert.strictEqual(velha.reason, "version");
assert.strictEqual(memoria.linhas.get(locA.numeroContrato).version, 1);

const editada = { ...locA, placa: "ABC1D23", portalLancamentosAluguel: [pagamento, { protocoloLancamento: "p3", valor: 10 }] };
const atualizada = await pg.gravarUma({
  flag: "dk_locacao",
  rest: memoria.rest,
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

const apagada = await pg.excluirUma({ flag: "dk_locacao", rest: memoria.rest, numero: locB.numeroContrato, version: 1, by: "teste" });
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
const falhaGravar = await pg.gravarUma({ flag: "dk_locacao", rest: rede.rest, numero: "100", locacao: { numeroContrato: "100" } });
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

console.log("OK caminho locacao");
