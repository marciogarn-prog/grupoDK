/**
 * Clone na nuvem por colaborador (máquina virtual).
 * No login: espelha a VM no PC. Após sync: PC → VM → outras VMs.
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

  function digitos(v) {
    return String(v ?? "").replace(/\D/g, "").slice(0, 11);
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
    const suppress = () => {
      try {
        if (typeof window.__DK_suppressCloudHook === "boolean") window.__DK_suppressCloudHook = true;
      } catch {
        /* ignore */
      }
    };
    const unsuppress = () => {
      try {
        if (typeof window.__DK_suppressCloudHook === "boolean") window.__DK_suppressCloudHook = false;
      } catch {
        /* ignore */
      }
    };
    suppress();
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
      unsuppress();
    }
    return { ok: aplicadas > 0, aplicadas };
  }

  async function postAcao(acao, extra) {
    const body = { acao, deviceId: deviceId(), ...(extra && typeof extra === "object" ? extra : {}) };
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 20000);
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

  /**
   * Chamado após login da equipa: cria/atualiza a VM e espelha no PC físico.
   */
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
    try {
      window.__DK_VM_META = res.data && res.data.meta;
      window.dispatchEvent(
        new CustomEvent("dk-maquina-virtual-espelhada", {
          detail: { meta: res.data.meta, aplicadas: aplicado.aplicadas },
        })
      );
    } catch {
      /* ignore */
    }
    return { ok: true, meta: res.data.meta, aplicadas: aplicado.aplicadas, criada: res.data.criada };
  }

  /**
   * Após push/sync local: envia o estado do PC para a VM e propaga às outras VMs.
   */
  async function sincronizarPcComClone() {
    const cpf = cpfSessao();
    if (cpf.length !== 11) return { ok: false, reason: "cpf" };
    return postAcao("sincronizar-pc", {
      cpf,
      nome: nomeSessao(),
      estado: coletarEstadoPc(),
    });
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
  window.__DK_vmGarantirColaborador = garantirVmColaborador;
  window.__DK_vmGarantirTodas = garantirTodas;
  window.__DK_vmColetarEstadoPc = coletarEstadoPc;
})();
