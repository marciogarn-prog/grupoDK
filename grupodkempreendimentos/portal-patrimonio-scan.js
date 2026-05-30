/**
 * Recorte automático da folha A4 + filtro scanner nítido (estilo CamScanner).
 */
(function portalPatrimonioScan() {
  const A4 = 210 / 297;
  const A4_OUT_W = 1240;
  const A4_OUT_H = 1754;

  function clamp01(n) {
    return Math.max(0, Math.min(1, Number(n) || 0));
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
    return w > 0.9 && h > 0.9;
  }

  function escolherMelhorBox(candidatos) {
    let best = null;
    let bestScore = 0;
    for (const raw of candidatos) {
      const box = normalizarBox(raw);
      if (!box || recorteOcupaQuaseTudo(box)) continue;
      const w = box.direita - box.esquerda;
      const h = box.baixo - box.topo;
      const area = w * h;
      if (area < 0.12 || area > 0.88) continue;
      const aspect = w / h;
      const aspectScore = 1 - Math.min(1, Math.abs(aspect - A4) / A4);
      const score = area * (0.35 + 0.65 * aspectScore);
      if (score > bestScore) {
        bestScore = score;
        best = box;
      }
    }
    return best;
  }

  async function detectarFolhaBranca(dataUrl) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const maxSide = 720;
        let w = img.width;
        let h = img.height;
        const scale = Math.min(1, maxSide / Math.max(w, h));
        w = Math.max(1, Math.round(w * scale));
        h = Math.max(1, Math.round(h * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) {
          resolve(null);
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        const { data } = ctx.getImageData(0, 0, w, h);
        const gray = new Float32Array(w * h);
        for (let i = 0, p = 0; i < data.length; i += 4, p++) {
          gray[p] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        }

        const candidatos = [];
        for (let t = 145; t <= 215; t += 5) {
          let minX = w;
          let minY = h;
          let maxX = 0;
          let maxY = 0;
          let count = 0;
          for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
              if (gray[y * w + x] >= t) {
                count++;
                if (x < minX) minX = x;
                if (y < minY) minY = y;
                if (x > maxX) maxX = x;
                if (y > maxY) maxY = y;
              }
            }
          }
          if (count < w * h * 0.06) continue;
          const bw = maxX - minX + 1;
          const bh = maxY - minY + 1;
          if (bw < w * 0.2 || bh < h * 0.2) continue;
          const shrinkX = Math.round(bw * 0.015);
          const shrinkY = Math.round(bh * 0.015);
          candidatos.push({
            esquerda: (minX + shrinkX) / w,
            topo: (minY + shrinkY) / h,
            direita: (maxX - shrinkX) / w,
            baixo: (maxY - shrinkY) / h,
          });
        }

        resolve(escolherMelhorBox(candidatos));
      };
      img.onerror = () => resolve(null);
      img.src = dataUrl;
    });
  }

  async function loadImage(dataUrl) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = dataUrl;
    });
  }

  /** Folha A4 inteira — preenche o canvas (sem mesa ao redor). */
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

  /** Scanner nítido: fundo branco puro, texto preto forte. */
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

  async function chamarIaRecorte(dataUrl) {
    const m = String(dataUrl || "").match(/^data:([^;]+);base64,(.+)$/);
    if (!m) return null;
    const prompt = `Foto de CRLV-e (folha A4 branca) sobre fundo escuro.

Detecte a caixa EXATA da folha branca (sem mesa, mãos, laptop, sombras externas).

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
    try {
      const local = await detectarFolhaBranca(dataUrl);
      let box = local;
      if ((!box || recorteOcupaQuaseTudo(box)) && usarIa) {
        const ia = await chamarIaRecorte(dataUrl);
        if (ia) box = ia;
      }
      if (!box || recorteOcupaQuaseTudo(box)) {
        box = escolherMelhorBox([local]) || { esquerda: 0.06, topo: 0.06, direita: 0.94, baixo: 0.94 };
      }
      let imagem = await recortarParaA4(dataUrl, box);
      imagem = await aplicarFiltroScanner(imagem);
      return { ok: true, imagem, box };
    } catch (e) {
      return { ok: false, imagem: dataUrl, box: null, msg: String(e?.message || e) };
    }
  }

  window.__DK_patrimonioTratarDocumento = tratarDocumentoCrlv;
  window.__DK_patrimonioDetectarFolha = detectarFolhaBranca;
})();
