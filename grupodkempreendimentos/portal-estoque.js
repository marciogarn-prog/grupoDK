/**
 * Controle de Estoque — saída com resumo da última aplicação (sem coluna de repetição).
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

  function diasEntre(a, b) {
    if (!(a instanceof Date) || !(b instanceof Date)) return null;
    const x = new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime();
    const y = new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime();
    return Math.round((y - x) / 86400000);
  }

  function hojeBr() {
    const d = new Date();
    return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
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
    return base.concat(Array.isArray(extra) ? extra : []);
  }

  function cadastroDoCodigo(codigo) {
    const key = nkBar(codigo);
    if (!key) return null;
    const rows = Array.isArray(planilha().cadastro) ? planilha().cadastro : [];
    return rows.find((r) => nkBar(r.codigo) === key) || null;
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

  function preencherDatalist() {
    const list = $("estoqueSaidaCodigoList");
    if (!list) return;
    const rows = Array.isArray(planilha().cadastro) ? planilha().cadastro : [];
    list.innerHTML = rows
      .map((r) => {
        const cod = String(r.codigo || "");
        const desc = String(r.descricao || "");
        return `<option value="${escapeHtml(cod)}" label="${escapeHtml(desc)}"></option>`;
      })
      .join("");
  }

  function aoAbrirSaida() {
    const dataEl = $("estoqueSaidaData");
    if (dataEl && !String(dataEl.value || "").trim()) dataEl.value = hojeBr();
    preencherDatalist();
    renderTabelaSaidas();
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
    $("estoqueSaidaPlaca")?.addEventListener("change", () => {
      const placa = nkPlate($("estoqueSaidaPlaca")?.value || "");
      const ult = saidasTodas().find((s) => nkPlate(s.placa) === placa);
      const veic = $("estoqueSaidaVeiculo");
      if (veic && ult?.veiculo && !String(veic.value || "").trim()) veic.value = String(ult.veiculo);
      if (nkBar($("estoqueSaidaCodigo")?.value || "") && placa && parseKm($("estoqueSaidaKm")?.value || "")) {
        conferirUltimaAplicacao({ silencioso: true });
      }
    });
    $("estoqueSaidaKm")?.addEventListener("change", () => {
      if (nkBar($("estoqueSaidaCodigo")?.value || "") && nkPlate($("estoqueSaidaPlaca")?.value || "") && parseKm($("estoqueSaidaKm")?.value || "")) {
        conferirUltimaAplicacao({ silencioso: true });
      }
    });
  }

  window.__DK_estoqueAoAbrirSaida = aoAbrirSaida;
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bind, { once: true });
  } else {
    bind();
  }
})();
