/**
 * Backup independente pré-infra BC — SOMENTE LEITURA no Redis.
 * Comprova round-trip de restauração do ficheiro (não escreve no Redis).
 *
 * node grupodkempreendimentos/scripts/dk-bc-backup-pre-infra.mjs
 */
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PARENT = path.resolve(ROOT, "..");

function loadEnv(file) {
  try {
    for (const line of fs.readFileSync(file, "utf8").split(/\n/)) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (!m) continue;
      let v = m[2].trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      if (!process.env[m[1]]) process.env[m[1]] = v;
    }
  } catch {
    /* ignore */
  }
}

for (const f of [
  path.join(ROOT, ".env.vercel.local"),
  path.join(ROOT, ".env.vercel.pull"),
  path.join(PARENT, ".env.local"),
]) {
  loadEnv(f);
}

const { isRedisKvConfigured, createRedisClient } = require("../lib/dk-redis-env.cjs");

if (!isRedisKvConfigured()) {
  console.error(JSON.stringify({ ok: false, reason: "redis_not_configured" }));
  process.exit(2);
}

const at = new Date().toISOString();
const redis = createRedisClient();
const hubRaw = await redis.get("dk:portal:cloud_snapshot:v1");
const hubStr = typeof hubRaw === "string" ? hubRaw : JSON.stringify(hubRaw);
const indice = await redis.hgetall("dk:portal:vms:indice:v1");
const seq = await redis.get("dk:portal:vms:seq:v1");
const flags = {
  clientes: await redis.get("dk:portal:clientes_fonte:v1"),
  locacoes: await redis.get("dk:portal:locacoes_fonte:v1"),
  veiculos: await redis.get("dk:portal:veiculos_fonte:v1"),
};

const pack = {
  backup_at: at,
  tipo: "pre_infra_bc_v1",
  redis: {
    hub: typeof hubRaw === "string" ? JSON.parse(hubRaw) : hubRaw,
    vms_indice_keys: indice && typeof indice === "object" ? Object.keys(indice).length : 0,
    vms_seq: Number(seq) || 0,
    flags,
  },
  nota: "Backup de leitura. Não altera Redis/PG. Rollback da infra BC = DROP apenas das tabelas dk_bc_* novas.",
};

const body = JSON.stringify(pack);
const sha = crypto.createHash("sha256").update(body, "utf8").digest("hex");
const dir = path.join(ROOT, "artifacts", "bc-backup");
fs.mkdirSync(dir, { recursive: true });
const file = path.join(dir, `pre-infra-bc-${at.replace(/[:.]/g, "-")}.json`);
fs.writeFileSync(file, body);
const shaFile = path.join(dir, `pre-infra-bc-${at.replace(/[:.]/g, "-")}.sha256`);
fs.writeFileSync(shaFile, `${sha}  ${path.basename(file)}\n`);

/* Prova de restauração do ficheiro (round-trip) — sem escrever na nuvem. */
const relido = fs.readFileSync(file, "utf8");
const shaRelido = crypto.createHash("sha256").update(relido, "utf8").digest("hex");
const parsed = JSON.parse(relido);
const prova =
  shaRelido === sha &&
  parsed.backup_at === at &&
  parsed.tipo === "pre_infra_bc_v1" &&
  parsed.redis &&
  typeof parsed.redis.vms_seq === "number";

/* Segunda leitura live: fingerprint do hub deve coincidir com o backup (mesmo instante aproximado). */
const hubRaw2 = await redis.get("dk:portal:cloud_snapshot:v1");
const hubStr2 = typeof hubRaw2 === "string" ? hubRaw2 : JSON.stringify(hubRaw2);
const hubIgual = hubStr === hubStr2;

console.log(
  JSON.stringify(
    {
      ok: Boolean(prova),
      backup_at: at,
      file,
      sha256: sha,
      prova_restauracao_ficheiro: prova,
      hub_estavel_na_janela: hubIgual,
      vms: pack.redis.vms_indice_keys,
      seq: pack.redis.vms_seq,
      bytes: body.length,
    },
    null,
    2
  )
);

if (!prova) process.exit(1);
