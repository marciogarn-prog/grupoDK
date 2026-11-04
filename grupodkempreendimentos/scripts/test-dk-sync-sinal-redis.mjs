/**
 * Sinal Redis do Log: publica seq crescente e não regride.
 */
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { seqValido, KEY } = require("../lib/dk-sync-sinal-redis.cjs");

assert.equal(seqValido(12), 12);
assert.equal(seqValido("99"), 99);
assert.equal(seqValido(0), 0);
assert.equal(seqValido(-1), 0);
assert.equal(seqValido("x"), 0);
assert.match(KEY, /sync_sinal/);

const syncSrc = require("node:fs").readFileSync(new URL("../portal-dk-sync.js", import.meta.url), "utf8");
assert.match(syncSrc, /dkSyncAplicarSinalRedis/);
assert.match(syncSrc, /dk-area-ocupacao/);
assert.match(syncSrc, /redis_sinal/);
assert.match(syncSrc, /REALTIME_AUTH_BLOCKED/);

const areaSrc = require("node:fs").readFileSync(new URL("../api/dk-area-trabalho.js", import.meta.url), "utf8");
assert.match(areaSrc, /server_event_seq/);
assert.match(areaSrc, /lerSinalSync/);

console.log("test-dk-sync-sinal-redis ok");
