const mockClientes = [
  {
    cpf: "11111111111",
    senha: "1234",
    nome: "Joao Silva",
    contrato: {
      numero: "DK-2026-001",
      inicio: "25/04/2026",
      fim: "30/04/2026",
      status: "Ativo",
      valorLocacao: 620,
      dias: 30,
      valorDevidoHoje: 580,
      valorPago: 640,
      veiculo: {
        modelo: "Fiat Argo 1.3",
        categoria: "Carro",
        placa: "QXA1B23",
      },
    },
  },
  {
    cpf: "22222222222",
    senha: "1234",
    nome: "Ana Souza",
    contrato: {
      numero: "DK-2026-002",
      inicio: "25/04/2026",
      fim: "27/04/2026",
      status: "Ativo",
      valorLocacao: 280,
      dias: 12,
      valorDevidoHoje: 360,
      valorPago: 280,
      veiculo: {
        modelo: "Honda CG 160",
        categoria: "Moto",
        placa: "PEN4C56",
      },
    },
  },
];

const FUNCIONARIOS_ACCESS_KEY = "dk_funcionarios_access";
const funcionariosAccess = [
  {
    cpf: "03037897430",
    senha: "110499@Gb",
    nome: "Márcio Santos",
    role: "owner",
  },
  {
    cpf: "00445040556",
    senha: "041310@Nm",
    nome: "Nilza Santos",
    role: "operacao",
  },
  {
    cpf: "06523244440",
    senha: "110499Gb@",
    nome: "Marcus Santos",
    role: "owner",
  },
];

const adminData =
  typeof DK_DATA !== "undefined" &&
  DK_DATA &&
  Array.isArray(DK_DATA.records)
    ? DK_DATA.records
    : typeof RECEITA_2026_DATA !== "undefined" && Array.isArray(RECEITA_2026_DATA)
      ? RECEITA_2026_DATA
      : [];
const dkChecks =
  typeof DK_DATA !== "undefined" && DK_DATA && DK_DATA.checks
    ? DK_DATA.checks
    : null;
const monthlySeriesData =
  typeof MONTHLY_DATA !== "undefined" &&
  MONTHLY_DATA &&
  Array.isArray(MONTHLY_DATA.monthlySeries)
    ? MONTHLY_DATA.monthlySeries
    : [];
const frotaData =
  typeof FROTA_DATA !== "undefined" && Array.isArray(FROTA_DATA)
    ? FROTA_DATA
    : [];
const veiculosSeedData =
  typeof VEICULOS_SEED_DATA !== "undefined" && Array.isArray(VEICULOS_SEED_DATA)
    ? VEICULOS_SEED_DATA
    : [];
const clientesSeedData =
  typeof CLIENTES_SEED_DATA !== "undefined" && Array.isArray(CLIENTES_SEED_DATA)
    ? CLIENTES_SEED_DATA
    : [];
const locacoesSeedData =
  typeof LOCACOES_SEED_DATA !== "undefined" && Array.isArray(LOCACOES_SEED_DATA)
    ? LOCACOES_SEED_DATA
    : [];
const receita2026Data =
  typeof RECEITA_2026_DATA !== "undefined" && Array.isArray(RECEITA_2026_DATA)
    ? RECEITA_2026_DATA
    : [];

const grupoHome = document.getElementById("grupoHome");
const locadoraArea = document.getElementById("locadoraArea");
const centroArea = document.getElementById("centroArea");
const openLocadoraButton = document.getElementById("openLocadoraButton");
const openCentroButton = document.getElementById("openCentroButton");
const backToGroupFromLocadora = document.getElementById("backToGroupFromLocadora");
const backToGroupFromCentro = document.getElementById("backToGroupFromCentro");
const loginArea = document.getElementById("loginArea");
const loginClienteForm = document.getElementById("loginClienteForm");
const loginAdminForm = document.getElementById("loginAdminForm");
const loginClienteMessage = document.getElementById("loginClienteMessage");
const loginAdminMessage = document.getElementById("loginAdminMessage");
const dashboardCard = document.getElementById("dashboardCard");
const logoutButton = document.getElementById("logoutButton");
const adminCard = document.getElementById("adminCard");
const adminLogoutButton = document.getElementById("adminLogoutButton");
const adminButtons = document.querySelectorAll(".admin-action");
const adminResultTitle = document.getElementById("adminResultTitle");
const adminResultBody = document.getElementById("adminResultBody");
const adminNavOperacao = document.getElementById("adminNavOperacao");
const adminNavInformacao = document.getElementById("adminNavInformacao");
const adminNavDados = document.getElementById("adminNavDados");
const adminOperacaoMenu = document.getElementById("adminOperacaoMenu");
const adminInformacaoMenu = document.getElementById("adminInformacaoMenu");
const adminOperacaoSection = document.getElementById("adminOperacaoSection");
const adminInformacaoSection = document.getElementById("adminInformacaoSection");
const adminDadosSection = document.getElementById("adminDadosSection");
const operacaoTargetButtons = document.querySelectorAll(".operacao-target-btn");
const operacaoClienteSection = document.getElementById("operacaoClienteSection");
const operacaoVeiculoSection = document.getElementById("operacaoVeiculoSection");
const operacaoLocacaoSection = document.getElementById("operacaoLocacaoSection");
const operacaoManutencaoSection = document.getElementById("operacaoManutencaoSection");
const operacaoLancamentoAluguelSection = document.getElementById("operacaoLancamentoAluguelSection");
const operacaoLancamentoDespesaSection = document.getElementById("operacaoLancamentoDespesaSection");
const operacaoFuncionarioSection = document.getElementById("operacaoFuncionarioSection");
const infoScopeAtivosBtn = document.getElementById("infoScopeAtivosBtn");
const infoScopeInativosBtn = document.getElementById("infoScopeInativosBtn");
const infoScopeTodosBtn = document.getElementById("infoScopeTodosBtn");
const infoScopeCaixaBtn = document.getElementById("infoScopeCaixaBtn");
const informacaoAtivosActions = document.getElementById("informacaoAtivosActions");
const informacaoInativosActions = document.getElementById("informacaoInativosActions");
const informacaoTodosActions = document.getElementById("informacaoTodosActions");
const clienteCadastroForm = document.getElementById("clienteCadastroForm");
const cadClienteCpfInput = document.getElementById("cadClienteCpf");
const cadClienteClearBtn = document.getElementById("cadClienteClearBtn");
const cadClienteUpdateBtn = document.getElementById("cadClienteUpdateBtn");
const cadClienteCancelBtn = document.getElementById("cadClienteCancelBtn");
const cadClienteUnblockBtn = document.getElementById("cadClienteUnblockBtn");
const cadClienteDeleteBtn = document.getElementById("cadClienteDeleteBtn");
const clienteCancelOpcoes = document.getElementById("clienteCancelOpcoes");
const cancelarClienteQuebraBtn = document.getElementById("cancelarClienteQuebraBtn");
const cancelarClienteNegativadoBtn = document.getElementById("cancelarClienteNegativadoBtn");
const clienteSenhaWrap = document.getElementById("clienteSenhaWrap");
const cadClienteAdminSenha = document.getElementById("cadClienteAdminSenha");
const cadClienteSenhaConfirmarBtn = document.getElementById("cadClienteSenhaConfirmarBtn");
const cadClienteSenhaCancelarBtn = document.getElementById("cadClienteSenhaCancelarBtn");
const clienteCadastroErro = document.getElementById("clienteCadastroErro");
const veiculoCadastroForm = document.getElementById("veiculoCadastroForm");
const locacaoCadastroForm = document.getElementById("locacaoCadastroForm");
const cadLocacaoCpfInput = document.getElementById("cadLocacaoCpf");
const cadLocacaoPlacaInput = document.getElementById("cadLocacaoPlaca");
const cadLocacaoInicioInput = document.getElementById("cadLocacaoInicio");
const cadLocacaoFimInput = document.getElementById("cadLocacaoFim");
const cadLocacaoValorInput = document.getElementById("cadLocacaoValor");
const locacaoSubmitButton = locacaoCadastroForm.querySelector('button[type="submit"]');
const cadLocacaoClearBtn = document.getElementById("cadLocacaoClearBtn");
const lancamentoAluguelForm = document.getElementById("lancamentoAluguelForm");
const lancAluguelClienteNomeInput = document.getElementById("lancAluguelClienteNome");
const lancAluguelClienteSugestoes = document.getElementById("lancAluguelClienteSugestoes");
const lancAluguelPlacaInput = document.getElementById("lancAluguelPlaca");
const lancAluguelCpfInput = document.getElementById("lancAluguelCpf");
const lancAluguelDiaPagamentoInput = document.getElementById("lancAluguelDiaPagamento");
const lancAluguelValorPagoInput = document.getElementById("lancAluguelValorPago");
const lancAluguelSemanaInicioInput = document.getElementById("lancAluguelSemanaInicio");
const lancAluguelSemanaFimInput = document.getElementById("lancAluguelSemanaFim");
const lancAluguelClearBtn = document.getElementById("lancAluguelClearBtn");
const lancamentoAluguelErro = document.getElementById("lancamentoAluguelErro");
const lancamentoAluguelResumo = document.getElementById("lancamentoAluguelResumo");
const lancAluguelDiagnosticoBtn = document.getElementById("lancAluguelDiagnosticoBtn");
const lancAluguelDiagnosticoBox = document.getElementById("lancAluguelDiagnosticoBox");
const manutencaoCadastroForm = document.getElementById("manutencaoCadastroForm");
const cadManutencaoDataInput = document.getElementById("cadManutencaoData");
const manutencaoTipoToggleBtn = document.getElementById("manutencaoTipoToggleBtn");
const manutencaoTipoPanel = document.getElementById("manutencaoTipoPanel");
const gerarRelatorioManutencaoBtn = document.getElementById("gerarRelatorioManutencaoBtn");
const manutencaoReportBox = document.getElementById("manutencaoReportBox");
const manutencaoReportTitle = document.getElementById("manutencaoReportTitle");
const manutencaoReportBody = document.getElementById("manutencaoReportBody");
const cadastroClienteLista = document.getElementById("cadastroClienteLista");
const cadastroVeiculoLista = document.getElementById("cadastroVeiculoLista");
const cadastroLocacaoLista = document.getElementById("cadastroLocacaoLista");
const cadastroManutencaoLista = document.getElementById("cadastroManutencaoLista");
const cadastroLancamentoAluguelLista = document.getElementById("cadastroLancamentoAluguelLista");
const cadastroFuncionarioLista = document.getElementById("cadastroFuncionarioLista");
const funcionarioCadastroForm = document.getElementById("funcionarioCadastroForm");
const cadFuncionarioCpf = document.getElementById("cadFuncionarioCpf");
const cadFuncionarioNome = document.getElementById("cadFuncionarioNome");
const cadFuncionarioSenha = document.getElementById("cadFuncionarioSenha");
const cadFuncionarioRole = document.getElementById("cadFuncionarioRole");
const cadFuncionarioClearBtn = document.getElementById("cadFuncionarioClearBtn");
const funcionarioCadastroErro = document.getElementById("funcionarioCadastroErro");
const veiculoCadastroErro = document.getElementById("veiculoCadastroErro");
const cadVeiculoPlacaInput = document.getElementById("cadVeiculoPlaca");
const cadVeiculoTagPreviewInput = document.getElementById("cadVeiculoTagPreview");
const cadVeiculoChassiInput = document.getElementById("cadVeiculoChassi");
const cadVeiculoRenavamInput = document.getElementById("cadVeiculoRenavam");
const cadVeiculoMotorInput = document.getElementById("cadVeiculoMotor");
const veiculoSubmitButton = veiculoCadastroForm.querySelector('button[type="submit"]');
const cadVeiculoClearBtn = document.getElementById("cadVeiculoClearBtn");
const cadVeiculoUpdateBtn = document.getElementById("cadVeiculoUpdateBtn");
const cadVeiculoCancelBtn = document.getElementById("cadVeiculoCancelBtn");
const veiculoCancelOpcoes = document.getElementById("veiculoCancelOpcoes");
const cancelarPorVendaBtn = document.getElementById("cancelarPorVendaBtn");
const cancelarPorSinistroBtn = document.getElementById("cancelarPorSinistroBtn");
const cancelarPorRouboBtn = document.getElementById("cancelarPorRouboBtn");
const veiculoSenhaWrap = document.getElementById("veiculoSenhaWrap");
const cadVeiculoAdminSenha = document.getElementById("cadVeiculoAdminSenha");
const cadVeiculoSenhaConfirmarBtn = document.getElementById("cadVeiculoSenhaConfirmarBtn");
const cadVeiculoSenhaCancelarBtn = document.getElementById("cadVeiculoSenhaCancelarBtn");
const gerarDadosUsoPdfBtn = document.getElementById("gerarDadosUsoPdfBtn");
const exportDadosBackupBtn = document.getElementById("exportDadosBackupBtn");
const importDadosBackupBtn = document.getElementById("importDadosBackupBtn");
const importDadosBackupInput = document.getElementById("importDadosBackupInput");
const dadosUsoSenhaWrap = document.getElementById("dadosUsoSenhaWrap");
const dadosUsoAdminSenha = document.getElementById("dadosUsoAdminSenha");
const dadosUsoSenhaConfirmarBtn = document.getElementById("dadosUsoSenhaConfirmarBtn");
const dadosUsoSenhaCancelarBtn = document.getElementById("dadosUsoSenhaCancelarBtn");
const gerarRelatorioClienteBtn = document.getElementById("gerarRelatorioClienteBtn");
const relatorioClienteOpcoes = document.getElementById("relatorioClienteOpcoes");
const relatorioClientePdfBtn = document.getElementById("relatorioClientePdfBtn");
const relatorioClienteExcelBtn = document.getElementById("relatorioClienteExcelBtn");
const gerarRelatorioVeiculoBtn = document.getElementById("gerarRelatorioVeiculoBtn");
const relatorioVeiculoOpcoes = document.getElementById("relatorioVeiculoOpcoes");
const relatorioVeiculoPdfBtn = document.getElementById("relatorioVeiculoPdfBtn");
const relatorioVeiculoExcelBtn = document.getElementById("relatorioVeiculoExcelBtn");
const gerarRelatorioLocacaoBtn = document.getElementById("gerarRelatorioLocacaoBtn");
const relatorioLocacaoOpcoes = document.getElementById("relatorioLocacaoOpcoes");
const relatorioLocacaoFormatos = document.getElementById("relatorioLocacaoFormatos");
const relatorioLocadosBtn = document.getElementById("relatorioLocadosBtn");
const relatorioDisponiveisBtn = document.getElementById("relatorioDisponiveisBtn");
const relatorioLocacaoTelaBtn = document.getElementById("relatorioLocacaoTelaBtn");
const relatorioLocacaoPdfBtn = document.getElementById("relatorioLocacaoPdfBtn");
const relatorioLocacaoExcelBtn = document.getElementById("relatorioLocacaoExcelBtn");
const locacaoReportBox = document.getElementById("locacaoReportBox");
const locacaoReportTitle = document.getElementById("locacaoReportTitle");
const locacaoReportBody = document.getElementById("locacaoReportBody");
const clienteVidaDialog = document.getElementById("clienteVidaDialog");
const clienteVidaBody = document.getElementById("clienteVidaBody");
const clienteVidaFecharBtn = document.getElementById("clienteVidaFecharBtn");
const placaHistoricoDialog = document.getElementById("placaHistoricoDialog");
const placaHistoricoBody = document.getElementById("placaHistoricoBody");
const placaHistoricoFecharBtn = document.getElementById("placaHistoricoFecharBtn");
const veiculoConfirmDialog = document.getElementById("veiculoConfirmDialog");
const veiculoConfirmResumo = document.getElementById("veiculoConfirmResumo");
const veiculoConfirmSimBtn = document.getElementById("veiculoConfirmSimBtn");
const veiculoConfirmVoltarBtn = document.getElementById("veiculoConfirmVoltarBtn");
const clienteConfirmDialog = document.getElementById("clienteConfirmDialog");
const clienteConfirmResumo = document.getElementById("clienteConfirmResumo");
const clienteConfirmSimBtn = document.getElementById("clienteConfirmSimBtn");
const clienteConfirmVoltarBtn = document.getElementById("clienteConfirmVoltarBtn");
const locacaoConfirmDialog = document.getElementById("locacaoConfirmDialog");
const locacaoConfirmResumo = document.getElementById("locacaoConfirmResumo");
const locacaoConfirmSimBtn = document.getElementById("locacaoConfirmSimBtn");
const locacaoConfirmVoltarBtn = document.getElementById("locacaoConfirmVoltarBtn");
const lancamentoAluguelConfirmDialog = document.getElementById("lancamentoAluguelConfirmDialog");
const lancamentoAluguelConfirmResumo = document.getElementById("lancamentoAluguelConfirmResumo");
const lancamentoAluguelConfirmSimBtn = document.getElementById("lancamentoAluguelConfirmSimBtn");
const lancamentoAluguelConfirmVoltarBtn = document.getElementById("lancamentoAluguelConfirmVoltarBtn");
const installButton = document.getElementById("installButton");
const envWarning = document.getElementById("envWarning");
const dateInputIds = [
  "cadClienteDataCadastro",
  "cadClienteVencimento",
  "cadLocacaoInicio",
  "cadLocacaoFim",
  "lancAluguelSemanaInicio",
  "lancAluguelSemanaFim",
  "cadManutencaoData",
  "cadManutencaoPrevistaSaida",
  "cadManutencaoRealSaida",
];

let deferredPrompt = null;
let currentModelGroups = {};
let currentScopeLabel = "";
let currentFinanceiroEmDia = [];
let currentFinanceiroAtraso = [];
let currentFinanceiroScope = "";
let veiculoEmEdicaoId = null;
let veiculoEdicaoAutorizada = false;
let veiculoAcaoSenhaPendente = "";
let veiculoCancelMotivoPendente = "";
let clienteEmEdicaoId = null;
let clienteEdicaoAutorizada = false;
let clienteAcaoSenhaPendente = "";
let clienteCancelMotivoPendente = "";
let locacaoImpedimentoAlertShown = false;
let operacaoAbaAtual = "cliente";
let informacaoEscopoAtual = "";
let currentAdminReportSaldo = null;
let currentQuadroGeralRows = [];
const CAD_CLIENTES_KEY = "dk_clientes_cadastro";
const CAD_VEICULOS_KEY = "dk_veiculos_cadastro";
const CAD_LOCACOES_KEY = "dk_locacoes_cadastro";
const LOCACAO_DATABASE_KEY = "dk_locacoes_quadro_geral";
const CAD_MANUTENCOES_KEY = "dk_manutencoes_cadastro";
const CAD_LANCAMENTOS_ALUGUEL_KEY = "dk_lancamentos_aluguel";
const AUDIT_LOG_KEY = "dk_audit_log";
const BACKUP_KEYS = [
  CAD_CLIENTES_KEY,
  CAD_VEICULOS_KEY,
  CAD_LOCACOES_KEY,
  LOCACAO_DATABASE_KEY,
  CAD_MANUTENCOES_KEY,
  CAD_LANCAMENTOS_ALUGUEL_KEY,
  AUDIT_LOG_KEY,
];
const DAILY_RECON_KEY = "dk_daily_reconciliation_status";
const CLEAR_LOCACOES_ONCE_KEY = "dk_clear_locacoes_once_v1";
const IMPORT_LOCACOES_PLANILHA_ONCE_KEY = "dk_import_locacoes_planilha_once_v1";
const EMPRESA_RELATORIO = "DK Locadora";
const CNPJ_RELATORIO = "59.665.734/0001-32";
const MAINTENANCE_START_HOUR = 2;
const MAINTENANCE_DURATION_MINUTES = 60;
const PLACA_CORRECOES = [
  { old: "JQD4751", next: "JQD4H51" },
  { old: "RDQ1D27", next: "RQH1D27" },
  { old: "SPA7A73", next: "SPB7A73" },
];
const PLACAS_LOCADAS_MANUAIS = [
  "JQD4H51","KLP9J27","OYN5604","PDG5F83","PEI2202","PES5J25","PES7D79","PET4A64","PET6I93","PGZ0J54",
  "PLP2G62","QYP3E99","QYU5H13","QYW8I91","RCY4F05","RDL3I24","RDO7E19","RQH1D27","RZH5I01",
  "RZJ3D92","RZJ5C24","RZN2G33","RZP5E86","RZP6J73","RZS4G95","RZW5D99","SBL7A18","SJR1B50","SOQ1J79",
  "SOQ2D39","SOQ3B79","SOR1I03","SOT1I98","SOU2I56","SOU4H09","SOU5A29","SOU5C59","SOU5E29","SOW0B92",
  "SOW0D02","SOW5A21","SOW5B81","SOW6A91","SOX2A34","SOX2A44","SOX2A94","SOX2B04","SOX2B54","SOX2B74",
  "SOX2H74","SOX6I44","SOX6I83","SOY4H40","SOY4I50","SOY5D16","SOY5D26","SOY5D46","SOY5D56","SOY5D66",
  "SOY5D76","SPA2C58","SPA2C88","SPA3B44","SPA3D88","SPA3E38","SPA3E68","SPA3E78","SPA3F28","SPA3F38",
  "SPA3F48","SPA3F68","SPA5A67","SPA9G12","SPA9H12","SPB6J43","SPB6J53","SPB6J63","SPB6J83","SPB7A33",
  "SPB7A43","SPB7A73","SPB7A93","SPB7C33","UHJ0G21","UHJ1D20","UHJ1D40","UHJ1D50","UHJ1D51","UHJ7E38",
  "UHJ7E48","UHJ7E88","UHJ7F58","UHJ7F78","UHK0D98","UHK2B97","UHK2C47","UHK3E09","UHK3F09","UHK3F59",
  "UHK3G09","UHK3H29","UHK3J59","UHK4A69","UHK4B89","UHK4C39","UHK4E29","UHK6F16","UHK6J56","UHK7A75",
  "UHM3B79","UHM3C89","UHM3F00","UHN2G97","UHO1G31","UHO1J21","UHO2D60","UHO5I86","UHO6G75","UHO6H05",
  "UHP4A60","UHQ0D08","UHQ0D88","UHQ0E48","UHQ1A58","UHQ1B08","UHQ1B38","UHQ1C08","UHQ1C68","UHQ1D58",
  "UHQ1E58","UHQ1E98","UHQ8C48","UHQ8C98","UHQ8D58","UHQ8D98","UHQ8E88","UHQ8G38","UHQ8H58","UHQ9B08",
  "UHR0E41","UHR0E91","UHR0F41","UHR0G21","UHR0G71","UHS8F81","UHS8F91",
];
let relatorioLocacaoTipoSelecionado = "";
let relatorioLocacaoCache = null;
let dadosUsoAcaoPendente = "";

function showGroupHome() {
  grupoHome.classList.remove("hidden");
  locadoraArea.classList.add("hidden");
  centroArea.classList.add("hidden");
}

function todayBrDate() {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function showLocadoraArea() {
  grupoHome.classList.add("hidden");
  locadoraArea.classList.remove("hidden");
  centroArea.classList.add("hidden");
}

function showCentroArea() {
  grupoHome.classList.add("hidden");
  locadoraArea.classList.add("hidden");
  centroArea.classList.remove("hidden");
}

function saveFuncionariosAccess() {
  localStorage.setItem(FUNCIONARIOS_ACCESS_KEY, JSON.stringify(funcionariosAccess));
}

function hydrateFuncionariosAccess() {
  const raw = localStorage.getItem(FUNCIONARIOS_ACCESS_KEY);
  if (!raw) {
    saveFuncionariosAccess();
    return;
  }
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return;
    const normalized = parsed
      .map((f) => ({
        cpf: onlyDigits(String(f?.cpf || "")),
        senha: String(f?.senha || "").trim(),
        nome: String(f?.nome || "").trim(),
        role: String(f?.role || "operacao").trim() === "owner" ? "owner" : "operacao",
      }))
      .filter((f) => f.cpf.length === 11 && f.senha && f.nome);
    if (!normalized.length) return;
    funcionariosAccess.splice(0, funcionariosAccess.length, ...normalized);
  } catch {
    // Mantém fallback em memória se armazenamento estiver inválido.
  }
}

function onlyDigits(value) {
  return value.replace(/\D/g, "");
}

hydrateFuncionariosAccess();
const adminSecundario = funcionariosAccess.find((f) => f.cpf === "06523244440");
if (adminSecundario) {
  adminSecundario.role = "owner";
  adminSecundario.nome = "Marcus Santos";
}
saveFuncionariosAccess();

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatDateMask(value) {
  const digits = onlyDigits(String(value || "")).slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

function setupDateMasks() {
  dateInputIds.forEach((id) => {
    const input = document.getElementById(id);
    if (!input) return;
    input.addEventListener("input", () => {
      input.value = formatDateMask(input.value);
    });
    input.addEventListener("blur", () => {
      input.value = formatDateMask(input.value);
    });
  });
}

function ensureLocacaoInicioDefault() {
  if (!cadLocacaoInicioInput) return;
  if (!String(cadLocacaoInicioInput.value || "").trim()) {
    cadLocacaoInicioInput.value = todayBrDate();
  }
}

function formatCpf(value) {
  const digits = onlyDigits(String(value || "")).slice(0, 11);
  if (!digits) return "";
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

function findCliente(cpf, senha) {
  return mockClientes.find((c) => c.cpf === cpf && c.senha === senha) || null;
}

function saveSession(cliente) {
  const safeData = {
    tipo: "cliente",
    cpf: cliente.cpf,
    nome: cliente.nome,
    contrato: cliente.contrato,
  };
  localStorage.setItem("dk_sessao_cliente", JSON.stringify(safeData));
}

function saveAdminSession() {
  const principal = funcionariosAccess.find((f) => f.role === "owner") || funcionariosAccess[0];
  localStorage.setItem(
    "dk_sessao_cliente",
    JSON.stringify({
      tipo: "admin",
      cpf: principal?.cpf || "",
      nome: principal?.nome || "Funcionario DK",
      role: principal?.role || "operacao",
    })
  );
}

function getSession() {
  const raw = localStorage.getItem("dk_sessao_cliente");
  return raw ? JSON.parse(raw) : null;
}

function clearSession() {
  localStorage.removeItem("dk_sessao_cliente");
}

function showMessage(target, message, type) {
  target.textContent = message;
  target.className = `message ${type}`;
}

function getDateKey(dateObj = new Date()) {
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, "0");
  const day = String(dateObj.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isMaintenanceWindow(now = new Date()) {
  const totalMinutes = now.getHours() * 60 + now.getMinutes();
  const startMinutes = MAINTENANCE_START_HOUR * 60;
  const endMinutes = startMinutes + MAINTENANCE_DURATION_MINUTES;
  return totalMinutes >= startMinutes && totalMinutes < endMinutes;
}

function getMaintenanceNotice() {
  return "Sistema em conferência diária (02:00 às 03:00). Acesso temporariamente bloqueado.";
}

function enforceMaintenanceBlock() {
  clearSession();
  dashboardCard.classList.add("hidden");
  adminCard.classList.add("hidden");
  loginArea.classList.remove("hidden");
  showLocadoraArea();
  const warning = getMaintenanceNotice();
  showMessage(loginClienteMessage, warning, "error");
  showMessage(loginAdminMessage, warning, "error");
}

function runDailyReconciliationIfNeeded(now = new Date()) {
  const todayKey = getDateKey(now);
  const raw = localStorage.getItem(DAILY_RECON_KEY);
  let status = {};
  if (raw) {
    try {
      status = JSON.parse(raw) || {};
    } catch {
      status = {};
    }
  }
  if (status.lastRunDate === todayKey) return;
  if (now.getHours() < MAINTENANCE_START_HOUR) return;

  const inativosComDebito = receita2026Data.filter((r) => {
    const hasFim = String(r.fim || "").trim();
    const devolucao = parseCurrencyBR(r.devolucaoDesistencia);
    return hasFim && devolucao < 0;
  }).length;

  localStorage.setItem(
    DAILY_RECON_KEY,
    JSON.stringify({
      lastRunDate: todayKey,
      ranAtIso: now.toISOString(),
      inativosComDebito,
    })
  );
}

function enforceMaintenanceAndDailyRoutines() {
  runDailyReconciliationIfNeeded(new Date());
  if (isMaintenanceWindow(new Date())) {
    enforceMaintenanceBlock();
    return true;
  }
  return false;
}

function setAdminSection(section) {
  const session = getSession();
  const isOwner = session?.tipo === "admin" && session?.role === "owner";
  const isOperacao = section === "operacao";
  const isInformacao = isOwner && section === "informacao";
  const isDados = isOwner && section === "dados";
  adminOperacaoSection.classList.toggle("hidden", !isOperacao);
  adminInformacaoSection.classList.toggle("hidden", !isInformacao);
  adminDadosSection.classList.toggle("hidden", !isDados);
  if (adminOperacaoMenu) adminOperacaoMenu.classList.toggle("hidden", !isOperacao);
  if (adminInformacaoMenu) adminInformacaoMenu.classList.toggle("hidden", !isInformacao);
}

function setOperacaoSubsection(target) {
  const session = getSession();
  const isOwner = session?.tipo === "admin" && session?.role === "owner";
  if ((target || "cliente") === "funcionario" && !isOwner) {
    operacaoAbaAtual = "cliente";
  } else {
    operacaoAbaAtual = target || "cliente";
  }
  if (operacaoClienteSection) operacaoClienteSection.classList.toggle("hidden", operacaoAbaAtual !== "cliente");
  if (operacaoVeiculoSection) operacaoVeiculoSection.classList.toggle("hidden", operacaoAbaAtual !== "veiculo");
  if (operacaoLocacaoSection) operacaoLocacaoSection.classList.toggle("hidden", operacaoAbaAtual !== "locacao");
  if (operacaoManutencaoSection) operacaoManutencaoSection.classList.toggle("hidden", operacaoAbaAtual !== "manutencao");
  if (operacaoLancamentoAluguelSection) {
    operacaoLancamentoAluguelSection.classList.toggle("hidden", operacaoAbaAtual !== "lancamentoAluguel");
  }
  if (operacaoLancamentoDespesaSection) {
    operacaoLancamentoDespesaSection.classList.toggle("hidden", operacaoAbaAtual !== "lancamentoDespesa");
  }
  if (operacaoFuncionarioSection) {
    operacaoFuncionarioSection.classList.toggle("hidden", operacaoAbaAtual !== "funcionario" || !isOwner);
  }
  operacaoTargetButtons.forEach((button) => {
    if (button.dataset.target === "funcionario") {
      button.classList.toggle("hidden", !isOwner);
    }
    button.classList.toggle("active", button.dataset.target === operacaoAbaAtual);
  });
}

function setInformacaoScope(scope) {
  informacaoEscopoAtual = scope || "";
  if (informacaoAtivosActions) {
    informacaoAtivosActions.classList.toggle("hidden", informacaoEscopoAtual !== "ativos");
  }
  if (informacaoInativosActions) {
    informacaoInativosActions.classList.toggle("hidden", informacaoEscopoAtual !== "inativos");
  }
  if (informacaoTodosActions) {
    informacaoTodosActions.classList.toggle("hidden", informacaoEscopoAtual !== "todos");
  }
  if (infoScopeAtivosBtn) infoScopeAtivosBtn.classList.toggle("active", informacaoEscopoAtual === "ativos");
  if (infoScopeInativosBtn) infoScopeInativosBtn.classList.toggle("active", informacaoEscopoAtual === "inativos");
  if (infoScopeTodosBtn) infoScopeTodosBtn.classList.toggle("active", informacaoEscopoAtual === "todos");
  if (infoScopeCaixaBtn) infoScopeCaixaBtn.classList.toggle("active", informacaoEscopoAtual === "caixa");
  if (informacaoEscopoAtual === "caixa") {
    const entradas = getEntradasCaixaTotal();
    const saidas = 0;
    const saldo = entradas - saidas;
    const html = `
      <div class="caixa-cards">
        <div class="caixa-card">
          <p class="caixa-label">Entradas</p>
          <p class="caixa-value">${currencyBRL(entradas)}</p>
          <p class="subtext">Soma dos lançamentos de aluguel.</p>
        </div>
        <div class="caixa-card">
          <p class="caixa-label">Saídas</p>
          <p class="caixa-value">${currencyBRL(saidas)}</p>
          <p class="subtext">Ainda sem lançamentos de despesas.</p>
        </div>
        <div class="caixa-card">
          <p class="caixa-label">Saldo</p>
          <p class="caixa-value">${currencyBRL(saldo)}</p>
          <p class="subtext">Entradas - Saídas.</p>
        </div>
      </div>
    `;
    renderAdminResult("Caixa", html);
  }
}

function loadCadastro(key) {
  const raw = localStorage.getItem(key);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveCadastro(key, list) {
  localStorage.setItem(key, JSON.stringify(list));
}

function backupFileName() {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `dk-backup-localstorage-${stamp}.json`;
}

function downloadJsonFile(fileName, payload) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function buildOperationalBackupPayload() {
  const store = {};
  BACKUP_KEYS.forEach((key) => {
    const raw = localStorage.getItem(key);
    if (!raw) {
      store[key] = [];
      return;
    }
    try {
      store[key] = JSON.parse(raw);
    } catch {
      store[key] = [];
    }
  });
  return {
    version: 1,
    source: "dk-localstorage",
    exportedAtIso: new Date().toISOString(),
    exportedBy: getCurrentUserLabel(),
    data: store,
  };
}

function applyOperationalBackupPayload(payload) {
  if (!payload || typeof payload !== "object" || typeof payload.data !== "object" || !payload.data) {
    throw new Error("backup_invalido");
  }
  BACKUP_KEYS.forEach((key) => {
    const incoming = payload.data[key];
    const normalized = Array.isArray(incoming) ? incoming : [];
    localStorage.setItem(key, JSON.stringify(normalized));
  });
}

function clearAllLocacoesOnce() {
  if (localStorage.getItem(CLEAR_LOCACOES_ONCE_KEY) === "done") return;
  saveCadastro(CAD_LOCACOES_KEY, []);
  saveCadastro(LOCACAO_DATABASE_KEY, []);
  localStorage.setItem(CLEAR_LOCACOES_ONCE_KEY, "done");
}

function getCurrentUserLabel() {
  const session = getSession();
  if (!session) return "Sistema";
  if (session.tipo === "admin") return "Administrador DK";
  return session.nome || session.cpf || "Usuario";
}

function isSenhaFuncionarioAtualValida(senhaInformada) {
  const session = getSession();
  const cpfSessao = onlyDigits(String(session?.cpf || ""));
  const funcionario = funcionariosAccess.find((f) => f.cpf === cpfSessao);
  if (!funcionario) return false;
  return String(senhaInformada || "").trim() === funcionario.senha;
}

function getOwnerAccess() {
  return funcionariosAccess.find((f) => f.role === "owner") || null;
}

/** Aceita a senha de qualquer funcionario cadastrado como titular (owner). */
function isSenhaOwnerValida(senhaInformada) {
  const senha = String(senhaInformada || "").trim();
  return funcionariosAccess.some((f) => f.role === "owner" && senha === f.senha);
}

function loadAuditLog() {
  const raw = localStorage.getItem(AUDIT_LOG_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function addAuditLog(action, entity, details) {
  const logs = loadAuditLog();
  logs.push({
    id: Date.now(),
    action,
    entity,
    details,
    user: getCurrentUserLabel(),
    timestampIso: new Date().toISOString(),
    timestampLabel: new Date().toLocaleString("pt-BR"),
  });
  localStorage.setItem(AUDIT_LOG_KEY, JSON.stringify(logs));
}

function findClienteByCpfCadastro(cpf) {
  const normalized = onlyDigits(String(cpf || ""));
  if (!normalized) return null;
  const clientes = loadCadastro(CAD_CLIENTES_KEY);
  return clientes.find((c) => onlyDigits(String(c.cpf || "")) === normalized) || null;
}

function preencherFormCliente(cliente) {
  document.getElementById("cadClienteCodigo").value = cliente.codigo || "";
  document.getElementById("cadClienteDataCadastro").value = cliente.dataCadastro || "";
  document.getElementById("cadClienteCpf").value = formatCpf(cliente.cpf || "");
  document.getElementById("cadClienteNome").value = cliente.nome || "";
  document.getElementById("cadClienteCelular").value = cliente.celular || "";
  document.getElementById("cadClienteRecado1").value = cliente.recado1 || "";
  document.getElementById("cadClienteRecado2").value = cliente.recado2 || "";
  document.getElementById("cadClienteCnh").value = cliente.cnh || "";
  document.getElementById("cadClienteCategoria").value = cliente.categoria || "";
  document.getElementById("cadClienteVencimento").value = cliente.vencimento || "";
  document.getElementById("cadClienteEar").value = cliente.ear || "";
  document.getElementById("cadClienteCep").value = cliente.cep || "";
  document.getElementById("cadClienteMunicipioUf").value = cliente.municipioUf || "";
  document.getElementById("cadClienteEndereco").value = cliente.endereco || "";
}

function entrarModoAtualizacaoCliente(cliente) {
  clienteEmEdicaoId = cliente.id;
  clienteEdicaoAutorizada = false;
  clienteAcaoSenhaPendente = "";
  clienteCancelMotivoPendente = "";
  preencherFormCliente(cliente);
  cadClienteUpdateBtn.classList.remove("hidden");
  cadClienteCancelBtn.classList.remove("hidden");
  const bloqueado = normalizeKey(cliente.status).includes("QUEBRA DE CONTRATO") ||
    normalizeKey(cliente.status).includes("CADASTRO NAO APROVADO");
  cadClienteUnblockBtn.classList.toggle("hidden", !bloqueado);
  cadClienteDeleteBtn.classList.remove("hidden");
  clienteCancelOpcoes.classList.add("hidden");
  clienteSenhaWrap.classList.add("hidden");
  if (clienteCadastroErro) {
    clienteCadastroErro.textContent = "CPF JA CADASTRADO. CLIQUE EM EDITAR OU BLOQUEAR";
    clienteCadastroErro.classList.remove("hidden");
  }
}

function sairModoAtualizacaoCliente() {
  clienteEmEdicaoId = null;
  clienteEdicaoAutorizada = false;
  clienteAcaoSenhaPendente = "";
  clienteCancelMotivoPendente = "";
  cadClienteUpdateBtn.classList.add("hidden");
  cadClienteCancelBtn.classList.add("hidden");
  cadClienteUnblockBtn.classList.add("hidden");
  cadClienteDeleteBtn.classList.add("hidden");
  clienteCancelOpcoes.classList.add("hidden");
  clienteSenhaWrap.classList.add("hidden");
  cadClienteAdminSenha.value = "";
  if (clienteCadastroErro) {
    clienteCadastroErro.textContent = "";
    clienteCadastroErro.classList.add("hidden");
  }
}

function liberarEdicaoCliente() {
  clienteEdicaoAutorizada = true;
  clienteAcaoSenhaPendente = "";
  if (clienteCadastroErro) {
    clienteCadastroErro.textContent = "EDICAO LIBERADA. ALTERE E CLIQUE EM EDITAR";
    clienteCadastroErro.classList.remove("hidden");
  }
}

function isClienteBloqueadoByCpf(cpf) {
  const normalizedCpf = onlyDigits(String(cpf || ""));
  if (!normalizedCpf) return false;
  const clientes = loadCadastro(CAD_CLIENTES_KEY);
  const cliente = clientes.find(
    (c) => onlyDigits(String(c.cpf || "")) === normalizedCpf
  );
  if (!cliente) return false;
  const status = normalizeKey(cliente.status);
  return (
    status.includes("QUEBRA DE CONTRATO") ||
    status.includes("CADASTRO NAO APROVADO")
  );
}

function clienteTemVinculoComLocacao(cpfDigits) {
  const key = onlyDigits(String(cpfDigits || ""));
  if (key.length !== 11) return false;
  const fromAdmin = getAdminDataset().some(
    (r) => onlyDigits(String(r.cpf || "")) === key && normalizePlate(r.placa)
  );
  if (fromAdmin) return true;
  const fromLocacoes = loadCadastro(CAD_LOCACOES_KEY).some(
    (l) => onlyDigits(String(l.cpf || "")) === key && normalizePlate(l.placa)
  );
  return fromLocacoes;
}

function setLocacaoFormBlocked(blocked) {
  cadLocacaoPlacaInput.disabled = blocked;
  cadLocacaoInicioInput.disabled = blocked;
  cadLocacaoFimInput.disabled = blocked;
  cadLocacaoValorInput.disabled = blocked;
  if (locacaoSubmitButton) locacaoSubmitButton.disabled = blocked;
}

function validateLocacaoCpfBlock() {
  const cpf = onlyDigits(String(cadLocacaoCpfInput.value || ""));
  cadLocacaoCpfInput.value = formatCpf(cpf);
  const blocked = isClienteBloqueadoByCpf(cpf);
  if (blocked) {
    setLocacaoFormBlocked(true);
    if (!locacaoImpedimentoAlertShown) {
      window.alert("IMPEDITIVO DE LOCAÇÃO");
      locacaoImpedimentoAlertShown = true;
    }
    return false;
  }
  locacaoImpedimentoAlertShown = false;
  setLocacaoFormBlocked(false);
  return true;
}

function refreshLocacaoPlacaOptions() {
  if (!cadLocacaoPlacaInput) return;
  const snapshot = buildOperationalSnapshot();
  const options = snapshot.availableVehicles
    .map((v) => {
      const placa = String(v.placa || "").trim().toUpperCase();
      const modelo = String(v.modelo || "").trim() || "Modelo nao informado";
      return { placa, modelo };
    })
    .filter((v) => v.placa);
  const previousValue = String(cadLocacaoPlacaInput.value || "").trim().toUpperCase();
  cadLocacaoPlacaInput.innerHTML = `
    <option value="">Placa do veículo (disponíveis)</option>
    ${options
      .map((v) => `<option value="${v.placa}">${v.placa} - ${v.modelo}</option>`)
      .join("")}
  `;
  const exists = options.some((v) => v.placa === previousValue);
  if (exists) {
    cadLocacaoPlacaInput.value = previousValue;
  }
}

function normalizeKey(value) {
  return String(value || "").trim().toUpperCase();
}

function normalizePlate(value) {
  return normalizeKey(value).replace(/[^A-Z0-9]/g, "");
}

function nextTagByTipo(tipo, veiculos) {
  const prefix = tipo === "CARRO" ? "DKCR" : "DKMT";
  let maxNum = 0;
  veiculos.forEach((v) => {
    const tag = normalizeKey(v.tag);
    if (!tag.includes(prefix)) return;
    const m = tag.match(/(\d+)$/);
    if (!m) return;
    const n = Number(m[1]);
    if (Number.isFinite(n) && n > maxNum) maxNum = n;
  });
  return `${prefix}${maxNum + 1}`;
}

function refreshTagPreview() {
  const tipo = String(document.getElementById("cadVeiculoTipo").value || "").trim();
  if (!tipo) {
    cadVeiculoTagPreviewInput.value = "";
    return;
  }
  seedVeiculosDatabaseIfNeeded();
  const veiculos = loadCadastro(CAD_VEICULOS_KEY);
  if (veiculoEmEdicaoId !== null) {
    const existente = veiculos.find((v) => v.id === veiculoEmEdicaoId);
    cadVeiculoTagPreviewInput.value = existente?.tag || "";
    return;
  }
  cadVeiculoTagPreviewInput.value = nextTagByTipo(tipo, veiculos);
}

function hasEquipamentoDuplicado(veiculos, placa, chassi, renavam, motor, ignoreId = null) {
  const p = normalizeKey(placa);
  const c = normalizeKey(chassi);
  const r = normalizeKey(renavam);
  const m = normalizeKey(motor);
  return veiculos.some((v) => {
    if (ignoreId !== null && v.id === ignoreId) return false;
    if (p && normalizeKey(v.placa) === p) return true;
    if (c && normalizeKey(v.chassi) === c) return true;
    if (r && normalizeKey(v.renavam) === r) return true;
    if (m && normalizeKey(v.motor) === m) return true;
    return false;
  });
}

function isPlacaDuplicada(placa) {
  const p = normalizeKey(placa);
  if (!p) return false;
  seedVeiculosDatabaseIfNeeded();
  const veiculos = loadCadastro(CAD_VEICULOS_KEY);
  return veiculos.some((v) => normalizeKey(v.placa) === p);
}

function isCampoDuplicado(fieldName, value) {
  const val = normalizeKey(value);
  if (!val) return false;
  seedVeiculosDatabaseIfNeeded();
  const veiculos = loadCadastro(CAD_VEICULOS_KEY);
  return veiculos.some((v) => normalizeKey(v[fieldName]) === val);
}

function findVeiculoByPlaca(placa) {
  const p = normalizeKey(placa);
  if (!p) return null;
  seedVeiculosDatabaseIfNeeded();
  const veiculos = loadCadastro(CAD_VEICULOS_KEY);
  return veiculos.find((v) => normalizeKey(v.placa) === p) || null;
}

function preencherFormVeiculo(veiculo) {
  document.getElementById("cadVeiculoTipo").value = veiculo.tipo || "";
  document.getElementById("cadVeiculoPlaca").value = veiculo.placa || "";
  document.getElementById("cadVeiculoMarca").value = veiculo.marca || "";
  document.getElementById("cadVeiculoModelo").value = veiculo.modelo || "";
  document.getElementById("cadVeiculoValor").value = veiculo.valor || "";
  document.getElementById("cadVeiculoCor").value = veiculo.cor || "";
  document.getElementById("cadVeiculoChassi").value = veiculo.chassi || "";
  document.getElementById("cadVeiculoAnoModelo").value = veiculo.anoModelo || "";
  document.getElementById("cadVeiculoRenavam").value = veiculo.renavam || "";
  document.getElementById("cadVeiculoMotor").value = veiculo.motor || "";
  cadVeiculoTagPreviewInput.value = veiculo.tag || "";
}

function entrarModoAtualizacao(veiculo) {
  veiculoEmEdicaoId = veiculo.id;
  veiculoEdicaoAutorizada = false;
  veiculoAcaoSenhaPendente = "";
  veiculoCancelMotivoPendente = "";
  preencherFormVeiculo(veiculo);
  cadVeiculoUpdateBtn.classList.remove("hidden");
  cadVeiculoCancelBtn.classList.remove("hidden");
  veiculoCancelOpcoes.classList.add("hidden");
  cadVeiculoUpdateBtn.textContent = "Atualizar";
  if (veiculoSubmitButton) veiculoSubmitButton.disabled = true;
  [
    "cadVeiculoTipo",
    "cadVeiculoMarca",
    "cadVeiculoModelo",
    "cadVeiculoValor",
    "cadVeiculoCor",
    "cadVeiculoChassi",
    "cadVeiculoAnoModelo",
    "cadVeiculoRenavam",
    "cadVeiculoMotor",
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.disabled = true;
  });
  cadVeiculoPlacaInput.disabled = false;
}

function sairModoAtualizacao() {
  veiculoEmEdicaoId = null;
  veiculoEdicaoAutorizada = false;
  veiculoAcaoSenhaPendente = "";
  veiculoCancelMotivoPendente = "";
  cadVeiculoUpdateBtn.classList.add("hidden");
  cadVeiculoCancelBtn.classList.add("hidden");
  veiculoCancelOpcoes.classList.add("hidden");
  cadVeiculoUpdateBtn.textContent = "Atualizar";
  veiculoSenhaWrap.classList.add("hidden");
  cadVeiculoAdminSenha.value = "";
  if (veiculoSubmitButton) veiculoSubmitButton.disabled = false;
  [
    "cadVeiculoTipo",
    "cadVeiculoMarca",
    "cadVeiculoModelo",
    "cadVeiculoValor",
    "cadVeiculoCor",
    "cadVeiculoChassi",
    "cadVeiculoAnoModelo",
    "cadVeiculoRenavam",
    "cadVeiculoMotor",
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.disabled = false;
  });
  cadVeiculoPlacaInput.disabled = false;
  refreshTagPreview();
}

function liberarEdicaoVeiculo() {
  veiculoEdicaoAutorizada = true;
  veiculoAcaoSenhaPendente = "";
  cadVeiculoUpdateBtn.textContent = "Salvar atualização";
  [
    "cadVeiculoTipo",
    "cadVeiculoMarca",
    "cadVeiculoModelo",
    "cadVeiculoValor",
    "cadVeiculoCor",
    "cadVeiculoChassi",
    "cadVeiculoAnoModelo",
    "cadVeiculoRenavam",
    "cadVeiculoMotor",
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.disabled = false;
  });
}

function cancelarVeiculoSelecionado(motivo) {
  if (veiculoEmEdicaoId === null) return;
  const veiculos = loadCadastro(CAD_VEICULOS_KEY);
  const idx = veiculos.findIndex((v) => v.id === veiculoEmEdicaoId);
  if (idx === -1) return;
  const status = `INDISPONIVEL POR ${String(motivo || "").toUpperCase()}`;
  veiculos[idx] = {
    ...veiculos[idx],
    status,
    indisponivelDesde: new Date().toISOString(),
    indisponivelMotivo: String(motivo || "").toUpperCase(),
    indisponivelPor: getCurrentUserLabel(),
  };
  saveCadastro(CAD_VEICULOS_KEY, veiculos);
  addAuditLog("cancelar_veiculo", "veiculo", `${veiculos[idx].placa} - ${status}`);
  veiculoCadastroErro.textContent = `VEICULO MARCADO COMO ${status}`;
  veiculoCadastroErro.classList.remove("hidden");
  veiculoCadastroForm.reset();
  cadVeiculoTagPreviewInput.value = "";
  sairModoAtualizacao();
  renderCadastros();
}

function validateVeiculoUniqueRealtime() {
  const placa = String(cadVeiculoPlacaInput.value || "").trim().toUpperCase();
  const chassi = String(cadVeiculoChassiInput.value || "").trim().toUpperCase();
  const renavam = String(cadVeiculoRenavamInput.value || "").trim().toUpperCase();
  const motor = String(cadVeiculoMotorInput.value || "").trim().toUpperCase();

  cadVeiculoPlacaInput.value = placa;
  cadVeiculoChassiInput.value = chassi;
  cadVeiculoRenavamInput.value = renavam;
  cadVeiculoMotorInput.value = motor;

  const veiculoDuplicadoPorPlaca = findVeiculoByPlaca(placa);
  if (veiculoDuplicadoPorPlaca && veiculoDuplicadoPorPlaca.id !== veiculoEmEdicaoId) {
    entrarModoAtualizacao(veiculoDuplicadoPorPlaca);
    veiculoCadastroErro.textContent =
      "PLACA JA CADASTRADA. CLIQUE EM ATUALIZAR E INFORME A SENHA";
    veiculoCadastroErro.classList.remove("hidden");
    return false;
  }
  if (!veiculoDuplicadoPorPlaca && veiculoEmEdicaoId !== null) {
    sairModoAtualizacao();
  }

  const veiculos = loadCadastro(CAD_VEICULOS_KEY);
  const duplicadoOutroCampo = hasEquipamentoDuplicado(
    veiculos,
    "",
    chassi,
    renavam,
    motor,
    veiculoEmEdicaoId
  );
  if (duplicadoOutroCampo) {
    veiculoCadastroErro.textContent = "EQUIPAMENTO JA CADASTRADO";
    veiculoCadastroErro.classList.remove("hidden");
    if (veiculoSubmitButton) veiculoSubmitButton.disabled = veiculoEmEdicaoId === null ? true : false;
    return false;
  }

  veiculoCadastroErro.textContent = "EQUIPAMENTO JA CADASTRADO";
  veiculoCadastroErro.classList.add("hidden");
  if (veiculoEmEdicaoId === null && veiculoSubmitButton) {
    veiculoSubmitButton.disabled = false;
  }
  return true;
}

function askVeiculoCadastroConfirmation(payload) {
  if (
    !veiculoConfirmDialog ||
    !veiculoConfirmResumo ||
    !veiculoConfirmSimBtn ||
    !veiculoConfirmVoltarBtn
  ) {
    return Promise.resolve(true);
  }
  veiculoConfirmResumo.innerHTML = `
    <p><strong>Tipo:</strong> ${payload.tipo || "-"}</p>
    <p><strong>Placa:</strong> ${payload.placa || "-"}</p>
    <p><strong>Tag:</strong> ${payload.tag || "-"}</p>
    <p><strong>Marca:</strong> ${payload.marca || "-"}</p>
    <p><strong>Modelo:</strong> ${payload.modelo || "-"}</p>
    <p><strong>Valor:</strong> ${payload.valor || "-"}</p>
    <p><strong>Cor:</strong> ${payload.cor || "-"}</p>
    <p><strong>Chassi:</strong> ${payload.chassi || "-"}</p>
    <p><strong>Ano/Modelo:</strong> ${payload.anoModelo || "-"}</p>
    <p><strong>Renavam:</strong> ${payload.renavam || "-"}</p>
    <p><strong>Motor:</strong> ${payload.motor || "-"}</p>
  `;
  veiculoConfirmDialog.classList.remove("hidden");
  return new Promise((resolve) => {
    const closeWith = (result) => {
      veiculoConfirmDialog.classList.add("hidden");
      veiculoConfirmSimBtn.removeEventListener("click", onConfirm);
      veiculoConfirmVoltarBtn.removeEventListener("click", onBack);
      resolve(result);
    };
    const onConfirm = () => closeWith(true);
    const onBack = () => closeWith(false);
    veiculoConfirmSimBtn.addEventListener("click", onConfirm);
    veiculoConfirmVoltarBtn.addEventListener("click", onBack);
  });
}

function askClienteCadastroConfirmation(payload) {
  if (
    !clienteConfirmDialog ||
    !clienteConfirmResumo ||
    !clienteConfirmSimBtn ||
    !clienteConfirmVoltarBtn
  ) {
    return Promise.resolve(true);
  }
  clienteConfirmResumo.innerHTML = `
    <p><strong>CPF:</strong> ${formatCpf(payload.cpf || "") || "-"}</p>
    <p><strong>Nome:</strong> ${payload.nome || "-"}</p>
    <p><strong>Celular:</strong> ${payload.celular || "-"}</p>
    <p><strong>Recado 1:</strong> ${payload.recado1 || "-"}</p>
    <p><strong>Recado 2:</strong> ${payload.recado2 || "-"}</p>
    <p><strong>CNH:</strong> ${payload.cnh || "-"}</p>
    <p><strong>Categoria:</strong> ${payload.categoria || "-"}</p>
    <p><strong>Vencimento:</strong> ${payload.vencimento || "-"}</p>
    <p><strong>EAR:</strong> ${payload.ear || "-"}</p>
    <p><strong>CEP:</strong> ${payload.cep || "-"}</p>
    <p><strong>Município/UF:</strong> ${payload.municipioUf || "-"}</p>
    <p><strong>Endereço:</strong> ${payload.endereco || "-"}</p>
  `;
  clienteConfirmDialog.classList.remove("hidden");
  return new Promise((resolve) => {
    const closeWith = (result) => {
      clienteConfirmDialog.classList.add("hidden");
      clienteConfirmSimBtn.removeEventListener("click", onConfirm);
      clienteConfirmVoltarBtn.removeEventListener("click", onBack);
      resolve(result);
    };
    const onConfirm = () => closeWith(true);
    const onBack = () => closeWith(false);
    clienteConfirmSimBtn.addEventListener("click", onConfirm);
    clienteConfirmVoltarBtn.addEventListener("click", onBack);
  });
}

function askLocacaoCadastroConfirmation(payload) {
  if (
    !locacaoConfirmDialog ||
    !locacaoConfirmResumo ||
    !locacaoConfirmSimBtn ||
    !locacaoConfirmVoltarBtn
  ) {
    return Promise.resolve(true);
  }
  locacaoConfirmResumo.innerHTML = `
    <p><strong>CPF:</strong> ${formatCpf(payload.cpf || "") || "-"}</p>
    <p><strong>Cliente:</strong> ${payload.clienteNome || "-"}</p>
    <p><strong>Placa:</strong> ${payload.placa || "-"}</p>
    <p><strong>Modelo:</strong> ${payload.modelo || "-"}</p>
    <p><strong>Início:</strong> ${payload.inicio || "-"}</p>
    <p><strong>Fim:</strong> ${payload.fim || "-"}</p>
    <p><strong>Valor semanal:</strong> ${payload.valorSemanal || "-"}</p>
  `;
  locacaoConfirmDialog.classList.remove("hidden");
  return new Promise((resolve) => {
    const closeWith = (result) => {
      locacaoConfirmDialog.classList.add("hidden");
      locacaoConfirmSimBtn.removeEventListener("click", onConfirm);
      locacaoConfirmVoltarBtn.removeEventListener("click", onBack);
      resolve(result);
    };
    const onConfirm = () => closeWith(true);
    const onBack = () => closeWith(false);
    locacaoConfirmSimBtn.addEventListener("click", onConfirm);
    locacaoConfirmVoltarBtn.addEventListener("click", onBack);
  });
}

function askLancamentoAluguelConfirmation(payload) {
  if (
    !lancamentoAluguelConfirmDialog ||
    !lancamentoAluguelConfirmResumo ||
    !lancamentoAluguelConfirmSimBtn ||
    !lancamentoAluguelConfirmVoltarBtn
  ) {
    return Promise.resolve(true);
  }
  lancamentoAluguelConfirmResumo.innerHTML = `
    <p><strong>Código:</strong> ${payload.codigoLancamento || "-"}</p>
    <p><strong>Placa:</strong> ${payload.placa || "-"}</p>
    <p><strong>CPF:</strong> ${formatCpf(payload.cpf || "") || "-"}</p>
    <p><strong>Dia de pagamento:</strong> ${payload.diaPagamento || "-"}</p>
    <p><strong>Valor pago:</strong> ${currencyBRL(payload.valorPago || 0)}</p>
    <p><strong>Semana referência:</strong> ${payload.semanaInicio || "-"} até ${payload.semanaFim || "-"}</p>
  `;
  lancamentoAluguelConfirmDialog.classList.remove("hidden");
  return new Promise((resolve) => {
    const closeWith = (result) => {
      lancamentoAluguelConfirmDialog.classList.add("hidden");
      lancamentoAluguelConfirmSimBtn.removeEventListener("click", onConfirm);
      lancamentoAluguelConfirmVoltarBtn.removeEventListener("click", onBack);
      resolve(result);
    };
    const onConfirm = () => closeWith(true);
    const onBack = () => closeWith(false);
    lancamentoAluguelConfirmSimBtn.addEventListener("click", onConfirm);
    lancamentoAluguelConfirmVoltarBtn.addEventListener("click", onBack);
  });
}

function getLancamentosAluguel() {
  const legacyKeys = [
    "dk_lancamento_aluguel",
    "dk_lancamentos_aluguel_cadastro",
    "dk_lancamento_aluguel_cadastro",
  ];
  const sources = [CAD_LANCAMENTOS_ALUGUEL_KEY, ...legacyKeys];
  const mergedMap = new Map();
  const buildLancKey = (item) => {
    const base = [
      String(item.codigoLancamento || ""),
      normalizePlate(item.placa),
      onlyDigits(String(item.cpf || "")),
      String(item.semanaInicio || ""),
      String(item.semanaFim || ""),
      String(item.diaPagamento || ""),
      String(getLancamentoAluguelValor(item)),
      String(item.createdAt || item.id || ""),
    ].join("|");
    return base || String(Math.random());
  };
  for (const key of sources) {
    const list = loadCadastro(key);
    list.forEach((item) => {
      if (!item || typeof item !== "object") return;
      const lanc = {
        ...item,
        id: Number(item.id || item.createdAt || Date.now()),
        createdAt: Number(item.createdAt || item.id || Date.now()),
      };
      const k = buildLancKey(lanc);
      const prev = mergedMap.get(k);
      if (!prev) {
        mergedMap.set(k, lanc);
        return;
      }
      const prevScore =
        (prev.baixaAplicadaAt ? 1000000000 : 0) +
        Number(prev.updatedAt || prev.createdAt || prev.id || 0);
      const nextScore =
        (lanc.baixaAplicadaAt ? 1000000000 : 0) +
        Number(lanc.updatedAt || lanc.createdAt || lanc.id || 0);
      if (nextScore >= prevScore) mergedMap.set(k, lanc);
    });
  }
  const merged = Array.from(mergedMap.values()).sort(
    (a, b) => Number(a.createdAt || a.id || 0) - Number(b.createdAt || b.id || 0)
  );
  const principal = loadCadastro(CAD_LANCAMENTOS_ALUGUEL_KEY);
  const currentSig = JSON.stringify(principal);
  const mergedSig = JSON.stringify(merged);
  if (currentSig !== mergedSig) {
    saveCadastro(CAD_LANCAMENTOS_ALUGUEL_KEY, merged);
  }
  return merged;
}

function getLancamentoAluguelValor(item) {
  if (!item || typeof item !== "object") return 0;
  const candidatos = [
    item.valorPago,
    item.valor,
    item.valorLancamento,
    item.pagamento,
  ];
  for (const valor of candidatos) {
    const n = parseCurrencyBR(valor);
    if (n > 0) return n;
  }
  return 0;
}

function getEntradasCaixaTotal() {
  return getLancamentosAluguel().reduce((acc, item) => acc + getLancamentoAluguelValor(item), 0);
}

function getLancamentosAluguelFromKnownKeys() {
  const keys = [CAD_LANCAMENTOS_ALUGUEL_KEY, "dk_lancamento_aluguel", "dk_lancamentos_aluguel_cadastro", "dk_lancamento_aluguel_cadastro"];
  return keys.map((key) => ({ key, items: loadCadastro(key) }));
}

function renderLancamentoDiagnostico() {
  if (!lancAluguelDiagnosticoBox) return;
  const sources = getLancamentosAluguelFromKnownKeys();
  const total = sources.reduce((acc, s) => acc + s.items.length, 0);
  const allItems = sources
    .flatMap((s) =>
      s.items.map((item) => ({
        ...item,
        _key: s.key,
      }))
    )
    .sort((a, b) => Number(b.createdAt || b.id || 0) - Number(a.createdAt || a.id || 0))
    .slice(0, 15);
  const sourcesHtml = sources
    .map((s) => `<p><strong>${escapeHtml(s.key)}:</strong> ${s.items.length} lançamento(s)</p>`)
    .join("");
  const itemsHtml = allItems.length
    ? allItems
        .map(
          (l) =>
            `<p><strong>${escapeHtml(l.codigoLancamento || "-")}</strong> | <strong>Base:</strong> ${escapeHtml(
              l._key
            )} | <strong>Placa:</strong> ${escapeHtml(l.placa || "-")} | <strong>CPF:</strong> ${
              formatCpf(l.cpf || "") || "-"
            } | <strong>Valor:</strong> ${currencyBRL(getLancamentoAluguelValor(l))}</p>`
        )
        .join("")
    : "<p>Nenhum lançamento encontrado nas chaves conhecidas.</p>";
  lancAluguelDiagnosticoBox.innerHTML = `
    <h4>Diagnóstico de lançamentos</h4>
    <p><strong>Total encontrado:</strong> ${total}</p>
    ${sourcesHtml}
    <hr>
    ${itemsHtml}
  `;
  lancAluguelDiagnosticoBox.classList.remove("hidden");
}

function processPendingLancamentosAluguelBaixa() {
  const lancamentos = getLancamentosAluguel();
  if (!lancamentos.length) return;
  const locacoes = loadCadastro(CAD_LOCACOES_KEY);
  if (!locacoes.length) return;
  let locacoesChanged = false;
  let lancamentosChanged = false;
  const findBestLocacaoIndex = (cpfDigits, placaNorm) => {
    let bestIdx = -1;
    let bestScore = -1;
    locacoes.forEach((loc, idx) => {
      if (onlyDigits(String(loc.cpf || "")) !== cpfDigits) return;
      if (placaNorm && normalizePlate(loc.placa) !== placaNorm) return;
      const ativoScore = !String(loc.fim || "").trim() ? 1_000_000_000_000 : 0;
      const createdScore = Number(loc.updatedAt || loc.createdAt || loc.id || 0);
      const inicioScore = parseBrDate(loc.inicio)?.getTime() || 0;
      const score = ativoScore + createdScore + inicioScore;
      if (score > bestScore) {
        bestScore = score;
        bestIdx = idx;
      }
    });
    if (bestIdx >= 0) return bestIdx;
    if (!placaNorm) return -1;
    return findBestLocacaoIndex(cpfDigits, "");
  };
  lancamentos.forEach((lanc) => {
    if (lanc.baixaAplicadaAt) return;
    const cpfDigits = onlyDigits(String(lanc.cpf || ""));
    const placaNorm = normalizePlate(lanc.placa);
    const valor = parseCurrencyBR(lanc.valorPago);
    if (cpfDigits.length !== 11 || valor <= 0) return;
    const idx = findBestLocacaoIndex(cpfDigits, placaNorm);
    if (idx < 0) return;
    const atual = locacoes[idx];
    const pagoAtual = parseCurrencyBR(atual.pago);
    locacoes[idx] = {
      ...atual,
      pago: currencyBRL(pagoAtual + valor),
      diaPagamento: String(lanc.diaPagamento || atual.diaPagamento || "").trim().toUpperCase(),
      updatedAt: Date.now(),
    };
    lanc.baixaAplicadaAt = Date.now();
    locacoesChanged = true;
    lancamentosChanged = true;
  });
  if (locacoesChanged) saveCadastro(CAD_LOCACOES_KEY, locacoes);
  if (lancamentosChanged) saveCadastro(CAD_LANCAMENTOS_ALUGUEL_KEY, lancamentos);
}

function nextLancamentoAluguelCode(cpfDigits, lancamentos) {
  const cpf = onlyDigits(String(cpfDigits || ""));
  const prefix = cpf.slice(0, 3).padStart(3, "0");
  let maxCounter = 0;
  (lancamentos || []).forEach((item) => {
    if (onlyDigits(String(item.cpf || "")) !== cpf) return;
    const code = String(item.codigoLancamento || "");
    const m = code.match(/^(\d{3})-(\d{2})$/);
    if (!m) return;
    const n = Number(m[2]);
    if (Number.isFinite(n) && n > maxCounter) maxCounter = n;
  });
  const nextCounter = String(maxCounter + 1).padStart(2, "0");
  return `${prefix}-${nextCounter}`;
}

function prefillLancamentoAluguelByCpf(cpfDigits) {
  const cpf = onlyDigits(String(cpfDigits || ""));
  if (cpf.length !== 11) return;
  const lancamentos = getLancamentosAluguel()
    .filter((l) => onlyDigits(String(l.cpf || "")) === cpf)
    .sort((a, b) => Number(a.id || 0) - Number(b.id || 0));
  if (!lancamentos.length) return;
  const last = lancamentos[lancamentos.length - 1];
  if (lancAluguelDiaPagamentoInput && !String(lancAluguelDiaPagamentoInput.value || "").trim()) {
    lancAluguelDiaPagamentoInput.value = String(last.diaPagamento || "");
  }
  const lastFim = parseBrDate(last.semanaFim);
  if (
    lastFim &&
    lancAluguelSemanaInicioInput &&
    lancAluguelSemanaFimInput &&
    !String(lancAluguelSemanaInicioInput.value || "").trim() &&
    !String(lancAluguelSemanaFimInput.value || "").trim()
  ) {
    const ini = addCalendarDays(lastFim, 1);
    const fim = addCalendarDays(lastFim, 7);
    if (ini) lancAluguelSemanaInicioInput.value = formatDataDmaBr(ini);
    if (fim) lancAluguelSemanaFimInput.value = formatDataDmaBr(fim);
  }
}

function findBestContratoForLancamentoByCpf(cpfDigits) {
  const cpf = onlyDigits(String(cpfDigits || ""));
  if (cpf.length !== 11) return null;
  const adminMatches = getAdminDataset().filter((r) => onlyDigits(String(r.cpf || "")) === cpf);
  if (adminMatches.length) {
    const ativo = adminMatches.find((r) => !String(r.fim || "").trim());
    if (ativo) return ativo;
    return adminMatches
      .slice()
      .sort((a, b) => (parseRecordStartDate(b)?.getTime() || 0) - (parseRecordStartDate(a)?.getTime() || 0))[0];
  }
  const locMatches = loadCadastro(CAD_LOCACOES_KEY).filter((l) => onlyDigits(String(l.cpf || "")) === cpf);
  if (!locMatches.length) return null;
  const ativoLoc = locMatches.find((l) => !String(l.fim || "").trim());
  return ativoLoc || locMatches[locMatches.length - 1];
}

function findBestContratoForLancamentoByPlaca(placaRaw) {
  const placa = normalizePlate(placaRaw);
  if (!placa) return null;
  const adminMatches = getAdminDataset().filter((r) => normalizePlate(r.placa) === placa);
  if (adminMatches.length) {
    const ativo = adminMatches.find((r) => !String(r.fim || "").trim());
    if (ativo) return ativo;
    return adminMatches
      .slice()
      .sort((a, b) => (parseRecordStartDate(b)?.getTime() || 0) - (parseRecordStartDate(a)?.getTime() || 0))[0];
  }
  const locMatches = loadCadastro(CAD_LOCACOES_KEY).filter((l) => normalizePlate(l.placa) === placa);
  if (!locMatches.length) return null;
  const ativoLoc = locMatches.find((l) => !String(l.fim || "").trim());
  return ativoLoc || locMatches[locMatches.length - 1];
}

function normalizeDiaPagamentoSugestao(value) {
  const dia = normalizeKey(String(value || "")).slice(0, 3);
  if (dia === "SEG" || dia === "TER" || dia === "QUA" || dia === "QUI" || dia === "SEX" || dia === "SAB") {
    return dia;
  }
  return "";
}

function getDiaPagamentoFromSources(cpfDigits, placaRaw) {
  const cpf = onlyDigits(String(cpfDigits || ""));
  const placa = normalizePlate(placaRaw);
  const pick = (items) => {
    const matches = (items || []).filter((x) => {
      const cpfOk = onlyDigits(String(x.cpf || "")) === cpf;
      const placaOk = placa ? normalizePlate(x.placa) === placa : true;
      return cpfOk && placaOk;
    });
    const ativo = matches.find((x) => !String(x.fim || "").trim());
    const ref = ativo || matches[matches.length - 1];
    return normalizeDiaPagamentoSugestao(ref?.diaPagamento);
  };
  return (
    pick(loadCadastro(CAD_LOCACOES_KEY)) ||
    pick(locacoesSeedData) ||
    pick(getAdminDataset()) ||
    ""
  );
}

function autoFillLancamentoFromCpf(cpfDigits) {
  const cpf = onlyDigits(String(cpfDigits || ""));
  if (cpf.length !== 11) return;
  const contrato = findBestContratoForLancamentoByCpf(cpf);
  if (!contrato) return;
  const placaAtual = normalizePlate(String(lancAluguelPlacaInput?.value || ""));
  const placaContrato = normalizePlate(String(contrato.placa || ""));
  if (placaContrato && placaAtual !== placaContrato && lancAluguelPlacaInput) {
    lancAluguelPlacaInput.value = placaContrato;
  }
  if (lancAluguelDiaPagamentoInput) {
    const diaContrato =
      normalizeDiaPagamentoSugestao(contrato.diaPagamento) ||
      getDiaPagamentoFromSources(cpf, placaContrato || placaAtual);
    if (diaContrato) lancAluguelDiaPagamentoInput.value = diaContrato;
  }
  suggestValorPagoFromContrato();
  suggestSemanaInicioFromDiaPagamento();
}

function autoFillLancamentoFromPlaca(placaRaw) {
  const placa = normalizePlate(placaRaw);
  if (!placa) return;
  const contrato = findBestContratoForLancamentoByPlaca(placa);
  if (!contrato) return;
  const cpfAtual = onlyDigits(String(lancAluguelCpfInput?.value || ""));
  const cpfContrato = onlyDigits(String(contrato.cpf || ""));
  if (cpfContrato.length === 11 && cpfAtual !== cpfContrato && lancAluguelCpfInput) {
    lancAluguelCpfInput.value = formatCpf(cpfContrato);
    prefillLancamentoAluguelByCpf(cpfContrato);
  }
  if (lancAluguelDiaPagamentoInput) {
    const diaContrato =
      normalizeDiaPagamentoSugestao(contrato.diaPagamento) ||
      getDiaPagamentoFromSources(cpfContrato || cpfAtual, placa);
    if (diaContrato) lancAluguelDiaPagamentoInput.value = diaContrato;
  }
  suggestValorPagoFromContrato();
  suggestSemanaInicioFromDiaPagamento();
}

function getLancamentoClienteCandidates() {
  const byCpf = new Map();
  loadCadastro(CAD_CLIENTES_KEY).forEach((c) => {
    const cpf = onlyDigits(String(c.cpf || ""));
    if (cpf.length !== 11) return;
    byCpf.set(cpf, {
      nome: String(c.nome || "").trim(),
      cpf,
      placa: "",
    });
  });
  getAdminDataset().forEach((r) => {
    const cpf = onlyDigits(String(r.cpf || ""));
    if (cpf.length !== 11) return;
    const prev = byCpf.get(cpf) || { nome: "", cpf, placa: "" };
    byCpf.set(cpf, {
      nome: String(prev.nome || r.nome || "").trim(),
      cpf,
      placa: normalizePlate(prev.placa || r.placa || ""),
    });
  });
  return Array.from(byCpf.values()).filter((x) => x.nome && x.cpf);
}

function renderLancamentoClienteSugestoes(queryRaw) {
  if (!lancAluguelClienteSugestoes) return [];
  const query = normalizeName(String(queryRaw || ""));
  lancAluguelClienteSugestoes.innerHTML = "";
  if (!query || query.length < 2) return [];
  const matches = getLancamentoClienteCandidates()
    .filter((c) => normalizeName(c.nome).includes(query))
    .slice(0, 12);
  matches.forEach((c) => {
    const option = document.createElement("option");
    option.value = c.nome;
    option.dataset.cpf = c.cpf;
    option.dataset.placa = c.placa || "";
    option.label = `${formatCpf(c.cpf)}${c.placa ? ` - ${c.placa}` : ""}`;
    lancAluguelClienteSugestoes.appendChild(option);
  });
  return matches;
}

function autoFillLancamentoByNome(nomeRaw) {
  const nomeKey = normalizeName(String(nomeRaw || ""));
  if (!nomeKey) return;
  const matches = getLancamentoClienteCandidates().filter(
    (c) => normalizeName(c.nome) === nomeKey
  );
  const choice = matches[0];
  if (!choice) return;
  if (lancAluguelClienteNomeInput) lancAluguelClienteNomeInput.value = choice.nome;
  if (lancAluguelCpfInput) lancAluguelCpfInput.value = formatCpf(choice.cpf);
  autoFillLancamentoFromCpf(choice.cpf);
  prefillLancamentoAluguelByCpf(choice.cpf);
  if (choice.placa && lancAluguelPlacaInput) {
    lancAluguelPlacaInput.value = choice.placa;
    autoFillLancamentoFromPlaca(choice.placa);
  }
  suggestValorPagoFromContrato();
  suggestSemanaInicioFromDiaPagamento();
  renderLancamentoAluguelResumo();
}

function autoFillSemanaFimFromInicio() {
  if (!lancAluguelSemanaInicioInput || !lancAluguelSemanaFimInput) return;
  const inicioRaw = String(lancAluguelSemanaInicioInput.value || "").trim();
  const inicio = parseBrDate(inicioRaw);
  if (!inicio) return;
  const fim = addCalendarDays(inicio, 7);
  if (!fim) return;
  lancAluguelSemanaFimInput.value = formatDataDmaBr(fim);
}

function suggestSemanaInicioFromDiaPagamento() {
  if (!lancAluguelDiaPagamentoInput || !lancAluguelSemanaInicioInput) return;
  const dia = String(lancAluguelDiaPagamentoInput.value || "").trim().toUpperCase();
  const dayMap = { SEG: 1, TER: 2, QUA: 3, QUI: 4, SEX: 5, SAB: 6 };
  const targetDow = dayMap[dia];
  if (!targetDow) return;
  const hoje = toDateOnly(new Date());
  if (!hoje) return;
  const delta = (targetDow - hoje.getDay() + 7) % 7;
  const vencimento = addCalendarDays(hoje, delta);
  if (!vencimento) return;
  const inicioRaw = String(lancAluguelSemanaInicioInput.value || "").trim();
  const canOverride =
    !inicioRaw || String(lancAluguelSemanaInicioInput.dataset.autoSuggested || "") === "1";
  if (!canOverride) return;
  lancAluguelSemanaInicioInput.value = formatDataDmaBr(vencimento);
  lancAluguelSemanaInicioInput.dataset.autoSuggested = "1";
  autoFillSemanaFimFromInicio();
}

function getSuggestedContratoForLancamento() {
  const cpf = onlyDigits(String(lancAluguelCpfInput?.value || ""));
  const placa = normalizePlate(String(lancAluguelPlacaInput?.value || ""));
  if (cpf.length === 11 && placa) {
    return findContratoForLancamentoResumo(cpf, placa) || findBestContratoForLancamentoByCpf(cpf);
  }
  if (placa) return findBestContratoForLancamentoByPlaca(placa);
  if (cpf.length === 11) return findBestContratoForLancamentoByCpf(cpf);
  return null;
}

function suggestValorPagoFromContrato() {
  if (!lancAluguelValorPagoInput) return;
  const valorAtual = parseCurrencyBR(String(lancAluguelValorPagoInput.value || ""));
  const canOverride =
    valorAtual <= 0 || String(lancAluguelValorPagoInput.dataset.autoSuggested || "") === "1";
  if (!canOverride) return;
  const contrato = getSuggestedContratoForLancamento();
  if (!contrato) return;
  const valorSemanal = parseCurrencyBR(contrato.valorSemanal || contrato.valorPlano);
  const dyn = withDynamicFinancialFields({
    ...contrato,
    valorSemanal: contrato.valorSemanal || contrato.valorPlano || 0,
    devidoHoje: contrato.devidoHoje || contrato.devido || 0,
  });
  const valorDevido = parseCurrencyBR(dyn.devidoHoje || contrato.devidoHoje || contrato.devido);
  const valorPagoAcumulado = parseCurrencyBR(contrato.pago || contrato.valorPago);
  const valorSugerido = Math.max(0, valorDevido + valorSemanal - valorPagoAcumulado);
  if (valorSugerido > 0) {
    lancAluguelValorPagoInput.value = currencyBRL(valorSugerido);
    lancAluguelValorPagoInput.dataset.autoSuggested = "1";
    return;
  }
  if (valorSemanal > 0) {
    lancAluguelValorPagoInput.value = currencyBRL(valorSemanal);
    lancAluguelValorPagoInput.dataset.autoSuggested = "1";
  }
}

function formatLancamentoValorPagoInput() {
  if (!lancAluguelValorPagoInput) return;
  const valor = parseCurrencyBR(String(lancAluguelValorPagoInput.value || ""));
  lancAluguelValorPagoInput.value = valor > 0 ? currencyBRL(valor) : "";
}

function findContratoForLancamentoResumo(cpfDigits, placaRaw) {
  const cpf = onlyDigits(String(cpfDigits || ""));
  const placa = normalizePlate(placaRaw);
  if (cpf.length !== 11) return null;
  const adminMatches = getAdminDataset().filter((r) => {
    const cpfOk = onlyDigits(String(r.cpf || "")) === cpf;
    const plateOk = placa ? normalizePlate(r.placa) === placa : true;
    return cpfOk && plateOk;
  });
  if (adminMatches.length) {
    const ativo = adminMatches.find((r) => !String(r.fim || "").trim());
    if (ativo) return ativo;
    return adminMatches
      .slice()
      .sort((a, b) => (parseRecordStartDate(b)?.getTime() || 0) - (parseRecordStartDate(a)?.getTime() || 0))[0];
  }
  const locMatches = loadCadastro(CAD_LOCACOES_KEY).filter((l) => {
    const cpfOk = onlyDigits(String(l.cpf || "")) === cpf;
    const plateOk = placa ? normalizePlate(l.placa) === placa : true;
    return cpfOk && plateOk;
  });
  if (!locMatches.length) return null;
  const ativoLoc = locMatches.find((l) => !String(l.fim || "").trim());
  const loc = ativoLoc || locMatches[locMatches.length - 1];
  const adminRef = getAdminDataset().find((r) => {
    const cpfOk = onlyDigits(String(r.cpf || "")) === cpf;
    const plateOk = placa ? normalizePlate(r.placa) === normalizePlate(loc.placa) : true;
    return cpfOk && plateOk;
  });
  return {
    ...adminRef,
    ...loc,
    nome: findClienteByCpfCadastro(cpf)?.nome || "",
    valorSemanal: loc.valorSemanal || loc.valorPlano || "",
    pago: loc.pago || "",
    devidoHoje: loc.devidoHoje || loc.devido || "",
  };
}

function getPlanoLancamentoResumo(contrato) {
  const planoRaw = String(contrato?.plano || "").trim();
  if (planoRaw) return planoRaw;
  const q = parseCurrencyBR(contrato?.q);
  if (q > 0) return toPlanName(contrato);
  return "DK MEU TRANSPORTE";
}

function isCarroLancamentoResumo(placaRaw, contrato) {
  if (normalizeKey(contrato?.tipoVeiculo) === "CARRO") return true;
  const placa = normalizePlate(placaRaw || contrato?.placa || "");
  if (!placa) return false;
  seedVeiculosDatabaseIfNeeded();
  const veiculos = loadCadastro(CAD_VEICULOS_KEY);
  const v = veiculos.find((item) => normalizePlate(item.placa) === placa);
  if (!v) return false;
  if (normalizeKey(v.tipo) === "CARRO") return true;
  return normalizeKey(v.tag).includes("DKCR");
}

function renderLancamentoAluguelResumo() {
  if (!lancamentoAluguelResumo) return;
  const cpf = onlyDigits(String(lancAluguelCpfInput?.value || ""));
  const placaRaw = String(lancAluguelPlacaInput?.value || "").trim().toUpperCase();
  if (cpf.length !== 11) {
    lancamentoAluguelResumo.innerHTML =
      "<p>Informe CPF (e opcionalmente placa) para visualizar o resumo do lançamento.</p>";
    return;
  }
  const contrato = findContratoForLancamentoResumo(cpf, placaRaw);
  if (!contrato) {
    lancamentoAluguelResumo.innerHTML = "<p>Nenhum contrato localizado para esse CPF/placa.</p>";
    return;
  }
  const nome = String(contrato.nome || findClienteByCpfCadastro(cpf)?.nome || "Nao informado");
  const placa = normalizePlate(placaRaw || contrato.placa || "");
  const modelo = findModeloByPlaca(placa);
  const inicio = formatContratoInicioClienteVida(contrato);
  const valorSemanal = parseCurrencyBR(contrato.valorSemanal || contrato.valorPlano);
  const dyn = withDynamicFinancialFields({
    ...contrato,
    valorSemanal: contrato.valorSemanal || contrato.valorPlano || 0,
    devidoHoje: contrato.devidoHoje || contrato.devido || 0,
  });
  const valorDevido = parseCurrencyBR(dyn.devidoHoje || contrato.devidoHoje || contrato.devido);
  const valorPagoAcumulado = parseCurrencyBR(contrato.pago || contrato.valorPago);
  const totalLancamentosAluguel = getLancamentosAluguel()
    .filter((l) => {
      const cpfOk = onlyDigits(String(l.cpf || "")) === cpf;
      const plateOk = placa ? normalizePlate(l.placa) === placa : true;
      return cpfOk && plateOk;
    })
    .reduce((acc, l) => acc + getLancamentoAluguelValor(l), 0);
  const valorPagoDigitado = parseCurrencyBR(String(lancAluguelValorPagoInput?.value || ""));
  const valorLancamento = valorPagoDigitado > 0 ? valorPagoDigitado : totalLancamentosAluguel;
  const saldoPagar = Math.max(0, valorDevido + totalLancamentosAluguel - valorPagoAcumulado);
  const plano = getPlanoLancamentoResumo(contrato);
  const planoKey = normalizeKey(plano);
  const saldoPositivo = valorPagoAcumulado > valorDevido;
  const emDebito = valorPagoAcumulado < valorDevido;
  const isCarro = isCarroLancamentoResumo(placa, contrato);
  lancamentoAluguelResumo.classList.remove(
    "resumo-status-moto-positivo",
    "resumo-status-transporte-positivo",
    "resumo-status-carro",
    "resumo-status-debito"
  );
  if (emDebito) {
    lancamentoAluguelResumo.classList.add("resumo-status-debito");
  } else if (isCarro) {
    lancamentoAluguelResumo.classList.add("resumo-status-carro");
  } else if (saldoPositivo && planoKey.includes("MINHA MOTO")) {
    lancamentoAluguelResumo.classList.add("resumo-status-moto-positivo");
  } else if (saldoPositivo && planoKey.includes("MEU TRANSPORTE")) {
    lancamentoAluguelResumo.classList.add("resumo-status-transporte-positivo");
  }
  lancamentoAluguelResumo.innerHTML = `
    <p><strong>${escapeHtml(nome)}</strong> - ${escapeHtml(modelo)} - data de inicio da locacao <strong>${escapeHtml(
    inicio || "-"
  )}</strong></p>
    <p><strong>Plano:</strong> ${escapeHtml(plano)}</p>
    <p><strong>Valor semanal:</strong> ${currencyBRL(valorSemanal)} | <strong>Valor devido:</strong> ${currencyBRL(
    valorDevido
  )} | <strong>Valor pago acumulado:</strong> ${currencyBRL(valorPagoAcumulado)}</p>
    <p><strong>Lançamentos de aluguel:</strong> ${currencyBRL(
      totalLancamentosAluguel
    )} | <strong>Pagamento deste lancamento (sugestao):</strong> ${currencyBRL(
      valorLancamento
    )} | <strong>Saldo a pagar:</strong> ${currencyBRL(saldoPagar)}</p>
  `;
}

function inferTipoFromSeed(seedItem) {
  const tag = normalizeKey(seedItem.tag);
  if (tag.includes("DKCR")) return "CARRO";
  if (tag.includes("DKMT")) return "MOTO";
  const marca = normalizeKey(seedItem.marca);
  return marca === "CARRO" ? "CARRO" : "MOTO";
}

function nextClienteCodigo() {
  const clientes = loadCadastro(CAD_CLIENTES_KEY);

  const seedCpfs = new Set(
    clientesSeedData
      .map((c) => onlyDigits(String(c.cpf || "")))
      .filter((cpf) => cpf.length === 11)
  );
  const baseCount = seedCpfs.size;

  const novosCpfs = new Set();
  clientes.forEach((c) => {
    const cpf = onlyDigits(String(c.cpf || ""));
    if (cpf.length !== 11) return;
    if (!seedCpfs.has(cpf)) {
      novosCpfs.add(cpf);
    }
  });

  const usedCodes = new Set(
    clientes
      .map((c) => Number(onlyDigits(String(c.codigo || ""))))
      .filter((n) => Number.isFinite(n) && n > 0)
  );
  let next = baseCount + novosCpfs.size + 1;
  while (usedCodes.has(next)) {
    next += 1;
  }
  return `CLIENTE ${next}`;
}

function refreshClienteCodigoByCpf(cpfDigits) {
  const codigoInput = document.getElementById("cadClienteCodigo");
  if (!codigoInput) return;
  const cpf = onlyDigits(String(cpfDigits || ""));
  if (!cpf) {
    codigoInput.value = "";
    return;
  }
  const existente = findClienteByCpfCadastro(cpf);
  if (existente) {
    codigoInput.value = String(existente.codigo || "").trim() || nextClienteCodigo();
    return;
  }
  codigoInput.value = nextClienteCodigo();
}

function isHeaderLikePlate(value) {
  return normalizeKey(String(value || "")) === "PLACA";
}

function getVeiculosReportData() {
  seedVeiculosDatabaseIfNeeded();
  return loadCadastro(CAD_VEICULOS_KEY);
}

function getClientesReportData() {
  seedClientesDatabaseIfNeeded();
  const clientes = loadCadastro(CAD_CLIENTES_KEY);
  const seedCodeByCpf = new Map();
  clientesSeedData.forEach((c, idx) => {
    const cpf = onlyDigits(String(c.cpf || ""));
    if (cpf.length === 11 && !seedCodeByCpf.has(cpf)) {
      seedCodeByCpf.set(cpf, idx + 1);
    }
  });

  const grouped = new Map();
  clientes.forEach((c) => {
    const cpf = onlyDigits(String(c.cpf || ""));
    const nome = normalizeName(c.nome || "");
    const celular = onlyDigits(String(c.celular || ""));
    const key = cpf.length === 11 ? `CPF:${cpf}` : `NOME:${nome}|CEL:${celular}`;
    const existing = grouped.get(key);
    if (!existing) {
      grouped.set(key, c);
      return;
    }
    const score = (obj) =>
      [
        obj.codigo,
        obj.cpf,
        obj.nome,
        obj.celular,
        obj.recado1,
        obj.recado2,
        obj.cnh,
        obj.categoria,
        obj.vencimento,
        obj.cep,
        obj.municipioUf,
        obj.endereco,
      ].filter((v) => String(v || "").trim()).length;
    if (score(c) > score(existing)) {
      grouped.set(key, c);
    }
  });

  const deduped = Array.from(grouped.values()).map((c) => {
    const cpf = onlyDigits(String(c.cpf || ""));
    const codigoAtual = String(c.codigo || "").trim();
    if (codigoAtual) return c;
    const seedCode = seedCodeByCpf.get(cpf);
    if (seedCode) {
      return { ...c, codigo: `CLIENTE ${seedCode}` };
    }
    return c;
  });

  return deduped.sort((a, b) => {
    const codeA = Number(onlyDigits(String(a.codigo || "")));
    const codeB = Number(onlyDigits(String(b.codigo || "")));
    if (Number.isFinite(codeA) && Number.isFinite(codeB) && codeA && codeB) {
      return codeA - codeB;
    }
    return String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR");
  });
}

function escapeCsvCell(value) {
  const text = String(value ?? "");
  if (/[;"\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function downloadStyledExcel(fileName, headers, rows, metaLines = []) {
  const metaHtml = metaLines.length
    ? `<table>${metaLines
        .map(
          (line) =>
            `<tr><td class="meta-key">${escapeHtml(line[0])}</td><td>${escapeHtml(line[1])}</td></tr>`
        )
        .join("")}</table><br>`
    : "";
  const headerHtml = `<tr>${headers.map((h) => `<th>${escapeHtml(h)}</th>`).join("")}</tr>`;
  const bodyHtml = rows
    .map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`)
    .join("");

  const html = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
      <head>
        <meta charset="utf-8">
        <style>
          table { border-collapse: collapse; font-family: Arial, sans-serif; font-size: 12px; }
          th, td { border: 1px solid #cfcfcf; padding: 6px; text-align: left; }
          th { font-weight: 700; background: #efefef; }
          .meta-key { font-weight: 700; background: #efefef; }
        </style>
      </head>
      <body>
        ${metaHtml}
        <table>
          <thead>${headerHtml}</thead>
          <tbody>${bodyHtml}</tbody>
        </table>
      </body>
    </html>
  `;

  const blob = new Blob([`\uFEFF${html}`], {
    type: "application/vnd.ms-excel;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName.endsWith(".xls") ? fileName : `${fileName}.xls`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function exportVeiculosExcel() {
  const veiculos = getVeiculosReportData();
  const sortedVeiculos = veiculos.slice().sort((a, b) => {
    const tipoA = normalizeKey(a.tipo) === "CARRO" ? 0 : 1;
    const tipoB = normalizeKey(b.tipo) === "CARRO" ? 0 : 1;
    if (tipoA !== tipoB) return tipoA - tipoB;
    const tagA = String(a.tag || "");
    const tagB = String(b.tag || "");
    return tagA.localeCompare(tagB, "pt-BR");
  });
  const qtdCarros = veiculos.filter((v) => normalizeKey(v.tipo) === "CARRO").length;
  const qtdMotos = veiculos.filter((v) => normalizeKey(v.tipo) === "MOTO").length;
  const patrimonioTotal = veiculos.reduce(
    (acc, v) => acc + parseCurrencyBR(v.valor),
    0
  );
  const headers = [
    "Tipo",
    "Tag",
    "Placa",
    "Marca",
    "Modelo",
    "Valor",
    "Cor",
    "Chassi",
    "Ano/Modelo",
    "Renavam",
    "Motor",
  ];
  const rows = [];
  const carros = sortedVeiculos.filter((v) => normalizeKey(v.tipo) === "CARRO");
  const motos = sortedVeiculos.filter((v) => normalizeKey(v.tipo) === "MOTO");
  carros.forEach((v) => {
    rows.push([
      v.tipo || "",
      v.tag || "",
      v.placa || "",
      v.marca || "",
      v.modelo || "",
      v.valor || "",
      v.cor || "",
      v.chassi || "",
      v.anoModelo || "",
      v.renavam || "",
      v.motor || "",
    ]);
  });
  if (carros.length && motos.length) {
    rows.push(["", "", "", "", "", "", "", "", "", "", ""]);
  }
  motos.forEach((v) => {
    rows.push([
      v.tipo || "",
      v.tag || "",
      v.placa || "",
      v.marca || "",
      v.modelo || "",
      v.valor || "",
      v.cor || "",
      v.chassi || "",
      v.anoModelo || "",
      v.renavam || "",
      v.motor || "",
    ]);
  });
  downloadStyledExcel("relatorio-veiculos-dk.xls", headers, rows, [
    ["Empresa", EMPRESA_RELATORIO],
    ["CNPJ", CNPJ_RELATORIO],
    ["Quantidade de carros", String(qtdCarros)],
    ["Quantidade de motos", String(qtdMotos)],
    ["Total de patrimonio", currencyBRL(patrimonioTotal)],
  ]);
}

function exportVeiculosPdf() {
  const veiculos = getVeiculosReportData();
  const sortedVeiculos = veiculos.slice().sort((a, b) => {
    const tipoA = normalizeKey(a.tipo) === "CARRO" ? 0 : 1;
    const tipoB = normalizeKey(b.tipo) === "CARRO" ? 0 : 1;
    if (tipoA !== tipoB) return tipoA - tipoB;
    return String(a.tag || "").localeCompare(String(b.tag || ""), "pt-BR");
  });
  const qtdCarros = veiculos.filter((v) => normalizeKey(v.tipo) === "CARRO").length;
  const qtdMotos = veiculos.filter((v) => normalizeKey(v.tipo) === "MOTO").length;
  const patrimonioTotal = veiculos.reduce(
    (acc, v) => acc + parseCurrencyBR(v.valor),
    0
  );
  let previousTipo = "";
  const rows = sortedVeiculos
    .map((v) => {
      const currentTipo = normalizeKey(v.tipo);
      const spacer =
        previousTipo && previousTipo !== currentTipo
          ? `<tr><td colspan="6" style="background:#e9e9e9;height:10px"></td></tr>`
          : "";
      previousTipo = currentTipo;
      return `${spacer}<tr>
        <td>${v.tipo || ""}</td>
        <td>${v.tag || ""}</td>
        <td>${v.placa || ""}</td>
        <td>${v.marca || ""}</td>
        <td>${v.modelo || ""}</td>
        <td>${v.chassi || ""}</td>
      </tr>`;
    })
    .join("");

  const win = window.open("", "_blank");
  if (!win) return;
  win.document.write(`
    <html>
      <head>
        <meta charset="utf-8">
        <title>Relatorio de Veiculos DK</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 16px; color: #111; }
          h1 { margin: 0 0 8px; font-size: 20px; }
          p { margin: 0 0 12px; font-size: 12px; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; }
          th, td { border: 1px solid #ddd; padding: 6px; text-align: left; }
          th { background: #f2f2f2; }
        </style>
      </head>
      <body>
        <h1>Relatorio de Veiculos - DK</h1>
        <p><strong>Empresa:</strong> ${EMPRESA_RELATORIO}</p>
        <p><strong>CNPJ:</strong> ${CNPJ_RELATORIO}</p>
        <p><strong>Quantidade de carros:</strong> ${qtdCarros}</p>
        <p><strong>Quantidade de motos:</strong> ${qtdMotos}</p>
        <p><strong>Total de patrimonio:</strong> ${currencyBRL(patrimonioTotal)}</p>
        <p><strong>Total de registros:</strong> ${veiculos.length}</p>
        <table>
          <thead>
            <tr>
              <th>Tipo</th>
              <th>Tag</th>
              <th>Placa</th>
              <th>Marca</th>
              <th>Modelo</th>
              <th>Chassi</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </body>
    </html>
  `);
  win.document.close();
  win.focus();
  win.print();
}

function exportClientesExcel() {
  const clientes = getClientesReportData();
  const headers = [
    "Codigo",
    "Data do cadastro",
    "CPF",
    "Nome",
    "Celular",
    "Recado 1",
    "Recado 2",
    "CNH",
    "Categoria",
    "Vencimento",
    "EAR",
    "CEP",
    "Municipio/UF",
    "Endereco",
    "Status",
  ];
  const rows = clientes.map((c) => [
    c.codigo || "",
    c.dataCadastro || "",
    formatCpf(c.cpf || ""),
    c.nome || "",
    c.celular || "",
    c.recado1 || "",
    c.recado2 || "",
    c.cnh || "",
    c.categoria || "",
    c.vencimento || "",
    c.ear || "",
    c.cep || "",
    c.municipioUf || "",
    c.endereco || "",
    c.status || "ATIVO",
  ]);
  downloadStyledExcel("relatorio-clientes-dk.xls", headers, rows, [
    ["Relatorio", "Cadastro de clientes"],
    ["Total", String(clientes.length)],
  ]);
}

function exportClientesPdf() {
  const clientes = getClientesReportData();
  const rows = clientes
    .map(
      (c) => `<tr>
        <td>${c.codigo || ""}</td>
        <td>${formatCpf(c.cpf || "")}</td>
        <td>${c.nome || ""}</td>
        <td>${c.celular || ""}</td>
        <td>${c.municipioUf || ""}</td>
        <td>${c.status || "ATIVO"}</td>
      </tr>`
    )
    .join("");
  const win = window.open("", "_blank");
  if (!win) return;
  win.document.write(`
    <html>
      <head>
        <meta charset="utf-8">
        <title>Relatorio de Clientes DK</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 16px; color: #111; }
          h1 { margin: 0 0 8px; font-size: 20px; }
          p { margin: 0 0 12px; font-size: 12px; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; }
          th, td { border: 1px solid #ddd; padding: 6px; text-align: left; }
          th { background: #f2f2f2; }
        </style>
      </head>
      <body>
        <h1>Relatorio de Clientes - DK</h1>
        <p><strong>Total de registros:</strong> ${clientes.length}</p>
        <table>
          <thead>
            <tr>
              <th>Codigo</th>
              <th>CPF</th>
              <th>Nome</th>
              <th>Celular</th>
              <th>Municipio/UF</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </body>
    </html>
  `);
  win.document.close();
  win.focus();
  win.print();
}

function formatLocacaoClienteExportCell(row, col) {
  if (col.key !== "cliente") return String(row[col.key] ?? "Nao informado");
  const nome = String(row.cliente ?? "").trim();
  const tl = String(row.pagamentosTimeline ?? "").trim();
  if (nome && tl) return `${nome} — ${tl}`;
  return nome || "Nao informado";
}

function exportRelatorioPdfFromCache(cache) {
  if (!cache || !Array.isArray(cache.columns) || !Array.isArray(cache.rows)) return;
  const rowsHtml = cache.rows
    .map(
      (row) =>
        `<tr>${cache.columns
          .map((col) => `<td>${formatLocacaoClienteExportCell(row, col)}</td>`)
          .join("")}</tr>`
    )
    .join("");
  const win = window.open("", "_blank");
  if (!win) return;
  win.document.write(`
    <html>
      <head>
        <meta charset="utf-8">
        <title>${cache.title}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 16px; color: #111; }
          h1 { margin: 0 0 8px; font-size: 20px; }
          p { margin: 0 0 10px; font-size: 12px; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; }
          th, td { border: 1px solid #ddd; padding: 6px; text-align: left; }
          th { background: #f2f2f2; }
        </style>
      </head>
      <body>
        <h1>${cache.title}</h1>
        <p><strong>Total:</strong> ${cache.rows.length}</p>
        <table>
          <thead>
            <tr>${cache.columns.map((c) => `<th>${c.label}</th>`).join("")}</tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </body>
    </html>
  `);
  win.document.close();
  win.focus();
  win.print();
}

function exportRelatorioExcelFromCache(cache, fileName) {
  if (!cache || !Array.isArray(cache.columns) || !Array.isArray(cache.rows)) return;
  const headers = cache.columns.map((c) => c.label);
  const rows = cache.rows.map((row) =>
    cache.columns.map((c) => formatLocacaoClienteExportCell(row, c))
  );
  downloadStyledExcel(fileName.replace(/\.csv$/i, ".xls"), headers, rows, [
    ["Relatorio", cache.title],
    ["Total", String(cache.rows.length)],
  ]);
}

function computeSaldoFromRecords(records) {
  if (!Array.isArray(records) || !records.length) return 0;
  return records.reduce((acc, r) => {
    const devido = parseCurrencyBR(r?.devidoHoje);
    const pago = parseCurrencyBR(r?.pago);
    return acc + (devido - pago);
  }, 0);
}

function getGlobalSaldoTotal() {
  return computeSaldoFromRecords(getAdminDataset());
}

function exportGenericReportExcel(container, fileName) {
  if (!container) return;
  const table = container.querySelector("table.relatorio-table");
  let headers = [];
  let rows = [];
  const isMonetaryHeader = (headerText) => {
    const h = normalizeKey(headerText || "");
    return (
      h.includes("VALOR") ||
      h.includes("RECEITA") ||
      h.includes("PAGO") ||
      h.includes("DEVIDO") ||
      h.includes("SALDO") ||
      h.includes("TOTAL")
    );
  };
  const toExcelCellValue = (text, headerText) => {
    const raw = String(text || "").trim();
    if (!raw) return "";
    if (!isMonetaryHeader(headerText) && !raw.includes("R$")) return raw;
    const numeric = parseCurrencyBR(raw);
    // Preserve text when clearly not numeric (e.g., labels).
    if (!Number.isFinite(numeric) || (numeric === 0 && !/\d/.test(raw))) return raw;
    return numeric;
  };
  if (table) {
    headers = Array.from(table.querySelectorAll("thead th")).map((h) => String(h.textContent || "").trim());
    rows = Array.from(table.querySelectorAll("tbody tr")).map((tr) =>
      Array.from(tr.querySelectorAll("td")).map((td, idx) =>
        toExcelCellValue(String(td.textContent || "").trim(), headers[idx] || "")
      )
    );

    const isFinanceAtrasoReport = /Total de clientes em atraso:/i.test(
      String(container.textContent || "")
    );
    const saldoCol = headers.findIndex((h) => normalizeKey(h).includes("SALDO"));
    if (isFinanceAtrasoReport && saldoCol >= 0) {
      rows = rows.map((row) => {
        const next = [...row];
        const n = Number(next[saldoCol]);
        if (Number.isFinite(n)) next[saldoCol] = Math.abs(n);
        return next;
      });
      const totalizadorText = String(container.textContent || "");
      const m = totalizadorText.match(/Totalizador:\s*R\$\s*([0-9\.\,\-\+\s]+)/i);
      const totalizador = m ? parseCurrencyBR(m[0]) : null;
      if (totalizador != null && Number.isFinite(totalizador) && totalizador > 0) {
        const totalRow = headers.map(() => "");
        totalRow[0] = "TOTALIZADOR";
        totalRow[saldoCol] = totalizador;
        rows.push(totalRow);
      }
    }
  } else {
    const blocks = Array.from(container.querySelectorAll("p, li, h3, h4"))
      .map((el) => String(el.textContent || "").trim())
      .filter(Boolean);
    headers = ["RELATORIO"];
    rows = blocks.map((line) => [line]);
  }
  if (!rows.length) rows = [["Sem dados para exportar"]];
  if (!headers.length) headers = ["RELATORIO"];
  downloadStyledExcel(fileName.replace(/\.csv$/i, ".xls"), headers, rows);
}

function exportGenericReportPdf(container, title) {
  if (!container) return;
  const printable = container.cloneNode(true);
  printable.querySelectorAll(".report-actions").forEach((node) => node.remove());
  const popup = window.open("", "_blank", "width=1100,height=800");
  if (!popup) return;
  popup.document.write(`
    <html>
      <head>
        <title>${title}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; color: #111; }
          table { width: 100%; border-collapse: collapse; margin-top: 8px; }
          th, td { border: 1px solid #bbb; padding: 6px; font-size: 12px; text-align: left; vertical-align: top; }
          h1,h2,h3,h4 { margin: 0 0 8px; }
          p { margin: 6px 0; }
        </style>
      </head>
      <body>
        <h2>${title}</h2>
        ${printable.innerHTML}
      </body>
    </html>
  `);
  popup.document.close();
  popup.focus();
  popup.print();
}

function exportAuditLogPdf() {
  const logs = loadAuditLog().sort(
    (a, b) => new Date(a.timestampIso || 0) - new Date(b.timestampIso || 0)
  );
  const rows = logs
    .map(
      (l) => `<tr>
        <td>${l.timestampLabel || "Nao informado"}</td>
        <td>${l.user || "Nao informado"}</td>
        <td>${l.action || "Nao informado"}</td>
        <td>${l.entity || "Nao informado"}</td>
        <td>${l.details || "Nao informado"}</td>
      </tr>`
    )
    .join("");
  const win = window.open("", "_blank");
  if (!win) return;
  win.document.write(`
    <html>
      <head>
        <meta charset="utf-8">
        <title>Dados de utilização</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 16px; color: #111; }
          h1 { margin: 0 0 8px; font-size: 20px; }
          p { margin: 0 0 10px; font-size: 12px; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; }
          th, td { border: 1px solid #ddd; padding: 6px; text-align: left; }
          th { background: #f2f2f2; }
        </style>
      </head>
      <body>
        <h1>Relatório - Dados de utilização</h1>
        <p><strong>Total de alterações:</strong> ${logs.length}</p>
        <table>
          <thead>
            <tr>
              <th>Data/Hora</th>
              <th>Usuário</th>
              <th>Ação</th>
              <th>Entidade</th>
              <th>Detalhes</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </body>
    </html>
  `);
  win.document.close();
  win.focus();
  win.print();
}

function getTelefoneByCpf(cpf) {
  const normalized = onlyDigits(String(cpf || ""));
  const clientes = [...loadCadastro(CAD_CLIENTES_KEY), ...clientesSeedData];
  if (!normalized) return "Nao informado";
  const cliente = clientes.find(
    (c) => onlyDigits(String(c.cpf || "")) === normalized
  );
  if (!cliente) return "Nao informado";
  const contatos = [
    String(cliente.celular || "").trim(),
    String(cliente.recado1 || "").trim(),
    String(cliente.recado2 || "").trim(),
  ].filter(Boolean);
  return contatos.length ? contatos.join(" / ") : "Nao informado";
}

function normalizeName(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .trim();
}

function getContatoByCpfOrNome(cpf, nome) {
  const byCpf = getTelefoneByCpf(cpf);
  if (byCpf !== "Nao informado") return byCpf;

  const normalizedNome = normalizeName(nome);
  if (!normalizedNome) return "Nao informado";
  const clientes = [...loadCadastro(CAD_CLIENTES_KEY), ...clientesSeedData];
  const cliente = clientes.find(
    (c) => normalizeName(c.nome) === normalizedNome
  );
  if (!cliente) return "Nao informado";
  const contatos = [
    String(cliente.celular || "").trim(),
    String(cliente.recado1 || "").trim(),
    String(cliente.recado2 || "").trim(),
  ].filter(Boolean);
  return contatos.length ? contatos.join(" / ") : "Nao informado";
}

function splitTelefones(contatoStr) {
  const parts = String(contatoStr || "")
    .split("/")
    .map((p) => p.trim())
    .filter(Boolean);
  return {
    telefone1: parts[0] || "Nao informado",
    telefone2: parts[1] || "Nao informado",
    telefone3: parts[2] || "Nao informado",
  };
}

function buildClienteLookupMap() {
  const base = [...loadCadastro(CAD_CLIENTES_KEY), ...clientesSeedData];
  const map = new Map();
  base.forEach((c) => {
    const cpf = onlyDigits(String(c.cpf || ""));
    if (!cpf) return;
    if (!map.has(cpf)) map.set(cpf, c);
  });
  return map;
}

function buildVeiculoLookupMap() {
  const map = new Map();
  const fromCad = loadCadastro(CAD_VEICULOS_KEY);
  const fromSeed = veiculosSeedData;
  const fromFrota = frotaData;
  [...fromCad, ...fromSeed, ...fromFrota].forEach((v) => {
    const placa = normalizePlate(v.placa);
    if (!placa) return;
    if (!map.has(placa)) map.set(placa, v);
  });
  return map;
}

function getCorrectedPlate(rawPlate) {
  const plate = normalizePlate(rawPlate);
  if (!plate) return "";
  const correction = PLACA_CORRECOES.find((c) => normalizePlate(c.old) === plate);
  return correction ? normalizePlate(correction.next) : plate;
}

function collectDataIntegrityIssues() {
  const clienteMap = buildClienteLookupMap();
  const veiculoMap = buildVeiculoLookupMap();
  const seen = new Set();
  const issues = [];
  receita2026Data.forEach((r) => {
    const cpf = onlyDigits(String(r.cpf || ""));
    const plate = getCorrectedPlate(r.placa);
    const keyClient = `CLIENT:${cpf}`;
    if (cpf && !clienteMap.has(cpf) && !seen.has(keyClient)) {
      seen.add(keyClient);
      issues.push({
        type: "CLIENTE_NAO_CADASTRADO",
        cpf: formatCpf(cpf),
        nome: r.nome || "Nao informado",
        placa: plate || "Nao informado",
      });
    }
    const keyPlate = `PLACA:${plate}`;
    if (plate && !veiculoMap.has(plate) && !seen.has(keyPlate)) {
      seen.add(keyPlate);
      issues.push({
        type: "PLACA_NAO_CADASTRADA",
        cpf: formatCpf(cpf),
        nome: r.nome || "Nao informado",
        placa: plate || "Nao informado",
      });
    }
  });
  return issues;
}

function buildIntegrityIssuesHtml(issues) {
  const rows = issues
    .slice(0, 120)
    .map((i) => `<tr><td>${i.type}</td><td>${i.nome}</td><td>${i.cpf || "-"}</td><td>${i.placa || "-"}</td></tr>`)
    .join("");
  return `
    <p><strong>Processo travado por inconsistência de dados.</strong></p>
    <p>Existe locação sem cliente/veículo cadastrado. Confirme os dados e tente novamente.</p>
    <div class="table-wrap">
      <table class="relatorio-table relatorio-compacto">
        <thead><tr><th>TIPO</th><th>NOME</th><th>CPF</th><th>PLACA</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    ${issues.length > 120 ? "<p><strong>Mostrando as primeiras 120 inconsistências.</strong></p>" : ""}
  `;
}

function buildLocacaoDatabaseRowsFromReceita2026() {
  const clienteMap = buildClienteLookupMap();
  const veiculoMap = buildVeiculoLookupMap();
  const activeSet = getActivePlatesSet();
  const latestIndexByPlate = new Map();
  receita2026Data.forEach((row, index) => {
    const plate = normalizePlate(row.placa);
    if (!plate) return;
    const inicio = Number(row.inicioSerial || 0);
    const prev = latestIndexByPlate.get(plate);
    if (!prev || inicio >= prev.inicioSerial) {
      latestIndexByPlate.set(plate, { index, inicioSerial: inicio });
    }
  });
  return receita2026Data.map((r, idx) => {
    const cpf = onlyDigits(String(r.cpf || ""));
    const placaNormalizada = getCorrectedPlate(r.placa);
    const cliente = clienteMap.get(cpf) || {};
    const veiculo = veiculoMap.get(placaNormalizada) || {};
    const financeiro = withDynamicFinancialFields({
      inicio: r.inicio,
      inicioSerial: r.inicioSerial,
      fim: r.fim,
      fimSerial: r.fimSerial,
      valorSemanal: r.valorSemanal,
      devidoHoje: r.devidoHoje,
      pago: r.pago,
      dias: r.dias,
    });

    const valorSemanalNum = parseCurrencyBR(r.valorSemanal);
    const valorQNum = parseCurrencyBR(r.q);
    const investimento = valorQNum - valorSemanalNum;
    const plano = investimento > 0 ? "DK MINHA MOTO" : "DK MEU TRANSPORTE";
    const pagoNum = parseCurrencyBR(r.pago);
    const devidoNum = parseCurrencyBR(financeiro.devidoHoje);
    const saldoNum = pagoNum - devidoNum;
    const isLatestByPlate = latestIndexByPlate.get(placaNormalizada)?.index === idx;
    const statusLocacao =
      (!String(r.fim || "").trim() || (activeSet.has(placaNormalizada) && isLatestByPlate))
        ? "ATIVO"
        : "INATIVO";

    return {
      id: idx + 1,
      cpf,
      clienteNome: r.nome || cliente.nome || "Nao informado",
      clienteCelular: cliente.celular || "",
      clienteRecado1: cliente.recado1 || "",
      clienteRecado2: cliente.recado2 || "",
      clienteStatus: cliente.status || "ATIVO",
      placa: placaNormalizada || r.placa || "",
      tipoVeiculo: veiculo.tipo || inferTipoFromSeed(veiculo),
      tagVeiculo: veiculo.tag || "",
      marcaVeiculo: veiculo.marca || "",
      modeloVeiculo: veiculo.modelo || findModeloByPlaca(r.placa),
      corVeiculo: veiculo.cor || "",
      chassiVeiculo: veiculo.chassi || "",
      anoModeloVeiculo: veiculo.anoModelo || "",
      renavamVeiculo: veiculo.renavam || "",
      motorVeiculo: veiculo.motor || "",
      statusVeiculo: veiculo.status || "",
      dataInicio: r.inicio || "",
      dataFim: r.fim || "",
      statusLocacao,
      valorSemanal: r.valorSemanal || "",
      plano,
      valorInvestimento: currencyBRL(investimento),
      valorDevidoHoje: financeiro.devidoHoje || "",
      valorPagoHoje: r.pago || "",
      saldo: `${saldoNum >= 0 ? "+" : "-"} ${currencyBRL(Math.abs(saldoNum))}`,
      saldoNumerico: saldoNum,
    };
  });
}

function syncLocacaoDatabaseFromReceita2026() {
  const rows = buildLocacaoDatabaseRowsFromReceita2026();
  saveCadastro(LOCACAO_DATABASE_KEY, rows);
  return rows;
}

function exportQuadroGeralExcel(rows) {
  const headers = [
    "CPF","CLIENTE","CELULAR","RECADO1","RECADO2","STATUS CLIENTE",
    "PLACA","TIPO VEICULO","TAG","MARCA","MODELO","COR","CHASSI","ANO/MODELO","RENAVAM","MOTOR","STATUS VEICULO",
    "DATA INICIO","DATA FIM","STATUS LOCACAO","VALOR SEMANAL","PLANO","VALOR INVESTIMENTO","VALOR DEVIDO","VALOR PAGO","SALDO"
  ];
  const tableRows = rows.map((r) => [
      formatCpf(r.cpf),r.clienteNome,r.clienteCelular,r.clienteRecado1,r.clienteRecado2,r.clienteStatus,
      r.placa,r.tipoVeiculo,r.tagVeiculo,r.marcaVeiculo,r.modeloVeiculo,r.corVeiculo,r.chassiVeiculo,r.anoModeloVeiculo,r.renavamVeiculo,r.motorVeiculo,r.statusVeiculo,
      r.dataInicio,r.dataFim,r.statusLocacao,r.valorSemanal,r.plano,r.valorInvestimento,r.valorDevidoHoje,r.valorPagoHoje,r.saldo,
  ]);
  downloadStyledExcel("quadro-geral-locacoes.xls", headers, tableRows, [
    ["Relatorio", "Quadro geral de locacoes"],
    ["Total", String(rows.length)],
  ]);
}

function exportQuadroGeralPdf(rows) {
  const rowsHtml = rows
    .slice(0, 300)
    .map((r) => `<tr><td>${r.clienteNome}</td><td>${formatCpf(r.cpf)}</td><td>${r.placa}</td><td>${r.modeloVeiculo}</td><td>${r.dataInicio}</td><td>${r.dataFim || "-"}</td><td>${r.plano}</td><td>${r.valorDevidoHoje}</td><td>${r.valorPagoHoje}</td><td>${r.saldo}</td></tr>`)
    .join("");
  const win = window.open("", "_blank");
  if (!win) return;
  win.document.write(`
    <html><head><meta charset="utf-8"><title>Quadro geral</title>
    <style>body{font-family:Arial;padding:16px;color:#111}table{width:100%;border-collapse:collapse;font-size:12px}th,td{border:1px solid #ddd;padding:6px;text-align:left}th{background:#f2f2f2}</style>
    </head><body>
    <h1>Quadro geral de locações</h1>
    <p><strong>Total de registros:</strong> ${rows.length}</p>
    <table><thead><tr><th>CLIENTE</th><th>CPF</th><th>PLACA</th><th>MODELO</th><th>INICIO</th><th>FIM</th><th>PLANO</th><th>DEVIDO</th><th>PAGO</th><th>SALDO</th></tr></thead><tbody>${rowsHtml}</tbody></table>
    </body></html>
  `);
  win.document.close();
  win.focus();
  win.print();
}

function renderRelatorioLocacao(tipo) {
  const snapshot = buildOperationalSnapshot();
  const veiculoByPlaca = getVehicleMapByPlate();

  if (tipo === "locados") {
    const rows = snapshot.activeRecords
      .map((r) => {
        const placaKey = normalizePlate(r.placa);
        const cad = veiculoByPlaca.get(placaKey);
        const contato = getContatoByCpfOrNome(r.cpf, r.nome);
        const telefones = splitTelefones(contato);
        const inicioDate = excelSerialToDate(r.inicioSerial) || parseBrDate(r.inicio);
        const nomeCli = r.nome || "Nao informado";
        const cpfDig = onlyDigits(String(r.cpf || ""));
        const pagamentosTimeline =
          cpfDig.length === 11 ? buildClientePagamentosTimelineTexto(cpfDig) : "";
        return {
          placa: r.placa || "",
          modelo: cad?.modelo || findModeloByPlaca(r.placa),
          cliente: nomeCli,
          cpfDigits: cpfDig,
          pagamentosTimeline,
          valorLocacao: r.valorSemanal || "",
          inicioLocacao: r.inicio || "",
          cadastroCriadoTs: Number(r.cadastroCriadoTs || 0),
          inicioTs: inicioDate?.getTime?.() || 0,
          ...telefones,
        };
      })
      .filter((r) => normalizePlate(r.placa));

    rows.sort((a, b) => {
      const byCadastro = Number(b.cadastroCriadoTs || 0) - Number(a.cadastroCriadoTs || 0);
      if (byCadastro !== 0) return byCadastro;
      return Number(b.inicioTs || 0) - Number(a.inicioTs || 0);
    });

    relatorioLocacaoCache = {
      title: "Relatório | Veículos locados",
      columns: [
        { key: "placa", label: "PLACA" },
        { key: "modelo", label: "MODELO" },
        { key: "cliente", label: "CLIENTE" },
        { key: "inicioLocacao", label: "INÍCIO DA LOCAÇÃO" },
        { key: "valorLocacao", label: "VALOR DE LOCAÇÃO" },
        { key: "telefone1", label: "TELEFONE 1" },
        { key: "telefone2", label: "TELEFONE 2" },
        { key: "telefone3", label: "TELEFONE 3" },
      ],
      rows,
    };

    const html = rows.length
      ? `
        <p><strong>Total de veículos locados:</strong> ${rows.length}</p>
        <div class="report-actions">
          <button type="button" class="secondary" data-report-export="pdf">Exportar para PDF</button>
          <button type="button" class="secondary" data-report-export="excel">Exportar para Excel</button>
        </div>
        <div class="report-actions">
          <input
            type="search"
            id="locacaoFiltroInput"
            class="input"
            style="max-width: 460px;"
            placeholder="Filtrar por placa, moto/modelo, CPF ou nome"
            aria-label="Filtrar relatório de locação"
          />
        </div>
        <div class="table-wrap">
          <table class="relatorio-table">
            <thead>
              <tr>
                <th>PLACA</th>
                <th>MODELO</th>
                <th>CLIENTE</th>
                <th>INÍCIO DA LOCAÇÃO</th>
                <th>VALOR DE LOCAÇÃO</th>
                <th>TELEFONE 1</th>
                <th>TELEFONE 2</th>
                <th>TELEFONE 3</th>
              </tr>
            </thead>
            <tbody>
              ${rows
                .map(
                  (item) => {
                    const hasMissing =
                      isMissingInfoValue(item.placa) ||
                      isMissingInfoValue(item.modelo) ||
                      isMissingInfoValue(item.cliente) ||
                      isMissingInfoValue(item.inicioLocacao) ||
                      isMissingInfoValue(item.valorLocacao) ||
                      isMissingInfoValue(item.telefone1) ||
                      isMissingInfoValue(item.telefone2) ||
                      isMissingInfoValue(item.telefone3);
                    const titlePag =
                      item.pagamentosTimeline &&
                      item.cpfDigits &&
                      item.cpfDigits.length === 11 &&
                      !isMissingInfoValue(item.cliente)
                        ? `Pagamentos (RECEITA fev/25–dez/25; RECEITA 2026 jan/26–hoje; datas pelo início do contrato): ${item.pagamentosTimeline}`
                        : "";
                    const searchBlob = [
                      item.placa,
                      item.modelo,
                      item.cliente,
                      item.cpfDigits,
                      item.cpfDigits ? formatCpf(item.cpfDigits) : "",
                    ]
                      .map((v) => normalizeKey(v))
                      .join(" ");
                    return `<tr class="${hasMissing ? "missing-row" : ""}" data-locacao-search="${escapeHtml(
                      searchBlob
                    )}">
                    <td>${
                      !isMissingInfoValue(item.placa)
                        ? `<a href="#" class="placa-historico-link" data-placa="${escapeHtml(
                            String(item.placa || "")
                          )}">${escapeHtml(String(item.placa || ""))}</a>`
                        : formatMissingInfoCell(item.placa)
                    }</td>
                    <td>${formatMissingInfoCell(item.modelo)}</td>
                    <td>${
                      item.cpfDigits && item.cpfDigits.length === 11 && !isMissingInfoValue(item.cliente)
                        ? `<a href="#" class="cliente-vida-link" data-cpf="${item.cpfDigits}"${
                            titlePag ? ` title="${escapeHtml(titlePag)}"` : ""
                          }>${escapeHtml(item.cliente)}${
                            item.pagamentosTimeline
                              ? ` <span class="cliente-pagamentos-timeline">${escapeHtml(
                                  item.pagamentosTimeline
                                )}</span>`
                              : ""
                          }</a>`
                        : formatMissingInfoCell(item.cliente)
                    }</td>
                    <td>${formatMissingInfoCell(item.inicioLocacao)}</td>
                    <td>${formatMissingInfoCell(item.valorLocacao)}</td>
                    <td>${formatMissingInfoCell(item.telefone1)}</td>
                    <td>${formatMissingInfoCell(item.telefone2)}</td>
                    <td>${formatMissingInfoCell(item.telefone3)}</td>
                  </tr>`;
                  }
                )
                .join("")}
            </tbody>
          </table>
        </div>
      `
      : "<p>Nenhum veículo locado encontrado.</p>";

    const totalSemanalLocados = rows.reduce(
      (acc, item) => acc + parseCurrencyBR(item.valorLocacao),
      0
    );
    setAdminSection("operacao");
    renderLocacaoReport("Relatório | Veículos locados", html, {
      totalLabel: "Total de locação semanal",
      totalValue: totalSemanalLocados,
    });
    return;
  }

  const disponiveis = snapshot.availableVehicles;

  relatorioLocacaoCache = {
    title: "Relatório | Veículos disponíveis",
    columns: [
      { key: "placa", label: "PLACA" },
      { key: "modelo", label: "MODELO" },
      { key: "anoModelo", label: "ANO" },
      { key: "cor", label: "COR" },
    ],
    rows: disponiveis,
  };

  const html = disponiveis.length
    ? `
      <p><strong>Total de veículos disponíveis:</strong> ${disponiveis.length}</p>
      <div class="report-actions">
        <button type="button" class="secondary" data-report-export="pdf">Exportar para PDF</button>
        <button type="button" class="secondary" data-report-export="excel">Exportar para Excel</button>
      </div>
      <div class="table-wrap">
        <table class="relatorio-table">
          <thead>
            <tr>
              <th>PLACA</th>
              <th>MODELO</th>
              <th>ANO</th>
              <th>COR</th>
            </tr>
          </thead>
          <tbody>
            ${disponiveis
              .map(
                (v) => {
                  const hasMissing =
                    isMissingInfoValue(v.placa) ||
                    isMissingInfoValue(v.modelo) ||
                    isMissingInfoValue(v.anoModelo) ||
                    isMissingInfoValue(v.cor);
                  return `<tr class="${hasMissing ? "missing-row" : ""}">
                  <td>${formatMissingInfoCell(v.placa)}</td>
                  <td>${formatMissingInfoCell(v.modelo)}</td>
                  <td>${formatMissingInfoCell(v.anoModelo)}</td>
                  <td>${formatMissingInfoCell(v.cor)}</td>
                </tr>`;
                }
              )
              .join("")}
          </tbody>
        </table>
      </div>
    `
    : "<p>Nenhum veículo disponível encontrado.</p>";

  setAdminSection("operacao");
  renderLocacaoReport("Relatório | Veículos disponíveis", html, {
    hideTotal: true,
  });
}

function seedVeiculosDatabaseIfNeeded() {
  if (!veiculosSeedData.length) return;
  const current = loadCadastro(CAD_VEICULOS_KEY);
  const placaToIndex = new Map();
  const chassiToIndex = new Map();
  const renavamToIndex = new Map();
  const motorToIndex = new Map();
  current.forEach((v, idx) => {
    const placa = normalizeKey(v.placa);
    const chassi = normalizeKey(v.chassi);
    const renavam = normalizeKey(v.renavam);
    const motor = normalizeKey(v.motor);
    if (placa) placaToIndex.set(placa, idx);
    if (chassi) chassiToIndex.set(chassi, idx);
    if (renavam) renavamToIndex.set(renavam, idx);
    if (motor) motorToIndex.set(motor, idx);
  });
  const merged = [...current];
  let changed = false;
  let added = 0;
  veiculosSeedData.forEach((v, idx) => {
    const placa = normalizeKey(v.placa);
    if (!placa || isHeaderLikePlate(placa)) return;
    const chassi = normalizeKey(v.chassi);
    const renavam = normalizeKey(v.renavam);
    const motor = normalizeKey(v.motor);
    const normalizedRecord = {
      tipo: inferTipoFromSeed(v),
      tag: String(v.tag || "").trim().replace(/\s*-\s*/g, ""),
      placa: String(v.placa || "").trim().toUpperCase(),
      marca: String(v.marca || "").trim(),
      modelo: String(v.modelo || "").trim(),
      valor: String(v.valor || "").trim(),
      cor: String(v.cor || "").trim(),
      chassi: String(v.chassi || "").trim(),
      anoModelo: String(v.anoModelo || "").trim(),
      renavam: String(v.renavam || "").trim(),
      motor: String(v.motor || "").trim(),
      status: String(v.status || "").trim() || "DISPONIVEL",
    };

    const existingIdx =
      (placa && placaToIndex.has(placa) ? placaToIndex.get(placa) : null) ??
      (chassi && chassiToIndex.has(chassi) ? chassiToIndex.get(chassi) : null) ??
      (renavam && renavamToIndex.has(renavam) ? renavamToIndex.get(renavam) : null) ??
      (motor && motorToIndex.has(motor) ? motorToIndex.get(motor) : null);

    if (existingIdx !== null && existingIdx !== undefined) {
      const existing = merged[existingIdx] || {};
      merged[existingIdx] = {
        ...existing,
        ...normalizedRecord,
        status: existing.status || normalizedRecord.status,
      };
      changed = true;
      return;
    }

    merged.push({
      id: Date.now() + idx + added,
      ...normalizedRecord,
    });
    if (placa) placaToIndex.set(placa, merged.length - 1);
    if (chassi) chassiToIndex.set(chassi, merged.length - 1);
    if (renavam) renavamToIndex.set(renavam, merged.length - 1);
    if (motor) motorToIndex.set(motor, merged.length - 1);
    added += 1;
    changed = true;
  });

  if (changed) {
    saveCadastro(CAD_VEICULOS_KEY, merged);
  }
}

function sanitizeVeiculosDatabase() {
  const veiculos = loadCadastro(CAD_VEICULOS_KEY);
  const sanitized = veiculos.filter((v) => {
    const placa = normalizeKey(v.placa);
    return placa && !isHeaderLikePlate(placa);
  });
  if (sanitized.length !== veiculos.length) {
    saveCadastro(CAD_VEICULOS_KEY, sanitized);
  }
}

function removeVeiculoFromDatabase(plate) {
  const plateKey = normalizePlate(plate);
  if (!plateKey) return;
  const veiculos = loadCadastro(CAD_VEICULOS_KEY);
  const filtered = veiculos.filter((v) => normalizePlate(v.placa) !== plateKey);
  if (filtered.length !== veiculos.length) {
    saveCadastro(CAD_VEICULOS_KEY, filtered);
  }
}

function removeClientesByCodigo(codes) {
  const targets = new Set(
    (codes || [])
      .map((c) => Number(c))
      .filter((n) => Number.isFinite(n) && n > 0)
  );
  if (!targets.size) return;
  const clientes = loadCadastro(CAD_CLIENTES_KEY);
  const filtered = clientes.filter((c) => {
    const codeNum = Number(onlyDigits(String(c.codigo || "")));
    return !targets.has(codeNum);
  });
  if (filtered.length !== clientes.length) {
    saveCadastro(CAD_CLIENTES_KEY, filtered);
  }
}

function removeVeiculosByTag(tags) {
  const targets = new Set(
    (tags || [])
      .map((t) => normalizeKey(String(t || "")))
      .filter(Boolean)
  );
  if (!targets.size) return;
  const veiculos = loadCadastro(CAD_VEICULOS_KEY);
  const filtered = veiculos.filter((v) => !targets.has(normalizeKey(v.tag)));
  if (filtered.length !== veiculos.length) {
    saveCadastro(CAD_VEICULOS_KEY, filtered);
  }
}

function removeClientesByCpf(cpfs) {
  const targets = new Set(
    (cpfs || [])
      .map((cpf) => onlyDigits(String(cpf || "")))
      .filter((cpf) => cpf.length === 11)
  );
  if (!targets.size) return;
  const clientes = loadCadastro(CAD_CLIENTES_KEY);
  const filtered = clientes.filter(
    (c) => !targets.has(onlyDigits(String(c.cpf || "")))
  );
  if (filtered.length !== clientes.length) {
    saveCadastro(CAD_CLIENTES_KEY, filtered);
  }
}

function fixKnownRentalValueOverrides() {
  const targetCpf = "12142358403";
  const targetPlate = "SOZ5C50";
  const valorCorreto = "270,00";
  const locacoes = loadCadastro(CAD_LOCACOES_KEY);
  let changed = false;
  const updated = locacoes.map((l) => {
    const sameCpf = onlyDigits(String(l.cpf || "")) === targetCpf;
    const samePlate = normalizePlate(l.placa) === normalizePlate(targetPlate);
    if (!sameCpf || !samePlate) return l;
    if (String(l.valorSemanal || "").trim() === valorCorreto) return l;
    changed = true;
    return {
      ...l,
      valorSemanal: valorCorreto,
    };
  });
  if (changed) {
    saveCadastro(CAD_LOCACOES_KEY, updated);
  }
}


function seedClientesDatabaseIfNeeded() {
  if (!clientesSeedData.length) return;
  const current = loadCadastro(CAD_CLIENTES_KEY);
  const cpfToIndex = new Map();
  current.forEach((c, idx) => {
    const cpf = onlyDigits(String(c.cpf || ""));
    if (cpf) cpfToIndex.set(cpf, idx);
  });

  const merged = [...current];
  let changed = false;
  let added = 0;
  clientesSeedData.forEach((c, idx) => {
    const cpf = onlyDigits(String(c.cpf || ""));
    const nome = String(c.nome || "").trim();
    const celular = String(c.celular || "").trim();
    const recado1 = String(c.recado1 || "").trim();
    const recado2 = String(c.recado2 || "").trim();
    if (!cpf && !nome && !celular && !recado1 && !recado2) return;

    if (cpf && cpfToIndex.has(cpf)) {
      const targetIdx = cpfToIndex.get(cpf);
      const existing = merged[targetIdx] || {};
      merged[targetIdx] = {
        ...existing,
        cpf,
        nome: nome || existing.nome || "",
        celular: celular || existing.celular || "",
        recado1: recado1 || existing.recado1 || "",
        recado2: recado2 || existing.recado2 || "",
        status: existing.status || "ATIVO",
      };
      changed = true;
      return;
    }

    merged.push({
      id: Date.now() + idx + added,
      codigo: "",
      dataCadastro: "",
      cpf,
      nome,
      celular,
      recado1,
      recado2,
      cnh: "",
      categoria: "",
      vencimento: "",
      ear: "",
      cep: "",
      municipioUf: "",
      endereco: "",
      status: "ATIVO",
    });
    if (cpf) cpfToIndex.set(cpf, merged.length - 1);
    added += 1;
    changed = true;
  });
  if (changed) {
    saveCadastro(CAD_CLIENTES_KEY, merged);
  }
}

function seedLocacoesDatabaseIfNeeded() {
  if (!locacoesSeedData.length) return;
  const current = loadCadastro(CAD_LOCACOES_KEY);
  if (current.length) return;

  const mapped = locacoesSeedData
    .map((item, idx) => {
      const cpf = onlyDigits(String(item.cpf || ""));
      const placa = String(item.placa || "").trim().toUpperCase();
      if (!cpf || !placa) return null;
      const inicio = String(item.inicio || "").trim();
      const fimRaw = String(item.fim || "").trim();
      const fim = /\d/.test(fimRaw) ? fimRaw : "";
      return {
        id: Date.now() + idx,
        createdAt: Date.now() + idx,
        cpf,
        placa,
        inicio,
        fim,
        valorSemanal: String(item.valorPlano || "").trim(),
      };
    })
    .filter(Boolean);

  if (mapped.length) {
    saveCadastro(CAD_LOCACOES_KEY, mapped);
  }
}

function importLocacoesFromPlanilhaOnce() {
  if (localStorage.getItem(IMPORT_LOCACOES_PLANILHA_ONCE_KEY) === "done") return;
  if (!locacoesSeedData.length) return;
  const baseNow = Date.now();
  const mapped = locacoesSeedData
    .map((item, idx) => {
      const cpf = onlyDigits(String(item.cpf || ""));
      const placa = String(item.placa || "").trim().toUpperCase();
      if (!cpf || !placa) return null;
      const inicio = String(item.inicio || "").trim();
      const fimRaw = String(item.fim || "").trim();
      const fim = /\d/.test(fimRaw) ? fimRaw : "";
      return {
        id: baseNow + idx,
        createdAt: baseNow + idx,
        cpf,
        placa,
        inicio,
        fim,
        valorSemanal: String(item.valorPlano || "").trim(),
      };
    })
    .filter(Boolean);
  saveCadastro(CAD_LOCACOES_KEY, mapped);
  localStorage.setItem(IMPORT_LOCACOES_PLANILHA_ONCE_KEY, "done");
}

function applyClienteCpfFixes() {
  const cpfFixes = [
    { nome: "JEFERSON VINÍCIUS FREIRE MAGALHÃES", cpf: "11111111111" },
    { nome: "MARCIO (AMIGO DE BALA)", cpf: "22222222222" },
    { nome: "NEJAIN LIMA DE SOUZA NETO", cpf: "33333333333" },
  ];
  const clientes = loadCadastro(CAD_CLIENTES_KEY);
  let changed = false;
  const updated = clientes.map((c) => {
    const fix = cpfFixes.find((f) => normalizeName(f.nome) === normalizeName(c.nome || ""));
    if (!fix) return c;
    const currentCpf = onlyDigits(String(c.cpf || ""));
    if (currentCpf === fix.cpf) return c;
    changed = true;
    return {
      ...c,
      cpf: formatCpf(fix.cpf),
    };
  });
  if (changed) {
    saveCadastro(CAD_CLIENTES_KEY, updated);
  }
}

function normalizeClienteCodigos() {
  const clientes = loadCadastro(CAD_CLIENTES_KEY);
  if (!clientes.length) return;
  const seedCpfs = new Set(
    clientesSeedData
      .map((c) => onlyDigits(String(c.cpf || "")))
      .filter((cpf) => cpf.length === 11)
  );
  const baseCount = seedCpfs.size;

  const newClients = [];
  const byCode = new Map();
  const result = clientes.map((c) => ({ ...c }));
  result.forEach((c, idx) => {
    const cpf = onlyDigits(String(c.cpf || ""));
    if (cpf.length !== 11 || seedCpfs.has(cpf)) return;
    newClients.push({ idx, cpf });
    const codeNum = Number(onlyDigits(String(c.codigo || "")));
    if (Number.isFinite(codeNum) && codeNum > 0 && !byCode.has(codeNum)) {
      byCode.set(codeNum, []);
    }
    if (Number.isFinite(codeNum) && codeNum > 0) {
      byCode.get(codeNum).push(idx);
    }
  });

  const used = new Set();
  byCode.forEach((indices, codeNum) => {
    if (!indices.length) return;
    used.add(codeNum);
    for (let i = 1; i < indices.length; i += 1) {
      const targetIdx = indices[i];
      result[targetIdx].codigo = "";
    }
  });

  let seq = baseCount + 1;
  newClients.forEach(({ idx }) => {
    const current = Number(onlyDigits(String(result[idx].codigo || "")));
    if (Number.isFinite(current) && current > 0 && !used.has(current)) {
      used.add(current);
      return;
    }
    while (used.has(seq)) seq += 1;
    result[idx].codigo = `CLIENTE ${seq}`;
    used.add(seq);
    seq += 1;
  });

  const changed =
    JSON.stringify(clientes.map((c) => c.codigo || "")) !==
    JSON.stringify(result.map((c) => c.codigo || ""));
  if (changed) {
    saveCadastro(CAD_CLIENTES_KEY, result);
  }
}

function migratePlacaInLocalStorage() {
  const corrections = PLACA_CORRECOES.map((c) => ({
    old: normalizePlate(c.old),
    next: String(c.next || "").trim().toUpperCase(),
  })).filter((c) => c.old && c.next && c.old !== normalizePlate(c.next));
  if (!corrections.length) return;

  const veiculos = loadCadastro(CAD_VEICULOS_KEY);
  let changedVeiculos = false;
  const veiculosUpdated = veiculos.map((v) => {
    const match = corrections.find((c) => normalizePlate(v.placa) === c.old);
    if (!match) return v;
    changedVeiculos = true;
    return { ...v, placa: match.next };
  });
  if (changedVeiculos) saveCadastro(CAD_VEICULOS_KEY, veiculosUpdated);

  const locacoes = loadCadastro(CAD_LOCACOES_KEY);
  let changedLocacoes = false;
  const locacoesUpdated = locacoes.map((l) => {
    const match = corrections.find((c) => normalizePlate(l.placa) === c.old);
    if (!match) return l;
    changedLocacoes = true;
    return { ...l, placa: match.next };
  });
  if (changedLocacoes) saveCadastro(CAD_LOCACOES_KEY, locacoesUpdated);

  const locacoesGeral = loadCadastro(LOCACAO_DATABASE_KEY);
  let changedLocacoesGeral = false;
  const locacoesGeralUpdated = locacoesGeral.map((l) => {
    const match = corrections.find((c) => normalizePlate(l.placa) === c.old);
    if (!match) return l;
    changedLocacoesGeral = true;
    return { ...l, placa: match.next };
  });
  if (changedLocacoesGeral) saveCadastro(LOCACAO_DATABASE_KEY, locacoesGeralUpdated);
}

function renderCadastros() {
  processPendingLancamentosAluguelBaixa();
  seedClientesDatabaseIfNeeded();
  seedVeiculosDatabaseIfNeeded();
  const clientes = loadCadastro(CAD_CLIENTES_KEY);
  const veiculos = loadCadastro(CAD_VEICULOS_KEY);
  const locacoes = loadCadastro(CAD_LOCACOES_KEY);
  const manutencoes = loadCadastro(CAD_MANUTENCOES_KEY);
  const lancamentosAluguel = getLancamentosAluguel();
  const funcionarios = funcionariosAccess.slice();
  refreshLocacaoPlacaOptions();

  cadastroClienteLista.innerHTML = clientes.length
    ? clientes
        .slice(-10)
        .reverse()
        .map(
          (c) =>
            `<p><strong>${c.nome}</strong> | CPF: ${formatCpf(c.cpf)}${
              c.celular ? ` | Cel: ${c.celular}` : ""
            }${c.municipioUf ? ` | ${c.municipioUf}` : ""}</p>`
        )
        .join("")
    : "<p>Nenhum cliente cadastrado.</p>";

  cadastroVeiculoLista.innerHTML = veiculos.length
    ? veiculos
        .slice(-10)
        .reverse()
        .map(
          (v) =>
            `<p><strong>${v.placa}</strong> | ${v.modelo} | Tag: ${v.tag}${
              v.marca ? ` | Marca: ${v.marca}` : ""
            }</p>`
        )
        .join("")
    : "<p>Nenhum veículo cadastrado.</p>";

  cadastroLocacaoLista.innerHTML = locacoes.length
    ? locacoes
        .slice(-10)
        .reverse()
        .map(
          (l) =>
            `<p><strong>CPF:</strong> ${formatCpf(l.cpf)} | <strong>Placa:</strong> ${l.placa} | <strong>Inicio:</strong> ${l.inicio}${l.fim ? ` | <strong>Fim:</strong> ${l.fim}` : ""}${l.valorSemanal ? ` | <strong>Valor:</strong> ${l.valorSemanal}` : ""}</p>`
        )
        .join("")
    : "<p>Nenhuma locação cadastrada.</p>";

  cadastroManutencaoLista.innerHTML = manutencoes.length
    ? manutencoes
        .slice(-10)
        .reverse()
        .map(
          (m) =>
            `<p><strong>Placa:</strong> ${m.placa} | <strong>Data entrada:</strong> ${m.data || "Nao informado"} | <strong>Serviço:</strong> ${m.servico} | <strong>Prev. saída:</strong> ${m.dataPrevistaSaida || "Nao informado"}${m.dataRealSaida ? ` | <strong>Saída real:</strong> ${m.dataRealSaida}` : ""}${m.valor ? ` | <strong>Valor:</strong> ${m.valor}` : ""}</p>`
        )
        .join("")
    : "<p>Nenhuma manutenção cadastrada.</p>";

  if (cadastroLancamentoAluguelLista) {
    cadastroLancamentoAluguelLista.innerHTML = lancamentosAluguel.length
      ? lancamentosAluguel
          .slice()
          .sort(
            (a, b) =>
              Number(b.createdAt || b.id || 0) - Number(a.createdAt || a.id || 0)
          )
          .slice(0, 20)
          .map(
            (l) =>
              `<p><strong>${l.codigoLancamento || "-"}</strong> | <strong>Placa:</strong> ${l.placa || "-"} | <strong>CPF:</strong> ${
                formatCpf(l.cpf || "") || "-"
              } | <strong>Pagamento:</strong> ${l.diaPagamento || "-"} | <strong>Valor:</strong> ${currencyBRL(
                getLancamentoAluguelValor(l)
              )} | <strong>Semana:</strong> ${
                l.semanaInicio || "-"
              } até ${l.semanaFim || "-"} <a href="#" class="lancamento-opcoes-link" data-lanc-aluguel-opcoes="${
                l.id
              }" style="margin-left:8px;">Opções</a></p>
              <div class="hidden" data-lanc-aluguel-opcoes-box="${l.id}" style="margin:-4px 0 8px 0;">
                <button type="button" class="secondary" data-lanc-aluguel-delete="${l.id}">Apagar lançamento</button>
              </div>`
          )
          .join("")
      : "<p>Nenhum lançamento de aluguel cadastrado.</p>";
  }
  if (cadastroFuncionarioLista) {
    cadastroFuncionarioLista.innerHTML = funcionarios.length
      ? funcionarios
          .slice()
          .reverse()
          .map(
            (f) =>
              `<p><strong>${escapeHtml(f.nome || "Sem nome")}</strong> | CPF: ${formatCpf(
                f.cpf || ""
              )} | Perfil: ${escapeHtml(f.role === "owner" ? "ADMINISTRADOR" : "OPERACIONAL")}</p>`
          )
          .join("")
      : "<p>Nenhum funcionario cadastrado.</p>";
  }
  renderLancamentoAluguelResumo();
}

function currencyBRL(value) {
  return Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function getSituacaoFinanceira(contrato) {
  if (Number(contrato.valorPago) > Number(contrato.valorDevidoHoje)) {
    return "Regular";
  }
  if (Number(contrato.valorPago) === Number(contrato.valorDevidoHoje)) {
    return "Em dia";
  }
  return "Em atraso";
}

function parseCurrencyBR(value) {
  if (typeof value === "number") return value;
  const cleaned = String(value || "")
    .replace(/[R$\s]/g, "")
    .replace(/\./g, "")
    .replace(",", ".")
    .replace(/[^\d.-]/g, "");
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : 0;
}

function getSituacaoFinanceiraAdmin(reg) {
  const pago = parseCurrencyBR(reg.pago);
  const devido = parseCurrencyBR(reg.devidoHoje);
  if (pago > devido) return "Regular";
  if (pago === devido) return "Em dia";
  return "Em atraso";
}

function toDateOnly(value) {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) return null;
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function calculateDynamicFinancialFields(record) {
  const inicioDate =
    excelSerialToDate(record?.inicioSerial) || parseBrDate(record?.inicio);
  if (!(inicioDate instanceof Date) || Number.isNaN(inicioDate.getTime())) {
    return {
      dias: String(record?.dias || ""),
      devidoHoje: record?.devidoHoje || "",
    };
  }

  const hoje = toDateOnly(new Date());
  const fimDate = excelSerialToDate(record?.fimSerial) || parseBrDate(record?.fim);
  const inicio = toDateOnly(inicioDate);
  const referenciaFim = toDateOnly(fimDate) || hoje;
  const dias = inicio && referenciaFim ? diffDays(inicio, referenciaFim) : 0;
  const valorSemanal = parseCurrencyBR(record?.valorSemanal);
  const devidoCalculado =
    valorSemanal > 0 && dias > 0
      ? (valorSemanal / 7) * dias
      : parseCurrencyBR(record?.devidoHoje);

  return {
    dias: String(dias || 0),
    devidoHoje: currencyBRL(devidoCalculado),
  };
}

function withDynamicFinancialFields(record) {
  const dynamic = calculateDynamicFinancialFields(record);
  return {
    ...record,
    dias: dynamic.dias,
    devidoHoje: dynamic.devidoHoje,
  };
}

function toPlanName(reg) {
  const iValue = parseCurrencyBR(reg.valorSemanal);
  const qValue = parseCurrencyBR(reg.q);
  return iValue > qValue ? "DK minha moto" : "DK MEU TRANSPORTE";
}

function isAtivoByFim(reg) {
  return !String(reg.fim || "").trim();
}

function getActivePlatesSet() {
  const locacoesAtivas = loadCadastro(CAD_LOCACOES_KEY)
    .filter((l) => !String(l.fim || "").trim())
    .map((l) => normalizePlate(l.placa))
    .filter(Boolean);
  return new Set(locacoesAtivas);
}

function getVehicleMapByPlate() {
  seedVeiculosDatabaseIfNeeded();
  const veiculos = loadCadastro(CAD_VEICULOS_KEY);
  return new Map(veiculos.map((v) => [normalizePlate(v.placa), v]));
}

function pickBestRecordByPlate(records, plateKey) {
  const candidates = records.filter(
    (r) => normalizePlate(r.placa) === plateKey
  );
  if (!candidates.length) return null;
  const ativos = candidates.filter((r) => !String(r.fim || "").trim());
  const target = ativos.length ? ativos : candidates;
  return target.sort((a, b) => Number(b.inicioSerial || 0) - Number(a.inicioSerial || 0))[0];
}

function getLatestCadastroLocacaoByPlate(plateKey) {
  const locacoes = loadCadastro(CAD_LOCACOES_KEY);
  const byPlate = locacoes
    .filter((l) => normalizePlate(l.placa) === plateKey)
    .sort((a, b) => {
      const byCreated =
        Number(b.createdAt || b.id || 0) - Number(a.createdAt || a.id || 0);
      if (byCreated !== 0) return byCreated;
      const da = parseBrDate(a.inicio);
      const db = parseBrDate(b.inicio);
      return (db?.getTime() || 0) - (da?.getTime() || 0);
    });
  return byPlate[0] || null;
}

function buildOperationalSnapshot() {
  const baseRecords = getAdminDataset();
  const activeSet = getActivePlatesSet();
  const vehicleMap = getVehicleMapByPlate();
  const allVeiculos = loadCadastro(CAD_VEICULOS_KEY);
  const manutencoes = loadCadastro(CAD_MANUTENCOES_KEY);
  const placasEmManutencao = new Set(
    manutencoes
      .filter((m) => !String(m.dataRealSaida || "").trim())
      .map((m) => normalizePlate(m.placa))
      .filter(Boolean)
  );

  const activeRecords = Array.from(activeSet).map((plateKey) => {
    const source = pickBestRecordByPlate(baseRecords, plateKey) || {};
    const vehicle = vehicleMap.get(plateKey) || {};
    const cadastroLocacao = getLatestCadastroLocacaoByPlate(plateKey);
    const clienteCadastro = cadastroLocacao
      ? findClienteByCpfCadastro(cadastroLocacao.cpf)
      : null;
    const plateRaw = vehicle.placa || source.placa || plateKey;
    return withDynamicFinancialFields({
      cpf: cadastroLocacao?.cpf || source.cpf || "",
      nome:
        clienteCadastro?.nome ||
        source.nome ||
        "Nao informado",
      placa: plateRaw,
      inicio: cadastroLocacao?.inicio || source.inicio || "",
      inicioSerial: cadastroLocacao?.inicio ? null : source.inicioSerial ?? null,
      cadastroCriadoTs: Number(cadastroLocacao?.createdAt || cadastroLocacao?.id || 0),
      fim: cadastroLocacao?.fim || source.fim || "",
      fimSerial: null,
      valorSemanal: cadastroLocacao?.valorSemanal || source.valorSemanal || "",
      devidoHoje: source.devidoHoje || "",
      pago: source.pago || "",
      dias: source.dias || "",
      q: source.q || 0,
      semanas: Array.isArray(source.semanas) ? source.semanas : [],
      semanasCompletas: Array.isArray(source.semanasCompletas)
        ? source.semanasCompletas
        : Array.isArray(source.semanas)
          ? source.semanas
          : [],
    });
  });

  const availableVehicles = allVeiculos
    .filter((v) => {
      const plate = normalizePlate(v.placa);
      const indisponivel = normalizeKey(v.status).includes("INDISPONIVEL POR");
      return (
        plate &&
        !activeSet.has(plate) &&
        !indisponivel &&
        !placasEmManutencao.has(plate)
      );
    })
    .sort((a, b) => {
      const byModelo = String(a.modelo || "").localeCompare(String(b.modelo || ""), "pt-BR");
      if (byModelo !== 0) return byModelo;
      return normalizePlate(a.placa).localeCompare(normalizePlate(b.placa));
    });

  const inactiveRecords = baseRecords.filter((r) => {
    const plate = normalizePlate(r.placa);
    return plate && !activeSet.has(plate) && String(r.fim || "").trim();
  });

  return {
    activeRecords,
    availableVehicles,
    inactiveRecords,
    checks: {
      ativos: activeRecords.length,
      disponiveis: availableVehicles.length,
      frotaTotal: allVeiculos.length,
      manutencao: placasEmManutencao.size,
    },
  };
}

function getAdminDataset() {
  if (!adminData.length) {
    return mockClientes.map((c) => ({
      nome: c.nome,
      placa: c.contrato.veiculo.placa,
      inicio: c.contrato.inicio,
      fim: c.contrato.fim,
      valorSemanal: c.contrato.valorLocacao,
      devidoHoje: c.contrato.valorDevidoHoje,
      pago: c.contrato.valorPago,
      dias: c.contrato.dias,
      q: 0,
      cor: 0,
    }));
  }
  return adminData;
}

function getRecordsByScope(scope) {
  const all = getAdminDataset();
  const snapshot = buildOperationalSnapshot();
  if (scope === "ativos") {
    return snapshot.activeRecords;
  }
  if (scope === "inativos") {
    return snapshot.inactiveRecords;
  }
  return all;
}

function findModeloByPlaca(placa) {
  const target = normalizePlate(placa);
  if (!target) return "Modelo nao identificado";

  seedVeiculosDatabaseIfNeeded();
  const veiculos = loadCadastro(CAD_VEICULOS_KEY);
  const localMatch = veiculos.find((v) => normalizePlate(v.placa) === target);
  if (localMatch && String(localMatch.modelo || "").trim()) {
    return String(localMatch.modelo || "").trim();
  }

  const match = frotaData.find((f) => normalizePlate(f.placa) === target);
  if (match && String(match.modelo || "").trim()) {
    return String(match.modelo || "").trim();
  }

  return "Modelo nao identificado";
}

function renderDashboard(cliente) {
  if (enforceMaintenanceAndDailyRoutines()) return;
  showLocadoraArea();
  adminCard.classList.add("hidden");
  document.getElementById("clienteNome").textContent = cliente.nome;
  document.getElementById("contratoNumero").textContent = cliente.contrato.numero;
  document.getElementById("veiculoModelo").textContent = cliente.contrato.veiculo.modelo;
  document.getElementById("veiculoCategoria").textContent = cliente.contrato.veiculo.categoria;
  document.getElementById("veiculoPlaca").textContent = cliente.contrato.veiculo.placa;
  document.getElementById("contratoInicio").textContent = cliente.contrato.inicio;
  document.getElementById("contratoFim").textContent = cliente.contrato.fim;
  document.getElementById("contratoStatus").textContent = `${cliente.contrato.status} | ${currencyBRL(cliente.contrato.valorLocacao)}`;
  document.getElementById("valorSemanal").textContent = currencyBRL(cliente.contrato.valorLocacao);
  document.getElementById("quantidadeDias").textContent = String(cliente.contrato.dias);
  document.getElementById("valorDevidoHoje").textContent = currencyBRL(cliente.contrato.valorDevidoHoje);
  document.getElementById("valorPago").textContent = currencyBRL(cliente.contrato.valorPago);
  document.getElementById("situacaoFinanceira").textContent = getSituacaoFinanceira(cliente.contrato);

  loginArea.classList.add("hidden");
  dashboardCard.classList.remove("hidden");
}

function renderAdminResult(title, htmlContent, options = {}) {
  adminResultTitle.textContent = title;
  adminResultBody.innerHTML = `
    <div class="report-actions">
      <button type="button" class="secondary" data-report-export="excel" data-report-target="admin">Exportar Excel</button>
      <button type="button" class="secondary" data-report-export="pdf" data-report-target="admin">Exportar PDF</button>
      <button type="button" class="secondary" data-admin-back="true">Voltar</button>
    </div>
    ${htmlContent}
  `;
}

function formatMissingInfoCell(cell, fallback = "Nao informado") {
  const original = cell === null || cell === undefined ? "" : String(cell);
  const trimmed = original.trim();
  if (!trimmed) {
    return `<span class="missing-info">${fallback}</span>`;
  }
  if (trimmed.includes("<")) return original;
  const normalized = normalizeKey(trimmed);
  if (
    normalized === "NAO INFORMADO" ||
    normalized === "DATA NAO INFORMADA" ||
    normalized === "MODELO NAO IDENTIFICADO"
  ) {
    return `<span class="missing-info">${trimmed}</span>`;
  }
  return original;
}

function isMissingInfoValue(cell) {
  const raw = cell === null || cell === undefined ? "" : String(cell).trim();
  if (!raw) return true;
  const normalized = normalizeKey(raw);
  return (
    normalized === "NAO INFORMADO" ||
    normalized === "DATA NAO INFORMADA" ||
    normalized === "MODELO NAO IDENTIFICADO"
  );
}

function buildStructuredTable(headers, rows, emptyMessage = "Sem dados.", extraClass = "") {
  if (!Array.isArray(rows) || !rows.length) {
    return `<p>${emptyMessage}</p>`;
  }
  const headHtml = headers.map((h) => `<th>${h}</th>`).join("");
  const bodyHtml = rows
    .map((row) => {
      const cells = row.map((cell) => formatMissingInfoCell(cell));
      const hasMissing = cells.some((cell) => String(cell).includes("missing-info"));
      return `<tr class="${hasMissing ? "missing-row" : ""}">${cells
        .map((cell) => `<td>${cell}</td>`)
        .join("")}</tr>`;
    })
    .join("");
  return `
    <div class="table-wrap">
      <table class="relatorio-table ${extraClass}">
        <thead>
          <tr>${headHtml}</tr>
        </thead>
        <tbody>
          ${bodyHtml}
        </tbody>
      </table>
    </div>
  `;
}

function parseRecordStartDate(record) {
  return excelSerialToDate(record?.inicioSerial) || parseBrDate(record?.inicio);
}

function formatContratoTimeline(record) {
  const placa = record?.placa || "SEM PLACA";
  const inicio = String(record?.inicio || "").trim() || "inicio nao informado";
  const fim = String(record?.fim || "").trim() || "atual";
  return `${placa} (${inicio} a ${fim})`;
}

function findReceitaRecordForEstudo(cpfDigits) {
  const key = onlyDigits(String(cpfDigits || ""));
  if (key.length !== 11) return null;
  // Base unificada (DK_DATA): coluna Z e trilha RECEITA 2025 + RECEITA 2026; nao preferir so RECEITA_2026.
  const pool =
    adminData.length > 0
      ? adminData
      : receita2026Data.length
        ? receita2026Data
        : [];
  let matches = pool.filter((r) => onlyDigits(String(r.cpf || "")) === key);
  if (!matches.length && pool !== receita2026Data && receita2026Data.length) {
    matches = receita2026Data.filter((r) => onlyDigits(String(r.cpf || "")) === key);
  }
  if (!matches.length) return null;
  const ativo = matches.find((r) => !String(r.fim || "").trim());
  if (ativo) return ativo;
  return matches.sort((a, b) => Number(b.inicioSerial || 0) - Number(a.inicioSerial || 0))[0];
}

function parseSemanaPagamentoCell(cell) {
  if (cell == null) return 0;
  const t = String(cell).trim();
  if (!t || t === "#") return 0;
  return parseCurrencyBR(cell);
}

/** Semanas vindas da planilha como array ou objeto indexado (1,2,3…). */
function normalizeWeekArray(val) {
  if (val == null) return [];
  if (Array.isArray(val)) return val;
  if (typeof val === "object") {
    const keys = Object.keys(val).sort((a, b) => Number(a) - Number(b));
    return keys.map((k) => val[k]);
  }
  return [];
}

/**
 * Trilha unificada RECEITA (2025) + RECEITA 2026: semanasHistorico + semanas2026,
 * ou semanasCompletas quando ja vier mesclado no arquivo (ex.: DK_DATA).
 */
function getMergedWeeklyPaymentTrail(record) {
  const semanas = normalizeWeekArray(record?.semanas);
  const completas = normalizeWeekArray(record?.semanasCompletas);
  const hist = normalizeWeekArray(record?.semanasHistorico);
  const s26 = normalizeWeekArray(record?.semanas2026);
  const stitched = hist.length || s26.length ? [...hist, ...s26] : [];
  if (stitched.length > completas.length) return stitched;
  if (completas.length) return completas;
  if (stitched.length) return stitched;
  return semanas;
}

const MESES_PAGAMENTO_TIMELINE = [
  "JAN",
  "FEV",
  "MAR",
  "ABR",
  "MAI",
  "JUN",
  "JUL",
  "AGO",
  "SET",
  "OUT",
  "NOV",
  "DEZ",
];

function addCalendarDays(date, days) {
  const d = toDateOnly(date);
  if (!d) return null;
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() + days);
  return x;
}

function monthKeyYyyyMmFromDate(d) {
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return null;
  return d.getFullYear() * 100 + (d.getMonth() + 1);
}

function formatPagamentoMesAa(d) {
  const key = monthKeyYyyyMmFromDate(d);
  if (key == null) return "";
  const y = Math.floor(key / 100);
  const m = key % 100;
  const mon = MESES_PAGAMENTO_TIMELINE[m - 1];
  if (!mon) return "";
  return `${mon}/${String(y).slice(-2)}`;
}

/** Aba RECEITA: fev/2025–dez/2025 (trilha semanal alinhada ao início do contrato). */
function collectPagamentoMonthsFromReceitaHistorico(record, monthSet, hoje) {
  const trail = normalizeWeekArray(record?.semanasHistorico);
  if (!trail.length) return;
  const inicio = toDateOnly(parseRecordStartDate(record));
  if (!inicio) return;
  let startIdx = trail.findIndex((c) => {
    const t = String(c).trim();
    return t === "#" || parseSemanaPagamentoCell(c) > 0;
  });
  if (startIdx < 0) startIdx = 0;
  const minKey = 202502;
  const maxKey = 202512;

  for (let w = 0; startIdx + w < trail.length; w++) {
    const p = parseSemanaPagamentoCell(trail[startIdx + w]);
    if (p <= 0) continue;
    const d = addCalendarDays(inicio, w * 7);
    if (!d || d > hoje) continue;
    const key = monthKeyYyyyMmFromDate(d);
    if (key != null && key >= minKey && key <= maxKey) monthSet.add(key);
  }
}

/**
 * Aba RECEITA 2026: meses com pagamento de jan/2026 até hoje.
 * Mesma lógica da RECEITA: data do pagamento = início do contrato + 7·w (w a partir do primeiro # ou valor na trilha).
 * Usa semanas2026 ou, se vazio, semanas.
 */
function collectPagamentoMonthsFromReceita2026(record, monthSet, hoje) {
  const trail26 = normalizeWeekArray(record?.semanas2026);
  const trail = trail26.length ? trail26 : normalizeWeekArray(record?.semanas);
  if (!trail.length) return;
  const inicio = toDateOnly(parseRecordStartDate(record));
  if (!inicio) return;
  let startIdx = trail.findIndex((c) => {
    const t = String(c).trim();
    return t === "#" || parseSemanaPagamentoCell(c) > 0;
  });
  if (startIdx < 0) startIdx = 0;
  const minKey = 202601;

  for (let w = 0; startIdx + w < trail.length; w++) {
    const p = parseSemanaPagamentoCell(trail[startIdx + w]);
    if (p <= 0) continue;
    const d = addCalendarDays(inicio, w * 7);
    if (!d || d > hoje) continue;
    const key = monthKeyYyyyMmFromDate(d);
    if (key != null && key >= minKey) monthSet.add(key);
  }
}

/**
 * Sequência cronológica XXX/AA (iniciais do mês em PT + dois dígitos do ano).
 * Une aba RECEITA (2025) e RECEITA 2026 conforme regra de negócio.
 */
function buildClientePagamentosTimelineTexto(cpfDigits) {
  const key = onlyDigits(String(cpfDigits || ""));
  if (key.length !== 11) return "";
  const pool =
    adminData.length > 0
      ? adminData
      : receita2026Data.length
        ? receita2026Data
        : [];
  let recs = pool.filter((r) => onlyDigits(String(r.cpf || "")) === key);
  if (!recs.length && pool !== receita2026Data && receita2026Data.length) {
    recs = receita2026Data.filter((r) => onlyDigits(String(r.cpf || "")) === key);
  }
  if (!recs.length) return "";

  const hoje = toDateOnly(new Date());
  if (!hoje) return "";
  const monthSet = new Set();
  recs.forEach((r) => {
    collectPagamentoMonthsFromReceitaHistorico(r, monthSet, hoje);
    collectPagamentoMonthsFromReceita2026(r, monthSet, hoje);
  });

  const sorted = [...monthSet].sort((a, b) => a - b);
  return sorted
    .map((mk) => {
      const y = Math.floor(mk / 100);
      const m = mk % 100;
      const mon = MESES_PAGAMENTO_TIMELINE[m - 1];
      return mon ? `${mon}/${String(y).slice(-2)}` : "";
    })
    .filter(Boolean)
    .join(" · ");
}

function buildWeeklyDevidoPagoSeries(record) {
  const devidoSemanal = parseCurrencyBR(record?.valorSemanal);
  const inicio = toDateOnly(parseRecordStartDate(record));
  const fim = toDateOnly(excelSerialToDate(record?.fimSerial) || parseBrDate(record?.fim));
  const hoje = toDateOnly(new Date());
  if (!(inicio instanceof Date) || !(hoje instanceof Date) || devidoSemanal <= 0) return [];
  const referenciaFim = fim && fim < hoje ? fim : hoje;
  const diasContrato = Math.max(1, diffDays(inicio, referenciaFim));
  const weeksNeeded = Math.max(1, Math.ceil(diasContrato / 7));
  const full = getMergedWeeklyPaymentTrail(record);
  if (!full.length) return [];
  let startIdx = full.findIndex((c) => {
    const t = String(c).trim();
    return t === "#" || parseSemanaPagamentoCell(c) > 0;
  });
  if (startIdx < 0) startIdx = 0;
  const available = full.length - startIdx;
  const n = Math.min(weeksNeeded, available);
  const out = [];
  for (let w = 0; w < n; w++) {
    out.push({
      week: w + 1,
      devido: devidoSemanal,
      pago: parseSemanaPagamentoCell(full[startIdx + w]),
    });
  }
  return out;
}

function renderWeeklyDevidoPagoChartSvg(series, title) {
  if (!series.length) return "";
  const w = Math.min(1400, Math.max(520, 72 + series.length * 14));
  const h = 300;
  const margin = { top: 48, right: 20, bottom: 40, left: 44 };
  const chartW = w - margin.left - margin.right;
  const chartH = h - margin.top - margin.bottom;
  const maxVal = Math.max(1, ...series.flatMap((s) => [s.devido, s.pago]));
  const groupW = chartW / series.length;
  const barW = Math.max(2, groupW * 0.32);
  const gap = Math.max(1, groupW * 0.08);
  let rects = "";
  series.forEach((s, i) => {
    const x0 = margin.left + i * groupW + gap;
    const yBase = margin.top + chartH;
    const hD = (s.devido / maxVal) * chartH;
    const hP = (s.pago / maxVal) * chartH;
    rects += `<rect x="${x0.toFixed(2)}" y="${(yBase - hD).toFixed(2)}" width="${barW.toFixed(2)}" height="${hD.toFixed(2)}" fill="#4299e1"/>`;
    rects += `<rect x="${(x0 + barW + gap * 0.35).toFixed(2)}" y="${(yBase - hP).toFixed(2)}" width="${barW.toFixed(2)}" height="${hP.toFixed(2)}" fill="#48bb78"/>`;
  });
  const step = series.length > 48 ? 4 : series.length > 24 ? 2 : 1;
  let labels = "";
  for (let i = 0; i < series.length; i += step) {
    const x = margin.left + i * groupW + groupW / 2;
    labels += `<text x="${x.toFixed(1)}" y="${h - 10}" text-anchor="middle" font-size="9" fill="#b3b3b3">S${series[i].week}</text>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="100%" style="max-width:${w}px" role="img" aria-label="Grafico semanal devido e pago">
    <text x="${margin.left}" y="22" font-size="15" fill="#f5f5f5">${title}</text>
    <text x="${margin.left}" y="38" font-size="11" fill="#b3b3b3">Azul = devido na semana | Verde = pago na semana</text>
    <line x1="${margin.left}" y1="${margin.top + chartH}" x2="${margin.left + chartW}" y2="${margin.top + chartH}" stroke="#444" stroke-width="1"/>
    ${rects}
    ${labels}
  </svg>`;
}

function getReceita2025GridMonthDefs() {
  if (typeof MONTHLY_DATA === "undefined" || !MONTHLY_DATA || !Array.isArray(MONTHLY_DATA.receita)) {
    return [];
  }
  return MONTHLY_DATA.receita
    .filter((m) => Number(m.colInicio) <= 83)
    .map((m) => ({
      mes: String(m.mes || ""),
      colInicio: Number(m.colInicio),
      colFim: Number(m.colFim),
    }));
}

function getReceita2026GridMonthDefs() {
  if (typeof MONTHLY_DATA === "undefined" || !MONTHLY_DATA || !Array.isArray(MONTHLY_DATA.receita2026)) {
    return [];
  }
  return MONTHLY_DATA.receita2026.map((m) => ({
    mes: String(m.mes || ""),
    colInicio: Number(m.colInicio),
    colFim: Number(m.colFim),
  }));
}

function mesAbbrToLabelGrade(mesAbbr, yearSuffix) {
  const u = String(mesAbbr || "").toUpperCase();
  const map = {
    JAN: "Jan",
    FEV: "Fev",
    MAR: "Mar",
    ABR: "Abr",
    MAI: "Mai",
    JUN: "Jun",
    JUL: "Jul",
    AGO: "Ago",
    SET: "Set",
    OUT: "Out",
    NOV: "Nov",
    DEZ: "Dez",
  };
  return `${map[u] || u}/${yearSuffix}`;
}

function sumMonthColsInTrail(trail, colBase, colInicio, colFim) {
  const a = normalizeWeekArray(trail);
  if (!a.length || !Number.isFinite(colBase)) return 0;
  let sum = 0;
  for (let col = colInicio; col <= colFim; col += 1) {
    const idx = col - colBase;
    if (idx >= 0 && idx < a.length) sum += parseSemanaPagamentoCell(a[idx]);
  }
  return sum;
}

function trimGradeMonthTotals(totals) {
  const start = totals.findIndex((r) => r.total > 0.005);
  if (start < 0) return [];
  let end = totals.length - 1;
  while (end > start && totals[end].total <= 0.005) end -= 1;
  return totals.slice(start, end + 1);
}

function receita2026TrailForRecord(record) {
  const s26 = normalizeWeekArray(record?.semanas2026);
  if (s26.length) return s26;
  return normalizeWeekArray(record?.semanas);
}

function buildClienteGradePagamentos2025(contratos) {
  const defs = getReceita2025GridMonthDefs();
  if (!defs.length) return { rows: [], total: 0 };
  const colBase = Number(defs[0].colInicio);
  const totals = defs.map((d) => ({
    label: mesAbbrToLabelGrade(d.mes, "2025"),
    total: 0,
  }));
  contratos.forEach((c) => {
    defs.forEach((d, i) => {
      totals[i].total += sumMonthColsInTrail(c.semanasHistorico, colBase, d.colInicio, d.colFim);
    });
  });
  totals.forEach((t) => {
    t.total = Math.round(t.total * 100) / 100;
  });
  const rows = trimGradeMonthTotals(totals);
  const total = rows.reduce((acc, r) => acc + r.total, 0);
  return { rows, total: Math.round(total * 100) / 100 };
}

function buildClienteGradePagamentos2026(contratos) {
  const defs = getReceita2026GridMonthDefs();
  if (!defs.length) return { rows: [], total: 0 };
  const colBase = Number(defs[0].colInicio);
  const totals = defs.map((d) => ({
    label: mesAbbrToLabelGrade(d.mes, "2026"),
    total: 0,
  }));
  contratos.forEach((c) => {
    const trail = receita2026TrailForRecord(c);
    defs.forEach((d, i) => {
      totals[i].total += sumMonthColsInTrail(trail, colBase, d.colInicio, d.colFim);
    });
  });
  totals.forEach((t) => {
    t.total = Math.round(t.total * 100) / 100;
  });
  const rows = trimGradeMonthTotals(totals);
  const total = rows.reduce((acc, r) => acc + r.total, 0);
  return { rows, total: Math.round(total * 100) / 100 };
}

function renderClienteVidaGradeTablesHtml(block2025, block2026) {
  const panel = (rows, title, hint) => {
    if (!rows.length) {
      return `<div class="cliente-vida-grade-panel">
        <h4>${escapeHtml(title)}</h4>
        <p class="subtext">${escapeHtml(hint)}</p>
        <p class="subtext">Sem pagamentos registrados na trilha deste periodo (ou contrato so no cadastro, sem colunas na base).</p>
      </div>`;
    }
    const sum = rows.reduce((a, r) => a + r.total, 0);
    const body = rows
      .map(
        (r) =>
          `<tr><td>${escapeHtml(r.label)}</td><td class="col-moeda">${currencyBRL(r.total)}</td></tr>`
      )
      .join("");
    return `<div class="cliente-vida-grade-panel">
      <h4>${escapeHtml(title)}</h4>
      <p class="subtext">${escapeHtml(hint)}</p>
      <table class="relatorio-table cliente-vida-grade-table">
        <thead><tr><th>Mês</th><th class="col-moeda">Total (R$)</th></tr></thead>
        <tbody>
          ${body}
          <tr><td><strong>Total</strong></td><td class="col-moeda"><strong>${currencyBRL(sum)}</strong></td></tr>
        </tbody>
      </table>
    </div>`;
  };
  return `<div class="cliente-vida-grade-wrap">
    ${panel(
      block2025.rows,
      "2025 — aba RECEITA",
      "Soma das células por mês na trilha semanasHistorico (alinhamento colunas Z+ / monthly-data.receita). Meses sem valor omitidos."
    )}
    ${panel(
      block2026.rows,
      "2026 — aba RECEITA 2026",
      "Trilha semanas2026 (ou semanas). Meses sem valor omitidos."
    )}
  </div>`;
}

function renderClienteVidaGradeMensalSplitSvg(block2025, block2026) {
  const rowsL = block2025.rows;
  const rowsR = block2026.rows;
  if (!rowsL.length && !rowsR.length) return "";
  const w = 960;
  const h = 300;
  const mid = w / 2;
  const margin = { t: 52, r: 20, b: 50, l: 20 };
  const chartW = mid - margin.l - margin.r;
  const chartH = h - margin.t - margin.b;
  const maxL = rowsL.length ? Math.max(...rowsL.map((r) => r.total), 1) : 1;
  const maxR = rowsR.length ? Math.max(...rowsR.map((r) => r.total), 1) : 1;

  function drawSide(rows, maxV, offsetX, title) {
    const n = rows.length;
    if (!n) {
      return `<text x="${(offsetX + chartW / 2).toFixed(1)}" y="${(margin.t + chartH / 2).toFixed(
        1
      )}" text-anchor="middle" font-size="11" fill="#777">Sem valores na grade</text>`;
    }
    const slot = chartW / n;
    const bw = Math.max(4, slot * 0.58);
    const gap = (slot - bw) / 2;
    let s = `<text x="${offsetX}" y="24" font-size="14" fill="#f5f5f5">${escapeHtml(title)}</text>`;
    rows.forEach((r, i) => {
      const x0 = offsetX + i * slot + gap;
      const bh = maxV > 0 ? (r.total / maxV) * chartH : 0;
      const y0 = margin.t + chartH - bh;
      s += `<rect x="${x0.toFixed(2)}" y="${y0.toFixed(2)}" width="${bw.toFixed(2)}" height="${Math.max(
        bh,
        r.total > 0 ? 1 : 0
      ).toFixed(2)}" fill="#e10600" opacity="0.88"/>`;
      const short = r.label.replace(/\/\d{4}$/, "");
      s += `<text x="${(x0 + bw / 2).toFixed(1)}" y="${h - 12}" text-anchor="middle" font-size="8" fill="#b3b3b3">${escapeHtml(
        short
      )}</text>`;
      if (r.total > 0) {
        const lbl = r.total >= 1000 ? `${Math.round(r.total)}` : currencyBRL(r.total);
        s += `<text x="${(x0 + bw / 2).toFixed(1)}" y="${(y0 - 4).toFixed(1)}" text-anchor="middle" font-size="7" fill="#e8e8e8">${escapeHtml(
          lbl
        )}</text>`;
      }
    });
    return s;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" class="cliente-vida-grade-chart" viewBox="0 0 ${w} ${h}" width="100%" style="max-width:${w}px" role="img" aria-label="Pagamentos mensais na grade RECEITA e RECEITA 2026">
    <text x="${margin.l}" y="16" font-size="11" fill="#888">Valores por mês (soma das parcelas nas colunas da planilha, conforme monthly-data.js)</text>
    <line x1="${mid}" y1="32" x2="${mid}" y2="${h - 6}" stroke="#3a3a40" stroke-dasharray="5 4"/>
    ${drawSide(rowsL, maxL, margin.l, "2025")}
    ${drawSide(rowsR, maxR, mid + margin.l, "2026")}
  </svg>`;
}

function buildContractMatchKey(placa, cpf, inicio, fim) {
  return [
    normalizePlate(placa),
    onlyDigits(String(cpf || "")),
    normalizeKey(String(inicio || "")),
    normalizeKey(String(fim || "")),
  ].join("|");
}

function mergeContractsForPlaca(placaRaw) {
  const plateKey = normalizePlate(placaRaw);
  if (!plateKey) return [];
  const fromAdmin = getAdminDataset().filter(
    (r) => normalizePlate(r.placa) === plateKey
  );
  const adminByKey = new Map();
  fromAdmin.forEach((r) => {
    adminByKey.set(buildContractMatchKey(r.placa, r.cpf, r.inicio, r.fim), r);
  });
  const locs = loadCadastro(CAD_LOCACOES_KEY).filter(
    (l) => normalizePlate(l.placa) === plateKey
  );
  const extra = locs.map((l) => {
    const cpfLoc = onlyDigits(String(l.cpf || ""));
    const cli = cpfLoc.length === 11 ? findClienteByCpfCadastro(cpfLoc) : null;
    const matched = adminByKey.get(
      buildContractMatchKey(l.placa || plateKey, cpfLoc, l.inicio, l.fim || "")
    );
    return {
      cpf: cpfLoc || l.cpf || "",
      nome: String(cli?.nome || "").trim(),
      placa: l.placa || plateKey,
      inicio: l.inicio || "",
      inicioSerial: matched?.inicioSerial ?? null,
      fim: l.fim || "",
      fimSerial: matched?.fimSerial ?? null,
      valorSemanal: l.valorSemanal || "",
      pago: "",
      devidoHoje: "",
      q: "",
      semanas: [],
      semanasCompletas: [],
    };
  });

  const merged = [...fromAdmin, ...extra];
  const seen = new Set();
  const out = [];
  merged.forEach((r) => {
    const sig = buildContractMatchKey(r.placa, r.cpf, r.inicio, r.fim);
    if (seen.has(sig)) return;
    seen.add(sig);
    out.push(r);
  });

  return out.sort((a, b) => {
    const da = parseRecordStartDate(a)?.getTime() || 0;
    const db = parseRecordStartDate(b)?.getTime() || 0;
    return da - db;
  });
}

function calcContratoDias(contrato) {
  const ini = inferStartDateForContrato(contrato);
  if (!ini) return null;
  const fimDate = String(contrato.fim || "").trim()
    ? inferEndDateForContrato(contrato)
    : toDateOnly(new Date());
  if (!fimDate || fimDate < ini) return 1;
  return Math.max(1, diffDays(ini, fimDate));
}

function openPlacaHistoricoDialog(placaRaw) {
  if (!placaHistoricoDialog || !placaHistoricoBody) return;
  const plate = normalizePlate(placaRaw);
  if (!plate) return;

  const contratos = mergeContractsForPlaca(plate);
  const modelo = findModeloByPlaca(plate);
  if (!contratos.length) {
    placaHistoricoBody.innerHTML = `<p><strong>Placa:</strong> ${escapeHtml(
      plate
    )}</p><p><strong>Modelo:</strong> ${escapeHtml(
      modelo
    )}</p><p>Nenhum histórico de locação encontrado para esta placa.</p>`;
    placaHistoricoDialog.classList.remove("hidden");
    return;
  }

  const rows = contratos
    .map((c, idx) => {
      const cpf = onlyDigits(String(c.cpf || ""));
      const nome =
        String(c.nome || "").trim() ||
        (cpf.length === 11 ? String(findClienteByCpfCadastro(cpf)?.nome || "").trim() : "") ||
        "Nao informado";
      const inicio = formatContratoInicioClienteVida(c);
      const fim = formatContratoFimClienteVida(c);
      const dias = calcContratoDias(c);
      const diasTxt = dias == null ? "-" : `${dias} dia${dias === 1 ? "" : "s"}`;
      return `<tr>
        <td>${idx + 1}o</td>
        <td>${escapeHtml(nome)}</td>
        <td>${escapeHtml(inicio)}</td>
        <td>${escapeHtml(fim)}</td>
        <td class="col-moeda">${escapeHtml(diasTxt)}</td>
      </tr>`;
    })
    .join("");

  placaHistoricoBody.innerHTML = `
    <p><strong>Placa:</strong> ${escapeHtml(plate)}</p>
    <p><strong>Modelo:</strong> ${escapeHtml(modelo)}</p>
    <div class="table-wrap">
      <table class="relatorio-table cliente-vida-table">
        <thead>
          <tr>
            <th>Ordem</th>
            <th>Cliente</th>
            <th>Inicio</th>
            <th>Fim</th>
            <th>Dias</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
  placaHistoricoDialog.classList.remove("hidden");
}

function mergeContractsForCliente(cpfDigits) {
  const key = onlyDigits(String(cpfDigits || ""));
  if (key.length !== 11) return [];
  const fromAdmin = getAdminDataset().filter((r) => onlyDigits(String(r.cpf || "")) === key);
  const adminByKey = new Map();
  fromAdmin.forEach((r) => {
    adminByKey.set(buildContractMatchKey(r.placa, r.cpf, r.inicio, r.fim), r);
  });
  const locs = loadCadastro(CAD_LOCACOES_KEY).filter((l) => onlyDigits(String(l.cpf || "")) === key);
  const extra = locs.map((l) => {
    const cli = findClienteByCpfCadastro(l.cpf);
    const matched = adminByKey.get(buildContractMatchKey(l.placa, l.cpf, l.inicio, l.fim || ""));
    return {
      cpf: l.cpf,
      nome: String(cli?.nome || "").trim(),
      placa: l.placa,
      inicio: l.inicio,
      inicioSerial: matched?.inicioSerial ?? null,
      fim: l.fim || "",
      fimSerial: matched?.fimSerial ?? null,
      valorSemanal: l.valorSemanal || "",
      pago: "",
      devidoHoje: "",
      q: "",
      semanas: [],
      semanasCompletas: [],
    };
  });
  const merged = [...fromAdmin, ...extra];
  const seen = new Set();
  const out = [];
  merged.forEach((r) => {
    const sig = buildContractMatchKey(r.placa, r.cpf, r.inicio, r.fim);
    if (seen.has(sig)) return;
    seen.add(sig);
    out.push(r);
  });
  return out.sort((a, b) => {
    const da = parseRecordStartDate(a)?.getTime() || 0;
    const db = parseRecordStartDate(b)?.getTime() || 0;
    return da - db;
  });
}

function diasTotalContratoVida(contract) {
  const ini = toDateOnly(parseRecordStartDate(contract));
  if (!ini) return 1;
  const fimContrato = String(contract.fim || "").trim()
    ? toDateOnly(excelSerialToDate(contract.fimSerial) || parseBrDate(contract.fim))
    : toDateOnly(new Date());
  if (!fimContrato || fimContrato < ini) return 1;
  return Math.max(1, diffDays(ini, fimContrato));
}

function pagoEstimadoAteDataVida(contract, dateEnd) {
  const ini = toDateOnly(parseRecordStartDate(contract));
  if (!ini) return 0;
  const de = toDateOnly(dateEnd);
  if (!de || de < ini) return 0;
  const pago = parseCurrencyBR(contract.pago);
  if (!pago) return 0;
  const fimContrato = String(contract.fim || "").trim()
    ? toDateOnly(excelSerialToDate(contract.fimSerial) || parseBrDate(contract.fim))
    : toDateOnly(new Date());
  const alvo = de < fimContrato ? de : fimContrato;
  const den = diasTotalContratoVida(contract);
  const num = Math.max(0, diffDays(ini, alvo));
  return pago * Math.min(1, num / den);
}

function cumulativePagoPorMes(contratos, monthEndDate) {
  let sum = 0;
  contratos.forEach((c) => {
    sum += pagoEstimadoAteDataVida(c, monthEndDate);
  });
  return sum;
}

function enumerateMonthEndsClienteVida(contratos) {
  const starts = contratos.map((c) => parseRecordStartDate(c)).filter((d) => d instanceof Date && !Number.isNaN(d.getTime()));
  if (!starts.length) return [];
  const d0 = toDateOnly(starts.reduce((a, b) => (a < b ? a : b)));
  const d1 = toDateOnly(new Date());
  const cap = toDateOnly(new Date(d1.getFullYear(), d1.getMonth() + 1, 0));
  let y = d0.getFullYear();
  let m = d0.getMonth();
  const out = [];
  for (;;) {
    const me = toDateOnly(new Date(y, m + 1, 0));
    if (me < d0) {
      m++;
      if (m > 11) {
        m = 0;
        y++;
      }
      continue;
    }
    if (me > cap) break;
    out.push(me);
    if (me.getTime() >= cap.getTime()) break;
    m++;
    if (m > 11) {
      m = 0;
      y++;
    }
  }
  return out.length ? out : [cap];
}

function formatDataDmaBr(d) {
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return "";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function parseBrDayMonthWithReference(rawValue, referenceDate, mode) {
  const raw = String(rawValue || "").trim();
  const m = raw.match(/^(\d{1,2})\/([a-zA-ZçÇ]{3})$/);
  if (!m) return null;
  const day = Number(m[1]);
  const monKey = String(m[2] || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  const monthMap = {
    jan: 0,
    fev: 1,
    mar: 2,
    abr: 3,
    mai: 4,
    jun: 5,
    jul: 6,
    ago: 7,
    set: 8,
    out: 9,
    nov: 10,
    dez: 11,
  };
  const month = monthMap[monKey];
  if (!Number.isFinite(day) || day <= 0 || month == null) return null;
  const ref = toDateOnly(referenceDate) || toDateOnly(new Date());
  if (!ref) return null;
  let year = ref.getFullYear();
  if (mode === "start" && month > ref.getMonth()) year -= 1;
  if (mode === "end" && month < ref.getMonth()) year += 1;
  const d = new Date(year, month, day);
  if (d.getMonth() !== month || d.getDate() !== day) return null;
  return toDateOnly(d);
}

function inferEndDateForContrato(c) {
  if (!String(c?.fim || "").trim()) return null;
  const direct = toDateOnly(excelSerialToDate(c?.fimSerial) || parseBrDate(c?.fim));
  if (direct) return direct;
  const startRef = toDateOnly(parseRecordStartDate(c)) || toDateOnly(new Date());
  return parseBrDayMonthWithReference(c?.fim, startRef, "end");
}

function inferStartDateForContrato(c) {
  const direct = toDateOnly(parseRecordStartDate(c));
  if (direct) return direct;
  const endRef = inferEndDateForContrato(c) || toDateOnly(new Date());
  return parseBrDayMonthWithReference(c?.inicio, endRef, "start");
}

/** Início do contrato no modal cliente: sempre dia/mês/ano quando houver serial ou data válida. */
function formatContratoInicioClienteVida(c) {
  const d = inferStartDateForContrato(c);
  if (d) return formatDataDmaBr(d);
  const raw = String(c.inicio || "").trim();
  return raw || "-";
}

function formatContratoFimClienteVida(c) {
  if (!String(c.fim || "").trim()) return "(ativo)";
  const d = inferEndDateForContrato(c);
  if (d) return formatDataDmaBr(d);
  return String(c.fim || "").trim() || "-";
}

function renderClienteVidaCumulativeSvg(points) {
  if (!points.length) return "";
  const w = Math.min(1280, 80 + points.length * 52);
  const h = 300;
  const margin = { t: 62, r: 20, b: 56, l: 64 };
  const cw = w - margin.l - margin.r;
  const ch = h - margin.t - margin.b;
  const maxY = Math.max(1, ...points.map((p) => p.y));
  const n = points.length;
  const coords = points.map((p, i) => {
    const x = margin.l + (n <= 1 ? cw / 2 : (i / (n - 1)) * cw);
    const y = margin.t + ch - (p.y / maxY) * ch;
    return { x, y, label: p.label, value: p.y };
  });
  const poly = coords.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(" ");
  const valueTexts = coords
    .map((c) => {
      const valorStr = currencyBRL(c.value);
      const ty = Math.max(margin.t + 2, c.y - 12);
      return `<text x="${c.x.toFixed(1)}" y="${ty.toFixed(1)}" text-anchor="middle" font-size="8" fill="#f5f5f5">${escapeHtml(
        valorStr
      )}</text>`;
    })
    .join("");
  const circles = coords
    .map((c) => `<circle cx="${c.x.toFixed(1)}" cy="${c.y.toFixed(1)}" r="3" fill="#e10600"/>`)
    .join("");
  const step = coords.length > 16 ? 2 : 1;
  let labels = "";
  for (let i = 0; i < coords.length; i += step) {
    const c = coords[i];
    labels += `<text x="${c.x.toFixed(1)}" y="${h - 14}" text-anchor="middle" font-size="8" fill="#b3b3b3">${escapeHtml(
      c.label
    )}</text>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" class="cliente-vida-chart" viewBox="0 0 ${w} ${h}" width="100%" style="max-width:${w}px" role="img" aria-label="Pago acumulado por mes">
    <text x="${margin.l}" y="20" font-size="14" fill="#f5f5f5">Pago acumulado (R$) por mês — estimativa proporcional ao tempo de cada contrato</text>
    <text x="${margin.l}" y="36" font-size="10" fill="#888">Eixo: último dia de cada mês (DD/MM/AAAA). Acima de cada ponto: total acumulado pago (R$).</text>
    <line x1="${margin.l}" y1="${margin.t + ch}" x2="${margin.l + cw}" y2="${margin.t + ch}" stroke="#444" stroke-width="1"/>
    <line x1="${margin.l}" y1="${margin.t}" x2="${margin.l}" y2="${margin.t + ch}" stroke="#444" stroke-width="1"/>
    <polyline fill="none" stroke="#e10600" stroke-width="2" points="${poly}"/>
    ${circles}
    ${valueTexts}
    ${labels}
  </svg>`;
}

function avaliarRegularidadeCliente(contratos) {
  const ativo = contratos.find((c) => !String(c.fim || "").trim());
  const ref = ativo || contratos.slice().sort((a, b) => Number(b.inicioSerial || 0) - Number(a.inicioSerial || 0))[0];
  if (!ref) {
    return { texto: "Sem contrato na base para avaliar.", ok: null };
  }
  const dyn = withDynamicFinancialFields(ref);
  const devido = parseCurrencyBR(dyn.devidoHoje);
  const pago = parseCurrencyBR(ref.pago);
  if (!(devido > 0)) {
    return { texto: "Regular (sem valor devido calculado na base).", ok: true };
  }
  if (pago >= devido) {
    return { texto: "REGULAR: pagamentos em dia ou adiantados em relação ao devido atual.", ok: true };
  }
  return { texto: "NAO REGULAR: valor pago abaixo do devido até a data de referência.", ok: false };
}

function openClienteVidaDialog(cpfDigits) {
  if (!clienteVidaDialog || !clienteVidaBody) return;
  const key = onlyDigits(String(cpfDigits || ""));
  if (key.length !== 11) return;
  const contratos = mergeContractsForCliente(key);
  if (!contratos.length) {
    clienteVidaBody.innerHTML = `<p>Nenhum contrato encontrado para o CPF <strong>${formatCpf(
      key
    )}</strong> na base unificada nem no cadastro de locações.</p>`;
    clienteVidaDialog.classList.remove("hidden");
    return;
  }
  const nome =
    contratos.find((c) => String(c.nome || "").trim())?.nome ||
    findClienteByCpfCadastro(key)?.nome ||
    "Cliente";
  const aval = avaliarRegularidadeCliente(contratos);
  const ativo = contratos.find((c) => !String(c.fim || "").trim());
  const monthEnds = enumerateMonthEndsClienteVida(contratos);
  const chartPoints = monthEnds.map((me) => ({
    label: formatDataDmaBr(me),
    y: cumulativePagoPorMes(contratos, me),
  }));
  const rowsContratos = contratos
    .map((c) => {
      const placa = String(c.placa || "").trim();
      const modelo = findModeloByPlaca(placa);
      const ini = formatContratoInicioClienteVida(c);
      const fim = formatContratoFimClienteVida(c);
      const pago = parseCurrencyBR(c.pago);
      const vs = parseCurrencyBR(c.valorSemanal);
      const dyn = withDynamicFinancialFields(c);
      const dev = parseCurrencyBR(dyn.devidoHoje);
      const sit = getSituacaoFinanceiraAdmin(withDynamicFinancialFields(c));
      const isAtivo = !String(c.fim || "").trim();
      return `<tr class="${isAtivo ? "contrato-ativo-row" : ""}">
        <td class="col-data">${escapeHtml(ini)}</td>
        <td class="col-data">${escapeHtml(fim)}</td>
        <td>${escapeHtml(placa)}</td>
        <td class="col-modelo">${escapeHtml(modelo)}</td>
        <td class="col-moeda">${vs ? currencyBRL(vs) : "-"}</td>
        <td class="col-moeda">${pago ? currencyBRL(pago) : "-"}</td>
        <td class="col-moeda">${dev ? currencyBRL(dev) : "-"}</td>
        <td class="col-situacao">${escapeHtml(sit)}</td>
      </tr>`;
    })
    .join("");
  const zAtivo = ativo ? parseCurrencyBR(ativo.z) : 0;
  const zAtivoHtml =
    ativo && zAtivo > 0
      ? ` — <strong>Col. Z (aba RECEITA 2026 / vínculo com RECEITA 2025):</strong> ${currencyBRL(zAtivo)}`
      : "";
  const ativoHtml = ativo
    ? `<p><strong>Contrato ativo:</strong> placa <strong>${escapeHtml(String(ativo.placa || ""))}</strong> — modelo <strong>${escapeHtml(
        findModeloByPlaca(ativo.placa)
      )}</strong> — início <strong>${escapeHtml(formatContratoInicioClienteVida(ativo))}</strong>${zAtivoHtml}</p>`
    : "<p><strong>Contrato ativo:</strong> nenhum registro sem data fim na base.</p>";
  const grade2025 = buildClienteGradePagamentos2025(contratos);
  const grade2026 = buildClienteGradePagamentos2026(contratos);
  const gradeSectionHtml =
    grade2025.rows.length || grade2026.rows.length
      ? `<section class="cliente-vida-grade-section" aria-label="Pagamentos na grade da planilha">
    <h4 style="margin:0 0 0.5rem;font-size:1.05rem;">Pagamentos na planilha (grade mensal)</h4>
    ${renderClienteVidaGradeTablesHtml(grade2025, grade2026)}
    ${renderClienteVidaGradeMensalSplitSvg(grade2025, grade2026)}
  </section>`
      : `<section class="cliente-vida-grade-section" aria-label="Pagamentos na grade da planilha">
    <h4 style="margin:0 0 0.5rem;font-size:1.05rem;">Pagamentos na planilha (grade mensal)</h4>
    <p class="subtext">Não há trilhas semanasHistorico / semanas2026 na base para este CPF — importe ou atualize dk-data a partir da planilha para ver totais por mês.</p>
  </section>`;
  clienteVidaBody.innerHTML = `
    <p><strong>${escapeHtml(nome)}</strong> — CPF <strong>${formatCpf(key)}</strong></p>
    <p><strong>Avaliação de pagamentos:</strong> ${escapeHtml(aval.texto)}</p>
    <p class="cliente-vida-datas-nota">Datas em <strong>dia/mês/ano</strong> (DD/MM/AAAA) para facilitar a leitura na virada do ano.</p>
    ${ativoHtml}
    <div class="table-wrap cliente-vida-contratos">
      <table class="relatorio-table cliente-vida-table">
        <thead>
          <tr>
            <th class="col-data">Início (DD/MM/AAAA)</th>
            <th class="col-data">Fim (DD/MM/AAAA)</th>
            <th>Placa</th>
            <th class="col-modelo">Modelo</th>
            <th class="col-moeda">Valor semanal</th>
            <th class="col-moeda">Pago (P)</th>
            <th class="col-moeda">Devido (O)</th>
            <th class="col-situacao">Situação</th>
          </tr>
        </thead>
        <tbody>${
          rowsContratos ||
          `<tr><td colspan="8">Nenhum contrato encontrado na base unificada nem no cadastro de locações.</td></tr>`
        }</tbody>
      </table>
    </div>
    ${gradeSectionHtml}
    <p class="subtext" style="margin-top:1rem;"><strong>Pago acumulado (estimativa)</strong> — proporcional ao tempo de cada contrato na base:</p>
    ${renderClienteVidaCumulativeSvg(chartPoints)}
  `;
  clienteVidaDialog.classList.remove("hidden");
}

function buildGroupedFinanceRows(records, mode) {
  const groups = new Map();
  records.forEach((r) => {
    const keyCpf = onlyDigits(String(r.cpf || ""));
    const keyNome = normalizeName(String(r.nome || "Nao informado"));
    const key = keyCpf || keyNome;
    if (!groups.has(key)) {
      groups.set(key, {
        nome: r.nome || "Nao informado",
        due: 0,
        paid: 0,
        contracts: [],
      });
    }
    const group = groups.get(key);
    group.due += parseCurrencyBR(r.devidoHoje);
    group.paid += parseCurrencyBR(r.pago);
    group.contracts.push(r);
  });

  return Array.from(groups.values())
    .map((g) => {
      const orderedContracts = g.contracts
        .slice()
        .sort((a, b) => {
          const da = parseRecordStartDate(a);
          const db = parseRecordStartDate(b);
          return (da?.getTime() || 0) - (db?.getTime() || 0);
        })
        .map((c) => formatContratoTimeline(c))
        .join("<br>");

      if (mode === "emdia") {
        const saldoSobrando = Math.max(0, g.paid - g.due);
        return [
          g.nome,
          orderedContracts,
          currencyBRL(g.due),
          currencyBRL(g.paid),
          `<span class="saldo-devedor-cell saldo-devedor-cell-emdia">+ ${currencyBRL(saldoSobrando)}</span>`,
        ];
      }

      const saldoDevedor = Math.max(0, g.due - g.paid);
      return [
        g.nome,
        orderedContracts,
        currencyBRL(g.due),
        currencyBRL(g.paid),
        `<span class="saldo-devedor-cell saldo-devedor-cell-atraso">- ${currencyBRL(saldoDevedor)}</span>`,
      ];
    })
    .sort((a, b) => String(a[0] || "").localeCompare(String(b[0] || ""), "pt-BR"));
}

function renderLocacaoReport(title, htmlContent, options = {}) {
  const saldoTotal = getGlobalSaldoTotal();
  const hideTotal = Boolean(options.hideTotal);
  const totalLabel =
    typeof options.totalLabel === "string" && options.totalLabel.trim()
      ? options.totalLabel.trim()
      : "Totalizador do saldo";
  const totalValue =
    typeof options.totalValue === "number" ? options.totalValue : saldoTotal;
  locacaoReportTitle.textContent = title;
  locacaoReportBody.innerHTML = `
    <div class="report-actions">
      ${hideTotal ? "" : `<p><strong>${totalLabel}:</strong> ${currencyBRL(totalValue)}</p>`}
      <button type="button" class="secondary" data-report-export="excel" data-report-target="locacao">Exportar Excel</button>
      <button type="button" class="secondary" data-report-export="pdf" data-report-target="locacao">Exportar PDF</button>
    </div>
    ${htmlContent}
  `;
  locacaoReportBox.classList.remove("hidden");
}

function renderManutencaoReport() {
  const manutencoes = loadCadastro(CAD_MANUTENCOES_KEY).slice().reverse();
  const ativas = manutencoes.filter((m) => !String(m.dataRealSaida || "").trim());
  const saldoTotal = getGlobalSaldoTotal();
  const html = manutencoes.length
    ? `
      <div class="report-actions">
        <p><strong>Totalizador do saldo:</strong> ${currencyBRL(saldoTotal)}</p>
        <button type="button" class="secondary" data-report-export="excel" data-report-target="manutencao">Exportar Excel</button>
        <button type="button" class="secondary" data-report-export="pdf" data-report-target="manutencao">Exportar PDF</button>
      </div>
      <p><strong>Veículos em manutenção ativa:</strong> ${ativas.length}</p>
      <div class="table-wrap">
        <table class="relatorio-table">
          <thead>
            <tr>
              <th>PLACA</th>
              <th>MOTIVO DA MANUTENÇÃO</th>
              <th>DATA ENTRADA</th>
              <th>PREVISÃO SAÍDA</th>
              <th>DATA REAL SAÍDA</th>
            </tr>
          </thead>
          <tbody>
            ${manutencoes
              .map(
                (m) => {
                  const hasMissing =
                    isMissingInfoValue(m.placa) ||
                    isMissingInfoValue(m.servico) ||
                    isMissingInfoValue(m.data) ||
                    isMissingInfoValue(m.dataPrevistaSaida) ||
                    isMissingInfoValue(m.dataRealSaida);
                  return `<tr class="${hasMissing ? "missing-row" : ""}">
                  <td>${formatMissingInfoCell(m.placa)}</td>
                  <td>${formatMissingInfoCell(m.servico)}</td>
                  <td>${formatMissingInfoCell(m.data)}</td>
                  <td>${formatMissingInfoCell(m.dataPrevistaSaida)}</td>
                  <td>${formatMissingInfoCell(m.dataRealSaida, "Nao informado")}</td>
                </tr>`;
                }
              )
              .join("")}
          </tbody>
        </table>
      </div>
    `
    : "<p>Nenhuma manutenção cadastrada.</p>";
  manutencaoReportTitle.textContent = "Relatório de manutenção";
  manutencaoReportBody.innerHTML = html;
  manutencaoReportBox.classList.remove("hidden");
}

function parseBrDate(dateStr) {
  if (dateStr === null || dateStr === undefined) return null;
  const raw = String(dateStr).trim();
  if (!raw) return null;

  if (raw.includes("/")) {
    const [day, month, year] = raw.split("/").map(Number);
    if (!day || !month || !year) return null;
    return new Date(year, month - 1, day);
  }

  const numeric = Number(raw.replace(",", "."));
  if (Number.isFinite(numeric) && numeric > 20000) {
    const excelEpoch = new Date(1899, 11, 30);
    const ms = Math.round(numeric) * 24 * 60 * 60 * 1000;
    return new Date(excelEpoch.getTime() + ms);
  }

  return null;
}

function excelSerialToDate(serial) {
  const n = Number(serial);
  if (!Number.isFinite(n) || n <= 0) return null;
  const excelEpoch = new Date(1899, 11, 30);
  const ms = Math.floor(n) * 24 * 60 * 60 * 1000;
  return new Date(excelEpoch.getTime() + ms);
}

function diffDays(start, end) {
  if (!(start instanceof Date) || !(end instanceof Date)) return 0;
  const ms = 1000 * 60 * 60 * 24;
  return Math.max(1, Math.ceil((end - start) / ms));
}

function diffYMD(start, end) {
  if (!(start instanceof Date) || !(end instanceof Date)) return null;
  if (end < start) return { years: 0, months: 0, days: 0 };
  const s = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const e = new Date(end.getFullYear(), end.getMonth(), end.getDate());

  let years = e.getFullYear() - s.getFullYear();
  let months = e.getMonth() - s.getMonth();
  let days = e.getDate() - s.getDate();

  if (days < 0) {
    const prevMonthDays = new Date(e.getFullYear(), e.getMonth(), 0).getDate();
    days += prevMonthDays;
    months -= 1;
  }

  if (months < 0) {
    months += 12;
    years -= 1;
  }

  return {
    years: Math.max(0, years),
    months: Math.max(0, months),
    days: Math.max(0, days),
  };
}

function pluralPt(value, singular, plural) {
  return `${value} ${value === 1 ? singular : plural}`;
}

function formatTempoLocacao(start, end) {
  const parts = diffYMD(start, end);
  if (!parts) return "periodo sem data completa";
  return `${pluralPt(parts.years, "ano", "anos")} ${pluralPt(parts.months, "mes", "meses")} e ${pluralPt(parts.days, "dia", "dias")} de locacao`;
}

function formatMesExtenso(dateObj) {
  if (!(dateObj instanceof Date)) return "data nao informada";
  return dateObj.toLocaleDateString("pt-BR", { month: "long" });
}

function getPieSlicePath(cx, cy, r, startAngle, endAngle) {
  const startX = cx + r * Math.cos(startAngle);
  const startY = cy + r * Math.sin(startAngle);
  const endX = cx + r * Math.cos(endAngle);
  const endY = cy + r * Math.sin(endAngle);
  const largeArcFlag = endAngle - startAngle > Math.PI ? 1 : 0;
  return `M ${cx} ${cy} L ${startX} ${startY} A ${r} ${r} 0 ${largeArcFlag} 1 ${endX} ${endY} Z`;
}

function renderValorPieChart(targetId, groupedEntries) {
  const container = document.getElementById(targetId);
  if (!container) return;
  const total = groupedEntries.reduce((acc, [, count]) => acc + count, 0);
  if (!total) {
    container.innerHTML = "<p>Sem dados para o grafico.</p>";
    return;
  }

  const colors = [
    "#e10600",
    "#111111",
    "#2563eb",
    "#059669",
    "#d97706",
    "#7c3aed",
    "#db2777",
    "#0f766e",
  ];

  let currentAngle = -Math.PI / 2;
  const slices = groupedEntries.map(([value, count], index) => {
    const fraction = count / total;
    const angle = fraction * Math.PI * 2;
    const start = currentAngle;
    const end = currentAngle + angle;
    currentAngle = end;
    return {
      label: currencyBRL(Number(value)),
      count,
      color: colors[index % colors.length],
      path: getPieSlicePath(100, 100, 90, start, end),
      percentage: (fraction * 100).toFixed(1),
    };
  });

  const svg = `
    <svg viewBox="0 0 200 200" width="220" height="220" aria-label="Grafico de pizza de valor de locacao">
      ${slices.map((s) => `<path d="${s.path}" fill="${s.color}" stroke="#fff" stroke-width="1"></path>`).join("")}
    </svg>
  `;

  const legend = slices
    .map(
      (s) =>
        `<li><span class="dot" style="background:${s.color}"></span>${s.label}: ${s.count} cliente(s) (${s.percentage}%)</li>`
    )
    .join("");

  container.innerHTML = `
    <div class="pie-wrap">
      ${svg}
      <ul class="pie-legend">${legend}</ul>
    </div>
  `;
}

function renderSimplePieChart(targetId, entries) {
  const container = document.getElementById(targetId);
  if (!container) return;
  const total = entries.reduce((acc, e) => acc + e.count, 0);
  if (!total) {
    container.innerHTML = "<p>Sem dados para o grafico.</p>";
    return;
  }

  const colors = ["#15803d", "#d97706", "#b42318"];
  let currentAngle = -Math.PI / 2;
  const slices = entries.map((entry, index) => {
    const fraction = entry.count / total;
    const angle = fraction * Math.PI * 2;
    const start = currentAngle;
    const end = currentAngle + angle;
    currentAngle = end;
    return {
      ...entry,
      color: colors[index % colors.length],
      path: getPieSlicePath(100, 100, 90, start, end),
      percentage: (fraction * 100).toFixed(1),
    };
  });

  const svg = `
    <svg viewBox="0 0 200 200" width="220" height="220" aria-label="Grafico de pizza de inadimplencia media">
      ${slices.map((s) => `<path d="${s.path}" fill="${s.color}" stroke="#fff" stroke-width="1"></path>`).join("")}
    </svg>
  `;

  const legend = slices
    .map(
      (s) =>
        `<li><span class="dot" style="background:${s.color}"></span>${s.label}: ${s.count} cliente(s) (${s.percentage}%)</li>`
    )
    .join("");

  container.innerHTML = `<div class="pie-wrap">${svg}<ul class="pie-legend">${legend}</ul></div>`;
}

function computeDelayWeeksFromSemanas(semanas) {
  if (!Array.isArray(semanas) || !semanas.length) return 0;
  const paidIndexes = [];
  semanas.forEach((value, index) => {
    const amount = parseCurrencyBR(value);
    if (amount > 0) paidIndexes.push(index);
  });
  if (paidIndexes.length <= 1) return 0;
  let maxGap = 0;
  for (let i = 1; i < paidIndexes.length; i += 1) {
    const gap = paidIndexes[i] - paidIndexes[i - 1] - 1;
    if (gap > maxGap) maxGap = gap;
  }
  return maxGap;
}

function renderGroupedPieChart(targetId, entries) {
  const container = document.getElementById(targetId);
  if (!container) return;
  const total = entries.reduce((acc, e) => acc + e.count, 0);
  if (!total) {
    container.innerHTML = "<p>Sem dados para o grafico.</p>";
    return;
  }

  function tonalColor(index, totalCount) {
    if (totalCount <= 1) return "hsl(0, 75%, 40%)";
    const t = index / (totalCount - 1);
    const lightness = 78 - t * 55; // claro -> escuro
    return `hsl(0, 75%, ${lightness}%)`;
  }

  let currentAngle = -Math.PI / 2;
  const slices = entries.map((entry, index) => {
    const fraction = entry.count / total;
    const angle = fraction * Math.PI * 2;
    const start = currentAngle;
    const end = currentAngle + angle;
    currentAngle = end;
    return {
      ...entry,
      color: tonalColor(index, entries.length),
      path: getPieSlicePath(100, 100, 90, start, end),
      percentage: (fraction * 100).toFixed(1),
    };
  });

  const svg = `
    <svg viewBox="0 0 200 200" width="220" height="220" aria-label="Grafico de pizza por tempo de locacao">
      ${slices.map((s) => `<path d="${s.path}" fill="${s.color}" stroke="#fff" stroke-width="1"></path>`).join("")}
    </svg>
  `;

  const legend = slices
    .map(
      (s) =>
        `<li><span class="dot" style="background:${s.color}"></span>${s.label}: ${s.count} cliente(s) (${s.percentage}%)</li>`
    )
    .join("");

  container.innerHTML = `<div class="pie-wrap">${svg}<ul class="pie-legend">${legend}</ul></div>`;
}

function monthKey(dateObj) {
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function buildMonthRange(startYear, startMonth1, endYear, endMonth1) {
  const out = [];
  let y = startYear;
  let m = startMonth1;
  while (y < endYear || (y === endYear && m <= endMonth1)) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return out;
}

function monthLabelPt(key) {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(y, m - 1, 1);
  return d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
}

function linearRegression(values) {
  const n = values.length;
  if (!n) return { a: 0, b: 0 };
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;
  for (let i = 0; i < n; i += 1) {
    const x = i;
    const y = values[i];
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumXX += x * x;
  }
  const den = n * sumXX - sumX * sumX;
  const b = den === 0 ? 0 : (n * sumXY - sumX * sumY) / den;
  const a = (sumY - b * sumX) / n;
  return { a, b };
}

function buildReceitaMensal(records) {
  const monthTotals = {};
  const baseDate = new Date(2025, 1, 1); // fev/2025
  records.forEach((r) => {
    const weeks = Array.isArray(r.semanasCompletas) && r.semanasCompletas.length
      ? r.semanasCompletas
      : Array.isArray(r.semanas)
        ? r.semanas
        : [];
    weeks.forEach((value, idx) => {
      const amount = parseCurrencyBR(value);
      if (amount <= 0) return;
      const d = new Date(baseDate.getTime() + idx * 7 * 24 * 60 * 60 * 1000);
      const key = monthKey(d);
      monthTotals[key] = (monthTotals[key] || 0) + amount;
    });
  });
  return monthTotals;
}

function renderReceitaBarLineChart(targetId, monthTotals) {
  const container = document.getElementById(targetId);
  if (!container) return;

  const barsMonths = buildMonthRange(2025, 2, 2026, 3);
  const lineMonths = buildMonthRange(2025, 2, 2026, 12);

  const observed = barsMonths.map((k) => monthTotals[k] || 0);
  const { a, b } = linearRegression(observed);
  const projectedAll = lineMonths.map((_, i) => Math.max(0, a + b * i));

  const maxY = Math.max(1, ...observed, ...projectedAll);
  const w = 980;
  const h = 360;
  const padL = 60;
  const padR = 20;
  const padT = 20;
  const padB = 65;
  const chartW = w - padL - padR;
  const chartH = h - padT - padB;
  const xFor = (i, n) => padL + (n <= 1 ? 0 : (i * chartW) / (n - 1));
  const yFor = (v) => padT + chartH - (v / maxY) * chartH;

  const colors = {
    axis: "#8a94a6",
    label: "#5f6b7a",
    bar: "#4f46e5",
    line: "#0ea5a4",
    bg: "#f8fafc",
  };
  const barW = (chartW / Math.max(14, barsMonths.length)) * 0.55;
  const barsSvg = barsMonths
    .map((m, i) => {
      const x = xFor(i, lineMonths.length) - barW / 2;
      const v = observed[i];
      const y = yFor(v);
      const height = padT + chartH - y;
      return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${Math.max(1, height).toFixed(1)}" fill="${colors.bar}" opacity="0.82" rx="2"></rect>`;
    })
    .join("");

  const linePath = projectedAll
    .map((v, i) => `${i === 0 ? "M" : "L"} ${xFor(i, lineMonths.length).toFixed(1)} ${yFor(v).toFixed(1)}`)
    .join(" ");

  const labels = lineMonths
    .filter((_, i) => i % 2 === 0)
    .map((m, i) => {
      const idx = i * 2;
      return `<text x="${xFor(idx, lineMonths.length).toFixed(1)}" y="${h - 40}" text-anchor="middle" font-size="10" fill="${colors.label}">${monthLabelPt(m)}</text>`;
    })
    .join("");

  container.innerHTML = `
    <div class="chart-wrap">
      <svg viewBox="0 0 ${w} ${h}" width="100%" height="360" aria-label="Receita mensal com projeção">
        <rect x="0" y="0" width="${w}" height="${h}" fill="${colors.bg}" rx="8"></rect>
        <line x1="${padL}" y1="${padT + chartH}" x2="${w - padR}" y2="${padT + chartH}" stroke="${colors.axis}" stroke-width="1"></line>
        <line x1="${padL}" y1="${padT}" x2="${padL}" y2="${padT + chartH}" stroke="${colors.axis}" stroke-width="1"></line>
        ${barsSvg}
        <path d="${linePath}" fill="none" stroke="${colors.line}" stroke-width="2.6"></path>
        ${labels}
      </svg>
      <p><strong>Barras:</strong> receita mensal real (fev/2025 a mar/2026) | <strong>Linha:</strong> projeção até dez/2026.</p>
    </div>
  `;
}

function renderReceitaBarLineChartFromSeries(targetId, series) {
  const container = document.getElementById(targetId);
  if (!container) return;
  if (!Array.isArray(series) || !series.length) {
    container.innerHTML = "<p>Sem dados mensais para o grafico.</p>";
    return;
  }

  const barsMonths = buildMonthRange(2025, 2, 2026, 3);
  const lineMonths = buildMonthRange(2025, 2, 2026, 12);
  const map = {};
  series.forEach((s) => {
    map[s.key] = Number(s.total || 0);
  });

  const observed = barsMonths.map((k) => map[k] || 0);
  const observedForTrend = lineMonths.map((k, i) => (i < observed.length ? observed[i] : 0));
  const { a, b } = linearRegression(observedForTrend.slice(0, observed.length));
  const projectedAll = lineMonths.map((_, i) => Math.max(0, a + b * i));

  const maxY = Math.max(1, ...observed, ...projectedAll);
  const w = 980;
  const h = 360;
  const padL = 60;
  const padR = 20;
  const padT = 20;
  const padB = 65;
  const chartW = w - padL - padR;
  const chartH = h - padT - padB;
  const xFor = (i, n) => padL + (n <= 1 ? 0 : (i * chartW) / (n - 1));
  const yFor = (v) => padT + chartH - (v / maxY) * chartH;
  const colors = {
    axis: "#8a94a6",
    label: "#5f6b7a",
    bar: "#4f46e5",
    line: "#0ea5a4",
    bg: "#f8fafc",
  };
  const barW = (chartW / Math.max(14, barsMonths.length)) * 0.55;

  const barsSvg = barsMonths
    .map((m, i) => {
      const x = xFor(i, lineMonths.length) - barW / 2;
      const v = observed[i];
      const y = yFor(v);
      const height = padT + chartH - y;
      return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${Math.max(1, height).toFixed(1)}" fill="${colors.bar}" opacity="0.82" rx="2"></rect>`;
    })
    .join("");

  const linePath = projectedAll
    .map((v, i) => `${i === 0 ? "M" : "L"} ${xFor(i, lineMonths.length).toFixed(1)} ${yFor(v).toFixed(1)}`)
    .join(" ");

  const labels = lineMonths
    .filter((_, i) => i % 2 === 0)
    .map((m, i) => {
      const idx = i * 2;
      return `<text x="${xFor(idx, lineMonths.length).toFixed(1)}" y="${h - 40}" text-anchor="middle" font-size="10" fill="${colors.label}">${monthLabelPt(m)}</text>`;
    })
    .join("");

  container.innerHTML = `
    <div class="chart-wrap">
      <svg viewBox="0 0 ${w} ${h}" width="100%" height="360" aria-label="Receita mensal com projeção">
        <rect x="0" y="0" width="${w}" height="${h}" fill="${colors.bg}" rx="8"></rect>
        <line x1="${padL}" y1="${padT + chartH}" x2="${w - padR}" y2="${padT + chartH}" stroke="${colors.axis}" stroke-width="1"></line>
        <line x1="${padL}" y1="${padT}" x2="${padL}" y2="${padT + chartH}" stroke="${colors.axis}" stroke-width="1"></line>
        ${barsSvg}
        <path d="${linePath}" fill="none" stroke="${colors.line}" stroke-width="2.6"></path>
        ${labels}
      </svg>
      <p><strong>Barras:</strong> receita mensal real (fev/2025 a mar/2026) | <strong>Linha:</strong> projeção até dez/2026.</p>
    </div>
  `;
}

function renderAdminDashboard() {
  if (enforceMaintenanceAndDailyRoutines()) return;
  const session = getSession();
  const isOwner = session?.tipo === "admin" && session?.role === "owner";
  showLocadoraArea();
  dashboardCard.classList.add("hidden");
  loginArea.classList.add("hidden");
  adminCard.classList.remove("hidden");
  adminNavInformacao.classList.toggle("hidden", !isOwner);
  adminNavDados.classList.toggle("hidden", !isOwner);
  operacaoTargetButtons.forEach((button) => {
    if (button.dataset.target === "funcionario") {
      button.classList.toggle("hidden", !isOwner);
    }
  });
  setAdminSection("operacao");
  setOperacaoSubsection(operacaoAbaAtual || "cliente");
  setInformacaoScope("todos");
  currentAdminReportSaldo = getGlobalSaldoTotal();
  renderCadastros();
  renderAdminResult(
    "Selecione uma consulta por grupo",
    "<p>Abra Informação no menu lateral e escolha Clientes Ativos ou Clientes Inativos.</p>"
  );
}

function runAdminAction(action, scope) {
  const snapshot = buildOperationalSnapshot();
  const records = getRecordsByScope(scope);
  currentAdminReportSaldo = computeSaldoFromRecords(records);
  const previewLimit = 120;
  const scopeLabel =
    scope === "ativos"
      ? "Clientes Ativos"
      : scope === "inativos"
        ? "Clientes Inativos"
        : "Todos os clientes";
  currentScopeLabel = scopeLabel;
  const consistencyHtml = `<p class="hint">Base única: Ativos ${snapshot.checks.ativos} | Disponíveis ${snapshot.checks.disponiveis} | Em manutenção ${snapshot.checks.manutencao} | Frota ${snapshot.checks.frotaTotal}</p>`;

  if (action === "placa") {
    const html = records
      .slice(0, previewLimit)
      .map(
        (r) =>
          `<p><strong>${r.placa}</strong> - ${r.nome} (${toPlanName(r)})</p>`
      )
      .join("");
    renderAdminResult(
      `${scopeLabel} | Veiculos por placa (${records.length} registros)`,
      consistencyHtml +
        html +
        (records.length > previewLimit ? "<p><strong>Mostrando os primeiros 120 registros.</strong></p>" : "")
    );
    return;
  }

  if (action === "modelo") {
    const grouped = {};
    records.forEach((r) => {
      const modelo = findModeloByPlaca(r.placa);
      if (!grouped[modelo]) grouped[modelo] = [];
      grouped[modelo].push(r);
    });
    currentModelGroups = grouped;
    const ordered = Object.entries(grouped).sort((a, b) => b[1].length - a[1].length);
    const html = ordered
      .slice(0, previewLimit)
      .map(
        ([modelo, arr]) =>
          `<p><button type="button" class="model-detail-btn" data-model="${modelo.replace(/"/g, "&quot;")}">${modelo}</button> - ${arr.length} veiculo(s)</p>`
      )
      .join("");
    renderAdminResult(
      `${scopeLabel} | Veiculos por modelo (${ordered.length} modelos)`,
      consistencyHtml +
        html +
        `<div id="modelDetailBox" class="model-detail-box"><p>Clique em um modelo para ver clientes e placas.</p></div>` +
        (ordered.length > previewLimit ? "<p><strong>Mostrando os primeiros 120 modelos.</strong></p>" : "")
    );
    return;
  }

  if (action === "tempo") {
    const today = new Date();
    const durationsInMonths = [];
    records.forEach((r) => {
      const inicio = excelSerialToDate(r.inicioSerial) || parseBrDate(r.inicio);
      const fim =
        scope === "ativos"
          ? today
          : excelSerialToDate(r.fimSerial) || parseBrDate(r.fim);
      if (!inicio || !fim) return;
      const diff = diffYMD(inicio, fim);
      if (!diff) return;
      const monthsDecimal = diff.years * 12 + diff.months + diff.days / 30;
      durationsInMonths.push(monthsDecimal);
    });

    const maxMonth = durationsInMonths.length
      ? Math.ceil(Math.max(...durationsInMonths))
      : 0;
    const groupedExclusive = [];

    const lessThanOne = durationsInMonths.filter((m) => m < 1).length;
    groupedExclusive.push({
      label: "Clientes com menos de 1 mes",
      count: lessThanOne,
    });

    for (let m = 1; m < maxMonth; m += 1) {
      const count = durationsInMonths.filter(
        (value) => value > m && value <= m + 1
      ).length;
      groupedExclusive.push({
        label: `Clientes com mais de ${m} mes${m > 1 ? "es" : ""} e ate ${m + 1} mes${m + 1 > 1 ? "es" : ""}`,
        count,
      });
    }

    const html = groupedExclusive
      .slice(0, previewLimit)
      .map((g) => `<p><strong>${g.label}</strong> = ${g.count} cliente(s)</p>`)
      .join("") + `<p><strong>Total de clientes:</strong> ${durationsInMonths.length}</p>`;

    renderAdminResult(
      `${scopeLabel} | Tempo de locacao agrupado (${records.length} clientes)`,
      `${consistencyHtml}<div class="valor-layout"><div>${html}${groupedExclusive.length > previewLimit ? "<p><strong>Mostrando as primeiras 120 faixas.</strong></p>" : ""}</div><div id="tempoPieChart"></div></div>`
    );
    renderGroupedPieChart(
      "tempoPieChart",
      groupedExclusive.slice(0, previewLimit).map((g) => ({
        label: g.label,
        count: g.count,
      }))
    );
    return;
  }

  if (action === "receita") {
    const baseReceita2026 = receita2026Data.length ? receita2026Data : records;
    const previsaoSemanalRows = baseReceita2026.filter(
      (r) => !String(r.fim || "").trim()
    );
    const totalSemanal = previsaoSemanalRows.reduce(
      (acc, r) => acc + parseCurrencyBR(r.valorSemanal),
      0
    );
    const totalPago = records.reduce((acc, r) => acc + parseCurrencyBR(r.pago), 0);
    const html = `<p><strong>Receita semanal total (I):</strong> ${currencyBRL(totalSemanal)}</p>
      <p class="subtext">Previsão semanal: soma da coluna I da aba RECEITA 2026 somente nas linhas sem data de fim (coluna L vazia).</p>
      <p><strong>Total pago pelos clientes (P):</strong> ${currencyBRL(totalPago)}</p>
      <div id="receitaBarLineChart"></div>`;
    renderAdminResult(`${scopeLabel} | Receita total`, consistencyHtml + html);
    if (monthlySeriesData.length) {
      renderReceitaBarLineChartFromSeries(
        "receitaBarLineChart",
        monthlySeriesData.filter((s) => s.key >= "2025-02" && s.key <= "2026-12")
      );
    } else {
      const monthTotals = buildReceitaMensal(records);
      renderReceitaBarLineChart("receitaBarLineChart", monthTotals);
    }
    return;
  }

  if (action === "valor") {
    const grouped = {};
    records.forEach((r) => {
      const value = parseCurrencyBR(r.valorSemanal);
      const key = value.toFixed(2);
      grouped[key] = (grouped[key] || 0) + 1;
    });

    const ordered = Object.entries(grouped).sort(
      (a, b) => Number(a[0]) - Number(b[0])
    );

    const html = ordered
      .slice(0, previewLimit)
      .map(
        ([value, count]) =>
          `<p>Locacoes de <strong>${currencyBRL(Number(value))}</strong> = <strong>${count}</strong> cliente(s)</p>`
      )
      .join("");

    renderAdminResult(
      `${scopeLabel} | Valor de locacao agrupado (${ordered.length} faixas)`,
      `${consistencyHtml}<div class="valor-layout"><div>${html}${ordered.length > previewLimit ? "<p><strong>Mostrando as primeiras 120 faixas.</strong></p>" : ""}</div><div id="valorPieChart"></div></div>`
    );
    renderValorPieChart("valorPieChart", ordered.slice(0, previewLimit));
    return;
  }

  if (action === "financeiro") {
    const financeiroBase =
      scope === "inativos" && receita2026Data.length
        ? receita2026Data.filter((r) => String(r.fim || "").trim())
        : records;
    const emDia = [];
    const atraso = [];
    financeiroBase.forEach((r) => {
      const devido = parseCurrencyBR(r.devidoHoje);
      const pago = parseCurrencyBR(r.pago);
      const isDebtorColor = Number(r.cor || 0) === 255;
      if (scope === "inativos" && receita2026Data.length) {
        if (isDebtorColor || pago < devido) {
          atraso.push({
            ...r,
            valorAtraso: Math.max(0, devido - pago),
          });
          return;
        }
        emDia.push(r);
        return;
      }
      if (pago >= devido) {
        emDia.push(r);
      } else {
        atraso.push({
          ...r,
          valorAtraso: devido - pago,
        });
      }
    });

    currentFinanceiroEmDia = emDia;
    currentFinanceiroAtraso = atraso;
    currentFinanceiroScope = scope;

    const html = `
      <div class="finance-options">
        <button type="button" class="finance-option-btn" data-finance="emdia">
          01 - Clientes com pagamento em dia (${emDia.length})
        </button>
        <button type="button" class="finance-option-btn" data-finance="atraso">
          02 - Clientes em atraso (${atraso.length})
        </button>
      </div>
      <div id="financeDetailBox" class="model-detail-box">
        <p>Selecione uma opcao para ver detalhes.</p>
      </div>
    `;

    renderAdminResult(
      `${scopeLabel} | Situacao financeira (${financeiroBase.length} registros)`,
      consistencyHtml + html,
      { saldoTotal: computeSaldoFromRecords(financeiroBase) }
    );
    return;
  }

  if (action === "caixa") {
    const entradas = getEntradasCaixaTotal();
    const saidas = 0;
    const saldo = entradas - saidas;
    const html = `
      <div class="caixa-cards">
        <div class="caixa-card">
          <p class="caixa-label">Entradas</p>
          <p class="caixa-value">${currencyBRL(entradas)}</p>
          <p class="subtext">Soma dos lançamentos de aluguel.</p>
        </div>
        <div class="caixa-card">
          <p class="caixa-label">Saídas</p>
          <p class="caixa-value">${currencyBRL(saidas)}</p>
          <p class="subtext">Ainda sem lançamentos de despesas.</p>
        </div>
        <div class="caixa-card">
          <p class="caixa-label">Saldo</p>
          <p class="caixa-value">${currencyBRL(saldo)}</p>
          <p class="subtext">Entradas - Saídas.</p>
        </div>
      </div>
    `;
    renderAdminResult(`${scopeLabel} | Caixa`, consistencyHtml + html);
    return;
  }

  if (action === "quadrogeral") {
    const rows = syncLocacaoDatabaseFromReceita2026();
    currentQuadroGeralRows = rows;
    const filtered =
      scope === "ativos"
        ? rows.filter((r) => r.statusLocacao === "ATIVO")
        : scope === "inativos"
          ? rows.filter((r) => r.statusLocacao === "INATIVO")
          : rows;
    const preview = filtered.slice(0, 200);
    const table = buildStructuredTable(
      ["CLIENTE", "CPF", "PLACA", "MODELO", "INICIO", "FIM", "PLANO", "DEVIDO", "PAGO", "SALDO"],
      preview.map((r) => [
        r.clienteNome,
        formatCpf(r.cpf) || "Nao informado",
        r.placa || "Nao informado",
        r.modeloVeiculo || "Nao informado",
        r.dataInicio || "-",
        r.dataFim || "-",
        r.plano || "-",
        r.valorDevidoHoje || "-",
        r.valorPagoHoje || "-",
        r.saldo || "-",
      ]),
      "Sem dados para quadro geral.",
      "relatorio-compacto"
    );
    const html = `
      <p><strong>Base de locações consolidada:</strong> ${filtered.length} registro(s).</p>
      <div class="report-actions">
        <button type="button" class="secondary" data-quadro-export="pdf">PDF</button>
        <button type="button" class="secondary" data-quadro-export="excel">Excel</button>
      </div>
      ${table}
      ${filtered.length > 200 ? "<p><strong>Mostrando os primeiros 200 registros.</strong></p>" : ""}
    `;
    renderAdminResult(`${scopeLabel} | Quadro geral`, consistencyHtml + html, {
      saldoTotal: filtered.reduce((acc, r) => acc + (r.saldoNumerico < 0 ? Math.abs(r.saldoNumerico) : 0), 0),
    });
    return;
  }

  if (action === "inadimplencia") {
    const buckets = {
      emDia: 0,
      umaSemana: 0,
      maisDeDuas: 0,
    };
    let delayTotal = 0;
    let counted = 0;

    records.forEach((r) => {
      const weeklyHistory = Array.isArray(r.semanasCompletas) && r.semanasCompletas.length
        ? r.semanasCompletas
        : r.semanas;
      const delayWeeks = computeDelayWeeksFromSemanas(weeklyHistory);
      delayTotal += delayWeeks;
      counted += 1;
      if (delayWeeks <= 0) {
        buckets.emDia += 1;
      } else if (delayWeeks === 1) {
        buckets.umaSemana += 1;
      } else {
        buckets.maisDeDuas += 1;
      }
    });

    const media = counted ? (delayTotal / counted).toFixed(2) : "0.00";
    const html = `
      <div class="valor-layout">
        <div>
          <p><strong>Media de atraso:</strong> ${media} semana(s)</p>
          <p><strong>Base:</strong> historico semanal da aba RECEITA (AA-CE) + RECEITA 2026 (AA-CI)</p>
          <p>Clientes que pagam em dias = <strong>${buckets.emDia}</strong></p>
          <p>Clientes que costumam atrasar uma semana = <strong>${buckets.umaSemana}</strong></p>
          <p>Clientes que atrasam mais de 2 semanas = <strong>${buckets.maisDeDuas}</strong></p>
        </div>
        <div id="inadimplenciaPieChart"></div>
      </div>
    `;

    renderAdminResult(
      `${scopeLabel} | Inadimplencia media (${records.length} clientes)`,
      consistencyHtml + html
    );
    renderSimplePieChart("inadimplenciaPieChart", [
      { label: "Pagam em dia", count: buckets.emDia },
      { label: "Atrasam 1 semana", count: buckets.umaSemana },
      { label: "Atrasam mais de 2 semanas", count: buckets.maisDeDuas },
    ]);
  }
}

function requireLoggedArea() {
  if (enforceMaintenanceAndDailyRoutines()) return;
  const session = getSession();
  if (session && session.tipo === "admin") {
    renderAdminDashboard();
    return;
  }
  if (session && session.contrato) {
    renderDashboard(session);
    return;
  }
  showGroupHome();
}

loginClienteForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (enforceMaintenanceAndDailyRoutines()) return;
  const formData = new FormData(loginClienteForm);
  const cpf = onlyDigits(String(formData.get("cpf") || ""));
  const senha = String(formData.get("senha") || "").trim();

  const cliente = findCliente(cpf, senha);
  if (!cliente) {
    showMessage(loginClienteMessage, "CPF ou senha de cliente invalidos.", "error");
    return;
  }

  saveSession(cliente);
  showMessage(loginClienteMessage, "Cliente autenticado com sucesso.", "success");
  renderDashboard(cliente);
});

loginAdminForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (enforceMaintenanceAndDailyRoutines()) return;
  const formData = new FormData(loginAdminForm);
  const cpf = onlyDigits(String(formData.get("cpf") || ""));
  const senha = String(formData.get("senha") || "").trim();

  const funcionario = funcionariosAccess.find(
    (f) => f.cpf === cpf && f.senha === senha
  );
  if (!funcionario) {
    showMessage(loginAdminMessage, "CPF ou senha de funcionário invalidos.", "error");
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
  showMessage(loginAdminMessage, "Funcionário autenticado com sucesso.", "success");
  renderAdminDashboard();
});

logoutButton.addEventListener("click", () => {
  clearSession();
  loginClienteForm.reset();
  loginAdminForm.reset();
  dashboardCard.classList.add("hidden");
  adminCard.classList.add("hidden");
  loginArea.classList.remove("hidden");
  showMessage(loginClienteMessage, "", "");
  showMessage(loginAdminMessage, "", "");
  showLocadoraArea();
});

adminLogoutButton.addEventListener("click", () => {
  clearSession();
  loginClienteForm.reset();
  loginAdminForm.reset();
  dashboardCard.classList.add("hidden");
  adminCard.classList.add("hidden");
  loginArea.classList.remove("hidden");
  showMessage(loginClienteMessage, "", "");
  showMessage(loginAdminMessage, "", "");
  showLocadoraArea();
});

openLocadoraButton.addEventListener("click", () => {
  showLocadoraArea();
  loginArea.classList.remove("hidden");
  dashboardCard.classList.add("hidden");
  adminCard.classList.add("hidden");
});

openCentroButton.addEventListener("click", () => {
  showCentroArea();
});

backToGroupFromLocadora.addEventListener("click", () => {
  clearSession();
  loginClienteForm.reset();
  loginAdminForm.reset();
  loginArea.classList.remove("hidden");
  dashboardCard.classList.add("hidden");
  adminCard.classList.add("hidden");
  showMessage(loginClienteMessage, "", "");
  showMessage(loginAdminMessage, "", "");
  showGroupHome();
});

backToGroupFromCentro.addEventListener("click", () => {
  showGroupHome();
});

adminNavOperacao.addEventListener("click", () => {
  setAdminSection("operacao");
  setOperacaoSubsection(operacaoAbaAtual || "cliente");
});

adminNavInformacao.addEventListener("click", () => {
  const session = getSession();
  if (session?.role !== "owner") {
    setAdminSection("operacao");
    return;
  }
  setAdminSection("informacao");
  if (!informacaoEscopoAtual) setInformacaoScope("todos");
});

adminNavDados.addEventListener("click", () => {
  const session = getSession();
  if (session?.role !== "owner") {
    setAdminSection("operacao");
    return;
  }
  setAdminSection("dados");
});

operacaoTargetButtons.forEach((button) => {
  button.addEventListener("click", () => {
    setAdminSection("operacao");
    setOperacaoSubsection(button.dataset.target || "cliente");
  });
});

if (infoScopeAtivosBtn) {
  infoScopeAtivosBtn.addEventListener("click", () => {
    setAdminSection("informacao");
    setInformacaoScope("ativos");
  });
}

if (infoScopeInativosBtn) {
  infoScopeInativosBtn.addEventListener("click", () => {
    setAdminSection("informacao");
    setInformacaoScope("inativos");
  });
}

if (infoScopeTodosBtn) {
  infoScopeTodosBtn.addEventListener("click", () => {
    setAdminSection("informacao");
    setInformacaoScope("todos");
  });
}

if (infoScopeCaixaBtn) {
  infoScopeCaixaBtn.addEventListener("click", () => {
    setAdminSection("informacao");
    setInformacaoScope("caixa");
  });
}

if (cadFuncionarioClearBtn) {
  cadFuncionarioClearBtn.addEventListener("click", () => {
    if (funcionarioCadastroForm) funcionarioCadastroForm.reset();
    if (funcionarioCadastroErro) {
      funcionarioCadastroErro.textContent = "";
      funcionarioCadastroErro.classList.add("hidden");
    }
  });
}

if (funcionarioCadastroForm) {
  funcionarioCadastroForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const session = getSession();
    if (session?.tipo !== "admin" || session?.role !== "owner") {
      if (funcionarioCadastroErro) {
        funcionarioCadastroErro.textContent = "ACESSO NEGADO: APENAS TITULAR PODE CADASTRAR FUNCIONARIO.";
        funcionarioCadastroErro.classList.remove("hidden");
      }
      return;
    }
    const cpf = onlyDigits(String(cadFuncionarioCpf?.value || ""));
    const nome = String(cadFuncionarioNome?.value || "").trim();
    const senha = String(cadFuncionarioSenha?.value || "").trim();
    const role = String(cadFuncionarioRole?.value || "operacao").trim() === "owner" ? "owner" : "operacao";
    if (cpf.length !== 11 || !nome || senha.length < 4) {
      if (funcionarioCadastroErro) {
        funcionarioCadastroErro.textContent =
          "PREENCHA CPF VALIDO (11 DIGITOS), NOME E SENHA COM PELO MENOS 4 CARACTERES.";
        funcionarioCadastroErro.classList.remove("hidden");
      }
      return;
    }
    const existe = funcionariosAccess.some((f) => onlyDigits(String(f.cpf || "")) === cpf);
    if (existe) {
      if (funcionarioCadastroErro) {
        funcionarioCadastroErro.textContent = "JA EXISTE FUNCIONARIO CADASTRADO COM ESTE CPF.";
        funcionarioCadastroErro.classList.remove("hidden");
      }
      return;
    }
    funcionariosAccess.push({ cpf, senha, nome, role });
    saveFuncionariosAccess();
    addAuditLog("cadastrar_funcionario", "funcionario", `${nome} - CPF ${formatCpf(cpf)} - PERFIL ${role}`);
    if (funcionarioCadastroForm) funcionarioCadastroForm.reset();
    if (funcionarioCadastroErro) {
      funcionarioCadastroErro.textContent = "";
      funcionarioCadastroErro.classList.add("hidden");
    }
    window.alert("FUNCIONARIO CADASTRADO COM SUCESSO");
    renderCadastros();
  });
}

clienteCadastroForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (clienteEmEdicaoId !== null) {
    clienteCadastroErro.textContent = "CLIQUE EM ATUALIZAR PARA ALTERAR ESTE CLIENTE";
    clienteCadastroErro.classList.remove("hidden");
    return;
  }
  const codigo = nextClienteCodigo();
  const dataCadastro = String(document.getElementById("cadClienteDataCadastro").value || "").trim();
  const cpf = onlyDigits(String(document.getElementById("cadClienteCpf").value || ""));
  const nome = String(document.getElementById("cadClienteNome").value || "").trim();
  const celular = String(document.getElementById("cadClienteCelular").value || "").trim();
  const recado1 = String(document.getElementById("cadClienteRecado1").value || "").trim();
  const recado2 = String(document.getElementById("cadClienteRecado2").value || "").trim();
  const cnh = String(document.getElementById("cadClienteCnh").value || "").trim();
  const categoria = String(document.getElementById("cadClienteCategoria").value || "").trim();
  const vencimento = String(document.getElementById("cadClienteVencimento").value || "").trim();
  const ear = String(document.getElementById("cadClienteEar").value || "").trim();
  const cep = String(document.getElementById("cadClienteCep").value || "").trim();
  const municipioUf = String(document.getElementById("cadClienteMunicipioUf").value || "").trim();
  const endereco = String(document.getElementById("cadClienteEndereco").value || "").trim();
  if (!nome || !cpf) return;

  const clientes = loadCadastro(CAD_CLIENTES_KEY);
  const duplicado = clientes.find(
    (c) => onlyDigits(String(c.cpf || "")) === cpf
  );
  if (duplicado) {
    entrarModoAtualizacaoCliente(duplicado);
    return;
  }
  const confirmado = await askClienteCadastroConfirmation({
    cpf,
    nome,
    celular,
    recado1,
    recado2,
    cnh,
    categoria,
    vencimento,
    ear,
    cep,
    municipioUf,
    endereco,
  });
  if (!confirmado) return;
  clientes.push({
    id: Date.now(),
    codigo,
    dataCadastro,
    cpf,
    nome,
    celular,
    recado1,
    recado2,
    cnh,
    categoria,
    vencimento,
    ear,
    cep,
    municipioUf,
    endereco,
  });
  saveCadastro(CAD_CLIENTES_KEY, clientes);
  addAuditLog("cadastrar_cliente", "cliente", `${nome} - CPF ${formatCpf(cpf)}`);
  window.alert("CLIENTE CADASTRADO COM SUCESSO");
  clienteCadastroForm.reset();
  sairModoAtualizacaoCliente();
  renderCadastros();
});

cadClienteCpfInput.addEventListener("blur", () => {
  const cpf = onlyDigits(String(cadClienteCpfInput.value || ""));
  cadClienteCpfInput.value = formatCpf(cpf);
  refreshClienteCodigoByCpf(cpf);
  if (!cpf) {
    if (clienteEmEdicaoId !== null) sairModoAtualizacaoCliente();
    return;
  }
  const existente = findClienteByCpfCadastro(cpf);
  if (existente && existente.id !== clienteEmEdicaoId) {
    entrarModoAtualizacaoCliente(existente);
  } else if (!existente && clienteEmEdicaoId !== null) {
    sairModoAtualizacaoCliente();
  }
});

cadClienteCpfInput.addEventListener("input", () => {
  const cpf = onlyDigits(String(cadClienteCpfInput.value || ""));
  cadClienteCpfInput.value = formatCpf(cpf);
  refreshClienteCodigoByCpf(cpf);
  if (cpf.length < 11) return;
  const existente = findClienteByCpfCadastro(cpf);
  if (existente && existente.id !== clienteEmEdicaoId) {
    entrarModoAtualizacaoCliente(existente);
  }
});

cadClienteUpdateBtn.addEventListener("click", () => {
  if (clienteEmEdicaoId === null) return;
  if (!clienteEdicaoAutorizada) {
    clienteAcaoSenhaPendente = "editar";
    clienteSenhaWrap.classList.remove("hidden");
    cadClienteAdminSenha.value = "";
    cadClienteAdminSenha.focus();
    return;
  }

  const codigo = String(document.getElementById("cadClienteCodigo").value || "").trim();
  const dataCadastro = String(document.getElementById("cadClienteDataCadastro").value || "").trim();
  const cpf = onlyDigits(String(document.getElementById("cadClienteCpf").value || ""));
  const nome = String(document.getElementById("cadClienteNome").value || "").trim();
  const celular = String(document.getElementById("cadClienteCelular").value || "").trim();
  const recado1 = String(document.getElementById("cadClienteRecado1").value || "").trim();
  const recado2 = String(document.getElementById("cadClienteRecado2").value || "").trim();
  const cnh = String(document.getElementById("cadClienteCnh").value || "").trim();
  const categoria = String(document.getElementById("cadClienteCategoria").value || "").trim();
  const vencimento = String(document.getElementById("cadClienteVencimento").value || "").trim();
  const ear = String(document.getElementById("cadClienteEar").value || "").trim();
  const cep = String(document.getElementById("cadClienteCep").value || "").trim();
  const municipioUf = String(document.getElementById("cadClienteMunicipioUf").value || "").trim();
  const endereco = String(document.getElementById("cadClienteEndereco").value || "").trim();
  if (!nome || !cpf) return;

  const clientes = loadCadastro(CAD_CLIENTES_KEY);
  const cpfDuplicado = clientes.find(
    (c) => c.id !== clienteEmEdicaoId && onlyDigits(String(c.cpf || "")) === cpf
  );
  if (cpfDuplicado) {
    clienteCadastroErro.textContent = "CPF JA CADASTRADO";
    clienteCadastroErro.classList.remove("hidden");
    return;
  }
  const idx = clientes.findIndex((c) => c.id === clienteEmEdicaoId);
  if (idx === -1) return;
  clientes[idx] = {
    ...clientes[idx],
    codigo,
    dataCadastro,
    cpf,
    nome,
    celular,
    recado1,
    recado2,
    cnh,
    categoria,
    vencimento,
    ear,
    cep,
    municipioUf,
    endereco,
  };
  saveCadastro(CAD_CLIENTES_KEY, clientes);
  addAuditLog("atualizar_cliente", "cliente", `${nome} - CPF ${formatCpf(cpf)}`);
  clienteCadastroForm.reset();
  sairModoAtualizacaoCliente();
  renderCadastros();
});

cadClienteCancelBtn.addEventListener("click", () => {
  if (clienteEmEdicaoId === null) return;
  clienteCancelOpcoes.classList.toggle("hidden");
});

function iniciarCancelamentoCliente(motivo) {
  if (clienteEmEdicaoId === null) return;
  clienteCancelMotivoPendente = motivo;
  clienteAcaoSenhaPendente = "cancelar";
  clienteSenhaWrap.classList.remove("hidden");
  cadClienteAdminSenha.value = "";
  cadClienteAdminSenha.focus();
}

function iniciarExclusaoCliente() {
  if (clienteEmEdicaoId === null) return;
  const cpf = onlyDigits(String(document.getElementById("cadClienteCpf").value || ""));
  const nome = String(document.getElementById("cadClienteNome").value || "").trim();
  if (cpf.length !== 11) return;
  if (clienteTemVinculoComLocacao(cpf)) {
    clienteCadastroErro.textContent =
      "NAO E POSSIVEL EXCLUIR: CLIENTE POSSUI VINCULO COM LOCACAO (ATUAL OU HISTORICA).";
    clienteCadastroErro.classList.remove("hidden");
    return;
  }
  const confirmado = window.confirm(
    `Confirma excluir definitivamente o cliente ${nome || "selecionado"} (${formatCpf(cpf)})?`
  );
  if (!confirmado) return;
  clienteAcaoSenhaPendente = "excluir";
  clienteSenhaWrap.classList.remove("hidden");
  cadClienteAdminSenha.value = "";
  cadClienteAdminSenha.focus();
}

cancelarClienteQuebraBtn.addEventListener("click", () =>
  iniciarCancelamentoCliente("QUEBRA DE CONTRATO")
);
cancelarClienteNegativadoBtn.addEventListener("click", () =>
  iniciarCancelamentoCliente("CADASTRO NAO APROVADO")
);

cadClienteSenhaConfirmarBtn.addEventListener("click", () => {
  if (clienteEmEdicaoId === null) return;
  const senha = String(cadClienteAdminSenha.value || "").trim();
  const exigeSenhaOwner =
    clienteAcaoSenhaPendente === "cancelar" ||
    clienteAcaoSenhaPendente === "desbloquear";
  const senhaValida = exigeSenhaOwner
    ? isSenhaOwnerValida(senha)
    : isSenhaFuncionarioAtualValida(senha);
  if (!senhaValida) {
    clienteCadastroErro.textContent = "SENHA DE ADMINISTRADOR INVALIDA";
    clienteCadastroErro.classList.remove("hidden");
    return;
  }

  clienteSenhaWrap.classList.add("hidden");
  cadClienteAdminSenha.value = "";
  if (clienteAcaoSenhaPendente === "cancelar") {
    const clientes = loadCadastro(CAD_CLIENTES_KEY);
    const idx = clientes.findIndex((c) => c.id === clienteEmEdicaoId);
    if (idx === -1) return;
    clientes[idx] = {
      ...clientes[idx],
      status: clienteCancelMotivoPendente,
      statusDesde: new Date().toISOString(),
      statusPor: getCurrentUserLabel(),
    };
    saveCadastro(CAD_CLIENTES_KEY, clientes);
    addAuditLog(
      "cancelar_cliente",
      "cliente",
      `${clientes[idx].nome} - ${clienteCancelMotivoPendente}`
    );
    clienteCadastroForm.reset();
    sairModoAtualizacaoCliente();
    renderCadastros();
    return;
  }

  if (clienteAcaoSenhaPendente === "desbloquear") {
    const clientes = loadCadastro(CAD_CLIENTES_KEY);
    const idx = clientes.findIndex((c) => c.id === clienteEmEdicaoId);
    if (idx === -1) return;
    clientes[idx] = {
      ...clientes[idx],
      status: "ATIVO",
      statusDesde: new Date().toISOString(),
      statusPor: getCurrentUserLabel(),
    };
    saveCadastro(CAD_CLIENTES_KEY, clientes);
    addAuditLog(
      "desbloquear_cliente",
      "cliente",
      `${clientes[idx].nome} - CPF ${formatCpf(clientes[idx].cpf)}`
    );
    clienteCadastroForm.reset();
    sairModoAtualizacaoCliente();
    renderCadastros();
    return;
  }

  if (clienteAcaoSenhaPendente === "excluir") {
    const clientes = loadCadastro(CAD_CLIENTES_KEY);
    const idx = clientes.findIndex((c) => c.id === clienteEmEdicaoId);
    if (idx === -1) return;
    const alvo = clientes[idx];
    const cpfAlvo = onlyDigits(String(alvo.cpf || ""));
    if (clienteTemVinculoComLocacao(cpfAlvo)) {
      clienteCadastroErro.textContent =
        "NAO E POSSIVEL EXCLUIR: CLIENTE POSSUI VINCULO COM LOCACAO (ATUAL OU HISTORICA).";
      clienteCadastroErro.classList.remove("hidden");
      return;
    }
    clientes.splice(idx, 1);
    saveCadastro(CAD_CLIENTES_KEY, clientes);
    addAuditLog(
      "excluir_cliente",
      "cliente",
      `${alvo.nome || "Nao informado"} - CPF ${formatCpf(cpfAlvo)}`
    );
    clienteCadastroForm.reset();
    sairModoAtualizacaoCliente();
    renderCadastros();
    return;
  }

  liberarEdicaoCliente();
});

cadClienteSenhaCancelarBtn.addEventListener("click", () => {
  clienteSenhaWrap.classList.add("hidden");
  cadClienteAdminSenha.value = "";
  clienteAcaoSenhaPendente = "";
  clienteCancelMotivoPendente = "";
});

cadClienteClearBtn.addEventListener("click", () => {
  clienteCadastroForm.reset();
  sairModoAtualizacaoCliente();
});

cadClienteUnblockBtn.addEventListener("click", () => {
  if (clienteEmEdicaoId === null) return;
  clienteAcaoSenhaPendente = "desbloquear";
  clienteSenhaWrap.classList.remove("hidden");
  cadClienteAdminSenha.value = "";
  cadClienteAdminSenha.focus();
  clienteCadastroErro.textContent =
    "DIGITE A SENHA DO CPF 03037897430 PARA DESBLOQUEAR O CLIENTE";
  clienteCadastroErro.classList.remove("hidden");
});

cadClienteDeleteBtn.addEventListener("click", () => {
  iniciarExclusaoCliente();
});

veiculoCadastroForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (veiculoEmEdicaoId !== null) {
    veiculoCadastroErro.textContent = "CLIQUE EM ATUALIZAR PARA ALTERAR ESTE VEICULO";
    veiculoCadastroErro.classList.remove("hidden");
    return;
  }
  if (!validateVeiculoUniqueRealtime()) return;
  const tipo = String(document.getElementById("cadVeiculoTipo").value || "").trim();
  const placa = String(document.getElementById("cadVeiculoPlaca").value || "")
    .trim()
    .toUpperCase();
  const marca = String(document.getElementById("cadVeiculoMarca").value || "").trim();
  const modelo = String(document.getElementById("cadVeiculoModelo").value || "").trim();
  const valor = String(document.getElementById("cadVeiculoValor").value || "").trim();
  const cor = String(document.getElementById("cadVeiculoCor").value || "").trim();
  const chassi = String(document.getElementById("cadVeiculoChassi").value || "").trim();
  const anoModelo = String(document.getElementById("cadVeiculoAnoModelo").value || "").trim();
  const renavam = String(document.getElementById("cadVeiculoRenavam").value || "").trim();
  const motor = String(document.getElementById("cadVeiculoMotor").value || "").trim();
  if (!tipo || !placa || !modelo) return;

  const veiculos = loadCadastro(CAD_VEICULOS_KEY);
  if (hasEquipamentoDuplicado(veiculos, placa, chassi, renavam, motor)) {
    veiculoCadastroErro.classList.remove("hidden");
    return;
  }
  const tag = nextTagByTipo(tipo, veiculos);
  const confirmado = await askVeiculoCadastroConfirmation({
    tipo,
    placa,
    tag,
    marca,
    modelo,
    valor,
    cor,
    chassi,
    anoModelo,
    renavam,
    motor,
  });
  if (!confirmado) return;
  veiculos.push({
    id: Date.now(),
    tipo,
    tag,
    placa,
    marca,
    modelo,
    valor,
    cor,
    chassi,
    anoModelo,
    renavam,
    motor,
    status: "DISPONIVEL",
  });
  saveCadastro(CAD_VEICULOS_KEY, veiculos);
  addAuditLog("cadastrar_veiculo", "veiculo", `${placa} - ${modelo}`);
  window.alert("VEÍCULO CADASTRADO COM SUCESSO");
  veiculoCadastroForm.reset();
  cadVeiculoTagPreviewInput.value = "";
  veiculoCadastroErro.classList.add("hidden");
  sairModoAtualizacao();
  renderCadastros();
});

cadVeiculoUpdateBtn.addEventListener("click", () => {
  if (veiculoEmEdicaoId === null) return;
  if (!veiculoEdicaoAutorizada) {
    veiculoAcaoSenhaPendente = "editar";
    veiculoSenhaWrap.classList.remove("hidden");
    cadVeiculoAdminSenha.value = "";
    cadVeiculoAdminSenha.focus();
    veiculoCadastroErro.textContent = "DIGITE A SENHA DO ADMINISTRADOR";
    veiculoCadastroErro.classList.remove("hidden");
    return;
  }

  const tipo = String(document.getElementById("cadVeiculoTipo").value || "").trim();
  const placa = String(document.getElementById("cadVeiculoPlaca").value || "")
    .trim()
    .toUpperCase();
  const marca = String(document.getElementById("cadVeiculoMarca").value || "").trim();
  const modelo = String(document.getElementById("cadVeiculoModelo").value || "").trim();
  const valor = String(document.getElementById("cadVeiculoValor").value || "").trim();
  const cor = String(document.getElementById("cadVeiculoCor").value || "").trim();
  const chassi = String(document.getElementById("cadVeiculoChassi").value || "").trim();
  const anoModelo = String(document.getElementById("cadVeiculoAnoModelo").value || "").trim();
  const renavam = String(document.getElementById("cadVeiculoRenavam").value || "").trim();
  const motor = String(document.getElementById("cadVeiculoMotor").value || "").trim();
  if (!tipo || !placa || !modelo) return;

  const veiculos = loadCadastro(CAD_VEICULOS_KEY);
  if (hasEquipamentoDuplicado(veiculos, "", chassi, renavam, motor, veiculoEmEdicaoId)) {
    veiculoCadastroErro.textContent = "EQUIPAMENTO JA CADASTRADO";
    veiculoCadastroErro.classList.remove("hidden");
    return;
  }

  const idx = veiculos.findIndex((v) => v.id === veiculoEmEdicaoId);
  if (idx === -1) return;
  veiculos[idx] = {
    ...veiculos[idx],
    tipo,
    placa,
    marca,
    modelo,
    valor,
    cor,
    chassi,
    anoModelo,
    renavam,
    motor,
  };
  saveCadastro(CAD_VEICULOS_KEY, veiculos);
  addAuditLog("atualizar_veiculo", "veiculo", `${placa} - ${modelo}`);
  veiculoCadastroForm.reset();
  veiculoCadastroErro.classList.add("hidden");
  sairModoAtualizacao();
  renderCadastros();
});

cadVeiculoCancelBtn.addEventListener("click", () => {
  if (veiculoEmEdicaoId === null) return;
  veiculoCancelOpcoes.classList.toggle("hidden");
});

function iniciarCancelamentoVeiculo(motivo) {
  if (veiculoEmEdicaoId === null) return;
  veiculoCancelMotivoPendente = motivo;
  veiculoAcaoSenhaPendente = "cancelar";
  veiculoSenhaWrap.classList.remove("hidden");
  cadVeiculoAdminSenha.value = "";
  cadVeiculoAdminSenha.focus();
  veiculoCadastroErro.textContent = `DIGITE A SENHA DO ADMINISTRADOR PARA CANCELAR POR ${motivo.toUpperCase()}`;
  veiculoCadastroErro.classList.remove("hidden");
}

cancelarPorVendaBtn.addEventListener("click", () => iniciarCancelamentoVeiculo("venda"));
cancelarPorSinistroBtn.addEventListener("click", () => iniciarCancelamentoVeiculo("sinistro"));
cancelarPorRouboBtn.addEventListener("click", () => iniciarCancelamentoVeiculo("roubo"));

cadVeiculoSenhaConfirmarBtn.addEventListener("click", () => {
  if (veiculoEmEdicaoId === null) return;
  const senha = String(cadVeiculoAdminSenha.value || "").trim();
  if (!isSenhaFuncionarioAtualValida(senha)) {
    veiculoCadastroErro.textContent = "SENHA DE ADMINISTRADOR INVALIDA";
    veiculoCadastroErro.classList.remove("hidden");
    return;
  }
  veiculoSenhaWrap.classList.add("hidden");
  cadVeiculoAdminSenha.value = "";
  if (veiculoAcaoSenhaPendente === "cancelar") {
    cancelarVeiculoSelecionado(veiculoCancelMotivoPendente || "venda");
    return;
  }
  liberarEdicaoVeiculo();
  veiculoCadastroErro.textContent = "EDICAO LIBERADA. ALTERE OS DADOS E CLIQUE EM SALVAR ATUALIZACAO";
  veiculoCadastroErro.classList.remove("hidden");
});

cadVeiculoSenhaCancelarBtn.addEventListener("click", () => {
  veiculoSenhaWrap.classList.add("hidden");
  cadVeiculoAdminSenha.value = "";
  veiculoAcaoSenhaPendente = "";
  veiculoCancelMotivoPendente = "";
});

cadVeiculoClearBtn.addEventListener("click", () => {
  veiculoCadastroForm.reset();
  cadVeiculoTagPreviewInput.value = "";
  sairModoAtualizacao();
});

document.getElementById("cadVeiculoTipo").addEventListener("change", refreshTagPreview);
cadVeiculoPlacaInput.addEventListener("input", refreshTagPreview);

[
  cadVeiculoPlacaInput,
  cadVeiculoChassiInput,
  cadVeiculoRenavamInput,
  cadVeiculoMotorInput,
].forEach((field) => {
  field.addEventListener("blur", validateVeiculoUniqueRealtime);
  field.addEventListener("input", validateVeiculoUniqueRealtime);
});

gerarRelatorioClienteBtn.addEventListener("click", () => {
  relatorioClienteOpcoes.classList.toggle("hidden");
});

relatorioClientePdfBtn.addEventListener("click", () => {
  exportClientesPdf();
});

relatorioClienteExcelBtn.addEventListener("click", () => {
  exportClientesExcel();
});

gerarRelatorioVeiculoBtn.addEventListener("click", () => {
  relatorioVeiculoOpcoes.classList.toggle("hidden");
});

relatorioVeiculoPdfBtn.addEventListener("click", () => {
  exportVeiculosPdf();
});

relatorioVeiculoExcelBtn.addEventListener("click", () => {
  exportVeiculosExcel();
});

gerarRelatorioLocacaoBtn.addEventListener("click", () => {
  relatorioLocacaoOpcoes.classList.toggle("hidden");
  if (relatorioLocacaoOpcoes.classList.contains("hidden")) {
    relatorioLocacaoFormatos.classList.add("hidden");
    relatorioLocacaoTipoSelecionado = "";
    return;
  }
  if (!relatorioLocacaoTipoSelecionado) {
    relatorioLocacaoFormatos.classList.add("hidden");
  }
});

relatorioLocadosBtn.addEventListener("click", () => {
  relatorioLocacaoTipoSelecionado = "locados";
  renderRelatorioLocacao("locados");
  relatorioLocacaoFormatos.classList.remove("hidden");
});

relatorioDisponiveisBtn.addEventListener("click", () => {
  relatorioLocacaoTipoSelecionado = "disponiveis";
  renderRelatorioLocacao("disponiveis");
  relatorioLocacaoFormatos.classList.remove("hidden");
});

relatorioLocacaoTelaBtn.addEventListener("click", () => {
  if (!relatorioLocacaoTipoSelecionado) return;
  renderRelatorioLocacao(relatorioLocacaoTipoSelecionado);
});

relatorioLocacaoPdfBtn.addEventListener("click", () => {
  if (!relatorioLocacaoCache && relatorioLocacaoTipoSelecionado) {
    renderRelatorioLocacao(relatorioLocacaoTipoSelecionado);
  }
  exportRelatorioPdfFromCache(relatorioLocacaoCache);
});

relatorioLocacaoExcelBtn.addEventListener("click", () => {
  if (!relatorioLocacaoCache && relatorioLocacaoTipoSelecionado) {
    renderRelatorioLocacao(relatorioLocacaoTipoSelecionado);
  }
  const file =
    relatorioLocacaoTipoSelecionado === "locados"
      ? "relatorio-veiculos-locados.csv"
      : "relatorio-veiculos-disponiveis.csv";
  exportRelatorioExcelFromCache(relatorioLocacaoCache, file);
});

gerarDadosUsoPdfBtn.addEventListener("click", () => {
  dadosUsoAcaoPendente = "pdf";
  dadosUsoSenhaWrap.classList.remove("hidden");
  dadosUsoAdminSenha.value = "";
  dadosUsoAdminSenha.focus();
});

if (exportDadosBackupBtn) {
  exportDadosBackupBtn.addEventListener("click", () => {
    dadosUsoAcaoPendente = "backup_export";
    dadosUsoSenhaWrap.classList.remove("hidden");
    dadosUsoAdminSenha.value = "";
    dadosUsoAdminSenha.focus();
  });
}

if (importDadosBackupBtn) {
  importDadosBackupBtn.addEventListener("click", () => {
    dadosUsoAcaoPendente = "backup_import";
    dadosUsoSenhaWrap.classList.remove("hidden");
    dadosUsoAdminSenha.value = "";
    dadosUsoAdminSenha.focus();
  });
}

dadosUsoSenhaConfirmarBtn.addEventListener("click", () => {
  const senha = String(dadosUsoAdminSenha.value || "").trim();
  const session = getSession();
  if (session?.role !== "owner" || !isSenhaFuncionarioAtualValida(senha)) {
    renderAdminResult(
      "03 - Dados de utilizacao",
      "<p><strong>SENHA DE ADMINISTRADOR INVALIDA</strong></p>"
    );
    return;
  }
  dadosUsoSenhaWrap.classList.add("hidden");
  dadosUsoAdminSenha.value = "";
  if (dadosUsoAcaoPendente === "backup_export") {
    const payload = buildOperationalBackupPayload();
    downloadJsonFile(backupFileName(), payload);
    addAuditLog("exportar_backup_dados", "backup_localstorage", `Registros: ${Object.keys(payload.data || {}).length}`);
    renderAdminResult(
      "03 - Dados de utilizacao",
      "<p><strong>Backup exportado com sucesso.</strong> Salve o JSON no Drive antes de atualizar o sistema.</p>"
    );
    dadosUsoAcaoPendente = "";
    return;
  }
  if (dadosUsoAcaoPendente === "backup_import") {
    if (importDadosBackupInput) {
      importDadosBackupInput.value = "";
      importDadosBackupInput.click();
    }
    dadosUsoAcaoPendente = "";
    return;
  }
  exportAuditLogPdf();
  dadosUsoAcaoPendente = "";
});

dadosUsoSenhaCancelarBtn.addEventListener("click", () => {
  dadosUsoSenhaWrap.classList.add("hidden");
  dadosUsoAdminSenha.value = "";
  dadosUsoAcaoPendente = "";
});

if (importDadosBackupInput) {
  importDadosBackupInput.addEventListener("change", async (event) => {
    const file = event?.target?.files?.[0];
    if (!file) return;
    try {
      const raw = await file.text();
      const parsed = JSON.parse(raw);
      applyOperationalBackupPayload(parsed);
      addAuditLog("importar_backup_dados", "backup_localstorage", `Arquivo: ${file.name}`);
      renderAdminResult(
        "03 - Dados de utilizacao",
        `<p><strong>Backup restaurado com sucesso.</strong> Arquivo aplicado: ${escapeHtml(file.name)}.</p>
         <p>Recarregue a página para sincronizar a interface com os dados restaurados.</p>`
      );
    } catch {
      renderAdminResult(
        "03 - Dados de utilizacao",
        "<p><strong>Falha ao restaurar backup.</strong> Use um arquivo JSON gerado pela exportacao do proprio sistema.</p>"
      );
    } finally {
      importDadosBackupInput.value = "";
    }
  });
}

if (lancamentoAluguelForm) {
  lancamentoAluguelForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const placa = String(lancAluguelPlacaInput?.value || "")
      .trim()
      .toUpperCase();
    const cpf = onlyDigits(String(lancAluguelCpfInput?.value || ""));
    const diaPagamento = String(lancAluguelDiaPagamentoInput?.value || "").trim().toUpperCase();
    const valorPagoRaw = String(lancAluguelValorPagoInput?.value || "").trim();
    const valorPago = parseCurrencyBR(valorPagoRaw);
    const semanaInicio = String(lancAluguelSemanaInicioInput?.value || "").trim();
    const semanaFim = String(lancAluguelSemanaFimInput?.value || "").trim();
    if (!placa || cpf.length !== 11 || !diaPagamento || !semanaInicio || !semanaFim || valorPago <= 0) {
      if (lancamentoAluguelErro) {
        lancamentoAluguelErro.textContent = "PREENCHA TODOS OS CAMPOS OBRIGATORIOS E INFORME O VALOR PAGO.";
        lancamentoAluguelErro.classList.remove("hidden");
      }
      return;
    }
    const dIni = parseBrDate(semanaInicio);
    const dFim = parseBrDate(semanaFim);
    if (!dIni || !dFim) {
      if (lancamentoAluguelErro) {
        lancamentoAluguelErro.textContent = "INFORME DATAS VALIDAS NO PADRAO DD/MM/AAAA.";
        lancamentoAluguelErro.classList.remove("hidden");
      }
      return;
    }
    const diasSemana = diffDays(dIni, dFim);
    if (diasSemana !== 6 && diasSemana !== 7) {
      if (lancamentoAluguelErro) {
        lancamentoAluguelErro.textContent =
          "A SEMANA DE REFERENCIA DEVE TER 7 DIAS (INICIO E FIM DA MESMA SEMANA).";
        lancamentoAluguelErro.classList.remove("hidden");
      }
      return;
    }
    const lancamentos = getLancamentosAluguel();
    const codigoLancamento = nextLancamentoAluguelCode(cpf, lancamentos);
    const confirmado = await askLancamentoAluguelConfirmation({
      codigoLancamento,
      placa,
      cpf,
      diaPagamento,
      valorPago,
      semanaInicio,
      semanaFim,
    });
    if (!confirmado) return;

    const id = Date.now();
    lancamentos.push({
      id,
      createdAt: id,
      codigoLancamento,
      placa,
      cpf,
      diaPagamento,
      valorPago,
      semanaInicio,
      semanaFim,
      status: "ATIVO",
    });
    saveCadastro(CAD_LANCAMENTOS_ALUGUEL_KEY, lancamentos);
    processPendingLancamentosAluguelBaixa();
    addAuditLog("cadastrar_lancamento_aluguel", "lancamento_aluguel", `${codigoLancamento} - ${placa}`);
    window.alert("LANCAMENTO SALVO COM SUCESSO");
    lancamentoAluguelForm.reset();
    if (lancAluguelSemanaInicioInput) lancAluguelSemanaInicioInput.dataset.autoSuggested = "0";
    if (lancAluguelValorPagoInput) lancAluguelValorPagoInput.dataset.autoSuggested = "0";
    if (lancamentoAluguelErro) {
      lancamentoAluguelErro.textContent = "";
      lancamentoAluguelErro.classList.add("hidden");
    }
    renderCadastros();
  });
}

if (lancAluguelCpfInput) {
  lancAluguelCpfInput.addEventListener("input", () => {
    const cpf = onlyDigits(String(lancAluguelCpfInput.value || ""));
    lancAluguelCpfInput.value = formatCpf(cpf);
    if (cpf.length === 11) {
      const cli = findClienteByCpfCadastro(cpf);
      if (cli && lancAluguelClienteNomeInput) lancAluguelClienteNomeInput.value = String(cli.nome || "").trim();
      autoFillLancamentoFromCpf(cpf);
      renderLancamentoAluguelResumo();
    }
  });
  lancAluguelCpfInput.addEventListener("blur", () => {
    const cpf = onlyDigits(String(lancAluguelCpfInput.value || ""));
    lancAluguelCpfInput.value = formatCpf(cpf);
    autoFillLancamentoFromCpf(cpf);
    prefillLancamentoAluguelByCpf(cpf);
    suggestValorPagoFromContrato();
    suggestSemanaInicioFromDiaPagamento();
    renderLancamentoAluguelResumo();
  });
}

if (lancAluguelPlacaInput) {
  lancAluguelPlacaInput.addEventListener("input", () => {
    lancAluguelPlacaInput.value = String(lancAluguelPlacaInput.value || "").toUpperCase();
    autoFillLancamentoFromPlaca(lancAluguelPlacaInput.value);
    const cpf = onlyDigits(String(lancAluguelCpfInput?.value || ""));
    const cli = findClienteByCpfCadastro(cpf);
    if (cli && lancAluguelClienteNomeInput) lancAluguelClienteNomeInput.value = String(cli.nome || "").trim();
    renderLancamentoAluguelResumo();
  });
  lancAluguelPlacaInput.addEventListener("blur", () => {
    lancAluguelPlacaInput.value = String(lancAluguelPlacaInput.value || "").trim().toUpperCase();
    autoFillLancamentoFromPlaca(lancAluguelPlacaInput.value);
    suggestValorPagoFromContrato();
    renderLancamentoAluguelResumo();
  });
}

if (lancAluguelValorPagoInput) {
  lancAluguelValorPagoInput.addEventListener("input", () => {
    lancAluguelValorPagoInput.dataset.autoSuggested = "0";
    renderLancamentoAluguelResumo();
  });
  lancAluguelValorPagoInput.addEventListener("blur", () => {
    formatLancamentoValorPagoInput();
    renderLancamentoAluguelResumo();
  });
}

if (lancAluguelClienteNomeInput) {
  lancAluguelClienteNomeInput.addEventListener("input", () => {
    renderLancamentoClienteSugestoes(lancAluguelClienteNomeInput.value);
  });
  lancAluguelClienteNomeInput.addEventListener("change", () => {
    autoFillLancamentoByNome(lancAluguelClienteNomeInput.value);
  });
  lancAluguelClienteNomeInput.addEventListener("blur", () => {
    autoFillLancamentoByNome(lancAluguelClienteNomeInput.value);
  });
}

if (lancAluguelSemanaInicioInput) {
  lancAluguelSemanaInicioInput.addEventListener("input", () => {
    lancAluguelSemanaInicioInput.dataset.autoSuggested = "0";
  });
  lancAluguelSemanaInicioInput.addEventListener("blur", () => {
    autoFillSemanaFimFromInicio();
  });
}

if (lancAluguelDiaPagamentoInput) {
  lancAluguelDiaPagamentoInput.addEventListener("change", () => {
    suggestSemanaInicioFromDiaPagamento();
    renderLancamentoAluguelResumo();
  });
}

if (lancAluguelClearBtn) {
  lancAluguelClearBtn.addEventListener("click", () => {
    if (lancamentoAluguelForm) lancamentoAluguelForm.reset();
    if (lancAluguelClienteSugestoes) lancAluguelClienteSugestoes.innerHTML = "";
    if (lancAluguelSemanaInicioInput) lancAluguelSemanaInicioInput.dataset.autoSuggested = "0";
    if (lancAluguelValorPagoInput) lancAluguelValorPagoInput.dataset.autoSuggested = "0";
    if (lancamentoAluguelErro) {
      lancamentoAluguelErro.textContent = "";
      lancamentoAluguelErro.classList.add("hidden");
    }
    renderLancamentoAluguelResumo();
  });
}

if (lancAluguelDiagnosticoBtn) {
  lancAluguelDiagnosticoBtn.addEventListener("click", () => {
    renderLancamentoDiagnostico();
  });
}

if (cadastroLancamentoAluguelLista) {
  cadastroLancamentoAluguelLista.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (target.dataset.lancAluguelOpcoes) {
      event.preventDefault();
      const idToggle = String(target.dataset.lancAluguelOpcoes || "");
      cadastroLancamentoAluguelLista
        .querySelectorAll("[data-lanc-aluguel-opcoes-box]")
        .forEach((box) => {
          if (!(box instanceof HTMLElement)) return;
          const isCurrent = String(box.dataset.lancAluguelOpcoesBox || "") === idToggle;
          box.classList.toggle("hidden", !isCurrent || !box.classList.contains("hidden"));
        });
      return;
    }
    const id = Number(target.dataset.lancAluguelDelete || 0);
    if (!id) return;
    const senha = window.prompt("Digite a senha do administrador para apagar o lançamento:");
    if (!isSenhaFuncionarioAtualValida(senha) && !isSenhaOwnerValida(senha)) {
      window.alert("SENHA DE ADMINISTRADOR INVALIDA");
      return;
    }
    const lancamentos = getLancamentosAluguel();
    const idx = lancamentos.findIndex((l) => Number(l.id || 0) === id);
    if (idx < 0) return;
    const item = lancamentos[idx];
    const ok = window.confirm(
      `Confirma apagar o lançamento ${item.codigoLancamento || "-"} (${item.placa || "-"})?`
    );
    if (!ok) return;
    lancamentos.splice(idx, 1);
    saveCadastro(CAD_LANCAMENTOS_ALUGUEL_KEY, lancamentos);
    addAuditLog(
      "excluir_lancamento_aluguel",
      "lancamento_aluguel",
      `${item.codigoLancamento || "-"} - ${item.placa || "-"}`
    );
    window.alert("LANCAMENTO APAGADO COM SUCESSO");
    renderCadastros();
  });
}

locacaoCadastroForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!validateLocacaoCpfBlock()) return;
  const cpf = onlyDigits(String(document.getElementById("cadLocacaoCpf").value || ""));
  const placa = String(document.getElementById("cadLocacaoPlaca").value || "")
    .trim()
    .toUpperCase();
  const inicio = String(document.getElementById("cadLocacaoInicio").value || "").trim();
  const fim = String(document.getElementById("cadLocacaoFim").value || "").trim();
  const valorSemanal = String(document.getElementById("cadLocacaoValor").value || "").trim();
  const placaSelect = document.getElementById("cadLocacaoPlaca");
  const placaSelecionadaTexto =
    placaSelect && placaSelect.selectedIndex >= 0
      ? String(placaSelect.options[placaSelect.selectedIndex].textContent || "")
      : "";
  const modeloSelecionado = placaSelecionadaTexto.includes(" - ")
    ? placaSelecionadaTexto.split(" - ").slice(1).join(" - ").trim()
    : "";
  if (!cpf || !placa || !inicio) return;

  const clientes = loadCadastro(CAD_CLIENTES_KEY);
  const cliente = clientes.find((c) => onlyDigits(String(c.cpf || "")) === cpf);
  if (cliente && normalizeKey(cliente.status).includes("QUEBRA DE CONTRATO")) {
    window.alert("IMPEDITIVO DE LOCAÇÃO");
    renderAdminResult(
      "Locação bloqueada",
      "<p><strong>Cliente com quebra de contrato. Não pode alugar veículo.</strong></p>"
    );
    return;
  }
  if (cliente && normalizeKey(cliente.status).includes("CADASTRO NAO APROVADO")) {
    window.alert("IMPEDITIVO DE LOCAÇÃO");
    renderAdminResult(
      "Locação bloqueada",
      "<p><strong>Cliente com cadastro não aprovado. Não pode alugar veículo.</strong></p>"
    );
    return;
  }
  const confirmado = await askLocacaoCadastroConfirmation({
    cpf,
    clienteNome: String(cliente?.nome || "").trim(),
    placa,
    modelo: modeloSelecionado,
    inicio,
    fim,
    valorSemanal,
  });
  if (!confirmado) return;

  const locacoes = loadCadastro(CAD_LOCACOES_KEY);
  const createdAt = Date.now();
  locacoes.push({
    id: createdAt,
    createdAt,
    cpf,
    placa,
    inicio,
    fim,
    valorSemanal,
  });
  saveCadastro(CAD_LOCACOES_KEY, locacoes);
  addAuditLog("cadastrar_locacao", "locacao", `${cpf} - ${placa}`);
  window.alert("LOCAÇÃO CADASTRADA COM SUCESSO");
  locacaoCadastroForm.reset();
  ensureLocacaoInicioDefault();
  setLocacaoFormBlocked(false);
  locacaoImpedimentoAlertShown = false;
  renderCadastros();
});

cadLocacaoCpfInput.addEventListener("blur", validateLocacaoCpfBlock);
cadLocacaoCpfInput.addEventListener("input", () => {
  if (cadLocacaoCpfInput.value.trim().length < 11) {
    locacaoImpedimentoAlertShown = false;
    setLocacaoFormBlocked(false);
    return;
  }
  validateLocacaoCpfBlock();
});

cadLocacaoClearBtn.addEventListener("click", () => {
  locacaoCadastroForm.reset();
  refreshLocacaoPlacaOptions();
  ensureLocacaoInicioDefault();
  setLocacaoFormBlocked(false);
  locacaoImpedimentoAlertShown = false;
});

manutencaoCadastroForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const placa = String(document.getElementById("cadManutencaoPlaca").value || "")
    .trim()
    .toUpperCase();
  const servicosSelecionados = Array.from(
    manutencaoCadastroForm.querySelectorAll(".cadManutencaoItem:checked")
  ).map((item) => item.value);
  const servico = servicosSelecionados.join(", ");
  const data = String(document.getElementById("cadManutencaoData").value || "").trim();
  const dataPrevistaSaida = String(
    document.getElementById("cadManutencaoPrevistaSaida").value || ""
  ).trim();
  const dataRealSaida = String(
    document.getElementById("cadManutencaoRealSaida").value || ""
  ).trim();
  const valor = String(document.getElementById("cadManutencaoValor").value || "").trim();
  if (!placa || !servico || !data || !dataPrevistaSaida) return;

  const manutencoes = loadCadastro(CAD_MANUTENCOES_KEY);
  const placaKey = normalizePlate(placa);
  const jaEmManutencao = manutencoes.some(
    (m) => normalizePlate(m.placa) === placaKey && !String(m.dataRealSaida || "").trim()
  );
  if (jaEmManutencao) {
    renderAdminResult(
      "Cadastro de manutenção",
      "<p><strong>Este veículo já está em manutenção ativa.</strong></p>"
    );
    return;
  }
  manutencoes.push({
    id: Date.now(),
    placa,
    servicos: servicosSelecionados,
    servico,
    data,
    dataPrevistaSaida,
    dataRealSaida,
    valor,
  });
  saveCadastro(CAD_MANUTENCOES_KEY, manutencoes);
  addAuditLog("cadastrar_manutencao", "manutencao", `${placa} - ${servico}`);
  manutencaoCadastroForm.reset();
  cadManutencaoDataInput.value = todayBrDate();
  renderCadastros();
});

gerarRelatorioManutencaoBtn.addEventListener("click", () => {
  renderManutencaoReport();
});

manutencaoTipoToggleBtn.addEventListener("click", () => {
  manutencaoTipoPanel.classList.toggle("hidden");
});

adminButtons.forEach((button) => {
  button.addEventListener("click", () => {
    runAdminAction(button.dataset.action, button.dataset.scope);
  });
});

if (clienteVidaFecharBtn && clienteVidaDialog) {
  clienteVidaFecharBtn.addEventListener("click", () => {
    clienteVidaDialog.classList.add("hidden");
    if (clienteVidaBody) clienteVidaBody.innerHTML = "";
  });
  clienteVidaDialog.addEventListener("click", (ev) => {
    if (ev.target === clienteVidaDialog) {
      clienteVidaDialog.classList.add("hidden");
      if (clienteVidaBody) clienteVidaBody.innerHTML = "";
    }
  });
}

if (placaHistoricoFecharBtn && placaHistoricoDialog) {
  placaHistoricoFecharBtn.addEventListener("click", () => {
    placaHistoricoDialog.classList.add("hidden");
    if (placaHistoricoBody) placaHistoricoBody.innerHTML = "";
  });
  placaHistoricoDialog.addEventListener("click", (ev) => {
    if (ev.target === placaHistoricoDialog) {
      placaHistoricoDialog.classList.add("hidden");
      if (placaHistoricoBody) placaHistoricoBody.innerHTML = "";
    }
  });
}

function handleReportAreaClick(event) {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  const placaLink = target.closest("a.placa-historico-link");
  if (placaLink && placaLink.dataset.placa) {
    event.preventDefault();
    openPlacaHistoricoDialog(placaLink.dataset.placa);
    return;
  }

  const vidaLink = target.closest("a.cliente-vida-link");
  if (vidaLink && vidaLink.dataset.cpf) {
    event.preventDefault();
    openClienteVidaDialog(vidaLink.dataset.cpf);
    return;
  }

  if (target.dataset.quadroExport === "excel") {
    exportQuadroGeralExcel(currentQuadroGeralRows);
    return;
  }

  if (target.dataset.quadroExport === "pdf") {
    exportQuadroGeralPdf(currentQuadroGeralRows);
    return;
  }

  if (target.dataset.adminBack === "true") {
    renderAdminResult(
      "Selecione uma consulta por grupo",
      "<p>Use os botoes em Clientes Ativos, Clientes Inativos ou Todos os clientes.</p>"
    );
    return;
  }

  if (target.dataset.reportExport === "pdf") {
    const reportTarget = String(target.dataset.reportTarget || "");
    if (reportTarget === "admin") {
      exportGenericReportPdf(adminResultBody, String(adminResultTitle.textContent || "Relatorio"));
      return;
    }
    if (reportTarget === "manutencao") {
      exportGenericReportPdf(manutencaoReportBody, String(manutencaoReportTitle.textContent || "Relatorio manutencao"));
      return;
    }
    if (reportTarget === "locacao" && relatorioLocacaoCache) {
      exportRelatorioPdfFromCache(relatorioLocacaoCache);
      return;
    }
    exportGenericReportPdf(locacaoReportBody, String(locacaoReportTitle.textContent || "Relatorio locacao"));
    return;
  }

  if (target.dataset.reportExport === "excel") {
    const reportTarget = String(target.dataset.reportTarget || "");
    if (reportTarget === "admin") {
      exportGenericReportExcel(adminResultBody, "relatorio-admin.csv");
      return;
    }
    if (reportTarget === "manutencao") {
      exportGenericReportExcel(manutencaoReportBody, "relatorio-manutencao.csv");
      return;
    }
    if (reportTarget === "locacao" && relatorioLocacaoCache) {
      const file =
        relatorioLocacaoTipoSelecionado === "locados"
          ? "relatorio-veiculos-locados.csv"
          : "relatorio-veiculos-disponiveis.csv";
      exportRelatorioExcelFromCache(relatorioLocacaoCache, file);
      return;
    }
    exportGenericReportExcel(locacaoReportBody, "relatorio-locacao.csv");
    return;
  }

  if (target.classList.contains("finance-option-btn")) {
    const detailBox = document.getElementById("financeDetailBox");
    if (!detailBox) return;

    if (target.dataset.finance === "emdia") {
      const totalSaldoEmDia = currentFinanceiroEmDia.reduce(
        (acc, r) => acc + Math.max(0, parseCurrencyBR(r.pago) - parseCurrencyBR(r.devidoHoje)),
        0
      );
      const emDiaRows =
        currentFinanceiroScope === "todos"
          ? buildGroupedFinanceRows(currentFinanceiroEmDia, "emdia").slice(0, 200)
          : currentFinanceiroEmDia
              .slice(0, 200)
              .map((r) => {
                const devido = parseCurrencyBR(r.devidoHoje);
                const pago = parseCurrencyBR(r.pago);
                const saldoSobrando = Math.max(0, pago - devido);
                return [
                  r.nome || "Nao informado",
                  r.placa || "Nao informado",
                  currencyBRL(devido),
                  currencyBRL(pago),
                  `<span class="saldo-devedor-cell saldo-devedor-cell-emdia">+ ${currencyBRL(saldoSobrando)}</span>`,
                ];
              });
      const emDiaHeaders =
        currentFinanceiroScope === "todos"
          ? ["CLIENTE", "HISTORICO DE CONTRATOS (ORDEM TEMPORAL)", "VALOR DEVIDO (O)", "VALOR PAGO (P)", "SALDO"]
          : ["CLIENTE", "PLACA", "VALOR DEVIDO (O)", "VALOR PAGO (P)", "SALDO"];
      detailBox.innerHTML = `
        <div class="finance-summary-line">
          <p><strong>Total de clientes com pagamento em dia:</strong> ${currentFinanceiroEmDia.length}</p>
          <p><strong>Totalizador:</strong> ${currencyBRL(totalSaldoEmDia)}</p>
        </div>
        ${buildStructuredTable(
          emDiaHeaders,
          emDiaRows,
          "Nao ha clientes com pagamento em dia.",
          "relatorio-compacto"
        )}
        ${currentFinanceiroEmDia.length > 200 ? "<p><strong>Mostrando os primeiros 200 clientes.</strong></p>" : ""}
      `;
      return;
    }

    if (target.dataset.finance === "atraso") {
      if (!currentFinanceiroAtraso.length) {
        detailBox.innerHTML = "<p>Nao ha clientes em atraso.</p>";
        return;
      }
      const totalSaldoAtraso = currentFinanceiroAtraso.reduce(
        (acc, r) => acc + Math.max(0, parseCurrencyBR(r.devidoHoje) - parseCurrencyBR(r.pago)),
        0
      );
      const atrasoRows =
        currentFinanceiroScope === "todos"
          ? buildGroupedFinanceRows(currentFinanceiroAtraso, "atraso").slice(0, 200)
          : currentFinanceiroAtraso
              .slice(0, 200)
              .map(
                (r) => {
                  const devido = parseCurrencyBR(r.devidoHoje);
                  const pago = parseCurrencyBR(r.pago);
                  const saldoDevedor = Math.max(0, devido - pago);
                  return [
                    r.nome || "Nao informado",
                    r.placa || "Nao informado",
                    currencyBRL(devido),
                    currencyBRL(pago),
                    `<span class="saldo-devedor-cell saldo-devedor-cell-atraso">- ${currencyBRL(saldoDevedor)}</span>`,
                  ];
                }
              );
      const atrasoHeaders =
        currentFinanceiroScope === "todos"
          ? ["CLIENTE", "HISTORICO DE CONTRATOS (ORDEM TEMPORAL)", "VALOR DEVIDO (O)", "VALOR PAGO (P)", "SALDO"]
          : ["CLIENTE", "PLACA", "VALOR DEVIDO (O)", "VALOR PAGO (P)", "SALDO"];
      detailBox.innerHTML = `
        <div class="finance-summary-line">
          <p><strong>Total de clientes em atraso:</strong> ${currentFinanceiroAtraso.length}</p>
          <p><strong>Totalizador:</strong> ${currencyBRL(totalSaldoAtraso)}</p>
        </div>
        ${buildStructuredTable(
          atrasoHeaders,
          atrasoRows,
          "Sem clientes em atraso.",
          "relatorio-compacto"
        )}
        ${currentFinanceiroAtraso.length > 200 ? "<p><strong>Mostrando os primeiros 200 clientes em atraso.</strong></p>" : ""}
      `;
      return;
    }
  }

  if (!target.classList.contains("model-detail-btn")) return;

  const modelName = target.dataset.model || "";
  const items = currentModelGroups[modelName] || [];
  const detailBox = document.getElementById("modelDetailBox");
  if (!detailBox) return;

  if (!items.length) {
    detailBox.innerHTML = "<p>Nenhum registro encontrado para este modelo.</p>";
    return;
  }

  const detailHtml = items
    .slice(0, 150)
    .map(
      (r) =>
        `<p><strong>${r.placa}</strong> - ${r.nome} (${currentScopeLabel})</p>`
    )
    .join("");

  detailBox.innerHTML =
    `<h4>Detalhes do modelo: ${modelName}</h4>` +
    detailHtml +
    (items.length > 150
      ? "<p><strong>Mostrando os primeiros 150 registros.</strong></p>"
      : "");
}

function applyLocacaoReportFilter(rawTerm) {
  const term = normalizeKey(rawTerm || "");
  const rows = locacaoReportBody.querySelectorAll("tr[data-locacao-search]");
  rows.forEach((row) => {
    const key = normalizeKey(row.getAttribute("data-locacao-search") || "");
    row.classList.toggle("hidden", Boolean(term) && !key.includes(term));
  });
}

function handleReportAreaInput(event) {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  if (target.id === "locacaoFiltroInput") {
    applyLocacaoReportFilter(target.value || "");
  }
}

adminResultBody.addEventListener("click", handleReportAreaClick);
locacaoReportBody.addEventListener("click", handleReportAreaClick);
locacaoReportBody.addEventListener("input", handleReportAreaInput);
manutencaoReportBody.addEventListener("click", handleReportAreaClick);

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredPrompt = event;
  installButton.classList.remove("hidden");
});

installButton.addEventListener("click", async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  installButton.classList.add("hidden");
});

if ("serviceWorker" in navigator && window.location.protocol !== "file:") {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js");
  });
}

if (window.location.protocol === "file:") {
  envWarning.textContent =
    "Voce abriu por arquivo local. Para funcionar como app instalavel, rode com servidor local (http://localhost).";
  envWarning.classList.remove("hidden");
  installButton.classList.add("hidden");
}

seedVeiculosDatabaseIfNeeded();
seedClientesDatabaseIfNeeded();
migratePlacaInLocalStorage();
sanitizeVeiculosDatabase();
applyClienteCpfFixes();
normalizeClienteCodigos();
removeClientesByCodigo([287, 288]);
removeClientesByCpf(["444.444.444-44", "555.555.555-55"]);
clearAllLocacoesOnce();
importLocacoesFromPlanilhaOnce();
fixKnownRentalValueOverrides();
cadManutencaoDataInput.value = todayBrDate();
setupDateMasks();
ensureLocacaoInicioDefault();
requireLoggedArea();
setInterval(() => {
  enforceMaintenanceAndDailyRoutines();
}, 60 * 1000);
