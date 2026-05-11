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
  const portalUnitDadosAtualizados = document.getElementById("portal-unit-dados-atualizados");
  const loginUnit = document.getElementById("login-unit");
  const loginRole = document.getElementById("login-role");
  const panelLogin = document.getElementById("panel-login");
  const panelSenha = document.getElementById("panel-senha");
  const panelLogado = document.getElementById("panel-logado");
  const panelOperacao = document.getElementById("panel-operacao-locadora");
  const panelManutencao = document.getElementById("panel-manutencao-locadora");
  const formLogin = document.getElementById("form-login");
  const loginFeedback = document.getElementById("login-feedback");
  const logadoTitulo = document.getElementById("logado-titulo");
  const logadoTexto = document.getElementById("logado-texto");
  const btnOperacao = document.getElementById("btn-locadora-operacao");
  const btnManutencao = document.getElementById("btn-locadora-manutencao");
  const btnSair = document.getElementById("btn-sair");
  const btnVoltarOp = document.getElementById("btn-voltar-operacao-locadora");
  const btnVoltarManutencao = document.getElementById("btn-voltar-manutencao-locadora");
  const formNovaSenha = document.getElementById("form-nova-senha");
  const formPortalCadastroColaborador = document.getElementById("formPortalCadastroColaborador");

  let currentUnit = "";
  /** Referência ao funcionário em `funcionariosAccess` à espera de troca de senha (1.º acesso colaborador). */
  let portalColaboradorSenhaPendente = null;
  /** Comprimento anterior do CPF (só dígitos) para limpar campos ao sair de 11 dígitos. */
  let portalColabCpfPrevLen = 0;

  /** Role do funcionário em sessão portal (`operacao` | `owner`) ou "" se não for admin. */
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

  /** Administrador titular (`owner`) — pode editar ou apagar lançamentos já registados; colaboradores (`operacao`) só lançam novos. */
  function isPortalTitularAdministrador() {
    return getPortalSessaoAdminRole() === "owner";
  }

  const LOCADORA_LEAD_SEM_SESSAO =
    "Escolha o tipo de acesso e informe CPF e senha. Colaborador: senha inicial 123456 (troque no 1.º acesso, se aplicável).";

  /** Funcionário em `funcionariosAccess` correspondente à sessão equipa (admin no portal). */
  function getPortalSessaoEquipaFuncionario() {
    try {
      const raw = localStorage.getItem("dk_sessao_cliente");
      if (!raw) return null;
      const s = JSON.parse(raw);
      if (s?.tipo !== "admin") return null;
      const dig = onlyDigits(String(s.cpf || "")).slice(0, 11);
      if (dig.length !== 11 || typeof funcionariosAccess === "undefined" || !Array.isArray(funcionariosAccess)) return null;
      return funcionariosAccess.find((f) => onlyDigits(String(f.cpf || "")) === dig) || null;
    } catch {
      return null;
    }
  }

  /** Texto destacado sob o título «DK Locadora»: boas-vindas se já existir sessão. */
  function refreshPortalUnitLeadForSession() {
    if (!unitLead || currentUnit !== "locadora") return;
    try {
      const raw = localStorage.getItem("dk_sessao_cliente");
      if (!raw) {
        unitLead.textContent = LOCADORA_LEAD_SEM_SESSAO;
        clearPortalUnitDadosAtualizados();
        return;
      }
      const s = JSON.parse(raw);
      if (s?.tipo === "admin") {
        const nome = String(s.nome || "").trim();
        unitLead.textContent = nome ? `Seja bem vindo ${nome}` : "Seja bem vindo.";
        return;
      }
      if (s?.tipo === "cliente") {
        const nome = String(s.nome || "").trim();
        unitLead.textContent = nome ? `Olá, ${nome}.` : "Olá.";
        return;
      }
    } catch {
      /* ignore */
    }
    unitLead.textContent = LOCADORA_LEAD_SEM_SESSAO;
    clearPortalUnitDadosAtualizados();
  }

  function setPortalUnitDadosAtualizadosAgora() {
    if (!portalUnitDadosAtualizados || currentUnit !== "locadora") return;
    const d = new Date();
    const p2 = (n) => String(n).padStart(2, "0");
    portalUnitDadosAtualizados.textContent = `Atualizado dia ${p2(d.getDate())}/${p2(d.getMonth() + 1)}/${d.getFullYear()} às ${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}`;
    portalUnitDadosAtualizados.hidden = false;
  }

  function clearPortalUnitDadosAtualizados() {
    if (!portalUnitDadosAtualizados) return;
    portalUnitDadosAtualizados.textContent = "";
    portalUnitDadosAtualizados.hidden = true;
  }

  /** Mapa `acessos` para colaborador operacional (fallback se registo antigo não tiver objeto). */
  function getPortalOperacaoAcessosEfetivos(f) {
    if (!f || String(f.role || "").trim() !== "operacao") return null;
    if (f.acessos && typeof f.acessos === "object") return f.acessos;
    return typeof normalizeOperacaoAccess === "function"
      ? normalizeOperacaoAccess(null, "operacao")
      : { cliente: true, veiculo: true, locacao: true, lancamentoAluguel: true, manutencao: false, lancamentoDespesa: false, funcionario: false };
  }

  /** Esconde botões da operação para os quais o colaborador não tem permissão em `acessos`. */
  function refreshPortalOperacaoNavPorAcessos() {
    if (!isPortalTitularAdministrador()) {
      document.getElementById("operacaoInlineColaborador")?.classList.add("hidden");
    }

    const f = getPortalSessaoEquipaFuncionario();
    const role = f ? String(f.role || "").trim() : "";
    const isOwner = role === "owner";
    const acessosOp = getPortalOperacaoAcessosEfetivos(f);

    const triples = [
      ["btn-operacao-falar-cliente", "operacaoInlineWhatsApp", "cliente"],
      ["btn-operacao-cadastro-cliente", "operacaoInlineCliente", "cliente"],
      ["btn-operacao-cadastro-veiculo", "operacaoInlineVeiculo", "veiculo"],
      ["btn-operacao-cadastro-locacao", "operacaoInlineLocacao", "locacao"],
      ["btn-operacao-lancamento-aluguel", "operacaoInlineLancamentoAluguel", "lancamentoAluguel"],
    ];

    if (!isOwner && role === "operacao" && acessosOp) {
      for (const [, panelId, key] of triples) {
        const panel = document.getElementById(panelId);
        if (panel && !panel.classList.contains("hidden") && !acessosOp[key]) {
          hideOperacaoInlineFormsCore();
          setOperacaoFormPlaceholderVisible(true);
          syncOperacaoCadastroButtons(null);
          break;
        }
      }
    }

    for (const [btnId, , key] of triples) {
      const b = document.getElementById(btnId);
      if (!b) continue;
      const allow = isOwner || (role === "operacao" && acessosOp && Boolean(acessosOp[key]));
      b.classList.toggle("hidden", !allow);
      b.setAttribute("aria-hidden", allow ? "false" : "true");
      b.toggleAttribute("disabled", !allow);
    }

    const btnColab = document.getElementById("btn-operacao-cadastro-colaborador");
    if (btnColab) btnColab.classList.toggle("hidden", !isPortalTitularAdministrador());

    const btnWaTodos = document.getElementById("portalWaBtnTodosAtivos");
    if (btnWaTodos) btnWaTodos.classList.toggle("hidden", !isPortalTitularAdministrador());
  }

  /** Se só existir um cadastro permitido, abre-o automaticamente (painel ainda no placeholder). */
  function portalOperacaoAutoAbrirSeUnicoPermitido() {
    const ids = [
      "btn-operacao-cadastro-cliente",
      "btn-operacao-cadastro-veiculo",
      "btn-operacao-cadastro-locacao",
      "btn-operacao-lancamento-aluguel",
    ];
    const visiveis = ids.filter((id) => {
      const el = document.getElementById(id);
      return el && !el.classList.contains("hidden");
    });
    if (visiveis.length !== 1) return;
    const ph = document.getElementById("operacaoFormPlaceholder");
    if (!ph || ph.classList.contains("hidden")) return;
    document.getElementById(visiveis[0])?.dispatchEvent(new Event("click", { bubbles: true }));
  }

  function finalizarLoginEquipaPortal(funcionario) {
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
    btnManutencao?.classList.toggle("hidden", !allowOp);
    clearPortalUnitDadosAtualizados();
    refreshPortalUnitLeadForSession();
    refreshPortalOperacaoNavPorAcessos();
  }

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
    [panelLogin, panelSenha, panelLogado, panelOperacao, panelManutencao].forEach((p) => {
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
      if (go === "locadora") {
        refreshPortalUnitLeadForSession();
      } else {
      unitLead.textContent =
          "Conteúdo em preparação. Use o painel completo DK se precisar de cadastros aqui.";
      }
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

  function resetPortalLoginFormularioETipoAcesso() {
    const cpfIn = document.getElementById("login-cpf");
    const senhaIn = document.getElementById("login-senha");
    if (cpfIn) cpfIn.value = "";
    if (senhaIn) senhaIn.value = "";
    if (loginFeedback) loginFeedback.textContent = "";
    if (loginRole) loginRole.value = "";
    document.querySelectorAll(".role-picker__btn").forEach((b) => b.setAttribute("aria-selected", "false"));
  }

  document.querySelectorAll("[data-back]").forEach((btn) => {
    btn.addEventListener("click", () => {
      portalColaboradorSenhaPendente = null;
      if (typeof clearSession === "function") clearSession();
      resetPortalLoginFormularioETipoAcesso();
      hideAllPanels();
      btnOperacao?.classList.add("hidden");
      btnManutencao?.classList.add("hidden");
      refreshPortalUnitLeadForSession();
      clearPortalUnitDadosAtualizados();
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
      if (loginFeedback) loginFeedback.textContent = "";
    });
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
      btnManutencao?.classList.add("hidden");
      clearPortalUnitDadosAtualizados();
      refreshPortalUnitLeadForSession();
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
        portalColaboradorSenhaPendente = funcionario;
        hideAllPanels();
        panelSenha?.classList.remove("hidden");
        const n1 = document.getElementById("nova-senha");
        const n2 = document.getElementById("nova-senha-2");
        const sf = document.getElementById("senha-feedback");
        if (n1) n1.value = "";
        if (n2) n2.value = "";
        if (sf) sf.textContent = "";
        return;
      }
      finalizarLoginEquipaPortal(funcionario);
      return;
    }
  });

  formNovaSenha?.addEventListener("submit", (ev) => {
    ev.preventDefault();
    const sf = document.getElementById("senha-feedback");
    const f = portalColaboradorSenhaPendente;
    if (!f || typeof funcionariosAccess === "undefined" || !Array.isArray(funcionariosAccess)) {
      if (sf) sf.textContent = "Sessão inválida. Volte ao login.";
      return;
    }
    const nova = String(document.getElementById("nova-senha")?.value || "").trim();
    const conf = String(document.getElementById("nova-senha-2")?.value || "").trim();
    const okPass =
      typeof isOperacaoPasswordValid === "function"
        ? isOperacaoPasswordValid(nova)
        : /^\d{6}$/.test(nova);
    if (!okPass || nova === "123456") {
      if (sf) sf.textContent = "Use exatamente 6 números, diferentes da senha inicial 123456.";
      return;
    }
    if (nova !== conf) {
      if (sf) sf.textContent = "A confirmação não coincide com a nova senha.";
      return;
    }
    f.senha = nova;
    f.mustChangePassword = false;
    if (typeof saveFuncionariosAccess === "function") saveFuncionariosAccess();
    portalColaboradorSenhaPendente = null;
    finalizarLoginEquipaPortal(f);
  });

  btnOperacao?.addEventListener("click", async () => {
    await portalOperacaoAwaitCloudCadastroPull();
    hideOperacaoInlineFormsCore();
    setOperacaoFormPlaceholderVisible(true);
    syncOperacaoCadastroButtons(null);
    hideAllPanels();
    panelOperacao?.classList.remove("hidden");
    refreshPortalOperacaoNavPorAcessos();
    portalOperacaoAutoAbrirSeUnicoPermitido();
  });

  function hideManutencaoInlineFormsCore() {
    ["manutencaoInlineEmOperacao", "manutencaoInlineEmManutencao", "manutencaoInlineReserva", "manutencaoInlineOperacionais"].forEach((id) => {
      document.getElementById(id)?.classList.add("hidden");
    });
    document.getElementById("portalChecklistFotosGrid")?.classList.add("hidden");
  }

  function setManutencaoFormPlaceholderVisible(visible) {
    const el = document.getElementById("manutencaoFormPlaceholder");
    if (!el) return;
    el.classList.toggle("hidden", !visible);
    el.setAttribute("aria-hidden", visible ? "false" : "true");
  }

  function syncManutencaoSidebarButtons(activeButtonId) {
    ["btn-manutencao-em-operacao", "btn-manutencao-em-manutencao", "btn-manutencao-reserva", "btn-manutencao-operacionais"].forEach((id) => {
      const b = document.getElementById(id);
      if (!b) return;
      const on = Boolean(activeButtonId && id === activeButtonId);
      b.classList.toggle("is-active", on);
      b.setAttribute("aria-expanded", on ? "true" : "false");
    });
  }

  btnManutencao?.addEventListener("click", async () => {
    await portalOperacaoAwaitCloudCadastroPull();
    hideManutencaoInlineFormsCore();
    setManutencaoFormPlaceholderVisible(true);
    syncManutencaoSidebarButtons(null);
    hideAllPanels();
    panelManutencao?.classList.remove("hidden");
  });

  btnVoltarManutencao?.addEventListener("click", () => {
    panelManutencao?.classList.add("hidden");
    panelLogado?.classList.remove("hidden");
  });

  /** Itens 1–29 — inspeção (A/R). */
  const PORTAL_CHECKLIST_ITENS = [
    "Kit de transmissão",
    "Disco de freio traseiro",
    "Pastilhas de freio traseiro",
    "Lonas / sapatas traseiras",
    "Disco de freio dianteiro",
    "Pastilhas de freio dianteiro",
    "Pneu dianteiro",
    "Pneu traseiro",
    "Câmara de ar dianteira",
    "Câmara de ar traseira",
    "Coluna de direção",
    "Sistema elétrico",
    "Placa",
    "Suporte da placa",
    "Luz de freio",
    "Acelerador",
    "Cabo do acelerador",
    "Cabo da embreagem",
    "Cabo do velocímetro",
    "Capa do banco / banco",
    "Banco",
    "Vela",
    "Ignição",
    "Painel",
    "Rolamentos roda dianteira",
    "Rolamentos roda traseira",
    "Buzina",
    "Kit de embreagem",
    "Junta do motor",
  ];

  let portalChecklistUiBuilt = false;

  /** Placas com locação ativa — mesma regra que `getActivePlatesSet()` em app.js. */
  let portalChecklistPlacasAtivasCache = [];

  function refreshPortalChecklistPlacasAtivasCache() {
    portalChecklistPlacasAtivasCache = [];
    if (typeof getActivePlatesSet !== "function") return;
    const activeSet = getActivePlatesSet();
    const vmap = typeof getVehicleMapByPlate === "function" ? getVehicleMapByPlate() : null;
    activeSet.forEach((plateKey) => {
      const v = vmap?.get(plateKey);
      const modelo =
        String(v?.marcaModelo || v?.modelo || "").trim() || "Modelo não informado";
      portalChecklistPlacasAtivasCache.push({ placa: plateKey, modelo });
    });
    portalChecklistPlacasAtivasCache.sort((a, b) => a.placa.localeCompare(b.placa, "pt-BR"));
    const dl = document.getElementById("portalChecklistPlacaSugestoes");
    if (dl) {
      dl.innerHTML = portalChecklistPlacasAtivasCache
        .map(
          (x) =>
            `<option value="${portalEscapeHtml(x.placa)}" label="${portalEscapeHtml(x.modelo)}"></option>`
        )
        .join("");
    }
  }

  function hidePortalChecklistPlacaDropdown() {
    const panel = document.getElementById("portalChecklistPlacaLista");
    const inp = document.getElementById("portalChecklistPlacaInput");
    if (panel) {
      panel.classList.add("hidden");
      panel.hidden = true;
      panel.innerHTML = "";
    }
    if (inp) inp.setAttribute("aria-expanded", "false");
  }

  function filterPlacasAtivasChecklistDropdown(queryRaw) {
    if (!portalChecklistPlacasAtivasCache.length) return [];
    const trim = String(queryRaw || "").trim();
    if (!trim) return portalChecklistPlacasAtivasCache.slice();
    const qPlate =
      typeof normalizePlate === "function"
        ? normalizePlate(trim)
        : trim.toUpperCase().replace(/[^A-Z0-9]/g, "");
    const qNome =
      typeof normalizeName === "function" ? normalizeName(trim) : trim.toLowerCase();
    return portalChecklistPlacasAtivasCache.filter((v) => {
      if (qPlate && v.placa.includes(qPlate)) return true;
      const modeloKey =
        typeof normalizeName === "function"
          ? normalizeName(v.modelo)
          : String(v.modelo || "").toLowerCase();
      return modeloKey.includes(qNome);
    });
  }

  function renderPortalChecklistPlacaDropdown(queryRaw) {
    const panel = document.getElementById("portalChecklistPlacaLista");
    const inp = document.getElementById("portalChecklistPlacaInput");
    if (!panel || !inp) return;
    const items = filterPlacasAtivasChecklistDropdown(queryRaw);
    if (!items.length) {
      panel.innerHTML = `<div class="portal-placa-dropdown__empty">Nenhuma placa em operação (sem locação ativa no cadastro ou na Receita 2026).</div>`;
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

  function bindPortalChecklistPlacaComboboxOnce() {
    if (window.__dkPortalChecklistPlacaBound) return;
    window.__dkPortalChecklistPlacaBound = true;
    const inp = document.getElementById("portalChecklistPlacaInput");
    const panel = document.getElementById("portalChecklistPlacaLista");
    const combo = document.getElementById("portalChecklistPlacaCombo");
    if (!inp || !panel || !combo) return;

    inp.addEventListener("focus", () => {
      refreshPortalChecklistPlacasAtivasCache();
      renderPortalChecklistPlacaDropdown(String(inp.value || ""));
    });

    inp.addEventListener("input", () => {
      inp.value = String(inp.value || "").toUpperCase();
      if (!portalChecklistPlacasAtivasCache.length) refreshPortalChecklistPlacasAtivasCache();
      renderPortalChecklistPlacaDropdown(inp.value);
    });

    inp.addEventListener("keydown", (e) => {
      if (e.key === "Escape") hidePortalChecklistPlacaDropdown();
    });

    panel.addEventListener("mousedown", (e) => {
      if (e.target.closest(".portal-placa-dropdown__opt")) e.preventDefault();
    });

    panel.addEventListener("click", (e) => {
      const btn = e.target.closest(".portal-placa-dropdown__opt");
      if (!btn || !inp) return;
      const placa = String(btn.getAttribute("data-placa") || "").trim();
      if (!placa) return;
      inp.value = placa;
      hidePortalChecklistPlacaDropdown();
      inp.focus();
    });

    document.addEventListener(
      "click",
      (e) => {
        if (!combo || panel.classList.contains("hidden")) return;
        if (combo.contains(e.target)) return;
        hidePortalChecklistPlacaDropdown();
      },
      true
    );

    inp.addEventListener("focusout", (e) => {
      const rt = e.relatedTarget;
      if (rt && combo.contains(rt)) return;
      window.setTimeout(() => {
        if (!document.activeElement || !combo.contains(document.activeElement)) {
          hidePortalChecklistPlacaDropdown();
        }
      }, 180);
    });
  }

  bindPortalChecklistPlacaComboboxOnce();

  /** Fotos do check-list guardadas neste navegador (IndexedDB). */
  const PORTAL_CHECKLIST_FOTOS_DB = "dk_portal_checklist_fotos";
  const PORTAL_CHECKLIST_FOTOS_STORE = "fotos";

  function portalChecklistFotosOpenDb() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(PORTAL_CHECKLIST_FOTOS_DB, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(PORTAL_CHECKLIST_FOTOS_STORE)) {
          db.createObjectStore(PORTAL_CHECKLIST_FOTOS_STORE, { keyPath: "id", autoIncrement: true });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  /** Nome base: `d`+placa minúscula + `-` + odômetro em 5 dígitos (ex.: `djqd4h51-01234`). */
  function portalChecklistFotoNomeBase(slot, placaRaw, odometroRaw) {
    const letters = { direita: "d", frente: "f", esquerda: "e", traseira: "t" };
    const L = letters[slot] || "x";
    let plate = "";
    if (typeof normalizePlate === "function") {
      plate = normalizePlate(String(placaRaw || "").trim()).toLowerCase();
    } else {
      plate = String(placaRaw || "")
        .replace(/\s+/g, "")
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "")
        .toLowerCase();
    }
    if (!plate) plate = "semplaca";
    const odDigits = String(odometroRaw ?? "").replace(/\D/g, "");
    let odPadded = "00000";
    if (odDigits.length) {
      const n = parseInt(odDigits, 10);
      odPadded = Number.isFinite(n) ? String(Math.max(0, n)).padStart(5, "0") : "00000";
    }
    return `${L}${plate}-${odPadded}`;
  }

  function portalChecklistFotoExtensao(mime) {
    const m = String(mime || "").toLowerCase();
    if (m.includes("png")) return "png";
    if (m.includes("webp")) return "webp";
    return "jpg";
  }

  async function portalChecklistArquivarFoto(blob, mime, slot, placaRaw, odometroRaw) {
    const nk =
      typeof normalizePlate === "function"
        ? normalizePlate
        : (p) =>
            String(p || "")
              .replace(/\s+/g, "")
              .toUpperCase()
              .replace(/[^A-Z0-9]/g, "");
    const placaNormalized = nk(String(placaRaw || "").trim());
    const baseNome = portalChecklistFotoNomeBase(slot, placaRaw, odometroRaw);
    const ext = portalChecklistFotoExtensao(mime || blob.type);
    const fileName = `${baseNome}.${ext}`;
    const db = await portalChecklistFotosOpenDb();
    const record = {
      placaNormalized,
      slot,
      mimeType: mime || blob.type || "image/jpeg",
      blob,
      createdAt: Date.now(),
      fileBaseName: baseNome,
      fileName,
      odometroArquivo: String(odometroRaw ?? "").replace(/\D/g, "") || null,
    };
    try {
      await new Promise((resolve, reject) => {
        const tx = db.transaction(PORTAL_CHECKLIST_FOTOS_STORE, "readwrite");
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.objectStore(PORTAL_CHECKLIST_FOTOS_STORE).add(record);
      });
    } finally {
      try {
        db.close();
      } catch {
        /* ignore */
      }
    }
    if (typeof addAuditLog === "function") {
      addAuditLog("checklist_foto_arquivo", "manutencao", `${fileName}`);
    }
  }

  let portalChecklistFotoSlotAlvo = "";

  function bindPortalChecklistFotoArquivoOnce() {
    if (window.__dkPortalChecklistFotoBound) return;
    window.__dkPortalChecklistFotoBound = true;
    const fileInp = document.getElementById("portalChecklistFotoFile");
    const msgEl = document.getElementById("portalChecklistFotoMsg");
    if (!fileInp) return;

    const botoes = [
      ["portalChecklistFotoBtnDireita", "direita"],
      ["portalChecklistFotoBtnFrente", "frente"],
      ["portalChecklistFotoBtnEsquerda", "esquerda"],
      ["portalChecklistFotoBtnTraseira", "traseira"],
    ];
    botoes.forEach(([id, slot]) => {
      document.getElementById(id)?.addEventListener("click", () => {
        const grid = document.getElementById("portalChecklistFotosGrid");
        const mount = document.getElementById("portalChecklistMount");
        if (
          !grid ||
          grid.classList.contains("hidden") ||
          !mount ||
          mount.classList.contains("hidden")
        ) {
          if (msgEl) {
            msgEl.textContent =
              "Carregue os dados da placa (botão «Carregar dados») antes de tirar fotos.";
          }
          return;
        }
        portalChecklistFotoSlotAlvo = slot;
        fileInp.click();
      });
    });

    fileInp.addEventListener("change", () => {
      const run = async () => {
        const f = fileInp.files?.[0];
        const slot = portalChecklistFotoSlotAlvo;
        portalChecklistFotoSlotAlvo = "";
        fileInp.value = "";
        if (!f || !slot) return;
        const placa = String(document.getElementById("portalChecklistPlacaInput")?.value || "").trim();
        const odoRaw = String(document.getElementById("portalChecklistOdometro")?.value || "").trim();
        try {
          await portalChecklistArquivarFoto(f, f.type, slot, placa, odoRaw);
          const base = portalChecklistFotoNomeBase(slot, placa, odoRaw);
          const ext = portalChecklistFotoExtensao(f.type);
          const nomeArq = `${base}.${ext}`;
          if (msgEl) {
            msgEl.textContent = `Foto guardada como ${nomeArq} (placa + odômetro do check-list).`;
          }
        } catch (err) {
          console.warn("[DK portal] arquivo foto check-list", err);
          if (msgEl) msgEl.textContent = "Não foi possível guardar a foto neste dispositivo.";
        }
      };
      void run();
    });
  }

  bindPortalChecklistFotoArquivoOnce();

  function portalPopulateColaboradoresChecklistSelects() {
    const selM = document.getElementById("portalChecklistMecanico");
    const selS = document.getElementById("portalChecklistSupervisor");
    if (!selM || !selS || typeof funcionariosAccess === "undefined" || !Array.isArray(funcionariosAccess)) return;
    const list = funcionariosAccess
      .filter((f) => !f.blocked)
      .slice()
      .sort((a, b) => String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR"));
    const opts =
      '<option value="">— Selecione —</option>' +
      list
        .map((f) => {
          const cpf = String(f.cpf || "");
          const nome = portalEscapeHtml(String(f.nome || "").trim());
          return `<option value="${portalEscapeHtml(cpf)}">${nome}</option>`;
        })
        .join("");
    selM.innerHTML = opts;
    selS.innerHTML = opts;
  }

  function portalResolveChecklistLocacaoPorPlaca(plateRaw) {
    const nk =
      typeof normalizePlate === "function"
        ? normalizePlate
        : (p) =>
            String(p || "")
              .replace(/\s+/g, "")
              .toUpperCase()
              .replace(/[^A-Z0-9]/g, "");
    const plateKey = nk(String(plateRaw || ""));
    if (!plateKey) return null;
    if (typeof loadCadastro !== "function" || typeof CAD_LOCACOES_KEY === "undefined") return null;
    const locacoes = loadCadastro(CAD_LOCACOES_KEY);
    if (typeof pickBestRecordByPlate === "function") return pickBestRecordByPlate(locacoes, plateKey);
    return null;
  }

  function portalFillChecklistFromCadastro(plateDisplay) {
    const loc = portalResolveChecklistLocacaoPorPlaca(plateDisplay);
    const nk =
      typeof normalizePlate === "function"
        ? normalizePlate
        : (p) =>
            String(p || "")
              .replace(/\s+/g, "")
              .toUpperCase()
              .replace(/[^A-Z0-9]/g, "");
    const plateKey = nk(String(plateDisplay || ""));
    let veiculo = null;
    if (typeof getVehicleMapByPlate === "function") {
      veiculo = getVehicleMapByPlate().get(plateKey) || null;
    } else if (typeof loadCadastro === "function" && typeof CAD_VEICULOS_KEY !== "undefined") {
      veiculo =
        loadCadastro(CAD_VEICULOS_KEY).find((v) => nk(String(v.placa || "")) === plateKey) || null;
    }

    const assign = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.value = val != null ? String(val) : "";
    };

    assign("portalChecklistFieldPlaca", plateDisplay || "");

    if (!loc) {
      assign("portalChecklistFieldPlano", "");
      assign("portalChecklistFieldInicioContrato", "");
      assign("portalChecklistFieldProtocolo", "");
      assign("portalChecklistFieldCliente", "");
      assign("portalChecklistFieldAnoModelo", veiculo?.anoModelo || "");
      assign("portalChecklistFieldCor", veiculo?.cor || "");
      assign("portalChecklistFieldMarcaModelo", String(veiculo?.marcaModelo || veiculo?.modelo || "").trim());
      assign("portalChecklistFieldCelular", "");
      return {
        ok: false,
        message:
          "Nenhuma locação encontrada para esta placa. Dados do veículo foram aplicados quando existentes; complete o restante manualmente.",
      };
    }

    const cpf = onlyDigits(String(loc.cpf || ""));
    const cliente =
      cpf.length === 11 && typeof findClienteByCpfCadastro === "function"
        ? findClienteByCpfCadastro(cpf)
        : null;
    let codigo =
      typeof getPortalCanonicalClienteCodeByCpf === "function"
        ? getPortalCanonicalClienteCodeByCpf(cpf)
        : String(cliente?.codigo || "").trim();
    if (!codigo) codigo = String(cliente?.codigo || "").trim();
    const nomeCliente = String(cliente?.nome || loc.nome || "").trim();
    const clienteLinha = [codigo, nomeCliente].filter(Boolean).join(" — ");

    const plano = String(loc.plano || loc.opcaoContrato || "").trim();
    const inicio =
      typeof formatPortalCadastroDateLabel === "function"
        ? formatPortalCadastroDateLabel(loc.inicio)
        : String(loc.inicio || "").trim();
    const proto = String(loc.numeroContrato || "").trim();

    assign("portalChecklistFieldPlano", plano);
    assign("portalChecklistFieldInicioContrato", inicio);
    assign("portalChecklistFieldProtocolo", proto);
    assign("portalChecklistFieldCliente", clienteLinha);
    assign("portalChecklistFieldAnoModelo", veiculo?.anoModelo || "");
    assign("portalChecklistFieldCor", veiculo?.cor || "");
    assign(
      "portalChecklistFieldMarcaModelo",
      String(veiculo?.marcaModelo || veiculo?.modelo || loc.marcaModelo || loc.modelo || "").trim()
    );
    assign("portalChecklistFieldCelular", String(cliente?.celular || "").trim());

    return { ok: true, message: "Dados carregados a partir do cadastro." };
  }

  function portalClearChecklistInspection() {
    for (let n = 1; n <= PORTAL_CHECKLIST_ITENS.length; n++) {
      document.querySelectorAll(`input[name="portalChecklistItem${n}"]`).forEach((r) => {
        r.checked = false;
      });
      const o = document.getElementById(`portalChecklistObs${n}`);
      if (o) o.value = "";
    }
    document.querySelectorAll('input[name="portalChecklistOleo"]').forEach((r) => {
      r.checked = false;
    });
    document.querySelectorAll('input[name="portalChecklistPagou"]').forEach((r) => {
      r.checked = false;
    });
    ["portalChecklistEntradaData", "portalChecklistEntradaHora", "portalChecklistSaidaData", "portalChecklistSaidaHora"].forEach(
      (id) => {
        const el = document.getElementById(id);
        if (el) el.value = "";
      }
    );
    const od = document.getElementById("portalChecklistOdometro");
    if (od) od.value = "";
    const px = document.getElementById("portalChecklistProximaTroca");
    if (px) px.value = "";
    const m = document.getElementById("portalChecklistMecanico");
    const s = document.getElementById("portalChecklistSupervisor");
    if (m) m.value = "";
    if (s) s.value = "";
  }

  function portalUpdateProximaTrocaKm() {
    const od = document.getElementById("portalChecklistOdometro");
    const px = document.getElementById("portalChecklistProximaTroca");
    if (!od || !px) return;
    const n = parseInt(String(od.value || "").replace(/\D/g, ""), 10);
    if (!Number.isFinite(n) || n < 0) {
      px.value = "";
      return;
    }
    px.value = String(n + 1000);
  }

  function portalChecklistOleoSim() {
    const el = document.querySelector('input[name="portalChecklistOleo"]:checked');
    return el && el.value === "sim";
  }

  function portalBrDatePlusDays(days) {
    const d = new Date();
    d.setDate(d.getDate() + Number(days || 0));
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  }

  function portalGetPlacaChecklistAtual() {
    const a = String(document.getElementById("portalChecklistFieldPlaca")?.value || "").trim();
    const b = String(document.getElementById("portalChecklistPlacaInput")?.value || "").trim();
    return a || b;
  }

  function portalNkPlate(p) {
    if (typeof normalizePlate === "function") return normalizePlate(String(p || ""));
    return String(p || "")
      .replace(/\s+/g, "")
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "");
  }

  function portalEnviarChecklistParaManutencao() {
    const placaRaw = portalGetPlacaChecklistAtual();
    if (!placaRaw) return { ok: false, message: "Placa em falta." };
    if (typeof loadCadastro !== "function" || typeof saveCadastro !== "function" || typeof CAD_MANUTENCOES_KEY === "undefined") {
      return { ok: false, message: "Cadastro indisponível neste ambiente." };
    }
    const placaKey = portalNkPlate(placaRaw);
    const manutencoes = loadCadastro(CAD_MANUTENCOES_KEY);
    const jaEmManutencao = manutencoes.some(
      (m) => portalNkPlate(m.placa) === placaKey && !String(m.dataRealSaida || "").trim()
    );
    if (jaEmManutencao) {
      return { ok: false, message: "Esta placa já está em manutenção ativa." };
    }
    const data = typeof todayBrDate === "function" ? todayBrDate() : portalBrDatePlusDays(0);
    const dataPrevistaSaida = portalBrDatePlusDays(7);
    const servicosSelecionados = ["PORTAL_CHECKLIST"];
    const servico = "Portal check-list — enviado para manutenção";
    manutencoes.push({
      id: Date.now(),
      placa: String(placaRaw).trim().toUpperCase(),
      servicos: servicosSelecionados,
      servico,
      data,
      dataPrevistaSaida,
      dataRealSaida: "",
      valor: "",
      origemPortalChecklist: true,
    });
    saveCadastro(CAD_MANUTENCOES_KEY, manutencoes);
    if (typeof addAuditLog === "function") {
      addAuditLog("portal_checklist_envio_manutencao", "manutencao", placaKey);
    }
    if (typeof portalPushCloudSnapshotAfterPersist === "function") {
      try {
        portalPushCloudSnapshotAfterPersist();
      } catch {
        /* ignore */
      }
    }
    return { ok: true };
  }

  function portalRegistarDevolvidoAoCliente() {
    const placaRaw = portalGetPlacaChecklistAtual();
    const placaKey = portalNkPlate(placaRaw);
    if (typeof addAuditLog === "function") {
      addAuditLog("portal_checklist_devolvido_cliente", "manutencao", placaKey || "sem_placa");
    }
    return { ok: true };
  }

  function portalRefreshManutencaoVeiculosLista() {
    const container = document.getElementById("portalManutencaoListaCards");
    const dl = document.getElementById("portalManutencaoPlacaSugestoes");
    const msg = document.getElementById("portalManutencaoListaMsg");
    if (!container || typeof loadCadastro !== "function" || typeof CAD_MANUTENCOES_KEY === "undefined") return;
    let rows = loadCadastro(CAD_MANUTENCOES_KEY).filter((m) => !String(m.dataRealSaida || "").trim());
    rows = rows.slice().sort((a, b) => Number(b.id || 0) - Number(a.id || 0));
    const filtroRaw = String(document.getElementById("portalManutencaoPlacaFiltro")?.value || "").trim();
    const filtro = portalNkPlate(filtroRaw);
    if (filtro) {
      rows = rows.filter((m) => portalNkPlate(m.placa).includes(filtro));
    }
    const placasOpts = [...new Set(loadCadastro(CAD_MANUTENCOES_KEY).filter((m) => !String(m.dataRealSaida || "").trim()).map((m) => portalNkPlate(m.placa)))].filter(Boolean).sort();
    if (dl) {
      dl.innerHTML = placasOpts.map((p) => `<option value="${p}"></option>`).join("");
    }
    if (!rows.length) {
      container.innerHTML = `<p class="portal-manutencao-empty">Nenhum veículo em manutenção ativa${filtro ? " para esta busca" : ""}.</p>`;
      if (msg) msg.textContent = "";
      return;
    }
    container.innerHTML = rows
      .map((m) => {
        const pl = portalNkPlate(m.placa);
        const srv = portalEscapeHtml(String(m.servico || "").trim() || "—");
        const dt = portalEscapeHtml(String(m.data || "").trim() || "—");
        const prev = portalEscapeHtml(String(m.dataPrevistaSaida || "").trim() || "—");
        return `<article class="portal-manutencao-card" role="listitem">
          <strong class="portal-manutencao-card__plate">${portalEscapeHtml(pl)}</strong>
          <span class="portal-manutencao-card__meta">Serviço: ${srv}</span>
          <span class="portal-manutencao-card__meta">Entrada: ${dt}</span>
          <span class="portal-manutencao-card__meta">Prev. saída: ${prev}</span>
        </article>`;
      })
      .join("");
    if (msg) msg.textContent = `${rows.length} veículo(s) listado(s).`;
  }

  function portalBindManutencaoListaOnce() {
    if (window.__dkPortalManutencaoListaBound) return;
    window.__dkPortalManutencaoListaBound = true;
    const inp = document.getElementById("portalManutencaoPlacaFiltro");
    inp?.addEventListener("input", () => {
      inp.value = String(inp.value || "").toUpperCase();
      portalRefreshManutencaoVeiculosLista();
    });
  }

  portalBindManutencaoListaOnce();

  function portalValidateChecklistCompleto() {
    const hint = document.getElementById("portalChecklistExportHint");
    const req = [];

    const ed = document.getElementById("portalChecklistEntradaData")?.value;
    const eh = document.getElementById("portalChecklistEntradaHora")?.value;
    const sd = document.getElementById("portalChecklistSaidaData")?.value;
    const sh = document.getElementById("portalChecklistSaidaHora")?.value;
    if (!ed || !eh) req.push("entrada (data e hora)");
    if (!sd || !sh) req.push("saída (data e hora)");

    if (!document.querySelector('input[name="portalChecklistOleo"]:checked')) req.push("troca de óleo (Sim/Não)");
    if (!document.querySelector('input[name="portalChecklistPagou"]:checked')) req.push("Pagou (S/N/N/A)");

    if (portalChecklistOleoSim()) {
      const odVal = document.getElementById("portalChecklistOdometro")?.value;
      const n = parseInt(String(odVal || "").replace(/\D/g, ""), 10);
      if (!Number.isFinite(n) || n < 0) req.push("odômetro (obrigatório se troca de óleo = Sim)");
    }

    for (let n = 1; n <= PORTAL_CHECKLIST_ITENS.length; n++) {
      if (!document.querySelector(`input[name="portalChecklistItem${n}"]:checked`)) {
        req.push(`itens 1–29 (falta item ${n}: A ou R)`);
        break;
      }
    }

    if (!document.getElementById("portalChecklistMecanico")?.value) req.push("mecânico");
    if (!document.getElementById("portalChecklistSupervisor")?.value) req.push("supervisor");

    const ok = req.length === 0;
    if (hint) {
      hint.textContent = ok
        ? "Todos os campos obrigatórios estão preenchidos. Pode imprimir, guardar PDF e escolher o destino do veículo em baixo."
        : `Complete para ativar os botões: ${req.join("; ")}.`;
    }

    const b1 = document.getElementById("portalChecklistBtnImprimir");
    const b2 = document.getElementById("portalChecklistBtnPdf");
    const b3 = document.getElementById("portalChecklistBtnDevolvido");
    const b4 = document.getElementById("portalChecklistBtnManutencao");
    if (b1) b1.disabled = !ok;
    if (b2) b2.disabled = !ok;
    if (b3) b3.disabled = !ok;
    if (b4) b4.disabled = !ok;
    return ok;
  }

  function portalExportChecklistPdf() {
    const root = document.getElementById("portalChecklistPrintArea");
    if (!root) return;
    const printable = root.cloneNode(true);
    printable.querySelectorAll(".portal-checklist-export-footer").forEach((node) => node.remove());
    printable.querySelectorAll(".portal-checklist-disposition-msg").forEach((node) => node.remove());
    const title = "Check-list manutenção";
    const popup = window.open("", "_blank", "width=1100,height=800");
    if (!popup) return;
    popup.document.write(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>${title}</title>
<style>
  body { font-family: Arial, Helvetica, sans-serif; padding: 16px; color: #111; font-size: 12px; }
  table { width: 100%; border-collapse: collapse; margin: 8px 0; }
  th, td { border: 1px solid #bbb; padding: 5px 6px; vertical-align: middle; }
  th { background: #f3f3f3; }
  h2, h4 { margin: 0 0 10px; }
  .portal-checklist-meta-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 8px; margin-bottom: 12px; }
  .portal-checklist-meta-grid label { display: flex; flex-direction: column; gap: 4px; font-size: 11px; }
  .portal-checklist-meta-grid input { padding: 4px; font-size: 12px; }
  .portal-checklist-dates { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 12px; }
  .portal-checklist-dates label { display: flex; flex-direction: column; gap: 4px; font-size: 11px; }
  .portal-checklist-inline-row { display: flex; flex-wrap: wrap; gap: 12px 20px; align-items: flex-end; margin-bottom: 12px; }
  .portal-checklist-toggle-options label { margin-right: 8px; }
  input, select { border: 1px solid #999; }
</style>
</head>
<body>
<h2>${title}</h2>
${printable.innerHTML}
</body>
</html>`);
    popup.document.close();
    popup.focus();
    popup.print();
  }

  function portalBindInnerChecklistEvents() {
    const od = document.getElementById("portalChecklistOdometro");
    od?.addEventListener("input", () => {
      portalUpdateProximaTrocaKm();
      portalValidateChecklistCompleto();
    });

    const root = document.getElementById("portalChecklistPrintArea");
    root?.addEventListener("change", () => portalValidateChecklistCompleto());
    root?.addEventListener("input", () => portalValidateChecklistCompleto());

    document.getElementById("portalChecklistBtnImprimir")?.addEventListener("click", () => {
      if (!portalValidateChecklistCompleto()) return;
      portalExportChecklistPdf();
    });
    document.getElementById("portalChecklistBtnPdf")?.addEventListener("click", () => {
      if (!portalValidateChecklistCompleto()) return;
      portalExportChecklistPdf();
    });

    document.getElementById("portalChecklistBtnDevolvido")?.addEventListener("click", () => {
      if (!portalValidateChecklistCompleto()) return;
      const msg = document.getElementById("portalChecklistDispositionMsg");
      portalRegistarDevolvidoAoCliente();
      if (msg) {
        msg.textContent =
          "Registado: veículo permanece em «Veículos em operação» (contrato ativo inalterado neste passo).";
      }
    });

    document.getElementById("portalChecklistBtnManutencao")?.addEventListener("click", () => {
      if (!portalValidateChecklistCompleto()) return;
      const msg = document.getElementById("portalChecklistDispositionMsg");
      const r = portalEnviarChecklistParaManutencao();
      if (!r.ok) {
        if (msg) msg.textContent = r.message || "Não foi possível registar.";
        return;
      }
      if (msg) {
        msg.textContent =
          "Veículo registado em manutenção. Consulte a lista em «Veículos em manutenção» à esquerda.";
      }
      portalRefreshManutencaoVeiculosLista();
    });
  }

  function portalEnsureChecklistUiBuilt() {
    if (portalChecklistUiBuilt) {
      portalPopulateColaboradoresChecklistSelects();
      return;
    }
    const mount = document.getElementById("portalChecklistMount");
    if (!mount) return;

    const rowsHtml = PORTAL_CHECKLIST_ITENS.map((label, idx) => {
      const n = idx + 1;
      return `<tr class="portal-checklist-inspection-row">
        <td class="portal-checklist-num">${n}</td>
        <td class="portal-checklist-desc">${portalEscapeHtml(label)}</td>
        <td class="portal-checklist-ar"><label><input type="radio" name="portalChecklistItem${n}" value="A" autocomplete="off"></label></td>
        <td class="portal-checklist-ar"><label><input type="radio" name="portalChecklistItem${n}" value="R" autocomplete="off"></label></td>
        <td class="portal-checklist-obs"><input type="text" class="portal-checklist-obs-input" id="portalChecklistObs${n}" maxlength="160" autocomplete="off"></td>
      </tr>`;
    }).join("");

    mount.innerHTML = `
      <div id="portalChecklistPrintArea" class="portal-checklist-print-root">
        <h4>CHECK LIST — MANUTENÇÃO / REPARAÇÕES</h4>
        <div class="portal-checklist-meta-grid">
          <label>Plano <input type="text" id="portalChecklistFieldPlano" autocomplete="off"></label>
          <label>Início do contrato (oficial) <input type="text" id="portalChecklistFieldInicioContrato" autocomplete="off"></label>
          <label>Protocolo <input type="text" id="portalChecklistFieldProtocolo" autocomplete="off"></label>
          <label>Código do cliente + nome <input type="text" id="portalChecklistFieldCliente" autocomplete="off"></label>
          <label>Ano / modelo <input type="text" id="portalChecklistFieldAnoModelo" autocomplete="off"></label>
          <label>Cor <input type="text" id="portalChecklistFieldCor" autocomplete="off"></label>
          <label>Marca / modelo <input type="text" id="portalChecklistFieldMarcaModelo" autocomplete="off"></label>
          <label>Celular do cliente <input type="text" id="portalChecklistFieldCelular" autocomplete="off"></label>
          <label>Placa <input type="text" id="portalChecklistFieldPlaca" readonly tabindex="-1"></label>
        </div>
        <div class="portal-checklist-dates">
          <label>Entrada (data) <input type="date" id="portalChecklistEntradaData"></label>
          <label>Entrada (hora) <input type="time" id="portalChecklistEntradaHora"></label>
          <label>Saída (data) <input type="date" id="portalChecklistSaidaData"></label>
          <label>Saída (hora) <input type="time" id="portalChecklistSaidaHora"></label>
        </div>
        <div class="portal-checklist-inline-row">
          <div class="portal-checklist-toggle-group">
            <span>Troca de óleo</span>
            <div class="portal-checklist-toggle-options" role="group" aria-label="Troca de óleo">
              <label><input type="radio" name="portalChecklistOleo" value="sim"> Sim</label>
              <label><input type="radio" name="portalChecklistOleo" value="nao"> Não</label>
            </div>
          </div>
          <div class="portal-checklist-inline-field">
            <label>Odômetro (km) <input type="number" inputmode="numeric" min="0" step="1" id="portalChecklistOdometro" placeholder="km"></label>
          </div>
          <div class="portal-checklist-inline-field">
            <label>Próxima troca (km) <input type="text" id="portalChecklistProximaTroca" readonly tabindex="-1"></label>
          </div>
          <div class="portal-checklist-toggle-group">
            <span>Pagou</span>
            <div class="portal-checklist-toggle-options" role="group" aria-label="Pagou">
              <label><input type="radio" name="portalChecklistPagou" value="S"> S</label>
              <label><input type="radio" name="portalChecklistPagou" value="N"> N</label>
              <label><input type="radio" name="portalChecklistPagou" value="NA"> N/A</label>
            </div>
          </div>
        </div>
        <table class="portal-checklist-inspection" aria-label="Itens de inspeção">
          <thead>
            <tr>
              <th class="portal-checklist-num">#</th>
              <th class="portal-checklist-desc">Item</th>
              <th class="portal-checklist-ar">A</th>
              <th class="portal-checklist-ar">R</th>
              <th class="portal-checklist-obs">Obs.</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
        <div class="portal-checklist-staff-row">
          <label>Mecânico
            <select id="portalChecklistMecanico"><option value="">— Selecione —</option></select>
          </label>
          <label>Supervisor
            <select id="portalChecklistSupervisor"><option value="">— Selecione —</option></select>
          </label>
        </div>
        <p id="portalChecklistExportHint" class="portal-checklist-export-hint"></p>
        <div class="portal-checklist-export-footer">
          <div class="portal-checklist-export-actions">
            <button type="button" class="btn-primary" id="portalChecklistBtnImprimir" disabled>Imprimir</button>
            <button type="button" class="btn-primary btn-secondary-outline" id="portalChecklistBtnPdf" disabled>Guardar PDF</button>
          </div>
          <div class="portal-checklist-disposition-actions">
            <button type="button" class="btn-primary btn-secondary-outline" id="portalChecklistBtnDevolvido" disabled>DEVOLVIDO AO CLIENTE</button>
            <button type="button" class="btn-primary btn-secondary-outline" id="portalChecklistBtnManutencao" disabled>ENVIADO PARA MANUTENÇÃO</button>
          </div>
        </div>
        <p id="portalChecklistDispositionMsg" class="portal-checklist-disposition-msg" role="status"></p>
      </div>
    `;

    portalPopulateColaboradoresChecklistSelects();
    portalBindInnerChecklistEvents();
    portalValidateChecklistCompleto();
    portalChecklistUiBuilt = true;
  }

  document.getElementById("btnPortalChecklistAbrir")?.addEventListener("click", () => {
    portalEnsureChecklistUiBuilt();
    refreshPortalChecklistPlacasAtivasCache();
    const inp = document.getElementById("portalChecklistPlacaInput");
    inp?.focus();
    if (inp) renderPortalChecklistPlacaDropdown(String(inp.value || ""));
  });

  document.getElementById("portalChecklistCarregarBtn")?.addEventListener("click", () => {
    portalEnsureChecklistUiBuilt();
    refreshPortalChecklistPlacasAtivasCache();
    const raw = String(document.getElementById("portalChecklistPlacaInput")?.value || "").trim();
    const msgEl = document.getElementById("portalChecklistLoadMsg");
    const mount = document.getElementById("portalChecklistMount");
    const fotosGrid = document.getElementById("portalChecklistFotosGrid");
    if (!raw) {
      fotosGrid?.classList.add("hidden");
      if (msgEl) msgEl.textContent = "Informe a placa.";
      return;
    }
    const plateFmt =
      typeof normalizePlate === "function"
        ? normalizePlate(raw)
        : String(raw)
            .replace(/\s+/g, "")
            .toUpperCase()
            .replace(/[^A-Z0-9]/g, "");
    if (!plateFmt) {
      fotosGrid?.classList.add("hidden");
      if (msgEl) msgEl.textContent = "Placa inválida.";
      return;
    }
    if (document.getElementById("portalChecklistPlacaInput")) {
      document.getElementById("portalChecklistPlacaInput").value = plateFmt;
    }
    portalClearChecklistInspection();
    const res = portalFillChecklistFromCadastro(plateFmt);
    if (msgEl) msgEl.textContent = res.message;
    mount?.classList.remove("hidden");
    fotosGrid?.classList.remove("hidden");
    portalValidateChecklistCompleto();
  });

  [
    { btn: "btn-manutencao-em-operacao", panel: "manutencaoInlineEmOperacao" },
    { btn: "btn-manutencao-em-manutencao", panel: "manutencaoInlineEmManutencao" },
    { btn: "btn-manutencao-reserva", panel: "manutencaoInlineReserva" },
    { btn: "btn-manutencao-operacionais", panel: "manutencaoInlineOperacionais" },
  ].forEach(({ btn, panel }) => {
    document.getElementById(btn)?.addEventListener("click", () => {
      hideManutencaoInlineFormsCore();
      setManutencaoFormPlaceholderVisible(false);
      document.getElementById(panel)?.classList.remove("hidden");
      syncManutencaoSidebarButtons(btn);
      if (panel === "manutencaoInlineEmOperacao") {
        portalEnsureChecklistUiBuilt();
        refreshPortalChecklistPlacasAtivasCache();
      }
      if (panel === "manutencaoInlineEmManutencao") {
        portalRefreshManutencaoVeiculosLista();
      }
    });
  });

  function findFuncionarioOperacaoPortalPorCpf(digits11) {
    const dig = String(digits11 || "")
      .replace(/\D/g, "")
      .slice(0, 11);
    if (dig.length !== 11 || typeof funcionariosAccess === "undefined" || !Array.isArray(funcionariosAccess)) return null;
    return (
      funcionariosAccess.find(
        (f) =>
          onlyDigits(String(f.cpf || "")) === dig && String(f.role || "").trim() === "operacao"
      ) || null
    );
  }

  function refreshPortalColaboradorBloqueioUi() {
    const wrap = document.getElementById("portalColabBloqueioWrap");
    const btn = document.getElementById("portalColabBloqueioBtn");
    if (!wrap || !btn) return;
    if (!isPortalTitularAdministrador()) {
      wrap.classList.add("hidden");
      return;
    }
    const dig = onlyDigits(String(document.getElementById("portalColabCpf")?.value || "")).slice(0, 11);
    const f = dig.length === 11 ? findFuncionarioOperacaoPortalPorCpf(dig) : null;
    if (!f) {
      wrap.classList.add("hidden");
      btn.textContent = "Bloquear colaborador";
      return;
    }
    wrap.classList.remove("hidden");
    btn.textContent = f.blocked ? "Desbloquear colaborador" : "Bloquear colaborador";
  }

  function limparPortalColaboradorCamposParaNovo() {
    const nome = document.getElementById("portalColabNome");
    const funcao = document.getElementById("portalColabFuncao");
    const ingresso = document.getElementById("portalColabIngresso");
    if (nome) nome.value = "";
    if (funcao) funcao.value = "";
    if (ingresso) ingresso.value = "";
    const c1 = document.getElementById("portalColabAceCliente");
    const c2 = document.getElementById("portalColabAceVeiculo");
    const c3 = document.getElementById("portalColabAceLocacao");
    const c4 = document.getElementById("portalColabAceLancAluguel");
    if (c1) c1.checked = true;
    if (c2) c2.checked = true;
    if (c3) c3.checked = true;
    if (c4) c4.checked = true;
  }

  function aplicarPortalColaboradorDoFuncionario(f) {
    if (!f) return;
    const nome = document.getElementById("portalColabNome");
    const funcao = document.getElementById("portalColabFuncao");
    const ingresso = document.getElementById("portalColabIngresso");
    if (nome) nome.value = String(f.nome || "").trim();
    if (funcao) funcao.value = String(f.funcao || "").trim();
    if (ingresso) {
      const raw = String(f.dataIngresso || "").trim();
      const di = onlyDigits(raw).slice(0, 8);
      ingresso.value =
        typeof formatDateMask === "function" && di.length ? formatDateMask(di) : raw;
    }
    const a = f.acessos || {};
    const c1 = document.getElementById("portalColabAceCliente");
    const c2 = document.getElementById("portalColabAceVeiculo");
    const c3 = document.getElementById("portalColabAceLocacao");
    const c4 = document.getElementById("portalColabAceLancAluguel");
    if (c1) c1.checked = Boolean(a.cliente);
    if (c2) c2.checked = Boolean(a.veiculo);
    if (c3) c3.checked = Boolean(a.locacao);
    if (c4) c4.checked = Boolean(a.lancamentoAluguel);
  }

  function setPortalColaboradorModoCadastroOuEdicao(modoCadastroNovo) {
    const btnC = document.getElementById("portalColabBtnCadastrar");
    const btnS = document.getElementById("portalColabBtnSalvarAlteracoes");
    if (btnC) {
      btnC.classList.toggle("hidden", !modoCadastroNovo);
      btnC.disabled = !modoCadastroNovo;
    }
    if (btnS) btnS.classList.toggle("hidden", modoCadastroNovo);
  }

  function syncPortalColaboradorFormFromCpf() {
    const inp = document.getElementById("portalColabCpf");
    const dig = onlyDigits(String(inp?.value || "")).slice(0, 11);
    const len = dig.length;

    if (len < 11 && portalColabCpfPrevLen === 11) {
      limparPortalColaboradorCamposParaNovo();
    }
    portalColabCpfPrevLen = len;

    if (len < 11) {
      setPortalColaboradorModoCadastroOuEdicao(true);
      refreshPortalColaboradorBloqueioUi();
      return;
    }

    const f = findFuncionarioOperacaoPortalPorCpf(dig);
    if (f) {
      aplicarPortalColaboradorDoFuncionario(f);
      setPortalColaboradorModoCadastroOuEdicao(false);
    } else {
      limparPortalColaboradorCamposParaNovo();
      setPortalColaboradorModoCadastroOuEdicao(true);
    }
    refreshPortalColaboradorBloqueioUi();
  }

  formPortalCadastroColaborador?.addEventListener("submit", (ev) => {
    ev.preventDefault();
    const fb = document.getElementById("portalCadastroColaboradorFeedback");
    if (!isPortalTitularAdministrador()) {
      if (fb) fb.textContent = "Apenas o administrador titular pode cadastrar colaboradores.";
      return;
    }
    if (typeof funcionariosAccess === "undefined" || !Array.isArray(funcionariosAccess) || typeof saveFuncionariosAccess !== "function") {
      if (fb) fb.textContent = "Cadastro indisponível neste ambiente.";
      return;
    }
    const cpfRaw = onlyDigits(String(document.getElementById("portalColabCpf")?.value || "")).slice(0, 11);
    const nome = String(document.getElementById("portalColabNome")?.value || "").trim();
    const funcao = String(document.getElementById("portalColabFuncao")?.value || "").trim();
    const dataIngresso = String(document.getElementById("portalColabIngresso")?.value || "").trim();
    if (cpfRaw.length !== 11) {
      if (fb) fb.textContent = "Informe um CPF válido (11 dígitos).";
      return;
    }
    if (!nome) {
      if (fb) fb.textContent = "Informe o nome completo.";
      return;
    }
    if (funcionariosAccess.some((x) => onlyDigits(String(x.cpf || "")) === cpfRaw)) {
      if (fb) fb.textContent = "Já existe cadastro com este CPF.";
      return;
    }
    const aceCliente = Boolean(document.getElementById("portalColabAceCliente")?.checked);
    const aceVeiculo = Boolean(document.getElementById("portalColabAceVeiculo")?.checked);
    const aceLocacao = Boolean(document.getElementById("portalColabAceLocacao")?.checked);
    const aceLanc = Boolean(document.getElementById("portalColabAceLancAluguel")?.checked);
    if (!aceCliente && !aceVeiculo && !aceLocacao && !aceLanc) {
      if (fb) fb.textContent = "Marque pelo menos uma operação permitida.";
      return;
    }
    const acessos =
      typeof normalizeOperacaoAccess === "function"
        ? normalizeOperacaoAccess(
            {
              cliente: aceCliente,
              veiculo: aceVeiculo,
              locacao: aceLocacao,
              manutencao: false,
              lancamentoAluguel: aceLanc,
              lancamentoDespesa: false,
            },
            "operacao"
          )
        : {
            cliente: aceCliente,
            veiculo: aceVeiculo,
            locacao: aceLocacao,
            manutencao: false,
            lancamentoAluguel: aceLanc,
            lancamentoDespesa: false,
            funcionario: false,
          };
    funcionariosAccess.push({
      cpf: cpfRaw,
      senha: "123456",
      nome,
      role: "operacao",
      blocked: false,
      mustChangePassword: true,
      funcao,
      dataIngresso,
      acessos,
    });
    saveFuncionariosAccess();
    portalPushCloudSnapshotAfterPersist();
    formPortalCadastroColaborador.reset();
    portalColabCpfPrevLen = 0;
    syncPortalColaboradorFormFromCpf();
    if (fb) {
      fb.textContent =
        "Colaborador cadastrado. Senha inicial 123456 — no primeiro login será pedida a nova senha (6 números).";
    }
  });

  document.getElementById("portalColabBtnSalvarAlteracoes")?.addEventListener("click", () => {
    const fb = document.getElementById("portalCadastroColaboradorFeedback");
    if (!isPortalTitularAdministrador()) {
      if (fb) fb.textContent = "Apenas o administrador titular pode alterar colaboradores.";
      return;
    }
    if (typeof funcionariosAccess === "undefined" || !Array.isArray(funcionariosAccess) || typeof saveFuncionariosAccess !== "function") {
      if (fb) fb.textContent = "Cadastro indisponível neste ambiente.";
      return;
    }
    const cpfRaw = onlyDigits(String(document.getElementById("portalColabCpf")?.value || "")).slice(0, 11);
    const nome = String(document.getElementById("portalColabNome")?.value || "").trim();
    const funcao = String(document.getElementById("portalColabFuncao")?.value || "").trim();
    const dataIngresso = String(document.getElementById("portalColabIngresso")?.value || "").trim();
    if (cpfRaw.length !== 11) {
      if (fb) fb.textContent = "Informe um CPF válido (11 dígitos).";
      return;
    }
    const f = findFuncionarioOperacaoPortalPorCpf(cpfRaw);
    if (!f) {
      if (fb) fb.textContent = "Não há colaborador com este CPF para atualizar.";
      return;
    }
    if (!nome) {
      if (fb) fb.textContent = "Informe o nome completo.";
      return;
    }
    const aceCliente = Boolean(document.getElementById("portalColabAceCliente")?.checked);
    const aceVeiculo = Boolean(document.getElementById("portalColabAceVeiculo")?.checked);
    const aceLocacao = Boolean(document.getElementById("portalColabAceLocacao")?.checked);
    const aceLanc = Boolean(document.getElementById("portalColabAceLancAluguel")?.checked);
    if (!aceCliente && !aceVeiculo && !aceLocacao && !aceLanc) {
      if (fb) fb.textContent = "Marque pelo menos uma operação permitida.";
      return;
    }
    const acessos =
      typeof normalizeOperacaoAccess === "function"
        ? normalizeOperacaoAccess(
            {
              cliente: aceCliente,
              veiculo: aceVeiculo,
              locacao: aceLocacao,
              manutencao: false,
              lancamentoAluguel: aceLanc,
              lancamentoDespesa: false,
            },
            "operacao"
          )
        : {
            cliente: aceCliente,
            veiculo: aceVeiculo,
            locacao: aceLocacao,
            manutencao: false,
            lancamentoAluguel: aceLanc,
            lancamentoDespesa: false,
            funcionario: false,
          };
    f.nome = nome;
    f.funcao = funcao;
    f.dataIngresso = dataIngresso;
    f.acessos = acessos;
    saveFuncionariosAccess();
    portalPushCloudSnapshotAfterPersist();
    aplicarPortalColaboradorDoFuncionario(f);
    refreshPortalOperacaoNavPorAcessos();
    if (fb) fb.textContent = "Alterações guardadas.";
  });

  document.getElementById("portalColabBloqueioBtn")?.addEventListener("click", () => {
    const fb = document.getElementById("portalCadastroColaboradorFeedback");
    if (!isPortalTitularAdministrador()) return;
    if (typeof saveFuncionariosAccess !== "function" || typeof funcionariosAccess === "undefined") return;
    const dig = onlyDigits(String(document.getElementById("portalColabCpf")?.value || "")).slice(0, 11);
    const f = dig.length === 11 ? findFuncionarioOperacaoPortalPorCpf(dig) : null;
    if (!f) {
      if (fb) fb.textContent = "CPF não corresponde a um colaborador cadastrado.";
      return;
    }
    f.blocked = !f.blocked;
    saveFuncionariosAccess();
    portalPushCloudSnapshotAfterPersist();
    syncPortalColaboradorFormFromCpf();
    if (fb) {
      fb.textContent = f.blocked
        ? "Colaborador bloqueado — não pode entrar no sistema."
        : "Colaborador desbloqueado — pode voltar a aceder.";
    }
  });

  document.getElementById("portalColabCpf")?.addEventListener("input", () => {
    syncPortalColaboradorFormFromCpf();
  });

  document.getElementById("portalColabCpf")?.addEventListener("blur", () => {
    const inp = document.getElementById("portalColabCpf");
    if (!inp || typeof formatCpf !== "function") return;
    const dig = onlyDigits(String(inp.value || "")).slice(0, 11);
    if (dig.length === 11) inp.value = formatCpf(dig);
    syncPortalColaboradorFormFromCpf();
  });

  btnVoltarOp?.addEventListener("click", () => {
    panelOperacao?.classList.add("hidden");
    panelLogado?.classList.remove("hidden");
  });

  btnSair?.addEventListener("click", () => {
    portalColaboradorSenhaPendente = null;
    clearSession();
    resetPortalLoginFormularioETipoAcesso();
    hideAllPanels();
    panelLogin?.classList.remove("hidden");
    btnOperacao?.classList.add("hidden");
    btnManutencao?.classList.add("hidden");
    refreshPortalUnitLeadForSession();
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
      let show = Boolean(isOwner && localOnly);
      if (show && typeof clienteTemVinculoComLocacao === "function") {
        const nome = String(localOnly?.nome || inpNome?.value || "").trim();
        const codigo = String(document.getElementById("operacaoClienteCodigo")?.value || localOnly?.codigo || "").trim();
        if (clienteTemVinculoComLocacao(digits, nome, codigo)) show = false;
      }
      btn.classList.toggle("hidden", !show);
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
      lockImmutableClienteFields(true, {
        codigo: getPortalCanonicalClienteCodeByCpf(digits) || String(cliente.codigo || "").trim(),
        cpf: digits,
        nome: String(cliente.nome || "").trim(),
        dataCadastro: dataPreferida || String(inpDataCadastro?.value || "").trim(),
      });
      setAtualizarButtonByCpf(digits);
      const dataLabel = dataPreferida;
      if (msg) msg.textContent = dataLabel ? `Cliente já cadastrado em ${dataLabel}.` : "Cliente já cadastrado.";
      if (lastAlertedCpf !== digits) {
        window.alert(dataLabel ? `Cliente cadastrado em ${dataLabel}.` : "Cliente já cadastrado.");
        lastAlertedCpf = digits;
      }
    });

    inpNome?.addEventListener("input", () => {
      const digits =
        typeof onlyDigits === "function" ? onlyDigits(String(inpCpf.value || "")) : String(inpCpf.value || "").replace(/\D/g, "");
      if (digits.length === 11) refreshOperacaoClienteApagarBtn(digits);
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
      portalPushCloudSnapshotAfterPersist();
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
      portalPushCloudSnapshotAfterPersist();
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
      window.alert(
        "Política do sistema: cadastros de cliente, veículo e locação não podem ser apagados. Use cancelamento ou alteração de dados no sistema completo, se disponível."
      );
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

  /** Coluna «quem executou» / «quem finalizou»: código 000AA + hora (mesmo padrão dos lançamentos). */
  function portalRelatorioLocacaoExecucaoCell(loc) {
    const cod = portalCodigoUsuarioRegistroLancamento(loc.portalLocacaoExecutadoPorCpf, loc.portalLocacaoExecutadoPorNome);
    const ms =
      Number(loc.portalLocacaoExecutadoEmMs || 0) ||
      Number(loc.createdAt || loc.id || 0);
    const hora = formatPortalHoraLancamentoMs(Number.isFinite(ms) && ms > 0 ? ms : 0);
    if (cod && hora !== "—") return `${cod} · ${hora}`;
    if (hora !== "—") return cod ? `${cod} · ${hora}` : `— · ${hora}`;
    return "—";
  }

  function portalRelatorioLocacaoFinalizacaoCell(loc) {
    if (!String(loc.fim || "").trim()) return "—";
    const cod = portalCodigoUsuarioRegistroLancamento(loc.portalLocacaoFinalizadoPorCpf, loc.portalLocacaoFinalizadoPorNome);
    const ms = Number(loc.portalLocacaoFinalizadoEmMs || 0);
    const hora = formatPortalHoraLancamentoMs(Number.isFinite(ms) && ms > 0 ? ms : 0);
    if (cod && hora !== "—") return `${cod} · ${hora}`;
    if (hora !== "—") return cod ? `${cod} · ${hora}` : `— · ${hora}`;
    return "—";
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
      portalRelatorioLocacaoExecucaoCell(locacao),
      String(locacao.fim || "").trim() || "—",
      portalRelatorioLocacaoFinalizacaoCell(locacao),
      String(locacao.plano || "").trim() || "—",
      statusRaw || "—",
      String(locacao.modalidade || "").trim() || "—",
    ];
  }

  /**
   * Chave temporal para ordenar relatórios: mais recentes primeiro.
   * Locações: prioriza a data da coluna **Início**; depois createdAt, protocolo, etc.
   */
  function portalRegistroRecencyMs(rec) {
    if (!rec || typeof rec !== "object") return 0;
    const tryParse = (raw) => {
      const s = String(raw || "").trim();
      if (!s) return 0;
      if (typeof parseBrDate === "function") {
        const d = parseBrDate(s);
        if (d && !Number.isNaN(d.getTime())) return d.getTime();
      }
      return 0;
    };
    const inicioMs = tryParse(rec.inicio);
    if (inicioMs) return inicioMs;
    const ca = Number(rec.createdAt ?? 0);
    if (Number.isFinite(ca) && ca > 0) return ca;
    const idn = Number(rec.id ?? 0);
    if (Number.isFinite(idn) && idn > 1e12) return idn;
    const nc = String(rec.numeroContrato ?? "").replace(/\s+/g, "");
    if (/^\d{8,}$/.test(nc)) return Number(nc);
    for (const k of ["dataCadastro", "fim"]) {
      const t = tryParse(rec[k]);
      if (t) return t;
    }
    if (Number.isFinite(idn) && idn > 0) return idn;
    return 0;
  }

  function sortPortalRelatorioByRecencyDesc(records) {
    return records.slice().sort((a, b) => {
      const da = portalRegistroRecencyMs(a);
      const db = portalRegistroRecencyMs(b);
      if (db !== da) return db - da;
      const ta = String(a.numeroContrato || a.tag || a.placa || a.cpf || "");
      const tb = String(b.numeroContrato || b.tag || b.placa || b.cpf || "");
      return tb.localeCompare(ta, "en");
    });
  }

  /** DD/MM/AAAA → ms; inválido → 0. */
  function parsePortalLocacaoDataMs(raw) {
    const s = String(raw ?? "").trim();
    if (!s || s === "—" || s === "-") return 0;
    if (typeof parseBrDate !== "function") return 0;
    const d = parseBrDate(s);
    return d && !Number.isNaN(d.getTime()) ? d.getTime() : 0;
  }

  /**
   * Para ordenar locações: usa a **mais recente** entre data de início e data de fim
   * (cadastro novo ou finalização recente sobem no relatório). Sem datas válidas → fallback genérico.
   */
  function portalLocacaoUltimaAtividadeMs(rec) {
    if (!rec || typeof rec !== "object") return 0;
    const ini = parsePortalLocacaoDataMs(rec.inicio);
    const fim = parsePortalLocacaoDataMs(rec.fim);
    const mx = Math.max(ini || 0, fim || 0);
    if (mx > 0) return mx;
    return portalRegistroRecencyMs(rec);
  }

  function sortPortalLocacoesPorUltimaDataDesc(records) {
    if (!Array.isArray(records)) return [];
    return records.slice().sort((a, b) => {
      const da = portalLocacaoUltimaAtividadeMs(a);
      const db = portalLocacaoUltimaAtividadeMs(b);
      if (db !== da) return db - da;
      const ta = String(a.numeroContrato || a.placa || a.cpf || "");
      const tb = String(b.numeroContrato || b.placa || b.cpf || "");
      return tb.localeCompare(ta, "en");
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
    if (context.fileSlug === "pagamentos-periodo" && typeof context.totalRecebido === "number") {
      const tot = Number(context.totalRecebido || 0).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
      });
      resumo.textContent = `${context.rows.length} pagamento(s) no período · Total: ${tot}. Exportar em PDF ou Excel.`;
    } else if (
      (context.fileSlug === "relatorio-cliente-protocolos" || context.fileSlug === "relatorio-placa-protocolos") &&
      context.stats
    ) {
      resumo.textContent = `${context.stats.protocolos} protocolo(s), ${context.stats.pagamentos} pagamento(s). Exportar em PDF ou Excel.`;
    } else {
    resumo.textContent = `${context.rows.length} registro(s) pronto(s) para exportar em PDF ou Excel.`;
    }
    modal.classList.remove("hidden");
    modal.setAttribute("aria-hidden", "false");
  }

  function closePortalRelatorioModal() {
    const modal = document.getElementById("portalRelatorioModal");
    if (!modal) return;
    modal.classList.add("hidden");
    modal.setAttribute("aria-hidden", "true");
  }

  function countPortalRelatorioRowsStatusAtivos(rows, statusIdx, statusFn) {
    if (typeof statusIdx !== "number" || typeof statusFn !== "function" || !Array.isArray(rows)) return 0;
    let n = 0;
    for (const row of rows) {
      if (!Array.isArray(row) || statusIdx < 0 || statusIdx >= row.length) continue;
      if (statusFn(String(row[statusIdx] ?? ""))) n += 1;
    }
    return n;
  }

  function buildPortalRelatorioHtml(title, headers, rows, reportOptions = {}) {
    const eh = typeof escapeHtml === "function" ? escapeHtml : portalEscapeHtml;
    const statusIdx = reportOptions.statusColumnIndex;
    const statusFn =
      typeof statusIdx === "number" && typeof isPortalRelatorioStatusCellAtivo === "function"
        ? isPortalRelatorioStatusCellAtivo
        : null;
    const headCells = headers.map((h) => `<th>${eh(h)}</th>`).join("");
    const bodyCells = rows
      .map((row) => {
        const tds = row
          .map((c, ci) => {
            let tdExtra = "";
            if (statusFn && statusIdx === ci) {
              tdExtra = statusFn(String(c ?? "")) ? ' class="portal-rel-status-ativo"' : ' class="portal-rel-status-inativo"';
            }
            return `<td${tdExtra}>${eh(c)}</td>`;
          })
          .join("");
        return `<tr>${tds}</tr>`;
      })
      .join("");
    const quando = new Date().toLocaleString("pt-BR");
    const ativosCount = statusFn ? countPortalRelatorioRowsStatusAtivos(rows, statusIdx, statusFn) : 0;
    const metaAtivosSuffix =
      statusFn && typeof statusIdx === "number"
        ? ` sendo ${eh(String(ativosCount))} registros ativos.`
        : "";
    const extraMeta = (reportOptions.headerSubtitleLines || [])
      .filter((line) => String(line || "").trim())
      .map((line) => `<p class="meta"><strong>${eh(String(line))}</strong></p>`)
      .join("");
    return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><title>${eh(title)}</title><style>
      body{font-family:system-ui,-apple-system,sans-serif;margin:1.2rem;color:#111;font-size:12px}
      h1{font-size:1.05rem;margin:0 0 0.35rem}
      .meta{color:#444;margin:0.2rem 0;font-size:11px}
      table{width:100%;border-collapse:collapse}
      th,td{border:1px solid #333;padding:5px 7px;text-align:left}
      th{background:#eee;font-weight:600}
      .portal-rel-status-ativo{background:#c8e6c9}
      .portal-rel-status-inativo{background:#fff9c4}
    </style></head><body>
      <h1>${eh(title)}</h1>
      ${extraMeta}
      <p class="meta">Emitido em ${eh(quando)} · ${eh(String(rows.length))} registro(s)${metaAtivosSuffix}</p>
      <table><thead><tr>${headCells}</tr></thead><tbody>${bodyCells || `<tr><td colspan="${headers.length}">${eh(
        "Nenhum registo."
      )}</td></tr>`}</tbody></table>
    </body></html>`;
  }

  /** Nome de ficheiro sem extensão: remove caracteres inválidos no Windows e limita o tamanho. */
  function sanitizePortalPdfFilenameBase(raw) {
    let s = String(raw || "").trim();
    if (!s) return "relatorio";
    s = s.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "").replace(/\s+/g, " ");
    if (s.length > 180) s = s.slice(0, 180).trim();
    return s || "relatorio";
  }

  /** Converte data DD/MM/AAAA (ou similares) para dd-mm-aaaa no nome do ficheiro. */
  function portalBrDateToFilenameSegment(br) {
    const t = String(br || "").trim();
    const m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (m) {
      return `${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}-${m[3]}`;
    }
    return t.replace(/\//g, "-");
  }

  /** Placa normalizada (7 alfanum.) → ABC-1A23 (estilo comum para exibição / ficheiro). */
  function formatPlateForPortalExportFilename(normRaw) {
    const np =
      typeof normalizePlate === "function"
        ? normalizePlate(String(normRaw || ""))
        : String(normRaw || "")
            .toUpperCase()
            .replace(/[^A-Z0-9]/g, "");
    if (!np) return "";
    if (np.length >= 3) return `${np.slice(0, 3)}-${np.slice(3)}`;
    return np;
  }

  /**
   * Título do documento para impressão / «Guardar como PDF» (navegador usa o &lt;title&gt;).
   * Relatórios 1–3: padrão pedido (período, CPF, placa).
   */
  function getPortalRelatorioPdfSaveSuggestedBaseName(context) {
    if (!context) return "relatorio";
    const slug = context.fileSlug;
    if (slug === "pagamentos-periodo") {
      const a = portalBrDateToFilenameSegment(context.periodoInicioBr);
      const b = portalBrDateToFilenameSegment(context.periodoFimBr);
      if (a && b) {
        return sanitizePortalPdfFilenameBase(`relatorio por periodo ${a} até ${b}`);
      }
      return sanitizePortalPdfFilenameBase("relatorio por periodo");
    }
    if (slug === "relatorio-cliente-protocolos") {
      const dig = String(context.relatorioClienteCpfDigits || "").replace(/\D/g, "").slice(0, 11);
      const fmtCpf = typeof formatCpf === "function" ? formatCpf : (d) => d;
      const cpf = dig.length === 11 ? fmtCpf(dig) : "—";
      return sanitizePortalPdfFilenameBase(`relatorio por cliente cpf ${cpf}`);
    }
    if (slug === "relatorio-placa-protocolos") {
      const norm = String(context.relatorioPlacaNorm || "").trim();
      const plate = formatPlateForPortalExportFilename(norm);
      if (plate) return sanitizePortalPdfFilenameBase(`relatorio placa ${plate}`);
      return sanitizePortalPdfFilenameBase("relatorio placa");
    }
    if (context.title) return sanitizePortalPdfFilenameBase(String(context.title));
    if (slug) return sanitizePortalPdfFilenameBase(`relatorio ${slug}`);
    return "relatorio";
  }

  function applyPortalPdfDocumentTitle(html, suggestedBase) {
    const eh = typeof escapeHtml === "function" ? escapeHtml : portalEscapeHtml;
    const base = sanitizePortalPdfFilenameBase(suggestedBase);
    if (!html || !String(html).includes("<title")) return html;
    return String(html).replace(/<title>[\s\S]*?<\/title>/i, `<title>${eh(base)}</title>`);
  }

  function emitPortalRelatorioPdf(context) {
    const iframe = document.getElementById("portalPdfIframe");
    const viewer = document.getElementById("portalRelatorioPdfViewer");
    if (!iframe || !viewer) return;
    let html =
      typeof context.buildPdfHtml === "function"
        ? context.buildPdfHtml()
        : buildPortalRelatorioHtml(context.title, context.headers, context.rows, {
            statusColumnIndex: context.statusColumnIndex,
            headerSubtitleLines: context.headerSubtitleLines,
          });
    html = applyPortalPdfDocumentTitle(html, getPortalRelatorioPdfSaveSuggestedBaseName(context));
    hideRelatorioLocacaoPdfViewer();
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    portalLocacaoRelatorioPdfBlobUrl = URL.createObjectURL(blob);
    iframe.src = portalLocacaoRelatorioPdfBlobUrl;
    viewer.classList.remove("hidden");
    viewer.setAttribute("aria-hidden", "false");
  }

  function emitPortalRelatorioExcel(context) {
    const exportBase = getPortalRelatorioPdfSaveSuggestedBaseName(context);
    if (typeof context.buildExcelHtml === "function") {
      const html = `\uFEFF${context.buildExcelHtml()}`;
      const blob = new Blob([html], { type: "application/vnd.ms-excel;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${exportBase}.xls`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      return;
    }
    if (typeof downloadStyledExcel !== "function") return;
    const d = new Date();
    const metaLines = [
      ["Relatório", context.title],
      ...(Array.isArray(context.excelMetaPairs) ? context.excelMetaPairs : []),
      ["Emitido em", d.toLocaleString("pt-BR")],
      ["Registos", String(context.rows.length)],
    ];
    downloadStyledExcel(exportBase, context.headers, context.rows, metaLines, {
      textColumns: context.textColumns || [],
      statusColumnIndex: context.statusColumnIndex,
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

    const rowsRaw = Array.from(byCpf.values()).sort((a, b) => {
      const da = portalRegistroRecencyMs(a);
      const db = portalRegistroRecencyMs(b);
      if (db !== da) return db - da;
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
    const rowsRaw = sortPortalRelatorioByRecencyDesc(
      typeof loadCadastro === "function" && typeof CAD_VEICULOS_KEY !== "undefined" ? loadCadastro(CAD_VEICULOS_KEY) : []
    );
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
    const rowsRaw = sortPortalLocacoesPorUltimaDataDesc(
      typeof loadCadastro === "function" && typeof CAD_LOCACOES_KEY !== "undefined" ? loadCadastro(CAD_LOCACOES_KEY) : []
    );
    const headers = [
      "Protocolo",
      "CPF",
      "Cliente",
      "Placa",
      "Modelo",
      "Início",
      "Execução",
      "Fim",
      "Finalização",
      "Plano",
      "Status",
    ];
    const rows = rowsRaw.map((l) => rowPortalRelatorioLocacao(l).slice(0, 11));
    return {
      title: "Relatório de locações cadastradas",
      headers,
      rows,
      fileSlug: "locacoes",
      textColumns: [0, 1, 3],
      statusColumnIndex: 10,
    };
  }

  /**
   * Para o Relatório 1: um lançamento com espécie/Pix/cartão vira até três linhas (valor por meio), mesmo instante de registo.
   * Lançamentos antigos sem discriminação: uma linha com tipo «—».
   */
  function portalLancamentoAluguelPartesRelatorioPeriodo(lan) {
    if (!lan || typeof lan !== "object") return [];
    const MEIOS = ["valorEspecie", "valorPix", "valorCartao"];
    const hasMeios = MEIOS.some((k) => Object.prototype.hasOwnProperty.call(lan, k));
    const parseV = (raw) => Number(parsePortalLancamentoValorRaw(raw ?? ""));
    if (hasMeios) {
      const ve = parseV(lan.valorEspecie ?? 0);
      const vp = parseV(lan.valorPix ?? 0);
      const vc = parseV(lan.valorCartao ?? 0);
      const partes = [];
      if (ve > 0) partes.push({ valor: ve, tipo: "espécie", tipoOrder: 0 });
      if (vp > 0) partes.push({ valor: vp, tipo: "pix", tipoOrder: 1 });
      if (vc > 0) partes.push({ valor: vc, tipo: "cartão", tipoOrder: 2 });
      if (partes.length) return partes;
      const vFallback = Number(lan.valor || 0);
      if (Number.isFinite(vFallback) && vFallback > 0) return [{ valor: vFallback, tipo: "—", tipoOrder: 0 }];
      return [];
    }
    const v = Number(lan.valor || 0);
    if (!Number.isFinite(v) || v <= 0) return [];
    return [{ valor: v, tipo: "—", tipoOrder: 0 }];
  }

  /** DD/MM/AAAA → DD-MM-AAAA (texto do recibo). */
  function portalDataPagamentoBrParaReciboDdMmAa(br) {
    const s = String(br || "").trim();
    const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (!m) return s.replace(/\//g, "-") || "—";
    return `${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}-${m[3]}`;
  }

  function portalExtensoAte999Br(n) {
    const num = Math.floor(Math.max(0, Math.min(999, Number(n))));
    if (num === 0) return "";
    if (num === 100) return "cem";
    const u = ["zero", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove"];
    const d10 = ["dez", "onze", "doze", "treze", "quatorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove"];
    const d20 = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
    const c100 = ["", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos", "setecentos", "oitocentos", "novecentos"];
    const c = Math.floor(num / 100);
    const r = num % 100;
    let head = "";
    if (c === 1) head = r === 0 ? "cem" : "cento";
    else if (c > 1) head = c100[c];
    let tail = "";
    if (r > 0) {
      if (r < 10) tail = u[r];
      else if (r < 20) tail = d10[r - 10];
      else {
        const dc = Math.floor(r / 10);
        const ru = r % 10;
        tail = d20[dc] + (ru ? " e " + u[ru] : "");
      }
    }
    if (!head) return tail;
    if (!tail) return head;
    return head + " e " + tail;
  }

  function portalInteiroPorExtensoBr(n) {
    let num = Math.floor(Math.max(0, Math.min(999999, Number(n))));
    if (num === 0) return "zero";
    const mil = Math.floor(num / 1000);
    const rem = num % 1000;
    if (mil > 0 && rem > 0) {
      if (mil === 1) return "mil e " + portalExtensoAte999Br(rem);
      return portalExtensoAte999Br(mil) + " mil e " + portalExtensoAte999Br(rem);
    }
    if (mil > 0) return mil === 1 ? "mil" : portalExtensoAte999Br(mil) + " mil";
    return portalExtensoAte999Br(rem);
  }

  function portalValorReaisPorExtensoBr(val) {
    const v = Number(val);
    if (!Number.isFinite(v)) return "";
    const inteiro = Math.floor(v + 1e-9);
    let centavos = Math.round((v - inteiro) * 100);
    if (centavos === 100) {
      centavos = 0;
    }
    let s = portalInteiroPorExtensoBr(inteiro);
    s += inteiro === 1 ? " real" : " reais";
    if (centavos > 0) {
      s += " e " + portalInteiroPorExtensoBr(centavos);
      s += centavos === 1 ? " centavo" : " centavos";
    }
    return s;
  }

  /** Monta o parágrafo do recibo (composição só com 2+ meios discriminados). */
  function portalMontarTextoReciboPagamentoAluguel(p) {
    const nome = String(p.nome || "").trim();
    const cpf = String(p.cpfExib || "").trim();
    const dia = portalDataPagamentoBrParaReciboDdMmAa(p.dataPagamentoBr);
    const total = Number(p.totalNum || 0);
    const fmtMoney = (x) =>
      Number(x || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    const extTotal = portalValorReaisPorExtensoBr(total);
    const partes = Array.isArray(p.partes) ? p.partes : [];
    const comValor = partes.filter((x) => Number(x.valor) > 0);
    const discriminadas = comValor.filter((x) => x.tipo && String(x.tipo) !== "—");
    let texto = `Recebemos de "${nome}" CPF "${cpf}" a importância de "${fmtMoney(total)} (${extTotal})" no dia "${dia}"`;
    if (discriminadas.length >= 2) {
      const ord = [...discriminadas].sort((a, b) => (a.tipoOrder ?? 0) - (b.tipoOrder ?? 0));
      const frag = ord.map((seg) => {
        const ex = portalValorReaisPorExtensoBr(Number(seg.valor));
        return `${fmtMoney(seg.valor)} (${ex}) em ${seg.tipo}`;
      });
      let comp;
      if (frag.length === 2) comp = `${frag[0]} e ${frag[1]}`;
      else comp = frag.slice(0, -1).join(", ") + " e " + frag[frag.length - 1];
      texto += ` sendo esse valor composto por: ${comp}.`;
    } else if (discriminadas.length === 1) {
      const seg = discriminadas[0];
      const ex = portalValorReaisPorExtensoBr(Number(seg.valor));
      texto += ` pago integralmente ${fmtMoney(seg.valor)} (${ex}) em ${seg.tipo}.`;
    } else {
      texto += ".";
    }
    return texto;
  }

  function closePortalReciboModal() {
    const modal = document.getElementById("portalReciboModal");
    if (modal) {
      modal.classList.add("hidden");
      modal.setAttribute("aria-hidden", "true");
    }
  }

  function portalInitReciboModalOnce() {
    if (window.__dkPortalReciboModalInit) return;
    window.__dkPortalReciboModalInit = true;
    document.getElementById("portalReciboFecharBtn")?.addEventListener("click", () => closePortalReciboModal());
    document.querySelectorAll("[data-close-recibo]").forEach((el) => {
      el.addEventListener("click", () => closePortalReciboModal());
    });
    document.getElementById("portalReciboPrintBtn")?.addEventListener("click", () => {
      window.print();
    });
    document.getElementById("portalReciboShareBtn")?.addEventListener("click", async () => {
      const corpo = document.getElementById("portalReciboCorpo");
      const texto = corpo ? String(corpo.innerText || "").trim() : "";
      if (!texto) return;
      try {
        if (typeof navigator.share === "function") {
          await navigator.share({ title: "Recibo de pagamento", text: texto });
          return;
        }
      } catch {
        /* utilizador cancelou ou share indisponível */
      }
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(texto);
          window.alert("Texto do recibo copiado.");
          return;
        }
      } catch {
        /* ignore */
      }
      window.prompt("Copie o texto do recibo:", texto);
    });
  }

  /** Abre o recibo no mesmo separador (modal), sem nova janela — evita bloqueio de pop-ups após postMessage do iframe do relatório. */
  function portalOpenReciboPagamentoWindow(payload) {
    if (!payload || typeof payload !== "object") return;
    portalInitReciboModalOnce();
    const texto = portalMontarTextoReciboPagamentoAluguel(payload);
    const corpo = document.getElementById("portalReciboCorpo");
    const modal = document.getElementById("portalReciboModal");
    if (corpo) corpo.textContent = texto;
    if (modal) {
      modal.classList.remove("hidden");
      modal.setAttribute("aria-hidden", "false");
    }
  }

  if (!window.__dkPortalReciboMsgBound) {
    window.__dkPortalReciboMsgBound = true;
    window.addEventListener("message", function (ev) {
      const d = ev.data;
      if (!d || d.type !== "dk-recibo-open" || !d.payload) return;
      portalOpenReciboPagamentoWindow(d.payload);
    });
  }

  /**
   * Relatório 1: todos os lançamentos de aluguel (portal) cuja data do pagamento cai no intervalo [início, fim], inclusive.
   * `inicioBr` / `fimBr`: strings DD/MM/AAAA (mesmo formato dos restantes campos do portal).
   */
  function getPortalRelatorioPagamentosPeriodoContext(inicioBr, fimBr) {
    const parse = typeof parseBrDate === "function" ? parseBrDate : null;
    const sIn = String(inicioBr || "").trim();
    const sFi = String(fimBr || "").trim();
    const d0 = parse ? parse(sIn) : null;
    const d1 = parse ? parse(sFi) : null;
    const invalid =
      !parse ||
      !d0 ||
      !d1 ||
      Number.isNaN(d0.getTime()) ||
      Number.isNaN(d1.getTime()) ||
      !sIn ||
      !sFi;
    const fmtBrl = (n) =>
      Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    if (invalid) {
      return {
        title: "Relatório 1 — Pagamentos por período",
        headerSubtitleLines: ["Informe data de início e fim válidas (DD/MM/AAAA)."],
        headers: [
          "CPF",
          "Cliente",
          "Placa",
          "Protocolo",
          "Cód. utilizador",
          "Data e hora do lançamento",
          "Data do pagamento",
          "Tipo",
          "Valor pago",
        ],
        rows: [],
        fileSlug: "pagamentos-periodo",
        textColumns: [0, 3, 4, 5, 6, 7],
        periodoInicioBr: sIn,
        periodoFimBr: sFi,
        totalRecebido: 0,
        excelMetaPairs: [
          ["Período", sIn && sFi ? `${sIn} a ${sFi}` : "—"],
          ["Total recebido no período", fmtBrl(0)],
        ],
      };
    }
    let startMs = new Date(d0.getFullYear(), d0.getMonth(), d0.getDate()).getTime();
    let endMs = new Date(d1.getFullYear(), d1.getMonth(), d1.getDate(), 23, 59, 59, 999).getTime();
    if (startMs > endMs) {
      const t = startMs;
      startMs = new Date(d1.getFullYear(), d1.getMonth(), d1.getDate()).getTime();
      endMs = new Date(d0.getFullYear(), d0.getMonth(), d0.getDate(), 23, 59, 59, 999).getTime();
    }
    const locs =
      typeof loadCadastro === "function" && typeof CAD_LOCACOES_KEY !== "undefined" ? loadCadastro(CAD_LOCACOES_KEY) : [];
    const dig =
      typeof onlyDigits === "function" ? (x) => onlyDigits(String(x || "")) : (x) => String(x || "").replace(/\D/g, "");
    const fmtCpf = typeof formatCpf === "function" ? formatCpf : (v) => String(v || "");
    const plateExib = (p) =>
      typeof normalizePlate === "function"
        ? normalizePlate(String(p || "")) || "—"
        : String(p || "").trim() || "—";

    const collected = [];
    for (const loc of locs || []) {
      const lancs = getPortalLancamentosAluguelDoContrato(loc);
      for (const lan of lancs) {
        const dp = parse(String(lan.data || "").trim());
        if (!dp || Number.isNaN(dp.getTime())) continue;
        const payMs = new Date(dp.getFullYear(), dp.getMonth(), dp.getDate()).getTime();
        if (payMs < startMs || payMs > endMs) continue;
        const cpfDigits = dig(loc.cpf);
        let nome = "";
        if (cpfDigits.length === 11 && typeof findClienteByCpfCadastro === "function") {
          nome = String(findClienteByCpfCadastro(cpfDigits)?.nome || "").trim();
        }
        const cpfExib = cpfDigits.length === 11 ? fmtCpf(cpfDigits) : String(loc.cpf || "").trim() || "—";
        const proto = String(loc.numeroContrato || "").trim() || "—";
        const dataPagamentoBr = String(lan.data || "").trim() || "—";
        const ca =
          typeof lan.createdAt === "number" && Number.isFinite(lan.createdAt) ? lan.createdAt : 0;
        const codigoUsuario =
          portalCodigoUsuarioRegistroLancamento(lan.registradoPorCpf, lan.registradoPorNome) || "—";
        const horaLancamento = formatPortalDataHoraLancamentoMs(ca);
        const partes = portalLancamentoAluguelPartesRelatorioPeriodo(lan);
        for (const parte of partes) {
          collected.push({
            cpfExib,
            nome: nome || "—",
            placa: plateExib(loc.placa),
            proto,
            dataPagamentoBr,
            valor: parte.valor,
            tipo: parte.tipo,
            tipoOrder: parte.tipoOrder,
            payMs,
            lancMs: ca,
            codigoUsuario,
            horaLancamento,
          });
        }
      }
    }
    collected.sort((a, b) => {
      const la = Number(a.lancMs || 0);
      const lb = Number(b.lancMs || 0);
      if (la !== lb) return lb - la;
      if (a.payMs !== b.payMs) return b.payMs - a.payMs;
      if (a.proto !== b.proto) return a.proto.localeCompare(b.proto, "pt-BR");
      if (a.cpfExib !== b.cpfExib) return a.cpfExib.localeCompare(b.cpfExib, "pt-BR");
      return (a.tipoOrder || 0) - (b.tipoOrder || 0);
    });
    const totalRecebido = collected.reduce((acc, r) => acc + r.valor, 0);
    const inicioFmt = formatPortalDataBr(new Date(startMs));
    const fimFmt = formatPortalDataBr(new Date(endMs));

    const groupKeyToReciboId = new Map();
    const reciboPayloadById = {};
    let nextRecId = 0;
    for (const r of collected) {
      const gkey = `${r.lancMs}|${r.cpfExib}|${r.proto}|${r.dataPagamentoBr}`;
      if (!groupKeyToReciboId.has(gkey)) {
        const id = String(nextRecId++);
        groupKeyToReciboId.set(gkey, id);
        reciboPayloadById[id] = {
          nome: r.nome,
          cpfExib: r.cpfExib,
          dataPagamentoBr: r.dataPagamentoBr,
          partes: [],
          totalNum: 0,
        };
      }
      const rid = groupKeyToReciboId.get(gkey);
      reciboPayloadById[rid].partes.push({
        tipo: r.tipo,
        valor: r.valor,
        tipoOrder: r.tipoOrder,
      });
    }
    Object.keys(reciboPayloadById).forEach((id) => {
      const p = reciboPayloadById[id];
      p.totalNum = p.partes.reduce((s, x) => s + Number(x.valor || 0), 0);
    });

    const rows = collected.map((r) => [
      r.cpfExib,
      r.nome,
      r.placa,
      r.proto,
      r.codigoUsuario,
      r.horaLancamento,
      r.dataPagamentoBr,
      r.tipo,
      fmtBrl(r.valor),
    ]);
    return {
      title: "Relatório 1 — Pagamentos por período",
      headerSubtitleLines: [
        `Período: ${inicioFmt} a ${fimFmt}`,
        `Total recebido no período: ${fmtBrl(totalRecebido)}`,
      ],
      headers: [
        "CPF",
        "Cliente",
        "Placa",
        "Protocolo",
        "Cód. utilizador",
        "Data e hora do lançamento",
        "Data do pagamento",
        "Tipo",
        "Valor pago",
      ],
      rows,
      fileSlug: "pagamentos-periodo",
      textColumns: [0, 3, 4, 5, 6, 7],
      periodoInicioBr: sIn,
      periodoFimBr: sFi,
      totalRecebido,
      excelMetaPairs: [
        ["Período", `${inicioFmt} a ${fimFmt}`],
        ["Total recebido no período", fmtBrl(totalRecebido)],
      ],
      buildPdfHtml: () => {
        const quando = new Date().toLocaleString("pt-BR");
        const eh = typeof escapeHtml === "function" ? escapeHtml : portalEscapeHtml;
        const titulo = "Relatório 1 — Pagamentos por período";
        const headersPdf = [
          "CPF",
          "Cliente",
          "Placa",
          "Protocolo",
          "Cód. utilizador",
          "Data e hora do lançamento",
          "Data do pagamento",
          "Tipo",
          "Valor pago",
        ];
        const rowsPdf = collected.map((r) => {
          const gkey = `${r.lancMs}|${r.cpfExib}|${r.proto}|${r.dataPagamentoBr}`;
          const rid = groupKeyToReciboId.get(gkey) ?? "";
          const link = `<a href="#" class="portal-recibo-link" data-recibo-id="${eh(rid)}">${eh(r.horaLancamento)}</a>`;
          return [r.cpfExib, r.nome, r.placa, r.proto, r.codigoUsuario, link, r.dataPagamentoBr, eh(String(r.tipo)), fmtBrl(r.valor)];
        });
        const extraMeta = [`Período: ${inicioFmt} a ${fimFmt}`, `Total recebido no período: ${fmtBrl(totalRecebido)}`]
          .map((line) => `<p class="meta"><strong>${eh(line)}</strong></p>`)
          .join("");
        const headCells = headersPdf.map((h) => `<th>${eh(h)}</th>`).join("");
        const bodyCells = rowsPdf
          .map((row) => `<tr>${row.map((c) => `<td>${c}</td>`).join("")}</tr>`)
          .join("");
        const jsonEsc = JSON.stringify(reciboPayloadById).replace(/</g, "\\u003c");
        return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><title>${eh(titulo)}</title><style>
      body{font-family:system-ui,-apple-system,sans-serif;margin:1.2rem;color:#111;font-size:12px}
      h1{font-size:1.05rem;margin:0 0 0.35rem}
      .meta{color:#444;margin:0.2rem 0;font-size:11px}
      table{width:100%;border-collapse:collapse}
      th,td{border:1px solid #333;padding:5px 7px;text-align:left}
      th{background:#eee;font-weight:600}
      .portal-recibo-link{color:#0d47a1;text-decoration:underline;cursor:pointer;font-weight:600}
    </style></head><body>
      <h1>${eh(titulo)}</h1>
      ${extraMeta}
      <p class="meta">Emitido em ${eh(quando)} · ${eh(String(rowsPdf.length))} registro(s) · Clique na <strong>data e hora do lançamento</strong> para gerar o recibo.</p>
      <table><thead><tr>${headCells}</tr></thead><tbody>${bodyCells || `<tr><td colspan="9">${eh("Nenhum registo.")}</td></tr>`}</tbody></table>
      <script type="application/json" id="dk-recibos-json">${jsonEsc}</script>
      <script>
      (function(){
        document.body.addEventListener("click", function(e){
          var a = e.target && e.target.closest && e.target.closest("a.portal-recibo-link");
          if(!a) return;
          e.preventDefault();
          try {
            var raw = document.getElementById("dk-recibos-json").textContent;
            var all = JSON.parse(raw);
            var id = a.getAttribute("data-recibo-id");
            var payload = all[id];
            if(payload && window.parent) window.parent.postMessage({ type: "dk-recibo-open", payload: payload }, "*");
          } catch(err) {}
        });
      })();
      <\/script>
    </body></html>`;
      },
    };
  }

  /** Relatório 2: por CPF, agrupa por protocolo — lista de pagamentos e resumo do protocolo (aligned ao cadastro locação). */
  function getPortalRelatorioClienteProtocolosContext(cpfDigitsRaw) {
    const digFn =
      typeof onlyDigits === "function" ? onlyDigits : (s) => String(s ?? "").replace(/\D/g, "");
    const dig = digFn(String(cpfDigitsRaw || ""));
    const fmtCpf = typeof formatCpf === "function" ? formatCpf : (v) => String(v || "");
    const nome =
      dig.length === 11 && typeof findClienteByCpfCadastro === "function"
        ? String(findClienteByCpfCadastro(dig)?.nome || "").trim()
        : "";
    const cpfExib = dig.length === 11 ? fmtCpf(dig) : dig || "—";
    const quando = new Date().toLocaleString("pt-BR");
    const plateExib = (p) =>
      typeof normalizePlate === "function"
        ? normalizePlate(String(p || "")) || "—"
        : String(p || "").trim() || "—";
    const parseD = typeof parseBrDate === "function" ? parseBrDate : () => null;

    const buildEmpty = (subtitle) => ({
      title: "Relatório 2 — Por cliente",
      fileSlug: "relatorio-cliente-protocolos",
      relatorioClienteCpfDigits: dig,
      stats: { protocolos: 0, pagamentos: 0 },
      headerSubtitleLines: subtitle ? [subtitle] : [],
      headers: ["Data do pagamento", "Valor"],
      rows: [],
      buildPdfHtml: () =>
        buildPortalRelatorioClienteProtocolosPdfHtml({
          tituloRelatorio: "Relatório 2 — Por cliente",
          mensagemVazio: "Nenhuma locação com protocolo encontrada para este CPF.",
          linhasMetaCabecalho: [`CPF: ${cpfExib}`, `Cliente: ${nome || "—"}`],
          cpfLabel: cpfExib,
          nomeCliente: nome || "—",
          sections: [],
          quando,
        }),
      buildExcelHtml: () =>
        buildPortalRelatorioClienteProtocolosExcelHtml({
          tituloRelatorio: "Relatório 2 — Por cliente",
          mensagemVazio: "Nenhuma locação com protocolo encontrada para este CPF.",
          cabecalhoPares: [
            ["CPF", cpfExib],
            ["Cliente", nome || "—"],
          ],
          sections: [],
        }),
    });

    if (dig.length !== 11) {
      const ctx = buildEmpty("Informe um CPF válido (11 dígitos).");
      ctx.buildPdfHtml = () =>
        `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><title>Relatório 2</title></head><body style="font-family:system-ui,sans-serif;padding:1rem"><h1>Relatório 2 — Por cliente</h1><p>Informe um CPF válido (11 dígitos).</p></body></html>`;
      ctx.buildExcelHtml = () =>
        `<html><head><meta charset="utf-8"></head><body><p>Informe um CPF válido (11 dígitos).</p></body></html>`;
      return ctx;
    }

    const locs = collectPortalLocacoesComProtocoloByCpf(dig);
    locs.sort((a, b) => String(a.numeroContrato || "").localeCompare(String(b.numeroContrato || ""), "pt-BR"));
    const sections = locs.map((loc) => {
      const proto = String(loc.numeroContrato || "").trim() || "—";
      const lancsRaw = getPortalLancamentosAluguelDoContrato(loc);
      const lancs = lancsRaw.slice().sort((a, b) => {
        const da = parseD(String(a.data || ""));
        const db = parseD(String(b.data || ""));
        const ta = da && !Number.isNaN(da.getTime()) ? da.getTime() : 0;
        const tb = db && !Number.isNaN(db.getTime()) ? db.getTime() : 0;
        if (ta !== tb) return ta - tb;
        return Number(a.createdAt || 0) - Number(b.createdAt || 0);
      });
      return {
        loc,
        proto,
        placa: plateExib(loc.placa),
        lancs,
        resumo: computePortalProtocoloResumoFromLoc(loc),
      };
    });
    const totalPagamentos = sections.reduce((acc, s) => acc + s.lancs.length, 0);
    return {
      title: "Relatório 2 — Por cliente",
      fileSlug: "relatorio-cliente-protocolos",
      relatorioClienteCpfDigits: dig,
      stats: { protocolos: sections.length, pagamentos: totalPagamentos },
      headerSubtitleLines: [`CPF: ${cpfExib}`, nome ? `Cliente: ${nome}` : ""].filter(Boolean),
      headers: ["Data do pagamento", "Valor"],
      rows: [],
      excelMetaPairs: [
        ["CPF", cpfExib],
        ["Cliente", nome || "—"],
        ["Protocolos", String(sections.length)],
        ["Pagamentos listados", String(totalPagamentos)],
      ],
      buildPdfHtml: () =>
        buildPortalRelatorioClienteProtocolosPdfHtml({
          tituloRelatorio: "Relatório 2 — Por cliente",
          mensagemVazio: "Nenhuma locação com protocolo encontrada para este CPF.",
          linhasMetaCabecalho: [`CPF: ${cpfExib}`, `Cliente: ${nome || "—"}`],
          cpfLabel: cpfExib,
          nomeCliente: nome || "—",
          sections,
          quando,
        }),
      buildExcelHtml: () =>
        buildPortalRelatorioClienteProtocolosExcelHtml({
          tituloRelatorio: "Relatório 2 — Por cliente",
          mensagemVazio: "Nenhuma locação com protocolo encontrada para este CPF.",
          cabecalhoPares: [
            ["CPF", cpfExib],
            ["Cliente", nome || "—"],
          ],
          sections,
        }),
    };
  }

  function collectPortalLocacoesComProtocoloByPlaca(plateNorm) {
    const np =
      typeof normalizePlate === "function"
        ? (x) => normalizePlate(String(x || ""))
        : (x) => String(x || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    const want = String(plateNorm || "").trim();
    if (!want) return [];
    if (typeof loadCadastro !== "function" || typeof CAD_LOCACOES_KEY === "undefined") return [];
    return loadCadastro(CAD_LOCACOES_KEY).filter((l) => {
      if (!normPortalNumeroContrato(l.numeroContrato)) return false;
      return np(l.placa) === want;
    });
  }

  /** Relatório 3: por placa normalizada; mesma estrutura que «por cliente» (protocolos + pagamentos + resumo). */
  function getPortalRelatorioPlacaProtocolosContext(plateNormRaw) {
    const np =
      typeof normalizePlate === "function"
        ? (x) => normalizePlate(String(x || ""))
        : (x) => String(x || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    const norm = np(String(plateNormRaw || ""));
    const quando = new Date().toLocaleString("pt-BR");
    const plateExibFn = (p) =>
      typeof normalizePlate === "function"
        ? normalizePlate(String(p || "")) || "—"
        : String(p || "").trim() || "—";
    const parseD = typeof parseBrDate === "function" ? parseBrDate : () => null;
    const digFn =
      typeof onlyDigits === "function" ? onlyDigits : (s) => String(s ?? "").replace(/\D/g, "");
    const fmtCpfFn = typeof formatCpf === "function" ? formatCpf : (v) => String(v || "");

    if (!norm) {
      return {
        title: "Relatório 3 — Por placa",
        fileSlug: "relatorio-placa-protocolos",
        relatorioPlacaNorm: "",
        stats: { protocolos: 0, pagamentos: 0 },
        headerSubtitleLines: ["Informe a placa do veículo."],
        headers: ["Data do pagamento", "Valor"],
        rows: [],
        buildPdfHtml: () =>
          `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><title>Relatório 3</title></head><body style="font-family:system-ui,sans-serif;padding:1rem"><h1>Relatório 3 — Por placa</h1><p>Informe a placa do veículo.</p></body></html>`,
        buildExcelHtml: () =>
          `<html><head><meta charset="utf-8"></head><body><p>Informe a placa do veículo.</p></body></html>`,
      };
    }

    const locs = collectPortalLocacoesComProtocoloByPlaca(norm);
    locs.sort((a, b) => String(a.numeroContrato || "").localeCompare(String(b.numeroContrato || ""), "pt-BR"));
    const sections = locs.map((loc) => {
      const proto = String(loc.numeroContrato || "").trim() || "—";
      const lancsRaw = getPortalLancamentosAluguelDoContrato(loc);
      const lancs = lancsRaw.slice().sort((a, b) => {
        const da = parseD(String(a.data || ""));
        const db = parseD(String(b.data || ""));
        const ta = da && !Number.isNaN(da.getTime()) ? da.getTime() : 0;
        const tb = db && !Number.isNaN(db.getTime()) ? db.getTime() : 0;
        if (ta !== tb) return ta - tb;
        return Number(a.createdAt || 0) - Number(b.createdAt || 0);
      });
      const cpfDigits = digFn(String(loc.cpf || ""));
      const cpfExib =
        cpfDigits.length === 11 ? fmtCpfFn(cpfDigits) : cpfDigits ? cpfDigits : "—";
      let nomeClienteSec = "";
      if (cpfDigits.length === 11 && typeof findClienteByCpfCadastro === "function") {
        nomeClienteSec = String(findClienteByCpfCadastro(cpfDigits)?.nome || "").trim();
      }
      if (!nomeClienteSec) nomeClienteSec = String(loc.cliente || "").trim();
      if (!nomeClienteSec) nomeClienteSec = "—";
      return {
        loc,
        proto,
        placa: plateExibFn(loc.placa),
        cpfExib,
        nomeClienteSec,
        lancs,
        resumo: computePortalProtocoloResumoFromLoc(loc),
      };
    });
    const totalPagamentos = sections.reduce((acc, s) => acc + s.lancs.length, 0);
    return {
      title: "Relatório 3 — Por placa",
      fileSlug: "relatorio-placa-protocolos",
      relatorioPlacaNorm: norm,
      stats: { protocolos: sections.length, pagamentos: totalPagamentos },
      headerSubtitleLines: [`Placa: ${norm}`],
      headers: ["Data do pagamento", "Valor"],
      rows: [],
      excelMetaPairs: [
        ["Placa", norm],
        ["Protocolos", String(sections.length)],
        ["Pagamentos listados", String(totalPagamentos)],
      ],
      buildPdfHtml: () =>
        buildPortalRelatorioClienteProtocolosPdfHtml({
          tituloRelatorio: "Relatório 3 — Por placa",
          mensagemVazio: "Nenhuma locação com protocolo encontrada para esta placa.",
          linhasMetaCabecalho: [`Placa: ${norm}`],
          cpfLabel: "—",
          nomeCliente: "—",
          sections,
          quando,
          tituloProtocoloSecao: (sec) =>
            `Protocolo ${sec.proto} · CPF ${sec.cpfExib} · ${sec.nomeClienteSec}`,
        }),
      buildExcelHtml: () =>
        buildPortalRelatorioClienteProtocolosExcelHtml({
          tituloRelatorio: "Relatório 3 — Por placa",
          mensagemVazio: "Nenhuma locação com protocolo encontrada para esta placa.",
          cabecalhoPares: [["Placa", norm]],
          sections,
          tituloProtocoloSecao: (sec) =>
            `Protocolo ${sec.proto} · CPF ${sec.cpfExib} · ${sec.nomeClienteSec}`,
        }),
    };
  }

  /** Sempre relê o cadastro no navegador — evita PDF/Excel com dados antigos se o operador guardou algo depois de abrir o modal. */
  function getPortalRelatorioContextFresh(anchor) {
    const slug = anchor && anchor.fileSlug;
    if (slug === "clientes") return getPortalRelatorioClienteContext();
    if (slug === "veiculos") return getPortalRelatorioVeiculoContext();
    if (slug === "locacoes") return getPortalRelatorioLocacaoContext();
    if (slug === "pagamentos-periodo") {
      return getPortalRelatorioPagamentosPeriodoContext(anchor.periodoInicioBr, anchor.periodoFimBr);
    }
    if (slug === "relatorio-cliente-protocolos") {
      return getPortalRelatorioClienteProtocolosContext(anchor.relatorioClienteCpfDigits);
    }
    if (slug === "relatorio-placa-protocolos") {
      return getPortalRelatorioPlacaProtocolosContext(anchor.relatorioPlacaNorm);
    }
    return anchor;
  }

  function emitPortalRelatorioLocacaoPdf(escopo) {
    const titulo =
      escopo === "ativas" ? "Locações de motos — ativas" : "Locações de motos — finalizadas";
    const raw = sortPortalLocacoesPorUltimaDataDesc(getPortalMotosLocacaoDataset(escopo));
    const rows = raw.map(rowPortalRelatorioLocacao);
    const headers = [
      "Protocolo",
      "CPF",
      "Cliente",
      "Placa",
      "Modelo",
      "Início",
      "Execução",
      "Fim",
      "Finalização",
      "Plano",
      "Status",
      "Modalidade",
    ];
    const eh = typeof escapeHtml === "function" ? escapeHtml : portalEscapeHtml;
    const statusIdx = 10;
    const statusFn =
      typeof isPortalRelatorioStatusCellAtivo === "function" ? isPortalRelatorioStatusCellAtivo : null;
    const headCells = headers.map((h) => `<th>${eh(h)}</th>`).join("");
    const bodyCells = rows
      .map((row) => {
        const tds = row
          .map((c, ci) => {
            let tdExtra = "";
            if (statusFn && statusIdx === ci) {
              tdExtra = statusFn(String(c ?? "")) ? ' class="portal-rel-status-ativo"' : ' class="portal-rel-status-inativo"';
            }
            return `<td${tdExtra}>${eh(c)}</td>`;
          })
          .join("");
        return `<tr>${tds}</tr>`;
      })
      .join("");
    const quando = new Date().toLocaleString("pt-BR");
    const ativosMotos = statusFn
      ? countPortalRelatorioRowsStatusAtivos(rows, statusIdx, statusFn)
      : 0;
    const metaAtivosMotos =
      statusFn && typeof statusIdx === "number"
        ? ` sendo ${eh(String(ativosMotos))} registros ativos.`
        : "";
    let html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><title>${eh(
      titulo
    )}</title><style>
      body{font-family:system-ui,-apple-system,sans-serif;margin:1.2rem;color:#111;font-size:12px}
      h1{font-size:1.05rem;margin:0 0 0.35rem}
      .meta{color:#444;margin:0 0 0.75rem;font-size:11px}
      table{width:100%;border-collapse:collapse}
      th,td{border:1px solid #333;padding:5px 7px;text-align:left}
      th{background:#eee;font-weight:600}
      .portal-rel-status-ativo{background:#c8e6c9}
      .portal-rel-status-inativo{background:#fff9c4}
    </style></head><body>
      <h1>${eh(titulo)}</h1>
      <p class="meta">Emitido em ${eh(quando)} · ${eh(String(rows.length))} registro(s)${metaAtivosMotos}</p>
      <table><thead><tr>${headCells}</tr></thead><tbody>${bodyCells || `<tr><td colspan="${headers.length}">${eh(
        "Nenhum registo neste filtro."
      )}</td></tr>`}</tbody></table>
    </body></html>`;

    const locTituloBase =
      escopo === "ativas"
        ? "relatorio locacoes motos ativas"
        : "relatorio locacoes motos finalizadas";
    html = applyPortalPdfDocumentTitle(html, locTituloBase);

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
    const raw = sortPortalLocacoesPorUltimaDataDesc(getPortalMotosLocacaoDataset(escopo));
    const rows = raw.map(rowPortalRelatorioLocacao);
    const headers = [
      "Protocolo",
      "CPF",
      "Cliente",
      "Placa",
      "Modelo",
      "Início",
      "Execução",
      "Fim",
      "Finalização",
      "Plano",
      "Status",
      "Modalidade",
    ];
    const d = new Date();
    const fileBase =
      escopo === "ativas"
        ? sanitizePortalPdfFilenameBase("relatorio locacoes motos ativas")
        : sanitizePortalPdfFilenameBase("relatorio locacoes motos finalizadas");
    const metaLines = [
      ["Relatório", label],
      ["Emitido em", d.toLocaleString("pt-BR")],
      ["Registos", String(rows.length)],
    ];
    downloadStyledExcel(fileBase, headers, rows, metaLines, {
      textColumns: [0, 1, 3],
      statusColumnIndex: 10,
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

  document.getElementById("operacaoLocacaoFinalizarBtn")?.addEventListener("click", (e) => {
    e.preventDefault();
    persistPortalLocacaoFinalizar();
  });

  document.getElementById("portalRelClienteGerarBtn")?.addEventListener("click", (e) => {
    e.preventDefault();
    const msg = document.getElementById("operacaoLancAluguelInlineMsg");
    const inp = document.getElementById("portalRelClienteCpf");
    const raw = String(inp?.value || "").trim();
    const digits =
      typeof onlyDigits === "function" ? onlyDigits(raw) : String(raw || "").replace(/\D/g, "");
    if (digits.length !== 11) {
      if (msg) msg.textContent = "Informe um CPF completo (11 dígitos) para o relatório por cliente.";
      openPortalRelatorioModal(getPortalRelatorioClienteProtocolosContext(raw));
      return;
    }
    const ctx = getPortalRelatorioClienteProtocolosContext(digits);
    if (msg) {
      msg.textContent = ctx.stats.pagamentos
        ? `Relatório 2: ${ctx.stats.protocolos} protocolo(s), ${ctx.stats.pagamentos} pagamento(s).`
        : "Relatório 2: nenhuma locação com protocolo para este CPF.";
    }
    openPortalRelatorioModal(ctx);
  });

  document.getElementById("portalRelPlacaGerarBtn")?.addEventListener("click", (e) => {
    e.preventDefault();
    const msg = document.getElementById("operacaoLancAluguelInlineMsg");
    const inp = document.getElementById("portalRelPlaca");
    const raw = String(inp?.value || "").trim();
    const norm =
      typeof normalizePlate === "function"
        ? normalizePlate(raw)
        : String(raw || "")
            .toUpperCase()
            .replace(/[^A-Z0-9]/g, "");
    if (!norm) {
      if (msg) msg.textContent = "Informe a placa do veículo para o relatório por placa.";
      openPortalRelatorioModal(getPortalRelatorioPlacaProtocolosContext(""));
      return;
    }
    const ctx = getPortalRelatorioPlacaProtocolosContext(norm);
    if (msg) {
      msg.textContent = ctx.stats.pagamentos
        ? `Relatório 3: ${ctx.stats.protocolos} protocolo(s), ${ctx.stats.pagamentos} pagamento(s).`
        : "Relatório 3: nenhuma locação com protocolo para esta placa.";
    }
    openPortalRelatorioModal(ctx);
  });

  document.getElementById("portalRelPagamentosGerarBtn")?.addEventListener("click", (e) => {
    e.preventDefault();
    const msg = document.getElementById("operacaoLancAluguelInlineMsg");
    const inicio = String(document.getElementById("portalRelPagamentosInicio")?.value || "").trim();
    const fim = String(document.getElementById("portalRelPagamentosFim")?.value || "").trim();
    if (!inicio || !fim) {
      if (msg) msg.textContent = "Informe a data de início e a data de fim do relatório (DD/MM/AAAA).";
      return;
    }
    const ctx = getPortalRelatorioPagamentosPeriodoContext(inicio, fim);
    const parse = typeof parseBrDate === "function" ? parseBrDate : null;
    const ok =
      parse &&
      parse(inicio) &&
      parse(fim) &&
      !Number.isNaN(parse(inicio).getTime()) &&
      !Number.isNaN(parse(fim).getTime());
    if (!ok) {
      if (msg) msg.textContent = "Datas inválidas. Use o formato DD/MM/AAAA.";
      openPortalRelatorioModal(ctx);
      return;
    }
    if (msg) {
      msg.textContent = ctx.rows.length
        ? `Relatório: ${ctx.rows.length} pagamento(s) no período.`
        : "Nenhum pagamento registado nesse período (datas de pagamento dos lançamentos).";
    }
    openPortalRelatorioModal(ctx);
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
    portalWaHideAllDropdowns();
    resetOperacaoLocacaoRelatorioPanel();
    document.getElementById("operacaoInlineWhatsApp")?.classList.add("hidden");
    document.getElementById("operacaoInlineCliente")?.classList.add("hidden");
    document.getElementById("operacaoInlineVeiculo")?.classList.add("hidden");
    document.getElementById("operacaoInlineLocacao")?.classList.add("hidden");
    document.getElementById("operacaoInlineLancamentoAluguel")?.classList.add("hidden");
    document.getElementById("operacaoInlineColaborador")?.classList.add("hidden");
  }

  function setOperacaoFormPlaceholderVisible(visible) {
    const el = document.getElementById("operacaoFormPlaceholder");
    if (!el) return;
    el.classList.toggle("hidden", !visible);
    el.setAttribute("aria-hidden", visible ? "false" : "true");
  }

  function syncOperacaoCadastroButtons(activeButtonId) {
    [
      "btn-operacao-falar-cliente",
      "btn-operacao-cadastro-cliente",
      "btn-operacao-cadastro-veiculo",
      "btn-operacao-cadastro-locacao",
      "btn-operacao-lancamento-aluguel",
      "btn-operacao-cadastro-colaborador",
    ].forEach((id) => {
      const b = document.getElementById(id);
      if (!b) return;
      const on = Boolean(activeButtonId && id === activeButtonId);
      b.classList.toggle("is-active", on);
      b.setAttribute("aria-expanded", on ? "true" : "false");
    });
  }

  function portalPushCloudSnapshotAfterPersist() {
    if (typeof window.__DK_pushCloudSnapshotNow !== "function") return;
    window.__DK_pushCloudSnapshotNow().catch((err) => {
      console.warn("[DK portal] enviar snapshot nuvem", err);
    });
  }

  function portalRefreshOperacaoDadosAposNuvem() {
    try {
      refreshOperacaoLocacaoDatalists();
      refreshOperacaoLocacaoProtocoloPicker({ force: true });
      refreshPortalRelClienteCpfDatalist();
      refreshPortalRelPlacaDatalist();
      refreshOperacaoLancamentoAluguelCpfDatalist();
      const waPanel = document.getElementById("operacaoInlineWhatsApp");
      if (waPanel && !waPanel.classList.contains("hidden")) {
        portalWaRebuildDatasetCache();
      }
    } catch (e) {
      console.warn("[DK portal] refresh após nuvem", e);
    }
  }

  /** Redis/API + snapshot Supabase (merge) antes de mostrar outro formulário. */
  async function portalOperacaoAwaitCloudCadastroPull() {
    try {
      if (typeof window.__DK_portalPullCadastroFromCloud === "function") {
        await window.__DK_portalPullCadastroFromCloud();
      }
      if (typeof window.__DK_pullCloudSnapshotSilentMerge === "function") {
        await window.__DK_pullCloudSnapshotSilentMerge();
      }
    } catch (e) {
      console.warn("[DK portal] cadastro pull ao mudar tela", e);
    }
    portalRefreshOperacaoDadosAposNuvem();
    setPortalUnitDadosAtualizadosAgora();
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
      const dig =
        typeof onlyDigits === "function" ? onlyDigits : (s) => String(s ?? "").replace(/\D/g, "");
      const prefix = dig(prevCpf).slice(0, 11);
      let candidatos = getLancamentoClienteCandidates();
      if (prefix.length) {
        candidatos = candidatos.filter((c) => dig(String(c.cpf || "")).startsWith(prefix));
      }
      candidatos = candidatos.slice(0, 200);
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

  /** Durante a digitação: só dígitos (até 8) → barras automáticas DD/MM/AAAA. */
  function formatPortalInputDateDdMmYyyy(raw) {
    const dig = String(raw ?? "").replace(/\D/g, "").slice(0, 8);
    if (dig.length <= 2) return dig;
    if (dig.length <= 4) return `${dig.slice(0, 2)}/${dig.slice(2)}`;
    return `${dig.slice(0, 2)}/${dig.slice(2, 4)}/${dig.slice(4)}`;
  }

  const PORTAL_DATE_DDMMYYYY_INPUT_IDS = [
    "operacaoClienteDataCadastro",
    "operacaoClienteVencimento",
    "operacaoLocacaoDataInicio",
    "operacaoLocacaoDataFim",
    "operacaoLancAluguelDataPagamento",
    "portalLancAluguelEditData",
    "portalRelPagamentosInicio",
    "portalRelPagamentosFim",
    "portalColabIngresso",
  ];

  function bindPortalDateDdMmYyyyInputs() {
    PORTAL_DATE_DDMMYYYY_INPUT_IDS.forEach((id) => {
      const el = document.getElementById(id);
      if (!el || el.readOnly || el.disabled) return;
      const apply = () => {
        el.value = formatPortalInputDateDdMmYyyy(el.value);
      };
      el.addEventListener("input", apply);
      el.addEventListener("blur", apply);
    });
  }

  function normalizePortalDateInputsExistingValues() {
    PORTAL_DATE_DDMMYYYY_INPUT_IDS.forEach((id) => {
      const el = document.getElementById(id);
      if (!el || el.readOnly || el.disabled) return;
      const v = String(el.value || "").trim();
      if (v) el.value = formatPortalInputDateDdMmYyyy(v);
    });
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
    syncOperacaoLocacaoValorDevidoAluguel();
    refreshOperacaoLocacaoFinalizarBtn();
  }

  /** Habilita «Finalizar locação» com data fim válida e protocolo já existente (não NOVO). */
  function refreshOperacaoLocacaoFinalizarBtn() {
    const btn = document.getElementById("operacaoLocacaoFinalizarBtn");
    const inp = document.getElementById("operacaoLocacaoDataFim");
    const sel = document.getElementById("operacaoLocacaoProtocoloSelect");
    if (!btn || !inp) return;
    const raw = String(inp.value || "").trim();
    let okDate = false;
    if (raw.length >= 8 && typeof parseBrDate === "function") {
      const d = parseBrDate(raw);
      okDate = Boolean(d && !Number.isNaN(d.getTime()));
    }
    const isNovo = sel && String(sel.value || "") === "__PORTAL_PROTO_NOVO__";
    const can = okDate && !isNovo;
    btn.disabled = !can;
    if (!can) {
      btn.title = isNovo
        ? "Selecione um protocolo já cadastrado (não «NOVO»)."
        : "Informe a data fim completa (DD/MM/AAAA).";
    } else {
      btn.title = "Gravar data fim e marcar a locação como finalizada.";
    }
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

  /** Valor devido do aluguel = (valor do aluguel ÷ 7) × tempo em dias do contrato. Campo só leitura. */
  function syncOperacaoLocacaoValorDevidoAluguel() {
    const inpDevido = document.getElementById("operacaoLocacaoValorDevidoAluguel");
    const inpTempo = document.getElementById("operacaoLocacaoTempoDias");
    const inpLoc = document.getElementById("operacaoLocacaoValorAluguel");
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
    const loc = Number(parse(inpLoc?.value ?? ""));
    const tempoStr = String(inpTempo?.value ?? "").trim();
    const tempo = tempoStr === "" ? 0 : Math.max(0, Number.parseInt(tempoStr, 10) || 0);
    const devido = tempo * (loc / 7);
    if (typeof currencyBRL === "function") {
      inpDevido.value = currencyBRL(devido);
    } else {
      inpDevido.value = Number(devido || 0).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
      });
    }
    syncOperacaoLocacaoInvestimentoAcumuladoEAlertaDevido();
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
    fillOperacaoLocacaoTotaisLancamentoPortal(loc);
  }

  function clearPortalLocacaoCamposParaNovoContrato() {
    ["operacaoLocacaoPlaca", "operacaoLocacaoModelo", "operacaoLocacaoDataFim"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.value = "";
    });
    const tp = document.getElementById("operacaoLocacaoTotalPago");
    const tp2025 = document.getElementById("operacaoLocacaoTotalPagoAno2025");
    if (tp) tp.value = formatOperacaoLocacaoValorNumDisplay(0);
    if (tp2025) tp2025.value = formatOperacaoLocacaoValorNumDisplay(0);
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

  function normPortalNumeroContrato(x) {
    return typeof normalizeNumeroContratoKey === "function"
      ? normalizeNumeroContratoKey(x || "")
      : String(x || "").trim();
  }

  function persistPortalLocacaoFinalizar() {
    const msg = document.getElementById("operacaoLocacaoInlineMsg");
    if (
      typeof loadCadastro !== "function" ||
      typeof saveCadastro !== "function" ||
      typeof CAD_LOCACOES_KEY === "undefined"
    ) {
      if (msg) msg.textContent = "Cadastro indisponível neste ambiente.";
      return;
    }
    const sel = document.getElementById("operacaoLocacaoProtocoloSelect");
    if (!sel || String(sel.value || "") === "__PORTAL_PROTO_NOVO__") {
      if (msg) msg.textContent = "Selecione um protocolo já cadastrado para finalizar.";
      return;
    }
    const hid = document.getElementById("operacaoLocacaoProtocolo");
    const ncNorm = normPortalNumeroContrato(String(hid?.value || ""));
    if (!ncNorm) {
      if (msg) msg.textContent = "Protocolo inválido.";
      return;
    }
    const inpCpf = document.getElementById("operacaoLocacaoCpf");
    const dig =
      typeof onlyDigits === "function" ? onlyDigits : (s) => String(s ?? "").replace(/\D/g, "");
    const cpfDigits = dig(String(inpCpf?.value || ""));
    if (cpfDigits.length !== 11) {
      if (msg) msg.textContent = "Informe um CPF cadastrado (11 dígitos).";
      return;
    }
    const rawFim = String(document.getElementById("operacaoLocacaoDataFim")?.value || "").trim();
    const fimDt = typeof parseBrDate === "function" ? parseBrDate(rawFim) : null;
    if (!fimDt || Number.isNaN(fimDt.getTime())) {
      if (msg) msg.textContent = "Informe a data fim válida (DD/MM/AAAA).";
      return;
    }
    const fimBr = formatPortalDataBr(fimDt);

    const locs = loadCadastro(CAD_LOCACOES_KEY);
    const idx = locs.findIndex(
      (l) => dig(String(l.cpf || "")) === cpfDigits && normPortalNumeroContrato(l.numeroContrato) === ncNorm
    );
    if (idx === -1) {
      if (msg) msg.textContent = "Locação não encontrada na base deste navegador.";
      return;
    }
    if (
      !window.confirm(`Finalizar a locação ${ncNorm} com data fim ${fimBr}? O estado será marcado como finalizado.`)
    ) {
      return;
    }

    const prev = locs[idx];
    const regFin = getPortalSessaoParaRegistroLancamentoAluguel();
    const finCpf = String(regFin?.cpf || "").replace(/\D/g, "").slice(0, 11);
    const finNow = Date.now();
    locs[idx] = {
      ...prev,
      fim: fimBr,
      statusLocacao: "FINALIZADO",
      portalLocacaoFinalizadoPorCpf: finCpf,
      portalLocacaoFinalizadoPorNome: String(regFin?.nome || "").trim(),
      portalLocacaoFinalizadoEmMs: finNow,
      updatedAt: finNow,
    };
    try {
      saveCadastro(CAD_LOCACOES_KEY, locs);
    } catch (err) {
      console.error(err);
      if (msg) msg.textContent = `Não foi possível guardar: ${err && err.message ? err.message : err}.`;
      return;
    }
    portalPushCloudSnapshotAfterPersist();
    if (typeof addAuditLog === "function") {
      try {
        addAuditLog("finalizar_locacao_portal", "locacao", `${ncNorm} · CPF ${cpfDigits} · fim ${fimBr}`);
      } catch {
        /* ignore */
      }
    }
    if (msg) msg.textContent = "Locação finalizada e guardada.";
    refreshOperacaoLocacaoProtocoloPicker({ force: true });
    applyPortalLocacaoRowFromRecord(locs[idx]);
    refreshOperacaoLocacaoDatalists();
    refreshOperacaoLocacaoFinalizarBtn();
  }

  /** Cadastro de veículo no portal (Receita 2026) — envia snapshot à nuvem após guardar. */
  function persistPortalOperacaoVeiculoInlineSubmit(ev) {
    ev.preventDefault();
    const msg = document.getElementById("operacaoVeiculoInlineMsg");
    if (
      typeof loadCadastro !== "function" ||
      typeof saveCadastro !== "function" ||
      typeof CAD_VEICULOS_KEY === "undefined"
    ) {
      if (msg) msg.textContent = "Cadastro indisponível neste ambiente.";
      return;
    }
    if (typeof seedVeiculosDatabaseIfNeeded === "function") seedVeiculosDatabaseIfNeeded();
    const getVal = (id) => String(document.getElementById(id)?.value || "").trim();
    const plateRaw = getVal("operacaoVeiculoPlaca");
    const plate =
      typeof normalizePlate === "function"
        ? normalizePlate(plateRaw)
        : String(plateRaw || "")
            .toUpperCase()
            .replace(/[^A-Z0-9]/g, "");
    const modelo = getVal("operacaoVeiculoModelo");
    if (!plate || !modelo) {
      if (msg) msg.textContent = "Informe placa e modelo.";
      return;
    }
    const marca = getVal("operacaoVeiculoMarca");
    const valor = getVal("operacaoVeiculoValor");
    const cor = getVal("operacaoVeiculoCor");
    const chassi = getVal("operacaoVeiculoChassi");
    const anoModelo = getVal("operacaoVeiculoAnoModelo");
    const renavam = getVal("operacaoVeiculoRenavam");
    const motor = getVal("operacaoVeiculoMotor");
    const veiculos = loadCadastro(CAD_VEICULOS_KEY);
    if (typeof hasEquipamentoDuplicado === "function" && hasEquipamentoDuplicado(veiculos, plate, chassi, renavam, motor)) {
      if (msg) msg.textContent = "Placa, chassi, renavam ou motor já cadastrado.";
      return;
    }
    const tipo = portalInferTipoVeiculoLocacao({ placa: plate });
    let tag = getVal("operacaoVeiculoTag");
    if (!tag && typeof nextTagByTipo === "function") {
      tag = nextTagByTipo(tipo, veiculos);
    }
    if (!tag) {
      if (msg) msg.textContent = "Informe a tag do veículo.";
      return;
    }
    const novo = {
      id: Date.now(),
      createdAt: Date.now(),
      tipo,
      tag,
      placa: plate,
      codigo: getVal("operacaoVeiculoCodigo"),
      numLinha: getVal("operacaoVeiculoNum"),
      marca,
      modelo,
      valor,
      cor,
      chassi,
      anoModelo,
      renavam,
      motor,
      proprietario: getVal("operacaoVeiculoProprietario"),
      local: getVal("operacaoVeiculoLocal"),
      status: "DISPONIVEL",
    };
    veiculos.push(novo);
    try {
      saveCadastro(CAD_VEICULOS_KEY, veiculos);
    } catch (err) {
      veiculos.pop();
      if (msg) msg.textContent = `Não foi possível guardar: ${err && err.message ? err.message : err}.`;
      console.error(err);
      return;
    }
    portalPushCloudSnapshotAfterPersist();
    if (msg) msg.textContent = "Veículo cadastrado com sucesso.";
    const form = document.getElementById("formOperacaoVeiculoInline");
    if (form && typeof form.reset === "function") form.reset();
  }

  /** Cadastro / atualização de locação pelo formulário do portal — grava também quem executou (000AA + instante). */
  function persistPortalOperacaoLocacaoInlineSubmit(ev) {
    ev.preventDefault();
    syncOperacaoLocacaoFromDataInicio();
    syncOperacaoLocacaoValorPlano();
    const msg = document.getElementById("operacaoLocacaoInlineMsg");
    if (
      typeof loadCadastro !== "function" ||
      typeof saveCadastro !== "function" ||
      typeof CAD_LOCACOES_KEY === "undefined"
    ) {
      if (msg) msg.textContent = "Cadastro indisponível neste ambiente.";
      return;
    }
    const reg = getPortalSessaoParaRegistroLancamentoAluguel();
    if (!reg) {
      if (msg) msg.textContent = "Inicie sessão como colaborador ou administrador para cadastrar ou alterar locação.";
      return;
    }
    const dig = typeof onlyDigits === "function" ? onlyDigits : (s) => String(s ?? "").replace(/\D/g, "");
    const cpfDigits = dig(String(document.getElementById("operacaoLocacaoCpf")?.value || ""));
    if (cpfDigits.length !== 11) {
      if (msg) msg.textContent = "Informe um CPF válido (11 dígitos).";
      return;
    }
    const plateRaw = document.getElementById("operacaoLocacaoPlaca")?.value || "";
    const plate =
      typeof normalizePlate === "function"
        ? normalizePlate(String(plateRaw || ""))
        : String(plateRaw || "")
            .trim()
            .toUpperCase()
            .replace(/[^A-Z0-9]/g, "");
    if (!plate) {
      if (msg) msg.textContent = "Informe a placa.";
      return;
    }
    const rawInicio = String(document.getElementById("operacaoLocacaoDataInicio")?.value || "").trim();
    const inicioDt = typeof parseBrDate === "function" ? parseBrDate(rawInicio) : null;
    if (!rawInicio || !inicioDt || Number.isNaN(inicioDt.getTime())) {
      if (msg) msg.textContent = "Informe a data de início (DD/MM/AAAA).";
      return;
    }
    const inicioBr =
      typeof formatPortalDataBr === "function" ? formatPortalDataBr(inicioDt) : rawInicio;
    const rawFim = String(document.getElementById("operacaoLocacaoDataFim")?.value || "").trim();
    let fimBr = "";
    if (rawFim) {
      const fimDt = typeof parseBrDate === "function" ? parseBrDate(rawFim) : null;
      if (!fimDt || Number.isNaN(fimDt.getTime())) {
        if (msg) msg.textContent = "Data fim inválida (DD/MM/AAAA).";
        return;
      }
      fimBr = typeof formatPortalDataBr === "function" ? formatPortalDataBr(fimDt) : rawFim;
    }
    const sel = document.getElementById("operacaoLocacaoProtocoloSelect");
    const hid = document.getElementById("operacaoLocacaoProtocolo");
    const isNovo = sel && String(sel.value || "") === PORTAL_PROTO_NOVO;
    const nc = normPortalNumeroContrato(String(hid?.value || ""));
    if (!nc) {
      if (msg) msg.textContent = "Protocolo inválido. Escolha «NOVO» ou um contrato existente.";
      return;
    }
    const parseVal =
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
    const valorLocNum = Number(parseVal(String(document.getElementById("operacaoLocacaoValorAluguel")?.value || "")));
    const valorInvNum = Number(parseVal(String(document.getElementById("operacaoLocacaoValorInvestimento")?.value || "")));
    const tipoPlanoStr = String(document.getElementById("operacaoLocacaoTipoPlano")?.value || "").trim();
    const planoNome =
      tipoPlanoStr ||
      (valorInvNum > 0 ? "DK MINHA MOTO" : "DK MEU TRANSPORTE");
    const nk =
      typeof normalizeKey === "function" ? normalizeKey : (v) => String(v || "").trim().toUpperCase();
    const planoMinha = nk(planoNome).includes("MINHA MOTO");
    if (!valorLocNum || (planoMinha && !valorInvNum)) {
      if (msg) {
        msg.textContent = planoMinha
          ? "No plano DK MINHA MOTO informe valor da locação e do investimento."
          : "Informe o valor da locação.";
      }
      return;
    }
    const valorSemanalNum = valorLocNum + valorInvNum;
    const cb =
      typeof currencyBRL === "function"
        ? currencyBRL
        : (n) =>
            Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    const valorSemanal = cb(valorSemanalNum);
    const diaPagto = String(document.getElementById("operacaoLocacaoDiaPagamento")?.value || "").trim();
    const tempoStr = String(document.getElementById("operacaoLocacaoTempoDias")?.value || "").trim();
    const tempoN = tempoStr === "" ? 0 : Math.max(0, Number.parseInt(tempoStr, 10) || 0);
    const periodoLocacao = tempoN ? `${tempoN} dia(s)` : "";
    const marcaModelo = String(document.getElementById("operacaoLocacaoModelo")?.value || "").trim();
    const modalidade = portalInferTipoVeiculoLocacao({ placa: plate, modalidade: "" });
    const statusLocacao = fimBr ? "FINALIZADO" : "ATIVO";

    const locs = loadCadastro(CAD_LOCACOES_KEY);
    const idxAll = locs.findIndex(
      (l) => dig(String(l.cpf || "")) === cpfDigits && normPortalNumeroContrato(l.numeroContrato) === nc
    );
    const prev = idxAll >= 0 ? locs[idxAll] : null;
    if (!prev && !isNovo) {
      if (msg) msg.textContent = "Contrato não encontrado para atualizar. Use «NOVO» para criar um protocolo.";
      return;
    }
    if (prev && isNovo) {
      if (msg) msg.textContent = "Remova «NOVO» do protocolo para atualizar um contrato já existente.";
      return;
    }

    const ncKey =
      typeof normalizeNumeroContratoKey === "function" ? normalizeNumeroContratoKey(nc) : nc;
    const excludeId = prev?.id != null ? prev.id : null;
    if (typeof contratoNumeroJaExisteNaBase === "function" && contratoNumeroJaExisteNaBase(ncKey, excludeId)) {
      if (msg) msg.textContent = "Este número de protocolo já está cadastrado.";
      return;
    }

    const livres =
      typeof getVeiculosSemProtocoloAtivo === "function" ? getVeiculosSemProtocoloAtivo() : [];
    const plateFree = livres.some((v) =>
      typeof normalizePlate === "function"
        ? normalizePlate(String(v.placa || "")) === plate
        : String(v.placa || "")
            .trim()
            .toUpperCase()
            .replace(/[^A-Z0-9]/g, "") === plate
    );
    const prevPlate =
      prev && typeof normalizePlate === "function"
        ? normalizePlate(String(prev.placa || ""))
        : prev
          ? String(prev.placa || "")
              .trim()
              .toUpperCase()
              .replace(/[^A-Z0-9]/g, "")
          : "";
    const mesmoContratoPlaca = prev && prevPlate === plate;
    if (!plateFree && !mesmoContratoPlaca) {
      if (msg)
        msg.textContent =
          "Esta placa não está disponível (já existe contrato ativo). Finalize a locação anterior ou escolha outra placa.";
      return;
    }

    const clientes = typeof loadCadastro === "function" ? loadCadastro(CAD_CLIENTES_KEY) : [];
    const cliente = clientes.find((c) => dig(String(c.cpf || "")) === cpfDigits);
    if (cliente && nk(String(cliente.status || "")).includes("QUEBRA DE CONTRATO")) {
      window.alert("IMPEDITIVO DE LOCAÇÃO: cliente com quebra de contrato.");
      return;
    }
    if (cliente && nk(String(cliente.status || "")).includes("CADASTRO NAO APROVADO")) {
      window.alert("IMPEDITIVO DE LOCAÇÃO: cadastro não aprovado.");
      return;
    }
    const clienteCodigo = String(cliente?.codigo || "").trim();

    const nowMs = Date.now();
    const execCpf = String(reg.cpf || "").replace(/\D/g, "").slice(0, 11);
    const execNome = String(reg.nome || "").trim();

    const baseRecord = {
      cpf: cpfDigits,
      placa: plate,
      inicio: inicioBr,
      fim: fimBr,
      plano: planoNome,
      valorLocacao: cb(valorLocNum),
      valorInvestimento: cb(valorInvNum),
      valorSemanal,
      numeroContrato: nc,
      statusLocacao,
      diaPagto,
      periodoLocacao,
      modalidade,
      marcaModelo,
      opcaoContrato: tipoPlanoStr,
      periodoContrato: "",
      kmInicial: "",
      configPrecoKm: "",
      tabela: "",
      valorParcela: valorSemanal,
      clienteCodigo,
    };

    if (prev) {
      locs[idxAll] = {
        ...prev,
        ...baseRecord,
        portalLancamentosAluguel: prev.portalLancamentosAluguel,
        portalLocacaoExecutadoPorCpf: prev.portalLocacaoExecutadoPorCpf,
        portalLocacaoExecutadoPorNome: prev.portalLocacaoExecutadoPorNome,
        portalLocacaoExecutadoEmMs: prev.portalLocacaoExecutadoEmMs,
        portalLocacaoFinalizadoPorCpf: prev.portalLocacaoFinalizadoPorCpf,
        portalLocacaoFinalizadoPorNome: prev.portalLocacaoFinalizadoPorNome,
        portalLocacaoFinalizadoEmMs: prev.portalLocacaoFinalizadoEmMs,
        updatedAt: nowMs,
      };
    } else {
      locs.push({
        id: nowMs,
        createdAt: nowMs,
        ...baseRecord,
        portalLocacaoExecutadoPorCpf: execCpf,
        portalLocacaoExecutadoPorNome: execNome,
        portalLocacaoExecutadoEmMs: nowMs,
        updatedAt: nowMs,
      });
    }

    try {
      saveCadastro(CAD_LOCACOES_KEY, locs);
    } catch (err) {
      console.error(err);
      if (msg) msg.textContent = `Não foi possível guardar: ${err && err.message ? err.message : err}.`;
      return;
    }
    portalPushCloudSnapshotAfterPersist();

    if (typeof addAuditLog === "function") {
      try {
        addAuditLog(
          prev ? "atualizar_locacao_portal" : "cadastrar_locacao_portal",
          "locacao",
          `${nc} · CPF ${cpfDigits} · ${plate}`
        );
      } catch {
        /* ignore */
      }
    }
    if (msg) msg.textContent = prev ? "Locação atualizada." : "Locação cadastrada.";
    refreshOperacaoLocacaoProtocoloPicker({ force: true });
    const selAfter = document.getElementById("operacaoLocacaoProtocoloSelect");
    const hidAfter = document.getElementById("operacaoLocacaoProtocolo");
    if (selAfter && hidAfter) {
      selAfter.value = nc;
      hidAfter.value = nc;
    }
    const saved = locs.find(
      (l) => dig(String(l.cpf || "")) === cpfDigits && normPortalNumeroContrato(l.numeroContrato) === nc
    );
    if (saved) applyPortalLocacaoRowFromRecord(saved);
    refreshOperacaoLocacaoDatalists();
    refreshOperacaoLocacaoFinalizarBtn();
  }

  function collectPortalLocacoesComProtocoloByCpf(cpfDigits) {
    return collectPortalLocacoesByCpf(cpfDigits).filter((l) => Boolean(normPortalNumeroContrato(l.numeroContrato)));
  }

  /** Ano da coluna «TOTAL PAGO NO ANO DE 2025» (soma das datas de pagamento neste ano). */
  const PORTAL_LANCAMENTO_ALUGUEL_ANO_RESUMO = 2025;

  function formatPortalLancamentoSumBrl(n) {
    return Number(n || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function parsePortalLancamentoValorRaw(v) {
    if (typeof parseCurrencyBR === "function") return parseCurrencyBR(String(v ?? ""));
    const cleaned = String(v ?? "")
      .replace(/[R$\s]/g, "")
      .replace(/\./g, "")
      .replace(",", ".");
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : 0;
  }

  function normalizePortalLancamentoAluguelEntry(x) {
    if (!x || typeof x !== "object") return null;
    const data = String(x.data || "").trim();
    if (!data) return null;
    const dig =
      typeof onlyDigits === "function" ? onlyDigits : (s) => String(s ?? "").replace(/\D/g, "");
    const registradoPorCpf = dig(String(x.registradoPorCpf ?? x.registradoPor ?? "")).slice(0, 11);
    const registradoPorNome = String(x.registradoPorNome ?? "").trim();
    const createdAt =
      typeof x.createdAt === "number" && Number.isFinite(x.createdAt) ? x.createdAt : undefined;
    const MEIOS = ["valorEspecie", "valorPix", "valorCartao"];
    const anyMeiosKeys = MEIOS.some((k) => Object.prototype.hasOwnProperty.call(x, k));
    let valor;
    let valorEspecie;
    let valorPix;
    let valorCartao;
    if (anyMeiosKeys) {
      valorEspecie = Number(parsePortalLancamentoValorRaw(x.valorEspecie ?? 0));
      valorPix = Number(parsePortalLancamentoValorRaw(x.valorPix ?? 0));
      valorCartao = Number(parsePortalLancamentoValorRaw(x.valorCartao ?? 0));
      if (![valorEspecie, valorPix, valorCartao].every((n) => Number.isFinite(n) && n >= 0)) return null;
      valor = valorEspecie + valorPix + valorCartao;
      if (!Number.isFinite(valor) || valor <= 0) return null;
    } else {
      valor =
        typeof x.valor === "number" && Number.isFinite(x.valor) ? x.valor : Number(parsePortalLancamentoValorRaw(x.valor ?? ""));
      if (!Number.isFinite(valor) || valor <= 0) return null;
    }
    const out = { data, valor, createdAt, registradoPorCpf, registradoPorNome };
    if (anyMeiosKeys) {
      out.valorEspecie = valorEspecie;
      out.valorPix = valorPix;
      out.valorCartao = valorCartao;
    }
    return out;
  }

  /** Sessão equipa no momento do lançamento (para relatório / auditoria). */
  function getPortalSessaoParaRegistroLancamentoAluguel() {
    try {
      const raw = localStorage.getItem("dk_sessao_cliente");
      if (!raw) return null;
      const s = JSON.parse(raw);
      if (s?.tipo !== "admin") return null;
      const dig =
        typeof onlyDigits === "function" ? onlyDigits : (x) => String(x ?? "").replace(/\D/g, "");
      const cpf = dig(String(s.cpf || "")).slice(0, 11);
      if (cpf.length !== 11) return null;
      return { cpf, nome: String(s.nome || "").trim() };
    } catch {
      return null;
    }
  }

  /** CPF (3 dígitos) + 2 letras do primeiro nome — ex.: 12345678901 + «teste 1» → 123TE. */
  function portalCodigoUsuarioRegistroLancamento(cpfDigits11, nomeCompleto) {
    const dig = String(cpfDigits11 || "").replace(/\D/g, "").slice(0, 11);
    if (dig.length < 3) return "";
    const primeiroToken = String(nomeCompleto || "").trim().split(/\s+/)[0] || "";
    const letras = primeiroToken
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z]/g, "")
      .toUpperCase()
      .slice(0, 2);
    return `${dig.slice(0, 3)}${letras}`;
  }

  function formatPortalHoraLancamentoMs(ms) {
    if (typeof ms !== "number" || !Number.isFinite(ms) || ms <= 0) return "—";
    try {
      return new Date(ms).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    } catch {
      return "—";
    }
  }

  /** Relatório 1: instante em que o operador registou o lançamento (mesmo fuso do navegador). */
  function formatPortalDataHoraLancamentoMs(ms) {
    if (typeof ms !== "number" || !Number.isFinite(ms) || ms <= 0) return "—";
    try {
      const d = new Date(ms);
      if (Number.isNaN(d.getTime())) return "—";
      const p2 = (n) => String(n).padStart(2, "0");
      return `${formatPortalDataBr(d)} às ${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}`;
    } catch {
      return "—";
    }
  }

  /** Lançamentos em `dk_lancamentos_aluguel` (quadro DK) para o mesmo CPF + placa + protocolo — usado quando o array embutido na locação veio vazio após merge/nuvem. */
  function portalLancamentosAluguelFromCadastroGlobal(loc) {
    if (typeof getLancamentosAluguel !== "function") return [];
    const dig = typeof onlyDigits === "function" ? onlyDigits : (s) => String(s ?? "").replace(/\D/g, "");
    const cpfD = dig(String(loc.cpf || ""));
    const plate =
      typeof normalizePlate === "function"
        ? normalizePlate(String(loc.placa || ""))
        : String(loc.placa || "")
            .trim()
            .toUpperCase()
            .replace(/[^A-Z0-9]/g, "");
    const nc =
      typeof normalizeNumeroContratoKey === "function"
        ? String(normalizeNumeroContratoKey(loc.numeroContrato || "")).replace(/\s+/g, "")
        : String(loc.numeroContrato || "")
            .trim()
            .toUpperCase()
            .replace(/\s+/g, "");
    if (cpfD.length !== 11 || !plate || !nc) return [];
    const out = [];
    for (const item of getLancamentosAluguel()) {
      if (!item || typeof item !== "object") continue;
      if (dig(String(item.cpf || "")) !== cpfD) continue;
      const pIt =
        typeof normalizePlate === "function"
          ? normalizePlate(String(item.placa || ""))
          : String(item.placa || "")
              .trim()
              .toUpperCase()
              .replace(/[^A-Z0-9]/g, "");
      if (pIt !== plate) continue;
      const ncIt =
        typeof normalizeNumeroContratoKey === "function"
          ? String(normalizeNumeroContratoKey(item.numeroContrato || "")).replace(/\s+/g, "")
          : String(item.numeroContrato || "")
              .trim()
              .toUpperCase()
              .replace(/\s+/g, "");
      if (ncIt !== nc) continue;
      const data = String(item.dataPagamento || item.semanaInicio || "").trim();
      const valor =
        typeof getLancamentoAluguelValor === "function"
          ? getLancamentoAluguelValor(item)
          : Number(parsePortalLancamentoValorRaw(item.valorPago ?? item.valor ?? 0));
      if (!data || !Number.isFinite(valor) || valor <= 0) continue;
      const createdAt = Number(item.createdAt || item.id || 0);
      out.push({
        data,
        valor,
        createdAt: createdAt || Date.now(),
        registradoPorCpf: dig(String(item.registradoPorCpf || "")).slice(0, 11),
        registradoPorNome: String(item.registradoPorNome || "").trim(),
      });
    }
    out.sort((a, b) => Number(a.createdAt || 0) - Number(b.createdAt || 0));
    return out;
  }

  /** Lançamentos do portal amarrados ao registo da locação (por protocolo). Migra total legado se ainda não houver lista. */
  function getPortalLancamentosAluguelDoContrato(loc) {
    if (!loc || typeof loc !== "object") return [];
    const mergePl =
      typeof window.__DK_mergePortalLancamentosAluguelEmbutidos === "function"
        ? window.__DK_mergePortalLancamentosAluguelEmbutidos
        : (arrays) => {
            const flat = [];
            for (const a of arrays || []) {
              if (!Array.isArray(a)) continue;
              for (const x of a) {
                if (x && typeof x === "object") flat.push(x);
              }
            }
            return flat;
          };
    const chunks = [];
    if (Array.isArray(loc.portalLancamentosAluguel) && loc.portalLancamentosAluguel.length > 0) {
      const n = loc.portalLancamentosAluguel.map(normalizePortalLancamentoAluguelEntry).filter(Boolean);
      if (n.length) chunks.push(n);
    }
    const legado = Number(parsePortalLancamentoValorRaw(loc.totalPagoAno2025 ?? "0"));
    if (legado > 0 && chunks.length === 0) {
      const data = String(loc.ultimoLancamentoAluguelData || "").trim() || "01/01/2025";
      chunks.push([
        {
          data,
          valor: legado,
          createdAt: Number(loc.createdAt || loc.id || 0) || Date.now(),
        },
      ]);
    }
    const globalRows = portalLancamentosAluguelFromCadastroGlobal(loc);
    if (globalRows.length) chunks.push(globalRows);
    const merged = mergePl(chunks);
    return Array.isArray(merged) ? merged : [];
  }

  function sumPortalLancamentosAluguelTotal(arr) {
    return (arr || []).reduce((a, x) => a + Number(x.valor || 0), 0);
  }

  function sumPortalLancamentosAluguelNoAno(arr, year) {
    let s = 0;
    for (const x of arr || []) {
      const d = typeof parseBrDate === "function" ? parseBrDate(String(x.data || "").trim()) : null;
      if (!d || Number.isNaN(d.getTime())) continue;
      if (d.getFullYear() !== year) continue;
      s += Number(x.valor || 0);
    }
    return s;
  }

  /** Dias do contrato (mesma lógica que o formulário de locação no portal). */
  function computePortalTempoDiasLoc(loc) {
    const rawInicio = String(loc?.inicio || "").trim();
    if (!rawInicio) return 0;
    const parseD = typeof parseBrDate === "function" ? parseBrDate : () => null;
    const inicio = parseD(rawInicio);
    if (!inicio || Number.isNaN(inicio.getTime())) return 0;
    const rawFim = String(loc?.fim || "").trim();
    if (rawFim) {
      const fim = parseD(rawFim);
      if (fim && !Number.isNaN(fim.getTime())) {
        const t0 = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate()).getTime();
        const t1 = new Date(fim.getFullYear(), fim.getMonth(), fim.getDate()).getTime();
        return Math.max(1, Math.round((t1 - t0) / 86400000));
      }
    }
    const start = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate());
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const diffMs = today.getTime() - start.getTime();
    return Math.max(0, Math.round(diffMs / (24 * 60 * 60 * 1000)));
  }

  /** Valores do bloco «resumo» do protocolo (alinhado ao painel Cadastro de locação). */
  function computePortalProtocoloResumoFromLoc(loc) {
    const parseCur =
      typeof parseCurrencyBR === "function"
        ? (v) => Number(parseCurrencyBR(String(v ?? "")))
        : (v) => Number(parsePortalLancamentoValorRaw(v));
    const valLoc = parseCur(loc?.valorLocacao ?? "0");
    const valInv = parseCur(loc?.valorInvestimento ?? "0");
    const plano = valLoc + valInv;
    const tempo = computePortalTempoDiasLoc(loc);
    const custoDiaNum = plano / 7;
    const valorDevidoPlanoNum = tempo * (plano / 7);
    const valorDevidoAluguelNum = tempo * (valLoc / 7);
    const lancs = getPortalLancamentosAluguelDoContrato(loc);
    const totalPagoNum = sumPortalLancamentosAluguelTotal(lancs);
    const investimentoAcumuladoNum = totalPagoNum - valorDevidoAluguelNum;
    const tipoPlanoStr =
      String(loc?.plano || loc?.opcaoContrato || "").trim() ||
      (valInv > 0 ? "DK MINHA MOTO" : "DK MEU TRANSPORTE");
    const fmtN = (n) =>
      Number(n || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const fmtBrl = (n) =>
      typeof currencyBRL === "function"
        ? currencyBRL(n)
        : Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    return {
      custoDia: fmtBrl(custoDiaNum),
      valorAluguel: fmtN(valLoc),
      valorInvestimento: fmtN(valInv),
      valorPlano: fmtN(plano),
      valorDevidoPlano: fmtBrl(valorDevidoPlanoNum),
      totalPago: fmtN(totalPagoNum),
      tipoPlano: tipoPlanoStr,
      valorDevidoAluguel: fmtBrl(valorDevidoAluguelNum),
      investimentoAcumulado: formatPortalLancamentoSumBrl(investimentoAcumuladoNum),
      investimentoAcumuladoNeg: investimentoAcumuladoNum < 0,
    };
  }

  function buildPortalRelatorioClienteProtocolosPdfHtml(opts) {
    const eh = typeof escapeHtml === "function" ? escapeHtml : portalEscapeHtml;
    const {
      cpfLabel = "—",
      nomeCliente = "—",
      sections,
      quando,
      tituloRelatorio = "Relatório 2 — Por cliente",
      mensagemVazio,
      linhasMetaCabecalho,
      tituloProtocoloSecao,
    } = opts;
    const title = tituloRelatorio;
    const msgVazio =
      mensagemVazio || "Nenhuma locação com protocolo encontrada para este CPF.";
    let cabecalhoHtml = "";
    if (Array.isArray(linhasMetaCabecalho)) {
      if (linhasMetaCabecalho.length) {
        cabecalhoHtml = linhasMetaCabecalho.map((line) => `<p class="meta">${eh(line)}</p>`).join("");
      }
    } else {
      cabecalhoHtml = `<p class="meta">${eh(`CPF: ${cpfLabel}`)} · ${eh(`Cliente: ${nomeCliente}`)}</p>`;
    }
    let body = "";
    if (!sections.length) {
      body = `<p class="meta">${eh(msgVazio)}</p>`;
    }
    const fnSecTitulo =
      typeof tituloProtocoloSecao === "function" ? tituloProtocoloSecao : null;
    for (const sec of sections) {
      const { proto, placa, lancs, resumo } = sec;
      const tituloBloco = fnSecTitulo
        ? fnSecTitulo(sec)
        : `Protocolo ${proto} · Placa ${placa}`;
      body += `<h2>${eh(tituloBloco)}</h2>`;
      body += `<p class="meta">${eh("Pagamentos")}</p>`;
      body += `<table><thead><tr><th>${eh("Data do pagamento")}</th><th>${eh("Valor")}</th></tr></thead><tbody>`;
      if (!lancs.length) {
        body += `<tr><td colspan="2">${eh("Nenhum lançamento registado neste protocolo.")}</td></tr>`;
      } else {
        for (const lan of lancs) {
          const vf =
            typeof currencyBRL === "function"
              ? currencyBRL(lan.valor)
              : Number(lan.valor || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
          body += `<tr><td>${eh(String(lan.data || ""))}</td><td>${eh(vf)}</td></tr>`;
        }
      }
      body += `</tbody></table>`;
      body += `<p class="sum-title">${eh("Resumo do protocolo")}</p>`;
      body += `<table class="resumo"><tbody>`;
      const rows3 = [
        [
          ["QUANTO CUSTA O DIA", resumo.custoDia],
          ["VALOR DO ALUGUEL", resumo.valorAluguel],
          ["VALOR INVESTIMENTO", resumo.valorInvestimento],
        ],
        [
          ["VALOR DO PLANO", resumo.valorPlano],
          ["VALOR DEVIDO DO PLANO", resumo.valorDevidoPlano],
          ["TOTAL PAGO", resumo.totalPago],
        ],
        [
          ["TIPO DE PLANO", resumo.tipoPlano],
          ["VALOR DEVIDO DO ALUGUEL", resumo.valorDevidoAluguel],
          ["INVESTIMENTO ACUMULADO", resumo.investimentoAcumulado],
        ],
      ];
      for (const row of rows3) {
        body += `<tr>`;
        for (const [lbl, val] of row) {
          const neg =
            lbl === "INVESTIMENTO ACUMULADO" && resumo.investimentoAcumuladoNeg ? ' class="neg"' : "";
          body += `<td><span class="lbl">${eh(lbl)}</span><br /><span class="val"${neg}>${eh(val)}</span></td>`;
        }
        body += `</tr>`;
      }
      body += `</tbody></table><hr />`;
    }
    return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><title>${eh(title)}</title><style>
      body{font-family:system-ui,-apple-system,sans-serif;margin:1.2rem;color:#111;font-size:12px}
      h1{font-size:1.1rem;margin:0 0 0.35rem}
      h2{font-size:1rem;margin:1rem 0 0.35rem}
      .meta{color:#444;margin:0.25rem 0;font-size:11px}
      .sum-title{font-weight:700;margin:0.65rem 0 0.35rem;font-size:12px}
      table{width:100%;border-collapse:collapse;margin-bottom:0.5rem}
      th,td{border:1px solid #333;padding:6px 8px;text-align:left}
      th{background:#eee;font-weight:600}
      table.resumo td{width:33%;vertical-align:top}
      table.resumo .lbl{font-size:10px;color:#555;display:block;margin-bottom:3px}
      table.resumo .val{font-size:12px;font-weight:600}
      table.resumo .val.neg{color:#b71c1c}
      hr{border:none;border-top:1px solid #ccc;margin:1rem 0}
    </style></head><body>
      <h1>${eh(title)}</h1>
      ${cabecalhoHtml}
      <p class="meta">${eh(`Emitido em ${quando}`)}</p>
      ${body}
    </body></html>`;
  }

  function buildPortalRelatorioClienteProtocolosExcelHtml(opts) {
    const eh = typeof escapeHtml === "function" ? escapeHtml : portalEscapeHtml;
    const {
      cpfLabel = "—",
      nomeCliente = "—",
      sections,
      tituloRelatorio = "Relatório 2 — Por cliente",
      mensagemVazio,
      cabecalhoPares,
      tituloProtocoloSecao,
    } = opts;
    const msgVazio =
      mensagemVazio || "Nenhuma locação com protocolo encontrada para este CPF.";
    const d = new Date().toLocaleString("pt-BR");
    const pares =
      Array.isArray(cabecalhoPares) && cabecalhoPares.length
        ? cabecalhoPares
        : [
            ["CPF", cpfLabel],
            ["Cliente", nomeCliente],
          ];
    let blocks = `<table>`;
    blocks += `<tr><td class="meta-key">${eh("Relatório")}</td><td>${eh(tituloRelatorio)}</td></tr>`;
    for (const [k, v] of pares) {
      blocks += `<tr><td class="meta-key">${eh(k)}</td><td>${eh(v)}</td></tr>`;
    }
    blocks += `<tr><td class="meta-key">${eh("Emitido em")}</td><td>${eh(d)}</td></tr></table><br>`;
    if (!sections.length) {
      blocks += `<p>${eh(msgVazio)}</p>`;
    }
    const fnSecTitulo =
      typeof tituloProtocoloSecao === "function" ? tituloProtocoloSecao : null;
    for (const sec of sections) {
      const { proto, placa, lancs, resumo } = sec;
      const tituloBloco = fnSecTitulo
        ? fnSecTitulo(sec)
        : `Protocolo ${proto} · Placa ${placa}`;
      blocks += `<h3>${eh(tituloBloco)}</h3>`;
      blocks += `<table><thead><tr><th>${eh("Data do pagamento")}</th><th>${eh("Valor")}</th></tr></thead><tbody>`;
      if (!lancs.length) {
        blocks += `<tr><td colspan="2">${eh("Nenhum lançamento registado neste protocolo.")}</td></tr>`;
      } else {
        for (const lan of lancs) {
          const vf =
            typeof currencyBRL === "function"
              ? currencyBRL(lan.valor)
              : Number(lan.valor || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
          blocks += `<tr><td>${eh(String(lan.data || ""))}</td><td>${eh(vf)}</td></tr>`;
        }
      }
      blocks += `</tbody></table>`;
      blocks += `<p><strong>${eh("Resumo do protocolo")}</strong></p>`;
      blocks += `<table><tbody>`;
      const pairs = [
        ["QUANTO CUSTA O DIA", resumo.custoDia],
        ["VALOR DO ALUGUEL", resumo.valorAluguel],
        ["VALOR INVESTIMENTO", resumo.valorInvestimento],
        ["VALOR DO PLANO", resumo.valorPlano],
        ["VALOR DEVIDO DO PLANO", resumo.valorDevidoPlano],
        ["TOTAL PAGO", resumo.totalPago],
        ["TIPO DE PLANO", resumo.tipoPlano],
        ["VALOR DEVIDO DO ALUGUEL", resumo.valorDevidoAluguel],
        ["INVESTIMENTO ACUMULADO", resumo.investimentoAcumulado],
      ];
      for (const [k, v] of pairs) {
        const st =
          k === "INVESTIMENTO ACUMULADO" && resumo.investimentoAcumuladoNeg ? ' style="color:#b71c1c;font-weight:700"' : "";
        blocks += `<tr><td class="meta-key">${eh(k)}</td><td${st}>${eh(v)}</td></tr>`;
      }
      blocks += `</tbody></table><br><br>`;
    }
    return `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"><style>
      table{border-collapse:collapse;font-family:Arial,sans-serif;font-size:12px;margin-bottom:8px}
      th,td{border:1px solid #cfcfcf;padding:6px;text-align:left}
      th{font-weight:700;background:#efefef}
      .meta-key{font-weight:700;background:#efefef}
      h3{font-size:14px;margin:12px 0 6px}
    </style></head><body>${blocks}</body></html>`;
  }

  function fillOperacaoLocacaoTotaisLancamentoPortal(loc) {
    const arr = getPortalLancamentosAluguelDoContrato(loc);
    const tp = document.getElementById("operacaoLocacaoTotalPago");
    const tp25 = document.getElementById("operacaoLocacaoTotalPagoAno2025");
    if (tp) tp.value = formatPortalLancamentoSumBrl(sumPortalLancamentosAluguelTotal(arr));
    if (tp25) tp25.value = formatPortalLancamentoSumBrl(sumPortalLancamentosAluguelNoAno(arr, PORTAL_LANCAMENTO_ALUGUEL_ANO_RESUMO));
    syncOperacaoLocacaoInvestimentoAcumuladoEAlertaDevido();
  }

  /** Investimento acumulado = total pago − valor devido do aluguel. Cor no próprio campo: vermelho se negativo, azul se positivo, padrão se zero. */
  function syncOperacaoLocacaoInvestimentoAcumuladoEAlertaDevido() {
    const inpTp = document.getElementById("operacaoLocacaoTotalPago");
    const inpDevido = document.getElementById("operacaoLocacaoValorDevidoAluguel");
    const inpAcum = document.getElementById("operacaoLocacaoInvestimentoAcumulado");
    if (!inpAcum) return;
    const totalPago = Number(parsePortalLancamentoValorRaw(inpTp?.value ?? ""));
    const devidoAlug = Number(parsePortalLancamentoValorRaw(inpDevido?.value ?? ""));
    const acum = totalPago - devidoAlug;
    inpAcum.value = formatPortalLancamentoSumBrl(acum);
    if (inpDevido) inpDevido.classList.remove("portal-valor-devido-aluguel--negativo");
    inpAcum.classList.remove("portal-investimento-acumulado--negativo", "portal-investimento-acumulado--positivo");
    if (acum < 0) inpAcum.classList.add("portal-investimento-acumulado--negativo");
    else if (acum > 0) inpAcum.classList.add("portal-investimento-acumulado--positivo");
  }

  function refreshOperacaoLancamentoAluguelCpfDatalist() {
    const dl = document.getElementById("operacaoLancAluguelCpfSugestoes");
    const inpCpf = document.getElementById("operacaoLancAluguelCpf");
    if (!dl || typeof loadCadastro !== "function" || typeof CAD_LOCACOES_KEY === "undefined") return;
    const dig =
      typeof onlyDigits === "function" ? onlyDigits : (s) => String(s ?? "").replace(/\D/g, "");
    const fmt = typeof formatCpf === "function" ? formatCpf : (d) => d;
    const prefix = inpCpf ? dig(String(inpCpf.value || "")).slice(0, 11) : "";
    const seen = new Set();
    loadCadastro(CAD_LOCACOES_KEY).forEach((l) => {
      if (!normPortalNumeroContrato(l.numeroContrato)) return;
      const d = dig(String(l.cpf || ""));
      if (d.length !== 11) return;
      if (prefix.length && !d.startsWith(prefix)) return;
      seen.add(d);
    });
    dl.innerHTML = Array.from(seen)
      .sort()
      .slice(0, 200)
      .map((d) => `<option value="${portalEscapeHtml(fmt(d))}"></option>`)
      .join("");
  }

  /**
   * Sugestões de CPF para Relatório 2 (e futuros campos «CPF cliente»): cadastro local + locações.
   * Filtra pelo prefixo já digitado (comportamento igual ao lançamento de aluguel).
   */
  function refreshPortalRelClienteCpfDatalist() {
    const dl = document.getElementById("portalRelClienteCpfSugestoes");
    const inpCpf = document.getElementById("portalRelClienteCpf");
    if (!dl || typeof loadCadastro !== "function") return;
    const dig =
      typeof onlyDigits === "function" ? onlyDigits : (s) => String(s ?? "").replace(/\D/g, "");
    const fmt = typeof formatCpf === "function" ? formatCpf : (d) => d;
    const prefix = inpCpf ? dig(String(inpCpf.value || "")).slice(0, 11) : "";
    const seen = new Set();
    if (typeof CAD_CLIENTES_KEY !== "undefined") {
      loadCadastro(CAD_CLIENTES_KEY).forEach((c) => {
        const d = dig(String(c.cpf || ""));
        if (d.length !== 11) return;
        if (prefix.length && !d.startsWith(prefix)) return;
        seen.add(d);
      });
    }
    if (typeof CAD_LOCACOES_KEY !== "undefined") {
      loadCadastro(CAD_LOCACOES_KEY).forEach((l) => {
        const d = dig(String(l.cpf || ""));
        if (d.length !== 11) return;
        if (prefix.length && !d.startsWith(prefix)) return;
        seen.add(d);
      });
    }
    dl.innerHTML = Array.from(seen)
      .sort()
      .slice(0, 200)
      .map((d) => `<option value="${portalEscapeHtml(fmt(d))}"></option>`)
      .join("");
  }

  /** Placas normalizadas para Relatório 3 — locações com protocolo e veículos cadastrados; filtra por prefixo. */
  function refreshPortalRelPlacaDatalist() {
    const dl = document.getElementById("portalRelPlacaSugestoes");
    const inp = document.getElementById("portalRelPlaca");
    if (!dl || typeof loadCadastro !== "function") return;
    const np =
      typeof normalizePlate === "function"
        ? normalizePlate
        : (x) => String(x || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    const prefix = inp ? np(String(inp.value || "")) : "";
    const seen = new Set();
    if (typeof CAD_LOCACOES_KEY !== "undefined") {
      loadCadastro(CAD_LOCACOES_KEY).forEach((l) => {
        if (!normPortalNumeroContrato(l.numeroContrato)) return;
        const p = np(String(l.placa || ""));
        if (!p) return;
        if (prefix.length && !p.startsWith(prefix)) return;
        seen.add(p);
      });
    }
    if (typeof CAD_VEICULOS_KEY !== "undefined") {
      loadCadastro(CAD_VEICULOS_KEY).forEach((v) => {
        const p = np(String(v.placa || ""));
        if (!p) return;
        if (prefix.length && !p.startsWith(prefix)) return;
        seen.add(p);
      });
    }
    dl.innerHTML = Array.from(seen)
      .sort()
      .slice(0, 200)
      .map((p) => `<option value="${portalEscapeHtml(p)}"></option>`)
      .join("");
  }

  function syncOperacaoLancAluguelValorPagoFromMeios() {
    const sum = ["operacaoLancAluguelValorEspecie", "operacaoLancAluguelValorPix", "operacaoLancAluguelValorCartao"].reduce(
      (acc, id) => acc + Number(parsePortalLancamentoValorRaw(document.getElementById(id)?.value ?? "")),
      0
    );
    const out = document.getElementById("operacaoLancAluguelValorPago");
    if (!out) return;
    if (sum > 0) out.value = formatPortalLancamentoSumBrl(sum);
    else out.value = "";
  }

  function clearOperacaoLancamentoAluguelCamposDerivados() {
    [
      "operacaoLancAluguelPlaca",
      "operacaoLancAluguelDataInicio",
      "operacaoLancAluguelDataFim",
      "operacaoLancAluguelValorAluguel",
      "operacaoLancAluguelValorInvestimento",
      "operacaoLancAluguelValorPago",
      "operacaoLancAluguelDataPagamento",
      "operacaoLancAluguelValorEspecie",
      "operacaoLancAluguelValorPix",
      "operacaoLancAluguelValorCartao",
    ].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.value = "";
    });
    syncOperacaoLancAluguelValorPagoFromMeios();
  }

  function applyOperacaoLancamentoAluguelFromLoc(loc) {
    const placaEl = document.getElementById("operacaoLancAluguelPlaca");
    const diEl = document.getElementById("operacaoLancAluguelDataInicio");
    const dfEl = document.getElementById("operacaoLancAluguelDataFim");
    const valLocEl = document.getElementById("operacaoLancAluguelValorAluguel");
    const valInvEl = document.getElementById("operacaoLancAluguelValorInvestimento");
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
    const fmtValor = (raw) => {
      if (typeof parseCurrencyBR === "function") {
        const n = parseCurrencyBR(String(raw || ""));
        return Number(n || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      }
      return String(raw || "")
        .replace(/R\$\s?/gi, "")
        .trim();
    };
    if (placaEl && typeof normalizePlate === "function") {
      const p = normalizePlate(String(loc.placa || ""));
      placaEl.value = p || "—";
    } else if (placaEl) placaEl.value = String(loc.placa || "").trim() || "—";
    if (diEl) diEl.value = fmtDate(loc.inicio);
    if (dfEl) dfEl.value = fmtDate(loc.fim);
    if (valLocEl) valLocEl.value = fmtValor(loc.valorLocacao);
    if (valInvEl) valInvEl.value = fmtValor(loc.valorInvestimento);
    ["operacaoLancAluguelValorEspecie", "operacaoLancAluguelValorPix", "operacaoLancAluguelValorCartao", "operacaoLancAluguelValorPago", "operacaoLancAluguelDataPagamento"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.value = "";
    });
    syncOperacaoLancAluguelValorPagoFromMeios();
    refreshOperacaoLancAluguelAdminControlsVisibility();
  }

  let portalLancAluguelProtocoloSyncCpf = "";
  let portalLancAluguelConfirmCallback = null;

  function openPortalLancAluguelConfirmModal(texto, onConfirm) {
    const modal = document.getElementById("portalLancAluguelConfirmModal");
    const p = document.getElementById("portalLancAluguelConfirmTexto");
    if (!modal || !p) {
      if (typeof onConfirm === "function" && window.confirm(texto)) onConfirm();
      return;
    }
    portalLancAluguelConfirmCallback = typeof onConfirm === "function" ? onConfirm : null;
    p.textContent = texto;
    modal.classList.remove("hidden");
    modal.setAttribute("aria-hidden", "false");
  }

  function closePortalLancAluguelConfirmModal() {
    const modal = document.getElementById("portalLancAluguelConfirmModal");
    portalLancAluguelConfirmCallback = null;
    if (modal) {
      modal.classList.add("hidden");
      modal.setAttribute("aria-hidden", "true");
    }
  }

  function refreshOperacaoLocacaoTotaisPortalLancamentoUi(cpfDigits, ncNorm) {
    const hid = document.getElementById("operacaoLocacaoProtocolo");
    const inpCpf = document.getElementById("operacaoLocacaoCpf");
    if (!hid || !inpCpf) return;
    const dig =
      typeof onlyDigits === "function" ? onlyDigits : (s) => String(s ?? "").replace(/\D/g, "");
    const d = dig(String(inpCpf.value || ""));
    if (d !== cpfDigits || normPortalNumeroContrato(hid.value) !== ncNorm) return;
    const loc = collectPortalLocacoesByCpf(cpfDigits).find((l) => normPortalNumeroContrato(l.numeroContrato) === ncNorm);
    if (!loc) return;
    fillOperacaoLocacaoTotaisLancamentoPortal(loc);
  }

  function materializarPortalLancamentosAluguelMutaveisNoLoc(loc) {
    if (!loc || typeof loc !== "object") return null;
    const virt = getPortalLancamentosAluguelDoContrato(loc);
    loc.portalLancamentosAluguel = virt.map((v) => {
      const base = {
        data: String(v.data || "").trim(),
        valor: Number(v.valor),
        createdAt: typeof v.createdAt === "number" && Number.isFinite(v.createdAt) ? v.createdAt : Date.now(),
        registradoPorCpf: String(v.registradoPorCpf || "").replace(/\D/g, "").slice(0, 11),
        registradoPorNome: String(v.registradoPorNome || "").trim(),
      };
      if (["valorEspecie", "valorPix", "valorCartao"].some((k) => Object.prototype.hasOwnProperty.call(v, k))) {
        base.valorEspecie = Number(parsePortalLancamentoValorRaw(v.valorEspecie ?? 0));
        base.valorPix = Number(parsePortalLancamentoValorRaw(v.valorPix ?? 0));
        base.valorCartao = Number(parsePortalLancamentoValorRaw(v.valorCartao ?? 0));
      }
      return base;
    });
    return loc.portalLancamentosAluguel;
  }

  function finalizarPersistPortalLancamentosLoc(locs, loc, cpfDigits, ncNorm) {
    const normArr = (loc.portalLancamentosAluguel || []).map(normalizePortalLancamentoAluguelEntry).filter(Boolean);
    loc.portalLancamentosAluguel = normArr.map((x) => {
      const row = {
        data: x.data,
        valor: x.valor,
        createdAt: typeof x.createdAt === "number" && Number.isFinite(x.createdAt) ? x.createdAt : Date.now(),
        registradoPorCpf: String(x.registradoPorCpf || "").replace(/\D/g, "").slice(0, 11),
        registradoPorNome: String(x.registradoPorNome || "").trim(),
      };
      if (Object.prototype.hasOwnProperty.call(x, "valorEspecie")) {
        row.valorEspecie = Number(x.valorEspecie) || 0;
        row.valorPix = Number(x.valorPix) || 0;
        row.valorCartao = Number(x.valorCartao) || 0;
      }
      return row;
    });
    loc.totalPagoAno2025 = formatPortalLancamentoSumBrl(
      sumPortalLancamentosAluguelNoAno(normArr, PORTAL_LANCAMENTO_ALUGUEL_ANO_RESUMO)
    );
    if (normArr.length) {
      const last = normArr[normArr.length - 1];
      loc.ultimoLancamentoAluguelData = last.data;
      loc.ultimoLancamentoAluguelValor = formatPortalLancamentoSumBrl(last.valor);
    } else {
      loc.ultimoLancamentoAluguelData = "";
      loc.ultimoLancamentoAluguelValor = "";
    }
    try {
      saveCadastro(CAD_LOCACOES_KEY, locs);
    } catch (err) {
      console.error(err);
      return false;
    }
    portalPushCloudSnapshotAfterPersist();
    refreshOperacaoLocacaoTotaisPortalLancamentoUi(cpfDigits, ncNorm);
    refreshOperacaoLancAluguelAdminControlsVisibility();
    return true;
  }

  function persistPortalLancamentoAluguelPagamento(cpfDigits, numeroContratoNorm, valorNum, dataPagamentoBr, meios) {
    if (!getPortalSessaoAdminRole()) return false;
    if (typeof loadCadastro !== "function" || typeof saveCadastro !== "function" || typeof CAD_LOCACOES_KEY === "undefined") {
      return false;
    }
    const locs = loadCadastro(CAD_LOCACOES_KEY);
    const nc = normPortalNumeroContrato(numeroContratoNorm);
    const dig =
      typeof onlyDigits === "function" ? onlyDigits : (s) => String(s ?? "").replace(/\D/g, "");
    const idx = locs.findIndex(
      (l) => dig(String(l.cpf || "")) === cpfDigits && normPortalNumeroContrato(l.numeroContrato) === nc
    );
    if (idx === -1) return false;
    const loc = locs[idx];
    const dataStr = String(dataPagamentoBr || "").trim();
    materializarPortalLancamentosAluguelMutaveisNoLoc(loc);
    const reg = getPortalSessaoParaRegistroLancamentoAluguel();
    const ve = Number(parsePortalLancamentoValorRaw(meios?.valorEspecie ?? 0));
    const vp = Number(parsePortalLancamentoValorRaw(meios?.valorPix ?? 0));
    const vc = Number(parsePortalLancamentoValorRaw(meios?.valorCartao ?? 0));
    const entry = {
      data: dataStr,
      valor: valorNum,
      createdAt: Date.now(),
      registradoPorCpf: reg?.cpf || "",
      registradoPorNome: reg?.nome || "",
      valorEspecie: Number.isFinite(ve) && ve >= 0 ? ve : 0,
      valorPix: Number.isFinite(vp) && vp >= 0 ? vp : 0,
      valorCartao: Number.isFinite(vc) && vc >= 0 ? vc : 0,
    };
    loc.portalLancamentosAluguel.push(entry);
    return finalizarPersistPortalLancamentosLoc(locs, loc, cpfDigits, nc);
  }

  function apagarPortalLancamentoAluguelPorIndice(cpfDigits, ncNorm, indice) {
    if (!isPortalTitularAdministrador()) return false;
    if (typeof loadCadastro !== "function" || typeof saveCadastro !== "function" || typeof CAD_LOCACOES_KEY === "undefined") {
      return false;
    }
    const locs = loadCadastro(CAD_LOCACOES_KEY);
    const nc = normPortalNumeroContrato(ncNorm);
    const dig =
      typeof onlyDigits === "function" ? onlyDigits : (s) => String(s ?? "").replace(/\D/g, "");
    const idx = locs.findIndex(
      (l) => dig(String(l.cpf || "")) === cpfDigits && normPortalNumeroContrato(l.numeroContrato) === nc
    );
    if (idx === -1) return false;
    const loc = locs[idx];
    const arr = materializarPortalLancamentosAluguelMutaveisNoLoc(loc);
    if (!arr || indice < 0 || indice >= arr.length) return false;
    arr.splice(indice, 1);
    return finalizarPersistPortalLancamentosLoc(locs, loc, cpfDigits, nc);
  }

  function atualizarPortalLancamentoAluguelPorIndice(cpfDigits, ncNorm, indice, valorNum, dataPagamentoBr) {
    if (!isPortalTitularAdministrador()) return false;
    if (typeof loadCadastro !== "function" || typeof saveCadastro !== "function" || typeof CAD_LOCACOES_KEY === "undefined") {
      return false;
    }
    const locs = loadCadastro(CAD_LOCACOES_KEY);
    const nc = normPortalNumeroContrato(ncNorm);
    const dig =
      typeof onlyDigits === "function" ? onlyDigits : (s) => String(s ?? "").replace(/\D/g, "");
    const idx = locs.findIndex(
      (l) => dig(String(l.cpf || "")) === cpfDigits && normPortalNumeroContrato(l.numeroContrato) === nc
    );
    if (idx === -1) return false;
    const loc = locs[idx];
    const arr = materializarPortalLancamentosAluguelMutaveisNoLoc(loc);
    if (!arr || indice < 0 || indice >= arr.length) return false;
    const merged = normalizePortalLancamentoAluguelEntry({
      data: String(dataPagamentoBr || "").trim(),
      valor: valorNum,
      valorEspecie: valorNum,
      valorPix: 0,
      valorCartao: 0,
    });
    if (!merged) return false;
    const prev = arr[indice];
    arr[indice] = {
      data: merged.data,
      valor: merged.valor,
      createdAt: typeof prev?.createdAt === "number" && Number.isFinite(prev.createdAt) ? prev.createdAt : Date.now(),
      registradoPorCpf: String(prev?.registradoPorCpf || "").replace(/\D/g, "").slice(0, 11),
      registradoPorNome: String(prev?.registradoPorNome || "").trim(),
      ...(Object.prototype.hasOwnProperty.call(merged, "valorEspecie")
        ? {
            valorEspecie: merged.valorEspecie,
            valorPix: merged.valorPix,
            valorCartao: merged.valorCartao,
          }
        : {}),
    };
    return finalizarPersistPortalLancamentosLoc(locs, loc, cpfDigits, nc);
  }

  function renderOperacaoLancAluguelHistorico() {
    const wrap = document.getElementById("operacaoLancAluguelHistorico");
    if (!wrap) return;
    const inpCpf = document.getElementById("operacaoLancAluguelCpf");
    const sel = document.getElementById("operacaoLancAluguelProtocoloSelect");
    const dig =
      typeof onlyDigits === "function" ? onlyDigits : (s) => String(s ?? "").replace(/\D/g, "");
    const digits = dig(String(inpCpf?.value || ""));
    const proto = normPortalNumeroContrato(sel?.value || "");
    const owner = isPortalTitularAdministrador();
    if (digits.length !== 11 || !proto || !sel || sel.disabled) {
      wrap.classList.add("hidden");
      wrap.replaceChildren();
      return;
    }
    wrap.classList.remove("hidden");
    const loc = collectPortalLocacoesComProtocoloByCpf(digits).find(
      (l) => normPortalNumeroContrato(l.numeroContrato) === proto
    );
    const arr = loc ? getPortalLancamentosAluguelDoContrato(loc) : [];
    if (!arr.length) {
      wrap.innerHTML =
        '<p class="subtext">Nenhum pagamento registado neste protocolo.</p>';
      return;
    }
    const thead = owner
      ? "<thead><tr><th>Data</th><th>Valor (R$)</th><th>Ações</th></tr></thead>"
      : "<thead><tr><th>Data</th><th>Valor (R$)</th></tr></thead>";
    const rows = arr
      .map((x, i) => {
        const v = formatPortalLancamentoSumBrl(x.valor);
        const d = portalEscapeHtml(String(x.data || ""));
        const vv = portalEscapeHtml(v);
        if (owner) {
          return `<tr><td>${d}</td><td>${vv}</td><td class="portal-lanc-hist__actions"><button type="button" class="btn-primary btn-secondary-outline" data-portal-lanc-edit="${i}">Editar</button> <button type="button" class="btn-primary btn-secondary-outline" data-portal-lanc-del="${i}">Apagar</button></td></tr>`;
        }
        return `<tr><td>${d}</td><td>${vv}</td></tr>`;
      })
      .join("");
    wrap.innerHTML = `<p class="subtext operacao-inline-form__lead" style="margin-bottom:0.5rem"><strong>Pagamentos registados</strong></p><table class="portal-lanc-hist" aria-label="Histórico de pagamentos do protocolo">${thead}<tbody>${rows}</tbody></table>`;
  }

  function refreshOperacaoLancAluguelAdminControlsVisibility() {
    const aviso = document.getElementById("operacaoLancAluguelTravaAviso");
    const owner = isPortalTitularAdministrador();
    if (aviso) {
      aviso.classList.toggle("hidden", owner);
    }
    renderOperacaoLancAluguelHistorico();
  }

  let portalLancAluguelEditIndice = -1;

  function openPortalLancAluguelEditModal(indice, valorNum, dataStr) {
    portalLancAluguelEditIndice = indice;
    const modal = document.getElementById("portalLancAluguelEditModal");
    const inpV = document.getElementById("portalLancAluguelEditValor");
    const inpD = document.getElementById("portalLancAluguelEditData");
    if (inpV) {
      inpV.value = Number(valorNum || 0).toLocaleString("pt-BR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    }
    if (inpD) inpD.value = String(dataStr || "").trim();
    if (modal) {
      modal.classList.remove("hidden");
      modal.setAttribute("aria-hidden", "false");
    }
  }

  function closePortalLancAluguelEditModal() {
    portalLancAluguelEditIndice = -1;
    const modal = document.getElementById("portalLancAluguelEditModal");
    if (modal) {
      modal.classList.add("hidden");
      modal.setAttribute("aria-hidden", "true");
    }
  }

  function refreshOperacaoLancamentoAluguelProtocoloSelect(opts = {}) {
    const force = Boolean(opts.force);
    const sel = document.getElementById("operacaoLancAluguelProtocoloSelect");
    const inpCpf = document.getElementById("operacaoLancAluguelCpf");
    const msg = document.getElementById("operacaoLancAluguelInlineMsg");
    if (!sel || !inpCpf) return;
    const digits =
      typeof onlyDigits === "function" ? onlyDigits(inpCpf.value) : String(inpCpf.value || "").replace(/\D/g, "");
    if (digits.length !== 11) {
      portalLancAluguelProtocoloSyncCpf = "";
      sel.disabled = true;
      sel.replaceChildren();
      const o = document.createElement("option");
      o.value = "";
      o.textContent = "Informe um CPF com locação";
      sel.appendChild(o);
      clearOperacaoLancamentoAluguelCamposDerivados();
      refreshOperacaoLancAluguelAdminControlsVisibility();
      return;
    }
    const locs = collectPortalLocacoesComProtocoloByCpf(digits);
    if (locs.length === 0) {
      portalLancAluguelProtocoloSyncCpf = "";
      sel.disabled = true;
      sel.replaceChildren();
      const o = document.createElement("option");
      o.value = "";
      o.textContent = "Nenhum protocolo para este CPF";
      sel.appendChild(o);
      clearOperacaoLancamentoAluguelCamposDerivados();
      if (msg) msg.textContent = "Este CPF não tem locação com protocolo neste navegador. Cadastre a locação primeiro.";
      refreshOperacaoLancAluguelAdminControlsVisibility();
      return;
    }
    if (msg) msg.textContent = "";
    if (!force && digits === portalLancAluguelProtocoloSyncCpf && sel.options.length > 1) {
      refreshOperacaoLancAluguelAdminControlsVisibility();
      return;
    }
    portalLancAluguelProtocoloSyncCpf = digits;
    const byNc = new Map();
    locs.forEach((l) => {
      const nc = normPortalNumeroContrato(l.numeroContrato || "");
      if (nc) byNc.set(nc, l);
    });
    const sorted = Array.from(byNc.keys()).sort((a, b) => a.localeCompare(b, "en"));
    const preserve = String(opts.preserveNc || sel.value || "").trim();
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
    sel.disabled = false;
    const pNorm = preserve ? normPortalNumeroContrato(preserve) : "";
    if (pNorm && sorted.includes(pNorm)) sel.value = pNorm;
    else sel.value = sorted[0];
    const chosen = byNc.get(sel.value);
    if (chosen) applyOperacaoLancamentoAluguelFromLoc(chosen);
  }

  function onOperacaoLancamentoAluguelProtocoloSelectChange() {
    const sel = document.getElementById("operacaoLancAluguelProtocoloSelect");
    const inpCpf = document.getElementById("operacaoLancAluguelCpf");
    if (!sel || sel.disabled || !inpCpf) return;
    const v = String(sel.value || "").trim();
    if (!v) {
      clearOperacaoLancamentoAluguelCamposDerivados();
      refreshOperacaoLancAluguelAdminControlsVisibility();
      return;
    }
    const digits =
      typeof onlyDigits === "function" ? onlyDigits(inpCpf.value) : String(inpCpf.value || "").replace(/\D/g, "");
    const want = normPortalNumeroContrato(v);
    const loc = collectPortalLocacoesComProtocoloByCpf(digits).find((l) => normPortalNumeroContrato(l.numeroContrato) === want);
    if (loc) applyOperacaoLancamentoAluguelFromLoc(loc);
  }

  function syncOperacaoLancamentoAluguelAfterCpfEdit() {
    const inpCpf = document.getElementById("operacaoLancAluguelCpf");
    if (!inpCpf) return;
    const d = (
      typeof onlyDigits === "function" ? onlyDigits(inpCpf.value) : String(inpCpf.value || "").replace(/\D/g, "")
    ).slice(0, 11);
    if (typeof formatCpf === "function") inpCpf.value = formatCpf(d);
    refreshOperacaoLancamentoAluguelCpfDatalist();
    refreshPortalRelClienteCpfDatalist();
    refreshPortalRelPlacaDatalist();
    refreshOperacaoLancamentoAluguelProtocoloSelect({ force: true });
  }

  function clearOperacaoLancamentoAluguelForm() {
    const form = document.getElementById("formOperacaoLancamentoAluguelInline");
    form?.querySelectorAll("input").forEach((inp) => {
      inp.value = "";
    });
    const sel = document.getElementById("operacaoLancAluguelProtocoloSelect");
    if (sel) {
      sel.replaceChildren();
      const o = document.createElement("option");
      o.value = "";
      o.textContent = "Informe um CPF com locação";
      sel.appendChild(o);
      sel.disabled = true;
    }
    clearOperacaoLancamentoAluguelCamposDerivados();
    portalLancAluguelProtocoloSyncCpf = "";
    const msg = document.getElementById("operacaoLancAluguelInlineMsg");
    if (msg) msg.textContent = "";
    refreshOperacaoLancamentoAluguelCpfDatalist();
    refreshPortalRelClienteCpfDatalist();
    refreshPortalRelPlacaDatalist();
    refreshOperacaoLancAluguelAdminControlsVisibility();
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
      if (typeof formatCpf === "function") inpCpf.value = formatCpf(digits);
      if (digits.length === 11 && typeof findClienteByCpfCadastro === "function") {
      const cli = findClienteByCpfCadastro(digits);
      if (cli && inpNome) inpNome.value = String(cli.nome || "").trim();
      }
      refreshOperacaoLocacaoProtocoloPicker({ force: true });
    });

    inpCpf?.addEventListener("input", () => {
      if (!inpCpf) return;
      const digits = (
        typeof onlyDigits === "function" ? onlyDigits(inpCpf.value) : String(inpCpf.value || "").replace(/\D/g, "")
      ).slice(0, 11);
      if (typeof formatCpf === "function") inpCpf.value = formatCpf(digits);
      const dlCpf = document.getElementById("operacaoLocacaoCpfSugestoes");
      const dlNome = document.getElementById("operacaoLocacaoClienteSugestoes");
      const dig = typeof onlyDigits === "function" ? onlyDigits : (s) => String(s ?? "").replace(/\D/g, "");
      const candidatos =
        typeof getLancamentoClienteCandidates === "function" && digits.length
          ? getLancamentoClienteCandidates()
              .filter((c) => dig(String(c.cpf || "")).startsWith(digits))
              .slice(0, 50)
          : [];
        const fmt = typeof formatCpf === "function" ? formatCpf : (cpf) => String(cpf || "");
      if (digits.length) {
        const opts = candidatos
          .map(
            (c) =>
              `<option value="${fmt(c.cpf)}" label="${portalEscapeHtml(String(c.nome || "").trim())}"></option>`
          )
          .join("");
        if (dlCpf) dlCpf.innerHTML = opts;
        if (dlNome) {
        dlNome.innerHTML = candidatos
          .map(
            (c) =>
              `<option value="${portalEscapeHtml(String(c.nome || "").trim())}" label="${fmt(c.cpf)}"></option>`
          )
          .join("");
        }
      } else if (!digits.length) {
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
    syncOperacaoLocacaoValorDevidoAluguel();
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
  document.getElementById("formOperacaoVeiculoInline")?.addEventListener("submit", persistPortalOperacaoVeiculoInlineSubmit);
  const formOperacaoLocacaoInline = document.getElementById("formOperacaoLocacaoInline");
  formOperacaoLocacaoInline?.addEventListener("submit", persistPortalOperacaoLocacaoInlineSubmit);
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

  /** Locações ativas → WhatsApp (número do cadastro do cliente). */
  let portalWaDatasetCache = [];
  /** @type {Array<{ cpf: string, placa: string, nome: string, celularRaw: string, celularWa: string }>} */
  let portalWaPendingPickRows = [];
  /** @type {{ cpf: string, placa: string, nome: string, celularRaw: string, celularWa: string } | null} */
  let portalWaSelectedClienteRow = null;

  function portalWaDig(s) {
    return typeof onlyDigits === "function" ? onlyDigits(s) : String(s ?? "").replace(/\D/g, "");
  }

  function portalWaNormalizePlate(p) {
    return typeof normalizePlate === "function"
      ? normalizePlate(String(p || ""))
      : String(p || "")
          .replace(/\s+/g, "")
          .toUpperCase()
          .replace(/[^A-Z0-9]/g, "");
  }

  function portalWaDigitsForWaMe(raw) {
    let d = portalWaDig(raw);
    if (!d) return "";
    while (d.startsWith("0")) d = d.slice(1);
    if (d.startsWith("55") && d.length >= 12 && d.length <= 13) return d;
    if (d.length === 11) return `55${d}`;
    if (d.length === 10) return `55${d}`;
    if (d.startsWith("55")) return d;
    return d.length >= 12 ? d : "";
  }

  function portalWaBuildClienteDataset() {
    if (typeof loadCadastro !== "function" || typeof CAD_LOCACOES_KEY === "undefined") return [];
    const locs = loadCadastro(CAD_LOCACOES_KEY).filter((l) => !String(l.fim || "").trim());
    const seen = new Set();
    const out = [];
    locs.forEach((loc) => {
      const cpf = portalWaDig(loc.cpf || "");
      if (cpf.length !== 11) return;
      const placa = portalWaNormalizePlate(loc.placa || "");
      if (!placa) return;
      const key = `${cpf}|${placa}`;
      if (seen.has(key)) return;
      seen.add(key);
      const cli =
        typeof findClienteByCpfCadastro === "function" ? findClienteByCpfCadastro(cpf) : null;
      const nome = String(cli?.nome || loc.cliente || "").trim() || "—";
      const celularRaw = String(cli?.celular || "").trim();
      const celularWa = portalWaDigitsForWaMe(celularRaw);
      out.push({ cpf, placa, nome, celularRaw, celularWa });
    });
    out.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    return out;
  }

  function portalWaRebuildDatasetCache() {
    portalWaDatasetCache = portalWaBuildClienteDataset();
  }

  function portalWaHideAllDropdowns() {
    ["portalWaListaCpf", "portalWaListaNome", "portalWaListaPlaca"].forEach((pid) => {
      const panel = document.getElementById(pid);
      if (panel) {
        panel.classList.add("hidden");
        panel.hidden = true;
        panel.innerHTML = "";
      }
    });
    ["portalWaInputCpf", "portalWaInputNome", "portalWaInputPlaca"].forEach((iid) => {
      document.getElementById(iid)?.setAttribute("aria-expanded", "false");
    });
  }

  function portalWaFilterRows(kind, queryRaw) {
    const data = portalWaDatasetCache;
    const q = String(queryRaw || "").trim();
    if (!q) return data.slice();
    if (kind === "cpf") {
      const digits = portalWaDig(q).slice(0, 11);
      if (!digits) return data.slice();
      return data.filter((r) => r.cpf.startsWith(digits));
    }
    if (kind === "placa") {
      const pq = portalWaNormalizePlate(q);
      if (!pq) return data.slice();
      return data.filter((r) => r.placa.includes(pq));
    }
    const nn = typeof normalizeName === "function" ? normalizeName(q) : q.toLowerCase();
    return data.filter((r) => {
      const nk =
        typeof normalizeName === "function"
          ? normalizeName(r.nome)
          : String(r.nome || "").toLowerCase();
      return nk.includes(nn);
    });
  }

  const PORTAL_WA_KIND = {
    cpf: { input: "portalWaInputCpf", panel: "portalWaListaCpf", combo: "portalWaComboCpf" },
    nome: { input: "portalWaInputNome", panel: "portalWaListaNome", combo: "portalWaComboNome" },
    placa: { input: "portalWaInputPlaca", panel: "portalWaListaPlaca", combo: "portalWaComboPlaca" },
  };

  function portalWaRenderDropdown(kind, queryRaw) {
    const cfg = PORTAL_WA_KIND[kind];
    if (!cfg) return;
    const panel = document.getElementById(cfg.panel);
    const inp = document.getElementById(cfg.input);
    if (!panel || !inp) return;
    const rows = portalWaFilterRows(kind, queryRaw).slice(0, 80);
    portalWaPendingPickRows = rows;
    if (!rows.length) {
      panel.innerHTML = `<div class="portal-placa-dropdown__empty">Nenhum resultado.</div>`;
    } else {
      panel.innerHTML = rows
        .map((r, i) => {
          const cpfEx = typeof formatCpf === "function" ? formatCpf(r.cpf) : r.cpf;
          return `<button type="button" class="portal-placa-dropdown__opt" role="option" tabindex="-1" data-wa-i="${i}">
              <span class="portal-placa-dropdown__plate">${portalEscapeHtml(r.placa)}</span>
              <span class="portal-placa-dropdown__model">${portalEscapeHtml(r.nome)} · ${portalEscapeHtml(cpfEx)}</span>
            </button>`;
        })
        .join("");
    }
    panel.classList.remove("hidden");
    panel.hidden = false;
    inp.setAttribute("aria-expanded", "true");
  }

  function portalWaApplyPick(idx) {
    const row = portalWaPendingPickRows[idx];
    if (!row) return;
    const inpCpf = document.getElementById("portalWaInputCpf");
    const inpNome = document.getElementById("portalWaInputNome");
    const inpPlaca = document.getElementById("portalWaInputPlaca");
    const hint = document.getElementById("portalWaSelectedHint");
    const msg = document.getElementById("portalWaMsg");
    if (inpCpf) inpCpf.value = typeof formatCpf === "function" ? formatCpf(row.cpf) : row.cpf;
    if (inpNome) inpNome.value = row.nome;
    if (inpPlaca) inpPlaca.value = row.placa;
    if (hint) {
      hint.textContent = `Selecionado: ${row.nome} · Placa ${row.placa} · Celular no cadastro: ${row.celularRaw || "(vazio)"}`;
    }
    if (msg) msg.textContent = "";
    portalWaSelectedClienteRow = row;
    portalWaHideAllDropdowns();
  }

  function portalWaClearForm() {
    portalWaSelectedClienteRow = null;
    ["portalWaInputCpf", "portalWaInputNome", "portalWaInputPlaca"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.value = "";
    });
    const hint = document.getElementById("portalWaSelectedHint");
    if (hint) hint.textContent = "";
    const msg = document.getElementById("portalWaMsg");
    if (msg) msg.textContent = "";
  }

  function portalWaOpenTodosModal() {
    const modal = document.getElementById("portalWaTodosModal");
    const body = document.getElementById("portalWaTodosModalBody");
    if (!modal || !body) return;
    portalWaRebuildDatasetCache();
    const rows = portalWaDatasetCache.slice();
    if (!rows.length) {
      body.innerHTML = `<p class="subtext">Nenhuma locação ativa (sem data de fim) no cadastro.</p>`;
    } else {
      body.innerHTML = `<ul class="portal-wa-todos-list">${rows
        .map((r) => {
          const cpfEx = typeof formatCpf === "function" ? formatCpf(r.cpf) : r.cpf;
          const waUrl = r.celularWa ? `https://wa.me/${r.celularWa}` : "";
          const link = waUrl
            ? `<a class="btn-primary btn-secondary-outline portal-wa-todos-link" href="${waUrl}" target="_blank" rel="noopener noreferrer">WhatsApp</a>`
            : `<span class="portal-wa-todos-sem-num">Sem celular no cadastro</span>`;
          return `<li class="portal-wa-todos-item">
            <div class="portal-wa-todos-item__main">
              <strong>${portalEscapeHtml(r.nome)}</strong>
              <span class="subtext">${portalEscapeHtml(cpfEx)} · ${portalEscapeHtml(r.placa)}</span>
            </div>
            ${link}
          </li>`;
        })
        .join("")}</ul>`;
    }
    modal.classList.remove("hidden");
    modal.setAttribute("aria-hidden", "false");
  }

  function portalWaCloseTodosModal() {
    const modal = document.getElementById("portalWaTodosModal");
    if (!modal) return;
    modal.classList.add("hidden");
    modal.setAttribute("aria-hidden", "true");
  }

  function bindPortalWhatsAppOperacaoOnce() {
    if (window.__dkPortalWaBound) return;
    window.__dkPortalWaBound = true;

    document.getElementById("portalWaBtnAbrir")?.addEventListener("click", () => {
      const msg = document.getElementById("portalWaMsg");
      const row = portalWaSelectedClienteRow;
      if (!row) {
        if (msg) msg.textContent = "Selecione um cliente na lista (CPF, nome ou placa).";
        return;
      }
      if (!row.celularWa || row.celularWa.length < 12) {
        if (msg) {
          msg.textContent =
            "Este cliente não tem celular válido no cadastro. Complete o campo no cadastro de cliente.";
        }
        return;
      }
      window.open(`https://wa.me/${row.celularWa}`, "_blank", "noopener,noreferrer");
      if (msg) msg.textContent = "";
    });

    document.getElementById("portalWaBtnTodosAtivos")?.addEventListener("click", () => {
      if (!isPortalTitularAdministrador()) return;
      portalWaOpenTodosModal();
    });

    document.getElementById("portalWaTodosModal")?.addEventListener("click", (e) => {
      if (e.target.closest("[data-close-wa-todos]")) portalWaCloseTodosModal();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      const modal = document.getElementById("portalWaTodosModal");
      if (modal && !modal.classList.contains("hidden")) portalWaCloseTodosModal();
    });

    document.addEventListener(
      "click",
      (e) => {
        const open =
          !document.getElementById("portalWaListaCpf")?.classList.contains("hidden") ||
          !document.getElementById("portalWaListaNome")?.classList.contains("hidden") ||
          !document.getElementById("portalWaListaPlaca")?.classList.contains("hidden");
        if (!open) return;
        const t = e.target;
        if (
          document.getElementById("portalWaComboCpf")?.contains(t) ||
          document.getElementById("portalWaComboNome")?.contains(t) ||
          document.getElementById("portalWaComboPlaca")?.contains(t)
        ) {
          return;
        }
        portalWaHideAllDropdowns();
      },
      true
    );

    Object.keys(PORTAL_WA_KIND).forEach((kind) => {
      const cfg = PORTAL_WA_KIND[kind];
      const inp = document.getElementById(cfg.input);
      const panel = document.getElementById(cfg.panel);
      const combo = document.getElementById(cfg.combo);
      if (!inp || !panel || !combo) return;

      inp.addEventListener("focus", () => {
        portalWaRenderDropdown(kind, inp.value);
      });

      inp.addEventListener("keydown", (e) => {
        if (e.key === "Escape") portalWaHideAllDropdowns();
      });

      if (kind === "cpf") {
        inp.addEventListener("input", () => {
          const d = portalWaDig(inp.value).slice(0, 11);
          if (typeof formatCpf === "function") inp.value = formatCpf(d);
          portalWaRenderDropdown("cpf", d);
        });
      } else if (kind === "placa") {
        inp.addEventListener("input", () => {
          inp.value = String(inp.value || "").toUpperCase();
          portalWaRenderDropdown("placa", inp.value);
        });
      } else {
        inp.addEventListener("input", () => {
          portalWaRenderDropdown("nome", inp.value);
        });
      }

      panel.addEventListener("mousedown", (e) => {
        if (e.target.closest(".portal-placa-dropdown__opt")) e.preventDefault();
      });
      panel.addEventListener("click", (e) => {
        const btn = e.target.closest(".portal-placa-dropdown__opt");
        if (!btn) return;
        const i = Number(btn.getAttribute("data-wa-i"));
        if (!Number.isFinite(i)) return;
        portalWaApplyPick(i);
        inp.focus();
      });

      inp.addEventListener("focusout", (e) => {
        const rt = e.relatedTarget;
        if (rt && combo.contains(rt)) return;
        window.setTimeout(() => {
          if (!combo.contains(document.activeElement)) portalWaHideAllDropdowns();
        }, 180);
      });
    });
  }

  bindPortalWhatsAppOperacaoOnce();

  document.getElementById("btn-operacao-falar-cliente")?.addEventListener("click", async () => {
    await portalOperacaoAwaitCloudCadastroPull();
    hideOperacaoInlineFormsCore();
    portalWaRebuildDatasetCache();
    portalWaClearForm();
    portalWaHideAllDropdowns();
    document.getElementById("operacaoInlineWhatsApp")?.classList.remove("hidden");
    setOperacaoFormPlaceholderVisible(false);
    syncOperacaoCadastroButtons("btn-operacao-falar-cliente");
  });

  document.getElementById("btn-operacao-cadastro-cliente")?.addEventListener("click", async () => {
    await portalOperacaoAwaitCloudCadastroPull();
    hideOperacaoInlineFormsCore();
    document.getElementById("operacaoInlineCliente")?.classList.remove("hidden");
    setOperacaoFormPlaceholderVisible(false);
    syncOperacaoCadastroButtons("btn-operacao-cadastro-cliente");
  });
  document.getElementById("btn-operacao-cadastro-veiculo")?.addEventListener("click", async () => {
    await portalOperacaoAwaitCloudCadastroPull();
    hideOperacaoInlineFormsCore();
    document.getElementById("operacaoInlineVeiculo")?.classList.remove("hidden");
    setOperacaoFormPlaceholderVisible(false);
    syncOperacaoCadastroButtons("btn-operacao-cadastro-veiculo");
  });
  document.getElementById("btn-operacao-cadastro-locacao")?.addEventListener("click", async () => {
    await portalOperacaoAwaitCloudCadastroPull();
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

  document.getElementById("btn-operacao-lancamento-aluguel")?.addEventListener("click", async () => {
    await portalOperacaoAwaitCloudCadastroPull();
    hideOperacaoInlineFormsCore();
    document.getElementById("operacaoInlineLancamentoAluguel")?.classList.remove("hidden");
    setOperacaoFormPlaceholderVisible(false);
    syncOperacaoCadastroButtons("btn-operacao-lancamento-aluguel");
    refreshOperacaoLancamentoAluguelCpfDatalist();
    refreshPortalRelClienteCpfDatalist();
    refreshPortalRelPlacaDatalist();
    syncOperacaoLancamentoAluguelAfterCpfEdit();
    refreshOperacaoLancAluguelAdminControlsVisibility();
  });

  document.getElementById("btn-operacao-cadastro-colaborador")?.addEventListener("click", async () => {
    if (!isPortalTitularAdministrador()) return;
    await portalOperacaoAwaitCloudCadastroPull();
    hideOperacaoInlineFormsCore();
    document.getElementById("operacaoInlineColaborador")?.classList.remove("hidden");
    setOperacaoFormPlaceholderVisible(false);
    syncOperacaoCadastroButtons("btn-operacao-cadastro-colaborador");
    syncPortalColaboradorFormFromCpf();
  });

  document.getElementById("operacaoLancAluguelProtocoloSelect")?.addEventListener("change", () =>
    onOperacaoLancamentoAluguelProtocoloSelectChange()
  );
  ["operacaoLancAluguelValorEspecie", "operacaoLancAluguelValorPix", "operacaoLancAluguelValorCartao"].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener("input", () => syncOperacaoLancAluguelValorPagoFromMeios());
    el.addEventListener("blur", () => syncOperacaoLancAluguelValorPagoFromMeios());
  });
  document.getElementById("operacaoLancAluguelCpf")?.addEventListener("blur", () => syncOperacaoLancamentoAluguelAfterCpfEdit());
  document.getElementById("operacaoLancAluguelCpf")?.addEventListener("input", () => {
    const inp = document.getElementById("operacaoLancAluguelCpf");
    if (!inp) return;
    const digits = (
      typeof onlyDigits === "function" ? onlyDigits(inp.value) : String(inp.value || "").replace(/\D/g, "")
    ).slice(0, 11);
    if (typeof formatCpf === "function") inp.value = formatCpf(digits);
    const msg = document.getElementById("operacaoLancAluguelInlineMsg");
    if (msg) msg.textContent = "";
    refreshOperacaoLancamentoAluguelCpfDatalist();
    refreshPortalRelClienteCpfDatalist();
    refreshPortalRelPlacaDatalist();
    refreshOperacaoLancamentoAluguelProtocoloSelect({ force: true });
  });

  /** Máscara 000.000.000-00 + datalist enquanto digita (padrão portal CPF cliente). */
  document.getElementById("portalRelClienteCpf")?.addEventListener("blur", () => {
    const inp = document.getElementById("portalRelClienteCpf");
    if (!inp || typeof formatCpf !== "function") return;
    const digits = (
      typeof onlyDigits === "function" ? onlyDigits(inp.value) : String(inp.value || "").replace(/\D/g, "")
    ).slice(0, 11);
    if (digits.length === 11) inp.value = formatCpf(digits);
  });
  document.getElementById("portalRelClienteCpf")?.addEventListener("input", () => {
    const inp = document.getElementById("portalRelClienteCpf");
    if (!inp) return;
    const digits = (
      typeof onlyDigits === "function" ? onlyDigits(inp.value) : String(inp.value || "").replace(/\D/g, "")
    ).slice(0, 11);
    if (typeof formatCpf === "function") inp.value = formatCpf(digits);
    refreshPortalRelClienteCpfDatalist();
    refreshPortalRelPlacaDatalist();
  });

  document.getElementById("portalRelPlaca")?.addEventListener("input", () => {
    const inp = document.getElementById("portalRelPlaca");
    if (!inp) return;
    if (typeof normalizePlate === "function") {
      inp.value = normalizePlate(inp.value);
    } else {
      inp.value = String(inp.value || "")
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "");
    }
    refreshPortalRelPlacaDatalist();
  });

  document.getElementById("operacaoLancAluguelLimparBtn")?.addEventListener("click", (e) => {
    e.preventDefault();
    clearOperacaoLancamentoAluguelForm();
  });

  document.getElementById("portalLancAluguelConfirmSimBtn")?.addEventListener("click", () => {
    const fn = portalLancAluguelConfirmCallback;
    closePortalLancAluguelConfirmModal();
    if (typeof fn === "function") fn();
  });
  document.getElementById("portalLancAluguelConfirmNaoBtn")?.addEventListener("click", () => closePortalLancAluguelConfirmModal());
  document.querySelectorAll("[data-close-lanc-aluguel-confirm]").forEach((el) => {
    el.addEventListener("click", () => closePortalLancAluguelConfirmModal());
  });

  document.getElementById("portalLancAluguelEditCancelarBtn")?.addEventListener("click", () => closePortalLancAluguelEditModal());
  document.querySelectorAll("[data-close-lanc-aluguel-edit]").forEach((el) => {
    el.addEventListener("click", () => closePortalLancAluguelEditModal());
  });

  document.getElementById("portalLancAluguelEditSalvarBtn")?.addEventListener("click", () => {
    const msg = document.getElementById("operacaoLancAluguelInlineMsg");
    if (!isPortalTitularAdministrador()) {
      window.alert("Apenas o administrador pode alterar pagamentos já registados.");
      closePortalLancAluguelEditModal();
      return;
    }
    const indice = portalLancAluguelEditIndice;
    if (indice < 0) {
      closePortalLancAluguelEditModal();
      return;
    }
    const inpCpf = document.getElementById("operacaoLancAluguelCpf");
    const sel = document.getElementById("operacaoLancAluguelProtocoloSelect");
    const inpV = document.getElementById("portalLancAluguelEditValor");
    const inpD = document.getElementById("portalLancAluguelEditData");
    const dig =
      typeof onlyDigits === "function" ? onlyDigits : (s) => String(s ?? "").replace(/\D/g, "");
    const digits = dig(String(inpCpf?.value || ""));
    const proto = normPortalNumeroContrato(sel?.value || "");
    const parseVal =
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
    const valorNum = Number(parseVal(String(inpV?.value || "")));
    const dataStr = String(inpD?.value || "").trim();
    if (digits.length !== 11 || !proto) {
      if (msg) msg.textContent = "Informe CPF e protocolo.";
      return;
    }
    if (!Number.isFinite(valorNum) || valorNum <= 0) {
      if (msg) msg.textContent = "Informe um valor pago válido.";
      return;
    }
    const dtp = typeof parseBrDate === "function" ? parseBrDate(dataStr) : null;
    if (!dataStr || !dtp || Number.isNaN(dtp.getTime())) {
      if (msg) msg.textContent = "Informe a data do pagamento (DD/MM/AAAA).";
      return;
    }
    if (msg) msg.textContent = "";
    if (atualizarPortalLancamentoAluguelPorIndice(digits, proto, indice, valorNum, dataStr)) {
      closePortalLancAluguelEditModal();
      const loc2 = collectPortalLocacoesComProtocoloByCpf(digits).find(
        (l) => normPortalNumeroContrato(l.numeroContrato) === proto
      );
      if (loc2) applyOperacaoLancamentoAluguelFromLoc(loc2);
      if (msg) msg.textContent = "Pagamento atualizado. Totais recalculados.";
    } else if (msg) {
      msg.textContent = "Não foi possível guardar a alteração.";
    }
  });

  document.getElementById("operacaoInlineLancamentoAluguel")?.addEventListener("click", (e) => {
    const t = e.target;
    if (!(t instanceof Element)) return;
    const editEl = t.closest("[data-portal-lanc-edit]");
    const delEl = t.closest("[data-portal-lanc-del]");
    if (!editEl && !delEl) return;
    e.preventDefault();
    const msg = document.getElementById("operacaoLancAluguelInlineMsg");
    if (!isPortalTitularAdministrador()) {
      window.alert("Apenas o administrador pode alterar ou apagar pagamentos já registados.");
      return;
    }
    const inpCpf = document.getElementById("operacaoLancAluguelCpf");
    const sel = document.getElementById("operacaoLancAluguelProtocoloSelect");
    const dig =
      typeof onlyDigits === "function" ? onlyDigits : (s) => String(s ?? "").replace(/\D/g, "");
    const digits = dig(String(inpCpf?.value || ""));
    const proto = normPortalNumeroContrato(sel?.value || "");
    if (digits.length !== 11 || !proto) {
      if (msg) msg.textContent = "Informe CPF e protocolo.";
      return;
    }
    const locAtual = collectPortalLocacoesComProtocoloByCpf(digits).find(
      (l) => normPortalNumeroContrato(l.numeroContrato) === proto
    );
    const arr = locAtual ? getPortalLancamentosAluguelDoContrato(locAtual) : [];
    const rawIdx = editEl ? editEl.getAttribute("data-portal-lanc-edit") : delEl?.getAttribute("data-portal-lanc-del");
    const indice = rawIdx != null ? Number(rawIdx) : NaN;
    if (!Number.isInteger(indice) || indice < 0 || indice >= arr.length) return;
    if (editEl) {
      const row = arr[indice];
      openPortalLancAluguelEditModal(indice, row.valor, row.data);
      return;
    }
    const row = arr[indice];
    if (
      !window.confirm(
        `Apagar o pagamento de ${formatPortalLancamentoSumBrl(row.valor)} em ${row.data}? Só o administrador pode fazer esta operação.`
      )
    ) {
      return;
    }
    if (apagarPortalLancamentoAluguelPorIndice(digits, proto, indice)) {
      const loc2 = collectPortalLocacoesComProtocoloByCpf(digits).find(
        (l) => normPortalNumeroContrato(l.numeroContrato) === proto
      );
      if (loc2) applyOperacaoLancamentoAluguelFromLoc(loc2);
      if (msg) msg.textContent = "Pagamento removido. Totais atualizados.";
    } else if (msg) msg.textContent = "Não foi possível apagar o pagamento.";
  });

  document.getElementById("operacaoLancAluguelConfirmarPagamentoBtn")?.addEventListener("click", (e) => {
    e.preventDefault();
    const inpCpf = document.getElementById("operacaoLancAluguelCpf");
    const sel = document.getElementById("operacaoLancAluguelProtocoloSelect");
    const inpValor = document.getElementById("operacaoLancAluguelValorPago");
    const inpEsp = document.getElementById("operacaoLancAluguelValorEspecie");
    const inpPix = document.getElementById("operacaoLancAluguelValorPix");
    const inpCart = document.getElementById("operacaoLancAluguelValorCartao");
    const inpData = document.getElementById("operacaoLancAluguelDataPagamento");
    const msg = document.getElementById("operacaoLancAluguelInlineMsg");
    if (!getPortalSessaoAdminRole()) {
      if (msg) msg.textContent = "Inicie sessão como colaborador ou administrador para registar pagamentos.";
      return;
    }
    const digits =
      typeof onlyDigits === "function" ? onlyDigits(inpCpf?.value || "") : String(inpCpf?.value || "").replace(/\D/g, "");
    const proto = normPortalNumeroContrato(sel?.value || "");
    const parseVal =
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
    syncOperacaoLancAluguelValorPagoFromMeios();
    const ve = Number(parseVal(String(inpEsp?.value || "")));
    const vp = Number(parseVal(String(inpPix?.value || "")));
    const vc = Number(parseVal(String(inpCart?.value || "")));
    const valorNum = ve + vp + vc;
    const dataStr = String(inpData?.value || "").trim();
    if (digits.length !== 11 || !proto) {
      if (msg) msg.textContent = "Informe CPF e protocolo com locação.";
      return;
    }
    if (!Number.isFinite(valorNum) || valorNum <= 0) {
      if (msg) msg.textContent = "Informe valores em espécie, Pix e/ou cartão (a soma é o valor pago).";
      return;
    }
    const dtp = typeof parseBrDate === "function" ? parseBrDate(dataStr) : null;
    if (!dataStr || !dtp || Number.isNaN(dtp.getTime())) {
      if (msg) msg.textContent = "Informe a data do pagamento (DD/MM/AAAA).";
      return;
    }
    if (msg) msg.textContent = "";
    const nome =
      typeof findClienteByCpfCadastro === "function"
        ? String(findClienteByCpfCadastro(digits)?.nome || "").trim()
        : "";
    const nomeExibir = nome || "—";
    const cpfFmt = typeof formatCpf === "function" ? formatCpf(digits) : digits;
    const valorFmt = Number(valorNum).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const texto = `Pagamento de ${valorFmt} na data de ${dataStr} para o cliente ${nomeExibir} CPF ${cpfFmt} protocolo ${proto}.`;
    openPortalLancAluguelConfirmModal(texto, () => {
      const ok = persistPortalLancamentoAluguelPagamento(digits, proto, valorNum, dataStr, {
        valorEspecie: ve,
        valorPix: vp,
        valorCartao: vc,
      });
      if (ok) {
        if (msg) msg.textContent = "Pagamento registado. O total em «Cadastro de locação» foi atualizado.";
        if (inpEsp) inpEsp.value = "";
        if (inpPix) inpPix.value = "";
        if (inpCart) inpCart.value = "";
        if (inpValor) inpValor.value = "";
        if (inpData) inpData.value = "";
        const locAtual = collectPortalLocacoesComProtocoloByCpf(digits).find(
          (l) => normPortalNumeroContrato(l.numeroContrato) === proto
        );
        if (locAtual) applyOperacaoLancamentoAluguelFromLoc(locAtual);
      } else if (msg) {
        msg.textContent = !getPortalSessaoAdminRole()
          ? "Sessão expirada ou sem permissão. Inicie sessão novamente."
          : "Não foi possível guardar o pagamento.";
      }
    });
  });

  ["operacaoClienteVoltarBtn", "operacaoVeiculoVoltarBtn", "operacaoLocacaoVoltarBtn", "operacaoLancAluguelVoltarBtn"].forEach((id) => {
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
      btnManutencao?.classList.toggle("hidden", !allowOp);
    } else {
      if (logadoTitulo) logadoTitulo.textContent = "Área do cliente";
      if (logadoTexto) logadoTexto.textContent = `Olá, ${String(session.nome || "").trim() || "cliente"}.`;
      btnOperacao?.classList.add("hidden");
      btnManutencao?.classList.add("hidden");
    }
    refreshPortalUnitLeadForSession();
    refreshPortalOperacaoNavPorAcessos();
    refreshOperacaoLancAluguelAdminControlsVisibility();
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

  [
    "form-login",
    "form-nova-senha",
    "formOperacaoClienteInline",
    "formOperacaoVeiculoInline",
    "formOperacaoLocacaoInline",
    "formOperacaoLancamentoAluguelInline",
  ].forEach((id) => bindEnterAdvancesToNextField(document.getElementById(id)));

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

  /** Sincroniza cadastros (clientes, veículos, locações) entre localhost e produção via API Vercel + Upstash Redis. */
  (function dkPortalCadastroCloudSync() {
    if (!window.DK_PORTAL_LOCADORA_PAGE) return;
    if (
      typeof saveCadastro !== "function" ||
      typeof loadCadastro !== "function" ||
      typeof CAD_CLIENTES_KEY === "undefined" ||
      typeof CAD_VEICULOS_KEY === "undefined" ||
      typeof CAD_LOCACOES_KEY === "undefined"
    ) {
      return;
    }

    let dkPortalCadastroSyncSuppressPush = false;
    const dkPortalCadastroPushTimers = Object.create(null);

    function dkPortalSyncApiUrlsFor(apiFile) {
      const meta = document
        .querySelector('meta[name="dk-cadastro-sync-origin"]')
        ?.getAttribute("content")
        ?.trim()
        .replace(/\/$/, "");
      const h = window.location.hostname;
      const isLocal = h === "localhost" || h === "127.0.0.1";
      const localUrl = `${window.location.origin}/api/${apiFile}`;
      if (isLocal && meta) return [localUrl, `${meta}/api/${apiFile}`];
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

    function dkPortalMergeVeiculosArrays(local, remote) {
      const plateNorm = (p) =>
        typeof normalizePlate === "function"
          ? normalizePlate(String(p || ""))
          : String(p || "")
              .toUpperCase()
              .replace(/[^A-Z0-9]/g, "");
      const keyOf = (v) => {
        const pl = plateNorm(v.placa);
        if (pl) return pl;
        const idn = Number(v.id || v.createdAt || 0);
        return idn ? `id:${idn}` : "";
      };
      const byKey = new Map();
      const score = (v) => Number(v.updatedAt || v.createdAt || v.id || 0);
      const add = (v) => {
        const k = keyOf(v);
        if (!k) return;
        const prev = byKey.get(k);
        const merged = prev ? { ...prev, ...v } : { ...v };
        if (!prev) {
          byKey.set(k, merged);
          return;
        }
        if (score(v) > score(prev)) {
          byKey.set(k, merged);
          return;
        }
        if (score(v) === score(prev) && JSON.stringify(v).length >= JSON.stringify(prev).length) {
          byKey.set(k, merged);
        }
      };
      (local || []).forEach(add);
      (remote || []).forEach(add);
      return Array.from(byKey.values());
    }

    function dkPortalMergeLocacoesArrays(local, remote) {
      const mergePlEmb =
        typeof window.__DK_mergePortalLancamentosAluguelEmbutidos === "function"
          ? window.__DK_mergePortalLancamentosAluguelEmbutidos
          : (arrays) => {
              const flat = (arrays || []).flat().filter((x) => Array.isArray(x));
              return flat.flat();
            };
      const dig = (cpf) =>
        typeof onlyDigits === "function" ? onlyDigits(String(cpf || "")) : String(cpf || "").replace(/\D/g, "");
      const plateNorm = (p) =>
        typeof normalizePlate === "function"
          ? normalizePlate(String(p || ""))
          : String(p || "")
              .toUpperCase()
              .replace(/[^A-Z0-9]/g, "");
      const ncNorm = (v) =>
        typeof normalizeNumeroContratoKey === "function"
          ? String(normalizeNumeroContratoKey(v || "")).replace(/\s+/g, "")
          : String(v ?? "")
              .trim()
              .toUpperCase()
              .replace(/\s+/g, "");
      const keyOf = (l) => {
        const cpf = dig(l.cpf);
        const pl = plateNorm(l.placa);
        const nc = ncNorm(l.numeroContrato);
        if (cpf.length === 11 && pl && nc) return `${cpf}|${pl}|${nc}`;
        const idn = Number(l.id || l.createdAt || 0);
        return `${cpf}|${pl}|id:${idn}`;
      };
      const byKey = new Map();
      const score = (l) => Number(l.updatedAt || l.createdAt || l.id || 0);
      const add = (l) => {
        const k = keyOf(l);
        const prev = byKey.get(k);
        const mergedPl = mergePlEmb([prev?.portalLancamentosAluguel, l?.portalLancamentosAluguel]);
        if (!prev) {
          const merged = { ...l };
          if (mergedPl.length) merged.portalLancamentosAluguel = mergedPl;
          byKey.set(k, merged);
          return;
        }
        const merged = { ...prev, ...l };
        if (mergedPl.length) merged.portalLancamentosAluguel = mergedPl;
        const syncLoc =
          typeof window.__DK_mergeLocacaoCamposSincronizacaoPortal === "function"
            ? window.__DK_mergeLocacaoCamposSincronizacaoPortal(prev, l)
            : {};
        Object.assign(merged, syncLoc);
        if (score(l) > score(prev)) {
          byKey.set(k, merged);
          return;
        }
        if (score(l) === score(prev) && JSON.stringify(l).length >= JSON.stringify(prev).length) {
          byKey.set(k, merged);
          return;
        }
        const stay = { ...prev };
        if (mergedPl.length) stay.portalLancamentosAluguel = mergedPl;
        Object.assign(stay, syncLoc);
        byKey.set(k, stay);
      };
      (local || []).forEach(add);
      (remote || []).forEach(add);
      return Array.from(byKey.values());
    }

    async function dkPortalPushToApi(apiFile, list) {
      const urls = dkPortalSyncApiUrlsFor(apiFile);
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

    /** Após qualquer guardar em clientes/veículos/locações, envia snapshot completo (3 listas) para o Redis — mesmo estado na nuvem para todos os PCs. */
    const DK_PORTAL_SNAPSHOT_TIMER_KEY = "__full_snapshot__";

    function dkPortalScheduleFullCadastroSnapshotPush() {
      clearTimeout(dkPortalCadastroPushTimers[DK_PORTAL_SNAPSHOT_TIMER_KEY]);
      dkPortalCadastroPushTimers[DK_PORTAL_SNAPSHOT_TIMER_KEY] = setTimeout(async () => {
        if (dkPortalCadastroSyncSuppressPush) return;
        const clientes = loadCadastro(CAD_CLIENTES_KEY);
        const veiculos = loadCadastro(CAD_VEICULOS_KEY);
        const locacoes = loadCadastro(CAD_LOCACOES_KEY);
        await Promise.all([
          dkPortalPushToApi("cadastro-clientes", Array.isArray(clientes) ? clientes : []),
          dkPortalPushToApi("cadastro-veiculos", Array.isArray(veiculos) ? veiculos : []),
          dkPortalPushToApi("cadastro-locacoes", Array.isArray(locacoes) ? locacoes : []),
        ]);
      }, 1500);
    }

    const origSave = saveCadastro;
    window.saveCadastro = function dkPortalSaveCadastroWrapped(key, list) {
      origSave(key, list);
      if (!Array.isArray(list) || dkPortalCadastroSyncSuppressPush) return;
      if (key === CAD_CLIENTES_KEY || key === CAD_VEICULOS_KEY || key === CAD_LOCACOES_KEY) {
        dkPortalScheduleFullCadastroSnapshotPush();
      }
    };

    async function dkPortalPullOne(apiFile, storageKey, mergeFn) {
      const urls = dkPortalSyncApiUrlsFor(apiFile);
      for (let i = 0; i < urls.length; i += 1) {
        const url = urls[i];
        try {
          const r = await fetch(url, { method: "GET" });
          const j = await r.json().catch(() => ({}));
          if (!r.ok || !j.ok || !Array.isArray(j.data)) continue;
          const local = loadCadastro(storageKey);
          if (!j.data.length && Array.isArray(local) && local.length) {
            dkPortalScheduleFullCadastroSnapshotPush();
            return;
          }
          const merged = mergeFn(local, j.data);
          if (JSON.stringify(merged) === JSON.stringify(local)) return;
          dkPortalCadastroSyncSuppressPush = true;
          origSave(storageKey, merged);
          dkPortalCadastroSyncSuppressPush = false;
          dkPortalScheduleFullCadastroSnapshotPush();
          return;
        } catch (e) {
          if (i === urls.length - 1) {
            console.warn("[DK portal] sync pull", apiFile, e);
          }
        }
      }
    }

    async function dkPortalPullAndMergeAll() {
      await Promise.all([
        dkPortalPullOne("cadastro-clientes", CAD_CLIENTES_KEY, dkPortalMergeClientesArrays),
        dkPortalPullOne("cadastro-veiculos", CAD_VEICULOS_KEY, dkPortalMergeVeiculosArrays),
        dkPortalPullOne("cadastro-locacoes", CAD_LOCACOES_KEY, dkPortalMergeLocacoesArrays),
      ]);
    }

    window.__DK_portalPullCadastroFromCloud = dkPortalPullAndMergeAll;

    setTimeout(dkPortalPullAndMergeAll, 800);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") dkPortalPullAndMergeAll();
    });
  })();

  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      hydrateOperacaoLocacaoFromQueryParams();
      const locCpfHydrate = document.getElementById("operacaoLocacaoCpf");
      if (locCpfHydrate && typeof formatCpf === "function") {
        const dh =
          typeof onlyDigits === "function"
            ? onlyDigits(String(locCpfHydrate.value || ""))
            : String(locCpfHydrate.value || "").replace(/\D/g, "");
        if (dh) locCpfHydrate.value = formatCpf(dh.slice(0, 11));
      }
      normalizePortalDateInputsExistingValues();
      bindPortalDateDdMmYyyyInputs();
      syncOperacaoLancAluguelValorPagoFromMeios();
      syncOperacaoLocacaoFromDataInicio();
      syncOperacaoLocacaoValorPlano();
      refreshOperacaoLocacaoProtocoloPicker({ force: true });
      refreshPortalRelClienteCpfDatalist();
      refreshPortalRelPlacaDatalist();
      syncPortalIfSession();
    })
  );
})();

