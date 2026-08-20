/**
 * Pacote de documentos da locação — Opção contratada, Promessa, Requerimento + Contrato.
 * «Gerar contrato» abre o pacote com os 4 documentos preenchidos.
 */
(function portalContratoPacote() {
  "use strict";

  const CNPJ_DK = "59.665.734/0001-32";
  const DOCS = [
    { id: "contrato", titulo: "1. Contrato de locação (10 págs)", kitTipo: "contrato", arquivo: (p) => `${p}.pdf` },
    { id: "opcao", titulo: "2. Opção contratada", kitTipo: "opcao", arquivo: (p) => `${p}-opcao-contratada.pdf` },
    { id: "promessa", titulo: "3. Promessa de compra e venda", kitTipo: "promessa", arquivo: (p) => `${p}-promessa-compra.pdf` },
    { id: "requerimento", titulo: "4. Requerimento padrão DETRAN", kitTipo: "requerimento", arquivo: (p) => `${p}-requerimento.pdf` },
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

  /** Enriquece dados do contrato com frota/cliente/valores da ficha de locação. */
  function enriquecerDadosPacote(dados) {
    const base = { ...(dados || {}) };
    const cliente = loadCliente(base.cpfDigits);
    const veiculo = loadVeiculo(base.placa);
    const valorAluguel =
      String(document.getElementById("operacaoLocacaoValorAluguel")?.value || "").trim() ||
      pick(base, ["valorAluguel", "valorLocacao"], "—");
    const valorInvestimento =
      String(document.getElementById("operacaoLocacaoValorInvestimento")?.value || "").trim() ||
      pick(base, ["valorInvestimento"], "—");

    const enderecoParts = {
      logradouro: pick(cliente, ["logradouro", "endereco", "rua"], ""),
      numero: pick(cliente, ["numero", "num"], ""),
      bairro: pick(cliente, ["bairro"], ""),
      cep: pick(cliente, ["cep"], ""),
      cidade: pick(cliente, ["cidade", "municipio"], "Petrolina"),
      uf: pick(cliente, ["uf", "estado"], "PE"),
    };

    return {
      ...base,
      nome: String(base.nome || "").toUpperCase(),
      cpfFmt: base.cpfFmt || "",
      endereco: base.endereco || "—",
      placa: normPlaca(base.placa),
      marcaModelo: base.marcaModelo || pick(veiculo, ["marcaModelo", "modelo"], "—"),
      modalidade: base.modalidade || "DK MEU TRANSPORTE",
      codigoCliente: base.codigoCliente || "0000",
      municipioData: base.municipioData || "",
      chassi: pick(veiculo, ["chassi"], "—").toUpperCase(),
      renavam: pick(veiculo, ["renavam"], "—"),
      cor: pick(veiculo, ["cor"], "—").toUpperCase(),
      anoModelo: pick(veiculo, ["anoModelo", "ano"], "—"),
      codigoVeiculo: pick(veiculo, ["codigo", "idInterno", "codigoVeiculo"], "—"),
      km: pick(veiculo, ["km", "odometro", "kmAtual"], "—"),
      celular: pick(cliente, ["celular", "telefone", "fone", "whatsapp"], "—"),
      cnh: pick(cliente, ["cnh", "numeroCnh", "registroCnh"], "—"),
      rg: pick(cliente, ["rg", "identidade"], "—"),
      email: pick(cliente, ["email", "eMail"], "—"),
      cep: enderecoParts.cep || "—",
      bairro: enderecoParts.bairro || "—",
      cidade: enderecoParts.cidade,
      uf: enderecoParts.uf,
      valorAluguel,
      valorInvestimento,
      cnpjDk: CNPJ_DK,
    };
  }

  function substituirPacote(html, d) {
    const map = {
      "{{NOME}}": d.nome,
      "{{CPF}}": d.cpfFmt,
      "{{ENDERECO}}": d.endereco,
      "{{PROTOCOLO}}": d.protocolo,
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
    };
    let out = String(html || "");
    for (const [k, v] of Object.entries(map)) {
      out = out.split(k).join(esc(v));
    }
    return out;
  }

  function cssKit() {
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
@media print {
  body.kit-preview { padding-top: 0; background: #fff; }
  .barra-acoes, .kit-secao-titulo { display: none !important; }
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
      return [wrapPagina(html, 1, 1, d, "Opção contratada")];
    }
    if (docId === "promessa") {
      const arr = window.__DK_CONTRATO_PACOTE_PROMESSA || [];
      return arr.map((c, i) => wrapPagina(substituirPacote(c, d), i + 1, arr.length, d, "Promessa"));
    }
    if (docId === "requerimento") {
      const arr = window.__DK_CONTRATO_PACOTE_REQUERIMENTO || [];
      return arr.map((c, i) => wrapPagina(substituirPacote(c, d), i + 1, arr.length, d, "Requerimento"));
    }
    return [];
  }

  function wrapPagina(corpoHtml, num, total, d, label) {
    return `<div class="pagina" data-pagina="${num}" data-kit-label="${esc(label)}">
  <div class="corpo">${corpoHtml}</div>
  <div class="pe-pagina"><span>DK - SISLOC — ${esc(label)} · Prot. ${esc(d.protocolo)}</span><span>Pág.: ${num} / ${total}</span></div>
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

    return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><title>Pacote ${esc(proto)} — assinatura</title><style>${cssKit()}</style></head>
<body class="kit-preview">
<div class="barra-acoes">
  <button type="button" id="btnImprimir">Imprimir os 4 documentos</button>
  <button type="button" id="btnGerarTodos" class="sec">Gerar e guardar os 4 PDFs</button>
  <span class="barra-msg" id="barraMsg">Protocolo ${esc(proto)} — contrato, opção, promessa e requerimento em sequência para assinatura</span>
</div>
<div class="kit-shell">${sequencia}</div>
<script>
(function(){
  var META = ${meta};
  var DOCS_META = ${metaDocs};
  var html2canvasUrl = ${JSON.stringify(html2canvasUrl)};
  var jspdfUrl = ${JSON.stringify(jspdfUrl)};
  var msg = document.getElementById("barraMsg");

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

  document.getElementById("btnImprimir").addEventListener("click", function(){ window.print(); });

  document.getElementById("btnGerarTodos").addEventListener("click", async function(){
    var btn = this;
    btn.disabled = true;
    var ok = 0;
    for (var i = 0; i < DOCS_META.length; i++) {
      var meta = DOCS_META[i];
      msg.textContent = "A gerar " + (i+1) + "/4 — " + meta.nomeArquivo + "…";
      try {
        var bloco = document.getElementById("kitBloco-" + meta.id);
        var blob = await pdfDoBloco(bloco);
        downloadBlob(blob, meta.nomeArquivo);
        var r = await salvarNoPortal(meta, blob);
        if (r && r.ok) ok += 1;
      } catch (e) {
        msg.textContent = "Erro em " + meta.nomeArquivo + ": " + (e && e.message ? e.message : e);
        btn.disabled = false;
        return;
      }
    }
    msg.textContent = "Pacote concluído: 4 PDFs descarregados; " + ok + " guardado(s) em Contratos ATIVOS. Use «Imprimir» para o cliente assinar.";
    if (window.opener && window.opener.__DK_contratoLocacaoRefreshBotao) window.opener.__DK_contratoLocacaoRefreshBotao();
    btn.disabled = false;
  });
})();
<\/script>
</body></html>`;
  }

  function abrirPacoteContrato(dados) {
    const html = buildPacoteHtml(dados);
    const msgEl = document.getElementById("operacaoLocacaoInlineMsg");
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const w = window.open(url, "_blank", "noopener,noreferrer,width=980,height=900");
    if (!w) {
      URL.revokeObjectURL(url);
      if (msgEl) msgEl.textContent = "Permita pop-ups para abrir o pacote de contratos.";
      return false;
    }
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    try {
      w.focus();
    } catch {
      /* ignore */
    }
    return true;
  }

  window.__DK_contratoPacoteEnriquecer = enriquecerDadosPacote;
  window.__DK_contratoPacoteAbrir = abrirPacoteContrato;
})();
