/**
 * Portal DK — Cadastro de Patrimônio (CRLV-e digital).
 * Foto via câmera → IA extrai campos → relatório PDF/Excel (administrador).
 */
(function portalPatrimonio() {
  const STORAGE_KEY = "dk_patrimonio_crlv_v1";
  const PENDING_FOTO_KEY = "dk_patrimonio_foto_pendente_v1";
  const PATRIMONIO_SCAN_VERSAO = 4;

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

  const MSG_NITIDEZ = "Imagem sem nitidez suficiente para ser processada.";
  /** Campos que a IA deve ler com 100% de certeza — senão reprova o cadastro. */
  const CAMPOS_OBRIGATORIOS = [
    "codigoRenavam",
    "placa",
    "exercicio",
    "anoFabricacao",
    "anoModelo",
    "numeroCrv",
    "codigoSegurancaCla",
    "marcaModeloVersao",
    "especieTipo",
    "chassi",
    "corPredominante",
    "combustivel",
    "categoria",
    "potenciaCilindrada",
    "motor",
    "nome",
    "cpfCnpj",
    "local",
    "data",
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
  const relatorioContador = document.getElementById("patrimonioRelatorioContador");
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
  let previewDataUrlRaw = "";
  let processando = false;
  let patrimonioModalHistorico = false;
  let patrimonioHistorySuppress = false;
  let patrimonioFlashLigado = false;

  function patrimonioOverlayAberto() {
    return (
      (cameraOverlay && !cameraOverlay.classList.contains("hidden")) ||
      (previewOverlay && !previewOverlay.classList.contains("hidden")) ||
      (imagemViewer && !imagemViewer.classList.contains("hidden"))
    );
  }

  function patrimonioPersistirAreaPortal() {
    try {
      sessionStorage.setItem("dk_portal_area_ativa", "patrimonio");
    } catch {
      /* ignore */
    }
  }

  function patrimonioGuardarFotoPendente(dataUrl) {
    patrimonioPersistirAreaPortal();
    try {
      sessionStorage.setItem(PENDING_FOTO_KEY, dataUrl);
    } catch {
      /* foto grande — ignorar */
    }
  }

  function patrimonioLimparFotoPendente() {
    try {
      sessionStorage.removeItem(PENDING_FOTO_KEY);
    } catch {
      /* ignore */
    }
  }

  function patrimonioNotificarOverlayAberto() {
    if (patrimonioModalHistorico) return;
    patrimonioPersistirAreaPortal();
    try {
      history.pushState({ dkPatrimonioOverlay: 1 }, "", location.href);
      patrimonioModalHistorico = true;
    } catch {
      /* ignore */
    }
  }

  /** Fecha overlay sem history.back() — evita voltar ao app.html (PWA) na pilha. */
  function patrimonioNotificarOverlayFechado() {
    patrimonioModalHistorico = false;
  }

  function patrimonioSyncHistoryAposFechar() {
    if (!patrimonioOverlayAberto()) patrimonioNotificarOverlayFechado();
  }

  window.addEventListener("popstate", () => {
    if (patrimonioHistorySuppress) {
      patrimonioHistorySuppress = false;
      return;
    }
    if (!patrimonioOverlayAberto() && !patrimonioModalHistorico) return;
    patrimonioModalHistorico = false;
    if (previewOverlay && !previewOverlay.classList.contains("hidden")) {
      fecharPreview(false);
      return;
    }
    if (cameraOverlay && !cameraOverlay.classList.contains("hidden")) {
      fecharCamera(false);
      return;
    }
    if (imagemViewer && !imagemViewer.classList.contains("hidden")) {
      fecharViewerImagem(false);
    }
  });

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

  function onlyDigits(s) {
    return String(s ?? "").replace(/\D/g, "");
  }

  const PLACA_MERCOSUL_RE = /^[A-Z]{3}[0-9][A-Z][0-9]{2}$/;

  function placaValida(p) {
    return Boolean(resolverPlacaMercosul(p));
  }

  function resolverPlacaMercosul(raw) {
    const x = normPlaca(raw);
    if (typeof window.corrigirPlacaMercosul === "function") {
      const c = window.corrigirPlacaMercosul(x);
      if (c) return c;
    }
    if (typeof window.isPlacaMercosul === "function" && window.isPlacaMercosul(x)) return x;
    return PLACA_MERCOSUL_RE.test(x) ? x : "";
  }

  function sanitizarDocumentoPatrimonio(d) {
    if (!d || typeof d !== "object") return null;
    const placa = resolverPlacaMercosul(d.placaNorm || d.placa);
    if (!placa) return null;
    return { ...d, placa, placaNorm: placa };
  }

  function normChassi(s) {
    return String(s || "")
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "");
  }

  function normMotor(s) {
    return String(s || "")
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "");
  }

  function normRenavam(s) {
    return onlyDigits(s).slice(0, 11);
  }

  /** Chaves únicas: placa, RENAVAM, chassi ou motor repetido = mesmo veículo. */
  function chavesIdentidadePatrimonio(d) {
    const keys = [];
    const placa = resolverPlacaMercosul(d.placaNorm || d.placa);
    if (placa) keys.push(`placa:${placa}`);
    const renavam = normRenavam(d.codigoRenavam);
    if (renavam.length === 11) keys.push(`renavam:${renavam}`);
    const chassi = normChassi(d.chassi);
    if (chassi.length === 17) keys.push(`chassi:${chassi}`);
    const motor = normMotor(d.motor);
    if (motor.length >= 8) keys.push(`motor:${motor}`);
    return keys;
  }

  function docMesmaIdentidade(a, b) {
    const ka = chavesIdentidadePatrimonio(a);
    const kb = new Set(chavesIdentidadePatrimonio(b));
    return ka.some((k) => kb.has(k));
  }

  function deduplicarPorIdentidade(list) {
    const docs = (list || []).filter(Boolean);
    if (docs.length <= 1) return docs;

    const parent = docs.map((_, i) => i);
    function find(i) {
      while (parent[i] !== i) {
        parent[i] = parent[parent[i]];
        i = parent[i];
      }
      return i;
    }
    function union(i, j) {
      const ri = find(i);
      const rj = find(j);
      if (ri !== rj) parent[rj] = ri;
    }

    const keyToIdx = new Map();
    for (let i = 0; i < docs.length; i++) {
      for (const k of chavesIdentidadePatrimonio(docs[i])) {
        if (keyToIdx.has(k)) union(i, keyToIdx.get(k));
        else keyToIdx.set(k, i);
      }
    }

    const groups = new Map();
    for (let i = 0; i < docs.length; i++) {
      const root = find(i);
      if (!groups.has(root)) groups.set(root, []);
      groups.get(root).push(docs[i]);
    }

    return Array.from(groups.values()).map((group) =>
      group.reduce((best, d) => (docMs(d) >= docMs(best) ? d : best))
    );
  }

  /** Placa / RENAVAM / chassi / motor iguais = um veículo (foto mais recente prevalece). */
  function deduplicarDocumentos(documentos) {
    const list = (documentos || [])
      .map(sanitizarDocumentoPatrimonio)
      .filter(Boolean);
    return deduplicarPorIdentidade(list);
  }

  function loadStore() {
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      let documentos = [];
      if (Array.isArray(raw.documentos)) documentos = raw.documentos;
      else if (Array.isArray(raw)) documentos = raw;
      return { documentos: deduplicarDocumentos(documentos) };
    } catch {
      return { documentos: [] };
    }
  }

  function dataBrValida(s) {
    const m = String(s || "").trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!m) return false;
    const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
    return !Number.isNaN(d.getTime()) && d.getDate() === Number(m[1]);
  }

  function chassiValido(s) {
    const c = String(s || "")
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "");
    return c.length === 17;
  }

  function parseBrDateMs(s) {
    const m = String(s || "").trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (!m) return 0;
    const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
    return Number.isNaN(d.getTime()) ? 0 : d.getTime();
  }

  function docMs(d) {
    for (const k of ["atualizadoEm", "processadoEm", "cadastradoEm"]) {
      const t = Date.parse(String(d?.[k] || ""));
      if (Number.isFinite(t)) return t;
    }
    return 0;
  }

  function saveStore(store) {
    const documentos = deduplicarDocumentos(store?.documentos || []);
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ documentos }));
    if (typeof portalPushCloudSnapshotAfterPersist === "function") {
      portalPushCloudSnapshotAfterPersist();
    }
  }

  function getDocumentos() {
    return loadStore().documentos || [];
  }

  function upsertDocumento(doc) {
    const placa = resolverPlacaMercosul(doc.placa);
    if (!placa) {
      return {
        ok: false,
        erro: "Placa inválida (padrão LLLNLNN). Confira nitidez e fotografe de novo.",
      };
    }
    const docNorm = { ...doc, placa, placaNorm: placa };
    const store = loadStore();
    const antigos = store.documentos.filter((d) => docMesmaIdentidade(d, docNorm));
    const antigo = antigos.length
      ? antigos.reduce((best, d) => (docMs(d) >= docMs(best) ? d : best))
      : null;
    const idsRemover = new Set(antigos.map((d) => d.id));
    const docs = store.documentos.filter((d) => !idsRemover.has(d.id));
    const agora = new Date().toISOString();
    const registro = {
      ...docNorm,
      id: antigo?.id || doc.id || newId(),
      processadoEm: agora,
      atualizadoEm: agora,
      imagemAtualizadaEm: agora,
      cadastradoEm: antigo?.cadastradoEm || doc.cadastradoEm || agora,
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

  /** Comprime até caber na nuvem (~320 KB base64) para a foto nova ir sempre no sync. */
  async function comprimirImagemLimite(dataUrl, maxPx, maxLen, qualityStart) {
    const limite = maxLen || 320000;
    let q = qualityStart || 0.9;
    let px = maxPx || 1600;
    let result = await comprimirImagem(dataUrl, px, q);
    for (let i = 0; i < 8; i++) {
      if (parseDataUrl(result).base64.length <= limite) return result;
      if (q > 0.62) q -= 0.07;
      else px = Math.max(900, Math.round(px * 0.86));
      result = await comprimirImagem(dataUrl, px, q);
    }
    return result;
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
    const schema = `{"aprovado":true,"confianca":"alta","camposIlegiveis":[],"motivoReprovacao":"","campos":{"codigoRenavam":"","placa":"","exercicio":"","anoFabricacao":"","anoModelo":"","numeroCrv":"","codigoSegurancaCla":"","marcaModeloVersao":"","especieTipo":"","placaAnterior":"","chassi":"","corPredominante":"","combustivel":"","categoria":"","potenciaCilindrada":"","motor":"","carroceria":"","nome":"","cpfCnpj":"","local":"","data":"DD/MM/AAAA","observacaoVeiculo":""}}`;
    return `CRLV-e brasileiro (folha A4 recortada). Leia TODOS os campos com atenção a cada dígito e letra.

Responda APENAS JSON válido (sem markdown): ${schema}

REGRAS CRÍTICAS:
- Se QUALQUER campo obrigatório estiver ilegível, duvidoso ou parcial → "aprovado": false, "confianca": "baixa", liste os nomes em "camposIlegiveis" e explique em "motivoReprovacao".
- Só use "aprovado": true e "confianca": "alta" se TODOS os campos obrigatórios estiverem 100% legíveis e corretos.
- NÃO invente dígitos. Diferencie 0/O, 1/I/l, 8/B, 5/S, 2/Z.
- codigoRenavam: exatamente 11 dígitos.
- placa: exatamente LLLNLNN — posição 4 = NÚMERO, posição 5 = LETRA, posições 6-7 = NÚMEROS (ex.: SOX2A84). Proibido LLLLNNN (ex.: SOXA284). Diferencie 2 de A, 0 de O, 8 de B.
- chassi: exatamente 17 caracteres alfanuméricos.
- codigoSegurancaCla: 11 dígitos.
- data: DD/MM/AAAA do campo Local/Data.
- cpfCnpj: CPF ou CNPJ completo como impresso.
- potenciaCilindrada: ex. "8CV/150".
- observacaoVeiculo: "SEM OBSERVAÇÕES" se for o caso.`;
  }

  function validarLeituraCrlv(parsed, campos) {
    const meta = parsed?.campos ? parsed : { campos: parsed };
    const root = parsed || {};

    if (root.aprovado === false) {
      return { ok: false, msg: MSG_NITIDEZ };
    }
    if (String(root.confianca || "").toLowerCase() !== "alta") {
      return { ok: false, msg: MSG_NITIDEZ };
    }
    const ileg = Array.isArray(root.camposIlegiveis) ? root.camposIlegiveis : [];
    if (ileg.length > 0) {
      return { ok: false, msg: MSG_NITIDEZ };
    }
    if (String(root.motivoReprovacao || "").trim()) {
      return { ok: false, msg: MSG_NITIDEZ };
    }

    for (const key of CAMPOS_OBRIGATORIOS) {
      if (!String(campos[key] ?? "").trim()) {
        return { ok: false, msg: MSG_NITIDEZ };
      }
    }

    if (!placaValida(campos.placa)) {
      return { ok: false, msg: MSG_NITIDEZ };
    }
    if (onlyDigits(campos.codigoRenavam).length !== 11) {
      return { ok: false, msg: MSG_NITIDEZ };
    }
    if (onlyDigits(campos.codigoSegurancaCla).length !== 11) {
      return { ok: false, msg: MSG_NITIDEZ };
    }
    if (!chassiValido(campos.chassi)) {
      return { ok: false, msg: MSG_NITIDEZ };
    }
    if (!dataBrValida(campos.data)) {
      return { ok: false, msg: MSG_NITIDEZ };
    }
    const cnpjCpf = onlyDigits(campos.cpfCnpj);
    if (cnpjCpf.length !== 11 && cnpjCpf.length !== 14) {
      return { ok: false, msg: MSG_NITIDEZ };
    }
    if (!/^\d{4}$/.test(String(campos.exercicio || ""))) {
      return { ok: false, msg: MSG_NITIDEZ };
    }

    return { ok: true };
  }

  async function tratarImagemDocumento(dataUrlRaw, opts) {
    const usarIa = opts?.usarIa === true;
    if (typeof window.__DK_patrimonioTratarDocumento === "function") {
      const r = await window.__DK_patrimonioTratarDocumento(dataUrlRaw, { usarIa });
      if (r?.ok && r.imagem) return r.imagem;
    }
    const recorte = await detectarRecorteFallback(dataUrlRaw);
    return recortarDocumentoA4(dataUrlRaw, recorte);
  }

  async function detectarRecorteFallback(dataUrlRaw) {
    if (typeof window.__DK_patrimonioDetectarFolha === "function") {
      const box = await window.__DK_patrimonioDetectarFolha(dataUrlRaw);
      if (box) return box;
    }
    return { esquerda: 0.06, topo: 0.06, direita: 0.94, baixo: 0.94 };
  }

  async function prepararEExibirPreview(dataUrlRaw) {
    const reduzida = await comprimirImagem(dataUrlRaw, 1400, 0.9);
    previewDataUrlRaw = reduzida;
    previewDataUrl = reduzida;
    patrimonioGuardarFotoPendente(reduzida);
    mostrarPreview(reduzida);
    const pergunta = document.querySelector(".patrimonio-preview-pergunta");
    if (pergunta) pergunta.textContent = "A recortar folha A4 e tratar imagem…";
    setMsg("A eliminar fundo e ajustar documento…", false);
    try {
      const tratada = await tratarImagemDocumento(reduzida, { usarIa: false });
      previewDataUrl = tratada;
      if (previewImg) previewImg.src = tratada;
      patrimonioGuardarFotoPendente(tratada);
      if (pergunta) {
        pergunta.textContent = "O recorte está OK? (deve aparecer só a folha branca do CRLV, sem tecido ou fundo colorido)";
      }
      setMsg("", false);
    } catch {
      if (pergunta) pergunta.textContent = "A qualidade da foto está OK?";
      setMsg("Não foi possível tratar automaticamente. Confira a foto.", true);
    }
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
    if (out.placa) {
      out.placa = resolverPlacaMercosul(out.placa) || normPlaca(out.placa);
    }
    if (out.chassi) {
      out.chassi = String(out.chassi)
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "")
        .slice(0, 17);
    }
    if (out.codigoRenavam) out.codigoRenavam = onlyDigits(out.codigoRenavam).slice(0, 11);
    if (out.codigoSegurancaCla) out.codigoSegurancaCla = onlyDigits(out.codigoSegurancaCla).slice(0, 11);
    return out;
  }

  async function processarFotoConfirmada(dataUrlEntrada) {
    if (processando) return;
    processando = true;
    setMsg("A validar nitidez e ler campos do CRLV…", false);
    try {
      const imagemTratada = previewDataUrl || dataUrlEntrada;
      const oai = await chamarIaCrlv(await comprimirImagem(imagemTratada, 2200, 0.94));
      if (!oai.ok) {
        setMsg(MSG_NITIDEZ, true);
        return;
      }
      const campos = normalizarCampos(oai.parsed);
      const val = validarLeituraCrlv(oai.parsed, campos);
      if (!val.ok) {
        setMsg(val.msg || MSG_NITIDEZ, true);
        return;
      }
      const imagemGuardar = await comprimirImagemLimite(imagemTratada, 1600, 320000, 0.88);
      const scanV = Number(window.__DK_patrimonioScanVersion) || PATRIMONIO_SCAN_VERSAO;
      const doc = {
        ...campos,
        id: newId(),
        imagemRecortada: imagemGuardar,
        imagemScanVersao: scanV,
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
          ? `Documento ${campos.placa} atualizado (foto anterior substituída). Próximo documento…`
          : `Documento ${campos.placa} cadastrado. Próximo documento…`,
        false,
        true
      );
      patrimonioLimparFotoPendente();
      renderLista();
      window.setTimeout(() => void abrirCameraNativa(), 500);
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

  function fecharCamera(syncHistory = true) {
    patrimonioFlashLigado = false;
    atualizarUiFlash();
    void pararCamera();
    cameraOverlay?.classList.add("hidden");
    cameraOverlay?.setAttribute("aria-hidden", "true");
    if (syncHistory) patrimonioSyncHistoryAposFechar();
  }

  function fecharPreview(syncHistory = true) {
    previewOverlay?.classList.add("hidden");
    previewOverlay?.setAttribute("aria-hidden", "true");
    previewDataUrl = "";
    previewDataUrlRaw = "";
    if (previewImg) previewImg.removeAttribute("src");
    if (syncHistory) patrimonioSyncHistoryAposFechar();
  }

  function atualizarUiFlash() {
    const btn = document.getElementById("patrimonioCameraFlashBtn");
    if (!btn) return;
    btn.setAttribute("aria-pressed", patrimonioFlashLigado ? "true" : "false");
    btn.textContent = patrimonioFlashLigado ? "Flash: on" : "Flash: off";
  }

  async function aplicarFlashCamera() {
    if (!cameraStream) return;
    const track = cameraStream.getVideoTracks()[0];
    if (!track) return;
    try {
      await track.applyConstraints({ advanced: [{ torch: patrimonioFlashLigado }] });
    } catch {
      try {
        await track.applyConstraints({ torch: patrimonioFlashLigado });
      } catch {
        /* dispositivo sem lanterna */
      }
    }
  }

  async function abrirCameraNativa() {
    fecharPreview(false);
    patrimonioPersistirAreaPortal();
    if (!cameraOverlay || !cameraVideo) {
      fileFallback?.click();
      return;
    }
    cameraOverlay.classList.remove("hidden");
    cameraOverlay.setAttribute("aria-hidden", "false");
    patrimonioNotificarOverlayAberto();
    atualizarUiFlash();
    await pararCamera();
    if (!navigator.mediaDevices?.getUserMedia) {
      fecharCamera();
      fileFallback?.click();
      return;
    }
    try {
      cameraStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1920 },
          height: { ideal: 2560 },
        },
        audio: false,
      });
      cameraVideo.srcObject = cameraStream;
      await cameraVideo.play();
      await aplicarFlashCamera();
    } catch {
      fecharCamera();
      setMsg("Permita o acesso à câmera ou use o seletor de ficheiro.", true);
      fileFallback?.click();
    }
  }

  function alternarFlashCamera() {
    patrimonioFlashLigado = !patrimonioFlashLigado;
    atualizarUiFlash();
    void aplicarFlashCamera();
  }

  function capturarDaCamera() {
    if (!cameraVideo || !cameraCanvas) return;
    const vw = cameraVideo.videoWidth;
    const vh = cameraVideo.videoHeight;
    if (!vw || !vh) return;
    const maxLado = 1400;
    const escala = Math.min(1, maxLado / Math.max(vw, vh));
    const cw = Math.max(1, Math.round(vw * escala));
    const ch = Math.max(1, Math.round(vh * escala));
    cameraCanvas.width = cw;
    cameraCanvas.height = ch;
    const ctx = cameraCanvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(cameraVideo, 0, 0, cw, ch);
    const dataUrl = cameraCanvas.toDataURL("image/jpeg", 0.88);
    fecharCamera(false);
    void prepararEExibirPreview(dataUrl);
  }

  function mostrarPreview(dataUrl) {
    if (!previewOverlay || !previewImg) return;
    previewDataUrl = dataUrl;
    previewImg.src = dataUrl;
    previewOverlay.classList.remove("hidden");
    previewOverlay.setAttribute("aria-hidden", "false");
    patrimonioNotificarOverlayAberto();
  }

  function renderLista() {
    const docs = getDocumentos().slice().sort((a, b) => normPlaca(a.placa).localeCompare(normPlaca(b.placa)));
    if (resumoEl) {
      resumoEl.textContent =
        docs.length > 0
          ? `${docs.length} veículo(s) · placa, RENAVAM, chassi ou motor iguais = mesmo documento (foto mais recente prevalece).`
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

  async function abrirViewerImagem(id) {
    const doc = getDocById(id);
    let url = doc?.imagemRecortada;
    if (!url || !imagemViewer || !imagemViewerImg) return;

    if (typeof window.__DK_patrimonioRetocarImagem === "function") {
      try {
        const retocada = await window.__DK_patrimonioRetocarImagem(url);
        if (retocada && retocada !== url) {
          url = retocada;
          const store = loadStore();
          const idx = store.documentos.findIndex((d) => d.id === id);
          if (idx >= 0) {
            store.documentos[idx].imagemRecortada = await comprimirImagemLimite(url, 1600, 320000, 0.88);
            store.documentos[idx].imagemScanVersao = PATRIMONIO_SCAN_VERSAO;
            store.documentos[idx].imagemAtualizadaEm = new Date().toISOString();
            saveStore(store);
          }
        }
      } catch {
        /* mostrar original */
      }
    }

    imagemViewerImg.src = url;
    imagemViewer.dataset.patId = id;
    imagemViewer.classList.remove("hidden");
    imagemViewer.setAttribute("aria-hidden", "false");
    patrimonioNotificarOverlayAberto();
  }

  function fecharViewerImagem(syncHistory = true) {
    imagemViewer?.classList.add("hidden");
    imagemViewer?.setAttribute("aria-hidden", "true");
    if (imagemViewerImg) imagemViewerImg.removeAttribute("src");
    if (syncHistory) patrimonioSyncHistoryAposFechar();
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

  function chaveModeloAnoDoc(doc) {
    const marca = String(doc.marcaModeloVersao || "").trim();
    const fab = String(doc.anoFabricacao || "").trim();
    const mod = String(doc.anoModelo || "").trim();
    if (!marca && !fab && !mod) return "";
    return `${marca}|${fab}|${mod}`;
  }

  /** Contagem: marca/modelo/versão + ano fabricação + ano modelo = N registro(s). */
  function buildContadorModeloAnoLinhas(docs) {
    const map = new Map();
    for (const d of docs) {
      const k = chaveModeloAnoDoc(d);
      if (!k) continue;
      map.set(k, (map.get(k) || 0) + 1);
    }
    return [...map.entries()]
      .sort((a, b) => a[0].localeCompare(b[0], "pt-BR"))
      .map(([k, qtd]) => {
        const [marca, fab, mod] = k.split("|");
        const qLabel = qtd === 1 ? "1 registro" : `${qtd} registros`;
        return `${marca}+${fab}+${mod} = ${qLabel}`;
      });
  }

  function renderContadorModeloAno(docs) {
    const linhas = buildContadorModeloAnoLinhas(docs);
    if (!relatorioContador) return;
    if (!linhas.length) {
      relatorioContador.innerHTML = "";
      relatorioContador.classList.add("hidden");
      return;
    }
    relatorioContador.classList.remove("hidden");
    relatorioContador.innerHTML = `<p class="subtext" style="margin:0 0 0.35rem"><strong>Contagem por modelo e ano</strong></p><ul class="patrimonio-relatorio-contador__lista">${linhas.map((l) => `<li>${escapeHtml(l)}</li>`).join("")}</ul>`;
  }

  function buildContadorModeloAnoHtmlBloco(docs) {
    const linhas = buildContadorModeloAnoLinhas(docs);
    if (!linhas.length) return "";
    const itens = linhas.map((l) => `<li>${escapeHtml(l)}</li>`).join("");
    return `<div class="contador-modelo-ano"><p><strong>Contagem por modelo e ano</strong></p><ul>${itens}</ul></div>`;
  }

  function renderRelatorioTabela() {
    if (!relatorioConteudo) return;
    const docs = getDocumentos().slice().sort((a, b) => normPlaca(a.placa).localeCompare(normPlaca(b.placa)));
    renderContadorModeloAno(docs);
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
    const docs = getDocumentos().slice();
    const contador = buildContadorModeloAnoHtmlBloco(docs);
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
<style>body{font-family:Segoe UI,Arial,sans-serif;font-size:11px;margin:16px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ccc;padding:4px 6px;text-align:left;vertical-align:top}th{background:#f5f5f5}.meta{color:#555;margin-bottom:12px}a{color:#0066cc}.contador-modelo-ano{margin:0 0 14px;padding:8px 10px;border:1px solid #ccc;border-radius:6px;background:#faf6e8}.contador-modelo-ano ul{margin:4px 0 0;padding-left:18px}</style></head>
<body><h1>${escapeHtml(titulo)}</h1><p class="meta">Grupo DK Locadora · ${escapeHtml(new Date().toLocaleString("pt-BR"))} · ${rows.length} veículo(s)</p>
${contador}
<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></body></html>`;
  }

  function buildPatrimonioExcelHtml(headers, rows, titulo) {
    const docs = getDocumentos().slice();
    const contador = buildContadorModeloAnoHtmlBloco(docs);
    const head = headers.map((h) => `<th>${escapeHtml(h)}</th>`).join("");
    const body = rows
      .map((row) => {
        const cells = row.slice(0, -1).map((c) => `<td>${escapeHtml(c)}</td>`).join("");
        return `<tr>${cells}<td>Ver imagem</td></tr>`;
      })
      .join("");
    return `<html xmlns:o="urn:schemas-microsoft-com:office:office"><head><meta charset="utf-8"><title>${escapeHtml(titulo)}</title></head>
<body><h2>${escapeHtml(titulo)}</h2>${contador}<table border="1"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></body></html>`;
  }

  function abrirRelatorioModal() {
    if (!relatorioModal) return;
    try {
      renderRelatorioTabela();
    } catch (e) {
      console.error("[DK patrimônio] relatório", e);
      if (relatorioConteudo) {
        relatorioConteudo.innerHTML = '<p class="portal-feedback portal-feedback--erro">Erro ao abrir relatório. Atualize a página.</p>';
      }
    }
    relatorioModal.classList.remove("hidden");
    relatorioModal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }

  function fecharRelatorioModal() {
    relatorioModal?.classList.add("hidden");
    relatorioModal?.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
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
    document.getElementById("patrimonioCameraFlashBtn")?.addEventListener("click", alternarFlashCamera);
    document.getElementById("patrimonioPreviewSimBtn")?.addEventListener("click", () => {
      const url = previewDataUrl;
      patrimonioLimparFotoPendente();
      fecharPreview();
      if (url) void processarFotoConfirmada(url);
    });
    document.getElementById("patrimonioPreviewNaoBtn")?.addEventListener("click", () => {
      fecharPreview();
      void abrirCameraNativa();
    });
    document.getElementById("patrimonioPreviewRetratBtn")?.addEventListener("click", () => {
      if (previewDataUrlRaw) void prepararEExibirPreview(previewDataUrlRaw);
    });

    fileFallback?.addEventListener("change", async () => {
      const f = fileFallback.files?.[0];
      fileFallback.value = "";
      if (!f || !f.type.startsWith("image/")) return;
      const fr = new FileReader();
      fr.onload = () => void prepararEExibirPreview(String(fr.result || ""));
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
    patrimonioModalHistorico = false;
    patrimonioHistorySuppress = false;
    patrimonioLimparFotoPendente();
    fecharCamera(false);
    fecharPreview(false);
    fecharViewerImagem(false);
    fecharRelatorioModal();
    setMsg("");
    renderLista();
  }

  let migracaoScanEmCurso = false;

  async function migrarImagensPatrimonioScan() {
    if (migracaoScanEmCurso) return;
    if (patrimonioOverlayAberto() || processando) return;
    if (typeof window.__DK_patrimonioTratarDocumento !== "function") return;
    const alvo = Number(window.__DK_patrimonioScanVersion) || PATRIMONIO_SCAN_VERSAO;
    const store = loadStore();
    const pendentes = store.documentos.filter(
      (d) => d?.imagemRecortada && Number(d.imagemScanVersao || 0) < alvo
    );
    if (!pendentes.length) return;

    migracaoScanEmCurso = true;
    setMsg(`A ajustar ${pendentes.length} imagem(ns) ao padrão CRLV (sem fundo)…`, false);
    let alterou = false;

    try {
      for (const d of pendentes) {
        const entrada = d.imagemRecortada;
        const fn =
          typeof window.__DK_patrimonioRetocarImagem === "function"
            ? window.__DK_patrimonioRetocarImagem
            : null;
        let nova = null;
        if (fn) {
          nova = await fn(entrada);
        } else {
          const r = await window.__DK_patrimonioTratarDocumento(entrada, { retocarArmazenada: true });
          nova = r?.ok ? r.imagem : null;
        }
        if (nova && nova !== entrada) {
          d.imagemRecortada = await comprimirImagemLimite(nova, 1600, 320000, 0.88);
          d.imagemScanVersao = alvo;
          d.imagemAtualizadaEm = new Date().toISOString();
          alterou = true;
        }
      }
      if (alterou) {
        saveStore(store);
        setMsg("Imagens ajustadas ao padrão CRLV (só folha branca).", false, true);
        renderLista();
      } else {
        setMsg("", false);
      }
    } catch {
      setMsg("", false);
    } finally {
      migracaoScanEmCurso = false;
    }
  }

  function onShowPatrimonio() {
    if (typeof window.__DK_isPortalTitularAdministrador === "function") {
      if (!window.__DK_isPortalTitularAdministrador()) {
        setMsg("Cadastro de patrimônio: apenas administrador.", true);
        return;
      }
    }
    patrimonioPersistirAreaPortal();
    const store = loadStore();
    saveStore(store);
    void refreshOpenAIStatus();
    renderLista();
    try {
      const pendente = sessionStorage.getItem(PENDING_FOTO_KEY);
      if (pendente && pendente.startsWith("data:image/")) {
        void prepararEExibirPreview(pendente);
      }
    } catch {
      /* ignore */
    }
    window.setTimeout(() => void migrarImagensPatrimonioScan(), 800);
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
  window.__DK_patrimonioOverlayAberto = patrimonioOverlayAberto;
  window.__DK_openPatrimonioImagemById = abrirViewerImagem;

  window.addEventListener("dk-comprovantes-synced", () => {
    renderLista();
  });

  bindUi();
  renderLista();
})();
