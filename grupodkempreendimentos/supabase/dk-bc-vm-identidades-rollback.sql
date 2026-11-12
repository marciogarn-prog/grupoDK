-- Rollback seguro da estrutura 04/10 (somente após backup verificado).
-- Não remove dk_bc_registro / contador central.

drop function if exists public.dk_bc_vm_estado(text);
drop function if exists public.dk_bc_vm_emitir_provisorio(uuid, text, jsonb);
drop function if exists public.dk_bc_vm_format(text, bigint);
drop function if exists public.dk_bc_vm_state_proteger();

drop table if exists public.dk_bc_vm_operacao;
drop table if exists public.dk_bc_vm_state;
drop table if exists public.dk_bc_vm;
