-- Trava no Postgres (Supabase): recusa gravação em rajada.
-- Se o portal entrar em loop, mais de 4 escritas no mesmo label em 10 segundos
-- são recusadas aqui — a linha do snapshot não muda.
-- Correr no SQL Editor do projeto oficial (papel postgres). Não apaga dados.

create table if not exists public.dk_cloud_burst_guard (
  label text primary key,
  hits int not null default 0,
  window_start timestamptz not null default now()
);

create or replace function public.dk_rejeitar_loop_snapshot()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  n int;
begin
  insert into public.dk_cloud_burst_guard(label, hits, window_start)
  values (new.label, 1, now())
  on conflict (label) do update
    set hits = case
          when now() - dk_cloud_burst_guard.window_start > interval '10 seconds' then 1
          else dk_cloud_burst_guard.hits + 1
        end,
        window_start = case
          when now() - dk_cloud_burst_guard.window_start > interval '10 seconds' then now()
          else dk_cloud_burst_guard.window_start
        end
  returning hits into n;
  if n > 4 then
    raise exception 'cloud_budget_loop'
      using hint = 'Mais de 4 escritas em 10s no mesmo label. Loop recusado no Supabase.';
  end if;
  return new;
end;
$$;

drop trigger if exists dk_rejeitar_loop_snapshot_trg on public.dk_cloud_snapshots;
create trigger dk_rejeitar_loop_snapshot_trg
  before insert or update on public.dk_cloud_snapshots
  for each row
  execute function public.dk_rejeitar_loop_snapshot();

alter table public.dk_cloud_burst_guard enable row level security;
revoke all on table public.dk_cloud_burst_guard from anon, authenticated;
grant all on table public.dk_cloud_burst_guard to service_role;
