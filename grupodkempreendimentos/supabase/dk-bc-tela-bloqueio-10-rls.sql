-- COMANDO 10/10 — RLS e menor privilégio nas tabelas de bloqueio (aditivo).
-- Não altera dados BC. Não ativa telas. Não atribui colaboradores.

alter table public.dk_bc_tela_bloqueio enable row level security;
alter table public.dk_bc_tela_bloqueio_geracao enable row level security;
alter table public.dk_bc_tela_bloqueio_audit enable row level security;

alter table public.dk_bc_tela_bloqueio force row level security;
alter table public.dk_bc_tela_bloqueio_geracao force row level security;
alter table public.dk_bc_tela_bloqueio_audit force row level security;

-- Sem políticas para anon/authenticated: acesso direto bloqueado.
-- service_role bypassa RLS; funções SECURITY INVOKER com grants apenas a service_role.

revoke all on table public.dk_bc_tela_bloqueio from public, anon, authenticated;
revoke all on table public.dk_bc_tela_bloqueio_geracao from public, anon, authenticated;
revoke all on table public.dk_bc_tela_bloqueio_audit from public, anon, authenticated;

grant select, insert, update on public.dk_bc_tela_bloqueio to service_role;
grant select, insert, update on public.dk_bc_tela_bloqueio_geracao to service_role;
grant select, insert on public.dk_bc_tela_bloqueio_audit to service_role;
grant usage, select on sequence public.dk_bc_tela_bloqueio_audit_id_seq to service_role;

revoke all on function public.dk_bc_tela_bloqueio_consultar(text, text, text) from public, anon, authenticated;
revoke all on function public.dk_bc_tela_bloqueio_adquirir(text, text, text, text, text, text, integer) from public, anon, authenticated;
revoke all on function public.dk_bc_tela_bloqueio_renovar(text, text, text, text, uuid, bigint, integer) from public, anon, authenticated;
revoke all on function public.dk_bc_tela_bloqueio_liberar(text, text, text, text, uuid, bigint) from public, anon, authenticated;
revoke all on function public.dk_bc_tela_bloqueio_validar(text, text, text, text, uuid, bigint) from public, anon, authenticated;

grant execute on function public.dk_bc_tela_bloqueio_consultar(text, text, text) to service_role;
grant execute on function public.dk_bc_tela_bloqueio_adquirir(text, text, text, text, text, text, integer) to service_role;
grant execute on function public.dk_bc_tela_bloqueio_renovar(text, text, text, text, uuid, bigint, integer) to service_role;
grant execute on function public.dk_bc_tela_bloqueio_liberar(text, text, text, text, uuid, bigint) to service_role;
grant execute on function public.dk_bc_tela_bloqueio_validar(text, text, text, text, uuid, bigint) to service_role;
