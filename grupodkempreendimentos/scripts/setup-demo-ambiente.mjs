#!/usr/bin/env node
/**
 * Checklist one-time: ligar demo.grupodkempreendimentos.com.br à branch demo na Vercel.
 * Executar: node grupodkempreendimentos/scripts/setup-demo-ambiente.mjs
 */
console.log(`
=== Ambiente DEMO + OFICIAL — Grupo DK ===

CONFIGURADO NA VERCEL (projeto grupo-dk):
  • Oficial: https://grupodkempreendimentos.com.br  → branch main
  • Demo:    https://demo.grupodkempreendimentos.com.br  → branch demo
  • Protecção SSO desligada para a demo ser pública (previews da branch demo)

Como saber onde está:
  • Oficial = URL sem "demo." e SEM faixa amarela
  • Demo    = demo.grupodkempreendimentos.com.br + faixa "AMBIENTE DEMO"

Fluxo do programador:
  git checkout demo
  # alterações, commit, push
  node grupodkempreendimentos/scripts/test-portal-demo.mjs

Promover para oficial:
  git checkout main && git pull && git merge demo && git push origin main
  node grupodkempreendimentos/scripts/test-portal-producao.mjs

Testes:
  Demo:    node grupodkempreendimentos/scripts/test-portal-demo.mjs
  Oficial: node grupodkempreendimentos/scripts/test-portal-producao.mjs
`);
