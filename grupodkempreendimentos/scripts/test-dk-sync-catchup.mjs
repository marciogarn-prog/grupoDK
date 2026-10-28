import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sync = require("../lib/dk-sync-leitura.cjs");
const sql = fs.readFileSync(path.join(raiz, "supabase", "dk-append-event.sql"), "utf8").toLowerCase();
const api = fs.readFileSync(path.join(raiz, "api", "dk-sync.js"), "utf8");

assert.ok(sql.includes("security invoker"));
assert.ok(sql.includes("set search_path = public"));
assert.ok(sql.includes("on conflict (operation_id) do nothing"));
assert.ok(sql.includes("revoke all on function public.dk_append_event"));
assert.ok(sql.includes("from public, anon, authenticated, service_role"));
assert.ok(!sql.includes("drop table"));
assert.ok(!sql.includes("truncate"));
assert.ok(!/\bdelete\b/.test(sql));
assert.ok(!api.includes("dk_clientes"));
assert.ok(!api.includes("dk_pagamento"));
assert.ok(!api.includes("innerHTML"));
assert.ok(api.includes("order=seq.asc") || fs.readFileSync(path.join(raiz, "lib", "dk-sync-leitura.cjs"), "utf8").includes("order=seq.asc"));

assert.deepStrictEqual(sync.interpretarAfter(undefined), { ok: true, after: 0 });
assert.deepStrictEqual(sync.interpretarAfter(""), { ok: true, after: 0 });
assert.deepStrictEqual(sync.interpretarAfter("3"), { ok: true, after: 3 });
assert.strictEqual(sync.interpretarAfter("-1").ok, false);
assert.strictEqual(sync.interpretarAfter("1.5").ok, false);
assert.deepStrictEqual(sync.interpretarLimit(undefined), { ok: true, limit: 100 });
assert.deepStrictEqual(sync.interpretarLimit("1"), { ok: true, limit: 1 });
assert.strictEqual(sync.interpretarLimit("0").reason, "limit_invalido");
assert.strictEqual(sync.interpretarLimit("501").reason, "limit_maximo");

assert.strictEqual(sync.ehAdministradorSync({ ok: true, typ: "equipa", role: "owner" }), true);
assert.strictEqual(sync.ehAdministradorSync({ ok: true, typ: "equipa", role: "operacao" }), false);
assert.strictEqual(sync.ehAdministradorSync({ ok: true, typ: "equipa", role: "owner", service: true }), false);

const adminRow = {
  seq: 3,
  event_type: "system.log_initialized",
  entity_type: "system",
  entity_id: "log-dk",
  action: "initialized",
  module: "system",
  actor_user_id: null,
  payload: { message: "Infraestrutura durável do Log DK inicializada" },
  visibility: "admin",
  created_at: "2026-10-28T20:25:54.415862+00:00",
};
const cheio = sync.projetarParaPapel(adminRow, true);
assert.strictEqual(cheio.entity_id, "log-dk");
assert.strictEqual(cheio.payload.message, "Infraestrutura durável do Log DK inicializada");
const marker = sync.projetarParaPapel(adminRow, false);
assert.deepStrictEqual(marker, { seq: 3, restricted: true });
assert.strictEqual(Object.keys(marker).join(","), "seq,restricted");

const tres = [1, 2, 3].map((seq) => ({ ...adminRow, seq, visibility: "admin" }));
const pagina = sync.montarCatchUp({ linhas: tres, after: 0, limit: 1, serverSeq: 3, admin: false });
assert.strictEqual(pagina.events.length, 1);
assert.deepStrictEqual(pagina.events[0], { seq: 1, restricted: true });
assert.strictEqual(pagina.has_more, true);
assert.strictEqual(pagina.next_after, 1);
assert.strictEqual(pagina.server_event_seq, 3);
const fim = sync.montarCatchUp({ linhas: [], after: 3, limit: 100, serverSeq: 3, admin: true });
assert.deepStrictEqual(fim.events, []);
assert.strictEqual(fim.has_more, false);
assert.strictEqual(fim.next_after, 3);
assert.strictEqual(fim.server_event_seq, 3);

const lido = await sync.lerCatchUp({ after: 0, limit: 1, admin: true }, async (caminho) => {
  if (String(caminho).includes("order=seq.desc")) return { ok: true, status: 200, data: [{ seq: 3 }] };
  return { ok: true, status: 200, data: [adminRow, { ...adminRow, seq: 4 }] };
});
assert.strictEqual(lido.events.length, 1);
assert.strictEqual(lido.events[0].seq, 3);
assert.strictEqual(lido.has_more, true);
assert.strictEqual(lido.next_after, 3);
assert.strictEqual(lido.server_event_seq, 3);
assert.strictEqual(lido.events[0].payload.message.includes("<"), false);

console.log("sync catchup ok");
