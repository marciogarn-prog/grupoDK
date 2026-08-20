/**
 * Exporta Cad_Clientes, Cad_Veículos e Locação a partir da planilha extraída.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const tmp = path.join(__dirname, "../data/miel/planilha/_tmp-admin");
const outDir = path.join(__dirname, "../data/miel");

const ssXml = fs.readFileSync(path.join(tmp, "xl/sharedStrings.xml"), "utf8");
const strings = [];
for (const b of ssXml.split("<si>").slice(1)) {
  const inner = b.split("</si>")[0];
  if (inner.includes("<r>")) strings.push([...inner.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((m) => m[1]).join(""));
  else {
    const t = inner.match(/<t[^>]*>([\s\S]*?)<\/t>/);
    strings.push(t ? t[1] : "");
  }
}

function parseAttrs(tag) {
  const attrs = {};
  for (const m of tag.matchAll(/([\w:]+)="([^"]*)"/g)) attrs[m[1]] = m[2];
  return attrs;
}

function decodeXml(s) {
  return String(s ?? "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#10;/g, "\n")
    .replace(/&#13;/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");
}

function resolve(v, attrs) {
  if (v === "" || v == null) return "";
  if (attrs.t === "s") return decodeXml(strings[+v] ?? "");
  if (attrs.t === "str") return decodeXml(v);
  if (attrs.t === "b") return v === "1" || v === "true" ? "TRUE" : "FALSE";
  return v;
}

function excelSerialToIso(n) {
  const num = Number(n);
  if (!Number.isFinite(num) || num < 20000 || num > 80000) return String(n ?? "");
  const d = new Date(Date.UTC(1899, 11, 30) + Math.round(num) * 86400000);
  return d.toISOString().slice(0, 10);
}

function parseSheetRows(file) {
  const sheet = fs.readFileSync(path.join(tmp, "xl/worksheets", file), "utf8");
  const byRow = new Map();
  for (const row of sheet.match(/<row[^>]*>[\s\S]*?<\/row>/g) || []) {
    const rn = +(row.match(/r="(\d+)"/)?.[1] || 0);
    const cells = {};
    for (const cTag of row.match(/<c\b[^>]*\/>|<c\b[^>]*>[\s\S]*?<\/c>/g) || []) {
      const open = cTag.match(/^<c\b([^>]*)/)?.[1] || "";
      const attrs = parseAttrs(open);
      const ref = attrs.r || "";
      const col = ref.replace(/\d+$/, "");
      const selfClose = /\/\s*>$/.test(cTag);
      const inner = selfClose ? "" : cTag.replace(/^<c\b[^>]*>/, "").replace(/<\/c>$/, "");
      const v = selfClose ? "" : inner.match(/<v>([^<]*)<\/v>/)?.[1] ?? "";
      cells[col] = resolve(v, attrs);
    }
    byRow.set(rn, cells);
  }
  return byRow;
}

function hasCliente(c) {
  const nome = String(c.G || "").trim();
  const cpf = String(c.F || "").trim();
  return Boolean(nome && nome.length > 2 && !/^Cód/i.test(nome));
}

function hasVeiculo(c) {
  const cod = String(c.B || c.A || "").trim();
  const placa = String(c.G || "").trim();
  return Boolean(cod && (placa || c.I) && !/^Cód/i.test(cod));
}

const clientesRows = parseSheetRows("sheet12.xml");
const veiculosRows = parseSheetRows("sheet13.xml");

const clientes = [];
for (const [rn, c] of clientesRows) {
  if (rn < 12) continue;
  if (!hasCliente(c)) continue;
  const venc = excelSerialToIso(c.M);
  const cad = excelSerialToIso(c.E);
  clientes.push({
    id: `mc_xl_${rn}`,
    sheetRow: rn,
    cod: String(c.B || c.A || "").trim(),
    analise: String(c.C || "").trim(),
    statusProtocolo: String(c.D || "").trim(),
    dataCadastro: cad,
    cnpjCpf: String(c.F || "").trim(),
    cliente: String(c.G || "").trim(),
    celular: String(c.H || "").trim(),
    recados01: String(c.I || "").trim(),
    recados02: String(c.J || "").trim(),
    cnh: String(c.K || "").trim(),
    categoria: String(c.L || "").trim(),
    vencimento: venc,
    validacao: String(c.N || "").trim(),
    ear: String(c.O || "").trim(),
    cep: String(c.P || "").trim(),
    municipioUf: String(c.Q || "").trim(),
    endereco: String(c.R || "").trim(),
    alert: String(c.N || "").toUpperCase().includes("ALERTA") || String(c.D || "").toUpperCase().includes("ALERTA"),
  });
}

const veiculos = [];
for (const [rn, c] of veiculosRows) {
  if (rn < 18) continue;
  if (!hasVeiculo(c)) continue;
  veiculos.push({
    id: `mv_xl_${rn}`,
    sheetRow: rn,
    codigo: String(c.B || c.A || "").trim(),
    dataCadastro: excelSerialToIso(c.C),
    status: String(c.D || "").trim(),
    observacao: String(c.F || "").trim(),
    statusObs: String(c.E || "").trim(),
    placa: String(c.G || "").trim(),
    categoria: String(c.H || "").trim(),
    marca: String(c.I || "").trim(),
    modelo: String(c.J || "").trim(),
    cor: String(c.K || "").trim(),
    chassi: String(c.L || "").trim(),
    renavam: String(c.M || "").trim(),
    anoModelo: String(c.N || "").trim(),
    numMotor: String(c.O || "").trim(),
    emplacada: String(c.P || "").trim(),
    rastreador: String(c.Q || "").trim(),
    assegurada: String(c.R || "").trim(),
    proprietario: String(c.S || "").trim(),
    cnpjCpf: String(c.T || "").trim(),
    municipioUf: String(c.U || "").trim(),
    valorAquisicao: String(c.V || "").trim(),
  });
}

function normCpf(s) {
  return String(s || "").replace(/\D/g, "");
}
function normPlaca(s) {
  return String(s || "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase();
}
function normNome(s) {
  return String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

const locRows = parseSheetRows("sheet36.xml");
const locacoes = [];
for (const [rn, c] of locRows) {
  if (rn < 12) continue;
  const protocolo = String(c.B || c.A || "").trim();
  if (!/^20\d{8}$/.test(protocolo)) continue;
  locacoes.push({
    id: `ml_xl_${rn}`,
    sheetRow: rn,
    protocolo,
    status: String(c.C || "").trim(),
    dataInicio: excelSerialToIso(c.D),
    diaPagto: String(c.E || "").trim(),
    dataFim: excelSerialToIso(c.F),
    periodo: String(c.G || "").trim(),
    placa: String(c.I || c.H || "").replace(/-.*$/, "").trim(),
    categoria: String(c.J || "").trim(),
    marcaModelo: String(c.K || "").trim(),
    opcaoContrato: String(c.L || "").trim(),
    periodoContrato: String(c.M || "").trim(),
    kmRetirada: String(c.N || "").trim(),
    clienteNome: String(c.V || "").trim(),
  });
}

const vinculos = [];
const byCpf = new Map();
const byNome = new Map();
clientes.forEach((cl) => {
  const k = normCpf(cl.cnpjCpf);
  if (k) byCpf.set(k, cl);
  const n = normNome(cl.cliente);
  if (n) byNome.set(n, cl);
});
const byPlaca = new Map();
veiculos.forEach((v) => {
  const p = normPlaca(v.placa);
  if (p) byPlaca.set(p, v);
  const k = normCpf(v.cnpjCpf);
  const cl = k ? byCpf.get(k) : null;
  if (cl) {
    vinculos.push({
      tipo: "veiculo-proprietario-cpf",
      veiculoId: v.id,
      veiculoCodigo: v.codigo,
      placa: v.placa,
      clienteId: cl.id,
      clienteNome: cl.cliente,
      cnpjCpf: cl.cnpjCpf,
    });
  }
});

locacoes.forEach((loc) => {
  const cl = byNome.get(normNome(loc.clienteNome));
  const v = byPlaca.get(normPlaca(loc.placa));
  if (cl) loc.clienteId = cl.id;
  if (v) loc.veiculoId = v.id;
  if (cl && v) {
    vinculos.push({
      tipo: "locacao-cliente-veiculo",
      locacaoId: loc.id,
      protocolo: loc.protocolo,
      status: loc.status,
      veiculoId: v.id,
      veiculoCodigo: v.codigo,
      placa: v.placa,
      clienteId: cl.id,
      clienteNome: cl.cliente,
      cnpjCpf: cl.cnpjCpf,
    });
  }
});

fs.mkdirSync(outDir, { recursive: true });
const payload = { clientes, veiculos, locacoes, vinculos };
fs.writeFileSync(path.join(outDir, "miel-cadastros.json"), JSON.stringify(payload));
const js = `window.__DK_MIEL_CADASTROS = ${JSON.stringify(payload)};\n`;
fs.writeFileSync(path.join(outDir, "miel-cadastros.js"), js);

console.log("clientes", clientes.length);
console.log("veiculos", veiculos.length);
console.log("locacoes", locacoes.length);
console.log("vinculos", vinculos.length);
console.log("locacoes com cliente", locacoes.filter((l) => l.clienteId).length);
console.log("locacoes com veiculo", locacoes.filter((l) => l.veiculoId).length);
console.log("js bytes", js.length);
