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
  let aplicandoDelta = false;
  let syncSalvarTimer = null;
  let pollTimer = null;
  let trocaTelaTimer = null;

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

  function aplicarEstadoNoPc(estado) {
    if (!estado || typeof estado !== "object") return { ok: false, aplicadas: 0 };
    let aplicadas = 0;
    aplicandoDelta = true;
    window.__DK_vmAplicandoDelta = true;
    try {
      for (const k of CLONE_KEYS) {
        if (!Object.prototype.hasOwnProperty.call(estado, k)) continue;
        const cloudArr = Array.isArray(estado[k]) ? estado[k] : [];
        if (!cloudArr.length && k !== "dk_manutencoes_cadastro") continue;
        let localArr = [];
        try {
          localArr = typeof loadCadastro === "function" ? loadCadastro(k) || [] : [];
        } catch {
          localArr = [];
        }
        let merged = cloudArr;
        if (typeof mergeCadastroHistoricoImutavel === "function") {
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
          saveCadastro(k, merged, { bypassImmutabilidadeCadastro: true, allowShrink: true });
          aplicadas += 1;
        }
      }
    } finally {
      aplicandoDelta = false;
      window.__DK_vmAplicandoDelta = false;
    }
    return { ok: aplicadas > 0, aplicadas };
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
    const aplicado = aplicarEstadoNoPc(res.data && res.data.estado);
    if (res.data && res.data.seq != null) gravarSeqLocal(res.data.seq);
    marcarSincronizadoComVm();
    try {
      window.__DK_VM_META = res.data && res.data.meta;
      window.dispatchEvent(
        new CustomEvent("dk-maquina-virtual-espelhada", {
          detail: { meta: res.data.meta, aplicadas: aplicado.aplicadas, seq: res.data.seq },
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
    const cpf = cpfSessao();
    if (cpf.length !== 11) return { ok: false, reason: "cpf" };
    const res = await postAcao("sincronizar-pc", {
      cpf,
      nome: nomeSessao(),
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
   * Troca de tela / poll: consulta só se a seq da VM avançou; baixa o clone novo.
   */
  async function consultarEBaixarDelta(motivo) {
    if (aplicandoDelta) return { ok: true, skipped: true };
    const cpf = cpfSessao();
    if (cpf.length !== 11) return { ok: false, reason: "cpf" };
    const lastSeq = lerSeqLocal();
    const res = await postAcao("consultar-delta", { cpf, lastSeq });
    if (!res.ok) return res;
    marcarSincronizadoComVm();
    if (!res.data || !res.data.haNovidade) {
      if (res.data && res.data.seq != null) gravarSeqLocal(res.data.seq);
      return { ok: true, haNovidade: false, seq: res.data && res.data.seq, motivo };
    }
    const aplicado = aplicarEstadoNoPc(res.data.estado);
    if (res.data.seq != null) gravarSeqLocal(res.data.seq);
    try {
      window.dispatchEvent(
        new CustomEvent("dk-maquina-virtual-delta", {
          detail: { seq: res.data.seq, resumo: res.data.resumo, aplicadas: aplicado.aplicadas, motivo },
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

  restaurarStatusSyncVm();
  if (cpfSessao().length === 11) {
    iniciarPollVm();
    consultarEBaixarDelta("inicio").catch(() => {});
  }
})();
