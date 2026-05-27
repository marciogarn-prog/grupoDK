/**
 * Alias para openai-comprovante com perfil de extrato (mais tokens).
 * Mantido para URLs dedicadas; o portal usa /api/openai-comprovante?tipo=extrato.
 */
const comprovanteHandler = require("./openai-comprovante");

module.exports = async function handler(req, res) {
  if (req.method === "POST") {
    let body = req.body;
    if (typeof body === "string") {
      try {
        body = JSON.parse(body);
      } catch {
        body = {};
      }
    }
    if (body && !body.ping) {
      req.body = { ...body, tipo: "extrato", max_tokens: body.max_tokens || 4096 };
    }
  }
  return comprovanteHandler(req, res);
};
