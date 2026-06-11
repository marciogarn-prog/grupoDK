/**
 * Contrato de locação — gera PDF/HTML a partir dos dados do cadastro de locação
 * e deposita em Documentos → Contratos ATIVOS (chave = protocolo).
 */
(function portalContratoLocacao() {
  "use strict";

  const LOGO_SRC = "images/dk-locadora-logo.png";
  const JSPDF_URL = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.2/jspdf.umd.min.js";
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
    const dia = d.getDate();
    const mes = MESES[d.getMonth()] || "";
    const ano = d.getFullYear();
    return `${mun}, ${diaSem}, ${dia} de ${mes} de ${ano}`;
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
    const parts = [base, comp, mun, cep ? `CEP ${cep}` : ""].filter(Boolean);
    return parts.join(", ");
  }

  /** Dados a partir do formulário de cadastro de locação (portal). */
  function resolverDadosFromForm() {
    const protocolo = normProtocolo(document.getElementById("operacaoLocacaoProtocolo")?.value);
    const cpfDigits = onlyDigits(document.getElementById("operacaoLocacaoCpf")?.value);
    const nome =
      String(document.getElementById("operacaoLocacaoCliente")?.value || "").trim() ||
      String(loadCliente(cpfDigits)?.nome || "").trim();
    const placa = normPlaca(document.getElementById("operacaoLocacaoPlaca")?.value);
    const marcaModelo = String(document.getElementById("operacaoLocacaoModelo")?.value || "").trim();
    const modalidade = String(document.getElementById("operacaoLocacaoTipoPlano")?.value || "").trim() || "DK MEU TRANSPORTE";
    const rawInicio = String(document.getElementById("operacaoLocacaoDataInicio")?.value || "").trim();
    const inicioDt = parseBrDate(rawInicio) || new Date();
    const rawFim = String(document.getElementById("operacaoLocacaoDataFim")?.value || "").trim();
    const statusLocacao = rawFim ? "FINALIZADO" : "ATIVO";
    const cliente = loadCliente(cpfDigits);
    const codigoCliente = String(cliente?.codigo || "").trim() || "0000";
    const endereco = enderecoCliente(cliente) || "(Endereço do Cliente)";
    const municipioUf = String(cliente?.municipioUf || "Petrolina/PE").trim();
    return {
      protocolo,
      cpfDigits,
      nome,
      cpfFmt: formatCpf(cpfDigits),
      endereco,
      placa,
      marcaModelo,
      modalidade,
      codigoCliente,
      dataContrato: formatDataBr(inicioDt),
      dataContratoDt: inicioDt,
      municipioUf,
      municipioData: municipioDataLong(inicioDt, municipioUf),
      statusLocacao,
      fim: rawFim,
      sidebar: `Prot. Nº: ${protocolo} - ${DIAS_SEM[inicioDt.getDay()] || "dia"}, ${formatDataBr(inicioDt)} - ${modalidade} - Cód. Cliente: ${codigoCliente} - ${nome.toUpperCase()} - Placa: ${placa} - ${marcaModelo.toUpperCase()}`,
    };
  }

  /** Dados a partir de registro de locação (objeto). */
  function resolverDadosFromLoc(loc) {
    if (!loc) return null;
    const cpfDigits = onlyDigits(loc.cpf);
    const cliente = loadCliente(cpfDigits);
    const inicioDt = parseBrDate(loc.inicio) || new Date();
    const nome = String(loc.nome || loc.cliente || cliente?.nome || "").trim();
    const modalidade = String(loc.plano || loc.opcaoContrato || loc.modalidade || "").trim() || "DK MEU TRANSPORTE";
    const protocolo = normProtocolo(loc.numeroContrato);
    const placa = normPlaca(loc.placa);
    const marcaModelo = String(loc.marcaModelo || loc.modelo || "").trim();
    const codigoCliente = String(loc.clienteCodigo || cliente?.codigo || "").trim() || "0000";
    const endereco = enderecoCliente(cliente) || "(Endereço do Cliente)";
    const municipioUf = String(cliente?.municipioUf || "Petrolina/PE").trim();
    const statusLocacao = String(
      loc.statusLocacao || (String(loc.fim || "").trim() ? "FINALIZADO" : "ATIVO")
    ).trim();
    return {
      protocolo,
      cpfDigits,
      nome,
      cpfFmt: formatCpf(cpfDigits),
      endereco,
      placa,
      marcaModelo,
      modalidade,
      codigoCliente,
      dataContrato: formatDataBr(inicioDt),
      dataContratoDt: inicioDt,
      municipioUf,
      municipioData: municipioDataLong(inicioDt, municipioUf),
      statusLocacao,
      fim: String(loc.fim || "").trim(),
      sidebar: `Prot. Nº: ${protocolo} - ${DIAS_SEM[inicioDt.getDay()] || "dia"}, ${formatDataBr(inicioDt)} - ${modalidade} - Cód. Cliente: ${codigoCliente} - ${nome.toUpperCase()} - Placa: ${placa} - ${marcaModelo.toUpperCase()}`,
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

  function cssContrato() {
    return `
@page { size: A4 portrait; margin: 12mm 14mm 14mm 12mm; }
* { box-sizing: border-box; }
body { margin: 0; font-family: "Times New Roman", Times, serif; font-size: 9.5pt; line-height: 1.28; color: #111; }
.contrato-doc { width: 100%; }
.pagina { position: relative; width: 100%; min-height: 257mm; page-break-after: always; padding: 0 28mm 16mm 0; }
.pagina:last-child { page-break-after: auto; }
.cabecalho { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; margin-bottom: 10px; }
.cabecalho img { height: 42px; width: auto; object-fit: contain; }
.cabecalho-titulo { text-align: right; flex: 1; }
.cabecalho-titulo h1 { margin: 0; font-size: 13pt; text-decoration: underline; letter-spacing: 0.02em; }
.cabecalho-titulo .proto { margin-top: 6px; font-size: 10pt; font-weight: 600; }
.partes { margin: 8px 0 12px; text-align: justify; }
.partes p { margin: 0 0 8px; }
.hl { background: #fff3a0; padding: 0 2px; }
.sidebar { position: absolute; top: 0; right: 0; width: 22mm; height: 100%; writing-mode: vertical-rl; transform: rotate(180deg); font-size: 6.5pt; color: #333; text-align: center; letter-spacing: 0.02em; padding: 4mm 0; }
.corpo { text-align: justify; }
.cl, .cl-n, .cl-t { margin: 0 0 5px; }
.cl-t { font-weight: bold; margin-top: 8px; }
.cl-n { padding-left: 0; }
.sig-line { margin-top: 18px; letter-spacing: 0.15em; }
.sig-block { display: flex; justify-content: space-between; margin-top: 4px; font-size: 9pt; }
.pe-pagina { position: absolute; bottom: 0; left: 0; right: 28mm; display: flex; justify-content: space-between; font-size: 7.5pt; color: #444; border-top: 1px solid #ccc; padding-top: 4px; }
.barra-acoes { position: fixed; top: 0; left: 0; right: 0; z-index: 99; background: #1a1a1a; color: #fff; padding: 10px 16px; display: flex; gap: 10px; }
.barra-acoes button { padding: 8px 14px; cursor: pointer; border: 0; border-radius: 4px; background: #e85d04; color: #fff; font-weight: 600; }
@media print {
  .barra-acoes { display: none !important; }
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

  function buildPaginaHtml(num, total, corpoHtml, dados, opts = {}) {
    const capa = num === 1 ? paginaCapa(dados) : "";
    const titulo =
      num === 1
        ? `<div class="cabecalho">
  <img src="${LOGO_SRC}" alt="DK Locadora">
  <div class="cabecalho-titulo">
    <h1>CONTRATO DE LOCAÇÃO DE VEÍCULO</h1>
    <p class="proto">Protocolo nº <span class="hl">${esc(dados.protocolo)}</span></p>
  </div>
</div>`
        : "";
    return `<div class="pagina">
  <div class="sidebar">${esc(dados.sidebar)}</div>
  ${titulo}
  ${capa}
  <div class="corpo">${corpoHtml}</div>
  <div class="pe-pagina"><span># DK - SISLOC - Sistema de Controle de Locações</span><span>Pág.: ${num} / ${total}</span></div>
</div>`;
  }

  function buildContratoHtml(dados) {
    const corpos = window.__DK_CONTRATO_LOCACAO_CORPOS;
    if (!Array.isArray(corpos) || !corpos.length) {
      throw new Error("Modelo de contrato indisponível. Atualize a página.");
    }
    const total = corpos.length;
    const paginas = corpos.map((corpo, i) =>
      buildPaginaHtml(i + 1, total, substituirPlaceholders(corpo, dados), dados)
    );
    return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><title>Contrato ${esc(dados.protocolo)}</title><style>${cssContrato()}</style></head><body>
<div class="barra-acoes"><button type="button" onclick="window.print()">Imprimir / guardar PDF</button></div>
<div class="contrato-doc">${paginas.join("")}</div>
</body></html>`;
  }

  let jspdfPromise = null;
  function ensureJsPdf() {
    if (window.jspdf?.jsPDF) return Promise.resolve(window.jspdf.jsPDF);
    if (!jspdfPromise) {
      jspdfPromise = new Promise((resolve, reject) => {
        const s = document.createElement("script");
        s.src = JSPDF_URL;
        s.crossOrigin = "anonymous";
        s.referrerPolicy = "no-referrer";
        s.onload = () => resolve(window.jspdf?.jsPDF);
        s.onerror = () => reject(new Error("jsPDF indisponível"));
        document.head.appendChild(s);
      });
    }
    return jspdfPromise;
  }

  async function htmlToPdfBlob(html) {
    const JsPDF = await ensureJsPdf();
    const doc = new JsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
    const wrap = document.createElement("div");
    wrap.innerHTML = html;
    wrap.style.position = "fixed";
    wrap.style.left = "-12000px";
    wrap.style.top = "0";
    wrap.style.width = "180mm";
    document.body.appendChild(wrap);
    const paginas = wrap.querySelectorAll(".pagina");
    const margin = 12;
    const maxW = 186;
    const lineH = 4.2;
    paginas.forEach((pag, idx) => {
      if (idx > 0) doc.addPage();
      let y = margin;
      const titulo = pag.querySelector(".cabecalho-titulo h1");
      if (titulo) {
        doc.setFontSize(12);
        doc.text(String(titulo.textContent || "CONTRATO DE LOCAÇÃO DE VEÍCULO"), margin, y);
        y += 7;
      }
      const proto = pag.querySelector(".proto");
      if (proto) {
        doc.setFontSize(10);
        doc.text(String(proto.textContent || ""), margin, y);
        y += 6;
      }
      doc.setFontSize(8.5);
      const partesText = String(pag.querySelector(".partes")?.innerText || "").trim();
      const corpoText = String(pag.querySelector(".corpo")?.innerText || "").trim();
      const texto = [partesText, corpoText].filter(Boolean).join("\n\n");
      const lines = doc.splitTextToSize(texto, maxW);
      for (let i = 0; i < lines.length; i += 1) {
        if (y > 285) {
          doc.addPage();
          y = margin;
        }
        doc.text(lines[i], margin, y);
        y += lineH;
      }
      doc.setFontSize(7);
      doc.text(`Pág. ${idx + 1} / ${paginas.length}`, 180, 290);
    });
    wrap.remove();
    return doc.output("blob");
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
    const pasta = pastaContratoParaLocacao(statusLocacao, opts.fim);
    return mover(protocolo, pasta, opts);
  }

  async function visualizarContratoArmazenado(protocolo) {
    const msgEl = document.getElementById("operacaoLocacaoInlineMsg");
    const entrada = obterContratoDeposito(protocolo);
    if (!entrada) {
      if (msgEl) msgEl.textContent = "Contrato ainda não gerado para este protocolo.";
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
            "Contrato registado mas ficheiro indisponível neste computador — abra Documentos ou aguarde a sincronização da nuvem.";
        }
        return { ok: false, msg: "blob_ausente" };
      }
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
      btn.title = `Abrir o contrato já gerado para o protocolo ${proto} (Documentos → Contratos ATIVOS).`;
    } else {
      btn.textContent = "Gerar contrato";
      btn.dataset.dkModo = "gerar";
      btn.title = `Gerar contrato PDF para o protocolo ${proto} e guardar em Documentos → Contratos ATIVOS.`;
    }
  }

  async function depositarContrato(dados, opts = {}) {
    const statusContrato = pastaContratoParaLocacao(dados.statusLocacao, dados.fim);
    const existente = obterContratoDeposito(dados.protocolo);
    if (existente && !opts.forcarSubstituir) {
      const stAtual = String(existente.statusContrato || "").trim().toLowerCase();
      if (stAtual !== statusContrato) {
        await sincronizarPastaContratoLocacao(dados.protocolo, dados.statusLocacao, {
          fim: dados.fim,
          silent: Boolean(opts.silent),
        });
      } else if (existente.nuvem !== true) {
        await sincronizarPastaContratoLocacao(dados.protocolo, dados.statusLocacao, {
          fim: dados.fim,
          silent: true,
        });
      }
      return { ok: true, id: existente.id, entry: existente, jaExistia: true };
    }
    const depositar = typeof window.__DK_documentosDepositarBlob === "function" ? window.__DK_documentosDepositarBlob : null;
    if (!depositar) throw new Error("Depósito de documentos indisponível.");
    const html = buildContratoHtml(dados);
    const blob = await htmlToPdfBlob(html);
    const nomeArquivo = `${dados.protocolo}.pdf`;
    const dep = await depositar(
      "contrato",
      blob,
      { nomeArquivo, chave: dados.protocolo, mimeType: "application/pdf", origem: "contrato-locacao" },
      { statusContrato, replaceChave: true, silent: Boolean(opts.silent) }
    );
    if (dep?.ok && dep.entry?.nuvem !== true) {
      await sincronizarPastaContratoLocacao(dados.protocolo, dados.statusLocacao, {
        fim: dados.fim,
        silent: true,
      });
    }
    return dep;
  }

  function abrirVisualizacao(html, dados, msgEl) {
    const popup = window.open("", "_blank", "width=920,height=1000");
    if (!popup) {
      if (msgEl) msgEl.textContent = "O navegador bloqueou a janela — permita pop-ups para visualizar o contrato.";
      return false;
    }
    popup.document.write(html);
    popup.document.close();
    popup.focus();
    if (msgEl) msgEl.textContent = `Contrato ${dados.protocolo} gerado — confira a janela de impressão.`;
    return true;
  }

  async function gerarContratoLocacao(opts = {}) {
    const msgEl = document.getElementById("operacaoLocacaoInlineMsg");
    const dados = opts.dados || resolverDadosFromForm();
    const err = validarDados(dados);
    if (err) {
      if (msgEl && !opts.silent) msgEl.textContent = err;
      return { ok: false, msg: err };
    }
    if (contratoExisteParaProtocolo(dados.protocolo) && !opts.forcarSubstituir) {
      if (opts.somenteVisualizar !== false && !opts.silent) {
        return visualizarContratoArmazenado(dados.protocolo);
      }
      return { ok: true, dados, deposito: { ok: true, jaExistia: true } };
    }
    try {
      const html = buildContratoHtml(dados);
      let abriu = false;
      if (opts.somenteVisualizar !== false && !opts.silent) {
        abriu = abrirVisualizacao(html, dados, null);
      }
      if (opts.depositar !== false) {
        const dep = await depositarContrato(dados, opts);
        if (msgEl && !opts.silent) {
          if (dep.jaExistia) {
            msgEl.textContent = `Contrato do protocolo ${dados.protocolo} já existe — use «Visualizar contrato».`;
          } else if (dep.ok) {
            const pasta = pastaContratoParaLocacao(dados.statusLocacao, dados.fim);
            const pastaLabel = pasta === "inativo" ? "Contratos INATIVOS" : "Contratos ATIVOS";
            msgEl.textContent = abriu
              ? `Contrato ${dados.protocolo} gerado — confira a janela. Guardado em Documentos → ${pastaLabel} (nuvem).`
              : `Contrato ${dados.protocolo} guardado em Documentos → ${pastaLabel} (nuvem).`;
          } else if (!abriu) {
            msgEl.textContent = "Não foi possível guardar o contrato no depósito.";
          }
        }
        if (dep.ok && !dep.jaExistia) atualizarBotaoContratoLocacao();
        if (dep.jaExistia) atualizarBotaoContratoLocacao();
        return { ok: Boolean(dep.ok || abriu), dados, deposito: dep };
      }
      if (abriu && msgEl && !opts.silent) {
        msgEl.textContent = `Contrato ${dados.protocolo} gerado — confira a janela de impressão.`;
      }
      return { ok: true, dados };
    } catch (e) {
      const m = e?.message || String(e);
      if (msgEl && !opts.silent) msgEl.textContent = `Erro ao gerar contrato: ${m}`;
      return { ok: false, msg: m };
    }
  }

  window.__DK_contratoLocacaoResolverFromForm = resolverDadosFromForm;
  window.__DK_contratoLocacaoResolverFromLoc = resolverDadosFromLoc;
  window.__DK_contratoLocacaoBuildHtml = buildContratoHtml;
  window.__DK_contratoLocacaoGerar = gerarContratoLocacao;
  window.__DK_contratoLocacaoDepositar = depositarContrato;
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
    const btn = e.currentTarget;
    const modo = String(btn?.dataset?.dkModo || "").trim();
    if (modo === "visualizar" || contratoExisteParaProtocolo(dados.protocolo)) {
      void visualizarContratoArmazenado(dados.protocolo);
      return;
    }
    void gerarContratoLocacao({ dados, depositar: true, somenteVisualizar: true }).then(() => {
      atualizarBotaoContratoLocacao();
    });
  });

  atualizarBotaoContratoLocacao();
  window.addEventListener("storage", (ev) => {
    if (ev.key === "dk_documentos_deposito_v1") atualizarBotaoContratoLocacao();
  });
})();
