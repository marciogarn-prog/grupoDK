/**
 * Lançamento de multas: cola/anexa a imagem da autuação, mostra no tamanho da tela
 * e lê placa, data, código, descrição e valor.
 */
(function portalMultasOcr() {
  const TESSERACT_SRC = "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js";
  let objectUrl = "";
  let dataUrl = "";
  let tessPromise = null;

  function $(id) {
    return document.getElementById(id);
  }

  function setMsg(text, kind) {
    const el = $("operacaoLancMultasOcrMsg");
    if (!el) return;
    el.textContent = text || "";
    el.classList.toggle("portal-feedback--ok", kind === "ok");
    el.classList.toggle("portal-feedback--erro", kind === "erro");
  }

  function revokePreview() {
    if (objectUrl) {
      try {
        URL.revokeObjectURL(objectUrl);
      } catch {
        /* ignore */
      }
    }
    objectUrl = "";
  }

  function showPreview(src) {
    const img = $("operacaoLancMultasOcrImg");
    const empty = $("operacaoLancMultasOcrEmpty");
    if (!img) return;
    img.src = src;
    img.classList.remove("hidden");
    img.removeAttribute("hidden");
    empty?.classList.add("hidden");
  }

  function clearPreview() {
    revokePreview();
    dataUrl = "";
    const img = $("operacaoLancMultasOcrImg");
    if (img) {
      img.removeAttribute("src");
      img.classList.add("hidden");
      img.setAttribute("hidden", "");
    }
    $("operacaoLancMultasOcrEmpty")?.classList.remove("hidden");
    const file = $("operacaoLancMultasOcrFile");
    if (file) file.value = "";
    setMsg("");
  }

  function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result || ""));
      fr.onerror = () => reject(new Error("Falha ao ler a imagem."));
      fr.readAsDataURL(file);
    });
  }

  async function acceptFile(file) {
    if (!file || !String(file.type || "").startsWith("image/")) {
      setMsg("Use uma imagem (PNG, JPEG ou captura de ecrã).", "erro");
      return;
    }
    revokePreview();
    objectUrl = URL.createObjectURL(file);
    showPreview(objectUrl);
    dataUrl = await fileToDataUrl(file);
    setMsg("Imagem pronta. Clique em Ler dados da imagem.", "ok");
  }

  function loadTesseract() {
    if (window.Tesseract) return Promise.resolve(window.Tesseract);
    if (tessPromise) return tessPromise;
    tessPromise = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = TESSERACT_SRC;
      s.async = true;
      s.onload = () => (window.Tesseract ? resolve(window.Tesseract) : reject(new Error("Tesseract não carregou.")));
      s.onerror = () => reject(new Error("Sem rede para carregar a leitura local."));
      document.head.appendChild(s);
    });
    return tessPromise;
  }

  async function ocrLocal(imgSrc) {
    const Tesseract = await loadTesseract();
    const result = await Tesseract.recognize(imgSrc, "por", {
      logger: () => {},
    });
    return String(result?.data?.text || "");
  }

  async function ocrOpenAi(imgDataUrl) {
    const prompt =
      "Leia esta autuação/multa de trânsito brasileira. Devolva JSON com: placa, data (DD/MM/AAAA), hora (HH:MM), codigo, descricao, valor (número), auto, renainf, orgao, local. Sem texto extra.";
    const content = [
      { type: "text", text: prompt },
      { type: "image_url", image_url: { url: imgDataUrl } },
    ];
    const res = await fetch("/api/openai-comprovante", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ tipo: "multa_transito", content, max_tokens: 600 }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.ok || !data.parsed) {
      throw new Error(data?.reason || "ia_indisponivel");
    }
    return data.parsed;
  }

  function mergeLeitura(parsed, text) {
    const fromText =
      typeof window.__DK_parseAutuacaoTransito === "function"
        ? window.__DK_parseAutuacaoTransito(text || "")
        : {};
    const out = { ...fromText };
    if (!parsed || typeof parsed !== "object") return out;
    const pick = (key) => {
      const v = parsed[key];
      if (v == null) return;
      const s = String(v).trim();
      if (s) out[key] = key === "valor" ? Number(String(s).replace(/\./g, "").replace(",", ".")) || Number(s) || out[key] : s;
    };
    ["placa", "data", "hora", "codigo", "descricao", "auto", "renainf", "orgao", "local"].forEach(pick);
    if (parsed.valor != null && parsed.valor !== "") {
      const n =
        typeof parsed.valor === "number"
          ? parsed.valor
          : Number(String(parsed.valor).replace(/R\$\s?/g, "").replace(/\./g, "").replace(",", "."));
      if (Number.isFinite(n) && n > 0) out.valor = n;
    }
    if (out.placa) out.placa = String(out.placa).toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (out.codigo) out.codigo = String(out.codigo).replace(/\s+/g, "").replace("–", "-");
    return out;
  }

  async function lerImagem() {
    const src = dataUrl || $("operacaoLancMultasOcrImg")?.src;
    if (!src) {
      setMsg("Cole ou anexe a imagem da multa primeiro.", "erro");
      return;
    }
    const btn = $("operacaoLancMultasOcrLerBtn");
    if (btn) btn.disabled = true;
    setMsg("A ler os dados da imagem…");
    let merged = {};
    let used = "";
    try {
      try {
        const ia = await ocrOpenAi(dataUrl || src);
        merged = mergeLeitura(ia, "");
        used = "ia";
      } catch {
        const texto = await ocrLocal(src);
        merged = mergeLeitura(null, texto);
        used = "ocr";
      }
      if (!merged.placa && !merged.data && !merged.valor) {
        setMsg("Não consegui ler a multa. Confira se a imagem está nítida e tente de novo.", "erro");
        return;
      }
      if (typeof window.__DK_aplicarLeituraMulta === "function") {
        const r = window.__DK_aplicarLeituraMulta(merged);
        const extra = r?.aviso ? ` ${r.aviso}` : "";
        setMsg(
          `Lido: ${merged.placa || "sem placa"} · ${merged.data || "sem data"} · ${
            merged.valor ? `R$ ${Number(merged.valor).toFixed(2).replace(".", ",")}` : "sem valor"
          }.${extra}`,
          r?.ok === false ? "erro" : "ok"
        );
      } else {
        setMsg("Leitura pronta, mas o formulário de multas ainda não carregou.", "erro");
      }
    } catch (e) {
      setMsg(String(e?.message || e || "Falha na leitura."), "erro");
    } finally {
      if (btn) btn.disabled = false;
      void used;
    }
  }

  function bind() {
    const zone = $("operacaoLancMultasOcrZone");
    const file = $("operacaoLancMultasOcrFile");
    if (!zone) return;

    $("operacaoLancMultasOcrLerBtn")?.addEventListener("click", (e) => {
      e.preventDefault();
      lerImagem();
    });
    $("operacaoLancMultasOcrLimparBtn")?.addEventListener("click", (e) => {
      e.preventDefault();
      clearPreview();
    });
    $("operacaoLancMultasLimparPesquisaBtn")?.addEventListener("click", () => clearPreview());

    zone.addEventListener("click", (e) => {
      if (e.target.closest("button")) return;
      file?.click();
    });
    file?.addEventListener("change", () => {
      const f = file.files && file.files[0];
      if (f) acceptFile(f);
    });
    zone.addEventListener("dragover", (e) => {
      e.preventDefault();
      zone.classList.add("is-drag");
    });
    zone.addEventListener("dragleave", () => zone.classList.remove("is-drag"));
    zone.addEventListener("drop", (e) => {
      e.preventDefault();
      zone.classList.remove("is-drag");
      const f = e.dataTransfer?.files && e.dataTransfer.files[0];
      if (f) acceptFile(f);
    });

    document.addEventListener("paste", (e) => {
      const pane = $("operacaoInlineLancamentoMultas");
      if (!pane || pane.classList.contains("hidden")) return;
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const it of items) {
        if (it.type && it.type.startsWith("image/")) {
          const f = it.getAsFile();
          if (f) {
            e.preventDefault();
            acceptFile(f);
          }
          break;
        }
      }
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bind);
  else bind();
})();
