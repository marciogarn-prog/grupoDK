/**
 * Terminal BC↔VM (COMANDO 08/10 + correções pontuais 09/10):
 * consulta sessão/projeção na nuvem sem parâmetros fictícios A–J.
 * Não usa localStorage/IndexedDB como fonte oficial de dados de negócio.
 * Bloqueio exclusivo de tela: APIs separadas (09/10); este módulo não trava telas.
 */
(function () {
  "use strict";

  var POLL_MS = 8000;
  var PROJ_PAGE = 200;
  var timer = null;
  var inFlight = false;
  var lastSinal = 0;
  var projLoadedOnce = false;
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

  function limparEstado(acesso, reason) {
    estado = {
      acesso: acesso || "pendente",
      prefixo: null,
      autorizada: false,
      reason: reason || null,
    };
    lastSinal = 0;
    projLoadedOnce = false;
  }

  async function carregarProjecaoCompleta() {
    if (!estado.autorizada) {
      emit("dk-bc-vm-projecao", { ok: false, reason: estado.reason || "sem_autorizacao", items: [] });
      return { ok: false, items: [] };
    }
    var after = 0;
    var all = [];
    var guard = 0;
    while (guard < 50) {
      guard += 1;
      var r = await fetchJson(
        "/api/dk-bc-vm-projecao?after_bc_no=" + encodeURIComponent(String(after)) + "&limit=" + PROJ_PAGE
      );
      var b = r.body || {};
      if (r.status === 401 || r.status === 403 || !b.ok) {
        if (r.status === 401) {
          stop();
          limparEstado("negado", b.reason || "sessao_expirada");
          emit("dk-bc-vm-sessao", Object.assign({}, estado, { http: r.status }));
        }
        emit("dk-bc-vm-projecao", {
          ok: false,
          prefixo: estado.prefixo,
          items: all,
          reason: b.reason || "projecao_falhou",
          http: r.status,
        });
        return { ok: false, items: all, reason: b.reason };
      }
      var items = Array.isArray(b.items) ? b.items : [];
      for (var i = 0; i < items.length; i += 1) {
        var it = items[i];
        if (it && it.vigente === false) continue;
        if (it && String(it.estado || "").toLowerCase() === "excluido") continue;
        all.push(it);
        if (it.bc_no != null && Number(it.bc_no) > after) after = Number(it.bc_no);
      }
      if (items.length < PROJ_PAGE) break;
    }
    projLoadedOnce = true;
    emit("dk-bc-vm-projecao", {
      ok: true,
      prefixo: estado.prefixo,
      items: all,
      reason: null,
      http: 200,
    });
    return { ok: true, items: all };
  }

  async function atualizarSessao() {
    if (inFlight) return estado;
    inFlight = true;
    try {
      var r = await fetchJson("/api/dk-bc-vm-sessao");
      var b = r.body || {};
      if (r.status === 401) {
        stop();
        limparEstado("negado", b.reason || "sessao_expirada");
        emit("dk-bc-vm-sessao", Object.assign({}, estado, { http: r.status }));
        return estado;
      }
      estado = {
        acesso: b.acesso || (b.ok ? "autorizado" : "pendente"),
        prefixo: b.ok ? b.prefixo : null,
        autorizada: !!(b.ok && b.autorizada),
        reason: b.reason || null,
        forged_ignored: b.forged_ignored || null,
        vm_status: b.vm_status || null,
      };
      emit("dk-bc-vm-sessao", Object.assign({}, estado, { http: r.status }));

      if (!estado.autorizada) {
        projLoadedOnce = false;
        return estado;
      }

      var sinalNovo = false;
      if (b.sinal && b.sinal.last_bc_no != null) {
        var n = Number(b.sinal.last_bc_no) || 0;
        if (n > lastSinal) {
          lastSinal = n;
          sinalNovo = true;
          emit("dk-bc-vm-sinal", {
            prefixo: estado.prefixo,
            last_bc_no: n,
            updated_at: b.sinal.updated_at,
          });
        } else if (n > 0 && lastSinal === 0) {
          lastSinal = n;
        }
      }

      // Catch-up inicial mesmo sem avanço de sinal (correção pontual 08/10).
      if (!projLoadedOnce || sinalNovo) {
        await carregarProjecaoCompleta();
      }
      return estado;
    } finally {
      inFlight = false;
    }
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
    projecao: carregarProjecaoCompleta,
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
