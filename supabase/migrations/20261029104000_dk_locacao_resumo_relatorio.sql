-- O relatorio de rotatividade le o resumo, nao o jsonb inteiro.
-- Estes campos sao escalares do cadastro. Pagamentos continuam de fora.

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
  nullif(btrim(campos->>'status'), '') as status_json,
  coalesce(nullif(btrim(campos->>'inicio'), ''), nullif(btrim(campos->>'dataInicio'), '')) as inicio,
  coalesce(
    nullif(btrim(campos->>'marcaModelo'), ''),
    nullif(btrim(campos->>'modelo'), ''),
    nullif(btrim(campos->>'veiculo'), '')
  ) as marca_modelo,
  nullif(btrim(campos->>'valorLocacao'), '') as valor_locacao,
  coalesce(nullif(btrim(campos->>'valorInvestimento'), ''), nullif(btrim(campos->>'investimento'), '')) as valor_investimento,
  coalesce(nullif(btrim(campos->>'valorSemanal'), ''), nullif(btrim(campos->>'valorParcela'), '')) as valor_semanal,
  nullif(btrim(campos->>'plano'), '') as plano,
  nullif(btrim(campos->>'modalidade'), '') as modalidade,
  coalesce(nullif(btrim(campos->>'diaPagto'), ''), nullif(btrim(campos->>'diaPagamento'), '')) as dia_pagto,
  nullif(btrim(campos->>'kmInicial'), '') as km_inicial,
  nullif(btrim(campos->>'clienteCodigo'), '') as cliente_codigo,
  coalesce(
    nullif(btrim(campos->>'portalLocacaoFinalizadoPorNome'), ''),
    nullif(btrim(campos->>'cadastradoPorNome'), '')
  ) as finalizado_por_nome,
  coalesce(
    nullif(btrim(campos->>'portalLocacaoExecutadoPorNome'), ''),
    nullif(btrim(campos->>'cadastradoPorNome'), '')
  ) as executado_por_nome,
  nullif(campos->>'portalLocacaoExecutadoEmMs', '') as executado_em_ms
from public.dk_locacao
where deleted_at is null;

comment on view public.dk_locacao_resumo is
  'Resumo para pesquisa e relatorios. Nao e tabela. Nao contem pagamentos nem o jsonb completo.';

revoke all on table public.dk_locacao_resumo from public;
revoke all on table public.dk_locacao_resumo from anon;
revoke all on table public.dk_locacao_resumo from authenticated;
grant select on table public.dk_locacao_resumo to service_role;

notify pgrst, 'reload schema';
