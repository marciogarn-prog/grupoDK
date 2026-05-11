-- Projeto Supabase → SQL Editor → New query → Run (uma vez; se já existir tabela antiga, ver nota no fim).
-- Tabela única com snapshot JSON dos dados DK do navegador (substitui trabalhar só em localStorage entre dispositivos).

create extension if not exists "pgcrypto";

-- Versão simples: uma linha por etiqueta (label); upsert pela coluna label.
drop table if exists public.dk_cloud_snapshots cascade;

create table public.dk_cloud_snapshots (
  id uuid primary key default gen_random_uuid(),
  label text not null unique default 'default',
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

comment on table public.dk_cloud_snapshots is 'Snapshot dos cadastros DK (JSON por chave localStorage).';

-- RLS ligado com política explícita: o PostgREST (chave anon/publishable) usa os roles anon/authenticated.
-- Isto evita o erro "violates row-level security policy" quando o Supabase liga RLS por defeito.
alter table public.dk_cloud_snapshots enable row level security;

drop policy if exists "dk_cloud_snapshots_portal_access" on public.dk_cloud_snapshots;
create policy "dk_cloud_snapshots_portal_access"
  on public.dk_cloud_snapshots
  for all
  to anon, authenticated
  using (true)
  with check (true);

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on table public.dk_cloud_snapshots to anon, authenticated;

-- Atualiza o cache da API REST (evita "Could not find the table ... in the schema cache").
notify pgrst, 'reload schema';
