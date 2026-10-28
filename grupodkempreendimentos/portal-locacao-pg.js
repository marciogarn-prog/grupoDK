/**
 * Terminal de locações e pagamentos.
 * A pesquisa guarda só o resumo da lista leve.
 * A locação aberta é o detalhe de um contrato.
 * Um resumo nunca volta ao servidor como se fosse a locação inteira.
 * localStorage dk_locacoes_cadastro não vence o Postgres e não substitui uma falha de leitura.
 */
(function portalLocacaoPg() {
  if (window.__DK_IS_DEMO_DEPLOY__ === true) return;

  const CHAVE = "dk_locacoes_cadastro";
  let fila = Promise.resolve();
  let selo = "";
  let ganchos = false;
  let avisoConflito = false;

  function digitos(v) {
    return String(v || "").replace(/\D/g, "");
  }

  function headers() {
    const base = typeof window.__DK_portalApiHeaders === "function" ? window.__DK_portalApiHeaders() : {};
    return { Accept: "application/json", "Content-Type": "application/json", ...base };
  }

  function temSessao() {
    const h = headers();
    return Boolean(h.Authorization || h["X-DK-Portal-Token"] || h["x-dk-portal-token"]);
  }

  function assinatura(loc) {
    const pays = (Array.isArray(loc?.portalLancamentosAluguel) ? loc.portalLancamentosAluguel : [])
      .map((p) => `${String(p?.protocoloLancamento || "").trim()}|${Number(p?.valor) || 0}|${String(p?.data || "")}`)
      .sort()
      .join(";");
    const rems = (Array.isArray(loc?.portalLancamentosAluguelRemovidos) ? loc.portalLancamentosAluguelRemovidos : [])
      .map((p) => String(p?.protocoloLancamento || "").trim())
      .sort()
      .join(";");
    const resto = {};
    for (const [k, v] of Object.entries(loc || {})) {
      if (
        k === "portalLancamentosAluguel" ||
        k === "portalLancamentosAluguelRemovidos" ||
        k === "portalPagamentosAuditoria" ||
        k === "pgId" ||
        k === "pgVersion" ||
        k === "pgUpdatedAt"
      ) {
        continue;
      }
      resto[k] = v;
    }
    return `${JSON.stringify(resto)}#${pays}#${rems}`;
  }

  function publicarPesquisa(lista) {
    const api = window.__DK_pesquisaLocacaoEstado;
    if (api && typeof api.publicarProtocolosOficiais === "function") {
      api.publicarProtocolosOficiais(lista);
    } else {
      const set = new Set();
      (Array.isArray(lista) ? lista : []).forEach((loc) => {
        const nc = String(loc?.numeroContrato || loc?.protocolo || "").replace(/\D/g, "");
        if (nc) set.add(nc);
      });
      if (set.size) {
        window.__DK_locacoesNuvemOk = true;
        window.__DK_locacoesNuvemProtocolos = set;
      }
    }
    window.__DK_locacoesPesquisaFonte = "dk_locacao_lista_leve";
  }

  function marcarResumo(lista) {
    return (Array.isArray(lista) ? lista : []).map((loc) =>
      loc && typeof loc === "object" ? { ...loc, __dkResumo: true } : loc
    );
  }

  function ehResumo(loc) {
    return !loc || loc.__dkResumo === true;
  }

  function semMarcador(loc) {
    if (!loc || typeof loc !== "object") return loc;
    const limpo = { ...loc };
    delete limpo.__dkResumo;
    return limpo;
  }

  function guardarDetalheAberto(loc) {
    if (!loc || ehResumo(loc)) return;
    window.__DK_locacaoDetalheAtual = loc;
    const nc = digitos(loc.numeroContrato);
    if (!nc || !Array.isArray(window.__DK_locacoesPgCache)) return;
    window.__DK_locacoesPgCache = window.__DK_locacoesPgCache.map((item) =>
      digitos(item && item.numeroContrato) === nc ? loc : item
    );
  }

  function aplicarCache(locacoes) {
    window.__DK_locacoesPgCache = Array.isArray(locacoes) ? locacoes : [];
    window.__DK_LOCACAO_PG = true;
    publicarPesquisa(window.__DK_locacoesPgCache);
    try {
      localStorage.removeItem(CHAVE);
    } catch {
      /* preferência de tela pode ficar; locação não */
    }
    instalarGanchos();
  }

  function refrescarTela() {
    try {
      if (typeof window.__DK_portalRefreshOperacaoDeferred === "function") window.__DK_portalRefreshOperacaoDeferred();
    } catch {
      /* ignore */
    }
    try {
      if (typeof window.__DK_portalRepintarPagamentosAbertos === "function") window.__DK_portalRepintarPagamentosAbertos();
    } catch {
      /* ignore */
    }
  }

  async function carregar() {
    const res = await fetch("/api/dk-locacao-lista-leve?nocache=" + Date.now(), {
      method: "GET",
      cache: "no-store",
      headers: headers(),
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401 || res.status === 403) return data;
    if (!data || data.schema === false) return data;
    if (data.ativado === true && data.ok !== true) {
      window.__DK_LOCACAO_PG = true;
      window.__DK_LOCACAO_PG_ERRO = data.reason || "leitura";
      window.__DK_locacoesPgCache = [];
      window.__DK_locacaoDetalheAtual = null;
      return data;
    }
    if (data.ok && data.ativado === true && Array.isArray(data.locacoes)) {
      window.__DK_LOCACAO_PG_ERRO = "";
      const resumos = marcarResumo(data.locacoes);
      const aberta = window.__DK_locacaoDetalheAtual;
      if (aberta && !ehResumo(aberta)) {
        const nc = digitos(aberta.numeroContrato);
        const i = resumos.findIndex((loc) => digitos(loc && loc.numeroContrato) === nc);
        if (i >= 0) resumos[i] = aberta;
      }
      aplicarCache(resumos);
      refrescarTela();
    }
    return data;
  }

  async function detalhe(numero, signal) {
    const nc = digitos(numero);
    if (!nc) return { ok: false, reason: "contrato_obrigatorio" };
    const res = await fetch("/api/dk-locacao-detalhe?numeroContrato=" + encodeURIComponent(nc) + "&nocache=" + Date.now(), {
      method: "GET",
      cache: "no-store",
      headers: headers(),
      signal,
    });
    const data = await res.json().catch(() => ({}));
    if (!(res.status >= 200 && res.status < 300) || !data || data.ok !== true || !data.locacao) {
      return { ok: false, status: res.status, reason: (data && data.reason) || "leitura" };
    }
    const loc = semMarcador(data.locacao);
    guardarDetalheAberto(loc);
    return { ok: true, locacao: loc };
  }

  async function enviarUma(loc) {
    if (ehResumo(loc)) return { status: 400, data: { ok: false, reason: "resumo_nao_e_locacao" } };
    const res = await fetch("/api/dk-locacao?nocache=" + Date.now(), {
      method: "POST",
      cache: "no-store",
      headers: headers(),
      body: JSON.stringify({
        op: loc.pgId ? "atualizar" : "criar",
        numero: digitos(loc.numeroContrato),
        version: Number(loc.pgVersion) || 0,
        locacao: semMarcador(loc),
      }),
    });
    const data = await res.json().catch(() => ({}));
    return { status: res.status, data };
  }

  function salvarLista(list) {
    if (window.__DK_LOCACAO_PG !== true) return;
    const anterior = Array.isArray(window.__DK_locacoesPgCache) ? window.__DK_locacoesPgCache : [];
    const porNc = new Map(anterior.map((l) => [digitos(l.numeroContrato), l]));
    const tarefas = [];
    const vista = [];
    for (const loc of Array.isArray(list) ? list : []) {
      if (!loc || typeof loc !== "object") continue;
      const nc = digitos(loc.numeroContrato || loc.protocolo);
      if (!nc) continue;
      const velha = porNc.get(nc);
      const atual = {
        ...loc,
        numeroContrato: nc,
        pgId: loc.pgId || (velha && velha.pgId) || "",
        pgVersion: Number(loc.pgVersion || (velha && velha.pgVersion) || 0),
      };
      vista.push(atual);
      if (ehResumo(atual)) continue;
      if (!velha || assinatura(velha) !== assinatura(atual)) tarefas.push(atual);
    }
    if (vista.length) window.__DK_locacoesPgCache = vista;
    if (!tarefas.length) return;
    fila = fila
      .then(async () => {
        for (const loc of tarefas) {
          const r = await enviarUma(loc);
          if (r.status === 409 || (r.data && r.data.conflict)) {
            if (!avisoConflito) {
              avisoConflito = true;
              window.alert(
                "Este contrato foi atualizado em outro computador. A tela foi recarregada com a versão do servidor."
              );
            }
            await carregar();
            avisoConflito = false;
            return;
          }
          if (r.data && r.data.locacao) guardarDetalheAberto(semMarcador(r.data.locacao));
        }
        refrescarTela();
      })
      .catch((e) => {
        console.warn("[DK locação] gravação no servidor", e);
      });
  }

  function instalarGanchos() {
    if (ganchos) return;
    if (typeof loadCadastro !== "function" || typeof saveCadastro !== "function") return;
    ganchos = true;
    const ler = loadCadastro;
    loadCadastro = function dkLoadCadastroPg(key) {
      if (key === CHAVE && window.__DK_LOCACAO_PG === true) {
        return Array.isArray(window.__DK_locacoesPgCache) ? window.__DK_locacoesPgCache.slice() : [];
      }
      return ler.apply(this, arguments);
    };
    const gravar = saveCadastro;
    saveCadastro = function dkSaveCadastroPg(key, list) {
      if (key === CHAVE && window.__DK_LOCACAO_PG === true) {
        if (window.__DK_LOCACAO_PG_ERRO) return;
        salvarLista(list);
        return;
      }
      return gravar.apply(this, arguments);
    };
    const setItem = localStorage.setItem.bind(localStorage);
    localStorage.setItem = function dkSetItemPg(key, value) {
      if (key === CHAVE && window.__DK_LOCACAO_PG === true) return;
      return setItem(key, value);
    };
  }

  async function vigiar() {
    if (window.__DK_LOCACAO_PG !== true) return;
    try {
      const res = await fetch("/api/dk-locacao?op=relogio&nocache=" + Date.now(), {
        method: "GET",
        cache: "no-store",
        headers: headers(),
      });
      const data = await res.json().catch(() => ({}));
      if (data && data.schema && data.selo && data.selo !== selo) {
        const primeiro = !selo;
        selo = data.selo;
        if (!primeiro) await carregar();
      }
    } catch {
      /* a tela continua com a última resposta do servidor */
    }
  }

  function tentar() {
    if (!temSessao()) return;
    void carregar().catch(() => {});
  }

  window.__DK_locacaoPgRecarregar = carregar;
  window.__DK_locacaoPgDetalhe = detalhe;
  window.setInterval(() => {
    if (window.__DK_LOCACAO_PG === true) void vigiar();
    else tentar();
  }, 15000);
  window.setTimeout(tentar, 800);
})();
