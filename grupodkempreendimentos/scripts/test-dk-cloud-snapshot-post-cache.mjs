import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const api = require("../api/dk-cloud-snapshot.js");
const aqui = path.dirname(fileURLToPath(import.meta.url));
const fonte = fs.readFileSync(path.join(aqui, "../api/dk-cloud-snapshot.js"), "utf8");
const postSrc = fonte.slice(fonte.indexOf('if (req.method === "POST")'));
const getSrc = fonte.slice(fonte.indexOf('if (req.method === "GET")'), fonte.indexOf('if (req.method === "POST")'));

let falhas = 0;
function ok(nome, cond) {
  if (!cond) {
    falhas += 1;
    console.error("FALHA", nome);
    return;
  }
  console.log("ok", nome);
}

const rev = "2026-10-24T01:22:26.852Z";
const payload = { b: 1, a: [{ nome: "Ana" }] };

ok("GET continua pedindo a revisão antes do payload", getSrc.indexOf("fetchSnapshotRevisionByLabel") < getSrc.indexOf("fetchSnapshotByLabel"));
ok("POST não baixa o payload direto", !postSrc.includes("fetchSnapshotByLabel"));
ok("POST passa pela base com revisão", postSrc.includes("lerBaseOficialParaPost"));
ok("sem mudança fica antes do upsert", postSrc.indexOf("inalterado") < postSrc.indexOf("upsertSnapshotByLabel"));

let leituras = 0;
const redisVazio = {
  async get() {
    return null;
  },
  async set() {
    return "OK";
  },
};
const vazio = await api.lerBaseOficialParaPost(redisVazio, "dk:portal:cloud_snapshot:v1", "default", {
  revisar: async () => ({ ok: true, updatedAt: rev }),
  buscarPayload: async () => {
    leituras += 1;
    return { ok: true, reason: "ok", payload, updatedAt: rev };
  },
});
ok("cache vazio lê o payload uma vez", vazio.cache === "invalido" && vazio.leiturasPayload === 1 && leituras === 1 && vazio.payload.b === 1);

const redisCheio = {
  async get(key) {
    if (String(key).endsWith(":rev")) return rev;
    return { label: "default", payload, updated_at: rev };
  },
};
const cheio = await api.lerBaseOficialParaPost(redisCheio, "dk:portal:cloud_snapshot:v1", "default", {
  revisar: async () => ({ ok: true, updatedAt: rev }),
  buscarPayload: async () => {
    leituras += 1;
    return { ok: true, reason: "ok", payload: { outro: true }, updatedAt: rev };
  },
});
ok("cache válido não lê o payload", cheio.cache === "valido" && cheio.leiturasPayload === 0 && leituras === 1 && cheio.payload.b === 1);

ok("objetos iguais com chaves trocadas", api.payloadSnapshotIgual({ b: 1, a: [1] }, { a: [1], b: 1 }));
ok("mudança real é diferente", api.payloadSnapshotIgual(payload, { ...payload, b: 2 }) === false);

let upserts = 0;
let estado = { a: 1 };
async function aplicar(patch) {
  return api.enfileirarGravacaoSnapshot("default", async () => {
    const proximo = { ...estado, ...patch };
    if (api.payloadSnapshotIgual(estado, proximo)) return { upsert: false, estado };
    await new Promise((r) => setTimeout(r, 20));
    upserts += 1;
    estado = proximo;
    return { upsert: true, estado };
  });
}

const semMudanca = await Promise.all([aplicar({ a: 1 }), aplicar({ a: 1 })]);
ok("dois POSTs iguais não gravam", upserts === 0 && semMudanca.every((r) => r.upsert === false));

const mudou = await Promise.all([aplicar({ b: 2 }), aplicar({ c: 3 })]);
ok("dois POSTs diferentes gravam em série", upserts === 2 && mudou[0].upsert === true && mudou[1].upsert === true && estado.b === 2 && estado.c === 3);

assert.equal(falhas, 0);
console.log("test-dk-cloud-snapshot-post-cache ok");
