/**
 * Terminal de locações e pagamentos.
 * A tela só adota o PostgreSQL quando a API devolve ativado=true.
 * Sem essa marca, o cadastro continua no snapshot.
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

  function aplicarCache(locacoes) {
    window.__DK_locacoesPgCache = Array.isArray(locacoes) ? locacoes : [];
    window.__DK_LOCACAO_PG = true;
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
    const res = await fetch("/api/dk-locacao?op=list&nocache=" + Date.now(), {
      method: "GET",
      cache: "no-store",
      headers: headers(),
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401 || res.status === 403) return data;
    if (!data || data.schema === false) return data;
    if (data.migracao === "supabase_indisponivel" || data.migracao === "falhou") return data;
    if (data.ok && data.ativado === true && (data.migracao === "pronta" || data.migracao === "semeada" || data.migracao === "vazio")) {
      aplicarCache(data.locacoes || []);
      refrescarTela();
    }
    return data;
  }

  async function enviarUma(loc) {
    const res = await fetch("/api/dk-locacao?nocache=" + Date.now(), {
      method: "POST",
      cache: "no-store",
      headers: headers(),
      body: JSON.stringify({
        op: loc.pgId ? "atualizar" : "criar",
        numero: digitos(loc.numeroContrato),
        version: Number(loc.pgVersion) || 0,
        locacao: loc,
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
          if (r.data && r.data.locacao) {
            const nc = digitos(r.data.locacao.numeroContrato);
            window.__DK_locacoesPgCache = (window.__DK_locacoesPgCache || []).map((item) =>
              digitos(item.numeroContrato) === nc ? r.data.locacao : item
            );
          }
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
      if (key === CHAVE && window.__DK_LOCACAO_PG === true && Array.isArray(window.__DK_locacoesPgCache)) {
        return window.__DK_locacoesPgCache.slice();
      }
      return ler.apply(this, arguments);
    };
    const gravar = saveCadastro;
    saveCadastro = function dkSaveCadastroPg(key, list) {
      if (key === CHAVE && window.__DK_LOCACAO_PG === true) {
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
  window.setInterval(() => {
    if (window.__DK_LOCACAO_PG === true) void vigiar();
    else tentar();
  }, 15000);
  window.setTimeout(tentar, 800);
})();
