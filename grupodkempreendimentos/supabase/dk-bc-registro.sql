-- Infraestrutura central de numeração BC (Banco Central DK) — v2 (comando 01/10).
-- ADITIVO: não altera tabelas operacionais. Não numera cadastros existentes.
-- Contador gapless: dk_bc_state + FOR UPDATE (sem SEQUENCE).
-- Versionamento: uma versão vigente por (origem, registro_id, empresa, filial).

create extension if not exists pgcrypto;

create table if not exists public.dk_bc_state (
  id integer primary key check (id = 1),
  last_bc_no bigint not null default 0 check (last_bc_no >= 0),
  updated_at timestamptz not null default now()
);

insert into public.dk_bc_state (id, last_bc_no)
values (1, 0)
on conflict (id) do nothing;

comment on table public.dk_bc_state is
  'Contador gapless do BC. Só avança na mesma transação que confirma um registo oficial.';

create table if not exists public.dk_bc_registro (
  bc_id text primary key,
  bc_no bigint not null unique,
  categoria text not null,
  subcategoria text not null default '',
  origem text not null,
  registro_id text not null,
  empresa_id text null,
  filial_id text null,
  estado text not null default 'consolidado',
  versao_bc text not null,
  bc_anterior text null references public.dk_bc_registro (bc_id),
  vigente boolean not null default true,
  confirmado_em timestamptz not null default now(),
  hash_integridade text null,
  historico_ref text null,
  conteudo_hash text not null default '',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint dk_bc_registro_bc_id_fmt check (bc_id ~ '^BC[0-9]{12}$'),
  constraint dk_bc_registro_versao_bc_fmt check (versao_bc ~ '^BC[0-9]{12}$'),
  constraint dk_bc_registro_payload_object check (jsonb_typeof(payload) = 'object')
);

alter table public.dk_bc_registro
  add column if not exists vigente boolean not null default true;
alter table public.dk_bc_registro
  add column if not exists conteudo_hash text not null default '';

create index if not exists dk_bc_registro_origem_reg_idx
  on public.dk_bc_registro (origem, registro_id);

create index if not exists dk_bc_registro_categoria_idx
  on public.dk_bc_registro (categoria, subcategoria);

create index if not exists dk_bc_registro_confirmado_em_idx
  on public.dk_bc_registro (confirmado_em);

create unique index if not exists dk_bc_registro_vigente_unico_idx
  on public.dk_bc_registro (
    origem,
    registro_id,
    coalesce(empresa_id, ''),
    coalesce(filial_id, '')
  )
  where vigente = true;

comment on table public.dk_bc_registro is
  'Catálogo BC: cada bc_id é único; no máximo uma versão vigente por entidade lógica.';

create table if not exists public.dk_bc_operacao (
  id uuid primary key default gen_random_uuid(),
  operation_id uuid not null unique,
  vm_provisorio text null,
  vm_prefix text null,
  status text not null,
  bc_id text null references public.dk_bc_registro (bc_id),
  bc_composto text null,
  motivo_rejeicao text null,
  categoria text null,
  subcategoria text null,
  origem text null,
  registro_id text null,
  empresa_id text null,
  filial_id text null,
  hash_integridade text null,
  conteudo_hash text null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint dk_bc_operacao_status_chk
    check (status in ('pendente', 'confirmado', 'rejeitado')),
  constraint dk_bc_operacao_payload_object check (jsonb_typeof(payload) = 'object'),
  constraint dk_bc_operacao_vm_prefix_chk
    check (vm_prefix is null or vm_prefix ~ '^[A-J]$'),
  constraint dk_bc_operacao_confirmado_tem_bc
    check (
      (status = 'confirmado' and bc_id is not null and bc_composto is not null)
      or (status <> 'confirmado')
    ),
  constraint dk_bc_operacao_rejeitado_sem_bc
    check (
      (status = 'rejeitado' and bc_id is null)
      or (status <> 'rejeitado')
    )
);

alter table public.dk_bc_operacao
  add column if not exists conteudo_hash text null;

create unique index if not exists dk_bc_operacao_vm_provisorio_uidx
  on public.dk_bc_operacao (vm_provisorio)
  where vm_provisorio is not null;

create index if not exists dk_bc_operacao_status_idx
  on public.dk_bc_operacao (status);

create index if not exists dk_bc_operacao_bc_id_idx
  on public.dk_bc_operacao (bc_id)
  where bc_id is not null;

comment on table public.dk_bc_operacao is
  'Operações provisórias VM e idempotência. Rejeitadas não consomem BC.';

create or replace function public.dk_bc_format(p_no bigint)
returns text
language sql
immutable
as $$
  select 'BC' || lpad(p_no::text, 12, '0');
$$;

create or replace function public.dk_bc_conteudo_hash(
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
returns text
language sql
immutable
as $$
  select encode(
    digest(
      coalesce(p_categoria, '') || chr(1) ||
      coalesce(p_subcategoria, '') || chr(1) ||
      coalesce(p_origem, '') || chr(1) ||
      coalesce(p_registro_id, '') || chr(1) ||
      coalesce(p_empresa_id, '') || chr(1) ||
      coalesce(p_filial_id, '') || chr(1) ||
      coalesce(p_estado, '') || chr(1) ||
      coalesce(p_bc_anterior, '') || chr(1) ||
      coalesce(p_hash_integridade, '') || chr(1) ||
      coalesce(p_historico_ref, '') || chr(1) ||
      coalesce(p_payload, '{}'::jsonb)::text,
      'sha256'
    ),
    'hex'
  );
$$;

-- Impede baixar o contador ou saltos > 1 em UPDATE directo.
create or replace function public.dk_bc_state_proteger()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'dk_bc_state_imutavel' using errcode = '42501';
  end if;
  if new.id <> 1 then
    raise exception 'dk_bc_state_id_invalido' using errcode = '22023';
  end if;
  if new.last_bc_no < old.last_bc_no then
    raise exception 'dk_bc_state_nao_decrementa' using errcode = '42501';
  end if;
  if new.last_bc_no > old.last_bc_no + 1 then
    raise exception 'dk_bc_state_salto_proibido' using errcode = '42501';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_dk_bc_state_proteger on public.dk_bc_state;
create trigger trg_dk_bc_state_proteger
  before update or delete on public.dk_bc_state
  for each row execute function public.dk_bc_state_proteger();

-- Impede apagar registos BC confirmados.
create or replace function public.dk_bc_registro_proteger()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'dk_bc_registro_imutavel' using errcode = '42501';
  end if;
  if tg_op = 'UPDATE' then
    if new.bc_id <> old.bc_id or new.bc_no <> old.bc_no then
      raise exception 'dk_bc_registro_id_imutavel' using errcode = '42501';
    end if;
    if old.vigente = false and new.vigente = true then
      raise exception 'dk_bc_registro_nao_reativa' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_dk_bc_registro_proteger on public.dk_bc_registro;
create trigger trg_dk_bc_registro_proteger
  before update or delete on public.dk_bc_registro
  for each row execute function public.dk_bc_registro_proteger();

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

create or replace function public.dk_bc_rejeitar(
  p_operation_id uuid,
  p_vm_provisorio text,
  p_motivo text,
  p_payload jsonb
)
returns table (
  ok boolean,
  status text,
  idempotent boolean,
  reason text,
  last_bc_no bigint
)
language plpgsql
security invoker
set search_path = public, extensions
as $$
#variable_conflict use_column
declare
  v_exist public.dk_bc_operacao%rowtype;
  v_prov text;
  v_prefix text;
  v_payload jsonb;
  v_last bigint;
begin
  if p_operation_id is null then
    ok := false; status := null; idempotent := false; reason := 'operation_id_ausente'; last_bc_no := null;
    return next; return;
  end if;

  v_payload := coalesce(p_payload, '{}'::jsonb);
  if jsonb_typeof(v_payload) <> 'object' then
    ok := false; status := null; idempotent := false; reason := 'payload_invalido'; last_bc_no := null;
    return next; return;
  end if;

  v_prov := nullif(btrim(coalesce(p_vm_provisorio, '')), '');
  v_prefix := null;
  if v_prov is not null then
    if v_prov !~ '^[A-J][0-9]{1,12}$' then
      ok := false; status := null; idempotent := false; reason := 'vm_provisorio_invalido'; last_bc_no := null;
      return next; return;
    end if;
    v_prefix := substr(v_prov, 1, 1);
  end if;

  perform 1 from public.dk_bc_state where id = 1 for update;
  select s.last_bc_no into v_last from public.dk_bc_state s where s.id = 1;

  select * into v_exist from public.dk_bc_operacao where operation_id = p_operation_id;
  if found then
    if v_exist.status = 'confirmado' then
      ok := false; status := 'confirmado'; idempotent := true;
      reason := 'ja_confirmado'; last_bc_no := v_last;
      return next; return;
    end if;
    if v_exist.status = 'rejeitado' then
      ok := true; status := 'rejeitado'; idempotent := true;
      reason := null; last_bc_no := v_last;
      return next; return;
    end if;
    update public.dk_bc_operacao
       set status = 'rejeitado',
           motivo_rejeicao = left(coalesce(nullif(btrim(coalesce(p_motivo, '')), ''), 'rejeitado'), 500),
           bc_id = null,
           bc_composto = null,
           payload = v_payload,
           updated_at = now()
     where id = v_exist.id;
  else
    insert into public.dk_bc_operacao (
      operation_id, vm_provisorio, vm_prefix, status, motivo_rejeicao, payload
    ) values (
      p_operation_id, v_prov, v_prefix, 'rejeitado',
      left(coalesce(nullif(btrim(coalesce(p_motivo, '')), ''), 'rejeitado'), 500),
      v_payload
    );
  end if;

  ok := true;
  status := 'rejeitado';
  idempotent := false;
  reason := null;
  last_bc_no := v_last;
  return next;
end;
$$;

create or replace function public.dk_bc_estado()
returns table (last_bc_no bigint, updated_at timestamptz, proximo_bc text)
language sql
security invoker
set search_path = public, extensions
as $$
  select s.last_bc_no, s.updated_at, public.dk_bc_format(s.last_bc_no + 1)
    from public.dk_bc_state s
   where s.id = 1;
$$;

revoke all on function public.dk_bc_format(bigint) from public, anon, authenticated;
grant execute on function public.dk_bc_format(bigint) to service_role;

revoke all on function public.dk_bc_conteudo_hash(
  text, text, text, text, text, text, text, text, text, text, jsonb
) from public, anon, authenticated;
grant execute on function public.dk_bc_conteudo_hash(
  text, text, text, text, text, text, text, text, text, text, jsonb
) to service_role;

revoke all on function public.dk_bc_confirmar(
  uuid, text, text, text, text, text, text, text, text, text, text, text, jsonb
) from public, anon, authenticated;
grant execute on function public.dk_bc_confirmar(
  uuid, text, text, text, text, text, text, text, text, text, text, text, jsonb
) to service_role;

revoke all on function public.dk_bc_rejeitar(uuid, text, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.dk_bc_rejeitar(uuid, text, text, jsonb)
  to service_role;

revoke all on function public.dk_bc_estado() from public, anon, authenticated;
grant execute on function public.dk_bc_estado() to service_role;

alter table public.dk_bc_state enable row level security;
alter table public.dk_bc_registro enable row level security;
alter table public.dk_bc_operacao enable row level security;

revoke all on table public.dk_bc_state from public, anon, authenticated;
revoke all on table public.dk_bc_registro from public, anon, authenticated;
revoke all on table public.dk_bc_operacao from public, anon, authenticated;

grant select, insert, update on table public.dk_bc_state to service_role;
grant select, insert, update on table public.dk_bc_registro to service_role;
grant select, insert, update on table public.dk_bc_operacao to service_role;

notify pgrst, 'reload schema';
