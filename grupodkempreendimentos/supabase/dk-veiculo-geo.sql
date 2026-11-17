-- Última posição GPS de rastreadores EC33 (GT06). Uma linha por IMEI.
-- Rode uma vez no SQL Editor do Supabase. Pode rodar de novo: create if not exists.
-- A API da Vercel usa a chave de serviço (service_role).

create table if not exists public.dk_veiculo_geo (
  imei text primary key,
  placa text not null default '',
  nome text not null default '',
  protocolo text not null default '',
  modelo text not null default 'EC33',
  lat double precision not null,
  lng double precision not null,
  accuracy double precision,
  heading double precision,
  speed double precision,
  acc boolean,
  ignicao boolean,
  gsm smallint,
  bateria smallint,
  ts bigint not null,
  updated_at timestamptz not null default now()
);

create index if not exists dk_veiculo_geo_ts_idx
  on public.dk_veiculo_geo (ts desc);

create index if not exists dk_veiculo_geo_placa_idx
  on public.dk_veiculo_geo (placa);

comment on table public.dk_veiculo_geo is
  'Última posição GPS de cada rastreador EC33 (chave = IMEI). Fonte: bridge GT06 → API dk-veiculo-geo.';

alter table public.dk_veiculo_geo enable row level security;

revoke all on table public.dk_veiculo_geo from public, anon, authenticated;
grant select, insert, update on table public.dk_veiculo_geo to service_role;

notify pgrst, 'reload schema';
