/**
 * Calendário anual de pagamentos — área do cliente (somente leitura).
 */
(function clientePagamentosCalendario() {
  const MESES_ABREV = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  const DOW = ["D", "S", "T", "Q", "Q", "S", "S"];

  function pad2(n) {
    return String(n).padStart(2, "0");
  }

  function isoFromParts(y, m, d) {
    return `${y}-${pad2(m + 1)}-${pad2(d)}`;
  }

  function parseBrDate(s) {
    const raw = String(s || "").trim();
    if (!raw || !raw.includes("/")) return null;
    const [day, month, year] = raw.split("/").map(Number);
    if (!day || !month || !year) return null;
    return new Date(year, month - 1, day);
  }

  function fmtVal(n) {
    return Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }

  function anosDisponiveis() {
    const anos = [2025, 2026];
    const y = new Date().getFullYear();
    const m = new Date().getMonth();
    if (y >= 2027 || (y === 2026 && m >= 10)) anos.push(2027);
    return anos;
  }

  function agruparPagamentosPorDataIso(lancs, ano) {
    const map = new Map();
    for (const x of lancs || []) {
      const dt = parseBrDate(String(x.data || "").trim());
      if (!dt || Number.isNaN(dt.getTime()) || dt.getFullYear() !== ano) continue;
      const iso = isoFromParts(dt.getFullYear(), dt.getMonth(), dt.getDate());
      map.set(iso, (map.get(iso) || 0) + Number(x.valor || 0));
    }
    return map;
  }

  function semanaTotalLinha(tr) {
    let s = 0;
    tr.querySelectorAll(".portal-lanc-cal-val").forEach((el) => {
      const raw = String(el.textContent || "").replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".");
      const n = Number(raw);
      if (Number.isFinite(n)) s += n;
    });
    const out = tr.querySelector(".portal-lanc-cal-week-sum");
    if (out) out.textContent = s > 0 ? fmtVal(s) : "0";
  }

  function atualizarTotaisMes(mesEl) {
    mesEl.querySelectorAll(".portal-lanc-cal-week").forEach((tr) => semanaTotalLinha(tr));
  }

  function buildMesHtml(ano, mesIdx, mapa, diaPagCol) {
    const colPag = Number.isFinite(Number(diaPagCol)) ? Number(diaPagCol) : 3;
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
    for (let col = 0; col < 7; col++) {
      const cls = col === colPag ? " portal-lanc-cal-dow--pagamento" : "";
      html += `<th class="portal-lanc-cal-dow${cls}">${DOW[col]}</th>`;
    }
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
        const isDiaPag = col === colPag;
        const val = mapa.get(iso) || 0;
        const valStr = val > 0 ? fmtVal(val) : "";
        html += `<td class="portal-lanc-cal-day" data-iso="${iso}">`;
        html += `<div class="portal-lanc-cal-day-num">${dNum}</div>`;
        html += `<span class="portal-lanc-cal-val portal-lanc-cal-val--readonly${isDiaPag ? " portal-lanc-cal-val--dia-pagamento" : ""}" aria-label="Pagamento ${iso}">${valStr}</span>`;
        html += `</td>`;
      }
      html += `<td class="portal-lanc-cal-week-total"><span class="portal-lanc-cal-week-sum">0</span></td></tr>`;
    }
    html += `</tbody></table></section>`;
    return html;
  }

  function buildAnoHtml(ano, mapa, diaPagCol) {
    let html = `<div class="portal-lanc-cal-ano" data-ano="${ano}">`;
    for (let m = 0; m < 12; m++) html += buildMesHtml(ano, m, mapa, diaPagCol);
    html += `</div>`;
    return html;
  }

  function fecharModal() {
    const modal = document.getElementById("clienteCalPagamentosModal");
    if (modal) {
      modal.classList.add("hidden");
      modal.setAttribute("aria-hidden", "true");
    }
  }

  function mostrarCalendarioAno(ano, ctx) {
    const pick = document.getElementById("clienteCalPagamentosAnoPick");
    const corpo = document.getElementById("clienteCalPagamentosCorpo");
    const titulo = document.getElementById("clienteCalPagamentosTitulo");
    if (!corpo || !ctx) return;
    const mapa = agruparPagamentosPorDataIso(ctx.lancamentos, ano);
    const colPag = Number.isFinite(Number(ctx.diaPagamentoCol)) ? Number(ctx.diaPagamentoCol) : 3;
    pick?.classList.add("hidden");
    corpo.classList.remove("hidden");
    document.getElementById("clienteCalPagamentosVoltarAnosBtn")?.classList.remove("hidden");
    corpo.innerHTML = buildAnoHtml(ano, mapa, colPag);
    corpo.dataset.ano = String(ano);
    corpo.querySelectorAll(".portal-lanc-cal-mes").forEach((mesEl) => atualizarTotaisMes(mesEl));
    const diaLbl = ctx.diaPagamentoLabel || "";
    const proto = ctx.proto || "";
    if (titulo) {
      titulo.textContent = diaLbl
        ? `Detalhamento dos pagamentos — ${ano} · protocolo ${proto} · dia ${diaLbl}`
        : `Detalhamento dos pagamentos — ${ano} · protocolo ${proto}`;
    }
  }

  function abrirModalAnoPick(ctx) {
    const modal = document.getElementById("clienteCalPagamentosModal");
    const pick = document.getElementById("clienteCalPagamentosAnoPick");
    const corpo = document.getElementById("clienteCalPagamentosCorpo");
    const titulo = document.getElementById("clienteCalPagamentosTitulo");
    if (!modal || !pick || !corpo || !ctx) return false;

    pick.replaceChildren();
    pick.classList.remove("hidden");
    corpo.classList.add("hidden");
    corpo.replaceChildren();
    document.getElementById("clienteCalPagamentosVoltarAnosBtn")?.classList.add("hidden");
    if (titulo) titulo.textContent = `Detalhamento dos pagamentos — escolha o ano · protocolo ${ctx.proto || ""}`;

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

  function abrirCalendarioPagamentos(loc) {
    if (!loc || typeof window.__DK_clienteBuildCalendarioCtx !== "function") return false;
    const ctx = window.__DK_clienteBuildCalendarioCtx(loc);
    return abrirModalAnoPick(ctx);
  }

  function bindUi() {
    document.getElementById("clienteCalPagamentosFecharBtn")?.addEventListener("click", fecharModal);
    document.getElementById("clienteCalPagamentosVoltarAnosBtn")?.addEventListener("click", () => {
      const locCtx = window.__DK_clienteCalendarioCtxAtual;
      if (locCtx) abrirModalAnoPick(locCtx);
    });
    document.getElementById("clienteCalPagamentosModal")?.addEventListener("click", (e) => {
      if (e.target?.id === "clienteCalPagamentosModal") fecharModal();
    });
  }

  window.__DK_clienteAbrirCalendarioPagamentos = (loc) => {
    if (typeof window.__DK_clienteBuildCalendarioCtx === "function") {
      window.__DK_clienteCalendarioCtxAtual = window.__DK_clienteBuildCalendarioCtx(loc);
    }
    return abrirCalendarioPagamentos(loc);
  };
  window.__DK_clienteFecharCalendarioPagamentos = fecharModal;

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bindUi);
  else bindUi();
})();
