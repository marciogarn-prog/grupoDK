/**
 * Manutenção rápida (Locados) — sem moto reserva.
 * Persistência: dk_manutencoes_rapidas_v1 + registro do dia (rápidas + corretivas).
 * Contador de OS do sistema: OS000001, OS000002… (não editável).
 */
(function portalManutencaoRapida() {
  const STORAGE_KEY = "dk_manutencoes_rapidas_v1";
  const SUGESTAO_OLEO_KEY = "dk_manutencao_rapida_sugestao_oleo_v1";
  let lastSugestaoOleoAplicada = 0;
  const SETOR_KEY = "dk_portal_setor_movimentacoes_v1";
  const VEIC_KEYS = ["dk_veiculos_cadastro", "dk_portal_veiculos_cadastro", "dk_veiculos_frota_planilha"];
  const SERVICOS = [
    { id: "oleo", label: "Troca de óleo" },
    { id: "kit", label: "Troca de kit" },
    { id: "pastilhaDianteira", label: "Troca de pastilha dianteira" },
    { id: "pastilhaTraseira", label: "Troca de pastilha traseira" },
    { id: "pneuDianteiro", label: "Troca de pneu dianteiro" },
    { id: "pneuTraseiro", label: "Troca de pneu traseiro" },
  ];
  const FORMAS = [
    { id: "pix", label: "PIX" },
    { id: "especie", label: "Espécie" },
    { id: "cartao", label: "Cartão" },
    { id: "naoSeAplica", label: "NÃO SE APLICA" },
  ];
  const FORMAS_PAGAS = FORMAS.filter((f) => f.id !== "naoSeAplica");
  const CAL_DOW = ["S", "T", "Q", "Q", "S", "S", "D"];
  const CAL_MES = [
    "janeiro",
    "fevereiro",
    "março",
    "abril",
    "maio",
    "junho",
    "julho",
    "agosto",
    "setembro",
    "outubro",
    "novembro",
    "dezembro",
  ];

  let relModo = "geral";
  let osTelaModo = "periodo";
  const osCal = {
    deView: { y: 0, m: 0 },
    ateView: { y: 0, m: 0 },
    deYmd: "",
    ateYmd: "",
  };

  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function nkPlate(raw) {
    if (typeof window.normalizePlate === "function") return window.normalizePlate(raw);
    return String(raw || "")
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "");
  }

  function onlyDigits(s) {
    return String(s || "").replace(/\D/g, "");
  }

  function todayYmd() {
    return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
  }

  function ymdFromIso(iso) {
    const ms = Date.parse(iso || "");
    if (!Number.isFinite(ms)) return "";
    return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date(ms));
  }

  function ymdToBr(ymd) {
    const m = String(ymd || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
  }

  function parseBrDate(raw) {
    const m = String(raw || "").trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!m) return "";
    return `${m[3]}-${m[2]}-${m[1]}`;
  }

  function formatBrDateInput(el) {
    const d = onlyDigits(el.value).slice(0, 8);
    if (d.length <= 2) el.value = d;
    else if (d.length <= 4) el.value = `${d.slice(0, 2)}/${d.slice(2)}`;
    else el.value = `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
  }

  function formatHora(iso) {
    const ms = Date.parse(iso || "");
    if (!Number.isFinite(ms)) return "—";
    return new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo",
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(ms));
  }

  function parseValor(raw) {
    const s = String(raw || "")
      .replace(/[^\d,.-]/g, "")
      .replace(/\./g, "")
      .replace(",", ".");
    const n = Number(s);
    return Number.isFinite(n) ? n : 0;
  }

  function formatBrl(n) {
    return (Number(n) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }

  function maskValor(el) {
    const cents = onlyDigits(el.value);
    el.value = formatBrl(Number(cents || "0") / 100);
  }

  function formatOs(n) {
    const num = Math.max(1, Math.floor(Number(n) || 1));
    return `OS${String(num).padStart(6, "0")}`;
  }

  function osNumero(os) {
    const m = String(os || "")
      .toUpperCase()
      .trim()
      .match(/^OS(\d{1,8})$/);
    return m ? Number(m[1]) : 0;
  }

  function maxOsNumero(list) {
    let max = 0;
    (Array.isArray(list) ? list : []).forEach((r) => {
      max = Math.max(max, osNumero(r && r.os));
    });
    return max;
  }

  function proximoOsNumero(list) {
    return maxOsNumero(list) + 1;
  }

  function backfillOs(list) {
    const rows = (Array.isArray(list) ? list : []).map((r) => (r && typeof r === "object" ? { ...r } : r));
    const missing = rows.filter((r) => r && typeof r === "object" && osNumero(r.os) <= 0);
    if (!missing.length) return { list: rows, changed: false };
    missing.sort((a, b) => Date.parse(a.criadoEm || a.createdAt || 0) - Date.parse(b.criadoEm || b.createdAt || 0));
    let n = maxOsNumero(rows);
    missing.forEach((r) => {
      n += 1;
      r.os = formatOs(n);
    });
    return { list: rows, changed: true };
  }

  function loadArr(key) {
    if (typeof window.loadCadastro === "function") {
      const a = window.loadCadastro(key);
      return Array.isArray(a) ? a : [];
    }
    try {
      const raw = localStorage.getItem(key);
      const a = raw ? JSON.parse(raw) : [];
      return Array.isArray(a) ? a : [];
    } catch {
      return [];
    }
  }

  function saveArr(key, list) {
    if (typeof window.saveCadastro === "function") {
      window.saveCadastro(key, list);
      return;
    }
    localStorage.setItem(key, JSON.stringify(list));
  }

  function persistOsBackfill() {
    const { list, changed } = backfillOs(loadArr(STORAGE_KEY));
    if (changed) {
      saveArr(STORAGE_KEY, list);
      if (typeof window.__DK_pushCloudSnapshotNow === "function") {
        void window.__DK_pushCloudSnapshotNow();
      }
    }
    return list;
  }

  function atualizarCaixaOs(list) {
    const el = document.getElementById("portalManutOsCaixa");
    if (!el) return;
    el.textContent = formatOs(proximoOsNumero(list || loadArr(STORAGE_KEY)));
  }

  function operador() {
    if (typeof window.__DK_getPortalOperadorConferenciaSessao === "function") {
      const o = window.__DK_getPortalOperadorConferenciaSessao();
      if (o) return o;
    }
    return { cpf: "", nome: "Operador" };
  }

  function servicosMarcados() {
    const out = {};
    SERVICOS.forEach((s) => {
      const el = document.querySelector(`[data-manut-rapida-serv="${s.id}"]`);
      out[s.id] = Boolean(el && el.checked);
    });
    return out;
  }

  function formasMarcadasNoGrupo(grupo) {
    const root = document.querySelector(`[data-manut-rapida-pag-grupo="${grupo}"]`);
    const attr = Number(grupo) === 2 ? "data-manut-rapida-pag2" : "data-manut-rapida-pag";
    const out = {};
    FORMAS.forEach((f) => {
      const el = root?.querySelector(`[${attr}="${f.id}"]`);
      out[f.id] = Boolean(el && el.checked);
    });
    return out;
  }

  function formasMarcadas() {
    const a = formasMarcadasNoGrupo(1);
    const b = formasMarcadasNoGrupo(2);
    const out = {};
    FORMAS.forEach((f) => {
      out[f.id] = Boolean(a[f.id] || b[f.id]);
    });
    if ((a.pix || a.especie || a.cartao || b.pix || b.especie || b.cartao) && (valorGrupo(1) > 0 || valorGrupo(2) > 0)) {
      out.naoSeAplica = Boolean(a.naoSeAplica && b.naoSeAplica);
    }
    return out;
  }

  function valorGrupo(grupo) {
    const id = Number(grupo) === 2 ? "portalManutRapidaValor2" : "portalManutRapidaValor";
    const formas = formasMarcadasNoGrupo(grupo);
    if (formas.naoSeAplica) return 0;
    return parseValor(document.getElementById(id)?.value || "");
  }

  function atualizarTotalPago() {
    const el = document.getElementById("portalManutRapidaValorTotal");
    if (!el) return;
    const tot = valorGrupo(1) + valorGrupo(2);
    el.value = tot > 0 ? formatBrl(tot) : formatBrl(0);
  }

  function ehAdminManutencao() {
    return typeof window.__DK_getPortalSessaoAdminRole === "function" && window.__DK_getPortalSessaoAdminRole() === "owner";
  }

  function hidratarDataLancamento() {
    const inp = document.getElementById("portalManutRapidaData");
    if (!inp) return;
    if (!parseBrDate(inp.value)) inp.value = ymdToBr(todayYmd());
  }

  function dataLancamentoYmd() {
    return parseBrDate(document.getElementById("portalManutRapidaData")?.value || "") || todayYmd();
  }

  function ymdDoRegistro(r) {
    const ymd = String(r?.dataLancamento || "").trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return ymd;
    return ymdFromIso(r?.createdAt || r?.criadoEm);
  }

  function ultimoKmTrocaOleo(placa) {
    const p = nkPlate(placa);
    if (!p) return "";
    const rows = persistOsBackfill()
      .filter((r) => nkPlate(r.placa) === p && r.servicos && r.servicos.oleo)
      .sort((a, b) => Date.parse(b.criadoEm || b.createdAt || 0) - Date.parse(a.criadoEm || a.createdAt || 0));
    const last = rows[0];
    return last ? onlyDigits(last.kmAtual || last.km || "") : "";
  }

  function preencherKmOleoDaPlaca(placa) {
    const el = document.getElementById("portalManutRapidaKmOleo");
    if (!el) return;
    el.value = ultimoKmTrocaOleo(placa) || "";
  }

  function labelsServicos(rec) {
    const serv = rec.servicos || {};
    return SERVICOS.filter((s) => serv[s.id]).map((s) => s.label).join(", ") || "—";
  }

  function listaLabelsServicos(rec) {
    const serv = rec.servicos || {};
    return SERVICOS.filter((s) => serv[s.id]).map((s) => s.label);
  }

  function labelsFormas(rec) {
    const partes = [];
    const pushParte = (formas, valor) => {
      if (!formas || formas.naoSeAplica || !(Number(valor) > 0)) return;
      const lab = FORMAS_PAGAS.filter((x) => formas[x.id]).map((x) => x.label).join("/");
      if (lab) partes.push(`${lab} ${formatBrl(valor)}`);
    };
    if (rec.formas1 || rec.formas2 || rec.valorPago1 != null || rec.valorPago2 != null) {
      pushParte(rec.formas1, rec.valorPago1);
      pushParte(rec.formas2, rec.valorPago2);
      if (partes.length) return partes.join(" + ");
    }
    const f = rec.formas || {};
    return FORMAS.filter((x) => f[x.id]).map((x) => x.label).join(" + ") || "—";
  }

  function listPlacas(q) {
    const needle = nkPlate(q);
    const seen = new Set();
    const out = [];
    const add = (raw, extra) => {
      const placa = nkPlate(raw);
      if (!placa || seen.has(placa)) return;
      if (needle && !placa.includes(needle)) return;
      seen.add(placa);
      out.push({ placa, extra: extra || "" });
    };
    if (typeof window.__DK_portalListPlacasLocadosAtivas === "function") {
      (window.__DK_portalListPlacasLocadosAtivas(q) || []).forEach((r) => add(r.placa || r, r.nome || r.modelo || ""));
    }
    VEIC_KEYS.forEach((key) => {
      loadArr(key).forEach((v) => add(v.placa, v.modelo || v.nome || ""));
    });
    out.sort((a, b) => String(a.placa).localeCompare(String(b.placa)));
    return out;
  }

  function listPlacasConsulta(q) {
    const needle = nkPlate(q);
    const seen = new Set();
    const out = [];
    const add = (raw, extra) => {
      const placa = nkPlate(raw);
      if (!placa || seen.has(placa)) return;
      if (needle && !placa.includes(needle)) return;
      seen.add(placa);
      out.push({ placa, extra: extra || "" });
    };
    persistOsBackfill().forEach((r) => add(r.placa, r.os || ""));
    listPlacas(q).forEach((r) => add(r.placa || r, r.nome || r.modelo || ""));
    VEIC_KEYS.forEach((key) => {
      loadArr(key).forEach((v) => add(v.placa, v.modelo || v.nome || ""));
    });
    out.sort((a, b) => String(a.placa).localeCompare(String(b.placa)));
    return out;
  }

  function hidePlacaLista() {
    const panel = document.getElementById("portalManutRapidaPlacaLista");
    const inp = document.getElementById("portalManutRapidaPlaca");
    if (panel) {
      panel.classList.add("hidden");
      panel.hidden = true;
      panel.innerHTML = "";
    }
    if (inp) inp.setAttribute("aria-expanded", "false");
  }

  function renderPlacaLista(q) {
    const panel = document.getElementById("portalManutRapidaPlacaLista");
    const inp = document.getElementById("portalManutRapidaPlaca");
    if (!panel) return;
    if (!nkPlate(q)) {
      hidePlacaLista();
      return;
    }
    const rows = listPlacas(q).slice(0, 40);
    if (!rows.length) {
      hidePlacaLista();
      return;
    }
    panel.innerHTML = rows
      .map((r) => {
        const placa = esc(r.placa || r);
        const extra = r.nome || r.modelo ? ` · ${esc(r.nome || r.modelo)}` : "";
        return `<button type="button" class="portal-placa-dropdown__opt" role="option" data-placa="${placa}">${placa}${extra}</button>`;
      })
      .join("");
    panel.classList.remove("hidden");
    panel.hidden = false;
    if (inp) inp.setAttribute("aria-expanded", "true");
  }

  function hideOsPlacaLista() {
    const panel = document.getElementById("portalManutOsTelaPlacaLista");
    const inp = document.getElementById("portalManutOsTelaPlaca");
    if (panel) {
      panel.classList.add("hidden");
      panel.hidden = true;
      panel.innerHTML = "";
    }
    if (inp) inp.setAttribute("aria-expanded", "false");
  }

  function renderOsPlacaLista(q) {
    const panel = document.getElementById("portalManutOsTelaPlacaLista");
    const inp = document.getElementById("portalManutOsTelaPlaca");
    if (!panel) return;
    const rows = listPlacasConsulta(q).slice(0, 50);
    if (!rows.length) {
      hideOsPlacaLista();
      return;
    }
    panel.innerHTML = rows
      .map((r) => {
        const extra = r.extra ? ` · ${esc(r.extra)}` : "";
        return `<button type="button" class="portal-placa-dropdown__opt" role="option" data-placa="${esc(r.placa)}">${esc(r.placa)}${extra}</button>`;
      })
      .join("");
    panel.classList.remove("hidden");
    panel.hidden = false;
    if (inp) inp.setAttribute("aria-expanded", "true");
  }

  function setMsg(text, ok) {
    const el = document.getElementById("portalManutRapidaMsg");
    if (!el) return;
    el.textContent = text || "";
    el.classList.toggle("portal-feedback--ok", Boolean(ok));
  }

  function readSugestaoOleo() {
    return parseValor(document.getElementById("portalManutRapidaSugestaoOleo")?.value || "");
  }

  function persistSugestaoOleo(opts) {
    const n = readSugestaoOleo();
    const payload = { oleo: n, updatedAt: new Date().toISOString() };
    try {
      localStorage.setItem(SUGESTAO_OLEO_KEY, JSON.stringify(payload));
    } catch {
      /* ignore */
    }
    if (opts && opts.push && typeof window.__DK_pushCloudSnapshotNow === "function") {
      void window.__DK_pushCloudSnapshotNow();
    }
  }

  function loadSugestaoOleo() {
    let n = 0;
    if (typeof window.loadCadastro === "function") {
      const o = window.loadCadastro(SUGESTAO_OLEO_KEY);
      if (o && typeof o === "object" && !Array.isArray(o)) n = Number(o.oleo) || 0;
    }
    if (!n) {
      try {
        const raw = localStorage.getItem(SUGESTAO_OLEO_KEY);
        if (raw) {
          const o = JSON.parse(raw);
          n = typeof o === "object" && o ? Number(o.oleo) || parseValor(raw) : parseValor(raw);
        }
      } catch {
        /* ignore */
      }
    }
    return Number.isFinite(n) ? n : 0;
  }

  function hidratarSugestaoOleo() {
    const inp = document.getElementById("portalManutRapidaSugestaoOleo");
    if (!inp) return;
    const n = loadSugestaoOleo();
    inp.value = n > 0 ? formatBrl(n) : "";
    lastSugestaoOleoAplicada = n;
  }

  function aplicarSugestaoOleoNoValor() {
    const oleo = document.querySelector('[data-manut-rapida-serv="oleo"]');
    if (!oleo?.checked) return;
    if (document.querySelector('[data-manut-rapida-pag="naoSeAplica"]')?.checked) return;
    const valor = document.getElementById("portalManutRapidaValor");
    if (!valor) return;
    const sug = readSugestaoOleo();
    const atual = parseValor(valor.value);
    if (atual > 0 && atual !== lastSugestaoOleoAplicada) return;
    valor.value = sug > 0 ? formatBrl(sug) : "";
    lastSugestaoOleoAplicada = sug;
    atualizarTotalPago();
  }

  function limparForm() {
    const placa = document.getElementById("portalManutRapidaPlaca");
    const km = document.getElementById("portalManutRapidaKm");
    const kmOleo = document.getElementById("portalManutRapidaKmOleo");
    const valor = document.getElementById("portalManutRapidaValor");
    const valor2 = document.getElementById("portalManutRapidaValor2");
    const data = document.getElementById("portalManutRapidaData");
    if (placa) placa.value = "";
    if (km) km.value = "";
    if (kmOleo) kmOleo.value = "";
    if (valor) valor.value = "";
    if (valor2) valor2.value = "";
    if (data) data.value = ymdToBr(todayYmd());
    document
      .querySelectorAll("[data-manut-rapida-serv], [data-manut-rapida-pag], [data-manut-rapida-pag2]")
      .forEach((el) => {
        el.checked = false;
      });
    atualizarTotalPago();
    hidePlacaLista();
  }

  function gravar() {
    const placa = nkPlate(document.getElementById("portalManutRapidaPlaca")?.value || "");
    const naLista = listPlacas(placa).some((x) => nkPlate(x.placa || x) === placa);
    if (!placa || !naLista) {
      setMsg("Escolha uma placa da lista deste plano.");
      return;
    }
    const serv = servicosMarcados();
    if (!SERVICOS.some((s) => serv[s.id])) {
      setMsg("Marque pelo menos um serviço rápido.");
      return;
    }
    const g1 = formasMarcadasNoGrupo(1);
    const g2 = formasMarcadasNoGrupo(2);
    let v1 = valorGrupo(1);
    let v2 = valorGrupo(2);
    if (!g1.naoSeAplica && serv.oleo && v1 <= 0) {
      v1 = readSugestaoOleo();
    }
    if (g1.naoSeAplica) v1 = 0;
    if (g2.naoSeAplica) v2 = 0;
    const temPago1 = FORMAS_PAGAS.some((f) => g1[f.id]);
    const temPago2 = FORMAS_PAGAS.some((f) => g2[f.id]);
    if (v1 > 0 && !temPago1 && !g1.naoSeAplica) {
      setMsg("Na 1ª caixa, marque PIX, espécie ou cartão. Se o serviço é da DK Locadora, marque NÃO SE APLICA.");
      return;
    }
    if (v2 > 0 && !temPago2 && !g2.naoSeAplica) {
      setMsg("Na 2ª caixa, marque PIX, espécie ou cartão. Se o serviço é da DK Locadora, marque NÃO SE APLICA.");
      return;
    }
    if (v1 <= 0 && v2 <= 0 && !g1.naoSeAplica && !g2.naoSeAplica) {
      setMsg("Informe o valor e a forma (PIX, espécie ou cartão) ou marque NÃO SE APLICA.");
      return;
    }
    const valor = v1 + v2;
    const formas = {
      pix: Boolean(g1.pix || g2.pix),
      especie: Boolean(g1.especie || g2.especie),
      cartao: Boolean(g1.cartao || g2.cartao),
      naoSeAplica: valor <= 0 && Boolean(g1.naoSeAplica || g2.naoSeAplica),
    };
    const op = operador();
    const atuais = persistOsBackfill();
    const os = formatOs(proximoOsNumero(atuais));
    const kmAtual = onlyDigits(document.getElementById("portalManutRapidaKm")?.value || "");
    const kmOleo = onlyDigits(document.getElementById("portalManutRapidaKmOleo")?.value || "");
    const rec = {
      id: `MR-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      tipo: "rapida",
      os,
      placa,
      km: kmAtual,
      kmAtual,
      kmOleoAnterior: kmOleo,
      servicos: serv,
      valorPago: valor,
      valorPago1: v1,
      valorPago2: v2,
      formas,
      formas1: g1,
      formas2: g2,
      dataLancamento: dataLancamentoYmd(),
      plano: typeof window.__DK_portalGetManutSetorAtivo === "function" ? window.__DK_portalGetManutSetorAtivo() : "",
      criadoEm: new Date().toISOString(),
      cadastradoPorCpf: op.cpf || "",
      cadastradoPorNome: op.nome || "Operador",
      origemPortal: true,
    };
    const next = atuais.concat([rec]);
    saveArr(STORAGE_KEY, next);
    if (typeof window.addAuditLog === "function") {
      addAuditLog("manutencao_rapida", "gravar", `${os} · ${placa} · ${labelsServicos(rec)}`);
    }
    if (typeof window.__DK_pushCloudSnapshotNow === "function") {
      void window.__DK_pushCloudSnapshotNow();
    }
    limparForm();
    renderDia();
    setMsg(`Manutenção rápida gravada — ${os} · ${placa}.`, true);
  }

  function linhasDoPeriodo(deYmd, ateYmd, placaFiltro) {
    const rapidas = persistOsBackfill().map((r) => ({
      createdAt: r.criadoEm,
      dataLancamento: r.dataLancamento || "",
      tipo: "Rápida",
      os: r.os || "",
      placa: r.placa,
      detalhe: labelsServicos(r),
      servicos: listaLabelsServicos(r),
      valor: r.valorPago,
      forma: labelsFormas(r),
      km: r.kmAtual || r.km || "",
      operador: r.cadastradoPorNome || "—",
      operadorCpf: r.cadastradoPorCpf || "",
    }));
    const corretivas = loadArr(SETOR_KEY)
      .filter((r) => {
        const de = String(r.de || "");
        const para = String(r.para || "");
        const deLoc = /minha-moto|meu-transporte|carros/.test(de);
        const paraManut = /triagem|oficina|seguro|sinistro/.test(para);
        return deLoc && paraManut;
      })
      .map((r) => ({
        createdAt: r.createdAt || r.criadoEm,
        tipo: "Corretiva",
        os: "",
        placa: r.placa,
        detalhe: `${r.deLabel || r.de || ""} → ${r.paraLabel || r.para || ""}`,
        servicos: [],
        valor: "",
        forma: "—",
        km: "",
        operador: r.operadorLabel || r.operadorNome || "—",
        operadorCpf: r.operadorCpf || r.cadastradoPorCpf || "",
      }));
    const placa = nkPlate(placaFiltro);
    return rapidas
      .concat(corretivas)
      .filter((r) => {
        const ymd = ymdDoRegistro(r);
        if (deYmd && ymd && ymd < deYmd) return false;
        if (ateYmd && ymd && ymd > ateYmd) return false;
        if (placa && nkPlate(r.placa) !== placa) return false;
        return true;
      })
      .sort((a, b) => Date.parse(b.createdAt || 0) - Date.parse(a.createdAt || 0));
  }

  function tabelaHtml(rows) {
    if (!rows.length) return `<p class="subtext">Nenhum lançamento neste período.</p>`;
    const body = rows
      .map(
        (r) => `<tr>
        <td>${esc(r.os || "—")}</td>
        <td>${esc(formatHora(r.createdAt))}</td>
        <td>${esc(r.tipo)}</td>
        <td><strong>${esc(r.placa)}</strong></td>
        <td>${esc(r.detalhe)}</td>
        <td>${r.km ? esc(r.km) : "—"}</td>
        <td>${r.valor === "" ? "—" : esc(formatBrl(r.valor))}</td>
        <td>${esc(r.forma)}</td>
        <td>${esc(r.operador)}</td>
      </tr>`
      )
      .join("");
    return `<table><thead><tr><th>OS</th><th>Quando</th><th>Tipo</th><th>Placa</th><th>Serviço / destino</th><th>KM</th><th>Valor</th><th>Pagamento</th><th>Operador</th></tr></thead><tbody>${body}</tbody></table>`;
  }

  function linhasRapidasPeriodo(deYmd, ateYmd, placaFiltro) {
    return linhasDoPeriodo(deYmd, ateYmd, placaFiltro).filter((r) => r.tipo === "Rápida");
  }

  function htmlPeriodoAgrupado(rows) {
    if (!rows.length) return `<p class="subtext">Nenhum lançamento neste período.</p>`;
    const byDay = new Map();
    rows
      .slice()
      .sort((a, b) => String(ymdFromIso(a.createdAt)).localeCompare(String(ymdFromIso(b.createdAt))) || String(a.placa).localeCompare(String(b.placa)))
      .forEach((r) => {
        const day = ymdFromIso(r.createdAt) || "sem-data";
        if (!byDay.has(day)) byDay.set(day, new Map());
        const byPlaca = byDay.get(day);
        const placa = nkPlate(r.placa) || "—";
        if (!byPlaca.has(placa)) byPlaca.set(placa, []);
        byPlaca.get(placa).push(r);
      });
    const parts = [];
    byDay.forEach((byPlaca, day) => {
      parts.push(`<section class="portal-manut-os-grupo"><h4 class="portal-manut-os-grupo__dia">${esc(ymdToBr(day) || day)}</h4>`);
      byPlaca.forEach((lancs, placa) => {
        parts.push(`<article class="portal-manut-os-grupo__placa"><h5>${esc(placa)}</h5>`);
        lancs.forEach((r) => {
          const servs = (r.servicos && r.servicos.length ? r.servicos : [r.detalhe]).filter(Boolean);
          parts.push(`<div class="portal-manut-os-grupo__os"><strong>${esc(r.os || "—")}</strong> · KM ${esc(r.km || "—")} · ${esc(r.forma)} · ${esc(formatBrl(r.valor))}</div>`);
          servs.forEach((s) => {
            parts.push(`<p class="portal-manut-os-grupo__serv">${esc(s)}</p>`);
          });
        });
        parts.push(`</article>`);
      });
      parts.push(`</section>`);
    });
    return parts.join("");
  }

  function htmlVeiculoAgrupado(rows, placa) {
    if (!nkPlate(placa)) return `<p class="subtext">Consulta da placa: informe a placa do veículo.</p>`;
    if (!rows.length) return `<p class="subtext">Nenhum histórico de manutenção rápida para ${esc(nkPlate(placa))}.</p>`;
    const byDay = new Map();
    rows
      .slice()
      .sort((a, b) => String(ymdFromIso(a.createdAt)).localeCompare(String(ymdFromIso(b.createdAt))) || osNumero(a.os) - osNumero(b.os))
      .forEach((r) => {
        const day = ymdFromIso(r.createdAt) || "sem-data";
        if (!byDay.has(day)) byDay.set(day, []);
        byDay.get(day).push(r);
      });
    const parts = [`<p class="portal-manut-os-veiculo-placa">Placa <strong>${esc(nkPlate(placa))}</strong></p>`];
    byDay.forEach((lancs, day) => {
      parts.push(`<section class="portal-manut-os-grupo"><h4 class="portal-manut-os-grupo__dia">${esc(ymdToBr(day) || day)}</h4>`);
      lancs.forEach((r) => {
        const servs = (r.servicos && r.servicos.length ? r.servicos : [r.detalhe]).filter(Boolean);
        parts.push(`<article class="portal-manut-os-grupo__os-bloco">`);
        parts.push(`<div class="portal-manut-os-grupo__os"><strong>${esc(r.os || "—")}</strong> · KM ${esc(r.km || "—")} · ${esc(r.forma)}</div>`);
        servs.forEach((s) => {
          parts.push(`<p class="portal-manut-os-grupo__serv">${esc(s)}</p>`);
        });
        parts.push(`<p class="portal-manut-os-grupo__valor">${esc(formatBrl(r.valor))}</p>`);
        parts.push(`</article>`);
      });
      parts.push(`</section>`);
    });
    return parts.join("");
  }

  function renderDia() {
    const list = persistOsBackfill();
    atualizarCaixaOs(list);
    const ymd = todayYmd();
    const admin = ehAdminManutencao();
    const cpfOp = onlyDigits(operador().cpf);
    let rows = linhasDoPeriodo("", "", "").filter((r) => ymdFromIso(r.createdAt) === ymd);
    if (!admin) {
      rows = rows.filter((r) => onlyDigits(r.operadorCpf) === cpfOp);
    }
    const resumo = document.getElementById("portalManutDiaResumo");
    const body = document.getElementById("portalManutDiaRegistroBody");
    const tit = document.getElementById("portalManutDiaTitulo");
    if (tit) tit.textContent = admin ? "Registro do dia — todos os operadores" : "Registro do dia";
    if (resumo) {
      const nRap = rows.filter((r) => r.tipo === "Rápida").length;
      const nCor = rows.filter((r) => r.tipo === "Corretiva").length;
      const tot = rows.filter((r) => r.tipo === "Rápida").reduce((s, r) => s + (Number(r.valor) || 0), 0);
      const quem = admin ? "de todos" : "os seus";
      resumo.textContent = rows.length
        ? `${rows.length} lançamento(s) hoje (${quem}) · ${nRap} rápida(s) · ${nCor} corretiva(s) · ${formatBrl(tot)}`
        : admin
          ? "Nenhum lançamento hoje."
          : "Nenhum lançamento seu hoje.";
    }
    if (body) body.innerHTML = tabelaHtml(rows);
  }

  function openRel(modo) {
    relModo = modo === "moto" ? "moto" : "geral";
    const modal = document.getElementById("portalManutLancRelatorioModal");
    const tit = document.getElementById("portalManutLancRelatorioTitulo");
    const wrap = document.getElementById("portalManutLancRelPlacaWrap");
    if (tit) tit.textContent = relModo === "moto" ? "Relatório por moto" : "Relatório geral de manutenções";
    if (wrap) wrap.hidden = relModo !== "moto";
    const de = document.getElementById("portalManutLancRelDe");
    const ate = document.getElementById("portalManutLancRelAte");
    const hoje = todayYmd();
    const [y, m, d] = hoje.split("-");
    const br = `${d}/${m}/${y}`;
    if (de && !de.value) de.value = br;
    if (ate && !ate.value) ate.value = br;
    renderRel();
    if (modal) {
      modal.classList.remove("hidden");
      modal.setAttribute("aria-hidden", "false");
    }
  }

  function closeRel() {
    const modal = document.getElementById("portalManutLancRelatorioModal");
    if (!modal) return;
    modal.classList.add("hidden");
    modal.setAttribute("aria-hidden", "true");
  }

  function rowsRel() {
    const de = parseBrDate(document.getElementById("portalManutLancRelDe")?.value || "");
    const ate = parseBrDate(document.getElementById("portalManutLancRelAte")?.value || "");
    const placa = relModo === "moto" ? document.getElementById("portalManutLancRelPlaca")?.value || "" : "";
    return linhasDoPeriodo(de, ate, placa);
  }

  function renderRel() {
    const lista = document.getElementById("portalManutLancRelatorioLista");
    if (!lista) return;
    if (relModo === "moto" && !nkPlate(document.getElementById("portalManutLancRelPlaca")?.value || "")) {
      lista.innerHTML = `<p class="subtext">Informe a placa da moto.</p>`;
      return;
    }
    lista.innerHTML = tabelaHtml(rowsRel());
  }

  function metaRelatorioLanc() {
    const de = document.getElementById("portalManutLancRelDe")?.value || "";
    const ate = document.getElementById("portalManutLancRelAte")?.value || "";
    const placa = relModo === "moto" ? nkPlate(document.getElementById("portalManutLancRelPlaca")?.value || "") : "";
    const titulo = relModo === "moto" ? `Relatório individual — ${placa || "placa"}` : "Relatório geral de manutenções";
    return { de, ate, placa, titulo, rows: rowsRel() };
  }

  function abrirVisualizarRel() {
    if (relModo === "moto" && !nkPlate(document.getElementById("portalManutLancRelPlaca")?.value || "")) {
      setMsg("Informe a placa da moto.");
      return;
    }
    const { de, ate, titulo, rows } = metaRelatorioLanc();
    const tela = document.getElementById("portalManutLancVisualizarTela");
    const tit = document.getElementById("portalManutLancVisualizarTitulo");
    const sub = document.getElementById("portalManutLancVisualizarSub");
    const corpo = document.getElementById("portalManutLancVisualizarCorpo");
    if (tit) tit.textContent = titulo;
    if (sub) sub.textContent = `Período ${de} a ${ate}. ${rows.length} lançamento(s). Grupo DK Empreendimentos.`;
    if (corpo) corpo.innerHTML = tabelaHtml(rows);
    if (tela) {
      tela.classList.remove("hidden");
      tela.setAttribute("aria-hidden", "false");
    }
  }

  function fecharVisualizarRel() {
    const tela = document.getElementById("portalManutLancVisualizarTela");
    if (!tela) return;
    tela.classList.add("hidden");
    tela.setAttribute("aria-hidden", "true");
    document.body.classList.remove("portal-manut-lanc-vis-print");
  }

  function imprimirVisualizarRel() {
    document.body.classList.add("portal-manut-lanc-vis-print");
    window.print();
    window.setTimeout(() => document.body.classList.remove("portal-manut-lanc-vis-print"), 400);
  }

  function imprimirRel() {
    const { de, ate, titulo, rows } = metaRelatorioLanc();
    const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>${esc(titulo)}</title>
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
      <h1>${esc(titulo)}</h1>
      <p>Período ${esc(de)} a ${esc(ate)}. Grupo DK Empreendimentos.</p>
      ${tabelaHtml(rows)}
      <p>${rows.length} lançamento(s).</p>
      <button type="button" onclick="window.print()">Imprimir</button>
      </body></html>`;
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(html);
    w.document.close();
  }

  function shiftMonth(view, delta) {
    let y = view.y;
    let m = view.m + delta;
    while (m < 0) {
      m += 12;
      y -= 1;
    }
    while (m > 11) {
      m -= 12;
      y += 1;
    }
    view.y = y;
    view.m = m;
  }

  function renderCalGrid(which) {
    const isDe = which === "de";
    const view = isDe ? osCal.deView : osCal.ateView;
    const selected = isDe ? osCal.deYmd : osCal.ateYmd;
    const mesEl = document.getElementById(isDe ? "portalManutOsCalDeMes" : "portalManutOsCalAteMes");
    const grid = document.getElementById(isDe ? "portalManutOsCalDeGrid" : "portalManutOsCalAteGrid");
    if (!grid || !view.y) return;
    if (mesEl) mesEl.textContent = `${CAL_MES[view.m]} ${view.y}`;
    const first = new Date(view.y, view.m, 1);
    const startDow = (first.getDay() + 6) % 7;
    const daysIn = new Date(view.y, view.m + 1, 0).getDate();
    const cells = CAL_DOW.map((d) => `<span class="portal-manut-os-cal__dow">${d}</span>`);
    for (let i = 0; i < startDow; i += 1) cells.push(`<span class="portal-manut-os-cal__vazio"></span>`);
    for (let day = 1; day <= daysIn; day += 1) {
      const ymd = `${view.y}-${String(view.m + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const cls = ["portal-manut-os-cal__dia"];
      if (ymd === selected) cls.push("is-sel");
      if (osCal.deYmd && osCal.ateYmd && ymd >= osCal.deYmd && ymd <= osCal.ateYmd) cls.push("is-range");
      cells.push(
        `<button type="button" class="${cls.join(" ")}" data-os-cal="${which}" data-ymd="${ymd}">${day}</button>`
      );
    }
    grid.innerHTML = cells.join("");
  }

  function renderOsCals() {
    renderCalGrid("de");
    renderCalGrid("ate");
  }

  function initOsCalsHoje() {
    const hoje = todayYmd();
    const [y, m] = hoje.split("-").map(Number);
    osCal.deYmd = hoje;
    osCal.ateYmd = hoje;
    osCal.deView = { y, m: m - 1 };
    osCal.ateView = { y, m: m - 1 };
    renderOsCals();
  }

  function rowsOsTela() {
    if (osTelaModo === "veiculo") {
      const placa = document.getElementById("portalManutOsTelaPlaca")?.value || "";
      return linhasRapidasPeriodo("", "", placa);
    }
    return linhasRapidasPeriodo(osCal.deYmd, osCal.ateYmd, "");
  }

  function renderOsTelaCorpo() {
    const corpo = document.getElementById("portalManutOsTelaCorpo");
    if (!corpo) return;
    if (osTelaModo === "veiculo") {
      const placa = document.getElementById("portalManutOsTelaPlaca")?.value || "";
      corpo.innerHTML = htmlVeiculoAgrupado(rowsOsTela(), placa);
      return;
    }
    corpo.innerHTML = htmlPeriodoAgrupado(rowsOsTela());
  }

  function openOsTela(modo) {
    osTelaModo = modo === "veiculo" ? "veiculo" : "periodo";
    const modal = document.getElementById("portalManutOsTela");
    const tit = document.getElementById("portalManutOsTelaTitulo");
    const per = document.getElementById("portalManutOsTelaPeriodoBox");
    const vei = document.getElementById("portalManutOsTelaVeiculoBox");
    if (tit) tit.textContent = osTelaModo === "veiculo" ? "Relatório por veículo" : "Relatório por período";
    if (per) per.hidden = osTelaModo !== "periodo";
    if (vei) vei.hidden = osTelaModo !== "veiculo";
    persistOsBackfill();
    if (osTelaModo === "periodo") initOsCalsHoje();
    else {
      const inp = document.getElementById("portalManutOsTelaPlaca");
      if (inp && !inp.value) inp.value = "";
      hideOsPlacaLista();
    }
    renderOsTelaCorpo();
    if (modal) {
      modal.classList.remove("hidden");
      modal.setAttribute("aria-hidden", "false");
    }
  }

  function closeOsTela() {
    const modal = document.getElementById("portalManutOsTela");
    if (!modal) return;
    modal.classList.add("hidden");
    modal.setAttribute("aria-hidden", "true");
    hideOsPlacaLista();
  }

  function imprimirOsTela() {
    const placa = nkPlate(document.getElementById("portalManutOsTelaPlaca")?.value || "");
    const titulo = osTelaModo === "veiculo" ? `Relatório por veículo — ${placa || "placa"}` : "Relatório por período";
    const periodo =
      osTelaModo === "periodo"
        ? `Período ${ymdToBr(osCal.deYmd)} a ${ymdToBr(osCal.ateYmd)}.`
        : `Consulta da placa ${placa || "—"}.`;
    const corpo =
      osTelaModo === "veiculo" ? htmlVeiculoAgrupado(rowsOsTela(), placa) : htmlPeriodoAgrupado(rowsOsTela());
    const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>${esc(titulo)}</title>
      <style>
        body{font-family:Arial,sans-serif;color:#111;padding:1.2rem}
        h1{font-size:1.15rem;margin:0 0 .35rem}
        h4{margin:1rem 0 .35rem;border-bottom:1px solid #ccc;padding-bottom:.2rem}
        h5{margin:.55rem 0 .2rem}
        p{margin:0 0 .2rem;font-size:.92rem}
        .portal-manut-os-grupo__os{font-weight:700;margin:.35rem 0 .15rem}
        .portal-manut-os-grupo__serv{margin:0 0 .1rem 1rem}
        .portal-manut-os-grupo__valor{margin:.15rem 0 .45rem 1rem;font-weight:700}
        @page{size:A4;margin:12mm}
        @media print{button{display:none}}
      </style></head><body>
      <h1>${esc(titulo)}</h1>
      <p>${esc(periodo)} Grupo DK Empreendimentos.</p>
      ${corpo}
      <button type="button" onclick="window.print()">Imprimir</button>
      </body></html>`;
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(html);
    w.document.close();
  }

  function bindOnce() {
    if (window.__dkPortalManutRapidaBound) return;
    window.__dkPortalManutRapidaBound = true;

    const placaInp = document.getElementById("portalManutRapidaPlaca");
    placaInp?.addEventListener("input", () => {
      placaInp.value = String(placaInp.value || "").toUpperCase();
      if (nkPlate(placaInp.value)) renderPlacaLista(placaInp.value);
      else hidePlacaLista();
      preencherKmOleoDaPlaca(placaInp.value);
    });
    document.getElementById("portalManutRapidaPlacaLista")?.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-placa]");
      if (!btn) return;
      if (placaInp) placaInp.value = btn.getAttribute("data-placa") || "";
      hidePlacaLista();
      preencherKmOleoDaPlaca(placaInp?.value || "");
    });
    document.addEventListener(
      "click",
      (e) => {
        if (!e.target.closest("#portalManutRapidaPanel")) hidePlacaLista();
        if (!e.target.closest(".portal-manut-os-consulta-placa")) hideOsPlacaLista();
      },
      true
    );

    const km = document.getElementById("portalManutRapidaKm");
    km?.addEventListener("input", () => {
      km.value = onlyDigits(km.value).slice(0, 8);
    });
    const valor = document.getElementById("portalManutRapidaValor");
    valor?.addEventListener("input", () => {
      maskValor(valor);
      atualizarTotalPago();
    });
    const valor2 = document.getElementById("portalManutRapidaValor2");
    valor2?.addEventListener("input", () => {
      maskValor(valor2);
      atualizarTotalPago();
    });
    const sugOleo = document.getElementById("portalManutRapidaSugestaoOleo");
    sugOleo?.addEventListener("mousedown", (ev) => ev.stopPropagation());
    sugOleo?.addEventListener("click", (ev) => ev.stopPropagation());
    sugOleo?.addEventListener("input", () => {
      maskValor(sugOleo);
      persistSugestaoOleo();
      aplicarSugestaoOleoNoValor();
    });
    sugOleo?.addEventListener("change", () => persistSugestaoOleo({ push: true }));
    document.querySelector('[data-manut-rapida-serv="oleo"]')?.addEventListener("change", () => {
      aplicarSugestaoOleoNoValor();
    });
    hidratarSugestaoOleo();
    function bindFormasGrupo(attr, valorEl, aplicarSugestao) {
      document.querySelectorAll(`[${attr}]`).forEach((el) => {
        el.addEventListener("change", () => {
          const id = el.getAttribute(attr);
          if (id === "naoSeAplica" && el.checked) {
            document.querySelectorAll(`[${attr}]`).forEach((o) => {
              if (o !== el) o.checked = false;
            });
            if (valorEl) valorEl.value = formatBrl(0);
          } else if (el.checked) {
            const nsa = document.querySelector(`[${attr}="naoSeAplica"]`);
            if (nsa) nsa.checked = false;
            document.querySelectorAll(`[${attr}]`).forEach((o) => {
              if (o !== el && o.getAttribute(attr) !== "naoSeAplica") o.checked = false;
            });
            if (aplicarSugestao) aplicarSugestaoOleoNoValor();
          }
          atualizarTotalPago();
        });
      });
    }
    bindFormasGrupo("data-manut-rapida-pag", valor, true);
    bindFormasGrupo("data-manut-rapida-pag2", valor2, false);

    hidratarDataLancamento();
    atualizarTotalPago();
    const painel = document.getElementById("portalManutRapidaPanel");
    if (painel && typeof window.bindDkIntervaloCalendarios === "function") {
      window.bindDkIntervaloCalendarios(painel);
    }
    if (painel && typeof window.bindDateMasksInContainer === "function") {
      window.bindDateMasksInContainer(painel);
    }

    document.getElementById("portalManutRapidaGravarBtn")?.addEventListener("click", () => gravar());
    document.getElementById("portalManutRapidaLimparBtn")?.addEventListener("click", () => {
      limparForm();
      setMsg("");
    });
    document.getElementById("portalManutRelatorioGeralBtn")?.addEventListener("click", () => openRel("geral"));
    document.getElementById("portalManutRelatorioMotoBtn")?.addEventListener("click", () => openRel("moto"));
    document.getElementById("portalManutLancRelatorioFecharBtn")?.addEventListener("click", () => closeRel());
    document.getElementById("portalManutLancRelatorioBackdrop")?.addEventListener("click", () => closeRel());
    document.getElementById("portalManutLancRelatorioVisualizarBtn")?.addEventListener("click", () => abrirVisualizarRel());
    document.getElementById("portalManutLancVisualizarFecharBtn")?.addEventListener("click", () => fecharVisualizarRel());
    document.getElementById("portalManutLancVisualizarImprimirBtn")?.addEventListener("click", () => imprimirVisualizarRel());
    document.getElementById("portalManutLancVisualizarPdfBtn")?.addEventListener("click", () => imprimirRel());
    document.getElementById("portalManutRelPeriodoBtn")?.addEventListener("click", () => openOsTela("periodo"));
    document.getElementById("portalManutRelVeiculoBtn")?.addEventListener("click", () => openOsTela("veiculo"));
    document.getElementById("portalManutOsTelaFecharBtn")?.addEventListener("click", () => closeOsTela());
    document.getElementById("portalManutOsTelaBackdrop")?.addEventListener("click", () => closeOsTela());
    document.getElementById("portalManutOsTelaImprimirBtn")?.addEventListener("click", () => imprimirOsTela());
    document.getElementById("portalManutOsCalDePrev")?.addEventListener("click", () => {
      shiftMonth(osCal.deView, -1);
      renderOsCals();
    });
    document.getElementById("portalManutOsCalDeNext")?.addEventListener("click", () => {
      shiftMonth(osCal.deView, 1);
      renderOsCals();
    });
    document.getElementById("portalManutOsCalAtePrev")?.addEventListener("click", () => {
      shiftMonth(osCal.ateView, -1);
      renderOsCals();
    });
    document.getElementById("portalManutOsCalAteNext")?.addEventListener("click", () => {
      shiftMonth(osCal.ateView, 1);
      renderOsCals();
    });
    document.getElementById("portalManutOsCalDeGrid")?.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-ymd]");
      if (!btn) return;
      osCal.deYmd = btn.getAttribute("data-ymd") || "";
      if (osCal.ateYmd && osCal.deYmd > osCal.ateYmd) osCal.ateYmd = osCal.deYmd;
      renderOsCals();
      renderOsTelaCorpo();
    });
    document.getElementById("portalManutOsCalAteGrid")?.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-ymd]");
      if (!btn) return;
      osCal.ateYmd = btn.getAttribute("data-ymd") || "";
      if (osCal.deYmd && osCal.ateYmd < osCal.deYmd) osCal.deYmd = osCal.ateYmd;
      renderOsCals();
      renderOsTelaCorpo();
    });
    const osPlaca = document.getElementById("portalManutOsTelaPlaca");
    osPlaca?.addEventListener("input", () => {
      osPlaca.value = String(osPlaca.value || "").toUpperCase();
      renderOsPlacaLista(osPlaca.value);
      renderOsTelaCorpo();
    });
    osPlaca?.addEventListener("focus", () => renderOsPlacaLista(osPlaca.value));
    document.getElementById("portalManutOsTelaPlacaLista")?.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-placa]");
      if (!btn) return;
      if (osPlaca) osPlaca.value = btn.getAttribute("data-placa") || "";
      hideOsPlacaLista();
      renderOsTelaCorpo();
    });
    ["portalManutLancRelDe", "portalManutLancRelAte", "portalManutLancRelPlaca"].forEach((id) => {
      const el = document.getElementById(id);
      el?.addEventListener("input", () => {
        if (id !== "portalManutLancRelPlaca") formatBrDateInput(el);
        else el.value = String(el.value || "").toUpperCase();
        renderRel();
      });
    });
    document.addEventListener("keydown", (ev) => {
      const vis = document.getElementById("portalManutLancVisualizarTela");
      if (vis && !vis.classList.contains("hidden") && ev.key === "Escape") {
        fecharVisualizarRel();
        return;
      }
      const osModal = document.getElementById("portalManutOsTela");
      if (osModal && !osModal.classList.contains("hidden") && ev.key === "Escape") {
        closeOsTela();
        return;
      }
      const modal = document.getElementById("portalManutLancRelatorioModal");
      if (!modal || modal.classList.contains("hidden")) return;
      if (ev.key === "Escape") closeRel();
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bindOnce);
  else bindOnce();

  window.__DK_portalManutRapidaOnLocadosOpen = function () {
    hidratarSugestaoOleo();
    hidratarDataLancamento();
    atualizarTotalPago();
    renderDia();
  };
  window.__DK_portalManutRapidaRefreshDia = renderDia;
  window.__DK_manutOsFormat = formatOs;
  window.__DK_manutOsProximoNumero = proximoOsNumero;
  window.__DK_manutOsBackfill = backfillOs;
})();
