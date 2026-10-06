import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  revisaoConflita,
  resultadoGravacao,
  fonteDeAbertura,
  gravacaoSemCentralNaoConta,
  executarGravacaoCentral,
} from "../lib/dk-persistencia-central.cjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
let falhas = 0;

function ok(nome, cond) {
  if (!cond) {
    falhas += 1;
    console.error("FALHA", nome);
    return;
  }
  console.log("ok", nome);
}

const memoria = { payload: { marca: "base" }, updatedAt: "2026-10-06T12:00:00.000Z", gravou: 0, cache: 0 };

function deps(extra) {
  return {
    ler: async () => ({ payload: { ...memoria.payload }, updatedAt: memoria.updatedAt }),
    gravar: async (payload, updatedAt) => {
      memoria.gravou += 1;
      memoria.payload = payload;
      memoria.updatedAt = updatedAt;
      return { ok: true };
    },
    cache: async () => {
      memoria.cache += 1;
    },
    agora: () => "2026-10-06T13:00:00.000Z",
    baseRevision: memoria.updatedAt,
    ...extra,
  };
}

const a = await executarGravacaoCentral({
  ...deps({
    mutar(payload) {
      payload.marca = "novo";
    },
  }),
});
ok("A supabase ok", a.status === 200 && a.body.success === true && a.body.revision && a.body.updated_at && memoria.payload.marca === "novo");

const antes = memoria.gravou;
const b = await executarGravacaoCentral({
  ...deps({
    gravar: async () => ({ ok: false, reason: "supabase_http_500" }),
    mutar(payload) {
      payload.marca = "nao-pode";
    },
  }),
});
ok("B supabase falha", b.status === 502 && b.body.success === false && memoria.gravou === antes && memoria.payload.marca === "novo");

ok("C sem fallback local", gravacaoSemCentralNaoConta(false) === true && resultadoGravacao({ supabaseOk: false, redisOk: true }).success === false);

const d = await executarGravacaoCentral({
  ...deps({
    cache: async () => {
      throw new Error("redis fora");
    },
    mutar(payload) {
      payload.marca = "central";
    },
  }),
});
ok("D redis falha depois", d.status === 200 && d.body.success === true && d.body.persistencia === "supabase" && d.body.redis.ok === false && memoria.payload.marca === "central");

const e = await executarGravacaoCentral({
  ...deps({ baseRevision: "2026-10-06T11:00:00.000Z" }),
});
ok("E revisao antiga", e.status === 409 && e.body.reason === "revisao_conflito" && revisaoConflita("2026-10-06T11:00:00.000Z", memoria.updatedAt) === true);
ok("E revisao igual passa a barreira", revisaoConflita(memoria.updatedAt, memoria.updatedAt) === false);

ok("F abertura vem da nuvem", fonteDeAbertura(true) === "supabase" && fonteDeAbertura(false) === null);

const sync = fs.readFileSync(path.join(root, "portal-supabase-sync.js"), "utf8");
const index = fs.readFileSync(path.join(root, "index.html"), "utf8");
const api = fs.readFileSync(path.join(root, "api", "dk-cloud-snapshot.js"), "utf8");
ok("F cliente pede fonte supabase", sync.includes('row.source !== "supabase"') && api.includes('source: "supabase"'));
ok("C cliente nao trata redis sozinho como sucesso", !sync.includes("Supabase em falha; Redis OK."));
ok("G sem credencial administrativa no browser", !sync.includes("SUPABASE_SERVICE_ROLE_KEY") && !index.includes("SUPABASE_SERVICE_ROLE_KEY"));
ok("API exige supabase antes do cache", api.includes("upsertSnapshotByLabel") && api.indexOf("upsertSnapshotByLabel(LABEL, payload, storedAt)") < api.indexOf("redis.set(REDIS_KEY"));

assert.equal(falhas, 0);
console.log("test-dk-persistencia-central-ficticio ok");
