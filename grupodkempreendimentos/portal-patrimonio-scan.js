/**
 * Recorte CRLV — só folha branca (padrão PDF), sem tecido rosa/mesa.
 * Ordem crítica: aparar fundo colorido ANTES do filtro scanner (rosa vira branco no scanner).
 */
(function portalPatrimonioScan() {
  const A4 = 210 / 297;
  const A4_OUT_W = 1240;
  const A4_OUT_H = 1754;
  const SCAN_VERSION = 4;

  function clamp01(n) {
    return Math.max(0, Math.min(1, Number(n) || 0));
  }

  function grayPx(r, g, b) {
    return 0.299 * r + 0.587 * g + 0.114 * b;
  }

  /** Rosa/tecido — inclusive JPEG com saturação baixa (R > G > B). */
  function isTecidoOuRosa(r, g, b) {
    const gray = grayPx(r, g, b);
    if (gray < 120) return false;
    if (r > g + 2 && r >= b - 1 && gray < 252) return true;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    return max - min >= 24 && gray >= 100;
  }

  function isPaperPixel(r, g, b) {
    if (isTecidoOuRosa(r, g, b)) return false;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const gray = grayPx(r, g, b);
    if (gray < 170) return false;
    if (max - min > 20) return false;
    if (Math.abs(r - g) > 6 || Math.abs(r - b) > 8) return false;
    return true;
  }

  function isColorfulBackground(r, g, b) {
    return isTecidoOuRosa(r, g, b);
  }

  function statsLinha(data, w, y, x0, x1) {
    let n = 0;
    let dark = 0;
    let rosa = 0;
    let brancoNeutro = 0;
    let sumR = 0;
    let sumG = 0;
    let sumB = 0;
    for (let x = x0; x <= x1; x++) {
      const i = (y * w + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const gray = grayPx(r, g, b);
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      n++;
      sumR += r;
      sumG += g;
      sumB += b;
      if (gray < 118) dark++;
      if (isTecidoOuRosa(r, g, b)) rosa++;
      if (gray > 243 && max - min < 12 && Math.abs(r - g) <= 7) brancoNeutro++;
    }
    return {
      darkRatio: dark / n,
      rosaRatio: rosa / n,
      brancoNeutro: brancoNeutro / n,
      tintR: sumR / n - sumG / n,
    };
  }

  /** Faixa rosa ou “branco vazio” sem texto/QR/borda do CRLV. */
  function linhaEhFundoInvalido(stats) {
    if (stats.rosaRatio > 0.003) return true;
    if (stats.tintR > 1.8 && stats.darkRatio < 0.004) return true;
    if (stats.brancoNeutro > 0.88 && stats.darkRatio < 0.0025) return true;
    return false;
  }

  function linhaTemConteudoCrlv(stats) {
    return stats.darkRatio >= 0.0035 || (stats.brancoNeutro > 0.35 && stats.darkRatio > 0.001);
  }

  /** Varre do topo: última linha de faixa inválida antes do conteúdo CRLV. */
  function detectarFaixaRosaTopo(data, w, h) {
    const x0 = Math.floor(w * 0.04);
    const x1 = Math.floor(w * 0.96);
    const maxY = Math.floor(h * 0.38);
    let ultimaInvalida = -1;
    for (let y = 0; y < maxY; y++) {
      const s = statsLinha(data, w, y, x0, x1);
      if (linhaEhFundoInvalido(s)) ultimaInvalida = y;
      else if (ultimaInvalida >= 0 && linhaTemConteudoCrlv(s)) return Math.min(maxY, ultimaInvalida + 2);
    }
    return ultimaInvalida >= 0 ? Math.min(maxY, ultimaInvalida + 2) : 0;
  }

  /** Topo = fim da faixa rosa / início do conteúdo CRLV (texto, QR, moldura). */
  function encontrarLimitesDocumentoCrlv(data, w, h) {
    const x0 = Math.floor(w * 0.03);
    const x1 = Math.floor(w * 0.97);
    let top = detectarFaixaRosaTopo(data, w, h);
    const maxTop = Math.floor(h * 0.42);

    while (top < maxTop) {
      const s = statsLinha(data, w, top, x0, x1);
      if (linhaEhFundoInvalido(s)) {
        top++;
        continue;
      }
      let ok = 0;
      for (let k = 0; k < 10; k++) {
        if (linhaTemConteudoCrlv(statsLinha(data, w, top + k, x0, x1))) ok++;
      }
      if (ok >= 7) {
        top = Math.max(0, top - 1);
        break;
      }
      top++;
    }

    let bottom = h - 1;
    const minBottom = Math.floor(h * 0.55);
    while (bottom > minBottom) {
      const s = statsLinha(data, w, bottom, x0, x1);
      if (linhaEhFundoInvalido(s) || !linhaTemConteudoCrlv(s)) bottom--;
      else break;
    }

    let left = 0;
    while (left < w - 40) {
      let dark = 0;
      let rosa = 0;
      const total = bottom - top + 1;
      for (let y = top; y <= bottom; y++) {
        const i = (y * w + left) * 4;
        if (grayPx(data[i], data[i + 1], data[i + 2]) < 118) dark++;
        if (isTecidoOuRosa(data[i], data[i + 1], data[i + 2])) rosa++;
      }
      if (rosa / total > 0.05 || (dark / total < 0.01 && left < w * 0.08)) left++;
      else break;
    }

    let right = w - 1;
    while (right > left + 40) {
      let dark = 0;
      let rosa = 0;
      const total = bottom - top + 1;
      for (let y = top; y <= bottom; y++) {
        const i = (y * w + right) * 4;
        if (grayPx(data[i], data[i + 1], data[i + 2]) < 118) dark++;
        if (isTecidoOuRosa(data[i], data[i + 1], data[i + 2])) rosa++;
      }
      if (rosa / total > 0.05 || (dark / total < 0.01 && right > w * 0.92)) right--;
      else break;
    }

    return { top, bottom, left, right };
  }

  function normalizarBox(box) {
    if (!box) return null;
    const esquerda = clamp01(box.esquerda ?? box.left ?? 0);
    const topo = clamp01(box.topo ?? box.top ?? 0);
    const direita = clamp01(box.direita ?? box.right ?? 1);
    const baixo = clamp01(box.baixo ?? box.bottom ?? 1);
    if (direita - esquerda < 0.08 || baixo - topo < 0.08) return null;
    return { esquerda, topo, direita, baixo };
  }

  function aspectoA4Score(box) {
    const w = box.direita - box.esquerda;
    const h = box.baixo - box.topo;
    if (h <= 0) return 0;
    return 1 - Math.min(1, Math.abs(w / h - A4) / A4);
  }

  function recorteOcupaQuaseTudo(box) {
    const b = normalizarBox(box);
    if (!b) return true;
    const w = b.direita - b.esquerda;
    const h = b.baixo - b.topo;
    if (aspectoA4Score(b) >= 0.62 && w <= 0.98 && h <= 0.98) return false;
    return w > 0.93 && h > 0.93;
  }

  function ratioPapelNaLinha(data, w, y, x0, x1) {
    let count = 0;
    const total = Math.max(1, x1 - x0 + 1);
    for (let x = x0; x <= x1; x++) {
      const i = (y * w + x) * 4;
      if (isPaperPixel(data[i], data[i + 1], data[i + 2])) count++;
    }
    return count / total;
  }

  function ratioColoridoNaLinha(data, w, y, x0, x1) {
    let count = 0;
    const total = Math.max(1, x1 - x0 + 1);
    for (let x = x0; x <= x1; x++) {
      const i = (y * w + x) * 4;
      if (isColorfulBackground(data[i], data[i + 1], data[i + 2])) count++;
    }
    return count / total;
  }

  function ratioPapelNaColuna(data, w, h, x, y0, y1) {
    let count = 0;
    const total = Math.max(1, y1 - y0 + 1);
    for (let y = y0; y <= y1; y++) {
      const i = (y * w + x) * 4;
      if (isPaperPixel(data[i], data[i + 1], data[i + 2])) count++;
    }
    return count / total;
  }

  function refinarRecorteDocumento(data, w, h, box) {
    const b = normalizarBox(box);
    if (!b) return box;

    let minX = Math.max(0, Math.floor(b.esquerda * w));
    let maxX = Math.min(w - 1, Math.ceil(b.direita * w));
    let minY = Math.max(0, Math.floor(b.topo * h));
    let maxY = Math.min(h - 1, Math.ceil(b.baixo * h));

    for (let y = 0; y < h - 6; y++) {
      if (ratioColoridoNaLinha(data, w, y, minX, maxX) > 0.04) continue;
      let ok = 0;
      for (let k = 0; k < 6; k++) {
        if (ratioPapelNaLinha(data, w, y + k, minX, maxX) >= 0.2) ok++;
      }
      if (ok >= 5) {
        minY = y;
        break;
      }
    }

    const limits = encontrarLimitesDocumentoCrlv(data, w, h);
    if (limits.top > minY) minY = limits.top;
    if (limits.bottom < maxY) maxY = limits.bottom;
    if (limits.left > minX) minX = limits.left;
    if (limits.right < maxX) maxX = limits.right;

    const padX = Math.round((maxX - minX) * 0.005);
    const padY = Math.round((maxY - minY) * 0.005);
    minX = Math.max(0, minX + padX);
    maxX = Math.min(w - 1, maxX - padX);
    minY = Math.max(0, minY + padY);
    maxY = Math.min(h - 1, maxY - padY);

    return {
      esquerda: minX / w,
      topo: minY / h,
      direita: (maxX + 1) / w,
      baixo: (maxY + 1) / h,
    };
  }

  function detectarFolhaBrancaEmCanvas(data, w, h) {
    let minX = w;
    let minY = h;
    let maxX = 0;
    let maxY = 0;
    let count = 0;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        if (isPaperPixel(data[i], data[i + 1], data[i + 2])) {
          count++;
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
        }
      }
    }

    if (count < w * h * 0.04) return null;
    if (maxX - minX < w * 0.15 || maxY - minY < h * 0.15) return null;

    return refinarRecorteDocumento(data, w, h, {
      esquerda: minX / w,
      topo: minY / h,
      direita: (maxX + 1) / w,
      baixo: (maxY + 1) / h,
    });
  }

  function recorteTemFaixaColoridaTopo(data, w, h, box) {
    const b = normalizarBox(box);
    if (!b) return true;
    const x0 = Math.floor(b.esquerda * w);
    const x1 = Math.ceil(b.direita * w);
    const y0 = Math.floor(b.topo * h);
    const band = Math.max(8, Math.round((b.baixo - b.topo) * h * 0.06));
    let rosa = 0;
    for (let y = y0; y < Math.min(h, y0 + band); y++) {
      rosa += ratioColoridoNaLinha(data, w, y, x0, x1);
    }
    return rosa / band > 0.03;
  }

  function recorteValido(box, data, w, h) {
    const b = normalizarBox(box);
    if (!b || recorteOcupaQuaseTudo(b)) return false;
    if (aspectoA4Score(b) < 0.48) return false;
    const area = (b.direita - b.esquerda) * (b.baixo - b.topo);
    if (area < 0.1) return false;
    if (data && w && h && recorteTemFaixaColoridaTopo(data, w, h, b)) return false;
    return true;
  }

  async function loadImage(dataUrl) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = dataUrl;
    });
  }

  /** Reduz resolução antes de processamento pesado (evita crash no telemóvel). */
  async function redimensionarParaProcessamento(dataUrl, maxLado) {
    const img = await loadImage(dataUrl).catch(() => null);
    if (!img) return dataUrl;
    const max = maxLado || 1400;
    const escala = Math.min(1, max / Math.max(img.width, img.height));
    if (escala >= 0.999) return dataUrl;
    const w = Math.max(1, Math.round(img.width * escala));
    const h = Math.max(1, Math.round(img.height * escala));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return dataUrl;
    ctx.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL("image/jpeg", 0.9);
  }

  async function recortarCanvasParaA4(canvas, sx, sy, sw, sh) {
    const out = document.createElement("canvas");
    out.width = A4_OUT_W;
    out.height = A4_OUT_H;
    const ctx = out.getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, A4_OUT_W, A4_OUT_H);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(canvas, sx, sy, sw, sh, 0, 0, A4_OUT_W, A4_OUT_H);
    return out;
  }

  async function recortarParaA4(dataUrl, recorte) {
    const box = normalizarBox(recorte) || { esquerda: 0.04, topo: 0.04, direita: 0.96, baixo: 0.96 };
    const img = await loadImage(dataUrl).catch(() => null);
    if (!img) return dataUrl;

    const sx = Math.round(box.esquerda * img.width);
    const sy = Math.round(box.topo * img.height);
    const sw = Math.max(10, Math.round((box.direita - box.esquerda) * img.width));
    const sh = Math.max(10, Math.round((box.baixo - box.topo) * img.height));

    const canvas = document.createElement("canvas");
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return dataUrl;
    ctx.drawImage(img, 0, 0);
    const out = await recortarCanvasParaA4(canvas, sx, sy, sw, sh);
    return out ? out.toDataURL("image/jpeg", 0.96) : dataUrl;
  }

  /** Apara margens na imagem em CORES (antes do scanner). */
  async function apararMargensColoridas(dataUrl) {
    const img = await loadImage(dataUrl).catch(() => null);
    if (!img) return dataUrl;

    const canvas = document.createElement("canvas");
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return dataUrl;
    ctx.drawImage(img, 0, 0);
    const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const lim = encontrarLimitesDocumentoCrlv(data, width, height);

    const cw = lim.right - lim.left + 1;
    const ch = lim.bottom - lim.top + 1;
    if (cw < width * 0.45 || ch < height * 0.45) return dataUrl;
    if (lim.top < 3 && lim.left < 3 && lim.right > width - 4 && lim.bottom > height - 4) return dataUrl;

    const out = await recortarCanvasParaA4(canvas, lim.left, lim.top, cw, ch);
    return out ? out.toDataURL("image/jpeg", 0.96) : dataUrl;
  }

  /** Retoca imagem já guardada (mesmo pós-scanner): detecta início pelo conteúdo CRLV. */
  async function retocarImagemArmazenada(dataUrl) {
    const img = await loadImage(dataUrl).catch(() => null);
    if (!img) return dataUrl;

    const canvas = document.createElement("canvas");
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return dataUrl;
    ctx.drawImage(img, 0, 0);
    const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const lim = encontrarLimitesDocumentoCrlv(data, width, height);

    const cw = lim.right - lim.left + 1;
    const ch = lim.bottom - lim.top + 1;
    if (cw < width * 0.5 || ch < height * 0.5) {
      return aplicarFiltroScanner(dataUrl);
    }

    const out = await recortarCanvasParaA4(canvas, lim.left, lim.top, cw, ch);
    if (!out) return dataUrl;
    return aplicarFiltroScanner(out.toDataURL("image/jpeg", 0.96));
  }

  async function aplicarFiltroScanner(dataUrl) {
    const img = await loadImage(dataUrl).catch(() => null);
    if (!img) return dataUrl;
    const canvas = document.createElement("canvas");
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return dataUrl;
    ctx.drawImage(img, 0, 0);
    const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);

    for (let i = 0; i < data.length; i += 4) {
      let g = grayPx(data[i], data[i + 1], data[i + 2]);
      g = (g - 128) * 1.55 + 128;
      if (g >= 192) g = 255;
      else if (g <= 108) g = Math.max(0, g * 0.55);
      else g = Math.max(0, Math.min(255, (g - 108) * (255 / 84)));
      data[i] = data[i + 1] = data[i + 2] = g;
    }
    ctx.putImageData({ data, width, height }, 0, 0);

    const sharp = ctx.getImageData(0, 0, width, height);
    const s = sharp.data;
    const outPx = new Uint8ClampedArray(s);
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const i = (y * width + x) * 4;
        const c = s[i];
        const lap =
          -s[((y - 1) * width + x) * 4] -
          s[(y * width + (x - 1)) * 4] +
          4 * c -
          s[(y * width + (x + 1)) * 4] -
          s[((y + 1) * width + x) * 4];
        const v = Math.max(0, Math.min(255, c + lap * 0.35));
        outPx[i] = outPx[i + 1] = outPx[i + 2] = v;
      }
    }
    ctx.putImageData(new ImageData(outPx, width, height), 0, 0);
    return canvas.toDataURL("image/jpeg", 0.94);
  }

  async function analisarImagem(dataUrl) {
    const img = await loadImage(dataUrl).catch(() => null);
    if (!img) return null;
    const maxSide = 1200;
    let w = img.width;
    let h = img.height;
    const scale = Math.min(1, maxSide / Math.max(w, h));
    w = Math.max(1, Math.round(w * scale));
    h = Math.max(1, Math.round(h * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, w, h);
    const { data } = ctx.getImageData(0, 0, w, h);
    return { data, w, h };
  }

  async function detectarFolhaBranca(dataUrl) {
    const analise = await analisarImagem(dataUrl);
    if (!analise) return null;
    return detectarFolhaBrancaEmCanvas(analise.data, analise.w, analise.h);
  }

  async function chamarIaRecorte(dataUrl) {
    const m = String(dataUrl || "").match(/^data:([^;]+);base64,(.+)$/);
    if (!m) return null;
    const prompt = `CRLV-e folha A4 branca sobre tecido rosa/mesa. Caixa EXATA só da folha branca — zero rosa acima. JSON: {"recorte":{"esquerda":0,"topo":0,"direita":1,"baixo":1}}`;
    try {
      const res = await fetch("/api/openai-comprovante", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: `data:${m[1]};base64,${m[2]}`, detail: "high" } },
          ],
          tipo: "crlv",
          max_tokens: 256,
        }),
      });
      const data = await res.json();
      if (res.ok && data.ok && data.parsed) {
        return normalizarBox(data.parsed.recorte || data.parsed.crop || data.parsed);
      }
    } catch {
      /* ignore */
    }
    return null;
  }

  async function tratarDocumentoCrlv(dataUrl, opts) {
    const usarIa = opts?.usarIa !== false;
    const retocar = opts?.retocarArmazenada === true;
    try {
      if (retocar) {
        const entrada = await redimensionarParaProcessamento(dataUrl, 1400);
        const imagem = await retocarImagemArmazenada(entrada);
        return { ok: true, imagem, box: null, scanVersion: SCAN_VERSION };
      }

      const base = await redimensionarParaProcessamento(dataUrl, 1400);
      const analise = await analisarImagem(base);
      let box = analise ? detectarFolhaBrancaEmCanvas(analise.data, analise.w, analise.h) : await detectarFolhaBranca(base);
      const localOk = box && recorteValido(box, analise?.data, analise?.w, analise?.h);

      if (!localOk && usarIa) {
        const ia = await chamarIaRecorte(base);
        if (ia) {
          box = analise ? refinarRecorteDocumento(analise.data, analise.w, analise.h, ia) : ia;
        }
      }

      if (!box || !recorteValido(box, analise?.data, analise?.w, analise?.h)) {
        if (box && analise) box = refinarRecorteDocumento(analise.data, analise.w, analise.h, box);
        if (!box || recorteOcupaQuaseTudo(box)) {
          box = { esquerda: 0.06, topo: 0.14, direita: 0.94, baixo: 0.98 };
        }
      }

      let imagem = await recortarParaA4(base, box);
      imagem = await apararMargensColoridas(imagem);
      imagem = await aplicarFiltroScanner(imagem);
      return { ok: true, imagem, box, scanVersion: SCAN_VERSION };
    } catch (e) {
      return { ok: false, imagem: dataUrl, box: null, msg: String(e?.message || e) };
    }
  }

  window.__DK_patrimonioTratarDocumento = tratarDocumentoCrlv;
  window.__DK_patrimonioRetocarImagem = retocarImagemArmazenada;
  window.__DK_patrimonioDetectarFolha = detectarFolhaBranca;
  window.__DK_patrimonioApararMargens = apararMargensColoridas;
  window.__DK_patrimonioAplicarScanner = aplicarFiltroScanner;
  window.__DK_patrimonioScanVersion = SCAN_VERSION;
})();
