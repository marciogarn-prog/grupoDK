/**
 * Repara index.html em UTF-8 e usa entidades HTML em símbolos (seta, ícones, travessão)
 * para não voltarem a corromper em edições no Windows.
 */
const fs = require("fs");
const path = require("path");

const file = path.join(__dirname, "..", "index.html");
let html = fs.readFileSync(file, "utf8");

/** Substitui sequências mojibake comuns (UTF-8 lido como Latin-1 / CP1252). */
const mojibake = [
  [/Ã¡/g, "á"],
  [/Ã©/g, "é"],
  [/Ã­/g, "í"],
  [/Ã³/g, "ó"],
  [/Ãº/g, "ú"],
  [/Ã£/g, "ã"],
  [/Ã§/g, "ç"],
  [/Ãµ/g, "õ"],
  [/Ã‚/g, "Â"],
  [/Ã‰/g, "É"],
  [/Ã"/g, "Ó"],
  [/Ãš/g, "Ú"],
  [/Ãƒ/g, "Ã"],
  [/Ã‡/g, "Ç"],
  [/â\?\?/g, "—"],
  [/â€"/g, "—"],
  [/â†/g, ""],
  [/Â·/g, "·"],
  [/Â /g, ""],
];
for (const [re, rep] of mojibake) {
  html = html.replace(re, rep);
}

/** Símbolos → entidades HTML (imunes a encoding do editor). */
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
  [/Petrolina [^·]+ PE [^<]+ <a/g, "Petrolina — PE · <a"],
];
for (const [re, rep] of symbolFixes) {
  html = html.replace(re, rep);
}

/** Textos fixos conhecidos (trechos críticos da UI). */
const literals = [
  ['aria-label="InÃ­cio"', 'aria-label="Início"'],
  ['negÃ³cio', "negócio"],
  ["locaÃ§Ã£o de veÃ­culos", "locação de veículos"],
  ["serviÃ§os automotivos", "serviços automotivos"],
  ['aria-label="NavegaÃ§Ã£o da unidade"', 'aria-label="Navegação da unidade"'],
  ["obrigatÃ³ria", "obrigatória"],
  ["nÃºmeros", "números"],
  ["Ãrea logada", "Área logada"],
  ["ConteÃºdo da unidade em preparaÃ§Ã£o.", "Conteúdo da unidade em preparação."],
  [">OperaÃ§Ã£o<", ">Operação<"],
  [">ManutenÃ§Ã£o<", ">Manutenção<"],
  ["telemÃ³vel", "telemóvel"],
  ["SincronizaÃ§Ã£o localhost", "Sincronização localhost"],
  ["faÃ§a redeploy", "faça redeploy"],
  ["sÃ³ no navegador", "só no navegador"],
  ["Settings â?? API", "Settings → API"],
  ["Empreendimentos â?? DK", "Empreendimentos — DK"],
  ["Empreendimentos?? DK", "Empreendimentos — DK"],
  ['content="Grupo DK Empreendimentos — DK Locadora, DK Centro Automotivo e DK Construtora. Petrolina-PE."', 'content="Grupo DK Empreendimentos — DK Locadora, DK Centro Automotivo e DK Construtora. Petrolina—PE."'],
  ["comercial â?? pesquisa", "comercial — pesquisa"],
  ["NÃƒO RESPONDER", "NÃO RESPONDER"],
  ["Selecioneâ?¦", "Selecione…"],
  ["Selecione?", "Selecione…"],
  ["MANUTENÃ‡ÃƒO", "MANUTENÇÃO"],
  ["manutenÃ§Ã£o", "manutenção"],
  ["locaÃ§Ã£o", "locação"],
  ["veÃ­culo", "veículo"],
  ["CÃ³digo", "Código"],
  ["NÂº", "Nº"],
  ["NÃºmero", "Número"],
  ["relatÃ³rios", "relatórios"],
  ["Ã ", "à "],
  ["botÃµes", "botões"],
  ["automÃ¡tico", "automático"],
  ["LanÃ§amento", "Lançamento"],
  ["nÂº do protocolo", "nº do protocolo"],
  ["trÃ¢nsito", "trânsito"],
  ["Ãšltima", "Última"],
  ["DESCRIÃ‡ÃƒO", "DESCRIÇÃO"],
  ["espÃ©cie", "espécie"],
  ["perÃ­odo", "período"],
  ["informaÃ§Ãµes", "informações"],
  ["funÃ§Ã£o", "função"],
  ["operaÃ§Ãµes", "operações"],
  ["VisÃ­vel", "Visível"],
  ["alteraÃ§Ãµes", "alterações"],
  ["GestÃ£o", "Gestão"],
  ["categoria Ã ", "categoria à "],
  ["Ã¡rea", "área"],
  ["devolvido/manutenÃ§Ã£o", "devolvido/manutenção"],
  ["PrÃ©-visualizaÃ§Ã£o", "Pré-visualização"],
  ["depende do relatÃ³rio", "depende do relatório"],
];
for (const [from, to] of literals) {
  if (html.includes(from)) html = html.split(from).join(to);
}

html = html.replace(
  /<meta name="description" content="[^"]*">/,
  '<meta name="description" content="Grupo DK Empreendimentos — DK Locadora, DK Centro Automotivo e DK Construtora. Petrolina-PE.">'
);

fs.writeFileSync(file, html, { encoding: "utf8" });

const buf = fs.readFileSync(file);
const ok =
  buf.includes(Buffer.from("Operação", "utf8")) &&
  buf.includes(Buffer.from("&larr; Voltar", "utf8")) &&
  buf.includes(Buffer.from("&#9670;", "utf8")) &&
  !buf.includes(Buffer.from("??? Voltar", "utf8"));
console.log(ok ? "index.html UTF-8 OK" : "AVISO: verificar index.html manualmente");
console.log("Manutenção:", buf.includes(Buffer.from("Manutenção", "utf8")));
