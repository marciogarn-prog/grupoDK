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

  const ESTOQUE_PLACA_MEMORIA_KEY = "dk_estoque_placa_memoria_v1";

  function normalizarTipoMotoCarro(v) {
    const t = String(v || "")
      .trim()
      .toUpperCase();
    if (!t) return "";
    if (t === "MOTO" || t === "CARRO") return t;
    if (/\bMOTO\b|MOTOCICLETA|SCOOTER|DKMT|CG\s*\d|BROS|BIZ\b|TITAN|FAN\b|YBR|FACTOR|NXR|TWISTER|\bPOP\b/.test(t)) {
      return "MOTO";
    }
    if (/\bCARRO\b|AUTOMOVEL|AUTOMÓVEL|DKCR|GOL\b|ONIX|CIVIC|KWID|UNO\b|PALIO|CORSA|FIESTA|SANDERO|STRADA/.test(t)) {
      return "CARRO";
    }
    return "";
  }

  function lerMemoriaPlaca() {
    try {
      const raw = JSON.parse(localStorage.getItem(ESTOQUE_PLACA_MEMORIA_KEY) || "{}");
      return raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
    } catch {
      return {};
    }
  }

  function gravarMemoriaPlaca(placaRaw, patch) {
    if (estoqueAndroidSomenteLeitura()) return;
    const placa = nkPlate(placaRaw);
    if (placa.length < 7) return;
    const map = lerMemoriaPlaca();
    const prev = map[placa] && typeof map[placa] === "object" ? map[placa] : {};
    const modelo = String(patch?.modelo != null ? patch.modelo : prev.modelo || "").trim();
    const tipo = normalizarTipoMotoCarro(patch?.tipo != null ? patch.tipo : prev.tipo || "");
    if (!modelo && !tipo) return;
    map[placa] = { modelo, tipo, atualizadoEm: new Date().toISOString() };
    localStorage.setItem(ESTOQUE_PLACA_MEMORIA_KEY, JSON.stringify(map));
    preencherDatalistModelosPlaca();
  }

  function veiculoFrotaPorPlaca(placaRaw) {
    const placa = nkPlate(placaRaw);
    if (!placa) return null;
    try {
      const rows = typeof loadAllVeiculosCadastro === "function" ? loadAllVeiculosCadastro() : [];
      return (rows || []).find((v) => nkPlate(v?.placa) === placa) || null;
    } catch {
      return null;
    }
  }

  function modeloFrotaPorPlaca(placaRaw) {
    const v = veiculoFrotaPorPlaca(placaRaw);
    return String(v?.marcaModelo || v?.modelo || "").trim();
  }

  function tipoFrotaPorPlaca(placaRaw) {
    const v = veiculoFrotaPorPlaca(placaRaw);
    if (!v) return "";
    const tipo = normalizarTipoMotoCarro(v.tipo || v.tipoPlanilha || "");
    if (tipo) return tipo;
    return normalizarTipoMotoCarro(String(v.codigo || v.tag || ""));
  }

  function preencherDatalistModelosPlaca() {
    const list = $("estoqueSaidaModeloList");
    if (!list) return;
    const seen = new Set();
    const opts = [];
    Object.values(lerMemoriaPlaca()).forEach((row) => {
      const nome = String(row?.modelo || "").trim();
      const k = nome.toUpperCase();
      if (!nome || seen.has(k)) return;
      seen.add(k);
      opts.push(`<option value="${escapeHtml(nome)}"></option>`);
    });
    list.innerHTML = opts.join("");
  }

  function aplicarMemoriaPlacaNaSaida(placaRaw, veiculoHint) {
    const placa = nkPlate(placaRaw);
    const modeloEl = $("estoqueSaidaModelo");
    const veicEl = $("estoqueSaidaVeiculo");
    if (!placa) {
      if (modeloEl) modeloEl.value = "";
      if (veicEl) veicEl.value = "";
      return;
    }
    const mem = lerMemoriaPlaca()[placa] || {};
    const ult = saidasTodas().find((s) => nkPlate(s.placa) === placa);
    const modeloSaida = String(ult?.modelo || "").trim();
    const veiculoSaida = String(ult?.veiculo || "").trim();
    const modeloHint = String(veiculoHint || "").trim();
    const modelo =
      String(mem.modelo || "").trim() ||
      modeloFrotaPorPlaca(placa) ||
      modeloSaida ||
      (modeloHint && !/^(MOTO|CARRO)$/i.test(modeloHint) ? modeloHint : "") ||
      (veiculoSaida && !/^(MOTO|CARRO)$/i.test(veiculoSaida) ? veiculoSaida : "");
    const tipo =
      normalizarTipoMotoCarro(mem.tipo) ||
      tipoFrotaPorPlaca(placa) ||
      normalizarTipoMotoCarro(veiculoHint) ||
      (/^(MOTO|CARRO)$/i.test(veiculoSaida) ? veiculoSaida.toUpperCase() : normalizarTipoMotoCarro(veiculoSaida));
    if (modeloEl) modeloEl.value = modelo;
    if (veicEl) veicEl.value = tipo === "MOTO" || tipo === "CARRO" ? tipo : "";
    if (modelo || tipo) gravarMemoriaPlaca(placa, { modelo, tipo });
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

  function extrasCadastro() {
    try {
      const extra = JSON.parse(localStorage.getItem("dk_estoque_cadastro_v1") || "[]");
      return Array.isArray(extra) ? extra : [];
    } catch {
      return [];
    }
  }

  function cadastroTodos() {
    const rows = Array.isArray(planilha().cadastro) ? planilha().cadastro : [];
    const seen = new Set();
    const out = [];
    const add = (r) => {
      const desc = String(r?.descricao || "").trim();
      if (!codigoValido(r?.codigo) && !desc) return;
      const k = codigoValido(r?.codigo) ? nkBar(r.codigo) : `d:${desc.toUpperCase()}`;
      if (seen.has(k)) return;
      seen.add(k);
      out.push(r);
    };
    for (const r of rows) {
      if (!codigoValido(r.codigo)) continue;
      add(r);
    }
    extrasCadastro().forEach(add);
    return out;
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
    for (const r of extrasCadastro()) {
      if (!codigoValido(r.codigo)) continue;
      const k = nkBar(r.codigo);
      if (seen.has(k)) continue;
      seen.add(k);
      out.push({
        codigo: r.codigo,
        descricao: r.descricao,
        referencia: r.referencia,
        fabricante: r.fabricante || "",
        qt: 0,
        preco: r.preco,
        total: 0,
        setor: r.setor || "",
        entradas: 0,
        saidas: 0,
        saldo: 0,
      });
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

  function extrasPrecos() {
    try {
      const extra = JSON.parse(localStorage.getItem("dk_estoque_precos_v1") || "{}");
      return extra && typeof extra === "object" && !Array.isArray(extra) ? extra : {};
    } catch {
      return {};
    }
  }

  function precoUnitarioDaEntrada(row) {
    const direto = parsePreco(row?.valorUnitario);
    if (direto > 0) return direto;
    const qtd = parseQtd(row?.quantidade);
    const valor = parsePreco(row?.valorNota);
    if (valor > 0 && qtd > 0) return valor / qtd;
    return 0;
  }

  function gravarPrecoRecente(codigo, preco) {
    if (!codigoValido(codigo) || !(Number(preco) > 0)) return;
    const map = extrasPrecos();
    map[nkBar(codigo)] = { preco: Number(preco), gravadoEm: new Date().toISOString() };
    localStorage.setItem("dk_estoque_precos_v1", JSON.stringify(map));
    const extra = extrasCadastro();
    const key = nkBar(codigo);
    const i = extra.findIndex((r) => nkBar(r.codigo) === key);
    if (i >= 0) {
      extra[i] = { ...extra[i], preco: Number(preco) };
      localStorage.setItem("dk_estoque_cadastro_v1", JSON.stringify(extra));
    }
  }

  function precoDoCodigo(codigo) {
    const key = nkBar(codigo);
    if (!key) return 0;
    const pOverlay = parsePreco(extrasPrecos()[key]?.preco);
    if (pOverlay > 0) return pOverlay;
    for (const r of extrasEntradas()) {
      if (nkBar(r.codigo) !== key) continue;
      const p = precoUnitarioDaEntrada(r);
      if (p > 0) return p;
    }
    const base = (Array.isArray(planilha().entradas) ? planilha().entradas : [])
      .filter((r) => nkBar(r.codigo) === key)
      .slice()
      .sort((a, b) => {
        const da = parseDataBr(a.data);
        const db = parseDataBr(b.data);
        return (db ? db.getTime() : 0) - (da ? da.getTime() : 0);
      });
    for (const r of base) {
      const p = precoUnitarioDaEntrada(r);
      if (p > 0) return p;
    }
    const cadPlan = (Array.isArray(planilha().cadastro) ? planilha().cadastro : []).find((r) => nkBar(r.codigo) === key);
    const pCad = parsePreco(cadPlan?.preco);
    if (pCad > 0) return pCad;
    const extraCad = extrasCadastro().find((r) => nkBar(r.codigo) === key);
    const pEx = parsePreco(extraCad?.preco);
    if (pEx > 0) return pEx;
    const est = (Array.isArray(planilha().estoque) ? planilha().estoque : []).find((r) => nkBar(r.codigo) === key);
    const pEst = parsePreco(est?.preco);
    return pEst > 0 ? pEst : 0;
  }

  function ultimaAplicacao(codigo, placa) {
    const bar = nkBar(codigo);
    if (!bar) return null;
    const plate = nkPlate(placa);
    const fam = familiaDeCodigo(codigo);
    const lista = saidasTodas()
      .filter((s) => (fam && familiaProduto(s) === fam) || nkBar(s.codigo) === bar)
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
    const veic = $("estoqueSaidaVeiculo");
    const modeloEl = $("estoqueSaidaModelo");
    if (
      placa &&
      ((veic && !String(veic.value || "").trim()) || (modeloEl && !String(modeloEl.value || "").trim()))
    ) {
      aplicarMemoriaPlacaNaSaida(placa);
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

  const ESTOQUE_CAD_COLS = [
    { key: "codigo", label: "CÓDIGO DE BARRAS" },
    { key: "descricao", label: "DESCRIÇÃO" },
    { key: "referencia", label: "REFERÊNCIA" },
    { key: "fabricante", label: "FABRICANTE" },
    { key: "preco", label: "VALOR UNITÁRIO DO PRODUTO" },
    { key: "setor", label: "SETOR" },
  ];
  const cadExcelState = { cols: {}, sortKey: "descricao", sortDir: "asc" };
  let cadExcelOpen = "";

  function cadCellDisplay(r, key) {
    if (key === "preco") {
      const p = precoDoCodigo(r.codigo);
      return p > 0 ? formatMoney(p) : "—";
    }
    const v = String(r[key] || "").trim();
    return v || "(vazio)";
  }

  function nkFiltroExcel(s) {
    return String(s || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }

  function cadLinhasAntesDaColuna(openKey) {
    let rows = cadastroTodos().slice();
    ESTOQUE_CAD_COLS.forEach((col) => {
      if (col.key === openKey) return;
      const set = cadExcelState.cols[col.key];
      if (!(set instanceof Set)) return;
      rows = rows.filter((r) => set.has(cadCellDisplay(r, col.key)));
    });
    return rows;
  }

  function cadLinhasFiltradas() {
    let rows = cadLinhasAntesDaColuna("");
    const key = cadExcelState.sortKey || "descricao";
    const dir = cadExcelState.sortDir === "desc" ? -1 : 1;
    rows.sort((a, b) => {
      if (key === "preco") return (precoDoCodigo(a.codigo) - precoDoCodigo(b.codigo)) * dir;
      return String(cadCellDisplay(a, key)).localeCompare(String(cadCellDisplay(b, key)), "pt-BR") * dir;
    });
    return rows;
  }

  function cadValoresUnicos(openKey) {
    const seen = new Set();
    const out = [];
    cadLinhasAntesDaColuna(openKey).forEach((r) => {
      const v = cadCellDisplay(r, openKey);
      if (seen.has(v)) return;
      seen.add(v);
      out.push(v);
    });
    if (openKey === "preco") {
      out.sort((a, b) => {
        if (a === "—") return 1;
        if (b === "—") return -1;
        return a.localeCompare(b, "pt-BR");
      });
    } else {
      out.sort((a, b) => String(a).localeCompare(String(b), "pt-BR"));
    }
    return out;
  }

  function fecharEstoqueCadExcelFiltro() {
    cadExcelOpen = "";
    document.querySelectorAll(".estoque-cad-excel-pop").forEach((el) => el.remove());
    document.querySelectorAll("#estoqueTableCadastro .fin-excel-filter-btn.is-open").forEach((b) => b.classList.remove("is-open"));
  }

  function renderEstoqueCadHead() {
    const thead = $("estoqueHeadCadastro");
    if (!thead) return;
    thead.innerHTML = `<tr>${ESTOQUE_CAD_COLS.map((col) => {
      const filtered = cadExcelState.cols[col.key] instanceof Set;
      const active = filtered || cadExcelState.sortKey === col.key;
      return `<th class="fin-excel-th${active ? " fin-excel-th--active" : ""}" scope="col"><span class="fin-excel-th__label">${escapeHtml(
        col.label
      )}</span><button type="button" class="fin-excel-filter-btn${
        filtered ? " is-filtered" : ""
      }" data-estoque-cad-excel-col="${escapeHtml(col.key)}" title="Filtro estilo Excel" aria-label="Filtro de ${escapeHtml(
        col.label
      )}">▾</button></th>`;
    }).join("")}</tr>`;
  }

  function abrirEstoqueCadExcelFiltro(btn, key) {
    fecharEstoqueCadExcelFiltro();
    const col = ESTOQUE_CAD_COLS.find((c) => c.key === key);
    if (!col || !btn) return;
    cadExcelOpen = key;
    btn.classList.add("is-open");
    const uniques = cadValoresUnicos(key);
    const selected = cadExcelState.cols[key];
    const isAll = !(selected instanceof Set);
    const pop = document.createElement("div");
    pop.className = "fin-excel-filter-pop estoque-cad-excel-pop";
    pop.setAttribute("role", "dialog");
    pop.setAttribute("aria-label", `Filtro ${col.label}`);
    pop.innerHTML = `
      <div class="fin-excel-filter-pop__sort">
        <button type="button" class="fin-excel-filter-pop__sort-btn" data-excel-sort="asc">↑ Ordenar A a Z</button>
        <button type="button" class="fin-excel-filter-pop__sort-btn" data-excel-sort="desc">↓ Ordenar Z a A</button>
      </div>
      <label class="fin-excel-filter-pop__search">
        <input type="search" placeholder="Pesquisar…" autocomplete="off" aria-label="Pesquisar valores" data-excel-search>
      </label>
      <label class="fin-excel-filter-pop__all"><input type="checkbox" data-excel-all ${isAll ? "checked" : ""}> (Selecionar tudo)</label>
      <div class="fin-excel-filter-pop__list" data-excel-list>
        ${
          uniques
            .map((v, i) => {
              const checked = isAll || selected.has(v) ? "checked" : "";
              return `<label class="fin-excel-filter-pop__item"><input type="checkbox" data-excel-idx="${i}" ${checked}> <span>${escapeHtml(
                v
              )}</span></label>`;
            })
            .join("") || `<p class="subtext">Sem valores.</p>`
        }
      </div>
      <div class="fin-excel-filter-pop__actions">
        <button type="button" class="btn-primary" data-excel-ok>OK</button>
        <button type="button" class="btn-primary btn-secondary-outline" data-excel-cancel>Cancelar</button>
        <button type="button" class="btn-primary btn-secondary-outline" data-excel-clear>Limpar</button>
      </div>`;
    document.body.appendChild(pop);
    const rect = btn.getBoundingClientRect();
    const popW = Math.max(260, Math.min(340, window.innerWidth - 16));
    let left = rect.left;
    if (left + popW > window.innerWidth - 8) left = Math.max(8, window.innerWidth - popW - 8);
    const top = rect.bottom + 4;
    pop.style.width = `${popW}px`;
    pop.style.left = `${left}px`;
    pop.style.top = `${top}px`;
    requestAnimationFrame(() => {
      const h = pop.offsetHeight;
      if (top + h > window.innerHeight - 8) {
        pop.style.top = `${Math.max(8, rect.top - h - 4)}px`;
      }
    });
    const rerender = () => {
      fecharEstoqueCadExcelFiltro();
      renderTabelaCadastro();
    };
    const search = pop.querySelector("[data-excel-search]");
    const allCb = pop.querySelector("[data-excel-all]");
    const syncAll = () => {
      const boxes = Array.from(pop.querySelectorAll("[data-excel-idx]"));
      const visible = boxes.filter((el) => el.closest(".fin-excel-filter-pop__item")?.style.display !== "none");
      if (allCb) allCb.checked = visible.length > 0 && visible.every((el) => el.checked);
    };
    search?.addEventListener("input", () => {
      const q = nkFiltroExcel(search.value);
      pop.querySelectorAll(".fin-excel-filter-pop__item").forEach((lab) => {
        const t = nkFiltroExcel(lab.textContent || "");
        lab.style.display = !q || t.includes(q) ? "" : "none";
      });
      syncAll();
    });
    allCb?.addEventListener("change", () => {
      pop.querySelectorAll(".fin-excel-filter-pop__item").forEach((lab) => {
        if (lab.style.display === "none") return;
        const cb = lab.querySelector("[data-excel-idx]");
        if (cb) cb.checked = allCb.checked;
      });
    });
    pop.querySelector("[data-excel-list]")?.addEventListener("change", syncAll);
    pop.querySelector("[data-excel-sort='asc']")?.addEventListener("click", () => {
      cadExcelState.sortKey = key;
      cadExcelState.sortDir = "asc";
      rerender();
    });
    pop.querySelector("[data-excel-sort='desc']")?.addEventListener("click", () => {
      cadExcelState.sortKey = key;
      cadExcelState.sortDir = "desc";
      rerender();
    });
    pop.querySelector("[data-excel-ok]")?.addEventListener("click", () => {
      const boxes = Array.from(pop.querySelectorAll("[data-excel-idx]"));
      const visible = boxes.filter((el) => el.closest(".fin-excel-filter-pop__item")?.style.display !== "none");
      const pool = visible.length ? visible : boxes;
      const checked = pool
        .filter((el) => el.checked)
        .map((el) => uniques[Number(el.getAttribute("data-excel-idx"))])
        .filter((v) => v != null);
      if (!checked.length || checked.length === pool.length) delete cadExcelState.cols[key];
      else cadExcelState.cols[key] = new Set(checked);
      rerender();
    });
    pop.querySelector("[data-excel-cancel]")?.addEventListener("click", () => fecharEstoqueCadExcelFiltro());
    pop.querySelector("[data-excel-clear]")?.addEventListener("click", () => {
      delete cadExcelState.cols[key];
      if (cadExcelState.sortKey === key) {
        cadExcelState.sortKey = "descricao";
        cadExcelState.sortDir = "asc";
      }
      rerender();
    });
    search?.focus();
  }

  function bindEstoqueCadExcelFiltros() {
    const table = $("estoqueTableCadastro");
    table?.addEventListener("click", (e) => {
      const btn = e.target?.closest?.("[data-estoque-cad-excel-col]");
      if (!btn || !table.contains(btn)) return;
      e.preventDefault();
      e.stopPropagation();
      const key = btn.getAttribute("data-estoque-cad-excel-col") || "";
      if (cadExcelOpen === key) {
        fecharEstoqueCadExcelFiltro();
        return;
      }
      fecharEstoqueSaldoExcelFiltro();
      abrirEstoqueCadExcelFiltro(btn, key);
    });
    const tableSaldo = $("estoqueTableSaldo");
    tableSaldo?.addEventListener("click", (e) => {
      const btn = e.target?.closest?.("[data-estoque-saldo-excel-col]");
      if (!btn || !tableSaldo.contains(btn)) return;
      e.preventDefault();
      e.stopPropagation();
      const key = btn.getAttribute("data-estoque-saldo-excel-col") || "";
      if (saldoExcelOpen === key) {
        fecharEstoqueSaldoExcelFiltro();
        return;
      }
      fecharEstoqueCadExcelFiltro();
      abrirEstoqueSaldoExcelFiltro(btn, key);
    });
    document.addEventListener("mousedown", (e) => {
      const t = e.target;
      if (cadExcelOpen) {
        const pop = document.querySelector(".estoque-cad-excel-pop");
        if (!pop?.contains(t) && !t?.closest?.("[data-estoque-cad-excel-col]")) fecharEstoqueCadExcelFiltro();
      }
      if (saldoExcelOpen) {
        const pop = document.querySelector(".estoque-saldo-excel-pop");
        if (!pop?.contains(t) && !t?.closest?.("[data-estoque-saldo-excel-col]")) fecharEstoqueSaldoExcelFiltro();
      }
    });
    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      if (cadExcelOpen) fecharEstoqueCadExcelFiltro();
      if (saldoExcelOpen) fecharEstoqueSaldoExcelFiltro();
    });
  }

  function renderTabelaCadastro() {
    const body = $("estoqueBodyCadastro");
    if (!body) return;
    renderEstoqueCadHead();
    const rows = cadLinhasFiltradas();
    if (!rows.length) {
      body.innerHTML = `<tr><td colspan="6" class="subtext">Nenhum material na planilha.</td></tr>`;
      return;
    }
    body.innerHTML = rows
      .map((r) => {
        const preco = precoDoCodigo(r.codigo);
        return `<tr><td>${escapeHtml(r.codigo || "")}</td><td>${escapeHtml(r.descricao || "")}</td><td>${escapeHtml(
          r.referencia || ""
        )}</td><td>${escapeHtml(r.fabricante || "")}</td><td>${preco > 0 ? formatMoney(preco) : "—"}</td><td>${escapeHtml(
          r.setor || ""
        )}</td></tr>`;
      })
      .join("");
  }

  const ESTOQUE_SALDO_COLS = [
    { key: "codigo", label: "CÓDIGO DE BARRAS" },
    { key: "descricao", label: "DESCRIÇÃO" },
    { key: "referencia", label: "REFERÊNCIA" },
    { key: "fabricante", label: "FABRICANTE" },
    { key: "qt", label: "QT", num: true },
    { key: "preco", label: "PREÇO", money: true },
    { key: "total", label: "TOTAL", money: true },
    { key: "setor", label: "SETOR" },
    { key: "entradas", label: "ENTRADAS", num: true },
    { key: "saidas", label: "SAIDAS", num: true },
    { key: "saldo", label: "SALDO", num: true },
  ];
  const saldoExcelState = { cols: {}, sortKey: "descricao", sortDir: "asc" };
  let saldoExcelOpen = "";

  function saldoView(r) {
    const extraEnt = qtdExtraEntrada(r.codigo);
    const preco = precoDoCodigo(r.codigo);
    const entradas = parseQtd(r.entradas) + extraEnt;
    const saidas = parseQtd(r.saidas);
    const saldo = parseQtd(r.saldo != null ? r.saldo : r.qt) + extraEnt;
    const total = preco > 0 ? preco * saldo : 0;
    return { row: r, extraEnt, preco, total, entradas, saidas, saldo };
  }

  function saldoCellDisplay(view, key) {
    const col = ESTOQUE_SALDO_COLS.find((c) => c.key === key);
    if (col?.money) return view[key] > 0 ? formatMoney(view[key]) : "—";
    if (key === "qt" || key === "entradas" || key === "saidas" || key === "saldo") {
      const n = key === "qt" ? view.row.qt : view[key];
      if (n == null || n === "") return "(vazio)";
      return String(n);
    }
    const v = String(view.row[key] || "").trim();
    return v || "(vazio)";
  }

  function saldoLinhasAntesDaColuna(openKey) {
    let views = estoqueTodos().map(saldoView);
    ESTOQUE_SALDO_COLS.forEach((col) => {
      if (col.key === openKey) return;
      const set = saldoExcelState.cols[col.key];
      if (!(set instanceof Set)) return;
      views = views.filter((v) => set.has(saldoCellDisplay(v, col.key)));
    });
    return views;
  }

  function saldoLinhasFiltradas() {
    const views = saldoLinhasAntesDaColuna("");
    const key = saldoExcelState.sortKey || "descricao";
    const dir = saldoExcelState.sortDir === "desc" ? -1 : 1;
    const col = ESTOQUE_SALDO_COLS.find((c) => c.key === key);
    views.sort((a, b) => {
      if (col?.money || col?.num) {
        const na = key === "qt" ? parseQtd(a.row.qt) : Number(a[key]) || 0;
        const nb = key === "qt" ? parseQtd(b.row.qt) : Number(b[key]) || 0;
        return (na - nb) * dir;
      }
      return saldoCellDisplay(a, key).localeCompare(saldoCellDisplay(b, key), "pt-BR") * dir;
    });
    return views;
  }

  function saldoValoresUnicos(openKey) {
    const seen = new Set();
    const out = [];
    saldoLinhasAntesDaColuna(openKey).forEach((v) => {
      const val = saldoCellDisplay(v, openKey);
      if (seen.has(val)) return;
      seen.add(val);
      out.push(val);
    });
    out.sort((a, b) => String(a).localeCompare(String(b), "pt-BR"));
    return out;
  }

  function fecharEstoqueSaldoExcelFiltro() {
    saldoExcelOpen = "";
    document.querySelectorAll(".estoque-saldo-excel-pop").forEach((el) => el.remove());
    document.querySelectorAll("#estoqueTableSaldo .fin-excel-filter-btn.is-open").forEach((b) => b.classList.remove("is-open"));
  }

  function renderEstoqueSaldoHead() {
    const thead = $("estoqueHeadSaldo");
    if (!thead) return;
    thead.innerHTML = `<tr>${ESTOQUE_SALDO_COLS.map((col) => {
      const filtered = saldoExcelState.cols[col.key] instanceof Set;
      const active = filtered || saldoExcelState.sortKey === col.key;
      return `<th class="fin-excel-th${active ? " fin-excel-th--active" : ""}" scope="col"><span class="fin-excel-th__label">${escapeHtml(
        col.label
      )}</span><button type="button" class="fin-excel-filter-btn${
        filtered ? " is-filtered" : ""
      }" data-estoque-saldo-excel-col="${escapeHtml(col.key)}" title="Filtro estilo Excel" aria-label="Filtro de ${escapeHtml(
        col.label
      )}">▾</button></th>`;
    }).join("")}</tr>`;
  }

  function abrirEstoqueSaldoExcelFiltro(btn, key) {
    fecharEstoqueSaldoExcelFiltro();
    const col = ESTOQUE_SALDO_COLS.find((c) => c.key === key);
    if (!col || !btn) return;
    saldoExcelOpen = key;
    btn.classList.add("is-open");
    const uniques = saldoValoresUnicos(key);
    const selected = saldoExcelState.cols[key];
    const isAll = !(selected instanceof Set);
    const pop = document.createElement("div");
    pop.className = "fin-excel-filter-pop estoque-saldo-excel-pop";
    pop.setAttribute("role", "dialog");
    pop.setAttribute("aria-label", `Filtro ${col.label}`);
    pop.innerHTML = `
      <div class="fin-excel-filter-pop__sort">
        <button type="button" class="fin-excel-filter-pop__sort-btn" data-excel-sort="asc">↑ Ordenar A a Z</button>
        <button type="button" class="fin-excel-filter-pop__sort-btn" data-excel-sort="desc">↓ Ordenar Z a A</button>
      </div>
      <label class="fin-excel-filter-pop__search">
        <input type="search" placeholder="Pesquisar…" autocomplete="off" aria-label="Pesquisar valores" data-excel-search>
      </label>
      <label class="fin-excel-filter-pop__all"><input type="checkbox" data-excel-all ${isAll ? "checked" : ""}> (Selecionar tudo)</label>
      <div class="fin-excel-filter-pop__list" data-excel-list>
        ${
          uniques
            .map((v, i) => {
              const checked = isAll || selected.has(v) ? "checked" : "";
              return `<label class="fin-excel-filter-pop__item"><input type="checkbox" data-excel-idx="${i}" ${checked}> <span>${escapeHtml(
                v
              )}</span></label>`;
            })
            .join("") || `<p class="subtext">Sem valores.</p>`
        }
      </div>
      <div class="fin-excel-filter-pop__actions">
        <button type="button" class="btn-primary" data-excel-ok>OK</button>
        <button type="button" class="btn-primary btn-secondary-outline" data-excel-cancel>Cancelar</button>
        <button type="button" class="btn-primary btn-secondary-outline" data-excel-clear>Limpar</button>
      </div>`;
    document.body.appendChild(pop);
    const rect = btn.getBoundingClientRect();
    const popW = Math.max(260, Math.min(340, window.innerWidth - 16));
    let left = rect.left;
    if (left + popW > window.innerWidth - 8) left = Math.max(8, window.innerWidth - popW - 8);
    const top = rect.bottom + 4;
    pop.style.width = `${popW}px`;
    pop.style.left = `${left}px`;
    pop.style.top = `${top}px`;
    requestAnimationFrame(() => {
      const h = pop.offsetHeight;
      if (top + h > window.innerHeight - 8) pop.style.top = `${Math.max(8, rect.top - h - 4)}px`;
    });
    const rerender = () => {
      fecharEstoqueSaldoExcelFiltro();
      renderTabelaEstoque();
    };
    const search = pop.querySelector("[data-excel-search]");
    const allCb = pop.querySelector("[data-excel-all]");
    const syncAll = () => {
      const boxes = Array.from(pop.querySelectorAll("[data-excel-idx]"));
      const visible = boxes.filter((el) => el.closest(".fin-excel-filter-pop__item")?.style.display !== "none");
      if (allCb) allCb.checked = visible.length > 0 && visible.every((el) => el.checked);
    };
    search?.addEventListener("input", () => {
      const q = nkFiltroExcel(search.value);
      pop.querySelectorAll(".fin-excel-filter-pop__item").forEach((lab) => {
        lab.style.display = !q || nkFiltroExcel(lab.textContent || "").includes(q) ? "" : "none";
      });
      syncAll();
    });
    allCb?.addEventListener("change", () => {
      pop.querySelectorAll(".fin-excel-filter-pop__item").forEach((lab) => {
        if (lab.style.display === "none") return;
        const cb = lab.querySelector("[data-excel-idx]");
        if (cb) cb.checked = allCb.checked;
      });
    });
    pop.querySelector("[data-excel-list]")?.addEventListener("change", syncAll);
    pop.querySelector("[data-excel-sort='asc']")?.addEventListener("click", () => {
      saldoExcelState.sortKey = key;
      saldoExcelState.sortDir = "asc";
      rerender();
    });
    pop.querySelector("[data-excel-sort='desc']")?.addEventListener("click", () => {
      saldoExcelState.sortKey = key;
      saldoExcelState.sortDir = "desc";
      rerender();
    });
    pop.querySelector("[data-excel-ok]")?.addEventListener("click", () => {
      const boxes = Array.from(pop.querySelectorAll("[data-excel-idx]"));
      const visible = boxes.filter((el) => el.closest(".fin-excel-filter-pop__item")?.style.display !== "none");
      const pool = visible.length ? visible : boxes;
      const checked = pool
        .filter((el) => el.checked)
        .map((el) => uniques[Number(el.getAttribute("data-excel-idx"))])
        .filter((v) => v != null);
      if (!checked.length || checked.length === pool.length) delete saldoExcelState.cols[key];
      else saldoExcelState.cols[key] = new Set(checked);
      rerender();
    });
    pop.querySelector("[data-excel-cancel]")?.addEventListener("click", () => fecharEstoqueSaldoExcelFiltro());
    pop.querySelector("[data-excel-clear]")?.addEventListener("click", () => {
      delete saldoExcelState.cols[key];
      if (saldoExcelState.sortKey === key) {
        saldoExcelState.sortKey = "descricao";
        saldoExcelState.sortDir = "asc";
      }
      rerender();
    });
    search?.focus();
  }

  function renderTabelaEstoque() {
    const body = $("estoqueBodySaldo");
    if (!body) return;
    renderEstoqueSaldoHead();
    const views = saldoLinhasFiltradas();
    if (!views.length) {
      body.innerHTML = `<tr><td colspan="11" class="subtext">Nenhum saldo na planilha.</td></tr>`;
      return;
    }
    body.innerHTML = views
      .map((v) => {
        const r = v.row;
        return `<tr><td>${escapeHtml(r.codigo || "")}</td><td>${escapeHtml(r.descricao || "")}</td><td>${escapeHtml(
          r.referencia || ""
        )}</td><td>${escapeHtml(r.fabricante || "")}</td><td>${escapeHtml(String(r.qt ?? ""))}</td><td>${
          v.preco > 0 ? formatMoney(v.preco) : "—"
        }</td><td>${v.total > 0 ? formatMoney(v.total) : "—"}</td><td>${escapeHtml(r.setor || "")}</td><td>${escapeHtml(
          String(v.entradas)
        )}</td><td>${escapeHtml(String(v.saidas))}</td><td>${escapeHtml(String(v.saldo))}</td></tr>`;
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
      body.innerHTML = `<tr><td colspan="10" class="subtext">Nenhuma entrada na planilha.</td></tr>`;
      return;
    }
    body.innerHTML = rows
      .map(
        (r) =>
          `<tr><td>${escapeHtml(r.codigo || "")}</td><td>${escapeHtml(r.descricao || "")}</td><td>${escapeHtml(
            r.referencia || ""
          )}</td><td>${escapeHtml(String(r.quantidade ?? ""))}</td><td>${
            (precoUnitarioDaEntrada(r) || precoDoCodigo(r.codigo)) > 0
              ? formatMoney(precoUnitarioDaEntrada(r) || precoDoCodigo(r.codigo))
              : "—"
          }</td><td>${escapeHtml(r.fornecedor || "")}</td><td>${escapeHtml(r.data || "")}</td><td>${escapeHtml(
            r.notaFiscal || ""
          )}</td><td>${
            parsePreco(r.valorNota) > 0 ? formatMoney(parsePreco(r.valorNota)) : escapeHtml(r.valorNota || "")
          }</td><td>${escapeHtml(r.formaPagamento || "")}</td></tr>`
      )
      .join("");
  }

  function isMotoVeiculo(v) {
    return /\bMOTO\b|MOTOCICLETA|SCOOTER/.test(String(v || "").toUpperCase());
  }

  function valorLinhaEstoque(r) {
    const extraEnt = qtdExtraEntrada(r.codigo);
    const saldo = parseQtd(r.saldo != null ? r.saldo : r.qt) + extraEnt;
    return precoDoCodigo(r.codigo) * saldo;
  }

  function totaisValorEstoque() {
    const usos = new Map();
    for (const s of saidasTodas()) {
      const k = nkBar(s.codigo);
      const v = String(s.veiculo || "").trim();
      if (!k || !v) continue;
      let rec = usos.get(k);
      if (!rec) {
        rec = { moto: 0, carro: 0 };
        usos.set(k, rec);
      }
      if (isMotoVeiculo(v)) rec.moto += 1;
      else rec.carro += 1;
    }
    let motos = 0;
    let carros = 0;
    for (const r of estoqueTodos()) {
      const v = valorLinhaEstoque(r);
      const rec = usos.get(nkBar(r.codigo));
      let tipo = "carro";
      if (rec && rec.moto > rec.carro) tipo = "moto";
      else if (rec && rec.carro > rec.moto) tipo = "carro";
      else {
        const desc = `${r.descricao || ""} ${r.referencia || ""}`.toUpperCase();
        if (
          /MOTO|MOTOCICLETA|COROA|PINH[AÃ]O|RELA[CÇ][AÃ]O|PNEU\s*(80|90|100|110|120)/.test(desc) &&
          !/RADIADOR|AMORTEC/.test(desc)
        ) {
          tipo = "moto";
        } else if (/LOCADORA/.test(String(r.setor || "").toUpperCase())) {
          tipo = "moto";
        }
      }
      if (tipo === "moto") motos += v;
      else carros += v;
    }
    return { motos, carros, total: motos + carros };
  }

  function atualizarKpis() {
    const cad = $("estoqueKpiCadastros");
    const sai = $("estoqueKpiSaidas");
    const ent = $("estoqueKpiEntradas");
    const vm = $("estoqueKpiValorMotos");
    const vc = $("estoqueKpiValorCarros");
    const vt = $("estoqueKpiValorTotal");
    if (cad) cad.textContent = String(cadastroTodos().length);
    if (sai) sai.textContent = String(saidasTodas().length);
    if (ent) ent.textContent = String(entradasTodas().length);
    const totais = totaisValorEstoque();
    if (vm) vm.textContent = formatMoney(totais.motos);
    if (vc) vc.textContent = formatMoney(totais.carros);
    if (vt) vt.textContent = formatMoney(totais.total);
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

  function materialJaCadastrado(codigo, descricao) {
    if (codigoValido(codigo) && cadastroDoCodigo(codigo)) return true;
    const d = String(descricao || "").trim().toUpperCase();
    if (!codigoValido(codigo) && d) {
      return cadastroTodos().some((r) => String(r.descricao || "").trim().toUpperCase() === d);
    }
    return false;
  }

  function garantirCadastroDoMaterial(row) {
    const codigo = String(row.codigo || "").trim();
    const descricao = String(row.descricao || "").trim();
    if (materialJaCadastrado(codigo, descricao)) return false;
    if (!codigoValido(codigo) && !descricao) return false;
    const extra = extrasCadastro();
    extra.unshift({
      codigo,
      descricao,
      referencia: row.referencia || "",
      fabricante: "",
      preco: precoUnitarioDaEntrada(row) || "",
      setor: "",
      origem: "entrada",
      gravadoEm: new Date().toISOString(),
    });
    localStorage.setItem("dk_estoque_cadastro_v1", JSON.stringify(extra));
    return true;
  }

  function preencherProdutoEntrada() {
    const codigo = $("estoqueEntradaCodigo")?.value || "";
    const cad = cadastroDoCodigo(codigo);
    const desc = $("estoqueEntradaDescricao");
    const ref = $("estoqueEntradaReferencia");
    const unit = $("estoqueEntradaValorUnitario");
    const msg = $("estoqueEntradaFormMsg");
    if (cad) {
      if (desc) desc.value = String(cad.descricao || "");
      if (ref) ref.value = String(cad.referencia || "");
      const preco = precoDoCodigo(codigo);
      if (unit && preco > 0) {
        unit.value = Number(preco).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      }
      if (msg) msg.textContent = "MATERIAL JÁ CADASTRADO";
      return;
    }
    if (msg && codigoValido(codigo)) msg.textContent = "";
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
    const valorUnitarioRaw = String($("estoqueEntradaValorUnitario")?.value || "").trim();
    const valorUnitario = parsePreco(valorUnitarioRaw);
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
      valorUnitario: valorUnitario > 0 ? valorUnitario : valorUnitarioRaw,
      formaPagamento,
      gravadoEm: new Date().toISOString(),
    };
    const jaCadastrado = materialJaCadastrado(codigo, descricao);
    const extra = extrasEntradas();
    extra.unshift(row);
    localStorage.setItem("dk_estoque_entradas_v1", JSON.stringify(extra));
    const precoRecente = precoUnitarioDaEntrada(row);
    if (precoRecente > 0) gravarPrecoRecente(codigo, precoRecente);
    let avisoCad = "";
    if (jaCadastrado) {
      avisoCad =
        precoRecente > 0
          ? `MATERIAL JÁ CADASTRADO. Preço mais recente ${formatMoney(precoRecente)}. `
          : "MATERIAL JÁ CADASTRADO. ";
    } else {
      garantirCadastroDoMaterial(row);
      if (precoRecente > 0) gravarPrecoRecente(codigo, precoRecente);
      avisoCad = "Material cadastrado automaticamente. ";
    }
    if (msg) msg.textContent = `${avisoCad}Entrada gravada: ${descricao || codigo} · ${quantidade} · ${formaPagamento}.`;
    if ($("estoqueEntradaCodigo")) $("estoqueEntradaCodigo").value = "";
    if ($("estoqueEntradaDescricao")) $("estoqueEntradaDescricao").value = "";
    if ($("estoqueEntradaReferencia")) $("estoqueEntradaReferencia").value = "";
    if ($("estoqueEntradaQtd")) $("estoqueEntradaQtd").value = "1";
    if ($("estoqueEntradaValorUnitario")) $("estoqueEntradaValorUnitario").value = "";
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

  function filtroOrigemRel(prefixo) {
    return {
      locadora: Boolean($(prefixo + "Locadora")?.checked),
      diversas: Boolean($(prefixo + "Diversas")?.checked),
    };
  }

  function filtroOrigemRelPlaca() {
    return filtroOrigemRel("estoqueRelPlaca");
  }

  function filtroOrigemRelCusto() {
    return filtroOrigemRel("estoqueRelCusto");
  }

  function filtroOrigemRelProduto() {
    return filtroOrigemRel("estoqueRelProduto");
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

  function nkTextoProduto(v) {
    return String(v || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase()
      .replace(/\bDO\b/g, " ")
      .replace(/\bDE\b/g, " ")
      .replace(/\bDA\b/g, " ")
      .replace(/(\d+)\s*W\s*(\d+)/g, "$1W$2")
      .replace(/[^A-Z0-9]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function familiaProduto(row) {
    const desc = nkTextoProduto(row?.descricao);
    const ref = nkTextoProduto(row?.referencia);
    const blob = `${desc} ${ref}`.trim();
    const visc = blob.match(/\b(\d+W\d+)\b/);
    if (/\bOLEO\b/.test(blob) && visc) return `OLEO MOTOR ${visc[1]}`;
    return desc || nkBar(row?.codigo);
  }

  function familiaDeCodigo(codigo) {
    const cad = cadastroDoCodigo(codigo);
    if (cad) return familiaProduto(cad);
    const sai = saidasTodas().find((s) => nkBar(s.codigo) === nkBar(codigo));
    return familiaProduto(sai || { codigo });
  }

  function saidasComData() {
    return saidasTodas()
      .map((s) => ({
        ...s,
        _data: parseDataBr(s.data),
        _plate: nkPlate(s.placa),
        _bar: nkBar(s.codigo),
        _fam: familiaProduto(s),
        _km: parseKm(s.km),
        _qtd: parseQtd(s.quantidade) || 1,
      }))
      .filter((s) => s._data && (s._bar || s._fam));
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
    const famQ = familiaProduto({ descricao: raw, referencia: raw });
    const porFam = saidasTodas().find((s) => familiaProduto(s) === famQ);
    if (porFam && famQ && famQ.length > 4) return porFam;
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

  function ciclosDoProduto(fam) {
    const porPlaca = new Map();
    saidasComData()
      .filter((s) => s._fam === fam || s._bar === fam)
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
    const origem = filtroOrigemRelProduto();
    if (!origem.locadora && !origem.diversas) {
      if (kpis) kpis.innerHTML = "";
      if (resumo) resumo.textContent = "Marque PLACAS CADASTRADAS NA DK LOCADORA e/ou PLACAS DIVERSAS.";
      box.innerHTML = `<p class="subtext">Nenhuma origem de placa marcada.</p>`;
      return;
    }
    const saidasPer = saidasComData().filter((s) => noPeriodo(s._data, per) && aceitaOrigemPlaca(s._plate, origem));

    if (!prod) {
      const porProd = new Map();
      saidasPer.forEach((s) => {
        const fam = s._fam || s._bar;
        if (!porProd.has(fam)) porProd.set(fam, []);
        porProd.get(fam).push(s);
      });
      const linhas = [...porProd.entries()]
        .map(([fam, lista]) => {
          const { ciclos } = ciclosDoProduto(fam);
          const ciclosPer = ciclos.filter((c) => noPeriodo(c.ate._data, per) && aceitaOrigemPlaca(c.plate, origem));
          const placas = new Set(lista.map((s) => s._plate).filter(Boolean));
          return {
            bar: fam,
            codigo: lista[0].codigo,
            descricao: fam.startsWith("OLEO MOTOR") ? fam : lista[0].descricao,
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

    const fam = familiaProduto(prod);
    const { porPlaca, ciclos } = ciclosDoProduto(fam);
    const aplicacoesPer = saidasPer.filter((s) => s._fam === fam || s._bar === nkBar(prod.codigo));
    const placasPer = new Set(aplicacoesPer.map((s) => s._plate).filter(Boolean));
    const ciclosPer = ciclos.filter((c) => aceitaOrigemPlaca(c.plate, origem) && (noPeriodo(c.ate._data, per) || placasPer.has(c.plate)));
    const mediaDias = media(ciclosPer.map((c) => c.dias).filter((n) => n != null));
    const mediaKm = media(ciclosPer.map((c) => c.km).filter((n) => n != null && n > 0));
    const codigosFam = [...new Set(aplicacoesPer.map((s) => s.codigo).filter(Boolean))];

    if (kpis) {
      kpis.innerHTML = kpisHtml([
        { lab: "Placas", val: String(placasPer.size || porPlaca.size) },
        { lab: "Aplicações no período", val: String(aplicacoesPer.length) },
        { lab: "Média de tempo", val: mediaDias == null ? "—" : `${formatNum(mediaDias, 1)} dias` },
        { lab: "Média de km", val: mediaKm == null ? "—" : `${formatNum(mediaKm, 0)} km` },
      ]);
    }
    if (resumo) {
      resumo.textContent = `${fam}: aplicado em ${placasPer.size} placa(s). Inclui ${codigosFam.length} código(s) da planilha do mesmo item. Média de km = soma dos intervalos na mesma placa ÷ quantidade de intervalos.`;
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
    const origem = filtroOrigemRelCusto();
    if (!origem.locadora && !origem.diversas) {
      if (kpis) kpis.innerHTML = "";
      if (resumo) resumo.textContent = "Marque PLACAS CADASTRADAS NA DK LOCADORA e/ou PLACAS DIVERSAS.";
      box.innerHTML = `<p class="subtext">Nenhuma origem de placa marcada.</p>`;
      return;
    }
    const rows = saidasComData()
      .filter((s) => noPeriodo(s._data, per) && (!filtro || s._plate === filtro) && aceitaOrigemPlaca(s._plate, origem))
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
    extrasEntradas().forEach((r) => garantirCadastroDoMaterial(r));
    atualizarKpis();
    renderTabelaCadastro();
    renderTabelaEstoque();
    renderTabelaEntradas();
    renderTabelaSaidas();
    preencherDatalist();
    preencherDatalistModelosPlaca();
    const listProd = $("estoqueRelProdutoList");
    if (listProd) listProd.innerHTML = produtosDatalistHtml();
  }

  function limparDadosSaida() {
    if ($("estoqueSaidaPlaca")) $("estoqueSaidaPlaca").value = "";
    if ($("estoqueSaidaModelo")) $("estoqueSaidaModelo").value = "";
    if ($("estoqueSaidaKm")) $("estoqueSaidaKm").value = "";
    if ($("estoqueSaidaData")) $("estoqueSaidaData").value = hojeBr();
    if ($("estoqueSaidaCodigo")) $("estoqueSaidaCodigo").value = "";
    if ($("estoqueSaidaQtd")) $("estoqueSaidaQtd").value = "1";
    if ($("estoqueSaidaVeiculo")) $("estoqueSaidaVeiculo").value = "";
    if ($("estoqueSaidaDescricao")) $("estoqueSaidaDescricao").value = "";
    if ($("estoqueSaidaReferencia")) $("estoqueSaidaReferencia").value = "";
    const msg = $("estoqueSaidaFormMsg");
    if (msg) msg.textContent = "Formulário limpo.";
    fecharResumo();
    $("estoqueSaidaPlaca")?.focus();
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
    bindEstoqueCadExcelFiltros();
    $("estoqueSaidaConferirBtn")?.addEventListener("click", (e) => {
      e.preventDefault();
      conferirUltimaAplicacao();
    });
    $("estoqueSaidaLimparBtn")?.addEventListener("click", (e) => {
      e.preventDefault();
      limparDadosSaida();
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
      aplicarMemoriaPlacaNaSaida(placaRaw, veiculoHint);
      const placa = nkPlate(placaRaw);
      if (nkBar($("estoqueSaidaCodigo")?.value || "") && placa && parseKm($("estoqueSaidaKm")?.value || "")) {
        conferirUltimaAplicacao({ silencioso: true });
      }
    }
    $("estoqueSaidaPlaca")?.addEventListener("change", () => {
      aoConfirmarPlacaSaida($("estoqueSaidaPlaca")?.value || "");
    });
    $("estoqueSaidaPlaca")?.addEventListener("blur", () => {
      aoConfirmarPlacaSaida($("estoqueSaidaPlaca")?.value || "");
    });
    let placaMemoTimer = 0;
    const gravarMemoTela = () => {
      gravarMemoriaPlaca($("estoqueSaidaPlaca")?.value || "", {
        modelo: $("estoqueSaidaModelo")?.value || "",
        tipo: $("estoqueSaidaVeiculo")?.value || "",
      });
    };
    $("estoqueSaidaModelo")?.addEventListener("input", () => {
      clearTimeout(placaMemoTimer);
      placaMemoTimer = setTimeout(gravarMemoTela, 350);
    });
    $("estoqueSaidaModelo")?.addEventListener("change", gravarMemoTela);
    $("estoqueSaidaVeiculo")?.addEventListener("change", gravarMemoTela);
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
      origemFn: filtroOrigemRelCusto,
    });
    ["estoqueRelCustoLocadora", "estoqueRelCustoDiversas"].forEach((id) => {
      $(id)?.addEventListener("change", () => renderRelatorioCusto());
    });
    ["estoqueRelProdutoLocadora", "estoqueRelProdutoDiversas"].forEach((id) => {
      $(id)?.addEventListener("change", () => renderRelatorioProduto());
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
