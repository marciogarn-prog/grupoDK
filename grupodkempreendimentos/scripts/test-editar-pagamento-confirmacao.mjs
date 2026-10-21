/**
 * Guardar um pagamento editado abre a confirmação do administrador
 * por cima do modal de edição. Se ficar atrás, o ecrã parece travado.
 * node scripts/test-editar-pagamento-confirmacao.mjs
 */
import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { chromium } from "playwright";

const portalDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const css = fs.readFileSync(path.join(portalDir, "styles.css"), "utf8");
const ui = fs.readFileSync(path.join(portalDir, "portal-locadora-ui.js"), "utf8");
const html = fs.readFileSync(path.join(portalDir, "index.html"), "utf8");

const results = [];
function record(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} | ${name}${detail ? ` | ${detail}` : ""}`);
}

function zIndexOf(source, selector) {
  const re = new RegExp(selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "[^{]*\\{[^}]*z-index:\\s*(\\d+)");
  const m = source.match(re);
  return m ? Number(m[1]) : 0;
}

const zEdit = zIndexOf(css, "#portalLancAluguelEditModal.portal-modal");
const zConfirm = zIndexOf(css, "#portalAdminAlteracaoConfirmModal.portal-modal");
record(
  "confirmação fica acima do modal de editar pagamento",
  zConfirm > zEdit && zEdit >= 10120,
  `editar=${zEdit} confirmar=${zConfirm}`
);
record(
  "abrir a confirmação força a mesma camada e o foco no botão",
  ui.includes('modal.style.zIndex = "10240"') &&
    ui.includes('document.getElementById("portalAdminAlteracaoConfirmSimBtn")?.focus()'),
  ""
);
record(
  "cache do CSS e do UI inclui a correção",
  html.includes("styles.css?v=20261021editar-pag") &&
    html.includes("portal-locadora-ui.js?v=20261021editar-pag"),
  ""
);

const server = http.createServer((req, res) => {
  const url = new URL(req.url || "/", "http://127.0.0.1");
  const rel = decodeURIComponent(url.pathname);
  if (rel !== "/styles.css") {
    res.writeHead(404);
    res.end("no");
    return;
  }
  res.writeHead(200, { "Content-Type": "text/css; charset=utf-8" });
  res.end(css);
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const port = server.address().port;

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  await page.setContent(
    `<!doctype html><html><head><link rel="stylesheet" href="http://127.0.0.1:${port}/styles.css"></head><body>
      <div id="portalLancAluguelEditModal" class="portal-modal" aria-hidden="false">
        <div class="portal-modal__backdrop"></div>
        <div class="portal-modal__card"><button type="button" id="portalLancAluguelEditSalvarBtn">Guardar</button></div>
      </div>
      <div id="portalAdminAlteracaoConfirmModal" class="portal-modal" aria-hidden="false">
        <div class="portal-modal__backdrop"></div>
        <div class="portal-modal__card">
          <button type="button" id="portalAdminAlteracaoConfirmSimBtn">Confirmar e guardar</button>
          <button type="button" id="portalAdminAlteracaoConfirmNaoBtn">Cancelar</button>
        </div>
      </div>
    </body></html>`,
    { waitUntil: "load" }
  );
  const hit = await page.evaluate(() => {
    const btn = document.getElementById("portalAdminAlteracaoConfirmSimBtn");
    const r = btn.getBoundingClientRect();
    const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    const zEdit = getComputedStyle(document.getElementById("portalLancAluguelEditModal")).zIndex;
    const zConfirm = getComputedStyle(document.getElementById("portalAdminAlteracaoConfirmModal")).zIndex;
    return {
      id: el && el.id,
      zEdit,
      zConfirm,
    };
  });
  record(
    "o clique em Confirmar e guardar acerta o diálogo da frente",
    hit.id === "portalAdminAlteracaoConfirmSimBtn" && Number(hit.zConfirm) > Number(hit.zEdit),
    `alvo=${hit.id} zEditar=${hit.zEdit} zConfirmar=${hit.zConfirm}`
  );
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}

const failed = results.filter((r) => !r.ok);
if (failed.length) {
  console.error(`FAIL ${failed.length}/${results.length}`);
  process.exit(1);
}
console.log(`OK ${results.length}/${results.length}`);
