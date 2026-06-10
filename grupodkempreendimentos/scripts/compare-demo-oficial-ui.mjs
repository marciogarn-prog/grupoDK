/**
 * Compara index.html e assets-chave entre demo e oficial (markers + bytes).
 */
import crypto from "crypto";

const PAIRS = [
  ["https://grupodkempreendimentos.com.br/", "oficial"],
  ["https://demo.grupodkempreendimentos.com.br/", "demo"],
];

const MARKERS = [
  "operacaoLocacaoDocumentosListaContrato",
  "operacaoLocacaoDocumentosListaCrlv",
  "Importar contrato",
  "Importar CRLV",
  "Visualizar",
  "operacaoLocacaoDocVagaContrato",
  "operacaoLocacaoDocVagaCrlv",
  "vaga única",
  "operacaoLocacaoDocSugestoesCrlv",
  "portal-loc-docs-grupos",
  "Confirmar",
  "Enviar para o cliente",
  "operacaoLocacaoDocumentosInput",
  "operacaoLocacaoDocumentosListaMulta",
  "operacaoLocacaoDocContratoBtn",
];

const BYTE_ASSETS = [
  "index.html",
  "portal-locacao-documentos.js",
  "portal-documentos.js",
  "portal-locadora-ui.js",
  "app.js",
  "styles.css",
  "service-worker-corporativo.js",
  "dk-pwa-update.js",
];

function sha256(text) {
  return crypto.createHash("sha256").update(text).digest("hex").slice(0, 16);
}

async function fetchText(url) {
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error(`${url} HTTP ${r.status}`);
  return r.text();
}

function verFromIndex(index, asset) {
  const re = new RegExp(`${asset.replace(".", "\\.")}\\?v=([^"']+)`);
  return (index.match(re) || [])[1] || "";
}

const results = {};
const assetHashes = { oficial: {}, demo: {} };

for (const [base, label] of PAIRS) {
  const index = await fetchText(`${base}index.html?_=${Date.now()}`);
  const docVer = verFromIndex(index, "portal-locacao-documentos.js") || "?";
  const cssVer = verFromIndex(index, "styles.css") || "?";
  const css = await fetchText(`${base}styles.css?v=${cssVer}&_=${Date.now()}`);
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
  assetHashes[label].index = sha256(index);
  for (const asset of BYTE_ASSETS) {
    if (asset === "index.html") continue;
    const ver = verFromIndex(index, asset);
    const q = ver ? `?v=${ver}&` : "?";
    const body = await fetchText(`${base}${asset}${q}_=${Date.now()}`);
    assetHashes[label][asset] = sha256(body);
  }
}

console.log(JSON.stringify({ results, assetHashes }, null, 2));

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
for (const asset of BYTE_ASSETS) {
  const o = assetHashes.oficial[asset];
  const d = assetHashes.demo[asset];
  if (o !== d) {
    console.error(`FAIL bytes diverge: ${asset} oficial=${o} demo=${d}`);
    ok = false;
  }
}
console.log(ok ? "PARITY OK" : "PARITY FAIL");
process.exit(ok ? 0 : 1);
