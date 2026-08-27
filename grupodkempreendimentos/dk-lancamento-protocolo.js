/**
 * Oficial: lançamentos estritos — sem legado global/demo, só portalLancamentosAluguel auditável.
 * Demo: consolidação completa (legado + planilha) para testes.
 */
(function dkLancamentoProtocolo() {
  const PROTO_RE = /^\d{14}-\d{3}$/;
  const GLOBAL_KEYS = [
    "dk_lancamentos_aluguel",
    "dk_lancamento_aluguel",
    "dk_lancamentos_aluguel_cadastro",
    "dk_lancamento_aluguel_cadastro",
  ];

  function onlyDigits(s) {
    return String(s ?? "").replace(/\D/g, "");
  }

  function isOficialDeploy() {
    const h = String(window.location.hostname || "").toLowerCase();
    if (h === "grupodkempreendimentos.com.br" || h === "www.grupodkempreendimentos.com.br") return true;
    if (h === "demo.grupodkempreendimentos.com.br" || /^demo\./.test(h)) return false;
    const ch = String(window.__DK_DEPLOY_CHANNEL__ || "").trim().toLowerCase();
    if (ch === "demo") return false;
    if (ch === "default") return true;
    return window.__DK_IS_DEMO_DEPLOY__ !== true;
  }

  /** App do cliente: mostra o que o operador gravou na nuvem, sem o filtro estrito do portal. */
  function isClienteAppContext() {
    try {
      const p = String(window.location.pathname || "").toLowerCase();
      if (p === "/cliente" || p.endsWith("/cliente") || p.endsWith("/cliente.html")) return true;
    } catch {
      /* ignore */
    }
    return Boolean(window.__DK_CLIENTE_APP);
  }

  function normNc(v) {
    return String(v ?? "")
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "");
  }

  function normPlate(p) {
    return String(p ?? "")
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "");
  }

  function parseValorRaw(v) {
    if (typeof v === "number" && Number.isFinite(v)) return v;
    const s = String(v ?? "").trim();
    if (!s) return 0;
    if (s.includes(",")) {
      const cleaned = s.replace(/[R$\s]/g, "").replace(/\./g, "").replace(",", ".");
      const n = Number(cleaned);
      return Number.isFinite(n) ? n : 0;
    }
    const plain = s.replace(/[R$\s]/g, "");
    if (/^\d+(\.\d{1,2})?$/.test(plain)) {
      const n = Number(plain);
      return Number.isFinite(n) ? n : 0;
    }
    if (typeof window.parseCurrencyBR === "function") {
      const n = Number(window.parseCurrencyBR(s));
      return Number.isFinite(n) ? n : 0;
    }
    const n = Number(plain.replace(/\./g, "").replace(",", "."));
    return Number.isFinite(n) ? n : 0;
  }

  function gerarProtocoloLancamento(cpfOperador, when) {
    const d = when instanceof Date ? when : new Date(when || Date.now());
    if (Number.isNaN(d.getTime())) return "";
    const pad = (n) => String(n).padStart(2, "0");
    const cpf3 = onlyDigits(cpfOperador).slice(0, 3);
    const suffix = cpf3.length >= 3 ? cpf3 : "000";
    return (
      String(d.getFullYear()) +
      pad(d.getMonth() + 1) +
      pad(d.getDate()) +
      pad(d.getHours()) +
      pad(d.getMinutes()) +
      pad(d.getSeconds()) +
      "-" +
      suffix
    );
  }

  function isProtocoloLancamentoValid(s) {
    return PROTO_RE.test(String(s || "").trim());
  }

  function portalLancamentoRemocaoKeys(x) {
    const keys = [];
    const proto = String(x?.protocoloLancamento || x?.protocolo || "").trim();
    if (PROTO_RE.test(proto)) keys.push("p:" + proto);
    const data = String(x?.data || x?.dataPagamento || "").trim();
    const valor = Number(x?.valor);
    const ca = Number(x?.createdAt || x?.id || 0);
    const rp = onlyDigits(x?.registradoPorCpf || "").slice(0, 11);
    if (data && Number.isFinite(valor) && valor > 0) {
      keys.push(
        "l:" + data + "|" + valor.toFixed(2) + "|" + (Number.isFinite(ca) ? ca : 0) + "|" + rp
      );
    }
    return keys;
  }

  function mergePortalLancamentosRemovidos(arrays) {
    const byId = new Map();
    for (const arr of arrays || []) {
      if (!Array.isArray(arr)) continue;
      for (const raw of arr) {
        if (!raw || typeof raw !== "object") continue;
        const keys = portalLancamentoRemocaoKeys(raw);
        if (!keys.length) continue;
        const row = {
          protocoloLancamento: String(raw.protocoloLancamento || raw.protocolo || "").trim(),
          data: String(raw.data || raw.dataPagamento || "").trim(),
          valor: Number(raw.valor),
          createdAt: Number(raw.createdAt || 0),
          registradoPorCpf: onlyDigits(raw.registradoPorCpf || "").slice(0, 11),
          removedAt: Number(raw.removedAt || 0) || Date.now(),
        };
        const id = keys.join("|");
        if (!byId.has(id)) byId.set(id, row);
      }
    }
    return Array.from(byId.values());
  }

  function filtrarPortalLancamentosPorRemovidos(payments, removidos) {
    const list = Array.isArray(payments) ? payments : [];
    if (!list.length) return list;
    const rem = Array.isArray(removidos) ? removidos : [];
    if (!rem.length) return list;
    const tomb = new Set();
    for (const t of rem) {
      for (const k of portalLancamentoRemocaoKeys(t)) tomb.add(k);
    }
    return list.filter((row) => !portalLancamentoRemocaoKeys(row).some((k) => tomb.has(k)));
  }

  function anexarLancamentosMergeNaLocacao(target, ex, incoming, mergedPl) {
    if (!target || typeof target !== "object") return target;
    const mergedRem = mergePortalLancamentosRemovidos([
      ex?.portalLancamentosAluguelRemovidos,
      incoming?.portalLancamentosAluguelRemovidos,
    ]);
    target.portalLancamentosAluguel = filtrarPortalLancamentosPorRemovidos(mergedPl, mergedRem);
    if (mergedRem.length) target.portalLancamentosAluguelRemovidos = mergedRem;
    const mergedAud = mergePagamentosAuditoria([
      ex?.portalPagamentosAuditoria,
      incoming?.portalPagamentosAuditoria,
    ]);
    if (mergedAud.length) target.portalPagamentosAuditoria = mergedAud;
    syncResumoPagamentosNaLocacao(target);
    return target;
  }

  function pagamentoAuditoriaId(ev) {
    if (ev?.id) return String(ev.id).trim();
    const at = Number(ev?.at || ev?.createdAt || 0);
    const acao = String(ev?.acao || "").trim().toLowerCase();
    const proto = String(ev?.protocoloLancamento || "").trim();
    const nc = String(ev?.numeroContrato || "")
      .trim()
      .toUpperCase()
      .replace(/\s+/g, "");
    const cpf = onlyDigits(ev?.operadorCpf).slice(0, 11);
    return [at, acao, proto, nc, cpf].join("|");
  }

  function mergePagamentosAuditoria(arrays) {
    const byId = new Map();
    for (const arr of arrays || []) {
      if (!Array.isArray(arr)) continue;
      for (const raw of arr) {
        if (!raw || typeof raw !== "object") continue;
        const acao = String(raw.acao || "").trim().toLowerCase();
        if (!acao) continue;
        const id = pagamentoAuditoriaId(raw);
        if (!id) continue;
        if (byId.has(id)) continue;
        byId.set(id, {
          id,
          at: Number(raw.at || raw.createdAt || 0) || Date.now(),
          acao,
          numeroContrato: String(raw.numeroContrato || "").trim(),
          cpfCliente: onlyDigits(raw.cpfCliente).slice(0, 11),
          protocoloLancamento: String(raw.protocoloLancamento || "").trim(),
          dataPagamento: String(raw.dataPagamento || raw.data || "").trim(),
          valor: Number(raw.valor) || 0,
          operadorCpf: onlyDigits(raw.operadorCpf).slice(0, 11),
          operadorNome: String(raw.operadorNome || "").trim(),
          detalhe: String(raw.detalhe || "").trim(),
        });
      }
    }
    return Array.from(byId.values()).sort((a, b) => Number(a.at || 0) - Number(b.at || 0));
  }

  function syncResumoPagamentosNaLocacao(loc) {
    if (!loc || typeof loc !== "object") return loc;
    const arr = Array.isArray(loc.portalLancamentosAluguel) ? loc.portalLancamentosAluguel : [];
    const sum = arr.reduce((s, x) => s + Number(x.valor || 0), 0);
    loc.totalPagoAno2025 = sum.toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    const maxCa = arr.reduce((m, x) => Math.max(m, Number(x.createdAt || 0)), 0);
    const cur = Number(loc.updatedAt || loc.createdAt || 0);
    if (Number.isFinite(maxCa) && maxCa > cur) loc.updatedAt = maxCa;
    if (!arr.length) {
      loc.ultimoLancamentoAluguelData = "";
      loc.ultimoLancamentoAluguelValor = "";
      return loc;
    }
    const last = arr.reduce(
      (a, b) => (Number(b.createdAt || 0) >= Number(a.createdAt || 0) ? b : a),
      arr[0]
    );
    loc.ultimoLancamentoAluguelData = String(last.data || "").trim();
    loc.ultimoLancamentoAluguelValor =
      "R$\u00a0" +
      Number(last.valor || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return loc;
  }

  /** Oficial: rejeita fantasma, legado -000, teste e lançamento sem operador identificado. */
  function isLancamentoOficialAceite(row) {
    if (!row || row.pagamentoInvalidado) return false;
    if (!isOficialDeploy() || isClienteAppContext()) return true;
    if (row.ficticio) return false;
    const proto = String(row.protocoloLancamento || "").trim();
    if (!isProtocoloLancamentoValid(proto)) return false;
    if (proto.endsWith("-000")) return false;
    const cpfOp = onlyDigits(row.registradoPorCpf || row.comprovanteValidadoPorCpf || "").slice(0, 11);
    if (cpfOp.length !== 11) return false;
    const ca = Number(row.createdAt);
    if (!Number.isFinite(ca) || ca <= 0) return false;
    return true;
  }

  const PORTAL_LANC_TIPO_PAGAMENTO = "PAGAMENTO";
  const PORTAL_LANC_TIPO_DEVOLUCAO_INVESTIMENTO = "DEVOLUCAO_INVESTIMENTO";

  function lancamentoTipoMovimento(x) {
    const t = String(x?.tipoMovimento || "").trim().toUpperCase();
    if (t === PORTAL_LANC_TIPO_DEVOLUCAO_INVESTIMENTO) return PORTAL_LANC_TIPO_DEVOLUCAO_INVESTIMENTO;
    const MEIOS = ["valorEspecie", "valorPix", "valorCartao"];
    const hasMeios = MEIOS.some((k) => Object.prototype.hasOwnProperty.call(x || {}, k));
    if (!hasMeios && Number(x?.valor) < 0) return PORTAL_LANC_TIPO_DEVOLUCAO_INVESTIMENTO;
    return PORTAL_LANC_TIPO_PAGAMENTO;
  }

  function lancamentoEhDevolucaoInvestimento(x) {
    return lancamentoTipoMovimento(x) === PORTAL_LANC_TIPO_DEVOLUCAO_INVESTIMENTO;
  }

  function normalizeRow(raw) {
    if (!raw || typeof raw !== "object") return null;
    if (raw.pagamentoInvalidado) return null;
    const data = String(raw.data || raw.dataPagamento || raw.semanaInicio || "").trim();
    if (!data) return null;
    const tipoMovimento = lancamentoTipoMovimento(raw);
    const ehDevolucao = tipoMovimento === PORTAL_LANC_TIPO_DEVOLUCAO_INVESTIMENTO;
    const MEIOS = ["valorEspecie", "valorPix", "valorCartao"];
    const hasMeios = MEIOS.some((k) => Object.prototype.hasOwnProperty.call(raw, k));
    let valor;
    let valorEspecie;
    let valorPix;
    let valorCartao;
    if (ehDevolucao) {
      valor =
        typeof raw.valor === "number" && Number.isFinite(raw.valor) ? raw.valor : parseValorRaw(raw.valor ?? raw.valorPago ?? 0);
      const abs = Math.abs(Number(valor));
      if (!Number.isFinite(abs) || abs <= 0) return null;
      valor = -abs;
    } else if (hasMeios) {
      valorEspecie = parseValorRaw(raw.valorEspecie ?? 0);
      valorPix = parseValorRaw(raw.valorPix ?? 0);
      valorCartao = parseValorRaw(raw.valorCartao ?? 0);
      valor = valorEspecie + valorPix + valorCartao;
      if (!Number.isFinite(valor) || valor <= 0) return null;
    } else {
      valor =
        typeof raw.valor === "number" && Number.isFinite(raw.valor) && raw.valor > 0
          ? raw.valor
          : parseValorRaw(raw.valor ?? raw.valorPago ?? 0);
      if (!Number.isFinite(valor) || valor <= 0) return null;
    }
    const createdAtRaw = Number(raw.createdAt);
    const createdAt =
      Number.isFinite(createdAtRaw) && createdAtRaw > 0
        ? createdAtRaw
        : Number(raw.id || 0) || Date.now();
    const registradoPorCpf = onlyDigits(String(raw.registradoPorCpf || raw.registradoPor || "")).slice(0, 11);
    const registradoPorNome = String(raw.registradoPorNome || raw.comprovanteValidadoPorNome || "").trim();
    const row = {
      data,
      valor,
      createdAt,
      registradoPorCpf,
      registradoPorNome,
      protocoloLancamento: String(raw.protocoloLancamento || raw.protocolo || "").trim(),
      origemComprovanteClienteId: String(raw.origemComprovanteClienteId || "").trim(),
      comprovanteFp: String(raw.comprovanteFp || "").trim(),
      confirmadoViaAppCliente: Boolean(raw.confirmadoViaAppCliente),
      comprovanteValidadoPorCpf: onlyDigits(String(raw.comprovanteValidadoPorCpf || "")).slice(0, 11),
      ficticio: Boolean(raw.ficticio),
    };
    const comentarioPagamento = String(raw.comentarioPagamento || raw.comentario || "").trim().slice(0, 500);
    if (comentarioPagamento) row.comentarioPagamento = comentarioPagamento;
    if (ehDevolucao) row.tipoMovimento = PORTAL_LANC_TIPO_DEVOLUCAO_INVESTIMENTO;
    if (!ehDevolucao && hasMeios) {
      row.valorEspecie = valorEspecie;
      row.valorPix = valorPix;
      row.valorCartao = valorCartao;
    }
    if (!isProtocoloLancamentoValid(row.protocoloLancamento)) {
      const cpfProto = registradoPorCpf || row.comprovanteValidadoPorCpf;
      const proto = gerarProtocoloLancamento(cpfProto, new Date(createdAt));
      if (proto) row.protocoloLancamento = proto;
    }
    if (isOficialDeploy() && !isClienteAppContext() && !isLancamentoOficialAceite(row)) return null;
    return row;
  }

  function readGlobalRowsForLoc(loc) {
    if (isOficialDeploy()) return [];
    const cpf = onlyDigits(loc?.cpf).slice(0, 11);
    const nc = normNc(loc?.numeroContrato);
    const placa = normPlate(loc?.placa);
    if (cpf.length !== 11 || !nc || !placa) return [];
    const globals = readGlobalLancamentosStorageCached();
    const out = [];
    for (const global of globals) {
      if (!Array.isArray(global)) continue;
      for (const item of global) {
        if (!item || typeof item !== "object") continue;
        if (onlyDigits(item.cpf).slice(0, 11) !== cpf) continue;
        if (normNc(item.numeroContrato) !== nc && normPlate(item.placa) !== placa) continue;
        const n = normalizeRow({
          data: item.dataPagamento || item.semanaInicio || item.data,
          valor: item.valorPago ?? item.valor,
          createdAt: item.createdAt || item.id,
          registradoPorCpf: item.registradoPorCpf,
          registradoPorNome: item.registradoPorNome,
          protocoloLancamento: item.protocoloLancamento,
        });
        if (n) out.push(n);
      }
    }
    return out;
  }

  let globalLancamentosStorageCache = null;

  function readGlobalLancamentosStorageCached() {
    if (globalLancamentosStorageCache) return globalLancamentosStorageCache;
    const buckets = [];
    for (const key of GLOBAL_KEYS) {
      try {
        const raw = localStorage.getItem(key);
        const global = raw ? JSON.parse(raw) : [];
        buckets.push(Array.isArray(global) ? global : []);
      } catch {
        buckets.push([]);
      }
    }
    globalLancamentosStorageCache = buckets;
    return buckets;
  }

  function clearGlobalLancamentosStorageCache() {
    globalLancamentosStorageCache = null;
  }

  function collectLegacySources(loc) {
    const chunks = [];
    const push = (arr) => {
      if (!Array.isArray(arr) || !arr.length) return;
      const n = arr.map(normalizeRow).filter(Boolean);
      if (n.length) chunks.push(n);
    };
    push(loc?.portalLancamentosAluguel);
    if (isOficialDeploy()) return chunks;
    push(loc?.lancamentosAluguel);
    push(loc?.lancamentos);
    const global = readGlobalRowsForLoc(loc);
    if (global.length) chunks.push(global);
    const legado = parseValorRaw(loc?.totalPagoAno2025 ?? "0");
    if (legado > 0 && !chunks.length) {
      const n = normalizeRow({
        data: String(loc?.ultimoLancamentoAluguelData || "").trim() || "01/01/2025",
        valor: legado,
        createdAt: Number(loc?.createdAt || loc?.id || 0) || Date.now(),
        registradoPorNome: "Legado (migração)",
      });
      if (n) chunks.push([n]);
    }
    return chunks;
  }

  function mergeRows(chunks) {
    if (typeof window.__DK_mergePortalLancamentosAluguelEmbutidos === "function") {
      const merged = window.__DK_mergePortalLancamentosAluguelEmbutidos(chunks);
      return (merged || []).map(normalizeRow).filter(Boolean);
    }
    const byProto = new Map();
    const byLegacy = new Map();
    for (const arr of chunks || []) {
      if (!Array.isArray(arr)) continue;
      for (const raw of arr) {
        const row = normalizeRow(raw);
        if (!row) continue;
        const proto = String(row.protocoloLancamento || "").trim();
        if (isProtocoloLancamentoValid(proto)) {
          if (!byProto.has(proto)) byProto.set(proto, row);
          continue;
        }
        const generated = gerarProtocoloLancamento(
          row.registradoPorCpf || row.comprovanteValidadoPorCpf,
          new Date(row.createdAt || Date.now())
        );
        if (generated && isProtocoloLancamentoValid(generated)) {
          row.protocoloLancamento = generated;
          if (!byProto.has(generated)) byProto.set(generated, row);
          continue;
        }
        if (isOficialDeploy() && !isClienteAppContext()) continue;
        const legacyKey = `${row.data}|${Number(row.valor).toFixed(2)}|${row.createdAt}|${row.registradoPorCpf}`;
        if (!byLegacy.has(legacyKey)) byLegacy.set(legacyKey, row);
      }
    }
    const out = [...byProto.values(), ...byLegacy.values()];
    out.sort((a, b) => Number(a.createdAt || 0) - Number(b.createdAt || 0));
    return out;
  }

  function ensureUniqueProtocols(rows) {
    const seen = new Set();
    return (rows || [])
      .map((raw) => {
        const row = normalizeRow(raw);
        if (!row) return null;
        let proto = String(row.protocoloLancamento || "").trim();
        if (!isProtocoloLancamentoValid(proto)) {
          proto = gerarProtocoloLancamento(
            row.registradoPorCpf || row.comprovanteValidadoPorCpf,
            new Date(row.createdAt || Date.now())
          );
        }
        let attempt = 0;
        while (proto && seen.has(proto) && attempt < 5) {
          attempt += 1;
          proto = gerarProtocoloLancamento(
            row.registradoPorCpf || row.comprovanteValidadoPorCpf,
            new Date((row.createdAt || Date.now()) + attempt)
          );
        }
        if (proto) {
          row.protocoloLancamento = proto;
          seen.add(proto);
        }
        if (isOficialDeploy() && !isClienteAppContext() && !isLancamentoOficialAceite(row)) return null;
        return row;
      })
      .filter(Boolean);
  }

  function consolidarLancamentosAluguelLoc(loc, opts) {
    if (!loc || typeof loc !== "object") return [];
    const mutate = Boolean(opts && opts.mutate);
    const merged = filtrarPortalLancamentosPorRemovidos(
      ensureUniqueProtocols(mergeRows(collectLegacySources(loc))),
      loc.portalLancamentosAluguelRemovidos
    );
    if (mutate) {
      loc.portalLancamentosAluguel = merged.map((x) => ({ ...x }));
      if (Object.prototype.hasOwnProperty.call(loc, "lancamentosAluguel")) delete loc.lancamentosAluguel;
      if (Object.prototype.hasOwnProperty.call(loc, "lancamentos")) delete loc.lancamentos;
      if (isOficialDeploy()) {
        loc.totalPagoAno2025 = merged.length
          ? String(
              merged.reduce((a, x) => a + Number(x.valor || 0), 0).toLocaleString("pt-BR", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })
            )
          : "0,00";
      }
      syncResumoPagamentosNaLocacao(loc);
    }
    return merged;
  }

  function getLancamentosAluguelCanonico(loc) {
    if (isClienteAppContext()) {
      const embedded = Array.isArray(loc?.portalLancamentosAluguel) ? loc.portalLancamentosAluguel : [];
      return filtrarPortalLancamentosPorRemovidos(embedded.map(normalizeRow).filter(Boolean), loc?.portalLancamentosAluguelRemovidos);
    }
    if (isOficialDeploy()) {
      return consolidarLancamentosAluguelLoc(loc, { mutate: false });
    }
    const embedded = Array.isArray(loc?.portalLancamentosAluguel) ? loc.portalLancamentosAluguel : [];
    const hasLegacy =
      (Array.isArray(loc?.lancamentosAluguel) && loc.lancamentosAluguel.length) ||
      (Array.isArray(loc?.lancamentos) && loc.lancamentos.length) ||
      readGlobalRowsForLoc(loc).length > 0;
    if (hasLegacy || embedded.some((x) => !isProtocoloLancamentoValid(x?.protocoloLancamento))) {
      return consolidarLancamentosAluguelLoc(loc, { mutate: false });
    }
    return filtrarPortalLancamentosPorRemovidos(embedded.map(normalizeRow).filter(Boolean), loc?.portalLancamentosAluguelRemovidos);
  }

  function purgeGlobalLancamentoKeysOficial() {
    if (!isOficialDeploy()) return { purged: false };
    clearGlobalLancamentosStorageCache();
    let n = 0;
    for (const key of GLOBAL_KEYS) {
      try {
        if (localStorage.getItem(key)) {
          localStorage.removeItem(key);
          n += 1;
        }
      } catch {
        /* ignore */
      }
    }
    return { purged: true, keys: n };
  }

  function sanitizeCloudPayloadLancamentosOficial(payload) {
    if (!isOficialDeploy() || !payload || typeof payload !== "object") return payload;
    const out = { ...payload };
    for (const key of GLOBAL_KEYS) {
      out[key] = [];
    }
    if (Array.isArray(out.dk_locacoes_cadastro)) {
      out.dk_locacoes_cadastro = out.dk_locacoes_cadastro.map((loc) => {
        if (!loc || typeof loc !== "object") return loc;
        const clone = { ...loc };
        consolidarLancamentosAluguelLoc(clone, { mutate: true });
        return clone;
      });
    }
    out.dk_oficial_lancamentos_strict_v1 = true;
    return out;
  }

  function formatHoraMs(ms) {
    if (typeof ms !== "number" || !Number.isFinite(ms) || ms <= 0) return "—";
    try {
      return new Date(ms).toLocaleString("pt-BR");
    } catch {
      return "—";
    }
  }

  function escapeHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function renderHistoricoLancamentosHtml(lancs, opts) {
    const owner = Boolean(opts && opts.adminActions);
    const arr = (lancs || []).slice().sort((a, b) => {
      const ta = Number(a.createdAt || 0);
      const tb = Number(b.createdAt || 0);
      return tb - ta;
    });
    if (!arr.length) {
      return '<p class="subtext">Nenhum lançamento registado neste protocolo.</p>';
    }
    const esc = escapeHtml;
    const thead = owner
      ? `<thead><tr><th>Protocolo</th><th>Tipo</th><th>Data</th><th>Valor</th><th>Registado por</th><th>Instante</th><th>Ações</th></tr></thead>`
      : `<thead><tr><th>Protocolo</th><th>Tipo</th><th>Data</th><th>Valor</th><th>Registado por</th><th>Instante</th></tr></thead>`;
    const fmtBrl =
      typeof window.currencyBRL === "function"
        ? (n) => window.currencyBRL(Number(n || 0))
        : (n) => Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    const rows = arr
      .map((x) => {
        const protoGerado =
          String(x.protocoloLancamento || "").trim() ||
          gerarProtocoloLancamento(x.registradoPorCpf || x.registradoPor, x.createdAt);
        const proto = esc(protoGerado || "—");
        const protoAttr = esc(protoGerado || "");
        const quem = esc(x.registradoPorNome || x.registradoPorCpf || "—");
        const fict = x.ficticio ? ' <span class="portal-lanc-ficticio-tag">(teste)</span>' : "";
        const ehDev = lancamentoEhDevolucaoInvestimento(x);
        const tipoHtml = ehDev
          ? `<td><span class="portal-lanc-hist__tipo portal-lanc-hist__tipo--devolucao">Devolução invest.</span></td>`
          : `<td>Pagamento</td>`;
        const coment = String(x.comentarioPagamento || x.comentario || "").trim();
        const valorClass =
          (ehDev ? " portal-lanc-hist__valor--devolucao" : "") + (coment ? " portal-lanc-hist__valor--comentario" : "");
        const valorHtml = coment
          ? `<td class="portal-lanc-hist__valor${valorClass}" title="${esc(coment)}">${esc(fmtBrl(x.valor))}${fict}<span class="portal-lanc-hist__comentario">${esc(coment)}</span></td>`
          : `<td class="portal-lanc-hist__valor${valorClass}">${esc(fmtBrl(x.valor))}${fict}</td>`;
        const actions = owner
          ? `<td class="portal-lanc-hist__actions"><button type="button" class="btn-primary btn-secondary-outline" data-lanc-aluguel-edit="${protoAttr}">Editar</button> <button type="button" class="btn-primary btn-secondary-outline" data-lanc-aluguel-del="${protoAttr}">Apagar</button></td>`
          : "";
        return `<tr${x.ficticio ? ' class="portal-registro-teste"' : ""}><td>${proto}</td>${tipoHtml}<td>${esc(x.data)}</td>${valorHtml}<td>${quem}</td><td>${esc(formatHoraMs(x.createdAt))}</td>${actions}</tr>`;
      })
      .join("");
    return `<p class="subtext"><strong>Lançamentos registados (${arr.length})</strong></p><table class="portal-lanc-hist">${thead}<tbody>${rows}</tbody></table>`;
  }

  window.__DK_clearGlobalLancamentosStorageCache = clearGlobalLancamentosStorageCache;
  window.__DK_gerarProtocoloLancamento = gerarProtocoloLancamento;
  window.__DK_isProtocoloLancamentoValid = isProtocoloLancamentoValid;
  window.__DK_isOficialLancamentosStrict = isOficialDeploy;
  window.__DK_isLancamentoOficialAceite = isLancamentoOficialAceite;
  window.__DK_ensureProtocoloLancamento = (entry, cpfFallback) => {
    const row = normalizeRow(entry);
    if (!row) return entry;
    if (!isProtocoloLancamentoValid(row.protocoloLancamento)) {
      const proto = gerarProtocoloLancamento(row.registradoPorCpf || cpfFallback, new Date(row.createdAt || Date.now()));
      if (proto) row.protocoloLancamento = proto;
    }
    return row;
  };
  window.__DK_consolidarLancamentosAluguelLoc = consolidarLancamentosAluguelLoc;
  window.__DK_getLancamentosAluguelCanonico = getLancamentosAluguelCanonico;
  window.__DK_renderHistoricoLancamentosHtml = renderHistoricoLancamentosHtml;
  window.__DK_mergePortalLancamentosRemovidos = mergePortalLancamentosRemovidos;
  window.__DK_filtrarPortalLancamentosPorRemovidos = filtrarPortalLancamentosPorRemovidos;
  window.__DK_anexarLancamentosMergeNaLocacao = anexarLancamentosMergeNaLocacao;
  window.__DK_syncResumoPagamentosNaLocacao = syncResumoPagamentosNaLocacao;
  window.__DK_mergePagamentosAuditoria = mergePagamentosAuditoria;
  window.__DK_purgeGlobalLancamentoKeysOficial = purgeGlobalLancamentoKeysOficial;
  window.__DK_sanitizeCloudPayloadLancamentosOficial = sanitizeCloudPayloadLancamentosOficial;

  if (isOficialDeploy()) {
    const runPurge = () => purgeGlobalLancamentoKeysOficial();
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", runPurge);
    } else {
      runPurge();
    }
  }
})();
