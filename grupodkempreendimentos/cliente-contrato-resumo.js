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

  function getLancamentosAluguelContrato(loc) {
    const out = [];
    const push = (arr, origem) => {
      if (!Array.isArray(arr)) return;
      arr.forEach((x) => {
        if (!x || typeof x !== "object") return;
        const data = String(x.data || x.dataPagamento || "").trim();
        let valor = typeof x.valor === "number" ? x.valor : parseCur(x.valor ?? x.valorPago);
        if (!Number.isFinite(valor) || valor <= 0) return;
        out.push({
          data,
          valor,
          origem,
          confirmadoViaAppCliente: Boolean(x.confirmadoViaAppCliente),
          origemComprovanteClienteId: String(x.origemComprovanteClienteId || "").trim(),
          registradoPorNome: String(x.registradoPorNome || "").trim(),
        });
      });
    };
    push(loc.portalLancamentosAluguel, "DK");
    push(loc.lancamentosAluguel, "DK");
    push(loc.lancamentos, "DK");
    try {
      const raw = localStorage.getItem("dk_lancamentos_aluguel");
      const global = raw ? JSON.parse(raw) : [];
      if (Array.isArray(global)) {
        const cpf = String(loc.cpf || "").replace(/\D/g, "");
        const nc = normNc(loc.numeroContrato);
        const placa = String(loc.placa || "")
          .trim()
          .toUpperCase()
          .replace(/[^A-Z0-9]/g, "");
        global.forEach((item) => {
          if (!item || typeof item !== "object") return;
          if (String(item.cpf || "").replace(/\D/g, "") !== cpf) return;
          const ncIt = normNc(item.numeroContrato);
          const plIt = String(item.placa || "")
            .trim()
            .toUpperCase()
            .replace(/[^A-Z0-9]/g, "");
          if (ncIt !== nc && plIt !== placa) return;
          const data = String(item.dataPagamento || item.semanaInicio || "").trim();
          const valor = parseCur(item.valorPago ?? item.valor ?? 0);
          if (!data || valor <= 0) return;
          out.push({
            data,
            valor,
            origem: "DK",
            confirmadoViaAppCliente: false,
            registradoPorNome: String(item.registradoPorNome || "").trim(),
          });
        });
      }
    } catch {
      /* ignore */
    }
    return out;
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

    return {
      protocolo: normNc(loc.numeroContrato),
      placa: String(loc.placa || "").trim(),
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
      ativo: (() => {
        const st = String(loc?.statusLocacao || loc?.status || "")
          .trim()
          .toUpperCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "");
        if (st === "FINALIZADO" || st === "INATIVO") return false;
        return !String(loc?.fim || "").trim();
      })(),
    };
  }

  window.__DK_clienteComputeResumoContrato = computeResumoContrato;
})();
