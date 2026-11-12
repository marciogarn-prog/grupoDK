-- COMANDO 05/10 — REVISÃO 1
-- Segurança + idempotência VM-BC (conteudo_hash, conflito, autorização).
-- Aditivo. Não consome contadores se as funções não forem chamadas.

alter table public.dk_bc_vm_operacao
  add column if not exists conteudo_hash text not null default '';

create or replace function public.dk_bc_vm_conteudo_hash(
  p_prefixo text,
  p_categoria text,
  p_subcategoria text,
  p_origem text,
  p_registro_id text,
  p_empresa_id text,
  p_filial_id text,
  p_estado text,
  p_hash_integridade text,
  p_payload jsonb
)
returns text
language sql
immutable
set search_path = public, extensions
as $$
  select encode(
    digest(
      convert_to(
        coalesce(p_prefixo,'') || chr(1) ||
        coalesce(p_categoria,'') || chr(1) ||
        coalesce(p_subcategoria,'') || chr(1) ||
        coalesce(p_origem,'') || chr(1) ||
        coalesce(p_registro_id,'') || chr(1) ||
        coalesce(p_empresa_id,'') || chr(1) ||
        coalesce(p_filial_id,'') || chr(1) ||
        coalesce(p_estado,'') || chr(1) ||
        coalesce(p_hash_integridade,'') || chr(1) ||
        coalesce(p_payload::text,'{}'),
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  );
$$;

create or replace function public.dk_bc_vm_emitir_provisorio(
  p_operation_id uuid,
  p_prefixo text,
  p_payload jsonb default '{}'::jsonb
)
returns table (
  ok boolean,
  prov_id text,
  prov_no bigint,
  prefixo text,
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
  v_exist public.dk_bc_vm_operacao%rowtype;
  v_vm public.dk_bc_vm%rowtype;
  v_prefix char(1);
  v_no bigint;
  v_id text;
  v_payload jsonb;
  v_hash text;
begin
  if p_operation_id is null then
    ok := false; prov_id := null; prov_no := null; prefixo := null;
    status := null; idempotent := false; reason := 'operation_id_obrigatorio';
    return next; return;
  end if;

  v_prefix := upper(nullif(btrim(coalesce(p_prefixo, '')), ''));
  if v_prefix is null or v_prefix !~ '^[A-J]$' then
    ok := false; prov_id := null; prov_no := null; prefixo := p_prefixo;
    status := null; idempotent := false; reason := 'prefixo_invalido';
    return next; return;
  end if;

  select * into v_vm from public.dk_bc_vm v where v.prefixo = v_prefix;
  if not found then
    ok := false; prov_id := null; prov_no := null; prefixo := v_prefix;
    status := null; idempotent := false; reason := 'vm_inexistente';
    return next; return;
  end if;
  if v_vm.status = 'suspensa' then
    ok := false; prov_id := null; prov_no := null; prefixo := v_prefix;
    status := null; idempotent := false; reason := 'vm_nao_autorizada';
    return next; return;
  end if;

  v_payload := coalesce(p_payload, '{}'::jsonb);
  if jsonb_typeof(v_payload) <> 'object' then
    ok := false; prov_id := null; prov_no := null; prefixo := v_prefix;
    status := null; idempotent := false; reason := 'payload_invalido';
    return next; return;
  end if;

  select * into v_exist from public.dk_bc_vm_operacao o where o.operation_id = p_operation_id;
  if found then
    if v_exist.prefixo <> v_prefix then
      ok := false; prov_id := v_exist.prov_id; prov_no := v_exist.prov_no; prefixo := v_exist.prefixo;
      status := v_exist.status; idempotent := false; reason := 'conflito';
      return next; return;
    end if;
    if v_exist.payload is distinct from v_payload then
      ok := false; prov_id := v_exist.prov_id; prov_no := v_exist.prov_no; prefixo := v_exist.prefixo;
      status := v_exist.status; idempotent := false; reason := 'conteudo_divergente';
      return next; return;
    end if;
    -- Não substitui payload/conteúdo silenciosamente
    ok := true; prov_id := v_exist.prov_id; prov_no := v_exist.prov_no; prefixo := v_exist.prefixo;
    status := v_exist.status; idempotent := true; reason := null;
    return next; return;
  end if;

  v_hash := public.dk_bc_vm_conteudo_hash(
    v_prefix, '', '', '', '', '', '', '', '', v_payload
  );

  perform 1 from public.dk_bc_vm_state s where s.prefixo = v_prefix for update;
  update public.dk_bc_vm_state s
     set last_prov_no = s.last_prov_no + 1,
         updated_at = now()
   where s.prefixo = v_prefix
   returning s.last_prov_no into v_no;

  if v_no is null then
    ok := false; prov_id := null; prov_no := null; prefixo := v_prefix;
    status := null; idempotent := false; reason := 'contador_ausente';
    return next; return;
  end if;

  v_id := public.dk_bc_vm_format(v_prefix, v_no);

  insert into public.dk_bc_vm_operacao (
    operation_id, prefixo, prov_no, prov_id, status, payload, conteudo_hash
  ) values (
    p_operation_id, v_prefix, v_no, v_id, 'provisorio', v_payload, v_hash
  );

  ok := true; prov_id := v_id; prov_no := v_no; prefixo := v_prefix;
  status := 'provisorio'; idempotent := false; reason := null;
  return next;
end;
$$;

create or replace function public.dk_bc_vm_confirmar_oficial(
  p_operation_id uuid,
  p_prefixo text,
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
  prov_id text,
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
  v_emit record;
  v_conf record;
  v_op public.dk_bc_vm_operacao%rowtype;
  v_reg public.dk_bc_registro%rowtype;
  v_prefix char(1);
  v_payload jsonb;
  v_hash text;
begin
  if p_operation_id is null then
    ok := false; prov_id := null; bc_id := null; bc_no := null; bc_composto := null;
    status := null; idempotent := false; reason := 'operation_id_obrigatorio';
    return next; return;
  end if;

  v_prefix := upper(nullif(btrim(coalesce(p_prefixo, '')), ''));
  if v_prefix is null or v_prefix !~ '^[A-J]$' then
    ok := false; prov_id := null; bc_id := null; bc_no := null; bc_composto := null;
    status := null; idempotent := false; reason := 'prefixo_invalido';
    return next; return;
  end if;

  v_payload := coalesce(p_payload, '{}'::jsonb);
  if jsonb_typeof(v_payload) <> 'object' then
    ok := false; prov_id := null; bc_id := null; bc_no := null; bc_composto := null;
    status := null; idempotent := false; reason := 'payload_invalido';
    return next; return;
  end if;

  v_hash := public.dk_bc_vm_conteudo_hash(
    v_prefix, p_categoria, coalesce(p_subcategoria,''), p_origem, p_registro_id,
    p_empresa_id, p_filial_id, p_estado, p_hash_integridade, v_payload
  );

  -- ETAPA A
  select * into v_emit
    from public.dk_bc_vm_emitir_provisorio(p_operation_id, v_prefix, v_payload);
  if v_emit.ok is distinct from true then
    ok := false; prov_id := v_emit.prov_id; bc_id := null; bc_no := null; bc_composto := null;
    status := v_emit.status; idempotent := coalesce(v_emit.idempotent, false);
    reason := coalesce(v_emit.reason, 'emissao_provisoria_falhou');
    return next; return;
  end if;

  select * into v_op from public.dk_bc_vm_operacao o where o.operation_id = p_operation_id for update;
  if not found then
    ok := false; prov_id := v_emit.prov_id; bc_id := null; bc_no := null; bc_composto := null;
    status := null; idempotent := false; reason := 'provisorio_ausente';
    return next; return;
  end if;

  if v_op.prefixo <> v_prefix then
    ok := false; prov_id := v_op.prov_id; bc_id := v_op.bc_id; bc_no := null; bc_composto := v_op.bc_composto;
    status := v_op.status; idempotent := false; reason := 'conflito';
    return next; return;
  end if;

  -- Provisório: não substituir conteúdo silenciosamente
  if v_op.status = 'provisorio' then
    if v_op.payload is distinct from v_payload then
      ok := false; prov_id := v_op.prov_id; bc_id := null; bc_no := null; bc_composto := null;
      status := v_op.status; idempotent := false; reason := 'conteudo_divergente';
      return next; return;
    end if;
  end if;

  if v_op.status = 'confirmado_bc' then
    if coalesce(v_op.conteudo_hash,'') <> v_hash then
      ok := false; prov_id := v_op.prov_id; bc_id := v_op.bc_id; bc_no := null;
      bc_composto := v_op.bc_composto; status := v_op.status; idempotent := false;
      reason := 'conteudo_divergente';
      return next; return;
    end if;
    select * into v_reg from public.dk_bc_registro r where r.bc_id = v_op.bc_id;
    if not found or v_op.bc_composto is distinct from (v_op.prov_id || '-' || v_op.bc_id) then
      ok := false; prov_id := v_op.prov_id; bc_id := v_op.bc_id; bc_no := null;
      bc_composto := v_op.bc_composto; status := v_op.status; idempotent := false;
      reason := 'integridade_inconsistente';
      return next; return;
    end if;
    ok := true; prov_id := v_op.prov_id; bc_id := v_op.bc_id; bc_no := v_reg.bc_no;
    bc_composto := v_op.bc_composto; status := v_op.status; idempotent := true; reason := null;
    return next; return;
  end if;

  if v_op.status in ('rejeitado', 'cancelado') then
    ok := false; prov_id := v_op.prov_id; bc_id := null; bc_no := null; bc_composto := null;
    status := v_op.status; idempotent := false; reason := 'provisorio_nao_confirmavel';
    return next; return;
  end if;

  select * into v_conf
    from public.dk_bc_confirmar(
      p_operation_id,
      v_op.prov_id,
      p_categoria,
      coalesce(p_subcategoria, ''),
      p_origem,
      p_registro_id,
      p_empresa_id,
      p_filial_id,
      p_estado,
      p_bc_anterior,
      p_hash_integridade,
      p_historico_ref,
      v_payload || jsonb_build_object(
        'vm_prefixo', v_prefix,
        'vm_prov_id', v_op.prov_id,
        'fluxo', '05/10-revisao-1',
        'conteudo_hash', v_hash
      )
    );

  if v_conf.ok is distinct from true then
    ok := false; prov_id := v_op.prov_id; bc_id := null; bc_no := null; bc_composto := null;
    status := 'provisorio'; idempotent := coalesce(v_conf.idempotent, false);
    reason := coalesce(v_conf.reason, 'confirmacao_bc_falhou');
    return next; return;
  end if;

  -- Não alterar payload original (idempotência / anti-substituição silenciosa).
  update public.dk_bc_vm_operacao
     set status = 'confirmado_bc',
         bc_id = v_conf.bc_id,
         bc_composto = v_conf.bc_composto,
         conteudo_hash = v_hash,
         updated_at = now()
   where operation_id = p_operation_id;

  ok := true;
  prov_id := v_op.prov_id;
  bc_id := v_conf.bc_id;
  bc_no := v_conf.bc_no;
  bc_composto := v_conf.bc_composto;
  status := 'confirmado_bc';
  idempotent := coalesce(v_conf.idempotent, false);
  reason := null;
  return next;
end;
$$;

revoke all on function public.dk_bc_vm_conteudo_hash(
  text, text, text, text, text, text, text, text, text, jsonb
) from public, anon, authenticated;
grant execute on function public.dk_bc_vm_conteudo_hash(
  text, text, text, text, text, text, text, text, text, jsonb
) to service_role;

revoke all on function public.dk_bc_vm_emitir_provisorio(uuid, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.dk_bc_vm_emitir_provisorio(uuid, text, jsonb)
  to service_role;

revoke all on function public.dk_bc_vm_confirmar_oficial(
  uuid, text, text, text, text, text, text, text, text, text, text, text, jsonb
) from public, anon, authenticated;
grant execute on function public.dk_bc_vm_confirmar_oficial(
  uuid, text, text, text, text, text, text, text, text, text, text, text, jsonb
) to service_role;

notify pgrst, 'reload schema';
