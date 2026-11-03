-- =============================================================================
-- PENDENTE — NÃO APLICAR EM PRODUÇÃO sem autorização explícita humana.
-- =============================================================================
-- Impedimento atual (código):
--   dk_*_mutate_with_event chama dk_append_event(..., p_empresa_id := null, p_filial_id := null).
--   Trigger atual publica só em topic 'dk:events'.
--   Sem empresa_id preenchido + tópico por empresa, isolamento multi-empresa é inseguro.
--
-- Pré-requisitos de ativação:
-- 1) Mutações passam empresa_id/filial_id reais (não inventar)
-- 2) Trigger Broadcast usa NEW.empresa_id no topic dk:events:{empresa}
-- 3) ES256 importado + Current; secrets Vercel; DK_REALTIME_SCOPE_ISOLATION=1
-- 4) DROP da policy permissiva antiga (OR PostgreSQL abre buraco)
-- 5) Backup físico + restauração pós-cutover comprovada
--
-- Filial: eventos atuais não têm filtro de filial comprovado no Broadcast.
-- Isolamento de filial, se necessário, no catch-up/API (servidor), não no sinal.
-- =============================================================================

begin;

-- A) Trigger: publicar só com empresa válida; tópico por empresa
create or replace function public.dk_events_broadcast_seq()
returns trigger
language plpgsql
security definer
set search_path = public, realtime
as $$
declare
  v_emp text;
  v_topic text;
  v_payload jsonb;
begin
  v_emp := lower(nullif(btrim(coalesce(new.empresa_id, '')), ''));
  if v_emp is null or v_emp not in ('locadora', 'centro', 'construtora') then
    -- Evento durável permanece; sem sinal se escopo ausente (não abrir canal partilhado).
    return null;
  end if;
  v_topic := 'dk:events:' || v_emp;
  v_payload := jsonb_build_object(
    'kind', 'dk_event',
    'seq', new.seq,
    'audit_no', new.audit_no,
    'event_type', new.event_type,
    'entity_type', new.entity_type,
    'entity_id', new.entity_id,
    'module', new.module,
    'empresa_id', v_emp
  );
  perform set_config('realtime.topic', v_topic, true);
  insert into realtime.messages (topic, extension, payload, event, private)
  values (v_topic, 'broadcast', v_payload, 'dk_event', true);
  return null;
end;
$$;

-- B) Remover policies permissivas antigas (OR com policy frouxa = buraco)
drop policy if exists dk_events_broadcast_ler on realtime.messages;
drop policy if exists dk_events_broadcast_ler_dk on realtime.messages;
drop policy if exists dk_events_broadcast_sem_write_cliente on realtime.messages;

-- C) Leitura: só tópico da empresa do JWT; sem OR com policy aberta
create policy dk_events_broadcast_ler_dk
  on realtime.messages
  for select
  to authenticated
  using (
    extension = 'broadcast'
    and coalesce((auth.jwt() ->> 'dk_portal')::boolean, false) = true
    and nullif(auth.jwt() ->> 'dk_sid', '') is not null
    and coalesce(auth.jwt() ->> 'role', '') = 'authenticated'
    and coalesce(auth.jwt() ->> 'dk_empresa', '') in ('locadora', 'centro', 'construtora')
    and topic = ('dk:events:' || (auth.jwt() ->> 'dk_empresa'))
    and realtime.topic() = topic
  );

-- D) Browser não publica
create policy dk_events_broadcast_sem_write_cliente
  on realtime.messages
  for insert
  to authenticated
  with check (false);

-- Anónimos: sem grant/policy de select em realtime.messages (não criar).

-- Rollback (manual):
--   1) restaurar função/trigger de supabase/dk-events-broadcast.sql
--   2) drop policy dk_events_broadcast_ler_dk;
--   3) recriar policy permissiva antiga se necessário
--   4) DK_REALTIME_SINAL=0; DK_REALTIME_SCOPE_ISOLATION=0; DK_REALTIME_ES256_TRUSTED=0

-- NÃO COMMITAR EM PRODUÇÃO NESTA EXECUÇÃO — desfazer:
rollback;
