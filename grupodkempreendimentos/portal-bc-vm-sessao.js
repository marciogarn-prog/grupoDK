/**
 * Terminal BC↔VM (COMANDO 08/10): consulta sessão/projeção na nuvem.
 * Não usa localStorage/IndexedDB como fonte oficial.
 * Bloqueio exclusivo de tela fica para 09/10.
 */
(function () {
  "use strict";

  var POLL_MS = 8000;
  var timer = null;
  var lastSinal = 0;
  var estado = {
    acesso: "desconhecido",
    prefixo: null,
    autorizada: false,
    reason: null,
  };

  function headers() {
    var h = { Accept: "application/json" };
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

  async function fetchJson(url) {
    var res = await fetch(url, { method: "GET", headers: headers(), credentials: "same-origin" });
    var body = null;
    try {
      body = await res.json();
    } catch (_) {
      body = { ok: false, reason: "json_invalido" };
    }
    return { status: res.status, body: body || {} };
  }

  async function atualizarSessao() {
    var r = await fetchJson("/api/dk-bc-vm-sessao?prefixo=B");
    var b = r.body;
    estado = {
      acesso: b.acesso || (r.status === 401 ? "negado" : "pendente"),
      prefixo: b.ok ? b.prefixo : null,
      autorizada: !!(b.ok && b.autorizada),
      reason: b.reason || null,
      forged_ignored: b.forged_ignored || null,
      vm_status: b.vm_status || null,
    };
    emit("dk-bc-vm-sessao", Object.assign({}, estado, { http: r.status }));
    if (b.sinal && b.sinal.last_bc_no != null) {
      var n = Number(b.sinal.last_bc_no) || 0;
      if (n > lastSinal) {
        lastSinal = n;
        emit("dk-bc-vm-sinal", { prefixo: estado.prefixo, last_bc_no: n, updated_at: b.sinal.updated_at });
        if (estado.autorizada) await atualizarProjecao(0);
      }
    }
    return estado;
  }

  async function atualizarProjecao(after) {
    if (!estado.autorizada) {
      emit("dk-bc-vm-projecao", { ok: false, reason: estado.reason || "sem_autorizacao", items: [] });
      return { ok: false, items: [] };
    }
    var r = await fetchJson(
      "/api/dk-bc-vm-projecao?after_bc_no=" + encodeURIComponent(String(after || 0)) + "&prefixo=Z"
    );
    var b = r.body;
    emit("dk-bc-vm-projecao", {
      ok: !!b.ok,
      prefixo: b.prefixo || estado.prefixo,
      items: b.items || [],
      reason: b.reason || null,
      forged_ignored: b.forged_ignored || null,
      http: r.status,
    });
    return b;
  }

  function start() {
    stop();
    atualizarSessao().catch(function () {});
    timer = setInterval(function () {
      atualizarSessao().catch(function () {});
    }, POLL_MS);
  }

  function stop() {
    if (timer) clearInterval(timer);
    timer = null;
  }

  window.DkBcVmSessao = {
    start: start,
    stop: stop,
    refresh: atualizarSessao,
    projecao: atualizarProjecao,
    estado: function () {
      return Object.assign({}, estado);
    },
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      /* não inicia sozinho em produção sem vínculo — caller decide */
    });
  }
})();
