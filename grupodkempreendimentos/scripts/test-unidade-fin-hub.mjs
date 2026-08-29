/**
 * Hub por empresa + 4 apps (Grupo DK / Locadora / Centro / Construtora).
 * node grupodkempreendimentos/scripts/test-unidade-fin-hub.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const locadoraUi = fs.readFileSync(path.join(root, "portal-locadora-ui.js"), "utf8");
const finJs = fs.readFileSync(path.join(root, "portal-unidade-financeiro.js"), "utf8");
const scopeJs = fs.readFileSync(path.join(root, "dk-app-scope.js"), "utf8");
const vercel = fs.readFileSync(path.join(root, "vercel.json"), "utf8");

const results = [];
function record(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} | ${name}${detail ? ` | ${detail}` : ""}`);
}

record("Hub unidade (Área Cliente/Empresa)", html.includes('id="view-unidade-hub"') && html.includes('data-unidade-go="cliente"'));
record("Área cliente em desenvolvimento", html.includes("SISTEMA EM DESENVOLVIMENTO"));
record("Área empresa com 3 botões", html.includes('id="view-unidade-empresa"') && html.includes('data-unidade-fin="receita"'));
record("Botão RECEITA", /data-unidade-fin="receita"[\s\S]*?>[\s\S]*RECEITA/.test(html));
record("Botão DESPESA", /data-unidade-fin="despesa"[\s\S]*?>[\s\S]*DESPESA/.test(html));
record("Botão BALANÇO", /data-unidade-fin="balanco"[\s\S]*?>[\s\S]*BALANÇO/.test(html));
record("Ícone Grupo DK fundo branco", html.includes("icon-grupodk-192.png") && html.includes("Ícone fundo branco"));
record("Ícone Locadora fundo preto", html.includes("icon-locadora-192.png") && html.includes("Ícone fundo preto"));
record("Ícone Centro fundo azul", html.includes("icon-centro-192.png") && html.includes("Ícone fundo azul"));
record("Ícone Construtora fundo cinza", html.includes("icon-construtora-192.png") && html.includes("Ícone fundo cinza"));

function readJson(name) {
  return JSON.parse(fs.readFileSync(path.join(root, name), "utf8"));
}
const manifests = {
  grupodk: readJson("manifest-corporativo.webmanifest"),
  locadora: readJson("manifest-locadora.webmanifest"),
  centro: readJson("manifest-centro.webmanifest"),
  construtora: readJson("manifest-construtora.webmanifest"),
};
record(
  "Manifests com id e start_url distintos",
  manifests.grupodk.id === "/" &&
    manifests.locadora.id === "/dklocadora" &&
    manifests.centro.id === "/dkcentroautomotivo" &&
    manifests.construtora.id === "/dkconstrutora" &&
    new Set(Object.values(manifests).map((m) => m.start_url)).size === 4
);
record(
  "Manifests com ícone e fundo por app",
  manifests.grupodk.background_color === "#ffffff" &&
    (manifests.grupodk.icons || []).some((i) => String(i.src).includes("icon-grupodk-")) &&
    manifests.locadora.background_color === "#000000" &&
    (manifests.locadora.icons || []).some((i) => String(i.src).includes("icon-locadora-")) &&
    manifests.centro.background_color === "#1565c0" &&
    (manifests.centro.icons || []).some((i) => String(i.src).includes("icon-centro-")) &&
    manifests.construtora.background_color === "#6b7280" &&
    (manifests.construtora.icons || []).some((i) => String(i.src).includes("icon-construtora-"))
);
record(
  "PNG dos 4 ícones no disco",
  ["grupodk", "locadora", "centro", "construtora"].every((n) =>
    fs.existsSync(path.join(root, "icons", `icon-${n}-192.png`)) &&
    fs.existsSync(path.join(root, "icons", `icon-${n}-512.png`))
  )
);

record("Instalar 4 apps na home", html.includes('data-app-install="grupodk"') && html.includes('href="/dklocadora?instalar=1"'));
record("Endereço /dkcentroautomotivo", html.includes("/dkcentroautomotivo"));
record("Endereço /dkconstrutora", html.includes("/dkconstrutora"));
record("Rewrite Vercel /dklocadora", vercel.includes('"/dklocadora"'));
record("openUnidadeHub no portal", locadoraUi.includes("function openUnidadeHub"));
record("App isolado por endereço", locadoraUi.includes("function portalAppScopeAllowsUnit"));

const store = new Map();
const sandbox = {
  window: {},
  document: {
    readyState: "complete",
    querySelector: () => null,
    addEventListener: () => {},
  },
  localStorage: {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
  },
};
sandbox.window = sandbox;
sandbox.window.location = { pathname: "/" };
vm.runInNewContext(scopeJs, sandbox);
const fromPath = sandbox.window.__DK_appScopeFromPath;
record("Scope / = Grupo DK", fromPath("/") === "grupodk" && fromPath("/index.html") === "grupodk");
record("Scope /dklocadora", fromPath("/dklocadora") === "locadora" && fromPath("/DKLOCADORA") === "locadora");
record("Scope /dkcentroautomotivo", fromPath("/dkcentroautomotivo") === "centro");
record("Scope /dkconstrutora", fromPath("/dkconstrutora") === "construtora");
record("Ícones exportados por app", sandbox.window.__DK_appScopeIcon?.grupodk?.includes("icon-grupodk") && sandbox.window.__DK_appScopeTheme?.locadora === "#000000");

vm.runInNewContext(finJs, sandbox);
const merge = sandbox.window.__DK_mergeUnidadeFinanceiro;
const totals = sandbox.window.__DK_unidadeFinanceiroTotals;
record("Export merge", typeof merge === "function");
record("Export totals", typeof totals === "function");

if (typeof merge === "function" && typeof totals === "function") {
  const merged = merge(
    [{ id: "a", unit: "centro", tipo: "receita", valor: 100, descricao: "os", data: "01/01/2026", updatedAt: 1 }],
    [{ id: "a", unit: "centro", tipo: "receita", valor: 250, descricao: "nuvem", data: "01/01/2026", updatedAt: 2 }]
  );
  record("Merge guarda o mais recente", merged[0]?.valor === 250 && merged[0]?.descricao === "nuvem");

  const totCentro = totals("centro", [
    { unit: "centro", tipo: "receita", valor: 1000 },
    { unit: "centro", tipo: "despesa", valor: 400 },
    { unit: "construtora", tipo: "receita", valor: 999 },
  ]);
  record("Balanço Centro = receita − despesa", totCentro.saldo === 600 && totCentro.receita === 1000);
  const totCons = totals("construtora", [
    { unit: "centro", tipo: "receita", valor: 1000 },
    { unit: "construtora", tipo: "despesa", valor: 80 },
  ]);
  record("Unidades isoladas no balanço", totCons.saldo === -80 && totCons.receita === 0);
}

const pass = results.filter((r) => r.ok).length;
console.log(`\n--- ${pass}/${results.length} testes hub unidade / 4 apps ---`);
process.exit(pass === results.length ? 0 : 1);
