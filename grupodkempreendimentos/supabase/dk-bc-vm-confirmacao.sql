-- COMANDO 05/10 — Ponte provisório VM → confirmação BC (aditivo).
-- Não ativa telas. Não consome códigos se não for chamado.
-- Usa dk_bc_vm_emitir_provisorio + dk_bc_confirmar existentes.

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
  v_prefix char(1);
  v_payload jsonb;
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

  -- ETAPA A: garantir provisório (idempotente por operation_id)
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

  -- Já confirmado: idempotência / divergência
  if v_op.status = 'confirmado_bc' then
    ok := true; prov_id := v_op.prov_id; bc_id := v_op.bc_id; bc_no := null;
    bc_composto := v_op.bc_composto; status := v_op.status; idempotent := true; reason := null;
    select r.bc_no into bc_no from public.dk_bc_registro r where r.bc_id = v_op.bc_id;
    return next; return;
  end if;

  if v_op.status in ('rejeitado', 'cancelado') then
    ok := false; prov_id := v_op.prov_id; bc_id := null; bc_no := null; bc_composto := null;
    status := v_op.status; idempotent := false; reason := 'provisorio_nao_confirmavel';
    return next; return;
  end if;

  -- ETAPA B: confirmação central BC com vm_provisorio = prov_id
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
        'fluxo', '05/10'
      )
    );

  if v_conf.ok is distinct from true then
    -- Falha de confirmação preserva o provisório
    ok := false; prov_id := v_op.prov_id; bc_id := null; bc_no := null; bc_composto := null;
    status := 'provisorio'; idempotent := coalesce(v_conf.idempotent, false);
    reason := coalesce(v_conf.reason, 'confirmacao_bc_falhou');
    return next; return;
  end if;

  update public.dk_bc_vm_operacao
     set status = 'confirmado_bc',
         bc_id = v_conf.bc_id,
         bc_composto = v_conf.bc_composto,
         updated_at = now(),
         payload = coalesce(payload, '{}'::jsonb) || jsonb_build_object(
           'confirmado_em', now(),
           'bc_id', v_conf.bc_id,
           'bc_composto', v_conf.bc_composto
         )
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

revoke all on function public.dk_bc_vm_confirmar_oficial(
  uuid, text, text, text, text, text, text, text, text, text, text, text, jsonb
) from public, anon, authenticated;
grant execute on function public.dk_bc_vm_confirmar_oficial(
  uuid, text, text, text, text, text, text, text, text, text, text, text, jsonb
) to service_role;

notify pgrst, 'reload schema';
