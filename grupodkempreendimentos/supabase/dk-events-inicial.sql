-- Um único fato administrativo: a infraestrutura do Log DK foi inicializada.
-- Repetir este arquivo não cria segunda linha.
insert into public.dk_events (
  operation_id,
  event_type,
  entity_type,
  entity_id,
  action,
  module,
  record_version,
  payload,
  visibility
) values (
  '63a7f3e2-1027-4061-8000-000000000063',
  'system.log_initialized',
  'system',
  'log-dk',
  'initialized',
  'system',
  null,
  '{"message":"Infraestrutura durável do Log DK inicializada"}'::jsonb,
  'admin'
)
on conflict (operation_id) do nothing;
