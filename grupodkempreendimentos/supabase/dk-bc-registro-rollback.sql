-- Rollback APENAS da infraestrutura BC (não toca dados operacionais).
-- Usar só se a criação de dk_bc_* precisar ser desfeita.
-- NÃO executar em produção sem autorização explícita.

drop function if exists public.dk_bc_estado();
drop function if exists public.dk_bc_rejeitar(uuid, text, text, jsonb);
drop function if exists public.dk_bc_confirmar(
  uuid, text, text, text, text, text, text, text, text, text, text, text, jsonb
);
drop function if exists public.dk_bc_format(bigint);

drop table if exists public.dk_bc_operacao cascade;
drop table if exists public.dk_bc_registro cascade;
drop table if exists public.dk_bc_state cascade;

notify pgrst, 'reload schema';
