-- =============================================================================
-- PENDENTE — NÃO APLICAR sem autorização explícita + backup/rollback.
-- Estratégia única: canal privado global sanitizado dk:events
-- Sinal: { kind: 'dk_changed', seq } — sem PII.
-- Dados: /api/dk-sync autenticado.
-- =============================================================================

begin;

create or replace function public.dk_events_broadcast_seq()
returns trigger
language plpgsql
security invoker
set search_path = public, realtime
as $$
begin
  begin
    execute 'set local realtime.topic to ''dk:events''';
    insert into realtime.messages (id, payload, event, topic, private, extension)
    values (
      gen_random_uuid(),
      jsonb_build_object('kind', 'dk_changed', 'seq', new.seq),
      'dk_changed',
      'dk:events',
      true,
      'broadcast'
    );
  exception
    when others then
      -- Falha do transporte NÃO aborta mutation nem evento durável.
      raise warning 'dk_events_broadcast_seq_ignorado';
  end;
  return null;
end;
$$;

drop policy if exists dk_events_broadcast_ler on realtime.messages;
drop policy if exists dk_events_broadcast_ler_dk on realtime.messages;
drop policy if exists dk_events_broadcast_sem_write_cliente on realtime.messages;

create policy dk_events_broadcast_ler_dk
  on realtime.messages
  for select
  to authenticated
  using (
    extension = 'broadcast'
    and coalesce((auth.jwt() ->> 'dk_portal')::boolean, false) = true
    and nullif(auth.jwt() ->> 'dk_sid', '') is not null
    and coalesce(auth.jwt() ->> 'role', '') = 'authenticated'
    and topic = 'dk:events'
    and realtime.topic() = 'dk:events'
  );

create policy dk_events_broadcast_sem_write_cliente
  on realtime.messages
  for insert
  to authenticated
  with check (false);

-- Rollback desta sessão (não aplicar em produção nesta execução):
rollback;
