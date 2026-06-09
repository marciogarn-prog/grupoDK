/**
 * App cliente — visualização de documentos do protocolo (com zoom).
 */
(function clienteDocumentosLocacao() {
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

  function loadDocs(proto, cpf) {
    const fn = typeof window.__DK_docsLocacaoDoProtocolo === "function" ? window.__DK_docsLocacaoDoProtocolo : null;
    if (fn) return fn(proto, cpf);
    try {
      const raw = localStorage.getItem("dk_locacao_documentos_v1");
      const all = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(all)) return [];
      const nc = normNc(proto);
      const dig = onlyDigits(cpf).slice(0, 11);
      return all.filter((d) => normNc(d.numeroContrato) === nc && onlyDigits(d.cpf).slice(0, 11) === dig);
    } catch {
      return [];
    }
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
    if (!url) return '<p class="subtext">Documento indisponível neste dispositivo.</p>';
    if (mime.includes("pdf") || url.includes("application/pdf")) {
      return `<iframe class="cliente-doc-iframe" src="${url.replace(/"/g, "&quot;")}" title="${escapeHtml(doc.nome)}"></iframe>`;
    }
    return `<img class="cliente-doc-img" src="${url.replace(/"/g, "&quot;")}" alt="${escapeHtml(doc.nome)}">`;
  }

  function abrirPainel(proto, cpf) {
    const panel = document.querySelector(`[data-cliente-docs-panel="${proto}"]`);
    if (!panel) return false;
    const lista = panel.querySelector("[data-cliente-docs-lista]");
    const viewer = panel.querySelector("[data-cliente-docs-viewer]");
    const titulo = panel.querySelector("[data-cliente-docs-titulo]");
    const docs = loadDocs(proto, cpf).sort((a, b) => Number(b.createdAt) - Number(a.createdAt));

    if (titulo) {
      titulo.textContent =
        docs.length > 0
          ? `Documentação — protocolo ${proto} (${docs.length} ficheiro(s))`
          : `Documentação — protocolo ${proto} (sem ficheiros na nuvem)`;
    }

    if (lista) {
      if (!docs.length) {
        lista.innerHTML = '<p class="subtext">Ainda não há documentos para este contrato.</p>';
      } else {
        lista.innerHTML = docs
          .map(
            (d, i) =>
              `<div class="cliente-doc-row">
                <button type="button" class="btn-primary btn-secondary-outline cliente-doc-link" data-cliente-doc-idx="${i}" data-cliente-doc-proto="${escapeHtml(proto)}">${escapeHtml(d.nome)}</button>
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

  function fecharOutros(exceto) {
    document.querySelectorAll("[data-cliente-docs-panel]").forEach((p) => {
      const proto = String(p.getAttribute("data-cliente-docs-panel") || "");
      if (exceto && proto === exceto) return;
      p.classList.add("hidden");
      p.hidden = true;
      const btn = document.querySelector(`[data-cliente-docs-proto="${proto}"]`);
      if (btn) btn.setAttribute("aria-expanded", "false");
    });
  }

  function togglePainel(proto, cpf) {
    const panel = document.querySelector(`[data-cliente-docs-panel="${proto}"]`);
    const btn = document.querySelector(`[data-cliente-docs-proto="${proto}"]`);
    if (!panel) return false;
    const aberto = !panel.classList.contains("hidden");
    if (aberto) {
      panel.classList.add("hidden");
      panel.hidden = true;
      if (btn) btn.setAttribute("aria-expanded", "false");
      return true;
    }
    fecharOutros(proto);
    abrirPainel(proto, cpf);
    if (btn) btn.setAttribute("aria-expanded", "true");
    panel.scrollIntoView({ behavior: "smooth", block: "nearest" });
    return true;
  }

  function bindUi() {
    document.getElementById("cliente-contratos")?.addEventListener("click", (e) => {
      const openBtn = e.target.closest?.("[data-cliente-docs-proto]");
      if (openBtn) {
        e.preventDefault();
        const proto = String(openBtn.getAttribute("data-cliente-docs-proto") || "").trim();
        const cpfBtn = onlyDigits(openBtn.getAttribute("data-cliente-docs-cpf")).slice(0, 11);
        const sessFn = typeof window.__DK_getClienteSessaoCpf === "function" ? window.__DK_getClienteSessaoCpf : null;
        const cpfFinal = cpfBtn || (sessFn ? sessFn() : "");
        togglePainel(proto, cpfFinal);
        return;
      }

      const docBtn = e.target.closest?.("[data-cliente-doc-idx]");
      if (docBtn) {
        const proto = String(docBtn.getAttribute("data-cliente-doc-proto") || "").trim();
        const panel = document.querySelector(`[data-cliente-docs-panel="${proto}"]`);
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
  window.__DK_clienteDocsLocacaoCount = (proto, cpf) => loadDocs(proto, cpf).length;

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bindUi);
  else bindUi();
})();
