-- COMANDO 10/10 — Impedir concessão a VM não ativa (aditivo sobre adquirir).

create or replace function public.dk_bc_tela_bloqueio_adquirir(
  p_empresa_id text,
  p_filial_id text,
  p_tela_id text,
  p_prefixo text,
  p_colaborador_ref text,
  p_sessao_id text,
  p_ttl_segundos integer default 60
)
returns table (
  ok boolean,
  adquirida boolean,
  concessao_id uuid,
  geracao bigint,
  expira_em timestamptz,
  reason text
)
language plpgsql
security invoker
set search_path = public, extensions
as $$
declare
  v_emp text := btrim(coalesce(p_empresa_id, ''));
  v_fil text := btrim(coalesce(p_filial_id, ''));
  v_tela text := public.dk_bc_tela_bloqueio_norm_tela(p_tela_id);
  v_pref char(1) := upper(btrim(coalesce(p_prefixo, '')));
  v_col text := regexp_replace(coalesce(p_colaborador_ref, ''), '\D', '', 'g');
  v_sid text := btrim(coalesce(p_sessao_id, ''));
  v_ttl int := greatest(coalesce(p_ttl_segundos, 60), 5);
  v_now timestamptz := clock_timestamp();
  v_row public.dk_bc_tela_bloqueio%rowtype;
  v_gen bigint;
  v_cid uuid;
  v_exp timestamptz;
  v_vm public.dk_bc_vm%rowtype;
  v_esc boolean;
begin
  if v_emp = '' or v_fil = '' or v_tela = '' then
    ok := false; adquirida := false; concessao_id := null; geracao := null; expira_em := null;
    reason := 'identidade_tela_incompleta'; return next; return;
  end if;
  if v_pref !~ '^[A-J]$' or v_col = '' or v_sid = '' then
    ok := false; adquirida := false; concessao_id := null; geracao := null; expira_em := null;
    reason := 'identidade_sessao_incompleta'; return next; return;
  end if;

  select * into v_vm from public.dk_bc_vm where prefixo = v_pref;
  if not found then
    ok := false; adquirida := false; concessao_id := null; geracao := null; expira_em := null;
    reason := 'vm_inexistente'; return next; return;
  end if;
  if lower(coalesce(v_vm.status, '')) <> 'ativa' then
    ok := false; adquirida := false; concessao_id := null; geracao := null; expira_em := null;
    reason := 'vm_nao_ativa'; return next; return;
  end if;
  if coalesce(v_vm.colaborador_ref, '') = '' or regexp_replace(v_vm.colaborador_ref, '\D', '', 'g') <> v_col then
    ok := false; adquirida := false; concessao_id := null; geracao := null; expira_em := null;
    reason := 'vm_sem_vinculo'; return next; return;
  end if;
  select exists(
    select 1 from public.dk_bc_vm_escopo e
     where e.prefixo = v_pref and e.empresa_id = v_emp and e.filial_id = v_fil
  ) into v_esc;
  if not v_esc then
    ok := false; adquirida := false; concessao_id := null; geracao := null; expira_em := null;
    reason := 'sem_escopo_autorizado'; return next; return;
  end if;

  insert into public.dk_bc_tela_bloqueio_geracao (empresa_id, filial_id, tela_id, ultima_geracao)
  values (v_emp, v_fil, v_tela, 0)
  on conflict (empresa_id, filial_id, tela_id) do nothing;

  perform 1 from public.dk_bc_tela_bloqueio_geracao g
   where g.empresa_id = v_emp and g.filial_id = v_fil and g.tela_id = v_tela
   for update;

  select * into v_row
    from public.dk_bc_tela_bloqueio b
   where b.empresa_id = v_emp and b.filial_id = v_fil and b.tela_id = v_tela
   for update;

  if found and v_row.estado = 'ativo' and v_row.expira_em > v_now then
    if v_row.sessao_id = v_sid and v_row.colaborador_ref = v_col and v_row.prefixo = v_pref then
      v_exp := v_now + make_interval(secs => v_ttl);
      update public.dk_bc_tela_bloqueio
         set renovado_em = v_now, expira_em = v_exp, updated_at = v_now
       where empresa_id = v_emp and filial_id = v_fil and tela_id = v_tela;
      ok := true; adquirida := true; concessao_id := v_row.concessao_id; geracao := v_row.geracao;
      expira_em := v_exp; reason := 'ja_titular'; return next; return;
    end if;
    ok := false; adquirida := false; concessao_id := null; geracao := null; expira_em := null;
    reason := 'tela_ocupada'; return next; return;
  end if;

  update public.dk_bc_tela_bloqueio_geracao
     set ultima_geracao = ultima_geracao + 1
   where empresa_id = v_emp and filial_id = v_fil and tela_id = v_tela
  returning ultima_geracao into v_gen;

  v_cid := gen_random_uuid();
  v_exp := v_now + make_interval(secs => v_ttl);

  insert into public.dk_bc_tela_bloqueio as b (
    empresa_id, filial_id, tela_id, prefixo, colaborador_ref, sessao_id,
    concessao_id, geracao, adquirido_em, expira_em, renovado_em, estado, updated_at
  ) values (
    v_emp, v_fil, v_tela, v_pref, v_col, v_sid,
    v_cid, v_gen, v_now, v_exp, v_now, 'ativo', v_now
  )
  on conflict (empresa_id, filial_id, tela_id) do update set
    prefixo = excluded.prefixo,
    colaborador_ref = excluded.colaborador_ref,
    sessao_id = excluded.sessao_id,
    concessao_id = excluded.concessao_id,
    geracao = excluded.geracao,
    adquirido_em = excluded.adquirido_em,
    expira_em = excluded.expira_em,
    renovado_em = excluded.renovado_em,
    estado = 'ativo',
    updated_at = excluded.updated_at;

  insert into public.dk_bc_tela_bloqueio_audit
    (empresa_id, filial_id, tela_id, acao, prefixo, colaborador_ref, sessao_id, concessao_id, geracao, detalhe)
  values (v_emp, v_fil, v_tela, 'adquirir', v_pref, v_col, v_sid, v_cid, v_gen, null);

  ok := true; adquirida := true; concessao_id := v_cid; geracao := v_gen; expira_em := v_exp;
  reason := null; return next;
end;
$$;

revoke all on function public.dk_bc_tela_bloqueio_adquirir(text, text, text, text, text, text, integer) from public, anon, authenticated;
grant execute on function public.dk_bc_tela_bloqueio_adquirir(text, text, text, text, text, text, integer) to service_role;
