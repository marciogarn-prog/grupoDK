/**
 * Guarda de gravação com fencing (COMANDO 10/10) — PREPARADO, não ativado nas rotas reais.
 * Uso futuro: na mesma transação/RPC da gravação, chamar assertBloqueioValido(...).
 * Não usar HTTP separado de validação como única garantia.
 */
const { validar } = require("./dk-bc-tela-bloqueio.cjs");

/**
 * @param {object} ctx — { empresa_id, filial_id, tela_id, sessao_id, colaborador_ref, prefixo }
 * @param {string} concessaoId
 * @param {number} geracao
 * @param {object} [io]
 */
async function assertBloqueioValido(ctx, concessaoId, geracao, io) {
  if (!ctx || !concessaoId || geracao == null) {
    return { ok: false, reason: "bloqueio_ausente", valida: false };
  }
  const r = await validar(ctx, concessaoId, geracao, io);
  if (!r.ok || !r.valida) {
    return { ok: false, reason: r.reason || "fencing_ultrapassado", valida: false, geracao: r.geracao };
  }
  return { ok: true, valida: true, geracao: r.geracao };
}

/** Inventário de rotas de escrita que ainda NÃO chamam assertBloqueioValido. */
const ROTAS_ESCRITA_SEM_BLOQUEIO = [
  "api/dk-locacao.js (POST gravar/criar/atualizar/finalizar)",
  "api/dk-pagamento-locacao.js (POST)",
  "api/dk-manutencao.js (POST)",
  "api/dk-clientes-migrar.js (POST)",
  "api/dk-clientes-copiar.js (POST)",
  "api/dk-veiculos-copiar.js (POST)",
  "api/dk-locacoes-copiar.js (POST)",
  "api/dk-lancamento-nuvem.js (POST)",
  "api/dk-append-only-merge.js",
  "api/dk-sync.js (escrita parcial)",
  "api/dk-clientes-fonte.js (POST)",
  "api/dk-veiculos-fonte.js (POST)",
];

module.exports = {
  assertBloqueioValido,
  ROTAS_ESCRITA_SEM_BLOQUEIO,
  ativadoEmProducao: false,
};
