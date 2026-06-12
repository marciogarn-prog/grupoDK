/**
 * Contrato de locação — 10 páginas (modelo DK), preview → Gerar PDF → Imprimir | Salvar.
 */
(function portalContratoLocacao() {
  "use strict";

  const LOGO_SRC = "images/dk-locadora-logo.png";
  const VENDOR_JSPDF = "vendor/jspdf.umd.min.js";
  const VENDOR_HTML2CANVAS = "vendor/html2canvas.min.js";

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
    let clientes = [];
    try {
      if (typeof window.loadPortalClientesCadastro === "function") {
        clientes = window.loadPortalClientesCadastro();
      } else {
        const raw = localStorage.getItem("dk_portal_clientes_cadastro");
        clientes = raw ? JSON.parse(raw) : [];
      }
    } catch {
      clientes = [];
    }
    if (!Array.isArray(clientes)) clientes = [];
    return clientes.find((c) => onlyDigits(c.cpf) === cpfDigits) || null;
  }

  function enderecoCliente(cliente) {
    if (!cliente) return "";
    const base = String(cliente.endereco || cliente.enderecoBase || "").trim();
    const comp = String(cliente.complemento || "").trim();
    const mun = String(cliente.municipioUf || "").trim();
    const cep = String(cliente.cep || "").trim();
    return [base, comp, mun, cep ? `CEP ${cep}` : ""].filter(Boolean).join(", ");
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
    const codigoCliente = String(cliente?.codigo || "").trim() || "0000";
    const endereco = enderecoCliente(cliente) || "(Endereço do Cliente)";
    const municipioUf = String(cliente?.municipioUf || "Petrolina/PE").trim();
    return montarDadosContrato({
      protocolo,
      cpfDigits,
      nome,
      placa,
      marcaModelo,
      modalidade,
      codigoCliente,
      endereco,
      municipioUf,
      inicioDt,
      statusLocacao,
      fim: rawFim,
    });
  }

  function resolverDadosFromLoc(loc) {
    if (!loc) return null;
    const cpfDigits = onlyDigits(loc.cpf);
    const cliente = loadCliente(cpfDigits);
    const inicioDt = parseBrDate(loc.inicio) || new Date();
    const nome = String(loc.nome || loc.cliente || cliente?.nome || "").trim();
    const modalidade = String(loc.plano || loc.opcaoContrato || loc.modalidade || "").trim() || "DK MEU TRANSPORTE";
    return montarDadosContrato({
      protocolo: normProtocolo(loc.numeroContrato),
      cpfDigits,
      nome,
      placa: normPlaca(loc.placa),
      marcaModelo: String(loc.marcaModelo || loc.modelo || "").trim(),
      modalidade,
      codigoCliente: String(loc.clienteCodigo || cliente?.codigo || "").trim() || "0000",
      endereco: enderecoCliente(cliente) || "(Endereço do Cliente)",
      municipioUf: String(cliente?.municipioUf || "Petrolina/PE").trim(),
      inicioDt,
      statusLocacao: String(loc.statusLocacao || (String(loc.fim || "").trim() ? "FINALIZADO" : "ATIVO")).trim(),
      fim: String(loc.fim || "").trim(),
    });
  }

  function montarDadosContrato(p) {
    const inicioDt = p.inicioDt || new Date();
    return {
      protocolo: p.protocolo,
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
      .replace(/\{\{MUNICIPIO_DATA\}\}/g, esc(dados.municipioData));
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
  padding: 10mm 26mm 12mm 10mm;
  font-family: "Times New Roman", Times, serif;
  font-size: 8.25pt;
  line-height: 1.2;
  color: #111;
  page-break-after: always;
  break-after: page;
}
.pagina:last-child { page-break-after: auto; margin-bottom: 0; }
.cabecalho { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; margin-bottom: 6px; }
.cabecalho img { height: 38px; width: auto; object-fit: contain; }
.cabecalho-titulo { text-align: right; flex: 1; }
.cabecalho-titulo h1 { margin: 0; font-size: 12pt; text-decoration: underline; letter-spacing: 0.02em; font-weight: bold; }
.cabecalho-titulo .proto { margin: 4px 0 0; font-size: 9.5pt; font-weight: 600; }
.partes { margin: 4px 0 8px; text-align: justify; }
.partes p { margin: 0 0 5px; }
.hl { background: #fff3a0; padding: 0 1px; }
.sidebar {
  position: absolute; top: 10mm; right: 3mm; bottom: 12mm; width: 18mm;
  writing-mode: vertical-rl; transform: rotate(180deg);
  font-size: 6pt; color: #333; text-align: center; letter-spacing: 0.01em; line-height: 1.15;
  overflow: hidden;
}
.corpo { text-align: justify; }
.cl, .cl-n { margin: 0 0 2px; text-align: justify; }
.cl-t { font-weight: bold; margin: 5px 0 2px; font-size: 8.5pt; }
.cl-n { margin-bottom: 1px; }
.sig-line { margin-top: 12px; letter-spacing: 0.12em; text-align: center; }
.sig-block { display: flex; justify-content: space-between; margin-top: 3px; font-size: 8.5pt; }
.pe-pagina {
  position: absolute; bottom: 6mm; left: 10mm; right: 26mm;
  display: flex; justify-content: space-between; font-size: 7pt; color: #444;
  border-top: 1px solid #ccc; padding-top: 3px;
}
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
@media print {
  html, body { background: #fff; padding: 0 !important; margin: 0 !important; }
  .barra-acoes { display: none !important; }
  .contrato-doc { width: 100%; margin: 0; }
  .pagina { margin: 0; box-shadow: none; page-break-after: always; break-after: page; }
  .pagina:last-child { page-break-after: auto; }
  body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}`;
  }

  function paginaCapa(dados) {
    return `<div class="partes">
<p>De um lado, <strong>DK LOCADORA LTDA</strong>, pessoa jurídica de direito privado, devidamente inscrita no CNPJ/MF sob o nº
59.665.734/0001-32, com sede na AV. DA REDENÇÃO, SN - ANTÔNIO CASSIMIRO - PETROLINA/PE - CEP: 56.321-440,
representado na forma de seu Contrato Social, neste ato denominado <strong>LOCADOR</strong>.</p>
<p>De outro lado, <span class="hl">${esc(dados.nome)}</span>, CPF: <span class="hl">${esc(dados.cpfFmt)}</span>,
<span class="hl">residente e domiciliado no(a) ${esc(dados.endereco)}</span>,
neste ato denominado <strong>LOCATÁRIO</strong>.</p>
<p>Têm entre si, de maneira justa e acordada, o presente <strong>INSTRUMENTO PARTICULAR DE CONTRATO DE LOCAÇÃO DE
VEÍCULO</strong>, que se regerá pelas cláusulas abaixo descritas.</p>
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
    <p class="proto">Protocolo nº <span class="hl">${esc(dados.protocolo)}</span></p>
  </div>
</div>`
        : "";
    return `<div class="pagina" data-pagina="${num}">
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

  function scriptPreviewInline(dados) {
    const html2canvasUrl = vendorScriptUrl(VENDOR_HTML2CANVAS);
    const jspdfUrl = vendorScriptUrl(VENDOR_JSPDF);
    const meta = JSON.stringify({
      protocolo: dados.protocolo,
      statusLocacao: dados.statusLocacao,
      fim: dados.fim || "",
      pastaContrato: "ativo",
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

  async function gerarPdfBlob(){
    await ensurePdfLibs();
    var JsPDF = window.jspdf && window.jspdf.jsPDF ? window.jspdf.jsPDF : window.jsPDF;
    if (!JsPDF) throw new Error("jsPDF indisponível");
    var paginas = document.querySelectorAll(".pagina");
    if (paginas.length !== 10) throw new Error("Contrato deve ter 10 páginas (encontradas: " + paginas.length + ")");
    var pdf = new JsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
    for (var i = 0; i < paginas.length; i++) {
      var canvas = await html2canvas(paginas[i], {
        scale: 2, useCORS: true, logging: false, backgroundColor: "#ffffff",
        width: paginas[i].offsetWidth, height: paginas[i].offsetHeight
      });
      var img = canvas.toDataURL("image/jpeg", 0.92);
      if (i > 0) pdf.addPage();
      pdf.addImage(img, "JPEG", 0, 0, 210, 297);
    }
    return pdf.output("blob");
  }

  btnGerar.addEventListener("click", function(){
    btnGerar.disabled = true;
    msg.textContent = "A gerar PDF (10 páginas)…";
    gerarPdfBlob().then(function(blob){
      pdfBlob = blob;
      barraInicial.classList.add("hidden");
      barraPos.classList.remove("hidden");
      msg.textContent = "PDF gerado com 10 páginas — imprima ou guarde na pasta Contratos ATIVOS.";
    }).catch(function(e){
      msg.textContent = "Erro: " + (e && e.message ? e.message : e);
      btnGerar.disabled = false;
    });
  });

  document.getElementById("btnImprimir").addEventListener("click", function(){ window.print(); });

  document.getElementById("btnSalvar").addEventListener("click", function(){
    var btn = this;
    if (!pdfBlob) { msg.textContent = "Gere o PDF primeiro."; return; }
    if (!window.opener || typeof window.opener.__DK_contratoLocacaoSalvarPdfBlob !== "function") {
      msg.textContent = "Portal indisponível — recarregue a janela principal.";
      return;
    }
    btn.disabled = true;
    msg.textContent = "A guardar na pasta Contratos ATIVOS…";
    pdfBlob.arrayBuffer().then(function(ab){
      return window.opener.__DK_contratoLocacaoSalvarPdfBlob(META, { ab: ab, type: "application/pdf" });
    }).then(function(r){
      if (r && r.ok) {
        msg.textContent = r.moved
          ? "Contrato guardado em Documentos → Contratos ATIVOS (nuvem)."
          : "Contrato já existia — actualizado na pasta (nuvem).";
        window.opener.__DK_contratoLocacaoRefreshBotao && window.opener.__DK_contratoLocacaoRefreshBotao();
      } else {
        msg.textContent = (r && r.msg) || "Não foi possível guardar.";
        btn.disabled = false;
      }
    }).catch(function(e){
      msg.textContent = "Erro ao guardar: " + (e && e.message ? e.message : e);
      btn.disabled = false;
    });
  });
})();
<\/script>`;
  }

  function buildContratoPreviewHtml(dados) {
    const paginas = buildPaginasHtml(dados);
    return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><title>Contrato ${esc(dados.protocolo)}</title><style>${cssContrato()}</style></head><body class="contrato-preview">
<div class="barra-acoes">
  <span id="barraInicial"><button type="button" id="btnGerarPdf">Gerar PDF</button></span>
  <span id="barraPosPdf" class="hidden">
    <button type="button" id="btnImprimir">Imprimir</button>
    <button type="button" id="btnSalvar">Salvar</button>
  </span>
  <span class="barra-msg" id="barraMsg">Protocolo ${esc(dados.protocolo)} — modelo 10 páginas</span>
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
    const fin =
      String(statusLocacao || "")
        .toUpperCase()
        .includes("FINAL") || Boolean(String(fim || "").trim());
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

  async function salvarPdfBlobNoDeposito(meta, recebido) {
    const protocolo = normProtocolo(meta?.protocolo);
    const normalizar =
      typeof window.__DK_documentosNormalizarBlob === "function" ? window.__DK_documentosNormalizarBlob : null;
    const blob = normalizar ? await normalizar(recebido, "application/pdf") : recebido instanceof Blob ? recebido : null;
    if (!protocolo || !blob) return { ok: false, msg: "dados_invalidos" };
    const depositar = typeof window.__DK_documentosDepositarBlob === "function" ? window.__DK_documentosDepositarBlob : null;
    if (!depositar) return { ok: false, msg: "deposito_indisponivel" };

    const statusLocacao = String(meta.statusLocacao || "ATIVO");
    const fim = String(meta.fim || "");
    const pastaMeta = String(meta.pastaContrato || "").trim().toLowerCase();
    const statusContrato =
      pastaMeta === "ativo" || pastaMeta === "inativo" ? pastaMeta : pastaContratoParaLocacao(statusLocacao, fim);
    const existente = obterContratoDeposito(protocolo);

    const dep = await depositar(
      "contrato",
      blob,
      {
        nomeArquivo: `${protocolo}.pdf`,
        chave: protocolo,
        mimeType: "application/pdf",
        origem: "contrato-locacao",
      },
      { statusContrato, replaceChave: Boolean(existente), silent: true }
    );

    if (dep?.ok && dep.entry?.nuvem !== true) {
      await sincronizarPastaContratoLocacao(protocolo, statusLocacao, { fim, silent: true });
    }

    return { ok: Boolean(dep?.ok), moved: !existente, entry: dep?.entry, naNuvem: dep?.naNuvem };
  }

  function abrirPreviewContrato(dados) {
    const msgEl = document.getElementById("operacaoLocacaoInlineMsg");
    const html = buildContratoPreviewHtml(dados);
    const popup = window.open("", "_blank", "width=920,height=1000");
    if (!popup) {
      if (msgEl) msgEl.textContent = "O navegador bloqueou a janela — permita pop-ups para gerar o contrato.";
      return false;
    }
    popup.document.write(html);
    popup.document.close();
    popup.focus();
    if (msgEl) {
      msgEl.textContent = `Contrato ${dados.protocolo} — clique «Gerar PDF» na janela; depois «Salvar» para a pasta Contratos ATIVOS.`;
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
        if (abrir) {
          abrir(row.blob, entrada.nomeArquivo || `${protocolo}.pdf`, entrada.mimeType || row.mimeType || "application/pdf");
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
    const sel = document.getElementById("operacaoLocacaoProtocoloSelect");
    const hid = document.getElementById("operacaoLocacaoProtocolo");
    if (!btn) return;
    const isNovo = sel && String(sel.value || "") === "__PORTAL_PROTO_NOVO__";
    const proto = normProtocolo(hid?.value);
    const can = Boolean(proto) && !isNovo;
    btn.disabled = !can;
    if (!can) {
      btn.textContent = "Gerar contrato";
      btn.dataset.dkModo = "gerar";
      btn.title = "Cadastre a locação ou carregue um protocolo existente (não «NOVO»).";
      return;
    }
    const existe = contratoExisteParaProtocolo(proto);
    if (existe) {
      btn.textContent = "Visualizar contrato";
      btn.dataset.dkModo = "visualizar";
      btn.title = `Abrir o PDF guardado para o protocolo ${proto}.`;
    } else {
      btn.textContent = "Gerar contrato";
      btn.dataset.dkModo = "gerar";
      btn.title = `Abrir o modelo (10 páginas), gerar PDF e guardar em Contratos ATIVOS.`;
    }
  }

  window.__DK_contratoLocacaoResolverFromForm = resolverDadosFromForm;
  window.__DK_contratoLocacaoResolverFromLoc = resolverDadosFromLoc;
  window.__DK_contratoLocacaoBuildHtml = buildContratoPreviewHtml;
  window.__DK_contratoLocacaoSalvarPdfBlob = salvarPdfBlobNoDeposito;
  window.__DK_contratoLocacaoExisteParaProtocolo = contratoExisteParaProtocolo;
  window.__DK_contratoLocacaoVisualizarArmazenado = visualizarContratoArmazenado;
  window.__DK_contratoLocacaoSincronizarPasta = sincronizarPastaContratoLocacao;
  window.__DK_contratoLocacaoRefreshBotao = atualizarBotaoContratoLocacao;

  document.getElementById("operacaoLocacaoVisualizarContratoBtn")?.addEventListener("click", (e) => {
    e.preventDefault();
    const msgEl = document.getElementById("operacaoLocacaoInlineMsg");
    const dados = resolverDadosFromForm();
    const err = validarDados(dados);
    if (err) {
      if (msgEl) msgEl.textContent = err;
      return;
    }
    const modo = String(e.currentTarget?.dataset?.dkModo || "").trim();
    if (modo === "visualizar" || contratoExisteParaProtocolo(dados.protocolo)) {
      void visualizarContratoArmazenado(dados.protocolo);
      return;
    }
    abrirPreviewContrato(dados);
  });

  atualizarBotaoContratoLocacao();
  window.addEventListener("storage", (ev) => {
    if (ev.key === "dk_documentos_deposito_v1") atualizarBotaoContratoLocacao();
  });
})();
