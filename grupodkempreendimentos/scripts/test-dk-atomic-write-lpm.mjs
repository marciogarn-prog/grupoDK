/**
 * Fase 7 — fixtures atômicas Locação/Pagamento/Manutenção (memória + SQL ROLLBACK).
 * Não altera dados reais de negócio.
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
const lpm = require("../lib/dk-atomic-write-lpm.cjs");
const fonte = require("../lib/dk-manutencao-fonte.cjs");
const { normalizarOperacao } = require("../lib/dk-pagamento-operacao.cjs");
const aqui = path.dirname(fileURLToPath(import.meta.url));

assert.equal(normalizarOperacao("criar"), "create");
assert.equal(normalizarOperacao("atualizar"), "update");
assert.equal(normalizarOperacao("remover"), "remove");
assert.equal(normalizarOperacao("create"), "create");
assert.equal(fonte.FONTE, "dk_manutencao");
assert.equal(typeof lpm.mutarLocacaoAtomico, "function");
assert.equal(typeof lpm.mutarPagamentoAtomico, "function");
assert.equal(typeof lpm.mutarManutencaoAtomico, "function");

function memFixture(opts) {
  return atomic.fixtureAtomicaMemoria(opts);
}

for (const dominio of ["locacao", "pagamento", "manutencao"]) {
  const store = { rows: new Map(), events: new Map(), audit: 0 };
  const op = randomUUID();
  const hash = "hash-" + dominio;
  const roll = memFixture({
    falharEvento: true,
    mutar: () => ({ operation_id: op, entity_id: "fx-" + dominio, payload: { d: dominio }, request_hash: hash }),
    evento: () => ({ event_type: dominio + ".created" }),
    ops: store,
  });
  assert.equal(roll.ok, false, dominio + " rollback evento");
  assert.equal(store.rows.size, 0);
  assert.equal(store.events.size, 0);
  assert.equal(store.audit, 0);

  const s2 = { rows: new Map(), events: new Map(), audit: 0 };
  const op2 = randomUUID();
  const first = memFixture({
    mutar: () => ({ operation_id: op2, entity_id: "fx2-" + dominio, payload: { a: 1 }, request_hash: "h2" }),
    evento: (m, audit) => ({ event_type: dominio + ".created", audit_no: audit }),
    ops: s2,
  });
  assert.equal(first.ok, true);
  const second = memFixture({
    mutar: () => ({ operation_id: op2, entity_id: "fx2-" + dominio, payload: { a: 1 }, request_hash: "h2" }),
    evento: (m, audit) => ({ event_type: dominio + ".created", audit_no: audit }),
    ops: s2,
  });
  assert.equal(second.idempotent, true);
  assert.equal(s2.audit, 1);
  assert.equal(s2.events.size, 1);
  const conflict = memFixture({
    mutar: () => ({ operation_id: op2, entity_id: "fx2-" + dominio, payload: { a: 2 }, request_hash: "outro" }),
    evento: () => ({ event_type: dominio + ".updated" }),
    ops: s2,
  });
  assert.equal(conflict.ok, false);
  assert.equal(conflict.reason, "IDEMPOTENCY_CONFLICT");
}

const conc = { versao: 1 };
function salvar(lida) {
  if (lida !== conc.versao) return { ok: false, status: 409, reason: "revisao_conflito" };
  conc.versao += 1;
  return { ok: true, versao: conc.versao };
}
assert.equal(salvar(1).ok, true);
assert.equal(salvar(1).status, 409);

function sb(query, escrita) {
  const arquivo = path.join(os.tmpdir(), "dk-lpm-" + randomUUID() + ".sql");
  fs.writeFileSync(arquivo, query.endsWith(";") ? query : query + ";", "utf8");
  try {
    const args = [
      "--yes",
      "supabase",
      "db",
      "query",
      "--remote",
      ...(escrita ? ["--yes"] : ["--read-only"]),
      "-f",
      arquivo,
      "-o",
      "json",
    ];
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

assert.equal(Number(sb("select 1 as ok")[0]?.ok), 1);

const rpc = sb(`select
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='dk_locacao_mutate_with_event') as loc,
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='dk_pagamento_mutate_with_event') as pag,
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='dk_manutencao_mutate_with_event') as man,
  (select count(*)::int from public.dk_manutencao where deleted_at is null) as manut_total,
  (select count(*)::int from public.dk_manutencao where source_kind='historico' and deleted_at is null) as manut_hist,
  (select count(*)::int from public.dk_manutencao where source_kind='rapida' and deleted_at is null) as manut_rap`);
assert.equal(Number(rpc[0]?.loc), 1);
assert.equal(Number(rpc[0]?.pag), 1);
assert.equal(Number(rpc[0]?.man), 1);
assert.equal(Number(rpc[0]?.manut_total), 390);
assert.equal(Number(rpc[0]?.manut_hist), 28);
assert.equal(Number(rpc[0]?.manut_rap), 362);

const counts = sb(`select
  (select count(*)::int from public.dk_clientes where deleted_at is null) as clientes,
  (select count(*)::int from public.dk_veiculos where deleted_at is null) as veiculos,
  (select count(*)::int from public.dk_locacao where deleted_at is null) as locacoes,
  (select count(*)::int from public.dk_pagamento_locacao where removido is not true) as pag_ativos,
  (select count(*)::int from public.dk_pagamento_locacao where removido is true) as pag_rem`);
assert.equal(Number(counts[0]?.clientes), 443);
assert.equal(Number(counts[0]?.veiculos), 199);
assert.equal(Number(counts[0]?.locacoes), 610);
assert.equal(Number(counts[0]?.pag_ativos), 1578);
assert.equal(Number(counts[0]?.pag_rem), 274);

const rollbackSql = `
do $$
declare
  v_op uuid := 'd4444444-4444-4444-8444-444444444444';
  v_nc text := '2099' || to_char(clock_timestamp(), 'HH24MISSMS');
  v_mid int; v_ev int; v_a1 bigint; v_a2 bigint;
begin
  select last_audit_no into v_a1 from public.dk_audit_state where id=1;
  begin
    perform * from public.dk_locacao_mutate_with_event(
      v_op,'create',v_nc,
      jsonb_build_object('numeroContrato',v_nc,'cpf','90000000990','placa','ZZZ0Z00','statusLocacao','ATIVO'),
      null,'fx-loc-hash-1',null,null,'{"summary":"fx"}'::jsonb,'admin'
    );
    raise exception 'DK_FORCE_ROLLBACK';
  exception when others then
    if SQLERRM <> 'DK_FORCE_ROLLBACK' then raise; end if;
  end;
  select count(*) into v_mid from public.dk_locacao where numero_contrato=v_nc;
  select count(*) into v_ev from public.dk_events where operation_id=v_op;
  select last_audit_no into v_a2 from public.dk_audit_state where id=1;
  if v_mid<>0 or v_ev<>0 or v_a1 is distinct from v_a2 then raise exception 'rollback_loc_fail'; end if;
end $$;

do $$
declare
  v_op uuid := 'e5555555-5555-4555-8555-555555555555';
  v_nc text; v_mid int; v_ev int; v_a1 bigint; v_a2 bigint;
begin
  select numero_contrato into v_nc from public.dk_locacao where deleted_at is null limit 1;
  if v_nc is null then raise exception 'sem_locacao'; end if;
  select last_audit_no into v_a1 from public.dk_audit_state where id=1;
  begin
    perform * from public.dk_pagamento_mutate_with_event(
      v_op,'create',null,v_nc,
      jsonb_build_object('protocoloLancamento','FX-PAG-7','data','01/01/2099','valor','1.00','tipoMovimento','LOCACAO'),
      null,'fx-pag-hash-1',null,null,'{"summary":"fx"}'::jsonb,'admin'
    );
    raise exception 'DK_FORCE_ROLLBACK';
  exception when others then
    if SQLERRM <> 'DK_FORCE_ROLLBACK' then raise; end if;
  end;
  select count(*) into v_mid from public.dk_pagamento_locacao where operation_id=v_op;
  select count(*) into v_ev from public.dk_events where operation_id=v_op;
  select last_audit_no into v_a2 from public.dk_audit_state where id=1;
  if v_mid<>0 or v_ev<>0 or v_a1 is distinct from v_a2 then raise exception 'rollback_pag_fail'; end if;
end $$;

do $$
declare
  v_op uuid := 'f6666666-6666-4666-8666-666666666666';
  v_mid int; v_ev int; v_a1 bigint; v_a2 bigint;
begin
  select last_audit_no into v_a1 from public.dk_audit_state where id=1;
  begin
    perform * from public.dk_manutencao_mutate_with_event(
      v_op,'create','rapida:fx-fase7-rollback','rapida',
      '{"id":"fx-fase7-rollback","placa":"ZZZ0Z00"}'::jsonb,
      null,'fx-man-hash-1',null,null,'{"summary":"fx"}'::jsonb,'admin'
    );
    raise exception 'DK_FORCE_ROLLBACK';
  exception when others then
    if SQLERRM <> 'DK_FORCE_ROLLBACK' then raise; end if;
  end;
  select count(*) into v_mid from public.dk_manutencao where id='rapida:fx-fase7-rollback';
  select count(*) into v_ev from public.dk_events where operation_id=v_op;
  select last_audit_no into v_a2 from public.dk_audit_state where id=1;
  if v_mid<>0 or v_ev<>0 or v_a1 is distinct from v_a2 then raise exception 'rollback_man_fail'; end if;
end $$;

select 1 as rollback_ok;
`;
sb(rollbackSql, true);

const residual = sb(`select
  (select count(*)::int from public.dk_manutencao where id='rapida:fx-fase7-rollback') as man_fx,
  (select count(*)::int from public.dk_events where operation_id in (
    'd4444444-4444-4444-8444-444444444444'::uuid,
    'e5555555-5555-4555-8555-555555555555'::uuid,
    'f6666666-6666-4666-8666-666666666666'::uuid
  )) as ev_fx,
  (select count(*)::int from public.dk_locacao where numero_contrato like '2099%' and cpf='90000000990') as loc_fx`);
assert.equal(Number(residual[0]?.man_fx), 0);
assert.equal(Number(residual[0]?.ev_fx), 0);
assert.equal(Number(residual[0]?.loc_fx), 0);

const uiCli = fs.readFileSync(path.join(aqui, "..", "portal-locadora-ui.js"), "utf8");
assert.match(uiCli, /operation_id/);
assert.match(uiCli, /__DK_.*OP_IDS|operation_id\s*=/);
const uiPag = fs.readFileSync(path.join(aqui, "..", "portal-pagamento-store.js"), "utf8");
assert.match(uiPag, /operationIdEstavel/);
const uiLoc = fs.readFileSync(path.join(aqui, "..", "portal-locacao-pg.js"), "utf8");
assert.match(uiLoc, /__DK_LOCACAO_OP_IDS/);
const uiMan = fs.readFileSync(path.join(aqui, "..", "portal-manutencao-rapida.js"), "utf8");
assert.match(uiMan, /operationIdEstavelManut|__DK_MANUT_OP_IDS/);

const orfaos = sb(`select
  count(*) filter (where coalesce(placa,'') = '')::int as sem_placa,
  count(*)::int as total
from public.dk_manutencao where deleted_at is null`);
assert.equal(Number(orfaos[0]?.total), 390);

console.log(
  JSON.stringify(
    {
      ok: true,
      rpc_loc: Number(rpc[0]?.loc),
      rpc_pag: Number(rpc[0]?.pag),
      rpc_man: Number(rpc[0]?.man),
      manutencao: Number(rpc[0]?.manut_total),
      rollback: "ok",
      clientes: Number(counts[0]?.clientes),
      veiculos: Number(counts[0]?.veiculos),
      locacoes: Number(counts[0]?.locacoes),
      pag_ativos: Number(counts[0]?.pag_ativos),
      pag_rem: Number(counts[0]?.pag_rem),
    },
    null,
    2
  )
);
