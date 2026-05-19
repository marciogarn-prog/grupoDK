/**
 * Lançamento de multas e manutenção (portal Operação).
 * Depende de app.js e portal-locadora-ui.js.
 */
(function portalLancamentosExtras() {
  const TIPOS = [
    {
      key: "lancamentoMultas",
      btnId: "btn-operacao-lancamento-multas",
      panelId: "operacaoInlineLancamentoMultas",
      prefix: "operacaoLancMultas",
      arrayField: "portalMultasTransito",
      modoParcelado: true,
      parceladoTipo: "multa",
      multasTransito: true,
      detalhePanelSuffix: "LancamentoPanel",
      relatorioActionsElId: "operacaoLancMultasRelatorioActions",
      relatorioBtnElId: "operacaoLancMultasGerarRelatorioBtn",
      openRelatorioFn: "__DK_openRelatorioMultas",
    },
    {
      key: "lancamentoManutencao",
      btnId: "btn-operacao-lancamento-manutencao",
      panelId: "operacaoInlineLancamentoManutencao",
      prefix: "operacaoLancManutencao",
      arrayField: "portalManutencoesRegistro",
      modoParcelado: true,
      parceladoTipo: "manutencao",
      detalhePanelSuffix: "LancamentoPanel",
      devidoResumoKey: "valorDevidoManutencao",
      devidoLocField: "valorDevidoManutencao",
      relatorioActionsElId: "operacaoLancManutencaoRelatorioActions",
      relatorioBtnElId: "operacaoLancManutencaoGerarRelatorioBtn",
      openRelatorioFn: "__DK_openRelatorioManutencao",
    },
  ];

  const PARCELADO_STORE = {
    multa: { data: "dataMulta", cod: "codMulta", valor: "valorMulta" },
    manutencao: { data: "dataManutencao", cod: "codManutencao", valor: "valorManutencao" },
  };

  const PARCELADO_FIELDS = {
    multa: {
      data: "DataMulta",
      cod: "CodMulta",
      descricao: "Descricao",
      valor: "ValorMulta",
      qtd: "QtdParcelas",
      primeira: "DataPrimeiraParcela",
      ultima: "DataUltimaParcela",
      preview: "CronogramaPreview",
    },
    manutencao: {
      data: "DataManutencao",
      cod: "CodManutencao",
      descricao: "Descricao",
      valor: "ValorManutencao",
      qtd: "QtdParcelas",
      primeira: "DataPrimeiraParcela",
      ultima: "DataUltimaParcela",
      preview: "CronogramaPreview",
    },
  };

  const state = new Map();
  const MULTAS_INTERVALO_DIAS = 7;

  function isParcelado(cfg) {
    return Boolean(cfg?.modoParcelado || cfg?.multasTransito);
  }

  function parceladoTipo(cfg) {
    return cfg?.parceladoTipo || "multa";
  }

  function pStore(cfg) {
    return PARCELADO_STORE[parceladoTipo(cfg)] || PARCELADO_STORE.multa;
  }

  function pField(cfg) {
    return PARCELADO_FIELDS[parceladoTipo(cfg)] || PARCELADO_FIELDS.multa;
  }

  function pLabels(cfg) {
    const t = parceladoTipo(cfg);
    if (t === "manutencao") {
      return {
        registro: "manutenção",
        registros: "manutenções",
        tituloSecao: "Dados da manutenção",
        data: "DATA DA MANUTENÇÃO",
        cod: "COD. DA MANUTENÇÃO",
        descricao: "DESCRIÇÃO DA MANUTENÇÃO",
        valor: "VALOR DA MANUTENÇÃO",
        totalProtocolo: "TOTAL EM MANUTENÇÃO (protocolo)",
        cadastrar: "Cadastrar manutenção",
        cadastrarConfirm: "manutenção",
        historicoVazio: "Nenhuma manutenção registada neste protocolo.",
        historicoTitulo: "Manutenções registadas",
        colData: "Data manut.",
        apagar: "Apagar esta manutenção?",
        removido: "Manutenção removida.",
        registado: "Manutenção registada.",
        relatorioVazio: "Não há manutenções registadas para gerar o relatório.",
        codObrigatorio: "Informe o código da manutenção.",
        descObrigatoria: "Informe a descrição da manutenção.",
        valorObrigatorio: "Informe o valor da manutenção.",
        dataObrigatoria: "Informe a data da manutenção (DD/MM/AAAA).",
      };
    }
    return {
      registro: "multa",
      registros: "multas",
      tituloSecao: "Dados da multa de trânsito",
      data: "DATA DA MULTA",
      cod: "COD. DA MULTA",
      descricao: "DESCRIÇÃO DA MULTA",
      valor: "VALOR DA MULTA",
      totalProtocolo: "TOTAL EM MULTAS (protocolo)",
      cadastrar: "Cadastrar multa",
      cadastrarConfirm: "multa",
      historicoVazio: "Nenhuma multa de trânsito registada neste protocolo.",
      historicoTitulo: "Multas de trânsito registadas",
      colData: "Data multa",
      apagar: "Apagar esta multa de trânsito?",
      removido: "Multa removida.",
      registado: "Multa registada.",
      relatorioVazio: "Não há multas registadas para gerar o relatório.",
      codObrigatorio: "Informe o código da multa.",
      descObrigatoria: "Informe a descrição da multa.",
      valorObrigatorio: "Informe o valor da multa.",
      dataObrigatoria: "Informe a data da multa (DD/MM/AAAA).",
    };
  }

  function dig(s) {
    return typeof onlyDigits === "function" ? onlyDigits(s) : String(s ?? "").replace(/\D/g, "");
  }

  function normNc(raw) {
    const s = String(raw ?? "")
      .trim()
      .replace(/\s+/g, "")
      .replace(/[^\d]/g, "");
    return s || "";
  }

  function parseVal(v) {
    if (typeof parseCurrencyBR === "function") return Number(parseCurrencyBR(String(v ?? "")));
    const cleaned = String(v ?? "")
      .replace(/[R$\s]/g, "")
      .replace(/\./g, "")
      .replace(",", ".");
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : 0;
  }

  function fmtBrl(n) {
    if (typeof currencyBRL === "function") return currencyBRL(n);
    return Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }

  function fmtBrlNum(n) {
    return Number(n || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function normalizeEntry(x) {
    if (!x || typeof x !== "object") return null;
    const data = String(x.data || "").trim();
    if (!/^\d{2}\/\d{2}\/\d{4}$/.test(data)) return null;
    let valor = typeof x.valor === "number" && Number.isFinite(x.valor) ? x.valor : parseVal(x.valor);
    if (!Number.isFinite(valor) || valor <= 0) return null;
    const ve = parseVal(x.valorEspecie ?? 0);
    const vp = parseVal(x.valorPix ?? 0);
    const vc = parseVal(x.valorCartao ?? 0);
    const row = {
      data,
      valor,
      createdAt: Number(x.createdAt) || Date.now(),
      registradoPorCpf: dig(x.registradoPorCpf).slice(0, 11),
      registradoPorNome: String(x.registradoPorNome || "").trim(),
    };
    if (["valorEspecie", "valorPix", "valorCartao"].some((k) => Object.prototype.hasOwnProperty.call(x, k))) {
      row.valorEspecie = ve >= 0 ? ve : 0;
      row.valorPix = vp >= 0 ? vp : 0;
      row.valorCartao = vc >= 0 ? vc : 0;
      const sum = row.valorEspecie + row.valorPix + row.valorCartao;
      if (sum > 0) row.valor = sum;
    }
    return row;
  }

  function getLancamentos(loc, field) {
    const arr = Array.isArray(loc?.[field]) ? loc[field] : [];
    return arr.map(normalizeEntry).filter(Boolean);
  }

  function sumLancamentos(arr) {
    let s = 0;
    for (const x of arr || []) s += Number(x.valor || 0);
    return s;
  }

  function collectLocs() {
    if (typeof loadCadastro !== "function" || typeof CAD_LOCACOES_KEY === "undefined") return [];
    return loadCadastro(CAD_LOCACOES_KEY).filter((l) => normNc(l.numeroContrato));
  }

  function $(cfg, suffix) {
    return document.getElementById(`${cfg.prefix}${suffix}`);
  }

  function hideAllOperacaoPanels() {
    document.querySelectorAll("#operacaoPainelDireito > .operacao-inline-form").forEach((el) => {
      el.classList.add("hidden");
    });
    const ph = document.getElementById("operacaoFormPlaceholder");
    if (ph) {
      ph.classList.remove("hidden");
      ph.setAttribute("aria-hidden", "false");
    }
    document
      .querySelectorAll("#portalOperacaoSidebar .btn-operacao-cmd, .portal-operacao-layout__sidebar .btn-operacao-cmd")
      .forEach((b) => {
        b.classList.remove("is-active");
        b.setAttribute("aria-expanded", "false");
      });
  }

  function showPanel(cfg) {
    hideAllOperacaoPanels();
    const panel = document.getElementById(cfg.panelId);
    const ph = document.getElementById("operacaoFormPlaceholder");
    if (ph) {
      ph.classList.add("hidden");
      ph.setAttribute("aria-hidden", "true");
    }
    panel?.classList.remove("hidden");
    const btn = document.getElementById(cfg.btnId);
    btn?.classList.add("is-active");
    btn?.setAttribute("aria-expanded", "true");
    if (typeof window.__DK_syncOperacaoCadastroButtons === "function") {
      window.__DK_syncOperacaoCadastroButtons(cfg.btnId);
    }
  }

  function detalhePanelSuffix(cfg) {
    return cfg.detalhePanelSuffix || "PagamentoPanel";
  }

  function parseBrDateLocal(s) {
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
    const d = parseBrDateLocal(dateStr);
    if (!d) return "";
    d.setDate(d.getDate() + days);
    return formatBrFromDate(d);
  }

  function clampParcelas(n) {
    const v = Math.round(Number(n));
    if (!Number.isFinite(v)) return 1;
    return Math.min(10, Math.max(1, v));
  }

  function calcDataUltimaParcela(dataPrimeira, qtdParcelas) {
    const q = clampParcelas(qtdParcelas);
    if (q <= 1) return String(dataPrimeira || "").trim();
    return addDaysBr(dataPrimeira, (q - 1) * MULTAS_INTERVALO_DIAS);
  }

  function buildCronogramaParcelas(dataPrimeira, qtdParcelas, valorTotal) {
    const q = clampParcelas(qtdParcelas);
    const valorParcela = q > 0 ? valorTotal / q : valorTotal;
    const parcelas = [];
    for (let i = 0; i < q; i++) {
      parcelas.push({
        numero: i + 1,
        data: addDaysBr(dataPrimeira, i * MULTAS_INTERVALO_DIAS),
        valor: valorParcela,
      });
    }
    return parcelas;
  }

  function normalizeRegistroParcelado(cfg, x) {
    if (!x || typeof x !== "object") return null;
    const sk = pStore(cfg);
    const dataReg = String(x[sk.data] || x.dataMulta || x.dataManutencao || "").trim();
    const codReg = String(x[sk.cod] || x.codMulta || x.codManutencao || "").trim();
    const descricao = String(x.descricao || "").trim();
    const dataPrimeiraParcela = String(x.dataPrimeiraParcela || "").trim();
    const dataUltimaParcela = String(x.dataUltimaParcela || "").trim();
    if (!/^\d{2}\/\d{2}\/\d{4}$/.test(dataReg)) return null;
    if (!codReg) return null;
    if (!descricao) return null;
    if (!/^\d{2}\/\d{2}\/\d{4}$/.test(dataPrimeiraParcela)) return null;
    let valorReg =
      typeof x[sk.valor] === "number" && Number.isFinite(x[sk.valor])
        ? x[sk.valor]
        : parseVal(x[sk.valor] ?? x.valorMulta ?? x.valorManutencao);
    if (!Number.isFinite(valorReg) || valorReg <= 0) return null;
    const quantidadeParcelas = clampParcelas(x.quantidadeParcelas);
    const ultima =
      /^\d{2}\/\d{2}\/\d{4}$/.test(dataUltimaParcela) ?
        dataUltimaParcela
      : calcDataUltimaParcela(dataPrimeiraParcela, quantidadeParcelas);
    let parcelas = Array.isArray(x.parcelas) ? x.parcelas : [];
    if (!parcelas.length) parcelas = buildCronogramaParcelas(dataPrimeiraParcela, quantidadeParcelas, valorReg);
    const row = {
      descricao,
      quantidadeParcelas,
      dataPrimeiraParcela,
      dataUltimaParcela: ultima,
      parcelas: parcelas.map((p, i) => ({
        numero: Number(p.numero) || i + 1,
        data: String(p.data || "").trim(),
        valor: typeof p.valor === "number" && Number.isFinite(p.valor) ? p.valor : parseVal(p.valor),
      })),
      createdAt: Number(x.createdAt) || Date.now(),
      registradoPorCpf: dig(x.registradoPorCpf).slice(0, 11),
      registradoPorNome: String(x.registradoPorNome || "").trim(),
    };
    row[sk.data] = dataReg;
    row[sk.cod] = codReg;
    row[sk.valor] = valorReg;
    return row;
  }

  function getRegistrosParcelados(loc, cfg) {
    const arr = Array.isArray(loc?.[cfg.arrayField]) ? loc[cfg.arrayField] : [];
    return arr.map((x) => normalizeRegistroParcelado(cfg, x)).filter(Boolean);
  }

  function sumRegistrosParcelados(cfg, arr) {
    const sk = pStore(cfg);
    let s = 0;
    for (const x of arr || []) s += Number(x[sk.valor] || 0);
    return s;
  }

  function getMultasTransito(loc) {
    return getRegistrosParcelados(loc, TIPOS[0]);
  }

  function sumMultasTransito(arr) {
    return sumRegistrosParcelados(TIPOS[0], arr);
  }

  function getCurrentLocForCfg(cfg) {
    const digits = dig($(cfg, "Cpf")?.value).slice(0, 11);
    const nc = normNc($(cfg, "ProtocoloSelect")?.value);
    if (digits.length !== 11 || !nc) return null;
    return collectLocs().find((l) => dig(l.cpf) === digits && normNc(l.numeroContrato) === nc) || null;
  }

  function syncParcelasUI(cfg) {
    const f = pField(cfg);
    const qtd = clampParcelas($(cfg, f.qtd)?.value || 1);
    const dataReg = String($(cfg, f.data)?.value || "").trim();
    const loc = getCurrentLocForCfg(cfg);
    if (
      loc &&
      /^\d{2}\/\d{2}\/\d{4}$/.test(dataReg) &&
      typeof window.__DK_primeiraParcelaMultaAposMulta === "function"
    ) {
      const dia =
        typeof window.__DK_normDiaPagamentoMultas === "function"
          ? window.__DK_normDiaPagamentoMultas(loc.diaPagamento || loc.diaPagto)
          : "";
      const auto = window.__DK_primeiraParcelaMultaAposMulta(dataReg, dia || "SEG");
      if (auto && $(cfg, f.primeira)) $(cfg, f.primeira).value = auto;
    }
    const primeira = String($(cfg, f.primeira)?.value || "").trim();
    const ultimaInp = $(cfg, f.ultima);
    const preview = $(cfg, f.preview);
    if (ultimaInp) {
      ultimaInp.value =
        primeira && /^\d{2}\/\d{2}\/\d{4}$/.test(primeira) ? calcDataUltimaParcela(primeira, qtd) : "";
    }
    if (!preview) return;
    if (!primeira || !/^\d{2}\/\d{2}\/\d{4}$/.test(primeira)) {
      preview.textContent = "";
      return;
    }
    const valor = parseVal($(cfg, f.valor)?.value);
    const parcelas = buildCronogramaParcelas(primeira, qtd, valor > 0 ? valor : 0);
    const linhas = parcelas.map((p) => {
      const v = valor > 0 ? fmtBrlNum(p.valor) : "—";
      return `${p.numero}ª: ${p.data} · R$ ${v}`;
    });
    preview.textContent = linhas.length ? `Cronograma: ${linhas.join(" · ")}` : "";
  }

  function clearParceladoLancamentoForm(cfg) {
    const f = pField(cfg);
    [f.data, f.cod, f.descricao, f.valor, f.primeira, f.ultima].forEach((s) => {
      const el = $(cfg, s);
      if (el) el.value = "";
    });
    const sel = $(cfg, f.qtd);
    if (sel) sel.value = "1";
    syncParcelasUI(cfg);
  }

  function updateRelatorioParceladoActions(cfg, loc) {
    if (!isParcelado(cfg)) return;
    const wrap = document.getElementById(cfg.relatorioActionsElId);
    if (!wrap) return;
    const regs = loc ? getRegistrosParcelados(loc, cfg) : [];
    if (regs.length) {
      wrap.classList.remove("hidden");
      wrap.removeAttribute("hidden");
    } else {
      wrap.classList.add("hidden");
      wrap.setAttribute("hidden", "");
    }
  }

  function hideDetalhe(cfg) {
    $(cfg, "ReferenciaPanel")?.classList.add("hidden");
    $(cfg, "ReferenciaPanel")?.setAttribute("hidden", "");
    $(cfg, detalhePanelSuffix(cfg))?.classList.add("hidden");
    $(cfg, detalhePanelSuffix(cfg))?.setAttribute("hidden", "");
    const hist = $(cfg, "Historico");
    if (hist) {
      hist.classList.add("hidden");
      hist.replaceChildren();
    }
    if (isParcelado(cfg)) updateRelatorioParceladoActions(cfg, null);
  }

  function showDetalhe(cfg) {
    $(cfg, "ReferenciaPanel")?.classList.remove("hidden");
    $(cfg, "ReferenciaPanel")?.removeAttribute("hidden");
    $(cfg, detalhePanelSuffix(cfg))?.classList.remove("hidden");
    $(cfg, detalhePanelSuffix(cfg))?.removeAttribute("hidden");
  }

  function syncValorPagoFromMeios(cfg) {
    const ve = parseVal($(cfg, "ValorEspecie")?.value);
    const vp = parseVal($(cfg, "ValorPix")?.value);
    const vc = parseVal($(cfg, "ValorCartao")?.value);
    const total = ve + vp + vc;
    const inp = $(cfg, "ValorPago");
    if (inp) inp.value = total > 0 ? fmtBrlNum(total) : "";
  }

  function fmtDateLoc(raw) {
    const s = String(raw || "").trim();
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) return s;
    if (typeof parseBrDate === "function") {
      const d = parseBrDate(s);
      if (d && !Number.isNaN(d.getTime())) {
        return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
      }
    }
    return s;
  }

  function applyLocToForm(cfg, loc) {
    const placa =
      typeof normalizePlate === "function" ? normalizePlate(loc.placa) : String(loc.placa || "").trim();
    if ($(cfg, "Placa")) $(cfg, "Placa").value = placa || "—";
    if ($(cfg, "DataInicio")) $(cfg, "DataInicio").value = fmtDateLoc(loc.inicio);
    if ($(cfg, "DataFim")) $(cfg, "DataFim").value = fmtDateLoc(loc.fim);
    if (isParcelado(cfg)) {
      const regs = getRegistrosParcelados(loc, cfg);
      if ($(cfg, "ValorDevido")) $(cfg, "ValorDevido").value = fmtBrlNum(sumRegistrosParcelados(cfg, regs));
      clearParceladoLancamentoForm(cfg);
      renderHistorico(cfg, loc);
      updateRelatorioParceladoActions(cfg, loc);
      return;
    }
    const resumo =
      typeof window.__DK_computePortalProtocoloResumoFromLoc === "function"
        ? window.__DK_computePortalProtocoloResumoFromLoc(loc)
        : null;
    const lancs = getLancamentos(loc, cfg.arrayField);
    if ($(cfg, "ValorDevido") && resumo) {
      $(cfg, "ValorDevido").value = String(resumo[cfg.devidoResumoKey] || "").trim();
    }
    if ($(cfg, "TotalPago")) $(cfg, "TotalPago").value = fmtBrlNum(sumLancamentos(lancs));
    ["ValorEspecie", "ValorPix", "ValorCartao", "ValorPago", "DataPagamento"].forEach((s) => {
      const el = $(cfg, s);
      if (el) el.value = "";
    });
    syncValorPagoFromMeios(cfg);
    renderHistorico(cfg, loc);
  }

  function renderHistorico(cfg, loc) {
    const wrap = $(cfg, "Historico");
    if (!wrap) return;
    const owner = typeof window.__DK_isPortalTitularAdministrador === "function" && window.__DK_isPortalTitularAdministrador();
    const esc = (s) =>
      String(s ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
    if (isParcelado(cfg)) {
      const sk = pStore(cfg);
      const lbl = pLabels(cfg);
      const arr = getRegistrosParcelados(loc, cfg);
      if (!arr.length) {
        wrap.classList.remove("hidden");
        wrap.innerHTML = `<p class="subtext">${esc(lbl.historicoVazio)}</p>`;
        return;
      }
      wrap.classList.remove("hidden");
      const thead = owner
        ? `<thead><tr><th>${lbl.colData}</th><th>Cód.</th><th>Descrição</th><th>Valor</th><th>Parcelas</th><th>1.ª / última</th><th>Ações</th></tr></thead>`
        : `<thead><tr><th>${lbl.colData}</th><th>Cód.</th><th>Descrição</th><th>Valor</th><th>Parcelas</th><th>1.ª / última</th></tr></thead>`;
      const rows = arr
        .map((x, i) => {
          const v = fmtBrlNum(x[sk.valor]);
          const parc = `${x.quantidadeParcelas}× · ${esc(x.dataPrimeiraParcela)} → ${esc(x.dataUltimaParcela)}`;
          if (owner) {
            return `<tr><td>${esc(x[sk.data])}</td><td>${esc(x[sk.cod])}</td><td>${esc(x.descricao)}</td><td>${v}</td><td>${x.quantidadeParcelas}</td><td>${parc}</td><td><button type="button" class="btn-primary btn-secondary-outline" data-lanc-extra-del="${cfg.key}" data-idx="${i}">Apagar</button></td></tr>`;
          }
          return `<tr><td>${esc(x[sk.data])}</td><td>${esc(x[sk.cod])}</td><td>${esc(x.descricao)}</td><td>${v}</td><td>${x.quantidadeParcelas}</td><td>${parc}</td></tr>`;
        })
        .join("");
      wrap.innerHTML = `<p class="subtext"><strong>${esc(lbl.historicoTitulo)}</strong></p><table class="portal-lanc-hist portal-lanc-hist--multas">${thead}<tbody>${rows}</tbody></table>`;
      return;
    }
    const arr = getLancamentos(loc, cfg.arrayField);
    if (!arr.length) {
      wrap.classList.remove("hidden");
      wrap.innerHTML = "<p class=\"subtext\">Nenhum pagamento registado neste protocolo.</p>";
      return;
    }
    wrap.classList.remove("hidden");
    const thead = owner
      ? "<thead><tr><th>Data</th><th>Valor (R$)</th><th>Ações</th></tr></thead>"
      : "<thead><tr><th>Data</th><th>Valor (R$)</th></tr></thead>";
    const rows = arr
      .map((x, i) => {
        const v = fmtBrlNum(x.valor);
        const d = esc(x.data);
        if (owner) {
          return `<tr><td>${d}</td><td>${v}</td><td><button type="button" class="btn-primary btn-secondary-outline" data-lanc-extra-del="${cfg.key}" data-idx="${i}">Apagar</button></td></tr>`;
        }
        return `<tr><td>${d}</td><td>${v}</td></tr>`;
      })
      .join("");
    wrap.innerHTML = `<p class="subtext"><strong>Pagamentos registados</strong></p><table class="portal-lanc-hist">${thead}<tbody>${rows}</tbody></table>`;
  }

  function refreshProtocoloSelect(cfg, opts = {}) {
    const sel = $(cfg, "ProtocoloSelect");
    const cpfInp = $(cfg, "Cpf");
    if (!sel || !cpfInp) return;
    const digits = dig(cpfInp.value).slice(0, 11);
    if (digits.length !== 11) {
      sel.disabled = true;
      sel.replaceChildren();
      const o = document.createElement("option");
      o.value = "";
      o.textContent = "Informe um CPF com locação";
      sel.appendChild(o);
      return;
    }
    const locs = collectLocs().filter((l) => dig(l.cpf) === digits);
    const byNc = new Map();
    locs.forEach((l) => {
      const nc = normNc(l.numeroContrato);
      if (nc) byNc.set(nc, l);
    });
    const sorted = [...byNc.keys()].sort();
    const preserve = normNc(opts.preserveNc || sel.value);
    sel.replaceChildren();
    sorted.forEach((nc) => {
      const l = byNc.get(nc);
      const opt = document.createElement("option");
      opt.value = nc;
      const pl = typeof normalizePlate === "function" ? normalizePlate(l.placa) : l.placa;
      const ativo =
        typeof window.__DK_isPortalLocacaoAtiva === "function" ? window.__DK_isPortalLocacaoAtiva(l) : !String(l.fim || "").trim();
      opt.textContent = `${nc} · ${pl || "—"} · ${fmtDateLoc(l.inicio)} · ${ativo ? "ativo" : "inativo"}`;
      sel.appendChild(opt);
    });
    sel.disabled = false;
    sel.value = preserve && sorted.includes(preserve) ? preserve : sorted[0] || "";
    const chosen = byNc.get(sel.value);
    if (chosen) applyLocToForm(cfg, chosen);
  }

  function resolvePesquisa(cfg) {
    const cpfDigits = dig($(cfg, "Cpf")?.value).slice(0, 11);
    const protoWant = normNc($(cfg, "ProtocoloBusca")?.value);
    const nomeQ = String($(cfg, "NomeBusca")?.value || "")
      .trim()
      .toLowerCase();
    const locs = collectLocs();
    if (protoWant) {
      const hit = locs.find((l) => normNc(l.numeroContrato) === protoWant);
      if (hit) return { loc: hit, cpfDigits: dig(hit.cpf), proto: protoWant };
    }
    if (cpfDigits.length === 11) {
      const matches = locs.filter((l) => dig(l.cpf) === cpfDigits);
      if (!matches.length) return null;
      const pick = protoWant
        ? matches.find((l) => normNc(l.numeroContrato) === protoWant) || matches[0]
        : matches[0];
      return { loc: pick, cpfDigits, proto: normNc(pick.numeroContrato) };
    }
    if (nomeQ) {
      const matches = locs.filter((l) => {
        let nome = String(l.nome || l.cliente || "").trim();
        if (!nome && typeof findClienteByCpfCadastro === "function") {
          nome = String(findClienteByCpfCadastro(dig(l.cpf))?.nome || "").trim();
        }
        return nome.toLowerCase().includes(nomeQ);
      });
      if (!matches.length) return null;
      const pick = matches[0];
      return { loc: pick, cpfDigits: dig(pick.cpf), proto: normNc(pick.numeroContrato) };
    }
    const placaQ = normPlate($(cfg, "PlacaBusca")?.value);
    if (placaQ.length >= 3) {
      const matches = locs.filter((l) => normPlate(l.placa).includes(placaQ));
      if (!matches.length) return null;
      const pick =
        protoWant ? matches.find((l) => normNc(l.numeroContrato) === protoWant) || matches[0] : matches[0];
      return { loc: pick, cpfDigits: dig(pick.cpf), proto: normNc(pick.numeroContrato) };
    }
    return null;
  }

  function persistLancamentos(cfg, locs, loc, cpfDigits, nc) {
    if (isParcelado(cfg)) {
      const normArr = getRegistrosParcelados(loc, cfg);
      loc[cfg.arrayField] = normArr.map((x) => ({ ...x }));
      const total = sumRegistrosParcelados(cfg, normArr);
      if (cfg.devidoLocField === "valorDevidoManutencao") {
        loc.valorDevidoManutencao = fmtBrlNum(total);
      } else {
        loc.valorDevidoMultas = fmtBrlNum(total);
      }
    } else {
      const normArr = getLancamentos(loc, cfg.arrayField);
      loc[cfg.arrayField] = normArr.map((x) => ({ ...x }));
    }
    try {
      saveCadastro(CAD_LOCACOES_KEY, locs);
    } catch (e) {
      console.error(e);
      return false;
    }
    if (typeof window.__DK_pushToCloudAfterSave === "function") {
      window.__DK_pushToCloudAfterSave();
    } else if (typeof window.__DK_pushCloudSnapshotNow === "function") {
      window.__DK_pushCloudSnapshotNow().catch(() => {});
    }
    return true;
  }

  function persistMultaTransito(cfg, cpfDigits, nc, entry) {
    if (typeof loadCadastro !== "function") return false;
    const locs = loadCadastro(CAD_LOCACOES_KEY);
    const idx = locs.findIndex((l) => dig(l.cpf) === cpfDigits && normNc(l.numeroContrato) === nc);
    if (idx < 0) return false;
    const loc = locs[idx];
    if (!Array.isArray(loc[cfg.arrayField])) loc[cfg.arrayField] = [];
    const reg =
      typeof window.__DK_getPortalSessaoParaRegistroLancamento === "function"
        ? window.__DK_getPortalSessaoParaRegistroLancamento()
        : { cpf: "", nome: "" };
    loc[cfg.arrayField].push({
      ...entry,
      createdAt: Date.now(),
      registradoPorCpf: reg.cpf || "",
      registradoPorNome: reg.nome || "",
    });
    return persistLancamentos(cfg, locs, loc, cpfDigits, nc);
  }

  function persistPagamento(cfg, cpfDigits, nc, valorNum, dataStr, meios) {
    if (typeof loadCadastro !== "function") return false;
    const locs = loadCadastro(CAD_LOCACOES_KEY);
    const idx = locs.findIndex((l) => dig(l.cpf) === cpfDigits && normNc(l.numeroContrato) === nc);
    if (idx < 0) return false;
    const loc = locs[idx];
    if (!Array.isArray(loc[cfg.arrayField])) loc[cfg.arrayField] = [];
    const reg =
      typeof window.__DK_getPortalSessaoParaRegistroLancamento === "function"
        ? window.__DK_getPortalSessaoParaRegistroLancamento()
        : { cpf: "", nome: "" };
    loc[cfg.arrayField].push({
      data: dataStr,
      valor: valorNum,
      createdAt: Date.now(),
      registradoPorCpf: reg.cpf || "",
      registradoPorNome: reg.nome || "",
      valorEspecie: meios.valorEspecie,
      valorPix: meios.valorPix,
      valorCartao: meios.valorCartao,
    });
    return persistLancamentos(cfg, locs, loc, cpfDigits, nc);
  }

  function escHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function normPlate(raw) {
    if (typeof normalizePlate === "function") return normalizePlate(String(raw || ""));
    return String(raw || "")
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "");
  }

  function nomeChave(raw) {
    if (typeof window.__DK_portalNomeChaveBusca === "function") return window.__DK_portalNomeChaveBusca(raw);
    return String(raw || "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{M}/gu, "");
  }

  function resolveNomePorCpf(cpfDigits) {
    if (typeof window.__DK_resolveLancNomePorCpf === "function") return window.__DK_resolveLancNomePorCpf(cpfDigits);
    if (typeof findClienteByCpfCadastro === "function") {
      return String(findClienteByCpfCadastro(cpfDigits)?.nome || "").trim();
    }
    return "";
  }

  function collectPesquisaLinhas() {
    if (typeof window.__DK_collectLancPesquisaLinhas === "function") return window.__DK_collectLancPesquisaLinhas();
    const np =
      typeof normalizePlate === "function"
        ? normalizePlate
        : (x) => String(x || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    const linhas = [];
    collectLocs().forEach((l) => {
      const proto = normNc(l.numeroContrato);
      const cpf = dig(l.cpf).slice(0, 11);
      if (!proto || cpf.length !== 11) return;
      let nome = String(l.nome || l.cliente || "").trim();
      if (!nome) nome = resolveNomePorCpf(cpf);
      const corFn = window.__DK_getPortalLancPesquisaLinhaCorClasse;
      linhas.push({
        cpf,
        nome: nome || "(sem nome)",
        proto,
        placa: np(String(l.placa || "")),
        corClasse: typeof corFn === "function" ? corFn(l) : "portal-lanc-pesquisa-linha--branco",
        ativo: typeof window.__DK_isPortalLocacaoAtiva === "function" ? window.__DK_isPortalLocacaoAtiva(l) : !String(l.fim || "").trim(),
      });
    });
    return linhas;
  }

  function filterPesquisaLinhas(linhas, filtros) {
    if (typeof window.__DK_filterLancPesquisaLinhas === "function") {
      return window.__DK_filterLancPesquisaLinhas(linhas, filtros);
    }
    const cpfPrefix = dig(String(filtros.cpfRaw || "")).slice(0, 11);
    const nomeKey = nomeChave(filtros.nomeRaw || "");
    const protoQ = normNc(String(filtros.protoRaw || "").trim());
    const placaQ = normPlate(filtros.placaRaw || "");
    return linhas.filter((row) => {
      if (cpfPrefix.length && !row.cpf.startsWith(cpfPrefix)) return false;
      if (nomeKey.length >= 2 && !nomeChave(row.nome).includes(nomeKey)) return false;
      if (protoQ.length && !row.proto.includes(protoQ)) return false;
      if (placaQ.length >= 3 && !(row.placa || "").includes(placaQ)) return false;
      return true;
    });
  }

  function linhasProtocolosParaLista(filtradas, { cpfRaw, nomeRaw, placaRaw }) {
    const cpfDig = dig(String(cpfRaw || "")).slice(0, 11);
    if (cpfDig.length === 11) return filtradas.filter((r) => r.cpf === cpfDig);
    const placaQ = normPlate(placaRaw || "");
    if (placaQ.length >= 3) {
      const porPlaca = filtradas.filter((r) => (r.placa || "").includes(placaQ));
      if (porPlaca.length) return porPlaca;
    }
    const nomeKey = nomeChave(nomeRaw || "");
    if (nomeKey.length < 2) return [];
    const cpfs = [...new Set(filtradas.map((r) => r.cpf))];
    if (cpfs.length === 1) return filtradas.filter((r) => r.cpf === cpfs[0]);
    const exatos = filtradas.filter((r) => nomeChave(r.nome) === nomeKey);
    const cpfsEx = [...new Set(exatos.map((r) => r.cpf))];
    if (cpfsEx.length === 1) return exatos.filter((r) => r.cpf === cpfsEx[0]);
    return [];
  }

  function preencherCamposDeLinha(cfg, row, source) {
    if (!row) return;
    const fmt = typeof formatCpf === "function" ? formatCpf : (d) => d;
    if (source !== "cpf" && $(cfg, "Cpf")) $(cfg, "Cpf").value = fmt(row.cpf);
    if (source !== "nome" && $(cfg, "NomeBusca") && row.nome && row.nome !== "(sem nome)") {
      $(cfg, "NomeBusca").value = String(row.nome).trim();
    }
    if (source !== "placa" && $(cfg, "PlacaBusca") && row.placa) $(cfg, "PlacaBusca").value = row.placa;
    if (source !== "proto" && $(cfg, "ProtocoloBusca") && row.proto) $(cfg, "ProtocoloBusca").value = row.proto;
  }

  function renderPesquisaLista(cfg, linhas) {
    const panel = document.getElementById(`${cfg.prefix}PesquisaLista`);
    if (!panel) return;
    const fmt = typeof formatCpf === "function" ? formatCpf : (d) => d;
    if (!linhas.length) {
      panel.classList.add("hidden");
      panel.setAttribute("hidden", "");
      panel.innerHTML = "";
      return;
    }
    const max = 40;
    const slice = linhas.slice(0, max);
    panel.classList.remove("hidden");
    panel.removeAttribute("hidden");
    panel.innerHTML = `<p class="portal-cliente-prefix-list__title">${slice.length === linhas.length ? slice.length : `${slice.length} de ${linhas.length}`} protocolo(s) — clique numa linha:</p><ul class="portal-cliente-prefix-list__ul">${slice
      .map((row) => {
        const placaLbl = row.placa ? ` · ${escHtml(row.placa)}` : "";
        const status = row.ativo ? "ativo" : "inativo";
        const corCls = escHtml(row.corClasse || "portal-lanc-pesquisa-linha--branco");
        return `<li><button type="button" class="portal-cliente-prefix-list__btn portal-lanc-pesquisa-linha ${corCls}" data-lanc-pesquisa-key="${cfg.key}" data-cpf="${escHtml(row.cpf)}" data-nome="${escHtml(row.nome)}" data-proto="${escHtml(row.proto)}" data-placa="${escHtml(row.placa || "")}">${escHtml(row.nome)} · ${escHtml(fmt(row.cpf))} · ${escHtml(row.proto)}${placaLbl} · <strong>${status}</strong></button></li>`;
      })
      .join("")}</ul>`;
  }

  function aplicarPesquisaLinha(cfg, cpf, nome, proto, placa) {
    const cpfDigits = dig(String(cpf || "")).slice(0, 11);
    if ($(cfg, "Cpf") && cpfDigits.length === 11 && typeof formatCpf === "function") {
      $(cfg, "Cpf").value = formatCpf(cpfDigits);
    }
    if ($(cfg, "NomeBusca") && nome && nome !== "(sem nome)") $(cfg, "NomeBusca").value = String(nome).trim();
    if ($(cfg, "ProtocoloBusca") && proto) $(cfg, "ProtocoloBusca").value = String(proto).trim();
    if ($(cfg, "PlacaBusca") && placa) $(cfg, "PlacaBusca").value = normPlate(placa);
    refreshPesquisaAvancada(cfg);
    hideDetalhe(cfg);
  }

  function refreshPesquisaAvancada(cfg, opts = {}) {
    const source = String(opts.source || "");
    const inpCpf = $(cfg, "Cpf");
    const inpNome = $(cfg, "NomeBusca");
    const inpProto = $(cfg, "ProtocoloBusca");
    const inpPlaca = $(cfg, "PlacaBusca");
    const dlCpf = document.getElementById(`${cfg.prefix}CpfSugestoes`);
    const dlNome = document.getElementById(`${cfg.prefix}NomeSugestoes`);
    const dlProto = document.getElementById(`${cfg.prefix}ProtocoloSugestoes`);
    const dlPlaca = document.getElementById(`${cfg.prefix}PlacaSugestoes`);
    if (!dlCpf || !dlNome || !dlProto) return;

    const prevCpf = String(inpCpf?.value || "").trim();
    const prevNome = String(inpNome?.value || "").trim();
    const prevProto = String(inpProto?.value || "").trim();
    const prevPlaca = String(inpPlaca?.value || "").trim();
    const fmt = typeof formatCpf === "function" ? formatCpf : (d) => d;

    const todas = collectPesquisaLinhas();
    const filtradas = filterPesquisaLinhas(todas, {
      cpfRaw: prevCpf,
      nomeRaw: prevNome,
      protoRaw: prevProto,
      placaRaw: prevPlaca,
    });

    const cpfsMap = new Map();
    const nomesMap = new Map();
    const protosSet = new Map();
    const placasMap = new Map();
    filtradas.forEach((row) => {
      if (!cpfsMap.has(row.cpf)) cpfsMap.set(row.cpf, row.nome);
      const nk = nomeChave(row.nome);
      if (!nomesMap.has(nk)) nomesMap.set(nk, { nome: row.nome, cpf: row.cpf });
      if (!protosSet.has(row.proto)) protosSet.set(row.proto, { cpf: row.cpf, nome: row.nome, placa: row.placa, ativo: row.ativo });
      if (row.placa && !placasMap.has(row.placa)) placasMap.set(row.placa, { cpf: row.cpf, nome: row.nome });
    });

    if (dlPlaca) {
      dlPlaca.innerHTML = Array.from(placasMap.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .slice(0, 120)
        .map(([placa, meta]) => {
          const lbl = `${fmt(meta.cpf)} · ${meta.nome}`;
          return `<option value="${escHtml(placa)}" label="${escHtml(lbl)}"></option>`;
        })
        .join("");
    }

    dlCpf.innerHTML = Array.from(cpfsMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(0, 120)
      .map(([cpf, nome]) => `<option value="${escHtml(fmt(cpf))}" label="${escHtml(nome)}"></option>`)
      .join("");

    dlNome.innerHTML = Array.from(nomesMap.values())
      .sort((a, b) => String(a.nome).localeCompare(String(b.nome), "pt-BR"))
      .slice(0, 120)
      .map((row) => `<option value="${escHtml(row.nome)}" label="${escHtml(fmt(row.cpf))}"></option>`)
      .join("");

    const cpfDig = dig(prevCpf).slice(0, 11);
    const protosParaDatalist = linhasProtocolosParaLista(filtradas, {
      cpfRaw: prevCpf,
      nomeRaw: prevNome,
      placaRaw: prevPlaca,
    });

    dlProto.innerHTML = protosParaDatalist
      .sort((a, b) => a.proto.localeCompare(b.proto, "en"))
      .slice(0, 120)
      .map((row) => {
        const lbl = `${fmt(row.cpf)} · ${row.nome}${row.placa ? ` · ${row.placa}` : ""} · ${row.ativo ? "ativo" : "inativo"}`;
        return `<option value="${escHtml(row.proto)}" label="${escHtml(lbl)}"></option>`;
      })
      .join("");

    renderPesquisaLista(cfg, protosParaDatalist);

    const cpfsUnicos = [...cpfsMap.keys()];
    const nomesUnicos = [...nomesMap.values()];

    if (source !== "nome" && inpNome) {
      if (cpfsUnicos.length === 1) {
        const nomeCanon = cpfsMap.get(cpfsUnicos[0]) || "";
        if (nomeCanon && nomeCanon !== "(sem nome)") inpNome.value = nomeCanon;
      } else if (source === "cpf") {
        const cpfDigLocal = dig(prevCpf);
        if (cpfDigLocal.length === 11) {
          const nomeCanon = cpfsMap.get(cpfDigLocal) || resolveNomePorCpf(cpfDigLocal);
          if (nomeCanon) inpNome.value = nomeCanon;
        } else if (filtradas.length === 1) {
          inpNome.value = filtradas[0].nome === "(sem nome)" ? "" : filtradas[0].nome;
        }
      } else if (source === "placa" && protosParaDatalist.length === 1) {
        const nomeCanon = protosParaDatalist[0].nome;
        if (nomeCanon && nomeCanon !== "(sem nome)") inpNome.value = nomeCanon;
      }
    }

    if (source !== "cpf" && inpCpf) {
      if (nomesUnicos.length === 1) {
        inpCpf.value = fmt(nomesUnicos[0].cpf);
      } else if (source === "nome" && nomesUnicos.length > 1) {
        const key = nomeChave(prevNome);
        const exato = nomesUnicos.filter((r) => nomeChave(r.nome) === key);
        if (exato.length === 1) inpCpf.value = fmt(exato[0].cpf);
      } else if (source === "proto" && filtradas.length === 1) {
        inpCpf.value = fmt(filtradas[0].cpf);
      } else if (source === "placa" && protosParaDatalist.length === 1) {
        inpCpf.value = fmt(protosParaDatalist[0].cpf);
      }
    }

    if (source !== "placa" && inpPlaca) {
      if (filtradas.length === 1 && filtradas[0].placa) {
        inpPlaca.value = filtradas[0].placa;
      } else if (source === "cpf" && cpfDig.length === 11) {
        const placasDoCpf = [...new Set(filtradas.filter((r) => r.cpf === cpfDig).map((r) => r.placa).filter(Boolean))];
        if (placasDoCpf.length === 1) inpPlaca.value = placasDoCpf[0];
      } else if (source === "proto" && prevProto) {
        const protoNorm = normNc(prevProto);
        const hit = filtradas.find((r) => r.proto === protoNorm);
        if (hit?.placa) inpPlaca.value = hit.placa;
      }
    }

    if (source !== "proto" && inpProto && filtradas.length === 1) {
      inpProto.value = filtradas[0].proto;
    } else if (source === "cpf" && inpProto && cpfDig.length === 11) {
      const protosDoCpf = filtradas.filter((r) => r.cpf === cpfDig).map((r) => r.proto);
      if (protosDoCpf.length === 1) inpProto.value = protosDoCpf[0];
    } else if (source === "placa" && inpPlaca) {
      const placaQ = normPlate(prevPlaca);
      const protosDaPlaca = filtradas.filter((r) => (r.placa || "").includes(placaQ)).map((r) => r.proto);
      if (protosDaPlaca.length === 1) inpProto.value = protosDaPlaca[0];
    }

    if (inpCpf && source === "cpf" && typeof formatCpf === "function") {
      const d = dig(inpCpf.value).slice(0, 11);
      inpCpf.value = formatCpf(d);
    }

    if (inpPlaca && source === "placa") {
      inpPlaca.value = normPlate(inpPlaca.value);
    }

    const protoNorm = normNc(prevProto);
    if (protoNorm) {
      const hitProto = filtradas.find((r) => r.proto === protoNorm);
      if (hitProto) preencherCamposDeLinha(cfg, hitProto, "proto");
    } else if (source === "placa") {
      const placaQ = normPlate(prevPlaca);
      if (placaQ.length >= 7 && protosParaDatalist.length === 1) {
        preencherCamposDeLinha(cfg, protosParaDatalist[0], "placa");
      }
    }
  }

  function refreshDatalists(cfg) {
    refreshPesquisaAvancada(cfg);
  }

  function bindTipo(cfg) {
    if (state.get(cfg.key)) return;
    state.set(cfg.key, true);

    document.getElementById(cfg.btnId)?.addEventListener("click", async () => {
      if (typeof window.__DK_pullFromCloudOnScreenChange === "function") {
        await window.__DK_pullFromCloudOnScreenChange();
      } else if (typeof window.__DK_portalPullCadastroFromCloud === "function") {
        await window.__DK_portalPullCadastroFromCloud();
      }
      showPanel(cfg);
      hideDetalhe(cfg);
      refreshDatalists(cfg);
      const msg = $(cfg, "InlineMsg");
      if (msg) msg.textContent = "";
    });

    $(cfg, "ConfirmarPesquisaBtn")?.addEventListener("click", (e) => {
      e.preventDefault();
      const msg = $(cfg, "InlineMsg");
      const hit = resolvePesquisa(cfg);
      if (!hit || hit.cpfDigits.length !== 11) {
        hideDetalhe(cfg);
        if (msg) msg.textContent = "Informe nome, CPF, placa ou protocolo válido com locação cadastrada.";
        return;
      }
      if (typeof formatCpf === "function") $(cfg, "Cpf").value = formatCpf(hit.cpfDigits);
      if ($(cfg, "ProtocoloBusca")) $(cfg, "ProtocoloBusca").value = hit.proto;
      const placaHit = normPlate(hit.loc?.placa);
      if ($(cfg, "PlacaBusca") && placaHit) $(cfg, "PlacaBusca").value = placaHit;
      if (msg) msg.textContent = "";
      refreshProtocoloSelect(cfg, { preserveNc: hit.proto });
      showDetalhe(cfg);
    });

    $(cfg, "LimparPesquisaBtn")?.addEventListener("click", (e) => {
      e.preventDefault();
      hideDetalhe(cfg);
      const formId =
        cfg.key === "lancamentoMultas"
          ? "formOperacaoLancamentoMultasInline"
          : "formOperacaoLancamentoManutencaoInline";
      document.getElementById(formId)?.querySelectorAll("input, select").forEach((inp) => {
        if (inp.tagName === "SELECT") return;
        inp.value = "";
      });
      const selQtd = $(cfg, "QtdParcelas");
      if (selQtd) selQtd.value = "1";
      const sel = $(cfg, "ProtocoloSelect");
      if (sel) {
        sel.replaceChildren();
        const o = document.createElement("option");
        o.value = "";
        o.textContent = "—";
        sel.appendChild(o);
        sel.disabled = true;
      }
      const msg = $(cfg, "InlineMsg");
      if (msg) msg.textContent = "";
      if (isParcelado(cfg)) clearParceladoLancamentoForm(cfg);
      refreshPesquisaAvancada(cfg);
    });

    const formPesquisaId =
      cfg.key === "lancamentoMultas" ? "formOperacaoLancamentoMultasInline" : "formOperacaoLancamentoManutencaoInline";
    document.getElementById(formPesquisaId)?.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-lanc-pesquisa-key]");
      if (!btn || btn.getAttribute("data-lanc-pesquisa-key") !== cfg.key) return;
      e.preventDefault();
      aplicarPesquisaLinha(
        cfg,
        btn.getAttribute("data-cpf"),
        btn.getAttribute("data-nome"),
        btn.getAttribute("data-proto"),
        btn.getAttribute("data-placa")
      );
    });

    $(cfg, "Cpf")?.addEventListener("input", () => {
      const msg = $(cfg, "InlineMsg");
      if (msg) msg.textContent = "";
      refreshPesquisaAvancada(cfg, { source: "cpf" });
      hideDetalhe(cfg);
    });
    $(cfg, "Cpf")?.addEventListener("blur", () => refreshPesquisaAvancada(cfg, { source: "cpf" }));

    $(cfg, "NomeBusca")?.addEventListener("input", () => {
      const msg = $(cfg, "InlineMsg");
      if (msg) msg.textContent = "";
      refreshPesquisaAvancada(cfg, { source: "nome" });
      hideDetalhe(cfg);
    });
    $(cfg, "NomeBusca")?.addEventListener("change", () => refreshPesquisaAvancada(cfg, { source: "nome" }));

    $(cfg, "ProtocoloBusca")?.addEventListener("input", () => {
      const msg = $(cfg, "InlineMsg");
      if (msg) msg.textContent = "";
      refreshPesquisaAvancada(cfg, { source: "proto" });
      hideDetalhe(cfg);
    });
    $(cfg, "ProtocoloBusca")?.addEventListener("change", () => refreshPesquisaAvancada(cfg, { source: "proto" }));

    $(cfg, "PlacaBusca")?.addEventListener("input", () => {
      const msg = $(cfg, "InlineMsg");
      if (msg) msg.textContent = "";
      refreshPesquisaAvancada(cfg, { source: "placa" });
      hideDetalhe(cfg);
    });
    $(cfg, "PlacaBusca")?.addEventListener("change", () => refreshPesquisaAvancada(cfg, { source: "placa" }));
    $(cfg, "PlacaBusca")?.addEventListener("blur", () => refreshPesquisaAvancada(cfg, { source: "placa" }));

    $(cfg, "ProtocoloSelect")?.addEventListener("change", () => {
      const sel = $(cfg, "ProtocoloSelect");
      const digits = dig($(cfg, "Cpf")?.value);
      const nc = normNc(sel?.value);
      const loc = collectLocs().find((l) => dig(l.cpf) === digits && normNc(l.numeroContrato) === nc);
      if (loc) applyLocToForm(cfg, loc);
    });

    if (isParcelado(cfg)) {
      const f = pField(cfg);
      const lbl = pLabels(cfg);
      const sk = pStore(cfg);
      [f.qtd, f.primeira, f.valor, f.data].forEach((s) => {
        $(cfg, s)?.addEventListener("input", () => syncParcelasUI(cfg));
        $(cfg, s)?.addEventListener("change", () => syncParcelasUI(cfg));
        $(cfg, s)?.addEventListener("blur", () => syncParcelasUI(cfg));
      });

      document.getElementById(cfg.relatorioBtnElId)?.addEventListener("click", (e) => {
        e.preventDefault();
        const msg = $(cfg, "InlineMsg");
        const digits = dig($(cfg, "Cpf")?.value).slice(0, 11);
        const nc = normNc($(cfg, "ProtocoloSelect")?.value);
        const loc = getCurrentLocForCfg(cfg);
        if (!loc || digits.length !== 11 || !nc) {
          if (msg) msg.textContent = `Confirme a pesquisa e selecione um protocolo com ${lbl.registros}.`;
          return;
        }
        const regs = getRegistrosParcelados(loc, cfg);
        if (!regs.length) {
          if (msg) msg.textContent = lbl.relatorioVazio;
          return;
        }
        if (msg) msg.textContent = "";
        const fn = window[cfg.openRelatorioFn];
        if (typeof fn === "function") {
          const payload = { loc, protocolo: nc };
          if (parceladoTipo(cfg) === "manutencao") payload.manutencoes = regs;
          else payload.multas = regs;
          fn(payload);
        }
      });

      $(cfg, "CadastrarBtn")?.addEventListener("click", (e) => {
        e.preventDefault();
        const msg = $(cfg, "InlineMsg");
        const admin =
          typeof window.__DK_getPortalSessaoAdminRole === "function" && window.__DK_getPortalSessaoAdminRole();
        if (!admin) {
          if (msg) msg.textContent = "Inicie sessão como colaborador ou administrador.";
          return;
        }
        const digits = dig($(cfg, "Cpf")?.value).slice(0, 11);
        const nc = normNc($(cfg, "ProtocoloSelect")?.value);
        const dataReg = String($(cfg, f.data)?.value || "").trim();
        const codReg = String($(cfg, f.cod)?.value || "").trim();
        const descricao = String($(cfg, f.descricao)?.value || "").trim();
        const valorReg = parseVal($(cfg, f.valor)?.value);
        const quantidadeParcelas = clampParcelas($(cfg, f.qtd)?.value);
        const dataPrimeiraParcela = String($(cfg, f.primeira)?.value || "").trim();
        if (digits.length !== 11 || !nc) {
          if (msg) msg.textContent = "Informe CPF e protocolo.";
          return;
        }
        if (!parseBrDateLocal(dataReg)) {
          if (msg) msg.textContent = lbl.dataObrigatoria;
          return;
        }
        if (!codReg) {
          if (msg) msg.textContent = lbl.codObrigatorio;
          return;
        }
        if (!descricao) {
          if (msg) msg.textContent = lbl.descObrigatoria;
          return;
        }
        if (valorReg <= 0) {
          if (msg) msg.textContent = lbl.valorObrigatorio;
          return;
        }
        if (!parseBrDateLocal(dataPrimeiraParcela)) {
          if (msg) msg.textContent = "Informe a data da primeira parcela (DD/MM/AAAA).";
          return;
        }
        const locAtual = getCurrentLocForCfg(cfg);
        const diaPag =
          locAtual && typeof window.__DK_normDiaPagamentoMultas === "function"
            ? window.__DK_normDiaPagamentoMultas(locAtual.diaPagamento || locAtual.diaPagto)
            : "";
        let dataPrimeiraFinal = dataPrimeiraParcela;
        let parcelas = buildCronogramaParcelas(dataPrimeiraFinal, quantidadeParcelas, valorReg);
        if (typeof window.__DK_buildCronogramaMultaRelatorio === "function") {
          const cronInput = { quantidadeParcelas, dataPrimeiraParcela, valorMulta: valorReg, dataMulta: dataReg };
          cronInput[sk.data] = dataReg;
          cronInput[sk.valor] = valorReg;
          const cron = window.__DK_buildCronogramaMultaRelatorio(cronInput, diaPag || "SEG");
          dataPrimeiraFinal = cron.primeira;
          parcelas = cron.parcelas;
        }
        const dataUltimaParcela =
          parcelas.length ? parcelas[parcelas.length - 1].data : calcDataUltimaParcela(dataPrimeiraFinal, quantidadeParcelas);
        const entry = {
          descricao,
          quantidadeParcelas,
          dataPrimeiraParcela: dataPrimeiraFinal,
          dataUltimaParcela,
          parcelas,
        };
        entry[sk.data] = dataReg;
        entry[sk.cod] = codReg;
        entry[sk.valor] = valorReg;
        const texto = `Cadastrar ${lbl.registro} ${codReg} (${descricao}) no valor de ${fmtBrlNum(valorReg)} em ${quantidadeParcelas} parcela(s) (protocolo ${nc})?`;
        const go = () => {
          const ok = persistMultaTransito(cfg, digits, nc, entry);
          if (ok) {
            if (msg) msg.textContent = lbl.registado;
            const loc = collectLocs().find((l) => dig(l.cpf) === digits && normNc(l.numeroContrato) === nc);
            if (loc) applyLocToForm(cfg, loc);
          } else if (msg) msg.textContent = "Não foi possível guardar.";
        };
        if (typeof window.__DK_openPortalLancConfirmModal === "function") {
          window.__DK_openPortalLancConfirmModal(texto, go);
        } else if (window.confirm(texto)) go();
      });

      $(cfg, "LimparLancamentoBtn")?.addEventListener("click", (e) => {
        e.preventDefault();
        clearParceladoLancamentoForm(cfg);
      });
    } else if (!isParcelado(cfg)) {
      ["ValorEspecie", "ValorPix", "ValorCartao"].forEach((s) => {
        $(cfg, s)?.addEventListener("input", () => syncValorPagoFromMeios(cfg));
        $(cfg, s)?.addEventListener("blur", () => syncValorPagoFromMeios(cfg));
      });
    }

    if (isParcelado(cfg)) {
      $(cfg, "VoltarBtn")?.addEventListener("click", (e) => {
        e.preventDefault();
        if (typeof window.__DK_hideOperacaoInlineForms === "function") window.__DK_hideOperacaoInlineForms();
      });
    }

    $(cfg, "ConfirmarPagamentoBtn")?.addEventListener("click", (e) => {
      if (isParcelado(cfg)) return;
      e.preventDefault();
      const msg = $(cfg, "InlineMsg");
      const admin =
        typeof window.__DK_getPortalSessaoAdminRole === "function" && window.__DK_getPortalSessaoAdminRole();
      if (!admin) {
        if (msg) msg.textContent = "Inicie sessão como colaborador ou administrador.";
        return;
      }
      syncValorPagoFromMeios(cfg);
      const digits = dig($(cfg, "Cpf")?.value).slice(0, 11);
      const nc = normNc($(cfg, "ProtocoloSelect")?.value);
      const ve = parseVal($(cfg, "ValorEspecie")?.value);
      const vp = parseVal($(cfg, "ValorPix")?.value);
      const vc = parseVal($(cfg, "ValorCartao")?.value);
      const valorNum = ve + vp + vc;
      const dataStr = String($(cfg, "DataPagamento")?.value || "").trim();
      if (digits.length !== 11 || !nc) {
        if (msg) msg.textContent = "Informe CPF e protocolo.";
        return;
      }
      if (valorNum <= 0) {
        if (msg) msg.textContent = "Informe valor em espécie, Pix e/ou cartão.";
        return;
      }
      const dtp = typeof parseBrDate === "function" ? parseBrDate(dataStr) : null;
      if (!dtp || Number.isNaN(dtp.getTime())) {
        if (msg) msg.textContent = "Informe a data do pagamento (DD/MM/AAAA).";
        return;
      }
      const texto = `Confirmar pagamento de ${cfg.tituloPagamento} no valor de ${fmtBrlNum(valorNum)} em ${dataStr} (protocolo ${nc})?`;
      const go = () => {
        const ok = persistPagamento(cfg, digits, nc, valorNum, dataStr, {
          valorEspecie: ve,
          valorPix: vp,
          valorCartao: vc,
        });
        if (ok) {
          if (msg) msg.textContent = "Pagamento registado.";
          const loc = collectLocs().find((l) => dig(l.cpf) === digits && normNc(l.numeroContrato) === nc);
          if (loc) applyLocToForm(cfg, loc);
        } else if (msg) msg.textContent = "Não foi possível guardar.";
      };
      if (typeof window.__DK_openPortalLancConfirmModal === "function") {
        window.__DK_openPortalLancConfirmModal(texto, go);
      } else if (window.confirm(texto)) go();
    });

    if (!isParcelado(cfg)) {
      $(cfg, "LimparBtn")?.addEventListener("click", (e) => {
        e.preventDefault();
        ["ValorEspecie", "ValorPix", "ValorCartao", "ValorPago", "DataPagamento"].forEach((s) => {
          const el = $(cfg, s);
          if (el) el.value = "";
        });
      });

      $(cfg, "VoltarBtn")?.addEventListener("click", (e) => {
        e.preventDefault();
        if (typeof window.__DK_hideOperacaoInlineForms === "function") window.__DK_hideOperacaoInlineForms();
      });
    }

    $(cfg, "Historico")?.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-lanc-extra-del]");
      if (!btn || btn.getAttribute("data-lanc-extra-del") !== cfg.key) return;
      if (!(typeof window.__DK_isPortalTitularAdministrador === "function" && window.__DK_isPortalTitularAdministrador())) return;
      const idx = Number(btn.getAttribute("data-idx"));
      const digits = dig($(cfg, "Cpf")?.value);
      const nc = normNc($(cfg, "ProtocoloSelect")?.value);
      const locs = loadCadastro(CAD_LOCACOES_KEY);
      const li = locs.findIndex((l) => dig(l.cpf) === digits && normNc(l.numeroContrato) === nc);
      if (li < 0) return;
      const loc = locs[li];
      const arr = isParcelado(cfg) ? getRegistrosParcelados(loc, cfg) : getLancamentos(loc, cfg.arrayField);
      if (idx < 0 || idx >= arr.length) return;
      const confirmTxt = isParcelado(cfg) ? pLabels(cfg).apagar : "Apagar este pagamento?";
      if (!window.confirm(confirmTxt)) return;
      arr.splice(idx, 1);
      loc[cfg.arrayField] = arr.map((x) => ({ ...x }));
      if (persistLancamentos(cfg, locs, loc, digits, nc)) {
        applyLocToForm(cfg, loc);
        const msg = $(cfg, "InlineMsg");
        if (msg) msg.textContent = isParcelado(cfg) ? pLabels(cfg).removido : "Pagamento removido.";
      }
    });
  }

  function init() {
    TIPOS.forEach(bindTipo);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
