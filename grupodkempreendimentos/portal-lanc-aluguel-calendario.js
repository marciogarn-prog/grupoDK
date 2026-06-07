/**
 * Calendário anual de pagamentos — Lançamento de aluguel (modelo Excel).
 * Depende de funções globais do portal (loadCadastro, parseBrDate, currencyBRL, etc.).
 */
(function () {
  "use strict";

  const MESES_ABREV = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  const DOW = ["D", "S", "T", "Q", "Q", "S", "S"];

  function pad2(n) {
    return String(n).padStart(2, "0");
  }

  function isoFromParts(y, m, d) {
    return `${y}-${pad2(m + 1)}-${pad2(d)}`;
  }

  function brFromIso(iso) {
    const m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return "";
    return `${m[3]}/${m[2]}/${m[1]}`;
  }

  function parseVal(raw) {
    if (typeof parseCurrencyBR === "function") return Number(parseCurrencyBR(String(raw || ""))) || 0;
    const n = Number(
      String(raw || "")
        .replace(/[R$\s.]/g, "")
        .replace(",", ".")
    );
    return Number.isFinite(n) ? n : 0;
  }

  function fmtVal(n) {
    if (typeof currencyBRL === "function") return currencyBRL(Number(n) || 0);
    return (Number(n) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }

  function anosDisponiveis() {
    const anos = [2025, 2026];
    const y = new Date().getFullYear();
    const m = new Date().getMonth();
    if (y >= 2027 || (y === 2026 && m >= 10)) anos.push(2027);
    return anos;
  }

  function agruparPagamentosPorDataIso(arr, ano) {
    const map = new Map();
    for (const x of arr || []) {
      const dt = typeof parseBrDate === "function" ? parseBrDate(String(x.data || "").trim()) : null;
      if (!dt || Number.isNaN(dt.getTime()) || dt.getFullYear() !== ano) continue;
      const iso = isoFromParts(dt.getFullYear(), dt.getMonth(), dt.getDate());
      map.set(iso, (map.get(iso) || 0) + Number(x.valor || 0));
    }
    return map;
  }

  function semanaTotalLinha(tr) {
    let s = 0;
    tr.querySelectorAll(".portal-lanc-cal-val").forEach((inp) => {
      s += parseVal(inp.value);
    });
    const out = tr.querySelector(".portal-lanc-cal-week-sum");
    if (out) out.textContent = s > 0 ? fmtVal(s) : "0";
  }

  function atualizarTotaisMes(mesEl) {
    mesEl.querySelectorAll(".portal-lanc-cal-week").forEach((tr) => semanaTotalLinha(tr));
  }

  function buildMesHtml(ano, mesIdx, mapa) {
    const titulo = `${MESES_ABREV[mesIdx]}/${String(ano).slice(-2)}`;
    const lastDay = new Date(ano, mesIdx + 1, 0).getDate();
    const weeks = [];
    let week = new Array(7).fill(null);
    for (let d = 1; d <= lastDay; d++) {
      const dow = new Date(ano, mesIdx, d).getDay();
      week[dow] = d;
      if (dow === 6 || d === lastDay) {
        weeks.push(week);
        week = new Array(7).fill(null);
      }
    }
    if (week.some((x) => x !== null)) weeks.push(week);

    let html = `<section class="portal-lanc-cal-mes" data-mes="${mesIdx}"><h4 class="portal-lanc-cal-mes__title">${titulo}</h4>`;
    html += `<table class="portal-lanc-cal-grid" aria-label="Calendário ${titulo}"><thead><tr>`;
    for (const d of DOW) html += `<th class="portal-lanc-cal-dow">${d}</th>`;
    html += `<th class="portal-lanc-cal-dow portal-lanc-cal-dow--total">TOTAL<br>SEMANA</th></tr></thead><tbody>`;

    for (const wk of weeks) {
      html += `<tr class="portal-lanc-cal-week">`;
      for (let col = 0; col < 7; col++) {
        const dNum = wk[col];
        if (!dNum) {
          html += `<td class="portal-lanc-cal-empty"></td>`;
          continue;
        }
        const iso = isoFromParts(ano, mesIdx, dNum);
        const isQua = col === 3;
        const val = mapa.get(iso) || 0;
        const valStr = val > 0 ? fmtVal(val) : "";
        html += `<td class="portal-lanc-cal-day" data-iso="${iso}">`;
        html += `<div class="portal-lanc-cal-day-num">${dNum}</div>`;
        html += `<input type="text" class="portal-lanc-cal-val${isQua ? " portal-lanc-cal-val--qua" : ""}" data-iso="${iso}" inputmode="decimal" autocomplete="off" value="${valStr.replace(/"/g, "&quot;")}" aria-label="Pagamento ${brFromIso(iso)}">`;
        html += `</td>`;
      }
      html += `<td class="portal-lanc-cal-week-total"><span class="portal-lanc-cal-week-sum">0</span></td></tr>`;
    }
    html += `</tbody></table></section>`;
    return html;
  }

  function buildAnoHtml(ano, mapa) {
    let html = `<div class="portal-lanc-cal-ano" data-ano="${ano}">`;
    for (let m = 0; m < 12; m++) html += buildMesHtml(ano, m, mapa);
    html += `</div>`;
    return html;
  }

  function bindCalendarioInputs(root) {
    root.querySelectorAll(".portal-lanc-cal-val").forEach((inp) => {
      inp.addEventListener("input", () => {
        const tr = inp.closest(".portal-lanc-cal-week");
        if (tr) semanaTotalLinha(tr);
      });
      inp.addEventListener("blur", () => {
        const v = parseVal(inp.value);
        inp.value = v > 0 ? fmtVal(v) : "";
        const tr = inp.closest(".portal-lanc-cal-week");
        if (tr) semanaTotalLinha(tr);
      });
    });
    root.querySelectorAll(".portal-lanc-cal-mes").forEach((mesEl) => atualizarTotaisMes(mesEl));
  }

  function coletarCelulasAno(root) {
    const out = new Map();
    root.querySelectorAll(".portal-lanc-cal-val").forEach((inp) => {
      const iso = inp.getAttribute("data-iso");
      if (!iso) return;
      out.set(iso, parseVal(inp.value));
    });
    return out;
  }

  function abrirModalAnoPick() {
    const modal = document.getElementById("portalLancAluguelCalModal");
    const pick = document.getElementById("portalLancAluguelCalAnoPick");
    const corpo = document.getElementById("portalLancAluguelCalCorpo");
    const titulo = document.getElementById("portalLancAluguelCalTitulo");
    if (!modal || !pick || !corpo) return false;
    if (typeof window.__DK_portalLancAluguelCalCtx !== "function") return false;
    const ctx = window.__DK_portalLancAluguelCalCtx();
    if (!ctx?.cpfDigits || !ctx?.proto) return false;

    pick.replaceChildren();
    pick.classList.remove("hidden");
    corpo.classList.add("hidden");
    document.getElementById("portalLancAluguelCalVoltarAnosBtn")?.classList.add("hidden");
    corpo.replaceChildren();
    if (titulo) titulo.textContent = "Relatório de pagamentos — escolha o ano";

    for (const ano of anosDisponiveis()) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btn-primary btn-secondary-outline portal-lanc-cal-ano-btn";
      btn.textContent = String(ano);
      btn.addEventListener("click", () => mostrarCalendarioAno(ano, ctx));
      pick.appendChild(btn);
    }

    modal.classList.remove("hidden");
    modal.setAttribute("aria-hidden", "false");
    return true;
  }

  function mostrarCalendarioAno(ano, ctx) {
    const pick = document.getElementById("portalLancAluguelCalAnoPick");
    const corpo = document.getElementById("portalLancAluguelCalCorpo");
    const titulo = document.getElementById("portalLancAluguelCalTitulo");
    if (!corpo) return;
    const arr =
      typeof window.__DK_getPortalLancamentosAluguelContrato === "function"
        ? window.__DK_getPortalLancamentosAluguelContrato(ctx.cpfDigits, ctx.proto)
        : [];
    const mapa = agruparPagamentosPorDataIso(arr, ano);
    pick?.classList.add("hidden");
    corpo.classList.remove("hidden");
    document.getElementById("portalLancAluguelCalVoltarAnosBtn")?.classList.remove("hidden");
    corpo.innerHTML = buildAnoHtml(ano, mapa);
    corpo.dataset.ano = String(ano);
    bindCalendarioInputs(corpo);
    if (titulo) titulo.textContent = `Relatório de pagamentos — ${ano}`;
  }

  function fecharModal() {
    const modal = document.getElementById("portalLancAluguelCalModal");
    if (modal) {
      modal.classList.add("hidden");
      modal.setAttribute("aria-hidden", "true");
    }
  }

  function salvarCalendarioAno() {
    const corpo = document.getElementById("portalLancAluguelCalCorpo");
    const msg = document.getElementById("portalLancAluguelCalMsg");
    if (!corpo || corpo.classList.contains("hidden")) return;
    const ano = Number(corpo.dataset.ano);
    if (!Number.isFinite(ano)) return;
    const ctx = typeof window.__DK_portalLancAluguelCalCtx === "function" ? window.__DK_portalLancAluguelCalCtx() : null;
    if (!ctx?.cpfDigits || !ctx?.proto) return;
    const celulas = coletarCelulasAno(corpo);
    const fn = window.__DK_persistPortalLancAluguelCalendarioAno;
    if (typeof fn !== "function") {
      if (msg) msg.textContent = "Função de gravação indisponível.";
      return;
    }
    const ok = fn(ctx.cpfDigits, ctx.proto, ano, celulas);
    if (msg) msg.textContent = ok ? `Pagamentos de ${ano} guardados.` : "Não foi possível guardar.";
    if (ok && typeof window.__DK_refreshOperacaoLancAluguelAposPagamento === "function") {
      window.__DK_refreshOperacaoLancAluguelAposPagamento();
    }
  }

  function bindUi() {
    document.getElementById("operacaoLancAluguelLancBlocoBtn")?.addEventListener("click", () => {
      const msg = document.getElementById("operacaoLancAluguelInlineMsg");
      if (!abrirModalAnoPick() && msg) {
        msg.textContent = "Confirme CPF e protocolo antes de abrir o lançamento em bloco.";
      }
    });
    document.getElementById("portalLancAluguelCalFecharBtn")?.addEventListener("click", fecharModal);
    document.getElementById("portalLancAluguelCalVoltarAnosBtn")?.addEventListener("click", () => {
      document.getElementById("portalLancAluguelCalVoltarAnosBtn")?.classList.add("hidden");
      abrirModalAnoPick();
    });
    document.getElementById("portalLancAluguelCalSalvarBtn")?.addEventListener("click", salvarCalendarioAno);
    document.getElementById("portalLancAluguelCalModal")?.addEventListener("click", (e) => {
      if (e.target?.id === "portalLancAluguelCalModal") fecharModal();
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bindUi);
  else bindUi();

  window.__DK_abrirLancAluguelCalendario = abrirModalAnoPick;
})();
