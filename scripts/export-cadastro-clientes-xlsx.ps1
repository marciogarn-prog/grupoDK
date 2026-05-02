# Exporta folha "CADASTRO CLIENTES" para clientes-dk-financeiro-2026.js
$ErrorActionPreference = "Stop"
$xlsxPath = Join-Path $PSScriptRoot "..\DK-FINANCEIRO 2026 - Copia.xlsx"
$outPath = Join-Path $PSScriptRoot "..\clientes-dk-financeiro-2026.js"

function Normalize-Ear([string]$s) {
  $t = ($s -replace "\s", "").ToUpperInvariant()
  if ($t -match "NAO|NÃO|N") { return "NAO" }
  if ($t -match "SIM|S") { return "SIM" }
  return $t
}

function Only-Digits([string]$s) {
  if ([string]::IsNullOrEmpty($s)) { return "" }
  return ($s -replace "\D", "")
}

$xl = New-Object -ComObject Excel.Application
$xl.Visible = $false
$xl.DisplayAlerts = $false
try {
  $wb = $xl.Workbooks.Open((Resolve-Path $xlsxPath).Path)
  $sh = $wb.Sheets.Item("CADASTRO CLIENTES")
  $ur = $sh.UsedRange
  $nr = [int]$ur.Rows.Count

  $rows = New-Object System.Collections.Generic.List[object]
  for ($r = 2; $r -le $nr; $r++) {
    $codigo = [string]$sh.Cells.Item($r, 1).Text
    $dataCadastro = [string]$sh.Cells.Item($r, 2).Text
    $cpfRaw = [string]$sh.Cells.Item($r, 3).Text
    $nome = [string]$sh.Cells.Item($r, 4).Text
    $cpf = Only-Digits $cpfRaw

    if ($cpf.Length -ne 11) { continue }
    if ([string]::IsNullOrWhiteSpace($nome)) { continue }

    $o = [ordered]@{
      codigo         = $codigo.Trim()
      dataCadastro   = $dataCadastro.Trim()
      cpf            = $cpf
      nome           = $nome.Trim()
      celular        = [string]$sh.Cells.Item($r, 5).Text
      recado1        = [string]$sh.Cells.Item($r, 6).Text
      recado2        = [string]$sh.Cells.Item($r, 7).Text
      cnh            = [string]$sh.Cells.Item($r, 8).Text
      categoria      = [string]$sh.Cells.Item($r, 9).Text
      vencimento     = [string]$sh.Cells.Item($r, 10).Text
      ear            = Normalize-Ear ([string]$sh.Cells.Item($r, 11).Text)
      cep            = [string]$sh.Cells.Item($r, 12).Text
      municipioUf    = [string]$sh.Cells.Item($r, 13).Text
      endereco       = [string]$sh.Cells.Item($r, 14).Text
      enderecoBase   = ""
      complemento    = ""
      status         = "ATIVO"
      id             = 1765000000 + $r
    }
    $rows.Add([PSCustomObject]$o) | Out-Null
  }

  $wb.Close($false)
}
finally {
  $xl.Quit() | Out-Null
  [System.Runtime.InteropServices.Marshal]::ReleaseComObject($xl) | Out-Null
}

$json = $rows | ConvertTo-Json -Depth 6 -Compress
$header = @"
/**
 * Clientes importados da planilha "DK-FINANCEIRO 2026 - Copia.xlsx", folha CADASTRO CLIENTES.
 * Gerado por scripts/export-cadastro-clientes-xlsx.ps1 — não editar à mão (regenerar após mudar o Excel).
 */
const CLIENTES_DK_FINANCEIRO_2026 = 
"@
$footer = ";`n"
[System.IO.File]::WriteAllText($outPath, ($header + $json + $footer), [System.Text.UTF8Encoding]::new($false))
Write-Host "Escrito:" $outPath " registos:" $rows.Count
$sync = Join-Path $PSScriptRoot "sync-portal-bundles.ps1"
if (Test-Path $sync) {
  try { & $sync } catch { Write-Host "Aviso: nao copiou para grupodkempreendimentos:" $_ }
}
