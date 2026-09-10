/**
 * Manutenção rápida (Locados) — sem moto reserva.
 * Persistência: dk_manutencoes_rapidas_v1 + registro do dia (rápidas + corretivas).
 */
(function portalManutencaoRapida() {
  const STORAGE_KEY = "dk_manutencoes_rapidas_v1";
  const SETOR_KEY = "dk_portal_setor_movimentacoes_v1";
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
  ];

  let relModo = "geral";

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
    const s = String(raw || "").replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".");
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

  function formasMarcadas() {
    const out = {};
    FORMAS.forEach((f) => {
      const el = document.querySelector(`[data-manut-rapida-pag="${f.id}"]`);
      out[f.id] = Boolean(el && el.checked);
    });
    return out;
  }

  function labelsServicos(rec) {
    const serv = rec.servicos || {};
    return SERVICOS.filter((s) => serv[s.id]).map((s) => s.label).join(", ") || "—";
  }

  function labelsFormas(rec) {
    const f = rec.formas || {};
    return FORMAS.filter((x) => f[x.id]).map((x) => x.label).join(" + ") || "—";
  }

  function listPlacas(q) {
    if (typeof window.__DK_portalListPlacasLocadosAtivas === "function") {
      return window.__DK_portalListPlacasLocadosAtivas(q) || [];
    }
    return [];
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

  function setMsg(text, ok) {
    const el = document.getElementById("portalManutRapidaMsg");
    if (!el) return;
    el.textContent = text || "";
    el.classList.toggle("portal-feedback--ok", Boolean(ok));
  }

  function limparForm() {
    const placa = document.getElementById("portalManutRapidaPlaca");
    const km = document.getElementById("portalManutRapidaKm");
    const valor = document.getElementById("portalManutRapidaValor");
    if (placa) placa.value = "";
    if (km) km.value = "";
    if (valor) valor.value = "";
    document.querySelectorAll("[data-manut-rapida-serv], [data-manut-rapida-pag]").forEach((el) => {
      el.checked = false;
    });
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
    const valor = parseValor(document.getElementById("portalManutRapidaValor")?.value || "");
    const formas = formasMarcadas();
    if (valor > 0 && !FORMAS.some((f) => formas[f.id])) {
      setMsg("Marque PIX, espécie ou cartão.");
      return;
    }
    const op = operador();
    const rec = {
      id: `MR-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      tipo: "rapida",
      placa,
      km: onlyDigits(document.getElementById("portalManutRapidaKm")?.value || ""),
      servicos: serv,
      valorPago: valor,
      formas,
      plano: typeof window.__DK_portalGetManutSetorAtivo === "function" ? window.__DK_portalGetManutSetorAtivo() : "",
      criadoEm: new Date().toISOString(),
      cadastradoPorCpf: op.cpf || "",
      cadastradoPorNome: op.nome || "Operador",
      origemPortal: true,
    };
    const next = loadArr(STORAGE_KEY).concat([rec]);
    saveArr(STORAGE_KEY, next);
    if (typeof window.addAuditLog === "function") {
      addAuditLog("manutencao_rapida", "gravar", `${placa} · ${labelsServicos(rec)}`);
    }
    if (typeof window.__DK_pushCloudSnapshotNow === "function") {
      void window.__DK_pushCloudSnapshotNow();
    }
    limparForm();
    renderDia();
    setMsg(`Manutenção rápida gravada — ${placa}.`, true);
  }

  function linhasDoPeriodo(deYmd, ateYmd, placaFiltro) {
    const rapidas = loadArr(STORAGE_KEY).map((r) => ({
      createdAt: r.criadoEm,
      tipo: "Rápida",
      placa: r.placa,
      detalhe: labelsServicos(r),
      valor: r.valorPago,
      forma: labelsFormas(r),
      km: r.km || "",
      operador: r.cadastradoPorNome || "—",
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
        placa: r.placa,
        detalhe: `${r.deLabel || r.de || ""} → ${r.paraLabel || r.para || ""}`,
        valor: "",
        forma: "—",
        km: "",
        operador: r.operadorLabel || r.operadorNome || "—",
      }));
    const placa = nkPlate(placaFiltro);
    return rapidas
      .concat(corretivas)
      .filter((r) => {
        const ymd = ymdFromIso(r.createdAt);
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
    return `<table><thead><tr><th>Quando</th><th>Tipo</th><th>Placa</th><th>Serviço / destino</th><th>KM</th><th>Valor</th><th>Pagamento</th><th>Operador</th></tr></thead><tbody>${body}</tbody></table>`;
  }

  function renderDia() {
    const ymd = todayYmd();
    const rows = linhasDoPeriodo(ymd, ymd, "");
    const resumo = document.getElementById("portalManutDiaResumo");
    const body = document.getElementById("portalManutDiaRegistroBody");
    if (resumo) {
      const nRap = rows.filter((r) => r.tipo === "Rápida").length;
      const nCor = rows.filter((r) => r.tipo === "Corretiva").length;
      const tot = rows.filter((r) => r.tipo === "Rápida").reduce((s, r) => s + (Number(r.valor) || 0), 0);
      resumo.textContent = rows.length
        ? `${rows.length} lançamento(s) hoje · ${nRap} rápida(s) · ${nCor} corretiva(s) · ${formatBrl(tot)}`
        : "Nenhum lançamento hoje.";
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

  function imprimirRel() {
    const rows = rowsRel();
    const de = document.getElementById("portalManutLancRelDe")?.value || "";
    const ate = document.getElementById("portalManutLancRelAte")?.value || "";
    const placa = relModo === "moto" ? nkPlate(document.getElementById("portalManutLancRelPlaca")?.value || "") : "";
    const titulo = relModo === "moto" ? `Relatório individual — ${placa || "placa"}` : "Relatório geral de manutenções";
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

  function bindOnce() {
    if (window.__dkPortalManutRapidaBound) return;
    window.__dkPortalManutRapidaBound = true;

    const placaInp = document.getElementById("portalManutRapidaPlaca");
    placaInp?.addEventListener("input", () => {
      placaInp.value = String(placaInp.value || "").toUpperCase();
      renderPlacaLista(placaInp.value);
    });
    placaInp?.addEventListener("focus", () => renderPlacaLista(placaInp.value));
    document.getElementById("portalManutRapidaPlacaLista")?.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-placa]");
      if (!btn) return;
      if (placaInp) placaInp.value = btn.getAttribute("data-placa") || "";
      hidePlacaLista();
    });
    document.addEventListener(
      "click",
      (e) => {
        if (!e.target.closest("#portalManutRapidaPanel")) hidePlacaLista();
      },
      true
    );

    const km = document.getElementById("portalManutRapidaKm");
    km?.addEventListener("input", () => {
      km.value = onlyDigits(km.value).slice(0, 8);
    });
    const valor = document.getElementById("portalManutRapidaValor");
    valor?.addEventListener("input", () => maskValor(valor));

    document.getElementById("portalManutRapidaGravarBtn")?.addEventListener("click", () => gravar());
    document.getElementById("portalManutRelatorioGeralBtn")?.addEventListener("click", () => openRel("geral"));
    document.getElementById("portalManutRelatorioMotoBtn")?.addEventListener("click", () => openRel("moto"));
    document.getElementById("portalManutLancRelatorioFecharBtn")?.addEventListener("click", () => closeRel());
    document.getElementById("portalManutLancRelatorioBackdrop")?.addEventListener("click", () => closeRel());
    document.getElementById("portalManutLancRelatorioImprimirBtn")?.addEventListener("click", () => imprimirRel());
    ["portalManutLancRelDe", "portalManutLancRelAte", "portalManutLancRelPlaca"].forEach((id) => {
      const el = document.getElementById(id);
      el?.addEventListener("input", () => {
        if (id !== "portalManutLancRelPlaca") formatBrDateInput(el);
        else el.value = String(el.value || "").toUpperCase();
        renderRel();
      });
    });
    document.addEventListener("keydown", (ev) => {
      const modal = document.getElementById("portalManutLancRelatorioModal");
      if (!modal || modal.classList.contains("hidden")) return;
      if (ev.key === "Escape") closeRel();
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bindOnce);
  else bindOnce();

  window.__DK_portalManutRapidaOnLocadosOpen = function () {
    renderDia();
  };
  window.__DK_portalManutRapidaRefreshDia = renderDia;
})();
