import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { gravarClienteGeoComIo, lerClienteGeoComIo } = require("../api/dk-cliente-geo.js");
const { gravarEquipaPresencaComIo, lerEquipaPresencaComIo } = require("../api/dk-equipa-presenca.js");

let falhas = 0;

function ok(nome, cond) {
  if (!cond) {
    falhas += 1;
    console.error("FALHA", nome);
    return;
  }
  console.log("ok", nome);
}

function memoria(updatedAt) {
  const mem = {
    payload: {},
    updatedAt: updatedAt || null,
    ordem: [],
    cacheChamadas: 0,
    gravou: 0,
    redis: null,
  };
  const io = {
    ler: async () => ({
      payload: JSON.parse(JSON.stringify(mem.payload)),
      updatedAt: mem.updatedAt,
    }),
    gravar: async (payload, updatedAtNovo) => {
      mem.ordem.push("supabase");
      mem.gravou += 1;
      mem.payload = JSON.parse(JSON.stringify(payload));
      mem.updatedAt = updatedAtNovo;
      return { ok: true };
    },
  };
  const cache = async (payload) => {
    mem.ordem.push("redis");
    mem.cacheChamadas += 1;
    mem.redis = JSON.parse(JSON.stringify(payload));
  };
  return { mem, io, cache };
}

const cpfGeo = "00000000000";
const cpfPresenca = "00000000000";

async function provarRota(nome, gravar, ler, entrada, campo, conferir) {
  const base = memoria("2026-10-06T12:00:00.000Z");
  const a = await gravar(base.io, { ...entrada, baseRevision: base.mem.updatedAt }, base.cache);
  ok(`${nome} A supabase e redis`, a.status === 200 && a.body.success === true && a.body.revision && a.body.updated_at && base.mem.ordem.join(",") === "supabase,redis");

  const redisFora = memoria("2026-10-06T12:00:00.000Z");
  const b = await gravar(
    redisFora.io,
    { ...entrada, baseRevision: redisFora.mem.updatedAt },
    async () => {
      redisFora.mem.ordem.push("redis");
      throw new Error("redis fora");
    }
  );
  ok(`${nome} B redis falha depois`, b.status === 200 && b.body.success === true && b.body.persistencia === "supabase" && b.body.redis.ok === false && redisFora.mem.gravou === 1);

  const supaFora = memoria("2026-10-06T12:00:00.000Z");
  let cacheRodou = false;
  const c = await gravar(
    {
      ler: supaFora.io.ler,
      gravar: async () => {
        supaFora.mem.ordem.push("supabase");
        return { ok: false, reason: "supabase_http_500" };
      },
    },
    { ...entrada, baseRevision: supaFora.mem.updatedAt },
    async () => {
      cacheRodou = true;
      supaFora.mem.ordem.push("redis");
    }
  );
  ok(`${nome} C supabase falha`, c.status === 502 && c.body.success !== true && cacheRodou === false && supaFora.mem.payload[campo] == null);

  ok(`${nome} D sem fallback local`, c.body.success !== true && c.body.ok !== true && !("local" in (c.body || {})));

  ok(`${nome} E supabase antes do redis`, a.body.success === true && base.mem.ordem[0] === "supabase" && base.mem.ordem[1] === "redis");

  const leitura = await ler(base.io);
  const redisDivergente = { marca: "so-redis" };
  ok(
    `${nome} leitura da fonte central`,
    leitura.status === 200 && leitura.body.source === "supabase" && conferir(leitura.body) && redisDivergente.marca !== conferir(leitura.body)
  );

  const conflito = memoria("2026-10-06T12:00:00.000Z");
  const antes = conflito.mem.updatedAt;
  const e = await gravar(conflito.io, { ...entrada, baseRevision: "2026-10-06T11:00:00.000Z" }, conflito.cache);
  ok(`${nome} revisao antiga`, e.status === 409 && e.body.success === false && e.body.reason === "revisao_conflito" && conflito.mem.updatedAt === antes && conflito.mem.cacheChamadas === 0);
}

await provarRota(
  "geo",
  gravarClienteGeoComIo,
  lerClienteGeoComIo,
  { cpf: cpfGeo, lat: -23.5, lng: -46.6, nome: "TESTE TECNICO", ts: Date.now() },
  "dk_cliente_geo_v1",
  (body) => body.clientes && body.clientes[0] && body.clientes[0].lat === -23.5
);

await provarRota(
  "presenca",
  gravarEquipaPresencaComIo,
  lerEquipaPresencaComIo,
  { cpf: cpfPresenca, vivo: true, nome: "TESTE TECNICO", at: Date.now() },
  "dk_equipa_presenca_v1",
  (body) => Array.isArray(body.cpfs) && body.cpfs.includes(cpfPresenca)
);

assert.equal(falhas, 0);
console.log("test-dk-geo-presenca-central-ficticio ok");
