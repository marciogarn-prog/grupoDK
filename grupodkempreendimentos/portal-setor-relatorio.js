/**
 * Relatório de movimentação de placas entre os setores 1–10 da Manutenção.
 * Cada opção 1 a 10 tem o botão RELATÓRIO: quem enviou cada placa de um setor para outro.
 */
(function portalSetorRelatorio() {
  const STORAGE_KEY = "dk_portal_setor_movimentacoes_v1";
  const MAX_ROWS = 4000;
  const DEDUPE_MS = 4000;

  const SETORES = [
    { key: "minha-moto", label: "1 — Plano DK Minha Moto", grupo: "locados" },
    { key: "meu-transporte", label: "2 — Plano DK Meu Transporte", grupo: "locados" },
    { key: "carros", label: "3 — Plano Carro", grupo: "locados" },
    { key: "prontos", label: "4 — Pronto para alugar", grupo: "disponiveis" },
    { key: "reserva-operacao", label: "5.1 — Reserva em operação", grupo: "disponiveis" },
    { key: "reserva-patio", label: "5.2 — Reserva no pátio", grupo: "disponiveis" },
    { key: "veiculos-operacionais", label: "5.3 — Veículos operacionais", grupo: "disponiveis" },
    { key: "veiculos-vendidos", label: "5.4 — Veículos vendidos", grupo: "disponiveis" },
    { key: "triagem", label: "6 — Triagem", grupo: "manutencao" },
    { key: "oficina-propria", label: "7 — Oficina própria", grupo: "manutencao" },
    { key: "oficina-terceiros", label: "8 — Oficina de terceiro", grupo: "manutencao" },
    { key: "enviado-seguro", label: "9 — Seguro", grupo: "manutencao" },
    { key: "sinistrado-roubo", label: "10 — Sinistro Roubo", grupo: "manutencao" },
  ];

  const SETOR_BY_KEY = Object.fromEntries(SETORES.map((s) => [s.key, s]));

  const ALIAS = {
    "1": "minha-moto",
    "locados-minha-moto": "minha-moto",
    "2": "meu-transporte",
    "locados-meu-transporte": "meu-transporte",
    "3": "carros",
    "locados-carros": "carros",
    "4": "prontos",
    "4-prontos": "prontos",
    "5.1": "reserva-operacao",
    "5.1-reserva-operacao": "reserva-operacao",
    "5.2": "reserva-patio",
    "5.2-reserva-patio": "reserva-patio",
    "5.3": "veiculos-operacionais",
    "5.3-veiculos-operacionais": "veiculos-operacionais",
    "5.4": "veiculos-vendidos",
    "5.4-veiculos-vendidos": "veiculos-vendidos",
    vendas: "veiculos-vendidos",
    "6": "triagem",
    "6-triagem": "triagem",
    "7": "oficina-propria",
    "7-oficina-propria": "oficina-propria",
    "8": "oficina-terceiros",
    "8-oficina-terceiros": "oficina-terceiros",
    "9": "enviado-seguro",
    "9-enviado-seguro": "enviado-seguro",
    "10": "sinistrado-roubo",
    "10-sinistrado-roubo": "sinistrado-roubo",
    "disponiveis-reserva": "reserva-patio",
  };

  let setorFiltro = "";
  let placaFiltro = "";

  function nkPlate(raw) {
    return String(raw || "")
      .replace(/\s+/g, "")
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "");
  }

  function escHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function normalizeSetorKey(raw) {
    let s = String(raw || "")
      .trim()
      .toLowerCase();
    if (!s) return "";
    const plus = s.indexOf("+");
    if (plus > 0) s = s.slice(0, plus);
    if (SETOR_BY_KEY[s]) return s;
    if (ALIAS[s]) return ALIAS[s];
    if (s.startsWith("locados-")) {
      const rest = s.slice("locados-".length);
      return SETOR_BY_KEY[rest] ? rest : ALIAS[rest] || "";
    }
    return "";
  }

  function labelSetor(keyOrRaw) {
    const key = SETOR_BY_KEY[keyOrRaw] ? keyOrRaw : normalizeSetorKey(keyOrRaw);
    if (key && SETOR_BY_KEY[key]) return SETOR_BY_KEY[key].label;
    const raw = String(keyOrRaw || "").trim();
    if (!raw) return "—";
    if (raw === "locados") return "Locados (1, 2 ou 3)";
    if (raw === "manutencao") return "Em manutenção (6–10)";
    return raw;
  }

  function loadLista() {
    if (typeof loadCadastro === "function") {
      const arr = loadCadastro(STORAGE_KEY);
      return Array.isArray(arr) ? arr : [];
    }
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  }

  function saveLista(list) {
    const trimmed = list.length > MAX_ROWS ? list.slice(list.length - MAX_ROWS) : list;
    if (typeof saveCadastro === "function") {
      saveCadastro(STORAGE_KEY, trimmed, { bypassImmutabilidadeCadastro: true });
    } else {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
      } catch {
        /* ignore */
      }
    }
  }

  function getOperadorMovimentacao() {
    let cpf = "";
    let nome = "";
    if (typeof window.__DK_getPortalSessaoParaRegistroLancamento === "function") {
      try {
        const s = window.__DK_getPortalSessaoParaRegistroLancamento();
        if (s) {
          cpf = String(s.cpf || "").replace(/\D/g, "").slice(0, 11);
          nome = String(s.nome || "").trim();
        }
      } catch {
        /* ignore */
      }
    }
    if (!nome && typeof window.__DK_getPortalSessaoEquipaFuncionario === "function") {
      try {
        const f = window.__DK_getPortalSessaoEquipaFuncionario();
        if (f) {
          if (!cpf) cpf = String(f.cpf || "").replace(/\D/g, "").slice(0, 11);
          nome = String(f.nome || "").trim();
        }
      } catch {
        /* ignore */
      }
    }
    if (!cpf) {
      try {
        const raw = localStorage.getItem("dk_sessao_cliente");
        const s = raw ? JSON.parse(raw) : null;
        if (s?.tipo === "admin") {
          cpf = String(s.cpf || "").replace(/\D/g, "").slice(0, 11);
          if (!nome) nome = String(s.nome || "").trim();
        }
      } catch {
        /* ignore */
      }
    }
    let label = "";
    if (typeof window.__DK_portalFormatOperadorNomeXxx === "function") {
      label = window.__DK_portalFormatOperadorNomeXxx(nome || "Operador", cpf);
    } else {
      const xxx = cpf.slice(0, 3);
      label = xxx ? `${nome || "Operador"}-${xxx}` : nome || "Operador";
    }
    if (!cpf && !nome) label = "Sistema";
    return { cpf, nome, label };
  }

  function formatDataHoraMs(ms) {
    const n = Number(ms);
    if (!Number.isFinite(n) || n <= 0) return "—";
    try {
      const d = new Date(n);
      if (Number.isNaN(d.getTime())) return "—";
      const p2 = (x) => String(x).padStart(2, "0");
      return `${p2(d.getDate())}/${p2(d.getMonth() + 1)}/${d.getFullYear()} às ${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}`;
    } catch {
      return "—";
    }
  }

  function portalRegistrarMovimentacaoSetor(meta) {
    if (!meta || typeof meta !== "object") return { ok: false };
    const placa = nkPlate(meta.placa);
    if (!placa) return { ok: false, message: "Placa em falta." };
    const deKey = normalizeSetorKey(meta.de);
    const paraKey = normalizeSetorKey(meta.para);
    if (!deKey && !paraKey) return { ok: false, message: "Setor em falta." };
    if (deKey && paraKey && deKey === paraKey) return { ok: true, skipped: "mesmo-setor" };

    const now = Date.now();
    const list = loadLista();
    const dup = list.some((r) => {
      if (nkPlate(r.placa) !== placa) return false;
      if (String(r.de || "") !== deKey || String(r.para || "") !== paraKey) return false;
      return Math.abs(Number(r.createdAt || 0) - now) < DEDUPE_MS;
    });
    if (dup) return { ok: true, skipped: "duplicado" };

    const op = getOperadorMovimentacao();
    list.push({
      id: now,
      createdAt: now,
      placa,
      de: deKey,
      para: paraKey,
      deLabel: labelSetor(deKey || meta.de),
      paraLabel: labelSetor(paraKey || meta.para),
      operadorNome: op.nome,
      operadorCpf: op.cpf,
      operadorLabel: op.label,
      acao: String(meta.acao || "mover").trim(),
      motivo: String(meta.motivo || "").trim(),
    });
    saveLista(list);
    return { ok: true, id: now, placa, de: deKey, para: paraKey };
  }

  function filtrarRows(setorKey, placaQuery) {
    const setor = normalizeSetorKey(setorKey) || String(setorKey || "").trim();
    const q = nkPlate(placaQuery);
    return loadLista()
      .filter((r) => {
        if (setor && r.de !== setor && r.para !== setor) return false;
        if (q && !nkPlate(r.placa).includes(q)) return false;
        return true;
      })
      .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
  }

  function renderRelatorio() {
    const host = document.getElementById("portalSetorRelatorioLista");
    const empty = document.getElementById("portalSetorRelatorioEmpty");
    const titulo = document.getElementById("portalSetorRelatorioTitulo");
    const lead = document.getElementById("portalSetorRelatorioLead");
    if (!host) return;

    const setorLabel = setorFiltro ? labelSetor(setorFiltro) : "todos os setores 1 a 10";
    if (titulo) titulo.textContent = `Relatório de movimentações — ${setorLabel}`;
    if (lead) {
      lead.innerHTML = setorFiltro
        ? `Quem enviou cada placa <strong>para</strong> «${escHtml(setorLabel)}» e quem a tirou daqui para outro setor.`
        : "Quem movimentou cada placa de um setor para outro (opções 1 a 10).";
    }

    const rows = filtrarRows(setorFiltro, placaFiltro);
    if (!rows.length) {
      host.innerHTML = "";
      if (empty) {
        empty.classList.remove("hidden");
        empty.textContent = placaFiltro
          ? `Nenhuma movimentação da placa «${placaFiltro}»${setorFiltro ? ` em «${setorLabel}»` : ""}.`
          : `Nenhuma movimentação registada ainda${setorFiltro ? ` em «${setorLabel}»` : ""}. Os envios passam a aparecer aqui com o nome de quem enviou.`;
      }
      return;
    }
    empty?.classList.add("hidden");

    host.innerHTML = `<table class="portal-setor-relatorio-tabela" aria-label="Quem movimentou cada placa">
      <thead><tr>
        <th>Data / hora</th>
        <th>Placa</th>
        <th>De</th>
        <th>Para</th>
        <th>Quem movimentou</th>
      </tr></thead>
      <tbody>${rows
        .map((r) => {
          const deL = r.deLabel || labelSetor(r.de);
          const paraL = r.paraLabel || labelSetor(r.para);
          const quem = String(r.operadorLabel || r.operadorNome || "—").trim() || "—";
          return `<tr>
            <td>${escHtml(formatDataHoraMs(r.createdAt))}</td>
            <td><strong>${escHtml(r.placa)}</strong></td>
            <td>${escHtml(deL)}</td>
            <td>${escHtml(paraL)}</td>
            <td>${escHtml(quem)}</td>
          </tr>`;
        })
        .join("")}</tbody>
    </table>
    <p class="subtext portal-setor-relatorio-count">${rows.length} movimentação(ões).</p>`;
  }

  function setorAtualDoPainel() {
    if (typeof window.__DK_portalGetManutSetorAtivo === "function") {
      try {
        const k = window.__DK_portalGetManutSetorAtivo();
        if (k) return normalizeSetorKey(k) || k;
      } catch {
        /* ignore */
      }
    }
    return "";
  }

  function openModal(setorRaw) {
    const modal = document.getElementById("portalSetorRelatorioModal");
    if (!modal) return;
    setorFiltro = normalizeSetorKey(setorRaw) || normalizeSetorKey(setorAtualDoPainel()) || "";
    placaFiltro = "";
    const inp = document.getElementById("portalSetorRelatorioPlacaFiltro");
    if (inp) inp.value = "";
    renderRelatorio();
    modal.classList.remove("hidden");
    modal.setAttribute("aria-hidden", "false");
  }

  function closeModal() {
    const modal = document.getElementById("portalSetorRelatorioModal");
    if (!modal) return;
    modal.classList.add("hidden");
    modal.setAttribute("aria-hidden", "true");
  }

  function imprimirRelatorio() {
    const rows = filtrarRows(setorFiltro, placaFiltro);
    const setorLabel = setorFiltro ? labelSetor(setorFiltro) : "Setores 1 a 10";
    const corpo = rows.length
      ? rows
          .map((r) => {
            return `<tr>
              <td>${escHtml(formatDataHoraMs(r.createdAt))}</td>
              <td>${escHtml(r.placa)}</td>
              <td>${escHtml(r.deLabel || labelSetor(r.de))}</td>
              <td>${escHtml(r.paraLabel || labelSetor(r.para))}</td>
              <td>${escHtml(r.operadorLabel || r.operadorNome || "—")}</td>
            </tr>`;
          })
          .join("")
      : `<tr><td colspan="5">Nenhuma movimentação registada.</td></tr>`;
    const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Relatório de movimentações — ${escHtml(setorLabel)}</title>
      <style>
        body { font-family: Arial, sans-serif; color: #111; padding: 1.2rem; }
        h1 { font-size: 1.15rem; margin: 0 0 0.35rem; }
        p { margin: 0 0 0.85rem; font-size: 0.9rem; }
        table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
        th, td { border: 1px solid #ccc; padding: 0.4rem 0.5rem; text-align: left; }
        th { background: #f3f3f3; }
        @media print { button { display: none; } }
      </style></head><body>
      <h1>Relatório de movimentações — ${escHtml(setorLabel)}</h1>
      <p>Quem movimentou cada placa de um setor para outro. Grupo DK Empreendimentos.</p>
      <table><thead><tr><th>Data / hora</th><th>Placa</th><th>De</th><th>Para</th><th>Quem movimentou</th></tr></thead>
      <tbody>${corpo}</tbody></table>
      <p>${rows.length} movimentação(ões).</p>
      <button type="button" onclick="window.print()">Imprimir</button>
      </body></html>`;
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(html);
    w.document.close();
  }

  function bindOnce() {
    if (window.__dkPortalSetorRelatorioBound) return;
    window.__dkPortalSetorRelatorioBound = true;

    document.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-setor-relatorio]");
      if (!btn) return;
      e.preventDefault();
      const setor = btn.getAttribute("data-setor-relatorio") || setorAtualDoPainel();
      openModal(setor);
    });

    document.getElementById("portalSetorRelatorioFecharBtn")?.addEventListener("click", () => closeModal());
    document.getElementById("portalSetorRelatorioBackdrop")?.addEventListener("click", () => closeModal());
    document.getElementById("portalSetorRelatorioImprimirBtn")?.addEventListener("click", () => imprimirRelatorio());

    const inp = document.getElementById("portalSetorRelatorioPlacaFiltro");
    inp?.addEventListener("input", () => {
      inp.value = String(inp.value || "").toUpperCase();
      placaFiltro = nkPlate(inp.value);
      renderRelatorio();
    });

    document.addEventListener("keydown", (ev) => {
      const modal = document.getElementById("portalSetorRelatorioModal");
      if (!modal || modal.classList.contains("hidden")) return;
      if (ev.key === "Escape") closeModal();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bindOnce);
  } else {
    bindOnce();
  }

  window.__DK_portalRegistrarMovimentacaoSetor = portalRegistrarMovimentacaoSetor;
  window.__DK_portalOpenSetorRelatorio = openModal;
  window.__DK_portalNormalizeSetorKey = normalizeSetorKey;
  window.__DK_portalLabelSetorRelatorio = labelSetor;
})();
