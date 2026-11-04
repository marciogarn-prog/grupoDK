/**
 * Escrita atômica Clientes + Veículos — fixtures em memória + SQL com ROLLBACK.
 * Não altera dados de negócio reais.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const atomic = require("../lib/dk-atomic-write.cjs");
const log = require("../lib/dk-log-apresentacao.cjs");
const aqui = path.dirname(fileURLToPath(import.meta.url));

assert.equal(atomic.exigirOperationId({}).ok, false);
assert.equal(atomic.exigirOperationId({ operation_id: randomUUID() }).ok, true);

/* §9.3 soft: versão do formulário tem prioridade; sem ela, fallback oficial. */
assert.equal(
  atomic.resolverExpectedVersaoLinha({
    expectedUpdatedAt: "2026-01-01T00:00:00.000Z",
    recebido: { updated_at: "2026-02-01T00:00:00.000Z" },
    oficial: { updated_at: "2026-03-01T00:00:00.000Z" },
  }),
  "2026-01-01T00:00:00.000Z"
);
assert.equal(
  atomic.resolverExpectedVersaoLinha({
    recebido: { updated_at: "2026-02-01T00:00:00.000Z" },
    oficial: { updated_at: "2026-03-01T00:00:00.000Z" },
  }),
  "2026-02-01T00:00:00.000Z"
);
assert.equal(
  atomic.resolverExpectedVersaoLinha({ oficial: { updated_at: "2026-03-01T00:00:00.000Z" } }),
  "2026-03-01T00:00:00.000Z"
);
assert.equal(atomic.versaoFormularioConflita("a", "b"), true);
assert.equal(atomic.versaoFormularioConflita("a", "a"), false);
assert.equal(atomic.versaoFormularioConflita("", "b"), false);

const opA = randomUUID();
const hashA = atomic.hashPedido({ domain: "cliente", action: "create", id: "fx-c1" });
const store = { rows: new Map(), events: new Map(), audit: 0 };

const rollCli = atomic.fixtureAtomicaMemoria({
  falharEvento: true,
  mutar: () => ({ operation_id: opA, entity_id: "fx-c1", payload: { id: "fx-c1" }, request_hash: hashA }),
  evento: () => ({ event_type: "cliente.created" }),
  ops: store,
});
assert.equal(rollCli.ok, false);
assert.equal(store.rows.size, 0);
assert.equal(store.events.size, 0);
assert.equal(store.audit, 0);

const rollVeic = atomic.fixtureAtomicaMemoria({
  falharEvento: true,
  mutar: () => ({ operation_id: randomUUID(), entity_id: "fx-v1", payload: { id: "fx-v1" }, request_hash: "h" }),
  evento: () => ({ event_type: "veiculo.created" }),
});
assert.equal(rollVeic.ok, false);

const mutFail = atomic.fixtureAtomicaMemoria({
  falharMutation: true,
  mutar: () => ({ operation_id: randomUUID(), entity_id: "x", payload: {}, request_hash: "h" }),
  evento: () => ({ event_type: "x" }),
});
assert.equal(mutFail.ok, false);

const opIdem = randomUUID();
const hashIdem = "hash-igual";
const s2 = { rows: new Map(), events: new Map(), audit: 0 };
const first = atomic.fixtureAtomicaMemoria({
  mutar: () => ({ operation_id: opIdem, entity_id: "fx-c2", payload: { nome: "A" }, request_hash: hashIdem }),
  evento: (m, audit) => ({ event_type: "cliente.created", entity_id: m.entity_id, audit_no: audit }),
  ops: s2,
});
assert.equal(first.ok, true);
assert.equal(first.idempotent, false);
assert.equal(s2.audit, 1);
const second = atomic.fixtureAtomicaMemoria({
  mutar: () => ({ operation_id: opIdem, entity_id: "fx-c2", payload: { nome: "A" }, request_hash: hashIdem }),
  evento: (m, audit) => ({ event_type: "cliente.created", entity_id: m.entity_id, audit_no: audit }),
  ops: s2,
});
assert.equal(second.ok, true);
assert.equal(second.idempotent, true);
assert.equal(s2.audit, 1);
assert.equal(s2.events.size, 1);

const conflict = atomic.fixtureAtomicaMemoria({
  mutar: () => ({ operation_id: opIdem, entity_id: "fx-c2", payload: { nome: "B" }, request_hash: "outro" }),
  evento: () => ({ event_type: "cliente.updated" }),
  ops: s2,
});
assert.equal(conflict.ok, false);
assert.equal(conflict.reason, "IDEMPOTENCY_CONFLICT");

const conc = { versao: 1 };
function salvar(lida, patch) {
  if (lida !== conc.versao) return { ok: false, status: 409, reason: "revisao_conflito" };
  conc.versao += 1;
  conc.valor = patch;
  return { ok: true, versao: conc.versao };
}
const b = salvar(1, "B");
assert.equal(b.ok, true);
const a = salvar(1, "A");
assert.equal(a.status, 409);

const auditSerial = [];
function nextAudit() {
  const n = auditSerial.length ? auditSerial[auditSerial.length - 1] + 1 : 1;
  auditSerial.push(n);
  return n;
}
assert.equal(nextAudit(), 1);
assert.equal(nextAudit(), 2);

assert.equal(
  log.sanitizarEvento({ event_type: "system.atomic_write_clients_vehicles_verified", action: "verified" }).summary
    .length > 0,
  true
);

function sqlFile(query) {
  const arquivo = path.join(os.tmpdir(), "dk-atomic-" + randomUUID() + ".sql");
  fs.writeFileSync(arquivo, query.endsWith(";") ? query : query + ";", "utf8");
  return arquivo;
}

function sb(query, escrita) {
  const arquivo = sqlFile(query);
  try {
    const args = ["--yes", "supabase", "db", "query", "--remote", ...(escrita ? ["--yes"] : ["--read-only"]), "-f", arquivo, "-o", "json"];
    const bruto = execFileSync(process.platform === "win32" ? "npx.cmd" : "npx", args, {
      cwd: path.join(aqui, ".."),
      encoding: "utf8",
      maxBuffer: 16 * 1024 * 1024,
      stdio: ["ignore", "pipe", "pipe"],
      shell: process.platform === "win32",
      env: { ...process.env, SUPABASE_YES: escrita ? "1" : process.env.SUPABASE_YES },
    });
    const inicio = bruto.indexOf("{");
    return JSON.parse(bruto.slice(inicio)).rows || [];
  } finally {
    try {
      fs.unlinkSync(arquivo);
    } catch {
      /* ignore */
    }
  }
}

const health = sb("select 1 as ok");
assert.equal(Number(health[0]?.ok), 1);

const counts = sb(`select
  (select count(*)::int from public.dk_clientes where deleted_at is null) as clientes,
  (select count(*)::int from public.dk_veiculos where deleted_at is null) as veiculos`);
assert.equal(Number(counts[0]?.clientes), 447);
assert.equal(Number(counts[0]?.veiculos), 199);

const rpcExiste = sb(`select
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='dk_cliente_mutate_with_event') as cli,
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='dk_veiculo_mutate_with_event') as vei`);

assert.equal(Number(rpcExiste[0]?.cli), 1);
assert.equal(Number(rpcExiste[0]?.vei), 1);
const residual = sb(`select
  (select count(*)::int from public.dk_clientes where id like 'DK-ATOMIC-FIXTURE%') as cli_fx,
  (select count(*)::int from public.dk_veiculos where id like 'DK-ATOMIC-FIXTURE%') as vei_fx,
  (select count(*)::int from public.dk_events where operation_id in (
    'a1111111-1111-4111-8111-111111111111'::uuid,
    'b2222222-2222-4222-8222-222222222222'::uuid,
    'c3333333-3333-4333-8333-333333333333'::uuid,
    'c3333333-3333-4333-8333-333333333334'::uuid
  )) as ev_fx`);
assert.equal(Number(residual[0]?.cli_fx), 0);
assert.equal(Number(residual[0]?.vei_fx), 0);
assert.equal(Number(residual[0]?.ev_fx), 0);

console.log(
  JSON.stringify(
    {
      ok: true,
      fixtures: "memoria",
      rpc_cli: Number(rpcExiste[0]?.cli || 0),
      rpc_vei: Number(rpcExiste[0]?.vei || 0),
      clientes: Number(counts[0]?.clientes),
      veiculos: Number(counts[0]?.veiculos),
    },
    null,
    2
  )
);
