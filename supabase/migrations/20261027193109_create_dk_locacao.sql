-- Copia de dk_locacoes_cadastro. Uma linha por numeroContrato.
-- Nao cria movimento, nao marca modulo e nao altera o snapshot.
-- anon e authenticated nao leem esta tabela. A API usa a chave de servico.

create table if not exists public.dk_locacao (
  id uuid primary key default gen_random_uuid(),
  numero_contrato text not null unique,
  id_legado text,
  cpf text,
  placa text,
  status_locacao text,
  campos jsonb not null,
  version integer not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_by text,
  updated_by text
);

create index if not exists dk_locacao_cpf_idx
  on public.dk_locacao (cpf)
  where deleted_at is null and cpf is not null and btrim(cpf) <> '';

create index if not exists dk_locacao_placa_idx
  on public.dk_locacao (placa)
  where deleted_at is null and placa is not null and btrim(placa) <> '';

create index if not exists dk_locacao_status_idx
  on public.dk_locacao (status_locacao)
  where deleted_at is null and status_locacao is not null and btrim(status_locacao) <> '';

comment on table public.dk_locacao is
  'Locacao individual. numero_contrato e a chave de negocio. id_legado pode repetir. O modulo continua no snapshot ate a flag dk:portal:locacoes_fonte:v1.';

alter table public.dk_locacao enable row level security;

revoke all on table public.dk_locacao from public;
revoke all on table public.dk_locacao from anon;
revoke all on table public.dk_locacao from authenticated;
revoke all on table public.dk_locacao from service_role;
grant select, insert, update on table public.dk_locacao to service_role;

create or replace function public.dk_locacao_hashes_texto(p_texto text)
returns text[]
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  lista jsonb;
begin
  lista := p_texto::jsonb;
  if jsonb_typeof(lista) <> 'array' then
    return null;
  end if;
  return (
    select coalesce(array_agg(h), '{}'::text[])
    from (
      select encode(extensions.digest(convert_to(loc::text, 'UTF8'), 'sha256'), 'hex') as h
      from jsonb_array_elements(lista) loc
    ) x
  );
end;
$$;

create or replace function public.dk_locacao_hash_snapshot()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select encode(extensions.digest(coalesce(string_agg(h, E'\n' order by h), ''), 'sha256'), 'hex')
  from (
    select encode(extensions.digest(convert_to(loc::text, 'UTF8'), 'sha256'), 'hex') as h
    from public.dk_cloud_snapshots s,
         lateral jsonb_array_elements(s.payload->'dk_locacoes_cadastro') loc
    where s.label = 'default'
  ) x
$$;

create or replace function public.dk_locacao_copiar_do_snapshot(p_redis_hash text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  n int;
  h text;
  h2 text;
  r0 timestamptz;
  r1 timestamptz;
  inseridas int;
begin
  select count(*) into n from public.dk_locacao;
  if n > 0 then
    return jsonb_build_object('ok', false, 'reason', 'destino_nao_vazio', 'destino', n);
  end if;
  if exists (
    select 1
    from public.dk_cloud_snapshots s,
         lateral jsonb_array_elements(s.payload->'dk_locacoes_cadastro') loc
    where s.label = 'default'
      and regexp_replace(coalesce(loc->>'numeroContrato', loc->>'protocolo', ''), '\D', '', 'g') = ''
  ) then
    return jsonb_build_object('ok', false, 'reason', 'protocolo_vazio');
  end if;
  if exists (
    select 1
    from (
      select regexp_replace(coalesce(loc->>'numeroContrato', loc->>'protocolo', ''), '\D', '', 'g') as proto
      from public.dk_cloud_snapshots s,
           lateral jsonb_array_elements(s.payload->'dk_locacoes_cadastro') loc
      where s.label = 'default'
    ) p
    group by proto
    having count(*) > 1
  ) then
    return jsonb_build_object('ok', false, 'reason', 'protocolo_duplicado');
  end if;
  select s.updated_at into r0 from public.dk_cloud_snapshots s where s.label = 'default';
  h := public.dk_locacao_hash_snapshot();
  if p_redis_hash is null or btrim(p_redis_hash) = '' or p_redis_hash <> h then
    return jsonb_build_object('ok', false, 'reason', 'redis_divergente', 'source_hash', h, 'redis_hash', p_redis_hash, 'r0', r0);
  end if;
  insert into public.dk_locacao (
    numero_contrato, id_legado, cpf, placa, status_locacao, campos, created_by, updated_by
  )
  select
    regexp_replace(coalesce(loc->>'numeroContrato', loc->>'protocolo', ''), '\D', '', 'g'),
    nullif(btrim(coalesce(loc->>'id', '')), ''),
    nullif(regexp_replace(coalesce(loc->>'cpf', ''), '\D', '', 'g'), ''),
    nullif(loc->>'placa', ''),
    nullif(btrim(coalesce(loc->>'statusLocacao', loc->>'status', '')), ''),
    loc,
    'copia-iter20',
    'copia-iter20'
  from public.dk_cloud_snapshots s,
       lateral jsonb_array_elements(s.payload->'dk_locacoes_cadastro') loc
  where s.label = 'default';
  get diagnostics inseridas = row_count;
  h2 := public.dk_locacao_hash_snapshot();
  select s.updated_at into r1 from public.dk_cloud_snapshots s where s.label = 'default';
  if h2 is distinct from h or r1 is distinct from r0 then
    raise exception 'fonte_mudou';
  end if;
  return jsonb_build_object('ok', true, 'inseridas', inseridas, 'hash', h, 'r0', r0, 'r1', r1);
end;
$$;

create or replace function public.dk_locacao_resumo()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with dest as (
    select * from public.dk_locacao where deleted_at is null
  ),
  fonte as (
    select loc, s.updated_at
    from public.dk_cloud_snapshots s,
         lateral jsonb_array_elements(s.payload->'dk_locacoes_cadastro') loc
    where s.label = 'default'
  )
  select jsonb_build_object(
    'destino_n', (select count(*) from dest),
    'destino_proto', (select count(distinct numero_contrato) from dest),
    'destino_ids', (select count(distinct id_legado) from dest where id_legado is not null and btrim(id_legado) <> ''),
    'destino_hash', (
      select encode(extensions.digest(coalesce(string_agg(h, E'\n' order by h), ''), 'sha256'), 'hex')
      from (
        select encode(extensions.digest(convert_to(campos::text, 'UTF8'), 'sha256'), 'hex') as h
        from dest
      ) x
    ),
    'fonte_n', (select count(*) from fonte),
    'fonte_hash', public.dk_locacao_hash_snapshot(),
    'updated_at', (select updated_at from public.dk_cloud_snapshots where label = 'default'),
    'com_pagamento', (
      select count(*) from dest
      where jsonb_typeof(campos->'portalLancamentosAluguel') = 'array'
        and jsonb_array_length(campos->'portalLancamentosAluguel') > 0
    ),
    'pagamentos', (
      select coalesce(sum(jsonb_array_length(campos->'portalLancamentosAluguel')), 0)
      from dest
      where jsonb_typeof(campos->'portalLancamentosAluguel') = 'array'
    ),
    'duplicados', (
      select coalesce(jsonb_agg(jsonb_build_object('id_legado', id_legado, 'n', n, 'protocolos', protocolos)), '[]'::jsonb)
      from (
        select id_legado, count(*) as n, jsonb_agg(numero_contrato order by numero_contrato) as protocolos
        from dest
        where id_legado is not null and btrim(id_legado) <> ''
        group by id_legado
        having count(*) > 1
      ) d
    ),
    'extras', (
      select coalesce(jsonb_agg(d.numero_contrato order by d.numero_contrato), '[]'::jsonb)
      from dest d
      where not exists (
        select 1 from fonte f
        where regexp_replace(coalesce(f.loc->>'numeroContrato', f.loc->>'protocolo', ''), '\D', '', 'g') = d.numero_contrato
      )
    )
  )
$$;

revoke all on function public.dk_locacao_hashes_texto(text) from public, anon, authenticated;
revoke all on function public.dk_locacao_hash_snapshot() from public, anon, authenticated;
revoke all on function public.dk_locacao_copiar_do_snapshot(text) from public, anon, authenticated;
revoke all on function public.dk_locacao_resumo() from public, anon, authenticated;
grant execute on function public.dk_locacao_hashes_texto(text) to service_role;
grant execute on function public.dk_locacao_hash_snapshot() to service_role;
grant execute on function public.dk_locacao_copiar_do_snapshot(text) to service_role;
grant execute on function public.dk_locacao_resumo() to service_role;

notify pgrst, 'reload schema';
