/**
 * Lançamento de manutenção (Operação) — despesa + pagamento de manutenção
 * de responsabilidade do cliente, por protocolo.
 * Campo na locação: portalManutencaoClienteLancamentos[]
 */
(function portalManutencaoCliente() {
  const FIELD = "portalManutencaoClienteLancamentos";
  const TIPO_DESPESA = "DESPESA_MANUTENCAO";
  const TIPO_PAGAMENTO = "PAGAMENTO_MANUTENCAO";

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
    const el = document.getElementById("operacaoManutClienteMsg");
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

  function ymdSpFromMs(ms) {
    try {
      const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Sao_Paulo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).formatToParts(new Date(ms));
      const y = parts.find((p) => p.type === "year")?.value;
      const m = parts.find((p) => p.type === "month")?.value;
      const d = parts.find((p) => p.type === "day")?.value;
      return `${y}-${m}-${d}`;
    } catch {
      const d = new Date(ms);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    }
  }

  function todayYmdSp() {
    return ymdSpFromMs(Date.now());
  }

  function horaSp(ms) {
    try {
      return new Intl.DateTimeFormat("pt-BR", {
        timeZone: "America/Sao_Paulo",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      }).format(new Date(ms));
    } catch {
      const d = new Date(ms);
      return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
    }
  }

  function dataBrToYmd(br) {
    const m = String(br || "")
      .trim()
      .match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!m) return "";
    return `${m[3]}-${m[2]}-${m[1]}`;
  }

  function nomeClienteLoc(loc) {
    let nome = String(loc?.nome || loc?.cliente || "").trim();
    if (!nome && typeof findClienteByCpfCadastro === "function") {
      nome = String(findClienteByCpfCadastro(dig(loc?.cpf).slice(0, 11))?.nome || "").trim();
    }
    return nome || "—";
  }

  function collectAtividades(filterFn) {
    const out = [];
    for (const loc of collectLocs()) {
      const nome = nomeClienteLoc(loc);
      const placa = normPlate(loc.placa) || "—";
      const proto = normNc(loc.numeroContrato) || "—";
      for (const x of getLancamentos(loc)) {
        const row = {
          executor: String(x.registradoPorLabel || x.registradoPorNome || "").trim() || "—",
          hora: x.createdAt ? horaSp(x.createdAt) : "—",
          createdAt: Number(x.createdAt) || 0,
          cliente: nome,
          placa,
          proto,
          tipo: x.tipo,
          tipoLbl: tipoLabel(x.tipo),
          valor: Number(x.valor) || 0,
          data: x.data,
          observacao: x.observacao || "",
        };
        if (typeof filterFn === "function" && !filterFn(row, x, loc)) continue;
        out.push(row);
      }
    }
    out.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    return out;
  }

  function collectAtividadesDia() {
    const hoje = todayYmdSp();
    return collectAtividades((_row, x) => {
      if (x.createdAt) return ymdSpFromMs(x.createdAt) === hoje;
      return dataBrToYmd(x.data) === hoje;
    });
  }

  function renderAtividadesDia() {
    const body = document.getElementById("operacaoManutClienteDiaLogBody");
    if (!body) return;
    const itens = collectAtividadesDia();
    if (!itens.length) {
      body.innerHTML = `<tr><td colspan="7" class="subtext">Nenhuma atividade de manutenção registada hoje.</td></tr>`;
      return;
    }
    body.innerHTML = itens
      .map(
        (r) => `<tr>
          <td>${escHtml(r.executor)}</td>
          <td>${escHtml(r.hora)}</td>
          <td>${escHtml(r.cliente)}</td>
          <td>${escHtml(r.placa)}</td>
          <td>${escHtml(r.tipoLbl)}</td>
          <td>${escHtml(fmtBrl(r.valor))}</td>
          <td>${escHtml(r.proto)}</td>
        </tr>`
      )
      .join("");
  }

  function syncPreBusca() {
    const pre = document.getElementById("operacaoManutClientePreBusca");
    const showPre = !selected;
    show(pre, showPre);
    if (showPre) renderAtividadesDia();
  }

  function setRelMsg(text, isError) {
    const el = document.getElementById("operacaoManutClienteRelMsg");
    if (!el) return;
    el.textContent = text || "";
    el.classList.toggle("portal-feedback--error", Boolean(isError));
  }

  function gerarRelatorioPeriodo() {
    const de = String(document.getElementById("operacaoManutClienteRelInicio")?.value || "").trim();
    const ate = String(document.getElementById("operacaoManutClienteRelFim")?.value || "").trim();
    const deY = dataBrToYmd(de);
    const ateY = dataBrToYmd(ate);
    if (!deY || !ateY) {
      setRelMsg("Informe data início e data fim (DD/MM/AAAA).", true);
      return;
    }
    if (deY > ateY) {
      setRelMsg("A data início não pode ser depois da data fim.", true);
      return;
    }
    const itens = collectAtividades((row) => {
      const y = dataBrToYmd(row.data);
      return Boolean(y) && y >= deY && y <= ateY;
    }).sort((a, b) => {
      const ya = dataBrToYmd(a.data);
      const yb = dataBrToYmd(b.data);
      if (ya !== yb) return ya < yb ? -1 : 1;
      return (a.createdAt || 0) - (b.createdAt || 0);
    });
    if (!itens.length) {
      setRelMsg("Nenhum lançamento de manutenção neste período.", true);
      return;
    }
    setRelMsg(`${itens.length} lançamento(s) — abrindo relatório…`, false);
    const totDesp = itens.filter((r) => r.tipo === TIPO_DESPESA).reduce((s, r) => s + r.valor, 0);
    const totPag = itens.filter((r) => r.tipo === TIPO_PAGAMENTO).reduce((s, r) => s + r.valor, 0);
    const rowsHtml = itens
      .map(
        (r) => `<tr>
          <td>${escHtml(r.data)}</td>
          <td>${escHtml(r.hora)}</td>
          <td>${escHtml(r.executor)}</td>
          <td>${escHtml(r.cliente)}</td>
          <td>${escHtml(r.placa)}</td>
          <td>${escHtml(r.proto)}</td>
          <td>${escHtml(r.tipoLbl)}</td>
          <td>${escHtml(fmtBrl(r.valor))}</td>
          <td>${escHtml(r.observacao || "—")}</td>
        </tr>`
      )
      .join("");
    const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Relatório de manutenção ${escHtml(de)} a ${escHtml(ate)}</title>
      <style>
        body{font-family:Arial,sans-serif;color:#111;padding:1.2rem}
        h1{font-size:1.15rem;margin:0 0 .35rem}
        p{margin:0 0 .85rem;font-size:.9rem}
        table{width:100%;border-collapse:collapse;font-size:.85rem}
        th,td{border:1px solid #ccc;padding:.4rem .5rem;text-align:left}
        th{background:#f3f3f3}
        @page{size:A4 landscape;margin:10mm}
        @media print{button{display:none}}
      </style></head><body>
      <h1>Relatório de manutenção por período</h1>
      <p>Período ${escHtml(de)} a ${escHtml(ate)}. Grupo DK Empreendimentos.</p>
      <p>Despesas: <strong>${escHtml(fmtBrl(totDesp))}</strong> · Pagamentos: <strong>${escHtml(fmtBrl(totPag))}</strong> · Lançamentos: <strong>${itens.length}</strong></p>
      <table><thead><tr>
        <th>Data</th><th>Hora registo</th><th>Executor</th><th>Cliente</th><th>Placa</th><th>Protocolo</th><th>Tipo</th><th>Valor</th><th>Observação</th>
      </tr></thead><tbody>${rowsHtml}</tbody></table>
      <p><button type="button" onclick="window.print()">Imprimir</button></p>
      </body></html>`;
    const w = window.open("", "_blank");
    if (!w) {
      setRelMsg("Permita pop-ups para abrir o relatório.", true);
      return;
    }
    w.document.write(html);
    w.document.close();
  }

  function hideWorkspace() {
    selected = null;
    show(document.getElementById("operacaoManutClientePaneAvulso"), false);
    show(document.getElementById("operacaoManutClienteResumoCompacto"), false);
    const resumoTxt = document.getElementById("operacaoManutClienteResumoTexto");
    if (resumoTxt) resumoTxt.textContent = "";
    const hist = document.getElementById("operacaoManutClienteHistorico");
    if (hist) hist.replaceChildren();
    setMsg("");
    syncPreBusca();
  }

  function clearPesquisa() {
    ["operacaoManutClienteNomeBusca", "operacaoManutClienteCpf", "operacaoManutClienteProtocolo", "operacaoManutClientePlaca"].forEach(
      (id) => {
        const el = document.getElementById(id);
        if (el) el.value = "";
      }
    );
    const lista = document.getElementById("operacaoManutClientePesquisaLista");
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
    const a = document.getElementById("operacaoManutClienteTotalDespesas");
    const b = document.getElementById("operacaoManutClienteTotalPago");
    const c = document.getElementById("operacaoManutClienteValorRestante");
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
    if (tipo === TIPO_DESPESA) return "Despesa manut.";
    if (tipo === TIPO_PAGAMENTO) return "Pag. manutenção";
    return tipo;
  }

  function renderHistorico(loc) {
    const host = document.getElementById("operacaoManutClienteHistorico");
    if (!host) return;
    const lancs = getLancamentos(loc);
    const proto = normNc(loc?.numeroContrato) || "—";
    if (!lancs.length) {
      host.innerHTML = `<p class="subtext">Nenhum lançamento de manutenção neste protocolo.</p>`;
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
    const d1 = document.getElementById("operacaoManutClienteDataDespesa");
    const d2 = document.getElementById("operacaoManutClienteDataPagamento");
    const t = todayBr();
    if (d1 && !d1.value) d1.value = t;
    if (d2 && !d2.value) d2.value = t;
  }

  function clearDespesaForm() {
    const v = document.getElementById("operacaoManutClienteValorDespesa");
    const o = document.getElementById("operacaoManutClienteObsDespesa");
    const d = document.getElementById("operacaoManutClienteDataDespesa");
    if (v) v.value = "";
    if (o) o.value = "";
    if (d) d.value = todayBr();
  }

  function clearPagamentoForm() {
    const v = document.getElementById("operacaoManutClienteValorPagamento");
    const o = document.getElementById("operacaoManutClienteObsPagamento");
    const d = document.getElementById("operacaoManutClienteDataPagamento");
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
    const nomeEl = document.getElementById("operacaoManutClienteNomeBusca");
    const cpfEl = document.getElementById("operacaoManutClienteCpf");
    const protoEl = document.getElementById("operacaoManutClienteProtocolo");
    const placaEl = document.getElementById("operacaoManutClientePlaca");
    if (nomeEl && nome) nomeEl.value = nome;
    if (cpfEl && cpfDigits.length === 11) cpfEl.value = fmt(cpfDigits);
    if (protoEl) protoEl.value = proto;
    if (placaEl && placa) placaEl.value = placa;

    const refProto = document.getElementById("operacaoManutClienteRefProto");
    const refNome = document.getElementById("operacaoManutClienteRefNome");
    const refPlaca = document.getElementById("operacaoManutClienteRefPlaca");
    if (refProto) refProto.value = proto;
    if (refNome) refNome.value = nome || "—";
    if (refPlaca) refPlaca.value = placa || "—";

    const resumoTxt = document.getElementById("operacaoManutClienteResumoTexto");
    if (resumoTxt) {
      const cpfLbl = cpfDigits.length === 11 ? fmt(cpfDigits) : "—";
      resumoTxt.textContent = `${nome || "—"} · CPF ${cpfLbl} · Protocolo ${proto} · Placa ${placa || "—"}`;
    }
    show(document.getElementById("operacaoManutClienteResumoCompacto"), true);
    show(document.getElementById("operacaoManutClientePaneAvulso"), true);
    fillFormsDefaults();
    renderResumo(loc);
    renderHistorico(loc);
    setMsg("");
    show(document.getElementById("operacaoManutClientePesquisaLista"), false);
    syncPreBusca();
  }

  function buildLinhasPesquisa() {
    const nomeQ = String(document.getElementById("operacaoManutClienteNomeBusca")?.value || "")
      .trim()
      .toLowerCase();
    const cpfQ = dig(document.getElementById("operacaoManutClienteCpf")?.value).slice(0, 11);
    const protoQ = normNc(document.getElementById("operacaoManutClienteProtocolo")?.value);
    const placaQ = normPlate(document.getElementById("operacaoManutClientePlaca")?.value);
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
    const panel = document.getElementById("operacaoManutClientePesquisaLista");
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
        return `<li><button type="button" class="portal-cliente-prefix-list__btn" data-manut-cli-cpf="${escHtml(row.cpf)}" data-manut-cli-proto="${escHtml(row.proto)}">${escHtml(row.nome)} · ${escHtml(fmt(row.cpf))} · ${escHtml(row.proto)}${placaLbl} · <strong>${status}</strong>${fimLbl}</button></li>`;
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
    const data = String(document.getElementById("operacaoManutClienteDataDespesa")?.value || "").trim();
    const valor = parseVal(document.getElementById("operacaoManutClienteValorDespesa")?.value);
    const obs = String(document.getElementById("operacaoManutClienteObsDespesa")?.value || "").trim();
    if (!/^\d{2}\/\d{2}\/\d{4}$/.test(data)) {
      setMsg("Informe a data da despesa (DD/MM/AAAA).", true);
      return;
    }
    if (!(valor > 0)) {
      setMsg("Informe o valor da despesa de manutenção.", true);
      return;
    }
    if (!obs) {
      setMsg("Informe a descrição da manutenção no campo de observação.", true);
      return;
    }
    const stamp = stampOperador();
    const entry = {
      id: `MC-D-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
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
      loc.portalManutencaoClienteTotalDespesas = sum.totalDespesas;
      loc.portalManutencaoClienteTotalPago = sum.totalPago;
      loc.portalManutencaoClienteValorRestante = sum.restante;
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
    renderAtividadesDia();
    setMsg("Despesa de manutenção registada.");
  }

  function confirmarPagamento() {
    if (!selected) {
      setMsg("Pesquise e confirme um contrato primeiro.", true);
      return;
    }
    const data = String(document.getElementById("operacaoManutClienteDataPagamento")?.value || "").trim();
    const valor = parseVal(document.getElementById("operacaoManutClienteValorPagamento")?.value);
    const obs = String(document.getElementById("operacaoManutClienteObsPagamento")?.value || "").trim();
    if (!/^\d{2}\/\d{2}\/\d{4}$/.test(data)) {
      setMsg("Informe a data do pagamento (DD/MM/AAAA).", true);
      return;
    }
    if (!(valor > 0)) {
      setMsg("Informe o valor do pagamento de manutenção.", true);
      return;
    }
    const atual = resumoLoc(selected.loc);
    if (atual.restante <= 0.009) {
      setMsg("Não há valor restante de manutenção para este protocolo.", true);
      return;
    }
    if (valor - atual.restante > 0.009) {
      setMsg(`O pagamento (R$ ${fmtBrl(valor)}) é maior que o valor restante (${fmtBrl(atual.restante)}).`, true);
      return;
    }
    const stamp = stampOperador();
    const entry = {
      id: `MC-P-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
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
      loc.portalManutencaoClienteTotalDespesas = sum.totalDespesas;
      loc.portalManutencaoClienteTotalPago = sum.totalPago;
      loc.portalManutencaoClienteValorRestante = sum.restante;
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
    renderAtividadesDia();
    setMsg("Pagamento de manutenção registado.");
  }

  function refreshPendenteCadastroLocacao(locOrNull) {
    const wrap = document.getElementById("operacaoLocacaoManutClientePendenteWrap");
    const valorEl = document.getElementById("operacaoLocacaoManutClientePendenteValor");
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
    const panel = document.getElementById("operacaoInlineManutencaoCliente");
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
      window.__DK_syncOperacaoCadastroButtons("btn-operacao-manutencao-cliente");
    } else {
      const btn = document.getElementById("btn-operacao-manutencao-cliente");
      btn?.classList.add("is-active");
      btn?.setAttribute("aria-expanded", "true");
    }
    clearPesquisa();
  }

  function toggleFromButton() {
    const panel = document.getElementById("operacaoInlineManutencaoCliente");
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
      window.__DK_portalAbrirTelaOperacao("operacao-manutencao-cliente", openPanel);
    } else {
      openPanel();
    }
  }

  function bindMoneyMask(id) {
    const el = document.getElementById(id);
    if (!el || el.dataset.dkManutMoneyBound === "1") return;
    el.dataset.dkManutMoneyBound = "1";
    el.addEventListener("blur", () => {
      const n = parseVal(el.value);
      el.value = n > 0 ? fmtBrl(n) : "";
    });
  }

  function bind() {
    document.getElementById("btn-operacao-manutencao-cliente")?.addEventListener("click", (e) => {
      e.preventDefault();
      toggleFromButton();
    });
    document.getElementById("operacaoManutClienteConfirmarPesquisaBtn")?.addEventListener("click", (e) => {
      e.preventDefault();
      confirmarPesquisa();
    });
    document.getElementById("operacaoManutClienteLimparPesquisaBtn")?.addEventListener("click", (e) => {
      e.preventDefault();
      clearPesquisa();
    });
    document.getElementById("operacaoManutClienteConfirmarDespesaBtn")?.addEventListener("click", (e) => {
      e.preventDefault();
      confirmarDespesa();
    });
    document.getElementById("operacaoManutClienteConfirmarPagamentoBtn")?.addEventListener("click", (e) => {
      e.preventDefault();
      confirmarPagamento();
    });
    document.getElementById("operacaoManutClienteLimparFormBtn")?.addEventListener("click", (e) => {
      e.preventDefault();
      clearDespesaForm();
      clearPagamentoForm();
      setMsg("");
    });
    document.getElementById("operacaoManutClienteVoltarPesquisaBtn")?.addEventListener("click", (e) => {
      e.preventDefault();
      hideWorkspace();
      setMsg("");
    });
    document.getElementById("operacaoManutClienteRelGerarBtn")?.addEventListener("click", (e) => {
      e.preventDefault();
      gerarRelatorioPeriodo();
    });

    ["operacaoManutClienteNomeBusca", "operacaoManutClienteCpf", "operacaoManutClienteProtocolo", "operacaoManutClientePlaca"].forEach(
      (id) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.addEventListener("input", () => {
          if (id === "operacaoManutClienteCpf" && typeof formatCpf === "function") {
            const d = dig(el.value).slice(0, 11);
            el.value = formatCpf(d);
          }
          if (id === "operacaoManutClientePlaca") {
            el.value = String(el.value || "")
              .toUpperCase()
              .replace(/[^A-Z0-9]/g, "")
              .slice(0, 7);
          }
          if (id === "operacaoManutClienteProtocolo") {
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

    document.getElementById("operacaoManutClientePesquisaLista")?.addEventListener("click", (e) => {
      const btn = e.target instanceof Element ? e.target.closest("[data-manut-cli-cpf][data-manut-cli-proto]") : null;
      if (!btn) return;
      e.preventDefault();
      const cpf = dig(btn.getAttribute("data-manut-cli-cpf")).slice(0, 11);
      const proto = normNc(btn.getAttribute("data-manut-cli-proto"));
      const loc = collectLocs().find((l) => dig(l.cpf) === cpf && normNc(l.numeroContrato) === proto);
      if (loc) selectLoc(loc);
    });

    bindMoneyMask("operacaoManutClienteValorDespesa");
    bindMoneyMask("operacaoManutClienteValorPagamento");
  }

  window.__DK_manutClienteResumoLoc = resumoLoc;
  window.__DK_manutClienteRefreshPendenteCadastro = refreshPendenteCadastroLocacao;
  window.__DK_manutClienteGetLancamentos = getLancamentos;
  window.__DK_openOperacaoManutencaoCliente = openPanel;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bind, { once: true });
  } else {
    bind();
  }
})();
