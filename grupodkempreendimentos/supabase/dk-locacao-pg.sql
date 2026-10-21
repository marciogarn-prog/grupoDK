-- Locações e pagamentos: PostgreSQL é a única fonte.
-- Cada locação é uma linha. Cada movimento financeiro só entra; não se altera e não se apaga.
-- O navegador não recebe a chave de serviço. anon e authenticated não leem estas tabelas.
-- Rode uma vez no SQL Editor do Supabase. Pode rodar de novo: os create usam if not exists.

create extension if not exists pgcrypto;

create table if not exists public.dk_locacao (
  id uuid primary key default gen_random_uuid(),
  numero_contrato text not null unique,
  cpf text,
  placa text,
  status_locacao text,
  campos jsonb not null default '{}'::jsonb,
  version integer not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_by text,
  updated_by text
);

create index if not exists dk_locacao_aberta_idx
  on public.dk_locacao (numero_contrato)
  where deleted_at is null;

comment on table public.dk_locacao is
  'Locação individual. deleted_at preenchido não volta. version só cresce se o UPDATE casar a versão lida.';

create table if not exists public.dk_locacao_movimento (
  id uuid primary key default gen_random_uuid(),
  locacao_id uuid not null references public.dk_locacao (id),
  tipo text not null check (tipo in (
    'pagamento', 'estorno', 'cancelamento', 'ajuste',
    'devolucao', 'credito_manutencao', 'caucao'
  )),
  valor numeric not null,
  data_movimento text,
  descricao text,
  referencia_movimento_id uuid,
  idempotency_key text not null unique,
  created_at timestamptz not null default now(),
  created_by text,
  protocolo_lancamento text,
  campos jsonb not null default '{}'::jsonb
);

create index if not exists dk_locacao_movimento_locacao_idx
  on public.dk_locacao_movimento (locacao_id, created_at);

comment on table public.dk_locacao_movimento is
  'Livro-razão. Linha criada não se edita e não se apaga. Correção é movimento novo.';

create or replace function public.dk_locacao_movimento_imutavel()
returns trigger
language plpgsql
as $$
begin
  raise exception 'movimento financeiro é imutável';
end;
$$;

drop trigger if exists dk_locacao_movimento_no_update on public.dk_locacao_movimento;
create trigger dk_locacao_movimento_no_update
  before update or delete on public.dk_locacao_movimento
  for each row execute function public.dk_locacao_movimento_imutavel();

alter table public.dk_locacao enable row level security;
alter table public.dk_locacao_movimento enable row level security;

revoke all on table public.dk_locacao from public, anon, authenticated;
revoke all on table public.dk_locacao_movimento from public, anon, authenticated;

-- Sem política para anon/authenticated: chamada direta do navegador não lê nem grava.
-- A API da Vercel usa a chave de serviço, que não passa por estas políticas.

create or replace function public.dk_locacao_gravar(
  p_numero text,
  p_version integer,
  p_campos jsonb,
  p_novos jsonb,
  p_by text,
  p_criar boolean
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  loc public.dk_locacao%rowtype;
  item jsonb;
begin
  if coalesce(p_criar, false) then
    insert into public.dk_locacao (
      numero_contrato, cpf, placa, status_locacao, campos, created_by, updated_by
    ) values (
      p_numero,
      left(regexp_replace(coalesce(p_campos->>'cpf', ''), '\D', '', 'g'), 11),
      upper(left(coalesce(p_campos->>'placa', ''), 12)),
      coalesce(nullif(p_campos->>'statusLocacao', ''), nullif(p_campos->>'status', ''), 'ATIVO'),
      coalesce(p_campos, '{}'::jsonb),
      nullif(p_by, ''),
      nullif(p_by, '')
    )
    on conflict (numero_contrato) do nothing
    returning * into loc;
    if not found then
      select * into loc from public.dk_locacao where numero_contrato = p_numero;
      if not found then
        return jsonb_build_object('ok', false, 'conflict', true, 'reason', 'protocolo');
      end if;
      if loc.deleted_at is not null then
        return jsonb_build_object('ok', false, 'conflict', true, 'reason', 'excluida', 'version', loc.version);
      end if;
      if p_version is null or p_version < 1 or loc.version <> p_version then
        return jsonb_build_object('ok', false, 'conflict', true, 'reason', 'version', 'version', loc.version);
      end if;
      update public.dk_locacao
         set campos = coalesce(p_campos, campos),
             cpf = left(regexp_replace(coalesce(p_campos->>'cpf', cpf), '\D', '', 'g'), 11),
             placa = upper(left(coalesce(p_campos->>'placa', placa), 12)),
             status_locacao = coalesce(nullif(p_campos->>'statusLocacao', ''), nullif(p_campos->>'status', ''), status_locacao),
             version = version + 1,
             updated_at = now(),
             updated_by = nullif(p_by, '')
       where id = loc.id and version = p_version and deleted_at is null
       returning * into loc;
      if loc.id is null then
        return jsonb_build_object('ok', false, 'conflict', true, 'reason', 'version');
      end if;
    end if;
  else
    update public.dk_locacao
       set campos = coalesce(p_campos, campos),
           cpf = left(regexp_replace(coalesce(p_campos->>'cpf', cpf), '\D', '', 'g'), 11),
           placa = upper(left(coalesce(p_campos->>'placa', placa), 12)),
           status_locacao = coalesce(nullif(p_campos->>'statusLocacao', ''), nullif(p_campos->>'status', ''), status_locacao),
           version = version + 1,
           updated_at = now(),
           updated_by = nullif(p_by, '')
     where numero_contrato = p_numero
       and version = p_version
       and deleted_at is null
     returning * into loc;
    if not found then
      return jsonb_build_object('ok', false, 'conflict', true, 'reason', 'version');
    end if;
  end if;

  for item in select value from jsonb_array_elements(coalesce(p_novos, '[]'::jsonb))
  loop
    insert into public.dk_locacao_movimento (
      locacao_id, tipo, valor, data_movimento, descricao, referencia_movimento_id,
      idempotency_key, created_by, protocolo_lancamento, campos
    ) values (
      loc.id,
      item->>'tipo',
      coalesce((item->>'valor')::numeric, 0),
      nullif(item->>'data_movimento', ''),
      nullif(item->>'descricao', ''),
      nullif(item->>'referencia_movimento_id', '')::uuid,
      item->>'idempotency_key',
      nullif(p_by, ''),
      nullif(item->>'protocolo_lancamento', ''),
      coalesce(item->'campos', '{}'::jsonb)
    )
    on conflict (idempotency_key) do nothing;
  end loop;

  select * into loc from public.dk_locacao where id = loc.id;
  return jsonb_build_object(
    'ok', true,
    'id', loc.id,
    'version', loc.version,
    'updated_at', loc.updated_at
  );
end;
$$;

create or replace function public.dk_locacao_excluir(
  p_numero text,
  p_version integer,
  p_by text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  loc public.dk_locacao%rowtype;
begin
  update public.dk_locacao
     set deleted_at = now(),
         version = version + 1,
         updated_at = now(),
         updated_by = nullif(p_by, '')
   where numero_contrato = p_numero
     and version = p_version
     and deleted_at is null
   returning * into loc;
  if not found then
    return jsonb_build_object('ok', false, 'conflict', true, 'reason', 'version');
  end if;
  return jsonb_build_object('ok', true, 'id', loc.id, 'version', loc.version, 'deleted_at', loc.deleted_at);
end;
$$;

revoke all on function public.dk_locacao_gravar(text, integer, jsonb, jsonb, text, boolean) from public, anon, authenticated;
revoke all on function public.dk_locacao_excluir(text, integer, text) from public, anon, authenticated;
grant execute on function public.dk_locacao_gravar(text, integer, jsonb, jsonb, text, boolean) to service_role;
grant execute on function public.dk_locacao_excluir(text, integer, text) to service_role;

notify pgrst, 'reload schema';
