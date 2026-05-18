/**
 * Gera locacoes-receita-2026-import.js a partir de DK-FINANCEIRO 2026 - Copia.xlsx (RECEITA 2026).
 */
const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");

const root = path.join(__dirname, "..");
const xlsxPath = path.join(root, "DK-FINANCEIRO 2026 - Copia.xlsx");

function colLetter(n) {
  let s = "";
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function cell(ws, col, row) {
  return ws[`${colLetter(col)}${row}`];
}

function excelCellToBr(v) {
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    return `${String(v.getDate()).padStart(2, "0")}/${String(v.getMonth() + 1).padStart(2, "0")}/${v.getFullYear()}`;
  }
  const s = String(v ?? "").trim();
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) return s;
  return s;
}

function onlyDigits(x) {
  return String(x ?? "").replace(/\D/g, "");
}

function escapeJs(s) {
  return String(s ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/\r/g, "\\r")
    .replace(/\n/g, "\\n")
    .replace(/"/g, '\\"');
}

function formatBRL(n) {
  return `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function numVal(v) {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const n = Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

const wb = XLSX.readFile(xlsxPath, { cellDates: true });
const ws = wb.Sheets["RECEITA 2026"];
const hoje = new Date();
hoje.setHours(0, 0, 0, 0);

const lines = [
  "/* Importacao RECEITA 2026, linhas 9-386. Gerado por scripts/gerar-locacoes-receita-2026-import.cjs */",
  "const LOCACOES_RECEITA_2026_IMPORT = [",
];

let count = 0;
for (let row = 9; row <= 386; row++) {
  const proto = String(cell(ws, 5, row)?.v ?? cell(ws, 5, row)?.w ?? "").trim();
  const cpf = onlyDigits(cell(ws, 6, row)?.v ?? cell(ws, 6, row)?.w);
  const placa = String(cell(ws, 9, row)?.v ?? cell(ws, 9, row)?.w ?? "")
    .trim()
    .toUpperCase();
  if (cpf.length !== 11 || placa.length < 5) continue;
  if (!/^\d{10}$/.test(proto.replace(/\s/g, ""))) continue;

  const inicio = excelCellToBr(cell(ws, 12, row)?.v ?? cell(ws, 12, row)?.w);
  const fim = excelCellToBr(cell(ws, 14, row)?.v ?? cell(ws, 14, row)?.w);
  const diaPagto = String(cell(ws, 13, row)?.v ?? cell(ws, 13, row)?.w ?? "").trim();
  const pDias = cell(ws, 16, row)?.v ?? cell(ws, 16, row)?.w;
  const pdNum = numVal(pDias);
  const periodoLocacao = pdNum > 0 ? `${Math.round(pdNum)} dia(s)` : pDias ? `${pDias} dia(s)` : "";

  const alNum = numVal(cell(ws, 20, row)?.v ?? cell(ws, 20, row)?.w);
  const invNum = numVal(cell(ws, 21, row)?.v ?? cell(ws, 21, row)?.w);
  const plano = String(cell(ws, 22, row)?.v ?? cell(ws, 22, row)?.w ?? "").trim();
  const valorSemanal = String(cell(ws, 11, row)?.v ?? cell(ws, 11, row)?.w ?? "").trim();
  const marcaModelo = String(cell(ws, 10, row)?.v ?? cell(ws, 10, row)?.w ?? "").trim();

  let status = "ATIVO";
  if (fim) {
    const m = fim.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (m) {
      const df = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
      if (df < hoje) status = "FINALIZADO";
    }
  }

  const periodoContrato = plano.toUpperCase().includes("MINHA MOTO") ? "150 SEMANAS" : "1 SEMANA";

  lines.push(
    "    {",
    `      numeroContrato: "${proto}",`,
    `      cpf: "${cpf}",`,
    `      placa: "${escapeJs(placa)}",`,
    `      inicio: "${escapeJs(inicio)}",`,
    `      fim: "${escapeJs(fim)}",`,
    `      plano: "${escapeJs(plano)}",`,
    `      valorLocacao: "${escapeJs(formatBRL(alNum))}",`,
    `      valorInvestimento: "${escapeJs(formatBRL(invNum))}",`,
    `      valorSemanal: "${escapeJs(valorSemanal)}",`,
    `      valorParcela: "${escapeJs(formatBRL(alNum + invNum))}",`,
    `      statusLocacao: "${status}",`,
    `      diaPagto: "${escapeJs(diaPagto)}",`,
    `      periodoLocacao: "${escapeJs(periodoLocacao)}",`,
    `      modalidade: "MOTO",`,
    `      marcaModelo: "${escapeJs(marcaModelo)}",`,
    `      opcaoContrato: "${escapeJs(plano)}",`,
    `      periodoContrato: "${periodoContrato}",`,
    '      kmInicial: "",',
    '      configPrecoKm: "",',
    '      tabela: "",',
    '      clienteCodigo: "",',
    "    },"
  );
  count++;
}

lines.push("];");
const content = lines.join("\n") + "\n";

const dests = [
  path.join(root, "locacoes-receita-2026-import.js"),
  path.join(root, "grupodkempreendimentos", "locacoes-receita-2026-import.js"),
];
dests.forEach((d) => fs.writeFileSync(d, content, "utf8"));
console.log(`Gerado ${count} registos em:\n${dests.join("\n")}`);
