import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const api = require("../api/dk-cloud-snapshot.js");
const aqui = path.dirname(fileURLToPath(import.meta.url));
const fonte = fs.readFileSync(path.join(aqui, "../api/dk-cloud-snapshot.js"), "utf8");
const getSrc = fonte.slice(fonte.indexOf('if (req.method === "GET")'), fonte.indexOf('if (req.method === "POST")'));
const postSrc = fonte.slice(fonte.indexOf('if (req.method === "POST")'));

let falhas = 0;
function ok(nome, cond) {
  if (!cond) {
    falhas += 1;
    console.error("FALHA", nome);
    return;
  }
  console.log("ok", nome);
}

const rev1 = "2026-10-24T01:22:26.852+00:00";
const rev2 = "2026-10-24T01:22:26.852Z";
const revNova = "2026-10-24T02:00:00.000Z";
const payload = {
  dk_lancamentos_aluguel: [
    { data: "23/10/2026", valor: 10 },
    { data: "22/10/2026", valor: 9 },
  ],
  dk_clientes_cadastro: [{ cpf: "123", nome: "Ana" }],
};

ok("GET pede a revisão antes do payload", getSrc.indexOf("fetchSnapshotRevisionByLabel") !== -1 && getSrc.indexOf("fetchSnapshotRevisionByLabel") < getSrc.indexOf("fetchSnapshotByLabel"));
ok("GET lê o payload do Supabase uma vez", getSrc.split("fetchSnapshotByLabel").length === 2);
ok("POST lê o payload só quando a base pede", fonte.includes("fetchSnapshotByLabel(label)") && postSrc.includes("lerBaseOficialParaPost"));
ok("pacote=dia usa o corpo já resolvido", getSrc.includes("corpoDaConsulta") && !getSrc.includes("extrairPacoteDia"));

const vazio = api.decidirLeituraSnapshot(null, { ok: true, updatedAt: rev1 });
ok("cache vazio busca o payload", vazio.acao === "buscar" && vazio.leiturasPayload === 1);

const cheio = api.decidirLeituraSnapshot({ payload, updated_at: rev1 }, { ok: true, updatedAt: rev1 });
ok("cache igual não lê o payload", cheio.acao === "cache" && cheio.leiturasPayload === 0);
const segundo = api.decidirLeituraSnapshot({ payload, updated_at: rev1 }, { ok: true, updatedAt: rev2 });
ok("segundo GET com a mesma revisão também não lê", segundo.acao === "cache" && segundo.leiturasPayload === 0);

const mudou = api.decidirLeituraSnapshot({ payload, updated_at: rev1 }, { ok: true, updatedAt: revNova });
ok("revisão nova busca o payload de novo", mudou.acao === "buscar" && mudou.leiturasPayload === 1);

const queda = api.decidirLeituraSnapshot({ payload, updated_at: rev1 }, { ok: false, reason: "supabase_timeout", updatedAt: null });
ok("supabase fora usa o cache sem payload", queda.acao === "fallback" && queda.leiturasPayload === 0 && queda.supabasePendente === true);

const corpo = api.corpoDaConsulta({ query: { pacote: "dia", dia: "2026-10-23" } }, payload);
ok(
  "pacote=dia recorta sem nova leitura",
  corpo.pacote === "dia" &&
    corpo.dia === "2026-10-23" &&
    Array.isArray(corpo.payload.dk_lancamentos_aluguel) &&
    corpo.payload.dk_lancamentos_aluguel.length === 1 &&
    corpo.payload.dk_lancamentos_aluguel[0].valor === 10 &&
    segundo.leiturasPayload === 0
);

let leiturasParalelas = 0;
const redisDono = {
  async set(key, value) {
    if (String(key).endsWith(":rev")) redisDono.rev = value;
    else if (!String(key).endsWith(":leitura")) redisDono.row = value;
    return "OK";
  },
  async get() {
    return null;
  },
  async del() {
    return 1;
  },
};
const busca = async () => {
  leiturasParalelas += 1;
  await new Promise((r) => setTimeout(r, 40));
  return { ok: true, payload: { marca: leiturasParalelas }, updatedAt: revNova, reason: "ok" };
};
const [a, b] = await Promise.all([
  api.lerPayloadOficialUnico("default", redisDono, "dk:portal:cloud_snapshot:v1", revNova, busca),
  api.lerPayloadOficialUnico("default", redisDono, "dk:portal:cloud_snapshot:v1", revNova, busca),
]);
ok("duas leituras juntas baixam o payload uma vez", leiturasParalelas === 1 && a.payload.marca === 1 && b.payload.marca === 1);
ok("a leitura nova grava o cache", typeof redisDono.row === "string" && redisDono.row.includes(revNova) && redisDono.rev === revNova);

let leiturasEspera = 0;
const redisEspera = {
  async set() {
    return null;
  },
  async get(key) {
    if (String(key).endsWith(":leitura")) return "1";
    return { payload: { pronto: true }, updated_at: revNova };
  },
  async del() {
    return 1;
  },
};
const esperado = await api.lerPayloadOficialUnico(
  "default",
  redisEspera,
  "dk:portal:cloud_snapshot:v1",
  revNova,
  async () => {
    leiturasEspera += 1;
    return { ok: true, payload: { nao: true }, updatedAt: revNova, reason: "ok" };
  },
  { tentativas: 2, esperaMs: 5 }
);
ok("quem espera o outro não baixa o payload", leiturasEspera === 0 && esperado.viaCache === true && esperado.payload.pronto === true);

assert.equal(falhas, 0);
console.log("test-dk-cloud-snapshot-get-cache ok");
