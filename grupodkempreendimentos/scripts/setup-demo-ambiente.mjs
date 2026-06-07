#!/usr/bin/env node
/**
 * Checklist one-time: ligar demo.grupodkempreendimentos.com.br à branch demo na Vercel.
 * Executar: node grupodkempreendimentos/scripts/setup-demo-ambiente.mjs
 */
console.log(`
=== Ambiente DEMO + OFICIAL — configuração Vercel/DNS (one-time) ===

Já feito no código:
  • Oficial: https://grupodkempreendimentos.com.br  (branch main)
  • Demo:    https://demo.grupodkempreendimentos.com.br  (branch demo)
  • Faixa amarela "AMBIENTE DEMO" na demo
  • Dados nuvem separados (Supabase label "demo", Redis dk:portal:cloud_snapshot:demo:v1)

Passos na Vercel (dashboard):
  1. Projeto do site → Settings → Git → Production Branch = main
  2. Domains → Add demo.grupodkempreendimentos.com.br
     → Assign to Git Branch: demo
  3. (Opcional) Environment Variables → branch demo only:
     DK_DEPLOY_CHANNEL = demo

Passos no DNS (registador do domínio):
  • CNAME  demo  →  cname.vercel-dns.com  (ou o valor que a Vercel indicar)

Fluxo do programador:
  git checkout demo
  # alterações, commit, push
  node grupodkempreendimentos/scripts/test-portal-demo.mjs

Promover para oficial (após aprovação):
  git checkout main && git pull
  git merge demo
  git push origin main
  node grupodkempreendimentos/scripts/test-portal-producao.mjs

Como saber onde está:
  • URL sem "demo." e sem faixa amarela → OFICIAL
  • URL demo.grupodkempreendimentos.com.br ou faixa amarela → DEMO
  • Localhost com ?dk_channel=demo → simula demo

Testar demo agora (preview Vercel, se subdomínio ainda não existir):
  DK_TEST_BASE_URL=https://SEU-PROJETO-git-demo-USER.vercel.app/ \\
    node grupodkempreendimentos/scripts/test-portal-demo.mjs
`);
