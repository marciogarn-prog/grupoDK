/**
 * Liga ou desliga a fonte oficial dos clientes.
 * Não copia linhas e não grava o snapshot.
 */
const { FLAG_REDIS, FONTE } = require("./dk-clientes-pg.cjs");

const SNAPSHOT = "snapshot";

function normalizarPedido(valor) {
  const pedido = String(valor || "").trim().toLowerCase();
  if (pedido === "pg" || pedido === FONTE) return FONTE;
  if (pedido === SNAPSHOT) return SNAPSHOT;
  return "";
}

function modoDe(valor) {
  return String(valor || "") === FONTE ? "pg" : SNAPSHOT;
}

async function lerFonte(redis) {
  const bruto = await redis.get(FLAG_REDIS);
  const valor = bruto == null ? "" : String(bruto);
  return { valor, modo: modoDe(valor) };
}

async function aplicarFonte(redis, pedido) {
  const destino = normalizarPedido(pedido);
  if (!destino) {
    return { status: 400, body: { ok: false, reason: "fonte" } };
  }
  const antes = await lerFonte(redis);
  await redis.set(FLAG_REDIS, destino);
  const agora = await lerFonte(redis);
  return {
    status: 200,
    body: {
      ok: true,
      chave: FLAG_REDIS,
      valorAntes: antes.valor,
      valorDepois: agora.valor,
      modoAntes: antes.modo,
      modoDepois: agora.modo,
      snapshotAlterado: false,
    },
  };
}

module.exports = {
  FLAG_REDIS,
  FONTE,
  SNAPSHOT,
  normalizarPedido,
  modoDe,
  lerFonte,
  aplicarFonte,
};
