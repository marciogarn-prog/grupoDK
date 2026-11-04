/**
 * Sinal Redis do Log: MAX monotónico atómico (R06) — sem regressão sob corrida.
 * node grupodkempreendimentos/scripts/test-dk-sync-sinal-redis.mjs
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  seqValido,
  KEY,
  LUA_MAX_SEQ,
  maxSeqMonotonico,
  parseSinalRaw,
} = require("../lib/dk-sync-sinal-redis.cjs");

assert.equal(seqValido(12), 12);
assert.equal(seqValido("99"), 99);
assert.equal(seqValido(0), 0);
assert.equal(seqValido(-1), 0);
assert.equal(seqValido("x"), 0);
assert.match(KEY, /sync_sinal/);
assert.match(LUA_MAX_SEQ, /redis\.call\('GET'/);
assert.match(LUA_MAX_SEQ, /redis\.call\('SET'/);
assert.match(LUA_MAX_SEQ, /novo <= cur/);

assert.equal(maxSeqMonotonico(10, 5), 10);
assert.equal(maxSeqMonotonico(10, 11), 11);
assert.equal(maxSeqMonotonico(0, 3), 3);
assert.equal(maxSeqMonotonico(7, 7), 7);

/* Corrida em memória: writers lentos com seq menor nunca vencem. */
let shared = 0;
const writers = [
  [1, 50],
  [2, 100],
  [3, 40],
  [4, 200],
  [5, 30],
  [6, 180],
  [7, 90],
  [8, 10],
  [9, 150],
  [10, 60],
];
for (const [seq] of writers.sort((a, b) => a[1] - b[1])) {
  shared = maxSeqMonotonico(shared, seq);
}
assert.equal(shared, 10, "após corrida o MAX deve ser o maior seq");

/* Ordem adversa: maior primeiro, depois menores. */
shared = 0;
for (const seq of [100, 50, 99, 1, 100, 101, 80]) {
  shared = maxSeqMonotonico(shared, seq);
}
assert.equal(shared, 101);

assert.deepEqual(parseSinalRaw('{"seq":42,"at":1}'), { seq: 42, at: 1 });
assert.equal(parseSinalRaw("42").seq, 42);
assert.equal(parseSinalRaw(null).seq, 0);

const sinalSrc = fs.readFileSync(new URL("../lib/dk-sync-sinal-redis.cjs", import.meta.url), "utf8");
assert.match(sinalSrc, /redis\.eval\(/);
assert.match(sinalSrc, /LUA_MAX_SEQ/);
assert.match(sinalSrc, /MAX monotônico atómico|monotônico atómico/i);
assert.ok(
  sinalSrc.indexOf("redis.eval(LUA_MAX_SEQ") < sinalSrc.indexOf("await redis.set(KEY"),
  "caminho principal deve ser EVAL antes do fallback SET"
);

const syncSrc = fs.readFileSync(new URL("../portal-dk-sync.js", import.meta.url), "utf8");
assert.match(syncSrc, /dkSyncAplicarSinalRedis/);
assert.match(syncSrc, /dk-area-ocupacao/);
assert.match(syncSrc, /redis_sinal/);
assert.match(syncSrc, /REALTIME_AUTH_BLOCKED/);

const areaSrc = fs.readFileSync(new URL("../api/dk-area-trabalho.js", import.meta.url), "utf8");
assert.match(areaSrc, /server_event_seq/);
assert.match(areaSrc, /lerSinalSync/);
assert.match(areaSrc, /\.mget\(/);

console.log("test-dk-sync-sinal-redis ok");
