-- Presença da equipa. Uma linha por CPF.
-- Não lê nem altera public.dk_cloud_snapshots, nem o campo dk_equipa_presenca_v1.
-- Não mexe no Redis.
-- Rode uma vez no SQL Editor do Supabase. Pode rodar de novo: create if not exists.
-- anon e authenticated não acessam estas tabelas. A API da Vercel usa a chave de serviço.
-- Online é quem tiver pulso_em nos últimos 8 minutos. A linha antiga pode ficar.
-- Este script não liga o caminho novo. A API só o usa com DK_EQUIPA_PRESENCA_PG=1.

create table if not exists public.dk_equipa_presenca (
  cpf text primary key,
  nome text not null default '',
  pulso_em timestamptz not null,
  updated_at timestamptz not null default now()
);

create index if not exists dk_equipa_presenca_pulso_em_idx
  on public.dk_equipa_presenca (pulso_em desc);

comment on table public.dk_equipa_presenca is
  'Último pulso de cada CPF da equipa. A consulta de quem está online usa pulso_em na janela de 8 minutos. O snapshot default não é alterado por este script.';

alter table public.dk_equipa_presenca enable row level security;

revoke all on table public.dk_equipa_presenca from public, anon, authenticated;
grant select, insert, update, delete on table public.dk_equipa_presenca to service_role;

-- Decisão da cópia inicial. Impede que um logout (tabela vazia) seja refeito a partir do snapshot.
-- Uma linha só. Não guarda o cadastro da equipa.

create table if not exists public.dk_equipa_presenca_migracao (
  id integer primary key check (id = 1),
  estado text not null check (estado in ('copiada', 'origem_vazia', 'nao_migrar', 'ja_tinha_dados')),
  copiados integer not null default 0 check (copiados >= 0),
  updated_at timestamptz not null default now()
);

comment on table public.dk_equipa_presenca_migracao is
  'Estado da cópia inicial da presença. Não altera o snapshot. nao_migrar significa que a API deve continuar no snapshot.';

alter table public.dk_equipa_presenca_migracao enable row level security;

revoke all on table public.dk_equipa_presenca_migracao from public, anon, authenticated;
grant select, insert, update on table public.dk_equipa_presenca_migracao to service_role;

notify pgrst, 'reload schema';
