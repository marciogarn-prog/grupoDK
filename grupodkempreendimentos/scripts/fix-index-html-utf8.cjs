/**
 * Repara index.html em UTF-8; travessões/setas em entidades HTML quando possível.
 */
const fs = require("fs");
const path = require("path");

const file = path.join(__dirname, "..", "index.html");
let html = fs.readFileSync(file, "utf8");

const REPL = "\uFFFD";

/** Padrões com caractere de substituição + ? (encoding quebrado no Windows). */
const damaged = [
  [new RegExp(`${REPL}\\?\\?`, "g"), "&mdash;"],
  [new RegExp(`${REPL}\\?${REPL}\\?O`, "g"), "ÇÃO"],
  [new RegExp(`DESCRI${REPL}\\?${REPL}\\?O`, "g"), "DESCRIÇÃO"],
  [new RegExp(`${REPL}\\?ltima`, "g"), "Última"],
  [new RegExp(`${REPL}\\?LTIMA`, "g"), "ÚLTIMA"],
  [new RegExp(`${REPL}\\? necessário`, "g"), "É necessário"],
  [new RegExp(`N${REPL}\\?O RESPONDER`, "g"), "NÃO RESPONDER"],
  [new RegExp(`Selecione${REPL}\\?${REPL}\\?`, "g"), "Selecione&hellip;"],
  [new RegExp(`quantidade ${REPL}\\?\\? 1\\) ${REPL}\\? 7`, "g"), "quantidade &minus; 1) &times; 7"],
  [new RegExp(`N${REPL}\\?\\?1\\)${REPL}\\?7`, "g"), "N&minus;1)&times;7"],
  [new RegExp(`Settings ${REPL}\\?\\? API`, "g"), "Settings &rarr; API"],
  [/localhost \?\? site/g, "localhost &harr; site"],
  [new RegExp(`mensagem${REPL}\\?${REPL}`, "g"), "mensagem&hellip;"],
  [new RegExp(`Selecione${REPL}\\?${REPL}`, "g"), "Selecione&hellip;"],
  [new RegExp(` dias ${REPL}\\? custo`, "g"), " dias &times; custo"],
  [new RegExp(`contrato ${REPL}\\? quanto`, "g"), "contrato &times; quanto"],
  [new RegExp(`÷ 7 ${REPL}\\? tempo`, "g"), "&divide; 7 &times; tempo"],
  [new RegExp(`÷ 7\\) ${REPL}\\? tempo`, "g"), "&divide; 7) &times; tempo"],
  [new RegExp(`&mdash; 1\\) ${REPL}\\? 7`, "g"), "&mdash; 1) &times; 7"],
  [new RegExp(`\\(N&mdash;1\\)${REPL}\\?7`, "g"), "(N&minus;1)&times;7"],
];
for (const [re, rep] of damaged) {
  html = html.replace(re, rep);
}

/** Mojibake Latin-1 clássico. */
const mojibake = [
  [/Ã¡/g, "á"],
  [/Ã©/g, "é"],
  [/Ã­/g, "í"],
  [/Ã³/g, "ó"],
  [/Ãº/g, "ú"],
  [/Ã£/g, "ã"],
  [/Ã§/g, "ç"],
  [/Ãµ/g, "õ"],
  [/Ã‰/g, "É"],
  [/Ã"/g, "Ó"],
  [/Ãš/g, "Ú"],
  [/Ãƒ/g, "Ã"],
  [/Ã‡/g, "Ç"],
  [/â\?\?/g, "&mdash;"],
  [/â€"/g, "&mdash;"],
  [/Â·/g, "&middot;"],
];
for (const [re, rep] of mojibake) {
  html = html.replace(re, rep);
}

/** Ainda sobrou ?? como travessão (sem replacement char). */
html = html.replace(/ \?\? /g, " &mdash; ");

const symbolFixes = [
  [
    /<button type="button" class="portal-unit-bar__back btn-back btn-back--compact" data-back>[^<]*Voltar ao in[^<]*cio<\/button>/,
    '<button type="button" class="portal-unit-bar__back btn-back btn-back--compact" data-back>&larr; Voltar ao início</button>',
  ],
  [
    /(<button type="button" class="choice-card" data-go="locadora">[\s\S]*?<span class="choice-card__icon" aria-hidden="true">)[^<]+(<\/span>)/,
    "$1&#9670;$2",
  ],
  [
    /(<button type="button" class="choice-card" data-go="centro">[\s\S]*?<span class="choice-card__icon" aria-hidden="true">)[^<]+(<\/span>)/,
    "$1&#9671;$2",
  ],
  [
    /(<button type="button" class="choice-card" data-go="construtora">[\s\S]*?<span class="choice-card__icon" aria-hidden="true">)[^<]+(<\/span>)/,
    "$1&#9635;$2",
  ],
  [/<option value="">\?\?<\/option>/g, '<option value="">&mdash;</option>'],
  [/placeholder="\?\?"/g, 'placeholder="&mdash;"'],
  [/>\?\?<\/option>/g, ">&mdash;</option>"],
];
for (const [re, rep] of symbolFixes) {
  html = html.replace(re, rep);
}

html = html.replace(
  /<meta name="description" content="[^"]*">/,
  '<meta name="description" content="Grupo DK Empreendimentos &mdash; DK Locadora, DK Centro Automotivo e DK Construtora. Petrolina-PE.">'
);

fs.writeFileSync(file, html, { encoding: "utf8" });

const buf = fs.readFileSync(file);
const bad = buf.includes(Buffer.from(`${REPL}`, "utf8")) || buf.includes(Buffer.from("?? pesquisa", "utf8"));
const ok =
  buf.includes(Buffer.from("Operação", "utf8")) &&
  buf.includes(Buffer.from("&larr; Voltar", "utf8")) &&
  buf.includes(Buffer.from("NÃO RESPONDER", "utf8")) &&
  buf.includes(Buffer.from("MANUTENÇÃO", "utf8")) &&
  !bad;
console.log(ok ? "index.html UTF-8 OK" : "AVISO: ainda há caracteres corrompidos");
if (bad) console.log("  (procure U+FFFD ou ?? no ficheiro)");
