/**
 * Módulos da tela FINANCEIRO (quantitativo, receitas, localização, intervalos, despesas).
 */
(function portalFinanceiroModulos() {
  const DESPESAS_KEY = "dk_financeiro_despesas_v1";
  const MOV_KEY = "dk_portal_checklist_movimentacoes_v1";
  const PLANOS = [
    { id: "minha-moto", label: "DK Minha Moto", color: "#5eb8ff" },
    { id: "meu-transporte", label: "DK Meu Transporte", color: "#6ee7a0" },
    { id: "carro", label: "Carro", color: "#c4a484" },
  ];
  const LOCAIS = [
    { id: "minha-moto", n: 1, label: "1 — Plano DK Minha Moto" },
    { id: "meu-transporte", n: 2, label: "2 — Plano DK Meu Transporte" },
    { id: "carros", n: 3, label: "3 — Plano Carro" },
    { id: "prontos", n: 4, label: "4 — Pronto para alugar" },
    { id: "reserva", n: 5, label: "5 — Veículo reserva" },
    { id: "triagem", n: 6, label: "6 — Triagem" },
    { id: "oficina-propria", n: 7, label: "7 — Oficina própria" },
    { id: "oficina-terceiros", n: 8, label: "8 — Oficina de terceiro" },
    { id: "enviado-seguro", n: 9, label: "9 — Seguro" },
    { id: "sinistrado-roubo", n: 10, label: "10 — Sinistro Roubo" },
  ];
  const LOCAL_COLORS = [
    "#5eb8ff",
    "#6ee7a0",
    "#c4a484",
    "#f5d76e",
    "#ce93d8",
    "#ffb74d",
    "#80cbc4",
    "#ef9a9a",
    "#90caf9",
    "#ff6b6b",
  ];
  const DESPESA_CATS = [
    { id: "SEGURO", label: "01-SEGURO" },
    { id: "ADM", label: "02-ADM" },
    { id: "IMPOSTO", label: "03-IMPOSTO" },
    { id: "DOCUMENTOS", label: "04-DOCUMENTOS" },
    { id: "MULTAS", label: "05-MULTAS" },
    { id: "SALARIOS", label: "06-SALARIOS" },
    { id: "CONT_ADV_PROP", label: "07-CONT+ADV+PROP" },
  ];
  const MODELO_COLORS = ["#5eb8ff", "#6ee7a0", "#c4a484", "#f5d76e", "#ce93d8", "#ffb74d", "#80cbc4", "#ef9a9a", "#90caf9", "#a5d6a7"];

  const panel = document.getElementById("panel-financeiro-locadora");
  if (!panel) return;

  let moduloAberto = "";
  let despesasBound = false;

  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function nk(s) {
    return String(s || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, " ")
      .trim();
  }

  function nkPlate(raw) {
    return String(raw || "")
      .replace(/\s+/g, "")
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "");
  }

  function brl(n) {
    const v = Number(n) || 0;
    if (typeof window.currencyBRL === "function") return window.currencyBRL(v);
    return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }

  function parseValor(raw) {
    if (typeof raw === "number" && Number.isFinite(raw)) return raw;
    if (typeof window.parseCurrencyBR === "function") {
      const n = Number(window.parseCurrencyBR(raw));
      return Number.isFinite(n) ? n : 0;
    }
    const s = String(raw || "").replace(/[R$\s]/g, "");
    if (!s) return 0;
    const n = Number(s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s);
    return Number.isFinite(n) ? n : 0;
  }

  function parseBrDate(s) {
    const m = String(s || "")
      .trim()
      .match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (!m) return null;
    const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
    return Number.isNaN(d.getTime()) ? null : d;
  }

  function fmtBrDate(d) {
    if (!(d instanceof Date) || Number.isNaN(d.getTime())) return "";
    const pad = (n) => String(n).padStart(2, "0");
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
  }

  function ymd(d) {
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  function addDays(d, n) {
    const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    x.setDate(x.getDate() + n);
    return x;
  }

  function daysBetween(a, b) {
    const ms = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate()) - Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
    return Math.round(ms / 86400000);
  }

  function eachDay(from, to) {
    const out = [];
    if (!from || !to || from > to) return out;
    for (let d = new Date(from.getFullYear(), from.getMonth(), from.getDate()); d <= to; d = addDays(d, 1)) {
      out.push(new Date(d.getTime()));
    }
    return out;
  }

  function defaultPeriodo() {
    const ate = new Date();
    ate.setHours(0, 0, 0, 0);
    const de = addDays(ate, -29);
    return { de, ate };
  }

  function readPeriodo(deId, ateId) {
    const de = parseBrDate(document.getElementById(deId)?.value);
    const ate = parseBrDate(document.getElementById(ateId)?.value);
    const fb = defaultPeriodo();
    return { de: de || fb.de, ate: ate || fb.ate };
  }

  function fillPeriodo(deId, ateId) {
    const { de, ate } = defaultPeriodo();
    const a = document.getElementById(deId);
    const b = document.getElementById(ateId);
    if (a && !a.value) a.value = fmtBrDate(de);
    if (b && !b.value) b.value = fmtBrDate(ate);
    if (typeof window.bindDateMaskInput === "function") {
      if (a) window.bindDateMaskInput(a);
      if (b) window.bindDateMaskInput(b);
    }
  }

  function loadArr(key) {
    if (typeof window.loadCadastro === "function") {
      const arr = window.loadCadastro(key);
      return Array.isArray(arr) ? arr : [];
    }
    try {
      const raw = localStorage.getItem(key);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  }

  function veiculosCadastro() {
    const key = typeof window.CAD_VEICULOS_KEY === "string" ? window.CAD_VEICULOS_KEY : "dk_veiculos_cadastro";
    return loadArr(key);
  }

  function locacoesCadastro() {
    const key = typeof window.CAD_LOCACOES_KEY === "string" ? window.CAD_LOCACOES_KEY : "dk_locacoes_cadastro";
    return loadArr(key);
  }

  function modeloDeVeiculo(v, loc) {
    const raw = String(
      v?.marcaModelo || v?.modelo || loc?.marcaModelo || loc?.modelo || ""
    ).trim();
    return raw || "Modelo não informado";
  }

  function planoDeLocacao(loc, veiculo) {
    const raw = nk(loc?.plano || loc?.opcaoContrato || "");
    if (raw.includes("TRANSPORTE")) return "meu-transporte";
    if (raw.includes("CARRO")) return "carro";
    if ((raw.includes("MINHA") && raw.includes("MOTO")) || raw.includes("DK MINHA")) return "minha-moto";
    const tipo = nk(veiculo?.tipo || veiculo?.categoria || veiculo?.tag || "");
    if (tipo.includes("CARRO") || tipo.includes("DKCR")) return "carro";
    return "minha-moto";
  }

  function lancsDaLoc(loc) {
    if (typeof window.__DK_getLancamentosAluguelCanonico === "function") {
      const a = window.__DK_getLancamentosAluguelCanonico(loc);
      if (Array.isArray(a)) return a;
    }
    if (typeof window.__DK_getPortalLancamentosAluguelDoContrato === "function") {
      const a = window.__DK_getPortalLancamentosAluguelDoContrato(loc);
      if (Array.isArray(a)) return a;
    }
    return Array.isArray(loc?.portalLancamentosAluguel) ? loc.portalLancamentosAluguel : [];
  }

  function mapaVeiculosPorPlaca() {
    const map = typeof window.getVehicleMapByPlate === "function" ? window.getVehicleMapByPlate() : null;
    if (map && typeof map.get === "function") return map;
    const m = new Map();
    veiculosCadastro().forEach((v) => {
      const p = nkPlate(v?.placa);
      if (p) m.set(p, v);
    });
    return m;
  }

  function coletarPagamentos() {
    const vmap = mapaVeiculosPorPlaca();
    const out = [];
    locacoesCadastro().forEach((loc) => {
      const placa = nkPlate(loc?.placa);
      const veiculo = placa ? vmap.get(placa) : null;
      const plano = planoDeLocacao(loc, veiculo);
      const modelo = modeloDeVeiculo(veiculo, loc);
      const cpf = String(loc?.cpf || "").replace(/\D/g, "").slice(0, 11);
      const nome = String(loc?.nome || loc?.cliente || "").trim();
      const protocolo = String(loc?.numeroContrato || "").trim();
      lancsDaLoc(loc).forEach((p) => {
        const dt = parseBrDate(p?.data);
        if (!dt) return;
        const valor = Number(p?.valor);
        const v = Number.isFinite(valor) ? valor : parseValor(p?.valor);
        if (!(v > 0)) return;
        out.push({
          dt,
          ymd: ymd(dt),
          valor: v,
          plano,
          modelo,
          placa,
          cpf,
          nome,
          protocolo,
        });
      });
    });
    return out;
  }

  function localIdDeEstado(est) {
    if (!est?.ok) return "";
    if (est.grupo === "manutencao") return est.sub || "triagem";
    if (est.grupo === "locados") return est.sub === "carros" ? "carros" : est.sub || "minha-moto";
    if (est.grupo === "disponiveis") {
      if (est.sub === "prontos") return "prontos";
      return "reserva";
    }
    return "";
  }

  function estadoPlaca(placa) {
    if (typeof window.__DK_portalResolverEstadoExclusivoPlaca === "function") {
      return window.__DK_portalResolverEstadoExclusivoPlaca(placa);
    }
    return { ok: false };
  }

  function hideModulos(opts) {
    const keepBanco = Boolean(opts && opts.keepBanco);
    const keepPlaceholder = Boolean(opts && opts.keepPlaceholder);
    document.querySelectorAll(".fin-mod-pane").forEach((el) => el.classList.add("hidden"));
    document.querySelectorAll("#financeiroModulosNav [data-fin-mod]").forEach((btn) => {
      btn.classList.remove("is-active");
      btn.setAttribute("aria-expanded", "false");
    });
    moduloAberto = "";
    if (!keepPlaceholder && !keepBanco) {
      document.getElementById("financeiroFormPlaceholder")?.classList.remove("hidden");
    }
  }

  function showPlaceholder() {
    hideModulos();
    document.getElementById("financeiroFormPlaceholder")?.classList.remove("hidden");
    document.getElementById("financeiroFormPlaceholder")?.setAttribute("aria-hidden", "false");
    document.getElementById("financeiroPaneBanco")?.classList.add("hidden");
    document.querySelectorAll("#btn-financeiro-santander, #btn-financeiro-sicredi").forEach((b) => {
      b.classList.remove("is-active");
      b.setAttribute("aria-expanded", "false");
    });
  }

  function abrirModulo(id) {
    if (!id) return;
    hideModulos({ keepPlaceholder: true });
    document.getElementById("financeiroFormPlaceholder")?.classList.add("hidden");
    document.getElementById("financeiroFormPlaceholder")?.setAttribute("aria-hidden", "true");
    document.getElementById("financeiroPaneBanco")?.classList.add("hidden");
    document.querySelectorAll("#btn-financeiro-santander, #btn-financeiro-sicredi").forEach((b) => {
      b.classList.remove("is-active");
      b.setAttribute("aria-expanded", "false");
    });
    const pane = document.querySelector(`.fin-mod-pane[data-fin-pane="${id}"]`);
    pane?.classList.remove("hidden");
    const btn = document.querySelector(`#financeiroModulosNav [data-fin-mod="${id}"]`);
    btn?.classList.add("is-active");
    btn?.setAttribute("aria-expanded", "true");
    moduloAberto = id;
    renderModulo(id);
  }

  function svgLineChart(days, series) {
    const w = 760;
    const h = 280;
    const padL = 58;
    const padR = 12;
    const padT = 16;
    const padB = 40;
    const innerW = w - padL - padR;
    const innerH = h - padT - padB;
    const max = Math.max(1, ...series.flatMap((s) => s.values));
    const n = Math.max(1, days.length - 1);
    const xAt = (i) => padL + (days.length <= 1 ? innerW / 2 : (i / n) * innerW);
    const yAt = (v) => padT + innerH - (v / max) * innerH;
    const grid = [0, 0.25, 0.5, 0.75, 1]
      .map((p) => {
        const y = padT + innerH * (1 - p);
        const val = brl(max * p);
        return `<line x1="${padL}" y1="${y}" x2="${w - padR}" y2="${y}" stroke="rgba(255,255,255,0.12)"/>
          <text x="${padL - 6}" y="${y + 4}" text-anchor="end" fill="#bdbdbd" font-size="10">${esc(val)}</text>`;
      })
      .join("");
    const step = days.length > 20 ? Math.ceil(days.length / 8) : 1;
    const labels = days
      .map((d, i) => {
        if (i % step !== 0 && i !== days.length - 1) return "";
        return `<text x="${xAt(i)}" y="${h - 12}" text-anchor="middle" fill="#bdbdbd" font-size="10">${esc(fmtBrDate(d).slice(0, 5))}</text>`;
      })
      .join("");
    const lines = series
      .map((s) => {
        if (!s.values.length) return "";
        const pts = s.values.map((v, i) => `${xAt(i)},${yAt(v)}`).join(" ");
        return `<polyline fill="none" stroke="${s.color}" stroke-width="2.2" points="${pts}"/>`;
      })
      .join("");
    return `<svg class="fin-chart-svg" viewBox="0 0 ${w} ${h}" role="img" aria-label="Gráfico de linhas">${grid}${lines}${labels}</svg>`;
  }

  function svgBarChart(labels, values, colors, asMoney) {
    const w = 760;
    const h = 260;
    const padL = 58;
    const padR = 12;
    const padT = 16;
    const padB = 42;
    const innerW = w - padL - padR;
    const innerH = h - padT - padB;
    const max = Math.max(1, ...values);
    const bw = innerW / Math.max(1, labels.length);
    const bars = labels
      .map((lb, i) => {
        const v = values[i] || 0;
        const bh = (v / max) * innerH;
        const x = padL + i * bw + bw * 0.18;
        const y = padT + innerH - bh;
        const c = colors[i % colors.length];
        const top = asMoney ? brl(v) : String(Math.round(v));
        return `<rect x="${x}" y="${y}" width="${bw * 0.64}" height="${Math.max(bh, 1)}" fill="${c}" rx="3"/>
          <text x="${x + bw * 0.32}" y="${h - 14}" text-anchor="middle" fill="#e0e0e0" font-size="11">${esc(lb)}</text>
          <text x="${x + bw * 0.32}" y="${y - 4}" text-anchor="middle" fill="#f5f5f5" font-size="10">${esc(top)}</text>`;
      })
      .join("");
    return `<svg class="fin-chart-svg" viewBox="0 0 ${w} ${h}" role="img" aria-label="Gráfico de barras">${bars}</svg>`;
  }

  function svgHBar(rows) {
    const max = Math.max(1, ...rows.map((r) => r.value));
    return `<div class="fin-hbar">${rows
      .map((r) => {
        const pct = Math.max(2, (r.value / max) * 100);
        return `<div class="fin-hbar__row">
          <span class="fin-hbar__lab" title="${esc(r.label)}">${esc(r.label)}</span>
          <span class="fin-hbar__track"><span class="fin-hbar__fill" style="width:${pct}%"></span></span>
          <span class="fin-hbar__val">${esc(String(r.value))}</span>
        </div>`;
      })
      .join("")}</div>`;
  }

  function renderQuantitativo() {
    const counts = new Map();
    veiculosCadastro().forEach((v) => {
      const m = modeloDeVeiculo(v, null);
      counts.set(m, (counts.get(m) || 0) + 1);
    });
    const rows = [...counts.entries()]
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label, "pt-BR"));
    const total = rows.reduce((s, r) => s + r.value, 0);
    const kpis = document.getElementById("finQuantitativoKpis");
    if (kpis) {
      kpis.innerHTML = `<div class="fin-kpi"><span class="fin-kpi__lab">Veículos</span><strong>${total}</strong></div>
        <div class="fin-kpi"><span class="fin-kpi__lab">Modelos</span><strong>${rows.length}</strong></div>`;
    }
    const chart = document.getElementById("finQuantitativoChart");
    if (chart) chart.innerHTML = rows.length ? svgHBar(rows) : '<p class="subtext">Nenhum veículo no cadastro.</p>';
    const tab = document.getElementById("finQuantitativoTabela");
    if (tab) {
      tab.innerHTML = rows.length
        ? `<table class="fin-table"><thead><tr><th>Modelo</th><th>Quantidade</th><th>%</th></tr></thead><tbody>${rows
            .map((r) => `<tr><td>${esc(r.label)}</td><td>${r.value}</td><td>${total ? ((r.value / total) * 100).toFixed(1) : "0"}%</td></tr>`)
            .join("")}</tbody></table>`
        : "";
    }
  }

  function pagamentosNoPeriodo(de, ate) {
    return coletarPagamentos().filter((p) => p.dt >= de && p.dt <= ate);
  }

  function renderReceitaPlano() {
    fillPeriodo("finReceitaPlanoDe", "finReceitaPlanoAte");
    const { de, ate } = readPeriodo("finReceitaPlanoDe", "finReceitaPlanoAte");
    const ativos = PLANOS.filter((p) => document.getElementById(p.id === "minha-moto" ? "finPlanoMinhaMoto" : p.id === "meu-transporte" ? "finPlanoMeuTransporte" : "finPlanoCarro")?.checked);
    const days = eachDay(de, ate);
    const pags = pagamentosNoPeriodo(de, ate);
    const series = ativos.map((pl) => {
      const values = days.map((d) => {
        const key = ymd(d);
        return pags.filter((p) => p.plano === pl.id && p.ymd === key).reduce((s, p) => s + p.valor, 0);
      });
      return { ...pl, values };
    });
    const chart = document.getElementById("finReceitaPlanoChart");
    if (chart) {
      chart.innerHTML = days.length
        ? svgLineChart(days, series)
        : '<p class="subtext">Informe um período válido.</p>';
    }
    const leg = document.getElementById("finReceitaPlanoLegenda");
    if (leg) {
      leg.innerHTML = series
        .map((s) => {
          const tot = s.values.reduce((a, b) => a + b, 0);
          return `<span class="fin-legenda__item"><i style="background:${s.color}"></i>${esc(s.label)} · ${esc(brl(tot))}</span>`;
        })
        .join("");
    }
    const tab = document.getElementById("finReceitaPlanoTabela");
    if (tab) {
      const head = `<th>Dia</th>${series.map((s) => `<th>${esc(s.label)}</th>`).join("")}<th>Total</th>`;
      const body = days
        .map((d, i) => {
          const vals = series.map((s) => s.values[i] || 0);
          const tot = vals.reduce((a, b) => a + b, 0);
          if (tot === 0) return "";
          return `<tr><td>${esc(fmtBrDate(d))}</td>${vals.map((v) => `<td>${esc(brl(v))}</td>`).join("")}<td>${esc(brl(tot))}</td></tr>`;
        })
        .filter(Boolean)
        .join("");
      tab.innerHTML = `<table class="fin-table"><thead><tr>${head}</tr></thead><tbody>${body || '<tr><td colspan="5">Sem pagamentos no período.</td></tr>'}</tbody></table>`;
    }
  }

  function modelosDisponiveis() {
    const set = new Map();
    coletarPagamentos().forEach((p) => set.set(p.modelo, (set.get(p.modelo) || 0) + p.valor));
    veiculosCadastro().forEach((v) => {
      const m = modeloDeVeiculo(v, null);
      if (!set.has(m)) set.set(m, 0);
    });
    return [...set.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "pt-BR")).map(([label]) => label);
  }

  function syncModeloSelect() {
    const sel = document.getElementById("finReceitaModeloSelect");
    if (!sel) return;
    const prev = new Set(Array.from(sel.selectedOptions).map((o) => o.value));
    const modelos = modelosDisponiveis();
    const had = sel.options.length > 0;
    sel.innerHTML = modelos.map((m) => `<option value="${esc(m)}">${esc(m)}</option>`).join("");
    if (!had) {
      Array.from(sel.options).slice(0, 3).forEach((o) => {
        o.selected = true;
      });
    } else {
      Array.from(sel.options).forEach((o) => {
        o.selected = prev.has(o.value);
      });
      if (!Array.from(sel.selectedOptions).length) {
        Array.from(sel.options).slice(0, 3).forEach((o) => {
          o.selected = true;
        });
      }
    }
  }

  function renderReceitaModelo() {
    fillPeriodo("finReceitaModeloDe", "finReceitaModeloAte");
    syncModeloSelect();
    const { de, ate } = readPeriodo("finReceitaModeloDe", "finReceitaModeloAte");
    const sel = document.getElementById("finReceitaModeloSelect");
    const escolhidos = Array.from(sel?.selectedOptions || []).map((o) => o.value);
    const days = eachDay(de, ate);
    const pags = pagamentosNoPeriodo(de, ate);
    const series = escolhidos.map((modelo, i) => {
      const values = days.map((d) => {
        const key = ymd(d);
        return pags.filter((p) => p.modelo === modelo && p.ymd === key).reduce((s, p) => s + p.valor, 0);
      });
      return { id: modelo, label: modelo, color: MODELO_COLORS[i % MODELO_COLORS.length], values };
    });
    const chart = document.getElementById("finReceitaModeloChart");
    if (chart) {
      chart.innerHTML = !escolhidos.length
        ? '<p class="subtext">Selecione um ou mais modelos (Ctrl+clique).</p>'
        : svgLineChart(days, series);
    }
    const leg = document.getElementById("finReceitaModeloLegenda");
    if (leg) {
      leg.innerHTML = series
        .map((s) => {
          const tot = s.values.reduce((a, b) => a + b, 0);
          return `<span class="fin-legenda__item"><i style="background:${s.color}"></i>${esc(s.label)} · ${esc(brl(tot))}</span>`;
        })
        .join("");
    }
    const tab = document.getElementById("finReceitaModeloTabela");
    if (tab) {
      const head = `<th>Dia</th>${series.map((s) => `<th>${esc(s.label)}</th>`).join("")}<th>Total</th>`;
      const body = days
        .map((d, i) => {
          const vals = series.map((s) => s.values[i] || 0);
          const tot = vals.reduce((a, b) => a + b, 0);
          if (tot === 0) return "";
          return `<tr><td>${esc(fmtBrDate(d))}</td>${vals.map((v) => `<td>${esc(brl(v))}</td>`).join("")}<td>${esc(brl(tot))}</td></tr>`;
        })
        .filter(Boolean)
        .join("");
      tab.innerHTML = `<table class="fin-table"><thead><tr>${head}</tr></thead><tbody>${
        body || '<tr><td colspan="8">Sem pagamentos no período para os modelos escolhidos.</td></tr>'
      }</tbody></table>`;
    }
  }

  function mapDestinoToLocal(raw) {
    const d = String(raw || "")
      .trim()
      .toLowerCase();
    if (!d) return "";
    if (d === "minha-moto" || d === "meu-transporte" || d === "carros" || d === "prontos") return d;
    if (d.startsWith("reserva")) return "reserva";
    if (d === "triagem" || d === "oficina-propria" || d === "oficina-terceiros" || d === "enviado-seguro" || d === "sinistrado-roubo") {
      return d;
    }
    if (d.includes("minha") && d.includes("moto")) return "minha-moto";
    if (d.includes("transporte")) return "meu-transporte";
    if (d.includes("carro")) return "carros";
    if (d.includes("pronto")) return "prontos";
    if (d.includes("triagem")) return "triagem";
    if (d.includes("propria")) return "oficina-propria";
    if (d.includes("terceir")) return "oficina-terceiros";
    if (d.includes("seguro")) return "enviado-seguro";
    if (d.includes("sinistro") || d.includes("roubo")) return "sinistrado-roubo";
    return "";
  }

  function snapshotAgoraPorLocal() {
    const counts = Object.fromEntries(LOCAIS.map((l) => [l.id, 0]));
    const placas = new Set();
    veiculosCadastro().forEach((v) => {
      const p = nkPlate(v?.placa);
      if (p) placas.add(p);
    });
    locacoesCadastro().forEach((l) => {
      const p = nkPlate(l?.placa);
      if (p) placas.add(p);
    });
    placas.forEach((p) => {
      const id = localIdDeEstado(estadoPlaca(p));
      if (id && counts[id] != null) counts[id] += 1;
    });
    return counts;
  }

  function eventosLocalizacao() {
    const rows = loadArr(MOV_KEY);
    const events = [];
    rows.forEach((r) => {
      const placa = nkPlate(r?.placa);
      if (!placa) return;
      const de = parseBrDate(r?.entradaData) || (r?.createdAt ? new Date(r.createdAt) : null);
      const cat = mapDestinoToLocal(r?.categoria);
      if (de && cat) events.push({ placa, dt: de, local: cat });
      const saida = parseBrDate(r?.saidaData);
      const dest = mapDestinoToLocal(r?.destino);
      if (saida && dest) events.push({ placa, dt: saida, local: dest });
    });
    events.sort((a, b) => a.dt - b.dt);
    return events;
  }

  function renderLocalizacao() {
    fillPeriodo("finLocalDe", "finLocalAte");
    const agora = snapshotAgoraPorLocal();
    const agoraEl = document.getElementById("finLocalAgora");
    if (agoraEl) {
      const tot = LOCAIS.reduce((s, l) => s + (agora[l.id] || 0), 0);
      agoraEl.innerHTML = `<h4 class="fin-subh">Agora (${tot} veículos localizados)</h4>
        <table class="fin-table"><thead><tr><th>Local</th><th>Qtd</th></tr></thead><tbody>${LOCAIS.map(
          (l) => `<tr><td>${esc(l.label)}</td><td>${agora[l.id] || 0}</td></tr>`
        ).join("")}</tbody></table>`;
    }
    const { de, ate } = readPeriodo("finLocalDe", "finLocalAte");
    const days = eachDay(de, ate);
    const events = eventosLocalizacao();
    const last = new Map();
    const series = LOCAIS.map((l, i) => ({
      id: l.id,
      label: l.label,
      color: LOCAL_COLORS[i],
      values: days.map(() => 0),
    }));
    const idx = Object.fromEntries(LOCAIS.map((l, i) => [l.id, i]));
    days.forEach((day, di) => {
      const fim = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 23, 59, 59);
      events.forEach((ev) => {
        if (ev.dt <= fim) last.set(ev.placa, ev.local);
      });
      last.forEach((loc) => {
        const i = idx[loc];
        if (i != null) series[i].values[di] += 1;
      });
    });
    const chart = document.getElementById("finLocalChart");
    if (chart) {
      chart.innerHTML = events.length
        ? `<h4 class="fin-subh">Por dia (movimentações da manutenção)</h4>${svgLineChart(days, series)}`
        : '<p class="subtext">Ainda não há movimentações de manutenção no período. A tabela «Agora» usa o estado actual da frota.</p>';
    }
    const tab = document.getElementById("finLocalTabela");
    if (tab && events.length) {
      const head = `<th>Dia</th>${LOCAIS.map((l) => `<th>${esc(String(l.n))}</th>`).join("")}`;
      const body = days
        .map((d, i) => {
          const vals = series.map((s) => s.values[i] || 0);
          if (!vals.some((v) => v > 0)) return "";
          return `<tr><td>${esc(fmtBrDate(d))}</td>${vals.map((v) => `<td>${v}</td>`).join("")}</tr>`;
        })
        .filter(Boolean)
        .join("");
      tab.innerHTML = `<table class="fin-table fin-table--compact"><thead><tr>${head}</tr></thead><tbody>${
        body || "<tr><td colspan='11'>Sem movimentos no período.</td></tr>"
      }</tbody></table>`;
    } else if (tab && !events.length) {
      tab.innerHTML = "";
    }
  }

  function renderDiaSemana() {
    fillPeriodo("finDiaDe", "finDiaAte");
    const { de, ate } = readPeriodo("finDiaDe", "finDiaAte");
    const labels = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
    const values = [0, 0, 0, 0, 0, 0, 0];
    pagamentosNoPeriodo(de, ate).forEach((p) => {
      values[p.dt.getDay()] += p.valor;
    });
    const chart = document.getElementById("finDiaChart");
    if (chart) chart.innerHTML = svgBarChart(labels, values, ["#ce93d8", "#5eb8ff", "#6ee7a0", "#f5d76e", "#ffb74d", "#80cbc4", "#c4a484"], true);
    const tab = document.getElementById("finDiaTabela");
    if (tab) {
      const tot = values.reduce((a, b) => a + b, 0);
      tab.innerHTML = `<table class="fin-table"><thead><tr><th>Dia</th><th>Total recebido</th><th>%</th></tr></thead><tbody>${labels
        .map((lb, i) => `<tr><td>${lb}</td><td>${esc(brl(values[i]))}</td><td>${tot ? ((values[i] / tot) * 100).toFixed(1) : "0"}%</td></tr>`)
        .join("")}<tr><td><strong>Total</strong></td><td><strong>${esc(brl(tot))}</strong></td><td>100%</td></tr></tbody></table>`;
    }
  }

  function stats(nums) {
    if (!nums.length) return { n: 0, media: 0, mediana: 0, desvio: 0, min: 0, max: 0 };
    const s = nums.slice().sort((a, b) => a - b);
    const n = s.length;
    const media = s.reduce((a, b) => a + b, 0) / n;
    const mediana = n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
    const varc = s.reduce((a, b) => a + (b - media) ** 2, 0) / n;
    return { n, media, mediana, desvio: Math.sqrt(varc), min: s[0], max: s[n - 1] };
  }

  function renderIntervalo() {
    const byCli = new Map();
    coletarPagamentos().forEach((p) => {
      const key = p.cpf || p.protocolo || p.nome || "—";
      if (!byCli.has(key)) byCli.set(key, { cpf: p.cpf, nome: p.nome, protocolo: p.protocolo, pags: [] });
      byCli.get(key).pags.push(p);
    });
    const linhas = [];
    const todosGaps = [];
    byCli.forEach((cli) => {
      const pags = cli.pags.slice().sort((a, b) => a.dt - b.dt);
      const gaps = [];
      for (let i = 1; i < pags.length; i++) gaps.push(daysBetween(pags[i - 1].dt, pags[i].dt));
      gaps.forEach((g) => todosGaps.push(g));
      const st = stats(gaps);
      const ultimo = pags[pags.length - 1];
      const proj = ultimo && st.n ? addDays(ultimo.dt, Math.round(st.media) || 7) : null;
      linhas.push({
        nome: cli.nome || "—",
        cpf: cli.cpf,
        n: pags.length,
        media: st.media,
        mediana: st.mediana,
        desvio: st.desvio,
        min: st.min,
        max: st.max,
        ultimo: ultimo ? ultimo.dt : null,
        proj,
        total: pags.reduce((s, p) => s + p.valor, 0),
      });
    });
    linhas.sort((a, b) => b.n - a.n || a.nome.localeCompare(b.nome, "pt-BR"));
    const glob = stats(todosGaps);
    const kpis = document.getElementById("finIntervaloKpis");
    if (kpis) {
      kpis.innerHTML = `<div class="fin-kpi"><span class="fin-kpi__lab">Clientes</span><strong>${linhas.length}</strong></div>
        <div class="fin-kpi"><span class="fin-kpi__lab">Intervalo médio</span><strong>${glob.n ? glob.media.toFixed(1) : "—"} d</strong></div>
        <div class="fin-kpi"><span class="fin-kpi__lab">Mediana</span><strong>${glob.n ? glob.mediana.toFixed(1) : "—"} d</strong></div>
        <div class="fin-kpi"><span class="fin-kpi__lab">Desvio</span><strong>${glob.n ? glob.desvio.toFixed(1) : "—"} d</strong></div>`;
    }
    const buckets = [
      { lab: "1–3 d", min: 1, max: 3 },
      { lab: "4–7 d", min: 4, max: 7 },
      { lab: "8–14 d", min: 8, max: 14 },
      { lab: "15–21 d", min: 15, max: 21 },
      { lab: "22–30 d", min: 22, max: 30 },
      { lab: ">30 d", min: 31, max: 9999 },
    ];
    const hist = buckets.map((b) => todosGaps.filter((g) => g >= b.min && g <= b.max).length);
    const chart = document.getElementById("finIntervaloChart");
    if (chart) {
      chart.innerHTML = todosGaps.length
        ? svgBarChart(
            buckets.map((b) => b.lab),
            hist,
            ["#5eb8ff", "#6ee7a0", "#f5d76e", "#ffb74d", "#ce93d8", "#ef9a9a"]
          )
        : '<p class="subtext">É preciso pelo menos dois pagamentos por cliente para calcular intervalos.</p>';
    }
    const tab = document.getElementById("finIntervaloTabela");
    if (tab) {
      tab.innerHTML = `<table class="fin-table"><thead><tr>
        <th>Cliente</th><th>Pagamentos</th><th>Média (d)</th><th>Mediana</th><th>Desvio</th>
        <th>Último</th><th>Próximo projetado</th><th>Total pago</th>
      </tr></thead><tbody>${
        linhas
          .map(
            (r) => `<tr>
              <td>${esc(r.nome)}${r.cpf ? `<br><span class="subtext">${esc(r.cpf)}</span>` : ""}</td>
              <td>${r.n}</td>
              <td>${r.n > 1 ? r.media.toFixed(1) : "—"}</td>
              <td>${r.n > 1 ? r.mediana.toFixed(1) : "—"}</td>
              <td>${r.n > 1 ? r.desvio.toFixed(1) : "—"}</td>
              <td>${r.ultimo ? esc(fmtBrDate(r.ultimo)) : "—"}</td>
              <td>${r.proj ? esc(fmtBrDate(r.proj)) : "—"}</td>
              <td>${esc(brl(r.total))}</td>
            </tr>`
          )
          .join("") || '<tr><td colspan="8">Sem pagamentos registados.</td></tr>'
      }</tbody></table>`;
    }
  }

  function newDespesaId() {
    return `dsp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function loadDespesas() {
    try {
      const raw = localStorage.getItem(DESPESAS_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr.filter((x) => x && !x.deleted) : [];
    } catch {
      return [];
    }
  }

  function saveDespesas(list) {
    const payload = list.map((x) => ({ ...x, updatedAt: x.updatedAt || Date.now() }));
    try {
      localStorage.setItem(DESPESAS_KEY, JSON.stringify(payload));
    } catch {
      /* ignore */
    }
    if (typeof window.saveCadastro === "function") {
      try {
        window.saveCadastro(DESPESAS_KEY, payload, { bypassImmutabilidadeCadastro: true });
      } catch {
        /* ignore */
      }
    }
    if (typeof window.portalPushCloudSnapshotAfterPersist === "function") {
      try {
        window.portalPushCloudSnapshotAfterPersist();
      } catch {
        /* ignore */
      }
    }
  }

  function catOptions(selected) {
    return DESPESA_CATS.map((c) => `<option value="${c.id}"${c.id === selected ? " selected" : ""}>${esc(c.label)}</option>`).join("");
  }

  function rowHtml(d) {
    return `<tr data-despesa-id="${esc(d.id)}">
      <td><input type="text" class="fin-despesa-valor" inputmode="decimal" value="${esc(d.valorFmt || (d.valor ? brl(d.valor).replace("R$", "").trim() : ""))}" aria-label="Valor"></td>
      <td><input type="text" class="fin-despesa-desc" maxlength="240" value="${esc(d.descricao || "")}" aria-label="Descrição"></td>
      <td><input type="text" class="fin-despesa-data" inputmode="numeric" maxlength="10" placeholder="DD/MM/AAAA" value="${esc(d.data || "")}" aria-label="Data"></td>
      <td><select class="fin-despesa-cat" aria-label="Categoria">${catOptions(d.categoria)}</select></td>
      <td><button type="button" class="btn-primary btn-secondary-outline fin-despesa-del">Apagar</button></td>
    </tr>`;
  }

  function readRow(tr) {
    const id = tr.getAttribute("data-despesa-id") || newDespesaId();
    const valorFmt = String(tr.querySelector(".fin-despesa-valor")?.value || "").trim();
    const descricao = String(tr.querySelector(".fin-despesa-desc")?.value || "").trim();
    const data = String(tr.querySelector(".fin-despesa-data")?.value || "").trim();
    const categoria = String(tr.querySelector(".fin-despesa-cat")?.value || "").trim();
    return {
      id,
      valor: parseValor(valorFmt),
      valorFmt,
      descricao,
      data,
      categoria,
      updatedAt: Date.now(),
    };
  }

  function persistDespesasDaTabela() {
    const body = document.getElementById("finDespesasBody");
    if (!body) return;
    const list = Array.from(body.querySelectorAll("tr[data-despesa-id]")).map(readRow);
    saveDespesas(list);
    renderDespesasResumo(list);
    const msg = document.getElementById("finDespesaMsg");
    if (msg) msg.textContent = "Despesas guardadas.";
  }

  function renderDespesasResumo(list) {
    const el = document.getElementById("finDespesasResumo");
    if (!el) return;
    const by = {};
    DESPESA_CATS.forEach((c) => {
      by[c.id] = 0;
    });
    (list || []).forEach((d) => {
      if (by[d.categoria] == null) by[d.categoria] = 0;
      by[d.categoria] += Number(d.valor) || 0;
    });
    const tot = Object.values(by).reduce((a, b) => a + b, 0);
    el.innerHTML = `<table class="fin-table"><thead><tr><th>Categoria</th><th>Total</th></tr></thead><tbody>${DESPESA_CATS.map(
      (c) => `<tr><td>${esc(c.label)}</td><td>${esc(brl(by[c.id] || 0))}</td></tr>`
    ).join("")}<tr><td><strong>Total</strong></td><td><strong>${esc(brl(tot))}</strong></td></tr></tbody></table>`;
  }

  function renderDespesas() {
    const body = document.getElementById("finDespesasBody");
    if (!body) return;
    const list = loadDespesas();
    body.innerHTML = list.length ? list.map(rowHtml).join("") : rowHtml({ id: newDespesaId(), categoria: "ADM", data: fmtBrDate(new Date()) });
    body.querySelectorAll(".fin-despesa-data").forEach((inp) => {
      if (typeof window.bindDateMaskInput === "function") window.bindDateMaskInput(inp);
    });
    renderDespesasResumo(list);
    const msg = document.getElementById("finDespesaMsg");
    if (msg) msg.textContent = "";
  }

  function bindDespesas() {
    if (despesasBound) return;
    despesasBound = true;
    document.getElementById("finDespesaAddBtn")?.addEventListener("click", () => {
      const body = document.getElementById("finDespesasBody");
      if (!body) return;
      body.insertAdjacentHTML("beforeend", rowHtml({ id: newDespesaId(), categoria: "ADM", data: fmtBrDate(new Date()) }));
      const last = body.querySelector("tr:last-child .fin-despesa-data");
      if (last && typeof window.bindDateMaskInput === "function") window.bindDateMaskInput(last);
      last?.closest("tr")?.querySelector(".fin-despesa-valor")?.focus();
    });
    document.getElementById("finDespesasTable")?.addEventListener("click", (e) => {
      const del = e.target.closest(".fin-despesa-del");
      if (!del) return;
      const tr = del.closest("tr");
      tr?.remove();
      persistDespesasDaTabela();
    });
    document.getElementById("finDespesasTable")?.addEventListener("change", () => persistDespesasDaTabela());
    document.getElementById("finDespesasTable")?.addEventListener("focusout", (e) => {
      if (e.currentTarget.contains(e.relatedTarget)) return;
      persistDespesasDaTabela();
    });
  }

  function renderModulo(id) {
    if (id === "quantitativo") renderQuantitativo();
    else if (id === "receita-plano") renderReceitaPlano();
    else if (id === "receita-modelo") renderReceitaModelo();
    else if (id === "localizacao") renderLocalizacao();
    else if (id === "dia-semana") renderDiaSemana();
    else if (id === "intervalo") renderIntervalo();
    else if (id === "despesas") {
      bindDespesas();
      renderDespesas();
    }
  }

  function bindNav() {
    document.querySelectorAll("#financeiroModulosNav [data-fin-mod]").forEach((btn) => {
      btn.addEventListener("click", () => abrirModulo(btn.getAttribute("data-fin-mod") || ""));
    });
    document.getElementById("finReceitaPlanoAplicar")?.addEventListener("click", () => renderReceitaPlano());
    document.getElementById("finReceitaModeloAplicar")?.addEventListener("click", () => renderReceitaModelo());
    document.getElementById("finLocalAplicar")?.addEventListener("click", () => renderLocalizacao());
    document.getElementById("finDiaAplicar")?.addEventListener("click", () => renderDiaSemana());
  }

  bindNav();

  window.__DK_financeiroHideModulos = hideModulos;
  window.__DK_financeiroModuloEscapeBack = () => {
    if (!moduloAberto) return false;
    showPlaceholder();
    return true;
  };
  window.__DK_financeiroModulosOnShow = () => {
    showPlaceholder();
  };
  const prevReset = window.__DK_financeiroReset;
  window.__DK_financeiroReset = () => {
    if (typeof prevReset === "function") prevReset();
    showPlaceholder();
  };
  window.__DK_mergeFinanceiroDespesas = (localArr, cloudArr) => {
    const byId = new Map();
    for (const arr of [localArr, cloudArr]) {
      if (!Array.isArray(arr)) continue;
      for (const row of arr) {
        if (!row || typeof row !== "object") continue;
        const id = String(row.id || "");
        if (!id) continue;
        const prev = byId.get(id);
        if (!prev || Number(row.updatedAt || 0) >= Number(prev.updatedAt || 0)) byId.set(id, row);
      }
    }
    return Array.from(byId.values()).filter((x) => !x.deleted);
  };
})();
