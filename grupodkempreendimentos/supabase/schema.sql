-- Execute no SQL Editor do Supabase (projeto → SQL → New query).
-- Passo inicial: uma linha por “organização” ou utilizador, payload JSON espelha os cadastros locais.
-- Ajuste políticas RLS quando ligar Auth (email/CPF + senha ou magic link).

create extension if not exists "pgcrypto";

create table if not exists public.dk_cloud_snapshots (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid references auth.users (id) on delete cascade,
  label text default 'default',
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create index if not exists dk_cloud_snapshots_owner_idx on public.dk_cloud_snapshots (owner_user_id);

-- RLS: ative no painel (Authentication → Policies) ou aqui quando ligar Supabase Auth.
-- Sem políticas, não exponha dados sensíveis. Em produção: enable row level security + policies por auth.uid().

comment on table public.dk_cloud_snapshots is 'Sincronização futura dos dados DK (alternativa ao só localStorage).';
