/**
 * Calendário anual de pagamentos — área do cliente (somente leitura).
 */
(function clientePagamentosCalendario() {
  const MESES_ABREV = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  const DOW = ["D", "S", "T", "Q", "Q", "S", "S"];

  /** Painel inline aberto — preservado quando o app re-renderiza após sync. */
  let inlineOpenState = null;
  let calBuildToken = 0;

  function setInlineOpenState(proto, ano = null) {
    const p = String(proto || "").trim();
    if (!p) {
      inlineOpenState = null;
      return;
    }
    inlineOpenState = {
      proto: p,
      ano: ano != null && Number.isFinite(Number(ano)) ? Number(ano) : null,
    };
  }

  function pad2(n) {
    return String(n).padStart(2, "0");
  }

  function isoFromParts(y, m, d) {
    return `${y}-${pad2(m + 1)}-${pad2(d)}`;
  }

  function parseBrDate(s) {
    const raw = String(s || "").trim();
    if (!raw) return null;
    if (raw.includes("/")) {
      const [day, month, year] = raw.split("/").map(Number);
      if (!day || !month || !year) return null;
      return new Date(year, month - 1, day);
    }
    const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (iso) {
      return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    }
    return null;
  }

  function fmtVal(n) {
    return Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }

  /** Valor curto para caber na célula; `title` traz o valor completo. */
  function fmtValCell(n) {
    const v = Number(n || 0);
    if (!(v > 0)) return { text: "", title: "" };
    const full = fmtVal(v);
    let text;
    if (v >= 1000000) {
      const m = v / 1000000;
      text = Number.isInteger(m) ? `${m}M` : `${m.toFixed(1).replace(".", ",")}M`;
    } else if (v >= 10000) {
      text = `${Math.round(v / 1000)}k`;
    } else if (v >= 1000) {
      const k = v / 1000;
      text = Number.isInteger(k) ? `${k}k` : `${k.toFixed(1).replace(".", ",")}k`;
    } else if (Math.abs(v - Math.round(v)) < 0.009) {
      text = String(Math.round(v));
    } else {
      text = v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    return { text, title: full };
  }

  function wrapCalendarioHtml(innerHtml) {
    return `<div class="cliente-cal-zoom-wrap">
      <div class="cliente-cal-zoom-toolbar" role="toolbar" aria-label="Zoom do calendário">
        <button type="button" class="cliente-cal-zoom-btn" data-cal-zoom="out" aria-label="Reduzir">−</button>
        <span class="cliente-cal-zoom-label" data-cal-zoom-label>100%</span>
        <button type="button" class="cliente-cal-zoom-btn" data-cal-zoom="in" aria-label="Ampliar">+</button>
        <button type="button" class="cliente-cal-zoom-btn cliente-cal-zoom-btn--reset" data-cal-zoom="reset">Ajustar</button>
      </div>
      <p class="cliente-cal-zoom-hint">Pinça com dois dedos para ampliar · arraste com um dedo quando ampliado</p>
      <div class="cliente-cal-zoom-viewport" tabindex="0">
        <div class="cliente-cal-zoom-stage">${innerHtml}</div>
      </div>
    </div>`;
  }

  function bindClienteCalPinchZoom(wrap) {
    if (!wrap || wrap.dataset.zoomBound === "1") return;
    wrap.dataset.zoomBound = "1";
    const viewport = wrap.querySelector(".cliente-cal-zoom-viewport");
    const stage = wrap.querySelector(".cliente-cal-zoom-stage");
    const label = wrap.querySelector("[data-cal-zoom-label]");
    if (!viewport || !stage) return;

    let scale = 1;
    let panX = 0;
    let panY = 0;
    let pinchStartDist = 0;
    let pinchStartScale = 1;
    let touchStartPanX = 0;
    let touchStartPanY = 0;
    let lastTouchPan = null;
    const MIN = 0.7;
    const MAX = 3.5;

    function updateLabel() {
      if (label) label.textContent = `${Math.round(scale * 100)}%`;
    }

    function applyTransform() {
      stage.style.transform = `translate(${panX}px, ${panY}px) scale(${scale})`;
      stage.style.transformOrigin = "0 0";
      updateLabel();
    }

    function setScale(next, cx, cy) {
      const prev = scale;
      scale = Math.min(MAX, Math.max(MIN, next));
      if (cx != null && cy != null && prev > 0 && prev !== scale) {
        const rect = viewport.getBoundingClientRect();
        const ox = cx - rect.left - panX;
        const oy = cy - rect.top - panY;
        panX -= ox * (scale / prev - 1);
        panY -= oy * (scale / prev - 1);
      }
      applyTransform();
    }

    function touchDist(touches) {
      return Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY);
    }

    function touchMid(touches) {
      return {
        x: (touches[0].clientX + touches[1].clientX) / 2,
        y: (touches[0].clientY + touches[1].clientY) / 2,
      };
    }

    viewport.addEventListener(
      "touchstart",
      (e) => {
        if (e.touches.length === 2) {
          pinchStartDist = touchDist(e.touches);
          pinchStartScale = scale;
          e.preventDefault();
        } else if (e.touches.length === 1 && scale > 1.02) {
          lastTouchPan = { x: e.touches[0].clientX, y: e.touches[0].clientY };
          touchStartPanX = panX;
          touchStartPanY = panY;
        }
      },
      { passive: false }
    );

    viewport.addEventListener(
      "touchmove",
      (e) => {
        if (e.touches.length === 2 && pinchStartDist > 0) {
          const m = touchMid(e.touches);
          setScale(pinchStartScale * (touchDist(e.touches) / pinchStartDist), m.x, m.y);
          e.preventDefault();
        } else if (e.touches.length === 1 && lastTouchPan && scale > 1.02) {
          panX = touchStartPanX + (e.touches[0].clientX - lastTouchPan.x);
          panY = touchStartPanY + (e.touches[0].clientY - lastTouchPan.y);
          applyTransform();
          e.preventDefault();
        }
      },
      { passive: false }
    );

    viewport.addEventListener("touchend", (e) => {
      if (e.touches.length < 2) pinchStartDist = 0;
      if (e.touches.length === 0) lastTouchPan = null;
    });

    wrap.querySelector('[data-cal-zoom="in"]')?.addEventListener("click", () => {
      const r = viewport.getBoundingClientRect();
      setScale(scale + 0.3, r.left + r.width / 2, r.top + r.height / 2);
    });
    wrap.querySelector('[data-cal-zoom="out"]')?.addEventListener("click", () => {
      const r = viewport.getBoundingClientRect();
      setScale(scale - 0.3, r.left + r.width / 2, r.top + r.height / 2);
    });
    wrap.querySelector('[data-cal-zoom="reset"]')?.addEventListener("click", () => {
      scale = 1;
      panX = 0;
      panY = 0;
      applyTransform();
    });

    applyTransform();
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
      const raw = String(el.textContent || "")
        .replace(/[^\d,.-]/g, "")
        .replace(/\./g, "")
        .replace(",", ".");
      const n = Number(raw);
      if (Number.isFinite(n)) s += n;
    });
    const out = tr.querySelector(".portal-lanc-cal-week-sum");
    if (out) {
      const cell = fmtValCell(s);
      out.textContent = s > 0 ? cell.text : "0";
      out.title = cell.title || "";
    }
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
        const cell = fmtValCell(val);
        html += `<td class="portal-lanc-cal-day" data-iso="${iso}">`;
        html += `<div class="portal-lanc-cal-day-num">${dNum}</div>`;
        html += `<span class="portal-lanc-cal-val portal-lanc-cal-val--readonly${isDiaPag ? " portal-lanc-cal-val--dia-pagamento" : ""}" aria-label="Pagamento ${iso}"${cell.title ? ` title="${cell.title.replace(/"/g, "&quot;")}"` : ""}>${cell.text}</span>`;
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

  function mostrarCalendarioAno(ano, ctx, ui) {
    const { pick, corpo, titulo, voltarBtn } = ui;
    if (!corpo || !ctx) return;
    const token = ++calBuildToken;
    pick?.classList.add("hidden");
    corpo.classList.remove("hidden");
    voltarBtn?.classList.remove("hidden");
    corpo.dataset.ano = String(ano);
    corpo.innerHTML = '<p class="subtext cliente-cal-loading">A montar calendário…</p>';
    const colPag = Number.isFinite(Number(ctx.diaPagamentoCol)) ? Number(ctx.diaPagamentoCol) : 3;
    const diaLbl = ctx.diaPagamentoLabel || "";
    const proto = ctx.proto || "";
    if (titulo) {
      titulo.textContent = diaLbl
        ? `Pagamentos de ${ano} guardados. · protocolo ${proto} · dia ${diaLbl}`
        : `Pagamentos de ${ano} guardados.`;
    }
    const inlinePanel = document.querySelector(`[data-cliente-cal-panel="${ctx.proto}"]`);
    if (inlinePanel && !inlinePanel.classList.contains("hidden")) {
      setInlineOpenState(ctx.proto, ano);
    }
    window.requestAnimationFrame(() => {
      if (token !== calBuildToken) return;
      const mapa = agruparPagamentosPorDataIso(ctx.lancamentos, ano);
      if (token !== calBuildToken) return;
      corpo.innerHTML = wrapCalendarioHtml(buildAnoHtml(ano, mapa, colPag));
      const zoomWrap = corpo.querySelector(".cliente-cal-zoom-wrap");
      if (zoomWrap) bindClienteCalPinchZoom(zoomWrap);
      corpo.querySelectorAll(".portal-lanc-cal-mes").forEach((mesEl) => atualizarTotaisMes(mesEl));
    });
  }

  function abrirEscolhaAno(ctx, ui) {
    const { pick, corpo, titulo, voltarBtn, panel } = ui;
    if (!pick || !corpo || !ctx) return false;
    pick.replaceChildren();
    pick.classList.remove("hidden");
    corpo.classList.add("hidden");
    corpo.replaceChildren();
    voltarBtn?.classList.add("hidden");
    if (titulo) {
      titulo.textContent = `Detalhamento dos pagamentos — escolha o ano · protocolo ${ctx.proto || ""}`;
    }
    for (const ano of anosDisponiveis()) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btn-primary btn-secondary-outline portal-lanc-cal-ano-btn";
      btn.textContent = String(ano);
      btn.addEventListener("click", () => mostrarCalendarioAno(ano, ctx, ui));
      pick.appendChild(btn);
    }
    if (panel) {
      panel.classList.remove("hidden");
      panel.hidden = false;
      setInlineOpenState(ctx.proto, null);
    }
    return true;
  }

  function fecharModal() {
    const modal = document.getElementById("clienteCalPagamentosModal");
    if (modal) {
      modal.classList.add("hidden");
      modal.setAttribute("aria-hidden", "true");
    }
  }

  function abrirModalAnoPick(ctx) {
    const modal = document.getElementById("clienteCalPagamentosModal");
    if (!modal || !ctx) return false;
    const ui = {
      panel: null,
      pick: document.getElementById("clienteCalPagamentosAnoPick"),
      corpo: document.getElementById("clienteCalPagamentosCorpo"),
      titulo: document.getElementById("clienteCalPagamentosTitulo"),
      voltarBtn: document.getElementById("clienteCalPagamentosVoltarAnosBtn"),
    };
    abrirEscolhaAno(ctx, ui);
    modal.classList.remove("hidden");
    modal.setAttribute("aria-hidden", "false");
    return true;
  }

  function getInlineUi(proto) {
    const panel = document.querySelector(`[data-cliente-cal-panel="${proto}"]`);
    if (!panel) return null;
    return {
      panel,
      pick: panel.querySelector("[data-cliente-cal-ano-pick]"),
      corpo: panel.querySelector("[data-cliente-cal-corpo]"),
      titulo: panel.querySelector("[data-cliente-cal-head]"),
      voltarBtn: panel.querySelector("[data-cliente-cal-voltar]"),
    };
  }

  function fecharPainéisInline(excetoProto) {
    document.querySelectorAll("[data-cliente-cal-panel]").forEach((panel) => {
      const proto = String(panel.getAttribute("data-cliente-cal-panel") || "").trim();
      if (excetoProto && proto === excetoProto) return;
      panel.classList.add("hidden");
      panel.hidden = true;
      const btn = document.querySelector(`[data-cliente-cal-proto="${proto}"]`);
      if (btn) btn.setAttribute("aria-expanded", "false");
    });
    if (!excetoProto) setInlineOpenState(null);
  }

  function restaurarCalendarioInline(proto, loc) {
    const p = String(proto || "").trim();
    if (!p || !loc || typeof window.__DK_clienteBuildCalendarioCtx !== "function") return false;
    const ui = getInlineUi(p);
    if (!ui?.panel) return false;
    const ano = inlineOpenState?.proto === p ? inlineOpenState.ano : null;
    if (!ui.panel.classList.contains("hidden")) {
      if (ano != null) {
        const curAno = ui.corpo?.dataset?.ano;
        if (String(curAno) === String(ano) && ui.corpo?.querySelector(".portal-lanc-cal-ano")) {
          return true;
        }
      } else if (ui.pick && !ui.pick.classList.contains("hidden") && ui.pick.children.length > 0) {
        return true;
      }
    }
    const ctx = window.__DK_clienteBuildCalendarioCtx(loc);
    window.__DK_clienteCalendarioCtxAtual = ctx;
    fecharPainéisInline(p);
    ui.panel.classList.remove("hidden");
    ui.panel.hidden = false;
    if (ano) mostrarCalendarioAno(ano, ctx, ui);
    else abrirEscolhaAno(ctx, ui);
    const btn = document.querySelector(`[data-cliente-cal-proto="${p}"]`);
    if (btn) btn.setAttribute("aria-expanded", "true");
    return true;
  }

  function toggleCalendarioInline(proto, loc) {
    const ui = getInlineUi(proto);
    if (!ui?.panel) return false;
    const aberto = !ui.panel.classList.contains("hidden");
    const btn = document.querySelector(`[data-cliente-cal-proto="${proto}"]`);
    if (aberto) {
      calBuildToken += 1;
      ui.panel.classList.add("hidden");
      ui.panel.hidden = true;
      if (btn) btn.setAttribute("aria-expanded", "false");
      setInlineOpenState(null);
      return true;
    }
    if (!loc || typeof window.__DK_clienteBuildCalendarioCtx !== "function") return false;
    fecharPainéisInline(proto);
    setInlineOpenState(proto, null);
    ui.panel.classList.remove("hidden");
    ui.panel.hidden = false;
    if (ui.pick) {
      ui.pick.classList.remove("hidden");
      ui.pick.replaceChildren();
      const loading = document.createElement("p");
      loading.className = "subtext cliente-cal-loading";
      loading.textContent = "A carregar calendário…";
      ui.pick.appendChild(loading);
    }
    if (ui.corpo) {
      ui.corpo.classList.add("hidden");
      ui.corpo.replaceChildren();
    }
    ui.voltarBtn?.classList.add("hidden");
    if (btn) btn.setAttribute("aria-expanded", "true");
    window.requestAnimationFrame(() => {
      const ctx = window.__DK_clienteBuildCalendarioCtx(loc);
      window.__DK_clienteCalendarioCtxAtual = ctx;
      abrirEscolhaAno(ctx, ui);
    });
    ui.panel.scrollIntoView({ behavior: "auto", block: "nearest" });
    return true;
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
    document.getElementById("cliente-contratos")?.addEventListener("click", (e) => {
      const voltar = e.target.closest?.("[data-cliente-cal-voltar]");
      if (!voltar) return;
      e.preventDefault();
      const proto = String(voltar.getAttribute("data-cliente-cal-voltar") || "").trim();
      const ctx = window.__DK_clienteCalendarioCtxAtual;
      const ui = getInlineUi(proto);
      if (ctx && ui) abrirEscolhaAno(ctx, ui);
    });
  }

  window.__DK_clienteAbrirCalendarioPagamentos = (loc) => {
    if (typeof window.__DK_clienteBuildCalendarioCtx === "function") {
      window.__DK_clienteCalendarioCtxAtual = window.__DK_clienteBuildCalendarioCtx(loc);
    }
    return abrirModalAnoPick(window.__DK_clienteCalendarioCtxAtual);
  };
  window.__DK_clienteToggleCalendarioInline = toggleCalendarioInline;
  window.__DK_clienteRestoreCalendarioInline = restaurarCalendarioInline;
  window.__DK_clienteCalendarioInlineAberto = () => inlineOpenState?.proto || "";
  window.__DK_clienteFecharCalendarioPagamentos = fecharModal;

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bindUi);
  else bindUi();
})();
