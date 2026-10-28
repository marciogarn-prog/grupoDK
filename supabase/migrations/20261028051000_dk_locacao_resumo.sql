-- Resumo de pesquisa. Nao copia locacao e nao inclui pagamentos.
-- anon e authenticated nao leem. A API usa a chave de servico.

create or replace view public.dk_locacao_resumo
with (security_invoker = true) as
select
  numero_contrato,
  cpf,
  placa,
  status_locacao,
  coalesce(nullif(btrim(campos->>'nome'), ''), nullif(btrim(campos->>'cliente'), '')) as nome,
  coalesce(campos->>'contratoCancelado' = 'true', false) as contrato_cancelado,
  nullif(btrim(campos->>'fim'), '') as fim,
  nullif(btrim(campos->>'dataFim'), '') as data_fim,
  nullif(btrim(campos->>'dataFinalizacao'), '') as data_finalizacao,
  nullif(btrim(campos->>'dtFim'), '') as dt_fim,
  nullif(campos->>'portalLocacaoFinalizadoEmMs', '') as finalizado_em_ms,
  nullif(btrim(campos->>'status'), '') as status_json
from public.dk_locacao
where deleted_at is null;

comment on view public.dk_locacao_resumo is
  'Resumo para pesquisa. Nao e tabela. Nao contem pagamentos nem o jsonb completo.';

revoke all on table public.dk_locacao_resumo from public;
revoke all on table public.dk_locacao_resumo from anon;
revoke all on table public.dk_locacao_resumo from authenticated;
grant select on table public.dk_locacao_resumo to service_role;
