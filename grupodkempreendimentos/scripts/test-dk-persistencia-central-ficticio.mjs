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
  motivoSupabaseIndisponivel,
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
    cache: async (payload, updatedAt) => {
      memoria.cache += 1;
      memoria.payload = payload;
      memoria.updatedAt = updatedAt;
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
ok(
  "A redis+supabase ok",
  a.status === 200 &&
    a.body.success === true &&
    a.body.revision &&
    a.body.updated_at &&
    memoria.payload.marca === "novo" &&
    a.body.persistencia === "supabase+redis"
);

const antesCache = memoria.cache;
const b = await executarGravacaoCentral({
  ...deps({
    gravar: async () => ({ ok: false, reason: "supabase_http_522" }),
    mutar(payload) {
      payload.marca = "redis-assume";
    },
  }),
});
ok(
  "B supabase 522 — Redis assume",
  b.status === 200 &&
    b.body.success === true &&
    b.body.persistencia === "redis" &&
    b.body.supabasePendente === true &&
    b.body.confirmed === true &&
    memoria.payload.marca === "redis-assume" &&
    memoria.cache === antesCache + 1
);

ok(
  "C Redis sozinho confirma",
  gravacaoSemCentralNaoConta(false) === true &&
    resultadoGravacao({ supabaseOk: false, redisOk: true }).success === true &&
    resultadoGravacao({ supabaseOk: false, redisOk: true }).persistencia === "redis" &&
    motivoSupabaseIndisponivel("supabase_http_522") === true
);

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
ok(
  "D redis falha — supabase ainda salva",
  d.status === 200 &&
    d.body.success === true &&
    d.body.persistencia === "supabase" &&
    d.body.redis.ok === false &&
    memoria.payload.marca === "central"
);

const e = await executarGravacaoCentral({
  ...deps({ baseRevision: "2026-10-06T11:00:00.000Z" }),
});
ok("E revisao antiga", e.status === 409 && e.body.reason === "revisao_conflito" && revisaoConflita("2026-10-06T11:00:00.000Z", memoria.updatedAt) === true);
ok("E revisao igual passa a barreira", revisaoConflita(memoria.updatedAt, memoria.updatedAt) === false);

ok("F abertura vem do Redis (nuvem principal)", fonteDeAbertura(true) === "redis" && fonteDeAbertura(false) === null);

const ambosFora = await executarGravacaoCentral({
  ...deps({
    gravar: async () => ({ ok: false, reason: "supabase_http_522" }),
    cache: async () => {
      throw new Error("redis fora");
    },
  }),
});
ok("G os dois fora falha", ambosFora.status === 502 && ambosFora.body.success === false);

const sync = fs.readFileSync(path.join(root, "portal-supabase-sync.js"), "utf8");
const index = fs.readFileSync(path.join(root, "index.html"), "utf8");
const api = fs.readFileSync(path.join(root, "api", "dk-cloud-snapshot.js"), "utf8");
ok("H cliente aceita fonte redis ou supabase", sync.includes('row.source !== "supabase"') && sync.includes('row.source !== "redis"'));
ok("H cliente nao trata redis sozinho como sucesso com texto antigo", !sync.includes("Supabase em falha; Redis OK."));
ok("G sem credencial administrativa no browser", !sync.includes("SUPABASE_SERVICE_ROLE_KEY") && !index.includes("SUPABASE_SERVICE_ROLE_KEY"));
ok(
  "API grava Redis antes do espelho Supabase",
  api.includes("Redis confirma primeiro") &&
    api.includes("supabase_http_522") &&
    api.indexOf('await redis.set(REDIS_KEY, JSON.stringify({ label: LABEL, payload, updated_at: storedAt }))') <
      api.indexOf("consultarSupabase(() => upsertSnapshotByLabel(LABEL, payload, storedAt)")
);

assert.equal(falhas, 0);
console.log("test-dk-persistencia-central-ficticio ok");
