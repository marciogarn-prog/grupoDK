/**
 * Gera locacoes-planilha-data.js a partir de dados de locação.xlsx (Excel COM).
 * Uso: node export-locacoes-planilha.cjs
 */
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = __dirname;

const fileName =
  fs.readdirSync(ROOT).find((n) => /^dados de loca.*\.xlsx$/i.test(String(n || ""))) || "";

if (!fileName) {
  console.error("Arquivo dados de locação.xlsx não encontrado na pasta do projeto.");
  process.exit(1);
}

const filePath = path.join(ROOT, fileName);
const psScript =
  "$ErrorActionPreference='Stop'; " +
  `$file='${String(filePath).replace(/'/g, "''")}'; ` +
  "$tmp = Join-Path $env:TEMP 'dk_locacoes_export.xlsx'; " +
  "Copy-Item -LiteralPath $file -Destination $tmp -Force; " +
  "$excel=New-Object -ComObject Excel.Application; " +
  "$excel.Visible=$false; $excel.DisplayAlerts=$false; " +
  "$wb=$excel.Workbooks.Open($tmp); " +
  "$ws=$null; " +
  "for($si=1; $si -le $wb.Worksheets.Count; $si++){ " +
  "  $cand=$wb.Worksheets.Item($si); $ur=$cand.UsedRange; if(-not $ur){ continue }; " +
  "  $cc=[int]$ur.Columns.Count; $heads=@(); " +
  "  for($c=1; $c -le $cc; $c++){ $heads += [string]$ur.Cells.Item(1,$c).Text }; " +
  "  $hasProt=$false; $hasPlaca=$false; " +
  "  foreach($h in $heads){ $hl=$h.ToLower(); if($hl.Contains('protocolo')){ $hasProt=$true }; if($hl.Contains('placa')){ $hasPlaca=$true } }; " +
  "  if($hasProt -and $hasPlaca){ $ws=$cand; break } " +
  "}; " +
  "if(-not $ws){ $ws=$wb.Worksheets.Item(1) }; " +
  "$used=$ws.UsedRange; " +
  "$rows=@(); $rowCount=$used.Rows.Count; $colCount=$used.Columns.Count; " +
  "$headers=@(); for($c=1;$c -le $colCount;$c++){ $headers += [string]$used.Cells.Item(1,$c).Text } " +
  "for($r=2;$r -le $rowCount;$r++){ " +
  "  $obj=[ordered]@{}; " +
  "  for($c=1;$c -le $colCount;$c++){ $h=[string]$headers[$c-1]; if(-not [string]::IsNullOrWhiteSpace($h)){ $obj[$h]=[string]$used.Cells.Item($r,$c).Text } } " +
  "  if($obj.Count -gt 0){ $rows += [pscustomobject]$obj } " +
  "} " +
  "$wb.Close($false); $excel.Quit(); " +
  "[System.Runtime.Interopservices.Marshal]::ReleaseComObject($wb) | Out-Null; " +
  "[System.Runtime.Interopservices.Marshal]::ReleaseComObject($excel) | Out-Null; " +
  "$rows | ConvertTo-Json -Depth 6";

let rows;
try {
  const stdout = execFileSync("powershell.exe", ["-NoProfile", "-Command", psScript], {
    cwd: ROOT,
    encoding: "utf8",
    maxBuffer: 30 * 1024 * 1024,
  });
  rows = JSON.parse(stdout || "[]");
} catch (e) {
  console.error("Falha ao ler planilha com Excel:", e.message || e);
  process.exit(1);
}

if (!Array.isArray(rows)) {
  console.error("Resposta inválida: esperado array de linhas.");
  process.exit(1);
}

/** Cabeçalhos Excel às vezes trazem \\n no meio do nome da coluna. */
function sanitizeLocacaoRowKeys(row) {
  if (!row || typeof row !== "object") return row;
  const out = {};
  for (const [k, v] of Object.entries(row)) {
    const nk = String(k)
      .replace(/\r?\n/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    out[nk] = v;
  }
  return out;
}

rows = rows.map(sanitizeLocacaoRowKeys);

const outPath = path.join(ROOT, "locacoes-planilha-data.js");
const banner = `/**
 * Base de locação (snapshot da planilha oficial).
 * A aplicação usa este ficheiro em vez de ler dados de locação.xlsx em tempo de execução.
 * Para atualizar: coloque a planilha na pasta do projeto e execute: node export-locacoes-planilha.cjs
 *
 * Fonte na exportação: ${fileName}
 * Linhas de dados: ${rows.length}
 * Exportado em: ${new Date().toISOString()}
 */
`;

const body = `${banner}const LOCACOES_PLANILHA_DATA = ${JSON.stringify(rows, null, 2)};\n`;
fs.writeFileSync(outPath, body, "utf8");
console.log(`OK: ${outPath} (${rows.length} linhas).`);
