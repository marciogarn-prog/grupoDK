-- COMANDO 10/10 — Classificação complementar empresa/filial (aditiva).
-- NÃO altera dk_bc_registro histórico. NÃO inventa associações.
-- Registros sem evidência permanecem pendentes e fora da distribuição operacional.

create table if not exists public.dk_bc_registro_classificacao (
  bc_id text primary key references public.dk_bc_registro(bc_id),
  bc_no bigint not null,
  empresa_id text,
  filial_id text,
  status text not null default 'pendente'
    check (status in ('classificado', 'classificavel_evidencia', 'pendente', 'rejeitado')),
  evidencia jsonb not null default '{}'::jsonb,
  versao integer not null default 1,
  classificado_em timestamptz,
  classificado_por text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (status = 'classificado' and empresa_id is not null and btrim(empresa_id) <> '' and filial_id is not null and btrim(filial_id) <> '')
    or (status <> 'classificado')
  )
);

create index if not exists dk_bc_registro_classificacao_status_idx
  on public.dk_bc_registro_classificacao (status);

create index if not exists dk_bc_registro_classificacao_escopo_idx
  on public.dk_bc_registro_classificacao (empresa_id, filial_id)
  where status = 'classificado';

-- Bootstrap: um espelho pendente por BC vigente sem inventar empresa/filial.
insert into public.dk_bc_registro_classificacao (bc_id, bc_no, status, evidencia)
select r.bc_id, r.bc_no, 'pendente',
       jsonb_build_object(
         'motivo', 'empresa_filial_ausentes_no_catalogo_e_payload',
         'origem', r.origem,
         'registro_id', r.registro_id
       )
  from public.dk_bc_registro r
 where r.vigente = true
on conflict (bc_id) do nothing;

create or replace function public.dk_bc_classificacao_resumo()
returns table (
  total_vigentes bigint,
  classificados bigint,
  classificaveis_evidencia bigint,
  pendentes bigint,
  rejeitados bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    (select count(*) from public.dk_bc_registro where vigente)::bigint,
    (select count(*) from public.dk_bc_registro_classificacao where status = 'classificado')::bigint,
    (select count(*) from public.dk_bc_registro_classificacao where status = 'classificavel_evidencia')::bigint,
    (select count(*) from public.dk_bc_registro_classificacao where status = 'pendente')::bigint,
    (select count(*) from public.dk_bc_registro_classificacao where status = 'rejeitado')::bigint;
$$;

-- Sincronização/consulta: BC sem classificação classificada permanece indisponível.
create or replace function public.dk_bc_classificacao_permite_distribuicao(p_bc_id text)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select exists (
    select 1 from public.dk_bc_registro_classificacao c
     where c.bc_id = p_bc_id and c.status = 'classificado'
  );
$$;

alter table public.dk_bc_registro_classificacao enable row level security;
alter table public.dk_bc_registro_classificacao force row level security;
revoke all on table public.dk_bc_registro_classificacao from public, anon, authenticated;
grant select, insert, update on public.dk_bc_registro_classificacao to service_role;
grant execute on function public.dk_bc_classificacao_resumo() to service_role;
grant execute on function public.dk_bc_classificacao_permite_distribuicao(text) to service_role;
