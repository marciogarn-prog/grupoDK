/**
 * Contrato de locação — 10 páginas (modelo DK), preview → Gerar PDF → Imprimir | Salvar.
 */
(function portalContratoLocacao() {
  "use strict";

  const LOGO_SRC = "images/dk-locadora-logo.png";
  const VENDOR_JSPDF = "vendor/jspdf.umd.min.js";
  const VENDOR_HTML2CANVAS = "vendor/html2canvas.min.js";
  /** Limite importação contrato na locação (portal-locacao-documentos.js) */
  const PDF_LOCACAO_MAX_BYTES = 4 * 1024 * 1024;
  const PDF_LOCACAO_ALVO_BYTES = Math.floor(3.5 * 1024 * 1024);

  function vendorScriptUrl(relPath) {
    try {
      return new URL(relPath, window.location.href).href;
    } catch {
      return relPath;
    }
  }
  const DIAS_SEM = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];
  const MESES = [
    "janeiro",
    "fevereiro",
    "março",
    "abril",
    "maio",
    "junho",
    "julho",
    "agosto",
    "setembro",
    "outubro",
    "novembro",
    "dezembro",
  ];

  const esc = (s) =>
    String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  const onlyDigits = (s) => String(s || "").replace(/\D/g, "");

  function logoAbsUrl() {
    try {
      return new URL(LOGO_SRC, window.location.href).href;
    } catch {
      return LOGO_SRC;
    }
  }

  function formatCpf(digits) {
    const d = onlyDigits(digits).slice(0, 11);
    if (d.length !== 11) return String(digits || "").trim();
    return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
  }

  function formatCpfCnpjContrato(raw) {
    const d = onlyDigits(raw);
    if (d.length === 11) return formatCpf(d);
    if (d.length === 14) {
      return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
    }
    return String(raw || "").trim();
  }

  function formatOdometroContrato(raw) {
    const d = String(raw || "").replace(/\D/g, "").replace(/^0+(?=\d)/, "");
    if (!d) return "";
    const grouped = d.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    return `${grouped} km`;
  }

  function loadVeiculoByPlaca(placa) {
    const p = normPlaca(placa);
    if (!p) return null;
    try {
      if (typeof window.findVeiculoByPlaca === "function") {
        const hit = window.findVeiculoByPlaca(p);
        if (hit) return hit;
      }
    } catch {
      /* ignore */
    }
    try {
      if (typeof loadCadastro === "function" && typeof CAD_VEICULOS_KEY !== "undefined") {
        const hit = loadCadastro(CAD_VEICULOS_KEY).find((v) => normPlaca(v?.placa) === p);
        if (hit) return hit;
      }
    } catch {
      /* ignore */
    }
    try {
      const raw = localStorage.getItem("dk_veiculos_cadastro");
      const arr = raw ? JSON.parse(raw) : [];
      if (Array.isArray(arr)) {
        const hit = arr.find((v) => normPlaca(v?.placa) === p);
        if (hit) return hit;
      }
    } catch {
      /* ignore */
    }
    return null;
  }

  function valorNaoVazio(...values) {
    for (const value of values) {
      const text = String(value ?? "").trim();
      if (text) return text;
    }
    return "";
  }

  function normProtocolo(raw) {
    if (typeof window.__DK_documentosNormProtocolo === "function") {
      return window.__DK_documentosNormProtocolo(raw);
    }
    return String(raw || "")
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "");
  }

  function normPlaca(raw) {
    if (typeof window.__DK_documentosNormPlaca === "function") {
      return window.__DK_documentosNormPlaca(raw);
    }
    return String(raw || "")
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 7);
  }

  function parseBrDate(raw) {
    if (typeof window.parseBrDate === "function") return window.parseBrDate(raw);
    const s = String(raw || "").trim();
    const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!m) return null;
    const dt = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
    return Number.isNaN(dt.getTime()) ? null : dt;
  }

  function formatDataBr(dt) {
    if (!dt || Number.isNaN(dt.getTime())) return "";
    const dd = String(dt.getDate()).padStart(2, "0");
    const mm = String(dt.getMonth() + 1).padStart(2, "0");
    const yyyy = dt.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  }

  function municipioDataLong(dt, municipioUf) {
    const d = dt && !Number.isNaN(dt.getTime()) ? dt : new Date();
    const mun = String(municipioUf || "Petrolina/PE").trim() || "Petrolina/PE";
    const diaSem = DIAS_SEM[d.getDay()] || "";
    return `${mun}, ${diaSem}, ${d.getDate()} de ${MESES[d.getMonth()] || ""} de ${d.getFullYear()}`;
  }

  function loadCliente(cpfDigits) {
    const d = onlyDigits(cpfDigits);
    if (d.length !== 11) return null;
    if (typeof window.__DK_getClienteByCpfAny === "function") {
      const merged = window.__DK_getClienteByCpfAny(d);
      if (merged) return merged;
    }
    if (typeof findClienteByCpfCadastro === "function") {
      const cad = findClienteByCpfCadastro(d);
      if (cad) return cad;
    }
    if (typeof window.__DK_findPortalClienteByCpf === "function") {
      const portal = window.__DK_findPortalClienteByCpf(d);
      if (portal) return portal;
    }
    const loadFn =
      typeof window.__DK_loadPortalClientesCadastro === "function"
        ? window.__DK_loadPortalClientesCadastro
        : typeof window.loadPortalClientesCadastro === "function"
          ? window.loadPortalClientesCadastro
          : null;
    if (loadFn) {
      const hit = loadFn().find((c) => onlyDigits(c?.cpf) === d);
      if (hit) return hit;
    }
    try {
      const banco = window.DK_BANCO_CADASTRO?.clientes;
      if (Array.isArray(banco)) {
        const hit = banco.find((c) => onlyDigits(c?.cpf) === d);
        if (hit) return hit;
      }
    } catch {
      /* ignore */
    }
    try {
      const raw = localStorage.getItem("dk_portal_clientes_cadastro");
      const arr = raw ? JSON.parse(raw) : [];
      if (Array.isArray(arr)) {
        const hit = arr.find((c) => onlyDigits(c?.cpf) === d);
        if (hit) return hit;
      }
    } catch {
      /* ignore */
    }
    return null;
  }

  function enderecoEhPlaceholder(value) {
    if (typeof window.__DK_portalEnderecoContratoValido === "function") {
      return !window.__DK_portalEnderecoContratoValido(value);
    }
    const text = String(value ?? "").trim();
    if (!text) return true;
    if (/^x+$/i.test(text.replace(/[\s.,/-]/g, ""))) return true;
    const norm = text
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .replace(/\s+/g, " ");
    if (norm.includes("endereco do cliente")) return true;
    if (norm.includes("{endereco") || norm.includes("(endereco")) return true;
    if (norm === "endereco nao cadastrado") return true;
    return false;
  }

  function pickCampoEnderecoValido(...values) {
    for (const value of values) {
      const text = String(value ?? "").trim();
      if (text && !enderecoEhPlaceholder(text)) return text;
    }
    return "";
  }

  function formatCepContrato(cep) {
    const d = String(cep || "").replace(/\D/g, "");
    if (d.length !== 8) return String(cep || "").trim();
    return `${d.slice(0, 5)}-${d.slice(5)}`;
  }

  function formatMunicipioContrato(mun) {
    const raw = String(mun || "").trim();
    if (!raw || enderecoEhPlaceholder(raw)) return "";
    if (raw.includes("/")) {
      const parts = raw.split("/").map((s) => s.trim());
      const cidade = parts[0] || "";
      const uf = parts[1] || "";
      if (cidade && uf) {
        const cap = cidade.charAt(0).toUpperCase() + cidade.slice(1).toLowerCase();
        return `${cap}-${uf.toUpperCase()}`;
      }
    }
    return raw;
  }

  function clienteEmbutidoPorCpf(cpfDigits) {
    const d = onlyDigits(cpfDigits);
    if (d.length !== 11) return null;
    try {
      const arr = window.DK_BANCO_CADASTRO?.clientes;
      if (Array.isArray(arr)) {
        const hit = arr.find((c) => onlyDigits(c?.cpf) === d);
        if (hit) return hit;
      }
    } catch {
      /* ignore */
    }
    return null;
  }

  function clienteCadastroLocalPorCpf(cpfDigits) {
    const d = onlyDigits(cpfDigits);
    if (d.length !== 11) return null;
    if (typeof findClienteByCpfCadastro === "function") {
      const hit = findClienteByCpfCadastro(d);
      if (hit) return hit;
    }
    if (typeof loadCadastro === "function" && typeof CAD_CLIENTES_KEY !== "undefined") {
      const hit = loadCadastro(CAD_CLIENTES_KEY).find((c) => onlyDigits(c?.cpf) === d);
      if (hit) return hit;
    }
    try {
      const raw = localStorage.getItem("dk_clientes_cadastro");
      const arr = raw ? JSON.parse(raw) : [];
      if (Array.isArray(arr)) {
        const hit = arr.find((c) => onlyDigits(c?.cpf) === d);
        if (hit) return hit;
      }
    } catch {
      /* ignore */
    }
    return null;
  }

  /** Todas as fontes possíveis de endereço (cadastro primeiro; formulário só se CPF do form coincidir). */
  function coletarFontesEnderecoCliente(cpfDigits) {
    const d = onlyDigits(cpfDigits);
    const fontes = [];
    const push = (obj) => {
      if (obj && typeof obj === "object") fontes.push(obj);
    };
    if (typeof window.__DK_getClienteByCpfAny === "function") push(window.__DK_getClienteByCpfAny(d));
    push(clienteCadastroLocalPorCpf(d));
    push(clienteEmbutidoPorCpf(d));
    push(loadCliente(d));
    const formCpf = onlyDigits(document.getElementById("operacaoClienteCpf")?.value);
    if (formCpf === d) {
      push({
        endereco: document.getElementById("operacaoClienteEndereco")?.value,
        municipioUf: document.getElementById("operacaoClienteMunicipioUf")?.value,
        cep: document.getElementById("operacaoClienteCep")?.value,
      });
    }
    return fontes;
  }

  function montarEnderecoContratoDeFontes(fontes) {
    const list = Array.isArray(fontes) ? fontes : [];
    const endereco = pickCampoEnderecoValido(
      ...list.map((f) => f?.endereco),
      ...list.map((f) => f?.enderecoBase),
      ...list.map((f) => f?.logradouro),
      ...list.map((f) => f?.enderecoResidencia)
    );
    const complemento = pickCampoEnderecoValido(
      ...list.map((f) => f?.complemento),
      ...list.map((f) => f?.enderecoComplemento)
    );
    const municipioUf = pickCampoEnderecoValido(
      ...list.map((f) => f?.municipioUf),
      ...list.map((f) => f?.municipio)
    );
    const cep = pickCampoEnderecoValido(...list.map((f) => f?.cep));
    return formatEnderecoContratoLocatario({ endereco, complemento, municipioUf, cep });
  }

  function formatEnderecoContratoLocatario(cliente) {
    if (!cliente) return "";
    const end = pickCampoEnderecoValido(
      cliente.endereco,
      cliente.enderecoBase,
      cliente.logradouro,
      cliente.enderecoResidencia
    );
    const comp = pickCampoEnderecoValido(cliente.complemento, cliente.enderecoComplemento);
    const mun = pickCampoEnderecoValido(cliente.municipioUf, cliente.municipio);
    const cepRaw = pickCampoEnderecoValido(cliente.cep);
    const linhaEnd = [end, comp].filter(Boolean).join(", ");
    const munFmt = formatMunicipioContrato(mun);
    const cepFmt = formatCepContrato(cepRaw);
    const partes = [];
    if (linhaEnd) partes.push(linhaEnd);
    if (munFmt) partes.push(munFmt);
    if (cepFmt) partes.push(`cep ${cepFmt}`);
    return partes.join(" ");
  }

  function resolverEnderecoContrato(cpfDigits) {
    const d = onlyDigits(cpfDigits);
    if (d.length !== 11) return "";
    return montarEnderecoContratoDeFontes(coletarFontesEnderecoCliente(d));
  }

  function garantirDadosContratoComEndereco(dados) {
    if (!dados) return dados;
    const cpfDigits = onlyDigits(dados.cpfDigits);
    const enderecoResolvido = resolverEnderecoContrato(cpfDigits);
    const enderecoAtual = String(dados.endereco || "").trim();
    const enderecoFinal =
      enderecoResolvido ||
      (enderecoAtual && !enderecoEhPlaceholder(enderecoAtual) ? enderecoAtual : "");
    return {
      ...dados,
      endereco: enderecoFinal || "endereço não cadastrado",
    };
  }

  function resolverDadosFromForm() {
    const protocolo = normProtocolo(document.getElementById("operacaoLocacaoProtocolo")?.value);
    const cpfDigits = onlyDigits(document.getElementById("operacaoLocacaoCpf")?.value);
    const nome =
      String(document.getElementById("operacaoLocacaoCliente")?.value || "").trim() ||
      String(loadCliente(cpfDigits)?.nome || "").trim();
    const placa = normPlaca(document.getElementById("operacaoLocacaoPlaca")?.value);
    const marcaModelo = String(document.getElementById("operacaoLocacaoModelo")?.value || "").trim();
    const modalidade =
      String(document.getElementById("operacaoLocacaoTipoPlano")?.value || "").trim() || "DK MEU TRANSPORTE";
    const rawInicio = String(document.getElementById("operacaoLocacaoDataInicio")?.value || "").trim();
    const inicioDt = parseBrDate(rawInicio) || new Date();
    const rawFim = String(document.getElementById("operacaoLocacaoDataFim")?.value || "").trim();
    const statusLocacao = rawFim ? "FINALIZADO" : "ATIVO";
    const cliente = loadCliente(cpfDigits);
    const veiculo = loadVeiculoByPlaca(placa);
    const codigoCliente = String(cliente?.codigo || "").trim() || "0000";
    const municipioUf = String(cliente?.municipioUf || "Petrolina/PE").trim();
    const proprietario = valorNaoVazio(
      document.getElementById("operacaoVeiculoProprietario")?.value,
      veiculo?.proprietario
    );
    const proprietarioCpfCnpj = formatCpfCnpjContrato(
      valorNaoVazio(
        document.getElementById("operacaoVeiculoProprietarioCpfCnpj")?.value,
        veiculo?.proprietarioCpfCnpj,
        veiculo?.cpfCnpjProprietario,
        veiculo?.cpfCnpj
      )
    );
    const odometroInicio = formatOdometroContrato(
      valorNaoVazio(
        document.getElementById("operacaoLocacaoOdometroInicio")?.value,
        document.getElementById("operacaoLocacaoKmInicial")?.value
      )
    );
    const odometroFim = formatOdometroContrato(
      valorNaoVazio(document.getElementById("operacaoLocacaoOdometroFim")?.value)
    );
    return garantirDadosContratoComEndereco(
      montarDadosContrato({
        protocolo,
        cpfDigits,
        nome,
        placa,
        marcaModelo,
        modalidade,
        codigoCliente,
        endereco: "",
        municipioUf,
        inicioDt,
        statusLocacao,
        fim: rawFim,
        proprietario,
        proprietarioCpfCnpj,
        odometroInicio,
        odometroFim,
      })
    );
  }

  function resolverDadosFromLoc(loc) {
    if (!loc) return null;
    const cpfDigits = onlyDigits(loc.cpf);
    const cliente = loadCliente(cpfDigits);
    const inicioDt = parseBrDate(loc.inicio) || new Date();
    const nome = String(loc.nome || loc.cliente || cliente?.nome || "").trim();
    const modalidade = String(loc.plano || loc.opcaoContrato || loc.modalidade || "").trim() || "DK MEU TRANSPORTE";
    const placa = normPlaca(loc.placa);
    const veiculo = loadVeiculoByPlaca(placa);
    return garantirDadosContratoComEndereco(
      montarDadosContrato({
        protocolo: normProtocolo(loc.numeroContrato),
        cpfDigits,
        nome,
        placa,
        marcaModelo: String(loc.marcaModelo || loc.modelo || veiculo?.marcaModelo || veiculo?.modelo || "").trim(),
        modalidade,
        codigoCliente:
          (typeof formatClienteCodigoPadrao === "function"
            ? formatClienteCodigoPadrao(loc.clienteCodigo || cliente?.codigo)
            : "") ||
          String(loc.clienteCodigo || cliente?.codigo || "").trim() ||
          "0000",
        endereco: "",
        municipioUf: String(cliente?.municipioUf || "Petrolina/PE").trim(),
        inicioDt,
        statusLocacao: String(loc.statusLocacao || (String(loc.fim || "").trim() ? "FINALIZADO" : "ATIVO")).trim(),
        fim: String(loc.fim || "").trim(),
        proprietario: valorNaoVazio(loc.proprietario, veiculo?.proprietario),
        proprietarioCpfCnpj: formatCpfCnpjContrato(
          valorNaoVazio(
            loc.proprietarioCpfCnpj,
            veiculo?.proprietarioCpfCnpj,
            veiculo?.cpfCnpjProprietario,
            veiculo?.cpfCnpj
          )
        ),
        odometroInicio: formatOdometroContrato(valorNaoVazio(loc.kmInicial, loc.odometroInicio)),
        odometroFim: formatOdometroContrato(valorNaoVazio(loc.kmFinal, loc.odometroFim)),
      })
    );
  }

  function montarDadosContrato(p) {
    const inicioDt = p.inicioDt || new Date();
    const protocolo = normProtocolo(p.protocolo);
    const proprietario = String(p.proprietario || "").trim();
    const proprietarioCpfCnpj = formatCpfCnpjContrato(p.proprietarioCpfCnpj);
    const odometroInicio = String(p.odometroInicio || "").trim();
    const odometroFim = String(p.odometroFim || "").trim();
    return {
      protocolo,
      cpfDigits: p.cpfDigits,
      nome: p.nome,
      cpfFmt: formatCpf(p.cpfDigits),
      endereco: p.endereco,
      placa: p.placa,
      marcaModelo: p.marcaModelo,
      modalidade: p.modalidade,
      codigoCliente: p.codigoCliente,
      dataContrato: formatDataBr(inicioDt),
      dataContratoDt: inicioDt,
      municipioUf: p.municipioUf,
      municipioData: municipioDataLong(inicioDt, p.municipioUf),
      statusLocacao: p.statusLocacao,
      fim: p.fim,
      proprietario,
      proprietarioCpfCnpj,
      odometroInicio,
      odometroFim,
      sidebar: `Prot. Nº: ${p.protocolo} - ${DIAS_SEM[inicioDt.getDay()] || "dia"}, ${formatDataBr(inicioDt)} - ${p.modalidade} - Cód. Cliente: ${p.codigoCliente} - ${String(p.nome).toUpperCase()} - Placa: ${p.placa} - ${String(p.marcaModelo).toUpperCase()}`,
    };
  }

  function validarDados(dados) {
    if (!dados?.protocolo) return "Informe ou cadastre um protocolo válido.";
    if (onlyDigits(dados.cpfDigits).length !== 11) return "CPF inválido (11 dígitos).";
    if (!String(dados.nome || "").trim()) return "Informe o nome do cliente.";
    if (!dados.placa || dados.placa.length < 7) return "Informe a placa do veículo.";
    return "";
  }

  function substituirPlaceholders(html, dados) {
    return String(html || "")
      .replace(/\{\{MODALIDADE\}\}/g, esc(dados.modalidade))
      .replace(/\{\{LOCATARIO\}\}/g, esc(dados.nome))
      .replace(/\{\{CPF_LOCATARIO\}\}/g, esc(dados.cpfFmt))
      .replace(/\{\{MUNICIPIO_DATA\}\}/g, esc(dados.municipioData))
      .replace(/\{\{PLACA\}\}/g, esc(dados.placa || ""))
      .replace(/\{\{MARCA_MODELO\}\}/g, esc(dados.marcaModelo || ""))
      .replace(/\{\{PROPRIETARIO\}\}/g, esc(dados.proprietario || "não informado"))
      .replace(/\{\{CPF_CNPJ_PROP\}\}/g, esc(dados.proprietarioCpfCnpj || "não informado"))
      .replace(/\{\{ODOMETRO_INICIO\}\}/g, esc(dados.odometroInicio || "não informado"))
      .replace(/\{\{ODOMETRO_FIM\}\}/g, esc(dados.odometroFim || "não informado"));
  }

  /** Folha A4 do modelo SISLOC (logo à esquerda, título à direita, faixa vertical, quadrado azul). */
  function cssContratoPagina() {
    return `
.pagina.pagina-contrato {
  position: relative;
  width: 210mm;
  height: 297mm;
  min-height: 297mm;
  max-height: 297mm;
  overflow: hidden;
  padding: 10mm 22mm 15mm 14mm;
  background: #fff;
  color: #000;
  font-family: Arial, Helvetica, sans-serif;
  font-size: 8.55pt;
  line-height: 1.21;
  page-break-after: always;
  break-after: page;
}
.pagina.pagina-contrato .marcador-azul {
  position: absolute;
  top: 5.2mm;
  right: 5.2mm;
  width: 4.4mm;
  height: 4.4mm;
  background: #2b6cb0;
  z-index: 4;
}
.pagina.pagina-contrato .cabecalho {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 6mm;
  margin: 0 0 3.2mm;
  padding-right: 6mm;
}
.pagina.pagina-contrato .cabecalho img {
  display: block;
  height: 16mm;
  width: auto;
  max-width: 46mm;
  object-fit: contain;
  object-position: left top;
  flex: 0 0 auto;
}
.pagina.pagina-contrato .cabecalho-titulo {
  text-align: right;
  flex: 1 1 auto;
  padding-top: 1.2mm;
}
.pagina.pagina-contrato .cabecalho-titulo h1 {
  margin: 0;
  font-size: 12.2pt;
  font-weight: 700;
  text-decoration: underline;
  text-underline-offset: 1.6px;
  letter-spacing: 0.02em;
  line-height: 1.15;
  text-align: right;
  text-transform: uppercase;
  font-family: Arial, Helvetica, sans-serif;
}
.pagina.pagina-contrato .cabecalho-titulo .proto {
  margin: 1.8mm 0 0;
  font-size: 10pt;
  font-weight: 700;
  text-align: right;
}
.pagina.pagina-contrato .partes { margin: 0 0 2.6mm; text-align: justify; }
.pagina.pagina-contrato .partes p { margin: 0 0 2mm; text-align: justify; }
.pagina.pagina-contrato .acordo {
  text-align: center;
  font-weight: 700;
  margin: 2.4mm 0 3mm;
}
.pagina.pagina-contrato .id-veiculo {
  margin: 0 0 2mm;
  text-align: justify;
  font-size: 8pt;
  line-height: 1.25;
}
.pagina.pagina-contrato .sidebar {
  position: absolute;
  top: 12mm;
  right: 2.8mm;
  bottom: 13mm;
  width: 13mm;
  writing-mode: vertical-rl;
  transform: rotate(180deg);
  font-size: 6.1pt;
  color: #222;
  text-align: center;
  letter-spacing: 0.02em;
  line-height: 1.15;
  overflow: hidden;
  white-space: nowrap;
  font-family: Arial, Helvetica, sans-serif;
}
.pagina.pagina-contrato .corpo { text-align: justify; }
.pagina.pagina-contrato .cl,
.pagina.pagina-contrato .cl-n { margin: 0 0 1.5px; text-align: justify; }
.pagina.pagina-contrato .cl-t {
  font-weight: 700;
  margin: 2.8mm 0 1.2mm;
  font-size: 9pt;
  text-align: left;
}
.pagina.pagina-contrato .sig-data {
  text-align: center;
  font-weight: 700;
  margin: 12mm 0 8mm;
  font-size: 9pt;
}
.pagina.pagina-contrato .sig-area {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16mm;
  margin-top: 4mm;
  width: 100%;
  box-sizing: border-box;
}
.pagina.pagina-contrato .sig-col {
  flex: 1 1 0;
  min-width: 0;
  text-align: center;
}
.pagina.pagina-contrato .sig-rule {
  width: 100%;
  border-bottom: 1.1pt solid #111;
  height: 18px;
  margin: 0 0 5px;
}
.pagina.pagina-contrato .sig-name {
  margin: 0;
  font-size: 8.4pt;
  font-weight: 700;
  text-align: center;
  line-height: 1.25;
}
.pagina.pagina-contrato .sig-id {
  margin: 2px 0 0;
  font-size: 8pt;
  font-weight: 700;
  text-align: center;
  line-height: 1.2;
}
.pagina.pagina-contrato .pe-pagina {
  position: absolute;
  bottom: 6mm;
  left: 14mm;
  right: 22mm;
  display: flex;
  justify-content: space-between;
  font-size: 7.4pt;
  color: #333;
  padding-top: 1.5px;
  font-family: Arial, Helvetica, sans-serif;
}`;
  }

  /** CSS A4 — exactamente 1 ecrã = 1 página (10 páginas no total). */
  function cssContrato() {
    return `
@page { size: A4 portrait; margin: 0; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: #888; }
body.contrato-preview { padding-top: 52px; }
.contrato-doc { width: 210mm; margin: 0 auto; }
.pagina {
  position: relative;
  width: 210mm;
  height: 297mm;
  max-height: 297mm;
  overflow: hidden;
  background: #fff;
  margin: 0 auto 8px;
  page-break-after: always;
  break-after: page;
}
.pagina:last-child { page-break-after: auto; margin-bottom: 0; }
${cssContratoPagina()}
.barra-acoes {
  position: fixed; top: 0; left: 0; right: 0; z-index: 999;
  background: #1a1a1a; color: #fff; padding: 10px 16px;
  display: flex; flex-wrap: wrap; align-items: center; gap: 10px;
}
.barra-acoes button {
  padding: 8px 16px; cursor: pointer; border: 0; border-radius: 4px;
  background: #e85d04; color: #fff; font-weight: 600; font-size: 13px;
}
.barra-acoes button:disabled { opacity: 0.5; cursor: wait; }
.barra-acoes button.sec { background: #444; }
.barra-acoes .barra-msg { font-size: 13px; opacity: 0.95; }
.barra-acoes .hidden { display: none !important; }
.contrato-salvar-dialog {
  position: fixed; inset: 0; z-index: 10000;
  background: rgba(0,0,0,0.55); display: flex; align-items: center; justify-content: center; padding: 16px;
}
.contrato-salvar-dialog.hidden { display: none !important; }
.contrato-salvar-dialog__box {
  background: #fff; color: #222; max-width: 520px; width: 100%; padding: 24px 28px; border-radius: 8px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.35); font-family: system-ui, sans-serif;
}
.contrato-salvar-dialog__titulo {
  font: bold 15px/1.35 system-ui, sans-serif; color: #b91c1c; margin: 0 0 12px;
  text-transform: uppercase; letter-spacing: 0.03em;
}
.contrato-salvar-dialog__sub { margin: 0 0 18px; font-size: 14px; line-height: 1.45; }
.contrato-salvar-dialog__acoes { display: flex; flex-wrap: wrap; gap: 10px; }
.contrato-salvar-dialog__acoes button {
  padding: 10px 18px; cursor: pointer; border: 0; border-radius: 4px;
  color: #fff; font-weight: 700; font-size: 13px; letter-spacing: 0.04em;
}
#btnContratoComparar { background: #2563eb; }
#btnContratoSubstituir { background: #e85d04; }
#btnContratoCancelarSalvar { background: #64748b; }
@media print {
  html, body { background: #fff; padding: 0 !important; margin: 0 !important; }
  .barra-acoes, .contrato-salvar-dialog { display: none !important; }
  .contrato-doc { width: 100%; margin: 0; }
  .pagina { margin: 0; box-shadow: none; page-break-after: always; break-after: page; }
  .pagina:last-child { page-break-after: auto; }
  body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}`;
  }

  function normCmpTexto(v) {
    return String(v ?? "")
      .trim()
      .replace(/\s+/g, " ");
  }

  function snapshotContratoDados(dados) {
    return {
      protocolo: normProtocolo(dados.protocolo),
      nome: normCmpTexto(dados.nome),
      cpfFmt: dados.cpfFmt || formatCpf(dados.cpfDigits),
      cpfDigits: onlyDigits(dados.cpfDigits),
      endereco: normCmpTexto(dados.endereco),
      placa: normPlaca(dados.placa),
      marcaModelo: normCmpTexto(dados.marcaModelo),
      modalidade: normCmpTexto(dados.modalidade),
      codigoCliente: normCmpTexto(dados.codigoCliente),
      municipioUf: normCmpTexto(dados.municipioUf),
      dataContrato: normCmpTexto(dados.dataContrato),
      fim: normCmpTexto(dados.fim),
      statusLocacao: normCmpTexto(dados.statusLocacao || "ATIVO"),
      proprietario: normCmpTexto(dados.proprietario),
      proprietarioCpfCnpj: normCmpTexto(dados.proprietarioCpfCnpj),
      odometroInicio: normCmpTexto(dados.odometroInicio),
      odometroFim: normCmpTexto(dados.odometroFim),
      geradoEm: new Date().toISOString(),
    };
  }

  const CAMPOS_COMPARACAO_CONTRATO = [
    { key: "nome", label: "Nome do locatário", grupo: "Cliente" },
    { key: "cpfFmt", label: "CPF", grupo: "Cliente", norm: (_v, d) => onlyDigits(d?.cpfDigits) },
    { key: "endereco", label: "Endereço", grupo: "Cliente" },
    { key: "codigoCliente", label: "Código do cliente", grupo: "Cliente" },
    { key: "municipioUf", label: "Município / UF", grupo: "Cliente" },
    { key: "placa", label: "Placa", grupo: "Veículo", norm: (v) => normPlaca(v) },
    { key: "marcaModelo", label: "Marca / modelo", grupo: "Veículo" },
    { key: "modalidade", label: "Modalidade", grupo: "Veículo" },
    { key: "proprietario", label: "Proprietário", grupo: "Veículo" },
    { key: "proprietarioCpfCnpj", label: "CPF/CNPJ do proprietário", grupo: "Veículo" },
    { key: "odometroInicio", label: "Odômetro início", grupo: "Veículo" },
    { key: "odometroFim", label: "Odômetro fim", grupo: "Veículo" },
    { key: "dataContrato", label: "Data de início", grupo: "Contrato" },
    { key: "fim", label: "Data de término", grupo: "Contrato" },
    { key: "statusLocacao", label: "Status da locação", grupo: "Contrato" },
  ];

  function compararDadosContrato(novo, antigo) {
    return CAMPOS_COMPARACAO_CONTRATO.map((c) => {
      const vNovo = novo?.[c.key] ?? "";
      const vAnt = antigo?.[c.key] ?? "";
      const nN = c.norm ? c.norm(vNovo, novo) : normCmpTexto(vNovo);
      const nA = antigo ? (c.norm ? c.norm(vAnt, antigo) : normCmpTexto(vAnt)) : null;
      const igual = antigo ? nN === nA : null;
      return {
        ...c,
        novo: vNovo || "—",
        antigo: antigo ? vAnt || "—" : null,
        igual,
      };
    });
  }

  function fmtDataHoraIso(iso) {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return String(iso);
    return d.toLocaleString("pt-BR");
  }

  function cssComparacaoContrato() {
    return `
* { box-sizing: border-box; }
body { margin: 0; font-family: system-ui, sans-serif; background: #f1f5f9; color: #0f172a; }
.wrap { max-width: 960px; margin: 0 auto; padding: 20px 16px 32px; }
h1 { margin: 0 0 6px; font-size: 20px; }
.sub { margin: 0 0 16px; color: #475569; font-size: 14px; line-height: 1.45; }
.aviso { background: #fef3c7; border: 1px solid #fcd34d; padding: 10px 14px; border-radius: 6px; margin-bottom: 16px; font-size: 13px; }
.acoes-top { margin-bottom: 16px; display: flex; flex-wrap: wrap; gap: 10px; }
.acoes-top button { padding: 8px 14px; border: 0; border-radius: 4px; cursor: pointer; font-weight: 600; background: #1e293b; color: #fff; }
.grupo { margin-bottom: 20px; }
.grupo h2 { margin: 0 0 8px; font-size: 13px; text-transform: uppercase; letter-spacing: 0.06em; color: #64748b; }
table { width: 100%; border-collapse: collapse; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
th, td { padding: 10px 12px; text-align: left; border-bottom: 1px solid #e2e8f0; font-size: 13px; vertical-align: top; }
th { background: #f8fafc; font-size: 12px; text-transform: uppercase; letter-spacing: 0.04em; color: #475569; }
td.diff-igual { background: #f0fdf4; }
td.diff-diff { background: #fef2f2; font-weight: 600; }
td.diff-novo-only { background: #eff6ff; }
.badge { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 700; }
.badge-igual { background: #dcfce7; color: #166534; }
.badge-diff { background: #fee2e2; color: #991b1b; }
`;
  }

  function buildComparacaoContratoHtml(linhas, ctx) {
    const grupos = ["Cliente", "Veículo", "Contrato"];
    const semAntigo = !ctx?.temDadosAntigo;
    const aviso = semAntigo
      ? `<div class="aviso">O PDF existente não tem registo de dados para comparação (foi guardado antes desta funcionalidade). Use «Ver PDF existente» para conferir manualmente.</div>`
      : "";
    const tabelas = grupos
      .map((g) => {
        const rows = linhas.filter((l) => l.grupo === g);
        if (!rows.length) return "";
        const trs = rows
          .map((r) => {
            const clsAnt = semAntigo ? "diff-novo-only" : r.igual ? "diff-igual" : "diff-diff";
            const clsNov = semAntigo ? "diff-novo-only" : r.igual ? "diff-igual" : "diff-diff";
            const badge = semAntigo
              ? ""
              : r.igual
                ? `<span class="badge badge-igual">igual</span>`
                : `<span class="badge badge-diff">diferente</span>`;
            const antigoCell = semAntigo ? `<td>—</td>` : `<td class="${clsAnt}">${esc(r.antigo)}</td>`;
            return `<tr><td>${esc(r.label)}</td>${antigoCell}<td class="${clsNov}">${esc(r.novo)}</td><td>${badge}</td></tr>`;
          })
          .join("");
        return `<section class="grupo"><h2>${esc(g)}</h2><table><thead><tr><th>Campo</th><th>Arquivo existente</th><th>Novo arquivo</th><th></th></tr></thead><tbody>${trs}</tbody></table></section>`;
      })
      .join("");
    const proto = esc(ctx?.protocolo || "");
    const btnPdf =
      ctx?.protocolo && ctx?.idExistente
        ? `<button type="button" id="btnVerPdfExistente" data-proto="${proto}">Ver PDF existente</button>`
        : "";
    return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><title>Comparar contrato ${proto}</title><style>${cssComparacaoContrato()}</style></head><body>
<div class="wrap">
<h1>Comparação de contratos</h1>
<p class="sub">Protocolo <strong>${proto}</strong> — dados do cliente e do veículo.<br>Arquivo na pasta: <strong>${esc(ctx?.nomeArquivo || "—")}</strong> · guardado em ${esc(fmtDataHoraIso(ctx?.criadoEm))}</p>
<div class="acoes-top">${btnPdf}</div>
${aviso}
${tabelas}
</div>
<script>
(function(){
  var btn = document.getElementById("btnVerPdfExistente");
  if (!btn || !window.opener) return;
  btn.addEventListener("click", function(){
    var fn = window.opener.__DK_contratoLocacaoVisualizarArmazenado;
    if (typeof fn !== "function") { alert("Portal indisponível."); return; }
    fn(btn.getAttribute("data-proto"));
  });
})();
<\/script>
</body></html>`;
  }

  function verificarContratoExistente(protocolo) {
    const entrada = obterContratoDeposito(protocolo);
    if (!entrada) return { existe: false, existente: null };
    return {
      existe: true,
      existente: {
        id: entrada.id,
        nomeArquivo: entrada.nomeArquivo,
        criadoEm: entrada.criadoEm,
        contratoDados: entrada.contratoDados || null,
      },
    };
  }

  function abrirComparacaoContrato(novoDados, existenteInfo) {
    const antigo = existenteInfo?.contratoDados || null;
    const linhas = compararDadosContrato(novoDados, antigo);
    const html = buildComparacaoContratoHtml(linhas, {
      protocolo: novoDados?.protocolo || existenteInfo?.contratoDados?.protocolo,
      nomeArquivo: existenteInfo?.nomeArquivo,
      criadoEm: existenteInfo?.criadoEm,
      temDadosAntigo: Boolean(antigo),
      idExistente: existenteInfo?.id,
    });
    const w = window.open("", "_blank", "width=980,height=760");
    if (!w) return { ok: false, msg: "popup_bloqueado" };
    w.document.write(html);
    w.document.close();
    w.focus();
    return { ok: true };
  }

  function paginaCapa(dados) {
    const prop = String(dados.proprietario || "").trim() || "não informado";
    const propDoc = String(dados.proprietarioCpfCnpj || "").trim() || "não informado";
    const odIni = String(dados.odometroInicio || "").trim() || "não informado";
    const odFim = String(dados.odometroFim || "").trim() || "não informado";
    return `<div class="partes">
<p>De um lado, <strong>DK LOCADORA LTDA</strong>, pessoa jurídica de direito privado, devidamente inscrita no CNPJ/MF sob o nº
59.665.734/0001-32, com sede na AV. DA REDENÇÃO, SN - ANTÔNIO CASSIMIRO - PETROLINA/PE - CEP: 56.321-440,
representado na forma de seu Contrato Social, neste ato denominado <strong>LOCADOR</strong>.</p>
<p>De outro lado, ${esc(dados.nome)}, CPF: ${esc(dados.cpfFmt)},
residente e domiciliado no(a) ${esc(dados.endereco)},
neste ato denominado <strong>LOCATÁRIO</strong>.</p>
<p class="id-veiculo"><strong>Veículo:</strong> Placa ${esc(dados.placa)} — ${esc(dados.marcaModelo || "—")} — Proprietário: ${esc(prop)} — CPF/CNPJ do proprietário: ${esc(propDoc)} — Odômetro início: ${esc(odIni)} — Odômetro fim: ${esc(odFim)}.</p>
<p class="acordo">Têm entre si, de maneira justa e acordada, o presente INSTRUMENTO PARTICULAR DE CONTRATO DE LOCAÇÃO DE VEÍCULO, que se regerá pelas cláusulas abaixo descritas.</p>
</div>`;
  }

  function buildPaginaHtml(num, total, corpoHtml, dados) {
    const capa = num === 1 ? paginaCapa(dados) : "";
    const titulo =
      num === 1
        ? `<div class="cabecalho">
  <img src="${esc(logoAbsUrl())}" alt="DK Locadora" crossorigin="anonymous">
  <div class="cabecalho-titulo">
    <h1>CONTRATO DE LOCAÇÃO DE VEÍCULO</h1>
    <p class="proto">Protocolo nº ${esc(dados.protocolo)}</p>
  </div>
</div>`
        : "";
    return `<div class="pagina pagina-contrato" data-pagina="${num}">
  <div class="marcador-azul" aria-hidden="true"></div>
  <div class="sidebar">${esc(dados.sidebar)}</div>
  ${titulo}
  ${capa}
  <div class="corpo">${corpoHtml}</div>
  <div class="pe-pagina"><span># DK - SISLOC - Sistema de Controle de Locações</span><span>Pág.: ${num} / ${total}</span></div>
</div>`;
  }

  function buildPaginasHtml(dados) {
    const corpos = window.__DK_CONTRATO_LOCACAO_CORPOS;
    if (!Array.isArray(corpos) || corpos.length !== 10) {
      throw new Error("Modelo de contrato indisponível (10 páginas). Atualize a página.");
    }
    return corpos.map((corpo, i) =>
      buildPaginaHtml(i + 1, corpos.length, substituirPlaceholders(corpo, dados), dados)
    );
  }

  function nomeArquivoContrato(protocolo) {
    const fn =
      typeof window.__DK_documentosNomeArquivoContrato === "function"
        ? window.__DK_documentosNomeArquivoContrato
        : null;
    if (fn) return fn(protocolo);
    const p = normProtocolo(protocolo);
    return p ? `${p}.pdf` : "";
  }

  function scriptPreviewInline(dados) {
    const html2canvasUrl = vendorScriptUrl(VENDOR_HTML2CANVAS);
    const jspdfUrl = vendorScriptUrl(VENDOR_JSPDF);
    const proto = normProtocolo(dados.protocolo);
    const meta = JSON.stringify({
      protocolo: proto,
      nomeArquivo: nomeArquivoContrato(proto),
      statusLocacao: dados.statusLocacao,
      fim: dados.fim || "",
      pastaContrato: "ativo",
      contratoDados: snapshotContratoDados(dados),
    });
    return `<script>
(function(){
  var META = ${meta};
  var pdfBlob = null;
  var btnGerar = document.getElementById("btnGerarPdf");
  var barraInicial = document.getElementById("barraInicial");
  var barraPos = document.getElementById("barraPosPdf");
  var msg = document.getElementById("barraMsg");

  function loadScript(src){
    return new Promise(function(res, rej){
      var s = document.createElement("script");
      s.src = src; s.crossOrigin = "anonymous"; s.referrerPolicy = "no-referrer";
      s.onload = res; s.onerror = function(){ rej(new Error("Script indisponível: " + src)); };
      document.head.appendChild(s);
    });
  }

  async function ensurePdfLibs(){
    if (!window.html2canvas) await loadScript("${html2canvasUrl}");
    if (!window.jspdf && !window.jsPDF) await loadScript("${jspdfUrl}");
  }

    const pdfLocacaoMax = ${PDF_LOCACAO_MAX_BYTES};
    const pdfLocacaoAlvo = ${PDF_LOCACAO_ALVO_BYTES};
    var tentativasPdf = [
      { scale: 1.35, quality: 0.78 },
      { scale: 1.2, quality: 0.72 },
      { scale: 1.05, quality: 0.65 }
    ];

    function fmtTam(n){
      if (!n) return "0 B";
      if (n < 1024) return n + " B";
      if (n < 1048576) return (n / 1024).toFixed(1).replace(".", ",") + " KB";
      return (n / 1048576).toFixed(2).replace(".", ",") + " MB";
    }

    async function montarPdf(scale, quality){
      var JsPDF = window.jspdf && window.jspdf.jsPDF ? window.jspdf.jsPDF : window.jsPDF;
      if (!JsPDF) throw new Error("jsPDF indisponível");
      var paginas = document.querySelectorAll(".pagina");
      if (paginas.length !== 10) throw new Error("Contrato deve ter 10 páginas (encontradas: " + paginas.length + ")");
      var pdf = new JsPDF({ unit: "mm", format: "a4", orientation: "portrait", compress: true });
      for (var i = 0; i < paginas.length; i++) {
        var canvas = await html2canvas(paginas[i], {
          scale: scale, useCORS: true, logging: false, backgroundColor: "#ffffff",
          width: paginas[i].offsetWidth, height: paginas[i].offsetHeight
        });
        var img = canvas.toDataURL("image/jpeg", quality);
        if (i > 0) pdf.addPage();
        pdf.addImage(img, "JPEG", 0, 0, 210, 297, undefined, "FAST");
      }
      return pdf.output("blob");
    }

    async function gerarPdfBlob(){
      await ensurePdfLibs();
      var ultimo = null;
      for (var t = 0; t < tentativasPdf.length; t++) {
        var cfg = tentativasPdf[t];
        ultimo = await montarPdf(cfg.scale, cfg.quality);
        if (ultimo && ultimo.size <= pdfLocacaoAlvo) return ultimo;
      }
      if (ultimo && ultimo.size > pdfLocacaoMax) {
        throw new Error("PDF ainda grande (" + fmtTam(ultimo.size) + ") — limite " + fmtTam(pdfLocacaoMax) + " para importar na locação.");
      }
      return ultimo;
    }

  btnGerar.addEventListener("click", function(){
    btnGerar.disabled = true;
    msg.textContent = "A gerar PDF (10 páginas)…";
    gerarPdfBlob().then(function(blob){
      pdfBlob = blob;
      barraInicial.classList.add("hidden");
      barraPos.classList.remove("hidden");
      var aviso = blob.size > pdfLocacaoMax ? " (excede limite da locação — gere de novo)" : "";
      msg.textContent = "PDF gerado — 10 páginas · " + fmtTam(blob.size) + aviso + " — guarde em Contratos ATIVOS.";
    }).catch(function(e){
      msg.textContent = "Erro: " + (e && e.message ? e.message : e);
      btnGerar.disabled = false;
    });
  });

  document.getElementById("btnImprimir").addEventListener("click", function(){ window.print(); });

  function blobParaBase64(blob){
    return new Promise(function(res, rej){
      var r = new FileReader();
      r.onload = function(){
        var s = String(r.result || "");
        res(s.indexOf(",") >= 0 ? s.slice(s.indexOf(",") + 1) : s);
      };
      r.onerror = function(){ rej(new Error("leitura_pdf")); };
      r.readAsDataURL(blob);
    });
  }

  function fecharDialogSalvar(){
    var dlg = document.getElementById("contratoSalvarDialog");
    if (dlg) dlg.classList.add("hidden");
  }

  function doSalvar(substituir){
    var btn = document.getElementById("btnSalvar");
    btn.disabled = true;
    msg.textContent = "A guardar na pasta Contratos ATIVOS…";
    return blobParaBase64(pdfBlob).then(function(b64){
      var opts = substituir ? { substituirConfirmado: true } : {};
      return window.opener.__DK_contratoLocacaoSalvarPdfBlob(META, { b64: b64, type: "application/pdf" }, opts);
    }).then(function(r){
      if (r && r.ok) {
        msg.textContent = r.substituido
          ? "Contrato substituído em Documentos → Contratos ATIVOS (PDF anterior removido)."
          : "Contrato guardado em Documentos → Contratos ATIVOS (nuvem).";
        fecharDialogSalvar();
        window.opener.__DK_contratoLocacaoRefreshBotao && window.opener.__DK_contratoLocacaoRefreshBotao();
      } else if (r && r.needConfirm) {
        document.getElementById("contratoSalvarProto").textContent = META.protocolo;
        document.getElementById("contratoSalvarDialog").classList.remove("hidden");
        msg.textContent = r.msg || "ESTE ARQUIVO JÁ EXISTE NA PASTA DOCUMENTOS";
        btn.disabled = false;
      } else {
        msg.textContent = (r && r.msg) || "Não foi possível guardar.";
        btn.disabled = false;
      }
    }).catch(function(e){
      msg.textContent = "Erro ao guardar: " + (e && e.message ? e.message : e);
      btn.disabled = false;
    });
  }

  document.getElementById("btnContratoComparar").addEventListener("click", function(){
    if (!window.opener || typeof window.opener.__DK_contratoLocacaoAbrirComparacao !== "function") {
      msg.textContent = "Comparação indisponível — recarregue a janela principal.";
      return;
    }
    var v = window.opener.__DK_contratoLocacaoVerificarExistente(META.protocolo);
    window.opener.__DK_contratoLocacaoAbrirComparacao(META.contratoDados, v && v.existente ? v.existente : null);
  });

  document.getElementById("btnContratoSubstituir").addEventListener("click", function(){
    doSalvar(true);
  });

  document.getElementById("btnContratoCancelarSalvar").addEventListener("click", function(){
    fecharDialogSalvar();
    document.getElementById("btnSalvar").disabled = false;
    msg.textContent = "Gravação cancelada — o PDF na pasta Documentos não foi alterado.";
  });

  document.getElementById("btnSalvar").addEventListener("click", function(){
    var btn = this;
    if (!pdfBlob) { msg.textContent = "Gere o PDF primeiro."; return; }
    if (pdfBlob.size > pdfLocacaoMax) {
      msg.textContent = "PDF demasiado grande (" + fmtTam(pdfBlob.size) + ") — clique em Gerar PDF novamente.";
      return;
    }
    if (!window.opener || typeof window.opener.__DK_contratoLocacaoSalvarPdfBlob !== "function") {
      msg.textContent = "Portal indisponível — recarregue a janela principal.";
      return;
    }
    var verificar = window.opener.__DK_contratoLocacaoVerificarExistente;
    if (typeof verificar === "function") {
      var chk = verificar(META.protocolo);
      if (chk && chk.existe) {
        document.getElementById("contratoSalvarProto").textContent = META.protocolo;
        document.getElementById("contratoSalvarDialog").classList.remove("hidden");
        msg.textContent = "ESTE ARQUIVO JÁ EXISTE NA PASTA DOCUMENTOS";
        return;
      }
    }
    doSalvar(false);
  });
})();
<\/script>`;
  }

  function buildContratoPreviewHtml(dados) {
    const paginas = buildPaginasHtml(dados);
    return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(dados.protocolo)}</title><style>${cssContrato()}</style></head><body class="contrato-preview">
<div class="barra-acoes">
  <button type="button" id="btnImprimir">Imprimir</button>
  <span id="barraInicial"><button type="button" id="btnGerarPdf">Gerar PDF</button></span>
  <span id="barraPosPdf" class="hidden">
    <button type="button" id="btnSalvar">Salvar</button>
  </span>
  <span class="barra-msg" id="barraMsg">Protocolo ${esc(dados.protocolo)} — modelo 10 páginas formatado para impressão</span>
</div>
<div id="contratoSalvarDialog" class="contrato-salvar-dialog hidden" role="dialog" aria-modal="true" aria-labelledby="contratoSalvarTitulo">
  <div class="contrato-salvar-dialog__box">
    <p id="contratoSalvarTitulo" class="contrato-salvar-dialog__titulo">ESTE ARQUIVO JÁ EXISTE NA PASTA DOCUMENTOS</p>
    <p class="contrato-salvar-dialog__sub">Protocolo <strong id="contratoSalvarProto">${esc(dados.protocolo)}</strong> — já há um PDF com este nome em Documentos → Contratos ATIVOS. Deseja substituir?</p>
    <div class="contrato-salvar-dialog__acoes">
      <button type="button" id="btnContratoComparar">COMPARAR</button>
      <button type="button" id="btnContratoSubstituir">SUBSTITUIR</button>
      <button type="button" id="btnContratoCancelarSalvar">CANCELAR</button>
    </div>
  </div>
</div>
<div class="contrato-doc">${paginas.join("")}</div>
${scriptPreviewInline(dados)}
</body></html>`;
  }

  function obterContratoDeposito(protocolo) {
    const fn =
      typeof window.__DK_documentosObterContratoPorProtocolo === "function"
        ? window.__DK_documentosObterContratoPorProtocolo
        : null;
    return fn ? fn(protocolo) : null;
  }

  function contratoExisteParaProtocolo(protocolo) {
    return Boolean(obterContratoDeposito(protocolo));
  }

  function pastaContratoParaLocacao(statusLocacao, fim) {
    const st = String(statusLocacao || "").toUpperCase();
    const fin =
      st.includes("FINAL") || st.includes("CANCEL") || Boolean(String(fim || "").trim());
    return fin ? "inativo" : "ativo";
  }

  async function sincronizarPastaContratoLocacao(protocolo, statusLocacao, opts = {}) {
    const mover =
      typeof window.__DK_documentosMoverContratoPorProtocolo === "function"
        ? window.__DK_documentosMoverContratoPorProtocolo
        : null;
    if (!mover) return { ok: false, msg: "deposito_indisponivel" };
    return mover(protocolo, pastaContratoParaLocacao(statusLocacao, opts.fim), opts);
  }

  async function salvarPdfBlobNoDeposito(meta, recebido, opts = {}) {
    const kitAnexo = Boolean(opts.kitAnexo || (meta?.kitTipo && meta.kitTipo !== "contrato"));
    const protocolo = normProtocolo(
      meta?.protocolo || String(meta?.nomeArquivo || "").replace(/\.pdf$/i, "").split("-")[0]
    );
    const normalizar =
      typeof window.__DK_documentosNormalizarBlob === "function" ? window.__DK_documentosNormalizarBlob : null;
    let blob = normalizar ? await normalizar(recebido, "application/pdf") : null;
    if (!blob && recebido instanceof Blob) blob = recebido;
    if (!blob && recebido?.b64) {
      try {
        const bin = atob(String(recebido.b64));
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
        blob = new Blob([bytes], { type: "application/pdf" });
      } catch {
        blob = null;
      }
    }
    if (!protocolo) return { ok: false, msg: "Protocolo inválido — recarregue o cadastro da locação." };
    if (!blob || !blob.size) return { ok: false, msg: "PDF inválido — clique em Gerar PDF novamente." };
    const depositar = typeof window.__DK_documentosDepositarBlob === "function" ? window.__DK_documentosDepositarBlob : null;
    if (!depositar) return { ok: false, msg: "deposito_indisponivel" };

    const statusLocacao = String(meta.statusLocacao || "ATIVO");
    const fim = String(meta.fim || "");
    let existente = null;
    if (!kitAnexo) {
      existente = obterContratoDeposito(protocolo);
      if (existente && !opts.substituirConfirmado) {
        return {
          ok: false,
          needConfirm: true,
          msg: "ESTE ARQUIVO JÁ EXISTE NA PASTA DOCUMENTOS",
          existente: {
            id: existente.id,
            nomeArquivo: existente.nomeArquivo,
            criadoEm: existente.criadoEm,
            contratoDados: existente.contratoDados || null,
          },
        };
      }
    }
    const nomeArquivo = kitAnexo
      ? String(meta.nomeArquivo || `${protocolo}-${meta.kitTipo || "anexo"}.pdf`).trim()
      : nomeArquivoContrato(protocolo);
    const chaveDep = kitAnexo ? String(nomeArquivo).replace(/\.pdf$/i, "") : protocolo;
    const contratoDados =
      meta.contratoDados && typeof meta.contratoDados === "object"
        ? meta.contratoDados
        : snapshotContratoDados({
            protocolo,
            nome: meta.nome,
            cpfDigits: meta.cpfDigits,
            cpfFmt: meta.cpfFmt,
            endereco: meta.endereco,
            placa: meta.placa,
            marcaModelo: meta.marcaModelo,
            modalidade: meta.modalidade,
            codigoCliente: meta.codigoCliente,
            municipioUf: meta.municipioUf,
            dataContrato: meta.dataContrato,
            fim,
            statusLocacao,
          });

    const dep = await depositar(
      "contrato",
      blob,
      {
        nomeArquivo,
        chave: chaveDep,
        mimeType: "application/pdf",
        origem: "contrato-locacao",
        contratoDados,
        kitTipo: meta.kitTipo || (kitAnexo ? "anexo" : "contrato"),
        protocoloBase: protocolo,
      },
      { statusContrato: "ativo", silent: true, kitAnexo, replaceChave: kitAnexo }
    );

    if (!dep?.ok) {
      return { ok: false, msg: dep?.msg || "Não foi possível guardar na pasta Contratos ATIVOS." };
    }

    if (dep?.ok && dep.entry?.nuvem !== true && !kitAnexo) {
      await sincronizarPastaContratoLocacao(protocolo, statusLocacao, { fim, silent: true });
    }

    const substituido = Boolean(existente) || Number(dep?.substituidos || 0) > 0;
    return {
      ok: Boolean(dep?.ok),
      substituido,
      substituidos: Number(dep?.substituidos || 0),
      entry: dep?.entry,
      naNuvem: dep?.naNuvem,
      protocolo,
      nomeArquivo,
    };
  }

  function abrirPreviewContrato(dados) {
    const msgEl = document.getElementById("operacaoLocacaoInlineMsg");
    const dadosFinal = garantirDadosContratoComEndereco(dados);
    const html = buildContratoPreviewHtml(dadosFinal);
    /* Volta o fluxo original: janela com o contrato de 10 páginas já formatado
       para impressão (document.write). O pacote de 4 docs não substitui isto. */
    const popup = window.open("", "_blank", "width=920,height=1000");
    if (!popup) {
      if (msgEl) msgEl.textContent = "O navegador bloqueou a janela — permita pop-ups para gerar o contrato.";
      return false;
    }
    popup.document.write(html);
    popup.document.close();
    popup.focus();
    if (msgEl) {
      msgEl.textContent = `Contrato ${dadosFinal.protocolo} — 10 páginas formatadas. Clique «Imprimir» na janela.`;
    }
    return true;
  }

  async function visualizarContratoArmazenado(protocolo) {
    const msgEl = document.getElementById("operacaoLocacaoInlineMsg");
    const entrada = obterContratoDeposito(protocolo);
    if (!entrada) {
      if (msgEl) msgEl.textContent = "Contrato ainda não gerado — clique em «Gerar contrato».";
      atualizarBotaoContratoLocacao();
      return { ok: false, msg: "nao_existe" };
    }
    const obter =
      typeof window.__DK_documentosObterBlobDoc === "function" ? window.__DK_documentosObterBlobDoc : null;
    if (!obter) {
      if (msgEl) msgEl.textContent = "Visualização de documentos indisponível.";
      return { ok: false };
    }
    try {
      const row = await obter("contrato", entrada.id);
      if (!row?.blob) {
        if (msgEl) {
          msgEl.textContent =
            "Contrato registado mas ficheiro indisponível — aguarde sincronização da nuvem ou gere de novo.";
        }
        return { ok: false, msg: "blob_ausente" };
      }
      const abrirPdf =
        typeof window.__DK_documentosAbrirDocPdfViewer === "function"
          ? window.__DK_documentosAbrirDocPdfViewer
          : null;
      if (abrirPdf) {
        await abrirPdf("contrato", entrada.id);
      } else {
        const abrir =
          typeof window.__DK_documentosAbrirViewerBlob === "function"
            ? window.__DK_documentosAbrirViewerBlob
            : null;
        const nomePdf = nomeArquivoContrato(protocolo);
        if (abrir) {
          abrir(row.blob, nomePdf || entrada.nomeArquivo || `${protocolo}.pdf`, entrada.mimeType || row.mimeType || "application/pdf");
        } else {
          const url = URL.createObjectURL(row.blob);
          window.open(url, "_blank", "noopener");
          window.setTimeout(() => URL.revokeObjectURL(url), 120000);
        }
      }
      if (msgEl) msgEl.textContent = `Contrato do protocolo ${protocolo} aberto.`;
      return { ok: true, entrada };
    } catch (e) {
      if (msgEl) msgEl.textContent = `Erro ao abrir contrato: ${e?.message || e}`;
      return { ok: false, msg: String(e?.message || e) };
    }
  }

  function atualizarBotaoContratoLocacao() {
    const btn = document.getElementById("operacaoLocacaoVisualizarContratoBtn");
    const hid = document.getElementById("operacaoLocacaoProtocolo");
    if (!btn) return;
    const proto = normProtocolo(hid?.value);
    const dados = resolverDadosFromForm();
    const can = Boolean(proto) && !validarDados(dados);
    btn.disabled = !can;
    if (!can) {
      btn.textContent = "Gerar contrato";
      btn.dataset.dkModo = "gerar";
      btn.title = "Preencha protocolo, CPF, cliente e placa para gerar o contrato.";
      return;
    }
    btn.textContent = "Gerar contrato";
    btn.dataset.dkModo = "gerar";
    btn.title = `Abrir o contrato formatado (10 páginas) do protocolo ${proto} para imprimir.`;
  }

  function hidratarCamposClienteParaContrato(cpfDigits) {
    const d = onlyDigits(cpfDigits);
    if (d.length !== 11) return;
    const locCpf = onlyDigits(document.getElementById("operacaoLocacaoCpf")?.value);
    if (locCpf !== d) return;
    const fontes = [];
    const push = (obj) => {
      if (obj && typeof obj === "object") fontes.push(obj);
    };
    if (typeof window.__DK_getClienteByCpfAny === "function") push(window.__DK_getClienteByCpfAny(d));
    push(clienteCadastroLocalPorCpf(d));
    push(clienteEmbutidoPorCpf(d));
    push(loadCliente(d));
    const endereco = pickCampoEnderecoValido(
      ...fontes.map((f) => f?.endereco),
      ...fontes.map((f) => f?.enderecoBase),
      ...fontes.map((f) => f?.logradouro)
    );
    const municipioUf = pickCampoEnderecoValido(
      ...fontes.map((f) => f?.municipioUf),
      ...fontes.map((f) => f?.municipio)
    );
    const cep = pickCampoEnderecoValido(...fontes.map((f) => f?.cep));
    const setVal = (id, val) => {
      const el = document.getElementById(id);
      if (!el || !val) return;
      el.value = val;
    };
    if (typeof formatCpf === "function") {
      const cpfEl = document.getElementById("operacaoClienteCpf");
      if (cpfEl) cpfEl.value = formatCpf(d);
    }
    setVal("operacaoClienteEndereco", endereco);
    setVal("operacaoClienteMunicipioUf", municipioUf);
    setVal("operacaoClienteCep", cep);
  }

  window.__DK_contratoLocacaoResolverFromForm = resolverDadosFromForm;
  window.__DK_contratoLocacaoResolverFromLoc = resolverDadosFromLoc;
  window.__DK_resolverEnderecoClienteContrato = resolverEnderecoContrato;
  window.__DK_formatEnderecoContratoLocatario = formatEnderecoContratoLocatario;
  window.__DK_contratoLocacaoCssPagina = cssContratoPagina;
  window.__DK_contratoLocacaoBuildHtml = buildContratoPreviewHtml;
  window.__DK_contratoLocacaoBuildPaginasKit = buildPaginasHtml;
  window.__DK_contratoLocacaoSnapshotDados = snapshotContratoDados;
  window.__DK_contratoLocacaoPdfMaxBytes = PDF_LOCACAO_MAX_BYTES;
  window.__DK_contratoLocacaoSalvarPdfBlob = salvarPdfBlobNoDeposito;
  window.__DK_contratoLocacaoExisteParaProtocolo = contratoExisteParaProtocolo;
  window.__DK_contratoLocacaoVerificarExistente = verificarContratoExistente;
  window.__DK_contratoLocacaoAbrirComparacao = abrirComparacaoContrato;
  window.__DK_contratoLocacaoVisualizarArmazenado = visualizarContratoArmazenado;
  window.__DK_contratoLocacaoSincronizarPasta = sincronizarPastaContratoLocacao;
  window.__DK_contratoLocacaoRefreshBotao = atualizarBotaoContratoLocacao;

  document.getElementById("operacaoLocacaoVisualizarContratoBtn")?.addEventListener("click", (e) => {
    e.preventDefault();
    const msgEl = document.getElementById("operacaoLocacaoInlineMsg");
    const cpfDigits = onlyDigits(document.getElementById("operacaoLocacaoCpf")?.value);
    hidratarCamposClienteParaContrato(cpfDigits);
    const dados = resolverDadosFromForm();
    const err = validarDados(dados);
    if (err) {
      if (msgEl) msgEl.textContent = err;
      return;
    }
    abrirPreviewContrato(dados);
  });

  atualizarBotaoContratoLocacao();
  window.addEventListener("storage", (ev) => {
    if (ev.key === "dk_documentos_deposito_v1") atualizarBotaoContratoLocacao();
  });
})();
