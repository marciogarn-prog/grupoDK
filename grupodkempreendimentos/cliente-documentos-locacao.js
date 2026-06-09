/**
 * App cliente — visualização de documentos do protocolo (contrato, CRLV, multas).
 */
(function clienteDocumentosLocacao() {
  const TITULOS = {
    contrato: "Contrato",
    crlv: "CRLV",
    multa: "Multas",
  };

  function onlyDigits(s) {
    return String(s ?? "").replace(/\D/g, "");
  }

  function normNc(v) {
    return String(v ?? "")
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "");
  }

  function escapeHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function isDocEnviadoCliente(d) {
    if (typeof window.__DK_docsLocacaoIsEnviadoCliente === "function") {
      return window.__DK_docsLocacaoIsEnviadoCliente(d);
    }
    return d?.enviadoCliente === true;
  }

  function inferDocTipo(d) {
    if (typeof window.__DK_docsLocacaoInferTipo === "function") return window.__DK_docsLocacaoInferTipo(d);
    const t = String(d?.tipo || d?.origemDepositoCategoria || "").trim().toLowerCase();
    if (t === "contrato" || t === "crlv" || t === "multa") return t;
    const nome = String(d?.nome || "");
    if (/^contrato\b|contrato\s*—/i.test(nome)) return "contrato";
    if (/crlv/i.test(nome)) return "crlv";
    if (/multa/i.test(nome)) return "multa";
    return "";
  }

  function loadDocs(proto, cpf, tipo) {
    const fnPorTipo =
      typeof window.__DK_docsLocacaoDoProtocoloPorTipo === "function"
        ? window.__DK_docsLocacaoDoProtocoloPorTipo
        : null;
    const fn = typeof window.__DK_docsLocacaoDoProtocolo === "function" ? window.__DK_docsLocacaoDoProtocolo : null;
    let rows = [];
    if (fnPorTipo && tipo) {
      rows = fnPorTipo(proto, cpf, tipo);
    } else if (fn) {
      rows = fn(proto, cpf);
      if (tipo) rows = rows.filter((d) => inferDocTipo(d) === String(tipo).trim().toLowerCase());
    } else {
      try {
        const raw = localStorage.getItem("dk_locacao_documentos_v1");
        const all = raw ? JSON.parse(raw) : [];
        if (!Array.isArray(all)) rows = [];
        else {
          const nc = normNc(proto);
          const dig = onlyDigits(cpf).slice(0, 11);
          rows = all.filter((d) => normNc(d.numeroContrato) === nc && onlyDigits(d.cpf).slice(0, 11) === dig);
          if (tipo) rows = rows.filter((d) => inferDocTipo(d) === String(tipo).trim().toLowerCase());
        }
      } catch {
        rows = [];
      }
    }
    return rows.filter(isDocEnviadoCliente);
  }

  function panelEl(proto, tipo) {
    return document.querySelector(`[data-cliente-docs-panel="${proto}"][data-cliente-docs-tipo="${tipo}"]`);
  }

  function btnEl(proto, tipo) {
    return document.querySelector(
      `[data-cliente-docs-proto="${proto}"][data-cliente-docs-tipo="${tipo}"]`
    );
  }

  function bindPinchZoom(wrap) {
    if (!wrap || wrap.dataset.zoomBound === "1") return;
    wrap.dataset.zoomBound = "1";
    const viewport = wrap.querySelector(".cliente-doc-zoom-viewport");
    const stage = wrap.querySelector(".cliente-doc-zoom-stage");
    const label = wrap.querySelector("[data-doc-zoom-label]");
    if (!viewport || !stage) return;

    let scale = 1;
    let panX = 0;
    let panY = 0;
    let pinchStartDist = 0;
    let pinchStartScale = 1;
    let lastTouchPan = null;
    let touchStartPanX = 0;
    let touchStartPanY = 0;

    function apply() {
      stage.style.transform = `translate(${panX}px, ${panY}px) scale(${scale})`;
      stage.style.transformOrigin = "0 0";
      if (label) label.textContent = `${Math.round(scale * 100)}%`;
    }

    function setScale(next, cx, cy) {
      const prev = scale;
      scale = Math.min(4, Math.max(0.6, next));
      if (cx != null && cy != null && prev > 0 && prev !== scale) {
        const rect = viewport.getBoundingClientRect();
        panX -= (cx - rect.left - panX) * (scale / prev - 1);
        panY -= (cy - rect.top - panY) * (scale / prev - 1);
      }
      apply();
    }

    function dist(t) {
      return Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    }

    function mid(t) {
      return { x: (t[0].clientX + t[1].clientX) / 2, y: (t[0].clientY + t[1].clientY) / 2 };
    }

    viewport.addEventListener(
      "touchstart",
      (e) => {
        if (e.touches.length === 2) {
          pinchStartDist = dist(e.touches);
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
          const m = mid(e.touches);
          setScale(pinchStartScale * (dist(e.touches) / pinchStartDist), m.x, m.y);
          e.preventDefault();
        } else if (e.touches.length === 1 && lastTouchPan && scale > 1.02) {
          panX = touchStartPanX + (e.touches[0].clientX - lastTouchPan.x);
          panY = touchStartPanY + (e.touches[0].clientY - lastTouchPan.y);
          apply();
          e.preventDefault();
        }
      },
      { passive: false }
    );

    viewport.addEventListener("touchend", (e) => {
      if (e.touches.length < 2) pinchStartDist = 0;
      if (e.touches.length === 0) lastTouchPan = null;
    });

    wrap.querySelector('[data-doc-zoom="in"]')?.addEventListener("click", () => {
      const r = viewport.getBoundingClientRect();
      setScale(scale + 0.35, r.left + r.width / 2, r.top + r.height / 2);
    });
    wrap.querySelector('[data-doc-zoom="out"]')?.addEventListener("click", () => {
      const r = viewport.getBoundingClientRect();
      setScale(scale - 0.35, r.left + r.width / 2, r.top + r.height / 2);
    });
    wrap.querySelector('[data-doc-zoom="reset"]')?.addEventListener("click", () => {
      scale = 1;
      panX = 0;
      panY = 0;
      apply();
    });

    apply();
  }

  function renderViewer(doc) {
    const url = String(doc.arquivoBase64 || "").trim();
    const mime = String(doc.mimeType || "").toLowerCase();
    if (!url) return '<p class="subtext">Documento indisponível neste dispositivo. Toque em Atualizar da nuvem.</p>';
    if (mime.includes("pdf") || url.includes("application/pdf")) {
      return `<iframe class="cliente-doc-iframe" src="${url.replace(/"/g, "&quot;")}" title="${escapeHtml(doc.nome)}"></iframe>`;
    }
    return `<img class="cliente-doc-img" src="${url.replace(/"/g, "&quot;")}" alt="${escapeHtml(doc.nome)}">`;
  }

  function tituloPainel(tipo, proto, qtd) {
    const rotulo = TITULOS[tipo] || "Documentos";
    if (qtd > 0) return `${rotulo} — protocolo ${proto} (${qtd} ficheiro(s))`;
    return `${rotulo} — protocolo ${proto} (sem ficheiros)`;
  }

  function abrirPainel(proto, cpf, tipo) {
    const panel = panelEl(proto, tipo);
    if (!panel) return false;
    const lista = panel.querySelector("[data-cliente-docs-lista]");
    const viewer = panel.querySelector("[data-cliente-docs-viewer]");
    const titulo = panel.querySelector("[data-cliente-docs-titulo]");
    const docs = loadDocs(proto, cpf, tipo).sort((a, b) => Number(b.createdAt) - Number(a.createdAt));

    if (titulo) titulo.textContent = tituloPainel(tipo, proto, docs.length);

    if (lista) {
      if (!docs.length) {
        const vazio =
          tipo === "multa"
            ? "Ainda não há multas anexadas a este protocolo."
            : tipo === "crlv"
              ? "CRLV ainda não disponível neste protocolo."
              : "Contrato ainda não disponível neste protocolo.";
        lista.innerHTML = `<p class="subtext">${vazio}</p>`;
      } else {
        lista.innerHTML = docs
          .map(
            (d, i) =>
              `<div class="cliente-doc-row">
                <button type="button" class="btn-primary btn-secondary-outline cliente-doc-link" data-cliente-doc-idx="${i}" data-cliente-doc-proto="${escapeHtml(proto)}" data-cliente-doc-tipo="${escapeHtml(tipo)}">${escapeHtml(d.nome)}</button>
                <a class="btn-primary btn-secondary-outline cliente-doc-download" href="${String(d.arquivoBase64 || "#").replace(/"/g, "&quot;")}" download="${escapeHtml(d.nome)}">Baixar</a>
              </div>`
          )
          .join("");
      }
    }

    if (viewer) {
      viewer.innerHTML = docs.length
        ? `<div class="cliente-doc-zoom-wrap">
            <div class="cliente-doc-zoom-toolbar" role="toolbar" aria-label="Zoom do documento">
              <button type="button" class="cliente-cal-zoom-btn" data-doc-zoom="out" aria-label="Reduzir">−</button>
              <span class="cliente-cal-zoom-label" data-doc-zoom-label>100%</span>
              <button type="button" class="cliente-cal-zoom-btn" data-doc-zoom="in" aria-label="Ampliar">+</button>
              <button type="button" class="cliente-cal-zoom-btn cliente-cal-zoom-btn--reset" data-doc-zoom="reset">Ajustar</button>
            </div>
            <p class="cliente-cal-zoom-hint">Pinça com dois dedos para ampliar e ler o documento</p>
            <div class="cliente-doc-zoom-viewport" tabindex="0">
              <div class="cliente-doc-zoom-stage">${renderViewer(docs[0])}</div>
            </div>
          </div>`
        : "";
      const zw = viewer.querySelector(".cliente-doc-zoom-wrap");
      if (zw) bindPinchZoom(zw);
    }

    panel._dkDocsCache = docs;
    panel.classList.remove("hidden");
    panel.hidden = false;
    return true;
  }

  function fecharOutros(excetoProto, excetoTipo) {
    document.querySelectorAll("[data-cliente-docs-panel]").forEach((p) => {
      const proto = String(p.getAttribute("data-cliente-docs-panel") || "");
      const tipo = String(p.getAttribute("data-cliente-docs-tipo") || "");
      if (excetoProto && proto === excetoProto && excetoTipo && tipo === excetoTipo) return;
      p.classList.add("hidden");
      p.hidden = true;
    });
    document.querySelectorAll("[data-cliente-docs-tipo]").forEach((btn) => {
      const proto = String(btn.getAttribute("data-cliente-docs-proto") || "");
      const tipo = String(btn.getAttribute("data-cliente-docs-tipo") || "");
      if (excetoProto && proto === excetoProto && excetoTipo && tipo === excetoTipo) return;
      btn.setAttribute("aria-expanded", "false");
    });
  }

  function togglePainel(proto, cpf, tipo) {
    const panel = panelEl(proto, tipo);
    const btn = btnEl(proto, tipo);
    if (!panel || !tipo) return false;
    const aberto = !panel.classList.contains("hidden");
    if (aberto) {
      panel.classList.add("hidden");
      panel.hidden = true;
      if (btn) btn.setAttribute("aria-expanded", "false");
      return true;
    }
    fecharOutros(proto, tipo);
    abrirPainel(proto, cpf, tipo);
    if (btn) btn.setAttribute("aria-expanded", "true");
    panel.scrollIntoView({ behavior: "smooth", block: "nearest" });
    return true;
  }

  function bindUi() {
    document.getElementById("cliente-contratos")?.addEventListener("click", (e) => {
      const openBtn = e.target.closest?.("[data-cliente-docs-tipo]");
      if (openBtn && openBtn.hasAttribute("data-cliente-docs-proto")) {
        e.preventDefault();
        const proto = String(openBtn.getAttribute("data-cliente-docs-proto") || "").trim();
        const tipo = String(openBtn.getAttribute("data-cliente-docs-tipo") || "").trim();
        const cpfBtn = onlyDigits(openBtn.getAttribute("data-cliente-docs-cpf")).slice(0, 11);
        const sessFn = typeof window.__DK_getClienteSessaoCpf === "function" ? window.__DK_getClienteSessaoCpf : null;
        const cpfFinal = cpfBtn || (sessFn ? sessFn() : "");
        togglePainel(proto, cpfFinal, tipo);
        return;
      }

      const docBtn = e.target.closest?.("[data-cliente-doc-idx]");
      if (docBtn) {
        const proto = String(docBtn.getAttribute("data-cliente-doc-proto") || "").trim();
        const tipo = String(docBtn.getAttribute("data-cliente-doc-tipo") || "").trim();
        const panel = panelEl(proto, tipo);
        const idx = Number(docBtn.getAttribute("data-cliente-doc-idx"));
        const docs = panel?._dkDocsCache || [];
        const doc = docs[idx];
        const viewer = panel?.querySelector("[data-cliente-docs-viewer]");
        if (!doc || !viewer) return;
        viewer.innerHTML = `<div class="cliente-doc-zoom-wrap">
          <div class="cliente-doc-zoom-toolbar" role="toolbar" aria-label="Zoom do documento">
            <button type="button" class="cliente-cal-zoom-btn" data-doc-zoom="out" aria-label="Reduzir">−</button>
            <span class="cliente-cal-zoom-label" data-doc-zoom-label>100%</span>
            <button type="button" class="cliente-cal-zoom-btn" data-doc-zoom="in" aria-label="Ampliar">+</button>
            <button type="button" class="cliente-cal-zoom-btn cliente-cal-zoom-btn--reset" data-doc-zoom="reset">Ajustar</button>
          </div>
          <p class="cliente-cal-zoom-hint">Pinça com dois dedos para ampliar e ler o documento</p>
          <div class="cliente-doc-zoom-viewport" tabindex="0">
            <div class="cliente-doc-zoom-stage">${renderViewer(doc)}</div>
          </div>
        </div>`;
        const zw = viewer.querySelector(".cliente-doc-zoom-wrap");
        if (zw) bindPinchZoom(zw);
      }
    });
  }

  window.__DK_clienteToggleDocumentosLocacao = togglePainel;
  window.__DK_clienteDocsLocacaoCount = (proto, cpf, tipo) => loadDocs(proto, cpf, tipo).length;

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bindUi);
  else bindUi();
})();
