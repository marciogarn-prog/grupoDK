-- Gravador idempotente do Log. Não altera cadastros.
-- O navegador não executa esta função.
create or replace function public.dk_append_event(
  p_operation_id uuid,
  p_event_type text,
  p_entity_type text,
  p_entity_id text,
  p_action text,
  p_record_version bigint,
  p_module text,
  p_empresa_id text,
  p_filial_id text,
  p_actor_user_id text,
  p_actor_session_id uuid,
  p_payload jsonb,
  p_visibility text
)
returns table (
  seq bigint,
  created_at timestamptz,
  operation_id uuid,
  event_type text
)
language plpgsql
security invoker
set search_path = public
as $$
#variable_conflict use_column
declare
  v_seq bigint;
  v_created timestamptz;
  v_type text;
begin
  if p_operation_id is null then
    raise exception 'operation_id_ausente' using errcode = '22023';
  end if;
  if p_event_type is null or btrim(p_event_type) = '' then
    raise exception 'event_type_vazio' using errcode = '22023';
  end if;
  if p_entity_type is null or btrim(p_entity_type) = '' then
    raise exception 'entity_type_vazio' using errcode = '22023';
  end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'payload_invalido' using errcode = '22023';
  end if;

  insert into public.dk_events (
    operation_id,
    event_type,
    entity_type,
    entity_id,
    action,
    record_version,
    module,
    empresa_id,
    filial_id,
    actor_user_id,
    actor_session_id,
    payload,
    visibility
  ) values (
    p_operation_id,
    btrim(p_event_type),
    btrim(p_entity_type),
    p_entity_id,
    p_action,
    p_record_version,
    p_module,
    p_empresa_id,
    p_filial_id,
    p_actor_user_id,
    p_actor_session_id,
    p_payload,
    p_visibility
  )
  on conflict (operation_id) do nothing
  returning dk_events.seq, dk_events.created_at, dk_events.event_type
  into v_seq, v_created, v_type;

  if v_seq is null then
    select e.seq, e.created_at, e.event_type
      into v_seq, v_created, v_type
    from public.dk_events e
    where e.operation_id = p_operation_id;
  end if;

  if v_seq is null then
    raise exception 'evento_nao_confirmado' using errcode = 'P0001';
  end if;

  seq := v_seq;
  created_at := v_created;
  operation_id := p_operation_id;
  event_type := v_type;
  return next;
end;
$$;

revoke all on function public.dk_append_event(
  uuid, text, text, text, text, bigint, text, text, text, text, uuid, jsonb, text
) from public, anon, authenticated, service_role;
