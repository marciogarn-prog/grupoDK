-- Sinal de novidade. Não envia a linha do evento.
-- Se o transporte falhar, o evento durável continua válido.
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
      jsonb_build_object('seq', new.seq, 'kind', 'dk_event'),
      'dk_event',
      'dk:events',
      true,
      'broadcast'
    );
  exception
    when others then
      raise warning 'dk_events_broadcast_seq_ignorado';
  end;
  return null;
end;
$$;

revoke all on function public.dk_events_broadcast_seq() from public, anon, authenticated, service_role;

-- realtime.messages está particionada e, nesta base, não tinha partição.
-- O papel postgres não pode criar partição nesse schema.
-- O INSERT abaixo falha com segurança e o evento durável continua.

do $$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgname = 'dk_events_broadcast_seq'
      and tgrelid = 'public.dk_events'::regclass
  ) then
    create trigger dk_events_broadcast_seq
      after insert on public.dk_events
      for each row
      execute function public.dk_events_broadcast_seq();
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policy p
    join pg_class c on c.oid = p.polrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'realtime'
      and c.relname = 'messages'
      and p.polname = 'dk_events_broadcast_ler'
  ) then
    create policy dk_events_broadcast_ler
      on realtime.messages
      for select
      to authenticated
      using (
        extension = 'broadcast'
        and topic = 'dk:events'
        and realtime.topic() = 'dk:events'
      );
  end if;
end $$;
