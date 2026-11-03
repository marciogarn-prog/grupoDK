-- Fase 7: escrita atômica Locação + Pagamento + Manutenção relacional.
-- service_role only. Snapshot NÃO é apagado.

alter table public.dk_mutation_receipt drop constraint if exists dk_mutation_receipt_domain_check;
alter table public.dk_mutation_receipt drop constraint if exists dk_mutation_receipt_action_check;
alter table public.dk_mutation_receipt
  add constraint dk_mutation_receipt_domain_check
  check (domain in ('cliente','veiculo','locacao','pagamento','manutencao'));
alter table public.dk_mutation_receipt
  add constraint dk_mutation_receipt_action_check
  check (action in ('create','update','finalize','remove'));

-- ========== LOCAÇÃO ==========
create or replace function public.dk_locacao_mutate_with_event(
  p_operation_id uuid,
  p_action text,
  p_numero_contrato text,
  p_campos jsonb,
  p_expected_version integer,
  p_request_hash text,
  p_actor_user_id text,
  p_actor_session_id uuid,
  p_event_payload jsonb,
  p_visibility text default 'team'
) returns table (
  entity_id text, action text, record_version integer, operation_id uuid,
  audit_no bigint, seq bigint, inserted boolean, idempotent boolean
) language plpgsql security invoker set search_path = public as $$
#variable_conflict use_column
declare
  v_action text; v_nc text; v_prev public.dk_locacao%rowtype; v_now timestamptz := now();
  v_seq bigint; v_audit bigint; v_receipt public.dk_mutation_receipt%rowtype;
  v_event_type text; v_ver integer; v_id uuid; v_inserted boolean := false;
  v_cpf text; v_placa text; v_status text;
begin
  if p_operation_id is null then raise exception 'operation_id_ausente' using errcode='22023'; end if;
  v_action := lower(btrim(coalesce(p_action,'')));
  if v_action not in ('create','update','finalize') then raise exception 'acao_invalida' using errcode='22023'; end if;
  v_nc := regexp_replace(coalesce(p_numero_contrato,''), '\D', '', 'g');
  if v_nc = '' then raise exception 'protocolo_obrigatorio' using errcode='22023'; end if;
  if p_campos is null or jsonb_typeof(p_campos) <> 'object' then raise exception 'payload_invalido' using errcode='22023'; end if;
  if coalesce(btrim(p_request_hash),'') = '' then raise exception 'request_hash_ausente' using errcode='22023'; end if;

  select * into v_receipt from public.dk_mutation_receipt r where r.operation_id = p_operation_id;
  if found then
    if v_receipt.request_hash is distinct from btrim(p_request_hash) then
      raise exception 'IDEMPOTENCY_CONFLICT' using errcode='22023';
    end if;
    entity_id := v_receipt.entity_id; action := v_receipt.action;
    record_version := null; -- preenchido abaixo se possível
    begin
      select version into record_version from public.dk_locacao where numero_contrato = v_receipt.entity_id;
    exception when others then record_version := null; end;
    operation_id := v_receipt.operation_id; audit_no := v_receipt.audit_no; seq := v_receipt.seq;
    inserted := false; idempotent := true; return next; return;
  end if;

  select * into v_prev from public.dk_locacao l where l.numero_contrato = v_nc for update;
  if v_action = 'create' then
    if found and v_prev.deleted_at is null then raise exception 'locacao_ja_existe' using errcode='23505'; end if;
    if p_expected_version is not null then raise exception 'revisao_create_invalida' using errcode='22023'; end if;
    v_ver := 1; v_inserted := true;
  else
    if not found or v_prev.deleted_at is not null then raise exception 'locacao_ausente' using errcode='P0002'; end if;
    if p_expected_version is null or v_prev.version is distinct from p_expected_version then
      raise exception 'revisao_conflito' using errcode='40001';
    end if;
    v_ver := v_prev.version + 1;
  end if;

  v_cpf := coalesce(nullif(btrim(p_campos->>'cpf'),''), v_prev.cpf);
  v_placa := coalesce(nullif(btrim(p_campos->>'placa'),''), v_prev.placa);
  v_status := coalesce(nullif(btrim(coalesce(p_campos->>'statusLocacao', p_campos->>'status')),''), v_prev.status_locacao, 'ATIVO');
  if v_action = 'finalize' then v_status := 'INATIVO'; end if;

  insert into public.dk_locacao as l (id, numero_contrato, cpf, placa, status_locacao, campos, version, created_at, updated_at, deleted_at, created_by, updated_by)
  values (
    coalesce(v_prev.id, gen_random_uuid()), v_nc, v_cpf, v_placa, v_status, p_campos, v_ver,
    coalesce(v_prev.created_at, v_now), v_now, null,
    coalesce(v_prev.created_by, p_actor_user_id), p_actor_user_id
  )
  on conflict (numero_contrato) do update set
    cpf = excluded.cpf, placa = excluded.placa, status_locacao = excluded.status_locacao,
    campos = excluded.campos, version = excluded.version, updated_at = excluded.updated_at,
    updated_by = excluded.updated_by, deleted_at = null
  returning l.id, l.version into v_id, v_ver;

  v_event_type := case v_action when 'create' then 'locacao.created' when 'finalize' then 'locacao.finalized' else 'locacao.updated' end;
  perform 1 from public.dk_append_event(
    p_operation_id, v_event_type, 'locacao', v_nc, v_action, v_ver::bigint,
    'locacoes', null, null, p_actor_user_id, p_actor_session_id, p_event_payload,
    coalesce(nullif(btrim(p_visibility),''),'team')
  );
  select ev.audit_no, ev.seq into v_audit, v_seq from public.dk_events ev where ev.operation_id = p_operation_id;
  if v_seq is null then raise exception 'evento_nao_confirmado' using errcode='P0001'; end if;
  insert into public.dk_mutation_receipt(operation_id,domain,entity_id,action,request_hash,audit_no,seq,record_revision)
  values (p_operation_id,'locacao',v_nc,v_action,btrim(p_request_hash),v_audit,v_seq,v_now);
  entity_id := v_nc; action := v_action; record_version := v_ver; operation_id := p_operation_id;
  audit_no := v_audit; seq := v_seq; inserted := v_inserted; idempotent := false; return next;
end; $$;

-- ========== PAGAMENTO ==========
create or replace function public.dk_pagamento_mutate_with_event(
  p_operation_id uuid,
  p_action text,
  p_pagamento_id uuid,
  p_numero_contrato text,
  p_payload jsonb,
  p_expected_version integer,
  p_request_hash text,
  p_actor_user_id text,
  p_actor_session_id uuid,
  p_event_payload jsonb,
  p_visibility text default 'team'
) returns table (
  entity_id text, action text, record_version integer, operation_id uuid,
  audit_no bigint, seq bigint, inserted boolean, idempotent boolean, removido boolean
) language plpgsql security invoker set search_path = public as $$
#variable_conflict use_column
declare
  v_action text; v_nc text; v_prev public.dk_pagamento_locacao%rowtype; v_loc public.dk_locacao%rowtype;
  v_now timestamptz := now(); v_seq bigint; v_audit bigint; v_receipt public.dk_mutation_receipt%rowtype;
  v_event_type text; v_ver integer; v_id uuid; v_inserted boolean := false; v_removido boolean := false;
  v_proto text; v_valor numeric; v_data date; v_tipo text; v_pos integer;
begin
  if p_operation_id is null then raise exception 'operation_id_ausente' using errcode='22023'; end if;
  v_action := lower(btrim(coalesce(p_action,'')));
  if v_action in ('criar') then v_action := 'create'; end if;
  if v_action in ('atualizar') then v_action := 'update'; end if;
  if v_action in ('remover') then v_action := 'remove'; end if;
  if v_action not in ('create','update','remove') then raise exception 'acao_invalida' using errcode='22023'; end if;
  v_nc := btrim(coalesce(p_numero_contrato,''));
  if v_nc = '' then raise exception 'contrato_obrigatorio' using errcode='22023'; end if;
  if coalesce(btrim(p_request_hash),'') = '' then raise exception 'request_hash_ausente' using errcode='22023'; end if;

  select * into v_receipt from public.dk_mutation_receipt r where r.operation_id = p_operation_id;
  if found then
    if v_receipt.request_hash is distinct from btrim(p_request_hash) then
      raise exception 'IDEMPOTENCY_CONFLICT' using errcode='22023';
    end if;
    entity_id := v_receipt.entity_id; action := v_receipt.action;
    select version, removido into record_version, removido from public.dk_pagamento_locacao where id::text = v_receipt.entity_id;
    operation_id := v_receipt.operation_id; audit_no := v_receipt.audit_no; seq := v_receipt.seq;
    inserted := false; idempotent := true; return next; return;
  end if;

  select * into v_loc from public.dk_locacao l where l.numero_contrato = v_nc and l.deleted_at is null for share;
  if not found then raise exception 'locacao_ausente' using errcode='P0002'; end if;

  if v_action = 'create' then
    if p_payload is null or jsonb_typeof(p_payload) <> 'object' then raise exception 'payload_invalido' using errcode='22023'; end if;
    v_id := coalesce(p_pagamento_id, gen_random_uuid());
    v_proto := btrim(coalesce(p_payload->>'protocoloLancamento',''));
    v_valor := nullif(p_payload->>'valor','')::numeric;
    begin
      v_data := to_date(btrim(coalesce(p_payload->>'data','')), 'DD/MM/YYYY');
    exception when others then raise exception 'data_invalida' using errcode='22023'; end;
    v_tipo := nullif(btrim(coalesce(p_payload->>'tipoMovimento', p_payload->>'tipo','')),'');
    select coalesce(max(source_position),0)+1 into v_pos from public.dk_pagamento_locacao where numero_contrato = v_nc;
    insert into public.dk_pagamento_locacao(
      id, migration_key, protocolo_lancamento, numero_contrato, tipo, data_pagamento, valor, payload,
      version, removido, deleted_at, created_at, updated_at, source_state, source_position, source_payload_hash, operation_id
    ) values (
      v_id, 'online:'||v_id::text, v_proto, v_nc, v_tipo, v_data, v_valor, p_payload,
      1, false, null, v_now, v_now, 'online', v_pos,
      encode(sha256(convert_to(p_payload::text,'UTF8')),'hex'), p_operation_id
    );
    v_ver := 1; v_inserted := true; v_removido := false;
  else
    if p_pagamento_id is null then raise exception 'id_obrigatorio' using errcode='22023'; end if;
    select * into v_prev from public.dk_pagamento_locacao p where p.id = p_pagamento_id for update;
    if not found then raise exception 'pagamento_ausente' using errcode='P0002'; end if;
    if v_prev.numero_contrato is distinct from v_nc then raise exception 'contrato_divergente' using errcode='22023'; end if;
    if p_expected_version is null or v_prev.version is distinct from p_expected_version then
      raise exception 'revisao_conflito' using errcode='40001';
    end if;
    v_ver := v_prev.version + 1;
    v_id := v_prev.id;
    if v_action = 'update' then
      if p_payload is null or jsonb_typeof(p_payload) <> 'object' then raise exception 'payload_invalido' using errcode='22023'; end if;
      if v_prev.removido then raise exception 'pagamento_removido' using errcode='22023'; end if;
      update public.dk_pagamento_locacao set
        payload = p_payload,
        protocolo_lancamento = coalesce(nullif(btrim(p_payload->>'protocoloLancamento'),''), protocolo_lancamento),
        valor = coalesce(nullif(p_payload->>'valor','')::numeric, valor),
        version = v_ver, updated_at = v_now, operation_id = coalesce(operation_id, p_operation_id)
      where id = v_id;
      v_removido := false;
    else
      update public.dk_pagamento_locacao set
        removido = true, deleted_at = v_now, version = v_ver, updated_at = v_now,
        operation_id = coalesce(operation_id, p_operation_id)
      where id = v_id;
      v_removido := true;
    end if;
  end if;

  v_event_type := case v_action when 'create' then 'payment.created' when 'remove' then 'payment.removed' else 'payment.updated' end;
  perform 1 from public.dk_append_event(
    p_operation_id, v_event_type, 'payment', v_id::text, v_action, v_ver::bigint,
    'pagamentos', null, null, p_actor_user_id, p_actor_session_id, p_event_payload,
    coalesce(nullif(btrim(p_visibility),''),'team')
  );
  select ev.audit_no, ev.seq into v_audit, v_seq from public.dk_events ev where ev.operation_id = p_operation_id;
  if v_seq is null then raise exception 'evento_nao_confirmado' using errcode='P0001'; end if;
  insert into public.dk_mutation_receipt(operation_id,domain,entity_id,action,request_hash,audit_no,seq,record_revision)
  values (p_operation_id,'pagamento',v_id::text,v_action,btrim(p_request_hash),v_audit,v_seq,v_now);
  entity_id := v_id::text; action := v_action; record_version := v_ver; operation_id := p_operation_id;
  audit_no := v_audit; seq := v_seq; inserted := v_inserted; idempotent := false; removido := v_removido; return next;
end; $$;

-- ========== MANUTENÇÃO RELACIONAL ==========
create table if not exists public.dk_manutencao (
  id text primary key,
  source_kind text not null check (source_kind in ('historico','rapida')),
  source_id text not null,
  placa text,
  veiculo_id text,
  status text,
  payload jsonb not null,
  record_version integer not null default 1,
  migration_key text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create unique index if not exists dk_manutencao_source_uidx on public.dk_manutencao (source_kind, source_id);
create index if not exists dk_manutencao_placa_idx on public.dk_manutencao (placa);
alter table public.dk_manutencao enable row level security;
revoke all on table public.dk_manutencao from public, anon, authenticated;
grant select, insert, update on table public.dk_manutencao to service_role;

create or replace function public.dk_manutencao_import_one(
  p_source_kind text,
  p_source_id text,
  p_placa text,
  p_payload jsonb,
  p_migration_key text
) returns table (id text, inserted boolean) language plpgsql security invoker set search_path = public as $$
declare
  v_id text;
  v_ins boolean := false;
begin
  if p_source_kind not in ('historico','rapida') then raise exception 'source_kind_invalido'; end if;
  if coalesce(btrim(p_source_id),'') = '' then raise exception 'source_id_ausente'; end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then raise exception 'payload_invalido'; end if;
  v_id := coalesce(nullif(btrim(p_migration_key),''), p_source_kind || ':' || btrim(p_source_id));
  insert into public.dk_manutencao(id, source_kind, source_id, placa, payload, record_version, migration_key)
  values (v_id, p_source_kind, btrim(p_source_id), nullif(btrim(coalesce(p_placa,'')),''), p_payload, 1, v_id)
  on conflict (migration_key) do update set
    payload = excluded.payload,
    placa = excluded.placa,
    updated_at = now()
  returning public.dk_manutencao.id, (xmax = 0) into id, v_ins;
  -- xmax=0 approx for insert; fallback:
  inserted := not exists (select 1 from public.dk_manutencao m where m.migration_key = v_id and m.updated_at < now() - interval '1 second');
  inserted := true; -- idempotent upsert; caller counts by migration_key uniqueness
  return next;
end; $$;

create or replace function public.dk_manutencao_mutate_with_event(
  p_operation_id uuid,
  p_action text,
  p_id text,
  p_source_kind text,
  p_payload jsonb,
  p_expected_version integer,
  p_request_hash text,
  p_actor_user_id text,
  p_actor_session_id uuid,
  p_event_payload jsonb,
  p_visibility text default 'team'
) returns table (
  entity_id text, action text, record_version integer, operation_id uuid,
  audit_no bigint, seq bigint, inserted boolean, idempotent boolean
) language plpgsql security invoker set search_path = public as $$
#variable_conflict use_column
declare
  v_action text; v_id text; v_prev public.dk_manutencao%rowtype; v_now timestamptz := now();
  v_seq bigint; v_audit bigint; v_receipt public.dk_mutation_receipt%rowtype;
  v_event_type text; v_ver integer; v_inserted boolean := false; v_kind text; v_placa text;
begin
  if p_operation_id is null then raise exception 'operation_id_ausente' using errcode='22023'; end if;
  v_action := lower(btrim(coalesce(p_action,'')));
  if v_action not in ('create','update','finalize') then raise exception 'acao_invalida' using errcode='22023'; end if;
  if coalesce(btrim(p_request_hash),'') = '' then raise exception 'request_hash_ausente' using errcode='22023'; end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then raise exception 'payload_invalido' using errcode='22023'; end if;

  select * into v_receipt from public.dk_mutation_receipt r where r.operation_id = p_operation_id;
  if found then
    if v_receipt.request_hash is distinct from btrim(p_request_hash) then raise exception 'IDEMPOTENCY_CONFLICT' using errcode='22023'; end if;
    entity_id := v_receipt.entity_id; action := v_receipt.action;
    select record_version into record_version from public.dk_manutencao where id = v_receipt.entity_id;
    operation_id := v_receipt.operation_id; audit_no := v_receipt.audit_no; seq := v_receipt.seq;
    inserted := false; idempotent := true; return next; return;
  end if;

  v_kind := lower(btrim(coalesce(p_source_kind, p_payload->>'source_kind', 'historico')));
  if v_kind not in ('historico','rapida') then v_kind := 'historico'; end if;
  v_placa := nullif(btrim(coalesce(p_payload->>'placa','')),'');
  v_id := nullif(btrim(coalesce(p_id,'')),'');

  if v_action = 'create' then
    if v_id is null then v_id := v_kind || ':' || coalesce(nullif(btrim(p_payload->>'id'),''), gen_random_uuid()::text); end if;
    if exists (select 1 from public.dk_manutencao m where m.id = v_id and m.deleted_at is null) then
      raise exception 'manutencao_ja_existe' using errcode='23505';
    end if;
    v_ver := 1; v_inserted := true;
    insert into public.dk_manutencao(id,source_kind,source_id,placa,payload,record_version,migration_key,created_at,updated_at)
    values (v_id, v_kind, coalesce(nullif(btrim(p_payload->>'id'),''), v_id), v_placa, p_payload, 1, v_id, v_now, v_now);
  else
    if v_id is null then raise exception 'id_obrigatorio' using errcode='22023'; end if;
    select * into v_prev from public.dk_manutencao m where m.id = v_id for update;
    if not found or v_prev.deleted_at is not null then raise exception 'manutencao_ausente' using errcode='P0002'; end if;
    if p_expected_version is null or v_prev.record_version is distinct from p_expected_version then
      raise exception 'revisao_conflito' using errcode='40001';
    end if;
    v_ver := v_prev.record_version + 1;
    update public.dk_manutencao set payload = p_payload, placa = coalesce(v_placa, placa),
      record_version = v_ver, updated_at = v_now,
      status = case when v_action='finalize' then 'FINALIZADA' else status end
    where id = v_id;
  end if;

  v_event_type := case v_action when 'create' then 'maintenance.created' when 'finalize' then 'maintenance.finalized' else 'maintenance.updated' end;
  perform 1 from public.dk_append_event(
    p_operation_id, v_event_type, 'manutencao', v_id, v_action, v_ver::bigint,
    'manutencao', null, null, p_actor_user_id, p_actor_session_id, p_event_payload,
    coalesce(nullif(btrim(p_visibility),''),'team')
  );
  select ev.audit_no, ev.seq into v_audit, v_seq from public.dk_events ev where ev.operation_id = p_operation_id;
  if v_seq is null then raise exception 'evento_nao_confirmado' using errcode='P0001'; end if;
  insert into public.dk_mutation_receipt(operation_id,domain,entity_id,action,request_hash,audit_no,seq,record_revision)
  values (p_operation_id,'manutencao',v_id,v_action,btrim(p_request_hash),v_audit,v_seq,v_now);
  entity_id := v_id; action := v_action; record_version := v_ver; operation_id := p_operation_id;
  audit_no := v_audit; seq := v_seq; inserted := v_inserted; idempotent := false; return next;
end; $$;

revoke all on function public.dk_locacao_mutate_with_event(uuid,text,text,jsonb,integer,text,text,uuid,jsonb,text) from public, anon, authenticated;
grant execute on function public.dk_locacao_mutate_with_event(uuid,text,text,jsonb,integer,text,text,uuid,jsonb,text) to service_role;
revoke all on function public.dk_pagamento_mutate_with_event(uuid,text,uuid,text,jsonb,integer,text,text,uuid,jsonb,text) from public, anon, authenticated;
grant execute on function public.dk_pagamento_mutate_with_event(uuid,text,uuid,text,jsonb,integer,text,text,uuid,jsonb,text) to service_role;
revoke all on function public.dk_manutencao_import_one(text,text,text,jsonb,text) from public, anon, authenticated;
grant execute on function public.dk_manutencao_import_one(text,text,text,jsonb,text) to service_role;
revoke all on function public.dk_manutencao_mutate_with_event(uuid,text,text,text,jsonb,integer,text,text,uuid,jsonb,text) from public, anon, authenticated;
grant execute on function public.dk_manutencao_mutate_with_event(uuid,text,text,text,jsonb,integer,text,text,uuid,jsonb,text) to service_role;
grant execute on function public.dk_append_event(uuid,text,text,text,text,bigint,text,text,text,text,uuid,jsonb,text) to service_role;
notify pgrst, 'reload schema';
