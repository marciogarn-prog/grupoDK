-- Rollback APENAS da infraestrutura BC (não toca dados operacionais).
-- Usar só se a criação de dk_bc_* precisar ser desfeita.
-- NÃO executar em produção sem autorização explícita.
-- Procedimento seguro: 1) backup independente verificado 2) DROP abaixo 3) reaplicar SQL se necessário.

drop trigger if exists trg_dk_bc_registro_proteger on public.dk_bc_registro;
drop trigger if exists trg_dk_bc_state_proteger on public.dk_bc_state;

drop function if exists public.dk_bc_estado();
drop function if exists public.dk_bc_rejeitar(uuid, text, text, jsonb);
drop function if exists public.dk_bc_confirmar(
  uuid, text, text, text, text, text, text, text, text, text, text, text, jsonb
);
drop function if exists public.dk_bc_conteudo_hash(
  text, text, text, text, text, text, text, text, text, text, jsonb
);
drop function if exists public.dk_bc_format(bigint);
drop function if exists public.dk_bc_registro_proteger();
drop function if exists public.dk_bc_state_proteger();

drop table if exists public.dk_bc_operacao cascade;
drop table if exists public.dk_bc_registro cascade;
drop table if exists public.dk_bc_state cascade;

notify pgrst, 'reload schema';
