/**
 * O checkpoint não pode apontar para gravação de cadastro.
 */
import assert from "node:assert/strict";
import fs from "node:fs";

const sql = fs.readFileSync(new URL("../supabase/dk-integrity-delta.sql", import.meta.url), "utf8");
const script = fs.readFileSync(new URL("./dk-integrity-checkpoint.mjs", import.meta.url), "utf8");
assert.match(sql, /parent_baseline_id/);
assert.match(sql, /business_change/);
assert.match(sql, /enable row level security/);
assert.doesNotMatch(sql, /dk_clientes|dk_veiculos|dk_locacao|dk_pagamento_locacao/);
assert.match(script, /bcafcc5a-e214-4777-8aec-25d41fb31699/);
assert.match(script, /system\.integrity_delta_registered/);
assert.doesNotMatch(script, /update public\.dk_clientes|delete from public\.dk_clientes|update public\.dk_veiculos|dk_cloud_snapshots/);
assert.equal(script.includes("git add ."), false);
console.log("ok dk-integrity-checkpoint");
