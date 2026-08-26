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
    { id: "SEGURO", label: "01-SEGURO", color: "#90caf9" },
    { id: "ADM", label: "02-ADM", color: "#f5d76e" },
    { id: "IMPOSTO", label: "03-IMPOSTO", color: "#ce93d8" },
    { id: "DOCUMENTOS", label: "04-DOCUMENTOS", color: "#80cbc4" },
    { id: "MULTAS", label: "05-MULTAS", color: "#ef9a9a" },
    { id: "SALARIOS", label: "06-SALARIOS", color: "#a5d6a7" },
    { id: "CONT_ADV_PROP", label: "07-CONT+ADV+PROP", color: "#c4a484" },
    { id: "MANUTENCAO", label: "08-MANUTENÇÃO", color: "#ffb74d" },
    { id: "ALUGUEL", label: "09-ALUGUEL", color: "#5eb8ff" },
    { id: "COMPRA_OLEO", label: "10-COMPRA DE ÓLEO", color: "#6ee7a0" },
    { id: "TROCA_OLEO", label: "11-TROCA DE ÓLEO", color: "#ff6b6b" },
  ];
  const MODELO_COLORS = ["#5eb8ff", "#6ee7a0", "#c4a484", "#f5d76e", "#ce93d8", "#ffb74d", "#80cbc4", "#ef9a9a", "#90caf9", "#a5d6a7"];

  const panel = document.getElementById("panel-financeiro-locadora");
  if (!panel) return;

  let moduloAberto = "";
  let despesasBound = false;
  let despesasGrafBound = false;
  let despesasRenderedIds = new Set();

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

  function bindFinDateCalendario(input) {
    if (typeof window.bindDkDateCalendario === "function") {
      window.bindDkDateCalendario(input);
      return;
    }
    /* fallback mínimo se app.js ainda não carregou */
    if (!input || input.dataset.dkCalBound === "1") return;
  }

  function bindFinDateCalendariosInView() {
    if (typeof window.bindDkIntervaloCalendarios === "function") {
      window.bindDkIntervaloCalendarios(document);
      return;
    }
    const ids = [
      "finReceitaPlanoDe",
      "finReceitaPlanoAte",
      "finReceitaModeloDe",
      "finReceitaModeloAte",
      "finLocalDe",
      "finLocalAte",
      "finDiaDe",
      "finDiaAte",
      "finDespGrafDe",
      "finDespGrafAte",
      "financeiroFiltroDe",
      "financeiroFiltroAte",
      "portalRelPagamentosInicio",
      "portalRelPagamentosFim",
    ];
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      if (typeof window.bindDateMaskInput === "function") window.bindDateMaskInput(el);
      bindFinDateCalendario(el);
    });
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
    if (a) bindFinDateCalendario(a);
    if (b) bindFinDateCalendario(b);
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
    /* Usa loadCadastro (com filtro oficial) — raw localStorage ainda pode ter Z1 fantasma. */
    if (typeof loadCadastro === "function") {
      return loadCadastro(key).filter((v) => {
        if (typeof window.__DK_isVeiculoFantasmaCadastro === "function") {
          return !window.__DK_isVeiculoFantasmaCadastro(v);
        }
        const tip = String(v?.codigo || v?.tipoPlanilha || "")
          .trim()
          .toUpperCase();
        return tip !== "Z1" && tip !== "HR70";
      });
    }
    return loadArr(key).filter((v) => {
      const tip = String(v?.codigo || v?.tipoPlanilha || "")
        .trim()
        .toUpperCase();
      return tip !== "Z1" && tip !== "HR70";
    });
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

  /** Coluna TIPO da planilha (CG, BROS, KWID…) — gravada em veiculo.codigo. */
  function tipoPlanilhaDeVeiculo(v) {
    const tip = String(v?.codigo || v?.tipoPlanilha || v?.tipoLinha || "").trim();
    if (tip && !/^DK(CR|MT)/i.test(tip)) return tip.toUpperCase();
    const modelo = String(v?.modelo || "").trim().toUpperCase();
    if (!modelo) return "SEM TIPO";
    if (modelo.includes("BROS")) return "BROS";
    if (modelo.includes("CG")) return "CG";
    if (modelo.includes("KWID")) return "KWID";
    if (modelo.includes("YBR") || modelo.includes("FACTOR")) return "YBR";
    if (modelo.includes("SHI")) return "SHI";
    if (modelo.includes("JEF") || modelo.includes("XY")) return "JEF";
    if (modelo.includes("ETIOS")) return "ETIOS";
    if (modelo.includes("PRISMA")) return "PRISMA";
    if (modelo.includes("CLASSIC")) return "CLASSIC";
    if (modelo.includes("HB20")) return "HB20";
    if (modelo.includes("GOL")) return "GOL";
    if (/\bKA\b/.test(modelo) || modelo.startsWith("KA ")) return "KA";
    return modelo.split(/\s+/)[0] || "SEM TIPO";
  }

  /** Categoria operacional: MOTO (cinza) ou CARRO (laranja). */
  function categoriaFrotaVeiculo(v) {
    const t = String(v?.tipo || v?.categoria || "").trim().toUpperCase();
    if (t.includes("CARRO")) return "CARRO";
    if (t.includes("MOTO")) return "MOTO";
    const tag = String(v?.tag || "").trim().toUpperCase();
    if (tag.includes("DKCR")) return "CARRO";
    if (tag.includes("DKMT")) return "MOTO";
    const tip = tipoPlanilhaDeVeiculo(v);
    const carros = new Set(["KWID", "CLASSIC", "KA", "PRISMA", "ETIOS", "GOL", "HB20"]);
    return carros.has(tip) ? "CARRO" : "MOTO";
  }

  function valorAquisicaoVeiculo(v) {
    const raw = v?.valor ?? v?.valorAquisicao ?? v?.valorCompra ?? 0;
    if (typeof raw === "number" && Number.isFinite(raw)) return Math.max(0, raw);
    return Math.max(0, parseValor(raw));
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
    bindFinDateCalendariosInView();
  }

  function svgLineChart(days, series, axisLabs) {
    const w = 1100;
    const h = 380;
    const padL = 58;
    const padR = 12;
    const padT = 16;
    const padB = 40;
    const innerW = w - padL - padR;
    const innerH = h - padT - padB;
    const allVals = series.flatMap((s) => s.values || []);
    const rawMax = Math.max(0, ...allVals);
    const rawMin = Math.min(0, ...allVals);
    const span = Math.max(1, rawMax - rawMin);
    const n = Math.max(1, days.length - 1);
    const xAt = (i) => padL + (days.length <= 1 ? innerW / 2 : (i / n) * innerW);
    const yAt = (v) => padT + innerH - ((v - rawMin) / span) * innerH;
    const grid = [0, 0.25, 0.5, 0.75, 1]
      .map((p) => {
        const val = rawMin + span * p;
        const y = yAt(val);
        return `<line x1="${padL}" y1="${y}" x2="${w - padR}" y2="${y}" stroke="rgba(255,255,255,0.12)"/>
          <text x="${padL - 6}" y="${y + 4}" text-anchor="end" fill="#bdbdbd" font-size="10">${esc(brl(val))}</text>`;
      })
      .join("");
    const zero =
      rawMin < 0
        ? `<line x1="${padL}" y1="${yAt(0)}" x2="${w - padR}" y2="${yAt(0)}" stroke="rgba(255,255,255,0.35)" stroke-dasharray="4 4"/>`
        : "";
    const step = days.length > 20 ? Math.ceil(days.length / 8) : 1;
    const axis = days
      .map((d, i) => {
        if (i % step !== 0 && i !== days.length - 1) return "";
        const lab = axisLabs ? String(axisLabs[i] || "") : fmtBrDate(d).slice(0, 5);
        if (!lab) return "";
        return `<text x="${xAt(i)}" y="${h - 12}" text-anchor="middle" fill="#bdbdbd" font-size="10">${esc(lab)}</text>`;
      })
      .join("");
    const lines = series
      .map((s) => {
        if (!s.values.length) return "";
        const split = Number.isFinite(s.forecastFrom) ? Math.max(0, Math.min(s.values.length - 1, s.forecastFrom)) : -1;
        const mk = (from, to, dashed) => {
          if (to < from) return "";
          const pts = [];
          for (let i = from; i <= to; i += 1) pts.push(`${xAt(i)},${yAt(s.values[i] || 0)}`);
          return `<polyline fill="none" stroke="${s.color}" stroke-width="2.2" ${dashed ? 'stroke-dasharray="7 5"' : ""} points="${pts.join(" ")}"/>`;
        };
        if (split >= 0 && split < s.values.length - 1) {
          return mk(0, split, false) + mk(split, s.values.length - 1, true);
        }
        return mk(0, s.values.length - 1, Boolean(s.dashed));
      })
      .join("");
    return `<svg class="fin-chart-svg" viewBox="0 0 ${w} ${h}" role="img" aria-label="Gráfico de linhas">${grid}${zero}${lines}${axis}</svg>`;
  }

  function svgBarChart(labels, values, colors, asMoney) {
    const w = 1100;
    const h = 340;
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

  function barAxisRange(vals) {
    const nums = (vals || []).map((v) => Number(v) || 0);
    const max = Math.max(0, ...nums);
    const min = Math.min(0, ...nums);
    const span = Math.max(1, max - min);
    return { min, max, span };
  }

  function svgStackedBarChart(labels, series) {
    const n = Math.max(1, labels.length);
    const w = Math.max(1100, n * 34 + 90);
    const h = 380;
    const padL = 72;
    const padR = 12;
    const padT = 18;
    const padB = 48;
    const innerW = w - padL - padR;
    const innerH = h - padT - padB;
    const posTot = labels.map((_, i) =>
      series.reduce((s, ser) => s + Math.max(0, Number(ser.values[i]) || 0), 0)
    );
    const negTot = labels.map((_, i) =>
      series.reduce((s, ser) => s + Math.min(0, Number(ser.values[i]) || 0), 0)
    );
    const { min, span } = barAxisRange([...posTot, ...negTot]);
    const yAt = (v) => padT + innerH - ((v - min) / span) * innerH;
    const zeroY = yAt(0);
    const bw = innerW / n;
    const grid = [0, 0.25, 0.5, 0.75, 1]
      .map((p) => {
        const val = min + span * p;
        const y = yAt(val);
        return `<line x1="${padL}" y1="${y}" x2="${w - padR}" y2="${y}" stroke="rgba(255,255,255,0.12)"/>
          <text x="${padL - 6}" y="${y + 4}" text-anchor="end" fill="#bdbdbd" font-size="10">${esc(brl(val))}</text>`;
      })
      .join("");
    const zero = `<line x1="${padL}" y1="${zeroY}" x2="${w - padR}" y2="${zeroY}" stroke="rgba(255,255,255,0.4)"/>`;
    const stacks = labels
      .map((_, i) => {
        let yPos = zeroY;
        let yNeg = zeroY;
        const rects = series
          .map((ser) => {
            const v = Number(ser.values[i]) || 0;
            if (!v) return "";
            const bh = Math.max((Math.abs(v) / span) * innerH, 0.8);
            let y;
            if (v > 0) {
              yPos -= bh;
              y = yPos;
            } else {
              y = yNeg;
              yNeg += bh;
            }
            return `<rect x="${padL + i * bw + bw * 0.18}" y="${y}" width="${bw * 0.64}" height="${bh}" fill="${ser.color}"/>`;
          })
          .join("");
        const lab = labels[i];
        const show = n <= 18 || i % Math.ceil(n / 12) === 0 || i === n - 1;
        const labEl = show
          ? `<text x="${padL + i * bw + bw * 0.5}" y="${h - 14}" text-anchor="middle" fill="#e0e0e0" font-size="10">${esc(lab)}</text>`
          : "";
        return rects + labEl;
      })
      .join("");
    return `<svg class="fin-chart-svg fin-chart-svg--bars" viewBox="0 0 ${w} ${h}" role="img" aria-label="Gráfico de barras empilhadas">${grid}${zero}${stacks}</svg>`;
  }

  function svgGroupedBarChart(labels, series) {
    const n = Math.max(1, labels.length);
    const k = Math.max(1, series.length);
    const w = Math.max(1100, n * 48 + 90);
    const h = 360;
    const padL = 72;
    const padR = 12;
    const padT = 18;
    const padB = 48;
    const innerW = w - padL - padR;
    const innerH = h - padT - padB;
    const { min, span } = barAxisRange(series.flatMap((s) => s.values));
    const yAt = (v) => padT + innerH - ((v - min) / span) * innerH;
    const groupW = innerW / n;
    const barW = (groupW * 0.7) / k;
    const grid = [0, 0.25, 0.5, 0.75, 1]
      .map((p) => {
        const val = min + span * p;
        const y = yAt(val);
        return `<line x1="${padL}" y1="${y}" x2="${w - padR}" y2="${y}" stroke="rgba(255,255,255,0.12)"/>
          <text x="${padL - 6}" y="${y + 4}" text-anchor="end" fill="#bdbdbd" font-size="10">${esc(brl(val))}</text>`;
      })
      .join("");
    const zero = `<line x1="${padL}" y1="${yAt(0)}" x2="${w - padR}" y2="${yAt(0)}" stroke="rgba(255,255,255,0.4)"/>`;
    const bars = labels
      .map((lab, i) => {
        const groupX = padL + i * groupW + groupW * 0.15;
        const rects = series
          .map((ser, si) => {
            const v = Number(ser.values[i]) || 0;
            if (!v) return "";
            const yTop = yAt(Math.max(0, v));
            const yBot = yAt(Math.min(0, v));
            const bh = Math.max(yBot - yTop, 0.8);
            const x = groupX + si * barW;
            return `<rect x="${x}" y="${yTop}" width="${Math.max(barW * 0.9, 4)}" height="${bh}" fill="${ser.color}" rx="2"/>`;
          })
          .join("");
        const show = n <= 18 || i % Math.ceil(n / 12) === 0 || i === n - 1;
        const labEl = show
          ? `<text x="${padL + i * groupW + groupW * 0.5}" y="${h - 14}" text-anchor="middle" fill="#e0e0e0" font-size="10">${esc(lab)}</text>`
          : "";
        return rects + labEl;
      })
      .join("");
    return `<svg class="fin-chart-svg fin-chart-svg--bars" viewBox="0 0 ${w} ${h}" role="img" aria-label="Gráfico de barras agrupadas">${grid}${zero}${bars}</svg>`;
  }

  function svgHBar(rows, opts = {}) {
    const formatVal =
      typeof opts.formatVal === "function" ? opts.formatVal : (n) => String(n);
    const money = Boolean(opts.money);
    const max = Math.max(1, ...rows.map((r) => Number(r.value) || 0));
    const blocks = [];
    let lastCat = "";
    rows.forEach((r) => {
      const cat = r.categoria === "CARRO" ? "CARRO" : "MOTO";
      if (cat !== lastCat) {
        lastCat = cat;
        blocks.push(
          `<div class="fin-hbar__group" data-cat="${cat}">${cat === "MOTO" ? "Motos" : "Carros"}</div>`
        );
      }
      const pct = Math.max(2, ((Number(r.value) || 0) / max) * 100);
      const fillClass = cat === "CARRO" ? "fin-hbar__fill--carro" : "fin-hbar__fill--moto";
      blocks.push(`<div class="fin-hbar__row" data-cat="${cat}">
          <span class="fin-hbar__lab" title="${esc(r.label)}">${esc(r.label)}</span>
          <span class="fin-hbar__track"><span class="fin-hbar__fill ${fillClass}" style="width:${pct}%"></span></span>
          <span class="fin-hbar__val${money ? " fin-hbar__val--money" : ""}">${esc(formatVal(r.value))}</span>
        </div>`);
    });
    return `<div class="fin-hbar${money ? " fin-hbar--money" : ""}">${blocks.join("")}</div>`;
  }

  function agregarQuantitativoPorTipo() {
    const byTipo = new Map();
    veiculosCadastro().forEach((v) => {
      const label = tipoPlanilhaDeVeiculo(v);
      const categoria = categoriaFrotaVeiculo(v);
      const valor = valorAquisicaoVeiculo(v);
      const prev = byTipo.get(label);
      if (!prev) {
        byTipo.set(label, { label, categoria, qtd: 1, valor });
        return;
      }
      prev.qtd += 1;
      prev.valor += valor;
      /* Se houver divergência, CARRO vence só se a maioria for carro — mantém 1.ª categoria. */
    });
    return [...byTipo.values()];
  }

  function ordenarTiposMotoDepoisCarro(rows, valueKey) {
    const rank = (c) => (c === "MOTO" ? 0 : 1);
    return [...rows].sort((a, b) => {
      const rc = rank(a.categoria) - rank(b.categoria);
      if (rc) return rc;
      const va = Number(a[valueKey]) || 0;
      const vb = Number(b[valueKey]) || 0;
      if (vb !== va) return vb - va;
      return a.label.localeCompare(b.label, "pt-BR");
    });
  }

  function tabelaQuantitativo(rows, valueKey, valueHeader, total, formatCell) {
    if (!rows.length) return "";
    const fmt = typeof formatCell === "function" ? formatCell : (n) => String(n);
    const body = rows
      .map((r) => {
        const v = Number(r[valueKey]) || 0;
        const pct = total ? ((v / total) * 100).toFixed(1) : "0";
        const cat = r.categoria === "CARRO" ? "Carro" : "Moto";
        return `<tr data-cat="${esc(r.categoria)}"><td>${esc(r.label)}</td><td>${esc(cat)}</td><td>${esc(fmt(v))}</td><td>${pct}%</td></tr>`;
      })
      .join("");
    return `<table class="fin-table"><thead><tr><th>TIPO</th><th>Categoria</th><th>${esc(valueHeader)}</th><th>%</th></tr></thead><tbody>${body}</tbody></table>`;
  }

  function renderQuantitativo() {
    const agg = agregarQuantitativoPorTipo();
    const rowsQtd = ordenarTiposMotoDepoisCarro(agg, "qtd").map((r) => ({
      label: r.label,
      value: r.qtd,
      categoria: r.categoria,
    }));
    const rowsVal = ordenarTiposMotoDepoisCarro(agg, "valor").map((r) => ({
      label: r.label,
      value: r.valor,
      categoria: r.categoria,
    }));
    const totalQtd = rowsQtd.reduce((s, r) => s + (Number(r.value) || 0), 0);
    const totalVal = rowsVal.reduce((s, r) => s + (Number(r.value) || 0), 0);
    const nMotos = agg.filter((r) => r.categoria === "MOTO").reduce((s, r) => s + r.qtd, 0);
    const nCarros = agg.filter((r) => r.categoria === "CARRO").reduce((s, r) => s + r.qtd, 0);
    const kpis = document.getElementById("finQuantitativoKpis");
    if (kpis) {
      kpis.innerHTML = `<div class="fin-kpi"><span class="fin-kpi__lab">Veículos</span><strong>${totalQtd}</strong></div>
        <div class="fin-kpi"><span class="fin-kpi__lab">Motos</span><strong>${nMotos}</strong></div>
        <div class="fin-kpi"><span class="fin-kpi__lab">Carros</span><strong>${nCarros}</strong></div>
        <div class="fin-kpi"><span class="fin-kpi__lab">TIPOS</span><strong>${agg.length}</strong></div>
        <div class="fin-kpi"><span class="fin-kpi__lab">Aquisição</span><strong>${esc(brl(totalVal))}</strong></div>`;
    }
    const chart = document.getElementById("finQuantitativoChart");
    if (chart) {
      chart.innerHTML = rowsQtd.length
        ? svgHBar(rowsQtd)
        : '<p class="subtext">Nenhum veículo no cadastro.</p>';
    }
    const tab = document.getElementById("finQuantitativoTabela");
    if (tab) tab.innerHTML = tabelaQuantitativo(rowsQtd, "value", "Quantidade", totalQtd);
    const chartVal = document.getElementById("finQuantitativoValorChart");
    if (chartVal) {
      chartVal.innerHTML = rowsVal.length
        ? svgHBar(rowsVal, { money: true, formatVal: (n) => brl(n) })
        : "";
    }
    const tabVal = document.getElementById("finQuantitativoValorTabela");
    if (tabVal) {
      tabVal.innerHTML = tabelaQuantitativo(agg.length ? ordenarTiposMotoDepoisCarro(agg, "valor") : [], "valor", "Valor aquisição", totalVal, (n) => brl(n));
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

  function seedDespesasById() {
    const m = new Map();
    const seed = window.__DK_DESPESAS_HISTORICO;
    if (!Array.isArray(seed)) return m;
    seed.forEach((row) => {
      if (!row || !row.id) return;
      m.set(String(row.id), { ...row });
    });
    return m;
  }

  function loadStoredDespesas() {
    try {
      const raw = localStorage.getItem(DESPESAS_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr.filter((x) => x && typeof x === "object") : [];
    } catch {
      return [];
    }
  }

  function isPlanilhaDespesaId(id, row) {
    return String(row?.origem || "") === "planilha" || /^dsp-xlsx/.test(String(id || ""));
  }

  function isObsoletePlanilhaDespesa(row, seed) {
    const id = String(row?.id || "");
    if (!id) return true;
    return isPlanilhaDespesaId(id, row) && !(seed || seedDespesasById()).has(id);
  }

  function loadDespesasAll() {
    const byId = seedDespesasById();
    const stored = loadStoredDespesas();
    const kept = [];
    stored.forEach((row) => {
      const id = String(row.id || "");
      if (!id) return;
      if (isObsoletePlanilhaDespesa(row, byId)) return;
      byId.set(id, { ...(byId.get(id) || {}), ...row });
      kept.push(row);
    });
    if (kept.length !== stored.length) {
      try {
        localStorage.setItem(DESPESAS_KEY, JSON.stringify(kept));
      } catch {
        /* ignore */
      }
      if (typeof window.saveCadastro === "function") {
        try {
          window.saveCadastro(DESPESAS_KEY, kept, { bypassImmutabilidadeCadastro: true });
        } catch {
          /* ignore */
        }
      }
    }
    return Array.from(byId.values());
  }

  function loadDespesas() {
    return loadDespesasAll().filter((x) => !x.deleted);
  }

  function overlayDespesas(list) {
    const seed = seedDespesasById();
    return (list || []).filter((row) => {
      if (!row || !row.id) return false;
      if (isObsoletePlanilhaDespesa(row, seed)) return false;
      if (row.deleted) return true;
      const s = seed.get(String(row.id));
      if (!s) return true;
      return (
        Number(row.valor) !== Number(s.valor) ||
        String(row.descricao || "") !== String(s.descricao || "") ||
        String(row.data || "") !== String(s.data || "") ||
        String(row.categoria || "") !== String(s.categoria || "") ||
        String(row.placa || "") !== String(s.placa || "")
      );
    });
  }

  function saveDespesas(list) {
    const payload = overlayDespesas(list).map((x) => ({ ...x, updatedAt: x.updatedAt || Date.now() }));
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

  function isDespesaComPlaca(cat) {
    const c = String(cat || "").trim().toUpperCase();
    return c === "MANUTENCAO" || c === "TROCA_OLEO" || c === "COMPRA_OLEO";
  }

  function isDespesaPlacaObrigatoria(cat) {
    const c = String(cat || "").trim().toUpperCase();
    return c === "MANUTENCAO" || c === "TROCA_OLEO";
  }

  function convertPlacaAntigaLocal(raw) {
    const p = nkPlate(raw);
    if (typeof window.convertPlacaAntigaParaMercosul === "function") {
      const conv = nkPlate(window.convertPlacaAntigaParaMercosul(p));
      if (conv) return conv;
    }
    if (!/^[A-Z]{3}[0-9]{4}$/.test(p)) return "";
    const letter = "ABCDEFGHIJ"[Number(p[4])];
    return letter ? p.slice(0, 4) + letter + p.slice(5) : "";
  }

  function frotaPlacasSet() {
    const s = new Set();
    const add = (raw) => {
      const p = nkPlate(raw);
      if (!p) return;
      s.add(p);
      const conv = convertPlacaAntigaLocal(p);
      if (conv) s.add(conv);
    };
    (window.__DK_FROTA_PLACAS || []).forEach(add);
    veiculosCadastro().forEach((v) => add(v?.placa));
    return s;
  }

  function placaPertenceAFrota(raw) {
    const p = nkPlate(raw);
    if (!p) return false;
    const frota = frotaPlacasSet();
    if (frota.has(p)) return true;
    const conv = convertPlacaAntigaLocal(p);
    return Boolean(conv && frota.has(conv));
  }

  function extractPlacaDaDescricao(desc) {
    const t = String(desc || "").toUpperCase();
    const frota = frotaPlacasSet();
    const cands = [];
    const seen = new Set();
    const add = (raw) => {
      const n = nkPlate(raw);
      if (!n || seen.has(n)) return;
      seen.add(n);
      cands.push(n);
      const conv = convertPlacaAntigaLocal(n);
      if (conv && !seen.has(conv)) {
        seen.add(conv);
        cands.push(conv);
      }
    };
    (t.match(/[A-Z]{3}[0-9][A-Z][0-9]{2}/g) || []).forEach(add);
    (t.match(/[A-Z]{3}[0-9]{4}/g) || []).forEach(add);
    for (let i = cands.length - 1; i >= 0; i -= 1) {
      if (frota.has(cands[i])) return cands[i];
    }
    return "";
  }

  function isDespesaManutencao(cat) {
    return isDespesaComPlaca(cat);
  }

  function normDespesaPlaca(raw) {
    const p = nkPlate(raw);
    if (!p) return "";
    if (typeof window.normalizePlacaParaCadastro === "function") {
      return window.normalizePlacaParaCadastro(p) || p;
    }
    return p;
  }

  function placasFrotaLista() {
    return Array.from(frotaPlacasSet()).sort();
  }

  function fillPlacasDatalist() {
    const dl = document.getElementById("finDespesaPlacasList");
    if (!dl) return;
    dl.innerHTML = placasFrotaLista()
      .map((p) => `<option value="${esc(p)}"></option>`)
      .join("");
  }

  function catOptions(selected) {
    return DESPESA_CATS.map((c) => `<option value="${c.id}"${c.id === selected ? " selected" : ""}>${esc(c.label)}</option>`).join("");
  }

  function syncDespesaPlacaCell(tr) {
    if (!tr) return;
    const cat = tr.querySelector(".fin-despesa-cat")?.value;
    const precisa = isDespesaComPlaca(cat);
    tr.classList.toggle("fin-despesa-row--manut", precisa);
    const inp = tr.querySelector(".fin-despesa-placa");
    if (!inp) return;
    inp.disabled = !precisa;
    inp.setAttribute("aria-required", isDespesaPlacaObrigatoria(cat) ? "true" : "false");
    if (!precisa) inp.value = "";
    if (precisa && !nkPlate(inp.value)) {
      const fromDesc = extractPlacaDaDescricao(tr.querySelector(".fin-despesa-desc")?.value);
      if (fromDesc) inp.value = fromDesc;
    }
  }

  function rowHtml(d) {
    const manut = isDespesaManutencao(d.categoria);
    return `<tr data-despesa-id="${esc(d.id)}" class="${manut ? "fin-despesa-row--manut" : ""}">
      <td><input type="text" class="fin-despesa-valor" inputmode="decimal" value="${esc(d.valorFmt || (d.valor ? brl(d.valor).replace("R$", "").trim() : ""))}" aria-label="Valor"></td>
      <td><input type="text" class="fin-despesa-desc" maxlength="240" value="${esc(d.descricao || "")}" aria-label="Descrição"></td>
      <td><input type="text" class="fin-despesa-data" inputmode="numeric" maxlength="10" placeholder="DD/MM/AAAA" value="${esc(d.data || "")}" aria-label="Data"></td>
      <td><select class="fin-despesa-cat" aria-label="Categoria">${catOptions(d.categoria)}</select></td>
      <td class="fin-despesa-placa-cell"><input type="text" class="fin-despesa-placa" maxlength="8" placeholder="Qual a placa?" list="finDespesaPlacasList" value="${esc(d.placa || "")}" aria-label="Placa" ${manut ? "" : "disabled"}></td>
      <td><button type="button" class="btn-primary btn-secondary-outline fin-despesa-del">Apagar</button></td>
    </tr>`;
  }

  function readRow(tr) {
    const id = tr.getAttribute("data-despesa-id") || newDespesaId();
    const valorFmt = String(tr.querySelector(".fin-despesa-valor")?.value || "").trim();
    const descricao = String(tr.querySelector(".fin-despesa-desc")?.value || "").trim();
    const data = String(tr.querySelector(".fin-despesa-data")?.value || "").trim();
    const categoria = String(tr.querySelector(".fin-despesa-cat")?.value || "").trim();
    const placaRaw = tr.querySelector(".fin-despesa-placa")?.value;
    let placa = isDespesaComPlaca(categoria) ? normDespesaPlaca(placaRaw) : "";
    if (isDespesaComPlaca(categoria) && !placa) placa = extractPlacaDaDescricao(descricao);
    if (placa && !placaPertenceAFrota(placa)) placa = "";
    return {
      id,
      valor: parseValor(valorFmt),
      valorFmt,
      descricao,
      data,
      categoria,
      placa,
      updatedAt: Date.now(),
    };
  }

  function stampDespesaResponsavel(prev, row) {
    if (prev?.registradoPorCpf || prev?.cadastradoPorCpf) {
      return {
        registradoPorCpf: String(prev.registradoPorCpf || prev.cadastradoPorCpf || "").replace(/\D/g, "").slice(0, 11),
        registradoPorNome: String(prev.registradoPorNome || prev.cadastradoPorNome || "").trim(),
        registradoPorLabel: String(prev.registradoPorLabel || prev.cadastradoPorLabel || "").trim(),
      };
    }
    if (typeof window.__DK_portalStampRegistradoPor === "function") {
      return window.__DK_portalStampRegistradoPor();
    }
    return {};
  }

  function persistDespesasDaTabela() {
    const body = document.getElementById("finDespesasBody");
    if (!body) return;
    const byId = new Map(loadDespesasAll().map((x) => [String(x.id), { ...x }]));
    const nowVisible = new Set();
    Array.from(body.querySelectorAll("tr[data-despesa-id]")).forEach((tr) => {
      const row = readRow(tr);
      nowVisible.add(row.id);
      const prev = byId.get(row.id) || {};
      const stamp = stampDespesaResponsavel(prev, row);
      byId.set(row.id, {
        ...prev,
        ...row,
        ...stamp,
        deleted: false,
        origem: prev.origem || row.origem,
      });
    });
    for (const id of despesasRenderedIds) {
      if (!nowVisible.has(id)) {
        const prev = byId.get(id);
        if (prev) byId.set(id, { ...prev, deleted: true, updatedAt: Date.now() });
      }
    }
    despesasRenderedIds = nowVisible;
    const all = Array.from(byId.values());
    saveDespesas(all);
    const list = all.filter((x) => !x.deleted);
    renderDespesasResumo(list);
    const msg = document.getElementById("finDespesaMsg");
    if (!msg) return;
    const faltaPlaca = list.some((d) => isDespesaPlacaObrigatoria(d.categoria) && !nkPlate(d.placa));
    msg.textContent = faltaPlaca
      ? "Manutenção / troca de óleo: informe a placa do veículo (ou deixe na descrição)."
      : "Despesas guardadas.";
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
    const porPlaca = {};
    (list || []).forEach((d) => {
      if (!isDespesaComPlaca(d.categoria)) return;
      const p = nkPlate(d.placa) || extractPlacaDaDescricao(d.descricao) || "(sem placa)";
      porPlaca[p] = (porPlaca[p] || 0) + (Number(d.valor) || 0);
    });
    const placasRows = Object.keys(porPlaca)
      .sort()
      .map((p) => `<tr><td>${esc(p)}</td><td>${esc(brl(porPlaca[p]))}</td></tr>`)
      .join("");
    el.innerHTML = `<table class="fin-table"><thead><tr><th>Categoria</th><th>Total</th></tr></thead><tbody>${DESPESA_CATS.map(
      (c) => `<tr><td>${esc(c.label)}</td><td>${esc(brl(by[c.id] || 0))}</td></tr>`
    ).join("")}<tr><td><strong>Total</strong></td><td><strong>${esc(brl(tot))}</strong></td></tr></tbody></table>${
      placasRows
        ? `<h4 class="fin-subh">Manutenção e óleo por placa</h4><table class="fin-table"><thead><tr><th>Placa</th><th>Total</th></tr></thead><tbody>${placasRows}</tbody></table>`
        : ""
    }`;
  }

  function parseDespesaData(d) {
    const dt = parseBrDate(d?.data);
    return dt;
  }

  function sortDespesas(list) {
    return [...(list || [])].sort((a, b) => {
      const da = parseDespesaData(a);
      const db = parseDespesaData(b);
      const ta = da ? da.getTime() : 0;
      const tb = db ? db.getTime() : 0;
      if (tb !== ta) return tb - ta;
      return String(b.id).localeCompare(String(a.id));
    });
  }

  function ensureDespesasHistorico() {
    return Array.isArray(window.__DK_DESPESAS_HISTORICO) ? window.__DK_DESPESAS_HISTORICO.length : 0;
  }

  function renderDespesas() {
    const body = document.getElementById("finDespesasBody");
    if (!body) return;
    ensureDespesasHistorico();
    fillPlacasDatalist();
    const list = sortDespesas(loadDespesas());
    const q = nk(document.getElementById("finDespesaBusca")?.value || "");
    const qCompact = q.replace(/ /g, "");
    const filtered = qCompact
      ? list.filter((d) =>
          nk(`${d.descricao} ${d.placa} ${d.categoria} ${d.data}`).replace(/ /g, "").includes(qCompact)
        )
      : list;
    const vis = filtered.slice(0, 80);
    body.innerHTML = vis.length ? vis.map(rowHtml).join("") : rowHtml({ id: newDespesaId(), categoria: "ADM", data: fmtBrDate(new Date()) });
    despesasRenderedIds = new Set(Array.from(body.querySelectorAll("tr[data-despesa-id]")).map((tr) => tr.getAttribute("data-despesa-id")));
    body.querySelectorAll(".fin-despesa-data").forEach((inp) => {
      if (typeof window.bindDateMaskInput === "function") window.bindDateMaskInput(inp);
    });
    body.querySelectorAll("tr[data-despesa-id]").forEach((tr) => syncDespesaPlacaCell(tr));
    renderDespesasResumo(list);
    const info = document.getElementById("finDespesaListaInfo");
    if (info) {
      info.textContent =
        list.length > vis.length
          ? `A mostrar ${vis.length} de ${list.length} lançamentos (os mais recentes). Use a busca ou o gráfico.`
          : `${list.length} lançamento(s).`;
    }
    const msg = document.getElementById("finDespesaMsg");
    if (msg) msg.textContent = "";
  }

  function bindDespesas() {
    if (despesasBound) return;
    despesasBound = true;
    document.getElementById("finDespesaAddBtn")?.addEventListener("click", () => {
      persistDespesasDaTabela();
      const body = document.getElementById("finDespesasBody");
      if (!body) return;
      body.insertAdjacentHTML("afterbegin", rowHtml({ id: newDespesaId(), categoria: "ADM", data: fmtBrDate(new Date()) }));
      const first = body.querySelector("tr:first-child");
      const dataInp = first?.querySelector(".fin-despesa-data");
      if (dataInp && typeof window.bindDateMaskInput === "function") window.bindDateMaskInput(dataInp);
      const id = first?.getAttribute("data-despesa-id");
      if (id) despesasRenderedIds.add(id);
      syncDespesaPlacaCell(first);
      first?.querySelector(".fin-despesa-valor")?.focus();
    });
    document.getElementById("finDespesaBusca")?.addEventListener("input", () => {
      persistDespesasDaTabela();
      renderDespesas();
    });
    document.getElementById("finDespesasTable")?.addEventListener("click", (e) => {
      const del = e.target.closest(".fin-despesa-del");
      if (!del) return;
      const tr = del.closest("tr");
      tr?.remove();
      persistDespesasDaTabela();
    });
    document.getElementById("finDespesasTable")?.addEventListener("change", (e) => {
      const cat = e.target.closest?.(".fin-despesa-cat");
      if (cat) {
        const tr = cat.closest("tr");
        syncDespesaPlacaCell(tr);
        if (isDespesaPlacaObrigatoria(cat.value)) {
          const placaInp = tr?.querySelector(".fin-despesa-placa");
          placaInp?.focus();
          const msg = document.getElementById("finDespesaMsg");
          if (msg) msg.textContent = "Informe a placa do veículo (também pode estar na descrição).";
        }
      }
      const desc = e.target.closest?.(".fin-despesa-desc");
      if (desc) {
        const tr = desc.closest("tr");
        syncDespesaPlacaCell(tr);
      }
      const placaInp = e.target.closest?.(".fin-despesa-placa");
      if (placaInp) {
        const n = normDespesaPlaca(placaInp.value);
        if (n) placaInp.value = n;
      }
      persistDespesasDaTabela();
    });
    document.getElementById("finDespesasTable")?.addEventListener("focusout", (e) => {
      if (e.currentTarget.contains(e.relatedTarget)) return;
      persistDespesasDaTabela();
    });
  }

  function despesaGrafGran() {
    return String(document.querySelector('input[name="finDespGrafGran"]:checked')?.value || "mensal");
  }

  function isoWeekKey(d) {
    const x = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const day = x.getUTCDay() || 7;
    x.setUTCDate(x.getUTCDate() + 4 - day);
    const yearStart = new Date(Date.UTC(x.getUTCFullYear(), 0, 1));
    const week = Math.ceil(((x - yearStart) / 86400000 + 1) / 7);
    return `${x.getUTCFullYear()}-S${String(week).padStart(2, "0")}`;
  }

  function bucketKeyForDate(d, gran) {
    if (gran === "diaria") return ymd(d);
    if (gran === "semanal") return isoWeekKey(d);
    if (gran === "anual") return String(d.getFullYear());
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }

  function bucketLabel(key, gran) {
    if (gran === "diaria") {
      const [y, m, d] = key.split("-");
      return `${d}/${m}`;
    }
    if (gran === "semanal") return key.replace("-", " ");
    if (gran === "anual") return key;
    const [y, m] = key.split("-");
    return `${m}/${y}`;
  }

  function filtrarDespesasGrafico(list) {
    const de = parseBrDate(document.getElementById("finDespGrafDe")?.value);
    const ate = parseBrDate(document.getElementById("finDespGrafAte")?.value);
    const placaF = nkPlate(document.getElementById("finDespGrafPlaca")?.value);
    const catInputs = Array.from(document.querySelectorAll("#finDespGrafCats input[type=checkbox]"));
    const cats = new Set(catInputs.filter((el) => el.checked).map((el) => el.value));
    return (list || []).filter((d) => {
      if (catInputs.length && !cats.has(d.categoria)) return false;
      const dt = parseDespesaData(d);
      if (de && (!dt || dt < de)) return false;
      if (ate && (!dt || dt > ate)) return false;
      if (placaF) {
        const p = nkPlate(d.placa) || extractPlacaDaDescricao(d.descricao);
        if (p !== placaF) return false;
      }
      return true;
    });
  }

  function agregarDespesasPorBucket(rows, gran, catIds) {
    const keys = new Set();
    const byCat = {};
    catIds.forEach((id) => {
      byCat[id] = {};
    });
    rows.forEach((d) => {
      const dt = parseDespesaData(d);
      if (!dt) return;
      const k = bucketKeyForDate(dt, gran);
      keys.add(k);
      const cat = d.categoria || "ADM";
      if (!byCat[cat]) byCat[cat] = {};
      byCat[cat][k] = (byCat[cat][k] || 0) + (Number(d.valor) || 0);
    });
    const labelsKeys = [...keys].sort();
    return {
      labels: labelsKeys.map((k) => bucketLabel(k, gran)),
      keys: labelsKeys,
      byCat,
    };
  }

  function syncDespGrafCats() {
    const wrap = document.getElementById("finDespGrafCats");
    if (!wrap || wrap.dataset.ready === "1") return;
    wrap.innerHTML = DESPESA_CATS.map(
      (c) =>
        `<label><input type="checkbox" value="${esc(c.id)}" checked> ${esc(c.label)}</label>`
    ).join("");
    wrap.dataset.ready = "1";
  }

  function fillDespGrafPeriodoDefault(list) {
    const deEl = document.getElementById("finDespGrafDe");
    const ateEl = document.getElementById("finDespGrafAte");
    if (!deEl || !ateEl) return;
    if (deEl.value && ateEl.value) return;
    const dates = (list || []).map(parseDespesaData).filter(Boolean).sort((a, b) => a - b);
    if (!dates.length) {
      fillPeriodo("finDespGrafDe", "finDespGrafAte");
      return;
    }
    if (!deEl.value) deEl.value = fmtBrDate(dates[0]);
    if (!ateEl.value) ateEl.value = fmtBrDate(dates[dates.length - 1]);
    if (typeof window.bindDateMaskInput === "function") {
      window.bindDateMaskInput(deEl);
      window.bindDateMaskInput(ateEl);
    }
  }

  function renderDespesasGraficos() {
    ensureDespesasHistorico();
    fillPlacasDatalist();
    syncDespGrafCats();
    const all = loadDespesas();
    fillDespGrafPeriodoDefault(all);
    const gran = despesaGrafGran();
    const rows = filtrarDespesasGrafico(all);
    const catIds = DESPESA_CATS.map((c) => c.id);
    const agg = agregarDespesasPorBucket(rows, gran, catIds);
    const series = DESPESA_CATS.map((c) => ({
      id: c.id,
      label: c.label,
      color: c.color,
      values: agg.keys.map((k) => Number(agg.byCat[c.id]?.[k]) || 0),
    })).filter((s) => s.values.some((v) => v !== 0));
    const chart = document.getElementById("finDespGrafChart");
    if (chart) {
      chart.innerHTML = agg.labels.length
        ? svgStackedBarChart(agg.labels, series)
        : `<p class="subtext">Sem despesas no filtro.</p>`;
    }
    const leg = document.getElementById("finDespGrafLegenda");
    if (leg) {
      leg.innerHTML = series
        .map((s) => {
          const tot = s.values.reduce((a, b) => a + b, 0);
          return `<span class="fin-legenda__item"><i style="background:${s.color}"></i>${esc(s.label)} · ${esc(brl(tot))}</span>`;
        })
        .join("");
    }
    const kpis = document.getElementById("finDespGrafKpis");
    if (kpis) {
      const tot = rows.reduce((s, d) => s + (Number(d.valor) || 0), 0);
      kpis.innerHTML = `<div class="fin-kpi"><span class="fin-kpi__lab">Lançamentos</span><strong>${rows.length}</strong></div>
        <div class="fin-kpi"><span class="fin-kpi__lab">Total filtrado</span><strong>${esc(brl(tot))}</strong></div>
        <div class="fin-kpi"><span class="fin-kpi__lab">Períodos</span><strong>${agg.labels.length}</strong></div>`;
    }

    const oleoRows = rows.filter((d) => d.categoria === "COMPRA_OLEO" || d.categoria === "TROCA_OLEO");
    const oleoAgg = agregarDespesasPorBucket(oleoRows, gran, ["COMPRA_OLEO", "TROCA_OLEO"]);
    const oleoSeries = [
      {
        id: "COMPRA_OLEO",
        label: "10-COMPRA DE ÓLEO",
        color: "#6ee7a0",
        values: oleoAgg.keys.map((k) => Number(oleoAgg.byCat.COMPRA_OLEO?.[k]) || 0),
      },
      {
        id: "TROCA_OLEO",
        label: "11-TROCA DE ÓLEO",
        color: "#ff6b6b",
        values: oleoAgg.keys.map((k) => Number(oleoAgg.byCat.TROCA_OLEO?.[k]) || 0),
      },
    ];
    const oleoChart = document.getElementById("finDespOleoChart");
    if (oleoChart) {
      oleoChart.innerHTML = oleoAgg.labels.length
        ? svgGroupedBarChart(oleoAgg.labels, oleoSeries)
        : `<p class="subtext">Sem compra/troca de óleo no filtro.</p>`;
    }
    const oleoLeg = document.getElementById("finDespOleoLegenda");
    if (oleoLeg) {
      oleoLeg.innerHTML = oleoSeries
        .map((s) => {
          const tot = s.values.reduce((a, b) => a + b, 0);
          return `<span class="fin-legenda__item"><i style="background:${s.color}"></i>${esc(s.label)} · ${esc(brl(tot))}</span>`;
        })
        .join("");
    }
  }

  function bindDespesasGraficos() {
    if (despesasGrafBound) return;
    despesasGrafBound = true;
    const box = document.getElementById("finFiltrosDespGraf");
    box?.addEventListener("change", () => renderDespesasGraficos());
    box?.addEventListener("input", () => renderDespesasGraficos());
    document.getElementById("finDespGrafAplicar")?.addEventListener("click", () => renderDespesasGraficos());
  }

  function locacaoEstaAtiva(loc) {
    if (typeof window.__DK_isPortalLocacaoAtiva === "function") {
      return Boolean(window.__DK_isPortalLocacaoAtiva(loc));
    }
    return !String(loc?.fim || loc?.dataFim || "").trim();
  }

  function valorSemanalContrato(loc) {
    const locacao = parseValor(loc?.valorLocacao);
    const inv = parseValor(loc?.valorInvestimento);
    const sem = parseValor(loc?.valorSemanal || loc?.valorParcela);
    if (locacao + inv > 0) return locacao + inv;
    return sem > 0 ? sem : locacao;
  }

  function parseLocCampoData(loc, keys) {
    for (const k of keys) {
      const d = parseBrDate(loc?.[k]);
      if (d) return d;
    }
    const ms = Number(loc?.createdAt || loc?.id || 0);
    if (Number.isFinite(ms) && ms > 100000) {
      const d = new Date(ms);
      if (!Number.isNaN(d.getTime())) return d;
    }
    return null;
  }

  function locInicio(loc) {
    return parseLocCampoData(loc, ["inicio", "dataInicio", "inicioContrato", "data"]);
  }

  function locFim(loc) {
    return parseBrDate(loc?.fim) || parseBrDate(loc?.dataFim) || parseBrDate(loc?.dataTermino) || null;
  }

  function locAtivaNoDia(loc, day) {
    const ini = locInicio(loc);
    const fim = locFim(loc);
    if (ini && day < ini) return false;
    if (fim && day > fim) return false;
    if (!ini && fim && day > fim) return false;
    if (!ini && !fim) return locacaoEstaAtiva(loc);
    return true;
  }

  function addMonths(d, n) {
    return new Date(d.getFullYear(), d.getMonth() + n, 1);
  }

  function lastDayOfMonth(y, m) {
    return new Date(y, m + 1, 0);
  }

  function prevGranularidade() {
    return String(document.querySelector('input[name="finPrevGran"]:checked')?.value || "diaria");
  }

  function buildPrevBuckets(kind, future) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (kind === "diaria") {
      return Array.from({ length: 30 }, (_, i) => {
        const d = addDays(today, future ? i : -(i + 1));
        return { start: d, end: d, label: fmtBrDate(d).slice(0, 5), days: 1, mid: d };
      }).sort((a, b) => a.start - b.start);
    }
    if (kind === "semanal") {
      return Array.from({ length: 12 }, (_, i) => {
        const start = addDays(today, (future ? i : -(i + 1)) * 7);
        const end = addDays(start, 6);
        return { start, end, label: fmtBrDate(start).slice(0, 5), days: 7, mid: addDays(start, 3) };
      }).sort((a, b) => a.start - b.start);
    }
    if (kind === "mensal") {
      const base = new Date(today.getFullYear(), today.getMonth(), 1);
      return Array.from({ length: 12 }, (_, i) => {
        const start = addMonths(base, future ? i : -(i + 1));
        const end = lastDayOfMonth(start.getFullYear(), start.getMonth());
        return {
          start,
          end,
          label: `${String(start.getMonth() + 1).padStart(2, "0")}/${start.getFullYear()}`,
          days: end.getDate(),
          mid: new Date(start.getFullYear(), start.getMonth(), 15),
        };
      }).sort((a, b) => a.start - b.start);
    }
    if (kind === "trimestral") {
      const q0 = Math.floor(today.getMonth() / 3);
      return Array.from({ length: 8 }, (_, i) => {
        const qAbs = future ? q0 + i : q0 - (i + 1);
        const y = today.getFullYear() + Math.floor(qAbs / 4);
        const q = ((qAbs % 4) + 4) % 4;
        const start = new Date(y, q * 3, 1);
        const end = lastDayOfMonth(y, q * 3 + 2);
        const days = Math.round((end - start) / 86400000) + 1;
        return { start, end, label: `T${q + 1}/${y}`, days, mid: new Date(y, q * 3 + 1, 15) };
      }).sort((a, b) => a.start - b.start);
    }
    const y0 = today.getFullYear();
    return Array.from({ length: 5 }, (_, i) => {
      const y = future ? y0 + i : y0 - (i + 1);
      const start = new Date(y, 0, 1);
      const end = new Date(y, 11, 31);
      const days = (y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0)) ? 366 : 365;
      return { start, end, label: String(y), days, mid: new Date(y, 6, 1) };
    }).sort((a, b) => a.start - b.start);
  }

  function contratosComModelo() {
    const vmap = mapaVeiculosPorPlaca();
    return locacoesCadastro().map((loc) => {
      const placa = nkPlate(loc?.placa);
      const veiculo = placa ? vmap.get(placa) : null;
      return {
        loc,
        placa,
        veiculo,
        plano: planoDeLocacao(loc, veiculo),
        modelo: modeloDeVeiculo(veiculo, loc),
        semanal: valorSemanalContrato(loc),
      };
    });
  }

  function syncPrevModeloSelect() {
    const sel = document.getElementById("finPrevModeloSelect");
    if (!sel) return;
    const prev = new Set(Array.from(sel.selectedOptions).map((o) => o.value));
    const had = sel.options.length > 0;
    const modelos = [...new Set(contratosComModelo().map((c) => c.modelo))].sort((a, b) => a.localeCompare(b, "pt-BR"));
    sel.innerHTML = modelos.map((m) => `<option value="${esc(m)}">${esc(m)}</option>`).join("");
    Array.from(sel.options).forEach((o) => {
      o.selected = had ? prev.has(o.value) : true;
    });
  }

  function filtrarContratosPrevisao(rows) {
    const planos = [];
    if (document.getElementById("finPrevPlanoMinhaMoto")?.checked) planos.push("minha-moto");
    if (document.getElementById("finPrevPlanoMeuTransporte")?.checked) planos.push("meu-transporte");
    if (document.getElementById("finPrevPlanoCarro")?.checked) planos.push("carro");
    const sel = document.getElementById("finPrevModeloSelect");
    const modelos = new Set(Array.from(sel?.selectedOptions || []).map((o) => o.value));
    const allModelos = !modelos.size;
    return rows.filter((c) => {
      if (planos.length && !planos.includes(c.plano)) return false;
      if (!allModelos && !modelos.has(c.modelo)) return false;
      return true;
    });
  }

  function receitaContratosNoBucket(contratos, bucket) {
    let tot = 0;
    contratos.forEach((c) => {
      if (!(c.semanal > 0)) return;
      const daily = c.semanal / 7;
      let n = 0;
      for (let d = new Date(bucket.start.getTime()); d <= bucket.end; d = addDays(d, 1)) {
        if (locAtivaNoDia(c.loc, d)) n += 1;
      }
      tot += daily * n;
    });
    return tot;
  }

  function receitaRealNoBucket(pags, bucket) {
    return pags
      .filter((p) => p.dt >= bucket.start && p.dt <= bucket.end)
      .reduce((s, p) => s + p.valor, 0);
  }

  function renderPrevisaoReceita() {
    syncPrevModeloSelect();
    const kind = prevGranularidade();
    const future = buildPrevBuckets(kind, true);
    const past = buildPrevBuckets(kind, false);
    const rows = filtrarContratosPrevisao(contratosComModelo());
    const ativosAgora = rows.filter((c) => locacaoEstaAtiva(c.loc));
    const planosSel = [];
    if (document.getElementById("finPrevPlanoMinhaMoto")?.checked) planosSel.push("minha-moto");
    if (document.getElementById("finPrevPlanoMeuTransporte")?.checked) planosSel.push("meu-transporte");
    if (document.getElementById("finPrevPlanoCarro")?.checked) planosSel.push("carro");
    const modelosSel = new Set(
      Array.from(document.getElementById("finPrevModeloSelect")?.selectedOptions || []).map((o) => o.value)
    );
    const pags = coletarPagamentos().filter((p) => {
      if (planosSel.length && !planosSel.includes(p.plano)) return false;
      if (modelosSel.size && !modelosSel.has(p.modelo)) return false;
      return true;
    });

    const line01 = future.map((b) => receitaContratosNoBucket(ativosAgora, b));
    const pastReal = past.map((b) => receitaRealNoBucket(pags, b));
    const mediaReal = pastReal.length ? pastReal.reduce((a, b) => a + b, 0) / pastReal.length : 0;
    const line02 = future.map(() => mediaReal);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const countNow = ativosAgora.length;
    const lookStart = past[0]?.start || addDays(today, -30);
    const countThen = rows.filter((c) => locAtivaNoDia(c.loc, lookStart)).length;
    const daysLook = Math.max(1, daysBetween(lookStart, today));
    let rDay = 0;
    if (countThen > 0 && countNow > 0 && daysLook > 0) {
      rDay = Math.pow(countNow / countThen, 1 / daysLook) - 1;
    }
    const runRateDia = ativosAgora.reduce((s, c) => s + (c.semanal > 0 ? c.semanal / 7 : 0), 0);
    const line03 = future.map((b) => {
      const daysAhead = Math.max(0, daysBetween(today, b.mid));
      const fator = Math.pow(1 + rDay, daysAhead);
      return runRateDia * b.days * fator;
    });

    const series = [
      { id: "contratos", label: "01 — Contratos ativos", color: "#5eb8ff", values: line01 },
      { id: "real", label: "02 — Receita real", color: "#6ee7a0", values: line02 },
      { id: "variacao", label: "03 — Variação de quantitativo", color: "#f5d76e", values: line03 },
    ];
    const days = future.map((b) => b.start);
    const labels = future.map((b) => b.label);
    const chart = document.getElementById("finPrevChart");
    if (chart) chart.innerHTML = svgLineChart(days, series, labels);
    const leg = document.getElementById("finPrevLegenda");
    if (leg) {
      leg.innerHTML = series
        .map((s) => {
          const tot = s.values.reduce((a, b) => a + b, 0);
          return `<span class="fin-legenda__item"><i style="background:${s.color}"></i>${esc(s.label)} · ${esc(brl(tot))}</span>`;
        })
        .join("");
    }
    const kpis = document.getElementById("finPrevKpis");
    if (kpis) {
      const varPct = countThen > 0 ? ((countNow / countThen - 1) * 100).toFixed(1) : "—";
      kpis.innerHTML = `<div class="fin-kpi"><span class="fin-kpi__lab">Contratos ativos</span><strong>${countNow}</strong></div>
        <div class="fin-kpi"><span class="fin-kpi__lab">Run-rate semanal</span><strong>${esc(brl(runRateDia * 7))}</strong></div>
        <div class="fin-kpi"><span class="fin-kpi__lab">Variação do quantitativo</span><strong>${varPct === "—" ? "—" : varPct + "%"}</strong></div>
        <div class="fin-kpi"><span class="fin-kpi__lab">Média real / período</span><strong>${esc(brl(mediaReal))}</strong></div>`;
    }
    const tab = document.getElementById("finPrevTabela");
    if (tab) {
      const head = `<th>Período</th>${series.map((s) => `<th>${esc(s.label)}</th>`).join("")}`;
      const body = future
        .map(
          (b, i) =>
            `<tr><td>${esc(b.label)}</td>${series.map((s) => `<td>${esc(brl(s.values[i] || 0))}</td>`).join("")}</tr>`
        )
        .join("");
      tab.innerHTML = `<table class="fin-table"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
    }
  }

  const ANALISE_INICIO = new Date(2026, 8, 1);
  const ANALISE_HORIZONTE = new Date(2031, 8, 1);
  const ANALISE_DESVIO = 0.35;

  function startOfDay(d) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  function monthKey(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }

  function somaPorDia(items, getDt, getVal) {
    const map = new Map();
    (items || []).forEach((it) => {
      const dt = getDt(it);
      if (!dt) return;
      const k = ymd(dt);
      map.set(k, (map.get(k) || 0) + (Number(getVal(it)) || 0));
    });
    return map;
  }

  function mediaDiariaReceitaPraticada() {
    const ativos = contratosComModelo().filter((c) => locacaoEstaAtiva(c.loc));
    const run = ativos.reduce((s, c) => s + (c.semanal > 0 ? c.semanal / 7 : 0), 0);
    const pags = coletarPagamentos();
    const today = startOfDay(new Date());
    const de = addDays(today, -89);
    const soma = pags.filter((p) => p.dt >= de && p.dt <= today).reduce((s, p) => s + p.valor, 0);
    const obs = soma / 90;
    return run > 0 ? run : obs;
  }

  function mediaDiariaDespesaPraticada() {
    const list = loadDespesas();
    const dates = list.map(parseDespesaData).filter(Boolean).sort((a, b) => a - b);
    if (!dates.length) return 0;
    const de = dates[0];
    const ate = dates[dates.length - 1] < ANALISE_INICIO ? dates[dates.length - 1] : addDays(ANALISE_INICIO, -1);
    if (!ate || ate < de) {
      const tot = list.reduce((s, d) => s + (Number(d.valor) || 0), 0);
      const n = Math.max(1, daysBetween(dates[0], dates[dates.length - 1]) + 1);
      return tot / n;
    }
    const tot = list.reduce((s, d) => {
      const dt = parseDespesaData(d);
      if (!dt || dt < de || dt > ate) return s;
      return s + (Number(d.valor) || 0);
    }, 0);
    return tot / Math.max(1, daysBetween(de, ate) + 1);
  }

  function alertasDespesaForaDaMedia() {
    const list = loadDespesas();
    const today = startOfDay(new Date());
    const byCatMonth = {};
    DESPESA_CATS.forEach((c) => {
      byCatMonth[c.id] = {};
    });
    list.forEach((d) => {
      const dt = parseDespesaData(d);
      if (!dt) return;
      const cat = d.categoria || "ADM";
      if (!byCatMonth[cat]) byCatMonth[cat] = {};
      const k = monthKey(dt);
      byCatMonth[cat][k] = (byCatMonth[cat][k] || 0) + (Number(d.valor) || 0);
    });
    const inicioKey = monthKey(ANALISE_INICIO);
    const atualKey = monthKey(today);
    const out = [];
    DESPESA_CATS.forEach((c) => {
      const months = byCatMonth[c.id] || {};
      const keys = Object.keys(months).sort();
      const pool =
        today >= ANALISE_INICIO
          ? keys.filter((k) => k < inicioKey)
          : keys.filter((k) => k < atualKey);
      const base = pool.length >= 2 ? pool : keys.filter((k) => k !== atualKey);
      if (!base.length) return;
      const vals = base.map((k) => months[k] || 0);
      const media = vals.reduce((a, b) => a + b, 0) / vals.length;
      if (!(media > 0)) return;
      let atual = 0;
      let janela = "mês corrente";
      if (today >= ANALISE_INICIO) {
        const days = Math.max(1, daysBetween(ANALISE_INICIO, today) + 1);
        const soma = list
          .filter((d) => {
            const dt = parseDespesaData(d);
            return dt && d.categoria === c.id && dt >= ANALISE_INICIO && dt <= today;
          })
          .reduce((s, d) => s + (Number(d.valor) || 0), 0);
        atual = (soma / days) * 30.44;
        janela = `desde ${fmtBrDate(ANALISE_INICIO)} (base mensal)`;
      } else {
        atual = months[atualKey] || 0;
        if (!atual && keys.length) atual = months[keys[keys.length - 1]] || 0;
      }
      const lim = media * ANALISE_DESVIO;
      if (atual > media + lim) {
        const pct = ((atual / media - 1) * 100).toFixed(0);
        out.push({
          cat: c,
          tipo: "alta",
          texto: `${c.label} está ${pct}% acima da média praticada (${brl(atual)} vs ${brl(media)} / mês). Janela: ${janela}.`,
        });
      } else if (atual < media - lim && atual < media * 0.65) {
        const pct = ((1 - atual / media) * 100).toFixed(0);
        out.push({
          cat: c,
          tipo: "baixa",
          texto: `${c.label} está ${pct}% abaixo da média praticada (${brl(atual)} vs ${brl(media)} / mês). Janela: ${janela}.`,
        });
      }
    });
    return out;
  }

  function renderAnaliseInteligente() {
    const today = startOfDay(new Date());
    const recMap = somaPorDia(coletarPagamentos(), (p) => p.dt, (p) => p.valor);
    const despMap = somaPorDia(loadDespesas(), parseDespesaData, (d) => d.valor);
    const recDia = mediaDiariaReceitaPraticada();
    const despDia = mediaDiariaDespesaPraticada();
    const days = eachDay(ANALISE_INICIO, ANALISE_HORIZONTE);
    let accR = 0;
    let accD = 0;
    const recVals = [];
    const despVals = [];
    const salVals = [];
    let forecastFrom = 0;
    let cruzouNeg = null;
    days.forEach((d, i) => {
      const k = ymd(d);
      const real = d <= today;
      if (real && i > forecastFrom) forecastFrom = i;
      const r = real ? recMap.get(k) || 0 : recDia;
      const e = real ? despMap.get(k) || 0 : despDia;
      accR += r;
      accD += e;
      recVals.push(accR);
      despVals.push(accD);
      salVals.push(accR - accD);
      if (cruzouNeg == null && accR - accD < 0) cruzouNeg = d;
    });
    if (today < ANALISE_INICIO) forecastFrom = 0;
    const series = [
      { id: "rec", label: "Receita acumulada", color: "#6ee7a0", values: recVals, forecastFrom },
      { id: "desp", label: "Despesa acumulada", color: "#ff6b6b", values: despVals, forecastFrom },
      { id: "sal", label: "Resultado acumulado", color: "#5eb8ff", values: salVals, forecastFrom },
    ];
    const axisLabs = days.map((d, i) => {
      const step = Math.ceil(days.length / 8);
      if (i % step !== 0 && i !== days.length - 1) return "";
      return `${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
    });
    const chart = document.getElementById("finAnaliseChart");
    if (chart) chart.innerHTML = svgLineChart(days, series, axisLabs);
    const leg = document.getElementById("finAnaliseLegenda");
    if (leg) {
      const last = recVals.length - 1;
      leg.innerHTML = series
        .map((s) => `<span class="fin-legenda__item"><i style="background:${s.color}"></i>${esc(s.label)} · ${esc(brl(s.values[last] || 0))}</span>`)
        .join("");
    }
    const saldo5 = salVals[salVals.length - 1] || 0;
    const viavel = saldo5 >= 0 && recDia >= despDia;
    const kpis = document.getElementById("finAnaliseKpis");
    if (kpis) {
      kpis.innerHTML = `<div class="fin-kpi"><span class="fin-kpi__lab">Início do acompanhamento</span><strong>01/09/2026</strong></div>
        <div class="fin-kpi"><span class="fin-kpi__lab">Receita média / dia</span><strong>${esc(brl(recDia))}</strong></div>
        <div class="fin-kpi"><span class="fin-kpi__lab">Despesa média / dia</span><strong>${esc(brl(despDia))}</strong></div>
        <div class="fin-kpi"><span class="fin-kpi__lab">Resultado em 5 anos</span><strong>${esc(brl(saldo5))}</strong></div>
        <div class="fin-kpi"><span class="fin-kpi__lab">Viabilidade</span><strong>${viavel ? "Viável" : "Em risco"}</strong></div>`;
    }
    const nota = document.getElementById("finAnaliseNota");
    if (nota) {
      const parts = [];
      if (today < ANALISE_INICIO) {
        parts.push("O acompanhamento oficial começa em 01/09/2026. Até lá a linha contínua ainda não tem realizado; o tracejado projeta os 5 anos com a média praticada (contratos ativos e histórico de despesas).");
      } else {
        parts.push("Linha contínua = acumulado real desde 01/09/2026. Tracejado = projeção até 01/09/2031 com a média praticada.");
      }
      if (cruzouNeg && cruzouNeg > today) {
        parts.push(`No ritmo actual o resultado acumulado fica negativo em ${fmtBrDate(cruzouNeg)}.`);
      } else if (cruzouNeg && cruzouNeg <= today) {
        parts.push(`O resultado acumulado já está negativo desde ${fmtBrDate(cruzouNeg)}.`);
      }
      nota.textContent = parts.join(" ");
    }
    const box = document.getElementById("finAnaliseAlertas");
    if (box) {
      const alertas = alertasDespesaForaDaMedia();
      if (!alertas.length) {
        box.innerHTML = `<p class="fin-analise-alerta fin-analise-alerta--ok">Nenhuma categoria se distanciou da média praticada${today < ANALISE_INICIO ? " no histórico recente" : " desde 01/09/2026"}.</p>`;
      } else {
        box.innerHTML = alertas
          .map(
            (a) =>
              `<p class="fin-analise-alerta ${a.tipo === "alta" ? "fin-analise-alerta--alta" : "fin-analise-alerta--baixa"}">${esc(a.texto)}</p>`
          )
          .join("");
      }
    }
  }

  function clientesCadastro() {
    const key = typeof window.CAD_CLIENTES_KEY === "string" ? window.CAD_CLIENTES_KEY : "dk_clientes_cadastro";
    return loadArr(key);
  }

  function clientePorCpf(cpfDigits) {
    const dig = String(cpfDigits || "").replace(/\D/g, "").slice(0, 11);
    if (dig.length !== 11) return null;
    if (typeof window.findClienteByCpfCadastro === "function") {
      return window.findClienteByCpfCadastro(dig) || null;
    }
    return (
      clientesCadastro().find((c) => String(c?.cpf || "").replace(/\D/g, "").slice(0, 11) === dig) || null
    );
  }

  function telefoneDoCliente(cli, loc) {
    const raw = String(
      cli?.celular ||
        cli?.telefone ||
        cli?.fone ||
        cli?.telefoneCelular ||
        loc?.celular ||
        loc?.telefone ||
        ""
    ).trim();
    if (!raw) return "—";
    if (typeof window.formatPhoneBR === "function") {
      const d = String(raw).replace(/\D/g, "");
      return d ? window.formatPhoneBR(d) || raw : raw;
    }
    return raw;
  }

  function valorLocacaoNum(loc) {
    const locacao = parseValor(loc?.valorLocacao);
    if (locacao > 0) return locacao;
    const sem = parseValor(loc?.valorSemanal || loc?.valorParcela);
    const inv = parseValor(loc?.valorInvestimento);
    if (sem > 0 && sem >= inv) return Math.max(0, sem - inv);
    return 0;
  }

  function diasContratoAteHoje(loc) {
    const inicio = locInicio(loc);
    if (!inicio) return 0;
    const now = new Date();
    let end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const fim = parseLocCampoData(loc, ["fim", "dataFim", "termino"]);
    if (fim && fim.getTime() < end.getTime()) end = fim;
    if (end.getTime() < inicio.getTime()) return 0;
    return Math.max(0, daysBetween(inicio, end));
  }

  function valorDevidoAteHojeNum(loc) {
    if (typeof window.__DK_computePortalProtocoloResumoFromLoc === "function") {
      const r = window.__DK_computePortalProtocoloResumoFromLoc(loc);
      const n = parseValor(r?.valorDevidoAteHoje);
      if (Number.isFinite(n) && n >= 0) return n;
    }
    const semanal = valorSemanalContrato(loc);
    return diasContratoAteHoje(loc) * (semanal / 7);
  }

  function valorPagoLocNum(loc) {
    return lancsDaLoc(loc).reduce((s, x) => s + (Number(x?.valor) || 0), 0);
  }

  function valorInvestimentoNum(loc) {
    return Math.max(0, parseValor(loc?.valorInvestimento));
  }

  /** Reparte o total pago na proporção semanal locação × investimento. */
  function rateioPagoAluguelInvestimento(loc, pagoTotal) {
    const pago = Math.max(0, Number(pagoTotal) || 0);
    const alug = valorLocacaoNum(loc);
    const inv = valorInvestimentoNum(loc);
    const base = alug + inv;
    if (pago <= 0) return { aluguelPago: 0, investimentoPago: 0 };
    if (base <= 0) return { aluguelPago: pago, investimentoPago: 0 };
    const aluguelPago = pago * (alug / base);
    const investimentoPago = pago * (inv / base);
    return { aluguelPago, investimentoPago };
  }

  function fmtBrlAssinado(n) {
    const v = Number(n) || 0;
    if (v < 0) return `−${brl(Math.abs(v))}`;
    return brl(v);
  }

  function celulaValorAssinado(n) {
    const v = Number(n) || 0;
    if (v < 0) {
      return `<td class="fin-rel-val fin-rel-val--neg">−${esc(brl(Math.abs(v)))}</td>`;
    }
    return `<td class="fin-rel-val">${esc(brl(v))}</td>`;
  }

  function coletarRelacaoPagamentoPorCliente() {
    const vmap = mapaVeiculosPorPlaca();
    const rows = [];
    locacoesCadastro().forEach((loc) => {
      const proto = String(loc?.numeroContrato || "").trim();
      if (!proto && !String(loc?.cpf || "").trim()) return;
      const ativo = locacaoEstaAtiva(loc);
      const cpf = String(loc?.cpf || "").replace(/\D/g, "").slice(0, 11);
      const cli = clientePorCpf(cpf);
      const placa = nkPlate(loc?.placa);
      const veiculo = placa ? vmap.get(placa) : null;
      const plano = planoDeLocacao(loc, veiculo);
      const nome = String(cli?.nome || loc?.nomeCliente || loc?.cliente || "").trim() || "—";
      const telefone = telefoneDoCliente(cli, loc);
      const valorLocacao = valorLocacaoNum(loc);
      const devido = valorDevidoAteHojeNum(loc);
      const pago = valorPagoLocNum(loc);
      const atraso = pago - devido;
      const rateio = rateioPagoAluguelInvestimento(loc, pago);
      rows.push({
        nome,
        telefone,
        cpf,
        protocolo: proto,
        placa,
        plano,
        ativo,
        valorLocacao,
        devido,
        pago,
        atraso,
        investimentoPago: rateio.investimentoPago,
        aluguelPago: rateio.aluguelPago,
      });
    });
    rows.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR") || String(a.protocolo).localeCompare(String(b.protocolo), "en"));
    return rows;
  }

  function filtrosRelacaoPagamento() {
    return {
      ativo: Boolean(document.getElementById("finRelStatusAtivo")?.checked),
      inativo: Boolean(document.getElementById("finRelStatusInativo")?.checked),
      planos: {
        "minha-moto": Boolean(document.getElementById("finRelPlanoMinhaMoto")?.checked),
        "meu-transporte": Boolean(document.getElementById("finRelPlanoMeuTransporte")?.checked),
        carro: Boolean(document.getElementById("finRelPlanoCarro")?.checked),
      },
      saldoNeg: Boolean(document.getElementById("finRelSaldoNegativo")?.checked),
      saldoPos: Boolean(document.getElementById("finRelSaldoPositivo")?.checked),
    };
  }

  function filtrarRelacaoPagamento(rows) {
    const f = filtrosRelacaoPagamento();
    return (rows || []).filter((r) => {
      if (r.ativo && !f.ativo) return false;
      if (!r.ativo && !f.inativo) return false;
      if (!f.planos[r.plano]) return false;
      const sal = Number(r.atraso) || 0;
      if (sal < 0 && !f.saldoNeg) return false;
      if (sal >= 0 && !f.saldoPos) return false;
      return true;
    });
  }

  const REL_COLS = [
    { key: "nome", label: "Nome do cliente", type: "text" },
    { key: "telefone", label: "Telefone do cliente", type: "text" },
    { key: "valorLocacao", label: "Valor da locação", type: "num" },
    { key: "devido", label: "Valor devido", type: "num" },
    { key: "pago", label: "Valor pago", type: "num" },
    { key: "atraso", label: "Valor em atraso", type: "num" },
    { key: "investimentoPago", label: "Total de investimento", type: "num" },
    { key: "aluguelPago", label: "Total de aluguel", type: "num" },
  ];
  /* Mesmas larguras no cabeçalho sticky e no corpo — evita deslocamento. */
  const REL_COL_WIDTHS = ["24%", "11%", "10%", "10%", "10%", "10%", "12%", "13%"];

  function buildRelacaoColgroupHtml() {
    return `<colgroup>${REL_COL_WIDTHS.map(
      (w, i) => `<col class="fin-rel-col fin-rel-col--${REL_COLS[i].key}" style="width:${w}">`
    ).join("")}</colgroup>`;
  }

  function buildRelacaoTableOpen(colgroupHtml, inner) {
    return `<table class="fin-table fin-table--relacao">${colgroupHtml}${inner}</table>`;
  }

  let relacaoExcelState = {
    sortKey: "nome",
    sortDir: "asc",
    cols: {},
  };
  let relacaoExcelBoundDoc = false;
  let relacaoExcelOpenKey = "";

  function relCellDisplay(row, key) {
    const col = REL_COLS.find((c) => c.key === key);
    if (!col) return "";
    if (col.type === "num") return fmtBrlAssinado(row[key]);
    return String(row[key] ?? "—");
  }

  function relCellSortValue(row, key) {
    const col = REL_COLS.find((c) => c.key === key);
    if (col?.type === "num") return Number(row[key]) || 0;
    return nk(String(row[key] ?? ""));
  }

  function relColFilterActive(key) {
    return relacaoExcelState.cols[key] instanceof Set;
  }

  function aplicarExcelFiltroSort(rows) {
    let out = (rows || []).slice();
    REL_COLS.forEach((col) => {
      const set = relacaoExcelState.cols[col.key];
      if (!(set instanceof Set)) return;
      out = out.filter((r) => set.has(relCellDisplay(r, col.key)));
    });
    const sk = relacaoExcelState.sortKey || "nome";
    const dir = relacaoExcelState.sortDir === "desc" ? -1 : 1;
    out.sort((a, b) => {
      const va = relCellSortValue(a, sk);
      const vb = relCellSortValue(b, sk);
      if (typeof va === "number" && typeof vb === "number") {
        if (va !== vb) return (va - vb) * dir;
      } else {
        const cmp = String(va).localeCompare(String(vb), "pt-BR");
        if (cmp) return cmp * dir;
      }
      return String(a.protocolo || "").localeCompare(String(b.protocolo || ""), "en");
    });
    return out;
  }

  function valoresUnicosColuna(rows, key) {
    const map = new Map();
    (rows || []).forEach((r) => {
      const label = relCellDisplay(r, key);
      if (!map.has(label)) map.set(label, relCellSortValue(r, key));
    });
    return Array.from(map.entries())
      .sort((a, b) => {
        const col = REL_COLS.find((c) => c.key === key);
        if (col?.type === "num") return (Number(a[1]) || 0) - (Number(b[1]) || 0);
        return String(a[0]).localeCompare(String(b[0]), "pt-BR");
      })
      .map(([label]) => label);
  }

  function fecharExcelFiltroPopup() {
    relacaoExcelOpenKey = "";
    document.querySelectorAll(".fin-excel-filter-pop").forEach((el) => el.remove());
    document.querySelectorAll(".fin-excel-filter-btn.is-open").forEach((b) => b.classList.remove("is-open"));
  }

  function linhasBaseAntesDaColuna(openKey) {
    const all = filtrarRelacaoPagamento(coletarRelacaoPagamentoPorCliente());
    let out = all.slice();
    REL_COLS.forEach((col) => {
      if (col.key === openKey) return;
      const set = relacaoExcelState.cols[col.key];
      if (!(set instanceof Set)) return;
      out = out.filter((r) => set.has(relCellDisplay(r, col.key)));
    });
    return out;
  }

  function abrirExcelFiltroPopup(btn, key) {
    fecharExcelFiltroPopup();
    const col = REL_COLS.find((c) => c.key === key);
    if (!col || !btn) return;
    relacaoExcelOpenKey = key;
    btn.classList.add("is-open");
    const baseRows = linhasBaseAntesDaColuna(key);
    const uniques = valoresUnicosColuna(baseRows, key);
    const selected = relacaoExcelState.cols[key];
    const isAll = !(selected instanceof Set);
    const pop = document.createElement("div");
    pop.className = "fin-excel-filter-pop";
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
        ${uniques
          .map((v, i) => {
            const checked = isAll || selected.has(v) ? "checked" : "";
            return `<label class="fin-excel-filter-pop__item"><input type="checkbox" data-excel-idx="${i}" ${checked}> <span>${esc(v)}</span></label>`;
          })
          .join("") || `<p class="subtext">Sem valores.</p>`}
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

    const search = pop.querySelector("[data-excel-search]");
    const allCb = pop.querySelector("[data-excel-all]");
    const syncAll = () => {
      const boxes = Array.from(pop.querySelectorAll("[data-excel-idx]"));
      const visible = boxes.filter((el) => el.closest(".fin-excel-filter-pop__item")?.style.display !== "none");
      allCb.checked = visible.length > 0 && visible.every((el) => el.checked);
    };
    search?.addEventListener("input", () => {
      const q = nk(search.value);
      pop.querySelectorAll(".fin-excel-filter-pop__item").forEach((lab) => {
        const t = nk(lab.textContent || "");
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
      relacaoExcelState.sortKey = key;
      relacaoExcelState.sortDir = "asc";
      fecharExcelFiltroPopup();
      renderRelacaoPagamento();
    });
    pop.querySelector("[data-excel-sort='desc']")?.addEventListener("click", () => {
      relacaoExcelState.sortKey = key;
      relacaoExcelState.sortDir = "desc";
      fecharExcelFiltroPopup();
      renderRelacaoPagamento();
    });
    pop.querySelector("[data-excel-ok]")?.addEventListener("click", () => {
      const boxes = Array.from(pop.querySelectorAll("[data-excel-idx]"));
      const visible = boxes.filter((el) => el.closest(".fin-excel-filter-pop__item")?.style.display !== "none");
      const pool = visible.length ? visible : boxes;
      const checked = pool
        .filter((el) => el.checked)
        .map((el) => uniques[Number(el.getAttribute("data-excel-idx"))])
        .filter((v) => v != null);
      if (!checked.length || checked.length === pool.length) {
        delete relacaoExcelState.cols[key];
      } else {
        relacaoExcelState.cols[key] = new Set(checked);
      }
      fecharExcelFiltroPopup();
      renderRelacaoPagamento();
    });
    pop.querySelector("[data-excel-cancel]")?.addEventListener("click", () => fecharExcelFiltroPopup());
    pop.querySelector("[data-excel-clear]")?.addEventListener("click", () => {
      delete relacaoExcelState.cols[key];
      if (relacaoExcelState.sortKey === key) {
        relacaoExcelState.sortKey = "nome";
        relacaoExcelState.sortDir = "asc";
      }
      fecharExcelFiltroPopup();
      renderRelacaoPagamento();
    });
    search?.focus();
  }

  function syncRelacaoStickyHeadHeight() {
    /* Cabeçalho de colunas vive no sticky-head; não precisa offset de thead. */
  }

  let relacaoScrollSyncBound = false;
  function syncRelacaoColScroll(fromBody) {
    const colHead = document.getElementById("finRelacaoPagamentoColHead");
    const body = document.getElementById("finRelacaoPagamentoTabela");
    if (!colHead || !body || colHead.hidden) return;
    if (fromBody !== false) colHead.scrollLeft = body.scrollLeft;
    else body.scrollLeft = colHead.scrollLeft;
  }

  function bindRelacaoColScrollSync() {
    if (relacaoScrollSyncBound) return;
    relacaoScrollSyncBound = true;
    const colHead = document.getElementById("finRelacaoPagamentoColHead");
    const body = document.getElementById("finRelacaoPagamentoTabela");
    colHead?.addEventListener("scroll", () => syncRelacaoColScroll(false), { passive: true });
    body?.addEventListener("scroll", () => syncRelacaoColScroll(true), { passive: true });
  }

  function buildRelacaoHeadHtml() {
    return REL_COLS.map((col) => {
      const active = relColFilterActive(col.key) || relacaoExcelState.sortKey === col.key;
      return `<th class="fin-excel-th${active ? " fin-excel-th--active" : ""}" scope="col">
        <span class="fin-excel-th__label">${esc(col.label)}</span>
        <button type="button" class="fin-excel-filter-btn${relColFilterActive(col.key) ? " is-filtered" : ""}" data-excel-col="${esc(col.key)}" title="Filtro estilo Excel" aria-label="Filtro de ${esc(col.label)}">▾</button>
      </th>`;
    }).join("");
  }

  function renderRelacaoColHead(headHtml, visible) {
    const colHead = document.getElementById("finRelacaoPagamentoColHead");
    if (!colHead) return;
    if (!visible) {
      colHead.hidden = true;
      colHead.innerHTML = "";
      return;
    }
    colHead.hidden = false;
    colHead.innerHTML = buildRelacaoTableOpen(
      buildRelacaoColgroupHtml(),
      `<thead><tr>${headHtml}</tr></thead>`
    );
  }

  function renderRelacaoPagamento() {
    fecharExcelFiltroPopup();
    const all = coletarRelacaoPagamentoPorCliente();
    const base = filtrarRelacaoPagamento(all);
    const rows = aplicarExcelFiltroSort(base);
    const kpis = document.getElementById("finRelacaoPagamentoKpis");
    if (kpis) {
      const totDev = rows.reduce((s, r) => s + r.devido, 0);
      const totPago = rows.reduce((s, r) => s + r.pago, 0);
      const totAtraso = rows.reduce((s, r) => s + r.atraso, 0);
      const atrasados = rows.filter((r) => r.pago < r.devido).length;
      kpis.innerHTML = `<div class="fin-kpi"><span class="fin-kpi__lab">Contratos filtrados</span><strong>${rows.length}</strong></div>
        <div class="fin-kpi"><span class="fin-kpi__lab">Total devido</span><strong>${esc(brl(totDev))}</strong></div>
        <div class="fin-kpi"><span class="fin-kpi__lab">Total pago</span><strong>${esc(brl(totPago))}</strong></div>
        <div class="fin-kpi"><span class="fin-kpi__lab">Saldo (pago − devido)</span><strong class="${totAtraso < 0 ? "fin-rel-val--neg" : ""}">${esc(fmtBrlAssinado(totAtraso))}</strong></div>
        <div class="fin-kpi"><span class="fin-kpi__lab">Com atraso (pago &lt; devido)</span><strong>${atrasados}</strong></div>`;
    }
    const tab = document.getElementById("finRelacaoPagamentoTabela");
    if (!tab) return;
    if (!base.length) {
      renderRelacaoColHead("", false);
      tab.innerHTML = `<p class="subtext">Nenhum contrato no filtro selecionado.</p>`;
      return;
    }
    const head = buildRelacaoHeadHtml();
    renderRelacaoColHead(head, true);
    const colgroup = buildRelacaoColgroupHtml();
    if (!rows.length) {
      tab.innerHTML = buildRelacaoTableOpen(
        colgroup,
        `<tbody><tr><td colspan="${REL_COLS.length}" class="subtext">Nenhum valor corresponde ao filtro das colunas.</td></tr></tbody>`
      );
      syncRelacaoColScroll(true);
      return;
    }
    tab.innerHTML = buildRelacaoTableOpen(
      colgroup,
      `<tbody>${rows
      .map((r) => {
        const atrasado = r.pago < r.devido;
        const planoCls = `fin-rel-row--${r.plano || "minha-moto"}`;
        const nomeCls = atrasado ? "fin-rel-nome fin-rel-nome--atraso" : "fin-rel-nome";
        const meta = [r.protocolo, r.placa].filter(Boolean).join(" · ");
        return `<tr class="${planoCls}">
        <td><span class="${nomeCls}">${esc(r.nome)}</span>${meta ? `<br><span class="subtext">${esc(meta)}</span>` : ""}</td>
        <td>${esc(r.telefone)}</td>
        ${celulaValorAssinado(r.valorLocacao)}
        ${celulaValorAssinado(r.devido)}
        ${celulaValorAssinado(r.pago)}
        ${celulaValorAssinado(r.atraso)}
        ${celulaValorAssinado(r.investimentoPago)}
        ${celulaValorAssinado(r.aluguelPago)}
      </tr>`;
      })
      .join("")}</tbody>`
    );
    syncRelacaoColScroll(true);
  }

  let relacaoPagamentoBound = false;
  let relacaoStickyResizeBound = false;
  function bindRelacaoPagamento() {
    if (relacaoPagamentoBound) return;
    relacaoPagamentoBound = true;
    const box = document.getElementById("finFiltrosRelacaoPagamento");
    box?.addEventListener("change", () => {
      relacaoExcelState.cols = {};
      renderRelacaoPagamento();
    });
    document.getElementById("finRelacaoPagamentoAplicar")?.addEventListener("click", () => renderRelacaoPagamento());
    const pane = document.getElementById("financeiroPaneRelacaoPagamento");
    pane?.addEventListener("click", (e) => {
      const btn = e.target?.closest?.("[data-excel-col]");
      if (!btn || !pane.contains(btn)) return;
      e.preventDefault();
      e.stopPropagation();
      const key = btn.getAttribute("data-excel-col") || "";
      if (relacaoExcelOpenKey === key) {
        fecharExcelFiltroPopup();
        return;
      }
      abrirExcelFiltroPopup(btn, key);
    });
    if (!relacaoExcelBoundDoc) {
      relacaoExcelBoundDoc = true;
      document.addEventListener("mousedown", (e) => {
        if (!relacaoExcelOpenKey) return;
        const pop = document.querySelector(".fin-excel-filter-pop");
        const t = e.target;
        if (pop?.contains(t)) return;
        if (t?.closest?.("[data-excel-col]")) return;
        fecharExcelFiltroPopup();
      });
      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && relacaoExcelOpenKey) fecharExcelFiltroPopup();
      });
    }
    if (!relacaoStickyResizeBound) {
      relacaoStickyResizeBound = true;
      window.addEventListener("resize", () => requestAnimationFrame(() => syncRelacaoColScroll(true)));
    }
    bindRelacaoColScrollSync();
  }

  function renderModulo(id) {
    if (id === "relacao-pagamento") {
      bindRelacaoPagamento();
      renderRelacaoPagamento();
    } else if (id === "quantitativo") renderQuantitativo();
    else if (id === "receita-plano") renderReceitaPlano();
    else if (id === "receita-modelo") renderReceitaModelo();
    else if (id === "localizacao") renderLocalizacao();
    else if (id === "dia-semana") renderDiaSemana();
    else if (id === "intervalo") renderIntervalo();
    else if (id === "despesas") {
      bindDespesas();
      renderDespesas();
    } else if (id === "despesas-graf") {
      bindDespesasGraficos();
      renderDespesasGraficos();
    } else if (id === "analise") renderAnaliseInteligente();
    else if (id === "previsao") renderPrevisaoReceita();
  }

  const FIN_MOD_ATALLHO = {
    "0": "relacao-pagamento",
    "1": "quantitativo",
    "2": "receita-plano",
    "3": "receita-modelo",
    "4": "localizacao",
    "5": "dia-semana",
    "6": "intervalo",
    "7": "despesas",
    "8": "despesas-graf",
    "9": "analise",
  };

  function financeiroModulosVisivel() {
    const view = document.getElementById("view-financeiro");
    return Boolean(
      view?.classList.contains("view--active") &&
        panel &&
        !panel.classList.contains("hidden")
    );
  }

  function alvoTecladoEhCampoEditavel(el) {
    if (!el || !(el instanceof Element)) return false;
    const tag = String(el.tagName || "").toUpperCase();
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
    if (el.isContentEditable) return true;
    return Boolean(el.closest("input, textarea, select, [contenteditable='true']"));
  }

  function bindAtalhosTecladoModulos() {
    if (document.documentElement.dataset.dkFinModAtalhosBound === "1") return;
    document.documentElement.dataset.dkFinModAtalhosBound = "1";
    document.addEventListener("keydown", (e) => {
      if (!financeiroModulosVisivel()) return;
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      if (alvoTecladoEhCampoEditavel(e.target)) return;
      const key = e.key === "Digit0" || e.code === "Digit0" || e.key === "Numpad0" ? "0" : String(e.key || "");
      const modId = FIN_MOD_ATALLHO[key];
      if (!modId) return;
      e.preventDefault();
      abrirModulo(modId);
    });
  }

  function bindNav() {
    document.querySelectorAll("#financeiroModulosNav [data-fin-mod]").forEach((btn) => {
      btn.addEventListener("click", () => abrirModulo(btn.getAttribute("data-fin-mod") || ""));
    });
    bindAtalhosTecladoModulos();
    document.getElementById("finReceitaPlanoAplicar")?.addEventListener("click", () => renderReceitaPlano());
    document.getElementById("finReceitaModeloAplicar")?.addEventListener("click", () => renderReceitaModelo());
    document.getElementById("finLocalAplicar")?.addEventListener("click", () => renderLocalizacao());
    document.getElementById("finDiaAplicar")?.addEventListener("click", () => renderDiaSemana());
    document.getElementById("finPrevAplicar")?.addEventListener("click", () => renderPrevisaoReceita());
    document.getElementById("finDespGrafAplicar")?.addEventListener("click", () => renderDespesasGraficos());
    bindFinDateCalendariosInView();
  }

  bindNav();

  window.__DK_financeiroHideModulos = hideModulos;
  window.__DK_financeiroRenderQuantitativo = renderQuantitativo;
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
    const seed = seedDespesasById();
    const byId = new Map();
    for (const arr of [localArr, cloudArr]) {
      if (!Array.isArray(arr)) continue;
      for (const row of arr) {
        if (!row || typeof row !== "object") continue;
        const id = String(row.id || "");
        if (!id) continue;
        if (isObsoletePlanilhaDespesa(row, seed)) continue;
        const prev = byId.get(id);
        if (!prev || Number(row.updatedAt || 0) >= Number(prev.updatedAt || 0)) byId.set(id, row);
      }
    }
    return Array.from(byId.values()).filter((x) => !x.deleted);
  };
  const prevFinRefresh = window.__DK_financeiroRefreshFromStorage;
  window.__DK_financeiroRefreshFromStorage = () => {
    if (typeof prevFinRefresh === "function") prevFinRefresh();
    if (moduloAberto === "despesas") renderDespesas();
    if (moduloAberto === "despesas-graf") renderDespesasGraficos();
    if (moduloAberto === "analise") renderAnaliseInteligente();
  };
})();
