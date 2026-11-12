-- COMANDO 05/10 — REVISÃO 2
-- Autorização (somente VM ativa + colaborador), integridade imutável,
-- completar_proposta versionado, idempotência sob concorrência.
-- Aditivo. Não ativa VMs. Não atribui colaboradores. Não consome contadores sozinho.

alter table public.dk_bc_vm_operacao
  add column if not exists categoria text null,
  add column if not exists subcategoria text null,
  add column if not exists origem text null,
  add column if not exists registro_id text null,
  add column if not exists empresa_id text null,
  add column if not exists filial_id text null,
  add column if not exists estado text null,
  add column if not exists bc_anterior text null,
  add column if not exists hash_integridade text null,
  add column if not exists proposta_completa boolean not null default false;

comment on column public.dk_bc_vm_operacao.proposta_completa is
  'True quando identidade oficial está travada (completar_proposta ou emissão completa).';

-- Remove overload antigo do hash (REV1) — nova assinatura inclui bc_anterior.
drop function if exists public.dk_bc_vm_conteudo_hash(
  text, text, text, text, text, text, text, text, text, jsonb
);

-- Autorização comprovada no servidor (status + colaborador_ref).
create or replace function public.dk_bc_vm_autorizada_para_operar(p_prefixo text)
returns table (
  ok boolean,
  reason text,
  prefixo text,
  status text,
  colaborador_ref text
)
language plpgsql
stable
security invoker
set search_path = public, extensions
as $$
declare
  v_vm public.dk_bc_vm%rowtype;
  v_prefix char(1);
begin
  v_prefix := upper(nullif(btrim(coalesce(p_prefixo, '')), ''));
  if v_prefix is null or v_prefix !~ '^[A-J]$' then
    ok := false; reason := 'prefixo_invalido'; prefixo := p_prefixo;
    status := null; colaborador_ref := null;
    return next; return;
  end if;

  select * into v_vm from public.dk_bc_vm v where v.prefixo = v_prefix;
  if not found then
    ok := false; reason := 'vm_inexistente'; prefixo := v_prefix;
    status := null; colaborador_ref := null;
    return next; return;
  end if;

  if v_vm.status is distinct from 'ativa' then
    ok := false;
    reason := case
      when v_vm.status = 'preparada' then 'vm_preparada_nao_autorizada'
      when v_vm.status = 'suspensa' then 'vm_suspensa'
      else 'vm_nao_autorizada'
    end;
    prefixo := v_prefix; status := v_vm.status;
    colaborador_ref := v_vm.colaborador_ref;
    return next; return;
  end if;

  if nullif(btrim(coalesce(v_vm.colaborador_ref, '')), '') is null then
    ok := false; reason := 'vm_sem_colaborador'; prefixo := v_prefix;
    status := v_vm.status; colaborador_ref := null;
    return next; return;
  end if;

  ok := true; reason := null; prefixo := v_prefix;
  status := v_vm.status; colaborador_ref := v_vm.colaborador_ref;
  return next;
end;
$$;

create or replace function public.dk_bc_vm_conteudo_hash(
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
        coalesce(p_bc_anterior,'') || chr(1) ||
        coalesce(p_hash_integridade,'') || chr(1) ||
        coalesce(p_payload::text,'{}'),
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  );
$$;

-- Completa identidade travada antes da 1ª confirmação (nunca sobrescreve campos já definidos).
create or replace function public.dk_bc_vm_completar_proposta(
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
  p_payload jsonb default null
)
returns table (
  ok boolean,
  prov_id text,
  proposta_completa boolean,
  conteudo_hash text,
  idempotent boolean,
  reason text
)
language plpgsql
security invoker
set search_path = public, extensions
as $$
#variable_conflict use_column
declare
  v_auth record;
  v_op public.dk_bc_vm_operacao%rowtype;
  v_prefix char(1);
  v_cat text; v_sub text; v_ori text; v_reg text; v_emp text; v_fil text;
  v_est text; v_ant text; v_hi text;
  v_payload jsonb;
  v_hash text;
  v_completa boolean;
begin
  if p_operation_id is null then
    ok := false; prov_id := null; proposta_completa := false; conteudo_hash := null;
    idempotent := false; reason := 'operation_id_obrigatorio';
    return next; return;
  end if;

  v_prefix := upper(nullif(btrim(coalesce(p_prefixo, '')), ''));
  select * into v_auth from public.dk_bc_vm_autorizada_para_operar(v_prefix);
  if v_auth.ok is distinct from true then
    ok := false; prov_id := null; proposta_completa := false; conteudo_hash := null;
    idempotent := false; reason := coalesce(v_auth.reason, 'vm_nao_autorizada');
    return next; return;
  end if;

  select * into v_op from public.dk_bc_vm_operacao o
   where o.operation_id = p_operation_id for update;
  if not found then
    ok := false; prov_id := null; proposta_completa := false; conteudo_hash := null;
    idempotent := false; reason := 'provisorio_ausente';
    return next; return;
  end if;

  if v_op.prefixo <> v_prefix then
    ok := false; prov_id := v_op.prov_id; proposta_completa := v_op.proposta_completa;
    conteudo_hash := v_op.conteudo_hash; idempotent := false; reason := 'conflito';
    return next; return;
  end if;

  if v_op.status <> 'provisorio' then
    ok := false; prov_id := v_op.prov_id; proposta_completa := v_op.proposta_completa;
    conteudo_hash := v_op.conteudo_hash; idempotent := false;
    reason := 'proposta_nao_editavel';
    return next; return;
  end if;

  -- Payload: se já existe e veio outro, divergência (não substitui).
  if p_payload is not null then
    if jsonb_typeof(p_payload) <> 'object' then
      ok := false; prov_id := v_op.prov_id; proposta_completa := v_op.proposta_completa;
      conteudo_hash := v_op.conteudo_hash; idempotent := false; reason := 'payload_invalido';
      return next; return;
    end if;
    if v_op.payload is distinct from p_payload then
      ok := false; prov_id := v_op.prov_id; proposta_completa := v_op.proposta_completa;
      conteudo_hash := v_op.conteudo_hash; idempotent := false; reason := 'conteudo_divergente';
      return next; return;
    end if;
  end if;
  v_payload := v_op.payload;

  -- Campos já travados não podem mudar.
  if v_op.categoria is not null and nullif(btrim(coalesce(p_categoria,'')),'') is not null
     and v_op.categoria is distinct from btrim(p_categoria) then
    ok := false; prov_id := v_op.prov_id; proposta_completa := v_op.proposta_completa;
    conteudo_hash := v_op.conteudo_hash; idempotent := false; reason := 'conteudo_divergente';
    return next; return;
  end if;
  if v_op.origem is not null and nullif(btrim(coalesce(p_origem,'')),'') is not null
     and v_op.origem is distinct from btrim(p_origem) then
    ok := false; prov_id := v_op.prov_id; proposta_completa := v_op.proposta_completa;
    conteudo_hash := v_op.conteudo_hash; idempotent := false; reason := 'conteudo_divergente';
    return next; return;
  end if;
  if v_op.registro_id is not null and nullif(btrim(coalesce(p_registro_id,'')),'') is not null
     and v_op.registro_id is distinct from btrim(p_registro_id) then
    ok := false; prov_id := v_op.prov_id; proposta_completa := v_op.proposta_completa;
    conteudo_hash := v_op.conteudo_hash; idempotent := false; reason := 'conteudo_divergente';
    return next; return;
  end if;
  if v_op.empresa_id is not null and nullif(btrim(coalesce(p_empresa_id,'')),'') is not null
     and v_op.empresa_id is distinct from btrim(p_empresa_id) then
    ok := false; prov_id := v_op.prov_id; proposta_completa := v_op.proposta_completa;
    conteudo_hash := v_op.conteudo_hash; idempotent := false; reason := 'conteudo_divergente';
    return next; return;
  end if;
  if v_op.filial_id is not null and nullif(btrim(coalesce(p_filial_id,'')),'') is not null
     and v_op.filial_id is distinct from btrim(p_filial_id) then
    ok := false; prov_id := v_op.prov_id; proposta_completa := v_op.proposta_completa;
    conteudo_hash := v_op.conteudo_hash; idempotent := false; reason := 'conteudo_divergente';
    return next; return;
  end if;
  if v_op.estado is not null and nullif(btrim(coalesce(p_estado,'')),'') is not null
     and v_op.estado is distinct from btrim(p_estado) then
    ok := false; prov_id := v_op.prov_id; proposta_completa := v_op.proposta_completa;
    conteudo_hash := v_op.conteudo_hash; idempotent := false; reason := 'conteudo_divergente';
    return next; return;
  end if;
  if v_op.bc_anterior is not null and nullif(btrim(coalesce(p_bc_anterior,'')),'') is not null
     and v_op.bc_anterior is distinct from btrim(p_bc_anterior) then
    ok := false; prov_id := v_op.prov_id; proposta_completa := v_op.proposta_completa;
    conteudo_hash := v_op.conteudo_hash; idempotent := false; reason := 'conteudo_divergente';
    return next; return;
  end if;
  if v_op.hash_integridade is not null and nullif(btrim(coalesce(p_hash_integridade,'')),'') is not null
     and v_op.hash_integridade is distinct from btrim(p_hash_integridade) then
    ok := false; prov_id := v_op.prov_id; proposta_completa := v_op.proposta_completa;
    conteudo_hash := v_op.conteudo_hash; idempotent := false; reason := 'conteudo_divergente';
    return next; return;
  end if;
  if v_op.subcategoria is not null and nullif(btrim(coalesce(p_subcategoria,'')),'') is not null
     and v_op.subcategoria is distinct from btrim(p_subcategoria) then
    ok := false; prov_id := v_op.prov_id; proposta_completa := v_op.proposta_completa;
    conteudo_hash := v_op.conteudo_hash; idempotent := false; reason := 'conteudo_divergente';
    return next; return;
  end if;

  if v_op.proposta_completa then
    ok := true; prov_id := v_op.prov_id; proposta_completa := true;
    conteudo_hash := v_op.conteudo_hash; idempotent := true; reason := null;
    return next; return;
  end if;

  v_cat := coalesce(v_op.categoria, nullif(btrim(coalesce(p_categoria,'')),''));
  v_sub := coalesce(v_op.subcategoria, nullif(btrim(coalesce(p_subcategoria,'')),''), '');
  v_ori := coalesce(v_op.origem, nullif(btrim(coalesce(p_origem,'')),''));
  v_reg := coalesce(v_op.registro_id, nullif(btrim(coalesce(p_registro_id,'')),''));
  v_emp := coalesce(v_op.empresa_id, nullif(btrim(coalesce(p_empresa_id,'')),''));
  v_fil := coalesce(v_op.filial_id, nullif(btrim(coalesce(p_filial_id,'')),''));
  v_est := coalesce(v_op.estado, nullif(btrim(coalesce(p_estado,'')),''), 'consolidado');
  v_ant := coalesce(v_op.bc_anterior, nullif(btrim(coalesce(p_bc_anterior,'')),''));
  v_hi := coalesce(v_op.hash_integridade, nullif(btrim(coalesce(p_hash_integridade,'')),''));

  v_completa := (
    v_cat is not null and v_ori is not null and v_reg is not null
    and v_emp is not null and v_fil is not null and v_hi is not null
  );

  if v_completa then
    v_hash := public.dk_bc_vm_conteudo_hash(
      v_prefix, v_cat, coalesce(v_sub,''), v_ori, v_reg, v_emp, v_fil, v_est,
      coalesce(v_ant,''), v_hi, v_payload
    );
  else
    v_hash := coalesce(nullif(v_op.conteudo_hash,''), public.dk_bc_vm_conteudo_hash(
      v_prefix, coalesce(v_cat,''), coalesce(v_sub,''), coalesce(v_ori,''),
      coalesce(v_reg,''), coalesce(v_emp,''), coalesce(v_fil,''), coalesce(v_est,''),
      coalesce(v_ant,''), coalesce(v_hi,''), v_payload
    ));
  end if;

  update public.dk_bc_vm_operacao
     set categoria = v_cat,
         subcategoria = v_sub,
         origem = v_ori,
         registro_id = v_reg,
         empresa_id = v_emp,
         filial_id = v_fil,
         estado = v_est,
         bc_anterior = v_ant,
         hash_integridade = v_hi,
         proposta_completa = v_completa,
         conteudo_hash = v_hash,
         updated_at = now()
   where operation_id = p_operation_id;

  ok := true; prov_id := v_op.prov_id; proposta_completa := v_completa;
  conteudo_hash := v_hash; idempotent := false;
  reason := case when v_completa then null else 'proposta_incompleta' end;
  return next;
end;
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
  v_auth record;
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

  select * into v_auth from public.dk_bc_vm_autorizada_para_operar(v_prefix);
  if v_auth.ok is distinct from true then
    ok := false; prov_id := null; prov_no := null; prefixo := v_prefix;
    status := v_auth.status; idempotent := false;
    reason := coalesce(v_auth.reason, 'vm_nao_autorizada');
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
    ok := true; prov_id := v_exist.prov_id; prov_no := v_exist.prov_no; prefixo := v_exist.prefixo;
    status := v_exist.status; idempotent := true; reason := null;
    return next; return;
  end if;

  v_hash := public.dk_bc_vm_conteudo_hash(
    v_prefix, '', '', '', '', '', '', '', '', '', v_payload
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
    operation_id, prefixo, prov_no, prov_id, status, payload, conteudo_hash, proposta_completa
  ) values (
    p_operation_id, v_prefix, v_no, v_id, 'provisorio', v_payload, v_hash, false
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
  v_auth record;
  v_emit record;
  v_comp record;
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
  select * into v_auth from public.dk_bc_vm_autorizada_para_operar(v_prefix);
  if v_auth.ok is distinct from true then
    ok := false; prov_id := null; bc_id := null; bc_no := null; bc_composto := null;
    status := v_auth.status; idempotent := false;
    reason := coalesce(v_auth.reason, 'vm_nao_autorizada');
    return next; return;
  end if;

  v_payload := coalesce(p_payload, '{}'::jsonb);
  if jsonb_typeof(v_payload) <> 'object' then
    ok := false; prov_id := null; bc_id := null; bc_no := null; bc_composto := null;
    status := null; idempotent := false; reason := 'payload_invalido';
    return next; return;
  end if;

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

  if v_op.status = 'confirmado_bc' then
    v_hash := public.dk_bc_vm_conteudo_hash(
      v_prefix, p_categoria, coalesce(p_subcategoria,''), p_origem, p_registro_id,
      p_empresa_id, p_filial_id, coalesce(nullif(btrim(coalesce(p_estado,'')),''),'consolidado'),
      coalesce(p_bc_anterior,''), p_hash_integridade, v_payload
    );
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

  -- Procedimento explícito: completar proposta antes da 1ª confirmação (sem substituição silenciosa).
  select * into v_comp from public.dk_bc_vm_completar_proposta(
    p_operation_id, v_prefix, p_categoria, coalesce(p_subcategoria,''), p_origem,
    p_registro_id, p_empresa_id, p_filial_id, p_estado, p_bc_anterior,
    p_hash_integridade, v_payload
  );
  if v_comp.ok is distinct from true then
    ok := false; prov_id := coalesce(v_comp.prov_id, v_op.prov_id);
    bc_id := null; bc_no := null; bc_composto := null;
    status := 'provisorio'; idempotent := coalesce(v_comp.idempotent, false);
    reason := coalesce(v_comp.reason, 'completar_proposta_falhou');
    return next; return;
  end if;
  if v_comp.proposta_completa is distinct from true then
    ok := false; prov_id := v_comp.prov_id; bc_id := null; bc_no := null; bc_composto := null;
    status := 'provisorio'; idempotent := false; reason := 'proposta_incompleta';
    return next; return;
  end if;

  select * into v_op from public.dk_bc_vm_operacao o where o.operation_id = p_operation_id for update;

  v_hash := public.dk_bc_vm_conteudo_hash(
    v_prefix, v_op.categoria, coalesce(v_op.subcategoria,''), v_op.origem, v_op.registro_id,
    v_op.empresa_id, v_op.filial_id, coalesce(v_op.estado,'consolidado'),
    coalesce(v_op.bc_anterior,''), v_op.hash_integridade, v_op.payload
  );
  if coalesce(v_op.conteudo_hash,'') <> v_hash then
    ok := false; prov_id := v_op.prov_id; bc_id := null; bc_no := null; bc_composto := null;
    status := v_op.status; idempotent := false; reason := 'conteudo_divergente';
    return next; return;
  end if;

  select * into v_conf
    from public.dk_bc_confirmar(
      p_operation_id,
      v_op.prov_id,
      v_op.categoria,
      coalesce(v_op.subcategoria, ''),
      v_op.origem,
      v_op.registro_id,
      v_op.empresa_id,
      v_op.filial_id,
      coalesce(v_op.estado, 'consolidado'),
      v_op.bc_anterior,
      v_op.hash_integridade,
      p_historico_ref,
      v_op.payload || jsonb_build_object(
        'vm_prefixo', v_prefix,
        'vm_prov_id', v_op.prov_id,
        'vm_colaborador_ref', v_auth.colaborador_ref,
        'fluxo', '05/10-revisao-2',
        'conteudo_hash', v_hash
      )
    );

  if v_conf.ok is distinct from true then
    ok := false; prov_id := v_op.prov_id; bc_id := null; bc_no := null; bc_composto := null;
    status := 'provisorio'; idempotent := coalesce(v_conf.idempotent, false);
    reason := coalesce(v_conf.reason, 'confirmacao_bc_falhou');
    return next; return;
  end if;

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

revoke all on function public.dk_bc_vm_autorizada_para_operar(text)
  from public, anon, authenticated;
grant execute on function public.dk_bc_vm_autorizada_para_operar(text)
  to service_role;

revoke all on function public.dk_bc_vm_conteudo_hash(
  text, text, text, text, text, text, text, text, text, text, jsonb
) from public, anon, authenticated;
grant execute on function public.dk_bc_vm_conteudo_hash(
  text, text, text, text, text, text, text, text, text, text, jsonb
) to service_role;

revoke all on function public.dk_bc_vm_completar_proposta(
  uuid, text, text, text, text, text, text, text, text, text, text, jsonb
) from public, anon, authenticated;
grant execute on function public.dk_bc_vm_completar_proposta(
  uuid, text, text, text, text, text, text, text, text, text, text, jsonb
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
