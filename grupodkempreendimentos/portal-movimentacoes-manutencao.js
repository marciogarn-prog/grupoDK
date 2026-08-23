/**
 * Movimentações da manutenção — consulta por etapa ou fluxo cronológico por placa.
 */
(function portalMovimentacoesManutencao() {
  const STORAGE_KEY = "dk_portal_checklist_movimentacoes_v1";
  const CHECKLIST_ITENS_COUNT = 29;

  const CATEGORIAS = [
    { id: "triagem", label: "6 — Triagem" },
    { id: "oficina-propria", label: "7 — Oficina própria" },
    { id: "oficina-terceiros", label: "8 — Oficina de terceiro" },
    { id: "enviado-seguro", label: "9 — Seguro" },
    { id: "sinistrado-roubo", label: "10 — Sinistro Roubo" },
  ];

  const CATEGORIA_LABEL = Object.fromEntries(CATEGORIAS.map((c) => [c.id, c.label]));

  const DESTINO_LABEL = {
    ...CATEGORIA_LABEL,
    prontos: "4 — Pronto para alugar",
    "reserva-patio": "5.2 — Reserva no pátio",
    vendas: "Vendas",
  };

  let filtroCategoria = "";
  let detalheId = null;
  let modoVista = "etapa";
  let placaSelecionada = "";

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
    const trimmed = list.length > 2000 ? list.slice(list.length - 2000) : list;
    if (typeof saveCadastro === "function") {
      saveCadastro(STORAGE_KEY, trimmed, { bypassImmutabilidadeCadastro: true });
    } else {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
      } catch {
        /* ignore */
      }
    }
    if (typeof portalPushCloudSnapshotAfterPersist === "function") {
      try {
        portalPushCloudSnapshotAfterPersist();
      } catch {
        /* ignore */
      }
    } else if (typeof window.__DK_pushToCloudAfterSave === "function") {
      void window.__DK_pushToCloudAfterSave();
    }
  }

  function selectTexto(id) {
    const sel = document.getElementById(id);
    if (!sel || sel.selectedIndex < 0) return "";
    return String(sel.options[sel.selectedIndex]?.textContent || "").trim();
  }

  function getObsValor(n) {
    const estado = document.querySelector(`input[name="portalChecklistItem${n}"]:checked`)?.value || "";
    if (estado !== "R") return "";
    const sel = document.getElementById(`portalChecklistObsSelect${n}`);
    const v = String(sel?.value || "").trim();
    if (!v) return "";
    if (v === "OUTRO") {
      return String(document.getElementById(`portalChecklistObs${n}`)?.value || "").trim();
    }
    return v;
  }

  function collectChecklistSnapshot(categoriaRaw, destinoRaw) {
    const categoria = String(categoriaRaw || "").trim().toLowerCase();
    if (!CATEGORIA_LABEL[categoria]) return null;

    const placa = nkPlate(
      document.getElementById("portalChecklistFieldPlaca")?.value ||
        document.getElementById("portalChecklistPlacaInput")?.value
    );
    if (!placa) return null;

    const val = (id) => String(document.getElementById(id)?.value || "").trim();
    const itens = [];
    for (let n = 1; n <= CHECKLIST_ITENS_COUNT; n++) {
      const estado = document.querySelector(`input[name="portalChecklistItem${n}"]:checked`)?.value || "A";
      itens.push({ n, estado, obs: getObsValor(n) });
    }

    const motivo = String(document.getElementById("portalChecklistMotivoPrincipalTexto")?.textContent || "").trim();
    const destino = String(destinoRaw || "").trim().toLowerCase();

    return {
      id: Date.now(),
      placa,
      categoria,
      destino: destino || inferDestino(categoria, itens),
      createdAt: Date.now(),
      entradaData: val("portalChecklistEntradaData"),
      entradaHora: val("portalChecklistEntradaHora"),
      saidaData: val("portalChecklistSaidaData"),
      saidaHora: val("portalChecklistSaidaHora"),
      odometro: String(val("portalChecklistOdometro")).replace(/\D/g, ""),
      proximaTroca: String(val("portalChecklistProximaTroca")).replace(/\D/g, ""),
      oleo: document.querySelector('input[name="portalChecklistOleo"]:checked')?.value || "",
      pagou: document.querySelector('input[name="portalChecklistPagou"]:checked')?.value || "",
      itens,
      mecanico: selectTexto("portalChecklistMecanico"),
      supervisor: selectTexto("portalChecklistSupervisor"),
      motivoPrincipal: motivo,
      meta: {
        plano: val("portalChecklistFieldPlano"),
        protocolo: val("portalChecklistFieldProtocolo"),
        cliente: val("portalChecklistFieldCliente"),
        marcaModelo: val("portalChecklistFieldMarcaModelo"),
        anoModelo: val("portalChecklistFieldAnoModelo"),
        cor: val("portalChecklistFieldCor"),
        celular: val("portalChecklistFieldCelular"),
        inicioContrato: val("portalChecklistFieldInicioContrato"),
      },
    };
  }

  function inferDestino(categoria, itens) {
    if (categoria === "triagem") return "oficina-propria";
    return "";
  }

  function portalSaveChecklistMovimentacao(categoriaRaw, destinoRaw) {
    const snap = collectChecklistSnapshot(categoriaRaw, destinoRaw);
    if (!snap) return { ok: false, message: "Check-list em falta ou categoria inválida." };
    if (!snap.entradaData || !snap.entradaHora) {
      return { ok: false, message: "Entrada (data/hora) em falta no check-list." };
    }
    const list = loadLista();
    list.push(snap);
    saveLista(list);
    if (typeof addAuditLog === "function") {
      addAuditLog(
        "portal_checklist_movimentacao",
        "manutencao",
        `${snap.placa}:${snap.categoria}${snap.destino ? "→" + snap.destino : ""}`
      );
    }
    return { ok: true, id: snap.id, placa: snap.placa, categoria: snap.categoria, destino: snap.destino };
  }

  function fmtDataHora(row) {
    const d = String(row?.entradaData || "").trim();
    const h = String(row?.entradaHora || "").trim();
    if (d && h) return `${d} ${h}`;
    return d || h || "—";
  }

  function fmtOdometro(km) {
    const n = parseInt(String(km || "").replace(/\D/g, ""), 10);
    if (!Number.isFinite(n) || n < 0) return "—";
    return `${n.toLocaleString("pt-BR")} km`;
  }

  function labelDestino(destinoRaw, row, nextRow) {
    let d = String(destinoRaw || "").trim().toLowerCase();
    if (!d && nextRow?.categoria) d = nextRow.categoria;
    if (!d && row?.categoria === "triagem") d = "oficina-propria";
    return DESTINO_LABEL[d] || (d ? d : "");
  }

  function syncModoUi() {
    const isPlaca = modoVista === "placa";
    document.querySelectorAll("[data-mov-manut-modo]").forEach((btn) => {
      const on = btn.getAttribute("data-mov-manut-modo") === modoVista;
      btn.classList.toggle("is-active", on);
      btn.setAttribute("aria-selected", on ? "true" : "false");
    });
    document.getElementById("portalMovManutPainelEtapa")?.classList.toggle("hidden", isPlaca);
    document.getElementById("portalMovManutPlacasPick")?.classList.toggle("hidden", !isPlaca);
    document.getElementById("portalMovManutPlacasPick")?.toggleAttribute("hidden", !isPlaca);
    document.getElementById("portalMovManutTimeline")?.classList.toggle("hidden", !isPlaca || !placaSelecionada);
    document.getElementById("portalMovManutTimeline")?.toggleAttribute("hidden", !isPlaca || !placaSelecionada);
    document.getElementById("portalMovManutLista")?.classList.toggle("hidden", isPlaca);
    const lbl = document.getElementById("portalMovManutPlacaFiltroLabel");
    if (lbl) lbl.textContent = isPlaca ? "Pesquisar placa" : "Filtrar por placa";
  }

  function renderFiltros() {
    const host = document.getElementById("portalMovManutFiltros");
    if (!host) return;
    const btns = [
      { id: "", label: "Todas" },
      ...CATEGORIAS.map((c) => ({ id: c.id, label: c.label })),
    ];
    host.innerHTML = btns
      .map(
        (b) =>
          `<button type="button" class="btn-primary btn-secondary-outline portal-mov-manut-filtro-btn${
            filtroCategoria === b.id ? " is-active" : ""
          }" data-mov-manut-cat="${escHtml(b.id)}" aria-pressed="${filtroCategoria === b.id ? "true" : "false"}">${escHtml(
            b.label
          )}</button>`
      )
      .join("");
  }

  function agruparPorPlaca(rows) {
    const map = new Map();
    rows.forEach((r) => {
      const pk = nkPlate(r.placa);
      if (!pk) return;
      if (!map.has(pk)) {
        map.set(pk, {
          placa: pk,
          modelo: String(r.meta?.marcaModelo || "").trim(),
          registos: [],
          ultimo: 0,
        });
      }
      const g = map.get(pk);
      g.registos.push(r);
      const t = Number(r.createdAt || 0);
      if (t > g.ultimo) g.ultimo = t;
      if (!g.modelo && r.meta?.marcaModelo) g.modelo = String(r.meta.marcaModelo).trim();
    });
    return Array.from(map.values()).sort((a, b) => b.ultimo - a.ultimo);
  }

  function renderPlacasPick() {
    const host = document.getElementById("portalMovManutPlacasPick");
    if (!host) return;
    const placaFiltro = nkPlate(document.getElementById("portalMovManutPlacaFiltro")?.value || "");
    let grupos = agruparPorPlaca(loadLista());
    if (placaFiltro) grupos = grupos.filter((g) => g.placa.includes(placaFiltro));

    if (!grupos.length) {
      host.innerHTML = `<p class="subtext portal-mov-manut-placas-empty">${
        placaFiltro
          ? `Nenhuma placa «${escHtml(placaFiltro)}» com movimentações.`
          : "Nenhuma placa com check-lists registados."
      }</p>`;
      placaSelecionada = "";
      return;
    }

    if (placaFiltro && grupos.length === 1) {
      placaSelecionada = grupos[0].placa;
    } else if (placaSelecionada && !grupos.some((g) => g.placa === placaSelecionada)) {
      placaSelecionada = "";
    }

    host.innerHTML = grupos
      .map((g) => {
        const n = g.registos.length;
        const ult = g.registos.slice().sort((a, b) => Number(b.createdAt) - Number(a.createdAt))[0];
        const on = placaSelecionada === g.placa;
        return `<button type="button" class="portal-mov-manut-placa-card${on ? " is-active" : ""}" data-mov-manut-placa="${escHtml(
          g.placa
        )}" role="listitem">
          <span class="portal-mov-manut-placa-card__placa">${escHtml(g.placa)}</span>
          ${g.modelo ? `<span class="portal-mov-manut-placa-card__modelo">${escHtml(g.modelo)}</span>` : ""}
          <span class="portal-mov-manut-placa-card__meta">${n} passo${n !== 1 ? "s" : ""} · ${escHtml(fmtDataHora(ult))}</span>
        </button>`;
      })
      .join("");
  }

  function renderTimeline() {
    const host = document.getElementById("portalMovManutTimeline");
    if (!host) return;
    if (!placaSelecionada) {
      host.innerHTML = "";
      host.classList.add("hidden");
      host.hidden = true;
      return;
    }

    const rows = loadLista()
      .filter((r) => nkPlate(r.placa) === placaSelecionada)
      .slice()
      .sort((a, b) => Number(a.createdAt || 0) - Number(b.createdAt || 0));

    if (!rows.length) {
      host.innerHTML = `<p class="subtext">Sem registos para ${escHtml(placaSelecionada)}.</p>`;
      host.classList.remove("hidden");
      host.hidden = false;
      return;
    }

    const modelo = String(rows[rows.length - 1]?.meta?.marcaModelo || "").trim();
    host.innerHTML = `
      <h4 class="portal-mov-manut-timeline-title">Fluxo cronológico — ${escHtml(placaSelecionada)}${
        modelo ? ` · ${escHtml(modelo)}` : ""
      }</h4>
      <ol class="portal-mov-manut-timeline-list">
        ${rows
          .map((r, idx) => {
            const catLabel = CATEGORIA_LABEL[r.categoria] || r.categoria;
            const destLabel = labelDestino(r.destino, r, rows[idx + 1]);
            const motivo = String(r.motivoPrincipal || "").trim();
            const nR = (r.itens || []).filter((it) => it.estado === "R").length;
            return `<li class="portal-mov-manut-timeline-step portal-mov-manut-timeline-step--${escHtml(r.categoria)}">
              <div class="portal-mov-manut-timeline-step__head">
                <span class="portal-mov-manut-timeline-step__num">${idx + 1}</span>
                <div>
                  <strong>${escHtml(catLabel)}</strong>
                  <span class="portal-mov-manut-timeline-step__when">${escHtml(fmtDataHora(r))}</span>
                </div>
              </div>
              ${
                destLabel
                  ? `<p class="portal-mov-manut-timeline-step__dest">→ Encaminhado para <strong>${escHtml(destLabel)}</strong></p>`
                  : ""
              }
              <p class="portal-mov-manut-timeline-step__resumo">
                Odômetro: ${escHtml(fmtOdometro(r.odometro))}
                · Troca óleo: ${escHtml(r.oleo === "sim" ? "Sim" : r.oleo === "nao" ? "Não" : "—")}
                · Itens em R: ${nR}
              </p>
              ${motivo ? `<p class="portal-mov-manut-timeline-step__motivo">${escHtml(motivo)}</p>` : ""}
              <button type="button" class="btn-primary btn-secondary-outline portal-mov-manut-ver-btn" data-mov-manut-ver="${r.id}">Ver check-list</button>
            </li>`;
          })
          .join("")}
      </ol>`;
    host.classList.remove("hidden");
    host.hidden = false;
  }

  function renderLista() {
    const host = document.getElementById("portalMovManutLista");
    const empty = document.getElementById("portalMovManutEmpty");
    if (!host || modoVista === "placa") return;

    const placaFiltro = nkPlate(document.getElementById("portalMovManutPlacaFiltro")?.value || "");
    let rows = loadLista().slice().sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
    if (filtroCategoria) rows = rows.filter((r) => r.categoria === filtroCategoria);
    if (placaFiltro) rows = rows.filter((r) => nkPlate(r.placa).includes(placaFiltro));

    if (!rows.length) {
      host.innerHTML = "";
      if (empty) {
        empty.classList.remove("hidden");
        empty.textContent = placaFiltro
          ? `Nenhum check-list encontrado para a placa «${placaFiltro}».`
          : filtroCategoria
            ? `Nenhum check-list registado em «${CATEGORIA_LABEL[filtroCategoria] || filtroCategoria}».`
            : "Nenhum check-list registado ainda. Os registos aparecem ao enviar ou encaminhar veículos nas etapas 6–10.";
      }
      return;
    }
    empty?.classList.add("hidden");

    host.innerHTML = `<table class="portal-mov-manut-tabela" aria-label="Check-lists de manutenção">
      <thead><tr>
        <th>Placa</th><th>Etapa</th><th>Entrada</th><th>Destino</th><th>Odômetro</th><th></th>
      </tr></thead>
      <tbody>${rows
        .map((r) => {
          const catLabel = CATEGORIA_LABEL[r.categoria] || r.categoria;
          const destLabel = labelDestino(r.destino, r, null) || "—";
          const modelo = String(r.meta?.marcaModelo || "").trim();
          return `<tr class="portal-mov-manut-row${detalheId === r.id ? " is-selected" : ""}" data-mov-manut-id="${r.id}">
            <td><strong>${escHtml(r.placa)}</strong>${modelo ? `<br><span class="subtext">${escHtml(modelo)}</span>` : ""}</td>
            <td>${escHtml(catLabel)}</td>
            <td>${escHtml(fmtDataHora(r))}</td>
            <td>${escHtml(destLabel)}</td>
            <td>${escHtml(fmtOdometro(r.odometro))}</td>
            <td><button type="button" class="btn-primary btn-secondary-outline portal-mov-manut-ver-btn" data-mov-manut-ver="${r.id}">Ver</button></td>
          </tr>`;
        })
        .join("")}</tbody>
    </table>`;
  }

  function renderDetalhe(row) {
    const host = document.getElementById("portalMovManutDetalhe");
    if (!host) return;
    if (!row) {
      host.classList.add("hidden");
      host.hidden = true;
      host.innerHTML = "";
      detalheId = null;
      return;
    }
    detalheId = row.id;
    const catLabel = CATEGORIA_LABEL[row.categoria] || row.categoria;
    const destLabel = labelDestino(row.destino, row, null);
    const itensR = (row.itens || []).filter((it) => it.estado === "R");
    const itensA = (row.itens || []).filter((it) => it.estado === "A" && it.obs);
    const oleoTxt = row.oleo === "sim" ? "Sim" : row.oleo === "nao" ? "Não" : "—";

    const itensHtml = [...itensR, ...itensA]
      .map((it) => {
        const label = `#${it.n} · ${it.estado}${it.obs ? ` — ${it.obs}` : ""}`;
        return `<li class="portal-mov-manut-item portal-mov-manut-item--${it.estado.toLowerCase()}">${escHtml(label)}</li>`;
      })
      .join("");

    host.innerHTML = `
      <div class="portal-mov-manut-detalhe-header">
        <h4>${escHtml(row.placa)} — ${escHtml(catLabel)}</h4>
        <button type="button" class="btn-primary btn-secondary-outline portal-mov-manut-fechar-detalhe" aria-label="Fechar detalhe">✕</button>
      </div>
      ${destLabel ? `<p class="portal-mov-manut-detalhe-dest">Encaminhado para: <strong>${escHtml(destLabel)}</strong></p>` : ""}
      <div class="portal-mov-manut-detalhe-grid">
        <div><span class="portal-mov-manut-detalhe-label">Entrada</span> ${escHtml(fmtDataHora(row))}</div>
        <div><span class="portal-mov-manut-detalhe-label">Saída</span> ${escHtml(
          [row.saidaData, row.saidaHora].filter(Boolean).join(" ") || "—"
        )}</div>
        <div><span class="portal-mov-manut-detalhe-label">Odômetro</span> ${escHtml(fmtOdometro(row.odometro))}</div>
        <div><span class="portal-mov-manut-detalhe-label">Troca de óleo</span> ${escHtml(oleoTxt)}</div>
        <div><span class="portal-mov-manut-detalhe-label">Pagou</span> ${escHtml(row.pagou || "—")}</div>
        <div><span class="portal-mov-manut-detalhe-label">Mecânico</span> ${escHtml(row.mecanico || "—")}</div>
        <div><span class="portal-mov-manut-detalhe-label">Supervisor</span> ${escHtml(row.supervisor || "—")}</div>
        <div class="portal-mov-manut-detalhe-wide"><span class="portal-mov-manut-detalhe-label">Motivo principal</span> ${escHtml(
          row.motivoPrincipal || "—"
        )}</div>
      </div>
      ${
        itensHtml
          ? `<div class="portal-mov-manut-detalhe-itens"><span class="portal-mov-manut-detalhe-label">Itens marcados</span><ul>${itensHtml}</ul></div>`
          : `<p class="subtext portal-mov-manut-detalhe-sem-itens">Nenhum item em R neste registo.</p>`
      }
    `;
    host.classList.remove("hidden");
    host.hidden = false;
  }

  function refreshModal() {
    syncModoUi();
    if (modoVista === "etapa") {
      renderFiltros();
      renderLista();
    } else {
      renderPlacasPick();
      renderTimeline();
      document.getElementById("portalMovManutEmpty")?.classList.add("hidden");
    }
    if (detalheId) {
      const row = loadLista().find((r) => Number(r.id) === Number(detalheId));
      if (row) renderDetalhe(row);
      else renderDetalhe(null);
    }
  }

  function openModal(categoriaPref) {
    const modal = document.getElementById("portalMovManutModal");
    if (!modal) return;
    filtroCategoria = CATEGORIA_LABEL[categoriaPref] ? String(categoriaPref) : "";
    detalheId = null;
    placaSelecionada = "";
    modoVista = "etapa";
    const inp = document.getElementById("portalMovManutPlacaFiltro");
    if (inp) inp.value = "";
    refreshModal();
    modal.classList.remove("hidden");
    modal.setAttribute("aria-hidden", "false");
    inp?.focus();
  }

  function closeModal() {
    const modal = document.getElementById("portalMovManutModal");
    if (!modal) return;
    modal.classList.add("hidden");
    modal.setAttribute("aria-hidden", "true");
    renderDetalhe(null);
    placaSelecionada = "";
  }

  function parseDataBrMov(raw) {
    const fn = window.__DK_manutChecklistParseDataBr;
    if (typeof fn === "function") return fn(raw);
    const s = String(raw || "").trim();
    let m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
    if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
    m = s.match(/(\d{2})\/(\d{2})\/(\d{4})/);
    if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
    return null;
  }

  function fmtDataSemanaMov(dateRaw) {
    const fn = window.__DK_manutChecklistFmtDataSemana;
    const d = dateRaw instanceof Date ? dateRaw : parseDataBrMov(dateRaw);
    if (typeof fn === "function" && d) return fn(d);
    if (!d || Number.isNaN(d.getTime())) return String(dateRaw || "").trim();
    const semana = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"][d.getDay()];
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    return `${semana}, ${dd}/${mm}/${d.getFullYear()}`;
  }

  function resolveImgVeiculoChecklist(marcaModelo, cor) {
    const mm = String(marcaModelo || "");
    const c = String(cor || "");
    if (/SHI\s*175/i.test(mm) && /VERMELH/i.test(c)) {
      return "images/manutencao/shineray-shi-175-vermelha.png";
    }
    return "";
  }

  function resolveCpfLocacaoPorProtocolo(protocoloRaw, placaRaw) {
    const proto = String(protocoloRaw || "").trim();
    const placa = nkPlate(placaRaw);
    if (typeof loadCadastro !== "function" || typeof CAD_LOCACOES_KEY === "undefined") return "";
    const locs = loadCadastro(CAD_LOCACOES_KEY);
    let hit = null;
    if (proto) {
      hit =
        locs.find((l) => String(l.numeroContrato || "").trim() === proto) ||
        locs
          .filter((l) => String(l.numeroContrato || "").trim() === proto)
          .sort((a, b) => Number(b.createdAt || b.id || 0) - Number(a.createdAt || a.id || 0))[0] ||
        null;
    }
    if (!hit && placa) {
      hit =
        locs
          .filter((l) => nkPlate(l.placa) === placa)
          .sort((a, b) => Number(b.createdAt || b.id || 0) - Number(a.createdAt || a.id || 0))[0] || null;
    }
    const cpf = String(hit?.cpf || "").replace(/\D/g, "");
    return cpf.length === 11 ? cpf : "";
  }

  /** Converte registo de movimentação → payload do PDF oficial (papel 2 páginas). */
  function buildPrintPayloadFromMovimentacao(row) {
    if (!row) return null;
    const meta = row.meta || {};
    const labels = Array.isArray(window.__DK_manutChecklistPdfItens) ? window.__DK_manutChecklistPdfItens : [];
    const clienteLinha = String(meta.cliente || "").trim();
    let codCliente = "";
    let nomeCliente = "";
    const cm = clienteLinha.match(/^(.+?)\s*[—\-–]\s*(.+)$/);
    if (cm) {
      codCliente = cm[1].replace(/^Cód\.?:?\s*/i, "").trim();
      nomeCliente = cm[2].trim();
    } else {
      nomeCliente = clienteLinha;
    }

    const placa = nkPlate(row.placa);
    const plano = String(meta.plano || "").trim();
    const marcaModelo = String(meta.marcaModelo || "").trim();
    const corVeiculo = String(meta.cor || "").trim();
    const isCarro = /carro/i.test(plano);

    const byN = new Map((row.itens || []).map((it) => [Number(it.n), it]));
    const itens = [];
    for (let n = 1; n <= CHECKLIST_ITENS_COUNT; n++) {
      const it = byN.get(n);
      itens.push({
        n,
        label: labels[n - 1] || `Item ${n}`,
        estado: it?.estado === "R" ? "R" : "A",
        obs: String(it?.obs || "").trim(),
      });
    }

    const odometro = String(row.odometro || "").replace(/\D/g, "");
    let proximaTroca = String(row.proximaTroca || "").replace(/\D/g, "");
    if (!proximaTroca && odometro) {
      const n = parseInt(odometro, 10);
      if (Number.isFinite(n)) proximaTroca = String(n + 1000);
    }

    const dados = {
      protocolo: String(meta.protocolo || "").trim() || "—",
      plano,
      isCarro,
      inicio: parseDataBrMov(meta.inicioContrato),
      codCliente,
      nomeCliente,
      cpf: resolveCpfLocacaoPorProtocolo(meta.protocolo, placa),
      celular: String(meta.celular || "").trim(),
      placa,
      anoModelo: String(meta.anoModelo || "").trim(),
      corVeiculo,
      marcaModelo,
      imgVeiculo: resolveImgVeiculoChecklist(marcaModelo, corVeiculo),
    };

    const form = {
      oleo: String(row.oleo || "").trim(),
      pagou: String(row.pagou || "").trim(),
      mecanico: String(row.mecanico || "").trim(),
      supervisor: String(row.supervisor || "").trim(),
      odometro,
      proximaTroca,
      itens,
      horaEntrada: String(row.entradaHora || "").trim(),
      dataEntradaFmt: fmtDataSemanaMov(row.entradaData),
      horaSaida: String(row.saidaHora || "").trim(),
      dataSaidaFmt: fmtDataSemanaMov(row.saidaData),
      assinaturaCliente: "",
      assinaturaSupervisor: "",
    };

    return { dados, form };
  }

  function openChecklistPdfFromMovimentacao(row) {
    const openFn = window.__DK_openManutChecklistPrint;
    if (typeof openFn !== "function") {
      return { ok: false, erro: "Módulo de impressão do check-list indisponível. Recarregue a página." };
    }
    const payload = buildPrintPayloadFromMovimentacao(row);
    if (!payload) return { ok: false, erro: "Registo não encontrado." };
    if (!payload.dados.protocolo || payload.dados.protocolo === "—") {
      return { ok: false, erro: "Check-list sem protocolo — complete o cadastro da locação." };
    }
    return openFn(payload.dados, payload.form);
  }

  function onVerChecklist(id) {
    const row = loadLista().find((r) => Number(r.id) === Number(id));
    if (!row) {
      renderDetalhe(null);
      return;
    }
    const catLabel = CATEGORIA_LABEL[row.categoria] || row.categoria;
    const r = openChecklistPdfFromMovimentacao(row);
    if (r?.ok) {
      renderDetalhe(null);
      if (modoVista === "etapa") renderLista();
      return;
    }
    renderDetalhe(row);
    const host = document.getElementById("portalMovManutDetalhe");
    if (host && r?.erro) {
      const aviso = document.createElement("p");
      aviso.className = "portal-mov-manut-detalhe-erro";
      aviso.textContent = `${r.erro} Etapa: ${catLabel}.`;
      host.insertBefore(aviso, host.firstChild?.nextSibling || host.firstChild);
    }
    if (modoVista === "etapa") renderLista();
  }

  function bindOnce() {
    if (window.__dkPortalMovManutBound) return;
    window.__dkPortalMovManutBound = true;

    document.getElementById("portalMovManutFecharBtn")?.addEventListener("click", closeModal);
    document.getElementById("portalMovManutBackdrop")?.addEventListener("click", closeModal);

    document.querySelector(".portal-mov-manut-modos")?.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-mov-manut-modo]");
      if (!btn) return;
      modoVista = btn.getAttribute("data-mov-manut-modo") || "etapa";
      if (modoVista === "placa") {
        const pk = nkPlate(document.getElementById("portalMovManutPlacaFiltro")?.value || "");
        placaSelecionada = pk;
      } else {
        placaSelecionada = "";
      }
      renderDetalhe(null);
      refreshModal();
    });

    document.getElementById("portalMovManutPlacaFiltro")?.addEventListener("input", (e) => {
      const t = e.target;
      if (t) t.value = String(t.value || "").toUpperCase();
      if (modoVista === "placa") {
        const pk = nkPlate(t?.value || "");
        if (pk.length >= 7) placaSelecionada = pk;
        renderPlacasPick();
        renderTimeline();
      } else {
        renderLista();
      }
    });

    document.getElementById("portalMovManutFiltros")?.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-mov-manut-cat]");
      if (!btn) return;
      filtroCategoria = btn.getAttribute("data-mov-manut-cat") || "";
      renderFiltros();
      renderLista();
    });

    document.getElementById("portalMovManutPlacasPick")?.addEventListener("click", (e) => {
      const card = e.target.closest("[data-mov-manut-placa]");
      if (!card) return;
      placaSelecionada = card.getAttribute("data-mov-manut-placa") || "";
      const inp = document.getElementById("portalMovManutPlacaFiltro");
      if (inp) inp.value = placaSelecionada;
      renderPlacasPick();
      renderTimeline();
    });

    document.getElementById("portalMovManutLista")?.addEventListener("click", (e) => {
      const verBtn = e.target.closest("[data-mov-manut-ver]");
      if (!verBtn) return;
      onVerChecklist(Number(verBtn.getAttribute("data-mov-manut-ver")));
    });

    document.getElementById("portalMovManutTimeline")?.addEventListener("click", (e) => {
      const verBtn = e.target.closest("[data-mov-manut-ver]");
      if (!verBtn) return;
      onVerChecklist(Number(verBtn.getAttribute("data-mov-manut-ver")));
    });

    document.getElementById("portalMovManutDetalhe")?.addEventListener("click", (e) => {
      if (e.target.closest(".portal-mov-manut-fechar-detalhe")) {
        renderDetalhe(null);
        if (modoVista === "etapa") renderLista();
      }
    });

    document.getElementById("btn-operacao-lancamento-manutencao")?.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopImmediatePropagation();
      openModal("");
    });

    document.addEventListener("keydown", (ev) => {
      const modal = document.getElementById("portalMovManutModal");
      if (!modal || modal.classList.contains("hidden")) return;
      if (ev.key === "Escape") {
        if (detalheId) {
          renderDetalhe(null);
          refreshModal();
        } else {
          closeModal();
        }
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bindOnce);
  } else {
    bindOnce();
  }

  function findLatestMovimentacao(placaRaw, categoriaRaw) {
    const placa = nkPlate(placaRaw);
    const categoria = String(categoriaRaw || "").trim().toLowerCase();
    if (!placa || !CATEGORIA_LABEL[categoria]) return null;
    const rows = loadLista()
      .filter((r) => nkPlate(r.placa) === placa && r.categoria === categoria)
      .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
    return rows[0] || null;
  }

  window.__DK_openPortalMovManutModal = openModal;
  window.__DK_portalSaveChecklistMovimentacao = portalSaveChecklistMovimentacao;
  window.__DK_portalLoadChecklistMovimentacoes = loadLista;
  window.__DK_portalCollectChecklistSnapshot = collectChecklistSnapshot;
  window.__DK_portalFindChecklistMovimentacao = findLatestMovimentacao;
  window.__DK_portalOpenChecklistPdfFromMovimentacao = openChecklistPdfFromMovimentacao;
  window.__DK_portalBuildPrintPayloadFromMovimentacao = buildPrintPayloadFromMovimentacao;
})();
