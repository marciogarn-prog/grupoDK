/**
 * Cursor técnico do Log (seq). Catch-up via GET /api/dk-sync (PG = autoridade).
 * sessionStorage guarda só o cursor da aba (não é autoridade de negócio).
 * Piloto A (D01): Supabase Realtime privado ES256 quando a credencial autorizar.
 * Redis (ocupação/sinal) permanece fallback D02 se o WS cair — nunca autoridade de negócio.
 * Broadcast só avisa seq; detalhes oficiais via GET /api/dk-sync (PG).
 * Revogação / logout chama reset.
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
      var sid = "";
      var empresa = "locadora";
      if (root && root.__DK_portalSessao && typeof root.__DK_portalSessao === "object") {
        sid = String(root.__DK_portalSessao.sid || root.__DK_portalSessao.sessionId || "").trim();
        empresa = String(root.__DK_portalSessao.empresa || "locadora").trim() || "locadora";
      }
      /* Identificador opaco: sid + empresa — sem CPF em sessionStorage. */
      if (sid) return sid + ":" + empresa;
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
  var rtMem = {
    token: null,
    exp: 0,
    canal: null,
    client: null,
    channel: null,
    renovarTimer: null,
    reconnectAttempt: 0,
    wanted: false,
    factory: null,
  };

  function configurar(opcoes) {
    if (!opcoes || typeof opcoes !== "object") return;
    if (Object.prototype.hasOwnProperty.call(opcoes, "transporte")) transporte = opcoes.transporte;
    if (opcoes.limite != null) limite = opcoes.limite;
    if (typeof opcoes.realtimeFactory === "function") rtMem.factory = opcoes.realtimeFactory;
  }

  function limparRealtimeLocal() {
    rtMem.wanted = false;
    rtMem.token = null;
    rtMem.exp = 0;
    rtMem.canal = null;
    if (rtMem.renovarTimer) {
      try {
        root.clearTimeout(rtMem.renovarTimer);
      } catch (e) {
        /* ignore */
      }
      rtMem.renovarTimer = null;
    }
    try {
      if (rtMem.channel && rtMem.client && typeof rtMem.client.removeChannel === "function") {
        void rtMem.client.removeChannel(rtMem.channel);
      }
    } catch (e2) {
      /* ignore */
    }
    rtMem.channel = null;
    rtMem.client = null;
    state.realtimeConectado = false;
  }

  function reset() {
    limparRealtimeLocal();
    state.lastAppliedSeq = 0;
    state.syncInFlight = false;
    state.syncPending = false;
    state.lastServerSeq = 0;
    state.lastError = null;
    state.initialized = false;
    state.lastCheckpointAt = null;
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

  function agendarRenovacao(expUnix) {
    if (rtMem.renovarTimer) {
      try {
        root.clearTimeout(rtMem.renovarTimer);
      } catch (e) {
        /* ignore */
      }
    }
    var agora = Math.floor(Date.now() / 1000);
    var faltam = Number(expUnix) - agora - 20;
    if (!Number.isFinite(faltam) || faltam < 5) faltam = 30;
    rtMem.renovarTimer = root.setTimeout(function () {
      if (!rtMem.wanted) return;
      void dkSyncTentarRealtime({ renovar: true });
    }, faltam * 1000);
  }

  function onBroadcastSinal(payload) {
    try {
      var seq = payload && (payload.seq != null ? payload.seq : payload.payload && payload.payload.seq);
      /* Sinal não é autoridade — só dispara catch-up autenticado. */
      void dkSyncCatchUp(seq != null ? "broadcast:" + seq : "broadcast");
    } catch (e) {
      /* ignore */
    }
  }

  async function abrirCanalPrivado(corpo) {
    var canalNome = String(corpo.canal || "").trim();
    var canalGlobal = canalNome === "dk:events";
    var canalEmpresa = /^dk:events:(locadora|centro|construtora)$/.test(canalNome);
    if (!canalNome || (!canalGlobal && !canalEmpresa)) {
      state.realtimeBloqueado = true;
      state.realtimeMotivo = "SCOPE_ISOLATION_BLOCKED";
      state.realtimeConectado = false;
      return { ok: false, reason: state.realtimeMotivo };
    }
    rtMem.token = String(corpo.token);
    rtMem.exp = Number(corpo.exp) || 0;
    rtMem.canal = canalNome;
    rtMem.wanted = true;

    var criar =
      rtMem.factory ||
      (root && typeof root.__DK_criarClienteRealtime === "function" ? root.__DK_criarClienteRealtime : null);
    if (typeof criar !== "function") {
      state.realtimeMotivo = "REALTIME_CLIENT_AUSENTE";
      state.realtimeBloqueado = true;
      return { ok: false, reason: state.realtimeMotivo };
    }

    if (rtMem.channel && rtMem.client) {
      try {
        await rtMem.client.removeChannel(rtMem.channel);
      } catch (e) {
        /* ignore */
      }
      rtMem.channel = null;
    }

    var client = criar(function () {
      return rtMem.token;
    });
    if (!client || !client.channel) {
      state.realtimeMotivo = "REALTIME_CLIENT_AUSENTE";
      return { ok: false, reason: state.realtimeMotivo };
    }
    rtMem.client = client;
    try {
      if (client.realtime && typeof client.realtime.setAuth === "function") {
        client.realtime.setAuth(rtMem.token);
      }
    } catch (e2) {
      /* setAuth opcional conforme versão */
    }

    var channel = client.channel(canalNome, { config: { private: true } });
    channel.on("broadcast", { event: "dk_changed" }, function (msg) {
      onBroadcastSinal(msg && msg.payload != null ? msg.payload : msg);
    });
    channel.on("broadcast", { event: "dk_event" }, function (msg) {
      onBroadcastSinal(msg && msg.payload != null ? msg.payload : msg);
    });
    channel.on("broadcast", { event: "*" }, function (msg) {
      var kind = msg && msg.payload && msg.payload.kind;
      if (
        msg &&
        (msg.event === "dk_changed" ||
          msg.event === "dk_event" ||
          kind === "dk_changed" ||
          kind === "dk_event")
      ) {
        onBroadcastSinal(msg.payload || msg);
      }
    });

    await new Promise(function (resolve) {
      channel.subscribe(function (status) {
        if (status === "SUBSCRIBED") {
          state.realtimeConectado = true;
          state.realtimeBloqueado = false;
          state.realtimeMotivo = "";
          rtMem.reconnectAttempt = 0;
          resolve({ ok: true });
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          state.realtimeConectado = false;
          resolve({ ok: false, status: status });
        }
      });
      root.setTimeout(function () {
        resolve({ ok: state.realtimeConectado === true });
      }, 8000);
    });

    rtMem.channel = channel;
    agendarRenovacao(rtMem.exp);
    emitirStatus();
    if (state.realtimeConectado) {
      void dkSyncCatchUp("realtime_subscribed");
      return { ok: true, canal: canalNome, realtime: true };
    }
    state.realtimeMotivo = state.realtimeMotivo || "REALTIME_SUBSCRIBE_FAILED";
    return { ok: false, reason: state.realtimeMotivo };
  }

  /**
   * Obtém credencial e, se o servidor autorizar, abre canal privado.
   * Token só em memória. Sem gates no servidor → bloqueado.
   */
  async function dkSyncTentarRealtime(opts) {
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
        if (!state.realtimeMotivo) state.realtimeMotivo = REALTIME_MOTIVO;
        emitirStatus();
        return { ok: false, reason: state.realtimeMotivo, realtime: false, transport: "redis" };
      }
      var aberto = await abrirCanalPrivado(corpo);
      emitirStatus();
      return aberto;
    } catch (err) {
      state.realtimeBloqueado = true;
      state.realtimeConectado = false;
      state.realtimeMotivo = REALTIME_MOTIVO;
      if (rtMem.wanted) {
        rtMem.reconnectAttempt += 1;
        var wait = Math.min(30000, 1000 * Math.pow(2, Math.min(5, rtMem.reconnectAttempt)));
        root.setTimeout(function () {
          if (rtMem.wanted) void dkSyncTentarRealtime({ reconnect: true });
        }, wait);
      }
      emitirStatus();
      return { ok: false, reason: REALTIME_MOTIVO, realtime: false, transport: "redis" };
    }
  }

  function dkSyncEncerrarRealtime() {
    limparRealtimeLocal();
    state.realtimeBloqueado = true;
    state.realtimeMotivo = REALTIME_MOTIVO;
    emitirStatus();
  }

  /**
   * Sinal Redis (ocupação das abas) — fallback D02 se Realtime cair.
   * Não desliga o Realtime se já estiver conectado; só dispara catch-up PG.
   */
  function dkSyncAplicarSinalRedis(detalhe) {
    var seq = Number(detalhe && (detalhe.server_event_seq || detalhe.seq));
    if (!Number.isFinite(seq) || seq <= 0) return { ok: true, skipped: true, reason: "sem_seq" };
    if (seq > state.lastServerSeq) state.lastServerSeq = seq;
    emitirStatus();
    if (seq > state.lastAppliedSeq) {
      void dkSyncCatchUp("redis_sinal");
      return {
        ok: true,
        catchup: true,
        seq: seq,
        transport: state.realtimeConectado ? "realtime+redis" : "redis",
      };
    }
    return { ok: true, skipped: true, reason: "ja_aplicado", seq: seq };
  }

  if (root && typeof root.addEventListener === "function") {
    root.addEventListener("visibilitychange", function () {
      try {
        if (!root.document) return;
        if (root.document.visibilityState === "visible") {
          void dkSyncCheckpoint("aba_ativa");
          if (rtMem.wanted && !state.realtimeConectado) void dkSyncTentarRealtime({ visibility: true });
        }
      } catch (e) {
        /* ignore */
      }
    });
    root.addEventListener("dk:sessao:logout", function () {
      reset();
    });
    root.addEventListener("dk:sessao:bloqueada", function () {
      reset();
    });
    root.addEventListener("dk:sessao:troca-usuario", function () {
      reset();
    });
    root.addEventListener("dk:sessao:troca-empresa", function () {
      reset();
    });
    root.addEventListener("dk:sessao:pronta", function () {
      void dkSyncCheckpoint("login");
      void dkSyncTentarRealtime({ login: true });
    });
    root.addEventListener("dk-area-ocupacao", function (ev) {
      try {
        dkSyncAplicarSinalRedis(ev && ev.detail ? ev.detail : {});
      } catch (e) {
        /* ignore */
      }
    });
    root.setTimeout(function () {
      try {
        if (root.__DK_portalApiTokenGet && root.__DK_portalApiTokenGet()) {
          void dkSyncCheckpoint("bootstrap");
          void dkSyncTentarRealtime({ bootstrap: true });
        }
      } catch (e) {
        /* ignore */
      }
    }, 1500);
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
      entity_id: evento && evento.entity_id != null ? String(evento.entity_id) : "",
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
    for (var i = 0; i < events.length; i++) {
      var seq = Number(events[i].seq);
      if (!Number.isFinite(seq)) continue;
      if (seqsVistos[seq] === true) continue;
      if (seq <= state.lastAppliedSeq) {
        seqsVistos[seq] = true;
        continue;
      }
      var det = detalheSeguro(events[i]);
      try {
        emitir(det);
      } catch (e) {
        state.lastError = "aplicar_evento";
        return { ok: false, reason: "aplicar_evento" };
      }
      seqsVistos[seq] = true;
      state.lastAppliedSeq = seq;
      gravarCursorPersistido(seq);
    }
    return { ok: true };
  }

  function sinalizarConflito(modulo, detalhe) {
    root.dispatchEvent(
      new root.CustomEvent("dk:sync:conflito-edicao", {
        detail: {
          module: modulo,
          seq: detalhe.seq,
          audit_no: detalhe.audit_no,
          entity_id: detalhe.entity_id || "",
          preservarEdicao: true,
        },
      })
    );
  }

  function formularioSujo(modulo) {
    if (modulo === "locacao") {
      /* Só bloqueia com sujo explícito — foco no formulário NÃO impede o catch-up (evita precisar F5). */
      if (root.__DK_locacaoFormularioSujo === true) return true;
      if (root.__DK_locacaoDetalheAtual && root.__DK_locacaoDetalheAtual.__dkEditando === true) return true;
      return false;
    }
    if (root.__DK_formularioSujoModulo === modulo) return true;
    try {
      var el = root.document && root.document.activeElement;
      if (!el || !el.closest) return false;
      if (modulo === "cliente" && el.closest("#operacaoInlineCliente, form[data-dk-cliente-form]")) return true;
      if (modulo === "veiculo" && el.closest("#operacaoInlineVeiculo, form[data-dk-veiculo-form]")) return true;
      if (modulo === "pagamento" && el.closest("#operacaoInlineLancamentoAluguel, form[data-dk-pagamento-form]")) {
        return true;
      }
      if (modulo === "manutencao" && el.closest("form[data-dk-manutencao-form]")) return true;
    } catch (e) {
      return false;
    }
    return false;
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
      if (afetaLocacao) {
        if (formularioSujo("locacao")) sinalizarConflito("locacao", detalhe);
        else {
          if (typeof root.__DK_locacaoPgRecarregar === "function") void root.__DK_locacaoPgRecarregar();
          if (typeof root.__DK_locacaoAplicarEventoRemoto === "function" && detalhe.entity_id) {
            void root.__DK_locacaoAplicarEventoRemoto(detalhe.entity_id);
          } else if (typeof root.__DK_locacaoPgDetalhe === "function" && detalhe.entity_id) {
            void root.__DK_locacaoPgDetalhe(detalhe.entity_id);
          }
        }
      }
      if (afetaPagamento) {
        if (formularioSujo("pagamento")) sinalizarConflito("pagamento", detalhe);
        else if (typeof root.__DK_portalRepintarPagamentosAbertos === "function") {
          root.__DK_portalRepintarPagamentosAbertos();
        }
      }
      if (afetaCliente) {
        if (formularioSujo("cliente")) sinalizarConflito("cliente", detalhe);
        else if (typeof root.__DK_clientePgRecarregar === "function") void root.__DK_clientePgRecarregar();
      }
      if (afetaVeiculo) {
        if (formularioSujo("veiculo")) sinalizarConflito("veiculo", detalhe);
        else if (typeof root.__DK_veiculoPgRecarregar === "function") void root.__DK_veiculoPgRecarregar();
      }
      if (afetaManut) {
        if (formularioSujo("manutencao")) sinalizarConflito("manutencao", detalhe);
        else if (typeof root.__DK_manutencaoRecarregar === "function") void root.__DK_manutencaoRecarregar();
        else if (typeof root.__DK_portalSyncManutencoesRapidas === "function") void root.__DK_portalSyncManutencoesRapidas();
        else if (typeof root.__DK_portalPullManutencoesRapidas === "function") void root.__DK_portalPullManutencoesRapidas();
      }
      if (
        (afetaCliente || afetaVeiculo || afetaManut || afetaLocacao || afetaPagamento) &&
        typeof root.__DK_portalRefreshOperacaoDeferred === "function"
      ) {
        root.__DK_portalRefreshOperacaoDeferred();
      }
      if (
        (afetaCliente || afetaVeiculo || afetaManut || afetaLocacao || afetaPagamento) &&
        root &&
        typeof root.dispatchEvent === "function" &&
        typeof root.CustomEvent === "function"
      ) {
        root.dispatchEvent(
          new root.CustomEvent("dk:log:recarregar", {
            detail: { motivo: "catchup", audit_no: detalhe.audit_no, seq: detalhe.seq },
          })
        );
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
    dkSyncEncerrarRealtime: dkSyncEncerrarRealtime,
    dkSyncAplicarSinalRedis: dkSyncAplicarSinalRedis,
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
    root.dkSyncEncerrarRealtime = dkSyncEncerrarRealtime;
    root.dkSyncAplicarSinalRedis = dkSyncAplicarSinalRedis;
    root.dkSyncReset = reset;
  }
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : null);
