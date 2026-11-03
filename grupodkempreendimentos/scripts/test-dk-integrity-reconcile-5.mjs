/**
 * Reconciliação dos 5 clientes não pode apontar para gravação de cadastro.
 */
import assert from "node:assert/strict";
import fs from "node:fs";

const sql = fs.readFileSync(new URL("../supabase/dk-integrity-checkpoint-supersede.sql", import.meta.url), "utf8");
const script = fs.readFileSync(new URL("./dk-integrity-reconcile-5-clientes.mjs", import.meta.url), "utf8");
const manifesto = fs.readFileSync(new URL("./dk-integrity-manifest.mjs", import.meta.url), "utf8");

assert.match(sql, /superseded/);
assert.doesNotMatch(sql, /dk_clientes|dk_veiculos|dk_locacao|dk_pagamento/);
assert.match(script, /system\.integrity_delta_batch_registered/);
assert.match(script, /c4ec4c01-2026-4029-8aec-000000000443/);
assert.match(script, /legitimate_business_change|classification/);
assert.doesNotMatch(script, /update public\.dk_clientes|delete from public\.dk_clientes|insert into public\.dk_clientes/);
assert.match(manifesto, /c4ec4c01-2026-4029-8aec-000000000443/);
assert.match(manifesto, /clientes_count\) === 443/);
assert.equal(script.includes("git add ."), false);
console.log("ok dk-integrity-reconcile-5");
