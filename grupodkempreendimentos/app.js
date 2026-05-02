(function () {
  const STORAGE_USERS = "grupo_dk_portal_users_v1";
  const STORAGE_SESSION = "grupo_dk_portal_session_v1";
  const INITIAL_PASSWORD = "123456";
  const DEFAULT_ADMIN_CPFS = ["03037897430", "80163513104"];

  /**
   * URL do index.html do sistema de cadastros DK.
   * Ordem: window.DK_SISTEMA_CADASTROS_URL → &lt;meta name="dk-sistema-cadastros-url" content="..."&gt; → vazio (usa caminhos relativos).
   */
  function getDkSistemaCadastrosBase() {
    if (typeof window.DK_SISTEMA_CADASTROS_URL === "string" && window.DK_SISTEMA_CADASTROS_URL.trim()) {
      return window.DK_SISTEMA_CADASTROS_URL.trim().replace(/\/$/, "");
    }
    const meta = document.querySelector('meta[name="dk-sistema-cadastros-url"]');
    const fromMeta = meta && String(meta.getAttribute("content") || "").trim();
    if (fromMeta) return fromMeta.replace(/\/$/, "");
    return "";
  }

  /** Caminhos opcionais (relativos à página do portal) quando ../index.html aponta para o próprio index. */
  function defaultCadastroBaseRelCandidates() {
    const list = [];
    if (
      typeof window.DK_SISTEMA_CADASTROS_REL === "string" &&
      window.DK_SISTEMA_CADASTROS_REL.trim()
    ) {
      list.push(window.DK_SISTEMA_CADASTROS_REL.trim());
    }
    list.push("../index.html");
    try {
      const path = window.location.pathname || "";
      if (path.includes("grupodkempreendimentos")) {
        list.push("../../index.html");
      }
    } catch {
      /* ignore */
    }
    return list;
  }

  /** URL completo do index do sistema DK + hash (#operacao-cliente / #operacao-veiculo). */
  function resolveSistemaCadastroUrl(hash) {
    const base = getDkSistemaCadastrosBase();
    if (base) return `${base.replace(/\/$/, "")}#${hash}`;
    for (const rel of defaultCadastroBaseRelCandidates()) {
      try {
        const u = new URL(rel, window.location.href);
        const withHash = `${u.href.replace(/\/$/, "")}#${hash}`;
        if (!isSamePageAsPortal(withHash)) return withHash;
      } catch {
        /* tenta próximo */
      }
    }
    try {
      const u = new URL("../index.html", window.location.href);
      return `${u.href.replace(/\/$/, "")}#${hash}`;
    } catch {
      return `#${hash}`;
    }
  }

  function normalizedPath(pathname) {
    const p = pathname || "/";
    if (p === "/" || p === "") return "/index.html";
    return p;
  }

  /** Mesmo documento do portal (evita #operacao-cliente no próprio index do grupo). */
  function isSamePageAsPortal(fullUrlWithHash) {
    if (!fullUrlWithHash || fullUrlWithHash.startsWith("#")) return true;
    try {
      const target = new URL(fullUrlWithHash, window.location.href);
      const here = new URL(window.location.href);
      if (target.origin !== here.origin) return false;
      return normalizedPath(target.pathname) === normalizedPath(here.pathname);
    } catch {
      return true;
    }
  }

  function persistOperacaoTabForDk(hash) {
    const tab = hash === "operacao-veiculo" ? "veiculo" : "cliente";
    try {
      sessionStorage.setItem("dk_operacao_open", tab);
    } catch {
      /* ignore */
    }
  }

  function openSistemaCadastro(hash) {
    persistOperacaoTabForDk(hash);
    const url = resolveSistemaCadastroUrl(hash);
    if (isSamePageAsPortal(url)) {
      window.alert(
        "Este portal está no mesmo endereço que o sistema DK, ou o cadastro não está na pasta esperada.\n\n" +
          "No head do index do portal, defina a meta dk-sistema-cadastros-url com o URL absoluto do index do sistema DK, " +
          "ou no console: window.DK_SISTEMA_CADASTROS_URL = \"https://.../index.html\""
      );
      return;
    }
    window.location.assign(url);
  }

  const UNIT_LABELS = {
    locadora: "DK Locadora",
    centro: "DK Centro Automotivo",
    construtora: "DK Construtora",
  };

  const ROLE_LABELS = {
    cliente: "Cliente",
    colaborador: "Colaborador",
    administrador: "Administrador",
  };

  const views = {
    home: document.getElementById("view-home"),
    unit: document.getElementById("view-unit"),
  };

  const unitTitleEl = document.getElementById("unit-page-title");
  const roleButtons = document.querySelectorAll(".role-picker__btn");
  const panelLogin = document.getElementById("panel-login");
  const panelSenha = document.getElementById("panel-senha");
  const panelLogado = document.getElementById("panel-logado");
  const loginPanelTitle = document.getElementById("login-panel-title");
  const formLogin = document.getElementById("form-login");
  const formNovaSenha = document.getElementById("form-nova-senha");
  const loginUnitInput = document.getElementById("login-unit");
  const loginRoleInput = document.getElementById("login-role");
  const loginCpfInput = document.getElementById("login-cpf");
  const loginSenhaInput = document.getElementById("login-senha");
  const loginFeedback = document.getElementById("login-feedback");
  const senhaFeedback = document.getElementById("senha-feedback");
  const logadoTitulo = document.getElementById("logado-titulo");
  const logadoTexto = document.getElementById("logado-texto");
  const btnSair = document.getElementById("btn-sair");
  const btnLocadoraOperacao = document.getElementById("btn-locadora-operacao");
  const panelOperacaoLocadora = document.getElementById("panel-operacao-locadora");
  const btnVoltarOperacaoLocadora = document.getElementById("btn-voltar-operacao-locadora");
  const rolePickerEl = document.querySelector(".role-picker");

  let currentUnit = null;
  let selectedRole = null;
  let pendingPasswordChange = null;

  function onlyDigits(s) {
    return String(s || "").replace(/\D/g, "");
  }

  function formatCpf(digits) {
    const d = onlyDigits(digits).slice(0, 11);
    if (d.length <= 3) return d;
    if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
    if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
    return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
  }

  function userKey(unit, role, cpf) {
    return `${unit}|${role}|${onlyDigits(cpf)}`;
  }

  function loadUsers() {
    try {
      const raw = localStorage.getItem(STORAGE_USERS);
      if (!raw) return {};
      const p = JSON.parse(raw);
      return p && typeof p === "object" && !Array.isArray(p) ? p : {};
    } catch {
      return {};
    }
  }

  function saveUsers(obj) {
    localStorage.setItem(STORAGE_USERS, JSON.stringify(obj));
  }

  function ensureDefaultAdmins(unit) {
    const all = loadUsers();
    let changed = false;
    for (const cpf of DEFAULT_ADMIN_CPFS) {
      const d = onlyDigits(cpf);
      if (d.length !== 11) continue;
      const k = userKey(unit, "administrador", d);
      if (!all[k]) {
        all[k] = {
          unit,
          role: "administrador",
          cpf: d,
          senha: INITIAL_PASSWORD,
          mustChangePassword: true,
        };
        changed = true;
      }
    }
    if (changed) saveUsers(all);
  }

  function getSession() {
    try {
      const raw = sessionStorage.getItem(STORAGE_SESSION);
      if (!raw) return null;
      const s = JSON.parse(raw);
      if (!s || !s.unit || !s.role || !s.cpf) return null;
      return s;
    } catch {
      return null;
    }
  }

  function setSession(data) {
    if (!data) {
      sessionStorage.removeItem(STORAGE_SESSION);
      return;
    }
    sessionStorage.setItem(STORAGE_SESSION, JSON.stringify(data));
  }

  function setViewVisibility(el, active) {
    if (!el) return;
    el.classList.toggle("view--active", active);
    el.setAttribute("aria-hidden", active ? "false" : "true");
  }

  function showHome() {
    currentUnit = null;
    selectedRole = null;
    pendingPasswordChange = null;
    setViewVisibility(views.home, true);
    setViewVisibility(views.unit, false);
    document.title = "Grupo DK Empreendimentos";
    history.replaceState(null, "", window.location.pathname + window.location.search);
    hideAllPanels();
    resetRolePicker();
    setRolePickerVisible(true);
    if (formLogin) formLogin.reset();
    if (formNovaSenha) formNovaSenha.reset();
  }

  function hideAllPanels() {
    [panelLogin, panelSenha, panelLogado, panelOperacaoLocadora].forEach((p) => {
      if (p) p.classList.add("hidden");
    });
  }

  function updateLocadoraOperacaoButton(sess) {
    if (!btnLocadoraOperacao) return;
    const show = Boolean(sess && sess.unit === "locadora");
    btnLocadoraOperacao.classList.toggle("hidden", !show);
  }

  function setRolePickerVisible(visible) {
    if (rolePickerEl) rolePickerEl.classList.toggle("hidden", !visible);
  }

  function resetRolePicker() {
    roleButtons.forEach((b) => b.setAttribute("aria-selected", "false"));
  }

  function showUnit(unit) {
    if (!UNIT_LABELS[unit]) return;
    ensureDefaultAdmins(unit);
    currentUnit = unit;
    selectedRole = null;
    pendingPasswordChange = null;
    setViewVisibility(views.home, false);
    setViewVisibility(views.unit, true);
    if (unitTitleEl) unitTitleEl.textContent = UNIT_LABELS[unit];
    document.title = `Grupo DK — ${UNIT_LABELS[unit]}`;
    history.replaceState(null, "", `#${unit}`);
    hideAllPanels();
    resetRolePicker();
    if (formLogin) formLogin.reset();
    if (formNovaSenha) formNovaSenha.reset();
    if (loginFeedback) loginFeedback.textContent = "";
    if (senhaFeedback) senhaFeedback.textContent = "";

    const sess = getSession();
    if (sess && sess.unit === unit && !sess.mustChangePassword) {
      refreshLoggedInUi(sess);
    } else if (sess && sess.unit === unit && sess.mustChangePassword) {
      showPasswordChange(sess);
    } else {
      setRolePickerVisible(true);
    }
  }

  function selectRole(role) {
    if (!currentUnit || !ROLE_LABELS[role]) return;
    const sessAtiva = getSession();
    if (sessAtiva && sessAtiva.unit === currentUnit && sessAtiva.mustChangePassword) {
      showPasswordChange(sessAtiva);
      return;
    }
    if (sessAtiva && sessAtiva.unit === currentUnit && !sessAtiva.mustChangePassword) {
      refreshLoggedInUi(sessAtiva);
      return;
    }
    selectedRole = role;
    roleButtons.forEach((b) => {
      const r = b.getAttribute("data-role");
      b.setAttribute("aria-selected", r === role ? "true" : "false");
    });
    if (loginUnitInput) loginUnitInput.value = currentUnit;
    if (loginRoleInput) loginRoleInput.value = role;
    if (loginPanelTitle) {
      loginPanelTitle.textContent = `Entrar como ${ROLE_LABELS[role]}`;
    }
    if (panelLogin) panelLogin.classList.remove("hidden");
    if (panelSenha) panelSenha.classList.add("hidden");
    if (panelLogado) panelLogado.classList.add("hidden");
    if (loginFeedback) loginFeedback.textContent = "";
    setRolePickerVisible(true);
    if (loginCpfInput) loginCpfInput.focus();
  }

  function refreshLoggedInUi(sess) {
    hideAllPanels();
    setRolePickerVisible(false);
    if (panelLogado) panelLogado.classList.remove("hidden");
    if (logadoTitulo) logadoTitulo.textContent = `Área do ${ROLE_LABELS[sess.role] || sess.role}`;
    if (logadoTexto) {
      logadoTexto.textContent = `${UNIT_LABELS[sess.unit] || sess.unit} · CPF ${formatCpf(sess.cpf)}`;
    }
    updateLocadoraOperacaoButton(sess);
  }

  function showPasswordChange(sess) {
    pendingPasswordChange = sess;
    hideAllPanels();
    setRolePickerVisible(false);
    if (panelSenha) panelSenha.classList.remove("hidden");
    if (senhaFeedback) senhaFeedback.textContent = "";
    if (formNovaSenha) formNovaSenha.reset();
  }

  function attemptLogin(unit, role, cpfRaw, senha) {
    const cpf = onlyDigits(cpfRaw);
    if (cpf.length !== 11) {
      return { ok: false, message: "Informe um CPF válido (11 dígitos)." };
    }
    const all = loadUsers();
    const k = userKey(unit, role, cpf);
    let user = all[k];
    const senhaTrim = String(senha || "").trim();

    if (role === "administrador") {
      if (!user) {
        return { ok: false, message: "CPF não cadastrado como administrador nesta unidade." };
      }
      if (user.senha !== senhaTrim) {
        return { ok: false, message: "Senha incorreta." };
      }
    } else {
      if (user) {
        if (user.senha !== senhaTrim) {
          return { ok: false, message: "Senha incorreta." };
        }
      } else {
        if (senhaTrim !== INITIAL_PASSWORD) {
          return {
            ok: false,
            message: "Primeiro acesso: use a senha inicial 123456 ou solicite cadastro ao administrador.",
          };
        }
        user = {
          unit,
          role,
          cpf,
          senha: INITIAL_PASSWORD,
          mustChangePassword: true,
        };
        all[k] = user;
        saveUsers(all);
      }
    }

    const sess = {
      unit,
      role,
      cpf,
      mustChangePassword: Boolean(user.mustChangePassword),
    };
    setSession(sess);

    if (user.mustChangePassword) {
      return { ok: true, needPasswordChange: true, sess };
    }
    return { ok: true, needPasswordChange: false, sess };
  }

  function routeFromHash() {
    const h = window.location.hash.slice(1);
    if (h === "operacao-cliente" || h === "operacao-veiculo") {
      const url = resolveSistemaCadastroUrl(h);
      if (!isSamePageAsPortal(url)) {
        window.location.replace(url);
        return;
      }
      window.alert(
        "Não foi possível abrir o sistema de cadastro DK a partir deste endereço (o index do DK coincide com o do portal ou não está publicado na pasta esperada).\n\n" +
          "Defina em index.html, antes de app.js:\n" +
          'window.DK_SISTEMA_CADASTROS_URL = "https://.../index.html";'
      );
      history.replaceState(null, "", "#locadora");
      showUnit("locadora");
      return;
    }
    if (h === "locadora" || h === "centro" || h === "construtora") {
      showUnit(h);
      return;
    }
    if (!h) {
      showHome();
      return;
    }
    history.replaceState(null, "", window.location.pathname + window.location.search);
    showHome();
  }

  document.querySelectorAll("[data-go]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.getAttribute("data-go");
      if (target && UNIT_LABELS[target]) showUnit(target);
    });
  });

  document.querySelectorAll("[data-back]").forEach((btn) => {
    btn.addEventListener("click", () => showHome());
  });

  roleButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const role = btn.getAttribute("data-role");
      if (role) selectRole(role);
    });
  });

  if (loginCpfInput) {
    loginCpfInput.addEventListener("input", () => {
      loginCpfInput.value = formatCpf(loginCpfInput.value);
    });
  }

  if (formLogin) {
    formLogin.addEventListener("submit", (e) => {
      e.preventDefault();
      if (!currentUnit || !selectedRole) return;
      const cpf = loginCpfInput ? loginCpfInput.value : "";
      const senha = loginSenhaInput ? loginSenhaInput.value : "";
      const result = attemptLogin(currentUnit, selectedRole, cpf, senha);
      if (!result.ok) {
        if (loginFeedback) {
          loginFeedback.textContent = result.message || "Não foi possível entrar.";
        }
        return;
      }
      if (loginFeedback) loginFeedback.textContent = "";
      if (result.needPasswordChange) {
        const s = getSession();
        if (s) showPasswordChange(s);
      } else {
        refreshLoggedInUi(result.sess);
      }
    });
  }

  if (formNovaSenha) {
    formNovaSenha.addEventListener("submit", (e) => {
      e.preventDefault();
      const s = pendingPasswordChange || getSession();
      if (!s || !s.unit || !s.role || !s.cpf) {
        if (senhaFeedback) senhaFeedback.textContent = "Sessão inválida. Entre novamente.";
        return;
      }
      const n1 = document.getElementById("nova-senha");
      const n2 = document.getElementById("nova-senha-2");
      const a = n1 ? String(n1.value || "").trim() : "";
      const b = n2 ? String(n2.value || "").trim() : "";
      if (a.length < 6) {
        if (senhaFeedback) senhaFeedback.textContent = "A nova senha deve ter pelo menos 6 caracteres.";
        return;
      }
      if (a !== b) {
        if (senhaFeedback) senhaFeedback.textContent = "As senhas não coincidem.";
        return;
      }
      if (a === INITIAL_PASSWORD) {
        if (senhaFeedback) senhaFeedback.textContent = "Escolha uma senha diferente da inicial 123456.";
        return;
      }
      const all = loadUsers();
      const k = userKey(s.unit, s.role, s.cpf);
      const user = all[k];
      if (!user) {
        if (senhaFeedback) senhaFeedback.textContent = "Usuário não encontrado.";
        return;
      }
      user.senha = a;
      user.mustChangePassword = false;
      all[k] = user;
      saveUsers(all);
      const newSess = { unit: s.unit, role: s.role, cpf: s.cpf, mustChangePassword: false };
      setSession(newSess);
      pendingPasswordChange = null;
      if (senhaFeedback) senhaFeedback.textContent = "";
      refreshLoggedInUi(newSess);
    });
  }

  if (btnSair) {
    btnSair.addEventListener("click", () => {
      setSession(null);
      pendingPasswordChange = null;
      hideAllPanels();
      resetRolePicker();
      setRolePickerVisible(true);
      if (formLogin) formLogin.reset();
      selectedRole = null;
      if (loginFeedback) loginFeedback.textContent = "";
      updateLocadoraOperacaoButton(null);
    });
  }

  if (btnLocadoraOperacao) {
    btnLocadoraOperacao.addEventListener("click", () => {
      const sess = getSession();
      if (!sess || sess.unit !== "locadora") return;
      if (panelLogado) panelLogado.classList.add("hidden");
      if (panelOperacaoLocadora) panelOperacaoLocadora.classList.remove("hidden");
    });
  }

  if (btnVoltarOperacaoLocadora) {
    btnVoltarOperacaoLocadora.addEventListener("click", () => {
      hideOperacaoInlineCliente();
      hideOperacaoInlineVeiculo();
      const sess = getSession();
      if (sess && !sess.mustChangePassword) refreshLoggedInUi(sess);
    });
  }

  const PORTAL_CLIENTE_RASCUNHO_KEY = "grupo_dk_portal_cliente_rascunho_v2";
  const PORTAL_CLIENTE_RASCUNHO_LEGACY = "grupo_dk_portal_cliente_rascunho_v1";

  const operacaoInlineCliente = document.getElementById("operacaoInlineCliente");
  const formOperacaoClienteInline = document.getElementById("formOperacaoClienteInline");
  const operacaoClienteCodigo = document.getElementById("operacaoClienteCodigo");
  const operacaoClienteDataCadastro = document.getElementById("operacaoClienteDataCadastro");
  const operacaoClienteCpf = document.getElementById("operacaoClienteCpf");
  const operacaoClienteNome = document.getElementById("operacaoClienteNome");
  const operacaoClienteCelular = document.getElementById("operacaoClienteCelular");
  const operacaoClienteRecado1 = document.getElementById("operacaoClienteRecado1");
  const operacaoClienteRecado2 = document.getElementById("operacaoClienteRecado2");
  const operacaoClienteCnh = document.getElementById("operacaoClienteCnh");
  const operacaoClienteCategoria = document.getElementById("operacaoClienteCategoria");
  const operacaoClienteVencimento = document.getElementById("operacaoClienteVencimento");
  const operacaoClienteEar = document.getElementById("operacaoClienteEar");
  const operacaoClienteCep = document.getElementById("operacaoClienteCep");
  const operacaoClienteMunicipioUf = document.getElementById("operacaoClienteMunicipioUf");
  const operacaoClienteEndereco = document.getElementById("operacaoClienteEndereco");
  const operacaoClienteInlineMsg = document.getElementById("operacaoClienteInlineMsg");
  const operacaoClienteCadastroDetectMsg = document.getElementById("operacaoClienteCadastroDetectMsg");
  const operacaoClienteLimparBtn = document.getElementById("operacaoClienteLimparBtn");
  const operacaoClienteVoltarBtn = document.getElementById("operacaoClienteVoltarBtn");
  const operacaoClienteAbrirSistemaBtn = document.getElementById("operacaoClienteAbrirSistemaBtn");

  const PORTAL_VEICULO_RASCUNHO_KEY = "grupo_dk_portal_veiculo_rascunho_v1";
  const DK_VEICULOS_STORAGE_KEY = "dk_veiculos_cadastro";
  const operacaoInlineVeiculoEl = document.getElementById("operacaoInlineVeiculo");
  const formOperacaoVeiculoInline = document.getElementById("formOperacaoVeiculoInline");
  const operacaoVeiculoInlineMsg = document.getElementById("operacaoVeiculoInlineMsg");
  const operacaoVeiculoCadastroDetectMsg = document.getElementById("operacaoVeiculoCadastroDetectMsg");

  function onlyDigitsPortal(s) {
    return String(s || "").replace(/\D/g, "");
  }

  function formatCpfPortal(value) {
    const d = onlyDigitsPortal(value).slice(0, 11);
    if (d.length <= 3) return d;
    if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
    if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
    return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
  }

  function formatDateBrPortal(value) {
    const digits = onlyDigitsPortal(value).slice(0, 8);
    if (digits.length <= 2) return digits;
    if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
    return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
  }

  function formatCepPortal(value) {
    const d = onlyDigitsPortal(value).slice(0, 8);
    if (d.length <= 5) return d;
    return `${d.slice(0, 5)}-${d.slice(5)}`;
  }

  function loadPortalClienteRascunho() {
    try {
      const raw = localStorage.getItem(PORTAL_CLIENTE_RASCUNHO_KEY);
      if (raw) {
        const o = JSON.parse(raw);
        if (o && typeof o === "object") return o;
      }
      const legacy = localStorage.getItem(PORTAL_CLIENTE_RASCUNHO_LEGACY);
      if (legacy) {
        const o = JSON.parse(legacy);
        if (o && typeof o === "object") {
          return {
            codigo: "",
            dataCadastro: "",
            cpf: o.cpf || "",
            nome: o.nome || "",
            celular: o.celular || "",
            recado1: "",
            recado2: "",
            cnh: "",
            categoria: "",
            vencimento: "",
            ear: "",
            cep: "",
            municipioUf: "",
            endereco: o.endereco || "",
          };
        }
      }
    } catch {
      return null;
    }
    return null;
  }

  function savePortalClienteRascunho(payload) {
    try {
      localStorage.setItem(PORTAL_CLIENTE_RASCUNHO_KEY, JSON.stringify(payload));
    } catch {
      /* ignore */
    }
  }

  function applyPortalClienteRascunhoToForm(data) {
    if (!data) return;
    if (operacaoClienteCodigo) operacaoClienteCodigo.value = String(data.codigo || "").trim() || "—";
    if (operacaoClienteDataCadastro) operacaoClienteDataCadastro.value = formatDateBrPortal(String(data.dataCadastro || ""));
    if (operacaoClienteCpf) operacaoClienteCpf.value = formatCpfPortal(String(data.cpf || ""));
    if (operacaoClienteNome) operacaoClienteNome.value = String(data.nome || "");
    if (operacaoClienteCelular) operacaoClienteCelular.value = String(data.celular || "");
    if (operacaoClienteRecado1) operacaoClienteRecado1.value = String(data.recado1 || "");
    if (operacaoClienteRecado2) operacaoClienteRecado2.value = String(data.recado2 || "");
    if (operacaoClienteCnh) operacaoClienteCnh.value = String(data.cnh || "");
    if (operacaoClienteCategoria) operacaoClienteCategoria.value = String(data.categoria || "");
    if (operacaoClienteVencimento) operacaoClienteVencimento.value = formatDateBrPortal(String(data.vencimento || ""));
    if (operacaoClienteEar) operacaoClienteEar.value = String(data.ear || "").trim() || "";
    if (operacaoClienteCep) operacaoClienteCep.value = formatCepPortal(String(data.cep || ""));
    if (operacaoClienteMunicipioUf) operacaoClienteMunicipioUf.value = String(data.municipioUf || "");
    if (operacaoClienteEndereco) operacaoClienteEndereco.value = String(data.endereco || "");
  }

  function collectPortalClientePayload(codigoVal) {
    return {
      codigo: String(codigoVal || "").trim(),
      dataCadastro: String(operacaoClienteDataCadastro?.value || "").trim(),
      cpf: onlyDigitsPortal(operacaoClienteCpf?.value || ""),
      nome: String(operacaoClienteNome?.value || "").trim(),
      celular: String(operacaoClienteCelular?.value || "").trim(),
      recado1: String(operacaoClienteRecado1?.value || "").trim(),
      recado2: String(operacaoClienteRecado2?.value || "").trim(),
      cnh: String(operacaoClienteCnh?.value || "").trim(),
      categoria: String(operacaoClienteCategoria?.value || "").trim(),
      vencimento: String(operacaoClienteVencimento?.value || "").trim(),
      ear: String(operacaoClienteEar?.value || "").trim(),
      cep: onlyDigitsPortal(operacaoClienteCep?.value || ""),
      municipioUf: String(operacaoClienteMunicipioUf?.value || "").trim(),
      endereco: String(operacaoClienteEndereco?.value || "").trim(),
      atualizadoEm: new Date().toISOString(),
    };
  }

  function clearPortalClienteFormMessage() {
    if (operacaoClienteInlineMsg) operacaoClienteInlineMsg.textContent = "";
  }

  function ensureCodigoRascunhoDisplay() {
    if (!operacaoClienteCodigo) return;
    const cur = String(operacaoClienteCodigo.value || "").trim();
    if (!cur || cur === "—") {
      operacaoClienteCodigo.value = `RP-${Date.now().toString(36).slice(-6).toUpperCase()}`;
    }
  }

  function normalizePlatePortal(value) {
    return String(value || "")
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "");
  }

  function inferTipoFromTagPortal(tagRaw) {
    const t = String(tagRaw || "").toUpperCase();
    if (t.includes("DKMT") || t.includes("MOTO")) return "MOTO";
    return "CARRO";
  }

  function nextTagPortalSuggestion(tipo, veiculos) {
    const prefix = tipo === "MOTO" ? "DKMT" : "DKCR";
    let maxNum = 0;
    veiculos.forEach((v) => {
      const tag = String(v.tag || "")
        .toUpperCase()
        .replace(/\s/g, "");
      if (!tag.includes(prefix)) return;
      const m = tag.match(/(\d+)$/);
      if (!m) return;
      const n = Number(m[1]);
      if (Number.isFinite(n) && n > maxNum) maxNum = n;
    });
    return `${prefix}${maxNum + 1}`;
  }

  function loadDkVeiculosFromStorage() {
    try {
      const raw = localStorage.getItem(DK_VEICULOS_STORAGE_KEY);
      if (!raw) return [];
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  }

  function loadPortalVeiculoRascunho() {
    try {
      const raw = localStorage.getItem(PORTAL_VEICULO_RASCUNHO_KEY);
      if (raw) {
        const o = JSON.parse(raw);
        if (o && typeof o === "object") return o;
      }
    } catch {
      return null;
    }
    return null;
  }

  function savePortalVeiculoRascunho(payload) {
    try {
      localStorage.setItem(PORTAL_VEICULO_RASCUNHO_KEY, JSON.stringify(payload));
    } catch {
      /* ignore */
    }
  }

  function applyPortalVeiculoRascunhoToForm(data) {
    if (!data) return;
    const map = [
      ["operacaoVeiculoNum", "numLinha"],
      ["operacaoVeiculoTag", "tag"],
      ["operacaoVeiculoPlaca", "placa"],
      ["operacaoVeiculoCodigo", "codigo"],
      ["operacaoVeiculoMarca", "marca"],
      ["operacaoVeiculoModelo", "modelo"],
      ["operacaoVeiculoValor", "valor"],
      ["operacaoVeiculoCor", "cor"],
      ["operacaoVeiculoChassi", "chassi"],
      ["operacaoVeiculoAnoModelo", "anoModelo"],
      ["operacaoVeiculoRenavam", "renavam"],
      ["operacaoVeiculoMotor", "motor"],
      ["operacaoVeiculoProprietario", "proprietario"],
      ["operacaoVeiculoLocal", "local"],
    ];
    map.forEach(([id, key]) => {
      const el = document.getElementById(id);
      if (el) el.value = String(data[key] ?? "");
    });
  }

  function collectPortalVeiculoFormPayload() {
    const get = (id) => String(document.getElementById(id)?.value || "").trim();
    return {
      numLinha: get("operacaoVeiculoNum"),
      tag: get("operacaoVeiculoTag"),
      placa: get("operacaoVeiculoPlaca"),
      codigo: get("operacaoVeiculoCodigo"),
      marca: get("operacaoVeiculoMarca"),
      modelo: get("operacaoVeiculoModelo"),
      valor: get("operacaoVeiculoValor"),
      cor: get("operacaoVeiculoCor"),
      chassi: get("operacaoVeiculoChassi"),
      anoModelo: get("operacaoVeiculoAnoModelo"),
      renavam: get("operacaoVeiculoRenavam"),
      motor: get("operacaoVeiculoMotor"),
      proprietario: get("operacaoVeiculoProprietario"),
      local: get("operacaoVeiculoLocal"),
      atualizadoEm: new Date().toISOString(),
    };
  }

  function upsertPortalVeiculoToDk(payload) {
    const placaN = normalizePlatePortal(payload.placa);
    if (!placaN) return { ok: false, message: "Informe uma placa válida." };
    const modelo = String(payload.modelo || "").trim();
    if (!modelo) return { ok: false, message: "Informe o modelo do veículo." };
    const veiculos = loadDkVeiculosFromStorage();
    const tipo = inferTipoFromTagPortal(payload.tag);
    let tagVal = String(payload.tag || "").trim();
    if (!tagVal) {
      const others = veiculos.filter((v) => normalizePlatePortal(v.placa) !== placaN);
      tagVal = nextTagPortalSuggestion(tipo, others);
    }
    const idx = veiculos.findIndex((v) => normalizePlatePortal(String(v.placa || "")) === placaN);
    const base =
      idx >= 0
        ? veiculos[idx]
        : {
            id: Date.now(),
            status: "DISPONIVEL",
          };
    const merged = {
      ...base,
      tipo,
      tag: tagVal,
      placa: placaN,
      codigo: String(payload.codigo || "").trim(),
      marca: String(payload.marca || "").trim(),
      modelo,
      valor: String(payload.valor || "").trim(),
      cor: String(payload.cor || "").trim(),
      chassi: String(payload.chassi || "").trim().toUpperCase(),
      anoModelo: String(payload.anoModelo || "").trim(),
      renavam: String(payload.renavam || "").trim(),
      motor: String(payload.motor || "").trim().toUpperCase(),
      proprietario: String(payload.proprietario || "").trim(),
      local: String(payload.local || "").trim(),
      numLinha: String(payload.numLinha || "").trim(),
    };
    if (idx >= 0) veiculos[idx] = merged;
    else veiculos.push(merged);
    try {
      localStorage.setItem(DK_VEICULOS_STORAGE_KEY, JSON.stringify(veiculos));
    } catch {
      return { ok: false, message: "Não foi possível guardar (armazenamento cheio?)." };
    }
    return { ok: true };
  }

  function hideOperacaoInlineVeiculo() {
    if (!operacaoInlineVeiculoEl) return;
    operacaoInlineVeiculoEl.classList.add("hidden");
    const btn = document.getElementById("btn-operacao-cadastro-veiculo");
    if (btn) {
      btn.classList.remove("is-active");
      btn.setAttribute("aria-expanded", "false");
    }
    if (operacaoVeiculoInlineMsg) operacaoVeiculoInlineMsg.textContent = "";
    if (operacaoVeiculoCadastroDetectMsg) operacaoVeiculoCadastroDetectMsg.textContent = "";
  }

  function showOperacaoInlineVeiculo() {
    if (!operacaoInlineVeiculoEl) return;
    hideOperacaoInlineCliente();
    operacaoInlineVeiculoEl.classList.remove("hidden");
    const btn = document.getElementById("btn-operacao-cadastro-veiculo");
    if (btn) {
      btn.classList.add("is-active");
      btn.setAttribute("aria-expanded", "true");
    }
    const data = loadPortalVeiculoRascunho();
    applyPortalVeiculoRascunhoToForm(data);
    window.setTimeout(() => {
      document.getElementById("operacaoVeiculoPlaca")?.focus?.();
      operacaoInlineVeiculoEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, 0);
  }

  function showOperacaoInlineCliente() {
    if (!operacaoInlineCliente) return;
    hideOperacaoInlineVeiculo();
    operacaoInlineCliente.classList.remove("hidden");
    const btn = document.getElementById("btn-operacao-cadastro-cliente");
    if (btn) {
      btn.classList.add("is-active");
      btn.setAttribute("aria-expanded", "true");
    }
    const data = loadPortalClienteRascunho();
    applyPortalClienteRascunhoToForm(data);
    if (!data || !String(data.codigo || "").trim()) {
      if (operacaoClienteCodigo) operacaoClienteCodigo.value = "—";
    }
    window.setTimeout(() => {
      operacaoClienteNome?.focus?.();
      operacaoInlineCliente.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, 0);
  }

  function hideOperacaoInlineCliente() {
    if (!operacaoInlineCliente) return;
    operacaoInlineCliente.classList.add("hidden");
    const btn = document.getElementById("btn-operacao-cadastro-cliente");
    if (btn) {
      btn.classList.remove("is-active");
      btn.setAttribute("aria-expanded", "false");
    }
    clearPortalClienteFormMessage();
  }

  const btnOperacaoCliente = document.getElementById("btn-operacao-cadastro-cliente");
  const btnOperacaoVeiculo = document.getElementById("btn-operacao-cadastro-veiculo");
  if (btnOperacaoCliente) {
    btnOperacaoCliente.addEventListener("click", () => {
      const visible = operacaoInlineCliente && !operacaoInlineCliente.classList.contains("hidden");
      if (visible) {
        hideOperacaoInlineCliente();
      } else {
        showOperacaoInlineCliente();
      }
    });
  }
  if (btnOperacaoVeiculo) {
    btnOperacaoVeiculo.addEventListener("click", () => {
      const wrap = document.getElementById("operacaoInlineVeiculo");
      const visible = wrap && !wrap.classList.contains("hidden");
      if (visible) {
        hideOperacaoInlineVeiculo();
      } else {
        showOperacaoInlineVeiculo();
      }
    });
  }

  if (operacaoClienteCpf) {
    const onOperacaoClienteCpfTyped = () => {
      operacaoClienteCpf.value = formatCpfPortal(operacaoClienteCpf.value);
      refreshOperacaoClienteCpfSugestoes();
      syncPortalOperacaoClienteFromCpfMatch();
    };
    operacaoClienteCpf.addEventListener("input", onOperacaoClienteCpfTyped);
    operacaoClienteCpf.addEventListener("change", onOperacaoClienteCpfTyped);
    operacaoClienteCpf.addEventListener("focus", refreshOperacaoClienteCpfSugestoes);
  }
  [operacaoClienteDataCadastro, operacaoClienteVencimento].forEach((el) => {
    if (!el) return;
    el.addEventListener("input", () => {
      el.value = formatDateBrPortal(el.value);
    });
  });
  if (operacaoClienteCep) {
    operacaoClienteCep.addEventListener("input", () => {
      operacaoClienteCep.value = formatCepPortal(operacaoClienteCep.value);
    });
  }

  if (formOperacaoClienteInline) {
    formOperacaoClienteInline.addEventListener("submit", (e) => {
      e.preventDefault();
      const nome = String(operacaoClienteNome?.value || "").trim();
      const cpfDigits = onlyDigitsPortal(operacaoClienteCpf?.value || "");
      const endereco = String(operacaoClienteEndereco?.value || "").trim();
      if (!nome || cpfDigits.length !== 11 || !endereco) {
        if (operacaoClienteInlineMsg) {
          operacaoClienteInlineMsg.textContent = "Preencha NOME, CPF com 11 dígitos e Endereço para guardar.";
        }
        return;
      }
      ensureCodigoRascunhoDisplay();
      const codigo = String(operacaoClienteCodigo?.value || "").trim().replace(/^—$/, "");
      const finalCodigo = codigo || `RP-${Date.now().toString(36).slice(-6).toUpperCase()}`;
      if (operacaoClienteCodigo) operacaoClienteCodigo.value = finalCodigo;
      savePortalClienteRascunho(collectPortalClientePayload(finalCodigo));
      try {
        localStorage.removeItem(PORTAL_CLIENTE_RASCUNHO_LEGACY);
      } catch {
        /* ignore */
      }
      if (operacaoClienteInlineMsg) {
        operacaoClienteInlineMsg.textContent = "Rascunho guardado neste navegador.";
      }
    });
  }

  function clearPortalClienteFormFields() {
    if (operacaoClienteCodigo) operacaoClienteCodigo.value = "—";
    if (operacaoClienteDataCadastro) operacaoClienteDataCadastro.value = "";
    if (operacaoClienteCpf) {
      operacaoClienteCpf.value = "";
      operacaoClienteCpf.dispatchEvent(new Event("input", { bubbles: true }));
    }
    if (operacaoClienteNome) {
      operacaoClienteNome.value = "";
      operacaoClienteNome.dispatchEvent(new Event("input", { bubbles: true }));
    }
    if (operacaoClienteCelular) operacaoClienteCelular.value = "";
    if (operacaoClienteRecado1) operacaoClienteRecado1.value = "";
    if (operacaoClienteRecado2) operacaoClienteRecado2.value = "";
    if (operacaoClienteCnh) operacaoClienteCnh.value = "";
    if (operacaoClienteCategoria) operacaoClienteCategoria.value = "";
    if (operacaoClienteVencimento) operacaoClienteVencimento.value = "";
    if (operacaoClienteEar) operacaoClienteEar.value = "";
    if (operacaoClienteCep) operacaoClienteCep.value = "";
    if (operacaoClienteMunicipioUf) operacaoClienteMunicipioUf.value = "";
    if (operacaoClienteEndereco) operacaoClienteEndereco.value = "";
    clearOperacaoClienteCadastroDetectMsg();
  }

  if (operacaoClienteLimparBtn) {
    operacaoClienteLimparBtn.addEventListener("click", () => {
      clearPortalClienteFormFields();
      try {
        localStorage.removeItem(PORTAL_CLIENTE_RASCUNHO_KEY);
        localStorage.removeItem(PORTAL_CLIENTE_RASCUNHO_LEGACY);
      } catch {
        /* ignore */
      }
      clearPortalClienteFormMessage();
    });
  }

  if (operacaoClienteVoltarBtn) {
    operacaoClienteVoltarBtn.addEventListener("click", () => {
      hideOperacaoInlineCliente();
    });
  }

  if (operacaoClienteAbrirSistemaBtn) {
    operacaoClienteAbrirSistemaBtn.addEventListener("click", () => {
      persistOperacaoTabForDk("operacao-cliente");
      openSistemaCadastro("operacao-cliente");
    });
  }

  const operacaoVeiculoPlacaInput = document.getElementById("operacaoVeiculoPlaca");
  const operacaoVeiculoCodigoInput = document.getElementById("operacaoVeiculoCodigo");
  if (operacaoVeiculoPlacaInput) {
    const onOperacaoVeiculoPlacaTyped = () => {
      operacaoVeiculoPlacaInput.value = String(operacaoVeiculoPlacaInput.value || "")
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "")
        .slice(0, 7);
      refreshOperacaoVeiculoPlacaSugestoes();
      syncPortalOperacaoVeiculoFromPlacaMatch();
    };
    operacaoVeiculoPlacaInput.addEventListener("input", onOperacaoVeiculoPlacaTyped);
    operacaoVeiculoPlacaInput.addEventListener("change", onOperacaoVeiculoPlacaTyped);
    operacaoVeiculoPlacaInput.addEventListener("focus", refreshOperacaoVeiculoPlacaSugestoes);
  }
  if (operacaoVeiculoCodigoInput) {
    const onOperacaoVeiculoCodigoTyped = () => {
      refreshOperacaoVeiculoCodigoSugestoes();
      syncPortalOperacaoVeiculoFromCodigoMatch();
    };
    operacaoVeiculoCodigoInput.addEventListener("input", onOperacaoVeiculoCodigoTyped);
    operacaoVeiculoCodigoInput.addEventListener("change", onOperacaoVeiculoCodigoTyped);
    operacaoVeiculoCodigoInput.addEventListener("focus", refreshOperacaoVeiculoCodigoSugestoes);
  }

  function clearPortalVeiculoFormFields() {
    [
      "operacaoVeiculoNum",
      "operacaoVeiculoTag",
      "operacaoVeiculoPlaca",
      "operacaoVeiculoCodigo",
      "operacaoVeiculoMarca",
      "operacaoVeiculoModelo",
      "operacaoVeiculoValor",
      "operacaoVeiculoCor",
      "operacaoVeiculoChassi",
      "operacaoVeiculoAnoModelo",
      "operacaoVeiculoRenavam",
      "operacaoVeiculoMotor",
      "operacaoVeiculoProprietario",
      "operacaoVeiculoLocal",
    ].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.value = "";
    });
    clearOperacaoVeiculoCadastroDetectMsg();
    operacaoVeiculoPlacaInput?.dispatchEvent(new Event("input", { bubbles: true }));
    operacaoVeiculoCodigoInput?.dispatchEvent(new Event("input", { bubbles: true }));
  }

  if (formOperacaoVeiculoInline) {
    formOperacaoVeiculoInline.addEventListener("submit", (e) => {
      e.preventDefault();
      const payload = collectPortalVeiculoFormPayload();
      const res = upsertPortalVeiculoToDk(payload);
      if (!res.ok) {
        if (operacaoVeiculoInlineMsg) operacaoVeiculoInlineMsg.textContent = res.message || "Verifique os dados.";
        return;
      }
      savePortalVeiculoRascunho(payload);
      if (operacaoVeiculoInlineMsg) {
        operacaoVeiculoInlineMsg.textContent =
          "Rascunho guardado. O veículo foi gravado em dk_veiculos_cadastro neste navegador (relatórios PDF/Excel).";
      }
    });
  }

  const operacaoVeiculoLimparBtn = document.getElementById("operacaoVeiculoLimparBtn");
  if (operacaoVeiculoLimparBtn) {
    operacaoVeiculoLimparBtn.addEventListener("click", () => {
      clearPortalVeiculoFormFields();
      try {
        localStorage.removeItem(PORTAL_VEICULO_RASCUNHO_KEY);
      } catch {
        /* ignore */
      }
      if (operacaoVeiculoInlineMsg) operacaoVeiculoInlineMsg.textContent = "";
    });
  }

  const operacaoVeiculoVoltarBtn = document.getElementById("operacaoVeiculoVoltarBtn");
  if (operacaoVeiculoVoltarBtn) {
    operacaoVeiculoVoltarBtn.addEventListener("click", () => {
      hideOperacaoInlineVeiculo();
    });
  }

  const operacaoVeiculoGerarRelatorioBtn = document.getElementById("operacaoVeiculoGerarRelatorioBtn");
  if (operacaoVeiculoGerarRelatorioBtn) {
    operacaoVeiculoGerarRelatorioBtn.addEventListener("click", () => openPortalRelatorioModal("veiculo"));
  }

  const operacaoVeiculoAbrirSistemaBtn = document.getElementById("operacaoVeiculoAbrirSistemaBtn");
  if (operacaoVeiculoAbrirSistemaBtn) {
    operacaoVeiculoAbrirSistemaBtn.addEventListener("click", () => {
      persistOperacaoTabForDk("operacao-veiculo");
      openSistemaCadastro("operacao-veiculo");
    });
  }

  const DK_CLIENTES_STORAGE_KEY = "dk_clientes_cadastro";
  const portalRelatorioModal = document.getElementById("portalRelatorioModal");

  function loadDkClientesFromStorage() {
    try {
      const raw = localStorage.getItem(DK_CLIENTES_STORAGE_KEY);
      if (!raw) return [];
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  }

  function findDkClienteByCpfDigits(digits11) {
    const clientes = loadDkClientesFromStorage();
    for (let i = clientes.length - 1; i >= 0; i--) {
      const c = clientes[i];
      if (onlyDigitsPortal(String(c.cpf || "")) === digits11) return c;
    }
    return null;
  }

  function applyPortalClienteRecordFromDk(c) {
    const full = String(c.endereco || "").trim();
    const endereco =
      full ||
      [String(c.enderecoBase || "").trim(), String(c.complemento || "").trim()].filter(Boolean).join(", ");
    applyPortalClienteRascunhoToForm({
      codigo: String(c.codigo ?? "").trim(),
      dataCadastro: String(c.dataCadastro ?? "").trim(),
      cpf: String(c.cpf ?? ""),
      nome: String(c.nome ?? ""),
      celular: String(c.celular ?? ""),
      recado1: String(c.recado1 ?? ""),
      recado2: String(c.recado2 ?? ""),
      cnh: String(c.cnh ?? ""),
      categoria: String(c.categoria ?? ""),
      vencimento: String(c.vencimento ?? ""),
      ear: String(c.ear ?? ""),
      cep: String(c.cep ?? ""),
      municipioUf: String(c.municipioUf ?? ""),
      endereco,
    });
  }

  function clearOperacaoClienteCadastroDetectMsg() {
    if (operacaoClienteCadastroDetectMsg) operacaoClienteCadastroDetectMsg.textContent = "";
  }

  function syncPortalOperacaoClienteFromCpfMatch() {
    if (!operacaoClienteCpf) return;
    const digits = onlyDigitsPortal(operacaoClienteCpf.value);
    if (digits.length !== 11) {
      clearOperacaoClienteCadastroDetectMsg();
      return;
    }
    const cliente = findDkClienteByCpfDigits(digits);
    if (!cliente) {
      clearOperacaoClienteCadastroDetectMsg();
      return;
    }
    applyPortalClienteRecordFromDk(cliente);
    refreshOperacaoClienteCpfSugestoes();
    refreshOperacaoClienteNomeSugestoes();
    if (operacaoClienteCadastroDetectMsg) {
      const codigo = String(cliente.codigo ?? "").trim();
      const codigoDisplay = codigo || "—";
      operacaoClienteCadastroDetectMsg.textContent =
        `Cliente já cadastrado — código ${codigoDisplay}. Os dados foram carregados do cadastro.`;
    }
  }

  function normalizeNomeBuscaPortal(s) {
    return String(s || "")
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .toLowerCase()
      .trim();
  }

  function refreshOperacaoClienteNomeSugestoes() {
    const datalist = document.getElementById("operacaoClienteNomeSugestoes");
    if (!datalist || !operacaoClienteNome) return;
    const q = normalizeNomeBuscaPortal(operacaoClienteNome.value);
    if (!q) {
      datalist.innerHTML = "";
      return;
    }
    const clientes = loadDkClientesFromStorage();
    const seen = new Set();
    const matches = [];
    for (const c of clientes) {
      const nome = String(c.nome || "").trim();
      if (!nome) continue;
      const key = nome.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      if (normalizeNomeBuscaPortal(nome).includes(q)) {
        matches.push(nome);
      }
    }
    matches.sort((a, b) => a.localeCompare(b, "pt-BR"));
    const max = 50;
    datalist.innerHTML = matches
      .slice(0, max)
      .map((n) => `<option value="${escapeHtmlPortal(n)}"></option>`)
      .join("");
  }

  function refreshOperacaoClienteCpfSugestoes() {
    const datalist = document.getElementById("operacaoClienteCpfSugestoes");
    if (!datalist || !operacaoClienteCpf) return;
    const q = onlyDigitsPortal(operacaoClienteCpf.value);
    if (!q) {
      datalist.innerHTML = "";
      return;
    }
    const clientes = loadDkClientesFromStorage();
    const seen = new Set();
    const matchesDigits = [];
    for (const c of clientes) {
      const d = onlyDigitsPortal(String(c.cpf || ""));
      if (d.length !== 11) continue;
      if (seen.has(d)) continue;
      seen.add(d);
      if (d.includes(q)) {
        matchesDigits.push(d);
      }
    }
    matchesDigits.sort((a, b) => a.localeCompare(b, "pt-BR", { numeric: true }));
    const max = 50;
    datalist.innerHTML = matchesDigits
      .slice(0, max)
      .map((digits) => `<option value="${escapeHtmlPortal(formatCpfPortal(digits))}"></option>`)
      .join("");
  }

  if (operacaoClienteNome) {
    operacaoClienteNome.addEventListener("input", refreshOperacaoClienteNomeSugestoes);
    operacaoClienteNome.addEventListener("focus", refreshOperacaoClienteNomeSugestoes);
  }

  function escapeHtmlPortal(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function clearOperacaoVeiculoCadastroDetectMsg() {
    if (operacaoVeiculoCadastroDetectMsg) operacaoVeiculoCadastroDetectMsg.textContent = "";
  }

  function findDkVeiculoByPlacaNorm(norm) {
    if (!norm || norm.length !== 7) return null;
    const veiculos = loadDkVeiculosFromStorage();
    for (let i = veiculos.length - 1; i >= 0; i--) {
      const v = veiculos[i];
      if (normalizePlatePortal(String(v.placa || "")) === norm) return v;
    }
    return null;
  }

  function findDkVeiculoByCodigoPortal(raw) {
    const q = String(raw || "").trim();
    if (!q) return null;
    const ql = q.toLowerCase();
    const veiculos = loadDkVeiculosFromStorage();
    for (let i = veiculos.length - 1; i >= 0; i--) {
      const v = veiculos[i];
      const c = String(v.codigo || "").trim();
      if (c.toLowerCase() === ql) return v;
    }
    return null;
  }

  function applyPortalVeiculoRecordFromDk(v) {
    applyPortalVeiculoRascunhoToForm({
      numLinha: String(v.numLinha ?? "").trim(),
      tag: String(v.tag ?? "").trim(),
      placa: String(v.placa ?? "").trim(),
      codigo: String(v.codigo ?? "").trim(),
      marca: String(v.marca ?? "").trim(),
      modelo: String(v.modelo ?? "").trim(),
      valor: String(v.valor ?? "").trim(),
      cor: String(v.cor ?? "").trim(),
      chassi: String(v.chassi ?? "").trim(),
      anoModelo: String(v.anoModelo ?? "").trim(),
      renavam: String(v.renavam ?? "").trim(),
      motor: String(v.motor ?? "").trim(),
      proprietario: String(v.proprietario ?? "").trim(),
      local: String(v.local ?? "").trim(),
    });
    if (operacaoVeiculoPlacaInput) {
      operacaoVeiculoPlacaInput.value = String(operacaoVeiculoPlacaInput.value || "")
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "")
        .slice(0, 7);
    }
  }

  function refreshOperacaoVeiculoPlacaSugestoes() {
    const datalist = document.getElementById("operacaoVeiculoPlacaSugestoes");
    if (!datalist || !operacaoVeiculoPlacaInput) return;
    const q = normalizePlatePortal(operacaoVeiculoPlacaInput.value);
    if (!q) {
      datalist.innerHTML = "";
      return;
    }
    const veiculos = loadDkVeiculosFromStorage();
    const seen = new Set();
    const matches = [];
    for (const v of veiculos) {
      const p = normalizePlatePortal(String(v.placa || ""));
      if (!p) continue;
      if (seen.has(p)) continue;
      seen.add(p);
      if (p.includes(q)) {
        matches.push(p);
      }
    }
    matches.sort((a, b) => a.localeCompare(b));
    const max = 50;
    datalist.innerHTML = matches
      .slice(0, max)
      .map((p) => `<option value="${escapeHtmlPortal(p)}"></option>`)
      .join("");
  }

  function refreshOperacaoVeiculoCodigoSugestoes() {
    const datalist = document.getElementById("operacaoVeiculoCodigoSugestoes");
    const codEl = document.getElementById("operacaoVeiculoCodigo");
    if (!datalist || !codEl) return;
    const q = String(codEl.value || "").trim().toLowerCase();
    if (!q) {
      datalist.innerHTML = "";
      return;
    }
    const veiculos = loadDkVeiculosFromStorage();
    const seen = new Set();
    const matches = [];
    for (const v of veiculos) {
      const c = String(v.codigo || "").trim();
      if (!c) continue;
      const key = c.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      if (key.includes(q)) {
        matches.push(c);
      }
    }
    matches.sort((a, b) => a.localeCompare(b, "pt-BR"));
    const max = 50;
    datalist.innerHTML = matches
      .slice(0, max)
      .map((c) => `<option value="${escapeHtmlPortal(c)}"></option>`)
      .join("");
  }

  function syncPortalOperacaoVeiculoFromPlacaMatch() {
    if (!operacaoVeiculoPlacaInput) return;
    const norm = normalizePlatePortal(operacaoVeiculoPlacaInput.value);
    if (norm.length !== 7) {
      clearOperacaoVeiculoCadastroDetectMsg();
      return;
    }
    const v = findDkVeiculoByPlacaNorm(norm);
    if (!v) {
      clearOperacaoVeiculoCadastroDetectMsg();
      return;
    }
    applyPortalVeiculoRecordFromDk(v);
    refreshOperacaoVeiculoPlacaSugestoes();
    refreshOperacaoVeiculoCodigoSugestoes();
    if (operacaoVeiculoCadastroDetectMsg) {
      operacaoVeiculoCadastroDetectMsg.textContent =
        "Veículo já cadastrado — Ka-boom! Esta placa já existe na base.";
    }
  }

  function syncPortalOperacaoVeiculoFromCodigoMatch() {
    const codEl = document.getElementById("operacaoVeiculoCodigo");
    if (!codEl) return;
    const raw = String(codEl.value || "").trim();
    if (!raw) {
      clearOperacaoVeiculoCadastroDetectMsg();
      return;
    }
    const v = findDkVeiculoByCodigoPortal(raw);
    if (!v) {
      clearOperacaoVeiculoCadastroDetectMsg();
      return;
    }
    applyPortalVeiculoRecordFromDk(v);
    refreshOperacaoVeiculoPlacaSugestoes();
    refreshOperacaoVeiculoCodigoSugestoes();
    if (operacaoVeiculoCadastroDetectMsg) {
      operacaoVeiculoCadastroDetectMsg.textContent =
        "Veículo já cadastrado — Ka-boom! Este código já existe na base.";
    }
  }

  function displayCpfCliente(c) {
    const d = onlyDigitsPortal(String(c.cpf || ""));
    if (d.length === 11) return formatCpfPortal(d);
    return String(c.cpf || "").trim();
  }

  function displayCepCliente(c) {
    const s = String(c.cep || "").trim();
    if (!s) return "";
    if (/[.\-]/.test(s)) return s;
    const d = onlyDigitsPortal(s).slice(0, 8);
    return d.length === 8 ? formatCepPortal(d) : s;
  }

  function displayEnderecoCliente(c) {
    const full = String(c.endereco || "").trim();
    if (full) return full;
    const b = String(c.enderecoBase || "").trim();
    const comp = String(c.complemento || "").trim();
    return [b, comp].filter(Boolean).join(", ");
  }

  function buildClienteRowsHtml(clientes) {
    const headers = [
      "Cód.",
      "Data cadastro",
      "CPF",
      "NOME",
      "Celular",
      "Recados 01",
      "Recados 02",
      "CNH-e",
      "Categoria",
      "Vencimento",
      "EAR?",
      "CEP",
      "Município/UF",
      "Endereço",
      "Status",
    ];
    const headRow = `<tr>${headers.map((h) => `<th>${escapeHtmlPortal(h)}</th>`).join("")}</tr>`;
    const bodyRows = clientes
      .map((c) => {
        const cells = [
          c.codigo ?? "",
          c.dataCadastro ?? "",
          displayCpfCliente(c),
          c.nome ?? "",
          c.celular ?? "",
          c.recado1 ?? "",
          c.recado2 ?? "",
          c.cnh ?? "",
          c.categoria ?? "",
          c.vencimento ?? "",
          c.ear ?? "",
          displayCepCliente(c),
          c.municipioUf ?? "",
          displayEnderecoCliente(c),
          c.status ?? "ATIVO",
        ];
        return `<tr>${cells.map((cell) => `<td>${escapeHtmlPortal(cell)}</td>`).join("")}</tr>`;
      })
      .join("");
    return `<table><thead>${headRow}</thead><tbody>${bodyRows}</tbody></table>`;
  }

  function buildVeiculoRowsHtml(veiculos) {
    const headers = [
      "Nº",
      "Tag",
      "Placa",
      "Código",
      "Marca",
      "Modelo",
      "Valor",
      "Cor",
      "Chassi",
      "Ano/Modelo",
      "Renavam",
      "Motor",
      "Proprietário",
      "Local",
    ];
    const headRow = `<tr>${headers.map((h) => `<th>${escapeHtmlPortal(h)}</th>`).join("")}</tr>`;
    const bodyRows = veiculos
      .map((v) => {
        const cells = [
          v.numLinha ?? "",
          v.tag ?? "",
          v.placa ?? "",
          v.codigo ?? "",
          v.marca ?? "",
          v.modelo ?? "",
          v.valor ?? "",
          v.cor ?? "",
          v.chassi ?? "",
          v.anoModelo ?? "",
          v.renavam ?? "",
          v.motor ?? "",
          v.proprietario ?? "",
          v.local ?? "",
        ];
        return `<tr>${cells.map((cell) => `<td>${escapeHtmlPortal(cell)}</td>`).join("")}</tr>`;
      })
      .join("");
    return `<table><thead>${headRow}</thead><tbody>${bodyRows}</tbody></table>`;
  }

  let relatorioPortalModo = "cliente";

  function openPortalRelatorioModal(modo) {
    mergeFinanceiroBundlePortal();
    mergeVeiculosFinanceiroPortal();
    relatorioPortalModo = modo === "veiculo" ? "veiculo" : "cliente";
    const titulo = document.getElementById("portalRelatorioTitulo");
    const fonte = document.getElementById("portalRelatorioFonteData");
    const resumo = document.getElementById("portalRelatorioResumo");
    if (titulo) {
      titulo.textContent =
        relatorioPortalModo === "veiculo" ? "Relatório de veículos" : "Relatório de clientes";
    }
    if (fonte) {
      fonte.innerHTML =
        relatorioPortalModo === "veiculo"
          ? 'Os dados vêm do cadastro DK neste navegador (<code>dk_veiculos_cadastro</code>), o mesmo do painel completo.'
          : 'Os dados vêm do cadastro DK neste navegador (<code>dk_clientes_cadastro</code>), o mesmo do painel completo.';
    }
    if (relatorioPortalModo === "veiculo") {
      const veiculos = loadDkVeiculosFromStorage();
      if (resumo) {
        resumo.textContent =
          veiculos.length === 0
            ? "Nenhum veículo encontrado no armazenamento local. Use o formulário acima ou o sistema DK neste mesmo navegador."
            : `${veiculos.length} veículo(s) cadastrado(s). Escolha PDF (impressão) ou Excel (ficheiro CSV).`;
      }
    } else {
      const clientes = loadDkClientesFromStorage();
      if (resumo) {
        resumo.textContent =
          clientes.length === 0
            ? "Nenhum cliente encontrado no armazenamento local. Use o sistema DK neste mesmo navegador para cadastrar ou importar."
            : `${clientes.length} cliente(s) cadastrado(s). Escolha PDF (impressão) ou Excel (ficheiro CSV).`;
      }
    }
    if (portalRelatorioModal) portalRelatorioModal.classList.remove("hidden");
  }

  function closePortalRelatorioModal() {
    if (portalRelatorioModal) portalRelatorioModal.classList.add("hidden");
  }

  function closePortalPdfViewer() {
    const viewer = document.getElementById("portalRelatorioPdfViewer");
    if (viewer) {
      viewer.classList.add("hidden");
      viewer.setAttribute("aria-hidden", "true");
    }
    const iframe = document.getElementById("portalPdfIframe");
    if (iframe) {
      try {
        const doc = iframe.contentDocument || iframe.contentWindow.document;
        doc.open();
        doc.write("");
        doc.close();
      } catch {
        /* ignore */
      }
    }
  }

  function exportPortalRelatorioPdf() {
    mergeFinanceiroBundlePortal();
    mergeVeiculosFinanceiroPortal();
    if (relatorioPortalModo === "veiculo") {
      let veiculos = loadDkVeiculosFromStorage();
      if (!veiculos.length) {
        window.alert(
          "Não há veículos neste navegador para exportar.\n\n" +
            (typeof VEICULOS_DK_FINANCEIRO_2026 === "undefined"
              ? "O ficheiro veiculos-dk-financeiro-2026.js não carregou (confira o caminho no servidor em relação à pasta do portal)."
              : "Os dados importados da planilha ficam em dk_veiculos_cadastro nesta mesma origem (localhost e porta).")
        );
        return;
      }
      const tableHtml = buildVeiculoRowsHtml(veiculos);
      const htmlDoc = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Veículos DK</title>
<style>
body{font-family:Segoe UI,system-ui,sans-serif;padding:16px;color:#111;background:#fff;margin:0;}
h1{font-size:18px;margin:0 0 8px;}
.meta{font-size:13px;color:#444;margin-bottom:12px;}
table{border-collapse:collapse;width:100%;font-size:10px;}
th,td{border:1px solid #ccc;padding:5px 6px;text-align:left;vertical-align:top;}
th{background:#1a2332;color:#fff;font-weight:600;}
tr:nth-child(even){background:#f7f7f7;}
@media print{body{padding:8px;}}
</style></head><body>
<h1>Relatório de veículos cadastrados</h1>
<p class="meta">Total: ${veiculos.length} · Gerado em ${escapeHtmlPortal(new Date().toLocaleString("pt-BR"))}</p>
${tableHtml}
</body></html>`;

      const viewer = document.getElementById("portalRelatorioPdfViewer");
      const iframe = document.getElementById("portalPdfIframe");
      if (!iframe || !viewer) {
        window.alert("Erro ao abrir o visualizador. Recarregue a página.");
        return;
      }
      try {
        const doc = iframe.contentDocument || iframe.contentWindow.document;
        doc.open();
        doc.write(htmlDoc);
        doc.close();
      } catch {
        window.alert(
          "Não foi possível mostrar o relatório aqui. Utilize o botão «Relatório Excel» ou abra o portal por http://localhost (não por file:// quando possível)."
        );
        return;
      }
      closePortalRelatorioModal();
      viewer.classList.remove("hidden");
      viewer.setAttribute("aria-hidden", "false");
      try {
        iframe.setAttribute("title", "Relatório de veículos");
        iframe.focus();
      } catch {
        /* ignore */
      }
      return;
    }

    let clientes = loadDkClientesFromStorage();
    if (!clientes.length) {
      window.alert(
        "Não há clientes neste navegador para exportar.\n\n" +
          (typeof CLIENTES_DK_FINANCEIRO_2026 === "undefined"
            ? "O ficheiro clientes-dk-financeiro-2026.js não carregou (confira o caminho no servidor em relação à pasta do portal)."
            : "Os dados importados da planilha ficam em dk_clientes_cadastro nesta mesma origem (mesmo localhost e porta que está a usar).")
      );
      return;
    }
    const tableHtml = buildClienteRowsHtml(clientes);
    const htmlDoc = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Clientes DK</title>
<style>
body{font-family:Segoe UI,system-ui,sans-serif;padding:16px;color:#111;background:#fff;margin:0;}
h1{font-size:18px;margin:0 0 8px;}
.meta{font-size:13px;color:#444;margin-bottom:12px;}
table{border-collapse:collapse;width:100%;font-size:10px;}
th,td{border:1px solid #ccc;padding:5px 6px;text-align:left;vertical-align:top;}
th{background:#1a2332;color:#fff;font-weight:600;}
tr:nth-child(even){background:#f7f7f7;}
@media print{body{padding:8px;}}
</style></head><body>
<h1>Relatório de clientes cadastrados</h1>
<p class="meta">Total: ${clientes.length} · Gerado em ${escapeHtmlPortal(new Date().toLocaleString("pt-BR"))}</p>
${tableHtml}
</body></html>`;

    const viewer = document.getElementById("portalRelatorioPdfViewer");
    const iframe = document.getElementById("portalPdfIframe");
    if (!iframe || !viewer) {
      window.alert("Erro ao abrir o visualizador. Recarregue a página.");
      return;
    }
    try {
      const doc = iframe.contentDocument || iframe.contentWindow.document;
      doc.open();
      doc.write(htmlDoc);
      doc.close();
    } catch {
      window.alert(
        "Não foi possível mostrar o relatório aqui. Utilize o botão «Relatório Excel» ou abra o portal por http://localhost (não por file:// quando possível)."
      );
      return;
    }
    closePortalRelatorioModal();
    viewer.classList.remove("hidden");
    viewer.setAttribute("aria-hidden", "false");
    try {
      iframe.setAttribute("title", "Relatório de clientes");
      iframe.focus();
    } catch {
      /* ignore */
    }
  }

  function escapeCsvCell(val) {
    const s = String(val ?? "");
    if (/[;\r\n"]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  }

  function exportPortalRelatorioExcel() {
    mergeFinanceiroBundlePortal();
    mergeVeiculosFinanceiroPortal();
    if (relatorioPortalModo === "veiculo") {
      const veiculos = loadDkVeiculosFromStorage();
      if (!veiculos.length) {
        window.alert(
          typeof VEICULOS_DK_FINANCEIRO_2026 === "undefined"
            ? "Não há veículos para exportar. O ficheiro veiculos-dk-financeiro-2026.js não carregou."
            : "Não há veículos neste navegador para exportar."
        );
        return;
      }
      const sep = ";";
      const header = [
        "Nº",
        "Tag",
        "Placa",
        "Código",
        "Marca",
        "Modelo",
        "Valor",
        "Cor",
        "Chassi",
        "Ano/Modelo",
        "Renavam",
        "Motor",
        "Proprietário",
        "Local",
      ];
      const lines = [header.map(escapeCsvCell).join(sep)];
      veiculos.forEach((v) => {
        const row = [
          v.numLinha ?? "",
          v.tag ?? "",
          v.placa ?? "",
          v.codigo ?? "",
          v.marca ?? "",
          v.modelo ?? "",
          v.valor ?? "",
          v.cor ?? "",
          v.chassi ?? "",
          v.anoModelo ?? "",
          v.renavam ?? "",
          v.motor ?? "",
          v.proprietario ?? "",
          v.local ?? "",
        ];
        lines.push(row.map(escapeCsvCell).join(sep));
      });
      const BOM = "\uFEFF";
      const blob = new Blob([BOM + lines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `relatorio-veiculos-dk-${new Date().toISOString().slice(0, 10)}.csv`;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(a.href);
      closePortalRelatorioModal();
      return;
    }

    const clientes = loadDkClientesFromStorage();
    if (!clientes.length) {
      window.alert(
        typeof CLIENTES_DK_FINANCEIRO_2026 === "undefined"
          ? "Não há clientes para exportar. O ficheiro clientes-dk-financeiro-2026.js não carregou."
          : "Não há clientes neste navegador para exportar."
      );
      return;
    }
    const sep = ";";
    const header = [
      "Cód.",
      "Data cadastro",
      "CPF",
      "NOME",
      "Celular",
      "Recados 01",
      "Recados 02",
      "CNH-e",
      "Categoria",
      "Vencimento",
      "EAR?",
      "CEP",
      "Município/UF",
      "Endereço",
      "Status",
    ];
    const lines = [header.map(escapeCsvCell).join(sep)];
    clientes.forEach((c) => {
      const row = [
        c.codigo ?? "",
        c.dataCadastro ?? "",
        displayCpfCliente(c),
        c.nome ?? "",
        c.celular ?? "",
        c.recado1 ?? "",
        c.recado2 ?? "",
        c.cnh ?? "",
        c.categoria ?? "",
        c.vencimento ?? "",
        c.ear ?? "",
        displayCepCliente(c),
        c.municipioUf ?? "",
        displayEnderecoCliente(c),
        c.status ?? "ATIVO",
      ];
      lines.push(row.map(escapeCsvCell).join(sep));
    });
    const BOM = "\uFEFF";
    const blob = new Blob([BOM + lines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `relatorio-clientes-dk-${new Date().toISOString().slice(0, 10)}.csv`;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
    closePortalRelatorioModal();
  }

  const operacaoClienteGerarRelatorioBtn = document.getElementById("operacaoClienteGerarRelatorioBtn");
  if (operacaoClienteGerarRelatorioBtn) {
    operacaoClienteGerarRelatorioBtn.addEventListener("click", () => openPortalRelatorioModal("cliente"));
  }
  const portalRelatorioPdfBtn = document.getElementById("portalRelatorioPdfBtn");
  const portalRelatorioExcelBtn = document.getElementById("portalRelatorioExcelBtn");
  const portalRelatorioFecharBtn = document.getElementById("portalRelatorioFecharBtn");
  if (portalRelatorioPdfBtn) portalRelatorioPdfBtn.addEventListener("click", exportPortalRelatorioPdf);
  if (portalRelatorioExcelBtn) portalRelatorioExcelBtn.addEventListener("click", exportPortalRelatorioExcel);
  if (portalRelatorioFecharBtn) portalRelatorioFecharBtn.addEventListener("click", closePortalRelatorioModal);
  if (portalRelatorioModal) {
    portalRelatorioModal.querySelectorAll("[data-close-relatorio]").forEach((el) => {
      el.addEventListener("click", closePortalRelatorioModal);
    });
  }

  const portalPdfImprimirBtn = document.getElementById("portalPdfImprimirBtn");
  const portalPdfFecharViewerBtn = document.getElementById("portalPdfFecharViewerBtn");
  if (portalPdfImprimirBtn) {
    portalPdfImprimirBtn.addEventListener("click", () => {
      const iframe = document.getElementById("portalPdfIframe");
      try {
        iframe?.contentWindow?.focus();
        iframe?.contentWindow?.print();
      } catch {
        window.alert("Não foi possível abrir a janela de impressão.");
      }
    });
  }
  if (portalPdfFecharViewerBtn) {
    portalPdfFecharViewerBtn.addEventListener("click", () => closePortalPdfViewer());
  }

  /** Igual ao DK: grava folha CADASTRO CLIENTES em dk_clientes_cadastro para relatórios no portal. */
  function mergeFinanceiroBundlePortal() {
    if (typeof CLIENTES_DK_FINANCEIRO_2026 === "undefined" || !Array.isArray(CLIENTES_DK_FINANCEIRO_2026)) return;
    const CAD_KEY = "dk_clientes_cadastro";
    let clientes = [];
    try {
      const raw = localStorage.getItem(CAD_KEY);
      clientes = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(clientes)) clientes = [];
    } catch {
      clientes = [];
    }
    try {
      if (localStorage.getItem("dk_financeiro_2026_imported_v1") && clientes.length > 0) return;
    } catch {
      return;
    }
    CLIENTES_DK_FINANCEIRO_2026.forEach((row, i) => {
      const cpf = onlyDigitsPortal(String(row.cpf || ""));
      if (cpf.length !== 11) return;
      const idx = clientes.findIndex((c) => onlyDigitsPortal(String(c.cpf || "")) === cpf);
      const payload = {
        ...row,
        cpf,
        id: row.id != null ? Number(row.id) : 1765000000 + i,
        status: row.status || "ATIVO",
      };
      if (idx >= 0) clientes[idx] = { ...clientes[idx], ...payload };
      else clientes.push(payload);
    });
    try {
      localStorage.setItem(CAD_KEY, JSON.stringify(clientes));
      localStorage.setItem("dk_financeiro_2026_imported_v1", "1");
    } catch {
      /* ignore */
    }
  }

  mergeFinanceiroBundlePortal();

  /** Mescla VEICULOS_DK_FINANCEIRO_2026 em dk_veiculos_cadastro (mesma flag que o index DK). */
  function mergeVeiculosFinanceiroPortal() {
    if (typeof VEICULOS_DK_FINANCEIRO_2026 === "undefined" || !Array.isArray(VEICULOS_DK_FINANCEIRO_2026)) return;
    let veiculos = loadDkVeiculosFromStorage();
    try {
      if (localStorage.getItem("dk_financeiro_2026_veiculos_imported_v1") && veiculos.length > 0) return;
    } catch {
      return;
    }
    const placaToIdx = new Map();
    veiculos.forEach((v, idx) => {
      const p = normalizePlatePortal(String(v.placa || ""));
      if (p) placaToIdx.set(p, idx);
    });

    VEICULOS_DK_FINANCEIRO_2026.forEach((row, i) => {
      const placa = normalizePlatePortal(String(row.placa || ""));
      if (!placa) return;
      const modelo = String(row.modelo || "").trim();
      if (!modelo) return;

      const tagU = String(row.tag || "").toUpperCase();
      const tipo =
        String(row.tipo || "").trim() ||
        (tagU.includes("DKMT") ? "MOTO" : "CARRO");

      const payload = {
        tipo,
        tag: String(row.tag || "")
          .trim()
          .replace(/\s*-\s*/g, ""),
        placa: String(row.placa || "")
          .trim()
          .toUpperCase()
          .replace(/[^A-Z0-9]/g, "")
          .slice(0, 7),
        codigo: String(row.codigo || "").trim(),
        marca: String(row.marca || "").trim(),
        modelo,
        valor: String(row.valor || "").trim(),
        cor: String(row.cor || "").trim(),
        chassi: String(row.chassi || "").trim().toUpperCase(),
        anoModelo: String(row.anoModelo || "").trim(),
        renavam: String(row.renavam || "").trim(),
        motor: String(row.motor || "").trim().toUpperCase(),
        proprietario: String(row.proprietario || "").trim(),
        local: String(row.local || "").trim(),
        numLinha: String(row.numLinha || "").trim(),
        status: String(row.status || "").trim() || "DISPONIVEL",
      };

      const idx = placaToIdx.has(placa) ? placaToIdx.get(placa) : -1;
      if (idx >= 0) {
        veiculos[idx] = { ...veiculos[idx], ...payload, id: veiculos[idx].id };
      } else {
        veiculos.push({
          id: row.id != null ? Number(row.id) : 1780000000 + i,
          ...payload,
        });
        placaToIdx.set(placa, veiculos.length - 1);
      }
    });

    try {
      localStorage.setItem(DK_VEICULOS_STORAGE_KEY, JSON.stringify(veiculos));
      localStorage.setItem("dk_financeiro_2026_veiculos_imported_v1", "1");
    } catch {
      /* ignore */
    }
  }

  mergeVeiculosFinanceiroPortal();

  /** Reforço após carga completa (cache, ordem de scripts). */
  window.addEventListener("load", () => {
    mergeFinanceiroBundlePortal();
    mergeVeiculosFinanceiroPortal();
  });

  window.addEventListener("hashchange", routeFromHash);

  if (window.location.hash === "#locadora" || window.location.hash === "#centro" || window.location.hash === "#construtora") {
    routeFromHash();
  } else {
    setViewVisibility(views.home, true);
    setViewVisibility(views.unit, false);
  }
})();
