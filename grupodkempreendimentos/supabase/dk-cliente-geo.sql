-- Posição GPS do app do cliente. Uma linha por CPF.
-- Não usa public.dk_cloud_snapshots.
-- Rode uma vez no SQL Editor do Supabase. Pode rodar de novo: create if not exists.
-- anon e authenticated não leem esta tabela. A API da Vercel usa a chave de serviço.

create table if not exists public.dk_cliente_geo (
  cpf text primary key,
  nome text not null default '',
  placa text not null default '',
  protocolo text not null default '',
  lat double precision not null,
  lng double precision not null,
  accuracy double precision,
  heading double precision,
  speed double precision,
  ts bigint not null,
  updated_at timestamptz not null default now()
);

create index if not exists dk_cliente_geo_ts_idx
  on public.dk_cliente_geo (ts desc);

comment on table public.dk_cliente_geo is
  'Última posição GPS de cada cliente. A fonte oficial é esta linha. O snapshot default não é lido nem gravado.';

alter table public.dk_cliente_geo enable row level security;

revoke all on table public.dk_cliente_geo from public, anon, authenticated;
grant select, insert, update on table public.dk_cliente_geo to service_role;

notify pgrst, 'reload schema';
