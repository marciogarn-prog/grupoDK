/**
 * Portal Grupo DK — liga a UI de grupodkempreendimentos/index.html ao motor de app.js
 * (sessão, findCliente, funcionariosAccess, localStorage dos cadastros).
 * Sem este ficheiro, os botões da página não fazem nada.
 */
(function portalLocadoraUi() {
  const viewHome = document.getElementById("view-home");
  const viewUnit = document.getElementById("view-unit");
  const viewLocadoraHub = document.getElementById("view-locadora-hub");
  const viewLocadoraCliente = document.getElementById("view-locadora-cliente");
  const viewMiel = document.getElementById("view-miel");
  if (!viewHome || !viewUnit) return;

  /** Único CPF com acesso «Administrador» no portal DK Locadora. */
  const DK_LOCADORA_ADMIN_CPF = "03037897430";
  const CLIENTE_APP_GATE_KEY = "dk_cliente_app_gate";
  const PORTAL_SESSAO_BUILD_KEY = "dk_portal_sessao_build";
  const PORTAL_SESSAO_BUILD_ID = "20260521admin-nav";
  const PORTAL_AREA_ATIVA_KEY = "dk_portal_area_ativa";

  function isPortalAdministradorLogado() {
    try {
      const raw = localStorage.getItem("dk_sessao_cliente");
      if (!raw) return false;
      const s = JSON.parse(raw);
      if (s?.tipo !== "admin" || String(s.role || "") !== "owner") return false;
      return localStorage.getItem(PORTAL_SESSAO_BUILD_KEY) === PORTAL_SESSAO_BUILD_ID;
    } catch {
      return false;
    }
  }

  function portalMarcarSessaoAdminBuild() {
    try {
      localStorage.setItem(PORTAL_SESSAO_BUILD_KEY, PORTAL_SESSAO_BUILD_ID);
    } catch {
      /* ignore */
    }
  }

  function portalInvalidarSessaoSeBuildAntigo() {
    try {
      const raw = localStorage.getItem("dk_sessao_cliente");
      if (!raw) return;
      const s = JSON.parse(raw);
      if (s?.tipo !== "admin") return;
      if (localStorage.getItem(PORTAL_SESSAO_BUILD_KEY) !== PORTAL_SESSAO_BUILD_ID) {
        if (typeof clearSession === "function") clearSession();
        localStorage.removeItem(PORTAL_SESSAO_BUILD_KEY);
      }
    } catch {
      /* ignore */
    }
  }

  function portalResetSessaoSeNaoAdmin() {
    if (isPortalAdministradorLogado()) return;
    if (typeof clearSession === "function") clearSession();
  }

  function portalSyncAdminBannerLayout() {
    const banner = document.getElementById("portal-admin-banner");
    const h =
      banner && !banner.classList.contains("hidden") ? `${banner.offsetHeight}px` : "0px";
    try {
      document.documentElement.style.setProperty("--portal-admin-banner-h", h);
    } catch {
      /* ignore */
    }
    if (typeof window.__DK_syncDemoBannerLayout === "function") {
      window.__DK_syncDemoBannerLayout();
    }
    portalSyncComunicacaoBarLayout();
  }

  function portalSyncComunicacaoBarLayout() {
    try {
      document.documentElement.style.setProperty("--portal-comunicacao-bar-h", "0px");
    } catch {
      /* ignore */
    }
  }

  window.__DK_portalSyncComunicacaoBarLayout = portalSyncComunicacaoBarLayout;

  function portalAtualizarBannerAdmin() {
    const banner = document.getElementById("portal-admin-banner");
    if (!banner) return;
    const on = isPortalAdministradorLogado();
    banner.classList.toggle("hidden", !on);
    document.body.classList.toggle("portal-body--admin-logado", on);
    const btnPreview = document.getElementById("btn-locadora-preview-cliente");
    if (btnPreview) btnPreview.classList.toggle("hidden", !on);
    portalSyncAmbienteCadastroAdminUi();
    refreshPortalMielHomeAcesso();
    requestAnimationFrame(() => portalSyncAdminBannerLayout());
  }

  if (!window.__dkPortalAdminBannerLayoutBound) {
    window.__dkPortalAdminBannerLayoutBound = true;
    window.addEventListener("resize", () => portalSyncAdminBannerLayout());
  }

  function portalColetarClientesParaAdminPreview(prefixDigits) {
    const dig =
      typeof onlyDigits === "function" ? onlyDigits : (s) => String(s ?? "").replace(/\D/g, "");
    const prefix = dig(String(prefixDigits || "")).slice(0, 11);
    const byCpf = new Map();
    const addRow = (cpfRaw, nomeRaw) => {
      const cpf = dig(String(cpfRaw || "")).slice(0, 11);
      if (cpf.length !== 11) return;
      if (prefix.length && !cpf.startsWith(prefix)) return;
      const nome = String(nomeRaw || "").trim();
      const prev = byCpf.get(cpf);
      if (!prev || (nome && !prev.nome)) byCpf.set(cpf, { cpf, nome: nome || prev?.nome || "" });
    };
    if (typeof loadCadastro === "function" && typeof CAD_CLIENTES_KEY !== "undefined") {
      loadCadastro(CAD_CLIENTES_KEY).forEach((c) => addRow(c.cpf, c.nome));
    }
    if (typeof loadCadastro === "function" && typeof CAD_LOCACOES_KEY !== "undefined") {
      loadCadastro(CAD_LOCACOES_KEY).forEach((l) => {
        addRow(l.cpf, l.nome || l.cliente);
      });
    }
    if (typeof findClienteByCpfCadastro === "function") {
      byCpf.forEach((row, cpf) => {
        if (row.nome) return;
        const c = findClienteByCpfCadastro(cpf);
        if (c?.nome) row.nome = String(c.nome).trim();
      });
    }
    return Array.from(byCpf.values()).sort((a, b) => {
      const an = String(a.nome || "").trim();
      const bn = String(b.nome || "").trim();
      if (an && !bn) return -1;
      if (!an && bn) return 1;
      return an.localeCompare(bn, "pt-BR") || a.cpf.localeCompare(b.cpf);
    });
  }

  function refreshPortalAdminClienteCpfDatalist() {
    const dl = document.getElementById("portal-admin-cliente-cpf-sugestoes");
    const inp = document.getElementById("portal-admin-cliente-cpf");
    if (!dl) return;
    const fmt = typeof formatCpf === "function" ? formatCpf : (d) => d;
    const rows = portalColetarClientesParaAdminPreview(inp?.value || "");
    dl.innerHTML = rows
      .slice(0, 120)
      .map((row) => {
        const lbl = row.nome ? `${row.nome}` : "Cliente cadastrado";
        return `<option value="${portalEscapeHtml(fmt(row.cpf))}" label="${portalEscapeHtml(lbl)}"></option>`;
      })
      .join("");
  }

  function refreshPortalAdminClienteProtocoloSelect() {
    const sel = document.getElementById("portal-admin-cliente-protocolo");
    const inp = document.getElementById("portal-admin-cliente-cpf");
    if (!sel || typeof loadCadastro !== "function" || typeof CAD_LOCACOES_KEY === "undefined") return;
    const dig =
      typeof onlyDigits === "function" ? onlyDigits : (s) => String(s ?? "").replace(/\D/g, "");
    const cpf = dig(String(inp?.value || "")).slice(0, 11);
    if (cpf.length !== 11) {
      sel.innerHTML = '<option value="">— informe o CPF —</option>';
      return;
    }
    const locs = loadCadastro(CAD_LOCACOES_KEY).filter((l) => dig(String(l.cpf || "")) === cpf);
    const protos = locs
      .map((l) => ({
        proto: normPortalNumeroContrato(l.numeroContrato),
        placa: String(l.placa || "").trim(),
        ativo: typeof isPortalLocacaoAtiva === "function" ? isPortalLocacaoAtiva(l) : !String(l.dataFim || "").trim(),
      }))
      .filter((x) => x.proto);
    protos.sort((a, b) => {
      if (a.ativo !== b.ativo) return a.ativo ? -1 : 1;
      return a.proto.localeCompare(b.proto);
    });
    if (!protos.length) {
      sel.innerHTML = '<option value="">— nenhum protocolo para este CPF —</option>';
      return;
    }
    sel.innerHTML =
      `<option value="">— escolha —</option>` +
      protos
        .map((p) => {
          const lbl = `${p.proto}${p.placa ? ` · ${p.placa}` : ""}${p.ativo ? " · ativo" : ""}`;
          return `<option value="${portalEscapeHtml(p.proto)}">${portalEscapeHtml(lbl)}</option>`;
        })
        .join("");
    if (protos.length === 1) sel.value = protos[0].proto;
  }

  function portalRenderAdminClientePreviewUi() {
    const adminPanel = document.getElementById("portal-admin-cliente-preview");
    const propaganda = document.getElementById("locadora-cliente-propaganda-section");
    const appSection = document.getElementById("locadora-cliente-app-section");
    const adminOn = isPortalAdministradorLogado();
    if (adminPanel) {
      adminPanel.classList.toggle("hidden", !adminOn);
      if (adminOn) adminPanel.removeAttribute("hidden");
      else adminPanel.setAttribute("hidden", "");
    }
    if (propaganda) propaganda.classList.toggle("hidden", adminOn);
    if (appSection) appSection.classList.toggle("hidden", adminOn);
    if (adminOn) {
      refreshPortalAdminClienteCpfDatalist();
      refreshPortalAdminClienteProtocoloSelect();
    }
  }

  function portalAdminAbrirAppCliente() {
    const fb = document.getElementById("portal-admin-cliente-feedback");
    const dig =
      typeof onlyDigits === "function" ? onlyDigits : (s) => String(s ?? "").replace(/\D/g, "");
    const cpf = dig(String(document.getElementById("portal-admin-cliente-cpf")?.value || "")).slice(0, 11);
    const proto = normPortalNumeroContrato(
      String(document.getElementById("portal-admin-cliente-protocolo")?.value || "").trim()
    );
    if (cpf.length !== 11) {
      if (fb) fb.textContent = "Informe um CPF válido (11 dígitos).";
      return;
    }
    if (!proto) {
      if (fb) fb.textContent = "Escolha o protocolo da locação.";
      return;
    }
    const v = validateClienteProtocoloParaApp(cpf, proto);
    if (!v.ok) {
      if (fb) fb.textContent = v.msg || "CPF ou protocolo inválido.";
      return;
    }
    if (fb) fb.textContent = "";
    const gatePayload = JSON.stringify({
      cpf,
      proto: v.proto,
      nome: String(v.cliente?.nome || "").trim(),
      at: Date.now(),
    });
    sessionStorage.setItem(CLIENTE_APP_GATE_KEY, gatePayload);
    try {
      localStorage.setItem("dk_cliente_gate_persist", gatePayload);
    } catch {
      /* ignore */
    }
    try {
      sessionStorage.setItem("dk_admin_preview_cliente", "1");
    } catch {
      /* ignore */
    }
    const url = `/cliente?cpf=${encodeURIComponent(cpf)}&proto=${encodeURIComponent(v.proto)}&adminPreview=1`;
    window.location.assign(url);
  }

  function portalAdminNav(dest) {
    if (dest === "sair") {
      btnSair?.click();
      return;
    }
    if (dest === "home") {
      showView("home");
      setPortalHash("");
      portalAtualizarBannerAdmin();
      return;
    }
    if (dest === "hub") {
      openLocadoraHub();
      return;
    }
    if (dest === "empresa") {
      openLocadoraEmpresa();
      return;
    }
    if (dest === "cliente") {
      openLocadoraClienteArea();
    }
  }

  /** `true` = mostrar e usar «Falar com o cliente» (WhatsApp). `false` = botão oculto e clique sem efeito. */
  const DK_PORTAL_WA_CLIENTE_ATIVO = false;

  const PLACA_MERCOSUL_RE = /^[A-Z]{3}[0-9][A-Z][0-9]{2}$/;
  const MSG_PLACA_MERCOSUL =
    "Placa inválida. Use o padrão Mercosul LLLNLNN (ex.: ABC1D23). Formato antigo LLLNNNN também é aceite (converte automaticamente).";

  function portalSanitizePlacaInput(raw) {
    return String(raw || "")
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 7);
  }

  function portalPlacaMercosulOk(plateNorm) {
    const p = portalSanitizePlacaInput(plateNorm);
    return PLACA_MERCOSUL_RE.test(p);
  }

  function portalConvertPlacaAntigaParaMercosul(value) {
    const x = portalSanitizePlacaInput(value);
    if (!/^[A-Z]{3}[0-9]{4}$/.test(x)) return "";
    const letter = "ABCDEFGHIJ"[parseInt(x[4], 10)];
    if (!letter) return "";
    const converted = x.slice(0, 4) + letter + x.slice(5);
    return portalPlacaMercosulOk(converted) ? converted : "";
  }

  /** Mercosul directo, conversão LLLNNNN ou OCR — nunca altera placa Mercosul válida. */
  function portalResolvePlacaCadastro(raw) {
    const digitado = portalSanitizePlacaInput(raw);
    if (!digitado) return "";
    if (portalPlacaMercosulOk(digitado)) return digitado;
    const antiga = portalConvertPlacaAntigaParaMercosul(digitado);
    if (antiga) return antiga;
    if (typeof window.corrigirPlacaMercosul === "function") {
      const ocr = portalSanitizePlacaInput(window.corrigirPlacaMercosul(raw));
      if (ocr && portalPlacaMercosulOk(ocr)) return ocr;
    }
    if (typeof window.normalizePlacaParaCadastro === "function") {
      const norm = portalSanitizePlacaInput(window.normalizePlacaParaCadastro(raw));
      if (portalPlacaMercosulOk(norm)) return norm;
    }
    return digitado;
  }

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
  const panelDocumentos = document.getElementById("panel-documentos-locadora");
  const panelLocalizacao = document.getElementById("panel-localizacao-locadora");
  const formLogin = document.getElementById("form-login");
  const loginFeedback = document.getElementById("login-feedback");
  const logadoTitulo = document.getElementById("logado-titulo");
  const logadoTexto = document.getElementById("logado-texto");
  const btnOperacao = document.getElementById("btn-locadora-operacao");
  const btnManutencao = document.getElementById("btn-locadora-manutencao");
  const btnDocumentos = document.getElementById("btn-locadora-documentos");
  const btnLocalizacao = document.getElementById("btn-locadora-localizacao");
  const btnSair = document.getElementById("btn-sair");
  const portalUnitBackBtn = document.getElementById("portal-unit-back-btn");
  const logadoSubtextPreparacao = document.getElementById("logado-subtext-preparacao");
  const formLocadoraAppDownload = document.getElementById("form-locadora-app-download");
  const locadoraAppFeedback = document.getElementById("locadora-app-feedback");
  const btnVoltarOp = document.getElementById("btn-voltar-operacao-locadora");
  const btnVoltarManutencao = document.getElementById("btn-voltar-manutencao-locadora");
  const btnVoltarDocumentos = document.getElementById("btn-voltar-documentos-locadora");
  const btnVoltarLocalizacao = document.getElementById("btn-voltar-localizacao-locadora");
  const formNovaSenha = document.getElementById("form-nova-senha");
  const formPortalCadastroColaborador = document.getElementById("formPortalCadastroColaborador");

  let currentUnit = "";
  /** Referência ao funcionário em `funcionariosAccess` à espera de troca de senha (1.º acesso colaborador). */
  let portalColaboradorSenhaPendente = null;
  /** Comprimento anterior do CPF (só dígitos) para limpar campos ao sair de 11 dígitos. */
  let portalColabCpfPrevLen = 0;
  let portalColabListaCpfAtivo = "";
  /** CPF original ao abrir colaborador existente — permite corrigir o CPF e gravar. */
  let portalColabCpfEdicaoOriginal = "";

  const PORTAL_COLAB_ACESSO_ITENS = [
    { key: "cliente", label: "Cadastro de cliente" },
    { key: "veiculo", label: "Cadastro de veículo" },
    { key: "locacao", label: "Cadastro de locação" },
    { key: "lancamentoAluguel", label: "Lançamento de aluguel" },
    { key: "lancamentoMultas", label: "Lançamento de multas" },
    { key: "lancamentoManutencao", label: "Lançamento de manutenção" },
    { key: "sistemaMiel", label: "Acesso ao sistema MIEL" },
  ];

  const PORTAL_COLAB_ACE_IDS = {
    cliente: "portalColabAceCliente",
    veiculo: "portalColabAceVeiculo",
    locacao: "portalColabAceLocacao",
    lancamentoAluguel: "portalColabAceLancAluguel",
    lancamentoMultas: "portalColabAceLancMultas",
    lancamentoManutencao: "portalColabAceLancManutencao",
    sistemaMiel: "portalColabAceSistemaMiel",
  };

  function readPortalColabAcessosFromForm() {
    return {
      cliente: Boolean(document.getElementById(PORTAL_COLAB_ACE_IDS.cliente)?.checked),
      veiculo: Boolean(document.getElementById(PORTAL_COLAB_ACE_IDS.veiculo)?.checked),
      locacao: Boolean(document.getElementById(PORTAL_COLAB_ACE_IDS.locacao)?.checked),
      lancamentoAluguel: Boolean(document.getElementById(PORTAL_COLAB_ACE_IDS.lancamentoAluguel)?.checked),
      lancamentoMultas: Boolean(document.getElementById(PORTAL_COLAB_ACE_IDS.lancamentoMultas)?.checked),
      lancamentoManutencao: Boolean(document.getElementById(PORTAL_COLAB_ACE_IDS.lancamentoManutencao)?.checked),
      sistemaMiel: Boolean(document.getElementById(PORTAL_COLAB_ACE_IDS.sistemaMiel)?.checked),
      manutencao: false,
      lancamentoDespesa: false,
    };
  }

  function buildPortalColabAcessosNormalizados() {
    const raw = readPortalColabAcessosFromForm();
    return typeof normalizeOperacaoAccess === "function"
      ? normalizeOperacaoAccess(raw, "operacao")
      : { ...raw, funcionario: false };
  }

  function portalColabTemAlgumaOperacaoMarcada() {
    const a = readPortalColabAcessosFromForm();
    return Boolean(
      a.cliente ||
        a.veiculo ||
        a.locacao ||
        a.lancamentoAluguel ||
        a.lancamentoMultas ||
        a.lancamentoManutencao ||
        a.sistemaMiel
    );
  }

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

  /** Titular (CPF autorizado) pode digitar o Cód. manualmente — útil para cadastros retroativos. */
  function portalGetSessaoCpfDigits() {
    try {
      const raw = localStorage.getItem("dk_sessao_cliente");
      if (!raw) return "";
      const s = JSON.parse(raw);
      return String(s.cpf || "")
        .replace(/\D/g, "")
        .slice(0, 11);
    } catch {
      return "";
    }
  }

  function portalAdminPodeEditarCodigoCliente() {
    if (typeof window.__DK_adminPodeEditarCodigoCliente === "function") {
      return window.__DK_adminPodeEditarCodigoCliente();
    }
    return portalGetSessaoCpfDigits() === DK_LOCADORA_ADMIN_CPF;
  }

  function refreshOperacaoClienteCodigoEditavel() {
    if (typeof window.__DK_unlockClienteCodigoAdmin === "function") {
      window.__DK_unlockClienteCodigoAdmin();
    }
    const codigo = document.getElementById("operacaoClienteCodigo");
    if (!codigo) return;
    const podeEditar = portalAdminPodeEditarCodigoCliente();
    if (podeEditar) {
      codigo.readOnly = false;
      codigo.disabled = false;
      codigo.removeAttribute("readonly");
      codigo.placeholder = "Ex.: CLIENTE 42";
      codigo.classList.remove("portal-input-immutable");
      codigo.setAttribute("aria-readonly", "false");
    } else {
      codigo.readOnly = true;
      codigo.setAttribute("readonly", "");
      codigo.placeholder = "Automático";
      codigo.classList.add("portal-input-immutable");
      codigo.setAttribute("aria-readonly", "true");
    }
  }

  function portalResolveClienteCodigoFromForm(fallback) {
    const codigoForm = String(document.getElementById("operacaoClienteCodigo")?.value || "").trim();
    if (portalAdminPodeEditarCodigoCliente() && codigoForm) return codigoForm;
    return String(fallback || "").trim();
  }

  function isPortalDocumentosAcesso() {
    if (currentUnit !== "locadora") return false;
    if (isPortalTitularAdministrador()) return true;
    const f = getPortalSessaoEquipaFuncionario() || portalObterFuncionarioDaSessaoRestauracao();
    if (!f || String(f.role || "").trim() !== "operacao") return false;
    const acessos = getPortalOperacaoAcessosEfetivos(f);
    return Boolean(acessos?.veiculo || acessos?.locacao);
  }

  const PORTAL_AMBIENTE_REAL = "real";
  const PORTAL_AMBIENTE_TESTE = "teste";

  function portalNormAmbiente(v) {
    return String(v || "")
      .trim()
      .toLowerCase() === PORTAL_AMBIENTE_TESTE
      ? PORTAL_AMBIENTE_TESTE
      : PORTAL_AMBIENTE_REAL;
  }

  function portalRegistroEhTeste(rec) {
    return portalNormAmbiente(rec?.ambiente) === PORTAL_AMBIENTE_TESTE;
  }

  function portalGetAmbienteFormValue(_tipo) {
    return PORTAL_AMBIENTE_REAL;
  }

  function portalSetAmbienteFormValue(_tipo, _ambiente) {
    /* opção Real/Teste removida — demo.grupodk é o ambiente de testes */
  }

  function portalClienteSenhaInicial() {
    return typeof SENHA_INICIAL_OPERACAO !== "undefined" ? SENHA_INICIAL_OPERACAO : "123456";
  }

  function portalResolveClienteSenhaApp(rec, cpfDigits) {
    let local = null;
    if (cpfDigits && typeof findClienteByCpfCadastro === "function") {
      local = findClienteByCpfCadastro(cpfDigits);
    }
    const s = String((local || rec)?.senha || "").trim();
    if (s) return s;
    return portalClienteSenhaInicial();
  }

  function portalResetClienteSenhaApp(cpfDigits, rec) {
    const digits = onlyDigits(String(cpfDigits || "")).slice(0, 11);
    if (digits.length !== 11) {
      return { ok: false, message: "Informe um CPF completo para resetar a senha." };
    }
    if (!isPortalTitularAdministrador()) {
      return { ok: false, message: "Só o administrador titular pode resetar a senha do app." };
    }
    const ini = portalClienteSenhaInicial();
    const local =
      typeof findClienteByCpfCadastro === "function" ? findClienteByCpfCadastro(digits) : null;
    const base = local || rec;
    const nomeForm = String(document.getElementById("operacaoClienteNome")?.value || "").trim();
    const nome = String(base?.nome || nomeForm || "").trim();
    if (!base && !nome) {
      return {
        ok: false,
        message: "Cliente não encontrado. Preencha o CPF e o nome ou guarde o cadastro antes de resetar.",
      };
    }
    const payload = {
      ...(base && typeof base === "object" ? base : {}),
      cpf: digits,
      nome,
      senha: ini,
      origemPortal: true,
      updatedAt: Date.now(),
    };
    if (typeof upsertPortalClienteByCpf === "function") {
      upsertPortalClienteByCpf(payload, base?.status || "ATIVO");
    } else if (typeof upsertClienteCadastroByCpf === "function") {
      upsertClienteCadastroByCpf(payload, base?.status || "ATIVO");
    } else if (typeof loadCadastro === "function" && typeof saveCadastro === "function" && typeof CAD_CLIENTES_KEY !== "undefined") {
      const clientes = loadCadastro(CAD_CLIENTES_KEY);
      const idx = clientes.findIndex((c) => onlyDigits(String(c.cpf || "")) === digits);
      if (idx >= 0) clientes[idx] = { ...clientes[idx], ...payload };
      else clientes.push({ ...payload, id: Number(payload.id) || Date.now(), createdAt: Date.now() });
      saveCadastro(CAD_CLIENTES_KEY, clientes);
    } else {
      return { ok: false, message: "Não foi possível guardar a senha neste ambiente." };
    }
    if (typeof portalPushCloudSnapshotAfterPersist === "function") {
      portalPushCloudSnapshotAfterPersist();
    }
    return { ok: true, senha: ini };
  }

  function portalRefreshOperacaoClienteSenhaField(cpfDigits, rec) {
    const wrap = document.getElementById("operacaoClienteSenhaWrap");
    const inp = document.getElementById("operacaoClienteSenha");
    const label = document.getElementById("operacaoClienteSenhaLabel");
    const admin = isPortalTitularAdministrador();
    if (wrap) wrap.classList.toggle("hidden", !admin);
    if (!admin) {
      if (inp) inp.value = "";
      if (label) label.textContent = "senha=123456";
      return;
    }
    const digits = onlyDigits(String(cpfDigits || "")).slice(0, 11);
    const senha = portalResolveClienteSenhaApp(rec, digits);
    if (inp) inp.value = senha;
    if (label) label.textContent = `senha=${senha}`;
    const resetBtn = document.getElementById("operacaoClienteSenhaResetBtn");
    if (resetBtn) {
      resetBtn.disabled = digits.length !== 11;
    }
  }

  function portalSyncAmbienteCadastroAdminUi() {
    const admin = isPortalTitularAdministrador();
    document.getElementById("operacaoClienteSenhaWrap")?.classList.toggle("hidden", !admin);
    refreshOperacaoClienteCodigoEditavel();
    if (admin) {
      const cpfIn = document.getElementById("operacaoClienteCpf");
      const digits = onlyDigits(String(cpfIn?.value || "")).slice(0, 11);
      portalRefreshOperacaoClienteSenhaField(digits, null);
    } else {
      const inp = document.getElementById("operacaoClienteSenha");
      const label = document.getElementById("operacaoClienteSenhaLabel");
      if (inp) inp.value = "";
      if (label) label.textContent = "senha=123456";
    }
  }

  function portalApplyAmbienteVisualForm(tipo, _recordOrAmbiente) {
    const form = document.getElementById(`formOperacao${tipo}Inline`);
    if (!form) return;
    form.classList.remove("portal-registro-teste");
  }

  function portalResetAmbienteForm(tipo) {
    portalSetAmbienteFormValue(tipo, PORTAL_AMBIENTE_REAL);
    portalApplyAmbienteVisualForm(tipo, PORTAL_AMBIENTE_REAL);
  }

  function portalApagarLocacoesTestePorCpf(cpfDigits) {
    if (typeof loadCadastro !== "function" || typeof saveCadastro !== "function" || typeof CAD_LOCACOES_KEY === "undefined") {
      return 0;
    }
    const dig =
      typeof onlyDigits === "function" ? onlyDigits : (s) => String(s ?? "").replace(/\D/g, "");
    const cpf = dig(String(cpfDigits || "")).slice(0, 11);
    if (cpf.length !== 11) return 0;
    const locs = loadCadastro(CAD_LOCACOES_KEY);
    const antes = locs.length;
    const restantes = locs.filter((l) => {
      if (dig(String(l.cpf || "")) !== cpf) return true;
      return !portalRegistroEhTeste(l);
    });
    if (restantes.length !== antes) saveCadastro(CAD_LOCACOES_KEY, restantes);
    return antes - restantes.length;
  }

  function portalApagarLocacoesTestePorPlaca(plateRaw) {
    if (typeof loadCadastro !== "function" || typeof saveCadastro !== "function" || typeof CAD_LOCACOES_KEY === "undefined") {
      return 0;
    }
    const plate =
      typeof normalizePlate === "function"
        ? normalizePlate(String(plateRaw || ""))
        : String(plateRaw || "")
            .trim()
            .toUpperCase()
            .replace(/[^A-Z0-9]/g, "");
    if (!plate) return 0;
    const locs = loadCadastro(CAD_LOCACOES_KEY);
    const antes = locs.length;
    const restantes = locs.filter((l) => {
      const pl =
        typeof normalizePlate === "function"
          ? normalizePlate(String(l.placa || ""))
          : String(l.placa || "")
              .trim()
              .toUpperCase()
              .replace(/[^A-Z0-9]/g, "");
      if (pl !== plate) return true;
      return !portalRegistroEhTeste(l);
    });
    if (restantes.length !== antes) saveCadastro(CAD_LOCACOES_KEY, restantes);
    return antes - restantes.length;
  }

  function portalApagarProtocoloTeste(ncRaw) {
    if (typeof loadCadastro !== "function" || typeof saveCadastro !== "function" || typeof CAD_LOCACOES_KEY === "undefined") {
      return false;
    }
    const nc = normPortalNumeroContrato(ncRaw);
    if (!nc) return false;
    const loc = findPortalLocacaoByProtocolo(nc);
    if (!loc || !portalRegistroEhTeste(loc)) return false;
    const locs = loadCadastro(CAD_LOCACOES_KEY).filter((l) => normPortalNumeroContrato(l.numeroContrato) !== nc);
    saveCadastro(CAD_LOCACOES_KEY, locs);
    return true;
  }

  const PORTAL_CLIENTE_DIFF_LABELS = {
    codigo: "Código",
    dataCadastro: "Data cadastro",
    cpf: "CPF",
    nome: "Nome",
    celular: "Celular",
    recado1: "Recado 1",
    recado2: "Recado 2",
    cnh: "CNH",
    categoria: "Categoria",
    vencimento: "Vencimento",
    ear: "EAR",
    cep: "CEP",
    municipioUf: "Município/UF",
    endereco: "Endereço",
    senha: "Senha app cliente",
  };

  const PORTAL_VEICULO_DIFF_LABELS = {
    tipo: "Tipo",
    tag: "Tag",
    placa: "Placa",
    codigo: "Código",
    marca: "Marca",
    modelo: "Modelo",
    valor: "Valor",
    cor: "Cor",
    chassi: "Chassi",
    anoModelo: "Ano/modelo",
    renavam: "Renavam",
    motor: "Motor",
    proprietario: "Proprietário",
    local: "Local",
  };

  const PORTAL_LOCACAO_DIFF_LABELS = {
    numeroContrato: "Protocolo",
    placa: "Placa",
    inicio: "Início",
    fim: "Fim",
    plano: "Plano",
    valorLocacao: "Valor locação",
    valorInvestimento: "Valor investimento",
    valorSemanal: "Valor semanal",
    statusLocacao: "Status",
    diaPagto: "Dia pagamento",
    periodoLocacao: "Período",
    marcaModelo: "Marca/modelo",
    modalidade: "Modalidade",
  };

  let portalAdminAlteracaoConfirmCallback = null;

  function portalNormDiffVal(v) {
    return String(v ?? "").trim();
  }

  function portalFormatCpfDiff(digits) {
    const d = onlyDigits(String(digits || "")).slice(0, 11);
    return typeof formatCpf === "function" && d.length === 11 ? formatCpf(d) : d || "—";
  }

  function portalBuildAlteracoesLista(antes, depois, labels) {
    const changes = [];
    Object.keys(labels).forEach((key) => {
      const a = portalNormDiffVal(antes?.[key]);
      const b = portalNormDiffVal(depois?.[key]);
      if (a !== b) changes.push({ label: labels[key], antes: a || "—", depois: b || "—" });
    });
    return changes;
  }

  function portalEscAlteracaoHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function portalFormatAlteracoesHtml(changes) {
    if (!changes.length) {
      return '<p class="subtext">Nenhuma alteração detectada nos campos comparados.</p>';
    }
    return `<ul class="portal-alteracao-list">${changes
      .map(
        (c) =>
          `<li><strong>${portalEscAlteracaoHtml(c.label)}:</strong> ${portalEscAlteracaoHtml(c.antes)} → ${portalEscAlteracaoHtml(c.depois)}</li>`
      )
      .join("")}</ul>`;
  }

  function openPortalAdminAlteracaoConfirmModal(titulo, htmlCorpo, onConfirm) {
    const modal = document.getElementById("portalAdminAlteracaoConfirmModal");
    const tituloEl = document.getElementById("portalAdminAlteracaoConfirmTitulo");
    const corpo = document.getElementById("portalAdminAlteracaoConfirmCorpo");
    if (!modal || !corpo) {
      if (typeof onConfirm === "function" && window.confirm(String(titulo || "Confirmar alteração?"))) onConfirm();
      return;
    }
    portalAdminAlteracaoConfirmCallback = typeof onConfirm === "function" ? onConfirm : null;
    if (tituloEl) tituloEl.textContent = String(titulo || "Confirmar alteração");
    corpo.innerHTML = htmlCorpo || "";
    modal.classList.remove("hidden");
    modal.setAttribute("aria-hidden", "false");
  }

  function closePortalAdminAlteracaoConfirmModal() {
    const modal = document.getElementById("portalAdminAlteracaoConfirmModal");
    portalAdminAlteracaoConfirmCallback = null;
    if (modal) {
      modal.classList.add("hidden");
      modal.setAttribute("aria-hidden", "true");
    }
  }

  /** Só para administrador titular: confirma quando há diferenças em registo já existente. */
  function portalConfirmarAlteracaoAdministrador(opts, onConfirm) {
    if (!isPortalTitularAdministrador()) {
      if (typeof onConfirm === "function") onConfirm();
      return;
    }
    const changes = Array.isArray(opts?.changes) ? opts.changes : [];
    if (!changes.length) {
      if (typeof onConfirm === "function") onConfirm();
      return;
    }
    openPortalAdminAlteracaoConfirmModal(
      opts.titulo || "Confirmar alteração",
      portalFormatAlteracoesHtml(changes),
      onConfirm
    );
  }

  function portalSnapshotClienteRecord(rec, cpfDigits) {
    const d = onlyDigits(String(rec?.cpf || cpfDigits || "")).slice(0, 11);
    return {
      codigo: portalNormDiffVal(rec?.codigo),
      dataCadastro: portalNormDiffVal(rec?.dataCadastro),
      cpf: portalFormatCpfDiff(d),
      nome: portalNormDiffVal(rec?.nome),
      celular: portalNormDiffVal(rec?.celular),
      recado1: portalNormDiffVal(rec?.recado1),
      recado2: portalNormDiffVal(rec?.recado2),
      cnh: portalNormDiffVal(rec?.cnh),
      categoria: portalNormDiffVal(rec?.categoria),
      vencimento: portalNormDiffVal(rec?.vencimento),
      ear: portalNormDiffVal(rec?.ear),
      cep: portalNormDiffVal(rec?.cep),
      municipioUf: portalNormDiffVal(rec?.municipioUf),
      endereco: portalNormDiffVal(rec?.endereco),
      senha: isPortalTitularAdministrador() ? portalNormDiffVal(rec?.senha) : "",
    };
  }

  function portalCollectClienteFormPayload(cpfDigits) {
    const getVal = (id) => String(document.getElementById(id)?.value || "").trim();
    const dataVal = getVal("operacaoClienteDataCadastro");
    return {
      codigo: getVal("operacaoClienteCodigo"),
      dataCadastro: dataVal,
      cpf: portalFormatCpfDiff(cpfDigits),
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
      senha: isPortalTitularAdministrador() ? getVal("operacaoClienteSenha") : "",
    };
  }

  const LOCADORA_LEAD_SEM_SESSAO =
    "Área da empresa: escolha Colaborador ou Administrador e informe CPF e senha. Colaborador: senha inicial 123456 (troque no 1.º acesso, se aplicável).";

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
    if (!f) return null;
    const mielAdmin =
      onlyDigits(String(f.cpf || "")).slice(0, 11) === DK_LOCADORA_ADMIN_CPF;
    if (String(f.role || "").trim() === "owner") {
      return typeof buildFullOperacaoAccess === "function"
        ? {
            ...buildFullOperacaoAccess(),
            locacao: true,
            manutencao: true,
            lancamentoAluguel: true,
            lancamentoMultas: true,
            lancamentoManutencao: true,
            comunicacaoVendas: true,
            comunicacaoManutencao: true,
            funcionario: true,
            sistemaMiel: mielAdmin,
          }
        : {
            cliente: true,
            veiculo: true,
            locacao: true,
            manutencao: true,
            lancamentoAluguel: true,
            lancamentoMultas: true,
            lancamentoManutencao: true,
            comunicacaoVendas: true,
            comunicacaoManutencao: true,
            lancamentoDespesa: true,
            funcionario: true,
            sistemaMiel: mielAdmin,
          };
    }
    if (String(f.role || "").trim() !== "operacao") return null;
    if (f.acessos && typeof f.acessos === "object") return f.acessos;
    return typeof normalizeOperacaoAccess === "function"
      ? normalizeOperacaoAccess(null, "operacao")
      : {
          cliente: true,
          veiculo: true,
          locacao: true,
          lancamentoAluguel: true,
          lancamentoMultas: true,
          lancamentoManutencao: true,
          manutencao: false,
          lancamentoDespesa: false,
          funcionario: false,
          sistemaMiel: false,
        };
  }

  function portalLerSessaoPortal() {
    try {
      const raw = localStorage.getItem("dk_sessao_cliente");
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  /** MIEL: só o administrador CPF 03037897430 ou colaborador com permissão explícita. */
  function portalPodeAcessarSistemaMiel() {
    const s = portalLerSessaoPortal();
    if (!s || s.tipo === "cliente") return false;
    if (s.tipo !== "admin") return false;
    const cpf = onlyDigits(String(s.cpf || "")).slice(0, 11);
    if (cpf === DK_LOCADORA_ADMIN_CPF) return true;
    const role = String(s.role || "").trim();
    if (role !== "operacao") return false;
    const f = getPortalSessaoEquipaFuncionario();
    if (!f || f.blocked) return false;
    const acessos = getPortalOperacaoAcessosEfetivos(f);
    return Boolean(acessos?.sistemaMiel);
  }

  function refreshPortalMielHomeAcesso() {
    const allow = portalPodeAcessarSistemaMiel();
    document.querySelectorAll('#view-home [data-go="miel"]').forEach((btn) => {
      btn.classList.toggle("hidden", !allow);
      btn.setAttribute("aria-hidden", allow ? "false" : "true");
      btn.toggleAttribute("disabled", !allow);
    });
    if (!allow && viewMiel?.classList.contains("view--active")) {
      showView("home");
      setPortalHash("");
    }
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
      ...(DK_PORTAL_WA_CLIENTE_ATIVO ? [["btn-operacao-falar-cliente", "operacaoInlineWhatsApp", "cliente"]] : []),
      ["btn-operacao-cadastro-cliente", "operacaoInlineCliente", "cliente"],
      ["btn-operacao-cadastro-veiculo", "operacaoInlineVeiculo", "veiculo"],
      ["btn-operacao-cadastro-locacao", "operacaoInlineLocacao", "locacao"],
      ["btn-operacao-lancamento-aluguel", "operacaoInlineLancamentoAluguel", "lancamentoAluguel"],
      ["btn-operacao-lancamento-multas", "operacaoInlineLancamentoMultas", "lancamentoMultas"],
      ["btn-operacao-lancamento-manutencao", "operacaoInlineLancamentoManutencao", "lancamentoManutencao"],
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

    if (!DK_PORTAL_WA_CLIENTE_ATIVO) {
      const bWa = document.getElementById("btn-operacao-falar-cliente");
      if (bWa) {
        bWa.classList.add("hidden");
        bWa.setAttribute("aria-hidden", "true");
        bWa.toggleAttribute("disabled", true);
      }
      document.getElementById("operacaoInlineWhatsApp")?.classList.add("hidden");
    }

    const btnColab = document.getElementById("btn-operacao-cadastro-colaborador");
    if (btnColab) btnColab.classList.toggle("hidden", !isPortalTitularAdministrador());

    const btnWaTodos = document.getElementById("portalWaBtnTodosAtivos");
    if (btnWaTodos) btnWaTodos.classList.toggle("hidden", !isPortalTitularAdministrador() || !DK_PORTAL_WA_CLIENTE_ATIVO);
  }

  /** Se só existir um cadastro permitido, abre-o automaticamente (painel ainda no placeholder). */
  function portalOperacaoAutoAbrirSeUnicoPermitido() {
    const ids = [
      "btn-operacao-cadastro-cliente",
      "btn-operacao-cadastro-veiculo",
      "btn-operacao-cadastro-locacao",
      "btn-operacao-lancamento-aluguel",
      "btn-operacao-lancamento-multas",
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
    /* sessão vale só nesta janela do navegador — ver dkExigirLoginEquipaPorJanela (app.js) */
    try {
      sessionStorage.setItem("dk_portal_sessao_viva_v1", "1");
    } catch {
      /* ignore */
    }
    hideAllPanels();
    panelLogado?.classList.remove("hidden");
    if (logadoTitulo) logadoTitulo.textContent = "Área da equipa";
    if (logadoTexto) {
      logadoTexto.textContent = `${funcionario.nome} · ${funcionario.role === "owner" ? "Administrador" : funcionario.role}`;
    }
    const allowOp = currentUnit === "locadora" && (funcionario.role === "operacao" || funcionario.role === "owner");
    btnOperacao?.classList.toggle("hidden", !allowOp);
    btnManutencao?.classList.toggle("hidden", !allowOp);
    btnLocalizacao?.classList.toggle("hidden", !allowOp);
    btnDocumentos?.classList.toggle("hidden", !isPortalDocumentosAcesso());
    if (logadoSubtextPreparacao) {
      logadoSubtextPreparacao.classList.toggle("hidden", currentUnit === "locadora");
    }
    clearPortalUnitDadosAtualizados();
    if (funcionario.role === "owner") portalMarcarSessaoAdminBuild();
    portalAtualizarBannerAdmin();
    refreshPortalUnitLeadForSession();
    refreshPortalOperacaoNavPorAcessos();
    refreshOperacaoLocacaoAdminProtocoloUi();
    portalSyncAmbienteCadastroAdminUi();
    refreshOperacaoClienteCodigoEditavel();
  }

  const portalViews = [viewHome, viewUnit, viewLocadoraHub, viewLocadoraCliente, viewMiel].filter(Boolean);

  function showView(which) {
    const map = {
      home: viewHome,
      unit: viewUnit,
      hub: viewLocadoraHub,
      cliente: viewLocadoraCliente,
      miel: viewMiel,
    };
    portalViews.forEach((v) => {
      v.classList.remove("view--active");
      v.setAttribute("aria-hidden", "true");
    });
    const target = map[which] || viewHome;
    target.classList.add("view--active");
    target.setAttribute("aria-hidden", "false");
  }

  function setPortalHash(fragment) {
    try {
      const path = window.location.pathname + window.location.search;
      history.replaceState(null, "", fragment ? `${path}#${fragment}` : path);
    } catch {
      /* ignore */
    }
  }

  function normProtoClienteGate(x) {
    return typeof normalizeNumeroContratoKey === "function"
      ? normalizeNumeroContratoKey(x || "")
      : String(x || "")
          .trim()
          .toUpperCase()
          .replace(/[^A-Z0-9]/g, "");
  }

  function matchClienteProtocoloEmListas(cpf, proto, clientes, locs) {
    const cliente = (clientes || []).find((c) => onlyDigits(String(c.cpf || "")) === cpf) || null;
    const hit = (locs || []).find(
      (l) =>
        onlyDigits(String(l.cpf || "")) === cpf &&
        normProtoClienteGate(l.numeroContrato) === proto
    );
    if (!hit) {
      return {
        ok: false,
        msg: "Protocolo não encontrado para este CPF. Verifique os dados ou contacte a locadora.",
      };
    }
    const nome = String(cliente?.nome || hit.nome || hit.cliente || "").trim();
    if (!nome) {
      return { ok: false, msg: "Cliente não cadastrado. Contacte a DK Locadora." };
    }
    const clienteOut = cliente ? { ...cliente, nome: nome || cliente.nome } : { cpf, nome };
    return { ok: true, cliente: clienteOut, loc: hit, proto };
  }

  function dkPortalSnapshotLabel() {
    if (typeof window.__DK_deploySnapshotLabel === "function") {
      return window.__DK_deploySnapshotLabel();
    }
    return window.__DK_IS_DEMO_DEPLOY__ === true ? "demo" : "default";
  }

  function dkPortalCloudChannelQuery() {
    return dkPortalSnapshotLabel() === "demo" ? "?channel=demo" : "";
  }

  function dkPortalCloudFetchHeaders() {
    return dkPortalSnapshotLabel() === "demo" ? { "X-DK-Deploy-Channel": "demo" } : {};
  }

  async function validateClienteProtocoloViaSupabase(cpfDigits, protoRaw) {
    const cpf = onlyDigits(String(cpfDigits || "")).slice(0, 11);
    const proto = normProtoClienteGate(protoRaw);
    if (cpf.length !== 11) return { ok: false, msg: "Informe um CPF válido (11 dígitos)." };
    if (!proto) return { ok: false, msg: "Informe o protocolo da locação." };
    const client = window.__DK_SUPABASE_CLIENT__;
    if (!client || !window.__DK_SUPABASE_CONFIGURED__) {
      return { ok: false, msg: "Nuvem DK indisponível neste momento." };
    }
    try {
      const label = dkPortalSnapshotLabel();
      const { data, error } = await client
        .from("dk_cloud_snapshots")
        .select("payload")
        .eq("label", label)
        .maybeSingle();
      if (error || !data?.payload) {
        return {
          ok: false,
          msg: "Não foi possível consultar a nuvem DK. Tente novamente.",
        };
      }
      const p = data.payload;
      return matchClienteProtocoloEmListas(
        cpf,
        proto,
        p.dk_clientes_cadastro,
        p.dk_locacoes_cadastro
      );
    } catch {
      return {
        ok: false,
        msg: "Erro ao consultar a nuvem DK. Verifique a internet.",
      };
    }
  }

  async function validateClienteProtocoloParaAppRemote(cpfDigits, protoRaw) {
    const cpf = onlyDigits(String(cpfDigits || "")).slice(0, 11);
    const proto = normProtoClienteGate(protoRaw);
    if (cpf.length !== 11) return { ok: false, msg: "Informe um CPF válido (11 dígitos)." };
    if (!proto) return { ok: false, msg: "Informe o protocolo da locação." };

    const supa = await validateClienteProtocoloViaSupabase(cpfDigits, protoRaw);
    if (supa.ok) return supa;

    try {
      const q = new URLSearchParams({
        cpf,
        protocolo: String(protoRaw || "").trim(),
      });
      if (dkPortalSnapshotLabel() === "demo") q.set("channel", "demo");
      const res = await fetch(`/api/cliente-app-gate?${q.toString()}`, {
        headers: dkPortalCloudFetchHeaders(),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        return {
          ok: true,
          cliente: { nome: String(data.nome || "").trim() },
          proto: String(data.proto || proto),
        };
      }
      if (!supa.ok && data.msg) return { ok: false, msg: data.msg };
    } catch {
      /* ignore */
    }

    if (!supa.ok) return supa;
    return {
      ok: false,
      msg: "Sem ligação à internet. Ligue o Wi-Fi/dados e tente novamente.",
    };
  }

  /** Cliente cadastrado com locação cujo protocolo coincide — requisito para instalar o app. */
  function validateClienteProtocoloParaApp(cpfDigits, protoRaw) {
    const cpf = onlyDigits(String(cpfDigits || "")).slice(0, 11);
    if (cpf.length !== 11) return { ok: false, msg: "Informe um CPF válido (11 dígitos)." };
    const proto = normProtoClienteGate(protoRaw);
    if (!proto) return { ok: false, msg: "Informe o protocolo da locação." };
    if (typeof loadCadastro !== "function" || typeof CAD_LOCACOES_KEY === "undefined") {
      return { ok: false, msg: "Cadastro indisponível. Tente novamente mais tarde." };
    }
    const locs =
      typeof collectPortalLocacoesByCpf === "function"
        ? collectPortalLocacoesByCpf(cpf)
        : loadCadastro(CAD_LOCACOES_KEY).filter((l) => onlyDigits(String(l.cpf || "")) === cpf);
    const hit = locs.find((l) => normProtoClienteGate(l.numeroContrato) === proto);
    if (!hit) {
      return {
        ok: false,
        msg: "Protocolo não encontrado para este CPF. Verifique os dados ou contacte a locadora.",
      };
    }
    let cliente =
      typeof getPortalClienteKnownRecord === "function" ? getPortalClienteKnownRecord(cpf) : null;
    if (!cliente && typeof findClienteByCpfCadastro === "function") {
      cliente = findClienteByCpfCadastro(cpf);
    }
    const nome =
      String(cliente?.nome || hit.nome || hit.cliente || "").trim() ||
      (typeof resolveOperacaoLancAluguelNomePorCpf === "function"
        ? resolveOperacaoLancAluguelNomePorCpf(cpf)
        : "");
    if (!nome) return { ok: false, msg: "Cliente não cadastrado. Contacte a DK Locadora." };
    const clienteOut = cliente ? { ...cliente, nome: nome || cliente.nome } : { cpf, nome };
    return { ok: true, cliente: clienteOut, loc: hit, proto };
  }

  function setPortalRolePickerLocadoraEmpresa() {
    document.querySelectorAll(".role-picker__btn--cliente-portal").forEach((b) => {
      b.classList.add("hidden");
      b.hidden = true;
    });
    if (portalUnitBackBtn) portalUnitBackBtn.textContent = "← Voltar";
  }

  function setPortalRolePickerOutrasUnidades() {
    document.querySelectorAll(".role-picker__btn--cliente-portal").forEach((b) => {
      b.classList.remove("hidden");
      b.hidden = false;
    });
    if (portalUnitBackBtn) portalUnitBackBtn.textContent = "← Voltar";
  }

  function openLocadoraHub() {
    currentUnit = "locadora";
    portalColaboradorSenhaPendente = null;
    portalResetSessaoSeNaoAdmin();
    if (!isPortalAdministradorLogado()) {
      resetPortalLoginFormularioETipoAcesso();
      hideAllPanels();
      btnOperacao?.classList.add("hidden");
      btnManutencao?.classList.add("hidden");
      btnLocalizacao?.classList.add("hidden");
      btnDocumentos?.classList.add("hidden");
    }
    showView("hub");
    setPortalHash("locadora");
    portalAtualizarBannerAdmin();
  }

  function openLocadoraClienteArea() {
    currentUnit = "locadora";
    portalResetSessaoSeNaoAdmin();
    showView("cliente");
    setPortalHash("locadora/cliente");
    if (locadoraAppFeedback) locadoraAppFeedback.textContent = "";
    portalRenderAdminClientePreviewUi();
    portalAtualizarBannerAdmin();
  }

  function openLocadoraEmpresa() {
    currentUnit = "locadora";
    portalColaboradorSenhaPendente = null;
    if (loginUnit) loginUnit.value = "locadora";
    if (unitTitle) unitTitle.textContent = "DK Locadora — Área da empresa";
    setPortalRolePickerLocadoraEmpresa();
    showView("unit");
    setPortalHash("locadora/empresa");

    const funcAdmin = isPortalAdministradorLogado() ? portalObterFuncionarioDaSessaoRestauracao() : null;
    if (funcAdmin) {
      clearPortalUnitDadosAtualizados();
      resetPortalLoginFormularioETipoAcesso();
      finalizarLoginEquipaPortal(funcAdmin);
      return;
    }

    portalResetSessaoSeNaoAdmin();
    if (unitLead) unitLead.textContent = LOCADORA_LEAD_SEM_SESSAO;
    clearPortalUnitDadosAtualizados();
    resetPortalLoginFormularioETipoAcesso();
    hideAllPanels();
    if (panelLogin) panelLogin.classList.add("hidden");
    portalAtualizarBannerAdmin();
  }

  function hideAllPanels() {
    if (typeof window.__DK_clienteGeoMapaOnHide === "function") window.__DK_clienteGeoMapaOnHide();
    [panelLogin, panelSenha, panelLogado, panelOperacao, panelManutencao, panelLocalizacao, panelDocumentos].forEach(
      (p) => {
        if (p) p.classList.add("hidden");
      }
    );
  }

  function portalAlertSemAcessoMiel() {
    window.alert(
      "O Sistema MIEL só pode ser acedido pelo administrador CPF 030.378.974-30 ou por funcionário cadastrado com a permissão «Acesso ao sistema MIEL». Clientes não têm acesso."
    );
  }

  function openMielSistema() {
    if (!portalPodeAcessarSistemaMiel()) {
      refreshPortalMielHomeAcesso();
      showView("home");
      setPortalHash("");
      portalAlertSemAcessoMiel();
      return;
    }
    currentUnit = "miel";
    portalColaboradorSenhaPendente = null;
    showView("miel");
    setPortalHash("miel");
    portalAtualizarBannerAdmin();
    if (typeof window.__DK_mielOnShow === "function") window.__DK_mielOnShow();
  }

  function openUnit(go) {
    if (go === "locadora") {
      openLocadoraHub();
      return;
    }
    if (go === "miel") {
      openMielSistema();
      return;
    }
    currentUnit = go;
    portalColaboradorSenhaPendente = null;
    portalResetSessaoSeNaoAdmin();
    if (loginUnit) loginUnit.value = go;
    if (unitTitle) {
      unitTitle.textContent = go === "centro" ? "DK Centro Automotivo" : "DK Construtora";
    }
    if (unitLead) {
      unitLead.textContent =
        "Conteúdo em preparação. Use o painel completo DK se precisar de cadastros aqui.";
    }
    setPortalRolePickerOutrasUnidades();
    hideAllPanels();
    if (panelLogin) panelLogin.classList.add("hidden");
    showView("unit");
    setPortalHash("");
  }

  document.querySelectorAll("[data-go]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const go = btn.getAttribute("data-go") || "";
      openUnit(go);
    });
  });

  document.querySelectorAll("[data-locadora-go]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const dest = btn.getAttribute("data-locadora-go") || "";
      if (dest === "cliente") openLocadoraClienteArea();
      else if (dest === "empresa") openLocadoraEmpresa();
    });
  });

  function portalVoltarInicio() {
    portalColaboradorSenhaPendente = null;
    portalResetSessaoSeNaoAdmin();
    if (!isPortalAdministradorLogado()) {
      resetPortalLoginFormularioETipoAcesso();
      hideAllPanels();
      btnOperacao?.classList.add("hidden");
      btnManutencao?.classList.add("hidden");
      btnLocalizacao?.classList.add("hidden");
      btnDocumentos?.classList.add("hidden");
      refreshPortalUnitLeadForSession();
      clearPortalUnitDadosAtualizados();
    }
    showView("home");
    setPortalHash("");
    portalAtualizarBannerAdmin();
  }

  function portalVoltarLocadoraHub() {
    portalColaboradorSenhaPendente = null;
    openLocadoraHub();
  }

  /** Da Operação/Manutenção/Localização/Patrimônio → Área da equipa. */
  function portalVoltarEquipaLocadora() {
    hideInlineForms();
    hideManutencaoInlineFormsCore();
    setOperacaoFormPlaceholderVisible(true);
    setManutencaoFormPlaceholderVisible(true);
    syncOperacaoCadastroButtons(null);
    syncManutencaoSidebarButtons(null);
    if (typeof window.__DK_documentosReset === "function") window.__DK_documentosReset();
    if (typeof window.__DK_clienteGeoMapaOnHide === "function") window.__DK_clienteGeoMapaOnHide();
    panelOperacao?.classList.add("hidden");
    panelManutencao?.classList.add("hidden");
    panelLocalizacao?.classList.add("hidden");
    panelDocumentos?.classList.add("hidden");
    panelLogado?.classList.remove("hidden");
    portalPersistirAreaAtiva("equipa");
  }

  /** Área da equipa (logado) → hub (admin) ou ecrã de login (colaborador). */
  function portalVoltarLoginDaEquipa() {
    if (isPortalAdministradorLogado()) {
      portalVoltarLocadoraHub();
      return;
    }
    portalColaboradorSenhaPendente = null;
    portalLimparAreaAtiva();
    hideInlineForms();
    hideManutencaoInlineFormsCore();
    setOperacaoFormPlaceholderVisible(true);
    setManutencaoFormPlaceholderVisible(true);
    syncOperacaoCadastroButtons(null);
    syncManutencaoSidebarButtons(null);
    if (typeof window.__DK_documentosReset === "function") window.__DK_documentosReset();
    if (typeof window.__DK_clienteGeoMapaOnHide === "function") window.__DK_clienteGeoMapaOnHide();
    if (typeof clearSession === "function") clearSession();
    hideAllPanels();
    btnOperacao?.classList.add("hidden");
    btnManutencao?.classList.add("hidden");
    btnLocalizacao?.classList.add("hidden");
    btnDocumentos?.classList.add("hidden");
    panelLogin?.classList.remove("hidden");
    if (unitLead && currentUnit === "locadora") unitLead.textContent = LOCADORA_LEAD_SEM_SESSAO;
    clearPortalUnitDadosAtualizados();
    portalAtualizarBannerAdmin();
  }

  function portalPersistirAreaAtiva(area) {
    try {
      sessionStorage.setItem(PORTAL_AREA_ATIVA_KEY, area);
    } catch {
      /* ignore */
    }
  }

  function portalLimparAreaAtiva() {
    try {
      sessionStorage.removeItem(PORTAL_AREA_ATIVA_KEY);
    } catch {
      /* ignore */
    }
  }

  function portalObterFuncionarioDaSessaoRestauracao() {
    const f = getPortalSessaoEquipaFuncionario();
    if (f) return f;
    try {
      const raw = localStorage.getItem("dk_sessao_cliente");
      if (!raw) return null;
      const s = JSON.parse(raw);
      if (s?.tipo !== "admin") return null;
      const cpf = onlyDigits(String(s.cpf || "")).slice(0, 11);
      if (cpf.length !== 11) return null;
      const role = String(s.role || "").trim();
      if (role === "owner" || cpf === DK_LOCADORA_ADMIN_CPF) {
        return {
          cpf,
          nome: String(s.nome || "").trim() || "Administrador",
          role: "owner",
        };
      }
      return { cpf, nome: String(s.nome || "").trim(), role: role || "operacao" };
    } catch {
      return null;
    }
  }

  /** Após recarga da página (ex.: câmera nativa no telemóvel), reabre património/operação sem novo login. */
  function portalRestaurarAreaLogadaAposRecarga() {
    const area = sessionStorage.getItem(PORTAL_AREA_ATIVA_KEY);
    if (!area || area === "equipa") return;
    const h = (window.location.hash || "").toLowerCase();
    if (h.startsWith("#locadora/cliente")) return;
    if (area === "documentos" && panelDocumentos && !panelDocumentos.classList.contains("hidden")) return;
    if (area === "localizacao" && panelLocalizacao && !panelLocalizacao.classList.contains("hidden")) return;
    if (area === "operacao" && panelOperacao && !panelOperacao.classList.contains("hidden")) return;
    if (area === "manutencao" && panelManutencao && !panelManutencao.classList.contains("hidden")) return;
    const func = portalObterFuncionarioDaSessaoRestauracao();
    if (!func) return;
    currentUnit = "locadora";
    showView("unit");
    finalizarLoginEquipaPortal(func);
    hideAllPanels();
    if (area === "documentos" && isPortalDocumentosAcesso()) {
      panelDocumentos?.classList.remove("hidden");
      if (typeof window.__DK_documentosOnShow === "function") window.__DK_documentosOnShow();
    } else if (area === "localizacao") {
      panelLocalizacao?.classList.remove("hidden");
      if (typeof window.__DK_clienteGeoMapaOnShow === "function") window.__DK_clienteGeoMapaOnShow();
    } else if (area === "operacao") {
      panelOperacao?.classList.remove("hidden");
      refreshPortalOperacaoNavPorAcessos();
      portalOperacaoAutoAbrirSeUnicoPermitido();
    } else if (area === "manutencao") {
      panelManutencao?.classList.remove("hidden");
    } else {
      panelLogado?.classList.remove("hidden");
    }
    portalPersistirAreaAtiva(area);
  }

  function portalFecharModalAberto() {
    const abertos = Array.from(document.querySelectorAll(".portal-modal")).filter(
      (m) => !m.classList.contains("hidden")
    );
    if (!abertos.length) return false;
    const modal = abertos[abertos.length - 1];
    const backdrop = modal.querySelector(".portal-modal__backdrop");
    if (backdrop instanceof HTMLElement) {
      backdrop.click();
      return true;
    }
    modal.classList.add("hidden");
    return true;
  }

  function portalDropdownEstaAberto(id) {
    const p = document.getElementById(id);
    return Boolean(p && !p.classList.contains("hidden") && !p.hidden);
  }

  function portalFecharDropdownsAbertos() {
    if (portalDropdownEstaAberto("portalChecklistPlacaLista")) {
      hidePortalChecklistPlacaDropdown();
      return true;
    }
    if (portalDropdownEstaAberto("operacaoVeiculoPlacaLista")) {
      hideOperacaoVeiculoPlacaDropdown();
      return true;
    }
    if (portalDropdownEstaAberto("operacaoLocacaoPlacaLista")) {
      hideOperacaoLocacaoPlacaDropdown();
      return true;
    }
    if (
      portalDropdownEstaAberto("portalWaListaCpf") ||
      portalDropdownEstaAberto("portalWaListaNome") ||
      portalDropdownEstaAberto("portalWaListaPlaca")
    ) {
      portalWaHideAllDropdowns();
      return true;
    }
    return false;
  }

  function portalOperacaoFormularioAberto() {
    if (!panelOperacao || panelOperacao.classList.contains("hidden")) return false;
    const ph = document.getElementById("operacaoFormPlaceholder");
    return Boolean(ph && ph.classList.contains("hidden"));
  }

  function portalManutencaoFormularioAberto() {
    if (!panelManutencao || panelManutencao.classList.contains("hidden")) return false;
    const ph = document.getElementById("manutencaoFormPlaceholder");
    return Boolean(ph && ph.classList.contains("hidden"));
  }

  /** Botão «Voltar» (data-back) — tela anterior no fluxo do portal (não vai ao início). */
  function portalAcaoVoltarTela() {
    if (typeof window.__DK_documentosEscapeBack === "function" && window.__DK_documentosEscapeBack()) {
      return;
    }
    const emOperacao = panelOperacao && !panelOperacao.classList.contains("hidden");
    const emManutencao = panelManutencao && !panelManutencao.classList.contains("hidden");
    const emDocumentos = panelDocumentos && !panelDocumentos.classList.contains("hidden");
    const emLocalizacao = panelLocalizacao && !panelLocalizacao.classList.contains("hidden");
    if (emOperacao || emManutencao || emDocumentos || emLocalizacao) {
      portalVoltarEquipaLocadora();
      return;
    }
    if (panelLogado && !panelLogado.classList.contains("hidden")) {
      portalVoltarLoginDaEquipa();
      return;
    }
    if (panelSenha && !panelSenha.classList.contains("hidden")) {
      panelSenha.classList.add("hidden");
      panelLogin?.classList.remove("hidden");
      return;
    }
    if (panelLogin && !panelLogin.classList.contains("hidden") && viewUnit?.classList.contains("view--active")) {
      if (currentUnit === "locadora") {
        portalVoltarLocadoraHub();
      } else {
        portalVoltarInicio();
      }
      return;
    }
    if (viewLocadoraHub?.classList.contains("view--active")) {
      portalVoltarInicio();
      return;
    }
    if (viewLocadoraCliente?.classList.contains("view--active")) {
      portalVoltarLocadoraHub();
      return;
    }
    if (viewMiel?.classList.contains("view--active")) {
      portalVoltarInicio();
      return;
    }
    if (currentUnit === "locadora" && viewUnit?.classList.contains("view--active")) {
      portalVoltarLocadoraHub();
      return;
    }
    portalVoltarInicio();
  }

  function portalTratarTeclaEscape(e) {
    if (e.key !== "Escape") return;
    if (!viewHome || !viewUnit) return;

    if (portalFecharModalAberto()) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    if (portalFecharDropdownsAbertos()) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    if (typeof window.__DK_documentosEscapeBack === "function" && window.__DK_documentosEscapeBack()) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    const fotos = document.getElementById("portalChecklistFotosGrid");
    if (fotos && !fotos.classList.contains("hidden")) {
      fotos.classList.add("hidden");
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    if (portalOperacaoFormularioAberto()) {
      hideInlineForms();
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    if (portalManutencaoFormularioAberto()) {
      hideManutencaoInlineFormsCore();
      setManutencaoFormPlaceholderVisible(true);
      syncManutencaoSidebarButtons(null);
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    if (panelSenha && !panelSenha.classList.contains("hidden")) {
      panelSenha.classList.add("hidden");
      panelLogin?.classList.remove("hidden");
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    portalAcaoVoltarTela();
    e.preventDefault();
    e.stopPropagation();
  }

  document.addEventListener("keydown", portalTratarTeclaEscape, true);

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
      portalAcaoVoltarTela();
    });
  });

  document.querySelectorAll("[data-inicio]").forEach((btn) => {
    btn.addEventListener("click", () => {
      portalVoltarInicio();
    });
  });

  document.querySelectorAll("[data-locadora-back]").forEach((btn) => {
    btn.addEventListener("click", () => {
      portalAcaoVoltarTela();
    });
  });

  function buildClienteInstalarUrl(cpf, proto) {
    const q = new URLSearchParams({ instalar: "1", cpf, proto });
    return `/cliente?${q.toString()}`;
  }

  function showPortalInstallPanel(cpf, v) {
    const panel = document.getElementById("locadora-install-done");
    const msg = document.getElementById("locadora-install-msg");
    const link = document.getElementById("locadora-install-open");
    const nome = String(v.cliente?.nome || "").trim();
    const url = buildClienteInstalarUrl(cpf, v.proto);
    if (msg) {
      msg.textContent = nome
        ? `${nome}: toque no botão abaixo para instalar o app DK Cliente.`
        : "Toque no botão abaixo para instalar o app DK Cliente.";
    }
    if (link) link.href = url;
    panel?.classList.remove("hidden");
    panel?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    if (locadoraAppFeedback) {
      locadoraAppFeedback.textContent = "Validado. Use o botão «Abrir instalação do app» abaixo.";
      locadoraAppFeedback.classList.remove("portal-feedback--error");
    }
  }

  function redirectParaInstalarAppCliente(cpf, v) {
    const gatePayload = JSON.stringify({
      cpf,
      proto: v.proto,
      nome: String(v.cliente?.nome || "").trim(),
      at: Date.now(),
    });
    sessionStorage.setItem(CLIENTE_APP_GATE_KEY, gatePayload);
    try {
      localStorage.setItem("dk_cliente_gate_persist", gatePayload);
    } catch {
      /* ignore */
    }
    showPortalInstallPanel(cpf, v);
    const url = buildClienteInstalarUrl(cpf, v.proto);
    if (locadoraAppFeedback) {
      locadoraAppFeedback.textContent =
        "CPF e protocolo validados. A abrir instalação em 2 segundos… (ou use o botão abaixo).";
    }
    window.setTimeout(() => {
      window.location.assign(url);
    }, 2000);
  }

  formLocadoraAppDownload?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const cpfIn = document.getElementById("locadora-app-cpf");
    const protoIn = document.getElementById("locadora-app-protocolo");
    const btnDl = document.getElementById("btn-locadora-app-download");
    const cpf = onlyDigits(String(cpfIn?.value || "")).slice(0, 11);
    const proto = String(protoIn?.value || "").trim();
    if (locadoraAppFeedback) {
      locadoraAppFeedback.textContent = "";
      locadoraAppFeedback.classList.remove("portal-feedback--error");
    }
    let v = validateClienteProtocoloParaApp(cpf, proto);
    if (!v.ok && typeof window.__DK_pullCloudSnapshotSilentMerge === "function") {
      if (locadoraAppFeedback) locadoraAppFeedback.textContent = "A sincronizar dados DK…";
      if (btnDl) btnDl.disabled = true;
      try {
        await window.__DK_pullCloudSnapshotSilentMerge();
      } catch {
        /* ignore */
      }
      if (btnDl) btnDl.disabled = false;
      v = validateClienteProtocoloParaApp(cpf, proto);
    }
    if (!v.ok) {
      if (locadoraAppFeedback) locadoraAppFeedback.textContent = "A validar na DK…";
      if (btnDl) btnDl.disabled = true;
      v = await validateClienteProtocoloParaAppRemote(cpf, proto);
      if (btnDl) btnDl.disabled = false;
    }
    if (!v.ok) {
      if (locadoraAppFeedback) {
        locadoraAppFeedback.textContent = v.msg;
        locadoraAppFeedback.classList.add("portal-feedback--error");
      }
      return;
    }
    try {
      redirectParaInstalarAppCliente(cpf, v);
    } catch {
      if (locadoraAppFeedback) {
        locadoraAppFeedback.textContent = "Não foi possível autorizar o download neste navegador.";
        locadoraAppFeedback.classList.add("portal-feedback--error");
      }
    }
  });

  document.getElementById("locadora-app-cpf")?.addEventListener("blur", () => {
    const inp = document.getElementById("locadora-app-cpf");
    if (!inp || typeof formatCpf !== "function") return;
    const dig = onlyDigits(String(inp.value || "")).slice(0, 11);
    if (dig.length === 11) inp.value = formatCpf(dig);
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

  function portalHydrateFuncionariosForLogin() {
    try {
      window.__DK_hydrateFuncionariosAccess?.();
    } catch {
      /* ignore */
    }
  }

  async function portalPullFuncionariosFromCloudForLogin() {
    if (typeof window.__DK_pullCloudSnapshotSilentMerge !== "function") return;
    try {
      await window.__DK_pullCloudSnapshotSilentMerge({ force: true });
    } catch {
      /* ignore */
    }
    portalHydrateFuncionariosForLogin();
  }

  function portalAutenticarEquipaPorCpfSenha(role, cpf, senha) {
    const funcionario = funcionariosAccess.find(
      (f) => onlyDigits(String(f.cpf || "")) === cpf && f.senha === senha
    );
    if (!funcionario) {
      return {
        ok: false,
        msg:
          "CPF ou senha inválidos. Se o cadastro foi feito noutro computador, aguarde alguns segundos e tente de novo (ou Ctrl+F5).",
      };
    }
    if (role === "administrador") {
      if (funcionario.role !== "owner") {
        return { ok: false, msg: "Este CPF não tem perfil de administrador." };
      }
    } else if (funcionario.role === "owner") {
      return { ok: false, msg: "Administrador: use a opção Administrador acima." };
    } else if (funcionario.role !== "operacao") {
      return { ok: false, msg: "Perfil sem permissão de colaborador." };
    }
    if (funcionario.blocked) {
      return { ok: false, msg: "Acesso bloqueado." };
    }
    return { ok: true, funcionario };
  }

  formLogin?.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (typeof enforceMaintenanceAndDailyRoutines === "function" && enforceMaintenanceAndDailyRoutines()) {
      const aviso =
        typeof getMaintenanceNotice === "function"
          ? getMaintenanceNotice()
          : "Sistema em conferência diária. Tente novamente mais tarde.";
      if (loginFeedback) {
        loginFeedback.textContent = aviso;
        loginFeedback.classList.add("portal-feedback--error");
      }
      return;
    }
    if (loginFeedback) loginFeedback.classList.remove("portal-feedback--error");
    const fd = new FormData(formLogin);
    const cpf = onlyDigits(String(fd.get("cpf") || ""));
    const senha = String(fd.get("senha") || "").trim();
    const role = String(loginRole?.value || "").trim();
    if (loginFeedback) loginFeedback.textContent = "";

    if (!role) {
      loginFeedback.textContent = "Selecione Colaborador ou Administrador acima.";
      return;
    }

    if (role === "cliente") {
      loginFeedback.textContent =
        "Acesso de cliente pelo portal foi descontinuado. Use «Área do Cliente» na página anterior.";
      return;
    }

    if (role === "colaborador" || role === "administrador") {
      if (role === "administrador" && cpf !== DK_LOCADORA_ADMIN_CPF) {
        loginFeedback.textContent = "Acesso de administrador restrito ao titular autorizado.";
        return;
      }
      portalHydrateFuncionariosForLogin();
      let auth = portalAutenticarEquipaPorCpfSenha(role, cpf, senha);
      if (!auth.ok) {
        await portalPullFuncionariosFromCloudForLogin();
        auth = portalAutenticarEquipaPorCpfSenha(role, cpf, senha);
      }
      if (!auth.ok) {
        loginFeedback.textContent = auth.msg;
        return;
      }
      const funcionario = auth.funcionario;
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
      portalPersistirAreaAtiva("equipa");
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
    if (typeof window.__DK_pushToCloudAfterSave === "function") {
      void window.__DK_pushToCloudAfterSave();
    }
    portalColaboradorSenhaPendente = null;
    finalizarLoginEquipaPortal(f);
    portalPersistirAreaAtiva("equipa");
  });

  btnOperacao?.addEventListener("click", () => {
    portalRefreshOperacaoLocal();
    portalScheduleBackgroundCloudPullOnce();
    hideOperacaoInlineFormsCore();
    setOperacaoFormPlaceholderVisible(true);
    syncOperacaoCadastroButtons(null);
    hideAllPanels();
    panelOperacao?.classList.remove("hidden");
    refreshPortalOperacaoNavPorAcessos();
    refreshOperacaoClienteCodigoEditavel();
    portalOperacaoAutoAbrirSeUnicoPermitido();
    portalPersistirAreaAtiva("operacao");
  });

  function hideManutencaoInlineFormsCore() {
    ["operacaoInlineLancamentoManutencao", "manutencaoInlineEmOperacao", "manutencaoInlineEmManutencao", "manutencaoInlineReserva", "manutencaoInlineOperacionais"].forEach((id) => {
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
    ["btn-operacao-lancamento-manutencao", "btn-manutencao-em-operacao", "btn-manutencao-em-manutencao", "btn-manutencao-reserva", "btn-manutencao-operacionais"].forEach((id) => {
      const b = document.getElementById(id);
      if (!b) return;
      const on = Boolean(activeButtonId && id === activeButtonId);
      b.classList.toggle("is-active", on);
      b.setAttribute("aria-expanded", on ? "true" : "false");
    });
  }

  btnManutencao?.addEventListener("click", () => {
    portalRefreshOperacaoLocal();
    hideManutencaoInlineFormsCore();
    setManutencaoFormPlaceholderVisible(true);
    syncManutencaoSidebarButtons(null);
    hideAllPanels();
    panelManutencao?.classList.remove("hidden");
    refreshPortalOperacaoNavPorAcessos();
    portalPersistirAreaAtiva("manutencao");
  });

  btnVoltarManutencao?.addEventListener("click", () => {
    portalVoltarEquipaLocadora();
  });

  btnDocumentos?.addEventListener("click", () => {
    if (!isPortalDocumentosAcesso()) return;
    hideAllPanels();
    if (typeof window.__DK_documentosOnShow === "function") window.__DK_documentosOnShow();
    panelDocumentos?.classList.remove("hidden");
    portalPersistirAreaAtiva("documentos");
  });

  btnLocalizacao?.addEventListener("click", () => {
    hideAllPanels();
    panelLocalizacao?.classList.remove("hidden");
    if (typeof window.__DK_clienteGeoMapaOnShow === "function") window.__DK_clienteGeoMapaOnShow();
    portalPersistirAreaAtiva("localizacao");
  });

  btnVoltarDocumentos?.addEventListener("click", () => {
    portalVoltarEquipaLocadora();
  });

  btnVoltarLocalizacao?.addEventListener("click", () => {
    portalVoltarEquipaLocadora();
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
      panel.innerHTML = `<div class="portal-placa-dropdown__empty">Nenhuma placa em operação (cadastre uma locação ativa primeiro).</div>`;
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
    printable.querySelectorAll(".portal-checklist-print-header").forEach((node) => node.remove());
    printable.querySelectorAll(".portal-checklist-clipboard-btn").forEach((node) => node.remove());
    const body = printable.querySelector(".portal-checklist-clipboard-body");
    if (body) {
      body.style.transform = "";
      body.style.width = "";
      body.style.height = "";
    }
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
      <div id="portalChecklistPrintArea" class="portal-checklist-print-root portal-checklist-tablet">
        <div class="portal-checklist-print-header portal-checklist-no-print">
          <h4>CHECK LIST — MANUTENÇÃO / REPARAÇÕES</h4>
          <button
            type="button"
            class="portal-checklist-clipboard-btn"
            id="portalChecklistBtnClipboard"
            aria-pressed="false"
            title="Expandir check-list (prancheta tablet)"
            aria-label="Expandir check-list em tela cheia"
          >
            <span class="portal-checklist-clipboard-btn__icon" aria-hidden="true">↗</span>
          </button>
        </div>
        <h4 class="portal-checklist-print-title-print-only">CHECK LIST — MANUTENÇÃO / REPARAÇÕES</h4>
        <div class="portal-checklist-clipboard-body" id="portalChecklistClipboardBody">
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
          <label>Entrada (data) <input type="text" id="portalChecklistEntradaData" inputmode="numeric" maxlength="10" autocomplete="off" placeholder="DD/MM/AAAA"></label>
          <label>Entrada (hora) <input type="time" id="portalChecklistEntradaHora"></label>
          <label>Saída (data) <input type="text" id="portalChecklistSaidaData" inputmode="numeric" maxlength="10" autocomplete="off" placeholder="DD/MM/AAAA"></label>
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
        <div class="portal-checklist-inspection-wrap">
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
        </div>
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
      </div>
    `;

    portalPopulateColaboradoresChecklistSelects();
    portalBindInnerChecklistEvents();
    portalBindChecklistClipboardToggle();
    portalValidateChecklistCompleto();
    portalChecklistUiBuilt = true;
  }

  /** Ajusta densidade do check-list à viewport (sem zoom/scale). */
  function portalFitChecklistClipboardLayout() {
    const root = document.getElementById("portalChecklistPrintArea");
    const body = document.getElementById("portalChecklistClipboardBody");
    if (!root || !body) return;

    body.style.transform = "";
    body.style.transformOrigin = "";
    body.style.width = "";
    body.style.height = "";
    body.style.maxWidth = "";

    if (!document.body.classList.contains("portal-checklist-clipboard-mode")) {
      root.style.removeProperty("--cl-compact");
      return;
    }

    body.style.width = "100%";
    let lo = 0.58;
    let hi = 1;
    let best = 0.72;
    for (let i = 0; i < 10; i += 1) {
      const mid = (lo + hi) / 2;
      root.style.setProperty("--cl-compact", String(mid));
      void body.offsetHeight;
      const fits =
        body.scrollHeight <= body.clientHeight + 2 && body.scrollWidth <= body.clientWidth + 2;
      if (fits) {
        best = mid;
        lo = mid;
      } else {
        hi = mid;
      }
    }
    root.style.setProperty("--cl-compact", String(best));
  }

  let portalChecklistClipboardHost = null;

  function portalSetChecklistClipboardMode(on) {
    const root = document.getElementById("portalChecklistPrintArea");
    const btn = document.getElementById("portalChecklistBtnClipboard");
    const icon = btn?.querySelector(".portal-checklist-clipboard-btn__icon");
    const mount = document.getElementById("portalChecklistMount");
    if (!root) return;

    if (on) {
      if (!portalChecklistClipboardHost) {
        portalChecklistClipboardHost = root.parentElement;
      }
      if (root.parentElement !== document.body) {
        document.body.appendChild(root);
      }
    } else if (portalChecklistClipboardHost && root.parentElement === document.body) {
      portalChecklistClipboardHost.appendChild(root);
    }

    document.body.classList.toggle("portal-checklist-clipboard-mode", Boolean(on));
    root.classList.toggle("portal-checklist-print-root--clipboard", Boolean(on));
    mount?.classList.toggle("portal-checklist-mount--tablet", true);
    if (btn) {
      btn.setAttribute("aria-pressed", on ? "true" : "false");
      btn.title = on
        ? "Voltar à visualização do programa"
        : "Expandir check-list (prancheta tablet)";
      btn.setAttribute(
        "aria-label",
        on ? "Recolher check-list e voltar ao programa" : "Expandir check-list em tela cheia"
      );
    }
    if (icon) icon.textContent = on ? "↙" : "↗";
    if (on) {
      requestAnimationFrame(() => {
        portalFitChecklistClipboardLayout();
        requestAnimationFrame(portalFitChecklistClipboardLayout);
      });
    } else {
      portalFitChecklistClipboardLayout();
    }
  }

  function portalBindChecklistClipboardToggle() {
    const btn = document.getElementById("portalChecklistBtnClipboard");
    if (!btn || btn.dataset.boundClipboard === "1") return;
    btn.dataset.boundClipboard = "1";
    btn.addEventListener("click", () => {
      const next = !document.body.classList.contains("portal-checklist-clipboard-mode");
      portalSetChecklistClipboardMode(next);
    });
    window.addEventListener(
      "resize",
      () => {
        if (document.body.classList.contains("portal-checklist-clipboard-mode")) {
          portalFitChecklistClipboardLayout();
        }
      },
      { passive: true }
    );
    document.addEventListener("keydown", (ev) => {
      if (ev.key === "Escape" && document.body.classList.contains("portal-checklist-clipboard-mode")) {
        portalSetChecklistClipboardMode(false);
      }
    });
  }

  document.getElementById("btnPortalChecklistAbrir")?.addEventListener("click", () => {
    portalEnsureChecklistUiBuilt();
    refreshPortalChecklistPlacasAtivasCache();
    const mount = document.getElementById("portalChecklistMount");
    mount?.classList.remove("hidden");
    mount?.classList.add("portal-checklist-mount--tablet");
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
    mount?.classList.add("portal-checklist-mount--tablet");
    fotosGrid?.classList.remove("hidden");
    portalValidateChecklistCompleto();
  });

  [
    { btn: "btn-manutencao-em-operacao", panel: "manutencaoInlineEmOperacao" },
    { btn: "btn-manutencao-em-manutencao", panel: "manutencaoInlineEmManutencao" },
    { btn: "btn-manutencao-reserva", panel: "manutencaoInlineReserva" },
    { btn: "btn-manutencao-operacionais", panel: "manutencaoInlineOperacionais" },
  ].forEach(({ btn, panel }) => {
    document.getElementById(btn)?.addEventListener("click", async () => {
      portalRefreshOperacaoLocal();
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

  /** Colaborador em edição (CPF original ou CPF actual com 11 dígitos). */
  function getPortalColaboradorEmEdicao() {
    if (portalColabCpfEdicaoOriginal) {
      return findFuncionarioOperacaoPortalPorCpf(portalColabCpfEdicaoOriginal);
    }
    const dig = onlyDigits(String(document.getElementById("portalColabCpf")?.value || "")).slice(0, 11);
    return dig.length === 11 ? findFuncionarioOperacaoPortalPorCpf(dig) : null;
  }

  function refreshPortalColaboradorBloqueioUi() {
    const wrap = document.getElementById("portalColabBloqueioWrap");
    const btn = document.getElementById("portalColabBloqueioBtn");
    const resetWrap = document.getElementById("portalColabResetSenhaWrap");
    if (!wrap || !btn) return;
    if (!isPortalTitularAdministrador()) {
      wrap.classList.add("hidden");
      resetWrap?.classList.add("hidden");
      return;
    }
    const f = getPortalColaboradorEmEdicao();
    if (!f) {
      wrap.classList.add("hidden");
      resetWrap?.classList.add("hidden");
      btn.textContent = "Bloquear colaborador";
      return;
    }
    wrap.classList.remove("hidden");
    resetWrap?.classList.remove("hidden");
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
    const c5 = document.getElementById("portalColabAceLancMultas");
    const c6 = document.getElementById("portalColabAceLancManutencao");
    const c7 = document.getElementById("portalColabAceSistemaMiel");
    if (c1) c1.checked = true;
    if (c2) c2.checked = true;
    if (c3) c3.checked = true;
    if (c4) c4.checked = true;
    if (c5) c5.checked = true;
    if (c6) c6.checked = true;
    if (c7) c7.checked = false;
  }

  function portalColabPermissoesAtivas(f) {
    const a = f?.acessos || {};
    return PORTAL_COLAB_ACESSO_ITENS.filter((it) => Boolean(a[it.key]));
  }

  function portalColabFormatCpfExibicao(digits11) {
    const dig = onlyDigits(String(digits11 || "")).slice(0, 11);
    return typeof formatCpf === "function" && dig.length === 11 ? formatCpf(dig) : dig;
  }

  function portalRenderColaboradorPermissoesDetalhe(f) {
    const wrap = document.getElementById("portalColabPermissoesDetalhe");
    const titulo = document.getElementById("portalColabPermissoesDetalheTitulo");
    const lista = document.getElementById("portalColabPermissoesDetalheLista");
    if (!wrap || !titulo || !lista) return;
    if (!f) {
      wrap.classList.add("hidden");
      titulo.textContent = "";
      lista.innerHTML = "";
      return;
    }
    const ativas = portalColabPermissoesAtivas(f);
    const cpfFmt = portalColabFormatCpfExibicao(f.cpf);
    const bloqueado = f.blocked ? " · bloqueado" : "";
    titulo.textContent = `${String(f.nome || "").trim()} (${cpfFmt})${bloqueado}`;
    if (!ativas.length) {
      lista.innerHTML = "<li>Nenhuma operação permitida</li>";
    } else {
      lista.innerHTML = ativas.map((it) => `<li>${portalEscapeHtml(it.label)}</li>`).join("");
    }
    wrap.classList.remove("hidden");
  }

  function portalSelecionarColaboradorLista(cpfDig) {
    const dig = onlyDigits(String(cpfDig || "")).slice(0, 11);
    if (dig.length !== 11) return;
    const f = findFuncionarioOperacaoPortalPorCpf(dig);
    if (!f) return;
    portalColabListaCpfAtivo = dig;
    portalColabCpfEdicaoOriginal = dig;
    const inp = document.getElementById("portalColabCpf");
    if (inp) inp.value = portalColabFormatCpfExibicao(dig);
    portalColabCpfPrevLen = 11;
    aplicarPortalColaboradorDoFuncionario(f);
    setPortalColaboradorModoCadastroOuEdicao(false);
    refreshPortalColaboradorBloqueioUi();
    portalRenderColaboradoresLista();
    portalRenderColaboradorPermissoesDetalhe(f);
    const fb = document.getElementById("portalCadastroColaboradorFeedback");
    if (fb) fb.textContent = "";
  }

  function portalRenderColaboradoresLista() {
    const ul = document.getElementById("portalColabLista");
    const vazia = document.getElementById("portalColabListaVazia");
    if (!ul) return;
    if (!isPortalTitularAdministrador()) {
      ul.innerHTML = "";
      vazia?.classList.add("hidden");
      return;
    }
    if (typeof funcionariosAccess === "undefined" || !Array.isArray(funcionariosAccess)) {
      ul.innerHTML = "";
      vazia?.classList.remove("hidden");
      if (vazia) vazia.textContent = "Lista indisponível neste ambiente.";
      return;
    }
    const list = funcionariosAccess
      .filter((f) => String(f.role || "").trim() === "operacao")
      .slice()
      .sort((a, b) => String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR"));
    if (!list.length) {
      ul.innerHTML = "";
      vazia?.classList.remove("hidden");
      if (vazia) vazia.textContent = "Nenhum colaborador cadastrado.";
      portalRenderColaboradorPermissoesDetalhe(null);
      return;
    }
    vazia?.classList.add("hidden");
    ul.innerHTML = list
      .map((f) => {
        const dig = onlyDigits(String(f.cpf || "")).slice(0, 11);
        const nome = portalEscapeHtml(String(f.nome || "").trim() || "—");
        const funcao = portalEscapeHtml(String(f.funcao || "").trim());
        const cpfFmt = portalEscapeHtml(portalColabFormatCpfExibicao(dig));
        const nPerm = portalColabPermissoesAtivas(f).length;
        const sel = dig === portalColabListaCpfAtivo ? " portal-colab-lista__item--ativo" : "";
        const bloqueado = f.blocked
          ? '<span class="portal-colab-lista__badge portal-colab-lista__badge--bloqueado">Bloqueado</span>'
          : "";
        const sub = funcao
          ? `${funcao} · ${cpfFmt} · ${nPerm} permissão(ões)`
          : `${cpfFmt} · ${nPerm} permissão(ões)`;
        return `<li class="portal-colab-lista__item${sel}">
          <button type="button" class="portal-colab-lista__btn" data-colab-cpf="${portalEscapeHtml(dig)}" aria-pressed="${dig === portalColabListaCpfAtivo ? "true" : "false"}">
            <span class="portal-colab-lista__nome">${nome}</span>
            <span class="portal-colab-lista__sub">${portalEscapeHtml(sub)}</span>
            ${bloqueado}
          </button>
        </li>`;
      })
      .join("");
    ul.querySelectorAll("[data-colab-cpf]").forEach((btn) => {
      btn.addEventListener("click", () => {
        portalSelecionarColaboradorLista(btn.getAttribute("data-colab-cpf"));
      });
    });
    if (portalColabListaCpfAtivo) {
      const ativo = findFuncionarioOperacaoPortalPorCpf(portalColabListaCpfAtivo);
      portalRenderColaboradorPermissoesDetalhe(ativo);
    }
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
    const c5 = document.getElementById("portalColabAceLancMultas");
    const c6 = document.getElementById("portalColabAceLancManutencao");
    const c7 = document.getElementById("portalColabAceSistemaMiel");
    if (c1) c1.checked = Boolean(a.cliente);
    if (c2) c2.checked = Boolean(a.veiculo);
    if (c3) c3.checked = Boolean(a.locacao);
    if (c4) c4.checked = Boolean(a.lancamentoAluguel);
    if (c5) c5.checked = Boolean(a.lancamentoMultas ?? a.lancamentoAluguel);
    if (c6) c6.checked = Boolean(a.lancamentoManutencao ?? a.lancamentoAluguel);
    if (c7) c7.checked = Boolean(a.sistemaMiel);
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
    const emEdicao = Boolean(portalColabCpfEdicaoOriginal);

    if (len < 11 && portalColabCpfPrevLen === 11 && !emEdicao) {
      limparPortalColaboradorCamposParaNovo();
    }
    portalColabCpfPrevLen = len;

    if (emEdicao) {
      const fOrig = findFuncionarioOperacaoPortalPorCpf(portalColabCpfEdicaoOriginal);
      if (!fOrig) {
        portalColabCpfEdicaoOriginal = "";
      } else if (len === 11 && dig !== portalColabCpfEdicaoOriginal) {
        const fOutro = findFuncionarioOperacaoPortalPorCpf(dig);
        if (fOutro) {
          portalColabCpfEdicaoOriginal = dig;
          portalColabListaCpfAtivo = dig;
          aplicarPortalColaboradorDoFuncionario(fOutro);
          setPortalColaboradorModoCadastroOuEdicao(false);
          portalRenderColaboradorPermissoesDetalhe(fOutro);
        } else {
          portalColabListaCpfAtivo = portalColabCpfEdicaoOriginal;
          setPortalColaboradorModoCadastroOuEdicao(false);
          portalRenderColaboradorPermissoesDetalhe(fOrig);
        }
      } else if (len === 11) {
        portalColabListaCpfAtivo = dig;
        setPortalColaboradorModoCadastroOuEdicao(false);
        portalRenderColaboradorPermissoesDetalhe(fOrig);
      } else {
        portalColabListaCpfAtivo = portalColabCpfEdicaoOriginal;
        setPortalColaboradorModoCadastroOuEdicao(false);
        portalRenderColaboradorPermissoesDetalhe(fOrig);
      }
      refreshPortalColaboradorBloqueioUi();
      portalRenderColaboradoresLista();
      return;
    }

    if (len < 11) {
      portalColabListaCpfAtivo = "";
      portalColabCpfEdicaoOriginal = "";
      setPortalColaboradorModoCadastroOuEdicao(true);
      refreshPortalColaboradorBloqueioUi();
      portalRenderColaboradoresLista();
      portalRenderColaboradorPermissoesDetalhe(null);
      return;
    }

    const f = findFuncionarioOperacaoPortalPorCpf(dig);
    if (f) {
      portalColabListaCpfAtivo = dig;
      portalColabCpfEdicaoOriginal = dig;
      aplicarPortalColaboradorDoFuncionario(f);
      setPortalColaboradorModoCadastroOuEdicao(false);
      portalRenderColaboradorPermissoesDetalhe(f);
    } else {
      portalColabListaCpfAtivo = "";
      portalColabCpfEdicaoOriginal = "";
      limparPortalColaboradorCamposParaNovo();
      setPortalColaboradorModoCadastroOuEdicao(true);
      portalRenderColaboradorPermissoesDetalhe(null);
    }
    refreshPortalColaboradorBloqueioUi();
    portalRenderColaboradoresLista();
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
    if (!portalColabTemAlgumaOperacaoMarcada()) {
      if (fb) fb.textContent = "Marque pelo menos uma operação permitida.";
      return;
    }
    const acessos = buildPortalColabAcessosNormalizados();
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
    refreshPortalMielHomeAcesso();
    formPortalCadastroColaborador.reset();
    portalColabCpfPrevLen = 0;
    portalColabListaCpfAtivo = "";
    portalColabCpfEdicaoOriginal = "";
    syncPortalColaboradorFormFromCpf();
    portalRenderColaboradoresLista();
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
    const cpfNovo = onlyDigits(String(document.getElementById("portalColabCpf")?.value || "")).slice(0, 11);
    const cpfOriginal = portalColabCpfEdicaoOriginal || cpfNovo;
    const nome = String(document.getElementById("portalColabNome")?.value || "").trim();
    const funcao = String(document.getElementById("portalColabFuncao")?.value || "").trim();
    const dataIngresso = String(document.getElementById("portalColabIngresso")?.value || "").trim();
    if (cpfNovo.length !== 11) {
      if (fb) fb.textContent = "Informe um CPF válido (11 dígitos).";
      return;
    }
    const f = findFuncionarioOperacaoPortalPorCpf(cpfOriginal);
    if (!f) {
      if (fb) fb.textContent = "Não há colaborador com este CPF para atualizar.";
      return;
    }
    if (
      cpfNovo !== cpfOriginal &&
      funcionariosAccess.some((x) => onlyDigits(String(x.cpf || "")) === cpfNovo)
    ) {
      if (fb) fb.textContent = "Já existe outro cadastro com este CPF.";
      return;
    }
    if (!nome) {
      if (fb) fb.textContent = "Informe o nome completo.";
      return;
    }
    if (!portalColabTemAlgumaOperacaoMarcada()) {
      if (fb) fb.textContent = "Marque pelo menos uma operação permitida.";
      return;
    }
    const acessos = buildPortalColabAcessosNormalizados();
    const antesColab = {
      cpf: portalColabFormatCpfExibicao(cpfOriginal),
      nome: portalNormDiffVal(f.nome),
      funcao: portalNormDiffVal(f.funcao),
      dataIngresso: portalNormDiffVal(f.dataIngresso),
      cliente: portalNormDiffVal(f.acessos?.cliente ? "sim" : "não"),
      veiculo: portalNormDiffVal(f.acessos?.veiculo ? "sim" : "não"),
      locacao: portalNormDiffVal(f.acessos?.locacao ? "sim" : "não"),
      lancamentoAluguel: portalNormDiffVal(f.acessos?.lancamentoAluguel ? "sim" : "não"),
      lancamentoMultas: portalNormDiffVal(f.acessos?.lancamentoMultas ? "sim" : "não"),
      lancamentoManutencao: portalNormDiffVal(f.acessos?.lancamentoManutencao ? "sim" : "não"),
    };
    const depoisColab = {
      cpf: portalColabFormatCpfExibicao(cpfNovo),
      nome,
      funcao,
      dataIngresso,
      cliente: aceCliente ? "sim" : "não",
      veiculo: aceVeiculo ? "sim" : "não",
      locacao: aceLocacao ? "sim" : "não",
      lancamentoAluguel: aceLanc ? "sim" : "não",
      lancamentoMultas: aceMultas ? "sim" : "não",
      lancamentoManutencao: aceManut ? "sim" : "não",
    };
    const COLAB_LABELS = {
      cpf: "CPF",
      nome: "Nome",
      funcao: "Função",
      dataIngresso: "Data ingresso",
      cliente: "Cadastro cliente",
      veiculo: "Cadastro veículo",
      locacao: "Cadastro locação",
      lancamentoAluguel: "Lanç. aluguel",
      lancamentoMultas: "Lanç. multas",
      lancamentoManutencao: "Lanç. manutenção",
    };
    const doSaveColab = () => {
      f.cpf = cpfNovo;
      f.nome = nome;
      f.funcao = funcao;
      f.dataIngresso = dataIngresso;
      f.acessos = acessos;
      saveFuncionariosAccess();
      portalPushCloudSnapshotAfterPersist();
      refreshPortalMielHomeAcesso();
      portalColabCpfEdicaoOriginal = cpfNovo;
      portalColabListaCpfAtivo = cpfNovo;
      portalColabCpfPrevLen = 11;
      const inpCpf = document.getElementById("portalColabCpf");
      if (inpCpf && typeof formatCpf === "function") inpCpf.value = formatCpf(cpfNovo);
      aplicarPortalColaboradorDoFuncionario(f);
      refreshPortalOperacaoNavPorAcessos();
      portalRenderColaboradoresLista();
      portalRenderColaboradorPermissoesDetalhe(f);
      if (fb) fb.textContent = "Alterações guardadas.";
    };
    portalConfirmarAlteracaoAdministrador(
      {
        titulo: "Confirmar alteração — colaborador",
        changes: portalBuildAlteracoesLista(antesColab, depoisColab, COLAB_LABELS),
      },
      doSaveColab
    );
  });

  document.getElementById("portalColabBloqueioBtn")?.addEventListener("click", () => {
    const fb = document.getElementById("portalCadastroColaboradorFeedback");
    if (!isPortalTitularAdministrador()) return;
    if (typeof saveFuncionariosAccess !== "function" || typeof funcionariosAccess === "undefined") return;
    const f = getPortalColaboradorEmEdicao();
    if (!f) {
      if (fb) fb.textContent = "CPF não corresponde a um colaborador cadastrado.";
      return;
    }
    f.blocked = !f.blocked;
    saveFuncionariosAccess();
    portalPushCloudSnapshotAfterPersist();
    syncPortalColaboradorFormFromCpf();
    portalRenderColaboradoresLista();
    if (fb) {
      fb.textContent = f.blocked
        ? "Colaborador bloqueado — não pode entrar no sistema."
        : "Colaborador desbloqueado — pode voltar a aceder.";
    }
  });

  document.getElementById("portalColabResetSenhaBtn")?.addEventListener("click", () => {
    const fb = document.getElementById("portalCadastroColaboradorFeedback");
    if (!isPortalTitularAdministrador()) {
      if (fb) fb.textContent = "Apenas o administrador titular pode resetar senhas.";
      return;
    }
    if (typeof saveFuncionariosAccess !== "function" || typeof funcionariosAccess === "undefined") return;
    const f = getPortalColaboradorEmEdicao();
    if (!f) {
      if (fb) fb.textContent = "CPF não corresponde a um colaborador cadastrado.";
      return;
    }
    const senhaIni = typeof SENHA_INICIAL_OPERACAO !== "undefined" ? SENHA_INICIAL_OPERACAO : "123456";
    const nomeColab = String(f.nome || "").trim() || "colaborador";
    if (
      !window.confirm(
        `Resetar a senha de ${nomeColab}?\n\nA senha volta para ${senhaIni} e no próximo login será pedida uma nova senha de 6 números.`
      )
    ) {
      return;
    }
    f.senha = senhaIni;
    f.mustChangePassword = true;
    saveFuncionariosAccess();
    portalPushCloudSnapshotAfterPersist();
    if (fb) {
      fb.textContent = `Senha de ${nomeColab} resetada para ${senhaIni} — no próximo login será pedida a nova senha (6 números).`;
    }
  });

  PORTAL_COLAB_ACESSO_ITENS.forEach(({ key }) => {
    const el = document.getElementById(PORTAL_COLAB_ACE_IDS[key]);
    el?.addEventListener("change", () => {
      const f = getPortalColaboradorEmEdicao();
      if (f && (portalColabCpfEdicaoOriginal || portalColabListaCpfAtivo)) {
        portalRenderColaboradorPermissoesDetalhe({ ...f, acessos: readPortalColabAcessosFromForm() });
      }
    });
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
    portalVoltarEquipaLocadora();
  });

  btnSair?.addEventListener("click", () => {
    portalColaboradorSenhaPendente = null;
    portalLimparAreaAtiva();
    if (typeof clearSession === "function") clearSession();
    try {
      localStorage.removeItem(PORTAL_SESSAO_BUILD_KEY);
    } catch {
      /* ignore */
    }
    resetPortalLoginFormularioETipoAcesso();
    hideAllPanels();
    btnOperacao?.classList.add("hidden");
    btnManutencao?.classList.add("hidden");
    btnLocalizacao?.classList.add("hidden");
    btnDocumentos?.classList.add("hidden");
    portalAtualizarBannerAdmin();
    refreshPortalUnitLeadForSession();
    if (currentUnit === "locadora") {
      openLocadoraEmpresa();
      return;
    }
    panelLogin?.classList.remove("hidden");
    setPortalHash("");
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

  /** Data de cadastro exibível: nunca usar `id` numérico como data (evita valores tipo «1900000310»). */
  function portalClienteDataLabelPreferido(cliente, cpfDigits, getPrimeiraLocacaoDateLabel) {
    if (!cliente) return "";
    const fromDc = formatPortalCadastroDateLabel(String(cliente.dataCadastro || "").trim());
    if (fromDc) return fromDc;
    const ca = cliente.createdAt;
    if (typeof ca === "number" && !Number.isNaN(ca) && ca > 946684800000) {
      const fromTs = formatPortalCadastroDateLabel(new Date(ca).toISOString());
      if (fromTs) return fromTs;
    }
    if (typeof ca === "string" && String(ca).trim()) {
      const fromStr = formatPortalCadastroDateLabel(String(ca).trim());
      if (fromStr) return fromStr;
    }
    if (typeof getPrimeiraLocacaoDateLabel === "function") {
      const fromLoc = String(getPrimeiraLocacaoDateLabel(cpfDigits) || "").trim();
      if (fromLoc) return fromLoc;
    }
    return "";
  }

  function getPortalClientesBundledSnapshot() {
    if (
      typeof window.__DK_isOficialCadastroGuardActive === "function" &&
      window.__DK_isOficialCadastroGuardActive()
    ) {
      const extras =
        typeof CLIENTES_EXTRA_SYNC_DATA !== "undefined" && Array.isArray(CLIENTES_EXTRA_SYNC_DATA)
          ? CLIENTES_EXTRA_SYNC_DATA
          : [];
      return extras;
    }
    const extras =
      typeof CLIENTES_EXTRA_SYNC_DATA !== "undefined" && Array.isArray(CLIENTES_EXTRA_SYNC_DATA)
        ? CLIENTES_EXTRA_SYNC_DATA
        : [];
    if (typeof loadCadastro === "function" && typeof CAD_CLIENTES_KEY !== "undefined") {
      const planilha = loadCadastro(CAD_CLIENTES_KEY).filter((c) => c?.origemPlanilha && !c?.origemPortal);
      if (planilha.length) return [...planilha, ...extras];
    }
    if (typeof window !== "undefined" && Array.isArray(window.DK_BANCO_CADASTRO?.clientes)) {
      const planilha = window.DK_BANCO_CADASTRO.clientes.filter((c) => !c?.origemPortal);
      return [...planilha, ...extras];
    }
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
    const matchCpf = (c) => {
      const cpf =
        typeof onlyDigits === "function" ? onlyDigits(String(c.cpf || "")) : String(c.cpf || "").replace(/\D/g, "");
      return cpf === cpfDigits;
    };
    const base = getPortalClientesBundledSnapshot();
    const fromSnapshot = base.find(matchCpf);
    if (fromSnapshot) return fromSnapshot;
    if (Array.isArray(window.DK_BANCO_CADASTRO?.clientes)) {
      const fromBanco = window.DK_BANCO_CADASTRO.clientes.find(matchCpf);
      if (fromBanco) return fromBanco;
    }
    return null;
  }

  function portalHasClienteCadastroValue(value) {
    const text = String(value ?? "").trim();
    if (!text) return false;
    if (/^x+$/i.test(text.replace(/\s/g, ""))) return false;
    return true;
  }

  /** Rejeita placeholder legado «(Endereço do Cliente)» e máscaras XXXXX no contrato. */
  function portalEnderecoContratoValido(value) {
    const text = String(value ?? "").trim();
    if (!text) return false;
    if (/^x+$/i.test(text.replace(/[\s.,/-]/g, ""))) return false;
    const norm = text
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .replace(/\s+/g, " ");
    if (norm.includes("endereco do cliente")) return false;
    if (norm.includes("{endereco") || norm.includes("(endereco")) return false;
    if (norm === "endereco nao cadastrado") return false;
    return true;
  }

  function portalMergeClienteCadastroWithBundled(record, cpfDigits) {
    if (!record || !cpfDigits) return record;
    const bundled = getPortalBundledClienteByCpf(cpfDigits);
    if (!bundled) return record;
    const pick = (primary, fallback) =>
      portalHasClienteCadastroValue(primary) ? String(primary).trim() : String(fallback || "").trim();
    const pickEndereco = (primary, fallback) =>
      portalEnderecoContratoValido(primary)
        ? String(primary).trim()
        : portalEnderecoContratoValido(fallback)
          ? String(fallback).trim()
          : "";
    return {
      ...record,
      nome: pick(record.nome, bundled.nome),
      cep: pick(record.cep, bundled.cep),
      municipioUf: pick(record.municipioUf, bundled.municipioUf),
      endereco: pickEndereco(record.endereco, bundled.endereco),
    };
  }

  /** Cadastro completo (local + planilha embutida) — contrato, relatórios, formulários. */
  function getClienteByCpfAny(cpfDigits) {
    const d =
      typeof onlyDigits === "function"
        ? onlyDigits(String(cpfDigits || ""))
        : String(cpfDigits || "").replace(/\D/g, "");
    if (d.length !== 11) return null;
    const portalOnly =
      typeof findPortalClienteByCpf === "function" ? findPortalClienteByCpf(d) : null;
    if (portalOnly) return portalMergeClienteCadastroWithBundled(portalOnly, d);
    const local =
      typeof findClienteByCpfCadastro === "function" ? findClienteByCpfCadastro(d) : null;
    if (local) return portalMergeClienteCadastroWithBundled(local, d);
    const bundled = getPortalBundledClienteByCpf(d);
    if (bundled) return bundled;
    if (typeof clientesSeedData !== "undefined" && Array.isArray(clientesSeedData)) {
      const hit = clientesSeedData.find((c) => {
        const cpf =
          typeof onlyDigits === "function"
            ? onlyDigits(String(c.cpf || ""))
            : String(c.cpf || "").replace(/\D/g, "");
        return cpf === d;
      });
      if (hit) return portalMergeClienteCadastroWithBundled(hit, d);
    }
    return null;
  }

  window.__DK_getClienteByCpfAny = getClienteByCpfAny;
  window.__DK_portalEnderecoContratoValido = portalEnderecoContratoValido;

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
    if (typeof findPortalClienteByCpf === "function") {
      const portal = findPortalClienteByCpf(cpfDigits);
      if (portal) return portal;
    }
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

  function portalClienteCodigoRelatorioPreferido(cliente, cpfDigits, extraIdxByCpf) {
    const stored = String(cliente?.codigo || "").trim();
    if (stored) return stored;
    return resolvePortalClienteCodigoRelatorio(cpfDigits, extraIdxByCpf) || "—";
  }

  function portalClienteCodigoSortKey(codigoRaw) {
    const s = String(codigoRaw || "").trim();
    const mCliente = s.match(/^CLIENTE\s*(\d+)$/i);
    if (mCliente) return Number(mCliente[1]) || 0;
    const digits = s.replace(/\D/g, "");
    if (digits) return Number(digits) || 0;
    return Number.MAX_SAFE_INTEGER;
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
      if (show && portalRegistroEhTeste(localOnly)) {
        btn.textContent = "Apagar cliente (teste)";
        btn.title = "Cadastro de TESTE — remove cliente e protocolos de teste ligados.";
      } else {
        btn.textContent = "Apagar cliente";
        btn.title =
          "Só administrador (titular), só cadastro local e sem histórico de locação — o botão fica oculto se existir locação com este cliente";
      }
      if (show && !portalRegistroEhTeste(localOnly) && typeof clienteTemVinculoComLocacao === "function") {
        const nome = String(localOnly?.nome || inpNome?.value || "").trim();
        const codigo = String(document.getElementById("operacaoClienteCodigo")?.value || localOnly?.codigo || "").trim();
        if (clienteTemVinculoComLocacao(digits, nome, codigo)) show = false;
      }
      btn.classList.toggle("hidden", !show);
    }

    function setAtualizarButtonByCpf(cpfDigits) {
      const known = Boolean(getClienteByCpfAny(cpfDigits));
      const admin = isPortalTitularAdministrador();
      if (btnAtualizar) btnAtualizar.classList.toggle("hidden", !known || admin);
      const submitBtn = form?.querySelector('button[type="submit"]');
      if (submitBtn) {
        submitBtn.textContent =
          known && admin ? "Guardar alterações do cliente" : known && !admin ? "Guardar cliente" : "Guardar cliente";
      }
      refreshOperacaoClienteApagarBtn(cpfDigits);
      portalRefreshOperacaoClienteSenhaField(cpfDigits, getClienteByCpfAny(cpfDigits));
    }

    function persistOperacaoClienteAtualizacao(cpfDigits, fonte) {
      const msg = document.getElementById("operacaoClienteInlineMsg");
      const getVal = (id) => String(document.getElementById(id)?.value || "").trim();
      const nomeDigitado = getVal("operacaoClienteNome");
      const nomeFinal = nomeDigitado || String(fonte?.nome || "").trim();
      if (!nomeFinal) {
        if (msg) msg.textContent = "Informe o nome do cliente no campo NOME antes de guardar.";
        inpNome?.focus();
        return false;
      }
      const dataVal = getVal("operacaoClienteDataCadastro");
      const dataCadastroFinal = /^\d{2}\/\d{2}\/\d{4}$/.test(dataVal)
        ? dataVal
        : portalClienteDataLabelPreferido(fonte, cpfDigits, getPrimeiraLocacaoDateLabelByCpf) ||
          dataVal ||
          "08/05/2026";
      const canonCode = getPortalCanonicalClienteCodeByCpf(cpfDigits) || String(fonte?.codigo || "").trim();
      const codigoFinal = portalResolveClienteCodigoFromForm(canonCode);
      const existenteLocal =
        typeof findPortalClienteByCpf === "function"
          ? findPortalClienteByCpf(cpfDigits)
          : typeof findClienteByCpfCadastro === "function"
            ? findClienteByCpfCadastro(cpfDigits)
            : null;
      const payload = {
        id: existenteLocal?.id ?? Date.now(),
        createdAt: existenteLocal?.createdAt ?? Date.now(),
        codigo: codigoFinal,
        dataCadastro: dataCadastroFinal,
        cpf: cpfDigits,
        nome: nomeFinal,
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
        ambiente: PORTAL_AMBIENTE_REAL,
      };
      if (isPortalTitularAdministrador()) {
        const senhaVal = getVal("operacaoClienteSenha").replace(/\s*\(.*\)\s*$/, "");
        if (senhaVal) payload.senha = senhaVal;
        else if (existenteLocal?.senha) payload.senha = String(existenteLocal.senha).trim();
      } else if (existenteLocal?.senha) {
        payload.senha = String(existenteLocal.senha).trim();
      }
      const payloadPortal = { ...payload, origemPortal: true, updatedAt: Date.now() };
      if (typeof upsertPortalClienteByCpf === "function") {
        upsertPortalClienteByCpf(payloadPortal, existenteLocal?.status || fonte?.status || "ATIVO");
      } else if (typeof upsertClienteCadastroByCpf === "function") {
        upsertClienteCadastroByCpf(payloadPortal, existenteLocal?.status || fonte?.status || "ATIVO");
      } else {
        const clientes = loadCadastro(CAD_CLIENTES_KEY);
        const idx = clientes.findIndex((c) => onlyDigits(String(c.cpf || "")) === cpfDigits);
        if (idx === -1) clientes.push({ ...payload, id: Number(payload.id) || Date.now() });
        else clientes[idx] = { ...clientes[idx], ...payload };
        saveCadastro(CAD_CLIENTES_KEY, clientes);
      }
      portalPushCloudSnapshotAfterPersist();
      if (msg) msg.textContent = "Dados do cliente guardados com sucesso.";
      portalApplyAmbienteVisualForm("Cliente", payloadPortal);
      return true;
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
      if (typeof loadCadastro === "function" && typeof CAD_LOCACOES_KEY !== "undefined") {
        loadCadastro(CAD_LOCACOES_KEY).forEach((l) => {
          addRow({
            cpf: l.cpf,
            nome: l.nome,
            placa: l.placa,
          });
        });
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
        const dataPreferida = portalClienteDataLabelPreferido(cliente, d, getPrimeiraLocacaoDateLabelByCpf);
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
      if (isPortalTitularAdministrador()) {
        ["operacaoClienteCpf", "operacaoClienteNome", "operacaoClienteDataCadastro"].forEach((id) => {
          const el = document.getElementById(id);
          if (el) {
            el.readOnly = false;
            el.classList.remove("portal-input-immutable");
          }
        });
        refreshOperacaoClienteCodigoEditavel();
        return;
      }
      refreshOperacaoClienteCodigoEditavel();
      const codigo = document.getElementById("operacaoClienteCodigo");
      if (codigo) {
        if (fixed.codigo) codigo.value = fixed.codigo;
      }
      if (inpCpf) {
        inpCpf.readOnly = Boolean(known);
      }
      if (inpNome) {
        const nomeFix = String(fixed.nome || "").trim();
        inpNome.readOnly = Boolean(known && nomeFix);
        if (known && nomeFix) inpNome.value = nomeFix;
      }
      if (inpDataCadastro) {
        inpDataCadastro.readOnly = false;
        if (known && fixed.dataCadastro) inpDataCadastro.value = fixed.dataCadastro;
      }
      if (inpCpf && known && fixed.cpf && typeof formatCpf === "function") {
        inpCpf.value = formatCpf(fixed.cpf);
      }
      markImmutableInput("operacaoClienteCodigo", known);
      markImmutableInput("operacaoClienteNome", known);
      markImmutableInput("operacaoClienteDataCadastro", false);
    }

    function fillOperacaoClienteFormFromRecord(cliente) {
      if (!cliente) return;
      const get = (id) => document.getElementById(id);
      const cpfDigits = typeof onlyDigits === "function" ? onlyDigits(String(cliente.cpf || "")) : String(cliente.cpf || "").replace(/\D/g, "");
      if (inpCpf && cpfDigits.length === 11 && typeof formatCpf === "function") inpCpf.value = formatCpf(cpfDigits);
      if (inpNome) inpNome.value = String(cliente.nome || "").trim();
      const dataPreferida = portalClienteDataLabelPreferido(cliente, cpfDigits, getPrimeiraLocacaoDateLabelByCpf);
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
      normalizePortalMaskedFieldValues();
      portalApplyAmbienteVisualForm("Cliente", cliente);
      portalRefreshOperacaoClienteSenhaField(cpfDigits, cliente);
      refreshOperacaoClienteApagarBtn(cpfDigits);
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
        portalRefreshOperacaoClienteSenhaField("", null);
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
      const dataPreferida = portalClienteDataLabelPreferido(cliente, digits, getPrimeiraLocacaoDateLabelByCpf);
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
      if (!isPortalTitularAdministrador() && lastAlertedCpf !== digits) {
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
        if (isPortalTitularAdministrador()) {
          const changes = portalBuildAlteracoesLista(
            portalSnapshotClienteRecord(known, digits),
            portalCollectClienteFormPayload(digits),
            PORTAL_CLIENTE_DIFF_LABELS
          );
          portalConfirmarAlteracaoAdministrador(
            { titulo: "Confirmar alteração — cliente", changes },
            () => persistOperacaoClienteAtualizacao(digits, known)
          );
          return;
        }
        const localOnly =
          typeof findPortalClienteByCpf === "function"
            ? findPortalClienteByCpf(digits)
            : typeof findClienteByCpfCadastro === "function"
              ? findClienteByCpfCadastro(digits)
              : null;
        const dataLock =
          portalClienteDataLabelPreferido(known, digits, getPrimeiraLocacaoDateLabelByCpf) ||
          String(inpDataCadastro?.value || "").trim() ||
          (!localOnly ? "08/05/2026" : "");
        setAtualizarButtonByCpf(digits);
        lockImmutableClienteFields(true, {
          codigo: getPortalCanonicalClienteCodeByCpf(digits) || String(known.codigo || "").trim(),
          cpf: digits,
          nome: String(known.nome || "").trim(),
          dataCadastro: dataLock || String(inpDataCadastro?.value || "").trim() || "08/05/2026",
        });
        if (msg) {
          msg.textContent = localOnly
            ? "CPF já cadastrado. Não é permitido recadastrar este cliente; use o botão 'Atualizar dados do cliente'."
            : "Este CPF consta na base DK (folha embutida ou outro equipamento), mas ainda não está guardado neste navegador. Use «Atualizar dados do cliente» para gravar no cadastro local.";
        }
        return;
      }

      if (typeof loadCadastro !== "function" || typeof saveCadastro !== "function" || typeof CAD_CLIENTES_KEY === "undefined") {
        if (msg) msg.textContent = "Cadastro indisponível neste ambiente.";
        return;
      }

      const getVal = (id) => String(document.getElementById(id)?.value || "").trim();
      const nextCode = portalResolveClienteCodigoFromForm(getPortalNextClienteCode());
      const dataCadastro = getVal("operacaoClienteDataCadastro") || new Date().toLocaleDateString("pt-BR");
      const novo = {
        id: Date.now(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
        origemPortal: true,
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
        ambiente: PORTAL_AMBIENTE_REAL,
      };
      if (typeof upsertPortalClienteByCpf === "function") {
        try {
          upsertPortalClienteByCpf(novo, "ATIVO");
        } catch (err) {
          if (msg) msg.textContent = `Não foi possível guardar no navegador: ${err && err.message ? err.message : err}.`;
          console.error(err);
          return;
        }
      } else {
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
      }
      portalPushCloudSnapshotAfterPersist();
      const codigoEl = document.getElementById("operacaoClienteCodigo");
      if (codigoEl) codigoEl.value = nextCode;
      if (msg) {
        msg.textContent = `Cliente ${nextCode} cadastrado com sucesso.`;
      }
      portalApplyAmbienteVisualForm("Cliente", novo);
      portalRefreshOperacaoClienteSenhaField(digits, novo);
      refreshOperacaoClienteApagarBtn(digits);
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
      const fonte = getClienteByCpfAny(digits);
      if (!fonte) {
        if (msg) msg.textContent = "CPF não encontrado na base (cadastro local + folha DK).";
        return;
      }
      if (typeof loadCadastro !== "function" || typeof saveCadastro !== "function" || typeof CAD_CLIENTES_KEY === "undefined") {
        if (msg) msg.textContent = "Atualização indisponível neste ambiente.";
        return;
      }
      const doSave = () => {
        if (persistOperacaoClienteAtualizacao(digits, fonte)) {
          window.alert("Os dados que você alterou foram guardados.");
        }
      };
      const changes = portalBuildAlteracoesLista(
        portalSnapshotClienteRecord(fonte, digits),
        portalCollectClienteFormPayload(digits),
        PORTAL_CLIENTE_DIFF_LABELS
      );
      portalConfirmarAlteracaoAdministrador({ titulo: "Confirmar alteração — cliente", changes }, doSave);
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
      portalResetAmbienteForm("Cliente");
      portalRefreshOperacaoClienteSenhaField("", null);
      refreshOperacaoClienteApagarBtn("");
      inpCpf.focus();
      refreshOperacaoClienteCodigoEditavel();
    });

    refreshOperacaoClienteCodigoEditavel();

    document.getElementById("operacaoClienteSenhaResetBtn")?.addEventListener("click", (ev) => {
      ev.preventDefault();
      if (!isPortalTitularAdministrador()) return;
      const digits =
        typeof onlyDigits === "function"
          ? onlyDigits(inpCpf?.value || "")
          : String(inpCpf?.value || "").replace(/\D/g, "");
      if (digits.length !== 11) {
        if (msg) msg.textContent = "Informe o CPF completo do cliente para resetar a senha.";
        inpCpf?.focus();
        return;
      }
      const fonte = getClienteByCpfAny(digits);
      const nomeForm = String(inpNome?.value || "").trim();
      if (!fonte && !nomeForm) {
        if (msg) msg.textContent = "Informe o nome do cliente ou carregue um cadastro existente.";
        return;
      }
      if (
        !window.confirm(
          "Resetar a senha do app deste cliente para 123456?\n\nNo próximo login o app pedirá uma nova senha de 6 números."
        )
      ) {
        return;
      }
      const result = portalResetClienteSenhaApp(digits, fonte);
      if (!result.ok) {
        if (msg) msg.textContent = result.message || "Não foi possível resetar a senha.";
        return;
      }
      portalRefreshOperacaoClienteSenhaField(digits, getClienteByCpfAny(digits));
      if (msg) msg.textContent = "Senha resetada para 123456.";
    });

    document.getElementById("operacaoClienteApagarBtn")?.addEventListener("click", (ev) => {
      ev.preventDefault();
      if (!isPortalTitularAdministrador()) return;
      const digits =
        typeof onlyDigits === "function"
          ? onlyDigits(inpCpf?.value || "")
          : String(inpCpf?.value || "").replace(/\D/g, "");
      if (digits.length !== 11) {
        if (msg) msg.textContent = "Informe o CPF do cliente a apagar.";
        return;
      }
      const localOnly =
        typeof findClienteByCpfCadastro === "function" ? findClienteByCpfCadastro(digits) : null;
      if (!localOnly) {
        window.alert("Cliente não encontrado no cadastro local deste navegador.");
        return;
      }
      if (!portalRegistroEhTeste(localOnly)) {
        window.alert(
          "Cadastros REAIS não podem ser apagados. Marque como TESTE ao cadastrar ou use cancelamento/alteração."
        );
        return;
      }
      if (
        !window.confirm(
          "Apagar este cliente de TESTE e os protocolos de teste ligados a este CPF? Esta ação não pode ser desfeita."
        )
      ) {
        return;
      }
      const nLoc = portalApagarLocacoesTestePorCpf(digits);
      if (typeof removeClientesByCpf === "function") removeClientesByCpf([digits]);
      else if (typeof loadCadastro === "function" && typeof saveCadastro === "function") {
        const clientes = loadCadastro(CAD_CLIENTES_KEY).filter(
          (c) =>
            (typeof onlyDigits === "function" ? onlyDigits(String(c.cpf || "")) : String(c.cpf || "").replace(/\D/g, "")) !==
            digits
        );
        saveCadastro(CAD_CLIENTES_KEY, clientes);
      }
      portalPushCloudSnapshotAfterPersist();
      form?.reset();
      form?.querySelectorAll("input").forEach((inpEl) => {
        inpEl.value = "";
      });
      portalResetAmbienteForm("Cliente");
      refreshOperacaoClienteApagarBtn("");
      if (msg) {
        msg.textContent =
          nLoc > 0
            ? `Cliente de teste apagado (${nLoc} protocolo(s) de teste removido(s)).`
            : "Cliente de teste apagado.";
      }
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
    const totalLivre = portalLocacaoPlacasLivresCache.length;
    const qPlate =
      typeof normalizePlate === "function"
        ? normalizePlate(String(queryRaw || ""))
        : String(queryRaw || "")
            .toUpperCase()
            .replace(/[^A-Z0-9]/g, "");
    if (!items.length) {
      let msg;
      if (totalLivre === 0) {
        if (typeof seedVeiculosDatabaseIfNeeded === "function") seedVeiculosDatabaseIfNeeded();
        const nCad =
          typeof loadCadastro === "function" && typeof CAD_VEICULOS_KEY !== "undefined"
            ? loadCadastro(CAD_VEICULOS_KEY).filter((v) => {
                const pl =
                  typeof normalizePlate === "function"
                    ? normalizePlate(v.placa)
                    : String(v.placa || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
                return pl.length >= 7;
              }).length
            : 0;
        msg = !nCad
          ? "Não há veículos neste navegador. Use Cadastro de veículo ou Carregar da nuvem / importar backup."
          : `Há ${nCad} veículo(s) cadastrado(s), mas nenhum está livre (locação ativa ou manutenção). Finalize a locação aberta na placa.`;
      } else if (qPlate.length >= 3) {
        msg = `A placa ${qPlate} não está entre as ${totalLivre} livre(s). Apague o campo e clique de novo para ver a lista.`;
      } else {
        msg = `${totalLivre} veículo(s) livre(s): apague o filtro e abra a lista novamente.`;
      }
      panel.innerHTML = `<div class="portal-placa-dropdown__empty">${msg}</div>`;
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

  /** Placas já cadastradas (cadastro local) — lista ao digitar no formulário de veículo. */
  let portalVeiculoPlacasCache = [];

  function hideOperacaoVeiculoPlacaDropdown() {
    const panel = document.getElementById("operacaoVeiculoPlacaLista");
    const inp = document.getElementById("operacaoVeiculoPlaca");
    if (panel) {
      panel.classList.add("hidden");
      panel.hidden = true;
      panel.innerHTML = "";
    }
    if (inp) inp.setAttribute("aria-expanded", "false");
  }

  function refreshOperacaoVeiculoPlacasCache() {
    if (typeof seedVeiculosDatabaseIfNeeded === "function") seedVeiculosDatabaseIfNeeded();
    const byPlate = new Map();
    const add = (v) => {
      if (!v) return;
      const placa =
        typeof normalizePlate === "function"
          ? normalizePlate(String(v.placa || ""))
          : String(v.placa || "")
              .trim()
              .toUpperCase()
              .replace(/[^A-Z0-9]/g, "");
      if (!placa) return;
      const modelo = String(v.modelo || "").trim() || "Modelo não informado";
      const tag = String(v.tag || "").trim();
      const marca = String(v.marca || "").trim();
      if (!byPlate.has(placa)) {
        byPlate.set(placa, { placa, modelo, tag, marca, record: v });
      }
    };
    if (typeof loadAllVeiculosCadastro === "function") {
      loadAllVeiculosCadastro().forEach(add);
    } else if (typeof loadCadastro === "function" && typeof CAD_VEICULOS_KEY !== "undefined") {
      loadCadastro(CAD_VEICULOS_KEY).forEach(add);
    }
    portalVeiculoPlacasCache = Array.from(byPlate.values()).sort((a, b) => a.placa.localeCompare(b.placa, "pt-BR"));
    const dl = document.getElementById("operacaoVeiculoPlacaSugestoes");
    if (dl) {
      dl.innerHTML = portalVeiculoPlacasCache
        .map(
          (v) =>
            `<option value="${v.placa}" label="${portalEscapeHtml(v.modelo)}${v.tag ? ` · ${portalEscapeHtml(v.tag)}` : ""}"></option>`
        )
        .join("");
    }
  }

  function filterPlacasVeiculoForDropdown(queryRaw) {
    if (!portalVeiculoPlacasCache.length) return [];
    const trim = String(queryRaw || "").trim();
    if (!trim) return portalVeiculoPlacasCache.slice(0, 80);
    const qPlate =
      typeof normalizePlate === "function"
        ? normalizePlate(trim)
        : trim.toUpperCase().replace(/[^A-Z0-9]/g, "");
    const qNome =
      typeof normalizeName === "function" ? normalizeName(trim) : trim.toLowerCase();
    return portalVeiculoPlacasCache
      .filter((v) => {
        if (qPlate && v.placa.includes(qPlate)) return true;
        const modeloKey =
          typeof normalizeName === "function"
            ? normalizeName(v.modelo)
            : String(v.modelo || "").toLowerCase();
        const tagKey = String(v.tag || "").toLowerCase();
        return modeloKey.includes(qNome) || tagKey.includes(qNome);
      })
      .slice(0, 80);
  }

  function portalInferTipoVeiculoFromRecord(v) {
    const t = String(v?.tipo || "")
      .trim()
      .toUpperCase();
    if (t.includes("CARRO")) return "CARRO";
    if (t.includes("MOTO")) return "MOTO";
    const tag = String(v?.tag || "")
      .trim()
      .toUpperCase();
    if (tag.includes("DKCR")) return "CARRO";
    if (tag.includes("DKMT")) return "MOTO";
    return "";
  }

  function fillOperacaoVeiculoFormFromRecord(veiculo) {
    if (!veiculo) return;
    const getVal = (id) => document.getElementById(id);
    const set = (id, val) => {
      const el = getVal(id);
      if (el) el.value = String(val ?? "").trim();
    };
    const plate =
      typeof normalizePlate === "function"
        ? normalizePlate(String(veiculo.placa || ""))
        : String(veiculo.placa || "")
            .trim()
            .toUpperCase()
            .replace(/[^A-Z0-9]/g, "");
    set("operacaoVeiculoPlaca", plate);
    const tipo = portalInferTipoVeiculoFromRecord(veiculo);
    const tipoEl = document.getElementById("operacaoVeiculoTipo");
    if (tipoEl) tipoEl.value = tipo;
    set("operacaoVeiculoTag", veiculo.tag);
    set("operacaoVeiculoCodigo", veiculo.codigo);
    set("operacaoVeiculoMarca", veiculo.marca);
    set("operacaoVeiculoModelo", veiculo.modelo);
    set("operacaoVeiculoValor", veiculo.valor);
    set("operacaoVeiculoCor", veiculo.cor);
    set("operacaoVeiculoChassi", veiculo.chassi);
    set("operacaoVeiculoAnoModelo", veiculo.anoModelo);
    set("operacaoVeiculoRenavam", veiculo.renavam);
    set("operacaoVeiculoMotor", veiculo.motor);
    set("operacaoVeiculoProprietario", veiculo.proprietario);
    set("operacaoVeiculoLocal", veiculo.local);
    const msg = document.getElementById("operacaoVeiculoInlineMsg");
    if (msg) msg.textContent = plate ? `Dados do veículo ${plate} carregados.` : "";
    portalApplyAmbienteVisualForm("Veiculo", veiculo);
    refreshOperacaoVeiculoApagarBtn(plate);
  }

  function refreshOperacaoVeiculoApagarBtn(plateRaw) {
    const btn = document.getElementById("operacaoVeiculoApagarBtn");
    if (!btn) return;
    const plate =
      typeof normalizePlate === "function"
        ? normalizePlate(String(plateRaw || ""))
        : String(plateRaw || "")
            .trim()
            .toUpperCase()
            .replace(/[^A-Z0-9]/g, "");
    let record = null;
    if (plate && typeof findPortalVeiculoByPlaca === "function") record = findPortalVeiculoByPlaca(plate);
    const show = Boolean(isPortalTitularAdministrador() && record && portalRegistroEhTeste(record));
    btn.classList.toggle("hidden", !show);
  }

  function renderOperacaoVeiculoPlacaDropdown(queryRaw) {
    const panel = document.getElementById("operacaoVeiculoPlacaLista");
    const inp = document.getElementById("operacaoVeiculoPlaca");
    if (!panel || !inp) return;
    const items = filterPlacasVeiculoForDropdown(queryRaw);
    if (!items.length) {
      panel.innerHTML =
        '<div class="portal-placa-dropdown__empty">Nenhuma placa cadastrada com esse texto. Continue a digitar para cadastrar uma placa nova.</div>';
    } else {
      panel.innerHTML = items
        .map((v) => {
          const extra = [v.tag, v.marca].filter(Boolean).join(" · ");
          return `<button type="button" class="portal-placa-dropdown__opt" role="option" tabindex="-1" data-placa="${v.placa}">
              <span class="portal-placa-dropdown__plate">${v.placa}</span>
              <span class="portal-placa-dropdown__model">${portalEscapeHtml(v.modelo)}${extra ? ` · ${portalEscapeHtml(extra)}` : ""}</span>
            </button>`;
        })
        .join("");
    }
    panel.classList.remove("hidden");
    panel.hidden = false;
    inp.setAttribute("aria-expanded", "true");
  }

  function bindOperacaoVeiculoPlacaAssist() {
    const inpPlaca = document.getElementById("operacaoVeiculoPlaca");
    const panelPlaca = document.getElementById("operacaoVeiculoPlacaLista");
    const comboPlaca = document.getElementById("operacaoVeiculoPlacaCombo");
    if (!inpPlaca || !panelPlaca) return;

    inpPlaca.addEventListener("focus", () => {
      refreshOperacaoVeiculoPlacasCache();
      renderOperacaoVeiculoPlacaDropdown(String(inpPlaca.value || ""));
    });

    inpPlaca.addEventListener("input", () => {
      inpPlaca.value = portalSanitizePlacaInput(inpPlaca.value);
      renderOperacaoVeiculoPlacaDropdown(inpPlaca.value);
    });

    inpPlaca.addEventListener("blur", () => {
      const raw = String(inpPlaca.value || "").trim();
      if (!raw) return;
      const norm = portalResolvePlacaCadastro(raw);
      const digitado = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
      if (norm && portalPlacaMercosulOk(norm) && norm !== digitado) {
        inpPlaca.value = norm;
      }
    });

    inpPlaca.addEventListener("keydown", (e) => {
      if (e.key === "Escape") hideOperacaoVeiculoPlacaDropdown();
    });

    panelPlaca.addEventListener("mousedown", (e) => {
      if (e.target.closest(".portal-placa-dropdown__opt")) e.preventDefault();
    });

    panelPlaca.addEventListener("click", (e) => {
      const btn = e.target.closest(".portal-placa-dropdown__opt");
      if (!btn) return;
      const placa = String(btn.getAttribute("data-placa") || "").trim();
      if (!placa) return;
      inpPlaca.value = placa;
      const hit = portalVeiculoPlacasCache.find((x) => x.placa === placa);
      if (hit?.record) fillOperacaoVeiculoFormFromRecord(hit.record);
      hideOperacaoVeiculoPlacaDropdown();
      inpPlaca.focus();
    });

    document.addEventListener(
      "click",
      (e) => {
        if (!comboPlaca || panelPlaca.classList.contains("hidden")) return;
        if (comboPlaca.contains(e.target)) return;
        hideOperacaoVeiculoPlacaDropdown();
      },
      true
    );

    inpPlaca.addEventListener("focusout", (e) => {
      const rt = e.relatedTarget;
      if (rt && comboPlaca && comboPlaca.contains(rt)) return;
      window.setTimeout(() => {
        if (!comboPlaca || !document.activeElement || !comboPlaca.contains(document.activeElement)) {
          hideOperacaoVeiculoPlacaDropdown();
        }
      }, 180);
    });
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
    hidePortalPdfShareMenu();
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

  function portalLocacaoTemDataFim(locacao) {
    const fim = String(locacao?.fim || "").trim();
    if (!fim || fim === "—" || fim === "-") return false;
    if (typeof parseBrDate === "function") {
      const dt = parseBrDate(fim);
      if (dt && !Number.isNaN(dt.getTime())) return true;
    }
    return /^\d{2}\/\d{2}\/\d{4}$/.test(fim);
  }

  function isPortalLocacaoFinalizada(locacao) {
    const nk =
      typeof normalizeKey === "function" ? normalizeKey : (v) => String(v || "").trim().toUpperCase();
    if (portalLocacaoTemDataFim(locacao)) return true;
    const s = nk(String(locacao.statusLocacao || locacao.status || ""));
    if (!s) return false;
    if (s === "ATIVO" || s === "ATIVA") return false;
    return s.includes("FINALIZ") || s.includes("INATIVO") || s === "INATIVA";
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

  /** Ordem crescente do número de protocolo (relatórios PDF/Excel de locações). */
  function comparePortalProtocoloAsc(a, b) {
    const pa = String(a?.numeroContrato ?? a?.protocolo ?? "").replace(/\W/g, "");
    const pb = String(b?.numeroContrato ?? b?.protocolo ?? "").replace(/\W/g, "");
    const na = /^\d+$/.test(pa) ? Number(pa) : NaN;
    const nb = /^\d+$/.test(pb) ? Number(pb) : NaN;
    if (Number.isFinite(na) && Number.isFinite(nb) && na !== nb) return na - nb;
    if (Number.isFinite(na) && !Number.isFinite(nb)) return -1;
    if (!Number.isFinite(na) && Number.isFinite(nb)) return 1;
    const cmp = pa.localeCompare(pb, "pt-BR", { numeric: true, sensitivity: "base" });
    if (cmp !== 0) return cmp;
    return String(a?.placa || "").localeCompare(String(b?.placa || ""), "pt-BR");
  }

  function sortPortalLocacoesPorProtocoloAsc(records) {
    if (!Array.isArray(records)) return [];
    return records.slice().sort(comparePortalProtocoloAsc);
  }

  /** Contexto do relatório aberto no modal (cliente/veículo/locação). */
  let portalRelatorioAtual = null;

  function openPortalRelatorioModal(context) {
    const modal = document.getElementById("portalRelatorioModal");
    const card = modal?.querySelector(".portal-modal__card");
    const titulo = document.getElementById("portalRelatorioTitulo");
    const resumo = document.getElementById("portalRelatorioResumo");
    const preview = document.getElementById("portalRelatorioPreview");
    const fonteData = document.getElementById("portalRelatorioFonteData");
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
    } else if (context.fileSlug === "veiculos" && context.stats) {
      const tot = (context.stats.inativos || 0) + (context.stats.ativos || 0);
      resumo.textContent = tot
        ? `Inativos: ${context.stats.inativos} · Locados: ${context.stats.ativos}. Lista abaixo; exportar em PDF ou Excel.`
        : "Nenhum veículo neste navegador. Use Guardar veículo, Carregar da nuvem ou importar backup JSON.";
    } else {
      resumo.textContent = `${context.rows.length} registro(s) pronto(s) para exportar em PDF ou Excel.`;
    }
    if (preview) {
      if (context.previewHtml) {
        preview.innerHTML = context.previewHtml;
        preview.classList.remove("hidden");
        card?.classList.add("portal-modal__card--relatorio-preview");
        if (fonteData) fonteData.classList.add("hidden");
      } else {
        preview.innerHTML = "";
        preview.classList.add("hidden");
        card?.classList.remove("portal-modal__card--relatorio-preview");
        if (fonteData) fonteData.classList.remove("hidden");
      }
    }
    modal.classList.remove("hidden");
    modal.setAttribute("aria-hidden", "false");
  }

  function closePortalRelatorioModal() {
    const modal = document.getElementById("portalRelatorioModal");
    const preview = document.getElementById("portalRelatorioPreview");
    const card = modal?.querySelector(".portal-modal__card");
    const fonteData = document.getElementById("portalRelatorioFonteData");
    if (!modal) return;
    modal.classList.add("hidden");
    modal.setAttribute("aria-hidden", "true");
    if (preview) {
      preview.innerHTML = "";
      preview.classList.add("hidden");
    }
    card?.classList.remove("portal-modal__card--relatorio-preview");
    if (fonteData) fonteData.classList.remove("hidden");
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
    const compact = Boolean(reportOptions.compactTable);
    const bodyFs = compact ? "10px" : "12px";
    const cellFs = compact ? "9px" : "inherit";
    const cellPad = compact ? "3px 4px" : "5px 7px";
    const tableClass = compact ? ' class="portal-rel-table-compact"' : "";
    return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><title>${eh(title)}</title><style>
      body{font-family:system-ui,-apple-system,sans-serif;margin:1.2rem;color:#111;font-size:${bodyFs}}
      h1{font-size:1.05rem;margin:0 0 0.35rem}
      .meta{color:#444;margin:0.2rem 0;font-size:11px}
      table{width:100%;border-collapse:collapse;table-layout:fixed}
      th,td{border:1px solid #333;padding:${cellPad};text-align:left;font-size:${cellFs};word-wrap:break-word;vertical-align:top}
      th{background:#eee;font-weight:600}
      .portal-rel-table-compact th,.portal-rel-table-compact td{line-height:1.25}
      .portal-rel-status-ativo{background:#c8e6c9}
      .portal-rel-status-inativo{background:#fff9c4}
      ${compact ? "@media print{@page{size:landscape;margin:8mm}body{margin:0.5rem}}" : ""}
    </style></head><body>
      <h1>${eh(title)}</h1>
      ${extraMeta}
      <p class="meta">Emitido em ${eh(quando)} · ${eh(String(rows.length))} registro(s)${metaAtivosSuffix}</p>
      <table${tableClass}><thead><tr>${headCells}</tr></thead><tbody>${bodyCells || `<tr><td colspan="${headers.length}">${eh(
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
            compactTable: context.compactTable,
          });
    html = applyPortalPdfDocumentTitle(html, getPortalRelatorioPdfSaveSuggestedBaseName(context));
    hideRelatorioLocacaoPdfViewer();
    window.__DK_portalPdfShareMeta = context.shareMeta || {
      title: context.title || "Relatório DK Locadora",
      bodyText: "",
      fileBaseName: getPortalRelatorioPdfSaveSuggestedBaseName(context),
    };
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    portalLocacaoRelatorioPdfBlobUrl = URL.createObjectURL(blob);
    iframe.src = portalLocacaoRelatorioPdfBlobUrl;
    iframe.onload = function wireRelatorioPdfComprovanteLinks() {
      iframe.onload = null;
      try {
        const doc = iframe.contentDocument;
        if (!doc) return;
        const wireRelatorioPdfClick = (ev) => {
          const inv = ev.target.closest?.(".btn-invalidate-pagamento[data-dk-inv-pagamento-id]");
          if (inv) {
            ev.preventDefault();
            const cid = inv.getAttribute("data-dk-inv-pagamento-id");
            if (!cid) return;
            if (!window.confirm("Invalidar este pagamento? Deixa de contar no protocolo e no relatório.")) return;
            inv.disabled = true;
            Promise.resolve(invalidarPagamentoAppClientePorComprovanteId(cid))
              .then((r) => {
                if (r?.ok) refreshPortalRelatorioAberto();
                else {
                  window.alert(r?.msg || "Não foi possível invalidar.");
                  inv.disabled = false;
                }
              })
              .catch(() => {
                inv.disabled = false;
              });
            return;
          }
          const el = ev.target.closest?.(".lnk-comprovante[data-dk-comprovante-id]");
          if (!el) return;
          ev.preventDefault();
          const id = el.getAttribute("data-dk-comprovante-id");
          if (id && typeof window.__DK_openComprovanteClienteViewerById === "function") {
            window.__DK_openComprovanteClienteViewerById(id);
          }
        };
        doc.addEventListener("click", wireRelatorioPdfClick);
      } catch {
        /* blob iframe — script inline no HTML trata o clique */
      }
    };
    viewer.classList.remove("hidden");
    viewer.setAttribute("aria-hidden", "false");
    portalSyncAdminBannerLayout();
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
        x.recado1,
        x.recado2,
        x.cnh,
        x.categoria,
        x.vencimento,
        x.ear,
        x.cep,
        x.municipioUf,
        x.endereco,
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
      const cpfA =
        typeof onlyDigits === "function" ? onlyDigits(String(a.cpf || "")) : String(a.cpf || "").replace(/\D/g, "");
      const cpfB =
        typeof onlyDigits === "function" ? onlyDigits(String(b.cpf || "")) : String(b.cpf || "").replace(/\D/g, "");
      const codA = portalClienteCodigoRelatorioPreferido(a, cpfA, extraIdxByCpf);
      const codB = portalClienteCodigoRelatorioPreferido(b, cpfB, extraIdxByCpf);
      const na = portalClienteCodigoSortKey(codA);
      const nb = portalClienteCodigoSortKey(codB);
      if (na !== nb) return na - nb;
      return String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR");
    });
    const headers = [
      "Cód.",
      "Data do Cadastro",
      "CPF",
      "Cliente",
      "Nº do Celular",
      "Recados 01",
      "Recados 02",
      "Nº da CNH-e",
      "Categoria",
      "Vencimento",
      "EAR?",
      "Cep",
      "Município/UF",
      "Endereço",
    ];
    const fmtCpf = typeof formatCpf === "function" ? formatCpf : (v) => String(v || "");
    const rows = rowsRaw.map((c) => {
      const cpfDigits =
        typeof onlyDigits === "function"
          ? onlyDigits(String(c.cpf || ""))
          : String(c.cpf || "").replace(/\D/g, "");
      const codigoRel = portalClienteCodigoRelatorioPreferido(c, cpfDigits, extraIdxByCpf);
      return [
        codigoRel,
        String(c.dataCadastro || "").trim() || "—",
        cpfDigits.length === 11 ? fmtCpf(cpfDigits) : String(c.cpf || "").trim() || "—",
        String(c.nome || "").trim() || "—",
        String(c.celular || "").trim() || "—",
        String(c.recado1 || "").trim() || "—",
        String(c.recado2 || "").trim() || "—",
        String(c.cnh || "").trim() || "—",
        String(c.categoria || "").trim() || "—",
        String(c.vencimento || "").trim() || "—",
        String(c.ear || "").trim() || "—",
        String(c.cep || "").trim() || "—",
        String(c.municipioUf || "").trim() || "—",
        String(c.endereco || "").trim() || "—",
      ];
    });
    const reportOpts = { compactTable: true, textColumns: [0, 2] };
    const previewHtml = buildPortalRelatorioHtml(
      "Relatório de clientes — lista unificada",
      headers,
      rows,
      reportOpts
    )
      .replace(/^[\s\S]*?<body>/i, "")
      .replace(/<\/body>[\s\S]*$/i, "");
    return {
      title: "Relatório de clientes — lista unificada",
      headers,
      rows,
      fileSlug: "clientes",
      textColumns: [0, 2],
      compactTable: true,
      previewHtml,
      buildPdfHtml: () =>
        buildPortalRelatorioHtml("Relatório de clientes — lista unificada", headers, rows, reportOpts),
    };
  }

  function portalVeiculoGrupoCarroMoto(v) {
    const nk =
      typeof normalizeKey === "function" ? normalizeKey : (x) => String(x || "").trim().toUpperCase();
    const tipo = nk(String(v?.tipo || ""));
    const tag = nk(String(v?.tag || ""));
    if (tipo.includes("CARRO") || tag.includes("DKCR")) return "carro";
    if (tipo.includes("MOTO") || tag.includes("DKMT")) return "moto";
    return "outro";
  }

  function portalVeiculoTagSortKey(tagRaw) {
    const t = String(tagRaw || "")
      .trim()
      .toUpperCase()
      .replace(/\s*-\s*/g, "");
    const m = t.match(/^(DKCR|DKMT)(\d+)$/);
    if (m) return { grupo: m[1] === "DKCR" ? 0 : 1, num: parseInt(m[2], 10) || 0, raw: t };
    return { grupo: 2, num: 0, raw: t };
  }

  function portalVeiculoCodigoSortKey(veiculo) {
    const raw = String(veiculo?.codigo || veiculo?.tag || "")
      .trim()
      .toUpperCase()
      .replace(/\s+/g, "");
    const m = raw.match(/^([A-Z]+)(\d+)$/);
    if (m) {
      return { prefix: m[1], num: parseInt(m[2], 10) || 0, raw };
    }
    const m2 = raw.match(/^([A-Z]*?)(\d+)$/);
    if (m2) {
      return { prefix: m2[1] || raw, num: parseInt(m2[2], 10) || 0, raw };
    }
    return { prefix: raw, num: 0, raw };
  }

  /** DKCA001, DKCA002… depois DKMT001… (prefixo + número). */
  function portalCompareVeiculoPorCodigo(a, b) {
    const ka = portalVeiculoCodigoSortKey(a);
    const kb = portalVeiculoCodigoSortKey(b);
    const cmpPrefix = ka.prefix.localeCompare(kb.prefix, "pt-BR");
    if (cmpPrefix !== 0) return cmpPrefix;
    if (ka.num !== kb.num) return ka.num - kb.num;
    return ka.raw.localeCompare(kb.raw, "pt-BR");
  }

  function portalCompareVeiculoResumoFrota(a, b) {
    const da = getPortalResumoVeiculoCardData(a);
    const db = getPortalResumoVeiculoCardData(b);
    const locA = da.statusClass === "locado" ? 0 : 1;
    const locB = db.statusClass === "locado" ? 0 : 1;
    if (locA !== locB) return locA - locB;
    return portalCompareVeiculoPorCodigo(a, b);
  }

  function portalCompareVeiculoPorTag(a, b) {
    const ka = portalVeiculoTagSortKey(a.tag);
    const kb = portalVeiculoTagSortKey(b.tag);
    if (ka.grupo !== kb.grupo) return ka.grupo - kb.grupo;
    if (ka.num !== kb.num) return ka.num - kb.num;
    return ka.raw.localeCompare(kb.raw, "pt-BR");
  }

  function portalSortVeiculosCarrosDepoisMotos(list) {
    const carros = [];
    const motos = [];
    const outros = [];
    (list || []).forEach((v) => {
      const g = portalVeiculoGrupoCarroMoto(v);
      if (g === "carro") carros.push(v);
      else if (g === "moto") motos.push(v);
      else outros.push(v);
    });
    carros.sort(portalCompareVeiculoPorTag);
    motos.sort(portalCompareVeiculoPorTag);
    outros.sort(portalCompareVeiculoPorTag);
    return { carros, motos, outros };
  }

  function getPortalPlacasEmManutencaoSet() {
    const set = new Set();
    if (typeof loadCadastro !== "function" || typeof CAD_MANUTENCOES_KEY === "undefined") return set;
    loadCadastro(CAD_MANUTENCOES_KEY)
      .filter((m) => !String(m.dataRealSaida || "").trim())
      .forEach((m) => {
        const pl =
          typeof normalizePlate === "function"
            ? normalizePlate(m.placa)
            : String(m.placa || "")
                .toUpperCase()
                .replace(/[^A-Z0-9]/g, "");
        if (pl) set.add(pl);
      });
    return set;
  }

  function getPortalLocacaoAtivaDetalhePorPlaca(plateKey) {
    if (!plateKey) return null;
    if (typeof loadCadastro === "function" && typeof CAD_LOCACOES_KEY !== "undefined") {
      const locacoes = loadCadastro(CAD_LOCACOES_KEY).filter((l) => {
        const pl =
          typeof normalizePlate === "function"
            ? normalizePlate(l.placa)
            : String(l.placa || "")
                .toUpperCase()
                .replace(/[^A-Z0-9]/g, "");
        return pl === plateKey && !String(l.fim || "").trim();
      });
      if (locacoes.length) {
        locacoes.sort(
          (a, b) => Number(b.createdAt || b.id || 0) - Number(a.createdAt || a.id || 0)
        );
        return locacoes[0];
      }
    }
    if (typeof buildLatestReceita2026RowByPlateMap === "function") {
      const hit = buildLatestReceita2026RowByPlateMap().get(plateKey);
      if (hit?.row && !String(hit.row.fim || "").trim()) {
        return {
          cpf: hit.row.cpf,
          nome: hit.row.nome,
          placa: plateKey,
          kmInicial: hit.row.kmInicial || "",
          numeroContrato: hit.row.numeroContrato || hit.row.protocolo || "",
        };
      }
    }
    return null;
  }

  function getPortalUltimoKmPorPlaca(plateKey) {
    if (!plateKey) return "—";
    let best = -1;
    const consider = (raw) => {
      const n = parseInt(String(raw || "").replace(/\D/g, ""), 10);
      if (!Number.isFinite(n) || n < 0) return;
      if (n > best) best = n;
    };
    if (typeof loadCadastro === "function" && typeof CAD_LOCACOES_KEY !== "undefined") {
      loadCadastro(CAD_LOCACOES_KEY)
        .filter((l) => {
          const pl =
            typeof normalizePlate === "function"
              ? normalizePlate(l.placa)
              : String(l.placa || "")
                  .toUpperCase()
                  .replace(/[^A-Z0-9]/g, "");
          return pl === plateKey;
        })
        .forEach((l) => consider(l.kmInicial));
    }
    if (typeof buildLatestReceita2026RowByPlateMap === "function") {
      const hit = buildLatestReceita2026RowByPlateMap().get(plateKey);
      if (hit?.row) consider(hit.row.kmInicial);
    }
    const ativa = getPortalLocacaoAtivaDetalhePorPlaca(plateKey);
    if (ativa?.kmInicial) consider(ativa.kmInicial);
    if (best < 0) return "—";
    return `${best.toLocaleString("pt-BR")} km`;
  }

  function getPortalResumoVeiculoCardData(veiculo) {
    const plateKey =
      typeof normalizePlate === "function"
        ? normalizePlate(veiculo?.placa)
        : String(veiculo?.placa || "")
            .toUpperCase()
            .replace(/[^A-Z0-9]/g, "");
    const activeSet =
      typeof getActivePlatesSet === "function" ? getActivePlatesSet() : new Set();
    const manutencaoSet = getPortalPlacasEmManutencaoSet();
    const nk =
      typeof normalizeKey === "function" ? normalizeKey : (x) => String(x || "").trim().toUpperCase();
    const indisponivel = nk(veiculo?.status).includes("INDISPONIVEL");
    const locado = Boolean(plateKey && activeSet.has(plateKey));
    const emManutencao = Boolean(plateKey && manutencaoSet.has(plateKey));

    let cliente = "—";
    let statusText = "Disponível";
    if (locado) {
      const loc = getPortalLocacaoAtivaDetalhePorPlaca(plateKey);
      const cpf =
        typeof onlyDigits === "function"
          ? onlyDigits(String(loc?.cpf || ""))
          : String(loc?.cpf || "").replace(/\D/g, "");
      let nome = String(loc?.nome || "").trim();
      if (cpf.length === 11 && typeof findClienteByCpfCadastro === "function") {
        const cli = findClienteByCpfCadastro(cpf);
        if (cli?.nome) nome = String(cli.nome).trim();
      }
      cliente = nome || "Cliente cadastrado";
      statusText = "Em locação";
    } else if (emManutencao) {
      cliente = "—";
      statusText = "Em manutenção";
    } else if (indisponivel) {
      cliente = "—";
      statusText = "Indisponível";
    } else {
      cliente = "Disponível";
      statusText = "Disponível";
    }

    const codigo =
      String(veiculo?.codigo || "").trim() || String(veiculo?.tag || "").trim() || "—";

    return {
      codigo,
      placa: plateKey || "—",
      ultimoKm: getPortalUltimoKmPorPlaca(plateKey),
      cliente,
      statusText,
      statusClass: locado ? "locado" : "livre",
      record: veiculo,
    };
  }

  function renderOperacaoVeiculoResumoFrota() {
    const grid = document.getElementById("operacaoVeiculoResumoGrid");
    if (!grid) return;
    refreshOperacaoVeiculoPlacasCache();
    const veiculos = portalVeiculoPlacasCache.map((x) => x.record).filter(Boolean);
    veiculos.sort(portalCompareVeiculoResumoFrota);

    if (!veiculos.length) {
      grid.innerHTML =
        '<p class="subtext" role="listitem">Nenhum veículo cadastrado neste navegador.</p>';
      return;
    }

    const eh = typeof escapeHtml === "function" ? escapeHtml : portalEscapeHtml;
    grid.innerHTML = veiculos
      .map((v) => {
        const d = getPortalResumoVeiculoCardData(v);
        const testeCls = portalRegistroEhTeste(v) ? " operacao-veiculo-resumo-card--teste" : "";
        return `<button type="button" class="operacao-veiculo-resumo-card operacao-veiculo-resumo-card--${eh(
          d.statusClass
        )}${testeCls}" role="listitem" data-placa="${eh(d.placa)}">
          <p class="operacao-veiculo-resumo-card__linha"><strong>Código:</strong> ${eh(d.codigo)}</p>
          <p class="operacao-veiculo-resumo-card__linha"><strong>Placa:</strong> ${eh(d.placa)}</p>
          <p class="operacao-veiculo-resumo-card__linha"><strong>Último km:</strong> ${eh(d.ultimoKm)}</p>
          <p class="operacao-veiculo-resumo-card__linha"><strong>Cliente:</strong> ${eh(d.cliente)}</p>
          <p class="operacao-veiculo-resumo-card__status operacao-veiculo-resumo-card__status--${eh(
            d.statusClass
          )}">${eh(d.statusText)}</p>
        </button>`;
      })
      .join("");

    grid.querySelectorAll(".operacao-veiculo-resumo-card[data-placa]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const placa = btn.getAttribute("data-placa");
        if (!placa || placa === "—") return;
        const hit = portalVeiculoPlacasCache.find((x) => x.placa === placa);
        if (hit?.record) fillOperacaoVeiculoFormFromRecord(hit.record);
      });
    });
  }

  function getPortalProtocoloAtivoPorPlaca(plateKey) {
    if (!plateKey) return "";
    const ncNorm = (v) =>
      typeof normalizeNumeroContratoKey === "function"
        ? String(normalizeNumeroContratoKey(v || "")).replace(/\s+/g, "")
        : String(v ?? "")
            .trim()
            .toUpperCase()
            .replace(/\s+/g, "");
    let found = "";
    if (typeof loadCadastro === "function" && typeof CAD_LOCACOES_KEY !== "undefined") {
      loadCadastro(CAD_LOCACOES_KEY).forEach((l) => {
        const pl =
          typeof normalizePlate === "function"
            ? normalizePlate(l.placa)
            : String(l.placa || "")
                .toUpperCase()
                .replace(/[^A-Z0-9]/g, "");
        if (pl !== plateKey || String(l.fim || "").trim()) return;
        const nc = ncNorm(l.numeroContrato);
        if (nc) found = nc;
      });
    }
    if (found) return found;
    if (typeof buildLatestReceita2026RowByPlateMap === "function") {
      const hit = buildLatestReceita2026RowByPlateMap().get(plateKey);
      if (hit?.row && !String(hit.row.fim || "").trim()) {
        const nc = ncNorm(hit.row.numeroContrato || hit.row.protocolo);
        if (nc) return nc;
      }
    }
    return found;
  }

  function portalVeiculoRowRelatorio(v, opts = {}) {
    const ativo = Boolean(opts.ativo);
    const placa =
      typeof normalizePlate === "function"
        ? normalizePlate(v.placa)
        : String(v.placa || "")
            .trim()
            .toUpperCase();
    const protocolo = ativo ? getPortalProtocoloAtivoPorPlaca(placa) || "—" : "—";
    return [
      String(v.tag || "").trim() || "—",
      placa || "—",
      String(v.tipo || "").trim() || portalVeiculoGrupoCarroMoto(v).toUpperCase(),
      String(v.marca || "").trim() || "—",
      String(v.modelo || "").trim() || "—",
      protocolo,
      String(v.anoModelo || "").trim() || "—",
      String(v.cor || "").trim() || "—",
    ];
  }

  function portalLoadVeiculosFrotaCadastro() {
    if (
      typeof window.__DK_invalidateCadastroParseCache === "function" &&
      typeof CAD_VEICULOS_KEY !== "undefined"
    ) {
      window.__DK_invalidateCadastroParseCache(CAD_VEICULOS_KEY);
    }
    if (typeof loadPortalVeiculosCadastro === "function") return loadPortalVeiculosCadastro();
    if (typeof loadCadastro === "function" && typeof CAD_VEICULOS_KEY !== "undefined") {
      return loadCadastro(CAD_VEICULOS_KEY).filter(
        (v) => v?.origemPortal || v?.portalManual
      );
    }
    return [];
  }

  function portalLoadFrotaPlanilhaVeiculos() {
    if (typeof loadFrotaVeiculosPlanilha === "function") return loadFrotaVeiculosPlanilha();
    if (typeof window.__DK_loadFrotaVeiculosPlanilha === "function") {
      return window.__DK_loadFrotaVeiculosPlanilha();
    }
    if (typeof window.__DK_ensureVeiculosCadastroPopulated === "function") {
      return window.__DK_ensureVeiculosCadastroPopulated();
    }
    return [];
  }

  function portalBundledFinanceiroPlateSet() {
    const set = new Set();
    if (typeof VEICULOS_DK_FINANCEIRO_2026 === "undefined" || !Array.isArray(VEICULOS_DK_FINANCEIRO_2026)) {
      return set;
    }
    const plateNorm = (p) =>
      typeof normalizePlate === "function"
        ? normalizePlate(p)
        : String(p || "")
            .toUpperCase()
            .replace(/[^A-Z0-9]/g, "");
    VEICULOS_DK_FINANCEIRO_2026.forEach((row) => {
      const pl = plateNorm(row.placa);
      if (pl) set.add(pl);
    });
    return set;
  }

  function portalVeiculoEhCadastroPortal(v) {
    if (!v || typeof v !== "object") return false;
    return Boolean(v.origemPortal || v.portalManual);
  }

  function portalCountVeiculosGrupos(grupos) {
    if (!grupos) return 0;
    if (grupos.carros || grupos.motos || grupos.outros) {
      return (grupos.carros?.length || 0) + (grupos.motos?.length || 0) + (grupos.outros?.length || 0);
    }
    const portal = grupos.portal || {};
    const frota = grupos.frota || {};
    return portalCountVeiculosGrupos(portal) + portalCountVeiculosGrupos(frota);
  }

  function buildPortalRelatorioVeiculoFrotaSections() {
    /* Cada veículo aparece UMA só vez: ou em «locados» (placa com protocolo ativo) ou em «inativos». */
    const activePlates =
      typeof getActivePlatesSet === "function" ? getActivePlatesSet() : new Set();
    const plateOf = (v) =>
      typeof normalizePlate === "function"
        ? normalizePlate(v.placa)
        : String(v.placa || "")
            .toUpperCase()
            .replace(/[^A-Z0-9]/g, "");
    const buckets = {
      inativos: { portal: [], frota: [] },
      ativos: { portal: [], frota: [] },
    };
    const vistos = new Set();
    const add = (v, origem) => {
      const pl = plateOf(v);
      const tag = String(v.tag || "").trim();
      if (!pl && !tag) return;
      const chave = pl || `TAG:${tag.toUpperCase()}`;
      if (vistos.has(chave)) return;
      vistos.add(chave);
      const bloco = pl && activePlates.has(pl) ? buckets.ativos : buckets.inativos;
      bloco[origem].push(v);
    };
    portalLoadVeiculosFrotaCadastro().forEach((v) => add(v, "portal"));
    portalLoadFrotaPlanilhaVeiculos().forEach((v) => add(v, "frota"));
    return {
      inativos: {
        portal: portalSortVeiculosCarrosDepoisMotos(buckets.inativos.portal),
        frota: portalSortVeiculosCarrosDepoisMotos(buckets.inativos.frota),
      },
      ativos: {
        portal: portalSortVeiculosCarrosDepoisMotos(buckets.ativos.portal),
        frota: portalSortVeiculosCarrosDepoisMotos(buckets.ativos.frota),
      },
    };
  }
  window.__DK_portalRelatorioVeiculosSections = buildPortalRelatorioVeiculoFrotaSections;

  function buildPortalRelatorioVeiculosTableHtml(headers, veiculos, rowClass) {
    const eh = typeof escapeHtml === "function" ? escapeHtml : portalEscapeHtml;
    if (!veiculos.length) {
      return `<p class="portal-relatorio-veiculos-vazio">Nenhum veículo neste grupo.</p>`;
    }
    const head = headers.map((h) => `<th>${eh(h)}</th>`).join("");
    const body = veiculos
      .map((v) => {
        const cells = portalVeiculoRowRelatorio(v, { ativo: rowClass === "portal-rel-veic-ativo" })
          .map((c) => `<td>${eh(c)}</td>`)
          .join("");
        return `<tr class="${rowClass}">${cells}</tr>`;
      })
      .join("");
    return `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
  }

  function buildPortalRelatorioVeiculosGrupoTipoHtml(tituloGrupo, grupos, headers, rowClass) {
    const eh = typeof escapeHtml === "function" ? escapeHtml : portalEscapeHtml;
    const carros = grupos.carros || [];
    const motos = grupos.motos || [];
    const outros = grupos.outros || [];
    if (!carros.length && !motos.length && !outros.length) return "";
    let html = `<div class="portal-relatorio-veiculos-grupo"><h3>${eh(tituloGrupo)}</h3>`;
    html += `<h4>Carros</h4>${buildPortalRelatorioVeiculosTableHtml(headers, carros, rowClass)}`;
    html += `<h4>Motos</h4>${buildPortalRelatorioVeiculosTableHtml(headers, motos, rowClass)}`;
    if (outros.length) {
      html += `<h4>Outros</h4>${buildPortalRelatorioVeiculosTableHtml(headers, outros, rowClass)}`;
    }
    html += `</div>`;
    return html;
  }

  function portalForEachVeiculoEmBlocoRelatorio(bloco, fn) {
    ["portal", "frota"].forEach((origem) => {
      const grupos = bloco[origem] || {};
      ["carros", "motos", "outros"].forEach((k) => {
        (grupos[k] || []).forEach((v) => fn(v));
      });
    });
  }

  function buildPortalRelatorioVeiculosBlocoHtml(tituloBloco, bloco, headers, rowClass) {
    const eh = typeof escapeHtml === "function" ? escapeHtml : portalEscapeHtml;
    const portal = bloco.portal || { carros: [], motos: [], outros: [] };
    const frota = bloco.frota || { carros: [], motos: [], outros: [] };
    let html = `<section class="portal-relatorio-veiculos-bloco"><h2>${eh(tituloBloco)}</h2>`;
    const portalHtml = buildPortalRelatorioVeiculosGrupoTipoHtml(
      "Cadastros do portal",
      portal,
      headers,
      rowClass
    );
    if (portalHtml) html += portalHtml;
    html += buildPortalRelatorioVeiculosGrupoTipoHtml("Frota cadastrada", frota, headers, rowClass);
    html += `</section>`;
    return html;
  }

  function buildPortalRelatorioVeiculosFrotaDocumentInner(headers, sections) {
    const inativos = sections.inativos;
    const ativos = sections.ativos;
    const nInativos = portalCountVeiculosGrupos(inativos);
    const nAtivos = portalCountVeiculosGrupos(ativos);
    return (
      buildPortalRelatorioVeiculosBlocoHtml(
        "Veículos inativos (sem protocolo ativo)",
        inativos,
        headers,
        "portal-rel-veic-inativo"
      ) +
      '<hr class="portal-relatorio-veiculos-spacer" />' +
      buildPortalRelatorioVeiculosBlocoHtml(
        "Veículos locados (com protocolo ativo)",
        ativos,
        headers,
        "portal-rel-veic-ativo"
      )
    );
  }

  function getPortalRelatorioVeiculoContext() {
    const headers = ["Tag", "Placa", "Tipo", "Marca", "Modelo", "Protocolo", "Ano/Modelo", "Cor"];
    const sections = buildPortalRelatorioVeiculoFrotaSections();
    const nInativos = portalCountVeiculosGrupos(sections.inativos);
    const nAtivos = portalCountVeiculosGrupos(sections.ativos);
    const allRows = [];
    portalForEachVeiculoEmBlocoRelatorio(sections.inativos, (v) =>
      allRows.push(portalVeiculoRowRelatorio(v, { ativo: false }))
    );
    portalForEachVeiculoEmBlocoRelatorio(sections.ativos, (v) =>
      allRows.push(portalVeiculoRowRelatorio(v, { ativo: true }))
    );
    const previewHtml = `<div class="portal-relatorio-veiculos-bloco">${buildPortalRelatorioVeiculosFrotaDocumentInner(
      headers,
      sections
    )}</div>`;
    const eh = typeof escapeHtml === "function" ? escapeHtml : portalEscapeHtml;
    const quando = new Date().toLocaleString("pt-BR");
    return {
      title: "Relatório da frota — inativos e locados",
      headers,
      rows: allRows,
      fileSlug: "veiculos",
      textColumns: [0, 1, 5],
      stats: { inativos: nInativos, ativos: nAtivos },
      previewHtml,
      buildPdfHtml: () => {
        const freshSections = buildPortalRelatorioVeiculoFrotaSections();
        const inner = buildPortalRelatorioVeiculosFrotaDocumentInner(headers, freshSections);
        const nIn = portalCountVeiculosGrupos(freshSections.inativos);
        const nAt = portalCountVeiculosGrupos(freshSections.ativos);
        return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><title>Relatório frota veículos</title><style>
      body{font-family:system-ui,-apple-system,sans-serif;margin:1.2rem;color:#111;font-size:12px}
      h1{font-size:1.05rem;margin:0 0 0.35rem}
      .meta{color:#444;margin:0 0 0.75rem;font-size:11px}
      h2{font-size:0.95rem;margin:0.85rem 0 0.4rem;color:#333}
      h3{font-size:0.82rem;margin:0.55rem 0 0.3rem;color:#555}
      table{width:100%;border-collapse:collapse;margin-bottom:0.35rem}
      th,td{border:1px solid #333;padding:5px 7px;text-align:left}
      th{background:#eee;font-weight:600}
      .portal-relatorio-veiculos-spacer{border:0;border-top:2px dashed #888;margin:1.25rem 0;height:0}
      tr.portal-rel-veic-inativo td{background:#fff9c4}
      tr.portal-rel-veic-ativo td{background:#c8e6c9}
      .portal-relatorio-veiculos-vazio{font-style:italic;color:#666}
    </style></head><body>
      <h1>Relatório da frota — veículos por tag</h1>
      <p class="meta">Emitido em ${eh(quando)} · Inativos: ${eh(String(nIn))} · Locados: ${eh(String(nAt))}</p>
      ${inner}
    </body></html>`;
      },
      buildExcelHtml: () => {
        const eh = typeof escapeHtml === "function" ? escapeHtml : portalEscapeHtml;
        const freshSections = buildPortalRelatorioVeiculoFrotaSections();
        const rowToTr = (v, ativo) => {
          const cells = portalVeiculoRowRelatorio(v, { ativo })
            .map((c) => `<td>${eh(c)}</td>`)
            .join("");
          return `<tr>${cells}</tr>`;
        };
        const blockRows = (bloco, ativo) => {
          let out = "";
          const appendGrupo = (titulo, grupos) => {
            const carros = grupos.carros || [];
            const motos = grupos.motos || [];
            const outros = grupos.outros || [];
            if (!carros.length && !motos.length && !outros.length) return;
            out += `<tr><td colspan="${headers.length}" style="font-weight:bold;background:#e8e8e8">${eh(titulo)}</td></tr>`;
            ["carros", "motos", "outros"].forEach((k) => {
              const list = k === "carros" ? carros : k === "motos" ? motos : outros;
              if (!list.length) return;
              const label = k === "carros" ? "Carros" : k === "motos" ? "Motos" : "Outros";
              out += `<tr><td colspan="${headers.length}" style="font-weight:bold;background:#f0f0f0">${eh(label)}</td></tr>`;
              list.forEach((v) => {
                out += rowToTr(v, ativo);
              });
            });
          };
          appendGrupo("Cadastro no portal", bloco.portal || {});
          appendGrupo("Frota cadastrada", bloco.frota || {});
          return out;
        };
        const head = headers.map((h) => `<th>${eh(h)}</th>`).join("");
        return `<table border="1">
          <tr><td colspan="${headers.length}" style="font-weight:bold;font-size:14px">Veículos inativos (sem protocolo ativo)</td></tr>
          <tr>${head}</tr>
          ${blockRows(freshSections.inativos, false)}
          <tr><td colspan="${headers.length}"></td></tr>
          <tr><td colspan="${headers.length}" style="font-weight:bold;font-size:14px">Veículos locados (protocolo ativo)</td></tr>
          <tr>${head}</tr>
          ${blockRows(freshSections.ativos, true)}
        </table>`;
      },
    };
  }

  function getPortalRelatorioLocacaoContext() {
    const rowsRaw = sortPortalLocacoesPorProtocoloAsc(
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
          const payload = { title: "Recibo de pagamento", text: texto };
          const file = window.__dkUltimoComprovanteShareFile;
          if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
            payload.files = [file];
          }
          await navigator.share(payload);
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

  function portalNormProtoRelatorio(nc) {
    return String(nc || "")
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "");
  }

  function portalFormatIsoRelatorio(iso) {
    const raw = String(iso || "").trim();
    if (!raw) return "—";
    try {
      const d = new Date(raw);
      if (Number.isNaN(d.getTime())) return "—";
      return d.toLocaleString("pt-BR");
    } catch {
      return "—";
    }
  }

  function loadComprovantesClienteParaRelatorio() {
    try {
      const raw = localStorage.getItem("dk_comprovantes_cliente_pendentes");
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  }

  function salvarComprovantesClienteParaRelatorio(arr) {
    try {
      localStorage.setItem("dk_comprovantes_cliente_pendentes", JSON.stringify(arr));
      if (typeof window.__DK_comprovantesClienteInvalidateCache === "function") {
        window.__DK_comprovantesClienteInvalidateCache();
      }
    } catch (e) {
      console.warn("[DK portal] salvar comprovantes relatório", e);
    }
  }

  function comprovantePagamentoInvalidadoPorId(comprovanteId) {
    const id = String(comprovanteId || "").trim();
    if (!id) return false;
    const hit = loadComprovantesClienteParaRelatorio().find((r) => String(r.id || "").trim() === id);
    return Boolean(hit?.pagamentoInvalidado);
  }

  function isLancamentoAluguelContabilizavel(lan) {
    if (!lan || typeof lan !== "object") return false;
    if (lan.pagamentoInvalidado) return false;
    const oid = String(lan.origemComprovanteClienteId || "").trim();
    if (oid && comprovantePagamentoInvalidadoPorId(oid)) return false;
    return true;
  }

  /** Lançamentos que entram em totais, resumo e tabela «Pagamentos» do relatório. */
  function getPortalLancamentosAluguelContabilizaveisDoContrato(loc) {
    return getPortalLancamentosAluguelDoContrato(loc).filter(isLancamentoAluguelContabilizavel);
  }

  /** Pagamentos confirmados via app cliente (comprovante + validação DK). */
  function collectPagamentosValidadosAppClientePorProtocolo(cpfDig, protoRaw, lancs) {
    const digFn =
      typeof onlyDigits === "function" ? onlyDigits : (s) => String(s ?? "").replace(/\D/g, "");
    const cpf = digFn(cpfDig).slice(0, 11);
    const proto = portalNormProtoRelatorio(protoRaw);
    const map = new Map();

    for (const r of loadComprovantesClienteParaRelatorio()) {
      if (digFn(r.cpf) !== cpf) continue;
      if (portalNormProtoRelatorio(r.protocolo) !== proto) continue;
      if (String(r.status || "") !== "confirmado") continue;
      const id = String(r.id || "").trim();
      const invalidado = Boolean(r.pagamentoInvalidado);
      map.set(id || `cc_${r.confirmadoEm}`, {
        enviadoEm: r.enviadoEm,
        confirmadoEm: r.confirmadoEm,
        validadoPorNome: String(r.confirmadoPorNome || "").trim() || "—",
        valor: Number(r.valorRegistadoProtocolo ?? r.valor ?? 0),
        arquivoUrl: String(r.arquivoBase64 || "").trim(),
        nomeArquivo: String(r.nomeArquivo || "comprovante").trim(),
        comprovanteId: id,
        invalidado,
        invalidadoPor: String(r.pagamentoInvalidadoPor || "").trim(),
      });
    }

    for (const lan of lancs || []) {
      if (!lan?.confirmadoViaAppCliente) continue;
      if (!isLancamentoAluguelContabilizavel(lan)) continue;
      const id = String(lan.origemComprovanteClienteId || "").trim();
      if (id && map.has(id)) continue;
      const ex = id ? loadComprovantesClienteParaRelatorio().find((x) => x.id === id) : null;
      const invalidado = Boolean(ex?.pagamentoInvalidado || lan.pagamentoInvalidado);
      const key = id || `lan_${lan.createdAt || lan.data}`;
      map.set(key, {
        enviadoEm: lan.comprovanteClienteEnviadoEm || ex?.enviadoEm || "",
        confirmadoEm: lan.comprovanteClienteConfirmadoEm || ex?.confirmadoEm || "",
        validadoPorNome:
          String(lan.comprovanteValidadoPorNome || lan.registradoPorNome || ex?.confirmadoPorNome || "").trim() ||
          "—",
        valor: Number(lan.valor ?? ex?.valorRegistadoProtocolo ?? ex?.valor ?? 0),
        arquivoUrl: ex?.arquivoBase64 ? String(ex.arquivoBase64).trim() : "",
        nomeArquivo: String(ex?.nomeArquivo || "").trim(),
        comprovanteId: id,
        invalidado,
        invalidadoPor: String(ex?.pagamentoInvalidadoPor || "").trim(),
      });
    }

    return Array.from(map.values())
      .filter((x) => Number.isFinite(x.valor) && x.valor > 0)
      .sort((a, b) => {
        const ai = a.invalidado ? 1 : 0;
        const bi = b.invalidado ? 1 : 0;
        if (ai !== bi) return ai - bi;
        return Date.parse(b.confirmadoEm || 0) - Date.parse(a.confirmadoEm || 0);
      });
  }

  function buildPortalRelatorioValidadosAppClienteHtml(validados, eh, opts) {
    if (!validados.length) {
      return `<p class="meta portal-validados-vazio">${eh("Nenhum pagamento validado pelo app cliente neste protocolo.")}</p>`;
    }
    const showInvalidate = Boolean(opts && opts.showInvalidateBtn);
    let html = `<p class="sum-title">${eh("Pagamentos validados (app cliente)")}</p>`;
    html += `<table class="validados-app"><thead><tr>
      <th>${eh("Envio pelo cliente")}</th>
      <th>${eh("Validação DK")}</th>
      <th>${eh("Funcionário DK")}</th>
      <th>${eh("Valor pago")}</th>`;
    if (showInvalidate) html += `<th>${eh("Ações")}</th>`;
    html += `</tr></thead><tbody>`;
    for (const v of validados) {
      const inv = Boolean(v.invalidado);
      const rowCls = inv
        ? ' class="validados-app-row--invalidado"'
        : ' class="validados-app-row--ativo"';
      const vf =
        typeof currencyBRL === "function"
          ? currencyBRL(v.valor)
          : Number(v.valor || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
      let valorCell = eh(vf);
      const compId = String(v.comprovanteId || "").trim();
      const lnkCls = inv ? "lnk-comprovante lnk-comprovante--invalidado" : "lnk-comprovante";
      if (compId) {
        valorCell = `<button type="button" class="${lnkCls}" data-dk-comprovante-id="${eh(compId)}" title="${eh(v.nomeArquivo || "Comprovante")}">${eh(vf)} — ${eh("Ver comprovante")}</button>`;
      }
      html += `<tr${rowCls}>
        <td>${eh(portalFormatIsoRelatorio(v.enviadoEm))}</td>
        <td>${eh(portalFormatIsoRelatorio(v.confirmadoEm))}</td>
        <td>${eh(v.validadoPorNome)}</td>
        <td>${valorCell}</td>`;
      if (showInvalidate) {
        let acaoCell = `<span class="meta">—</span>`;
        if (inv) {
          acaoCell = `<span class="validados-app-invalidado-label">Invalidado</span>`;
        } else if (compId) {
          acaoCell = `<button type="button" class="btn-invalidate-pagamento" data-dk-inv-pagamento-id="${eh(compId)}">Invalidar pagamento</button>`;
        }
        html += `<td>${acaoCell}</td>`;
      }
      html += `</tr>`;
    }
    html += "</tbody></table>";
    return html;
  }

  async function portalRemoverLancamentoComprovanteClienteId(comprovanteId, recOpt) {
    const id = String(comprovanteId || "").trim();
    if (!id) return { ok: false };
    const digFn =
      typeof onlyDigits === "function" ? onlyDigits : (s) => String(s ?? "").replace(/\D/g, "");
    let rec = recOpt;
    if (!rec) {
      try {
        const raw = localStorage.getItem("dk_comprovantes_cliente_pendentes");
        const arr = raw ? JSON.parse(raw) : [];
        rec = (Array.isArray(arr) ? arr : []).find((r) => String(r.id || "").trim() === id);
      } catch {
        rec = null;
      }
    }
    if (!rec) return { ok: false, msg: "Comprovante não encontrado." };
    const cpfDigits = digFn(rec.cpf).slice(0, 11);
    const proto = portalNormProtoRelatorio(rec.protocolo);
    if (
      cpfDigits.length !== 11 ||
      !proto ||
      typeof loadCadastro !== "function" ||
      typeof saveCadastro !== "function" ||
      typeof CAD_LOCACOES_KEY === "undefined"
    ) {
      return { ok: false, msg: "Contrato não localizado." };
    }
    const locs = loadCadastro(CAD_LOCACOES_KEY);
    const lidx = locs.findIndex(
      (l) =>
        digFn(l.cpf).slice(0, 11) === cpfDigits && portalNormProtoRelatorio(l.numeroContrato) === proto
    );
    if (lidx < 0) return { ok: false, msg: "Locação não encontrada." };
    const loc = locs[lidx];
    materializarPortalLancamentosAluguelMutaveisNoLoc(loc);
    loc.portalLancamentosAluguel = (loc.portalLancamentosAluguel || []).filter(
      (lan) => String(lan.origemComprovanteClienteId || "").trim() !== id
    );
    finalizarPersistPortalLancamentosLoc(locs, loc, cpfDigits, proto);
    return { ok: true, protocolo: proto };
  }

  async function invalidarPagamentoAppClientePorComprovanteId(comprovanteId) {
    if (typeof window.__DK_invalidarPagamentoAppCliente === "function") {
      const fn = window.__DK_invalidarPagamentoAppCliente;
      if (fn !== invalidarPagamentoAppClientePorComprovanteId) {
        const res = await fn(comprovanteId);
        refreshPortalRelatorioAberto();
        return res;
      }
    }
    return { ok: false, msg: "Invalidação indisponível — atualize a página (Ctrl+F5)." };
  }

  function refreshPortalRelatorioAberto() {
    if (!portalRelatorioAtual) return;
    const slug = portalRelatorioAtual.fileSlug;
    if (slug === "relatorio-cliente-protocolos" && portalRelatorioAtual.relatorioClienteCpfDigits) {
      const ctx = getPortalRelatorioClienteProtocolosContext(portalRelatorioAtual.relatorioClienteCpfDigits);
      portalRelatorioAtual = ctx;
      emitPortalRelatorioPdf(ctx);
      return;
    }
    if (slug === "relatorio-placa-protocolos" && portalRelatorioAtual.relatorioPlacaNorm) {
      const ctx = getPortalRelatorioPlacaProtocolosContext(portalRelatorioAtual.relatorioPlacaNorm);
      portalRelatorioAtual = ctx;
      emitPortalRelatorioPdf(ctx);
    }
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

    const locs = sortPortalLocacoesPorProtocoloAsc(collectPortalLocacoesComProtocoloByCpf(dig));
    const sections = locs.map((loc) => {
      const proto = String(loc.numeroContrato || "").trim() || "—";
      const lancs = getPortalLancamentosAluguelContabilizaveisDoContrato(loc)
        .slice()
        .sort((a, b) => {
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
        validados: collectPagamentosValidadosAppClientePorProtocolo(dig, proto, lancs),
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

    const locs = sortPortalLocacoesPorProtocoloAsc(collectPortalLocacoesComProtocoloByPlaca(norm));
    const sections = locs.map((loc) => {
      const proto = String(loc.numeroContrato || "").trim() || "—";
      const lancs = getPortalLancamentosAluguelContabilizaveisDoContrato(loc).slice().sort((a, b) => {
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
    const raw = sortPortalLocacoesPorProtocoloAsc(getPortalMotosLocacaoDataset(escopo));
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
    portalSyncAdminBannerLayout();
  }

  function emitPortalRelatorioLocacaoExcel(escopo) {
    if (typeof downloadStyledExcel !== "function") {
      const msg = document.getElementById("operacaoLocacaoInlineMsg");
      if (msg) msg.textContent = "Exportação Excel indisponível neste ambiente.";
      return;
    }
    const label = escopo === "ativas" ? "Locações ativas (motos)" : "Locações finalizadas (motos)";
    const raw = sortPortalLocacoesPorProtocoloAsc(getPortalMotosLocacaoDataset(escopo));
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

  function hidePortalPdfShareMenu() {
    const menu = document.getElementById("portalPdfPartilharMenu");
    const btn = document.getElementById("portalPdfPartilharBtn");
    menu?.classList.add("hidden");
    btn?.setAttribute("aria-expanded", "false");
  }

  function getPortalPdfShareText() {
    const meta = window.__DK_portalPdfShareMeta;
    if (meta?.bodyText) return String(meta.bodyText).trim();
    try {
      const iframe = document.getElementById("portalPdfIframe");
      return String(iframe?.contentDocument?.body?.innerText || "").trim().slice(0, 4500);
    } catch {
      return "";
    }
  }

  document.getElementById("portalPdfPartilharBtn")?.addEventListener("click", () => {
    const menu = document.getElementById("portalPdfPartilharMenu");
    const btn = document.getElementById("portalPdfPartilharBtn");
    if (!menu) return;
    const abrir = menu.classList.contains("hidden");
    if (abrir) {
      menu.classList.remove("hidden");
      btn?.setAttribute("aria-expanded", "true");
    } else {
      hidePortalPdfShareMenu();
    }
  });

  document.getElementById("portalPdfPartilharEmailBtn")?.addEventListener("click", () => {
    const meta = window.__DK_portalPdfShareMeta || {};
    const titulo = String(meta.title || "Relatório DK Locadora").trim();
    const corpo =
      getPortalPdfShareText() +
      "\n\n(Guarde o PDF com «Imprimir ou guardar PDF» e anexe ao e-mail se necessário.)";
    window.location.href = `mailto:?subject=${encodeURIComponent(titulo)}&body=${encodeURIComponent(corpo)}`;
    hidePortalPdfShareMenu();
  });

  document.getElementById("portalPdfPartilharWhatsAppBtn")?.addEventListener("click", () => {
    const meta = window.__DK_portalPdfShareMeta || {};
    const titulo = String(meta.title || "Relatório DK Locadora").trim();
    const texto =
      `${titulo}\n\n${getPortalPdfShareText()}\n\n` +
      "Guarde o PDF com «Imprimir ou guardar PDF» e envie o ficheiro no WhatsApp.";
    window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, "_blank", "noopener");
    hidePortalPdfShareMenu();
  });

  document.addEventListener("click", (e) => {
    const wrap = document.querySelector(".portal-pdf-viewer__share-wrap");
    if (!wrap || wrap.contains(e.target)) return;
    hidePortalPdfShareMenu();
  });

  document.getElementById("portalPdfImprimirBtn")?.addEventListener("click", () => {
    const iframe = document.getElementById("portalPdfIframe");
    try {
      iframe?.contentWindow?.focus();
      iframe?.contentWindow?.print();
    } catch {
      /* ignore */
    }
  });

  /** Submenus visíveis em «Lançamento de aluguel» — reactivar comprovante/validacao/relatorios quando necessário. */
  const OPERACAO_LANC_ALUGUEL_SUB_ATIVOS = new Set(["avulso"]);

  const OPERACAO_LANC_ALUGUEL_SUB_IDS = {
    avulso: "operacaoLancAluguelPaneAvulso",
    comprovante: "operacaoLancAluguelPaneComprovante",
    validacao: "operacaoLancAluguelPaneValidacao",
    relatorios: "operacaoLancAluguelPaneRelatorios",
  };

  const OPERACAO_LANC_ALUGUEL_SUB_LEADS = {
    avulso:
      "Pesquise o contrato, confirme e registe data + valor. Use «Lançamento em bloco» para o relatório em calendário (2025, 2026…).",
    comprovante:
      "2 — Com comprovante: pesquise o contrato, cole o comprovante; a IA valida destino DK e o operador confirma.",
    validacao:
      "3 — App cliente: comprovantes enviados pelo telemóvel do cliente — IA, conferência e devolução com motivo.",
    relatorios: "Relatórios por período, por cliente (CPF) ou por placa.",
  };

  let operacaoLancAluguelSubAtivo = "avulso";

  function operacaoLancAluguelSubPermitido(sub) {
    return OPERACAO_LANC_ALUGUEL_SUB_ATIVOS.has(String(sub || "").trim());
  }

  function operacaoLancAluguelSubnavTemMultiplos() {
    return OPERACAO_LANC_ALUGUEL_SUB_ATIVOS.size > 1;
  }

  function syncOperacaoLancAluguelSubnavItemsVisibility() {
    [
      "btn-lanc-aluguel-avulso",
      "btn-lanc-aluguel-comprovante",
      "btn-lanc-aluguel-validacao",
      "btn-lanc-aluguel-relatorios",
    ].forEach((id) => {
      const b = document.getElementById(id);
      if (!b) return;
      const sub = b.getAttribute("data-lanc-aluguel-sub") || "";
      const show = operacaoLancAluguelSubPermitido(sub);
      b.classList.toggle("hidden", !show);
      b.toggleAttribute("hidden", !show);
      b.setAttribute("aria-hidden", show ? "false" : "true");
      b.tabIndex = show ? 0 : -1;
      b.disabled = !show;
    });
  }

  function syncOperacaoLancAluguelSubnavVisible(visible) {
    const nav = document.getElementById("operacaoLancAluguelSubnav");
    if (!nav) return;
    const show = Boolean(visible) && operacaoLancAluguelSubnavTemMultiplos();
    nav.classList.toggle("hidden", !visible);
    if (visible) nav.removeAttribute("hidden");
    else nav.setAttribute("hidden", "");
  }

  function operacaoLancAluguelProtocoloAtual() {
    const sel = document.getElementById("operacaoLancAluguelProtocoloSelect");
    const dig =
      typeof onlyDigits === "function" ? onlyDigits : (s) => String(s ?? "").replace(/\D/g, "");
    let nc = normPortalNumeroContrato(String(sel?.value || "").trim());
    let cpf = dig(String(document.getElementById("operacaoLancAluguelCpf")?.value || "")).slice(0, 11);
    if ((!nc || cpf.length !== 11) && operacaoLancAluguelPesquisaConfirmada) {
      if (!nc) nc = operacaoLancAluguelPesquisaConfirmada.nc;
      if (cpf.length !== 11) cpf = operacaoLancAluguelPesquisaConfirmada.cpf;
    }
    if (!nc) {
      nc = normPortalNumeroContrato(
        String(document.getElementById("operacaoLancAluguelProtocoloBusca")?.value || "").trim()
      );
    }
    return { nc, cpf };
  }

  function syncPortalOperadorComprovanteSection() {
    const sec = document.getElementById("portalOperadorComprovanteSection");
    if (!sec) return;
    const refVis = !document.getElementById("operacaoLancAluguelReferenciaPanel")?.classList.contains("hidden");
    const show = operacaoLancAluguelSubAtivo === "comprovante" && refVis && Boolean(operacaoLancAluguelProtocoloAtual().nc);
    sec.classList.toggle("hidden", !show);
    if (show) sec.removeAttribute("hidden");
    else sec.setAttribute("hidden", "");
  }

  function syncOperacaoLancAluguelSubButtons(activeSub) {
    const sub = OPERACAO_LANC_ALUGUEL_SUB_IDS[activeSub] ? activeSub : "avulso";
    operacaoLancAluguelSubAtivo = sub;
    [
      "btn-lanc-aluguel-avulso",
      "btn-lanc-aluguel-comprovante",
      "btn-lanc-aluguel-validacao",
      "btn-lanc-aluguel-relatorios",
    ].forEach((id) => {
      const b = document.getElementById(id);
      if (!b) return;
      const on = b.getAttribute("data-lanc-aluguel-sub") === sub;
      b.classList.toggle("is-active", on);
      b.setAttribute("aria-expanded", on ? "true" : "false");
    });
    const main = document.getElementById("btn-operacao-lancamento-aluguel");
    if (main) {
      const aluguelAberto = !document
        .getElementById("operacaoInlineLancamentoAluguel")
        ?.classList.contains("hidden");
      main.classList.toggle("is-active", aluguelAberto);
      main.setAttribute("aria-expanded", aluguelAberto ? "true" : "false");
    }
  }

  function showOperacaoLancAluguelSub(subRaw) {
    let sub = OPERACAO_LANC_ALUGUEL_SUB_IDS[subRaw] ? subRaw : "avulso";
    if (!operacaoLancAluguelSubPermitido(sub)) sub = "avulso";
    operacaoLancAluguelSubAtivo = sub;
    for (const [key, paneId] of Object.entries(OPERACAO_LANC_ALUGUEL_SUB_IDS)) {
      const pane = document.getElementById(paneId);
      if (pane) pane.classList.toggle("hidden", key !== sub);
    }
    const blocoPesquisa = document.getElementById("operacaoLancAluguelBlocoPesquisaRef");
    const showPesquisa = sub === "avulso" || sub === "comprovante";
    if (blocoPesquisa) {
      blocoPesquisa.classList.toggle("hidden", !showPesquisa);
      if (showPesquisa) blocoPesquisa.removeAttribute("hidden");
      else blocoPesquisa.setAttribute("hidden", "");
    }
    const pagPanel = document.getElementById("operacaoLancAluguelPagamentoPanel");
    if (pagPanel && sub !== "avulso") {
      pagPanel.classList.add("hidden");
      pagPanel.setAttribute("hidden", "");
    }
    const hist = document.getElementById("operacaoLancAluguelHistorico");
    const trava = document.getElementById("operacaoLancAluguelTravaAviso");
    if (hist) hist.classList.toggle("hidden", sub !== "avulso");
    if (trava) trava.classList.toggle("hidden", sub !== "avulso");
    syncPortalOperadorComprovanteSection();
    const lead = document.getElementById("operacao-lanc-aluguel-subtitulo");
    if (lead) lead.textContent = OPERACAO_LANC_ALUGUEL_SUB_LEADS[sub] || OPERACAO_LANC_ALUGUEL_SUB_LEADS.avulso;
    syncOperacaoLancAluguelSubButtons(sub);
    if (sub === "validacao") {
      if (typeof window.__DK_refreshComprovantesClienteLista === "function") {
        window.__DK_refreshComprovantesClienteLista();
      }
    }
    if (sub === "comprovante") {
      if (typeof window.__DK_bindOperadorPortalComprovanteUi === "function") {
        window.__DK_bindOperadorPortalComprovanteUi();
      }
      if (typeof window.__DK_refreshComprovantesOperadorLista === "function") {
        window.__DK_refreshComprovantesOperadorLista();
      }
    }
  }

  function openOperacaoLancamentoAluguel(subRaw) {
    const pedido = subRaw || operacaoLancAluguelSubAtivo || "avulso";
    const sub = operacaoLancAluguelSubPermitido(pedido) ? pedido : "avulso";
    hideOperacaoInlineFormsCore();
    syncOperacaoLancAluguelSubnavVisible(true);
    document.getElementById("operacaoInlineLancamentoAluguel")?.classList.remove("hidden");
    setOperacaoFormPlaceholderVisible(false);
    showOperacaoLancAluguelSub(sub);
    syncOperacaoCadastroButtons("btn-operacao-lancamento-aluguel");
    if (sub === "avulso" || sub === "comprovante") {
      refreshOperacaoLancAluguelPesquisaDatalists();
    } else {
      hideOperacaoLancAluguelDetalhePanels();
    }
    syncOperacaoLancamentoAluguelAfterCpfEdit();
    refreshOperacaoLancAluguelAdminControlsVisibility();
    portalRefreshOperacaoDeferred(["aluguel", "rel"]);
  }

  function hideOperacaoInlineFormsCore() {
    hideOperacaoLocacaoPlacaDropdown();
    hideOperacaoVeiculoPlacaDropdown();
    portalWaHideAllDropdowns();
    resetOperacaoLocacaoRelatorioPanel();
    document.getElementById("operacaoInlineWhatsApp")?.classList.add("hidden");
    document.getElementById("operacaoInlineCliente")?.classList.add("hidden");
    document.getElementById("operacaoInlineVeiculo")?.classList.add("hidden");
    document.getElementById("operacaoInlineLocacao")?.classList.add("hidden");
    document.getElementById("operacaoInlineLancamentoAluguel")?.classList.add("hidden");
    document.getElementById("operacaoInlineLancamentoMultas")?.classList.add("hidden");
    document.getElementById("operacaoInlineColaborador")?.classList.add("hidden");
    syncOperacaoLancAluguelSubnavVisible(false);
    syncOperacaoLancAluguelSubButtons(null);
  }

  function setOperacaoFormPlaceholderVisible(visible) {
    const el = document.getElementById("operacaoFormPlaceholder");
    if (!el) return;
    el.classList.toggle("hidden", !visible);
    el.setAttribute("aria-hidden", visible ? "false" : "true");
  }

  function syncOperacaoCadastroButtons(activeButtonId) {
    [
      ...(DK_PORTAL_WA_CLIENTE_ATIVO ? ["btn-operacao-falar-cliente"] : []),
      "btn-operacao-cadastro-cliente",
      "btn-operacao-cadastro-veiculo",
      "btn-operacao-cadastro-locacao",
      "btn-operacao-lancamento-aluguel",
      "btn-operacao-lancamento-multas",
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
    if (typeof window.__DK_markLocalDataAuthority === "function") {
      try {
        window.__DK_markLocalDataAuthority();
      } catch {
        /* ignore */
      }
    }
    if (typeof window.__DK_pushToCloudAfterSave === "function") {
      window.__DK_pushToCloudAfterSave();
      return;
    }
    if (typeof window.__DK_pushCloudSnapshotNow !== "function") return;
    window.__DK_pushCloudSnapshotNow({ force: true }).catch((err) => {
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
      if (typeof portalWaRebuildDatasetCache === "function") {
        portalWaRebuildDatasetCache();
      }
    } catch (e) {
      console.warn("[DK portal] refresh após nuvem", e);
    }
  }

  /** Marca hora de uso — não reconstrói listas (evita travar ao mudar de menu). */
  function portalRefreshOperacaoLocal() {
    setPortalUnitDadosAtualizadosAgora();
  }

  function portalRefreshOperacaoDeferred(keys) {
    const run = () => {
      try {
        if (!keys || keys.includes("locacao")) {
          refreshOperacaoLocacaoDatalists();
          refreshOperacaoLocacaoProtocoloPicker();
        }
        if (!keys || keys.includes("aluguel")) {
          refreshOperacaoLancamentoAluguelCpfDatalist();
          refreshOperacaoLancAluguelPesquisaDatalists();
        }
        if (!keys || keys.includes("rel")) {
          refreshPortalRelClienteCpfDatalist();
          refreshPortalRelPlacaDatalist();
        }
      } catch (e) {
        console.warn("[DK portal] refresh diferido", e);
      }
    };
    if (typeof requestIdleCallback === "function") {
      requestIdleCallback(run, { timeout: 800 });
    } else {
      setTimeout(run, 0);
    }
  }

  let portalBackgroundCloudPullStarted = false;
  function portalScheduleBackgroundCloudPullOnce() {
    if (portalBackgroundCloudPullStarted) return;
    portalBackgroundCloudPullStarted = true;
    if (typeof window.__DK_scheduleBackgroundCloudPull !== "function") return;
    window.__DK_scheduleBackgroundCloudPull()
      .then((r) => {
        if (r && r.applied) portalRefreshOperacaoLocal();
      })
      .catch(() => {});
  }

  try {
    window.__DK_portalRefreshOperacaoLocal = portalRefreshOperacaoLocal;
    window.__DK_portalRefreshOperacaoDeferred = portalRefreshOperacaoDeferred;
    window.__DK_invalidatePesquisaLinhasCache = invalidatePesquisaLinhasCache;
  } catch {
    /* ignore */
  }

  function hideInlineForms() {
    hideOperacaoInlineFormsCore();
    setOperacaoFormPlaceholderVisible(true);
    syncOperacaoCadastroButtons(null);
  }

  /**
   * Clientes elegíveis no cadastro de locação: só CPF com registo em dk_clientes_cadastro
   * (não CPF órfão de protocolos/planilha sem cadastro de cliente).
   */
  function getPortalCadastroLocacaoClienteCandidates() {
    if (typeof getLancamentoClienteCandidates !== "function") return [];
    const dig =
      typeof onlyDigits === "function" ? onlyDigits : (s) => String(s ?? "").replace(/\D/g, "");
    const cadastroCpfs = new Set();
    if (typeof loadCadastro === "function" && typeof CAD_CLIENTES_KEY !== "undefined") {
      loadCadastro(CAD_CLIENTES_KEY).forEach((c) => {
        const cpf = dig(String(c.cpf || ""));
        if (cpf.length === 11 && String(c.nome || "").trim().length >= 2) cadastroCpfs.add(cpf);
      });
    }
    if (!cadastroCpfs.size) return [];
    return getLancamentoClienteCandidates().filter((c) => cadastroCpfs.has(dig(String(c.cpf || ""))));
  }

  /**
   * Preenche os datalists do formulário de locação (portal): mesmas regras que o painel DK —
   * placas de `getVeiculosSemProtocoloAtivo()`, clientes de `getPortalCadastroLocacaoClienteCandidates()`.
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
      typeof getPortalCadastroLocacaoClienteCandidates === "function"
    ) {
      const dig =
        typeof onlyDigits === "function" ? onlyDigits : (s) => String(s ?? "").replace(/\D/g, "");
      const prefix = dig(prevCpf).slice(0, 11);
      let candidatos = getPortalCadastroLocacaoClienteCandidates();
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

  const PORTAL_CURRENCY_INPUT_IDS = [
    "operacaoVeiculoValor",
    "operacaoLocacaoValorAluguel",
    "operacaoLocacaoValorInvestimento",
    "operacaoLancAluguelValorEspecie",
    "operacaoLancAluguelValorPix",
    "operacaoLancAluguelValorCartao",
    "operacaoLancAluguelValorSimples",
    "operacaoLancMultasValorMulta",
    "operacaoLancManutencaoValorManutencao",
    "portalLancAluguelEditValor",
  ];

  /** Reaplica máscaras após preencher formulários (datas por convenção de nome — app.js). */
  function normalizePortalMaskedFieldValues() {
    const root = document.getElementById("operacaoPainelDireito") || document;
    if (typeof bindDateMasksInContainer === "function") bindDateMasksInContainer(root);
    else if (typeof setupDateMasks === "function") setupDateMasks();
    if (typeof normalizeDateMaskValues === "function") normalizeDateMaskValues(root);
    if (typeof normalizeCurrencyMaskValues === "function") {
      normalizeCurrencyMaskValues(PORTAL_CURRENCY_INPUT_IDS);
    }
    PORTAL_CURRENCY_INPUT_IDS.forEach((id) => {
      const el = document.getElementById(id);
      if (!el || el.readOnly || el.disabled) return;
      if (typeof bindCurrencyMaskInput === "function") bindCurrencyMaskInput(el);
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
    syncOperacaoLocacaoProtocoloComDataInicio();
    const cpfDigits =
      typeof onlyDigits === "function"
        ? onlyDigits(String(document.getElementById("operacaoLocacaoCpf")?.value || ""))
        : String(document.getElementById("operacaoLocacaoCpf")?.value || "").replace(/\D/g, "");
    if (cpfDigits.length === 11) refreshOperacaoLocacaoProtocoloPicker({ force: true });
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
    refreshOperacaoLocacaoVisualizarContratoBtn();
  }

  /** «Gerar contrato» ou «Visualizar contrato» conforme existência no depósito (chave = protocolo). */
  function refreshOperacaoLocacaoVisualizarContratoBtn() {
    if (typeof window.__DK_contratoLocacaoRefreshBotao === "function") {
      window.__DK_contratoLocacaoRefreshBotao();
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

  /** Placeholder da data de início (não preenche automaticamente — protocolo usa a data informada). */
  function updateOperacaoLocacaoDataInicioPlaceholder() {
    const inp = document.getElementById("operacaoLocacaoDataInicio");
    if (!inp) return;
    inp.placeholder = "DD/MM/AAAA";
  }

  function isPortalProtocoloAlignedWithInicioForm(ncRaw) {
    const inicioBr = String(document.getElementById("operacaoLocacaoDataInicio")?.value || "").trim();
    if (!inicioBr || typeof isProtocoloAlignedWithLocacaoInicio !== "function") return true;
    return isProtocoloAlignedWithLocacaoInicio(ncRaw, { inicio: inicioBr });
  }

  const PORTAL_PROTO_NOVO = "__PORTAL_PROTO_NOVO__";
  let portalLocacaoProtocoloPickerCpf = "";
  let portalEnsureLocacoesFromCloudInFlight = null;

  async function portalEnsureLocacoesFromCloud(opts) {
    const fn =
      typeof window.__DK_ensurePortalCadastrosFromCloud === "function"
        ? window.__DK_ensurePortalCadastrosFromCloud
        : null;
    if (!fn) return { ok: false, reason: "no_sync_fn" };
    if (portalEnsureLocacoesFromCloudInFlight) return portalEnsureLocacoesFromCloudInFlight;
    portalEnsureLocacoesFromCloudInFlight = fn(opts)
      .catch((e) => {
        console.warn("[DK portal] sync locações nuvem", e);
        return { ok: false, error: e };
      })
      .finally(() => {
        portalEnsureLocacoesFromCloudInFlight = null;
      });
    return portalEnsureLocacoesFromCloudInFlight;
  }

  function portalLocacaoCpfDigitsMatch(lCpfRaw, cpfDigits) {
    const dig =
      typeof onlyDigits === "function" ? onlyDigits : (s) => String(s ?? "").replace(/\D/g, "");
    const want = dig(String(cpfDigits || "")).slice(0, 11);
    if (want.length !== 11) return false;
    const got = dig(String(lCpfRaw || "")).slice(0, 11);
    if (got === want) return true;
    if (got.length === 10 && `0${got}` === want) return true;
    if (want.length === 10 && `0${want}` === got) return true;
    return false;
  }

  function collectPortalLocacoesByCpf(cpfDigits) {
    if (!cpfDigits || cpfDigits.length !== 11) return [];
    if (typeof loadCadastro !== "function" || typeof CAD_LOCACOES_KEY === "undefined") return [];
    const dig =
      typeof onlyDigits === "function" ? onlyDigits : (s) => String(s ?? "").replace(/\D/g, "");
    const cpfNorm = dig(String(cpfDigits || "")).slice(0, 11);
    if (cpfNorm.length !== 11) return [];

    const known =
      typeof getPortalClienteKnownRecord === "function" ? getPortalClienteKnownRecord(cpfNorm) : null;
    const nomeKeys = new Set();
    const addNomeKey = (raw) => {
      const nk = portalNomeChaveBusca(raw);
      if (nk.length >= 3) nomeKeys.add(nk);
    };
    if (known) addNomeKey(known.nome);
    addNomeKey(document.getElementById("operacaoLocacaoCliente")?.value);

    const codKeys = new Set();
    const addCod = (raw) => {
      const s = String(raw || "").trim();
      if (!s) return;
      codKeys.add(s);
      if (typeof normalizeKey === "function") codKeys.add(normalizeKey(s));
    };
    if (known) {
      addCod(known.codigo);
      addCod(known.clienteCodigo);
    }

    const byKey = new Map();
    loadCadastro(CAD_LOCACOES_KEY).forEach((l) => {
      let match = portalLocacaoCpfDigitsMatch(l.cpf, cpfNorm);
      if (!match && codKeys.size) {
        const lc = String(l.clienteCodigo || "").trim();
        if (lc && (codKeys.has(lc) || (typeof normalizeKey === "function" && codKeys.has(normalizeKey(lc))))) {
          match = true;
        }
      }
      if (!match && nomeKeys.size) {
        const ln = portalNomeChaveBusca(String(l.nome || l.cliente || l.clienteNome || "").trim());
        if (ln && nomeKeys.has(ln)) match = true;
      }
      if (!match) return;
      const nc = normPortalNumeroContrato(l.numeroContrato || "");
      const dedupeKey = nc || `${dig(String(l.cpf || ""))}|${String(l.placa || "").trim()}|${l.id || l.createdAt || byKey.size}`;
      if (!byKey.has(dedupeKey)) byKey.set(dedupeKey, l);
    });
    return Array.from(byKey.values());
  }

  function getPortalProtocoloDateFromInicio() {
    const raw = String(document.getElementById("operacaoLocacaoDataInicio")?.value || "").trim();
    if (typeof parseBrDate === "function") {
      const d = parseBrDate(raw);
      if (d && !Number.isNaN(d.getTime())) return d;
    }
    return new Date();
  }

  function syncOperacaoLocacaoProtocoloComDataInicio() {
    const hid = document.getElementById("operacaoLocacaoProtocolo");
    const sel = document.getElementById("operacaoLocacaoProtocoloSelect");
    if (!hid) return;
    const isNovo = sel && String(sel.value || "") === PORTAL_PROTO_NOVO;
    const inicioBr = String(document.getElementById("operacaoLocacaoDataInicio")?.value || "").trim();
    const inicioDt =
      inicioBr && typeof parseBrDate === "function" ? parseBrDate(inicioBr) : null;
    const inicioOk = inicioDt && !Number.isNaN(inicioDt.getTime());
    if (!inicioOk) {
      if (isNovo) {
        hid.value = "";
        const optNovo = Array.from(sel?.options || []).find((o) => o.value === PORTAL_PROTO_NOVO);
        if (optNovo) optNovo.textContent = "NOVO — (informe data de início)";
      }
      return;
    }
    const novo = proximoProtocoloPortalAaaammddXX(inicioDt);
    if (isNovo) {
      hid.value = novo;
      const optNovo = Array.from(sel.options || []).find((o) => o.value === PORTAL_PROTO_NOVO);
      if (optNovo) optNovo.textContent = `NOVO — ${novo}`;
      return;
    }
    const nc = normPortalNumeroContrato(hid.value);
    if (nc && isPortalProtocoloAlignedWithInicioForm(nc)) return;
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
    if (loc && typeof window.__DK_consolidarLancamentosAluguelLoc === "function") {
      window.__DK_consolidarLancamentosAluguelLoc(loc, { mutate: true });
      try {
        if (typeof loadCadastro === "function" && typeof saveCadastro === "function" && typeof CAD_LOCACOES_KEY !== "undefined") {
          const dig =
            typeof onlyDigits === "function" ? onlyDigits : (s) => String(s ?? "").replace(/\D/g, "");
          const ncKey = normPortalNumeroContrato(loc.numeroContrato);
          const cpf = dig(String(loc.cpf || ""));
          const locs = loadCadastro(CAD_LOCACOES_KEY);
          const idx = locs.findIndex(
            (l) => dig(String(l.cpf || "")) === cpf && normPortalNumeroContrato(l.numeroContrato) === ncKey
          );
          if (idx >= 0) {
            locs[idx] = loc;
            saveCadastro(CAD_LOCACOES_KEY, locs);
          }
        }
      } catch {
        /* ignore */
      }
    }
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
      if (typeof parseCurrencyBR === "function" && typeof currencyBRL === "function") {
        return currencyBRL(parseCurrencyBR(String(raw || "")));
      }
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
    refreshOperacaoLocacaoLancamentosHistorico(
      typeof onlyDigits === "function" ? onlyDigits(String(loc.cpf || "")) : String(loc.cpf || "").replace(/\D/g, ""),
      loc.numeroContrato
    );
    portalApplyAmbienteVisualForm("Locacao", loc);
    refreshOperacaoLocacaoApagarProtocoloBtn();
    refreshOperacaoLocacaoVisualizarContratoBtn();
    if (loc?.numeroContrato && typeof window.__DK_contratoLocacaoSincronizarPasta === "function") {
      void window.__DK_contratoLocacaoSincronizarPasta(normPortalNumeroContrato(loc.numeroContrato), loc.statusLocacao, {
        fim: loc.fim,
        silent: true,
      });
    }
    const lancForm = document.getElementById("formOperacaoLancAluguel");
    if (lancForm) lancForm.classList.toggle("portal-registro-teste", portalRegistroEhTeste(loc));
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
    updateOperacaoLocacaoDataInicioPlaceholder();
    syncOperacaoLocacaoFromDataInicio();
    syncOperacaoLocacaoValorPlano();
    portalResetAmbienteForm("Locacao");
    refreshOperacaoLocacaoApagarProtocoloBtn();
  }

  function refreshOperacaoLocacaoProtocoloPicker(opts = {}) {
    const force = Boolean(opts.force);
    const sel = document.getElementById("operacaoLocacaoProtocoloSelect");
    const hid = document.getElementById("operacaoLocacaoProtocolo");
    const inpCpf = document.getElementById("operacaoLocacaoCpf");
    const msgEl = document.getElementById("operacaoLocacaoInlineMsg");
    if (!sel || !hid || !inpCpf) return;
    const digits =
      typeof onlyDigits === "function" ? onlyDigits(inpCpf.value) : String(inpCpf.value || "").replace(/\D/g, "");
    const locs = collectPortalLocacoesByCpf(digits);
    const known =
      digits.length === 11 &&
      (Boolean(getPortalClienteKnownRecord(digits)) || locs.some((l) => Boolean(normPortalNumeroContrato(l.numeroContrato))));
    if (!known) {
      portalLocacaoProtocoloPickerCpf = "";
      sel.disabled = true;
      sel.replaceChildren();
      const o = document.createElement("option");
      o.value = "";
      o.textContent = "Informe um CPF cadastrado";
      sel.appendChild(o);
      hid.value = "";
      if (msgEl && digits.length === 11) {
        msgEl.textContent = "CPF não encontrado no cadastro — confira o número ou use Cadastro de cliente.";
      } else if (msgEl) {
        msgEl.textContent = "";
      }
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
    const byNc = new Map();
    locs.forEach((l) => {
      const nc = norm(l.numeroContrato || "");
      if (nc) byNc.set(nc, l);
    });
    const sorted = Array.from(byNc.keys()).sort((a, b) => a.localeCompare(b, "en"));
    if (!sorted.length && digits.length === 11 && !opts.syncingCloud) {
      if (msgEl) msgEl.textContent = "A carregar protocolos da nuvem…";
      void portalEnsureLocacoesFromCloud({ force: true }).then((r) => {
        if (r?.applied) {
          refreshOperacaoLocacaoProtocoloPicker({ force: true, syncingCloud: true });
          if (msgEl) msgEl.textContent = "";
          return;
        }
        if (msgEl) {
          msgEl.textContent =
            "Nenhum protocolo para este CPF neste navegador. Use «Carregar da nuvem» ou confira o CPF (tem de ser o mesmo do contrato).";
        }
      });
    } else if (msgEl && sorted.length) {
      msgEl.textContent = "";
    }
    sel.replaceChildren();
    sorted.forEach((nc) => {
      const l = byNc.get(nc);
      const opt = document.createElement("option");
      opt.value = nc;
      const placa =
        typeof normalizePlate === "function" ? normalizePlate(String(l.placa || "")) : String(l.placa || "").trim();
      const ini = String(l.inicio || "").trim();
      opt.textContent = `${nc} · ${placa || "—"} · ${ini || "—"}`;
      if (isPortalLocacaoAtiva(l)) opt.classList.add("portal-locacao-proto-opt--ativo");
      sel.appendChild(opt);
    });
    const optNovo = document.createElement("option");
    optNovo.value = PORTAL_PROTO_NOVO;
    const rawInicio = String(document.getElementById("operacaoLocacaoDataInicio")?.value || "").trim();
    const inicioDt =
      rawInicio && typeof parseBrDate === "function" ? parseBrDate(rawInicio) : null;
    const inicioOk = inicioDt && !Number.isNaN(inicioDt.getTime());
    const protoNovo = inicioOk ? proximoProtocoloPortalAaaammddXX(inicioDt) : "";
    optNovo.textContent = protoNovo ? `NOVO — ${protoNovo}` : "NOVO — (informe data de início)";
    sel.appendChild(optNovo);
    const pNorm = preserve ? norm(preserve) : "";
    if (pNorm && sorted.includes(pNorm)) {
      sel.value = pNorm;
      hid.value = pNorm;
    } else {
      sel.value = PORTAL_PROTO_NOVO;
      hid.value =
        protoNovo || (pNorm && isPortalProtocoloAlignedWithInicioForm(pNorm) ? pNorm : "");
    }
    syncOperacaoLocacaoProtocoloSelectAtivoUi();
    if (typeof window.__DK_refreshOperacaoLocacaoDocumentosUi === "function") {
      window.__DK_refreshOperacaoLocacaoDocumentosUi();
    }
  }

  /** Verde no select fechado quando o protocolo escolhido está ativo (sem data fim). */
  function syncOperacaoLocacaoProtocoloSelectAtivoUi() {
    const sel = document.getElementById("operacaoLocacaoProtocoloSelect");
    if (!sel) return;
    const v = String(sel.value || "").trim();
    if (!v || v === PORTAL_PROTO_NOVO || sel.disabled) {
      sel.classList.remove("portal-locacao-proto-select--ativo");
      return;
    }
    const opt = Array.from(sel.options).find((o) => o.value === v);
    sel.classList.toggle("portal-locacao-proto-select--ativo", Boolean(opt?.classList.contains("portal-locacao-proto-opt--ativo")));
  }

  function onOperacaoLocacaoProtocoloSelectChange() {
    const sel = document.getElementById("operacaoLocacaoProtocoloSelect");
    const hid = document.getElementById("operacaoLocacaoProtocolo");
    if (!sel || !hid || sel.disabled) return;
    const v = sel.value;
    if (!v) {
      hid.value = "";
      syncOperacaoLocacaoProtocoloSelectAtivoUi();
      if (typeof window.__DK_refreshOperacaoLocacaoDocumentosUi === "function") {
        window.__DK_refreshOperacaoLocacaoDocumentosUi();
      }
      return;
    }
    const norm = (x) =>
      typeof normalizeNumeroContratoKey === "function"
        ? normalizeNumeroContratoKey(x || "")
        : String(x || "").trim();
    if (v === PORTAL_PROTO_NOVO) {
      const rawInicio = String(document.getElementById("operacaoLocacaoDataInicio")?.value || "").trim();
      const inicioDt =
        rawInicio && typeof parseBrDate === "function" ? parseBrDate(rawInicio) : null;
      hid.value =
        inicioDt && !Number.isNaN(inicioDt.getTime())
          ? proximoProtocoloPortalAaaammddXX(inicioDt)
          : "";
      clearPortalLocacaoCamposParaNovoContrato();
      syncOperacaoLocacaoProtocoloComDataInicio();
      refreshOperacaoLocacaoSubmitBtn();
      refreshOperacaoLocacaoFinalizarBtn();
      refreshOperacaoLocacaoApagarProtocoloBtn();
      syncOperacaoLocacaoProtocoloSelectAtivoUi();
      if (typeof window.__DK_refreshOperacaoLocacaoDocumentosUi === "function") {
        window.__DK_refreshOperacaoLocacaoDocumentosUi();
      }
      return;
    }
    const digits =
      typeof onlyDigits === "function"
        ? onlyDigits(String(document.getElementById("operacaoLocacaoCpf")?.value || ""))
        : String(document.getElementById("operacaoLocacaoCpf")?.value || "").replace(/\D/g, "");
    hid.value = norm(v);
    const loc = findPortalLocacaoByProtocolo(v);
    if (loc) applyPortalLocacaoRowFromRecord(loc);
    refreshOperacaoLocacaoSubmitBtn();
    refreshOperacaoLocacaoFinalizarBtn();
    syncOperacaoLocacaoProtocoloSelectAtivoUi();
    if (typeof window.__DK_refreshOperacaoLocacaoDocumentosUi === "function") {
      window.__DK_refreshOperacaoLocacaoDocumentosUi();
    }
  }

  function normPortalNumeroContrato(x) {
    return typeof normalizeNumeroContratoKey === "function"
      ? normalizeNumeroContratoKey(x || "")
      : String(x || "").trim();
  }

  function findPortalLocacaoByProtocolo(ncRaw) {
    const nc = normPortalNumeroContrato(ncRaw);
    if (!nc || typeof loadCadastro !== "function" || typeof CAD_LOCACOES_KEY === "undefined") {
      return null;
    }
    return (
      loadCadastro(CAD_LOCACOES_KEY).find(
        (l) => normPortalNumeroContrato(l.numeroContrato) === nc
      ) || null
    );
  }

  function refreshOperacaoLocacaoAdminProtocoloUi() {
    const wrap = document.getElementById("operacaoLocacaoProtocoloAdminWrap");
    if (!wrap) return;
    wrap.classList.toggle("hidden", !isPortalTitularAdministrador());
    portalSyncAmbienteCadastroAdminUi();
    refreshOperacaoLocacaoApagarProtocoloBtn();
  }

  function refreshOperacaoLocacaoApagarProtocoloBtn() {
    const btn = document.getElementById("operacaoLocacaoApagarProtocoloBtn");
    if (!btn) return;
    const nc = normPortalNumeroContrato(String(document.getElementById("operacaoLocacaoProtocolo")?.value || ""));
    const loc = nc ? findPortalLocacaoByProtocolo(nc) : null;
    btn.classList.toggle("hidden", !isPortalTitularAdministrador() || !portalRegistroEhTeste(loc));
  }

  function refreshOperacaoLocacaoSubmitBtn() {
    const btn = document.getElementById("operacaoLocacaoSubmitBtn");
    const sel = document.getElementById("operacaoLocacaoProtocoloSelect");
    if (!btn || !sel) return;
    const isNovo = String(sel.value || "") === PORTAL_PROTO_NOVO;
    const editing = !isNovo && Boolean(String(sel.value || "").trim());
    if (editing && isPortalTitularAdministrador()) {
      btn.textContent = "Atualizar locação";
    } else {
      btn.textContent = "Cadastrar locação";
    }
  }

  function loadOperacaoLocacaoByProtocoloNumero(rawNc) {
    const msg = document.getElementById("operacaoLocacaoInlineMsg");
    if (!isPortalTitularAdministrador()) {
      if (msg) msg.textContent = "Apenas o administrador pode carregar e editar um protocolo pelo número.";
      return { ok: false };
    }
    const nc = normPortalNumeroContrato(rawNc);
    if (!nc) {
      if (msg) msg.textContent = "Informe um número de protocolo válido.";
      return { ok: false };
    }
    const loc = findPortalLocacaoByProtocolo(nc);
    if (!loc) {
      if (msg) msg.textContent = `Protocolo ${nc} não encontrado na base.`;
      return { ok: false };
    }
    const dig =
      typeof onlyDigits === "function" ? onlyDigits : (s) => String(s ?? "").replace(/\D/g, "");
    const cpfDigits = dig(String(loc.cpf || ""));
    const cpfEl = document.getElementById("operacaoLocacaoCpf");
    const cliEl = document.getElementById("operacaoLocacaoCliente");
    if (cpfEl) {
      cpfEl.value =
        typeof formatCpf === "function" ? formatCpf(cpfDigits) : cpfDigits;
    }
    if (cliEl) cliEl.value = String(loc.nome || "").trim();
    portalLocacaoProtocoloPickerCpf = "";
    refreshOperacaoLocacaoProtocoloPicker({ force: true });
    const sel = document.getElementById("operacaoLocacaoProtocoloSelect");
    const hid = document.getElementById("operacaoLocacaoProtocolo");
    if (sel) sel.value = nc;
    if (hid) hid.value = nc;
    applyPortalLocacaoRowFromRecord(loc);
    refreshOperacaoLocacaoDatalists();
    refreshOperacaoLocacaoSubmitBtn();
    refreshOperacaoLocacaoFinalizarBtn();
    refreshOperacaoLocacaoApagarProtocoloBtn();
    if (msg) msg.textContent = `Protocolo ${nc} carregado. Pode corrigir os dados e clicar em «Atualizar locação».`;
    return { ok: true, loc };
  }

  function persistPortalLocacaoFinalizar() {
    const msg = document.getElementById("operacaoLocacaoInlineMsg");
    if (!isPortalTitularAdministrador()) {
      if (msg) msg.textContent = "Apenas o administrador pode encerrar (finalizar) uma locação.";
      return;
    }
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
    const idx = locs.findIndex((l) => normPortalNumeroContrato(l.numeroContrato) === ncNorm);
    if (idx === -1) {
      if (msg) msg.textContent = "Locação não encontrada na base deste navegador.";
      return;
    }
    const prev = locs[idx];
    const finalizarLocacao = () => {
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
      if (typeof window.__DK_contratoLocacaoSincronizarPasta === "function") {
        void window.__DK_contratoLocacaoSincronizarPasta(ncNorm, "FINALIZADO", { fim: fimBr }).then((r) => {
          if (!msg) return;
          if (r?.moved) {
            msg.textContent =
              "Locação finalizada. Contrato transferido para Documentos → Contratos INATIVOS (nuvem).";
          } else if (r?.ok && r?.naNuvem) {
            msg.textContent = "Locação finalizada. Contrato confirmado em Contratos INATIVOS (nuvem).";
          } else if (r?.msg === "nao_encontrado") {
            msg.textContent =
              "Locação finalizada. Gere o contrato deste protocolo se ainda não existir no depósito.";
          }
        });
      }
    };
    const changesFim = portalBuildAlteracoesLista(
      { fim: portalNormDiffVal(prev.fim), status: portalNormDiffVal(prev.statusLocacao) },
      { fim: fimBr, status: "FINALIZADO" },
      { fim: "Data fim", status: "Status" }
    );
    if (isPortalTitularAdministrador()) {
      portalConfirmarAlteracaoAdministrador(
        { titulo: `Confirmar finalização — locação ${ncNorm}`, changes: changesFim },
        finalizarLocacao
      );
    }
  }

  /** Atualiza a tag sugerida (DKCR/DKMT + sequência) conforme CARRO ou MOTO. */
  function refreshOperacaoVeiculoTagPreview() {
    const tipoEl = document.getElementById("operacaoVeiculoTipo");
    const tagEl = document.getElementById("operacaoVeiculoTag");
    if (!tipoEl || !tagEl) return;
    const tipo = String(tipoEl.value || "").trim();
    if (tipo !== "CARRO" && tipo !== "MOTO") {
      tagEl.value = "";
      return;
    }
    if (typeof seedVeiculosDatabaseIfNeeded === "function") seedVeiculosDatabaseIfNeeded();
    const veiculos =
      typeof loadCadastro === "function" && typeof CAD_VEICULOS_KEY !== "undefined"
        ? loadCadastro(CAD_VEICULOS_KEY)
        : [];
    if (typeof nextTagByTipo === "function") {
      tagEl.value = nextTagByTipo(tipo, veiculos);
    }
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
    const plate = portalResolvePlacaCadastro(plateRaw);
    const modelo = getVal("operacaoVeiculoModelo");
    if (!plate || !modelo) {
      if (msg) msg.textContent = "Informe placa e modelo.";
      return;
    }
    if (!portalPlacaMercosulOk(plate)) {
      const digitado = portalSanitizePlacaInput(plateRaw);
      let extra = digitado ? ` Recebido: «${digitado}» (${digitado.length} caracteres).` : "";
      if (digitado.length === 7 && /^[A-Z]{3}[0-9]{4}$/.test(digitado)) {
        extra =
          " Formato antigo (LLLNNNN) — será convertido para Mercosul; confira os 7 caracteres.";
      }
      if (msg) msg.textContent = MSG_PLACA_MERCOSUL + extra;
      return;
    }
    const placaInput = document.getElementById("operacaoVeiculoPlaca");
    if (placaInput && placaInput.value !== plate) placaInput.value = plate;
    const marca = getVal("operacaoVeiculoMarca");
    const valor = getVal("operacaoVeiculoValor");
    const cor = getVal("operacaoVeiculoCor");
    const chassi = getVal("operacaoVeiculoChassi");
    const anoModelo = getVal("operacaoVeiculoAnoModelo");
    const renavam = getVal("operacaoVeiculoRenavam");
    const motor = getVal("operacaoVeiculoMotor");
    const veiculos =
      typeof loadPortalVeiculosCadastro === "function"
        ? loadPortalVeiculosCadastro()
        : typeof PORTAL_VEICULOS_KEY !== "undefined"
          ? loadCadastro(PORTAL_VEICULOS_KEY)
          : [];
    const existenteVeiculoPre =
      typeof findPortalVeiculoByPlaca === "function" ? findPortalVeiculoByPlaca(plate) : null;
    if (
      typeof hasEquipamentoDuplicado === "function" &&
      hasEquipamentoDuplicado(veiculos, plate, chassi, renavam, motor) &&
      !(
        existenteVeiculoPre &&
        (typeof normalizePlate === "function"
          ? normalizePlate(String(existenteVeiculoPre.placa || "")) === plate
          : String(existenteVeiculoPre.placa || "")
              .toUpperCase()
              .replace(/[^A-Z0-9]/g, "") === plate)
      )
    ) {
      if (msg) msg.textContent = "Placa, chassi, renavam ou motor já cadastrado.";
      return;
    }
    const tipo = getVal("operacaoVeiculoTipo");
    if (tipo !== "CARRO" && tipo !== "MOTO") {
      if (msg) msg.textContent = "Selecione CARRO ou MOTO.";
      return;
    }
    let tag = getVal("operacaoVeiculoTag");
    if (!tag && typeof nextTagByTipo === "function") {
      tag = nextTagByTipo(tipo, veiculos);
    }
    if (!tag) {
      if (msg) msg.textContent = "Não foi possível gerar a tag. Selecione o tipo novamente.";
      return;
    }
    const existenteVeiculo = existenteVeiculoPre;
    const novo = {
      id: existenteVeiculo?.id ?? Date.now(),
      createdAt: existenteVeiculo?.createdAt ?? Date.now(),
      updatedAt: Date.now(),
      origemPortal: true,
      tipo,
      tag,
      placa: plate,
      codigo: getVal("operacaoVeiculoCodigo"),
      numLinha: String(existenteVeiculo?.numLinha || "").trim(),
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
      status: String(existenteVeiculo?.status || "DISPONIVEL").trim() || "DISPONIVEL",
      ambiente: PORTAL_AMBIENTE_REAL,
    };
    const snapshotVeiculo = (v) => ({
      tipo: portalNormDiffVal(v?.tipo),
      tag: portalNormDiffVal(v?.tag),
      placa: portalNormDiffVal(v?.placa),
      codigo: portalNormDiffVal(v?.codigo),
      marca: portalNormDiffVal(v?.marca),
      modelo: portalNormDiffVal(v?.modelo),
      valor: portalNormDiffVal(v?.valor),
      cor: portalNormDiffVal(v?.cor),
      chassi: portalNormDiffVal(v?.chassi),
      anoModelo: portalNormDiffVal(v?.anoModelo),
      renavam: portalNormDiffVal(v?.renavam),
      motor: portalNormDiffVal(v?.motor),
      proprietario: portalNormDiffVal(v?.proprietario),
      local: portalNormDiffVal(v?.local),
    });
    const doSaveVeiculo = () => {
      try {
        if (typeof upsertPortalVeiculoByPlaca === "function") {
          upsertPortalVeiculoByPlaca(novo);
        } else if (typeof PORTAL_VEICULOS_KEY !== "undefined") {
          const idx = veiculos.findIndex((v) => {
            const p =
              typeof normalizePlate === "function"
                ? normalizePlate(String(v.placa || ""))
                : String(v.placa || "")
                    .toUpperCase()
                    .replace(/[^A-Z0-9]/g, "");
            return p === plate;
          });
          if (idx >= 0) veiculos[idx] = { ...veiculos[idx], ...novo };
          else veiculos.push(novo);
          saveCadastro(PORTAL_VEICULOS_KEY, veiculos);
        } else {
          veiculos.push(novo);
          saveCadastro(CAD_VEICULOS_KEY, veiculos);
        }
      } catch (err) {
        if (msg) msg.textContent = `Não foi possível guardar: ${err && err.message ? err.message : err}.`;
        console.error(err);
        return;
      }
      portalPushCloudSnapshotAfterPersist();
      if (msg) {
        msg.textContent = existenteVeiculo ? "Veículo atualizado com sucesso." : "Veículo cadastrado com sucesso.";
      }
      portalApplyAmbienteVisualForm("Veiculo", novo);
      refreshOperacaoVeiculoApagarBtn(plate);
      const form = document.getElementById("formOperacaoVeiculoInline");
      if (form && typeof form.reset === "function" && !existenteVeiculo) {
        form.reset();
        portalResetAmbienteForm("Veiculo");
        refreshOperacaoVeiculoTagPreview();
      }
      renderOperacaoVeiculoResumoFrota();
    };
    if (existenteVeiculo && isPortalTitularAdministrador()) {
      const changes = portalBuildAlteracoesLista(
        snapshotVeiculo(existenteVeiculo),
        snapshotVeiculo(novo),
        PORTAL_VEICULO_DIFF_LABELS
      );
      portalConfirmarAlteracaoAdministrador({ titulo: "Confirmar alteração — veículo", changes }, doSaveVeiculo);
      return;
    }
    doSaveVeiculo();
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
    if (!portalPlacaMercosulOk(plate)) {
      if (msg) msg.textContent = MSG_PLACA_MERCOSUL;
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
    let nc = normPortalNumeroContrato(String(hid?.value || ""));
    if (isNovo) {
      nc = normPortalNumeroContrato(proximoProtocoloPortalAaaammddXX(inicioDt));
      if (hid) hid.value = nc;
    } else if (!nc) {
      if (msg) msg.textContent = "Protocolo inválido. Escolha «NOVO» ou um contrato existente.";
      return;
    } else if (
      typeof isProtocoloAlignedWithLocacaoInicio === "function" &&
      !isProtocoloAlignedWithLocacaoInicio(nc, { inicio: inicioBr })
    ) {
      nc = normPortalNumeroContrato(proximoProtocoloPortalAaaammddXX(inicioDt));
      if (hid) hid.value = nc;
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
    const clientes =
      typeof loadPortalClientesCadastro === "function"
        ? loadPortalClientesCadastro()
        : typeof loadCadastro === "function" && typeof PORTAL_CLIENTES_KEY !== "undefined"
          ? loadCadastro(PORTAL_CLIENTES_KEY)
          : [];
    const cliente = clientes.find((c) => dig(String(c.cpf || "")) === cpfDigits);
    const nomeCliente =
      String(document.getElementById("operacaoLocacaoCliente")?.value || "").trim() ||
      String(cliente?.nome || "").trim() ||
      (typeof getPortalClienteKnownRecord === "function" ? String(getPortalClienteKnownRecord(cpfDigits)?.nome || "").trim() : "");
    const veiculoCad =
      typeof findPortalVeiculoByPlaca === "function"
        ? findPortalVeiculoByPlaca(plate)
        : null;
    const modalidade = veiculoCad?.tipo
      ? String(veiculoCad.tipo).trim()
      : portalInferTipoVeiculoLocacao({ placa: plate, modalidade: "" });
    const statusLocacao = fimBr ? "FINALIZADO" : "ATIVO";

    const locs = loadCadastro(CAD_LOCACOES_KEY);
    const idxAll = locs.findIndex((l) => normPortalNumeroContrato(l.numeroContrato) === nc);
    const prev = idxAll >= 0 ? locs[idxAll] : null;
    if (!prev && !isNovo) {
      if (msg) msg.textContent = "Contrato não encontrado para atualizar. Use «NOVO» para criar um protocolo.";
      return;
    }
    if (prev && !isPortalTitularAdministrador()) {
      if (msg) {
        msg.textContent =
          "Apenas o administrador pode alterar um protocolo já cadastrado. Colaboradores podem cadastrar contratos novos (NOVO).";
      }
      return;
    }
    if (prev && isNovo) {
      if (msg) msg.textContent = "Remova «NOVO» do protocolo para atualizar um contrato já existente.";
      return;
    }

    const ncKey =
      typeof normalizeNumeroContratoKey === "function" ? normalizeNumeroContratoKey(nc) : nc;
    const excludeId = prev?.id != null ? prev.id : null;
    if (
      typeof findLocacaoPorChaveNatural === "function" &&
      !prev &&
      findLocacaoPorChaveNatural(cpfDigits, plate, inicioBr, null)
    ) {
      const dup = findLocacaoPorChaveNatural(cpfDigits, plate, inicioBr, null);
      const dupNc =
        typeof normalizeNumeroContratoKey === "function"
          ? normalizeNumeroContratoKey(dup.numeroContrato || "")
          : String(dup.numeroContrato || "");
      if (msg) {
        msg.textContent = `Já existe locação para este CPF, placa e início (protocolo ${dupNc}). Remova a duplicata ou use o protocolo existente.`;
      }
      return;
    }
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
      nome: nomeCliente,
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
      ambiente: PORTAL_AMBIENTE_REAL,
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

    const snapshotLoc = (rec) => ({
      numeroContrato: portalNormDiffVal(rec?.numeroContrato),
      placa: portalNormDiffVal(rec?.placa),
      inicio: portalNormDiffVal(rec?.inicio),
      fim: portalNormDiffVal(rec?.fim),
      plano: portalNormDiffVal(rec?.plano),
      valorLocacao: portalNormDiffVal(rec?.valorLocacao),
      valorInvestimento: portalNormDiffVal(rec?.valorInvestimento),
      valorSemanal: portalNormDiffVal(rec?.valorSemanal),
      statusLocacao: portalNormDiffVal(rec?.statusLocacao),
      diaPagto: portalNormDiffVal(rec?.diaPagto),
      periodoLocacao: portalNormDiffVal(rec?.periodoLocacao),
      marcaModelo: portalNormDiffVal(rec?.marcaModelo),
      modalidade: portalNormDiffVal(rec?.modalidade),
    });
    const registroNovo = snapshotLoc({ ...baseRecord, numeroContrato: nc });
    const doSaveLocacao = () => {
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
      refreshOperacaoLocacaoVisualizarContratoBtn();
      if (saved && typeof window.__DK_contratoLocacaoSincronizarPasta === "function") {
        void window.__DK_contratoLocacaoSincronizarPasta(nc, saved.statusLocacao, { fim: fimBr, silent: true });
      }
    };
    if (prev && isPortalTitularAdministrador()) {
      const changes = portalBuildAlteracoesLista(snapshotLoc(prev), registroNovo, PORTAL_LOCACAO_DIFF_LABELS);
      portalConfirmarAlteracaoAdministrador({ titulo: "Confirmar alteração — locação", changes }, doSaveLocacao);
      return;
    }
    doSaveLocacao();
  }

  function collectPortalLocacoesComProtocoloByCpf(cpfDigits) {
    return collectPortalLocacoesByCpf(cpfDigits).filter((l) => Boolean(normPortalNumeroContrato(l.numeroContrato)));
  }

  /** Ano da coluna «TOTAL PAGO NO ANO DE 2025» (soma das datas de pagamento neste ano). */
  const PORTAL_LANCAMENTO_ALUGUEL_ANO_RESUMO = 2025;

  function formatPortalLancamentoSumBrl(n) {
    if (typeof currencyBRL === "function") return currencyBRL(Number(n || 0));
    return Number(n || 0).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  }

  function parsePortalLancamentoValorRaw(v) {
    if (typeof v === "number" && Number.isFinite(v)) return v;
    const s = String(v ?? "").trim();
    if (!s) return 0;
    if (s.includes(",")) {
      const cleaned = s
        .replace(/[R$\s]/g, "")
        .replace(/\./g, "")
        .replace(",", ".");
      const n = Number(cleaned);
      return Number.isFinite(n) ? n : 0;
    }
    const plain = s.replace(/[R$\s]/g, "");
    if (/^\d+(\.\d{1,2})?$/.test(plain)) {
      const n = Number(plain);
      return Number.isFinite(n) ? n : 0;
    }
    if (typeof parseCurrencyBR === "function") return parseCurrencyBR(s);
    const cleaned = plain.replace(/\./g, "").replace(",", ".");
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
    const proto = String(x.protocoloLancamento || x.protocolo || "").trim();
    if (proto) out.protocoloLancamento = proto;
    if (anyMeiosKeys) {
      out.valorEspecie = valorEspecie;
      out.valorPix = valorPix;
      out.valorCartao = valorCartao;
    }
    const oid = String(x.origemComprovanteClienteId || "").trim();
    const fp = String(x.comprovanteFp || "").trim();
    if (oid) out.origemComprovanteClienteId = oid;
    if (fp) out.comprovanteFp = fp;
    if (x.confirmadoViaAppCliente) out.confirmadoViaAppCliente = true;
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

  /** Lançamentos em `dk_lancamentos_aluguel` — só demo; oficial usa só portalLancamentosAluguel. */
  function portalLancamentosAluguelFromCadastroGlobal(loc) {
    if (window.__DK_IS_DEMO_DEPLOY__ !== true) return [];
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

  /** Lançamentos do portal amarrados ao registo da locação (fonte canónica consolidada). */
  function getPortalLancamentosAluguelDoContrato(loc) {
    if (typeof window.__DK_getLancamentosAluguelCanonico === "function") {
      return window.__DK_getLancamentosAluguelCanonico(loc);
    }
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

  /** Investimento acumulado = total pago − (devido aluguel + devido multas + devido manutenção). */
  function computePortalInvestimentoAcumuladoNum(devidoAluguel, devidoMultas, devidoManutencao, totalPago) {
    return (
      Number(totalPago || 0) -
      (Number(devidoAluguel || 0) + Number(devidoMultas || 0) + Number(devidoManutencao || 0))
    );
  }

  function getPortalLocacaoDoFormularioLocacao() {
    const hid = document.getElementById("operacaoLocacaoProtocolo");
    if (!hid) return null;
    const nc = normPortalNumeroContrato(hid.value);
    if (!nc) return null;
    const digits =
      typeof onlyDigits === "function"
        ? onlyDigits(String(document.getElementById("operacaoLocacaoCpf")?.value || ""))
        : String(document.getElementById("operacaoLocacaoCpf")?.value || "").replace(/\D/g, "");
    if (!digits) return null;
    return collectPortalLocacoesByCpf(digits).find((l) => normPortalNumeroContrato(l.numeroContrato) === nc) || null;
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
    const valorDevidoManutencaoNum = (() => {
      const arrManut = Array.isArray(loc?.portalManutencoesRegistro) ? loc.portalManutencoesRegistro : [];
      if (arrManut.length) {
        let s = 0;
        for (const m of arrManut) {
          const v = parseCur(m?.valorManutencao ?? m?.valorMulta ?? m?.valor ?? 0);
          if (Number.isFinite(v)) s += v;
        }
        return s;
      }
      return parseCur(
        loc?.valorDevidoManutencao ?? loc?.devidoManutencao ?? loc?.gastosManutencao ?? loc?.gastoManutencao ?? loc?.custoManutencao ?? 0
      );
    })();
    const valorDevidoMultasNum = parseCur(
      loc?.valorDevidoMulta ??
        loc?.valorDevidoMultas ??
        loc?.devidoMulta ??
        loc?.devidoMultas ??
        loc?.gastosMulta ??
        loc?.gastoMulta ??
        loc?.custoMulta ??
        0
    );
    const lancs = getPortalLancamentosAluguelContabilizaveisDoContrato(loc);
    const totalPagoNum = sumPortalLancamentosAluguelTotal(lancs);
    const investimentoAcumuladoNum = computePortalInvestimentoAcumuladoNum(
      valorDevidoAluguelNum,
      valorDevidoMultasNum,
      valorDevidoManutencaoNum,
      totalPagoNum
    );
    const tipoPlanoStr =
      String(loc?.plano || loc?.opcaoContrato || "").trim() ||
      (valInv > 0 ? "DK MINHA MOTO" : "DK MEU TRANSPORTE");
    const fmtBrl = (n) =>
      typeof currencyBRL === "function"
        ? currencyBRL(n)
        : Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    return {
      custoDia: fmtBrl(custoDiaNum),
      valorAluguel: fmtBrl(valLoc),
      valorInvestimento: fmtBrl(valInv),
      valorPlano: fmtBrl(plano),
      valorDevidoPlano: fmtBrl(valorDevidoPlanoNum),
      totalPago: fmtBrl(totalPagoNum),
      tipoPlano: tipoPlanoStr,
      valorDevidoAluguel: fmtBrl(valorDevidoAluguelNum),
      valorDevidoManutencao: fmtBrl(valorDevidoManutencaoNum),
      valorDevidoMultas: fmtBrl(valorDevidoMultasNum),
      investimentoAcumulado: formatPortalLancamentoSumBrl(investimentoAcumuladoNum),
      investimentoAcumuladoNeg: investimentoAcumuladoNum < 0,
      investimentoAcumuladoPos: investimentoAcumuladoNum > 0,
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
      const { proto, placa, lancs, resumo, validados } = sec;
      const tituloBloco = fnSecTitulo
        ? fnSecTitulo(sec)
        : `Protocolo ${proto} · Placa ${placa}`;
      body += `<h2>${eh(tituloBloco)}</h2>`;
      body += `<p class="meta">${eh("Pagamentos")}</p>`;
      body += `<table><thead><tr><th>${eh("Protocolo lanç.")}</th><th>${eh("Data do pagamento")}</th><th>${eh("Valor")}</th><th>${eh("Registado por")}</th></tr></thead><tbody>`;
      if (!lancs.length) {
        body += `<tr><td colspan="4">${eh("Nenhum lançamento registado neste protocolo.")}</td></tr>`;
      } else {
        for (const lan of lancs) {
          const vf =
            typeof currencyBRL === "function"
              ? currencyBRL(lan.valor)
              : Number(lan.valor || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
          body += `<tr><td>${eh(String(lan.protocoloLancamento || "—"))}</td><td>${eh(String(lan.data || ""))}</td><td>${eh(vf)}</td><td>${eh(String(lan.registradoPorNome || lan.registradoPorCpf || "—"))}</td></tr>`;
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
      body += `</tbody></table>`;
      body += buildPortalRelatorioValidadosAppClienteHtml(validados || [], eh, {
        showInvalidateBtn: isPortalTitularAdministrador(),
      });
      body += `<hr />`;
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
      table.validados-app{margin-top:0.75rem}
      table.validados-app .lnk-comprovante{color:#1565c0;font-weight:600;text-decoration:underline;cursor:pointer;background:none;border:none;padding:0;font:inherit}
      table.validados-app .btn-invalidate-pagamento{font-size:11px;padding:4px 8px;border:1px solid #b71c1c;color:#b71c1c;background:#fff;border-radius:4px;cursor:pointer;white-space:nowrap}
      table.validados-app .btn-invalidate-pagamento:hover{background:#ffebee}
      table.validados-app tr.validados-app-row--ativo td{color:#2e7d32}
      table.validados-app tr.validados-app-row--invalidado td{color:#c62828}
      table.validados-app tr.validados-app-row--invalidado .lnk-comprovante{color:#c62828;text-decoration:line-through}
      table.validados-app .validados-app-invalidado-label{color:#c62828;font-weight:600;font-size:11px}
      .portal-validados-vazio{margin-top:0.75rem}
      hr{border:none;border-top:1px solid #ccc;margin:1rem 0}
    </style></head><body>
      <h1>${eh(title)}</h1>
      ${cabecalhoHtml}
      <p class="meta">${eh(`Emitido em ${quando}`)}</p>
      ${body}
      <script>
      (function () {
        function parentApi(name) {
          try {
            if (window.parent && window.parent !== window && typeof window.parent[name] === "function") {
              return window.parent[name];
            }
          } catch (err) { /* ignore */ }
          if (typeof window[name] === "function") return window[name];
          return null;
        }
        document.addEventListener("click", function (e) {
          var inv = e.target.closest && e.target.closest(".btn-invalidate-pagamento[data-dk-inv-pagamento-id]");
          if (inv) {
            e.preventDefault();
            var cid = inv.getAttribute("data-dk-inv-pagamento-id");
            if (!cid) return;
            if (!window.confirm("Invalidar este pagamento? Deixa de contar no protocolo e no relatório.")) return;
            inv.disabled = true;
            var fnInv = parentApi("__DK_invalidarPagamentoAppCliente");
            var fnRefresh = parentApi("__DK_refreshPortalRelatorioAberto");
            if (!fnInv) {
              window.alert("Função indisponível. Atualize a página do portal (Ctrl+F5).");
              inv.disabled = false;
              return;
            }
            Promise.resolve(fnInv(cid)).then(function (r) {
              if (r && r.ok) {
                if (fnRefresh) fnRefresh();
              } else {
                window.alert((r && r.msg) || "Não foi possível invalidar.");
                inv.disabled = false;
              }
            }).catch(function () {
              inv.disabled = false;
            });
            return;
          }
          var el = e.target.closest && e.target.closest(".lnk-comprovante[data-dk-comprovante-id]");
          if (!el) return;
          e.preventDefault();
          var id = el.getAttribute("data-dk-comprovante-id");
          if (!id) return;
          var fnView = parentApi("__DK_openComprovanteClienteViewerById");
          if (fnView) fnView(id);
        });
      })();
      </script>
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
      const { proto, placa, lancs, resumo, validados } = sec;
      const tituloBloco = fnSecTitulo
        ? fnSecTitulo(sec)
        : `Protocolo ${proto} · Placa ${placa}`;
      blocks += `<h3>${eh(tituloBloco)}</h3>`;
      blocks += `<table><thead><tr><th>${eh("Protocolo lanç.")}</th><th>${eh("Data do pagamento")}</th><th>${eh("Valor")}</th><th>${eh("Registado por")}</th></tr></thead><tbody>`;
      if (!lancs.length) {
        blocks += `<tr><td colspan="4">${eh("Nenhum lançamento registado neste protocolo.")}</td></tr>`;
      } else {
        for (const lan of lancs) {
          const vf =
            typeof currencyBRL === "function"
              ? currencyBRL(lan.valor)
              : Number(lan.valor || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
          blocks += `<tr><td>${eh(String(lan.protocoloLancamento || "—"))}</td><td>${eh(String(lan.data || ""))}</td><td>${eh(vf)}</td><td>${eh(String(lan.registradoPorNome || lan.registradoPorCpf || "—"))}</td></tr>`;
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
      blocks += `</tbody></table>`;
      blocks += buildPortalRelatorioValidadosAppClienteHtml(validados || [], eh, {
        showInvalidateBtn: isPortalTitularAdministrador(),
      });
      blocks += `<br><br>`;
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

  /** Investimento acumulado = total pago − (devido aluguel + multas + manutenção). Cor: vermelho se negativo, verde se positivo. */
  function syncOperacaoLocacaoInvestimentoAcumuladoEAlertaDevido() {
    const inpTp = document.getElementById("operacaoLocacaoTotalPago");
    const inpDevido = document.getElementById("operacaoLocacaoValorDevidoAluguel");
    const inpAcum = document.getElementById("operacaoLocacaoInvestimentoAcumulado");
    if (!inpAcum) return;
    const parseVal = (v) => Number(parsePortalLancamentoValorRaw(v ?? ""));
    const totalPago = parseVal(inpTp?.value);
    const devidoAlug = parseVal(inpDevido?.value);
    let devidoMultas = 0;
    let devidoManut = 0;
    const loc = getPortalLocacaoDoFormularioLocacao();
    if (loc) {
      const resumo = computePortalProtocoloResumoFromLoc(loc);
      devidoMultas = parseVal(resumo.valorDevidoMultas);
      devidoManut = parseVal(resumo.valorDevidoManutencao);
    }
    const acum = computePortalInvestimentoAcumuladoNum(devidoAlug, devidoMultas, devidoManut, totalPago);
    inpAcum.value = formatPortalLancamentoSumBrl(acum);
    if (inpDevido) inpDevido.classList.remove("portal-valor-devido-aluguel--negativo");
    inpAcum.classList.remove("portal-investimento-acumulado--negativo", "portal-investimento-acumulado--positivo");
    if (acum < 0) inpAcum.classList.add("portal-investimento-acumulado--negativo");
    else if (acum > 0) inpAcum.classList.add("portal-investimento-acumulado--positivo");
  }

  function refreshOperacaoLancamentoAluguelCpfDatalist() {
    refreshOperacaoLancAluguelPesquisaDatalists({ source: "cpf" });
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

  function refreshOperacaoLancAluguelResumoCompacto() {
    const box = document.getElementById("operacaoLancAluguelResumoCompacto");
    const txt = document.getElementById("operacaoLancAluguelResumoTexto");
    const { nc, cpf } = operacaoLancAluguelProtocoloAtual();
    if (!box || !txt || !nc || cpf.length !== 11) {
      box?.classList.add("hidden");
      return;
    }
    const nome = resolveOperacaoLancAluguelNomePorCpf(cpf);
    const placa = String(document.getElementById("operacaoLancAluguelPlaca")?.value || "").trim() || "—";
    const cpfFmt = typeof formatCpf === "function" ? formatCpf(cpf) : cpf;
    txt.textContent = `${nome || "Cliente"} · CPF ${cpfFmt} · Protocolo ${nc} · Placa ${placa}`;
    box.classList.remove("hidden");
  }

  function preencherLancAluguelFormSimples() {
    const dataEl = document.getElementById("operacaoLancAluguelDataPagamento");
    const valSimples = document.getElementById("operacaoLancAluguelValorSimples");
    if (dataEl) dataEl.value = formatPortalDataBr(new Date());
    const valContrato = String(document.getElementById("operacaoLancAluguelValorAluguel")?.value || "").trim();
    if (valSimples && valContrato) valSimples.value = valContrato;
    if (typeof normalizePortalMaskedFieldValues === "function") normalizePortalMaskedFieldValues();
  }

  function setOperacaoLancAluguelDetalhePanelsVisible(visible) {
    ["operacaoLancAluguelReferenciaPanel", "operacaoLancAluguelContratoPanel"].forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.classList.add("hidden");
      el.setAttribute("hidden", "");
    });
    const resumo = document.getElementById("operacaoLancAluguelResumoCompacto");
    const pag = document.getElementById("operacaoLancAluguelPagamentoPanel");
    const showPag = visible && operacaoLancAluguelSubAtivo === "avulso";
    if (resumo) {
      resumo.classList.toggle("hidden", !showPag);
      if (showPag) {
        refreshOperacaoLancAluguelResumoCompacto();
        resumo.removeAttribute("hidden");
      } else resumo.setAttribute("hidden", "");
    }
    if (pag) {
      pag.classList.toggle("hidden", !showPag);
      if (showPag) {
        pag.removeAttribute("hidden");
        preencherLancAluguelFormSimples();
      } else pag.setAttribute("hidden", "");
    }
    esconderOperacaoLancAluguelSituacao();
    syncPortalOperadorComprovanteSection();
  }

  function hideOperacaoLancAluguelDetalhePanels() {
    setOperacaoLancAluguelDetalhePanelsVisible(false);
  }

  /** Esconde o painel «Situação do protocolo após o pagamento». */
  function esconderOperacaoLancAluguelSituacao() {
    const panel = document.getElementById("operacaoLancAluguelSituacaoPanel");
    if (!panel) return;
    panel.classList.add("hidden");
    panel.setAttribute("hidden", "");
  }

  /**
   * Preenche e mostra o painel «Situação do protocolo após o pagamento» no Lançamento de aluguel.
   * Mostra os totais que antes ficavam no Cadastro de locação: devido do plano, total pago,
   * devido do aluguel, investimento acumulado e total pago no ano de resumo.
   */
  function refreshOperacaoLancAluguelSituacaoAposPagamento(loc) {
    const panel = document.getElementById("operacaoLancAluguelSituacaoPanel");
    if (!panel) return;
    if (!loc) {
      esconderOperacaoLancAluguelSituacao();
      return;
    }
    const resumo = computePortalProtocoloResumoFromLoc(loc);
    const lancs = getPortalLancamentosAluguelDoContrato(loc);
    const totalAnoFmt = formatPortalLancamentoSumBrl(
      sumPortalLancamentosAluguelNoAno(lancs, PORTAL_LANCAMENTO_ALUGUEL_ANO_RESUMO)
    );
    const setVal = (id, v) => {
      const el = document.getElementById(id);
      if (el) el.textContent = v;
    };
    setVal("operacaoLancAluguelSitDevidoPlano", resumo.valorDevidoPlano);
    setVal("operacaoLancAluguelSitTotalPago", resumo.totalPago);
    setVal("operacaoLancAluguelSitDevidoAluguel", resumo.valorDevidoAluguel);
    setVal("operacaoLancAluguelSitTotalPagoAno", totalAnoFmt);
    const acumEl = document.getElementById("operacaoLancAluguelSitInvestAcumulado");
    if (acumEl) {
      acumEl.textContent = resumo.investimentoAcumulado;
      acumEl.classList.remove("portal-lanc-situacao__valor--negativo", "portal-lanc-situacao__valor--positivo");
      if (resumo.investimentoAcumuladoNeg) acumEl.classList.add("portal-lanc-situacao__valor--negativo");
      else if (resumo.investimentoAcumuladoPos) acumEl.classList.add("portal-lanc-situacao__valor--positivo");
    }
    panel.classList.remove("hidden");
    panel.removeAttribute("hidden");
  }

  /** Volta o foco e a rolagem para a área «Pesquisar contrato» (após Limpar dados). */
  function voltarParaPesquisaLancAluguel() {
    hideOperacaoLancAluguelDetalhePanels();
    const hist = document.getElementById("operacaoLancAluguelHistorico");
    if (hist) {
      hist.classList.add("hidden");
      hist.replaceChildren();
    }
    const pesquisa =
      document.querySelector(".portal-lanc-aluguel-pesquisa") ||
      document.getElementById("portal-lanc-aluguel-pesquisa-title");
    const painel = document.getElementById("operacaoPainelDireito");
    if (painel && pesquisa) {
      const painelRect = painel.getBoundingClientRect();
      const alvoRect = pesquisa.getBoundingClientRect();
      const delta = alvoRect.top - painelRect.top + painel.scrollTop - 16;
      painel.scrollTo({ top: Math.max(0, delta), behavior: "smooth" });
    } else if (pesquisa) {
      pesquisa.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    const foco =
      document.getElementById("operacaoLancAluguelNomeBusca") ||
      document.getElementById("operacaoLancAluguelCpf");
    window.requestAnimationFrame(() => {
      foco?.focus({ preventScroll: true });
    });
  }

  function resolveOperacaoLancAluguelNomePorCpf(cpfDigits) {
    if (!cpfDigits || cpfDigits.length !== 11) return "";
    const known = getPortalClienteKnownRecord(cpfDigits);
    if (known) {
      const n = String(known.nome || "").trim();
      if (n) return n;
    }
    if (typeof loadCadastro === "function" && typeof CAD_LOCACOES_KEY !== "undefined") {
      const dig =
        typeof onlyDigits === "function" ? onlyDigits : (s) => String(s ?? "").replace(/\D/g, "");
      const hit = loadCadastro(CAD_LOCACOES_KEY).find((l) => dig(String(l.cpf || "")) === cpfDigits);
      const nLoc = String(hit?.nome || hit?.cliente || "").trim();
      if (nLoc) return nLoc;
    }
    if (typeof getLancamentoClienteCandidates === "function") {
      const dig =
        typeof onlyDigits === "function" ? onlyDigits : (s) => String(s ?? "").replace(/\D/g, "");
      const hit = getLancamentoClienteCandidates().find((c) => dig(String(c.cpf || "")) === cpfDigits);
      if (hit) return String(hit.nome || "").trim();
    }
    return "";
  }

  /** Cor na lista de pesquisa — versão leve (sem recalcular totais do protocolo). */
  function getPortalLancPesquisaLinhaCorClasseFast(loc, vehicleMap) {
    if (!loc) return "portal-lanc-pesquisa-linha--branco";
    const nk =
      typeof normalizeKey === "function" ? normalizeKey : (v) => String(v || "").trim().toUpperCase();
    const ativo = isPortalLocacaoAtiva(loc);
    let isCarro = false;
    let isMoto = false;
    const mod = nk(String(loc.modalidade || ""));
    if (mod.includes("CARRO")) isCarro = true;
    else if (mod.includes("MOTO")) isMoto = true;
    else if (vehicleMap) {
      const plate =
        typeof normalizePlate === "function"
          ? normalizePlate(String(loc.placa || ""))
          : nk(String(loc.placa || "")).replace(/[^A-Z0-9]/g, "");
      const v = plate ? vehicleMap.get(plate) : null;
      if (v) {
        const tipo = nk(String(v.tipo || ""));
        const tag = nk(String(v.tag || ""));
        isCarro = tipo.includes("CARRO") || tag.includes("DKCR");
        isMoto = !isCarro;
      } else {
        isMoto = true;
      }
    } else {
      const tipo = portalInferTipoVeiculoLocacao(loc);
      isCarro = tipo === "CARRO";
      isMoto = tipo === "MOTO";
    }
    const planoKey = nk(String(loc?.plano || loc?.opcaoContrato || ""));
    if (!ativo && (isMoto || isCarro)) return "portal-lanc-pesquisa-linha--vermelho";
    if (ativo && isMoto) {
      if (planoKey.includes("MINHA") && planoKey.includes("MOTO")) return "portal-lanc-pesquisa-linha--azul";
      if (planoKey.includes("MEU") && planoKey.includes("TRANSPORTE")) return "portal-lanc-pesquisa-linha--verde";
    }
    if (ativo && isCarro) return "portal-lanc-pesquisa-linha--amarelo";
    return "portal-lanc-pesquisa-linha--branco";
  }

  function getPortalLancPesquisaLinhaCorClasse(loc) {
    return getPortalLancPesquisaLinhaCorClasseFast(loc, null);
  }

  let portalPesquisaLinhasCache = null;

  function invalidatePesquisaLinhasCache() {
    portalPesquisaLinhasCache = null;
  }

  function collectOperacaoLancAluguelPesquisaLinhas() {
    if (portalPesquisaLinhasCache) return portalPesquisaLinhasCache;
    if (typeof loadCadastro !== "function" || typeof CAD_LOCACOES_KEY === "undefined") return [];
    const dig =
      typeof onlyDigits === "function" ? onlyDigits : (s) => String(s ?? "").replace(/\D/g, "");
    const np =
      typeof normalizePlate === "function"
        ? normalizePlate
        : (x) => String(x || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    const vehicleMap =
      typeof getVehicleMapByPlate === "function" ? getVehicleMapByPlate() : null;
    const linhas = [];
    loadCadastro(CAD_LOCACOES_KEY).forEach((l) => {
      const proto = normPortalNumeroContrato(l.numeroContrato || "");
      if (!proto) return;
      const cpf = dig(String(l.cpf || ""));
      if (cpf.length !== 11) return;
      let nome = String(l.nome || l.cliente || "").trim();
      if (!nome) nome = resolveOperacaoLancAluguelNomePorCpf(cpf);
      linhas.push({
        cpf,
        nome: nome || "(sem nome)",
        proto,
        placa: np(String(l.placa || "")),
        corClasse: getPortalLancPesquisaLinhaCorClasseFast(l, vehicleMap),
        ativo: isPortalLocacaoAtiva(l),
      });
    });
    portalPesquisaLinhasCache = linhas;
    return linhas;
  }

  function filterOperacaoLancAluguelPesquisaLinhas(linhas, filtros) {
    const dig =
      typeof onlyDigits === "function" ? onlyDigits : (s) => String(s ?? "").replace(/\D/g, "");
    const np =
      typeof normalizePlate === "function"
        ? normalizePlate
        : (x) => String(x || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    const cpfPrefix = dig(String(filtros.cpfRaw || "")).slice(0, 11);
    const nomeKey = portalNomeChaveBusca(filtros.nomeRaw || "");
    const protoQ = normPortalNumeroContrato(String(filtros.protoRaw || "").trim());
    const placaQ = np(String(filtros.placaRaw || "").trim());
    return linhas.filter((row) => {
      if (cpfPrefix.length && !row.cpf.startsWith(cpfPrefix)) return false;
      if (nomeKey.length >= 2 && !portalNomeChaveBusca(row.nome).includes(nomeKey)) return false;
      if (protoQ.length && !row.proto.includes(protoQ)) return false;
      if (placaQ.length >= 3 && !(row.placa || "").includes(placaQ)) return false;
      return true;
    });
  }

  function renderOperacaoLancAluguelPesquisaLista(linhas) {
    const panel = document.getElementById("operacaoLancAluguelPesquisaLista");
    if (!panel) return;
    const fmt = typeof formatCpf === "function" ? formatCpf : (d) => d;
    if (!linhas.length) {
      panel.classList.add("hidden");
      panel.setAttribute("hidden", "");
      panel.innerHTML = "";
      return;
    }
    const max = 40;
    const slice = linhas.slice(0, max);
    panel.classList.remove("hidden");
    panel.removeAttribute("hidden");
    panel.innerHTML = `<p class="portal-cliente-prefix-list__title">${slice.length === linhas.length ? slice.length : `${slice.length} de ${linhas.length}`} contrato(s) — clique numa linha:</p><ul class="portal-cliente-prefix-list__ul">${slice
      .map((row) => {
        const placaLbl = row.placa ? ` · ${portalEscapeHtml(row.placa)}` : "";
        const corCls = portalEscapeHtml(row.corClasse || "portal-lanc-pesquisa-linha--branco");
        const status = row.ativo ? "ativo" : "inativo";
        return `<li><button type="button" class="portal-cliente-prefix-list__btn portal-lanc-pesquisa-linha ${corCls}" data-cpf="${portalEscapeHtml(row.cpf)}" data-nome="${portalEscapeHtml(row.nome)}" data-proto="${portalEscapeHtml(row.proto)}" data-placa="${portalEscapeHtml(row.placa || "")}">${portalEscapeHtml(row.nome)} · ${portalEscapeHtml(fmt(row.cpf))} · ${portalEscapeHtml(row.proto)}${placaLbl} · <strong>${status}</strong></button></li>`;
      })
      .join("")}</ul>`;
  }

  /**
   * Atualiza datalists de nome, CPF e protocolo com filtro cruzado em tempo real.
   * @param {{ source?: 'cpf'|'nome'|'proto' }} opts — campo que o utilizador está a editar (evita sobrescrever esse campo).
   */
  function refreshOperacaoLancAluguelPesquisaDatalists(opts = {}) {
    const source = String(opts.source || "");
    const inpCpf = document.getElementById("operacaoLancAluguelCpf");
    const inpNome = document.getElementById("operacaoLancAluguelNomeBusca");
    const inpProto = document.getElementById("operacaoLancAluguelProtocoloBusca");
    const inpPlaca = document.getElementById("operacaoLancAluguelPlacaBusca");
    const dlCpf = document.getElementById("operacaoLancAluguelCpfSugestoes");
    const dlNome = document.getElementById("operacaoLancAluguelNomeSugestoes");
    const dlProto = document.getElementById("operacaoLancAluguelProtocoloSugestoes");
    const dlPlaca = document.getElementById("operacaoLancAluguelPlacaSugestoes");
    if (!dlCpf || !dlNome || !dlProto) return;

    const prevCpf = String(inpCpf?.value || "").trim();
    const prevNome = String(inpNome?.value || "").trim();
    const prevProto = String(inpProto?.value || "").trim();
    const prevPlaca = String(inpPlaca?.value || "").trim();

    const dig =
      typeof onlyDigits === "function" ? onlyDigits : (s) => String(s ?? "").replace(/\D/g, "");
    const fmt = typeof formatCpf === "function" ? formatCpf : (d) => d;

    const todas = collectOperacaoLancAluguelPesquisaLinhas();
    const filtradas = filterOperacaoLancAluguelPesquisaLinhas(todas, {
      cpfRaw: prevCpf,
      nomeRaw: prevNome,
      protoRaw: prevProto,
      placaRaw: prevPlaca,
    });

    const cpfsMap = new Map();
    const nomesMap = new Map();
    const protosSet = new Map();
    const placasSet = new Map();
    filtradas.forEach((row) => {
      if (!cpfsMap.has(row.cpf)) cpfsMap.set(row.cpf, row.nome);
      const nk = portalNomeChaveBusca(row.nome);
      if (!nomesMap.has(nk)) nomesMap.set(nk, { nome: row.nome, cpf: row.cpf });
      if (!protosSet.has(row.proto)) protosSet.set(row.proto, { cpf: row.cpf, nome: row.nome, placa: row.placa });
      if (row.placa && !placasSet.has(row.placa)) placasSet.set(row.placa, { cpf: row.cpf, nome: row.nome, proto: row.proto });
    });

    dlCpf.innerHTML = Array.from(cpfsMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(0, 120)
      .map(
        ([cpf, nome]) =>
          `<option value="${portalEscapeHtml(fmt(cpf))}" label="${portalEscapeHtml(nome)}"></option>`
      )
      .join("");

    dlNome.innerHTML = Array.from(nomesMap.values())
      .sort((a, b) => String(a.nome).localeCompare(String(b.nome), "pt-BR"))
      .slice(0, 120)
      .map(
        (row) =>
          `<option value="${portalEscapeHtml(row.nome)}" label="${portalEscapeHtml(fmt(row.cpf))}"></option>`
      )
      .join("");

    dlProto.innerHTML = Array.from(protosSet.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(0, 120)
      .map(([proto, meta]) => {
        const lbl = `${fmt(meta.cpf)} · ${meta.nome}${meta.placa ? ` · ${meta.placa}` : ""}`;
        return `<option value="${portalEscapeHtml(proto)}" label="${portalEscapeHtml(lbl)}"></option>`;
      })
      .join("");

    if (dlPlaca) {
      dlPlaca.innerHTML = Array.from(placasSet.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .slice(0, 120)
        .map(([placa, meta]) => {
          const lbl = `${meta.proto} · ${meta.nome}`;
          return `<option value="${portalEscapeHtml(placa)}" label="${portalEscapeHtml(lbl)}"></option>`;
        })
        .join("");
    }

    renderOperacaoLancAluguelPesquisaLista(filtradas);

    const cpfsUnicos = [...cpfsMap.keys()];
    const nomesUnicos = [...nomesMap.values()];

    if (source !== "nome" && inpNome) {
      if (cpfsUnicos.length === 1) {
        const nomeCanon = cpfsMap.get(cpfsUnicos[0]) || "";
        if (nomeCanon && nomeCanon !== "(sem nome)") inpNome.value = nomeCanon;
      } else if (source === "cpf") {
        const cpfDig = dig(prevCpf);
        if (cpfDig.length === 11) {
          const nomeCanon = cpfsMap.get(cpfDig) || resolveOperacaoLancAluguelNomePorCpf(cpfDig);
          if (nomeCanon) inpNome.value = nomeCanon;
        } else if (filtradas.length === 1) {
          inpNome.value = filtradas[0].nome === "(sem nome)" ? "" : filtradas[0].nome;
        }
      }
    }

    if (source !== "cpf" && inpCpf) {
      if (nomesUnicos.length === 1) {
        inpCpf.value = fmt(nomesUnicos[0].cpf);
      } else if (source === "nome" && nomesUnicos.length > 1) {
        const key = portalNomeChaveBusca(prevNome);
        const exato = nomesUnicos.filter((r) => portalNomeChaveBusca(r.nome) === key);
        if (exato.length === 1) inpCpf.value = fmt(exato[0].cpf);
      } else if (source === "proto" && filtradas.length === 1) {
        inpCpf.value = fmt(filtradas[0].cpf);
      }
    }

    if (source !== "proto" && inpProto && filtradas.length === 1) {
      inpProto.value = filtradas[0].proto;
    } else if (source === "cpf" && inpProto) {
      const cpfDig = dig(prevCpf);
      const protosDoCpf = filtradas.filter((r) => r.cpf === cpfDig).map((r) => r.proto);
      if (protosDoCpf.length === 1) inpProto.value = protosDoCpf[0];
    }

    const cpfDigAtual = dig(String(inpCpf?.value || prevCpf)).slice(0, 11);
    const protoNormAtual = normPortalNumeroContrato(String(inpProto?.value || prevProto).trim());
    if (source !== "placa" && inpPlaca) {
      let placaAuto = "";
      if (protoNormAtual) {
        const hitProto = filtradas.find((r) => r.proto === protoNormAtual);
        if (hitProto?.placa) placaAuto = hitProto.placa;
      }
      if (!placaAuto && cpfDigAtual.length === 11) {
        const placasDoCpf = [
          ...new Set(filtradas.filter((r) => r.cpf === cpfDigAtual).map((r) => r.placa).filter(Boolean)),
        ];
        if (placasDoCpf.length === 1) placaAuto = placasDoCpf[0];
      }
      if (!placaAuto && filtradas.length === 1 && filtradas[0].placa) {
        placaAuto = filtradas[0].placa;
      }
      if (placaAuto) {
        inpPlaca.value =
          typeof normalizePlate === "function" ? normalizePlate(placaAuto) : String(placaAuto).toUpperCase();
      }
    }

    if (inpCpf && source === "cpf" && typeof formatCpf === "function") {
      const d = dig(inpCpf.value).slice(0, 11);
      inpCpf.value = formatCpf(d);
    }
  }

  function refreshOperacaoLancAluguelNomeDatalist() {
    refreshOperacaoLancAluguelPesquisaDatalists();
  }

  function refreshOperacaoLancAluguelProtocoloBuscaDatalist() {
    refreshOperacaoLancAluguelPesquisaDatalists();
  }

  function aplicarOperacaoLancAluguelPesquisaLinha(cpf, nome, proto, placa) {
    const inpCpf = document.getElementById("operacaoLancAluguelCpf");
    const inpNome = document.getElementById("operacaoLancAluguelNomeBusca");
    const inpProto = document.getElementById("operacaoLancAluguelProtocoloBusca");
    const inpPlaca = document.getElementById("operacaoLancAluguelPlacaBusca");
    const dig =
      typeof onlyDigits === "function" ? onlyDigits : (s) => String(s ?? "").replace(/\D/g, "");
    const np =
      typeof normalizePlate === "function"
        ? normalizePlate
        : (x) => String(x || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    const cpfDigits = dig(String(cpf || ""));
    if (inpCpf && cpfDigits.length === 11 && typeof formatCpf === "function") {
      inpCpf.value = formatCpf(cpfDigits);
    }
    if (inpNome && nome && nome !== "(sem nome)") inpNome.value = String(nome).trim();
    if (inpProto && proto) inpProto.value = String(proto).trim();
    if (inpPlaca && placa) inpPlaca.value = np(placa);
    refreshOperacaoLancAluguelPesquisaDatalists();
    hideOperacaoLancAluguelDetalhePanels();
  }

  function resolveOperacaoLancAluguelLocacaoFromPesquisa() {
    const dig =
      typeof onlyDigits === "function" ? onlyDigits : (s) => String(s ?? "").replace(/\D/g, "");
    const normNome =
      typeof normalizeName === "function" ? normalizeName : (s) => String(s || "").trim().toLowerCase();
    const inpCpf = document.getElementById("operacaoLancAluguelCpf");
    const inpNome = document.getElementById("operacaoLancAluguelNomeBusca");
    const inpProto = document.getElementById("operacaoLancAluguelProtocoloBusca");
    const inpPlaca = document.getElementById("operacaoLancAluguelPlacaBusca");
    const np =
      typeof normalizePlate === "function"
        ? normalizePlate
        : (x) => String(x || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    const cpfDigits = dig(String(inpCpf?.value || ""));
    const protoWant = normPortalNumeroContrato(String(inpProto?.value || "").trim());
    const nomeQ = normNome(String(inpNome?.value || ""));
    const placaWant = np(String(inpPlaca?.value || "").trim());
    if (typeof loadCadastro !== "function" || typeof CAD_LOCACOES_KEY === "undefined") return null;
    const locs = loadCadastro(CAD_LOCACOES_KEY).filter((l) => normPortalNumeroContrato(l.numeroContrato));
    if (placaWant.length >= 3) {
      const matches = locs.filter((l) => np(String(l.placa || "")).includes(placaWant));
      if (!matches.length) return null;
      const pick =
        protoWant && matches.find((l) => normPortalNumeroContrato(l.numeroContrato) === protoWant)
          ? matches.find((l) => normPortalNumeroContrato(l.numeroContrato) === protoWant)
          : matches[0];
      return {
        loc: pick,
        cpfDigits: dig(String(pick.cpf || "")),
        proto: normPortalNumeroContrato(pick.numeroContrato),
      };
    }
    if (protoWant) {
      const hit = locs.find((l) => normPortalNumeroContrato(l.numeroContrato) === protoWant);
      if (hit) return { loc: hit, cpfDigits: dig(String(hit.cpf || "")), proto: protoWant };
    }
    if (cpfDigits.length === 11) {
      const matches = locs.filter((l) => dig(String(l.cpf || "")) === cpfDigits);
      if (!matches.length) return null;
      const pick =
        protoWant && matches.find((l) => normPortalNumeroContrato(l.numeroContrato) === protoWant)
          ? matches.find((l) => normPortalNumeroContrato(l.numeroContrato) === protoWant)
          : matches[0];
      return {
        loc: pick,
        cpfDigits,
        proto: normPortalNumeroContrato(pick.numeroContrato),
      };
    }
    if (nomeQ) {
      const matches = locs.filter((l) => {
        let nome = String(l.nome || l.cliente || "").trim();
        const cpf = dig(String(l.cpf || ""));
        if (!nome && cpf.length === 11 && typeof findClienteByCpfCadastro === "function") {
          nome = String(findClienteByCpfCadastro(cpf)?.nome || "").trim();
        }
        return normNome(nome).includes(nomeQ);
      });
      if (!matches.length) return null;
      const pick = matches[0];
      return {
        loc: pick,
        cpfDigits: dig(String(pick.cpf || "")),
        proto: normPortalNumeroContrato(pick.numeroContrato),
      };
    }
    return null;
  }

  function confirmarOperacaoLancAluguelPesquisa() {
    const msg = document.getElementById("operacaoLancAluguelInlineMsg");
    const hit = resolveOperacaoLancAluguelLocacaoFromPesquisa();
    if (!hit || hit.cpfDigits.length !== 11) {
      hideOperacaoLancAluguelDetalhePanels();
      clearOperacaoLancAluguelPesquisaConfirmada();
      if (msg) msg.textContent = "Informe nome, CPF, protocolo ou placa válidos com locação cadastrada.";
      return;
    }
    aplicarOperacaoLancAluguelPesquisaLinha(
      hit.cpfDigits,
      resolveOperacaoLancAluguelNomePorCpf(hit.cpfDigits) || String(hit.loc?.nome || hit.loc?.cliente || "").trim(),
      hit.proto,
      hit.loc?.placa
    );
    if (msg) msg.textContent = "";
    operacaoLancAluguelPesquisaConfirmada = { cpf: hit.cpfDigits, nc: hit.proto };
    refreshOperacaoLancamentoAluguelProtocoloSelect({ force: true, preserveNc: hit.proto });
    setOperacaoLancAluguelDetalhePanelsVisible(true);
    refreshOperacaoLancAluguelAdminControlsVisibility();
  }

  function clearOperacaoLancamentoAluguelCamposDerivados() {
    [
      "operacaoLancAluguelPlaca",
      "operacaoLancAluguelDataInicio",
      "operacaoLancAluguelDataFim",
      "operacaoLancAluguelTipoPlano",
      "operacaoLancAluguelValorDevidoPlano",
      "operacaoLancAluguelValorDevidoAluguel",
      "operacaoLancAluguelValorDevidoManutencao",
      "operacaoLancAluguelValorDevidoMultas",
      "operacaoLancAluguelTotalPagoContrato",
      "operacaoLancAluguelInvestimentoAcumulado",
      "operacaoLancAluguelValorAluguel",
      "operacaoLancAluguelValorInvestimento",
      "operacaoLancAluguelValorPago",
      "operacaoLancAluguelDataPagamento",
      "operacaoLancAluguelValorEspecie",
      "operacaoLancAluguelValorPix",
      "operacaoLancAluguelValorCartao",
      "operacaoLancAluguelValorSimples",
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
      if (typeof parseCurrencyBR === "function" && typeof currencyBRL === "function") {
        return currencyBRL(parseCurrencyBR(String(raw || "")));
      }
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
    const resumo = computePortalProtocoloResumoFromLoc(loc);
    const assign = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.value = String(val ?? "").trim();
    };
    assign("operacaoLancAluguelTipoPlano", resumo.tipoPlano);
    assign("operacaoLancAluguelValorDevidoPlano", resumo.valorDevidoPlano);
    assign("operacaoLancAluguelValorDevidoAluguel", resumo.valorDevidoAluguel);
    assign("operacaoLancAluguelValorDevidoManutencao", resumo.valorDevidoManutencao);
    assign("operacaoLancAluguelValorDevidoMultas", resumo.valorDevidoMultas);
    assign("operacaoLancAluguelTotalPagoContrato", resumo.totalPago);
    assign("operacaoLancAluguelInvestimentoAcumulado", resumo.investimentoAcumulado);
    const invEl = document.getElementById("operacaoLancAluguelInvestimentoAcumulado");
    if (invEl) {
      invEl.classList.remove("portal-investimento-acumulado--negativo", "portal-investimento-acumulado--positivo");
      if (resumo.investimentoAcumuladoNeg) invEl.classList.add("portal-investimento-acumulado--negativo");
      else if (resumo.investimentoAcumuladoPos) invEl.classList.add("portal-investimento-acumulado--positivo");
    }
    ["operacaoLancAluguelValorEspecie", "operacaoLancAluguelValorPix", "operacaoLancAluguelValorCartao", "operacaoLancAluguelValorPago", "operacaoLancAluguelDataPagamento", "operacaoLancAluguelValorSimples"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.value = "";
    });
    syncOperacaoLancAluguelValorPagoFromMeios();
    preencherLancAluguelFormSimples();
    refreshOperacaoLancAluguelAdminControlsVisibility();
  }

  function portalLancAluguelDiaPagamentoColIdx(raw, loc) {
    const s = String(raw || "")
      .trim()
      .toUpperCase()
      .normalize("NFD")
      .replace(/\p{M}/gu, "");
    if (s.startsWith("DOM")) return 0;
    const norm =
      typeof window.__DK_normDiaPagamentoMultas === "function"
        ? window.__DK_normDiaPagamentoMultas(raw)
        : "";
    const map = { SEG: 1, TER: 2, QUA: 3, QUI: 4, SEX: 5, SAB: 6, DOM: 0 };
    if (norm && Object.prototype.hasOwnProperty.call(map, norm)) return map[norm];
    const inicio = String(loc?.inicio || "").trim();
    if (inicio && typeof parseBrDate === "function") {
      const d = parseBrDate(inicio);
      if (d && !Number.isNaN(d.getTime())) return d.getDay();
    }
    return 3;
  }

  function portalLancAluguelDiaPagamentoLegivel(colIdx) {
    const labels = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
    return labels[colIdx] || "Quarta-feira";
  }

  function portalIsoParaDataBr(iso) {
    const m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return "";
    return `${m[3]}/${m[2]}/${m[1]}`;
  }

  function portalLancAluguelEntryNotifyKey(entry) {
    return `${String(entry?.data || "").trim()}|${Number(entry?.valor) || 0}`;
  }

  async function portalNotificarClientePagamentosLancados(cpfDigits, nc, loc, entries, keysBefore, opts) {
    if (!Array.isArray(entries) || !entries.length) {
      return { ok: true, skipped: true, count: 0, msg: "Nenhum pagamento novo para avisar." };
    }
    const notifyFn =
      typeof window.__DK_clienteNotificacaoPagamentoLancadoComNuvem === "function"
        ? window.__DK_clienteNotificacaoPagamentoLancadoComNuvem
        : typeof window.__DK_clienteNotificacaoPagamentoLancado === "function"
          ? window.__DK_clienteNotificacaoPagamentoLancado
          : null;
    if (!notifyFn) {
      return { ok: false, count: 0, msg: "Módulo de avisos ao cliente indisponível." };
    }
    const before = keysBefore instanceof Set ? keysBefore : new Set();
    const anoFiltro = Number(opts?.ano);
    let count = 0;
    let lastMsg = "";
    for (const entry of entries) {
      if (entry?.origemComprovanteClienteId || entry?.confirmadoViaAppCliente) continue;
      if (Number.isFinite(anoFiltro)) {
        const dt = typeof parseBrDate === "function" ? parseBrDate(String(entry?.data || "").trim()) : null;
        if (!dt || Number.isNaN(dt.getTime()) || dt.getFullYear() !== anoFiltro) continue;
      }
      const valor = Number(entry?.valor);
      const dataPagamento = String(entry?.data || "").trim();
      if (!Number.isFinite(valor) || valor <= 0 || !dataPagamento) continue;
      if (before.has(portalLancAluguelEntryNotifyKey(entry))) continue;
      const res = await notifyFn({
        cpf: cpfDigits,
        protocolo: nc,
        placa: loc?.placa,
        valor,
        dataPagamento,
      });
      if (!res?.ok) {
        return {
          ok: false,
          count,
          msg: res.msg || "Nuvem não confirmou o aviso — o cliente ainda não recebe a informação.",
        };
      }
      count += 1;
      lastMsg = res.msg || lastMsg;
    }
    if (!count) {
      return { ok: true, skipped: true, count: 0, msg: "Nenhum pagamento novo para avisar." };
    }
    return {
      ok: true,
      count,
      cloudOk: true,
      msg:
        lastMsg ||
        "Lançamento de aluguel realizado com sucesso. Informação já enviada para o cliente.",
    };
  }

  async function persistPortalLancAluguelCalendarioAno(cpfDigits, ncNorm, ano, celulasMap) {
    if (!getPortalSessaoAdminRole()) return false;
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
    materializarPortalLancamentosAluguelMutaveisNoLoc(loc);
    const reg = getPortalSessaoParaRegistroLancamentoAluguel();
    const arr = loc.portalLancamentosAluguel || [];
    const keysBefore = new Set(
      arr
        .filter((x) => {
          const dt = typeof parseBrDate === "function" ? parseBrDate(String(x.data || "").trim()) : null;
          if (!dt || Number.isNaN(dt.getTime()) || dt.getFullYear() !== ano) return false;
          if (x.origemComprovanteClienteId || x.confirmadoViaAppCliente) return false;
          return true;
        })
        .map(portalLancAluguelEntryNotifyKey)
    );
    const manter = arr.filter((x) => {
      const dt = typeof parseBrDate === "function" ? parseBrDate(String(x.data || "").trim()) : null;
      if (!dt || Number.isNaN(dt.getTime()) || dt.getFullYear() !== ano) return true;
      if (x.origemComprovanteClienteId || x.confirmadoViaAppCliente) return true;
      return false;
    });
    if (celulasMap && typeof celulasMap.forEach === "function") {
      celulasMap.forEach((val, iso) => {
        const v = Number(val) || 0;
        if (v <= 0) return;
        if (!String(iso).startsWith(String(ano))) return;
        const dataStr = portalIsoParaDataBr(iso);
        if (!dataStr) return;
        manter.push({
          data: dataStr,
          valor: v,
          valorEspecie: v,
          valorPix: 0,
          valorCartao: 0,
          createdAt: Date.now(),
          registradoPorCpf: reg?.cpf || "",
          registradoPorNome: reg?.nome || "",
          protocoloLancamento:
            typeof window.__DK_gerarProtocoloLancamento === "function"
              ? window.__DK_gerarProtocoloLancamento(reg?.cpf || "", Date.now())
              : "",
          ficticio: portalRegistroEhTeste(loc),
        });
      });
    }
    loc.portalLancamentosAluguel = manter;
    const ok = finalizarPersistPortalLancamentosLoc(locs, loc, cpfDigits, nc);
    if (!ok) return { ok: false };
    const notify = await portalNotificarClientePagamentosLancados(
      cpfDigits,
      nc,
      loc,
      loc.portalLancamentosAluguel,
      keysBefore,
      { ano }
    );
    return { ok: true, notify };
  }

  let portalLancAluguelProtocoloSyncCpf = "";
  /** CPF + protocolo confirmados na pesquisa (modo avulso — select oculto). */
  let operacaoLancAluguelPesquisaConfirmada = null;
  let portalLancAluguelConfirmCallback = null;

  function clearOperacaoLancAluguelPesquisaConfirmada() {
    operacaoLancAluguelPesquisaConfirmada = null;
  }

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
    if (typeof window.__DK_consolidarLancamentosAluguelLoc === "function") {
      window.__DK_consolidarLancamentosAluguelLoc(loc, { mutate: true });
    }
    const normArr = (loc.portalLancamentosAluguel || []).map(normalizePortalLancamentoAluguelEntry).filter(Boolean);
    loc.portalLancamentosAluguel = normArr.map((x) => {
      const row = {
        data: x.data,
        valor: x.valor,
        createdAt: typeof x.createdAt === "number" && Number.isFinite(x.createdAt) ? x.createdAt : Date.now(),
        registradoPorCpf: String(x.registradoPorCpf || "").replace(/\D/g, "").slice(0, 11),
        registradoPorNome: String(x.registradoPorNome || "").trim(),
        protocoloLancamento: String(x.protocoloLancamento || "").trim(),
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
    loc.updatedAt = Date.now();
    try {
      saveCadastro(CAD_LOCACOES_KEY, locs);
    } catch (err) {
      console.error(err);
      return false;
    }
    portalPushCloudSnapshotAfterPersist();
    refreshOperacaoLocacaoTotaisPortalLancamentoUi(cpfDigits, ncNorm);
    refreshOperacaoLocacaoLancamentosHistorico(cpfDigits, ncNorm);
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
    if (window.__DK_IS_DEMO_DEPLOY__ !== true) {
      const cpfOp = String(reg?.cpf || "").replace(/\D/g, "").slice(0, 11);
      if (cpfOp.length !== 11) return false;
    }
    const ve = Number(parsePortalLancamentoValorRaw(meios?.valorEspecie ?? 0));
    const vp = Number(parsePortalLancamentoValorRaw(meios?.valorPix ?? 0));
    const vc = Number(parsePortalLancamentoValorRaw(meios?.valorCartao ?? 0));
    const entry = {
      data: dataStr,
      valor: valorNum,
      createdAt: Date.now(),
      registradoPorCpf: reg?.cpf || "",
      registradoPorNome: reg?.nome || "",
      protocoloLancamento:
        typeof window.__DK_gerarProtocoloLancamento === "function"
          ? window.__DK_gerarProtocoloLancamento(reg?.cpf || "", Date.now())
          : "",
      valorEspecie: Number.isFinite(ve) && ve >= 0 ? ve : 0,
      valorPix: Number.isFinite(vp) && vp >= 0 ? vp : 0,
      valorCartao: Number.isFinite(vc) && vc >= 0 ? vc : 0,
      ficticio: portalRegistroEhTeste(loc),
    };
    loc.portalLancamentosAluguel.push(entry);
    const ok = finalizarPersistPortalLancamentosLoc(locs, loc, cpfDigits, nc);
    if (!ok) return { ok: false };
    return { ok: true, entry, cpfDigits, nc, loc };
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

  function apagarPortalLancamentoAluguelPorProtocolo(cpfDigits, ncNorm, protocoloLancamento) {
    if (!isPortalTitularAdministrador()) return false;
    const proto = String(protocoloLancamento || "").trim();
    if (!proto) return false;
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
    materializarPortalLancamentosAluguelMutaveisNoLoc(loc);
    const before = (loc.portalLancamentosAluguel || []).length;
    loc.portalLancamentosAluguel = (loc.portalLancamentosAluguel || []).filter(
      (x) => String(x.protocoloLancamento || "").trim() !== proto
    );
    if (loc.portalLancamentosAluguel.length === before) return false;
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
    const loc = getPortalLocacaoLancAluguelAtual();
    if (!loc) {
      wrap.classList.add("hidden");
      wrap.setAttribute("hidden", "");
      wrap.replaceChildren();
      return;
    }
    const lancs = getPortalLancamentosAluguelContabilizaveisDoContrato(loc);
    const owner = isPortalTitularAdministrador();
    const html =
      typeof window.__DK_renderHistoricoLancamentosHtml === "function"
        ? window.__DK_renderHistoricoLancamentosHtml(lancs, { adminActions: owner })
        : `<p class="subtext">${lancs.length} pagamento(s)</p>`;
    wrap.innerHTML = html;
    wrap.classList.remove("hidden");
    wrap.removeAttribute("hidden");
    wrap.querySelectorAll("[data-lanc-aluguel-del]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const proto = String(btn.getAttribute("data-lanc-aluguel-del") || "").trim();
        if (!proto) return;
        const cpf = (
          typeof onlyDigits === "function"
            ? onlyDigits(document.getElementById("operacaoLancAluguelCpf")?.value || "")
            : String(document.getElementById("operacaoLancAluguelCpf")?.value || "").replace(/\D/g, "")
        ).slice(0, 11);
        const nc = normPortalNumeroContrato(
          document.getElementById("operacaoLancAluguelProtocoloSelect")?.value ||
            operacaoLancAluguelProtocoloAtual() ||
            ""
        );
        openPortalLancAluguelConfirmModal("Apagar este lançamento?", () => {
          if (apagarPortalLancamentoAluguelPorProtocolo(cpf, nc, proto)) {
            const refreshed = getPortalLocacaoLancAluguelAtual();
            if (refreshed) applyOperacaoLancamentoAluguelFromLoc(refreshed);
          }
        });
      });
    });
    wrap.querySelectorAll("[data-lanc-aluguel-edit]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const proto = String(btn.getAttribute("data-lanc-aluguel-edit") || "").trim();
        const row = lancs.find((x) => String(x.protocoloLancamento || "").trim() === proto);
        if (!row) return;
        const idx = (loc.portalLancamentosAluguel || []).findIndex(
          (x) => String(x.protocoloLancamento || "").trim() === proto
        );
        openPortalLancAluguelEditModal(idx, row.valor, row.data);
      });
    });
  }

  function getPortalLocacaoLancAluguelAtual() {
    const sel = document.getElementById("operacaoLancAluguelProtocoloSelect");
    const inpCpf = document.getElementById("operacaoLancAluguelCpf");
    if (!inpCpf) return null;
    const digits =
      typeof onlyDigits === "function" ? onlyDigits(inpCpf.value) : String(inpCpf.value || "").replace(/\D/g, "");
    if (digits.length !== 11) return null;
    const nc = normPortalNumeroContrato(
      (sel && !sel.disabled && sel.value) || operacaoLancAluguelProtocoloAtual() || ""
    );
    if (!nc) return null;
    return collectPortalLocacoesComProtocoloByCpf(digits).find((l) => normPortalNumeroContrato(l.numeroContrato) === nc) || null;
  }

  function refreshOperacaoLocacaoLancamentosHistorico(cpfDigits, ncNorm) {
    const wrap = document.getElementById("operacaoLocacaoLancamentosHistorico");
    if (!wrap) return;
    const dig =
      typeof onlyDigits === "function" ? onlyDigits : (s) => String(s ?? "").replace(/\D/g, "");
    const cpf = dig(String(cpfDigits || "")).slice(0, 11);
    const nc = normPortalNumeroContrato(ncNorm);
    if (cpf.length !== 11 || !nc) {
      wrap.classList.add("hidden");
      wrap.setAttribute("hidden", "");
      wrap.replaceChildren();
      return;
    }
    const loc = collectPortalLocacoesByCpf(cpf).find((l) => normPortalNumeroContrato(l.numeroContrato) === nc);
    if (!loc) {
      wrap.classList.add("hidden");
      wrap.setAttribute("hidden", "");
      wrap.replaceChildren();
      return;
    }
    const lancs = getPortalLancamentosAluguelContabilizaveisDoContrato(loc);
    wrap.innerHTML =
      typeof window.__DK_renderHistoricoLancamentosHtml === "function"
        ? window.__DK_renderHistoricoLancamentosHtml(lancs, { adminActions: false })
        : `<p class="subtext">${lancs.length} pagamento(s)</p>`;
    wrap.classList.remove("hidden");
    wrap.removeAttribute("hidden");
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
      inpV.value =
        typeof currencyBRL === "function"
          ? currencyBRL(Number(valorNum || 0))
          : Number(valorNum || 0).toLocaleString("pt-BR", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            });
    }
    if (inpD) {
      const rawD = String(dataStr || "").trim();
      inpD.value =
        typeof formatDateMask === "function" ? formatDateMask(rawD) : rawD;
    }
    if (typeof normalizePortalMaskedFieldValues === "function") normalizePortalMaskedFieldValues();
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
    syncPortalOperadorComprovanteSection();
    refreshOperacaoLancAluguelResumoCompacto();
  }

  function syncOperacaoLancamentoAluguelAfterCpfEdit() {
    const inpCpf = document.getElementById("operacaoLancAluguelCpf");
    if (!inpCpf) return;
    const d = (
      typeof onlyDigits === "function" ? onlyDigits(inpCpf.value) : String(inpCpf.value || "").replace(/\D/g, "")
    ).slice(0, 11);
    if (typeof formatCpf === "function") inpCpf.value = formatCpf(d);
    refreshOperacaoLancamentoAluguelCpfDatalist();
    refreshOperacaoLancAluguelPesquisaDatalists();
    refreshPortalRelClienteCpfDatalist();
    refreshPortalRelPlacaDatalist();
  }

  function clearOperacaoLancamentoAluguelForm(opts = {}) {
    const voltarPesquisa = opts.voltarPesquisa !== false;
    hideOperacaoLancAluguelDetalhePanels();
    const hist = document.getElementById("operacaoLancAluguelHistorico");
    if (hist) {
      hist.classList.add("hidden");
      hist.replaceChildren();
    }
    const blocoPesquisa = document.getElementById("operacaoLancAluguelBlocoPesquisaRef");
    blocoPesquisa?.querySelectorAll("input").forEach((inp) => {
      inp.value = "";
    });
    const form = document.getElementById("formOperacaoLancamentoAluguelInline");
    form?.querySelectorAll("input").forEach((inp) => {
      inp.value = "";
    });
    const lista = document.getElementById("operacaoLancAluguelPesquisaLista");
    if (lista) {
      lista.classList.add("hidden");
      lista.setAttribute("hidden", "");
      lista.innerHTML = "";
    }
    const sel = document.getElementById("operacaoLancAluguelProtocoloSelect");
    if (sel) {
      sel.replaceChildren();
      const o = document.createElement("option");
      o.value = "";
      o.textContent = "—";
      sel.appendChild(o);
      sel.disabled = true;
    }
    clearOperacaoLancamentoAluguelCamposDerivados();
    portalLancAluguelProtocoloSyncCpf = "";
    clearOperacaoLancAluguelPesquisaConfirmada();
    const msg = document.getElementById("operacaoLancAluguelInlineMsg");
    if (msg) msg.textContent = "";
    refreshOperacaoLancAluguelPesquisaDatalists();
    refreshPortalRelClienteCpfDatalist();
    refreshPortalRelPlacaDatalist();
    refreshOperacaoLancAluguelAdminControlsVisibility();
    if (voltarPesquisa) voltarParaPesquisaLancAluguel();
  }

  function bindOperacaoLocacaoAutofill() {
    const inpCpf = document.getElementById("operacaoLocacaoCpf");
    const inpNome = document.getElementById("operacaoLocacaoCliente");
    const inpPlaca = document.getElementById("operacaoLocacaoPlaca");
    const inpModelo = document.getElementById("operacaoLocacaoModelo");
    const panelPlaca = document.getElementById("operacaoLocacaoPlacaLista");
    const comboPlaca = document.getElementById("operacaoLocacaoPlacaCombo");

    document.getElementById("operacaoLocacaoProtocoloSelect")?.addEventListener("change", onOperacaoLocacaoProtocoloSelectChange);
    document.getElementById("operacaoLocacaoProtocoloAdminCarregarBtn")?.addEventListener("click", () => {
      const raw = String(document.getElementById("operacaoLocacaoProtocoloAdminBusca")?.value || "").trim();
      loadOperacaoLocacaoByProtocoloNumero(raw);
    });
    document.getElementById("operacaoLocacaoProtocoloAdminBusca")?.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter") {
        ev.preventDefault();
        const raw = String(ev.target?.value || "").trim();
        loadOperacaoLocacaoByProtocoloNumero(raw);
      }
    });

    [inpCpf, inpNome].filter(Boolean).forEach((el) => {
      el.addEventListener("focus", () => refreshOperacaoLocacaoDatalists(), { passive: true });
    });

    inpPlaca?.addEventListener("focus", () => {
      refreshOperacaoLocacaoDatalists();
      const val = String(inpPlaca.value || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
      if (val === "ABC1D23" && !portalLocacaoPlacasLivresCache.some((x) => x.placa === val)) {
        inpPlaca.value = "";
      }
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
      if (digits.length === 11 && inpNome) {
        const nome =
          typeof resolveOperacaoLancAluguelNomePorCpf === "function"
            ? resolveOperacaoLancAluguelNomePorCpf(digits)
            : String(findClienteByCpfCadastro?.(digits)?.nome || "").trim();
        if (nome) inpNome.value = nome;
      }
      void portalEnsureLocacoesFromCloud({ force: false }).finally(() => {
        refreshOperacaoLocacaoProtocoloPicker({ force: true });
      });
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
      if (digits.length === 11 && inpNome) {
        const nome =
          typeof resolveOperacaoLancAluguelNomePorCpf === "function"
            ? resolveOperacaoLancAluguelNomePorCpf(digits)
            : String(findClienteByCpfCadastro?.(digits)?.nome || "").trim();
        if (nome) inpNome.value = nome;
      }
      refreshOperacaoLocacaoProtocoloPicker({ force: true });
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
    if (typeof currencyBRL === "function") return currencyBRL(Number(num || 0));
    return Number(num || 0).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
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

  window.addEventListener("dk-locacoes-synced", () => {
    refreshOperacaoLocacaoProtocoloPicker({ force: true });
  });
  refreshOperacaoLocacaoProtocoloPicker({ force: true });
  bindOperacaoLocacaoValorPlanoComputed();
  bindOperacaoClienteCpfAssist();
  bindOperacaoVeiculoPlacaAssist();
  document.getElementById("formOperacaoVeiculoInline")?.addEventListener("submit", persistPortalOperacaoVeiculoInlineSubmit);
  document.getElementById("operacaoVeiculoTipo")?.addEventListener("change", refreshOperacaoVeiculoTagPreview);
  document.getElementById("operacaoVeiculoLimparBtn")?.addEventListener("click", (e) => {
    e.preventDefault();
    const form = document.getElementById("formOperacaoVeiculoInline");
    if (form && typeof form.reset === "function") form.reset();
    hideOperacaoVeiculoPlacaDropdown();
    refreshOperacaoVeiculoTagPreview();
    portalResetAmbienteForm("Veiculo");
    refreshOperacaoVeiculoApagarBtn("");
    const msg = document.getElementById("operacaoVeiculoInlineMsg");
    if (msg) msg.textContent = "";
  });
  document.getElementById("operacaoVeiculoApagarBtn")?.addEventListener("click", (e) => {
    e.preventDefault();
    if (!isPortalTitularAdministrador()) return;
    const plateRaw = String(document.getElementById("operacaoVeiculoPlaca")?.value || "");
    const plate =
      typeof normalizePlate === "function"
        ? normalizePlate(plateRaw)
        : plateRaw.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    const record = plate && typeof findPortalVeiculoByPlaca === "function" ? findPortalVeiculoByPlaca(plate) : null;
    const msg = document.getElementById("operacaoVeiculoInlineMsg");
    if (!record || !portalRegistroEhTeste(record)) {
      window.alert("Só veículos marcados como TESTE podem ser apagados.");
      return;
    }
    if (!window.confirm(`Apagar veículo de TESTE ${plate} e protocolos de teste desta placa?`)) return;
    const nLoc = portalApagarLocacoesTestePorPlaca(plate);
    const key =
      typeof PORTAL_VEICULOS_KEY !== "undefined" ? PORTAL_VEICULOS_KEY : CAD_VEICULOS_KEY;
    if (typeof loadCadastro === "function" && typeof saveCadastro === "function" && key) {
      const veiculos = loadCadastro(key).filter((v) => {
        const p =
          typeof normalizePlate === "function"
            ? normalizePlate(String(v.placa || ""))
            : String(v.placa || "")
                .trim()
                .toUpperCase()
                .replace(/[^A-Z0-9]/g, "");
        return p !== plate;
      });
      saveCadastro(key, veiculos);
    }
    portalPushCloudSnapshotAfterPersist();
    const form = document.getElementById("formOperacaoVeiculoInline");
    if (form && typeof form.reset === "function") form.reset();
    portalResetAmbienteForm("Veiculo");
    refreshOperacaoVeiculoApagarBtn("");
    renderOperacaoVeiculoResumoFrota();
    if (msg) {
      msg.textContent =
        nLoc > 0
          ? `Veículo de teste apagado (${nLoc} protocolo(s) de teste removido(s)).`
          : "Veículo de teste apagado.";
    }
  });
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
    portalResetAmbienteForm("Locacao");
    refreshOperacaoLocacaoApagarProtocoloBtn();
  }

  document.getElementById("operacaoLocacaoLimparBtn")?.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    clearOperacaoLocacaoInlineForm();
  });

  document.getElementById("operacaoLocacaoApagarProtocoloBtn")?.addEventListener("click", (e) => {
    e.preventDefault();
    if (!isPortalTitularAdministrador()) return;
    const nc = normPortalNumeroContrato(String(document.getElementById("operacaoLocacaoProtocolo")?.value || ""));
    const msg = document.getElementById("operacaoLocacaoInlineMsg");
    if (!nc) {
      if (msg) msg.textContent = "Carregue um protocolo de TESTE para apagar.";
      return;
    }
    const loc = findPortalLocacaoByProtocolo(nc);
    if (!loc || !portalRegistroEhTeste(loc)) {
      window.alert("Só protocolos marcados como TESTE podem ser apagados.");
      return;
    }
    if (!window.confirm(`Apagar protocolo de TESTE ${nc} e todos os pagamentos fictícios ligados?`)) return;
    if (!portalApagarProtocoloTeste(nc)) {
      window.alert("Não foi possível apagar o protocolo.");
      return;
    }
    portalPushCloudSnapshotAfterPersist();
    clearOperacaoLocacaoInlineForm();
    if (msg) msg.textContent = `Protocolo de teste ${nc} apagado.`;
  });

  portalSyncAmbienteCadastroAdminUi();

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

  let portalWaMergedSearchRowsCache = null;

  function portalWaClienteRecordForCpf(cpfDigits) {
    const dig = portalWaDig(cpfDigits);
    if (dig.length !== 11) return null;
    let cli = typeof findClienteByCpfCadastro === "function" ? findClienteByCpfCadastro(dig) : null;
    if (!cli && typeof getPortalBundledClienteByCpf === "function") cli = getPortalBundledClienteByCpf(dig);
    return cli;
  }

  function portalWaNomeFromLocacoes(cpfDigits) {
    const dig = portalWaDig(cpfDigits);
    if (dig.length !== 11 || typeof loadCadastro !== "function" || typeof CAD_LOCACOES_KEY === "undefined") return "";
    const loc = loadCadastro(CAD_LOCACOES_KEY).find((l) => portalWaDig(l.cpf || "") === dig);
    return String(loc?.cliente || "").trim();
  }

  /** Com locação ativa: placa da locação ativa mais recente (início); senão última locação finalizada (fim / início). */
  function portalWaResolvePlacaPreferida(cpfDigits) {
    const dig = portalWaDig(cpfDigits);
    if (dig.length !== 11 || typeof loadCadastro !== "function" || typeof CAD_LOCACOES_KEY === "undefined") return "";
    const locs = loadCadastro(CAD_LOCACOES_KEY).filter((l) => portalWaDig(l.cpf || "") === dig);
    if (!locs.length) return "";
    const parseD = typeof parseBrDate === "function" ? parseBrDate : () => null;
    const timeOr0 = (d) => (d instanceof Date && !Number.isNaN(d.getTime()) ? d.getTime() : 0);
    const ativas = locs.filter((l) => !String(l.fim || "").trim());
    if (ativas.length) {
      ativas.sort((a, b) => {
        const ta = timeOr0(parseD(String(a.inicio || "").trim()));
        const tb = timeOr0(parseD(String(b.inicio || "").trim()));
        if (ta !== tb) return tb - ta;
        return Number(b.createdAt || b.id || 0) - Number(a.createdAt || a.id || 0);
      });
      return portalWaNormalizePlate(ativas[0].placa || "");
    }
    locs.sort((a, b) => {
      const ta = timeOr0(parseD(String(a.fim || "").trim())) || timeOr0(parseD(String(a.inicio || "").trim()));
      const tb = timeOr0(parseD(String(b.fim || "").trim())) || timeOr0(parseD(String(b.inicio || "").trim()));
      if (ta !== tb) return tb - ta;
      return Number(b.createdAt || b.id || 0) - Number(a.createdAt || a.id || 0);
    });
    return portalWaNormalizePlate(locs[0].placa || "");
  }

  function portalWaMakeRowForCpf(cpfDigits) {
    const dig = portalWaDig(cpfDigits);
    if (dig.length !== 11) return null;
    const cli = portalWaClienteRecordForCpf(dig);
    const nome = String(cli?.nome || "").trim() || portalWaNomeFromLocacoes(dig) || "—";
    const placa = portalWaResolvePlacaPreferida(dig);
    const celularRaw = String(cli?.celular || "").trim();
    const celularWa = portalWaDigitsForWaMe(celularRaw);
    return { cpf: dig, placa, nome, celularRaw, celularWa };
  }

  function portalWaGetMergedSearchRows() {
    if (portalWaMergedSearchRowsCache) return portalWaMergedSearchRowsCache;
    if (!portalWaDatasetCache.length) portalWaDatasetCache = portalWaBuildClienteDataset();
    const byCpf = new Map();
    portalWaDatasetCache.forEach((r) => byCpf.set(r.cpf, { ...r }));
    if (typeof loadCadastro === "function" && typeof CAD_CLIENTES_KEY !== "undefined") {
      loadCadastro(CAD_CLIENTES_KEY).forEach((c) => {
        const cpf = portalWaDig(c.cpf || "");
        if (cpf.length !== 11 || byCpf.has(cpf)) return;
        const row = portalWaMakeRowForCpf(cpf);
        if (row) byCpf.set(cpf, row);
      });
    }
    portalWaMergedSearchRowsCache = Array.from(byCpf.values()).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    return portalWaMergedSearchRowsCache;
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
    portalWaMergedSearchRowsCache = null;
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
    const data = portalWaGetMergedSearchRows();
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
          if (kind === "nome") {
            return `<button type="button" class="portal-placa-dropdown__opt" role="option" tabindex="-1" data-wa-i="${i}">
              <span class="portal-placa-dropdown__plate portal-wa-dd-primary">${portalEscapeHtml(r.nome)}</span>
              <span class="portal-placa-dropdown__model">Placa ${portalEscapeHtml(r.placa || "—")} · ${portalEscapeHtml(cpfEx)}</span>
            </button>`;
          }
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
    portalWaFillScreenFromRow(row);
    portalWaHideAllDropdowns();
  }

  function portalWaFillScreenFromRow(row, opts = {}) {
    if (!row) return;
    const silent = Boolean(opts.silent);
    const inpCpf = document.getElementById("portalWaInputCpf");
    const inpNome = document.getElementById("portalWaInputNome");
    const inpPlaca = document.getElementById("portalWaInputPlaca");
    const hint = document.getElementById("portalWaSelectedHint");
    const msg = document.getElementById("portalWaMsg");
    if (inpCpf) inpCpf.value = typeof formatCpf === "function" ? formatCpf(row.cpf) : row.cpf;
    if (inpNome) inpNome.value = row.nome;
    if (inpPlaca) inpPlaca.value = row.placa || "";
    if (hint) {
      hint.textContent = `Selecionado: ${row.nome} · Placa ${row.placa || "—"} · Celular no cadastro: ${row.celularRaw || "(vazio)"}`;
    }
    if (msg && !silent) msg.textContent = "";
    portalWaSelectedClienteRow = row;
  }

  function portalWaSyncFromCpf11(digits) {
    const dig = portalWaDig(digits);
    if (dig.length !== 11) return;
    const hasCli = Boolean(portalWaClienteRecordForCpf(dig));
    const locs =
      typeof loadCadastro === "function" && typeof CAD_LOCACOES_KEY !== "undefined"
        ? loadCadastro(CAD_LOCACOES_KEY).filter((l) => portalWaDig(l.cpf || "") === dig)
        : [];
    if (!hasCli && !locs.length) return;
    const row = portalWaMakeRowForCpf(dig);
    if (!row) return;
    portalWaFillScreenFromRow(row, { silent: true });
    const msg = document.getElementById("portalWaMsg");
    if (msg) msg.textContent = "";
  }

  function portalWaTrySyncNomeExact() {
    const inpNome = document.getElementById("portalWaInputNome");
    if (!inpNome) return;
    const q = String(inpNome.value || "").trim();
    if (q.length < 2) return;
    const nn = typeof normalizeName === "function" ? normalizeName(q) : q.toLowerCase();
    const pool = portalWaFilterRows("nome", q);
    const exact = pool.filter((r) => {
      const nk = typeof normalizeName === "function" ? normalizeName(r.nome) : String(r.nome || "").toLowerCase();
      return nk === nn;
    });
    if (exact.length === 1) {
      portalWaFillScreenFromRow(exact[0]);
      portalWaHideAllDropdowns();
      return;
    }
    if (pool.length === 1 && q.length >= 3) {
      portalWaFillScreenFromRow(pool[0]);
      portalWaHideAllDropdowns();
    }
  }

  function portalWaTrySyncPlacaUnique() {
    const inpPlaca = document.getElementById("portalWaInputPlaca");
    if (!inpPlaca) return;
    const pq = portalWaNormalizePlate(inpPlaca.value);
    if (!pq || pq.length < 5) return;
    const rows = portalWaFilterRows("placa", inpPlaca.value);
    if (rows.length !== 1) return;
    portalWaFillScreenFromRow(rows[0]);
    portalWaHideAllDropdowns();
  }

  function portalWaClearForm() {
    portalWaSelectedClienteRow = null;
    ["portalWaInputCpf", "portalWaInputNome", "portalWaInputPlaca"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.value = "";
    });
    const ta = document.getElementById("portalWaMensagemTexto");
    if (ta) ta.value = "";
    const hint = document.getElementById("portalWaSelectedHint");
    if (hint) hint.textContent = "";
    const msg = document.getElementById("portalWaMsg");
    if (msg) msg.textContent = "";
  }

  function portalWaGetSendSecret() {
    return String(document.querySelector('meta[name="dk-whatsapp-send-secret"]')?.getAttribute("content") || "").trim();
  }

  const PORTAL_WA_SEND_API = "/api/whatsapp-send";

  async function portalWaSendComposedMessage() {
    const msgEl = document.getElementById("portalWaMsg");
    const ta = document.getElementById("portalWaMensagemTexto");
    const row = portalWaSelectedClienteRow;
    const text = String(ta?.value || "").trim();
    if (!row) {
      if (msgEl) msgEl.textContent = "Selecione um cliente (CPF, nome ou placa).";
      return;
    }
    if (!row.celularWa || row.celularWa.length < 12) {
      if (msgEl) msgEl.textContent = "Celular do cadastro inválido ou vazio.";
      return;
    }
    if (!text) {
      if (msgEl) msgEl.textContent = "Escreva a mensagem.";
      return;
    }
    const secret = portalWaGetSendSecret();
    if (!secret) {
      if (msgEl) {
        msgEl.textContent =
          "Envio não configurado: na Vercel defina WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID e DK_WHATSAPP_SEND_SECRET (redeploy para injetar a chave).";
      }
      return;
    }
    const btn = document.getElementById("portalWaBtnEnviar");
    if (btn) btn.disabled = true;
    if (msgEl) msgEl.textContent = "A enviar…";
    try {
      const r = await fetch(PORTAL_WA_SEND_API, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-dk-whatsapp-secret": secret,
        },
        body: JSON.stringify({ to: row.celularWa, text }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || j.ok === false) {
        const graphMsg = j.graph?.error?.message || j.graph?.error?.error_user_msg;
        const detail = graphMsg || j.error || j.reason || `HTTP ${r.status}`;
        if (msgEl) {
          msgEl.textContent = `Envio recusado: ${detail}. Confirme o token Meta, o Phone Number ID e a política de templates / janela de 24h.`;
        }
        return;
      }
      if (msgEl) msgEl.textContent = "Mensagem enviada (com « NÃO RESPONDER » no fim).";
      if (ta) ta.value = "";
    } catch (e) {
      if (msgEl) msgEl.textContent = `Erro de rede: ${e && e.message ? e.message : e}`;
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  function portalWaPickClienteFromModalCpf(cpfDigits) {
    const d = portalWaDig(cpfDigits);
    if (d.length !== 11) return;
    const fromCache = portalWaDatasetCache.find((x) => x.cpf === d);
    const row = fromCache || portalWaMakeRowForCpf(d);
    if (!row) return;
    portalWaFillScreenFromRow(row);
    portalWaCloseTodosModal();
    document.getElementById("portalWaMensagemTexto")?.focus();
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
          const pick = r.celularWa
            ? `<button type="button" class="btn-primary btn-secondary-outline portal-wa-todos-pick" data-portal-wa-pick data-wa-cpf="${portalEscapeHtml(r.cpf)}">Usar no envio</button>`
            : `<span class="portal-wa-todos-sem-num">Sem celular no cadastro</span>`;
          return `<li class="portal-wa-todos-item">
            <div class="portal-wa-todos-item__main">
              <strong>${portalEscapeHtml(r.nome)}</strong>
              <span class="subtext">${portalEscapeHtml(cpfEx)} · ${portalEscapeHtml(r.placa)}</span>
            </div>
            ${pick}
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

    document.getElementById("portalWaBtnEnviar")?.addEventListener("click", () => {
      portalWaSendComposedMessage();
    });

    document.getElementById("portalWaBtnTodosAtivos")?.addEventListener("click", () => {
      if (!isPortalTitularAdministrador()) return;
      portalWaOpenTodosModal();
    });

    document.getElementById("portalWaTodosModal")?.addEventListener("click", (e) => {
      if (e.target.closest("[data-close-wa-todos]")) portalWaCloseTodosModal();
      const pick = e.target.closest("[data-portal-wa-pick]");
      if (pick) {
        const cpf = String(pick.getAttribute("data-wa-cpf") || "").replace(/\D/g, "");
        portalWaPickClienteFromModalCpf(cpf);
      }
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
          if (d.length === 11) {
            portalWaSyncFromCpf11(d);
            portalWaHideAllDropdowns();
          }
        });
        inp.addEventListener("blur", () => {
          const d = portalWaDig(inp.value).slice(0, 11);
          if (d.length === 11) portalWaSyncFromCpf11(d);
        });
      } else if (kind === "placa") {
        inp.addEventListener("input", () => {
          inp.value = String(inp.value || "").toUpperCase();
          portalWaRenderDropdown("placa", inp.value);
        });
        inp.addEventListener("blur", () => {
          portalWaTrySyncPlacaUnique();
        });
      } else {
        inp.addEventListener("input", () => {
          portalWaRenderDropdown("nome", inp.value);
        });
        inp.addEventListener("blur", () => {
          portalWaTrySyncNomeExact();
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

  document.getElementById("btn-operacao-falar-cliente")?.addEventListener("click", () => {
    if (!DK_PORTAL_WA_CLIENTE_ATIVO) return;
    hideOperacaoInlineFormsCore();
    portalWaRebuildDatasetCache();
    portalWaClearForm();
    portalWaHideAllDropdowns();
    document.getElementById("operacaoInlineWhatsApp")?.classList.remove("hidden");
    setOperacaoFormPlaceholderVisible(false);
    syncOperacaoCadastroButtons("btn-operacao-falar-cliente");
  });

  document.getElementById("btn-operacao-cadastro-cliente")?.addEventListener("click", () => {
    hideOperacaoInlineFormsCore();
    document.getElementById("operacaoInlineCliente")?.classList.remove("hidden");
    setOperacaoFormPlaceholderVisible(false);
    syncOperacaoCadastroButtons("btn-operacao-cadastro-cliente");
    refreshOperacaoClienteCodigoEditavel();
  });
  document.getElementById("btn-operacao-cadastro-veiculo")?.addEventListener("click", () => {
    hideOperacaoInlineFormsCore();
    document.getElementById("operacaoInlineVeiculo")?.classList.remove("hidden");
    setOperacaoFormPlaceholderVisible(false);
    syncOperacaoCadastroButtons("btn-operacao-cadastro-veiculo");
    refreshOperacaoVeiculoPlacasCache();
    refreshOperacaoVeiculoTagPreview();
    renderOperacaoVeiculoResumoFrota();
  });
  document.getElementById("btn-operacao-cadastro-locacao")?.addEventListener("click", () => {
    hideOperacaoInlineFormsCore();
    document.getElementById("operacaoInlineLocacao")?.classList.remove("hidden");
    setOperacaoFormPlaceholderVisible(false);
    syncOperacaoCadastroButtons("btn-operacao-cadastro-locacao");
    updateOperacaoLocacaoDataInicioPlaceholder();
    refreshOperacaoLocacaoAdminProtocoloUi();
    refreshOperacaoLocacaoSubmitBtn();
    syncOperacaoLocacaoFromDataInicio();
    syncOperacaoLocacaoValorPlano();
    refreshOperacaoLocacaoDatalists();
    void portalEnsureLocacoesFromCloud({ force: false }).finally(() => {
      refreshOperacaoLocacaoProtocoloPicker({ force: true });
    });
  });

  document.getElementById("btn-operacao-lancamento-aluguel")?.addEventListener("click", () => {
    const inline = document.getElementById("operacaoInlineLancamentoAluguel");
    const jaAberto = inline && !inline.classList.contains("hidden");
    if (jaAberto) {
      hideOperacaoInlineFormsCore();
      setOperacaoFormPlaceholderVisible(true);
      syncOperacaoCadastroButtons(null);
      return;
    }
    openOperacaoLancamentoAluguel("avulso");
  });

  syncOperacaoLancAluguelSubnavItemsVisibility();

  [
    "btn-lanc-aluguel-avulso",
    "btn-lanc-aluguel-comprovante",
    "btn-lanc-aluguel-validacao",
    "btn-lanc-aluguel-relatorios",
  ].forEach((id) => {
    document.getElementById(id)?.addEventListener("click", () => {
      const sub = document.getElementById(id)?.getAttribute("data-lanc-aluguel-sub") || "avulso";
      if (!operacaoLancAluguelSubPermitido(sub)) return;
      openOperacaoLancamentoAluguel(sub);
    });
  });

  document.getElementById("btn-operacao-cadastro-colaborador")?.addEventListener("click", () => {
    if (!isPortalTitularAdministrador()) return;
    hideOperacaoInlineFormsCore();
    document.getElementById("operacaoInlineColaborador")?.classList.remove("hidden");
    setOperacaoFormPlaceholderVisible(false);
    syncOperacaoCadastroButtons("btn-operacao-cadastro-colaborador");
    syncPortalColaboradorFormFromCpf();
    portalRenderColaboradoresLista();
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
  document.getElementById("operacaoLancAluguelCpf")?.addEventListener("blur", () => {
    syncOperacaoLancamentoAluguelAfterCpfEdit();
    refreshOperacaoLancAluguelPesquisaDatalists({ source: "cpf" });
  });
  document.getElementById("operacaoLancAluguelCpf")?.addEventListener("input", () => {
    const msg = document.getElementById("operacaoLancAluguelInlineMsg");
    if (msg) msg.textContent = "";
    clearOperacaoLancAluguelPesquisaConfirmada();
    refreshOperacaoLancAluguelPesquisaDatalists({ source: "cpf" });
    refreshPortalRelClienteCpfDatalist();
    refreshPortalRelPlacaDatalist();
    hideOperacaoLancAluguelDetalhePanels();
  });

  document.getElementById("operacaoLancAluguelConfirmarPesquisaBtn")?.addEventListener("click", (e) => {
    e.preventDefault();
    confirmarOperacaoLancAluguelPesquisa();
  });
  document.getElementById("operacaoLancAluguelLimparPesquisaBtn")?.addEventListener("click", (e) => {
    e.preventDefault();
    clearOperacaoLancamentoAluguelForm({ voltarPesquisa: true });
  });
  document.getElementById("operacaoLancAluguelNomeBusca")?.addEventListener("input", () => {
    const msg = document.getElementById("operacaoLancAluguelInlineMsg");
    if (msg) msg.textContent = "";
    refreshOperacaoLancAluguelPesquisaDatalists({ source: "nome" });
    hideOperacaoLancAluguelDetalhePanels();
  });
  document.getElementById("operacaoLancAluguelNomeBusca")?.addEventListener("change", () => {
    refreshOperacaoLancAluguelPesquisaDatalists({ source: "nome" });
  });
  document.getElementById("operacaoLancAluguelProtocoloBusca")?.addEventListener("input", () => {
    const msg = document.getElementById("operacaoLancAluguelInlineMsg");
    if (msg) msg.textContent = "";
    refreshOperacaoLancAluguelPesquisaDatalists({ source: "proto" });
    hideOperacaoLancAluguelDetalhePanels();
  });
  document.getElementById("operacaoLancAluguelProtocoloBusca")?.addEventListener("change", () => {
    refreshOperacaoLancAluguelPesquisaDatalists({ source: "proto" });
  });
  document.getElementById("operacaoLancAluguelPlacaBusca")?.addEventListener("input", () => {
    const msg = document.getElementById("operacaoLancAluguelInlineMsg");
    if (msg) msg.textContent = "";
    refreshOperacaoLancAluguelPesquisaDatalists({ source: "placa" });
    hideOperacaoLancAluguelDetalhePanels();
  });
  document.getElementById("operacaoLancAluguelPlacaBusca")?.addEventListener("change", () => {
    refreshOperacaoLancAluguelPesquisaDatalists({ source: "placa" });
  });

  // Ligado ao contentor inteiro do Lançamento de aluguel: a lista de sugestões
  // (#operacaoLancAluguelPesquisaLista) fica na secção de pesquisa, fora do form.
  // Usa mousedown porque o blur do campo de pesquisa re-renderiza a lista antes
  // do mouseup, e o evento click deixaria de apontar para a linha.
  let operacaoLancAluguelLinhaClickTs = 0;
  function handleOperacaoLancAluguelLinhaEvent(e) {
    const t = e.target;
    if (!(t instanceof Element)) return;
    const btn = t.closest(".portal-lanc-pesquisa-linha");
    if (!btn) return;
    e.preventDefault();
    const agora = Date.now();
    if (agora - operacaoLancAluguelLinhaClickTs < 600) return;
    operacaoLancAluguelLinhaClickTs = agora;
    aplicarOperacaoLancAluguelPesquisaLinha(
      btn.getAttribute("data-cpf"),
      btn.getAttribute("data-nome"),
      btn.getAttribute("data-proto"),
      btn.getAttribute("data-placa")
    );
    confirmarOperacaoLancAluguelPesquisa();
  }
  const operacaoLancAluguelWrap = document.getElementById("operacaoInlineLancamentoAluguel");
  operacaoLancAluguelWrap?.addEventListener("mousedown", handleOperacaoLancAluguelLinhaEvent);
  operacaoLancAluguelWrap?.addEventListener("click", handleOperacaoLancAluguelLinhaEvent);

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
    preencherLancAluguelFormSimples();
    const msg = document.getElementById("operacaoLancAluguelInlineMsg");
    if (msg) msg.textContent = "";
  });

  document.getElementById("portalAdminAlteracaoConfirmSimBtn")?.addEventListener("click", () => {
    const fn = portalAdminAlteracaoConfirmCallback;
    closePortalAdminAlteracaoConfirmModal();
    if (typeof fn === "function") fn();
  });
  document.getElementById("portalAdminAlteracaoConfirmNaoBtn")?.addEventListener("click", () =>
    closePortalAdminAlteracaoConfirmModal()
  );
  document.querySelectorAll("[data-close-admin-alteracao-confirm]").forEach((el) => {
    el.addEventListener("click", () => closePortalAdminAlteracaoConfirmModal());
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
    const locAtualEdit = collectPortalLocacoesComProtocoloByCpf(digits).find(
      (l) => normPortalNumeroContrato(l.numeroContrato) === proto
    );
    const arrEdit = locAtualEdit ? getPortalLancamentosAluguelDoContrato(locAtualEdit) : [];
    const rowPrev = arrEdit[indice];
    const doSaveLancEdit = () => {
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
    };
    if (rowPrev) {
      const changes = portalBuildAlteracoesLista(
        {
          valor: formatPortalLancamentoSumBrl(rowPrev.valor),
          data: portalNormDiffVal(rowPrev.data),
        },
        {
          valor: formatPortalLancamentoSumBrl(valorNum),
          data: portalNormDiffVal(dataStr),
        },
        { valor: "Valor pago", data: "Data do pagamento" }
      );
      portalConfirmarAlteracaoAdministrador(
        { titulo: "Confirmar alteração — pagamento de aluguel", changes },
        doSaveLancEdit
      );
    } else {
      doSaveLancEdit();
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
    const inpValorSimples = document.getElementById("operacaoLancAluguelValorSimples");
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
    const valorNum = Number(parseVal(String(inpValorSimples?.value || "")));
    const dataStr = String(inpData?.value || "").trim();
    if (digits.length !== 11 || !proto) {
      if (msg) msg.textContent = "Informe CPF e protocolo com locação.";
      return;
    }
    if (!Number.isFinite(valorNum) || valorNum <= 0) {
      if (msg) msg.textContent = "Informe o valor do pagamento.";
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
        : resolveOperacaoLancAluguelNomePorCpf(digits);
    const nomeExibir = nome || "—";
    const cpfFmt = typeof formatCpf === "function" ? formatCpf(digits) : digits;
    const valorFmt =
      typeof currencyBRL === "function"
        ? currencyBRL(valorNum)
        : Number(valorNum).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const texto = `Pagamento de ${valorFmt} na data de ${dataStr} para o cliente ${nomeExibir} CPF ${cpfFmt} protocolo ${proto}.`;
    openPortalLancAluguelConfirmModal(texto, () => {
      void (async () => {
        const res = persistPortalLancamentoAluguelPagamento(digits, proto, valorNum, dataStr, {
          valorEspecie: valorNum,
          valorPix: 0,
          valorCartao: 0,
        });
        if (!res?.ok) {
          if (msg) {
            msg.textContent = !getPortalSessaoAdminRole()
              ? "Sessão expirada ou sem permissão. Inicie sessão novamente."
              : "Não foi possível guardar o pagamento.";
          }
          return;
        }
        const locAtual = collectPortalLocacoesComProtocoloByCpf(digits).find(
          (l) => normPortalNumeroContrato(l.numeroContrato) === proto
        );
        if (locAtual) applyOperacaoLancamentoAluguelFromLoc(locAtual);
        refreshOperacaoLancAluguelResumoCompacto();
        refreshOperacaoLancAluguelSituacaoAposPagamento(locAtual || null);
        if (msg) msg.textContent = "A enviar aviso ao cliente…";
        const notify = await portalNotificarClientePagamentosLancados(
          res.cpfDigits,
          res.nc,
          res.loc,
          [res.entry],
          new Set()
        );
        if (msg) {
          msg.textContent = notify.ok
            ? notify.msg ||
                "Lançamento de aluguel realizado com sucesso. Informação já enviada para o cliente."
            : notify.msg || "Pagamento guardado, mas o aviso ao cliente não foi confirmado na nuvem.";
        }
      })();
    });
  });

  ["operacaoClienteVoltarBtn", "operacaoVeiculoVoltarBtn", "operacaoLocacaoVoltarBtn", "operacaoLancAluguelVoltarBtn", "operacaoLancMultasVoltarBtn", "operacaoLancManutencaoVoltarBtn"].forEach((id) => {
    document.getElementById(id)?.addEventListener("click", () => {
      hideInlineForms();
    });
  });

  function abrirPainelCompletoDkExterno() {
    const meta = document.querySelector('meta[name="dk-sistema-cadastros-url"]');
    const url = String(meta?.getAttribute("content") || "").trim();
    if (url) {
      window.open(url, "_blank", "noopener,noreferrer");
      return;
    }
    window.open("../index.html", "_blank", "noopener,noreferrer");
  }

  [
    "operacaoClienteAbrirSistemaBtn",
    "operacaoVeiculoAbrirSistemaBtn",
    "operacaoLocacaoAbrirSistemaBtn",
    "operacaoLancAluguelAbrirSistemaBtn",
  ].forEach((id) => {
    document.getElementById(id)?.addEventListener("click", (e) => {
      e.preventDefault();
      abrirPainelCompletoDkExterno();
    });
  });

  function applyPortalLocadoraHash() {
    const h = (window.location.hash || "").toLowerCase();
    if (h === "#miel" || h.startsWith("#miel/")) {
      openMielSistema();
      return;
    }
    if (!h.startsWith("#locadora")) return;
    try {
      if (sessionStorage.getItem("dk_from_pwa_app") === "1") {
        sessionStorage.removeItem("dk_from_pwa_app");
        history.replaceState({ dkPortalLocadora: 1 }, "", location.href);
      }
    } catch {
      /* ignore */
    }
    const rest = h.replace(/^#locadora\/?/, "").trim();
    if (!rest || rest === "hub") {
      openLocadoraHub();
      return;
    }
    if (rest === "cliente" || rest.startsWith("cliente/")) {
      openLocadoraClienteArea();
      return;
    }
    if (rest === "empresa" || rest.startsWith("empresa/")) {
      openLocadoraEmpresa();
      const sub = rest.replace(/^empresa\/?/, "").trim();
      if (sub === "colaborador" || sub === "administrador") {
        document
          .querySelector(`.role-picker__btn[data-role="${sub === "administrador" ? "administrador" : "colaborador"}"]`)
          ?.dispatchEvent(new Event("click", { bubbles: true }));
      }
    }
  }

  applyPortalLocadoraHash();
  window.addEventListener("hashchange", applyPortalLocadoraHash);
  window.addEventListener("pageshow", () => portalRestaurarAreaLogadaAposRecarga());
  portalInvalidarSessaoSeBuildAntigo();
  portalAtualizarBannerAdmin();
  portalRestaurarAreaLogadaAposRecarga();

  document.getElementById("portal-admin-cliente-cpf")?.addEventListener("input", () => {
    const inp = document.getElementById("portal-admin-cliente-cpf");
    if (inp && typeof formatCpf === "function") {
      const d = onlyDigits(String(inp.value || "")).slice(0, 11);
      inp.value = formatCpf(d);
    }
    refreshPortalAdminClienteCpfDatalist();
    refreshPortalAdminClienteProtocoloSelect();
    const fb = document.getElementById("portal-admin-cliente-feedback");
    if (fb) fb.textContent = "";
  });
  document.getElementById("portal-admin-cliente-cpf")?.addEventListener("change", () => {
    refreshPortalAdminClienteProtocoloSelect();
  });
  document.getElementById("portal-admin-cliente-abrir")?.addEventListener("click", () => {
    portalAdminAbrirAppCliente();
  });
  document.getElementById("btn-locadora-preview-cliente")?.addEventListener("click", () => {
    openLocadoraClienteArea();
  });
  document.querySelectorAll("[data-admin-nav]").forEach((btn) => {
    btn.addEventListener("click", () => {
      portalAdminNav(btn.getAttribute("data-admin-nav") || "");
    });
  });

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
      const mergeFn = window.__DK_mergeCadastroClienteHistorico;
      const byCpf = new Map();
      const dig = (cpf) =>
        typeof onlyDigits === "function" ? onlyDigits(String(cpf || "")) : String(cpf || "").replace(/\D/g, "");
      const add = (c) => {
        const cpf = dig(c.cpf);
        if (cpf.length !== 11) return;
        const prev = byCpf.get(cpf);
        byCpf.set(cpf, prev && typeof mergeFn === "function" ? mergeFn(prev, { ...c, cpf }) : { ...c, cpf });
      };
      (local || []).forEach(add);
      (remote || []).forEach(add);
      return Array.from(byCpf.values());
    }

    function dkPortalMergeVeiculosArrays(local, remote) {
      const mergeFn = window.__DK_mergeCadastroVeiculoHistorico;
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
      const add = (v) => {
        const k = keyOf(v);
        if (!k) return;
        const prev = byKey.get(k);
        byKey.set(k, prev && typeof mergeFn === "function" ? mergeFn(prev, v) : { ...v });
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
      const mergeMultasTransitoEmb =
        typeof window.__DK_mergePortalMultasTransitoEmbutidos === "function"
          ? window.__DK_mergePortalMultasTransitoEmbutidos
          : mergePlEmb;
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
        const mergedPlMultas = mergePlEmb([prev?.portalLancamentosMultas, l?.portalLancamentosMultas]);
        const mergedMultasTransito = mergeMultasTransitoEmb([
          prev?.portalMultasTransito,
          l?.portalMultasTransito,
        ]);
        const mergedPlManut = mergePlEmb([
          prev?.portalLancamentosManutencao,
          l?.portalLancamentosManutencao,
        ]);
        const attachEmb = (row) => {
          if (mergedPl.length) row.portalLancamentosAluguel = mergedPl;
          if (mergedPlMultas.length) row.portalLancamentosMultas = mergedPlMultas;
          if (mergedMultasTransito.length) row.portalMultasTransito = mergedMultasTransito;
          if (mergedPlManut.length) row.portalLancamentosManutencao = mergedPlManut;
          return row;
        };
        if (!prev) {
          byKey.set(k, attachEmb({ ...l }));
          return;
        }
        const merged = attachEmb({ ...prev, ...l });
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
        const stay = attachEmb({ ...prev });
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

    async function dkPortalPushCadastroSnapshotNow() {
      if (dkPortalCadastroSyncSuppressPush) return;
      const clientes = loadCadastro(CAD_CLIENTES_KEY);
      const veiculos = loadCadastro(CAD_VEICULOS_KEY);
      const locacoes = loadCadastro(CAD_LOCACOES_KEY);
      const clientesArr = Array.isArray(clientes) ? clientes : [];
      const veiculosArr = Array.isArray(veiculos) ? veiculos : [];
      const locacoesArr = Array.isArray(locacoes) ? locacoes : [];
      const isDemo = window.__DK_IS_DEMO_DEPLOY__ === true;
      if (isDemo && !clientesArr.length && !veiculosArr.length && !locacoesArr.length) {
        return;
      }
      const apiTasks = [];
      if (!isDemo || clientesArr.length) {
        apiTasks.push(dkPortalPushToApi("cadastro-clientes", clientesArr));
      }
      if (!isDemo || veiculosArr.length) {
        apiTasks.push(dkPortalPushToApi("cadastro-veiculos", veiculosArr));
      }
      if (!isDemo || locacoesArr.length) {
        apiTasks.push(dkPortalPushToApi("cadastro-locacoes", locacoesArr));
      }
      if (apiTasks.length) await Promise.all(apiTasks);
      if (typeof window.__DK_pushCloudSnapshotNow === "function") {
        await window.__DK_pushCloudSnapshotNow();
      }
    }

    function dkPortalScheduleFullCadastroSnapshotPush() {
      clearTimeout(dkPortalCadastroPushTimers[DK_PORTAL_SNAPSHOT_TIMER_KEY]);
      dkPortalCadastroPushTimers[DK_PORTAL_SNAPSHOT_TIMER_KEY] = setTimeout(() => {
        dkPortalPushCadastroSnapshotNow().catch((e) => console.warn("[DK portal] push snapshot", e));
      }, 1500);
    }

    const origSave = saveCadastro;
    const origSaveFuncionarios =
      typeof saveFuncionariosAccess === "function" ? saveFuncionariosAccess : null;
    window.saveCadastro = function dkPortalSaveCadastroWrapped(key, list) {
      origSave(key, list);
      if (!Array.isArray(list) || dkPortalCadastroSyncSuppressPush) return;
      if (
        key === CAD_CLIENTES_KEY ||
        key === PORTAL_CLIENTES_KEY ||
        key === CAD_VEICULOS_KEY ||
        key === PORTAL_VEICULOS_KEY ||
        key === CAD_LOCACOES_KEY
      ) {
        dkPortalScheduleFullCadastroSnapshotPush();
      }
      if (typeof window.__DK_pushToCloudAfterSave === "function") {
        window.__DK_pushToCloudAfterSave();
      }
    };
    if (origSaveFuncionarios) {
      window.saveFuncionariosAccess = function dkPortalSaveFuncionariosAccessWrapped() {
        origSaveFuncionarios();
        if (dkPortalCadastroSyncSuppressPush) return;
        if (typeof window.__DK_pushToCloudAfterSave === "function") {
          window.__DK_pushToCloudAfterSave();
        }
      };
    }

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
      if (
        typeof window.__DK_isLocalDataAuthorityActive === "function" &&
        window.__DK_isLocalDataAuthorityActive()
      ) {
        return;
      }
      await Promise.all([
        dkPortalPullOne("cadastro-clientes", CAD_CLIENTES_KEY, dkPortalMergeClientesArrays),
        dkPortalPullOne("cadastro-veiculos", CAD_VEICULOS_KEY, dkPortalMergeVeiculosArrays),
        dkPortalPullOne("cadastro-locacoes", CAD_LOCACOES_KEY, dkPortalMergeLocacoesArrays),
      ]);
    }

    window.__DK_portalPullCadastroFromCloud = dkPortalPullAndMergeAll;
    window.__DK_portalPushCadastroToCloud = dkPortalPushCadastroSnapshotNow;

    /** Outro separador do mesmo site alterou `localStorage` — só atualiza UI (sem rede). */
    window.addEventListener("storage", (ev) => {
      if (!ev.key) return;
      if (
        ev.key !== CAD_CLIENTES_KEY &&
        ev.key !== PORTAL_CLIENTES_KEY &&
        ev.key !== CAD_VEICULOS_KEY &&
        ev.key !== PORTAL_VEICULOS_KEY &&
        ev.key !== CAD_LOCACOES_KEY
      ) {
        return;
      }
      try {
        portalRefreshOperacaoLocal();
      } catch (e) {
        console.warn("[DK portal] refresh após storage", e);
      }
    });
  })();

  window.__DK_computePortalProtocoloResumoFromLoc = computePortalProtocoloResumoFromLoc;
  window.__DK_refreshLancAluguelSituacao = refreshOperacaoLancAluguelSituacaoAposPagamento;
  window.__DK_portalRemoverLancamentoComprovanteClienteId = portalRemoverLancamentoComprovanteClienteId;
  window.__DK_refreshPortalRelatorioAberto = refreshPortalRelatorioAberto;
  window.__DK_isPortalTitularAdministrador = isPortalTitularAdministrador;
  window.__DK_portalAdminPodeEditarCodigoCliente = portalAdminPodeEditarCodigoCliente;
  window.__DK_refreshOperacaoClienteCodigoEditavel = refreshOperacaoClienteCodigoEditavel;
  window.__DK_portalRegistroEhTeste = portalRegistroEhTeste;
  window.__DK_hideOperacaoInlineForms = hideInlineForms;
  window.__DK_syncOperacaoCadastroButtons = syncOperacaoCadastroButtons;
  window.__DK_hideManutencaoInlineForms = () => {
    hideManutencaoInlineFormsCore();
    setManutencaoFormPlaceholderVisible(true);
    syncManutencaoSidebarButtons(null);
  };
  window.__DK_showManutencaoInlinePanel = (panelId, btnId) => {
    hideManutencaoInlineFormsCore();
    setManutencaoFormPlaceholderVisible(false);
    document.getElementById(panelId)?.classList.remove("hidden");
    syncManutencaoSidebarButtons(btnId || null);
  };
  window.__DK_openPortalLancConfirmModal = openPortalLancAluguelConfirmModal;
  window.__DK_portalConfirmarAlteracaoAdministrador = portalConfirmarAlteracaoAdministrador;
  function getPortalOperadorConferenciaSessao() {
    try {
      const raw = localStorage.getItem("dk_sessao_cliente");
      if (!raw) return null;
      const s = JSON.parse(raw);
      if (s?.tipo !== "admin") return null;
      const cpf = onlyDigits(String(s.cpf || "")).slice(0, 11);
      const nome = String(s.nome || "").trim();
      if (cpf.length !== 11 || !nome) return null;
      return { cpf, nome, role: String(s.role || "operacao").trim() };
    } catch {
      return null;
    }
  }

  /** Conferência de comprovantes do app cliente: só colaborador/admin cadastrado com lançamento de aluguel. */
  function portalOperadorPodeConferirComprovanteCliente() {
    const role = getPortalSessaoAdminRole();
    if (!role) {
      return {
        ok: false,
        msg: "Inicie sessão na Área da Empresa com colaborador ou administrador cadastrado.",
      };
    }
    const operador = getPortalOperadorConferenciaSessao();
    if (!operador) {
      return { ok: false, msg: "Sessão do operador inválida. Entre novamente." };
    }
    if (role === "owner") return { ok: true, operador };
    const f = getPortalSessaoEquipaFuncionario();
    const acessos = getPortalOperacaoAcessosEfetivos(f);
    if (!acessos?.lancamentoAluguel) {
      return {
        ok: false,
        msg: "O seu cadastro não tem permissão de lançamento de aluguel para conferir comprovantes.",
      };
    }
    return { ok: true, operador };
  }

  window.__DK_getPortalSessaoAdminRole = getPortalSessaoAdminRole;
  window.__DK_getPortalSessaoEquipaFuncionario = getPortalSessaoEquipaFuncionario;
  window.__DK_getPortalOperacaoAcessosEfetivos = getPortalOperacaoAcessosEfetivos;
  window.__DK_portalPodeAcessarSistemaMiel = portalPodeAcessarSistemaMiel;
  window.__DK_portalRefreshMielAcesso = refreshPortalMielHomeAcesso;
  window.__DK_isPortalTitularAdministrador = isPortalTitularAdministrador;
  window.__DK_portalRegistroEhTeste = portalRegistroEhTeste;
  window.__DK_getPortalOperadorConferenciaSessao = getPortalOperadorConferenciaSessao;
  window.__DK_portalOperadorPodeConferirComprovanteCliente = portalOperadorPodeConferirComprovanteCliente;
  window.__DK_operacaoLancAluguelProtocoloAtual = operacaoLancAluguelProtocoloAtual;
  window.__DK_getPortalSessaoParaRegistroLancamento = getPortalSessaoParaRegistroLancamentoAluguel;
  window.__DK_collectLancPesquisaLinhas = collectOperacaoLancAluguelPesquisaLinhas;
  window.__DK_filterLancPesquisaLinhas = filterOperacaoLancAluguelPesquisaLinhas;
  window.__DK_resolveLancNomePorCpf = resolveOperacaoLancAluguelNomePorCpf;
  window.__DK_getPortalLancPesquisaLinhaCorClasse = getPortalLancPesquisaLinhaCorClasse;
  window.__DK_portalNomeChaveBusca = portalNomeChaveBusca;
  window.__DK_isPortalLocacaoAtiva = isPortalLocacaoAtiva;
  window.__DK_getPortalLancamentosAluguelDoContrato = getPortalLancamentosAluguelDoContrato;

  window.__DK_refreshOperacaoLancAluguelFromComprovante = function refreshOperacaoLancAluguelFromComprovante(rec) {
    if (!rec) return;
    const dig =
      typeof onlyDigits === "function" ? onlyDigits(String(rec.cpf || "")) : String(rec.cpf || "").replace(/\D/g, "");
    const proto = normPortalNumeroContrato(rec.protocolo);
    const inpCpf = document.getElementById("operacaoLancAluguelCpf");
    const inpProto = document.getElementById("operacaoLancAluguelProtocoloBusca");
    if (inpCpf && dig.length === 11) {
      inpCpf.value = typeof formatCpf === "function" ? formatCpf(dig) : dig;
      inpCpf.dispatchEvent(new Event("input", { bubbles: true }));
    }
    if (inpProto && proto) inpProto.value = proto;
    document.getElementById("operacaoLancAluguelConfirmarPesquisaBtn")?.click();
    renderOperacaoLancAluguelHistorico();
  };

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
      normalizePortalMaskedFieldValues();
      syncOperacaoLancAluguelValorPagoFromMeios();
      syncOperacaoLocacaoFromDataInicio();
      syncOperacaoLocacaoValorPlano();
      refreshOperacaoLocacaoProtocoloPicker({ force: true });
      refreshPortalRelClienteCpfDatalist();
      refreshPortalRelPlacaDatalist();
    })
  );

  window.__DK_emitPortalRelatorioPdf = emitPortalRelatorioPdf;
  window.__DK_emitPortalRelatorioExcel = emitPortalRelatorioExcel;
  window.__DK_portalLancAluguelCalCtx = () => {
    const { nc, cpf } = operacaoLancAluguelProtocoloAtual();
    const loc =
      cpf.length === 11 && nc
        ? collectPortalLocacoesComProtocoloByCpf(cpf).find(
            (l) => normPortalNumeroContrato(l.numeroContrato) === nc
          )
        : null;
    const diaRaw = String(loc?.diaPagto || loc?.diaPagamento || "").trim();
    const diaPagamentoCol = portalLancAluguelDiaPagamentoColIdx(diaRaw, loc);
    return {
      cpfDigits: cpf,
      proto: nc,
      diaPagamentoCol,
      diaPagamentoLabel: portalLancAluguelDiaPagamentoLegivel(diaPagamentoCol),
    };
  };
  window.__DK_getPortalLancamentosAluguelContrato = (cpfDigits, proto) => {
    const loc = collectPortalLocacoesComProtocoloByCpf(cpfDigits).find(
      (l) => normPortalNumeroContrato(l.numeroContrato) === normPortalNumeroContrato(proto)
    );
    return loc ? getPortalLancamentosAluguelDoContrato(loc) : [];
  };
  window.__DK_persistPortalLancAluguelCalendarioAno = persistPortalLancAluguelCalendarioAno;
  window.__DK_refreshOperacaoLancAluguelAposPagamento = () => {
    const { nc, cpf } = operacaoLancAluguelProtocoloAtual();
    if (!nc || cpf.length !== 11) return;
    const loc = collectPortalLocacoesComProtocoloByCpf(cpf).find(
      (l) => normPortalNumeroContrato(l.numeroContrato) === nc
    );
    if (loc) applyOperacaoLancamentoAluguelFromLoc(loc);
    refreshOperacaoLancAluguelResumoCompacto();
  };
})();

