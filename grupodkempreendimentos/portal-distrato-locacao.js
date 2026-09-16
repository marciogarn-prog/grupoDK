/**
 * Distrato de locação — pré-visualização A4, PDF e impressão antes da finalização.
 */
(function portalDistratoLocacao() {
  "use strict";

  const confirmacoes = new Map();

  function esc(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function digitos(value) {
    return String(value ?? "").replace(/\D/g, "");
  }

  function numeroKm(value) {
    const raw = digitos(value);
    return raw ? Number(raw) : 0;
  }

  function km6(value) {
    const n = numeroKm(value);
    return `${String(Math.max(0, n)).padStart(6, "0")} Km(s)`;
  }

  function parseDataBr(value) {
    const match = String(value || "").match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!match) return null;
    const data = new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]));
    return Number.isNaN(data.getTime()) ? null : data;
  }

  function dataExtenso(data) {
    if (!data) return "data não informada";
    const dias = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];
    const meses = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
    return `${dias[data.getDay()]}, ${String(data.getDate()).padStart(2, "0")} de ${meses[data.getMonth()]} de ${data.getFullYear()}`;
  }

  function dataCurtaComDia(value, hora) {
    const data = parseDataBr(value);
    const dias = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
    const prefixo = data ? `${dias[data.getDay()]}, ` : "";
    return `${prefixo}${value || "—"}${hora ? ` - ${hora}` : ""}`;
  }

  function formatCpfCnpj(value) {
    const d = digitos(value);
    if (d.length === 11) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
    if (d.length === 14) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
    return String(value || "").trim() || "—";
  }

  function dadosCompletos(raw) {
    const enriquecido =
      typeof window.__DK_contratoPacoteEnriquecer === "function"
        ? window.__DK_contratoPacoteEnriquecer(raw)
        : { ...(raw || {}) };
    const inicio = String(raw.inicio || raw.dataInicio || enriquecido.dataInicio || enriquecido.dataContrato || "").trim();
    const fim = String(raw.fim || raw.dataFim || "").trim();
    const retirada = numeroKm(raw.odometroInicio || raw.kmInicial || enriquecido.odometroInicio || enriquecido.km);
    const devolucao = numeroKm(raw.odometroFim || raw.kmFinal || enriquecido.odometroFim);
    const rodados = Math.max(0, devolucao - retirada);
    const diasContrato = Math.max(0, Number(raw.diasContrato) || 0);
    return {
      ...enriquecido,
      ...raw,
      inicio,
      fim,
      retirada,
      devolucao,
      rodados,
      diasContrato,
      cpfFmt: raw.cpfFmt || enriquecido.cpfFmt || formatCpfCnpj(raw.cpfDigits || raw.cpf),
      proprietarioCpfCnpj: formatCpfCnpj(raw.proprietarioCpfCnpj || enriquecido.proprietarioCpfCnpj),
    };
  }

  function cssDistrato() {
    return `
@page { size: A4 portrait; margin: 0; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: #8a8a8a; color: #111; }
body { padding: 58px 0 24px; font-family: Arial, Helvetica, sans-serif; }
.distrato-barra {
  position: fixed; z-index: 20; top: 0; left: 0; right: 0; min-height: 50px;
  display: flex; align-items: center; gap: 10px; padding: 9px 14px;
  background: #171717; color: #fff; font-size: 12px;
}
.distrato-barra button {
  border: 0; border-radius: 4px; padding: 9px 15px; cursor: pointer;
  color: #fff; background: #df5a06; font-weight: 700;
}
.distrato-barra button.sec { background: #a71919; }
.distrato-barra button.ok { background: #16773a; }
.distrato-barra button:disabled { opacity: .55; cursor: wait; }
#distratoMsg { flex: 1 1 auto; opacity: .9; }
.distrato-pagina {
  position: relative; width: 210mm; height: 297mm; margin: 0 auto;
  padding: 11mm 9mm 14mm; overflow: hidden; background: #fff;
  box-shadow: 0 2px 12px rgba(0,0,0,.4); font-size: 9.15pt; line-height: 1.28;
}
.distrato-cab { position: relative; min-height: 17mm; margin-bottom: 4mm; padding: 0 24mm; text-align: center; }
.distrato-logo { position: absolute; left: 0; top: 0; width: 27mm; height: 15mm; object-fit: contain; object-position: left top; }
.distrato-quadrado { position: absolute; right: 0; top: 0; width: 5mm; height: 5mm; background: #cf3f54; }
.distrato-cab h1 { margin: 0; font-size: 12pt; line-height: 1.15; text-decoration: underline; }
.distrato-cab p { margin: .8mm 0 0; font-weight: 700; }
.distrato-p { margin: 0 0 4.5mm; text-align: justify; }
.distrato-h2 { margin: 5mm 0 4mm; font-size: 9.8pt; }
.distrato-objeto { display: grid; grid-template-columns: 12mm 1fr; gap: 5mm; margin: 0 0 4mm; }
.distrato-num { font-weight: 700; }
.distrato-veiculo { display: grid; grid-template-columns: 34mm 1fr; row-gap: 1.2mm; margin: 0 0 0 31mm; }
.distrato-veiculo span { font-weight: 700; }
.distrato-clausula { display: grid; grid-template-columns: 12mm 1fr; gap: 5mm; margin: 0 0 8mm; }
.distrato-resumo { display: grid; grid-template-columns: 1.3fr .8fr 1.3fr; gap: 4mm; margin-top: 4mm; }
.distrato-resumo__bloco { min-width: 0; border-top: 1px solid #777; text-align: center; }
.distrato-resumo__titulo { margin: -5mm 0 1.5mm; background: #fff; display: inline-block; padding: 0 2mm; font-weight: 700; }
.distrato-resumo__linha { display: grid; grid-template-columns: 1fr 1fr; gap: 2mm; border-bottom: 1px solid #999; padding-bottom: 1.2mm; }
.distrato-resumo__linha--3 { grid-template-columns: 1fr 1fr 1fr; }
.distrato-resumo__lab { display: block; font-size: 8pt; }
.distrato-resumo__val { display: block; margin-top: 1mm; font-weight: 700; }
.distrato-resumo__inicio .distrato-resumo__val { color: #315c9c; }
.distrato-resumo__fim .distrato-resumo__val { color: #a63737; }
.distrato-resumo__retirada .distrato-resumo__val { color: #315c9c; }
.distrato-resumo__devolucao .distrato-resumo__val { color: #a63737; }
.distrato-motivo { display: grid; grid-template-columns: 42mm 1fr; gap: 5mm; margin: 7mm 5mm 0; }
.distrato-motivo__campo { border-top: 1px solid #777; }
.distrato-motivo__titulo { display: block; width: max-content; max-width: 100%; margin: -5mm auto 1.8mm; padding: 0 2mm; background: #fff; font-weight: 700; }
.distrato-motivo__texto { white-space: pre-wrap; }
.distrato-data { margin: 24mm 0 0; text-align: center; }
.distrato-assinaturas { display: flex; gap: 22mm; margin: 13mm 12mm 0; }
.distrato-assinatura { flex: 1 1 0; text-align: center; }
.distrato-assinatura__linha { height: 12mm; border-bottom: 1px solid #222; margin-bottom: 2mm; }
.distrato-assinatura p { margin: 0 0 1mm; font-weight: 700; }
.distrato-assinatura small { font-size: 8.5pt; }
.distrato-rodape {
  position: absolute; left: 9mm; right: 9mm; bottom: 6mm;
  display: flex; justify-content: space-between; font-size: 8pt;
}
@media print {
  html, body { background: #fff; padding: 0; }
  .distrato-barra { display: none !important; }
  .distrato-pagina { margin: 0; box-shadow: none; }
}`;
  }

  function htmlDistrato(raw) {
    const d = dadosCompletos(raw);
    const inicioDt = parseDataBr(d.inicio);
    const fimDt = parseDataBr(d.fim);
    const assinaturaDt = fimDt || new Date();
    const codigo = String(d.codigoCliente || d.clienteCodigo || "—").padStart(4, "0");
    const proprietario = String(d.proprietario || "—").toUpperCase();
    const proprietarioLinha = `${proprietario}${d.proprietarioCpfCnpj && d.proprietarioCpfCnpj !== "—" ? ` - CPF/CNPJ: ${d.proprietarioCpfCnpj}` : ""}`;
    const logo = (() => {
      try {
        return new URL("images/dk-locadora-logo.png", window.location.href).href;
      } catch {
        return "images/dk-locadora-logo.png";
      }
    })();
    return `<main class="distrato-pagina" id="distratoPagina">
  <header class="distrato-cab">
    <img class="distrato-logo" src="${esc(logo)}" alt="DK Locadora">
    <div class="distrato-quadrado" aria-hidden="true"></div>
    <h1>DISTRATO DE LOCAÇÃO DE VEÍCULO</h1>
    <p>Plano: ${esc(d.modalidade || d.plano || "—")}</p>
    <p>Protocolo Nº: ${esc(d.protocolo || d.numeroContrato || "—")}</p>
  </header>
  <p class="distrato-p">De um lado, <strong>DK LOCADORA LTDA</strong>, pessoa jurídica de direito privado, devidamente inscrita no CNPJ/MF sob o nº <strong>59.665.734/0001-32</strong>, com sede na AV. DA REDENÇÃO, SN - ANTÔNIO CASSIMIRO - PETROLINA/PE - CEP: 56.321-440, representado na forma de seu Contrato Social, neste ato denominado <strong>LOCADOR</strong>.</p>
  <p class="distrato-p">De outro lado, <strong>${esc(String(d.nome || "—").toUpperCase())}</strong>, CPF: <strong>${esc(d.cpfFmt)}</strong>, residente e domiciliado no(a) <strong>${esc(d.endereco || "endereço não cadastrado")}</strong>, neste ato denominado <strong>LOCATÁRIO</strong>.</p>
  <p class="distrato-p">Resolvem por acordo e mútuo interesse, assinar este <strong>DISTRATO DE LOCAÇÃO DE VEÍCULO</strong>, rescindindo o <strong>INSTRUMENTO PARTICULAR DE CONTRATO DE LOCAÇÃO DE VEÍCULO</strong>, firmado entre as partes na ${esc(dataExtenso(inicioDt))}, que se regerá pelas cláusulas abaixo descritas.</p>
  <h2 class="distrato-h2">Cláusula 1ª - Objeto do Distrato</h2>
  <div class="distrato-objeto"><span class="distrato-num">1.1.</span><div>O objeto do presente Distrato é um Veículo abaixo discriminado:</div></div>
  <div class="distrato-veiculo">
    <span>Placa:</span><strong>${esc(d.placa || "—")};</strong>
    <span>Marca / Modelo:</span><strong>${esc(d.marcaModelo || "—")};</strong>
    <span>Chassi:</span><strong>${esc(d.chassi || "—")};</strong>
    <span>Renavam:</span><strong>${esc(d.renavam || "—")};</strong>
    <span>Cor:</span><strong>${esc(d.cor || "—")};</strong>
    <span>Ano/Modelo:</span><strong>${esc(d.anoModelo || "—")};</strong>
    <span>Proprietário:</span><strong>${esc(proprietarioLinha)}.</strong>
  </div>
  <h2 class="distrato-h2">Cláusula 2ª - Distrato</h2>
  <div class="distrato-clausula"><span class="distrato-num">2.1.</span><div>Eventuais tolerâncias do Locador para com o Locatário no cumprimento das obrigações ajustadas no INSTRUMENTO PARTICULAR DE CONTRATO DE LOCAÇÃO DE VEÍCULO constituem mera liberalidade, não importando em hipótese alguma em novação, permanecendo íntegras as cláusulas e condições aqui acordadas.</div></div>
  <div class="distrato-clausula"><span class="distrato-num">2.2.</span><div>Por meio do presente acordo, o Contrato de Locação fica rescindido, ficando o(a) LOCADOR(a) autorizado(a) a, nesta data, tomar posse do Objeto locado.</div></div>
  <section class="distrato-resumo">
    <div class="distrato-resumo__bloco">
      <strong class="distrato-resumo__titulo">Período do Contrato</strong>
      <div class="distrato-resumo__linha">
        <div class="distrato-resumo__inicio"><span class="distrato-resumo__lab">Data Início</span><span class="distrato-resumo__val">${esc(dataCurtaComDia(d.inicio, d.horaInicio))}</span></div>
        <div class="distrato-resumo__fim"><span class="distrato-resumo__lab">Data Fim</span><span class="distrato-resumo__val">${esc(dataCurtaComDia(d.fim, d.horaFim))}</span></div>
      </div>
    </div>
    <div class="distrato-resumo__bloco">
      <strong class="distrato-resumo__titulo">Cód. do Cliente: ${esc(codigo)}</strong>
      <div class="distrato-resumo__linha"><div style="grid-column:1/-1"><span class="distrato-resumo__lab">Duração</span><span class="distrato-resumo__val">${esc(d.diasContrato)} dia(s)</span></div></div>
    </div>
    <div class="distrato-resumo__bloco">
      <strong class="distrato-resumo__titulo">Odômetro</strong>
      <div class="distrato-resumo__linha distrato-resumo__linha--3">
        <div class="distrato-resumo__retirada"><span class="distrato-resumo__lab">Retirada</span><span class="distrato-resumo__val">${esc(km6(d.retirada))}</span></div>
        <div class="distrato-resumo__devolucao"><span class="distrato-resumo__lab">Devolução</span><span class="distrato-resumo__val">${esc(km6(d.devolucao))}</span></div>
        <div><span class="distrato-resumo__lab">Km(s) Rodado(s)</span><span class="distrato-resumo__val">${esc(km6(d.rodados))}</span></div>
      </div>
    </div>
  </section>
  <section class="distrato-motivo">
    <div class="distrato-motivo__campo"><strong class="distrato-motivo__titulo">Iniciativa:</strong><div class="distrato-motivo__texto">- ${esc(d.iniciativa || "Cliente")}.</div></div>
    <div class="distrato-motivo__campo"><strong class="distrato-motivo__titulo">Breve Descrição do Motivo do Distrato:</strong><div class="distrato-motivo__texto">- ${esc(d.motivoDistrato || "Não informado")}</div></div>
  </section>
  <p class="distrato-data">Petrolina/PE, ${esc(dataExtenso(assinaturaDt))}</p>
  <section class="distrato-assinaturas">
    <div class="distrato-assinatura"><div class="distrato-assinatura__linha"></div><p>${esc(String(d.nome || "—").toUpperCase())}</p><small>CPF: ${esc(d.cpfFmt)}</small></div>
    <div class="distrato-assinatura"><div class="distrato-assinatura__linha"></div><p>DK LOCADORA LTDA</p><small>CNPJ: 59.665.734/0001-32</small></div>
  </section>
  <footer class="distrato-rodape"><span># DK - SISLOC - Sistema de Controle de Locações</span><span>Pág.: 1 / 1</span></footer>
</main>`;
  }

  function scriptPreview(token, protocolo) {
    const html2canvas = new URL("vendor/html2canvas.min.js", window.location.href).href;
    const jspdf = new URL("vendor/jspdf.umd.min.js", window.location.href).href;
    return `<script>
(function(){
  var token=${JSON.stringify(token)};
  var protocolo=${JSON.stringify(protocolo)};
  var msg=document.getElementById("distratoMsg");
  function load(src){return new Promise(function(ok,fail){var s=document.createElement("script");s.src=src;s.onload=ok;s.onerror=fail;document.head.appendChild(s);});}
  async function gerarPdf(){
    if(!window.html2canvas) await load(${JSON.stringify(html2canvas)});
    if(!window.jspdf) await load(${JSON.stringify(jspdf)});
    var pagina=document.getElementById("distratoPagina");
    var canvas=await window.html2canvas(pagina,{scale:1.6,useCORS:true,backgroundColor:"#fff",logging:false});
    var pdf=new window.jspdf.jsPDF({unit:"mm",format:"a4",orientation:"portrait",compress:true});
    pdf.addImage(canvas.toDataURL("image/jpeg",.86),"JPEG",0,0,210,297,undefined,"FAST");
    return pdf;
  }
  document.getElementById("btnDistratoPdf").onclick=async function(){
    var btn=this;btn.disabled=true;msg.textContent="Gerando PDF…";
    try{var pdf=await gerarPdf();pdf.save(protocolo+"-distrato.pdf");msg.textContent="PDF gerado. Confira e use Imprimir quando desejar.";}
    catch(e){msg.textContent="Erro ao gerar PDF: "+(e.message||e);}
    btn.disabled=false;
  };
  document.getElementById("btnDistratoImprimir").onclick=function(){window.print();};
  document.getElementById("btnDistratoConfirmar").onclick=function(){
    if(!window.opener||typeof window.opener.__DK_distratoLocacaoConfirmar!=="function"){msg.textContent="A janela principal não está disponível.";return;}
    var r=window.opener.__DK_distratoLocacaoConfirmar(token);
    if(r&&r.ok){msg.textContent="Locação finalizada e distrato confirmado.";this.disabled=true;}
    else msg.textContent=(r&&r.msg)||"Não foi possível finalizar.";
  };
})();
<\/script>`;
  }

  function abrir(raw, onConfirm) {
    const dados = dadosCompletos(raw);
    const token = `distrato-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    if (typeof onConfirm === "function") confirmacoes.set(token, { callback: onConfirm, dados });
    const popup = window.open("about:blank", "_blank", "width=980,height=900");
    if (!popup) return false;
    const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Distrato ${esc(dados.protocolo || "")}</title><style>${cssDistrato()}</style></head><body>
<div class="distrato-barra">
  <button type="button" id="btnDistratoPdf">Gerar PDF</button>
  <button type="button" id="btnDistratoImprimir" class="sec">Imprimir</button>
  <button type="button" id="btnDistratoConfirmar" class="ok">Confirmar finalização</button>
  <span id="distratoMsg">Pré-visualização do distrato — confira todos os dados antes de imprimir e finalizar.</span>
</div>
${htmlDistrato(dados)}
${scriptPreview(token, String(dados.protocolo || dados.numeroContrato || "distrato"))}
</body></html>`;
    popup.document.open();
    popup.document.write(html);
    popup.document.close();
    try {
      popup.focus();
    } catch {
      /* ignore */
    }
    return true;
  }

  window.__DK_distratoLocacaoAbrir = abrir;
  window.__DK_distratoLocacaoBuildHtml = (dados) =>
    `<!doctype html><html><head><meta charset="utf-8"><style>${cssDistrato()}</style></head><body>${htmlDistrato(dados)}</body></html>`;
  window.__DK_distratoLocacaoConfirmar = (token) => {
    const pendente = confirmacoes.get(String(token || ""));
    if (!pendente) return { ok: false, msg: "Esta pré-visualização expirou. Abra o distrato novamente." };
    try {
      const resultado = pendente.callback(pendente.dados);
      if (resultado === false) return { ok: false, msg: "A finalização não foi guardada." };
      confirmacoes.delete(String(token || ""));
      return { ok: true };
    } catch (err) {
      console.error(err);
      return { ok: false, msg: err?.message || "Erro ao finalizar a locação." };
    }
  };
})();
