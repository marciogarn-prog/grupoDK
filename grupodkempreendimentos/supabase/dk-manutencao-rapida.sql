-- Manutenção rápida. Uma linha por id do lançamento.
-- Não lê nem altera public.dk_cloud_snapshots, nem o campo dk_manutencoes_rapidas_v1.
-- Não mexe no Redis.
-- Não altera dk_equipa_presenca, dk_cliente_geo, dk_locacao nem qualquer outra tabela.
-- Rode uma vez no SQL Editor do Supabase. Pode rodar de novo: create if not exists.
-- anon e authenticated não acessam estas tabelas. A API da Vercel usa a chave de serviço.
-- Este script não liga o caminho novo. A API só o usa com DK_MANUTENCOES_RAPIDAS_PG=1.
-- O objeto do lançamento fica inteiro em registro. A resposta da API devolve esse objeto.

create table if not exists public.dk_manutencao_rapida (
  id text primary key,
  registro jsonb not null,
  ordem bigint not null,
  updated_at timestamptz not null default now()
);

create index if not exists dk_manutencao_rapida_ordem_idx
  on public.dk_manutencao_rapida (ordem);

comment on table public.dk_manutencao_rapida is
  'Lançamentos da manutenção rápida, um por id. A lista segue a coluna ordem. O snapshot default não é alterado por este script.';

alter table public.dk_manutencao_rapida enable row level security;

revoke all on table public.dk_manutencao_rapida from public, anon, authenticated;
grant select, insert, update on table public.dk_manutencao_rapida to service_role;

-- Decisão da cópia inicial. Se a tabela já tiver linha, a cópia automática não corre.

create table if not exists public.dk_manutencao_rapida_migracao (
  id integer primary key check (id = 1),
  estado text not null check (estado in ('copiada', 'origem_vazia', 'nao_migrar', 'ja_tinha_dados')),
  copiados integer not null default 0 check (copiados >= 0),
  updated_at timestamptz not null default now()
);

comment on table public.dk_manutencao_rapida_migracao is
  'Estado da cópia inicial da manutenção rápida. nao_migrar significa que a API deve continuar no snapshot. Este script não apaga lançamentos.';

alter table public.dk_manutencao_rapida_migracao enable row level security;

revoke all on table public.dk_manutencao_rapida_migracao from public, anon, authenticated;
grant select, insert, update on table public.dk_manutencao_rapida_migracao to service_role;

notify pgrst, 'reload schema';
