import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const dir = path.dirname(fileURLToPath(import.meta.url));
const pg = require(path.join(dir, "../lib/dk-locacao-pg.cjs"));
const auth = require(path.join(dir, "../lib/dk-portal-auth.cjs"));
const rotaPath = path.join(dir, "../api/cadastro-locacoes.js");
const snapPath = path.join(dir, "../api/dk-cloud-snapshot.js");
const tela = fs.readFileSync(path.join(dir, "../portal-locacao-pg.js"), "utf8");
const rotaSrc = fs.readFileSync(rotaPath, "utf8");
const snapSrc = fs.readFileSync(snapPath, "utf8");

auth.enforceRateLimit = async () => false;
auth.requireLiveSession = async () => ({ ok: true, typ: "equipa", role: "owner", cpf: "03037897430" });
delete require.cache[rotaPath];
const rota = require(rotaPath);
const snap = require(snapPath);

function resposta() {
  return {
    statusCode: 0,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
    end() {
      return this;
    },
    setHeader() {},
  };
}

const get = resposta();
await rota({ method: "GET", headers: {}, query: {} }, get);
assert.equal(get.statusCode, 410);
assert.equal(get.body.reason, "legacy_route_disabled");
assert.equal(get.body.canonical, undefined);
assert.equal(rotaSrc.includes("CANONICAL_SNAPSHOT_KEY"), false);
assert.equal(rotaSrc.includes("dk_locacoes_cadastro"), false);

const post = resposta();
await rota({ method: "POST", headers: {}, body: { data: [{ numeroContrato: "2026102701" }] }, query: {} }, post);
assert.equal(post.statusCode, 410);
assert.equal(post.body.reason, "legacy_route_disabled");

const antes = [
  { numeroContrato: "1926091401", placa: "ABC1D23" },
  { numeroContrato: "2026102701", marcaModelo: "original" },
];
const pedido = {
  dk_clientes_cadastro: [{ nome: "outro" }],
  dk_locacoes_cadastro: [{ numeroContrato: "2026102799", placa: "AAA1A11" }],
};
const retido = snap.reterLocacoesForaDoSnapshot("dk_locacao", { dk_locacoes_cadastro: antes }, { ...pedido });
assert.equal(retido.dk_clientes_cadastro.length, 1);
assert.equal(retido.dk_locacoes_cadastro, antes);
assert.equal(retido.dk_locacoes_cadastro.some((l) => l.numeroContrato === "2026102799"), false);
const livre = snap.reterLocacoesForaDoSnapshot("snapshot", { dk_locacoes_cadastro: antes }, { ...pedido });
assert.equal(livre.dk_locacoes_cadastro[0].numeroContrato, "2026102799");

const ramo = snapSrc.slice(snapSrc.indexOf("if (body.locacao"), snapSrc.indexOf("const locacao = body.locacao"));
assert.equal(ramo.includes('reason: "locacao_pg"'), true);
assert.equal(ramo.includes("redis.set"), false);
assert.equal(ramo.includes("upsertSnapshotByLabel"), false);

const falha = await pg.listar("", {
  flag: "dk_locacao",
  rest: async () => ({ ok: false, status: 503, data: { reason: "supabase_indisponivel" } }),
});
assert.equal(falha.ok, false);
assert.equal(falha.reason, "leitura");
assert.equal(falha.ativado, true);
assert.deepEqual(falha.locacoes, []);

assert.equal(tela.includes("window.__DK_LOCACAO_PG_ERRO"), true);
assert.equal(tela.includes('localStorage.getItem("dk_locacoes_cadastro")'), false);
assert.equal(tela.includes("if (window.__DK_LOCACAO_PG_ERRO) return;"), true);

const auditSrc = fs.readFileSync(path.join(dir, "../lib/dk-locacoes-integrity-audit.cjs"), "utf8");
const cedo = auditSrc.indexOf('reason: "skipped_pg_active"');
const chamada = auditSrc.indexOf("const gravar = (opts && opts.gravar) || gravarLocacoesAlinhadas");
assert.equal(cedo > 0 && chamada > cedo, true);

console.log("OK locacao sem snapshot");
