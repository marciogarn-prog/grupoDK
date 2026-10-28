/**
 * Camada única da tela de lançamento de aluguel.
 * Produção fica em legacy. O modo fractionated existe, mas não é o ativo
 * e não muda por memória do navegador nem por escolha do operador.
 *
 * Pontos atuais da tela, ainda no caminho antigo:
 * LER ativos: getPortalLancamentosAluguelDoContrato, portalLancamentosAluguelFromCadastroGlobal
 * LER removidos: portalLancamentosAluguelRemovidos
 * CRIAR: persistPortalLancamentoAluguelPagamento e as variantes de devolução, crédito e caução
 * EDITAR: atualizarPortalLancamentoAluguelPorIndice
 * REMOVER: apagarPortalLancamentoAluguelPorIndice, apagarPortalLancamentoAluguelPorProtocolo
 * totais: isLancamentoAluguelContabilizavel, getPortalLancamentosAluguelContabilizaveisDoContrato,
 *         sumPortalLancamentosAluguelTotal, sumPortalLancamentosAluguelNoAno
 * recibo: portalMontarTextoReciboPagamentoAluguel, portalAbrirReciboAposLancamentoAvulso,
 *         portalAbrirReciboDeLancamentoHistorico
 * calendário: somaPagamentosCalendarioPorIso, persistPortalLancAluguelCalendarioAno
 * histórico: renderOperacaoLancAluguelHistorico, refreshOperacaoLocacaoLancamentosHistorico
 */
(function dkPagamentoStore(raiz) {
  const MODO_PRODUCAO = "legacy";
  const metas = new WeakMap();

  function copiarNegocio(item) {
    if (!item || typeof item !== "object" || Array.isArray(item)) return null;
    const saida = {};
    for (const chave of Object.keys(item)) saida[chave] = item[chave];
    return saida;
  }

  function numeroOuNulo(valor) {
    const n = Number(valor);
    return Number.isFinite(n) ? n : null;
  }

  function guardarMeta(pagamento, meta) {
    if (!pagamento || typeof pagamento !== "object") return;
    metas.set(pagamento, {
      id: meta && meta.id ? String(meta.id) : null,
      version: numeroOuNulo(meta && meta.version),
      source_position: numeroOuNulo(meta && meta.source_position),
      protocolo: meta && meta.protocolo != null ? meta.protocolo : pagamento.protocoloLancamento ?? null,
    });
  }

  function bytesDe(corpo) {
    const texto = JSON.stringify(corpo);
    return { texto, bytes: unescape(encodeURIComponent(texto)).length };
  }

  function mesmoDiaMesmoValor(pagamento, existentes) {
    const tipo = String(pagamento && (pagamento.tipoMovimento || pagamento.tipo) || "")
      .trim()
      .toUpperCase();
    if (tipo.includes("DEVOL") || tipo.includes("CREDIT") || tipo.includes("CAUC")) return false;
    const data = String(pagamento && pagamento.data || "").trim();
    const valor = Number(pagamento && pagamento.valor);
    if (!data || !Number.isFinite(valor) || valor <= 0) return false;
    return (Array.isArray(existentes) ? existentes : []).some((item) => {
      const outroTipo = String(item && (item.tipoMovimento || item.tipo) || "").trim().toUpperCase();
      if (outroTipo.includes("DEVOL") || outroTipo.includes("CREDIT") || outroTipo.includes("CAUC")) return false;
      return String(item && item.data || "").trim() === data && Number(item && item.valor) === valor;
    });
  }

  function criar(opcoes) {
    const modo = opcoes && opcoes.modo === "fractionated" ? "fractionated" : "legacy";
    const pedir = opcoes && typeof opcoes.fetch === "function" ? opcoes.fetch : null;

    async function lerRemoto(numeroContrato, removidos) {
      const nc = String(numeroContrato || "").trim();
      if (!nc) return { ok: false, status: 400, reason: "contrato_obrigatorio", modo, fallback: false };
      const url =
        "/api/dk-pagamento-locacao?numeroContrato=" +
        encodeURIComponent(nc) +
        (removidos ? "&scope=removidos" : "");
      let resposta;
      try {
        resposta = await (pedir || fetch)(url, { method: "GET", cache: "no-store" });
      } catch {
        return { ok: false, status: 503, reason: "postgres_indisponivel", modo, fallback: false };
      }
      const status = Number(resposta && resposta.status) || 0;
      if (!(status >= 200 && status < 300)) {
        return { ok: false, status: status || 503, reason: "postgres_indisponivel", modo, fallback: false };
      }
      let data = {};
      try {
        data = typeof resposta.json === "function" ? await resposta.json() : {};
      } catch {
        return { ok: false, status: 503, reason: "postgres_indisponivel", modo, fallback: false };
      }
      if (!data || data.ok === false || data.fallback === true) {
        return {
          ok: false,
          status: data && data.fallback === true ? 503 : status,
          reason: data && data.fallback === true ? "fallback_proibido" : data && data.reason || "postgres_indisponivel",
          modo,
          fallback: false,
        };
      }
      const fonteMeta = Array.isArray(data.records)
        ? data.records
        : Array.isArray(data.registros)
          ? data.registros
          : [];
      const pagamentos = (Array.isArray(data.pagamentos) ? data.pagamentos : [])
        .map(copiarNegocio)
        .filter(Boolean);
      pagamentos.forEach((pagamento, indice) => {
        const registro = fonteMeta[indice] && typeof fonteMeta[indice] === "object" ? fonteMeta[indice] : {};
        guardarMeta(pagamento, {
          id: registro.id || null,
          version: registro.version,
          source_position: registro.source_position,
          protocolo:
            pagamento.protocoloLancamento != null
              ? pagamento.protocoloLancamento
              : registro.protocolo != null
                ? registro.protocolo
                : null,
        });
      });
      return {
        ok: true,
        status: 200,
        modo,
        numeroContrato: nc,
        removido: Boolean(removidos),
        pagamentos,
        quantidade: pagamentos.length,
        fallback: false,
      };
    }

    function listaLocal(loc, chave) {
      const origem = loc && Array.isArray(loc[chave]) ? loc[chave] : [];
      return origem.map(copiarNegocio).filter(Boolean);
    }

    async function listarAtivos(numeroContrato, loc) {
      if (modo !== "fractionated") {
        const pagamentos = listaLocal(loc, "portalLancamentosAluguel");
        return { ok: true, status: 200, modo: "legacy", pagamentos, quantidade: pagamentos.length, fallback: false };
      }
      return lerRemoto(numeroContrato, false);
    }

    async function listarRemovidos(numeroContrato, loc) {
      if (modo !== "fractionated") {
        const pagamentos = listaLocal(loc, "portalLancamentosAluguelRemovidos");
        return { ok: true, status: 200, modo: "legacy", pagamentos, quantidade: pagamentos.length, fallback: false };
      }
      return lerRemoto(numeroContrato, true);
    }

    function prepararEscrita(op, numeroContrato, pagamento, extra) {
      const negocio = copiarNegocio(pagamento) || {};
      const corpo = { op, numeroContrato: String(numeroContrato || "").trim() };
      for (const chave of Object.keys(negocio)) corpo[chave] = negocio[chave];
      if (extra && typeof extra === "object") {
        if (extra.id) corpo.id = String(extra.id);
        if (extra.version != null) corpo.version = Number(extra.version);
        if (extra.campos && typeof extra.campos === "object") corpo.campos = { ...extra.campos };
      }
      if (op === "remover") corpo.removido = true;
      const medida = bytesDe(corpo);
      return {
        method: "POST",
        url: "/api/dk-pagamento-locacao",
        body: corpo,
        bytes: medida.bytes,
        texto: medida.texto,
      };
    }

    function recusarEnvio(preparo, status, reason) {
      return {
        ok: false,
        status,
        reason,
        modo,
        enviado: false,
        alterouTela: false,
        retry: false,
        fallback: false,
        request: { method: preparo.method, url: preparo.url, body: preparo.body },
        bytes: preparo.bytes,
      };
    }

    async function criar(numeroContrato, pagamento, extra) {
      if (modo !== "fractionated") {
        return { ok: true, status: 200, modo: "legacy", via: "persistPortalLancamentoAluguelPagamento", enviado: false, fallback: false };
      }
      const preparo = prepararEscrita("criar", numeroContrato, pagamento, extra);
      if (mesmoDiaMesmoValor(pagamento, extra && extra.existentes)) {
        return recusarEnvio(preparo, 409, "duplicate_payment_same_day_value");
      }
      if (extra && extra.simular === 503) return recusarEnvio(preparo, 503, "postgres_indisponivel");
      return {
        ok: true,
        status: 200,
        modo,
        dryRun: true,
        enviado: false,
        alterouTela: false,
        fallback: false,
        request: { method: preparo.method, url: preparo.url, body: preparo.body },
        bytes: preparo.bytes,
      };
    }

    async function atualizar(numeroContrato, pagamento, version, extra) {
      if (modo !== "fractionated") {
        return { ok: true, status: 200, modo: "legacy", via: "atualizarPortalLancamentoAluguelPorIndice", enviado: false, fallback: false };
      }
      const meta = metas.get(pagamento) || {};
      const preparo = prepararEscrita("atualizar", numeroContrato, pagamento, {
        id: (extra && extra.id) || meta.id,
        version,
        campos: extra && extra.campos,
      });
      if (extra && extra.simular === 409) return recusarEnvio(preparo, 409, "version");
      if (extra && extra.simular === 503) return recusarEnvio(preparo, 503, "postgres_indisponivel");
      if (!Number.isInteger(Number(version)) || Number(version) < 1) return recusarEnvio(preparo, 409, "version");
      return {
        ok: true,
        status: 200,
        modo,
        dryRun: true,
        enviado: false,
        alterouTela: false,
        fallback: false,
        request: { method: preparo.method, url: preparo.url, body: preparo.body },
        bytes: preparo.bytes,
      };
    }

    async function remover(numeroContrato, pagamento, version, extra) {
      if (modo !== "fractionated") {
        return { ok: true, status: 200, modo: "legacy", via: "apagarPortalLancamentoAluguelPorProtocolo", enviado: false, fallback: false };
      }
      const meta = metas.get(pagamento) || {};
      const preparo = prepararEscrita("remover", numeroContrato, pagamento, {
        id: (extra && extra.id) || meta.id,
        version,
      });
      if (extra && extra.simular === 409) return recusarEnvio(preparo, 409, "version");
      if (extra && extra.simular === 503) return recusarEnvio(preparo, 503, "postgres_indisponivel");
      return {
        ok: true,
        status: 200,
        modo,
        dryRun: true,
        enviado: false,
        alterouTela: false,
        removido: true,
        fallback: false,
        request: { method: preparo.method, url: preparo.url, body: preparo.body },
        bytes: preparo.bytes,
      };
    }

    function lerAtivosTela(loc, legado) {
      if (modo === "fractionated") return [];
      if (typeof legado === "function") return legado(loc);
      return listaLocal(loc, "portalLancamentosAluguel");
    }

    function lerRemovidosTela(loc, legado) {
      if (modo === "fractionated") return [];
      if (typeof legado === "function") return legado(loc);
      return listaLocal(loc, "portalLancamentosAluguelRemovidos");
    }

    function delegarTela(op, numeroContrato, pagamento, extra) {
      if (modo === "fractionated") {
        const preparo = prepararEscrita(op, numeroContrato, pagamento, extra);
        if (extra && extra.simular === 409) return recusarEnvio(preparo, 409, "version");
        if (extra && extra.simular === 503) return recusarEnvio(preparo, 503, "postgres_indisponivel");
        if (op === "atualizar") {
          const versao = Number(extra && extra.version);
          if (!Number.isInteger(versao) || versao < 1) return recusarEnvio(preparo, 409, "version");
        }
        const saida = {
          ok: true,
          status: 200,
          modo,
          dryRun: true,
          enviado: false,
          alterouTela: false,
          fallback: false,
          request: { method: preparo.method, url: preparo.url, body: preparo.body },
          bytes: preparo.bytes,
        };
        if (op === "remover") saida.removido = true;
        return saida;
      }
      if (extra && typeof extra.executar === "function") return extra.executar();
      const via =
        op === "atualizar"
          ? "atualizarPortalLancamentoAluguelPorIndice"
          : op === "remover"
            ? "apagarPortalLancamentoAluguelPorProtocolo"
            : "persistPortalLancamentoAluguelPagamento";
      return { ok: true, status: 200, modo: "legacy", via, enviado: false, fallback: false };
    }

    function criarTela(numeroContrato, pagamento, extra) {
      return delegarTela("criar", numeroContrato, pagamento, extra);
    }

    function comVersao(version, extra) {
      const pedido = extra && typeof extra === "object" ? { ...extra } : {};
      if (version != null && pedido.version == null) pedido.version = Number(version);
      return pedido;
    }

    function atualizarTela(numeroContrato, pagamento, version, extra) {
      return delegarTela("atualizar", numeroContrato, pagamento, comVersao(version, extra));
    }

    function removerTela(numeroContrato, pagamento, version, extra) {
      return delegarTela("remover", numeroContrato, pagamento, comVersao(version, extra));
    }

    return {
      modo,
      listarAtivos,
      listarRemovidos,
      lerAtivosTela,
      lerRemovidosTela,
      criar,
      atualizar,
      remover,
      criarTela,
      atualizarTela,
      removerTela,
      metaDe(pagamento) {
        return metas.get(pagamento) || null;
      },
    };
  }

  const producao = criar({ modo: MODO_PRODUCAO });
  const alvo = raiz || {};
  alvo.__DK_pagamentoStore = producao;
  alvo.__DK_pagamentoStoreModo = MODO_PRODUCAO;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = { criar, MODO_PRODUCAO, producao };
  }
})(typeof window !== "undefined" ? window : {});
