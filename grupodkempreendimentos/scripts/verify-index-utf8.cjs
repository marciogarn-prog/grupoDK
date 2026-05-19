/**
 * Falha (exit 1) se index.html tiver padrões de encoding quebrado.
 * Uso: node scripts/verify-index-utf8.cjs
 */
const fs = require("fs");
const path = require("path");

const file = path.join(__dirname, "..", "index.html");
const buf = fs.readFileSync(file);
const bad = [
  "??? Voltar",
  "Opera??o",
  "Manuten??o",
  "InÃ­cio",
  "locaÃ§Ã£o",
];
const missing = [
  ["Operação", Buffer.from("Operação", "utf8")],
  ["&larr; Voltar", Buffer.from("&larr; Voltar", "utf8")],
  ["&#9670;", Buffer.from("&#9670;", "utf8")],
];

let failed = false;
for (const s of bad) {
  if (buf.includes(Buffer.from(s, "utf8"))) {
    console.error("ERRO: encontrado padrão corrompido:", s);
    failed = true;
  }
}
for (const [label, needle] of missing) {
  if (!buf.includes(needle)) {
    console.error("ERRO: ausente no index.html:", label);
    failed = true;
  }
}
if (failed) process.exit(1);
console.log("verify-index-utf8: OK");
