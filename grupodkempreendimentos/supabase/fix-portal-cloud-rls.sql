-- Corrige erro: "new row violates row-level security policy for table 'dk_cloud_snapshots'"
-- Supabase → SQL Editor → colar → Run (não apaga dados).

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

notify pgrst, 'reload schema';
