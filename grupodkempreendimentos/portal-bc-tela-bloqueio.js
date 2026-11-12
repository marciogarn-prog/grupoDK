/**
 * UI preparada (COMANDO 09/10) — estados de bloqueio exclusivo.
 * NÃO ligado ao index.html / telas reais nesta etapa.
 * Não usa storage local como autoridade do bloqueio.
 */
(function () {
  "use strict";

  var RENEW_MS = 20000;
  var renewTimer = null;
  var estado = {
    ui: "desconhecido",
    concessao_id: null,
    geracao: null,
    expira_em: null,
    reason: null,
  };

  function headers() {
    var h = { Accept: "application/json", "Content-Type": "application/json" };
    try {
      if (window.DkPortalApiAuth && typeof window.DkPortalApiAuth.apiHeaders === "function") {
        Object.assign(h, window.DkPortalApiAuth.apiHeaders() || {});
      } else {
        var tok =
          localStorage.getItem("dk_portal_api_token_v1") ||
          sessionStorage.getItem("dk_portal_api_token_v1") ||
          "";
        if (tok) h.Authorization = "Bearer " + tok;
      }
    } catch (_) {}
    return h;
  }

  function emit(nome, detail) {
    try {
      window.dispatchEvent(new CustomEvent(nome, { detail: detail || {} }));
    } catch (_) {}
  }

  async function api(action, payload) {
    var res = await fetch("/api/dk-bc-tela-bloqueio?action=" + encodeURIComponent(action), {
      method: action === "consultar" ? "GET" : "POST",
      headers: headers(),
      credentials: "same-origin",
      body: action === "consultar" ? undefined : JSON.stringify(payload || {}),
    });
    var body = null;
    try {
      body = await res.json();
    } catch (_) {
      body = { ok: false, reason: "json_invalido" };
    }
    return { status: res.status, body: body || {} };
  }

  function setUi(ui, extra) {
    estado = Object.assign({}, estado, extra || {}, { ui: ui });
    emit("dk-bc-tela-bloqueio", Object.assign({}, estado));
  }

  function stopRenew() {
    if (renewTimer) clearInterval(renewTimer);
    renewTimer = null;
  }

  function startRenew(ctx) {
    stopRenew();
    renewTimer = setInterval(function () {
      renovar(ctx).catch(function () {});
    }, RENEW_MS);
  }

  async function consultar(ctx) {
    var q =
      "empresa_id=" +
      encodeURIComponent(ctx.empresa_id) +
      "&filial_id=" +
      encodeURIComponent(ctx.filial_id) +
      "&tela=" +
      encodeURIComponent(ctx.tela);
    var res = await fetch("/api/dk-bc-tela-bloqueio?action=consultar&" + q, {
      method: "GET",
      headers: headers(),
      credentials: "same-origin",
    });
    var body = await res.json().catch(function () {
      return { ok: false };
    });
    if (res.status === 401) {
      stopRenew();
      setUi("permissao_revogada", { reason: body.reason || "sessao_expirada" });
      return body;
    }
    if (body.ocupada) setUi("edicao_bloqueada", { reason: body.reason || null });
    else setUi("edicao_disponivel", { reason: null });
    return body;
  }

  async function adquirir(ctx) {
    var r = await api("adquirir", ctx);
    var b = r.body;
    if (r.status === 401) {
      stopRenew();
      setUi("permissao_revogada", { reason: b.reason });
      return b;
    }
    if (b.ok && b.adquirida) {
      estado.concessao_id = b.concessao_id;
      estado.geracao = b.geracao;
      estado.expira_em = b.expira_em;
      setUi("bloqueio_adquirido", { reason: b.reason || null });
      startRenew(ctx);
      return b;
    }
    if (b.reason === "tela_ocupada") setUi("edicao_bloqueada", { reason: b.reason });
    else setUi("permissao_revogada", { reason: b.reason || "negado" });
    return b;
  }

  async function renovar(ctx) {
    if (!estado.concessao_id || estado.geracao == null) return { ok: false, reason: "sem_concessao" };
    var r = await api(
      "renovar",
      Object.assign({}, ctx, { concessao_id: estado.concessao_id, geracao: estado.geracao })
    );
    var b = r.body;
    if (!b.ok || !b.renovada) {
      stopRenew();
      setUi(b.reason === "bloqueio_expirado" ? "bloqueio_expirado" : "conexao_interrompida", {
        reason: b.reason,
      });
      estado.concessao_id = null;
      estado.geracao = null;
      return b;
    }
    estado.expira_em = b.expira_em;
    setUi("bloqueio_adquirido", { reason: null });
    return b;
  }

  async function liberar(ctx) {
    stopRenew();
    if (!estado.concessao_id) {
      setUi("edicao_disponivel", {});
      return { ok: true, liberada: false };
    }
    var r = await api(
      "liberar",
      Object.assign({}, ctx, { concessao_id: estado.concessao_id, geracao: estado.geracao })
    );
    estado.concessao_id = null;
    estado.geracao = null;
    setUi("edicao_disponivel", { reason: r.body.reason || null });
    return r.body;
  }

  async function validarAntesDeGravar(ctx) {
    if (!estado.concessao_id || estado.geracao == null) {
      setUi("gravacao_rejeitada", { reason: "sem_concessao" });
      return { ok: false, valida: false, reason: "sem_concessao" };
    }
    var r = await api(
      "validar",
      Object.assign({}, ctx, { concessao_id: estado.concessao_id, geracao: estado.geracao })
    );
    if (!r.body.ok || !r.body.valida) {
      stopRenew();
      setUi("gravacao_rejeitada", { reason: r.body.reason || "fencing_ultrapassado" });
      return r.body;
    }
    return r.body;
  }

  window.DkBcTelaBloqueio = {
    consultar: consultar,
    adquirir: adquirir,
    renovar: renovar,
    liberar: liberar,
    validarAntesDeGravar: validarAntesDeGravar,
    stop: stopRenew,
    estado: function () {
      return Object.assign({}, estado);
    },
  };
})();
