/**
 * Ciclo semanal de aluguel (contratos com início >= 01/10/2026).
 *
 * - Semana com desconto: paga (aluguel) = (aluguel - desconto) + investimento
 *   diária só aluguel = (aluguel - desconto) / 7
 * - Semana sem desconto: paga aluguel + investimento
 *   diária só aluguel = aluguel / 7
 * - Desbloqueio do desconto na semana W: pagamentos até o dia de início da semana W
 *   devem atingir a soma das cobranças das semanas anteriores + valor com desconto.
 * - Devolução = total pago de aluguel − devido só de aluguel.
 */
(function dkAluguelCicloV2() {
  const INICIO_REGRA_YMD = "2026-10-01";

  function parseBr(raw) {
    if (typeof parseBrDate === "function") {
      const d = parseBrDate(String(raw || "").trim());
      if (d && !Number.isNaN(d.getTime())) return new Date(d.getFullYear(), d.getMonth(), d.getDate());
    }
    const s = String(raw || "").trim();
    const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s);
    if (!m) return null;
    const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
    return Number.isNaN(d.getTime()) ? null : d;
  }

  function toYmd(d) {
    if (!(d instanceof Date) || Number.isNaN(d.getTime())) return "";
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  function parseMoney(v) {
    if (typeof parseCurrencyBR === "function") {
      const n = Number(parseCurrencyBR(String(v ?? "")));
      return Number.isFinite(n) ? n : 0;
    }
    const cleaned = String(v ?? "")
      .replace(/[R$\s]/g, "")
      .replace(/\./g, "")
      .replace(",", ".");
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : 0;
  }

  function addDays(d, n) {
    const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    x.setDate(x.getDate() + (Number(n) || 0));
    return x;
  }

  function daysBetween(a, b) {
    const t0 = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
    const t1 = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
    return Math.round((t1 - t0) / 86400000);
  }

  function locAplicaRegraV2(loc) {
    const inicio = parseBr(loc?.inicio || loc?.dataInicio);
    if (!inicio) return false;
    return toYmd(inicio) >= INICIO_REGRA_YMD;
  }

  function paramsFromLoc(loc) {
    const aluguel = Math.max(
      0,
      typeof window.__DK_portalValorAluguelNumFromLoc === "function"
        ? Number(window.__DK_portalValorAluguelNumFromLoc(loc)) || 0
        : parseMoney(loc?.valorLocacao ?? loc?.valorAluguel ?? 0)
    );
    const investimento = Math.max(0, parseMoney(loc?.valorInvestimento ?? loc?.investimento ?? 0));
    let desconto = 30;
    if (loc?.descontoPrazo != null && String(loc.descontoPrazo).trim() !== "") {
      desconto = Math.max(0, parseMoney(loc.descontoPrazo));
    }
    const comDesconto = Math.max(0, aluguel); // paga 360 quando tem desconto (aluguel cadastrado)
    const aluguelNaSemanaComDesc = Math.max(0, aluguel - desconto); // 330
    const contratoCheio = aluguel + investimento; // 390
    return {
      aluguel,
      investimento,
      desconto,
      comDesconto,
      aluguelNaSemanaComDesc,
      contratoCheio,
      diariaAluguelComDesc: aluguelNaSemanaComDesc / 7,
      diariaAluguelSemDesc: aluguel / 7,
    };
  }

  function collectPagamentos(loc) {
    let lancs = [];
    if (typeof window.__DK_getPortalLancamentosAluguelContabilizaveisDoContrato === "function") {
      lancs = window.__DK_getPortalLancamentosAluguelContabilizaveisDoContrato(loc) || [];
    } else if (Array.isArray(loc?.portalLancamentosAluguel)) {
      lancs = loc.portalLancamentosAluguel;
    }
    return (lancs || [])
      .map((x) => {
        const data = parseBr(x?.data || x?.dataPagamento);
        const valor = parseMoney(x?.valor);
        if (!data || !(valor > 0)) return null;
        const tipo = String(x?.tipoMovimento || x?.tipo || "PAGAMENTO").toUpperCase();
        if (tipo.includes("DEVOLUC") || tipo.includes("CAUCAO") || tipo.includes("CAUÇÃO")) return null;
        if (tipo.includes("CREDITO") || tipo.includes("CRÉDITO")) return null;
        return { data, valor, ymd: toYmd(data) };
      })
      .filter(Boolean)
      .sort((a, b) => a.ymd.localeCompare(b.ymd));
  }

  function pagoAte(pagamentos, deadline) {
    const lim = toYmd(deadline);
    let s = 0;
    for (const p of pagamentos) {
      if (p.ymd <= lim) s += p.valor;
    }
    return s;
  }

  /**
   * Constrói o estado das semanas até weekCount-1 (ou até cobrir refDate).
   */
  function buildSemanas(loc, opts = {}) {
    const inicio = parseBr(loc?.inicio || loc?.dataInicio);
    if (!inicio || !locAplicaRegraV2(loc)) return null;
    const p = paramsFromLoc(loc);
    const pags = collectPagamentos(loc);
    const ref = opts.refDate instanceof Date && !Number.isNaN(opts.refDate.getTime()) ? opts.refDate : new Date();
    const refDay = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
    const maxWeekByRef = Math.max(0, Math.floor(daysBetween(inicio, refDay) / 7) + 1);
    const weekCount = Math.max(1, Number(opts.weekCount) || maxWeekByRef + 2);

    const semanas = [];
    let cobradoAcumulado = 0;
    for (let w = 0; w < weekCount; w++) {
      const start = addDays(inicio, w * 7);
      const endExclusive = addDays(inicio, (w + 1) * 7);
      const deadline = start; // dia da semana do início desta semana
      const unlockTarget = cobradoAcumulado + p.comDesconto;
      const pago = pagoAte(pags, deadline);
      const comDesconto = pago + 0.009 >= unlockTarget;
      const cobrancaSemana = comDesconto ? p.comDesconto : p.contratoCheio;
      const diariaAluguel = comDesconto ? p.diariaAluguelComDesc : p.diariaAluguelSemDesc;
      semanas.push({
        index: w,
        start,
        endExclusive,
        deadline,
        unlockTarget,
        pagoAteDeadline: pago,
        comDesconto,
        cobrancaSemana,
        diariaAluguel,
        aluguelSemanal: comDesconto ? p.aluguelNaSemanaComDesc : p.aluguel,
        investimento: p.investimento,
      });
      cobradoAcumulado += cobrancaSemana;
    }
    return { inicio, params: p, pagamentos: pags, semanas, cobradoAcumulado };
  }

  function semanaIndexParaDia(inicio, day) {
    const diff = daysBetween(inicio, day);
    if (diff < 0) return -1;
    return Math.floor(diff / 7);
  }

  /**
   * Devido só de aluguel do início até refDate (número de diárias = mesma base do portal).
   * opts.dias: se informado, usa essa quantidade de diárias a partir do início.
   */
  function devidoAluguelAte(loc, refDateOrNull, opts = {}) {
    if (!locAplicaRegraV2(loc)) return null;
    const inicio = parseBr(loc?.inicio || loc?.dataInicio);
    if (!inicio) return null;

    let dias = Number(opts.dias);
    if (!Number.isFinite(dias) || dias < 0) {
      if (typeof window.__DK_computePortalDiasAteHoje === "function" && !refDateOrNull) {
        dias = Number(window.__DK_computePortalDiasAteHoje(loc)) || 0;
      } else {
        const ref =
          refDateOrNull instanceof Date && !Number.isNaN(refDateOrNull.getTime())
            ? new Date(refDateOrNull.getFullYear(), refDateOrNull.getMonth(), refDateOrNull.getDate())
            : (() => {
                const fim = parseBr(loc?.fim || loc?.dataFim);
                if (fim) return fim;
                const n = new Date();
                return new Date(n.getFullYear(), n.getMonth(), n.getDate());
              })();
        dias = Math.max(0, daysBetween(inicio, ref));
        // Contratos antigos (sem 24h) contam diferença de datas; com fim no mesmo dia = 0 ou 1?
        // O portal usa max(0, round) sem +1. Mantemos igual.
      }
    }

    const estado = buildSemanas(loc, {
      refDate: addDays(inicio, Math.max(0, Math.ceil(dias))),
      weekCount: Math.floor(Math.max(0, dias) / 7) + 3,
    });
    if (!estado) return null;

    let devido = 0;
    const detalheDias = [];
    const n = Math.max(0, Math.floor(dias));
    for (let i = 0; i < n; i++) {
      const day = addDays(inicio, i);
      const wi = semanaIndexParaDia(inicio, day);
      const sem = estado.semanas[wi] || estado.semanas[estado.semanas.length - 1];
      const taxa = Number(sem?.diariaAluguel) || 0;
      devido += taxa;
      detalheDias.push({
        diaIndex: i,
        data: toYmd(day),
        semana: wi,
        comDesconto: Boolean(sem?.comDesconto),
        diariaAluguel: taxa,
      });
    }

    // Fração de diária (regra 24h) se dias não for inteiro
    const frac = Number(dias) - n;
    if (frac > 0.001) {
      const day = addDays(inicio, n);
      const wi = semanaIndexParaDia(inicio, day);
      const sem = estado.semanas[wi] || estado.semanas[estado.semanas.length - 1];
      devido += (Number(sem?.diariaAluguel) || 0) * frac;
    }

    let totalPago = 0;
    if (typeof window.__DK_getPortalLancamentosAluguelContabilizaveisDoContrato === "function") {
      const lancs = window.__DK_getPortalLancamentosAluguelContabilizaveisDoContrato(loc) || [];
      if (typeof window.__DK_sumPortalLancamentosAluguelTotal === "function") {
        totalPago = Number(window.__DK_sumPortalLancamentosAluguelTotal(lancs)) || 0;
      } else {
        for (const x of lancs) totalPago += parseMoney(x?.valor);
      }
    } else {
      for (const x of estado.pagamentos) totalPago += x.valor;
    }

    return {
      regra: "ciclo-v2",
      dias: Number(dias) || 0,
      devidoAluguel: devido,
      totalPago,
      aDevolver: totalPago - devido,
      params: estado.params,
      semanas: estado.semanas,
      detalheDias,
    };
  }

  /** Sugestão de pagamento/desconto para a data informada (dia do ciclo). */
  function sugestaoPagamentoNaData(loc, dataBr) {
    if (!locAplicaRegraV2(loc)) return null;
    const inicio = parseBr(loc?.inicio || loc?.dataInicio);
    const pag = parseBr(dataBr);
    if (!inicio || !pag) return null;
    const p = paramsFromLoc(loc);
    const wi = Math.max(0, semanaIndexParaDia(inicio, pag));
    const estado = buildSemanas(loc, { refDate: pag, weekCount: wi + 3 });
    if (!estado) return null;
    // Avalia como se a semana começasse neste dia do ciclo:
    // se a data de pagamento é o dia da semana do contrato, usa a semana cujo start == essa data.
    let sem = estado.semanas.find((s) => toYmd(s.start) === toYmd(pag));
    if (!sem) {
      // pagamento fora do dia do ciclo: sugere valor da semana corrente
      sem = estado.semanas[Math.min(wi, estado.semanas.length - 1)];
    }
    // Recalcula desconto no dia do ciclo com pagamentos até esse dia (incluindo este dia já lançado? ainda não)
    // Para sugestão antes de lançar: usa pagoAte(deadline) já calculado em buildSemanas.
    const comDesconto = Boolean(sem?.comDesconto);
    // Se está pagando no próprio deadline e ainda não atingiu, simula se este pagamento fecharia o alvo.
    let descontoSug = comDesconto ? p.desconto : 0;
    let valorSug = comDesconto ? p.comDesconto : p.contratoCheio;
    if (!comDesconto && toYmd(pag) === toYmd(sem.start)) {
      const falta = Math.max(0, Number(sem.unlockTarget) - Number(sem.pagoAteDeadline));
      // Se o operador pagar o valor com desconto e isso completar o alvo, sugere desconto.
      if (falta <= p.comDesconto + 0.009) {
        descontoSug = p.desconto;
        valorSug = Math.max(falta, p.comDesconto);
      } else {
        // ainda em atraso: sugere o que falta para cobrir semana cheia anterior + atual
        valorSug = falta;
        descontoSug = 0;
      }
    }
    return {
      regra: "ciclo-v2",
      comDesconto: descontoSug > 0.009,
      desconto: descontoSug,
      valorSugerido: valorSug,
      contratoCheio: p.contratoCheio,
      comDescontoValor: p.comDesconto,
      semanaIndex: sem?.index ?? wi,
      unlockTarget: sem?.unlockTarget,
      pagoAteDeadline: sem?.pagoAteDeadline,
    };
  }

  function explicacaoDesistencia(loc, fimBr) {
    const fim = parseBr(fimBr || loc?.fim || loc?.dataFim);
    const r = devidoAluguelAte(loc, fim);
    if (!r) return null;
    const fmt = (n) =>
      typeof currencyBRL === "function"
        ? currencyBRL(n)
        : Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    const semanasUsadas = [];
    const seen = new Set();
    for (const d of r.detalheDias || []) {
      if (seen.has(d.semana)) continue;
      seen.add(d.semana);
      const sem = r.semanas[d.semana];
      if (!sem) continue;
      semanasUsadas.push({
        semana: d.semana + 1,
        comDesconto: sem.comDesconto,
        diariaAluguel: sem.diariaAluguel,
        diariaFmt: fmt(sem.diariaAluguel),
        cobrancaSemanaFmt: fmt(sem.cobrancaSemana),
      });
    }
    return {
      ...r,
      devidoAluguelFmt: fmt(r.devidoAluguel),
      totalPagoFmt: fmt(r.totalPago),
      aDevolverFmt: fmt(r.aDevolver),
      semanasUsadas,
      texto:
        `Devido só de aluguel: ${fmt(r.devidoAluguel)} (${Number(r.dias)} diária(s) com taxa por semana conforme desconto). ` +
        `Total pago: ${fmt(r.totalPago)}. ` +
        `A devolver: ${fmt(r.aDevolver)} (pago − devido só de aluguel).`,
    };
  }

  window.__DK_aluguelCicloV2 = {
    INICIO_REGRA_YMD,
    locAplicaRegraV2,
    paramsFromLoc,
    buildSemanas,
    devidoAluguelAte,
    sugestaoPagamentoNaData,
    explicacaoDesistencia,
  };
})();
