# Exporta folha "CADASTRO VEÍCULOS" para veiculos-dk-financeiro-2026.js
$ErrorActionPreference = "Stop"
$xlsxPath = Join-Path $PSScriptRoot "..\DK-FINANCEIRO 2026 - Copia.xlsx"
$outPath = Join-Path $PSScriptRoot "..\veiculos-dk-financeiro-2026.js"

function Normalize-Plate([string]$s) {
  if ([string]::IsNullOrEmpty($s)) { return "" }
  return ($s.ToUpperInvariant() -replace "[^A-Z0-9]", "")
}

function Get-CadastroVeiculosSheet($wb) {
  for ($i = 1; $i -le $wb.Sheets.Count; $i++) {
    $name = $wb.Sheets.Item($i).Name
    $fold = $name.ToUpperInvariant().Normalize(
      [Text.NormalizationForm]::FormD) -replace '\p{Mn}', ''
    if ($fold -match 'CADASTRO' -and $fold -match 'VEICUL') {
      return $wb.Sheets.Item($i)
    }
  }
  throw "Folha CADASTRO VEICULOS / VEÍCULOS não encontrada."
}

function Infer-Tipo([string]$tag, [string]$marca) {
  $t = if ($tag) { $tag.ToUpperInvariant() } else { "" }
  if ($t -match "DKMT") { return "MOTO" }
  if ($t -match "DKCR") { return "CARRO" }
  $m = if ($marca) { $marca.ToUpperInvariant().Trim() } else { "" }
  if ($m -eq "CARRO") { return "CARRO" }
  if ($m -eq "MOTO") { return "MOTO" }
  return "CARRO"
}

$xl = New-Object -ComObject Excel.Application
$xl.Visible = $false
$xl.DisplayAlerts = $false
try {
  $wb = $xl.Workbooks.Open((Resolve-Path $xlsxPath).Path, $false, $true)
  $sh = Get-CadastroVeiculosSheet $wb
  $ur = $sh.UsedRange
  $nr = [int]$ur.Rows.Count

  $rows = New-Object System.Collections.Generic.List[object]
  # Folha com 13 colunas A–M: Tag, Placa, Codigo, Marca, Modelo, Valor, Cor, Chassi, Ano/Modelo, Renavam, Motor, Proprietario, Local
  for ($r = 2; $r -le $nr; $r++) {
    $tag = [string]$sh.Cells.Item($r, 1).Text
    $placaRaw = [string]$sh.Cells.Item($r, 2).Text
    $modelo = [string]$sh.Cells.Item($r, 5).Text
    $placa = Normalize-Plate $placaRaw

    if ([string]::IsNullOrWhiteSpace($placa)) { continue }
    if ([string]::IsNullOrWhiteSpace($modelo)) { continue }
    if ($placa -match "^(PLACA|TAG)$") { continue }

    $marca = [string]$sh.Cells.Item($r, 4).Text
    $tipo = Infer-Tipo $tag $marca

    $o = [ordered]@{
      numLinha     = ""
      tag          = $tag.Trim()
      placa        = $placaRaw.Trim().ToUpperInvariant()
      codigo       = ([string]$sh.Cells.Item($r, 3).Text).Trim()
      marca        = $marca.Trim()
      modelo       = $modelo.Trim()
      valor        = ([string]$sh.Cells.Item($r, 6).Text).Trim()
      cor          = ([string]$sh.Cells.Item($r, 7).Text).Trim()
      chassi       = ([string]$sh.Cells.Item($r, 8).Text).Trim()
      anoModelo    = ([string]$sh.Cells.Item($r, 9).Text).Trim()
      renavam      = ([string]$sh.Cells.Item($r, 10).Text).Trim()
      motor        = ([string]$sh.Cells.Item($r, 11).Text).Trim()
      proprietario = ([string]$sh.Cells.Item($r, 12).Text).Trim()
      local        = ([string]$sh.Cells.Item($r, 13).Text).Trim()
      tipo         = $tipo
      status       = "DISPONIVEL"
      id           = 1780000000 + $r
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
 * Veiculos: DK-FINANCEIRO 2026 - Copia.xlsx, folha CADASTRO VEICULOS.
 * Gerado por scripts/export-cadastro-veiculos-xlsx.ps1 (regenerar apos mudar o Excel).
 */
const VEICULOS_DK_FINANCEIRO_2026 = 
"@
$footer = ";`n"
[System.IO.File]::WriteAllText($outPath, ($header + $json + $footer), [System.Text.UTF8Encoding]::new($false))
Write-Host "Escrito:" $outPath " registos:" $rows.Count
$sync = Join-Path $PSScriptRoot "sync-portal-bundles.ps1"
if (Test-Path $sync) {
  try { & $sync } catch { Write-Host "Aviso: nao copiou para grupodkempreendimentos:" $_ }
}
