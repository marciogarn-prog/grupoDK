# Copia os bundles Financeiro 2026 e app.js para grupodkempreendimentos/ (mesma pasta que index.html do portal).
# Assim o portal funciona quando o servidor usa apenas essa pasta (localhost:3000 sem ../).
$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
Copy-Item -LiteralPath (Join-Path $root "app.js") `
  -Destination (Join-Path $root "grupodkempreendimentos\app.js") -Force
Copy-Item -LiteralPath (Join-Path $root "clientes-dk-financeiro-2026.js") `
  -Destination (Join-Path $root "grupodkempreendimentos\clientes-dk-financeiro-2026.js") -Force
Copy-Item -LiteralPath (Join-Path $root "veiculos-dk-financeiro-2026.js") `
  -Destination (Join-Path $root "grupodkempreendimentos\veiculos-dk-financeiro-2026.js") -Force
Copy-Item -LiteralPath (Join-Path $root "locacoes-receita-2026-import.js") `
  -Destination (Join-Path $root "grupodkempreendimentos\locacoes-receita-2026-import.js") -Force
Copy-Item -LiteralPath (Join-Path $root "grupodkempreendimentos\portal-locadora-ui.js") `
  -Destination (Join-Path $root "grupodkempreendimentos\portal-locadora-ui.js") -Force
Write-Host "Bundles copiados para grupodkempreendimentos/"
