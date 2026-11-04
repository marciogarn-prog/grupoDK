/**
 * Terminal de locações e pagamentos.
 * A pesquisa guarda só o resumo da lista leve.
 * A locação aberta é o detalhe de um contrato.
 * Um resumo nunca volta ao servidor como se fosse a locação inteira.
 * localStorage dk_locacoes_cadastro não vence o Postgres e não substitui uma falha de leitura.
 */
(function portalLocacaoPg() {
  if (window.__DK_IS_DEMO_DEPLOY__ === true) return;

  /* Fonte oficial é Postgres desde o cutover — não esperar a 1ª lista para gravar. */
  window.__DK_LOCACAO_PG = true;

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
    if (typeof window.__DK_bgInterativaEntrar === "function") window.__DK_bgInterativaEntrar();
    try {
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
    } finally {
      if (typeof window.__DK_bgInterativaSair === "function") window.__DK_bgInterativaSair();
    }
  }

  async function detalhe(numero, signal) {
    if (typeof window.__DK_bgInterativaEntrar === "function") window.__DK_bgInterativaEntrar();
    try {
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
    } finally {
      if (typeof window.__DK_bgInterativaSair === "function") window.__DK_bgInterativaSair();
    }
  }

  function novoOperationId() {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  function mensagemFalha(status, data, err) {
    const reason = String((data && (data.reason || data.message)) || "").trim();
    if (err && (err.name === "AbortError" || /aborted/i.test(String(err.message || "")))) {
      return "O servidor demorou demais. Nada foi confirmado. Tente de novo — o mesmo envio será reutilizado.";
    }
    if (err && /failed to fetch|networkerror|load failed|conexão|connection/i.test(String(err.message || err))) {
      return "Sem ligação ao servidor. Nada foi confirmado. Os campos digitados foram mantidos.";
    }
    if (status === 401 || status === 403 || reason === "unauthorized" || reason === "auth") {
      return "Sessão inválida ou sem permissão. Entre de novo e tente gravar outra vez.";
    }
    if (status === 409 || (data && data.conflict)) {
      return "Conflito de versão: outro computador alterou este contrato. Os campos digitados foram mantidos — compare antes de gravar de novo.";
    }
    if (reason === "resumo_nao_e_locacao") {
      return "A lista leve não contém o contrato completo. Abra o protocolo de novo antes de gravar.";
    }
    if (reason === "operation_id_obrigatorio") {
      return "Falta o identificador da operação. Recarregue a página e tente de novo.";
    }
    if (reason === "revisao_desconhecida" || reason === "version_obrigatoria") {
      return "A revisão oficial do contrato não foi lida. Abra o protocolo de novo antes de gravar.";
    }
    if (reason === "idempotency_conflict" || reason === "IDEMPOTENCY_CONFLICT") {
      return "Esta operação já foi usada com outro conteúdo. Altere o formulário ou recarregue e tente de novo.";
    }
    if (status >= 500 || reason === "erro_interno") {
      return "O servidor falhou ao gravar. Nada foi confirmado. Tente de novo.";
    }
    if (reason) return "Não foi possível gravar (" + reason + "). Nada foi confirmado.";
    if (status) return "Não foi possível gravar (HTTP " + status + "). Nada foi confirmado.";
    return "Não foi possível gravar no servidor. Nada foi confirmado.";
  }

  /**
   * Gravação oficial: aguarda POST /api/dk-locacao + RPC.
   * Sucesso só após confirmação. Em falha preserva formulário e o mesmo operation_id.
   */
  async function salvarConfirmada(locEntrada, opts) {
    const op = String((opts && opts.op) || "").trim().toLowerCase() || "atualizar";
    let loc = locEntrada && typeof locEntrada === "object" ? { ...locEntrada } : null;
    if (!loc) {
      return { ok: false, status: 400, reason: "locacao_obrigatoria", message: "Locação obrigatória." };
    }
    const nc = digitos(loc.numeroContrato || loc.protocolo || (opts && opts.numero));
    if (!nc) {
      return { ok: false, status: 400, reason: "protocolo_obrigatorio", message: "Protocolo obrigatório." };
    }
    loc.numeroContrato = nc;

    if (ehResumo(loc) || loc.__dkResumo === true) {
      const det = await detalhe(nc);
      if (!det || det.ok !== true || !det.locacao) {
        return {
          ok: false,
          status: (det && det.status) || 400,
          reason: "resumo_nao_e_locacao",
          message: mensagemFalha(400, { reason: "resumo_nao_e_locacao" }),
        };
      }
      loc = {
        ...det.locacao,
        ...semMarcador(loc),
        numeroContrato: nc,
        pgId: loc.pgId || det.locacao.pgId,
        pgVersion: Number(loc.pgVersion || det.locacao.pgVersion || 0),
      };
      delete loc.__dkResumo;
    }

    const ehCriar = op === "criar" || op === "create" || (!loc.pgId && op === "gravar");
    const ehFinalizar = op === "finalize" || op === "finalizar";
    let expectedVersion = Number(loc.pgVersion);
    if (!ehCriar && (!Number.isFinite(expectedVersion) || expectedVersion <= 0)) {
      const det = await detalhe(nc);
      if (!det || det.ok !== true || !det.locacao) {
        return {
          ok: false,
          status: (det && det.status) || 400,
          reason: "revisao_desconhecida",
          message: mensagemFalha(400, { reason: "revisao_desconhecida" }),
          pending: true,
        };
      }
      expectedVersion = Number(det.locacao.pgVersion) || 0;
      loc = {
        ...det.locacao,
        ...semMarcador(loc),
        numeroContrato: nc,
        pgId: loc.pgId || det.locacao.pgId,
        pgVersion: expectedVersion,
      };
      delete loc.__dkResumo;
      if (!Number.isFinite(expectedVersion) || expectedVersion <= 0) {
        return {
          ok: false,
          status: 400,
          reason: "revisao_desconhecida",
          message: mensagemFalha(400, { reason: "revisao_desconhecida" }),
          pending: true,
        };
      }
    }

    const payloadLimpo = semMarcador(loc);
    const assin = assinatura(payloadLimpo);
    const chaveLogica =
      nc + ":" + (ehCriar ? "criar" : ehFinalizar ? "finalizar" : "atualizar") + ":" + assin;
    if (!window.__DK_LOCACAO_OP_IDS) window.__DK_LOCACAO_OP_IDS = Object.create(null);
    if (!window.__DK_LOCACAO_PENDING) window.__DK_LOCACAO_PENDING = Object.create(null);
    const pending = window.__DK_LOCACAO_PENDING[nc];
    let operation_id;
    if (pending && pending.assinatura === assin && pending.operation_id) {
      operation_id = pending.operation_id;
    } else {
      if (!window.__DK_LOCACAO_OP_IDS[chaveLogica]) {
        window.__DK_LOCACAO_OP_IDS[chaveLogica] = novoOperationId();
      }
      operation_id = window.__DK_LOCACAO_OP_IDS[chaveLogica];
      window.__DK_LOCACAO_PENDING[nc] = { operation_id, assinatura: assin, op: ehCriar ? "criar" : ehFinalizar ? "finalizar" : "atualizar" };
    }

    let res;
    let data = {};
    try {
      res = await fetch("/api/dk-locacao?nocache=" + Date.now(), {
        method: "POST",
        cache: "no-store",
        headers: headers(),
        body: JSON.stringify({
          op: ehCriar ? "criar" : ehFinalizar ? "finalizar" : "atualizar",
          numero: nc,
          version: ehCriar ? null : expectedVersion,
          locacao: payloadLimpo,
          operation_id,
        }),
      });
      data = await res.json().catch(() => ({}));
    } catch (err) {
      return {
        ok: false,
        status: 0,
        reason: "rede",
        message: mensagemFalha(0, null, err),
        operation_id,
        pending: true,
        conflict: false,
      };
    }

    if (!(res.status >= 200 && res.status < 300) || !data || data.ok === false) {
      return {
        ok: false,
        status: res.status,
        reason: (data && data.reason) || "falha",
        message: mensagemFalha(res.status, data),
        operation_id,
        pending: true,
        conflict: res.status === 409 || Boolean(data && data.conflict),
        data,
        oficial: data && data.oficial ? data.oficial : null,
      };
    }

    let oficial = data.locacao && typeof data.locacao === "object" ? semMarcador(data.locacao) : null;
    if (!oficial) {
      const det = await detalhe(nc);
      if (det && det.ok && det.locacao) oficial = semMarcador(det.locacao);
    }
    if (oficial && data.record_version != null) {
      oficial.pgVersion = Number(data.record_version);
    } else if (oficial && data.version != null) {
      oficial.pgVersion = Number(data.version);
    }
    if (oficial) {
      guardarDetalheAberto(oficial);
      const cache = Array.isArray(window.__DK_locacoesPgCache) ? window.__DK_locacoesPgCache.slice() : [];
      const i = cache.findIndex((l) => digitos(l && l.numeroContrato) === nc);
      if (i >= 0) cache[i] = oficial;
      else cache.push(oficial);
      window.__DK_locacoesPgCache = cache;
      publicarPesquisa(cache);
    }

    try {
      delete window.__DK_LOCACAO_OP_IDS[chaveLogica];
      delete window.__DK_LOCACAO_PENDING[nc];
    } catch {
      /* ignore */
    }

    try {
      if (typeof window.dkSyncCheckpoint === "function") void window.dkSyncCheckpoint("locacao_salva");
      if (typeof window.dkSyncCatchUp === "function") void window.dkSyncCatchUp("locacao_salva");
      if (data.audit_no != null) {
        window.dispatchEvent(
          new CustomEvent("dk:log:recarregar", { detail: { motivo: "locacao", audit_no: data.audit_no } })
        );
      }
    } catch {
      /* ignore */
    }

    return {
      ok: true,
      status: res.status,
      operation_id: data.operation_id || operation_id,
      audit_no: data.audit_no != null ? Number(data.audit_no) : null,
      seq: data.seq != null ? Number(data.seq) : null,
      version: data.record_version != null ? Number(data.record_version) : data.version != null ? Number(data.version) : null,
      idempotent: Boolean(data.idempotent),
      locacao: oficial || payloadLimpo,
      data,
    };
  }

  async function enviarUma(loc) {
    return salvarConfirmada(loc, { op: loc && loc.pgId ? "atualizar" : "criar" });
  }

  /**
   * Atualiza só o cache em memória. Não POST — gravação oficial é salvarConfirmada.
   */
  function salvarLista(list) {
    if (window.__DK_LOCACAO_PG !== true) return;
    const anterior = Array.isArray(window.__DK_locacoesPgCache) ? window.__DK_locacoesPgCache : [];
    const porNc = new Map(anterior.map((l) => [digitos(l.numeroContrato), l]));
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
    }
    if (vista.length) {
      window.__DK_locacoesPgCache = vista;
      publicarPesquisa(vista);
    }
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
    const travar = typeof window.__DK_bgTentarRelogio === "function";
    if (travar && !window.__DK_bgTentarRelogio()) return;
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
    } finally {
      if (travar) window.__DK_bgSoltarRelogio();
    }
  }

  function tentar() {
    if (!temSessao()) return;
    void carregar().catch(() => {});
  }

  window.__DK_locacaoPgRecarregar = carregar;
  window.__DK_locacaoPgDetalhe = detalhe;
  window.__DK_locacaoSalvarConfirmada = salvarConfirmada;
  window.setInterval(() => {
    if (window.__DK_LOCACAO_PG === true) void vigiar();
    else tentar();
  }, 15000);
  window.setTimeout(tentar, 800);
})();
