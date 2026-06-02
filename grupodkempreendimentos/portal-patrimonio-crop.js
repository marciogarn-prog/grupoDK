/**
 * Recorte CRLV por 4 cantos + zoom (roda do rato / pinça).
 */
(function portalPatrimonioCrop() {
  const A4_OUT_W = 1240;
  const A4_OUT_H = 1754;

  function clamp01(n) {
    return Math.max(0, Math.min(1, Number(n) || 0));
  }

  function loadImage(dataUrl) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = dataUrl;
    });
  }

  function boxParaCantos(box) {
    const b = box || { esquerda: 0.06, topo: 0.06, direita: 0.94, baixo: 0.94 };
    let l = clamp01(b.esquerda ?? b.left ?? 0.06);
    let t = clamp01(b.topo ?? b.top ?? 0.06);
    let r = clamp01(b.direita ?? b.right ?? 0.94);
    let bo = clamp01(b.baixo ?? b.bottom ?? 0.94);
    if (l > r) {
      const tmp = l;
      l = r;
      r = tmp;
    }
    if (t > bo) {
      const tmp = t;
      t = bo;
      bo = tmp;
    }
    return ordenarCantosCrlv({
      tl: { x: l, y: t },
      tr: { x: r, y: t },
      br: { x: r, y: bo },
      bl: { x: l, y: bo },
    });
  }

  /** Evita recorte espelhado quando detecção inverte esquerda/direita. */
  function ordenarCantosCrlv(c) {
    const n = c?.tl && c?.tr && c?.br && c?.bl ? c : cantosPadrao();
    let { tl, tr, br, bl } = n;
    if (tl.x > tr.x) {
      const a = tl;
      tl = tr;
      tr = a;
      const b = bl;
      bl = br;
      br = b;
    }
    if (tl.y > bl.y) {
      const a = tl;
      tl = bl;
      bl = a;
      const b = tr;
      tr = br;
      br = b;
    }
    return {
      tl: { x: clamp01(tl.x), y: clamp01(tl.y) },
      tr: { x: clamp01(tr.x), y: clamp01(tr.y) },
      br: { x: clamp01(br.x), y: clamp01(br.y) },
      bl: { x: clamp01(bl.x), y: clamp01(bl.y) },
    };
  }

  function cantosPadrao() {
    return boxParaCantos({ esquerda: 0.06, topo: 0.08, direita: 0.94, baixo: 0.98 });
  }

  function normalizarCantos(c) {
    if (!c) return cantosPadrao();
    if (c.tl && c.tr && c.br && c.bl) {
      return ordenarCantosCrlv({
        tl: { x: clamp01(c.tl.x), y: clamp01(c.tl.y) },
        tr: { x: clamp01(c.tr.x), y: clamp01(c.tr.y) },
        br: { x: clamp01(c.br.x), y: clamp01(c.br.y) },
        bl: { x: clamp01(c.bl.x), y: clamp01(c.bl.y) },
      });
    }
    return boxParaCantos(c);
  }

  function drawImageTriangle(ctx, img, sx0, sy0, sx1, sy1, sx2, sy2, dx0, dy0, dx1, dy1, dx2, dy2) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(dx0, dy0);
    ctx.lineTo(dx1, dy1);
    ctx.lineTo(dx2, dy2);
    ctx.closePath();
    ctx.clip();
    const denom = sx0 * (sy1 - sy2) + sx1 * (sy2 - sy0) + sx2 * (sy0 - sy1);
    if (Math.abs(denom) < 1e-6) {
      ctx.restore();
      return;
    }
    const m11 = (dx0 * (sy1 - sy2) + dx1 * (sy2 - sy0) + dx2 * (sy0 - sy1)) / denom;
    const m12 = (dx0 * (sx2 - sx1) + dx1 * (sx0 - sx2) + dx2 * (sx1 - sx0)) / denom;
    const m21 = (dy0 * (sy1 - sy2) + dy1 * (sy2 - sy0) + dy2 * (sy0 - sy1)) / denom;
    const m22 = (dy0 * (sx2 - sx1) + dy1 * (sx0 - sx2) + dy2 * (sx1 - sx0)) / denom;
    const dx = (dx0 * (sx1 * sy2 - sx2 * sy1) + dx1 * (sx2 * sy0 - sx0 * sy2) + dx2 * (sx0 * sy1 - sx1 * sy0)) / denom;
    const dy = (dy0 * (sx1 * sy2 - sx2 * sy1) + dy1 * (sx2 * sy0 - sx0 * sy2) + dy2 * (sx0 * sy1 - sx1 * sy0)) / denom;
    ctx.transform(m11, m21, m12, m22, dx, dy);
    ctx.drawImage(img, 0, 0);
    ctx.restore();
  }

  function patrimonioMobileLeve() {
    return (
      /Android|iPhone|iPad|Mobile/i.test(String(navigator.userAgent || "")) ||
      (navigator.maxTouchPoints && navigator.maxTouchPoints > 1)
    );
  }

  async function recortarPorCantos(dataUrl, cantos, outW, outH) {
    const c = normalizarCantos(cantos);
    const img = await loadImage(dataUrl).catch(() => null);
    if (!img) return dataUrl;

    const mob = patrimonioMobileLeve();
    const W = outW || (mob ? 1000 : A4_OUT_W);
    const H = outH || (mob ? 1414 : A4_OUT_H);
    const iw = img.width;
    const ih = img.height;
    const tl = { x: c.tl.x * iw, y: c.tl.y * ih };
    const tr = { x: c.tr.x * iw, y: c.tr.y * ih };
    const br = { x: c.br.x * iw, y: c.br.y * ih };
    const bl = { x: c.bl.x * iw, y: c.bl.y * ih };

    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");
    if (!ctx) return dataUrl;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, W, H);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    drawImageTriangle(ctx, img, tl.x, tl.y, tr.x, tr.y, br.x, br.y, 0, 0, W, 0, W, H);
    drawImageTriangle(ctx, img, tl.x, tl.y, br.x, br.y, bl.x, bl.y, 0, 0, W, H, 0, H);
    return canvas.toDataURL("image/jpeg", mob ? 0.9 : 0.96);
  }

  async function detectarCantosFolha(dataUrl) {
    if (typeof window.__DK_patrimonioDetectarFolha === "function") {
      const box = await window.__DK_patrimonioDetectarFolha(dataUrl);
      if (box) return boxParaCantos(box);
    }
    return cantosPadrao();
  }

  /** Zoom + pan em contentor com imagem (PC: roda do rato; telemóvel: pinça e arrastar). */
  function bindZoomPan(viewportEl, innerEl, opts) {
    if (!viewportEl || !innerEl) return () => {};

    let scale = 1;
    let panX = 0;
    let panY = 0;
    let pinching = false;
    let pinchDist0 = 0;
    let pinchScale0 = 1;
    let panning = false;
    let panStartX = 0;
    let panStartY = 0;
    let pan0X = 0;
    let pan0Y = 0;

    const minScale = opts?.minScale ?? 0.35;
    const maxScale = opts?.maxScale ?? 6;

    function aplicarTransform() {
      innerEl.style.transform = `translate(${panX}px, ${panY}px) scale(${scale})`;
    }

    function zoomAt(clientX, clientY, factor) {
      const rect = viewportEl.getBoundingClientRect();
      const cx = clientX - rect.left;
      const cy = clientY - rect.top;
      const newScale = Math.max(minScale, Math.min(maxScale, scale * factor));
      const ratio = newScale / scale;
      panX = cx - (cx - panX) * ratio;
      panY = cy - (cy - panY) * ratio;
      scale = newScale;
      aplicarTransform();
    }

    function onWheel(e) {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
      zoomAt(e.clientX, e.clientY, factor);
    }

    function touchDist(touches) {
      const dx = touches[0].clientX - touches[1].clientX;
      const dy = touches[0].clientY - touches[1].clientY;
      return Math.hypot(dx, dy);
    }

    function onTouchStart(e) {
      if (e.touches.length === 2) {
        pinching = true;
        pinchDist0 = touchDist(e.touches);
        pinchScale0 = scale;
        e.preventDefault();
      } else if (e.touches.length === 1 && !e.target.closest?.("[data-canto]")) {
        panning = true;
        panStartX = e.touches[0].clientX;
        panStartY = e.touches[0].clientY;
        pan0X = panX;
        pan0Y = panY;
      }
    }

    function onTouchMove(e) {
      if (pinching && e.touches.length >= 2) {
        const d = touchDist(e.touches);
        if (pinchDist0 > 0) {
          const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
          const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
          const newScale = Math.max(minScale, Math.min(maxScale, pinchScale0 * (d / pinchDist0)));
          const ratio = newScale / scale;
          panX = midX - viewportEl.getBoundingClientRect().left - (midX - viewportEl.getBoundingClientRect().left - panX) * ratio;
          panY = midY - viewportEl.getBoundingClientRect().top - (midY - viewportEl.getBoundingClientRect().top - panY) * ratio;
          scale = newScale;
          aplicarTransform();
        }
        e.preventDefault();
      } else if (panning && e.touches.length === 1) {
        panX = pan0X + (e.touches[0].clientX - panStartX);
        panY = pan0Y + (e.touches[0].clientY - panStartY);
        aplicarTransform();
        e.preventDefault();
      }
    }

    function onTouchEnd() {
      pinching = false;
      panning = false;
    }

    function onPointerDown(e) {
      if (e.button !== 0 || e.target.closest?.("[data-canto]")) return;
      if (e.pointerType === "mouse" && e.buttons !== 1) return;
      panning = true;
      panStartX = e.clientX;
      panStartY = e.clientY;
      pan0X = panX;
      pan0Y = panY;
      try {
        viewportEl.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    }

    function onPointerMove(e) {
      if (!panning) return;
      panX = pan0X + (e.clientX - panStartX);
      panY = pan0Y + (e.clientY - panStartY);
      aplicarTransform();
    }

    function onPointerUp() {
      panning = false;
    }

    viewportEl.addEventListener("wheel", onWheel, { passive: false });
    viewportEl.addEventListener("touchstart", onTouchStart, { passive: false });
    viewportEl.addEventListener("touchmove", onTouchMove, { passive: false });
    viewportEl.addEventListener("touchend", onTouchEnd);
    viewportEl.addEventListener("touchcancel", onTouchEnd);
    viewportEl.addEventListener("pointerdown", onPointerDown);
    viewportEl.addEventListener("pointermove", onPointerMove);
    viewportEl.addEventListener("pointerup", onPointerUp);
    viewportEl.addEventListener("pointercancel", onPointerUp);

    aplicarTransform();

    return function resetZoom() {
      scale = 1;
      panX = 0;
      panY = 0;
      aplicarTransform();
    };
  }

  let cropState = null;
  let unbindZoom = null;

  function atualizarOverlaySvg() {
    if (!cropState) return;
    const { cantos, polygon, quad, handles } = cropState;
    const pts = `${cantos.tl.x * 100},${cantos.tl.y * 100} ${cantos.tr.x * 100},${cantos.tr.y * 100} ${cantos.br.x * 100},${cantos.br.y * 100} ${cantos.bl.x * 100},${cantos.bl.y * 100}`;
    if (polygon) polygon.setAttribute("points", pts);
    if (quad) quad.setAttribute("points", pts);
    const map = { tl: cantos.tl, tr: cantos.tr, br: cantos.br, bl: cantos.bl };
    handles.forEach((h) => {
      const k = h.getAttribute("data-canto");
      const p = map[k];
      if (p) {
        h.style.left = `${p.x * 100}%`;
        h.style.top = `${p.y * 100}%`;
      }
    });
  }

  function iniciarArrasteCanto(handle, key) {
    return (e) => {
      e.preventDefault();
      e.stopPropagation();
      const img = cropState?.imgEl;
      if (!img || !cropState) return;
      const move = (ev) => {
        const clientX = ev.touches ? ev.touches[0].clientX : ev.clientX;
        const clientY = ev.touches ? ev.touches[0].clientY : ev.clientY;
        const rect = img.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        cropState.cantos[key] = {
          x: clamp01((clientX - rect.left) / rect.width),
          y: clamp01((clientY - rect.top) / rect.height),
        };
        atualizarOverlaySvg();
        cropState.onChange?.(cropState.cantos);
      };
      const up = () => {
        document.removeEventListener("mousemove", move);
        document.removeEventListener("mouseup", up);
        document.removeEventListener("touchmove", move);
        document.removeEventListener("touchend", up);
      };
      document.addEventListener("mousemove", move);
      document.addEventListener("mouseup", up);
      document.addEventListener("touchmove", move, { passive: false });
      document.addEventListener("touchend", up);
      move(e);
    };
  }

  async function abrirEditorCantos(dataUrl, opts) {
    const stage = document.getElementById("patrimonioCropStage");
    const viewport = document.getElementById("patrimonioCropViewport");
    const inner = document.getElementById("patrimonioCropInner");
    const imgEl = document.getElementById("patrimonioCropImg");
    const previewImg = document.getElementById("patrimonioPreviewImg");
    if (!stage || !viewport || !inner || !imgEl) return null;

    if (previewImg) previewImg.classList.add("hidden");
    stage.classList.remove("hidden");

    imgEl.src = dataUrl;
    await new Promise((resolve, reject) => {
      if (imgEl.complete) resolve();
      else {
        imgEl.onload = () => resolve();
        imgEl.onerror = reject;
      }
    });

    const cantos = normalizarCantos(opts?.cantos || (await detectarCantosFolha(dataUrl)));
    const polygon = document.getElementById("patrimonioCropPolygon");
    const quad = document.getElementById("patrimonioCropQuad");
    const handles = Array.from(stage.querySelectorAll(".patrimonio-crop-handle"));

    cropState = {
      dataUrl,
      imgEl,
      cantos,
      polygon,
      quad,
      handles,
      onChange: opts?.onChange,
    };

    handles.forEach((h) => {
      const key = h.getAttribute("data-canto");
      h.onmousedown = iniciarArrasteCanto(h, key);
      h.ontouchstart = iniciarArrasteCanto(h, key);
    });

    atualizarOverlaySvg();

    if (unbindZoom) unbindZoom();
    unbindZoom = bindZoomPan(viewport, inner, {});

    return cantos;
  }

  function fecharEditorCantos() {
    const stage = document.getElementById("patrimonioCropStage");
    const previewImg = document.getElementById("patrimonioPreviewImg");
    stage?.classList.add("hidden");
    previewImg?.classList.remove("hidden");
    cropState = null;
    if (unbindZoom) {
      unbindZoom();
      unbindZoom = null;
    }
  }

  function getCantosAtuais() {
    return cropState ? normalizarCantos(cropState.cantos) : null;
  }

  async function aplicarRecorteCantos(dataUrl, cantos) {
    const mob = patrimonioMobileLeve();
    let img = await recortarPorCantos(dataUrl, cantos);
    if (!mob && typeof window.__DK_patrimonioApararMargens === "function") {
      img = await window.__DK_patrimonioApararMargens(img);
    }
    if (typeof window.__DK_patrimonioAplicarScanner === "function" && !mob) {
      img = await window.__DK_patrimonioAplicarScanner(img);
    }
    return img;
  }

  window.__DK_patrimonioDetectarCantos = detectarCantosFolha;
  window.__DK_patrimonioRecortarPorCantos = recortarPorCantos;
  window.__DK_patrimonioCropUi = {
    abrir: abrirEditorCantos,
    fechar: fecharEditorCantos,
    getCantos: getCantosAtuais,
    aplicarRecorte: aplicarRecorteCantos,
    bindZoomPan,
  };
})();
