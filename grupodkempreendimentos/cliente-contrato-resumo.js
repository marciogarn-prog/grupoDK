/**
 * Resumo de contrato para o App Cliente (alinhado à lógica do portal DK).
 */
(function clienteContratoResumo() {
  function parseCur(v) {
    if (typeof window.parseCurrencyBR === "function") {
      return Number(window.parseCurrencyBR(String(v ?? "")));
    }
    const cleaned = String(v ?? "")
      .replace(/[R$\s]/g, "")
      .replace(/\./g, "")
      .replace(",", ".");
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : 0;
  }

  function parseBrDate(s) {
    if (typeof window.parseBrDate === "function") return window.parseBrDate(s);
    const raw = String(s || "").trim();
    if (!raw || !raw.includes("/")) return null;
    const [day, month, year] = raw.split("/").map(Number);
    if (!day || !month || !year) return null;
    return new Date(year, month - 1, day);
  }

  function currencyBRL(n) {
    if (typeof window.currencyBRL === "function") return window.currencyBRL(n);
    return Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }

  function normNc(nc) {
    return String(nc || "")
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "");
  }

  function onlyDigits(s) {
    return String(s ?? "").replace(/\D/g, "");
  }

  function normPlate(p) {
    return String(p || "")
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "");
  }

  const LANCAMENTO_GLOBAL_KEYS = [
    "dk_lancamentos_aluguel",
    "dk_lancamento_aluguel",
    "dk_lancamentos_aluguel_cadastro",
    "dk_lancamento_aluguel_cadastro",
  ];

  function normalizeLancamentoEntry(x) {
    if (!x || typeof x !== "object") return null;
    if (x.pagamentoInvalidado) return null;
    const oid = String(x.origemComprovanteClienteId || "").trim();
    if (oid && comprovanteInvalidadoPorId(oid)) return null;
    const data = String(x.data || x.dataPagamento || x.semanaInicio || "").trim();
    if (!data) return null;
    const MEIOS = ["valorEspecie", "valorPix", "valorCartao"];
    const hasMeios = MEIOS.some((k) => Object.prototype.hasOwnProperty.call(x, k));
    let valor;
    if (hasMeios) {
      const ve = parseCur(x.valorEspecie ?? 0);
      const vp = parseCur(x.valorPix ?? 0);
      const vc = parseCur(x.valorCartao ?? 0);
      valor = ve + vp + vc;
    } else {
      valor =
        typeof x.valor === "number" && Number.isFinite(x.valor) && x.valor > 0
          ? x.valor
          : parseCur(x.valor ?? x.valorPago ?? 0);
    }
    if (!Number.isFinite(valor) || valor <= 0) return null;
    return {
      data,
      valor,
      createdAt: Number(x.createdAt || x.id || 0),
      confirmadoViaAppCliente: Boolean(x.confirmadoViaAppCliente),
      origemComprovanteClienteId: oid,
      comprovanteFp: String(x.comprovanteFp || "").trim(),
      registradoPorNome: String(x.registradoPorNome || "").trim(),
      origem: "DK",
    };
  }

  function mergeLancamentosEmbutidos(arrays) {
    if (typeof window.__DK_mergePortalLancamentosAluguelEmbutidos === "function") {
      return window.__DK_mergePortalLancamentosAluguelEmbutidos(arrays);
    }
    const byKey = new Map();
    for (const arr of arrays || []) {
      if (!Array.isArray(arr)) continue;
      for (const raw of arr) {
        const row = normalizeLancamentoEntry(raw);
        if (!row) continue;
        const key = `${row.data}|${Number(row.valor).toFixed(2)}|${row.createdAt}|${row.origemComprovanteClienteId}`;
        if (!byKey.has(key)) byKey.set(key, row);
      }
    }
    return Array.from(byKey.values());
  }

  function readGlobalLancamentosAluguel(loc) {
    const cpf = onlyDigits(loc?.cpf).slice(0, 11);
    const nc = normNc(loc?.numeroContrato);
    const placa = normPlate(loc?.placa);
    if (cpf.length !== 11 || !nc || !placa) return [];
    const out = [];
    for (const key of LANCAMENTO_GLOBAL_KEYS) {
      try {
        const raw = localStorage.getItem(key);
        const global = raw ? JSON.parse(raw) : [];
        if (!Array.isArray(global)) continue;
        global.forEach((item) => {
          if (!item || typeof item !== "object") return;
          if (onlyDigits(item.cpf).slice(0, 11) !== cpf) return;
          if (normNc(item.numeroContrato) !== nc) return;
          if (normPlate(item.placa) !== placa) return;
          const row = normalizeLancamentoEntry({
            ...item,
            data: item.data || item.dataPagamento || item.semanaInicio,
            valor: item.valor,
            valorPago: item.valorPago,
          });
          if (row) out.push(row);
        });
      } catch {
        /* ignore */
      }
    }
    return out;
  }

  function mergeLocacaoParCliente(ex, incoming) {
    const mergedPl = mergeLancamentosEmbutidos([
      ex?.portalLancamentosAluguel,
      incoming?.portalLancamentosAluguel,
    ]);
    const score = (x) => Number(x?.updatedAt || x?.createdAt || x?.id || 0);
    const merged = {
      ...ex,
      ...incoming,
      numeroContrato: ex?.numeroContrato || incoming?.numeroContrato,
    };
    if (mergedPl.length) merged.portalLancamentosAluguel = mergedPl;
    if (score(incoming) >= score(ex)) return merged;
    const stay = { ...ex, ...merged };
    if (mergedPl.length) stay.portalLancamentosAluguel = mergedPl;
    return stay;
  }

  function mergeLocacoesCadastroCliente(localArr, cloudArr) {
    const byNc = new Map();
    const noNc = [];
    const add = (loc) => {
      if (!loc || typeof loc !== "object") return;
      const nc = normNc(loc.numeroContrato);
      if (!nc) {
        noNc.push({ ...loc });
        return;
      }
      const prev = byNc.get(nc);
      byNc.set(nc, prev ? mergeLocacaoParCliente(prev, loc) : { ...loc, numeroContrato: loc.numeroContrato || nc });
    };
    (Array.isArray(localArr) ? localArr : []).forEach(add);
    (Array.isArray(cloudArr) ? cloudArr : []).forEach(add);
    return [...byNc.values(), ...noNc];
  }

  function comprovanteInvalidadoPorId(id) {
    const cid = String(id || "").trim();
    if (!cid) return false;
    try {
      const raw = localStorage.getItem("dk_comprovantes_cliente_pendentes");
      const all = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(all)) return false;
      const hit = all.find((r) => String(r.id || "").trim() === cid);
      return Boolean(hit?.pagamentoInvalidado);
    } catch {
      return false;
    }
  }

  function computeTempoDiasLoc(loc) {
    const rawInicio = String(loc?.inicio || "").trim();
    if (!rawInicio) return 0;
    const inicio = parseBrDate(rawInicio);
    if (!inicio || Number.isNaN(inicio.getTime())) return 0;
    const rawFim = String(loc?.fim || "").trim();
    if (rawFim) {
      const fim = parseBrDate(rawFim);
      if (fim && !Number.isNaN(fim.getTime())) {
        const t0 = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate()).getTime();
        const t1 = new Date(fim.getFullYear(), fim.getMonth(), fim.getDate()).getTime();
        return Math.max(1, Math.round((t1 - t0) / 86400000));
      }
    }
    const start = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate());
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return Math.max(0, Math.round((today.getTime() - start.getTime()) / 86400000));
  }

  function formatTempoSemanasDias(totalDias) {
    const d = Math.max(0, Math.floor(Number(totalDias) || 0));
    const semanas = Math.floor(d / 7);
    const dias = d % 7;
    if (semanas > 0 && dias > 0) return `${semanas} semana${semanas !== 1 ? "s" : ""} e ${dias} dia${dias !== 1 ? "s" : ""}`;
    if (semanas > 0) return `${semanas} semana${semanas !== 1 ? "s" : ""}`;
    return `${dias} dia${dias !== 1 ? "s" : ""}`;
  }

  function parsePeriodoDias(periodoLocacao) {
    const m = String(periodoLocacao || "").match(/(\d+)/);
    return m ? Number(m[1]) : 0;
  }

  /** Evita duas linhas iguais (mesma data + valor) vindas de portal + legado + global. */
  function dedupeLancamentosPagamento(rows) {
    const sorted = [...(rows || [])].sort((a, b) => {
      if (a.confirmadoViaAppCliente && !b.confirmadoViaAppCliente) return -1;
      if (!a.confirmadoViaAppCliente && b.confirmadoViaAppCliente) return 1;
      if (a.registradoPorNome && !b.registradoPorNome) return -1;
      if (!a.registradoPorNome && b.registradoPorNome) return 1;
      return Number(b.createdAt || 0) - Number(a.createdAt || 0);
    });
    const seenOid = new Set();
    const seenFp = new Set();
    const seenDataValor = new Set();
    const out = [];
    for (const row of sorted) {
      if (row.pagamentoInvalidado) continue;
      const oid = String(row.origemComprovanteClienteId || "").trim();
      if (oid && comprovanteInvalidadoPorId(oid)) continue;
      const fp = String(row.comprovanteFp || "").trim();
      const data = String(row.data || "").trim();
      const valor = Number(row.valor);
      const dvKey = `${data}|${Number.isFinite(valor) ? valor.toFixed(2) : ""}`;
      if (oid && seenOid.has(oid)) continue;
      if (fp && seenFp.has(fp)) continue;
      if (data && Number.isFinite(valor) && valor > 0 && seenDataValor.has(dvKey)) continue;
      if (oid) seenOid.add(oid);
      if (fp) seenFp.add(fp);
      if (data && Number.isFinite(valor) && valor > 0) seenDataValor.add(dvKey);
      out.push(row);
    }
    out.sort((a, b) => {
      const da = parseBrDate(a.data)?.getTime() || 0;
      const db = parseBrDate(b.data)?.getTime() || 0;
      return db - da;
    });
    return out;
  }

  function getLancamentosAluguelContrato(loc) {
    if (typeof window.__DK_getLancamentosAluguelCanonico === "function") {
      const rows = window.__DK_getLancamentosAluguelCanonico(loc);
      return dedupeLancamentosPagamento(rows);
    }
    if (!loc || typeof loc !== "object") return [];
    const chunks = [];
    const pushChunk = (arr) => {
      const n = (arr || []).map(normalizeLancamentoEntry).filter(Boolean);
      if (n.length) chunks.push(n);
    };
    pushChunk(loc.portalLancamentosAluguel);
    pushChunk(loc.lancamentosAluguel);
    pushChunk(loc.lancamentos);
    const globalRows = readGlobalLancamentosAluguel(loc);
    if (globalRows.length) chunks.push(globalRows);
    const legado = parseCur(loc.totalPagoAno2025 ?? "0");
    if (legado > 0 && chunks.length === 0) {
      chunks.push([
        normalizeLancamentoEntry({
          data: String(loc.ultimoLancamentoAluguelData || "").trim() || "01/01/2025",
          valor: legado,
          createdAt: Number(loc.createdAt || loc.id || 0) || Date.now(),
        }),
      ].filter(Boolean));
    }
    const merged = mergeLancamentosEmbutidos(chunks);
    return dedupeLancamentosPagamento(merged);
  }

  function sumMultasRegistradas(loc) {
    let s = 0;
    const arr = Array.isArray(loc.portalMultasTransito) ? loc.portalMultasTransito : [];
    arr.forEach((m) => {
      const v = parseCur(m?.valorMulta ?? m?.valor ?? 0);
      if (Number.isFinite(v)) s += v;
    });
    if (!s) {
      s = parseCur(
        loc?.valorDevidoMulta ??
          loc?.valorDevidoMultas ??
          loc?.devidoMultas ??
          loc?.gastosMulta ??
          0
      );
    }
    return s;
  }

  function sumManutencao(loc) {
    const arr = Array.isArray(loc.portalManutencoesRegistro) ? loc.portalManutencoesRegistro : [];
    if (arr.length) {
      return arr.reduce((a, m) => a + parseCur(m?.valorManutencao ?? m?.valor ?? 0), 0);
    }
    return parseCur(
      loc?.valorDevidoManutencao ?? loc?.gastosManutencao ?? loc?.gastoManutencao ?? loc?.custoManutencao ?? 0
    );
  }

  function normPlanoKey(s) {
    return String(s || "")
      .trim()
      .toUpperCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }

  function inferTipoVeiculoLocacao(loc) {
    const mod = normPlanoKey(loc?.modalidade || "");
    if (mod.includes("CARRO")) return "CARRO";
    if (mod.includes("MOTO")) return "MOTO";
    const placa = String(loc?.placa || "")
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "");
    if (!placa) return "MOTO";
    try {
      const raw = localStorage.getItem("dk_veiculos_cadastro");
      const veiculos = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(veiculos)) return "MOTO";
      const v = veiculos.find(
        (row) =>
          String(row?.placa || "")
            .trim()
            .toUpperCase()
            .replace(/[^A-Z0-9]/g, "") === placa
      );
      if (!v) return "MOTO";
      const tipo = normPlanoKey(v.tipo || "");
      const tag = normPlanoKey(v.tag || "");
      if (tipo.includes("CARRO") || tag.includes("DKCR")) return "CARRO";
      if (tipo.includes("MOTO") || tag.includes("DKMT")) return "MOTO";
      return tipo.includes("CARRO") ? "CARRO" : "MOTO";
    } catch {
      return "MOTO";
    }
  }

  function inferPlanoContrato(loc) {
    const planoKey = normPlanoKey(loc?.plano || loc?.opcaoContrato || "");
    if (planoKey.includes("MINHA") && planoKey.includes("MOTO")) return "MINHA_MOTO";
    if (planoKey.includes("MEU") && planoKey.includes("TRANSPORTE")) return "MEU_TRANSPORTE";
    const valInv = parseCur(loc?.valorInvestimento ?? 0);
    if (valInv > 0) return "MINHA_MOTO";
    return "MEU_TRANSPORTE";
  }

  /** Badge «Ativo»/«Inativo» — cor por plano (moto) ou carro; inativo = vermelho. */
  function computeBadgeContrato(loc, ativo) {
    if (!ativo) return { text: "Inativo", variant: "inativo" };
    if (inferTipoVeiculoLocacao(loc) === "CARRO") return { text: "Ativo", variant: "carro" };
    const plano = inferPlanoContrato(loc);
    if (plano === "MINHA_MOTO") return { text: "Ativo", variant: "minha-moto" };
    return { text: "Ativo", variant: "meu-transporte" };
  }

  function lookupModeloVeiculo(loc) {
    const direct = String(loc?.marcaModelo || loc?.modelo || "").trim();
    if (direct) return direct;
    const placa = String(loc?.placa || "")
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "");
    if (!placa) return "—";
    try {
      const raw = localStorage.getItem("dk_veiculos_cadastro");
      const veiculos = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(veiculos)) return "—";
      const v = veiculos.find(
        (row) =>
          String(row?.placa || "")
            .trim()
            .toUpperCase()
            .replace(/[^A-Z0-9]/g, "") === placa
      );
      if (!v) return "—";
      const modelo = String(v.modelo || "").trim();
      const marca = String(v.marca || "").trim();
      if (modelo && marca && !modelo.toUpperCase().includes(marca.toUpperCase())) {
        return `${marca} ${modelo}`.trim();
      }
      return modelo || marca || "—";
    } catch {
      return "—";
    }
  }

  function computeInvestimentoAcumuladoNum(loc, lancs, tempoDias, valLoc) {
    const valorDevidoAluguelNum = tempoDias * (valLoc / 7);
    const valorDevidoManutencaoNum = sumManutencao(loc);
    const multasRegistradasNum = sumMultasRegistradas(loc);
    const totalPagoNum = lancs.reduce((a, x) => a + Number(x.valor || 0), 0);
    return (
      totalPagoNum - (valorDevidoAluguelNum + multasRegistradasNum + valorDevidoManutencaoNum)
    );
  }

  function diaPagamentoColIdx(raw, loc) {
    const s = String(raw || "")
      .trim()
      .toUpperCase()
      .normalize("NFD")
      .replace(/\p{M}/gu, "");
    if (s.startsWith("DOM")) return 0;
    const map = { SEG: 1, TER: 2, QUA: 3, QUI: 4, SEX: 5, SAB: 6, DOM: 0 };
    const token = s.slice(0, 3);
    if (Object.prototype.hasOwnProperty.call(map, token)) return map[token];
    const inicio = String(loc?.inicio || "").trim();
    if (inicio) {
      const d = parseBrDate(inicio);
      if (d && !Number.isNaN(d.getTime())) return d.getDay();
    }
    return 3;
  }

  function diaPagamentoLegivel(colIdx) {
    const labels = [
      "Domingo",
      "Segunda-feira",
      "Terça-feira",
      "Quarta-feira",
      "Quinta-feira",
      "Sexta-feira",
      "Sábado",
    ];
    return labels[Number(colIdx)] || "Quarta-feira";
  }

  function buildCalendarioCtxContrato(loc) {
    const diaRaw = String(loc?.diaPagto || loc?.diaPagamento || "").trim();
    const diaPagamentoCol = diaPagamentoColIdx(diaRaw, loc);
    return {
      proto: normNc(loc.numeroContrato),
      placa: String(loc.placa || "").trim(),
      lancamentos: getLancamentosAluguelContrato(loc),
      diaPagamentoCol,
      diaPagamentoLabel: diaPagamentoLegivel(diaPagamentoCol),
    };
  }

  function pickUltimoPagamento(lancs) {
    if (!lancs?.length) return null;
    const p = lancs[0];
    let lancadoPor = "DK Locadora";
    if (p.confirmadoViaAppCliente) lancadoPor = "Cliente (app)";
    else if (p.registradoPorNome) lancadoPor = String(p.registradoPorNome).trim();
    return {
      data: String(p.data || "").trim() || "—",
      valor: currencyBRL(p.valor),
      lancadoPor,
    };
  }

  function computeResumoContrato(loc) {
    const valLoc = parseCur(loc?.valorLocacao ?? 0);
    const valInv = parseCur(loc?.valorInvestimento ?? 0);
    const plano = valLoc + valInv;
    const tempoDias = computeTempoDiasLoc(loc);
    const valorDevidoPlanoNum = tempoDias * (plano / 7);
    const valorDevidoAluguelNum = tempoDias * (valLoc / 7);
    const valorDevidoManutencaoNum = sumManutencao(loc);
    const multasRegistradasNum = sumMultasRegistradas(loc);
    const lancs = getLancamentosAluguelContrato(loc);
    const totalPagoNum = lancs.reduce((a, x) => a + Number(x.valor || 0), 0);
    const valorDevidoConsolidado =
      valorDevidoAluguelNum + valorDevidoManutencaoNum + multasRegistradasNum - totalPagoNum;

    const periodoDias = parsePeriodoDias(loc.periodoLocacao);
    let tempoRestanteTexto = "Em breve";
    if (periodoDias > 0) {
      const restante = Math.max(0, periodoDias - tempoDias);
      tempoRestanteTexto = formatTempoSemanasDias(restante);
    } else if (String(loc?.fim || "").trim()) {
      const fim = parseBrDate(loc.fim);
      const hoje = new Date();
      const today = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
      if (fim && !Number.isNaN(fim.getTime())) {
        const t1 = new Date(fim.getFullYear(), fim.getMonth(), fim.getDate()).getTime();
        const restante = Math.max(0, Math.round((t1 - today.getTime()) / 86400000));
        tempoRestanteTexto = formatTempoSemanasDias(restante);
      }
    }

    const revisaoData = String(loc?.ultimaRevisaoData ?? loc?.dataUltimaRevisao ?? "").trim();
    const revisaoKm = String(loc?.ultimaRevisaoKm ?? loc?.kmUltimaRevisao ?? "").trim();
    const revisaoServicos = loc?.ultimaRevisaoServicos ?? loc?.servicosUltimaRevisao;

    const ativo = (() => {
      const fim = String(loc?.fim || loc?.dataFim || "").trim();
      return !fim || fim === "...";
    })();

    const planoTipo = inferPlanoContrato(loc);
    const investimentoAcumuladoNum = computeInvestimentoAcumuladoNum(loc, lancs, tempoDias, valLoc);

    return {
      protocolo: normNc(loc.numeroContrato),
      placa: String(loc.placa || "").trim(),
      modeloVeiculo: lookupModeloVeiculo(loc),
      valorSemanal: currencyBRL(valLoc + valInv),
      plano: planoTipo,
      investimentoAcumulado: currencyBRL(investimentoAcumuladoNum),
      ultimoPagamento: pickUltimoPagamento(lancs),
      inicio: String(loc.inicio || "").trim(),
      fim: String(loc.fim || "").trim(),
      tempoLocacaoTexto: formatTempoSemanasDias(tempoDias),
      valorDevidoTexto: currencyBRL(Math.max(0, valorDevidoConsolidado)),
      valorDevidoAluguel: currencyBRL(valorDevidoAluguelNum),
      totalPago: currencyBRL(totalPagoNum),
      gastoManutencao: currencyBRL(valorDevidoManutencaoNum),
      multasRegistradas: currencyBRL(multasRegistradasNum),
      multasPagasValidadas: "Em breve",
      tempoRestantePlano: tempoRestanteTexto,
      ultimaRevisaoData: revisaoData || "Em breve",
      ultimaRevisaoKm: revisaoKm || "Em breve",
      ultimaRevisaoServicos: Array.isArray(revisaoServicos) && revisaoServicos.length
        ? revisaoServicos.map(String)
        : null,
      lancamentos: lancs,
      ativo,
      badge: computeBadgeContrato(loc, ativo),
    };
  }

  window.__DK_clienteComputeResumoContrato = computeResumoContrato;
  window.__DK_dedupeLancamentosPagamento = dedupeLancamentosPagamento;
  window.__DK_clienteBuildCalendarioCtx = buildCalendarioCtxContrato;
  window.__DK_clienteGetLancamentosAluguelContrato = getLancamentosAluguelContrato;
  window.__DK_mergeLocacoesCadastroCliente = mergeLocacoesCadastroCliente;
})();
