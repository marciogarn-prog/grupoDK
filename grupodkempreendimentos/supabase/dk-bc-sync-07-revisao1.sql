-- COMANDO 07/10 — REVISÃO 1
-- Cursor contínuo (não ultrapassa falha), escopo central empresa/filial,
-- substituição histórica com validação diferida.
-- Aditivo. Não ativa worker. Não atribui escopos/colaboradores em produção.
-- Não consome BC. Não altera os 3648 registros existentes.

-- ========== Escopo autorizado por VM (somente infraestrutura central) ==========
create table if not exists public.dk_bc_vm_escopo (
  id uuid primary key default gen_random_uuid(),
  prefixo char(1) not null references public.dk_bc_vm (prefixo),
  empresa_id text not null check (length(btrim(empresa_id)) > 0),
  filial_id text null,
  created_at timestamptz not null default now(),
  unique (prefixo, empresa_id, filial_id)
);

comment on table public.dk_bc_vm_escopo is
  'Escopos empresa/filial autorizados por VM. Definidos só na infraestrutura central; a VM não escolhe.';

create index if not exists dk_bc_vm_escopo_prefixo_idx
  on public.dk_bc_vm_escopo (prefixo);

alter table public.dk_bc_vm_escopo enable row level security;
revoke all on table public.dk_bc_vm_escopo from public, anon, authenticated;
grant select, insert, update, delete on table public.dk_bc_vm_escopo to service_role;

create or replace function public.dk_bc_vm_tem_escopo(p_prefixo text)
returns boolean
language sql
stable
security invoker
set search_path = public, extensions
as $$
  select exists (
    select 1 from public.dk_bc_vm_escopo e
     where e.prefixo = upper(nullif(btrim(coalesce(p_prefixo,'')),''))
  );
$$;

create or replace function public.dk_bc_vm_escopo_autoriza(
  p_prefixo text,
  p_empresa_id text,
  p_filial_id text
)
returns boolean
language sql
stable
security invoker
set search_path = public, extensions
as $$
  select case
    when nullif(btrim(coalesce(p_empresa_id,'')),'') is null then false
    when not public.dk_bc_vm_tem_escopo(p_prefixo) then false
    else exists (
      select 1
        from public.dk_bc_vm_escopo e
       where e.prefixo = upper(nullif(btrim(coalesce(p_prefixo,'')),''))
         and e.empresa_id = btrim(p_empresa_id)
         and (
           e.filial_id is null
           or e.filial_id = nullif(btrim(coalesce(p_filial_id,'')),'')
         )
    )
  end;
$$;

revoke all on function public.dk_bc_vm_tem_escopo(text) from public, anon, authenticated;
grant execute on function public.dk_bc_vm_tem_escopo(text) to service_role;
revoke all on function public.dk_bc_vm_escopo_autoriza(text, text, text) from public, anon, authenticated;
grant execute on function public.dk_bc_vm_escopo_autoriza(text, text, text) to service_role;

-- ========== 3) Substituição histórica — BEFORE + CONSTRAINT diferido ==========
create or replace function public.dk_bc_registro_proteger()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'dk_bc_registro_imutavel' using errcode = '42501';
  end if;

  if tg_op = 'UPDATE' then
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

    if old.vigente = false and new.vigente = true then
      raise exception 'dk_bc_registro_nao_reativa' using errcode = '42501';
    end if;

    -- true→false sem substituido_por: permitido só temporariamente na mesma transação
    -- (dk_bc_confirmar). A CONSTRAINT TRIGGER diferida exige sucessor no COMMIT.

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

create or replace function public.dk_bc_registro_subst_commit()
returns trigger
language plpgsql
as $$
declare
  v_cur public.dk_bc_registro%rowtype;
begin
  -- Relê o estado final na transação (NEW de trigger diferida pode ser intermediário).
  select * into v_cur from public.dk_bc_registro r where r.bc_id = new.bc_id;
  if not found then
    return null;
  end if;

  -- No fechamento da transação: versão desmarcada exige sucessor válido.
  if v_cur.vigente is false and v_cur.substituido_por is null then
    raise exception 'dk_bc_registro_vigente_sem_sucessor' using errcode = '23514';
  end if;

  if v_cur.substituido_por is not null then
    if not exists (
      select 1 from public.dk_bc_registro s
       where s.bc_id = v_cur.substituido_por
         and s.bc_anterior = v_cur.bc_id
         and s.origem = v_cur.origem
         and s.registro_id = v_cur.registro_id
         and coalesce(s.empresa_id,'') = coalesce(v_cur.empresa_id,'')
         and coalesce(s.filial_id,'') = coalesce(v_cur.filial_id,'')
    ) then
      raise exception 'dk_bc_registro_sucessor_invalido' using errcode = '23514';
    end if;
  end if;

  return null;
end;
$$;

drop trigger if exists trg_dk_bc_registro_subst_commit on public.dk_bc_registro;
create constraint trigger trg_dk_bc_registro_subst_commit
  after update of vigente, substituido_por on public.dk_bc_registro
  deferrable initially deferred
  for each row
  when (
    (old.vigente is distinct from new.vigente)
    or (old.substituido_por is distinct from new.substituido_por)
  )
  execute function public.dk_bc_registro_subst_commit();

-- ========== 1+2) aplicar_lote: cursor contínuo + escopo central ==========
-- Mantém assinatura (prefixo, limite, empresa, filial) por compatibilidade,
-- mas p_empresa_id/p_filial_id NÃO autorizam — escopo vem só de dk_bc_vm_escopo.
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
  -- p_empresa_id / p_filial_id deliberadamente ignorados (autorização só via dk_bc_vm_escopo).
  if p_empresa_id is not null or p_filial_id is not null then
    null; -- parâmetros forjados não alteram autorização
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

  -- Sem vínculo oficial de escopo: negar acesso operacional (VM permanece preparada).
  if not public.dk_bc_vm_tem_escopo(v_prefix) then
    update public.dk_bc_vm_sync_state
       set last_attempt_at = now(),
           last_error = 'sem_escopo_autorizado',
           status = 'ociosa',
           updated_at = now()
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
    -- Falha injetada (somente testes isolados via SET LOCAL)
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
      -- Cursor NÃO avança; eventos posteriores não são processados.
      v_blocked := true;
      exit;
    end if;

    -- Registro sem empresa: NÃO é público — descarte durável por regra de autorização.
    if nullif(btrim(coalesce(v_reg.empresa_id,'')),'') is null then
      update public.dk_bc_vm_sync_entrega
         set status = 'ignorado', last_error = 'registro_sem_empresa',
             applied_at = now(), updated_at = now()
       where id = v_row.id;
    elsif not public.dk_bc_vm_escopo_autoriza(v_prefix, v_reg.empresa_id, v_reg.filial_id) then
      -- Fora do escopo central: descarte durável (não grava projeção).
      update public.dk_bc_vm_sync_entrega
         set status = 'ignorado', last_error = 'fora_do_escopo',
             applied_at = now(), updated_at = now()
       where id = v_row.id;
    else
      -- Não aplicar versão antiga sobre mais recente na projeção
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

    -- Avanço atômico do cursor só após resultado durável (aplicado ou ignorado).
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
         last_error = case when v_blocked then coalesce(s.last_error, 'evento_bloqueado') else s.last_error end,
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

-- Bootstrap: não inventa eventos; ainda não aplica. Escopo é checado em aplicar_lote.
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

  -- Bootstrap estrutural permitido; aplicação operacional exige escopo.
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

-- Enfileirar: mantém distribuição a todas as VMs; autorização na aplicação.
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

revoke all on function public.dk_bc_sync_aplicar_lote(text, integer, text, text) from public, anon, authenticated;
grant execute on function public.dk_bc_sync_aplicar_lote(text, integer, text, text) to service_role;
revoke all on function public.dk_bc_sync_bootstrap_vm(text, bigint) from public, anon, authenticated;
grant execute on function public.dk_bc_sync_bootstrap_vm(text, bigint) to service_role;
revoke all on function public.dk_bc_sync_enfileirar(text) from public, anon, authenticated;
grant execute on function public.dk_bc_sync_enfileirar(text) to service_role;

notify pgrst, 'reload schema';
