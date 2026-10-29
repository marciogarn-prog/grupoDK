/**
 * Tela do Log DK. Lê /api/dk-log ao abrir o painel e escreve só com textContent.
 * Hover e clique usam a lista já carregada. Não há polling.
 */
(function () {
  var ESTADO_COM_FONTE = "Log DK — eventos duráveis registrados no servidor";
  var ESTADO_VAZIO = "Log DK — eventos duráveis registrados no servidor";
  var ESTADO_ERRO = "Não foi possível ler o Log no servidor.";
  var memoria = [];
  var cursorAntes = 0;

  function texto(valor) {
    return valor == null ? "" : String(valor);
  }

  function mascarar(valor) {
    return texto(valor).replace(/\d{11}/g, "•••.•••.•••-••");
  }

  function partesTempo(valor) {
    var data = new Date(texto(valor));
    if (Number.isNaN(data.getTime())) return { dia: "", curto: texto(valor), cheio: texto(valor) };
    var hora = new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).format(data);
    var dia = new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(data);
    var hoje = new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(new Date());
    return { dia: dia, curto: dia === hoje ? hora : dia.slice(0, 5) + " " + hora, cheio: dia + " " + hora };
  }

  function resumo(evento) {
    var item = evento && typeof evento === "object" ? evento : {};
    if (item.summary) return mascarar(item.summary);
    if (item.event_type === "system.log_initialized") return "Log inicializado";
    if (item.event_type === "system.realtime_initialized") return "Realtime inicializado";
    return mascarar(item.action || item.event_type || "");
  }

  function resultado(evento) {
    var valor = texto(evento && evento.result);
    if (valor === "success" || valor === "") return "Concluído";
    if (valor === "denied") return "Negado";
    if (valor === "cancelled") return "Cancelado";
    if (valor === "rollback_confirmed") return "Revertido";
    return mascarar(valor);
  }

  function linhaCompacta(evento) {
    var item = evento && typeof evento === "object" ? evento : {};
    var numero = item.audit_no == null || item.audit_no === "" ? "—" : "#" + texto(item.audit_no);
    var usuario = item.actor_name || (item.actor_user_id ? mascarar(item.actor_user_id) : "Sistema");
    var maquina = item.device_label || (item.event_type && String(item.event_type).indexOf("system.") === 0 ? "servidor" : "");
    return [numero, partesTempo(item.created_at).curto, usuario, maquina, resumo(item)].filter(Boolean).join(" · ");
  }

  function limpar(no) {
    while (no && no.firstChild) no.removeChild(no.firstChild);
  }

  function paragrafo(pai, valor) {
    var p = document.createElement("p");
    p.className = "dk-log-campo";
    p.textContent = valor;
    pai.appendChild(p);
  }

  function passaFiltro(evento) {
    function contem(id, campo) {
      var el = document.getElementById(id);
      var q = texto(el && el.value).trim().toLowerCase();
      if (!q) return true;
      return texto(campo).toLowerCase().indexOf(q) >= 0;
    }
    return (
      contem("portal-log-filtro-usuario", evento.actor_name) &&
      contem("portal-log-filtro-modulo", evento.module) &&
      contem("portal-log-filtro-acao", evento.action || evento.event_type) &&
      contem("portal-log-filtro-resultado", resultado(evento))
    );
  }

  function pintarUsuarios(sessoes) {
    var box = document.getElementById("portal-log-usuarios");
    if (!box) return;
    limpar(box);
    var lista = Array.isArray(sessoes) ? sessoes : [];
    if (!lista.length) {
      paragrafo(box, "Nenhuma sessão ativa registrada nesta leitura.");
      return;
    }
    lista.forEach(function (sessao) {
      var p = document.createElement("p");
      p.className = "dk-log-usuario";
      var quando = partesTempo(sessao.entrada);
      var ultima = partesTempo(sessao.ultima);
      p.textContent =
        texto(sessao.prioridade) +
        " · " +
        texto(sessao.usuario) +
        " · " +
        texto(sessao.perfil) +
        " · " +
        texto(sessao.maquina) +
        " · entrada " +
        quando.cheio +
        " · última " +
        ultima.curto +
        " · " +
        texto(sessao.tela) +
        " · " +
        texto(sessao.status);
      box.appendChild(p);
    });
  }

  function pintarDetalhe(evento) {
    var box = document.getElementById("portal-log-detalhe");
    var titulo = document.getElementById("portal-log-detalhe-titulo");
    if (!box) return;
    limpar(box);
    if (!evento) {
      if (titulo) titulo.textContent = "Detalhes do evento";
      paragrafo(box, "Selecione um evento do Log.");
      return;
    }
    if (titulo) titulo.textContent = "Detalhes do evento #" + texto(evento.audit_no);
    var quando = partesTempo(evento.created_at);
    var campos = [
      "Número oficial: #" + texto(evento.audit_no),
      "Data/hora: " + quando.cheio,
      "Usuário: " + (evento.actor_name || "Sistema"),
      "Perfil: " + texto(evento.actor_role),
      "Máquina: " + texto(evento.device_label),
      "Módulo: " + texto(evento.module),
      "Entidade: " + texto(evento.entity_type) + (evento.entity_id ? " " + texto(evento.entity_id) : ""),
      "Evento: " + texto(evento.event_type),
      "Ação: " + texto(evento.action),
      "Resultado: " + resultado(evento),
      "operation_id: " + texto(evento.operation_id),
      "record_version: " + texto(evento.record_version),
      "Sequência técnica: " + texto(evento.seq),
      "Cursor interno de sincronização",
      "Resumo: " + resumo(evento),
    ];
    campos.forEach(function (linha) {
      paragrafo(box, linha);
    });
    var details = evento.details && typeof evento.details === "object" ? evento.details : {};
    Object.keys(details).forEach(function (chave) {
      paragrafo(box, chave + ": " + texto(details[chave]));
    });
  }

  function mostrarHover(evento, x, y) {
    var box = document.getElementById("portal-log-hover");
    if (!box || !evento) return;
    limpar(box);
    var quando = partesTempo(evento.created_at);
    ["Evento #" + texto(evento.audit_no), quando.cheio, evento.actor_name || "Sistema", texto(evento.actor_role), texto(evento.device_label), texto(evento.module), resumo(evento), "Resultado: " + resultado(evento)].forEach(function (linha) {
      if (!linha) return;
      paragrafo(box, linha);
    });
    box.hidden = false;
    box.style.left = Math.min(x + 12, window.innerWidth - 280) + "px";
    box.style.top = Math.min(y + 12, window.innerHeight - 180) + "px";
  }

  function esconderHover() {
    var box = document.getElementById("portal-log-hover");
    if (box) box.hidden = true;
  }

  function pintarEventos(eventos) {
    var estado = document.getElementById("portal-log-estado");
    var lista = document.getElementById("portal-log-lista");
    var nota = document.getElementById("portal-log-nota");
    if (nota) nota.textContent = "Clientes, veículos, locações e pagamentos ainda não geram eventos.";
    if (!lista) return;
    var visiveis = (Array.isArray(eventos) ? eventos : []).filter(passaFiltro);
    if (!visiveis.length) {
      if (estado) estado.textContent = ESTADO_VAZIO;
      limpar(lista);
      paragrafo(lista, "Nenhum evento");
      return;
    }
    if (estado) estado.textContent = ESTADO_COM_FONTE;
    limpar(lista);
    var diaAberto = "";
    visiveis.forEach(function (evento) {
      var dia = partesTempo(evento.created_at).dia;
      if (dia && dia !== diaAberto) {
        diaAberto = dia;
        var cab = document.createElement("p");
        cab.className = "dk-log-dia";
        cab.textContent = dia;
        lista.appendChild(cab);
      }
      var botao = document.createElement("button");
      botao.type = "button";
      botao.className = "dk-log-linha";
      botao.textContent = linhaCompacta(evento);
      botao.addEventListener("mouseenter", function (ev) {
        mostrarHover(evento, ev.clientX, ev.clientY);
      });
      botao.addEventListener("mousemove", function (ev) {
        mostrarHover(evento, ev.clientX, ev.clientY);
      });
      botao.addEventListener("mouseleave", esconderHover);
      botao.addEventListener("click", function () {
        esconderHover();
        Array.prototype.forEach.call(lista.querySelectorAll(".dk-log-linha"), function (el) {
          el.classList.remove("is-selecionada");
        });
        botao.classList.add("is-selecionada");
        pintarDetalhe(evento);
      });
      lista.appendChild(botao);
    });
  }

  function queryLog(antes) {
    var params = new URLSearchParams();
    params.set("limit", "50");
    params.set("tela", "Log DK");
    try {
      var nav = typeof navigator !== "undefined" ? navigator : {};
      if (nav.platform) params.set("maquina", String(nav.platform).slice(0, 40));
      if (nav.userAgent) params.set("navegador", /Edg\//.test(nav.userAgent) ? "Edge" : /Chrome\//.test(nav.userAgent) ? "Chrome" : "navegador");
    } catch (erro) {
      /* a lista abre mesmo sem o rótulo da máquina */
    }
    if (antes) params.set("before", String(antes));
    return params.toString();
  }

  function receber(corpo, anexar) {
    var eventos = Array.isArray(corpo.events) ? corpo.events : [];
    if (anexar) memoria = memoria.concat(eventos);
    else memoria = eventos.slice();
    var menor = memoria.reduce(function (acc, item) {
      var n = Number(item.audit_no);
      if (!Number.isFinite(n) || n <= 0) return acc;
      return acc === 0 ? n : Math.min(acc, n);
    }, 0);
    cursorAntes = menor;
    pintarUsuarios(corpo.sessoes);
    pintarEventos(memoria);
    var botao = document.getElementById("portal-log-anteriores");
    if (botao) botao.hidden = eventos.length < 50;
  }

  function pintarErro() {
    var estado = document.getElementById("portal-log-estado");
    var lista = document.getElementById("portal-log-lista");
    if (estado) estado.textContent = ESTADO_ERRO;
    if (lista) {
      limpar(lista);
      paragrafo(lista, "Falha na leitura");
    }
  }

  function painelAberto() {
    var panel = document.getElementById("panel-log-locadora");
    return Boolean(panel && !panel.classList.contains("hidden"));
  }

  function carregar(antes) {
    if (!painelAberto()) return;
    var headers = typeof window.__DK_portalApiHeaders === "function" ? window.__DK_portalApiHeaders() : {};
    fetch("/api/dk-log" + "?" + queryLog(antes), { cache: "no-store", headers: headers })
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
        receber(corpo, Boolean(antes));
      })
      .catch(function () {
        if (painelAberto()) pintarErro();
      });
  }

  function textoNo(id, valor) {
    var no = document.getElementById(id);
    if (no) no.textContent = valor == null ? "" : String(valor);
  }

  function dataHora(valor) {
    return partesTempo(valor).cheio;
  }

  function pintarMonitor() {
    if (typeof window.dkSyncGetStatus !== "function" || typeof window.dkSyncTextos !== "function") return;
    var textos = window.dkSyncTextos(window.dkSyncGetStatus());
    textoNo("portal-sync-servidor", textos.servidor);
    textoNo("portal-sync-navegador", textos.navegador);
    textoNo("portal-sync-lag", textos.atraso);
    textoNo("portal-sync-estado", textos.estado);
    textoNo("portal-sync-checkpoint", textos.checkpoint === "ainda não realizado" ? textos.checkpoint : dataHora(textos.checkpoint));
    textoNo("portal-sync-erro", textos.erro);
  }

  function observar() {
    var panel = document.getElementById("panel-log-locadora");
    if (!panel || panel.dataset.logUi === "1") return;
    panel.dataset.logUi = "1";
    var estavaAberto = false;
    function agendar() {
      var aberto = painelAberto();
      if (!aberto) {
        estavaAberto = false;
        esconderHover();
        return;
      }
      if (!estavaAberto) {
        carregar(0);
        if (typeof window.dkSyncCheckpoint === "function") {
          Promise.resolve(window.dkSyncCheckpoint("checkpoint")).catch(function () {});
        }
      }
      estavaAberto = true;
    }
    var obs = new MutationObserver(function () {
      agendar();
    });
    obs.observe(panel, { attributes: true, attributeFilter: ["class"] });
    ["portal-log-filtro-usuario", "portal-log-filtro-modulo", "portal-log-filtro-acao", "portal-log-filtro-resultado"].forEach(function (id) {
      var campo = document.getElementById(id);
      if (!campo) return;
      campo.addEventListener("input", function () {
        pintarEventos(memoria);
      });
    });
    var anteriores = document.getElementById("portal-log-anteriores");
    if (anteriores) {
      anteriores.addEventListener("click", function () {
        if (cursorAntes > 1) carregar(cursorAntes);
      });
    }
    pintarMonitor();
    pintarDetalhe(null);
    window.addEventListener("dk:sync:status", pintarMonitor);
    var botao = document.getElementById("btn-verificar-sync");
    if (botao && botao.dataset.syncUi !== "1") {
      botao.dataset.syncUi = "1";
      botao.addEventListener("click", function () {
        if (typeof window.dkSyncCheckpoint !== "function") return;
        Promise.resolve(window.dkSyncCheckpoint("manual")).then(pintarMonitor, pintarMonitor);
      });
    }
    if (painelAberto()) agendar();
  }

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", observar);
    else observar();
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = { linhaCompacta: linhaCompacta, mascarar: mascarar };
  }
})();
