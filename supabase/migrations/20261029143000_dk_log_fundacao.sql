-- Fundação do Log DK. Aditiva. Não altera clientes, veículos, locações nem pagamentos.
-- audit_no é contador transacional. Não usa sequence.

alter table public.dk_events add column if not exists audit_no bigint;
alter table public.dk_events add column if not exists result text;
alter table public.dk_events add column if not exists severity text;
alter table public.dk_events add column if not exists actor_name_snapshot text;
alter table public.dk_events add column if not exists actor_role_snapshot text;
alter table public.dk_events add column if not exists device_label text;
alter table public.dk_events add column if not exists context jsonb;
alter table public.dk_events add column if not exists details jsonb;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'dk_events_result_check') then
    alter table public.dk_events add constraint dk_events_result_check
      check (result is null or result in ('success', 'denied', 'cancelled', 'rollback_confirmed'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'dk_events_severity_check') then
    alter table public.dk_events add constraint dk_events_severity_check
      check (severity is null or severity in ('info', 'warning', 'critical'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'dk_events_context_object') then
    alter table public.dk_events add constraint dk_events_context_object
      check (context is null or jsonb_typeof(context) = 'object');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'dk_events_details_object') then
    alter table public.dk_events add constraint dk_events_details_object
      check (details is null or jsonb_typeof(details) = 'object');
  end if;
end $$;

do $$
declare
  n int;
begin
  if exists (select 1 from public.dk_events where audit_no is not null) then
    return;
  end if;
  select count(*) into n from public.dk_events;
  if n <> 2 then
    raise exception 'eventos_inesperados_parar_backfill';
  end if;
  if not exists (
    select 1 from public.dk_events
    where seq = 3 and event_type = 'system.log_initialized'
  ) then
    raise exception 'evento_seq3_ausente';
  end if;
  if not exists (
    select 1 from public.dk_events
    where seq = 12 and event_type = 'system.realtime_initialized'
  ) then
    raise exception 'evento_seq12_ausente';
  end if;
  update public.dk_events
     set audit_no = 1,
         result = 'success',
         severity = 'info',
         actor_name_snapshot = 'Sistema',
         actor_role_snapshot = 'sistema',
         device_label = 'servidor',
         details = '{"summary":"Log inicializado"}'::jsonb
   where seq = 3;
  update public.dk_events
     set audit_no = 2,
         result = 'success',
         severity = 'info',
         actor_name_snapshot = 'Sistema',
         actor_role_snapshot = 'sistema',
         device_label = 'servidor',
         details = '{"summary":"Realtime inicializado"}'::jsonb
   where seq = 12;
end $$;

alter table public.dk_events alter column audit_no set not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'dk_events_audit_no_unique') then
    alter table public.dk_events add constraint dk_events_audit_no_unique unique (audit_no);
  end if;
end $$;

create index if not exists dk_events_created_at_idx on public.dk_events (created_at desc);
create index if not exists dk_events_actor_idx on public.dk_events (actor_user_id);
create index if not exists dk_events_module_idx on public.dk_events (module);
create index if not exists dk_events_entity_idx on public.dk_events (entity_type, entity_id);

create table if not exists public.dk_audit_state (
  id smallint primary key,
  last_audit_no bigint not null,
  updated_at timestamptz not null default now(),
  constraint dk_audit_state_unica check (id = 1)
);

insert into public.dk_audit_state (id, last_audit_no)
values (1, (select max(audit_no) from public.dk_events))
on conflict (id) do nothing;

create table if not exists public.dk_live_sessions (
  session_id text primary key,
  user_id text not null,
  user_name text,
  role text,
  device_label text,
  session_started_at timestamptz not null default now(),
  last_activity_at timestamptz not null default now(),
  current_screen text,
  status text not null default 'ONLINE',
  browser text,
  os_name text,
  constraint dk_live_sessions_status check (status in ('ONLINE', 'INATIVO', 'RECONECTANDO', 'EXPIRADO', 'OFFLINE'))
);

create or replace function public.dk_events_imutavel()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'evento_imutavel';
  end if;
  if new.audit_no is distinct from old.audit_no
     or new.operation_id is distinct from old.operation_id
     or new.created_at is distinct from old.created_at
     or new.seq is distinct from old.seq
     or new.actor_name_snapshot is distinct from old.actor_name_snapshot
     or new.actor_role_snapshot is distinct from old.actor_role_snapshot
  then
    raise exception 'evento_imutavel';
  end if;
  return new;
end;
$$;

drop trigger if exists dk_events_imutavel on public.dk_events;
create trigger dk_events_imutavel
  before update or delete on public.dk_events
  for each row
  execute function public.dk_events_imutavel();

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
  v_audit bigint;
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

  perform 1 from public.dk_audit_state where id = 1 for update;

  select e.seq, e.created_at, e.event_type
    into v_seq, v_created, v_type
  from public.dk_events e
  where e.operation_id = p_operation_id;

  if v_seq is not null then
    seq := v_seq;
    created_at := v_created;
    operation_id := p_operation_id;
    event_type := v_type;
    return next;
    return;
  end if;

  update public.dk_audit_state
     set last_audit_no = last_audit_no + 1,
         updated_at = now()
   where id = 1
  returning last_audit_no into v_audit;

  if v_audit is null then
    raise exception 'contador_ausente' using errcode = 'P0001';
  end if;

  insert into public.dk_events (
    operation_id, event_type, entity_type, entity_id, action, record_version,
    module, empresa_id, filial_id, actor_user_id, actor_session_id, payload, visibility,
    audit_no, result, severity
  ) values (
    p_operation_id, btrim(p_event_type), btrim(p_entity_type), p_entity_id, p_action, p_record_version,
    p_module, p_empresa_id, p_filial_id, p_actor_user_id, p_actor_session_id, p_payload, p_visibility,
    v_audit, 'success', 'info'
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

create or replace function public.dk_presenca_tocar(
  p_session_id text,
  p_user_id text,
  p_user_name text,
  p_role text,
  p_device_label text,
  p_screen text,
  p_status text,
  p_browser text,
  p_os text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_session_id is null or btrim(p_session_id) = '' then
    return;
  end if;
  if p_status is null or p_status not in ('ONLINE', 'INATIVO', 'RECONECTANDO', 'EXPIRADO', 'OFFLINE') then
    p_status := 'ONLINE';
  end if;
  insert into public.dk_live_sessions (
    session_id, user_id, user_name, role, device_label, current_screen, status, browser, os_name
  ) values (
    btrim(p_session_id),
    coalesce(nullif(btrim(p_user_id), ''), 'sessao'),
    nullif(btrim(p_user_name), ''),
    nullif(btrim(p_role), ''),
    nullif(btrim(p_device_label), ''),
    nullif(btrim(p_screen), ''),
    p_status,
    nullif(btrim(p_browser), ''),
    nullif(btrim(p_os), '')
  )
  on conflict (session_id) do update
    set user_name = coalesce(excluded.user_name, public.dk_live_sessions.user_name),
        role = coalesce(excluded.role, public.dk_live_sessions.role),
        device_label = coalesce(excluded.device_label, public.dk_live_sessions.device_label),
        current_screen = coalesce(excluded.current_screen, public.dk_live_sessions.current_screen),
        status = excluded.status,
        last_activity_at = now(),
        browser = coalesce(public.dk_live_sessions.browser, excluded.browser),
        os_name = coalesce(public.dk_live_sessions.os_name, excluded.os_name);
end;
$$;

revoke all on function public.dk_presenca_tocar(text, text, text, text, text, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.dk_presenca_tocar(text, text, text, text, text, text, text, text, text)
  to service_role;

revoke all on table public.dk_audit_state from public, anon, authenticated;
grant select on table public.dk_audit_state to service_role;

revoke all on table public.dk_live_sessions from public, anon, authenticated;
grant select on table public.dk_live_sessions to service_role;

alter table public.dk_audit_state enable row level security;
alter table public.dk_live_sessions enable row level security;

revoke insert, update, delete on table public.dk_events from anon, authenticated;
revoke insert, update, delete on table public.dk_audit_state from anon, authenticated, service_role;
revoke insert, update, delete on table public.dk_live_sessions from anon, authenticated;

notify pgrst, 'reload schema';
