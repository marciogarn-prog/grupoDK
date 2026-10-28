import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sql = fs.readFileSync(path.join(raiz, "supabase", "dk-events-broadcast.sql"), "utf8").toLowerCase();

assert.ok(sql.includes("insert into realtime.messages"));
assert.ok(sql.includes("jsonb_build_object('seq', new.seq, 'kind', 'dk_event')"));
assert.ok(sql.includes("'dk:events'"));
assert.ok(sql.includes("não tinha partição"));
assert.ok(sql.includes("after insert on public.dk_events"));
assert.ok(sql.includes("dk_events_broadcast_seq_ignorado"));
assert.ok(sql.includes("to authenticated"));
assert.ok(sql.includes("realtime.topic() = 'dk:events'"));
assert.ok(!sql.includes("supabase_realtime"));
assert.ok(!sql.includes("actor_user_id"));
assert.ok(!sql.includes("entity_id"));
assert.ok(!sql.includes("cpf"));
assert.ok(!sql.includes("placa"));
assert.ok(!/\bdrop table\b/.test(sql));
assert.ok(!/\btruncate\b/.test(sql));
assert.ok(!/\bdelete\b/.test(sql));
assert.ok(sql.includes("revoke all on function public.dk_events_broadcast_seq()"));

const proibido = ["payload", "actor_session_id", "valor", "visibility", "event_type"];
for (const campo of proibido) {
  assert.ok(!sql.includes("'" + campo + "'"), campo);
}

console.log("realtime sinal ok");
