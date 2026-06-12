/**
 * Paridade operacional contrato de locação — demo vs oficial (live).
 */
const PAIRS = [
  ["https://grupodkempreendimentos.com.br/", "oficial"],
  ["https://demo.grupodkempreendimentos.com.br/", "demo"],
];

async function fetchText(url) {
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error(`${url} HTTP ${r.status}`);
  return r.text();
}

function verFromIndex(index, asset) {
  const re = new RegExp(`${asset.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\?v=([^"']+)`);
  return (index.match(re) || [])[1] || "";
}

const out = {};

for (const [base, label] of PAIRS) {
  const index = await fetchText(`${base}index.html?_=${Date.now()}`);
  const uiVer = verFromIndex(index, "portal-locadora-ui.js");
  const contratoVer = verFromIndex(index, "portal-contrato-locacao.js");
  const docsVer = verFromIndex(index, "portal-documentos.js");
  const [uiJs, contratoJs, docsJs] = await Promise.all([
    fetchText(`${base}portal-locadora-ui.js?v=${uiVer}&_=${Date.now()}`),
    fetchText(`${base}portal-contrato-locacao.js?v=${contratoVer}&_=${Date.now()}`),
    fetchText(`${base}portal-documentos.js?v=${docsVer}&_=${Date.now()}`),
  ]);
  out[label] = {
    btn: index.includes("operacaoLocacaoVisualizarContratoBtn"),
    gerarContratoHtml: index.includes("Gerar contrato"),
    contratoVer,
    docsVer,
    uiVer,
    sincronizarPasta: contratoJs.includes("__DK_contratoLocacaoSincronizarPasta"),
    salvarPdf: contratoJs.includes("__DK_contratoLocacaoSalvarPdfBlob"),
    gerarPdf10: contratoJs.includes("paginas.length !== 10"),
    vendorLocal:
      contratoJs.includes("vendor/jspdf.umd.min.js") && contratoJs.includes("vendor/html2canvas.min.js"),
    relatorios: docsJs.includes("__DK_documentosAbrirRelatorio"),
    pdfViewer: docsJs.includes("__DK_documentosAbrirDocPdfViewer"),
    moverPasta: docsJs.includes("__DK_documentosMoverContratoPorProtocolo"),
    garantirNuvem: docsJs.includes("__DK_documentosGarantirBlobNaNuvem"),
    refreshBotao: contratoJs.includes("__DK_contratoLocacaoRefreshBotao"),
    pastasAtivosInativos:
      index.includes("documentosDropContratoAtivo") && index.includes("documentosDropContratoInativo"),
    finalizarMove: uiJs.includes("__DK_contratoLocacaoSincronizarPasta"),
  };
}

console.log(JSON.stringify(out, null, 2));

let ok = true;
for (const key of Object.keys(out.oficial)) {
  if (JSON.stringify(out.oficial[key]) !== JSON.stringify(out.demo[key])) {
    console.error(`FAIL contrato parity: ${key} oficial=${JSON.stringify(out.oficial[key])} demo=${JSON.stringify(out.demo[key])}`);
    ok = false;
  }
}

console.log(ok ? "CONTRATO PARITY OK" : "CONTRATO PARITY FAIL");
process.exit(ok ? 0 : 1);
