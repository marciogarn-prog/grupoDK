-- PROPOSTA RELACIONAL FUTURA — Manutenção
-- NÃO APLICAR nesta fase. Somente documentação/contrato.
-- Representa 390/390 (28 histórico + 362 rápidas) sem fundir formatos.

-- public.dk_manutencao
--   id text primary key
--   formato text not null check (formato in ('historico','rapida'))
--   placa text
--   veiculo_id text null  -- FK lógica a public.dk_veiculos; não sobrescreve payload histórico
--   payload jsonb not null  -- 100% das chaves atuais (checklists, peças, formas, etc.)
--   version integer not null default 1
--   operation_id uuid null unique
--   created_at timestamptz
--   updated_at timestamptz
--   deleted_at timestamptz null

-- public.dk_manutencao_documento
--   id text primary key
--   manutencao_id text not null references public.dk_manutencao(id)
--   document_type text
--   mime text
--   bytes bigint
--   sha256 text
--   reference text  -- storage path; bytes NÃO vão para dk_events

-- Regras futuras:
-- 1) mutation + dk_event na mesma transação PostgreSQL
-- 2) histórico concluído não sobrescreve silenciosamente (version + operation_id)
-- 3) lista resumida nunca substitui detail
-- 4) ausência ≠ null ≠ 0 ≠ ""
-- 5) não normalizar estética em 15 tabelas

select 'dk-manutencao-modelo-futuro: proposta apenas — não aplicar'::text as aviso;
