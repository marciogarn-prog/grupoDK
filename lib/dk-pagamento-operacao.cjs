/**
 * Traduz o verbo da loja para o verbo interno.
 * Não grava pagamento e não é chamado pela API.
 */
const MAPA = {
  criar: "create",
  create: "create",
  atualizar: "update",
  update: "update",
  remover: "remove",
  remove: "remove",
};

function normalizarOperacao(verbo) {
  const chave = String(verbo == null ? "" : verbo).trim();
  if (!Object.prototype.hasOwnProperty.call(MAPA, chave)) return "";
  return MAPA[chave];
}

module.exports = { normalizarOperacao };
