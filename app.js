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
const OPERACAO_ACCESS_TARGETS = ["cliente", "veiculo"];
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
const loginClienteCard = document.getElementById("loginClienteCard");
const loginAdminCard = document.getElementById("loginAdminCard");
const topbarAcessoCliente = document.getElementById("topbarAcessoCliente");
const topbarAcessoColaborador = document.getElementById("topbarAcessoColaborador");
const landingAcessoCliente = document.getElementById("landingAcessoCliente");
const landingAcessoColaborador = document.getElementById("landingAcessoColaborador");
const homeLayoutEditToggleBtn = document.getElementById("homeLayoutEditToggleBtn");
const homeLayoutSaveBtn = document.getElementById("homeLayoutSaveBtn");
const homeLayoutResetBtn = document.getElementById("homeLayoutResetBtn");
const homeLayoutBoxes = document.querySelectorAll("[data-home-layout-box]");
const loginClienteForm = document.getElementById("loginClienteForm");
const loginAdminForm = document.getElementById("loginAdminForm");
const loginClienteMessage = document.getElementById("loginClienteMessage");
const loginAdminMessage = document.getElementById("loginAdminMessage");
const clientePublicoCadastroForm = document.getElementById("clientePublicoCadastroForm");
const publicCadClienteCpf = document.getElementById("publicCadClienteCpf");
const publicCadClienteDataCadastro = document.getElementById("publicCadClienteDataCadastro");
const publicCadClienteNome = document.getElementById("publicCadClienteNome");
const publicCadClienteCelular = document.getElementById("publicCadClienteCelular");
const publicCadClienteRecado1 = document.getElementById("publicCadClienteRecado1");
const publicCadClienteRecado2 = document.getElementById("publicCadClienteRecado2");
const publicCadClienteCnh = document.getElementById("publicCadClienteCnh");
const publicCadClienteCategoria = document.getElementById("publicCadClienteCategoria");
const publicCadClienteVencimento = document.getElementById("publicCadClienteVencimento");
const publicCadClienteEar = document.getElementById("publicCadClienteEar");
const publicCadClienteCep = document.getElementById("publicCadClienteCep");
const publicCadClienteComplemento = document.getElementById("publicCadClienteComplemento");
const publicCadClienteMunicipioUf = document.getElementById("publicCadClienteMunicipioUf");
const publicCadClienteEndereco = document.getElementById("publicCadClienteEndereco");
const publicCadClienteConfirmEnderecoBtn = document.getElementById("publicCadClienteConfirmEnderecoBtn");
const publicCadClienteCepStatus = document.getElementById("publicCadClienteCepStatus");
const publicCadClienteErro = document.getElementById("publicCadClienteErro");
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
const adminDadosMenu = document.getElementById("adminDadosMenu");
const adminDadosUsoBtn = document.getElementById("adminDadosUsoBtn");
const adminValidacaoCadastroBtn = document.getElementById("adminValidacaoCadastroBtn");
const adminOperacaoSection = document.getElementById("adminOperacaoSection");
const adminInformacaoSection = document.getElementById("adminInformacaoSection");
const adminDadosSection = document.getElementById("adminDadosSection");
const adminDadosUsoSection = document.getElementById("adminDadosUsoSection");
const adminValidacaoCadastroSection = document.getElementById("adminValidacaoCadastroSection");
const adminValidacaoCadastroLista = document.getElementById("adminValidacaoCadastroLista");
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
const cadClienteCnhInput = document.getElementById("cadClienteCnh");
const cadClienteCepInput = document.getElementById("cadClienteCep");
const cadClienteMunicipioUfInput = document.getElementById("cadClienteMunicipioUf");
const cadClienteEnderecoInput = document.getElementById("cadClienteEndereco");
const cadClienteComplementoInput = document.getElementById("cadClienteComplemento");
const cadClienteCepStatus = document.getElementById("cadClienteCepStatus");
const cadClienteConfirmEnderecoBtn = document.getElementById("cadClienteConfirmEnderecoBtn");
const clienteLayoutEditToggleBtn = document.getElementById("clienteLayoutEditToggleBtn");
const clienteLayoutSaveBtn = document.getElementById("clienteLayoutSaveBtn");
const clienteLayoutResetBtn = document.getElementById("clienteLayoutResetBtn");
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
const cadLocacaoPlacaSugestoes = document.getElementById("cadLocacaoPlacaSugestoes");
const cadLocacaoMotosDisponiveisCountEl = document.getElementById(
  "cadLocacaoMotosDisponiveisCount"
);
const cadLocacaoClienteNomeInput = document.getElementById("cadLocacaoClienteNome");
const cadLocacaoCpfSugestoes = document.getElementById("cadLocacaoCpfSugestoes");
const cadLocacaoClienteNomeSugestoes = document.getElementById("cadLocacaoClienteNomeSugestoes");
const cadLocacaoInicioInput = document.getElementById("cadLocacaoInicio");
const cadLocacaoFimInput = document.getElementById("cadLocacaoFim");
const cadLocacaoKmInput = document.getElementById("cadLocacaoKm");
const cadLocacaoValorInput = document.getElementById("cadLocacaoValor");
const cadLocacaoInvestimentoInput = document.getElementById("cadLocacaoInvestimento");
const cadLocacaoPlanoInputs = document.querySelectorAll('input[name="cadLocacaoPlano"]');
const cadLocacaoContratoInput = document.getElementById("cadLocacaoContrato");
const cadLocacaoStatusInput = document.getElementById("cadLocacaoStatus");
const cadLocacaoDiaPagtoInput = document.getElementById("cadLocacaoDiaPagto");
const cadLocacaoPeriodoLocacaoInput = document.getElementById("cadLocacaoPeriodoLocacao");
const cadLocacaoModalidadeInput = document.getElementById("cadLocacaoModalidade");
const cadLocacaoMarcaModeloInput = document.getElementById("cadLocacaoMarcaModelo");
const cadLocacaoOpcaoContratoInput = document.getElementById("cadLocacaoOpcaoContrato");
const cadLocacaoPeriodoContratoInput = document.getElementById("cadLocacaoPeriodoContrato");
const cadLocacaoConfigPrecoKmInput = document.getElementById("cadLocacaoConfigPrecoKm");
const cadLocacaoTabelaInput = document.getElementById("cadLocacaoTabela");
const cadLocacaoValorParcelaInput = document.getElementById("cadLocacaoValorParcela");
const cadLocacaoClienteCodigoInput = document.getElementById("cadLocacaoClienteCodigo");
const locacaoSubmitButton = locacaoCadastroForm?.querySelector('button[type="submit"]') ?? null;
const cadLocacaoClearBtn = document.getElementById("cadLocacaoClearBtn");
const lancamentoAluguelForm = document.getElementById("lancamentoAluguelForm");
const lancAluguelClienteNomeInput = document.getElementById("lancAluguelClienteNome");
const lancAluguelClienteSugestoes = document.getElementById("lancAluguelClienteSugestoes");
const lancAluguelPlacaInput = document.getElementById("lancAluguelPlaca");
const lancAluguelCpfInput = document.getElementById("lancAluguelCpf");
const lancAluguelNumeroContratoInput = document.getElementById("lancAluguelNumeroContrato");
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
const cadFuncionarioNomeSugestoes = document.getElementById("cadFuncionarioNomeSugestoes");
const cadFuncionarioSenha = document.getElementById("cadFuncionarioSenha");
const cadFuncionarioRole = document.getElementById("cadFuncionarioRole");
const cadFuncionarioClearBtn = document.getElementById("cadFuncionarioClearBtn");
const cadFuncionarioSubmitBtn = document.getElementById("cadFuncionarioSubmitBtn");
const cadFuncionarioEditBtn = document.getElementById("cadFuncionarioEditBtn");
const cadFuncionarioBlockBtn = document.getElementById("cadFuncionarioBlockBtn");
const funcionarioCadastroErro = document.getElementById("funcionarioCadastroErro");
const cadFuncionarioAcessoCliente = document.getElementById("cadFuncionarioAcessoCliente");
const cadFuncionarioAcessoVeiculo = document.getElementById("cadFuncionarioAcessoVeiculo");
const cadFuncionarioAcessoLocacao = document.getElementById("cadFuncionarioAcessoLocacao");
const cadFuncionarioAcessoManutencao = document.getElementById("cadFuncionarioAcessoManutencao");
const cadFuncionarioAcessoLancamentoAluguel = document.getElementById("cadFuncionarioAcessoLancamentoAluguel");
const cadFuncionarioAcessoLancamentoDespesa = document.getElementById("cadFuncionarioAcessoLancamentoDespesa");
const funcLayoutEditToggleBtn = document.getElementById("funcLayoutEditToggleBtn");
const funcLayoutSaveBtn = document.getElementById("funcLayoutSaveBtn");
const funcLayoutResetBtn = document.getElementById("funcLayoutResetBtn");
const veiculoCadastroErro = document.getElementById("veiculoCadastroErro");
const cadVeiculoPlacaInput = document.getElementById("cadVeiculoPlaca");
const cadVeiculoTagPreviewInput = document.getElementById("cadVeiculoTagPreview");
const cadVeiculoChassiInput = document.getElementById("cadVeiculoChassi");
const cadVeiculoRenavamInput = document.getElementById("cadVeiculoRenavam");
const cadVeiculoMotorInput = document.getElementById("cadVeiculoMotor");
const veiculoSubmitButton = veiculoCadastroForm?.querySelector('button[type="submit"]') ?? null;
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
const clienteAreaQrImg = document.getElementById("clienteAreaQrImg");
const enviarQrWhatsappBtn = document.getElementById("enviarQrWhatsappBtn");
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
const relatorioCompletoProtocoloBtn = document.getElementById("relatorioCompletoProtocoloBtn");
const relatorioLocacaoTelaBtn = document.getElementById("relatorioLocacaoTelaBtn");
const relatorioLocacaoPdfBtn = document.getElementById("relatorioLocacaoPdfBtn");
const relatorioLocacaoExcelBtn = document.getElementById("relatorioLocacaoExcelBtn");
const relatorioLocacaoLimparBtn = document.getElementById("relatorioLocacaoLimparBtn");
const locLayoutEditToggleBtn = document.getElementById("locLayoutEditToggleBtn");
const locLayoutSaveBtn = document.getElementById("locLayoutSaveBtn");
const locLayoutResetBtn = document.getElementById("locLayoutResetBtn");
const locacaoReportBox = document.getElementById("locacaoReportBox");
const locacaoReportTitle = document.getElementById("locacaoReportTitle");
const locacaoReportBody = document.getElementById("locacaoReportBody");
const clienteVidaDialog = document.getElementById("clienteVidaDialog");
const clienteVidaBody = document.getElementById("clienteVidaBody");
const clienteVidaFecharBtn = document.getElementById("clienteVidaFecharBtn");
const clienteVidaExportExcelBtn = document.getElementById("clienteVidaExportExcelBtn");
const clienteVidaExportPdfBtn = document.getElementById("clienteVidaExportPdfBtn");
const clienteVidaImprimirBtn = document.getElementById("clienteVidaImprimirBtn");
const placaHistoricoDialog = document.getElementById("placaHistoricoDialog");
const placaHistoricoBody = document.getElementById("placaHistoricoBody");
const placaHistoricoFecharBtn = document.getElementById("placaHistoricoFecharBtn");
const placaHistoricoExportExcelBtn = document.getElementById("placaHistoricoExportExcelBtn");
const placaHistoricoExportPdfBtn = document.getElementById("placaHistoricoExportPdfBtn");
const placaHistoricoImprimirBtn = document.getElementById("placaHistoricoImprimirBtn");
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
const lancamentoAluguelHistoricoDialog = document.getElementById("lancamentoAluguelHistoricoDialog");
const lancamentoAluguelHistoricoQuadro = document.getElementById("lancamentoAluguelHistoricoQuadro");
const lancamentoAluguelHistoricoSimBtn = document.getElementById("lancamentoAluguelHistoricoSimBtn");
const lancamentoAluguelHistoricoEditarBtn = document.getElementById("lancamentoAluguelHistoricoEditarBtn");
const lancamentoAluguelHistoricoCancelarBtn = document.getElementById(
  "lancamentoAluguelHistoricoCancelarBtn"
);
const comprovantePasteZone = document.getElementById("comprovantePasteZone");
const comprovantePreview = document.getElementById("comprovantePreview");
const comprovanteFileInput = document.getElementById("comprovanteFileInput");
const comprovanteTextoFallback = document.getElementById("comprovanteTextoFallback");
const comprovanteApiKeyInput = document.getElementById("comprovanteApiKeyInput");
const comprovanteApiKeySaveBtn = document.getElementById("comprovanteApiKeySaveBtn");
const comprovanteApiStatus = document.getElementById("comprovanteApiStatus");
const comprovanteExtrairBtn = document.getElementById("comprovanteExtrairBtn");
const comprovanteLimparBtn = document.getElementById("comprovanteLimparBtn");
const comprovanteIADialog = document.getElementById("comprovanteIADialog");
const comprovanteModalNome = document.getElementById("comprovanteModalNome");
const comprovanteModalCpf = document.getElementById("comprovanteModalCpf");
const comprovanteModalPlaca = document.getElementById("comprovanteModalPlaca");
const comprovanteModalData = document.getElementById("comprovanteModalData");
const comprovanteModalValor = document.getElementById("comprovanteModalValor");
const comprovanteModalNomePagador = document.getElementById("comprovanteModalNomePagador");
const comprovanteModalTerceiro = document.getElementById("comprovanteModalTerceiro");
const comprovanteLocacaoWrap = document.getElementById("comprovanteLocacaoWrap");
const comprovanteLocacaoSelect = document.getElementById("comprovanteLocacaoSelect");

const comprovanteAplicarBtn = document.getElementById("comprovanteAplicarBtn");
const comprovanteModalCancelBtn = document.getElementById("comprovanteModalCancelBtn");
const installButton = document.getElementById("installButton");
const updateButton = document.getElementById("updateButton");
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
let swRegistration = null;
let updateReloadPending = false;
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
let adminDadosAbaAtual = "dadosUso";
/** CPF em edicao na tela de funcionario (null = modo cadastro novo). */
let funcionarioEdicaoCpf = null;
let informacaoEscopoAtual = "";
let currentAdminReportSaldo = null;
let currentQuadroGeralRows = [];
const CAD_CLIENTES_KEY = "dk_clientes_cadastro";
const CAD_CLIENTES_VALIDACAO_KEY = "dk_clientes_validacao_pendente";
const CAD_VEICULOS_KEY = "dk_veiculos_cadastro";
const CAD_LOCACOES_KEY = "dk_locacoes_cadastro";
const LOCACAO_DATABASE_KEY = "dk_locacoes_quadro_geral";
const CAD_MANUTENCOES_KEY = "dk_manutencoes_cadastro";
const CAD_LANCAMENTOS_ALUGUEL_KEY = "dk_lancamentos_aluguel";
/** Sobrescritas manuais do quadro RECEITA por célula SEM (persistido no backup). */
const CAD_QUADRO_RECEITA_OVERRIDES_KEY = "dk_quadro_receita_overrides";
/** CPF(s) com histórico bloqueado para edição/apagamento de lançamentos já existentes. */
const CPF_LANCAMENTO_EDICAO_BLOQUEADA = new Set(["11498953492", "11377276406"]);
/** Banco local de imagem/texto do comprovante por fingerprint (localStorage). */
const CAD_COMPROVANTES_BANCO_KEY = "dk_comprovantes_banco";
const AUDIT_LOG_KEY = "dk_audit_log";
const BACKUP_KEYS = [
  CAD_CLIENTES_KEY,
  CAD_CLIENTES_VALIDACAO_KEY,
  CAD_VEICULOS_KEY,
  CAD_LOCACOES_KEY,
  LOCACAO_DATABASE_KEY,
  CAD_MANUTENCOES_KEY,
  CAD_LANCAMENTOS_ALUGUEL_KEY,
  CAD_QUADRO_RECEITA_OVERRIDES_KEY,
  CAD_COMPROVANTES_BANCO_KEY,
  AUDIT_LOG_KEY,
];
const DAILY_RECON_KEY = "dk_daily_reconciliation_status";
const CLEAR_LOCACOES_ONCE_KEY = "dk_clear_locacoes_once_v1";
const IMPORT_LOCACOES_PLANILHA_ONCE_KEY = "dk_import_locacoes_planilha_once_v1";
/** Migração única: zera toda a pilha operacional de locação/lançamentos; mantém clientes e veículos. */
const RESET_LOCACAO_STACK_SITE_V2_KEY = "dk_reset_locacao_stack_site_v2";
/**
 * Reset completo do projeto no navegador: mantém apenas dk_clientes_cadastro e dk_veiculos_cadastro.
 * Não altera funcionários nem chave OpenAI.
 */
const RESET_PROJETO_SOMENTE_CADASTROS_V3_KEY = "dk_reset_projeto_somente_cadastros_v3";
const LEGACY_LANCAMENTO_KEYS = [
  "dk_lancamento_aluguel",
  "dk_lancamentos_aluguel_cadastro",
  "dk_lancamento_aluguel_cadastro",
];
const SENHA_INICIAL_OPERACAO = "123456";
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
let locacoesXlsxApiCache = null;
let locacoesXlsxApiPromise = null;
let dadosUsoAcaoPendente = "";
let ultimoLancamentoAluguelSalvoId = null;
let homeLayoutEditMode = false;
let homeLayoutDragState = null;
let homeLayoutResizeObserver = null;
const HOME_LAYOUT_KEY = "dk_home_layout_v1";
let funcLayoutEditMode = false;
let funcLayoutDragState = null;
let funcLayoutResizeObserver = null;
const FUNC_LAYOUT_KEY = "dk_funcionario_form_layout_v1";
let locLayoutEditMode = false;
let locLayoutDragState = null;
let locLayoutResizeObserver = null;
const LOC_LAYOUT_KEY = "dk_locacao_form_layout_v1";
let clienteLayoutEditMode = false;
let clienteLayoutDragState = null;
let clienteLayoutResizeObserver = null;
const CLIENTE_LAYOUT_KEY = "dk_cliente_form_layout_v2";

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

function openLocadoraLoginTarget(target) {
  const colaborador = target === "colaborador";
  showLocadoraArea();
  loginArea.classList.remove("hidden");
  dashboardCard.classList.add("hidden");
  adminCard.classList.add("hidden");
  const card = colaborador ? loginAdminCard : loginClienteCard;
  const focusId = colaborador ? "cpfAdmin" : "cpfCliente";
  requestAnimationFrame(() => {
    card?.scrollIntoView({ behavior: "smooth", block: "center" });
    document.getElementById(focusId)?.focus();
    card?.classList.add("login-card--pulse");
    window.setTimeout(() => card?.classList.remove("login-card--pulse"), 2200);
  });
}

function getHomeLayoutBoxesArray() {
  return Array.from(homeLayoutBoxes || []);
}

function canEditLayoutsByProfile() {
  return false;
}

function setLayoutEditorsAccessByProfile() {
  const allow = canEditLayoutsByProfile();
  const controls = [
    homeLayoutEditToggleBtn,
    homeLayoutSaveBtn,
    homeLayoutResetBtn,
    clienteLayoutEditToggleBtn,
    clienteLayoutSaveBtn,
    clienteLayoutResetBtn,
    funcLayoutEditToggleBtn,
    funcLayoutSaveBtn,
    funcLayoutResetBtn,
    locLayoutEditToggleBtn,
    locLayoutSaveBtn,
    locLayoutResetBtn,
  ];
  controls.forEach((btn) => {
    if (!btn) return;
    btn.classList.toggle("hidden", !allow);
    btn.disabled = !allow;
  });
  if (!allow) {
    stopHomeLayoutEdit();
    stopClienteLayoutEdit();
    stopFuncionarioLayoutEdit();
    stopLocacaoLayoutEdit();
  }
}

function setHomeLayoutToolbarState() {
  if (homeLayoutEditToggleBtn) {
    homeLayoutEditToggleBtn.textContent = homeLayoutEditMode ? "Sair edição" : "Editar layout";
  }
}

function computeHomeLayoutMinHeight(layout) {
  let maxBottom = 0;
  Object.values(layout || {}).forEach((box) => {
    if (!box) return;
    const bottom = Number(box.top || 0) + Number(box.height || 0);
    if (bottom > maxBottom) maxBottom = bottom;
  });
  return Math.max(620, Math.ceil(maxBottom + 24));
}

function collectCurrentHomeLayout() {
  const boxes = getHomeLayoutBoxesArray();
  if (!grupoHome || !boxes.length) return {};
  const containerRect = grupoHome.getBoundingClientRect();
  const layout = {};
  boxes.forEach((box) => {
    const key = String(box.dataset.homeLayoutBox || "").trim();
    if (!key) return;
    const rect = box.getBoundingClientRect();
    layout[key] = {
      left: Math.max(0, Math.round(rect.left - containerRect.left)),
      top: Math.max(0, Math.round(rect.top - containerRect.top)),
      width: Math.max(220, Math.round(rect.width)),
      height: Math.max(140, Math.round(rect.height)),
    };
  });
  return layout;
}

function applyHomeLayout(layoutInput) {
  const layout = layoutInput && typeof layoutInput === "object" ? layoutInput : {};
  const boxes = getHomeLayoutBoxesArray();
  if (!grupoHome || !boxes.length) return;
  grupoHome.classList.add("landing-custom-layout");
  boxes.forEach((box) => {
    const key = String(box.dataset.homeLayoutBox || "").trim();
    const shape = layout[key];
    if (!shape) return;
    box.style.left = `${Math.max(0, Number(shape.left || 0))}px`;
    box.style.top = `${Math.max(0, Number(shape.top || 0))}px`;
    box.style.width = `${Math.max(220, Number(shape.width || 220))}px`;
    box.style.height = `${Math.max(140, Number(shape.height || 140))}px`;
  });
  grupoHome.style.minHeight = `${computeHomeLayoutMinHeight(layout)}px`;
}

function clearHomeLayoutInlineStyles() {
  const boxes = getHomeLayoutBoxesArray();
  boxes.forEach((box) => {
    box.style.left = "";
    box.style.top = "";
    box.style.width = "";
    box.style.height = "";
  });
  if (grupoHome) {
    grupoHome.classList.remove("landing-custom-layout", "layout-edit-mode");
    grupoHome.style.minHeight = "";
  }
}

function persistHomeLayoutFromScreen() {
  const layout = collectCurrentHomeLayout();
  localStorage.setItem(HOME_LAYOUT_KEY, JSON.stringify(layout));
  applyHomeLayout(layout);
  return layout;
}

function bootstrapHomeLayoutFromStorage() {
  if (!grupoHome) return;
  const raw = localStorage.getItem(HOME_LAYOUT_KEY);
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return;
    applyHomeLayout(parsed);
  } catch {
    // Ignora layout inválido para evitar quebrar a home.
  }
}

function startHomeLayoutEdit() {
  if (!canEditLayoutsByProfile()) return;
  if (!grupoHome) return;
  if (!grupoHome.classList.contains("landing-custom-layout")) {
    const snapshot = collectCurrentHomeLayout();
    applyHomeLayout(snapshot);
  }
  homeLayoutEditMode = true;
  grupoHome.classList.add("layout-edit-mode");
  setHomeLayoutToolbarState();
}

function stopHomeLayoutEdit() {
  homeLayoutEditMode = false;
  homeLayoutDragState = null;
  if (grupoHome) grupoHome.classList.remove("layout-edit-mode");
  setHomeLayoutToolbarState();
}

function resolveHomeLayoutDragTarget(startNode) {
  const node = startNode instanceof Element ? startNode : null;
  if (!node) return null;
  const box = node.closest("[data-home-layout-box]");
  if (!box || !(box instanceof HTMLElement)) return null;
  const interactive = node.closest("button, a, input, select, textarea, label, form");
  if (interactive) return null;
  return box;
}

function bindHomeLayoutEditorEvents() {
  if (!grupoHome) return;
  if (homeLayoutResizeObserver) return;

  homeLayoutResizeObserver = new ResizeObserver(() => {
    if (!homeLayoutEditMode) return;
    const layout = collectCurrentHomeLayout();
    grupoHome.style.minHeight = `${computeHomeLayoutMinHeight(layout)}px`;
  });
  getHomeLayoutBoxesArray().forEach((box) => homeLayoutResizeObserver.observe(box));

  grupoHome.addEventListener("pointerdown", (event) => {
    if (!homeLayoutEditMode) return;
    const box = resolveHomeLayoutDragTarget(event.target);
    if (!box) return;
    const rect = box.getBoundingClientRect();
    homeLayoutDragState = {
      box,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originLeft: parseFloat(box.style.left || "0") || 0,
      originTop: parseFloat(box.style.top || "0") || 0,
      boxWidth: rect.width,
      boxHeight: rect.height,
    };
    box.setPointerCapture?.(event.pointerId);
    event.preventDefault();
  });

  grupoHome.addEventListener("pointermove", (event) => {
    const drag = homeLayoutDragState;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    const containerWidth = grupoHome.clientWidth;
    const nextLeft = Math.max(0, Math.min(containerWidth - drag.boxWidth, drag.originLeft + dx));
    const nextTop = Math.max(0, drag.originTop + dy);
    drag.box.style.left = `${Math.round(nextLeft)}px`;
    drag.box.style.top = `${Math.round(nextTop)}px`;
    const layout = collectCurrentHomeLayout();
    grupoHome.style.minHeight = `${computeHomeLayoutMinHeight(layout)}px`;
  });

  const finishDrag = (event) => {
    if (!homeLayoutDragState) return;
    if (event && homeLayoutDragState.pointerId !== event.pointerId) return;
    homeLayoutDragState = null;
  };

  grupoHome.addEventListener("pointerup", finishDrag);
  grupoHome.addEventListener("pointercancel", finishDrag);
}

function getFuncionarioLayoutBoxesArray() {
  if (!funcionarioCadastroForm) return [];
  return Array.from(funcionarioCadastroForm.querySelectorAll("[data-func-layout-box]"));
}

function ensureFuncionarioLayoutBoxAttributes() {
  if (!funcionarioCadastroForm) return;
  Array.from(funcionarioCadastroForm.children).forEach((el, idx) => {
    if (!(el instanceof HTMLElement)) return;
    const tag = el.tagName;
    if (!["INPUT", "SELECT", "DIV", "BUTTON"].includes(tag)) return;
    if (tag === "INPUT" && el.type === "checkbox") return;
    if (tag === "DIV" && !el.id) return;
    if (!el.dataset.funcLayoutBox) {
      el.dataset.funcLayoutBox = el.id || `funcItem${idx + 1}`;
    }
  });
}

function setFuncionarioLayoutToolbarState() {
  if (!funcLayoutEditToggleBtn) return;
  funcLayoutEditToggleBtn.textContent = funcLayoutEditMode ? "Sair edição" : "Editar caixas";
}

function collectFuncionarioLayout() {
  if (!funcionarioCadastroForm) return {};
  const boxes = getFuncionarioLayoutBoxesArray();
  const formRect = funcionarioCadastroForm.getBoundingClientRect();
  const layout = {};
  boxes.forEach((el) => {
    const key = String(el.dataset.funcLayoutBox || "");
    if (!key) return;
    const rect = el.getBoundingClientRect();
    layout[key] = {
      left: Math.max(0, Math.round(rect.left - formRect.left)),
      top: Math.max(0, Math.round(rect.top - formRect.top)),
      width: Math.max(160, Math.round(rect.width)),
      height: Math.max(42, Math.round(rect.height)),
    };
  });
  return layout;
}

function computeFuncionarioLayoutMinHeight(layout) {
  let maxBottom = 0;
  Object.values(layout || {}).forEach((item) => {
    if (!item) return;
    const bottom = Number(item.top || 0) + Number(item.height || 0);
    if (bottom > maxBottom) maxBottom = bottom;
  });
  return Math.max(320, Math.ceil(maxBottom + 16));
}

function applyFuncionarioLayout(layoutInput) {
  if (!funcionarioCadastroForm) return;
  ensureFuncionarioLayoutBoxAttributes();
  const layout = layoutInput && typeof layoutInput === "object" ? layoutInput : {};
  const boxes = getFuncionarioLayoutBoxesArray();
  funcionarioCadastroForm.classList.add("func-custom-layout");
  boxes.forEach((el) => {
    const key = String(el.dataset.funcLayoutBox || "");
    const box = layout[key];
    if (!box) return;
    el.style.left = `${Math.max(0, Number(box.left || 0))}px`;
    el.style.top = `${Math.max(0, Number(box.top || 0))}px`;
    el.style.width = `${Math.max(160, Number(box.width || 160))}px`;
    el.style.height = `${Math.max(42, Number(box.height || 42))}px`;
  });
  funcionarioCadastroForm.style.minHeight = `${computeFuncionarioLayoutMinHeight(layout)}px`;
}

function clearFuncionarioLayoutInlineStyles() {
  if (!funcionarioCadastroForm) return;
  const boxes = getFuncionarioLayoutBoxesArray();
  boxes.forEach((el) => {
    el.style.left = "";
    el.style.top = "";
    el.style.width = "";
    el.style.height = "";
  });
  funcionarioCadastroForm.classList.remove("func-custom-layout", "layout-edit-mode");
  funcionarioCadastroForm.style.minHeight = "";
}

function bootstrapFuncionarioLayoutFromStorage() {
  if (!funcionarioCadastroForm) return;
  const raw = localStorage.getItem(FUNC_LAYOUT_KEY);
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return;
    applyFuncionarioLayout(parsed);
  } catch {
    // Ignora layout inválido no storage.
  }
}

function persistFuncionarioLayoutFromScreen() {
  const layout = collectFuncionarioLayout();
  localStorage.setItem(FUNC_LAYOUT_KEY, JSON.stringify(layout));
  applyFuncionarioLayout(layout);
}

function startFuncionarioLayoutEdit() {
  if (!canEditLayoutsByProfile()) return;
  if (!funcionarioCadastroForm) return;
  ensureFuncionarioLayoutBoxAttributes();
  if (!funcionarioCadastroForm.classList.contains("func-custom-layout")) {
    applyFuncionarioLayout(collectFuncionarioLayout());
  }
  funcLayoutEditMode = true;
  funcionarioCadastroForm.classList.add("layout-edit-mode");
  setFuncionarioLayoutToolbarState();
}

function stopFuncionarioLayoutEdit() {
  funcLayoutEditMode = false;
  funcLayoutDragState = null;
  funcionarioCadastroForm?.classList.remove("layout-edit-mode");
  setFuncionarioLayoutToolbarState();
}

function bindFuncionarioLayoutEditorEvents() {
  if (!funcionarioCadastroForm || funcLayoutResizeObserver) return;
  ensureFuncionarioLayoutBoxAttributes();

  funcLayoutResizeObserver = new ResizeObserver(() => {
    if (!funcLayoutEditMode || !funcionarioCadastroForm) return;
    const layout = collectFuncionarioLayout();
    funcionarioCadastroForm.style.minHeight = `${computeFuncionarioLayoutMinHeight(layout)}px`;
  });
  getFuncionarioLayoutBoxesArray().forEach((el) => funcLayoutResizeObserver.observe(el));

  funcionarioCadastroForm.addEventListener("pointerdown", (event) => {
    if (!funcLayoutEditMode || (!event.altKey && !event.shiftKey)) return;
    const node = event.target instanceof Element ? event.target : null;
    const box = node?.closest("[data-func-layout-box]");
    if (!box || !(box instanceof HTMLElement)) return;
    const rect = box.getBoundingClientRect();
    const mode = event.shiftKey ? "resize" : "move";
    funcLayoutDragState = {
      mode,
      box,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originLeft: parseFloat(box.style.left || "0") || 0,
      originTop: parseFloat(box.style.top || "0") || 0,
      boxWidth: rect.width,
      boxHeight: rect.height,
    };
    box.setPointerCapture?.(event.pointerId);
    event.preventDefault();
  });

  funcionarioCadastroForm.addEventListener("pointermove", (event) => {
    if (!funcLayoutDragState || funcLayoutDragState.pointerId !== event.pointerId || !funcionarioCadastroForm) return;
    const dx = event.clientX - funcLayoutDragState.startX;
    const dy = event.clientY - funcLayoutDragState.startY;
    if (funcLayoutDragState.mode === "resize") {
      const maxWidth = Math.max(160, funcionarioCadastroForm.clientWidth - funcLayoutDragState.originLeft);
      const nextWidth = Math.max(160, Math.min(maxWidth, funcLayoutDragState.boxWidth + dx));
      const nextHeight = Math.max(42, funcLayoutDragState.boxHeight + dy);
      funcLayoutDragState.box.style.width = `${Math.round(nextWidth)}px`;
      funcLayoutDragState.box.style.height = `${Math.round(nextHeight)}px`;
    } else {
      const maxLeft = Math.max(0, funcionarioCadastroForm.clientWidth - funcLayoutDragState.boxWidth);
      const nextLeft = Math.max(0, Math.min(maxLeft, funcLayoutDragState.originLeft + dx));
      const nextTop = Math.max(0, funcLayoutDragState.originTop + dy);
      funcLayoutDragState.box.style.left = `${Math.round(nextLeft)}px`;
      funcLayoutDragState.box.style.top = `${Math.round(nextTop)}px`;
    }
    const layout = collectFuncionarioLayout();
    funcionarioCadastroForm.style.minHeight = `${computeFuncionarioLayoutMinHeight(layout)}px`;
  });

  const finish = (event) => {
    if (!funcLayoutDragState) return;
    if (event && funcLayoutDragState.pointerId !== event.pointerId) return;
    funcLayoutDragState = null;
  };
  funcionarioCadastroForm.addEventListener("pointerup", finish);
  funcionarioCadastroForm.addEventListener("pointercancel", finish);
}

function getClienteLayoutBoxesArray() {
  if (!clienteCadastroForm) return [];
  return Array.from(clienteCadastroForm.querySelectorAll("[data-cliente-layout-box]"));
}

function ensureClienteLayoutBoxAttributes() {
  if (!clienteCadastroForm) return;
  Array.from(clienteCadastroForm.children).forEach((el, idx) => {
    if (!(el instanceof HTMLElement)) return;
    const tag = el.tagName;
    if (!["INPUT", "SELECT", "DIV", "P", "BUTTON"].includes(tag)) return;
    if (tag === "INPUT" && el.type === "checkbox") return;
    if (!el.dataset.clienteLayoutBox) {
      el.dataset.clienteLayoutBox = el.id || `clienteItem${idx + 1}`;
    }
  });
}

function setClienteLayoutToolbarState() {
  if (!clienteLayoutEditToggleBtn) return;
  clienteLayoutEditToggleBtn.textContent = clienteLayoutEditMode ? "Sair edição" : "Editar caixas";
}

function collectClienteLayout() {
  if (!clienteCadastroForm) return {};
  const boxes = getClienteLayoutBoxesArray();
  const formRect = clienteCadastroForm.getBoundingClientRect();
  const layout = {};
  boxes.forEach((el) => {
    const key = String(el.dataset.clienteLayoutBox || "");
    if (!key) return;
    const rect = el.getBoundingClientRect();
    layout[key] = {
      left: Math.max(0, Math.round(rect.left - formRect.left)),
      top: Math.max(0, Math.round(rect.top - formRect.top)),
      width: Math.max(160, Math.round(rect.width)),
      height: Math.max(42, Math.round(rect.height)),
    };
  });
  return layout;
}

function computeClienteLayoutMinHeight(layout) {
  let maxBottom = 0;
  Object.values(layout || {}).forEach((item) => {
    if (!item) return;
    const bottom = Number(item.top || 0) + Number(item.height || 0);
    if (bottom > maxBottom) maxBottom = bottom;
  });
  return Math.max(320, Math.ceil(maxBottom + 16));
}

function applyClienteLayout(layoutInput) {
  if (!clienteCadastroForm) return;
  ensureClienteLayoutBoxAttributes();
  const layout = layoutInput && typeof layoutInput === "object" ? layoutInput : {};
  const boxes = getClienteLayoutBoxesArray();
  clienteCadastroForm.classList.add("cliente-custom-layout");
  boxes.forEach((el) => {
    const key = String(el.dataset.clienteLayoutBox || "");
    const box = layout[key];
    if (!box) return;
    el.style.left = `${Math.max(0, Number(box.left || 0))}px`;
    el.style.top = `${Math.max(0, Number(box.top || 0))}px`;
    el.style.width = `${Math.max(160, Number(box.width || 160))}px`;
    el.style.height = `${Math.max(42, Number(box.height || 42))}px`;
  });
  clienteCadastroForm.style.minHeight = `${computeClienteLayoutMinHeight(layout)}px`;
}

function clearClienteLayoutInlineStyles() {
  if (!clienteCadastroForm) return;
  const boxes = getClienteLayoutBoxesArray();
  boxes.forEach((el) => {
    el.style.left = "";
    el.style.top = "";
    el.style.width = "";
    el.style.height = "";
  });
  clienteCadastroForm.classList.remove("cliente-custom-layout", "layout-edit-mode");
  clienteCadastroForm.style.minHeight = "";
}

function bootstrapClienteLayoutFromStorage() {
  if (!clienteCadastroForm) return;
  const raw = localStorage.getItem(CLIENTE_LAYOUT_KEY);
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return;
    applyClienteLayout(parsed);
  } catch {
    // Ignora layout inválido no storage.
  }
}

function persistClienteLayoutFromScreen() {
  const layout = collectClienteLayout();
  localStorage.setItem(CLIENTE_LAYOUT_KEY, JSON.stringify(layout));
  applyClienteLayout(layout);
}

function startClienteLayoutEdit() {
  if (!canEditLayoutsByProfile()) return;
  if (!clienteCadastroForm) return;
  ensureClienteLayoutBoxAttributes();
  if (!clienteCadastroForm.classList.contains("cliente-custom-layout")) {
    applyClienteLayout(collectClienteLayout());
  }
  clienteLayoutEditMode = true;
  clienteCadastroForm.classList.add("layout-edit-mode");
  setClienteLayoutToolbarState();
}

function stopClienteLayoutEdit() {
  clienteLayoutEditMode = false;
  clienteLayoutDragState = null;
  clienteCadastroForm?.classList.remove("layout-edit-mode");
  setClienteLayoutToolbarState();
}

function bindClienteLayoutEditorEvents() {
  if (!clienteCadastroForm || clienteLayoutResizeObserver) return;
  ensureClienteLayoutBoxAttributes();

  clienteLayoutResizeObserver = new ResizeObserver(() => {
    if (!clienteLayoutEditMode || !clienteCadastroForm) return;
    const layout = collectClienteLayout();
    clienteCadastroForm.style.minHeight = `${computeClienteLayoutMinHeight(layout)}px`;
  });
  getClienteLayoutBoxesArray().forEach((el) => clienteLayoutResizeObserver.observe(el));

  clienteCadastroForm.addEventListener("pointerdown", (event) => {
    if (!clienteLayoutEditMode || (!event.altKey && !event.shiftKey)) return;
    const node = event.target instanceof Element ? event.target : null;
    const box = node?.closest("[data-cliente-layout-box]");
    if (!box || !(box instanceof HTMLElement)) return;
    const rect = box.getBoundingClientRect();
    const mode = event.shiftKey ? "resize" : "move";
    clienteLayoutDragState = {
      mode,
      box,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originLeft: parseFloat(box.style.left || "0") || 0,
      originTop: parseFloat(box.style.top || "0") || 0,
      boxWidth: rect.width,
      boxHeight: rect.height,
    };
    box.setPointerCapture?.(event.pointerId);
    event.preventDefault();
  });

  clienteCadastroForm.addEventListener("pointermove", (event) => {
    if (!clienteLayoutDragState || clienteLayoutDragState.pointerId !== event.pointerId || !clienteCadastroForm) return;
    const dx = event.clientX - clienteLayoutDragState.startX;
    const dy = event.clientY - clienteLayoutDragState.startY;
    if (clienteLayoutDragState.mode === "resize") {
      const maxWidth = Math.max(160, clienteCadastroForm.clientWidth - clienteLayoutDragState.originLeft);
      const nextWidth = Math.max(160, Math.min(maxWidth, clienteLayoutDragState.boxWidth + dx));
      const nextHeight = Math.max(42, clienteLayoutDragState.boxHeight + dy);
      clienteLayoutDragState.box.style.width = `${Math.round(nextWidth)}px`;
      clienteLayoutDragState.box.style.height = `${Math.round(nextHeight)}px`;
    } else {
      const maxLeft = Math.max(0, clienteCadastroForm.clientWidth - clienteLayoutDragState.boxWidth);
      const nextLeft = Math.max(0, Math.min(maxLeft, clienteLayoutDragState.originLeft + dx));
      const nextTop = Math.max(0, clienteLayoutDragState.originTop + dy);
      clienteLayoutDragState.box.style.left = `${Math.round(nextLeft)}px`;
      clienteLayoutDragState.box.style.top = `${Math.round(nextTop)}px`;
    }
    const layout = collectClienteLayout();
    clienteCadastroForm.style.minHeight = `${computeClienteLayoutMinHeight(layout)}px`;
  });

  const finish = (event) => {
    if (!clienteLayoutDragState) return;
    if (event && clienteLayoutDragState.pointerId !== event.pointerId) return;
    clienteLayoutDragState = null;
  };
  clienteCadastroForm.addEventListener("pointerup", finish);
  clienteCadastroForm.addEventListener("pointercancel", finish);
}

function getLocacaoLayoutBoxesArray() {
  if (!locacaoCadastroForm) return [];
  return Array.from(locacaoCadastroForm.querySelectorAll("[data-loc-layout-box]"));
}

function ensureLocacaoLayoutBoxAttributes() {
  if (!locacaoCadastroForm) return;
  Array.from(locacaoCadastroForm.children).forEach((el, idx) => {
    if (!(el instanceof HTMLElement)) return;
    const tag = el.tagName;
    if (!["INPUT", "SELECT", "DIV", "P", "BUTTON"].includes(tag)) return;
    if (tag === "INPUT" && el.type === "checkbox") return;
    if (!el.dataset.locLayoutBox) {
      el.dataset.locLayoutBox = el.id || `locacaoItem${idx + 1}`;
    }
  });
}

function setLocacaoLayoutToolbarState() {
  if (!locLayoutEditToggleBtn) return;
  locLayoutEditToggleBtn.textContent = locLayoutEditMode ? "Sair edição" : "Editar caixas";
}

function collectLocacaoLayout() {
  if (!locacaoCadastroForm) return {};
  const boxes = getLocacaoLayoutBoxesArray();
  const formRect = locacaoCadastroForm.getBoundingClientRect();
  const layout = {};
  boxes.forEach((el) => {
    const key = String(el.dataset.locLayoutBox || "");
    if (!key) return;
    const rect = el.getBoundingClientRect();
    layout[key] = {
      left: Math.max(0, Math.round(rect.left - formRect.left)),
      top: Math.max(0, Math.round(rect.top - formRect.top)),
      width: Math.max(160, Math.round(rect.width)),
      height: Math.max(42, Math.round(rect.height)),
    };
  });
  return layout;
}

function computeLocacaoLayoutMinHeight(layout) {
  let maxBottom = 0;
  Object.values(layout || {}).forEach((item) => {
    if (!item) return;
    const bottom = Number(item.top || 0) + Number(item.height || 0);
    if (bottom > maxBottom) maxBottom = bottom;
  });
  return Math.max(320, Math.ceil(maxBottom + 16));
}

function applyLocacaoLayout(layoutInput) {
  if (!locacaoCadastroForm) return;
  ensureLocacaoLayoutBoxAttributes();
  const layout = layoutInput && typeof layoutInput === "object" ? layoutInput : {};
  const boxes = getLocacaoLayoutBoxesArray();
  locacaoCadastroForm.classList.add("loc-custom-layout");
  boxes.forEach((el) => {
    const key = String(el.dataset.locLayoutBox || "");
    const box = layout[key];
    if (!box) return;
    el.style.left = `${Math.max(0, Number(box.left || 0))}px`;
    el.style.top = `${Math.max(0, Number(box.top || 0))}px`;
    el.style.width = `${Math.max(160, Number(box.width || 160))}px`;
    el.style.height = `${Math.max(42, Number(box.height || 42))}px`;
  });
  locacaoCadastroForm.style.minHeight = `${computeLocacaoLayoutMinHeight(layout)}px`;
}

function clearLocacaoLayoutInlineStyles() {
  if (!locacaoCadastroForm) return;
  const boxes = getLocacaoLayoutBoxesArray();
  boxes.forEach((el) => {
    el.style.left = "";
    el.style.top = "";
    el.style.width = "";
    el.style.height = "";
  });
  locacaoCadastroForm.classList.remove("loc-custom-layout", "layout-edit-mode");
  locacaoCadastroForm.style.minHeight = "";
}

function bootstrapLocacaoLayoutFromStorage() {
  if (!locacaoCadastroForm) return;
  const raw = localStorage.getItem(LOC_LAYOUT_KEY);
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return;
    applyLocacaoLayout(parsed);
  } catch {
    // Ignora layout inválido no storage.
  }
}

function persistLocacaoLayoutFromScreen() {
  const layout = collectLocacaoLayout();
  localStorage.setItem(LOC_LAYOUT_KEY, JSON.stringify(layout));
  applyLocacaoLayout(layout);
}

function startLocacaoLayoutEdit() {
  if (!canEditLayoutsByProfile()) return;
  if (!locacaoCadastroForm) return;
  ensureLocacaoLayoutBoxAttributes();
  if (!locacaoCadastroForm.classList.contains("loc-custom-layout")) {
    applyLocacaoLayout(collectLocacaoLayout());
  }
  locLayoutEditMode = true;
  locacaoCadastroForm.classList.add("layout-edit-mode");
  setLocacaoLayoutToolbarState();
}

function stopLocacaoLayoutEdit() {
  locLayoutEditMode = false;
  locLayoutDragState = null;
  locacaoCadastroForm?.classList.remove("layout-edit-mode");
  setLocacaoLayoutToolbarState();
}

function bindLocacaoLayoutEditorEvents() {
  if (!locacaoCadastroForm || locLayoutResizeObserver) return;
  ensureLocacaoLayoutBoxAttributes();

  locLayoutResizeObserver = new ResizeObserver(() => {
    if (!locLayoutEditMode || !locacaoCadastroForm) return;
    const layout = collectLocacaoLayout();
    locacaoCadastroForm.style.minHeight = `${computeLocacaoLayoutMinHeight(layout)}px`;
  });
  getLocacaoLayoutBoxesArray().forEach((el) => locLayoutResizeObserver.observe(el));

  locacaoCadastroForm.addEventListener("pointerdown", (event) => {
    if (!locLayoutEditMode || (!event.altKey && !event.shiftKey)) return;
    const node = event.target instanceof Element ? event.target : null;
    const box = node?.closest("[data-loc-layout-box]");
    if (!box || !(box instanceof HTMLElement)) return;
    const rect = box.getBoundingClientRect();
    const mode = event.shiftKey ? "resize" : "move";
    locLayoutDragState = {
      mode,
      box,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originLeft: parseFloat(box.style.left || "0") || 0,
      originTop: parseFloat(box.style.top || "0") || 0,
      boxWidth: rect.width,
      boxHeight: rect.height,
    };
    box.setPointerCapture?.(event.pointerId);
    event.preventDefault();
  });

  locacaoCadastroForm.addEventListener("pointermove", (event) => {
    if (!locLayoutDragState || locLayoutDragState.pointerId !== event.pointerId || !locacaoCadastroForm) return;
    const dx = event.clientX - locLayoutDragState.startX;
    const dy = event.clientY - locLayoutDragState.startY;
    if (locLayoutDragState.mode === "resize") {
      const maxWidth = Math.max(160, locacaoCadastroForm.clientWidth - locLayoutDragState.originLeft);
      const nextWidth = Math.max(160, Math.min(maxWidth, locLayoutDragState.boxWidth + dx));
      const nextHeight = Math.max(42, locLayoutDragState.boxHeight + dy);
      locLayoutDragState.box.style.width = `${Math.round(nextWidth)}px`;
      locLayoutDragState.box.style.height = `${Math.round(nextHeight)}px`;
    } else {
      const maxLeft = Math.max(0, locacaoCadastroForm.clientWidth - locLayoutDragState.boxWidth);
      const nextLeft = Math.max(0, Math.min(maxLeft, locLayoutDragState.originLeft + dx));
      const nextTop = Math.max(0, locLayoutDragState.originTop + dy);
      locLayoutDragState.box.style.left = `${Math.round(nextLeft)}px`;
      locLayoutDragState.box.style.top = `${Math.round(nextTop)}px`;
    }
    const layout = collectLocacaoLayout();
    locacaoCadastroForm.style.minHeight = `${computeLocacaoLayoutMinHeight(layout)}px`;
  });

  const finish = (event) => {
    if (!locLayoutDragState) return;
    if (event && locLayoutDragState.pointerId !== event.pointerId) return;
    locLayoutDragState = null;
  };
  locacaoCadastroForm.addEventListener("pointerup", finish);
  locacaoCadastroForm.addEventListener("pointercancel", finish);
}

function buildFullOperacaoAccess() {
  return {
    cliente: true,
    veiculo: true,
    locacao: false,
    manutencao: false,
    lancamentoAluguel: false,
    lancamentoDespesa: false,
    funcionario: false,
  };
}

function normalizeOperacaoAccess(acessos, role) {
  if (role === "owner") return buildFullOperacaoAccess();
  const fallback = buildFullOperacaoAccess();
  return {
    cliente: acessos?.cliente ?? fallback.cliente,
    veiculo: acessos?.veiculo ?? fallback.veiculo,
    locacao: acessos?.locacao ?? fallback.locacao,
    manutencao: acessos?.manutencao ?? fallback.manutencao,
    lancamentoAluguel: acessos?.lancamentoAluguel ?? fallback.lancamentoAluguel,
    lancamentoDespesa: acessos?.lancamentoDespesa ?? fallback.lancamentoDespesa,
    funcionario: false,
  };
}

function findFuncionarioByCpfOrNome(cpfRaw, nomeRaw) {
  const cpf = onlyDigits(String(cpfRaw || ""));
  const nome = String(nomeRaw || "").trim().toLowerCase();
  return (
    funcionariosAccess.find((f) => {
      const cpfMatch = cpf.length === 11 && onlyDigits(String(f.cpf || "")) === cpf;
      const nomeMatch = Boolean(nome) && String(f.nome || "").trim().toLowerCase() === nome;
      return cpfMatch || nomeMatch;
    }) || null
  );
}

const FUNCIONARIO_NOME_SUGESTAO_MAX = 40;
let funcionarioAutofillGuard = false;

function clearFuncionarioNomeDatalist() {
  if (!cadFuncionarioNomeSugestoes) return;
  while (cadFuncionarioNomeSugestoes.firstChild) {
    cadFuncionarioNomeSugestoes.removeChild(cadFuncionarioNomeSugestoes.firstChild);
  }
}

function populateFuncionarioNomeDatalistFromQuery(queryRaw, options = {}) {
  if (!cadFuncionarioNomeSugestoes) return;
  const { allowAllWhenEmpty = false } = options;
  clearFuncionarioNomeDatalist();
  const trimmed = String(queryRaw || "").trim();
  const q = normalizeKey(trimmed);
  if (!q && !allowAllWhenEmpty) return;

  const nomesOrdenados = funcionariosAccess
    .map((f) => String(f.nome || "").trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, "pt-BR"));

  const vistos = new Set();
  const escolhidos = [];
  for (const nome of nomesOrdenados) {
    const nk = normalizeKey(nome);
    if (vistos.has(nk)) continue;
    if (q && !nk.includes(q)) continue;
    vistos.add(nk);
    escolhidos.push(nome);
    if (escolhidos.length >= FUNCIONARIO_NOME_SUGESTAO_MAX) break;
  }

  for (const nome of escolhidos) {
    const opt = document.createElement("option");
    opt.value = nome;
    cadFuncionarioNomeSugestoes.appendChild(opt);
  }
}

function tryAutofillFuncionarioNomePorCpf() {
  if (funcionarioAutofillGuard) return;
  if (funcionarioEdicaoCpf) {
    const cpfEdit = onlyDigits(String(funcionarioEdicaoCpf));
    const cpfCampo = onlyDigits(String(cadFuncionarioCpf?.value || ""));
    if (cpfEdit === cpfCampo) return;
  }
  const cpf = onlyDigits(String(cadFuncionarioCpf?.value || ""));
  if (cpf.length !== 11) return;
  const f = funcionariosAccess.find((x) => onlyDigits(String(x.cpf || "")) === cpf);
  if (!f) return;
  const nomeDest = String(f.nome || "").trim();
  if (!nomeDest) return;
  const nomeAtual = String(cadFuncionarioNome?.value || "").trim();
  if (normalizeKey(nomeAtual) === normalizeKey(nomeDest)) return;
  funcionarioAutofillGuard = true;
  cadFuncionarioNome.value = nomeDest;
  funcionarioAutofillGuard = false;
  populateFuncionarioNomeDatalistFromQuery(cadFuncionarioNome.value);
}

function tryAutofillFuncionarioCpfPorNome() {
  if (funcionarioAutofillGuard) return;
  if (cadFuncionarioCpf?.readOnly) return;
  const nome = String(cadFuncionarioNome?.value || "").trim();
  if (!nome) return;
  const nk = normalizeKey(nome);
  const matches = funcionariosAccess.filter(
    (x) => normalizeKey(String(x.nome || "").trim()) === nk
  );
  if (matches.length !== 1) return;
  const f = matches[0];
  const cpf = onlyDigits(String(f.cpf || ""));
  if (cpf.length !== 11) return;
  const cpfCampo = onlyDigits(String(cadFuncionarioCpf?.value || ""));
  if (cpfCampo === cpf) return;
  funcionarioAutofillGuard = true;
  cadFuncionarioCpf.value = formatCpf(cpf);
  funcionarioAutofillGuard = false;
}

function refreshFuncionarioAdminActionButtons() {
  const session = getSession();
  const isOwner = session?.tipo === "admin" && session?.role === "owner";
  const found = findFuncionarioByCpfOrNome(cadFuncionarioCpf?.value, cadFuncionarioNome?.value);

  if (cadFuncionarioEditBtn) {
    const podeEditar =
      isOwner && Boolean(found) && !found.blocked && funcionarioEdicaoCpf === null;
    cadFuncionarioEditBtn.classList.toggle("hidden", !podeEditar);
  }

  if (cadFuncionarioBlockBtn) {
    const podeBloquear =
      isOwner && Boolean(found) && found.role !== "owner" && !found.blocked && funcionarioEdicaoCpf === null;
    cadFuncionarioBlockBtn.classList.toggle("hidden", !podeBloquear);
  }
}

function sairModoEdicaoFuncionario() {
  funcionarioEdicaoCpf = null;
  if (cadFuncionarioCpf) {
    cadFuncionarioCpf.readOnly = false;
    cadFuncionarioCpf.removeAttribute("readonly");
  }
  if (cadFuncionarioSubmitBtn) cadFuncionarioSubmitBtn.textContent = "Salvar funcionário";
}

function aplicarFuncionarioAoFormulario(funcionario) {
  if (!funcionario) return;
  if (cadFuncionarioCpf) cadFuncionarioCpf.value = formatCpf(funcionario.cpf || "");
  if (cadFuncionarioNome) cadFuncionarioNome.value = String(funcionario.nome || "").trim();
  if (cadFuncionarioSenha) cadFuncionarioSenha.value = "";
  if (cadFuncionarioRole) cadFuncionarioRole.value = funcionario.role === "owner" ? "owner" : "operacao";
  const norm = normalizeOperacaoAccess(funcionario.acessos, funcionario.role);
  if (cadFuncionarioAcessoCliente) cadFuncionarioAcessoCliente.checked = Boolean(norm.cliente);
  if (cadFuncionarioAcessoVeiculo) cadFuncionarioAcessoVeiculo.checked = Boolean(norm.veiculo);
  if (cadFuncionarioAcessoLocacao) cadFuncionarioAcessoLocacao.checked = Boolean(norm.locacao);
  if (cadFuncionarioAcessoManutencao) cadFuncionarioAcessoManutencao.checked = Boolean(norm.manutencao);
  if (cadFuncionarioAcessoLancamentoAluguel)
    cadFuncionarioAcessoLancamentoAluguel.checked = Boolean(norm.lancamentoAluguel);
  if (cadFuncionarioAcessoLancamentoDespesa)
    cadFuncionarioAcessoLancamentoDespesa.checked = Boolean(norm.lancamentoDespesa);
  refreshFuncionarioAccessInputsByRole();
}

function getFuncionarioBySession() {
  const session = getSession();
  if (session?.tipo !== "admin") return null;
  const cpfSessao = onlyDigits(String(session.cpf || ""));
  return funcionariosAccess.find((f) => f.cpf === cpfSessao) || null;
}

function canAccessOperacaoTarget(target) {
  const funcionario = getFuncionarioBySession();
  if (!funcionario) return false;
  if (funcionario.role === "owner") return true;
  const acessos = normalizeOperacaoAccess(funcionario.acessos, funcionario.role);
  return Boolean(acessos[target]);
}

function refreshFuncionarioAccessInputsByRole() {
  const role = String(cadFuncionarioRole?.value || "operacao").trim() === "owner" ? "owner" : "operacao";
  const inputs = [
    cadFuncionarioAcessoCliente,
    cadFuncionarioAcessoVeiculo,
    cadFuncionarioAcessoLocacao,
    cadFuncionarioAcessoManutencao,
    cadFuncionarioAcessoLancamentoAluguel,
    cadFuncionarioAcessoLancamentoDespesa,
  ].filter(Boolean);
  const mark = role === "owner";
  inputs.forEach((input) => {
    input.checked = mark ? true : input.checked;
    input.disabled = mark;
  });
}

function saveFuncionariosAccess() {
  localStorage.setItem(FUNCIONARIOS_ACCESS_KEY, JSON.stringify(funcionariosAccess));
}

function isOperacaoPasswordValid(value) {
  return /^\d{6}$/.test(String(value || "").trim());
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
        blocked: Boolean(f?.blocked),
        mustChangePassword: Boolean(f?.mustChangePassword),
        acessos: normalizeOperacaoAccess(
          f?.acessos || null,
          String(f?.role || "operacao").trim() === "owner" ? "owner" : "operacao"
        ),
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
  adminSecundario.acessos = buildFullOperacaoAccess();
}
saveFuncionariosAccess();
refreshFuncionarioAccessInputsByRole();
refreshFuncionarioAdminActionButtons();

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
  preencherProtocoloLocacaoSeCampoVazio();
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
  adminOperacaoSection?.classList.toggle("hidden", !isOperacao);
  adminInformacaoSection?.classList.toggle("hidden", !isInformacao);
  adminDadosSection?.classList.toggle("hidden", !isDados);
  if (adminOperacaoMenu) adminOperacaoMenu.classList.toggle("hidden", !isOperacao);
  if (adminInformacaoMenu) adminInformacaoMenu.classList.toggle("hidden", !isInformacao);
  if (adminNavOperacao) adminNavOperacao.classList.toggle("active", isOperacao);
  if (adminNavInformacao) adminNavInformacao.classList.toggle("active", isInformacao);
  if (adminNavDados) adminNavDados.classList.toggle("active", isDados);
  if (!isDados) {
    if (adminDadosUsoBtn) adminDadosUsoBtn.classList.remove("active");
    if (adminValidacaoCadastroBtn) adminValidacaoCadastroBtn.classList.remove("active");
  } else {
    setAdminDadosSubsection(adminDadosAbaAtual || "dadosUso");
  }
}

function toggleAdminSection(section) {
  const isOperacaoOpen =
    section === "operacao" &&
    adminOperacaoSection &&
    !adminOperacaoSection.classList.contains("hidden");
  const isInformacaoOpen =
    section === "informacao" &&
    adminInformacaoSection &&
    !adminInformacaoSection.classList.contains("hidden");
  const isDadosOpen =
    section === "dados" &&
    adminDadosSection &&
    !adminDadosSection.classList.contains("hidden");
  if (isOperacaoOpen || isInformacaoOpen || isDadosOpen) {
    setAdminSection("");
    return false;
  }
  setAdminSection(section);
  return true;
}

function setOperacaoSubsection(target) {
  const targetSafe = target || "cliente";
  const permitido =
    OPERACAO_ACCESS_TARGETS.includes(targetSafe) && canAccessOperacaoTarget(targetSafe);
  operacaoAbaAtual = permitido ? targetSafe : "cliente";
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
    operacaoFuncionarioSection.classList.toggle("hidden", operacaoAbaAtual !== "funcionario");
  }
  if (operacaoAbaAtual === "locacao") {
    ensureLocacaoInicioDefault();
    applyLocacaoPlanoRules();
  }
  operacaoTargetButtons.forEach((button) => {
    const buttonTarget = String(button.dataset.target || "");
    button.classList.toggle("hidden", !canAccessOperacaoTarget(buttonTarget));
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

function setAdminDadosSubsection(target) {
  adminDadosAbaAtual = target === "validacaoCadastro" ? "validacaoCadastro" : "dadosUso";
  if (adminDadosUsoSection) adminDadosUsoSection.classList.toggle("hidden", adminDadosAbaAtual !== "dadosUso");
  if (adminValidacaoCadastroSection) {
    adminValidacaoCadastroSection.classList.toggle("hidden", adminDadosAbaAtual !== "validacaoCadastro");
  }
  if (adminDadosUsoBtn) adminDadosUsoBtn.classList.toggle("active", adminDadosAbaAtual === "dadosUso");
  if (adminValidacaoCadastroBtn) {
    adminValidacaoCadastroBtn.classList.toggle("active", adminDadosAbaAtual === "validacaoCadastro");
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

function loadQuadroReceitaOverridesMap() {
  const arr = loadCadastro(CAD_QUADRO_RECEITA_OVERRIDES_KEY);
  const out = {};
  if (!Array.isArray(arr)) return out;
  arr.forEach((row) => {
    if (!row || row.key == null) return;
    const v = Number(row.valor);
    if (!Number.isFinite(v)) return;
    out[String(row.key)] = v;
  });
  return out;
}

function saveQuadroReceitaOverridesMap(map) {
  const arr = Object.keys(map).map((key) => ({
    key,
    valor: map[key],
  }));
  saveCadastro(CAD_QUADRO_RECEITA_OVERRIDES_KEY, arr);
}

function quadroOverrideReceitaKey(cpfDigits, placaRaw, block, mesAbbr, slotIdx) {
  return `${onlyDigits(String(cpfDigits || ""))}_${normalizePlate(placaRaw || "")}_R${block}_${String(mesAbbr || "").toUpperCase()}_${slotIdx}`;
}

function quadroOverrideCalendarKey(cpfDigits, placaRaw, ymKey, slotIdx) {
  return `${onlyDigits(String(cpfDigits || ""))}_${normalizePlate(placaRaw || "")}_CAL_${ymKey}_${slotIdx}`;
}

/** Regra de negócio: último valor salvo com senha de administrador é soberano (inclusive zero). */
function hasQuadroReceitaOverrideKey(key) {
  const store = loadQuadroReceitaOverridesMap();
  return Object.prototype.hasOwnProperty.call(store, String(key || ""));
}

function isCpfComEdicaoLancamentoBloqueada(cpfDigits) {
  return CPF_LANCAMENTO_EDICAO_BLOQUEADA.has(onlyDigits(String(cpfDigits || "")));
}

function applyQuadroOverridesToPackedSix(cpfDigits, placaRaw, block, mesAbbr, six) {
  const store = loadQuadroReceitaOverridesMap();
  six.forEach((m, i) => {
    const k = quadroOverrideReceitaKey(cpfDigits, placaRaw, block, mesAbbr, i);
    if (!Object.prototype.hasOwnProperty.call(store, k)) return;
    const v = store[k];
    if (!Number.isFinite(v)) return;
    six[i] = {
      ...six[i],
      raw: String(v),
      val: v,
      empty: Math.abs(v) < 1e-9,
    };
    if (Math.abs(v) >= 1e-9) six[i].empty = false;
  });
}

/** Sobrescreve totais calculados pelo que o administrador gravou no quadro CAL (prioridade máxima). */
function applyQuadroOverridesToCalendarSlots(cpfDigits, placaRaw, ymKey, slots) {
  const store = loadQuadroReceitaOverridesMap();
  slots.forEach((s, i) => {
    const k = quadroOverrideCalendarKey(cpfDigits, placaRaw, ymKey, i);
    if (!Object.prototype.hasOwnProperty.call(store, k)) return;
    const v = store[k];
    if (!Number.isFinite(v)) return;
    s.total = v;
  });
}

/** Pago vindo do registro (planilha) + soma dos lançamentos de aluguel do app (CPF/placa e, se informado, nº do contrato). */
function totalPagoBarComLancamentosApp(cpfDigits, placaRaw, pagoRegistro, numeroContratoOpt) {
  const base = parseCurrencyBR(pagoRegistro || 0);
  const appSum = collectLancamentosFilteredQuadro(
    onlyDigits(cpfDigits),
    placaRaw,
    numeroContratoOpt
  ).reduce((a, l) => a + getLancamentoAluguelValor(l), 0);
  return base + appSum;
}

/** Pago da planilha + lançamentos do app — mesmo critério do quadro/resumo (por CPF/placa). */
function pagoHarmonizadoRegistro(r) {
  const cpf = onlyDigits(String(r?.cpf || ""));
  if (cpf.length !== 11) return parseCurrencyBR(r?.pago);
  return totalPagoBarComLancamentosApp(cpf, String(r?.placa || "").trim(), r?.pago);
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

/**
 * Zera cadastro de locações, quadro geral, lançamentos de aluguel e dados ligados.
 * Não altera dk_clientes_cadastro nem dk_veiculos_cadastro.
 * Impede reimportação automática da planilha (locacoes-seed) neste navegador.
 */
function resetLocacaoStackForSiteEntryOnce() {
  if (localStorage.getItem(RESET_LOCACAO_STACK_SITE_V2_KEY) === "done") return;

  saveCadastro(CAD_LOCACOES_KEY, []);
  saveCadastro(LOCACAO_DATABASE_KEY, []);
  saveCadastro(CAD_LANCAMENTOS_ALUGUEL_KEY, []);
  saveCadastro(CAD_QUADRO_RECEITA_OVERRIDES_KEY, []);
  saveComprovantesBancoMap({});
  localStorage.removeItem(DAILY_RECON_KEY);
  LEGACY_LANCAMENTO_KEYS.forEach((k) => localStorage.removeItem(k));
  localStorage.setItem(IMPORT_LOCACOES_PLANILHA_ONCE_KEY, "done");

  try {
    addAuditLog(
      "reset_stack",
      "locacao",
      "Migracao site v2: base de locacao e lancamentos zerada; cadastrar locacoes e lancamentos pelo site."
    );
  } catch {
    // ignorar se auditoria indisponivel no bootstrap
  }

  localStorage.setItem(RESET_LOCACAO_STACK_SITE_V2_KEY, "done");
}

function resetProjetoSomenteCadastrosV3Once() {
  if (localStorage.getItem(RESET_PROJETO_SOMENTE_CADASTROS_V3_KEY) === "done") return;

  saveCadastro(CAD_CLIENTES_VALIDACAO_KEY, []);
  saveCadastro(CAD_LOCACOES_KEY, []);
  saveCadastro(LOCACAO_DATABASE_KEY, []);
  saveCadastro(CAD_MANUTENCOES_KEY, []);
  saveCadastro(CAD_LANCAMENTOS_ALUGUEL_KEY, []);
  saveCadastro(CAD_QUADRO_RECEITA_OVERRIDES_KEY, []);
  saveComprovantesBancoMap({});
  localStorage.removeItem(AUDIT_LOG_KEY);
  localStorage.removeItem(DAILY_RECON_KEY);
  LEGACY_LANCAMENTO_KEYS.forEach((k) => localStorage.removeItem(k));
  localStorage.removeItem("dk_sessao_cliente");
  localStorage.removeItem(HOME_LAYOUT_KEY);
  localStorage.removeItem(FUNC_LAYOUT_KEY);
  localStorage.removeItem(LOC_LAYOUT_KEY);
  localStorage.removeItem(CLIENTE_LAYOUT_KEY);
  localStorage.removeItem(CLEAR_LOCACOES_ONCE_KEY);
  localStorage.removeItem(RESET_LOCACAO_STACK_SITE_V2_KEY);
  localStorage.removeItem(IMPORT_LOCACOES_PLANILHA_ONCE_KEY);

  localStorage.setItem(RESET_PROJETO_SOMENTE_CADASTROS_V3_KEY, "done");
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

function findClientePendenteValidacaoByCpf(cpf) {
  const normalized = onlyDigits(String(cpf || ""));
  if (!normalized) return null;
  const pendentes = loadCadastro(CAD_CLIENTES_VALIDACAO_KEY);
  return pendentes.find((c) => onlyDigits(String(c.cpf || "")) === normalized) || null;
}

function enqueueClienteParaValidacao(payload, sourceLabel) {
  const cpf = onlyDigits(String(payload?.cpf || ""));
  const nome = String(payload?.nome || "").trim();
  if (cpf.length !== 11 || !nome) {
    return { ok: false, message: "PREENCHA NOME E CPF VALIDOS PARA ENVIAR PARA AVALIACAO." };
  }
  if (findClienteByCpfCadastro(cpf)) {
    return { ok: false, message: "CPF JA CADASTRADO NA BASE PRINCIPAL." };
  }
  if (findClientePendenteValidacaoByCpf(cpf)) {
    return { ok: false, message: "ESTE CPF JA ESTA PENDENTE NA VALIDACAO DE CADASTRO." };
  }
  const pendentes = loadCadastro(CAD_CLIENTES_VALIDACAO_KEY);
  const novoPendente = {
    ...payload,
    id: Date.now(),
    createdAt: Date.now(),
    cpf,
    nome,
    status: "PENDENTE_VALIDACAO",
  };
  pendentes.push(novoPendente);
  saveCadastro(CAD_CLIENTES_VALIDACAO_KEY, pendentes);
  addAuditLog(
    "enviar_cliente_validacao",
    "cliente_validacao",
    `${nome} - CPF ${formatCpf(cpf)}${sourceLabel ? ` - origem ${sourceLabel}` : ""}`
  );
  return { ok: true };
}

function upsertClienteCadastroByCpf(payload, status) {
  const cpf = onlyDigits(String(payload?.cpf || ""));
  if (cpf.length !== 11) return false;
  const clientes = loadCadastro(CAD_CLIENTES_KEY);
  const idx = clientes.findIndex((c) => onlyDigits(String(c.cpf || "")) === cpf);
  const base = {
    ...payload,
    cpf,
    status: status || payload?.status || "ATIVO",
  };
  if (idx >= 0) clientes[idx] = { ...clientes[idx], ...base };
  else clientes.push({ ...base, id: Number(payload?.id || Date.now()) });
  saveCadastro(CAD_CLIENTES_KEY, clientes);
  return true;
}

let clienteCepLookupSeq = 0;

function formatCepMask(value) {
  const digits = onlyDigits(String(value || "")).slice(0, 8);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

function setCadClienteCepStatus(message, type = "") {
  if (!cadClienteCepStatus) return;
  cadClienteCepStatus.textContent = String(message || "");
  cadClienteCepStatus.classList.remove("hidden", "error", "success");
  if (!message) {
    cadClienteCepStatus.classList.add("hidden");
    return;
  }
  if (type === "error") cadClienteCepStatus.classList.add("error");
  if (type === "success") cadClienteCepStatus.classList.add("success");
}

function setPublicCadCepStatus(message, type = "") {
  if (!publicCadClienteCepStatus) return;
  publicCadClienteCepStatus.textContent = String(message || "");
  publicCadClienteCepStatus.classList.remove("hidden", "error", "success");
  if (!message) {
    publicCadClienteCepStatus.classList.add("hidden");
    return;
  }
  if (type === "error") publicCadClienteCepStatus.classList.add("error");
  if (type === "success") publicCadClienteCepStatus.classList.add("success");
}

function setClienteEnderecoConfirmado(confirmed) {
  if (!clienteCadastroForm) return;
  clienteCadastroForm.dataset.enderecoConfirmado = confirmed ? "1" : "0";
  if (cadClienteConfirmEnderecoBtn) {
    cadClienteConfirmEnderecoBtn.classList.toggle("active", confirmed);
  }
}

function invalidateClienteEnderecoConfirmacao() {
  setClienteEnderecoConfirmado(false);
}

function setPublicClienteEnderecoConfirmado(confirmed) {
  if (!clientePublicoCadastroForm) return;
  clientePublicoCadastroForm.dataset.enderecoConfirmado = confirmed ? "1" : "0";
  if (publicCadClienteConfirmEnderecoBtn) {
    publicCadClienteConfirmEnderecoBtn.classList.toggle("active", confirmed);
  }
}

async function buscarEnderecoPublicoPorCep(force = false) {
  if (!publicCadClienteCep || !publicCadClienteMunicipioUf || !publicCadClienteEndereco) return;
  const cepDigits = onlyDigits(String(publicCadClienteCep.value || ""));
  publicCadClienteCep.value = formatCepMask(cepDigits);
  if (cepDigits.length !== 8) {
    setPublicCadCepStatus("");
    return;
  }
  if (!force && publicCadClienteCep.dataset.lastLookupCep === cepDigits) return;
  publicCadClienteCep.dataset.lastLookupCep = cepDigits;
  setPublicCadCepStatus("🔎 Buscando CEP...", "");
  try {
    const resp = await fetch(`https://viacep.com.br/ws/${cepDigits}/json/`);
    if (!resp.ok) throw new Error("CEP lookup HTTP error");
    const data = await resp.json();
    if (data?.erro) {
      setPublicCadCepStatus("⚠️ CEP não encontrado. Preencha manualmente.", "error");
      return;
    }
    const cidade = String(data.localidade || "").trim();
    const uf = String(data.uf || "").trim();
    const logradouro = String(data.logradouro || "").trim();
    const bairro = String(data.bairro || "").trim();
    if (cidade && uf) publicCadClienteMunicipioUf.value = `${cidade}/${uf}`;
    const prefixo = [logradouro, bairro].filter(Boolean).join(" - ").trim();
    if (prefixo) publicCadClienteEndereco.value = prefixo;
    setPublicCadCepStatus("✅ CEP encontrado. Confira e complete número/complemento.", "success");
    setPublicClienteEnderecoConfirmado(false);
  } catch {
    setPublicCadCepStatus("⚠️ Não foi possível consultar o CEP agora.", "error");
  }
}

async function buscarEnderecoClientePorCep(force = false) {
  if (!cadClienteCepInput || !cadClienteMunicipioUfInput || !cadClienteEnderecoInput) return;
  const cepDigits = onlyDigits(String(cadClienteCepInput.value || ""));
  cadClienteCepInput.value = formatCepMask(cepDigits);
  if (cepDigits.length !== 8) {
    setCadClienteCepStatus("");
    return;
  }
  if (!force && cadClienteCepInput.dataset.lastLookupCep === cepDigits) return;
  const lookupSeq = ++clienteCepLookupSeq;
  cadClienteCepInput.dataset.lastLookupCep = cepDigits;
  setCadClienteCepStatus("🔎 Buscando CEP...", "");
  const originalMunicipio = String(cadClienteMunicipioUfInput.value || "").trim();
  const originalEndereco = String(cadClienteEnderecoInput.value || "").trim();
  try {
    const resp = await fetch(`https://viacep.com.br/ws/${cepDigits}/json/`);
    if (!resp.ok) throw new Error("CEP lookup HTTP error");
    const data = await resp.json();
    if (lookupSeq !== clienteCepLookupSeq) return;
    if (data?.erro) {
      setCadClienteCepStatus(
        "⚠️ CEP não encontrado. Preencha endereço, cidade e estado manualmente.",
        "error"
      );
      return;
    }
    const cidade = String(data.localidade || "").trim();
    const uf = String(data.uf || "").trim();
    const logradouro = String(data.logradouro || "").trim();
    const bairro = String(data.bairro || "").trim();
    if (cidade && uf) {
      cadClienteMunicipioUfInput.value = `${cidade}/${uf}`;
    } else if (!originalMunicipio && cidade) {
      cadClienteMunicipioUfInput.value = cidade;
    }
    const prefixo = [logradouro, bairro].filter(Boolean).join(" - ").trim();
    if (prefixo) {
      if (!originalEndereco || originalEndereco === cadClienteEnderecoInput.dataset.autoEnderecoBase) {
        cadClienteEnderecoInput.value = prefixo;
      }
      cadClienteEnderecoInput.dataset.autoEnderecoBase = prefixo;
    }
    setCadClienteCepStatus(
      "✅ CEP encontrado. Confira e complete número/complemento no endereço.",
      "success"
    );
    invalidateClienteEnderecoConfirmacao();
  } catch {
    // Falha de rede/serviço: mantém preenchimento manual sem bloquear o cadastro.
    setCadClienteCepStatus(
      "⚠️ Não foi possível consultar o CEP agora. Você pode preencher manualmente.",
      "error"
    );
  }
}

function preencherFormCliente(cliente) {
  const enderecoRaw = String(cliente.endereco || "").trim();
  const enderecoBase =
    String(cliente.enderecoBase || "").trim() || enderecoRaw.split(",")[0]?.trim() || "";
  const complemento =
    String(cliente.complemento || "").trim() ||
    enderecoRaw
      .split(",")
      .slice(1)
      .join(",")
      .trim();
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
  document.getElementById("cadClienteCep").value = formatCepMask(cliente.cep || "");
  document.getElementById("cadClienteMunicipioUf").value = cliente.municipioUf || "";
  document.getElementById("cadClienteEndereco").value = enderecoBase;
  if (cadClienteComplementoInput) cadClienteComplementoInput.value = complemento;
  if (cadClienteCepInput) {
    cadClienteCepInput.dataset.lastLookupCep = onlyDigits(String(cliente.cep || ""));
  }
  if (cadClienteEnderecoInput) {
    cadClienteEnderecoInput.dataset.autoEnderecoBase = "";
  }
  setCadClienteCepStatus("");
  setClienteEnderecoConfirmado(true);
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
  if (!cadLocacaoPlacaInput) return;
  cadLocacaoPlacaInput.disabled = blocked;
  if (cadLocacaoInicioInput) cadLocacaoInicioInput.disabled = blocked;
  if (cadLocacaoFimInput) cadLocacaoFimInput.disabled = blocked;
  if (cadLocacaoValorInput) cadLocacaoValorInput.disabled = blocked;
  if (cadLocacaoInvestimentoInput) cadLocacaoInvestimentoInput.disabled = blocked;
  if (cadLocacaoPlanoInputs && cadLocacaoPlanoInputs.length) {
    cadLocacaoPlanoInputs.forEach((inp) => {
      inp.disabled = blocked;
    });
  }
  if (cadLocacaoContratoInput) cadLocacaoContratoInput.disabled = blocked;
  [
    cadLocacaoStatusInput,
    cadLocacaoDiaPagtoInput,
    cadLocacaoPeriodoLocacaoInput,
    cadLocacaoModalidadeInput,
    cadLocacaoMarcaModeloInput,
    cadLocacaoOpcaoContratoInput,
    cadLocacaoPeriodoContratoInput,
    cadLocacaoConfigPrecoKmInput,
    cadLocacaoTabelaInput,
    cadLocacaoValorParcelaInput,
    cadLocacaoClienteCodigoInput,
  ].forEach((el) => {
    if (el) el.disabled = blocked;
  });
  if (locacaoSubmitButton) locacaoSubmitButton.disabled = blocked;
  if (!blocked) {
    applyLocacaoPlanoRules();
  }
}

function getLocacaoPlanoSelecionado() {
  const checked = Array.from(cadLocacaoPlanoInputs).find((inp) => inp.checked);
  const plano = String(checked?.value || "").trim().toUpperCase();
  return plano === "DK MEU TRANSPORTE" ? "DK MEU TRANSPORTE" : "DK MINHA MOTO";
}

function addCalendarMonths(date, months) {
  const d = toDateOnly(date);
  if (!d) return null;
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const originalDay = x.getDate();
  x.setDate(1);
  x.setMonth(x.getMonth() + months);
  const lastDay = new Date(x.getFullYear(), x.getMonth() + 1, 0).getDate();
  x.setDate(Math.min(originalDay, lastDay));
  return x;
}

function formatLocacaoCurrencyInput(inputEl) {
  if (!inputEl) return;
  const n = parseCurrencyBR(String(inputEl.value || ""));
  inputEl.value = n > 0 ? currencyBRL(n) : "";
}

function recomputeLocacaoFimByPlano() {
  if (!cadLocacaoInicioInput || !cadLocacaoFimInput) return;
  const inicio = parseBrDate(String(cadLocacaoInicioInput.value || "").trim());
  if (!inicio) return;
  const plano = getLocacaoPlanoSelecionado();
  const fim =
    plano === "DK MINHA MOTO" ? addCalendarDays(inicio, 150 * 7) : addCalendarMonths(inicio, 1);
  if (fim) cadLocacaoFimInput.value = formatDataDmaBr(fim);
}

function applyLocacaoPlanoRules() {
  const plano = getLocacaoPlanoSelecionado();
  if (cadLocacaoInvestimentoInput) {
    const bloquearInvestimento = plano === "DK MEU TRANSPORTE";
    const formBloqueado = Boolean(locacaoSubmitButton?.disabled);
    cadLocacaoInvestimentoInput.disabled = formBloqueado || bloquearInvestimento;
    if (bloquearInvestimento) {
      cadLocacaoInvestimentoInput.value = currencyBRL(0);
    }
  }
  if (cadLocacaoOpcaoContratoInput) {
    const v = String(cadLocacaoOpcaoContratoInput.value || "").trim();
    if (!v) {
      cadLocacaoOpcaoContratoInput.value =
        plano === "DK MEU TRANSPORTE" ? "DK MEU TRANSPORTE" : "DK MINHA MOTO";
    }
  }
  if (cadLocacaoPeriodoContratoInput) {
    const v = String(cadLocacaoPeriodoContratoInput.value || "").trim();
    if (!v) {
      cadLocacaoPeriodoContratoInput.value = plano === "DK MINHA MOTO" ? "150 SEMANAS" : "1 SEMANA";
    }
  }
  recomputeLocacaoFimByPlano();
}

function syncCadLocacaoClienteCodigoFromCpf() {
  if (!cadLocacaoClienteCodigoInput) return;
  const v = String(cadLocacaoClienteCodigoInput.value || "").trim();
  if (v) return;
  const cpf = onlyDigits(String(cadLocacaoCpfInput?.value || ""));
  if (cpf.length !== 11) return;
  const c = findClienteByCpfCadastro(cpf);
  const cod = String(c?.codigo || "").trim();
  if (cod) cadLocacaoClienteCodigoInput.value = cod;
}

function suggestCadLocacaoFromVeiculoPlaca() {
  if (!cadLocacaoPlacaInput) return;
  const placaKey = normalizePlate(String(cadLocacaoPlacaInput.value || ""));
  if (!placaKey) return;
  const v = getVehicleMapByPlate().get(placaKey);
  if (!v) return;
  if (cadLocacaoModalidadeInput && !String(cadLocacaoModalidadeInput.value || "").trim()) {
    cadLocacaoModalidadeInput.value = normalizeKey(v.tipo).includes("CARRO") ? "CARRO" : "MOTO";
  }
  if (cadLocacaoMarcaModeloInput && !String(cadLocacaoMarcaModeloInput.value || "").trim()) {
    const mm = [String(v.marca || "").trim(), String(v.modelo || "").trim()].filter(Boolean).join(" / ");
    if (mm) cadLocacaoMarcaModeloInput.value = mm;
  }
}

function validateLocacaoCpfBlock() {
  if (!cadLocacaoCpfInput) return true;
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
  if (!cadLocacaoPlacaInput || !cadLocacaoPlacaSugestoes) return;
  const options = getVeiculosSemProtocoloAtivo()
    .map((v) => {
      const placa = String(v.placa || "").trim().toUpperCase();
      const modelo = String(v.modelo || "").trim() || "Modelo nao informado";
      return { placa, modelo };
    })
    .filter((v) => v.placa);
  const previousValue = String(cadLocacaoPlacaInput.value || "").trim().toUpperCase();
  cadLocacaoPlacaSugestoes.innerHTML = options
    .map((v) => `<option value="${v.placa}" label="${escapeHtml(v.modelo)}"></option>`)
    .join("");
  cadLocacaoPlacaInput.value = previousValue;
  if (cadLocacaoMotosDisponiveisCountEl) {
    cadLocacaoMotosDisponiveisCountEl.textContent = String(options.length);
  }
}

/**
 * Regra da locação: placa disponível só se não houver contrato aberto
 * (cadastro local sem data fim OU linha vigente em receita2026 / planilha sem data fim).
 */
function getVeiculosSemProtocoloAtivo() {
  const allVeiculos = loadCadastro(CAD_VEICULOS_KEY);
  const manutencoes = loadCadastro(CAD_MANUTENCOES_KEY);
  const placasEmManutencao = new Set(
    manutencoes
      .filter((m) => !String(m.dataRealSaida || "").trim())
      .map((m) => normalizePlate(m.placa))
      .filter(Boolean)
  );
  const placasComProtocoloAtivo = getActivePlatesSet();
  return allVeiculos
    .filter((v) => {
      const plate = normalizePlate(v.placa);
      const indisponivel = normalizeKey(v.status).includes("INDISPONIVEL POR");
      return (
        plate &&
        !indisponivel &&
        !placasEmManutencao.has(plate) &&
        !placasComProtocoloAtivo.has(plate)
      );
    })
    .sort((a, b) => {
      const byModelo = String(a.modelo || "").localeCompare(String(b.modelo || ""), "pt-BR");
      if (byModelo !== 0) return byModelo;
      return normalizePlate(a.placa).localeCompare(normalizePlate(b.placa));
    });
}

function refreshLocacaoClienteSugestoes() {
  const candidatos = getLancamentoClienteCandidates().slice(0, 200);
  if (cadLocacaoCpfSugestoes) {
    cadLocacaoCpfSugestoes.innerHTML = candidatos
      .map(
        (c) =>
          `<option value="${formatCpf(c.cpf)}" label="${escapeHtml(String(c.nome || "").trim())}"></option>`
      )
      .join("");
  }
  if (cadLocacaoClienteNomeSugestoes) {
    cadLocacaoClienteNomeSugestoes.innerHTML = candidatos
      .map((c) => `<option value="${escapeHtml(String(c.nome || "").trim())}" label="${formatCpf(c.cpf)}"></option>`)
      .join("");
  }
}

function applyLocacaoClienteByCpf(cpfRaw) {
  const cpf = onlyDigits(String(cpfRaw || ""));
  if (cpf.length !== 11) return;
  const cli = findClienteByCpfCadastro(cpf);
  if (!cli || !cadLocacaoClienteNomeInput) return;
  cadLocacaoClienteNomeInput.value = String(cli.nome || "").trim();
}

function applyLocacaoClienteByNome(nomeRaw) {
  const nome = normalizeName(String(nomeRaw || ""));
  if (!nome) return;
  const match = getLancamentoClienteCandidates().find(
    (c) => normalizeName(String(c.nome || "")) === nome
  );
  if (!match) return;
  if (cadLocacaoCpfInput) cadLocacaoCpfInput.value = formatCpf(match.cpf);
  validateLocacaoCpfBlock();
}

function normalizeKey(value) {
  return String(value || "").trim().toUpperCase();
}

/** Na locação, INATIVO equivale a FINALIZADO (contrato encerrado). */
function normalizeStatusLocacaoExibicao(value) {
  const t = String(value || "").trim();
  if (!t) return "";
  if (normalizeKey(t) === "INATIVO") return "FINALIZADO";
  return t;
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
    <p><strong>Complemento:</strong> ${payload.complemento || "-"}</p>
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
    <p><strong>Cód. cliente:</strong> ${escapeHtml(String(payload.clienteCodigo || "").trim() || "—")}</p>
    <p><strong>Nº contrato:</strong> ${escapeHtml(String(payload.numeroContrato || "").trim() || "—")}</p>
    <p><strong>Status:</strong> ${escapeHtml(
      normalizeStatusLocacaoExibicao(String(payload.statusLocacao || "").trim()) || "—"
    )}</p>
    <p><strong>Plano:</strong> ${escapeHtml(String(payload.plano || "-"))}</p>
    <p><strong>Placa:</strong> ${payload.placa || "-"}</p>
    <p><strong>Modalidade:</strong> ${escapeHtml(String(payload.modalidade || "").trim() || "—")}</p>
    <p><strong>Marca/Modelo:</strong> ${escapeHtml(String(payload.marcaModelo || "").trim() || "—")}</p>
    <p><strong>Opção de contrato:</strong> ${escapeHtml(String(payload.opcaoContrato || "").trim() || "—")}</p>
    <p><strong>Período de contrato:</strong> ${escapeHtml(String(payload.periodoContrato || "").trim() || "—")}</p>
    <p><strong>Início:</strong> ${payload.inicio || "-"}</p>
    <p><strong>Dia de pagto:</strong> ${escapeHtml(String(payload.diaPagto || "").trim() || "—")}</p>
    <p><strong>Fim:</strong> ${payload.fim || "-"}</p>
    <p><strong>Período (locação):</strong> ${escapeHtml(String(payload.periodoLocacao || "").trim() || "—")}</p>
    <p><strong>Km retirada:</strong> ${escapeHtml(String(payload.kmInicial || "").trim() || "—")}</p>
    <p><strong>Config. preço/km:</strong> ${escapeHtml(String(payload.configPrecoKm || "").trim() || "—")}</p>
    <p><strong>Tabela:</strong> ${escapeHtml(String(payload.tabela || "").trim() || "—")}</p>
    <p><strong>Caixa 01 (locação):</strong> ${payload.valorLocacao || "-"}</p>
    <p><strong>Caixa 02 (investimento):</strong> ${payload.valorInvestimento || "-"}</p>
    <p><strong>Valor da parcela:</strong> ${payload.valorParcela || "-"}</p>
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
  const ncConf = normalizeNumeroContratoKey(payload.numeroContrato || "");
  lancamentoAluguelConfirmResumo.innerHTML = `
    <p><strong>Código:</strong> ${payload.codigoLancamento || "-"}</p>
    <p><strong>Nº contrato:</strong> ${ncConf ? escapeHtml(ncConf) : "-"}</p>
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

function findBestContratoForLancamentoByCpf(cpfDigits, numeroContratoOpt) {
  const cpf = onlyDigits(String(cpfDigits || ""));
  const nc = normalizeNumeroContratoKey(numeroContratoOpt || "");
  if (cpf.length !== 11) return null;
  const adminMatches = getAdminDataset().filter((r) => onlyDigits(String(r.cpf || "")) === cpf);
  if (adminMatches.length && !nc) {
    const ativo = adminMatches.find((r) => !String(r.fim || "").trim());
    if (ativo) return ativo;
    return adminMatches
      .slice()
      .sort((a, b) => (parseRecordStartDate(b)?.getTime() || 0) - (parseRecordStartDate(a)?.getTime() || 0))[0];
  }
  let locMatches = loadCadastro(CAD_LOCACOES_KEY).filter((l) => onlyDigits(String(l.cpf || "")) === cpf);
  if (nc) {
    const porNc = locMatches.filter((l) => normalizeNumeroContratoKey(l.numeroContrato) === nc);
    if (porNc.length) locMatches = porNc;
    else return null;
  }
  if (!locMatches.length) return null;
  const ativoLoc = locMatches.find((l) => !String(l.fim || "").trim());
  return ativoLoc || locMatches[locMatches.length - 1];
}

function findBestContratoForLancamentoByPlaca(placaRaw, numeroContratoOpt) {
  const placa = normalizePlate(placaRaw);
  const nc = normalizeNumeroContratoKey(numeroContratoOpt || "");
  if (!placa) return null;
  const adminMatches = getAdminDataset().filter((r) => normalizePlate(r.placa) === placa);
  if (adminMatches.length && !nc) {
    const ativo = adminMatches.find((r) => !String(r.fim || "").trim());
    if (ativo) return ativo;
    return adminMatches
      .slice()
      .sort((a, b) => (parseRecordStartDate(b)?.getTime() || 0) - (parseRecordStartDate(a)?.getTime() || 0))[0];
  }
  let locMatches = loadCadastro(CAD_LOCACOES_KEY).filter((l) => normalizePlate(l.placa) === placa);
  if (nc) {
    const porNc = locMatches.filter((l) => normalizeNumeroContratoKey(l.numeroContrato) === nc);
    if (porNc.length) locMatches = porNc;
    else return null;
  }
  if (!locMatches.length) return null;
  const ativoLoc = locMatches.find((l) => !String(l.fim || "").trim());
  return ativoLoc || locMatches[locMatches.length - 1];
}

/** Vários registros receita no mesmo CPF: preferir **ativo** (sem fim de contrato), senão o de início mais recente. */
function pickActiveOrLatestLocacaoRow(rows) {
  if (!Array.isArray(rows) || !rows.length) return null;
  const ativo = rows.find((r) => !String(r.fim || "").trim());
  if (ativo) return ativo;
  return rows
    .slice()
    .sort((a, b) => (parseRecordStartDate(b)?.getTime() || 0) - (parseRecordStartDate(a)?.getTime() || 0))[0];
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

function maybeAutofillNumeroContratoFromContrato(contrato) {
  if (!lancAluguelNumeroContratoInput || !contrato) return;
  if (normalizeNumeroContratoKey(lancAluguelNumeroContratoInput.value || "")) return;
  const nc = normalizeNumeroContratoKey(contrato.numeroContrato || "");
  if (nc) lancAluguelNumeroContratoInput.value = nc;
}

function autoFillLancamentoFromCpf(cpfDigits) {
  const cpf = onlyDigits(String(cpfDigits || ""));
  if (cpf.length !== 11) return;
  const ncField = normalizeNumeroContratoKey(lancAluguelNumeroContratoInput?.value || "");
  const contrato = findBestContratoForLancamentoByCpf(cpf, ncField || undefined);
  if (!contrato) return;
  const placaAtual = normalizePlate(String(lancAluguelPlacaInput?.value || ""));
  const placaContrato = normalizePlate(String(contrato.placa || ""));
  if (placaContrato && placaAtual !== placaContrato && lancAluguelPlacaInput) {
    lancAluguelPlacaInput.value = placaContrato;
  }
  maybeAutofillNumeroContratoFromContrato(contrato);
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
  const ncField = normalizeNumeroContratoKey(lancAluguelNumeroContratoInput?.value || "");
  const contrato = findBestContratoForLancamentoByPlaca(placa, ncField || undefined);
  if (!contrato) return;
  const cpfAtual = onlyDigits(String(lancAluguelCpfInput?.value || ""));
  const cpfContrato = onlyDigits(String(contrato.cpf || ""));
  if (cpfContrato.length === 11 && cpfAtual !== cpfContrato && lancAluguelCpfInput) {
    lancAluguelCpfInput.value = formatCpf(cpfContrato);
    prefillLancamentoAluguelByCpf(cpfContrato);
  }
  maybeAutofillNumeroContratoFromContrato(contrato);
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
  const adminByCpf = new Map();
  getAdminDataset().forEach((r) => {
    const cpf = onlyDigits(String(r.cpf || ""));
    if (cpf.length !== 11) return;
    if (!adminByCpf.has(cpf)) adminByCpf.set(cpf, []);
    adminByCpf.get(cpf).push(r);
  });
  adminByCpf.forEach((rows, cpf) => {
    const prev = byCpf.get(cpf) || { nome: "", cpf, placa: "" };
    const best = pickActiveOrLatestLocacaoRow(rows);
    if (!best) return;
    const nomeFromReceita = rows.map((x) => String(x.nome || "").trim()).find((n) => n);
    byCpf.set(cpf, {
      nome: String(prev.nome || nomeFromReceita || best.nome || "").trim(),
      cpf,
      placa: normalizePlate(best.placa || ""),
    });
  });
  loadCadastro(CAD_LOCACOES_KEY).forEach((l) => {
    const cpf = onlyDigits(String(l.cpf || ""));
    if (cpf.length !== 11) return;
    if (!String(l.fim || "").trim()) {
      const prev = byCpf.get(cpf);
      if (prev && !prev.placa) {
        byCpf.set(cpf, { ...prev, placa: normalizePlate(l.placa || prev.placa || "") });
      }
    }
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

const OPENAI_KEY_STORAGE = "dk_openai_api_key";
let comprovanteImagemPendente = { base64: null, mime: null };
/** SHA-256 hex do último comprovante lido (imagem ou texto); uso único por lançamento salvo. */
let comprovanteFpPendente = null;
/** Snapshot do arquivo/texto ao aplicar comprovante ao formulário (gravado ao salvar o lançamento). */
let pendingComprovanteSnapshot = null;

function loadComprovantesBancoMap() {
  try {
    const raw = localStorage.getItem(CAD_COMPROVANTES_BANCO_KEY);
    if (!raw) return {};
    const o = JSON.parse(raw);
    return typeof o === "object" && o !== null && !Array.isArray(o) ? o : {};
  } catch {
    return {};
  }
}

function saveComprovantesBancoMap(map) {
  localStorage.setItem(CAD_COMPROVANTES_BANCO_KEY, JSON.stringify(map));
}

function getComprovanteBanco(fp) {
  if (!fp) return null;
  return loadComprovantesBancoMap()[fp] || null;
}

function upsertComprovanteBanco(fp, row) {
  if (!fp) return;
  const all = loadComprovantesBancoMap();
  const prev = all[fp] || {};
  all[fp] = {
    ...prev,
    ...row,
    fp,
    atualizadoEm: Date.now(),
  };
  saveComprovantesBancoMap(all);
}

/**
 * Na hora de salvar o lançamento: usa o que ainda está na área do comprovante e,
 * se faltar, o snapshot de quando clicou em Aplicar (mesmo fingerprint).
 */
function coletarPayloadComprovanteParaSalvar(fpSalvar) {
  if (!fpSalvar) return { base64: undefined, mime: undefined, texto: "" };
  const snap =
    pendingComprovanteSnapshot && pendingComprovanteSnapshot.fp === fpSalvar ? pendingComprovanteSnapshot : null;
  let base64;
  let mime;
  if (comprovanteImagemPendente?.base64 && comprovanteImagemPendente?.mime) {
    base64 = comprovanteImagemPendente.base64;
    mime = comprovanteImagemPendente.mime;
  } else if (snap?.base64 && snap?.mime) {
    base64 = snap.base64;
    mime = snap.mime;
  }
  const textoLive = comprovanteTextoFallback ? String(comprovanteTextoFallback.value || "").trim() : "";
  const texto = textoLive || (snap?.texto ? String(snap.texto).trim() : "");
  return { base64, mime, texto };
}

/** Fallback quando não há Web Crypto (ex.: página em HTTP não-local) ou falha do digest. */
function fingerprintComprovanteSync(str) {
  let h = 2166136261 >>> 0;
  const s = String(str);
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `fnv|${(h >>> 0).toString(16)}|${s.length}`;
}

async function sha256HexPreferencial(str) {
  const s = String(str);
  if (!globalThis.crypto?.subtle) {
    return fingerprintComprovanteSync(s);
  }
  try {
    const enc = new TextEncoder().encode(s);
    const max = 9 * 1024 * 1024;
    if (enc.byteLength > max) {
      const head = s.slice(0, 8000);
      const tail = s.slice(-8000);
      return fingerprintComprovanteSync(`large|${s.length}|${head}|${tail}`);
    }
    const buf = await crypto.subtle.digest("SHA-256", enc);
    return Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  } catch {
    return fingerprintComprovanteSync(s);
  }
}

function setComprovanteFeedback(message, kind) {
  if (!comprovanteApiStatus) return;
  comprovanteApiStatus.textContent = message || "";
  comprovanteApiStatus.classList.remove("comprovante-api-status--erro", "comprovante-api-status--ok");
  if (!message) return;
  if (kind === "erro") comprovanteApiStatus.classList.add("comprovante-api-status--erro");
  if (kind === "ok") comprovanteApiStatus.classList.add("comprovante-api-status--ok");
  try {
    comprovanteApiStatus.scrollIntoView({ block: "nearest", behavior: "smooth" });
  } catch {
    /* ignore */
  }
}

/**
 * Identifica o arquivo colado (imagem tem prioridade). Mesmo comprovante = mesmo hash.
 */
async function computeComprovanteFingerprintFromPending() {
  const img = comprovanteImagemPendente;
  const text = comprovanteTextoFallback ? String(comprovanteTextoFallback.value || "").trim() : "";
  if (img.base64 && img.mime) {
    return sha256HexPreferencial(`img|${img.mime}|${img.base64}`);
  }
  if (text) {
    const norm = text.replace(/\s+/g, " ").trim();
    return sha256HexPreferencial(`txt|${norm}`);
  }
  return null;
}

function isComprovanteFpJaUtilizado(fp) {
  if (!fp || typeof fp !== "string") return false;
  return getLancamentosAluguel().some((l) => l && typeof l === "object" && String(l.comprovanteFp || "") === fp);
}

function getStoredOpenAIKey() {
  return String(localStorage.getItem(OPENAI_KEY_STORAGE) || "").trim();
}

function setDiaPagamentoFromDataBr(dataStr) {
  if (!lancAluguelDiaPagamentoInput) return;
  const d = parseBrDate(String(dataStr || "").trim());
  if (!d || Number.isNaN(d.getTime())) return;
  const map = { 1: "SEG", 2: "TER", 3: "QUA", 4: "QUI", 5: "SEX", 6: "SAB", 0: "SAB" };
  lancAluguelDiaPagamentoInput.value = map[d.getDay()] || "SEG";
}

function extrairComprovanteHeuristica(texto) {
  const t = String(texto || "");
  const out = {
    nomeClienteOuBeneficiario: null,
    nomePagador: null,
    cpf: null,
    placaVeiculo: null,
    dataPagamento: null,
    valor: null,
    pagamentoPorTerceiro: false,
    origem: "heuristica",
  };
  const cpfM = t.match(/(\d{3})[.\s]?(\d{3})[.\s]?(\d{3})[-\s]?(\d{2})/);
  if (cpfM) out.cpf = `${cpfM[1]}${cpfM[2]}${cpfM[3]}${cpfM[4]}`;
  const placaM = t.match(/\b([A-Za-z]{3}\d[A-Za-z0-9]\d{2})\b/);
  if (placaM) {
    out.placaVeiculo = placaM[1].toUpperCase().replace(/[^A-Z0-9]/g, "");
  }
  const dataM = t.match(/\b(\d{2})\/(\d{2})\/(\d{4})\b/);
  if (dataM) out.dataPagamento = `${dataM[1]}/${dataM[2]}/${dataM[3]}`;
  const valM = t.match(/R\$\s*([\d./]+)/i) || t.match(/(\d{1,3}(?:\.\d{3})*,\d{2})/);
  if (valM) {
    const n = valM[0].includes("R$") ? parseCurrencyBR(valM[0]) : parseCurrencyBR(valM[1]);
    if (Number.isFinite(n) && n > 0) out.valor = n;
  }
  return out;
}

function buildLocacoesAtivasParaComprovante() {
  const seen = new Set();
  const out = [];
  getAdminDataset()
    .filter((r) => !String(r.fim || "").trim())
    .forEach((r) => {
      const cpf = onlyDigits(String(r.cpf || ""));
      const placa = normalizePlate(r.placa);
      if (cpf.length !== 11 || !placa) return;
      const k = `${cpf}|${placa}`;
      if (seen.has(k)) return;
      seen.add(k);
      const nome = String(r.nome || findClienteByCpfCadastro(cpf)?.nome || "").trim() || "Cliente";
      out.push({ cpf, placa, nome, label: `${nome} — ${placa} — ${formatCpf(cpf)}` });
    });
  loadCadastro(CAD_LOCACOES_KEY)
    .filter((l) => !String(l.fim || "").trim())
    .forEach((l) => {
      const cpf = onlyDigits(String(l.cpf || ""));
      const placa = normalizePlate(l.placa);
      if (cpf.length !== 11 || !placa) return;
      const nc = normalizeNumeroContratoKey(l.numeroContrato || "");
      const k = nc ? `CT:${nc}` : `${cpf}|${placa}|${l.id || ""}`;
      if (seen.has(k)) return;
      seen.add(k);
      const nome = String(findClienteByCpfCadastro(cpf)?.nome || "").trim() || "Cliente";
      const base = `${nome} — ${placa} — ${formatCpf(cpf)}`;
      out.push({
        cpf,
        placa,
        nome,
        numeroContrato: nc,
        label: nc ? `${base} — Contrato ${nc}` : base,
      });
    });
  return out.sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
}

function comprovanteLocacaoOptionValue(cpf, placa, numeroContratoRaw) {
  const cpfD = onlyDigits(String(cpf || ""));
  const placaN = normalizePlate(placa);
  const nc = normalizeNumeroContratoKey(numeroContratoRaw || "");
  return `${cpfD}|||${placaN}|||${encodeURIComponent(nc)}`;
}

function comprovanteNomesDiferentesTerceiro(nomeLocatario, nomePagador) {
  const a = normalizeName(String(nomeLocatario || ""));
  const b = normalizeName(String(nomePagador || ""));
  if (!a || !b) return false;
  if (a === b) return false;
  if (a.length >= 4 && b.includes(a.slice(0, 4))) return false;
  if (b.length >= 4 && a.includes(b.slice(0, 4))) return false;
  return true;
}

function tokenizarNomeParaMatch(value) {
  return normalizeName(value)
    .split(/\s+/)
    .map((t) => t.replace(/[^A-Z0-9]/g, ""))
    .filter((t) => t.length >= 2);
}

/**
 * Compara nome do pagador (PIX) com nome do locatário no cadastro para sugerir CPF/placa/locação.
 */
function scoreNomePagadorVsLocatario(nomePagador, nomeLocatario) {
  const a = normalizeName(nomePagador);
  const b = normalizeName(nomeLocatario);
  if (!a || !b) return 0;
  if (a === b) return 1000;
  const ta = tokenizarNomeParaMatch(nomePagador);
  const tb = tokenizarNomeParaMatch(nomeLocatario);
  if (!ta.length || !tb.length) return 0;
  let score = 0;
  if (ta[0] === tb[0]) score += 380;
  const ua = ta[ta.length - 1];
  const ub = tb[tb.length - 1];
  if (ua && ub && ua === ub && ua.length > 2) score += 360;
  tb.forEach((tok) => {
    if (ta.some((x) => x === tok)) score += 130;
    else if (ta.some((x) => x.includes(tok) || tok.includes(x))) score += 55;
  });
  return score;
}

function encontrarMelhorLocacaoPorNomePagador(nomePagadorRaw) {
  const nomePagador = String(nomePagadorRaw || "").trim();
  if (!nomePagador || nomePagador === "—") return null;
  const rows = buildLocacoesAtivasParaComprovante();
  let best = null;
  let bestScore = 0;
  rows.forEach((row) => {
    const s = scoreNomePagadorVsLocatario(nomePagador, row.nome);
    if (s > bestScore) {
      bestScore = s;
      best = row;
    }
  });
  const MIN_SCORE = 420;
  if (!best || bestScore < MIN_SCORE) return null;
  return best;
}

/** Preenche nome do locatário, CPF, placa e select de locação a partir do nome no comprovante (pagador). */
function aplicarSugestaoLocacaoPorNomePagador() {
  if (!comprovanteModalNomePagador) return;
  const nomePag = String(comprovanteModalNomePagador.value || "").trim();
  if (!nomePag || nomePag === "—") return;
  const best = encontrarMelhorLocacaoPorNomePagador(nomePag);
  if (!best) return;
  if (comprovanteModalNome) comprovanteModalNome.value = best.nome;
  if (comprovanteModalCpf) comprovanteModalCpf.value = formatCpf(best.cpf);
  if (comprovanteModalPlaca) comprovanteModalPlaca.value = best.placa;
  const wrapVis = comprovanteLocacaoWrap && !comprovanteLocacaoWrap.classList.contains("hidden");
  if (wrapVis && comprovanteLocacaoSelect) {
    const want = comprovanteLocacaoOptionValue(best.cpf, best.placa, best.numeroContrato);
    const opt = Array.from(comprovanteLocacaoSelect.options).find((o) => o.value === want);
    if (opt) comprovanteLocacaoSelect.value = want;
  }
}

function popularComprovanteLocacaoSelect() {
  if (!comprovanteLocacaoSelect) return;
  comprovanteLocacaoSelect.innerHTML =
    '<option value="">Selecione a locação (contrato, cliente e placa)</option>';
  buildLocacoesAtivasParaComprovante().forEach((row) => {
    const o = document.createElement("option");
    o.value = comprovanteLocacaoOptionValue(row.cpf, row.placa, row.numeroContrato);
    o.textContent = row.label;
    o.dataset.nome = row.nome;
    o.dataset.cpf = row.cpf;
    o.dataset.placa = row.placa;
    o.dataset.numeroContrato = normalizeNumeroContratoKey(row.numeroContrato || "");
    comprovanteLocacaoSelect.appendChild(o);
  });
}

function atualizarComprovanteLocacaoUI() {
  if (!comprovanteLocacaoWrap || !comprovanteModalTerceiro) return;
  const nomePag = String(comprovanteModalNomePagador?.value || "").trim();
  const pagOk = nomePag && nomePag !== "—";
  const on =
    comprovanteModalTerceiro.checked ||
    (pagOk && comprovanteNomesDiferentesTerceiro(comprovanteModalNome?.value, nomePag));
  comprovanteLocacaoWrap.classList.toggle("hidden", !on);
  if (on) popularComprovanteLocacaoSelect();
  aplicarSugestaoLocacaoPorNomePagador();
}

async function chamarOpenAIComprovante() {
  const key = getStoredOpenAIKey();
  const textExtra = comprovanteTextoFallback ? String(comprovanteTextoFallback.value || "").trim() : "";
  if (!comprovanteImagemPendente.base64 && !textExtra) {
    throw new Error("Cole uma imagem do comprovante (Ctrl+V) e/ou o texto abaixo.");
  }
  if (!key) {
    throw new Error("Salve a chave da API OpenAI (é necessária para leitura com IA).");
  }
  const schema =
    '{"nomeClienteOuBeneficiario":string|null,"nomePagador":string|null,"cpf":string|null,"placaVeiculo":string|null,"dataPagamento":string|null,"valor":number|null,"pagamentoPorTerceiro":boolean}';
  const instr = `Você é leitor de comprovante de pagamento (PIX, TED, boleto) em português. Responda APENAS com JSON válido: ${schema}. CPF com 11 dígitos, sem formatação. placa no padrão Mercosul maiúsculo. data no formato dd/mm/aaaa. Se o nome do pagador/PIX for diferente do beneficiário, pagamentoPorTerceiro: true.`;
  const content = [];
  content.push({ type: "text", text: instr });
  if (comprovanteImagemPendente.base64 && comprovanteImagemPendente.mime) {
    content.push({
      type: "image_url",
      image_url: { url: `data:${comprovanteImagemPendente.mime};base64,${comprovanteImagemPendente.base64}` },
    });
  }
  if (textExtra) {
    content.push({ type: "text", text: `Texto do comprovante (ou OCR do usuário):\n${textExtra}` });
  }
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content }],
      response_format: { type: "json_object" },
      max_tokens: 1000,
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(t.slice(0, 280) || res.status);
  }
  const data = await res.json();
  let raw = data.choices?.[0]?.message?.content;
  if (!raw) throw new Error("Resposta vazia da API.");
  raw = String(raw).trim();
  const fence = raw.match(/^```(?:json)?\s*([\s\S]*?)```$/im);
  if (fence) raw = fence[1].trim();
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("A IA não retornou JSON válido. Tente outra imagem ou cole o texto do comprovante.");
  }
  parsed.origem = "openai";
  return parsed;
}

function abrirComprovanteModal(extr) {
  if (!comprovanteIADialog) return;
  if (comprovanteModalNome) comprovanteModalNome.value = String(extr.nomeClienteOuBeneficiario || "").trim();
  if (comprovanteModalCpf) {
    const d = onlyDigits(String(extr.cpf || ""));
    comprovanteModalCpf.value = d.length === 11 ? formatCpf(d) : "";
  }
  if (comprovanteModalPlaca) {
    comprovanteModalPlaca.value = String(extr.placaVeiculo || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  }
  if (comprovanteModalData) {
    comprovanteModalData.value = String(extr.dataPagamento || "").trim();
  }
  if (comprovanteModalValor) {
    const vNum = parseValorComprovanteApi(extr.valor);
    comprovanteModalValor.value = vNum > 0 ? currencyBRL(vNum) : "";
  }
  if (comprovanteModalNomePagador) {
    comprovanteModalNomePagador.value = String(extr.nomePagador || extr.nomePagadorPix || "").trim() || "—";
  }
  if (comprovanteModalTerceiro) {
    comprovanteModalTerceiro.checked = Boolean(
      extr.pagamentoPorTerceiro || comprovanteNomesDiferentesTerceiro(extr.nomeClienteOuBeneficiario, extr.nomePagador)
    );
  }
  atualizarComprovanteLocacaoUI();
  comprovanteIADialog.classList.remove("hidden");
  try {
    comprovanteIADialog.scrollIntoView({ block: "center", behavior: "smooth" });
  } catch {
    /* ignore */
  }
}

function fecharComprovanteModal() {
  if (comprovanteIADialog) comprovanteIADialog.classList.add("hidden");
}

/** Aceita número ou string da API (evita modal quebrado quando valor vem como texto). */
function parseValorComprovanteApi(v) {
  if (v == null || v === "") return 0;
  if (typeof v === "number" && Number.isFinite(v)) return v > 0 ? v : 0;
  const n = parseCurrencyBR(String(v).trim());
  return Number.isFinite(n) && n > 0 ? n : 0;
}

async function aplicarComprovanteAoFormulario() {
  if (!comprovanteModalCpf) return;
  let fp = comprovanteFpPendente || (await computeComprovanteFingerprintFromPending());
  if (!fp) {
    window.alert(
      "Não foi possível identificar este comprovante (sem imagem nem texto na área). Cole novamente antes de aplicar — cada comprovante só pode ser lançado uma vez."
    );
    return;
  }
  if (isComprovanteFpJaUtilizado(fp)) {
    window.alert(
      "Este comprovante já foi utilizado em um lançamento salvo. Não é possível duplicar. Se foi erro, apague o lançamento correspondente no cadastro ou use outro comprovante."
    );
    return;
  }
  const precisaEscolherLocacao =
    comprovanteLocacaoWrap && !comprovanteLocacaoWrap.classList.contains("hidden");
  if (precisaEscolherLocacao && (!comprovanteLocacaoSelect || !comprovanteLocacaoSelect.value)) {
    window.alert("Selecione a locação para a qual o comprovante será aplicado.");
    return;
  }
  let cpf;
  let placa;
  let nome;
  if (precisaEscolherLocacao && comprovanteLocacaoSelect?.value) {
    const opt = comprovanteLocacaoSelect.selectedOptions[0];
    cpf = onlyDigits(String(opt?.dataset.cpf || ""));
    placa = normalizePlate(String(opt?.dataset.placa || ""));
    nome = String(opt?.dataset.nome || "").trim();
    const ncSel = normalizeNumeroContratoKey(opt?.dataset?.numeroContrato || "");
    if (lancAluguelNumeroContratoInput && ncSel) lancAluguelNumeroContratoInput.value = ncSel;
  } else {
    nome = String(comprovanteModalNome?.value || "").trim();
    cpf = onlyDigits(String(comprovanteModalCpf.value || ""));
    placa = normalizePlate(String(comprovanteModalPlaca.value || ""));
  }
  if (lancAluguelClienteNomeInput) lancAluguelClienteNomeInput.value = nome;
  if (lancAluguelCpfInput) lancAluguelCpfInput.value = cpf.length === 11 ? formatCpf(cpf) : "";
  if (lancAluguelPlacaInput) lancAluguelPlacaInput.value = placa;
  const dataP = String(comprovanteModalData.value || "").trim();
  if (lancAluguelSemanaInicioInput) {
    lancAluguelSemanaInicioInput.value = dataP;
    lancAluguelSemanaInicioInput.dataset.autoSuggested = "1";
  }
  if (lancAluguelSemanaFimInput) {
    const d0 = parseBrDate(dataP);
    if (d0) {
      const f = addCalendarDays(d0, 7);
      if (f) lancAluguelSemanaFimInput.value = formatDataDmaBr(f);
    }
  }
  setDiaPagamentoFromDataBr(dataP);
  const v = comprovanteModalValor ? parseCurrencyBR(String(comprovanteModalValor.value || "")) : 0;
  if (lancAluguelValorPagoInput && v > 0) {
    lancAluguelValorPagoInput.value = currencyBRL(v);
    lancAluguelValorPagoInput.dataset.autoSuggested = "0";
  }
  autoFillLancamentoFromCpf(cpf);
  prefillLancamentoAluguelByCpf(cpf);
  if (placa) autoFillLancamentoFromPlaca(placa);
  suggestValorPagoFromContrato();
  renderLancamentoAluguelResumo();
  if (lancamentoAluguelForm) {
    lancamentoAluguelForm.dataset.comprovanteFp = fp;
  }
  pendingComprovanteSnapshot = {
    fp,
    base64: comprovanteImagemPendente.base64 || null,
    mime: comprovanteImagemPendente.mime || null,
    texto: comprovanteTextoFallback ? String(comprovanteTextoFallback.value || "").trim() : "",
  };
  comprovanteFpPendente = null;
  fecharComprovanteModal();
  if (lancamentoAluguelErro) lancamentoAluguelErro.classList.add("hidden");
}

function fileToComprovantePendente(file) {
  if (!file || !file.type.startsWith("image/")) {
    setComprovanteFeedback("Use uma imagem (PNG, JPEG, etc.).", "erro");
    return;
  }
  const fr = new FileReader();
  fr.onload = () => {
    const res = String(fr.result || "");
    const m = res.match(/^data:([^;]+);base64,(.+)$/);
    if (m) {
      comprovanteImagemPendente = { base64: m[2], mime: m[1] };
      if (comprovantePreview) {
        comprovantePreview.src = res;
        comprovantePreview.classList.remove("hidden");
      }
      setComprovanteFeedback("Imagem pronta. Clique em Extrair dados com IA.", "ok");
    }
  };
  fr.readAsDataURL(file);
}

if (comprovanteApiKeyInput && getStoredOpenAIKey()) {
  comprovanteApiKeyInput.placeholder = "Chave OpenAI (já salva localmente — digite para alterar)";
}

if (comprovanteApiKeySaveBtn && comprovanteApiKeyInput) {
  comprovanteApiKeySaveBtn.addEventListener("click", () => {
    const k = String(comprovanteApiKeyInput.value || "").trim();
    if (!k) {
      localStorage.removeItem(OPENAI_KEY_STORAGE);
      setComprovanteFeedback("Chave removida do navegador.", "ok");
      return;
    }
    localStorage.setItem(OPENAI_KEY_STORAGE, k);
    comprovanteApiKeyInput.value = "";
    setComprovanteFeedback("Chave salva neste aparelho (localStorage). Clique em Extrair dados com IA.", "ok");
  });
}

if (comprovantePasteZone) {
  comprovantePasteZone.addEventListener("paste", (e) => {
    const item = e.clipboardData?.files?.[0];
    if (item && item.type.startsWith("image/")) {
      e.preventDefault();
      fileToComprovantePendente(item);
    }
  });
  comprovantePasteZone.addEventListener("click", () => {
    comprovanteFileInput?.click();
  });
}

if (comprovanteFileInput) {
  comprovanteFileInput.addEventListener("change", () => {
    const f = comprovanteFileInput.files?.[0];
    if (f) fileToComprovantePendente(f);
    comprovanteFileInput.value = "";
  });
}

if (comprovanteLimparBtn) {
  comprovanteLimparBtn.addEventListener("click", () => {
    comprovanteImagemPendente = { base64: null, mime: null };
    comprovanteFpPendente = null;
    fecharComprovanteModal();
    if (comprovantePreview) {
      comprovantePreview.src = "";
      comprovantePreview.classList.add("hidden");
    }
    if (comprovanteTextoFallback) comprovanteTextoFallback.value = "";
    pendingComprovanteSnapshot = null;
    setComprovanteFeedback("", null);
  });
}

if (comprovanteModalTerceiro) {
  comprovanteModalTerceiro.addEventListener("change", atualizarComprovanteLocacaoUI);
}
if (comprovanteModalNome) {
  comprovanteModalNome.addEventListener("input", () => {
    atualizarComprovanteLocacaoUI();
  });
}
if (comprovanteModalNomePagador) {
  comprovanteModalNomePagador.addEventListener("input", () => {
    atualizarComprovanteLocacaoUI();
  });
}

if (comprovanteExtrairBtn) {
  comprovanteExtrairBtn.addEventListener("click", async () => {
    setComprovanteFeedback("Lendo… aguarde.", "ok");
    comprovanteExtrairBtn.disabled = true;
    try {
      const textoLivre = comprovanteTextoFallback ? String(comprovanteTextoFallback.value || "") : "";
      const temImg = Boolean(comprovanteImagemPendente.base64);
      const kDigitada = comprovanteApiKeyInput ? String(comprovanteApiKeyInput.value || "").trim() : "";
      if (kDigitada) {
        localStorage.setItem(OPENAI_KEY_STORAGE, kDigitada);
        comprovanteApiKeyInput.value = "";
      }
      const temChave = Boolean(getStoredOpenAIKey());
      if (!temImg && !textoLivre.trim()) {
        throw new Error(
          "Cole antes uma imagem na área tracejada (Ctrl+V ou clique para arquivo) e/ou o texto do PIX na caixa ao lado."
        );
      }
      comprovanteFpPendente = await computeComprovanteFingerprintFromPending();
      if (!comprovanteFpPendente) {
        throw new Error("Não foi possível registrar o comprovante para controle de uso único.");
      }
      if (isComprovanteFpJaUtilizado(comprovanteFpPendente)) {
        comprovanteFpPendente = null;
        throw new Error(
          "Este comprovante já foi utilizado em um lançamento salvo. Apague o lançamento no cadastro se precisar reutilizar, ou use outro comprovante."
        );
      }
      if (temChave && (temImg || textoLivre.trim())) {
        const d = await chamarOpenAIComprovante();
        abrirComprovanteModal(d);
        setComprovanteFeedback("Dados extraídos. Confira o modal acima da página.", "ok");
        return;
      }
      if (!temImg && textoLivre.trim()) {
        const h = extrairComprovanteHeuristica(textoLivre);
        const temAlgo = h.cpf || h.placaVeiculo || h.dataPagamento || (h.valor != null && h.valor > 0);
        if (!temAlgo) {
          comprovanteFpPendente = null;
          throw new Error(
            "Nada identificado no texto. Cole uma chave OpenAI acima para analisar imagem ou texto com IA."
          );
        }
        setComprovanteFeedback(
          "Sem IA: regras simples no texto. Salve a chave OpenAI para leitura completa (imagem).",
          "ok"
        );
        abrirComprovanteModal(h);
        return;
      }
      throw new Error(
        "Para ler imagem é necessária a chave da API OpenAI (clique em Salvar chave local). Ou cole só texto e use extração sem IA."
      );
    } catch (err) {
      comprovanteFpPendente = null;
      const msg = err?.message || "Falha na leitura.";
      console.error("[comprovante]", err);
      setComprovanteFeedback(msg, "erro");
    } finally {
      comprovanteExtrairBtn.disabled = false;
    }
  });
}

if (comprovanteAplicarBtn) {
  comprovanteAplicarBtn.addEventListener("click", async () => {
    await aplicarComprovanteAoFormulario();
  });
}
if (comprovanteModalCancelBtn) {
  comprovanteModalCancelBtn.addEventListener("click", fecharComprovanteModal);
}

function openComprovanteViewerDialog(fp) {
  const dialog = document.getElementById("comprovanteViewerDialog");
  const body = document.getElementById("comprovanteViewerBody");
  if (!dialog || !body) return;
  const data = getComprovanteBanco(fp);
  if (!data) {
    body.innerHTML =
      "<p>Comprovante não encontrado no armazenamento local (outro aparelho ou limpeza de dados do navegador).</p>";
    dialog.classList.remove("hidden");
    return;
  }
  const bits = [
    data.codigoLancamento && `Cód. ${escapeHtml(String(data.codigoLancamento))}`,
    data.cpf && escapeHtml(formatCpf(onlyDigits(String(data.cpf)))),
    data.placa && escapeHtml(String(data.placa).toUpperCase()),
    data.semanaInicio && escapeHtml(String(data.semanaInicio)),
  ].filter(Boolean);
  let html = bits.length ? `<p class="subtext comprovante-viewer-meta">${bits.join(" · ")}</p>` : "";
  if (data.base64 && data.mime && String(data.mime).startsWith("image/")) {
    html += `<div class="comprovante-viewer-img-wrap"><img src="data:${String(
      data.mime
    )};base64,${String(data.base64)}" alt="Comprovante" class="comprovante-viewer-img"/></div>`;
  } else if (String(data.texto || "").trim()) {
    html += `<pre class="comprovante-viewer-texto">${escapeHtml(String(data.texto))}</pre>`;
  } else {
    html +=
      "<p><em>Imagem ou texto não foi armazenado (salve o lançamento logo após &quot;Aplicar ao formulário&quot; com o comprovante ainda na área).</em></p>";
  }
  body.innerHTML = html;
  dialog.classList.remove("hidden");
}

function openComprovanteMultiChooser(fps) {
  const dialog = document.getElementById("comprovanteViewerDialog");
  const body = document.getElementById("comprovanteViewerBody");
  if (!dialog || !body) return;
  const list = (fps || []).filter(Boolean);
  if (!list.length) return;
  if (list.length === 1) {
    openComprovanteViewerDialog(list[0]);
    return;
  }
  body.innerHTML = `<p class="subtext">Vários pagamentos com comprovante nesta célula. Escolha:</p><div class="comprovante-multi-btns">${list
    .map(
      (fp, i) =>
        `<button type="button" class="secondary comprovante-abrir-fp-btn" data-comprovante-fp="${escapeHtml(
          fp
        )}">Comprovante ${i + 1}</button>`
    )
    .join(" ")}</div>`;
  dialog.classList.remove("hidden");
  body.querySelectorAll(".comprovante-abrir-fp-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const f = btn.getAttribute("data-comprovante-fp");
      if (f) openComprovanteViewerDialog(f);
    });
  });
}

document.addEventListener("click", (e) => {
  const one = e.target.closest(".quadro-valor-comprovante-btn");
  if (one) {
    e.preventDefault();
    const fp = one.getAttribute("data-comprovante-fp");
    if (fp) openComprovanteViewerDialog(fp);
    return;
  }
  const multi = e.target.closest(".quadro-valor-comprovante-multi");
  if (multi) {
    e.preventDefault();
    try {
      const raw = multi.getAttribute("data-comprovante-fps-json");
      const fps = raw ? JSON.parse(raw) : [];
      openComprovanteMultiChooser(fps);
    } catch {
      /* ignore */
    }
  }
});

const comprovanteViewerDialogEl = document.getElementById("comprovanteViewerDialog");
const comprovanteViewerFecharBtn = document.getElementById("comprovanteViewerFechar");
if (comprovanteViewerFecharBtn && comprovanteViewerDialogEl) {
  comprovanteViewerFecharBtn.addEventListener("click", () => {
    comprovanteViewerDialogEl.classList.add("hidden");
  });
  comprovanteViewerDialogEl.addEventListener("click", (ev) => {
    if (ev.target === comprovanteViewerDialogEl) comprovanteViewerDialogEl.classList.add("hidden");
  });
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
  const nc = normalizeNumeroContratoKey(lancAluguelNumeroContratoInput?.value || "");
  if (cpf.length === 11 && placa) {
    return (
      findContratoForLancamentoResumo(cpf, placa, nc || undefined) ||
      findBestContratoForLancamentoByCpf(cpf, nc || undefined) ||
      findBestContratoForLancamentoByPlaca(placa, nc || undefined)
    );
  }
  if (placa) return findBestContratoForLancamentoByPlaca(placa, nc || undefined);
  if (cpf.length === 11) return findBestContratoForLancamentoByCpf(cpf, nc || undefined);
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
  const cpf = onlyDigits(String(lancAluguelCpfInput?.value || ""));
  const placaRaw = String(lancAluguelPlacaInput?.value || "").trim().toUpperCase();
  const valorSemanal = parseCurrencyBR(contrato.valorSemanal || contrato.valorPlano);
  const dyn = withDynamicFinancialFields({
    ...contrato,
    valorSemanal: contrato.valorSemanal || contrato.valorPlano || 0,
    devidoHoje: contrato.devidoHoje || contrato.devido || 0,
  });
  const valorDevido = parseCurrencyBR(dyn.devidoHoje || contrato.devidoHoje || contrato.devido);
  const ncForm = normalizeNumeroContratoKey(lancAluguelNumeroContratoInput?.value || "");
  const valorPagoAcumulado =
    cpf.length === 11
      ? totalPagoBarComLancamentosApp(
          cpf,
          placaRaw,
          contrato.pago || contrato.valorPago || 0,
          ncForm || undefined
        )
      : parseCurrencyBR(contrato.pago || contrato.valorPago);
  if (valorPagoAcumulado > valorDevido) {
    lancAluguelValorPagoInput.value = currencyBRL(0);
    lancAluguelValorPagoInput.dataset.autoSuggested = "1";
    return;
  }
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

function findContratoForLancamentoResumo(cpfDigits, placaRaw, numeroContratoOpt) {
  const cpf = onlyDigits(String(cpfDigits || ""));
  const placa = normalizePlate(placaRaw);
  const ncWant = normalizeNumeroContratoKey(numeroContratoOpt || "");
  if (cpf.length !== 11) return null;

  const adminMatches = getAdminDataset().filter((r) => {
    const cpfOk = onlyDigits(String(r.cpf || "")) === cpf;
    const plateOk = placa ? normalizePlate(r.placa) === placa : true;
    return cpfOk && plateOk;
  });
  if (adminMatches.length && !ncWant) {
    const ativo = adminMatches.find((r) => !String(r.fim || "").trim());
    if (ativo) return ativo;
    return adminMatches
      .slice()
      .sort((a, b) => (parseRecordStartDate(b)?.getTime() || 0) - (parseRecordStartDate(a)?.getTime() || 0))[0];
  }

  let locMatches = loadCadastro(CAD_LOCACOES_KEY).filter((l) => {
    const cpfOk = onlyDigits(String(l.cpf || "")) === cpf;
    const plateOk = placa ? normalizePlate(l.placa) === placa : true;
    return cpfOk && plateOk;
  });
  if (ncWant) {
    const porContrato = locMatches.filter(
      (l) => normalizeNumeroContratoKey(l.numeroContrato) === ncWant
    );
    if (porContrato.length) locMatches = porContrato;
  }
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
    numeroContrato: loc.numeroContrato || "",
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

const MESES_ABR_PG = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function ymKeyToAbrSlash(ymKey) {
  const parts = String(ymKey || "").split("-");
  const yy = Number(parts[0]);
  const mm = Number(parts[1]);
  if (!Number.isFinite(yy) || !Number.isFinite(mm) || mm < 1 || mm > 12) return String(ymKey || "");
  return `${MESES_ABR_PG[mm - 1]}/${String(yy).slice(-2)}`;
}

/** Normaliza número de contrato para comparação (único no sistema). */
function normalizeNumeroContratoKey(value) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, " ");
}

/** Prefixo de data AAAAMMDD (calendário do navegador). */
function protocoloLocacaoDatePrefix(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

/**
 * Protocolo único por locação: AAAAMMDD + sequência do dia (001, 002, …).
 * Une cliente (CPF) e veículo (placa) no mesmo registro; gravado em numeroContrato.
 */
function proximoProtocoloLocacaoNumero(date = new Date()) {
  const prefix = protocoloLocacaoDatePrefix(date);
  const locs = loadCadastro(CAD_LOCACOES_KEY);
  let maxSeq = 0;
  locs.forEach((l) => {
    const nc = String(normalizeNumeroContratoKey(l.numeroContrato || "")).replace(/\s+/g, "");
    if (!nc.startsWith(prefix)) return;
    const rest = nc.slice(prefix.length);
    if (!/^\d+$/.test(rest)) return;
    maxSeq = Math.max(maxSeq, Number(rest));
  });
  const next = maxSeq + 1;
  const pad = next <= 999 ? 3 : String(next).length;
  return `${prefix}${String(next).padStart(pad, "0")}`;
}

function parseLocacaoProtocolDateCandidate(locacao) {
  const inicioDate = parseBrDate(locacao?.inicio);
  if (inicioDate instanceof Date && !Number.isNaN(inicioDate.getTime())) return inicioDate;
  const created = Number(locacao?.createdAt || locacao?.id || 0);
  if (Number.isFinite(created) && created > 0) {
    const d = new Date(created);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return new Date();
}

/**
 * Garante protocolo em todas as locações existentes (migração para bases antigas/importadas).
 * Regra: AAAAMMDD + sequência do dia, sem duplicidade.
 */
function ensureNumeroContratoForLocacoes() {
  const locs = loadCadastro(CAD_LOCACOES_KEY);
  if (!locs.length) return;

  const used = new Set();
  const maxSeqByPrefix = new Map();
  locs.forEach((l) => {
    const nc = String(normalizeNumeroContratoKey(l.numeroContrato || "")).replace(/\s+/g, "");
    if (!nc) return;
    used.add(nc);
    const m = nc.match(/^(\d{8})(\d+)$/);
    if (!m) return;
    const prefix = m[1];
    const seq = Number(m[2]);
    if (!Number.isFinite(seq)) return;
    maxSeqByPrefix.set(prefix, Math.max(Number(maxSeqByPrefix.get(prefix) || 0), seq));
  });

  let changed = false;
  const updated = locs.map((l) => {
    const current = normalizeNumeroContratoKey(l.numeroContrato || "");
    if (current) return l;
    const prefix = protocoloLocacaoDatePrefix(parseLocacaoProtocolDateCandidate(l));
    let seq = Number(maxSeqByPrefix.get(prefix) || 0) + 1;
    let protocolo = `${prefix}${String(seq).padStart(3, "0")}`;
    while (used.has(protocolo)) {
      seq += 1;
      protocolo = `${prefix}${String(seq).padStart(3, "0")}`;
    }
    used.add(protocolo);
    maxSeqByPrefix.set(prefix, seq);
    changed = true;
    return {
      ...l,
      numeroContrato: protocolo,
    };
  });

  if (changed) saveCadastro(CAD_LOCACOES_KEY, updated);
}

function preencherProtocoloLocacaoSeCampoVazio() {
  if (!cadLocacaoContratoInput) return;
  if (String(cadLocacaoContratoInput.value || "").trim()) return;
  cadLocacaoContratoInput.value = proximoProtocoloLocacaoNumero();
}

function aplicarNovoProtocoloLocacaoNoFormulario() {
  if (!cadLocacaoContratoInput) return;
  cadLocacaoContratoInput.value = proximoProtocoloLocacaoNumero();
}

/** Verifica se já existe outra locação com o mesmo número de contrato. */
function contratoNumeroJaExisteNaBase(numeroNorm, excludeLocacaoId) {
  if (!numeroNorm) return false;
  const locs = loadCadastro(CAD_LOCACOES_KEY);
  return locs.some((l) => {
    if (excludeLocacaoId != null && Number(l.id) === Number(excludeLocacaoId)) return false;
    return normalizeNumeroContratoKey(l.numeroContrato) === numeroNorm;
  });
}

/**
 * Lançamentos antigos podem não ter numeroContrato; se só existir uma locação na base
 * para aquele CPF+placa, esses lançamentos são tratados como dessa locação.
 */
function legacyLancamentoSemContratoCabeNesteContrato(l, cpfDigits, placaN, ncFilter) {
  if (normalizeNumeroContratoKey(l.numeroContrato)) return false;
  const locs = loadCadastro(CAD_LOCACOES_KEY).filter((x) => {
    return (
      onlyDigits(String(x.cpf || "")) === cpfDigits &&
      normalizePlate(String(x.placa || "")) === placaN
    );
  });
  if (locs.length !== 1) return false;
  return normalizeNumeroContratoKey(locs[0].numeroContrato) === ncFilter;
}

function collectLancamentosFilteredQuadro(cpfDigits, placaRaw, numeroContratoOpt) {
  const placaN = normalizePlate(placaRaw);
  const ncFilter = normalizeNumeroContratoKey(numeroContratoOpt || "");
  return getLancamentosAluguel().filter((l) => {
    if (onlyDigits(String(l.cpf || "")) !== cpfDigits) return false;
    if (!placaN) return true;
    if (normalizePlate(l.placa) !== placaN) return false;
    if (!ncFilter) return true;
    const lNc = normalizeNumeroContratoKey(l.numeroContrato || "");
    if (lNc && lNc === ncFilter) return true;
    return legacyLancamentoSemContratoCabeNesteContrato(l, cpfDigits, placaN, ncFilter);
  });
}

function mergePreviewLancamento(items, preview) {
  const next = items.slice();
  if (!preview || !preview.semanaInicio || !(parseCurrencyBR(preview.valorPago) > 0)) return next;
  const row = {
    id: "__preview__",
    cpf: preview.cpfDigits,
    placa: preview.placa,
    semanaInicio: preview.semanaInicio,
    semanaFim: preview.semanaFim || preview.semanaInicio,
    valorPago: preview.valorPago,
    createdAt: 0,
  };
  const ncP = normalizeNumeroContratoKey(preview.numeroContrato || "");
  if (ncP) row.numeroContrato = ncP;
  next.push(row);
  return next;
}

function getQuadroMesesRange(contrato, items) {
  const today = toDateOnly(new Date());
  let minD = today;
  const sc = contrato ? parseRecordStartDate(contrato) : null;
  if (sc instanceof Date && !Number.isNaN(sc.getTime())) {
    minD = toDateOnly(sc);
  }
  items.forEach((it) => {
    const d = parseBrDate(it.semanaInicio);
    if (d && toDateOnly(d) < minD) minD = toDateOnly(d);
  });
  let maxD = today;
  items.forEach((it) => {
    const d = parseBrDate(it.semanaInicio);
    if (d && toDateOnly(d) > maxD) maxD = toDateOnly(d);
  });
  const endExt = new Date(maxD.getFullYear(), maxD.getMonth() + 15, 1);
  const sy = minD.getFullYear();
  const sm = minD.getMonth() + 1;
  const ey = endExt.getFullYear();
  const em = endExt.getMonth() + 1;
  return buildMonthRange(sy, sm, ey, em);
}

const QUADRO_MES_ABBR_TO_NUM = {
  JAN: 1,
  FEV: 2,
  MAR: 3,
  ABR: 4,
  MAI: 5,
  JUN: 6,
  JUL: 7,
  AGO: 8,
  SET: 9,
  OUT: 10,
  NOV: 11,
  DEZ: 12,
};

function ymFromReceitaDefMes(mesAbbr, year) {
  const m = QUADRO_MES_ABBR_TO_NUM[String(mesAbbr || "").toUpperCase()];
  if (!m) return null;
  return year * 100 + m;
}

function mergeUniqueSortedMonthKeys(rangeKeys, extraKeys) {
  const set = new Set(Array.isArray(rangeKeys) ? rangeKeys : []);
  (extraKeys || []).forEach((k) => set.add(k));
  return Array.from(set).sort((a, b) => String(a).localeCompare(String(b)));
}

/**
 * SEM-01…SEM-06 no quadro **calendário civil**: cada semana é uma **linha** da grade mensal
 * (domingo→sábado). Primeira/semana inicial pode ser incompleta (ex.: abril começa na quarta).
 * Ex.: abril/2026 — dia 23 cai na 4ª linha → índice 3 (SEM-04).
 * Base: data de referência do lançamento (`semanaInicio`).
 */
function calendarMonthGridWeekSlotIndex(dateObj) {
  const d = toDateOnly(dateObj);
  if (!d || Number.isNaN(d.getTime())) return 0;
  const y = d.getFullYear();
  const m = d.getMonth();
  const day = d.getDate();
  const first = new Date(y, m, 1);
  const wdFirst = first.getDay();
  const position = wdFirst + (day - 1);
  const row = Math.floor(position / 7);
  return Math.min(Math.max(0, row), 5);
}

/**
 * Ano civil da linha do quadro RECEITA (MONTHLY_DATA): bloco 26 = 2026;
 * bloco 25 = 2025 exceto JAN final da aba RECEITA (cols 84–88) = janeiro 2026.
 */
function receitaRowCalendarYear(block, mesAbbr) {
  const u = String(mesAbbr || "").toUpperCase();
  if (block === "26") return 2026;
  if (block === "25") {
    if (u === "JAN") return 2026;
    return 2025;
  }
  return 2025;
}

/**
 * SEM do quadro RECEITA alinhada à **grade mensal dom–sáb** (mesma ideia da planilha visual).
 * Evita depender só da trilha por semanas do contrato quando o DK_DATA não espelha a célula.
 */
function calendarSlotIntoReceitaWeek(semanaInicioStr, block, mesAbbr) {
  const d = parseBrDate(semanaInicioStr);
  if (!d || Number.isNaN(d.getTime())) return null;
  const mapAbbr = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];
  const abbr = mapAbbr[d.getMonth()];
  if (String(mesAbbr || "").toUpperCase() !== abbr) return null;
  const wantY = receitaRowCalendarYear(block, mesAbbr);
  if (d.getFullYear() !== wantY) return null;
  /** Janeiro/2026: só em RECEITA 2026 (bloco 26); a linha JAN no final da RECEITA 2025 não recebe o mesmo lançamento. */
  if (abbr === "JAN" && wantY === 2026 && block === "25") return null;
  const slotIdx = calendarMonthGridWeekSlotIndex(d);
  return { block, mes: String(mesAbbr || ""), slotIdx };
}

/** Mês civil (abbr planilha) da data de início do lançamento — evita duplicar o mesmo pagamento em dois meses do quadro. */
function mesAbbrCivilFromSemanaInicio(semanaInicioStr) {
  const d = parseBrDate(semanaInicioStr);
  if (!d || Number.isNaN(d.getTime())) return "";
  const mapAbbr = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];
  return mapAbbr[d.getMonth()] || "";
}

/**
 * Um lançamento só entra na linha do mês civil correspondente à sua semanaInicio.
 * Prioridade: grade calendário RECEITA; senão trilha DK_DATA no mesmo mês (nunca trail noutro mês).
 */
function resolveReceitaSlotForLancamentoInMonth(record, it, block, mesAbbr, monthMetaLen) {
  const mesU = String(mesAbbr || "").toUpperCase();
  const mesPag = mesAbbrCivilFromSemanaInicio(it.semanaInicio);
  if (mesPag && mesU !== mesPag) return null;

  const slotCal = calendarSlotIntoReceitaWeek(it.semanaInicio, block, mesAbbr);
  if (
    slotCal &&
    slotCal.block === block &&
    String(slotCal.mes || "").toUpperCase() === mesU &&
    slotCal.slotIdx >= 0 &&
    slotCal.slotIdx < monthMetaLen
  ) {
    return slotCal;
  }

  const slotTrail = findQuadroSlotForLancamentoSemana(
    record,
    it.semanaInicio,
    it.semanaFim || it.semanaInicio
  );
  if (
    slotTrail &&
    slotTrail.block === block &&
    String(slotTrail.mes || "").toUpperCase() === mesU &&
    slotTrail.slotIdx >= 0 &&
    slotTrail.slotIdx < monthMetaLen
  ) {
    return slotTrail;
  }
  return null;
}

function receitaQuadroTrailHasCells(record) {
  const hist = normalizeWeekArray(record?.semanasHistorico);
  const t26 = receita2026TrailForRecord(record);
  const anyMark = (arr) =>
    arr.some((c) => {
      const t = String(c ?? "").trim();
      return t !== "" && t !== "#";
    });
  return anyMark(hist) || anyMark(t26);
}

function slotMetaFromTrailAtCol(trail, colBase, col) {
  const a = normalizeWeekArray(trail);
  const idx = col - colBase;
  const raw = idx >= 0 && idx < a.length ? a[idx] : "";
  const val = parseSemanaPagamentoCell(raw);
  const empty = raw == null || String(raw).trim() === "" || String(raw).trim() === "#";
  return { raw, val, empty };
}

function packSixSlotMetas(monthMetas) {
  if (monthMetas.length <= 6) {
    const out = monthMetas.slice();
    while (out.length < 6) out.push({ raw: "", val: 0, empty: true });
    return out.slice(0, 6);
  }
  const out = monthMetas.slice(0, 5);
  let sum = 0;
  let anyNonEmpty = false;
  for (let i = 5; i < monthMetas.length; i += 1) {
    sum += monthMetas[i].val;
    if (!monthMetas[i].empty) anyNonEmpty = true;
  }
  out.push({
    raw: anyNonEmpty ? "*" : "",
    val: sum,
    empty: !anyNonEmpty && Math.abs(sum) < 1e-9,
  });
  return out;
}

function packSixComprovanteSlots(compRows) {
  if (!compRows || !compRows.length) {
    return Array.from({ length: 6 }, () => []);
  }
  if (compRows.length <= 6) {
    const out = compRows.map((r) => [...r]);
    while (out.length < 6) out.push([]);
    return out.slice(0, 6).map((r) => dedupeComprovantesPorSlot(r));
  }
  const out = compRows.slice(0, 5).map((r) => [...r]);
  const merged = [];
  for (let i = 5; i < compRows.length; i += 1) merged.push(...compRows[i]);
  out.push(merged);
  return out.map((r) => dedupeComprovantesPorSlot(r));
}

function collectComprovantesByReceitaMonthSlot(record, cpf, placa, block, mesAbbr, colCount) {
  const rows = Array.from({ length: colCount }, () => []);
  collectLancamentosFilteredQuadro(cpf, placa).forEach((it) => {
    const fp = String(it.comprovanteFp || "").trim();
    if (!fp) return;
    const slot = resolveReceitaSlotForLancamentoInMonth(record, it, block, mesAbbr, colCount);
    if (!slot) return;
    rows[slot.slotIdx].push({
      fp,
      id: it.id,
      valor: getLancamentoAluguelValor(it),
    });
  });
  return rows;
}

/**
 * Mantém todas as linhas desde o início da grade RECEITA até o último mês com dado,
 * incluindo meses anteriores vazios (para o administrador editar OUT/NOV igual à planilha).
 * Só remove linhas **vazias no final** do período.
 */
function trimQuadroReceitaRows(rows) {
  const isEmptyRow = (r) => {
    if (Math.abs(r.rowSum) >= 1e-9) return false;
    return !r.six.some((m) => !m.empty || Math.abs(m.val) >= 1e-9);
  };
  if (!rows.length) return [];
  let end = rows.length - 1;
  while (end >= 0 && isEmptyRow(rows[end])) end -= 1;
  if (end < 0) return [];
  return rows.slice(0, end + 1);
}

function trailQuadroFindStartIdx(trailArr) {
  const a = normalizeWeekArray(trailArr);
  const startIdx = a.findIndex((c) => {
    const t = String(c ?? "").trim();
    return t === "#" || parseSemanaPagamentoCell(c) !== 0;
  });
  return startIdx < 0 ? 0 : startIdx;
}

/**
 * Número de dias (fim inclusivo) em comum entre [periodStart, periodEnd] e [weekStart, weekEnd].
 */
function quadroRangeOverlapDays(periodStart, periodEnd, weekStart, weekEnd) {
  if (!periodStart || !periodEnd || !weekStart || !weekEnd) return 0;
  const tLoT = periodStart.getTime() > weekStart.getTime() ? periodStart : weekStart;
  const tHiT = periodEnd.getTime() < weekEnd.getTime() ? periodEnd : weekEnd;
  if (tLoT.getTime() > tHiT.getTime()) return 0;
  const loD = toDateOnly(tLoT);
  const hiD = toDateOnly(tHiT);
  if (!loD || !hiD) return 0;
  const dayMs = 1000 * 60 * 60 * 24;
  return Math.floor((hiD.getTime() - loD.getTime()) / dayMs) + 1;
}

/**
 * Localiza SEM-XX do quadro (índice 0 = SEM-01 no mês) pela **semana do lançamento (início e fim)**.
 * Se só o início caísse em uma célula SEM-0N mas a maior parte do período em SEM-0N+1, o
 * mapeamento antigo (só início) errava. Usa **sobreposição de dias** com a janela
 * [início do contrato + 7·w, … +6] a partir da 1ª célula da trilha, e escolhe a coluna
 * com **mais dias** em comum; empate: semana de referência **mais tardia** (cobre
 * pagamentos que vão de domingo a sábado, etc.). Pagamentos 2025 na trilha RECEITA;
 * 2026+ na trilha RECEITA 2026. Fallback: primeira coluna cujo [ws,we] contém a data de início.
 */
function findQuadroSlotForLancamentoSemana(record, semanaInicioStr, semanaFimStr) {
  let dLo = toDateOnly(parseBrDate(semanaInicioStr));
  if (!dLo) return null;
  let dHi = toDateOnly(parseBrDate(semanaFimStr));
  if (!dHi) dHi = dLo;
  if (dLo.getTime() > dHi.getTime()) {
    const t = dLo;
    dLo = dHi;
    dHi = t;
  }
  const inicio = toDateOnly(parseRecordStartDate(record));
  if (!inicio) return null;
  const defs25 = getReceita2025GridMonthDefs();
  const defs26 = getReceita2026GridMonthDefs();
  const cb25 = defs25.length ? Number(defs25[0].colInicio) : 26;
  const cb26 = defs26.length ? Number(defs26[0].colInicio) : 27;
  const hist = normalizeWeekArray(record.semanasHistorico);
  const trail26 = receita2026TrailForRecord(record);
  const refYear = dLo.getFullYear();

  const scanTrailOverlap = (trailArr, colBase, defs, block) => {
    const s0 = trailQuadroFindStartIdx(trailArr);
    let best = null;
    let bestScore = -1e18;
    for (let idx = s0; idx < trailArr.length; idx += 1) {
      const w = idx - s0;
      const weekStart = addCalendarDays(inicio, w * 7);
      if (!weekStart) continue;
      const weekEnd = addCalendarDays(weekStart, 6);
      if (!weekEnd) continue;
      const col = colBase + idx;
      const def = defs.find((dd) => col >= dd.colInicio && col <= dd.colFim);
      if (!def) continue;
      const days = quadroRangeOverlapDays(dLo, dHi, weekStart, weekEnd);
      if (days <= 0) continue;
      const tHiT = dHi.getTime();
      const tLoT = dLo.getTime();
      const tWs = weekStart.getTime();
      const tWe = weekEnd.getTime();
      const dHiIn = tHiT >= tWs && tHiT <= tWe;
      const dLoIn = tLoT >= tWs && tLoT <= tWe;
      const slotIdx = col - def.colInicio;
      const score =
        days * 1e9 +
        (dHiIn ? 1e6 : 0) +
        (dLoIn ? 1e3 : 0) +
        slotIdx;
      if (score > bestScore) {
        bestScore = score;
        best = {
          block,
          mes: String(def.mes || ""),
          slotIdx,
          col,
        };
      }
    }
    return best;
  };

  const scanTrailDLoOnly = (trailArr, colBase, defs, block) => {
    const s0 = trailQuadroFindStartIdx(trailArr);
    for (let idx = s0; idx < trailArr.length; idx += 1) {
      const w = idx - s0;
      const weekStart = addCalendarDays(inicio, w * 7);
      if (!weekStart) continue;
      const weekEnd = addCalendarDays(weekStart, 6);
      if (!weekEnd) continue;
      if (dLo < weekStart || dLo > weekEnd) continue;
      const col = colBase + idx;
      const def = defs.find((dd) => col >= dd.colInicio && col <= dd.colFim);
      if (!def) continue;
      return {
        block,
        mes: String(def.mes || ""),
        slotIdx: col - def.colInicio,
        col,
      };
    }
    return null;
  };

  if (refYear <= 2025) {
    const hit = scanTrailOverlap(hist, cb25, defs25, "25");
    if (hit) return hit;
  }
  if (refYear >= 2026) {
    const hit26 = scanTrailOverlap(trail26, cb26, defs26, "26");
    if (hit26) return hit26;
  }
  const hFb = scanTrailOverlap(hist, cb25, defs25, "25");
  if (hFb) return hFb;
  const tFb = scanTrailOverlap(trail26, cb26, defs26, "26");
  if (tFb) return tFb;

  if (refYear <= 2025) {
    const fb1 = scanTrailDLoOnly(hist, cb25, defs25, "25");
    if (fb1) return fb1;
  }
  if (refYear >= 2026) {
    const f26 = scanTrailDLoOnly(trail26, cb26, defs26, "26");
    if (f26) return f26;
  }
  return scanTrailDLoOnly(hist, cb25, defs25, "25") || scanTrailDLoOnly(trail26, cb26, defs26, "26");
}

function mergeLocalLancamentosIntoMonthMetas(record, cpfDigits, placaRaw, block, mesAbbr, monthMetas) {
  collectLancamentosFilteredQuadro(cpfDigits, placaRaw).forEach((it) => {
    const slot = resolveReceitaSlotForLancamentoInMonth(record, it, block, mesAbbr, monthMetas.length);
    if (!slot) return;
    const add = getLancamentoAluguelValor(it);
    const cur = monthMetas[slot.slotIdx];
    const nextVal = cur.val + add;
    const stillEmptyRaw =
      String(cur.raw ?? "").trim() === "" || String(cur.raw ?? "").trim() === "#";
    monthMetas[slot.slotIdx] = {
      raw: cur.raw,
      val: nextVal,
      empty:
        Math.abs(nextVal) < 1e-9 &&
        stillEmptyRaw &&
        !(Math.abs(add) >= 1e-9),
    };
    if (Math.abs(nextVal) >= 1e-9) monthMetas[slot.slotIdx].empty = false;
  });
}

function formatQuadroInputDisplay(val) {
  const n = Number(val);
  if (!Number.isFinite(n) || Math.abs(n) < 1e-9) return "";
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatQuadroMonthSlotTd(meta, cellOpts, editableCtx) {
  const highlightNovo = cellOpts?.highlightNovo;
  const highlightPreview = cellOpts?.highlightPreview;
  if (editableCtx?.enabled) {
    const key = quadroOverrideReceitaKey(
      editableCtx.cpf,
      editableCtx.placa,
      editableCtx.block,
      editableCtx.mes,
      editableCtx.slotIdx
    );
    const displayVal = formatQuadroInputDisplay(meta.val);
    const hasSavedOverride = hasQuadroReceitaOverrideKey(key);
    const hadValue =
      hasSavedOverride ||
      String(meta.raw ?? "").trim() !== "" ||
      Math.abs(Number(meta.val) || 0) >= 1e-9 ||
      !meta.empty;
    const isNeg = meta.val < -1e-9;
    let inpCls = "quadro-cell-input";
    if (highlightNovo) inpCls += " quadro-cell-input--novo";
    if (isNeg) inpCls += " quadro-cell-input--neg";
    return `<td class="quadro-cell quadro-cell--editable-wrap"><input type="text" class="${inpCls}" data-q-kind="sem" data-q-key="${escapeHtml(
      key
    )}" data-q-original="${escapeHtml(displayVal)}" data-q-had-value="${hadValue ? "1" : "0"}" value="${escapeHtml(displayVal)}" inputmode="decimal" autocomplete="off" aria-label="Valor da semana" /></td>`;
  }
  if (meta.empty && Math.abs(meta.val) < 1e-9) {
    return `<td class="quadro-cell quadro-cell--empty">—</td>`;
  }
  const isNeg = meta.val < -1e-9;
  let cls = "quadro-cell quadro-cell--valor";
  if (highlightPreview) cls = "quadro-cell quadro-cell--preview";
  else if (highlightNovo) cls = "quadro-cell quadro-cell--novo";
  else if (isNeg) cls += " quadro-cell--negativo";
  const inner = formatQuadroValorCellHtml(meta.val, meta.comprovantes || []);
  return `<td class="${cls}">${inner}</td>`;
}

function buildHighlightKeysForReceitaQuadro(record, cpfDigits, placaRaw, highlightId) {
  const keys = new Set();
  if (highlightId == null || highlightId === "") return keys;
  const items = collectLancamentosFilteredQuadro(cpfDigits, placaRaw).filter(
    (i) => Number(i.id) === Number(highlightId)
  );
  if (!items.length) return keys;
  const item = items[0];
  const valor = getLancamentoAluguelValor(item);
  const dItem = parseBrDate(item.semanaInicio);
  const itemYm =
    dItem && !Number.isNaN(dItem.getTime())
      ? dItem.getFullYear() * 100 + (dItem.getMonth() + 1)
      : null;

  const tryDefs = (defs, colBase, trail, block, yearForYm) => {
    if (!defs.length || !Number.isFinite(colBase)) return;
    defs.forEach((d) => {
      const rowYm = ymFromReceitaDefMes(d.mes, yearForYm);
      if (itemYm != null && rowYm != null && rowYm !== itemYm) return;
      let colSlot = 0;
      for (let col = d.colInicio; col <= d.colFim; col += 1) {
        const meta = slotMetaFromTrailAtCol(trail, colBase, col);
        const packedSlot = colSlot < 6 ? colSlot : 5;
        if (
          !meta.empty &&
          Math.abs(meta.val - valor) < 0.02 &&
          packedSlot >= 0 &&
          packedSlot < 6
        ) {
          keys.add(`${block}|${d.mes}|${packedSlot}`);
        }
        colSlot += 1;
      }
    });
  };

  const defs25 = getReceita2025GridMonthDefs();
  const defs26 = getReceita2026GridMonthDefs();
  const colBase25 = defs25.length ? Number(defs25[0].colInicio) : NaN;
  const colBase26 = defs26.length ? Number(defs26[0].colInicio) : NaN;
  tryDefs(defs25, colBase25, normalizeWeekArray(record.semanasHistorico), "25", 2025);
  tryDefs(defs26, colBase26, receita2026TrailForRecord(record), "26", 2026);
  defs25.forEach((d) => {
    const cal = calendarSlotIntoReceitaWeek(item.semanaInicio, "25", String(d.mes || ""));
    if (cal) keys.add(`${cal.block}|${cal.mes}|${Math.min(cal.slotIdx, 5)}`);
  });
  defs26.forEach((d) => {
    const cal = calendarSlotIntoReceitaWeek(item.semanaInicio, "26", String(d.mes || ""));
    if (cal) keys.add(`${cal.block}|${cal.mes}|${Math.min(cal.slotIdx, 5)}`);
  });
  const slotByDate = findQuadroSlotForLancamentoSemana(
    record,
    item.semanaInicio,
    item.semanaFim || item.semanaInicio
  );
  if (slotByDate) {
    keys.add(`${slotByDate.block}|${slotByDate.mes}|${Math.min(slotByDate.slotIdx, 5)}`);
  }
  return keys;
}

function buildQuadroPagamentoHistoricoFromReceita(cpfDigits, placaRaw, record, options = {}) {
  const editableDialog = Boolean(options.editableDialog);
  const highlightId = options.highlightId;
  const ncOpt = options.numeroContrato || "";
  const highlightKeys = buildHighlightKeysForReceitaQuadro(record, cpfDigits, placaRaw, highlightId);
  const rowForTotals =
    record || findContratoForLancamentoResumo(cpfDigits, placaRaw, ncOpt || undefined);
  let totalDevido = 0;
  let totalPagoContrato = 0;
  if (rowForTotals) {
    const dyn = withDynamicFinancialFields({
      ...rowForTotals,
      valorSemanal: rowForTotals.valorSemanal || rowForTotals.valorPlano || 0,
      devidoHoje: rowForTotals.devidoHoje || rowForTotals.devido || 0,
    });
    totalDevido = parseCurrencyBR(dyn.devidoHoje || rowForTotals.devidoHoje || rowForTotals.devido || 0);
    totalPagoContrato = totalPagoBarComLancamentosApp(
      cpfDigits,
      placaRaw,
      rowForTotals.pago || rowForTotals.valorPago || 0,
      ncOpt || undefined
    );
  }

  const defs25 = getReceita2025GridMonthDefs();
  const defs26 = getReceita2026GridMonthDefs();
  const colBase25 = defs25.length ? Number(defs25[0].colInicio) : NaN;
  const colBase26 = defs26.length ? Number(defs26[0].colInicio) : NaN;
  const hist = normalizeWeekArray(record.semanasHistorico);
  const trail26 = receita2026TrailForRecord(record);

  const rawRows = [];

  defs25.forEach((d) => {
    const monthMetas = [];
    for (let col = d.colInicio; col <= d.colFim; col += 1) {
      monthMetas.push(slotMetaFromTrailAtCol(hist, colBase25, col));
    }
    const compRows = collectComprovantesByReceitaMonthSlot(
      record,
      cpfDigits,
      placaRaw,
      "25",
      String(d.mes || ""),
      monthMetas.length
    );
    mergeLocalLancamentosIntoMonthMetas(record, cpfDigits, placaRaw, "25", String(d.mes || ""), monthMetas);
    const six = packSixSlotMetas(monthMetas);
    const sixComp = packSixComprovanteSlots(compRows);
    const sixMerged = six.map((m, i) => ({ ...m, comprovantes: sixComp[i] || [] }));
    applyQuadroOverridesToPackedSix(cpfDigits, placaRaw, "25", String(d.mes || ""), sixMerged);
    const rowSum = sixMerged.reduce((acc, m) => acc + m.val, 0);
    rawRows.push({
      label: mesAbbrToLabelGrade(d.mes, "2025"),
      block: "25",
      mes: String(d.mes || ""),
      six: sixMerged,
      rowSum,
    });
  });

  defs26.forEach((d) => {
    const monthMetas = [];
    for (let col = d.colInicio; col <= d.colFim; col += 1) {
      monthMetas.push(slotMetaFromTrailAtCol(trail26, colBase26, col));
    }
    const compRows = collectComprovantesByReceitaMonthSlot(
      record,
      cpfDigits,
      placaRaw,
      "26",
      String(d.mes || ""),
      monthMetas.length
    );
    mergeLocalLancamentosIntoMonthMetas(record, cpfDigits, placaRaw, "26", String(d.mes || ""), monthMetas);
    const six = packSixSlotMetas(monthMetas);
    const sixComp = packSixComprovanteSlots(compRows);
    const sixMerged = six.map((m, i) => ({ ...m, comprovantes: sixComp[i] || [] }));
    applyQuadroOverridesToPackedSix(cpfDigits, placaRaw, "26", String(d.mes || ""), sixMerged);
    const rowSum = sixMerged.reduce((acc, m) => acc + m.val, 0);
    rawRows.push({
      label: mesAbbrToLabelGrade(d.mes, "2026"),
      block: "26",
      mes: String(d.mes || ""),
      six: sixMerged,
      rowSum,
    });
  });

  const trimmed = trimQuadroReceitaRows(rawRows);
  const somaQuadroPago = trimmed.reduce((acc, r) => acc + r.rowSum, 0);
  const tituloTotalPagoQuadro =
    Math.abs(somaQuadroPago - totalPagoContrato) > 0.02
      ? `Soma das células deste quadro (= barra verde). Cadastro/planilha + lançamentos app (barra acima no resumo): ${currencyBRL(
          totalPagoContrato
        )}. Se divergirem, confira meses em branco, reimporte DK_DATA ou ajuste as células no modo edição.`
      : "Soma das linhas “TOTAL” deste quadro (RECEITA + lançamentos no app), alinhada ao pago do cadastro.";
  let rowsHtml = "";
  trimmed.forEach((r) => {
    const slotsHtml = r.six
      .map((meta, i) =>
        formatQuadroMonthSlotTd(
          meta,
          {
            highlightNovo: highlightKeys.has(`${r.block}|${r.mes}|${i}`),
          },
          editableDialog
            ? {
                enabled: true,
                cpf: cpfDigits,
                placa: placaRaw,
                block: r.block,
                mes: r.mes,
                slotIdx: i,
              }
            : null
        )
      )
      .join("");
    const rowEmpty =
      Math.abs(r.rowSum) < 1e-9 &&
      !r.six.some((m) => !m.empty || Math.abs(m.val) >= 1e-9);
    const totalNeg = r.rowSum < -1e-9;
    const totalCls =
      rowEmpty
        ? "quadro-cell quadro-row-total quadro-cell--empty"
        : `quadro-cell quadro-row-total${totalNeg ? " quadro-cell--negativo" : ""}`;
    const totalDisp = rowEmpty ? "—" : currencyBRL(r.rowSum);
    const rowKey = `${r.block}|${r.mes}`;
    const totalTd = editableDialog
      ? `<td class="${totalCls} quadro-row-total--live" data-q-row-key="${escapeHtml(rowKey)}">${totalDisp}</td>`
      : `<td class="${totalCls}">${totalDisp}</td>`;
    rowsHtml += `
      <tr${editableDialog ? ` data-q-row-key="${escapeHtml(rowKey)}"` : ""}>
        <td class="quadro-mes">${escapeHtml(r.label)}</td>
        ${totalTd}
        ${slotsHtml}
      </tr>`;
  });

  return `
    <div class="quadro-pagamento-scroll" data-quadro-soma-pago="${escapeHtml(String(somaQuadroPago))}">
      <table class="quadro-pagamento-table" aria-label="Quadro resumo de pagamentos por mês (RECEITA / RECEITA 2026)" title="Valores das células vêm do DK_DATA (semanas/semanasHistorico). Lançamentos do app somam na semana pela grade do mês (dom a sáb) quando a data cai nesse mês. Modo edição: valores do administrador prevalecem. Se faltar célula no export, reimporte a planilha.">
        <thead>
          <tr class="quadro-summary-row quadro-summary-devido">
            <td colspan="2">TOTAL DEVIDO</td>
            <td colspan="6" class="quadro-moeda quadro-bg-devido">${currencyBRL(totalDevido)}</td>
          </tr>
          <tr class="quadro-summary-row quadro-summary-pago">
            <td colspan="2">TOTAL PAGO</td>
            <td colspan="6" class="quadro-moeda quadro-bg-pago" title="${escapeHtml(tituloTotalPagoQuadro)}">${currencyBRL(
              somaQuadroPago
            )}</td>
          </tr>
        <tr>
            <th scope="col">Mês</th>
            <th scope="col">TOTAL</th>
            ${[1, 2, 3, 4, 5, 6]
              .map((n) => `<th scope="col">SEM-${String(n).padStart(2, "0")}</th>`)
              .join("")}
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    </div>`;
}

function dedupeComprovantesPorSlot(items) {
  const seen = new Set();
  const out = [];
  (items || []).forEach((x) => {
    const fp = String(x?.fp || "").trim();
    if (!fp || seen.has(fp)) return;
    seen.add(fp);
    out.push({ fp, id: x.id, valor: x.valor });
  });
  return out;
}

/** Valor com controle para abrir o comprovante salvo no navegador (fingerprint). */
function formatQuadroValorCellHtml(totalVal, comprovantes) {
  const valorText = currencyBRL(totalVal);
  const list = dedupeComprovantesPorSlot(comprovantes).filter((c) => getComprovanteBanco(c.fp));
  if (!list.length) {
    return `<span class="quadro-cell-valor">${valorText}</span>`;
  }
  if (list.length === 1) {
    return `<button type="button" class="quadro-valor-comprovante-btn" data-comprovante-fp="${escapeHtml(
      list[0].fp
    )}" title="Ver comprovante deste pagamento">${valorText}</button>`;
  }
  return `<span class="quadro-cell-valor">${valorText}</span> <button type="button" class="quadro-valor-comprovante-multi secondary" data-comprovante-fps-json="${escapeHtml(
    JSON.stringify(list.map((x) => x.fp))
  )}" title="Vários comprovantes nesta célula">${list.length} comprovantes</button>`;
}

function formatCalendarMonthSlotTd(s, editableCtx, ymKey, slotIdx) {
  if (editableCtx?.enabled) {
    const key = quadroOverrideCalendarKey(editableCtx.cpf, editableCtx.placa, ymKey, slotIdx);
    const displayVal = formatQuadroInputDisplay(s.total);
    const hasSavedOverride = hasQuadroReceitaOverrideKey(key);
    const hadValue = hasSavedOverride || Math.abs(Number(s.total) || 0) >= 1e-9;
    let inpCls = "quadro-cell-input";
    if (s.hasPreview) inpCls += " quadro-cell-input--preview";
    else if (s.hasNovo) inpCls += " quadro-cell-input--novo";
    return `<td class="quadro-cell quadro-cell--editable-wrap"><input type="text" class="${inpCls}" data-q-kind="sem" data-q-key="${escapeHtml(
      key
    )}" data-q-original="${escapeHtml(displayVal)}" data-q-had-value="${hadValue ? "1" : "0"}" value="${escapeHtml(displayVal)}" inputmode="decimal" autocomplete="off" aria-label="Valor da semana" /></td>`;
  }
  if (s.total <= 0) return `<td class="quadro-cell quadro-cell--empty">—</td>`;
  let cls = "quadro-cell quadro-cell--valor";
  if (s.hasPreview) cls = "quadro-cell quadro-cell--preview";
  else if (s.hasNovo) cls = "quadro-cell quadro-cell--novo";
  const inner = formatQuadroValorCellHtml(s.total, s.comprovantes);
  return `<td class="${cls}">${inner}</td>`;
}

/** Quadro mensal tipo calendário: semanas = linhas dom–sáb (não usa trilha RECEITA). */
function computeMonthSlotsSixSemanas(monthItems, highlightId) {
  const sorted = monthItems
    .filter((it) => parseBrDate(it.semanaInicio))
    .sort(
      (a, b) =>
        (parseBrDate(a.semanaInicio)?.getTime() || 0) -
        (parseBrDate(b.semanaInicio)?.getTime() || 0)
    );
  const slots = Array.from({ length: 6 }, () => ({
    total: 0,
    hasNovo: false,
    hasPreview: false,
    comprovantes: [],
  }));
  sorted.forEach((it) => {
    const dRef = parseBrDate(it.semanaInicio);
    const slotIdx = calendarMonthGridWeekSlotIndex(dRef);
    const val = getLancamentoAluguelValor(it);
    slots[slotIdx].total += val;
    if (String(it.id) === "__preview__") slots[slotIdx].hasPreview = true;
    else if (highlightId != null && Number(it.id) === Number(highlightId)) slots[slotIdx].hasNovo = true;
    const fp = String(it.comprovanteFp || "").trim();
    if (fp) {
      slots[slotIdx].comprovantes.push({ fp, id: it.id, valor: val });
    }
  });
  slots.forEach((s) => {
    s.comprovantes = dedupeComprovantesPorSlot(s.comprovantes);
  });
  return slots;
}

function buildQuadroPagamentoHistoricoFromLancamentosOnly(cpfDigits, placaRaw, options = {}) {
  const editableDialog = Boolean(options.editableDialog);
  const highlightId = options.highlightId;
  const preview = options.preview;
  const ncOpt = options.numeroContrato || "";
  let items = collectLancamentosFilteredQuadro(cpfDigits, placaRaw, ncOpt);
  if (preview && preview.valorPago != null && preview.semanaInicio) {
    items = mergePreviewLancamento(items, preview);
  }
  const contrato = findContratoForLancamentoResumo(cpfDigits, placaRaw, ncOpt || undefined);
  let totalDevido = 0;
  let totalPagoContrato = 0;
  if (contrato) {
    const dyn = withDynamicFinancialFields({
      ...contrato,
      valorSemanal: contrato.valorSemanal || contrato.valorPlano || 0,
      devidoHoje: contrato.devidoHoje || contrato.devido || 0,
    });
    totalDevido = parseCurrencyBR(dyn.devidoHoje || contrato.devidoHoje || contrato.devido || 0);
    totalPagoContrato = totalPagoBarComLancamentosApp(
      cpfDigits,
      placaRaw,
      contrato.pago || contrato.valorPago || 0,
      ncOpt || undefined
    );
  }
  const rangeKeys = getQuadroMesesRange(contrato, items);
  const byMonth = {};
  items.forEach((it) => {
    const d = parseBrDate(it.semanaInicio);
    if (!d) return;
    const ymKey = monthKey(toDateOnly(d));
    if (!byMonth[ymKey]) byMonth[ymKey] = [];
    byMonth[ymKey].push(it);
  });
  const mesesKeys = mergeUniqueSortedMonthKeys(rangeKeys, Object.keys(byMonth));
  let rowsHtml = "";
  let somaQuadroPago = 0;
  mesesKeys.forEach((ym) => {
    const monthItems = byMonth[ym] || [];
    const slots = computeMonthSlotsSixSemanas(monthItems, highlightId);
    applyQuadroOverridesToCalendarSlots(cpfDigits, placaRaw, ym, slots);
    const rowSum = slots.reduce((acc, s) => acc + s.total, 0);
    somaQuadroPago += rowSum;
    const rowKeyCal = `CAL|${ym}`;
    const editableCtx = editableDialog
      ? { enabled: true, cpf: cpfDigits, placa: placaRaw }
      : null;
    const slotsHtml = slots
      .map((s, i) => formatCalendarMonthSlotTd(s, editableCtx, ym, i))
      .join("");
    const rowEmpty = Math.abs(rowSum) < 1e-9;
    const totalNeg = rowSum < -1e-9;
    const totalCls = rowEmpty
      ? "quadro-cell quadro-row-total quadro-cell--empty"
      : `quadro-cell quadro-row-total${totalNeg ? " quadro-cell--negativo" : ""}`;
    const totalDisp = rowEmpty ? "—" : currencyBRL(rowSum);
    const totalTd = editableDialog
      ? `<td class="${totalCls} quadro-row-total--live" data-q-row-key="${escapeHtml(rowKeyCal)}">${totalDisp}</td>`
      : `<td class="${totalCls}">${totalDisp}</td>`;
    rowsHtml += `
      <tr${editableDialog ? ` data-q-row-key="${escapeHtml(rowKeyCal)}"` : ""}>
        <td class="quadro-mes">${escapeHtml(ymKeyToAbrSlash(ym))}</td>
        ${totalTd}
        ${slotsHtml}
      </tr>`;
  });
  return `
    <div class="quadro-pagamento-scroll" data-quadro-soma-pago="${escapeHtml(String(somaQuadroPago))}">
      <table class="quadro-pagamento-table" aria-label="Quadro resumo de pagamentos por mês">
        <thead>
          <tr class="quadro-summary-row quadro-summary-devido">
            <td colspan="2">TOTAL DEVIDO</td>
            <td colspan="6" class="quadro-moeda quadro-bg-devido">${currencyBRL(totalDevido)}</td>
          </tr>
          <tr class="quadro-summary-row quadro-summary-pago">
            <td colspan="2">TOTAL PAGO</td>
            <td colspan="6" class="quadro-moeda quadro-bg-pago" title="Pago no cadastro/planilha, mais a soma dos lancamentos de aluguel salvos no app.">${currencyBRL(
              totalPagoContrato
            )}</td>
          </tr>
          <tr>
            <th scope="col">Mês</th>
            <th scope="col">TOTAL</th>
            ${[1, 2, 3, 4, 5, 6]
              .map((n) => `<th scope="col">SEM-${String(n).padStart(2, "0")}</th>`)
              .join("")}
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    </div>`;
}

function fillMonthSlotsSixSemanas(monthItems, highlightId) {
  const slots = computeMonthSlotsSixSemanas(monthItems, highlightId);
  return slots
    .map((s) => {
      if (s.total <= 0) return `<td class="quadro-cell quadro-cell--empty">—</td>`;
      let cls = "quadro-cell quadro-cell--valor";
      if (s.hasPreview) cls = "quadro-cell quadro-cell--preview";
      else if (s.hasNovo) cls = "quadro-cell quadro-cell--novo";
      return `<td class="${cls}">${currencyBRL(s.total)}</td>`;
    })
    .join("");
}

function buildQuadroPagamentoHistoricoHtml(cpfDigits, placaRaw, options = {}) {
  const preview = options.preview;
  if (preview && preview.semanaInicio && parseCurrencyBR(preview.valorPago) > 0) {
    return buildQuadroPagamentoHistoricoFromLancamentosOnly(cpfDigits, placaRaw, options);
  }
  if (options.numeroContrato) {
    return buildQuadroPagamentoHistoricoFromLancamentosOnly(cpfDigits, placaRaw, options);
  }
  const rec = findReceitaRecordForQuadro(cpfDigits, placaRaw);
  if (rec && receitaQuadroTrailHasCells(rec)) {
    const html = buildQuadroPagamentoHistoricoFromReceita(cpfDigits, placaRaw, rec, options);
    if (!/<tbody>\s*<\/tbody>/s.test(html)) return html;
  }
  return buildQuadroPagamentoHistoricoFromLancamentosOnly(cpfDigits, placaRaw, options);
}

function updateQuadroRowTotalFromInputs(tr) {
  if (!tr) return;
  const inputs = tr.querySelectorAll("input.quadro-cell-input[data-q-key]");
  let sum = 0;
  inputs.forEach((inp) => {
    sum += parseCurrencyBR(inp.value);
  });
  const totalTd = tr.querySelector("td.quadro-row-total--live");
  if (!totalTd) return;
  totalTd.classList.remove("quadro-cell--empty", "quadro-cell--negativo");
  if (Math.abs(sum) < 1e-9) {
    totalTd.textContent = "—";
    totalTd.classList.add("quadro-cell--empty");
  } else {
    totalTd.textContent = currencyBRL(sum);
    if (sum < -1e-9) totalTd.classList.add("quadro-cell--negativo");
  }
}

function wireQuadroHistoricoEditableInputs(container) {
  const onInp = (e) => {
    const t = e.target;
    if (!t || !t.matches || !t.matches("input.quadro-cell-input")) return;
    const tr = t.closest("tr");
    updateQuadroRowTotalFromInputs(tr);
  };
  container.addEventListener("input", onInp);
  return () => container.removeEventListener("input", onInp);
}

function quadroEditableSnapshotSerialize(container) {
  const o = {};
  container.querySelectorAll("input.quadro-cell-input[data-q-key]").forEach((inp) => {
    const k = inp.getAttribute("data-q-key");
    if (!k) return;
    o[k] = String(inp.value || "").trim();
  });
  const keys = Object.keys(o).sort();
  const norm = {};
  keys.forEach((k) => {
    norm[k] = o[k];
  });
  return JSON.stringify(norm);
}

function persistQuadroHistoricoOverridesFromInputs(container) {
  const map = loadQuadroReceitaOverridesMap();
  container.querySelectorAll("input.quadro-cell-input[data-q-key]").forEach((inp) => {
    const k = inp.getAttribute("data-q-key");
    if (!k) return;
    const raw = String(inp.value || "").trim();
    const hadValue = String(inp.getAttribute("data-q-had-value") || "") === "1";
    if (raw === "") {
      // Se havia valor originalmente e o admin apagou, persistir zero para não "voltar" ao valor de base.
      if (hadValue) map[k] = 0;
      else delete map[k];
    } else {
      map[k] = parseCurrencyBR(inp.value);
    }
  });
  saveQuadroReceitaOverridesMap(map);
}

function extractQuadroSomaPagoFromHtml(html) {
  const m = String(html || "").match(/data-quadro-soma-pago="([^"]+)"/i);
  if (!m) return NaN;
  return Number(String(m[1]).replace(",", "."));
}

/**
 * @param {object} [opts]
 * @param {object} [opts.preview] — pré-visualização do formulário (etapa de confirmação)
 * @param {() => void} [opts.onAfterSim] — após confirmar "Sim" (ex.: atualizar o resumo na tela)
 */
function runLancamentoAluguelHistoricoDialog(cpfDigits, placaRaw, opts) {
  const preview = opts?.preview;
  const onAfterSim = opts?.onAfterSim;
  const numeroContratoOpt = normalizeNumeroContratoKey(
    opts?.numeroContrato || preview?.numeroContrato || ""
  );
  const edicaoBloqueadaCpf = isCpfComEdicaoLancamentoBloqueada(cpfDigits);
  if (
    !lancamentoAluguelHistoricoDialog ||
    !lancamentoAluguelHistoricoQuadro ||
    !lancamentoAluguelHistoricoSimBtn ||
    !lancamentoAluguelHistoricoEditarBtn ||
    !lancamentoAluguelHistoricoCancelarBtn
  ) {
    return Promise.resolve(true);
  }
  const html = buildQuadroPagamentoHistoricoHtml(cpfDigits, placaRaw, {
    highlightId: null,
    preview,
    editableDialog: !edicaoBloqueadaCpf,
    numeroContrato: numeroContratoOpt || undefined,
  });
  lancamentoAluguelHistoricoQuadro.innerHTML = html;
  lancamentoAluguelHistoricoEditarBtn.classList.toggle("hidden", edicaoBloqueadaCpf);
  lancamentoAluguelHistoricoEditarBtn.disabled = edicaoBloqueadaCpf;
  lancamentoAluguelHistoricoEditarBtn.title = edicaoBloqueadaCpf
    ? "Edição do histórico bloqueada para este CPF."
    : "";
  const unwireInputs = wireQuadroHistoricoEditableInputs(lancamentoAluguelHistoricoQuadro);
  const initialSnap = quadroEditableSnapshotSerialize(lancamentoAluguelHistoricoQuadro);
  lancamentoAluguelHistoricoDialog.classList.remove("hidden");
  return new Promise((resolve) => {
    const senhaAdminValida = (senhaInformada) =>
      isSenhaFuncionarioAtualValida(senhaInformada) || isSenhaOwnerValida(senhaInformada);
    const cleanup = () => {
      unwireInputs();
    };
    const close = () => {
      lancamentoAluguelHistoricoDialog.classList.add("hidden");
    };
    const onSim = () => {
      const currentSnap = quadroEditableSnapshotSerialize(lancamentoAluguelHistoricoQuadro);
      const changed = currentSnap !== initialSnap;
      if (changed) {
        const senha = window.prompt(
          "Alteracao no quadro detectada. Digite a senha do administrador para salvar as celulas editadas:"
        );
        if (senha === null) return;
        if (!senhaAdminValida(senha)) {
          window.alert("SENHA DE ADMINISTRADOR INVALIDA.");
          return;
        }
        persistQuadroHistoricoOverridesFromInputs(lancamentoAluguelHistoricoQuadro);
        addAuditLog(
          "quadro_receita_overrides",
          "lancamento_aluguel_quadro",
          `${onlyDigits(cpfDigits)} ${String(placaRaw || "").trim().toUpperCase()}`
        );
      }
      cleanup();
      close();
      lancamentoAluguelHistoricoSimBtn.removeEventListener("click", onSim);
      lancamentoAluguelHistoricoEditarBtn.removeEventListener("click", onEditar);
      lancamentoAluguelHistoricoCancelarBtn.removeEventListener("click", onCancelar);
      onAfterSim?.();
      resolve(true);
    };
    const onEditar = () => {
      if (edicaoBloqueadaCpf) {
        window.alert("CPF com edição de histórico bloqueada. Apenas novos lançamentos são permitidos.");
        return;
      }
      const senha = window.prompt("Digite a senha do administrador para editar o histórico na lista:");
      if (senha === null) return;
      if (!senhaAdminValida(senha)) {
        window.alert("SENHA DE ADMINISTRADOR INVALIDA.");
        return;
      }
      cleanup();
      close();
      lancamentoAluguelHistoricoSimBtn.removeEventListener("click", onSim);
      lancamentoAluguelHistoricoEditarBtn.removeEventListener("click", onEditar);
      lancamentoAluguelHistoricoCancelarBtn.removeEventListener("click", onCancelar);
      if (cadastroLancamentoAluguelLista) {
        cadastroLancamentoAluguelLista.scrollIntoView({ behavior: "smooth", block: "start" });
      }
      resolve(false);
    };
    const onCancelar = () => {
      cleanup();
      close();
      lancamentoAluguelHistoricoSimBtn.removeEventListener("click", onSim);
      lancamentoAluguelHistoricoEditarBtn.removeEventListener("click", onEditar);
      lancamentoAluguelHistoricoCancelarBtn.removeEventListener("click", onCancelar);
      resolve(false);
    };
    lancamentoAluguelHistoricoSimBtn.addEventListener("click", onSim);
    lancamentoAluguelHistoricoEditarBtn.addEventListener("click", onEditar);
    lancamentoAluguelHistoricoCancelarBtn.addEventListener("click", onCancelar);
  });
}

function askLancamentoAluguelHistoricoUpdated(cpfDigits, placaRaw, preview) {
  const mergedPreview =
    preview && typeof preview === "object"
      ? {
          ...preview,
          cpfDigits: preview.cpfDigits ?? cpfDigits,
          placa: preview.placa ?? placaRaw,
        }
      : preview;
  const nc = normalizeNumeroContratoKey(preview?.numeroContrato || "");
  return runLancamentoAluguelHistoricoDialog(cpfDigits, placaRaw, {
    preview: mergedPreview,
    numeroContrato: nc || undefined,
  });
}

function renderLancamentoAluguelResumo() {
  if (!lancamentoAluguelResumo) return;
  lancamentoAluguelResumo.classList.remove(
    "resumo-status-moto-positivo",
    "resumo-status-transporte-positivo",
    "resumo-status-carro",
    "resumo-status-debito"
  );
  const cpf = onlyDigits(String(lancAluguelCpfInput?.value || ""));
  const placaRaw = String(lancAluguelPlacaInput?.value || "").trim().toUpperCase();
  const ncResumo = normalizeNumeroContratoKey(lancAluguelNumeroContratoInput?.value || "");
  if (cpf.length !== 11) {
    lancamentoAluguelResumo.innerHTML =
      "<p>Informe CPF, placa e número do contrato para visualizar o resumo do lançamento.</p>";
    return;
  }
  if (!ncResumo) {
    lancamentoAluguelResumo.innerHTML =
      "<p>Informe o <strong>número do contrato</strong> (único no sistema) para identificar qual vínculo cliente + veículo + período usar.</p>";
    return;
  }
  const contrato = findContratoForLancamentoResumo(cpf, placaRaw, ncResumo);
  if (!contrato) {
    lancamentoAluguelResumo.innerHTML =
      "<p>Nenhum contrato localizado para esse CPF, placa e número de contrato. Confira o cadastro de locação.</p>";
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
  const pagoRegistro = parseCurrencyBR(contrato.pago || contrato.valorPago);
  const totalLancamentosAluguel = collectLancamentosFilteredQuadro(cpf, placaRaw, ncResumo).reduce(
    (acc, l) => acc + getLancamentoAluguelValor(l),
    0
  );
  /** Mesma base do quadro: pago (planilha) + soma dos lançamentos de aluguel no app. */
  const valorPagoAcumulado = totalPagoBarComLancamentosApp(
    cpf,
    placaRaw,
    contrato.pago || contrato.valorPago || 0,
    ncResumo
  );
  const valorPagoDigitado = parseCurrencyBR(String(lancAluguelValorPagoInput?.value || ""));
  const valorLancamentoSugestao =
    valorPagoDigitado > 0 ? valorPagoDigitado : totalLancamentosAluguel;
  const quadroHtml = buildQuadroPagamentoHistoricoHtml(cpf, placaRaw, {
    highlightId: ultimoLancamentoAluguelSalvoId,
    numeroContrato: ncResumo,
  });
  const somaQuadroPago = extractQuadroSomaPagoFromHtml(quadroHtml);
  const valorPagoAcumuladoEfetivo = Number.isFinite(somaQuadroPago) ? somaQuadroPago : valorPagoAcumulado;
  /** Pago em dia ou crédito: nada a pagar neste lançamento; sugestão zero. */
  const valorLancamento =
    valorPagoAcumuladoEfetivo > valorDevido ? 0 : valorLancamentoSugestao;
  const saldoPagar = Math.max(0, valorDevido - valorPagoAcumuladoEfetivo);
  const plano = getPlanoLancamentoResumo(contrato);
  const planoKey = normalizeKey(plano);
  const saldoPositivo = valorPagoAcumuladoEfetivo > valorDevido;
  const emDebito = valorPagoAcumuladoEfetivo < valorDevido;
  const isCarro = isCarroLancamentoResumo(placa, contrato);
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
    <p><strong>Nº contrato:</strong> ${escapeHtml(ncResumo)}</p>
    <p><strong>${escapeHtml(nome)}</strong> - ${escapeHtml(modelo)} - data de inicio da locacao <strong>${escapeHtml(
    inicio || "-"
  )}</strong></p>
    <p><strong>Plano:</strong> ${escapeHtml(plano)}</p>
    <p><strong>Valor semanal:</strong> ${currencyBRL(valorSemanal)} | <strong>Valor devido:</strong> ${currencyBRL(
    valorDevido
  )} | <strong>Valor pago acumulado:</strong> <span title="Pago do cadastro (${currencyBRL(
    pagoRegistro
  )}) mais soma dos lançamentos no app. Quando houver edição manual no quadro, este campo reflete a soma atual da barra TOTAL PAGO do quadro.">${currencyBRL(
    valorPagoAcumuladoEfetivo
  )}</span></p>
    <p><strong>Lançamentos de aluguel (app, já somados acima):</strong> ${currencyBRL(
      totalLancamentosAluguel
    )} | <strong>Pagamento deste lançamento (sugestão):</strong> ${currencyBRL(
      valorLancamento
    )} | <strong>Saldo a pagar (devido − pago acum.):</strong> ${currencyBRL(saldoPagar)}</p>
    <h4 style="margin:1rem 0 0.45rem;font-size:0.95rem;">Quadro resumo (histórico por mês — até 6 semanas)</h4>
    <p class="subtext" style="margin:0.35rem 0 0.5rem">
      <button type="button" class="secondary" id="lancamentoAluguelAbrirQuadroEdit">Abrir quadro em modo edição (valores e senha)</button>
    </p>
    ${quadroHtml}
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

function downloadStyledExcel(fileName, headers, rows, metaLines = [], excelOptions = {}) {
  const textColArr = excelOptions.textColumns;
  const textColumns =
    textColArr instanceof Set
      ? textColArr
      : new Set(Array.isArray(textColArr) ? textColArr : []);
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
    .map(
      (row) =>
        `<tr>${row
          .map((cell, ci) => {
            const raw = cell == null ? "" : String(cell);
            const forceText = textColumns.has(ci);
            const tdAttr = forceText ? ' style="mso-number-format:\\@;"' : "";
            return `<td${tdAttr}>${escapeHtml(raw)}</td>`;
          })
          .join("")}</tr>`
    )
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

function formatLocacaoClienteExportCell(row, col, options = {}) {
  const forPdf = Boolean(options.forPdf);
  if (col.key === "protocolo") {
    const p = String(row[col.key] ?? "").trim();
    const fallback = "Nao informado";
    if (forPdf) {
      return p
        ? `<strong>${escapeHtml(p)}</strong>`
        : `<strong>${escapeHtml(fallback)}</strong>`;
    }
    return p || fallback;
  }
  if (col.key !== "cliente") return String(row[col.key] ?? "Nao informado");
  return String(row.cliente ?? "").trim() || "Nao informado";
}

function exportRelatorioPdfFromCache(cache) {
  if (!cache || !Array.isArray(cache.columns) || !Array.isArray(cache.rows)) return;
  const protocoloPrincipal = cache.columns[0]?.key === "protocolo";
  const rowsHtml = cache.rows
    .map(
      (row) =>
        `<tr>${cache.columns
          .map(
            (col) =>
              `<td>${formatLocacaoClienteExportCell(row, col, { forPdf: true })}</td>`
          )
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
          ${
            protocoloPrincipal
              ? "th:first-child, td:first-child { font-size: 13px; font-weight: 700; }"
              : ""
          }
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
  const protocolIdx = cache.columns.findIndex((c) => c.key === "protocolo");
  downloadStyledExcel(
    fileName.replace(/\.csv$/i, ".xls"),
    headers,
    rows,
    [
      ["Relatorio", cache.title],
      ["Total", String(cache.rows.length)],
    ],
    protocolIdx >= 0 ? { textColumns: new Set([protocolIdx]) } : {}
  );
}

function computeSaldoFromRecords(records) {
  if (!Array.isArray(records) || !records.length) return 0;
  return records.reduce((acc, r) => {
    const devido = parseCurrencyBR(r?.devidoHoje);
    const pago = pagoHarmonizadoRegistro(r);
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

function printReportContainer(container, title) {
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

function isTelefonePlaceholder(value) {
  const t = normalizeKey(String(value || "").trim());
  if (!t) return true;
  if (t === "XXXXX" || t.includes("XXXXX")) return true;
  if (/^X{3,}$/.test(t)) return true;
  return false;
}

function telefonePartsFromCliente(cliente) {
  if (!cliente) return [];
  const candidatos = [
    cliente.celular,
    cliente.telefone,
    cliente.tel,
    cliente.fone,
    cliente.recado1,
    cliente.recado2,
  ];
  const out = [];
  const seen = new Set();
  candidatos.forEach((raw) => {
    const s = String(raw || "").trim();
    if (isTelefonePlaceholder(s)) return;
    const dedupKey = onlyDigits(s) || normalizeKey(s);
    if (!dedupKey || seen.has(dedupKey)) return;
    seen.add(dedupKey);
    out.push(s);
  });
  return out;
}

function getTelefoneByCpf(cpf) {
  const normalized = onlyDigits(String(cpf || ""));
  const clientes = [...loadCadastro(CAD_CLIENTES_KEY), ...clientesSeedData];
  if (!normalized || normalized.length !== 11) return "Nao informado";
  const cliente = clientes.find(
    (c) => onlyDigits(String(c.cpf || "")) === normalized
  );
  const parts = telefonePartsFromCliente(cliente);
  return parts.length ? parts.join(" / ") : "Nao informado";
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
  const parts = telefonePartsFromCliente(cliente);
  return parts.length ? parts.join(" / ") : "Nao informado";
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
    const pagoNum = pagoHarmonizadoRegistro({ cpf, placa: placaNormalizada, pago: r.pago });
    const devidoNum = parseCurrencyBR(financeiro.devidoHoje);
    const saldoNum = pagoNum - devidoNum;
    const isLatestByPlate = latestIndexByPlate.get(placaNormalizada)?.index === idx;
    const statusLocacao =
      (!String(r.fim || "").trim() || (activeSet.has(placaNormalizada) && isLatestByPlate))
        ? "ATIVO"
        : "FINALIZADO";

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
      valorPagoHoje: currencyBRL(pagoNum),
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

async function renderRelatorioLocacao(tipo) {
  const snapshot = buildOperationalSnapshot();
  const veiculoByPlaca = getVehicleMapByPlate();
  const protocoloSeqByPrefix = new Map();
  const protocoloUsados = new Set();
  const nextFallbackProtocolo = (record) => {
    const inicioDate = parseBrDate(record?.inicio);
    let baseDate = inicioDate;
    if (!(baseDate instanceof Date) || Number.isNaN(baseDate.getTime())) {
      const ts = Number(record?.createdAt || record?.id || record?.cadastroCriadoTs || 0);
      baseDate = ts > 0 ? new Date(ts) : new Date();
    }
    const prefix = protocoloLocacaoDatePrefix(baseDate);
    let seq = Number(protocoloSeqByPrefix.get(prefix) || 0) + 1;
    let protocolo = `${prefix}${String(seq).padStart(3, "0")}`;
    while (protocoloUsados.has(protocolo)) {
      seq += 1;
      protocolo = `${prefix}${String(seq).padStart(3, "0")}`;
    }
    protocoloSeqByPrefix.set(prefix, seq);
    protocoloUsados.add(protocolo);
    return protocolo;
  };
  const resolveReportProtocolo = (record) => {
    const atual = normalizeNumeroContratoKey(record?.numeroContrato || "");
    if (atual) {
      protocoloUsados.add(atual);
      return atual;
    }
    return nextFallbackProtocolo(record);
  };

  if (tipo === "completo") {
    const xlsxByPlate = buildXlsxProtocolsByPlateMap(await loadLocacoesXlsxApiRows());
    const locacoes = loadCadastro(CAD_LOCACOES_KEY);
    const clientes = loadCadastro(CAD_CLIENTES_KEY);
    const clienteByCpf = new Map(
      clientes
        .map((c) => [onlyDigits(String(c.cpf || "")), c])
        .filter(([cpf]) => cpf.length === 11)
    );
    const sourceRows = locacoes.length
      ? locacoes
      : [...snapshot.activeRecords, ...snapshot.inactiveRecords];

    const rows = sourceRows
      .map((l) => {
        const cpfDigits = onlyDigits(String(l.cpf || ""));
        const cliente = clienteByCpf.get(cpfDigits);
        const placa = normalizePlate(String(l.placa || ""));
        const veiculo = veiculoByPlaca.get(placa);
        const protocolo = resolveReportProtocolo(l);
        const inicioRaw = String(l.inicio || l.dataInicio || "").trim();
        const fimRaw = String(l.fim || l.dataFim || "").trim();
        const inicioDate = parseBrDate(inicioRaw);
        const fimDate = parseBrDate(fimRaw);
        const hasFim = fimRaw.length > 0;
        const diaPagto =
          inicioDate instanceof Date && !Number.isNaN(inicioDate.getTime())
            ? inicioDate.toLocaleDateString("pt-BR", { weekday: "long" })
            : "Nao informado";
        const periodoDias =
          inicioDate instanceof Date &&
          !Number.isNaN(inicioDate.getTime()) &&
          fimDate instanceof Date &&
          !Number.isNaN(fimDate.getTime())
            ? `${Math.max(1, Math.round((toDateOnly(fimDate) - toDateOnly(inicioDate)) / 86400000) + 1)} dia(s)`
            : "...";
        const plano = String(l.plano || "").trim() || toPlanName(l);
        const periodoContrato = normalizeKey(plano).includes("MINHA MOTO") ? "150 SEMANAS" : "1 SEMANA";
        const valorLocacaoNum = parseCurrencyBR(l.valorLocacao || l.valorSemanal);
        const valorInvestNum = parseCurrencyBR(l.valorInvestimento);
        const valorParcelaNum = valorLocacaoNum + valorInvestNum;
        return {
          protocolo,
          placa,
          cpf: cpfDigits ? formatCpf(cpfDigits) : "Nao informado",
          status:
            normalizeStatusLocacaoExibicao(String(l.status || l.statusLocacao || "").trim()) ||
            (hasFim ? "FINALIZADO" : "ATIVO"),
          dataInicio: inicioRaw || "Nao informado",
          diaPagto,
          dataFim: hasFim ? fimRaw : "...",
          periodoLocacao: periodoDias,
          modalidade: normalizeKey(veiculo?.tipo).includes("CARRO") ? "CARRO" : "MOTO",
          marcaModelo: [String(veiculo?.marca || "").trim(), String(veiculo?.modelo || "").trim()]
            .filter(Boolean)
            .join(" / ") || String(l.modelo || l.modeloVeiculo || "").trim() || "Nao informado",
          opcaoContrato: plano,
          periodoContrato,
          kmRetirada: String(l.kmInicial || "").trim() || "Nao informado",
          tabela: "Nao informado",
          locacao: currencyBRL(valorLocacaoNum),
          investimento: currencyBRL(valorInvestNum),
          valorParcela: currencyBRL(valorParcelaNum),
          codCliente: String(cliente?.codigo || "").trim() || "Nao informado",
          cliente: String(cliente?.nome || "").trim() || "Nao informado",
          createdAt: Number(l.createdAt || l.id || 0),
        };
      })
      .filter((r) => r.protocolo)
      .sort((a, b) => {
        const byProt = String(b.protocolo || "").localeCompare(String(a.protocolo || ""), undefined, {
          numeric: true,
          sensitivity: "base",
        });
        if (byProt !== 0) return byProt;
        return Number(b.createdAt || 0) - Number(a.createdAt || 0);
      })
      .filter((r) => rowPermitidoPelaPlanilhaLocacao(r.placa, r.protocolo, xlsxByPlate));

    relatorioLocacaoCache = {
      title: "Relatório | Completo por protocolo",
      columns: [
        { key: "protocolo", label: "PROTOCOLO" },
        { key: "placa", label: "PLACA" },
        { key: "cpf", label: "CPF" },
        { key: "status", label: "STATUS" },
        { key: "dataInicio", label: "DATA INÍCIO" },
        { key: "diaPagto", label: "DIA DE PAGTO" },
        { key: "dataFim", label: "DATA FIM" },
        { key: "periodoLocacao", label: "PERÍODO (LOCAÇÃO)" },
        { key: "modalidade", label: "MODALIDADE" },
        { key: "marcaModelo", label: "MARCA/MODELO" },
        { key: "opcaoContrato", label: "OPÇÃO DE CONTRATO" },
        { key: "periodoContrato", label: "PERÍODO DE CONTRATO" },
        { key: "kmRetirada", label: "KM DE RETIRADA" },
        { key: "tabela", label: "TABELA" },
        { key: "locacao", label: "LOCAÇÃO" },
        { key: "investimento", label: "INVESTIMENTO" },
        { key: "valorParcela", label: "VALOR DA PARCELA" },
        { key: "codCliente", label: "CÓD. CLIENTE" },
        { key: "cliente", label: "CLIENTE" },
      ],
      rows,
    };

    const html = rows.length
      ? `
        <p><strong>Total de protocolos:</strong> ${rows.length}</p>
        <p class="hint">Relatório consolidado em uma linha por protocolo usando os dados da base local da aplicação.</p>
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
            placeholder="Filtrar por protocolo, placa, CPF, cliente ou status"
            aria-label="Filtrar relatório completo por protocolo"
          />
        </div>
        <div class="table-wrap">
          <table class="relatorio-table relatorio-locacao-por-protocolo">
            <thead>
              <tr>
                ${relatorioLocacaoCache.columns.map((c) => `<th>${c.label}</th>`).join("")}
              </tr>
            </thead>
            <tbody>
              ${rows
                .map((item) => {
                  const searchBlob = [item.protocolo, item.placa, item.cpf, item.status, item.cliente]
                    .map((v) => normalizeKey(v))
                    .join(" ");
                  return `<tr data-locacao-search="${escapeHtml(searchBlob)}">
                    ${relatorioLocacaoCache.columns
                      .map((c) => `<td>${formatMissingInfoCell(item[c.key])}</td>`)
                      .join("")}
                  </tr>`;
                })
                .join("")}
            </tbody>
          </table>
        </div>
      `
      : "<p>Nenhum protocolo encontrado na base de locações.</p>";

    setAdminSection("operacao");
    renderLocacaoReport("Relatório | Completo por protocolo", html, {
      totalLabel: "Total de protocolos",
      totalValue: rows.length,
    });
    return;
  }

  if (tipo === "locados") {
    const usePlanilhaEmbarcada =
      typeof LOCACOES_PLANILHA_DATA !== "undefined" &&
      Array.isArray(LOCACOES_PLANILHA_DATA) &&
      LOCACOES_PLANILHA_DATA.length > 0;

    let rows;
    if (usePlanilhaEmbarcada) {
      const planilhaRows = await loadLocacoesXlsxApiRows();
      rows = buildLocadosRowsFromPlanilhaEmbarcada(planilhaRows, veiculoByPlaca).filter((r) =>
        normalizePlate(r.placa)
      );
    } else {
      rows = snapshot.activeRecords
        .map((r) => {
          const placaKey = normalizePlate(r.placa);
          const cad = veiculoByPlaca.get(placaKey);
          const contato = getContatoByCpfOrNome(r.cpf, r.nome);
          const telefones = splitTelefones(contato);
          const inicioDate = excelSerialToDate(r.inicioSerial) || parseBrDate(r.inicio);
          const nomeCli = r.nome || "Nao informado";
          const cpfDig = onlyDigits(String(r.cpf || ""));
          const protocolo = resolveReportProtocolo(r);
          return {
            protocolo,
            placa: r.placa || "",
            modelo: cad?.modelo || findModeloByPlaca(r.placa),
            cliente: nomeCli,
            cpfDigits: cpfDig,
            valorLocacao: r.valorSemanal || "",
            inicioLocacao: r.inicio || "",
            cadastroCriadoTs: Number(r.cadastroCriadoTs || 0),
            inicioTs: inicioDate?.getTime?.() || 0,
            ...telefones,
          };
        })
        .filter((r) => normalizePlate(r.placa));
    }

    rows.sort((a, b) => {
      const pa = String(a.protocolo || "").trim();
      const pb = String(b.protocolo || "").trim();
      if (pa !== pb) {
        return pb.localeCompare(pa, undefined, { numeric: true, sensitivity: "base" });
      }
      const byCadastro = Number(b.cadastroCriadoTs || 0) - Number(a.cadastroCriadoTs || 0);
      if (byCadastro !== 0) return byCadastro;
      return Number(b.inicioTs || 0) - Number(a.inicioTs || 0);
    });

    relatorioLocacaoCache = {
      title: "Relatório | Locações ativas (ordenado por protocolo)",
      columns: [
        { key: "protocolo", label: "PROTOCOLO" },
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
        <p class="hint"><strong>Protocolo:</strong> número único que liga um veículo (placa) a um cliente (CPF) na locação. <strong>Lista:</strong> contratos com status <strong>ATIVO</strong> na base embarcada (<code>locacoes-planilha-data.js</code>), uma linha por placa (maior protocolo se houver mais de um ativo). Sem essa base, usa-se receita 2026 + cadastro local. <strong>Telefones:</strong> cadastro de clientes.</p>
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
            placeholder="Filtrar por protocolo, placa, modelo, CPF ou nome"
            aria-label="Filtrar relatório de locação"
          />
        </div>
        <div class="table-wrap">
          <table class="relatorio-table relatorio-locacao-por-protocolo">
            <thead>
              <tr>
                <th scope="col" class="relatorio-locacao-protocolo-col">PROTOCOLO</th>
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
                      isMissingInfoValue(item.protocolo) ||
                      isMissingInfoValue(item.placa) ||
                      isMissingInfoValue(item.modelo) ||
                      isMissingInfoValue(item.cliente) ||
                      isMissingInfoValue(item.inicioLocacao) ||
                      isMissingInfoValue(item.valorLocacao) ||
                      isMissingInfoValue(item.telefone1) ||
                      isMissingInfoValue(item.telefone2) ||
                      isMissingInfoValue(item.telefone3);
                    const searchBlob = [
                      item.protocolo,
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
                    <td class="relatorio-locacao-protocolo-cell">${formatMissingInfoCell(
                      item.protocolo
                    )}</td>
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
                        ? `<a href="#" class="cliente-vida-link" data-cpf="${item.cpfDigits}">${escapeHtml(
                            item.cliente
                          )}</a>`
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
    renderLocacaoReport("Relatório | Locações ativas — protocolo em primeiro lugar", html, {
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
  const validacoesPendentes = loadCadastro(CAD_CLIENTES_VALIDACAO_KEY);
  refreshLocacaoPlacaOptions();
  refreshLocacaoClienteSugestoes();
  applyLocacaoPlanoRules();

  if (cadastroClienteLista) {
    cadastroClienteLista.innerHTML = "";
    cadastroClienteLista.classList.add("hidden");
  }

  if (adminValidacaoCadastroLista) {
    const pendentesOrdenados = validacoesPendentes
      .slice()
      .sort((a, b) => Number(b.createdAt || b.id || 0) - Number(a.createdAt || a.id || 0));
    adminValidacaoCadastroLista.innerHTML = pendentesOrdenados.length
      ? pendentesOrdenados
          .map((c) => {
            const id = Number(c.id || 0);
            const obsTxt = String(c.observacaoAdm || "").trim();
            const obsHtml = obsTxt
              ? `<br><span class="hint">${escapeHtml(obsTxt)}</span>`
              : "";
            const ia = c.cadastroIa && typeof c.cadastroIa === "object" ? c.cadastroIa : null;
            let iaHtml = "";
            if (ia?.autenticidade) {
              const a = ia.autenticidade;
              const frente = a.cnhFrente?.pareceAutentico !== false ? "frente OK" : "frente revisar";
              const verso = a.cnhVerso?.pareceAutentico !== false ? "verso OK" : "verso revisar";
              const comp = a.comprovanteResidencia?.pareceAutentico !== false ? "comp. OK" : "comp. revisar";
              iaHtml = `<br><span class="hint">IA (autenticidade heurística): ${escapeHtml(
                `${frente}; ${verso}; ${comp}`
              )}${ia.geo ? " · Geo capturada" : ""}</span>`;
            }
            return `<p><strong>${escapeHtml(String(c.nome || "Sem nome"))}</strong> | CPF: ${formatCpf(
              c.cpf || ""
            )} | CEP: ${escapeHtml(String(c.cep || "-"))} | Endereço: ${escapeHtml(
              String(c.endereco || "-")
            )}${obsHtml}${iaHtml}<br><button type="button" class="secondary" data-validacao-aprovar="${id}">Aprovar</button> <button type="button" class="secondary" data-validacao-reprovar="${id}">Reprovar</button></p>`;
          })
          .join("")
      : "<p>Nenhum cadastro pendente de validação.</p>";
  }

  if (cadastroVeiculoLista) {
    cadastroVeiculoLista.innerHTML = "";
    cadastroVeiculoLista.classList.add("hidden");
  }

  if (cadastroLocacaoLista) {
    cadastroLocacaoLista.innerHTML = locacoes.length
      ? locacoes
          .slice(-10)
          .reverse()
          .map(
            (l) =>
              `<p><strong>Protocolo:</strong> ${escapeHtml(String(l.numeroContrato || "").trim() || "—")} | <strong>Placa:</strong> ${l.placa} | <strong>CPF:</strong> ${formatCpf(l.cpf)}${
                l.statusLocacao
                  ? ` | <strong>Status:</strong> ${escapeHtml(
                      normalizeStatusLocacaoExibicao(String(l.statusLocacao))
                    )}`
                  : ""
              } | <strong>Inicio:</strong> ${l.inicio}${l.fim ? ` | <strong>Fim:</strong> ${l.fim}` : ""}${
                l.valorSemanal ? ` | <strong>Valor semanal:</strong> ${l.valorSemanal}` : ""
              }</p>`
          )
          .join("")
      : "<p>Nenhuma locação cadastrada.</p>";
  }

  if (cadastroManutencaoLista) {
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
  }

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
              )} | Perfil: ${escapeHtml(f.role === "owner" ? "ADMINISTRADOR" : "OPERACIONAL")} | Acesso: ${
                f.blocked ? "<strong>BLOQUEADO</strong>" : "ATIVO"
              }</p>`
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

function getSituacaoFinanceira(contrato, opts = {}) {
  const devido = parseCurrencyBR(contrato.valorDevidoHoje ?? contrato.devidoHoje);
  const cpf = onlyDigits(String(opts.cpf ?? contrato.cpf ?? ""));
  const placa = String(opts.placa ?? contrato.placa ?? contrato?.veiculo?.placa ?? "").trim();
  const pagoBase = contrato.valorPago ?? contrato.pago;
  const pago =
    cpf.length === 11
      ? totalPagoBarComLancamentosApp(cpf, placa, pagoBase)
      : parseCurrencyBR(pagoBase);
  if (pago > devido) return "Regular";
  if (pago === devido) return "Em dia";
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
  const pago = pagoHarmonizadoRegistro(reg);
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

/** Última linha por placa em RECEITA_2026_DATA (espelho da planilha «dados de locação»). */
function buildLatestReceita2026RowByPlateMap() {
  const latestByPlate = new Map();
  if (!receita2026Data.length) return latestByPlate;
  receita2026Data.forEach((row) => {
    const plate = getCorrectedPlate(row.placa);
    if (!plate) return;
    const inicio = Number(row.inicioSerial || 0);
    const prev = latestByPlate.get(plate);
    if (!prev || inicio >= prev.inicioSerial) {
      latestByPlate.set(plate, { row, inicioSerial: inicio });
    }
  });
  return latestByPlate;
}

function getActivePlatesSet() {
  const fromCadastro = loadCadastro(CAD_LOCACOES_KEY)
    .filter((l) => !String(l.fim || "").trim())
    .map((l) => normalizePlate(l.placa))
    .filter(Boolean);
  const plates = new Set(fromCadastro);

  const latestByPlate = buildLatestReceita2026RowByPlateMap();
  latestByPlate.forEach(({ row }, plate) => {
    if (!String(row.fim || "").trim()) plates.add(plate);
  });

  return plates;
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

function getBestCadastroLocacaoForSnapshot(plateKey, sourceRecord) {
  const locacoes = loadCadastro(CAD_LOCACOES_KEY)
    .filter((l) => normalizePlate(l.placa) === plateKey)
    .sort((a, b) => {
      const byCreated = Number(b.createdAt || b.id || 0) - Number(a.createdAt || a.id || 0);
      if (byCreated !== 0) return byCreated;
      const da = parseBrDate(a.inicio);
      const db = parseBrDate(b.inicio);
      return (db?.getTime() || 0) - (da?.getTime() || 0);
    });
  if (!locacoes.length) return null;

  const cpfSource = onlyDigits(String(sourceRecord?.cpf || ""));
  const ativas = locacoes.filter((l) => !String(l.fim || "").trim());
  const base = ativas.length ? ativas : locacoes;

  if (cpfSource.length === 11) {
    const byCpf = base.find((l) => onlyDigits(String(l.cpf || "")) === cpfSource);
    if (byCpf) return byCpf;
  }
  return base[0] || null;
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

  const latestReceitaByPlate = buildLatestReceita2026RowByPlateMap();

  const activeRecords = Array.from(activeSet).map((plateKey) => {
    let source = pickBestRecordByPlate(baseRecords, plateKey) || {};
    const r = latestReceitaByPlate.get(plateKey)?.row;
    if (r) {
      const cpfR = onlyDigits(String(r.cpf || ""));
      const semSrc = Array.isArray(source.semanas) ? source.semanas : [];
      const semR = Array.isArray(r.semanas) ? r.semanas : [];
      source = {
        ...source,
        cpf: source.cpf || cpfR,
        nome: source.nome || r.nome,
        placa: source.placa || plateKey,
        inicio: source.inicio || r.inicio,
        inicioSerial:
          source.inicioSerial != null && source.inicioSerial !== ""
            ? source.inicioSerial
            : r.inicioSerial,
        fim: source.fim || r.fim,
        valorSemanal: source.valorSemanal || r.valorSemanal,
        devidoHoje: source.devidoHoje || r.devidoHoje,
        pago: source.pago || r.pago,
        dias: source.dias || r.dias,
        q: source.q || r.q,
        semanas: semSrc.length ? semSrc : semR,
        semanasCompletas: source.semanasCompletas || r.semanasCompletas,
      };
    }
    const vehicle = vehicleMap.get(plateKey) || {};
    const cadastroLocacao = getBestCadastroLocacaoForSnapshot(plateKey, source);
    const cpfResolved = onlyDigits(
      String(cadastroLocacao?.cpf || source.cpf || "")
    );
    const clienteCadastro =
      cpfResolved.length === 11 ? findClienteByCpfCadastro(cpfResolved) : null;
    const plateRaw = vehicle.placa || source.placa || plateKey;
    const numeroContrato = String(
      cadastroLocacao?.numeroContrato || source.numeroContrato || ""
    ).trim();
    return withDynamicFinancialFields({
      cpf: cadastroLocacao?.cpf || source.cpf || "",
      nome:
        clienteCadastro?.nome ||
        source.nome ||
        "Nao informado",
      placa: plateRaw,
      numeroContrato,
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
  const clientes = loadCadastro(CAD_CLIENTES_KEY);
  const nomeByCpf = new Map(
    clientes
      .map((c) => [onlyDigits(String(c.cpf || "")), String(c.nome || "").trim()])
      .filter(([cpf]) => cpf.length === 11)
  );
  const locacoes = loadCadastro(CAD_LOCACOES_KEY);
  return locacoes.map((l) =>
    withDynamicFinancialFields({
      cpf: onlyDigits(String(l.cpf || "")),
      nome: nomeByCpf.get(onlyDigits(String(l.cpf || ""))) || "Nao informado",
      placa: normalizePlate(String(l.placa || "")),
      inicio: String(l.inicio || "").trim(),
      fim: String(l.fim || "").trim(),
      valorSemanal: String(l.valorSemanal || "").trim(),
      devidoHoje: "",
      pago: 0,
      dias: "",
      q: 0,
      cor: 0,
      inicioSerial: null,
      fimSerial: null,
      semanas: [],
      semanasCompletas: [],
      numeroContrato: String(l.numeroContrato || "").trim(),
    })
  );
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
  const msg = document.getElementById("dashboardClienteMsg");
  if (msg) {
    msg.textContent = `Olá, ${String(cliente?.nome || "cliente").trim() || "cliente"}.`;
  }

  loginArea.classList.add("hidden");
  dashboardCard.classList.remove("hidden");
}

function renderAdminResult(title, htmlContent, options = {}) {
  if (adminResultTitle) adminResultTitle.textContent = title;
  if (!adminResultBody) return;
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

/**
 * Mesmo pool que RECEITA / RECEITA 2026 em findReceitaRecordForEstudo,
 * com filtro opcional por placa (para quadro por contrato).
 */
function findReceitaRecordForQuadro(cpfDigits, placaRaw) {
  const cpf = onlyDigits(String(cpfDigits || ""));
  const placa = normalizePlate(placaRaw);
  if (cpf.length !== 11) return null;
  const pool =
    adminData.length > 0
      ? adminData
      : receita2026Data.length
        ? receita2026Data
        : [];
  let matches = pool.filter((r) => onlyDigits(String(r.cpf || "")) === cpf);
  if (placa) {
    const byPlate = matches.filter((r) => normalizePlate(r.placa) === placa);
    if (byPlate.length) matches = byPlate;
  }
  if (!matches.length && pool !== receita2026Data && receita2026Data.length) {
    matches = receita2026Data.filter((r) => onlyDigits(String(r.cpf || "")) === cpf);
    if (placa) {
      const byPlate = matches.filter((r) => normalizePlate(r.placa) === placa);
      if (byPlate.length) matches = byPlate;
    }
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

function buildContractUniqueSignature(contract) {
  const nc = normalizeNumeroContratoKey(contract?.numeroContrato || contract?.protocolo || "");
  if (nc) return `NC|${nc}`;
  return buildContractMatchKey(contract?.placa, contract?.cpf, contract?.inicio, contract?.fim);
}

function getRowValueByNormKey(row, candidates) {
  if (!row || typeof row !== "object") return "";
  const entries = Object.entries(row);
  for (const wanted of candidates) {
    const hit = entries.find(([k]) => normalizeKey(k) === normalizeKey(wanted));
    if (hit) return String(hit[1] ?? "").trim();
  }
  return "";
}

/** Mapa placa → conjunto de protocolos existentes na planilha (API). */
function buildXlsxProtocolsByPlateMap(xlsxRows) {
  const map = new Map();
  if (!Array.isArray(xlsxRows)) return map;
  for (const row of xlsxRows) {
    const pl = normalizePlate(getRowValueByNormKey(row, ["placa", "Placa"]));
    if (!pl) continue;
    const nc = normalizeNumeroContratoKey(
      getRowValueByNormKey(row, ["protocolo", "Protocol", "Protocolo"])
    );
    if (!nc) continue;
    if (!map.has(pl)) map.set(pl, new Set());
    map.get(pl).add(nc);
  }
  return map;
}

function getXlsxProtocolSetForPlate(xlsxRows, plateRaw) {
  const pl = normalizePlate(plateRaw);
  if (!pl || !Array.isArray(xlsxRows)) return new Set();
  return buildXlsxProtocolsByPlateMap(xlsxRows).get(pl) || new Set();
}

function getXlsxProtocolSetForCpf(xlsxRows, cpfDigits) {
  const key = onlyDigits(String(cpfDigits || ""));
  const set = new Set();
  if (key.length !== 11 || !Array.isArray(xlsxRows)) return set;
  for (const row of xlsxRows) {
    if (onlyDigits(getRowValueByNormKey(row, ["cpf", "CPF"])) !== key) continue;
    const nc = normalizeNumeroContratoKey(
      getRowValueByNormKey(row, ["protocolo", "Protocol", "Protocolo"])
    );
    if (nc) set.add(nc);
  }
  return set;
}

/**
 * Quando a planilha lista protocolos para a placa (ou CPF), descarta linhas só da base local
 * cujo protocolo não existe na planilha (ex.: fallback AAAAMMDD gerado em relatório).
 */
function filterContratosPorPlanilhaSeDisponivel(contratos, xlsxProtocolSet) {
  if (!Array.isArray(contratos) || !contratos.length) return contratos;
  if (!(xlsxProtocolSet instanceof Set) || xlsxProtocolSet.size === 0) return contratos;
  return contratos.filter((c) => {
    const nc = normalizeNumeroContratoKey(c.numeroContrato || "");
    return nc && xlsxProtocolSet.has(nc);
  });
}

/** Se a placa existe na planilha com protocolos, o registro precisa bater com um deles. */
function rowPermitidoPelaPlanilhaLocacao(placa, protocolo, xlsxByPlate) {
  if (!(xlsxByPlate instanceof Map)) return true;
  const pl = normalizePlate(placa);
  const nc = normalizeNumeroContratoKey(protocolo || "");
  const set = xlsxByPlate.get(pl);
  if (!set || set.size === 0) return true;
  return Boolean(nc && set.has(nc));
}

async function loadLocacoesXlsxApiRows() {
  if (Array.isArray(locacoesXlsxApiCache)) return locacoesXlsxApiCache;
  if (
    typeof LOCACOES_PLANILHA_DATA !== "undefined" &&
    Array.isArray(LOCACOES_PLANILHA_DATA) &&
    LOCACOES_PLANILHA_DATA.length
  ) {
    locacoesXlsxApiCache = LOCACOES_PLANILHA_DATA;
    return locacoesXlsxApiCache;
  }
  if (locacoesXlsxApiPromise) return locacoesXlsxApiPromise;
  locacoesXlsxApiPromise = fetch("/api/locacoes-xlsx", { cache: "no-store" })
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
    .then((payload) => {
      const rows = Array.isArray(payload?.rows) ? payload.rows : [];
      locacoesXlsxApiCache = rows;
      return rows;
    })
    .catch(() => {
      locacoesXlsxApiCache = [];
      return [];
    })
    .finally(() => {
      locacoesXlsxApiPromise = null;
    });
  return locacoesXlsxApiPromise;
}

/**
 * Relatório «Veículos locados»: uma linha por placa com contrato ATIVO na planilha embarcada.
 * Se vários ATIVOs na mesma placa (inconsistência), mantém o de maior número de protocolo.
 */
function buildLocadosRowsFromPlanilhaEmbarcada(planilhaRows, veiculoByPlaca) {
  if (!Array.isArray(planilhaRows) || !planilhaRows.length) return [];
  const ativos = planilhaRows.filter((r) => {
    const st = normalizeKey(String(r.Status ?? r.status ?? "").trim());
    return st === "ATIVO";
  });
  if (!ativos.length) return [];
  const byPlate = new Map();
  ativos.forEach((r) => {
    const placa = normalizePlate(String(r.Placa ?? r.placa ?? ""));
    if (!placa) return;
    const prot = normalizeNumeroContratoKey(String(r.Protocolo ?? r.protocolo ?? "").trim());
    const cur = byPlate.get(placa);
    if (!cur) {
      byPlate.set(placa, r);
      return;
    }
    const curProt = normalizeNumeroContratoKey(String(cur.Protocolo ?? "").trim());
    if (prot && (!curProt || prot.localeCompare(curProt, undefined, { numeric: true }) > 0)) {
      byPlate.set(placa, r);
    }
  });
  const rows = [];
  byPlate.forEach((r, placaKey) => {
    const cpfRaw = getRowValueByNormKey(r, ["cpf", "CPF"]);
    const cpfDig = onlyDigits(cpfRaw);
    const nomeCli =
      String(getRowValueByNormKey(r, ["Cliente", "cliente"]) || "").trim() || "Nao informado";
    const contato = getContatoByCpfOrNome(cpfRaw, nomeCli);
    const telefones = splitTelefones(contato);
    const cad = veiculoByPlaca.get(placaKey);
    const inicioRaw = String(
      getRowValueByNormKey(r, ["Data Inicio", "Inicio", "Início"]) || ""
    ).trim();
    const inicioTail = inicioRaw.includes(",") ? inicioRaw.split(",").pop().trim() : inicioRaw;
    const inicioDate = parseBrDate(inicioTail) || parseBrDate(inicioRaw);
    const valorRaw =
      String(
        getRowValueByNormKey(r, ["Locação", "Locacao", "Valor da Parcela"]) || ""
      ).trim() || "";
    const protocolo =
      normalizeNumeroContratoKey(String(r.Protocolo ?? r.protocolo ?? "").trim()) || "-";
    rows.push({
      protocolo,
      placa: placaKey,
      modelo: cad?.modelo || findModeloByPlaca(placaKey),
      cliente: nomeCli,
      cpfDigits: cpfDig,
      valorLocacao: valorRaw,
      inicioLocacao: inicioRaw || "",
      cadastroCriadoTs: 0,
      inicioTs: inicioDate?.getTime?.() || 0,
      ...telefones,
    });
  });
  return rows;
}

function mergeContractsForPlaca(placaRaw) {
  const plateKey = normalizePlate(placaRaw);
  if (!plateKey) return [];
  const fromCache = Array.isArray(relatorioLocacaoCache?.rows)
    ? relatorioLocacaoCache.rows
        .filter((r) => normalizePlate(String(r?.placa || "")) === plateKey)
        .map((r) => ({
          cpf: onlyDigits(String(r.cpf || "")),
          nome: String(r.cliente || "").trim(),
          placa: plateKey,
          numeroContrato: normalizeNumeroContratoKey(r.protocolo || r.numeroContrato || ""),
          inicio: String(r.inicioLocacao || r.dataInicio || "").trim(),
          inicioSerial: null,
          fim:
            String(r.dataFim || "").trim() && String(r.dataFim || "").trim() !== "..."
              ? String(r.dataFim || "").trim()
              : "",
          fimSerial: null,
          valorSemanal: String(r.valorLocacao || "").trim(),
          pago: "",
          devidoHoje: "",
          q: "",
          semanas: [],
          semanasCompletas: [],
        }))
    : [];
  const snapshot = buildOperationalSnapshot();
  const fromSnapshot = [...snapshot.activeRecords, ...snapshot.inactiveRecords].filter(
    (r) => normalizePlate(r.placa) === plateKey
  );
  const fromAdmin = getAdminDataset().filter(
    (r) => normalizePlate(r.placa) === plateKey
  );
  const adminByKey = new Map();
  [...fromSnapshot, ...fromAdmin].forEach((r) => {
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
      numeroContrato: String(l.numeroContrato || "").trim(),
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

  const merged = [...fromCache, ...fromSnapshot, ...fromAdmin, ...extra];
  const byBase = new Map();
  merged.forEach((r) => {
    const baseKey = buildContractMatchKey(r.placa, r.cpf, r.inicio, r.fim);
    const currentNc = normalizeNumeroContratoKey(r.numeroContrato || r.protocolo || "");
    if (!byBase.has(baseKey)) {
      byBase.set(baseKey, { ...r, numeroContrato: currentNc || String(r.numeroContrato || "") });
      return;
    }
    const prev = byBase.get(baseKey);
    const prevNc = normalizeNumeroContratoKey(prev.numeroContrato || prev.protocolo || "");
    const mergedRow = {
      ...prev,
      ...r,
      numeroContrato: prevNc || currentNc || String(prev.numeroContrato || r.numeroContrato || ""),
    };
    byBase.set(baseKey, mergedRow);
  });
  const out = Array.from(byBase.values());

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

async function openPlacaHistoricoDialog(placaRaw) {
  if (!placaHistoricoDialog || !placaHistoricoBody) return;
  const plate = normalizePlate(placaRaw);
  if (!plate) return;
  const xlsxRows = await loadLocacoesXlsxApiRows();
  const fromXlsx = xlsxRows
    .filter((row) => normalizePlate(getRowValueByNormKey(row, ["placa", "Placa"])) === plate)
    .map((row) => ({
      cpf: onlyDigits(getRowValueByNormKey(row, ["cpf", "CPF"])),
      nome: getRowValueByNormKey(row, ["cliente", "Cliente"]),
      placa: plate,
      numeroContrato: normalizeNumeroContratoKey(getRowValueByNormKey(row, ["protocolo", "Protocol", "Protocolo"])),
      inicio: getRowValueByNormKey(row, ["Data Inicio", "Inicio", "Início"]),
      inicioSerial: null,
      fim: (() => {
        const v = getRowValueByNormKey(row, ["Data Fim", "Fim"]);
        if (v === "..." || normalizeKey(v) === "ATIVO") return "";
        return v;
      })(),
      fimSerial: null,
      valorSemanal:
        getRowValueByNormKey(row, ["Valor da Parcela"]) ||
        getRowValueByNormKey(row, ["Locacao", "Locação"]) ||
        "",
      statusLocacao: normalizeStatusLocacaoExibicao(getRowValueByNormKey(row, ["Status"])),
      pago: "",
      devidoHoje: "",
      q: "",
      semanas: [],
      semanasCompletas: [],
    }));

  const contratosRaw = [...fromXlsx, ...mergeContractsForPlaca(plate)];
  const canonicalInicioKey = (c) => {
    const d = inferStartDateForContrato(c);
    if (d) return formatDataDmaBr(d);
    return normalizeKey(String(c?.inicio || ""));
  };
  const contratoByBase = new Map();
  contratosRaw.forEach((c) => {
    const baseKey = [
      normalizePlate(c.placa),
      onlyDigits(String(c.cpf || "")),
      canonicalInicioKey(c),
    ].join("|");
    const current = contratoByBase.get(baseKey);
    const currNc = normalizeNumeroContratoKey(c.numeroContrato || "");
    if (!current) {
      contratoByBase.set(baseKey, c);
      return;
    }
    const prevNc = normalizeNumeroContratoKey(current.numeroContrato || "");
    // Para mesma base (placa+cpf+inicio), mantém o registro com protocolo válido.
    if (!prevNc && currNc) {
      contratoByBase.set(baseKey, c);
      return;
    }
    // Se ambos têm (ou ambos não têm) protocolo, mantém o mais completo.
    const prevScore = Number(Boolean(current.fim)) + Number(Boolean(current.valorSemanal));
    const currScore = Number(Boolean(c.fim)) + Number(Boolean(c.valorSemanal));
    if (currScore > prevScore) {
      contratoByBase.set(baseKey, c);
    }
  });
  let contratos = Array.from(contratoByBase.values());
  const ativosComProtocoloKeys = new Set(
    contratos
      .filter((c) => !String(c.fim || "").trim() && normalizeNumeroContratoKey(c.numeroContrato || ""))
      .map((c) => `${normalizePlate(c.placa)}|${onlyDigits(String(c.cpf || ""))}`)
  );
  contratos = contratos.filter((c) => {
    const nc = normalizeNumeroContratoKey(c.numeroContrato || "");
    if (nc) return true;
    if (String(c.fim || "").trim()) return true;
    const keyCpfPlaca = `${normalizePlate(c.placa)}|${onlyDigits(String(c.cpf || ""))}`;
    return !ativosComProtocoloKeys.has(keyCpfPlaca);
  });
  const xlsxProtoSetPlaca = getXlsxProtocolSetForPlate(xlsxRows, plate);
  contratos = filterContratosPorPlanilhaSeDisponivel(contratos, xlsxProtoSetPlaca);
  const modelo = findModeloByPlaca(plate);
  const protocolosUnicos = new Set(
    contratos
      .map((c) => normalizeNumeroContratoKey(c.numeroContrato || ""))
      .filter(Boolean)
  );
  const contratoAtivo = contratos.find((c) => !String(c.fim || "").trim());
  const protocoloAtivoContrato = normalizeNumeroContratoKey(contratoAtivo?.numeroContrato || "");
  const ativosCachePlaca = Array.isArray(relatorioLocacaoCache?.rows)
    ? relatorioLocacaoCache.rows
        .filter(
          (r) =>
            normalizePlate(String(r?.placa || "")) === plate &&
            normalizeKey(String(r?.status || "")).includes("ATIVO")
        )
        .map((r) => normalizeNumeroContratoKey(r.protocolo || r.numeroContrato || ""))
        .filter(Boolean)
    : [];
  const protocoloAtivoCache = ativosCachePlaca.length
    ? ativosCachePlaca.sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))[0]
    : "";
  const protocoloAtivoDisplay = protocoloAtivoContrato || protocoloAtivoCache || "";
  const protocolosCountDisplay = protocolosUnicos.size || (protocoloAtivoDisplay ? 1 : 0);
  if (!contratos.length) {
    placaHistoricoBody.innerHTML = `<p><strong>Placa:</strong> ${escapeHtml(
      plate
    )}</p><p><strong>Modelo:</strong> ${escapeHtml(
      modelo
    )}</p><p>Nenhum histórico de locação encontrado para esta placa.</p>`;
    placaHistoricoDialog.classList.remove("hidden");
    return;
  }

  // Regra operacional: apenas 1 protocolo ativo por placa.
  const fallbackAtivo = contratos
    .slice()
    .sort((a, b) => {
      const da = parseRecordStartDate(a)?.getTime() || 0;
      const db = parseRecordStartDate(b)?.getTime() || 0;
      return db - da;
    })
    .find((c) => normalizeNumeroContratoKey(c.numeroContrato || ""));
  const protocoloAtivoFinal = protocoloAtivoDisplay || normalizeNumeroContratoKey(fallbackAtivo?.numeroContrato || "");

  const rows = contratos
    .slice()
    .sort((a, b) => {
      const pa = normalizeNumeroContratoKey(a.numeroContrato || "");
      const pb = normalizeNumeroContratoKey(b.numeroContrato || "");
      if (protocoloAtivoFinal) {
        if (pa === protocoloAtivoFinal && pb !== protocoloAtivoFinal) return -1;
        if (pb === protocoloAtivoFinal && pa !== protocoloAtivoFinal) return 1;
      }
      const da = parseRecordStartDate(a)?.getTime() || 0;
      const db = parseRecordStartDate(b)?.getTime() || 0;
      return db - da;
    })
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
      const protocolo = normalizeNumeroContratoKey(c.numeroContrato || "") || "-";
      const statusLinha =
        protocoloAtivoFinal && protocolo === protocoloAtivoFinal
          ? "ATIVO"
          : "FINALIZADO";
      return `<tr>
        <td>${idx + 1}o</td>
        <td>${escapeHtml(protocolo)}</td>
        <td>${escapeHtml(statusLinha)}</td>
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
    <p><strong>Protocolos desta placa:</strong> ${protocolosCountDisplay} | <strong>Registros:</strong> ${contratos.length}${
      protocoloAtivoFinal ? ` | <strong>Protocolo ativo:</strong> ${escapeHtml(protocoloAtivoFinal)}` : ""
    }</p>
    ${
      protocolosCountDisplay === 1 && protocoloAtivoFinal
        ? `<p class="hint">Esta placa tem apenas 1 protocolo até a presente data: <strong>${escapeHtml(
            protocoloAtivoFinal
          )}</strong>.</p>`
        : ""
    }
    <div class="table-wrap">
      <table class="relatorio-table cliente-vida-table">
        <thead>
          <tr>
            <th>Ordem</th>
            <th>Protocolo</th>
            <th>Status</th>
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
  const fromCache = Array.isArray(relatorioLocacaoCache?.rows)
    ? relatorioLocacaoCache.rows
        .filter((r) => onlyDigits(String(r?.cpf || "")) === key)
        .map((r) => ({
          cpf: key,
          nome: String(r.cliente || "").trim(),
          placa: normalizePlate(String(r.placa || "")),
          numeroContrato: normalizeNumeroContratoKey(r.protocolo || r.numeroContrato || ""),
          inicio: String(r.inicioLocacao || r.dataInicio || "").trim(),
          inicioSerial: null,
          fim:
            String(r.dataFim || "").trim() && String(r.dataFim || "").trim() !== "..."
              ? String(r.dataFim || "").trim()
              : "",
          fimSerial: null,
          valorSemanal: String(r.valorLocacao || "").trim(),
          pago: "",
          devidoHoje: "",
          q: "",
          semanas: [],
          semanasCompletas: [],
        }))
    : [];
  const snapshot = buildOperationalSnapshot();
  const fromSnapshot = [...snapshot.activeRecords, ...snapshot.inactiveRecords].filter(
    (r) => onlyDigits(String(r.cpf || "")) === key
  );
  const fromAdmin = getAdminDataset().filter((r) => onlyDigits(String(r.cpf || "")) === key);
  const adminByKey = new Map();
  [...fromSnapshot, ...fromAdmin].forEach((r) => {
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
      numeroContrato: String(l.numeroContrato || "").trim(),
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
  const merged = [...fromCache, ...fromSnapshot, ...fromAdmin, ...extra];
  const byBase = new Map();
  merged.forEach((r) => {
    const baseKey = buildContractMatchKey(r.placa, r.cpf, r.inicio, r.fim);
    const currentNc = normalizeNumeroContratoKey(r.numeroContrato || r.protocolo || "");
    if (!byBase.has(baseKey)) {
      byBase.set(baseKey, { ...r, numeroContrato: currentNc || String(r.numeroContrato || "") });
      return;
    }
    const prev = byBase.get(baseKey);
    const prevNc = normalizeNumeroContratoKey(prev.numeroContrato || prev.protocolo || "");
    const mergedRow = {
      ...prev,
      ...r,
      numeroContrato: prevNc || currentNc || String(prev.numeroContrato || r.numeroContrato || ""),
    };
    byBase.set(baseKey, mergedRow);
  });
  const out = Array.from(byBase.values());
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
  const pago = pagoHarmonizadoRegistro(ref);
  if (!(devido > 0)) {
    return { texto: "Regular (sem valor devido calculado na base).", ok: true };
  }
  if (pago >= devido) {
    return { texto: "REGULAR: pagamentos em dia ou adiantados em relação ao devido atual.", ok: true };
  }
  return { texto: "NAO REGULAR: valor pago abaixo do devido até a data de referência.", ok: false };
}

async function openClienteVidaDialog(cpfDigits) {
  if (!clienteVidaDialog || !clienteVidaBody) return;
  const key = onlyDigits(String(cpfDigits || ""));
  if (key.length !== 11) return;
  let contratos = mergeContractsForCliente(key);
  const xlsxRowsCliente = await loadLocacoesXlsxApiRows();
  const xlsxProtoSetCpf = getXlsxProtocolSetForCpf(xlsxRowsCliente, key);
  contratos = filterContratosPorPlanilhaSeDisponivel(contratos, xlsxProtoSetCpf);
  const protocolosUnicos = new Set(
    contratos
      .map((c) => normalizeNumeroContratoKey(c.numeroContrato || ""))
      .filter(Boolean)
  );
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
      const pago = pagoHarmonizadoRegistro(c);
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
    <p><strong>Protocolos deste cliente:</strong> ${protocolosUnicos.size} | <strong>Registros:</strong> ${contratos.length}</p>
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
    group.paid += pagoHarmonizadoRegistro(r);
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
  if (adminNavInformacao) adminNavInformacao.classList.toggle("hidden", !isOwner);
  adminNavDados.classList.toggle("hidden", !isOwner);
  if (adminDadosMenu) adminDadosMenu.classList.toggle("hidden", !isOwner);
  operacaoTargetButtons.forEach((button) => {
    const buttonTarget = String(button.dataset.target || "");
    button.classList.toggle("hidden", !canAccessOperacaoTarget(buttonTarget));
  });
  setLayoutEditorsAccessByProfile();
  setAdminSection("operacao");
  setOperacaoSubsection(operacaoAbaAtual || "cliente");
  currentAdminReportSaldo = getGlobalSaldoTotal();
  renderCadastros();
  renderAdminResult(
    "Cadastros",
    "<p>Use <strong>Cadastro cliente</strong> ou <strong>Cadastro veículo</strong> no menu. Locação, contratos e financeiro não estão disponíveis nesta versão.</p>"
  );
}

function getClienteAreaPublicUrl() {
  const url = new URL(window.location.href);
  url.hash = "cadastro-ia";
  return url.toString();
}

function refreshClienteAreaQrCode() {
  const targetUrl = getClienteAreaPublicUrl();
  const mkSrc = (size) =>
    `https://api.qrserver.com/v1/create-qr-code/?size=${size}&data=${encodeURIComponent(targetUrl)}`;
  if (clienteAreaQrImg) clienteAreaQrImg.src = mkSrc("280x280");
  const landingQr = document.getElementById("landingClienteQrImg");
  if (landingQr) landingQr.src = mkSrc("220x220");
}

function fileToBase64Cliente(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const res = String(reader.result || "");
      const m = res.match(/^data:([^;]+);base64,(.+)$/);
      if (!m) {
        reject(new Error("Leitura da imagem falhou."));
        return;
      }
      resolve({ mime: m[1], base64: m[2] });
    };
    reader.onerror = () => reject(new Error("Arquivo inválido."));
    reader.readAsDataURL(file);
  });
}

/** Reduz fotos do celular (muitos MP) para não estourar limite da API e evitar travamentos. */
function loadImageElementFromFile(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Não foi possível abrir a imagem."));
    };
    img.src = url;
  });
}

async function prepareImageForCadastroIa(file) {
  const MAX_LONG_EDGE = 1600;
  const JPEG_QUALITY = 0.82;
  if (!file || !String(file.type || "").startsWith("image/")) {
    return fileToBase64Cliente(file);
  }
  try {
    const img = await loadImageElementFromFile(file);
    const w0 = img.naturalWidth || img.width;
    const h0 = img.naturalHeight || img.height;
    if (!w0 || !h0) return fileToBase64Cliente(file);
    const scale = Math.min(1, MAX_LONG_EDGE / Math.max(w0, h0));
    const tw = Math.max(1, Math.round(w0 * scale));
    const th = Math.max(1, Math.round(h0 * scale));
    const canvas = document.createElement("canvas");
    canvas.width = tw;
    canvas.height = th;
    const ctx = canvas.getContext("2d");
    if (!ctx) return fileToBase64Cliente(file);
    ctx.drawImage(img, 0, 0, tw, th);
    const blob = await new Promise((resolve) => {
      canvas.toBlob((b) => resolve(b), "image/jpeg", JPEG_QUALITY);
    });
    if (!blob) return fileToBase64Cliente(file);
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const res = String(reader.result || "");
        const m = res.match(/^data:([^;]+);base64,(.+)$/);
        if (!m) {
          reject(new Error("Compressão da foto falhou."));
          return;
        }
        resolve({ mime: "image/jpeg", base64: m[2] });
      };
      reader.onerror = () => reject(new Error("Leitura da foto comprimida falhou."));
      reader.readAsDataURL(blob);
    });
  } catch {
    return fileToBase64Cliente(file);
  }
}

function humanizeCadastroIaCatch(err) {
  const msg = String(err?.message || err || "");
  if (!msg || msg === "[object Object]") return "Erro ao processar. Tente de novo.";
  if (/Failed to fetch|NetworkError|Load failed|fetch/i.test(msg)) {
    return "Sem conexão estável ou requisição bloqueada. Use Wi‑Fi, confira os dados móveis ou tente outro navegador.";
  }
  return msg.length > 380 ? `${msg.slice(0, 380)}…` : msg;
}

function mergeObservacoesAdmCadastroIa(parsed) {
  const padraoTitular = "TITULAR DO COMPROVANTE DE RESIDENCIA DIFERENTE DO TITULAR DA HABILITAÇAO";
  const lines = [];
  if (parsed && Array.isArray(parsed.observacoesAdm)) {
    parsed.observacoesAdm.forEach((x) => {
      const s = String(x || "").trim();
      if (s) lines.push(s);
    });
  }
  if (parsed && parsed.titularComprovanteDiferenteDaCnh) {
    const has = lines.some(
      (l) =>
        l.toUpperCase().includes("COMPROVANTE") && l.toUpperCase().includes("HABILITA")
    );
    if (!has) lines.push(padraoTitular);
  }
  return lines.filter(Boolean).join(" | ");
}

function buildCadastroIaMeta(parsed, geo) {
  return {
    geo: geo || null,
    processadoEm: Date.now(),
    autenticidade: parsed?.autenticidade || null,
    titularComprovanteDiferenteDaCnh: Boolean(parsed?.titularComprovanteDiferenteDaCnh),
    nomeTitularComprovante: String(parsed?.nomeTitularComprovanteResidencia || "").trim() || null,
  };
}

function applyCadastroIaResultToPublicForm(parsed, geo) {
  const obs = mergeObservacoesAdmCadastroIa(parsed);
  if (clientePublicoCadastroForm) {
    clientePublicoCadastroForm.dataset.cadastroIaMeta = JSON.stringify({
      ...buildCadastroIaMeta(parsed, geo),
      observacaoAdm: obs || "",
      resultadoBruto: parsed,
    });
  }
  const cpf = onlyDigits(String(parsed?.cpf || ""));
  if (publicCadClienteCpf) publicCadClienteCpf.value = cpf.length === 11 ? formatCpf(cpf) : "";
  if (publicCadClienteNome) publicCadClienteNome.value = String(parsed?.nomeCompletoCnh || "").trim();
  if (publicCadClienteCnh) publicCadClienteCnh.value = onlyDigits(String(parsed?.numeroRegistroCnh || "")).slice(0, 20);
  if (publicCadClienteCategoria) publicCadClienteCategoria.value = String(parsed?.categoriaCnh || "").trim().slice(0, 16);
  if (publicCadClienteVencimento) publicCadClienteVencimento.value = String(parsed?.validadeCnh || "").trim().slice(0, 10);
  if (publicCadClienteDataCadastro) publicCadClienteDataCadastro.value = todayBrDate();
  const cepDigits = onlyDigits(String(parsed?.cep || ""));
  if (publicCadClienteCep && cepDigits.length === 8) {
    publicCadClienteCep.value = formatCepMask(cepDigits);
    void buscarEnderecoPublicoPorCep(true);
  }
  const endL = String(parsed?.enderecoLinha1 || "").trim();
  if (endL && publicCadClienteEndereco && !String(publicCadClienteEndereco.value || "").trim()) {
    publicCadClienteEndereco.value = endL.slice(0, 120);
  }
  const cidadeUf = String(parsed?.cidadeUf || "").trim();
  if (cidadeUf && publicCadClienteMunicipioUf && !String(publicCadClienteMunicipioUf.value || "").trim()) {
    publicCadClienteMunicipioUf.value = cidadeUf.slice(0, 60);
  }
  setPublicClienteEnderecoConfirmado(false);
}

function applyCadastroIaResultToStaffForm(parsed, geo) {
  const obs = mergeObservacoesAdmCadastroIa(parsed);
  if (clienteCadastroForm) {
    clienteCadastroForm.dataset.cadastroIaMeta = JSON.stringify({
      ...buildCadastroIaMeta(parsed, geo),
      observacaoAdm: obs || "",
      resultadoBruto: parsed,
    });
  }
  const cpf = onlyDigits(String(parsed?.cpf || ""));
  if (cadClienteCpfInput) cadClienteCpfInput.value = cpf.length === 11 ? formatCpf(cpf) : "";
  const nomeEl = document.getElementById("cadClienteNome");
  if (nomeEl) nomeEl.value = String(parsed?.nomeCompletoCnh || "").trim();
  if (cadClienteCnhInput) cadClienteCnhInput.value = onlyDigits(String(parsed?.numeroRegistroCnh || "")).slice(0, 20);
  const catEl = document.getElementById("cadClienteCategoria");
  if (catEl) catEl.value = String(parsed?.categoriaCnh || "").trim().slice(0, 16);
  const venEl = document.getElementById("cadClienteVencimento");
  if (venEl) venEl.value = String(parsed?.validadeCnh || "").trim().slice(0, 10);
  const dataCadEl = document.getElementById("cadClienteDataCadastro");
  if (dataCadEl) dataCadEl.value = todayBrDate();
  const cepDigits = onlyDigits(String(parsed?.cep || ""));
  if (cadClienteCepInput && cepDigits.length === 8) {
    cadClienteCepInput.value = formatCepMask(cepDigits);
    void buscarEnderecoClientePorCep(true);
  }
  const endL = String(parsed?.enderecoLinha1 || "").trim();
  if (endL && cadClienteEnderecoInput && !String(cadClienteEnderecoInput.value || "").trim()) {
    cadClienteEnderecoInput.value = endL.slice(0, 120);
  }
  const cidadeUf = String(parsed?.cidadeUf || "").trim();
  if (cidadeUf && cadClienteMunicipioUfInput && !String(cadClienteMunicipioUfInput.value || "").trim()) {
    cadClienteMunicipioUfInput.value = cidadeUf.slice(0, 60);
  }
  invalidateClienteEnderecoConfirmacao();
  const cpfOnly = onlyDigits(String(cadClienteCpfInput?.value || ""));
  if (cpfOnly.length === 11) refreshClienteCodigoByCpf(cpfOnly);
}

function parseCadastroIaPayloadFromForm(formEl) {
  if (!formEl) return { observacaoAdm: "", cadastroIa: null };
  try {
    const raw = formEl.dataset.cadastroIaMeta;
    if (!raw) return { observacaoAdm: "", cadastroIa: null };
    const o = JSON.parse(raw);
    return {
      observacaoAdm: String(o.observacaoAdm || "").trim(),
      cadastroIa: {
        geo: o.geo || null,
        processadoEm: o.processadoEm,
        autenticidade: o.autenticidade || null,
        titularComprovanteDiferenteDaCnh: Boolean(o.titularComprovanteDiferenteDaCnh),
        nomeTitularComprovante: o.nomeTitularComprovante || null,
      },
    };
  } catch {
    return { observacaoAdm: "", cadastroIa: null };
  }
}

function bindCadastroIaWizards() {
  if (typeof window.dkExtrairCadastroClienteDocumentos !== "function") return;
  document.querySelectorAll("[data-ia-wizard]").forEach((root) => {
    const mode = String(root.getAttribute("data-ia-wizard") || "");
    const geoBtn = root.querySelector(".cadastro-ia-geo");
    const geoStatus = root.querySelector(".cadastro-ia-geo-status");
    const runBtn = root.querySelector(".cadastro-ia-run");
    const msgEl = root.querySelector(".cadastro-ia-msg");
    let geo = null;
    const inputs = {
      cnhFrente: root.querySelector('[data-ia-part="cnhFrente"]'),
      cnhVerso: root.querySelector('[data-ia-part="cnhVerso"]'),
      comprovante: root.querySelector('[data-ia-part="comprovante"]'),
    };
    function setMsg(text, kind) {
      if (!msgEl) return;
      msgEl.textContent = text || "";
      msgEl.classList.remove("error", "success");
      if (kind === "error") msgEl.classList.add("error");
      if (kind === "success") msgEl.classList.add("success");
    }
    if (geoBtn) {
      geoBtn.addEventListener("click", () => {
        if (!navigator.geolocation) {
          if (geoStatus) geoStatus.textContent = "Geolocalização não disponível neste aparelho.";
          return;
        }
        if (geoStatus) geoStatus.textContent = "Obtendo localização…";
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            geo = {
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
              accuracy: pos.coords.accuracy,
              ts: Date.now(),
            };
            if (geoStatus)
              geoStatus.textContent = `Localização obtida (±${Math.round(pos.coords.accuracy)} m).`;
          },
          () => {
            if (geoStatus)
              geoStatus.textContent =
                "Permissão negada ou indisponível. Você pode continuar sem localização.";
          },
          { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
        );
      });
    }
    if (runBtn) {
      runBtn.addEventListener("click", async () => {
        const key = getStoredOpenAIKey();
        if (!key) {
          setMsg(
            "Neste aparelho ainda não há chave OpenAI salva. Entre como funcionário → Lançamento de aluguel → salve a chave em Comprovante (IA). Cada celular precisa salvar a chave uma vez.",
            "error"
          );
          return;
        }
        try {
          const blobs = {};
          setMsg("Preparando fotos no aparelho (reduzindo tamanho)…", "");
          for (const k of ["cnhFrente", "cnhVerso", "comprovante"]) {
            const inp = inputs[k];
            const f = inp?.files?.[0];
            if (!f) {
              setMsg("Selecione as três fotos (frente CNH, verso CNH, comprovante).", "error");
              return;
            }
            blobs[k] = await prepareImageForCadastroIa(f);
          }
          setMsg("Enviando para a IA… pode levar até 1–2 min no 4G.", "");
          runBtn.disabled = true;
          const parsed = await window.dkExtrairCadastroClienteDocumentos(key, {
            cnhFrente: blobs.cnhFrente,
            cnhVerso: blobs.cnhVerso,
            comprovante: blobs.comprovante,
            geo,
          });
          if (mode === "public") applyCadastroIaResultToPublicForm(parsed, geo);
          else applyCadastroIaResultToStaffForm(parsed, geo);
          setMsg(
            "Formulário preenchido com a IA. Confira os dados e confirme o endereço antes de enviar.",
            "success"
          );
        } catch (e) {
          setMsg(humanizeCadastroIaCatch(e), "error");
        } finally {
          runBtn.disabled = false;
        }
      });
    }
  });
}

function applyDeepLinkCadastroIaFromHash() {
  if ((window.location.hash || "").toLowerCase() !== "#cadastro-ia") return;
  if (getSession()) return;
  showLocadoraArea();
  loginArea.classList.remove("hidden");
  dashboardCard.classList.add("hidden");
  adminCard.classList.add("hidden");
  requestAnimationFrame(() => {
    document.getElementById("cadastroIaClientePublic")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

function runAdminAction(action, scope) {
  const snapshot = buildOperationalSnapshot();
  const records = getRecordsByScope(scope);
  currentAdminReportSaldo = computeSaldoFromRecords(records);
  const previewLimit = 120;
  const scopeLabel =
    scope === "ativos"
      ? "Contratos Ativos"
      : scope === "inativos"
        ? "Contratos Inativos"
        : "Todos os contratos";
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
    const veiculosCadastro = loadCadastro(CAD_VEICULOS_KEY);
    const veiculosBase = veiculosCadastro.length ? veiculosCadastro : frotaData;
    const activePlates = new Set(
      snapshot.activeRecords.map((r) => normalizePlate(r.placa)).filter(Boolean)
    );
    const inactivePlates = new Set(
      snapshot.inactiveRecords.map((r) => normalizePlate(r.placa)).filter(Boolean)
    );
    let sourceRows = veiculosBase
      .map((v) => {
        const placa = normalizePlate(v.placa || "");
        if (!placa) return null;
        return {
          placa,
          nome: "Sem vínculo de cliente",
          modeloVeiculo: String(v.modelo || "").trim(),
        };
      })
      .filter(Boolean);
    if (scope === "ativos") {
      sourceRows = sourceRows.filter((r) => activePlates.has(r.placa));
    } else if (scope === "inativos") {
      sourceRows = sourceRows.filter((r) => inactivePlates.has(r.placa));
    }
    if (!sourceRows.length && veiculosBase.length) {
      sourceRows = veiculosBase
        .map((v) => {
          const placa = normalizePlate(v.placa || "");
          if (!placa) return null;
          return {
            placa,
            nome: "Sem vínculo de cliente",
            modeloVeiculo: String(v.modelo || "").trim(),
          };
        })
        .filter(Boolean);
    }
    const grouped = {};
    sourceRows.forEach((r) => {
      const modelo = r.modeloVeiculo || findModeloByPlaca(r.placa);
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
    const baseReceita2026 = records;
    const previsaoSemanalRows = baseReceita2026.filter(
      (r) => !String(r.fim || "").trim()
    );
    const totalSemanal = previsaoSemanalRows.reduce(
      (acc, r) => acc + parseCurrencyBR(r.valorSemanal),
      0
    );
    const totalPago = records.reduce((acc, r) => acc + pagoHarmonizadoRegistro(r), 0);
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
    const financeiroBase = records;
    const emDia = [];
    const atraso = [];
    financeiroBase.forEach((r) => {
      const devido = parseCurrencyBR(r.devidoHoje);
      const pago = pagoHarmonizadoRegistro(r);
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
    const filtered = records.map((r, idx) => {
      const cpf = onlyDigits(String(r.cpf || ""));
      const placa = normalizePlate(String(r.placa || ""));
      const pagoNum = pagoHarmonizadoRegistro({ ...r, cpf, placa });
      const devidoNum = parseCurrencyBR(r.devidoHoje);
      const saldoNum = pagoNum - devidoNum;
      return {
        id: idx + 1,
        clienteNome: String(r.nome || "Nao informado").trim(),
        cpf,
        placa,
        modeloVeiculo: findModeloByPlaca(placa),
        dataInicio: String(r.inicio || "").trim(),
        dataFim: String(r.fim || "").trim(),
        plano: toPlanName(r),
        valorDevidoHoje: currencyBRL(devidoNum),
        valorPagoHoje: currencyBRL(pagoNum),
        saldo: `${saldoNum >= 0 ? "+" : "-"} ${currencyBRL(Math.abs(saldoNum))}`,
        saldoNumerico: saldoNum,
      };
    });
    currentQuadroGeralRows = filtered;
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
  setLayoutEditorsAccessByProfile();
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
  if (funcionario.blocked) {
    showMessage(loginAdminMessage, "Acesso bloqueado para este funcionario. Fale com o administrador.", "error");
    return;
  }
  if (funcionario.role === "operacao" && funcionario.mustChangePassword) {
    const novaSenha = window.prompt(
      "Primeiro acesso detectado. Defina uma nova senha com 6 números para continuar."
    );
    if (novaSenha === null) {
      showMessage(loginAdminMessage, "Troca de senha obrigatória para primeiro acesso.", "error");
      return;
    }
    const novaSenhaTrim = String(novaSenha || "").trim();
    if (!isOperacaoPasswordValid(novaSenhaTrim) || novaSenhaTrim === SENHA_INICIAL_OPERACAO) {
      showMessage(loginAdminMessage, "Use uma senha nova com exatamente 6 números.", "error");
      return;
    }
    const confirmaSenha = window.prompt("Confirme a nova senha de 6 números.");
    if (confirmaSenha === null || String(confirmaSenha || "").trim() !== novaSenhaTrim) {
      showMessage(loginAdminMessage, "Confirmação de senha inválida.", "error");
      return;
    }
    funcionario.senha = novaSenhaTrim;
    funcionario.mustChangePassword = false;
    saveFuncionariosAccess();
    addAuditLog(
      "troca_primeiro_acesso_funcionario",
      "funcionario",
      `${funcionario.nome} - CPF ${formatCpf(funcionario.cpf)}`
    );
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

if (homeLayoutEditToggleBtn) {
  homeLayoutEditToggleBtn.addEventListener("click", () => {
    if (!canEditLayoutsByProfile()) return;
    if (homeLayoutEditMode) {
      stopHomeLayoutEdit();
      return;
    }
    startHomeLayoutEdit();
    bindHomeLayoutEditorEvents();
  });
}
if (homeLayoutSaveBtn) {
  homeLayoutSaveBtn.addEventListener("click", () => {
    if (!canEditLayoutsByProfile()) return;
    persistHomeLayoutFromScreen();
    stopHomeLayoutEdit();
    window.alert("Layout salvo com sucesso.");
  });
}
if (homeLayoutResetBtn) {
  homeLayoutResetBtn.addEventListener("click", () => {
    if (!canEditLayoutsByProfile()) return;
    localStorage.removeItem(HOME_LAYOUT_KEY);
    stopHomeLayoutEdit();
    clearHomeLayoutInlineStyles();
    window.alert("Layout resetado para o padrão.");
  });
}

if (funcLayoutEditToggleBtn) {
  funcLayoutEditToggleBtn.addEventListener("click", () => {
    if (!canEditLayoutsByProfile()) return;
    if (funcLayoutEditMode) {
      stopFuncionarioLayoutEdit();
      return;
    }
    startFuncionarioLayoutEdit();
    bindFuncionarioLayoutEditorEvents();
    window.alert("Modo edição ativo. Use ALT + arrastar para mover e SHIFT + arrastar para redimensionar.");
  });
}
if (funcLayoutSaveBtn) {
  funcLayoutSaveBtn.addEventListener("click", () => {
    if (!canEditLayoutsByProfile()) return;
    persistFuncionarioLayoutFromScreen();
    stopFuncionarioLayoutEdit();
    window.alert("Layout do cadastro de funcionário salvo.");
  });
}
if (funcLayoutResetBtn) {
  funcLayoutResetBtn.addEventListener("click", () => {
    if (!canEditLayoutsByProfile()) return;
    localStorage.removeItem(FUNC_LAYOUT_KEY);
    stopFuncionarioLayoutEdit();
    clearFuncionarioLayoutInlineStyles();
    window.alert("Layout do cadastro de funcionário resetado.");
  });
}
if (clienteLayoutEditToggleBtn) {
  clienteLayoutEditToggleBtn.addEventListener("click", () => {
    if (!canEditLayoutsByProfile()) return;
    if (clienteLayoutEditMode) {
      stopClienteLayoutEdit();
      return;
    }
    startClienteLayoutEdit();
    bindClienteLayoutEditorEvents();
    window.alert("Modo edição ativo. Use ALT + arrastar para mover e SHIFT + arrastar para redimensionar.");
  });
}
if (clienteLayoutSaveBtn) {
  clienteLayoutSaveBtn.addEventListener("click", () => {
    if (!canEditLayoutsByProfile()) return;
    persistClienteLayoutFromScreen();
    stopClienteLayoutEdit();
    window.alert("Layout do cadastro de cliente salvo.");
  });
}
if (clienteLayoutResetBtn) {
  clienteLayoutResetBtn.addEventListener("click", () => {
    if (!canEditLayoutsByProfile()) return;
    localStorage.removeItem(CLIENTE_LAYOUT_KEY);
    stopClienteLayoutEdit();
    clearClienteLayoutInlineStyles();
    window.alert("Layout do cadastro de cliente resetado.");
  });
}
if (locLayoutEditToggleBtn) {
  locLayoutEditToggleBtn.addEventListener("click", () => {
    if (!canEditLayoutsByProfile()) return;
    if (locLayoutEditMode) {
      stopLocacaoLayoutEdit();
      return;
    }
    startLocacaoLayoutEdit();
    bindLocacaoLayoutEditorEvents();
    window.alert("Modo edição ativo. Use ALT + arrastar para mover e SHIFT + arrastar para redimensionar.");
  });
}
if (locLayoutSaveBtn) {
  locLayoutSaveBtn.addEventListener("click", () => {
    if (!canEditLayoutsByProfile()) return;
    persistLocacaoLayoutFromScreen();
    stopLocacaoLayoutEdit();
    window.alert("Layout do cadastro de locação salvo.");
  });
}
if (locLayoutResetBtn) {
  locLayoutResetBtn.addEventListener("click", () => {
    if (!canEditLayoutsByProfile()) return;
    localStorage.removeItem(LOC_LAYOUT_KEY);
    stopLocacaoLayoutEdit();
    clearLocacaoLayoutInlineStyles();
    window.alert("Layout do cadastro de locação resetado.");
  });
}

if (topbarAcessoCliente) {
  topbarAcessoCliente.addEventListener("click", () => openLocadoraLoginTarget("cliente"));
}
if (topbarAcessoColaborador) {
  topbarAcessoColaborador.addEventListener("click", () => openLocadoraLoginTarget("colaborador"));
}
if (landingAcessoCliente) {
  landingAcessoCliente.addEventListener("click", () => openLocadoraLoginTarget("cliente"));
}
if (landingAcessoColaborador) {
  landingAcessoColaborador.addEventListener("click", () => openLocadoraLoginTarget("colaborador"));
}
{
  const landingIaBtn = document.getElementById("landingAbrirCadastroIaBtn");
  if (landingIaBtn) {
    landingIaBtn.addEventListener("click", () => {
      window.location.hash = "cadastro-ia";
      applyDeepLinkCadastroIaFromHash();
    });
  }
}

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
  const opened = toggleAdminSection("operacao");
  if (!opened) return;
  setOperacaoSubsection(operacaoAbaAtual || "cliente");
});

if (adminNavInformacao) {
  adminNavInformacao.addEventListener("click", () => {
    const session = getSession();
    if (session?.role !== "owner") {
      setAdminSection("operacao");
      return;
    }
    const opened = toggleAdminSection("informacao");
    if (!opened) return;
    if (!informacaoEscopoAtual) setInformacaoScope("todos");
  });
}

adminNavDados.addEventListener("click", () => {
  const session = getSession();
  if (session?.role !== "owner") {
    setAdminSection("operacao");
    return;
  }
  toggleAdminSection("dados");
});

if (adminDadosUsoBtn) {
  adminDadosUsoBtn.addEventListener("click", () => {
    const session = getSession();
    if (session?.role !== "owner") {
      setAdminSection("operacao");
      return;
    }
    setAdminSection("dados");
    setAdminDadosSubsection("dadosUso");
  });
}
if (adminValidacaoCadastroBtn) {
  adminValidacaoCadastroBtn.addEventListener("click", () => {
    const session = getSession();
    if (session?.role !== "owner") {
      setAdminSection("operacao");
      return;
    }
    setAdminSection("dados");
    setAdminDadosSubsection("validacaoCadastro");
  });
}

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
    sairModoEdicaoFuncionario();
    clearFuncionarioNomeDatalist();
    refreshFuncionarioAccessInputsByRole();
    refreshFuncionarioAdminActionButtons();
    if (funcionarioCadastroErro) {
      funcionarioCadastroErro.textContent = "";
      funcionarioCadastroErro.classList.add("hidden");
    }
  });
}

if (cadFuncionarioRole) {
  cadFuncionarioRole.addEventListener("change", () => {
    refreshFuncionarioAccessInputsByRole();
    refreshFuncionarioAdminActionButtons();
  });
}

if (cadFuncionarioCpf) {
  cadFuncionarioCpf.addEventListener("input", () => {
    cadFuncionarioCpf.value = formatCpf(onlyDigits(String(cadFuncionarioCpf.value || "")));
    tryAutofillFuncionarioNomePorCpf();
    refreshFuncionarioAdminActionButtons();
  });
}

if (cadFuncionarioNome) {
  cadFuncionarioNome.addEventListener("focus", () => {
    if (funcionarioAutofillGuard) return;
    if (!String(cadFuncionarioNome.value || "").trim()) {
      populateFuncionarioNomeDatalistFromQuery("", { allowAllWhenEmpty: true });
    }
  });
  cadFuncionarioNome.addEventListener("input", () => {
    if (!funcionarioAutofillGuard) {
      const q = String(cadFuncionarioNome.value || "");
      populateFuncionarioNomeDatalistFromQuery(q);
      tryAutofillFuncionarioCpfPorNome();
    }
    refreshFuncionarioAdminActionButtons();
  });
  cadFuncionarioNome.addEventListener("change", () => {
    if (!funcionarioAutofillGuard) {
      tryAutofillFuncionarioCpfPorNome();
      refreshFuncionarioAdminActionButtons();
    }
  });
}

if (cadFuncionarioEditBtn) {
  cadFuncionarioEditBtn.addEventListener("click", () => {
    const session = getSession();
    if (session?.tipo !== "admin" || session?.role !== "owner") return;
    const alvo = findFuncionarioByCpfOrNome(cadFuncionarioCpf?.value, cadFuncionarioNome?.value);
    if (!alvo || alvo.blocked) return;
    funcionarioEdicaoCpf = alvo.cpf;
    if (cadFuncionarioCpf) {
      cadFuncionarioCpf.readOnly = true;
      cadFuncionarioCpf.setAttribute("readonly", "readonly");
    }
    aplicarFuncionarioAoFormulario(alvo);
    if (cadFuncionarioSubmitBtn) cadFuncionarioSubmitBtn.textContent = "Atualizar funcionário";
    refreshFuncionarioAdminActionButtons();
    if (funcionarioCadastroErro) {
      funcionarioCadastroErro.textContent = "";
      funcionarioCadastroErro.classList.add("hidden");
    }
  });
}

if (cadFuncionarioBlockBtn) {
  cadFuncionarioBlockBtn.addEventListener("click", () => {
    const session = getSession();
    if (session?.tipo !== "admin" || session?.role !== "owner") return;
    const alvo = findFuncionarioByCpfOrNome(cadFuncionarioCpf?.value, cadFuncionarioNome?.value);
    if (!alvo || alvo.role === "owner") return;
    const ok = window.confirm(`Confirma bloquear o acesso de ${alvo.nome} (${formatCpf(alvo.cpf)})?`);
    if (!ok) return;
    alvo.blocked = true;
    saveFuncionariosAccess();
    addAuditLog("bloquear_funcionario", "funcionario", `${alvo.nome} - CPF ${formatCpf(alvo.cpf)}`);
    window.alert("ACESSO BLOQUEADO COM SUCESSO");
    refreshFuncionarioAdminActionButtons();
    renderCadastros();
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
    const acessos = normalizeOperacaoAccess(
      {
        cliente: Boolean(cadFuncionarioAcessoCliente?.checked),
        veiculo: Boolean(cadFuncionarioAcessoVeiculo?.checked),
        locacao: Boolean(cadFuncionarioAcessoLocacao?.checked),
        manutencao: Boolean(cadFuncionarioAcessoManutencao?.checked),
        lancamentoAluguel: Boolean(cadFuncionarioAcessoLancamentoAluguel?.checked),
        lancamentoDespesa: Boolean(cadFuncionarioAcessoLancamentoDespesa?.checked),
      },
      role
    );
    if (cpf.length !== 11 || !nome) {
      if (funcionarioCadastroErro) {
        funcionarioCadastroErro.textContent = "PREENCHA CPF VALIDO (11 DIGITOS) E NOME.";
        funcionarioCadastroErro.classList.remove("hidden");
      }
      return;
    }

    const idxEdicao =
      funcionarioEdicaoCpf !== null
        ? funcionariosAccess.findIndex((f) => onlyDigits(String(f.cpf || "")) === funcionarioEdicaoCpf)
        : -1;

    if (idxEdicao >= 0) {
      const atual = funcionariosAccess[idxEdicao];
      const novaSenha = senha.length > 0 ? senha : atual.senha;
      if (role === "operacao" && !isOperacaoPasswordValid(novaSenha)) {
        if (funcionarioCadastroErro) {
          funcionarioCadastroErro.textContent =
            "PARA PERFIL OPERACIONAL, A SENHA DEVE TER EXATAMENTE 6 NUMEROS.";
          funcionarioCadastroErro.classList.remove("hidden");
        }
        return;
      }
      if (role === "owner" && senha.length > 0 && senha.length < 4) {
        if (funcionarioCadastroErro) {
          funcionarioCadastroErro.textContent = "SE FOR TROCAR A SENHA, USE PELO MENOS 4 CARACTERES.";
          funcionarioCadastroErro.classList.remove("hidden");
        }
        return;
      }
      funcionariosAccess[idxEdicao] = {
        ...atual,
        nome,
        role,
        senha: novaSenha,
        mustChangePassword: role === "operacao" ? false : Boolean(atual.mustChangePassword),
        acessos,
      };
      saveFuncionariosAccess();
      addAuditLog("editar_funcionario", "funcionario", `${nome} - CPF ${formatCpf(cpf)} - PERFIL ${role}`);
      if (funcionarioCadastroForm) funcionarioCadastroForm.reset();
      sairModoEdicaoFuncionario();
      clearFuncionarioNomeDatalist();
      refreshFuncionarioAccessInputsByRole();
      refreshFuncionarioAdminActionButtons();
      if (funcionarioCadastroErro) {
        funcionarioCadastroErro.textContent = "";
        funcionarioCadastroErro.classList.add("hidden");
      }
      window.alert("FUNCIONARIO ATUALIZADO COM SUCESSO");
      renderCadastros();
      return;
    }

    if (role === "owner" && senha.length < 4) {
      if (funcionarioCadastroErro) {
        funcionarioCadastroErro.textContent =
          "PREENCHA SENHA COM PELO MENOS 4 CARACTERES PARA NOVO CADASTRO DE ADMINISTRADOR.";
        funcionarioCadastroErro.classList.remove("hidden");
      }
      return;
    }

    const existe = funcionariosAccess.some((f) => onlyDigits(String(f.cpf || "")) === cpf);
    if (existe) {
      if (funcionarioCadastroErro) {
        funcionarioCadastroErro.textContent =
          "JA EXISTE FUNCIONARIO COM ESTE CPF. CLIQUE EM EDITAR FUNCIONARIO PARA ALTERAR.";
        funcionarioCadastroErro.classList.remove("hidden");
      }
      return;
    }
    const senhaCadastro = role === "operacao" ? SENHA_INICIAL_OPERACAO : senha;
    funcionariosAccess.push({
      cpf,
      senha: senhaCadastro,
      nome,
      role,
      blocked: false,
      mustChangePassword: role === "operacao",
      acessos,
    });
    saveFuncionariosAccess();
    addAuditLog("cadastrar_funcionario", "funcionario", `${nome} - CPF ${formatCpf(cpf)} - PERFIL ${role}`);
    if (funcionarioCadastroForm) funcionarioCadastroForm.reset();
    sairModoEdicaoFuncionario();
    clearFuncionarioNomeDatalist();
    refreshFuncionarioAccessInputsByRole();
    refreshFuncionarioAdminActionButtons();
    if (funcionarioCadastroErro) {
      funcionarioCadastroErro.textContent = "";
      funcionarioCadastroErro.classList.add("hidden");
    }
    if (role === "operacao") {
      window.alert(
        `FUNCIONARIO CADASTRADO COM SUCESSO. SENHA INICIAL: ${SENHA_INICIAL_OPERACAO}. NO PRIMEIRO ACESSO, A TROCA PARA 6 NUMEROS E OBRIGATORIA.`
      );
    } else {
      window.alert("FUNCIONARIO CADASTRADO COM SUCESSO");
    }
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
  const cep = formatCepMask(String(cadClienteCepInput?.value || "").trim());
  const municipioUf = String(cadClienteMunicipioUfInput?.value || "").trim();
  const enderecoBase = String(cadClienteEnderecoInput?.value || "").trim();
  const complemento = String(cadClienteComplementoInput?.value || "").trim();
  const endereco = [enderecoBase, complemento].filter(Boolean).join(", ");
  if (!nome || !cpf) return;
  if (String(clienteCadastroForm?.dataset?.enderecoConfirmado || "0") !== "1") {
    clienteCadastroErro.textContent = "CONFIRME O ENDERECO NO BOTAO 'CONFIRMAR ENDERECO' ANTES DE SALVAR.";
    clienteCadastroErro.classList.remove("hidden");
    return;
  }

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
    complemento,
    endereco,
  });
  if (!confirmado) return;
  const iaExtra = parseCadastroIaPayloadFromForm(clienteCadastroForm);
  const envio = enqueueClienteParaValidacao(
    {
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
      enderecoBase,
      complemento,
      endereco,
      ...iaExtra,
    },
    "operacao"
  );
  if (!envio.ok) {
    clienteCadastroErro.textContent = envio.message || "NAO FOI POSSIVEL ENVIAR PARA AVALIACAO.";
    clienteCadastroErro.classList.remove("hidden");
    return;
  }
  window.alert("CADASTRO ENVIADO PARA AVALIACAO DO ADMINISTRADOR");
  clienteCadastroForm.reset();
  delete clienteCadastroForm.dataset.cadastroIaMeta;
  setClienteEnderecoConfirmado(false);
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

if (cadClienteCepInput) {
  cadClienteCepInput.addEventListener("input", () => {
    cadClienteCepInput.value = formatCepMask(cadClienteCepInput.value);
    invalidateClienteEnderecoConfirmacao();
    if (onlyDigits(String(cadClienteCepInput.value || "")).length === 8) {
      void buscarEnderecoClientePorCep();
    }
  });
  cadClienteCepInput.addEventListener("blur", () => {
    cadClienteCepInput.value = formatCepMask(cadClienteCepInput.value);
    void buscarEnderecoClientePorCep(true);
  });
}

if (cadClienteCnhInput) {
  cadClienteCnhInput.addEventListener("input", () => {
    cadClienteCnhInput.value = onlyDigits(String(cadClienteCnhInput.value || "")).slice(0, 20);
  });
}

[cadClienteMunicipioUfInput, cadClienteEnderecoInput, cadClienteComplementoInput].forEach((el) => {
  if (!el) return;
  el.addEventListener("input", () => {
    invalidateClienteEnderecoConfirmacao();
  });
});

if (cadClienteConfirmEnderecoBtn) {
  cadClienteConfirmEnderecoBtn.addEventListener("click", () => {
    const cep = formatCepMask(String(cadClienteCepInput?.value || "").trim());
    const municipioUf = String(cadClienteMunicipioUfInput?.value || "").trim();
    const enderecoBase = String(cadClienteEnderecoInput?.value || "").trim();
    const complemento = String(cadClienteComplementoInput?.value || "").trim();
    if (!cep || !municipioUf || !enderecoBase || !complemento) {
      setCadClienteCepStatus(
        "⚠️ Para confirmar o endereço, preencha CEP, Município/UF, Rua/Bairro e Número/Casa/AP.",
        "error"
      );
      return;
    }
    setClienteEnderecoConfirmado(true);
    setCadClienteCepStatus("✅ Endereço confirmado para o cadastro.", "success");
  });
}

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
  const cep = formatCepMask(String(cadClienteCepInput?.value || "").trim());
  const municipioUf = String(cadClienteMunicipioUfInput?.value || "").trim();
  const enderecoBase = String(cadClienteEnderecoInput?.value || "").trim();
  const complemento = String(cadClienteComplementoInput?.value || "").trim();
  const endereco = [enderecoBase, complemento].filter(Boolean).join(", ");
  if (!nome || !cpf) return;
  if (String(clienteCadastroForm?.dataset?.enderecoConfirmado || "0") !== "1") {
    clienteCadastroErro.textContent = "CONFIRME O ENDERECO NO BOTAO 'CONFIRMAR ENDERECO' ANTES DE ATUALIZAR.";
    clienteCadastroErro.classList.remove("hidden");
    return;
  }

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
    enderecoBase,
    complemento,
    endereco,
  };
  saveCadastro(CAD_CLIENTES_KEY, clientes);
  addAuditLog("atualizar_cliente", "cliente", `${nome} - CPF ${formatCpf(cpf)}`);
  clienteCadastroForm.reset();
  setClienteEnderecoConfirmado(false);
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
  if (cadClienteCepInput) {
    cadClienteCepInput.dataset.lastLookupCep = "";
  }
  if (cadClienteEnderecoInput) {
    cadClienteEnderecoInput.dataset.autoEnderecoBase = "";
  }
  setCadClienteCepStatus("");
  setClienteEnderecoConfirmado(false);
  sairModoAtualizacaoCliente();
});

if (publicCadClienteCpf) {
  publicCadClienteCpf.addEventListener("input", () => {
    publicCadClienteCpf.value = formatCpf(onlyDigits(String(publicCadClienteCpf.value || "")));
  });
}
if (publicCadClienteCnh) {
  publicCadClienteCnh.addEventListener("input", () => {
    publicCadClienteCnh.value = onlyDigits(String(publicCadClienteCnh.value || "")).slice(0, 20);
  });
}
if (publicCadClienteCep) {
  publicCadClienteCep.addEventListener("input", () => {
    publicCadClienteCep.value = formatCepMask(publicCadClienteCep.value);
    setPublicClienteEnderecoConfirmado(false);
    if (onlyDigits(String(publicCadClienteCep.value || "")).length === 8) {
      void buscarEnderecoPublicoPorCep();
    }
  });
  publicCadClienteCep.addEventListener("blur", () => {
    publicCadClienteCep.value = formatCepMask(publicCadClienteCep.value);
    void buscarEnderecoPublicoPorCep(true);
  });
}
[publicCadClienteMunicipioUf, publicCadClienteEndereco, publicCadClienteComplemento].forEach((el) => {
  if (!el) return;
  el.addEventListener("input", () => setPublicClienteEnderecoConfirmado(false));
});
if (publicCadClienteConfirmEnderecoBtn) {
  publicCadClienteConfirmEnderecoBtn.addEventListener("click", () => {
    const cep = formatCepMask(String(publicCadClienteCep?.value || "").trim());
    const municipioUf = String(publicCadClienteMunicipioUf?.value || "").trim();
    const enderecoBase = String(publicCadClienteEndereco?.value || "").trim();
    const complemento = String(publicCadClienteComplemento?.value || "").trim();
    if (!cep || !municipioUf || !enderecoBase || !complemento) {
      setPublicCadCepStatus("⚠️ Preencha CEP, Município/UF, Rua/Bairro e Número/Casa/AP.", "error");
      return;
    }
    setPublicClienteEnderecoConfirmado(true);
    setPublicCadCepStatus("✅ Endereço confirmado para envio.", "success");
  });
}
if (clientePublicoCadastroForm) {
  clientePublicoCadastroForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const cpf = onlyDigits(String(publicCadClienteCpf?.value || ""));
    const nome = String(publicCadClienteNome?.value || "").trim();
    const dataCadastro = String(publicCadClienteDataCadastro?.value || "").trim();
    const celular = String(publicCadClienteCelular?.value || "").trim();
    const recado1 = String(publicCadClienteRecado1?.value || "").trim();
    const recado2 = String(publicCadClienteRecado2?.value || "").trim();
    const cnh = String(publicCadClienteCnh?.value || "").trim();
    const categoria = String(publicCadClienteCategoria?.value || "").trim();
    const vencimento = String(publicCadClienteVencimento?.value || "").trim();
    const ear = String(publicCadClienteEar?.value || "").trim();
    const cep = formatCepMask(String(publicCadClienteCep?.value || "").trim());
    const municipioUf = String(publicCadClienteMunicipioUf?.value || "").trim();
    const enderecoBase = String(publicCadClienteEndereco?.value || "").trim();
    const complemento = String(publicCadClienteComplemento?.value || "").trim();
    const endereco = [enderecoBase, complemento].filter(Boolean).join(", ");
    if (String(clientePublicoCadastroForm.dataset.enderecoConfirmado || "0") !== "1") {
      if (publicCadClienteErro) {
        publicCadClienteErro.textContent = "CONFIRME O ENDERECO ANTES DE ENVIAR PARA AVALIACAO.";
        publicCadClienteErro.classList.remove("hidden");
      }
      return;
    }
    const iaExtra = parseCadastroIaPayloadFromForm(clientePublicoCadastroForm);
    const envio = enqueueClienteParaValidacao(
      {
        codigo: nextClienteCodigo(),
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
        enderecoBase,
        complemento,
        endereco,
        ...iaExtra,
      },
      "area_cliente"
    );
    if (!envio.ok) {
      if (publicCadClienteErro) {
        publicCadClienteErro.textContent = envio.message || "NAO FOI POSSIVEL ENVIAR.";
        publicCadClienteErro.classList.remove("hidden");
      }
      return;
    }
    if (publicCadClienteErro) {
      publicCadClienteErro.textContent = "";
      publicCadClienteErro.classList.add("hidden");
    }
    window.alert("CADASTRO ENVIADO PARA AVALIACAO DO ADMINISTRADOR.");
    clientePublicoCadastroForm.reset();
    delete clientePublicoCadastroForm.dataset.cadastroIaMeta;
    setPublicCadCepStatus("");
    setPublicClienteEnderecoConfirmado(false);
    renderCadastros();
  });
}

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

if (adminValidacaoCadastroLista) {
  adminValidacaoCadastroLista.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const idAprovar = Number(target.dataset.validacaoAprovar || 0);
    const idReprovar = Number(target.dataset.validacaoReprovar || 0);
    const id = idAprovar || idReprovar;
    if (!id) return;
    const pendentes = loadCadastro(CAD_CLIENTES_VALIDACAO_KEY);
    const idx = pendentes.findIndex((x) => Number(x.id || 0) === id);
    if (idx < 0) return;
    const item = pendentes[idx];
    if (idAprovar) {
      const ok = window.confirm(
        `Aprovar cadastro de ${item.nome || "cliente"} (${formatCpf(item.cpf || "")})?`
      );
      if (!ok) return;
      upsertClienteCadastroByCpf(item, "ATIVO");
      addAuditLog(
        "aprovar_cliente_validacao",
        "cliente_validacao",
        `${item.nome || "-"} - CPF ${formatCpf(item.cpf || "")}`
      );
      pendentes.splice(idx, 1);
      saveCadastro(CAD_CLIENTES_VALIDACAO_KEY, pendentes);
      window.alert("CADASTRO APROVADO COM SUCESSO.");
      renderCadastros();
      return;
    }
    if (idReprovar) {
      const ok = window.confirm(
        `Reprovar cadastro de ${item.nome || "cliente"} (${formatCpf(item.cpf || "")})?`
      );
      if (!ok) return;
      upsertClienteCadastroByCpf(item, "CADASTRO NAO APROVADO");
      addAuditLog(
        "reprovar_cliente_validacao",
        "cliente_validacao",
        `${item.nome || "-"} - CPF ${formatCpf(item.cpf || "")}`
      );
      pendentes.splice(idx, 1);
      saveCadastro(CAD_CLIENTES_VALIDACAO_KEY, pendentes);
      window.alert("CADASTRO REPROVADO.");
      renderCadastros();
    }
  });
}

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

if (gerarRelatorioLocacaoBtn && relatorioLocacaoOpcoes && relatorioLocacaoFormatos) {
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
}

if (relatorioLocadosBtn && relatorioLocacaoFormatos) {
  relatorioLocadosBtn.addEventListener("click", () => {
    relatorioLocacaoTipoSelecionado = "locados";
    void renderRelatorioLocacao("locados");
    relatorioLocacaoFormatos.classList.remove("hidden");
  });
}

if (relatorioDisponiveisBtn && relatorioLocacaoFormatos) {
  relatorioDisponiveisBtn.addEventListener("click", () => {
    relatorioLocacaoTipoSelecionado = "disponiveis";
    void renderRelatorioLocacao("disponiveis");
    relatorioLocacaoFormatos.classList.remove("hidden");
  });
}

if (relatorioCompletoProtocoloBtn) {
  relatorioCompletoProtocoloBtn.addEventListener("click", () => {
    relatorioLocacaoTipoSelecionado = "completo";
    void renderRelatorioLocacao("completo");
    relatorioLocacaoFormatos.classList.remove("hidden");
  });
}

if (relatorioLocacaoTelaBtn) {
  relatorioLocacaoTelaBtn.addEventListener("click", () => {
    if (!relatorioLocacaoTipoSelecionado) return;
    void renderRelatorioLocacao(relatorioLocacaoTipoSelecionado);
  });
}

if (relatorioLocacaoLimparBtn) {
  relatorioLocacaoLimparBtn.addEventListener("click", () => {
    relatorioLocacaoCache = null;
    relatorioLocacaoTipoSelecionado = "";
    if (locacaoReportTitle) locacaoReportTitle.textContent = "Relatório de locação";
    if (locacaoReportBody) locacaoReportBody.innerHTML = "";
    if (locacaoReportBox) locacaoReportBox.classList.add("hidden");
    if (relatorioLocacaoFormatos) relatorioLocacaoFormatos.classList.add("hidden");
    if (relatorioLocacaoOpcoes) relatorioLocacaoOpcoes.classList.add("hidden");
  });
}

gerarDadosUsoPdfBtn.addEventListener("click", () => {
  dadosUsoAcaoPendente = "pdf";
  dadosUsoSenhaWrap.classList.remove("hidden");
  dadosUsoAdminSenha.value = "";
  dadosUsoAdminSenha.focus();
});

if (enviarQrWhatsappBtn) {
  enviarQrWhatsappBtn.addEventListener("click", () => {
    const targetUrl = getClienteAreaPublicUrl();
    const mensagem =
      "Olá! Use este link para instalar/acessar o app DK Locadora (Área do Cliente): " + targetUrl;
    const waUrl = `https://wa.me/?text=${encodeURIComponent(mensagem)}`;
    window.open(waUrl, "_blank", "noopener");
  });
}

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

if (lancamentoAluguelResumo && !lancamentoAluguelResumo.dataset.quadroEditBound) {
  lancamentoAluguelResumo.dataset.quadroEditBound = "1";
  lancamentoAluguelResumo.addEventListener("click", (e) => {
    const t = e.target;
    if (!t || t.id !== "lancamentoAluguelAbrirQuadroEdit") return;
    e.preventDefault();
    const cpf = onlyDigits(String(lancAluguelCpfInput?.value || ""));
    const placa = String(lancAluguelPlacaInput?.value || "").trim().toUpperCase();
    if (cpf.length !== 11) {
      window.alert("Informe um CPF valido (11 digitos) no lancamento.");
      return;
    }
    const ncQuadro = normalizeNumeroContratoKey(lancAluguelNumeroContratoInput?.value || "");
    if (!ncQuadro) {
      window.alert(
        "Informe o número do contrato no lançamento para abrir o quadro do vínculo correto (o mesmo cliente e placa podem ter vários contratos ao longo do tempo)."
      );
      return;
    }
    if (isCpfComEdicaoLancamentoBloqueada(cpf)) {
      window.alert("CPF com edição bloqueada. Você pode cadastrar novos lançamentos, mas não editar o histórico.");
      return;
    }
    void runLancamentoAluguelHistoricoDialog(cpf, placa, {
      numeroContrato: ncQuadro,
      onAfterSim: () => renderLancamentoAluguelResumo(),
    });
  });
}

if (lancamentoAluguelForm) {
  lancamentoAluguelForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const placa = String(lancAluguelPlacaInput?.value || "")
      .trim()
      .toUpperCase();
    const cpf = onlyDigits(String(lancAluguelCpfInput?.value || ""));
    const numeroContratoNorm = normalizeNumeroContratoKey(lancAluguelNumeroContratoInput?.value || "");
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
    if (!numeroContratoNorm) {
      if (lancamentoAluguelErro) {
        lancamentoAluguelErro.textContent =
          "INFORME O NUMERO DO CONTRATO — ELE IDENTIFICA O VINCULO (MESMO CLIENTE E PLACA PODEM TER CONTRATOS DIFERENTES NO TEMPO).";
        lancamentoAluguelErro.classList.remove("hidden");
      }
      return;
    }
    if (!findContratoForLancamentoResumo(cpf, placa, numeroContratoNorm)) {
      if (lancamentoAluguelErro) {
        lancamentoAluguelErro.textContent =
          "NAO HA LOCACAO CADASTRADA COM ESSE CPF, PLACA E NUMERO DE CONTRATO. CONFIRA O CADASTRO DE LOCACAO.";
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
    const historicoOk = await askLancamentoAluguelHistoricoUpdated(cpf, placa, {
      cpfDigits: cpf,
      placa,
      valorPago,
      semanaInicio,
      semanaFim,
      numeroContrato: numeroContratoNorm,
    });
    if (!historicoOk) return;

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
      numeroContrato: numeroContratoNorm,
    });
    if (!confirmado) return;

    const fpSalvar = lancamentoAluguelForm?.dataset?.comprovanteFp
      ? String(lancamentoAluguelForm.dataset.comprovanteFp).trim()
      : "";
    if (fpSalvar && isComprovanteFpJaUtilizado(fpSalvar)) {
      if (lancamentoAluguelErro) {
        lancamentoAluguelErro.textContent =
          "Este comprovante já foi utilizado em outro lançamento. Não é possível salvar em duplicidade.";
        lancamentoAluguelErro.classList.remove("hidden");
      }
      return;
    }
    const id = Date.now();
    const novo = {
      id,
      createdAt: id,
      codigoLancamento,
      placa,
      cpf,
      numeroContrato: numeroContratoNorm,
      diaPagamento,
      valorPago,
      semanaInicio,
      semanaFim,
      status: "ATIVO",
    };
    if (fpSalvar) novo.comprovanteFp = fpSalvar;
    if (fpSalvar) {
      const pay = coletarPayloadComprovanteParaSalvar(fpSalvar);
      const row = {
        lancamentoId: id,
        codigoLancamento,
        valorPago,
        semanaInicio,
        semanaFim,
        cpf,
        placa,
      };
      if (pay.base64 && pay.mime) {
        row.base64 = pay.base64;
        row.mime = pay.mime;
      }
      if (pay.texto) row.texto = pay.texto;
      upsertComprovanteBanco(fpSalvar, row);
    }
    lancamentos.push(novo);
    saveCadastro(CAD_LANCAMENTOS_ALUGUEL_KEY, lancamentos);
    processPendingLancamentosAluguelBaixa();
    addAuditLog(
      "cadastrar_lancamento_aluguel",
      "lancamento_aluguel",
      `${codigoLancamento} - ${placa} - contrato ${numeroContratoNorm}`
    );
    ultimoLancamentoAluguelSalvoId = id;
    const savedCpf = cpf;
    const savedPlaca = placa;
    const savedNc = numeroContratoNorm;
    window.alert("LANCAMENTO SALVO COM SUCESSO");
    if (fpSalvar) {
      setComprovanteFeedback(
        "Comprovante gravado neste aparelho com o pagamento. Pode clicar em Limpar comprovante; o arquivo continua no histórico.",
        "ok"
      );
    }
    if (lancamentoAluguelForm && lancamentoAluguelForm.dataset.comprovanteFp) {
      delete lancamentoAluguelForm.dataset.comprovanteFp;
    }
    pendingComprovanteSnapshot = null;
    lancamentoAluguelForm.reset();
    if (lancAluguelCpfInput) lancAluguelCpfInput.value = formatCpf(savedCpf);
    if (lancAluguelPlacaInput) lancAluguelPlacaInput.value = String(savedPlaca || "")
      .trim()
      .toUpperCase();
    if (lancAluguelNumeroContratoInput) lancAluguelNumeroContratoInput.value = savedNc;
    if (lancAluguelSemanaInicioInput) lancAluguelSemanaInicioInput.dataset.autoSuggested = "0";
    if (lancAluguelValorPagoInput) lancAluguelValorPagoInput.dataset.autoSuggested = "0";
    if (lancamentoAluguelErro) {
      lancamentoAluguelErro.textContent = "";
      lancamentoAluguelErro.classList.add("hidden");
    }
    autoFillLancamentoFromCpf(savedCpf);
    prefillLancamentoAluguelByCpf(savedCpf);
    suggestValorPagoFromContrato();
    suggestSemanaInicioFromDiaPagamento();
    renderLancamentoAluguelResumo();
    renderCadastros();
  });
}

if (lancAluguelCpfInput) {
  lancAluguelCpfInput.addEventListener("input", () => {
    const cpf = onlyDigits(String(lancAluguelCpfInput.value || ""));
    lancAluguelCpfInput.value = formatCpf(cpf);
    if (cpf.length !== 11) {
      ultimoLancamentoAluguelSalvoId = null;
    }
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

if (lancAluguelNumeroContratoInput) {
  lancAluguelNumeroContratoInput.addEventListener("input", () => {
    lancAluguelNumeroContratoInput.value = String(lancAluguelNumeroContratoInput.value || "").toUpperCase();
    renderLancamentoAluguelResumo();
  });
  lancAluguelNumeroContratoInput.addEventListener("blur", () => {
    lancAluguelNumeroContratoInput.value = normalizeNumeroContratoKey(lancAluguelNumeroContratoInput.value || "");
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
    ultimoLancamentoAluguelSalvoId = null;
    if (lancamentoAluguelForm && lancamentoAluguelForm.dataset.comprovanteFp) {
      delete lancamentoAluguelForm.dataset.comprovanteFp;
    }
    pendingComprovanteSnapshot = null;
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
    if (isCpfComEdicaoLancamentoBloqueada(item.cpf)) {
      window.alert("CPF com edição bloqueada. Não é permitido apagar lançamentos já existentes.");
      return;
    }
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

if (locacaoCadastroForm) {
  locacaoCadastroForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!validateLocacaoCpfBlock()) return;
  const cpf = onlyDigits(String(document.getElementById("cadLocacaoCpf").value || ""));
  const placa = String(document.getElementById("cadLocacaoPlaca").value || "")
    .trim()
    .toUpperCase();
  const inicio = String(document.getElementById("cadLocacaoInicio").value || "").trim();
  let fim = String(document.getElementById("cadLocacaoFim").value || "").trim();
  const kmInicial = String(document.getElementById("cadLocacaoKm")?.value || "")
    .replace(/[^\d]/g, "")
    .trim();
  const valorLocacaoRaw = String(document.getElementById("cadLocacaoValor").value || "").trim();
  const valorInvestimentoRaw = String(document.getElementById("cadLocacaoInvestimento")?.value || "").trim();
  const plano = getLocacaoPlanoSelecionado();
  if (!String(cadLocacaoContratoInput?.value || "").trim()) {
    aplicarNovoProtocoloLocacaoNoFormulario();
  }
  const numeroContratoRaw = String(cadLocacaoContratoInput?.value || "").trim();
  const numeroContratoNorm = normalizeNumeroContratoKey(numeroContratoRaw);
  const valorLocacaoNum = parseCurrencyBR(valorLocacaoRaw);
  const valorInvestimentoNum = plano === "DK MINHA MOTO" ? parseCurrencyBR(valorInvestimentoRaw) : 0;
  const valorSemanalNum = valorLocacaoNum + valorInvestimentoNum;
  const valorSemanal = valorSemanalNum > 0 ? currencyBRL(valorSemanalNum) : "";
  const veiculosDisponiveis = getVeiculosSemProtocoloAtivo();
  const veiculoEscolhido = veiculosDisponiveis.find(
    (v) => normalizePlate(v.placa) === normalizePlate(placa)
  );
  const modeloSelecionado = String(veiculoEscolhido?.modelo || "").trim();
  if (!cpf || !placa || !inicio) return;
  if (!valorLocacaoNum || (plano === "DK MINHA MOTO" && !valorInvestimentoNum)) {
    window.alert(
      plano === "DK MINHA MOTO"
        ? "No plano DK MINHA MOTO, informe valor da locação e valor do investimento."
        : "Informe o valor da locação."
    );
    return;
  }
  const inicioDate = parseBrDate(inicio);
  if (!inicioDate) {
    window.alert("Informe a data de início no formato DD/MM/AAAA.");
    return;
  }
  const fimCalculado =
    plano === "DK MINHA MOTO"
      ? addCalendarDays(inicioDate, 150 * 7)
      : addCalendarMonths(inicioDate, 1);
  if (fimCalculado) {
    fim = formatDataDmaBr(fimCalculado);
    if (cadLocacaoFimInput) cadLocacaoFimInput.value = fim;
  }

  const fimDate = parseBrDate(fim);
  const statusField = String(cadLocacaoStatusInput?.value || "").trim();
  const statusLocacao =
    normalizeStatusLocacaoExibicao(statusField) ||
    (String(fim || "").trim() ? "FINALIZADO" : "ATIVO");

  let diaPagto = String(cadLocacaoDiaPagtoInput?.value || "").trim();
  if (!diaPagto && inicioDate instanceof Date && !Number.isNaN(inicioDate.getTime())) {
    diaPagto = inicioDate.toLocaleDateString("pt-BR", { weekday: "long" });
  }

  let periodoLocacao = String(cadLocacaoPeriodoLocacaoInput?.value || "").trim();
  if (
    !periodoLocacao &&
    inicioDate instanceof Date &&
    !Number.isNaN(inicioDate.getTime()) &&
    fimDate instanceof Date &&
    !Number.isNaN(fimDate.getTime())
  ) {
    const dias = Math.max(
      1,
      Math.round((toDateOnly(fimDate) - toDateOnly(inicioDate)) / 86400000) + 1
    );
    periodoLocacao = `${dias} dia(s)`;
  }

  let modalidade = String(cadLocacaoModalidadeInput?.value || "").trim();
  if (!modalidade) {
    const tipoV = String(veiculoEscolhido?.tipo || "").trim();
    modalidade = normalizeKey(tipoV).includes("CARRO") ? "CARRO" : "MOTO";
  }

  let marcaModelo = String(cadLocacaoMarcaModeloInput?.value || "").trim();
  if (!marcaModelo) {
    marcaModelo = [String(veiculoEscolhido?.marca || "").trim(), modeloSelecionado]
      .filter(Boolean)
      .join(" / ");
  }

  const opcaoContrato = String(cadLocacaoOpcaoContratoInput?.value || "").trim();
  const periodoContrato = String(cadLocacaoPeriodoContratoInput?.value || "").trim();
  const configPrecoKm = String(cadLocacaoConfigPrecoKmInput?.value || "").trim();
  const tabela = String(cadLocacaoTabelaInput?.value || "").trim();

  let valorParcelaRaw = String(cadLocacaoValorParcelaInput?.value || "").trim();
  if (!valorParcelaRaw) {
    valorParcelaRaw = valorSemanal;
    if (cadLocacaoValorParcelaInput) cadLocacaoValorParcelaInput.value = valorParcelaRaw;
  }
  const valorParcelaNum = parseCurrencyBR(valorParcelaRaw);

  if (!numeroContratoNorm) {
    window.alert("O número do contrato é obrigatório e deve ser único no sistema.");
    return;
  }
  if (contratoNumeroJaExisteNaBase(numeroContratoNorm, null)) {
    window.alert(
      "Este número de contrato já está cadastrado. Cada contrato (período cliente + veículo) deve ter um código diferente."
    );
    return;
  }
  if (!veiculoEscolhido) {
    window.alert(
      "Esta placa já está vinculada a protocolo ativo (sem data fim) ou está indisponível. Encerre a locação ativa para reutilizar a placa."
    );
    return;
  }

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

  let clienteCodigo = String(cadLocacaoClienteCodigoInput?.value || "").trim();
  if (!clienteCodigo) {
    clienteCodigo = String(cliente?.codigo || "").trim();
    if (cadLocacaoClienteCodigoInput && clienteCodigo) cadLocacaoClienteCodigoInput.value = clienteCodigo;
  }

  const confirmado = await askLocacaoCadastroConfirmation({
    cpf,
    clienteNome: String(cliente?.nome || "").trim(),
    clienteCodigo,
    numeroContrato: numeroContratoNorm,
    placa,
    modelo: modeloSelecionado,
    inicio,
    fim,
    plano,
    kmInicial,
    statusLocacao,
    diaPagto,
    periodoLocacao,
    modalidade,
    marcaModelo,
    opcaoContrato,
    periodoContrato,
    configPrecoKm,
    tabela,
    valorLocacao: currencyBRL(valorLocacaoNum),
    valorInvestimento: currencyBRL(valorInvestimentoNum),
    valorParcela: currencyBRL(valorParcelaNum),
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
    plano,
    valorLocacao: currencyBRL(valorLocacaoNum),
    valorInvestimento: currencyBRL(valorInvestimentoNum),
    valorSemanal,
    numeroContrato: numeroContratoNorm,
    statusLocacao,
    diaPagto,
    periodoLocacao,
    modalidade,
    marcaModelo,
    opcaoContrato,
    periodoContrato,
    kmInicial,
    configPrecoKm,
    tabela,
    valorParcela: currencyBRL(valorParcelaNum),
    clienteCodigo,
  });
  saveCadastro(CAD_LOCACOES_KEY, locacoes);
  addAuditLog(
    "cadastrar_locacao",
    "locacao",
    `${cpf} - ${placa} - contrato ${numeroContratoNorm}`
  );
  window.alert("LOCAÇÃO CADASTRADA COM SUCESSO");
  locacaoCadastroForm.reset();
  ensureLocacaoInicioDefault();
  aplicarNovoProtocoloLocacaoNoFormulario();
  setLocacaoFormBlocked(false);
  locacaoImpedimentoAlertShown = false;
  renderCadastros();
  });
}

if (cadLocacaoCpfInput) {
  cadLocacaoCpfInput.addEventListener("blur", validateLocacaoCpfBlock);
  cadLocacaoCpfInput.addEventListener("input", () => {
    const cpf = onlyDigits(String(cadLocacaoCpfInput.value || ""));
    cadLocacaoCpfInput.value = formatCpf(cpf);
    if (cpf.length < 11) {
      locacaoImpedimentoAlertShown = false;
      setLocacaoFormBlocked(false);
      return;
    }
    applyLocacaoClienteByCpf(cpf);
    syncCadLocacaoClienteCodigoFromCpf();
    validateLocacaoCpfBlock();
  });
}

if (cadLocacaoValorInput) {
  cadLocacaoValorInput.addEventListener("blur", () => {
    formatLocacaoCurrencyInput(cadLocacaoValorInput);
  });
}

if (cadLocacaoValorParcelaInput) {
  cadLocacaoValorParcelaInput.addEventListener("blur", () => {
    formatLocacaoCurrencyInput(cadLocacaoValorParcelaInput);
  });
}

if (cadLocacaoInvestimentoInput) {
  cadLocacaoInvestimentoInput.addEventListener("blur", () => {
    formatLocacaoCurrencyInput(cadLocacaoInvestimentoInput);
  });
}

if (cadLocacaoInicioInput) {
  cadLocacaoInicioInput.addEventListener("blur", () => {
    recomputeLocacaoFimByPlano();
  });
}

if (cadLocacaoPlanoInputs && cadLocacaoPlanoInputs.length) {
  cadLocacaoPlanoInputs.forEach((inp) => {
    inp.addEventListener("change", () => {
      applyLocacaoPlanoRules();
    });
  });
}

if (cadLocacaoClienteNomeInput) {
  cadLocacaoClienteNomeInput.addEventListener("input", () => {
    applyLocacaoClienteByNome(cadLocacaoClienteNomeInput.value);
  });
  cadLocacaoClienteNomeInput.addEventListener("blur", () => {
    applyLocacaoClienteByNome(cadLocacaoClienteNomeInput.value);
  });
}

if (cadLocacaoPlacaInput) {
  cadLocacaoPlacaInput.addEventListener("input", () => {
    cadLocacaoPlacaInput.value = String(cadLocacaoPlacaInput.value || "").toUpperCase();
  });
  cadLocacaoPlacaInput.addEventListener("blur", () => {
    cadLocacaoPlacaInput.value = String(cadLocacaoPlacaInput.value || "").trim().toUpperCase();
    suggestCadLocacaoFromVeiculoPlaca();
  });
}

if (cadLocacaoClearBtn) {
  cadLocacaoClearBtn.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();

    // Limpeza principal via reset do form.
    if (locacaoCadastroForm) locacaoCadastroForm.reset();

    // Fallback explícito para garantir limpeza visual imediata.
    if (cadLocacaoPlacaInput) cadLocacaoPlacaInput.value = "";
    if (cadLocacaoCpfInput) cadLocacaoCpfInput.value = "";
    if (cadLocacaoClienteNomeInput) cadLocacaoClienteNomeInput.value = "";
    if (cadLocacaoInicioInput) cadLocacaoInicioInput.value = "";
    if (cadLocacaoFimInput) cadLocacaoFimInput.value = "";
    if (cadLocacaoKmInput) cadLocacaoKmInput.value = "";
    if (cadLocacaoValorInput) cadLocacaoValorInput.value = "";
    if (cadLocacaoInvestimentoInput) cadLocacaoInvestimentoInput.value = "";
    if (cadLocacaoStatusInput) cadLocacaoStatusInput.value = "";
    if (cadLocacaoDiaPagtoInput) cadLocacaoDiaPagtoInput.value = "";
    if (cadLocacaoPeriodoLocacaoInput) cadLocacaoPeriodoLocacaoInput.value = "";
    if (cadLocacaoModalidadeInput) cadLocacaoModalidadeInput.value = "";
    if (cadLocacaoMarcaModeloInput) cadLocacaoMarcaModeloInput.value = "";
    if (cadLocacaoOpcaoContratoInput) cadLocacaoOpcaoContratoInput.value = "";
    if (cadLocacaoPeriodoContratoInput) cadLocacaoPeriodoContratoInput.value = "";
    if (cadLocacaoConfigPrecoKmInput) cadLocacaoConfigPrecoKmInput.value = "";
    if (cadLocacaoTabelaInput) cadLocacaoTabelaInput.value = "";
    if (cadLocacaoValorParcelaInput) cadLocacaoValorParcelaInput.value = "";
    if (cadLocacaoClienteCodigoInput) cadLocacaoClienteCodigoInput.value = "";

    // Reaplica padrão operacional após limpar.
    try {
      refreshLocacaoPlacaOptions();
      refreshLocacaoClienteSugestoes();
      ensureLocacaoInicioDefault();
      aplicarNovoProtocoloLocacaoNoFormulario();
      applyLocacaoPlanoRules();
      setLocacaoFormBlocked(false);
      locacaoImpedimentoAlertShown = false;
    } catch (err) {
      // Mantém operação de limpar funcional mesmo com falha auxiliar.
      console.error("Falha ao finalizar limpeza do cadastro de locação:", err);
    }
  });
}

if (manutencaoCadastroForm) {
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
  if (cadManutencaoDataInput) cadManutencaoDataInput.value = todayBrDate();
  renderCadastros();
  });
}

if (gerarRelatorioManutencaoBtn) {
  gerarRelatorioManutencaoBtn.addEventListener("click", () => {
    renderManutencaoReport();
  });
}

if (manutencaoTipoToggleBtn && manutencaoTipoPanel) {
  manutencaoTipoToggleBtn.addEventListener("click", () => {
    manutencaoTipoPanel.classList.toggle("hidden");
  });
}

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

if (clienteVidaExportExcelBtn) {
  clienteVidaExportExcelBtn.addEventListener("click", () => {
    exportGenericReportExcel(clienteVidaBody, "cliente-protocolos.csv");
  });
}
if (clienteVidaExportPdfBtn) {
  clienteVidaExportPdfBtn.addEventListener("click", () => {
    exportGenericReportPdf(clienteVidaBody, "Cliente - protocolos");
  });
}
if (clienteVidaImprimirBtn) {
  clienteVidaImprimirBtn.addEventListener("click", () => {
    printReportContainer(clienteVidaBody, "Cliente - protocolos");
  });
}

if (placaHistoricoExportExcelBtn) {
  placaHistoricoExportExcelBtn.addEventListener("click", () => {
    exportGenericReportExcel(placaHistoricoBody, "placa-protocolos.csv");
  });
}
if (placaHistoricoExportPdfBtn) {
  placaHistoricoExportPdfBtn.addEventListener("click", () => {
    exportGenericReportPdf(placaHistoricoBody, "Placa - protocolos");
  });
}
if (placaHistoricoImprimirBtn) {
  placaHistoricoImprimirBtn.addEventListener("click", () => {
    printReportContainer(placaHistoricoBody, "Placa - protocolos");
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
      "<p>Use os botoes em Contratos Ativos, Contratos Inativos ou Todos os contratos.</p>"
    );
    return;
  }

  if (target.dataset.reportExport === "pdf") {
    const reportTarget = String(target.dataset.reportTarget || "");
    const isLocacaoContext =
      event.currentTarget === locacaoReportBody ||
      (locacaoReportBody instanceof HTMLElement && locacaoReportBody.contains(target));
    if (reportTarget === "admin") {
      exportGenericReportPdf(adminResultBody, String(adminResultTitle.textContent || "Relatorio"));
      return;
    }
    if (reportTarget === "manutencao") {
      exportGenericReportPdf(manutencaoReportBody, String(manutencaoReportTitle.textContent || "Relatorio manutencao"));
      return;
    }
    if ((reportTarget === "locacao" || (isLocacaoContext && !reportTarget)) && relatorioLocacaoCache) {
      exportRelatorioPdfFromCache(relatorioLocacaoCache);
      return;
    }
    exportGenericReportPdf(locacaoReportBody, String(locacaoReportTitle.textContent || "Relatorio locacao"));
    return;
  }

  if (target.dataset.reportExport === "excel") {
    const reportTarget = String(target.dataset.reportTarget || "");
    const isLocacaoContext =
      event.currentTarget === locacaoReportBody ||
      (locacaoReportBody instanceof HTMLElement && locacaoReportBody.contains(target));
    if (reportTarget === "admin") {
      exportGenericReportExcel(adminResultBody, "relatorio-admin.csv");
      return;
    }
    if (reportTarget === "manutencao") {
      exportGenericReportExcel(manutencaoReportBody, "relatorio-manutencao.csv");
      return;
    }
    if ((reportTarget === "locacao" || (isLocacaoContext && !reportTarget)) && relatorioLocacaoCache) {
      const file =
        relatorioLocacaoTipoSelecionado === "locados"
          ? "relatorio-veiculos-locados.csv"
          : relatorioLocacaoTipoSelecionado === "completo"
            ? "relatorio-completo-protocolos.csv"
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
        (acc, r) => acc + Math.max(0, pagoHarmonizadoRegistro(r) - parseCurrencyBR(r.devidoHoje)),
        0
      );
      const emDiaRows =
        currentFinanceiroScope === "todos"
          ? buildGroupedFinanceRows(currentFinanceiroEmDia, "emdia").slice(0, 200)
          : currentFinanceiroEmDia
              .slice(0, 200)
              .map((r) => {
                const devido = parseCurrencyBR(r.devidoHoje);
                const pago = pagoHarmonizadoRegistro(r);
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
        (acc, r) => acc + Math.max(0, parseCurrencyBR(r.devidoHoje) - pagoHarmonizadoRegistro(r)),
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
                  const pago = pagoHarmonizadoRegistro(r);
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
        `<p><strong>${r.placa}</strong> - ${r.nome || "Sem vínculo de cliente"} (${currentScopeLabel})</p>`
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

function setUpdateButtonState(label, disabled) {
  if (!updateButton) return;
  updateButton.textContent = label;
  updateButton.disabled = Boolean(disabled);
}

function revealUpdateButton(label) {
  if (!updateButton) return;
  updateButton.classList.remove("hidden");
  setUpdateButtonState(label || "Buscar atualizações", false);
}

function wireServiceWorkerUpdateSignals(registration) {
  if (!registration || updateReloadPending) return;

  if (registration.waiting) {
    revealUpdateButton("Atualização pronta - aplicar");
    return;
  }

  registration.addEventListener("updatefound", () => {
    const newWorker = registration.installing;
    if (!newWorker) return;

    newWorker.addEventListener("statechange", () => {
      if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
        revealUpdateButton("Atualização pronta - aplicar");
      }
    });
  });
}

async function checkForAppUpdate(manualTrigger) {
  if (!swRegistration) return;
  if (manualTrigger) setUpdateButtonState("Verificando...", true);

  try {
    await swRegistration.update();
    if (swRegistration.waiting) {
      setUpdateButtonState("Aplicando atualização...", true);
      swRegistration.waiting.postMessage({ type: "SKIP_WAITING" });
      updateReloadPending = true;
      return;
    }

    if (manualTrigger) {
      setUpdateButtonState("App já atualizado", true);
      setTimeout(() => setUpdateButtonState("Buscar atualizações", false), 1800);
    }
  } catch (error) {
    if (manualTrigger) {
      setUpdateButtonState("Falha ao verificar", true);
      setTimeout(() => setUpdateButtonState("Buscar atualizações", false), 2200);
    }
  }
}

if ("serviceWorker" in navigator && window.location.protocol !== "file:") {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("./service-worker.js")
      .then((registration) => {
        swRegistration = registration;
        revealUpdateButton("Buscar atualizações");
        wireServiceWorkerUpdateSignals(registration);
      });
  });

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (updateReloadPending) window.location.reload();
  });

  if (updateButton) {
    updateButton.addEventListener("click", () => {
      checkForAppUpdate(true);
    });
  }
}

if (window.location.protocol === "file:") {
  envWarning.textContent =
    "Voce abriu por arquivo local. Para funcionar como app instalavel, rode com servidor local (http://localhost).";
  envWarning.classList.remove("hidden");
  installButton.classList.add("hidden");
  if (updateButton) updateButton.classList.add("hidden");
}

resetProjetoSomenteCadastrosV3Once();
seedVeiculosDatabaseIfNeeded();
seedClientesDatabaseIfNeeded();
migratePlacaInLocalStorage();
sanitizeVeiculosDatabase();
applyClienteCpfFixes();
normalizeClienteCodigos();
clearAllLocacoesOnce();
resetLocacaoStackForSiteEntryOnce();
importLocacoesFromPlanilhaOnce();
ensureNumeroContratoForLocacoes();
fixKnownRentalValueOverrides();
if (cadManutencaoDataInput) cadManutencaoDataInput.value = todayBrDate();
setupDateMasks();
ensureLocacaoInicioDefault();
setHomeLayoutToolbarState();
bootstrapHomeLayoutFromStorage();
bindHomeLayoutEditorEvents();
refreshClienteAreaQrCode();
setClienteLayoutToolbarState();
bootstrapClienteLayoutFromStorage();
bindClienteLayoutEditorEvents();
setClienteEnderecoConfirmado(false);
setFuncionarioLayoutToolbarState();
bootstrapFuncionarioLayoutFromStorage();
bindFuncionarioLayoutEditorEvents();
setLocacaoLayoutToolbarState();
bootstrapLocacaoLayoutFromStorage();
bindLocacaoLayoutEditorEvents();
setLayoutEditorsAccessByProfile();
requireLoggedArea();
applyDeepLinkCadastroIaFromHash();
bindCadastroIaWizards();
window.addEventListener("hashchange", () => {
  applyDeepLinkCadastroIaFromHash();
});
setInterval(() => {
  enforceMaintenanceAndDailyRoutines();
}, 60 * 1000);
