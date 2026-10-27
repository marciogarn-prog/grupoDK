-- Cadastro de clientes: uma linha por cliente.
-- Não usa public.dk_cloud_snapshots.
-- Rode uma vez no SQL Editor do Supabase. Pode rodar de novo: create if not exists.
-- anon e authenticated não leem esta tabela. A API da Vercel usa a chave de serviço.

create extension if not exists pgcrypto;

create table if not exists public.dk_clientes (
  id text primary key,
  cpf text not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index if not exists dk_clientes_cpf_ativo_idx
  on public.dk_clientes (cpf)
  where deleted_at is null;

create index if not exists dk_clientes_updated_at_idx
  on public.dk_clientes (updated_at);

comment on table public.dk_clientes is
  'Um cliente por linha. A fonte oficial do cadastro de clientes é esta tabela. O snapshot default não é lido nem gravado por este módulo.';

alter table public.dk_clientes enable row level security;

revoke all on table public.dk_clientes from public, anon, authenticated;
grant select, insert, update on table public.dk_clientes to service_role;

notify pgrst, 'reload schema';
