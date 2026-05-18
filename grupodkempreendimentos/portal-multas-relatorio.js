/**
 * Relatório de multas de trânsito (resumo + detalhamento por datas de pagamento).
 */
(function portalMultasRelatorio() {
  const CORES_MULTA = [
    "#c6efce",
    "#f4cccc",
    "#d9d9d9",
    "#e4dfec",
    "#fff2cc",
    "#bdd7ee",
    "#ffe699",
    "#f8cbad",
    "#a9d08e",
    "#b4c6e7",
  ];

  const DOW_ALVO = { SEG: 1, TER: 2, QUA: 3, QUI: 4, SEX: 5, SAB: 6 };
  const DOW_LABEL = {
    SEG: "Segunda-feira",
    TER: "Terça-feira",
    QUA: "Quarta-feira",
    QUI: "Quinta-feira",
    SEX: "Sexta-feira",
    SAB: "Sábado",
  };

  const INTERVALO_DIAS = 7;

  function parseBr(s) {
    if (typeof parseBrDate === "function") return parseBrDate(s);
    const raw = String(s || "").trim();
    if (!/^\d{2}\/\d{2}\/\d{4}$/.test(raw)) return null;
    const [day, month, year] = raw.split("/").map(Number);
    if (!day || !month || !year) return null;
    return new Date(year, month - 1, day);
  }

  function formatBrFromDate(d) {
    if (!d || Number.isNaN(d.getTime())) return "";
    return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
  }

  function addDaysBr(dateStr, days) {
    const d = parseBr(dateStr);
    if (!d) return "";
    d.setDate(d.getDate() + days);
    return formatBrFromDate(d);
  }

  function normDiaPagamento(raw) {
    const s = String(raw || "")
      .trim()
      .toUpperCase()
      .normalize("NFD")
      .replace(/\p{M}/gu, "");
    if (s.startsWith("SEG") || s === "SEG") return "SEG";
    if (s.startsWith("TER") || s === "TER") return "TER";
    if (s.startsWith("QUA") && !s.startsWith("QUAR")) return "QUA";
    if (s.startsWith("QUI") || s.startsWith("QUAR")) return "QUI";
    if (s.startsWith("SEX")) return "SEX";
    if (s.startsWith("SAB")) return "SAB";
    const tres = s.slice(0, 3);
    if (DOW_ALVO[tres]) return tres;
    return "";
  }

  /** Primeira data de pagamento = primeiro dia da semana do contrato após a data da multa. */
  function primeiraParcelaAposMulta(dataMultaBr, diaPag) {
    const dMulta = parseBr(dataMultaBr);
    const alvo = DOW_ALVO[diaPag];
    if (!dMulta || alvo === undefined) return "";
    const d = new Date(dMulta.getFullYear(), dMulta.getMonth(), dMulta.getDate());
    d.setDate(d.getDate() + 1);
    for (let i = 0; i < 14; i++) {
      if (d.getDay() === alvo) return formatBrFromDate(d);
      d.setDate(d.getDate() + 1);
    }
    return "";
  }

  function buildCronogramaMulta(multa, diaPag) {
    const q = Math.min(10, Math.max(1, Math.round(Number(multa.quantidadeParcelas) || 1)));
    const valorTotal = Number(multa.valorMulta) || 0;
    const valorParcela = q > 0 ? valorTotal / q : valorTotal;
    const primeira =
      primeiraParcelaAposMulta(multa.dataMulta, diaPag) || String(multa.dataPrimeiraParcela || "").trim();
    const parcelas = [];
    for (let i = 0; i < q; i++) {
      parcelas.push({
        numero: i + 1,
        data: addDaysBr(primeira, i * INTERVALO_DIAS),
        valor: valorParcela,
      });
    }
    return { primeira, parcelas, valorParcela };
  }

  function fmtBrl(n) {
    if (typeof currencyBRL === "function") return currencyBRL(n);
    return Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }

  function fmtBrlNum(n) {
    return Number(n || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function resolveClienteNome(loc) {
    let nome = String(loc?.nome || loc?.cliente || "").trim();
    const cpf = String(loc?.cpf || "").replace(/\D/g, "").slice(0, 11);
    if (!nome && cpf.length === 11 && typeof findClienteByCpfCadastro === "function") {
      nome = String(findClienteByCpfCadastro(cpf)?.nome || "").trim();
    }
    return nome || "—";
  }

  function buildRelatorioMultasModel(opts) {
    const loc = opts?.loc || {};
    const multasIn = Array.isArray(opts?.multas) ? opts.multas : [];
    const diaPag = normDiaPagamento(loc.diaPagamento || loc.diaPagto) || "SEG";
    const protocolo = String(opts?.protocolo || loc.numeroContrato || "").trim();
    const placa =
      typeof normalizePlate === "function" ? normalizePlate(loc.placa) : String(loc.placa || "").trim().toUpperCase();

    const items = multasIn.map((m, idx) => {
      const cron = buildCronogramaMulta(m, diaPag);
      return {
        numero: idx + 1,
        cod: String(m.codMulta || "").trim(),
        descricao: String(m.descricao || "").trim(),
        valor: Number(m.valorMulta) || 0,
        parcelas: cron.parcelas.length,
        valorParcela: cron.valorParcela,
        dataMulta: String(m.dataMulta || "").trim(),
        dataPrimeiraParcela: cron.primeira,
        cor: CORES_MULTA[idx % CORES_MULTA.length],
        cronograma: cron.parcelas,
      };
    });

    const total = items.reduce((s, x) => s + x.valor, 0);
    const porData = new Map();
    items.forEach((it) => {
      it.cronograma.forEach((p) => {
        if (!/^\d{2}\/\d{2}\/\d{4}$/.test(p.data)) return;
        if (!porData.has(p.data)) porData.set(p.data, new Map());
        porData.get(p.data).set(it.numero, Number(p.valor) || 0);
      });
    });

    const datas = [...porData.keys()].sort((a, b) => {
      const da = parseBr(a);
      const db = parseBr(b);
      return (da?.getTime() || 0) - (db?.getTime() || 0);
    });

    const detalhe = datas.map((data) => {
      const mapa = porData.get(data);
      let linhaTotal = 0;
      const celulas = items.map((it) => {
        const v = mapa.get(it.numero) || 0;
        linhaTotal += v;
        return { numero: it.numero, valor: v, cor: it.cor };
      });
      return { data, celulas, total: linhaTotal };
    });

    return {
      titulo: "RELATÓRIO DE MULTAS",
      clienteNome: resolveClienteNome(loc),
      protocolo,
      placa: placa || "—",
      diaPag,
      diaPagLabel: DOW_LABEL[diaPag] || diaPag,
      total,
      items,
      detalhe,
      geradoEm: formatBrFromDate(new Date()),
    };
  }

  function renderRelatorioMultasHtml(model) {
    const resumoRows = model.items
      .map(
        (it) => `<tr>
          <td class="portal-multas-rel__num" style="background:#ed7d31;color:#fff;text-align:center">${it.numero}</td>
          <td>${esc(it.cod)}</td>
          <td class="portal-multas-rel__money" style="background:#fff2cc">${esc(fmtBrl(it.valor))}</td>
          <td style="text-align:center">${it.parcelas}</td>
          <td class="portal-multas-rel__money" style="background:${it.cor}">${esc(fmtBrl(it.valorParcela))}</td>
          <td>${esc(it.dataMulta)}</td>
        </tr>`
      )
      .join("");

    const multaHeaders = model.items
      .map(
        (it) =>
          `<th class="portal-multas-rel__col-multa" style="background:#ed7d31;color:#fff">MULTA ${it.numero}</th>`
      )
      .join("");

    const detalheRows = model.detalhe
      .map((row) => {
        const cols = row.celulas
          .map((c) => {
            if (!c.valor) return `<td class="portal-multas-rel__money"></td>`;
            return `<td class="portal-multas-rel__money" style="background:${c.cor}">${esc(fmtBrl(c.valor))}</td>`;
          })
          .join("");
        return `<tr>
          <td class="portal-multas-rel__data" style="background:#bdd7ee">${esc(row.data)}</td>
          ${cols}
          <td class="portal-multas-rel__money portal-multas-rel__total-linha"><strong>${row.total > 0 ? esc(fmtBrl(row.total)) : ""}</strong></td>
        </tr>`;
      })
      .join("");

    return `<div class="portal-multas-rel">
      <h1 class="portal-multas-rel__titulo">${esc(model.titulo)}</h1>
      <p class="portal-multas-rel__meta"><strong>Cliente:</strong> ${esc(model.clienteNome)} &nbsp;|&nbsp;
        <strong>Protocolo:</strong> ${esc(model.protocolo)} &nbsp;|&nbsp;
        <strong>Placa:</strong> ${esc(model.placa)}</p>
      <div class="portal-multas-rel__top">
        <div class="portal-multas-rel__dia-pag">
          <span>DIA DE PAGAMENTO DO CLIENTE =</span>
          <strong class="portal-multas-rel__dia-pag-val">${esc(model.diaPag)}</strong>
          <span class="portal-multas-rel__dia-pag-hint">(${esc(model.diaPagLabel)})</span>
        </div>
        <div class="portal-multas-rel__total-geral">
          <span>TOTAL DE MULTAS</span>
          <strong>${esc(fmtBrl(model.total))}</strong>
        </div>
      </div>
      <h2 class="portal-multas-rel__sec">Resumo</h2>
      <table class="portal-multas-rel__table portal-multas-rel__table--resumo">
        <thead>
          <tr>
            <th>Nº</th>
            <th>COD</th>
            <th>VALOR</th>
            <th>PARCELAS</th>
            <th>VALOR DA PARCELA</th>
            <th>DATA DA MULTA</th>
          </tr>
        </thead>
        <tbody>${resumoRows}</tbody>
      </table>
      <h2 class="portal-multas-rel__sec">Detalhamento</h2>
      <table class="portal-multas-rel__table portal-multas-rel__table--detalhe">
        <thead>
          <tr>
            <th class="portal-multas-rel__data-h">DATA</th>
            ${multaHeaders}
            <th class="portal-multas-rel__total-h">TOTAL DE MULTAS</th>
          </tr>
        </thead>
        <tbody>${detalheRows || `<tr><td colspan="${model.items.length + 2}" class="portal-multas-rel__vazio">Sem parcelas calculadas.</td></tr>`}</tbody>
      </table>
      <p class="portal-multas-rel__foot">Gerado em ${esc(model.geradoEm)} · Parcelas a cada 7 dias · 1.ª parcela = primeiro ${esc(model.diaPagLabel)} após a data da multa.</p>
    </div>`;
  }

  function initModalOnce() {
    if (window.__dkPortalMultasRelatorioModalInit) return;
    window.__dkPortalMultasRelatorioModalInit = true;
    document.getElementById("portalMultasRelatorioFecharBtn")?.addEventListener("click", closeRelatorioMultasModal);
    document.querySelectorAll("[data-close-multas-relatorio]").forEach((el) => {
      el.addEventListener("click", closeRelatorioMultasModal);
    });
    document.getElementById("portalMultasRelatorioPrintBtn")?.addEventListener("click", () => {
      window.print();
    });
  }

  function closeRelatorioMultasModal() {
    const modal = document.getElementById("portalMultasRelatorioModal");
    if (modal) {
      modal.classList.add("hidden");
      modal.setAttribute("aria-hidden", "true");
    }
  }

  function openRelatorioMultasModal(model) {
    initModalOnce();
    const root = document.getElementById("portalMultasRelatorioPrintRoot");
    const modal = document.getElementById("portalMultasRelatorioModal");
    if (!root || !modal) return;
    root.innerHTML = renderRelatorioMultasHtml(model);
    modal.classList.remove("hidden");
    modal.setAttribute("aria-hidden", "false");
  }

  window.__DK_buildRelatorioMultasModel = buildRelatorioMultasModel;
  window.__DK_primeiraParcelaMultaAposMulta = primeiraParcelaAposMulta;
  window.__DK_normDiaPagamentoMultas = normDiaPagamento;
  window.__DK_buildCronogramaMultaRelatorio = buildCronogramaMulta;
  window.__DK_openRelatorioMultas = function (opts) {
    const model = buildRelatorioMultasModel(opts);
    if (!model.items.length) {
      window.alert("Não há multas registadas neste protocolo para gerar o relatório.");
      return;
    }
    openRelatorioMultasModal(model);
  };
})();
