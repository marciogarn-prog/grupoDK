(function () {
  const STORAGE_USERS = "grupo_dk_portal_users_v1";
  const STORAGE_SESSION = "grupo_dk_portal_session_v1";
  const INITIAL_PASSWORD = "123456";
  const DEFAULT_ADMIN_CPFS = ["03037897430", "80163513104"];

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
    [panelLogin, panelSenha, panelLogado].forEach((p) => {
      if (p) p.classList.add("hidden");
    });
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
    if (h === "locadora" || h === "centro" || h === "construtora") {
      showUnit(h);
    } else {
      showHome();
    }
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
    });
  }

  window.addEventListener("hashchange", routeFromHash);

  if (window.location.hash === "#locadora" || window.location.hash === "#centro" || window.location.hash === "#construtora") {
    routeFromHash();
  } else {
    setViewVisibility(views.home, true);
    setViewVisibility(views.unit, false);
  }
})();
