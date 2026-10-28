-- Sombra de pagamentos de locacao. Nao aponta a tela, nao altera dk_locacao,
-- labels, snapshot nem Redis. anon e authenticated nao leem estas tabelas.

create table if not exists public.dk_pagamento_locacao (
  id uuid primary key default gen_random_uuid(),
  migration_key text not null,
  protocolo_lancamento text null,
  numero_contrato text not null,
  tipo text null,
  data_pagamento date null,
  valor numeric(14,2) null,
  payload jsonb not null,
  version integer not null default 1 check (version >= 1),
  removido boolean not null default false,
  deleted_at timestamptz null,
  created_at timestamptz null,
  updated_at timestamptz null,
  source_state text not null,
  source_position integer not null,
  source_payload_hash text not null
);

create unique index if not exists dk_pagamento_locacao_migration_key_idx
  on public.dk_pagamento_locacao (migration_key);

create unique index if not exists dk_pagamento_locacao_protocolo_ativo_idx
  on public.dk_pagamento_locacao (protocolo_lancamento)
  where removido = false and protocolo_lancamento is not null;

create index if not exists dk_pagamento_locacao_contrato_idx
  on public.dk_pagamento_locacao (numero_contrato);

create index if not exists dk_pagamento_locacao_data_idx
  on public.dk_pagamento_locacao (data_pagamento);

comment on table public.dk_pagamento_locacao is
  'Sombra dos pagamentos de locacao. A tela continua lendo portalLancamentosAluguel ate o cutover.';

alter table public.dk_pagamento_locacao enable row level security;

revoke all on table public.dk_pagamento_locacao from public;
revoke all on table public.dk_pagamento_locacao from anon;
revoke all on table public.dk_pagamento_locacao from authenticated;
revoke all on table public.dk_pagamento_locacao from service_role;
grant select, insert, update on table public.dk_pagamento_locacao to service_role;

create table if not exists public.dk_pagamento_locacao_quarentena (
  id uuid primary key default gen_random_uuid(),
  migration_key text not null,
  numero_contrato text not null,
  protocolo_lancamento text null,
  origens jsonb not null,
  motivo text not null,
  payloads jsonb not null,
  classificacao text not null,
  created_at timestamptz null,
  source_payload_hash text not null
);

create unique index if not exists dk_pagamento_locacao_quarentena_migration_key_idx
  on public.dk_pagamento_locacao_quarentena (migration_key);

create index if not exists dk_pagamento_locacao_quarentena_contrato_idx
  on public.dk_pagamento_locacao_quarentena (numero_contrato);

create index if not exists dk_pagamento_locacao_quarentena_protocolo_idx
  on public.dk_pagamento_locacao_quarentena (protocolo_lancamento);

comment on table public.dk_pagamento_locacao_quarentena is
  'Evidencia dos 16 pagamentos da sessao incompleta de 27/10/2026. Nao e fonte operacional.';

alter table public.dk_pagamento_locacao_quarentena enable row level security;

revoke all on table public.dk_pagamento_locacao_quarentena from public;
revoke all on table public.dk_pagamento_locacao_quarentena from anon;
revoke all on table public.dk_pagamento_locacao_quarentena from authenticated;
revoke all on table public.dk_pagamento_locacao_quarentena from service_role;
grant select, insert, update on table public.dk_pagamento_locacao_quarentena to service_role;

create or replace function public.dk_pagamento_locacao_copiar_sombra(p_redis jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $pag$
declare
  n_op integer := 0;
  n_lote integer := 0;
  n_q integer := 0;
  n_uma integer := 0;
  v_proto text;
  v_nc text := '2025111403';
  v_label jsonb;
  v_redis jsonb;
  v_payloads jsonb;
  v_origens jsonb;
  v_hash text;
  v_key text;
  v_created timestamptz;
  label_protos text[] := array[
    '20261027103438-057','20261027103457-057','20261027103552-057','20261027103632-057',
    '20261027103750-057','20261027103850-057','20261027104233-057','20261027105253-057'
  ];
  redis_protos text[] := array[
    '20261027103929-057','20261027104100-057','20261027104149-057','20261027104624-057',
    '20261027104659-057','20261027104835-057','20261027105047-057','20261027105205-057'
  ];
begin
  if p_redis is null or jsonb_typeof(p_redis) <> 'array' then
    raise exception 'redis_quarentena_ausente';
  end if;

  with ins as (
    insert into public.dk_pagamento_locacao (
      migration_key, protocolo_lancamento, numero_contrato, tipo, data_pagamento, valor,
      payload, version, removido, deleted_at, created_at, updated_at,
      source_state, source_position, source_payload_hash
    )
    select
      encode(extensions.digest(convert_to(l.numero_contrato || '|ativo|' || e.ord::int::text || '|' || h, 'UTF8'), 'sha256'), 'hex'),
      nullif(btrim(e.p->>'protocoloLancamento'), ''),
      l.numero_contrato,
      nullif(btrim(e.p->>'tipoMovimento'), ''),
      case
        when nullif(btrim(e.p->>'data'), '') ~ '^[0-9]{2}/[0-9]{2}/[0-9]{4}$'
          then to_date(e.p->>'data', 'DD/MM/YYYY')
        else null
      end,
      case
        when coalesce(e.p->>'valor', '') ~ '^-?[0-9]+(\.[0-9]+)?$'
          then (e.p->>'valor')::numeric
        else null
      end,
      e.p,
      1,
      false,
      null,
      case
        when e.p->>'createdAt' ~ '^[0-9]{13}$'
          then to_timestamp((e.p->>'createdAt')::numeric / 1000.0)
        else null
      end,
      null,
      'ativo',
      e.ord::int,
      h
    from public.dk_locacao l
    cross join lateral jsonb_array_elements(coalesce(l.campos->'portalLancamentosAluguel', '[]'::jsonb)) with ordinality as e(p, ord)
    cross join lateral (
      select encode(extensions.digest(convert_to(e.p::text, 'UTF8'), 'sha256'), 'hex') as h
    ) hx
    where l.deleted_at is null
    on conflict (migration_key) do nothing
    returning 1
  )
  select count(*) into n_lote from ins;
  n_op := n_op + n_lote;

  with ins as (
    insert into public.dk_pagamento_locacao (
      migration_key, protocolo_lancamento, numero_contrato, tipo, data_pagamento, valor,
      payload, version, removido, deleted_at, created_at, updated_at,
      source_state, source_position, source_payload_hash
    )
    select
      encode(extensions.digest(convert_to(l.numero_contrato || '|removido|' || e.ord::int::text || '|' || h, 'UTF8'), 'sha256'), 'hex'),
      nullif(btrim(e.r->>'protocoloLancamento'), ''),
      l.numero_contrato,
      nullif(btrim(e.r->>'tipoMovimento'), ''),
      case
        when nullif(btrim(e.r->>'data'), '') ~ '^[0-9]{2}/[0-9]{2}/[0-9]{4}$'
          then to_date(e.r->>'data', 'DD/MM/YYYY')
        else null
      end,
      case
        when coalesce(e.r->>'valor', '') ~ '^-?[0-9]+(\.[0-9]+)?$'
          then (e.r->>'valor')::numeric
        else null
      end,
      e.r,
      1,
      true,
      case
        when e.r->>'removedAt' ~ '^[0-9]{13}$'
          then to_timestamp((e.r->>'removedAt')::numeric / 1000.0)
        else null
      end,
      case
        when e.r->>'createdAt' ~ '^[0-9]{13}$'
          then to_timestamp((e.r->>'createdAt')::numeric / 1000.0)
        else null
      end,
      null,
      'removido',
      e.ord::int,
      h
    from public.dk_locacao l
    cross join lateral jsonb_array_elements(coalesce(l.campos->'portalLancamentosAluguelRemovidos', '[]'::jsonb)) with ordinality as e(r, ord)
    cross join lateral (
      select encode(extensions.digest(convert_to(e.r::text, 'UTF8'), 'sha256'), 'hex') as h
    ) hx
    where l.deleted_at is null
    on conflict (migration_key) do nothing
    returning 1
  )
  select count(*) into n_lote from ins;
  n_op := n_op + n_lote;

  foreach v_proto in array label_protos loop
    select s.payload->'pagamento' into v_label
    from public.dk_cloud_snapshots s
    where s.label = 'entity:lancamento_aluguel:' || v_nc || ':' || v_proto
      and coalesce(s.payload->>'deleted', 'false') <> 'true'
    limit 1;
    select elem->'pagamento' into v_redis
    from jsonb_array_elements(p_redis) elem
    where elem->>'proto' = v_proto
      and elem->>'nc' = v_nc
    limit 1;
    if v_label is null or v_redis is null then
      raise exception 'quarentena_label_incompleta: %', v_proto;
    end if;
    v_payloads := jsonb_build_object('label', v_label, 'redis', v_redis);
    v_origens := '["label","redis"]'::jsonb;
    v_hash := encode(extensions.digest(convert_to(v_payloads::text, 'UTF8'), 'sha256'), 'hex');
    v_key := encode(extensions.digest(convert_to(v_nc || '|quarentena|' || v_proto || '|' || v_hash, 'UTF8'), 'sha256'), 'hex');
    v_created := case
      when v_label->>'createdAt' ~ '^[0-9]{13}$'
        then to_timestamp((v_label->>'createdAt')::numeric / 1000.0)
      else null
    end;
    insert into public.dk_pagamento_locacao_quarentena (
      migration_key, numero_contrato, protocolo_lancamento, origens, motivo, payloads,
      classificacao, created_at, source_payload_hash
    ) values (
      v_key, v_nc, v_proto, v_origens, 'sessao_incompleta_20261027', v_payloads,
      'quarentena', v_created, v_hash
    )
    on conflict (migration_key) do nothing;
    get diagnostics n_uma = row_count;
    n_q := n_q + n_uma;
  end loop;

  foreach v_proto in array redis_protos loop
    select elem->'pagamento' into v_redis
    from jsonb_array_elements(p_redis) elem
    where elem->>'proto' = v_proto
      and elem->>'nc' = v_nc
    limit 1;
    if v_redis is null then
      raise exception 'quarentena_redis_incompleta: %', v_proto;
    end if;
    v_payloads := jsonb_build_object('redis', v_redis);
    v_origens := '["redis"]'::jsonb;
    v_hash := encode(extensions.digest(convert_to(v_payloads::text, 'UTF8'), 'sha256'), 'hex');
    v_key := encode(extensions.digest(convert_to(v_nc || '|quarentena|' || v_proto || '|' || v_hash, 'UTF8'), 'sha256'), 'hex');
    v_created := case
      when v_redis->>'createdAt' ~ '^[0-9]{13}$'
        then to_timestamp((v_redis->>'createdAt')::numeric / 1000.0)
      else null
    end;
    insert into public.dk_pagamento_locacao_quarentena (
      migration_key, numero_contrato, protocolo_lancamento, origens, motivo, payloads,
      classificacao, created_at, source_payload_hash
    ) values (
      v_key, v_nc, v_proto, v_origens, 'sessao_incompleta_20261027', v_payloads,
      'quarentena', v_created, v_hash
    )
    on conflict (migration_key) do nothing;
    get diagnostics n_uma = row_count;
    n_q := n_q + n_uma;
  end loop;

  return jsonb_build_object(
    'operacional_inseridos', n_op,
    'quarentena_inseridos', n_q
  );
end;
$pag$;

revoke all on function public.dk_pagamento_locacao_copiar_sombra(jsonb) from public, anon, authenticated;
grant execute on function public.dk_pagamento_locacao_copiar_sombra(jsonb) to service_role;
