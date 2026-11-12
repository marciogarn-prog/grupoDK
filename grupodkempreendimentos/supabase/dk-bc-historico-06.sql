-- COMANDO 06/10 — Histórico permanente, substituição lógica, evento imutável (pré-sync).
-- Aditivo. Não renumerar os 3648. Não ativar VMs. Não distribuir às VMs (07/10).

alter table public.dk_bc_registro
  add column if not exists substituido_por text null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'dk_bc_registro_substituido_por_fkey'
  ) then
    alter table public.dk_bc_registro
      add constraint dk_bc_registro_substituido_por_fkey
      foreign key (substituido_por) references public.dk_bc_registro (bc_id);
  end if;
end $$;

create index if not exists dk_bc_registro_substituido_por_idx
  on public.dk_bc_registro (substituido_por)
  where substituido_por is not null;

create table if not exists public.dk_bc_evento_versao (
  id uuid primary key default gen_random_uuid(),
  evento_no bigserial not null unique,
  bc_id text not null references public.dk_bc_registro (bc_id),
  bc_no bigint not null,
  bc_anterior text null,
  operation_id uuid not null,
  vm_prefix char(1) null check (vm_prefix is null or vm_prefix ~ '^[A-J]$'),
  vm_prov_id text null,
  origem text not null,
  registro_id text not null,
  empresa_id text null,
  filial_id text null,
  categoria text not null,
  subcategoria text not null default '',
  estado text not null,
  tipo_alteracao text not null,
  hash_integridade text null,
  conteudo_hash text not null,
  payload jsonb not null default '{}'::jsonb,
  confirmado_em timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint dk_bc_evento_versao_payload_object check (jsonb_typeof(payload) = 'object'),
  constraint dk_bc_evento_versao_tipo_chk check (
    tipo_alteracao in (
      'inclusao_inicial',
      'alteracao_cadastral',
      'alteracao_financeira',
      'atualizacao_contrato',
      'mudanca_estado',
      'exclusao_logica',
      'reativacao',
      'encerramento',
      'substituicao'
    )
  )
);

create unique index if not exists dk_bc_evento_versao_bc_uidx
  on public.dk_bc_evento_versao (bc_id);

create index if not exists dk_bc_evento_versao_registro_idx
  on public.dk_bc_evento_versao (origem, registro_id, confirmado_em);

comment on table public.dk_bc_evento_versao is
  'Evento imutável de versão BC para futura distribuição às VMs (não ativado nesta etapa).';

create or replace function public.dk_bc_evento_proteger()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'dk_bc_evento_imutavel' using errcode = '42501';
  end if;
  if tg_op = 'UPDATE' then
    raise exception 'dk_bc_evento_imutavel' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_dk_bc_evento_proteger on public.dk_bc_evento_versao;
create trigger trg_dk_bc_evento_proteger
  before update or delete on public.dk_bc_evento_versao
  for each row execute function public.dk_bc_evento_proteger();

create or replace function public.dk_bc_tipo_alteracao(p_estado text, p_bc_anterior text)
returns text
language sql
immutable
as $$
  select case
    when p_bc_anterior is null then 'inclusao_inicial'
    when lower(coalesce(p_estado,'')) in ('excluido','excluido_logico','excluído','excluído_lógico') then 'exclusao_logica'
    when lower(coalesce(p_estado,'')) in ('reativado','reativacao','reativação') then 'reativacao'
    when lower(coalesce(p_estado,'')) in ('encerrado','encerramento','finalizado') then 'encerramento'
    when lower(coalesce(p_estado,'')) in ('financeiro','alteracao_financeira') then 'alteracao_financeira'
    when lower(coalesce(p_estado,'')) in ('contrato','atualizacao_contrato') then 'atualizacao_contrato'
    when lower(coalesce(p_estado,'')) in ('cadastral','alteracao_cadastral') then 'alteracao_cadastral'
    else 'substituicao'
  end;
$$;

-- Consulta segura do histórico de um registro lógico (sem PII além do que já está no BC).
create or replace function public.dk_bc_historico(
  p_origem text,
  p_registro_id text,
  p_empresa_id text default null,
  p_filial_id text default null
)
returns table (
  bc_id text,
  bc_no bigint,
  bc_anterior text,
  substituido_por text,
  vigente boolean,
  estado text,
  versao_bc text,
  confirmado_em timestamptz,
  hash_integridade text,
  conteudo_hash text,
  vm_prefix text,
  vm_prov_id text,
  bc_composto text,
  primeiro_bc text,
  bc_vigente text,
  tipo_alteracao text
)
language plpgsql
stable
security invoker
set search_path = public, extensions
as $$
declare
  v_emp text := nullif(btrim(coalesce(p_empresa_id,'')),'');
  v_fil text := nullif(btrim(coalesce(p_filial_id,'')),'');
  v_primeiro text;
  v_vigente text;
begin
  if nullif(btrim(coalesce(p_origem,'')),'') is null
     or nullif(btrim(coalesce(p_registro_id,'')),'') is null then
    return;
  end if;

  select r.bc_id into v_primeiro
    from public.dk_bc_registro r
   where r.origem = btrim(p_origem)
     and r.registro_id = btrim(p_registro_id)
     and coalesce(r.empresa_id,'') = coalesce(v_emp,'')
     and coalesce(r.filial_id,'') = coalesce(v_fil,'')
     and r.bc_anterior is null
   order by r.bc_no
   limit 1;

  select r.bc_id into v_vigente
    from public.dk_bc_registro r
   where r.origem = btrim(p_origem)
     and r.registro_id = btrim(p_registro_id)
     and coalesce(r.empresa_id,'') = coalesce(v_emp,'')
     and coalesce(r.filial_id,'') = coalesce(v_fil,'')
     and r.vigente = true
   limit 1;

  return query
  select
    r.bc_id,
    r.bc_no,
    r.bc_anterior,
    r.substituido_por,
    r.vigente,
    r.estado,
    r.versao_bc,
    r.confirmado_em,
    r.hash_integridade,
    r.conteudo_hash,
    coalesce(o.vm_prefix, nullif(r.payload->>'vm_prefixo',''))::text,
    coalesce(o.vm_provisorio, nullif(r.payload->>'vm_prov_id',''))::text,
    o.bc_composto,
    v_primeiro,
    v_vigente,
    public.dk_bc_tipo_alteracao(r.estado, r.bc_anterior)
  from public.dk_bc_registro r
  left join public.dk_bc_operacao o on o.bc_id = r.bc_id and o.status = 'confirmado'
  where r.origem = btrim(p_origem)
    and r.registro_id = btrim(p_registro_id)
    and coalesce(r.empresa_id,'') = coalesce(v_emp,'')
    and coalesce(r.filial_id,'') = coalesce(v_fil,'')
  order by r.bc_no;
end;
$$;

create or replace function public.dk_bc_confirmar(
  p_operation_id uuid,
  p_vm_provisorio text,
  p_categoria text,
  p_subcategoria text,
  p_origem text,
  p_registro_id text,
  p_empresa_id text,
  p_filial_id text,
  p_estado text,
  p_bc_anterior text,
  p_hash_integridade text,
  p_historico_ref text,
  p_payload jsonb
)
returns table (
  ok boolean,
  bc_id text,
  bc_no bigint,
  bc_composto text,
  status text,
  idempotent boolean,
  reason text
)
language plpgsql
security invoker
set search_path = public, extensions
as $$
#variable_conflict use_column
declare
  v_exist public.dk_bc_operacao%rowtype;
  v_exist_vm public.dk_bc_operacao%rowtype;
  v_prev public.dk_bc_registro%rowtype;
  v_vig public.dk_bc_registro%rowtype;
  v_had_op boolean := false;
  v_has_vig boolean := false;
  v_no bigint;
  v_bc text;
  v_composto text;
  v_prefix text;
  v_prov text;
  v_estado text;
  v_sub text;
  v_payload jsonb;
  v_emp text;
  v_fil text;
  v_ant text;
  v_hash text;
  v_hash_int text;
  v_hist text;
  v_tipo text;
begin
  if p_operation_id is null then
    ok := false; bc_id := null; bc_no := null; bc_composto := null;
    status := null; idempotent := false; reason := 'operation_id_ausente';
    return next; return;
  end if;
  if p_categoria is null or btrim(p_categoria) = '' then
    ok := false; bc_id := null; bc_no := null; bc_composto := null;
    status := null; idempotent := false; reason := 'categoria_vazia';
    return next; return;
  end if;
  if p_origem is null or btrim(p_origem) = '' then
    ok := false; bc_id := null; bc_no := null; bc_composto := null;
    status := null; idempotent := false; reason := 'origem_vazia';
    return next; return;
  end if;
  if p_registro_id is null or btrim(p_registro_id) = '' then
    ok := false; bc_id := null; bc_no := null; bc_composto := null;
    status := null; idempotent := false; reason := 'registro_id_vazio';
    return next; return;
  end if;

  v_payload := coalesce(p_payload, '{}'::jsonb);
  if jsonb_typeof(v_payload) <> 'object' then
    ok := false; bc_id := null; bc_no := null; bc_composto := null;
    status := null; idempotent := false; reason := 'payload_invalido';
    return next; return;
  end if;

  v_prov := nullif(btrim(coalesce(p_vm_provisorio, '')), '');
  v_prefix := null;
  if v_prov is not null then
    if v_prov !~ '^[A-J][0-9]{1,12}$' then
      ok := false; bc_id := null; bc_no := null; bc_composto := null;
      status := null; idempotent := false; reason := 'vm_provisorio_invalido';
      return next; return;
    end if;
    v_prefix := substr(v_prov, 1, 1);
  end if;

  v_estado := coalesce(nullif(btrim(coalesce(p_estado, '')), ''), 'consolidado');
  v_sub := coalesce(p_subcategoria, '');
  v_emp := nullif(btrim(coalesce(p_empresa_id, '')), '');
  v_fil := nullif(btrim(coalesce(p_filial_id, '')), '');
  v_ant := nullif(btrim(coalesce(p_bc_anterior, '')), '');
  v_hash_int := nullif(btrim(coalesce(p_hash_integridade, '')), '');
  v_hist := nullif(btrim(coalesce(p_historico_ref, '')), '');
  v_hash := public.dk_bc_conteudo_hash(
    btrim(p_categoria), v_sub, btrim(p_origem), btrim(p_registro_id),
    coalesce(v_emp, ''), coalesce(v_fil, ''), v_estado,
    coalesce(v_ant, ''), coalesce(v_hash_int, ''), coalesce(v_hist, ''), v_payload
  );
  v_tipo := public.dk_bc_tipo_alteracao(v_estado, v_ant);

  perform 1 from public.dk_bc_state where id = 1 for update;

  select * into v_exist from public.dk_bc_operacao where operation_id = p_operation_id;
  if found then
    v_had_op := true;
    if v_exist.status = 'confirmado' then
      if coalesce(v_exist.conteudo_hash, '') <> '' and v_exist.conteudo_hash <> v_hash then
        ok := false; bc_id := null; bc_no := null; bc_composto := null;
        status := 'confirmado'; idempotent := false; reason := 'conteudo_divergente';
        return next; return;
      end if;
      ok := true;
      bc_id := v_exist.bc_id;
      bc_no := (select r.bc_no from public.dk_bc_registro r where r.bc_id = v_exist.bc_id);
      bc_composto := v_exist.bc_composto;
      status := 'confirmado';
      idempotent := true;
      reason := null;
      return next; return;
    end if;
    if v_exist.status = 'rejeitado' then
      ok := false;
      bc_id := null; bc_no := null; bc_composto := null;
      status := 'rejeitado';
      idempotent := true;
      reason := coalesce(v_exist.motivo_rejeicao, 'ja_rejeitado');
      return next; return;
    end if;
  end if;

  if v_prov is not null then
    select * into v_exist_vm from public.dk_bc_operacao where vm_provisorio = v_prov;
    if found then
      if v_exist_vm.operation_id <> p_operation_id then
        ok := false; bc_id := null; bc_no := null; bc_composto := null;
        status := v_exist_vm.status; idempotent := false;
        reason := 'vm_provisorio_em_uso';
        return next; return;
      end if;
      if v_exist_vm.status = 'confirmado' then
        if coalesce(v_exist_vm.conteudo_hash, '') <> '' and v_exist_vm.conteudo_hash <> v_hash then
          ok := false; bc_id := null; bc_no := null; bc_composto := null;
          status := 'confirmado'; idempotent := false; reason := 'conteudo_divergente';
          return next; return;
        end if;
        ok := true;
        bc_id := v_exist_vm.bc_id;
        bc_no := (select r.bc_no from public.dk_bc_registro r where r.bc_id = v_exist_vm.bc_id);
        bc_composto := v_exist_vm.bc_composto;
        status := 'confirmado';
        idempotent := true;
        reason := null;
        return next; return;
      end if;
    end if;
  end if;

  select * into v_vig
    from public.dk_bc_registro r
   where r.origem = btrim(p_origem)
     and r.registro_id = btrim(p_registro_id)
     and coalesce(r.empresa_id, '') = coalesce(v_emp, '')
     and coalesce(r.filial_id, '') = coalesce(v_fil, '')
     and r.vigente = true
   limit 1;
  v_has_vig := found;

  if v_ant is not null then
    select * into v_prev from public.dk_bc_registro r where r.bc_id = v_ant;
    if not found then
      ok := false; bc_id := null; bc_no := null; bc_composto := null;
      status := null; idempotent := false; reason := 'bc_anterior_inexistente';
      return next; return;
    end if;
    if v_prev.origem <> btrim(p_origem)
       or v_prev.registro_id <> btrim(p_registro_id)
       or coalesce(v_prev.empresa_id, '') <> coalesce(v_emp, '')
       or coalesce(v_prev.filial_id, '') <> coalesce(v_fil, '') then
      ok := false; bc_id := null; bc_no := null; bc_composto := null;
      status := null; idempotent := false; reason := 'bc_anterior_entidade_diferente';
      return next; return;
    end if;
    if v_prev.vigente is not true then
      ok := false; bc_id := null; bc_no := null; bc_composto := null;
      status := null; idempotent := false; reason := 'versao_ultrapassada';
      return next; return;
    end if;
    if v_has_vig and v_vig.bc_id <> v_ant then
      ok := false; bc_id := null; bc_no := null; bc_composto := null;
      status := null; idempotent := false; reason := 'versao_ultrapassada';
      return next; return;
    end if;
  else
    if v_has_vig then
      ok := false; bc_id := null; bc_no := null; bc_composto := null;
      status := null; idempotent := false; reason := 'bc_anterior_obrigatorio';
      return next; return;
    end if;
  end if;

  update public.dk_bc_state
     set last_bc_no = last_bc_no + 1,
         updated_at = now()
   where id = 1
  returning last_bc_no into v_no;

  if v_no is null then
    ok := false; bc_id := null; bc_no := null; bc_composto := null;
    status := null; idempotent := false; reason := 'contador_ausente';
    return next; return;
  end if;

  v_bc := public.dk_bc_format(v_no);
  if v_prov is not null then
    v_composto := v_prov || '-' || v_bc;
  else
    v_composto := v_bc;
  end if;

  -- 1) Desmarca vigente da versão anterior (índice único).
  -- 2) Insere a nova versão vigente.
  -- 3) Liga substituido_por após a nova linha existir (FK).
  if v_ant is not null then
    update public.dk_bc_registro
       set vigente = false
     where bc_id = v_ant
       and vigente = true;
  end if;

  insert into public.dk_bc_registro (
    bc_id, bc_no, categoria, subcategoria, origem, registro_id,
    empresa_id, filial_id, estado, versao_bc, bc_anterior, vigente,
    confirmado_em, hash_integridade, historico_ref, conteudo_hash, payload
  ) values (
    v_bc, v_no, btrim(p_categoria), v_sub, btrim(p_origem), btrim(p_registro_id),
    v_emp, v_fil, v_estado, v_bc, v_ant, true,
    now(), v_hash_int, v_hist, v_hash, v_payload
  );

  if v_ant is not null then
    update public.dk_bc_registro
       set substituido_por = v_bc
     where bc_id = v_ant
       and substituido_por is null;
  end if;

  if v_had_op then
    update public.dk_bc_operacao
       set status = 'confirmado',
           bc_id = v_bc,
           bc_composto = v_composto,
           vm_provisorio = coalesce(vm_provisorio, v_prov),
           vm_prefix = coalesce(vm_prefix, v_prefix),
           categoria = btrim(p_categoria),
           subcategoria = v_sub,
           origem = btrim(p_origem),
           registro_id = btrim(p_registro_id),
           empresa_id = v_emp,
           filial_id = v_fil,
           hash_integridade = v_hash_int,
           conteudo_hash = v_hash,
           payload = v_payload,
           motivo_rejeicao = null,
           updated_at = now()
     where id = v_exist.id;
  else
    insert into public.dk_bc_operacao (
      operation_id, vm_provisorio, vm_prefix, status, bc_id, bc_composto,
      categoria, subcategoria, origem, registro_id, empresa_id, filial_id,
      hash_integridade, conteudo_hash, payload
    ) values (
      p_operation_id, v_prov, v_prefix, 'confirmado', v_bc, v_composto,
      btrim(p_categoria), v_sub, btrim(p_origem), btrim(p_registro_id),
      v_emp, v_fil, v_hash_int, v_hash, v_payload
    );
  end if;

  insert into public.dk_bc_evento_versao (
    bc_id, bc_no, bc_anterior, operation_id, vm_prefix, vm_prov_id,
    origem, registro_id, empresa_id, filial_id, categoria, subcategoria,
    estado, tipo_alteracao, hash_integridade, conteudo_hash, payload, confirmado_em
  ) values (
    v_bc, v_no, v_ant, p_operation_id, v_prefix, v_prov,
    btrim(p_origem), btrim(p_registro_id), v_emp, v_fil, btrim(p_categoria), v_sub,
    v_estado, v_tipo, v_hash_int, v_hash, v_payload, now()
  );

  ok := true;
  bc_id := v_bc;
  bc_no := v_no;
  bc_composto := v_composto;
  status := 'confirmado';
  idempotent := false;
  reason := null;
  return next;
end;
$$;

alter table public.dk_bc_evento_versao enable row level security;
revoke all on table public.dk_bc_evento_versao from public, anon, authenticated;
grant select, insert on table public.dk_bc_evento_versao to service_role;

revoke all on function public.dk_bc_tipo_alteracao(text, text)
  from public, anon, authenticated;
grant execute on function public.dk_bc_tipo_alteracao(text, text) to service_role;

revoke all on function public.dk_bc_historico(text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.dk_bc_historico(text, text, text, text) to service_role;

revoke all on function public.dk_bc_confirmar(
  uuid, text, text, text, text, text, text, text, text, text, text, text, jsonb
) from public, anon, authenticated;
grant execute on function public.dk_bc_confirmar(
  uuid, text, text, text, text, text, text, text, text, text, text, text, jsonb
) to service_role;

notify pgrst, 'reload schema';
