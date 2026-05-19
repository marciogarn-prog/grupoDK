const fs = require("fs");
const p = require("path").join(__dirname, "../index.html");
let s = fs.readFileSync(p, "utf8");
const line =
  '      <motion id="portalRelatorioPreview" class="portal-relatorio-preview hidden" aria-live="polite"></div>';
const fixed =
  '      <div id="portalRelatorioPreview" class="portal-relatorio-preview hidden" aria-live="polite"></div>';
if (!s.includes(line)) {
  console.error("line not found");
  process.exit(1);
}
s = s.replace(line, fixed);
fs.writeFileSync(p, s);
console.log("fixed");
