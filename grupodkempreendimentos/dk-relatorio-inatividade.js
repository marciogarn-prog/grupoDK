/**
 * Relatório de inatividade: Placas da frota sem protocolo na data.
 * Usado pelo portal (Operação) e pelos testes.
 */
(function dkRelatorioInatividade(root) {
  function brToMs(br) {
    const s = String(br || "").trim();
    const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (!m) return NaN;
    return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1])).getTime();
  }

  function msToBr(ms) {
    const d = new Date(ms);
    if (Number.isNaN(d.getTime())) return "";
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    return `${dd}/${mm}/${d.getFullYear()}`;
  }

  function eachDayMs(startMs, endMs) {
    const days = [];
    const start = new Date(startMs);
    const cur = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    const end = new Date(endMs);
    const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate()).getTime();
    while (cur.getTime() <= endDay) {
      days.push(cur.getTime());
      cur.setDate(cur.getDate() + 1);
    }
    return days;
  }

  function locCobreDia(loc, dayMs, getIniBr, getFimBr) {
    if (!loc || typeof loc !== "object") return false;
    const iniMs = brToMs(getIniBr(loc));
    if (!Number.isFinite(iniMs) || dayMs < iniMs) return false;
    const fimBr = String(getFimBr(loc) || "").trim();
    if (!fimBr) return true;
    const fimMs = brToMs(fimBr);
    return Number.isFinite(fimMs) ? dayMs <= fimMs : true;
  }

  function coletarInatividadePeriodo(opts) {
    const periodo = opts?.periodo || {};
    const veiculos = Array.isArray(opts?.veiculos) ? opts.veiculos : [];
    const locacoes = Array.isArray(opts?.locacoes) ? opts.locacoes : [];
    const nkPlate = typeof opts.nkPlate === "function" ? opts.nkPlate : (p) => String(p || "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
    const getIniBr = typeof opts.getIniBr === "function" ? opts.getIniBr : (l) => String(l?.inicio || l?.dataInicio || "").trim();
    const getFimBr = typeof opts.getFimBr === "function" ? opts.getFimBr : (l) => String(l?.fim || l?.dataFim || "").trim();
    const getValor = typeof opts.getValor === "function" ? opts.getValor : () => 0;
    const getTipo = typeof opts.getTipo === "function" ? opts.getTipo : () => "MOTO";
    const getModelo = typeof opts.getModelo === "function" ? opts.getModelo : (v, loc) =>
      String(v?.marcaModelo || v?.modelo || loc?.marcaModelo || loc?.modelo || "").trim() || "—";
    const getCliente = typeof opts.getCliente === "function" ? opts.getCliente : (loc) =>
      String(loc?.nome || loc?.cliente || loc?.nomeCliente || "").trim() || "—";
    const isGhost = typeof opts.isGhost === "function" ? opts.isGhost : () => false;
    const isCancelada = typeof opts.isCancelada === "function" ? opts.isCancelada : () => false;

    const byPlate = new Map();
    locacoes.forEach((loc) => {
      if (!loc || typeof loc !== "object") return;
      if (isGhost(loc) || isCancelada(loc)) return;
      const proto = String(loc.numeroContrato || loc.protocolo || "").replace(/\D/g, "");
      if (!proto || proto === "2099010199") return;
      const placa = nkPlate(loc.placa);
      if (!placa) return;
      if (!byPlate.has(placa)) byPlate.set(placa, []);
      byPlate.get(placa).push(loc);
    });

    const frota = [];
    const seen = new Set();
    veiculos.forEach((v) => {
      const placa = nkPlate(v?.placa);
      if (!placa || seen.has(placa)) return;
      seen.add(placa);
      frota.push({ placa, veiculo: v });
    });

    const days = Number.isFinite(periodo.startMs) && Number.isFinite(periodo.endMs)
      ? eachDayMs(periodo.startMs, periodo.endMs)
      : [];
    const byDay = new Map();

    function ultimoContratoAte(locs, dayMs) {
      let best = null;
      let bestIni = -1;
      (locs || []).forEach((loc) => {
        const iniMs = brToMs(getIniBr(loc));
        if (!Number.isFinite(iniMs) || iniMs > dayMs) return;
        if (iniMs >= bestIni) {
          bestIni = iniMs;
          best = loc;
        }
      });
      return best;
    }

    days.forEach((dayMs) => {
      const dataBr = msToBr(dayMs);
      const motos = [];
      const carros = [];
      frota.forEach(({ placa, veiculo }) => {
        const locs = byPlate.get(placa) || [];
        const cobrindo = locs.some((loc) => locCobreDia(loc, dayMs, getIniBr, getFimBr));
        if (cobrindo) return;
        const last = ultimoContratoAte(locs, dayMs);
        const tipo = getTipo(veiculo, last) === "CARRO" ? "CARRO" : "MOTO";
        const row = {
          placa,
          protocolo: last ? String(last.numeroContrato || last.protocolo || "").trim() || "—" : "—",
          cliente: last ? getCliente(last) : "SEM PROTOCOLO",
          veiculo: getModelo(veiculo, last),
          valor: last ? Number(getValor(last)) || 0 : 0,
          tipo,
          dataBr,
          dataMs: dayMs,
        };
        (tipo === "CARRO" ? carros : motos).push(row);
      });
      const sortPlaca = (a, b) => String(a.placa).localeCompare(String(b.placa));
      motos.sort(sortPlaca);
      carros.sort(sortPlaca);
      byDay.set(dataBr, { dataBr, dataMs: dayMs, motos, carros, inativas: motos.concat(carros) });
    });

    return {
      frota: frota.length,
      days: Array.from(byDay.values()),
      byDay,
    };
  }

  function contarLivresAgora(opts) {
    const hojeBr = String(opts?.hojeBr || "").trim();
    const dayMs = brToMs(hojeBr);
    if (!Number.isFinite(dayMs)) return { qtd: 0, frota: 0 };
    const data = coletarInatividadePeriodo({
      ...opts,
      periodo: { startMs: dayMs, endMs: dayMs },
    });
    const day = data.days[0];
    return { qtd: day ? day.inativas.length : 0, frota: data.frota };
  }

  root.__DK_relatorioInatividade = {
    brToMs,
    msToBr,
    eachDayMs,
    locCobreDia,
    coletarInatividadePeriodo,
    contarLivresAgora,
  };
})(typeof window !== "undefined" ? window : globalThis);
