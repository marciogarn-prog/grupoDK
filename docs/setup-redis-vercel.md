# Redis (Upstash) na Vercel — configuração automática

O portal usa **duas** cópias na nuvem: Supabase + Redis (Upstash).

## Automático (recomendado)

Na raiz do repositório, com Vercel já ligado (`npx vercel login`):

```bash
node grupodkempreendimentos/scripts/setup-redis-vercel.mjs
```

1. Abre o browser nos **termos Upstash** (só na primeira vez — clique em aceitar).
2. Instala **Upstash for Redis** no projeto `grupo-dk`.
3. Faz **deploy** em produção.
4. Testa `https://grupodkempreendimentos.com.br/api/dk-cloud-snapshot`.

## Manual

1. [Vercel Marketplace — Upstash for Redis](https://vercel.com/marketplace/upstash/upstash-kv)
2. Add Integration → projeto **grupo-dk**
3. Redeploy

Variáveis criadas automaticamente: `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`.
