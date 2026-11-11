/**
 * Lançamento de multa (Operação) — despesa + pagamento de multa
 * de responsabilidade do cliente, por protocolo.
 * Campo na locação: portalMultaClienteLancamentos[]
 */
(function portalLancamentoMulta() {
  const FIELD = "portalMultaClienteLancamentos";
  const TIPO_DESPESA = "DESPESA_MULTA";
  const TIPO_PAGAMENTO = "PAGAMENTO_MULTA";

  let selected = null; // { cpfDigits, proto, loc }

  function dig(s) {
    return typeof onlyDigits === "function" ? onlyDigits(s) : String(s ?? "").replace(/\D/g, "");
  }

  function normNc(raw) {
    return String(raw ?? "")
      .trim()
      .replace(/\s+/g, "")
      .replace(/[^\d]/g, "");
  }

  function normPlate(raw) {
    if (typeof normalizePlate === "function") return normalizePlate(raw);
    return String(raw || "")
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "");
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

  function escHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function todayBr() {
    try {
      return new Intl.DateTimeFormat("pt-BR", {
        timeZone: "America/Sao_Paulo",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }).format(new Date());
    } catch {
      const d = new Date();
      return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
    }
  }

  function collectLocs() {
    if (typeof loadCadastro !== "function" || typeof CAD_LOCACOES_KEY === "undefined") return [];
    return loadCadastro(CAD_LOCACOES_KEY).filter((l) => normNc(l.numeroContrato));
  }

  function locAtiva(loc) {
    if (typeof window.__DK_isPortalLocacaoAtiva === "function") return Boolean(window.__DK_isPortalLocacaoAtiva(loc));
    const st = String(loc?.statusLocacao || loc?.status || "").toUpperCase();
    if (st === "FINALIZADO" || st === "CANCELADO" || st === "INATIVO") return false;
    const fim = String(loc?.fim || loc?.dataFim || "").trim();
    return !fim;
  }

  function fimBr(loc) {
    const s = String(loc?.fim || loc?.dataFim || "").trim();
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) return s;
    return s || "";
  }

  function getLancamentos(loc) {
    const arr = Array.isArray(loc?.[FIELD]) ? loc[FIELD] : [];
    return arr
      .map((x) => {
        if (!x || typeof x !== "object") return null;
        const tipo = String(x.tipo || "").toUpperCase();
        if (tipo !== TIPO_DESPESA && tipo !== TIPO_PAGAMENTO) return null;
        const data = String(x.data || "").trim();
        if (!/^\d{2}\/\d{2}\/\d{4}$/.test(data)) return null;
        const valor = typeof x.valor === "number" && Number.isFinite(x.valor) ? x.valor : parseVal(x.valor);
        if (!Number.isFinite(valor) || valor <= 0) return null;
        return {
          id: String(x.id || `${tipo}-${data}-${valor}-${x.createdAt || ""}`),
          tipo,
          data,
          valor,
          observacao: String(x.observacao || x.comentario || x.descricao || "").trim(),
          createdAt: Number(x.createdAt) || 0,
          registradoPorCpf: dig(x.registradoPorCpf).slice(0, 11),
          registradoPorNome: String(x.registradoPorNome || "").trim(),
          registradoPorLabel: String(x.registradoPorLabel || "").trim(),
        };
      })
      .filter(Boolean)
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }

  function resumir(lancs) {
    let totalDespesas = 0;
    let totalPago = 0;
    for (const x of lancs || []) {
      if (x.tipo === TIPO_DESPESA) totalDespesas += Number(x.valor) || 0;
      else if (x.tipo === TIPO_PAGAMENTO) totalPago += Number(x.valor) || 0;
    }
    const restante = Math.max(0, totalDespesas - totalPago);
    return { totalDespesas, totalPago, restante };
  }

  function resumoLoc(loc) {
    return resumir(getLancamentos(loc));
  }

  function setMsg(text, isError) {
    const el = document.getElementById("operacaoLancMultaMsg");
    if (!el) return;
    el.textContent = text || "";
    el.classList.toggle("portal-feedback--error", Boolean(isError));
  }

  function show(el, on) {
    if (!el) return;
    el.classList.toggle("hidden", !on);
    if (on) el.removeAttribute("hidden");
    else el.setAttribute("hidden", "");
  }

  function hideWorkspace() {
    selected = null;
    show(document.getElementById("operacaoLancMultaPaneAvulso"), false);
    show(document.getElementById("operacaoLancMultaResumoCompacto"), false);
    const resumoTxt = document.getElementById("operacaoLancMultaResumoTexto");
    if (resumoTxt) resumoTxt.textContent = "";
    const hist = document.getElementById("operacaoLancMultaHistorico");
    if (hist) hist.replaceChildren();
    setMsg("");
  }

  function clearPesquisa() {
    ["operacaoLancMultaNomeBusca", "operacaoLancMultaCpf", "operacaoLancMultaProtocolo", "operacaoLancMultaPlaca"].forEach(
      (id) => {
        const el = document.getElementById(id);
        if (el) el.value = "";
      }
    );
    const lista = document.getElementById("operacaoLancMultaPesquisaLista");
    if (lista) {
      lista.innerHTML = "";
      show(lista, false);
    }
    hideWorkspace();
  }

  function stampOperador() {
    const reg =
      typeof window.__DK_getPortalSessaoParaRegistroLancamento === "function"
        ? window.__DK_getPortalSessaoParaRegistroLancamento()
        : typeof window.__DK_getPortalSessaoParaRegistroLancamentoAluguel === "function"
          ? window.__DK_getPortalSessaoParaRegistroLancamentoAluguel()
          : { cpf: "", nome: "" };
    if (typeof window.__DK_portalStampRegistradoPor === "function") {
      return window.__DK_portalStampRegistradoPor(reg);
    }
    return {
      registradoPorCpf: dig(reg?.cpf).slice(0, 11),
      registradoPorNome: String(reg?.nome || "").trim(),
      registradoPorLabel: String(reg?.nome || "").trim(),
    };
  }

  function pushCloud() {
    if (typeof window.__DK_pushToCloudAfterSave === "function") {
      window.__DK_pushToCloudAfterSave();
    } else if (typeof portalPushCloudSnapshotAfterPersist === "function") {
      portalPushCloudSnapshotAfterPersist();
    } else if (typeof window.__DK_pushCloudSnapshotNow === "function") {
      window.__DK_pushCloudSnapshotNow().catch(() => {});
    }
  }

  function persistLocUpdate(cpfDigits, proto, mutator) {
    if (typeof window.__DK_portalAndroidSomenteLeitura === "function" && window.__DK_portalAndroidSomenteLeitura()) {
      return { ok: false, message: "Android em modo só leitura." };
    }
    if (typeof loadCadastro !== "function" || typeof saveCadastro !== "function" || typeof CAD_LOCACOES_KEY === "undefined") {
      return { ok: false, message: "Cadastro indisponível." };
    }
    const locs = loadCadastro(CAD_LOCACOES_KEY);
    const idx = locs.findIndex((l) => dig(l.cpf) === cpfDigits && normNc(l.numeroContrato) === proto);
    if (idx < 0) return { ok: false, message: "Contrato não encontrado." };
    const loc = { ...locs[idx] };
    mutator(loc);
    locs[idx] = loc;
    try {
      saveCadastro(CAD_LOCACOES_KEY, locs);
    } catch (err) {
      return { ok: false, message: err?.message || "Falha ao gravar." };
    }
    pushCloud();
    return { ok: true, loc };
  }

  function renderResumo(loc) {
    const r = resumoLoc(loc);
    const a = document.getElementById("operacaoLancMultaTotalDespesas");
    const b = document.getElementById("operacaoLancMultaTotalPago");
    const c = document.getElementById("operacaoLancMultaValorRestante");
    if (a) a.textContent = fmtBrl(r.totalDespesas);
    if (b) b.textContent = fmtBrl(r.totalPago);
    if (c) {
      c.textContent = fmtBrl(r.restante);
      c.classList.toggle("portal-lanc-aluguel-pagamento-saldo__valor--total-geral", true);
      if (r.restante > 0.009) c.style.color = "#ff8b8b";
      else c.style.color = "";
    }
  }

  function tipoLabel(tipo) {
    if (tipo === TIPO_DESPESA) return "Despesa multa";
    if (tipo === TIPO_PAGAMENTO) return "Pag. multa";
    return tipo;
  }

  function renderHistorico(loc) {
    const host = document.getElementById("operacaoLancMultaHistorico");
    if (!host) return;
    const lancs = getLancamentos(loc);
    const proto = normNc(loc?.numeroContrato) || "—";
    if (!lancs.length) {
      host.innerHTML = `<p class="subtext">Nenhum lançamento de multa neste protocolo.</p>`;
      return;
    }
    const rows = lancs
      .map((x) => {
        const obs = x.observacao ? escHtml(x.observacao) : "—";
        const valorCls =
          x.tipo === TIPO_DESPESA
            ? "portal-lanc-hist__valor portal-lanc-hist__valor--comentario"
            : "portal-lanc-hist__valor portal-lanc-hist__valor--pago";
        const tipoCls =
          x.tipo === TIPO_DESPESA ? "portal-lanc-hist__tipo" : "portal-lanc-hist__tipo portal-lanc-hist__tipo--credito";
        return `<tr>
          <td>${escHtml(proto)}</td>
          <td class="${tipoCls}">${escHtml(tipoLabel(x.tipo))}</td>
          <td>${escHtml(x.data)}</td>
          <td class="${valorCls}" title="${obs}">${escHtml(fmtBrl(x.valor))}</td>
        </tr>`;
      })
      .join("");
    host.innerHTML = `<table class="portal-lanc-hist"><thead><tr><th>Protocolo</th><th>Tipo</th><th>Data</th><th>Valor</th></tr></thead><tbody>${rows}</tbody></table>`;
  }

  function fillFormsDefaults() {
    const d1 = document.getElementById("operacaoLancMultaDataDespesa");
    const d2 = document.getElementById("operacaoLancMultaDataPagamento");
    const t = todayBr();
    if (d1 && !d1.value) d1.value = t;
    if (d2 && !d2.value) d2.value = t;
  }

  function clearDespesaForm() {
    const v = document.getElementById("operacaoLancMultaValorDespesa");
    const o = document.getElementById("operacaoLancMultaObsDespesa");
    const d = document.getElementById("operacaoLancMultaDataDespesa");
    if (v) v.value = "";
    if (o) o.value = "";
    if (d) d.value = todayBr();
  }

  function clearPagamentoForm() {
    const v = document.getElementById("operacaoLancMultaValorPagamento");
    const o = document.getElementById("operacaoLancMultaObsPagamento");
    const d = document.getElementById("operacaoLancMultaDataPagamento");
    if (v) v.value = "";
    if (o) o.value = "";
    if (d) d.value = todayBr();
  }

  function selectLoc(loc) {
    if (!loc) return;
    const cpfDigits = dig(loc.cpf).slice(0, 11);
    const proto = normNc(loc.numeroContrato);
    let nome = String(loc.nome || loc.cliente || "").trim();
    if (!nome && typeof findClienteByCpfCadastro === "function") {
      nome = String(findClienteByCpfCadastro(cpfDigits)?.nome || "").trim();
    }
    const placa = normPlate(loc.placa);
    selected = { cpfDigits, proto, loc };

    const fmt = typeof formatCpf === "function" ? formatCpf : (d) => d;
    const nomeEl = document.getElementById("operacaoLancMultaNomeBusca");
    const cpfEl = document.getElementById("operacaoLancMultaCpf");
    const protoEl = document.getElementById("operacaoLancMultaProtocolo");
    const placaEl = document.getElementById("operacaoLancMultaPlaca");
    if (nomeEl && nome) nomeEl.value = nome;
    if (cpfEl && cpfDigits.length === 11) cpfEl.value = fmt(cpfDigits);
    if (protoEl) protoEl.value = proto;
    if (placaEl && placa) placaEl.value = placa;

    const refProto = document.getElementById("operacaoLancMultaRefProto");
    const refNome = document.getElementById("operacaoLancMultaRefNome");
    const refPlaca = document.getElementById("operacaoLancMultaRefPlaca");
    if (refProto) refProto.value = proto;
    if (refNome) refNome.value = nome || "—";
    if (refPlaca) refPlaca.value = placa || "—";

    const resumoTxt = document.getElementById("operacaoLancMultaResumoTexto");
    if (resumoTxt) {
      const cpfLbl = cpfDigits.length === 11 ? fmt(cpfDigits) : "—";
      resumoTxt.textContent = `${nome || "—"} · CPF ${cpfLbl} · Protocolo ${proto} · Placa ${placa || "—"}`;
    }
    show(document.getElementById("operacaoLancMultaResumoCompacto"), true);
    show(document.getElementById("operacaoLancMultaPaneAvulso"), true);
    fillFormsDefaults();
    renderResumo(loc);
    renderHistorico(loc);
    setMsg("");
    show(document.getElementById("operacaoLancMultaPesquisaLista"), false);
  }

  function buildLinhasPesquisa() {
    const nomeQ = String(document.getElementById("operacaoLancMultaNomeBusca")?.value || "")
      .trim()
      .toLowerCase();
    const cpfQ = dig(document.getElementById("operacaoLancMultaCpf")?.value).slice(0, 11);
    const protoQ = normNc(document.getElementById("operacaoLancMultaProtocolo")?.value);
    const placaQ = normPlate(document.getElementById("operacaoLancMultaPlaca")?.value);
    if (!nomeQ && cpfQ.length < 3 && !protoQ && placaQ.length < 3) return [];

    const out = [];
    for (const loc of collectLocs()) {
      const cpf = dig(loc.cpf).slice(0, 11);
      if (cpf.length !== 11) continue;
      const proto = normNc(loc.numeroContrato);
      if (!proto) continue;
      let nome = String(loc.nome || loc.cliente || "").trim();
      if (!nome && typeof findClienteByCpfCadastro === "function") {
        nome = String(findClienteByCpfCadastro(cpf)?.nome || "").trim();
      }
      const placa = normPlate(loc.placa);
      if (cpfQ && !cpf.includes(cpfQ)) continue;
      if (protoQ && !proto.includes(protoQ)) continue;
      if (placaQ && !placa.includes(placaQ)) continue;
      if (nomeQ && !nome.toLowerCase().includes(nomeQ)) continue;
      const ativo = locAtiva(loc);
      out.push({
        cpf,
        nome: nome || "(sem nome)",
        proto,
        placa,
        ativo,
        fimBr: fimBr(loc),
        loc,
      });
    }
    const sortFn = window.__DK_sortPortalPesquisaLinhasAtivoPrimeiro;
    return typeof sortFn === "function" ? sortFn(out) : out;
  }

  function renderPesquisaLista(linhas) {
    const panel = document.getElementById("operacaoLancMultaPesquisaLista");
    if (!panel) return;
    const fmt = typeof formatCpf === "function" ? formatCpf : (d) => d;
    if (!linhas.length) {
      panel.innerHTML = "";
      show(panel, false);
      return;
    }
    const slice = linhas.slice(0, 40);
    panel.innerHTML = `<p class="portal-cliente-prefix-list__title">${slice.length === linhas.length ? slice.length : `${slice.length} de ${linhas.length}`} protocolo(s) — clique numa linha:</p><ul class="portal-cliente-prefix-list__ul">${slice
      .map((row) => {
        const placaLbl = row.placa ? ` · ${escHtml(row.placa)}` : "";
        const status = row.ativo ? "ativo" : "inativo";
        const fimLbl = !row.ativo && row.fimBr ? ` · ${escHtml(row.fimBr)}` : "";
        return `<li><button type="button" class="portal-cliente-prefix-list__btn" data-lanc-multa-cpf="${escHtml(row.cpf)}" data-lanc-multa-proto="${escHtml(row.proto)}">${escHtml(row.nome)} · ${escHtml(fmt(row.cpf))} · ${escHtml(row.proto)}${placaLbl} · <strong>${status}</strong>${fimLbl}</button></li>`;
      })
      .join("")}</ul>`;
    show(panel, true);
  }

  function refreshPesquisa() {
    renderPesquisaLista(buildLinhasPesquisa());
  }

  function confirmarPesquisa() {
    const linhas = buildLinhasPesquisa();
    if (!linhas.length) {
      hideWorkspace();
      setMsg("Nenhum contrato encontrado com esses dados.", true);
      renderPesquisaLista([]);
      return;
    }
    if (linhas.length === 1) {
      selectLoc(linhas[0].loc);
      return;
    }
    renderPesquisaLista(linhas);
    setMsg("Vários contratos encontrados — clique numa linha da lista.", false);
  }

  function confirmarDespesa() {
    if (!selected) {
      setMsg("Pesquise e confirme um contrato primeiro.", true);
      return;
    }
    const data = String(document.getElementById("operacaoLancMultaDataDespesa")?.value || "").trim();
    const valor = parseVal(document.getElementById("operacaoLancMultaValorDespesa")?.value);
    const obs = String(document.getElementById("operacaoLancMultaObsDespesa")?.value || "").trim();
    if (!/^\d{2}\/\d{2}\/\d{4}$/.test(data)) {
      setMsg("Informe a data da despesa (DD/MM/AAAA).", true);
      return;
    }
    if (!(valor > 0)) {
      setMsg("Informe o valor da despesa de multa.", true);
      return;
    }
    if (!obs) {
      setMsg("Informe a descrição da multa no campo de observação.", true);
      return;
    }
    const stamp = stampOperador();
    const entry = {
      id: `LM-D-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      tipo: TIPO_DESPESA,
      data,
      valor,
      observacao: obs,
      createdAt: Date.now(),
      ...stamp,
    };
    const r = persistLocUpdate(selected.cpfDigits, selected.proto, (loc) => {
      const arr = getLancamentos(loc);
      arr.unshift(entry);
      loc[FIELD] = arr;
      const sum = resumir(arr);
      loc.portalMultaClienteTotalDespesas = sum.totalDespesas;
      loc.portalMultaClienteTotalPago = sum.totalPago;
      loc.portalMultaClienteValorRestante = sum.restante;
      loc.updatedAt = Date.now();
    });
    if (!r.ok) {
      setMsg(r.message || "Não foi possível gravar a despesa.", true);
      return;
    }
    selected.loc = r.loc;
    clearDespesaForm();
    renderResumo(r.loc);
    renderHistorico(r.loc);
    refreshPendenteCadastroLocacao(r.loc);
    setMsg("Despesa de multa registada.");
  }

  function confirmarPagamento() {
    if (!selected) {
      setMsg("Pesquise e confirme um contrato primeiro.", true);
      return;
    }
    const data = String(document.getElementById("operacaoLancMultaDataPagamento")?.value || "").trim();
    const valor = parseVal(document.getElementById("operacaoLancMultaValorPagamento")?.value);
    const obs = String(document.getElementById("operacaoLancMultaObsPagamento")?.value || "").trim();
    if (!/^\d{2}\/\d{2}\/\d{4}$/.test(data)) {
      setMsg("Informe a data do pagamento (DD/MM/AAAA).", true);
      return;
    }
    if (!(valor > 0)) {
      setMsg("Informe o valor do pagamento de multa.", true);
      return;
    }
    const atual = resumoLoc(selected.loc);
    if (atual.restante <= 0.009) {
      setMsg("Não há valor restante de multa para este protocolo.", true);
      return;
    }
    if (valor - atual.restante > 0.009) {
      setMsg(`O pagamento (R$ ${fmtBrl(valor)}) é maior que o valor restante (${fmtBrl(atual.restante)}).`, true);
      return;
    }
    const stamp = stampOperador();
    const entry = {
      id: `LM-P-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      tipo: TIPO_PAGAMENTO,
      data,
      valor,
      observacao: obs,
      createdAt: Date.now(),
      ...stamp,
    };
    const r = persistLocUpdate(selected.cpfDigits, selected.proto, (loc) => {
      const arr = getLancamentos(loc);
      arr.unshift(entry);
      loc[FIELD] = arr;
      const sum = resumir(arr);
      loc.portalMultaClienteTotalDespesas = sum.totalDespesas;
      loc.portalMultaClienteTotalPago = sum.totalPago;
      loc.portalMultaClienteValorRestante = sum.restante;
      loc.updatedAt = Date.now();
    });
    if (!r.ok) {
      setMsg(r.message || "Não foi possível gravar o pagamento.", true);
      return;
    }
    selected.loc = r.loc;
    clearPagamentoForm();
    renderResumo(r.loc);
    renderHistorico(r.loc);
    refreshPendenteCadastroLocacao(r.loc);
    setMsg("Pagamento de multa registado.");
  }

  function refreshPendenteCadastroLocacao(locOrNull) {
    const wrap = document.getElementById("operacaoLocacaoMultaPendenteWrap");
    const valorEl = document.getElementById("operacaoLocacaoMultaPendenteValor");
    if (!wrap || !valorEl) return;
    let loc = locOrNull;
    if (!loc) {
      const hid = document.getElementById("operacaoLocacaoProtocolo");
      const proto = normNc(hid?.value);
      const cpf = dig(document.getElementById("operacaoLocacaoCpf")?.value).slice(0, 11);
      if (proto && cpf.length === 11) {
        loc = collectLocs().find((l) => dig(l.cpf) === cpf && normNc(l.numeroContrato) === proto) || null;
      }
    }
    const restante = loc ? Number(resumoLoc(loc).restante) || 0 : 0;
    valorEl.value = fmtBrl(restante);
    wrap.classList.toggle("is-zerado", !(restante > 0.009));
    wrap.removeAttribute("hidden");
    wrap.classList.remove("hidden");
  }

  function hideSiblingOperacaoPanels() {
    document.querySelectorAll("#operacaoPainelDireito > .operacao-inline-form").forEach((el) => {
      el.classList.add("hidden");
    });
    const subnav = document.getElementById("operacaoLancAluguelSubnav");
    if (subnav) {
      subnav.classList.add("hidden");
      subnav.setAttribute("hidden", "");
    }
    document.querySelectorAll(".btn-operacao-cmd--sub[data-lanc-aluguel-sub]").forEach((b) => {
      b.classList.remove("is-active");
      b.setAttribute("aria-expanded", "false");
    });
  }

  function openPanel() {
    const panel = document.getElementById("operacaoInlineLancamentoMultas");
    if (!panel) return;
    if (typeof window.__DK_hideOperacaoInlineFormsCore === "function") {
      window.__DK_hideOperacaoInlineFormsCore();
    } else {
      hideSiblingOperacaoPanels();
    }
    const ph = document.getElementById("operacaoFormPlaceholder");
    if (ph) {
      ph.classList.add("hidden");
      ph.setAttribute("aria-hidden", "true");
    }
    panel.classList.remove("hidden");
    if (typeof window.__DK_syncOperacaoCadastroButtons === "function") {
      window.__DK_syncOperacaoCadastroButtons("btn-operacao-lancamento-multas");
    } else {
      const btn = document.getElementById("btn-operacao-lancamento-multas");
      btn?.classList.add("is-active");
      btn?.setAttribute("aria-expanded", "true");
    }
    clearPesquisa();
  }

  function toggleFromButton() {
    const panel = document.getElementById("operacaoInlineLancamentoMultas");
    const jaAberto = panel && !panel.classList.contains("hidden");
    if (jaAberto) {
      if (typeof window.__DK_hideOperacaoInlineFormsCore === "function") {
        window.__DK_hideOperacaoInlineFormsCore();
      } else {
        hideSiblingOperacaoPanels();
        panel.classList.add("hidden");
      }
      const ph = document.getElementById("operacaoFormPlaceholder");
      if (ph) {
        ph.classList.remove("hidden");
        ph.setAttribute("aria-hidden", "false");
      }
      if (typeof window.__DK_syncOperacaoCadastroButtons === "function") {
        window.__DK_syncOperacaoCadastroButtons(null);
      }
      if (typeof window.__DK_portalGuardarTelaAtiva === "function") window.__DK_portalGuardarTelaAtiva("");
      if (typeof window.__DK_portalSairAreaExclusiva === "function") window.__DK_portalSairAreaExclusiva();
      return;
    }
    if (typeof window.__DK_portalAbrirTelaOperacao === "function") {
      window.__DK_portalAbrirTelaOperacao("operacao-lancamento-multas", openPanel);
    } else {
      openPanel();
    }
  }

  function bindMoneyMask(id) {
    const el = document.getElementById(id);
    if (!el || el.dataset.dkMultaMoneyBound === "1") return;
    el.dataset.dkMultaMoneyBound = "1";
    el.addEventListener("blur", () => {
      const n = parseVal(el.value);
      el.value = n > 0 ? fmtBrl(n) : "";
    });
  }

  function bind() {
    document.getElementById("btn-operacao-lancamento-multas")?.addEventListener("click", (e) => {
      e.preventDefault();
      toggleFromButton();
    });
    document.getElementById("operacaoLancMultaConfirmarPesquisaBtn")?.addEventListener("click", (e) => {
      e.preventDefault();
      confirmarPesquisa();
    });
    document.getElementById("operacaoLancMultaLimparPesquisaBtn")?.addEventListener("click", (e) => {
      e.preventDefault();
      clearPesquisa();
    });
    document.getElementById("operacaoLancMultaConfirmarDespesaBtn")?.addEventListener("click", (e) => {
      e.preventDefault();
      confirmarDespesa();
    });
    document.getElementById("operacaoLancMultaConfirmarPagamentoBtn")?.addEventListener("click", (e) => {
      e.preventDefault();
      confirmarPagamento();
    });
    document.getElementById("operacaoLancMultaLimparFormBtn")?.addEventListener("click", (e) => {
      e.preventDefault();
      clearDespesaForm();
      clearPagamentoForm();
      setMsg("");
    });
    document.getElementById("operacaoLancMultaVoltarPesquisaBtn")?.addEventListener("click", (e) => {
      e.preventDefault();
      hideWorkspace();
      setMsg("");
    });

    ["operacaoLancMultaNomeBusca", "operacaoLancMultaCpf", "operacaoLancMultaProtocolo", "operacaoLancMultaPlaca"].forEach(
      (id) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.addEventListener("input", () => {
          if (id === "operacaoLancMultaCpf" && typeof formatCpf === "function") {
            const d = dig(el.value).slice(0, 11);
            el.value = formatCpf(d);
          }
          if (id === "operacaoLancMultaPlaca") {
            el.value = String(el.value || "")
              .toUpperCase()
              .replace(/[^A-Z0-9]/g, "")
              .slice(0, 7);
          }
          if (id === "operacaoLancMultaProtocolo") {
            el.value = dig(el.value).slice(0, 12);
          }
          refreshPesquisa();
        });
        el.addEventListener("keydown", (ev) => {
          if (ev.key === "Enter") {
            ev.preventDefault();
            confirmarPesquisa();
          }
        });
      }
    );

    document.getElementById("operacaoLancMultaPesquisaLista")?.addEventListener("click", (e) => {
      const btn = e.target instanceof Element ? e.target.closest("[data-lanc-multa-cpf][data-lanc-multa-proto]") : null;
      if (!btn) return;
      e.preventDefault();
      const cpf = dig(btn.getAttribute("data-lanc-multa-cpf")).slice(0, 11);
      const proto = normNc(btn.getAttribute("data-lanc-multa-proto"));
      const loc = collectLocs().find((l) => dig(l.cpf) === cpf && normNc(l.numeroContrato) === proto);
      if (loc) selectLoc(loc);
    });

    bindMoneyMask("operacaoLancMultaValorDespesa");
    bindMoneyMask("operacaoLancMultaValorPagamento");
  }

  window.__DK_multaClienteResumoLoc = resumoLoc;
  window.__DK_multaClienteRefreshPendenteCadastro = refreshPendenteCadastroLocacao;
  window.__DK_multaClienteGetLancamentos = getLancamentos;
  window.__DK_openOperacaoLancamentoMulta = openPanel;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bind, { once: true });
  } else {
    bind();
  }
})();
