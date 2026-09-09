/**
 * Recibo WhatsApp: imagem JPEG do modelo (mais leve que PDF).
 * node grupodkempreendimentos/scripts/test-lanc-recibo-whatsapp-imagem.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const results = [];

function record(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} | ${name}${detail ? ` | ${detail}` : ""}`);
}

const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const ui = fs.readFileSync(path.join(ROOT, "portal-locadora-ui.js"), "utf8");
const css = fs.readFileSync(path.join(ROOT, "styles.css"), "utf8");
const vendor = fs.existsSync(path.join(ROOT, "vendor/html2canvas.min.js"));

record("captura do cartão no HTML", html.includes('id="portalReciboShareCapture"'));
record("html2canvas no vendor", vendor);
record("gera JPEG", ui.includes('image/jpeg') && ui.includes("portalReciboDocParaImagemJpeg"));
record("partilha nativa com ficheiro", ui.includes("navigator.canShare") && ui.includes("files: [file]"));
record("fallback wa.me", ui.includes("wa.me/"));
record("cartão branco do modelo", css.includes(".portal-recibo-share-card") && css.includes("#c9a227"));
record("botão WhatsApp mantido", html.includes('id="portalReciboShareBtn"'));

const pass = results.filter((r) => r.ok).length;
console.log(`\n--- ${pass}/${results.length} recibo WhatsApp imagem ---`);
process.exit(pass === results.length ? 0 : 1);
