/**
 * Cursor do Log em memória. Lê GET /api/dk-sync e não grava cadastro.
 * O cursor existe só nesta página. Recarregar recomeça em after=0.
 */
(function (root) {
  var state = {
    lastAppliedSeq: 0,
    syncInFlight: false,
    syncPending: false,
    lastServerSeq: 0,
    lastError: null,
    initialized: false,
    lastCheckpointAt: null,
  };
  var transporte = null;
  var limite = 100;
  var ouvintes = [];
  var volta = null;
  var MAX_PAGINAS = 30;

  function configurar(opcoes) {
    if (!opcoes || typeof opcoes !== "object") return;
    if (Object.prototype.hasOwnProperty.call(opcoes, "transporte")) transporte = opcoes.transporte;
    if (opcoes.limite != null) limite = opcoes.limite;
  }

  function reset() {
    state.lastAppliedSeq = 0;
    state.syncInFlight = false;
    state.syncPending = false;
    state.lastServerSeq = 0;
    state.lastError = null;
    state.initialized = false;
    state.lastCheckpointAt = null;
    volta = null;
    ouvintes = [];
  }

  function estado() {
    return {
      lastAppliedSeq: state.lastAppliedSeq,
      lastServerSeq: state.lastServerSeq,
      syncInFlight: state.syncInFlight,
      lastError: state.lastError,
    };
  }

  function atraso(serverSeq, appliedSeq) {
    var servidor = Number(serverSeq);
    var navegador = Number(appliedSeq);
    if (!Number.isFinite(servidor)) servidor = 0;
    if (!Number.isFinite(navegador)) navegador = 0;
    return Math.max(0, servidor - navegador);
  }

  function dkSyncGetStatus() {
    return {
      lastAppliedSeq: state.lastAppliedSeq,
      lastServerSeq: state.lastServerSeq,
      lag: atraso(state.lastServerSeq, state.lastAppliedSeq),
      syncInFlight: state.syncInFlight,
      syncPending: state.syncPending,
      initialized: state.initialized,
      lastError: state.lastError,
      lastCheckpointAt: state.lastCheckpointAt,
    };
  }

  function dkSyncRotulo(status) {
    var s = status || dkSyncGetStatus();
    if (s.syncInFlight) return "Sincronizando";
    if (s.lastError) return "Erro";
    if (!s.initialized) return "Inicializando";
    if (Number(s.lag) > 0) return "Atrasado";
    return "Sincronizado";
  }

  function dkSyncTextos(status) {
    var s = status || dkSyncGetStatus();
    return {
      servidor: "seq " + s.lastServerSeq,
      navegador: "seq " + s.lastAppliedSeq,
      atraso: s.lag + " evento(s)",
      estado: dkSyncRotulo(s),
      checkpoint: s.lastCheckpointAt ? String(s.lastCheckpointAt) : "ainda não realizado",
      erro: s.lastError ? String(s.lastError) : "",
    };
  }

  function emitirStatus() {
    var detalhe = dkSyncGetStatus();
    if (root && typeof root.dispatchEvent === "function" && typeof root.CustomEvent === "function") {
      try {
        root.dispatchEvent(new root.CustomEvent("dk:sync:status", { detail: detalhe }));
      } catch (erro) {
        /* o painel não pode derrubar o cursor */
      }
    }
    return detalhe;
  }

  function assinar(fn) {
    if (typeof fn !== "function") return function () {};
    ouvintes.push(fn);
    return function () {
      ouvintes = ouvintes.filter(function (item) {
        return item !== fn;
      });
    };
  }

  function emitir(detalhe) {
    ouvintes.slice().forEach(function (fn) {
      try {
        fn(detalhe);
      } catch (erro) {
        /* o consumidor não pode derrubar o cursor */
      }
    });
    if (root && typeof root.dispatchEvent === "function" && typeof root.CustomEvent === "function") {
      try {
        root.dispatchEvent(new root.CustomEvent("dk:sync:event", { detail: detalhe }));
      } catch (erro) {
        /* notificação interna */
      }
    }
  }

  function detalheSeguro(evento) {
    var seq = Number(evento && evento.seq);
    if (evento && evento.restricted === true) return { seq: seq, restricted: true };
    return {
      seq: seq,
      restricted: false,
      event_type: evento && evento.event_type != null ? String(evento.event_type) : "",
      entity_type: evento && evento.entity_type != null ? String(evento.entity_type) : "",
      action: evento && evento.action != null ? String(evento.action) : "",
      module: evento && evento.module != null ? String(evento.module) : "",
    };
  }

  function validarOrdem(events) {
    var prev = null;
    for (var i = 0; i < events.length; i++) {
      var seq = Number(events[i] && events[i].seq);
      if (!Number.isFinite(seq) || seq < 0 || Math.floor(seq) !== seq) return false;
      if (prev !== null && seq <= prev) return false;
      prev = seq;
    }
    return true;
  }

  function aplicarPagina(events) {
    if (!validarOrdem(events)) {
      state.lastError = "ordem_invalida";
      return { ok: false, reason: "ordem_invalida" };
    }
    var novos = [];
    for (var i = 0; i < events.length; i++) {
      var seq = Number(events[i].seq);
      if (seq <= state.lastAppliedSeq) continue;
      state.lastAppliedSeq = seq;
      novos.push(detalheSeguro(events[i]));
    }
    novos.forEach(emitir);
    return { ok: true };
  }

  function pedir(url) {
    if (typeof transporte === "function") return transporte(url);
    var cabecalhos = {};
    if (root && typeof root.__DK_portalApiHeaders === "function") {
      cabecalhos = root.__DK_portalApiHeaders() || {};
    }
    return fetch(url, { method: "GET", cache: "no-store", headers: cabecalhos });
  }

  async function rodada() {
    var after = state.lastAppliedSeq;
    for (var pagina = 0; pagina < MAX_PAGINAS; pagina++) {
      var url = "/api/dk-sync?after=" + encodeURIComponent(String(after)) + "&limit=" + encodeURIComponent(String(limite));
      var resposta;
      try {
        resposta = await pedir(url);
      } catch (erro) {
        state.lastError = "rede";
        return { ok: false, reason: "rede" };
      }
      var status = resposta && resposta.status;
      if (status === 401 || status === 403) {
        state.lastError = "auth";
        return { ok: false, reason: "auth", status: status };
      }
      if (!resposta || resposta.ok !== true) {
        state.lastError = "http";
        return { ok: false, reason: "http", status: status || 0 };
      }
      var corpo;
      try {
        corpo = await resposta.json();
      } catch (erro) {
        state.lastError = "resposta";
        return { ok: false, reason: "resposta" };
      }
      if (!corpo || corpo.ok === false || corpo.fallback === true) {
        state.lastError = corpo && corpo.reason ? String(corpo.reason) : "resposta";
        return { ok: false, reason: state.lastError };
      }
      var serverSeq = Number(corpo.server_event_seq);
      if (Number.isFinite(serverSeq)) state.lastServerSeq = serverSeq;
      var events = Array.isArray(corpo.events) ? corpo.events : [];
      if (corpo.has_more === true) {
        var proximo = Number(corpo.next_after);
        if (!Number.isFinite(proximo) || proximo <= after) {
          state.lastError = "cursor_not_advancing";
          return { ok: false, reason: "cursor_not_advancing" };
        }
        var aplicado = aplicarPagina(events);
        if (!aplicado.ok) return aplicado;
        after = proximo;
        continue;
      }
      var fim = aplicarPagina(events);
      if (!fim.ok) return fim;
      state.lastError = null;
      state.initialized = true;
      return { ok: true };
    }
    state.lastError = "cursor_not_advancing";
    return { ok: false, reason: "cursor_not_advancing" };
  }

  function dkSyncCatchUp(reason) {
    if (state.syncInFlight) {
      state.syncPending = true;
      return volta;
    }
    state.syncInFlight = true;
    state.syncPending = false;
    emitirStatus();
    volta = (async function () {
      try {
        var resultado = await rodada();
        if (state.syncPending) {
          state.syncPending = false;
          resultado = await rodada();
        }
        if (resultado && resultado.ok) state.lastCheckpointAt = new Date().toISOString();
        return resultado;
      } catch (erro) {
        state.lastError = "rede";
        return { ok: false, reason: "rede" };
      } finally {
        state.syncInFlight = false;
        volta = null;
        emitirStatus();
      }
    })();
    return volta;
  }

  function dkSyncCheckpoint(reason) {
    return dkSyncCatchUp(reason || "checkpoint");
  }

  var api = {
    dkSyncCatchUp: dkSyncCatchUp,
    dkSyncCheckpoint: dkSyncCheckpoint,
    dkSyncEstado: estado,
    dkSyncGetStatus: dkSyncGetStatus,
    dkSyncRotulo: dkSyncRotulo,
    dkSyncTextos: dkSyncTextos,
    configurar: configurar,
    reset: reset,
    assinar: assinar,
  };

  if (root) {
    root.dkSyncCatchUp = dkSyncCatchUp;
    root.dkSyncCheckpoint = dkSyncCheckpoint;
    root.dkSyncEstado = estado;
    root.dkSyncGetStatus = dkSyncGetStatus;
    root.dkSyncRotulo = dkSyncRotulo;
    root.dkSyncTextos = dkSyncTextos;
  }
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : null);
