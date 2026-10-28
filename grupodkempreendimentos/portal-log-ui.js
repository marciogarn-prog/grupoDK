/**
 * Tela do Log DK. Lê /api/dk-log ao abrir o painel e escreve só com textContent.
 */
(function () {
  var ESTADO_COM_FONTE = "Log DK — eventos duráveis registrados no servidor";
  var ESTADO_VAZIO = "Log DK — eventos duráveis registrados no servidor";
  var ESTADO_ERRO = "Não foi possível ler o Log no servidor.";

  function texto(valor) {
    return valor == null ? "" : String(valor);
  }

  function dataHora(valor) {
    var bruto = texto(valor);
    if (!bruto) return "";
    var data = new Date(bruto);
    if (Number.isNaN(data.getTime())) return bruto;
    return data.toLocaleString("pt-BR");
  }

  function celulasDoEvento(evento) {
    var item = evento && typeof evento === "object" ? evento : {};
    var payload = item.payload && typeof item.payload === "object" ? item.payload : {};
    var entidade = texto(item.entity_type);
    if (item.entity_id) entidade = entidade ? entidade + " " + texto(item.entity_id) : texto(item.entity_id);
    return [
      texto(item.seq),
      dataHora(item.created_at),
      item.actor_user_id ? texto(item.actor_user_id) : "Sistema",
      item.actor_session_id ? texto(item.actor_session_id) : "",
      texto(item.module),
      texto(item.event_type),
      entidade,
      texto(item.action) + (payload.message ? " — " + texto(payload.message) : ""),
    ];
  }

  function limpar(no) {
    while (no.firstChild) no.removeChild(no.firstChild);
  }

  function linhaTexto(linhas, mensagem) {
    limpar(linhas);
    var tr = document.createElement("tr");
    var td = document.createElement("td");
    td.colSpan = 8;
    td.textContent = mensagem;
    tr.appendChild(td);
    linhas.appendChild(tr);
  }

  function pintarEventos(eventos) {
    var estado = document.getElementById("portal-log-estado");
    var linhas = document.getElementById("portal-log-linhas");
    var nota = document.getElementById("portal-log-nota");
    if (nota) nota.textContent = "Clientes, veículos, locações e pagamentos ainda não geram eventos.";
    if (!linhas) return;
    if (!Array.isArray(eventos) || !eventos.length) {
      if (estado) estado.textContent = ESTADO_VAZIO;
      linhaTexto(linhas, "Nenhum evento");
      return;
    }
    if (estado) estado.textContent = ESTADO_COM_FONTE;
    limpar(linhas);
    eventos.forEach(function (evento) {
      var tr = document.createElement("tr");
      celulasDoEvento(evento).forEach(function (valor) {
        var td = document.createElement("td");
        td.textContent = valor;
        tr.appendChild(td);
      });
      linhas.appendChild(tr);
    });
  }

  function pintarErro() {
    var estado = document.getElementById("portal-log-estado");
    var linhas = document.getElementById("portal-log-linhas");
    if (estado) estado.textContent = ESTADO_ERRO;
    if (linhas) linhaTexto(linhas, "Falha na leitura");
  }

  function painelAberto() {
    var panel = document.getElementById("panel-log-locadora");
    return Boolean(panel && !panel.classList.contains("hidden"));
  }

  function carregar() {
    if (!painelAberto()) return;
    var headers = typeof window.__DK_portalApiHeaders === "function" ? window.__DK_portalApiHeaders() : {};
    fetch("/api/dk-log", { cache: "no-store", headers: headers })
      .then(function (resposta) {
        if (!painelAberto()) return null;
        if (!resposta.ok) {
          pintarErro();
          return null;
        }
        return resposta.json();
      })
      .then(function (corpo) {
        if (!corpo || !painelAberto()) return;
        if (corpo.fallback === true) {
          pintarErro();
          return;
        }
        pintarEventos(Array.isArray(corpo.events) ? corpo.events : []);
      })
      .catch(function () {
        if (painelAberto()) pintarErro();
      });
  }

  function observar() {
    var panel = document.getElementById("panel-log-locadora");
    if (!panel || panel.dataset.logUi === "1") return;
    panel.dataset.logUi = "1";
    var obs = new MutationObserver(function () {
      if (painelAberto()) carregar();
    });
    obs.observe(panel, { attributes: true, attributeFilter: ["class"] });
    if (painelAberto()) carregar();
  }

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", observar);
    else observar();
  }

  if (typeof module !== "undefined" && module.exports) module.exports = { celulasDoEvento: celulasDoEvento };
})();
