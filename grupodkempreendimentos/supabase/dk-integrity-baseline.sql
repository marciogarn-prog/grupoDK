-- Baseline de integridade. Somente aditiva. Sem dado de cliente.
-- O navegador não recebe grant. RLS ligado. service_role grava e lê no servidor.

create extension if not exists pgcrypto;

create table if not exists public.dk_integrity_baselines (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  backup_sha256 text not null,
  manifest_sha256 text not null,
  status text not null,
  clientes_count integer not null,
  veiculos_count integer not null,
  locacoes_count integer not null,
  pagamentos_count integer not null,
  manutencoes_count integer not null,
  documents_count integer not null,
  notes text not null default '',
  constraint dk_integrity_baselines_status_chk check (status in ('APPROVED', 'REJECTED'))
);

create table if not exists public.dk_integrity_record_hashes (
  baseline_id uuid not null references public.dk_integrity_baselines (id),
  module text not null,
  entity_ref text not null,
  raw_hash text not null,
  business_hash text not null,
  primary key (baseline_id, module, entity_ref)
);

alter table public.dk_integrity_baselines enable row level security;
alter table public.dk_integrity_record_hashes enable row level security;

revoke all on table public.dk_integrity_baselines from public, anon, authenticated, service_role;
revoke all on table public.dk_integrity_record_hashes from public, anon, authenticated, service_role;
grant select, insert on table public.dk_integrity_baselines to service_role;
grant select, insert on table public.dk_integrity_record_hashes to service_role;

notify pgrst, 'reload schema';
