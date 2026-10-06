# Manifesto técnico — selo pré-migração (Instrução 18)

Leitura ao vivo em 2026-10-06, somente da nuvem (Redis `dk:portal:cloud_snapshot:v1` e Supabase `public.dk_cloud_snapshots` label `default`). Nenhum computador, localStorage, IndexedDB, OPFS ou Cache Storage foi consultado. Nenhuma migração relacional foi iniciada. A label `default` e a chave oficial não foram sobrescritas.

## Resultado

Redis e Supabase **não são idênticos** no JSON canônico (chaves de objeto ordenadas; ordem dos arrays preservada).

Nenhuma cópia de backup foi criada. Não houve reconciliação nem cópia de um lado sobre o outro.

| Lado | updated_at | bytes canônicos | chaves de 1º nível | SHA-256 canônico |
| --- | --- | --- | --- | --- |
| Redis | 2026-10-06T12:31:27.472Z | 5673559 | 47 | `459342404405ca58f72669cfb6673852d00c35cc1467464695eeeab82089c62b` |
| Supabase | 2026-10-06T12:30:42.918+00:00 | 5673559 | 47 | `c2682c5bccb7de5d18879735f7570c836a68377947b8f425ee3ac09183e486b7` |

Revisão Redis lida: `2026-10-06T12:31:27.472Z`. O `updated_at` mais recente é o do Redis (cerca de 45 segundos à frente). Linha Supabase lida: id `a1aa2173-a12a-455e-87bc-40d701ec5cbf`, label `default`.

## Cópias

| Destino | Nome | Estado |
| --- | --- | --- |
| Redis | `dk:portal:backup_pre_migracao:…` | não criada |
| Supabase | `backup-pre-migracao-…` | não criada |

Verificação pós-gravação: não se aplica. O retorno da leitura foi `backup_criado: false`.

## Diferenças de primeiro nível

Os dois lados têm a mesma quantidade de registros nestas chaves. O conteúdo canônico de parte dos registros difere.

| Chave | Redis | Supabase | Registros diferentes |
| --- | ---: | ---: | ---: |
| `dk_clientes_cadastro` | 418 | 418 | 417 |
| `dk_portal_clientes_cadastro` | 418 | 418 | 417 |
| `dk_veiculos_cadastro` | 194 | 194 | 194 |
| `dk_portal_veiculos_cadastro` | 194 | 194 | 194 |

## Docblobs

Enumerados, sem alteração e sem duplicar o conteúdo. Quantidade: 7. Soma dos bytes canônicos: 22054259. Os sete têm associação identificável. Um é da label oficial; seis são `docblob:demo` e não fazem parte da base oficial de negócio.

| Label | bytes | updated_at | SHA-256 |
| --- | ---: | --- | --- |
| `docblob:default:doc_1788230818106_gtyjmse` | 3919897 | 2026-09-01T02:47:01.143514+00:00 | `e495db06efe5be5a369241eecb538623a3b831ac42c1ad7eaea0b673a36ff00c` |
| `docblob:demo:doc_1781234571047_94orqri` | 3023417 | 2026-06-12T03:22:53.843666+00:00 | `7641611c129196dc1f2c46ae95878f68ef85b81dc7ba006cf8f6d41482e02d3f` |
| `docblob:demo:doc_1781234616008_bvfjpe9` | 3022837 | 2026-06-12T03:23:39.10442+00:00 | `fea07954497fc29d09569d3553d30f6a34c05ffdde110cc5c7fad610db265eab` |
| `docblob:demo:doc_1781234644461_0ob50xq` | 3020609 | 2026-06-12T03:24:07.463622+00:00 | `d626caa13c81bc808e7dbeaf99a8744d7d3421fdffde726f0412d496db9b7b1b` |
| `docblob:demo:doc_1781234678272_mv6qrg2` | 3020601 | 2026-06-12T03:24:43.8189+00:00 | `5e4437e371a7999bc7eefc068da1ca20e3e0dcf5e8cb1ca2502d69375f7ba923` |
| `docblob:demo:doc_1781234723236_g84uxdy` | 3027113 | 2026-06-12T03:25:30.015338+00:00 | `2f6700a04b520eb357e32481466fda631d6471a5132abc846a0b42d0ba25fdaa` |
| `docblob:demo:doc_1781234785285_ad04xqh` | 3019785 | 2026-06-12T03:26:27.718712+00:00 | `7f52861e7b78509e5c64dd3db3f3197f31cca1e7d44c9aa3028b26ab3bf298fc` |

## Riscos e inconsistências (sem correção)

- `RISCO_CRITICO_CREDENCIAL_PLAINTEXT = true`. Senhas em texto permanecem no JSON. Não foram impressas, removidas nem mascaradas.
  - `dk_clientes_cadastro`: senha preenchida em 418 registros; senha com hash em 1.
  - `dk_funcionarios_access`: senha preenchida em 10; senha com hash em 9.
  - `dk_portal_clientes_cadastro`: senha preenchida em 390; senha com hash em 1.
- Clientes na nuvem: 418 fichas, 418 CPF distintos, 417 códigos únicos. Há 1 código repetido, em 2 fichas.
- As duas listas de clientes têm os mesmos identificadores. Diferem em `updatedAt` (417) e em senha (28).
- As duas listas de veículos têm as mesmas placas. Diferem em `updatedAt` (194), `id` (3), `createdAt` (3) e em poucos campos de local, valor, proprietário e categoria.
- Estoque não está na nuvem.
- A Instrução 17 já tinha registado, sem usar como fonte: cadastros legados no Redis (clientes 427, locações 602), hashes financeiros parciais e ausência de `dk:portal:financeiro_ceo:v1`. Esses legados não foram recontados nesta leitura e não foram copiados.
- Como os hashes canônicos divergem, não existe ainda uma referência única restaurável. O selo fica pendente até uma decisão explícita sobre qual lado prevalece.
