/**
 * Estado da pesquisa de locação.
 * A lista pesquisável sai de dk_locacao.
 * Uma resposta atrasada não pinta o contrato que o operador já trocou.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.__DK_pesquisaLocacaoEstado = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  function digitos(v) {
    return String(v || "").replace(/\D/g, "");
  }

  function protocolosDe(lista) {
    const set = new Set();
    (Array.isArray(lista) ? lista : []).forEach((loc) => {
      const nc = digitos(loc && (loc.numeroContrato || loc.protocolo));
      if (nc) set.add(nc);
    });
    return set;
  }

  function publicarProtocolosOficiais(lista) {
    const set = protocolosDe(lista);
    const w = typeof globalThis !== "undefined" ? globalThis : {};
    if (!set.size) return set;
    w.__DK_locacoesNuvemOk = true;
    w.__DK_locacoesNuvemProtocolos = set;
    w.__DK_locacoesPesquisaFonte = "dk_locacao";
    return set;
  }

  function pedir(ticket, contrato) {
    return {
      seq: (Number(ticket && ticket.seq) || 0) + 1,
      fonte: "dk_locacao",
      contratoPedido: digitos(contrato),
    };
  }

  function aindaE(ticket, seq) {
    return Boolean(ticket) && ticket.seq === seq;
  }

  function concluir(ticket, resposta) {
    if (!ticket || !resposta || resposta.seq !== ticket.seq) return { aplicado: false, ticket };
    if (resposta.fonte !== "dk_locacao") return { aplicado: false, ticket };
    if (ticket.contratoPedido && digitos(resposta.contrato) !== ticket.contratoPedido) {
      return { aplicado: false, ticket };
    }
    return {
      aplicado: true,
      ticket: {
        ...ticket,
        contratoVisivel: digitos(resposta.contrato),
        pagamentos: Array.isArray(resposta.pagamentos) ? resposta.pagamentos.slice() : [],
      },
    };
  }

  return { digitos, protocolosDe, publicarProtocolosOficiais, pedir, aindaE, concluir };
});
