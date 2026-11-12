-- COMANDO 07/10 — Sync incremental BC → VMs A–J + imutabilidade histórica reforçada.
-- Aditivo. Não ativa worker em produção. Não libera VMs. Não consome BC.
-- Cursor oficial de sync: bc_no (não evento_no/bigserial).

-- ========== 2) Imutabilidade histórica ==========
create or replace function public.dk_bc_registro_proteger()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'dk_bc_registro_imutavel' using errcode = '42501';
  end if;

  if tg_op = 'UPDATE' then
    -- Identidade/conteúdo histórico imutáveis
    if new.bc_id is distinct from old.bc_id
       or new.bc_no is distinct from old.bc_no
       or new.categoria is distinct from old.categoria
       or new.subcategoria is distinct from old.subcategoria
       or new.origem is distinct from old.origem
       or new.registro_id is distinct from old.registro_id
       or new.empresa_id is distinct from old.empresa_id
       or new.filial_id is distinct from old.filial_id
       or new.versao_bc is distinct from old.versao_bc
       or new.bc_anterior is distinct from old.bc_anterior
       or new.confirmado_em is distinct from old.confirmado_em
       or new.hash_integridade is distinct from old.hash_integridade
       or new.historico_ref is distinct from old.historico_ref
       or new.conteudo_hash is distinct from old.conteudo_hash
       or new.payload is distinct from old.payload
       or new.estado is distinct from old.estado
       or new.created_at is distinct from old.created_at then
      raise exception 'dk_bc_registro_historico_imutavel' using errcode = '42501';
    end if;

    -- Não reativa vigente
    if old.vigente = false and new.vigente = true then
      raise exception 'dk_bc_registro_nao_reativa' using errcode = '42501';
    end if;

    -- vigente true→false só em substituição válida (substituido_por preenchido na mesma atualização ou depois)
    if old.vigente = true and new.vigente = false then
      if new.substituido_por is null and old.substituido_por is null then
        -- permitido desmarcar vigente antes de gravar sucessor (confirmar faz em 2 passos);
        -- o segundo UPDATE deve preencher substituido_por
        null;
      end if;
    end if;

    -- substituido_por: só null→valor; nunca altera depois; valida sucessor
    if old.substituido_por is not null
       and new.substituido_por is distinct from old.substituido_por then
      raise exception 'dk_bc_registro_substituido_por_imutavel' using errcode = '42501';
    end if;

    if old.substituido_por is null and new.substituido_por is not null then
      if not exists (
        select 1 from public.dk_bc_registro s
         where s.bc_id = new.substituido_por
           and s.bc_anterior = old.bc_id
           and s.origem = old.origem
           and s.registro_id = old.registro_id
           and coalesce(s.empresa_id,'') = coalesce(old.empresa_id,'')
           and coalesce(s.filial_id,'') = coalesce(old.filial_id,'')
      ) then
        raise exception 'dk_bc_registro_sucessor_invalido' using errcode = '23514';
      end if;
      if new.vigente is not false then
        raise exception 'dk_bc_registro_substituido_deve_nao_vigente' using errcode = '23514';
      end if;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_dk_bc_registro_proteger on public.dk_bc_registro;
create trigger trg_dk_bc_registro_proteger
  before update or delete on public.dk_bc_registro
  for each row execute function public.dk_bc_registro_proteger();

-- ========== 4/8) Estado de sync por VM ==========
create table if not exists public.dk_bc_vm_sync_state (
  prefixo char(1) primary key references public.dk_bc_vm (prefixo),
  last_applied_bc_no bigint not null default 0 check (last_applied_bc_no >= 0),
  bootstrap_done boolean not null default false,
  status text not null default 'ociosa'
    check (status in ('ociosa', 'sincronizando', 'atrasada', 'erro', 'recuperando')),
  last_success_at timestamptz null,
  last_attempt_at timestamptz null,
  last_error text null,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  pending_count integer not null default 0 check (pending_count >= 0),
  updated_at timestamptz not null default now()
);

comment on table public.dk_bc_vm_sync_state is
  'Cursor durável de sincronização BC→VM. Posição oficial = last_applied_bc_no (não Redis).';

insert into public.dk_bc_vm_sync_state (prefixo)
select prefixo from public.dk_bc_vm
on conflict (prefixo) do nothing;

create table if not exists public.dk_bc_vm_sync_entrega (
  id uuid primary key default gen_random_uuid(),
  prefixo char(1) not null references public.dk_bc_vm (prefixo),
  bc_id text not null references public.dk_bc_registro (bc_id),
  bc_no bigint not null,
  status text not null default 'pendente'
    check (status in ('pendente', 'aplicado', 'falhou', 'ignorado')),
  applied_at timestamptz null,
  attempt_count integer not null default 0,
  last_error text null,
  payload_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (prefixo, bc_id)
);

create index if not exists dk_bc_vm_sync_entrega_pend_idx
  on public.dk_bc_vm_sync_entrega (prefixo, bc_no)
  where status in ('pendente', 'falhou');

create table if not exists public.dk_bc_vm_projecao (
  prefixo char(1) not null references public.dk_bc_vm (prefixo),
  bc_id text not null references public.dk_bc_registro (bc_id),
  bc_no bigint not null,
  origem text not null,
  registro_id text not null,
  empresa_id text null,
  filial_id text null,
  estado text not null,
  vigente boolean not null,
  bc_anterior text null,
  conteudo_hash text not null,
  applied_at timestamptz not null default now(),
  primary key (prefixo, bc_id)
);

create index if not exists dk_bc_vm_projecao_reg_idx
  on public.dk_bc_vm_projecao (prefixo, origem, registro_id);

create table if not exists public.dk_bc_vm_sync_falha (
  id uuid primary key default gen_random_uuid(),
  prefixo char(1) not null references public.dk_bc_vm (prefixo),
  bc_no bigint null,
  bc_id text null,
  fase text not null,
  detalhe text not null,
  created_at timestamptz not null default now()
);

-- ========== Funções de sync ==========

-- Enfileira entrega para as 10 VMs a partir de um BC (idempotente).
create or replace function public.dk_bc_sync_enfileirar(p_bc_id text)
returns table (ok boolean, entregas integer, reason text)
language plpgsql
security invoker
set search_path = public, extensions
as $$
declare
  v_reg public.dk_bc_registro%rowtype;
  v_count int := 0;
begin
  select * into v_reg from public.dk_bc_registro r where r.bc_id = p_bc_id;
  if not found then
    ok := false; entregas := 0; reason := 'bc_inexistente';
    return next; return;
  end if;

  insert into public.dk_bc_vm_sync_entrega (prefixo, bc_id, bc_no, status, payload_snapshot)
  select v.prefixo, v_reg.bc_id, v_reg.bc_no, 'pendente',
         jsonb_build_object(
           'bc_id', v_reg.bc_id,
           'bc_no', v_reg.bc_no,
           'origem', v_reg.origem,
           'registro_id', v_reg.registro_id,
           'empresa_id', v_reg.empresa_id,
           'filial_id', v_reg.filial_id,
           'estado', v_reg.estado,
           'vigente', v_reg.vigente,
           'bc_anterior', v_reg.bc_anterior,
           'conteudo_hash', v_reg.conteudo_hash,
           'categoria', v_reg.categoria
         )
    from public.dk_bc_vm v
  on conflict (prefixo, bc_id) do nothing;

  get diagnostics v_count = row_count;
  ok := true; entregas := v_count; reason := null;
  return next;
end;
$$;

-- Aplica o próximo lote de uma VM (ordenado por bc_no). Não avança cursor antes de persistir.
create or replace function public.dk_bc_sync_aplicar_lote(
  p_prefixo text,
  p_limite integer default 100,
  p_empresa_id text default null,
  p_filial_id text default null
)
returns table (
  ok boolean,
  aplicados integer,
  last_bc_no bigint,
  reason text
)
language plpgsql
security invoker
set search_path = public, extensions
as $$
#variable_conflict use_column
declare
  v_prefix char(1);
  v_state public.dk_bc_vm_sync_state%rowtype;
  v_row public.dk_bc_vm_sync_entrega%rowtype;
  v_reg public.dk_bc_registro%rowtype;
  v_n int := 0;
  v_emp text := nullif(btrim(coalesce(p_empresa_id,'')),'');
  v_fil text := nullif(btrim(coalesce(p_filial_id,'')),'');
  v_lim int := greatest(1, least(coalesce(p_limite, 100), 1000));
begin
  v_prefix := upper(nullif(btrim(coalesce(p_prefixo,'')),''));
  if v_prefix is null or v_prefix !~ '^[A-J]$' then
    ok := false; aplicados := 0; last_bc_no := null; reason := 'prefixo_invalido';
    return next; return;
  end if;

  select * into v_state from public.dk_bc_vm_sync_state s where s.prefixo = v_prefix for update;
  if not found then
    ok := false; aplicados := 0; last_bc_no := null; reason := 'sync_state_ausente';
    return next; return;
  end if;

  update public.dk_bc_vm_sync_state
     set status = 'sincronizando', last_attempt_at = now(), updated_at = now()
   where prefixo = v_prefix;

  for v_row in
    select e.*
      from public.dk_bc_vm_sync_entrega e
     where e.prefixo = v_prefix
       and e.status in ('pendente', 'falhou')
       and e.bc_no > v_state.last_applied_bc_no
     order by e.bc_no
     limit v_lim
  loop
    select * into v_reg from public.dk_bc_registro r where r.bc_id = v_row.bc_id;
    if not found then
      insert into public.dk_bc_vm_sync_falha (prefixo, bc_no, bc_id, fase, detalhe)
      values (v_prefix, v_row.bc_no, v_row.bc_id, 'aplicar', 'bc_ausente_no_catalogo');
      update public.dk_bc_vm_sync_entrega
         set status = 'falhou', attempt_count = attempt_count + 1,
             last_error = 'bc_ausente_no_catalogo', updated_at = now()
       where id = v_row.id;
      continue;
    end if;

    -- Isolamento empresa/filial (quando filtro informado)
    if v_emp is not null and coalesce(v_reg.empresa_id,'') is distinct from v_emp then
      update public.dk_bc_vm_sync_entrega
         set status = 'ignorado', updated_at = now()
       where id = v_row.id;
      continue;
    end if;
    if v_fil is not null and coalesce(v_reg.filial_id,'') is distinct from v_fil then
      update public.dk_bc_vm_sync_entrega
         set status = 'ignorado', updated_at = now()
       where id = v_row.id;
      continue;
    end if;

    -- Não aplicar versão antiga sobre mais recente na projeção vigente do registro
    if exists (
      select 1 from public.dk_bc_vm_projecao p
       where p.prefixo = v_prefix
         and p.origem = v_reg.origem
         and p.registro_id = v_reg.registro_id
         and coalesce(p.empresa_id,'') = coalesce(v_reg.empresa_id,'')
         and coalesce(p.filial_id,'') = coalesce(v_reg.filial_id,'')
         and p.vigente = true
         and p.bc_no > v_reg.bc_no
    ) then
      update public.dk_bc_vm_sync_entrega
         set status = 'ignorado', last_error = 'versao_atrasada', updated_at = now()
       where id = v_row.id;
      -- ainda avança cursor (evento processado)
    else
      if v_reg.vigente then
        update public.dk_bc_vm_projecao p
           set vigente = false
         where p.prefixo = v_prefix
           and p.origem = v_reg.origem
           and p.registro_id = v_reg.registro_id
           and coalesce(p.empresa_id,'') = coalesce(v_reg.empresa_id,'')
           and coalesce(p.filial_id,'') = coalesce(v_reg.filial_id,'')
           and p.vigente = true;
      end if;

      insert into public.dk_bc_vm_projecao (
        prefixo, bc_id, bc_no, origem, registro_id, empresa_id, filial_id,
        estado, vigente, bc_anterior, conteudo_hash, applied_at
      ) values (
        v_prefix, v_reg.bc_id, v_reg.bc_no, v_reg.origem, v_reg.registro_id,
        v_reg.empresa_id, v_reg.filial_id, v_reg.estado, v_reg.vigente,
        v_reg.bc_anterior, v_reg.conteudo_hash, now()
      )
      on conflict (prefixo, bc_id) do update
        set vigente = excluded.vigente,
            applied_at = now();
    end if;

    update public.dk_bc_vm_sync_entrega
       set status = 'aplicado', applied_at = now(),
           attempt_count = attempt_count + 1, last_error = null, updated_at = now()
     where id = v_row.id;

    update public.dk_bc_vm_sync_state
       set last_applied_bc_no = v_row.bc_no,
           last_success_at = now(),
           attempt_count = attempt_count + 1,
           last_error = null,
           updated_at = now()
     where prefixo = v_prefix
       and last_applied_bc_no < v_row.bc_no;

    v_n := v_n + 1;
    v_state.last_applied_bc_no := greatest(v_state.last_applied_bc_no, v_row.bc_no);
  end loop;

  update public.dk_bc_vm_sync_state s
     set status = case
           when exists (
             select 1 from public.dk_bc_vm_sync_entrega e
              where e.prefixo = v_prefix and e.status in ('pendente','falhou')
                and e.bc_no > s.last_applied_bc_no
           ) then 'atrasada'
           else 'ociosa'
         end,
         pending_count = (
           select count(*)::int from public.dk_bc_vm_sync_entrega e
            where e.prefixo = v_prefix and e.status in ('pendente','falhou')
         ),
         updated_at = now()
   where s.prefixo = v_prefix;

  select last_applied_bc_no into last_bc_no from public.dk_bc_vm_sync_state where prefixo = v_prefix;
  ok := true; aplicados := v_n; reason := null;
  return next;
end;
$$;

-- Bootstrap: enfileira catálogo histórico (bc_no ordenado) sem inventar eventos.
create or replace function public.dk_bc_sync_bootstrap_vm(
  p_prefixo text,
  p_ate_bc_no bigint default null
)
returns table (ok boolean, enfileirados integer, reason text)
language plpgsql
security invoker
set search_path = public, extensions
as $$
declare
  v_prefix char(1);
  v_max bigint;
  v_count int := 0;
begin
  v_prefix := upper(nullif(btrim(coalesce(p_prefixo,'')),''));
  if v_prefix is null or v_prefix !~ '^[A-J]$' then
    ok := false; enfileirados := 0; reason := 'prefixo_invalido';
    return next; return;
  end if;

  select coalesce(p_ate_bc_no, max(bc_no), 0) into v_max from public.dk_bc_registro;

  insert into public.dk_bc_vm_sync_entrega (prefixo, bc_id, bc_no, status, payload_snapshot)
  select v_prefix, r.bc_id, r.bc_no, 'pendente',
         jsonb_build_object(
           'bc_id', r.bc_id, 'bc_no', r.bc_no, 'origem', r.origem,
           'registro_id', r.registro_id, 'empresa_id', r.empresa_id,
           'filial_id', r.filial_id, 'estado', r.estado, 'vigente', r.vigente,
           'bc_anterior', r.bc_anterior, 'conteudo_hash', r.conteudo_hash,
           'bootstrap', true
         )
    from public.dk_bc_registro r
   where r.bc_no <= v_max
  on conflict (prefixo, bc_id) do nothing;

  get diagnostics v_count = row_count;

  update public.dk_bc_vm_sync_state
     set bootstrap_done = true,
         status = 'recuperando',
         updated_at = now()
   where prefixo = v_prefix;

  ok := true; enfileirados := v_count; reason := null;
  return next;
end;
$$;

-- Atraso por VM
create or replace function public.dk_bc_sync_atraso()
returns table (
  prefixo text,
  last_applied_bc_no bigint,
  oficial_last_bc_no bigint,
  atraso bigint,
  pending_count integer,
  status text,
  bootstrap_done boolean
)
language sql
stable
security invoker
set search_path = public, extensions
as $$
  select s.prefixo::text,
         s.last_applied_bc_no,
         st.last_bc_no,
         greatest(st.last_bc_no - s.last_applied_bc_no, 0),
         s.pending_count,
         s.status,
         s.bootstrap_done
    from public.dk_bc_vm_sync_state s
    cross join public.dk_bc_state st
   where st.id = 1
   order by s.prefixo;
$$;

-- Hook: após confirmar BC, enfileira sync (sem aplicar automaticamente em prod).
create or replace function public.dk_bc_sync_apos_confirmar()
returns trigger
language plpgsql
security invoker
set search_path = public, extensions
as $$
begin
  if tg_op = 'INSERT' then
    perform public.dk_bc_sync_enfileirar(new.bc_id);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_dk_bc_sync_apos_confirmar on public.dk_bc_registro;
create trigger trg_dk_bc_sync_apos_confirmar
  after insert on public.dk_bc_registro
  for each row execute function public.dk_bc_sync_apos_confirmar();

alter table public.dk_bc_vm_sync_state enable row level security;
alter table public.dk_bc_vm_sync_entrega enable row level security;
alter table public.dk_bc_vm_projecao enable row level security;
alter table public.dk_bc_vm_sync_falha enable row level security;

revoke all on table public.dk_bc_vm_sync_state from public, anon, authenticated;
revoke all on table public.dk_bc_vm_sync_entrega from public, anon, authenticated;
revoke all on table public.dk_bc_vm_projecao from public, anon, authenticated;
revoke all on table public.dk_bc_vm_sync_falha from public, anon, authenticated;

grant select, insert, update on table public.dk_bc_vm_sync_state to service_role;
grant select, insert, update on table public.dk_bc_vm_sync_entrega to service_role;
grant select, insert, update on table public.dk_bc_vm_projecao to service_role;
grant select, insert on table public.dk_bc_vm_sync_falha to service_role;

revoke all on function public.dk_bc_sync_enfileirar(text) from public, anon, authenticated;
grant execute on function public.dk_bc_sync_enfileirar(text) to service_role;
revoke all on function public.dk_bc_sync_aplicar_lote(text, integer, text, text) from public, anon, authenticated;
grant execute on function public.dk_bc_sync_aplicar_lote(text, integer, text, text) to service_role;
revoke all on function public.dk_bc_sync_bootstrap_vm(text, bigint) from public, anon, authenticated;
grant execute on function public.dk_bc_sync_bootstrap_vm(text, bigint) to service_role;
revoke all on function public.dk_bc_sync_atraso() from public, anon, authenticated;
grant execute on function public.dk_bc_sync_atraso() to service_role;

notify pgrst, 'reload schema';
