-- Cadastro de veiculos: uma linha por veiculo.
-- Copia de dk_veiculos_cadastro. Nao altera o snapshot, o Redis nem liga a fonte nova.
-- anon e authenticated nao leem esta tabela. A API da Vercel usa a chave de servico.

create table if not exists public.dk_veiculos (
  id text primary key,
  placa text,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index if not exists dk_veiculos_placa_ativa_idx
  on public.dk_veiculos (placa)
  where deleted_at is null
    and placa is not null
    and btrim(placa) <> '';

alter table public.dk_veiculos enable row level security;

revoke all on table public.dk_veiculos from public;
revoke all on table public.dk_veiculos from anon;
revoke all on table public.dk_veiculos from authenticated;
revoke all on table public.dk_veiculos from service_role;
grant select, insert, update on table public.dk_veiculos to service_role;

notify pgrst, 'reload schema';
