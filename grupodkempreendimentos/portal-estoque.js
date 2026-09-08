/**
 * Controle de Estoque — planilha, saída com resumo da última aplicação e relatórios.
 */
(function portalEstoqueUi() {
  const $ = (id) => document.getElementById(id);

  function escapeHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function nkBar(v) {
    return String(v || "").replace(/\D/g, "");
  }

  function codigoValido(v) {
    const d = nkBar(v);
    return d.length >= 8;
  }

  function nkPlate(v) {
    if (typeof normalizePlate === "function") return normalizePlate(String(v || ""));
    return String(v || "")
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "");
  }

  function formatPlateOut(v) {
    const n = nkPlate(v);
    if (n.length === 7) return `${n.slice(0, 3)}${n.slice(3, 4)}${n.slice(4)}`;
    return String(v || "").trim() || n;
  }

  function parseKm(v) {
    const n = Number(String(v || "").replace(/\D/g, ""));
    return Number.isFinite(n) ? n : 0;
  }

  function parseQtd(v) {
    if (typeof v === "number" && Number.isFinite(v)) return v;
    const s = String(v ?? "")
      .replace(/\s/g, "")
      .replace(/\./g, "")
      .replace(",", ".");
    const n = Number(s);
    return Number.isFinite(n) ? n : 0;
  }

  function parsePreco(v) {
    if (typeof v === "number" && Number.isFinite(v)) return v;
    const s = String(v ?? "")
      .replace(/R\$/gi, "")
      .replace(/\s/g, "")
      .replace(/\./g, "")
      .replace(",", ".");
    const n = Number(s);
    return Number.isFinite(n) ? n : 0;
  }

  function formatMoney(n) {
    if (n == null || !Number.isFinite(Number(n))) return "—";
    return Number(n).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }

  function formatNum(n, dec) {
    if (n == null || !Number.isFinite(Number(n))) return "—";
    return Number(n).toLocaleString("pt-BR", {
      minimumFractionDigits: dec || 0,
      maximumFractionDigits: dec || 0,
    });
  }

  function parseDataBr(v) {
    const t = String(v || "").trim();
    if (!t) return null;
    if (typeof parseBrDate === "function") {
      const d = parseBrDate(t.replace(/-/g, "/"));
      if (d && !Number.isNaN(d.getTime())) return d;
    }
    const m = t.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
    if (!m) return null;
    const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
    return Number.isNaN(d.getTime()) ? null : d;
  }

  function formatDataTraco(d) {
    if (!(d instanceof Date) || Number.isNaN(d.getTime())) return "";
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    return `${dd}-${mm}-${d.getFullYear()}`;
  }

  function formatDataBarra(d) {
    if (!(d instanceof Date) || Number.isNaN(d.getTime())) return "";
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    return `${dd}/${mm}/${d.getFullYear()}`;
  }

  function diasEntre(a, b) {
    if (!(a instanceof Date) || !(b instanceof Date)) return null;
    const x = new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime();
    const y = new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime();
    return Math.round((y - x) / 86400000);
  }

  function hojeBr() {
    const d = new Date();
    return formatDataBarra(d);
  }

  function media(lista) {
    const nums = (lista || []).filter((n) => Number.isFinite(n));
    if (!nums.length) return null;
    return nums.reduce((a, b) => a + b, 0) / nums.length;
  }

  function planilha() {
    return window.__DK_ESTOQUE_PLANILHA && typeof window.__DK_ESTOQUE_PLANILHA === "object"
      ? window.__DK_ESTOQUE_PLANILHA
      : { cadastro: [], estoque: [], entradas: [], saidas: [] };
  }

  function saidasTodas() {
    const base = Array.isArray(planilha().saidas) ? planilha().saidas : [];
    let extra = [];
    try {
      extra = JSON.parse(localStorage.getItem("dk_estoque_saidas_v1") || "[]");
    } catch {
      extra = [];
    }
    return base.concat(Array.isArray(extra) ? extra : []).filter((s) => codigoValido(s.codigo));
  }

  function cadastroTodos() {
    const rows = Array.isArray(planilha().cadastro) ? planilha().cadastro : [];
    return rows.filter((r) => codigoValido(r.codigo));
  }

  function estoqueTodos() {
    const seen = new Set();
    const rows = Array.isArray(planilha().estoque) ? planilha().estoque : [];
    const out = [];
    for (const r of rows) {
      if (!codigoValido(r.codigo)) continue;
      const k = nkBar(r.codigo);
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(r);
    }
    return out;
  }

  function extrasEntradas() {
    try {
      const extra = JSON.parse(localStorage.getItem("dk_estoque_entradas_v1") || "[]");
      return Array.isArray(extra) ? extra : [];
    } catch {
      return [];
    }
  }

  function entradasTodas() {
    const base = Array.isArray(planilha().entradas) ? planilha().entradas : [];
    return extrasEntradas().concat(base).filter((r) => codigoValido(r.codigo) || String(r.descricao || "").trim());
  }

  function qtdExtraEntrada(codigo) {
    const key = nkBar(codigo);
    if (!key) return 0;
    return extrasEntradas().reduce((acc, r) => acc + (nkBar(r.codigo) === key ? parseQtd(r.quantidade) : 0), 0);
  }

  function estoqueAndroidSomenteLeitura() {
    return document.body.classList.contains("portal-plataforma-android");
  }

  function cadastroDoCodigo(codigo) {
    const key = nkBar(codigo);
    if (!key) return null;
    return cadastroTodos().find((r) => nkBar(r.codigo) === key) || null;
  }

  function estoqueDoCodigo(codigo) {
    const key = nkBar(codigo);
    if (!key) return null;
    return estoqueTodos().find((r) => nkBar(r.codigo) === key) || null;
  }

  function precoDoCodigo(codigo) {
    const cad = cadastroDoCodigo(codigo);
    const pCad = parsePreco(cad?.preco);
    if (pCad > 0) return pCad;
    const est = estoqueDoCodigo(codigo);
    const pEst = parsePreco(est?.preco);
    return pEst > 0 ? pEst : 0;
  }

  function ultimaAplicacao(codigo, placa) {
    const bar = nkBar(codigo);
    if (!bar) return null;
    const plate = nkPlate(placa);
    const lista = saidasTodas()
      .filter((s) => nkBar(s.codigo) === bar)
      .map((s) => ({
        ...s,
        _data: parseDataBr(s.data),
        _plate: nkPlate(s.placa),
      }))
      .filter((s) => s._data);
    lista.sort((a, b) => b._data.getTime() - a._data.getTime());
    if (!lista.length) return null;
    const mesma = plate ? lista.find((s) => s._plate === plate) : null;
    return mesma || lista[0];
  }

  function montarResumo(ultima, placaAtual, kmAtual, dataAtual) {
    const dataUlt = formatDataTraco(ultima._data) || String(ultima.data || "").replace(/\//g, "-");
    const placaUlt = formatPlateOut(ultima.placa);
    const kmUlt = parseKm(ultima.km);
    const kmNow = parseKm(kmAtual);
    const dataNow = parseDataBr(dataAtual) || new Date();
    const dias = diasEntre(ultima._data, dataNow);
    const mesmaPlaca = nkPlate(placaAtual) && nkPlate(placaAtual) === ultima._plate;
    const kmDurou = mesmaPlaca && kmUlt > 0 && kmNow > 0 ? kmNow - kmUlt : null;
    const linha1 = `ESTE PRODUTO FOI APLICADO DIA ${dataUlt} NA PLACA ${placaUlt}, NO MOMENTO DA APLICAÇÃO O KM ERA ${
      kmUlt > 0 ? String(kmUlt) : "—"
    }.`;
    let linha2 = "";
    if (dias != null && kmDurou != null) {
      const dTxt = Math.abs(dias) === 1 ? "1 DIA" : `${dias} DIAS`;
      const kTxt = Math.abs(kmDurou) === 1 ? "1 KM" : `${kmDurou} KM`;
      linha2 = `ESTE ITEM DUROU ${dTxt} E ${kTxt}.`;
    } else if (dias != null) {
      const dTxt = Math.abs(dias) === 1 ? "1 DIA" : `${dias} DIAS`;
      linha2 = `ESTE ITEM DUROU ${dTxt}.`;
    }
    return { linha1, linha2 };
  }

  function abrirResumo(html) {
    const modal = $("estoqueSaidaResumoModal");
    const corpo = $("estoqueSaidaResumoCorpo");
    if (!modal || !corpo) return;
    corpo.innerHTML = html;
    modal.classList.remove("hidden");
    modal.setAttribute("aria-hidden", "false");
  }

  function fecharResumo() {
    const modal = $("estoqueSaidaResumoModal");
    if (!modal) return;
    modal.classList.add("hidden");
    modal.setAttribute("aria-hidden", "true");
  }

  function conferirUltimaAplicacao(opts) {
    const silencioso = opts && opts.silencioso === true;
    const codigo = $("estoqueSaidaCodigo")?.value || "";
    const placa = $("estoqueSaidaPlaca")?.value || "";
    const km = $("estoqueSaidaKm")?.value || "";
    const data = $("estoqueSaidaData")?.value || hojeBr();
    const msg = $("estoqueSaidaFormMsg");
    if (!nkBar(codigo)) {
      if (!silencioso && msg) msg.textContent = "Informe o código de barras do produto.";
      return false;
    }
    if (!nkPlate(placa) || !parseKm(km)) {
      if (!silencioso && msg) msg.textContent = "Informe a placa e o km antes de conferir o produto.";
      return false;
    }
    const ultima = ultimaAplicacao(codigo, placa);
    if (!ultima) {
      if (!silencioso && msg) msg.textContent = "Este produto ainda não tem aplicação registada nesta placa.";
      return false;
    }
    if (msg) msg.textContent = "";
    const resumo = montarResumo(ultima, placa, km, data);
    abrirResumo(
      `<p>${escapeHtml(resumo.linha1)}</p>${
        resumo.linha2 ? `<p class="portal-estoque-saida-resumo__durou">${escapeHtml(resumo.linha2)}</p>` : ""
      }`
    );
    return true;
  }

  function preencherProduto() {
    const cad = cadastroDoCodigo($("estoqueSaidaCodigo")?.value || "");
    const desc = $("estoqueSaidaDescricao");
    const ref = $("estoqueSaidaReferencia");
    if (desc) desc.value = cad ? String(cad.descricao || "") : "";
    if (ref) ref.value = cad ? String(cad.referencia || "") : "";
    const placa = nkPlate($("estoqueSaidaPlaca")?.value || "");
    if (placa) {
      const ultPlaca = saidasTodas()
        .filter((s) => nkPlate(s.placa) === placa)
        .sort((a, b) => {
          const da = parseDataBr(a.data);
          const db = parseDataBr(b.data);
          return (db ? db.getTime() : 0) - (da ? da.getTime() : 0);
        })[0];
      const veic = $("estoqueSaidaVeiculo");
      if (veic && !String(veic.value || "").trim() && ultPlaca?.veiculo) {
        veic.value = String(ultPlaca.veiculo);
      }
    }
  }

  function renderTabelaSaidas() {
    const body = $("estoqueBodySaida");
    if (!body) return;
    const rows = saidasTodas()
      .slice()
      .sort((a, b) => {
        const da = parseDataBr(a.data);
        const db = parseDataBr(b.data);
        return (db ? db.getTime() : 0) - (da ? da.getTime() : 0);
      });
    if (!rows.length) {
      body.innerHTML = `<tr><td colspan="8" class="subtext">Nenhuma saída registada.</td></tr>`;
      return;
    }
    body.innerHTML = rows
      .map(
        (s) =>
          `<tr><td>${escapeHtml(s.codigo || "")}</td><td>${escapeHtml(s.descricao || "")}</td><td>${escapeHtml(
            s.referencia || ""
          )}</td><td>${escapeHtml(String(s.quantidade ?? ""))}</td><td>${escapeHtml(
            s.placa || ""
          )}</td><td>${escapeHtml(s.veiculo || "")}</td><td>${escapeHtml(String(s.km ?? ""))}</td><td>${escapeHtml(
            s.data || ""
          )}</td></tr>`
      )
      .join("");
  }

  function renderTabelaCadastro() {
    const body = $("estoqueBodyCadastro");
    if (!body) return;
    const rows = cadastroTodos().slice().sort((a, b) => String(a.descricao || "").localeCompare(String(b.descricao || ""), "pt"));
    if (!rows.length) {
      body.innerHTML = `<tr><td colspan="6" class="subtext">Nenhum material na planilha.</td></tr>`;
      return;
    }
    body.innerHTML = rows
      .map((r) => {
        const preco = parsePreco(r.preco);
        return `<tr><td>${escapeHtml(r.codigo || "")}</td><td>${escapeHtml(r.descricao || "")}</td><td>${escapeHtml(
          r.referencia || ""
        )}</td><td>${escapeHtml(r.fabricante || "")}</td><td>${preco > 0 ? formatMoney(preco) : "—"}</td><td>${escapeHtml(
          r.setor || ""
        )}</td></tr>`;
      })
      .join("");
  }

  function renderTabelaEstoque() {
    const body = $("estoqueBodySaldo");
    if (!body) return;
    const rows = estoqueTodos().slice().sort((a, b) => String(a.descricao || "").localeCompare(String(b.descricao || ""), "pt"));
    if (!rows.length) {
      body.innerHTML = `<tr><td colspan="11" class="subtext">Nenhum saldo na planilha.</td></tr>`;
      return;
    }
    body.innerHTML = rows
      .map((r) => {
        const preco = parsePreco(r.preco);
        const total = parsePreco(r.total) || preco * parseQtd(r.qt);
        const extraEnt = qtdExtraEntrada(r.codigo);
        const entradas = parseQtd(r.entradas) + extraEnt;
        const saldo = parseQtd(r.saldo != null ? r.saldo : r.qt) + extraEnt;
        return `<tr><td>${escapeHtml(r.codigo || "")}</td><td>${escapeHtml(r.descricao || "")}</td><td>${escapeHtml(
          r.referencia || ""
        )}</td><td>${escapeHtml(r.fabricante || "")}</td><td>${escapeHtml(String(r.qt ?? ""))}</td><td>${
          preco > 0 ? formatMoney(preco) : "—"
        }</td><td>${total > 0 ? formatMoney(total) : "—"}</td><td>${escapeHtml(r.setor || "")}</td><td>${escapeHtml(
          String(entradas)
        )}</td><td>${escapeHtml(String(r.saidas ?? ""))}</td><td>${escapeHtml(String(saldo))}</td></tr>`;
      })
      .join("");
  }

  function renderTabelaEntradas() {
    const body = $("estoqueBodyEntrada");
    if (!body) return;
    const rows = entradasTodas()
      .slice()
      .sort((a, b) => {
        const da = parseDataBr(a.data);
        const db = parseDataBr(b.data);
        return (db ? db.getTime() : 0) - (da ? da.getTime() : 0);
      });
    if (!rows.length) {
      body.innerHTML = `<tr><td colspan="9" class="subtext">Nenhuma entrada na planilha.</td></tr>`;
      return;
    }
    body.innerHTML = rows
      .map(
        (r) =>
          `<tr><td>${escapeHtml(r.codigo || "")}</td><td>${escapeHtml(r.descricao || "")}</td><td>${escapeHtml(
            r.referencia || ""
          )}</td><td>${escapeHtml(String(r.quantidade ?? ""))}</td><td>${escapeHtml(
            r.fornecedor || ""
          )}</td><td>${escapeHtml(r.data || "")}</td><td>${escapeHtml(r.notaFiscal || "")}</td><td>${
            parsePreco(r.valorNota) > 0 ? formatMoney(parsePreco(r.valorNota)) : escapeHtml(r.valorNota || "")
          }</td><td>${escapeHtml(r.formaPagamento || "")}</td></tr>`
      )
      .join("");
  }

  function atualizarKpis() {
    const cad = $("estoqueKpiCadastros");
    const sai = $("estoqueKpiSaidas");
    const ent = $("estoqueKpiEntradas");
    if (cad) cad.textContent = String(cadastroTodos().length);
    if (sai) sai.textContent = String(saidasTodas().length);
    if (ent) ent.textContent = String(entradasTodas().length);
    const aviso = $("estoquePlanilhaAviso");
    const fonte = planilha().fonte;
    if (aviso && fonte) {
      aviso.innerHTML = `Fonte carregada: <strong>${escapeHtml(fonte)}</strong> — ${cadastroTodos().length} materiais, ${estoqueTodos().length} saldos, ${entradasTodas().length} entradas e ${saidasTodas().length} saídas.`;
    }
  }

  function opcoesCodigoHtml() {
    return cadastroTodos()
      .map((r) => {
        const cod = String(r.codigo || "");
        const desc = String(r.descricao || "");
        return `<option value="${escapeHtml(cod)}" label="${escapeHtml(desc)}"></option>`;
      })
      .join("");
  }

  function preencherDatalist() {
    const list = $("estoqueSaidaCodigoList");
    if (list) list.innerHTML = opcoesCodigoHtml();
    const listEnt = $("estoqueEntradaCodigoList");
    if (listEnt) listEnt.innerHTML = opcoesCodigoHtml();
    const forn = $("estoqueEntradaFornecedorList");
    if (forn) {
      const seen = new Set();
      const opts = [];
      entradasTodas().forEach((r) => {
        const nome = String(r.fornecedor || "").trim();
        const k = nome.toUpperCase();
        if (!nome || seen.has(k)) return;
        seen.add(k);
        opts.push(`<option value="${escapeHtml(nome)}"></option>`);
      });
      forn.innerHTML = opts.join("");
    }
  }

  function preencherProdutoEntrada() {
    const cad = cadastroDoCodigo($("estoqueEntradaCodigo")?.value || "");
    const desc = $("estoqueEntradaDescricao");
    const ref = $("estoqueEntradaReferencia");
    if (!cad) return;
    if (desc) desc.value = String(cad.descricao || "");
    if (ref) ref.value = String(cad.referencia || "");
  }

  function gravarEntradaMaterial() {
    const msg = $("estoqueEntradaFormMsg");
    if (estoqueAndroidSomenteLeitura()) {
      if (msg) msg.textContent = "Versão Android: somente visualização. Nada é lançado pelo celular.";
      return false;
    }
    const codigo = String($("estoqueEntradaCodigo")?.value || "").trim();
    const descricao = String($("estoqueEntradaDescricao")?.value || "").trim();
    const referencia = String($("estoqueEntradaReferencia")?.value || "").trim();
    const quantidade = parseQtd($("estoqueEntradaQtd")?.value);
    const fornecedor = String($("estoqueEntradaFornecedor")?.value || "").trim();
    const data = String($("estoqueEntradaData")?.value || "").trim() || hojeBr();
    const notaFiscal = String($("estoqueEntradaNota")?.value || "").trim();
    const valorNotaRaw = String($("estoqueEntradaValorNota")?.value || "").trim();
    const valorNota = parsePreco(valorNotaRaw);
    const formaPagamento = String($("estoqueEntradaFormaPagamento")?.value || "").trim();
    if (!codigoValido(codigo) && !descricao) {
      if (msg) msg.textContent = "Informe o código de barras ou a descrição do material.";
      return false;
    }
    if (!(quantidade > 0)) {
      if (msg) msg.textContent = "Informe a quantidade que chegou.";
      return false;
    }
    if (!formaPagamento) {
      if (msg) msg.textContent = "Escolha a forma de pagamento (1x a 12x).";
      return false;
    }
    const row = {
      codigo,
      descricao,
      referencia,
      quantidade,
      fornecedor,
      data,
      notaFiscal,
      valorNota: valorNota > 0 ? valorNota : valorNotaRaw,
      formaPagamento,
      gravadoEm: new Date().toISOString(),
    };
    const extra = extrasEntradas();
    extra.unshift(row);
    localStorage.setItem("dk_estoque_entradas_v1", JSON.stringify(extra));
    if (msg) msg.textContent = `Entrada gravada: ${descricao || codigo} · ${quantidade} · ${formaPagamento}.`;
    if ($("estoqueEntradaCodigo")) $("estoqueEntradaCodigo").value = "";
    if ($("estoqueEntradaDescricao")) $("estoqueEntradaDescricao").value = "";
    if ($("estoqueEntradaReferencia")) $("estoqueEntradaReferencia").value = "";
    if ($("estoqueEntradaQtd")) $("estoqueEntradaQtd").value = "1";
    carregarPlanilhaNasTelas();
    return true;
  }

  function aoAbrirEntrada() {
    const dataEl = $("estoqueEntradaData");
    if (dataEl && !String(dataEl.value || "").trim()) dataEl.value = hojeBr();
    carregarPlanilhaNasTelas();
  }

  function sanitizarPlacaDigitada(raw) {
    if (typeof portalSanitizePlacaInput === "function") return portalSanitizePlacaInput(raw);
    return String(raw || "")
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 7);
  }

  function placasFrotaDkSet() {
    const set = new Set();
    try {
      const rows = typeof loadAllVeiculosCadastro === "function" ? loadAllVeiculosCadastro() : [];
      (rows || []).forEach((v) => {
        const k = nkPlate(v?.placa);
        if (k) set.add(k);
      });
    } catch {
      /* frota opcional */
    }
    return set;
  }

  function origemPlaca(key) {
    return placasFrotaDkSet().has(key) ? "locadora" : "diversa";
  }

  function filtroOrigemRelPlaca() {
    return {
      locadora: Boolean($("estoqueRelPlacaLocadora")?.checked),
      diversas: Boolean($("estoqueRelPlacaDiversas")?.checked),
    };
  }

  function aceitaOrigemPlaca(key, origem) {
    const tipo = origemPlaca(key);
    if (tipo === "locadora") return origem.locadora !== false;
    return origem.diversas !== false;
  }

  function coletarPlacasEstoque(origem) {
    const by = new Map();
    const add = (placaRaw, veiculo, extra) => {
      const k = nkPlate(placaRaw);
      if (!k) return;
      if (origem && !aceitaOrigemPlaca(k, origem)) return;
      if (by.has(k)) {
        const cur = by.get(k);
        if (!cur.veiculo && veiculo) cur.veiculo = String(veiculo || "");
        return;
      }
      const tipo = origemPlaca(k);
      by.set(k, {
        placa: formatPlateOut(placaRaw) || k,
        key: k,
        veiculo: String(veiculo || "").trim(),
        extra: String(extra || "").trim() || (tipo === "locadora" ? "DK Locadora" : "placa diversa"),
        origem: tipo,
      });
    };
    saidasTodas().forEach((s) => add(s.placa, s.veiculo, ""));
    try {
      if (typeof loadAllVeiculosCadastro === "function") {
        loadAllVeiculosCadastro().forEach((v) => add(v.placa, v.tipo || v.modelo, v.modelo || v.tag || ""));
      }
    } catch {
      /* frota opcional */
    }
    return [...by.values()].sort((a, b) => a.placa.localeCompare(b.placa, "pt-BR"));
  }

  function filtrarPlacasEstoque(queryRaw, origem) {
    const lista = coletarPlacasEstoque(origem);
    const q = sanitizarPlacaDigitada(queryRaw);
    if (!q) return lista.slice(0, 80);
    return lista.filter((v) => v.key.includes(q) || String(v.veiculo || "").toUpperCase().includes(q)).slice(0, 80);
  }

  function hideEstoquePlacaDropdown(panel, inp) {
    if (panel) {
      panel.classList.add("hidden");
      panel.hidden = true;
      panel.innerHTML = "";
    }
    if (inp) inp.setAttribute("aria-expanded", "false");
  }

  function renderEstoquePlacaDropdown(inp, panel, queryRaw, origem) {
    if (!inp || !panel) return;
    const items = filtrarPlacasEstoque(queryRaw, origem);
    if (!items.length) {
      panel.innerHTML = '<div class="portal-placa-dropdown__empty">Nenhuma placa com esse texto.</div>';
    } else {
      panel.innerHTML = items
        .map((v) => {
          const sub = [v.veiculo, v.extra].filter(Boolean).join(" · ");
          return `<button type="button" class="portal-placa-dropdown__opt" role="option" tabindex="-1" data-placa="${escapeHtml(
            v.placa
          )}" data-veiculo="${escapeHtml(v.veiculo)}"><span class="portal-placa-dropdown__plate">${escapeHtml(
            v.placa
          )}</span><span class="portal-placa-dropdown__model">${escapeHtml(sub || "placa da planilha")}</span></button>`;
        })
        .join("");
    }
    panel.classList.remove("hidden");
    panel.hidden = false;
    inp.setAttribute("aria-expanded", "true");
  }

  function bindEstoquePlacaDropdown(opts) {
    const inp = $(opts.inputId);
    const panel = $(opts.panelId);
    const combo = $(opts.comboId);
    if (!inp || !panel || !combo) return;
    const onPick = typeof opts.onPick === "function" ? opts.onPick : null;
    const origemFn = typeof opts.origemFn === "function" ? opts.origemFn : null;

    const abrir = () => renderEstoquePlacaDropdown(inp, panel, inp.value, origemFn ? origemFn() : null);
    const fechar = () => hideEstoquePlacaDropdown(panel, inp);

    inp.addEventListener("focus", abrir);
    inp.addEventListener("input", () => {
      inp.value = sanitizarPlacaDigitada(inp.value);
      abrir();
    });
    inp.addEventListener("keydown", (e) => {
      if (e.key === "Escape") fechar();
      if (typeof portalSugestoesEnterConfirmaUnica === "function") {
        portalSugestoesEnterConfirmaUnica(e, panel, (btn) => btn.click());
        return;
      }
      if (e.key === "Enter") {
        const unicas = panel.querySelectorAll(".portal-placa-dropdown__opt");
        if (unicas.length === 1) {
          e.preventDefault();
          unicas[0].click();
        }
      }
    });
    panel.addEventListener("mousedown", (e) => {
      if (e.target.closest(".portal-placa-dropdown__opt")) e.preventDefault();
    });
    panel.addEventListener("click", (e) => {
      const btn = e.target.closest(".portal-placa-dropdown__opt");
      if (!btn) return;
      const placa = String(btn.getAttribute("data-placa") || "").trim();
      const veiculo = String(btn.getAttribute("data-veiculo") || "").trim();
      if (!placa) return;
      inp.value = sanitizarPlacaDigitada(placa) || placa;
      fechar();
      if (onPick) onPick(placa, veiculo);
    });
    document.addEventListener(
      "click",
      (e) => {
        if (panel.classList.contains("hidden")) return;
        if (combo.contains(e.target)) return;
        fechar();
      },
      true
    );
  }

  function produtosDatalistHtml() {
    return cadastroTodos()
      .map((r) => `<option value="${escapeHtml(r.codigo || "")}" label="${escapeHtml(r.descricao || "")}"></option>`)
      .join("");
  }

  function saidasComData() {
    return saidasTodas()
      .map((s) => ({
        ...s,
        _data: parseDataBr(s.data),
        _plate: nkPlate(s.placa),
        _bar: nkBar(s.codigo),
        _km: parseKm(s.km),
        _qtd: parseQtd(s.quantidade) || 1,
      }))
      .filter((s) => s._data && s._bar);
  }

  function intervaloPlanilha() {
    const datas = saidasComData().map((s) => s._data.getTime());
    if (!datas.length) {
      const hoje = new Date();
      return { inicio: hoje, fim: hoje };
    }
    return { inicio: new Date(Math.min(...datas)), fim: new Date(Math.max(...datas)) };
  }

  function garantirPeriodo(inicioId, fimId) {
    const iniEl = $(inicioId);
    const fimEl = $(fimId);
    if (!iniEl || !fimEl) return;
    if (!String(iniEl.value || "").trim() || !String(fimEl.value || "").trim()) {
      const { inicio, fim } = intervaloPlanilha();
      if (!String(iniEl.value || "").trim()) iniEl.value = formatDataBarra(inicio);
      if (!String(fimEl.value || "").trim()) fimEl.value = formatDataBarra(fim);
    }
  }

  function lerPeriodo(inicioId, fimId) {
    garantirPeriodo(inicioId, fimId);
    let ini = parseDataBr($(inicioId)?.value || "");
    let fim = parseDataBr($(fimId)?.value || "");
    if (!ini || !fim) {
      const pad = intervaloPlanilha();
      ini = ini || pad.inicio;
      fim = fim || pad.fim;
    }
    if (ini.getTime() > fim.getTime()) {
      const t = ini;
      ini = fim;
      fim = t;
    }
    const a = new Date(ini.getFullYear(), ini.getMonth(), ini.getDate()).getTime();
    const b = new Date(fim.getFullYear(), fim.getMonth(), fim.getDate()).getTime();
    return { ini, fim, a, b };
  }

  function noPeriodo(d, per) {
    if (!(d instanceof Date)) return false;
    const t = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    return t >= per.a && t <= per.b;
  }

  function kpisHtml(itens) {
    return `<div class="portal-rel-pag-agg-kpis__grid" role="list">${itens
      .map(
        (it) =>
          `<div class="portal-rel-pag-agg-kpi${it.valor ? " portal-rel-pag-agg-kpi--valor" : ""}" role="listitem"><span class="portal-rel-pag-agg-kpi__lab">${escapeHtml(
            it.lab
          )}</span><strong>${escapeHtml(it.val)}</strong></div>`
      )
      .join("")}</div>`;
  }

  function resolverProduto(texto) {
    const raw = String(texto || "").trim();
    if (!raw) return null;
    const bar = nkBar(raw);
    if (bar.length >= 8) {
      const cad = cadastroDoCodigo(raw);
      if (cad) return cad;
      const sai = saidasTodas().find((s) => nkBar(s.codigo) === bar);
      if (sai) return { codigo: sai.codigo, descricao: sai.descricao, referencia: sai.referencia };
    }
    const q = raw.toUpperCase();
    return (
      cadastroTodos().find((r) => String(r.descricao || "").toUpperCase().includes(q)) ||
      cadastroTodos().find((r) => String(r.referencia || "").toUpperCase() === q) ||
      null
    );
  }

  function intervaloKmValido(prevKm, curKm) {
    if (!(prevKm > 0 && curKm > prevKm)) return null;
    const intervalo = curKm - prevKm;
    if (intervalo < 50) return null;
    if (String(Math.round(curKm)).length > String(Math.round(prevKm)).length) return null;
    if (intervalo > 15000) return null;
    return intervalo;
  }

  function ciclosDoProduto(bar) {
    const porPlaca = new Map();
    saidasComData()
      .filter((s) => s._bar === bar)
      .forEach((s) => {
        const k = s._plate || "?";
        if (!porPlaca.has(k)) porPlaca.set(k, []);
        porPlaca.get(k).push(s);
      });
    const ciclos = [];
    porPlaca.forEach((lista, plate) => {
      lista.sort((a, b) => a._data.getTime() - b._data.getTime() || a._km - b._km);
      for (let i = 1; i < lista.length; i += 1) {
        const prev = lista[i - 1];
        const cur = lista[i];
        const dias = diasEntre(prev._data, cur._data);
        const km = intervaloKmValido(prev._km, cur._km);
        ciclos.push({
          plate,
          placa: formatPlateOut(cur.placa || prev.placa),
          veiculo: cur.veiculo || prev.veiculo || "",
          dias,
          km,
          de: prev,
          ate: cur,
        });
      }
    });
    return { porPlaca, ciclos };
  }

  function renderRelatorioPlaca() {
    const box = $("estoqueRelPlacaResultado");
    const kpis = $("estoqueRelPlacaKpis");
    const resumo = $("estoqueRelPlacaResumo");
    if (!box) return;
    const per = lerPeriodo("estoqueRelPlacaInicio", "estoqueRelPlacaFim");
    const filtro = nkPlate($("estoqueRelPlacaFiltro")?.value || "");
    const origem = filtroOrigemRelPlaca();
    if (!origem.locadora && !origem.diversas) {
      if (kpis) kpis.innerHTML = "";
      if (resumo) resumo.textContent = "Marque PLACAS CADASTRADAS NA DK LOCADORA e/ou PLACAS DIVERSAS.";
      box.innerHTML = `<p class="subtext">Nenhuma origem de placa marcada.</p>`;
      return;
    }
    const rows = saidasComData().filter(
      (s) => noPeriodo(s._data, per) && (!filtro || s._plate === filtro) && aceitaOrigemPlaca(s._plate, origem)
    );
    const porPlaca = new Map();
    rows.forEach((s) => {
      const k = s._plate || "SEM-PLACA";
      if (!porPlaca.has(k)) porPlaca.set(k, []);
      porPlaca.get(k).push(s);
    });
    const placas = [...porPlaca.keys()].sort();
    if (kpis) {
      kpis.innerHTML = kpisHtml([
        { lab: "Placas", val: String(placas.length) },
        { lab: "Aplicações", val: String(rows.length) },
        { lab: "Período", val: `${formatDataBarra(per.ini)} a ${formatDataBarra(per.fim)}` },
      ]);
    }
    if (resumo) {
      resumo.textContent = placas.length
        ? `${placas.length} placa(s) com ${rows.length} aplicação(ões) no período selecionado.`
        : "Nenhuma aplicação neste período.";
    }
    if (!placas.length) {
      box.innerHTML = `<p class="subtext">Nenhum produto aplicado neste intervalo.</p>`;
      return;
    }
    box.innerHTML = placas
      .map((k) => {
        const lista = porPlaca.get(k).slice().sort((a, b) => a._data.getTime() - b._data.getTime());
        const placa = formatPlateOut(lista[0].placa) || k;
        const veic = lista.find((s) => s.veiculo)?.veiculo || "";
        const linhas = lista
          .map(
            (s) =>
              `<tr><td>${escapeHtml(s.codigo || "")}</td><td>${escapeHtml(s.descricao || "")}</td><td>${escapeHtml(
                s.referencia || ""
              )}</td><td>${escapeHtml(String(s.quantidade ?? ""))}</td><td>${escapeHtml(
                String(s.km ?? "")
              )}</td><td>${escapeHtml(s.data || "")}</td></tr>`
          )
          .join("");
        return `<article class="portal-estoque-rel-bloco"><h4 class="portal-estoque-rel-bloco__tit">PLACA ${escapeHtml(
          placa
        )}${veic ? ` · ${escapeHtml(veic)}` : ""} · ${lista.length} item(ns)</h4><div class="fin-table-wrap"><table class="fin-table portal-rel-pag-agg__table"><thead><tr><th>CÓDIGO</th><th>PRODUTO</th><th>REFERÊNCIA</th><th>QTD</th><th>KM</th><th>DATA</th></tr></thead><tbody>${linhas}</tbody></table></div></article>`;
      })
      .join("");
  }

  function renderRelatorioProduto() {
    const box = $("estoqueRelProdutoResultado");
    const kpis = $("estoqueRelProdutoKpis");
    const resumo = $("estoqueRelProdutoResumo");
    if (!box) return;
    const per = lerPeriodo("estoqueRelProdutoInicio", "estoqueRelProdutoFim");
    const prod = resolverProduto($("estoqueRelProdutoCodigo")?.value || "");
    const saidasPer = saidasComData().filter((s) => noPeriodo(s._data, per));

    if (!prod) {
      const porProd = new Map();
      saidasPer.forEach((s) => {
        if (!porProd.has(s._bar)) porProd.set(s._bar, []);
        porProd.get(s._bar).push(s);
      });
      const linhas = [...porProd.entries()]
        .map(([bar, lista]) => {
          const { ciclos } = ciclosDoProduto(bar);
          const ciclosPer = ciclos.filter((c) => noPeriodo(c.ate._data, per));
          const placas = new Set(lista.map((s) => s._plate).filter(Boolean));
          return {
            bar,
            codigo: lista[0].codigo,
            descricao: lista[0].descricao,
            placas: placas.size,
            aplicacoes: lista.length,
            mediaDias: media(ciclosPer.map((c) => c.dias).filter((n) => n != null)),
            mediaKm: media(ciclosPer.map((c) => c.km).filter((n) => n != null && n > 0)),
          };
        })
        .sort((a, b) => b.aplicacoes - a.aplicacoes || String(a.descricao).localeCompare(String(b.descricao), "pt"));
      if (kpis) {
        kpis.innerHTML = kpisHtml([
          { lab: "Produtos aplicados", val: String(linhas.length) },
          { lab: "Aplicações", val: String(saidasPer.length) },
          { lab: "Período", val: `${formatDataBarra(per.ini)} a ${formatDataBarra(per.fim)}` },
        ]);
      }
      if (resumo) {
        resumo.textContent = linhas.length
          ? `Média de km = soma dos intervalos (troca seguinte − troca anterior na mesma placa) ÷ quantidade de intervalos.`
          : "Nenhuma aplicação neste período.";
      }
      if (!linhas.length) {
        box.innerHTML = `<p class="subtext">Nenhum produto aplicado neste intervalo.</p>`;
        return;
      }
      box.innerHTML = `<div class="fin-table-wrap"><table class="fin-table portal-rel-pag-agg__table"><thead><tr><th>CÓDIGO</th><th>PRODUTO</th><th>PLACAS</th><th>APLICAÇÕES</th><th>MÉDIA DIAS</th><th>MÉDIA KM (intervalos)</th></tr></thead><tbody>${linhas
        .map(
          (r) =>
            `<tr data-estoque-prod="${escapeHtml(r.codigo)}"><td>${escapeHtml(r.codigo || "")}</td><td>${escapeHtml(
              r.descricao || ""
            )}</td><td>${r.placas}</td><td>${r.aplicacoes}</td><td>${
              r.mediaDias == null ? "—" : formatNum(r.mediaDias, 1)
            }</td><td>${r.mediaKm == null ? "—" : formatNum(r.mediaKm, 0)}</td></tr>`
        )
        .join("")}</tbody></table></div>`;
      box.querySelectorAll("[data-estoque-prod]").forEach((tr) => {
        tr.style.cursor = "pointer";
        tr.addEventListener("click", () => {
          const input = $("estoqueRelProdutoCodigo");
          if (input) input.value = tr.getAttribute("data-estoque-prod") || "";
          renderRelatorioProduto();
        });
      });
      return;
    }

    const bar = nkBar(prod.codigo);
    const { porPlaca, ciclos } = ciclosDoProduto(bar);
    const aplicacoesPer = saidasPer.filter((s) => s._bar === bar);
    const placasPer = new Set(aplicacoesPer.map((s) => s._plate).filter(Boolean));
    const ciclosPer = ciclos.filter((c) => noPeriodo(c.ate._data, per) || placasPer.has(c.plate));
    const mediaDias = media(ciclosPer.map((c) => c.dias).filter((n) => n != null));
    const mediaKm = media(ciclosPer.map((c) => c.km).filter((n) => n != null && n > 0));

    if (kpis) {
      kpis.innerHTML = kpisHtml([
        { lab: "Placas", val: String(placasPer.size || porPlaca.size) },
        { lab: "Aplicações no período", val: String(aplicacoesPer.length) },
        { lab: "Média de tempo", val: mediaDias == null ? "—" : `${formatNum(mediaDias, 1)} dias` },
        { lab: "Média de km", val: mediaKm == null ? "—" : `${formatNum(mediaKm, 0)} km` },
      ]);
    }
    if (resumo) {
      resumo.textContent = `${prod.descricao || prod.codigo}: aplicado em ${placasPer.size} placa(s). Média de km = soma dos intervalos na mesma placa ÷ quantidade de intervalos.`;
    }

    const placas = [...new Set([...placasPer, ...[...porPlaca.keys()].filter((p) => placasPer.has(p))])].sort();
    const listaPlacas = (placas.length ? placas : [...porPlaca.keys()]).sort();
    if (!listaPlacas.length) {
      box.innerHTML = `<p class="subtext">Este produto não foi aplicado no período selecionado.</p>`;
      return;
    }

    const linhas = listaPlacas
      .map((plate) => {
        const hist = (porPlaca.get(plate) || []).slice().sort((a, b) => a._data.getTime() - b._data.getTime());
        const noInt = hist.filter((s) => noPeriodo(s._data, per));
        const ciclosPlaca = ciclos.filter((c) => c.plate === plate);
        const ultimo = ciclosPlaca[ciclosPlaca.length - 1];
        const dDias = ultimo && ultimo.dias != null ? ultimo.dias : null;
        const dKm = ultimo && ultimo.km != null ? ultimo.km : null;
        const mDias = media(ciclosPlaca.map((c) => c.dias).filter((n) => n != null));
        const mKm = media(ciclosPlaca.map((c) => c.km).filter((n) => n != null && n > 0));
        const veic = (noInt[0] || hist[0] || {}).veiculo || "";
        return `<tr><td>${escapeHtml(formatPlateOut((noInt[0] || hist[0] || {}).placa || plate))}</td><td>${escapeHtml(
          veic
        )}</td><td>${noInt.length || hist.length}</td><td>${
          dDias == null ? "sem reaplicação" : `${dDias} dia(s)`
        }</td><td>${dKm == null ? "—" : `${formatNum(dKm, 0)} km`}</td><td>${
          mDias == null ? "—" : formatNum(mDias, 1)
        }</td><td>${mKm == null ? "—" : formatNum(mKm, 0)}</td></tr>`;
      })
      .join("");

    box.innerHTML = `<div class="fin-table-wrap"><table class="fin-table portal-rel-pag-agg__table"><thead><tr><th>PLACA</th><th>VEÍCULO</th><th>APLICAÇÕES</th><th>DUROU (TEMPO)</th><th>DUROU (KM)</th><th>MÉDIA DIAS</th><th>MÉDIA KM</th></tr></thead><tbody>${linhas}</tbody></table></div>`;
  }

  function renderRelatorioCusto() {
    const box = $("estoqueRelCustoResultado");
    const kpis = $("estoqueRelCustoKpis");
    const resumo = $("estoqueRelCustoResumo");
    if (!box) return;
    const per = lerPeriodo("estoqueRelCustoInicio", "estoqueRelCustoFim");
    const filtro = nkPlate($("estoqueRelCustoFiltro")?.value || "");
    const rows = saidasComData()
      .filter((s) => noPeriodo(s._data, per) && (!filtro || s._plate === filtro))
      .map((s) => {
        const unit = precoDoCodigo(s.codigo);
        const valor = unit * (s._qtd || 1);
        return { ...s, unit, valor };
      });
    const porPlaca = new Map();
    rows.forEach((s) => {
      const k = s._plate || "SEM-PLACA";
      if (!porPlaca.has(k)) porPlaca.set(k, []);
      porPlaca.get(k).push(s);
    });
    const placas = [...porPlaca.keys()].sort();
    const totalGeral = rows.reduce((a, s) => a + (s.valor || 0), 0);
    if (kpis) {
      kpis.innerHTML = kpisHtml([
        { lab: "Veículos", val: String(placas.length) },
        { lab: "Itens aplicados", val: String(rows.length) },
        { lab: "Total gasto no período", val: formatMoney(totalGeral), valor: true },
      ]);
    }
    if (resumo) {
      resumo.textContent = placas.length
        ? `Custo de manutenção de ${placas.length} veículo(s) no período selecionado: ${formatMoney(totalGeral)}.`
        : "Nenhum item aplicado neste período.";
    }
    if (!placas.length) {
      box.innerHTML = `<p class="subtext">Nenhum custo de manutenção neste intervalo.</p>`;
      return;
    }
    box.innerHTML =
      placas
        .map((k) => {
          const lista = porPlaca.get(k).slice().sort((a, b) => a._data.getTime() - b._data.getTime());
          const sub = lista.reduce((a, s) => a + (s.valor || 0), 0);
          const placa = formatPlateOut(lista[0].placa) || k;
          const veic = lista.find((s) => s.veiculo)?.veiculo || "";
          const linhas = lista
            .map(
              (s) =>
                `<tr><td>${escapeHtml(s.data || "")}</td><td>${escapeHtml(s.codigo || "")}</td><td>${escapeHtml(
                  s.descricao || ""
                )}</td><td>${escapeHtml(String(s.quantidade ?? ""))}</td><td>${
                  s.unit > 0 ? formatMoney(s.unit) : "—"
                }</td><td>${s.valor > 0 ? formatMoney(s.valor) : "—"}</td></tr>`
            )
            .join("");
          return `<article class="portal-estoque-rel-bloco"><h4 class="portal-estoque-rel-bloco__tit">PLACA ${escapeHtml(
            placa
          )}${veic ? ` · ${escapeHtml(veic)}` : ""} · total ${escapeHtml(
            formatMoney(sub)
          )}</h4><div class="fin-table-wrap"><table class="fin-table portal-rel-pag-agg__table"><thead><tr><th>DATA</th><th>CÓDIGO</th><th>ITEM APLICADO</th><th>QTD</th><th>VALOR DO ITEM</th><th>TOTAL</th></tr></thead><tbody>${linhas}<tr class="portal-estoque-rel-total"><td colspan="5">Total da placa</td><td>${escapeHtml(
            formatMoney(sub)
          )}</td></tr></tbody></table></div></article>`;
        })
        .join("") +
      `<p class="portal-estoque-rel-geral"><strong>Total geral do período:</strong> ${escapeHtml(formatMoney(totalGeral))}</p>`;
  }

  function carregarPlanilhaNasTelas() {
    atualizarKpis();
    renderTabelaCadastro();
    renderTabelaEstoque();
    renderTabelaEntradas();
    renderTabelaSaidas();
    preencherDatalist();
    const listProd = $("estoqueRelProdutoList");
    if (listProd) listProd.innerHTML = produtosDatalistHtml();
  }

  function aoAbrirSaida() {
    const dataEl = $("estoqueSaidaData");
    if (dataEl && !String(dataEl.value || "").trim()) dataEl.value = hojeBr();
    carregarPlanilhaNasTelas();
  }

  function aoAbrirRelatorio(sub) {
    carregarPlanilhaNasTelas();
    if (sub === "rel-placa") {
      garantirPeriodo("estoqueRelPlacaInicio", "estoqueRelPlacaFim");
      renderRelatorioPlaca();
    } else if (sub === "rel-produto") {
      garantirPeriodo("estoqueRelProdutoInicio", "estoqueRelProdutoFim");
      renderRelatorioProduto();
    } else if (sub === "rel-custo") {
      garantirPeriodo("estoqueRelCustoInicio", "estoqueRelCustoFim");
      renderRelatorioCusto();
    }
  }

  function bindRelatorio(ids, render) {
    ids.forEach((id) => {
      const el = $(id);
      if (!el) return;
      el.addEventListener("change", render);
      el.addEventListener("input", () => {
        if (el.matches("[data-dk-mask='date']") && String(el.value || "").replace(/\D/g, "").length < 8) return;
        render();
      });
    });
  }

  function bind() {
    $("estoqueSaidaConferirBtn")?.addEventListener("click", (e) => {
      e.preventDefault();
      conferirUltimaAplicacao();
    });
    $("estoqueSaidaResumoOkBtn")?.addEventListener("click", () => fecharResumo());
    document.querySelectorAll("[data-close-estoque-saida-resumo]").forEach((el) => {
      el.addEventListener("click", () => fecharResumo());
    });
    $("estoqueSaidaCodigo")?.addEventListener("change", () => {
      preencherProduto();
      conferirUltimaAplicacao({ silencioso: true });
    });
    $("estoqueSaidaCodigo")?.addEventListener("blur", () => {
      preencherProduto();
      if (nkBar($("estoqueSaidaCodigo")?.value || "") && nkPlate($("estoqueSaidaPlaca")?.value || "") && parseKm($("estoqueSaidaKm")?.value || "")) {
        conferirUltimaAplicacao({ silencioso: true });
      }
    });
    function aoConfirmarPlacaSaida(placaRaw, veiculoHint) {
      const placa = nkPlate(placaRaw);
      const ult = saidasTodas().find((s) => nkPlate(s.placa) === placa);
      const veic = $("estoqueSaidaVeiculo");
      if (veic && (veiculoHint || ult?.veiculo)) veic.value = String(veiculoHint || ult.veiculo || "");
      if (nkBar($("estoqueSaidaCodigo")?.value || "") && placa && parseKm($("estoqueSaidaKm")?.value || "")) {
        conferirUltimaAplicacao({ silencioso: true });
      }
    }
    $("estoqueSaidaPlaca")?.addEventListener("change", () => {
      aoConfirmarPlacaSaida($("estoqueSaidaPlaca")?.value || "");
    });
    bindEstoquePlacaDropdown({
      inputId: "estoqueSaidaPlaca",
      panelId: "estoqueSaidaPlacaLista",
      comboId: "estoqueSaidaPlacaCombo",
      onPick: aoConfirmarPlacaSaida,
    });
    bindEstoquePlacaDropdown({
      inputId: "estoqueRelPlacaFiltro",
      panelId: "estoqueRelPlacaFiltroLista",
      comboId: "estoqueRelPlacaFiltroCombo",
      onPick: () => renderRelatorioPlaca(),
      origemFn: filtroOrigemRelPlaca,
    });
    ["estoqueRelPlacaLocadora", "estoqueRelPlacaDiversas"].forEach((id) => {
      $(id)?.addEventListener("change", () => renderRelatorioPlaca());
    });
    bindEstoquePlacaDropdown({
      inputId: "estoqueRelCustoFiltro",
      panelId: "estoqueRelCustoFiltroLista",
      comboId: "estoqueRelCustoFiltroCombo",
      onPick: () => renderRelatorioCusto(),
    });
    $("estoqueSaidaKm")?.addEventListener("change", () => {
      if (nkBar($("estoqueSaidaCodigo")?.value || "") && nkPlate($("estoqueSaidaPlaca")?.value || "") && parseKm($("estoqueSaidaKm")?.value || "")) {
        conferirUltimaAplicacao({ silencioso: true });
      }
    });
    $("estoqueRelPlacaGerarBtn")?.addEventListener("click", (e) => {
      e.preventDefault();
      renderRelatorioPlaca();
    });
    $("estoqueRelProdutoGerarBtn")?.addEventListener("click", (e) => {
      e.preventDefault();
      renderRelatorioProduto();
    });
    $("estoqueRelCustoGerarBtn")?.addEventListener("click", (e) => {
      e.preventDefault();
      renderRelatorioCusto();
    });
    $("estoqueEntradaSalvarBtn")?.addEventListener("click", (e) => {
      e.preventDefault();
      gravarEntradaMaterial();
    });
    $("estoqueEntradaForm")?.addEventListener("submit", (e) => {
      e.preventDefault();
      gravarEntradaMaterial();
    });
    $("estoqueEntradaCodigo")?.addEventListener("change", preencherProdutoEntrada);
    $("estoqueEntradaCodigo")?.addEventListener("blur", preencherProdutoEntrada);
    bindRelatorio(["estoqueRelPlacaInicio", "estoqueRelPlacaFim", "estoqueRelPlacaFiltro"], renderRelatorioPlaca);
    bindRelatorio(["estoqueRelProdutoInicio", "estoqueRelProdutoFim", "estoqueRelProdutoCodigo"], renderRelatorioProduto);
    bindRelatorio(["estoqueRelCustoInicio", "estoqueRelCustoFim", "estoqueRelCustoFiltro"], renderRelatorioCusto);
  }

  window.__DK_estoqueAoAbrirSaida = aoAbrirSaida;
  window.__DK_estoqueAoAbrirEntrada = aoAbrirEntrada;
  window.__DK_estoqueAoAbrirPainel = carregarPlanilhaNasTelas;
  window.__DK_estoqueAoAbrirRelatorio = aoAbrirRelatorio;
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bind, { once: true });
  } else {
    bind();
  }
})();
