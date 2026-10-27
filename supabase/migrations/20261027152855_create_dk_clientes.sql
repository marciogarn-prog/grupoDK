-- Cadastro de clientes: uma linha por cliente.
-- Nao altera public.dk_cloud_snapshots.
-- anon e authenticated nao leem esta tabela. A API da Vercel usa a chave de servico.

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

alter table public.dk_clientes enable row level security;

revoke all on table public.dk_clientes from public, anon, authenticated;
grant select, insert, update on table public.dk_clientes to service_role;

notify pgrst, 'reload schema';
