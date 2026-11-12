# Backup independente e restauração verificável — PostgreSQL (pré-ativação BC)

Documento de requisitos para **antes** de aplicar a infraestrutura BC em produção.
Nesta etapa (comando 01/10) **não** se executa migração nem backup em produção.

## Objectivo

Garantir que, antes de qualquer `CREATE`/`ALTER` de `dk_bc_*` no PostgreSQL oficial:

1. Existe um backup **independente** do cluster (não só snapshot de aplicação).
2. A restauração desse backup foi **provada** num ambiente isolado.
3. O rollback de `dk_bc_*` não afecta tabelas operacionais.

## Requisitos mínimos de backup

| Item | Requisito |
|------|-----------|
| Escopo | Cluster PostgreSQL oficial (Supabase project) — dump lógico ou físico |
| Independência | Ficheiro fora do projeto de aplicação; retenção separada do deploy |
| Integridade | SHA-256 do artefacto; registo de `backup_at` (UTC) |
| Conteúdo mínimo | Schemas de negócio oficiais + roles; **não** inclui só Redis |
| Segredos | Credenciais nunca no relatório nem no repositório git |
| Isolamento | Backup de produção **não** é alterado pelos testes BC |

## Procedimento proposto (futura activação)

1. Gerar dump lógico (`pg_dump` custom ou plain) do projecto oficial.
2. Calcular e guardar `SHA-256` do ficheiro.
3. Restaurar o dump num PostgreSQL **isolado** (instância descartável).
4. Correr smoke SQL: contagens de tabelas operacionais vs. produção (sem dados PII no relatório).
5. Só então aplicar `supabase/dk-bc-registro.sql` no isolado e validar testes.
6. Com autorização explícita, repetir aplicação no oficial.
7. Rollback seguro: `supabase/dk-bc-registro-rollback.sql` (DROP apenas `dk_bc_*`).

## Restauração verificável — checklist

- [ ] Dump obtido com timestamp e hash
- [ ] Restauração num host isolado concluiu sem erro
- [ ] Contagens/amostras de integridade (sem PII) batem certo
- [ ] Rollback BC testado no isolado (DROP + reaplicação)
- [ ] Contador `dk_bc_state` permanece em 0 até numeração autorizada

## Relação com Redis

O script `scripts/dk-bc-backup-pre-infra.mjs` cobre backup de leitura Redis (hub/VMs).
**Não substitui** o dump PostgreSQL exigido acima.

## Estado actual (01/10)

- Infra BC: código + testes isolados (PGlite / memória).
- Produção: **sem** migração BC aplicada nesta etapa.
- Numeração de cadastros existentes: **proibida**.
