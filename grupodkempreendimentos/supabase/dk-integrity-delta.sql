-- Delta e checkpoint de integridade. Não altera cadastro.
-- A Golden Baseline continua imutável. O navegador não lê estas tabelas.

create table if not exists public.dk_integrity_deltas (
  id uuid primary key,
  created_at timestamptz not null default now(),
  parent_baseline_id uuid not null references public.dk_integrity_baselines (id),
  delta_type text not null,
  module text not null,
  entity_ref text not null,
  change text not null,
  source_created_at timestamptz not null,
  business_hash text not null,
  raw_hash text not null,
  document_manifest_hash text not null default '',
  constraint dk_integrity_deltas_type_chk check (delta_type in ('business_change')),
  constraint dk_integrity_deltas_change_chk check (change in ('created', 'updated', 'removed'))
);

create table if not exists public.dk_integrity_checkpoints (
  id uuid primary key,
  created_at timestamptz not null default now(),
  parent_baseline_id uuid not null references public.dk_integrity_baselines (id),
  delta_id uuid not null references public.dk_integrity_deltas (id),
  kind text not null,
  manifest_sha256 text not null,
  clientes_count integer not null,
  veiculos_count integer not null,
  locacoes_count integer not null,
  pagamentos_ativos integer not null,
  pagamentos_removidos integer not null,
  quarentena integer not null,
  status text not null,
  constraint dk_integrity_checkpoints_kind_chk check (kind in ('current')),
  constraint dk_integrity_checkpoints_status_chk check (status in ('APPROVED'))
);

alter table public.dk_integrity_deltas enable row level security;
alter table public.dk_integrity_checkpoints enable row level security;

revoke all on table public.dk_integrity_deltas from public, anon, authenticated, service_role;
revoke all on table public.dk_integrity_checkpoints from public, anon, authenticated, service_role;
grant select, insert on table public.dk_integrity_deltas to service_role;
grant select, insert on table public.dk_integrity_checkpoints to service_role;

notify pgrst, 'reload schema';
