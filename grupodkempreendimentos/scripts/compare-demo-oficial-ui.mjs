/**
 * Compara index.html e assets-chave entre demo e oficial.
 */
const PAIRS = [
  ["https://grupodkempreendimentos.com.br/", "oficial"],
  ["https://demo.grupodkempreendimentos.com.br/", "demo"],
];

const MARKERS = [
  "operacaoLocacaoDocumentosListaContrato",
  "operacaoLocacaoDocumentosListaCrlv",
  "Trazer documento para contrato",
  "Trazer documento para CRLV",
  "Visualizar",
  "operacaoLocacaoDocBuscaContrato",
  "operacaoLocacaoDocSugestoesCrlv",
  "portal-loc-docs-grupos",
  "Confirmar",
  "Enviar para o cliente",
  "operacaoLocacaoDocumentosInput",
  "operacaoLocacaoDocumentosListaMulta",
  "operacaoLocacaoDocContratoBtn",
];

async function fetchText(url) {
  const r = await fetch(url, { cache: "no-store" });
  return r.text();
}

const results = {};
for (const [base, label] of PAIRS) {
  const index = await fetchText(`${base}index.html?_=${Date.now()}`);
  const docVer = (index.match(/portal-locacao-documentos\.js\?v=([^"']+)/) || [])[1] || "?";
  const cssVer = (index.match(/styles\.css\?v=([^"']+)/) || [])[1] || "?";
  const css = await fetchText(`${base}styles.css?v=${cssVer}`);
  results[label] = {
    docVer,
    cssVer,
    cssHasGrupos: css.includes("portal-loc-docs-grupos"),
    cssHasConfirmar: css.includes("portal-loc-docs-item__confirmar"),
    cssHasBusca: css.includes("portal-loc-docs-busca"),
    markers: {},
  };
  for (const m of MARKERS) {
    results[label].markers[m] = index.includes(m);
  }
}

console.log(JSON.stringify(results, null, 2));

let ok = true;
for (const m of MARKERS) {
  if (m === "operacaoLocacaoDocumentosInput") {
    if (results.demo.markers[m] || results.oficial.markers[m]) {
      console.error("FAIL: upload directo ainda presente");
      ok = false;
    }
    continue;
  }
  if (m === "operacaoLocacaoDocumentosListaMulta" || m === "operacaoLocacaoDocContratoBtn") {
    if (results.demo.markers[m] || results.oficial.markers[m]) {
      console.error(`FAIL: ${m} ainda presente no cadastro locação`);
      ok = false;
    }
    continue;
  }
  if (results.demo.markers[m] !== results.oficial.markers[m]) {
    console.error(`FAIL marker diverge: ${m} demo=${results.demo.markers[m]} oficial=${results.oficial.markers[m]}`);
    ok = false;
  }
}
if (results.demo.docVer !== results.oficial.docVer) {
  console.error(`FAIL doc js version demo=${results.demo.docVer} oficial=${results.oficial.docVer}`);
  ok = false;
}
if (results.demo.cssVer !== results.oficial.cssVer) {
  console.error(`FAIL css version demo=${results.demo.cssVer} oficial=${results.oficial.cssVer}`);
  ok = false;
}
if (results.demo.cssHasGrupos !== results.oficial.cssHasGrupos || !results.demo.cssHasGrupos) {
  console.error("FAIL css portal-loc-docs-grupos missing or diverge");
  ok = false;
}
const cssBusca = results.demo.cssHasBusca === results.oficial.cssHasBusca && results.demo.cssHasBusca;
if (!cssBusca) {
  console.error("FAIL css portal-loc-docs-busca missing or diverge");
  ok = false;
}
console.log(ok ? "PARITY OK" : "PARITY FAIL");
process.exit(ok ? 0 : 1);
