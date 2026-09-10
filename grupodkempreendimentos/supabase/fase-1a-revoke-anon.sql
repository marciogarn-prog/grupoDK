-- Fase 1A — revoga leitura/gravação anónima em dk_cloud_snapshots.
-- NÃO apaga linhas. NÃO faz DROP. Reversível (ver comentário no fim).
-- Correr no SQL Editor do projeto Supabase oficial.

alter table public.dk_cloud_snapshots enable row level security;

drop policy if exists "dk_cloud_snapshots_portal_access" on public.dk_cloud_snapshots;
drop policy if exists "dk_cloud_snapshots_no_anon" on public.dk_cloud_snapshots;

-- Ninguém com chave anon/authenticated lê ou grava. Só service_role (backend).
create policy "dk_cloud_snapshots_no_anon"
  on public.dk_cloud_snapshots
  for all
  to anon, authenticated
  using (false)
  with check (false);

revoke all on table public.dk_cloud_snapshots from anon, authenticated;
grant select, insert, update, delete on table public.dk_cloud_snapshots to service_role;

notify pgrst, 'reload schema';

-- ROLLBACK (só se o titular autorizar):
-- drop policy if exists "dk_cloud_snapshots_no_anon" on public.dk_cloud_snapshots;
-- create policy "dk_cloud_snapshots_portal_access" on public.dk_cloud_snapshots
--   for all to anon, authenticated using (true) with check (true);
-- grant select, insert, update, delete on table public.dk_cloud_snapshots to anon, authenticated;
-- notify pgrst, 'reload schema';
