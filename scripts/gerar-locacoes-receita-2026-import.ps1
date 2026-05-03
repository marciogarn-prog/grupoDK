# Gera locacoes-receita-2026-import.js a partir de "DK-FINANCEIRO 2026 - Copia.xlsx" (aba RECEITA 2026 = sheet14)
$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
if (-not (Test-Path (Join-Path $root "app.js"))) { throw "app.js nao encontrado a partir de $root" }
$zip = Join-Path $root "DK-FINANCEIRO 2026 - Copia.xlsx"
if (-not (Test-Path $zip)) { throw "Ficheiro nao encontrado: $zip" }

$tmp = Join-Path $env:TEMP "dk_gen_loc_import"
if (Test-Path $tmp) { Remove-Item $tmp -Recurse -Force }
Copy-Item -LiteralPath $zip -Destination ($tmp + ".zip")
Expand-Archive -LiteralPath ($tmp + ".zip") -DestinationPath $tmp -Force

$ssPath = Join-Path $tmp "xl\sharedStrings.xml"
$sheetPath = Join-Path $tmp "xl\worksheets\sheet14.xml"

$xml = New-Object System.Xml.XmlDocument
$xml.Load($ssPath)
$ns = New-Object System.Xml.XmlNamespaceManager($xml.NameTable)
$ns.AddNamespace("m", "http://schemas.openxmlformats.org/spreadsheetml/2006/main")
$silist = $xml.SelectNodes("//m:si", $ns)
$strings = New-Object System.Collections.Generic.List[string]
foreach ($si in $silist) {
  $txts = $si.SelectNodes(".//m:t", $ns)
  $sb = New-Object System.Text.StringBuilder
  foreach ($t in $txts) { [void]$sb.Append($t.InnerText) }
  $strings.Add($sb.ToString())
}

function Get-ColumnFromRef([string]$letters) {
  $n = 0
  foreach ($ch in $letters.ToUpperInvariant().ToCharArray()) { $n = $n * 26 + ([int]$ch - [int][char]'A' + 1) }
  return $n
}

function Get-CellValue([string]$t, [string]$innerV) {
  if ($t -eq "s") { return $strings[[int]$innerV] }
  return $innerV
}

function ExcelSerialToBr([object]$val) {
  if ($null -eq $val) { return "" }
  $s = "$val".Trim()
  if ($s -eq "") { return "" }
  $d = 0.0
  if ([double]::TryParse($s, [ref]$d)) {
    try {
      $dt = [DateTime]::FromOADate($d)
      return $dt.ToString("dd\/MM\/yyyy")
    } catch { return "" }
  }
  return $s
}

function Only-Digits([string]$x) {
  return ($x -replace '\D', '')
}

function Escape-JsString([string]$s) {
  if ($null -eq $s) { return "" }
  return ($s -replace '\\', '\\\\' -replace "`r", '\r' -replace "`n", '\n' -replace '"', '\"')
}

function Format-BRL([double]$n) {
  return ("R$ " + $n.ToString("N2", [cultureinfo]::GetCultureInfo("pt-BR")))
}

# Linhas 9 a 386 — mapa linha 8: E protocolo, F CPF, G cliente, I placa, J modelo, K valor plano, L inicio, M dia pg, N fim, P dias, T aluguel, U invest, V tipo plano
$rowMaps = @{}
$rs = [System.Xml.XmlReaderSettings]::new(); $rs.IgnoreWhitespace = $true
$r = [System.Xml.XmlReader]::Create($sheetPath, $rs)
$cellRef = $null; $cellType = $null
while ($r.Read()) {
  if ($r.NodeType -eq [System.Xml.XmlNodeType]::Element -and $r.LocalName -eq "c") {
    $cellRef = $r.GetAttribute("r"); $cellType = $r.GetAttribute("t")
  }
  elseif ($r.NodeType -eq [System.Xml.XmlNodeType]::Element -and $r.LocalName -eq "v" -and $cellRef) {
    $vText = $r.ReadInnerXml()
    $m = [regex]::Match($cellRef, '^([A-Z]+)(\d+)$')
    if ($m.Success) {
      $col = Get-ColumnFromRef $m.Groups[1].Value
      $rn = [int]$m.Groups[2].Value
      if ($rn -ge 9 -and $rn -le 386) {
        $val = Get-CellValue $cellType $vText
        if (-not $rowMaps.ContainsKey($rn)) { $rowMaps[$rn] = @{} }
        $rowMaps[$rn][$col] = $val
      }
    }
    $cellRef = $null
  }
}
$r.Close()

$hoje = [DateTime]::Today
$out = New-Object System.Collections.Generic.List[string]
$out.Add('/* Importacao RECEITA 2026, linhas 9-386. Gerado por scripts/gerar-locacoes-receita-2026-import.ps1 */')
$out.Add('const LOCACOES_RECEITA_2026_IMPORT = [')

foreach ($rn in ($rowMaps.Keys | Sort-Object {[int]$_})) {
  $cols = $rowMaps[$rn]
  $proto = "$($cols[5])".Trim()
  $cpfRaw = "$($cols[6])".Trim()
  $cpf = Only-Digits $cpfRaw
  $placa = "$($cols[9])".Trim().ToUpperInvariant()
  if ($cpf.Length -ne 11 -or $placa.Length -lt 5) { continue }
  if ($proto -notmatch '^\d{10}$') { continue }

  $inicio = ExcelSerialToBr $cols[12]
  $fimRawCell = $cols[14]
  $fim = ExcelSerialToBr $fimRawCell
  $diaPg = "$($cols[13])".Trim()
  $pDias = "$($cols[16])".Trim()
  $pdNum = 0.0
  if ([double]::TryParse($pDias.Replace(",", "."), [ref]$pdNum)) {
    $periodoLocacao = "$([math]::Round($pdNum, 0)) dia(s)"
  } else {
    $periodoLocacao = if ($pDias) { "$pDias dia(s)" } else { "" }
  }

  $vAlug = $cols[20]; $vInv = $cols[21]
  $alNum = 0.0; $invNum = 0.0
  [void][double]::TryParse("$vAlug".Replace(",", "."), [ref]$alNum)
  [void][double]::TryParse("$vInv".Replace(",", "."), [ref]$invNum)
  $parcela = $alNum + $invNum

  $valorLocacao = Format-BRL $alNum
  $valorInvestimento = Format-BRL $invNum
  $valorParcela = Format-BRL $parcela

  $plano = "$($cols[22])".Trim()
  $valorSemanal = "$($cols[11])".Trim()
  $marcaModelo = "$($cols[10])".Trim()

  $status = "ATIVO"
  if ($fim.Length -gt 0) {
    try {
      $di = [datetime]::ParseExact($fim, "dd/MM/yyyy", $null)
      if ($di.Date -lt $hoje.Date) { $status = "FINALIZADO" }
    } catch {}
  }

  $opcao = Escape-JsString $plano
  $periodoContrato = if ($plano.ToUpperInvariant().Contains("MINHA MOTO")) { "150 SEMANAS" } else { "1 SEMANA" }
  $modalidade = "MOTO"

  $obj = @(
    '    {',
    "      numeroContrato: `"$proto`",",
    "      cpf: `"$cpf`",",
    "      placa: `"$(Escape-JsString $placa)`",",
    "      inicio: `"$(Escape-JsString $inicio)`",",
    "      fim: `"$(Escape-JsString $fim)`",",
    "      plano: `"$opcao`",",
    "      valorLocacao: `"$(Escape-JsString $valorLocacao)`",",
    "      valorInvestimento: `"$(Escape-JsString $valorInvestimento)`",",
    "      valorSemanal: `"$(Escape-JsString $valorSemanal)`",",
    "      valorParcela: `"$(Escape-JsString $valorParcela)`",",
    "      statusLocacao: `"$status`",",
    "      diaPagto: `"$(Escape-JsString $diaPg)`",",
    "      periodoLocacao: `"$(Escape-JsString $periodoLocacao)`",",
    "      modalidade: `"$modalidade`",",
    "      marcaModelo: `"$(Escape-JsString $marcaModelo)`",",
    "      opcaoContrato: `"$opcao`",",
    "      periodoContrato: `"$periodoContrato`",",
    '      kmInicial: "",',
    '      configPrecoKm: "",',
    '      tabela: "",',
    '      clienteCodigo: "",',
    "    },"
  ) -join "`n"
  $out.Add($obj)
}

$out.Add('];')

$dest = Join-Path $root "locacoes-receita-2026-import.js"
[System.IO.File]::WriteAllLines($dest, $out, [System.Text.UTF8Encoding]::new($false))
Write-Host "Escrito $dest ($($out.Count) linhas)"
Write-Host "Registos no array (aprox): $(($out | Select-String -Pattern 'numeroContrato:').Count)"
