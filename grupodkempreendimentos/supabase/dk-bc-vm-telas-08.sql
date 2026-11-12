-- COMANDO 08/10 — Ligação sessão autenticada ↔ VM lógica + consulta de projeção.
-- Aditivo. Não atribui colaboradores. Não ativa VMs. Não bootstrap em produção.
-- Não consome BC. Worker automático permanece DESATIVADO.

-- ========== Status de entrega: filtragem reabrível ==========
do $$
declare
  cname text;
begin
  select con.conname into cname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
   where nsp.nspname = 'public'
     and rel.relname = 'dk_bc_vm_sync_entrega'
     and con.contype = 'c'
     and pg_get_constraintdef(con.oid) ilike '%status%';
  if cname is not null then
    execute format('alter table public.dk_bc_vm_sync_entrega drop constraint %I', cname);
  end if;
end $$;

alter table public.dk_bc_vm_sync_entrega
  add constraint dk_bc_vm_sync_entrega_status_chk
  check (status in (
    'pendente', 'aplicado', 'falhou', 'ignorado',
    'filtrado_escopo', 'pendente_classificacao'
  ));

create index if not exists dk_bc_vm_sync_entrega_reabrir_idx
  on public.dk_bc_vm_sync_entrega (prefixo, bc_no)
  where status in ('filtrado_escopo', 'pendente_classificacao', 'falhou', 'pendente');

-- ========== Snapshot mínimo (sem payload de outra empresa) ==========
create or replace function public.dk_bc_sync_snapshot_minimo(p_reg public.dk_bc_registro)
returns jsonb
language sql
immutable
as $$
  select jsonb_build_object(
    'bc_id', p_reg.bc_id,
    'bc_no', p_reg.bc_no,
    'origem', p_reg.origem,
    'registro_id', p_reg.registro_id,
    'empresa_id', p_reg.empresa_id,
    'filial_id', p_reg.filial_id,
    'estado', p_reg.estado,
    'vigente', p_reg.vigente,
    'bc_anterior', p_reg.bc_anterior,
    'conteudo_hash', p_reg.conteudo_hash
  );
$$;

create or replace function public.dk_bc_sync_enfileirar(p_bc_id text)
returns table (ok boolean, entregas integer, reason text)
language plpgsql
security invoker
set search_path = public, extensions
as $$
declare
  v_reg public.dk_bc_registro%rowtype;
  v_count int := 0;
  v_snap jsonb;
begin
  select * into v_reg from public.dk_bc_registro r where r.bc_id = p_bc_id;
  if not found then
    ok := false; entregas := 0; reason := 'bc_inexistente';
    return next; return;
  end if;

  -- Snapshot só com metadados; payload completo NÃO é copiado para entregas.
  v_snap := public.dk_bc_sync_snapshot_minimo(v_reg);

  insert into public.dk_bc_vm_sync_entrega (prefixo, bc_id, bc_no, status, payload_snapshot)
  select v.prefixo, v_reg.bc_id, v_reg.bc_no, 'pendente', v_snap
    from public.dk_bc_vm v
  on conflict (prefixo, bc_id) do nothing;

  get diagnostics v_count = row_count;
  ok := true; entregas := v_count; reason := null;
  return next;
end;
$$;

-- ========== Resolver VM pelo colaborador (servidor) ==========
create or replace function public.dk_bc_vm_resolver_colaborador(p_colaborador_ref text)
returns table (
  ok boolean,
  prefixo text,
  vm_id text,
  status text,
  colaborador_ref text,
  tem_escopo boolean,
  autorizada boolean,
  reason text
)
language plpgsql
stable
security invoker
set search_path = public, extensions
as $$
declare
  v_ref text := nullif(btrim(coalesce(p_colaborador_ref,'')),'');
  v_vm public.dk_bc_vm%rowtype;
  v_n int;
begin
  if v_ref is null then
    ok := false; prefixo := null; vm_id := null; status := null;
    colaborador_ref := null; tem_escopo := false; autorizada := false;
    reason := 'colaborador_ref_ausente';
    return next; return;
  end if;

  select count(*)::int into v_n
    from public.dk_bc_vm v
   where lower(btrim(coalesce(v.colaborador_ref,''))) = lower(v_ref);

  if v_n = 0 then
    ok := false; prefixo := null; vm_id := null; status := null;
    colaborador_ref := v_ref; tem_escopo := false; autorizada := false;
    reason := 'vm_sem_vinculo';
    return next; return;
  end if;

  if v_n > 1 then
    ok := false; prefixo := null; vm_id := null; status := null;
    colaborador_ref := v_ref; tem_escopo := false; autorizada := false;
    reason := 'vinculo_ambiguo';
    return next; return;
  end if;

  select * into v_vm
    from public.dk_bc_vm v
   where lower(btrim(coalesce(v.colaborador_ref,''))) = lower(v_ref);

  ok := true;
  prefixo := v_vm.prefixo;
  vm_id := v_vm.vm_id;
  status := v_vm.status;
  colaborador_ref := v_vm.colaborador_ref;
  tem_escopo := public.dk_bc_vm_tem_escopo(v_vm.prefixo);
  autorizada := (v_vm.status = 'ativa' and tem_escopo);
  reason := case
    when v_vm.status <> 'ativa' then 'vm_nao_ativa'
    when not tem_escopo then 'sem_escopo_autorizado'
    else null
  end;
  return next;
end;
$$;

-- ========== Consulta de projeção (somente vigente/autorizada) ==========
create or replace function public.dk_bc_vm_projecao_listar(
  p_prefixo text,
  p_after_bc_no bigint default 0,
  p_limite integer default 200
)
returns table (
  bc_id text,
  bc_no bigint,
  origem text,
  registro_id text,
  empresa_id text,
  filial_id text,
  estado text,
  vigente boolean,
  bc_anterior text,
  conteudo_hash text,
  applied_at timestamptz
)
language plpgsql
stable
security invoker
set search_path = public, extensions
as $$
declare
  v_prefix char(1) := upper(nullif(btrim(coalesce(p_prefixo,'')),''));
  v_lim int := greatest(1, least(coalesce(p_limite, 200), 1000));
  v_after bigint := greatest(coalesce(p_after_bc_no, 0), 0);
begin
  if v_prefix is null or v_prefix !~ '^[A-J]$' then
    return;
  end if;
  if not public.dk_bc_vm_tem_escopo(v_prefix) then
    return;
  end if;

  return query
  select p.bc_id, p.bc_no, p.origem, p.registro_id, p.empresa_id, p.filial_id,
         p.estado, p.vigente, p.bc_anterior, p.conteudo_hash, p.applied_at
    from public.dk_bc_vm_projecao p
   where p.prefixo = v_prefix
     and p.bc_no > v_after
     and public.dk_bc_vm_escopo_autoriza(v_prefix, p.empresa_id, p.filial_id)
   order by p.bc_no
   limit v_lim;
end;
$$;

-- ========== Reconciliar após mudança de escopo ==========
create or replace function public.dk_bc_vm_reconciliar_escopo(p_prefixo text)
returns table (ok boolean, reabertos integer, reason text)
language plpgsql
security invoker
set search_path = public, extensions
as $$
declare
  v_prefix char(1) := upper(nullif(btrim(coalesce(p_prefixo,'')),''));
  v_n int := 0;
begin
  if v_prefix is null or v_prefix !~ '^[A-J]$' then
    ok := false; reabertos := 0; reason := 'prefixo_invalido';
    return next; return;
  end if;
  if not public.dk_bc_vm_tem_escopo(v_prefix) then
    ok := false; reabertos := 0; reason := 'sem_escopo_autorizado';
    return next; return;
  end if;

  update public.dk_bc_vm_sync_entrega e
     set status = 'pendente',
         last_error = 'reaberto_por_escopo',
         applied_at = null,
         updated_at = now()
   where e.prefixo = v_prefix
     and e.status in ('filtrado_escopo', 'pendente_classificacao')
     and exists (
       select 1 from public.dk_bc_registro r
        where r.bc_id = e.bc_id
          and nullif(btrim(coalesce(r.empresa_id,'')),'') is not null
          and public.dk_bc_vm_escopo_autoriza(v_prefix, r.empresa_id, r.filial_id)
     );

  get diagnostics v_n = row_count;

  -- Recua o cursor para imediatamente antes do menor evento reaberto,
  -- permitindo reaplicar sem reprocessar entregas já 'aplicado'.
  if v_n > 0 then
    update public.dk_bc_vm_sync_state s
       set last_applied_bc_no = greatest(
             0,
             least(
               s.last_applied_bc_no,
               coalesce((
                 select min(e.bc_no) - 1
                   from public.dk_bc_vm_sync_entrega e
                  where e.prefixo = v_prefix
                    and e.status = 'pendente'
                    and e.last_error = 'reaberto_por_escopo'
               ), s.last_applied_bc_no)
             )
           ),
           status = 'atrasada',
           updated_at = now()
     where s.prefixo = v_prefix;
  end if;

  ok := true; reabertos := v_n; reason := null;
  return next;
end;
$$;

-- ========== aplicar_lote: classificacao / filtrado reabrível ==========
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
  v_lim int := greatest(1, least(coalesce(p_limite, 100), 1000));
  v_force_bc text := nullif(current_setting('dk.bc_sync_force_fail_bc_id', true), '');
  v_blocked boolean := false;
begin
  if p_empresa_id is not null or p_filial_id is not null then
    null;
  end if;

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

  if not public.dk_bc_vm_tem_escopo(v_prefix) then
    update public.dk_bc_vm_sync_state
       set last_attempt_at = now(), last_error = 'sem_escopo_autorizado',
           status = 'ociosa', updated_at = now()
     where prefixo = v_prefix;
    ok := false; aplicados := 0; last_bc_no := v_state.last_applied_bc_no;
    reason := 'sem_escopo_autorizado';
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
    if v_force_bc is not null and v_row.bc_id = v_force_bc then
      insert into public.dk_bc_vm_sync_falha (prefixo, bc_no, bc_id, fase, detalhe)
      values (v_prefix, v_row.bc_no, v_row.bc_id, 'aplicar', 'falha_injetada_teste');
      update public.dk_bc_vm_sync_entrega
         set status = 'falhou', attempt_count = attempt_count + 1,
             last_error = 'falha_injetada_teste', updated_at = now()
       where id = v_row.id;
      v_blocked := true;
      exit;
    end if;

    select * into v_reg from public.dk_bc_registro r where r.bc_id = v_row.bc_id;
    if not found then
      insert into public.dk_bc_vm_sync_falha (prefixo, bc_no, bc_id, fase, detalhe)
      values (v_prefix, v_row.bc_no, v_row.bc_id, 'aplicar', 'bc_ausente_no_catalogo');
      update public.dk_bc_vm_sync_entrega
         set status = 'falhou', attempt_count = attempt_count + 1,
             last_error = 'bc_ausente_no_catalogo', updated_at = now()
       where id = v_row.id;
      v_blocked := true;
      exit;
    end if;

    if nullif(btrim(coalesce(v_reg.empresa_id,'')),'') is null then
      -- Pendência de classificação: NÃO é público; reabrível quando classificado.
      update public.dk_bc_vm_sync_entrega
         set status = 'pendente_classificacao',
             last_error = 'registro_sem_empresa',
             applied_at = now(), updated_at = now()
       where id = v_row.id;
    elsif not public.dk_bc_vm_escopo_autoriza(v_prefix, v_reg.empresa_id, v_reg.filial_id) then
      update public.dk_bc_vm_sync_entrega
         set status = 'filtrado_escopo',
             last_error = 'fora_do_escopo',
             applied_at = now(), updated_at = now()
       where id = v_row.id;
    else
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
           set status = 'ignorado', last_error = 'versao_atrasada',
               applied_at = now(), updated_at = now()
         where id = v_row.id;
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

        update public.dk_bc_vm_sync_entrega
           set status = 'aplicado', applied_at = now(),
               attempt_count = attempt_count + 1, last_error = null, updated_at = now()
         where id = v_row.id;

        v_n := v_n + 1;
      end if;
    end if;

    update public.dk_bc_vm_sync_state
       set last_applied_bc_no = v_row.bc_no,
           last_success_at = now(),
           attempt_count = attempt_count + 1,
           last_error = null,
           updated_at = now()
     where prefixo = v_prefix
       and last_applied_bc_no < v_row.bc_no;

    v_state.last_applied_bc_no := greatest(v_state.last_applied_bc_no, v_row.bc_no);
  end loop;

  update public.dk_bc_vm_sync_state s
     set status = case
           when v_blocked then 'erro'
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
  ok := not v_blocked; aplicados := v_n;
  reason := case when v_blocked then 'cursor_bloqueado_por_falha' else null end;
  return next;
end;
$$;

-- ========== Sinal de projeção atualizada (aviso; PG continua oficial) ==========
create table if not exists public.dk_bc_vm_sinal (
  prefixo char(1) primary key references public.dk_bc_vm (prefixo),
  last_bc_no bigint not null default 0,
  updated_at timestamptz not null default now()
);

insert into public.dk_bc_vm_sinal (prefixo)
select prefixo from public.dk_bc_vm
on conflict (prefixo) do nothing;

create or replace function public.dk_bc_vm_sinal_apos_projecao()
returns trigger
language plpgsql
security invoker
set search_path = public, extensions
as $$
begin
  insert into public.dk_bc_vm_sinal (prefixo, last_bc_no, updated_at)
  values (new.prefixo, new.bc_no, now())
  on conflict (prefixo) do update
    set last_bc_no = greatest(public.dk_bc_vm_sinal.last_bc_no, excluded.last_bc_no),
        updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_dk_bc_vm_sinal_apos_projecao on public.dk_bc_vm_projecao;
create trigger trg_dk_bc_vm_sinal_apos_projecao
  after insert or update on public.dk_bc_vm_projecao
  for each row execute function public.dk_bc_vm_sinal_apos_projecao();

create or replace function public.dk_bc_vm_sinal_ler(p_prefixo text)
returns table (prefixo text, last_bc_no bigint, updated_at timestamptz)
language sql
stable
security invoker
set search_path = public, extensions
as $$
  select s.prefixo::text, s.last_bc_no, s.updated_at
    from public.dk_bc_vm_sinal s
   where s.prefixo = upper(nullif(btrim(coalesce(p_prefixo,'')),''));
$$;

-- Procedimento administrativo (NÃO executa atribuição automática).
comment on function public.dk_bc_vm_resolver_colaborador(text) is
  'Resolve VM pelo colaborador_ref oficial. Atribuição de colaboradores é procedimento admin separado — nunca pelo browser.';

alter table public.dk_bc_vm_sinal enable row level security;
revoke all on table public.dk_bc_vm_sinal from public, anon, authenticated;
grant select, insert, update on table public.dk_bc_vm_sinal to service_role;

revoke all on function public.dk_bc_vm_resolver_colaborador(text) from public, anon, authenticated;
grant execute on function public.dk_bc_vm_resolver_colaborador(text) to service_role;
revoke all on function public.dk_bc_vm_projecao_listar(text, bigint, integer) from public, anon, authenticated;
grant execute on function public.dk_bc_vm_projecao_listar(text, bigint, integer) to service_role;
revoke all on function public.dk_bc_vm_reconciliar_escopo(text) from public, anon, authenticated;
grant execute on function public.dk_bc_vm_reconciliar_escopo(text) to service_role;
revoke all on function public.dk_bc_vm_sinal_ler(text) from public, anon, authenticated;
grant execute on function public.dk_bc_vm_sinal_ler(text) to service_role;
revoke all on function public.dk_bc_sync_aplicar_lote(text, integer, text, text) from public, anon, authenticated;
grant execute on function public.dk_bc_sync_aplicar_lote(text, integer, text, text) to service_role;
revoke all on function public.dk_bc_sync_enfileirar(text) from public, anon, authenticated;
grant execute on function public.dk_bc_sync_enfileirar(text) to service_role;

notify pgrst, 'reload schema';
