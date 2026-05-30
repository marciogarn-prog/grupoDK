/**
 * Portal DK — Cadastro de Patrimônio (CRLV-e digital).
 * Foto via câmera → IA extrai campos → relatório PDF/Excel (administrador).
 */
(function portalPatrimonio() {
  const STORAGE_KEY = "dk_patrimonio_crlv_v1";

  const CAMPOS_ORDEM = [
    { key: "codigoRenavam", label: "Código RENAVAM" },
    { key: "placa", label: "Placa" },
    { key: "exercicio", label: "Exercício" },
    { key: "anoFabricacao", label: "Ano fabricação" },
    { key: "anoModelo", label: "Ano modelo" },
    { key: "numeroCrv", label: "Número CRV" },
    { key: "codigoSegurancaCla", label: "Código segurança CLA" },
    { key: "marcaModeloVersao", label: "Marca/modelo/versão" },
    { key: "especieTipo", label: "Espécie/tipo" },
    { key: "placaAnterior", label: "Placa anterior" },
    { key: "chassi", label: "Chassi" },
    { key: "corPredominante", label: "Cor predominante" },
    { key: "combustivel", label: "Combustível" },
    { key: "categoria", label: "Categoria" },
    { key: "potenciaCilindrada", label: "Potência/cilindrada" },
    { key: "motor", label: "Motor" },
    { key: "carroceria", label: "Carroceria" },
    { key: "nome", label: "Nome" },
    { key: "cpfCnpj", label: "CPF/CNPJ" },
    { key: "local", label: "Local" },
    { key: "data", label: "Data" },
    { key: "observacaoVeiculo", label: "Observação do veículo" },
  ];

  const panel = document.getElementById("panel-patrimonio-locadora");
  if (!panel) return;

  const msgEl = document.getElementById("patrimonioMsg");
  const listaEl = document.getElementById("patrimonioLista");
  const resumoEl = document.getElementById("patrimonioResumo");
  const statusIaEl = document.getElementById("patrimonioOpenAIStatus");
  const btnNovo = document.getElementById("patrimonioBtnNovoDoc");
  const btnRelatorio = document.getElementById("patrimonioVerRelatorioBtn");
  const relatorioModal = document.getElementById("patrimonioRelatorioModal");
  const relatorioConteudo = document.getElementById("patrimonioRelatorioConteudo");
  const cameraOverlay = document.getElementById("patrimonioCameraOverlay");
  const previewOverlay = document.getElementById("patrimonioPreviewOverlay");
  const previewImg = document.getElementById("patrimonioPreviewImg");
  const cameraVideo = document.getElementById("patrimonioCameraVideo");
  const cameraCanvas = document.getElementById("patrimonioCameraCanvas");
  const imagemViewer = document.getElementById("patrimonioImagemViewer");
  const imagemViewerImg = document.getElementById("patrimonioImagemViewerImg");
  const fileFallback = document.getElementById("patrimonioCameraFallback");

  let cameraStream = null;
  let previewDataUrl = "";
  let processando = false;

  function escapeHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function newId() {
    return `pat_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }

  function normPlaca(s) {
    return String(s || "")
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "");
  }

  function parseBrDateMs(s) {
    const m = String(s || "").trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (!m) return 0;
    const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
    return Number.isNaN(d.getTime()) ? 0 : d.getTime();
  }

  function loadStore() {
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      if (Array.isArray(raw.documentos)) return { documentos: raw.documentos };
      if (Array.isArray(raw)) return { documentos: raw };
      return { documentos: [] };
    } catch {
      return { documentos: [] };
    }
  }

  function saveStore(store) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    if (typeof portalPushCloudSnapshotAfterPersist === "function") {
      portalPushCloudSnapshotAfterPersist();
    }
  }

  function getDocumentos() {
    return loadStore().documentos || [];
  }

  function upsertDocumento(doc) {
    const placa = normPlaca(doc.placa);
    if (!placa) return { ok: false, erro: "Placa não identificada na IA. Tente outra foto." };
    const store = loadStore();
    const docs = store.documentos.filter((d) => normPlaca(d.placa) !== placa);
    const antigo = store.documentos.find((d) => normPlaca(d.placa) === placa);
    const msNovo = parseBrDateMs(doc.data);
    const msAnt = antigo ? parseBrDateMs(antigo.data) : 0;
    if (antigo && msAnt > msNovo && msNovo > 0) {
      return {
        ok: false,
        erro: `Já existe documento mais recente para ${placa} (${antigo.data}). Este CRLV é de ${doc.data}.`,
      };
    }
    if (antigo && msAnt === msNovo && msNovo > 0) {
      /* mesma data — substitui com scan mais recente */
    }
    const registro = {
      ...doc,
      id: antigo?.id || doc.id || newId(),
      placa: placa,
      placaNorm: placa,
      atualizadoEm: new Date().toISOString(),
      cadastradoEm: antigo?.cadastradoEm || doc.cadastradoEm || new Date().toISOString(),
    };
    docs.push(registro);
    saveStore({ documentos: docs });
    return { ok: true, substituiu: Boolean(antigo), registro };
  }

  function parseDataUrl(dataUrl) {
    const m = String(dataUrl || "").match(/^data:([^;]+);base64,(.+)$/);
    if (!m) return { mime: "", base64: "" };
    return { mime: m[1], base64: m[2] };
  }

  async function comprimirImagem(dataUrl, maxPx, quality) {
    const { mime, base64 } = parseDataUrl(dataUrl);
    if (!mime.startsWith("image/") || !base64) return dataUrl;
    const q = Number.isFinite(quality) ? quality : 0.85;
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        let w = img.width;
        let h = img.height;
        const max = maxPx || 1600;
        if (w > h && w > max) {
          h = Math.round((h * max) / w);
          w = max;
        } else if (h > max) {
          w = Math.round((w * max) / h);
          h = max;
        }
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(dataUrl);
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", q));
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });
  }

  /** Recorte documento (bbox normalizado 0–1) e ajusta proporção A4. */
  async function recortarDocumentoA4(dataUrl, recorte) {
    const box = recorte || { esquerda: 0.02, topo: 0.02, direita: 0.98, baixo: 0.98 };
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const x0 = Math.max(0, Math.min(1, Number(box.esquerda ?? box.left ?? 0)));
        const y0 = Math.max(0, Math.min(1, Number(box.topo ?? box.top ?? 0)));
        const x1 = Math.max(x0, Math.min(1, Number(box.direita ?? box.right ?? 1)));
        const y1 = Math.max(y0, Math.min(1, Number(box.baixo ?? box.bottom ?? 1)));
        let sw = Math.round((x1 - x0) * img.width);
        let sh = Math.round((y1 - y0) * img.height);
        let sx = Math.round(x0 * img.width);
        let sy = Math.round(y0 * img.height);
        if (sw < 10 || sh < 10) {
          sx = 0;
          sy = 0;
          sw = img.width;
          sh = img.height;
        }
        const a4 = 210 / 297;
        let dw = sw;
        let dh = Math.round(sw / a4);
        if (dh > sh) {
          dh = sh;
          dw = Math.round(sh * a4);
        }
        const canvas = document.createElement("canvas");
        canvas.width = dw;
        canvas.height = dh;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(dataUrl);
          return;
        }
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, dw, dh);
        const ox = Math.max(0, Math.round((dw - sw) / 2));
        const oy = Math.max(0, Math.round((dh - sh) / 2));
        ctx.drawImage(img, sx, sy, sw, sh, ox, oy, sw, sh);
        resolve(canvas.toDataURL("image/jpeg", 0.92));
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });
  }

  function montarPromptCrlv() {
    const schema = `{"recorte":{"esquerda":0.0,"topo":0.0,"direita":1.0,"baixo":1.0},"campos":{"codigoRenavam":"","placa":"","exercicio":"","anoFabricacao":"","anoModelo":"","numeroCrv":"","codigoSegurancaCla":"","marcaModeloVersao":"","especieTipo":"","placaAnterior":"","chassi":"","corPredominante":"","combustivel":"","categoria":"","potenciaCilindrada":"","motor":"","carroceria":"","nome":"","cpfCnpj":"","local":"","data":"DD/MM/AAAA","observacaoVeiculo":""}}`;
    return `Documento CRLV-e brasileiro (Certificado de Registro e Licenciamento de Veículo — digital).

1) Detecte os limites da folha do documento na foto e devolva recorte com coordenadas normalizadas 0–1 (esquerda, topo, direita, baixo) para recortar só a folha A4, como scanner.
2) Extraia TODOS os campos visíveis do CRLV-e.

Responda APENAS JSON válido (sem markdown): ${schema}

Regras:
- placa em maiúsculas sem hífen (ex.: RZS4G95)
- data do documento em DD/MM/AAAA (campo «Data» no rodapé)
- campos ausentes: string vazia
- observacaoVeiculo: texto do campo «Observações» / «Observação do veículo»
- cpfCnpj com pontuação se visível`;
  }

  async function chamarIaCrlv(dataUrl) {
    const parsed = parseDataUrl(dataUrl);
    const content = [
      { type: "text", text: montarPromptCrlv() },
      {
        type: "image_url",
        image_url: {
          url: `data:${parsed.mime};base64,${parsed.base64}`,
          detail: "high",
        },
      },
    ];
    try {
      const res = await fetch("/api/openai-comprovante", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, tipo: "crlv", max_tokens: 4096 }),
      });
      const data = await res.json();
      if (res.ok && data.ok && data.parsed) return { ok: true, parsed: data.parsed };
      return { ok: false, msg: data.error || data.reason || "Falha na IA." };
    } catch (e) {
      return { ok: false, msg: String(e?.message || e) };
    }
  }

  function normalizarCampos(raw) {
    const c = raw?.campos || raw || {};
    const out = {};
    for (const { key } of CAMPOS_ORDEM) {
      out[key] = String(c[key] ?? c[key.replace(/([A-Z])/g, "_$1").toLowerCase()] ?? "").trim();
    }
    if (out.placa) out.placa = normPlaca(out.placa);
    return out;
  }

  async function processarFotoConfirmada(dataUrlRaw) {
    if (processando) return;
    processando = true;
    setMsg("A processar documento com IA…", false);
    try {
      const comprimida = await comprimirImagem(dataUrlRaw, 2000, 0.88);
      const oai = await chamarIaCrlv(comprimida);
      if (!oai.ok) {
        setMsg(oai.msg || "IA não respondeu.", true);
        return;
      }
      const recorte = oai.parsed?.recorte || oai.parsed?.crop;
      const imagemRecortada = await recortarDocumentoA4(comprimida, recorte);
      const imagemGuardar = await comprimirImagem(imagemRecortada, 1400, 0.82);
      const campos = normalizarCampos(oai.parsed);
      if (!campos.placa) {
        setMsg("IA não leu a placa. Tire outra foto com melhor enquadramento.", true);
        return;
      }
      const doc = {
        ...campos,
        id: newId(),
        imagemRecortada: imagemGuardar,
        processadoEm: new Date().toISOString(),
        cadastradoEm: new Date().toISOString(),
      };
      const r = upsertDocumento(doc);
      if (!r.ok) {
        setMsg(r.erro, true);
        return;
      }
      setMsg(
        r.substituiu
          ? `Documento ${campos.placa} atualizado (${campos.data || "sem data"}).`
          : `Documento ${campos.placa} cadastrado.`,
        false,
        true
      );
      renderLista();
    } finally {
      processando = false;
    }
  }

  function setMsg(text, erro, ok) {
    if (!msgEl) return;
    msgEl.textContent = text || "";
    msgEl.classList.toggle("portal-feedback--erro", Boolean(erro));
    msgEl.classList.toggle("portal-feedback--ok", Boolean(ok));
  }

  async function pararCamera() {
    if (cameraStream) {
      cameraStream.getTracks().forEach((t) => t.stop());
      cameraStream = null;
    }
    if (cameraVideo) cameraVideo.srcObject = null;
  }

  function fecharCamera() {
    void pararCamera();
    cameraOverlay?.classList.add("hidden");
    cameraOverlay?.setAttribute("aria-hidden", "true");
  }

  function fecharPreview() {
    previewOverlay?.classList.add("hidden");
    previewOverlay?.setAttribute("aria-hidden", "true");
    previewDataUrl = "";
    if (previewImg) previewImg.removeAttribute("src");
  }

  async function abrirCameraNativa() {
    fecharPreview();
    if (!cameraOverlay || !cameraVideo) {
      fileFallback?.click();
      return;
    }
    cameraOverlay.classList.remove("hidden");
    cameraOverlay.setAttribute("aria-hidden", "false");
    await pararCamera();
    if (!navigator.mediaDevices?.getUserMedia) {
      fecharCamera();
      fileFallback?.click();
      return;
    }
    try {
      cameraStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 } },
        audio: false,
      });
      cameraVideo.srcObject = cameraStream;
      await cameraVideo.play();
    } catch {
      fecharCamera();
      setMsg("Permita o acesso à câmera ou use o seletor de ficheiro.", true);
      fileFallback?.click();
    }
  }

  function capturarDaCamera() {
    if (!cameraVideo || !cameraCanvas) return;
    const vw = cameraVideo.videoWidth;
    const vh = cameraVideo.videoHeight;
    if (!vw || !vh) return;
    cameraCanvas.width = vw;
    cameraCanvas.height = vh;
    const ctx = cameraCanvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(cameraVideo, 0, 0, vw, vh);
    previewDataUrl = cameraCanvas.toDataURL("image/jpeg", 0.92);
    fecharCamera();
    mostrarPreview(previewDataUrl);
  }

  function mostrarPreview(dataUrl) {
    if (!previewOverlay || !previewImg) return;
    previewDataUrl = dataUrl;
    previewImg.src = dataUrl;
    previewOverlay.classList.remove("hidden");
    previewOverlay.setAttribute("aria-hidden", "false");
  }

  function renderLista() {
    const docs = getDocumentos().slice().sort((a, b) => normPlaca(a.placa).localeCompare(normPlaca(b.placa)));
    if (resumoEl) {
      resumoEl.textContent =
        docs.length > 0
          ? `${docs.length} veículo(s) · uma placa por registo (mais recente prevalece).`
          : "Nenhum CRLV cadastrado. Toque em «Fotografar documento».";
    }
    if (btnRelatorio) btnRelatorio.disabled = docs.length === 0;
    if (!listaEl) return;
    if (!docs.length) {
      listaEl.innerHTML = '<p class="subtext">Nenhum documento ainda.</p>';
      return;
    }
    listaEl.innerHTML = docs
      .map((d) => {
        const titulo = `${escapeHtml(d.placa)} · ${escapeHtml(d.marcaModeloVersao || "—")}`;
        const sub = `${escapeHtml(d.nome || "—")} · ${escapeHtml(d.data || "—")}`;
        return `<div class="patrimonio-doc-item">
          <div>
            <strong>${titulo}</strong>
            <span class="subtext"> — ${sub}</span>
          </div>
          <div class="patrimonio-doc-item__acoes">
            <button type="button" class="btn-primary btn-secondary-outline patrimonio-ver-img" data-pat-id="${escapeHtml(d.id)}">Ver imagem</button>
            <button type="button" class="btn-primary btn-secondary-outline patrimonio-remover" data-pat-id="${escapeHtml(d.id)}">Remover</button>
          </div>
        </div>`;
      })
      .join("");
    listaEl.querySelectorAll(".patrimonio-ver-img").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-pat-id");
        if (id) abrirViewerImagem(id);
      });
    });
    listaEl.querySelectorAll(".patrimonio-remover").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-pat-id");
        if (!id || !window.confirm("Remover este CRLV da base?")) return;
        const store = loadStore();
        saveStore({ documentos: store.documentos.filter((d) => d.id !== id) });
        renderLista();
      });
    });
  }

  function getDocById(id) {
    return getDocumentos().find((d) => d.id === id) || null;
  }

  function abrirViewerImagem(id) {
    const doc = getDocById(id);
    const url = doc?.imagemRecortada;
    if (!url || !imagemViewer || !imagemViewerImg) return;
    imagemViewerImg.src = url;
    imagemViewer.dataset.patId = id;
    imagemViewer.classList.remove("hidden");
    imagemViewer.setAttribute("aria-hidden", "false");
  }

  function fecharViewerImagem() {
    imagemViewer?.classList.add("hidden");
    imagemViewer?.setAttribute("aria-hidden", "true");
    if (imagemViewerImg) imagemViewerImg.removeAttribute("src");
  }

  function imprimirViewerImagem() {
    const url = imagemViewerImg?.src;
    if (!url) return;
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(
      `<html><head><title>CRLV</title></head><body style="margin:0;text-align:center"><img src="${url}" style="max-width:100%;height:auto" onload="window.print()"/></body></html>`
    );
    w.document.close();
  }

  function partilharViewerImagem(tipo) {
    const doc = getDocById(imagemViewer?.dataset?.patId || "");
    const titulo = doc ? `CRLV — ${doc.placa}` : "CRLV DK Locadora";
    if (tipo === "email") {
      window.location.href = `mailto:?subject=${encodeURIComponent(titulo)}&body=${encodeURIComponent("Documento CRLV cadastrado no património DK Locadora.")}`;
      return;
    }
    window.open(
      `https://wa.me/?text=${encodeURIComponent(`${titulo}\n(CRLV cadastrado — Grupo DK Locadora)`)}`,
      "_blank",
      "noopener"
    );
  }

  function buildRelatorioRows() {
    return getDocumentos()
      .slice()
      .sort((a, b) => normPlaca(a.placa).localeCompare(normPlaca(b.placa)))
      .map((d) => {
        const row = CAMPOS_ORDEM.map(({ key }) => String(d[key] ?? ""));
        row.push(`VER:${d.id}`);
        return row;
      });
  }

  function buildRelatorioHeaders() {
    return [...CAMPOS_ORDEM.map((c) => c.label), "Documento"];
  }

  function renderRelatorioTabela() {
    if (!relatorioConteudo) return;
    const docs = getDocumentos().slice().sort((a, b) => normPlaca(a.placa).localeCompare(normPlaca(b.placa)));
    if (!docs.length) {
      relatorioConteudo.innerHTML = '<p class="subtext">Nenhum documento.</p>';
      return;
    }
    const heads = buildRelatorioHeaders();
    const headHtml = heads.map((h) => `<th>${escapeHtml(h)}</th>`).join("");
    const bodyHtml = docs
      .map((d) => {
        const tds = CAMPOS_ORDEM.map(({ key }) => `<td>${escapeHtml(d[key] || "")}</td>`).join("");
        const link = `<td><button type="button" class="btn-primary btn-secondary-outline patrimonio-relatorio-ver-img" data-pat-id="${escapeHtml(d.id)}">Ver imagem</button></td>`;
        return `<tr>${tds}${link}</tr>`;
      })
      .join("");
    relatorioConteudo.innerHTML = `<div class="portal-lanc-hist-wrap"><table class="portal-lanc-hist patrimonio-relatorio-table"><thead><tr>${headHtml}</tr></thead><tbody>${bodyHtml}</tbody></table></div>`;
    relatorioConteudo.querySelectorAll(".patrimonio-relatorio-ver-img").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-pat-id");
        if (id) abrirViewerImagem(id);
      });
    });
  }

  function getRelatorioContext() {
    const headers = buildRelatorioHeaders();
    const rows = buildRelatorioRows();
    const titulo = "Relatório de patrimônio — CRLV";
    const previewHtml = relatorioConteudo?.innerHTML || "";
    return {
      title: titulo,
      headers,
      rows: rows.map((r) => r.slice(0, -1).concat(["Ver imagem"])),
      fileSlug: "patrimonio-crlv",
      textColumns: headers.map((_, i) => i),
      previewHtml,
      shareMeta: {
        title: titulo,
        bodyText: `${getDocumentos().length} veículo(s) cadastrado(s) — CRLV digital.`,
        fileBaseName: "relatorio patrimonio crlv",
      },
      buildPdfHtml: () => buildPatrimonioPdfHtml(headers, rows, titulo),
      buildExcelHtml: () => buildPatrimonioExcelHtml(headers, rows, titulo),
    };
  }

  function buildPatrimonioPdfHtml(headers, rows, titulo) {
    const head = headers.map((h) => `<th>${escapeHtml(h)}</th>`).join("");
    const body = rows
      .map((row) => {
        const id = String(row[row.length - 1] || "").replace(/^VER:/, "");
        const cells = row.slice(0, -1).map((c) => `<td>${escapeHtml(c)}</td>`).join("");
        const link = id
          ? `<td><a href="#" class="lnk-patrimonio-img" data-pat-id="${escapeHtml(id)}" onclick="if(window.parent&&window.parent.__DK_openPatrimonioImagemById){window.parent.__DK_openPatrimonioImagemById('${escapeHtml(id)}');return false;}if(window.__DK_openPatrimonioImagemById){window.__DK_openPatrimonioImagemById('${escapeHtml(id)}');return false;}return false;">Ver imagem</a></td>`
          : "<td></td>";
        return `<tr>${cells}${link}</tr>`;
      })
      .join("");
    return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><title>${escapeHtml(titulo)}</title>
<style>body{font-family:Segoe UI,Arial,sans-serif;font-size:11px;margin:16px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ccc;padding:4px 6px;text-align:left;vertical-align:top}th{background:#f5f5f5}.meta{color:#555;margin-bottom:12px}a{color:#0066cc}</style></head>
<body><h1>${escapeHtml(titulo)}</h1><p class="meta">Grupo DK Locadora · ${escapeHtml(new Date().toLocaleString("pt-BR"))} · ${rows.length} veículo(s)</p>
<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></body></html>`;
  }

  function buildPatrimonioExcelHtml(headers, rows, titulo) {
    const head = headers.map((h) => `<th>${escapeHtml(h)}</th>`).join("");
    const body = rows
      .map((row) => {
        const cells = row.slice(0, -1).map((c) => `<td>${escapeHtml(c)}</td>`).join("");
        return `<tr>${cells}<td>Ver imagem</td></tr>`;
      })
      .join("");
    return `<html xmlns:o="urn:schemas-microsoft-com:office:office"><head><meta charset="utf-8"><title>${escapeHtml(titulo)}</title></head>
<body><h2>${escapeHtml(titulo)}</h2><table border="1"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></body></html>`;
  }

  function abrirRelatorioModal() {
    if (!relatorioModal) return;
    renderRelatorioTabela();
    relatorioModal.classList.remove("hidden");
    relatorioModal.setAttribute("aria-hidden", "false");
  }

  function fecharRelatorioModal() {
    relatorioModal?.classList.add("hidden");
    relatorioModal?.setAttribute("aria-hidden", "true");
  }

  async function refreshOpenAIStatus() {
    if (!statusIaEl) return;
    statusIaEl.textContent = "A verificar IA…";
    try {
      const res = await fetch("/api/openai-comprovante", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ping: true }),
      });
      const data = await res.json();
      if (data?.ok && data?.mode === "server") {
        statusIaEl.innerHTML = "✓ <strong>IA no servidor</strong> — leitura automática do CRLV-e.";
      } else {
        statusIaEl.textContent = "IA não configurada no servidor.";
      }
    } catch {
      statusIaEl.textContent = "Não foi possível verificar IA.";
    }
  }

  function bindUi() {
    if (document.documentElement.dataset.dkPatrimonioBound === "1") return;
    document.documentElement.dataset.dkPatrimonioBound = "1";

    btnNovo?.addEventListener("click", () => void abrirCameraNativa());
    btnRelatorio?.addEventListener("click", () => abrirRelatorioModal());

    document.getElementById("patrimonioCameraCapturarBtn")?.addEventListener("click", capturarDaCamera);
    document.getElementById("patrimonioCameraCancelarBtn")?.addEventListener("click", () => fecharCamera());
    document.getElementById("patrimonioPreviewSimBtn")?.addEventListener("click", () => {
      const url = previewDataUrl;
      fecharPreview();
      if (url) void processarFotoConfirmada(url);
    });
    document.getElementById("patrimonioPreviewNaoBtn")?.addEventListener("click", () => {
      fecharPreview();
      void abrirCameraNativa();
    });

    fileFallback?.addEventListener("change", async () => {
      const f = fileFallback.files?.[0];
      fileFallback.value = "";
      if (!f || !f.type.startsWith("image/")) return;
      const fr = new FileReader();
      fr.onload = () => mostrarPreview(String(fr.result || ""));
      fr.readAsDataURL(f);
    });

    document.getElementById("patrimonioImagemFecharBtn")?.addEventListener("click", fecharViewerImagem);
    document.getElementById("patrimonioImagemPrintBtn")?.addEventListener("click", imprimirViewerImagem);
    document.getElementById("patrimonioImagemShareEmailBtn")?.addEventListener("click", () =>
      partilharViewerImagem("email")
    );
    document.getElementById("patrimonioImagemShareWaBtn")?.addEventListener("click", () =>
      partilharViewerImagem("whatsapp")
    );

    document.getElementById("patrimonioRelatorioPdfBtn")?.addEventListener("click", () => {
      if (typeof window.__DK_emitPortalRelatorioPdf === "function") {
        window.__DK_emitPortalRelatorioPdf(getRelatorioContext());
      }
    });
    document.getElementById("patrimonioRelatorioExcelBtn")?.addEventListener("click", () => {
      if (typeof window.__DK_emitPortalRelatorioExcel === "function") {
        window.__DK_emitPortalRelatorioExcel(getRelatorioContext());
      }
    });
    document.getElementById("patrimonioRelatorioAtualizarBtn")?.addEventListener("click", renderRelatorioTabela);

    relatorioModal?.querySelectorAll("[data-close-pat-relatorio]").forEach((el) => {
      el.addEventListener("click", fecharRelatorioModal);
    });
  }

  function resetPatrimonioUi() {
    fecharCamera();
    fecharPreview();
    fecharViewerImagem();
    fecharRelatorioModal();
    setMsg("");
    renderLista();
  }

  function onShowPatrimonio() {
    if (typeof window.__DK_isPortalTitularAdministrador === "function") {
      if (!window.__DK_isPortalTitularAdministrador()) {
        setMsg("Cadastro de patrimônio: apenas administrador.", true);
        return;
      }
    }
    void refreshOpenAIStatus();
    renderLista();
  }

  function escapeBackPatrimonio() {
    if (previewOverlay && !previewOverlay.classList.contains("hidden")) {
      fecharPreview();
      return true;
    }
    if (cameraOverlay && !cameraOverlay.classList.contains("hidden")) {
      fecharCamera();
      return true;
    }
    if (imagemViewer && !imagemViewer.classList.contains("hidden")) {
      fecharViewerImagem();
      return true;
    }
    if (relatorioModal && !relatorioModal.classList.contains("hidden")) {
      fecharRelatorioModal();
      return true;
    }
    return false;
  }

  window.__DK_patrimonioOnShow = onShowPatrimonio;
  window.__DK_patrimonioReset = resetPatrimonioUi;
  window.__DK_patrimonioEscapeBack = escapeBackPatrimonio;
  window.__DK_openPatrimonioImagemById = abrirViewerImagem;

  bindUi();
  renderLista();
})();
