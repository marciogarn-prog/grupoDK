/**
 * Gera clientes-planilha-50.js — uma vez; não é necessário correr de novo.
 */
const fs = require("fs");
const path = require("path");

const fn = new Function(fs.readFileSync(path.join(__dirname, "../clientes-seed.js"), "utf8") + "\nreturn CLIENTES_SEED_DATA;");
const CLIENTES_SEED_DATA = fn();

const top5 = [
  {
    codigo: "1",
    dataCadastro: "sex 21/03/2025",
    cpf: "06242649551",
    nome: "FELIPE YAGO GOMES RIBEIRO",
    celular: "(74) 98807-1669",
    recado1: "(74) 98811-4082",
    recado2: "(74) 98854-0253",
    cnh: "7263800641",
    categoria: "A",
    vencimento: "15/04/2014",
    ear: "NAO",
    cep: "56.317-385",
    municipioUf: "PETROLINA/PE",
    enderecoBase: "RUA SABIA LARANJEIRA, 420 - PEDRA LINDA",
    complemento: "",
    endereco: "RUA SABIA LARANJEIRA, 420 - PEDRA LINDA",
  },
  {
    codigo: "2",
    dataCadastro: "sex 21/03/2025",
    cpf: "08360620451",
    nome: "MAGNO LOPES FERREIRA",
    celular: "(87) 99121-2060",
    recado1: "",
    recado2: "",
    cnh: "",
    categoria: "",
    vencimento: "",
    ear: "NAO",
    cep: "",
    municipioUf: "PETROLINA/PE",
    enderecoBase: "RUA SETENTA E UM, 191 - ANTÔNIO CASSIMIRO",
    complemento: "",
    endereco: "RUA SETENTA E UM, 191 - ANTÔNIO CASSIMIRO",
  },
  {
    codigo: "3",
    dataCadastro: "sáb 29/03/2025",
    cpf: "00175015431",
    nome: "ALOISIO DE SENA SILVA JUNIOR",
    celular: "(87) 99114-3391",
    recado1: "(87) 99158-1244",
    recado2: "(75) 98312-8822",
    cnh: "3711100333",
    categoria: "AB",
    vencimento: "06/01/2033",
    ear: "SIM",
    cep: "56.300-000",
    municipioUf: "PETROLINA/PE",
    enderecoBase: "RUA NOVE, 590 - JARDIM SÃO PAULO",
    complemento: "",
    endereco: "RUA NOVE, 590 - JARDIM SÃO PAULO",
  },
  {
    codigo: "4",
    dataCadastro: "qua 16/04/2025",
    cpf: "05019555456",
    nome: "ARISMAR BRAGA COSTA",
    celular: "",
    recado1: "",
    recado2: "",
    cnh: "",
    categoria: "",
    vencimento: "",
    ear: "NAO",
    cep: "48.924-999",
    municipioUf: "JUAZEIRO/BA",
    enderecoBase: "ILHA DO MASSANGANO, 101",
    complemento: "",
    endereco: "ILHA DO MASSANGANO, 101",
  },
  {
    codigo: "5",
    dataCadastro: "ter 22/04/2025",
    cpf: "70191100421",
    nome: "ERICLES DAMARES DA SILVA REIS",
    celular: "",
    recado1: "(87) 98148-8520",
    recado2: "",
    cnh: "",
    categoria: "",
    vencimento: "",
    ear: "SIM",
    cep: "56.323-230",
    municipioUf: "PETROLINA/PE",
    enderecoBase: "RUA SERRA TALHADA, 160 - VILA EDUARDO",
    complemento: "",
    endereco: "RUA SERRA TALHADA, 160 - VILA EDUARDO",
  },
];

function onlyDigits(s) {
  return String(s || "").replace(/\D/g, "");
}

function rowFromSeed(s, codigo) {
  const cpf = onlyDigits(s.cpf || "");
  const clean = (x) => (String(x || "").trim() === "XXXXX" ? "" : String(x || ""));
  const endereco = "";
  return {
    codigo: String(codigo),
    dataCadastro: "",
    cpf,
    nome: String(s.nome || "").trim(),
    celular: clean(s.celular),
    recado1: clean(s.recado1),
    recado2: clean(s.recado2),
    cnh: "",
    categoria: "",
    vencimento: "",
    ear: "",
    cep: "",
    municipioUf: "",
    enderecoBase: "",
    complemento: "",
    endereco,
  };
}

const rest = CLIENTES_SEED_DATA.slice(5, 50).map((s, i) => rowFromSeed(s, i + 6));
const all = [...top5, ...rest];

const out =
  "/**\n * 50 clientes alinhados à planilha: linhas 1–5 da captura; linhas 6–50 = índices 6–50 do clientes-seed.js.\n * Importação automática no primeiro carregamento do app (localStorage).\n */\nconst CLIENTES_PLANILHA_50 = " +
  JSON.stringify(all, null, 2) +
  ";\n";

fs.writeFileSync(path.join(__dirname, "../clientes-planilha-50.js"), out, "utf8");
console.log("Wrote clientes-planilha-50.js with", all.length, "records.");
