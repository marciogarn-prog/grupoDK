/**
 * Copia dk_clientes_cadastro para public.dk_clientes.
 * Não faz cutover. Sai com código 1 se a validação não fechar.
 *
 * Uso no servidor, com SUPABASE_SERVICE_ROLE_KEY no ambiente:
 *   node scripts/migrar-clientes-snapshot-para-pg.mjs
 */
import { createRequire } from "module";
import path from "path";
import { fileURLToPath } from "url";

const require = createRequire(import.meta.url);
const copiar = require(path.join(path.dirname(fileURLToPath(import.meta.url)), "../lib/dk-clientes-copiar.cjs"));

const relatorio = await copiar.executarCopia();
const saida = {
  migrationId: relatorio.migrationId,
  aprovada: relatorio.aprovada,
  motivo: relatorio.motivo,
  r0: relatorio.r0 || "",
  r1: relatorio.r1 || "",
  fonte: relatorio.fonte || null,
  espelho: relatorio.espelho || null,
  destino: relatorio.destino || null,
  cursor1: relatorio.cursor1 || null,
  tabela: relatorio.tabela || null,
  fonteLigada: false,
};
console.log(JSON.stringify(saida, null, 2));
process.exit(relatorio.aprovada ? 0 : 1);
