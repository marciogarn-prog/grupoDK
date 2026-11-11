/**
 * Máquina virtual por colaborador.
 * Salvar → PC sobe para a VM → redistribui na nuvem.
 * Troca de tela / poll → PC consulta a VM e baixa só se houver novidade (seq).
 * Offline → novidade fica na VM até o próximo login.
 */
(function () {
  const CLONE_KEYS = [
    "dk_clientes_cadastro",
    "dk_portal_clientes_cadastro",
    "dk_clientes_validacao_pendente",
    "dk_veiculos_cadastro",
    "dk_portal_veiculos_cadastro",
    "dk_veiculos_frota_planilha",
    "dk_locacoes_cadastro",
    "dk_locacoes_quadro_geral",
    "dk_funcionarios_access",
    "dk_manutencoes_cadastro",
    "dk_manutencoes_rapidas_v1",
    "dk_lancamentos_aluguel",
    "dk_portal_setor_movimentacoes_v1",
    "dk_portal_checklist_movimentacoes_v1",
    "dk_portal_checklist_historico_v1",
    "dk_comprovantes_banco",
    "dk_comprovantes_cliente_pendentes",
    "dk_financeiro_extratos_v1",
    "dk_financeiro_despesas_v1",
    "dk_financeiro_ceo_despesas_v1",
    "dk_audit_log",
    "dk_pagamentos_auditoria_v1",
  ];

  const SEQ_LS_KEY = "dk_vm_cluster_seq_v1";
  const SYNC_AT_KEY = "dk_vm_last_sync_at_v1";
  const FISCAL_CPF_KEY = "dk_vm_fiscal_cpf_v1";
  const FISCAL_NOME_KEY = "dk_vm_fiscal_nome_v1";
  let aplicandoDelta = false;
  let syncSalvarTimer = null;
  let pollTimer = null;
  let trocaTelaTimer = null;
  let listaVmAberta = false;

  function digitos(v) {
    return String(v ?? "").replace(/\D/g, "").slice(0, 11);
  }

  function pad2(n) {
    return String(n).padStart(2, "0");
  }

  function formatarTextoSyncVm(quando) {
    const d = quando instanceof Date ? quando : new Date(quando);
    if (Number.isNaN(d.getTime())) return "";
    const hh = pad2(d.getHours());
    const mm = pad2(d.getMinutes());
    const ss = pad2(d.getSeconds());
    const dd = pad2(d.getDate());
    const mo = pad2(d.getMonth() + 1);
    const aa = pad2(d.getFullYear() % 100);
    return `SINCRONIZADO COM VM AS ${hh}:${mm}:${ss} DO DIA ${dd}-${mo}-${aa}.`;
  }

  function marcarSincronizadoComVm(quando) {
    const d = quando instanceof Date ? quando : new Date();
    const iso = d.toISOString();
    try {
      sessionStorage.setItem(SYNC_AT_KEY, iso);
    } catch {
      /* ignore */
    }
    const el = document.getElementById("portalVmSyncStatus");
    if (el) el.textContent = formatarTextoSyncVm(d);
    try {
      window.__DK_vmUltimoSyncAt = iso;
    } catch {
      /* ignore */
    }
  }

  function restaurarStatusSyncVm() {
    let iso = "";
    try {
      iso = String(sessionStorage.getItem(SYNC_AT_KEY) || "");
    } catch {
      iso = "";
    }
    if (!iso) return;
    const el = document.getElementById("portalVmSyncStatus");
    const txt = formatarTextoSyncVm(iso);
    if (el && txt) el.textContent = txt;
  }

  function headers() {
    return typeof window.__DK_portalApiHeaders === "function" ? window.__DK_portalApiHeaders() : {};
  }

  function deviceId() {
    try {
      if (typeof window.__DK_portalDeviceId === "function") return String(window.__DK_portalDeviceId() || "");
    } catch {
      /* ignore */
    }
    return "";
  }

  function lerSessaoAdmin() {
    try {
      return JSON.parse(localStorage.getItem("dk_sessao_cliente") || "null");
    } catch {
      return null;
    }
  }

  function cpfSessao() {
    const s = lerSessaoAdmin();
    if (s && s.tipo === "admin") return digitos(s.cpf);
    return "";
  }

  function nomeSessao() {
    const s = lerSessaoAdmin();
    return s && s.tipo === "admin" ? String(s.nome || "").trim() : "";
  }

  function lerFiscalVm() {
    try {
      const cpf = digitos(sessionStorage.getItem(FISCAL_CPF_KEY) || "");
      if (cpf.length !== 11) return null;
      return { cpf, nome: String(sessionStorage.getItem(FISCAL_NOME_KEY) || "").trim() };
    } catch {
      return null;
    }
  }

  function limparFiscalVm() {
    try {
      sessionStorage.removeItem(FISCAL_CPF_KEY);
      sessionStorage.removeItem(FISCAL_NOME_KEY);
    } catch {
      /* ignore */
    }
    try {
      window.__DK_vmFiscal = null;
    } catch {
      /* ignore */
    }
    const btn = document.getElementById("portalAdminAcessarVmBtn");
    if (btn) btn.classList.remove("is-active-vm");
  }

  function gravarFiscalVm(cpf, nome) {
    const dig = digitos(cpf);
    const proprio = dig && dig === cpfSessao();
    /* Própria VM do CEO = sem modo fiscal (acesso completo). */
    if (!dig || proprio) {
      limparFiscalVm();
      return;
    }
    try {
      sessionStorage.setItem(FISCAL_CPF_KEY, dig);
      sessionStorage.setItem(FISCAL_NOME_KEY, String(nome || "").trim());
    } catch {
      /* ignore */
    }
    try {
      window.__DK_vmFiscal = { cpf: dig, nome: String(nome || "").trim() };
    } catch {
      /* ignore */
    }
    const btn = document.getElementById("portalAdminAcessarVmBtn");
    if (btn) btn.classList.add("is-active-vm");
  }

  /** CPF da VM sob fiscalização (ou a VM do operador logado). */
  function cpfVmAtiva() {
    const fiscal = lerFiscalVm();
    if (fiscal && fiscal.cpf) return fiscal.cpf;
    return cpfSessao();
  }

  function escapeHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function formatCpfMask(cpf) {
    const d = digitos(cpf);
    if (d.length !== 11) return d;
    return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  }

  function lerSeqLocal() {
    try {
      return Number(sessionStorage.getItem(SEQ_LS_KEY) || 0) || 0;
    } catch {
      return 0;
    }
  }

  function gravarSeqLocal(seq) {
    try {
      sessionStorage.setItem(SEQ_LS_KEY, String(Number(seq) || 0));
    } catch {
      /* ignore */
    }
  }

  function coletarEstadoPc() {
    const out = {};
    for (const k of CLONE_KEYS) {
      try {
        if (typeof loadCadastro === "function") {
          const arr = loadCadastro(k);
          if (Array.isArray(arr)) out[k] = arr;
        } else {
          const raw = localStorage.getItem(k);
          if (raw) out[k] = JSON.parse(raw);
        }
      } catch {
        /* ignore */
      }
    }
    return out;
  }

  function resumoLocalPc() {
    const e = coletarEstadoPc();
    const locs = Array.isArray(e.dk_locacoes_cadastro) ? e.dk_locacoes_cadastro : [];
    let pagamentos = 0;
    let ativos = 0;
    let finalizados = 0;
    for (const loc of locs) {
      const pays = Array.isArray(loc.portalLancamentosAluguel) ? loc.portalLancamentosAluguel : [];
      pagamentos += pays.length;
      const st = String(loc.statusLocacao || loc.status || "")
        .trim()
        .toUpperCase();
      const fim = String(loc.fim || loc.dataFim || "").trim();
      const inativo =
        st.includes("FINAL") ||
        st.includes("INATIV") ||
        st.includes("CANCEL") ||
        (fim && fim !== "...");
      if (inativo) finalizados += 1;
      else ativos += 1;
    }
    const manutList = Array.isArray(e.dk_manutencoes_cadastro) ? e.dk_manutencoes_cadastro : [];
    const manutAtivasAssinatura = manutList
      .filter((m) => !String(m?.dataRealSaida || "").trim())
      .map((m) => {
        const pl = String(m?.placa || "")
          .toUpperCase()
          .replace(/[^A-Z0-9]/g, "");
        const cat = String(m?.categoriaManutencao || m?.categoria || "triagem")
          .trim()
          .toLowerCase();
        return pl ? `${pl}:${cat || "triagem"}` : "";
      })
      .filter(Boolean)
      .sort()
      .join("|");
    return {
      clientes: Array.isArray(e.dk_clientes_cadastro) ? e.dk_clientes_cadastro.length : 0,
      veiculos: Array.isArray(e.dk_veiculos_cadastro) ? e.dk_veiculos_cadastro.length : 0,
      protocolos: locs.length,
      protocolosAtivos: ativos,
      protocolosFinalizados: finalizados,
      pagamentos,
      manutencoes: manutList.length,
      manutencoesRapidas: Array.isArray(e.dk_manutencoes_rapidas_v1) ? e.dk_manutencoes_rapidas_v1.length : 0,
      manutencoesAtivas: manutAtivasAssinatura.split("|").filter(Boolean).length,
      manutencoesAtivasAssinatura: manutAtivasAssinatura,
      checklistMovimentacoes: Array.isArray(e.dk_portal_checklist_movimentacoes_v1)
        ? e.dk_portal_checklist_movimentacoes_v1.length
        : 0,
      setorMovimentacoes: Array.isArray(e.dk_portal_setor_movimentacoes_v1)
        ? e.dk_portal_setor_movimentacoes_v1.length
        : 0,
    };
  }

  function resumosDivergem(a, b) {
    if (!a || !b || typeof a !== "object" || typeof b !== "object") return false;
    try {
      return JSON.stringify(a) !== JSON.stringify(b);
    } catch {
      return true;
    }
  }

  /**
   * Aplica o clone da VM no PC.
   * gemeas/fiscal/substituir: o banco da nuvem manda (irmãs gémeas) — não fica resto local a desalinhar.
   */
  function aplicarEstadoNoPc(estado, opts) {
    if (!estado || typeof estado !== "object") return { ok: false, aplicadas: 0 };
    const fiscal = Boolean(opts && opts.fiscal);
    const gemeas = Boolean(opts && (opts.gemeas || opts.substituir || opts.fiscal));
    let aplicadas = 0;
    aplicandoDelta = true;
    window.__DK_vmAplicandoDelta = true;
    try {
      for (const k of CLONE_KEYS) {
        if (!Object.prototype.hasOwnProperty.call(estado, k)) continue;
        const cloudArr = Array.isArray(estado[k]) ? estado[k] : [];
        if (!gemeas && !cloudArr.length && k !== "dk_manutencoes_cadastro") continue;
        let localArr = [];
        try {
          localArr = typeof loadCadastro === "function" ? loadCadastro(k) || [] : [];
        } catch {
          localArr = [];
        }
        let merged = cloudArr;
        if (!gemeas && typeof mergeCadastroHistoricoImutavel === "function") {
          if (k === "dk_manutencoes_cadastro" && typeof window.__DK_mergeManutencoesCloudManda === "function") {
            merged = window.__DK_mergeManutencoesCloudManda(localArr, cloudArr);
          } else if (k.includes("veiculos")) {
            merged = mergeCadastroHistoricoImutavel(k, cloudArr, localArr);
          } else if (k === "dk_locacoes_cadastro") {
            merged = mergeCadastroHistoricoImutavel(k, cloudArr, localArr);
          } else {
            merged = mergeCadastroHistoricoImutavel(k, localArr, cloudArr);
          }
        }
        if (typeof saveCadastro === "function") {
          saveCadastro(k, Array.isArray(merged) ? merged : cloudArr, {
            bypassImmutabilidadeCadastro: true,
            allowShrink: true,
          });
          aplicadas += 1;
        }
      }
    } finally {
      aplicandoDelta = false;
      window.__DK_vmAplicandoDelta = false;
    }
    return { ok: aplicadas > 0, aplicadas };
  }

  function refrescarUiAposCloneVm() {
    try {
      if (typeof window.__DK_portalRefreshAposCloneVm === "function") {
        window.__DK_portalRefreshAposCloneVm();
        return;
      }
    } catch {
      /* ignore */
    }
    try {
      window.dispatchEvent(new CustomEvent("dk-maquina-virtual-ui-refresh"));
    } catch {
      /* ignore */
    }
  }

  async function postAcao(acao, extra) {
    const body = { acao, deviceId: deviceId(), ...(extra && typeof extra === "object" ? extra : {}) };
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 45000);
    try {
      const r = await fetch("/api/dk-maquina-virtual?nocache=" + Date.now(), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers() },
        body: JSON.stringify(body),
        signal: ctrl.signal,
        cache: "no-store",
      });
      const data = await r.json().catch(() => ({}));
      return { ok: Boolean(r.ok && (data.ok || data.success)), status: r.status, data };
    } catch (e) {
      return { ok: false, status: 0, data: { reason: "network", error: String(e && e.message ? e.message : e) } };
    } finally {
      clearTimeout(t);
    }
  }

  async function espelharNoLogin(opts) {
    const cpf = digitos((opts && opts.cpf) || cpfSessao());
    if (cpf.length !== 11) return { ok: false, reason: "cpf" };
    const res = await postAcao("login-espelhar", {
      cpf,
      nome: (opts && opts.nome) || nomeSessao(),
      role: (opts && opts.role) || "",
    });
    if (!res.ok) return res;
    /* Clone gémeo: o banco da VM manda no PC (todas as máquinas iguais). */
    const aplicado = aplicarEstadoNoPc(res.data && res.data.estado, { gemeas: true });
    if (res.data && res.data.seq != null) gravarSeqLocal(res.data.seq);
    marcarSincronizadoComVm();
    refrescarUiAposCloneVm();
    try {
      window.__DK_VM_META = res.data && res.data.meta;
      window.dispatchEvent(
        new CustomEvent("dk-maquina-virtual-espelhada", {
          detail: {
            meta: res.data.meta,
            aplicadas: aplicado.aplicadas,
            seq: res.data.seq,
            alinhadas: res.data.alinhadas,
            resumo: res.data.resumo,
          },
        })
      );
    } catch {
      /* ignore */
    }
    iniciarPollVm();
    return { ok: true, meta: res.data.meta, aplicadas: aplicado.aplicadas, criada: res.data.criada, seq: res.data.seq };
  }

  /** Salvar: PC → VM → redistribui a todas as VMs na nuvem. */
  async function sincronizarPcComClone() {
    if (aplicandoDelta || window.__DK_vmAplicandoDelta) {
      return { ok: true, skipped: true, reason: "aplicando_delta" };
    }
    const cpf = cpfVmAtiva();
    if (cpf.length !== 11) return { ok: false, reason: "cpf" };
    const fiscal = lerFiscalVm();
    const res = await postAcao("sincronizar-pc", {
      cpf,
      nome: (fiscal && fiscal.nome) || nomeSessao(),
      estado: coletarEstadoPc(),
    });
    if (res.ok) {
      if (res.data && res.data.seq != null) gravarSeqLocal(res.data.seq);
      marcarSincronizadoComVm();
    }
    return res;
  }

  function agendarSyncAposSalvar() {
    if (aplicandoDelta || window.__DK_vmAplicandoDelta) return;
    if (cpfSessao().length !== 11) return;
    clearTimeout(syncSalvarTimer);
    syncSalvarTimer = setTimeout(() => {
      sincronizarPcComClone().catch((e) => console.warn("[DK VM] salvar→VM", e));
    }, 400);
  }

  /**
   * Troca de tela / poll: baixa o clone gémeo se a seq avançou OU se o PC divergiu do resumo da VM.
   */
  async function consultarEBaixarDelta(motivo) {
    if (aplicandoDelta) return { ok: true, skipped: true };
    const cpf = cpfVmAtiva();
    if (cpf.length !== 11) return { ok: false, reason: "cpf" };
    const lastSeq = lerSeqLocal();
    let res = await postAcao("consultar-delta", { cpf, lastSeq });
    if (!res.ok) return res;

    let precisaBaixar = Boolean(res.data && res.data.haNovidade && res.data.estado);
    if (!precisaBaixar && res.data && res.data.resumo && resumosDivergem(resumoLocalPc(), res.data.resumo)) {
      /* Seq igual mas PC desalinhado (ex.: manutenção local incompleta) — força clone gémeo. */
      res = await postAcao("consultar-delta", { cpf, lastSeq: 0 });
      if (!res.ok) return res;
      precisaBaixar = Boolean(res.data && res.data.estado);
    }

    if (!precisaBaixar) {
      if (res.data && res.data.seq != null) gravarSeqLocal(res.data.seq);
      marcarSincronizadoComVm();
      return { ok: true, haNovidade: false, seq: res.data && res.data.seq, motivo, resumo: res.data && res.data.resumo };
    }

    const aplicado = aplicarEstadoNoPc(res.data.estado, { gemeas: true });
    if (res.data.seq != null) gravarSeqLocal(res.data.seq);
    marcarSincronizadoComVm();
    refrescarUiAposCloneVm();
    try {
      window.dispatchEvent(
        new CustomEvent("dk-maquina-virtual-delta", {
          detail: {
            seq: res.data.seq,
            resumo: res.data.resumo,
            aplicadas: aplicado.aplicadas,
            motivo,
            gemeas: true,
          },
        })
      );
    } catch {
      /* ignore */
    }
    return { ok: true, haNovidade: true, seq: res.data.seq, aplicadas: aplicado.aplicadas, motivo };
  }

  function naTrocaDeTela() {
    if (cpfSessao().length !== 11) return;
    clearTimeout(trocaTelaTimer);
    trocaTelaTimer = setTimeout(() => {
      consultarEBaixarDelta("troca-tela").catch((e) => console.warn("[DK VM] troca tela", e));
    }, 250);
  }

  function iniciarPollVm() {
    pararPollVm();
    if (cpfSessao().length !== 11) return;
    pollTimer = setInterval(() => {
      if (document.hidden) return;
      if (cpfSessao().length !== 11) return;
      consultarEBaixarDelta("poll").catch(() => {});
    }, 45000);
  }

  function pararPollVm() {
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = null;
  }

  async function garantirVmColaborador(cpf, nome, role) {
    const dig = digitos(cpf);
    if (dig.length !== 11) return { ok: false, reason: "cpf" };
    return postAcao("garantir", { cpf: dig, nome: nome || "", role: role || "operacao" });
  }

  async function garantirTodas() {
    return postAcao("garantir-todos", {});
  }

  function fecharListaVms() {
    listaVmAberta = false;
    const lista = document.getElementById("portalAdminAcessarVmLista");
    const btn = document.getElementById("portalAdminAcessarVmBtn");
    if (lista) {
      lista.classList.add("hidden");
      lista.hidden = true;
      lista.innerHTML = "";
    }
    if (btn) btn.setAttribute("aria-expanded", "false");
  }

  function renderListaVms(maquinas, alinhadas, sincronizouCluster) {
    const lista = document.getElementById("portalAdminAcessarVmLista");
    if (!lista) return;
    const fiscal = lerFiscalVm();
    const rows = Array.isArray(maquinas) ? maquinas.slice() : [];
    rows.sort((a, b) => String(a.nome || a.cpf || "").localeCompare(String(b.nome || b.cpf || ""), "pt-BR"));
    if (!rows.length) {
      lista.innerHTML = '<div class="portal-admin-acessar-vm__vazio">Nenhuma VM disponível.</div>';
      return;
    }
    let status = "";
    if (alinhadas === false) {
      status = '<div class="portal-admin-acessar-vm__erro">Atenção: VMs com divergência — a sincronização automática não concluiu.</div>';
    } else if (sincronizouCluster) {
      status = '<div class="portal-admin-acessar-vm__vazio">VMs sincronizadas agora no login/nuvem.</div>';
    }
    lista.innerHTML =
      status +
      rows
        .map((m) => {
          const cpf = digitos(m.cpf);
          const nome = String(m.nome || "Colaborador").trim() || "Colaborador";
          const resumo = m.resumo && typeof m.resumo === "object" ? m.resumo : {};
          const meta = `${formatCpfMask(cpf)} · ${Number(resumo.clientes) || 0} clientes · ${Number(resumo.pagamentos) || 0} pag.`;
          const active = fiscal && fiscal.cpf === cpf ? " is-active" : "";
          return (
            `<button type="button" class="portal-admin-acessar-vm__item${active}" role="option" data-vm-cpf="${escapeHtml(cpf)}" data-vm-nome="${escapeHtml(nome)}">` +
            `<span>${escapeHtml(nome)}</span>` +
            `<span class="portal-admin-acessar-vm__item-meta">${escapeHtml(meta)}</span>` +
            `</button>`
          );
        })
        .join("");
  }

  async function listarVmsNuvem() {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 30000);
    try {
      const r = await fetch("/api/dk-maquina-virtual?lista=1&nocache=" + Date.now(), {
        method: "GET",
        headers: { ...headers() },
        signal: ctrl.signal,
        cache: "no-store",
      });
      const data = await r.json().catch(() => ({}));
      return { ok: Boolean(r.ok && (data.ok || data.success)), status: r.status, data };
    } catch (e) {
      return { ok: false, status: 0, data: { reason: "network", error: String(e && e.message ? e.message : e) } };
    } finally {
      clearTimeout(t);
    }
  }

  async function abrirListaVms() {
    const lista = document.getElementById("portalAdminAcessarVmLista");
    const btn = document.getElementById("portalAdminAcessarVmBtn");
    if (!lista || !btn) return;
    listaVmAberta = true;
    lista.classList.remove("hidden");
    lista.hidden = false;
    btn.setAttribute("aria-expanded", "true");
    lista.innerHTML = '<div class="portal-admin-acessar-vm__vazio">A carregar VMs…</div>';
    const res = await listarVmsNuvem();
    if (!listaVmAberta) return;
    if (!res.ok) {
      lista.innerHTML =
        '<div class="portal-admin-acessar-vm__erro">Não foi possível listar as VMs.</div>';
      return;
    }
    renderListaVms(res.data.maquinas || [], res.data.alinhadas, res.data.sincronizouCluster);
  }

  async function acessarVmPorCpf(cpf, nome) {
    const dig = digitos(cpf);
    if (dig.length !== 11) return { ok: false, reason: "cpf" };
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 45000);
    try {
      const r = await fetch(
        "/api/dk-maquina-virtual?cpf=" + encodeURIComponent(dig) + "&nocache=" + Date.now(),
        {
          method: "GET",
          headers: { ...headers() },
          signal: ctrl.signal,
          cache: "no-store",
        }
      );
      const data = await r.json().catch(() => ({}));
      if (!r.ok || !(data.ok || data.success)) {
        return { ok: false, status: r.status, data };
      }
      const label = String(nome || (data.meta && data.meta.nome) || "").trim();
      gravarFiscalVm(dig, label);
      const aplicado = aplicarEstadoNoPc(data.estado || {}, { fiscal: true, gemeas: true });
      if (data.seq != null) gravarSeqLocal(data.seq);
      marcarSincronizadoComVm();
      refrescarUiAposCloneVm();
      const detalhe = {
        cpf: dig,
        nome: label,
        seq: data.seq,
        resumo: data.resumo,
        aplicadas: aplicado.aplicadas,
        fiscal: Boolean(lerFiscalVm()),
      };
      try {
        window.dispatchEvent(new CustomEvent("dk-maquina-virtual-fiscal", { detail: detalhe }));
      } catch {
        /* ignore */
      }
      try {
        if (typeof window.__DK_portalAposAcessarVm === "function") {
          window.__DK_portalAposAcessarVm(detalhe);
        } else if (typeof window.__DK_portalAtualizarBannerAdmin === "function") {
          window.__DK_portalAtualizarBannerAdmin();
        }
      } catch {
        /* ignore */
      }
      return { ok: true, cpf: dig, nome: label, aplicadas: aplicado.aplicadas, seq: data.seq, resumo: data.resumo, fiscal: detalhe.fiscal };
    } catch (e) {
      return { ok: false, reason: "network", error: String(e && e.message ? e.message : e) };
    } finally {
      clearTimeout(t);
      fecharListaVms();
    }
  }

  function bindAcessarVmUi() {
    if (window.__dkPortalAcessarVmBound) return;
    window.__dkPortalAcessarVmBound = true;
    const wrap = document.getElementById("portalAdminAcessarVmWrap");
    const btn = document.getElementById("portalAdminAcessarVmBtn");
    const lista = document.getElementById("portalAdminAcessarVmLista");
    if (!wrap || !btn || !lista) return;

    btn.addEventListener("click", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      if (listaVmAberta) {
        fecharListaVms();
        return;
      }
      abrirListaVms().catch((e) => console.warn("[DK VM] lista", e));
    });

    lista.addEventListener("click", (ev) => {
      const item = ev.target instanceof Element ? ev.target.closest("[data-vm-cpf]") : null;
      if (!item) return;
      ev.preventDefault();
      ev.stopPropagation();
      const cpf = item.getAttribute("data-vm-cpf") || "";
      const nome = item.getAttribute("data-vm-nome") || "";
      lista.innerHTML = '<div class="portal-admin-acessar-vm__vazio">A sincronizar com a VM…</div>';
      acessarVmPorCpf(cpf, nome)
        .then((r) => {
          if (!r.ok) console.warn("[DK VM] acessar", r);
        })
        .catch((e) => console.warn("[DK VM] acessar", e));
    });

    document.addEventListener("click", (ev) => {
      if (!listaVmAberta) return;
      const t = ev.target;
      if (t instanceof Node && wrap.contains(t)) return;
      fecharListaVms();
    });

    document.addEventListener("keydown", (ev) => {
      if (ev.key === "Escape" && listaVmAberta) fecharListaVms();
    });
  }

  window.__DK_vmEspelharNoLogin = espelharNoLogin;
  window.__DK_vmSincronizarPc = sincronizarPcComClone;
  window.__DK_vmAposSalvar = agendarSyncAposSalvar;
  window.__DK_vmNaTrocaDeTela = naTrocaDeTela;
  window.__DK_vmConsultarDelta = consultarEBaixarDelta;
  window.__DK_vmGarantirColaborador = garantirVmColaborador;
  window.__DK_vmGarantirTodas = garantirTodas;
  window.__DK_vmColetarEstadoPc = coletarEstadoPc;
  window.__DK_vmIniciarPoll = iniciarPollVm;
  window.__DK_vmPararPoll = pararPollVm;
  window.__DK_vmMarcarSincronizado = marcarSincronizadoComVm;
  window.__DK_vmListar = listarVmsNuvem;
  window.__DK_vmAcessar = acessarVmPorCpf;
  window.__DK_vmFiscalAtual = lerFiscalVm;
  window.__DK_vmLimparFiscal = limparFiscalVm;
  window.__DK_vmCpfAtiva = cpfVmAtiva;

  restaurarStatusSyncVm();
  const fiscalBoot = lerFiscalVm();
  if (fiscalBoot) gravarFiscalVm(fiscalBoot.cpf, fiscalBoot.nome);
  bindAcessarVmUi();
  if (typeof window.__DK_portalAposAcessarVm === "function" && lerFiscalVm()) {
    try {
      window.__DK_portalAposAcessarVm({
        cpf: lerFiscalVm().cpf,
        nome: lerFiscalVm().nome,
        fiscal: true,
        boot: true,
      });
    } catch {
      /* ignore */
    }
  } else if (typeof window.__DK_portalAtualizarBannerAdmin === "function") {
    try {
      window.__DK_portalAtualizarBannerAdmin();
    } catch {
      /* ignore */
    }
  }
  if (cpfSessao().length === 11) {
    iniciarPollVm();
    consultarEBaixarDelta("inicio").catch(() => {});
  }
})();
