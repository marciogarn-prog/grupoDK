/**
 * Portal Grupo DK — liga a UI de grupodkempreendimentos/index.html ao motor de app.js
 * (sessão, findCliente, funcionariosAccess, localStorage dos cadastros).
 * Sem este ficheiro, os botões da página não fazem nada.
 */
(function portalLocadoraUi() {
  const viewHome = document.getElementById("view-home");
  const viewUnit = document.getElementById("view-unit");
  if (!viewHome || !viewUnit) return;

  const unitTitle = document.getElementById("unit-page-title");
  const unitLead = document.getElementById("unit-page-lead");
  const loginUnit = document.getElementById("login-unit");
  const loginRole = document.getElementById("login-role");
  const panelLogin = document.getElementById("panel-login");
  const panelSenha = document.getElementById("panel-senha");
  const panelLogado = document.getElementById("panel-logado");
  const panelOperacao = document.getElementById("panel-operacao-locadora");
  const formLogin = document.getElementById("form-login");
  const btnBypassTeste = document.getElementById("login-bypass-teste-btn");
  const loginFeedback = document.getElementById("login-feedback");
  const logadoTitulo = document.getElementById("logado-titulo");
  const logadoTexto = document.getElementById("logado-texto");
  const btnOperacao = document.getElementById("btn-locadora-operacao");
  const btnSair = document.getElementById("btn-sair");
  const btnVoltarOp = document.getElementById("btn-voltar-operacao-locadora");

  let currentUnit = "";

  function showView(which) {
    if (which === "home") {
      viewHome.classList.add("view--active");
      viewHome.setAttribute("aria-hidden", "false");
      viewUnit.classList.remove("view--active");
      viewUnit.setAttribute("aria-hidden", "true");
    } else {
      viewHome.classList.remove("view--active");
      viewHome.setAttribute("aria-hidden", "true");
      viewUnit.classList.add("view--active");
      viewUnit.setAttribute("aria-hidden", "false");
    }
  }

  function hideAllPanels() {
    [panelLogin, panelSenha, panelLogado, panelOperacao].forEach((p) => {
      if (p) p.classList.add("hidden");
    });
  }

  function openUnit(go) {
    currentUnit = go;
    if (loginUnit) loginUnit.value = go;
    if (unitTitle) {
      unitTitle.textContent =
        go === "locadora" ? "DK Locadora" : go === "centro" ? "DK Centro Automotivo" : "DK Construtora";
    }
    if (unitLead) {
      unitLead.textContent =
        go === "locadora"
          ? "Escolha o tipo de acesso e informe CPF e senha. Colaborador: senha inicial 123456 (troque no 1.º acesso, se aplicável)."
          : "Conteúdo em preparação. Use o painel completo DK se precisar de cadastros aqui.";
    }
    hideAllPanels();
    if (panelLogin) panelLogin.classList.add("hidden");
    showView("unit");
  }

  document.querySelectorAll("[data-go]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const go = btn.getAttribute("data-go") || "";
      openUnit(go);
    });
  });

  document.querySelectorAll("[data-back]").forEach((btn) => {
    btn.addEventListener("click", () => {
      hideAllPanels();
      showView("home");
      try {
        const path = window.location.pathname + window.location.search;
        history.replaceState(null, "", path);
      } catch {
        /* ignore */
      }
    });
  });

  document.querySelectorAll(".role-picker__btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const role = btn.getAttribute("data-role") || "";
      if (loginRole) loginRole.value = role;
      document.querySelectorAll(".role-picker__btn").forEach((b) => b.setAttribute("aria-selected", "false"));
      btn.setAttribute("aria-selected", "true");
      hideAllPanels();
      if (panelLogin) panelLogin.classList.remove("hidden");
      const loginPanelTitle = document.getElementById("login-panel-title");
      if (loginPanelTitle) {
        loginPanelTitle.textContent =
          role === "cliente"
            ? "Entrar como cliente"
            : role === "colaborador"
              ? "Entrar como colaborador"
              : "Entrar como administrador";
      }
      const showBypass =
        currentUnit === "locadora" && (role === "colaborador" || role === "administrador");
      btnBypassTeste?.classList.toggle("hidden", !showBypass);
      if (loginFeedback) loginFeedback.textContent = "";
    });
  });

  btnBypassTeste?.addEventListener("click", () => {
    if (currentUnit !== "locadora") return;
    localStorage.setItem(
      "dk_sessao_cliente",
      JSON.stringify({
        tipo: "admin",
        cpf: "00000000000",
        nome: "Modo Teste",
        role: "operacao",
      })
    );
    hideAllPanels();
    panelLogado?.classList.remove("hidden");
    if (logadoTitulo) logadoTitulo.textContent = "Área da equipa";
    if (logadoTexto) logadoTexto.textContent = "Modo Teste · operacao";
    btnOperacao?.classList.remove("hidden");
    if (loginFeedback) loginFeedback.textContent = "";
  });

  formLogin?.addEventListener("submit", (e) => {
    e.preventDefault();
    if (typeof enforceMaintenanceAndDailyRoutines === "function" && enforceMaintenanceAndDailyRoutines()) return;
    const fd = new FormData(formLogin);
    const cpf = onlyDigits(String(fd.get("cpf") || ""));
    const senha = String(fd.get("senha") || "").trim();
    const role = String(loginRole?.value || "").trim();
    if (loginFeedback) loginFeedback.textContent = "";

    if (!role) {
      loginFeedback.textContent = "Selecione Cliente, Colaborador ou Administrador acima.";
      return;
    }

    if (role === "cliente") {
      const cliente = findCliente(cpf, senha);
      if (!cliente) {
        loginFeedback.textContent = "CPF ou senha inválidos.";
        return;
      }
      saveSession(cliente);
      hideAllPanels();
      panelLogado?.classList.remove("hidden");
      if (logadoTitulo) logadoTitulo.textContent = "Área do cliente";
      if (logadoTexto) logadoTexto.textContent = `Olá, ${String(cliente?.nome || "").trim() || "cliente"}.`;
      btnOperacao?.classList.add("hidden");
      return;
    }

    if (role === "colaborador" || role === "administrador") {
      const funcionario = funcionariosAccess.find((f) => onlyDigits(String(f.cpf || "")) === cpf && f.senha === senha);
      if (!funcionario) {
        loginFeedback.textContent = "CPF ou senha inválidos.";
        return;
      }
      if (funcionario.blocked) {
        loginFeedback.textContent = "Acesso bloqueado.";
        return;
      }
      if (funcionario.role === "operacao" && funcionario.mustChangePassword) {
        loginFeedback.textContent =
          "Primeiro acesso (troca de senha): abra o index principal do sistema DK e faça login como funcionário para definir a nova senha.";
        return;
      }
      localStorage.setItem(
        "dk_sessao_cliente",
        JSON.stringify({
          tipo: "admin",
          cpf: funcionario.cpf,
          nome: funcionario.nome,
          role: funcionario.role,
        })
      );
      hideAllPanels();
      panelLogado?.classList.remove("hidden");
      if (logadoTitulo) logadoTitulo.textContent = "Área da equipa";
      if (logadoTexto) {
        logadoTexto.textContent = `${funcionario.nome} · ${funcionario.role === "owner" ? "Administrador" : funcionario.role}`;
      }
      const allowOp = currentUnit === "locadora" && (funcionario.role === "operacao" || funcionario.role === "owner");
      btnOperacao?.classList.toggle("hidden", !allowOp);
      return;
    }
  });

  btnOperacao?.addEventListener("click", () => {
    hideAllPanels();
    panelOperacao?.classList.remove("hidden");
  });

  btnVoltarOp?.addEventListener("click", () => {
    panelOperacao?.classList.add("hidden");
    panelLogado?.classList.remove("hidden");
  });

  btnSair?.addEventListener("click", () => {
    clearSession();
    hideAllPanels();
    panelLogin?.classList.remove("hidden");
    if (loginFeedback) loginFeedback.textContent = "";
    btnOperacao?.classList.add("hidden");
    try {
      history.replaceState(null, "", window.location.pathname + window.location.search);
    } catch {
      /* ignore */
    }
  });

  function portalEscapeHtml(s) {
    if (typeof escapeHtml === "function") return escapeHtml(s);
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function formatPortalCadastroDateLabel(raw) {
    const txt = String(raw || "").trim();
    if (!txt) return "";
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(txt)) return txt;
    const brParsed = typeof parseBrDate === "function" ? parseBrDate(txt) : null;
    if (brParsed instanceof Date && !Number.isNaN(brParsed.getTime())) {
      return brParsed.toLocaleDateString("pt-BR");
    }
    const isoParsed = new Date(txt);
    if (isoParsed instanceof Date && !Number.isNaN(isoParsed.getTime())) {
      return isoParsed.toLocaleDateString("pt-BR");
    }
    return txt;
  }

  function getPortalClientesBundledSnapshot() {
    const extras =
      typeof CLIENTES_EXTRA_SYNC_DATA !== "undefined" && Array.isArray(CLIENTES_EXTRA_SYNC_DATA)
        ? CLIENTES_EXTRA_SYNC_DATA
        : [];
    if (typeof CLIENTES_DK_FINANCEIRO_2026 !== "undefined" && Array.isArray(CLIENTES_DK_FINANCEIRO_2026)) {
      return [...CLIENTES_DK_FINANCEIRO_2026, ...extras];
    }
    if (typeof clientesSeedData !== "undefined" && Array.isArray(clientesSeedData)) {
      return [...clientesSeedData, ...extras];
    }
    return extras;
  }

  /** Último número de cliente presente nos bundles (evita tecto fixo tipo 308). */
  function portalBundledClienteMaxNum() {
    if (typeof getMaxClienteCodigoFromBundledSnapshots === "function") {
      return getMaxClienteCodigoFromBundledSnapshots();
    }
    return 0;
  }

  function getPortalBundledClienteByCpf(cpfDigits) {
    if (!cpfDigits) return null;
    const base = getPortalClientesBundledSnapshot();
    return (
      base.find((c) => {
        const cpf =
          typeof onlyDigits === "function" ? onlyDigits(String(c.cpf || "")) : String(c.cpf || "").replace(/\D/g, "");
        return cpf === cpfDigits;
      }) || null
    );
  }

  function getPortalBundledClienteCodeByCpf(cpfDigits) {
    const hit = getPortalBundledClienteByCpf(cpfDigits);
    if (!hit) return "";
    const codeNum =
      Number(
        typeof onlyDigits === "function"
          ? onlyDigits(String(hit.codigo || ""))
          : String(hit.codigo || "").replace(/\D/g, "")
      ) || 0;
    if (codeNum > 0) return `CLIENTE ${codeNum}`;
    const base = getPortalClientesBundledSnapshot();
    const idx = base.indexOf(hit);
    return idx >= 0 ? `CLIENTE ${idx + 1}` : "";
  }

  function getPortalLocalExtraClientesOrdered() {
    if (typeof loadCadastro !== "function" || typeof CAD_CLIENTES_KEY === "undefined") return [];
    const snapshotCpfs = new Set(
      getPortalClientesBundledSnapshot()
        .map((c) =>
          typeof onlyDigits === "function" ? onlyDigits(String(c.cpf || "")) : String(c.cpf || "").replace(/\D/g, "")
        )
        .filter((cpf) => cpf.length === 11)
    );
    const local = loadCadastro(CAD_CLIENTES_KEY)
      .filter((c) => {
        const cpf =
          typeof onlyDigits === "function" ? onlyDigits(String(c.cpf || "")) : String(c.cpf || "").replace(/\D/g, "");
        return cpf.length === 11 && !snapshotCpfs.has(cpf);
      })
      .slice()
      .sort((a, b) => Number(a.createdAt || a.id || 0) - Number(b.createdAt || b.id || 0));
    const byCpf = new Map();
    local.forEach((c) => {
      const cpf =
        typeof onlyDigits === "function" ? onlyDigits(String(c.cpf || "")) : String(c.cpf || "").replace(/\D/g, "");
      if (!byCpf.has(cpf)) byCpf.set(cpf, c);
    });
    return Array.from(byCpf.values());
  }

  function getPortalCanonicalClienteCodeByCpf(cpfDigits) {
    const off = getPortalBundledClienteCodeByCpf(cpfDigits);
    if (off) return off;
    const extras = getPortalLocalExtraClientesOrdered();
    const idx = extras.findIndex((c) => {
      const cpf =
        typeof onlyDigits === "function" ? onlyDigits(String(c.cpf || "")) : String(c.cpf || "").replace(/\D/g, "");
      return cpf === cpfDigits;
    });
    if (idx < 0) return "";
    const anchor = portalBundledClienteMaxNum();
    return `CLIENTE ${anchor + idx + 1}`;
  }

  function getPortalNextClienteCode() {
    if (typeof nextClienteCodigo === "function") return nextClienteCodigo();
    const anchor = portalBundledClienteMaxNum();
    const extras = getPortalLocalExtraClientesOrdered();
    return `CLIENTE ${anchor + extras.length + 1}`;
  }

  /** Cliente reconhecido no portal: cadastro local, bundle do site ou seed. */
  function getPortalClienteKnownRecord(cpfDigits) {
    if (!cpfDigits || cpfDigits.length !== 11) return null;
    if (typeof findClienteByCpfCadastro === "function") {
      const local = findClienteByCpfCadastro(cpfDigits);
      if (local) return local;
    }
    if (typeof getPortalBundledClienteByCpf === "function") {
      const bundled = getPortalBundledClienteByCpf(cpfDigits);
      if (bundled) return bundled;
    }
    if (typeof clientesSeedData !== "undefined" && Array.isArray(clientesSeedData)) {
      const hit = clientesSeedData.find((c) => {
        const cpf =
          typeof onlyDigits === "function" ? onlyDigits(String(c.cpf || "")) : String(c.cpf || "").replace(/\D/g, "");
        return cpf === cpfDigits;
      });
      if (hit) return hit;
    }
    return null;
  }

  /** Índices 0,1,… para CPFs só no navegador (fora dos bundles) — alinhado ao relatório unificado. */
  function buildPortalExtraClienteIndexByCpf(mergedByCpf) {
    const snapshotCpfSet = new Set(
      getPortalClientesBundledSnapshot()
        .map((c) =>
          typeof onlyDigits === "function" ? onlyDigits(String(c.cpf || "")) : String(c.cpf || "").replace(/\D/g, "")
        )
        .filter((cpf) => cpf.length === 11)
    );
    const extraCpfs = Array.from(mergedByCpf.keys())
      .filter((cpf) => !snapshotCpfSet.has(cpf))
      .sort((cpa, cpb) => {
        const a = mergedByCpf.get(cpa);
        const b = mergedByCpf.get(cpb);
        return Number(a?.createdAt || a?.id || 0) - Number(b?.createdAt || b?.id || 0);
      });
    const m = new Map();
    extraCpfs.forEach((cpf, i) => m.set(cpf, i));
    return m;
  }

  function resolvePortalClienteCodigoRelatorio(cpfDigits, extraIdxByCpf) {
    const off = getPortalBundledClienteCodeByCpf(cpfDigits);
    if (off) return off;
    const xi = extraIdxByCpf.get(cpfDigits);
    if (xi === undefined) return "";
    const anchor = portalBundledClienteMaxNum();
    return `CLIENTE ${anchor + xi + 1}`;
  }

  function bindOperacaoClienteCpfAssist() {
    const form = document.getElementById("formOperacaoClienteInline");
    const inpCpf = document.getElementById("operacaoClienteCpf");
    const inpNome = document.getElementById("operacaoClienteNome");
    const inpDataCadastro = document.getElementById("operacaoClienteDataCadastro");
    const dlCpf = document.getElementById("operacaoClienteCpfSugestoes");
    const dlNome = document.getElementById("operacaoClienteNomeSugestoes");
    const btnAtualizar = document.getElementById("operacaoClienteAtualizarBtn");
    const msg = document.getElementById("operacaoClienteCadastroDetectMsg");
    if (!inpCpf || !inpNome || !dlNome) return;

    /** Evita repetir popup para o mesmo CPF em sequência. */
    let lastAlertedCpf = "";

    function getClienteByCpfAny(cpfDigits) {
      if (!cpfDigits) return null;
      const local = typeof findClienteByCpfCadastro === "function" ? findClienteByCpfCadastro(cpfDigits) : null;
      if (local) return local;
      const bundled = getPortalBundledClienteByCpf(cpfDigits);
      if (bundled) return bundled;
      if (typeof clientesSeedData !== "undefined" && Array.isArray(clientesSeedData)) {
        const hit = clientesSeedData.find((c) => {
          const cpf = typeof onlyDigits === "function" ? onlyDigits(String(c.cpf || "")) : String(c.cpf || "").replace(/\D/g, "");
          return cpf === cpfDigits;
        });
        if (hit) return hit;
      }
      return null;
    }

    function getPortalSessaoAdminRole() {
      try {
        const raw = localStorage.getItem("dk_sessao_cliente");
        if (!raw) return "";
        const s = JSON.parse(raw);
        if (s?.tipo !== "admin") return "";
        return String(s.role || "").trim();
      } catch {
        return "";
      }
    }

    function refreshOperacaoClienteApagarBtn(cpfDigits) {
      const btn = document.getElementById("operacaoClienteApagarBtn");
      if (!btn) return;
      const role = getPortalSessaoAdminRole();
      const isOwner = role === "owner";
      const digits = String(cpfDigits || "").replace(/\D/g, "");
      const localOnly =
        typeof findClienteByCpfCadastro === "function" && digits.length === 11
          ? findClienteByCpfCadastro(digits)
          : null;
      btn.classList.toggle("hidden", !(isOwner && localOnly));
    }

    function setAtualizarButtonByCpf(cpfDigits) {
      if (!btnAtualizar) return;
      const known = Boolean(getClienteByCpfAny(cpfDigits));
      btnAtualizar.classList.toggle("hidden", !known);
      refreshOperacaoClienteApagarBtn(cpfDigits);
    }

    /** Snapshot em JS + cadastro local + candidatos do painel; não depende só de getLancamentoClienteCandidates. */
    function getByCpfPrefix(prefixDigits) {
      if (!prefixDigits) return [];
      const byCpf = new Map();
      const addRow = (c) => {
        const cpf =
          typeof onlyDigits === "function" ? onlyDigits(String(c.cpf || "")) : String(c.cpf || "").replace(/\D/g, "");
        if (cpf.length !== 11 || !cpf.startsWith(prefixDigits)) return;
        const nome = String(c.nome || "").trim();
        const prev = byCpf.get(cpf);
        if (!prev) {
          byCpf.set(cpf, { nome, cpf, placa: String(c.placa || "").trim() });
          return;
        }
        byCpf.set(cpf, {
          nome: nome || prev.nome,
          cpf,
          placa: String(c.placa || prev.placa || "").trim(),
        });
      };
      try {
        if (typeof getLancamentoClienteCandidates === "function") {
          getLancamentoClienteCandidates().forEach(addRow);
        }
      } catch (err) {
        console.warn("[DK portal] getLancamentoClienteCandidates:", err);
      }
      getPortalClientesBundledSnapshot().forEach(addRow);
      if (typeof loadCadastro === "function" && typeof CAD_CLIENTES_KEY !== "undefined") {
        loadCadastro(CAD_CLIENTES_KEY).forEach(addRow);
      }
      const raw = Array.from(byCpf.values());
      raw.sort((a, b) => {
        const aSnap = getPortalBundledClienteByCpf(a.cpf) ? 1 : 0;
        const bSnap = getPortalBundledClienteByCpf(b.cpf) ? 1 : 0;
        if (aSnap !== bSnap) return aSnap - bSnap;
        const an = String(a.nome || "").trim();
        const bn = String(b.nome || "").trim();
        if (an && !bn) return -1;
        if (!an && bn) return 1;
        return an.localeCompare(bn, "pt-BR");
      });
      return raw.slice(0, 80);
    }

    function renderOperacaoClienteNomeListaPrefixo(prefixDigits, candidatos) {
      const nomeListaPanel = document.getElementById("operacaoClienteNomeListaPrefixo");
      if (!nomeListaPanel) return;
      if (!prefixDigits) {
        nomeListaPanel.classList.add("hidden");
        nomeListaPanel.innerHTML = "";
        return;
      }
      if (!candidatos.length) {
        nomeListaPanel.classList.remove("hidden");
        nomeListaPanel.innerHTML = `<p class="portal-cliente-prefix-list__title">Nenhum cliente com CPF começando por <strong>${portalEscapeHtml(
          prefixDigits
        )}</strong> neste navegador (base + cadastro local). Cadastre de novo ou abra o relatório para confirmar se o CPF foi guardado.</p>`;
        return;
      }
      const fmt = typeof formatCpf === "function" ? formatCpf : (cpf) => String(cpf || "");
      nomeListaPanel.classList.remove("hidden");
      nomeListaPanel.innerHTML = `<p class="portal-cliente-prefix-list__title">Quem tem CPF começando por <strong>${portalEscapeHtml(
        prefixDigits
      )}</strong> (${candidatos.length}) — clique numa linha:</p><ul class="portal-cliente-prefix-list__ul">${candidatos
        .map((c) => {
          const cpf = String(c.cpf || "").replace(/\D/g, "");
          const nome = String(c.nome || "").trim() || "(sem nome no cadastro — pode editar)";
          return `<li><button type="button" class="portal-cliente-prefix-list__btn" data-cpf-digits="${cpf}">${portalEscapeHtml(
            nome
          )} · ${portalEscapeHtml(fmt(cpf))}</button></li>`;
        })
        .join("")}</ul>`;
    }

    form?.addEventListener("click", (e) => {
      const btn = e.target.closest(".portal-cliente-prefix-list__btn");
      if (!btn || !form?.contains(btn)) return;
      const d = String(btn.getAttribute("data-cpf-digits") || "").replace(/\D/g, "");
      if (d.length !== 11) return;
      if (typeof formatCpf === "function") inpCpf.value = formatCpf(d);
      else inpCpf.value = d;
      const cliente = getClienteByCpfAny(d);
      if (cliente) {
        fillOperacaoClienteFormFromRecord(cliente);
        const dataPreferida =
          formatPortalCadastroDateLabel(cliente.dataCadastro || cliente.createdAt || cliente.id || "") ||
          getPrimeiraLocacaoDateLabelByCpf(d);
        if (inpDataCadastro && !String(inpDataCadastro.value || "").trim() && dataPreferida) {
          inpDataCadastro.value = dataPreferida;
        }
        setAtualizarButtonByCpf(d);
        lockImmutableClienteFields(true, {
          codigo: getPortalCanonicalClienteCodeByCpf(d) || String(cliente.codigo || "").trim(),
          cpf: d,
          nome: String(cliente.nome || "").trim(),
          dataCadastro: dataPreferida || String(inpDataCadastro?.value || "").trim(),
        });
        if (msg) msg.textContent = dataPreferida ? `Cliente já cadastrado em ${dataPreferida}.` : "Cliente já cadastrado.";
      }
      const panel = document.getElementById("operacaoClienteNomeListaPrefixo");
      if (panel) {
        panel.classList.add("hidden");
        panel.innerHTML = "";
      }
    });

    function lockImmutableClienteFields(known, fixed = {}) {
      const markImmutableInput = (id, on) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.classList.toggle("portal-input-immutable", Boolean(on));
      };
      const codigo = document.getElementById("operacaoClienteCodigo");
      if (codigo) {
        codigo.readOnly = true;
        if (fixed.codigo) codigo.value = fixed.codigo;
      }
      if (inpCpf) {
        inpCpf.readOnly = Boolean(known);
      }
      if (inpNome) {
        inpNome.readOnly = Boolean(known);
        if (known && fixed.nome) inpNome.value = fixed.nome;
      }
      if (inpDataCadastro) {
        inpDataCadastro.readOnly = Boolean(known);
        if (known && fixed.dataCadastro) inpDataCadastro.value = fixed.dataCadastro;
      }
      if (inpCpf && known && fixed.cpf && typeof formatCpf === "function") {
        inpCpf.value = formatCpf(fixed.cpf);
      }
      markImmutableInput("operacaoClienteCodigo", known);
      markImmutableInput("operacaoClienteNome", known);
      markImmutableInput("operacaoClienteDataCadastro", known);
    }

    function fillOperacaoClienteFormFromRecord(cliente) {
      if (!cliente) return;
      const get = (id) => document.getElementById(id);
      const cpfDigits = typeof onlyDigits === "function" ? onlyDigits(String(cliente.cpf || "")) : String(cliente.cpf || "").replace(/\D/g, "");
      if (inpCpf && cpfDigits.length === 11 && typeof formatCpf === "function") inpCpf.value = formatCpf(cpfDigits);
      if (inpNome) inpNome.value = String(cliente.nome || "").trim();
      const dataPreferida =
        formatPortalCadastroDateLabel(cliente.dataCadastro || cliente.createdAt || cliente.id || "") ||
        getPrimeiraLocacaoDateLabelByCpf(cpfDigits);
      if (inpDataCadastro && dataPreferida) inpDataCadastro.value = dataPreferida;
      const assign = (id, value) => {
        const el = get(id);
        if (!el) return;
        el.value = String(value || "").trim();
      };
      const codigoCanon = getPortalCanonicalClienteCodeByCpf(cpfDigits);
      assign("operacaoClienteCodigo", codigoCanon || cliente.codigo);
      assign("operacaoClienteCelular", cliente.celular);
      assign("operacaoClienteRecado1", cliente.recado1);
      assign("operacaoClienteRecado2", cliente.recado2);
      assign("operacaoClienteCnh", cliente.cnh);
      assign("operacaoClienteCategoria", cliente.categoria);
      assign("operacaoClienteVencimento", cliente.vencimento);
      assign("operacaoClienteCep", cliente.cep);
      assign("operacaoClienteMunicipioUf", cliente.municipioUf);
      assign("operacaoClienteEndereco", cliente.endereco);
      const ear = get("operacaoClienteEar");
      if (ear) ear.value = String(cliente.ear || "").trim();
    }

    function getPrimeiraLocacaoDateLabelByCpf(cpfDigits) {
      if (!cpfDigits || typeof loadCadastro !== "function" || typeof CAD_LOCACOES_KEY === "undefined") return "";
      const locs = loadCadastro(CAD_LOCACOES_KEY)
        .filter((l) => {
          const cpf = typeof onlyDigits === "function" ? onlyDigits(String(l.cpf || "")) : String(l.cpf || "").replace(/\D/g, "");
          return cpf === cpfDigits;
        })
        .slice();
      if (!locs.length) return "";
      locs.sort((a, b) => {
        const da = typeof parseBrDate === "function" ? parseBrDate(String(a.inicio || "").trim()) : null;
        const db = typeof parseBrDate === "function" ? parseBrDate(String(b.inicio || "").trim()) : null;
        const ta = da instanceof Date && !Number.isNaN(da.getTime()) ? da.getTime() : Number(a.createdAt || a.id || Number.MAX_SAFE_INTEGER);
        const tb = db instanceof Date && !Number.isNaN(db.getTime()) ? db.getTime() : Number(b.createdAt || b.id || Number.MAX_SAFE_INTEGER);
        return ta - tb;
      });
      const first = locs[0] || {};
      return formatPortalCadastroDateLabel(first.inicio || first.createdAt || first.id || "");
    }

    inpCpf.addEventListener("input", () => {
      const digits = typeof onlyDigits === "function" ? onlyDigits(inpCpf.value) : String(inpCpf.value || "").replace(/\D/g, "");
      const codigoEl = document.getElementById("operacaoClienteCodigo");
      if (!digits) {
        if (dlCpf) dlCpf.innerHTML = "";
        dlNome.innerHTML = "";
        renderOperacaoClienteNomeListaPrefixo("", []);
        if (msg) msg.textContent = "";
        lastAlertedCpf = "";
        setAtualizarButtonByCpf("");
        lockImmutableClienteFields(false);
        if (codigoEl) codigoEl.value = "";
        return;
      }
      const candidatos = getByCpfPrefix(digits);
      renderOperacaoClienteNomeListaPrefixo(digits, candidatos);
      const fmt = typeof formatCpf === "function" ? formatCpf : (cpf) => String(cpf || "");
      if (dlCpf) {
        dlCpf.innerHTML = candidatos
          .map(
            (c) => `<option value="${fmt(c.cpf)}" label="${portalEscapeHtml(String(c.nome || "").trim())}"></option>`
          )
          .join("");
      }
      dlNome.innerHTML = candidatos
        .map(
          (c) => `<option value="${portalEscapeHtml(String(c.nome || "").trim())}" label="${fmt(c.cpf)}"></option>`
        )
        .join("");
      // Quando há múltiplos CPFs com o mesmo prefixo, mantém o nome em branco para o operador escolher na lista.
      if (candidatos.length > 1 && inpNome) {
        inpNome.value = "";
      }
      if (candidatos.length === 1 && String(inpNome.value || "").trim() === "") {
        inpNome.value = String(candidatos[0].nome || "").trim();
      }
      setAtualizarButtonByCpf(digits);
      if (digits.length === 11 && typeof formatCpf === "function") inpCpf.value = formatCpf(digits);
      const known = Boolean(getClienteByCpfAny(digits));
      if (!known) {
        lockImmutableClienteFields(false);
        if (codigoEl) codigoEl.value = getPortalNextClienteCode();
      }
    });

    inpCpf.addEventListener("blur", () => {
      const digits = typeof onlyDigits === "function" ? onlyDigits(inpCpf.value) : String(inpCpf.value || "").replace(/\D/g, "");
      if (digits.length !== 11) return;
      const cliente = getClienteByCpfAny(digits);
      if (!cliente) {
        lockImmutableClienteFields(false);
        return;
      }
      fillOperacaoClienteFormFromRecord(cliente);
      const dataPreferida =
        formatPortalCadastroDateLabel(cliente.dataCadastro || cliente.createdAt || cliente.id || "") ||
        getPrimeiraLocacaoDateLabelByCpf(digits);
      if (inpDataCadastro && !String(inpDataCadastro.value || "").trim()) {
        if (dataPreferida) inpDataCadastro.value = dataPreferida;
      }
      setAtualizarButtonByCpf(digits);
      lockImmutableClienteFields(true, {
        codigo: getPortalCanonicalClienteCodeByCpf(digits) || String(cliente.codigo || "").trim(),
        cpf: digits,
        nome: String(cliente.nome || "").trim(),
        dataCadastro: dataPreferida || String(inpDataCadastro?.value || "").trim(),
      });
      const dataLabel = dataPreferida;
      if (msg) msg.textContent = dataLabel ? `Cliente já cadastrado em ${dataLabel}.` : "Cliente já cadastrado.";
      if (lastAlertedCpf !== digits) {
        window.alert(dataLabel ? `Cliente cadastrado em ${dataLabel}.` : "Cliente já cadastrado.");
        lastAlertedCpf = digits;
      }
    });

    form?.addEventListener("submit", (e) => {
      e.preventDefault();
      const digits =
        typeof onlyDigits === "function" ? onlyDigits(String(inpCpf.value || "")) : String(inpCpf.value || "").replace(/\D/g, "");
      if (digits.length !== 11) return;
      const known = getClienteByCpfAny(digits);
      if (known) {
        setAtualizarButtonByCpf(digits);
        lockImmutableClienteFields(true, {
          codigo: getPortalCanonicalClienteCodeByCpf(digits) || String(known.codigo || "").trim(),
          cpf: digits,
          nome: String(known.nome || "").trim(),
          dataCadastro:
            formatPortalCadastroDateLabel(known.dataCadastro || known.createdAt || known.id || "") ||
            getPrimeiraLocacaoDateLabelByCpf(digits),
        });
        if (msg) {
          msg.textContent =
            "CPF já cadastrado. Não é permitido recadastrar este cliente; use o botão 'Atualizar dados do cliente'.";
        }
        return;
      }

      if (typeof loadCadastro !== "function" || typeof saveCadastro !== "function" || typeof CAD_CLIENTES_KEY === "undefined") {
        if (msg) msg.textContent = "Cadastro indisponível neste ambiente.";
        return;
      }

      const getVal = (id) => String(document.getElementById(id)?.value || "").trim();
      const nextCode = getPortalNextClienteCode();
      const dataCadastro = getVal("operacaoClienteDataCadastro") || new Date().toLocaleDateString("pt-BR");
      const novo = {
        id: Date.now(),
        createdAt: Date.now(),
        codigo: nextCode,
        dataCadastro,
        cpf: digits,
        nome: getVal("operacaoClienteNome"),
        celular: getVal("operacaoClienteCelular"),
        recado1: getVal("operacaoClienteRecado1"),
        recado2: getVal("operacaoClienteRecado2"),
        cnh: getVal("operacaoClienteCnh"),
        categoria: getVal("operacaoClienteCategoria"),
        vencimento: getVal("operacaoClienteVencimento"),
        ear: getVal("operacaoClienteEar"),
        cep: getVal("operacaoClienteCep"),
        municipioUf: getVal("operacaoClienteMunicipioUf"),
        endereco: getVal("operacaoClienteEndereco"),
      };
      const clientes = loadCadastro(CAD_CLIENTES_KEY);
      clientes.push(novo);
      try {
        saveCadastro(CAD_CLIENTES_KEY, clientes);
      } catch (err) {
        clientes.pop();
        if (msg) msg.textContent = `Não foi possível guardar no navegador: ${err && err.message ? err.message : err}.`;
        console.error(err);
        return;
      }
      const codigoEl = document.getElementById("operacaoClienteCodigo");
      if (codigoEl) codigoEl.value = nextCode;
      if (msg) {
        msg.textContent = `Cliente ${nextCode} cadastrado com sucesso.`;
      }
      const modalRel = document.getElementById("portalRelatorioModal");
      const resumoEl = document.getElementById("portalRelatorioResumo");
      if (
        modalRel &&
        resumoEl &&
        !modalRel.classList.contains("hidden") &&
        portalRelatorioAtual &&
        portalRelatorioAtual.fileSlug === "clientes"
      ) {
        const ctx = getPortalRelatorioClienteContext();
        portalRelatorioAtual = ctx;
        resumoEl.textContent = `${ctx.rows.length} registro(s) pronto(s) para exportar em PDF ou Excel.`;
      }
    });

    btnAtualizar?.addEventListener("click", () => {
      const digits = typeof onlyDigits === "function" ? onlyDigits(inpCpf.value) : String(inpCpf.value || "").replace(/\D/g, "");
      if (digits.length !== 11) {
        if (msg) msg.textContent = "Informe um CPF completo para atualizar.";
        return;
      }
      const existente = typeof findClienteByCpfCadastro === "function" ? findClienteByCpfCadastro(digits) : null;
      if (!existente) {
        if (msg) msg.textContent = "CPF não encontrado no cadastro local para atualização.";
        return;
      }
      if (typeof loadCadastro !== "function" || typeof saveCadastro !== "function" || typeof CAD_CLIENTES_KEY === "undefined") {
        if (msg) msg.textContent = "Atualização indisponível neste ambiente.";
        return;
      }
      const clientes = loadCadastro(CAD_CLIENTES_KEY);
      const idx = clientes.findIndex((c) => {
        const cpf = typeof onlyDigits === "function" ? onlyDigits(String(c.cpf || "")) : String(c.cpf || "").replace(/\D/g, "");
        return cpf === digits;
      });
      if (idx === -1) {
        if (msg) msg.textContent = "CPF conhecido, mas não há registo local para atualizar.";
        return;
      }
      const getVal = (id) => String(document.getElementById(id)?.value || "").trim();
      const canonCode = getPortalCanonicalClienteCodeByCpf(digits) || String(existente.codigo || "").trim();
      const canonNome = String(existente.nome || "").trim();
      const canonData =
        formatPortalCadastroDateLabel(existente.dataCadastro || existente.createdAt || existente.id || "") ||
        getPrimeiraLocacaoDateLabelByCpf(digits) ||
        getVal("operacaoClienteDataCadastro");
      clientes[idx] = {
        ...clientes[idx],
        codigo: canonCode,
        dataCadastro: canonData,
        cpf: digits,
        nome: canonNome,
        celular: getVal("operacaoClienteCelular"),
        recado1: getVal("operacaoClienteRecado1"),
        recado2: getVal("operacaoClienteRecado2"),
        cnh: getVal("operacaoClienteCnh"),
        categoria: getVal("operacaoClienteCategoria"),
        vencimento: getVal("operacaoClienteVencimento"),
        ear: getVal("operacaoClienteEar"),
        cep: getVal("operacaoClienteCep"),
        municipioUf: getVal("operacaoClienteMunicipioUf"),
        endereco: getVal("operacaoClienteEndereco"),
      };
      saveCadastro(CAD_CLIENTES_KEY, clientes);
      if (msg) msg.textContent = "Dados do cliente atualizados com sucesso.";
      window.alert("Os dados que você alterou foram salvos.");
    });

    document.getElementById("operacaoClienteLimparBtn")?.addEventListener("click", (e) => {
      e.preventDefault();
      form?.reset();
      form?.querySelectorAll("input").forEach((inp) => {
        inp.value = "";
      });
      if (dlCpf) dlCpf.innerHTML = "";
      dlNome.innerHTML = "";
      renderOperacaoClienteNomeListaPrefixo("", []);
      lastAlertedCpf = "";
      setAtualizarButtonByCpf("");
      lockImmutableClienteFields(false);
      const codigo = document.getElementById("operacaoClienteCodigo");
      if (codigo) codigo.value = "";
      if (msg) msg.textContent = "";
      inpCpf.focus();
    });

    document.getElementById("operacaoClienteApagarBtn")?.addEventListener("click", (ev) => {
      ev.preventDefault();
      if (getPortalSessaoAdminRole() !== "owner") {
        window.alert("Apenas o administrador (titular) pode apagar clientes.");
        return;
      }
      const digits =
        typeof onlyDigits === "function"
          ? onlyDigits(String(inpCpf.value || ""))
          : String(inpCpf.value || "").replace(/\D/g, "");
      if (digits.length !== 11) {
        if (msg) msg.textContent = "Informe o CPF completo do cliente a apagar.";
        return;
      }
      const existente = typeof findClienteByCpfCadastro === "function" ? findClienteByCpfCadastro(digits) : null;
      if (!existente) {
        window.alert(
          "Só é possível apagar clientes guardados neste navegador. Quem está só na base embarcada do site não pode ser removido aqui."
        );
        return;
      }
      const nome = String(inpNome?.value || existente.nome || "").trim();
      const codigo = String(document.getElementById("operacaoClienteCodigo")?.value || existente.codigo || "").trim();
      if (typeof clienteTemVinculoComLocacao === "function" && clienteTemVinculoComLocacao(digits, nome, codigo)) {
        window.alert(
          "Não é possível apagar: existe registo de locação com este CPF, nome ou código de cliente."
        );
        return;
      }
      const cpfTxt = typeof formatCpf === "function" ? formatCpf(digits) : digits;
      if (
        !window.confirm(
          `Confirma apagar definitivamente o cliente ${nome || "(sem nome)"} (${cpfTxt}) deste navegador? O código poderá ser reutilizado num novo cadastro.`
        )
      ) {
        return;
      }
      const senha = window.prompt("Digite a senha do administrador (titular) para confirmar:");
      if (senha == null) return;
      if (typeof isSenhaOwnerValida !== "function" || !isSenhaOwnerValida(String(senha).trim())) {
        window.alert("Senha inválida.");
        return;
      }
      const clientes = loadCadastro(CAD_CLIENTES_KEY);
      const idx = clientes.findIndex((c) => {
        const p =
          typeof onlyDigits === "function" ? onlyDigits(String(c.cpf || "")) : String(c.cpf || "").replace(/\D/g, "");
        return p === digits;
      });
      if (idx === -1) {
        window.alert("Registo não encontrado.");
        return;
      }
      const alvo = clientes[idx];
      clientes.splice(idx, 1);
      saveCadastro(CAD_CLIENTES_KEY, clientes);
      if (typeof addAuditLog === "function") {
        addAuditLog("excluir_cliente", "cliente", `${alvo.nome || "Nao informado"} - CPF ${cpfTxt} - portal`);
      }
      document.getElementById("operacaoClienteLimparBtn")?.click();
      window.alert("Cliente apagado.");
    });
  }

  /** Cache da última refresco: placas livres (mesma regra que `getVeiculosSemProtocoloAtivo`). */
  let portalLocacaoPlacasLivresCache = [];

  function hideOperacaoLocacaoPlacaDropdown() {
    const panel = document.getElementById("operacaoLocacaoPlacaLista");
    const inp = document.getElementById("operacaoLocacaoPlaca");
    if (panel) {
      panel.classList.add("hidden");
      panel.hidden = true;
      panel.innerHTML = "";
    }
    if (inp) inp.setAttribute("aria-expanded", "false");
  }

  function filterPlacasLivresForDropdown(queryRaw) {
    if (!portalLocacaoPlacasLivresCache.length) return [];
    const trim = String(queryRaw || "").trim();
    if (!trim) return portalLocacaoPlacasLivresCache.slice();
    const qPlate =
      typeof normalizePlate === "function"
        ? normalizePlate(trim)
        : trim.toUpperCase().replace(/[^A-Z0-9]/g, "");
    const qNome =
      typeof normalizeName === "function" ? normalizeName(trim) : trim.toLowerCase();
    return portalLocacaoPlacasLivresCache.filter((v) => {
      if (qPlate && v.placa.includes(qPlate)) return true;
      const modeloKey =
        typeof normalizeName === "function"
          ? normalizeName(v.modelo)
          : String(v.modelo || "").toLowerCase();
      return modeloKey.includes(qNome);
    });
  }

  /** Lista completa ao focar (datalist HTML não mostra tudo com campo vazio). */
  function renderOperacaoLocacaoPlacaDropdown(queryRaw) {
    const panel = document.getElementById("operacaoLocacaoPlacaLista");
    const inp = document.getElementById("operacaoLocacaoPlaca");
    if (!panel || !inp) return;
    const items = filterPlacasLivresForDropdown(queryRaw);
    if (!items.length) {
      panel.innerHTML = `<div class="portal-placa-dropdown__empty">Nenhum veículo livre: sem contrato ativo nesta placa (sem protocolo em curso no cadastro ou na Receita 2026). Cadastre o veículo ou finalize a locação aberta.</div>`;
    } else {
      panel.innerHTML = items
        .map(
          (v) =>
            `<button type="button" class="portal-placa-dropdown__opt" role="option" tabindex="-1" data-placa="${v.placa}">
              <span class="portal-placa-dropdown__plate">${v.placa}</span>
              <span class="portal-placa-dropdown__model">${portalEscapeHtml(v.modelo)}</span>
            </button>`
        )
        .join("");
    }
    panel.classList.remove("hidden");
    panel.hidden = false;
    inp.setAttribute("aria-expanded", "true");
  }

  /** @type {string} */
  let portalLocacaoRelatorioPdfBlobUrl = "";

  /** @type {"ativas" | "finalizadas" | null} */
  let portalLocacaoRelatorioModo = null;

  function hideRelatorioLocacaoPdfViewer() {
    const viewer = document.getElementById("portalRelatorioPdfViewer");
    const iframe = document.getElementById("portalPdfIframe");
    if (viewer) {
      viewer.classList.add("hidden");
      viewer.setAttribute("aria-hidden", "true");
    }
    if (iframe) {
      iframe.removeAttribute("srcdoc");
      iframe.src = "about:blank";
    }
    if (portalLocacaoRelatorioPdfBlobUrl) {
      try {
        URL.revokeObjectURL(portalLocacaoRelatorioPdfBlobUrl);
      } catch {
        /* ignore */
      }
      portalLocacaoRelatorioPdfBlobUrl = "";
    }
  }

  function clearRelatorioLocacaoSelectionClasses() {
    document.getElementById("operacaoLocacaoRelAtivasBtn")?.classList.remove("portal-relatorio-locacao__btn--on");
    document.getElementById("operacaoLocacaoRelFinalizadasBtn")?.classList.remove("portal-relatorio-locacao__btn--on");
  }

  function resetOperacaoLocacaoRelatorioPanel() {
    const panel = document.getElementById("operacaoLocacaoRelatorioPanel");
    const formatos = document.getElementById("operacaoLocacaoRelatorioFormatos");
    if (panel) panel.classList.add("hidden");
    if (formatos) formatos.classList.add("hidden");
    portalLocacaoRelatorioModo = null;
    clearRelatorioLocacaoSelectionClasses();
  }

  function portalInferTipoVeiculoLocacao(locacao) {
    const nk =
      typeof normalizeKey === "function" ? normalizeKey : (v) => String(v || "").trim().toUpperCase();
    const mod = nk(String(locacao.modalidade || ""));
    if (mod.includes("CARRO")) return "CARRO";
    if (mod.includes("MOTO")) return "MOTO";
    const plate =
      typeof normalizePlate === "function"
        ? normalizePlate(String(locacao.placa || ""))
        : nk(String(locacao.placa || "")).replace(/[^A-Z0-9]/g, "");
    if (!plate) return "MOTO";
    if (typeof getVehicleMapByPlate !== "function") return "MOTO";
    const v = getVehicleMapByPlate().get(plate);
    if (!v) return "MOTO";
    const tipo = nk(String(v.tipo || ""));
    if (tipo.includes("CARRO")) return "CARRO";
    if (tipo.includes("MOTO")) return "MOTO";
    const tag = nk(String(v.tag || ""));
    if (tag.includes("DKCR")) return "CARRO";
    if (tag.includes("DKMT")) return "MOTO";
    return tipo.includes("CARRO") ? "CARRO" : "MOTO";
  }

  function isPortalLocacaoMoto(locacao) {
    return portalInferTipoVeiculoLocacao(locacao) === "MOTO";
  }

  function isPortalLocacaoFinalizada(locacao) {
    const nk =
      typeof normalizeKey === "function" ? normalizeKey : (v) => String(v || "").trim().toUpperCase();
    if (String(locacao.fim || "").trim()) return true;
    const s = nk(String(locacao.statusLocacao || locacao.status || ""));
    return s.includes("FINAL") || s.includes("INATIV");
  }

  function isPortalLocacaoAtiva(locacao) {
    return !isPortalLocacaoFinalizada(locacao);
  }

  function getPortalMotosLocacaoDataset(escopo) {
    if (typeof loadCadastro !== "function" || typeof CAD_LOCACOES_KEY === "undefined") return [];
    const locs = loadCadastro(CAD_LOCACOES_KEY);
    const motos = locs.filter(isPortalLocacaoMoto);
    if (escopo === "ativas") return motos.filter(isPortalLocacaoAtiva);
    return motos.filter(isPortalLocacaoFinalizada);
  }

  function rowPortalRelatorioLocacao(locacao) {
    const cpfDigits =
      typeof onlyDigits === "function" ? onlyDigits(String(locacao.cpf || "")) : String(locacao.cpf || "").replace(/\D/g, "");
    let nome = "";
    if (cpfDigits.length === 11 && typeof findClienteByCpfCadastro === "function") {
      nome = String(findClienteByCpfCadastro(cpfDigits)?.nome || "").trim();
    }
    const cpfExib =
      cpfDigits.length === 11 && typeof formatCpf === "function"
        ? formatCpf(cpfDigits)
        : String(locacao.cpf || "").trim();
    const statusRaw =
      typeof normalizeStatusLocacaoExibicao === "function"
        ? normalizeStatusLocacaoExibicao(String(locacao.statusLocacao || locacao.status || "").trim())
        : String(locacao.statusLocacao || locacao.status || "").trim();
    return [
      String(locacao.numeroContrato || "").trim() || "—",
      cpfExib || "—",
      nome || "—",
      typeof normalizePlate === "function"
        ? normalizePlate(String(locacao.placa || "")) || "—"
        : String(locacao.placa || "").trim() || "—",
      String(locacao.marcaModelo || "").trim() || "—",
      String(locacao.inicio || "").trim() || "—",
      String(locacao.fim || "").trim() || "—",
      String(locacao.plano || "").trim() || "—",
      statusRaw || "—",
      String(locacao.modalidade || "").trim() || "—",
    ];
  }

  function sortPortalRelatorioRows(rows) {
    return rows.slice().sort((a, b) => {
      const pa = String(a[3] || "");
      const pb = String(b[3] || "");
      const c = pa.localeCompare(pb, "pt-BR");
      if (c !== 0) return c;
      return String(a[5] || "").localeCompare(String(b[5] || ""), "pt-BR");
    });
  }

  /** Contexto do relatório aberto no modal (cliente/veículo/locação). */
  let portalRelatorioAtual = null;

  function openPortalRelatorioModal(context) {
    const modal = document.getElementById("portalRelatorioModal");
    const titulo = document.getElementById("portalRelatorioTitulo");
    const resumo = document.getElementById("portalRelatorioResumo");
    if (!modal || !titulo || !resumo) return;
    portalRelatorioAtual = context;
    titulo.textContent = context.title;
    resumo.textContent = `${context.rows.length} registro(s) pronto(s) para exportar em PDF ou Excel.`;
    modal.classList.remove("hidden");
    modal.setAttribute("aria-hidden", "false");
  }

  function closePortalRelatorioModal() {
    const modal = document.getElementById("portalRelatorioModal");
    if (!modal) return;
    modal.classList.add("hidden");
    modal.setAttribute("aria-hidden", "true");
  }

  function buildPortalRelatorioHtml(title, headers, rows) {
    const eh = typeof escapeHtml === "function" ? escapeHtml : portalEscapeHtml;
    const headCells = headers.map((h) => `<th>${eh(h)}</th>`).join("");
    const bodyCells = rows.map((row) => `<tr>${row.map((c) => `<td>${eh(c)}</td>`).join("")}</tr>`).join("");
    const quando = new Date().toLocaleString("pt-BR");
    return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><title>${eh(title)}</title><style>
      body{font-family:system-ui,-apple-system,sans-serif;margin:1.2rem;color:#111;font-size:12px}
      h1{font-size:1.05rem;margin:0 0 0.35rem}
      .meta{color:#444;margin:0 0 0.75rem;font-size:11px}
      table{width:100%;border-collapse:collapse}
      th,td{border:1px solid #333;padding:5px 7px;text-align:left}
      th{background:#eee;font-weight:600}
    </style></head><body>
      <h1>${eh(title)}</h1>
      <p class="meta">Emitido em ${eh(quando)} · ${eh(String(rows.length))} registo(s)</p>
      <table><thead><tr>${headCells}</tr></thead><tbody>${bodyCells || `<tr><td colspan="${headers.length}">${eh(
        "Nenhum registo."
      )}</td></tr>`}</tbody></table>
    </body></html>`;
  }

  function emitPortalRelatorioPdf(context) {
    const iframe = document.getElementById("portalPdfIframe");
    const viewer = document.getElementById("portalRelatorioPdfViewer");
    if (!iframe || !viewer) return;
    const html = buildPortalRelatorioHtml(context.title, context.headers, context.rows);
    hideRelatorioLocacaoPdfViewer();
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    portalLocacaoRelatorioPdfBlobUrl = URL.createObjectURL(blob);
    iframe.src = portalLocacaoRelatorioPdfBlobUrl;
    viewer.classList.remove("hidden");
    viewer.setAttribute("aria-hidden", "false");
  }

  function emitPortalRelatorioExcel(context) {
    if (typeof downloadStyledExcel !== "function") return;
    const d = new Date();
    const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const metaLines = [
      ["Relatório", context.title],
      ["Emitido em", d.toLocaleString("pt-BR")],
      ["Registos", String(context.rows.length)],
    ];
    downloadStyledExcel(`relatorio-${context.fileSlug}-${stamp}`, context.headers, context.rows, metaLines, {
      textColumns: context.textColumns || [],
    });
  }

  function getPortalRelatorioClienteContext() {
    // Lista única: dados dos bundles (cresce a cada export/sync para o site) fundidos com dk_clientes_cadastro deste navegador.
    const bundledSnapshot = getPortalClientesBundledSnapshot();
    const bundledFallbackSeed =
      typeof clientesSeedData !== "undefined" && Array.isArray(clientesSeedData) ? clientesSeedData : [];
    const bundledRows =
      bundledSnapshot.length > 0
        ? bundledSnapshot
        : bundledFallbackSeed.length > 0
          ? bundledFallbackSeed
          : [];
    const cadastroLocalRaw =
      typeof loadCadastro === "function" && typeof CAD_CLIENTES_KEY !== "undefined" ? loadCadastro(CAD_CLIENTES_KEY) : [];
    const bundledCpfSet = new Set(
      bundledRows.map((c) =>
        typeof onlyDigits === "function" ? onlyDigits(String(c.cpf || "")) : String(c.cpf || "").replace(/\D/g, "")
      ).filter((p) => p.length === 11)
    );
    const cadastroLocal = cadastroLocalRaw.filter((c) => {
      const cpfDigits =
        typeof onlyDigits === "function" ? onlyDigits(String(c.cpf || "")) : String(c.cpf || "").replace(/\D/g, "");
      if (cpfDigits.length !== 11) return false;
      if (bundledCpfSet.has(cpfDigits)) return true;
      return String(c.nome || "").trim().length >= 3;
    });

    const byCpf = new Map();
    const scoreClienteRow = (x) =>
      [
        x.codigo,
        x.dataCadastro,
        x.nome,
        x.celular,
        x.cnh,
        x.categoria,
        x.vencimento,
        x.municipioUf,
      ].filter((v) => String(v || "").trim()).length;

    const mergeOne = (c, preferOnTie) => {
      const cpfDigits =
        typeof onlyDigits === "function" ? onlyDigits(String(c.cpf || "")) : String(c.cpf || "").replace(/\D/g, "");
      if (cpfDigits.length !== 11) return;
      const prev = byCpf.get(cpfDigits);
      if (!prev) {
        byCpf.set(cpfDigits, c);
        return;
      }
      const sPrev = scoreClienteRow(prev);
      const sNew = scoreClienteRow(c);
      if (sNew > sPrev || (preferOnTie && sNew === sPrev)) byCpf.set(cpfDigits, c);
    };

    bundledRows.forEach((c) => mergeOne(c, false));
    cadastroLocal.forEach((c) => mergeOne(c, true));

    const extraIdxByCpf = buildPortalExtraClienteIndexByCpf(byCpf);

    const clienteCodigoSortKey = (rec) => {
      const cpfDigits =
        typeof onlyDigits === "function"
          ? onlyDigits(String(rec.cpf || ""))
          : String(rec.cpf || "").replace(/\D/g, "");
      const canon = resolvePortalClienteCodigoRelatorio(cpfDigits, extraIdxByCpf);
      const n =
        typeof onlyDigits === "function"
          ? onlyDigits(String(canon || ""))
          : String(canon || "").replace(/\D/g, "");
      let num = Number(n) || 0;
      if (!num) {
        num =
          Number(
            typeof onlyDigits === "function"
              ? onlyDigits(String(rec.codigo || ""))
              : String(rec.codigo || "").replace(/\D/g, "")
          ) || 0;
      }
      return num;
    };

    const rowsRaw = Array.from(byCpf.values()).sort((a, b) => {
      const ka = clienteCodigoSortKey(a);
      const kb = clienteCodigoSortKey(b);
      if (ka !== kb) return ka - kb;
      return String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR");
    });
    const headers = ["Cód.", "Data Cadastro", "CPF", "Nome", "Celular", "CNH", "Categoria", "Vencimento", "Município/UF"];
    const fmtCpf = typeof formatCpf === "function" ? formatCpf : (v) => String(v || "");
    const rows = rowsRaw.map((c) => {
      const cpfDigits =
        typeof onlyDigits === "function"
          ? onlyDigits(String(c.cpf || ""))
          : String(c.cpf || "").replace(/\D/g, "");
      const codigoRel = resolvePortalClienteCodigoRelatorio(cpfDigits, extraIdxByCpf);
      return [
        codigoRel || String(c.codigo || "").trim() || "—",
        String(c.dataCadastro || "").trim() || "—",
        cpfDigits.length === 11 ? fmtCpf(cpfDigits) : String(c.cpf || "").trim() || "—",
        String(c.nome || "").trim() || "—",
        String(c.celular || "").trim() || "—",
        String(c.cnh || "").trim() || "—",
        String(c.categoria || "").trim() || "—",
        String(c.vencimento || "").trim() || "—",
        String(c.municipioUf || "").trim() || "—",
      ];
    });
    return {
      title: "Relatório de clientes — lista unificada",
      headers,
      rows,
      fileSlug: "clientes",
      textColumns: [0, 2],
    };
  }

  function getPortalRelatorioVeiculoContext() {
    const rowsRaw =
      typeof loadCadastro === "function" && typeof CAD_VEICULOS_KEY !== "undefined" ? loadCadastro(CAD_VEICULOS_KEY) : [];
    const headers = ["Tag", "Placa", "Código", "Marca", "Modelo", "Tipo", "Ano/Modelo", "Valor", "Cor"];
    const rows = rowsRaw.map((v) => [
      String(v.tag || "").trim() || "—",
      String(v.placa || "").trim() || "—",
      String(v.codigo || "").trim() || "—",
      String(v.marca || "").trim() || "—",
      String(v.modelo || "").trim() || "—",
      String(v.tipo || "").trim() || "—",
      String(v.anoModelo || "").trim() || "—",
      String(v.valor || "").trim() || "—",
      String(v.cor || "").trim() || "—",
    ]);
    return { title: "Relatório de veículos cadastrados", headers, rows, fileSlug: "veiculos", textColumns: [0, 1, 2] };
  }

  function getPortalRelatorioLocacaoContext() {
    const rowsRaw =
      typeof loadCadastro === "function" && typeof CAD_LOCACOES_KEY !== "undefined" ? loadCadastro(CAD_LOCACOES_KEY) : [];
    const headers = ["Protocolo", "CPF", "Cliente", "Placa", "Modelo", "Início", "Fim", "Plano", "Status"];
    const rows = rowsRaw.map((l) => rowPortalRelatorioLocacao(l).slice(0, 9));
    return { title: "Relatório de locações cadastradas", headers, rows, fileSlug: "locacoes", textColumns: [0, 1, 3] };
  }

  /** Sempre relê o cadastro no navegador — evita PDF/Excel com dados antigos se o operador guardou algo depois de abrir o modal. */
  function getPortalRelatorioContextFresh(anchor) {
    const slug = anchor && anchor.fileSlug;
    if (slug === "clientes") return getPortalRelatorioClienteContext();
    if (slug === "veiculos") return getPortalRelatorioVeiculoContext();
    if (slug === "locacoes") return getPortalRelatorioLocacaoContext();
    return anchor;
  }

  function emitPortalRelatorioLocacaoPdf(escopo) {
    const titulo =
      escopo === "ativas" ? "Locações de motos — ativas" : "Locações de motos — finalizadas";
    const raw = getPortalMotosLocacaoDataset(escopo);
    const rows = sortPortalRelatorioRows(raw.map(rowPortalRelatorioLocacao));
    const headers = [
      "Protocolo",
      "CPF",
      "Cliente",
      "Placa",
      "Modelo",
      "Início",
      "Fim",
      "Plano",
      "Status",
      "Modalidade",
    ];
    const eh = typeof escapeHtml === "function" ? escapeHtml : portalEscapeHtml;
    const headCells = headers.map((h) => `<th>${eh(h)}</th>`).join("");
    const bodyCells = rows
      .map((row) => `<tr>${row.map((c) => `<td>${eh(c)}</td>`).join("")}</tr>`)
      .join("");
    const quando = new Date().toLocaleString("pt-BR");
    const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><title>${eh(
      titulo
    )}</title><style>
      body{font-family:system-ui,-apple-system,sans-serif;margin:1.2rem;color:#111;font-size:12px}
      h1{font-size:1.05rem;margin:0 0 0.35rem}
      .meta{color:#444;margin:0 0 0.75rem;font-size:11px}
      table{width:100%;border-collapse:collapse}
      th,td{border:1px solid #333;padding:5px 7px;text-align:left}
      th{background:#eee;font-weight:600}
    </style></head><body>
      <h1>${eh(titulo)}</h1>
      <p class="meta">Emitido em ${eh(quando)} · ${eh(String(rows.length))} registo(s)</p>
      <table><thead><tr>${headCells}</tr></thead><tbody>${bodyCells || `<tr><td colspan="${headers.length}">${eh(
        "Nenhum registo neste filtro."
      )}</td></tr>`}</tbody></table>
    </body></html>`;

    const iframe = document.getElementById("portalPdfIframe");
    const viewer = document.getElementById("portalRelatorioPdfViewer");
    if (!iframe || !viewer) return;

    hideRelatorioLocacaoPdfViewer();
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    portalLocacaoRelatorioPdfBlobUrl = URL.createObjectURL(blob);
    iframe.src = portalLocacaoRelatorioPdfBlobUrl;
    viewer.classList.remove("hidden");
    viewer.setAttribute("aria-hidden", "false");
  }

  function emitPortalRelatorioLocacaoExcel(escopo) {
    if (typeof downloadStyledExcel !== "function") {
      const msg = document.getElementById("operacaoLocacaoInlineMsg");
      if (msg) msg.textContent = "Exportação Excel indisponível neste ambiente.";
      return;
    }
    const label = escopo === "ativas" ? "Locações ativas (motos)" : "Locações finalizadas (motos)";
    const raw = getPortalMotosLocacaoDataset(escopo);
    const rows = sortPortalRelatorioRows(raw.map(rowPortalRelatorioLocacao));
    const headers = [
      "Protocolo",
      "CPF",
      "Cliente",
      "Placa",
      "Modelo",
      "Início",
      "Fim",
      "Plano",
      "Status",
      "Modalidade",
    ];
    const d = new Date();
    const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const fileSlug = escopo === "ativas" ? "motos-ativas" : "motos-finalizadas";
    const metaLines = [
      ["Relatório", label],
      ["Emitido em", d.toLocaleString("pt-BR")],
      ["Registos", String(rows.length)],
    ];
    downloadStyledExcel(`relatorio-locacao-${fileSlug}-${stamp}`, headers, rows, metaLines, {
      textColumns: [0, 1, 3],
    });
    const msg = document.getElementById("operacaoLocacaoInlineMsg");
    if (msg) msg.textContent = rows.length ? `Excel gerado (${rows.length} linha(s)).` : "Excel gerado — nenhum registo neste filtro.";
  }

  document.getElementById("operacaoClienteGerarRelatorioBtn")?.addEventListener("click", (e) => {
    e.preventDefault();
    openPortalRelatorioModal(getPortalRelatorioClienteContext());
  });

  document.getElementById("operacaoVeiculoGerarRelatorioBtn")?.addEventListener("click", (e) => {
    e.preventDefault();
    openPortalRelatorioModal(getPortalRelatorioVeiculoContext());
  });

  document.getElementById("operacaoLocacaoGerarRelatorioBtn")?.addEventListener("click", (e) => {
    e.preventDefault();
    openPortalRelatorioModal(getPortalRelatorioLocacaoContext());
  });

  document.getElementById("operacaoLocacaoRelAtivasBtn")?.addEventListener("click", (e) => {
    e.preventDefault();
    portalLocacaoRelatorioModo = "ativas";
    clearRelatorioLocacaoSelectionClasses();
    document.getElementById("operacaoLocacaoRelAtivasBtn")?.classList.add("portal-relatorio-locacao__btn--on");
    document.getElementById("operacaoLocacaoRelatorioFormatos")?.classList.remove("hidden");
  });

  document.getElementById("operacaoLocacaoRelFinalizadasBtn")?.addEventListener("click", (e) => {
    e.preventDefault();
    portalLocacaoRelatorioModo = "finalizadas";
    clearRelatorioLocacaoSelectionClasses();
    document.getElementById("operacaoLocacaoRelFinalizadasBtn")?.classList.add("portal-relatorio-locacao__btn--on");
    document.getElementById("operacaoLocacaoRelatorioFormatos")?.classList.remove("hidden");
  });

  document.getElementById("operacaoLocacaoRelPdfBtn")?.addEventListener("click", (e) => {
    e.preventDefault();
    if (!portalLocacaoRelatorioModo) {
      const msg = document.getElementById("operacaoLocacaoInlineMsg");
      if (msg) msg.textContent = "Escolha primeiro «Locações ativas» ou «Locações finalizadas».";
      return;
    }
    emitPortalRelatorioLocacaoPdf(portalLocacaoRelatorioModo);
  });

  document.getElementById("operacaoLocacaoRelExcelBtn")?.addEventListener("click", (e) => {
    e.preventDefault();
    if (!portalLocacaoRelatorioModo) {
      const msg = document.getElementById("operacaoLocacaoInlineMsg");
      if (msg) msg.textContent = "Escolha primeiro «Locações ativas» ou «Locações finalizadas».";
      return;
    }
    emitPortalRelatorioLocacaoExcel(portalLocacaoRelatorioModo);
  });

  document.getElementById("portalRelatorioFecharBtn")?.addEventListener("click", () => closePortalRelatorioModal());
  document.querySelectorAll("[data-close-relatorio]").forEach((el) => {
    el.addEventListener("click", () => closePortalRelatorioModal());
  });
  document.getElementById("portalRelatorioPdfBtn")?.addEventListener("click", () => {
    if (!portalRelatorioAtual) return;
    const ctx = getPortalRelatorioContextFresh(portalRelatorioAtual);
    portalRelatorioAtual = ctx;
    closePortalRelatorioModal();
    emitPortalRelatorioPdf(ctx);
  });
  document.getElementById("portalRelatorioExcelBtn")?.addEventListener("click", () => {
    if (!portalRelatorioAtual) return;
    const ctx = getPortalRelatorioContextFresh(portalRelatorioAtual);
    portalRelatorioAtual = ctx;
    closePortalRelatorioModal();
    emitPortalRelatorioExcel(ctx);
  });

  document.getElementById("portalPdfFecharViewerBtn")?.addEventListener("click", () => hideRelatorioLocacaoPdfViewer());

  document.getElementById("portalPdfImprimirBtn")?.addEventListener("click", () => {
    const iframe = document.getElementById("portalPdfIframe");
    try {
      iframe?.contentWindow?.focus();
      iframe?.contentWindow?.print();
    } catch {
      /* ignore */
    }
  });

  function hideOperacaoInlineFormsCore() {
    hideOperacaoLocacaoPlacaDropdown();
    resetOperacaoLocacaoRelatorioPanel();
    document.getElementById("operacaoInlineCliente")?.classList.add("hidden");
    document.getElementById("operacaoInlineVeiculo")?.classList.add("hidden");
    document.getElementById("operacaoInlineLocacao")?.classList.add("hidden");
  }

  function setOperacaoFormPlaceholderVisible(visible) {
    const el = document.getElementById("operacaoFormPlaceholder");
    if (!el) return;
    el.classList.toggle("hidden", !visible);
    el.setAttribute("aria-hidden", visible ? "false" : "true");
  }

  function syncOperacaoCadastroButtons(activeButtonId) {
    ["btn-operacao-cadastro-cliente", "btn-operacao-cadastro-veiculo", "btn-operacao-cadastro-locacao"].forEach((id) => {
      const b = document.getElementById(id);
      if (!b) return;
      const on = Boolean(activeButtonId && id === activeButtonId);
      b.classList.toggle("is-active", on);
      b.setAttribute("aria-expanded", on ? "true" : "false");
    });
  }

  function hideInlineForms() {
    hideOperacaoInlineFormsCore();
    setOperacaoFormPlaceholderVisible(true);
    syncOperacaoCadastroButtons(null);
  }

  /**
   * Preenche os datalists do formulário de locação (portal): mesmas regras que o painel DK —
   * placas de `getVeiculosSemProtocoloAtivo()`, clientes de `getLancamentoClienteCandidates()`.
   */
  function refreshOperacaoLocacaoDatalists() {
    const dlPlaca = document.getElementById("operacaoLocacaoPlacaSugestoes");
    const dlCpf = document.getElementById("operacaoLocacaoCpfSugestoes");
    const dlNome = document.getElementById("operacaoLocacaoClienteSugestoes");
    const inpPlaca = document.getElementById("operacaoLocacaoPlaca");
    const inpCpf = document.getElementById("operacaoLocacaoCpf");
    const inpNome = document.getElementById("operacaoLocacaoCliente");

    const prevPlaca = inpPlaca ? String(inpPlaca.value || "").trim() : "";
    const prevCpf = inpCpf ? String(inpCpf.value || "").trim() : "";
    const prevNome = inpNome ? String(inpNome.value || "").trim() : "";

    portalLocacaoPlacasLivresCache = [];
    if (typeof getVeiculosSemProtocoloAtivo === "function") {
      portalLocacaoPlacasLivresCache = getVeiculosSemProtocoloAtivo()
        .map((v) => ({
          placa: String(v.placa || "").trim().toUpperCase(),
          modelo: String(v.modelo || "").trim() || "Modelo nao informado",
        }))
        .filter((v) => v.placa);
      if (dlPlaca) {
        dlPlaca.innerHTML = portalLocacaoPlacasLivresCache
          .map((v) => `<option value="${v.placa}" label="${portalEscapeHtml(v.modelo)}"></option>`)
          .join("");
      }
    }

    if (
      dlCpf &&
      dlNome &&
      typeof getLancamentoClienteCandidates === "function"
    ) {
      const candidatos = getLancamentoClienteCandidates().slice(0, 200);
      const fmt = typeof formatCpf === "function" ? formatCpf : (cpf) => String(cpf || "");
      dlCpf.innerHTML = candidatos
        .map(
          (c) =>
            `<option value="${fmt(c.cpf)}" label="${portalEscapeHtml(String(c.nome || "").trim())}"></option>`
        )
        .join("");
      dlNome.innerHTML = candidatos
        .map(
          (c) =>
            `<option value="${portalEscapeHtml(String(c.nome || "").trim())}" label="${fmt(c.cpf)}"></option>`
        )
        .join("");
    }

    if (inpPlaca) inpPlaca.value = prevPlaca;
    if (inpCpf) inpCpf.value = prevCpf;
    if (inpNome) inpNome.value = prevNome;
  }

  /**
   * Mesma ideia que `normalizeName` em app.js, mas colapsa espaços internos para o utilizador
   * não falhar por "Maria  Silva" vs "Maria Silva".
   */
  function portalNomeChaveBusca(raw) {
    if (typeof normalizeName === "function") {
      return normalizeName(String(raw || ""))
        .replace(/\s+/g, " ")
        .trim();
    }
    return String(raw || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase()
      .replace(/\s+/g, " ")
      .trim();
  }

  /**
   * Resolve CPF a partir do nome usando `getLancamentoClienteCandidates()` (cadastro + receita).
   * Antes só havia igualdade exata; nomes parciais ou com pequenas diferenças não encontravam registo.
   */
  function resolvePortalLocacaoCpfFromNomeDigitado(nomeRaw) {
    if (typeof getLancamentoClienteCandidates !== "function") return null;
    const key = portalNomeChaveBusca(nomeRaw);
    if (!key) return null;
    const candidatos = getLancamentoClienteCandidates();
    const nk = (nome) => portalNomeChaveBusca(nome);
    const exato = candidatos.find((c) => nk(c.nome) === key);
    if (exato) return onlyDigits(String(exato.cpf || "")) || null;
    if (key.length < 2) return null;
    const porInclusao = candidatos.filter((c) => nk(c.nome).includes(key));
    if (porInclusao.length === 1) {
      const cpf = onlyDigits(String(porInclusao[0].cpf || ""));
      return cpf.length === 11 ? cpf : null;
    }
    const porPrefixo = candidatos.filter((c) => nk(c.nome).startsWith(key));
    if (porPrefixo.length === 1) {
      const cpf = onlyDigits(String(porPrefixo[0].cpf || ""));
      return cpf.length === 11 ? cpf : null;
    }
    return null;
  }

  function syncPortalLocacaoCpfFromNomeField() {
    const inpCpf = document.getElementById("operacaoLocacaoCpf");
    const inpNome = document.getElementById("operacaoLocacaoCliente");
    if (!inpCpf || !inpNome || typeof formatCpf !== "function") return;
    const digits = typeof onlyDigits === "function" ? onlyDigits(inpCpf.value) : String(inpCpf.value || "").replace(/\D/g, "");
    const resolved = resolvePortalLocacaoCpfFromNomeDigitado(inpNome.value);
    if (!resolved) return;
    if (digits.length === 11 && digits !== resolved) return;
    inpCpf.value = formatCpf(resolved);
    refreshOperacaoLocacaoProtocoloPicker({ force: true });
  }

  function formatPortalDataBr(date = new Date()) {
    const d = date instanceof Date && !Number.isNaN(date.getTime()) ? date : new Date();
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const y = d.getFullYear();
    return `${day}/${month}/${y}`;
  }

  function syncOperacaoLocacaoDiaPagamentoFromDataInicio() {
    const inpDataInicio = document.getElementById("operacaoLocacaoDataInicio");
    const inpDiaPagamento = document.getElementById("operacaoLocacaoDiaPagamento");
    if (!inpDataInicio || !inpDiaPagamento) return;
    const raw = String(inpDataInicio.value || "").trim();
    if (!raw) return;
    const d = typeof parseBrDate === "function" ? parseBrDate(raw) : null;
    if (!d || Number.isNaN(d.getTime())) return;
    inpDiaPagamento.value = d.toLocaleDateString("pt-BR", { weekday: "long" });
  }

  /**
   * Dias do contrato: com data fim → diferença em dias corridos entre fim e início (alinhado à Receita 2026, ex. 57 para 22/04→18/06).
   * Sem data fim → dias desde o início até hoje (contrato em curso no formulário).
   */
  function syncOperacaoLocacaoTempoDiasContrato() {
    const inpDataInicio = document.getElementById("operacaoLocacaoDataInicio");
    const inpDataFim = document.getElementById("operacaoLocacaoDataFim");
    const inpTempo = document.getElementById("operacaoLocacaoTempoDias");
    if (!inpDataInicio || !inpTempo) return;
    const rawInicio = String(inpDataInicio.value || "").trim();
    if (!rawInicio) {
      inpTempo.value = "";
      return;
    }
    const inicio = typeof parseBrDate === "function" ? parseBrDate(rawInicio) : null;
    if (!inicio || Number.isNaN(inicio.getTime())) {
      inpTempo.value = "";
      return;
    }
    const rawFim = String(inpDataFim?.value || "").trim();
    if (rawFim) {
      const fim = typeof parseBrDate === "function" ? parseBrDate(rawFim) : null;
      if (fim && !Number.isNaN(fim.getTime())) {
        const t0 =
          typeof toDateOnly === "function"
            ? toDateOnly(inicio).getTime()
            : new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate()).getTime();
        const t1 =
          typeof toDateOnly === "function"
            ? toDateOnly(fim).getTime()
            : new Date(fim.getFullYear(), fim.getMonth(), fim.getDate()).getTime();
        const dias = Math.max(1, Math.round((t1 - t0) / 86400000));
        inpTempo.value = String(dias);
        return;
      }
    }
    const start = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate());
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const diffMs = today.getTime() - start.getTime();
    const dias = Math.round(diffMs / (24 * 60 * 60 * 1000));
    inpTempo.value = String(Math.max(0, dias));
  }

  function syncOperacaoLocacaoFromDataInicio() {
    syncOperacaoLocacaoDiaPagamentoFromDataInicio();
    syncOperacaoLocacaoTempoDiasContrato();
    syncOperacaoLocacaoValorDevidoPlano();
  }

  /** Com investimento > 0: DK MINHA MOTO; caso contrário: DK MEU TRANSPORTE (mesma regra do painel DK). */
  function syncOperacaoLocacaoTipoPlano() {
    const inpTipo = document.getElementById("operacaoLocacaoTipoPlano");
    const inpInv = document.getElementById("operacaoLocacaoValorInvestimento");
    if (!inpTipo) return;
    const parse =
      typeof parseCurrencyBR === "function"
        ? parseCurrencyBR
        : (v) => {
            const cleaned = String(v ?? "")
              .replace(/[R$\s]/g, "")
              .replace(/\./g, "")
              .replace(",", ".");
            const n = Number(cleaned);
            return Number.isFinite(n) ? n : 0;
          };
    const inv = parse(inpInv?.value ?? "");
    inpTipo.value = Number(inv) > 0 ? "DK MINHA MOTO" : "DK MEU TRANSPORTE";
  }

  /** Valor devido do plano = tempo em dias × (valor do plano ÷ 7). Exibido em R$. */
  function syncOperacaoLocacaoValorDevidoPlano() {
    const inpDevido = document.getElementById("operacaoLocacaoValorDevidoPlano");
    const inpTempo = document.getElementById("operacaoLocacaoTempoDias");
    const inpLoc = document.getElementById("operacaoLocacaoValorAluguel");
    const inpInv = document.getElementById("operacaoLocacaoValorInvestimento");
    if (!inpDevido) return;
    const parse =
      typeof parseCurrencyBR === "function"
        ? parseCurrencyBR
        : (v) => {
            const cleaned = String(v ?? "")
              .replace(/[R$\s]/g, "")
              .replace(/\./g, "")
              .replace(",", ".");
            const n = Number(cleaned);
            return Number.isFinite(n) ? n : 0;
          };
    const loc = parse(inpLoc?.value ?? "");
    const inv = parse(inpInv?.value ?? "");
    const plano = Number(loc) + Number(inv);
    const tempoStr = String(inpTempo?.value ?? "").trim();
    const tempo = tempoStr === "" ? 0 : Math.max(0, Number.parseInt(tempoStr, 10) || 0);
    const custoDia = plano / 7;
    const devido = tempo * custoDia;
    if (typeof currencyBRL === "function") {
      inpDevido.value = currencyBRL(devido);
    } else {
      inpDevido.value = Number(devido || 0).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
      });
    }
  }

  /** Se a data de início estiver vazia, sugere a data de hoje (sincronização no botão Cadastro de locação). */
  function suggestOperacaoLocacaoDataInicioComoHoje() {
    const inp = document.getElementById("operacaoLocacaoDataInicio");
    if (!inp) return;
    inp.placeholder = `Ex.: ${formatPortalDataBr(new Date())}`;
    if (String(inp.value || "").trim()) return;
    inp.value = formatPortalDataBr(new Date());
  }

  const PORTAL_PROTO_NOVO = "__PORTAL_PROTO_NOVO__";
  let portalLocacaoProtocoloPickerCpf = "";

  function collectPortalLocacoesByCpf(cpfDigits) {
    if (!cpfDigits || cpfDigits.length !== 11) return [];
    if (typeof loadCadastro !== "function" || typeof CAD_LOCACOES_KEY === "undefined") return [];
    const dig =
      typeof onlyDigits === "function" ? onlyDigits : (s) => String(s ?? "").replace(/\D/g, "");
    return loadCadastro(CAD_LOCACOES_KEY).filter((l) => dig(String(l.cpf || "")) === cpfDigits);
  }

  /** Próximo protocolo AAAAMMDDXX (XX = sequência do dia, 2 dígitos até 99). */
  function proximoProtocoloPortalAaaammddXX(date = new Date()) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    const prefix = `${y}${m}${d}`;
    const locs =
      typeof loadCadastro === "function" && typeof CAD_LOCACOES_KEY !== "undefined"
        ? loadCadastro(CAD_LOCACOES_KEY)
        : [];
    const norm = (v) =>
      typeof normalizeNumeroContratoKey === "function"
        ? String(normalizeNumeroContratoKey(v || "")).replace(/\s+/g, "")
        : String(v || "")
            .trim()
            .toUpperCase()
            .replace(/\s+/g, "");
    let maxSeq = 0;
    locs.forEach((l) => {
      const nc = norm(l.numeroContrato || "");
      if (!nc.startsWith(prefix)) return;
      const rest = nc.slice(prefix.length);
      if (!/^\d+$/.test(rest)) return;
      maxSeq = Math.max(maxSeq, Number(rest));
    });
    const next = maxSeq + 1;
    const width = next <= 99 ? 2 : String(next).length;
    return `${prefix}${String(next).padStart(width, "0")}`;
  }

  function applyPortalLocacaoRowFromRecord(loc) {
    const placaEl = document.getElementById("operacaoLocacaoPlaca");
    const modeloEl = document.getElementById("operacaoLocacaoModelo");
    const diEl = document.getElementById("operacaoLocacaoDataInicio");
    const dfEl = document.getElementById("operacaoLocacaoDataFim");
    const diaPagEl = document.getElementById("operacaoLocacaoDiaPagamento");
    const valLocEl = document.getElementById("operacaoLocacaoValorAluguel");
    const valInvEl = document.getElementById("operacaoLocacaoValorInvestimento");
    const tipoPlanoEl = document.getElementById("operacaoLocacaoTipoPlano");
    const hid = document.getElementById("operacaoLocacaoProtocolo");
    const nc =
      typeof normalizeNumeroContratoKey === "function"
        ? normalizeNumeroContratoKey(loc.numeroContrato || "")
        : String(loc.numeroContrato || "").trim();
    if (hid) hid.value = nc;
    if (placaEl && typeof normalizePlate === "function") {
      const p = normalizePlate(String(loc.placa || ""));
      if (p) placaEl.value = p;
    }
    if (modeloEl) modeloEl.value = String(loc.marcaModelo || loc.modelo || "").trim();
    const fmtDate = (raw) => {
      const s = String(raw || "").trim();
      if (!s) return "";
      if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) return s;
      if (/^\d{2}\/\d{2}\/\d{2}$/.test(s)) {
        const [dd, mm, yy] = s.split("/");
        const yFull = Number(yy) < 50 ? 2000 + Number(yy) : 1900 + Number(yy);
        return `${dd}/${mm}/${yFull}`;
      }
      if (typeof parseBrDate === "function") {
        const dt = parseBrDate(s);
        if (dt && !Number.isNaN(dt.getTime())) return formatPortalDataBr(dt);
      }
      return s;
    };
    if (diEl) diEl.value = fmtDate(loc.inicio);
    if (dfEl) dfEl.value = fmtDate(loc.fim);
    if (diaPagEl) diaPagEl.value = String(loc.diaPagto || loc.diaPagamento || "").trim();
    const fmtValor = (raw) => {
      if (typeof parseCurrencyBR === "function") {
        const n = parseCurrencyBR(String(raw || ""));
        return Number(n || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      }
      return String(raw || "")
        .replace(/R\$\s?/gi, "")
        .trim();
    };
    if (valLocEl) valLocEl.value = fmtValor(loc.valorLocacao);
    if (valInvEl) valInvEl.value = fmtValor(loc.valorInvestimento);
    if (tipoPlanoEl) tipoPlanoEl.value = String(loc.plano || loc.opcaoContrato || "").trim();
    syncOperacaoLocacaoFromDataInicio();
    syncOperacaoLocacaoValorPlano();
  }

  function clearPortalLocacaoCamposParaNovoContrato() {
    ["operacaoLocacaoPlaca", "operacaoLocacaoModelo", "operacaoLocacaoDataFim"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.value = "";
    });
    suggestOperacaoLocacaoDataInicioComoHoje();
    syncOperacaoLocacaoFromDataInicio();
    syncOperacaoLocacaoValorPlano();
  }

  function refreshOperacaoLocacaoProtocoloPicker(opts = {}) {
    const force = Boolean(opts.force);
    const sel = document.getElementById("operacaoLocacaoProtocoloSelect");
    const hid = document.getElementById("operacaoLocacaoProtocolo");
    const inpCpf = document.getElementById("operacaoLocacaoCpf");
    if (!sel || !hid || !inpCpf) return;
    const digits =
      typeof onlyDigits === "function" ? onlyDigits(inpCpf.value) : String(inpCpf.value || "").replace(/\D/g, "");
    const known = digits.length === 11 && Boolean(getPortalClienteKnownRecord(digits));
    if (!known) {
      portalLocacaoProtocoloPickerCpf = "";
      sel.disabled = true;
      sel.replaceChildren();
      const o = document.createElement("option");
      o.value = "";
      o.textContent = "Informe um CPF cadastrado";
      sel.appendChild(o);
      hid.value = "";
      return;
    }
    if (!force && digits === portalLocacaoProtocoloPickerCpf) return;
    portalLocacaoProtocoloPickerCpf = digits;
    const preserve = String(hid.value || "").trim();
    sel.disabled = false;
    const norm = (v) =>
      typeof normalizeNumeroContratoKey === "function"
        ? normalizeNumeroContratoKey(v || "")
        : String(v || "").trim();
    const locs = collectPortalLocacoesByCpf(digits);
    const byNc = new Map();
    locs.forEach((l) => {
      const nc = norm(l.numeroContrato || "");
      if (nc) byNc.set(nc, l);
    });
    const sorted = Array.from(byNc.keys()).sort((a, b) => a.localeCompare(b, "en"));
    sel.replaceChildren();
    sorted.forEach((nc) => {
      const l = byNc.get(nc);
      const opt = document.createElement("option");
      opt.value = nc;
      const placa =
        typeof normalizePlate === "function" ? normalizePlate(String(l.placa || "")) : String(l.placa || "").trim();
      const ini = String(l.inicio || "").trim();
      opt.textContent = `${nc} · ${placa || "—"} · ${ini || "—"}`;
      sel.appendChild(opt);
    });
    const optNovo = document.createElement("option");
    optNovo.value = PORTAL_PROTO_NOVO;
    optNovo.textContent = `NOVO — ${proximoProtocoloPortalAaaammddXX()}`;
    sel.appendChild(optNovo);
    const pNorm = preserve ? norm(preserve) : "";
    if (pNorm && sorted.includes(pNorm)) {
      sel.value = pNorm;
      hid.value = pNorm;
    } else if (pNorm) {
      sel.value = PORTAL_PROTO_NOVO;
      hid.value = pNorm;
    } else {
      sel.value = PORTAL_PROTO_NOVO;
      hid.value = proximoProtocoloPortalAaaammddXX();
    }
  }

  function onOperacaoLocacaoProtocoloSelectChange() {
    const sel = document.getElementById("operacaoLocacaoProtocoloSelect");
    const hid = document.getElementById("operacaoLocacaoProtocolo");
    if (!sel || !hid || sel.disabled) return;
    const v = sel.value;
    if (!v) {
      hid.value = "";
      return;
    }
    const norm = (x) =>
      typeof normalizeNumeroContratoKey === "function"
        ? normalizeNumeroContratoKey(x || "")
        : String(x || "").trim();
    if (v === PORTAL_PROTO_NOVO) {
      hid.value = proximoProtocoloPortalAaaammddXX();
      clearPortalLocacaoCamposParaNovoContrato();
      return;
    }
    const digits =
      typeof onlyDigits === "function"
        ? onlyDigits(String(document.getElementById("operacaoLocacaoCpf")?.value || ""))
        : String(document.getElementById("operacaoLocacaoCpf")?.value || "").replace(/\D/g, "");
    hid.value = norm(v);
    const loc = collectPortalLocacoesByCpf(digits).find((l) => norm(l.numeroContrato || "") === hid.value);
    if (loc) applyPortalLocacaoRowFromRecord(loc);
  }

  function bindOperacaoLocacaoAutofill() {
    const inpCpf = document.getElementById("operacaoLocacaoCpf");
    const inpNome = document.getElementById("operacaoLocacaoCliente");
    const inpPlaca = document.getElementById("operacaoLocacaoPlaca");
    const inpModelo = document.getElementById("operacaoLocacaoModelo");
    const panelPlaca = document.getElementById("operacaoLocacaoPlacaLista");
    const comboPlaca = document.getElementById("operacaoLocacaoPlacaCombo");

    document.getElementById("operacaoLocacaoProtocoloSelect")?.addEventListener("change", onOperacaoLocacaoProtocoloSelectChange);

    [inpCpf, inpNome].filter(Boolean).forEach((el) => {
      el.addEventListener("focus", () => refreshOperacaoLocacaoDatalists(), { passive: true });
    });

    inpPlaca?.addEventListener("focus", () => {
      refreshOperacaoLocacaoDatalists();
      renderOperacaoLocacaoPlacaDropdown(String(inpPlaca.value || ""));
    });

    inpPlaca?.addEventListener("input", () => {
      inpPlaca.value = String(inpPlaca.value || "").toUpperCase();
      renderOperacaoLocacaoPlacaDropdown(inpPlaca.value);
    });

    inpPlaca?.addEventListener("keydown", (e) => {
      if (e.key === "Escape") hideOperacaoLocacaoPlacaDropdown();
    });

    panelPlaca?.addEventListener("mousedown", (e) => {
      if (e.target.closest(".portal-placa-dropdown__opt")) e.preventDefault();
    });

    panelPlaca?.addEventListener("click", (e) => {
      const btn = e.target.closest(".portal-placa-dropdown__opt");
      if (!btn || !inpPlaca) return;
      const placa = String(btn.getAttribute("data-placa") || "").trim();
      if (!placa) return;
      inpPlaca.value = placa;
      const hit = portalLocacaoPlacasLivresCache.find((x) => x.placa === placa);
      if (hit && inpModelo) inpModelo.value = hit.modelo;
      hideOperacaoLocacaoPlacaDropdown();
      inpPlaca.focus();
    });

    document.addEventListener(
      "click",
      (e) => {
        if (!comboPlaca || !panelPlaca || panelPlaca.classList.contains("hidden")) return;
        if (comboPlaca.contains(e.target)) return;
        hideOperacaoLocacaoPlacaDropdown();
      },
      true
    );

    inpPlaca?.addEventListener("focusout", (e) => {
      const rt = e.relatedTarget;
      if (rt && comboPlaca && comboPlaca.contains(rt)) return;
      window.setTimeout(() => {
        if (!comboPlaca || !document.activeElement || !comboPlaca.contains(document.activeElement)) {
          hideOperacaoLocacaoPlacaDropdown();
        }
      }, 180);
    });

    inpCpf?.addEventListener("blur", () => {
      if (!inpCpf) return;
      const digits =
        typeof onlyDigits === "function" ? onlyDigits(inpCpf.value) : String(inpCpf.value || "").replace(/\D/g, "");
      if (typeof formatCpf === "function" && digits.length === 11) inpCpf.value = formatCpf(digits);
      if (digits.length === 11 && typeof findClienteByCpfCadastro === "function") {
        const cli = findClienteByCpfCadastro(digits);
        if (cli && inpNome) inpNome.value = String(cli.nome || "").trim();
      }
      refreshOperacaoLocacaoProtocoloPicker({ force: true });
    });

    inpCpf?.addEventListener("input", () => {
      if (!inpCpf) return;
      const digits =
        typeof onlyDigits === "function" ? onlyDigits(inpCpf.value) : String(inpCpf.value || "").replace(/\D/g, "");
      const dlNome = document.getElementById("operacaoLocacaoClienteSugestoes");
      const candidatos =
        typeof getLancamentoClienteCandidates === "function" && digits.length
          ? getLancamentoClienteCandidates()
          .filter((c) => String(c.cpf || "").startsWith(digits))
          .slice(0, 30)
          : [];
      if (dlNome && candidatos.length) {
        const fmt = typeof formatCpf === "function" ? formatCpf : (cpf) => String(cpf || "");
        dlNome.innerHTML = candidatos
          .map(
            (c) =>
              `<option value="${portalEscapeHtml(String(c.nome || "").trim())}" label="${fmt(c.cpf)}"></option>`
          )
          .join("");
      } else if (dlNome && !digits.length) {
        refreshOperacaoLocacaoDatalists();
      }
      if (digits.length === 11 && typeof findClienteByCpfCadastro === "function" && inpNome) {
        const cli = findClienteByCpfCadastro(digits);
        if (cli) inpNome.value = String(cli.nome || "").trim();
      } else if (inpNome && candidatos.length === 1) {
        // Sugestão direta enquanto o CPF ainda está incompleto.
        inpNome.value = String(candidatos[0].nome || "").trim();
      }
      refreshOperacaoLocacaoProtocoloPicker();
    });

    inpNome?.addEventListener("change", () => syncPortalLocacaoCpfFromNomeField());
    inpNome?.addEventListener("blur", () => syncPortalLocacaoCpfFromNomeField());

    inpPlaca?.addEventListener("blur", () => {
      if (
        !inpPlaca ||
        typeof normalizePlate !== "function" ||
        typeof loadCadastro !== "function" ||
        typeof CAD_VEICULOS_KEY === "undefined"
      )
        return;
      const plate = normalizePlate(String(inpPlaca.value || ""));
      if (!plate) return;
      inpPlaca.value = plate;
      const veiculos = loadCadastro(CAD_VEICULOS_KEY);
      const v = veiculos.find((x) => normalizePlate(x.placa) === plate);
      if (v && inpModelo) inpModelo.value = String(v.modelo || "").trim();
    });

    const inpDataInicio = document.getElementById("operacaoLocacaoDataInicio");
    inpDataInicio?.addEventListener("blur", syncOperacaoLocacaoFromDataInicio);
    inpDataInicio?.addEventListener("change", syncOperacaoLocacaoFromDataInicio);
    inpDataInicio?.addEventListener("input", syncOperacaoLocacaoFromDataInicio);
    const inpDataFim = document.getElementById("operacaoLocacaoDataFim");
    inpDataFim?.addEventListener("blur", syncOperacaoLocacaoFromDataInicio);
    inpDataFim?.addEventListener("change", syncOperacaoLocacaoFromDataInicio);
    inpDataFim?.addEventListener("input", syncOperacaoLocacaoFromDataInicio);
  }

  function formatOperacaoLocacaoValorNumDisplay(num) {
    return Number(num || 0).toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  function syncOperacaoLocacaoValorPlano() {
    const inpLoc = document.getElementById("operacaoLocacaoValorAluguel");
    const inpInv = document.getElementById("operacaoLocacaoValorInvestimento");
    const inpPlano = document.getElementById("operacaoLocacaoValorPlano");
    const inpCustoDia = document.getElementById("operacaoLocacaoCustoDia");
    if (!inpPlano) return;
    const parse =
      typeof parseCurrencyBR === "function"
        ? parseCurrencyBR
        : (v) => {
            const cleaned = String(v ?? "")
              .replace(/[R$\s]/g, "")
              .replace(/\./g, "")
              .replace(",", ".");
            const n = Number(cleaned);
            return Number.isFinite(n) ? n : 0;
          };
    const loc = parse(inpLoc?.value ?? "");
    const inv = parse(inpInv?.value ?? "");
    const plano = Number(loc) + Number(inv);
    inpPlano.value = formatOperacaoLocacaoValorNumDisplay(plano);
    if (inpCustoDia) {
      const porDia = plano / 7;
      if (typeof currencyBRL === "function") {
        inpCustoDia.value = currencyBRL(porDia);
      } else {
        inpCustoDia.value = Number(porDia || 0).toLocaleString("pt-BR", {
          style: "currency",
          currency: "BRL",
        });
      }
    }
    syncOperacaoLocacaoTipoPlano();
    syncOperacaoLocacaoValorDevidoPlano();
  }

  function bindOperacaoLocacaoValorPlanoComputed() {
    const inpLoc = document.getElementById("operacaoLocacaoValorAluguel");
    const inpInv = document.getElementById("operacaoLocacaoValorInvestimento");
    const sync = () => syncOperacaoLocacaoValorPlano();
    inpLoc?.addEventListener("input", sync);
    inpLoc?.addEventListener("blur", sync);
    inpInv?.addEventListener("input", sync);
    inpInv?.addEventListener("blur", sync);
    sync();
  }

  bindOperacaoLocacaoAutofill();
  refreshOperacaoLocacaoProtocoloPicker({ force: true });
  bindOperacaoLocacaoValorPlanoComputed();
  bindOperacaoClienteCpfAssist();
  const formOperacaoLocacaoInline = document.getElementById("formOperacaoLocacaoInline");
  formOperacaoLocacaoInline?.addEventListener("submit", () => {
    // Garante campos derivados preenchidos mesmo quando o utilizador submete sem disparar blur/input finais.
    syncOperacaoLocacaoFromDataInicio();
    syncOperacaoLocacaoValorPlano();
  });
  // Também recalcula após hidratação inicial dos campos pela querystring do navegador.
  requestAnimationFrame(() => {
    syncOperacaoLocacaoFromDataInicio();
    syncOperacaoLocacaoValorPlano();
  });

  function clearOperacaoLocacaoInlineForm() {
    const form = document.getElementById("formOperacaoLocacaoInline");
    if (form && typeof form.reset === "function") form.reset();
    form?.querySelectorAll("input").forEach((inp) => {
      inp.value = "";
    });
    hideOperacaoLocacaoPlacaDropdown();
    const placaInp = document.getElementById("operacaoLocacaoPlaca");
    if (placaInp) placaInp.setAttribute("aria-expanded", "false");
    const msg = document.getElementById("operacaoLocacaoInlineMsg");
    if (msg) msg.textContent = "";
    refreshOperacaoLocacaoDatalists();
    resetOperacaoLocacaoRelatorioPanel();
    syncOperacaoLocacaoValorPlano();
    syncOperacaoLocacaoFromDataInicio();
    portalLocacaoProtocoloPickerCpf = "";
    refreshOperacaoLocacaoProtocoloPicker({ force: true });
  }

  document.getElementById("operacaoLocacaoLimparBtn")?.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    clearOperacaoLocacaoInlineForm();
  });

  document.getElementById("btn-operacao-cadastro-cliente")?.addEventListener("click", () => {
    hideOperacaoInlineFormsCore();
    document.getElementById("operacaoInlineCliente")?.classList.remove("hidden");
    setOperacaoFormPlaceholderVisible(false);
    syncOperacaoCadastroButtons("btn-operacao-cadastro-cliente");
  });
  document.getElementById("btn-operacao-cadastro-veiculo")?.addEventListener("click", () => {
    hideOperacaoInlineFormsCore();
    document.getElementById("operacaoInlineVeiculo")?.classList.remove("hidden");
    setOperacaoFormPlaceholderVisible(false);
    syncOperacaoCadastroButtons("btn-operacao-cadastro-veiculo");
  });
  document.getElementById("btn-operacao-cadastro-locacao")?.addEventListener("click", () => {
    hideOperacaoInlineFormsCore();
    document.getElementById("operacaoInlineLocacao")?.classList.remove("hidden");
    setOperacaoFormPlaceholderVisible(false);
    syncOperacaoCadastroButtons("btn-operacao-cadastro-locacao");
    refreshOperacaoLocacaoDatalists();
    suggestOperacaoLocacaoDataInicioComoHoje();
    syncOperacaoLocacaoFromDataInicio();
    syncOperacaoLocacaoValorPlano();
    refreshOperacaoLocacaoProtocoloPicker({ force: true });
  });

  ["operacaoClienteVoltarBtn", "operacaoVeiculoVoltarBtn", "operacaoLocacaoVoltarBtn"].forEach((id) => {
    document.getElementById(id)?.addEventListener("click", () => {
      hideInlineForms();
    });
  });

  function applyPortalLocadoraHash() {
    const h = (window.location.hash || "").toLowerCase();
    if (!h.startsWith("#locadora")) return;
    openUnit("locadora");
    const rest = h.replace(/^#locadora\/?/, "").trim();
    if (rest === "cliente") {
      document.querySelector('.role-picker__btn[data-role="cliente"]')?.dispatchEvent(new Event("click", { bubbles: true }));
    } else if (rest === "colaborador") {
      document.querySelector('.role-picker__btn[data-role="colaborador"]')?.dispatchEvent(new Event("click", { bubbles: true }));
    }
  }

  applyPortalLocadoraHash();
  window.addEventListener("hashchange", applyPortalLocadoraHash);

  /** Se já existir sessão (DK no mesmo navegador), reflectir no portal sem voltar a pedir login. */
  function syncPortalIfSession() {
    const session = typeof getSession === "function" ? getSession() : null;
    if (!session) return;
    openUnit("locadora");
    hideAllPanels();
    panelLogado?.classList.remove("hidden");
    if (session.tipo === "admin") {
      if (logadoTitulo) logadoTitulo.textContent = "Área da equipa";
      if (logadoTexto)
        logadoTexto.textContent = `${session.nome || ""} · ${session.role === "owner" ? "Administrador" : session.role || ""}`;
      const allowOp =
        session.role === "operacao" || session.role === "owner";
      btnOperacao?.classList.toggle("hidden", !allowOp);
    } else {
      if (logadoTitulo) logadoTitulo.textContent = "Área do cliente";
      if (logadoTexto) logadoTexto.textContent = `Olá, ${String(session.nome || "").trim() || "cliente"}.`;
      btnOperacao?.classList.add("hidden");
    }
  }

  /**
   * Enter no teclado avança para o próximo campo editável; no último campo submete o formulário.
   * Ignora readonly (ex.: protocolo, valor do plano), hidden e tabindex=-1.
   */
  function getPortalFormFocusables(form) {
    if (!form) return [];
    return Array.from(form.querySelectorAll("input, select, textarea")).filter((el) => {
      if (el.disabled) return false;
      const ty = (el.getAttribute("type") || "").toLowerCase();
      if (ty === "hidden" || ty === "submit" || ty === "button" || ty === "reset") return false;
      if (el.hasAttribute("readonly")) return false;
      if (el.getAttribute("tabindex") === "-1") return false;
      return true;
    });
  }

  function bindEnterAdvancesToNextField(form) {
    if (!form) return;
    form.addEventListener(
      "keydown",
      (e) => {
        if (e.key !== "Enter" || e.isComposing) return;
        const target = e.target;
        if (!(target instanceof HTMLElement)) return;
        if (!form.contains(target)) return;
        if (target.tagName === "TEXTAREA") return;
        const fields = getPortalFormFocusables(form);
        const i = fields.indexOf(target);
        if (i === -1) return;
        e.preventDefault();
        if (i < fields.length - 1) {
          const next = fields[i + 1];
          next.focus();
          if (
            next instanceof HTMLInputElement &&
            ["text", "search", "tel", "url", "password", "email"].includes(next.type || "text")
          ) {
            try {
              next.select();
            } catch {
              /* ignore */
            }
          }
        } else {
          const sub = form.querySelector('button[type="submit"], input[type="submit"]');
          if (sub instanceof HTMLElement) sub.click();
        }
      },
      true
    );
  }

  ["form-login", "form-nova-senha", "formOperacaoClienteInline", "formOperacaoVeiculoInline", "formOperacaoLocacaoInline"].forEach(
    (id) => bindEnterAdvancesToNextField(document.getElementById(id))
  );

  function hydrateOperacaoLocacaoFromQueryParams() {
    const params = new URLSearchParams(window.location.search || "");
    if (!params.toString()) return;
    const map = {
      protocolo: "operacaoLocacaoProtocolo",
      cpf: "operacaoLocacaoCpf",
      cliente: "operacaoLocacaoCliente",
      placa: "operacaoLocacaoPlaca",
      modelo: "operacaoLocacaoModelo",
      dataInicio: "operacaoLocacaoDataInicio",
      diaPagamento: "operacaoLocacaoDiaPagamento",
      dataFim: "operacaoLocacaoDataFim",
      tempoDias: "operacaoLocacaoTempoDias",
      custoDia: "operacaoLocacaoCustoDia",
      valorAluguel: "operacaoLocacaoValorAluguel",
      valorInvestimento: "operacaoLocacaoValorInvestimento",
      valorPlano: "operacaoLocacaoValorPlano",
      valorDevidoPlano: "operacaoLocacaoValorDevidoPlano",
      totalPago: "operacaoLocacaoTotalPago",
      tipoPlano: "operacaoLocacaoTipoPlano",
      valorDevidoAluguel: "operacaoLocacaoValorDevidoAluguel",
      investimentoAcumulado: "operacaoLocacaoInvestimentoAcumulado",
      totalPagoAno2025: "operacaoLocacaoTotalPagoAno2025",
    };
    Object.entries(map).forEach(([param, id]) => {
      const el = document.getElementById(id);
      if (!el) return;
      const v = params.get(param);
      if (v == null) return;
      el.value = v;
    });
  }

  /** Sincroniza `dk_clientes_cadastro` entre localhost e produção via API na Vercel (Upstash Redis). */
  (function dkPortalCadastroCloudSync() {
    if (!window.DK_PORTAL_LOCADORA_PAGE) return;
    if (typeof saveCadastro !== "function" || typeof loadCadastro !== "function" || typeof CAD_CLIENTES_KEY === "undefined") {
      return;
    }

    let dkPortalCadastroSyncSuppressPush = false;
    let dkPortalCadastroPushTimer = null;

    function dkPortalSyncApiUrls() {
      const meta = document
        .querySelector('meta[name="dk-cadastro-sync-origin"]')
        ?.getAttribute("content")
        ?.trim()
        .replace(/\/$/, "");
      const h = window.location.hostname;
      const isLocal = h === "localhost" || h === "127.0.0.1";
      const localUrl = `${window.location.origin}/api/cadastro-clientes`;
      if (isLocal && meta) return [localUrl, `${meta}/api/cadastro-clientes`];
      return [localUrl];
    }

    function dkPortalMergeClientesArrays(local, remote) {
      const byCpf = new Map();
      const dig = (cpf) =>
        typeof onlyDigits === "function" ? onlyDigits(String(cpf || "")) : String(cpf || "").replace(/\D/g, "");
      const score = (c) => Number(c.createdAt || c.id || 0);
      const add = (c) => {
        const cpf = dig(c.cpf);
        if (cpf.length !== 11) return;
        const prev = byCpf.get(cpf);
        const merged = prev ? { ...prev, ...c, cpf } : { ...c, cpf };
        if (!prev) {
          byCpf.set(cpf, merged);
          return;
        }
        if (score(c) > score(prev)) {
          byCpf.set(cpf, merged);
          return;
        }
        if (score(c) === score(prev) && JSON.stringify(c).length >= JSON.stringify(prev).length) {
          byCpf.set(cpf, merged);
        }
      };
      (local || []).forEach(add);
      (remote || []).forEach(add);
      return Array.from(byCpf.values());
    }

    async function dkPortalPushClientes(list) {
      const urls = dkPortalSyncApiUrls();
      let anyOk = false;
      for (let i = 0; i < urls.length; i += 1) {
        const url = urls[i];
        try {
          const r = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ data: list }),
        });
          if (r.ok) {
            anyOk = true;
          } else if (i === urls.length - 1) {
            console.warn("[DK portal] sync push HTTP", r.status, "url:", url);
          }
        } catch (e) {
          if (i === urls.length - 1) {
            console.warn("[DK portal] sync push", e);
          }
        }
      }
      return anyOk;
    }

    function dkPortalSchedulePush(list) {
      clearTimeout(dkPortalCadastroPushTimer);
      dkPortalCadastroPushTimer = setTimeout(() => {
        if (dkPortalCadastroSyncSuppressPush) return;
        dkPortalPushClientes(list);
      }, 1500);
    }

    const origSave = saveCadastro;
    window.saveCadastro = function dkPortalSaveCadastroWrapped(key, list) {
      origSave(key, list);
      if (key !== CAD_CLIENTES_KEY || !Array.isArray(list)) return;
      if (dkPortalCadastroSyncSuppressPush) return;
      dkPortalSchedulePush(list);
    };

    async function dkPortalPullAndMerge() {
      const urls = dkPortalSyncApiUrls();
      for (let i = 0; i < urls.length; i += 1) {
        const url = urls[i];
        try {
          const r = await fetch(url, { method: "GET" });
          const j = await r.json().catch(() => ({}));
          if (!r.ok || !j.ok || !Array.isArray(j.data)) continue;
          const local = loadCadastro(CAD_CLIENTES_KEY);
          // Primeira sincronização: se servidor está vazio e este navegador já tem dados, publica a base local.
          if (!j.data.length && Array.isArray(local) && local.length) {
            dkPortalSchedulePush(local);
            return;
          }
          const merged = dkPortalMergeClientesArrays(local, j.data);
          if (JSON.stringify(merged) === JSON.stringify(local)) return;
          dkPortalCadastroSyncSuppressPush = true;
          origSave(CAD_CLIENTES_KEY, merged);
          dkPortalCadastroSyncSuppressPush = false;
          dkPortalSchedulePush(merged);
          return;
        } catch (e) {
          if (i === urls.length - 1) {
            console.warn("[DK portal] sync pull", e);
          }
        }
      }
    }

    setTimeout(dkPortalPullAndMerge, 800);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") dkPortalPullAndMerge();
    });
  })();

  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      hydrateOperacaoLocacaoFromQueryParams();
      syncOperacaoLocacaoFromDataInicio();
      syncOperacaoLocacaoValorPlano();
      refreshOperacaoLocacaoProtocoloPicker({ force: true });
      syncPortalIfSession();
    })
  );
})();

