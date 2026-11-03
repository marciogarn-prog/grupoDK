-- Escrita atômica Clientes + Veículos: mutation + dk_event no mesmo COMMIT.
-- audit_no só via dk_append_event / dk_audit_state.
-- Navegador não recebe EXECUTE. service_role apenas.
-- Revisão otimista: updated_at (sem inventar record_version nesta fase).

create table if not exists public.dk_mutation_receipt (
  operation_id uuid primary key,
  domain text not null check (domain in ('cliente', 'veiculo')),
  entity_id text not null,
  action text not null check (action in ('create', 'update')),
  request_hash text not null,
  audit_no bigint,
  seq bigint not null,
  record_revision timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists dk_mutation_receipt_domain_entity_idx
  on public.dk_mutation_receipt (domain, entity_id);

alter table public.dk_mutation_receipt enable row level security;
revoke all on table public.dk_mutation_receipt from public, anon, authenticated;
grant select, insert on table public.dk_mutation_receipt to service_role;

create or replace function public.dk_cliente_mutate_with_event(
  p_operation_id uuid,
  p_action text,
  p_id text,
  p_cpf text,
  p_payload jsonb,
  p_expected_updated_at timestamptz,
  p_request_hash text,
  p_actor_user_id text,
  p_actor_session_id uuid,
  p_event_payload jsonb,
  p_visibility text default 'team'
)
returns table (
  entity_id text,
  action text,
  record_revision timestamptz,
  operation_id uuid,
  audit_no bigint,
  seq bigint,
  inserted boolean,
  idempotent boolean
)
language plpgsql
security invoker
set search_path = public
as $$
#variable_conflict use_column
declare
  v_action text;
  v_id text;
  v_cpf text;
  v_now timestamptz := now();
  v_prev public.dk_clientes%rowtype;
  v_seq bigint;
  v_audit bigint;
  v_receipt public.dk_mutation_receipt%rowtype;
  v_event_type text;
  v_inserted boolean := false;
begin
  if p_operation_id is null then
    raise exception 'operation_id_ausente' using errcode = '22023';
  end if;
  v_action := lower(btrim(coalesce(p_action, '')));
  if v_action not in ('create', 'update') then
    raise exception 'acao_invalida' using errcode = '22023';
  end if;
  v_id := btrim(coalesce(p_id, ''));
  v_cpf := regexp_replace(coalesce(p_cpf, ''), '\D', '', 'g');
  if v_id = '' then
    raise exception 'cliente_id_ausente' using errcode = '22023';
  end if;
  if length(v_cpf) <> 11 then
    raise exception 'cpf_invalido' using errcode = '22023';
  end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'payload_invalido' using errcode = '22023';
  end if;
  if p_request_hash is null or btrim(p_request_hash) = '' then
    raise exception 'request_hash_ausente' using errcode = '22023';
  end if;
  if p_event_payload is null or jsonb_typeof(p_event_payload) <> 'object' then
    raise exception 'event_payload_invalido' using errcode = '22023';
  end if;

  select * into v_receipt from public.dk_mutation_receipt r where r.operation_id = p_operation_id;
  if found then
    if v_receipt.request_hash is distinct from btrim(p_request_hash) then
      raise exception 'IDEMPOTENCY_CONFLICT' using errcode = '22023';
    end if;
    entity_id := v_receipt.entity_id;
    action := v_receipt.action;
    record_revision := v_receipt.record_revision;
    operation_id := v_receipt.operation_id;
    audit_no := v_receipt.audit_no;
    seq := v_receipt.seq;
    inserted := false;
    idempotent := true;
    return next;
    return;
  end if;

  select * into v_prev from public.dk_clientes c where c.id = v_id for update;
  if v_action = 'create' then
    if found and v_prev.deleted_at is null then
      raise exception 'cliente_ja_existe' using errcode = '23505';
    end if;
    if p_expected_updated_at is not null then
      raise exception 'revisao_create_invalida' using errcode = '22023';
    end if;
  else
    if not found or v_prev.deleted_at is not null then
      raise exception 'cliente_ausente' using errcode = 'P0002';
    end if;
    if p_expected_updated_at is null or v_prev.updated_at is distinct from p_expected_updated_at then
      raise exception 'revisao_conflito' using errcode = '40001';
    end if;
  end if;

  if exists (
    select 1 from public.dk_clientes c
    where c.cpf = v_cpf and c.deleted_at is null and c.id is distinct from v_id
  ) then
    raise exception 'cpf_duplicado' using errcode = '23505';
  end if;

  insert into public.dk_clientes (id, cpf, payload, created_at, updated_at, deleted_at)
  values (v_id, v_cpf, p_payload, coalesce(v_prev.created_at, v_now), v_now, null)
  on conflict (id) do update
    set cpf = excluded.cpf,
        payload = excluded.payload,
        updated_at = excluded.updated_at,
        deleted_at = null
  returning public.dk_clientes.updated_at into v_now;
  v_inserted := (v_action = 'create');

  v_event_type := case when v_action = 'create' then 'cliente.created' else 'cliente.updated' end;

  perform 1 from public.dk_append_event(
    p_operation_id,
    v_event_type,
    'cliente',
    v_id,
    v_action,
    null,
    'clientes',
    null,
    null,
    p_actor_user_id,
    p_actor_session_id,
    p_event_payload,
    coalesce(nullif(btrim(p_visibility), ''), 'team')
  );

  select ev.audit_no, ev.seq into v_audit, v_seq
  from public.dk_events ev
  where ev.operation_id = p_operation_id;

  if v_seq is null then
    raise exception 'evento_nao_confirmado' using errcode = 'P0001';
  end if;

  insert into public.dk_mutation_receipt (
    operation_id, domain, entity_id, action, request_hash, audit_no, seq, record_revision
  ) values (
    p_operation_id, 'cliente', v_id, v_action, btrim(p_request_hash), v_audit, v_seq, v_now
  );

  entity_id := v_id;
  action := v_action;
  record_revision := v_now;
  operation_id := p_operation_id;
  audit_no := v_audit;
  seq := v_seq;
  inserted := v_inserted;
  idempotent := false;
  return next;
end;
$$;

create or replace function public.dk_veiculo_mutate_with_event(
  p_operation_id uuid,
  p_action text,
  p_id text,
  p_placa text,
  p_payload jsonb,
  p_expected_updated_at timestamptz,
  p_request_hash text,
  p_actor_user_id text,
  p_actor_session_id uuid,
  p_event_payload jsonb,
  p_visibility text default 'team'
)
returns table (
  entity_id text,
  action text,
  record_revision timestamptz,
  operation_id uuid,
  audit_no bigint,
  seq bigint,
  inserted boolean,
  idempotent boolean
)
language plpgsql
security invoker
set search_path = public
as $$
#variable_conflict use_column
declare
  v_action text;
  v_id text;
  v_placa text;
  v_now timestamptz := now();
  v_prev public.dk_veiculos%rowtype;
  v_seq bigint;
  v_audit bigint;
  v_receipt public.dk_mutation_receipt%rowtype;
  v_event_type text;
  v_inserted boolean := false;
begin
  if p_operation_id is null then
    raise exception 'operation_id_ausente' using errcode = '22023';
  end if;
  v_action := lower(btrim(coalesce(p_action, '')));
  if v_action not in ('create', 'update') then
    raise exception 'acao_invalida' using errcode = '22023';
  end if;
  v_id := btrim(coalesce(p_id, ''));
  v_placa := btrim(coalesce(p_placa, ''));
  if v_id = '' or v_placa = '' then
    raise exception 'veiculo_invalido' using errcode = '22023';
  end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'payload_invalido' using errcode = '22023';
  end if;
  if p_request_hash is null or btrim(p_request_hash) = '' then
    raise exception 'request_hash_ausente' using errcode = '22023';
  end if;
  if p_event_payload is null or jsonb_typeof(p_event_payload) <> 'object' then
    raise exception 'event_payload_invalido' using errcode = '22023';
  end if;

  select * into v_receipt from public.dk_mutation_receipt r where r.operation_id = p_operation_id;
  if found then
    if v_receipt.request_hash is distinct from btrim(p_request_hash) then
      raise exception 'IDEMPOTENCY_CONFLICT' using errcode = '22023';
    end if;
    entity_id := v_receipt.entity_id;
    action := v_receipt.action;
    record_revision := v_receipt.record_revision;
    operation_id := v_receipt.operation_id;
    audit_no := v_receipt.audit_no;
    seq := v_receipt.seq;
    inserted := false;
    idempotent := true;
    return next;
    return;
  end if;

  select * into v_prev from public.dk_veiculos v where v.id = v_id for update;
  if v_action = 'create' then
    if found and v_prev.deleted_at is null then
      raise exception 'veiculo_ja_existe' using errcode = '23505';
    end if;
    if p_expected_updated_at is not null then
      raise exception 'revisao_create_invalida' using errcode = '22023';
    end if;
  else
    if not found or v_prev.deleted_at is not null then
      raise exception 'veiculo_ausente' using errcode = 'P0002';
    end if;
    if p_expected_updated_at is null or v_prev.updated_at is distinct from p_expected_updated_at then
      raise exception 'revisao_conflito' using errcode = '40001';
    end if;
  end if;

  if exists (
    select 1 from public.dk_veiculos v
    where v.placa = v_placa and v.deleted_at is null and v.id is distinct from v_id
  ) then
    raise exception 'placa_duplicada' using errcode = '23505';
  end if;

  insert into public.dk_veiculos (id, placa, payload, created_at, updated_at, deleted_at)
  values (v_id, v_placa, p_payload, coalesce(v_prev.created_at, v_now), v_now, null)
  on conflict (id) do update
    set placa = excluded.placa,
        payload = excluded.payload,
        updated_at = excluded.updated_at,
        deleted_at = null
  returning public.dk_veiculos.updated_at into v_now;
  v_inserted := (v_action = 'create');

  v_event_type := case when v_action = 'create' then 'veiculo.created' else 'veiculo.updated' end;

  perform 1 from public.dk_append_event(
    p_operation_id,
    v_event_type,
    'veiculo',
    v_id,
    v_action,
    null,
    'veiculos',
    null,
    null,
    p_actor_user_id,
    p_actor_session_id,
    p_event_payload,
    coalesce(nullif(btrim(p_visibility), ''), 'team')
  );

  select ev.audit_no, ev.seq into v_audit, v_seq
  from public.dk_events ev
  where ev.operation_id = p_operation_id;

  if v_seq is null then
    raise exception 'evento_nao_confirmado' using errcode = 'P0001';
  end if;

  insert into public.dk_mutation_receipt (
    operation_id, domain, entity_id, action, request_hash, audit_no, seq, record_revision
  ) values (
    p_operation_id, 'veiculo', v_id, v_action, btrim(p_request_hash), v_audit, v_seq, v_now
  );

  entity_id := v_id;
  action := v_action;
  record_revision := v_now;
  operation_id := p_operation_id;
  audit_no := v_audit;
  seq := v_seq;
  inserted := v_inserted;
  idempotent := false;
  return next;
end;
$$;

revoke all on function public.dk_cliente_mutate_with_event(
  uuid, text, text, text, jsonb, timestamptz, text, text, uuid, jsonb, text
) from public, anon, authenticated;
grant execute on function public.dk_cliente_mutate_with_event(
  uuid, text, text, text, jsonb, timestamptz, text, text, uuid, jsonb, text
) to service_role;

revoke all on function public.dk_veiculo_mutate_with_event(
  uuid, text, text, text, jsonb, timestamptz, text, text, uuid, jsonb, text
) from public, anon, authenticated;
grant execute on function public.dk_veiculo_mutate_with_event(
  uuid, text, text, text, jsonb, timestamptz, text, text, uuid, jsonb, text
) to service_role;

-- Também precisa EXECUTE em dk_append_event para service_role (se ainda não houver)
grant execute on function public.dk_append_event(
  uuid, text, text, text, text, bigint, text, text, text, text, uuid, jsonb, text
) to service_role;

notify pgrst, 'reload schema';
