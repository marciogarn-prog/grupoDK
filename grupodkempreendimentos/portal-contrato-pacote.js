/**
 * Pacote de documentos da locação — Opção contratada, Promessa, Requerimento + Contrato.
 * «Gerar contrato» abre o pacote com os 4 documentos preenchidos.
 */
(function portalContratoPacote() {
  "use strict";

  const CNPJ_DK = "59.665.734/0001-32";
  /** Requerimento = PDF modelo oficial (sem edição de layout). */
  const REQUERIMENTO_MODELO_URL = (() => {
    try {
      return new URL("modelos/requerimento-padrao-detran.pdf", window.location.href).href;
    } catch {
      return "modelos/requerimento-padrao-detran.pdf";
    }
  })();
  const DOCS = [
    { id: "contrato", titulo: "1. Contrato de locação (10 págs)", kitTipo: "contrato", arquivo: (p) => `${p}.pdf` },
    { id: "opcao", titulo: "2. Opção contratada", kitTipo: "opcao", arquivo: (p) => `${p}-opcao-contratada.pdf` },
    { id: "promessa", titulo: "3. Promessa de compra e venda", kitTipo: "promessa", arquivo: (p) => `${p}-promessa-compra.pdf` },
    {
      id: "requerimento",
      titulo: "4. Requerimento padrão DETRAN (modelo oficial)",
      kitTipo: "requerimento",
      arquivo: (p) => `${p}-requerimento.pdf`,
      modeloPdf: true,
    },
  ];

  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function onlyDigits(s) {
    return String(s ?? "").replace(/\D/g, "");
  }

  function normPlaca(raw) {
    return String(raw || "")
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 7);
  }

  function normProtocolo(raw) {
    return String(raw || "")
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "");
  }

  function loadCliente(cpfDigits) {
    const d = onlyDigits(cpfDigits);
    if (d.length !== 11) return null;
    try {
      if (typeof window.__DK_getClienteByCpfAny === "function") {
        const hit = window.__DK_getClienteByCpfAny(d);
        if (hit) return hit;
      }
    } catch {
      /* ignore */
    }
    try {
      if (typeof window.loadCadastro === "function") {
        const list = window.loadCadastro("dk_clientes_cadastro") || [];
        return list.find((c) => onlyDigits(c.cpf) === d) || null;
      }
    } catch {
      /* ignore */
    }
    return null;
  }

  function loadVeiculo(placa) {
    const p = normPlaca(placa);
    if (!p) return null;
    try {
      if (typeof window.findVeiculoByPlaca === "function") return window.findVeiculoByPlaca(p) || null;
      if (typeof window.loadCadastro === "function") {
        const list = window.loadCadastro("dk_veiculos_cadastro") || [];
        return list.find((v) => normPlaca(v.placa) === p) || null;
      }
    } catch {
      /* ignore */
    }
    return null;
  }

  function pick(obj, keys, fallback = "") {
    for (const k of keys) {
      const v = obj?.[k];
      if (v != null && String(v).trim()) return String(v).trim();
    }
    return fallback;
  }

  function parseReaisNum(raw) {
    if (typeof window.parseCurrencyBR === "function") {
      const n = window.parseCurrencyBR(raw);
      if (Number.isFinite(n) && n >= 0) return n;
    }
    const s = String(raw || "")
      .replace(/[^\d,.-]/g, "")
      .replace(/\./g, "")
      .replace(",", ".");
    const n = Number(s);
    return Number.isFinite(n) ? n : 0;
  }

  function formatReaisBr(num) {
    const n = Math.round((Number(num) || 0) * 100) / 100;
    const [i, d] = n.toFixed(2).split(".");
    return `R$ ${i.replace(/\B(?=(\d{3})+(?!\d))/g, ".")},${d}`;
  }

  function extensoInt(n) {
    const u = [
      "zero",
      "um",
      "dois",
      "três",
      "quatro",
      "cinco",
      "seis",
      "sete",
      "oito",
      "nove",
      "dez",
      "onze",
      "doze",
      "treze",
      "quatorze",
      "quinze",
      "dezesseis",
      "dezessete",
      "dezoito",
      "dezenove",
    ];
    const d = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
    const c = [
      "",
      "cento",
      "duzentos",
      "trezentos",
      "quatrocentos",
      "quinhentos",
      "seiscentos",
      "setecentos",
      "oitocentos",
      "novecentos",
    ];
    const x = Math.max(0, Math.floor(Number(n) || 0));
    if (x < 20) return u[x];
    if (x < 100) return d[Math.floor(x / 10)] + (x % 10 ? " e " + u[x % 10] : "");
    if (x === 100) return "cem";
    if (x < 1000) return c[Math.floor(x / 100)] + (x % 100 ? " e " + extensoInt(x % 100) : "");
    const mil = Math.floor(x / 1000);
    const rest = x % 1000;
    const milTxt = mil === 1 ? "mil" : extensoInt(mil) + " mil";
    if (!rest) return milTxt;
    return milTxt + (rest < 100 ? " e " : " ") + extensoInt(rest);
  }

  function reaisPorExtenso(num) {
    const n = Math.round((Number(num) || 0) * 100) / 100;
    const inteiro = Math.floor(n);
    const cents = Math.round((n - inteiro) * 100);
    let s = extensoInt(inteiro) + (inteiro === 1 ? " real" : " reais");
    if (cents) s += " e " + extensoInt(cents) + (cents === 1 ? " centavo" : " centavos");
    return s;
  }

  function formatFoneOpcao(raw) {
    const d = onlyDigits(raw);
    if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
    if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
    return String(raw || "").trim() || "—";
  }

  function formatOdometroOpcao(raw) {
    const d = String(raw || "").replace(/\D/g, "");
    if (!d) return "—";
    return `${d.padStart(6, "0")} Km(s)`;
  }

  function formatTagOpcao(raw) {
    if (typeof window.displayDkVeiculoTag === "function") {
      const t = window.displayDkVeiculoTag(raw);
      if (t) return t;
    }
    return String(raw || "").trim() || "—";
  }

  function formatEarOpcao(raw) {
    const s = String(raw || "")
      .trim()
      .toUpperCase()
      .normalize("NFD")
      .replace(/\p{M}/gu, "");
    if (s === "SIM" || s === "S") return "SIM";
    if (s === "NAO" || s === "N") return "NÃO";
    return String(raw || "").trim() || "—";
  }

  function parseBrDateOpcao(raw) {
    if (typeof window.parseBrDate === "function") return window.parseBrDate(raw);
    const m = String(raw || "").trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!m) return null;
    const dt = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
    return Number.isNaN(dt.getTime()) ? null : dt;
  }

  function formatDataBrOpcao(dt) {
    if (!dt || Number.isNaN(dt.getTime())) return "";
    const dd = String(dt.getDate()).padStart(2, "0");
    const mm = String(dt.getMonth() + 1).padStart(2, "0");
    return `${dd}/${mm}/${dt.getFullYear()}`;
  }

  function somarSemanas(dt, semanas) {
    const d = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
    d.setDate(d.getDate() + Number(semanas) * 7);
    return d;
  }

  function loadLocacaoByProtocolo(protocolo) {
    const p = normProtocolo(protocolo);
    if (!p) return null;
    try {
      if (typeof window.loadCadastro === "function") {
        const list = window.loadCadastro("dk_locacoes_cadastro") || [];
        return list.find((l) => normProtocolo(l.numeroContrato) === p) || null;
      }
    } catch {
      /* ignore */
    }
    return null;
  }

  /** Enriquece dados do contrato com frota/cliente/valores da ficha de locação. */
  function enriquecerDadosPacote(dados) {
    const base = { ...(dados || {}) };
    const loc = loadLocacaoByProtocolo(base.protocolo) || {};
    const cliente = loadCliente(base.cpfDigits);
    const veiculo = loadVeiculo(base.placa);
    const aluguelNum = parseReaisNum(
      document.getElementById("operacaoLocacaoValorAluguel")?.value ||
        pick(base, ["valorAluguel", "valorLocacao"]) ||
        pick(loc, ["valorLocacao", "valorAluguel"])
    );
    const invNum = parseReaisNum(
      document.getElementById("operacaoLocacaoValorInvestimento")?.value ||
        pick(base, ["valorInvestimento"]) ||
        pick(loc, ["valorInvestimento"])
    );
    const semanalNum = aluguelNum + invNum;
    const inicioRaw =
      pick(base, ["dataContrato"]) ||
      pick(loc, ["inicio"]) ||
      String(document.getElementById("operacaoLocacaoDataInicio")?.value || "").trim();
    const inicioDt = parseBrDateOpcao(inicioRaw) || base.dataContratoDt || new Date();
    const fimRaw =
      String(document.getElementById("operacaoLocacaoDataFim")?.value || "").trim() ||
      pick(base, ["fim"]) ||
      pick(loc, ["fim"]);
    const fimDt = parseBrDateOpcao(fimRaw) || somarSemanas(inicioDt, 150);
    let periodo = 150;
    if (parseBrDateOpcao(fimRaw)) {
      const days = Math.round((fimDt.getTime() - inicioDt.getTime()) / 86400000);
      periodo = Math.max(1, Math.round(days / 7));
    }
    const diaPag =
      String(document.getElementById("operacaoLocacaoDiaPagamento")?.value || "").trim() ||
      pick(loc, ["diaPagto", "diaPagamento"]) ||
      (inicioDt ? ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"][inicioDt.getDay()] : "quinta-feira");

    const marca = pick(veiculo, ["marca"], "");
    const modelo = pick(veiculo, ["modelo"], "") || pick(base, ["marcaModelo"], "");
    const marcaModelo = marca && modelo ? `${marca.toUpperCase()} / ${modelo.toUpperCase()}` : String(base.marcaModelo || modelo || marca || "—").toUpperCase();

    const kmRaw =
      String(document.getElementById("operacaoLocacaoOdometroInicio")?.value || "").trim() ||
      pick(base, ["odometroInicio", "kmInicial"]) ||
      pick(loc, ["kmInicial", "odometroInicio"]) ||
      pick(veiculo, ["km", "odometro", "kmAtual"]);

    const codigoVeiculo = formatTagOpcao(pick(veiculo, ["tag", "codigo", "idInterno", "codigoVeiculo"], "—"));
    const fotoSrc = pick(veiculo, ["fotoUrl", "foto", "imagem", "photoUrl"], "");
    const fotoHtml = fotoSrc
      ? `<img src="${esc(fotoSrc)}" alt="Veículo" crossorigin="anonymous">`
      : "";

    const enderecoParts = {
      logradouro: pick(cliente, ["logradouro", "endereco", "rua"], ""),
      numero: pick(cliente, ["numero", "num"], ""),
      bairro: pick(cliente, ["bairro"], ""),
      cep: pick(cliente, ["cep"], ""),
      cidade: pick(cliente, ["cidade", "municipio"], "Petrolina"),
      uf: pick(cliente, ["uf", "estado"], "PE"),
    };

    const codigoCliente =
      (typeof window.formatClienteCodigoPadrao === "function"
        ? window.formatClienteCodigoPadrao(base.codigoCliente || cliente?.codigo)
        : "") ||
      String(base.codigoCliente || cliente?.codigo || "0000").trim();

    return {
      ...base,
      nome: String(base.nome || "").toUpperCase(),
      cpfFmt: base.cpfFmt || "",
      endereco: base.endereco || "—",
      placa: normPlaca(base.placa),
      marcaModelo,
      modalidade: base.modalidade || pick(loc, ["plano", "opcaoContrato"], "DK MEU TRANSPORTE"),
      codigoCliente,
      municipioData: base.municipioData || "",
      chassi: pick(veiculo, ["chassi"], "—").toUpperCase(),
      renavam: pick(veiculo, ["renavam"], "—"),
      cor: pick(veiculo, ["cor"], "—").toUpperCase(),
      anoModelo: pick(veiculo, ["anoModelo", "ano"], "—"),
      codigoVeiculo,
      km: formatOdometroOpcao(kmRaw),
      celular: formatFoneOpcao(pick(cliente, ["celular", "telefone", "fone", "whatsapp"], "—")),
      recado1: formatFoneOpcao(pick(cliente, ["recado1", "recados01", "recado01"], "—")),
      recado2: formatFoneOpcao(pick(cliente, ["recado2", "recados02", "recado02"], "—")),
      cnh: pick(cliente, ["cnh", "numeroCnh", "registroCnh"], "—"),
      cnhCategoria: pick(cliente, ["categoria", "cnhCategoria", "categoriaCnh"], "—").toUpperCase(),
      cnhValidade: pick(cliente, ["vencimento", "cnhValidade", "validadeCnh"], "—"),
      ear: formatEarOpcao(pick(cliente, ["ear"], "—")),
      rg: pick(cliente, ["rg", "identidade"], "—"),
      email: pick(cliente, ["email", "eMail"], "—"),
      cep: enderecoParts.cep || "—",
      bairro: enderecoParts.bairro || "—",
      cidade: enderecoParts.cidade,
      uf: enderecoParts.uf,
      proprietario: pick(base, ["proprietario"]) || pick(veiculo, ["proprietario"], "—"),
      proprietarioCpfCnpj:
        pick(base, ["proprietarioCpfCnpj"]) ||
        (typeof window.__DK_formatPortalCpfCnpjExibicao === "function"
          ? window.__DK_formatPortalCpfCnpjExibicao(
              pick(veiculo, ["proprietarioCpfCnpj", "cpfCnpjProprietario", "cpfCnpj"])
            )
          : pick(veiculo, ["proprietarioCpfCnpj", "cpfCnpjProprietario", "cpfCnpj"], "—")) ||
        "—",
      municipioVeiculo: pick(veiculo, ["local", "municipio", "municipioUf", "cidade"], "—"),
      valorAluguel: formatReaisBr(aluguelNum),
      valorInvestimento: formatReaisBr(invNum),
      valorSemanal: formatReaisBr(semanalNum),
      valorAluguelExtenso: reaisPorExtenso(aluguelNum),
      valorInvestimentoExtenso: reaisPorExtenso(invNum),
      valorSemanalExtenso: reaisPorExtenso(semanalNum),
      valorCompra: "R$ 20,00",
      valorCompraExtenso: "vinte reais",
      periodoSemanas: String(periodo),
      diaPagamento: diaPag || "quinta-feira",
      dataInicio: formatDataBrOpcao(inicioDt),
      dataFim: formatDataBrOpcao(fimDt),
      fotoVeiculoHtml: fotoHtml,
      cnpjDk: CNPJ_DK,
    };
  }

  function logoPacoteUrl() {
    try {
      return new URL("images/dk-locadora-logo.png", window.location.href).href;
    } catch {
      return "images/dk-locadora-logo.png";
    }
  }

  function substituirPacote(html, d) {
    const map = {
      "{{NOME}}": d.nome,
      "{{CPF}}": d.cpfFmt,
      "{{ENDERECO}}": d.endereco,
      "{{PROTOCOLO}}": d.protocolo || "**********",
      "{{PLACA}}": d.placa,
      "{{MARCA_MODELO}}": d.marcaModelo,
      "{{CHASSI}}": d.chassi,
      "{{RENAVAM}}": d.renavam,
      "{{COR}}": d.cor,
      "{{ANO_MODELO}}": d.anoModelo,
      "{{MODALIDADE}}": d.modalidade,
      "{{CODIGO_CLIENTE}}": d.codigoCliente,
      "{{CELULAR}}": d.celular,
      "{{CNH}}": d.cnh,
      "{{MUNICIPIO_DATA}}": d.municipioData,
      "{{VALOR_ALUGUEL}}": d.valorAluguel,
      "{{VALOR_INVESTIMENTO}}": d.valorInvestimento,
      "{{KM}}": d.km,
      "{{CODIGO_VEICULO}}": d.codigoVeiculo,
      "{{RG}}": d.rg,
      "{{CEP}}": d.cep,
      "{{BAIRRO}}": d.bairro,
      "{{CIDADE}}": d.cidade,
      "{{UF}}": d.uf,
      "{{EMAIL}}": d.email,
      "{{CNH_CATEGORIA}}": d.cnhCategoria,
      "{{CNH_VALIDADE}}": d.cnhValidade,
      "{{EAR}}": d.ear,
      "{{RECADO1}}": d.recado1,
      "{{RECADO2}}": d.recado2,
      "{{PROPRIETARIO}}": d.proprietario,
      "{{CPF_CNPJ_PROP}}": d.proprietarioCpfCnpj,
      "{{MUNICIPIO_VEICULO}}": d.municipioVeiculo,
      "{{PERIODO_SEMANAS}}": d.periodoSemanas,
      "{{VALOR_ALUGUEL_EXTENSO}}": d.valorAluguelExtenso,
      "{{VALOR_INVESTIMENTO_EXTENSO}}": d.valorInvestimentoExtenso,
      "{{VALOR_SEMANAL}}": d.valorSemanal,
      "{{VALOR_SEMANAL_EXTENSO}}": d.valorSemanalExtenso,
      "{{VALOR_COMPRA}}": d.valorCompra,
      "{{VALOR_COMPRA_EXTENSO}}": d.valorCompraExtenso,
      "{{DIA_PAGAMENTO}}": d.diaPagamento,
      "{{DATA_INICIO}}": d.dataInicio,
      "{{DATA_FIM}}": d.dataFim,
      "{{FOTO_VEICULO}}": d.fotoVeiculoHtml,
      "{{LOGO_URL}}": logoPacoteUrl(),
    };
    let out = String(html || "");
    for (const [k, v] of Object.entries(map)) {
      /* LOGO_URL and FOTO_VEICULO are trusted same-origin HTML/URL — do not escape. */
      const raw = k === "{{LOGO_URL}}" || k === "{{FOTO_VEICULO}}";
      out = out.split(k).join(raw ? String(v || "") : esc(v));
    }
    return out;
  }

  function cssOpcao() {
    return `
.pagina.pagina-opcao {
  padding: 8mm 12mm 16mm;
  height: 297mm;
  min-height: 297mm;
  max-height: 297mm;
  overflow: hidden;
  font-family: Arial, Helvetica, sans-serif;
  font-size: 8.8pt;
  line-height: 1.25;
  color: #000;
  background: #fff;
}
.opcao-doc { width: 100%; }
.opcao-cab {
  display: grid;
  grid-template-columns: 38mm 1fr 42mm;
  gap: 4mm;
  align-items: start;
  margin: 0 0 3mm;
}
.opcao-logo {
  display: block;
  width: 36mm;
  height: auto;
  max-height: 18mm;
  object-fit: contain;
  object-position: left top;
}
.opcao-cab-centro { text-align: center; padding-top: 0.5mm; }
.opcao-cab-centro h1 {
  margin: 0 0 2.2mm;
  font-size: 16pt;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}
.opcao-plano {
  background: linear-gradient(90deg, #7cb342 0%, #dcedc8 72%, #fff 100%);
  border: 1px solid #558b2f;
  font-weight: 700;
  font-size: 11pt;
  padding: 1.6mm 3mm;
  text-align: center;
}
.opcao-proto {
  margin: 2mm 0 0;
  font-size: 10.5pt;
  font-weight: 700;
}
.opcao-foto {
  min-height: 22mm;
  border: 1px solid #bbb;
  background: #f7f7f7;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}
.opcao-foto:empty { display: none; }
.opcao-foto img { width: 100%; height: 22mm; object-fit: cover; display: block; }
.opcao-eu { margin: 1.5mm 0 0.6mm; font-size: 10pt; }
.opcao-nome {
  margin: 0 0 1.6mm;
  font-size: 13pt;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.02em;
}
.opcao-grid {
  display: grid;
  gap: 0;
  margin: 0 0 0;
  border-left: 1px solid #111;
  border-top: 1px solid #111;
}
.opcao-grid--2 { grid-template-columns: 1fr 1.4fr; }
.opcao-grid--3 { grid-template-columns: 1fr 1fr 1fr; }
.opcao-grid--cnh { grid-template-columns: 1fr; }
.opcao-grid--veic1 { grid-template-columns: 0.9fr 0.8fr 1.6fr 0.9fr; }
.opcao-grid--veic2 { grid-template-columns: 1.4fr 1fr 0.8fr 0.8fr; }
.opcao-grid--veic3 { grid-template-columns: 1.4fr 1fr 1fr; }
.opcao-cell {
  border-right: 1px solid #111;
  border-bottom: 1px solid #111;
  padding: 1.3mm 2mm;
  min-height: 7.2mm;
}
.opcao-cell span {
  font-weight: 700;
  margin-right: 1.5mm;
}
.opcao-cell--span { grid-column: 1 / -1; }
.opcao-frase { margin: 2.4mm 0 1.6mm; }
.opcao-cond { list-style: none; margin: 0 0 2mm; padding: 0; }
.opcao-cond li {
  display: flex;
  align-items: center;
  gap: 3mm;
  margin: 0 0 1.4mm;
}
.opcao-chev {
  color: #c62828;
  font-weight: 700;
  min-width: 78mm;
}
.opcao-chev::before { content: "▸ "; color: #c62828; }
.opcao-val {
  border: 1px solid #111;
  padding: 1mm 2.5mm;
  min-width: 62mm;
  font-weight: 700;
}
.opcao-garantia { margin: 1mm 0 2mm; text-align: justify; }
.opcao-atencao {
  border: 1px solid #111;
  padding: 2mm 3mm;
  margin: 0 0 2.5mm;
  text-align: justify;
  font-size: 8.4pt;
}
.opcao-obs-tit { margin: 0 0 1mm; }
.opcao-obs { margin: 0 0 3mm; }
.opcao-chev-inline { color: #c62828; font-weight: 700; margin-right: 1.5mm; }
.opcao-termo {
  border: 1px solid #111;
  padding: 2.5mm 3.5mm 3mm;
  margin: 0 0 5mm;
}
.opcao-termo h2 {
  margin: 0 0 2mm;
  text-align: center;
  text-decoration: underline;
  font-size: 11pt;
}
.opcao-termo p { margin: 0; text-align: justify; }
.opcao-data {
  text-align: center;
  font-weight: 700;
  margin: 2mm 0 6mm;
  font-size: 10pt;
}
.opcao-sigs {
  display: flex;
  justify-content: space-between;
  gap: 16mm;
  width: 100%;
}
.opcao-sig { flex: 1 1 0; text-align: center; min-width: 0; }
.opcao-sig-line {
  width: 100%;
  border-bottom: 1.1pt solid #111;
  height: 10mm;
  margin: 0 0 2mm;
}
.opcao-sig-name { margin: 0; font-weight: 700; font-size: 9pt; }
.opcao-sig-id { margin: 1mm 0 0; font-weight: 700; font-size: 8.5pt; }
.pe-pagina.pe-opcao {
  left: 12mm; right: 12mm; bottom: 6.5mm;
  font-size: 7.5pt; color: #333;
  font-family: Arial, Helvetica, sans-serif;
  border-top: 0;
}
`;
  }

  function cssKit() {
    const cssContratoPag =
      typeof window.__DK_contratoLocacaoCssPagina === "function" ? window.__DK_contratoLocacaoCssPagina() : "";
    return `
@page { size: A4 portrait; margin: 0; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: #1a1a1a; color: #111; font-family: "Times New Roman", Times, serif; }
body.kit-preview { padding-top: 58px; }
.barra-acoes {
  position: fixed; top: 0; left: 0; right: 0; z-index: 999;
  background: #1a1a1a; color: #fff; padding: 10px 14px;
  display: flex; flex-wrap: wrap; align-items: center; gap: 8px;
}
.barra-acoes button {
  padding: 8px 14px; cursor: pointer; border: 0; border-radius: 4px;
  background: #e85d04; color: #fff; font-weight: 600; font-size: 13px;
}
.barra-acoes button.sec { background: #444; }
.barra-acoes button:disabled { opacity: 0.5; cursor: wait; }
.barra-msg { font-size: 13px; color: #ddd; flex: 1 1 220px; }
.kit-shell { width: 210mm; margin: 12px auto 28px; }
.kit-secao-titulo {
  width: 210mm; margin: 18px auto 8px; padding: 8px 12px;
  background: #111; color: #fff; font-family: system-ui, sans-serif;
  font-size: 13px; font-weight: 700; letter-spacing: 0.03em;
  border-radius: 4px;
}
.pagina {
  position: relative; width: 210mm; min-height: 297mm; margin: 0 auto 14px;
  padding: 14mm 14mm 18mm; background: #fff; color: #111;
  box-shadow: 0 2px 12px rgba(0,0,0,0.35);
  page-break-after: always; break-after: page;
}
.pagina:last-child { page-break-after: auto; break-after: auto; }
.kit-doc { font-size: 10.5pt; line-height: 1.35; }
.kit-title { text-align: center; font-size: 13pt; margin: 0 0 10px; text-decoration: underline; }
.kit-proto { text-align: right; margin: 0 0 12px; }
.kit-opcao__head { text-align: center; margin-bottom: 12px; border-bottom: 2px solid #111; padding-bottom: 8px; }
.kit-opcao__head h1 { margin: 0 0 6px; font-size: 14pt; letter-spacing: 0.04em; }
.kit-box { border: 1px solid #333; padding: 8px 10px; margin-bottom: 10px; }
.kit-box h2 { margin: 0 0 6px; font-size: 11pt; }
.kit-grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 14px; }
.kit-grid2 p { margin: 0; }
.kit-grid2 span { display: block; font-size: 8pt; color: #444; text-transform: uppercase; }
.kit-grid2 strong { font-size: 10.5pt; }
.kit-span2 { grid-column: 1 / -1; }
.kit-termo, .kit-data, .kit-fine, .kit-hint, .kit-motivo { margin: 10px 0; text-align: justify; }
.kit-check { margin: 4px 0; }
.kit-check__mark { color: #111; font-weight: 700; margin-right: 6px; }
.kit-lista { margin: 6px 0 12px 18px; }
.kit-req__dest { font-size: 10pt; margin-bottom: 12px; }
.sig-area {
  display: flex; justify-content: space-between; gap: 18mm;
  margin-top: 28px; width: 100%;
}
.sig-col { flex: 1 1 0; min-width: 0; text-align: center; }
.sig-rule { width: 100%; border-bottom: 1.2pt solid #111; height: 22px; margin: 0 0 6px; }
.sig-name { margin: 0; font-size: 9pt; font-weight: 700; }
.sig-id { margin: 2px 0 0; font-size: 8.5pt; }
.pe-pagina {
  position: absolute; bottom: 8mm; left: 14mm; right: 14mm;
  display: flex; justify-content: space-between; font-size: 8pt; color: #444;
  border-top: 1px solid #ccc; padding-top: 3px;
}
/* —— Promessa (modelo oficial SISLOC) —— */
.pagina.pagina-promessa {
  padding: 18mm 20mm 22mm;
  height: 297mm;
  min-height: 297mm;
  max-height: 297mm;
  overflow: hidden;
  font-family: Arial, Helvetica, "Segoe UI", sans-serif;
}
.pagina.pagina-promessa .corpo { height: 100%; }
.kit-promessa {
  font-family: Arial, Helvetica, "Segoe UI", sans-serif;
  font-size: 9.6pt;
  line-height: 1.28;
  color: #000;
}
.kit-promessa__cab {
  position: relative;
  text-align: center;
  min-height: 16mm;
  margin: 0 0 7mm;
  padding: 0 0 0 30mm;
}
.kit-promessa__logo {
  position: absolute;
  left: 0;
  top: 0;
  display: block;
  width: 26mm;
  height: auto;
  max-height: 15mm;
  object-fit: contain;
  object-position: left top;
}
.kit-promessa__cab-txt { text-align: center; padding-top: 0.5mm; }
.kit-promessa__titulo {
  margin: 0;
  font-size: 11.2pt;
  font-weight: 700;
  text-decoration: underline;
  text-underline-offset: 2px;
  letter-spacing: 0.01em;
  line-height: 1.25;
}
.kit-promessa__proto {
  margin: 2.5mm 0 0;
  font-size: 10pt;
  text-align: center;
  font-weight: 400;
}
.kit-promessa__p {
  margin: 0 0 2.4mm;
  text-align: justify;
  text-justify: inter-word;
  hyphens: auto;
}
.kit-promessa__h2 {
  margin: 3.2mm 0 1.6mm;
  font-size: 10pt;
  font-weight: 700;
  text-align: left;
}
.kit-promessa__veiculo {
  display: grid;
  grid-template-columns: 1.35fr 1.1fr 0.85fr 0.95fr;
  grid-template-areas:
    "placa placa marca marca"
    "chassi renavam cor ano";
  column-gap: 6mm;
  row-gap: 2.2mm;
  margin: 2mm 0 3.5mm;
}
.kit-promessa__campo--placa { grid-area: placa; }
.kit-promessa__campo--marca { grid-area: marca; }
.kit-promessa__campo--chassi { grid-area: chassi; }
.kit-promessa__campo--renavam { grid-area: renavam; }
.kit-promessa__campo--cor { grid-area: cor; }
.kit-promessa__campo--ano { grid-area: ano; }
.kit-promessa__campo-lbl {
  display: block;
  font-size: 9pt;
  font-weight: 400;
  margin-bottom: 0.6mm;
}
.kit-promessa__campo-box {
  font-size: 9.5pt;
  letter-spacing: 0.02em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  border-bottom: 1px solid #111;
  padding: 0 0 1px;
  line-height: 1.35;
}
.kit-promessa__campo-box strong { font-weight: 700; }
.kit-promessa--p2 { padding-top: 2mm; }
.kit-promessa__fecho {
  margin: 8mm 0 0;
  text-align: left;
}
.kit-promessa__data {
  margin: 14mm 0 0;
  text-align: center;
  font-size: 10pt;
}
.kit-promessa__sigs {
  display: flex;
  justify-content: space-between;
  gap: 16mm;
  margin-top: 18mm;
  width: 100%;
}
.kit-promessa__sig { flex: 1 1 0; min-width: 0; text-align: center; }
.kit-promessa__sig-line {
  width: 100%;
  border-bottom: 1.15pt solid #111;
  height: 10mm;
  margin: 0 0 2.5mm;
}
.kit-promessa__sig-name { margin: 0; font-size: 9.5pt; }
.kit-promessa__sig-id { margin: 1.5mm 0 0; font-size: 9pt; }
.pe-pagina.pe-promessa {
  left: 20mm; right: 20mm; bottom: 10mm;
  font-size: 8pt; color: #222;
  border-top: 1px solid #333; padding-top: 2.5px;
  font-family: Arial, Helvetica, sans-serif;
}
.pagina.kit-pdf-pagina {
  padding: 0;
  display: flex;
  align-items: stretch;
  justify-content: center;
  overflow: hidden;
}
.pagina.kit-pdf-pagina canvas {
  display: block;
  width: 210mm;
  height: 297mm;
}
.kit-pdf-loading {
  margin: 40% auto 0;
  text-align: center;
  font-family: system-ui, sans-serif;
  font-size: 14px;
  color: #444;
}
${cssContratoPag}
${cssOpcao()}
@media print {
  html, body { background: #fff !important; }
  body.kit-preview { padding-top: 0 !important; background: #fff; }
  .barra-acoes, .kit-secao-titulo { display: none !important; }
  .kit-shell { width: auto; margin: 0; }
  .pagina {
    box-shadow: none; margin: 0;
    page-break-after: always; break-after: page;
  }
  .pagina:last-child { page-break-after: auto; break-after: auto; }
}
`;
  }

  function buildPaginasDoc(docId, d) {
    if (docId === "contrato") {
      const corpos = window.__DK_CONTRATO_LOCACAO_CORPOS;
      if (!Array.isArray(corpos) || corpos.length !== 10) {
        throw new Error("Modelo de contrato (10 páginas) indisponível.");
      }
      const buildFn = window.__DK_contratoLocacaoBuildPaginasKit;
      if (typeof buildFn === "function") return buildFn(d);
      throw new Error("Helper de páginas do contrato indisponível.");
    }
    if (docId === "opcao") {
      const html = substituirPacote(window.__DK_CONTRATO_PACOTE_OPCAO || "", d);
      return [wrapPaginaOpcao(html)];
    }
    if (docId === "promessa") {
      const arr = window.__DK_CONTRATO_PACOTE_PROMESSA || [];
      return arr.map((c, i) => wrapPaginaPromessa(substituirPacote(c, d), i + 1, arr.length));
    }
    if (docId === "requerimento") {
      /* PDF modelo oficial — páginas preenchidas em runtime (sem alterar layout). */
      return [
        `<div class="pagina kit-pdf-pagina" data-pdf-mount="requerimento"><p class="kit-pdf-loading">A carregar modelo oficial DETRAN…</p></div>`,
      ];
    }
    return [];
  }

  function wrapPaginaOpcao(corpoHtml) {
    return `<div class="pagina pagina-opcao" data-pagina="1" data-kit-label="Opção contratada">
  <div class="corpo">${corpoHtml}</div>
  <div class="pe-pagina pe-opcao"><span>DK - SISLOC - Sistema de Controle de Locações</span><span>Pág.: 1 / 1</span></div>
</div>`;
  }

  function wrapPagina(corpoHtml, num, total, d, label) {
    return `<div class="pagina" data-pagina="${num}" data-kit-label="${esc(label)}">
  <div class="corpo">${corpoHtml}</div>
  <div class="pe-pagina"><span>DK - SISLOC — ${esc(label)} · Prot. ${esc(d.protocolo)}</span><span>Pág.: ${num} / ${total}</span></div>
</div>`;
  }

  /** Rodapé idêntico ao PDF oficial da Promessa. */
  function wrapPaginaPromessa(corpoHtml, num, total) {
    return `<div class="pagina pagina-promessa" data-pagina="${num}" data-kit-label="Promessa">
  <div class="corpo">${corpoHtml}</div>
  <div class="pe-pagina pe-promessa"><span>DK - SISLOC - Sistema de Controle de Locações</span><span>Pág.: ${num} / ${total}</span></div>
</div>`;
  }

  function vendorUrl(path) {
    try {
      return new URL(path, window.location.href).href;
    } catch {
      return path;
    }
  }

  function buildPacoteHtml(dados) {
    const d = enriquecerDadosPacote(dados);
    const proto = normProtocolo(d.protocolo);

    const sequencia = DOCS.map((doc) => {
      let pagesHtml = "";
      try {
        pagesHtml = buildPaginasDoc(doc.id, d).join("");
      } catch (err) {
        pagesHtml = `<div class="pagina"><p>Erro: ${esc(err.message || err)}</p></div>`;
      }
      return `<section class="kit-bloco" id="kitBloco-${doc.id}" data-kit-doc="${doc.id}">
  <div class="kit-secao-titulo">${esc(doc.titulo)}</div>
  ${pagesHtml}
</section>`;
    }).join("");

    const metaDocs = JSON.stringify(
      DOCS.map((doc) => ({
        id: doc.id,
        kitTipo: doc.kitTipo,
        nomeArquivo: doc.arquivo(proto),
      }))
    );

    const meta = JSON.stringify({
      protocolo: proto,
      statusLocacao: d.statusLocacao,
      fim: d.fim || "",
      pastaContrato: "ativo",
      contratoDados:
        typeof window.__DK_contratoLocacaoSnapshotDados === "function"
          ? window.__DK_contratoLocacaoSnapshotDados(d)
          : {
              protocolo: proto,
              nome: d.nome,
              cpf: d.cpfFmt,
              placa: d.placa,
              modalidade: d.modalidade,
            },
    });

    const html2canvasUrl = vendorUrl("vendor/html2canvas.min.js");
    const jspdfUrl = vendorUrl("vendor/jspdf.umd.min.js");
    const reqModeloUrl = REQUERIMENTO_MODELO_URL;
    const pdfJsUrl = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
    const pdfWorkerUrl = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

    return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><title>Pacote ${esc(proto)} — assinatura</title><style>${cssKit()}</style></head>
<body class="kit-preview">
<div class="barra-acoes">
  <button type="button" id="btnImprimir">Imprimir os 4 documentos</button>
  <button type="button" id="btnGerarTodos" class="sec">Gerar e guardar os 4 PDFs</button>
  <span class="barra-msg" id="barraMsg">Protocolo ${esc(proto)} — contrato, opção, promessa + requerimento (modelo oficial DETRAN, sem alteração)</span>
</div>
<div class="kit-shell">${sequencia}</div>
<script>
(function(){
  var META = ${meta};
  var DOCS_META = ${metaDocs};
  var html2canvasUrl = ${JSON.stringify(html2canvasUrl)};
  var jspdfUrl = ${JSON.stringify(jspdfUrl)};
  var reqModeloUrl = ${JSON.stringify(reqModeloUrl)};
  var pdfJsUrl = ${JSON.stringify(pdfJsUrl)};
  var pdfWorkerUrl = ${JSON.stringify(pdfWorkerUrl)};
  var msg = document.getElementById("barraMsg");
  var reqPronto = false;

  function loadScript(src){
    return new Promise(function(res, rej){
      var s = document.createElement("script");
      s.src = src; s.onload = res; s.onerror = function(){ rej(new Error("Script: " + src)); };
      document.head.appendChild(s);
    });
  }
  async function ensureLibs(){
    if (!window.html2canvas) await loadScript(html2canvasUrl);
    if (!window.jspdf && !window.jsPDF) await loadScript(jspdfUrl);
  }
  function fmtTam(n){
    if (!n) return "0 B";
    if (n < 1048576) return (n/1024).toFixed(1).replace(".", ",") + " KB";
    return (n/1048576).toFixed(2).replace(".", ",") + " MB";
  }
  async function carregarRequerimentoModelo(){
    var bloco = document.getElementById("kitBloco-requerimento");
    if (!bloco) return;
    var titulo = bloco.querySelector(".kit-secao-titulo");
    try {
      if (!window.pdfjsLib) await loadScript(pdfJsUrl);
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
      var pdf = await window.pdfjsLib.getDocument({ url: reqModeloUrl, withCredentials: false }).promise;
      while (bloco.lastChild && bloco.lastChild !== titulo) bloco.removeChild(bloco.lastChild);
      for (var n = 1; n <= pdf.numPages; n++) {
        var page = await pdf.getPage(n);
        var viewport = page.getViewport({ scale: 2 });
        var wrap = document.createElement("div");
        wrap.className = "pagina kit-pdf-pagina";
        wrap.setAttribute("data-pagina", String(n));
        wrap.setAttribute("data-kit-label", "Requerimento DETRAN");
        var canvas = document.createElement("canvas");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await page.render({ canvasContext: canvas.getContext("2d"), viewport: viewport }).promise;
        wrap.appendChild(canvas);
        bloco.appendChild(wrap);
      }
      reqPronto = true;
      msg.textContent = "Protocolo " + META.protocolo + " — 4 documentos em sequência (requerimento = modelo oficial DETRAN).";
    } catch (e) {
      msg.textContent = "Não foi possível carregar o modelo DETRAN: " + (e && e.message ? e.message : e);
      var mount = bloco.querySelector("[data-pdf-mount]");
      if (mount) mount.innerHTML = "<p class=\\"kit-pdf-loading\\">Erro ao carregar o PDF modelo. Verifique modelos/requerimento-padrao-detran.pdf</p>";
    }
  }
  async function pdfDoBloco(bloco){
    await ensureLibs();
    var JsPDF = window.jspdf && window.jspdf.jsPDF ? window.jspdf.jsPDF : window.jsPDF;
    var paginas = bloco.querySelectorAll(".pagina");
    if (!paginas.length) throw new Error("Sem páginas");
    var pdf = new JsPDF({ unit: "mm", format: "a4", orientation: "portrait", compress: true });
    for (var i = 0; i < paginas.length; i++) {
      var canvas = await html2canvas(paginas[i], {
        scale: 1.25, useCORS: true, logging: false, backgroundColor: "#ffffff",
        width: paginas[i].offsetWidth, height: paginas[i].offsetHeight
      });
      var img = canvas.toDataURL("image/jpeg", 0.75);
      if (i > 0) pdf.addPage();
      pdf.addImage(img, "JPEG", 0, 0, 210, 297, undefined, "FAST");
    }
    return pdf.output("blob");
  }
  function blobToB64(blob){
    return new Promise(function(res, rej){
      var r = new FileReader();
      r.onload = function(){
        var s = String(r.result || "");
        res(s.indexOf(",") >= 0 ? s.slice(s.indexOf(",") + 1) : s);
      };
      r.onerror = function(){ rej(new Error("leitura")); };
      r.readAsDataURL(blob);
    });
  }
  function downloadBlob(blob, name){
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(function(){ URL.revokeObjectURL(a.href); }, 4000);
  }
  async function salvarNoPortal(docMeta, blob){
    if (!window.opener || typeof window.opener.__DK_contratoLocacaoSalvarPdfBlob !== "function") {
      return { ok: false, msg: "Portal indisponível" };
    }
    var b64 = await blobToB64(blob);
    return window.opener.__DK_contratoLocacaoSalvarPdfBlob({
      protocolo: META.protocolo,
      nomeArquivo: docMeta.nomeArquivo,
      statusLocacao: META.statusLocacao,
      fim: META.fim,
      pastaContrato: "ativo",
      contratoDados: META.contratoDados,
      kitTipo: docMeta.kitTipo
    }, { b64: b64, type: "application/pdf" }, { substituirConfirmado: true, kitAnexo: docMeta.kitTipo !== "contrato" });
  }

  document.getElementById("btnImprimir").addEventListener("click", async function(){
    if (!reqPronto) {
      msg.textContent = "Aguarde o modelo DETRAN carregar…";
      await carregarRequerimentoModelo();
    }
    window.print();
  });

  document.getElementById("btnGerarTodos").addEventListener("click", async function(){
    var btn = this;
    btn.disabled = true;
    if (!reqPronto) await carregarRequerimentoModelo();
    var ok = 0;
    for (var i = 0; i < DOCS_META.length; i++) {
      var meta = DOCS_META[i];
      msg.textContent = "A gerar " + (i+1) + "/4 — " + meta.nomeArquivo + "…";
      try {
        var blob;
        if (meta.kitTipo === "requerimento") {
          var res = await fetch(reqModeloUrl, { credentials: "same-origin" });
          if (!res.ok) throw new Error("Modelo DETRAN HTTP " + res.status);
          blob = await res.blob();
        } else {
          var bloco = document.getElementById("kitBloco-" + meta.id);
          blob = await pdfDoBloco(bloco);
        }
        downloadBlob(blob, meta.nomeArquivo);
        var r = await salvarNoPortal(meta, blob);
        if (r && r.ok) ok += 1;
      } catch (e) {
        msg.textContent = "Erro em " + meta.nomeArquivo + ": " + (e && e.message ? e.message : e);
        btn.disabled = false;
        return;
      }
    }
    msg.textContent = "Pacote concluído: 4 PDFs descarregados; " + ok + " guardado(s). Requerimento = modelo oficial sem alteração.";
    if (window.opener && window.opener.__DK_contratoLocacaoRefreshBotao) window.opener.__DK_contratoLocacaoRefreshBotao();
    btn.disabled = false;
  });

  carregarRequerimentoModelo();
})();
<\/script>
</body></html>`;
  }

  function abrirPacoteContrato(dados) {
    const html = buildPacoteHtml(dados);
    const msgEl = document.getElementById("operacaoLocacaoInlineMsg");
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    /* Chrome devolve null se window.open(..., "noopener") — a janela até abre,
       mas o código revogava o blob e o pacote ficava em branco. Abrir about:blank
       primeiro permite detectar bloqueio de pop-up de verdade. */
    const w = window.open("about:blank", "_blank", "width=980,height=900");
    if (!w) {
      URL.revokeObjectURL(url);
      if (msgEl) msgEl.textContent = "Permita pop-ups para abrir o pacote de contratos.";
      return false;
    }
    try {
      w.opener = null;
    } catch {
      /* ignore */
    }
    try {
      w.location.replace(url);
    } catch {
      try {
        w.location.href = url;
      } catch {
        URL.revokeObjectURL(url);
        if (msgEl) msgEl.textContent = "Não foi possível abrir o pacote de contratos neste navegador.";
        return false;
      }
    }
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    try {
      w.focus();
    } catch {
      /* ignore */
    }
    return true;
  }

  function buildOpcaoPaginaHtml(dados) {
    const d = enriquecerDadosPacote(dados);
    const html = substituirPacote(window.__DK_CONTRATO_PACOTE_OPCAO || "", d);
    return wrapPaginaOpcao(html);
  }

  window.__DK_contratoPacoteEnriquecer = enriquecerDadosPacote;
  window.__DK_contratoPacoteAbrir = abrirPacoteContrato;
  window.__DK_contratoPacoteCssOpcao = cssOpcao;
  window.__DK_contratoPacoteBuildOpcaoPagina = buildOpcaoPaginaHtml;
})();
