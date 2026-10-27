/**
 * Liga ou desliga a fonte oficial das locações.
 * Não copia linhas e não grava o snapshot.
 */
const { FLAG_LOCACAO, FONTE_LOCACAO } = require("./dk-locacao-pg.cjs");

const SNAPSHOT = "snapshot";

function normalizarPedido(valor) {
  const pedido = String(valor || "").trim().toLowerCase();
  if (pedido === "pg" || pedido === FONTE_LOCACAO) return FONTE_LOCACAO;
  if (pedido === SNAPSHOT) return SNAPSHOT;
  return "";
}

function modoDe(valor) {
  return String(valor || "") === FONTE_LOCACAO ? "pg" : SNAPSHOT;
}

async function lerFonte(redis) {
  const bruto = await redis.get(FLAG_LOCACAO);
  const valor = bruto == null ? "" : String(bruto);
  return { valor, modo: modoDe(valor) };
}

async function aplicarFonte(redis, pedido) {
  const destino = normalizarPedido(pedido);
  if (!destino) return { status: 400, body: { ok: false, reason: "fonte" } };
  const antes = await lerFonte(redis);
  await redis.set(FLAG_LOCACAO, destino);
  const agora = await lerFonte(redis);
  return {
    status: 200,
    body: {
      ok: true,
      chave: FLAG_LOCACAO,
      valorAntes: antes.valor,
      valorDepois: agora.valor,
      modoAntes: antes.modo,
      modoDepois: agora.modo,
      snapshotAlterado: false,
    },
  };
}

module.exports = {
  FLAG_LOCACAO,
  FONTE_LOCACAO,
  SNAPSHOT,
  normalizarPedido,
  modoDe,
  lerFonte,
  aplicarFonte,
};
