/**
 * Índice canónico das 84 abas + aliases de hiperligações do Excel.
 * Gerado a partir de miel-workbook-map.json
 */
(function mielSheetIndex() {
  const ALIASES = {
    "Página Inicial": "pagina-inicial",
    Página_Inicial: "pagina-inicial",
    "Anotações de_Km_Atual": "anotacoes-de-km-atual",
    Anotações_de_Km_Atual: "anotacoes-de-km-atual",
    Termo_de_Insp_e_Troca_de_Óleo: "ctrl-de-troca-de-oleo",
    Controle_de_Manutenção: "ctrl-manutencao",
    "Cad_Clientes_(Loc.)": "cad-clientes",
    "Cad_Veículos_(Loc.)": "cad-veiculos",
    "Locação_de_Veículos": "locacao-veiculos",
    Dpto_Pessoal: "depto-pessoal",
    "Ctrl_de_Manutenção": "ctrl-manutencao",
    Consulta_Veíc_ou_Cliente: "consulta-integrada",
    Relação_Clientes: "relacao-clientes",
    Relação_Veículos: "relacao-veiculos",
    Status_Veículos: "status-veiculos",
    "Acomp._Transf._Propriedade": "acomp-transf",
    Relação_de_Motos_Vendidas: "motos-vendidas",
    Form_de_Lista_de_Espera: "form-lista-espera",
    "ID_Chaveiros_(Carros)": "id-chaveiros-carros",
    "ID_Chaveiros_(Motos)": "id-chaveiros-motos",
    Ctrl_Multas: "ctrl-multas",
    Relatório_de_Status_CNH_e_EAR: "relatorio-ear",
    Cad_Clientes: "cad-clientes",
    Cad_Veículos: "cad-veiculos",
    Administrativo: "administrativo",
    Dashboard: "dashboard",
    Financeiro: "financeiro",
    Procedimentos: "procedimentos",
    Planejamento: "planejamento",
    Gráficos: "graficos",
    Emissão_de_Protocolos: "emissao-de-protocolos",
    "Termo_de_Subst._Provisória": "termo-de-subst-provisoria",
  };

  window.__DK_MIEL_SHEET_ALIASES = ALIASES;

  function parseExcelSheetName(location) {
    const raw = String(location || "").replace(/^#/, "").trim();
    return raw.replace(/^'/, "").replace(/'!.*$/, "").replace(/!.*$/, "").trim();
  }

  function excelLocationToId(location) {
    const sheet = parseExcelSheetName(location);
    if (!sheet) return "";
    if (ALIASES[sheet]) return ALIASES[sheet];
    const slug = sheet
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/['’]/g, "")
      .replace(/[^A-Za-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase();
    return ALIASES[slug] || slug;
  }

  window.__DK_mielExcelLocationToId = excelLocationToId;
  window.__DK_mielParseExcelSheetName = parseExcelSheetName;
})();
