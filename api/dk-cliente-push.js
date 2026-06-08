/**
 * Web Push — app cliente DK (mensagens da operação).
 * Preferir /api/dk-cliente-geo?push=1 (rota já activa no deploy).
 */
const { handleClientePush } = require("../lib/dk-cliente-push-handler.cjs");

module.exports = handleClientePush;
