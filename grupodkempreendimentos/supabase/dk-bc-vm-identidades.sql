-- COMANDO 04/10 — Identidades permanentes das dez VMs (A–J) + contadores provisórios.
-- ADITIVO: não altera tabelas operacionais nem APIs. Não ativa transmissão BC.
-- Contador gapless por VM: dk_bc_vm_state + FOR UPDATE (sem SEQUENCE).

create extension if not exists pgcrypto;

create table if not exists public.dk_bc_vm (
  prefixo char(1) primary key check (prefixo ~ '^[A-J]$'),
  vm_id text not null unique,
  nome_logico text not null,
  status text not null default 'preparada'
    check (status in ('preparada', 'ativa', 'suspensa')),
  colaborador_ref text null,
  dispositivo_ref text null,
  notas text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.dk_bc_vm is
  'Identidades permanentes das dez VMs lógicas A–J. Letras não são atribuídas por ordem de login.';

create table if not exists public.dk_bc_vm_state (
  prefixo char(1) primary key references public.dk_bc_vm (prefixo),
  last_prov_no bigint not null default 0 check (last_prov_no >= 0),
  updated_at timestamptz not null default now()
);

comment on table public.dk_bc_vm_state is
  'Contador gapless de operações provisórias por VM (A000123). Só avança na confirmação provisória.';

create table if not exists public.dk_bc_vm_operacao (
  id uuid primary key default gen_random_uuid(),
  operation_id uuid not null unique,
  prefixo char(1) not null references public.dk_bc_vm (prefixo),
  prov_no bigint not null check (prov_no > 0),
  prov_id text not null unique,
  status text not null
    check (status in ('provisorio', 'confirmado_bc', 'rejeitado', 'cancelado')),
  bc_id text null references public.dk_bc_registro (bc_id),
  bc_composto text null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint dk_bc_vm_operacao_prov_id_fmt check (prov_id ~ '^[A-J][0-9]{6,}$'),
  constraint dk_bc_vm_operacao_payload_object check (jsonb_typeof(payload) = 'object'),
  constraint dk_bc_vm_operacao_composto_chk check (
    (status = 'confirmado_bc' and bc_id is not null and bc_composto is not null)
    or (status <> 'confirmado_bc')
  ),
  unique (prefixo, prov_no)
);

create index if not exists dk_bc_vm_operacao_prefixo_idx
  on public.dk_bc_vm_operacao (prefixo, status);

comment on table public.dk_bc_vm_operacao is
  'Operações provisórias por VM. Confirmação BC fica para etapa futura (05/10+).';

insert into public.dk_bc_vm (prefixo, vm_id, nome_logico, status)
values
  ('A', 'VM-A', 'Maquina virtual A', 'preparada'),
  ('B', 'VM-B', 'Maquina virtual B', 'preparada'),
  ('C', 'VM-C', 'Maquina virtual C', 'preparada'),
  ('D', 'VM-D', 'Maquina virtual D', 'preparada'),
  ('E', 'VM-E', 'Maquina virtual E', 'preparada'),
  ('F', 'VM-F', 'Maquina virtual F', 'preparada'),
  ('G', 'VM-G', 'Maquina virtual G', 'preparada'),
  ('H', 'VM-H', 'Maquina virtual H', 'preparada'),
  ('I', 'VM-I', 'Maquina virtual I', 'preparada'),
  ('J', 'VM-J', 'Maquina virtual J', 'preparada')
on conflict (prefixo) do nothing;

insert into public.dk_bc_vm_state (prefixo, last_prov_no)
select prefixo, 0 from public.dk_bc_vm
on conflict (prefixo) do nothing;

create or replace function public.dk_bc_vm_format(p_prefixo text, p_no bigint)
returns text
language plpgsql
immutable
as $$
declare
  v_digits int;
  v_body text;
begin
  if p_prefixo is null or p_prefixo !~ '^[A-J]$' then
    raise exception 'dk_bc_vm_prefixo_invalido' using errcode = '22023';
  end if;
  if p_no is null or p_no < 1 then
    raise exception 'dk_bc_vm_prov_no_invalido' using errcode = '22023';
  end if;
  v_digits := greatest(6, length(p_no::text));
  v_body := lpad(p_no::text, v_digits, '0');
  return p_prefixo || v_body;
end;
$$;

create or replace function public.dk_bc_vm_state_proteger()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'dk_bc_vm_state_imutavel' using errcode = '42501';
  end if;
  if new.prefixo <> old.prefixo then
    raise exception 'dk_bc_vm_state_prefixo_imutavel' using errcode = '42501';
  end if;
  if new.last_prov_no < old.last_prov_no then
    raise exception 'dk_bc_vm_state_nao_decrementa' using errcode = '42501';
  end if;
  if new.last_prov_no > old.last_prov_no + 1 then
    raise exception 'dk_bc_vm_state_salto_proibido' using errcode = '42501';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_dk_bc_vm_state_proteger on public.dk_bc_vm_state;
create trigger trg_dk_bc_vm_state_proteger
  before update or delete on public.dk_bc_vm_state
  for each row execute function public.dk_bc_vm_state_proteger();

-- Emite código provisório (A000123). NÃO confirma BC. Idempotente por operation_id.
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
  v_prefix char(1);
  v_no bigint;
  v_id text;
  v_payload jsonb;
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

  if not exists (select 1 from public.dk_bc_vm v where v.prefixo = v_prefix) then
    ok := false; prov_id := null; prov_no := null; prefixo := v_prefix;
    status := null; idempotent := false; reason := 'vm_inexistente';
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
      status := v_exist.status; idempotent := false; reason := 'operation_id_prefixo_divergente';
      return next; return;
    end if;
    ok := true; prov_id := v_exist.prov_id; prov_no := v_exist.prov_no; prefixo := v_exist.prefixo;
    status := v_exist.status; idempotent := true; reason := null;
    return next; return;
  end if;

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
    operation_id, prefixo, prov_no, prov_id, status, payload
  ) values (
    p_operation_id, v_prefix, v_no, v_id, 'provisorio', v_payload
  );

  ok := true; prov_id := v_id; prov_no := v_no; prefixo := v_prefix;
  status := 'provisorio'; idempotent := false; reason := null;
  return next;
end;
$$;

create or replace function public.dk_bc_vm_estado(p_prefixo text default null)
returns table (
  prefixo char(1),
  vm_id text,
  status text,
  last_prov_no bigint,
  proximo_prov text
)
language sql
security invoker
set search_path = public, extensions
as $$
  select v.prefixo, v.vm_id, v.status, s.last_prov_no,
         case when s.last_prov_no is null then null
              else public.dk_bc_vm_format(v.prefixo, s.last_prov_no + 1)
         end
    from public.dk_bc_vm v
    join public.dk_bc_vm_state s on s.prefixo = v.prefixo
   where p_prefixo is null or v.prefixo = upper(p_prefixo)
   order by v.prefixo;
$$;

revoke all on function public.dk_bc_vm_format(text, bigint) from public, anon, authenticated;
grant execute on function public.dk_bc_vm_format(text, bigint) to service_role;

revoke all on function public.dk_bc_vm_emitir_provisorio(uuid, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.dk_bc_vm_emitir_provisorio(uuid, text, jsonb)
  to service_role;

revoke all on function public.dk_bc_vm_estado(text) from public, anon, authenticated;
grant execute on function public.dk_bc_vm_estado(text) to service_role;

alter table public.dk_bc_vm enable row level security;
alter table public.dk_bc_vm_state enable row level security;
alter table public.dk_bc_vm_operacao enable row level security;

revoke all on table public.dk_bc_vm from public, anon, authenticated;
revoke all on table public.dk_bc_vm_state from public, anon, authenticated;
revoke all on table public.dk_bc_vm_operacao from public, anon, authenticated;

grant select, insert, update on table public.dk_bc_vm to service_role;
grant select, insert, update on table public.dk_bc_vm_state to service_role;
grant select, insert, update on table public.dk_bc_vm_operacao to service_role;

notify pgrst, 'reload schema';
