# Backup diário por e-mail (02:00 — Brasília)

O sistema envia automaticamente um ficheiro JSON com todos os cadastros da nuvem (Supabase + Redis) para **marciogarn@gmail.com** todos os dias às **02:00** (horário de Brasília).

## Configuração na Vercel

1. **Project → Settings → Environment Variables** (Production):

| Variável | Obrigatório | Descrição |
|----------|-------------|-----------|
| `CRON_SECRET` | Sim | Senha longa aleatória; a Vercel envia `Authorization: Bearer <valor>` no cron |
| `DK_BACKUP_EMAIL_TO` | Não | Destino(s); padrão `marciogarn@gmail.com` |
| `SUPABASE_URL` | Sim* | URL do projeto Supabase |
| `SUPABASE_ANON_KEY` | Sim* | Chave anon (ou `SUPABASE_SERVICE_ROLE_KEY`) |
| `UPSTASH_REDIS_REST_URL` | Recomendado | Redis dos cadastros portal |
| `UPSTASH_REDIS_REST_TOKEN` | Recomendado | Token Upstash |

\* Já usadas pelo portal; o cron reutiliza-as.

2. **Envio de e-mail** — configure **uma** das opções:

### Opção A — Gmail (recomendado para marciogarn@gmail.com)

| Variável | Valor |
|----------|--------|
| `SMTP_USER` | `marciogarn@gmail.com` |
| `SMTP_PASS` | [Senha de app Google](https://myaccount.google.com/apppasswords) (16 caracteres) |
| `DK_BACKUP_EMAIL_FROM` | `Grupo DK Backup <marciogarn@gmail.com>` |

### Opção B — Resend

| Variável | Valor |
|----------|--------|
| `RESEND_API_KEY` | Chave da API Resend |
| `RESEND_FROM` | Remetente verificado (ex.: `DK Backup <backup@grupodkempreendimentos.com.br>`) |

3. **Redeploy** do projeto após gravar as variáveis.

## Horário

O cron na Vercel usa **UTC**. `0 5 * * *` = **05:00 UTC** = **02:00** em `America/Sao_Paulo` (sem horário de verão).

## Teste manual

Substitua `SEU_CRON_SECRET` pelo valor definido em `CRON_SECRET`:

```bash
curl -s -H "Authorization: Bearer SEU_CRON_SECRET" "https://grupodkempreendimentos.com.br/api/cron-daily-backup"
```

Resposta esperada: `{"ok":true,"provider":"smtp",...}` e e-mail com anexo `dk-backup-AAAA-MM-DD.json` (ou `.json.gz` se for grande).

## Conteúdo do backup

- Snapshot Supabase (`dk_cloud_snapshots`, label `default`): clientes, veículos, locações, lançamentos, multas, manutenções, colaboradores, etc.
- Cópia Redis: cadastros sincronizados pelo portal (`dk:portal:*`).

O formato é compatível com **Exportar backup (JSON)** na área do administrador.
