/**
 * Aplica bloco de cadastro de veículo (tipo/tag/placa combobox) em UTF-8.
 */
const fs = require("fs");
const path = require("path");

const file = path.join(__dirname, "..", "index.html");
let html = fs.readFileSync(file, "utf8");
const eol = html.includes("\r\n") ? "\r\n" : "\n";

function block(lines) {
  return lines.join(eol);
}

const oldBlock = block([
  '            <label class="portal-field">',
  '              <span>Nº</span>',
  '              <input type="text" id="operacaoVeiculoNum" name="numLinha" maxlength="12" inputmode="numeric" placeholder="Opcional" aria-label="Número da linha">',
  "            </label>",
  '            <label class="portal-field">',
  "              <span>Tag</span>",
  '              <input type="text" id="operacaoVeiculoTag" name="tag" maxlength="32" placeholder="Ex.: DKCR100" aria-label="Tag">',
  "            </label>",
  '            <label class="portal-field">',
  "              <span>Placa</span>",
  '              <input type="text" id="operacaoVeiculoPlaca" name="placa" list="operacaoVeiculoPlacaSugestoes" maxlength="10" required placeholder="ABC1D23" aria-label="Placa" autocomplete="off" aria-autocomplete="list">',
  '              <datalist id="operacaoVeiculoPlacaSugestoes"></datalist>',
  "            </label>",
]);

const newBlock = block([
  '            <label class="portal-field">',
  "              <span>Tipo</span>",
  '              <select id="operacaoVeiculoTipo" name="tipo" required aria-label="Tipo de veículo">',
  '                <option value="">Selecione…</option>',
  '                <option value="CARRO">CARRO</option>',
  '                <option value="MOTO">MOTO</option>',
  "              </select>",
  "            </label>",
  '            <label class="portal-field">',
  "              <span>Tag</span>",
  '              <input type="text" id="operacaoVeiculoTag" name="tag" maxlength="32" placeholder="Gerada automaticamente" aria-label="Tag" readonly tabindex="-1">',
  "            </label>",
  '            <label class="portal-field portal-field--combobox">',
  "              <span>Placa</span>",
  '              <motion class="portal-combobox" id="operacaoVeiculoPlacaCombo">',
  "                <input",
  '                  type="text"',
  '                  id="operacaoVeiculoPlaca"',
  '                  name="placa"',
  '                  maxlength="10"',
  "                  required",
  '                  placeholder="ABC1D23"',
  '                  aria-label="Placa"',
  '                  autocomplete="off"',
  '                  list="operacaoVeiculoPlacaSugestoes"',
  '                  aria-autocomplete="list"',
  '                  aria-expanded="false"',
  '                  aria-controls="operacaoVeiculoPlacaLista"',
  "                >",
  "                <motion",
  '                  id="operacaoVeiculoPlacaLista"',
  '                  class="portal-placa-dropdown hidden"',
  '                  role="listbox"',
  '                  aria-label="Placas cadastradas"',
  "                  hidden",
  "                ></motion>",
  "              </motion>",
  '              <datalist id="operacaoVeiculoPlacaSugestoes"></datalist>',
  "            </label>",
]).replace(/<motion/g, "<div").replace(/<\/motion>/g, "</div>");

if (!html.includes(oldBlock)) {
  if (html.includes("operacaoVeiculoTipo")) {
    console.log("Bloco de veículo já aplicado.");
  } else {
    console.error("Bloco antigo não encontrado — abortando.");
    process.exit(1);
  }
} else {
  html = html.replace(oldBlock, newBlock);
}

html = html
  .replace("app.js?v=20260518datas-protocolo", "app.js?v=20260518veiculo-tag-auto")
  .replace(
    "portal-locadora-ui.js?v=20260518lanc-multas-manut",
    "portal-locadora-ui.js?v=20260518pesquisa-ativo-fix"
  );

fs.writeFileSync(file, html, { encoding: "utf8" });

const buf = fs.readFileSync(file);
const ok =
  buf.includes(Buffer.from("Operação", "utf8")) &&
  buf.includes(Buffer.from("Manutenção", "utf8")) &&
  buf.includes(Buffer.from("← Voltar", "utf8"));
console.log(ok ? "UTF-8 OK" : "AVISO: acentos principais ausentes");
console.log("operacaoVeiculoTipo:", html.includes("operacaoVeiculoTipo") ? "sim" : "não");
