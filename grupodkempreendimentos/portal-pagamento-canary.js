/**
 * Canário temporário de leitura. Só corre com window.__DK_PAGAMENTO_READ_CANARY__ === true.
 * Não substitui o array da tela e não grava pagamento.
 */
(function dkPagamentoCanary() {
  const TIMEOUT_MS = 15000;

  function lista(valor) {
    return Array.isArray(valor) ? valor : [];
  }

  async function sha256(texto) {
    const dados = new TextEncoder().encode(String(texto));
    const buf = await crypto.subtle.digest("SHA-256", dados);
    return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
  }

  async function ler(numero, removido, stats) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    const headers = typeof window.__DK_portalApiHeaders === "function" ? window.__DK_portalApiHeaders() : {};
    const qs = removido ? "&scope=removidos" : "";
    const t0 = Date.now();
    let res;
    try {
      res = await fetch("/api/dk-pagamento-locacao?numeroContrato=" + encodeURIComponent(numero) + qs, {
        method: "GET",
        headers,
        signal: ctrl.signal,
      });
      stats.metodos.push("GET");
    } catch (err) {
      const abortou = ctrl.signal.aborted || (err && err.name === "AbortError");
      throw new Error(abortou ? "supabase_timeout" : "supabase_indisponivel");
    } finally {
      clearTimeout(timer);
    }
    const texto = await res.text();
    stats.bytes += texto.length;
    stats.ms += Date.now() - t0;
    let body = null;
    try {
      body = texto ? JSON.parse(texto) : null;
    } catch {
      body = null;
    }
    if (!res.ok || !body || body.ok === false) throw new Error((body && body.reason) || "postgres_indisponivel");
    return lista(body.pagamentos);
  }

  async function comparar(loc) {
    if (window.__DK_PAGAMENTO_READ_CANARY__ !== true) return null;
    const numero = String((loc && (loc.numeroContrato || loc.protocolo)) || "").trim();
    const ativosOld = lista(loc && loc.portalLancamentosAluguel);
    const removidosOld = lista(loc && loc.portalLancamentosAluguelRemovidos);
    const base = {
      contrato: numero,
      sourceOld: "portalLancamentosAluguel",
      sourceNew: "dk_pagamento_locacao",
      ativosOld: ativosOld.length,
      ativosNew: null,
      hashAtivosOld: await sha256(JSON.stringify(ativosOld)),
      hashAtivosNew: "",
      removidosOld: removidosOld.length,
      removidosNew: null,
      hashRemovidosOld: await sha256(JSON.stringify(removidosOld)),
      hashRemovidosNew: "",
      match: false,
      expectedE2eDelta: false,
      latenciaNovaMs: null,
      bytesNovos: 0,
      metodos: [],
      visiveis: ativosOld.length,
      erro: "",
    };
    const stats = { metodos: [], bytes: 0, ms: 0 };
    try {
      const ativosNew = await ler(numero, false, stats);
      const removidosNew = await ler(numero, true, stats);
      base.ativosNew = ativosNew.length;
      base.removidosNew = removidosNew.length;
      base.hashAtivosNew = await sha256(JSON.stringify(ativosNew));
      base.hashRemovidosNew = await sha256(JSON.stringify(removidosNew));
      base.latenciaNovaMs = stats.ms;
      base.bytesNovos = stats.bytes;
      base.metodos = stats.metodos;
      const iguais =
        base.ativosOld === base.ativosNew &&
        base.removidosOld === base.removidosNew &&
        base.hashAtivosOld === base.hashAtivosNew &&
        base.hashRemovidosOld === base.hashRemovidosNew;
      base.match = iguais;
      base.expectedE2eDelta =
        numero === "2026102701" && base.ativosOld === 0 && base.ativosNew === 0 && base.removidosOld === 0 && base.removidosNew === 1;
      if (base.expectedE2eDelta) base.match = false;
    } catch (err) {
      base.erro = String((err && err.message) || "erro");
      base.latenciaNovaMs = stats.ms;
      base.bytesNovos = stats.bytes;
      base.metodos = stats.metodos;
      base.match = false;
    }
    window.__DK_PAGAMENTO_CANARY_RESULT__ = base;
    return base;
  }

  window.__DK_pagamentoCanaryComparar = comparar;
})();
