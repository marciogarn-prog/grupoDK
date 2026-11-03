/**
 * Cursor técnico do Log (seq). Catch-up via GET /api/dk-sync.
 * sessionStorage guarda só o cursor da aba (não é autoridade de negócio).
 * WebSocket/Realtime: REALTIME_AUTH_BLOCKED até JWT Supabase + canal privado.
 */
(function (root) {
  var CURSOR_KEY = "dk_sync_cursor_seq_v1";
  var CURSOR_SCOPE_KEY = "dk_sync_cursor_scope_v1";
  var REALTIME_MOTIVO = "REALTIME_AUTH_BLOCKED";

  function escopoSessao() {
    try {
      if (root && typeof root.__DK_portalSyncScopeId === "function") {
        var s = String(root.__DK_portalSyncScopeId() || "").trim();
        if (s) return s;
      }
      var cpf = "";
      var sid = "";
      if (root && root.__DK_portalSessao && typeof root.__DK_portalSessao === "object") {
        cpf = String(root.__DK_portalSessao.cpf || "").replace(/\D/g, "").slice(0, 11);
        sid = String(root.__DK_portalSessao.sid || root.__DK_portalSessao.sessionId || "").trim();
      }
      if (!cpf && root && typeof root.__DK_portalCpfSessao === "function") {
        cpf = String(root.__DK_portalCpfSessao() || "").replace(/\D/g, "").slice(0, 11);
      }
      if (cpf || sid) return cpf + ":" + sid;
    } catch (e) {
      /* ignore */
    }
    return "";
  }

  function garantirEscopoCursor() {
    var scope = escopoSessao();
    if (!scope || !root || !root.sessionStorage) return;
    try {
      var prev = String(root.sessionStorage.getItem(CURSOR_SCOPE_KEY) || "");
      if (prev && prev !== scope) {
        state.lastAppliedSeq = 0;
        root.sessionStorage.setItem(CURSOR_KEY, "0");
      }
      root.sessionStorage.setItem(CURSOR_SCOPE_KEY, scope);
    } catch (e) {
      /* ignore */
    }
  }

  function lerCursorPersistido() {
    try {
      if (!root || !root.sessionStorage) return 0;
      garantirEscopoCursor();
      var n = Number(root.sessionStorage.getItem(CURSOR_KEY));
      return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
    } catch (e) {
      return 0;
    }
  }
  function gravarCursorPersistido(seq) {
    try {
      if (!root || !root.sessionStorage) return;
      garantirEscopoCursor();
      var n = Number(seq);
      if (!Number.isFinite(n) || n < 0) return;
      root.sessionStorage.setItem(CURSOR_KEY, String(Math.floor(n)));
    } catch (e) {
      /* ignore */
    }
  }
  var state = {
    lastAppliedSeq: 0,
    syncInFlight: false,
    syncPending: false,
    lastServerSeq: 0,
    lastError: null,
    initialized: false,
    lastCheckpointAt: null,
    realtimeBloqueado: true,
    realtimeMotivo: REALTIME_MOTIVO,
    realtimeConectado: false,
  };
  state.lastAppliedSeq = lerCursorPersistido();
  var transporte = null;
  var limite = 100;
  var ouvintes = [];
  var volta = null;
  var MAX_PAGINAS = 30;
  var seqsVistos = Object.create(null);

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
    state.realtimeConectado = false;
    state.realtimeBloqueado = true;
    state.realtimeMotivo = REALTIME_MOTIVO;
    volta = null;
    ouvintes = [];
    seqsVistos = Object.create(null);
    gravarCursorPersistido(0);
    try {
      if (root && root.sessionStorage) root.sessionStorage.removeItem(CURSOR_SCOPE_KEY);
    } catch (e) {
      /* ignore */
    }
  }

  function estado() {
    return {
      lastAppliedSeq: state.lastAppliedSeq,
      lastServerSeq: state.lastServerSeq,
      syncInFlight: state.syncInFlight,
      lastError: state.lastError,
      realtimeBloqueado: state.realtimeBloqueado,
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
      realtimeBloqueado: state.realtimeBloqueado,
      realtimeMotivo: state.realtimeMotivo,
      realtimeConectado: state.realtimeConectado === true,
    };
  }

  /**
   * Tenta obter credencial Realtime. Sem JWT de projeto, permanece bloqueado.
   * Nunca persiste token em localStorage/IndexedDB.
   */
  async function dkSyncTentarRealtime() {
    state.realtimeBloqueado = true;
    state.realtimeConectado = false;
    state.realtimeMotivo = REALTIME_MOTIVO;
    var cabecalhos = {};
    try {
      if (root && typeof root.__DK_portalApiHeaders === "function") {
        cabecalhos = root.__DK_portalApiHeaders() || {};
      }
    } catch (e) {
      /* ignore */
    }
    try {
      var res = await fetch("/api/dk-realtime-credencial?nocache=" + Date.now(), {
        method: "GET",
        cache: "no-store",
        headers: cabecalhos,
      });
      var corpo = await res.json().catch(function () {
        return {};
      });
      if (corpo && corpo.reason) state.realtimeMotivo = String(corpo.reason);
      if (!(res.status >= 200 && res.status < 300) || !corpo || corpo.ok !== true || !corpo.token) {
        state.realtimeBloqueado = true;
        state.realtimeConectado = false;
        emitirStatus();
        return { ok: false, reason: state.realtimeMotivo, realtime: false };
      }
      /* Emissão real só após remoção do gate — não abrir canal com token inseguro. */
      state.realtimeBloqueado = true;
      state.realtimeMotivo = "REALTIME_AUTH_BLOCKED";
      emitirStatus();
      return { ok: false, reason: state.realtimeMotivo, realtime: false };
    } catch (err) {
      state.realtimeBloqueado = true;
      state.realtimeMotivo = REALTIME_MOTIVO;
      emitirStatus();
      return { ok: false, reason: REALTIME_MOTIVO, realtime: false };
    }
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
    aplicarEventoNasTelas(detalhe);
  }

  function detalheSeguro(evento) {
    var seq = Number(evento && evento.seq);
    if (evento && evento.restricted === true) return { seq: seq, restricted: true };
    var audit = Number(evento && evento.audit_no);
    return {
      seq: seq,
      restricted: false,
      audit_no: Number.isFinite(audit) ? audit : null,
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
      if (!Number.isFinite(seq)) continue;
      if (seqsVistos[seq] === true) continue;
      if (seq <= state.lastAppliedSeq) {
        seqsVistos[seq] = true;
        continue;
      }
      seqsVistos[seq] = true;
      state.lastAppliedSeq = seq;
      gravarCursorPersistido(seq);
      novos.push(detalheSeguro(events[i]));
    }
    novos.forEach(emitir);
    return { ok: true };
  }

  function aplicarEventoNasTelas(detalhe) {
    if (!detalhe || detalhe.restricted === true) return;
    var mod = String(detalhe.module || detalhe.entity_type || "").toLowerCase();
    var tipo = String(detalhe.event_type || "").toLowerCase();
    var afetaLocacao = /locacao|loca[cç]ao/.test(mod + " " + tipo);
    var afetaPagamento = /pagamento|payment/.test(mod + " " + tipo);
    var afetaCliente = /cliente/.test(mod + " " + tipo);
    var afetaVeiculo = /veiculo|veículo/.test(mod + " " + tipo);
    var afetaManut = /manutencao|manuten[cç]ao/.test(mod + " " + tipo);
    try {
      if (afetaLocacao && typeof root.__DK_locacaoPgRecarregar === "function") {
        var aberta = root.__DK_locacaoDetalheAtual;
        var formSujo = root.__DK_locacaoFormularioSujo === true || (aberta && aberta.__dkEditando === true);
        var formAtivo = false;
        try {
          var doc = root.document;
          var el = doc && doc.activeElement;
          formAtivo = Boolean(
            el &&
              el.closest &&
              el.closest("#operacaoInlineLocacao, #operacaoLocacaoForm, form[data-dk-locacao-form]")
          );
        } catch (e2) {
          formAtivo = false;
        }
        if (formSujo || formAtivo) {
          root.dispatchEvent(
            new root.CustomEvent("dk:sync:conflito-edicao", {
              detail: {
                module: "locacao",
                seq: detalhe.seq,
                audit_no: detalhe.audit_no,
                preservarEdicao: true,
              },
            })
          );
        } else {
          void root.__DK_locacaoPgRecarregar();
        }
      }
      if (afetaPagamento && typeof root.__DK_portalRepintarPagamentosAbertos === "function") {
        root.__DK_portalRepintarPagamentosAbertos();
      }
      if ((afetaCliente || afetaVeiculo || afetaManut || afetaLocacao) && typeof root.__DK_portalRefreshOperacaoDeferred === "function") {
        root.__DK_portalRefreshOperacaoDeferred();
      }
    } catch (e) {
      /* a tela não pode derrubar o cursor */
    }
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
    garantirEscopoCursor();
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
    dkSyncTentarRealtime: dkSyncTentarRealtime,
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
    root.dkSyncTentarRealtime = dkSyncTentarRealtime;
    root.dkSyncReset = reset;
  }
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : null);
