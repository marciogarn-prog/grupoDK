const fs = require("fs");
const path = require("path");
const p = path.join(__dirname, "clientes-dk-financeiro-2026.js");
const txt = fs.readFileSync(p, "utf8");
const i = txt.indexOf("[");
const j = txt.lastIndexOf("]");
const data = JSON.parse(txt.slice(i, j + 1));
const rows = data
  .map((c, idx) => {
    const codeRaw = String(c.codigo || "").trim();
    const num = parseInt(codeRaw, 10);
    return {
      num: Number.isFinite(num) ? num : idx + 1,
      nome: String(c.nome || "").trim(),
      cpf: String(c.cpf || "").trim(),
    };
  })
  .sort((a, b) => a.num - b.num);
const out = path.join(__dirname, "lista-clientes-base-oficial.txt");
const head = [
  "# Base oficial: clientes-dk-financeiro-2026.js",
  `# Total: ${rows.length} registos (numeracao da planilha tem lacunas, ex.: sem 10, 16, 161).`,
  "# Formato: CLIENTE N | Nome | CPF",
  "",
];
const lines = rows.map((r) => `CLIENTE ${r.num} | ${r.nome} | ${r.cpf}`);
fs.writeFileSync(out, [...head, ...lines].join("\n"), "utf8");
console.log("Escrito:", out);
console.log("Primeiro:", lines[0]);
console.log("Ultimo:", lines[lines.length - 1]);
