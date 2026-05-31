/**
 * Recorte automático da folha A4 + filtro scanner nítido (estilo CamScanner).
 * Saída: só o CRLV branco, sem tecido/mesa (ex.: faixa rosa no topo).
 */
(function portalPatrimonioScan() {
  const A4 = 210 / 297;
  const A4_OUT_W = 1240;
  const A4_OUT_H = 1754;
  const SCAN_VERSION = 3;

  function clamp01(n) {
    return Math.max(0, Math.min(1, Number(n) || 0));
  }

  function isPinkOuSaturado(r, g, b) {
    if (r > g + 10 && r > b + 6) return true;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    return max - min >= 28;
  }

  /** Papel branco neutro — rejeita rosa, vermelho e outros fundos. */
  function isPaperPixel(r, g, b) {
    if (isPinkOuSaturado(r, g, b)) return false;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const gray = 0.299 * r + 0.587 * g + 0.114 * b;
    if (gray < 168) return false;
    if (max - min > 22) return false;
    if (min < 152) return false;
    return true;
  }

  function isColorfulBackground(r, g, b) {
    if (isPinkOuSaturado(r, g, b)) return true;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const gray = 0.299 * r + 0.587 * g + 0.114 * b;
    return gray >= 85 && max - min >= 26;
  }

  /** Após filtro scanner: branco puro ou texto escuro = conteúdo do documento. */
  function isConteudoDocumentoPixel(r, g, b) {
    const gray = 0.299 * r + 0.587 * g + 0.114 * b;
    if (isPinkOuSaturado(r, g, b)) return false;
    if (gray >= 235) return true;
    if (gray <= 95) return true;
    return false;
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

  function recorteOcupaQuaseTudo(box) {
    const b = normalizarBox(box);
    if (!b) return true;
    const w = b.direita - b.esquerda;
    const h = b.baixo - b.topo;
    if (aspectoA4Score(b) >= 0.62 && w <= 0.98 && h <= 0.98) return false;
    return w > 0.93 && h > 0.93;
  }

  function aspectoA4Score(box) {
    const w = box.direita - box.esquerda;
    const h = box.baixo - box.topo;
    if (h <= 0) return 0;
    const aspect = w / h;
    return 1 - Math.min(1, Math.abs(aspect - A4) / A4);
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

  function ratioConteudoNaLinha(data, w, y, x0, x1) {
    let count = 0;
    const total = Math.max(1, x1 - x0 + 1);
    for (let x = x0; x <= x1; x++) {
      const i = (y * w + x) * 4;
      if (isConteudoDocumentoPixel(data[i], data[i + 1], data[i + 2])) count++;
    }
    return count / total;
  }

  function ratioConteudoNaColuna(data, w, h, x, y0, y1) {
    let count = 0;
    const total = Math.max(1, y1 - y0 + 1);
    for (let y = y0; y <= y1; y++) {
      const i = (y * w + x) * 4;
      if (isConteudoDocumentoPixel(data[i], data[i + 1], data[i + 2])) count++;
    }
    return count / total;
  }

  /** Topo do documento: primeira linha com papel sem faixa rosa acima. */
  function refinarRecorteDocumento(data, w, h, box) {
    const b = normalizarBox(box);
    if (!b) return box;

    let minX = Math.max(0, Math.floor(b.esquerda * w));
    let maxX = Math.min(w - 1, Math.ceil(b.direita * w));
    let minY = Math.max(0, Math.floor(b.topo * h));
    let maxY = Math.min(h - 1, Math.ceil(b.baixo * h));

    const rowMin = 0.22;
    const rowStrong = 0.38;

    for (let y = 0; y < h - 6; y++) {
      if (ratioColoridoNaLinha(data, w, y, minX, maxX) > 0.06) continue;
      let ok = 0;
      for (let k = 0; k < 6; k++) {
        const yy = y + k;
        if (ratioColoridoNaLinha(data, w, yy, minX, maxX) > 0.05) break;
        if (ratioPapelNaLinha(data, w, yy, minX, maxX) >= rowMin) ok++;
      }
      if (ok >= 5) {
        minY = y;
        break;
      }
    }

    for (let y = h - 1; y >= 5; y--) {
      if (ratioColoridoNaLinha(data, w, y, minX, maxX) > 0.06) continue;
      let ok = 0;
      for (let k = 0; k < 5; k++) {
        const yy = y - k;
        if (ratioPapelNaLinha(data, w, yy, minX, maxX) >= rowMin) ok++;
      }
      if (ok >= 4) {
        maxY = y;
        break;
      }
    }

    const colMin = 0.2;
    for (let x = 0; x < w - 4; x++) {
      const c0 = ratioPapelNaColuna(data, w, h, x, minY, maxY);
      const c1 = ratioPapelNaColuna(data, w, h, x + 1, minY, maxY);
      const c2 = ratioPapelNaColuna(data, w, h, x + 2, minY, maxY);
      if (c0 >= colMin && c1 >= colMin && c2 >= colMin) {
        minX = x;
        break;
      }
    }

    for (let x = w - 1; x >= 3; x--) {
      const c0 = ratioPapelNaColuna(data, w, h, x, minY, maxY);
      const c1 = ratioPapelNaColuna(data, w, h, x - 1, minY, maxY);
      const c2 = ratioPapelNaColuna(data, w, h, x - 2, minY, maxY);
      if (c0 >= colMin && c1 >= colMin && c2 >= colMin) {
        maxX = x;
        break;
      }
    }

    const padX = Math.round((maxX - minX) * 0.006);
    const padY = Math.round((maxY - minY) * 0.006);
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

  function ratioPapelNaColuna(data, w, h, x, y0, y1) {
    let count = 0;
    const total = Math.max(1, y1 - y0 + 1);
    for (let y = y0; y <= y1; y++) {
      const i = (y * w + x) * 4;
      if (isPaperPixel(data[i], data[i + 1], data[i + 2])) count++;
    }
    return count / total;
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
    const bw = maxX - minX + 1;
    const bh = maxY - minY + 1;
    if (bw < w * 0.15 || bh < h * 0.15) return null;

    const rough = {
      esquerda: minX / w,
      topo: minY / h,
      direita: (maxX + 1) / w,
      baixo: (maxY + 1) / h,
    };
    return refinarRecorteDocumento(data, w, h, rough);
  }

  function recorteTemFaixaColoridaTopo(data, w, h, box) {
    const b = normalizarBox(box);
    if (!b) return true;
    const x0 = Math.floor(b.esquerda * w);
    const x1 = Math.ceil(b.direita * w);
    const y0 = Math.floor(b.topo * h);
    const band = Math.max(6, Math.round((b.baixo - b.topo) * h * 0.05));
    let colorful = 0;
    let total = 0;
    for (let y = y0; y < Math.min(h, y0 + band); y++) {
      colorful += ratioColoridoNaLinha(data, w, y, x0, x1);
      total++;
    }
    return total > 0 && colorful / total > 0.05;
  }

  function recorteValido(box, data, w, h) {
    const b = normalizarBox(box);
    if (!b || recorteOcupaQuaseTudo(b)) return false;
    if (aspectoA4Score(b) < 0.5) return false;
    const area = (b.direita - b.esquerda) * (b.baixo - b.topo);
    if (area < 0.12) return false;
    if (area > 0.98 && aspectoA4Score(b) < 0.55) return false;
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

  async function recortarParaA4(dataUrl, recorte) {
    const box = normalizarBox(recorte) || { esquerda: 0.04, topo: 0.04, direita: 0.96, baixo: 0.96 };
    const img = await loadImage(dataUrl).catch(() => null);
    if (!img) return dataUrl;

    const sx = Math.round(box.esquerda * img.width);
    const sy = Math.round(box.topo * img.height);
    const sw = Math.max(10, Math.round((box.direita - box.esquerda) * img.width));
    const sh = Math.max(10, Math.round((box.baixo - box.topo) * img.height));

    const canvas = document.createElement("canvas");
    canvas.width = A4_OUT_W;
    canvas.height = A4_OUT_H;
    const ctx = canvas.getContext("2d");
    if (!ctx) return dataUrl;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, A4_OUT_W, A4_OUT_H);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, A4_OUT_W, A4_OUT_H);
    return canvas.toDataURL("image/jpeg", 0.96);
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
      let g = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      g = (g - 128) * 1.55 + 128;
      if (g >= 192) g = 255;
      else if (g <= 108) g = Math.max(0, g * 0.55);
      else g = Math.max(0, Math.min(255, (g - 108) * (255 / 84)));
      data[i] = data[i + 1] = data[i + 2] = g;
    }
    ctx.putImageData({ data, width, height }, 0, 0);

    const sharp = ctx.getImageData(0, 0, width, height);
    const s = sharp.data;
    const out = new Uint8ClampedArray(s);
    const w = width;
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const i = (y * w + x) * 4;
        const c = s[i];
        const lap =
          -s[((y - 1) * w + x) * 4] -
          s[(y * w + (x - 1)) * 4] +
          4 * c -
          s[(y * w + (x + 1)) * 4] -
          s[((y + 1) * w + x) * 4];
        const v = Math.max(0, Math.min(255, c + lap * 0.35));
        out[i] = out[i + 1] = out[i + 2] = v;
      }
    }
    ctx.putImageData(new ImageData(out, width, height), 0, 0);
    return canvas.toDataURL("image/jpeg", 0.94);
  }

  /** Remove faixas rosa/mesa ainda visíveis após recorte (imagem já em A4). */
  async function apararMargensSemDocumento(dataUrl) {
    const img = await loadImage(dataUrl).catch(() => null);
    if (!img) return dataUrl;

    const canvas = document.createElement("canvas");
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return dataUrl;
    ctx.drawImage(img, 0, 0);
    const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);

    let top = 0;
    let bottom = height - 1;
    let left = 0;
    let right = width - 1;

    function linhaValida(y) {
      if (ratioColoridoNaLinha(data, width, y, 0, width - 1) > 0.04) return false;
      return ratioConteudoNaLinha(data, width, y, 0, width - 1) >= 0.52;
    }

    function colunaValida(x) {
      return ratioConteudoNaColuna(data, width, height, x, top, bottom) >= 0.48;
    }

    while (top < bottom - 20 && !linhaValida(top)) top++;
    while (bottom > top + 20 && !linhaValida(bottom)) bottom--;
    while (left < right - 20 && !colunaValida(left)) left++;
    while (right > left + 20 && !colunaValida(right)) right--;

    const cw = right - left + 1;
    const ch = bottom - top + 1;
    if (cw < width * 0.55 || ch < height * 0.55) return dataUrl;

    const out = document.createElement("canvas");
    out.width = A4_OUT_W;
    out.height = A4_OUT_H;
    const octx = out.getContext("2d");
    if (!octx) return dataUrl;
    octx.fillStyle = "#ffffff";
    octx.fillRect(0, 0, A4_OUT_W, A4_OUT_H);
    octx.imageSmoothingEnabled = true;
    octx.imageSmoothingQuality = "high";
    octx.drawImage(canvas, left, top, cw, ch, 0, 0, A4_OUT_W, A4_OUT_H);
    return out.toDataURL("image/jpeg", 0.95);
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
    const prompt = `Foto de CRLV-e (folha A4 branca com moldura preta) sobre fundo colorido (tecido rosa, mesa, etc.).

Detecte a caixa EXATA da folha branca — só o retângulo do CRLV, estilo scan CamScanner/PDF. ZERO fundo rosa/vermelho/azul acima ou ao redor.

JSON apenas:
{"recorte":{"esquerda":0.0,"topo":0.0,"direita":1.0,"baixo":1.0}}`;
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
    const soAparar = opts?.soAparar === true;
    try {
      if (soAparar) {
        let imagem = await aplicarFiltroScanner(dataUrl);
        imagem = await apararMargensSemDocumento(imagem);
        return { ok: true, imagem, box: null, scanVersion: SCAN_VERSION };
      }

      const analise = await analisarImagem(dataUrl);
      let box = analise ? detectarFolhaBrancaEmCanvas(analise.data, analise.w, analise.h) : await detectarFolhaBranca(dataUrl);

      const localOk = box && recorteValido(box, analise?.data, analise?.w, analise?.h);

      if (!localOk && usarIa) {
        const ia = await chamarIaRecorte(dataUrl);
        if (ia) {
          box = analise ? refinarRecorteDocumento(analise.data, analise.w, analise.h, ia) : ia;
        }
      }

      if (!box || !recorteValido(box, analise?.data, analise?.w, analise?.h)) {
        if (box && analise) {
          box = refinarRecorteDocumento(analise.data, analise.w, analise.h, box);
        }
        if (!box || recorteOcupaQuaseTudo(box)) {
          box = { esquerda: 0.06, topo: 0.12, direita: 0.94, baixo: 0.98 };
        }
      }

      let imagem = await recortarParaA4(dataUrl, box);
      imagem = await aplicarFiltroScanner(imagem);
      imagem = await apararMargensSemDocumento(imagem);
      return { ok: true, imagem, box, scanVersion: SCAN_VERSION };
    } catch (e) {
      return { ok: false, imagem: dataUrl, box: null, msg: String(e?.message || e) };
    }
  }

  window.__DK_patrimonioTratarDocumento = tratarDocumentoCrlv;
  window.__DK_patrimonioDetectarFolha = detectarFolhaBranca;
  window.__DK_patrimonioScanVersion = SCAN_VERSION;
})();
