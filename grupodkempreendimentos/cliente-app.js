/**
 * DK Locadora — App do cliente (PWA).
 * Login por CPF; exibe só dados do cliente; partilha comprovante via sistema (Web Share).
 */
(function dkClienteApp() {
  window.__DK_CLIENTE_APP = true;
  /** `false` = cliente não vê nem usa o formulário «Enviar comprovante» (lançamento inativado). */
  const CLIENTE_ENVIO_COMPROVANTE_ATIVO = false;
  const SESSAO_KEY = "dk_sessao_cliente_app";
  const CLIENTE_APP_GATE_KEY = "dk_cliente_app_gate";
  const GATE_PERSIST_KEY = "dk_cliente_gate_persist";
  const INSTALL_AUTH_KEY = "dk_cliente_install_auth";
  const SHARE_CACHE_KEY = "dk-shared-comprovante";
  const PENDING_SHARE_SESSION_KEY = "dk_cliente_share_pending";
  const COMPROVANTES_KEY = "dk_cliente_comprovantes_enviados";
  const PORTAL_ADMIN_SESSAO_KEY = "dk_sessao_cliente";
  const CLIENTE_PULL_KEYS = [
    "dk_locacoes_cadastro",
    "dk_locacao_documentos_v1",
    "dk_comunicacao_operacao_v1",
    "dk_cliente_notificacoes",
    "dk_comprovantes_cliente_pendentes",
  ];

  function clienteEnvioComprovanteAtivo() {
    return CLIENTE_ENVIO_COMPROVANTE_ATIVO;
  }

  function applyClienteComprovanteUiVisibility() {
    const sec = $("cliente-sec-comprovante");
    if (!sec) return;
    const on = clienteEnvioComprovanteAtivo();
    sec.classList.toggle("hidden", !on);
    sec.toggleAttribute("hidden", !on);
    sec.setAttribute("aria-hidden", on ? "false" : "true");
  }

  function isPortalAdminSessaoAtiva() {
    try {
      const raw = localStorage.getItem(PORTAL_ADMIN_SESSAO_KEY);
      if (!raw) return false;
      const s = JSON.parse(raw);
      return s?.tipo === "admin" && String(s.role || "") === "owner";
    } catch {
      return false;
    }
  }

  function isAdminPreviewMode() {
    try {
      if (new URLSearchParams(location.search).get("adminPreview") === "1") return true;
      return sessionStorage.getItem("dk_admin_preview_cliente") === "1";
    } catch {
      return false;
    }
  }

  /** Admin (pré-visualização) e desktop operador nunca passam pelo gate de GPS. */
  function isGeoGateBypassed() {
    return isAdminPreviewMode();
  }

  function canAdminPreviewAutoLogin() {
    return isAdminPreviewMode() && isPortalAdminSessaoAtiva();
  }

  function syncClienteAdminBannerLayout() {
    const banner = document.getElementById("portal-admin-banner-cliente");
    const h =
      banner && !banner.classList.contains("hidden") ? `${banner.offsetHeight}px` : "0px";
    try {
      document.documentElement.style.setProperty("--portal-admin-banner-h", h);
    } catch {
      /* ignore */
    }
  }

  function showAdminPreviewBanner() {
    const el = document.getElementById("portal-admin-banner-cliente");
    if (!el) return;
    el.classList.remove("hidden");
    document.body.classList.add("cliente-admin-preview");
    requestAnimationFrame(() => {
      syncClienteAdminBannerLayout();
      if (typeof window.__DK_syncDemoBannerLayout === "function") {
        window.__DK_syncDemoBannerLayout();
      }
    });
    if (!window.__dkClienteAdminBannerResizeBound) {
      window.__dkClienteAdminBannerResizeBound = true;
      window.addEventListener("resize", syncClienteAdminBannerLayout);
      window.addEventListener("dk-deploy-channel-ready", syncClienteAdminBannerLayout);
    }
  }

  function markAdminPreviewActive() {
    window.__DK_CLIENTE_ADMIN_PREVIEW = true;
    if (typeof window.__DK_clienteGeoStopTracking === "function") {
      window.__DK_clienteGeoStopTracking();
    }
  }

  function isClienteRealSession(sessao) {
    if (!sessao?.cpf) return false;
    if (sessao.adminPreview) return false;
    if (String(sessao.origem || "") === "adminPreview") return false;
    return !isGeoGateBypassed();
  }

  async function afterLoginAdminPreview(sess) {
    markAdminPreviewActive();
    await sincronizarDadosCliente(sess, { silent: false });
    showView("app");
    renderApp(sess);
  }

  async function autoLoginAdminPreviewFromGate() {
    if (!isAdminPreviewMode() || !isPortalAdminSessaoAtiva()) return false;
    let gateCpf = "";
    let gateNome = "";
    try {
      const q = new URLSearchParams(location.search);
      gateCpf = onlyDigits(q.get("cpf") || "").slice(0, 11);
      const raw = sessionStorage.getItem(CLIENTE_APP_GATE_KEY) || localStorage.getItem(GATE_PERSIST_KEY);
      const g = raw ? JSON.parse(raw) : null;
      if (!gateCpf) gateCpf = onlyDigits(g?.cpf || "").slice(0, 11);
      gateNome = String(g?.nome || "").trim();
    } catch {
      /* ignore */
    }
    if (gateCpf.length !== 11) return false;
    const row = loadCadastro(CAD_CLIENTES_KEY).find((c) => onlyDigits(c.cpf) === gateCpf);
    const sess = {
      cpf: gateCpf,
      nome: gateNome || String(row?.nome || "").trim() || "Cliente",
      origem: "adminPreview",
      adminPreview: true,
    };
    setSessao(sess);
    await afterLoginAdminPreview(sess);
    return true;
  }
  let pendingShareFocus = false;
  /** Protocolos com lista de pagamentos expandida (ver todos). */
  const pagamentosExpandidos = new Set();
  const CAD_CLIENTES_KEY = "dk_clientes_cadastro";
  const CAD_LOCACOES_KEY = "dk_locacoes_cadastro";
  const SENHA_INICIAL_CLIENTE = "123456";
  let clienteTrocaSenhaPendente = null;

  const MOCK_CLIENTES = [
    { cpf: "11111111111", senha: "1234", nome: "Joao Silva" },
    { cpf: "22222222222", senha: "1234", nome: "Ana Souza" },
    { cpf: "00000000001", senha: "123456", nome: "TESTE-001" },
  ];

  const $ = (id) => document.getElementById(id);

  function onlyDigits(s) {
    return String(s ?? "").replace(/\D/g, "");
  }

  function formatCpf(digits) {
    const d = onlyDigits(digits).slice(0, 11);
    if (d.length <= 3) return d;
    if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
    if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
    return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
  }

  function parseBrDate(s) {
    if (typeof window.parseBrDate === "function") return window.parseBrDate(s);
    const raw = String(s || "").trim();
    if (!raw) return null;
    if (raw.includes("/")) {
      const [day, month, year] = raw.split("/").map(Number);
      if (!day || !month || !year) return null;
      return new Date(year, month - 1, day);
    }
    const dig = onlyDigits(raw);
    if (dig.length === 8) {
      return new Date(Number(dig.slice(4)), Number(dig.slice(2, 4)) - 1, Number(dig.slice(0, 2)));
    }
    return null;
  }

  function currencyBRL(n) {
    if (typeof window.currencyBRL === "function") return window.currencyBRL(n);
    return Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }

  function parseCurrencyBR(v) {
    if (typeof window.parseCurrencyBR === "function" && window.parseCurrencyBR !== parseCurrencyBR) {
      return window.parseCurrencyBR(v);
    }
    if (typeof v === "number" && Number.isFinite(v)) return v;
    let s = String(v ?? "").trim();
    if (!s) return 0;
    s = s.replace(/[R$\s\u00A0]/gi, "");
    const hasComma = s.includes(",");
    const hasDot = s.includes(".");
    if (hasComma && hasDot) {
      const lastComma = s.lastIndexOf(",");
      const lastDot = s.lastIndexOf(".");
      if (lastComma > lastDot) {
        s = s.replace(/\./g, "").replace(",", ".");
      } else {
        s = s.replace(/,/g, "");
      }
    } else if (hasComma) {
      s = s.replace(/\./g, "").replace(",", ".");
    } else if (hasDot) {
      const parts = s.split(".");
      const dec = parts[parts.length - 1];
      if (!(parts.length === 2 && dec.length > 0 && dec.length <= 2)) {
        s = s.replace(/\./g, "");
      }
    }
    const num = Number(s.replace(/[^\d.-]/g, ""));
    return Number.isFinite(num) ? num : 0;
  }

  function loadJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  function saveJson(key, data) {
    localStorage.setItem(key, JSON.stringify(data));
  }

  function getSessao() {
    try {
      return JSON.parse(localStorage.getItem(SESSAO_KEY) || "null");
    } catch {
      return null;
    }
  }

  function setSessao(data) {
    localStorage.setItem(SESSAO_KEY, JSON.stringify(data));
  }

  function clearSessao() {
    localStorage.removeItem(SESSAO_KEY);
  }

  function clearClienteGate() {
    try {
      sessionStorage.removeItem(CLIENTE_APP_GATE_KEY);
      sessionStorage.removeItem("dk_cliente_app_gate_v1");
      sessionStorage.removeItem(INSTALL_AUTH_KEY);
      localStorage.removeItem(GATE_PERSIST_KEY);
    } catch {
      /* ignore */
    }
  }

  /** Gate sem senha — nunca persistir password no browser. */
  function sanitizeGatePayload(obj) {
    const cpf = onlyDigits(obj?.cpf || "").slice(0, 11);
    const proto = normProtoGate(obj?.proto || "");
    const nome = String(obj?.nome || "").trim();
    const out = { at: Number(obj?.at) || Date.now() };
    if (cpf.length === 11) out.cpf = cpf;
    if (proto) out.proto = proto;
    if (nome) out.nome = nome;
    return out;
  }

  function setClienteGate(cpf, proto) {
    const dig = onlyDigits(cpf).slice(0, 11);
    const nc = normProtoGate(proto);
    if (dig.length !== 11 || !nc) return false;
    try {
      const gatePayload = JSON.stringify(sanitizeGatePayload({ cpf: dig, proto: nc, at: Date.now() }));
      sessionStorage.setItem(CLIENTE_APP_GATE_KEY, gatePayload);
      /* Persistência só após login explícito — sem senha. */
      localStorage.setItem(GATE_PERSIST_KEY, gatePayload);
      return true;
    } catch {
      return false;
    }
  }

  function getGateProto() {
    try {
      const raw = sessionStorage.getItem(CLIENTE_APP_GATE_KEY) || localStorage.getItem(GATE_PERSIST_KEY);
      const g = raw ? JSON.parse(raw) : null;
      return normProtoGate(g?.proto || "");
    } catch {
      return "";
    }
  }

  function limparCacheClienteAoSair() {
    clearSessao();
    clearClienteGate();
    try {
      for (const k of CLIENTE_PULL_KEYS) {
        localStorage.removeItem(k);
      }
      if (typeof window.__DK_comprovantesClienteInvalidateCache === "function") {
        window.__DK_comprovantesClienteInvalidateCache();
      }
      if (typeof window.__DK_trimClienteLocacoesLocal === "function") {
        window.__DK_trimClienteLocacoesLocal();
      }
    } catch {
      /* ignore */
    }
  }

  function resetLoginForm() {
    const cpfIn = $("login-cpf");
    const protoIn = $("login-protocolo");
    const senhaIn = $("login-senha");
    const fb = $("login-feedback");
    if (cpfIn) cpfIn.value = "";
    if (protoIn) protoIn.value = "";
    if (senhaIn) senhaIn.value = "";
    if (fb) fb.textContent = "";
    cpfIn?.focus();
  }

  function updateLoginProtocoloUi() {
    const protoIn = $("login-protocolo");
    if (protoIn) protoIn.required = true;
  }

  function filterLocacoesParaExibicao(locacoes) {
    const ativas = filterLocacoesAtivas(locacoes);
    const proto = getGateProto();
    if (!proto) return ativas;
    const hit = ativas.filter((l) => normProtoGate(l.numeroContrato) === proto);
    return hit.length ? hit : ativas;
  }

  function loadCadastro(key) {
    return loadJson(key, []);
  }

  function clienteSenhaEhInicial(senha) {
    return String(senha || "").trim() === SENHA_INICIAL_CLIENTE;
  }

  function isClienteSenhaNovaValida(senha) {
    return /^\d{6}$/.test(String(senha || "").trim()) && !clienteSenhaEhInicial(senha);
  }

  function updateClienteSenhaNoCadastro(cpfDigits, novaSenha) {
    const clientes = loadCadastro(CAD_CLIENTES_KEY);
    const idx = clientes.findIndex((c) => onlyDigits(c.cpf) === cpfDigits);
    if (idx < 0) return false;
    clientes[idx] = {
      ...clientes[idx],
      senha: String(novaSenha).trim(),
      updatedAt: Date.now(),
    };
    saveJson(CAD_CLIENTES_KEY, clientes);
    try {
      if (typeof window.__DK_pushCloudSnapshotDebounced === "function") {
        window.__DK_pushCloudSnapshotDebounced();
      } else if (typeof window.__DK_pushCloudSnapshotNow === "function") {
        void window.__DK_pushCloudSnapshotNow();
      }
    } catch {
      /* ignore */
    }
    return true;
  }

  function findClienteLogin(cpfDigits, senha) {
    const mock = MOCK_CLIENTES.find((c) => c.cpf === cpfDigits && c.senha === senha);
    if (mock) return { cpf: cpfDigits, nome: mock.nome, origem: "mock" };

    const row = loadCadastro(CAD_CLIENTES_KEY).find((c) => onlyDigits(c.cpf) === cpfDigits);
    if (!row) return null;
    const pass = String(row.senha || "123456").trim();
    if (pass !== senha) return null;
    return {
      cpf: cpfDigits,
      nome: String(row.nome || "").trim() || "Cliente",
      origem: "cadastro",
      row,
    };
  }

  function normNc(nc) {
    return String(nc || "")
      .replace(/\D/g, "")
      .trim();
  }

  function getLancamentosFromLoc(loc) {
    if (typeof window.__DK_clienteGetLancamentosAluguelContrato === "function") {
      return window.__DK_clienteGetLancamentosAluguelContrato(loc).map((x) => ({
        ...x,
        tipo: "Aluguel",
        protocolo: normNc(loc.numeroContrato),
      }));
    }
    const out = [];
    const push = (arr, tipo) => {
      if (!Array.isArray(arr)) return;
      arr.forEach((x) => {
        if (!x || typeof x !== "object") return;
        const data = String(x.data || x.dataPagamento || "").trim();
        let valor = typeof x.valor === "number" ? x.valor : parseCurrencyBR(x.valor ?? x.valorPago);
        if (!Number.isFinite(valor) || valor <= 0) return;
        out.push({
          data,
          valor,
          tipo,
          protocolo: normNc(loc.numeroContrato),
          createdAt: Number(x.createdAt || x.id || 0),
          confirmadoViaAppCliente: Boolean(x.confirmadoViaAppCliente),
          origemComprovanteClienteId: String(x.origemComprovanteClienteId || "").trim(),
          comprovanteFp: String(x.comprovanteFp || "").trim(),
          registradoPorNome: String(x.registradoPorNome || "").trim(),
        });
      });
    };
    push(loc.portalLancamentosAluguel, "Aluguel");
    push(loc.lancamentosAluguel, "Aluguel");
    push(loc.lancamentos, "Aluguel");
    const dedupe =
      typeof window.__DK_dedupeLancamentosPagamento === "function"
        ? window.__DK_dedupeLancamentosPagamento
        : null;
    return dedupe ? dedupe(out) : out;
  }

  function loadDadosCliente(cpfDigits) {
    const clienteRow =
      loadCadastro(CAD_CLIENTES_KEY).find((c) => onlyDigits(c.cpf) === cpfDigits) || null;
    const locacoes = loadCadastro(CAD_LOCACOES_KEY).filter((l) => onlyDigits(l.cpf) === cpfDigits);
    const veiculos = loadCadastro("dk_veiculos_cadastro");
    const pagamentos = [];
    locacoes.forEach((loc) => {
      getLancamentosFromLoc(loc).forEach((p) => pagamentos.push({ ...p, placa: String(loc.placa || "").trim() }));
    });
    pagamentos.sort((a, b) => {
      const da = parseBrDate(a.data)?.getTime() || 0;
      const db = parseBrDate(b.data)?.getTime() || 0;
      return db - da;
    });
    return { clienteRow, locacoes, veiculos, pagamentos };
  }

  function escapeHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function normStatusLoc(s) {
    return String(s || "")
      .trim()
      .toUpperCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }

  /** Alinhado ao portal: contrato ativo = sem data fim (status sozinho não encerra). */
  function locacaoTemDataFim(loc) {
    if (!loc || typeof loc !== "object") return false;
    const fim = String(loc.fim || loc.dataFim || "").trim();
    return Boolean(fim && fim !== "...");
  }

  function isLocacaoFinalizada(loc) {
    if (!loc || typeof loc !== "object") return true;
    return locacaoTemDataFim(loc);
  }

  function filterLocacoesAtivas(locacoes) {
    return (locacoes || []).filter((l) => !isLocacaoFinalizada(l));
  }

  function clienteTemLocacaoAtiva(cpfDigits) {
    const all = loadCadastro(CAD_LOCACOES_KEY);
    const locs = all.filter((l) => onlyDigits(l.cpf) === cpfDigits);
    if (filterLocacoesAtivas(locs).length > 0) return true;
    try {
      const raw = sessionStorage.getItem(CLIENTE_APP_GATE_KEY) || localStorage.getItem(GATE_PERSIST_KEY);
      const g = raw ? JSON.parse(raw) : null;
      const protoGate = normProtoGate(g?.proto);
      if (protoGate && onlyDigits(g?.cpf).slice(0, 11) === cpfDigits) {
        const hit = all.find((l) => normProtoGate(l.numeroContrato) === protoGate);
        if (hit && !isLocacaoFinalizada(hit)) return true;
      }
    } catch {
      /* ignore */
    }
    return false;
  }

  function isStandaloneDisplay() {
    try {
      return (
        window.matchMedia("(display-mode: standalone)").matches ||
        window.matchMedia("(display-mode: fullscreen)").matches ||
        window.navigator.standalone === true
      );
    } catch {
      return false;
    }
  }

  function normProtoGate(value) {
    if (typeof normalizeNumeroContratoKey === "function") {
      return String(normalizeNumeroContratoKey(value || ""))
        .trim()
        .replace(/\s+/g, "");
    }
    return String(value || "")
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "");
  }

  function stripSensitiveQueryFromUrl() {
    try {
      const u = new URL(location.href);
      const adminPreview = u.searchParams.get("adminPreview") === "1";
      let dirty = false;
      ["senha", "password", "pass"].forEach((k) => {
        if (u.searchParams.has(k)) {
          u.searchParams.delete(k);
          dirty = true;
        }
      });
      if (!adminPreview) {
        ["cpf", "proto", "protocolo"].forEach((k) => {
          if (u.searchParams.has(k)) {
            u.searchParams.delete(k);
            dirty = true;
          }
        });
      }
      if (dirty) {
        const qs = u.searchParams.toString();
        history.replaceState(null, "", u.pathname + (qs ? `?${qs}` : "") + u.hash);
      }
    } catch {
      /* ignore */
    }
  }

  function isInstallQueryFlow() {
    try {
      return new URLSearchParams(location.search).get("instalar") === "1";
    } catch {
      return false;
    }
  }

  function persistGateFromQuery() {
    try {
      const q = new URLSearchParams(location.search);
      const adminPreview = q.get("adminPreview") === "1";
      const cpf = onlyDigits(q.get("cpf") || "").slice(0, 11);
      const proto = normProtoGate(q.get("proto") || q.get("protocolo") || "");
      const senhaLeak = q.get("senha") || q.get("password") || q.get("pass");
      if (senhaLeak) {
        /* Nunca aceitar senha na URL. */
        stripSensitiveQueryFromUrl();
      }
      if (cpf.length !== 11 || !proto) {
        if (!adminPreview) stripSensitiveQueryFromUrl();
        return;
      }
      const gatePayload = JSON.stringify(sanitizeGatePayload({ cpf, proto, at: Date.now() }));
      sessionStorage.setItem(CLIENTE_APP_GATE_KEY, gatePayload);
      if (adminPreview) {
        /* Preview admin: session only — sem localStorage. */
        localStorage.removeItem(GATE_PERSIST_KEY);
      } else if (isInstallQueryFlow()) {
        /* Install: não gravar identidade no localStorage (iria para o PWA). */
        localStorage.removeItem(GATE_PERSIST_KEY);
        sessionStorage.setItem(INSTALL_AUTH_KEY, JSON.stringify({ ok: 1, at: Date.now() }));
        stripSensitiveQueryFromUrl();
      } else {
        /* URL antiga com cpf (legado): session only + limpar URL. */
        localStorage.removeItem(GATE_PERSIST_KEY);
        stripSensitiveQueryFromUrl();
      }
    } catch {
      /* ignore */
    }
  }

  function restoreGateToSession() {
    try {
      persistGateFromQuery();
      if (sessionStorage.getItem(CLIENTE_APP_GATE_KEY)) return;
      const legacy = sessionStorage.getItem("dk_cliente_app_gate_v1");
      if (legacy) {
        try {
          const g = sanitizeGatePayload(JSON.parse(legacy));
          sessionStorage.setItem(CLIENTE_APP_GATE_KEY, JSON.stringify(g));
        } catch {
          sessionStorage.setItem(CLIENTE_APP_GATE_KEY, legacy);
        }
        return;
      }
      /* Em fluxo de instalação: não restaurar CPF do localStorage para o formulário/PWA. */
      if (isInstallQueryFlow() || sessionStorage.getItem(INSTALL_AUTH_KEY)) return;
      const p = localStorage.getItem(GATE_PERSIST_KEY);
      if (p) {
        try {
          const g = sanitizeGatePayload(JSON.parse(p));
          if (g.senha) delete g.senha;
          sessionStorage.setItem(CLIENTE_APP_GATE_KEY, JSON.stringify(g));
          /* Regrava limpo (sem senha) se o legado tinha campos a mais. */
          localStorage.setItem(GATE_PERSIST_KEY, JSON.stringify(g));
        } catch {
          sessionStorage.setItem(CLIENTE_APP_GATE_KEY, p);
        }
      }
    } catch {
      /* ignore */
    }
  }

  function persistGateFromSession() {
    try {
      if (isInstallQueryFlow() || sessionStorage.getItem(INSTALL_AUTH_KEY)) return;
      const raw = sessionStorage.getItem(CLIENTE_APP_GATE_KEY);
      if (!raw) return;
      const g = sanitizeGatePayload(JSON.parse(raw));
      localStorage.setItem(GATE_PERSIST_KEY, JSON.stringify(g));
    } catch {
      /* ignore */
    }
  }

  function markClientePwaInstalledIfStandalone() {
    if (!isStandaloneDisplay()) return;
    try {
      localStorage.setItem("dk_cliente_pwa_installed", "1");
    } catch {
      /* ignore */
    }
  }

  function showView(name) {
    $("view-geolocalizacao")?.classList.toggle("hidden", name !== "geo");
    $("view-login")?.classList.toggle("hidden", name !== "login");
    $("view-trocar-senha")?.classList.toggle("hidden", name !== "trocar-senha");
    $("view-app")?.classList.toggle("hidden", name !== "app");
    $("view-propaganda")?.classList.toggle("hidden", name !== "propaganda");
  }

  async function finalizarLoginCliente(sess, fb) {
    setSessao(sess);
    if (isClienteRealSession(sess)) startGeoForSession(sess);
    if (fb) fb.textContent = "A sincronizar…";
    resolveAppViewAfterData(sess);
    try {
      await afterLogin(sess);
    } catch {
      resolveAppViewAfterData(sess);
    }
    if (fb) fb.textContent = "";
  }

  function showGeoBlocked(msg) {
    showView("geo");
    const status = $("cliente-geo-status");
    const blocked = $("cliente-geo-bloqueado");
    const btn = $("btn-cliente-geo-autorizar");
    if (status) {
      status.textContent = msg || "Autorização negada.";
      status.classList.add("error");
    }
    blocked?.classList.remove("hidden");
    if (btn) btn.disabled = false;
  }

  function metaGeoFromSessao(sessao) {
    if (!sessao?.cpf) return null;
    const locs = filterLocacoesAtivas(
      loadCadastro(CAD_LOCACOES_KEY).filter((l) => onlyDigits(l.cpf) === sessao.cpf)
    );
    const loc = locs[0] || loadCadastro(CAD_LOCACOES_KEY).find((l) => onlyDigits(l.cpf) === sessao.cpf);
    return {
      cpf: sessao.cpf,
      nome: sessao.nome,
      placa: String(loc?.placa || "").trim(),
      protocolo: normNc(loc?.numeroContrato || ""),
    };
  }

  function startGeoForSession(sessao) {
    if (!isClienteRealSession(sessao)) {
      if (typeof window.__DK_clienteGeoStopTracking === "function") {
        window.__DK_clienteGeoStopTracking();
      }
      return;
    }
    const meta = metaGeoFromSessao(sessao);
    if (meta && typeof window.__DK_clienteGeoStartTracking === "function") {
      window.__DK_clienteGeoStartTracking(meta);
    }
  }

  async function maybeRunInstallGeoGate() {
    if (isGeoGateBypassed()) return true;
    if (typeof window.__DK_clienteGeoHasConsent === "function" && window.__DK_clienteGeoHasConsent()) {
      return true;
    }
    if (!hasClienteAppDownloadGate()) return true;
    try {
      if (new URLSearchParams(location.search).get("instalar") !== "1") return true;
    } catch {
      return true;
    }
    return ensureGeoGateBeforeApp();
  }

  async function ensureGeoGateBeforeApp() {
    const ensure = window.__DK_clienteGeoEnsurePermission;
    if (typeof ensure !== "function") {
      showGeoBlocked("Módulo de localização indisponível. Recarregue a página.");
      return false;
    }
    const status = $("cliente-geo-status");
    const blocked = $("cliente-geo-bloqueado");
    blocked?.classList.add("hidden");

    const perm = await window.__DK_clienteGeoQueryState?.();
    if (perm === "denied") {
      showGeoBlocked("Localização bloqueada nas definições do telemóvel.");
      return false;
    }
    if (perm === "granted" && window.__DK_clienteGeoHasConsent?.()) {
      const recheck = await ensure({ required: true });
      if (recheck.ok) return true;
      showGeoBlocked(recheck.msg);
      return false;
    }

    showView("geo");
    if (status) {
      status.textContent = "";
      status.classList.remove("error", "success");
    }

    return new Promise((resolve) => {
      const btn = $("btn-cliente-geo-autorizar");
      if (!btn) {
        resolve(false);
        return;
      }
      const onClick = async () => {
        btn.disabled = true;
        if (status) status.textContent = "A pedir permissão ao telemóvel…";
        const res = await ensure({ required: true });
        if (res.ok) {
          if (status) {
            status.textContent = "Localização autorizada.";
            status.classList.add("success");
          }
          btn.removeEventListener("click", onClick);
          resolve(true);
          return;
        }
        showGeoBlocked(res.msg);
        resolve(false);
      };
      btn.addEventListener("click", onClick);
      if (perm === "granted") {
        void onClick();
      }
    });
  }

  async function requireGeoForInstall() {
    const ensure = window.__DK_clienteGeoEnsurePermission;
    if (typeof ensure !== "function") return false;
    const res = await ensure({ required: true });
    if (!res.ok) {
      updateInstallPanelUi(
        res.msg || "Instalação bloqueada: autorize a localização antes de instalar."
      );
      showGeoBlocked(res.msg);
      return false;
    }
    return true;
  }

  function renderPropaganda(sessao, motivo) {
    $("propaganda-cliente-nome").textContent = sessao.nome || "Cliente";
    const sub = document.querySelector("#view-propaganda .cliente-app-brand__sub");
    const msg = document.getElementById("propaganda-motivo-msg");
    const locs = loadCadastro(CAD_LOCACOES_KEY).filter((l) => onlyDigits(l.cpf) === sessao.cpf);
    const reason = motivo || (locs.length ? "encerrado" : "sem_cadastro");
    if (sub) {
      sub.textContent = reason === "sem_cadastro" ? "Sem contrato na nuvem" : "Locação encerrada";
    }
    if (msg) {
      if (reason === "sem_cadastro") {
        msg.textContent =
          "Não encontrámos o seu contrato neste telemóvel. Toque em «Atualizar da nuvem». Se o problema continuar, a DK deve guardar os dados na nuvem no portal.";
      } else {
        msg.textContent =
          "Não há locação ativa (contrato com data de fim registada). Pode consultar novidades abaixo. Se o contrato ainda está em curso, toque em «Atualizar da nuvem».";
      }
    }
  }

  function resolveAppViewAfterData(sessao) {
    if (!sessao?.cpf) {
      showView("login");
      return;
    }
    const locs = loadCadastro(CAD_LOCACOES_KEY).filter((l) => onlyDigits(l.cpf) === sessao.cpf);
    if (typeof window.__DK_normalizeLocacoesContratoAtivoStore === "function") {
      try {
        window.__DK_normalizeLocacoesContratoAtivoStore();
      } catch {
        /* ignore */
      }
    }
    if (comprovanteFile || pendingShareFocus) {
      showView("app");
      renderApp(sessao);
      if (clienteEnvioComprovanteAtivo() && comprovanteFile) {
        attachFileToComprovanteInput(comprovanteFile);
        preselectProtocoloComprovante();
        const msg = $("comp-msg");
        if (msg) {
          msg.textContent =
            "Comprovante anexado — informe data e valor e toque em Enviar comprovante.";
        }
        focusComprovanteSection();
      } else if (comprovanteFile) {
        comprovanteFile = null;
        pendingShareFocus = false;
      }
      return;
    }
    if (!clienteTemLocacaoAtiva(sessao.cpf)) {
      renderPropaganda(sessao, locs.length ? "encerrado" : "sem_cadastro");
      showView("propaganda");
      return;
    }
    showView("app");
    renderApp(sessao);
    if (pendingShareFocus && clienteEnvioComprovanteAtivo()) focusComprovanteSection();
    else pendingShareFocus = false;
  }

  function formatDateMask(value) {
    const digits = onlyDigits(String(value || "")).slice(0, 8);
    if (digits.length <= 2) return digits;
    if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
    return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
  }

  function formatCurrencyMask(value) {
    const digits = onlyDigits(String(value ?? "")).slice(0, 14);
    if (!digits) return "";
    return currencyBRL(Number(digits) / 100);
  }

  function bindCompMasks() {
    const d = $("comp-data");
    const v = $("comp-valor");
    if (d && d.dataset.dkDateMask !== "1") {
      d.dataset.dkDateMask = "1";
      const applyD = () => {
        d.value = formatDateMask(d.value);
      };
      d.addEventListener("input", applyD);
      d.addEventListener("blur", applyD);
    }
    if (v && v.dataset.dkCurrencyMask !== "1") {
      v.dataset.dkCurrencyMask = "1";
      v.addEventListener("input", () => {
        v.value = formatCurrencyMask(v.value);
      });
      v.addEventListener("blur", () => {
        const n = parseCurrencyBR(v.value);
        v.value = n > 0 ? currencyBRL(n) : "";
      });
    }
  }

  function fillProtocoloSelect(locacoes) {
    const sel = $("comp-protocolo");
    if (!sel) return;
    const ativas = filterLocacoesAtivas(locacoes);
    sel.replaceChildren();
    const opt0 = document.createElement("option");
    opt0.value = "";
    opt0.textContent = "Selecione o protocolo";
    sel.appendChild(opt0);
    ativas.forEach((loc) => {
      const nc = normNc(loc.numeroContrato);
      if (!nc) return;
      const o = document.createElement("option");
      o.value = nc;
      o.textContent = `${nc} · ${String(loc.placa || "").trim() || "—"}`;
      sel.appendChild(o);
    });
  }

  function notificacaoMetaHtml(n) {
    const parts = [];
    if (n.protocolo) parts.push(`Protocolo ${escapeHtml(n.protocolo)}`);
    if (n.placa) parts.push(escapeHtml(n.placa));
    const quando = n.criadoEm ? new Date(n.criadoEm).toLocaleString("pt-BR") : "";
    if (quando) parts.push(escapeHtml(quando));
    if (n.lido && n.lidaEm) {
      parts.push(`Lido ${escapeHtml(new Date(n.lidaEm).toLocaleString("pt-BR"))}`);
    }
    return parts.length ? `<p class="cliente-notificacao__meta">${parts.join(" · ")}</p>` : "";
  }

  function renderNotificacaoItemHtml(n, extraClass) {
    return `<div class="cliente-notificacao${extraClass ? ` ${extraClass}` : ""}" role="status"><p class="cliente-notificacao__msg">${escapeHtml(n.mensagem)}</p>${notificacaoMetaHtml(n)}</div>`;
  }

  function garantirAvisosPagamentosNoApp(cpf) {
    const fn = window.__DK_clienteNotificacoesGarantirPagamentos;
    if (typeof fn !== "function") return;
    const dados = typeof loadDadosCliente === "function" ? loadDadosCliente(cpf) : { locacoes: [] };
    const pags = [];
    for (const loc of dados.locacoes || []) {
      const proto = normNc(loc.numeroContrato);
      const placa = String(loc.placa || "").trim();
      for (const p of getLancamentosFromLoc(loc)) {
        if (String(p.tipoMovimento || "").toUpperCase() === "DEVOLUCAO_INVESTIMENTO") continue;
        if (!(Number(p.valor) > 0)) continue;
        pags.push({
          valor: p.valor,
          data: p.data,
          dataPagamento: p.data,
          protocolo: proto || p.protocolo,
          placa,
        });
      }
    }
    if (pags.length) fn(cpf, pags);
  }

  function renderNotificacoes(cpf) {
    const wrap = $("cliente-notificacoes-wrap");
    const box = $("cliente-notificacoes");
    const btnLidas = $("btn-notif-lidas");
    const listFn = typeof window.__DK_clienteNotificacoesList === "function" ? window.__DK_clienteNotificacoesList : null;
    if (!wrap || !box || !listFn) return;
    const rows = listFn(cpf, { incluirLidas: false });
    if (!rows.length) {
      box.innerHTML = `<p class="subtext cliente-notificacoes-vazio">Nenhum aviso novo no momento.</p>`;
    } else {
      box.innerHTML = rows.map((n) => renderNotificacaoItemHtml(n)).join("");
    }
    if (btnLidas) btnLidas.disabled = !rows.length;
  }

  function renderAvisosLidosModal(cpf) {
    const modal = $("cliente-modal-avisos-lidos");
    const lista = $("cliente-avisos-lidos-lista");
    const listFn = typeof window.__DK_clienteNotificacoesList === "function" ? window.__DK_clienteNotificacoesList : null;
    if (!modal || !lista || !listFn) return;
    const rows = listFn(cpf, { apenasLidas: true });
    if (!rows.length) {
      lista.innerHTML = `<p class="subtext">Ainda não há avisos marcados como lidos.</p>`;
    } else {
      lista.innerHTML = rows.map((n) => renderNotificacaoItemHtml(n, "cliente-notificacao--lida")).join("");
    }
    modal.classList.remove("hidden");
    modal.removeAttribute("hidden");
  }

  function fecharAvisosLidosModal() {
    const modal = $("cliente-modal-avisos-lidos");
    if (!modal) return;
    modal.classList.add("hidden");
    modal.setAttribute("hidden", "");
  }

  function scrollToAvisosCliente() {
    const wrap = $("cliente-notificacoes-wrap");
    if (!wrap) return;
    wrap.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  window.__DK_clienteScrollToAvisos = scrollToAvisosCliente;

  function pagamentoSortKey(data, extraTs) {
    const d = parseBrDate(data);
    const t = d && !Number.isNaN(d.getTime()) ? d.getTime() : 0;
    const extra = Number(extraTs) || 0;
    return Math.max(t, extra);
  }

  function buildLinhasPagamentoContrato(loc, cpf, resumo) {
    const nc = normNc(loc.numeroContrato);
    const linhas = [];
    const compIdsNoLanc = new Set(
      (resumo?.lancamentos || [])
        .map((p) => String(p.origemComprovanteClienteId || "").trim())
        .filter(Boolean)
    );
    (resumo?.lancamentos || []).forEach((p) => {
      linhas.push({
        kind: "pago",
        sort: pagamentoSortKey(p.data, p.createdAt),
        label: p.confirmadoViaAppCliente
              ? "Confirmado (envio seu)"
              : p.registradoPorNome
                ? `DK — ${p.registradoPorNome}`
            : "Confirmado pela DK",
        data: p.data,
        valor: p.valor,
        extraClass: p.confirmadoViaAppCliente ? "cliente-pagamento-row--envio" : "",
      });
    });
    listComprovantesCliente(cpf)
      .filter((e) => normNc(e.protocolo) === nc && e.status === "confirmado")
      .filter((e) => e.pagamentoInvalidado || !compIdsNoLanc.has(String(e.id || "").trim()))
      .forEach((e) => {
        const inv = Boolean(e.pagamentoInvalidado);
        const extra =
          Date.parse(e.pagamentoInvalidadoEm || e.confirmadoEm || e.enviadoEm || "") || 0;
        linhas.push({
          kind: inv ? "invalidado" : "pago",
          sort: pagamentoSortKey(e.dataPagamento, extra),
          label: inv ? "Pagamento invalidado pela DK" : "Pagamento confirmado pela DK",
          data: e.dataPagamento,
          valor: Number(e.valorRegistadoProtocolo ?? e.valor ?? 0),
          extraClass: inv ? "cliente-pagamento-row--invalidado" : "cliente-pagamento-row--confirmado",
        });
      });
    listComprovantesCliente(cpf)
      .filter((e) => normNc(e.protocolo) === nc && e.status !== "confirmado")
      .filter((e) => !e.clienteDeAcordoEm)
      .forEach((e) => {
        const extra = Date.parse(e.rejeitadoEm || e.enviadoEm || e.iaValidadoEm || "") || 0;
        linhas.push({
          kind: "envio",
          sort: pagamentoSortKey(e.dataPagamento, extra),
          label: statusComprovanteLabel(e.status),
          motivoRejeicao: String(e.rejeitadoMotivoCliente || "").trim(),
          data: e.dataPagamento,
          valor: e.valor,
          status: e.status,
          id: e.id,
          syncNuvem: String(e.syncNuvem || "").trim() === "ok" ? "ok" : "pendente",
          extraClass: "cliente-pagamento-row--pendente",
        });
      });
    linhas.sort((a, b) => b.sort - a.sort);
    return linhas;
  }

  function syncNuvemRowClass(linha) {
    if (linha.kind !== "envio") return "";
    return linha.syncNuvem === "ok" ? "cliente-sync-nuvem--ok" : "cliente-sync-nuvem--pendente";
  }

  function renderLinhaPagamentoItem(linha) {
    const syncCls = syncNuvemRowClass(linha);
    const baseClass = `cliente-pagamento-row${linha.extraClass ? ` ${linha.extraClass}` : ""}${syncCls ? ` ${syncCls}` : ""}`;
    if (linha.kind === "envio" && linha.status === "rejeitado" && linha.id) {
      const motivoHtml = linha.motivoRejeicao
        ? `<p class="cliente-pagamento-row__motivo">${escapeHtml(linha.motivoRejeicao)}</p>`
        : "";
      return `<div class="${baseClass} cliente-pagamento-row--rejeitado">
        <div class="cliente-pagamento-row__main">
          <span class="cliente-pagamento-row__label">${escapeHtml(linha.label)} · ${escapeHtml(linha.data)}</span>
          ${motivoHtml}
        </div>
        <div class="cliente-pagamento-row__tail">
          <button type="button" class="cliente-btn-de-acordo" data-cc-de-acordo="${escapeHtml(linha.id)}">De acordo</button>
          <span class="cliente-pagamento-row__valor">${escapeHtml(currencyBRL(linha.valor))}</span>
        </div>
      </div>`;
    }
    return `<div class="${baseClass}"><span>${escapeHtml(linha.label)} · ${escapeHtml(linha.data)}</span><span>${escapeHtml(currencyBRL(linha.valor))}</span></div>`;
  }

  function renderSecaoPagamentos(linhas, nc) {
    if (!linhas.length) {
      return '<p class="subtext">Sem pagamentos registados neste protocolo.</p>';
    }
    const expanded = pagamentosExpandidos.has(nc);
    const visiveis = expanded ? linhas : linhas.slice(0, 5);
    const rowsHtml = visiveis.map((l) => renderLinhaPagamentoItem(l)).join("");
    let toggleHtml = "";
    if (linhas.length > 5) {
      if (expanded) {
        toggleHtml = `<button type="button" class="cliente-pagamentos-toggle" data-pag-collapse="${escapeHtml(nc)}" aria-label="Mostrar últimos 5 pagamentos">▲</button>`;
      } else {
        toggleHtml = `<button type="button" class="cliente-pagamentos-toggle" data-pag-expand="${escapeHtml(nc)}" aria-label="Ver todos os pagamentos (${linhas.length})">▼</button>`;
      }
    }
    return `<h3 class="cliente-subsecao">Pagamentos</h3><div class="cliente-pagamentos-list">${rowsHtml}</div>${toggleHtml}`;
  }

  function marcarComprovanteDeAcordo(id) {
    if (typeof window.__DK_comprovantesClienteDeAcordo === "function") {
      return window.__DK_comprovantesClienteDeAcordo(id);
    }
    try {
      const raw = localStorage.getItem("dk_comprovantes_cliente_pendentes");
      const all = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(all)) return { ok: false, msg: "Dados indisponíveis." };
      const idx = all.findIndex((r) => r.id === id);
      if (idx < 0) return { ok: false, msg: "Comprovante não encontrado." };
      if (all[idx].status !== "rejeitado") return { ok: false, msg: "Estado inválido." };
      all[idx].clienteDeAcordoEm = new Date().toISOString();
      localStorage.setItem("dk_comprovantes_cliente_pendentes", JSON.stringify(all.slice(0, 500)));
      if (typeof window.__DK_pushCloudSnapshotNow === "function") {
        window.__DK_pushCloudSnapshotNow().catch(() => {});
      }
      return { ok: true };
    } catch {
      return { ok: false, msg: "Não foi possível guardar." };
    }
  }

  function onClientePagamentosClick(e) {
    const expandBtn = e.target.closest?.("[data-pag-expand]");
    if (expandBtn) {
      e.preventDefault();
      pagamentosExpandidos.add(String(expandBtn.getAttribute("data-pag-expand") || "").trim());
      const sessao = getSessao();
      if (sessao) renderApp(sessao);
      return;
    }
    const collapseBtn = e.target.closest?.("[data-pag-collapse]");
    if (collapseBtn) {
      e.preventDefault();
      pagamentosExpandidos.delete(String(collapseBtn.getAttribute("data-pag-collapse") || "").trim());
      const sessao = getSessao();
      if (sessao) renderApp(sessao);
      return;
    }
    const deAcordoBtn = e.target.closest?.("[data-cc-de-acordo]");
    if (deAcordoBtn) {
      e.preventDefault();
      const id = deAcordoBtn.getAttribute("data-cc-de-acordo");
      marcarComprovanteDeAcordo(id);
      if (typeof window.__DK_comprovantesClienteInvalidateCache === "function") {
        window.__DK_comprovantesClienteInvalidateCache();
      }
      if (typeof window.__DK_markLocalDataAuthority === "function") {
        window.__DK_markLocalDataAuthority(5 * 60 * 1000);
      }
      const sessao = getSessao();
      if (sessao) renderApp(sessao);
    }
  }

  function renderContratoBadge(resumo) {
    const badge = resumo?.badge;
    if (!badge?.variant) return "";
    const cls = `cliente-badge-contrato cliente-badge-contrato--${badge.variant}`;
    return ` <span class="${cls}">${escapeHtml(badge.text || "Ativo")}</span>`;
  }

  function renderContratoCard(loc, cpf, resumoFn) {
    const nc = normNc(loc.numeroContrato);
    const resumo = resumoFn ? resumoFn(loc) : null;

    let detalhes;
    if (resumo) {
      const invRow =
        resumo.plano === "MINHA_MOTO"
          ? `<div><dt>Investimento atualizado</dt><dd>${escapeHtml(resumo.investimentoAcumulado)}</dd></div>`
          : "";
      const ult = resumo.ultimoPagamento;
      const ultRows = ult
        ? `<div><dt>Data do último pagamento</dt><dd>${escapeHtml(ult.data)}</dd></div>
          <div><dt>Valor do último pagamento</dt><dd>${escapeHtml(ult.valor)}</dd></div>
          <div><dt>Lançado por</dt><dd>${escapeHtml(ult.lancadoPor)}</dd></div>`
        : `<div><dt>Último pagamento</dt><dd class="cliente-em-breve">Nenhum pagamento registado</dd></div>`;

      detalhes = `<dl class="cliente-contrato-dl">
          <div><dt>Placa e modelo</dt><dd>${escapeHtml(resumo.placa || "—")} · ${escapeHtml(resumo.modeloVeiculo || "—")}</dd></div>
          <div><dt>Valor do contrato semanal</dt><dd>${escapeHtml(resumo.valorSemanal)}</dd></div>
          <div><dt>Valor pago</dt><dd>${escapeHtml(resumo.totalPago)}</dd></div>
          ${invRow}
          ${ultRows}
        </dl>`;
    } else {
      detalhes = `<p class="subtext">Resumo do contrato indisponível neste dispositivo.</p>`;
    }

    const docPainel = (tipo, tituloId) =>
      `<div id="cliente-docs-panel-${escapeHtml(nc)}-${tipo}" class="cliente-docs-inline hidden" data-cliente-docs-panel="${escapeHtml(nc)}" data-cliente-docs-tipo="${tipo}" hidden>
        <p class="cliente-docs-inline__head" data-cliente-docs-titulo id="${tituloId}"></p>
        <div class="cliente-docs-inline__lista" data-cliente-docs-lista></div>
        <div class="cliente-docs-inline__viewer" data-cliente-docs-viewer></div>
      </div>`;

    return `<article class="cliente-protocolo" data-cliente-proto="${escapeHtml(nc)}">
      <div class="cliente-protocolo__head">Protocolo ${escapeHtml(nc)}${renderContratoBadge(resumo)}</div>
      ${detalhes}
      <div class="cliente-docs-btns" role="group" aria-label="Documentos do protocolo ${escapeHtml(nc)}">
        <button type="button" class="btn-primary btn-secondary-outline cliente-btn-documentos cliente-btn-documentos--contrato" data-cliente-docs-proto="${escapeHtml(nc)}" data-cliente-docs-cpf="${escapeHtml(cpf)}" data-cliente-docs-tipo="contrato" aria-expanded="false" aria-controls="cliente-docs-panel-${escapeHtml(nc)}-contrato">Ver contrato</button>
        <button type="button" class="btn-primary btn-secondary-outline cliente-btn-documentos cliente-btn-documentos--crlv" data-cliente-docs-proto="${escapeHtml(nc)}" data-cliente-docs-cpf="${escapeHtml(cpf)}" data-cliente-docs-tipo="crlv" aria-expanded="false" aria-controls="cliente-docs-panel-${escapeHtml(nc)}-crlv">Ver CRLV</button>
        <button type="button" class="btn-primary btn-secondary-outline cliente-btn-documentos cliente-btn-documentos--multa" data-cliente-docs-proto="${escapeHtml(nc)}" data-cliente-docs-cpf="${escapeHtml(cpf)}" data-cliente-docs-tipo="multa" aria-expanded="false" aria-controls="cliente-docs-panel-${escapeHtml(nc)}-multa">Ver multas</button>
      </div>
      ${docPainel("contrato", `cliente-docs-title-${escapeHtml(nc)}-contrato`)}
      ${docPainel("crlv", `cliente-docs-title-${escapeHtml(nc)}-crlv`)}
      ${docPainel("multa", `cliente-docs-title-${escapeHtml(nc)}-multa`)}
    </article>`;
  }

  function isClienteAppPage() {
    try {
      const p = String(location.pathname || "").toLowerCase();
      return p === "/cliente" || p.endsWith("/cliente") || p.endsWith("/cliente.html");
    } catch {
      return false;
    }
  }

  function countPagamentosCliente(cpf) {
    const locs = loadCadastro(CAD_LOCACOES_KEY).filter((l) => onlyDigits(l.cpf) === cpf);
    const ativas = filterLocacoesAtivas(locs);
    let n = 0;
    let total = 0;
    ativas.forEach((loc) => {
      getLancamentosFromLoc(loc).forEach((p) => {
        n += 1;
        total += Number(p.valor) || 0;
      });
    });
    return { n, total };
  }

  function consolidarLancamentosClienteLogado(cpf) {
    const dig = onlyDigits(cpf).slice(0, 11);
    if (dig.length !== 11 || typeof window.__DK_consolidarLancamentosAluguelLoc !== "function") return;
    if (typeof window.__DK_clearGlobalLancamentosStorageCache === "function") {
      window.__DK_clearGlobalLancamentosStorageCache();
    }
    const all = loadCadastro(CAD_LOCACOES_KEY);
    if (!Array.isArray(all) || !all.length) return;
    let changed = false;
    for (const loc of all) {
      if (!loc || onlyDigits(loc.cpf).slice(0, 11) !== dig) continue;
      window.__DK_consolidarLancamentosAluguelLoc(loc, { mutate: true });
      changed = true;
    }
    if (changed) saveJson(CAD_LOCACOES_KEY, all);
  }

  async function sincronizarDadosCliente(sessao, opts) {
    const silent = Boolean(opts?.silent);
    const msg = $("sync-msg");
    if (msg && !silent) msg.textContent = "A sincronizar com a nuvem…";
    let syncOk = false;
    try {
      if (!silent && typeof window.__DK_pullCloudSnapshotSilentMerge === "function") {
        await Promise.race([
          window.__DK_pullCloudSnapshotSilentMerge({ force: true }),
          new Promise((_, reject) => {
            window.setTimeout(() => reject(new Error("timeout")), 45000);
          }),
        ]);
      } else {
        const pullFn =
          typeof window.__DK_pullClienteCloudSnapshotLight === "function"
            ? window.__DK_pullClienteCloudSnapshotLight
            : window.__DK_pullCloudSnapshotSilentMerge;
        if (typeof pullFn === "function") {
          await Promise.race([
            pullFn({ force: false }),
            new Promise((_, reject) => {
              window.setTimeout(() => reject(new Error("timeout")), 45000);
            }),
          ]);
        }
      }
      if (
        !isClienteAppPage() &&
        typeof window.__DK_comprovantesClienteRepararHistorico === "function"
      ) {
        await Promise.race([
          window.__DK_comprovantesClienteRepararHistorico({ leve: true }),
          new Promise((resolve) => {
            window.setTimeout(resolve, 8000);
          }),
        ]);
      }
      if (typeof window.__DK_comprovantesClienteInvalidateCache === "function") {
        window.__DK_comprovantesClienteInvalidateCache();
      }
      syncOk = true;
      if (sessao?.cpf) {
        lastClienteRenderKey = "";
      }
      if (msg && !silent) {
        const pend =
          typeof window.__DK_comprovantesClienteTemPendentesNuvem === "function" &&
          window.__DK_comprovantesClienteTemPendentesNuvem();
        const hora = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
        msg.textContent = pend
          ? `Atualizado às ${hora}. Alguns envios ainda só neste telemóvel — repita com internet.`
          : `Atualizado da nuvem às ${hora}.`;
      }
    } catch {
      if (msg && !silent) msg.textContent = "Usando dados locais — deslize o ecrã para baixo para atualizar.";
    } finally {
      if (sessao) {
        if (silent) scheduleClienteRender(sessao);
        else resolveAppViewAfterData(sessao);
        if (msg && !silent && !syncOk && msg.textContent.startsWith("A sincronizar")) {
          msg.textContent = "Usando dados locais — deslize o ecrã para baixo para atualizar.";
        }
      }
    }
  }

  let clienteRenderRaf = 0;
  let clienteRenderDebounce = 0;
  let lastClienteRenderKey = "";

  function clienteRenderKey(sessao) {
    const cpf = sessao?.cpf;
    if (!cpf) return "";
    const locs = filterLocacoesAtivas(
      loadCadastro(CAD_LOCACOES_KEY).filter((l) => onlyDigits(l.cpf) === cpf)
    );
    return locs
      .map((loc) => {
        const nc = normNc(loc.numeroContrato);
        const n = Array.isArray(loc.portalLancamentosAluguel) ? loc.portalLancamentosAluguel.length : 0;
        return `${nc}:${n}:${loc.updatedAt || 0}`;
      })
      .join("|");
  }

  function scheduleClienteRender(sessao) {
    if (!sessao?.cpf) return;
    if (clienteRenderDebounce) window.clearTimeout(clienteRenderDebounce);
    clienteRenderDebounce = window.setTimeout(() => {
      clienteRenderDebounce = 0;
      if (clienteRenderRaf) cancelAnimationFrame(clienteRenderRaf);
      clienteRenderRaf = requestAnimationFrame(() => {
        clienteRenderRaf = 0;
        renderApp(sessao);
      });
    }, 120);
  }

  function onComprovantesSyncedRefreshView() {
    const sessao = getSessao();
    if (sessao?.cpf) scheduleClienteRender(sessao);
  }

  const DK_MINHA_MOTO_SEMANAS_PLANO = 150;

  function locEhPlanoDkMinhaMoto(loc, resumo) {
    if (resumo?.badge?.variant === "carro") return false;
    if (resumo?.plano) return resumo.plano === "MINHA_MOTO";
    const key = String(loc?.plano || loc?.opcaoContrato || "")
      .toUpperCase()
      .normalize("NFD")
      .replace(/\p{M}/gu, "");
    if (key.includes("MINHA") && key.includes("MOTO")) return true;
    if (key.includes("MEU") && key.includes("TRANSPORTE")) return false;
    if (key.includes("CARRO")) return false;
    return parseCurrencyBR(loc?.valorInvestimento ?? 0) > 0;
  }

  function computeSemanasPagasMinhaMoto(loc, resumo) {
    const plano = resumo
      ? parseCurrencyBR(resumo.valorSemanal)
      : parseCurrencyBR(loc.valorSemanal || loc.valorParcela) ||
        parseCurrencyBR(loc.valorLocacao) + parseCurrencyBR(loc.valorInvestimento);
    const totalPago = getLancamentosFromLoc(loc).reduce((s, p) => s + p.valor, 0);
    const semanas = plano > 0 ? Math.floor(totalPago / plano) : 0;
    return { semanas, plano, totalPago };
  }

  function pctProgressoMinhaMoto(semanas) {
    const n = Math.max(0, Number(semanas) || 0);
    return Math.min(100, Math.round((n * 100) / DK_MINHA_MOTO_SEMANAS_PLANO));
  }

  function renderPremioMinhaMotoBarHtml(pct, ariaLabel) {
    return `<div class="cliente-premio__bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}" aria-label="${escapeHtml(ariaLabel)}">
        <div class="cliente-premio__track">
          <div class="cliente-premio__fill"></div>
          <span class="cliente-premio__marker" aria-hidden="true"></span>
        </div>
        <div class="cliente-premio__labels">
          <span class="cliente-premio__pct">${pct}%</span>
          <span class="cliente-premio__fim">100%</span>
        </div>
      </div>`;
  }

  function renderPremioMinhaMotoHtml(loc, resumo, multi) {
    const { semanas } = computeSemanasPagasMinhaMoto(loc, resumo);
    const pct = pctProgressoMinhaMoto(semanas);
    const placa = String(loc.placa || "").trim().toUpperCase();
    const proto = String(loc.numeroContrato || "").trim();
    const extra =
      multi && (placa || proto)
        ? `<p class="cliente-premio__contrato">${escapeHtml([placa, proto].filter(Boolean).join(" · "))}</p>`
        : "";
    return `<article class="cliente-premio" data-semanas="${semanas}" data-pct="${pct}" style="--pct:${pct}%">
      <div class="cliente-premio__scene">
        <img src="/images/dk-minha-moto-premio.png?v=20260824premio" alt="DK Minha Moto — seu prêmio te espera" width="1200" height="675" decoding="async">
      </div>
      ${renderPremioMinhaMotoBarHtml(pct, "Progresso do plano DK Minha Moto")}
      <p class="cliente-premio__meta">DK MINHA MOTO · <strong>${semanas}</strong> de ${DK_MINHA_MOTO_SEMANAS_PLANO} semanas</p>
      ${extra}
    </article>`;
  }

  function renderPremioMinhaMotoConviteHtml() {
    return `<article class="cliente-premio cliente-premio--convite" data-semanas="0" data-pct="0" data-modo="convite" style="--pct:0%">
      <div class="cliente-premio__scene">
        <img src="/images/dk-minha-moto-premio.png?v=20260824premio" alt="DK Minha Moto — seu prêmio te espera" width="1200" height="675" decoding="async">
      </div>
      ${renderPremioMinhaMotoBarHtml(0, "Convite para o plano DK Minha Moto")}
      <p class="cliente-premio__cta">VENHA REALIZAR SEU SONHO NO PLANO DK MINHA MOTO</p>
    </article>`;
  }

  function renderApp(sessao, opts) {
    const renderKey = clienteRenderKey(sessao);
    if (!opts?.force && renderKey && renderKey === lastClienteRenderKey) {
      return;
    }
    lastClienteRenderKey = renderKey;

    applyClienteComprovanteUiVisibility();
    if (typeof window.__DK_comprovantesClienteInvalidateCache === "function") {
      window.__DK_comprovantesClienteInvalidateCache();
    }
    const cpf = sessao.cpf;
    const dados = loadDadosCliente(cpf);
    const locAtivas = filterLocacoesParaExibicao(dados.locacoes);
    $("cliente-nome").textContent = sessao.nome;
    $("cliente-cpf-label").textContent = formatCpf(cpf);

    const resumoFn =
      typeof window.__DK_clienteComputeResumoContrato === "function"
        ? window.__DK_clienteComputeResumoContrato
        : null;

    const resumo = $("cliente-resumo");
    if (resumo) {
      const minhasMotos = locAtivas.filter((loc) => locEhPlanoDkMinhaMoto(loc, resumoFn ? resumoFn(loc) : null));
      const linhas = minhasMotos.length
        ? minhasMotos
            .map((loc) => renderPremioMinhaMotoHtml(loc, resumoFn ? resumoFn(loc) : null, minhasMotos.length > 1))
            .join("")
        : renderPremioMinhaMotoConviteHtml();
      resumo.hidden = false;
      resumo.removeAttribute("hidden");
      resumo.classList.remove("subtext");
      resumo.innerHTML = `<div class="cliente-premio-wrap">${linhas}</div>`;
    }

    garantirAvisosPagamentosNoApp(cpf);
    renderNotificacoes(cpf);

    const lista = $("cliente-contratos");
    if (lista) {
      if (!locAtivas.length) {
        lista.innerHTML =
          '<p class="subtext">Nenhum protocolo ativo. Se a locação acabou de ser finalizada, atualize da nuvem — verá apenas novidades DK.</p>';
      } else {
        lista.innerHTML = locAtivas.map((loc) => renderContratoCard(loc, cpf, resumoFn)).join("");
      }
    }

    fillProtocoloSelect(dados.locacoes);
    if (clienteEnvioComprovanteAtivo()) bindCompMasks();
  }

  function focusComprovanteSection() {
    if (!clienteEnvioComprovanteAtivo()) return;
    const el = $("cliente-sec-comprovante");
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    pendingShareFocus = false;
    window.setTimeout(() => $("comp-data")?.focus(), 300);
  }

  function preselectProtocoloComprovante() {
    const sel = $("comp-protocolo");
    if (!sel || sel.value) return;
    for (let i = 1; i < sel.options.length; i++) {
      if (sel.options[i].value) {
        sel.selectedIndex = i;
        break;
      }
    }
  }

  function attachFileToComprovanteInput(file) {
    comprovanteFile = file;
    const input = $("comp-arquivo");
    if (input && typeof DataTransfer !== "undefined") {
      try {
        const dt = new DataTransfer();
        dt.items.add(file);
        input.files = dt.files;
        input.dispatchEvent(new Event("change", { bubbles: true }));
      } catch {
        /* preview only */
      }
    }
    const preview = $("comp-preview");
    if (preview) {
      try {
        if (preview.src && preview.src.startsWith("blob:")) URL.revokeObjectURL(preview.src);
      } catch {
        /* ignore */
      }
      preview.src = URL.createObjectURL(file);
      preview.classList.add("is-visible");
    }
  }

  async function applySharedFileToComprovante(file) {
    if (!clienteEnvioComprovanteAtivo()) return false;
    if (!file || !file.size) return false;
    attachFileToComprovanteInput(file);

    const msgApp = $("comp-msg");
    const msgLogin = $("login-feedback");
    const hint =
      "Comprovante anexado — escolha o protocolo, informe data e valor e toque em Enviar comprovante.";
    pendingShareFocus = true;

    const sessao = getSessao();
    if (sessao?.cpf) {
      showView("app");
      renderApp(sessao);
      if (msgApp) msgApp.textContent = hint;
      preselectProtocoloComprovante();
      focusComprovanteSection();
    } else {
      showView("login");
      if (msgLogin) {
        msgLogin.textContent =
          "Comprovante recebido — entre com CPF e senha; o ficheiro já está no anexo.";
      }
    }
    return true;
  }

  function consumePendingShareFromSessionStorage() {
    let raw = null;
    try {
      raw = sessionStorage.getItem(PENDING_SHARE_SESSION_KEY) || localStorage.getItem(PENDING_SHARE_SESSION_KEY);
    } catch {
      return false;
    }
    if (!raw) return false;
    try {
      sessionStorage.removeItem(PENDING_SHARE_SESSION_KEY);
      localStorage.removeItem(PENDING_SHARE_SESSION_KEY);
    } catch {
      /* ignore */
    }
    try {
      const o = JSON.parse(raw);
      if (!o?.b64) return false;
      const bin = atob(o.b64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const mime = String(o.mime || "application/octet-stream");
      const name = String(o.name || "comprovante");
      const file = new File([bytes], name, { type: mime });
      applySharedFileToComprovante(file);
      return true;
    } catch {
      return false;
    }
  }

  async function processIncomingShare() {
    if (!clienteEnvioComprovanteAtivo()) return;
    const q = new URLSearchParams(location.search);
    if (q.get("dkShare") === "large") {
      const fb = $("login-feedback") || $("comp-msg");
      if (fb) fb.textContent = "Comprovante muito grande. Use uma captura de ecrã ou anexe manualmente no app.";
      return;
    }
    if (q.get("dkShare") === "empty" || q.get("dkShare") === "error") {
      const fb = $("login-feedback") || $("comp-msg");
      if (fb) fb.textContent = "Não foi possível receber o ficheiro. Anexe o comprovante manualmente abaixo.";
      return;
    }
    if (consumePendingShareFromSessionStorage()) return;
    if (await consumeShareFromServiceWorkerCache()) return;
  }

  async function consumeShareFromServiceWorkerCache() {
    if (!("caches" in window)) return false;
    try {
      const cache = await Promise.race([
        caches.open("dk-cliente-share-v1"),
        new Promise((_, reject) => {
          window.setTimeout(() => reject(new Error("share-cache-timeout")), 4000);
        }),
      ]);
      const res = await cache.match(SHARE_CACHE_KEY);
      if (!res) return false;
      const name = decodeURIComponent(res.headers.get("X-DK-Filename") || "comprovante");
      const blob = await res.blob();
      const file = new File([blob], name, { type: blob.type || "application/octet-stream" });
      await applySharedFileToComprovante(file);
      await cache.delete(SHARE_CACHE_KEY);
      return true;
    } catch {
      return false;
    }
  }

  function wireLaunchQueueShare() {
    if (!clienteEnvioComprovanteAtivo()) return;
    if (!("launchQueue" in window)) return;
    try {
      window.launchQueue.setConsumer(async (launchParams) => {
        if (launchParams.files?.length) {
          await applySharedFileToComprovante(launchParams.files[0]);
          return;
        }
        if (launchParams.targetURL) {
          const u = new URL(launchParams.targetURL, location.origin);
          if (u.searchParams.get("dkShare") === "file") {
            pendingShareFocus = true;
            await consumeShareFromServiceWorkerCache();
          }
        }
      });
    } catch {
      /* ignore */
    }
  }

  async function unregisterCorporativoServiceWorkers() {
    if (!("serviceWorker" in navigator)) return;
    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(
        regs.map(async (reg) => {
          const url =
            reg.active?.scriptURL || reg.installing?.scriptURL || reg.waiting?.scriptURL || "";
          if (url.includes("corporativo")) await reg.unregister();
        })
      );
    } catch {
      /* ignore */
    }
  }

  async function registerClienteServiceWorker() {
    if (!("serviceWorker" in navigator) || location.protocol === "file:") return null;
    await unregisterCorporativoServiceWorkers();
    try {
      return await navigator.serviceWorker.register("/service-worker-cliente.js?v=20260904avisos-fix", {
        scope: "/",
        updateViaCache: "none",
      });
    } catch {
      try {
        return await navigator.serviceWorker.register("./service-worker-cliente.js", { scope: "/" });
      } catch {
        return null;
      }
    }
  }

  function parseShareFromUrl() {
    const q = new URLSearchParams(location.search);
    if (q.get("dkShare") === "file") return { type: "file" };
    const text = [q.get("title"), q.get("text"), q.get("url")].filter(Boolean).join(" ");
    if (text.trim()) return { type: "text", text };
    return null;
  }

  function openRelatorioPagamentos() {
    const sessao = getSessao();
    if (!sessao?.cpf) return;
    const build = window.__DK_clienteBuildRelatorioPagamentosHtml;
    if (typeof build !== "function") {
      window.alert("Relatório indisponível neste dispositivo.");
      return;
    }
    const html = build(sessao.cpf, sessao.nome);
    lastRelatorioHtml = html;
    const modal = $("cliente-modal-relatorio");
    const frame = $("cliente-relatorio-frame");
    if (modal && frame) {
      frame.srcdoc = html;
      modal.classList.remove("hidden");
      frame.onload = () => {
        try {
          const doc = frame.contentDocument;
          if (!doc) return;
          doc.querySelectorAll(".lnk-comprovante[data-dk-comprovante-id]").forEach((a) => {
            a.addEventListener("click", (ev) => {
              ev.preventDefault();
              const id = a.getAttribute("data-dk-comprovante-id");
              if (id && typeof window.__DK_openComprovanteClienteViewerById === "function") {
                window.__DK_openComprovanteClienteViewerById(id);
              }
            });
          });
        } catch {
          /* ignore */
        }
      };
      return;
    }
    const w = window.open("", "_blank");
    if (w) {
      w.document.open();
      w.document.write(html);
      w.document.close();
    }
  }

  async function checkAtualizacaoPrograma() {
    if (!("serviceWorker" in navigator) || location.protocol === "file:") return;
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) await reg.update();
    } catch {
      /* ignore */
    }
  }

  async function atualizarProgramaEDados(sessao, opts) {
    await checkAtualizacaoPrograma();
    if (!isGeoGateBypassed() && sessao?.cpf && isClienteRealSession(sessao) && typeof window.__DK_clienteGeoEnsurePermission === "function") {
      const perm = await window.__DK_clienteGeoQueryState?.();
      if (perm === "granted") {
        if (!window.__DK_clienteGeoHasConsent?.()) {
          const geo = await window.__DK_clienteGeoEnsurePermission({ required: false });
          if (geo.ok) startGeoForSession(sessao);
        } else {
          startGeoForSession(sessao);
        }
      }
    }
    await sincronizarDadosCliente(sessao, opts);
  }

  async function pullNuvem() {
    const sessao = getSessao();
    await atualizarProgramaEDados(sessao, { silent: false });
  }

  /* Puxar para atualizar: dedo de cima para baixo no topo da página sincroniza da nuvem. */
  function wirePullToRefresh() {
    if (document.documentElement.dataset.dkPullRefreshBound === "1") return;
    document.documentElement.dataset.dkPullRefreshBound = "1";
    const LIMIAR_PX = 80;
    let startY = 0;
    let pulling = false;
    let busy = false;
    document.addEventListener(
      "touchstart",
      (e) => {
        if (window.scrollY > 5 || busy) {
          pulling = false;
          return;
        }
        startY = e.touches?.[0]?.clientY ?? 0;
        pulling = true;
      },
      { passive: true }
    );
    document.addEventListener(
      "touchmove",
      (e) => {
        if (!pulling || busy) return;
        const dy = (e.touches?.[0]?.clientY ?? 0) - startY;
        if (dy < LIMIAR_PX || window.scrollY > 5) return;
        pulling = false;
        const sessao = getSessao();
        if (!sessao?.cpf) return;
        busy = true;
        const msg = $("sync-msg");
        if (msg) msg.textContent = "A atualizar da nuvem…";
        void pullNuvem().finally(() => {
          busy = false;
        });
      },
      { passive: true }
    );
    document.addEventListener(
      "touchend",
      () => {
        pulling = false;
      },
      { passive: true }
    );
  }

  let comprovanteFile = null;
  let lastRelatorioHtml = "";
  let relatorioPdfRunId = 0;
  let relatorioShareActive = false;

  function setRelatorioShareMsg(text) {
    const el = $("cliente-relatorio-share-msg");
    if (el) el.textContent = String(text || "").trim();
  }

  function fecharModalRelatorio() {
    relatorioPdfRunId += 1;
    relatorioShareActive = false;
    const btn = $("btn-relatorio-compartilhar");
    if (btn) btn.disabled = false;
    setRelatorioShareMsg("");
    const frame = $("cliente-relatorio-frame");
    if (frame) {
      try {
        frame.srcdoc = "";
        frame.removeAttribute("srcdoc");
      } catch {
        /* ignore */
      }
    }
    $("cliente-modal-relatorio")?.classList.add("hidden");
  }

  function htmlRelatorioSemScripts(html) {
    return String(html || "").replace(/<script[\s\S]*?<\/script>/gi, "");
  }

  function prepararCloneParaPdf(sourceBody) {
    const clone = sourceBody.cloneNode(true);
    clone.querySelectorAll("script, img, picture, svg, canvas, video, iframe, object").forEach((n) => n.remove());
    clone.querySelectorAll("button, .lnk-comprovante").forEach((btn) => {
      const span = document.createElement("span");
      span.textContent = String(btn.textContent || "").trim() || "—";
      btn.replaceWith(span);
    });
    return clone;
  }

  function carregarIframeRelatorioHtml(html) {
    const clean = htmlRelatorioSemScripts(html);
    const iframe = document.createElement("iframe");
    iframe.setAttribute("aria-hidden", "true");
    iframe.style.cssText =
      "position:fixed;left:-9999px;top:0;width:800px;height:10px;border:0;opacity:0;pointer-events:none";
    document.body.appendChild(iframe);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        iframe.remove();
        reject(new Error("Tempo esgotado ao preparar o relatório."));
      }, 20000);
      iframe.onload = () => {
        clearTimeout(timer);
        resolve(iframe);
      };
      iframe.onerror = () => {
        clearTimeout(timer);
        iframe.remove();
        reject(new Error("Não foi possível carregar o relatório."));
      };
      iframe.srcdoc = clean;
    });
  }

  function gerarPdfTextoFallback(texto, titulo) {
    const JsPDF = window.jspdf?.jsPDF || window.jsPDF;
    if (!JsPDF) throw new Error("Gerador PDF indisponível.");
    const doc = new JsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
    const margin = 10;
    const maxW = 190;
    let y = margin;
    doc.setFontSize(14);
    doc.text(String(titulo || "Relatório DK"), margin, y);
    y += 8;
    doc.setFontSize(9);
    const lines = doc.splitTextToSize(String(texto || "").trim() || "—", maxW);
    for (let i = 0; i < lines.length; i++) {
      if (y > 285) {
        doc.addPage();
        y = margin;
      }
      doc.text(lines[i], margin, y);
      y += 4.5;
    }
    return doc.output("blob");
  }

  function textoRelatorioParaPdf(html, titulo) {
    const frame = $("cliente-relatorio-frame");
    const doFrame = String(frame?.contentDocument?.body?.innerText || "").trim();
    if (doFrame.length > 40) return { texto: doFrame, titulo };
    const clean = htmlRelatorioSemScripts(html);
    const tmp = document.createElement("div");
    tmp.innerHTML = clean;
    tmp.querySelectorAll("script, style").forEach((n) => n.remove());
    const texto = String(tmp.innerText || tmp.textContent || "").trim();
    if (texto.length > 40) return { texto, titulo };
    return null;
  }

  async function gerarPdfBlobRelatorio(html, titulo) {
    const pack = textoRelatorioParaPdf(html, titulo);
    if (!pack) throw new Error("Relatório vazio.");
    if (window.jspdf?.jsPDF || window.jsPDF) {
      return gerarPdfTextoFallback(pack.texto, pack.titulo);
    }
    throw new Error("Gerador PDF indisponível. Atualize a página do app.");
  }

  function transferirPdfParaDownload(pdfBlob, nomeArquivo) {
    const url = URL.createObjectURL(pdfBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = nomeArquivo;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  async function compartilharRelatorioPagamentos() {
    if (relatorioShareActive) return;
    const sessao = getSessao();
    if (!sessao?.cpf) return;
    const html = String(lastRelatorioHtml || $("cliente-relatorio-frame")?.srcdoc || "").trim();
    if (!html) {
      setRelatorioShareMsg("Gere o relatório antes de compartilhar.");
      return;
    }

    const btn = $("btn-relatorio-compartilhar");
    const cpfDig = onlyDigits(sessao.cpf).slice(0, 11);
    const nomePdf = `Relatorio-DK-${cpfDig || "cliente"}.pdf`;
    const titulo = `Relatório DK — ${sessao.nome || "Cliente"}`;
    const texto = `Relatório de pagamentos DK Locadora · ${sessao.nome || ""} · CPF ${formatCpf(sessao.cpf)}`;
    const runId = ++relatorioPdfRunId;

    relatorioShareActive = true;
    if (btn) btn.disabled = true;
    setRelatorioShareMsg("A gerar PDF… aguarde.");

    let pdfBlob;
    try {
      try {
        pdfBlob = await gerarPdfBlobRelatorio(html, titulo);
      } catch (errPrim) {
        const pack = textoRelatorioParaPdf(html, titulo);
        if (!pack) throw errPrim;
        setRelatorioShareMsg("Modo simplificado (texto)…");
        pdfBlob = gerarPdfTextoFallback(pack.texto, pack.titulo);
      }
      if (runId !== relatorioPdfRunId) return;

      const pdfFile = new File([pdfBlob], nomePdf, { type: "application/pdf" });

      if (navigator.share) {
        try {
          await navigator.share({ title: titulo, text: texto, files: [pdfFile] });
          if (runId === relatorioPdfRunId) {
            setRelatorioShareMsg("Escolha WhatsApp, e-mail ou outra app na lista.");
          }
          return;
        } catch (err) {
          if (err?.name === "AbortError") {
            if (runId === relatorioPdfRunId) setRelatorioShareMsg("Partilha cancelada.");
            return;
          }
        }
      }

      if (runId !== relatorioPdfRunId) return;
      transferirPdfParaDownload(pdfBlob, nomePdf);
      setRelatorioShareMsg("PDF guardado. Abra Downloads e partilhe por WhatsApp ou e-mail.");
    } catch (err) {
      if (runId === relatorioPdfRunId) {
        setRelatorioShareMsg(err?.message || "Não foi possível gerar o PDF.");
      }
    } finally {
      if (runId === relatorioPdfRunId) {
        relatorioShareActive = false;
        if (btn) btn.disabled = false;
      }
    }
  }

  function onComprovanteFileChange() {
    const input = $("comp-arquivo");
    const preview = $("comp-preview");
    const file = input?.files?.[0];
    comprovanteFile = file || null;
    if (!preview) return;
    if (!file) {
      preview.classList.remove("is-visible");
      if (preview.src && preview.src.startsWith("blob:")) {
        try {
          URL.revokeObjectURL(preview.src);
        } catch {
          /* ignore */
        }
      }
      preview.removeAttribute("src");
      return;
    }
    if (preview.src && preview.src.startsWith("blob:")) {
      try {
        URL.revokeObjectURL(preview.src);
      } catch {
        /* ignore */
      }
    }
    preview.src = URL.createObjectURL(file);
    preview.classList.add("is-visible");
  }

  /** Limpa o formulário após envio bem-sucedido para um novo pagamento. */
  function limparFormularioComprovante() {
    const sel = $("comp-protocolo");
    const dataInp = $("comp-data");
    const valorInp = $("comp-valor");
    const fileInp = $("comp-arquivo");
    const preview = $("comp-preview");
    if (sel) sel.value = "";
    if (dataInp) dataInp.value = "";
    if (valorInp) valorInp.value = "";
    comprovanteFile = null;
    if (fileInp) fileInp.value = "";
    if (preview) {
      if (preview.src && preview.src.startsWith("blob:")) {
        try {
          URL.revokeObjectURL(preview.src);
        } catch {
          /* ignore */
        }
      }
      preview.classList.remove("is-visible");
      preview.removeAttribute("src");
    }
  }

  /** Limpa o formulário após envio bem-sucedido para novo pagamento. */
  function limparFormularioComprovante() {
    const sel = $("comp-protocolo");
    const dataInp = $("comp-data");
    const valorInp = $("comp-valor");
    const fileInp = $("comp-arquivo");
    const preview = $("comp-preview");
    if (sel) sel.value = "";
    if (dataInp) dataInp.value = "";
    if (valorInp) valorInp.value = "";
    if (fileInp) fileInp.value = "";
    comprovanteFile = null;
    if (preview) {
      try {
        if (preview.src && preview.src.startsWith("blob:")) URL.revokeObjectURL(preview.src);
      } catch {
        /* ignore */
      }
      preview.classList.remove("is-visible");
      preview.removeAttribute("src");
    }
  }

  function statusComprovanteLabel(st) {
    if (st === "confirmado") return "Pagamento confirmado pela DK";
    if (st === "ia_validado") return "Conferido — aguarda confirmação final";
    if (st === "rejeitado") return "Comprovante não aceite";
    return "Enviado — aguarda conferência do operador";
  }

  function listComprovantesCliente(cpf) {
    if (typeof window.__DK_comprovantesClienteListByCpf === "function") {
      return window.__DK_comprovantesClienteListByCpf(cpf);
    }
    try {
      const raw = localStorage.getItem("dk_comprovantes_cliente_pendentes");
      const all = raw ? JSON.parse(raw) : [];
      return Array.isArray(all) ? all.filter((r) => onlyDigits(r.cpf) === cpf) : [];
    } catch {
      return [];
    }
  }

  async function enviarComprovanteParaNuvem() {
    if (!clienteEnvioComprovanteAtivo()) return;
    const sessao = getSessao();
    if (!sessao) return;
    const proto = normNc($("comp-protocolo")?.value);
    const data = String($("comp-data")?.value || "").trim();
    const valor = Math.round(parseCurrencyBR($("comp-valor")?.value) * 100 + Number.EPSILON) / 100;
    const msg = $("comp-msg");
    const btn = $("btn-enviar-comprovante");
    if (!proto) {
      if (msg) msg.textContent = "Selecione o protocolo.";
      return;
    }
    if (!data || !parseBrDate(data)) {
      if (msg) msg.textContent = "Informe a data do pagamento (DD/MM/AAAA).";
      return;
    }
    if (valor <= 0) {
      if (msg) msg.textContent = "Informe o valor pago.";
      return;
    }
    if (!comprovanteFile) {
      if (msg) msg.textContent = "Anexe a imagem ou PDF do comprovante.";
      return;
    }

    if (btn) btn.disabled = true;
    if (msg) msg.textContent = "A enviar comprovante para a nuvem…";

    const addFn = typeof window.__DK_comprovantesClienteAdd === "function" ? window.__DK_comprovantesClienteAdd : null;
    let res = { ok: false, msg: "Módulo de comprovantes indisponível." };
    if (addFn) {
      try {
        res = await addFn({
          cpf: sessao.cpf,
          nomeCliente: sessao.nome,
          protocolo: proto,
          dataPagamento: data,
          valor,
          file: comprovanteFile,
          nomeArquivo: comprovanteFile.name,
          mimeType: comprovanteFile.type,
        });
      } catch (err) {
        res = { ok: false, msg: err?.message || "Falha ao enviar." };
      }
    }

    if (!res.ok) {
      if (msg) {
        msg.textContent = res.msg || "Não foi possível enviar.";
        msg.classList.remove("cliente-comp-msg--nuvem-ok", "cliente-comp-msg--nuvem-pendente");
      }
      if (btn) btn.disabled = false;
      return;
    }

    let pushRes = null;
    if (typeof window.__DK_comprovantesClientePushNuvem === "function") {
      try {
        pushRes = await window.__DK_comprovantesClientePushNuvem();
      } catch {
        pushRes = { ok: false };
      }
    }
    const naNuvem = Boolean(pushRes?.ok);

    const hist = loadJson(COMPROVANTES_KEY, []);
    hist.unshift({
      id: res.id || Date.now(),
      cpf: sessao.cpf,
      protocolo: proto,
      data,
      valor,
      nomeArquivo: comprovanteFile.name,
      enviadoEm: new Date().toISOString(),
    });
    saveJson(COMPROVANTES_KEY, hist.slice(0, 50));

    const texto = `Comprovante DK Locadora\nCliente: ${sessao.nome}\nCPF: ${formatCpf(sessao.cpf)}\nProtocolo: ${proto}\nData: ${data}\nValor: ${currencyBRL(valor)}`;
    const filePartilha = comprovanteFile;
    try {
      if (navigator.share && filePartilha) {
        const payload = { title: "Comprovante DK Locadora", text: texto };
        if (navigator.canShare && navigator.canShare({ files: [filePartilha] })) {
          payload.files = [filePartilha];
        }
        await navigator.share(payload);
      }
    } catch {
      /* partilha opcional */
    }

    limparFormularioComprovante();
    if (msg) {
      msg.classList.remove("cliente-comp-msg--nuvem-ok", "cliente-comp-msg--nuvem-pendente");
      if (naNuvem) {
        msg.classList.add("cliente-comp-msg--nuvem-ok");
        msg.textContent =
          "Comprovante guardado e enviado à nuvem (azul na lista). A DK valida automaticamente.";
      } else {
        msg.classList.add("cliente-comp-msg--nuvem-pendente");
        msg.textContent =
          "Comprovante guardado neste telemóvel (vermelho na lista). Ainda não chegou à nuvem — use «Atualizar da nuvem» com internet.";
      }
    }
    if (btn) btn.disabled = false;
    await atualizarProgramaEDados(sessao, { silent: true });
    $("comp-protocolo")?.focus();
  }

  let deferredInstallPrompt = null;

  function wantsInstallFlow() {
    if (isStandaloneDisplay()) return false;
    try {
      if (new URLSearchParams(location.search).get("instalar") === "1") return true;
    } catch {
      /* ignore */
    }
    try {
      const auth = sessionStorage.getItem(INSTALL_AUTH_KEY);
      if (auth) {
        const a = JSON.parse(auth);
        if (a?.ok && Date.now() - Number(a.at || 0) < 15 * 60 * 1000) return true;
      }
    } catch {
      /* ignore */
    }
    try {
      const raw = sessionStorage.getItem(CLIENTE_APP_GATE_KEY);
      if (raw) {
        const g = JSON.parse(raw);
        if (Date.now() - Number(g.at || 0) < 15 * 60 * 1000) return true;
      }
    } catch {
      /* ignore */
    }
    return false;
  }

  function updateInstallPanelUi(message) {
    const panel = $("cliente-install-panel");
    const status = $("cliente-install-status");
    if (status && message) status.textContent = message;
    if (!panel) return;
    if (isStandaloneDisplay()) {
      panel.classList.add("hidden");
      return;
    }
    if (wantsInstallFlow() && window.__DK_clienteGeoHasConsent?.()) {
      panel.classList.remove("hidden");
    } else if (wantsInstallFlow()) {
      panel.classList.add("hidden");
    }
  }

  function wireInstall() {
    const btn = $("btn-install-cliente");
    const panel = $("cliente-install-panel");

    window.addEventListener("beforeinstallprompt", (e) => {
      e.preventDefault();
      deferredInstallPrompt = e;
      if (window.__DK_clienteGeoHasConsent?.()) {
      updateInstallPanelUi(
        "O sistema está pronto. Toque em «Instalar app DK Cliente» (pode demorar 1–2 segundos a aparecer)."
      );
      panel?.classList.remove("hidden");
      } else {
        updateInstallPanelUi("Autorize a localização acima antes de instalar o app.");
      }
    });

    window.addEventListener("appinstalled", () => {
      deferredInstallPrompt = null;
      try {
        localStorage.setItem("dk_cliente_pwa_installed", "1");
        localStorage.removeItem(GATE_PERSIST_KEY);
        sessionStorage.removeItem(CLIENTE_APP_GATE_KEY);
        sessionStorage.removeItem(INSTALL_AUTH_KEY);
      } catch {
        /* ignore */
      }
      resetLoginForm();
      updateInstallPanelUi("App instalado com sucesso. Abra pelo ícone DK e entre com CPF e senha.");
      panel?.classList.add("hidden");
      const fb = $("login-feedback");
      if (fb) fb.textContent = "App instalado. Entre com CPF e senha.";
    });

    btn?.addEventListener("click", async () => {
      const geoOk = await requireGeoForInstall();
      if (!geoOk) {
        panel?.classList.add("hidden");
        return;
      }
      if (deferredInstallPrompt) {
        try {
          deferredInstallPrompt.prompt();
          const choice = await deferredInstallPrompt.userChoice;
          deferredInstallPrompt = null;
          if (choice?.outcome === "accepted") {
            updateInstallPanelUi("Instalação em curso…");
            return;
          }
          updateInstallPanelUi(
            "Instalação cancelada. Use as instruções manuais abaixo ou o menu do browser."
          );
        } catch {
          updateInstallPanelUi("Use o menu do browser: Instalar app / Adicionar ao ecrã inicial.");
        }
        return;
      }
      const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent || "");
      const msg = isIos
        ? "iPhone: no Safari, toque em partilhar (↑) → «Adicionar à Tela de Início»."
        : "Android: no Chrome, menu (⋮) → «Instalar app» ou «Adicionar ao ecrã inicial».";
      updateInstallPanelUi(msg);
      panel?.classList.remove("hidden");
      $("cliente-install-manual")?.setAttribute("open", "open");
    });

    if (wantsInstallFlow() && window.__DK_clienteGeoHasConsent?.()) {
      updateInstallPanelUi(
        "Aguarde o carregamento e toque em «Instalar app DK Cliente». Se não aparecer, abra as instruções manuais."
      );
      panel?.classList.remove("hidden");
    }
  }

  function hasClienteAppDownloadGate() {
    try {
      const authRaw = sessionStorage.getItem(INSTALL_AUTH_KEY);
      if (authRaw) {
        const a = JSON.parse(authRaw);
        if (a?.ok && Date.now() - Number(a.at || 0) < 15 * 60 * 1000) return true;
      }
      const raw =
        sessionStorage.getItem(CLIENTE_APP_GATE_KEY) ||
        sessionStorage.getItem("dk_cliente_app_gate_v1");
      if (!raw) return false;
      const g = JSON.parse(raw);
      const cpf = onlyDigits(String(g?.cpf || "")).slice(0, 11);
      const proto = String(g?.proto || "").trim();
      return cpf.length === 11 && Boolean(proto);
    } catch {
      return false;
    }
  }

  async function maybeRegistrarBoasVindasCliente(sess) {
    if (!isClienteRealSession(sess)) return null;
    const fn =
      typeof window.__DK_clienteNotificacaoBoasVindasComNuvem === "function"
        ? window.__DK_clienteNotificacaoBoasVindasComNuvem
        : typeof window.__DK_clienteNotificacaoBoasVindas === "function"
          ? window.__DK_clienteNotificacaoBoasVindas
          : null;
    if (!fn) return null;
    let protocolo = "";
    try {
      const raw = sessionStorage.getItem(CLIENTE_APP_GATE_KEY) || localStorage.getItem(GATE_PERSIST_KEY);
      if (raw) {
        const g = JSON.parse(raw);
        protocolo = normNc(g?.proto || "");
      }
    } catch {
      /* ignore */
    }
    if (!protocolo) {
      const locs = filterLocacoesAtivas(
        loadCadastro(CAD_LOCACOES_KEY).filter((l) => onlyDigits(l.cpf) === sess.cpf)
      );
      const loc = locs[0] || loadCadastro(CAD_LOCACOES_KEY).find((l) => onlyDigits(l.cpf) === sess.cpf);
      protocolo = normNc(loc?.numeroContrato || "");
    }
    if (!protocolo) return null;
    return fn({ cpf: sess.cpf, nome: sess.nome, protocolo });
  }

  async function afterLogin(sess) {
    persistGateFromSession();
    if (typeof window.__DK_trimClienteLocacoesLocal === "function") {
      window.__DK_trimClienteLocacoesLocal();
    }
    if (isClienteRealSession(sess)) {
      startGeoForSession(sess);
      void window.__DK_clienteEnsurePushSubscription?.(sess.cpf);
    } else {
      markAdminPreviewActive();
    }
    if (isStandaloneDisplay()) {
      try {
        localStorage.setItem("dk_cliente_pwa_installed", "1");
      } catch {
        /* ignore */
      }
    }
    if (!comprovanteFile) {
      await processIncomingShare();
    }
    await atualizarProgramaEDados(sess, { silent: false });
    const boasVindas = await maybeRegistrarBoasVindasCliente(sess);
    if (boasVindas?.ok && !boasVindas.already) {
      renderApp(sess, { force: true });
      if (typeof window.__DK_clienteScrollToAvisos === "function") {
        window.setTimeout(() => window.__DK_clienteScrollToAvisos(), 500);
      }
    }
    if (comprovanteFile) {
      showView("app");
      renderApp(sess);
      attachFileToComprovanteInput(comprovanteFile);
      preselectProtocoloComprovante();
      const msg = $("comp-msg");
      if (msg) {
        msg.textContent =
          "Comprovante anexado — informe data e valor e toque em Enviar comprovante.";
      }
        focusComprovanteSection();
    }
  }

  function wireComprovanteLinkDelegation() {
    document.addEventListener(
      "click",
      (e) => {
        const a = e.target.closest?.(".lnk-comprovante[data-dk-comprovante-id]");
        if (!a) return;
        e.preventDefault();
        const id = a.getAttribute("data-dk-comprovante-id");
        if (id && typeof window.__DK_openComprovanteClienteViewerById === "function") {
          window.__DK_openComprovanteClienteViewerById(id);
        }
      },
      true
    );
  }

  async function init() {
    fecharModalRelatorio();
    markClientePwaInstalledIfStandalone();
    applyClienteComprovanteUiVisibility();
    restoreGateToSession();
    persistGateFromSession();
    wireLaunchQueueShare();
    wireComprovanteLinkDelegation();

    const adminPreviewLogin = canAdminPreviewAutoLogin();
    if (isAdminPreviewMode()) {
      markAdminPreviewActive();
      showAdminPreviewBanner();
      try {
        sessionStorage.setItem("dk_admin_preview_cliente", "1");
      } catch {
        /* ignore */
      }
    }

    if (!isGeoGateBypassed()) {
      const geoOk = await maybeRunInstallGeoGate();
      if (!geoOk) return;
    }

    if (!document.documentElement.dataset.dkClientePagBound) {
      document.documentElement.dataset.dkClientePagBound = "1";
      document.addEventListener("click", onClientePagamentosClick);
    }
    if (!document.documentElement.dataset.dkClienteEscBound) {
      document.documentElement.dataset.dkClienteEscBound = "1";
      document.addEventListener("keydown", (e) => {
        if (e.key !== "Escape") return;
        fecharModalRelatorio();
      });
    }
    if (!document.documentElement.dataset.dkClienteSyncBound) {
      document.documentElement.dataset.dkClienteSyncBound = "1";
      const refreshClienteApp = () => {
        const sessao = getSessao();
        if (sessao?.cpf) scheduleClienteRender(sessao);
      };
      window.addEventListener("dk-comprovantes-synced", refreshClienteApp);
      window.addEventListener("dk-comprovantes-sync-nuvem", refreshClienteApp);
      let visSyncTimer = 0;
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState !== "visible") return;
        if (isGeoGateBypassed()) return;
        const sessao = getSessao();
        if (!sessao?.cpf) return;
        const meta = metaGeoFromSessao(sessao);
        if (typeof window.__DK_clienteGeoRefreshOnVisible === "function") {
          void window.__DK_clienteGeoRefreshOnVisible(meta).then((r) => {
            if (r && r.ok === false && r.state === "denied" && window.__DK_clienteGeoHasConsent?.()) {
              showGeoBlocked("Localização revogada. Reative para continuar.");
            }
          });
        }
        if (visSyncTimer) window.clearTimeout(visSyncTimer);
        visSyncTimer = window.setTimeout(() => {
          visSyncTimer = 0;
          void sincronizarDadosCliente(sessao, { silent: true });
        }, 2500);
      });
    }
    void registerClienteServiceWorker();

    $("form-login")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const cpf = onlyDigits($("login-cpf")?.value).slice(0, 11);
      const proto = normProtoGate($("login-protocolo")?.value || "");
      const senha = String($("login-senha")?.value || "").trim();
      const fb = $("login-feedback");
      const submitBtn = $("form-login")?.querySelector('button[type="submit"]');
      if (cpf.length !== 11) {
        if (fb) fb.textContent = "Informe um CPF válido.";
        return;
      }
      if (!proto) {
        if (fb) fb.textContent = "Informe o protocolo da locação (ex.: 2026010102).";
        return;
      }
      if (!setClienteGate(cpf, proto)) {
        if (fb) fb.textContent = "Protocolo inválido.";
        return;
      }
      if (fb) fb.textContent = "A verificar cadastro na nuvem…";
      if (submitBtn) submitBtn.disabled = true;
      try {
        if (typeof window.__DK_upsertClienteCadastroFromCloud === "function") {
          await window.__DK_upsertClienteCadastroFromCloud(cpf, proto);
        }
      } catch {
        /* usa cadastro local se a nuvem falhar */
      } finally {
        if (submitBtn) submitBtn.disabled = false;
      }
      const hit = findClienteLogin(cpf, senha);
      if (!hit) {
        if (fb) fb.textContent = "CPF ou senha inválidos.";
        return;
      }
      const sess = { cpf, nome: hit.nome, loginEm: new Date().toISOString(), protocolo: proto };
      if (!isGeoGateBypassed() && clienteSenhaEhInicial(senha)) {
        clienteTrocaSenhaPendente = { cpf, nome: hit.nome, proto };
        const n1 = $("cliente-nova-senha");
        const n2 = $("cliente-nova-senha-2");
        if (n1) n1.value = "";
        if (n2) n2.value = "";
        const trocaFb = $("cliente-troca-senha-feedback");
        if (trocaFb) trocaFb.textContent = "";
        showView("trocar-senha");
        if (fb) fb.textContent = "";
        return;
      }
      void finalizarLoginCliente(sess, fb);
    });

    $("form-trocar-senha")?.addEventListener("submit", (e) => {
      e.preventDefault();
      const fb = $("cliente-troca-senha-feedback");
      const pend = clienteTrocaSenhaPendente;
      if (!pend?.cpf) {
        if (fb) fb.textContent = "Sessão expirada. Entre novamente com CPF e senha.";
        showView("login");
        return;
      }
      const nova = String($("cliente-nova-senha")?.value || "").trim();
      const conf = String($("cliente-nova-senha-2")?.value || "").trim();
      if (!isClienteSenhaNovaValida(nova)) {
        if (fb) {
          fb.textContent = "Use exatamente 6 números, diferentes da senha inicial 123456.";
        }
        return;
      }
      if (nova !== conf) {
        if (fb) fb.textContent = "A confirmação não coincide com a nova senha.";
        return;
      }
      if (!updateClienteSenhaNoCadastro(pend.cpf, nova)) {
        if (fb) fb.textContent = "Não foi possível guardar a nova senha. Tente novamente.";
        return;
      }
      if (pend.proto) setClienteGate(pend.cpf, pend.proto);
      clienteTrocaSenhaPendente = null;
      const sess = {
        cpf: pend.cpf,
        nome: pend.nome,
        loginEm: new Date().toISOString(),
        protocolo: pend.proto || getGateProto(),
      };
      if (fb) fb.textContent = "Senha atualizada. A entrar…";
      void finalizarLoginCliente(sess, fb);
    });

    const doLogout = () => {
      if (typeof window.__DK_clienteGeoStopTracking === "function") {
        window.__DK_clienteGeoStopTracking();
      }
      limparCacheClienteAoSair();
      clienteTrocaSenhaPendente = null;
      resetLoginForm();
      showView("login");
    };
    $("btn-logout")?.addEventListener("click", doLogout);
    $("btn-logout-prop")?.addEventListener("click", doLogout);
    wirePullToRefresh();
    $("btn-sync-prop")?.addEventListener("click", async () => {
      const sessao = getSessao();
      const msg = $("sync-msg-prop");
      if (msg) msg.textContent = "A atualizar…";
      await atualizarProgramaEDados(sessao, { silent: true });
      if (msg) msg.textContent = "Dados atualizados.";
      if (sessao) resolveAppViewAfterData(sessao);
    });
    $("btn-notif-lidas")?.addEventListener("click", () => {
      const sessao = getSessao();
      if (!sessao) return;
      if (typeof window.__DK_clienteNotificacoesMarcarLidas === "function") {
        window.__DK_clienteNotificacoesMarcarLidas(sessao.cpf);
      }
      if (typeof window.__DK_markLocalDataAuthority === "function") {
        window.__DK_markLocalDataAuthority(5 * 60 * 1000);
      }
      renderNotificacoes(sessao.cpf);
    });
    $("btn-notif-ver-lidas")?.addEventListener("click", () => {
      const sessao = getSessao();
      if (!sessao) return;
      renderAvisosLidosModal(sessao.cpf);
    });
    $("btn-avisos-lidos-fechar")?.addEventListener("click", () => fecharAvisosLidosModal());
    $("cliente-modal-avisos-lidos")?.addEventListener("click", (e) => {
      if (e.target?.id === "cliente-modal-avisos-lidos") fecharAvisosLidosModal();
    });
    $("comp-arquivo")?.addEventListener("change", onComprovanteFileChange);
    $("btn-enviar-comprovante")?.addEventListener("click", () => enviarComprovanteParaNuvem());
    $("btn-relatorio-pagamentos")?.addEventListener("click", () => openRelatorioPagamentos());
    $("btn-relatorio-fechar")?.addEventListener("click", () => fecharModalRelatorio());
    $("btn-relatorio-compartilhar")?.addEventListener("click", () => compartilharRelatorioPagamentos());

    const cpfIn = $("login-cpf");
    const protoIn = $("login-protocolo");
    cpfIn?.addEventListener("input", () => {
      const d = onlyDigits(cpfIn.value).slice(0, 11);
      cpfIn.value = formatCpf(d);
    });
    protoIn?.addEventListener("input", () => {
      protoIn.value = onlyDigits(protoIn.value).slice(0, 20);
    });
    updateLoginProtocoloUi();

    if (!getSessao()?.cpf) {
      const installFlow = isInstallQueryFlow() || Boolean(sessionStorage.getItem(INSTALL_AUTH_KEY));
      if (!installFlow) {
        const gateRaw = sessionStorage.getItem(CLIENTE_APP_GATE_KEY) || localStorage.getItem(GATE_PERSIST_KEY);
        try {
          const g = gateRaw ? sanitizeGatePayload(JSON.parse(gateRaw)) : null;
          const gateCpf = onlyDigits(g?.cpf || "").slice(0, 11);
          const gateProto = normProtoGate(g?.proto || "");
          if (gateCpf && cpfIn && !cpfIn.value) cpfIn.value = formatCpf(gateCpf);
          if (gateProto && protoIn && !protoIn.value) protoIn.value = gateProto;
        } catch {
          /* ignore */
        }
      } else {
        /* Download/instalação: formulário vazio — utilizador digita CPF e senha depois. */
        resetLoginForm();
        const cpfEl = $("login-cpf");
        const senhaEl = $("login-senha");
        const protoEl = $("login-protocolo");
        if (cpfEl) cpfEl.setAttribute("autocomplete", "off");
        if (senhaEl) senhaEl.setAttribute("autocomplete", "off");
        if (protoEl) protoEl.setAttribute("autocomplete", "off");
      }
    }

    await processIncomingShare();

    if (adminPreviewLogin && (await autoLoginAdminPreviewFromGate())) {
      wireInstall();
      if (clienteEnvioComprovanteAtivo()) bindCompMasks();
      updateInstallPanelUi();
      window.addEventListener("dk-comprovantes-synced", onComprovantesSyncedRefreshView);
      return;
    }

    const sessao = getSessao();
    if (sessao?.cpf) {
      if (!isGeoGateBypassed()) startGeoForSession(sessao);
      resolveAppViewAfterData(sessao);
      void afterLogin(sessao).catch(() => resolveAppViewAfterData(sessao));
    } else {
      showView("login");
    }

    wireInstall();
    if (clienteEnvioComprovanteAtivo()) bindCompMasks();
    updateInstallPanelUi();
    window.addEventListener("dk-comprovantes-synced", onComprovantesSyncedRefreshView);
  }

  window.__DK_getClienteSessaoCpf = function getClienteSessaoCpf() {
    return onlyDigits(getSessao()?.cpf).slice(0, 11);
  };

  window.__DK_clienteAppRecarregar = async function clienteAppRecarregar() {
    if (typeof window.__DK_comprovantesClienteInvalidateCache === "function") {
      window.__DK_comprovantesClienteInvalidateCache();
    }
    const sessao = getSessao();
    if (sessao?.cpf) {
      await sincronizarDadosCliente(sessao, { silent: true });
      resolveAppViewAfterData(sessao);
    } else {
      showView("login");
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      init().catch(() => {});
    });
  } else {
    init().catch(() => {});
  }
})();
