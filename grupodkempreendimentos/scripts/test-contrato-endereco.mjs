/**
 * Valida endereço do locatário no contrato (placeholder legado vs cadastro real).
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function enderecoEhPlaceholder(value) {
  const text = String(value ?? "").trim();
  if (!text) return true;
  if (/^x+$/i.test(text.replace(/[\s.,/-]/g, ""))) return true;
  const norm = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, " ");
  if (norm.includes("endereco do cliente")) return true;
  if (norm.includes("{endereco") || norm.includes("(endereco")) return true;
  if (norm === "endereco nao cadastrado") return true;
  return false;
}

function portalEnderecoContratoValido(value) {
  return !enderecoEhPlaceholder(value);
}

function formatCepContrato(cep) {
  const d = String(cep || "").replace(/\D/g, "");
  if (d.length !== 8) return String(cep || "").trim();
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}

function formatMunicipioContrato(mun) {
  const raw = String(mun || "").trim();
  if (!raw || enderecoEhPlaceholder(raw)) return "";
  if (raw.includes("/")) {
    const parts = raw.split("/").map((s) => s.trim());
    const cidade = parts[0] || "";
    const uf = parts[1] || "";
    if (cidade && uf) {
      const cap = cidade.charAt(0).toUpperCase() + cidade.slice(1).toLowerCase();
      return `${cap}-${uf.toUpperCase()}`;
    }
  }
  return raw;
}

function formatEnderecoContratoLocatario(cliente) {
  if (!cliente) return "";
  const pickField = (keys) => {
    for (const k of keys) {
      const v = String(cliente[k] ?? "").trim();
      if (v && !enderecoEhPlaceholder(v)) return v;
    }
    return "";
  };
  const end = pickField(["endereco", "enderecoBase", "logradouro", "enderecoResidencia"]);
  const comp = pickField(["complemento", "enderecoComplemento"]);
  const mun = pickField(["municipioUf", "municipio"]);
  const cepRaw = pickField(["cep"]);
  const linhaEnd = [end, comp].filter(Boolean).join(", ");
  const munFmt = formatMunicipioContrato(mun);
  const cepFmt = formatCepContrato(cepRaw);
  const partes = [];
  if (linhaEnd) partes.push(linhaEnd);
  if (munFmt) partes.push(munFmt);
  if (cepFmt) partes.push(`cep ${cepFmt}`);
  return partes.join(" ");
}

function pickEnderecoMerge(local, bundled) {
  return portalEnderecoContratoValido(local)
    ? String(local).trim()
    : portalEnderecoContratoValido(bundled)
      ? String(bundled).trim()
      : "";
}

const bancoSrc = readFileSync(join(root, "data/dk-banco-cadastro.js"), "utf8");
const bancoMatch = bancoSrc.match(/window\.DK_BANCO_CADASTRO\s*=\s*(\{[\s\S]*\});?\s*$/);
if (!bancoMatch) throw new Error("DK_BANCO_CADASTRO não encontrado");
const banco = Function(`return (${bancoMatch[1]});`)();
const miqueias = banco.clientes.find((c) => String(c.cpf).replace(/\D/g, "") === "11377276406");
if (!miqueias) throw new Error("Cliente MIQUEIAS não encontrado no bundle");

const localComPlaceholder = {
  cpf: "11377276406",
  nome: "MIQUEIAS RODRIGUES MARTINS",
  endereco: "(Endereço do Cliente)",
  municipioUf: "",
  cep: "",
};

const enderecoMerge = pickEnderecoMerge(localComPlaceholder.endereco, miqueias.endereco);
const merged = {
  ...localComPlaceholder,
  endereco: enderecoMerge,
  municipioUf: miqueias.municipioUf,
  cep: miqueias.cep,
};
const formatado = formatEnderecoContratoLocatario(merged);
const esperado = "RUA M, 71 - N10 Petrolina-PE cep 56353-700";

let ok = true;
if (!portalEnderecoContratoValido("(Endereço do Cliente)")) {
  console.log("PASS | placeholder rejeitado");
} else {
  console.error("FAIL | placeholder aceito como endereço válido");
  ok = false;
}
if (enderecoMerge === "RUA M, 71 - N10") {
  console.log("PASS | merge usa endereço da planilha quando local é placeholder");
} else {
  console.error(`FAIL | merge endereco=${enderecoMerge}`);
  ok = false;
}
if (formatado === esperado) {
  console.log(`PASS | endereço contrato MIQUEIAS = ${formatado}`);
} else {
  console.error(`FAIL | esperado: ${esperado} | obtido: ${formatado}`);
  ok = false;
}

console.log(ok ? "CONTRATO ENDERECO OK" : "CONTRATO ENDERECO FAIL");
process.exit(ok ? 0 : 1);
