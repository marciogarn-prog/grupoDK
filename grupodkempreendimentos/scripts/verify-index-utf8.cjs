/**
 * Falha (exit 1) se index.html tiver padrões de encoding quebrado.
 */
const fs = require("fs");
const path = require("path");

const file = path.join(__dirname, "..", "index.html");
const buf = fs.readFileSync(file);
const text = buf.toString("utf8");

const badPatterns = ["??? Voltar", "Opera??o", "?? pesquisa", "\uFFFD", "MANUTEN??O", "NO RESPONDER"];
const required = [
  ["Operação", "Operação"],
  ["&larr; Voltar", "&larr; Voltar"],
  ["&#9670;", "&#9670;"],
  ["NÃO RESPONDER", "NÃO RESPONDER"],
  ["MANUTENÇÃO", "MANUTENÇÃO"],
  ["&mdash;", "&mdash; (travessão)"],
];

let failed = false;
for (const s of badPatterns) {
  if (text.includes(s)) {
    console.error("ERRO: padrão corrompido:", s);
    failed = true;
  }
}
for (const [needle, label] of required) {
  if (!text.includes(needle)) {
    console.error("ERRO: ausente:", label);
    failed = true;
  }
}
if (failed) process.exit(1);
console.log("verify-index-utf8: OK");
